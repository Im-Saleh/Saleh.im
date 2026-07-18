/* ============================================================================
   Vault — data model, persistence & offline security audit.

   The decrypted vault lives only in memory (React state). What touches disk
   (localStorage) is either public KDF metadata or the sealed ciphertext blob
   produced by the eight-stage cascade in ./crypto. There is no server.
   ========================================================================== */

import {
  open,
  passwordVerifier,
  analyzeStrength,
  sha256Hex,
  randomBytes,
  bytesToB64,
  b64ToBytes,
  deriveMasterV2,
  sealWithMaster,
  openWithMaster,
  verifierFromMaster,
  KDF_ITERATIONS_V2,
  VaultAuthError,
  type VaultContainer,
  isVaultContainer,
} from "./crypto";

/** The decrypted vault plus the cached 512-bit master used for fast re-seals. */
export type UnlockResult = { data: VaultData; master: Uint8Array };

export type EntryType = "login" | "note" | "card" | "identity" | "totp";

export type VaultEntry = {
  id: string;
  type: EntryType;
  title: string;
  favorite: boolean;
  folder: string; // folder id or "" for none
  tags: string[];
  notes: string;
  createdAt: number;
  updatedAt: number;
  usedAt?: number;

  // login
  username?: string;
  password?: string;
  url?: string;
  totpSecret?: string; // inline 2FA for a login

  // card
  cardholder?: string;
  cardNumber?: string;
  cardExpiry?: string;
  cardCvv?: string;
  cardBrand?: string;

  // identity
  fullName?: string;
  email?: string;
  phone?: string;
  address?: string;

  // standalone totp
  otpSecret?: string;
  otpIssuer?: string;
  otpDigits?: number;
  otpPeriod?: number;
};

export type Folder = { id: string; name: string; icon: string };

export type VaultSettings = {
  autoLockMinutes: number;
  clipboardClearSeconds: number;
  concealByDefault: boolean;
  lockOnHide: boolean;
  theme: "carbon" | "paper";
};

export type VaultData = {
  version: number;
  entries: VaultEntry[];
  folders: Folder[];
  settings: VaultSettings;
  createdAt: number;
};

export type VaultMeta = {
  version: number;
  salt: string; // base64 (verifier salt)
  iterations: number;
  verifier: string; // base64 verifier hash
  createdAt: number;
  hint?: string;
  keyfile?: boolean; // whether a keyfile second factor is required
};

/** Whether this device's vault was sealed with a keyfile second factor. */
export function vaultRequiresKeyfile(): boolean {
  return !!loadMeta()?.keyfile;
}

const KEY_META = "saleh.vault.meta.v1";
const KEY_BLOB = "saleh.vault.blob.v1";

export const DEFAULT_SETTINGS: VaultSettings = {
  autoLockMinutes: 5,
  clipboardClearSeconds: 20,
  concealByDefault: true,
  lockOnHide: true,
  theme: "carbon",
};

export const DEFAULT_FOLDERS: Folder[] = [
  { id: "personal", name: "Personal", icon: "◆" },
  { id: "work", name: "Work", icon: "▲" },
  { id: "finance", name: "Finance", icon: "$" },
];

/* --------------------------------------------------------------------------
   id + storage plumbing
   ------------------------------------------------------------------------ */

export function uid(): string {
  return bytesToB64(randomBytes(12)).replace(/[^a-zA-Z0-9]/g, "").slice(0, 16) || Math.random().toString(36).slice(2);
}

function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function safeSet(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {}
}
function safeRemove(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {}
}

export function hasVault(): boolean {
  return !!safeGet(KEY_META) && !!safeGet(KEY_BLOB);
}

export function loadMeta(): VaultMeta | null {
  const raw = safeGet(KEY_META);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as VaultMeta;
  } catch {
    return null;
  }
}

