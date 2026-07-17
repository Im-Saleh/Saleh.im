// ============================================================================
//  Forge — pure logic for the developer toolbox.
//
//  Every function here is side-effect free and framework-agnostic so the UI
//  layer stays thin and each tool is easy to reason about (and test).
// ============================================================================

/* ------------------------------------------------------------------ *
 * JSON
 * ------------------------------------------------------------------ */
export type JsonResult = { ok: boolean; output: string; error?: string };

export function formatJson(input: string, indent = 2): JsonResult {
  if (!input.trim()) return { ok: true, output: "" };
  try {
    const parsed = JSON.parse(input);
    return { ok: true, output: JSON.stringify(parsed, null, indent) };
  } catch (e) {
    return { ok: false, output: "", error: humanJsonError(input, e) };
  }
}

export function minifyJson(input: string): JsonResult {
  if (!input.trim()) return { ok: true, output: "" };
  try {
    return { ok: true, output: JSON.stringify(JSON.parse(input)) };
  } catch (e) {
    return { ok: false, output: "", error: humanJsonError(input, e) };
  }
}

export function sortJsonKeys(input: string, indent = 2): JsonResult {
  if (!input.trim()) return { ok: true, output: "" };
  try {
    const sort = (v: unknown): unknown => {
      if (Array.isArray(v)) return v.map(sort);
      if (v && typeof v === "object") {
        return Object.keys(v as Record<string, unknown>)
          .sort()
          .reduce<Record<string, unknown>>((acc, k) => {
            acc[k] = sort((v as Record<string, unknown>)[k]);
            return acc;
          }, {});
      }
      return v;
    };
    return { ok: true, output: JSON.stringify(sort(JSON.parse(input)), null, indent) };
  } catch (e) {
    return { ok: false, output: "", error: humanJsonError(input, e) };
  }
}

function humanJsonError(input: string, e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  const m = msg.match(/position (\d+)/);
  if (m) {
    const pos = Number(m[1]);
    const before = input.slice(0, pos);
    const line = before.split("\n").length;
    const col = pos - before.lastIndexOf("\n");
    return `${msg} (line ${line}, column ${col})`;
  }
  return msg;
}

export function jsonStats(input: string): { keys: number; depth: number; nodes: number } | null {
  try {
    const parsed = JSON.parse(input);
    let keys = 0;
    let nodes = 0;
    let maxDepth = 0;
    const walk = (v: unknown, depth: number) => {
      nodes++;
      maxDepth = Math.max(maxDepth, depth);
      if (Array.isArray(v)) v.forEach((x) => walk(x, depth + 1));
      else if (v && typeof v === "object") {
        for (const k of Object.keys(v as object)) {
          keys++;
          walk((v as Record<string, unknown>)[k], depth + 1);
        }
      }
    };
    walk(parsed, 1);
    return { keys, depth: maxDepth, nodes };
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ *
 * Base64 / URL / HTML
 * ------------------------------------------------------------------ */
export function encodeBase64(input: string, urlSafe = false): string {
  const bytes = new TextEncoder().encode(input);
  let bin = "";
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  let out = btoa(bin);
  if (urlSafe) out = out.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return out;
}

export function decodeBase64(input: string): JsonResult {
  try {
    let s = input.trim().replace(/-/g, "+").replace(/_/g, "/");
    while (s.length % 4) s += "=";
    const bin = atob(s);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return { ok: true, output: new TextDecoder().decode(bytes) };
  } catch (e) {
    return { ok: false, output: "", error: e instanceof Error ? e.message : "Invalid Base64" };
  }
}

export function encodeUrl(input: string): string {
  return encodeURIComponent(input);
}
export function decodeUrl(input: string): JsonResult {
  try {
    return { ok: true, output: decodeURIComponent(input.replace(/\+/g, " ")) };
  } catch (e) {
    return { ok: false, output: "", error: e instanceof Error ? e.message : "Invalid URL encoding" };
  }
}

export function parseQuery(input: string): { key: string; value: string }[] {
  let q = input.trim();
  const qi = q.indexOf("?");
  if (qi >= 0) q = q.slice(qi + 1);
  const hi = q.indexOf("#");
  if (hi >= 0) q = q.slice(0, hi);
  if (!q) return [];
  return q.split("&").map((pair) => {
    const eq = pair.indexOf("=");
    const key = eq >= 0 ? pair.slice(0, eq) : pair;
    const value = eq >= 0 ? pair.slice(eq + 1) : "";
    const safeDecode = (s: string) => {
      try {
        return decodeURIComponent(s.replace(/\+/g, " "));
      } catch {
        return s;
      }
    };
    return { key: safeDecode(key), value: safeDecode(value) };
  });
}

const HTML_ENTITIES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};
export function encodeHtml(input: string): string {
  return input.replace(/[&<>"']/g, (c) => HTML_ENTITIES[c]);
}
export function decodeHtml(input: string): string {
  return input
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)));
}

/* ------------------------------------------------------------------ *
 * JWT
 * ------------------------------------------------------------------ */
export type JwtParts = {
  ok: boolean;
  header?: Record<string, unknown>;
  payload?: Record<string, unknown>;
  signature?: string;
  error?: string;
  claims?: { key: string; label: string; value: string }[];
};

export function decodeJwt(token: string): JwtParts {
  const t = token.trim();
  const parts = t.split(".");
  if (parts.length < 2) return { ok: false, error: "A JWT has three dot-separated parts." };
  try {
    const dec = (s: string) => JSON.parse(decodeBase64(s).output);
    const header = dec(parts[0]);
    const payload = dec(parts[1]);
    const claims: { key: string; label: string; value: string }[] = [];
    const push = (key: string, label: string) => {
      if (payload[key] != null) {
        const v = payload[key];
        const isTime = ["exp", "iat", "nbf"].includes(key);
        claims.push({
          key,
          label,
          value: isTime ? `${v} · ${new Date(Number(v) * 1000).toUTCString()}` : String(v),
        });
      }
    };
    push("iss", "Issuer");
    push("sub", "Subject");
    push("aud", "Audience");
    push("exp", "Expires");
    push("nbf", "Not before");
    push("iat", "Issued at");
    push("jti", "JWT ID");
    return { ok: true, header, payload, signature: parts[2] || "", claims };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not decode token" };
  }
}

export function jwtExpiry(payload?: Record<string, unknown>): { label: string; expired: boolean } | null {
  if (!payload || payload.exp == null) return null;
  const exp = Number(payload.exp) * 1000;
  const now = Date.now();
  const expired = exp < now;
  return { label: expired ? "Expired " + relativeTime(exp) : "Valid, expires " + relativeTime(exp), expired };
}

/* ------------------------------------------------------------------ *
 * Hashing (WebCrypto) + UUID / ULID
 * ------------------------------------------------------------------ */
export async function hashHex(algo: "SHA-1" | "SHA-256" | "SHA-384" | "SHA-512", input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest(algo, data);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function uuidv4(): string {
  const c = globalThis.crypto;
  if (typeof c.randomUUID === "function") return c.randomUUID();
  const b = c.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, "0"));
  return `${h.slice(0, 4).join("")}-${h.slice(4, 6).join("")}-${h.slice(6, 8).join("")}-${h
    .slice(8, 10)
    .join("")}-${h.slice(10, 16).join("")}`;
}

const ULID_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
export function ulid(): string {
  let time = Date.now();
  let out = "";
  for (let i = 9; i >= 0; i--) {
    out = ULID_ALPHABET[time % 32] + out;
    time = Math.floor(time / 32);
  }
  const rand = crypto.getRandomValues(new Uint8Array(16));
  for (let i = 0; i < 16; i++) out += ULID_ALPHABET[rand[i] % 32];
  return out;
}

export function nanoid(size = 21): string {
  const alphabet = "useandom-26T198340PX75pxJACKVERYMINDBUSHWOLF_GQZbfghjklqvwyzrict";
  const bytes = crypto.getRandomValues(new Uint8Array(size));
  let id = "";
  for (let i = 0; i < size; i++) id += alphabet[bytes[i] & 63];
  return id;
}

/* ------------------------------------------------------------------ *
 * Colour
 * ------------------------------------------------------------------ */
export type RGB = { r: number; g: number; b: number };

