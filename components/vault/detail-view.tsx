"use client";

import { useState } from "react";
import { domainOf, faviconFor, type Folder, type VaultEntry } from "@/lib/vault/store";
import { Icon, Modal, useClipboard, type VaultStrings } from "./ui";
import { TotpRing } from "./totp-ring";

/* ============================================================================
   DetailView — a read-only, copy-first view of a single item. Secrets stay
   concealed until revealed; copy buttons route through the auto-clearing
   clipboard helper.
   ========================================================================== */

export function DetailView({
  entry,
  folders,
  t,
  fa,
  concealDefault,
  clearSeconds,
  onEdit,
  onClose,
  onDelete,
  onToggleFavorite,
}: {
  entry: VaultEntry;
  folders: Folder[];
  t: VaultStrings;
  fa: boolean;
  concealDefault: boolean;
  clearSeconds: number;
  onEdit: () => void;
  onClose: () => void;
  onDelete: (id: string) => void;
  onToggleFavorite: (id: string) => void;
}) {
  const { copy, copiedKey } = useClipboard(clearSeconds);
  const [reveal, setReveal] = useState(!concealDefault);
  const [revealCvv, setRevealCvv] = useState(false);

  const folder = folders.find((f) => f.id === entry.folder);
  const fav = faviconFor(entry.url);

  const Row = ({ label, value, secret, copyKey, mono }: { label: string; value?: string; secret?: boolean; copyKey?: string; mono?: boolean }) => {
    if (!value) return null;
    const shown = secret && !reveal ? "•".repeat(Math.min(16, value.length)) : value;
    return (
      <div className="flex items-center justify-between gap-3 border-t py-3 first:border-t-0" style={{ borderColor: "var(--line)" }}>
        <div className="min-w-0">
          <p className="label mb-0.5">{label}</p>
          <p className={`truncate text-sm ${mono || secret ? "mono force-ltr" : ""}`}>{shown}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {secret && (
            <button onClick={() => setReveal((r) => !r)} className="grid h-8 w-8 place-items-center rounded-lg text-[var(--fg-2)] hover:text-[var(--fg)]">
              <Icon name={reveal ? "eye-off" : "eye"} size={16} />
            </button>
          )}
          {copyKey && (
            <button onClick={() => copy(value, copyKey)} className="grid h-8 w-8 place-items-center rounded-lg text-[var(--fg-2)] hover:text-[var(--accent)]">
              <Icon name={copiedKey === copyKey ? "check" : "copy"} size={16} />
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <Modal open onClose={onClose}>
      <div className="relative overflow-hidden">
        <div className="conic-sheen" aria-hidden style={{ opacity: 0.12 }} />
        <div className="relative flex items-start justify-between gap-3 border-b p-5" style={{ borderColor: "var(--line)" }}>
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-xl border" style={{ borderColor: "var(--line)", background: "var(--bg-3)" }}>
              {fav ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={fav} alt="" width={24} height={24} onError={(e) => ((e.target as HTMLImageElement).style.display = "none")} />
              ) : (
                <Icon name={entry.type === "login" ? "key" : entry.type === "card" ? "card" : entry.type === "identity" ? "id" : entry.type === "totp" ? "shield" : "note"} size={20} />
              )}
            </span>
            <div className="min-w-0">
              <h3 className="truncate font-display text-xl">{entry.title}</h3>
              {entry.url && <p className="mono truncate text-xs text-[var(--fg-2)] force-ltr">{domainOf(entry.url)}</p>}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <button onClick={() => onToggleFavorite(entry.id)} className="grid h-9 w-9 place-items-center rounded-full" style={{ color: entry.favorite ? "var(--accent)" : "var(--fg-2)" }}>
              <Icon name={entry.favorite ? "star-fill" : "star"} size={18} />
            </button>
            <button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full border" style={{ borderColor: "var(--line-2)" }}>
              <Icon name="x" size={16} />
            </button>
          </div>
        </div>

        <div className="p-5">
          {entry.type === "login" && (
            <>
              <Row label={t.username} value={entry.username} copyKey="u" mono />
              <Row label={t.password} value={entry.password} secret copyKey="p" />
              <Row label={t.website} value={entry.url} copyKey="w" mono />
              {entry.totpSecret && (
                <div className="border-t py-3" style={{ borderColor: "var(--line)" }}>
                  <p className="label mb-2">{t.authenticator}</p>
                  <TotpRing secret={entry.totpSecret} onCopy={(c) => copy(c, "totp")} copied={copiedKey === "totp"} />
                </div>
              )}
            </>
          )}

          {entry.type === "note" && <p className="whitespace-pre-wrap text-sm leading-relaxed">{entry.notes || "—"}</p>}

          {entry.type === "card" && (
            <>
              <Row label={t.cardholder} value={entry.cardholder} copyKey="ch" />
              <Row label={`${t.cardNumber}${entry.cardBrand ? " · " + entry.cardBrand : ""}`} value={entry.cardNumber} secret copyKey="cn" />
              <Row label={t.expiry} value={entry.cardExpiry} copyKey="ce" mono />
              <div className="flex items-center justify-between gap-3 border-t py-3" style={{ borderColor: "var(--line)" }}>
                <div>
                  <p className="label mb-0.5">{t.cvv}</p>
                  <p className="mono text-sm force-ltr">{revealCvv ? entry.cardCvv : "•••"}</p>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => setRevealCvv((r) => !r)} className="grid h-8 w-8 place-items-center rounded-lg text-[var(--fg-2)]">
                    <Icon name={revealCvv ? "eye-off" : "eye"} size={16} />
                  </button>
                  {entry.cardCvv && (
                    <button onClick={() => copy(entry.cardCvv!, "cvv")} className="grid h-8 w-8 place-items-center rounded-lg text-[var(--fg-2)] hover:text-[var(--accent)]">
                      <Icon name={copiedKey === "cvv" ? "check" : "copy"} size={16} />
                    </button>
                  )}
                </div>
              </div>
            </>
          )}

          {entry.type === "identity" && (
            <>
              <Row label={t.fullName} value={entry.fullName} copyKey="fn" />
              <Row label={t.email} value={entry.email} copyKey="em" mono />
              <Row label={t.phone} value={entry.phone} copyKey="ph" mono />
              <Row label={t.address} value={entry.address} copyKey="ad" />
            </>
          )}

          {entry.type === "totp" && entry.otpSecret && (
            <div className="py-2">
              <TotpRing secret={entry.otpSecret} onCopy={(c) => copy(c, "totp")} copied={copiedKey === "totp"} size={68} />
            </div>
          )}

          {entry.notes && entry.type !== "note" && (
            <div className="mt-2 border-t py-3" style={{ borderColor: "var(--line)" }}>
              <p className="label mb-1">Notes</p>
              <p className="whitespace-pre-wrap text-sm text-[var(--fg-2)]">{entry.notes}</p>
            </div>
          )}

          {(folder || entry.tags.length > 0) && (
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              {folder && <span className="chip">{folder.icon} {folder.name}</span>}
              {entry.tags.map((tg) => (
                <span key={tg} className="chip">#{tg}</span>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 border-t px-5 py-4" style={{ borderColor: "var(--line)" }}>
          <button
            onClick={() => {
              if (confirm(t.deleteConfirm)) onDelete(entry.id);
            }}
            className="btn btn-outline px-3 py-2 text-sm"
            style={{ color: "#ef4444", borderColor: "color-mix(in srgb, #ef4444 40%, transparent)" }}
          >
            <Icon name="trash" size={16} />
          </button>
          <button onClick={onEdit} className="btn btn-accent ms-auto px-5 py-2 text-sm">
            <Icon name="edit" size={16} /> {t.edit}
          </button>
        </div>
      </div>
    </Modal>
  );
}
