"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useLang } from "@/components/lang-provider";
import { useThemeScene } from "@/components/theme-provider";
import { LangToggle } from "@/components/lang-toggle";

/* deterministic seed so SSR & first client render match, then it goes live */
function seed(n: number, base: number, amp: number): number[] {
  return Array.from({ length: n }, (_, i) => Math.round(base + Math.sin(i / 3) * amp + Math.cos(i / 7) * amp * 0.5));
}

function useLive<T>(fn: () => T, ms: number, deps: any[] = []) {
  const saved = useRef(fn);
  saved.current = fn;
  useEffect(() => {
    const id = setInterval(() => saved.current(), ms);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

/* animated number that eases toward its target */
function Counter({ value, format }: { value: number; format?: (n: number) => string }) {
  const [disp, setDisp] = useState(value);
  const ref = useRef(value);
  useEffect(() => {
    let raf = 0;
    const from = ref.current;
    const to = value;
    const start = performance.now();
    const dur = 600;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      const v = from + (to - from) * eased;
      ref.current = v;
      setDisp(v);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <>{format ? format(disp) : Math.round(disp).toLocaleString()}</>;
}

function Sparkline({ data, up }: { data: number[]; up: boolean }) {
  const path = useMemo(() => {
    const max = Math.max(...data, 1);
    const min = Math.min(...data, 0);
    const range = max - min || 1;
    return data.map((v, i) => `${(i / (data.length - 1)) * 100},${28 - ((v - min) / range) * 24}`).join(" ");
  }, [data]);
  return (
    <svg viewBox="0 0 100 28" preserveAspectRatio="none" className="h-8 w-full">
      <polyline points={path} fill="none" stroke={up ? "#27c93f" : "#ff5f56"} strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function AreaChart({ data }: { data: number[] }) {
  const { line, fill, dot } = useMemo(() => {
    const max = Math.max(...data, 1);
    const min = Math.min(...data, 0);
    const range = max - min || 1;
    const pts = data.map((v, i) => [(i / (data.length - 1)) * 100, 100 - ((v - min) / range) * 92 - 4]);
    const line = pts.map((p, i) => `${i ? "L" : "M"}${p[0]},${p[1]}`).join(" ");
    const fill = `${line} L100,100 L0,100 Z`;
    const dot = pts[pts.length - 1];
    return { line, fill, dot };
  }, [data]);
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full">
      <defs>
        <linearGradient id="lumenFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.35" />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[20, 40, 60, 80].map((y) => (
        <line key={y} x1="0" y1={y} x2="100" y2={y} stroke="var(--line)" strokeWidth="0.4" vectorEffect="non-scaling-stroke" />
      ))}
      <path d={fill} fill="url(#lumenFill)" style={{ transition: "d .5s ease" }} />
      <path d={line} fill="none" stroke="var(--accent)" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" style={{ transition: "d .5s ease" }} />
      <circle cx={dot[0]} cy={dot[1]} r="1.6" fill="var(--accent)" vectorEffect="non-scaling-stroke" style={{ transition: "cx .5s ease, cy .5s ease" }} />
    </svg>
  );
}

export default function LumenPage() {
  const { lang } = useLang();
  const { toggleMode } = useThemeScene();
  const fa = lang === "fa";
  const nf = useMemo(() => new Intl.NumberFormat(fa ? "fa-IR" : "en-US"), [fa]);

  const [traffic, setTraffic] = useState<number[]>(() => seed(48, 620, 180));
  const [visitors, setVisitors] = useState(18420);
  const [rps, setRps] = useState(1240);
  const [latency, setLatency] = useState(42);
  const [errRate, setErrRate] = useState(0.4);
  const [spark, setSpark] = useState({
    visitors: seed(16, 300, 60),
    rps: seed(16, 400, 90),
    latency: seed(16, 40, 8),
    err: seed(16, 5, 3),
  });
  const [range, setRange] = useState<"24h" | "7d" | "30d">("24h");
  const [events, setEvents] = useState<{ id: string; path: string; loc: string; ms: number; t: number }[]>([]);

  const sources = [
    { name: fa ? "مستقیم" : "Direct", pct: 38 },
    { name: "GitHub", pct: 24 },
    { name: fa ? "جستجو" : "Search", pct: 19 },
    { name: fa ? "شبکه‌های اجتماعی" : "Social", pct: 12 },
    { name: fa ? "ارجاع" : "Referral", pct: 7 },
  ];
  const regions = [
    { name: fa ? "اروپا" : "Europe", flag: "🇪🇺", pct: 34 },
    { name: fa ? "آمریکای شمالی" : "North America", flag: "🇺🇸", pct: 28 },
    { name: fa ? "آسیا" : "Asia", flag: "🌏", pct: 22 },
    { name: fa ? "خاورمیانه" : "Middle East", flag: "🌍", pct: 11 },
    { name: fa ? "سایر" : "Other", flag: "🛰️", pct: 5 },
  ];
  const paths = ["/", "/pricing", "/docs", "/blog/edge-rendering", "/api/v2/track", "/changelog", "/login", "/dashboard"];
  const locs = ["Tehran", "Berlin", "Tokyo", "Austin", "Paris", "Toronto", "Dubai", "Seoul"];

  useLive(() => {
    setTraffic((prev) => {
      const next = prev.slice(1);
      const last = prev[prev.length - 1];
      const delta = Math.round((Math.random() - 0.45) * 90);
      next.push(Math.max(240, Math.min(1100, last + delta)));
      return next;
    });
    setVisitors((v) => v + Math.floor(Math.random() * 22));
    setRps(() => 900 + Math.floor(Math.random() * 700));
    setLatency(() => 34 + Math.floor(Math.random() * 26));
    setErrRate(() => +(Math.random() * 0.9).toFixed(2));
    setSpark((s) => ({
      visitors: [...s.visitors.slice(1), 280 + Math.random() * 120],
      rps: [...s.rps.slice(1), 350 + Math.random() * 180],
      latency: [...s.latency.slice(1), 34 + Math.random() * 24],
      err: [...s.err.slice(1), 2 + Math.random() * 8],
    }));
  }, 2000);

  useLive(() => {
    setEvents((prev) =>
      [
        {
          id: Math.random().toString(36).slice(2),
          path: paths[Math.floor(Math.random() * paths.length)],
          loc: locs[Math.floor(Math.random() * locs.length)],
          ms: 12 + Math.floor(Math.random() * 180),
          t: Date.now(),
        },
        ...prev,
      ].slice(0, 8)
    );
  }, 2200);

  const T = fa
    ? { title: "Lumen", sub: "تحلیلِ بلادرنگ", live: "زنده", visitors: "بازدیدکننده‌ها", rps: "درخواست/ثانیه", latency: "میانگین تأخیر", err: "نرخ خطا", traffic: "ترافیک بلادرنگ", sources: "منابع", regions: "مناطق", feed: "رویدادهای زنده", now: "همین حالا", ms: "میلی‌ثانیه" }
    : { title: "Lumen", sub: "Real-time analytics", live: "Live", visitors: "Visitors", rps: "Requests/sec", latency: "Avg latency", err: "Error rate", traffic: "Live traffic", sources: "Top sources", regions: "Regions", feed: "Live events", now: "just now", ms: "ms" };

  const kpis = [
    { label: T.visitors, value: visitors, spark: spark.visitors, delta: "+12.4%", up: true, fmt: (n: number) => nf.format(Math.round(n)) },
    { label: T.rps, value: rps, spark: spark.rps, delta: "+3.1%", up: true, fmt: (n: number) => nf.format(Math.round(n)) },
    { label: T.latency, value: latency, spark: spark.latency, delta: "-8ms", up: true, fmt: (n: number) => `${nf.format(Math.round(n))} ${T.ms}` },
    { label: T.err, value: errRate, spark: spark.err, delta: "-0.2%", up: true, fmt: (n: number) => `${(fa ? n.toLocaleString("fa-IR", { maximumFractionDigits: 2 }) : n.toFixed(2))}%` },
  ];

  return (
    <div className="min-h-[100dvh]">
      {/* top bar */}
      <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b px-4 py-3 backdrop-blur-xl sm:px-6" style={{ borderColor: "var(--line)", background: "color-mix(in srgb, var(--bg) 80%, transparent)" }}>
        <div className="flex items-center gap-3">
          <Link href="/" className="mono text-sm text-[var(--fg-2)] hover:text-[var(--fg)]">← saleh.im</Link>
          <span className="hidden items-center gap-2 sm:flex">
            <span className="grid h-7 w-7 place-items-center rounded-lg text-sm" style={{ background: "var(--accent)", color: "var(--on-accent)" }}>◎</span>
            <span className="font-display text-lg">{T.title}</span>
            <span className="text-xs text-[var(--fg-2)]">{T.sub}</span>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs" style={{ borderColor: "var(--line-2)" }}>
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-70" style={{ background: "#27c93f" }} />
              <span className="relative inline-flex h-2 w-2 rounded-full" style={{ background: "#27c93f" }} />
            </span>
            {T.live}
          </span>
          <button onClick={toggleMode} className="grid h-9 w-9 place-items-center rounded-full border" style={{ borderColor: "var(--line-2)" }}>◑</button>
          <LangToggle />
        </div>
      </header>

      <main className="wrap py-6">
        {/* range tabs */}
        <div className="mb-5 flex items-center justify-between">
          <h1 className="font-display text-2xl sm:text-3xl">{T.traffic}</h1>
          <div className="flex gap-1 rounded-full border p-1" style={{ borderColor: "var(--line-2)" }}>
            {(["24h", "7d", "30d"] as const).map((r) => (
              <button key={r} onClick={() => setRange(r)} className="mono rounded-full px-3 py-1 text-xs transition-colors" style={{ background: range === r ? "var(--accent)" : "transparent", color: range === r ? "var(--on-accent)" : "var(--fg-2)" }}>{r}</button>
            ))}
          </div>
        </div>

        {/* KPI cards */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {kpis.map((k) => (
            <div key={k.label} className="panel elev p-4">
              <div className="flex items-center justify-between">
                <span className="label">{k.label}</span>
                <span className="mono text-[11px]" style={{ color: k.up ? "#27c93f" : "#ff5f56" }}>{k.delta}</span>
              </div>
              <div className="mt-2 font-display text-3xl tabular-nums">
                <Counter value={k.value} format={k.fmt} />
              </div>
              <div className="mt-2">
                <Sparkline data={k.spark} up={k.up} />
              </div>
            </div>
          ))}
        </div>

        {/* main grid */}
        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          {/* area chart */}
          <div className="panel elev p-5 lg:col-span-2">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="label">{T.traffic}</p>
                <p className="font-display text-2xl">
                  <Counter value={traffic[traffic.length - 1]} format={(n) => nf.format(Math.round(n))} /> <span className="text-sm text-[var(--fg-2)]">req/min</span>
                </p>
              </div>
              <span className="mono text-xs text-[var(--fg-2)]">{range}</span>
            </div>
            <div className="h-56">
              <AreaChart data={traffic} />
            </div>
          </div>

          {/* sources + regions */}
          <div className="grid gap-4">
            <div className="panel elev p-5">
              <p className="label mb-4">{T.sources}</p>
              <div className="space-y-3">
                {sources.map((s) => (
                  <div key={s.name}>
                    <div className="mb-1 flex justify-between text-sm">
                      <span>{s.name}</span>
                      <span className="mono text-[var(--fg-2)]">{fa ? s.pct.toLocaleString("fa-IR") : s.pct}%</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full" style={{ background: "var(--bg-3)" }}>
                      <div className="h-full rounded-full" style={{ width: `${s.pct}%`, background: "var(--accent)" }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* regions + feed */}
        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          <div className="panel elev p-5">
            <p className="label mb-4">{T.regions}</p>
            <div className="space-y-3">
              {regions.map((r) => (
                <div key={r.name} className="flex items-center gap-3">
                  <span className="text-lg">{r.flag}</span>
                  <span className="flex-1 text-sm">{r.name}</span>
                  <div className="h-1.5 w-24 overflow-hidden rounded-full" style={{ background: "var(--bg-3)" }}>
                    <div className="h-full rounded-full" style={{ width: `${r.pct}%`, background: "var(--accent-2)" }} />
                  </div>
                  <span className="mono w-8 text-end text-xs text-[var(--fg-2)]">{fa ? r.pct.toLocaleString("fa-IR") : r.pct}%</span>
                </div>
              ))}
            </div>
          </div>

          <div className="panel elev p-5 lg:col-span-2">
            <div className="mb-4 flex items-center justify-between">
              <p className="label">{T.feed}</p>
              <span className="flex items-center gap-1.5 text-xs text-[var(--fg-2)]"><span className="h-1.5 w-1.5 rounded-full" style={{ background: "#27c93f" }} />{T.live}</span>
            </div>
            <div className="space-y-1">
              {events.length === 0 && <p className="text-sm text-[var(--fg-2)]">…</p>}
              {events.map((e) => (
                <div key={e.id} className="flex items-center gap-3 rounded-lg px-2 py-2 text-sm" style={{ animation: "feedIn .4s ease" }}>
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: e.ms < 60 ? "#27c93f" : e.ms < 120 ? "#eab308" : "#ff5f56" }} />
                  <span className="mono flex-1 truncate force-ltr">{e.path}</span>
                  <span className="hidden text-xs text-[var(--fg-2)] sm:inline">{e.loc}</span>
                  <span className="mono w-16 text-end text-xs text-[var(--fg-2)]">{fa ? e.ms.toLocaleString("fa-IR") : e.ms} {T.ms}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-[var(--fg-2)]">
          {fa ? "داده‌ها شبیه‌سازی‌شده‌اند — یک نمایشِ زنده از یک داشبوردِ تحلیلِ بلادرنگ." : "Data is simulated — a live demo of a real-time analytics dashboard."}
        </p>
      </main>

      <style jsx global>{`
        @keyframes feedIn {
          from { opacity: 0; transform: translateY(-6px); }
          to { opacity: 1; transform: none; }
        }
      `}</style>
    </div>
  );
}
