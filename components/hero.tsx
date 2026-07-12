"use client";

import { useEffect, useRef, useState } from "react";
import { profile, skills } from "@/lib/data";

const rotating = ["at the edge.", "over WebRTC.", "on Workers.", "in the terminal.", "for the web."];

export function Hero() {
  const [idx, setIdx] = useState(0);
  const stageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setInterval(() => setIdx((v) => (v + 1) % rotating.length), 2600);
    return () => clearInterval(t);
  }, []);

  // Parallax on aurora — pointer only, rAF-throttled, never on scroll.
  useEffect(() => {
    const el = stageRef.current;
    if (!el || window.matchMedia("(pointer: coarse)").matches) return;
    let raf = 0;
    const onMove = (e: PointerEvent) => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        const x = (e.clientX / window.innerWidth - 0.5) * 24;
        const y = (e.clientY / window.innerHeight - 0.5) * 24;
        el.style.setProperty("--tx", `${x}px`);
        el.style.setProperty("--ty", `${y}px`);
        raf = 0;
      });
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, []);

  const marquee = skills.flatMap((g) => g.items);

  return (
    <section id="top" className="relative overflow-hidden pt-28 sm:pt-32">
      {/* backdrop */}
      <div ref={stageRef} className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="absolute inset-0 dotfield" />
        <div
          className="aurora left-[8%] top-[14%] h-72 w-72"
          style={{ background: "var(--accent)", transform: "translate3d(var(--tx,0),var(--ty,0),0)" }}
        />
        <div
          className="aurora right-[6%] top-[30%] h-64 w-64"
          style={{ background: "var(--accent-2)", opacity: 0.28, animationDelay: "-6s" }}
        />
      </div>

      <div className="wrap relative">
        {/* top status strip */}
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-b pb-4 text-sm" style={{ borderColor: "var(--line)" }}>
          <span className="tag-dot text-[var(--fg-2)]">Available for freelance</span>
          <span className="mono text-xs text-[var(--fg-2)]">{profile.location}</span>
          <span className="mono ml-auto hidden text-xs text-[var(--fg-2)] sm:block">
            EST. {profile.activeSince} · {profile.handle}
          </span>
        </div>

        {/* headline — asymmetric editorial */}
        <div className="grid gap-8 pt-10 lg:grid-cols-12 lg:gap-6 lg:pt-16">
          <div className="lg:col-span-8">
            <h1 className="display text-[15vw] leading-[0.85] sm:text-8xl lg:text-[8.2rem]">
              <span className="block">Saleh</span>
              <span className="block">
                <span className="stroke-text">Sagha</span>
                <span className="display-italic accent-text">fiani</span>
              </span>
            </h1>

            <div className="mt-8 flex items-baseline gap-3 text-2xl sm:text-3xl">
              <span className="font-display">I build fast things</span>
              <span className="relative inline-block min-w-[6ch]">
                <span key={idx} className="accent-text font-display animate-[fadeUp_.5s_ease]">
                  {rotating[idx]}
                </span>
              </span>
            </div>
          </div>

          <div className="flex flex-col justify-end gap-6 lg:col-span-4">
            <p className="max-w-sm text-[var(--fg-2)] sm:text-lg">
              {profile.age}-year-old self-taught software &amp; network engineer.
              Shipping open-source since {profile.activeSince} — from Cloudflare Workers
              and tunneling infrastructure to encrypted messengers.
            </p>
            <div className="flex flex-wrap gap-3">
              <a href="#projects" className="btn btn-accent">
                See the work
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                  <path d="M7 17 17 7M8 7h9v9" />
                </svg>
              </a>
              <a href="#contact" className="btn btn-outline">Say hello</a>
            </div>
          </div>
        </div>

        {/* stat rail */}
        <div className="mt-14 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border sm:grid-cols-4" style={{ borderColor: "var(--line)", background: "var(--line)" }}>
          {[
            { v: `${new Date().getFullYear() - profile.activeSince}+`, k: "Years shipping" },
            { v: "30+", k: "Repositories" },
            { v: "6", k: "Languages" },
            { v: "∞", k: "Curiosity" },
          ].map((s) => (
            <div key={s.k} className="bg-[var(--bg)] p-5">
              <div className="count font-display text-4xl font-semibold sm:text-5xl">{s.v}</div>
              <div className="label mt-2">{s.k}</div>
            </div>
          ))}
        </div>
      </div>

      {/* running marquee */}
      <div className="edge-fade mt-16 border-y py-4" style={{ borderColor: "var(--line)" }}>
        <div className="marquee">
          {[...marquee, ...marquee].map((m, i) => (
            <span key={i} className="mx-5 font-display text-2xl text-[var(--fg-2)] sm:text-3xl">
              {m}
              <span className="accent-text mx-5">✦</span>
            </span>
          ))}
        </div>
      </div>

      <style jsx>{`
        @keyframes fadeUp {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
          to {
            opacity: 1;
            transform: none;
          }
        }
      `}</style>
    </section>
  );
}
