import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Messenger — end-to-end encrypted chat",
  description:
    "A serverless, end-to-end encrypted messenger by Saleh. Peer-to-peer over WebRTC with keys that never leave your device — no accounts, no history, no middleman.",
  keywords: ["end-to-end encrypted", "messenger", "WebRTC", "peer-to-peer", "private chat", "E2EE", "Saleh"],
  alternates: { canonical: "https://saleh.im/messenger" },
  openGraph: {
    title: "Messenger — end-to-end encrypted chat",
    description: "Serverless, peer-to-peer, end-to-end encrypted. Keys never leave your device.",
    url: "https://saleh.im/messenger",
    type: "website",
  },
};

export default function MessengerLayout({ children }: { children: React.ReactNode }) {
  return children;
}
