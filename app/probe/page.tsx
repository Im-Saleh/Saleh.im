"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useLang } from "@/components/lang-provider";
import { useThemeScene } from "@/components/theme-provider";
import { LangToggle } from "@/components/lang-toggle";
import { BASE_PATH } from "@/lib/data";

/* ============================================================================
   Probe — a real connection & privacy inspector. Every check runs live in the
   browser using genuine Web APIs: IP/geo (edge fn), WebRTC candidate gathering,
   Network Information, real latency + bandwidth probes, canvas/WebGL/audio
   fingerprinting, Permissions API, media devices, storage & battery.
   Nothing is stored or sent anywhere.
   ========================================================================== */

type IpInfo = { ip?: string; city?: string; region?: string; country?: string; cc?: string; isp?: string; asn?: string; tz?: string; source?: string };
type Cand = { ip: string; type: string; mdns: boolean };
type Ping = { host: string; label: string; ms: number | null; hist: number[] };
type Tab = "network" | "fingerprint" | "performance" | "permissions";

function djb2(str: string): string {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) >>> 0;
  return h.toString(16).padStart(8, "0");
}

export default function ProbePage() {
  const { lang } = useLang();
  const { toggleMode } = useThemeScene();
  const fa = lang === "fa";

  const [tab, setTab] = useState<Tab>("network");
  const [ip, setIp] = useState<IpInfo | null>(null);
  const [cands, setCands] = useState<Cand[]>([]);
  const [gathering, setGathering] = useState(true);
  const [net, setNet] = useState<{ type?: string; downlink?: number; rtt?: number; save?: boolean } | null>(null);
  const [pings, setPings] = useState<Ping[]>([
    { host: "https://www.cloudflare.com/favicon.ico", label: "Cloudflare", ms: null, hist: [] },
    { host: "https://www.google.com/favicon.ico", label: "Google", ms: null, hist: [] },
    { host: "https://github.githubassets.com/favicons/favicon.svg", label: "GitHub", ms: null, hist: [] },
    { host: "https://cdn.jsdelivr.net/favicon.ico", label: "jsDelivr", ms: null, hist: [] },
  ]);
  const [tick, setTick] = useState(0);
  const [dev, setDev] = useState<Record<string, string>>({});
  const [fp, setFp] = useState<{ canvas?: string; webglVendor?: string; webglRenderer?: string; audio?: string; combined?: string }>({});
  const [perms, setPerms] = useState<Record<string, string>>({});
  const [devices, setDevices] = useState<{ cam: number; mic: number; spk: number }>({ cam: 0, mic: 0, spk: 0 });
  const [storage, setStorage] = useState<{ usage: number; quota: number } | null>(null);
  const [battery, setBattery] = useState<{ level: number; charging: boolean } | null>(null);
  const [speed, setSpeed] = useState<{ mbps: number | null; running: boolean }>({ mbps: null, running: false });
  const [geo, setGeo] = useState<{ lat: number; lon: number; acc: number } | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);

  /* ---- public IP + geo ---- */
  useEffect(() => {
    let alive = true;
    (async () => {
      let d: any = null;
      try { const r = await fetch(`${BASE_PATH}/api/ip`, { cache: "no-store" }); if (r.ok) d = await r.json(); } catch {}
      if (!d || !d.ip) {
        try { const r = await fetch("https://ipwho.is/", { cache: "no-store" }); const j = await r.json(); d = { ip: j.ip, city: j.city, region: j.region, country: j.country, countryCode: j.country_code, isp: j.connection?.isp, asn: j.connection?.asn ? `AS${j.connection.asn}` : undefined, timezone: j.timezone?.id, source: "ipwho.is" }; } catch {}
      }
      if (alive && d) setIp({ ip: d.ip, city: d.city, region: d.region, country: d.country, cc: d.countryCode || d.cc, isp: d.isp, asn: d.asn, tz: d.timezone || d.tz, source: d.source || "saleh.im/api" });
    })();
    return () => { alive = false; };
  }, []);

  /* ---- WebRTC candidates ---- */
  const gather = useCallback(() => {
    setCands([]); setGathering(true);
    try {
      const pc = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });
      pcRef.current = pc;
      pc.createDataChannel("probe");
      const seen = new Set<string>();
      pc.onicecandidate = (e) => {
        if (!e.candidate) { setGathering(false); pc.close(); return; }
        const c = e.candidate.candidate;
        const m = c.match(/([0-9]{1,3}(?:\.[0-9]{1,3}){3})|([a-fA-F0-9]{0,4}(?::[a-fA-F0-9]{0,4}){2,7})|([0-9a-f-]+\.local)/);
        const raw = m?.[0];
        if (!raw) return;
        const type = c.includes("typ host") ? "host" : c.includes("typ srflx") ? "srflx" : c.includes("typ relay") ? "relay" : "?";
        const key = raw + type;
        if (seen.has(key)) return;
        seen.add(key);
        setCands((p) => [...p, { ip: raw, type, mdns: raw.endsWith(".local") }]);
      };
      pc.createOffer().then((o) => pc.setLocalDescription(o)).catch(() => setGathering(false));
      setTimeout(() => { setGathering(false); try { pc.close(); } catch {} }, 4000);
    } catch { setGathering(false); }
  }, []);
  useEffect(() => { gather(); return () => { try { pcRef.current?.close(); } catch {} }; }, [gather, tick]);

  /* ---- Network Information ---- */
  useEffect(() => {
    const c = (navigator as any).connection;
    if (c) { const read = () => setNet({ type: c.effectiveType, downlink: c.downlink, rtt: c.rtt, save: c.saveData }); read(); c.addEventListener?.("change", read); return () => c.removeEventListener?.("change", read); }
  }, []);

  /* ---- latency probes (with rolling history) ---- */
  const runPings = useCallback(async () => {
    const measure = async (url: string) => {
      let best = Infinity;
      for (let i = 0; i < 2; i++) { const t = performance.now(); try { await fetch(url + "?_=" + Math.random(), { mode: "no-cors", cache: "no-store" }); best = Math.min(best, performance.now() - t); } catch {} }
      return best === Infinity ? null : Math.round(best);
    };
    const results = await Promise.all(pings.map((p) => measure(p.host)));
    setPings((prev) => prev.map((p, i) => ({ ...p, ms: results[i], hist: [...p.hist, results[i] ?? 0].slice(-20) })));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { runPings(); const id = setInterval(runPings, 5000); return () => clearInterval(id); }, [tick]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ---- device surface ---- */
  useEffect(() => {
    const n = navigator as any;
    setDev({
      platform: n.userAgentData?.platform || n.platform || "—",
      cores: String(n.hardwareConcurrency ?? "—"),
      memory: n.deviceMemory ? `${n.deviceMemory} GB` : "—",
      screen: `${window.screen.width}×${window.screen.height} @${window.devicePixelRatio}x`,
      viewport: `${window.innerWidth}×${window.innerHeight}`,
      colorDepth: `${window.screen.colorDepth}-bit`,
      lang: navigator.languages?.join(", ") || navigator.language,
      tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
      touch: "ontouchstart" in window ? `${(navigator as any).maxTouchPoints || 0} pts` : (fa ? "خیر" : "no"),
      dnt: n.doNotTrack === "1" || n.doNotTrack === "yes" ? (fa ? "روشن" : "on") : (fa ? "خاموش" : "off"),
      cookies: navigator.cookieEnabled ? (fa ? "فعال" : "enabled") : (fa ? "غیرفعال" : "disabled"),
      scheme: window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light",
      motion: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "reduced" : "no-pref",
    });
  }, [fa]);

  /* ---- fingerprint: canvas + WebGL + audio ---- */
  useEffect(() => {
    const out: typeof fp = {};
    try {
      const cv = document.createElement("canvas"); cv.width = 260; cv.height = 60;
      const ctx = cv.getContext("2d");
      if (ctx) {
        ctx.textBaseline = "top"; ctx.font = "16px 'Arial'"; ctx.fillStyle = "#f60"; ctx.fillRect(0, 0, 120, 30);
        ctx.fillStyle = "#069"; ctx.fillText("Saleh · صالح · 🔒 Probe", 2, 15);
        ctx.fillStyle = "rgba(80,200,120,0.7)"; ctx.fillText("Saleh · صالح · 🔒 Probe", 4, 17);
        out.canvas = djb2(cv.toDataURL());
      }
    } catch {}
    try {
      const cv = document.createElement("canvas");
      const gl = (cv.getContext("webgl") || cv.getContext("experimental-webgl")) as WebGLRenderingContext | null;
      if (gl) {
        const dbg = gl.getExtension("WEBGL_debug_renderer_info");
        out.webglVendor = dbg ? String(gl.getParameter((dbg as any).UNMASKED_VENDOR_WEBGL)) : String(gl.getParameter(gl.VENDOR));
        out.webglRenderer = dbg ? String(gl.getParameter((dbg as any).UNMASKED_RENDERER_WEBGL)) : String(gl.getParameter(gl.RENDERER));
      }
    } catch {}
    try {
      const AC = (window.AudioContext || (window as any).webkitAudioContext);
      if (AC) { const ac = new AC(); out.audio = `${ac.sampleRate}Hz · ${ac.destination.channelCount}ch`; ac.close(); }
    } catch {}
    out.combined = djb2([out.canvas, out.webglRenderer, out.audio, navigator.userAgent, dev.tz, dev.lang].join("|"));
    setFp(out);
  }, [dev.tz, dev.lang]);

  /* ---- permissions ---- */
  useEffect(() => {
    const names = ["geolocation", "camera", "microphone", "notifications", "clipboard-read", "persistent-storage"];
    (async () => {
      const p: Record<string, string> = {};
      for (const name of names) {
        try { const r = await (navigator.permissions as any).query({ name }); p[name] = r.state; } catch { p[name] = "n/a"; }
      }
      setPerms(p);
    })();
    navigator.mediaDevices?.enumerateDevices?.().then((list) => {
      setDevices({ cam: list.filter((d) => d.kind === "videoinput").length, mic: list.filter((d) => d.kind === "audioinput").length, spk: list.filter((d) => d.kind === "audiooutput").length });
    }).catch(() => {});
    (navigator as any).storage?.estimate?.().then((e: any) => setStorage({ usage: e.usage || 0, quota: e.quota || 0 })).catch(() => {});
    (navigator as any).getBattery?.().then((b: any) => { const read = () => setBattery({ level: b.level, charging: b.charging }); read(); b.addEventListener("levelchange", read); b.addEventListener("chargingchange", read); }).catch(() => {});
  }, [tick]);

  const runSpeed = async () => {
    setSpeed({ mbps: null, running: true });
    try {
      const bytes = 5_000_000;
      const t = performance.now();
      const r = await fetch(`https://speed.cloudflare.com/__down?bytes=${bytes}`, { cache: "no-store" });
      await r.arrayBuffer();
      const secs = (performance.now() - t) / 1000;
      setSpeed({ mbps: (bytes * 8) / secs / 1e6, running: false });
    } catch { setSpeed({ mbps: null, running: false }); }
  };

  const askGeo = () => {
    navigator.geolocation?.getCurrentPosition(
      (p) => setGeo({ lat: p.coords.latitude, lon: p.coords.longitude, acc: p.coords.accuracy }),
      () => {},
      { enableHighAccuracy: false, timeout: 8000 }
    );
  };

  const publicLeak = cands.some((c) => c.type === "srflx");
  const localLeak = cands.some((c) => c.type === "host" && !c.mdns);
  const score = Math.max(0, 100 - (localLeak ? 30 : 0) - (dev.dnt === "off" || dev.dnt === "خاموش" ? 12 : 0) - (publicLeak ? 8 : 0) - (perms.geolocation === "granted" ? 8 : 0));
  const scoreColor = score >= 80 ? "#22c55e" : score >= 55 ? "#eab308" : "#ef4444";
  const flag = ip?.cc ? String.fromCodePoint(...ip.cc.toUpperCase().slice(0, 2).split("").map((c) => 127397 + c.charCodeAt(0))) : "";

  const T = fa
    ? { title: "Probe", sub: "بازرسِ اتصال و حریم خصوصی", scan: "اسکن دوباره", scoreL: "امتیازِ حریم خصوصی",
        tabs: { network: "شبکه", fingerprint: "اثرانگشت", performance: "کارایی", permissions: "مجوزها" },
        conn: "اتصالِ شما", ip: "آی‌پی عمومی", loc: "موقعیت", isp: "ارائه‌دهنده", asn: "ASN", tz: "منطقه‌ی زمانی", src: "منبع",
        netTitle: "شبکه", type: "نوعِ اتصال", down: "پهنای باند", rtt: "تأخیرِ تخمینی", save: "کم‌مصرف", na: "در دسترس نیست (Chromium)",
        webrtc: "کاندیداهای WebRTC", gathering: "در حال جمع‌آوری…", host: "محلی", mdns: "محافظت‌شده mDNS", none: "کاندیدایی نیست",
        latency: "تأخیر تا سرورها", device: "دستگاه و مرورگر", note: "همه‌ی بررسی‌ها واقعی و کاملاً در مرورگرِ توست — هیچ‌چیز ذخیره یا ارسال نمی‌شود.",
        leakY: "آی‌پیِ محلی افشا شد", leakN: "آی‌پیِ محلی افشا نشد", canvas: "اثرانگشتِ کانواس", webglV: "سازنده‌ی GPU", webglR: "رندرِ GPU", audio: "صوت", combined: "اثرانگشتِ ترکیبی",
        fpNote: "این مقادیر یکتا هستند و می‌توانند مرورگرِ تو را بدونِ کوکی ردیابی کنند.", speed: "تستِ سرعتِ دانلود", runSpeed: "اجرای تست", mbps: "مگابیت/ثانیه",
        mem: "حافظه‌ی JS", perms: "مجوزها", mediaDev: "دستگاه‌های رسانه", cam: "دوربین", mic: "میکروفون", spk: "بلندگو",
        storageL: "فضای ذخیره‌سازی", used: "استفاده‌شده", quota: "سهمیه", batteryL: "باتری", charging: "در حال شارژ", geoBtn: "درخواستِ موقعیتِ دقیق", geoAcc: "دقت", latOverTime: "تأخیر در طول زمان" }
    : { title: "Probe", sub: "Connection & privacy inspector", scan: "Re-scan", scoreL: "Privacy score",
        tabs: { network: "Network", fingerprint: "Fingerprint", performance: "Performance", permissions: "Permissions" },
        conn: "Your connection", ip: "Public IP", loc: "Location", isp: "ISP", asn: "ASN", tz: "Timezone", src: "Source",
        netTitle: "Network", type: "Connection type", down: "Downlink", rtt: "Estimated RTT", save: "Data saver", na: "Not available (Chromium)",
        webrtc: "WebRTC candidates", gathering: "gathering…", host: "local", mdns: "mDNS-protected", none: "No candidates",
        latency: "Latency to endpoints", device: "Device & browser", note: "Every check runs live, entirely in your browser — nothing is stored or sent.",
        leakY: "Local IP exposed", leakN: "Local IP not exposed", canvas: "Canvas fingerprint", webglV: "GPU vendor", webglR: "GPU renderer", audio: "Audio", combined: "Combined fingerprint",
        fpNote: "These values are unique and can track your browser without cookies.", speed: "Download speed test", runSpeed: "Run test", mbps: "Mbps",
        mem: "JS heap", perms: "Permissions", mediaDev: "Media devices", cam: "Cameras", mic: "Microphones", spk: "Speakers",
        storageL: "Storage", used: "Used", quota: "Quota", batteryL: "Battery", charging: "charging", geoBtn: "Request precise location", geoAcc: "accuracy", latOverTime: "Latency over time" };

  const mb = (n: number) => (n < 1048576 ? `${(n / 1024).toFixed(0)} KB` : `${(n / 1048576).toFixed(1)} MB`);
  const jsHeap = (performance as any).memory ? `${mb((performance as any).memory.usedJSHeapSize)} / ${mb((performance as any).memory.jsHeapSizeLimit)}` : "—";

  const MiniLine = ({ data }: { data: number[] }) => {
    if (data.length < 2) return <span className="mono text-xs text-[var(--fg-2)]">…</span>;
    const max = Math.max(...data, 1), min = Math.min(...data);
    const pts = data.map((v, i) => `${(i / (data.length - 1)) * 100},${20 - ((v - min) / (max - min || 1)) * 18 - 1}`).join(" ");
    return <svg viewBox="0 0 100 20" preserveAspectRatio="none" className="h-5 w-20"><polyline points={pts} fill="none" stroke="var(--accent)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" /></svg>;
  };

  return (
    <div className="min-h-[100dvh]">
      <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b px-4 py-3 backdrop-blur-xl sm:px-6" style={{ borderColor: "var(--line)", background: "color-mix(in srgb, var(--bg) 80%, transparent)" }}>
        <div className="flex items-center gap-3">
          <Link href="/" className="mono text-sm text-[var(--fg-2)] hover:text-[var(--fg)]">← saleh.im</Link>
          <span className="hidden items-center gap-2 sm:flex"><span className="grid h-7 w-7 place-items-center rounded-lg text-sm" style={{ background: "var(--accent)", color: "var(--on-accent)" }}>◉</span><span className="font-display text-lg">{T.title}</span><span className="text-xs text-[var(--fg-2)]">{T.sub}</span></span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setTick((t) => t + 1)} className="flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs" style={{ borderColor: "var(--line-2)" }}>↻ {T.scan}</button>
          <button onClick={toggleMode} className="grid h-9 w-9 place-items-center rounded-full border" style={{ borderColor: "var(--line-2)" }}>◑</button>
          <LangToggle />
        </div>
      </header>

      <main className="wrap py-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h1 className="font-display text-2xl sm:text-3xl">{T.title}</h1>
          <div className="flex items-center gap-3 rounded-full border px-4 py-2" style={{ borderColor: "var(--line-2)" }}>
            <span className="label">{T.scoreL}</span>
            <span className="font-display text-2xl" style={{ color: scoreColor }}>{fa ? score.toLocaleString("fa-IR") : score}</span>
            <span className="h-8 w-px" style={{ background: "var(--line)" }} />
            <svg viewBox="0 0 36 36" className="h-8 w-8 -rotate-90"><circle cx="18" cy="18" r="15" fill="none" stroke="var(--bg-3)" strokeWidth="4" /><circle cx="18" cy="18" r="15" fill="none" stroke={scoreColor} strokeWidth="4" strokeLinecap="round" strokeDasharray={`${(score / 100) * 2 * Math.PI * 15} 999`} /></svg>
          </div>
        </div>

        {/* tabs */}
        <div className="mb-5 flex flex-wrap gap-1 border-b" style={{ borderColor: "var(--line)" }}>
          {(Object.keys(T.tabs) as Tab[]).map((tb) => (
            <button key={tb} onClick={() => setTab(tb)} className="relative px-4 py-2.5 text-sm transition-colors" style={{ color: tab === tb ? "var(--fg)" : "var(--fg-2)" }}>
              {T.tabs[tb]}
              {tab === tb && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full" style={{ background: "var(--accent)" }} />}
            </button>
          ))}
        </div>

        {tab === "network" && (
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="panel elev p-5 lg:col-span-2">
              <p className="label mb-4">{T.conn}</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label={T.ip} value={ip?.ip} big />
                <Field label={T.loc} value={ip ? `${flag} ${[ip.city, ip.country].filter(Boolean).join(", ")}` : undefined} />
                <Field label={T.isp} value={ip?.isp} /><Field label={T.asn} value={ip?.asn} />
                <Field label={T.tz} value={ip?.tz} /><Field label={T.src} value={ip?.source} />
              </div>
            </div>
            <div className="panel elev p-5">
              <p className="label mb-4">{T.netTitle}</p>
              {net ? <div className="grid gap-3"><Field label={T.type} value={net.type?.toUpperCase()} /><Field label={T.down} value={net.downlink ? `${net.downlink} Mbps` : "—"} /><Field label={T.rtt} value={net.rtt != null ? `${net.rtt} ms` : "—"} /><Field label={T.save} value={net.save ? "on" : "off"} /></div> : <p className="text-sm text-[var(--fg-2)]">{T.na}</p>}
            </div>
            <div className="panel elev p-5 lg:col-span-2">
              <div className="mb-4 flex items-center justify-between"><p className="label">{T.latency} · {T.latOverTime}</p><button onClick={runPings} className="mono text-xs text-[var(--accent)] hover:underline">↻</button></div>
              <div className="space-y-3">
                {pings.map((p) => { const ms = p.ms, w = ms == null ? 0 : Math.min(100, (ms / 400) * 100), col = ms == null ? "var(--fg-2)" : ms < 80 ? "#22c55e" : ms < 200 ? "#eab308" : "#ef4444";
                  return (<div key={p.host} className="flex items-center gap-3">
                    <span className="w-20 shrink-0 text-sm force-ltr">{p.label}</span>
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full" style={{ background: "var(--bg-3)" }}><div className="h-full rounded-full" style={{ width: `${w}%`, background: col, transition: "width .5s ease" }} /></div>
                    <MiniLine data={p.hist} />
                    <span className="mono w-16 text-end text-xs" style={{ color: col }}>{ms == null ? "…" : `${fa ? ms.toLocaleString("fa-IR") : ms}ms`}</span>
                  </div>); })}
              </div>
            </div>
            <div className="panel elev p-5">
              <div className="mb-4 flex items-center justify-between"><p className="label">{T.webrtc}</p><span className="mono text-xs" style={{ color: localLeak ? "#ef4444" : "#22c55e" }}>{localLeak ? "⚠ " + T.leakY : "✔ " + T.leakN}</span></div>
              {gathering && <p className="text-sm text-[var(--fg-2)]">{T.gathering}</p>}
              {!gathering && cands.length === 0 && <p className="text-sm text-[var(--fg-2)]">{T.none}</p>}
              <div className="space-y-2">{cands.map((c, i) => <div key={i} className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm" style={{ borderColor: "var(--line)" }}><span className="mono force-ltr">{c.ip}</span><span className="mono rounded-md px-2 py-0.5 text-xs" style={{ background: "var(--bg-3)", color: c.type === "srflx" ? "var(--accent)" : c.mdns ? "#22c55e" : "var(--fg-2)" }}>{c.type === "srflx" ? (fa ? "عمومی·STUN" : "public·STUN") : c.mdns ? T.mdns : T.host}</span></div>)}</div>
            </div>
          </div>
        )}

        {tab === "fingerprint" && (
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="panel elev p-5">
              <p className="label mb-4">{T.combined}</p>
              <p className="font-display text-3xl force-ltr" style={{ color: "var(--accent)", letterSpacing: "0.1em" }}>{fp.combined || "…"}</p>
              <p className="mt-3 text-xs text-[var(--fg-2)]">{T.fpNote}</p>
              <div className="mt-4 grid gap-3">
                <Field label={T.canvas} value={fp.canvas} mono /><Field label={T.audio} value={fp.audio} mono />
              </div>
            </div>
            <div className="panel elev p-5">
              <p className="label mb-4">GPU / WebGL</p>
              <div className="grid gap-3"><Field label={T.webglV} value={fp.webglVendor} mono /><Field label={T.webglR} value={fp.webglRenderer} mono /></div>
            </div>
            <div className="panel elev p-5 lg:col-span-2">
              <p className="label mb-4">{T.device}</p>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{Object.entries(dev).map(([k, v]) => <Field key={k} label={k} value={v} mono />)}</div>
            </div>
          </div>
        )}

        {tab === "performance" && (
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="panel elev p-5">
              <p className="label mb-4">{T.speed}</p>
              <div className="flex items-center gap-4">
                <div className="relative grid h-24 w-24 shrink-0 place-items-center">
                  <svg viewBox="0 0 100 100" className="h-24 w-24 -rotate-90"><circle cx="50" cy="50" r="42" fill="none" stroke="var(--bg-3)" strokeWidth="9" /><circle cx="50" cy="50" r="42" fill="none" stroke="var(--accent)" strokeWidth="9" strokeLinecap="round" strokeDasharray={`${Math.min(100, ((speed.mbps || 0) / 200) * 100) / 100 * 2 * Math.PI * 42} 999`} style={{ transition: "stroke-dasharray .6s ease" }} /></svg>
                  <span className="absolute font-display text-lg force-ltr">{speed.running ? "…" : speed.mbps ? speed.mbps.toFixed(0) : "—"}</span>
                </div>
                <div>
                  <p className="font-display text-3xl force-ltr">{speed.mbps ? `${speed.mbps.toFixed(1)}` : "—"} <span className="text-sm text-[var(--fg-2)]">{T.mbps}</span></p>
                  <button onClick={runSpeed} disabled={speed.running} className="btn btn-accent mt-3 px-4 py-2 text-sm disabled:opacity-50">{speed.running ? "…" : T.runSpeed}</button>
                </div>
              </div>
              <p className="mt-3 text-xs text-[var(--fg-2)]">via speed.cloudflare.com · 5MB</p>
            </div>
            <div className="panel elev p-5">
              <p className="label mb-4">{T.mem} · {T.storageL}</p>
              <div className="grid gap-3">
                <Field label={T.mem} value={jsHeap} mono />
                {storage && <Field label={`${T.used} / ${T.quota}`} value={`${mb(storage.usage)} / ${mb(storage.quota)}`} mono />}
                {battery && <Field label={T.batteryL} value={`${Math.round(battery.level * 100)}%${battery.charging ? " ⚡" : ""}`} mono />}
              </div>
            </div>
          </div>
        )}

        {tab === "permissions" && (
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="panel elev p-5">
              <p className="label mb-4">{T.perms}</p>
              <div className="space-y-2">
                {Object.entries(perms).map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between rounded-lg border px-3 py-2.5 text-sm" style={{ borderColor: "var(--line)" }}>
                    <span className="force-ltr">{k}</span>
                    <span className="mono rounded-md px-2 py-0.5 text-xs" style={{ background: "var(--bg-3)", color: v === "granted" ? "#22c55e" : v === "denied" ? "#ef4444" : "var(--fg-2)" }}>{v}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="grid gap-4">
              <div className="panel elev p-5">
                <p className="label mb-4">{T.mediaDev}</p>
                <div className="grid grid-cols-3 gap-3 text-center">
                  {[[T.cam, devices.cam, "🎥"], [T.mic, devices.mic, "🎙️"], [T.spk, devices.spk, "🔊"]].map(([l, n, ic]) => (
                    <div key={l as string} className="rounded-xl border p-3" style={{ borderColor: "var(--line)", background: "var(--bg-3)" }}><div className="text-2xl">{ic as string}</div><div className="font-display text-2xl">{fa ? (n as number).toLocaleString("fa-IR") : (n as number)}</div><div className="label">{l as string}</div></div>
                  ))}
                </div>
              </div>
              <div className="panel elev p-5">
                <p className="label mb-4">{fa ? "موقعیتِ دقیق (GPS)" : "Precise location (GPS)"}</p>
                {geo ? (
                  <div className="grid gap-3">
                    <Field label={fa ? "مختصات" : "Coordinates"} value={`${geo.lat.toFixed(4)}, ${geo.lon.toFixed(4)}`} mono />
                    <Field label={T.geoAcc} value={`±${Math.round(geo.acc)} m`} mono />
                  </div>
                ) : (
                  <button onClick={askGeo} className="btn btn-outline px-4 py-2 text-sm">{T.geoBtn}</button>
                )}
              </div>
            </div>
          </div>
        )}

        <p className="mt-6 flex items-center justify-center gap-2 text-center text-xs text-[var(--fg-2)]"><span className="h-1.5 w-1.5 rounded-full" style={{ background: "#22c55e" }} />{T.note}</p>
      </main>
    </div>
  );
}

function Field({ label, value, big, mono }: { label: string; value?: string; big?: boolean; mono?: boolean }) {
  return (
    <div className="rounded-xl border px-4 py-3" style={{ borderColor: "var(--line)", background: "var(--bg-3)" }}>
      <p className="label mb-1 truncate">{label}</p>
      <p className={`${big ? "font-display text-xl" : "text-sm"} ${mono ? "mono" : ""} truncate force-ltr`} style={big ? { color: "var(--accent)" } : undefined}>{value || "…"}</p>
    </div>
  );
}
