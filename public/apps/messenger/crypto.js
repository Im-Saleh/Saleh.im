/**
 * Cipher — heavy, layered end-to-end cryptography (browser WebCrypto).
 *
 * TRANSPORT (both modes):
 *   1. ECDH (P-256) ephemeral key exchange derives a shared secret per session.
 *   2. HKDF-style expansion (PBKDF2) splits it into 4 sub-keys.
 *   3. Each message is sealed through:
 *        plaintext → pad+randomize
 *          → Layer A: AES-256-GCM   (K1)
 *          → Layer B: AES-256-GCM   (K2)
 *          → Layer C: HMAC-SHA256 keystream XOR  (K3, ChaCha-style)
 *          → HMAC-SHA256 authentication tag  (Kmac)
 *          → base64 envelope
 *
 * AT REST (P2P mode only):
 *   History is encrypted with a vault key derived from the user's password
 *   (PBKDF2, 310k rounds) before being written to localStorage. Secret mode
 *   never persists anything.
 *
 * All session keys live only in memory and vanish when the tab closes.
 * Built for privacy-by-default UX & learning — for life-or-death threat
 * models prefer a vetted protocol (Signal).
 */
var Cipher = (function () {
  "use strict";

  var enc = new TextEncoder();
  var dec = new TextDecoder();
  var subtle = crypto.subtle;

  /* ---------- byte helpers ---------- */
  function concat() {
    var total = 0, i;
    for (i = 0; i < arguments.length; i++) total += arguments[i].length;
    var out = new Uint8Array(total), off = 0;
    for (i = 0; i < arguments.length; i++) { out.set(arguments[i], off); off += arguments[i].length; }
    return out;
  }
  function b64(bytes) {
    var s = "", i;
    for (i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    return btoa(s);
  }
  function unb64(str) {
    var s = atob(str), out = new Uint8Array(s.length), i;
    for (i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
    return out;
  }
  function rand(n) { return crypto.getRandomValues(new Uint8Array(n)); }
  function ctEqual(a, b) {
    if (a.length !== b.length) return false;
    var d = 0, i;
    for (i = 0; i < a.length; i++) d |= a[i] ^ b[i];
    return d === 0;
  }
  function hex(bytes) {
    var s = "", i;
    for (i = 0; i < bytes.length; i++) s += bytes[i].toString(16).padStart(2, "0");
    return s;
  }

  /* ---------- key derivation ---------- */
  async function deriveKeyFromBits(bits, saltStr, algo, usage) {
    var base = await subtle.importKey("raw", bits, "PBKDF2", false, ["deriveKey", "deriveBits"]);
    var params = { name: "PBKDF2", salt: enc.encode("cipher::" + saltStr), iterations: 120000, hash: "SHA-256" };
    if (algo === "raw") return subtle.deriveBits(params, base, 256);
    return subtle.deriveKey(params, base, algo, false, usage);
  }

  // Split a shared secret (ArrayBuffer) into the four transport sub-keys.
  async function expandKeys(sharedBits) {
    var raw = new Uint8Array(sharedBits);
    var k1 = await deriveKeyFromBits(raw, "layerA", { name: "AES-GCM", length: 256 }, ["encrypt", "decrypt"]);
    var k2 = await deriveKeyFromBits(raw, "layerB", { name: "AES-GCM", length: 256 }, ["encrypt", "decrypt"]);
    var k3bits = await deriveKeyFromBits(raw, "layerC", "raw");
    var kmBits = await deriveKeyFromBits(raw, "auth", "raw");
    var k3 = await subtle.importKey("raw", k3bits, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    var km = await subtle.importKey("raw", kmBits, { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
    var fpBits = await deriveKeyFromBits(raw, "fingerprint", "raw");
    return { k1: k1, k2: k2, k3: k3, km: km, fingerprint: hex(new Uint8Array(fpBits)).slice(0, 24) };
  }

  /* ---------- ECDH ---------- */
  async function genECDH() {
    return subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, false, ["deriveBits"]);
  }
  async function exportPub(keyPair) {
    var raw = await subtle.exportKey("raw", keyPair.publicKey);
    return b64(new Uint8Array(raw));
  }
  async function deriveShared(keyPair, peerPubB64, extraSecret) {
    var peerRaw = unb64(peerPubB64);
    var peerKey = await subtle.importKey("raw", peerRaw, { name: "ECDH", namedCurve: "P-256" }, false, []);
    var bits = await subtle.deriveBits({ name: "ECDH", public: peerKey }, keyPair.privateKey, 256);
    // Mix in an optional shared passphrase (Secret mode "extra lock").
    if (extraSecret) {
      var mixed = concat(new Uint8Array(bits), enc.encode(extraSecret));
      var digest = await subtle.digest("SHA-256", mixed);
      return expandKeys(digest);
    }
    return expandKeys(bits);
  }

  /* ---------- AES-GCM layer ---------- */
  async function aesEnc(key, data) {
    var iv = rand(12);
    var ct = new Uint8Array(await subtle.encrypt({ name: "AES-GCM", iv: iv }, key, data));
    return concat(iv, ct);
  }
  async function aesDec(key, blob) {
    return new Uint8Array(await subtle.decrypt({ name: "AES-GCM", iv: blob.slice(0, 12) }, key, blob.slice(12)));
  }

  /* ---------- HMAC keystream (Layer C) ---------- */
  async function keystream(k3, nonce, length) {
    var out = new Uint8Array(length), counter = 0, off = 0;
    while (off < length) {
      var ctr = new Uint8Array(4);
      new DataView(ctr.buffer).setUint32(0, counter, false);
      var block = new Uint8Array(await subtle.sign("HMAC", k3, concat(nonce, ctr)));
      var take = Math.min(block.length, length - off);
      out.set(block.subarray(0, take), off);
      off += take; counter++;
    }
    return out;
  }
  async function streamXor(k3, data) {
    var nonce = rand(16);
    var ks = await keystream(k3, nonce, data.length);
    var out = new Uint8Array(data.length), i;
    for (i = 0; i < data.length; i++) out[i] = data[i] ^ ks[i];
    return concat(nonce, out);
  }
  async function streamUnxor(k3, blob) {
    var nonce = blob.slice(0, 16), data = blob.slice(16);
    var ks = await keystream(k3, nonce, data.length);
    var out = new Uint8Array(data.length), i;
    for (i = 0; i < data.length; i++) out[i] = data[i] ^ ks[i];
    return out;
  }

  /* ---------- padding (anti traffic-analysis) ---------- */
  function pad(bytes) {
    var padLen = 24 + Math.floor(Math.random() * 72);
    var header = new Uint8Array(4);
    new DataView(header.buffer).setUint32(0, bytes.length, false);
    return concat(header, bytes, rand(padLen));
  }
  function unpad(bytes) {
    var len = new DataView(bytes.buffer, bytes.byteOffset, 4).getUint32(0, false);
    return bytes.slice(4, 4 + len);
  }

  /* ---------- public seal / open ---------- */
  async function seal(keys, plaintext) {
    var data = pad(enc.encode(plaintext));
    var a = await aesEnc(keys.k1, data);
    var b = await aesEnc(keys.k2, a);
    var c = await streamXor(keys.k3, b);
    var tag = new Uint8Array(await subtle.sign("HMAC", keys.km, c));
    return b64(concat(tag, c));
  }
  async function open(keys, payload) {
    var blob = unb64(payload);
    var tag = blob.slice(0, 32), c = blob.slice(32);
    var expected = new Uint8Array(await subtle.sign("HMAC", keys.km, c));
    if (!ctEqual(tag, expected)) throw new Error("authentication failed");
    var b = await streamUnxor(keys.k3, c);
    var a = await aesDec(keys.k2, b);
    var data = await aesDec(keys.k1, a);
    return dec.decode(unpad(data));
  }

  /* ---------- at-rest vault (P2P persistence) ---------- */
  async function deriveVaultKey(password, saltB64) {
    var salt = saltB64 ? unb64(saltB64) : rand(16);
    var base = await subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveKey"]);
    var key = await subtle.deriveKey(
      { name: "PBKDF2", salt: salt, iterations: 310000, hash: "SHA-256" },
      base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]
    );
    return { key: key, salt: b64(salt) };
  }
  async function vaultEncrypt(vault, obj) {
    var data = enc.encode(JSON.stringify(obj));
    var iv = rand(12);
    var ct = new Uint8Array(await subtle.encrypt({ name: "AES-GCM", iv: iv }, vault.key, data));
    return b64(concat(iv, ct));
  }
  async function vaultDecrypt(vault, payload) {
    var blob = unb64(payload);
    var pt = await subtle.decrypt({ name: "AES-GCM", iv: blob.slice(0, 12) }, vault.key, blob.slice(12));
    return JSON.parse(dec.decode(new Uint8Array(pt)));
  }

  /* ---------- misc ---------- */
  async function sha256Hex(str) {
    return hex(new Uint8Array(await subtle.digest("SHA-256", enc.encode(str))));
  }

  return {
    genECDH: genECDH,
    exportPub: exportPub,
    deriveShared: deriveShared,
    seal: seal,
    open: open,
    deriveVaultKey: deriveVaultKey,
    vaultEncrypt: vaultEncrypt,
    vaultDecrypt: vaultDecrypt,
    sha256Hex: sha256Hex,
  };
})();
