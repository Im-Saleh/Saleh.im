"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { detect, toVaultEntries, type DetectedItem } from "@/lib/vault/importer";
import { domainOf, faviconFor, type Folder, type VaultEntry } from "@/lib/vault/store";
import { Icon, Modal, type VaultStrings } from "./ui";

/* ============================================================================
   ImportModal — paste/upload any password export or messy login text; the
   detector figures out the format, previews every credential, and imports the
   selected ones as encrypted vault entries. All local.
   ========================================================================== */

export function ImportModal({
  t,
  fa,
  folders,
  onImport,
  onClose,
}: {
  t: VaultStrings;
  fa: boolean;
  folders: Folder[];
  onImport: (entries: VaultEntry[]) => void;
  onClose: () => void;
}) {
  const [raw, setRaw] = useState("");
  const [folder, setFolder] = useState("");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [touched, setTouched] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const result = useMemo(() => detect(raw), [raw]);
  const items = result.items;

  // whenever the detected set changes, select everything by default
  const sig = items.map((i) => `${i.title}|${i.username ?? ""}|${i.password ?? ""}|${i.otpSecret ?? ""}`).join("¶");
  useEffect(() => {
    setSelected(new Set(items.map((_, i) => i)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig]);

  const toggle = (i: number) =>
    setSelected((s) => {
      const n = new Set(s);
      n.has(i) ? n.delete(i) : n.add(i);
      return n;
    });

  const allOn = items.length > 0 && selected.size === items.length;
  const setAll = (on: boolean) => setSelected(on ? new Set(items.map((_, i) => i)) : new Set());

  const onFile = async (file: File) => {
    const text = await file.text();
    setRaw(text);
    setTouched(true);
  };

  const doImport = () => {
    const chosen = items.filter((_, i) => selected.has(i));
    if (!chosen.length) return;
    onImport(toVaultEntries(chosen, folder));
  };

  return (
    <Modal open onClose={onClose} wide>
      <div className="sticky top-0 z-10 flex items-center justify-between border-b px-5 py-4 backdrop-blur-xl" style={{ borderColor: "var(--line)", background: "color-mix(in srgb, var(--bg-2) 85%, transparent)" }}>
        <div className="flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-xl" style={{ background: "color-mix(in srgb, var(--accent) 16%, transparent)", color: "var(--accent)" }}>
            <Icon name="upload" size={18} />
          </span>
          <div>
            <h3 className="font-display text-lg leading-none">{t.importTitle}</h3>
            {items.length > 0 && (
              <p className="mono mt-1 text-[11px] text-[var(--fg-2)]">
                {t.importFormat}: {result.format} · {fa ? items.length.toLocaleString("fa-IR") : items.length} {t.importDetected}
              </p>
            )}
          </div>
        </div>
        <button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full border" style={{ borderColor: "var(--line-2)" }}>
          <Icon name="x" size={16} />
        </button>
      </div>

      <div className="space-y-4 p-5">
        <p className="text-sm leading-relaxed text-[var(--fg-2)]">{t.importSub}</p>

        <div className="relative">
          <textarea
            value={raw}
            onChange={(e) => { setRaw(e.target.value); setTouched(true); }}
            rows={6}
            spellCheck={false}
            placeholder={t.importPaste}
            className="force-ltr w-full resize-y rounded-xl border bg-transparent p-3.5 font-mono text-xs outline-none transition-colors focus:border-[var(--accent)]"
            style={{ borderColor: "var(--line-2)", background: "var(--bg-3)" }}
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button onClick={() => fileRef.current?.click()} className="btn btn-outline px-3.5 py-2 text-sm">
            <Icon name="download" size={15} /> {t.importChooseFile}
          </button>
          <input ref={fileRef} type="file" accept=".csv,.txt,.tsv,text/csv,text/plain" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.currentTarget.value = ""; }} />
          <button
            onClick={async () => {
              try { const clip = await navigator.clipboard.readText(); if (clip) { setRaw(clip); setTouched(true); } } catch {}
            }}
            className="btn btn-outline px-3.5 py-2 text-sm"
          >
            <Icon name="copy" size={15} /> {t.detectPaste}
          </button>
          {items.length > 0 && (
            <button onClick={() => setAll(!allOn)} className="ms-auto text-xs text-[var(--fg-2)] hover:text-[var(--fg)]">
              {allOn ? t.importDeselectAll : t.importSelectAll}
            </button>
          )}
        </div>

        {/* preview */}
        {items.length === 0 ? (
          touched && raw.trim() ? (
            <div className="rounded-xl border border-dashed py-8 text-center text-sm text-[var(--fg-2)]" style={{ borderColor: "var(--line-2)" }}>
              {t.importNothing}
            </div>
          ) : null
        ) : (
          <div className="thin-scroll max-h-[38vh] overflow-auto rounded-xl border" style={{ borderColor: "var(--line)" }}>
            {items.map((it, i) => (
              <PreviewRow key={i} item={it} selected={selected.has(i)} onToggle={() => toggle(i)} />
            ))}
          </div>
        )}
      </div>

      <div className="sticky bottom-0 flex flex-wrap items-center gap-3 border-t px-5 py-4 backdrop-blur-xl" style={{ borderColor: "var(--line)", background: "color-mix(in srgb, var(--bg-2) 85%, transparent)" }}>
        <span className="hidden text-[11px] text-[var(--fg-2)] sm:block">{t.importSources}</span>
        {folders.length > 0 && (
          <label className="ms-auto flex items-center gap-2 text-xs text-[var(--fg-2)]">
            {t.importInto}
            <select value={folder} onChange={(e) => setFolder(e.target.value)} className="rounded-lg border bg-transparent px-2 py-1.5 text-sm" style={{ borderColor: "var(--line-2)", background: "var(--bg-3)" }}>
              <option value="">{t.noFolder}</option>
              {folders.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          </label>
        )}
        <button onClick={onClose} className={folders.length > 0 ? "btn btn-outline px-4 py-2 text-sm" : "btn btn-outline ms-auto px-4 py-2 text-sm"}>
          {t.cancel}
        </button>
        <button onClick={doImport} disabled={selected.size === 0} className="btn btn-accent px-5 py-2 text-sm disabled:opacity-40">
          <Icon name="check" size={16} /> {t.importAdd} {selected.size > 0 ? (fa ? selected.size.toLocaleString("fa-IR") : selected.size) : ""} {t.importItems}
        </button>
      </div>
    </Modal>
  );
}

function PreviewRow({ item, selected, onToggle }: { item: DetectedItem; selected: boolean; onToggle: () => void }) {
  const fav = item.url ? faviconFor(item.url) : null;
  return (
    <button
      onClick={onToggle}
      className="flex w-full items-center gap-3 border-b px-3.5 py-2.5 text-start transition-colors last:border-0 hover:bg-[var(--bg-3)]"
      style={{ borderColor: "var(--line)" }}
    >
      <span
        className="grid h-5 w-5 shrink-0 place-items-center rounded-md border transition-colors"
        style={{
          borderColor: selected ? "var(--accent)" : "var(--line-2)",
          background: selected ? "var(--accent)" : "transparent",
          color: selected ? "var(--on-accent)" : "transparent",
        }}
      >
        <Icon name="check" size={13} />
      </span>
      <span className="grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-lg" style={{ background: "var(--bg-3)", color: "var(--accent)" }}>
        {item.kind === "totp" ? (
          <Icon name="shield" size={16} />
        ) : fav ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={fav} alt="" width={18} height={18} className="rounded" onError={(e) => { (e.currentTarget.style.display = "none"); }} />
        ) : (
          <Icon name="key" size={16} />
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{item.title}</span>
        <span className="mono block truncate text-[11px] text-[var(--fg-2)] force-ltr">
          {item.kind === "totp" ? (item.otpIssuer || "authenticator") : [item.username, item.url ? domainOf(item.url) : ""].filter(Boolean).join(" · ") || "—"}
        </span>
      </span>
      {item.kind === "login" && item.password && (
        <span className="mono shrink-0 text-[11px] text-[var(--fg-2)]">••••••</span>
      )}
      {item.kind === "totp" && (
        <span className="shrink-0 rounded-full px-2 py-0.5 text-[10px]" style={{ background: "color-mix(in srgb, var(--accent) 16%, transparent)", color: "var(--accent)" }}>2FA</span>
      )}
    </button>
  );
}
