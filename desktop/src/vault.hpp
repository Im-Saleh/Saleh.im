// ============================================================================
//  Vault — data model, encrypted file storage & offline security audit.
//
//  The decrypted vault lives only in memory. What touches disk is a single
//  JSON envelope containing the Argon2id parameters and the XChaCha20-Poly1305
//  ciphertext produced by crypto.cpp. There is no network, no telemetry.
//
//  The model supports a rich set of item types (logins, cards, identities,
//  secure notes, standalone 2FA, SSH keys, API credentials, Wi-Fi networks,
//  bank accounts, crypto wallets, servers/databases and software licences),
//  arbitrary user-defined custom fields, folders, tags, soft-delete (trash)
//  and per-item expiry.
// ============================================================================
#pragma once

#include <QByteArray>
#include <QPair>
#include <QString>
#include <QStringList>
#include <QVector>

#include "crypto.hpp"

namespace vault {

// A user-defined extra field attached to any entry.
struct CustomField {
    QString label;
    QString value;
    bool secret = false;
};

// A single item. Fields not relevant to a given type simply stay empty.
struct Entry {
    QString id;
    QString type;  // login|note|card|identity|totp|ssh|api|wifi|bank|crypto|server|license
    QString title;
    bool favorite = false;
    QString folder;
    QStringList tags;
    QString notes;
    QString iconEmoji;  // optional override of the type glyph
    QString color;      // optional accent hex ("" → type default)
    qint64 created = 0;
    qint64 updated = 0;
    qint64 usedAt = 0;
    qint64 expiresAt = 0;   // optional (cards, licences, api tokens) — 0 = none
    bool trashed = false;
    qint64 trashedAt = 0;

    // login / shared credential fields (reused across several types)
    QString username;
    QString password;
    QString url;
    QString totp;  // otpauth:// or base32
    QStringList passwordHistory;

    // card
    QString cardholder;
    QString cardNumber;
    QString cardExpiry;
    QString cardCvv;
    QString cardBrand;
    QString cardPin;

    // identity
    QString fullName;
    QString email;
    QString phone;
    QString address;

    // standalone totp
    QString otpSecret;
    QString otpIssuer;

    // ssh key
    QString sshPublicKey;
    QString sshPrivateKey;

    // api credential
    QString apiKey;
    QString apiSecret;

    // wifi
    QString wifiSsid;
    QString wifiSecurity;  // WPA2 / WPA3 / WEP / Open

    // bank account
    QString bankName;
    QString accountNumber;
    QString routingNumber;
    QString iban;
    QString swift;

    // crypto wallet
    QString walletType;
    QString walletAddress;
    QString walletSeed;

    // server / database
    QString serverHost;
    QString serverPort;
    QString dbName;

    // software licence
    QString licenseKey;
    QString licenseOwner;

