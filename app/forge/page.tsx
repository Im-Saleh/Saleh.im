"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { TOOLS, CATEGORIES, type ToolDef } from "./tools";
import { NETSEC_TOOLS, NETSEC_CATEGORIES } from "./netsec-tools";
import { ThemePicker } from "@/components/theme-picker";

/* Merge the base toolbox with the network/security toolset (dedup by id). */
const ALL_TOOLS: ToolDef[] = (() => {
  const seen = new Set<string>();
  const out: ToolDef[] = [];
  for (const t of [...TOOLS, ...NETSEC_TOOLS]) { if (!seen.has(t.id)) { seen.add(t.id); out.push(t); } }
  return out;
})();
const ALL_CATEGORIES = [...CATEGORIES, ...NETSEC_CATEGORIES.filter((c) => !CATEGORIES.includes(c))];

const CAT_COLOR: Record<string, string> = {
  Data: "#38bdf8",
  Encode: "#a78bfa",
  Generate: "#22c55e",
  Convert: "#fbbf24",
  Text: "#f472b6",
  CSS: "#22d3ee",
  Web: "#fb7185",
  Network: "#2dd4bf",
  Security: "#f43f5e",
};

export default function ForgePage() {
  const [activeId, setActiveId] = useState(ALL_TOOLS[0].id);
  const [query, setQuery] = useState("");
  const [navOpen, setNavOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  // deep-link the active tool via the URL hash
  useEffect(() => {
    const h = decodeURIComponent(location.hash.slice(1));
    if (ALL_TOOLS.some((t) => t.id === h)) setActiveId(h);
  }, []);
  useEffect(() => {
    history.replaceState(null, "", `#${activeId}`);
  }, [activeId]);

  // Ctrl/⌘+K focuses the tool search
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return ALL_TOOLS;
    return ALL_TOOLS.filter((t) => (t.name + " " + t.keywords + " " + t.category).toLowerCase().includes(q));
  }, [query]);

  const active = ALL_TOOLS.find((t) => t.id === activeId) ?? ALL_TOOLS[0];
  const Active = active.render;

  return (
    <div className="relative min-h-screen">
      {/* ambient backdrop */}
      <div className="pointer-events-none fixed inset-0 -z-10" aria-hidden>
        <div className="absolute inset-0 dotfield opacity-70" />
        <div className="aurora left-[-6%] top-[-4%] h-80 w-80" style={{ background: "var(--accent)" }} />
        <div className="aurora right-[-4%] top-[26%] h-72 w-72" style={{ background: "var(--accent-2)", opacity: 0.24, animationDelay: "-7s" }} />
      </div>

      {/* top bar */}
      <header className="sticky top-0 z-40 border-b glass" style={{ borderColor: "var(--line)" }}>
        <div className="mx-auto flex max-w-[104rem] items-center gap-3 px-4 py-3 sm:px-6">
          <Link href="/" className="link-sweep flex items-center gap-2 text-sm text-[var(--fg-2)] hover:text-[var(--fg)]">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="m15 18-6-6 6-6" /></svg>
            saleh.im
          </Link>
          <span className="text-[var(--line-2)]">/</span>
          <div className="flex items-center gap-2">
            <span className="grid h-7 w-7 place-items-center rounded-lg text-sm font-bold" style={{ background: "var(--accent)", color: "var(--on-accent)" }}>⚒</span>
            <span className="font-display text-lg font-semibold">Forge</span>
            <span className="chip hidden sm:inline">{ALL_TOOLS.length} tools</span>
          </div>
          <div className="ms-auto flex items-center gap-2">
            <button onClick={() => setNavOpen((v) => !v)} className="btn btn-outline px-3 py-2 text-xs lg:hidden">☰ Tools</button>
            <ThemePicker />
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-[104rem] gap-6 px-4 py-6 sm:px-6">
        {/* sidebar */}
        <aside className={`${navOpen ? "block" : "hidden"} shrink-0 lg:block lg:w-72`}>
          <div className="lg:sticky lg:top-20">
            <div className="relative mb-3">
              <input
                ref={searchRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search tools…"
                className="w-full rounded-xl border bg-[var(--bg-2)] py-2.5 pl-9 pr-14 text-sm outline-none transition-colors focus:border-[var(--accent)]"
                style={{ borderColor: "var(--line-2)" }}
              />
              <svg className="pointer-events-none absolute left-3 top-3 text-[var(--fg-2)]" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>
              <span className="kbd absolute right-3 top-2.5">⌘K</span>
            </div>

            <nav className="thin-scroll max-h-[calc(100vh-9rem)] overflow-auto pr-1">
              {ALL_CATEGORIES.map((cat) => {
                const items = filtered.filter((t) => t.category === cat);
                if (items.length === 0) return null;
                return (
                  <div key={cat} className="mb-3">
                    <p className="label px-2 py-1">{cat}</p>
                    <div className="grid gap-0.5">
                      {items.map((t) => (
                        <button
                          key={t.id}
                          onClick={() => {
                            setActiveId(t.id);
                            setNavOpen(false);
                          }}
                          className="group flex items-center gap-3 rounded-xl px-2.5 py-2 text-start text-sm transition-all hover:translate-x-0.5"
                          style={
                            t.id === activeId
                              ? { background: "var(--bg-3)", boxShadow: `inset 2px 0 0 ${CAT_COLOR[t.category] || "var(--accent)"}` }
                              : {}
                          }
                        >
                          <span
                            className="mono grid h-7 w-7 shrink-0 place-items-center rounded-lg text-xs transition-all group-hover:scale-110"
                            style={{
                              background: t.id === activeId ? (CAT_COLOR[t.category] || "var(--accent)") : `color-mix(in srgb, ${CAT_COLOR[t.category] || "var(--accent)"} 12%, transparent)`,
                              color: t.id === activeId ? "#0b0c0e" : (CAT_COLOR[t.category] || "var(--fg-2)"),
                              border: `1px solid color-mix(in srgb, ${CAT_COLOR[t.category] || "var(--line)"} 24%, transparent)`,
                            }}
                          >
                            {t.icon}
                          </span>
                          <span className={t.id === activeId ? "font-medium" : "text-[var(--fg-2)] group-hover:text-[var(--fg)]"}>{t.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
              {filtered.length === 0 && <p className="px-2 py-4 text-sm text-[var(--fg-2)]">No tools match “{query}”.</p>}
            </nav>
          </div>
        </aside>

        {/* main tool panel */}
        <main className="min-w-0 flex-1">
          <div key={active.id} className="mx-auto max-w-3xl">
            <Active />
          </div>

          <footer className="mx-auto mt-14 max-w-3xl border-t pt-6 text-center text-xs text-[var(--fg-2)]" style={{ borderColor: "var(--line)" }}>
            <p>
              Forge · a developer toolbox by{" "}
              <Link href="/" className="link-sweep accent-text">Saleh</Link>. Everything runs locally in your browser — nothing is uploaded.
            </p>
          </footer>
        </main>
      </div>
    </div>
  );
}
