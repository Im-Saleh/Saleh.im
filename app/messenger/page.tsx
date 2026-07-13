"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useLang } from "@/components/lang-provider";
import { useThemeScene } from "@/components/theme-provider";
import { LangToggle } from "@/components/lang-toggle";
import { BASE_PATH } from "@/lib/data";
import {
  deriveShared,
  deriveVaultKey,
  exportPub,
  genECDH,
  open as openSeal,
  safetyNumber,
  sanitize,
  seal,
  sha256Hex,
  vaultDecrypt,
  vaultEncrypt,
  type SessionKeys,
  type Vault,
} from "@/lib/messenger/crypto";

type Reactions = Record<string, { me: boolean; them: boolean }>;
type Reply = { id: string; preview: string; mine: boolean } | null;
type Msg = {
  id: string;
  mine: boolean;
  kind: "text" | "image" | "system";
  text?: string;
  dataUrl?: string;
  ts: number;
  status?: "sent" | "seen";
  reply?: Reply;
  reactions?: Reactions;
};
type Convo = { peer: string; handle: string; name: string; messages: Msg[]; unread: number; typing: boolean };
type ConnState = { conn: any; keyPair?: CryptoKeyPair; keys?: SessionKeys; ready: boolean; handle: string };

/* WebAudio blip */
function blip(kind: "in" | "out") {
  try {
    const Ctx = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext;
    const ctx = new Ctx();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g);
    g.connect(ctx.destination);
    o.frequency.value = kind === "in" ? 620 : 880;
    o.type = "sine";
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.05, ctx.currentTime + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.16);
    o.start();
    o.stop(ctx.currentTime + 0.18);
    o.onended = () => ctx.close();
  } catch {}
}

const EMOJI = ["👍", "❤️", "🔥", "😂", "🎉", "🙏", "✅", "👀"];

const urlRe = /(https?:\/\/[^\s]+)/g;
function Linkify({ text }: { text: string }) {
  const parts = text.split(urlRe);
  return (
    <>
      {parts.map((p, i) =>
        urlRe.test(p) ? (
          <a key={i} href={p} target="_blank" rel="noopener noreferrer" className="underline decoration-2 underline-offset-2 opacity-90">
            {p}
          </a>
        ) : (
          <span key={i}>{p}</span>
        )
      )}
    </>
  );
}

const peerIdFromHandle = (u: string, tag: string) => `cipher-${sanitize(u)}-${tag}`;
const contextFor = (a: string, b: string) => [a, b].sort().join("|");

function parseTarget(raw: string): { user: string; tag: string; peerId: string; handle: string } | null {
  let s = raw.trim();
  const m = s.match(/[?&]to=([^&]+)/);
  if (m) s = decodeURIComponent(m[1]);
  s = s.replace(/^@/, "").trim();
  const parts = s.split("#");
  if (parts.length === 2 && parts[0] && /^[0-9a-f]{3,8}$/i.test(parts[1])) {
    const user = sanitize(parts[0]);
    const tag = parts[1].toLowerCase();
    if (!user) return null;
    return { user, tag, peerId: peerIdFromHandle(user, tag), handle: `${parts[0].trim()}#${tag}` };
  }
  return null;
}

