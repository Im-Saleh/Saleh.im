"use client";

import { useEffect, useRef, useState } from "react";
import { Reveal } from "./reveal";
import { electronics, pick, type ElectronicsSkill } from "@/lib/data";
import { useLang } from "./lang-provider";

function SkillIcon({ name }: { name: string }) {
  const common = { width: 20, height: 20, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  switch (name) {
    case "pcb":
      return (<svg {...common}><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8" cy="8" r="1.3" /><circle cx="16" cy="16" r="1.3" /><path d="M8 9.3V13h4M16 14.7V11h-4" /></svg>);
    case "chip":
      return (<svg {...common}><rect x="7" y="7" width="10" height="10" rx="1.5" /><path d="M10 3v2M14 3v2M10 19v2M14 19v2M3 10h2M3 14h2M19 10h2M19 14h2" /></svg>);
    case "iron":
      return (<svg {...common}><path d="M3 21c3-1 5-3 6-5" /><path d="M9 16l6-9a2.5 2.5 0 0 1 4 3l-9 6z" /><path d="M13 6l3 3" /></svg>);
    default:
      return (<svg {...common}><circle cx="5" cy="12" r="2" /><circle cx="19" cy="6" r="2" /><circle cx="19" cy="18" r="2" /><path d="M7 12h6M13 12l4-5M13 12l4 5" /></svg>);
  }
}

export function Electronics() {
  const { t, lang } = useLang();

  return (
    <section id="electronics" className="cv-section relative scroll-mt-24 overflow-hidden py-24 sm:py-32">
      <span className="section-index pointer-events-none absolute end-2 top-10 select-none sm:end-6" aria-hidden>03</span>

      <div className="wrap relative">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          {/* ---- Left: copy + skill cards ---- */}
          <div>
            <Reveal>
              <p className="label">{t.electronics.eyebrow}</p>
              <h2 className="display mt-3 text-5xl sm:text-6xl">
                {t.electronics.heading1}
                <br />
                <span className="display-italic gradient-text gradient-text-anim">{t.electronics.heading2}</span>
              </h2>
              <p className="mt-6 max-w-md leading-relaxed text-[var(--fg-2)]">{t.electronics.sub}</p>
              <p className="fa-quote mt-4 max-w-md text-sm italic text-[var(--fg-2)]">{pick(electronics.note, lang)}</p>
            </Reveal>

            <div className="mt-10 grid gap-4">
              {electronics.skills.map((s, i) => (
                <Reveal key={s.name.en} delay={i * 70}>
                  <SkillCard s={s} lang={lang} />
                </Reveal>
              ))}
            </div>
          </div>

          {/* ---- Right: lightweight static circuit-board illustration (SVG, no WebGL) ---- */}
          <Reveal variant="scale" delay={80}>
            <BoardArt />
          </Reveal>
        </div>
      </div>
    </section>
  );
}

/* A skill card. On desktop (fine pointer) it gets a subtle spotlight + tilt;
   on touch devices those handlers never attach, so scrolling stays smooth. */
function SkillCard({ s, lang }: { s: ElectronicsSkill; lang: "en" | "fa" }) {
  const ref = useRef<HTMLDivElement>(null);
  const raf = useRef(0);
  const pending = useRef<{ rx: number; ry: number; mx: number; my: number } | null>(null);
  const [fine, setFine] = useState(false);

  useEffect(() => {
    setFine(typeof window !== "undefined" && window.matchMedia("(pointer: fine)").matches);
  }, []);

  const faDigit = (n: number | string) =>
    lang === "fa" ? String(n).replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[+d]) : String(n);

  const apply = () => {
    raf.current = 0;
    const el = ref.current, p = pending.current;
    if (!el || !p) return;
    el.style.setProperty("--rx", `${p.rx.toFixed(2)}deg`);
    el.style.setProperty("--ry", `${p.ry.toFixed(2)}deg`);
    el.style.setProperty("--mx", `${p.mx.toFixed(1)}%`);
    el.style.setProperty("--my", `${p.my.toFixed(1)}%`);
  };
  const onMove = (e: React.PointerEvent) => {
    if (!fine) return;
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
    pending.current = { rx: (0.5 - py) * 7, ry: (px - 0.5) * 9, mx: px * 100, my: py * 100 };
    if (!raf.current) raf.current = requestAnimationFrame(apply);
  };
  const onLeave = () => {
    const el = ref.current;
    if (!el) return;
    el.style.setProperty("--rx", "0deg");
    el.style.setProperty("--ry", "0deg");
  };
  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  // count the percentage up from 0 once the card scrolls into view
  const [pct, setPct] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") { setPct(s.level); return; }
    let r = 0;
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      const start = performance.now(), dur = 1300;
      const step = (now: number) => {
        const p = Math.min(1, (now - start) / dur);
        setPct(Math.round(s.level * (1 - Math.pow(1 - p, 3))));
        if (p < 1) r = requestAnimationFrame(step);
      };
      r = requestAnimationFrame(step);
    }, { threshold: 0.5 });
    io.observe(el);
    return () => { io.disconnect(); cancelAnimationFrame(r); };
  }, [s.level]);

  return (
    <div
      ref={ref}
      onPointerMove={fine ? onMove : undefined}
      onPointerLeave={fine ? onLeave : undefined}
      className={`skill-card group relative overflow-hidden rounded-2xl border p-4 sm:p-5${fine ? "" : " skill-card-static"}`}
      style={{ borderColor: "var(--line-2)", background: "var(--bg-2)" }}
    >
      <div className="skill-tilt relative z-[1]">
        <div className="flex items-center gap-3">
          <span className="skill-icon grid h-11 w-11 shrink-0 place-items-center rounded-xl border" style={{ borderColor: "var(--line-2)", color: "var(--fg-2)", background: "var(--bg-3)" }}>
            <SkillIcon name={s.icon} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-3">
              <span className="skill-title font-display text-lg leading-tight">{pick(s.name, lang)}</span>
              <span className="pct mono text-base font-semibold force-ltr">{faDigit(pct)}%</span>
            </div>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full" style={{ background: "var(--bg-3)", boxShadow: "inset 0 1px 2px rgba(0,0,0,0.3)" }}>
              <MeterBar level={s.level} />
            </div>
          </div>
        </div>
        <p className="mt-3 text-sm leading-relaxed text-[var(--fg-2)]">{pick(s.blurb, lang)}</p>
      </div>
    </div>
  );
}

