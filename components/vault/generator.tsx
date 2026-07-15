"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  generatePassword,
  generatePassphrase,
  analyzeStrength,
  type GenOptions,
  type PassphraseOptions,
} from "@/lib/vault/crypto";
import { Icon, Toggle, Segmented, StrengthBar, type VaultStrings, useClipboard } from "./ui";

/* ============================================================================
   Generator — cryptographically-strong passwords and passphrases, with a live
   strength read-out. Usable standalone (a tab) or embedded in the editor.
   ========================================================================== */

export function Generator({
  t,
  fa,
  onUse,
  compact = false,
  clearSeconds = 20,
}: {
  t: VaultStrings;
  fa: boolean;
  onUse?: (value: string) => void;
  compact?: boolean;
  clearSeconds?: number;
}) {
  const [mode, setMode] = useState<"password" | "passphrase">("password");
  const [value, setValue] = useState("");

  const [pwOpts, setPwOpts] = useState<GenOptions>({
    length: 20,
    upper: true,
    lower: true,
    digits: true,
    symbols: true,
    avoidAmbiguous: false,
  });
  const [ppOpts, setPpOpts] = useState<PassphraseOptions>({
    words: 4,
    separator: "-",
    capitalize: true,
    includeNumber: true,
  });

  const { copy, copiedKey } = useClipboard(clearSeconds);

  const regenerate = useCallback(() => {
    setValue(mode === "password" ? generatePassword(pwOpts) : generatePassphrase(ppOpts));
  }, [mode, pwOpts, ppOpts]);

  useEffect(() => {
    regenerate();
  }, [regenerate]);

  const strength = useMemo(() => analyzeStrength(value), [value]);
  const num = (n: number) => (fa ? n.toLocaleString("fa-IR") : String(n));

  return (
    <div className={compact ? "" : "panel elev p-5 sm:p-6"}>
      {!compact && (
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon name="dice" />
            <h3 className="font-display text-lg">{t.genTitle}</h3>
          </div>
          <Segmented
            value={mode}
            onChange={(m) => setMode(m as typeof mode)}
            options={[
              { value: "password", label: t.genPassword },
              { value: "passphrase", label: t.genPassphrase },
            ]}
          />
        </div>
      )}

      {/* output */}
      <div className="relative overflow-hidden rounded-xl border p-4" style={{ borderColor: "var(--line-2)", background: "var(--bg-3)" }}>
        <div className="conic-sheen" aria-hidden style={{ opacity: 0.18 }} />
        <p className="mono relative break-all text-lg leading-relaxed force-ltr" style={{ color: "var(--accent)" }}>
          {value || "…"}
        </p>
        <div className="relative mt-3 flex items-center gap-2">
          <button onClick={regenerate} className="btn btn-outline px-3 py-1.5 text-xs">
            <Icon name="refresh" size={15} /> {t.regenerate}
          </button>
          <button onClick={() => copy(value, "gen")} className="btn btn-outline px-3 py-1.5 text-xs">
            <Icon name={copiedKey === "gen" ? "check" : "copy"} size={15} /> {copiedKey === "gen" ? t.copied : t.copy}
          </button>
          {onUse && (
            <button onClick={() => onUse(value)} className="btn btn-accent ms-auto px-3 py-1.5 text-xs">
              {t.use}
            </button>
          )}
        </div>
      </div>

      {/* strength */}
      <div className="mt-4">
        <div className="mb-1 flex items-center justify-between">
          <span className="label">{t.strength}</span>
          <span className="mono text-xs text-[var(--fg-2)]">
            {t.crackTime}: {fa ? strength.crackTime.faLabel : strength.crackTime.label}
          </span>
        </div>
        <StrengthBar score={strength.score} entropy={strength.entropyBits} />
      </div>

      {/* options */}
      {compact && (
        <div className="mt-4">
          <Segmented
            value={mode}
            onChange={(m) => setMode(m as typeof mode)}
            options={[
              { value: "password", label: t.genPassword },
              { value: "passphrase", label: t.genPassphrase },
            ]}
          />
        </div>
      )}

      <div className="mt-4 space-y-3">
        {mode === "password" ? (
          <>
            <div>
              <div className="mb-1 flex items-center justify-between">
                <span className="label">{t.length}</span>
                <span className="mono text-sm" style={{ color: "var(--accent)" }}>{num(pwOpts.length)}</span>
              </div>
              <input
                type="range"
                min={8}
                max={64}
                value={pwOpts.length}
                onChange={(e) => setPwOpts({ ...pwOpts, length: Number(e.target.value) })}
                className="vault-range w-full"
              />
            </div>
            <OptRow label={t.uppercase} on={pwOpts.upper} onChange={(v) => setPwOpts({ ...pwOpts, upper: v })} />
            <OptRow label={t.lowercase} on={pwOpts.lower} onChange={(v) => setPwOpts({ ...pwOpts, lower: v })} />
            <OptRow label={t.numbers} on={pwOpts.digits} onChange={(v) => setPwOpts({ ...pwOpts, digits: v })} />
            <OptRow label={t.symbols} on={pwOpts.symbols} onChange={(v) => setPwOpts({ ...pwOpts, symbols: v })} />
            <OptRow label={t.avoidAmbiguous} on={pwOpts.avoidAmbiguous} onChange={(v) => setPwOpts({ ...pwOpts, avoidAmbiguous: v })} />
          </>
        ) : (
          <>
            <div>
              <div className="mb-1 flex items-center justify-between">
                <span className="label">{t.words}</span>
                <span className="mono text-sm" style={{ color: "var(--accent)" }}>{num(ppOpts.words)}</span>
              </div>
              <input
                type="range"
                min={3}
                max={8}
                value={ppOpts.words}
                onChange={(e) => setPpOpts({ ...ppOpts, words: Number(e.target.value) })}
                className="vault-range w-full"
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">{t.separator}</span>
              <div className="flex gap-1.5">
                {["-", ".", "_", " ", "•"].map((s) => (
                  <button
                    key={s}
                    onClick={() => setPpOpts({ ...ppOpts, separator: s })}
                    className="mono h-8 w-8 rounded-lg border text-sm"
                    style={{
                      borderColor: ppOpts.separator === s ? "var(--accent)" : "var(--line-2)",
                      color: ppOpts.separator === s ? "var(--accent)" : "var(--fg-2)",
                    }}
                  >
                    {s === " " ? "␣" : s}
                  </button>
                ))}
              </div>
            </div>
            <OptRow label={t.capitalize} on={ppOpts.capitalize} onChange={(v) => setPpOpts({ ...ppOpts, capitalize: v })} />
            <OptRow label={t.includeNumber} on={ppOpts.includeNumber} onChange={(v) => setPpOpts({ ...ppOpts, includeNumber: v })} />
          </>
        )}
      </div>
    </div>
  );
}

function OptRow({ label, on, onChange }: { label: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm">{label}</span>
      <Toggle on={on} onChange={onChange} label={label} />
    </div>
  );
}
