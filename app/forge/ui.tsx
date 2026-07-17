"use client";

import { useCallback, useState, type ReactNode } from "react";

/* Shared, themed building blocks for every Forge tool. They lean entirely on
   the site's CSS variables so all 12 palettes apply automatically. */

export function ToolShell({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <div className="tab-anim">
      <div className="mb-5">
        <div className="mb-2 flex items-center gap-2.5">
          <span className="h-6 w-1 rounded-full" style={{ background: "linear-gradient(var(--accent), var(--accent-2))" }} />
          <h2 className="display gradient-text text-2xl sm:text-3xl">{title}</h2>
        </div>
        <p className="text-sm text-[var(--fg-2)]">{subtitle}</p>
      </div>
      <div className="stagger grid gap-4">{children}</div>
    </div>
  );
}

export function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`card-lift p-4 sm:p-5 ${className}`}>{children}</div>;
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="label">{label}</span>
        {hint && <span className="mono text-[10px] text-[var(--fg-2)]">{hint}</span>}
      </div>
      {children}
    </label>
  );
}

export function TextArea({
  value,
  onChange,
  placeholder,
  rows = 8,
  mono = true,
  readOnly = false,
}: {
  value: string;
  onChange?: (v: string) => void;
  placeholder?: string;
  rows?: number;
  mono?: boolean;
  readOnly?: boolean;
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange?.(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      readOnly={readOnly}
      spellCheck={false}
      className={`force-ltr thin-scroll w-full resize-y rounded-xl border bg-[var(--bg-3)] p-3 text-sm outline-none transition-colors focus:border-[var(--accent)] ${
        mono ? "mono" : ""
      }`}
      style={{ borderColor: "var(--line-2)" }}
    />
  );
}

export function Input({
  value,
  onChange,
  placeholder,
  mono = true,
  type = "text",
}: {
  value: string;
  onChange?: (v: string) => void;
  placeholder?: string;
  mono?: boolean;
  type?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange?.(e.target.value)}
      placeholder={placeholder}
      spellCheck={false}
      className={`force-ltr w-full rounded-xl border bg-[var(--bg-3)] px-3 py-2.5 text-sm outline-none transition-colors focus:border-[var(--accent)] ${
        mono ? "mono" : ""
      }`}
      style={{ borderColor: "var(--line-2)" }}
    />
  );
}

export function Btn({
  children,
  onClick,
  accent = false,
  disabled = false,
}: {
  children: ReactNode;
  onClick?: () => void;
  accent?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`btn ${accent ? "btn-accent" : "btn-outline"} px-4 py-2 text-sm disabled:opacity-40`}
    >
      {children}
    </button>
  );
}

export function CopyBtn({ text, label = "Copy" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  const copy = useCallback(() => {
    if (!text) return;
    navigator.clipboard?.writeText(text).then(() => {
      setDone(true);
      setTimeout(() => setDone(false), 1400);
    });
  }, [text]);
  return (
    <button
      type="button"
      onClick={copy}
      className="chip transition-transform active:scale-95"
      aria-label="Copy to clipboard"
    >
      {done ? "✓ Copied" : "⧉ " + label}
    </button>
  );
}

export function Output({ value, label = "Output" }: { value: string; label?: string }) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <span className="label">{label}</span>
        {value && <CopyBtn text={value} />}
      </div>
      <pre
        className="force-ltr thin-scroll max-h-[420px] overflow-auto rounded-xl border bg-[var(--bg-3)] p-3 text-sm"
        style={{ borderColor: "var(--line)" }}
      >
        <code className="mono whitespace-pre-wrap break-words">{value || "—"}</code>
      </pre>
    </div>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="inline-flex flex-wrap gap-1 rounded-full border p-1" style={{ borderColor: "var(--line-2)" }}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className="rounded-full px-3 py-1.5 text-xs font-medium transition-all"
          style={
            value === o.value
              ? { background: "var(--accent)", color: "var(--on-accent)" }
              : { color: "var(--fg-2)" }
          }
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="inline-flex items-center gap-2.5 text-sm"
    >
      <span
        className="relative h-5 w-9 rounded-full transition-colors"
        style={{ background: checked ? "var(--accent)" : "var(--line-2)" }}
      >
        <span
          className="absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform"
          style={{ transform: checked ? "translateX(18px)" : "translateX(2px)" }}
        />
      </span>
      <span>{label}</span>
    </button>
  );
}

export function Stat({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="rounded-xl border p-3 text-center" style={{ borderColor: "var(--line)", background: "var(--bg-3)" }}>
      <div className="count font-display text-2xl font-semibold">{value}</div>
      <div className="label mt-1">{label}</div>
    </div>
  );
}

export function ErrorNote({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <div className="rounded-xl border px-3 py-2 text-sm" style={{ borderColor: "rgba(239,68,68,0.4)", color: "#ef4444", background: "rgba(239,68,68,0.08)" }}>
      {message}
    </div>
  );
}
