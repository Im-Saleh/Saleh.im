import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Download Vault for Linux",
  description:
    "Download the native Linux build of Vault — a zero-knowledge password manager written in C++ with Qt6 and libsodium. Runs entirely offline.",
  keywords: ["Vault Linux", "download", "Qt6", "libsodium", "password manager", "deb package", "Saleh"],
  alternates: { canonical: "https://saleh.im/download" },
  openGraph: {
    title: "Download Vault for Linux",
    description: "Native Linux password manager — C++ · Qt6 · libsodium. Entirely offline.",
    url: "https://saleh.im/download",
    type: "website",
  },
};

export default function DownloadLayout({ children }: { children: React.ReactNode }) {
  return children;
}
