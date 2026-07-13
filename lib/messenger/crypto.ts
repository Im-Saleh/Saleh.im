/**
 * Cipher — heavy, layered end-to-end cryptography (browser WebCrypto), in TS.
 *
 * TRANSPORT: ECDH (P-256) → 4-layer seal
 *   plaintext → pad → AES-256-GCM (K1) → AES-256-GCM (K2)
 *             → HMAC-SHA256 keystream XOR (K3) → HMAC-SHA256 tag (Kmac) → base64
 * AT REST: history encrypted with a PBKDF2 (310k) vault key from the password.
 * All session keys are ephemeral (in memory only).
 */

const enc = new TextEncoder();
const dec = new TextDecoder();
const subtle = () => crypto.subtle;

export type SessionKeys = {
  k1: CryptoKey;
  k2: CryptoKey;
  k3: CryptoKey;
  km: CryptoKey;
  fingerprint: string;
};

export type Vault = { key: CryptoKey; salt: string };

/* ---------- bytes ---------- */
function concat(...arrs: Uint8Array[]): Uint8Array {
  let total = 0;
  for (const a of arrs) total += a.length;
  const out = new Uint8Array(total);
  let off = 0;
  for (const a of arrs) {
    out.set(a, off);
    off += a.length;
  }
  return out;
}
function b64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}
function unb64(str: string): Uint8Array {
  const s = atob(str);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}
function rand(n: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(n));
}
function hex(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += bytes[i].toString(16).padStart(2, "0");
  return s;
}
function ctEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a[i] ^ b[i];
  return d === 0;
}

