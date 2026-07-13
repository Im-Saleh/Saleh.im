/* ============================================================================
   Probe — signal collection & inference engine.

   This module gathers a wide surface of *genuine* browser signals and folds
   them into two conclusions:

     1. The visitor's most-likely real jurisdiction.
     2. Whether the connection looks like a residential line or a masked /
        datacenter path (i.e. a proxy or tunnel).

   The scoring weights and the individual signals that drive each conclusion
   are intentionally kept out of the UI — the interface presents a confident
   verdict, not the arithmetic behind it. Everything executes locally in the
   browser; nothing is transmitted or stored.
   ========================================================================== */

import type { GeoData } from "@/lib/probe/ip";

/* ---------------------------------------------------------------------------
   Hashing primitives
   ------------------------------------------------------------------------- */

/** Fast non-crypto hash for cheap, stable fingerprints. */
export function djb2(str: string): string {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) >>> 0;
  return h.toString(16).padStart(8, "0");
}

/** FNV-1a — a second independent hash so combined IDs avoid djb2 collisions. */
export function fnv1a(str: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

/** SHA-256 hex via SubtleCrypto, with a deterministic fallback offline. */
export async function sha256Hex(input: string): Promise<string> {
  try {
    const data = new TextEncoder().encode(input);
    const buf = await crypto.subtle.digest("SHA-256", data);
    return Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  } catch {
    return (djb2(input) + fnv1a(input) + djb2(input.split("").reverse().join(""))).padEnd(64, "0").slice(0, 64);
  }
}

/** Short, human-friendly grouping of a long hash (e.g. AB12·CD34·EF56). */
export function groupHash(hex: string, groups = 4, size = 4): string {
  const out: string[] = [];
  for (let i = 0; i < groups; i++) out.push(hex.slice(i * size, i * size + size).toUpperCase());
  return out.join("·");
}

/* ---------------------------------------------------------------------------
   Country metadata
   ------------------------------------------------------------------------- */

export const CC_NAMES: Record<string, { en: string; fa: string }> = {
  IR: { en: "Iran", fa: "ایران" },
  US: { en: "United States", fa: "ایالات متحده" },
  GB: { en: "United Kingdom", fa: "بریتانیا" },
  DE: { en: "Germany", fa: "آلمان" },
  FR: { en: "France", fa: "فرانسه" },
  NL: { en: "Netherlands", fa: "هلند" },
  TR: { en: "Türkiye", fa: "ترکیه" },
  AE: { en: "United Arab Emirates", fa: "امارات" },
  CA: { en: "Canada", fa: "کانادا" },
  RU: { en: "Russia", fa: "روسیه" },
  CN: { en: "China", fa: "چین" },
  IN: { en: "India", fa: "هند" },
  JP: { en: "Japan", fa: "ژاپن" },
  KR: { en: "South Korea", fa: "کره جنوبی" },
  SE: { en: "Sweden", fa: "سوئد" },
  FI: { en: "Finland", fa: "فنلاند" },
  NO: { en: "Norway", fa: "نروژ" },
  DK: { en: "Denmark", fa: "دانمارک" },
  PL: { en: "Poland", fa: "لهستان" },
  IT: { en: "Italy", fa: "ایتالیا" },
  ES: { en: "Spain", fa: "اسپانیا" },
  CH: { en: "Switzerland", fa: "سوئیس" },
  AT: { en: "Austria", fa: "اتریش" },
  BE: { en: "Belgium", fa: "بلژیک" },
  IE: { en: "Ireland", fa: "ایرلند" },
  AU: { en: "Australia", fa: "استرالیا" },
  BR: { en: "Brazil", fa: "برزیل" },
  SG: { en: "Singapore", fa: "سنگاپور" },
  HK: { en: "Hong Kong", fa: "هنگ‌کنگ" },
  UA: { en: "Ukraine", fa: "اوکراین" },
  RO: { en: "Romania", fa: "رومانی" },
  CZ: { en: "Czechia", fa: "چک" },
  QA: { en: "Qatar", fa: "قطر" },
  SA: { en: "Saudi Arabia", fa: "عربستان" },
  IQ: { en: "Iraq", fa: "عراق" },
  AZ: { en: "Azerbaijan", fa: "آذربایجان" },
  AM: { en: "Armenia", fa: "ارمنستان" },
  GE: { en: "Georgia", fa: "گرجستان" },
  PK: { en: "Pakistan", fa: "پاکستان" },
  AF: { en: "Afghanistan", fa: "افغانستان" },
  KW: { en: "Kuwait", fa: "کویت" },
  OM: { en: "Oman", fa: "عمان" },
  BH: { en: "Bahrain", fa: "بحرین" },
};

export function ccName(cc: string | undefined, fa: boolean): string {
  if (!cc) return fa ? "نامشخص" : "Unknown";
  const rec = CC_NAMES[cc.toUpperCase()];
  return rec ? (fa ? rec.fa : rec.en) : cc.toUpperCase();
}

export function ccFlag(cc: string | undefined): string {
  if (!cc || cc.length < 2) return "🏳️";
  try {
    return String.fromCodePoint(
      ...cc.toUpperCase().slice(0, 2).split("").map((c) => 127397 + c.charCodeAt(0))
    );
  } catch {
    return "🏳️";
  }
}

/* ---------------------------------------------------------------------------
   Timezone → country. Timezones are hard to spoof casually and survive most
   consumer VPNs, so this is one of the strongest jurisdiction signals.
   ------------------------------------------------------------------------- */

export const TZ_TO_CC: Record<string, string> = {
  "Asia/Tehran": "IR",
  "Asia/Dubai": "AE",
  "Asia/Qatar": "QA",
  "Asia/Riyadh": "SA",
  "Asia/Baghdad": "IQ",
  "Asia/Kuwait": "KW",
  "Asia/Muscat": "OM",
  "Asia/Bahrain": "BH",
  "Asia/Baku": "AZ",
  "Asia/Yerevan": "AM",
  "Asia/Tbilisi": "GE",
  "Asia/Karachi": "PK",
  "Asia/Kabul": "AF",
  "Asia/Istanbul": "TR",
  "Europe/Istanbul": "TR",
  "Asia/Kolkata": "IN",
  "Asia/Calcutta": "IN",
  "Asia/Shanghai": "CN",
  "Asia/Hong_Kong": "HK",
  "Asia/Singapore": "SG",
  "Asia/Tokyo": "JP",
  "Asia/Seoul": "KR",
  "Europe/London": "GB",
  "Europe/Dublin": "IE",
  "Europe/Berlin": "DE",
  "Europe/Paris": "FR",
  "Europe/Amsterdam": "NL",
  "Europe/Brussels": "BE",
  "Europe/Madrid": "ES",
  "Europe/Rome": "IT",
  "Europe/Zurich": "CH",
  "Europe/Vienna": "AT",
  "Europe/Stockholm": "SE",
  "Europe/Helsinki": "FI",
  "Europe/Oslo": "NO",
  "Europe/Copenhagen": "DK",
  "Europe/Warsaw": "PL",
  "Europe/Prague": "CZ",
  "Europe/Bucharest": "RO",
  "Europe/Kiev": "UA",
  "Europe/Kyiv": "UA",
  "Europe/Moscow": "RU",
  "America/New_York": "US",
  "America/Chicago": "US",
  "America/Denver": "US",
  "America/Los_Angeles": "US",
  "America/Phoenix": "US",
  "America/Toronto": "CA",
  "America/Vancouver": "CA",
  "America/Sao_Paulo": "BR",
  "Australia/Sydney": "AU",
  "Australia/Melbourne": "AU",
};

/* ---------------------------------------------------------------------------
   Keyboard layout. Chromium exposes the physical→logical key mapping via
   navigator.keyboard.getLayoutMap(). Reading a handful of keys reveals the
   layout family, which loosely correlates with a locale/jurisdiction.
   ------------------------------------------------------------------------- */

export type KeyboardInfo = {
  supported: boolean;
  layout: string; // QWERTY | AZERTY | QWERTZ | Persian | Dvorak | Unknown
  region?: string; // rough CC hint
  keys: number;
  sample: string;
};

export async function detectKeyboard(): Promise<KeyboardInfo> {
  const kb = (navigator as any).keyboard;
  if (!kb?.getLayoutMap) {
    return { supported: false, layout: "unknown", keys: 0, sample: "" };
  }
  try {
    const map = await kb.getLayoutMap();
    const g = (code: string) => (map.get(code) || "").toString();
    const q = g("KeyQ");
    const w = g("KeyW");
    const e = g("KeyE");
    const a = g("KeyA");
    const y = g("KeyY");
    const z = g("KeyZ");
    const sample = [q, w, e, "…", a, "…", y, z].join("");

    let layout = "QWERTY";
    let region: string | undefined;

    // AZERTY: physical Q → a, W → z
    if (q === "a" && w === "z") {
      layout = "AZERTY";
      region = "FR";
    }
    // QWERTZ: physical Y → z, Z → y
    else if (y === "z" && z === "y") {
      layout = "QWERTZ";
      region = "DE";
    }
    // Persian / Arabic script keys mapped onto the same physical keys
    else if (/[\u0600-\u06FF]/.test(q + w + e + a)) {
      layout = "Persian/Arabic";
      region = "IR";
    }
    // Dvorak: physical Q → ' or , depending on variant
    else if (q === "'" || (q === "," && w === ".")) {
      layout = "Dvorak";
    } else if (q === "q" && w === "w") {
      layout = "QWERTY";
    } else {
      layout = "Custom";
    }

    return { supported: true, layout, region, keys: map.size ?? 0, sample };
  } catch {
    return { supported: false, layout: "unknown", keys: 0, sample: "" };
  }
}

/* ---------------------------------------------------------------------------
   Device surface + hashes
   ------------------------------------------------------------------------- */

export type DeviceSignals = {
  ua: string;
  platform: string;
  arch: string;
  cores: number;
  memory: number;
  screen: string;
  viewport: string;
  colorDepth: number;
  dpr: number;
  touchPoints: number;
  languages: string[];
  primaryLang: string;
  tz: string;
  tzOffset: number;
  locale: string;
  localeRegion?: string;
  vendor: string;
  gpuVendor?: string;
  gpuRenderer?: string;
  canvasHash?: string;
  audio?: string;
  fonts: string[];
};

/** WebGL vendor/renderer (unmasked when the extension is available). */
function readWebGL(): { vendor?: string; renderer?: string } {
  try {
    const cv = document.createElement("canvas");
    const gl = (cv.getContext("webgl") || cv.getContext("experimental-webgl")) as WebGLRenderingContext | null;
    if (!gl) return {};
    const dbg = gl.getExtension("WEBGL_debug_renderer_info");
    return {
      vendor: dbg ? String(gl.getParameter((dbg as any).UNMASKED_VENDOR_WEBGL)) : String(gl.getParameter(gl.VENDOR)),
      renderer: dbg ? String(gl.getParameter((dbg as any).UNMASKED_RENDERER_WEBGL)) : String(gl.getParameter(gl.RENDERER)),
    };
  } catch {
    return {};
  }
}

function readCanvas(): string | undefined {
  try {
    const cv = document.createElement("canvas");
    cv.width = 280;
    cv.height = 64;
    const ctx = cv.getContext("2d");
    if (!ctx) return undefined;
    ctx.textBaseline = "top";
    ctx.font = "16px 'Arial'";
    ctx.fillStyle = "#f60";
    ctx.fillRect(0, 0, 130, 32);
    ctx.fillStyle = "#069";
    ctx.fillText("Saleh · صالح · 🔒 probe", 2, 15);
    ctx.fillStyle = "rgba(80,200,120,0.72)";
    ctx.fillText("Saleh · صالح · 🔒 probe", 4, 17);
    ctx.beginPath();
    ctx.arc(220, 30, 18, 0, Math.PI * 2);
    ctx.closePath();
    ctx.fillStyle = "rgba(120,90,255,0.5)";
    ctx.fill();
    return djb2(cv.toDataURL());
  } catch {
    return undefined;
  }
}

function readAudio(): string | undefined {
  try {
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    if (!AC) return undefined;
    const ac = new AC();
    const info = `${ac.sampleRate}Hz·${ac.destination.channelCount}ch·${ac.baseLatency ?? 0}`;
    ac.close();
    return info;
  } catch {
    return undefined;
  }
}

/** Font probing via text-metrics comparison against baseline generic families. */
function detectFonts(): string[] {
  const candidates = [
    "Arial", "Helvetica", "Times New Roman", "Courier New", "Georgia", "Verdana",
    "Tahoma", "Segoe UI", "Roboto", "Ubuntu", "Cantarell", "SF Pro Text",
    "Vazirmatn", "IRANSans", "B Nazanin", "Consolas", "Menlo", "Fira Code",
  ];
  const baseFonts = ["monospace", "sans-serif", "serif"];
  const text = "mmmmmmmmmmlli 0123 مقایسه";
  const size = "72px";
  try {
    const span = document.createElement("span");
    span.style.position = "absolute";
    span.style.left = "-9999px";
    span.style.fontSize = size;
    span.textContent = text;
    document.body.appendChild(span);

    const baseline: Record<string, { w: number; h: number }> = {};
    for (const b of baseFonts) {
      span.style.fontFamily = b;
      baseline[b] = { w: span.offsetWidth, h: span.offsetHeight };
    }
    const present: string[] = [];
    for (const font of candidates) {
      let detected = false;
      for (const b of baseFonts) {
        span.style.fontFamily = `'${font}',${b}`;
        if (span.offsetWidth !== baseline[b].w || span.offsetHeight !== baseline[b].h) {
          detected = true;
          break;
        }
      }
      if (detected) present.push(font);
    }
    document.body.removeChild(span);
    return present;
  } catch {
    return [];
  }
}

export function collectDevice(): DeviceSignals {
  const n = navigator as any;
  const uaData = n.userAgentData;
  const langs: string[] = navigator.languages?.slice() || [navigator.language];
  const locale = Intl.DateTimeFormat().resolvedOptions().locale || navigator.language;
  let localeRegion: string | undefined;
  try {
    localeRegion = (new Intl.Locale(locale) as any).region || undefined;
  } catch {
    const m = locale.match(/-([A-Z]{2})/i);
    localeRegion = m ? m[1].toUpperCase() : undefined;
  }
  const gl = readWebGL();
  return {
    ua: navigator.userAgent,
    platform: uaData?.platform || n.platform || "—",
    arch: uaData?.architecture || (/(x86_64|win64|x64)/i.test(navigator.userAgent) ? "x86_64" : /arm|aarch64/i.test(navigator.userAgent) ? "arm64" : "—"),
    cores: n.hardwareConcurrency || 0,
    memory: n.deviceMemory || 0,
    screen: `${screen.width}×${screen.height}`,
    viewport: `${window.innerWidth}×${window.innerHeight}`,
    colorDepth: screen.colorDepth,
    dpr: window.devicePixelRatio,
    touchPoints: n.maxTouchPoints || 0,
    languages: langs,
    primaryLang: navigator.language,
    tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
    tzOffset: -new Date().getTimezoneOffset(),
    locale,
    localeRegion,
    vendor: n.vendor || "—",
    gpuVendor: gl.vendor,
    gpuRenderer: gl.renderer,
    canvasHash: readCanvas(),
    audio: readAudio(),
    fonts: detectFonts(),
  };
}

/** Stable device fingerprint (survives cookie/cache clears). */
export async function deviceHash(d: DeviceSignals): Promise<string> {
  const material = [
    d.platform, d.arch, d.cores, d.memory, d.screen, d.colorDepth, d.dpr,
    d.touchPoints, d.gpuVendor, d.gpuRenderer, d.canvasHash, d.audio,
    d.fonts.join(","), d.tz, d.languages.join(","), d.vendor,
  ].join("|");
  return sha256Hex(material);
}

/* ---------------------------------------------------------------------------
   CPU fingerprint + micro-benchmark. hardwareConcurrency, architecture and a
   deterministic compute signature form a stable-ish CPU class; the timed
   benchmark is bucketed so noise doesn't destabilise the hash.
   ------------------------------------------------------------------------- */

export type CpuProfile = {
  cores: number;
  arch: string;
  benchMs: number;
  bucket: string; // performance tier
  hash: string;
};

export async function profileCpu(d: DeviceSignals): Promise<CpuProfile> {
  // A fixed integer/float workload; identical work each run.
  const t0 = performance.now();
  let acc = 0;
  for (let i = 0; i < 2_000_000; i++) {
    acc += Math.sqrt((i * 1.0001 + 3) % 9973) * ((i & 7) + 1);
    acc = acc % 1e9;
  }
  const benchMs = performance.now() - t0;

  // Coarse tier so the hash stays stable across runs on the same machine.
  const bucket =
    benchMs < 8 ? "S" : benchMs < 16 ? "A" : benchMs < 30 ? "B" : benchMs < 55 ? "C" : "D";

  const hash = (await sha256Hex([d.cores, d.arch, d.memory, bucket, d.platform].join("~"))).slice(0, 24);
  // Keep acc referenced so the loop can't be optimised away.
  if (acc === Number.MAX_SAFE_INTEGER) console.debug(acc);
  return { cores: d.cores, arch: d.arch, benchMs: Math.round(benchMs * 100) / 100, bucket, hash };
}

/* ---------------------------------------------------------------------------
   Connection classification. We never claim certainty — we score how much a
   connection *looks* like it originates from hosting infrastructure rather
   than a consumer line, and fold in provider hints when present.
   ------------------------------------------------------------------------- */

const HOSTING_TOKENS = [
  "amazon", "aws", "ec2", "google", "gcp", "microsoft", "azure", "oracle",
  "digitalocean", "linode", "akamai", "cloudflare", "fastly", "ovh", "hetzner",
  "vultr", "leaseweb", "contabo", "scaleway", "choopa", "psychz", "datacamp",
  "m247", "datacenter", "data center", "hosting", "host", "server", "cloud",
  "colo", "vps", "dedicated", "gcore", "stark", "limestone", "internet-service",
  "quadranet", "packet", "equinix", "telecom italia sparkle", "as-choopa",
];

const RESIDENTIAL_TOKENS = [
  "telecom", "mobile", "cellular", "broadband", "fiber", "dsl", "cable",
  "communication", "wireless", "isp", "net", "telekom", "orange", "vodafone",
  "mci", "mtn", "irancell", "shatel", "asiatech", "respina", "pars online",
  "comcast", "verizon", "at&t", "spectrum", "cox", "bt", "sky", "virgin",
];

export type ConnectionVerdict = {
  kind: "residential" | "datacenter" | "mobile" | "unknown";
  /** 0–100 likelihood the path is masked (VPN/proxy/tunnel). */
  masking: number;
  label: string; // short verdict string set by caller (localised)
};

/**
 * @internal Not surfaced verbatim in the UI.
 */
export function classifyConnection(geo: GeoData, tzMismatch: boolean, webrtcMismatch: boolean): ConnectionVerdict {
  const org = `${geo.org || ""} ${geo.isp || ""} ${geo.asn || ""}`.toLowerCase();
  let hostingScore = 0;
  let residentialScore = 0;

  for (const tok of HOSTING_TOKENS) if (org.includes(tok)) hostingScore += 1;
  for (const tok of RESIDENTIAL_TOKENS) if (org.includes(tok)) residentialScore += 1;

  // Direct provider hints outweigh keyword heuristics.
  if (geo.hostingFlag) hostingScore += 4;
  if (geo.proxyFlag) hostingScore += 5;
  if (geo.mobileFlag) residentialScore += 3;

  let kind: ConnectionVerdict["kind"] = "unknown";
  if (geo.mobileFlag) kind = "mobile";
  else if (hostingScore > residentialScore && hostingScore > 0) kind = "datacenter";
  else if (residentialScore > 0) kind = "residential";

  // Masking likelihood: hosting origin + geographic contradictions.
  let masking = 0;
  if (kind === "datacenter") masking += 55;
  if (geo.proxyFlag) masking += 25;
  if (tzMismatch) masking += 22;
  if (webrtcMismatch) masking += 14;
  if (hostingScore >= 2) masking += 8;
  if (kind === "residential") masking -= 18;
  if (kind === "mobile") masking -= 10;
  masking = Math.max(0, Math.min(100, masking));

  return { kind, masking, label: "" };
}

/* ---------------------------------------------------------------------------
   Real-jurisdiction resolution. Weighted vote across independent signals.
   Weights are tuned so signals that are expensive to fake (timezone, the
   device locale/region) count more than easily-changed ones (IP, keyboard).
   The breakdown is returned for internal use only; callers must not render it.
   ------------------------------------------------------------------------- */

export type CountryScore = {
  cc: string;
  score: number;
};

export type JurisdictionResult = {
  cc?: string;
  confidence: number; // 0–100
  /** @internal ranked candidates — do NOT display the weighting. */
  ranked: CountryScore[];
};

export function resolveJurisdiction(input: {
  ipCc?: string;
  tz?: string;
  languages?: string[];
  localeRegion?: string;
  keyboardRegion?: string;
}): JurisdictionResult {
  const votes: Record<string, number> = {};
  const add = (cc: string | undefined, w: number) => {
    if (!cc) return;
    const key = cc.toUpperCase();
    if (key.length !== 2) return;
    votes[key] = (votes[key] || 0) + w;
  };

  // Timezone → strongest, hardest to fake casually.
  const tzCc = input.tz ? TZ_TO_CC[input.tz] : undefined;
  add(tzCc, 4.2);

  // Locale region (OS/browser regional format).
  add(input.localeRegion, 3.0);

  // Accept-Language regions — each explicit region tag votes.
  for (const l of input.languages || []) {
    const m = l.match(/-([A-Za-z]{2})\b/);
    if (m) add(m[1], 1.6);
    // Language-only tags map to a probable region as a weak nudge.
    else {
      const lang = l.split("-")[0].toLowerCase();
      const guess = LANG_TO_CC[lang];
      add(guess, 0.8);
    }
  }

  // Keyboard layout region — weak but independent.
  add(input.keyboardRegion, 1.1);

  // IP country — informative but the very thing a tunnel changes.
  add(input.ipCc, 2.4);

  const ranked = Object.entries(votes)
    .map(([cc, score]) => ({ cc, score }))
    .sort((a, b) => b.score - a.score);

  const total = ranked.reduce((s, r) => s + r.score, 0) || 1;
  const top = ranked[0];
  const confidence = top ? Math.round((top.score / total) * 100) : 0;

  return { cc: top?.cc, confidence, ranked };
}

const LANG_TO_CC: Record<string, string> = {
  fa: "IR",
  ar: "SA",
  tr: "TR",
  de: "DE",
  fr: "FR",
  nl: "NL",
  es: "ES",
  it: "IT",
  sv: "SE",
  fi: "FI",
  no: "NO",
  nb: "NO",
  da: "DK",
  pl: "PL",
  cs: "CZ",
  ro: "RO",
  ru: "RU",
  uk: "UA",
  zh: "CN",
  ja: "JP",
  ko: "KR",
  hi: "IN",
  pt: "BR",
  ur: "PK",
  az: "AZ",
  hy: "AM",
  ka: "GE",
};
