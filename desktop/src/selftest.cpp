// ============================================================================
//  Vault — crypto self-test (compile & run to validate the security core).
//    g++ -std=c++17 crypto.cpp selftest.cpp -lsodium -o selftest && ./selftest
// ============================================================================
#include "crypto.hpp"

#include <cstdio>
#include <string>

static int failures = 0;
#define CHECK(cond, name)                                             \
    do {                                                              \
        if (cond) {                                                   \
            std::printf("  \033[32m✔\033[0m %s\n", name);             \
        } else {                                                      \
            std::printf("  \033[31m�’ %s (FAILED)\033[0m\n", name);    \
            ++failures;                                               \
        }                                                             \
    } while (0)

int main() {
    if (!vc::init()) {
        std::printf("sodium init failed\n");
        return 2;
    }
    std::printf("Vault crypto self-test\n");

    // base64 round-trip
    {
        vc::Bytes b = {0, 1, 2, 250, 251, 255, 42};
        CHECK(vc::fromBase64(vc::toBase64(b)) == b, "base64 round-trip");
    }

    // sha1("abc")
    {
        vc::Bytes d = {'a', 'b', 'c'};
        CHECK(vc::toHex(vc::sha1(d)) == "a9993e364706816aba3e25717850c26c9cd0d89d", "SHA-1 vector (abc)");
    }

    // HMAC-SHA1 RFC 2202 test case 1
    {
        vc::Bytes key(20, 0x0b);
        vc::Bytes msg = {'H', 'i', ' ', 'T', 'h', 'e', 'r', 'e'};
        CHECK(vc::toHex(vc::hmacSha1(key, msg)) == "b617318655057264e28bc0b6fb378c8ef146be00", "HMAC-SHA-1 vector");
    }

    // base32 decode of RFC6238 seed
    {
        vc::Bytes dec = vc::base32Decode("GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ");
        std::string s(dec.begin(), dec.end());
        CHECK(s == "12345678901234567890", "base32 decode (RFC 6238 seed)");
    }

    // TOTP RFC 6238 (SHA-1) vector: T=59 → 94287082
    {
        int rem = 0;
        std::string code = vc::totp("GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ", 59, 8, 30, rem);
        CHECK(code == "94287082", "TOTP RFC 6238 vector (T=59)");
    }

    // seal / open round-trip + wrong password + keyfile factor
    {
        vc::KdfParams fast = vc::kdfInteractive();
        std::string secret = "top-secret vault contents ✓ صالح";
        vc::Container c = vc::seal(secret, "correct horse battery", {}, fast);
        std::string out;
        CHECK(vc::open(c, "correct horse battery", {}, out) && out == secret, "AEAD seal/open round-trip");
        CHECK(!vc::open(c, "wrong password", {}, out), "wrong password rejected");

        vc::Bytes keyfile = {9, 8, 7, 6, 5, 4, 3, 2, 1, 0};
        vc::Container ck = vc::seal(secret, "pw", keyfile, fast);
        CHECK(vc::open(ck, "pw", keyfile, out) && out == secret, "keyfile: correct opens");
        CHECK(!vc::open(ck, "pw", {}, out), "keyfile: missing keyfile rejected");
        CHECK(ck.keyfile == true, "keyfile flag recorded");
    }

    // tamper detection
    {
        vc::Container c = vc::seal("data", "pw", {}, vc::kdfInteractive());
        if (!c.ct.empty()) c.ct[0] ^= 0x01;
        std::string out;
        CHECK(!vc::open(c, "pw", {}, out), "tampered ciphertext rejected");
    }

    // password generator
    {
        vc::GenOptions o;
        o.length = 24;
        std::string p = vc::generatePassword(o);
        bool lo = false, up = false, di = false;
        for (char ch : p) {
            if (ch >= 'a' && ch <= 'z') lo = true;
            if (ch >= 'A' && ch <= 'Z') up = true;
            if (ch >= '0' && ch <= '9') di = true;
        }
        CHECK(p.size() == 24, "generator length");
        CHECK(lo && up && di, "generator includes each selected class");
    }

    // strength
    {
        CHECK(vc::analyzeStrength("aaaaaa").score <= 1, "weak password low score");
        CHECK(vc::analyzeStrength("G7#kq!Zx2$Lm9&Rp4^Ws").score >= 3, "strong password high score");
    }

    // generator: exclude characters + minimum digits
    {
        vc::GenOptions o;
        o.length = 32;
        o.exclude = "abcABC";
        o.minDigits = 4;
        std::string p = vc::generatePassword(o);
        bool bad = false;
        int digits = 0;
        for (char c : p) {
            if (std::string("abcABC").find(c) != std::string::npos) bad = true;
            if (c >= '0' && c <= '9') digits++;
        }
        CHECK(!bad, "generator honours excluded characters");
        CHECK(digits >= 4, "generator honours minimum digits");
    }

    // PIN / hex / pronounceable / wordlist
    {
        std::string pin = vc::generatePin(6);
        bool numeric = pin.size() == 6;
        for (char c : pin) if (c < '0' || c > '9') numeric = false;
        CHECK(numeric, "PIN is 6 numeric digits");
        CHECK(vc::generateHexKey(16).size() == 32, "hex key length (16 bytes → 32 chars)");
        CHECK(vc::generatePronounceable(10, true, false).size() >= 10, "pronounceable length");
        CHECK(vc::wordlistSize() >= 128, "passphrase wordlist is large");
    }

    std::printf(failures == 0 ? "\nALL PASSED\n" : "\n%d FAILED\n", failures);
    return failures == 0 ? 0 : 1;
}