function loadContainer(): VaultContainer | null {
  const raw = safeGet(KEY_BLOB);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return isVaultContainer(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/* --------------------------------------------------------------------------
   create / unlock / persist
   ------------------------------------------------------------------------ */

export function emptyVault(): VaultData {
  return {
    version: 1,
    entries: [],
    folders: [...DEFAULT_FOLDERS],
    settings: { ...DEFAULT_SETTINGS },
    createdAt: Date.now(),
  };
}

function normalize(data: VaultData): VaultData {
  if (!data.folders) data.folders = [...DEFAULT_FOLDERS];
  if (!data.settings) data.settings = { ...DEFAULT_SETTINGS };
  if (!data.entries) data.entries = [];
  return data;
}

export async function createVault(password: string, hint?: string, keyfile?: Uint8Array | null): Promise<UnlockResult> {
  const kdfSalt = randomBytes(16);
  const iterations = KDF_ITERATIONS_V2;
  const master = await deriveMasterV2(password, kdfSalt, iterations, keyfile); // heavy — once
  const verifier = await verifierFromMaster(master, kdfSalt);
  const meta: VaultMeta = {
    version: 2,
    salt: bytesToB64(kdfSalt),
    iterations,
    verifier,
    createdAt: Date.now(),
    hint: hint || undefined,
    keyfile: !!(keyfile && keyfile.length),
  };
  const data = emptyVault();
  const container = await sealWithMaster(master, JSON.stringify(data), iterations, kdfSalt);
  safeSet(KEY_META, JSON.stringify(meta));
  safeSet(KEY_BLOB, JSON.stringify(container));
  return { data, master };
}

/** Fast, pre-decrypt password check via the verifier hash. */
export async function verifyPassword(password: string, keyfile?: Uint8Array | null): Promise<boolean> {
  const meta = loadMeta();
  if (!meta) return false;
  if (meta.version >= 2) {
    const kdfSalt = b64ToBytes(meta.salt);
    const master = await deriveMasterV2(password, kdfSalt, meta.iterations, keyfile);
    return (await verifierFromMaster(master, kdfSalt)) === meta.verifier;
  }
  const v = await passwordVerifier(password, b64ToBytes(meta.salt), meta.iterations, keyfile);
  return v === meta.verifier;
}

export async function unlockVault(password: string, keyfile?: Uint8Array | null): Promise<UnlockResult> {
  const container = loadContainer();
  const meta = loadMeta();
  if (!container || !meta) throw new Error("No vault found on this device.");

  // v2 — derive the heavy master once, verify, then decrypt with it (cached).
  if (meta.version >= 2 && (container.v || 1) >= 2 && container.kdfSalt) {
    const kdfSalt = b64ToBytes(meta.salt);
    const master = await deriveMasterV2(password, kdfSalt, meta.iterations, keyfile);
    if ((await verifierFromMaster(master, kdfSalt)) !== meta.verifier) throw new VaultAuthError();
    const data = normalize(JSON.parse(await openWithMaster(master, container)) as VaultData);
    return { data, master };
  }

  // v1 — decrypt with the legacy password path, then transparently upgrade to v2.
  const data = normalize(JSON.parse(await open(password, container, keyfile)) as VaultData);
  const kdfSalt = randomBytes(16);
  const iterations = KDF_ITERATIONS_V2;
  const master = await deriveMasterV2(password, kdfSalt, iterations, keyfile);
  const upgraded: VaultMeta = {
    version: 2, salt: bytesToB64(kdfSalt), iterations,
    verifier: await verifierFromMaster(master, kdfSalt),
    createdAt: meta.createdAt ?? Date.now(), hint: meta.hint, keyfile: !!(keyfile && keyfile.length),
  };
  safeSet(KEY_META, JSON.stringify(upgraded));
  safeSet(KEY_BLOB, JSON.stringify(await sealWithMaster(master, JSON.stringify(data), iterations, kdfSalt)));
  return { data, master };
}

/** The fast per-save path — reuses the cached master, no KDF (≈ a few ms). */
export async function persistVault(master: Uint8Array, data: VaultData): Promise<void> {
  const meta = loadMeta();
  if (!meta) throw new Error("No vault metadata on this device.");
  const container = await sealWithMaster(master, JSON.stringify(data), meta.iterations, b64ToBytes(meta.salt));
  safeSet(KEY_BLOB, JSON.stringify(container));
}

export function destroyVault(): void {
  safeRemove(KEY_META);
  safeRemove(KEY_BLOB);
}

/** Change the master password: re-derive verifier + re-seal the blob. */
export async function changeMasterPassword(
  oldPassword: string,
  newPassword: string,
  hint?: string,
  oldKeyfile?: Uint8Array | null,
  newKeyfile?: Uint8Array | null
): Promise<Uint8Array> {
  const { data } = await unlockVault(oldPassword, oldKeyfile); // validates the old password
  const kf = newKeyfile !== undefined ? newKeyfile : oldKeyfile;
  const kdfSalt = randomBytes(16);
  const iterations = KDF_ITERATIONS_V2;
  const master = await deriveMasterV2(newPassword, kdfSalt, iterations, kf);
  const meta: VaultMeta = {
    version: 2,
    salt: bytesToB64(kdfSalt),
    iterations,
    verifier: await verifierFromMaster(master, kdfSalt),
    createdAt: loadMeta()?.createdAt ?? Date.now(),
    hint: hint ?? loadMeta()?.hint,
    keyfile: !!(kf && kf.length),
  };
  safeSet(KEY_META, JSON.stringify(meta));
  safeSet(KEY_BLOB, JSON.stringify(await sealWithMaster(master, JSON.stringify(data), iterations, kdfSalt)));
  return master;
}

/* --------------------------------------------------------------------------
   encrypted backup export / import
   ------------------------------------------------------------------------ */

export type Backup = { meta: VaultMeta; container: VaultContainer; exportedAt: number; app: string };

export function exportBackup(): string | null {
  const meta = loadMeta();
  const container = loadContainer();
  if (!meta || !container) return null;
  const backup: Backup = { meta, container, exportedAt: Date.now(), app: "saleh.im/vault" };
  return JSON.stringify(backup, null, 2);
}

export async function importBackup(json: string, password: string, keyfile?: Uint8Array | null): Promise<UnlockResult> {
  const backup = JSON.parse(json) as Backup;
  if (!backup.meta || !backup.container) throw new Error("Not a valid Vault backup.");
  // validate the password against the imported container before committing
  await open(password, backup.container, keyfile);
  safeSet(KEY_META, JSON.stringify(backup.meta));
  safeSet(KEY_BLOB, JSON.stringify(backup.container));
  // unlock re-derives the cached master and upgrades a v1 backup to v2 in place
  return unlockVault(password, keyfile);
}

/* --------------------------------------------------------------------------
   search / filter / sort
   ------------------------------------------------------------------------ */

export type SortKey = "title" | "updated" | "created" | "used";

export function filterEntries(
  entries: VaultEntry[],
  opts: { query?: string; type?: EntryType | "all"; folder?: string | "all"; favorites?: boolean; tag?: string }
): VaultEntry[] {
  const q = (opts.query || "").trim().toLowerCase();
  return entries.filter((e) => {
    if (opts.type && opts.type !== "all" && e.type !== opts.type) return false;
    if (opts.folder && opts.folder !== "all" && e.folder !== opts.folder) return false;
    if (opts.favorites && !e.favorite) return false;
    if (opts.tag && !e.tags.includes(opts.tag)) return false;
    if (!q) return true;
    const hay = [e.title, e.username, e.url, e.email, e.notes, e.otpIssuer, e.cardholder, ...e.tags]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return hay.includes(q);
  });
}

export function sortEntries(entries: VaultEntry[], key: SortKey, dir: "asc" | "desc" = "desc"): VaultEntry[] {
  const sign = dir === "asc" ? 1 : -1;
  const copy = [...entries];
  copy.sort((a, b) => {
    let cmp = 0;
    switch (key) {
      case "title":
        cmp = a.title.localeCompare(b.title);
        return dir === "asc" ? cmp : -cmp;
      case "updated":
        cmp = a.updatedAt - b.updatedAt;
        break;
      case "created":
        cmp = a.createdAt - b.createdAt;
        break;
      case "used":
        cmp = (a.usedAt || 0) - (b.usedAt || 0);
        break;
    }
    return sign * cmp;
  });
  return copy;
}

export function allTags(entries: VaultEntry[]): string[] {
  const set = new Set<string>();
  for (const e of entries) for (const t of e.tags) set.add(t);
  return [...set].sort();
}

/* --------------------------------------------------------------------------
   security audit — entirely offline
   ------------------------------------------------------------------------ */

export type AuditIssue = {
  entryId: string;
  title: string;
  kind: "weak" | "reused" | "old" | "no-2fa" | "insecure-url";
  detail: string;
  faDetail: string;
};

export type AuditResult = {
  score: number; // 0..100
  totalWithPasswords: number;
  weak: AuditIssue[];
  reused: AuditIssue[];
  old: AuditIssue[];
  no2fa: AuditIssue[];
  insecure: AuditIssue[];
  averageEntropy: number;
};

const NINETY_DAYS = 1000 * 60 * 60 * 24 * 90;
const YEAR = 1000 * 60 * 60 * 24 * 365;

export async function auditVault(entries: VaultEntry[]): Promise<AuditResult> {
  const logins = entries.filter((e) => e.type === "login" && e.password);
  const weak: AuditIssue[] = [];
  const reused: AuditIssue[] = [];
  const old: AuditIssue[] = [];
  const no2fa: AuditIssue[] = [];
  const insecure: AuditIssue[] = [];

  // reuse detection via local hashes (never store plaintext)
  const hashes = new Map<string, string[]>(); // hash -> entry ids
  let entropySum = 0;

  for (const e of logins) {
    const pw = e.password!;
    const s = analyzeStrength(pw);
    entropySum += s.entropyBits;

    if (s.score <= 1) {
      weak.push({
        entryId: e.id,
        title: e.title,
        kind: "weak",
        detail: `Weak password (~${s.entropyBits} bits). ${s.warnings[0] || ""}`.trim(),
        faDetail: `رمزِ ضعیف (~${s.entropyBits} بیت). ${s.faWarnings[0] || ""}`.trim(),
      });
    }

    const h = await sha256Hex(pw);
    const arr = hashes.get(h) || [];
    arr.push(e.id);
    hashes.set(h, arr);

    const age = Date.now() - (e.updatedAt || e.createdAt);
    if (age > YEAR) {
      old.push({
        entryId: e.id,
        title: e.title,
        kind: "old",
        detail: "Password is over a year old — consider rotating it.",
        faDetail: "رمز بیش از یک سال قدمت دارد — بهتر است تغییرش دهی.",
      });
    }

    if (!e.totpSecret) {
      no2fa.push({
        entryId: e.id,
        title: e.title,
        kind: "no-2fa",
        detail: "No 2FA attached to this login.",
        faDetail: "احرازِ دومرحله‌ای برای این ورود تنظیم نشده.",
      });
    }

    if (e.url && /^http:\/\//i.test(e.url)) {
      insecure.push({
        entryId: e.id,
        title: e.title,
        kind: "insecure-url",
        detail: "URL uses plain HTTP (not HTTPS).",
        faDetail: "آدرس از HTTP ساده استفاده می‌کند (نه HTTPS).",
      });
    }
  }

  for (const [, ids] of hashes) {
    if (ids.length > 1) {
      for (const id of ids) {
        const e = logins.find((x) => x.id === id)!;
        reused.push({
          entryId: id,
          title: e.title,
          kind: "reused",
          detail: `Reused across ${ids.length} entries.`,
          faDetail: `در ${ids.length} مورد تکرار شده.`,
        });
      }
    }
  }

  const total = logins.length || 1;
  const penalty =
    weak.length * 14 + reused.length * 10 + old.length * 4 + no2fa.length * 3 + insecure.length * 6;
  const score = Math.max(0, Math.min(100, Math.round(100 - penalty / total)));
  const averageEntropy = Math.round(entropySum / total);

  return {
    score,
    totalWithPasswords: logins.length,
    weak,
    reused,
    old,
    no2fa,
    insecure,
    averageEntropy,
  };
}

/* --------------------------------------------------------------------------
   small helpers used by the UI
   ------------------------------------------------------------------------ */

export function detectCardBrand(number: string): string {
  const n = number.replace(/\s+/g, "");
  if (/^4/.test(n)) return "Visa";
  if (/^5[1-5]/.test(n) || /^2[2-7]/.test(n)) return "Mastercard";
  if (/^3[47]/.test(n)) return "Amex";
  if (/^6(?:011|5)/.test(n)) return "Discover";
  if (/^35/.test(n)) return "JCB";
  if (/^62/.test(n)) return "UnionPay";
  return "Card";
}

export function faviconFor(url?: string): string | null {
  if (!url) return null;
  try {
    const u = new URL(url.startsWith("http") ? url : `https://${url}`);
    return `https://www.google.com/s2/favicons?domain=${u.hostname}&sz=64`;
  } catch {
    return null;
  }
}

export function domainOf(url?: string): string {
  if (!url) return "";
  try {
    const u = new URL(url.startsWith("http") ? url : `https://${url}`);
    return u.hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export function newEntry(type: EntryType): VaultEntry {
  const now = Date.now();
  return {
    id: uid(),
    type,
    title: "",
    favorite: false,
    folder: "",
    tags: [],
    notes: "",
    createdAt: now,
    updatedAt: now,
  };
}
