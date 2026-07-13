"use client";

import { useRef } from "react";
import { Reveal } from "./reveal";
import { projects, pick, profile, type Project } from "@/lib/data";
import { useLang } from "./lang-provider";

function Arrow({ external }: { external?: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="transition-transform duration-300 group-hover:translate-x-1 group-hover:-translate-y-1">
      {external ? <path d="M7 17 17 7M8 7h9v9" /> : <path d="M5 12h14M13 6l6 6-6 6" />}
    </svg>
  );
}

function useSheen() {
  const ref = useRef<HTMLAnchorElement>(null);
  const onMove = (e: React.PointerEvent) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty("--px", `${e.clientX - r.left}px`);
    el.style.setProperty("--py", `${e.clientY - r.top}px`);
  };
  return { ref, onMove };
}

function FeatureCard({ p }: { p: Project }) {
  const { t, lang } = useLang();
  const { ref, onMove } = useSheen();
  const external = !p.internal;
  return (
    <a
      ref={ref}
      onPointerMove={onMove}
      href={p.href}
      target={external ? "_blank" : undefined}
      rel={external ? "noopener noreferrer" : undefined}
      className="sheen elev glow-border group relative flex flex-col justify-between overflow-hidden rounded-3xl p-8 sm:p-10"
      style={{
        background: p.accent ? "var(--accent)" : "var(--bg-2)",
        color: p.accent ? "var(--on-accent)" : "var(--fg)",
        border: "1px solid var(--line)",
        minHeight: "22rem",
      }}
    >
      <div className="flex items-start justify-between">
        <span className="mono text-xs uppercase tracking-widest" style={{ opacity: 0.7 }}>
          {p.internal ? t.projects.live : `${t.projects.repoBadge} · ${p.year}`}
        </span>
        <Arrow external={external} />
      </div>
      <div>
        <h3 className="display text-4xl sm:text-5xl">{pick(p.title, lang)}</h3>
        <p className="mt-4 max-w-md leading-relaxed" style={{ opacity: 0.82 }}>{pick(p.description, lang)}</p>
        <div className="mt-6 flex flex-wrap gap-2">
          {p.tags.map((tag) => (
            <span key={tag} className="rounded-full px-3 py-1 mono text-[11px] force-ltr" style={{ border: `1px solid ${p.accent ? "rgba(0,0,0,0.2)" : "var(--line-2)"}` }}>
              {tag}
            </span>
          ))}
        </div>
      </div>
    </a>
  );
}

function ListRow({ p, i }: { p: Project; i: number }) {
  const { t, lang } = useLang();
  const external = !p.internal;
  return (
    <a
      href={p.href}
      target={external ? "_blank" : undefined}
      rel={external ? "noopener noreferrer" : undefined}
      className="group grid items-center gap-4 py-6 sm:grid-cols-12"
      style={{ borderTop: "1px solid var(--line)" }}
    >
      <span className="mono text-sm text-[var(--fg-2)] sm:col-span-1">
        {lang === "fa" ? (i + 1).toLocaleString("fa-IR") : String(i + 1).padStart(2, "0")}
      </span>
      <div className="sm:col-span-4">
        <h3 className="font-display text-2xl transition-colors group-hover:text-[var(--accent)]">{pick(p.title, lang)}</h3>
        <span className="mono text-xs text-[var(--fg-2)] force-ltr">{p.year}</span>
      </div>
      <p className="text-[var(--fg-2)] sm:col-span-5">{pick(p.description, lang)}</p>
      <div className="flex items-center justify-between sm:col-span-2 sm:justify-end">
        <div className="hidden flex-wrap justify-end gap-1.5 sm:flex">
          {p.tags.slice(0, 2).map((tag) => (
            <span key={tag} className="chip force-ltr">{tag}</span>
          ))}
        </div>
        <span className="ms-3 opacity-60 transition-all group-hover:opacity-100">
          <Arrow external={external} />
        </span>
      </div>
    </a>
  );
}

export function Projects() {
  const { t } = useLang();
  const featured = projects.filter((p) => p.featured);
  const rest = projects.filter((p) => !p.featured);

  return (
    <section id="projects" className="relative scroll-mt-24 py-24 sm:py-32">
      <div className="wrap">
        <Reveal>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="label">{t.projects.eyebrow}</p>
              <h2 className="display mt-3 text-5xl sm:text-6xl">
                {t.projects.heading1} <span className="display-italic accent-text">{t.projects.heading2}</span>
              </h2>
            </div>
            <a href={profile.github} target="_blank" rel="noopener noreferrer" className="btn btn-outline">
              {t.projects.all} ↗
            </a>
          </div>
        </Reveal>

        <div className="mt-12 grid gap-4 lg:grid-cols-3">
          {featured.map((p, i) => (
            <Reveal key={p.name} delay={i * 70} className={i === 0 ? "lg:col-span-2" : ""}>
              <FeatureCard p={p} />
            </Reveal>
          ))}
        </div>

        <div className="mt-12">
          {rest.map((p, i) => (
            <Reveal key={p.name} delay={i * 50}>
              <ListRow p={p} i={i} />
            </Reveal>
          ))}
          <div style={{ borderTop: "1px solid var(--line)" }} />
        </div>
      </div>
    </section>
  );
}
