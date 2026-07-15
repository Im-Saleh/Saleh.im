/* ============================================================================
   Probe — capability & hardware surface collector.

   A broad, live sweep of the platform: display characteristics, input, sensors,
   graphics/media pipelines, platform APIs and JS-engine traits. Every probe is
   defensive (feature-detection only, wrapped) and returns a structured,
   grouped result the UI can render directly. Nothing is stored or transmitted.
   ========================================================================== */

export type Cap = {
  label: string;
  faLabel: string;
  value: string;
  /** true = supported, false = missing, null = purely informational */
  ok: boolean | null;
};

export type CapGroup = {
  key: string;
  title: string;
  faTitle: string;
  icon: string;
  items: Cap[];
};

export type Capabilities = {
  groups: CapGroup[];
  refreshHz: number;
  supportedCount: number;
  totalCount: number;
  uniqueness: number; // 0..100 heuristic — how identifying this surface is
  httpProtocol: string;
  timeSkewMs: number | null;
  gpuAdapter: string;
};

const has = (obj: any, key: string) => {
  try {
    return typeof obj === "object" && obj !== null && key in obj;
  } catch {
    return false;
  }
};

const yn = (b: boolean, val?: string): { value: string; ok: boolean } => ({ value: val ?? (b ? "yes" : "no"), ok: b });

const mm = (q: string): boolean => {
  try {
    return window.matchMedia(q).matches;
  } catch {
    return false;
  }
};

/* --------------------------------------------------------------------------
   Refresh-rate measurement — count animation frames over a short window.
   ------------------------------------------------------------------------ */

export function measureRefreshRate(ms = 420): Promise<number> {
  return new Promise((resolve) => {
    if (typeof requestAnimationFrame === "undefined") return resolve(60);
    let frames = 0;
    const start = performance.now();
    const step = () => {
      frames++;
      const elapsed = performance.now() - start;
      if (elapsed >= ms) {
        const hz = (frames / elapsed) * 1000;
        // snap to the nearest common panel rate
        const common = [24, 30, 48, 50, 60, 72, 75, 90, 100, 120, 144, 165, 240];
        const snapped = common.reduce((a, b) => (Math.abs(b - hz) < Math.abs(a - hz) ? b : a), 60);
        resolve(snapped);
      } else {
        requestAnimationFrame(step);
      }
    };
    requestAnimationFrame(step);
  });
}

/* --------------------------------------------------------------------------
   HTTP protocol + clock-skew (both best-effort)
   ------------------------------------------------------------------------ */

function httpProtocol(): string {
  try {
    const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
    if (nav?.nextHopProtocol) return nav.nextHopProtocol;
    const res = performance.getEntriesByType("resource") as PerformanceResourceTiming[];
    const hit = res.find((r) => r.nextHopProtocol);
    return hit?.nextHopProtocol || "—";
  } catch {
    return "—";
  }
}

async function clockSkew(): Promise<number | null> {
  try {
    const t0 = Date.now();
    const r = await fetch(`/api/ip?_=${Math.random()}`, { cache: "no-store" });
    const t1 = Date.now();
    const dateHeader = r.headers.get("date");
    if (!dateHeader) return null;
    const server = new Date(dateHeader).getTime();
    const local = (t0 + t1) / 2;
    return Math.round(server - local);
  } catch {
    return null;
  }
}

/* --------------------------------------------------------------------------
   WebGPU adapter (async)
   ------------------------------------------------------------------------ */

async function webgpuAdapter(): Promise<string> {
  try {
    const gpu = (navigator as any).gpu;
    if (!gpu?.requestAdapter) return "";
    const adapter = await gpu.requestAdapter();
    if (!adapter) return "present";
    const info = adapter.info || (adapter.requestAdapterInfo ? await adapter.requestAdapterInfo() : null);
    if (info) return [info.vendor, info.architecture].filter(Boolean).join(" ") || "present";
    return "present";
  } catch {
    return "";
  }
}

/* --------------------------------------------------------------------------
   WebGL2 details
   ------------------------------------------------------------------------ */

function webgl2Info(): { supported: boolean; maxTexture: number; extensions: number } {
  try {
    const cv = document.createElement("canvas");
    const gl = cv.getContext("webgl2") as WebGL2RenderingContext | null;
    if (!gl) return { supported: false, maxTexture: 0, extensions: 0 };
    const maxTexture = gl.getParameter(gl.MAX_TEXTURE_SIZE) as number;
    const exts = gl.getSupportedExtensions() || [];
    return { supported: true, maxTexture, extensions: exts.length };
  } catch {
    return { supported: false, maxTexture: 0, extensions: 0 };
  }
}

/* --------------------------------------------------------------------------
   codec support
   ------------------------------------------------------------------------ */

