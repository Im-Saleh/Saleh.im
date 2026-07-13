"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useLang } from "@/components/lang-provider";
import { useThemeScene } from "@/components/theme-provider";
import { LangToggle } from "@/components/lang-toggle";

type Coin = {
  id: string;
  symbol: string;
  name: string;
  price: number;
  change24h: number;
  marketCap: number;
  volume: number;
  spark: number[];
};
type Global = { cap: number; vol: number; btcDom: number; ethDom: number; coins: number; capChange: number };

const API = "https://api.coingecko.com/api/v3";

/* ---------- fallback (used only if the live API is unavailable) ---------- */
const FALLBACK: Coin[] = [
  { id: "bitcoin", symbol: "btc", name: "Bitcoin", price: 68432, change24h: 1.8, marketCap: 1.35e12, volume: 3.2e10, spark: [] },
  { id: "ethereum", symbol: "eth", name: "Ethereum", price: 3567, change24h: -0.9, marketCap: 4.3e11, volume: 1.6e10, spark: [] },
  { id: "solana", symbol: "sol", name: "Solana", price: 172, change24h: 3.4, marketCap: 7.8e10, volume: 4.1e9, spark: [] },
  { id: "binancecoin", symbol: "bnb", name: "BNB", price: 592, change24h: 0.6, marketCap: 8.9e10, volume: 1.9e9, spark: [] },
  { id: "ripple", symbol: "xrp", name: "XRP", price: 0.61, change24h: -1.4, marketCap: 3.4e10, volume: 1.1e9, spark: [] },
  { id: "cardano", symbol: "ada", name: "Cardano", price: 0.45, change24h: 2.1, marketCap: 1.6e10, volume: 6e8, spark: [] },
].map((c) => ({ ...c, spark: Array.from({ length: 24 }, (_, i) => c.price * (1 + Math.sin(i / 3) * 0.04)) }));

function walk(arr: number[], base: number) {
  const next = arr.slice(1);
  const last = arr[arr.length - 1] || base;
  next.push(last * (1 + (Math.random() - 0.5) * 0.02));
  return next;
}

