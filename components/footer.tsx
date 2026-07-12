import { profile } from "@/lib/data";

export function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="relative pb-10 pt-16">
      <div className="wrap">
        <div className="rule mb-10" />
        {/* giant wordmark */}
        <div className="edge-fade overflow-hidden">
          <div className="display select-none text-center text-[22vw] leading-none text-[var(--fg-2)] opacity-10 sm:text-[16rem]">
            saleh
          </div>
        </div>

        <div className="mt-6 flex flex-col items-center justify-between gap-4 sm:flex-row">
          <p className="text-sm text-[var(--fg-2)]">
            © {year} {profile.name}. Built with Next.js · deployed on the edge.
          </p>
          <div className="flex items-center gap-6 text-sm">
            <a href={`mailto:${profile.email}`} className="link-sweep text-[var(--fg-2)] hover:text-[var(--fg)]">Email</a>
            <a href={profile.telegramUrl} target="_blank" rel="noopener noreferrer" className="link-sweep text-[var(--fg-2)] hover:text-[var(--fg)]">Telegram</a>
            <a href={profile.github} target="_blank" rel="noopener noreferrer" className="link-sweep text-[var(--fg-2)] hover:text-[var(--fg)]">GitHub</a>
            <a href="#top" className="link-sweep text-[var(--fg-2)] hover:text-[var(--fg)]">↑ Top</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