/* ---------- key derivation ---------- */
async function deriveBits(bits: Uint8Array, salt: string): Promise<Uint8Array> {
  const base = await subtle().importKey("raw", bits, "PBKDF2", false, ["deriveBits"]);
  const out = await subtle().deriveBits(
    { name: "PBKDF2", salt: enc.encode("cipher::" + salt), iterations: 120000, hash: "SHA-256" },
    base,
    256
  );
  return new Uint8Array(out);
}
async function deriveAes(bits: Uint8Array, salt: string): Promise<CryptoKey> {
  const base = await subtle().importKey("raw", bits, "PBKDF2", false, ["deriveKey"]);
  return subtle().deriveKey(
    { name: "PBKDF2", salt: enc.encode("cipher::" + salt), iterations: 120000, hash: "SHA-256" },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

async function expandKeys(shared: ArrayBuffer): Promise<SessionKeys> {
  const raw = new Uint8Array(shared);
  const k1 = await deriveAes(raw, "layerA");
  const k2 = await deriveAes(raw, "layerB");
  const k3bits = await deriveBits(raw, "layerC");
  const kmBits = await deriveBits(raw, "auth");
  const k3 = await subtle().importKey("raw", k3bits, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const km = await subtle().importKey("raw", kmBits, { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
  const fp = await deriveBits(raw, "fingerprint");
  return { k1, k2, k3, km, fingerprint: hex(fp).slice(0, 24) };
}

/* ---------- ECDH ---------- */
export async function genECDH(): Promise<CryptoKeyPair> {
  return subtle().generateKey({ name: "ECDH", namedCurve: "P-256" }, false, ["deriveBits"]) as Promise<CryptoKeyPair>;
}
export async function exportPub(pair: CryptoKeyPair): Promise<string> {
  const raw = await subtle().exportKey("raw", pair.publicKey);
  return b64(new Uint8Array(raw));
}
export async function deriveShared(pair: CryptoKeyPair, peerPubB64: string): Promise<SessionKeys> {
  const peerKey = await subtle().importKey("raw", unb64(peerPubB64), { name: "ECDH", namedCurve: "P-256" }, false, []);
  const bits = await subtle().deriveBits({ name: "ECDH", public: peerKey }, pair.privateKey, 256);
  return expandKeys(bits);
}

/* ---------- AES-GCM layer ---------- */
async function aesEnc(key: CryptoKey, data: Uint8Array): Promise<Uint8Array> {
  const iv = rand(12);
  const ct = new Uint8Array(await subtle().encrypt({ name: "AES-GCM", iv }, key, data));
  return concat(iv, ct);
}
async function aesDec(key: CryptoKey, blob: Uint8Array): Promise<Uint8Array> {
  return new Uint8Array(await subtle().decrypt({ name: "AES-GCM", iv: blob.slice(0, 12) }, key, blob.slice(12)));
}

/* ---------- HMAC keystream ---------- */
async function keystream(k3: CryptoKey, nonce: Uint8Array, length: number): Promise<Uint8Array> {
  const out = new Uint8Array(length);
  let counter = 0;
  let off = 0;
  while (off < length) {
    const ctr = new Uint8Array(4);
    new DataView(ctr.buffer).setUint32(0, counter, false);
    const block = new Uint8Array(await subtle().sign("HMAC", k3, concat(nonce, ctr)));
    const take = Math.min(block.length, length - off);
    out.set(block.subarray(0, take), off);
    off += take;
    counter++;
  }
  return out;
}
async function streamXor(k3: CryptoKey, data: Uint8Array): Promise<Uint8Array> {
  const nonce = rand(16);
  const ks = await keystream(k3, nonce, data.length);
  const out = new Uint8Array(data.length);
  for (let i = 0; i < data.length; i++) out[i] = data[i] ^ ks[i];
  return concat(nonce, out);
}
async function streamUnxor(k3: CryptoKey, blob: Uint8Array): Promise<Uint8Array> {
  const nonce = blob.slice(0, 16);
  const data = blob.slice(16);
  const ks = await keystream(k3, nonce, data.length);
  const out = new Uint8Array(data.length);
  for (let i = 0; i < data.length; i++) out[i] = data[i] ^ ks[i];
  return out;
}

/* ---------- padding ---------- */
function pad(bytes: Uint8Array): Uint8Array {
  const padLen = 24 + Math.floor(Math.random() * 72);
  const header = new Uint8Array(4);
  new DataView(header.buffer).setUint32(0, bytes.length, false);
  return concat(header, bytes, rand(padLen));
}
function unpad(bytes: Uint8Array): Uint8Array {
  const len = new DataView(bytes.buffer, bytes.byteOffset, 4).getUint32(0, false);
  return bytes.slice(4, 4 + len);
}

/* ---------- seal / open ---------- */
export async function seal(keys: SessionKeys, plaintext: string): Promise<string> {
  const data = pad(enc.encode(plaintext));
  const a = await aesEnc(keys.k1, data);
  const b = await aesEnc(keys.k2, a);
  const c = await streamXor(keys.k3, b);
  const tag = new Uint8Array(await subtle().sign("HMAC", keys.km, c));
  return b64(concat(tag, c));
}
export async function open(keys: SessionKeys, payload: string): Promise<string> {
  const blob = unb64(payload);
  const tag = blob.slice(0, 32);
  const c = blob.slice(32);
  const expected = new Uint8Array(await subtle().sign("HMAC", keys.km, c));
  if (!ctEqual(tag, expected)) throw new Error("authentication failed");
  const b = await streamUnxor(keys.k3, c);
  const a = await aesDec(keys.k2, b);
  const data = await aesDec(keys.k1, a);
  return dec.decode(unpad(data));
}

/* ---------- at-rest vault ---------- */
export async function deriveVaultKey(password: string, saltB64?: string): Promise<Vault> {
  const salt = saltB64 ? unb64(saltB64) : rand(16);
  const base = await subtle().importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveKey"]);
  const key = await subtle().deriveKey(
    { name: "PBKDF2", salt, iterations: 310000, hash: "SHA-256" },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
  return { key, salt: b64(salt) };
}
export async function vaultEncrypt(vault: Vault, obj: unknown): Promise<string> {
  const data = enc.encode(JSON.stringify(obj));
  const iv = rand(12);
  const ct = new Uint8Array(await subtle().encrypt({ name: "AES-GCM", iv }, vault.key, data));
  return b64(concat(iv, ct));
}
export async function vaultDecrypt<T>(vault: Vault, payload: string): Promise<T> {
  const blob = unb64(payload);
  const pt = await subtle().decrypt({ name: "AES-GCM", iv: blob.slice(0, 12) }, vault.key, blob.slice(12));
  return JSON.parse(dec.decode(new Uint8Array(pt))) as T;
}

/* ---------- misc ---------- */
export async function sha256Hex(str: string): Promise<string> {
  return hex(new Uint8Array(await subtle().digest("SHA-256", enc.encode(str))));
}
export function sanitize(u: string): string {
  return u.toLowerCase().replace(/[^a-z0-9]/g, "");
}
