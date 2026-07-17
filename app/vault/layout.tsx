import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Vault — zero-knowledge password manager",
  description:
    "A zero-knowledge password & secrets manager by Saleh. Everything is encrypted in your browser with Argon2id + XChaCha20-Poly1305 — no account, no cloud, no telemetry. Also available as a native Linux app.",
  keywords: ["password manager", "zero-knowledge", "Argon2id", "XChaCha20", "encrypted vault", "TOTP", "Saleh"],
  alternates: { canonical: "https://saleh.im/vault" },
  openGraph: {
    title: "Vault — zero-knowledge password manager",
    description: "Encrypted locally with Argon2id + XChaCha20-Poly1305. No account, no cloud, no telemetry.",
    url: "https://saleh.im/vault",
    type: "website",
  },
};

export default function VaultLayout({ children }: { children: React.ReactNode }) {
  return children;
}
