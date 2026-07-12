"use client";

import { useEffect, useRef, useState } from "react";
import { THEMES } from "@/lib/themes";
import { useThemeScene } from "./theme-provider";

export function ThemePicker() {
  const { theme, setTheme, toggleMode } = useThemeScene();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  const active = THEMES.find((t) => t.id === theme) ?? THEMES[0];

  return (
    <div ref={ref} className="relative flex items-center gap-1.5">
      {/* quick mode flip */}
      <button
        type="button"
        aria-label="Flip light / dark"
        onClick={toggleMode}
        className="grid h-9 w-9 place-items-center rounded-full border transition-colors hover:bg-[var(--bg-2)]"
        style={{ borderColor: "var(--line-2)" }}
      >
        {!mounted ? (
          <span className="h-4 w-4" />
        ) : active.mode === "dark" ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M6.3 17.7l-1.4 1.4M19.1 4.9l-1.4 1.4" />
          </svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z" />
          </svg>
        )}
      </button>

      {/* palette opener */}
      <button
        type="button"
        aria-label="Choose a color theme"
        onClick={() => setOpen((v) => !v)}
        className="flex h-9 items-center gap-2 rounded-full border pl-1.5 pr-3 transition-colors hover:bg-[var(--bg-2)]"
        style={{ borderColor: "var(--line-2)" }}
      >
        <span className="flex">
          {(mounted ? active.swatch : ["#888", "#aaa", "#ccc"]).map((c, i) => (
            <span
              key={i}
              className="h-5 w-5 rounded-full border-2"
              style={{ background: c, borderColor: "var(--bg)", marginLeft: i ? -8 : 0 }}
            />
          ))}
        </span>
        <span className="mono text-[11px] uppercase tracking-widest">{mounted ? active.name : "theme"}</span>
      </button>

      {open && (
        <div
          className="panel absolute right-0 top-11 z-[60] w-64 origin-top-right p-2 shadow-2xl"
          style={{ boxShadow: `0 20px 60px -20px var(--shadow)` }}
        >
          <p className="label px-2 py-2">Pick a scene</p>
          <div className="grid gap-1">
            {THEMES.map((t) => (
              <button
                key={t.id}
                onClick={() => {
                  setTheme(t.id);
                  setOpen(false);
                }}
                className="flex items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors hover:bg-[var(--bg-3)]"
                style={{
                  background: t.id === theme ? "var(--bg-3)" : "transparent",
                }}
              >
                <span className="flex shrink-0 overflow-hidden rounded-lg border" style={{ borderColor: "var(--line)" }}>
                  {t.swatch.map((c, i) => (
                    <span key={i} className="h-8 w-4" style={{ background: c }} />
                  ))}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2 text-sm font-medium">
                    {t.name}
                    <span className="mono text-[9px] uppercase tracking-wider text-[var(--fg-2)]">
                      {t.mode}
                    </span>
                  </span>
                  <span className="block truncate text-xs text-[var(--fg-2)]">{t.blurb}</span>
                </span>
                {t.id === theme && (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
