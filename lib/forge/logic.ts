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
