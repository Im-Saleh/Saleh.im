"use client";

import { useEffect, useRef, useState } from "react";
import { Reveal } from "./reveal";
import { certificates, profile, pick, type Certificate } from "@/lib/data";
import { useLang } from "./lang-provider";

/* Proper, hand-drawn SVG icons per credential domain (no trademarked logos). */
function CertIcon({ name, size = 26 }: { name: Certificate["icon"]; size?: number }) {
  const p = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  switch (name) {
    case "web":
      return (<svg {...p}><rect x="2.5" y="4" width="19" height="15" rx="2" /><path d="M2.5 8h19" /><circle cx="5" cy="6" r=".4" fill="currentColor" /><circle cx="6.6" cy="6" r=".4" fill="currentColor" /><path d="M8 12h5M8 15h8" /><rect x="15" y="11" width="4.5" height="5" rx="1" /></svg>);
    case "js":
      return (<svg {...p}><path d="m8 9-3 3 3 3M16 9l3 3-3 3M13.5 7l-3 10" /></svg>);
    case "cs":
      return (<svg {...p}><path d="M12 4 2.5 8.5 12 13l9.5-4.5L12 4Z" /><path d="M6 10.5V15c0 1.4 2.7 2.6 6 2.6s6-1.2 6-2.6v-4.5" /><path d="M21.5 8.5V14" /></svg>);
    case "frontend":
      return (<svg {...p}><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 9h18M8 4v5" /><rect x="5.5" y="11.5" width="5" height="6" rx="1" /><path d="M13 12h5M13 15h5M13 17.5h3" /></svg>);
    case "network":
      return (<svg {...p}><circle cx="12" cy="5" r="2.2" /><circle cx="5" cy="18" r="2.2" /><circle cx="19" cy="18" r="2.2" /><path d="M12 7.2 6.5 15.8M12 7.2l5.5 8.6M7 18h10" /></svg>);
    case "electronics":
      return (<svg {...p}><rect x="7" y="7" width="10" height="10" rx="1.5" /><path d="M10 3v2M14 3v2M10 19v2M14 19v2M3 10h2M3 14h2M19 10h2M19 14h2" /><circle cx="12" cy="12" r="1.6" fill="currentColor" /></svg>);
    case "cloud":
      return (<svg {...p}><path d="M7 18h9a4 4 0 0 0 .5-7.97 5.5 5.5 0 0 0-10.6 1A3.5 3.5 0 0 0 7 18Z" /></svg>);
    default: // security
      return (<svg {...p}><path d="M12 3 5 6v5c0 4.2 2.8 7.7 7 9 4.2-1.3 7-4.8 7-9V6l-7-3Z" /><path d="m9 11.5 2 2 4-4" /></svg>);
  }
}

export function Certificates() {
  const { t, lang } = useLang();
  const [open, setOpen] = useState<Certificate | null>(null);

  return (
    <section id="certificates" className="cv-section relative scroll-mt-24 overflow-hidden py-24 sm:py-32">
      <span className="section-index pointer-events-none absolute start-2 top-10 select-none sm:start-6" aria-hidden>04</span>
      <div className="absolute inset-0 blueprint opacity-40" aria-hidden />
      <div className="pointer-events-none absolute -start-24 top-1/4 h-72 w-72 rounded-full aurora floaty-slow" style={{ background: "var(--accent)", opacity: 0.07 }} aria-hidden />

      <div className="wrap relative">
        <Reveal>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="label">{t.certs.eyebrow}</p>
              <h2 className="display mt-3 text-5xl sm:text-6xl">
                {t.certs.heading1}
                <br />
                <span className="display-italic gradient-text gradient-text-anim">{t.certs.heading2}</span>
              </h2>
            </div>
            <p className="max-w-xs text-[var(--fg-2)]">{t.certs.sub}</p>
          </div>
        </Reveal>

        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {certificates.map((c, i) => (
            <Reveal key={c.title.en} delay={(i % 3) * 90} variant="scale">
              <CertCard c={c} lang={lang} t={t} onVerify={() => setOpen(c)} />
            </Reveal>
          ))}
        </div>
      </div>

      {open && <CredentialModal c={open} lang={lang} t={t} onClose={() => setOpen(null)} />}
    </section>
  );
}

/* -------- a single tilting, spotlit, holographic card -------- */
function CertCard({ c, lang, t, onVerify }: { c: Certificate; lang: "en" | "fa"; t: ReturnType<typeof useLang>["t"]; onVerify: () => void }) {
  const ref = useRef<HTMLElement>(null);
  const raf = useRef(0);
  const pending = useRef<{ rx: number; ry: number; mx: number; my: number } | null>(null);

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
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
    pending.current = { rx: (0.5 - py) * 9, ry: (px - 0.5) * 11, mx: px * 100, my: py * 100 };
    if (!raf.current) raf.current = requestAnimationFrame(apply);
  };
  const onLeave = () => {
    const el = ref.current;
    if (!el) return;
    el.style.setProperty("--rx", "0deg");
    el.style.setProperty("--ry", "0deg");
  };
  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  return (
    <article
      ref={ref}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      className="cert-card holo-card group relative flex h-full flex-col overflow-hidden rounded-2xl border p-5 sm:p-6"
      style={{ borderColor: "var(--line)", background: "var(--bg-2)" }}
    >
      <div className="cert-tilt relative z-[1] flex h-full flex-col">
        <div className="flex items-start justify-between gap-3">
          <span className="cert-badge grid h-14 w-14 shrink-0 place-items-center rounded-2xl" style={{ color: c.accent ? "var(--accent)" : "var(--accent-2)" }}>
            <CertIcon name={c.icon} />
          </span>
          <span className="inline-flex items-center gap-1.5 text-[11px] font-medium cert-verified">
            <span className="cert-tick grid h-4 w-4 place-items-center rounded-full">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
            </span>
            {t.certs.verified}
          </span>
        </div>

        <h3 className="mt-5 font-display text-xl leading-snug transition-colors group-hover:text-[var(--accent)]">
          {pick(c.title, lang)}
        </h3>

        <div className="mt-2 flex items-center gap-2 text-sm text-[var(--fg-2)]">
          <span className="font-medium">{c.issuer}</span>
          <span aria-hidden>·</span>
          <span className="mono force-ltr">{c.date}</span>
        </div>

        <div className="mt-4 flex flex-wrap gap-1.5">
          {c.skills.map((s) => (
            <span key={s} className="chip force-ltr text-[11px]">{s}</span>
          ))}
        </div>

        <div className="mt-auto flex items-center justify-between border-t pt-4" style={{ borderColor: "var(--line)" }}>
          <span className="mono text-[10px] text-[var(--fg-2)] force-ltr">{c.credentialId}</span>
          <button onClick={onVerify} className="cert-verify-btn inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium" style={{ borderColor: "color-mix(in srgb, var(--accent) 35%, transparent)", color: "var(--accent)" }}>
            {t.certs.verify}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M7 17 17 7M8 7h9v9" /></svg>
          </button>
        </div>
      </div>
    </article>
  );
}