function Counter({ value, format }: { value: number; format: (n: number) => string }) {
  const [disp, setDisp] = useState(value);
  const ref = useRef(value);
  useEffect(() => {
    let raf = 0;
    const from = ref.current;
    const start = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / 700);
      const v = from + (value - from) * (1 - Math.pow(1 - p, 3));
      ref.current = v;
      setDisp(v);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <>{format(disp)}</>;
}

function Sparkline({ data, up }: { data: number[]; up: boolean }) {
  const path = useMemo(() => {
    if (!data.length) return "";
    const max = Math.max(...data), min = Math.min(...data), range = max - min || 1;
    return data.map((v, i) => `${(i / (data.length - 1)) * 100},${28 - ((v - min) / range) * 24 - 2}`).join(" ");
  }, [data]);
  return (
    <svg viewBox="0 0 100 28" preserveAspectRatio="none" className="h-8 w-full">
      <polyline points={path} fill="none" stroke={up ? "#27c93f" : "#ff5f56"} strokeWidth="1.6" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

function AreaChart({ data, up }: { data: number[]; up: boolean }) {
  const { line, fill, dot } = useMemo(() => {
    if (data.length < 2) return { line: "", fill: "", dot: [0, 0] };
    const max = Math.max(...data), min = Math.min(...data), range = max - min || 1;
    const pts = data.map((v, i) => [(i / (data.length - 1)) * 100, 100 - ((v - min) / range) * 88 - 6]);
    const line = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(2)},${p[1].toFixed(2)}`).join(" ");
    return { line, fill: `${line} L100,100 L0,100 Z`, dot: pts[pts.length - 1] };
  }, [data]);
  const col = up ? "#27c93f" : "#ff5f56";
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full">
      <defs>
        <linearGradient id="lg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={col} stopOpacity="0.3" />
          <stop offset="100%" stopColor={col} stopOpacity="0" />
        </linearGradient>
      </defs>
      {[25, 50, 75].map((y) => <line key={y} x1="0" y1={y} x2="100" y2={y} stroke="var(--line)" strokeWidth="0.4" vectorEffect="non-scaling-stroke" />)}
      <path d={fill} fill="url(#lg)" style={{ transition: "d .6s ease" }} />
      <path d={line} fill="none" stroke={col} strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" style={{ transition: "d .6s ease" }} />
      <circle cx={dot[0]} cy={dot[1]} r="1.8" fill={col} vectorEffect="non-scaling-stroke" style={{ transition: "cx .6s ease, cy .6s ease" }} />
    </svg>
  );
}

/* donut for market dominance */
function Donut({ segments }: { segments: { label: string; value: number; color: string }[] }) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  let acc = 0;
  const r = 42, c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 100 100" className="h-32 w-32 -rotate-90">
      {segments.map((s, i) => {
        const frac = s.value / total;
        const dash = frac * c;
        const el = <circle key={i} cx="50" cy="50" r={r} fill="none" stroke={s.color} strokeWidth="12" strokeDasharray={`${dash} ${c - dash}`} strokeDashoffset={-acc} style={{ transition: "stroke-dasharray .6s ease, stroke-dashoffset .6s ease" }} />;
        acc += dash;
        return el;
      })}
    </svg>
  );
}

export default function LumenPage() {
  const { lang } = useLang();
  const { toggleMode } = useThemeScene();
  const fa = lang === "fa";

  const [coins, setCoins] = useState<Coin[]>(FALLBACK);
  const [glob, setGlob] = useState<Global>({ cap: 2.31e12, vol: 9.8e10, btcDom: 52.4, ethDom: 17.1, coins: 13847, capChange: 1.2 });
  const [selected, setSelected] = useState("bitcoin");
  const [live, setLive] = useState(true);
  const [updated, setUpdated] = useState<Date | null>(null);
  const [usingLive, setUsingLive] = useState(false);
  const liveRef = useRef(true);
  useEffect(() => { liveRef.current = live; }, [live]);

  const money = useCallback((n: number) => {
    const sign = n < 0 ? "-" : "";
    const a = Math.abs(n);
    if (a >= 1e12) return `${sign}$${(a / 1e12).toFixed(2)}T`;
    if (a >= 1e9) return `${sign}$${(a / 1e9).toFixed(2)}B`;
    if (a >= 1e6) return `${sign}$${(a / 1e6).toFixed(2)}M`;
    if (a >= 1) return `${sign}$${a.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
    return `${sign}$${a.toFixed(4)}`;
  }, []);
  const pct = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;

  const fetchData = useCallback(async () => {
    try {
      const [mRes, gRes] = await Promise.all([
        fetch(`${API}/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=10&page=1&sparkline=true&price_change_percentage=24h`, { cache: "no-store" }),
        fetch(`${API}/global`, { cache: "no-store" }),
      ]);
      if (!mRes.ok || !gRes.ok) throw new Error("rate");
      const m = await mRes.json();
      const g = (await gRes.json()).data;
      setCoins(
        m.map((c: any) => ({
          id: c.id, symbol: c.symbol, name: c.name, price: c.current_price,
          change24h: c.price_change_percentage_24h ?? 0, marketCap: c.market_cap, volume: c.total_volume,
          spark: c.sparkline_in_7d?.price?.slice(-48) ?? [],
        }))
      );
      setGlob({
        cap: g.total_market_cap.usd, vol: g.total_volume.usd,
        btcDom: g.market_cap_percentage.btc, ethDom: g.market_cap_percentage.eth,
        coins: g.active_cryptocurrencies, capChange: g.market_cap_change_percentage_24h_usd,
      });
      setUsingLive(true);
      setUpdated(new Date());
    } catch {
      // graceful fallback: nudge the synthetic data so it still feels live
      setUsingLive(false);
      setCoins((prev) => prev.map((c) => ({ ...c, price: c.price * (1 + (Math.random() - 0.5) * 0.006), change24h: c.change24h + (Math.random() - 0.5) * 0.3, spark: walk(c.spark.length ? c.spark : [c.price], c.price) })));
      setUpdated(new Date());
    }
  }, []);

  useEffect(() => {
    fetchData();
    const id = setInterval(() => liveRef.current && fetchData(), 45000);
    return () => clearInterval(id);
  }, [fetchData]);

  // gentle between-fetch animation for the fallback ticker feel
  useEffect(() => {
    const id = setInterval(() => {
      if (!usingLive && liveRef.current) setCoins((prev) => prev.map((c) => ({ ...c, price: c.price * (1 + (Math.random() - 0.5) * 0.003) })));
    }, 3000);
    return () => clearInterval(id);
  }, [usingLive]);

  const sel = coins.find((c) => c.id === selected) || coins[0];
  const sentiment = useMemo(() => {
    const avg = coins.reduce((s, c) => s + c.change24h, 0) / (coins.length || 1);
    return Math.max(0, Math.min(100, Math.round(50 + avg * 6)));
  }, [coins]);
  const movers = useMemo(() => [...coins].sort((a, b) => b.change24h - a.change24h), [coins]);

  const T = fa
    ? { title: "Lumen", sub: "داشبورد بازار زنده", live: "زنده", paused: "متوقف", cap: "ارزش کل بازار", vol: "حجم ۲۴ساعته", btc: "سلطه‌ی BTC", coins: "ارزهای فعال", chart7d: "نمودار ۷ روزه", movers: "بیشترین تغییر", table: "بازار", sentiment: "احساسِ بازار", dom: "سلطه‌ی بازار", updated: "به‌روزرسانی", refresh: "تازه‌سازی", others: "سایر", fearg: ["ترس شدید", "ترس", "خنثی", "طمع", "طمع شدید"], real: "داده‌ی واقعی و زنده از CoinGecko", price: "قیمت", h24: "۲۴ساعت" }
    : { title: "Lumen", sub: "Live markets dashboard", live: "Live", paused: "Paused", cap: "Total market cap", vol: "24h volume", btc: "BTC dominance", coins: "Active coins", chart7d: "7-day chart", movers: "Top movers", table: "Markets", sentiment: "Market sentiment", dom: "Market dominance", updated: "Updated", refresh: "Refresh", others: "Others", fearg: ["Extreme fear", "Fear", "Neutral", "Greed", "Extreme greed"], real: "Real, live data from CoinGecko", price: "Price", h24: "24h" };

  const senLabel = T.fearg[Math.min(4, Math.floor(sentiment / 20))];

  return (
    <div className="min-h-[100dvh]">
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
          <button onClick={() => setLive((l) => !l)} className="flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs" style={{ borderColor: "var(--line-2)" }}>
            <span className="relative flex h-2 w-2">
              {live && <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-70" style={{ background: "#27c93f" }} />}
              <span className="relative inline-flex h-2 w-2 rounded-full" style={{ background: live ? "#27c93f" : "#71717a" }} />
            </span>
            {live ? T.live : T.paused}
          </button>
          <button onClick={fetchData} className="grid h-9 w-9 place-items-center rounded-full border" style={{ borderColor: "var(--line-2)" }} title={T.refresh}>↻</button>
          <button onClick={toggleMode} className="grid h-9 w-9 place-items-center rounded-full border" style={{ borderColor: "var(--line-2)" }}>◑</button>
          <LangToggle />
        </div>
      </header>

      {/* live ticker */}
      <div className="edge-fade overflow-hidden border-b py-2" style={{ borderColor: "var(--line)", background: "var(--bg-2)" }}>
        <div className="marquee">
          {[...coins, ...coins].map((c, i) => (
            <span key={i} className="mx-4 inline-flex items-center gap-2 text-sm force-ltr">
              <b className="uppercase">{c.symbol}</b>
              <span className="mono">{money(c.price)}</span>
              <span className="mono" style={{ color: c.change24h >= 0 ? "#27c93f" : "#ff5f56" }}>{pct(c.change24h)}</span>
            </span>
          ))}
        </div>
      </div>

      <main className="wrap py-6">
        <div className="mb-5 flex items-end justify-between">
          <h1 className="font-display text-2xl sm:text-3xl">{T.title}</h1>
          <span className="mono text-xs text-[var(--fg-2)]">{updated ? `${T.updated}: ${updated.toLocaleTimeString(fa ? "fa-IR" : "en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}` : "…"}</span>
        </div>

        {/* KPI row */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            { label: T.cap, value: glob.cap, fmt: money, delta: glob.capChange },
            { label: T.vol, value: glob.vol, fmt: money, delta: null as number | null },
            { label: T.btc, value: glob.btcDom, fmt: (n: number) => `${n.toFixed(1)}%`, delta: null },
            { label: T.coins, value: glob.coins, fmt: (n: number) => Math.round(n).toLocaleString(fa ? "fa-IR" : "en-US"), delta: null },
          ].map((k) => (
            <div key={k.label} className="panel elev p-4">
              <div className="flex items-center justify-between">
                <span className="label">{k.label}</span>
                {k.delta != null && <span className="mono text-[11px]" style={{ color: k.delta >= 0 ? "#27c93f" : "#ff5f56" }}>{pct(k.delta)}</span>}
              </div>
              <div className="mt-2 font-display text-2xl tabular-nums sm:text-3xl force-ltr"><Counter value={k.value} format={k.fmt} /></div>
            </div>
          ))}
        </div>

        {/* main grid */}
        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          {/* big chart */}
          <div className="panel elev p-5 lg:col-span-2">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="label">{sel?.name} · {T.chart7d}</p>
                <p className="font-display text-3xl force-ltr">
                  <Counter value={sel?.price || 0} format={money} />
                  <span className="ms-2 text-sm" style={{ color: (sel?.change24h || 0) >= 0 ? "#27c93f" : "#ff5f56" }}>{pct(sel?.change24h || 0)}</span>
                </p>
              </div>
              <div className="flex flex-wrap gap-1">
                {coins.slice(0, 6).map((c) => (
                  <button key={c.id} onClick={() => setSelected(c.id)} className="mono rounded-full px-2.5 py-1 text-xs uppercase transition-colors" style={{ background: selected === c.id ? "var(--accent)" : "transparent", color: selected === c.id ? "var(--on-accent)" : "var(--fg-2)", border: "1px solid var(--line-2)" }}>{c.symbol}</button>
                ))}
              </div>
            </div>
            <div className="h-56">{sel && <AreaChart data={sel.spark} up={(sel.change24h || 0) >= 0} />}</div>
          </div>

          {/* sentiment + dominance */}
          <div className="grid gap-4">
            <div className="panel elev p-5">
              <p className="label mb-3">{T.sentiment}</p>
              <div className="flex items-center gap-4">
                <div className="relative grid h-20 w-20 shrink-0 place-items-center">
                  <svg viewBox="0 0 100 100" className="h-20 w-20 -rotate-90">
                    <circle cx="50" cy="50" r="42" fill="none" stroke="var(--bg-3)" strokeWidth="10" />
                    <circle cx="50" cy="50" r="42" fill="none" stroke="var(--accent)" strokeWidth="10" strokeLinecap="round" strokeDasharray={`${(sentiment / 100) * 2 * Math.PI * 42} ${2 * Math.PI * 42}`} style={{ transition: "stroke-dasharray .6s ease" }} />
                  </svg>
                  <span className="absolute font-display text-xl">{fa ? sentiment.toLocaleString("fa-IR") : sentiment}</span>
                </div>
                <div>
                  <p className="font-display text-lg">{senLabel}</p>
                  <p className="text-xs text-[var(--fg-2)]">{fa ? "بر پایه‌ی میانگین تغییرِ ۲۴ساعته" : "from avg 24h change"}</p>
                </div>
              </div>
            </div>
            <div className="panel elev p-5">
              <p className="label mb-3">{T.dom}</p>
              <div className="flex items-center gap-4">
                <Donut segments={[{ label: "BTC", value: glob.btcDom, color: "var(--accent)" }, { label: "ETH", value: glob.ethDom, color: "var(--accent-2)" }, { label: T.others, value: Math.max(0, 100 - glob.btcDom - glob.ethDom), color: "var(--bg-3)" }]} />
                <div className="space-y-2 text-sm">
                  {[["BTC", glob.btcDom, "var(--accent)"], ["ETH", glob.ethDom, "var(--accent-2)"], [T.others, 100 - glob.btcDom - glob.ethDom, "var(--fg-2)"]].map(([l, v, col]) => (
                    <div key={l as string} className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: col as string }} />
                      <span className="force-ltr">{l as string}</span>
                      <span className="mono text-[var(--fg-2)]">{(v as number).toFixed(1)}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* movers + table */}
        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          <div className="panel elev p-5">
            <p className="label mb-4">{T.movers}</p>
            <div className="space-y-2">
              {movers.slice(0, 5).map((c) => (
                <div key={c.id} className="flex items-center gap-3">
                  <b className="w-12 text-sm uppercase force-ltr">{c.symbol}</b>
                  <span className="mono flex-1 text-sm force-ltr">{money(c.price)}</span>
                  <span className="mono rounded-md px-2 py-0.5 text-xs" style={{ color: c.change24h >= 0 ? "#27c93f" : "#ff5f56", background: "var(--bg-3)" }}>{pct(c.change24h)}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="panel elev p-5 lg:col-span-2">
            <p className="label mb-4">{T.table}</p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-start text-xs text-[var(--fg-2)]">
                    <th className="pb-2 text-start font-normal">#</th>
                    <th className="pb-2 text-start font-normal">{fa ? "نام" : "Name"}</th>
                    <th className="pb-2 text-end font-normal force-ltr">{T.price}</th>
                    <th className="pb-2 text-end font-normal">{T.h24}</th>
                    <th className="hidden pb-2 text-end font-normal sm:table-cell">{fa ? "نمودار" : "7d"}</th>
                  </tr>
                </thead>
                <tbody>
                  {coins.map((c, i) => (
                    <tr key={c.id} onClick={() => setSelected(c.id)} className="cursor-pointer border-t transition-colors hover:bg-[var(--bg-3)]" style={{ borderColor: "var(--line)" }}>
                      <td className="py-2.5 text-[var(--fg-2)]">{fa ? (i + 1).toLocaleString("fa-IR") : i + 1}</td>
                      <td className="py-2.5"><b>{c.name}</b> <span className="uppercase text-[var(--fg-2)] force-ltr">{c.symbol}</span></td>
                      <td className="py-2.5 text-end mono force-ltr">{money(c.price)}</td>
                      <td className="py-2.5 text-end mono" style={{ color: c.change24h >= 0 ? "#27c93f" : "#ff5f56" }}>{pct(c.change24h)}</td>
                      <td className="hidden py-2.5 sm:table-cell"><div className="ms-auto w-24"><Sparkline data={c.spark} up={c.change24h >= 0} /></div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <p className="mt-6 flex items-center justify-center gap-2 text-center text-xs text-[var(--fg-2)]">
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: usingLive ? "#27c93f" : "#eab308" }} />
          {usingLive ? T.real : fa ? "API موقتاً در دسترس نیست — نمایشِ نمونه." : "API temporarily unavailable — showing sample data."}
        </p>
      </main>
    </div>
  );
}
