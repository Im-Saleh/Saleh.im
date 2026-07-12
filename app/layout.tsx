import type { Metadata, Viewport } from "next";
import {
  Fraunces,
  Inter,
  JetBrains_Mono,
  Vazirmatn,
  Markazi_Text,
  Lalezar,
  Gulzar,
} from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { LangProvider } from "@/components/lang-provider";
import { NO_FLASH_SCRIPT } from "@/lib/themes";
import { NO_FLASH_LANG } from "@/lib/i18n";

/* ---- Latin type system ---- */
const inter = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
const display = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
  axes: ["SOFT", "WONK", "opsz"],
});
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono", display: "swap" });

/* ---- Persian type system (4 distinct faces) ---- */
const vazir = Vazirmatn({
  subsets: ["arabic"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-fa-sans",
  display: "swap",
  preload: false,
});
const markazi = Markazi_Text({
  subsets: ["arabic"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-fa-display",
  display: "swap",
  preload: false,
});
const lalezar = Lalezar({
  subsets: ["arabic"],
  weight: ["400"],
  variable: "--font-fa-accent",
  display: "swap",
  preload: false,
});
const gulzar = Gulzar({
  subsets: ["arabic"],
  weight: ["400"],
  variable: "--font-fa-nastaliq",
  display: "swap",
  preload: false,
});

const siteUrl = "https://saleh.im";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "Saleh Saghafiani — Software Engineer",
  description:
    "Portfolio & resume of Saleh Saghafiani (Saleh). Software engineer crafting fast, elegant products for the web — real-time tools and encrypted apps. Shipping since 2022.",
  keywords: ["Saleh Saghafiani", "Saleh", "software engineer", "React", "Next.js", "portfolio", "W2F-Sa"],
  authors: [{ name: "Saleh Saghafiani", url: "https://github.com/W2F-Sa" }],
  creator: "Saleh Saghafiani",
  openGraph: {
    title: "Saleh Saghafiani — Software Engineer",
    description:
      "Software engineer crafting fast, elegant products for the web. Shipping since 2022.",
    url: siteUrl,
    siteName: "saleh.im",
    type: "website",
  },
  icons: { icon: `${process.env.NEXT_PUBLIC_BASE_PATH || ""}/favicon.svg` },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const fontVars = [
    inter.variable,
    display.variable,
    mono.variable,
    vazir.variable,
    markazi.variable,
    lalezar.variable,
    gulzar.variable,
  ].join(" ");

  return (
    <html lang="en" dir="ltr" suppressHydrationWarning className={fontVars}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: NO_FLASH_SCRIPT }} />
        <script dangerouslySetInnerHTML={{ __html: NO_FLASH_LANG }} />
      </head>
      <body className="grain antialiased">
        <LangProvider>
          <ThemeProvider>{children}</ThemeProvider>
        </LangProvider>
      </body>
    </html>
  );
}
