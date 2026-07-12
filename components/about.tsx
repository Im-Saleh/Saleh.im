import { Reveal } from "./reveal";
import { profile } from "@/lib/data";

export function About() {
  return (
    <section id="about" className="relative scroll-mt-24 py-24 sm:py-32">
      <div className="wrap">
        <div className="grid gap-12 lg:grid-cols-12 lg:gap-8">
          {/* left rail */}
          <div className="lg:col-span-4">
            <Reveal>
              <p className="label">01 / Who</p>
              <div className="mt-6 panel p-6">
                <div className="flex items-center gap-4">
                  <span
                    className="grid h-16 w-16 place-items-center rounded-2xl font-display text-3xl"
                    style={{ background: "var(--accent)", color: "var(--on-accent)" }}
                  >
                    S
                  </span>
                  <div>
                    <p className="font-display text-2xl leading-tight">{profile.name}</p>
                    <p className="mono text-xs text-[var(--fg-2)]">{profile.nameFa}</p>
                  </div>
                </div>
                <dl className="mt-6 space-y-0">
                  {[
                    ["Role", profile.role],
                    ["Age", `${profile.age}`],
                    ["Since", `${profile.activeSince}`],
                    ["Based", profile.location],
                    ["Status", "Open to work"],
                  ].map(([k, v], i) => (
                    <div
                      key={k}
                      className="flex items-center justify-between py-3"
                      style={{ borderTop: i ? "1px solid var(--line)" : "none" }}
                    >
                      <dt className="label">{k}</dt>
                      <dd className="text-sm font-medium">{v}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            </Reveal>
          </div>

          {/* right — the story */}
          <div className="lg:col-span-8 lg:pl-8">
            <Reveal delay={60}>
              <p className="display text-3xl leading-[1.15] sm:text-[2.6rem]">
                I&apos;m a teenage engineer who learned to code by
                <span className="accent-text"> breaking things</span>,
                reading source, and shipping in public — not by following
                <span className="display-italic"> tutorials.</span>
              </p>
            </Reveal>

            <div className="mt-10 grid gap-8 sm:grid-cols-2">
              <Reveal delay={120}>
                <p className="leading-relaxed text-[var(--fg-2)]">
                  My playground is the network edge: Cloudflare Workers, serverless
                  runtimes, tunneling and proxy infrastructure. I love taking a
                  low-level networking problem and turning it into something fast,
                  reliable, and genuinely nice to use.
                </p>
              </Reveal>
              <Reveal delay={180}>
                <p className="leading-relaxed text-[var(--fg-2)]">
                  I move across the whole stack — native Android in Kotlin,
                  TypeScript dashboards, encrypted peer-to-peer messengers — and I
                  sweat the details: speed, resilience, and design that has an
                  actual point of view.
                </p>
              </Reveal>
            </div>

            <Reveal delay={220}>
              <div className="mt-10 flex flex-wrap items-center gap-6 border-t pt-8" style={{ borderColor: "var(--line)" }}>
                <span className="font-display text-xl italic text-[var(--fg-2)]">
                  — building since {profile.activeSince}
                </span>
                <a
                  href={profile.github}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="link-sweep mono text-sm"
                >
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