export function parseColor(input: string): RGB | null {
  const s = input.trim().toLowerCase();
  const hex = s.match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/);
  if (hex) {
    let h = hex[1];
    if (h.length === 3) h = h.split("").map((c) => c + c).join("");
    return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16) };
  }
  const rgb = s.match(/rgba?\(([^)]+)\)/);
  if (rgb) {
    const parts = rgb[1].split(",").map((p) => parseFloat(p));
    if (parts.length >= 3) return { r: clamp(parts[0], 0, 255), g: clamp(parts[1], 0, 255), b: clamp(parts[2], 0, 255) };
  }
  return null;
}

export function rgbToHex({ r, g, b }: RGB): string {
  return "#" + [r, g, b].map((x) => Math.round(x).toString(16).padStart(2, "0")).join("");
}

export function rgbToHsl({ r, g, b }: RGB): { h: number; s: number; l: number } {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h /= 6;
  }
  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

export function relativeLuminance({ r, g, b }: RGB): number {
  const chan = (c: number) => {
    c /= 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * chan(r) + 0.7152 * chan(g) + 0.0722 * chan(b);
}

export function contrastRatio(a: RGB, b: RGB): number {
  const l1 = relativeLuminance(a);
  const l2 = relativeLuminance(b);
  const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}

export function wcagRating(ratio: number): { aa: boolean; aaa: boolean; aaLarge: boolean; label: string } {
  const aa = ratio >= 4.5;
  const aaa = ratio >= 7;
  const aaLarge = ratio >= 3;
  return { aa, aaa, aaLarge, label: aaa ? "AAA" : aa ? "AA" : aaLarge ? "AA Large" : "Fail" };
}

export function shades(base: RGB): string[] {
  const { h, s } = rgbToHsl(base);
  const levels = [95, 85, 72, 60, 48, 38, 28, 18];
  return levels.map((l) => hslToHex(h, s, l));
}

export function hslToHex(h: number, s: number, l: number): string {
  s /= 100;
  l /= 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const to = (x: number) => Math.round(x * 255).toString(16).padStart(2, "0");
  return `#${to(f(0))}${to(f(8))}${to(f(4))}`;
}

/* ------------------------------------------------------------------ *
 * Time
 * ------------------------------------------------------------------ */
export function relativeTime(ts: number): string {
  const diff = ts - Date.now();
  const abs = Math.abs(diff);
  const units: [number, string][] = [
    [1000, "second"],
    [60_000, "minute"],
    [3_600_000, "hour"],
    [86_400_000, "day"],
    [2_592_000_000, "month"],
    [31_536_000_000, "year"],
  ];
  let value = abs / 1000;
  let unit = "second";
  for (let i = units.length - 1; i >= 0; i--) {
    if (abs >= units[i][0]) {
      value = abs / units[i][0];
      unit = units[i][1];
      break;
    }
  }
  const n = Math.round(value);
  const label = `${n} ${unit}${n !== 1 ? "s" : ""}`;
  return diff >= 0 ? `in ${label}` : `${label} ago`;
}

export function epochToParts(input: string): {
  ok: boolean;
  ms?: number;
  iso?: string;
  utc?: string;
  local?: string;
  relative?: string;
  error?: string;
} {
  const trimmed = input.trim();
  if (!trimmed) return { ok: false, error: "Enter a timestamp" };
  let ms: number;
  if (/^\d+$/.test(trimmed)) {
    const n = Number(trimmed);
    ms = trimmed.length <= 10 ? n * 1000 : n; // seconds vs milliseconds
  } else {
    const parsed = Date.parse(trimmed);
    if (Number.isNaN(parsed)) return { ok: false, error: "Unrecognised date/timestamp" };
    ms = parsed;
  }
  const d = new Date(ms);
  return {
    ok: true,
    ms,
    iso: d.toISOString(),
    utc: d.toUTCString(),
    local: d.toString(),
    relative: relativeTime(ms),
  };
}

/* ------------------------------------------------------------------ *
 * Cron
 * ------------------------------------------------------------------ */
export function explainCron(expr: string): { ok: boolean; text?: string; error?: string } {
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) return { ok: false, error: "Expected 5 fields: minute hour day month weekday" };
  const [min, hour, dom, mon, dow] = parts;
  const months = ["", "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const field = (v: string, name: string, names?: string[]) => {
    if (v === "*") return `every ${name}`;
    if (v.startsWith("*/")) return `every ${v.slice(2)} ${name}s`;
    if (v.includes(",")) return `${name}s ${v}`;
    if (v.includes("-")) return `${name}s ${v}`;
    if (names && !Number.isNaN(Number(v))) return names[Number(v)] || v;
    return `${name} ${v}`;
  };
  const time =
    min === "*" && hour === "*"
      ? "every minute"
      : `at ${hour === "*" ? "every hour" : hour.padStart(2, "0")}:${min === "*" ? "00" : min.padStart(2, "0")}`;
  const parts2: string[] = [time];
  if (dom !== "*") parts2.push("on day " + dom + " of the month");
  if (mon !== "*") parts2.push("in " + field(mon, "month", months));
  if (dow !== "*") parts2.push("on " + field(dow, "weekday", days));
  return { ok: true, text: parts2.join(", ") };
}

/* ------------------------------------------------------------------ *
 * Text
 * ------------------------------------------------------------------ */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function toTitleCase(input: string): string {
  return input.replace(/\w\S*/g, (t) => t.charAt(0).toUpperCase() + t.slice(1).toLowerCase());
}
export function toCamelCase(input: string): string {
  return input
    .replace(/[-_\s]+(.)?/g, (_, c) => (c ? c.toUpperCase() : ""))
    .replace(/^(.)/, (c) => c.toLowerCase());
}
export function toSnakeCase(input: string): string {
  return input
    .replace(/([a-z])([A-Z])/g, "$1_$2")
    .replace(/[-\s]+/g, "_")
    .toLowerCase();
}
export function toKebabCase(input: string): string {
  return input
    .replace(/([a-z])([A-Z])/g, "$1-$2")
    .replace(/[_\s]+/g, "-")
    .toLowerCase();
}

export function textStats(input: string): {
  chars: number;
  charsNoSpace: number;
  words: number;
  lines: number;
  sentences: number;
  paragraphs: number;
  readingTime: string;
} {
  const chars = input.length;
  const charsNoSpace = input.replace(/\s/g, "").length;
  const words = input.trim() ? input.trim().split(/\s+/).length : 0;
  const lines = input ? input.split("\n").length : 0;
  const sentences = (input.match(/[.!?]+(\s|$)/g) || []).length;
  const paragraphs = input.trim() ? input.trim().split(/\n\s*\n/).length : 0;
  const mins = Math.max(1, Math.round(words / 220));
  return { chars, charsNoSpace, words, lines, sentences, paragraphs, readingTime: `${mins} min read` };
}

export function sortLines(input: string, dir: "asc" | "desc" | "shuffle", dedupe: boolean): string {
  let lines = input.split("\n");
  if (dedupe) lines = [...new Set(lines)];
  if (dir === "asc") lines.sort((a, b) => a.localeCompare(b));
  else if (dir === "desc") lines.sort((a, b) => b.localeCompare(a));
  else lines = shuffleArray(lines);
  return lines.join("\n");
}

/* ------------------------------------------------------------------ *
 * Number bases
 * ------------------------------------------------------------------ */
export function convertBase(value: string, from: number): { dec: string; bin: string; oct: string; hex: string } | null {
  const clean = value.trim().replace(/^0x/i, "").replace(/^0b/i, "");
  if (!clean) return null;
  const n = parseInt(clean, from);
  if (Number.isNaN(n)) return null;
  return {
    dec: n.toString(10),
    bin: n.toString(2),
    oct: n.toString(8),
    hex: n.toString(16).toUpperCase(),
  };
}

/* ------------------------------------------------------------------ *
 * Data-size + misc
 * ------------------------------------------------------------------ */
