/* ============================================================================
   Vault — credential detection & import engine.

   Turns messy real-world data into clean VaultEntry logins/TOTP items:
     • CSV exports from Chrome, Edge, Brave, Firefox, Safari, Bitwarden,
       1Password, LastPass, KeePass, NordPass, Dashlane, Proton Pass … — the
       column layout is auto-detected from the header (no fixed order needed).
     • Freeform pasted text — "url  user  pass" lines, "user:pass", key/value
       blocks ("username: …", "password: …"), bare URLs, and otpauth:// URIs.

   Everything runs locally; nothing is uploaded. The parser is defensive: it
   tolerates BOMs, CRLF/CR, quoted fields with embedded commas/quotes/newlines,
   ragged rows and unknown columns, and never throws on bad input.
   ========================================================================== */

import { parseOtpAuth, isValidBase32 } from "./crypto";
import { newEntry, domainOf, type VaultEntry } from "./store";

export type DetectedKind = "login" | "totp";

export type DetectedItem = {
  kind: DetectedKind;
  title: string;
  username?: string;
  password?: string;
  url?: string;
  totpSecret?: string;
  otpSecret?: string;
  otpIssuer?: string;
  notes?: string;
  /** 0..1 — how confident the parser is that this row is a real credential */
  confidence: number;
};

export type DetectResult = {
  items: DetectedItem[];
  /** human-readable name of the detected source format */
  format: string;
  /** rows we saw but skipped (blank / header / junk) */
  skipped: number;
};

/* --------------------------------------------------------------------------
   RFC-4180-ish CSV parser — handles quotes, escaped quotes, embedded newlines.
   ------------------------------------------------------------------------ */

export function parseCsv(text: string): string[][] {
  // strip UTF-8 BOM, normalise newlines
  const src = text.replace(/^\uFEFF/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = 0;
  const n = src.length;

  // auto-detect delimiter from the first non-quoted line (comma / tab / semicolon)
  const delim = sniffDelimiter(src);

  while (i < n) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') { field += '"'; i += 2; continue; }
        inQuotes = false; i++; continue;
      }
      field += ch; i++; continue;
    }
    if (ch === '"') { inQuotes = true; i++; continue; }
    if (ch === delim) { row.push(field); field = ""; i++; continue; }
    if (ch === "\r") { i++; continue; }
    if (ch === "\n") { row.push(field); rows.push(row); row = []; field = ""; i++; continue; }
    field += ch; i++;
  }
  // flush trailing field/row
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
  // drop fully-empty rows
  return rows.filter((r) => r.some((c) => c.trim().length > 0));
}

function sniffDelimiter(src: string): string {
  const firstLine = src.split(/\r?\n/, 1)[0] || "";
  const counts: Record<string, number> = { ",": 0, "\t": 0, ";": 0 };
  let q = false;
  for (const ch of firstLine) {
    if (ch === '"') q = !q;
    else if (!q && ch in counts) counts[ch]++;
  }
  const best = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  return best && best[1] > 0 ? best[0] : ",";
}

/* --------------------------------------------------------------------------
   Column mapping — map any header vocabulary onto our fields.
   ------------------------------------------------------------------------ */

const HEADER_ALIASES: Record<keyof ColumnMap, string[]> = {
  title: ["name", "title", "account", "item name", "entry", "label", "display name"],
  url: ["url", "website", "site", "login_uri", "web site", "urls", "hostname", "domain", "login url", "uri"],
  username: ["username", "user", "login", "login_username", "user name", "email", "e-mail", "account name", "loginname"],
  password: ["password", "pass", "pwd", "login_password", "passwd", "secret"],
  totp: ["totp", "otpauth", "otp", "2fa", "authenticator key", "totpauth", "login_totp", "one-time password"],
  notes: ["note", "notes", "comment", "comments", "extra", "memo"],
};

type ColumnMap = { title: number; url: number; username: number; password: number; totp: number; notes: number };

function mapColumns(header: string[]): ColumnMap {
  const norm = header.map((h) => h.trim().toLowerCase());
  const find = (aliases: string[]) => {
    // exact match first, then contains
    for (const a of aliases) { const i = norm.indexOf(a); if (i !== -1) return i; }
    for (let i = 0; i < norm.length; i++) if (aliases.some((a) => norm[i].includes(a))) return i;
    return -1;
  };
  return {
    title: find(HEADER_ALIASES.title),
    url: find(HEADER_ALIASES.url),
    username: find(HEADER_ALIASES.username),
    password: find(HEADER_ALIASES.password),
    totp: find(HEADER_ALIASES.totp),
    notes: find(HEADER_ALIASES.notes),
  };
}

function looksLikeHeader(cols: ColumnMap): boolean {
  // a real password export always has at least a password or username column
  return cols.password !== -1 || cols.username !== -1 || cols.url !== -1 || cols.totp !== -1;
}

