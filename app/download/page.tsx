"use client";

import { useState } from "react";
import Link from "next/link";
import { useLang } from "@/components/lang-provider";
import { useThemeScene } from "@/components/theme-provider";
import { LangToggle } from "@/components/lang-toggle";
import { Logo } from "@/components/logo";
import { Reveal } from "@/components/reveal";

/* ============================================================================
   /download — get Vault as a native Linux app (Ubuntu / Kubuntu).
   Bilingual, styled to match the site. The signed installers are published on
   GitHub Releases; this page gives one-click download + copy-paste install.
   ========================================================================== */

const RELEASES = "https://github.com/im-saleh/Saleh.im/releases/latest";
const REPO_DESKTOP = "https://github.com/im-saleh/Saleh.im/tree/main/desktop";
const VERSION = "1.1.0";
const DEB = `Vault-${VERSION}-amd64.deb`;
const APPIMAGE = `Vault-${VERSION}-x86_64.AppImage`;

export default function DownloadPage() {
  const { lang } = useLang();
  const { toggleMode } = useThemeScene();
  const fa = lang === "fa";
  const [copied, setCopied] = useState<string | null>(null);

  const copy = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {}
    setCopied(key);
    setTimeout(() => setCopied((k) => (k === key ? null : k)), 1400);
  };

  const T = fa
    ? {
        back: "بازگشت",
        eyebrow: "دانلود",
        title: "والت برای لینوکس",
        sub: "گاوصندوقِ رمزهای عبورِ بدونِ دانش — به‌صورتِ اپِ بومیِ دسکتاپ برای اوبونتو، کوبونتو و هر توزیعِ مبتنی بر دبیان.",
        version: `نسخه ${VERSION} · ۶۴ بیت`,
        getDeb: "دانلودِ ‎.deb",
        getAppimage: "دانلودِ AppImage",
        installTitle: "نصب روی اوبونتو / کوبونتو",
        debStep: "با ‎.deb (پیشنهادی):",
        appimageStep: "یا نسخه‌ی قابل‌حمل (بدونِ نصب):",
        launch: "سپس «Vault» را از منوی برنامه‌ها اجرا کن یا در ترمینال بنویس saleh-vault.",
        featuresTitle: "امکاناتِ نسخه‌ی بومی",
        securityTitle: "امنیتِ فوق‌العاده",
        buildTitle: "خودت بساز (از سورس)",
        buildSub: "به Node.js ۱۸+ نیاز داری. یک ‎.deb و AppImage در desktop/dist می‌سازد.",
        note: "همه‌چیز محلی است — رمزِ اصلی هیچ‌وقت دستگاه را ترک نمی‌کند. کدِ نسخه‌ی دسکتاپ متن‌باز است.",
        pwaNote: "ترجیح می‌دهی نصب نکنی؟ همان والت به‌صورتِ اپِ وب (PWA) هم نصب‌شدنی است.",
        openWeb: "بازکردنِ والتِ وب",
        source: "کدِ نسخه‌ی دسکتاپ",
        oneClick: "یک‌کلیک",
        copyHint: "برای کپی کلیک کن",
      }
    : {
        back: "Back",
        eyebrow: "Download",
        title: "Vault for Linux",
        sub: "The zero-knowledge password vault — as a native desktop app for Ubuntu, Kubuntu and any Debian-based distro.",
        version: `Version ${VERSION} · x64`,
        getDeb: "Download .deb",
        getAppimage: "Download AppImage",
        installTitle: "Install on Ubuntu / Kubuntu",
        debStep: "With .deb (recommended):",
        appimageStep: "Or the portable build (no install):",
        launch: "Then launch “Vault” from your apps menu, or run saleh-vault in a terminal.",
        featuresTitle: "Native app features",
        securityTitle: "Ultra-high security",
        buildTitle: "Build it yourself (from source)",
        buildSub: "Requires Node.js 18+. Produces a .deb and an AppImage in desktop/dist.",
        note: "Everything is local — your master password never leaves the device. The desktop build is open source.",
        pwaNote: "Prefer not to install? The same Vault is also installable as a web app (PWA).",
        openWeb: "Open web Vault",
        source: "Desktop source",
        oneClick: "one-click",
        copyHint: "click to copy",
      };

  const features = fa
    ? [
        ["🗂️", "سینی سیستم", "دسترسیِ سریع: نمایش، قفلِ فوری و خروج از سینی."],
        ["⌨️", "کلیدهای میان‌بُرِ سراسری", "Ctrl+Shift+L قفلِ فوری · Ctrl+Shift+V نمایش/پنهان."],
        ["🧭", "منو و میان‌بُرها", "قفل، بزرگ‌نمایی، تمام‌صفحه و خروج با شتاب‌دهنده."],
        ["🌘", "تمِ روشن/تیره", "هماهنگ با تمِ سیستم‌عاملت."],
        ["📴", "کارِ آفلاین", "پس از اولین اجرا، بدونِ اینترنت هم باز می‌شود."],
        ["🚀", "اجرای بومی", "مثلِ هر اپِ لینوکسی در منوی برنامه‌ها."],
      ]
    : [
        ["🗂️", "System tray", "Quick Show, instant Lock and Quit from the tray."],
        ["⌨️", "Global hotkeys", "Ctrl+Shift+L locks instantly · Ctrl+Shift+V toggles."],
        ["🧭", "Menu & shortcuts", "Lock, zoom, fullscreen and quit with accelerators."],
        ["🌘", "Light / dark", "Follows your OS colour scheme."],
        ["📴", "Works offline", "Opens with no internet after the first run."],
        ["🚀", "Native launch", "Appears in your apps menu like any Linux app."],
      ];

  const security = fa
    ? [
        ["🔒", "قفلِ خودکار", "هنگامِ خواب/قفلِ سیستم، بی‌کاری و ازدست‌رفتنِ فوکوس."],
        ["📋", "پاک‌سازیِ کلیپ‌بورد", "هنگامِ قفل و خروج، کلیپ‌بورد خالی می‌شود."],
        ["📸", "ضدِ اسکرین‌شات", "محافظت در برابرِ عکس/ضبطِ صفحه (در صورتِ پشتیبانی)."],
        ["🧱", "رندرِ سندباکس‌شده", "بدونِ Node، بدونِ IPC، بدونِ ناوبریِ خارج از مبدأ."],
        ["🚫", "ردِ همه‌ی مجوزها", "دوربین، میکروفون، موقعیت و اعلان‌ها رد می‌شوند."],
        ["🗝️", "کلیدفایلِ اختیاری", "فاکتورِ دومِ رمزنگاری در کنارِ رمزِ اصلی."],
      ]
    : [
        ["🔒", "Auto-lock", "On system suspend / screen-lock, idle, and blur timeout."],
        ["📋", "Clipboard wipe", "The clipboard is cleared on lock and on quit."],
        ["📸", "Anti-screenshot", "Blocks screen capture / recording where supported."],
        ["🧱", "Sandboxed renderer", "No Node, no IPC bridges, no off-origin navigation."],
        ["🚫", "Permission deny-all", "Camera, mic, geolocation and notifications refused."],
        ["🗝️", "Optional keyfile", "A cryptographic second factor beside your password."],
      ];

  const debCmd = `sudo apt install ./${DEB}`;
  const appImgCmd = `chmod +x ${APPIMAGE} && ./${APPIMAGE}`;
  const buildCmd = `git clone https://github.com/im-saleh/Saleh.im\ncd Saleh.im/desktop\nnpm install\nnpm run dist`;

  const Code = ({ text, k }: { text: string; k: string }) => (
    <div className="group relative overflow-hidden rounded-xl border" style={{ borderColor: "var(--line-2)", background: "var(--bg-3)" }}>
      <pre className="thin-scroll overflow-x-auto p-3.5 pe-12 text-sm leading-relaxed force-ltr">
        <code className="mono" style={{ color: "var(--fg)" }}>{text}</code>
      </pre>
      <button
        onClick={() => copy(text, k)}
        title={T.copyHint}
        className="absolute end-2 top-2 grid h-8 w-8 place-items-center rounded-lg border text-[var(--fg-2)] transition-colors hover:text-[var(--accent)]"
        style={{ borderColor: "var(--line-2)", background: "var(--bg-2)" }}
      >
        {copied === k ? (
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
        ) : (
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h8" /></svg>
        )}
      </button>
    </div>
  );

  return (
    <div className="min-h-[100dvh]">
      <header
        className="sticky top-0 z-40 flex items-center justify-between gap-3 border-b px-4 py-3 backdrop-blur-xl sm:px-6"
        style={{ borderColor: "var(--line)", background: "color-mix(in srgb, var(--bg) 80%, transparent)" }}
      >
        <div className="flex items-center gap-3">
          <Link href="/" className="mono text-sm text-[var(--fg-2)] hover:text-[var(--fg)]">← saleh.im</Link>
          <span className="hidden items-center gap-2.5 sm:flex">
            <Logo size={28} />
            <span className="font-display text-lg">Vault</span>
            <span className="text-xs text-[var(--fg-2)]">{T.eyebrow}</span>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/vault" className="hidden rounded-full border px-3 py-1.5 text-xs sm:block" style={{ borderColor: "var(--line-2)" }}>{T.openWeb}</Link>
          <button onClick={toggleMode} className="grid h-9 w-9 place-items-center rounded-full border" style={{ borderColor: "var(--line-2)" }} aria-label="theme">◑</button>
          <LangToggle />
        </div>
      </header>

      <main className="wrap py-10 sm:py-14">
        {/* hero */}
        <Reveal>
          <section className="panel elev frame-grad relative overflow-hidden p-6 sm:p-10">
            <div className="conic-sheen" aria-hidden style={{ opacity: 0.16 }} />
            <div className="pointer-events-none absolute -end-16 -top-16 h-56 w-56 rounded-full aurora floaty" style={{ background: "var(--accent)", opacity: 0.16 }} aria-hidden />
            <div className="relative flex flex-col items-start gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div className="max-w-xl">
                <div className="flex items-center gap-3">
                  <Logo size={52} />
                  <span className="chip">🐧 Linux · {T.version}</span>
                </div>
                <h1 className="display mt-5 text-4xl leading-[1.05] sm:text-5xl">{T.title}</h1>
                <p className="mt-4 text-[var(--fg-2)]">{T.sub}</p>
                <div className="mt-7 flex flex-wrap gap-3">
                  <a href={RELEASES} target="_blank" rel="noopener noreferrer" className="btn btn-accent px-5 py-3 text-base">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v12M7 10l5 5 5-5" /><path d="M4 21h16" /></svg>
                    {T.getDeb}
                  </a>
                  <a href={RELEASES} target="_blank" rel="noopener noreferrer" className="btn btn-outline px-5 py-3 text-base">{T.getAppimage}</a>
                </div>
                <p className="mono mt-3 flex items-center gap-2 text-xs text-[var(--fg-2)]">
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: "#22c55e" }} />
                  {T.note}
                </p>
              </div>
              <div className="relative hidden shrink-0 lg:block">
                <div className="grid h-40 w-40 place-items-center rounded-[2rem] border" style={{ borderColor: "var(--line-2)", background: "var(--bg-3)", boxShadow: "0 30px 70px -30px var(--shadow), 0 0 60px -30px var(--glow)" }}>
                  <Logo size={104} />
                </div>
              </div>
            </div>
          </section>
        </Reveal>

        {/* install */}
        <Reveal>
          <section className="panel elev mt-6 p-6 sm:p-8">
            <h2 className="font-display text-2xl">{T.installTitle}</h2>
            <div className="mt-5 grid gap-5 lg:grid-cols-2">
              <div>
                <p className="label mb-2">{T.debStep}</p>
                <Code text={debCmd} k="deb" />
                <p className="mt-3 text-sm text-[var(--fg-2)]">{T.launch}</p>
              </div>
              <div>
                <p className="label mb-2">{T.appimageStep}</p>
                <Code text={appImgCmd} k="appimg" />
              </div>
            </div>
          </section>
        </Reveal>

        {/* features + security */}
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <Reveal>
            <section className="panel elev h-full p-6 sm:p-8">
              <h2 className="font-display text-2xl">{T.featuresTitle}</h2>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {features.map(([icon, title, desc], i) => (
                  <div key={i} className="rounded-2xl border p-4 lift" style={{ borderColor: "var(--line)", background: "var(--bg-3)" }}>
                    <div className="text-2xl">{icon}</div>
                    <p className="mt-2 font-medium">{title}</p>
                    <p className="mt-0.5 text-xs text-[var(--fg-2)]">{desc}</p>
                  </div>
                ))}
              </div>
            </section>
          </Reveal>
          <Reveal>
            <section className="panel elev glow-border h-full p-6 sm:p-8">
              <h2 className="font-display text-2xl">🛡️ {T.securityTitle}</h2>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {security.map(([icon, title, desc], i) => (
                  <div key={i} className="rounded-2xl border p-4 lift" style={{ borderColor: "var(--line)", background: "var(--bg-3)" }}>
                    <div className="text-2xl">{icon}</div>
                    <p className="mt-2 font-medium">{title}</p>
                    <p className="mt-0.5 text-xs text-[var(--fg-2)]">{desc}</p>
                  </div>
                ))}
              </div>
            </section>
          </Reveal>
        </div>

        {/* build from source */}
        <Reveal>
          <section className="panel elev mt-6 p-6 sm:p-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-display text-2xl">{T.buildTitle}</h2>
              <a href={REPO_DESKTOP} target="_blank" rel="noopener noreferrer" className="btn btn-outline px-4 py-2 text-sm">{T.source} ↗</a>
            </div>
            <p className="mt-2 text-sm text-[var(--fg-2)]">{T.buildSub}</p>
            <div className="mt-4">
              <Code text={buildCmd} k="build" />
            </div>
          </section>
        </Reveal>

        <p className="mt-8 text-center text-sm text-[var(--fg-2)]">
          {T.pwaNote} <Link href="/vault" className="accent-text underline-offset-4 hover:underline">{T.openWeb} →</Link>
        </p>
      </main>
    </div>
  );
}