export function prettyBytes(n: number): string {
  if (n === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB", "PB"];
  const i = Math.floor(Math.log(Math.abs(n)) / Math.log(1024));
  return `${(n / Math.pow(1024, i)).toFixed(i ? 2 : 0)} ${units[i]}`;
}

const LOREM_WORDS =
  "lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua enim ad minim veniam quis nostrud exercitation ullamco laboris nisi aliquip ex ea commodo consequat duis aute irure in reprehenderit voluptate velit esse cillum eu fugiat nulla pariatur excepteur sint occaecat cupidatat non proident sunt culpa qui officia deserunt mollit anim id est laborum".split(
    " "
  );

export function loremIpsum(paragraphs: number, sentencesPer = 4): string {
  const rand = (n: number) => Math.floor(Math.random() * n);
  const sentence = () => {
    const len = 6 + rand(8);
    const words = Array.from({ length: len }, () => LOREM_WORDS[rand(LOREM_WORDS.length)]);
    const s = words.join(" ");
    return s.charAt(0).toUpperCase() + s.slice(1) + ".";
  };
  return Array.from({ length: Math.max(1, paragraphs) }, () =>
    Array.from({ length: sentencesPer }, sentence).join(" ")
  ).join("\n\n");
}

/* ------------------------------------------------------------------ *
 * Diff (line-based LCS)
 * ------------------------------------------------------------------ */
export type DiffRow = { type: "same" | "add" | "del"; text: string };

export function lineDiff(a: string, b: string): DiffRow[] {
  const left = a.split("\n");
  const right = b.split("\n");
  const n = left.length;
  const m = right.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--)
      dp[i][j] = left[i] === right[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const rows: DiffRow[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (left[i] === right[j]) {
      rows.push({ type: "same", text: left[i] });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      rows.push({ type: "del", text: left[i++] });
    } else {
      rows.push({ type: "add", text: right[j++] });
    }
  }
  while (i < n) rows.push({ type: "del", text: left[i++] });
  while (j < m) rows.push({ type: "add", text: right[j++] });
  return rows;
}

/* ------------------------------------------------------------------ *
 * Regex
 * ------------------------------------------------------------------ */
export type RegexMatch = { index: number; match: string; groups: string[] };

export function runRegex(
  pattern: string,
  flags: string,
  text: string
): { ok: boolean; matches: RegexMatch[]; error?: string } {
  if (!pattern) return { ok: true, matches: [] };
  try {
    const g = flags.includes("g") ? flags : flags + "g";
    const re = new RegExp(pattern, g);
    const matches: RegexMatch[] = [];
    let m: RegExpExecArray | null;
    let guard = 0;
    while ((m = re.exec(text)) && guard++ < 10000) {
      matches.push({ index: m.index, match: m[0], groups: m.slice(1) });
      if (m.index === re.lastIndex) re.lastIndex++;
    }
    return { ok: true, matches };
  } catch (e) {
    return { ok: false, matches: [], error: e instanceof Error ? e.message : "Invalid pattern" };
  }
}

/* ------------------------------------------------------------------ *
 * Markdown (compact renderer → HTML)
 * ------------------------------------------------------------------ */
export function markdownToHtml(md: string): string {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const inline = (s: string) =>
    esc(s)
      .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img alt="$1" src="$2" />')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/\*([^*]+)\*/g, "<em>$1</em>")
      .replace(/~~([^~]+)~~/g, "<del>$1</del>");

  const lines = md.split("\n");
  const out: string[] = [];
  let inList = false;
  let inCode = false;
  let codeBuf: string[] = [];

  const closeList = () => {
    if (inList) {
      out.push("</ul>");
      inList = false;
    }
  };

  for (const line of lines) {
    if (line.trim().startsWith("```")) {
      if (inCode) {
        out.push(`<pre><code>${esc(codeBuf.join("\n"))}</code></pre>`);
        codeBuf = [];
        inCode = false;
      } else {
        closeList();
        inCode = true;
      }
      continue;
    }
    if (inCode) {
      codeBuf.push(line);
      continue;
    }
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      closeList();
      const level = h[1].length;
      out.push(`<h${level}>${inline(h[2])}</h${level}>`);
      continue;
    }
    if (/^\s*[-*+]\s+/.test(line)) {
      if (!inList) {
        out.push("<ul>");
        inList = true;
      }
      out.push(`<li>${inline(line.replace(/^\s*[-*+]\s+/, ""))}</li>`);
      continue;
    }
    if (/^\s*>\s?/.test(line)) {
      closeList();
      out.push(`<blockquote>${inline(line.replace(/^\s*>\s?/, ""))}</blockquote>`);
      continue;
    }
    if (/^\s*(---|\*\*\*)\s*$/.test(line)) {
      closeList();
      out.push("<hr />");
      continue;
    }
    if (!line.trim()) {
      closeList();
      continue;
    }
    closeList();
    out.push(`<p>${inline(line)}</p>`);
  }
  if (inCode) out.push(`<pre><code>${esc(codeBuf.join("\n"))}</code></pre>`);
  closeList();
  return out.join("\n");
}

/* ------------------------------------------------------------------ *
 * small shared helpers
 * ------------------------------------------------------------------ */
export function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

export function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function estimateEntropyBits(str: string): number {
  let pool = 0;
  if (/[a-z]/.test(str)) pool += 26;
  if (/[A-Z]/.test(str)) pool += 26;
  if (/[0-9]/.test(str)) pool += 10;
  if (/[^a-zA-Z0-9]/.test(str)) pool += 33;
  return Math.round(str.length * Math.log2(pool || 1));
}


/* ==================================================================== *
 * CSV ⇄ JSON
 * ==================================================================== */
function splitCsvRow(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) {
      if (c === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; }
        else q = false;
      } else cur += c;
    } else if (c === '"') q = true;
    else if (c === ",") { out.push(cur); cur = ""; }
    else cur += c;
  }
  out.push(cur);
  return out;
}

export function csvToJson(csv: string, indent = 2): JsonResult {
  const lines = csv.replace(/\r\n/g, "\n").split("\n").filter((l) => l.trim().length);
  if (lines.length < 1) return { ok: true, output: "[]" };
  const header = splitCsvRow(lines[0]).map((h) => h.trim());
  const rows = lines.slice(1).map((line) => {
    const cells = splitCsvRow(line);
    const obj: Record<string, unknown> = {};
    header.forEach((h, i) => {
      const raw = (cells[i] ?? "").trim();
      obj[h] = raw === "" ? "" : raw === "true" ? true : raw === "false" ? false : /^-?\d+(\.\d+)?$/.test(raw) ? Number(raw) : raw;
    });
    return obj;
  });
  return { ok: true, output: JSON.stringify(rows, null, indent) };
}

export function jsonToCsv(json: string): JsonResult {
  try {
    const parsed = JSON.parse(json);
    const arr: Record<string, unknown>[] = Array.isArray(parsed) ? parsed : [parsed];
    if (!arr.length) return { ok: true, output: "" };
    const keys = Array.from(arr.reduce<Set<string>>((set, row) => { Object.keys(row || {}).forEach((k) => set.add(k)); return set; }, new Set()));
    const esc = (v: unknown) => {
      const s = v == null ? "" : typeof v === "object" ? JSON.stringify(v) : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const out = [keys.join(","), ...arr.map((row) => keys.map((k) => esc((row as Record<string, unknown>)[k])).join(","))].join("\n");
    return { ok: true, output: out };
  } catch (e) {
    return { ok: false, output: "", error: e instanceof Error ? e.message : "Invalid JSON" };
  }
}

/* ==================================================================== *
 * JSON → TypeScript interfaces
 * ==================================================================== */
export function jsonToTs(json: string, rootName = "Root"): JsonResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch (e) {
    return { ok: false, output: "", error: e instanceof Error ? e.message : "Invalid JSON" };
  }
  const interfaces: string[] = [];
  const seen = new Set<string>();
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).replace(/[^a-zA-Z0-9]/g, "");
  const typeOf = (v: unknown, name: string): string => {
    if (v === null) return "null";
    if (Array.isArray(v)) {
      if (!v.length) return "unknown[]";
      const inner = typeOf(v[0], name);
      return `${inner}[]`;
    }
    if (typeof v === "object") {
      const iName = cap(name) || "Obj";
      build(v as Record<string, unknown>, iName);
      return iName;
    }
    return typeof v === "number" ? "number" : typeof v === "boolean" ? "boolean" : "string";
  };
  const build = (obj: Record<string, unknown>, name: string) => {
    if (seen.has(name)) return;
    seen.add(name);
    const lines = Object.entries(obj).map(([k, v]) => {
      const key = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(k) ? k : JSON.stringify(k);
      return `  ${key}: ${typeOf(v, k)};`;
    });
    interfaces.push(`interface ${name} {\n${lines.join("\n")}\n}`);
  };
  if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) build(parsed as Record<string, unknown>, cap(rootName));
  else if (Array.isArray(parsed) && parsed[0] && typeof parsed[0] === "object") build(parsed[0] as Record<string, unknown>, cap(rootName));
  else return { ok: false, output: "", error: "Provide a JSON object (or array of objects)." };
  return { ok: true, output: interfaces.reverse().join("\n\n") };
}