function formatName(header: string[]): string {
  const h = header.join(",").toLowerCase();
  if (h.includes("login_uri") || h.includes("login_username")) return "Bitwarden";
  if (h.includes("otpauth") && h.includes("title")) return "1Password / generic";
  if (h.startsWith("name,url,username,password")) return "Chrome / Edge / Brave";
  if (h.includes("url") && h.includes("httprealm")) return "Firefox";
  if (h.includes("grouping") && h.includes("fav")) return "LastPass";
  return "CSV export";
}

/* --------------------------------------------------------------------------
   Public: detect from CSV
   ------------------------------------------------------------------------ */

export function detectFromCsv(text: string): DetectResult {
  const rows = parseCsv(text);
  if (rows.length === 0) return { items: [], format: "empty", skipped: 0 };

  let header = rows[0];
  let cols = mapColumns(header);
  let dataRows = rows.slice(1);
  let format = formatName(header);

  // No recognisable header? Fall back to positional guessing on all rows.
  if (!looksLikeHeader(cols)) {
    const guessed = guessPositional(rows);
    cols = guessed.cols;
    dataRows = rows; // treat every row as data
    format = "CSV (no header — positional)";
  }

  const items: DetectedItem[] = [];
  let skipped = 0;
  for (const r of dataRows) {
    const item = rowToItem(r, cols);
    if (item) items.push(item);
    else skipped++;
  }
  return { items: dedupe(items), format, skipped };
}

/** When there's no header, guess which columns hold url/user/pass by content. */
function guessPositional(rows: string[][]): { cols: ColumnMap } {
  const width = Math.max(...rows.map((r) => r.length));
  const score = { url: new Array(width).fill(0), user: new Array(width).fill(0), pass: new Array(width).fill(0) };
  const sample = rows.slice(0, 40);
  for (const r of sample) {
    for (let c = 0; c < r.length; c++) {
      const v = (r[c] || "").trim();
      if (!v) continue;
      if (/^https?:\/\/|\.[a-z]{2,}(\/|$)/i.test(v)) score.url[c]++;
      if (/@|^[a-z0-9._-]+$/i.test(v) && v.length < 64) score.user[c]++;
      if (/[^a-z0-9]/i.test(v) && v.length >= 6 && v.length < 128) score.pass[c]++;
    }
  }
  const argmax = (arr: number[]) => arr.reduce((best, v, i) => (v > arr[best] ? i : best), 0);
  const url = argmax(score.url);
  const username = argmax(score.user.map((v, i) => (i === url ? -1 : v)));
  const password = argmax(score.pass.map((v, i) => (i === url || i === username ? -1 : v)));
  return { cols: { title: -1, url, username, password, totp: -1, notes: -1 } };
}

function rowToItem(r: string[], cols: ColumnMap): DetectedItem | null {
  const at = (i: number) => (i >= 0 && i < r.length ? (r[i] || "").trim() : "");
  const url = at(cols.url);
  const username = at(cols.username);
  const password = at(cols.password);
  const totpRaw = at(cols.totp);
  const notes = at(cols.notes);
  let title = at(cols.title);

  // a TOTP-only row
  if (totpRaw && !password) {
    const parsed = parseOtpAuth(totpRaw);
    if (parsed) {
      return {
        kind: "totp",
        title: title || parsed.issuer || parsed.label || "Authenticator",
        otpSecret: parsed.secret,
        otpIssuer: parsed.issuer,
        confidence: 0.9,
      };
    }
  }

  if (!password && !username && !url) return null; // junk / blank

  if (!title) title = url ? domainOf(url) : username || "Login";

  let confidence = 0.5;
  if (password) confidence += 0.3;
  if (url) confidence += 0.1;
  if (username) confidence += 0.1;

  const item: DetectedItem = {
    kind: "login",
    title,
    username: username || undefined,
    password: password || undefined,
    url: url || undefined,
    notes: notes || undefined,
    confidence: Math.min(1, confidence),
  };
  if (totpRaw) {
    const parsed = parseOtpAuth(totpRaw);
    if (parsed) item.totpSecret = totpRaw;
  }
  return item;
}

/* --------------------------------------------------------------------------
   Public: detect from freeform pasted text
   Handles, per non-empty line or block:
     • otpauth:// URIs                          → TOTP
     • "label | url | user | pass" (pipe/tab)   → login
     • "user : pass"  /  "user@host  pass"      → login
     • "key: value" blocks (username:/password:/url:) separated by blank lines
     • a bare URL                               → login stub
   ------------------------------------------------------------------------ */

