"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useLang } from "@/components/lang-provider";
import { useThemeScene } from "@/components/theme-provider";
import { LangToggle } from "@/components/lang-toggle";
import { BASE_PATH } from "@/lib/data";

type IpInfo = { ip?: string; city?: string; region?: string; country?: string; cc?: string; isp?: string; asn?: string; tz?: string; source?: string };
type Cand = { ip: string; type: string; mdns: boolean };
type Ping = { host: string; label: string; ms: number | null };

export default function ProbePage() {
  const { lang } = useLang();
  const { toggleMode } = useThemeScene();
  const fa = lang === "fa";

  const [ip, setIp] = useState<IpInfo | null>(null);
  const [cands, setCands] = useState<Cand[]>([]);
  const [gathering, setGathering] = useState(true);
  const [pings, setPings] = useState<Ping[]>([
    { host: "https://www.cloudflare.com/favicon.ico", label: "Cloudflare", ms: null },
    { host: "https://www.google.com/favicon.ico", label: "Google", ms: null },
    { host: "https://github.githubassets.com/favicons/favicon.svg", label: "GitHub", ms: null },
    { host: "https://cdn.jsdelivr.net/favicon.ico", label: "jsDelivr", ms: null },
  ]);
  const [net, setNet] = useState<{ type?: string; downlink?: number; rtt?: number; save?: boolean } | null>(null);
  const [tick, setTick] = useState(0);
  const pcRef = useRef<RTCPeerConnection | null>(null);

  /* ---- public IP + geo (real edge fn, fallback to public provider) ---- */
  useEffect(() => {
    let alive = true;
    (async () => {
      let d: any = null;
      try {
        const r = await fetch(`${BASE_PATH}/api/ip`, { cache: "no-store" });
        if (r.ok) d = await r.json();
      } catch {}
      if (!d || !d.ip) {
        try {
          const r = await fetch("https://ipwho.is/", { cache: "no-store" });
          const j = await r.json();
          d = { ip: j.ip, city: j.city, region: j.region, country: j.country, countryCode: j.country_code, isp: j.connection?.isp, asn: j.connection?.asn ? `AS${j.connection.asn}` : undefined, timezone: j.timezone?.id, source: "ipwho.is" };
        } catch {}
      }
      if (alive && d)
        setIp({ ip: d.ip, city: d.city, region: d.region, country: d.country, cc: d.countryCode || d.cc, isp: d.isp, asn: d.asn, tz: d.timezone || d.tz, source: d.source || "saleh.im/api" });
    })();
    return () => { alive = false; };
  }, []);

  /* ---- real WebRTC local/public candidate gathering ---- */
  const gather = useCallback(() => {
    setCands([]);
    setGathering(true);
    try {
      const pc = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });
      pcRef.current = pc;
      pc.createDataChannel("probe");
      const seen = new Set<string>();
      pc.onicecandidate = (e) => {
        if (!e.candidate) {
          setGathering(false);
          pc.close();
          return;
        }
        const c = e.candidate.candidate;
        const ipMatch = c.match(/([0-9]{1,3}(?:\.[0-9]{1,3}){3})|([a-fA-F0-9]{0,4}(?::[a-fA-F0-9]{0,4}){2,7})|([0-9a-f-]+\.local)/);
        const raw = ipMatch?.[0];
        if (!raw) return;
        const type = c.includes("typ host") ? "host" : c.includes("typ srflx") ? "srflx" : c.includes("typ relay") ? "relay" : "?";
        const mdns = raw.endsWith(".local");
        const key = raw + type;
        if (seen.has(key)) return;
        seen.add(key);
        setCands((prev) => [...prev, { ip: raw, type, mdns }]);
      };
      pc.createOffer().then((o) => pc.setLocalDescription(o)).catch(() => setGathering(false));
      setTimeout(() => { setGathering(false); try { pc.close(); } catch {} }, 4000);
    } catch {
      setGathering(false);
    }
  }, []);
  useEffect(() => {
    gather();
    return () => { try { pcRef.current?.close(); } catch {} };
  }, [gather, tick]);

  /* ---- Network Information API (Chromium) ---- */
  useEffect(() => {
    const c = (navigator as any).connection;
    if (c) {
      const read = () => setNet({ type: c.effectiveType, downlink: c.downlink, rtt: c.rtt, save: c.saveData });
      read();
      c.addEventListener?.("change", read);
      return () => c.removeEventListener?.("change", read);
    }
  }, []);

  /* ---- real latency probes ---- */
  const runPings = useCallback(async () => {
    const measure = async (url: string) => {
      let best = Infinity;
      for (let i = 0; i < 2; i++) {
        const t = performance.now();
        try {
          await fetch(url + "?_=" + Math.random(), { mode: "no-cors", cache: "no-store" });
          best = Math.min(best, performance.now() - t);
        } catch {}
      }
      return best === Infinity ? null : Math.round(best);
    };
    setPings((prev) => prev.map((p) => ({ ...p, ms: null })));
    const results = await Promise.all(pings.map((p) => measure(p.host)));
    setPings((prev) => prev.map((p, i) => ({ ...p, ms: results[i] })));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { runPings(); }, [tick]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ---- device / browser surface (real) ---- */
  const [dev, setDev] = useState<Record<string, string>>({});
  useEffect(() => {
    const n = navigator as any;
    setDev({
      platform: n.userAgentData?.platform || n.platform || "—",
      cores: String(n.hardwareConcurrency ?? "—"),
      memory: n.deviceMemory ? `${n.deviceMemory} GB` : "—",
      screen: `${window.screen.width}×${window.screen.height} @${window.devicePixelRatio}x`,
      viewport: `${window.innerWidth}×${window.innerHeight}`,
      lang: navigator.languages?.join(", ") || navigator.language,
      tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
      touch: "ontouchstart" in window ? (fa ? "بله" : "yes") : (fa ? "خیر" : "no"),
      dnt: n.doNotTrack === "1" || n.doNotTrack === "yes" ? (fa ? "روشن" : "on") : (fa ? "خاموش" : "off"),
      cookies: navigator.cookieEnabled ? (fa ? "فعال" : "enabled") : (fa ? "غیرفعال" : "disabled"),
    });
  }, [fa]);

  const publicLeak = cands.some((c) => c.type === "srflx");
  const localLeak = cands.some((c) => c.type === "host" && !c.mdns);
  const score = Math.max(
    0,
    100 - (localLeak ? 30 : 0) - (dev.dnt === "off" || dev.dnt === "خاموش" ? 15 : 0) - (publicLeak ? 10 : 0)
  );

  const flag = ip?.cc ? String.fromCodePoint(...ip.cc.toUpperCase().slice(0, 2).split("").map((c) => 127397 + c.charCodeAt(0))) : "";

  const T = fa
    ? { title: "Probe", sub: "بازرسِ اتصال و حریم خصوصی", scan: "اسکن دوباره", conn: "اتصالِ شما", ip: "آی‌پی عمومی", loc: "موقعیت", isp: "ارائه‌دهنده", asn: "ASN", tz: "منطقه‌ی زمانی", src: "منبع", netTitle: "شبکه", type: "نوعِ اتصال", down: "پهنای باند", rtt: "تأخیرِ تخمینی", save: "حالتِ کم‌مصرف", na: "در دسترس نیست (فقط Chromium)", webrtc: "کاندیداهای WebRTC", gathering: "در حال جمع‌آوری…", host: "محلی", mdns: "محافظت‌شده با mDNS", none: "کاندیدایی پیدا نشد", latency: "تأخیر تا سرورها", device: "دستگاه و مرورگر", privacy: "خلاصه‌ی حریم خصوصی", scoreL: "امتیازِ حریم خصوصی", note: "همه‌ی بررسی‌ها واقعی و کاملاً در مرورگرِ شما اجرا می‌شوند — هیچ داده‌ای ذخیره یا ارسال نمی‌شود.", leakY: "آی‌پیِ محلی افشا شد", leakN: "آی‌پیِ محلی افشا نشد" }
    : { title: "Probe", sub: "Connection & privacy inspector", scan: "Re-scan", conn: "Your connection", ip: "Public IP", loc: "Location", isp: "ISP", asn: "ASN", tz: "Timezone", src: "Source", netTitle: "Network", type: "Connection type", down: "Downlink", rtt: "Estimated RTT", save: "Data saver", na: "Not available (Chromium only)", webrtc: "WebRTC candidates", gathering: "gathering…", host: "local", mdns: "mDNS-protected", none: "No candidates found", latency: "Latency to endpoints", device: "Device & browser", privacy: "Privacy summary", scoreL: "Privacy score", note: "Every check runs live, entirely in your browser — nothing is stored or sent anywhere.", leakY: "Local IP exposed", leakN: "Local IP not exposed" };

  const scoreColor = score >= 80 ? "#27c93f" : score >= 55 ? "#eab308" : "#ff5f56";

  return (
    <div className="min-h-[100dvh]">
      <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b px-4 py-3 backdrop-blur-xl sm:px-6" style={{ borderColor: "var(--line)", background: "color-mix(in srgb, var(--bg) 80%, transparent)" }}>
        <div className="flex items-center gap-3">
          <Link href="/" className="mono text-sm text-[var(--fg-2)] hover:text-[var(--fg)]">← saleh.im</Link>
          <span className="hidden items-center gap-2 sm:flex">
            <span className="grid h-7 w-7 place-items-center rounded-lg text-sm" style={{ background: "var(--accent)", color: "var(--on-accent)" }}>◉</span>
            <span className="font-display text-lg">{T.title}</span>
            <span className="text-xs text-[var(--fg-2)]">{T.sub}</span>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setTick((t) => t + 1)} className="flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs" style={{ borderColor: "var(--line-2)" }}>↻ {T.scan}</button>
          <button onClick={toggleMode} className="grid h-9 w-9 place-items-center rounded-full border" style={{ borderColor: "var(--line-2)" }}>◑</button>
          <LangToggle />
        </div>
      </header>

      <main className="wrap py-6">
        <div className="mb-5 flex items-end justify-between">
          <h1 className="font-display text-2xl sm:text-3xl">{T.title}</h1>
          {/* privacy score */}
          <div className="flex items-center gap-3 rounded-full border px-4 py-2" style={{ borderColor: "var(--line-2)" }}>
            <span className="label">{T.scoreL}</span>
            <span className="font-display text-2xl" style={{ color: scoreColor }}>{fa ? score.toLocaleString("fa-IR") : score}</span>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          {/* connection */}
          <div className="panel elev p-5 lg:col-span-2">
            <p className="label mb-4">{T.conn}</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={T.ip} value={ip?.ip} big />
              <Field label={T.loc} value={ip ? `${flag} ${[ip.city, ip.country].filter(Boolean).join(", ")}` : undefined} />
              <Field label={T.isp} value={ip?.isp} />
              <Field label={T.asn} value={ip?.asn} />
              <Field label={T.tz} value={ip?.tz} />
              <Field label={T.src} value={ip?.source} />
            </div>
          </div>

          {/* network */}
          <div className="panel elev p-5">
            <p className="label mb-4">{T.netTitle}</p>
            {net ? (
              <div className="grid gap-3">
                <Field label={T.type} value={net.type?.toUpperCase()} />
                <Field label={T.down} value={net.downlink ? `${net.downlink} Mbps` : "—"} />
                <Field label={T.rtt} value={net.rtt != null ? `${net.rtt} ms` : "—"} />
                <Field label={T.save} value={net.save ? "on" : "off"} />
              </div>
            ) : (
              <p className="text-sm text-[var(--fg-2)]">{T.na}</p>
            )}
          </div>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          {/* webrtc */}
          <div className="panel elev p-5">
            <div className="mb-4 flex items-center justify-between">
              <p className="label">{T.webrtc}</p>
              <span className="mono text-xs" style={{ color: localLeak ? "#ff5f56" : "#27c93f" }}>{localLeak ? "⚠ " + T.leakY : "✔ " + T.leakN}</span>
            </div>
            {gathering && <p className="text-sm text-[var(--fg-2)]">{T.gathering}</p>}
            {!gathering && cands.length === 0 && <p className="text-sm text-[var(--fg-2)]">{T.none}</p>}
            <div className="space-y-2">
              {cands.map((c, i) => (
                <div key={i} className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm" style={{ borderColor: "var(--line)" }}>
                  <span className="mono force-ltr">{c.ip}</span>
                  <span className="mono rounded-md px-2 py-0.5 text-xs" style={{ background: "var(--bg-3)", color: c.type === "srflx" ? "var(--accent)" : c.mdns ? "#27c93f" : "var(--fg-2)" }}>
                    {c.type === "srflx" ? (fa ? "عمومی (STUN)" : "public · STUN") : c.mdns ? T.mdns : T.host}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* latency */}
          <div className="panel elev p-5">
            <div className="mb-4 flex items-center justify-between">
              <p className="label">{T.latency}</p>
              <button onClick={runPings} className="mono text-xs text-[var(--accent)] hover:underline">↻</button>
            </div>
            <div className="space-y-3">
              {pings.map((p) => {
                const ms = p.ms;
                const w = ms == null ? 0 : Math.min(100, (ms / 400) * 100);
                const col = ms == null ? "var(--fg-2)" : ms < 80 ? "#27c93f" : ms < 200 ? "#eab308" : "#ff5f56";
                return (
                  <div key={p.host}>
                    <div className="mb-1 flex justify-between text-sm">
                      <span className="force-ltr">{p.label}</span>
                      <span className="mono" style={{ color: col }}>{ms == null ? "…" : `${fa ? ms.toLocaleString("fa-IR") : ms} ms`}</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full" style={{ background: "var(--bg-3)" }}>
                      <div className="h-full rounded-full" style={{ width: `${w}%`, background: col, transition: "width .5s ease" }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* device */}
        <div className="panel elev mt-4 p-5">
          <p className="label mb-4">{T.device}</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Object.entries(dev).map(([k, v]) => (
              <Field key={k} label={k} value={v} mono />
            ))}
          </div>
        </div>

        <p className="mt-6 flex items-center justify-center gap-2 text-center text-xs text-[var(--fg-2)]">
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: "#27c93f" }} />
          {T.note}
        </p>
      </main>
    </div>
  );
}

function Field({ label, value, big, mono }: { label: string; value?: string; big?: boolean; mono?: boolean }) {
  return (
    <div className="rounded-xl border px-4 py-3" style={{ borderColor: "var(--line)", background: "var(--bg-3)" }}>
      <p className="label mb-1 truncate">{label}</p>
      <p className={`${big ? "font-display text-xl" : "text-sm"} ${mono ? "mono" : ""} truncate force-ltr`} style={big ? { color: "var(--accent)" } : undefined}>
        {value || "…"}
      </p>
    </div>
  );
}
