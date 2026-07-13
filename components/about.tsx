"use client";

import { Reveal } from "./reveal";
import { profile, pick } from "@/lib/data";
import { useLang } from "./lang-provider";

export function About() {
  const { t, lang } = useLang();

  return (
    <section id="about" className="relative scroll-mt-24 py-24 sm:py-32">
      <div className="wrap">
        <div className="grid gap-12 lg:grid-cols-12 lg:gap-8">
          <div className="lg:col-span-4">
            <Reveal>
              <p className="label">{t.about.eyebrow}</p>
              <div className="mt-6 panel p-6">
                <div className="flex items-center gap-4">
                  <span className="grid h-16 w-16 place-items-center rounded-2xl font-display text-3xl" style={{ background: "var(--accent)", color: "var(--on-accent)" }}>
                    S
                  </span>
                  <div>
                    <p className="font-display text-2xl leading-tight">{pick(profile.name, lang)}</p>
                    <p className="mono text-xs text-[var(--fg-2)] force-ltr">{profile.handle}</p>
                  </div>
                </div>
                <dl className="mt-6 space-y-0">
                  {[
                    [t.about.glance.role, pick(profile.role, lang)],
                    [t.about.glance.focus, t.about.glance.focusVal],
                    [t.about.glance.since, String(profile.activeSince)],
                    [t.about.glance.based, pick(profile.location, lang)],
                    [t.about.glance.status, t.about.glance.open],
                  ].map(([k, v], i) => (
                    <div key={k} className="flex items-center justify-between gap-3 py-3" style={{ borderTop: i ? "1px solid var(--line)" : "none" }}>
                      <dt className="label">{k}</dt>
                      <dd className="text-end text-sm font-medium">{v}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            </Reveal>
          </div>

          <div className="lg:col-span-8 lg:ps-8">
            <Reveal delay={60}>
              <p className="display text-3xl leading-[1.15] sm:text-[2.6rem]">
                {t.about.lead1}
                <span className="accent-text">{t.about.leadAccent}</span>
                {t.about.lead2}
                <span className="display-italic">{t.about.lead3}</span>
              </p>
            </Reveal>

            <div className="mt-10 grid gap-8 sm:grid-cols-2">
              <Reveal delay={120}>
                <p className="leading-relaxed text-[var(--fg-2)]">{t.about.p1}</p>
              </Reveal>
              <Reveal delay={180}>
                <p className="leading-relaxed text-[var(--fg-2)]">{t.about.p2}</p>
              </Reveal>
            </div>

            <Reveal delay={220}>
              <div className="mt-10 flex flex-wrap items-center gap-6 border-t pt-8" style={{ borderColor: "var(--line)" }}>
                <span className="fa-quote font-display text-xl italic text-[var(--fg-2)]">— {t.about.since}</span>
                <a href={profile.github} target="_blank" rel="noopener noreferrer" className="link-sweep mono text-sm force-ltr">
                  {profile.handle} ↗
                </a>
              </div>
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  );
}
