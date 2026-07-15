"use client";

import { useEffect, useMemo, useState } from "react";
import { analyzeStrength } from "@/lib/vault/crypto";
import { detectCardBrand, type Folder, type VaultEntry } from "@/lib/vault/store";
import { Icon, Modal, Field, TextInput, StrengthBar, type VaultStrings } from "./ui";
import { Generator } from "./generator";
import { TotpRing } from "./totp-ring";

/* ============================================================================
   EntryEditor — create/edit any of the five item types in one adaptive modal.
   ========================================================================== */

export function EntryEditor({
  entry,
  folders,
  t,
  fa,
  onSave,
  onClose,
  onDelete,
}: {
  entry: VaultEntry;
  folders: Folder[];
  t: VaultStrings;
  fa: boolean;
  onSave: (e: VaultEntry) => void;
  onClose: () => void;
  onDelete?: (id: string) => void;
}) {
  const [draft, setDraft] = useState<VaultEntry>({ ...entry });
  const [reveal, setReveal] = useState(false);
  const [showGen, setShowGen] = useState(false);
  const [tagText, setTagText] = useState(entry.tags.join(", "));

  useEffect(() => {
    setDraft({ ...entry });
    setTagText(entry.tags.join(", "));
  }, [entry]);

  const set = (patch: Partial<VaultEntry>) => setDraft((d) => ({ ...d, ...patch }));
  const strength = useMemo(() => analyzeStrength(draft.password || ""), [draft.password]);

  const commit = () => {
    const tags = tagText
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const title = draft.title.trim() || defaultTitle(draft, t);
    onSave({ ...draft, title, tags, updatedAt: Date.now() });
  };

  const typeIcon: Record<VaultEntry["type"], any> = {
    login: "key",
    note: "note",
    card: "card",
    identity: "id",
    totp: "shield",
  };

  return (
    <Modal open onClose={onClose} wide>
      <div className="sticky top-0 z-10 flex items-center justify-between border-b px-5 py-4 backdrop-blur-xl" style={{ borderColor: "var(--line)", background: "color-mix(in srgb, var(--bg-2) 85%, transparent)" }}>
        <div className="flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-xl" style={{ background: "color-mix(in srgb, var(--accent) 16%, transparent)", color: "var(--accent)" }}>
            <Icon name={typeIcon[draft.type]} size={18} />
          </span>
          <h3 className="font-display text-lg">{entry.title ? t.edit : t.newItem}</h3>
        </div>
        <button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full border" style={{ borderColor: "var(--line-2)" }}>
          <Icon name="x" size={16} />
        </button>
      </div>

      <div className="space-y-4 p-5">
        <Field label={t.title}>
          <TextInput value={draft.title} onChange={(e) => set({ title: e.target.value })} placeholder={fa ? "مثلاً گیت‌هاب" : "e.g. GitHub"} autoFocus />
        </Field>

        {draft.type === "login" && (
          <>
            <Field label={t.username}>
              <TextInput value={draft.username || ""} onChange={(e) => set({ username: e.target.value })} className="force-ltr" />
            </Field>
            <Field label={t.password}>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    type={reveal ? "text" : "password"}
                    value={draft.password || ""}
                    onChange={(e) => set({ password: e.target.value })}
                    className="mono w-full rounded-xl border bg-transparent px-3.5 py-2.5 pe-10 text-sm outline-none transition-colors focus:border-[var(--accent)] force-ltr"
                    style={{ borderColor: "var(--line-2)", background: "var(--bg-3)" }}
                  />
                  <button type="button" onClick={() => setReveal((r) => !r)} className="absolute end-2 top-1/2 -translate-y-1/2 text-[var(--fg-2)]">
                    <Icon name={reveal ? "eye-off" : "eye"} size={17} />
                  </button>
                </div>
                <button type="button" onClick={() => setShowGen((s) => !s)} className="btn btn-outline px-3" title={t.generator}>
                  <Icon name="dice" size={16} />
                </button>
              </div>
              {(draft.password || "").length > 0 && (
                <div className="mt-2">
                  <StrengthBar score={strength.score} entropy={strength.entropyBits} />
                </div>
              )}
            </Field>
            {showGen && (
              <div className="rounded-xl border p-1" style={{ borderColor: "var(--line)" }}>
                <Generator t={t} fa={fa} compact onUse={(v) => { set({ password: v }); setShowGen(false); setReveal(true); }} />
              </div>
            )}
            <Field label={t.website}>
              <TextInput value={draft.url || ""} onChange={(e) => set({ url: e.target.value })} placeholder="https://…" className="force-ltr" />
            </Field>
            <Field label={t.twofa}>
              <TextInput value={draft.totpSecret || ""} onChange={(e) => set({ totpSecret: e.target.value })} placeholder="otpauth://…  ·  JBSWY3DP…" className="force-ltr" />
            </Field>
            {draft.totpSecret && (
              <div className="rounded-xl border p-3" style={{ borderColor: "var(--line)", background: "var(--bg-3)" }}>
                <TotpRing secret={draft.totpSecret} />
              </div>
            )}
          </>
        )}

        {draft.type === "note" && (
          <Field label={t.content}>
            <textarea
              value={draft.notes}
              onChange={(e) => set({ notes: e.target.value })}
              rows={8}
              className="w-full rounded-xl border bg-transparent px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-[var(--accent)]"
              style={{ borderColor: "var(--line-2)", background: "var(--bg-3)" }}
            />
          </Field>
        )}

        {draft.type === "card" && (
          <>
            <Field label={t.cardholder}>
              <TextInput value={draft.cardholder || ""} onChange={(e) => set({ cardholder: e.target.value })} />
            </Field>
            <Field label={t.cardNumber}>
              <TextInput
                value={draft.cardNumber || ""}
                onChange={(e) => set({ cardNumber: e.target.value, cardBrand: detectCardBrand(e.target.value) })}
                inputMode="numeric"
                className="mono force-ltr"
                placeholder="•••• •••• •••• ••••"
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label={t.expiry}>
                <TextInput value={draft.cardExpiry || ""} onChange={(e) => set({ cardExpiry: e.target.value })} placeholder="MM/YY" className="mono force-ltr" />
              </Field>
              <Field label={t.cvv}>
                <TextInput value={draft.cardCvv || ""} onChange={(e) => set({ cardCvv: e.target.value })} className="mono force-ltr" />
              </Field>
            </div>
          </>
        )}

        {draft.type === "identity" && (
          <>
            <Field label={t.fullName}>
              <TextInput value={draft.fullName || ""} onChange={(e) => set({ fullName: e.target.value })} />
            </Field>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label={t.email}>
                <TextInput value={draft.email || ""} onChange={(e) => set({ email: e.target.value })} className="force-ltr" />
              </Field>
              <Field label={t.phone}>
                <TextInput value={draft.phone || ""} onChange={(e) => set({ phone: e.target.value })} className="force-ltr" />
              </Field>
            </div>
            <Field label={t.address}>
              <textarea
                value={draft.address || ""}
                onChange={(e) => set({ address: e.target.value })}
                rows={3}
                className="w-full rounded-xl border bg-transparent px-3.5 py-2.5 text-sm outline-none focus:border-[var(--accent)]"
                style={{ borderColor: "var(--line-2)", background: "var(--bg-3)" }}
              />
            </Field>
          </>
        )}

        {draft.type === "totp" && (
          <>
            <Field label={t.twofa}>
              <TextInput value={draft.otpSecret || ""} onChange={(e) => set({ otpSecret: e.target.value })} placeholder="otpauth://…  ·  JBSWY3DP…" className="force-ltr" />
            </Field>
            {draft.otpSecret && (
              <div className="rounded-xl border p-3" style={{ borderColor: "var(--line)", background: "var(--bg-3)" }}>
                <TotpRing secret={draft.otpSecret} />
              </div>
            )}
          </>
        )}

        {/* shared: folder + tags + notes(for non-note) */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label={t.folder}>
            <select
              value={draft.folder}
              onChange={(e) => set({ folder: e.target.value })}
              className="w-full rounded-xl border bg-transparent px-3.5 py-2.5 text-sm outline-none focus:border-[var(--accent)]"
              style={{ borderColor: "var(--line-2)", background: "var(--bg-3)" }}
            >
              <option value="">{t.noFolder}</option>
              {folders.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t.tags}>
            <TextInput value={tagText} onChange={(e) => setTagText(e.target.value)} />
          </Field>
        </div>

        {draft.type !== "note" && (
          <Field label={t.notes || "Notes"}>
            <textarea
              value={draft.notes}
              onChange={(e) => set({ notes: e.target.value })}
              rows={3}
              className="w-full rounded-xl border bg-transparent px-3.5 py-2.5 text-sm outline-none focus:border-[var(--accent)]"
              style={{ borderColor: "var(--line-2)", background: "var(--bg-3)" }}
            />
          </Field>
        )}
      </div>

      <div className="sticky bottom-0 flex items-center gap-3 border-t px-5 py-4 backdrop-blur-xl" style={{ borderColor: "var(--line)", background: "color-mix(in srgb, var(--bg-2) 85%, transparent)" }}>
        {onDelete && entry.title && (
          <button
            onClick={() => {
              if (confirm(t.deleteConfirm)) onDelete(entry.id);
            }}
            className="btn btn-outline px-3 py-2 text-sm"
            style={{ color: "#ef4444", borderColor: "color-mix(in srgb, #ef4444 40%, transparent)" }}
          >
            <Icon name="trash" size={16} />
          </button>
        )}
        <button onClick={onClose} className="btn btn-outline ms-auto px-4 py-2 text-sm">
          {t.cancel}
        </button>
        <button onClick={commit} className="btn btn-accent px-5 py-2 text-sm">
          <Icon name="check" size={16} /> {t.save}
        </button>
      </div>
    </Modal>
  );
}

function defaultTitle(e: VaultEntry, t: VaultStrings): string {
  if (e.type === "login") return e.url || e.username || t.logins;
  if (e.type === "card") return e.cardBrand || t.cards;
  if (e.type === "identity") return e.fullName || t.identities;
  if (e.type === "totp") return e.otpIssuer || t.authenticator;
  return t.notes;
}
