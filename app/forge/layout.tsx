import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Forge — developer toolbox",
  description:
    "Forge is a fast, private developer toolbox by Saleh — JSON formatter, Base64/URL/HTML/JWT tools, hashing, UUID/ULID generators, a colour studio, regex tester, cron explainer, diff, markdown preview and more. Everything runs in your browser.",
  keywords: [
    "developer tools",
    "json formatter",
    "base64",
    "jwt decoder",
    "regex tester",
    "hash generator",
    "uuid generator",
    "color contrast",
    "cron",
    "diff",
    "Saleh",
  ],
  alternates: { canonical: "https://saleh.im/forge" },
  openGraph: {
    title: "Forge — developer toolbox",
    description: "16 fast, private developer tools in one place. Everything runs in your browser.",
    url: "https://saleh.im/forge",
    type: "website",
  },
};

export default function ForgeLayout({ children }: { children: React.ReactNode }) {
  return children;
}
