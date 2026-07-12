import { Reveal } from "./reveal";
import { timeline } from "@/lib/data";

export function Experience() {
  return (
    <section id="work" className="relative scroll-mt-24 py-24 sm:py-32">
      <div className="absolute inset-0 blueprint opacity-60" aria-hidden />
      <div className="wrap relative">
        <Reveal>
          <div className="flex items-end justify-between">
            <div>
              <p className="label">03 / Journey</p>
              <h2 className="display mt-3 text-5xl sm:text-6xl">The road so far</h2>
            </div>
            <span className="mono hidden text-sm text-[var(--fg-2)] sm:block">
              2022 → now
            </span>
          </div>
        </Reveal>

        <div className="mt-16 space-y-0">
          {timeline.map((item, i) => (
            <Reveal key={item.period} delay={i * 70}>
              <div
                className="group grid gap-4 py-8 sm:grid-cols-12 sm:gap-8"
                style={{ borderTop: "1px solid var(--line)" }}
              >
                <div className="sm:col-span-3">
                  <span
                    className="display block text-5xl leading-none transition-colors sm:text-6xl"
                    style={{ color: "var(--fg-2)" }}
                  >
                    {item.period}
                  </span>
                </div>
                <div className="sm:col-span-9 sm:pl-8" style={{ borderLeft: "1px solid var(--line)" }}>
                  <div className="flex items-center gap-3">
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ background: "var(--accent)", boxShadow: "0 0 12px var(--glow)" }}
                    />
                    <h3 className="font-display text-2xl">{item.title}</h3>
                  </div>
                  <p className="mt-3 max-w-2xl leading-relaxed text-[var(--fg-2)]">
                    {item.description}
                  </p>
                </div>
              </div>
            </Reveal>
          ))}
          <div style={{ borderTop: "1px solid var(--line)" }} />
        </div>
      </div>
    </section>
  );
}
