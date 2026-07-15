// ============================================================================
//  Vault — cryptographic core implementation (libsodium)
// ============================================================================
#include "crypto.hpp"

#include <sodium.h>

#include <algorithm>
#include <array>
#include <cmath>
#include <cstring>
#include <stdexcept>

namespace vc {

// ---------------------------------------------------------------------------
// lifecycle / randomness
// ---------------------------------------------------------------------------
bool init() { return sodium_init() >= 0; }

Bytes randomBytes(std::size_t n) {
    Bytes b(n);
    if (n) randombytes_buf(b.data(), n);
    return b;
}

uint32_t randomUniform(uint32_t upperBound) {
    return upperBound == 0 ? 0 : randombytes_uniform(upperBound);
}

// ---------------------------------------------------------------------------
// encoding
// ---------------------------------------------------------------------------
std::string toBase64(const Bytes& in) {
    const int variant = sodium_base64_VARIANT_ORIGINAL;
    std::string out;
    out.resize(sodium_base64_encoded_len(in.size(), variant));
    sodium_bin2base64(out.data(), out.size(),
                      in.data(), in.size(), variant);
    if (!out.empty() && out.back() == '\0') out.pop_back();
    return out;
}

Bytes fromBase64(const std::string& in) {
    const int variant = sodium_base64_VARIANT_ORIGINAL;
    Bytes out(in.size());
    std::size_t outLen = 0;
    if (sodium_base642bin(out.data(), out.size(), in.data(), in.size(),
                          nullptr, &outLen, nullptr, variant) != 0) {
        return {};
    }
    out.resize(outLen);
    return out;
}

std::string toHex(const Bytes& in) {
    static const char* h = "0123456789abcdef";
    std::string s;
    s.reserve(in.size() * 2);
    for (unsigned char c : in) {
        s.push_back(h[c >> 4]);
        s.push_back(h[c & 0xf]);
    }
    return s;
}

// ---------------------------------------------------------------------------
// KDF presets
// ---------------------------------------------------------------------------
KdfParams kdfInteractive() {
    return {crypto_pwhash_OPSLIMIT_INTERACTIVE, crypto_pwhash_MEMLIMIT_INTERACTIVE};
}
KdfParams kdfModerate() {
    return {crypto_pwhash_OPSLIMIT_MODERATE, crypto_pwhash_MEMLIMIT_MODERATE};
}
KdfParams kdfSensitive() {
    return {crypto_pwhash_OPSLIMIT_SENSITIVE, crypto_pwhash_MEMLIMIT_SENSITIVE};
}

// ---------------------------------------------------------------------------
// key derivation (Argon2id) with optional keyfile second factor
// ---------------------------------------------------------------------------
static Bytes deriveKey(const std::string& password, const Bytes& keyfile,
                       const Bytes& salt, unsigned long long ops, std::size_t mem) {
    // composite material = keyfile ? BLAKE2b(pw ‖ BLAKE2b(keyfile)) : pw
    Bytes material;
    if (!keyfile.empty()) {
        Bytes kfHash(64);
        crypto_generichash(kfHash.data(), kfHash.size(), keyfile.data(), keyfile.size(), nullptr, 0);
        Bytes combined;
        combined.reserve(password.size() + kfHash.size());
        combined.insert(combined.end(), password.begin(), password.end());
        combined.insert(combined.end(), kfHash.begin(), kfHash.end());
        material.resize(64);
        crypto_generichash(material.data(), material.size(), combined.data(), combined.size(), nullptr, 0);
        sodium_memzero(combined.data(), combined.size());
        sodium_memzero(kfHash.data(), kfHash.size());
    } else {
        material.assign(password.begin(), password.end());
    }

    Bytes key(crypto_aead_xchacha20poly1305_ietf_KEYBYTES);
    const int rc = crypto_pwhash(key.data(), key.size(),
                                 reinterpret_cast<const char*>(material.data()), material.size(),
                                 salt.data(), ops, mem, crypto_pwhash_ALG_ARGON2ID13);
    sodium_memzero(material.data(), material.size());
    if (rc != 0) throw std::runtime_error("Argon2id key derivation failed (out of memory?)");
    return key;
}

// deterministic AAD binding the header fields
static Bytes buildAad(const Container& c) {
    Bytes aad;
    auto push64 = [&](uint64_t v) {
        for (int i = 0; i < 8; ++i) aad.push_back(static_cast<unsigned char>((v >> (8 * i)) & 0xff));
    };
    push64(static_cast<uint64_t>(c.version));
    push64(c.ops);
    push64(static_cast<uint64_t>(c.mem));
    aad.push_back(c.keyfile ? 1 : 0);
    aad.insert(aad.end(), c.salt.begin(), c.salt.end());
    aad.insert(aad.end(), c.nonce.begin(), c.nonce.end());
    return aad;
}

Container seal(const std::string& plaintext, const std::string& password,
               const Bytes& keyfile, const KdfParams& params) {
    Container c;
    c.version = 1;
    c.salt = randomBytes(crypto_pwhash_SALTBYTES);
    c.ops = params.ops;
    c.mem = params.mem;
    c.nonce = randomBytes(crypto_aead_xchacha20poly1305_ietf_NPUBBYTES);
    c.keyfile = !keyfile.empty();

    Bytes key = deriveKey(password, keyfile, c.salt, c.ops, c.mem);
    Bytes aad = buildAad(c);

    c.ct.resize(plaintext.size() + crypto_aead_xchacha20poly1305_ietf_ABYTES);
    unsigned long long ctLen = 0;
    crypto_aead_xchacha20poly1305_ietf_encrypt(
        c.ct.data(), &ctLen,
        reinterpret_cast<const unsigned char*>(plaintext.data()), plaintext.size(),
        aad.data(), aad.size(), nullptr, c.nonce.data(), key.data());
    c.ct.resize(ctLen);

    sodium_memzero(key.data(), key.size());
    return c;
}

bool open(const Container& c, const std::string& password, const Bytes& keyfile, std::string& out) {
    if (c.ct.size() < crypto_aead_xchacha20poly1305_ietf_ABYTES) return false;
    if (c.salt.size() != crypto_pwhash_SALTBYTES) return false;
    if (c.nonce.size() != crypto_aead_xchacha20poly1305_ietf_NPUBBYTES) return false;

    Bytes key;
    try {
        key = deriveKey(password, keyfile, c.salt, c.ops, c.mem);
    } catch (...) {
        return false;
    }
    Bytes aad = buildAad(c);

    Bytes pt(c.ct.size());
    unsigned long long ptLen = 0;
    const int rc = crypto_aead_xchacha20poly1305_ietf_decrypt(
        pt.data(), &ptLen, nullptr,
        c.ct.data(), c.ct.size(), aad.data(), aad.size(), c.nonce.data(), key.data());
    sodium_memzero(key.data(), key.size());
    if (rc != 0) return false;

    out.assign(reinterpret_cast<char*>(pt.data()), ptLen);
    sodium_memzero(pt.data(), pt.size());
    return true;
}

// ---------------------------------------------------------------------------
// password generation
// ---------------------------------------------------------------------------
namespace {
const std::string LOWER = "abcdefghijklmnopqrstuvwxyz";
const std::string UPPER = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const std::string DIGITS = "0123456789";
const std::string SYMBOLS = "!@#$%^&*()-_=+[]{};:,.?/";
const std::string LOWER_NA = "abcdefghijkmnopqrstuvwxyz";  // no l
const std::string UPPER_NA = "ABCDEFGHJKLMNPQRSTUVWXYZ";    // no I,O
const std::string DIGITS_NA = "23456789";                   // no 0,1

const std::array<const char*, 72> WORDS = {
    "anchor","amber","arrow","atlas","aurora","beacon","birch","bison","blaze","bloom",
    "borealis","boulder","breeze","bridge","bronze","cactus","canyon","cedar","cipher","citadel",
    "clover","cobalt","comet","compass","copper","coral","cosmos","crater","crystal","cyclone",
    "delta","dune","ember","eagle","eclipse","falcon","fern","flint","forest","galaxy",
    "garnet","glacier","granite","harbor","hawk","helix","horizon","indigo","island","jaguar",
    "jupiter","kestrel","lagoon","lantern","lunar","maple","meteor","mirage","nebula","nova",
    "oasis","obsidian","onyx","orbit","phoenix","prism","quartz","raven","summit","tempest",
    "vertex","zephyr"};
}  // namespace

std::string generatePassword(const GenOptions& o) {
    std::vector<std::string> pools;
    if (o.lower) pools.push_back(o.avoidAmbiguous ? LOWER_NA : LOWER);
    if (o.upper) pools.push_back(o.avoidAmbiguous ? UPPER_NA : UPPER);
    if (o.digits) pools.push_back(o.avoidAmbiguous ? DIGITS_NA : DIGITS);
    if (o.symbols) pools.push_back(SYMBOLS);
    if (pools.empty()) pools.push_back(LOWER);

    std::string all;
    for (const auto& p : pools) all += p;

    const int len = std::max(o.length, static_cast<int>(pools.size()));
    std::string chars;
    chars.reserve(len);
    for (const auto& p : pools) chars.push_back(p[randomUniform(static_cast<uint32_t>(p.size()))]);
    while (static_cast<int>(chars.size()) < len) chars.push_back(all[randomUniform(static_cast<uint32_t>(all.size()))]);

    // Fisher–Yates shuffle
    for (std::size_t i = chars.size(); i > 1; --i) {
        std::size_t j = randomUniform(static_cast<uint32_t>(i));
        std::swap(chars[i - 1], chars[j]);
    }
    return chars;
}

std::string generatePassphrase(int words, const std::string& sep, bool capitalize, bool number) {
    if (words < 1) words = 1;
    std::string out;
    for (int i = 0; i < words; ++i) {
        std::string w = WORDS[randomUniform(static_cast<uint32_t>(WORDS.size()))];
        if (capitalize && !w.empty()) w[0] = static_cast<char>(std::toupper(w[0]));
        if (i) out += sep;
        out += w;
    }
    if (number) out += std::to_string(randomUniform(100));
    return out;
}

// ---------------------------------------------------------------------------
// strength estimate
// ---------------------------------------------------------------------------
static std::string humanTime(double seconds) {
    if (seconds < 1) return "instantly";
    const char* units[] = {"second", "minute", "hour", "day", "year", "century"};
    double div[] = {60, 60, 24, 365, 100, 1e9};
    double v = seconds;
    int i = 0;
    while (i < 5 && v >= div[i]) { v /= div[i]; ++i; }
    long n = static_cast<long>(v + 0.5);
    if (i >= 5 && n > 100) return "centuries";
    return std::to_string(n) + " " + units[i] + (n != 1 ? "s" : "");
}

Strength analyzeStrength(const std::string& pw) {
    if (pw.empty()) return {0, 0, "instantly"};
    int pool = 0;
    bool lo = false, up = false, di = false, sy = false;
    for (unsigned char c : pw) {
        if (c >= 'a' && c <= 'z') lo = true;
        else if (c >= 'A' && c <= 'Z') up = true;
        else if (c >= '0' && c <= '9') di = true;
        else sy = true;
    }
    if (lo) pool += 26;
    if (up) pool += 26;
    if (di) pool += 10;
    if (sy) pool += 33;
    if (pool == 0) pool = 1;

    double entropy = pw.size() * std::log2(static_cast<double>(pool));
    // penalties
    bool hasRepeat = false, hasSeq = false;
    for (std::size_t i = 0; i + 2 < pw.size(); ++i) {
        if (pw[i] == pw[i + 1] && pw[i + 1] == pw[i + 2]) hasRepeat = true;
        int a = pw[i], b = pw[i + 1], cc = pw[i + 2];
        if ((b - a == 1 && cc - b == 1) || (a - b == 1 && b - cc == 1)) hasSeq = true;
    }
    if (hasRepeat) entropy *= 0.75;
    if (hasSeq) entropy *= 0.8;
    if (pw.find("password") != std::string::npos || pw == "123456" || pw == "qwerty") entropy *= 0.35;

    int bits = static_cast<int>(entropy + 0.5);
    int score = bits >= 100 ? 4 : bits >= 70 ? 3 : bits >= 45 ? 2 : bits >= 28 ? 1 : 0;
    double guesses = std::pow(2.0, bits);
    double secs = guesses / 1e10;  // 10^10 guesses/sec offline attacker
    return {score, static_cast<double>(bits), humanTime(secs)};
}

// ---------------------------------------------------------------------------
// SHA-1 + HMAC-SHA-1 (for TOTP — libsodium has no SHA-1)
// ---------------------------------------------------------------------------
static inline uint32_t rol(uint32_t v, int b) { return (v << b) | (v >> (32 - b)); }

Bytes sha1(const Bytes& data) {
    uint32_t h[5] = {0x67452301u, 0xEFCDAB89u, 0x98BADCFEu, 0x10325476u, 0xC3D2E1F0u};
    Bytes msg = data;
    uint64_t bits = static_cast<uint64_t>(msg.size()) * 8;
    msg.push_back(0x80);
    while (msg.size() % 64 != 56) msg.push_back(0x00);
    for (int i = 7; i >= 0; --i) msg.push_back(static_cast<unsigned char>((bits >> (8 * i)) & 0xff));

    for (std::size_t chunk = 0; chunk < msg.size(); chunk += 64) {
        uint32_t w[80];
        for (int i = 0; i < 16; ++i) {
            w[i] = (msg[chunk + i * 4] << 24) | (msg[chunk + i * 4 + 1] << 16) |
                   (msg[chunk + i * 4 + 2] << 8) | (msg[chunk + i * 4 + 3]);
        }
        for (int i = 16; i < 80; ++i) w[i] = rol(w[i - 3] ^ w[i - 8] ^ w[i - 14] ^ w[i - 16], 1);
        uint32_t a = h[0], b = h[1], c = h[2], d = h[3], e = h[4];
        for (int i = 0; i < 80; ++i) {
            uint32_t f, k;
            if (i < 20) { f = (b & c) | (~b & d); k = 0x5A827999u; }
            else if (i < 40) { f = b ^ c ^ d; k = 0x6ED9EBA1u; }
            else if (i < 60) { f = (b & c) | (b & d) | (c & d); k = 0x8F1BBCDCu; }
            else { f = b ^ c ^ d; k = 0xCA62C1D6u; }
            uint32_t tmp = rol(a, 5) + f + e + k + w[i];
            e = d; d = c; c = rol(b, 30); b = a; a = tmp;
        }
        h[0] += a; h[1] += b; h[2] += c; h[3] += d; h[4] += e;
    }
    Bytes out(20);
    for (int i = 0; i < 5; ++i) {
        out[i * 4] = static_cast<unsigned char>((h[i] >> 24) & 0xff);
        out[i * 4 + 1] = static_cast<unsigned char>((h[i] >> 16) & 0xff);
        out[i * 4 + 2] = static_cast<unsigned char>((h[i] >> 8) & 0xff);
        out[i * 4 + 3] = static_cast<unsigned char>(h[i] & 0xff);
    }
    return out;
}

Bytes hmacSha1(const Bytes& key, const Bytes& msg) {
    const std::size_t block = 64;
    Bytes k = key;
    if (k.size() > block) k = sha1(k);
    k.resize(block, 0x00);
    Bytes o(block), i(block);
    for (std::size_t n = 0; n < block; ++n) {
        o[n] = k[n] ^ 0x5c;
        i[n] = k[n] ^ 0x36;
    }
    Bytes inner = i;
    inner.insert(inner.end(), msg.begin(), msg.end());
    Bytes innerHash = sha1(inner);
    Bytes outer = o;
    outer.insert(outer.end(), innerHash.begin(), innerHash.end());
    return sha1(outer);
}

// ---------------------------------------------------------------------------
// base32 + TOTP
// ---------------------------------------------------------------------------
Bytes base32Decode(const std::string& in) {
    static const std::string A = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
    int bits = 0;
    uint32_t value = 0;
    Bytes out;
    for (char ch : in) {
        if (ch == '=' || ch == ' ' || ch == '\t' || ch == '\n' || ch == '\r' || ch == '-') continue;
        char up = static_cast<char>(std::toupper(static_cast<unsigned char>(ch)));
        auto pos = A.find(up);
        if (pos == std::string::npos) continue;
        value = (value << 5) | static_cast<uint32_t>(pos);
        bits += 5;
        if (bits >= 8) {
            bits -= 8;
            out.push_back(static_cast<unsigned char>((value >> bits) & 0xff));
        }
    }
    return out;
}

bool isValidBase32(const std::string& in) {
    std::string s;
    for (char c : in) if (c != '=' && c != ' ' && c != '-') s.push_back(static_cast<char>(std::toupper(static_cast<unsigned char>(c))));
    if (s.empty()) return false;
    for (char c : s) if (!((c >= 'A' && c <= 'Z') || (c >= '2' && c <= '7'))) return false;
    return true;
}

std::string totp(const std::string& base32Secret, uint64_t unixTime, int digits, int period, int& secondsRemaining) {
    if (digits <= 0) digits = 6;
    if (period <= 0) period = 30;
    uint64_t counter = unixTime / static_cast<uint64_t>(period);
    secondsRemaining = period - static_cast<int>(unixTime % static_cast<uint64_t>(period));

    Bytes key = base32Decode(base32Secret);
    Bytes msg(8);
    for (int i = 7; i >= 0; --i) { msg[i] = static_cast<unsigned char>(counter & 0xff); counter >>= 8; }
    Bytes mac = hmacSha1(key, msg);
    int offset = mac[mac.size() - 1] & 0x0f;
    uint32_t bin = ((mac[offset] & 0x7f) << 24) | ((mac[offset + 1] & 0xff) << 16) |
                   ((mac[offset + 2] & 0xff) << 8) | (mac[offset + 3] & 0xff);
    uint32_t mod = 1;
    for (int i = 0; i < digits; ++i) mod *= 10;
    std::string code = std::to_string(bin % mod);
    while (static_cast<int>(code.size()) < digits) code.insert(code.begin(), '0');
    return code;
}

OtpAuth parseOtpAuth(const std::string& uri) {
    OtpAuth r;
    if (uri.rfind("otpauth://", 0) != 0) {
        if (isValidBase32(uri)) r.secret = uri;
        return r;
    }
    auto q = uri.find('?');
    if (q == std::string::npos) return r;
    std::string query = uri.substr(q + 1);
    std::size_t pos = 0;
    while (pos < query.size()) {
        auto amp = query.find('&', pos);
        std::string pair = query.substr(pos, amp == std::string::npos ? std::string::npos : amp - pos);
        auto eq = pair.find('=');
        if (eq != std::string::npos) {
            std::string k = pair.substr(0, eq), v = pair.substr(eq + 1);
            if (k == "secret") r.secret = v;
            else if (k == "issuer") r.issuer = v;
            else if (k == "digits") { try { r.digits = std::stoi(v); } catch (...) {} }
            else if (k == "period") { try { r.period = std::stoi(v); } catch (...) {} }
        }
        if (amp == std::string::npos) break;
        pos = amp + 1;
    }
    if (!isValidBase32(r.secret)) r.secret.clear();
    return r;
}

}  // namespace vc
