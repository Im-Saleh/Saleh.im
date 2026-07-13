"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
  sanitize,
  seal,
  sha256Hex,
  vaultDecrypt,
  vaultEncrypt,
  type SessionKeys,
  type Vault,
} from "@/lib/messenger/crypto";

type Msg = {
  id: string;
  mine: boolean;
  kind: "text" | "image" | "system";
  text?: string;
  dataUrl?: string;
  ts: number;
  status?: "sent" | "seen";
};
type Convo = { peer: string; name: string; messages: Msg[]; unread: number; typing: boolean };
type ConnState = { conn: any; keyPair?: CryptoKeyPair; keys?: SessionKeys; ready: boolean; name: string };

/* tiny WebAudio blip */
function blip(kind: "in" | "out") {
  try {
    const Ctx = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext;
    const ctx = new Ctx();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g);
    g.connect(ctx.destination);
    o.frequency.value = kind === "in" ? 660 : 880;
    o.type = "sine";
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.06, ctx.currentTime + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.18);
    o.start();
    o.stop(ctx.currentTime + 0.2);
    o.onended = () => ctx.close();
  } catch {}
}

const EMOJI = ["👍", "🔥", "❤️", "😂", "🎉", "🙏", "✅", "👀"];

export default function MessengerPage() {
  const { lang } = useLang();
  const { toggleMode } = useThemeScene();
  const fa = lang === "fa";

  const [stage, setStage] = useState<"auth" | "chat">("auth");
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const [meId, setMeId] = useState("");
  const [status, setStatus] = useState<"offline" | "connecting" | "online">("offline");
  const [convos, setConvos] = useState<Record<string, Convo>>({});
  const [active, setActive] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [peerInput, setPeerInput] = useState("");
  const [showSidebar, setShowSidebar] = useState(true);
  const [copied, setCopied] = useState(false);
  const [soundOn, setSoundOn] = useState(true);

  const peerRef = useRef<any>(null);
  const connsRef = useRef<Record<string, ConnState>>({});
  const vaultRef = useRef<Vault | null>(null);
  const activeRef = useRef<string | null>(null);
  const meRef = useRef({ user: "", id: "" });
  const soundRef = useRef(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const typingTimer = useRef<Record<string, any>>({});
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    activeRef.current = active;
  }, [active]);
  useEffect(() => {
    soundRef.current = soundOn;
  }, [soundOn]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [convos, active]);

  const T = fa
    ? {
        title: "Cipher",
        tag: "پیام‌رسانِ رمزنگاری‌شده‌ی همتا‌به‌همتا",
        u: "نام کاربری",
        p: "رمز عبور",
        go: "ورود و آنلاین‌شدن",
        note: "شناسه‌ات به‌صورت محلی از این اطلاعات ساخته می‌شود. تاریخچه با رمزِ تو روی همین دستگاه رمزنگاری می‌شود. هیچ‌چیز آپلود نمی‌شود.",
        online: "آنلاین",
        connecting: "در حال اتصال…",
        offline: "آفلاین",
        connect: "اتصال",
        peerPh: "نام کاربریِ طرف مقابل",
        share: "اشتراکِ لینک دعوت",
        copied: "کپی شد!",
        convos: "گفتگوها",
        none: "هنوز گفتگویی نیست.",
        emptyTitle: "یک کانالِ امن باز کن",
        emptyBody: "نام کاربریِ یک نفر را وارد کن تا مستقیم و رمزنگاری‌شده چت کنید.",
        typeMsg: "یک پیام بنویس…",
        secured: "با ۴ لایه رمزنگاری محافظت می‌شود",
        typing: "در حال نوشتن…",
        you: "تو",
        established: "کانالِ امن برقرار شد با",
        left: "قطع شد",
        clear: "پاک‌کردن گفتگو",
        back: "بازگشت",
        signout: "خروج",
        today: "امروز",
        yesterday: "دیروز",
        myId: "شناسه‌ی تو",
        seen: "دیده شد",
        sound: "صدا",
      }
    : {
        title: "Cipher",
        tag: "End-to-end encrypted peer-to-peer messenger",
        u: "Username",
        p: "Password",
        go: "Sign in & go online",
        note: "Your ID is derived locally from these credentials. History is encrypted with your password on this device. Nothing is uploaded.",
        online: "online",
        connecting: "connecting…",
        offline: "offline",
        connect: "Connect",
        peerPh: "friend's username",
        share: "Share invite link",
        copied: "Copied!",
        convos: "Conversations",
        none: "No conversations yet.",
        emptyTitle: "Open a secure channel",
        emptyBody: "Enter someone's username to start a direct, encrypted chat.",
        typeMsg: "Type a message…",
        secured: "Protected by 4 layers of encryption",
        typing: "typing…",
        you: "You",
        established: "Secure channel established with",
        left: "disconnected",
        clear: "Clear conversation",
        back: "Back",
        signout: "Sign out",
        today: "Today",
        yesterday: "Yesterday",
        myId: "Your ID",
        seen: "Seen",
        sound: "Sound",
      };

  /* ---------- helpers ---------- */
  const peerIdFor = (u: string) => "cipher-" + sanitize(u);
  const nameFromId = (id: string) => id.replace(/^cipher-/, "").split("-")[0];

  const storeKey = (peer: string) => `cipher:hist:${meRef.current.user}:${peer}`;

  const saveConvo = useCallback(async (peer: string, c: Convo) => {
    if (!vaultRef.current) return;
    try {
      const persist = c.messages.filter((m) => m.kind !== "system").slice(-200);
      localStorage.setItem(storeKey(peer), await vaultEncrypt(vaultRef.current, { name: c.name, messages: persist }));
    } catch {}
  }, []);

  const upsert = useCallback(
    (peer: string, updater: (c: Convo) => Convo, persist = true) => {
      setConvos((prev) => {
        const cur = prev[peer] || { peer, name: nameFromId(peer), messages: [], unread: 0, typing: false };
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
        return {
          ...c,
          messages: [...c.messages, msg],
          unread: msg.mine || isActive ? c.unread : c.unread + 1,
          typing: false,
        };
      });
      if (!msg.mine && msg.kind !== "system" && soundRef.current) blip("in");
    },
    [upsert]
  );

  /* ---------- crypto handshake over wire ---------- */
  const send = (peer: string, obj: any) => {
    const cs = connsRef.current[peer];
    if (cs?.conn?.open) cs.conn.send(JSON.stringify(obj));
  };

  const beginHandshake = useCallback(async (peer: string) => {
    const cs = connsRef.current[peer];
    if (!cs) return;
    cs.keyPair = await genECDH();
    send(peer, { t: "hs", pub: await exportPub(cs.keyPair), name: meRef.current.user });
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
        if (data.name) cs.name = data.name;
        if (!cs.keyPair) cs.keyPair = await genECDH();
        try {
          cs.keys = await deriveShared(cs.keyPair, data.pub);
          cs.ready = true;
          upsert(peer, (c) => ({ ...c, name: cs.name, messages: [...c.messages, { id: crypto.randomUUID(), mine: false, kind: "system", text: `🔒 ${T.established} ${cs.name}`, ts: Date.now() }] }), false);
        } catch {}
      } else if (data.t === "msg" && cs.keys) {
        try {
          const text = await openSeal(cs.keys, data.c);
          if (data.kind === "image") addMsg(peer, { id: crypto.randomUUID(), mine: false, kind: "image", dataUrl: text, ts: Date.now() });
          else addMsg(peer, { id: crypto.randomUUID(), mine: false, kind: "text", text, ts: Date.now() });
          send(peer, { t: "seen" });
        } catch {}
      } else if (data.t === "typing") {
        upsert(peer, (c) => ({ ...c, typing: !!data.on }), false);
      } else if (data.t === "seen") {
        upsert(peer, (c) => ({ ...c, messages: c.messages.map((m) => (m.mine ? { ...m, status: "seen" } : m)) }), false);
      }
    },
    [addMsg, upsert, T.established]
  );

  const wireConn = useCallback(
    (conn: any) => {
      const peer = conn.peer;
      connsRef.current[peer] = connsRef.current[peer] || { conn, ready: false, name: nameFromId(peer) };
      connsRef.current[peer].conn = conn;
      conn.on("open", () => {
        setConvos((prev) => (prev[peer] ? prev : { ...prev, [peer]: { peer, name: nameFromId(peer), messages: [], unread: 0, typing: false } }));
        setActive((a) => a ?? peer);
        beginHandshake(peer);
      });
      conn.on("data", (raw: any) => onData(peer, raw));
      conn.on("close", () => {
        if (connsRef.current[peer]) connsRef.current[peer].ready = false;
        upsert(peer, (c) => ({ ...c, messages: [...c.messages, { id: crypto.randomUUID(), mine: false, kind: "system", text: `⚠︎ ${nameFromId(peer)} ${T.left}`, ts: Date.now() }] }), false);
      });
      conn.on("error", () => {});
    },
    [beginHandshake, onData, upsert, T.left]
  );

  const connectTo = useCallback(
    (username: string) => {
      const target = peerIdFor(username);
      if (!peerRef.current || target === meRef.current.id) return;
      if (!connsRef.current[target]) connsRef.current[target] = { conn: null, ready: false, name: username };
      const conn = peerRef.current.connect(target, { reliable: true });
      wireConn(conn);
      setConvos((prev) => (prev[target] ? prev : { ...prev, [target]: { peer: target, name: username, messages: [], unread: 0, typing: false } }));
      setActive(target);
      setShowSidebar(false);
    },
    [wireConn]
  );

  /* ---------- boot peer ---------- */
  const boot = useCallback(async () => {
    const mod = await import("peerjs");
    const Peer: any = mod.default;
    const primary = peerIdFor(meRef.current.user);
    const mk = (id: string) =>
      new Peer(id, {
        debug: 1,
        config: {
          iceServers: [
            { urls: "stun:stun.l.google.com:19302" },
            { urls: "stun:global.stun.twilio.com:3478" },
          ],
        },
      });
    let p = mk(primary);
    meRef.current.id = primary;
    setMeId(primary);
    setStatus("connecting");

    const attach = (peer: any) => {
      peer.on("open", (id: string) => {
        meRef.current.id = id;
        setMeId(id);
        setStatus("online");
        // auto-connect from ?to= param
        const to = new URLSearchParams(window.location.search).get("to");
        if (to) setTimeout(() => connectTo(to), 400);
      });
      peer.on("connection", (conn: any) => wireConn(conn));
      peer.on("error", (err: any) => {
        if (err?.type === "unavailable-id") {
          sha256Hex(meRef.current.user + ":" + Math.random()).then((h) => {
            const fid = primary + "-" + h.slice(0, 5);
            const np = mk(fid);
            peerRef.current = np;
            attach(np);
          });
        } else {
          setStatus("connecting");
        }
      });
    };
    attach(p);
    peerRef.current = p;
  }, [connectTo, wireConn]);

  const loadHistory = useCallback(async () => {
    if (!vaultRef.current) return;
    const prefix = `cipher:hist:${meRef.current.user}:`;
    const loaded: Record<string, Convo> = {};
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(prefix)) {
        const peer = k.slice(prefix.length);
        try {
          const data = await vaultDecrypt<{ name: string; messages: Msg[] }>(vaultRef.current, localStorage.getItem(k) as string);
          loaded[peer] = { peer, name: data.name || nameFromId(peer), messages: data.messages || [], unread: 0, typing: false };
          connsRef.current[peer] = connsRef.current[peer] || { conn: null, ready: false, name: data.name || nameFromId(peer) };
        } catch {}
      }
    }
    if (Object.keys(loaded).length) setConvos((prev) => ({ ...loaded, ...prev }));
  }, []);

  const signIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (user.trim().length < 3 || pass.length < 4) return;
    meRef.current.user = user.trim();
    const saltKey = `cipher:salt:${meRef.current.user}`;
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

  /* ---------- send actions ---------- */
  const sendText = async () => {
    const text = input.trim();
    const cs = active ? connsRef.current[active] : null;
    if (!text || !active || !cs?.keys || !cs.conn?.open) return;
    setInput("");
    const id = crypto.randomUUID();
    try {
      send(active, { t: "msg", c: await seal(cs.keys, text) });
      addMsg(active, { id, mine: true, kind: "text", text, ts: Date.now(), status: "sent" });
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
      try {
        send(active, { t: "msg", kind: "image", c: await seal(cs.keys!, dataUrl) });
        addMsg(active, { id: crypto.randomUUID(), mine: true, kind: "image", dataUrl, ts: Date.now(), status: "sent" });
      } catch {}
    };
    reader.readAsDataURL(file);
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
    upsert(peer, (c) => ({ ...c, unread: 0 }), false);
  };

  const clearConvo = () => {
    if (!active) return;
    try {
      localStorage.removeItem(storeKey(active));
    } catch {}
    upsert(active, (c) => ({ ...c, messages: [] }), false);
  };

  const shareLink = () => {
    const url = `${window.location.origin}${BASE_PATH}/messenger/?to=${sanitize(meRef.current.user)}`;
    navigator.clipboard?.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  const signOut = () => {
    try {
      peerRef.current?.destroy();
    } catch {}
    location.reload();
  };

  /* ---------- render helpers ---------- */
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

  const convoList = Object.values(convos).sort((a, b) => {
    const la = a.messages[a.messages.length - 1]?.ts || 0;
    const lb = b.messages[b.messages.length - 1]?.ts || 0;
    return lb - la;
  });
  const cur = active ? convos[active] : null;
  const curReady = active ? connsRef.current[active]?.ready : false;
  const curFp = active ? connsRef.current[active]?.keys?.fingerprint : "";

  /* ================= AUTH ================= */
  if (stage === "auth") {
    return (
      <div className="relative flex min-h-[100dvh] items-center justify-center overflow-hidden px-5">
        <div className="pointer-events-none absolute inset-0 dotfield" aria-hidden />
        <div className="aurora left-[15%] top-[12%] h-72 w-72" style={{ background: "var(--accent)" }} aria-hidden />
        <TopControls back={T.back} onTheme={toggleMode} />
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
              <input value={user} onChange={(e) => setUser(e.target.value)} minLength={3} maxLength={24} required className="rounded-xl border px-4 py-3 text-[var(--fg)] outline-none" style={{ background: "var(--bg-3)", borderColor: "var(--line)" }} placeholder="saleh" />
            </label>
            <label className="grid gap-2 text-sm text-[var(--fg-2)]">
              {T.p}
              <input type="password" value={pass} onChange={(e) => setPass(e.target.value)} minLength={4} required className="rounded-xl border px-4 py-3 text-[var(--fg)] outline-none" style={{ background: "var(--bg-3)", borderColor: "var(--line)" }} placeholder="••••••" />
            </label>
            <button type="submit" className="btn btn-accent mt-1">{T.go}</button>
            <p className="text-xs leading-relaxed text-[var(--fg-2)]">{T.note}</p>
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
      {/* top bar */}
      <header className="flex items-center justify-between gap-3 border-b px-4 py-3" style={{ borderColor: "var(--line)", background: "var(--bg-2)" }}>
        <div className="flex items-center gap-3">
          <Link href="/" className="mono text-sm text-[var(--fg-2)] hover:text-[var(--fg)]">← saleh.im</Link>
          <span className="hidden items-center gap-2 sm:flex">
            <span className="grid h-7 w-7 place-items-center rounded-lg text-sm" style={{ background: "var(--accent)", color: "var(--on-accent)" }}>◆</span>
            <span className="font-display text-lg">{T.title}</span>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setSoundOn((s) => !s)} title={T.sound} className="grid h-9 w-9 place-items-center rounded-full border" style={{ borderColor: "var(--line-2)", opacity: soundOn ? 1 : 0.5 }}>
            {soundOn ? "🔔" : "🔕"}
          </button>
          <button onClick={toggleMode} className="grid h-9 w-9 place-items-center rounded-full border" style={{ borderColor: "var(--line-2)" }} title="theme">◑</button>
          <LangToggle />
          <button onClick={signOut} className="btn btn-outline h-9 px-4 py-0 text-sm">{T.signout}</button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* sidebar */}
        <aside className={`${showSidebar ? "flex" : "hidden"} w-full flex-col border-e sm:flex sm:w-80 sm:shrink-0`} style={{ borderColor: "var(--line)", background: "var(--bg-2)" }}>
          <div className="border-b p-4" style={{ borderColor: "var(--line)" }}>
            <div className="flex items-center gap-2 rounded-xl border p-1.5" style={{ borderColor: "var(--line)", background: "var(--bg-3)" }}>
              <input value={peerInput} onChange={(e) => setPeerInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && peerInput.trim() && (connectTo(peerInput.trim()), setPeerInput(""))} placeholder={T.peerPh} className="min-w-0 flex-1 bg-transparent px-2 text-sm outline-none" />
              <button onClick={() => peerInput.trim() && (connectTo(peerInput.trim()), setPeerInput(""))} className="btn btn-accent px-4 py-2 text-sm">{T.connect}</button>
            </div>
            <div className="mt-3 flex items-center justify-between text-xs">
              <span className="flex items-center gap-2 text-[var(--fg-2)]">
                <span className="h-2 w-2 rounded-full" style={{ background: status === "online" ? "#27c93f" : "#eab308", boxShadow: status === "online" ? "0 0 8px #27c93f" : "none" }} />
                {status === "online" ? T.online : status === "connecting" ? T.connecting : T.offline}
                <b className="text-[var(--fg)] force-ltr">{meRef.current.user}</b>
              </span>
              <button onClick={shareLink} className="mono text-[var(--accent)] hover:underline">{copied ? T.copied : T.share}</button>
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-2">
            <p className="label px-2 py-2">{T.convos}</p>
            {convoList.length === 0 && <p className="px-3 text-sm text-[var(--fg-2)]">{T.none}</p>}
            {convoList.map((c) => {
              const last = c.messages[c.messages.length - 1];
              const on = connsRef.current[c.peer]?.conn?.open;
              return (
                <button key={c.peer} onClick={() => openConvo(c.peer)} className="flex w-full items-center gap-3 rounded-xl p-2.5 text-start transition-colors" style={{ background: active === c.peer ? "var(--bg-3)" : "transparent" }}>
                  <span className="relative grid h-11 w-11 shrink-0 place-items-center rounded-full font-display text-lg uppercase" style={{ background: "var(--bg-3)", border: "1px solid var(--line)" }}>
                    {c.name.charAt(0)}
                    <span className="absolute -bottom-0 -end-0 h-3 w-3 rounded-full border-2" style={{ background: on ? "#27c93f" : "#71717a", borderColor: "var(--bg-2)" }} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <b className="truncate text-sm force-ltr">{c.name}</b>
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

        {/* chat area */}
        <main className={`${showSidebar ? "hidden" : "flex"} min-w-0 flex-1 flex-col sm:flex`}>
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
              <div className="flex items-center justify-between gap-3 border-b px-4 py-3" style={{ borderColor: "var(--line)", background: "var(--bg-2)" }}>
                <div className="flex items-center gap-3">
                  <button onClick={() => setShowSidebar(true)} className="grid h-9 w-9 place-items-center rounded-full border sm:hidden" style={{ borderColor: "var(--line-2)" }}>←</button>
                  <span className="grid h-10 w-10 place-items-center rounded-full font-display text-lg uppercase" style={{ background: "var(--bg-3)", border: "1px solid var(--line)" }}>{cur.name.charAt(0)}</span>
                  <div>
                    <b className="block text-sm force-ltr">{cur.name}</b>
                    <span className="flex items-center gap-1.5 text-xs text-[var(--fg-2)]">
                      <span className="h-1.5 w-1.5 rounded-full" style={{ background: curReady ? "#27c93f" : "#eab308" }} />
                      {curReady ? T.secured : T.connecting}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {curFp && <span className="mono hidden text-[10px] text-[var(--fg-2)] sm:inline force-ltr" title="key fingerprint">🔑 {curFp}</span>}
                  <button onClick={clearConvo} className="grid h-9 w-9 place-items-center rounded-full border" style={{ borderColor: "var(--line-2)" }} title={T.clear}>🗑</button>
                </div>
              </div>

              <div ref={scrollRef} className="min-h-0 flex-1 space-y-1.5 overflow-y-auto p-4" style={{ background: "var(--bg)" }}>
                {cur.messages.map((m, i) => {
                  const prev = cur.messages[i - 1];
                  const showDay = !prev || new Date(prev.ts).toDateString() !== new Date(m.ts).toDateString();
                  if (m.kind === "system")
                    return (
                      <div key={m.id}>
                        {showDay && <DayDivider label={dayLabel(m.ts)} />}
                        <p className="py-1 text-center text-xs text-[var(--fg-2)]">{m.text}</p>
                      </div>
                    );
                  return (
                    <div key={m.id}>
                      {showDay && <DayDivider label={dayLabel(m.ts)} />}
                      <div className={`flex ${m.mine ? "justify-end" : "justify-start"}`}>
                        <div className="max-w-[78%] rounded-2xl px-3.5 py-2 text-[14.5px] leading-relaxed shadow-sm" style={m.mine ? { background: "var(--accent)", color: "var(--on-accent)", borderEndEndRadius: 5 } : { background: "var(--bg-3)", borderEndStartRadius: 5 }}>
                          {m.kind === "image" ? (
                            <img src={m.dataUrl} alt="" className="max-h-64 rounded-lg" />
                          ) : (
                            <span className="whitespace-pre-wrap break-words">{m.text}</span>
                          )}
                          <span className="mt-1 flex items-center justify-end gap-1 text-[10px]" style={{ opacity: 0.7 }}>
                            <span className="mono force-ltr">{time(m.ts)}</span>
                            {m.mine && <span>{m.status === "seen" ? "✓✓" : "✓"}</span>}
                          </span>
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

              {/* composer */}
              <div className="border-t p-3" style={{ borderColor: "var(--line)", background: "var(--bg-2)" }}>
                <div className="mb-2 flex flex-wrap gap-1">
                  {EMOJI.map((e) => (
                    <button key={e} onClick={() => setInput((v) => v + e)} className="rounded-lg px-2 py-1 text-lg transition-transform hover:scale-125">{e}</button>
                  ))}
                </div>
                <div className="flex items-end gap-2">
                  <button onClick={() => fileRef.current?.click()} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border text-lg" style={{ borderColor: "var(--line-2)" }} title="image">📎</button>
                  <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && sendImage(e.target.files[0])} />
                  <textarea
                    value={input}
                    onChange={(e) => {
                      setInput(e.target.value);
                      onType();
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        sendText();
                      }
                    }}
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
        @keyframes td {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
          30% { transform: translateY(-4px); opacity: 1; }
        }
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

function TopControls({ back, onTheme }: { back: string; onTheme: () => void }) {
  return (
    <div className="absolute inset-x-0 top-0 z-20 flex items-center justify-between p-4">
      <Link href="/" className="mono rounded-full border px-3 py-1.5 text-xs text-[var(--fg-2)] backdrop-blur hover:text-[var(--fg)]" style={{ borderColor: "var(--line-2)" }}>← saleh.im</Link>
      <div className="flex items-center gap-2">
        <button onClick={onTheme} className="grid h-9 w-9 place-items-center rounded-full border" style={{ borderColor: "var(--line-2)" }}>◑</button>
        <LangToggle />
      </div>
    </div>
  );
}
