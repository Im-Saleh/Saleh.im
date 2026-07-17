import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Lumen — privacy-first analytics",
  description:
    "Lumen turns raw events into clear, beautiful insight — a privacy-first, cookie-free analytics playground by Saleh. All computation happens in your browser.",
  keywords: ["privacy-first analytics", "cookieless analytics", "dashboards", "insights", "data visualization", "Saleh"],
  alternates: { canonical: "https://saleh.im/lumen" },
  openGraph: {
    title: "Lumen — privacy-first analytics",
    description: "Raw events into clear, beautiful insight. Cookie-free, computed in your browser.",
    url: "https://saleh.im/lumen",
    type: "website",
  },
};

export default function LumenLayout({ children }: { children: React.ReactNode }) {
  return children;
}