function codecSupport(): { video: [string, boolean][]; audio: [string, boolean][] } {
  const v = document.createElement("video");
  const a = document.createElement("audio");
  const can = (el: HTMLMediaElement, type: string) => {
    try {
      return el.canPlayType(type) !== "";
    } catch {
      return false;
    }
  };
  return {
    video: [
      ["H.264", can(v, 'video/mp4; codecs="avc1.42E01E"')],
      ["VP9", can(v, 'video/webm; codecs="vp9"')],
      ["AV1", can(v, 'video/mp4; codecs="av01.0.05M.08"')],
      ["HEVC", can(v, 'video/mp4; codecs="hev1.1.6.L93.B0"')],
    ],
    audio: [
      ["AAC", can(a, 'audio/mp4; codecs="mp4a.40.2"')],
      ["Opus", can(a, 'audio/webm; codecs="opus"')],
      ["FLAC", can(a, 'audio/flac')],
      ["MP3", can(a, 'audio/mpeg')],
    ],
  };
}

/* --------------------------------------------------------------------------
   JS-engine best-effort guess
   ------------------------------------------------------------------------ */

function engineGuess(): string {
  try {
    const w = window as any;
    if (w.chrome || (navigator as any).userAgentData) return "V8 (Blink)";
    if ("InstallTrigger" in w || "mozInnerScreenX" in w) return "SpiderMonkey (Gecko)";
    if (mm("(-webkit-touch-callout: none)") || /^((?!chrome|android).)*safari/i.test(navigator.userAgent)) return "JavaScriptCore (WebKit)";
    return "unknown";
  } catch {
    return "unknown";
  }
}

/* --------------------------------------------------------------------------
   WebAuthn platform authenticator (async)
   ------------------------------------------------------------------------ */