    // extensibility
    QVector<CustomField> customFields;
};

struct Settings {
    int autoLockMinutes = 5;
    int clipboardClearSeconds = 20;
    bool concealByDefault = true;
    bool lockOnMinimize = true;
    bool minimizeToTray = true;
    bool quickCapture = true;    // global-hotkey credential capture
    int revealSeconds = 20;      // auto-reconceal revealed secrets
    QString theme = "carbon";    // palette id (see theme.hpp)
    QString kdf = "moderate";    // interactive | moderate | sensitive
    // super-app preferences
    bool compactList = false;    // denser item rows
    bool showStrengthBadges = true;
    bool confirmDelete = true;
    int passwordAgeDays = 365;   // audit "aging" threshold
    QString defaultNewType = "login";
    QString startupView = "all"; // sidebar filter selected on unlock
};

struct Folder {
    QString id;
    QString name;
    QString icon;
};

struct Data {
    int version = 2;
    QVector<Entry> entries;
    QVector<Folder> folders;
    Settings settings;
    qint64 createdAt = 0;
};

// ---- item-type metadata ----------------------------------------------------
struct TypeInfo {
    QString id;
    QString label;
    QString icon;      // emoji glyph
    QString color;     // default accent hex
    bool hasPassword;  // participates in the credential health audit
};
const QVector<TypeInfo>& types();
const TypeInfo& typeInfo(const QString& id);
QString typeLabel(const QString& id);
QString typeIcon(const QString& id);

// ---- (de)serialisation of the decrypted model <-> JSON ---------------------
QByteArray serialize(const Data& d);
bool deserialize(const QByteArray& json, Data& out);

// ---- envelope (crypto Container) <-> on-disk JSON --------------------------
QByteArray containerToJson(const vc::Container& c);
bool containerFromJson(const QByteArray& json, vc::Container& out);

// ---- file operations -------------------------------------------------------
QString defaultVaultPath();       // ~/.local/share/SalehVault/vault.svlt
bool vaultExists(const QString& path);
bool metaKeyfileRequired(const QString& path);  // peek: does this vault need a keyfile?

vc::KdfParams kdfFor(const QString& preset);

// Create a fresh empty vault file. Returns true on success.
bool createVault(const QString& path, const QString& password, const QByteArray& keyfile,
                 const QString& kdfPreset, Data& outData, QString& err);

// Decrypt an existing vault. Returns true on success; sets err otherwise.
bool unlock(const QString& path, const QString& password, const QByteArray& keyfile,
            Data& out, QString& err);

// Re-encrypt and persist the model with the current password/keyfile.
bool save(const QString& path, const QString& password, const QByteArray& keyfile,
          const QString& kdfPreset, const Data& data, QString& err);

// Encrypted backup (identical envelope, copied to another path).
bool exportBackup(const QString& srcPath, const QString& dstPath, QString& err);

// ---- plaintext import / export (explicit, user-initiated) ------------------
// Serialise every non-trashed entry to a portable, *unencrypted* JSON string.
QByteArray exportPlaintextJson(const Data& d);
// Parse a previously exported JSON payload into entries (ids are regenerated).
bool importPlaintextJson(const QByteArray& json, QVector<Entry>& out, QString& err);
// Parse a generic CSV (name,url,username,password,notes / browser exports).
bool importCsv(const QByteArray& csv, QVector<Entry>& out, QString& err);
// Render every login-style credential to CSV (name,url,username,password,notes,totp).
QByteArray exportCsv(const Data& d);

// ---- helpers ---------------------------------------------------------------
QString newId();
Entry newEntry(const QString& type);
QString detectCardBrand(const QString& number);
QString domainOf(const QString& url);
// The primary password-bearing value for an entry (used by audit/history/copy).
bool typeHasPassword(const QString& type);
// A short one-line subtitle for the list row.
QString subtitleFor(const Entry& e);

// ---- statistics ------------------------------------------------------------
struct Stats {
    int total = 0;
    int trashed = 0;
    int favorites = 0;
    int withTotp = 0;
    int expiringSoon = 0;   // within 30 days
    int expired = 0;
    QVector<QPair<QString, int>> byType;    // typeId -> count (non-trashed)
    QVector<QPair<QString, int>> byFolder;  // folderId -> count
    qint64 newestUpdate = 0;
    qint64 oldestCreate = 0;
};
Stats computeStats(const Data& d);

// ---- security audit --------------------------------------------------------
struct AuditIssue {
    QString entryId;
    QString title;
    QString detail;
};
struct Audit {
    int score = 100;             // 0..100
    int totalWithPasswords = 0;
    double avgEntropy = 0;
    QVector<AuditIssue> weak;
    QVector<AuditIssue> reused;
    QVector<AuditIssue> old;
    QVector<AuditIssue> no2fa;
    QVector<AuditIssue> insecure;
    QVector<AuditIssue> expiring;
};
Audit audit(const QVector<Entry>& entries, int ageDays = 365);

}  // namespace vault
