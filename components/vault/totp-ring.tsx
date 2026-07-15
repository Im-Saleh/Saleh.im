"use client";

import { useEffect, useRef, useState } from "react";
import { totp, parseOtpAuth } from "@/lib/vault/crypto";
import { Icon } from "./ui";

/* ============================================================================
   TotpRing — a live RFC-6238 authenticator code with a countdown ring.
   Accepts a raw base32 secret or a full otpauth:// URI.
   ========================================================================== */

export function TotpRing({
  secret,
  size = 56,
  onCopy,
  copied,
  compact = false,
}: {
  secret: string;
  size?: number;
  onCopy?: (code: string) => void;
  copied?: boolean;
  compact?: boolean;
}) {
  const [code, setCode] = useState("------");
  const [remaining, setRemaining] = useState(30);
  const [period, setPeriod] = useState(30);
  const [error, setError] = useState(false);
  const raf = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const parsed = parseOtpAuth(secret);
    if (!parsed) {
      setError(true);
      return;
    }
    setError(false);
    const p = parsed.period || 30;
    const digits = parsed.digits || 6;
    setPeriod(p);

    let alive = true;
    const tick = async () => {
      try {
        const { code, secondsRemaining } = await totp(parsed.secret, { period: p, digits });
        if (alive) {
          setCode(code);
          setRemaining(secondsRemaining);
        }
      } catch {
        if (alive) setError(true);
      }
    };
    tick();
    raf.current = setInterval(tick, 1000);
    return () => {
      alive = false;
      if (raf.current) clearInterval(raf.current);
    };
  }, [secret]);

  if (error) {
    return (
      <span className="mono text-xs" style={{ color: "#ef4444" }}>
        <Icon name="warn" size={13} /> invalid 2FA
      </span>
    );
  }

  const frac = remaining / period;
  const r = size / 2 - 4;
  const circ = 2 * Math.PI * r;
  const col = remaining <= 5 ? "#ef4444" : remaining <= 10 ? "#eab308" : "var(--accent)";
  const pretty = code.length === 6 ? `${code.slice(0, 3)} ${code.slice(3)}` : code;

  return (
    <div className={`flex items-center gap-3 ${compact ? "" : ""}`}>
      <div className="relative grid shrink-0 place-items-center" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--bg-3)" strokeWidth="3" />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={col}
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray={circ}
            strokeDashoffset={circ * (1 - frac)}
            style={{ transition: "stroke-dashoffset 1s linear, stroke .3s" }}
          />
        </svg>
        <span className="mono absolute text-[11px]" style={{ color: col }}>
          {remaining}
        </span>
      </div>
      <button
        onClick={() => onCopy?.(code)}
        className="mono flex items-center gap-2 text-2xl tracking-widest force-ltr"
        style={{ color: "var(--fg)" }}
        title="Copy code"
      >
        {pretty}
        <Icon name={copied ? "check" : "copy"} size={16} className="opacity-60" />
      </button>
    </div>
  );
}