async function platformAuthenticator(): Promise<boolean> {
  try {
    const pk = (window as any).PublicKeyCredential;
    if (!pk?.isUserVerifyingPlatformAuthenticatorAvailable) return false;
    return await pk.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

async function storagePersisted(): Promise<boolean | null> {
  try {
    const s = (navigator as any).storage;
    if (!s?.persisted) return null;
    return await s.persisted();
  } catch {
    return null;
  }
}

/* --------------------------------------------------------------------------
   MAIN COLLECTOR
   ------------------------------------------------------------------------ */

export async function collectCapabilities(): Promise<Capabilities> {
  const n = navigator as any;
  const w = window as any;

  const [refreshHz, skew, gpuAdapter, webauthn, persisted] = await Promise.all([
    measureRefreshRate(),
    clockSkew(),
    webgpuAdapter(),
    platformAuthenticator(),
    storagePersisted(),
  ]);

  const gl2 = webgl2Info();
  const codecs = codecSupport();
  const gamepads = (() => {
    try {
      return (navigator.getGamepads?.() || []).filter(Boolean).length;
    } catch {
      return 0;
    }
  })();

  const colorGamut = mm("(color-gamut: rec2020)") ? "rec2020" : mm("(color-gamut: p3)") ? "p3" : mm("(color-gamut: srgb)") ? "srgb" : "—";
  const dynamicRange = mm("(dynamic-range: high)") ? "high (HDR)" : mm("(dynamic-range: standard)") ? "standard" : "—";
  const contrast = mm("(prefers-contrast: more)") ? "more" : mm("(prefers-contrast: less)") ? "less" : mm("(prefers-contrast: custom)") ? "custom" : "no-preference";
  const pointer = mm("(pointer: fine)") ? "fine" : mm("(pointer: coarse)") ? "coarse" : "none";
  const orientation = mm("(orientation: portrait)") ? "portrait" : "landscape";

  const speechVoices = (() => {
    try {
      return (window.speechSynthesis?.getVoices?.() || []).length;
    } catch {
      return 0;
    }
  })();

  const groups: CapGroup[] = [
    {
      key: "display",
      title: "Display & rendering",
      faTitle: "نمایش و رندر",
      icon: "◨",
      items: [
        { label: "Refresh rate", faLabel: "نرخِ نوسازی", value: `${refreshHz} Hz`, ok: null },
        { label: "Color gamut", faLabel: "گاماتِ رنگ", value: colorGamut, ok: null },
        { label: "Dynamic range", faLabel: "دامنه‌ی دینامیک", value: dynamicRange, ok: null },
        { label: "Pointer", faLabel: "نشانگر", value: pointer, ok: null },
        { label: "Hover", faLabel: "هاور", value: mm("(hover: hover)") ? "yes" : "no", ok: mm("(hover: hover)") },
        { label: "Forced colors", faLabel: "رنگِ اجباری", value: mm("(forced-colors: active)") ? "active" : "none", ok: null },
        { label: "Inverted colors", faLabel: "رنگِ معکوس", value: mm("(inverted-colors: inverted)") ? "inverted" : "none", ok: null },
        { label: "Prefers contrast", faLabel: "ترجیحِ کنتراست", value: contrast, ok: null },
        { label: "Reduced transparency", faLabel: "شفافیتِ کم", value: mm("(prefers-reduced-transparency: reduce)") ? "reduce" : "no-pref", ok: null },
        { label: "Reduced motion", faLabel: "حرکتِ کم", value: mm("(prefers-reduced-motion: reduce)") ? "reduce" : "no-pref", ok: null },
        { label: "Orientation", faLabel: "جهت", value: orientation, ok: null },
        { label: "Device pixel ratio", faLabel: "نسبتِ پیکسل", value: `${window.devicePixelRatio}x`, ok: null },
      ],
    },
    {
      key: "hardware",
      title: "Hardware & input",
      faTitle: "سخت‌افزار و ورودی",
      icon: "▦",
      items: [
        { label: "Logical cores", faLabel: "هسته‌های منطقی", value: String(n.hardwareConcurrency ?? "—"), ok: null },
        { label: "Device memory", faLabel: "حافظه‌ی دستگاه", value: n.deviceMemory ? `${n.deviceMemory} GB` : "—", ok: null },
        { label: "Max touch points", faLabel: "بیشینه لمس", value: String(n.maxTouchPoints ?? 0), ok: null },
        { label: "Gamepads", faLabel: "دسته‌بازی", value: String(gamepads), ok: null },
        { label: "Vibration", faLabel: "لرزش", value: "vibrate" in navigator ? "yes" : "no", ok: "vibrate" in navigator },
        { label: "Bluetooth", faLabel: "بلوتوث", value: has(navigator, "bluetooth") ? "yes" : "no", ok: has(navigator, "bluetooth") },
        { label: "WebUSB", faLabel: "WebUSB", value: has(navigator, "usb") ? "yes" : "no", ok: has(navigator, "usb") },
        { label: "Web Serial", faLabel: "سریال", value: has(navigator, "serial") ? "yes" : "no", ok: has(navigator, "serial") },
        { label: "WebHID", faLabel: "WebHID", value: has(navigator, "hid") ? "yes" : "no", ok: has(navigator, "hid") },
        { label: "Battery API", faLabel: "API باتری", value: "getBattery" in navigator ? "yes" : "no", ok: "getBattery" in navigator },
        { label: "Wake Lock", faLabel: "قفلِ بیداری", value: has(navigator, "wakeLock") ? "yes" : "no", ok: has(navigator, "wakeLock") },
        { label: "Idle Detection", faLabel: "تشخیصِ بیکاری", value: "IdleDetector" in w ? "yes" : "no", ok: "IdleDetector" in w },
        { label: "Motion sensors", faLabel: "حسگرِ حرکت", value: "DeviceMotionEvent" in w ? "yes" : "no", ok: "DeviceMotionEvent" in w },
      ],
    },
    {
      key: "graphics",
      title: "Graphics & media",
      faTitle: "گرافیک و رسانه",
      icon: "◐",
      items: [
        { label: "WebGL 2", faLabel: "WebGL 2", value: gl2.supported ? "yes" : "no", ok: gl2.supported },
        { label: "Max texture size", faLabel: "بیشینه بافت", value: gl2.maxTexture ? `${gl2.maxTexture}px` : "—", ok: null },
        { label: "WebGL extensions", faLabel: "افزونه‌های WebGL", value: String(gl2.extensions), ok: null },
        { label: "WebGPU", faLabel: "WebGPU", value: gpuAdapter || "no", ok: !!gpuAdapter },
        ...codecs.video.map(([name, ok]) => ({ label: `Video ${name}`, faLabel: `ویدیو ${name}`, value: ok ? "yes" : "no", ok })),
        ...codecs.audio.map(([name, ok]) => ({ label: `Audio ${name}`, faLabel: `صوت ${name}`, value: ok ? "yes" : "no", ok })),
        { label: "MediaCapabilities", faLabel: "MediaCapabilities", value: has(navigator, "mediaCapabilities") ? "yes" : "no", ok: has(navigator, "mediaCapabilities") },
        { label: "Speech voices", faLabel: "صداهای گفتار", value: String(speechVoices), ok: null },
        { label: "Media Session", faLabel: "Media Session", value: has(navigator, "mediaSession") ? "yes" : "no", ok: has(navigator, "mediaSession") },
      ],
    },
    {
      key: "platform",
      title: "Platform APIs",
      faTitle: "APIهای پلتفرم",
      icon: "▤",
      items: [
        { label: "Service Worker", faLabel: "Service Worker", value: "serviceWorker" in navigator ? "yes" : "no", ok: "serviceWorker" in navigator },
        { label: "IndexedDB", faLabel: "IndexedDB", value: "indexedDB" in w ? "yes" : "no", ok: "indexedDB" in w },
        { label: "Cache Storage", faLabel: "Cache Storage", value: "caches" in w ? "yes" : "no", ok: "caches" in w },
        { label: "Persistent storage", faLabel: "ذخیره‌ی ماندگار", value: persisted == null ? "n/a" : persisted ? "granted" : "best-effort", ok: persisted },
        { label: "WebAuthn platform", faLabel: "WebAuthn پلتفرم", value: webauthn ? "available" : "no", ok: webauthn },
        { label: "Credential Mgmt", faLabel: "مدیریتِ اعتبار", value: has(navigator, "credentials") ? "yes" : "no", ok: has(navigator, "credentials") },
        { label: "Payment Request", faLabel: "درخواستِ پرداخت", value: "PaymentRequest" in w ? "yes" : "no", ok: "PaymentRequest" in w },
        { label: "Web Share", faLabel: "اشتراک‌گذاری", value: "share" in navigator ? "yes" : "no", ok: "share" in navigator },
        { label: "File System Access", faLabel: "دسترسی به فایل", value: "showOpenFilePicker" in w ? "yes" : "no", ok: "showOpenFilePicker" in w },
        { label: "Clipboard API", faLabel: "کلیپ‌بورد", value: has(navigator, "clipboard") ? "yes" : "no", ok: has(navigator, "clipboard") },
        { label: "Notifications", faLabel: "اعلان‌ها", value: "Notification" in w ? (w.Notification.permission || "default") : "no", ok: "Notification" in w },
        { label: "Push API", faLabel: "Push API", value: "PushManager" in w ? "yes" : "no", ok: "PushManager" in w },
      ],
    },
    {
      key: "runtime",
      title: "Runtime & privacy",
      faTitle: "رانتایم و حریمِ خصوصی",
      icon: "◈",
      items: [
        { label: "JS engine", faLabel: "موتورِ JS", value: engineGuess(), ok: null },
        { label: "WebAssembly", faLabel: "WebAssembly", value: "WebAssembly" in w ? "yes" : "no", ok: "WebAssembly" in w },
        { label: "SharedArrayBuffer", faLabel: "SharedArrayBuffer", value: "SharedArrayBuffer" in w ? "yes" : "no", ok: "SharedArrayBuffer" in w },
        { label: "Atomics", faLabel: "Atomics", value: "Atomics" in w ? "yes" : "no", ok: "Atomics" in w },
        { label: "BigInt", faLabel: "BigInt", value: "BigInt" in w ? "yes" : "no", ok: "BigInt" in w },
        { label: "Cross-origin isolated", faLabel: "ایزوله‌ی cross-origin", value: w.crossOriginIsolated ? "yes" : "no", ok: !!w.crossOriginIsolated },
        { label: "Secure context", faLabel: "زمینه‌ی امن", value: w.isSecureContext ? "yes" : "no", ok: !!w.isSecureContext },
        { label: "Cookies enabled", faLabel: "کوکی فعال", value: navigator.cookieEnabled ? "yes" : "no", ok: navigator.cookieEnabled },
        { label: "Global Privacy Control", faLabel: "GPC", value: (navigator as any).globalPrivacyControl ? "on" : "off", ok: null },
        { label: "Do Not Track", faLabel: "DNT", value: n.doNotTrack === "1" || n.doNotTrack === "yes" ? "on" : "off", ok: null },
        { label: "Online", faLabel: "آنلاین", value: navigator.onLine ? "yes" : "no", ok: navigator.onLine },
        { label: "PDF viewer", faLabel: "نمایشگرِ PDF", value: (navigator as any).pdfViewerEnabled ? "yes" : "no", ok: null },
      ],
    },
  ];

  let supported = 0;
  let total = 0;
  for (const g of groups)
    for (const it of g.items) {
      if (it.ok === true) supported++;
      if (it.ok !== null) total++;
    }

  // uniqueness heuristic: rarer capabilities + high-precision display metrics
  // make a browser more identifiable.
  let uniq = 40;
  if (colorGamut === "p3" || colorGamut === "rec2020") uniq += 8;
  if (dynamicRange.startsWith("high")) uniq += 6;
  if (refreshHz > 60) uniq += 8;
  if (window.devicePixelRatio % 1 !== 0) uniq += 6;
  if (gpuAdapter) uniq += 6;
  if (gl2.maxTexture > 16384) uniq += 5;
  if (speechVoices > 0) uniq += Math.min(10, speechVoices / 5);
  if ((n.deviceMemory || 0) >= 8) uniq += 4;
  uniq = Math.max(0, Math.min(100, Math.round(uniq)));

  return {
    groups,
    refreshHz,
    supportedCount: supported,
    totalCount: total,
    uniqueness: uniq,
    httpProtocol: httpProtocol(),
    timeSkewMs: skew,
    gpuAdapter,
  };
}