/* Static, dependency-free circuit-board artwork. Pure SVG so it costs almost
   nothing to render and never blocks the main thread on mobile. */
function BoardArt() {
  return (
    <div
      className="relative aspect-[5/4] w-full overflow-hidden rounded-[26px] border"
      style={{ borderColor: "var(--line-2)", background: "linear-gradient(160deg, var(--bg-2), var(--bg-3))" }}
    >
      <svg viewBox="0 0 500 400" className="absolute inset-0 h-full w-full" role="img" aria-label="Circuit board illustration">
        <defs>
          <linearGradient id="chipGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="var(--accent)" stopOpacity="0.9" />
            <stop offset="1" stopColor="var(--accent-2)" stopOpacity="0.75" />
          </linearGradient>
          <pattern id="dots" width="26" height="26" patternUnits="userSpaceOnUse">
            <circle cx="1.5" cy="1.5" r="1.2" fill="var(--line-2)" opacity="0.5" />
          </pattern>
        </defs>

        {/* dotted substrate */}
        <rect width="500" height="400" fill="url(#dots)" />

        {/* copper traces */}
        <g fill="none" stroke="var(--accent)" strokeWidth="2.2" opacity="0.55" strokeLinecap="round" strokeLinejoin="round">
          <path d="M60 90 H160 V150 H250" />
          <path d="M250 150 H360 V70 H440" />
          <path d="M60 300 H140 V240 H250 V150" />
          <path d="M250 250 H330 V330 H430" />
          <path d="M170 330 V250" />
        </g>
        <g fill="none" stroke="var(--accent-2)" strokeWidth="2.2" opacity="0.4" strokeLinecap="round" strokeLinejoin="round">
          <path d="M90 60 V120 H200" />
          <path d="M420 130 V210 H300" />
        </g>

        {/* pads */}
        {[[60,90],[160,150],[360,70],[440,70],[140,300],[330,330],[430,330],[90,60],[420,210]].map(([x,y],i)=>(
          <circle key={i} cx={x} cy={y} r="4.5" fill="none" stroke="var(--accent)" strokeWidth="2" opacity="0.7" />
        ))}

        {/* central SoC */}
        <g>
          <rect x="205" y="165" width="90" height="90" rx="10" fill="url(#chipGrad)" />
          <rect x="205" y="165" width="90" height="90" rx="10" fill="none" stroke="var(--fg)" strokeWidth="1" opacity="0.15" />
          <text x="250" y="215" textAnchor="middle" fontFamily="monospace" fontSize="13" fill="var(--on-accent)" opacity="0.85">SLH</text>
          {/* pins */}
          {[0,1,2,3,4].map((i)=>(
            <g key={i}>
              <rect x={214 + i*17} y="157" width="7" height="9" rx="1.5" fill="var(--line-2)" />
              <rect x={214 + i*17} y="254" width="7" height="9" rx="1.5" fill="var(--line-2)" />
              <rect x="197" y={174 + i*17} width="9" height="7" rx="1.5" fill="var(--line-2)" />
              <rect x="294" y={174 + i*17} width="9" height="7" rx="1.5" fill="var(--line-2)" />
            </g>
          ))}
        </g>

        {/* small components */}
        <rect x="120" y="130" width="34" height="20" rx="3" fill="var(--bg)" stroke="var(--line-2)" strokeWidth="1.5" />
        <rect x="350" y="300" width="34" height="20" rx="3" fill="var(--bg)" stroke="var(--line-2)" strokeWidth="1.5" />
        <rect x="360" y="120" width="20" height="34" rx="3" fill="var(--bg)" stroke="var(--line-2)" strokeWidth="1.5" />
        {/* status LED */}
        <circle cx="150" cy="240" r="7" fill="var(--accent-2)" />
        <circle cx="150" cy="240" r="12" fill="none" stroke="var(--accent-2)" strokeWidth="1.5" opacity="0.4" />
        {/* electrolytic cap */}
        <circle cx="410" cy="255" r="18" fill="var(--bg)" stroke="var(--line-2)" strokeWidth="1.5" />
        <path d="M402 255 H418" stroke="var(--fg-2)" strokeWidth="1.5" />
      </svg>
      <div className="pointer-events-none absolute inset-0 rounded-[26px] ring-1 ring-inset" style={{ borderColor: "var(--line)" }} aria-hidden />
    </div>
  );
}

function MeterBar({ level }: { level: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [on, setOn] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") { setOn(true); return; }
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setOn(true); io.disconnect(); } }, { threshold: 0.4 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <span
      ref={ref}
      className="meter-fill block h-full rounded-full"
      style={{
        width: on ? `${level}%` : "0%",
        background: "linear-gradient(90deg, var(--accent), var(--accent-2))",
        boxShadow: "0 0 12px var(--glow)",
        transition: "width 1.2s cubic-bezier(0.22,1,0.36,1)",
      }}
    />
  );
}
