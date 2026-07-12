"use client";

import { profile } from "@/lib/data";
import { useLang } from "./lang-provider";

export function Footer() {
  const { t, lang } = useLang();
  const year = new Date().getFullYear();

  return (
    <footer className="relative pb-10 pt-16">
      <div className="wrap">
        <div className="rule mb-10" />
        <div className="edge-fade overflow-hidden">
          {lang === "fa" ? (
            <div className="fa-nastaliq select-none text-center text-[26vw] leading-[1.6] text-[var(--fg-2)] opacity-10 sm:text-[15rem]">
              صالح
            </div>
          ) : (
            <div className="display select-none text-center text-[22vw] leading-none text-[var(--fg-2)] opacity-10 sm:text-[16rem] force-ltr">
              saleh
            </div>
          )}
        </div>

        <div className="mt-6 flex flex-col items-center justify-between gap-4 sm:flex-row">
          <p className="text-sm text-[var(--fg-2)]">
            © {year} {profile.name.en} · {t.footer.built}
          </p>
          <div className="flex items-center gap-6 text-sm">
            <a href={`mailto:${profile.email}`} className="link-sweep text-[var(--fg-2)] hover:text-[var(--fg)]">{t.contact.email}</a>
            <a href={profile.telegramUrl} target="_blank" rel="noopener noreferrer" className="link-sweep text-[var(--fg-2)] hover:text-[var(--fg)]">{t.contact.telegram}</a>
            <a href={profile.github} target="_blank" rel="noopener noreferrer" className="link-sweep text-[var(--fg-2)] hover:text-[var(--fg)]">{t.contact.github}</a>
            <a href="#top" className="link-sweep text-[var(--fg-2)] hover:text-[var(--fg)]">↑ {t.footer.top}</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