/* ==================================================================== *
 * chmod (Unix permissions)
 * ==================================================================== */
export type ChmodBits = { r: boolean; w: boolean; x: boolean };
export type ChmodPerm = { owner: ChmodBits; group: ChmodBits; other: ChmodBits };

export function permToOctal(p: ChmodPerm): string {
  const digit = (b: ChmodBits) => (b.r ? 4 : 0) + (b.w ? 2 : 0) + (b.x ? 1 : 0);
  return `${digit(p.owner)}${digit(p.group)}${digit(p.other)}`;
}
export function permToSymbolic(p: ChmodPerm): string {
  const s = (b: ChmodBits) => `${b.r ? "r" : "-"}${b.w ? "w" : "-"}${b.x ? "x" : "-"}`;
  return `${s(p.owner)}${s(p.group)}${s(p.other)}`;
}
export function octalToPerm(oct: string): ChmodPerm | null {
  const m = oct.trim().match(/([0-7])([0-7])([0-7])$/);
  if (!m) return null;
  const bits = (d: number): ChmodBits => ({ r: !!(d & 4), w: !!(d & 2), x: !!(d & 1) });
  return { owner: bits(+m[1]), group: bits(+m[2]), other: bits(+m[3]) };
}

/* ==================================================================== *
 * Unicode / ASCII inspector
 * ==================================================================== */
export type CharInfo = { char: string; code: number; hex: string; html: string; name: string };
export function inspectChars(input: string): CharInfo[] {
  const out: CharInfo[] = [];
  for (const ch of input) {
    const code = ch.codePointAt(0) ?? 0;
    out.push({
      char: ch,
      code,
      hex: "U+" + code.toString(16).toUpperCase().padStart(4, "0"),
      html: `&#${code};`,
      name: code === 32 ? "SPACE" : code === 10 ? "LINE FEED" : code === 9 ? "TAB" : code < 32 ? "CONTROL" : "",
    });
  }
  return out.slice(0, 500);
}

/* ==================================================================== *
 * String escape / unescape
 * ==================================================================== */
export function escapeString(input: string): string {
  return JSON.stringify(input).slice(1, -1);
}
export function unescapeString(input: string): JsonResult {
  try {
    return { ok: true, output: JSON.parse(`"${input.replace(/"/g, '\\"')}"`) };
  } catch (e) {
    return { ok: false, output: "", error: e instanceof Error ? e.message : "Invalid escape sequence" };
  }
}

/* ==================================================================== *
 * Morse code
 * ==================================================================== */
const MORSE: Record<string, string> = {
  a: ".-", b: "-...", c: "-.-.", d: "-..", e: ".", f: "..-.", g: "--.", h: "....", i: "..", j: ".---",
  k: "-.-", l: ".-..", m: "--", n: "-.", o: "---", p: ".--.", q: "--.-", r: ".-.", s: "...", t: "-",
  u: "..-", v: "...-", w: ".--", x: "-..-", y: "-.--", z: "--..",
  "0": "-----", "1": ".----", "2": "..---", "3": "...--", "4": "....-", "5": ".....",
  "6": "-....", "7": "--...", "8": "---..", "9": "----.",
  ".": ".-.-.-", ",": "--..--", "?": "..--..", "'": ".----.", "!": "-.-.--", "/": "-..-.",
  "(": "-.--.", ")": "-.--.-", "&": ".-...", ":": "---...", ";": "-.-.-.", "=": "-...-",
  "+": ".-.-.", "-": "-....-", '"': ".-..-.", "@": ".--.-.", " ": "/",
};
const MORSE_REV: Record<string, string> = Object.fromEntries(Object.entries(MORSE).map(([k, v]) => [v, k]));
export function textToMorse(input: string): string {
  return input.toLowerCase().split("").map((c) => MORSE[c] ?? "").filter(Boolean).join(" ");
}
export function morseToText(input: string): string {
  return input.trim().split(/\s+/).map((code) => (code === "/" ? " " : MORSE_REV[code] ?? "")).join("");
}

/* ==================================================================== *
 * Binary ⇄ text
 * ==================================================================== */
export function textToBinary(input: string): string {
  return Array.from(new TextEncoder().encode(input)).map((b) => b.toString(2).padStart(8, "0")).join(" ");
}
export function binaryToText(input: string): JsonResult {
  try {
    const bytes = input.trim().split(/\s+/).map((b) => parseInt(b, 2));
    if (bytes.some((b) => Number.isNaN(b) || b > 255)) return { ok: false, output: "", error: "Invalid binary" };
    return { ok: true, output: new TextDecoder().decode(new Uint8Array(bytes)) };
  } catch (e) {
    return { ok: false, output: "", error: e instanceof Error ? e.message : "Invalid binary" };
  }
}

/* ==================================================================== *
 * Roman numerals
 * ==================================================================== */
const ROMAN: [number, string][] = [
  [1000, "M"], [900, "CM"], [500, "D"], [400, "CD"], [100, "C"], [90, "XC"], [50, "L"],
  [40, "XL"], [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"],
];
export function toRoman(n: number): string {
  if (!Number.isFinite(n) || n < 1 || n > 3999) return "";
  let out = "";
  for (const [v, s] of ROMAN) while (n >= v) { out += s; n -= v; }
  return out;
}
export function fromRoman(s: string): number {
  const map: Record<string, number> = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };
  const str = s.toUpperCase().trim();
  let total = 0;
  for (let i = 0; i < str.length; i++) {
    const cur = map[str[i]] ?? 0;
    const next = map[str[i + 1]] ?? 0;
    total += cur < next ? -cur : cur;
  }
  return total;
}

/* ==================================================================== *
 * Unit conversion
 * ==================================================================== */
export type UnitCategory = { id: string; label: string; units: { id: string; label: string; factor: number }[] };
export const UNIT_CATEGORIES: UnitCategory[] = [
  { id: "length", label: "Length", units: [
    { id: "mm", label: "Millimetre", factor: 0.001 }, { id: "cm", label: "Centimetre", factor: 0.01 },
    { id: "m", label: "Metre", factor: 1 }, { id: "km", label: "Kilometre", factor: 1000 },
    { id: "in", label: "Inch", factor: 0.0254 }, { id: "ft", label: "Foot", factor: 0.3048 },
    { id: "yd", label: "Yard", factor: 0.9144 }, { id: "mi", label: "Mile", factor: 1609.344 },
  ] },
  { id: "mass", label: "Mass", units: [
    { id: "mg", label: "Milligram", factor: 0.001 }, { id: "g", label: "Gram", factor: 1 },
    { id: "kg", label: "Kilogram", factor: 1000 }, { id: "t", label: "Tonne", factor: 1e6 },
    { id: "oz", label: "Ounce", factor: 28.3495 }, { id: "lb", label: "Pound", factor: 453.592 },
  ] },
  { id: "data", label: "Data", units: [
    { id: "b", label: "Byte", factor: 1 }, { id: "kb", label: "Kilobyte", factor: 1024 },
    { id: "mb", label: "Megabyte", factor: 1024 ** 2 }, { id: "gb", label: "Gigabyte", factor: 1024 ** 3 },
    { id: "tb", label: "Terabyte", factor: 1024 ** 4 },
  ] },
  { id: "time", label: "Time", units: [
    { id: "ms", label: "Millisecond", factor: 0.001 }, { id: "s", label: "Second", factor: 1 },
    { id: "min", label: "Minute", factor: 60 }, { id: "h", label: "Hour", factor: 3600 },
    { id: "d", label: "Day", factor: 86400 }, { id: "wk", label: "Week", factor: 604800 },
  ] },
];
export function convertUnit(category: string, value: number, from: string, to: string): number | null {
  if (category === "temperature") return convertTemp(value, from, to);
  const cat = UNIT_CATEGORIES.find((c) => c.id === category);
  if (!cat) return null;
  const f = cat.units.find((u) => u.id === from)?.factor;
  const t = cat.units.find((u) => u.id === to)?.factor;
  if (f == null || t == null) return null;
  return (value * f) / t;
}
export function convertTemp(value: number, from: string, to: string): number {
  let c: number;
  if (from === "c") c = value;
  else if (from === "f") c = (value - 32) / 1.8;
  else c = value - 273.15; // kelvin
  if (to === "c") return c;
  if (to === "f") return c * 1.8 + 32;
  return c + 273.15;
}

