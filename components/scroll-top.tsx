"use client";

import { useEffect, useState } from "react";
import { useLang } from "./lang-provider";

/** Floating back-to-top button that fades in after scrolling past the hero. */
export function ScrollTop() {
  const { lang } = useLang();
  const [shown, setShown] = useState(false);

  useEffect(() => {
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        setShown(window.scrollY > 700);
        ticking = false;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <button
      type="button"
      aria-label={lang === "fa" ? "بازگشت به بالا" : "Back to top"}
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      className="fixed bottom-6 z-40 grid h-12 w-12 place-items-center rounded-full border shadow-lg transition-all duration-300"
      style={{
        insetInlineEnd: "1.5rem",
        background: "var(--bg-2)",
        borderColor: "var(--line-2)",
        boxShadow: "0 12px 30px -12px var(--shadow)",
        opacity: shown ? 1 : 0,
        transform: shown ? "translateY(0) scale(1)" : "translateY(16px) scale(0.9)",
        pointerEvents: shown ? "auto" : "none",
      }}
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 19V5M5 12l7-7 7 7" />
      </svg>
    </button>
  );
}