export default function MessengerPage() {
  const { lang } = useLang();
  const { toggleMode } = useThemeScene();
  const fa = lang === "fa";

  const [stage, setStage] = useState<"auth" | "chat">("auth");
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const [handle, setHandle] = useState("");
  const [tagPreview, setTagPreview] = useState("");
  const [status, setStatus] = useState<"offline" | "connecting" | "online">("offline");
  const [convos, setConvos] = useState<Record<string, Convo>>({});
  const [active, setActive] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [peerInput, setPeerInput] = useState("");
  const [connectErr, setConnectErr] = useState("");
  const [showSidebar, setShowSidebar] = useState(true);
  const [copied, setCopied] = useState("");
  const [soundOn, setSoundOn] = useState(true);
  const [replyTo, setReplyTo] = useState<Msg | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [showSafety, setShowSafety] = useState(false);
  const [verified, setVerified] = useState<Record<string, boolean>>({});
  const [latency, setLatency] = useState<Record<string, number>>({});
  const [atBottom, setAtBottom] = useState(true);
  const [reactFor, setReactFor] = useState<string | null>(null);

  const peerRef = useRef<any>(null);
  const connsRef = useRef<Record<string, ConnState>>({});
  const vaultRef = useRef<Vault | null>(null);
  const activeRef = useRef<string | null>(null);
  const meRef = useRef({ user: "", tag: "", handle: "", id: "" });
  const soundRef = useRef(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const typingTimer = useRef<Record<string, any>>({});
  const pingTimer = useRef<Record<string, any>>({});
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    activeRef.current = active;
  }, [active]);
  useEffect(() => {
    soundRef.current = soundOn;
  }, [soundOn]);

  // live tag preview on auth screen
  useEffect(() => {
    if (user.trim().length >= 3 && pass.length >= 4) {
      sha256Hex(sanitize(user) + ":" + pass).then((h) => setTagPreview(h.slice(0, 4)));
    } else setTagPreview("");
  }, [user, pass]);

  const scrollToBottom = useCallback((smooth = false) => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "auto" });
  }, []);

  useEffect(() => {
    if (atBottom) scrollToBottom();
  }, [convos, active, atBottom, scrollToBottom]);

  const T = fa
    ? {
        title: "Cipher",
        tag: "پیام‌رسانِ رمزنگاری‌شده‌ی همتا‌به‌همتا",
        u: "نام کاربری",
        p: "رمز عبور",
        go: "ورود و آنلاین‌شدن",
        yourHandle: "هندلِ تو",
        handleNote: "هرکسی می‌تواند نام «saleh» را بردارد؛ اما تگِ یکتای تو (که از رمزت ساخته می‌شود) هندل را مالِ تو می‌کند. برای اتصال، هندلِ کامل یا لینکِ دعوت را بفرست.",
        note: "شناسه‌ات محلی از نام و رمز ساخته می‌شود؛ تاریخچه با رمزِ تو روی همین دستگاه رمز می‌شود. هیچ‌چیز آپلود نمی‌شود.",
        online: "آنلاین",
        connecting: "در حال اتصال…",
        offline: "آفلاین",
        connect: "اتصال",
        peerPh: "هندلِ طرف مقابل — مثل sara#1b9c",
        badHandle: "هندلِ کامل را وارد کن، مثل sara#1b9c",
        share: "کپیِ لینکِ دعوت",
        copyHandle: "کپیِ هندل",
        copied: "کپی شد!",
        convos: "گفتگوها",
        none: "هنوز گفتگویی نیست.",
        emptyTitle: "یک کانالِ امن باز کن",
        emptyBody: "هندلِ یک نفر را وارد کن تا مستقیم و رمزنگاری‌شده چت کنید.",
        typeMsg: "یک پیام بنویس…",
        secured: "با ۴ لایه رمزنگاری محافظت می‌شود",
        typing: "در حال نوشتن…",
        established: "کانالِ امن برقرار شد با",
        left: "قطع شد",
        clear: "پاک‌کردن گفتگو",
        signout: "خروج",
        today: "امروز",
        yesterday: "دیروز",
        seen: "دیده شد",
        sound: "صدا",
        reply: "پاسخ",
        react: "واکنش",
        del: "حذف برای من",
        safety: "شماره‌ی امنیتی",
        safetyNote: "اگر این عدد نزد هر دو نفر یکسان است، کانالِ شما امن و بدونِ شنود است.",
        verify: "تأیید می‌کنم",
        verified: "تأییدشده",
        search: "جستجو در گفتگو…",
        newMsgs: "پیام‌های جدید",
        ping: "میلی‌ثانیه",
        replyingTo: "در پاسخ به",
      }
    : {
        title: "Cipher",
        tag: "End-to-end encrypted peer-to-peer messenger",
        u: "Username",
        p: "Password",
        go: "Sign in & go online",
        yourHandle: "Your handle",
        handleNote: "Anyone can pick the name “saleh” — but your unique tag (derived from your password) makes the handle yours. Share your full handle or invite link to connect.",
        note: "Your ID is derived locally from your name + password; history is encrypted with your password on this device. Nothing is uploaded.",
        online: "online",
        connecting: "connecting…",
        offline: "offline",
        connect: "Connect",
        peerPh: "friend's handle — e.g. sara#1b9c",
        badHandle: "Enter a full handle, e.g. sara#1b9c",
        share: "Copy invite link",
        copyHandle: "Copy handle",
        copied: "Copied!",
        convos: "Conversations",
        none: "No conversations yet.",
        emptyTitle: "Open a secure channel",
        emptyBody: "Enter someone's handle to start a direct, encrypted chat.",
        typeMsg: "Type a message…",
        secured: "Protected by 4 layers of encryption",
        typing: "typing…",
        established: "Secure channel established with",
        left: "disconnected",
        clear: "Clear conversation",
        signout: "Sign out",
        today: "Today",
        yesterday: "Yesterday",
        seen: "Seen",
        sound: "Sound",
        reply: "Reply",
        react: "React",
        del: "Delete for me",
        safety: "Safety number",
        safetyNote: "If this number matches on both sides, your channel is secure and free of eavesdroppers.",
        verify: "Mark as verified",
        verified: "Verified",
        search: "Search this conversation…",
        newMsgs: "New messages",
        ping: "ms",
        replyingTo: "Replying to",
      };

  const nameOf = (c: Convo) => c.handle.split("#")[0];

  const storeKey = (peer: string) => `cipher:hist:${meRef.current.handle}:${peer}`;
  const verifKey = () => `cipher:verified:${meRef.current.handle}`;

  const saveConvo = useCallback(async (peer: string, c: Convo) => {
    if (!vaultRef.current) return;
    try {
      const persist = c.messages.filter((m) => m.kind !== "system").slice(-250);
      localStorage.setItem(storeKey(peer), await vaultEncrypt(vaultRef.current, { handle: c.handle, messages: persist }));
    } catch {}
  }, []);

  const upsert = useCallback(
    (peer: string, updater: (c: Convo) => Convo, persist = true) => {
      setConvos((prev) => {
        const cur = prev[peer] || { peer, handle: connsRef.current[peer]?.handle || peer, name: peer, messages: [], unread: 0, typing: false };
        const next = updater({ ...cur, messages: [...cur.messages] });
        if (persist) saveConvo(peer, next);
        return { ...prev, [peer]: next };
      });
    },
    [saveConvo]
  );

  const addMsg = useCallback(
    (peer: string, msg: Msg) => {
      upsert(peer, (c) => {
        const isActive = activeRef.current === peer;
        return { ...c, messages: [...c.messages, msg], unread: msg.mine || isActive ? c.unread : c.unread + 1, typing: false };
      });
      if (!msg.mine && msg.kind !== "system" && soundRef.current) blip("in");
    },
    [upsert]
  );

  const send = (peer: string, obj: any) => {
    const cs = connsRef.current[peer];
    if (cs?.conn?.open) cs.conn.send(JSON.stringify(obj));
  };

  const beginHandshake = useCallback(async (peer: string) => {
    const cs = connsRef.current[peer];
    if (!cs) return;
    cs.keyPair = await genECDH();
    send(peer, { t: "hs", pub: await exportPub(cs.keyPair), handle: meRef.current.handle });
  }, []);

  const startPing = useCallback((peer: string) => {
    clearInterval(pingTimer.current[peer]);
    pingTimer.current[peer] = setInterval(() => send(peer, { t: "ping", ts: Date.now() }), 4000);
  }, []);

  const onData = useCallback(
    async (peer: string, raw: any) => {
      let data: any;
      try {
        data = JSON.parse(raw);
      } catch {
        return;
      }
      const cs = connsRef.current[peer];
      if (!cs) return;

      if (data.t === "hs") {
        if (data.handle) cs.handle = data.handle;
        if (!cs.keyPair) cs.keyPair = await genECDH();
        try {
          cs.keys = await deriveShared(cs.keyPair, data.pub, contextFor(meRef.current.handle, cs.handle));
          cs.ready = true;
          upsert(peer, (c) => ({ ...c, handle: cs.handle, name: cs.handle.split("#")[0], messages: [...c.messages, { id: crypto.randomUUID(), mine: false, kind: "system", text: `🔒 ${T.established} ${cs.handle}`, ts: Date.now() }] }), false);
          startPing(peer);
        } catch {}
      } else if (data.t === "msg" && cs.keys) {
        try {
          const text = await openSeal(cs.keys, data.c);
          addMsg(peer, { id: data.id || crypto.randomUUID(), mine: false, kind: data.kind === "image" ? "image" : "text", text: data.kind === "image" ? undefined : text, dataUrl: data.kind === "image" ? text : undefined, ts: Date.now(), reply: data.reply || null });
          if (activeRef.current === peer) send(peer, { t: "seen" });
        } catch {}
      } else if (data.t === "typing") {
        upsert(peer, (c) => ({ ...c, typing: !!data.on }), false);
      } else if (data.t === "seen") {
        upsert(peer, (c) => ({ ...c, messages: c.messages.map((m) => (m.mine ? { ...m, status: "seen" } : m)) }));
      } else if (data.t === "react") {
        upsert(peer, (c) => ({
          ...c,
          messages: c.messages.map((m) => {
            if (m.id !== data.id) return m;
            const r: Reactions = { ...(m.reactions || {}) };
            const e = data.emoji;
            r[e] = { me: r[e]?.me || false, them: !!data.on };
            if (!r[e].me && !r[e].them) delete r[e];
            return { ...m, reactions: r };
          }),
        }));
      } else if (data.t === "ping") {
        send(peer, { t: "pong", ts: data.ts });
      } else if (data.t === "pong") {
        setLatency((l) => ({ ...l, [peer]: Date.now() - data.ts }));
      }
    },
    [addMsg, upsert, startPing, T.established]
  );

  const wireConn = useCallback(
    (conn: any) => {
      const peer = conn.peer;
      connsRef.current[peer] = connsRef.current[peer] || { conn, ready: false, handle: peer };
      connsRef.current[peer].conn = conn;
      conn.on("open", () => {
        setConvos((prev) => (prev[peer] ? prev : { ...prev, [peer]: { peer, handle: connsRef.current[peer].handle, name: connsRef.current[peer].handle.split("#")[0], messages: [], unread: 0, typing: false } }));
        setActive((a) => a ?? peer);
        beginHandshake(peer);
      });
      conn.on("data", (raw: any) => onData(peer, raw));
      conn.on("close", () => {
        if (connsRef.current[peer]) connsRef.current[peer].ready = false;
        clearInterval(pingTimer.current[peer]);
        setLatency((l) => {
          const n = { ...l };
          delete n[peer];
          return n;
        });
        upsert(peer, (c) => ({ ...c, messages: [...c.messages, { id: crypto.randomUUID(), mine: false, kind: "system", text: `⚠︎ ${c.handle} ${T.left}`, ts: Date.now() }] }), false);
      });
      conn.on("error", () => {});
    },
    [beginHandshake, onData, upsert, T.left]
  );

  const connectTo = useCallback(
    (raw: string) => {
      setConnectErr("");
      const tgt = parseTarget(raw);
      if (!tgt) {
        setConnectErr(T.badHandle);
        return;
      }
      if (!peerRef.current || tgt.peerId === meRef.current.id) return;
      connsRef.current[tgt.peerId] = connsRef.current[tgt.peerId] || { conn: null, ready: false, handle: tgt.handle };
      connsRef.current[tgt.peerId].handle = tgt.handle;
      const conn = peerRef.current.connect(tgt.peerId, { reliable: true });
      wireConn(conn);
      setConvos((prev) => (prev[tgt.peerId] ? prev : { ...prev, [tgt.peerId]: { peer: tgt.peerId, handle: tgt.handle, name: tgt.handle.split("#")[0], messages: [], unread: 0, typing: false } }));
      setActive(tgt.peerId);
      setShowSidebar(false);
    },
    [wireConn, T.badHandle]
  );

  const boot = useCallback(async () => {
    const mod = await import("peerjs");
    const Peer: any = mod.default;
    const primary = meRef.current.id;
    const mk = (id: string) =>
      new Peer(id, {
        debug: 1,
        config: { iceServers: [{ urls: "stun:stun.l.google.com:19302" }, { urls: "stun:global.stun.twilio.com:3478" }] },
      });
    setStatus("connecting");
    const attach = (peer: any) => {
      peer.on("open", () => {
        setStatus("online");
        const to = new URLSearchParams(window.location.search).get("to");
        if (to) setTimeout(() => connectTo(to), 500);
      });
      peer.on("connection", (conn: any) => wireConn(conn));
      peer.on("error", (err: any) => {
        if (err?.type === "unavailable-id") {
          // already online elsewhere with this exact handle — attach a private suffix
          const np = mk(primary + "-" + Math.random().toString(36).slice(2, 5));
          peerRef.current = np;
          attach(np);
        } else setStatus("connecting");
      });
    };
    const p = mk(primary);
    peerRef.current = p;
    attach(p);
  }, [connectTo, wireConn]);

  const loadHistory = useCallback(async () => {
    if (!vaultRef.current) return;
    const prefix = `cipher:hist:${meRef.current.handle}:`;
    const loaded: Record<string, Convo> = {};
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(prefix)) {
        const peer = k.slice(prefix.length);
        try {
          const data = await vaultDecrypt<{ handle: string; messages: Msg[] }>(vaultRef.current, localStorage.getItem(k) as string);
          const h = data.handle || peer;
          loaded[peer] = { peer, handle: h, name: h.split("#")[0], messages: data.messages || [], unread: 0, typing: false };
          connsRef.current[peer] = connsRef.current[peer] || { conn: null, ready: false, handle: h };
        } catch {}
      }
    }
    if (Object.keys(loaded).length) setConvos((prev) => ({ ...loaded, ...prev }));
    try {
      const v = localStorage.getItem(verifKey());
      if (v) setVerified(JSON.parse(v));
    } catch {}
  }, []);

  const signIn = async (e: React.FormEvent) => {
    e.preventDefault();
    const u = user.trim();
    if (u.length < 3 || pass.length < 4) return;
    const tag = (await sha256Hex(sanitize(u) + ":" + pass)).slice(0, 4);
    meRef.current = { user: u, tag, handle: `${u}#${tag}`, id: peerIdFromHandle(u, tag) };
    setHandle(meRef.current.handle);
    const saltKey = `cipher:salt:${meRef.current.handle}`;
    let salt: string | undefined;
    try {
      salt = localStorage.getItem(saltKey) || undefined;
    } catch {}
    vaultRef.current = await deriveVaultKey(pass, salt);
    try {
      if (!salt) localStorage.setItem(saltKey, vaultRef.current.salt);
    } catch {}
    setStage("chat");
    await loadHistory();
    await boot();
  };

  const sendText = async () => {
    const text = input.trim();
    const cs = active ? connsRef.current[active] : null;
    if (!text || !active || !cs?.keys || !cs.conn?.open) return;
    setInput("");
    const id = crypto.randomUUID();
    const reply: Reply = replyTo ? { id: replyTo.id, preview: (replyTo.text || "🖼️").slice(0, 70), mine: replyTo.mine } : null;
    setReplyTo(null);
    try {
      send(active, { t: "msg", id, kind: "text", c: await seal(cs.keys, text), reply });
      addMsg(active, { id, mine: true, kind: "text", text, ts: Date.now(), status: "sent", reply });
      if (soundRef.current) blip("out");
    } catch {}
  };

  const sendImage = async (file: File) => {
    const cs = active ? connsRef.current[active] : null;
    if (!file || !active || !cs?.keys || !cs.conn?.open) return;
    if (file.size > 400_000) {
      alert(fa ? "تصویر باید کمتر از ۴۰۰ کیلوبایت باشد." : "Image must be under 400 KB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result as string;
      const id = crypto.randomUUID();
      try {
        send(active, { t: "msg", id, kind: "image", c: await seal(cs.keys!, dataUrl) });
        addMsg(active, { id, mine: true, kind: "image", dataUrl, ts: Date.now(), status: "sent" });
      } catch {}
    };
    reader.readAsDataURL(file);
  };

  const react = (msg: Msg, emoji: string) => {
    if (!active) return;
    setReactFor(null);
    const on = !msg.reactions?.[emoji]?.me;
    send(active, { t: "react", id: msg.id, emoji, on });
    upsert(active, (c) => ({
      ...c,
      messages: c.messages.map((m) => {
        if (m.id !== msg.id) return m;
        const r: Reactions = { ...(m.reactions || {}) };
        r[emoji] = { me: on, them: r[emoji]?.them || false };
        if (!r[emoji].me && !r[emoji].them) delete r[emoji];
        return { ...m, reactions: r };
      }),
    }));
  };

  const deleteMsg = (msg: Msg) => {
    if (!active) return;
    upsert(active, (c) => ({ ...c, messages: c.messages.filter((m) => m.id !== msg.id) }));
  };

  const onType = () => {
    if (!active) return;
    send(active, { t: "typing", on: true });
    clearTimeout(typingTimer.current[active]);
    typingTimer.current[active] = setTimeout(() => send(active, { t: "typing", on: false }), 1500);
  };

  const openConvo = (peer: string) => {
    setActive(peer);
    setShowSidebar(false);
    setSearchOpen(false);
    setQuery("");
    setAtBottom(true);
    upsert(peer, (c) => ({ ...c, unread: 0 }), false);
    if (connsRef.current[peer]?.conn?.open) send(peer, { t: "seen" });
  };

  const clearConvo = () => {
    if (!active) return;
    try {
      localStorage.removeItem(storeKey(active));
    } catch {}
    upsert(active, (c) => ({ ...c, messages: [] }), false);
  };

  const markVerified = () => {
    if (!active) return;
    const h = connsRef.current[active]?.handle;
    if (!h) return;
    setVerified((v) => {
      const n = { ...v, [h]: true };
      try {
        localStorage.setItem(verifKey(), JSON.stringify(n));
      } catch {}
      return n;
    });
    setShowSafety(false);
  };

  const copy = (text: string, key: string) => {
    navigator.clipboard?.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(""), 1600);
  };

  const signOut = () => {
    try {
      peerRef.current?.destroy();
    } catch {}
    location.reload();
  };

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    setAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 80);
  };

  const dayLabel = (ts: number) => {
    const d = new Date(ts);
    const today = new Date();
    const y = new Date();
    y.setDate(today.getDate() - 1);
    const same = (a: Date, b: Date) => a.toDateString() === b.toDateString();
    if (same(d, today)) return T.today;
    if (same(d, y)) return T.yesterday;
    return new Intl.DateTimeFormat(fa ? "fa-IR" : "en-GB", { day: "numeric", month: "short" }).format(d);
  };
  const time = (ts: number) => new Intl.DateTimeFormat(fa ? "fa-IR" : "en-GB", { hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(ts));

  const convoList = useMemo(
    () =>
      Object.values(convos).sort((a, b) => (b.messages[b.messages.length - 1]?.ts || 0) - (a.messages[a.messages.length - 1]?.ts || 0)),
    [convos]
  );
  const cur = active ? convos[active] : null;
  const curCs = active ? connsRef.current[active] : null;
  const curReady = curCs?.ready;
  const curFp = curCs?.keys?.fingerprint || "";
  const curVerified = curCs ? verified[curCs.handle] : false;
  const curLat = active ? latency[active] : undefined;
  const shown = cur ? (query.trim() ? cur.messages.filter((m) => (m.text || "").toLowerCase().includes(query.toLowerCase())) : cur.messages) : [];

  /* ================= AUTH ================= */
  if (stage === "auth") {
    return (
      <div className="relative flex min-h-[100dvh] items-center justify-center overflow-hidden px-5">
        <div className="pointer-events-none absolute inset-0 dotfield" aria-hidden />
        <div className="aurora left-[14%] top-[10%] h-72 w-72" style={{ background: "var(--accent)" }} aria-hidden />
        <div className="absolute inset-x-0 top-0 z-20 flex items-center justify-between p-4">
          <Link href="/" className="mono rounded-full border px-3 py-1.5 text-xs text-[var(--fg-2)] backdrop-blur hover:text-[var(--fg)]" style={{ borderColor: "var(--line-2)" }}>← saleh.im</Link>
          <div className="flex items-center gap-2">
            <button onClick={toggleMode} className="grid h-9 w-9 place-items-center rounded-full border" style={{ borderColor: "var(--line-2)" }}>◑</button>
            <LangToggle />
          </div>
        </div>
        <div className="panel elev relative w-full max-w-md p-8">
          <div className="mb-6 flex items-center gap-3">
            <span className="grid h-12 w-12 place-items-center rounded-2xl text-2xl" style={{ background: "var(--accent)", color: "var(--on-accent)" }}>◆</span>
            <div>
              <h1 className="display text-3xl">{T.title}</h1>
              <p className="text-xs text-[var(--fg-2)]">{T.tag}</p>
            </div>
          </div>
          <form onSubmit={signIn} className="grid gap-4" autoComplete="off">
            <label className="grid gap-2 text-sm text-[var(--fg-2)]">
              {T.u}
              <input value={user} onChange={(e) => setUser(e.target.value)} minLength={3} maxLength={24} required className="rounded-xl border px-4 py-3 text-[var(--fg)] outline-none force-ltr" style={{ background: "var(--bg-3)", borderColor: "var(--line)" }} placeholder="saleh" />
            </label>
            <label className="grid gap-2 text-sm text-[var(--fg-2)]">
              {T.p}
              <input type="password" value={pass} onChange={(e) => setPass(e.target.value)} minLength={4} required className="rounded-xl border px-4 py-3 text-[var(--fg)] outline-none force-ltr" style={{ background: "var(--bg-3)", borderColor: "var(--line)" }} placeholder="••••••" />
            </label>
            {tagPreview && (
              <div className="rounded-xl border p-3 text-sm" style={{ borderColor: "var(--line)", background: "var(--bg-3)" }}>
                <span className="text-[var(--fg-2)]">{T.yourHandle}: </span>
                <b className="mono force-ltr" style={{ color: "var(--accent)" }}>{sanitize(user)}#{tagPreview}</b>
              </div>
            )}
            <button type="submit" className="btn btn-accent mt-1">{T.go}</button>
            <p className="text-xs leading-relaxed text-[var(--fg-2)]">{T.handleNote}</p>
          </form>
          <div className="mt-6 flex flex-wrap gap-2 border-t pt-5" style={{ borderColor: "var(--line)" }}>
            {["ECDH P-256", "AES-256-GCM ×2", "HMAC-SHA256", "PBKDF2 310k"].map((c) => (
              <span key={c} className="mono rounded-lg border px-2.5 py-1 text-[10px] force-ltr" style={{ borderColor: "var(--line-2)", color: "var(--accent)" }}>{c}</span>
            ))}
          </div>
        </div>
      </div>
    );
  }

  /* ================= CHAT ================= */
  return (
    <div className="flex h-[100dvh] flex-col">
      <header className="flex items-center justify-between gap-3 border-b px-4 py-3" style={{ borderColor: "var(--line)", background: "var(--bg-2)" }}>
        <div className="flex items-center gap-3">
          <Link href="/" className="mono text-sm text-[var(--fg-2)] hover:text-[var(--fg)]">← saleh.im</Link>
          <span className="hidden items-center gap-2 sm:flex">
            <span className="grid h-7 w-7 place-items-center rounded-lg text-sm" style={{ background: "var(--accent)", color: "var(--on-accent)" }}>◆</span>
            <span className="font-display text-lg">{T.title}</span>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setSoundOn((s) => !s)} title={T.sound} className="grid h-9 w-9 place-items-center rounded-full border" style={{ borderColor: "var(--line-2)", opacity: soundOn ? 1 : 0.5 }}>{soundOn ? "🔔" : "🔕"}</button>
          <button onClick={toggleMode} className="grid h-9 w-9 place-items-center rounded-full border" style={{ borderColor: "var(--line-2)" }}>◑</button>
          <LangToggle />
          <button onClick={signOut} className="btn btn-outline h-9 px-4 py-0 text-sm">{T.signout}</button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* sidebar */}
        <aside className={`${showSidebar ? "flex" : "hidden"} w-full flex-col border-e sm:flex sm:w-80 sm:shrink-0`} style={{ borderColor: "var(--line)", background: "var(--bg-2)" }}>
          <div className="border-b p-4" style={{ borderColor: "var(--line)" }}>
            <div className="mb-3 flex items-center justify-between rounded-xl border p-2.5" style={{ borderColor: "var(--line)", background: "var(--bg-3)" }}>
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-xs text-[var(--fg-2)]">
                  <span className="h-2 w-2 rounded-full" style={{ background: status === "online" ? "#27c93f" : "#eab308", boxShadow: status === "online" ? "0 0 8px #27c93f" : "none" }} />
                  {status === "online" ? T.online : status === "connecting" ? T.connecting : T.offline}
                </div>
                <b className="mono block truncate text-sm force-ltr" style={{ color: "var(--accent)" }}>{handle}</b>
              </div>
              <div className="flex shrink-0 gap-1">
                <button onClick={() => copy(handle, "h")} className="tip rounded-lg border px-2 py-1 text-xs" style={{ borderColor: "var(--line-2)" }} data-tip={T.copyHandle}>{copied === "h" ? "✓" : "@"}</button>
                <button onClick={() => copy(`${window.location.origin}${BASE_PATH}/messenger/?to=${encodeURIComponent(handle)}`, "l")} className="tip rounded-lg border px-2 py-1 text-xs" style={{ borderColor: "var(--line-2)" }} data-tip={T.share}>{copied === "l" ? "✓" : "🔗"}</button>
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-xl border p-1.5" style={{ borderColor: "var(--line)", background: "var(--bg-3)" }}>
              <input value={peerInput} onChange={(e) => { setPeerInput(e.target.value); setConnectErr(""); }} onKeyDown={(e) => e.key === "Enter" && peerInput.trim() && (connectTo(peerInput.trim()), setPeerInput(""))} placeholder={T.peerPh} className="min-w-0 flex-1 bg-transparent px-2 text-sm outline-none force-ltr" />
              <button onClick={() => peerInput.trim() && connectTo(peerInput.trim())} className="btn btn-accent px-4 py-2 text-sm">{T.connect}</button>
            </div>
            {connectErr && <p className="mt-2 text-xs" style={{ color: "#ff6a6a" }}>{connectErr}</p>}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-2 thin-scroll">
            <p className="label px-2 py-2">{T.convos}</p>
            {convoList.length === 0 && <p className="px-3 text-sm text-[var(--fg-2)]">{T.none}</p>}
            {convoList.map((c) => {
              const last = c.messages[c.messages.length - 1];
              const on = connsRef.current[c.peer]?.conn?.open;
              return (
                <button key={c.peer} onClick={() => openConvo(c.peer)} className="flex w-full items-center gap-3 rounded-xl p-2.5 text-start transition-colors" style={{ background: active === c.peer ? "var(--bg-3)" : "transparent" }}>
                  <span className="relative grid h-11 w-11 shrink-0 place-items-center rounded-full font-display text-lg uppercase" style={{ background: "var(--bg-3)", border: "1px solid var(--line)" }}>
                    {nameOf(c).charAt(0)}
                    <span className="absolute -bottom-0 -end-0 h-3 w-3 rounded-full border-2" style={{ background: on ? "#27c93f" : "#71717a", borderColor: "var(--bg-2)" }} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <b className="truncate text-sm force-ltr">{c.handle}</b>
                      {last && <span className="mono shrink-0 text-[10px] text-[var(--fg-2)]">{time(last.ts)}</span>}
                    </span>
                    <span className="mt-0.5 flex items-center justify-between gap-2">
                      <span className="truncate text-xs text-[var(--fg-2)]">{c.typing ? T.typing : last ? (last.kind === "image" ? "🖼️" : last.text) : "…"}</span>
                      {c.unread > 0 && <span className="grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-[10px] font-bold" style={{ background: "var(--accent)", color: "var(--on-accent)" }}>{c.unread}</span>}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </aside>

        {/* chat */}
        <main className={`${showSidebar ? "hidden" : "flex"} relative min-w-0 flex-1 flex-col sm:flex`}>
          {!cur ? (
            <div className="grid flex-1 place-items-center p-8 text-center">
              <div className="max-w-sm">
                <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-2xl text-3xl" style={{ background: "var(--bg-2)", border: "1px solid var(--line)", color: "var(--accent)" }}>◆</div>
                <h2 className="font-display text-2xl">{T.emptyTitle}</h2>
                <p className="mt-2 text-[var(--fg-2)]">{T.emptyBody}</p>
              </div>
            </div>
          ) : (
            <>
              {/* chat header */}
              <div className="flex items-center justify-between gap-3 border-b px-4 py-3" style={{ borderColor: "var(--line)", background: "var(--bg-2)" }}>
                <div className="flex min-w-0 items-center gap-3">
                  <button onClick={() => setShowSidebar(true)} className="grid h-9 w-9 shrink-0 place-items-center rounded-full border sm:hidden" style={{ borderColor: "var(--line-2)" }}>←</button>
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full font-display text-lg uppercase" style={{ background: "var(--bg-3)", border: "1px solid var(--line)" }}>{nameOf(cur).charAt(0)}</span>
                  <div className="min-w-0">
                    <b className="flex items-center gap-1.5 truncate text-sm force-ltr">
                      {cur.handle}
                      {curVerified && <span title={T.verified} style={{ color: "var(--accent)" }}>✔</span>}
                    </b>
                    <span className="flex items-center gap-1.5 text-xs text-[var(--fg-2)]">
                      <span className="h-1.5 w-1.5 rounded-full" style={{ background: curReady ? "#27c93f" : "#eab308" }} />
                      {curReady ? T.secured : T.connecting}
                      {curLat != null && <span className="mono">· {curLat}{T.ping}</span>}
                    </span>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <button onClick={() => { setSearchOpen((s) => !s); setQuery(""); }} className="grid h-9 w-9 place-items-center rounded-full border" style={{ borderColor: "var(--line-2)" }} title="search">🔍</button>
                  {curFp && <button onClick={() => setShowSafety((s) => !s)} className="grid h-9 w-9 place-items-center rounded-full border" style={{ borderColor: curVerified ? "var(--accent)" : "var(--line-2)" }} title={T.safety}>🛡</button>}
                  <button onClick={clearConvo} className="grid h-9 w-9 place-items-center rounded-full border" style={{ borderColor: "var(--line-2)" }} title={T.clear}>🗑</button>
                </div>
              </div>

              {searchOpen && (
                <div className="border-b px-4 py-2" style={{ borderColor: "var(--line)", background: "var(--bg-2)" }}>
                  <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder={T.search} className="w-full rounded-lg border bg-transparent px-3 py-2 text-sm outline-none" style={{ borderColor: "var(--line)" }} />
                </div>
              )}

              {showSafety && curFp && (
                <div className="border-b px-4 py-4" style={{ borderColor: "var(--line)", background: "var(--bg-3)" }}>
                  <p className="label mb-2">{T.safety}</p>
                  <p className="mono select-all text-sm force-ltr" style={{ color: "var(--accent)", letterSpacing: "0.15em" }}>{safetyNumber(curFp)}</p>
                  <p className="mt-2 text-xs text-[var(--fg-2)]">{T.safetyNote}</p>
                  {!curVerified && <button onClick={markVerified} className="btn btn-accent mt-3 px-4 py-2 text-sm">{T.verify}</button>}
                  {curVerified && <p className="mt-3 text-sm" style={{ color: "var(--accent)" }}>✔ {T.verified}</p>}
                </div>
              )}

              {/* messages */}
              <div ref={scrollRef} onScroll={onScroll} className="min-h-0 flex-1 space-y-1 overflow-y-auto p-4 thin-scroll" style={{ background: "var(--bg)" }}>
                {shown.map((m, i) => {
                  const prev = shown[i - 1];
                  const showDay = !prev || new Date(prev.ts).toDateString() !== new Date(m.ts).toDateString();
                  if (m.kind === "system")
                    return (
                      <div key={m.id}>
                        {showDay && <DayDivider label={dayLabel(m.ts)} />}
                        <p className="py-1 text-center text-xs text-[var(--fg-2)]">{m.text}</p>
                      </div>
                    );
                  const reactions = m.reactions ? Object.entries(m.reactions) : [];
                  return (
                    <div key={m.id}>
                      {showDay && <DayDivider label={dayLabel(m.ts)} />}
                      <div className={`group flex items-end gap-1.5 ${m.mine ? "flex-row-reverse" : ""}`}>
                        <div className="relative max-w-[80%]">
                          <div className="rounded-2xl px-3.5 py-2 text-[14.5px] leading-relaxed shadow-sm" style={m.mine ? { background: "var(--accent)", color: "var(--on-accent)", borderEndEndRadius: 5 } : { background: "var(--bg-3)", borderEndStartRadius: 5 }}>
                            {m.reply && (
                              <div className="mb-1.5 rounded-lg border-s-2 px-2 py-1 text-xs opacity-80" style={{ borderColor: m.mine ? "rgba(0,0,0,0.35)" : "var(--accent)", background: m.mine ? "rgba(0,0,0,0.08)" : "var(--bg-2)" }}>
                                {m.reply.preview}
                              </div>
                            )}
                            {m.kind === "image" ? (
                              <img src={m.dataUrl} alt="" className="max-h-64 rounded-lg" />
                            ) : (
                              <span className="whitespace-pre-wrap break-words"><Linkify text={m.text || ""} /></span>
                            )}
                            <span className="mt-1 flex items-center justify-end gap-1 text-[10px]" style={{ opacity: 0.7 }}>
                              <span className="mono force-ltr">{time(m.ts)}</span>
                              {m.mine && <span>{m.status === "seen" ? "✓✓" : "✓"}</span>}
                            </span>
                          </div>
                          {reactions.length > 0 && (
                            <div className={`mt-0.5 flex flex-wrap gap-1 ${m.mine ? "justify-end" : ""}`}>
                              {reactions.map(([e]) => (
                                <span key={e} className="rounded-full border px-1.5 py-0.5 text-xs" style={{ borderColor: "var(--line-2)", background: "var(--bg-2)" }}>{e}</span>
                              ))}
                            </div>
                          )}
                          {reactFor === m.id && (
                            <div className={`absolute bottom-full z-10 mb-1 flex gap-0.5 rounded-full border p-1 shadow-lg ${m.mine ? "end-0" : "start-0"}`} style={{ borderColor: "var(--line-2)", background: "var(--bg-2)" }}>
                              {EMOJI.map((e) => (
                                <button key={e} onClick={() => react(m, e)} className="rounded-full px-1.5 py-0.5 text-base transition-transform hover:scale-125">{e}</button>
                              ))}
                            </div>
                          )}
                        </div>
                        {/* hover actions */}
                        <div className="flex shrink-0 gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                          <button onClick={() => setReactFor(reactFor === m.id ? null : m.id)} className="grid h-6 w-6 place-items-center rounded-full text-xs" style={{ background: "var(--bg-2)", border: "1px solid var(--line)" }} title={T.react}>☺</button>
                          <button onClick={() => setReplyTo(m)} className="grid h-6 w-6 place-items-center rounded-full text-xs" style={{ background: "var(--bg-2)", border: "1px solid var(--line)" }} title={T.reply}>↩</button>
                          <button onClick={() => deleteMsg(m)} className="grid h-6 w-6 place-items-center rounded-full text-xs" style={{ background: "var(--bg-2)", border: "1px solid var(--line)" }} title={T.del}>✕</button>
                        </div>
                      </div>
                    </div>
                  );
                })}
                {cur.typing && (
                  <div className="flex justify-start">
                    <div className="flex gap-1 rounded-2xl px-4 py-3" style={{ background: "var(--bg-3)" }}>
                      {[0, 1, 2].map((d) => (
                        <span key={d} className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--fg-2)", animation: `td 1s ${d * 0.15}s infinite` }} />
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {!atBottom && (
                <button onClick={() => { setAtBottom(true); scrollToBottom(true); }} className="absolute bottom-24 z-10 grid h-10 w-10 place-items-center rounded-full border shadow-lg" style={{ insetInlineEnd: "1.25rem", background: "var(--bg-2)", borderColor: "var(--line-2)" }}>↓</button>
              )}

              {/* composer */}
              <div className="border-t p-3" style={{ borderColor: "var(--line)", background: "var(--bg-2)" }}>
                {replyTo && (
                  <div className="mb-2 flex items-center justify-between rounded-lg border-s-2 px-3 py-1.5 text-xs" style={{ borderColor: "var(--accent)", background: "var(--bg-3)" }}>
                    <span className="truncate"><span className="text-[var(--fg-2)]">{T.replyingTo}: </span>{(replyTo.text || "🖼️").slice(0, 60)}</span>
                    <button onClick={() => setReplyTo(null)} className="text-[var(--fg-2)] hover:text-[var(--fg)]">✕</button>
                  </div>
                )}
                <div className="flex items-end gap-2">
                  <button onClick={() => fileRef.current?.click()} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border text-lg" style={{ borderColor: "var(--line-2)" }} title="image">📎</button>
                  <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && sendImage(e.target.files[0])} />
                  <textarea
                    value={input}
                    onChange={(e) => { setInput(e.target.value); onType(); }}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendText(); } }}
                    rows={1}
                    placeholder={T.typeMsg}
                    disabled={!curReady}
                    className="max-h-32 min-h-[44px] flex-1 resize-none rounded-xl border px-4 py-2.5 text-[var(--fg)] outline-none disabled:opacity-50"
                    style={{ background: "var(--bg-3)", borderColor: "var(--line)" }}
                  />
                  <button onClick={sendText} disabled={!curReady || !input.trim()} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl disabled:opacity-40" style={{ background: "var(--accent)", color: "var(--on-accent)" }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m22 2-7 20-4-9-9-4Z" /><path d="M22 2 11 13" /></svg>
                  </button>
                </div>
              </div>
            </>
          )}
        </main>
      </div>

      <style jsx global>{`
        @keyframes td { 0%,60%,100% { transform: translateY(0); opacity: .4; } 30% { transform: translateY(-4px); opacity: 1; } }
      `}</style>
    </div>
  );
}

function DayDivider({ label }: { label: string }) {
  return (
    <div className="my-3 flex items-center gap-3">
      <span className="h-px flex-1" style={{ background: "var(--line)" }} />
      <span className="mono rounded-full border px-2.5 py-0.5 text-[10px] text-[var(--fg-2)]" style={{ borderColor: "var(--line)" }}>{label}</span>
      <span className="h-px flex-1" style={{ background: "var(--line)" }} />
    </div>
  );
}
