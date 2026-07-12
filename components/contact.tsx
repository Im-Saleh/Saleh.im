"use client";

import { Reveal } from "./reveal";
import { profile } from "@/lib/data";
import { useLang } from "./lang-provider";

export function Contact() {
  const { t } = useLang();

  const channels = [
    { label: t.contact.email, value: profile.email, href: `mailto:${profile.email}`, cta: t.contact.write, ext: false },
    { label: t.contact.telegram, value: `@${profile.telegram}`, href: profile.telegramUrl, cta: t.contact.message, ext: true },
    { label: t.contact.github, value: profile.handle, href: profile.github, cta: t.contact.follow, ext: true },
  ];

  return (
    <section id="contact" className="relative scroll-mt-24 py-24 sm:py-32">
      <div className="wrap">
        <Reveal>
          <div className="relative overflow-hidden rounded-3xl p-8 sm:p-14" style={{ background: "var(--bg-2)", border: "1px solid var(--line)" }}>
            <div className="pointer-events-none absolute -end-20 -top-20 h-64 w-64 rounded-full aurora" style={{ background: "var(--accent)", opacity: 0.3 }} aria-hidden />
            <div className="relative">
              <p className="label">{t.contact.eyebrow}</p>
              <h2 className="display mt-4 max-w-3xl text-5xl leading-tight sm:text-7xl">
                {t.contact.heading1}
                <br />
                <span className="display-italic accent-text">{t.contact.heading2}</span>
              </h2>
              <p className="mt-6 max-w-xl text-lg text-[var(--fg-2)]">{t.contact.sub}</p>

              <div className="mt-10 grid gap-px overflow-hidden rounded-2xl sm:grid-cols-3" style={{ background: "var(--line)" }}>
                {channels.map((c) => (
                  <a
                    key={c.label}
                    href={c.href}
                    target={c.ext ? "_blank" : undefined}
                    rel="noopener noreferrer"
                    className="group flex flex-col gap-2 p-6 transition-colors"
                    style={{ background: "var(--bg-2)" }}
                  >
                    <span className="label">{c.label}</span>
                    <span className="font-display text-xl force-ltr">{c.value}</span>
                    <span className="mono mt-2 flex items-center gap-1.5 text-sm text-[var(--fg-2)] transition-colors group-hover:text-[var(--accent)]">
                      {c.cta}
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="transition-transform group-hover:translate-x-1">
                        <path d="M5 12h14M13 6l6 6-6 6" />
                      </svg>
                    </span>
                  </a>
                ))}
              </div>

              <div className="mt-10">
                <a href={`mailto:${profile.email}`} className="btn btn-accent text-base">
                  {t.contact.cta}
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                    <path d="M5 12h14M13 6l6 6-6 6" />
                  </svg>
                </a>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