/* -------- fake-but-slick credential verification modal -------- */
function CredentialModal({ c, lang, t, onClose }: { c: Certificate; lang: "en" | "fa"; t: ReturnType<typeof useLang>["t"]; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [onClose]);

  const verifyUrl = c.url?.replace(/^https?:\/\//, "") || `saleh.im/verify/${c.credentialId}`;
  const cells = qrCells(c.credentialId || c.title.en, 11);

  return (
    <div className="fixed inset-0 z-[80] grid place-items-center p-4" style={{ background: "rgba(4,6,10,0.62)", backdropFilter: "blur(8px)" }} onClick={onClose}>
      <div className="cred-modal relative w-full max-w-md overflow-hidden rounded-3xl border p-6 sm:p-7" style={{ borderColor: "var(--line-2)", background: "var(--bg-2)" }} onClick={(e) => e.stopPropagation()}>
        <div className="cred-sheen pointer-events-none absolute inset-0" aria-hidden />

        <button onClick={onClose} className="absolute end-4 top-4 grid h-9 w-9 place-items-center rounded-full border text-[var(--fg-2)] transition-colors hover:text-[var(--fg)]" style={{ borderColor: "var(--line-2)" }} aria-label={t.certs.close}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
        </button>

        <div className="relative flex items-center gap-3">
          <span className="cert-badge grid h-16 w-16 place-items-center rounded-2xl" style={{ color: "var(--accent)" }}><CertIcon name={c.icon} size={32} /></span>
          <div>
            <p className="label">{c.issuer}</p>
            <p className="mono mt-0.5 text-[11px] force-ltr" style={{ color: "#22c55e" }}>● {t.certs.verified}</p>
          </div>
        </div>

        <h3 className="relative mt-5 font-display text-2xl leading-tight">{pick(c.title, lang)}</h3>

        <div className="relative mt-5 grid grid-cols-[1fr_auto] items-center gap-4">
          <div className="grid gap-3">
            <Row label={t.certs.holder} value={pick(profile.name, lang)} />
            <Row label={t.certs.credential} value={c.credentialId || "—"} mono />
            <Row label={t.certs.issued} value={c.date} mono />
          </div>
          <div className="cred-qr grid shrink-0 rounded-xl p-2" style={{ gridTemplateColumns: `repeat(11, 1fr)`, background: "var(--bg-3)", border: "1px solid var(--line)" }} aria-hidden>
            {cells.map((on, i) => (
              <span key={i} style={{ width: 7, height: 7, background: on ? "var(--accent)" : "transparent", borderRadius: 1 }} />
            ))}
          </div>
        </div>

        <div className="relative mt-5 flex flex-wrap gap-1.5">
          {c.skills.map((s) => <span key={s} className="chip force-ltr text-[11px]">{s}</span>)}
        </div>

        <div className="relative mt-6 flex items-center justify-between gap-3 border-t pt-4" style={{ borderColor: "var(--line)" }}>
          <span className="inline-flex items-center gap-2 text-sm">
            <span className="cert-tick grid h-5 w-5 place-items-center rounded-full">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
            </span>
            <span className="text-[var(--fg-2)]">{t.certs.authentic}</span>
          </span>
        </div>
        <p className="relative mt-2 mono text-[11px] text-[var(--fg-2)] force-ltr">{t.certs.verifiedBy} · {verifyUrl}</p>
      </div>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="label text-[10px]">{label}</p>
      <p className={`mt-0.5 text-sm ${mono ? "mono force-ltr" : "font-medium"}`}>{value}</p>
    </div>
  );
}

function qrCells(seed: string, n: number): boolean[] {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619); }
  const out: boolean[] = [];
  for (let i = 0; i < n * n; i++) {
    h ^= h << 13; h ^= h >>> 17; h ^= h << 5; h >>>= 0;
    out.push((h & 7) > 3);
  }
  return out;
}
