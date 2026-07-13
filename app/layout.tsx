import type { Metadata, Viewport } from "next";
import { Fraunces, Inter, JetBrains_Mono, Vazirmatn } from "next/font/google";
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

/* ---- Persian UI face (numbers, labels). The soft display/body/quote faces
       (Gandom, Shabnam, Samim) load from a CDN below and only download when
       Farsi is active. ---- */
const vazir = Vazirmatn({
  subsets: ["arabic"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-fa-ui",
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
    description: "Software engineer crafting fast, elegant products for the web. Shipping since 2022.",
    url: siteUrl,
    siteName: "saleh.im",
    type: "website",
  },
  icons: { icon: `${process.env.NEXT_PUBLIC_BASE_PATH || ""}/favicon.svg` },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

const FA_FONTS = [
  "https://cdn.jsdelivr.net/gh/rastikerdar/shabnam-font@v5.0.1/dist/font-face.css",
  "https://cdn.jsdelivr.net/gh/rastikerdar/samim-font@v4.0.5/dist/font-face.css",
  "https://cdn.jsdelivr.net/gh/rastikerdar/gandom-font@0.8/dist/font-face.css",
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const fontVars = [inter.variable, display.variable, mono.variable, vazir.variable].join(" ");

  return (
    <html lang="en" dir="ltr" suppressHydrationWarning className={fontVars}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: NO_FLASH_SCRIPT }} />
        <script dangerouslySetInnerHTML={{ __html: NO_FLASH_LANG }} />
        <link rel="preconnect" href="https://cdn.jsdelivr.net" crossOrigin="" />
        {FA_FONTS.map((href) => (
          <link key={href} rel="stylesheet" href={href} />
        ))}
      </head>
      <body className="grain antialiased">
        <LangProvider>
          <ThemeProvider>{children}</ThemeProvider>
        </LangProvider>
      </body>
    </html>
  );
}
