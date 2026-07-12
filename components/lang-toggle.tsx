"use client";

import { useLang } from "./lang-provider";

export function LangToggle() {
  const { lang, toggle } = useLang();
  return (
    <button
      type="button"
      aria-label="Switch language"
      title={lang === "fa" ? "Switch to English" : "تغییر به فارسی"}
      onClick={toggle}
      className="grid h-9 min-w-9 place-items-center rounded-full border px-3 text-sm font-medium transition-colors hover:bg-[var(--bg-2)]"
      style={{ borderColor: "var(--line-2)" }}
    >
      <span className="mono text-xs uppercase tracking-widest">
        {lang === "fa" ? "EN" : "فا"}
      </span>
    </button>
  );
}
