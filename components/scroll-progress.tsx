"use client";

import { useEffect, useRef } from "react";

/**
 * A thin scroll-progress bar pinned to the top of the viewport. The width is
 * written straight to the DOM inside a rAF — no React state, so scrolling never
 * triggers a re-render (zero jank on mobile).
 */
export function ScrollProgress() {
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let ticking = false;
    const update = () => {
      const h = document.documentElement;
      const max = h.scrollHeight - h.clientHeight;
      const p = max > 0 ? (h.scrollTop / max) * 100 : 0;
      if (barRef.current) barRef.current.style.width = `${p}%`;
      ticking = false;
    };
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(update);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    update();
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[70] h-[3px]" aria-hidden>
      <div
        ref={barRef}
        className="h-full origin-left"
        style={{
          width: "0%",
          background: "linear-gradient(90deg, var(--accent), var(--accent-2))",
          boxShadow: "0 0 12px var(--glow)",
        }}
      />
    </div>
  );
}
