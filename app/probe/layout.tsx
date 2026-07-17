import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Probe — network & connection analyzer",
  description:
    "Probe your connection: public IP, geolocation, ISP, and a live analysis of your browser & network capabilities — a fast, private diagnostics tool by Saleh.",
  keywords: ["IP lookup", "network analyzer", "connection test", "geolocation", "browser capabilities", "Saleh"],
  alternates: { canonical: "https://saleh.im/probe" },
  openGraph: {
    title: "Probe — network & connection analyzer",
    description: "Public IP, geolocation, ISP and a live read-out of your browser & network.",
    url: "https://saleh.im/probe",
    type: "website",
  },
};

export default function ProbeLayout({ children }: { children: React.ReactNode }) {
  return children;
}