/* ==================================================================== *
 * Password generator
 * ==================================================================== */
export type PwOptions = { length: number; upper: boolean; lower: boolean; digits: boolean; symbols: boolean; avoidAmbiguous: boolean };
export function generatePassword(o: PwOptions): string {
  let lower = "abcdefghijkmnopqrstuvwxyz";
  let upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  let digits = "23456789";
  const symbols = "!@#$%^&*()-_=+[]{};:,.?";
  if (!o.avoidAmbiguous) { lower = "abcdefghijklmnopqrstuvwxyz"; upper = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"; digits = "0123456789"; }
  let pool = "";
  if (o.lower) pool += lower;
  if (o.upper) pool += upper;
  if (o.digits) pool += digits;
  if (o.symbols) pool += symbols;
  if (!pool) pool = lower;
  const rnd = crypto.getRandomValues(new Uint32Array(o.length));
  let out = "";
  for (let i = 0; i < o.length; i++) out += pool[rnd[i] % pool.length];
  return out;
}


/* ==================================================================== *
 * CRC32 checksum
 * ==================================================================== */
let CRC_TABLE: number[] | null = null;
function crcTable(): number[] {
  if (CRC_TABLE) return CRC_TABLE;
  const t: number[] = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  CRC_TABLE = t;
  return t;
}
export function crc32(input: string): string {
  const t = crcTable();
  const bytes = new TextEncoder().encode(input);
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) crc = t[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  return ((crc ^ 0xffffffff) >>> 0).toString(16).padStart(8, "0");
}

/* ==================================================================== *
 * Base58 (Bitcoin alphabet)
 * ==================================================================== */
const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
export function base58Encode(input: string): string {
  let bytes = Array.from(new TextEncoder().encode(input));
  let zeros = 0;
  while (zeros < bytes.length && bytes[zeros] === 0) zeros++;
  const digits: number[] = [];
  for (let i = zeros; i < bytes.length; i++) {
    let carry = bytes[i];
    for (let j = 0; j < digits.length; j++) { carry += digits[j] << 8; digits[j] = carry % 58; carry = (carry / 58) | 0; }
    while (carry) { digits.push(carry % 58); carry = (carry / 58) | 0; }
  }
  let out = "1".repeat(zeros);
  for (let i = digits.length - 1; i >= 0; i--) out += B58[digits[i]];
  return out || "";
}
export function base58Decode(input: string): JsonResult {
  try {
    const s = input.trim();
    let zeros = 0;
    while (zeros < s.length && s[zeros] === "1") zeros++;
    const bytes: number[] = [];
    for (let i = zeros; i < s.length; i++) {
      const val = B58.indexOf(s[i]);
      if (val < 0) return { ok: false, output: "", error: "Invalid Base58 character" };
      let carry = val;
      for (let j = 0; j < bytes.length; j++) { carry += bytes[j] * 58; bytes[j] = carry & 0xff; carry >>= 8; }
      while (carry) { bytes.push(carry & 0xff); carry >>= 8; }
    }
    const all = new Uint8Array(zeros + bytes.length);
    for (let i = 0; i < bytes.length; i++) all[zeros + bytes.length - 1 - i] = bytes[i];
    return { ok: true, output: new TextDecoder().decode(all) };
  } catch (e) {
    return { ok: false, output: "", error: e instanceof Error ? e.message : "Invalid Base58" };
  }
}

/* ==================================================================== *
 * Classic ciphers
 * ==================================================================== */
export function caesar(input: string, shift: number): string {
  const s = ((shift % 26) + 26) % 26;
  return input.replace(/[a-z]/gi, (c) => {
    const base = c <= "Z" ? 65 : 97;
    return String.fromCharCode(((c.charCodeAt(0) - base + s) % 26) + base);
  });
}
export const rot13 = (input: string) => caesar(input, 13);
export function atbash(input: string): string {
  return input.replace(/[a-z]/gi, (c) => {
    const base = c <= "Z" ? 65 : 97;
    return String.fromCharCode(base + 25 - (c.charCodeAt(0) - base));
  });
}

/* ==================================================================== *
 * Number to words (English, up to quintillions)
 * ==================================================================== */
export function numberToWords(n: number): string {
  if (!Number.isFinite(n)) return "";
  if (n === 0) return "zero";
  const ones = ["", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
  const tens = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];
  const scales = ["", "thousand", "million", "billion", "trillion", "quadrillion", "quintillion"];
  const neg = n < 0;
  let num = Math.abs(Math.trunc(n));
  const chunk = (c: number): string => {
    let s = "";
    if (c >= 100) { s += ones[Math.floor(c / 100)] + " hundred"; c %= 100; if (c) s += " "; }
    if (c >= 20) { s += tens[Math.floor(c / 10)]; c %= 10; if (c) s += "-" + ones[c]; }
    else if (c > 0) s += ones[c];
    return s;
  };
  const parts: string[] = [];
  let scale = 0;
  while (num > 0) {
    const c = num % 1000;
    if (c) parts.unshift(chunk(c) + (scales[scale] ? " " + scales[scale] : ""));
    num = Math.floor(num / 1000);
    scale++;
  }
  return (neg ? "negative " : "") + parts.join(", ");
}

/* ==================================================================== *
 * HTTP status codes reference
 * ==================================================================== */
export const HTTP_STATUS: { code: number; name: string; desc: string }[] = [
  { code: 200, name: "OK", desc: "The request succeeded." },
  { code: 201, name: "Created", desc: "A new resource was created." },
  { code: 204, name: "No Content", desc: "Success with no response body." },
  { code: 301, name: "Moved Permanently", desc: "The resource has a new permanent URL." },
  { code: 302, name: "Found", desc: "Temporary redirect to another URL." },
  { code: 304, name: "Not Modified", desc: "Cached copy is still valid." },
  { code: 400, name: "Bad Request", desc: "The server could not understand the request." },
  { code: 401, name: "Unauthorized", desc: "Authentication is required or failed." },
  { code: 403, name: "Forbidden", desc: "You don't have permission for this resource." },
  { code: 404, name: "Not Found", desc: "The resource could not be found." },
  { code: 405, name: "Method Not Allowed", desc: "The HTTP method isn't supported here." },
  { code: 409, name: "Conflict", desc: "The request conflicts with the current state." },
  { code: 418, name: "I'm a teapot", desc: "The server refuses to brew coffee." },
  { code: 422, name: "Unprocessable Entity", desc: "Validation failed on the request body." },
  { code: 429, name: "Too Many Requests", desc: "You've been rate-limited." },
  { code: 500, name: "Internal Server Error", desc: "A generic server-side failure." },
  { code: 502, name: "Bad Gateway", desc: "Invalid response from an upstream server." },
  { code: 503, name: "Service Unavailable", desc: "The server is overloaded or down." },
  { code: 504, name: "Gateway Timeout", desc: "An upstream server timed out." },
];

/* ==================================================================== *
 * CSS px ⇄ rem, aspect ratio, percentage
 * ==================================================================== */
export function pxToRem(px: number, base = 16): number { return px / base; }
export function remToPx(rem: number, base = 16): number { return rem * base; }

function gcd(a: number, b: number): number { return b === 0 ? a : gcd(b, a % b); }
export function aspectRatio(w: number, h: number): { ratio: string; decimal: number } | null {
  if (!w || !h) return null;
  const g = gcd(Math.round(w), Math.round(h)) || 1;
  return { ratio: `${Math.round(w) / g}:${Math.round(h) / g}`, decimal: +(w / h).toFixed(4) };
}

/* ==================================================================== *
 * JSON ⇄ query string
 * ==================================================================== */
export function jsonToQuery(json: string): JsonResult {
  try {
    const obj = JSON.parse(json);
    const parts: string[] = [];
    for (const [k, v] of Object.entries(obj)) parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(typeof v === "object" ? JSON.stringify(v) : String(v))}`);
    return { ok: true, output: parts.join("&") };
  } catch (e) {
    return { ok: false, output: "", error: e instanceof Error ? e.message : "Invalid JSON" };
  }
}
export function queryToJson(q: string, indent = 2): string {
  const obj: Record<string, string> = {};
  for (const { key, value } of parseQuery(q)) if (key) obj[key] = value;
  return JSON.stringify(obj, null, indent);
}

/* ==================================================================== *
 * Word frequency
 * ==================================================================== */
export function wordFrequency(input: string, top = 25): { word: string; count: number }[] {
  const words = input.toLowerCase().match(/[a-z0-9'\u00c0-\u024f\u0600-\u06ff]+/gi) || [];
  const map = new Map<string, number>();
  for (const w of words) map.set(w, (map.get(w) || 0) + 1);
  return [...map.entries()].map(([word, count]) => ({ word, count })).sort((a, b) => b.count - a.count).slice(0, top);
}

/* ==================================================================== *
 * Mock data generator
 * ==================================================================== */
const FIRST = ["Saleh", "Sara", "Ali", "Maryam", "Reza", "Nadia", "Omid", "Leila", "Kian", "Mina", "Arash", "Yasmin", "Dara", "Roya", "Sina", "Parisa"];
const LAST = ["Saghafiani", "Ahmadi", "Karimi", "Hosseini", "Rezaei", "Moradi", "Jafari", "Nazari", "Sadeghi", "Rahimi"];
const DOMAINS = ["example.com", "mail.io", "proton.me", "saleh.im", "acme.dev"];
export function mockRows(kind: "user" | "email" | "uuid", count: number): string {
  const rnd = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
  const rows: string[] = [];
  for (let i = 0; i < count; i++) {
    const fn = rnd(FIRST), ln = rnd(LAST);
    if (kind === "user") rows.push(`${fn} ${ln}\t${fn.toLowerCase()}.${ln.toLowerCase()}@${rnd(DOMAINS)}\t${18 + Math.floor(Math.random() * 50)}`);
    else if (kind === "email") rows.push(`${fn.toLowerCase()}${Math.floor(Math.random() * 99)}@${rnd(DOMAINS)}`);
    else rows.push(uuidv4());
  }
  return rows.join("\n");
}

/* ==================================================================== *
 * AES-GCM text encryption (passphrase-derived key via PBKDF2)
 * ==================================================================== */
async function deriveAesKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(passphrase), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: 150000, hash: "SHA-256" },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}
export async function aesEncrypt(plaintext: string, passphrase: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveAesKey(passphrase, salt);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(plaintext)));
  const out = new Uint8Array(salt.length + iv.length + ct.length);
  out.set(salt, 0); out.set(iv, salt.length); out.set(ct, salt.length + iv.length);
  let bin = "";
  out.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin);
}
export async function aesDecrypt(payload: string, passphrase: string): Promise<JsonResult> {
  try {
    const bin = atob(payload.trim());
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const salt = bytes.slice(0, 16), iv = bytes.slice(16, 28), ct = bytes.slice(28);
    const key = await deriveAesKey(passphrase, salt);
    const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ct);
    return { ok: true, output: new TextDecoder().decode(pt) };
  } catch {
    return { ok: false, output: "", error: "Wrong passphrase or corrupt data." };
  }
}


/* ==================================================================== *
 * Luhn (credit-card / checksum) validation
 * ==================================================================== */
export function luhnValid(num: string): boolean {
  const digits = num.replace(/\D/g, "");
  if (digits.length < 2) return false;
  let sum = 0;
  let alt = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = digits.charCodeAt(i) - 48;
    if (alt) { d *= 2; if (d > 9) d -= 9; }
    sum += d;
    alt = !alt;
  }
  return sum % 10 === 0;
}
export function cardBrand(num: string): string {
  const n = num.replace(/\D/g, "");
  if (/^4/.test(n)) return "Visa";
  if (/^(5[1-5]|2[2-7])/.test(n)) return "Mastercard";
  if (/^3[47]/.test(n)) return "American Express";
  if (/^6(011|5)/.test(n)) return "Discover";
  if (/^3(0[0-5]|[68])/.test(n)) return "Diners Club";
  if (/^35/.test(n)) return "JCB";
  return "Unknown";
}

/* ==================================================================== *
 * ULID timestamp decoding
 * ==================================================================== */
export function ulidTimestamp(id: string): Date | null {
  const s = id.trim().toUpperCase();
  if (s.length < 10) return null;
  const alphabet = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
  let time = 0;
  for (let i = 0; i < 10; i++) {
    const v = alphabet.indexOf(s[i]);
    if (v < 0) return null;
    time = time * 32 + v;
  }
  return new Date(time);
}

/* ==================================================================== *
 * Duration humaniser + parser
 * ==================================================================== */
export function humanizeDuration(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) return "";
  let s = Math.floor(totalSeconds);
  const units: [number, string][] = [[86400, "d"], [3600, "h"], [60, "m"], [1, "s"]];
  const parts: string[] = [];
  for (const [size, label] of units) {
    if (s >= size) { parts.push(`${Math.floor(s / size)}${label}`); s %= size; }
  }
  return parts.length ? parts.join(" ") : "0s";
}
export function parseDuration(input: string): number {
  let total = 0;
  const re = /(\d+(?:\.\d+)?)\s*(d|h|m|s)/gi;
  let m: RegExpExecArray | null;
  const mult: Record<string, number> = { d: 86400, h: 3600, m: 60, s: 1 };
  while ((m = re.exec(input))) total += parseFloat(m[1]) * mult[m[2].toLowerCase()];
  return total;
}

/* ==================================================================== *
 * JSON path getter (dot / bracket notation)
 * ==================================================================== */
export function jsonGet(json: string, path: string): JsonResult {
  try {
    const obj = JSON.parse(json);
    if (!path.trim()) return { ok: true, output: JSON.stringify(obj, null, 2) };
    const keys = path.replace(/\[(\d+)\]/g, ".$1").replace(/^\$?\.?/, "").split(".").filter(Boolean);
    let cur: unknown = obj;
    for (const k of keys) {
      if (cur == null) return { ok: false, output: "", error: `Path stops at "${k}" (value is null/undefined).` };
      cur = (cur as Record<string, unknown>)[k];
    }
    return { ok: true, output: typeof cur === "object" ? JSON.stringify(cur, null, 2) : String(cur) };
  } catch (e) {
    return { ok: false, output: "", error: e instanceof Error ? e.message : "Invalid JSON" };
  }
}

/* ==================================================================== *
 * Extra case transforms + whitespace cleaner
 * ==================================================================== */
export function toSentenceCase(input: string): string {
  return input.toLowerCase().replace(/(^\s*\w|[.!?]\s+\w)/g, (c) => c.toUpperCase());
}
export function toAlternatingCase(input: string): string {
  let up = false;
  return input.replace(/[a-z]/gi, (c) => { up = !up; return up ? c.toUpperCase() : c.toLowerCase(); });
}
export function invertCase(input: string): string {
  return input.replace(/[a-z]/gi, (c) => (c === c.toUpperCase() ? c.toLowerCase() : c.toUpperCase()));
}
export type WsOptions = { trimLines: boolean; collapseSpaces: boolean; removeBlank: boolean; tabsToSpaces: boolean };
export function cleanWhitespace(input: string, o: WsOptions): string {
  let lines = input.split("\n");
  if (o.tabsToSpaces) lines = lines.map((l) => l.replace(/\t/g, "  "));
  if (o.trimLines) lines = lines.map((l) => l.replace(/\s+$/g, ""));
  if (o.collapseSpaces) lines = lines.map((l) => l.replace(/[ ]{2,}/g, " "));
  if (o.removeBlank) lines = lines.filter((l) => l.trim().length);
  return lines.join("\n");
}

/* ==================================================================== *
 * Markdown table builder (from CSV / tab-separated text)
 * ==================================================================== */
export function markdownTable(input: string): string {
  const rows = input.replace(/\r/g, "").split("\n").filter((l) => l.trim().length).map((l) => (l.includes("\t") ? l.split("\t") : splitCsvRow(l)).map((c) => c.trim()));
  if (!rows.length) return "";
  const cols = Math.max(...rows.map((r) => r.length));
  const pad = (r: string[]) => Array.from({ length: cols }, (_, i) => r[i] ?? "");
  const header = pad(rows[0]);
  const body = rows.slice(1).map(pad);
  const widths = Array.from({ length: cols }, (_, i) => Math.max(3, ...rows.map((r) => (r[i] || "").length)));
  const line = (r: string[]) => "| " + r.map((c, i) => c.padEnd(widths[i])).join(" | ") + " |";
  const sep = "| " + widths.map((w) => "-".repeat(w)).join(" | ") + " |";
  return [line(header), sep, ...body.map(line)].join("\n");
}

/* ==================================================================== *
 * Time-zone converter
 * ==================================================================== */
export const TIMEZONES = [
  "UTC", "America/Los_Angeles", "America/New_York", "America/Sao_Paulo",
  "Europe/London", "Europe/Berlin", "Europe/Moscow", "Asia/Tehran",
  "Asia/Dubai", "Asia/Kolkata", "Asia/Shanghai", "Asia/Tokyo", "Australia/Sydney",
];
export function formatInZone(date: Date, tz: string): string {
  try {
    return new Intl.DateTimeFormat("en-GB", { timeZone: tz, dateStyle: "medium", timeStyle: "medium" }).format(date);
  } catch {
    return "—";
  }
}


/* ==================================================================== *
 * CIDR / subnet calculator
 * ==================================================================== */
export type CidrInfo = { network: string; broadcast: string; firstHost: string; lastHost: string; mask: string; wildcard: string; hosts: number; prefix: number };
export function cidrInfo(input: string): CidrInfo | null {
  const m = input.trim().match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})\/(\d{1,2})$/);
  if (!m) return null;
  const octets = [+m[1], +m[2], +m[3], +m[4]];
  const prefix = +m[5];
  if (octets.some((o) => o > 255) || prefix > 32) return null;
  const ipInt = ((octets[0] << 24) | (octets[1] << 16) | (octets[2] << 8) | octets[3]) >>> 0;
  const maskInt = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
  const network = (ipInt & maskInt) >>> 0;
  const broadcast = (network | (~maskInt >>> 0)) >>> 0;
  const toIp = (n: number) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join(".");
  const hosts = prefix >= 31 ? (prefix === 32 ? 1 : 2) : Math.max(0, broadcast - network - 1);
  return {
    network: toIp(network),
    broadcast: toIp(broadcast),
    firstHost: toIp(prefix >= 31 ? network : network + 1),
    lastHost: toIp(prefix >= 31 ? broadcast : broadcast - 1),
    mask: toIp(maskInt),
    wildcard: toIp(~maskInt >>> 0),
    hosts,
    prefix,
  };
}

/* ==================================================================== *
 * Flesch reading-ease score
 * ==================================================================== */
function countSyllables(word: string): number {
  const w = word.toLowerCase().replace(/[^a-z]/g, "");
  if (w.length <= 3) return 1;
  const groups = w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, "").replace(/^y/, "").match(/[aeiouy]{1,2}/g);
  return Math.max(1, groups ? groups.length : 1);
}
export function readability(text: string): { score: number; grade: string; words: number; sentences: number; syllables: number } {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const sentences = Math.max(1, (text.match(/[.!?]+/g) || []).length);
  const syllables = words.reduce((s, w) => s + countSyllables(w), 0);
  const wc = Math.max(1, words.length);
  const score = Math.round((206.835 - 1.015 * (wc / sentences) - 84.6 * (syllables / wc)) * 10) / 10;
  const grade = score >= 90 ? "Very easy" : score >= 70 ? "Easy" : score >= 60 ? "Plain" : score >= 50 ? "Fairly hard" : score >= 30 ? "Hard" : "Very hard";
  return { score, grade, words: words.length, sentences, syllables };
}

/* ==================================================================== *
 * .env ⇄ JSON
 * ==================================================================== */
export function envToJson(input: string, indent = 2): string {
  const obj: Record<string, string> = {};
  for (const line of input.split("\n")) {
    const l = line.trim();
    if (!l || l.startsWith("#")) continue;
    const eq = l.indexOf("=");
    if (eq < 0) continue;
    const key = l.slice(0, eq).trim();
    let val = l.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
    obj[key] = val;
  }
  return JSON.stringify(obj, null, indent);
}
export function jsonToEnv(json: string): JsonResult {
  try {
    const obj = JSON.parse(json);
    const lines = Object.entries(obj).map(([k, v]) => {
      const val = typeof v === "object" ? JSON.stringify(v) : String(v);
      return `${k}=${/\s|#/.test(val) ? `"${val}"` : val}`;
    });
    return { ok: true, output: lines.join("\n") };
  } catch (e) {
    return { ok: false, output: "", error: e instanceof Error ? e.message : "Invalid JSON" };
  }
}

