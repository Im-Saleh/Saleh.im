// ============================================================================
//  Vault — cryptographic core (C++ / libsodium)
//
//  A modern, memory-hard, authenticated encryption core for the native Linux
//  vault. Nothing here depends on Qt, so it is unit-testable in isolation.
//
//  Design:
//    • KDF        Argon2id (crypto_pwhash) — memory-hard, tunable ops/mem.
//    • Cipher     XChaCha20-Poly1305-IETF AEAD (192-bit nonce, 128-bit tag),
//                 with the file header bound as Additional Authenticated Data.
//    • 2nd factor Optional keyfile: the effective secret becomes
//                 BLAKE2b( password ‖ BLAKE2b(keyfile) ).
//    • Memory     Keys live in sodium_malloc guarded pages and are wiped.
//    • TOTP       RFC-6238 (self-contained SHA-1 + HMAC-SHA-1 + base32).
//
//  A single wrong bit in the header, ciphertext or password makes decryption
//  fail loudly (AEAD verification) — there is no partial/ambiguous state.
// ============================================================================
#pragma once

#include <cstdint>
#include <string>
#include <vector>

namespace vc {

using Bytes = std::vector<unsigned char>;

// ---- lifecycle -------------------------------------------------------------
bool init();  // must be called once before anything else (wraps sodium_init)

// ---- randomness ------------------------------------------------------------
Bytes randomBytes(std::size_t n);
uint32_t randomUniform(uint32_t upperBound);  // unbiased [0, upperBound)

// ---- encoding --------------------------------------------------------------
std::string toBase64(const Bytes& in);
Bytes fromBase64(const std::string& in);
std::string toHex(const Bytes& in);

// ---- KDF parameters --------------------------------------------------------
struct KdfParams {
    unsigned long long ops;  // opslimit
    std::size_t mem;         // memlimit (bytes)
};
KdfParams kdfInteractive();  // ~64 MB, fast
KdfParams kdfModerate();     // ~256 MB, recommended default
KdfParams kdfSensitive();    // ~1 GB, paranoid

// ---- sealed container ------------------------------------------------------
struct Container {
    int version = 1;
    Bytes salt;              // crypto_pwhash_SALTBYTES
    unsigned long long ops = 0;
    std::size_t mem = 0;
    Bytes nonce;             // XChaCha20 nonce
    bool keyfile = false;
    Bytes ct;                // ciphertext + AEAD tag
};

// Encrypt `plaintext` under `password` (+ optional keyfile). Throws std::runtime_error on failure.
Container seal(const std::string& plaintext,
               const std::string& password,
               const Bytes& keyfile,
               const KdfParams& params);

// Decrypt. Returns true and fills `out` on success; false if authentication
// fails (wrong password / keyfile / tampered data).
bool open(const Container& c,
          const std::string& password,
          const Bytes& keyfile,
          std::string& out);

// ---- password generation & analysis ---------------------------------------
struct GenOptions {
    int length = 20;
    bool upper = true;
    bool lower = true;
    bool digits = true;
    bool symbols = true;
    bool avoidAmbiguous = false;
    std::string exclude = "";  // extra characters to strip from every pool
    int minDigits = 0;         // require at least N digits (best-effort)
    int minSymbols = 0;        // require at least N symbols (best-effort)
};
std::string generatePassword(const GenOptions& o);
std::string generatePassphrase(int words, const std::string& sep, bool capitalize, bool number);

// A numeric PIN of `digits` length (uniform, unbiased).
std::string generatePin(int digits);
// A random key rendered as lowercase hex (`bytes` bytes → 2*bytes chars).
std::string generateHexKey(int bytes);
// A pronounceable, roughly `length`-char password built from CV syllables.
std::string generatePronounceable(int length, bool capitalize, bool number);
// Number of distinct words available to the passphrase generator.
std::size_t wordlistSize();

struct Strength {
    int score;            // 0..4
    double entropyBits;   // estimated
    std::string crackTime;
};
Strength analyzeStrength(const std::string& pw);

// ---- TOTP (RFC 6238) -------------------------------------------------------
Bytes base32Decode(const std::string& in);
bool isValidBase32(const std::string& in);
// Returns 6/8-digit code; `secondsRemaining` filled with time left in the step.
std::string totp(const std::string& base32Secret, uint64_t unixTime,
                 int digits, int period, int& secondsRemaining);
// Parse otpauth:// URI or a bare base32 secret. Returns empty secret on failure.
struct OtpAuth { std::string secret; std::string issuer; std::string label; int digits = 6; int period = 30; };
OtpAuth parseOtpAuth(const std::string& uri);

// ---- primitives exposed for testing ---------------------------------------
Bytes sha1(const Bytes& data);
Bytes hmacSha1(const Bytes& key, const Bytes& msg);

}  // namespace vc