export function detectFromText(text: string): DetectResult {
  const clean = text.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n").trim();
  if (!clean) return { items: [], format: "empty", skipped: 0 };

  // If it smells like CSV (has a header row with our column names), defer to CSV.
  const firstLine = clean.split("\n", 1)[0].toLowerCase();
  if (/\b(password|username|login_uri|otpauth)\b/.test(firstLine) && /[,\t;]/.test(firstLine)) {
    return detectFromCsv(clean);
  }

  const items: DetectedItem[] = [];
  let skipped = 0;

  // key/value blocks separated by blank lines
  const blocks = clean.split(/\n{2,}/);
  const kvHits: DetectedItem[] = [];
  for (const block of blocks) {
    const kv = parseKeyValueBlock(block);
    if (kv) kvHits.push(kv);
  }
  if (kvHits.length) {
    return { items: dedupe(kvHits), format: "key/value text", skipped: 0 };
  }

  // otherwise, line by line
  for (const raw of clean.split("\n")) {
    const line = raw.trim();
    if (!line) continue;

    if (line.startsWith("otpauth://")) {
      const p = parseOtpAuth(line);
      if (p) { items.push({ kind: "totp", title: p.issuer || p.label || "Authenticator", otpSecret: p.secret, otpIssuer: p.issuer, confidence: 0.95 }); continue; }
    }

    const parts = line.split(/\s*[|\t]\s*/).filter(Boolean);
    if (parts.length >= 2) {
      const urlPart = parts.find((p) => isUrlish(p));
      const rest = parts.filter((p) => p !== urlPart);
      const [user, pass] = rest;
      items.push({
        kind: "login",
        title: urlPart ? domainOf(urlPart) : user || "Login",
        url: urlPart,
        username: user,
        password: pass,
        confidence: pass ? 0.8 : 0.5,
      });
      continue;
    }

    // "user:pass" (avoid splitting URLs like https://…)
    const m = line.match(/^([^\s:]+@?[^\s:]*)\s*[:：]\s*(\S.*)$/);
    if (m && !isUrlish(line)) {
      items.push({ kind: "login", title: m[1], username: m[1], password: m[2], confidence: 0.65 });
      continue;
    }

    if (isUrlish(line)) { items.push({ kind: "login", title: domainOf(line), url: line, confidence: 0.4 }); continue; }
    if (isValidBase32(line) && line.replace(/\s/g, "").length >= 16) { items.push({ kind: "totp", title: "Authenticator", otpSecret: line.replace(/\s/g, ""), confidence: 0.6 }); continue; }

    skipped++;
  }

  return { items: dedupe(items), format: "pasted text", skipped };
}

function parseKeyValueBlock(block: string): DetectedItem | null {
  const item: DetectedItem = { kind: "login", title: "", confidence: 0.5 };
  let hits = 0;
  // In free text, "Site:"/"Account:" almost always name the entry, not its URL.
  const titleKeys = [...HEADER_ALIASES.title, "site", "account"];
  for (const line of block.split("\n")) {
    const m = line.match(/^\s*([a-z ._-]{2,20})\s*[:：]\s*(.+?)\s*$/i);
    if (!m) continue;
    const key = m[1].trim().toLowerCase();
    const val = m[2].trim();
    if (titleKeys.some((a) => key === a)) { if (!item.title) item.title = val; hits++; }
    else if (HEADER_ALIASES.username.some((a) => key === a || key.includes(a))) { item.username = val; hits++; }
    else if (HEADER_ALIASES.password.some((a) => key === a || key.includes(a))) { item.password = val; hits++; }
    else if (HEADER_ALIASES.url.some((a) => key === a || key.includes(a)) && isUrlish(val)) { item.url = val; hits++; }
    else if (HEADER_ALIASES.totp.some((a) => key.includes(a))) { const p = parseOtpAuth(val); if (p) { item.totpSecret = val; hits++; } }
  }
  if (hits < 2 || (!item.password && !item.totpSecret)) return null;
  if (!item.title) item.title = item.url ? domainOf(item.url) : item.username || "Login";
  item.confidence = 0.75;
  return item;
}

function isUrlish(s: string): boolean {
  return /^https?:\/\//i.test(s) || /^[a-z0-9-]+(\.[a-z0-9-]+)+(\/|$|\?)/i.test(s);
}

/* --------------------------------------------------------------------------
   Master entry point + de-dupe + conversion to VaultEntry
   ------------------------------------------------------------------------ */

export function detect(input: string): DetectResult {
  const clean = input.replace(/^\uFEFF/, "").trim();
  if (!clean) return { items: [], format: "empty", skipped: 0 };
  const firstLine = clean.split(/\r?\n/, 1)[0];
  // treat as CSV when the first line is delimiter-separated with 2+ columns
  const isCsvish = /[,\t;]/.test(firstLine) && parseCsv(firstLine).some((r) => r.length >= 2);
  return isCsvish ? detectFromCsv(clean) : detectFromText(clean);
}

function dedupe(items: DetectedItem[]): DetectedItem[] {
  const seen = new Set<string>();
  const out: DetectedItem[] = [];
  for (const it of items) {
    const key = `${it.kind}|${(it.url || "").toLowerCase()}|${(it.username || "").toLowerCase()}|${it.password || it.otpSecret || ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(it);
  }
  return out;
}

export function toVaultEntries(items: DetectedItem[], folder = ""): VaultEntry[] {
  return items.map((it) => {
    const base = newEntry(it.kind);
    base.title = it.title || "Login";
    base.folder = folder;
    base.notes = it.notes || "";
    if (it.kind === "totp") {
      base.otpSecret = it.otpSecret;
      base.otpIssuer = it.otpIssuer;
    } else {
      base.username = it.username;
      base.password = it.password;
      base.url = it.url;
      if (it.totpSecret) base.totpSecret = it.totpSecret;
    }
    return base;
  });
}