/* ==================================================================== *
 * cURL → fetch()
 * ==================================================================== */
export function curlToFetch(curl: string): string {
  let s = curl.trim().replace(/\\\r?\n/g, " ").replace(/\s+/g, " ");
  if (!s.toLowerCase().startsWith("curl")) return "// Paste a curl command starting with 'curl'";
  s = s.slice(4).trim();
  const headers: Record<string, string> = {};
  let method = "GET";
  let body = "";
  let url = "";
  const tokens = s.match(/'[^']*'|"[^"]*"|\S+/g) || [];
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i].replace(/^['"]|['"]$/g, "");
    if (t === "-X" || t === "--request") { method = (tokens[++i] || "GET").replace(/^['"]|['"]$/g, ""); }
    else if (t === "-H" || t === "--header") { const h = (tokens[++i] || "").replace(/^['"]|['"]$/g, ""); const ci = h.indexOf(":"); if (ci > 0) headers[h.slice(0, ci).trim()] = h.slice(ci + 1).trim(); }
    else if (t === "-d" || t === "--data" || t === "--data-raw") { body = (tokens[++i] || "").replace(/^['"]|['"]$/g, ""); if (method === "GET") method = "POST"; }
    else if (/^https?:\/\//.test(t)) url = t;
  }
  const opts: string[] = [`  method: "${method}"`];
  if (Object.keys(headers).length) opts.push(`  headers: ${JSON.stringify(headers, null, 2).replace(/\n/g, "\n  ")}`);
  if (body) opts.push(`  body: ${JSON.stringify(body)}`);
  return `fetch(${JSON.stringify(url)}, {\n${opts.join(",\n")}\n})\n  .then((r) => r.json())\n  .then(console.log);`;
}

/* ==================================================================== *
 * ASCII table (printable)
 * ==================================================================== */
export function asciiTable(): { dec: number; hex: string; char: string }[] {
  const out: { dec: number; hex: string; char: string }[] = [];
  for (let i = 32; i <= 126; i++) out.push({ dec: i, hex: i.toString(16).toUpperCase().padStart(2, "0"), char: i === 32 ? "space" : String.fromCharCode(i) });
  return out;
}


/* ==================================================================== *
 * JWT signing (HS256) + colour blending + list ops
 * ==================================================================== */
function b64url(bytes: Uint8Array): string {
  let bin = "";
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
export async function signJwtHS256(payloadJson: string, secret: string): Promise<JsonResult> {
  const enc = new TextEncoder();
  let payloadObj: unknown;
  try {
    payloadObj = JSON.parse(payloadJson);
  } catch (e) {
    return { ok: false, output: "", error: e instanceof Error ? e.message : "Invalid JSON payload" };
  }
  const header = { alg: "HS256", typ: "JWT" };
  const h = b64url(enc.encode(JSON.stringify(header)));
  const p = b64url(enc.encode(JSON.stringify(payloadObj)));
  const data = `${h}.${p}`;
  const key = await crypto.subtle.importKey("raw", enc.encode(secret || "secret"), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(data)));
  return { ok: true, output: `${data}.${b64url(sig)}` };
}

export function blendHex(a: string, b: string, t: number): string | null {
  const A = parseColor(a);
  const B = parseColor(b);
  if (!A || !B) return null;
  const mix = (x: number, y: number) => Math.round(x + (y - x) * t);
  return rgbToHex({ r: mix(A.r, B.r), g: mix(A.g, B.g), b: mix(A.b, B.b) });
}

export function sortNumbers(input: string, dir: "asc" | "desc" | "unique"): string {
  const nums = (input.match(/-?\d+(?:\.\d+)?/g) || []).map(Number);
  let out = nums;
  if (dir === "unique") out = [...new Set(nums)].sort((a, b) => a - b);
  else out = [...nums].sort((a, b) => (dir === "asc" ? a - b : b - a));
  return out.join(", ");
}

export function parseSize(input: string): number {
  const m = input.trim().match(/^([\d.]+)\s*(b|kb|mb|gb|tb|kib|mib|gib|tib)?$/i);
  if (!m) return NaN;
  const n = parseFloat(m[1]);
  const unit = (m[2] || "b").toLowerCase();
  const map: Record<string, number> = { b: 1, kb: 1024, mb: 1024 ** 2, gb: 1024 ** 3, tb: 1024 ** 4, kib: 1024, mib: 1024 ** 2, gib: 1024 ** 3, tib: 1024 ** 4 };
  return n * (map[unit] ?? 1);
}

/* A small, searchable emoji set grouped for the picker tool. */
export const EMOJI_SET: { group: string; items: { e: string; name: string }[] }[] = [
  { group: "Smileys", items: [
    { e: "😀", name: "grinning" }, { e: "😂", name: "joy laugh" }, { e: "😊", name: "smile blush" }, { e: "😍", name: "heart eyes love" },
    { e: "😎", name: "cool sunglasses" }, { e: "🤔", name: "thinking" }, { e: "😴", name: "sleep" }, { e: "🥳", name: "party celebrate" },
    { e: "😭", name: "cry sob" }, { e: "😡", name: "angry mad" }, { e: "🤯", name: "mind blown" }, { e: "🫡", name: "salute" },
  ] },
  { group: "Gestures", items: [
    { e: "👍", name: "thumbs up like" }, { e: "👎", name: "thumbs down" }, { e: "👏", name: "clap" }, { e: "🙏", name: "pray thanks" },
    { e: "💪", name: "muscle strong" }, { e: "🤝", name: "handshake deal" }, { e: "👋", name: "wave hello" }, { e: "✌️", name: "peace" },
  ] },
  { group: "Objects", items: [
    { e: "🔥", name: "fire hot" }, { e: "✨", name: "sparkles" }, { e: "⭐", name: "star" }, { e: "💡", name: "idea bulb" },
    { e: "🚀", name: "rocket launch" }, { e: "🎯", name: "target goal" }, { e: "💯", name: "hundred perfect" }, { e: "⚡", name: "bolt fast" },
    { e: "🔒", name: "lock secure" }, { e: "🛡️", name: "shield" }, { e: "🧩", name: "puzzle" }, { e: "⚙️", name: "gear settings" },
  ] },
  { group: "Symbols", items: [
    { e: "✅", name: "check yes done" }, { e: "❌", name: "cross no" }, { e: "❤️", name: "heart red love" }, { e: "💙", name: "heart blue" },
    { e: "➡️", name: "arrow right" }, { e: "⬅️", name: "arrow left" }, { e: "♻️", name: "recycle" }, { e: "™️", name: "trademark" },
  ] },
];


/* ==================================================================== *
 * Base32 (RFC 4648)
 * ==================================================================== */
const B32A = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
export function base32Encode(input: string): string {
  const bytes = new TextEncoder().encode(input);
  let bits = 0, val = 0, out = "";
  for (const b of bytes) {
    val = (val << 8) | b;
    bits += 8;
    while (bits >= 5) { out += B32A[(val >>> (bits - 5)) & 31]; bits -= 5; }
  }
  if (bits > 0) out += B32A[(val << (5 - bits)) & 31];
  while (out.length % 8) out += "=";
  return out;
}
export function base32Decode(input: string): JsonResult {
  try {
    const s = input.replace(/=+$/, "").toUpperCase().replace(/\s/g, "");
    let bits = 0, val = 0;
    const bytes: number[] = [];
    for (const ch of s) {
      const idx = B32A.indexOf(ch);
      if (idx < 0) return { ok: false, output: "", error: "Invalid Base32 character" };
      val = (val << 5) | idx;
      bits += 5;
      if (bits >= 8) { bytes.push((val >>> (bits - 8)) & 0xff); bits -= 8; }
    }
    return { ok: true, output: new TextDecoder().decode(new Uint8Array(bytes)) };
  } catch (e) {
    return { ok: false, output: "", error: e instanceof Error ? e.message : "Invalid Base32" };
  }
}

/* ==================================================================== *
 * Hex dump
 * ==================================================================== */
export function hexDump(input: string): string {
  const bytes = new TextEncoder().encode(input);
  const lines: string[] = [];
  for (let i = 0; i < bytes.length; i += 16) {
    const slice = bytes.slice(i, i + 16);
    const hex = Array.from(slice).map((b) => b.toString(16).padStart(2, "0")).join(" ").padEnd(47, " ");
    const ascii = Array.from(slice).map((b) => (b >= 32 && b <= 126 ? String.fromCharCode(b) : ".")).join("");
    lines.push(`${i.toString(16).padStart(8, "0")}  ${hex}  |${ascii}|`);
  }
  return lines.join("\n") || "(empty)";
}

/* ==================================================================== *
 * Levenshtein distance / similarity
 * ==================================================================== */
export function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  if (!m) return n;
  if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = a[i - 1] === b[j - 1] ? prev[j - 1] : 1 + Math.min(prev[j], cur[j - 1], prev[j - 1]);
    }
    prev = cur;
  }
  return prev[n];
}
export function similarity(a: string, b: string): number {
  const max = Math.max(a.length, b.length);
  if (!max) return 100;
  return Math.round((1 - levenshtein(a, b) / max) * 1000) / 10;
}

/* ==================================================================== *
 * Password strength analysis
 * ==================================================================== */
export type PwAnalysis = { bits: number; score: number; label: string; checks: { label: string; pass: boolean }[] };
export function analyzePassword(pw: string): PwAnalysis {
  const bits = estimateEntropyBits(pw);
  const checks = [
    { label: "At least 12 characters", pass: pw.length >= 12 },
    { label: "Upper & lower case", pass: /[a-z]/.test(pw) && /[A-Z]/.test(pw) },
    { label: "Contains a number", pass: /\d/.test(pw) },
    { label: "Contains a symbol", pass: /[^a-zA-Z0-9]/.test(pw) },
    { label: "No obvious sequence", pass: !/(012|123|234|345|456|567|678|789|abc|qwerty|password)/i.test(pw) },
    { label: "No repeated runs", pass: !/(.)\1\1/.test(pw) },
  ];
  const score = bits >= 100 ? 4 : bits >= 70 ? 3 : bits >= 45 ? 2 : bits >= 28 ? 1 : 0;
  const label = ["Very weak", "Weak", "Fair", "Strong", "Very strong"][score];
  return { bits, score, label, checks };
}

/* ==================================================================== *
 * IPv4 ⇄ integer
 * ==================================================================== */
export function ipv4ToInt(ip: string): number | null {
  const m = ip.trim().match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return null;
  const o = [1, 2, 3, 4].map((i) => +m[i]);
  if (o.some((x) => x > 255)) return null;
  return ((o[0] << 24) | (o[1] << 16) | (o[2] << 8) | o[3]) >>> 0;
}
export function intToIpv4(n: number): string {
  return [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join(".");
}


/* ==================================================================== *
 * Hex ⇄ Base64, HTML → text, list ⇄ JSON, date diff
 * ==================================================================== */
export function hexToBase64(hex: string): JsonResult {
  const clean = hex.replace(/\s|0x/gi, "");
  if (clean.length % 2 !== 0 || /[^0-9a-f]/i.test(clean)) return { ok: false, output: "", error: "Invalid hex" };
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(clean.substr(i * 2, 2), 16);
  let bin = "";
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return { ok: true, output: btoa(bin) };
}
export function base64ToHex(b64: string): JsonResult {
  try {
    const bin = atob(b64.trim());
    let out = "";
    for (let i = 0; i < bin.length; i++) out += bin.charCodeAt(i).toString(16).padStart(2, "0");
    return { ok: true, output: out };
  } catch {
    return { ok: false, output: "", error: "Invalid Base64" };
  }
}

export function stripHtml(html: string): string {
  return decodeHtml(html.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<[^>]+>/g, "")).replace(/\n{3,}/g, "\n\n").trim();
}

export function linesToJsonArray(text: string, indent = 2): string {
  const arr = text.split("\n").map((l) => l.trim()).filter(Boolean);
  return JSON.stringify(arr, null, indent);
}
export function jsonArrayToLines(json: string): JsonResult {
  try {
    const arr = JSON.parse(json);
    if (!Array.isArray(arr)) return { ok: false, output: "", error: "Expected a JSON array" };
    return { ok: true, output: arr.map((x) => (typeof x === "object" ? JSON.stringify(x) : String(x))).join("\n") };
  } catch (e) {
    return { ok: false, output: "", error: e instanceof Error ? e.message : "Invalid JSON" };
  }
}

export function dateDiff(a: string, b: string): { ok: boolean; text?: string; days?: number; error?: string } {
  const da = Date.parse(a);
  const db = Date.parse(b);
  if (Number.isNaN(da) || Number.isNaN(db)) return { ok: false, error: "Enter two valid dates/times." };
  const diff = Math.abs(db - da);
  return { ok: true, text: humanizeDuration(diff / 1000), days: Math.round((diff / 86400000) * 100) / 100 };
}
