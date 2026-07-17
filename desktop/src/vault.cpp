// ============================================================================
//  Vault — data model, storage, statistics, import/export & audit (impl).
// ============================================================================
#include "vault.hpp"

#include <QCryptographicHash>
#include <QDateTime>
#include <QDir>
#include <QFile>
#include <QFileInfo>
#include <QHash>
#include <QJsonArray>
#include <QJsonDocument>
#include <QJsonObject>
#include <QRandomGenerator>
#include <QRegularExpression>
#include <QSaveFile>
#include <QStandardPaths>
#include <QUrl>

#include <algorithm>
#include <cmath>

namespace vault {

// ---- Qt <-> std / bytes bridges -------------------------------------------
static vc::Bytes toBytes(const QByteArray& b) {
    const auto* p = reinterpret_cast<const unsigned char*>(b.constData());
    return vc::Bytes(p, p + b.size());
}
static QByteArray toQBA(const vc::Bytes& b) {
    return QByteArray(reinterpret_cast<const char*>(b.data()), static_cast<int>(b.size()));
}
static std::string sstr(const QString& s) { return s.toStdString(); }

// ---------------------------------------------------------------------------
// item-type registry
// ---------------------------------------------------------------------------
const QVector<TypeInfo>& types() {
    static const QVector<TypeInfo> T = {
        {"login",    "Login",           "🔑", "#c8ff4d", true},
        {"totp",     "2FA code",        "🛡", "#4ade80", false},
        {"note",     "Secure note",     "📝", "#f7b955", false},
        {"card",     "Payment card",    "💳", "#67e8f9", false},
        {"identity", "Identity",        "🪪", "#c084fc", false},
        {"ssh",      "SSH key",         "🔐", "#38bdf8", true},
        {"api",      "API credential",  "🧩", "#f472b6", true},
        {"wifi",     "Wi-Fi network",   "📶", "#22d3ee", true},
        {"bank",     "Bank account",    "🏦", "#34d399", true},
        {"crypto",   "Crypto wallet",   "🪙", "#fbbf24", true},
        {"server",   "Server / DB",     "🖥", "#a78bfa", true},
        {"license",  "Software licence","📜", "#fb7185", false},
    };
    return T;
}

const TypeInfo& typeInfo(const QString& id) {
    for (const auto& t : types())
        if (t.id == id) return t;
    return types().front();
}
QString typeLabel(const QString& id) { return typeInfo(id).label; }
QString typeIcon(const QString& id) { return typeInfo(id).icon; }
bool typeHasPassword(const QString& id) { return typeInfo(id).hasPassword; }

// ---------------------------------------------------------------------------
// model <-> JSON
// ---------------------------------------------------------------------------
static QJsonArray customToJson(const QVector<CustomField>& fields) {
    QJsonArray a;
    for (const auto& f : fields) {
        QJsonObject o;
        o["label"] = f.label;
        o["value"] = f.value;
        o["secret"] = f.secret;
        a.append(o);
    }
    return a;
}
static QVector<CustomField> customFromJson(const QJsonArray& a) {
    QVector<CustomField> out;
    for (auto v : a) {
        QJsonObject o = v.toObject();
        out.append({o["label"].toString(), o["value"].toString(), o["secret"].toBool()});
    }
    return out;
}

static QJsonObject entryToJson(const Entry& e) {
    QJsonObject o;
    o["id"] = e.id;
    o["type"] = e.type;
    o["title"] = e.title;
    o["favorite"] = e.favorite;
    o["folder"] = e.folder;
    o["tags"] = QJsonArray::fromStringList(e.tags);
    o["notes"] = e.notes;
    o["iconEmoji"] = e.iconEmoji;
    o["color"] = e.color;
    o["created"] = static_cast<double>(e.created);
    o["updated"] = static_cast<double>(e.updated);
    o["usedAt"] = static_cast<double>(e.usedAt);
    o["expiresAt"] = static_cast<double>(e.expiresAt);
    o["trashed"] = e.trashed;
    o["trashedAt"] = static_cast<double>(e.trashedAt);
    o["username"] = e.username;
    o["password"] = e.password;
    o["url"] = e.url;
    o["totp"] = e.totp;
    o["passwordHistory"] = QJsonArray::fromStringList(e.passwordHistory);
    o["cardholder"] = e.cardholder;
    o["cardNumber"] = e.cardNumber;
    o["cardExpiry"] = e.cardExpiry;
    o["cardCvv"] = e.cardCvv;
    o["cardBrand"] = e.cardBrand;
    o["cardPin"] = e.cardPin;
    o["fullName"] = e.fullName;
    o["email"] = e.email;
    o["phone"] = e.phone;
    o["address"] = e.address;
    o["otpSecret"] = e.otpSecret;
    o["otpIssuer"] = e.otpIssuer;
    o["sshPublicKey"] = e.sshPublicKey;
    o["sshPrivateKey"] = e.sshPrivateKey;
    o["apiKey"] = e.apiKey;
    o["apiSecret"] = e.apiSecret;
    o["wifiSsid"] = e.wifiSsid;
    o["wifiSecurity"] = e.wifiSecurity;
    o["bankName"] = e.bankName;
    o["accountNumber"] = e.accountNumber;
    o["routingNumber"] = e.routingNumber;
    o["iban"] = e.iban;
    o["swift"] = e.swift;
    o["walletType"] = e.walletType;
    o["walletAddress"] = e.walletAddress;
    o["walletSeed"] = e.walletSeed;
    o["serverHost"] = e.serverHost;
    o["serverPort"] = e.serverPort;
    o["dbName"] = e.dbName;
    o["licenseKey"] = e.licenseKey;
    o["licenseOwner"] = e.licenseOwner;
    o["customFields"] = customToJson(e.customFields);
    return o;
}

static Entry entryFromJson(const QJsonObject& o) {
    Entry e;
    e.id = o["id"].toString();
    e.type = o["type"].toString("login");
    e.title = o["title"].toString();
    e.favorite = o["favorite"].toBool();
    e.folder = o["folder"].toString();
    for (auto v : o["tags"].toArray()) e.tags << v.toString();
    e.notes = o["notes"].toString();
    e.iconEmoji = o["iconEmoji"].toString();
    e.color = o["color"].toString();
    e.created = static_cast<qint64>(o["created"].toDouble());
    e.updated = static_cast<qint64>(o["updated"].toDouble());
    e.usedAt = static_cast<qint64>(o["usedAt"].toDouble());
    e.expiresAt = static_cast<qint64>(o["expiresAt"].toDouble());
    e.trashed = o["trashed"].toBool();
    e.trashedAt = static_cast<qint64>(o["trashedAt"].toDouble());
    e.username = o["username"].toString();
    e.password = o["password"].toString();
    e.url = o["url"].toString();
    e.totp = o["totp"].toString();
    for (auto v : o["passwordHistory"].toArray()) e.passwordHistory << v.toString();
    e.cardholder = o["cardholder"].toString();
    e.cardNumber = o["cardNumber"].toString();
    e.cardExpiry = o["cardExpiry"].toString();
    e.cardCvv = o["cardCvv"].toString();
    e.cardBrand = o["cardBrand"].toString();
    e.cardPin = o["cardPin"].toString();
    e.fullName = o["fullName"].toString();
    e.email = o["email"].toString();
    e.phone = o["phone"].toString();
    e.address = o["address"].toString();
    e.otpSecret = o["otpSecret"].toString();
    e.otpIssuer = o["otpIssuer"].toString();
    e.sshPublicKey = o["sshPublicKey"].toString();
    e.sshPrivateKey = o["sshPrivateKey"].toString();
    e.apiKey = o["apiKey"].toString();
    e.apiSecret = o["apiSecret"].toString();
    e.wifiSsid = o["wifiSsid"].toString();
    e.wifiSecurity = o["wifiSecurity"].toString();
    e.bankName = o["bankName"].toString();
    e.accountNumber = o["accountNumber"].toString();
    e.routingNumber = o["routingNumber"].toString();
    e.iban = o["iban"].toString();
    e.swift = o["swift"].toString();
    e.walletType = o["walletType"].toString();
    e.walletAddress = o["walletAddress"].toString();
    e.walletSeed = o["walletSeed"].toString();
    e.serverHost = o["serverHost"].toString();
    e.serverPort = o["serverPort"].toString();
    e.dbName = o["dbName"].toString();
    e.licenseKey = o["licenseKey"].toString();
    e.licenseOwner = o["licenseOwner"].toString();
    e.customFields = customFromJson(o["customFields"].toArray());
    return e;
}

static QJsonObject settingsToJson(const Settings& s) {
    QJsonObject o;
    o["autoLockMinutes"] = s.autoLockMinutes;
    o["clipboardClearSeconds"] = s.clipboardClearSeconds;
    o["concealByDefault"] = s.concealByDefault;
    o["lockOnMinimize"] = s.lockOnMinimize;
    o["minimizeToTray"] = s.minimizeToTray;
    o["quickCapture"] = s.quickCapture;
    o["revealSeconds"] = s.revealSeconds;
    o["theme"] = s.theme;
    o["kdf"] = s.kdf;
    o["compactList"] = s.compactList;
    o["showStrengthBadges"] = s.showStrengthBadges;
    o["confirmDelete"] = s.confirmDelete;
    o["passwordAgeDays"] = s.passwordAgeDays;
    o["defaultNewType"] = s.defaultNewType;
    o["startupView"] = s.startupView;
    o["liveMonitorEnabled"] = s.liveMonitorEnabled;
    o["liveMonitorAutoSave"] = s.liveMonitorAutoSave;
    o["liveMonitorNotify"] = s.liveMonitorNotify;
    return o;
}

static void settingsFromJson(const QJsonObject& s, Settings& out) {
    out.autoLockMinutes = s["autoLockMinutes"].toInt(5);
    out.clipboardClearSeconds = s["clipboardClearSeconds"].toInt(20);
    out.concealByDefault = s["concealByDefault"].toBool(true);
    out.lockOnMinimize = s["lockOnMinimize"].toBool(true);
    out.minimizeToTray = s["minimizeToTray"].toBool(true);
    out.quickCapture = s["quickCapture"].toBool(true);
    out.revealSeconds = s["revealSeconds"].toInt(20);
    out.theme = s["theme"].toString("carbon");
    out.kdf = s["kdf"].toString("moderate");
    out.compactList = s["compactList"].toBool(false);
    out.showStrengthBadges = s["showStrengthBadges"].toBool(true);
    out.confirmDelete = s["confirmDelete"].toBool(true);
    out.passwordAgeDays = s["passwordAgeDays"].toInt(365);
    out.defaultNewType = s["defaultNewType"].toString("login");
    out.startupView = s["startupView"].toString("all");
    out.liveMonitorEnabled = s["liveMonitorEnabled"].toBool(false);
    out.liveMonitorAutoSave = s["liveMonitorAutoSave"].toBool(false);
    out.liveMonitorNotify = s["liveMonitorNotify"].toBool(true);
}

QByteArray serialize(const Data& d) {
    QJsonObject root;
    root["version"] = d.version;
    root["createdAt"] = static_cast<double>(d.createdAt);

    QJsonArray entries;
    for (const auto& e : d.entries) entries.append(entryToJson(e));
    root["entries"] = entries;

    QJsonArray folders;
    for (const auto& f : d.folders) {
        QJsonObject o;
        o["id"] = f.id;
        o["name"] = f.name;
        o["icon"] = f.icon;
        folders.append(o);
    }
    root["folders"] = folders;
    root["settings"] = settingsToJson(d.settings);
    return QJsonDocument(root).toJson(QJsonDocument::Compact);
}

bool deserialize(const QByteArray& json, Data& out) {
    QJsonParseError err{};
    QJsonDocument doc = QJsonDocument::fromJson(json, &err);
    if (err.error != QJsonParseError::NoError || !doc.isObject()) return false;
    QJsonObject root = doc.object();
    out.version = root["version"].toInt(2);
    out.createdAt = static_cast<qint64>(root["createdAt"].toDouble());

    out.entries.clear();
    for (auto v : root["entries"].toArray()) out.entries.append(entryFromJson(v.toObject()));

    out.folders.clear();
    for (auto v : root["folders"].toArray()) {
        QJsonObject o = v.toObject();
        out.folders.append({o["id"].toString(), o["name"].toString(), o["icon"].toString()});
    }
    settingsFromJson(root["settings"].toObject(), out.settings);
    return true;
}

// ---------------------------------------------------------------------------
// container <-> on-disk JSON envelope
// ---------------------------------------------------------------------------
QByteArray containerToJson(const vc::Container& c) {
    QJsonObject o;
    o["magic"] = "SVLT-CPP";
    o["version"] = c.version;
    o["kdf"] = "argon2id";
    o["salt"] = QString::fromLatin1(toQBA(c.salt).toBase64());
    o["ops"] = static_cast<double>(c.ops);
    o["mem"] = static_cast<double>(c.mem);
    o["nonce"] = QString::fromLatin1(toQBA(c.nonce).toBase64());
    o["keyfile"] = c.keyfile;
    o["ct"] = QString::fromLatin1(toQBA(c.ct).toBase64());
    return QJsonDocument(o).toJson(QJsonDocument::Indented);
}

bool containerFromJson(const QByteArray& json, vc::Container& out) {
    QJsonParseError err{};
    QJsonDocument doc = QJsonDocument::fromJson(json, &err);
    if (err.error != QJsonParseError::NoError || !doc.isObject()) return false;
    QJsonObject o = doc.object();
    if (o["magic"].toString() != "SVLT-CPP") return false;
    out.version = o["version"].toInt(1);
    out.salt = toBytes(QByteArray::fromBase64(o["salt"].toString().toLatin1()));
    out.ops = static_cast<unsigned long long>(o["ops"].toDouble());
    out.mem = static_cast<std::size_t>(o["mem"].toDouble());
    out.nonce = toBytes(QByteArray::fromBase64(o["nonce"].toString().toLatin1()));
    out.keyfile = o["keyfile"].toBool();
    out.ct = toBytes(QByteArray::fromBase64(o["ct"].toString().toLatin1()));
    return true;
}

// ---------------------------------------------------------------------------
// paths / kdf
// ---------------------------------------------------------------------------
QString defaultVaultPath() {
    QString dir = QStandardPaths::writableLocation(QStandardPaths::GenericDataLocation) + "/SalehVault";
    QDir().mkpath(dir);
    return dir + "/vault.svlt";
}

bool vaultExists(const QString& path) { return QFile::exists(path); }

vc::KdfParams kdfFor(const QString& preset) {
    if (preset == "interactive") return vc::kdfInteractive();
    if (preset == "sensitive") return vc::kdfSensitive();
    return vc::kdfModerate();
}

bool metaKeyfileRequired(const QString& path) {
    QFile f(path);
    if (!f.open(QIODevice::ReadOnly)) return false;
    vc::Container c;
    if (!containerFromJson(f.readAll(), c)) return false;
    return c.keyfile;
}

// ---------------------------------------------------------------------------
// file operations
// ---------------------------------------------------------------------------
static bool writeContainer(const QString& path, const vc::Container& c, QString& err) {
    QSaveFile f(path);
    if (!f.open(QIODevice::WriteOnly)) {
        err = "Cannot open vault file for writing.";
        return false;
    }
    f.write(containerToJson(c));
    if (!f.commit()) {
        err = "Failed to write the vault file.";
        return false;
    }
    QFile::setPermissions(path, QFile::ReadOwner | QFile::WriteOwner);  // 0600
    return true;
}

bool createVault(const QString& path, const QString& password, const QByteArray& keyfile,
                 const QString& kdfPreset, Data& outData, QString& err) {
    Data d;
    d.version = 2;
    d.createdAt = QDateTime::currentMSecsSinceEpoch();
    d.folders = {{"personal", "Personal", "◆"}, {"work", "Work", "▲"},
                 {"finance", "Finance", "$"}, {"servers", "Infrastructure", "⬢"}};
    d.settings.kdf = kdfPreset;
    try {
        vc::Container c = vc::seal(sstr(QString::fromUtf8(serialize(d))), sstr(password), toBytes(keyfile), kdfFor(kdfPreset));
        if (!writeContainer(path, c, err)) return false;
    } catch (const std::exception& e) {
        err = QString::fromUtf8(e.what());
        return false;
    }
    outData = d;
    return true;
}

bool unlock(const QString& path, const QString& password, const QByteArray& keyfile, Data& out, QString& err) {
    QFile f(path);
    if (!f.open(QIODevice::ReadOnly)) {
        err = "No vault found.";
        return false;
    }
    vc::Container c;
    if (!containerFromJson(f.readAll(), c)) {
        err = "The vault file is corrupt or not a valid vault.";
        return false;
    }
    std::string plain;
    if (!vc::open(c, sstr(password), toBytes(keyfile), plain)) {
        err = "Wrong master password or keyfile.";
        return false;
    }
    if (!deserialize(QByteArray::fromStdString(plain), out)) {
        err = "Decrypted data could not be parsed.";
        return false;
    }
    return true;
}

bool save(const QString& path, const QString& password, const QByteArray& keyfile,
          const QString& kdfPreset, const Data& data, QString& err) {
    try {
        vc::Container c = vc::seal(sstr(QString::fromUtf8(serialize(data))), sstr(password), toBytes(keyfile), kdfFor(kdfPreset));
        return writeContainer(path, c, err);
    } catch (const std::exception& e) {
        err = QString::fromUtf8(e.what());
        return false;
    }
}

bool exportBackup(const QString& srcPath, const QString& dstPath, QString& err) {
    QFile::remove(dstPath);
    if (!QFile::copy(srcPath, dstPath)) {
        err = "Could not write the backup file.";
        return false;
    }
    return true;
}

// ---------------------------------------------------------------------------
// plaintext import / export
// ---------------------------------------------------------------------------
QByteArray exportPlaintextJson(const Data& d) {
    QJsonObject root;
    root["exported"] = QDateTime::currentDateTime().toString(Qt::ISODate);
    root["app"] = "SalehVault";
    QJsonArray arr;
    for (const auto& e : d.entries) {
        if (e.trashed) continue;
        arr.append(entryToJson(e));
    }
    root["entries"] = arr;
    return QJsonDocument(root).toJson(QJsonDocument::Indented);
}

bool importPlaintextJson(const QByteArray& json, QVector<Entry>& out, QString& err) {
    QJsonParseError pe{};
    QJsonDocument doc = QJsonDocument::fromJson(json, &pe);
    if (pe.error != QJsonParseError::NoError) {
        err = "Invalid JSON: " + pe.errorString();
        return false;
    }
    QJsonArray arr = doc.isArray() ? doc.array() : doc.object()["entries"].toArray();
    if (arr.isEmpty()) {
        err = "No entries found in the file.";
        return false;
    }
    const qint64 now = QDateTime::currentMSecsSinceEpoch();
    for (auto v : arr) {
        Entry e = entryFromJson(v.toObject());
        e.id = newId();
        e.trashed = false;
        e.trashedAt = 0;
        if (e.created == 0) e.created = now;
        e.updated = now;
        if (e.type.isEmpty()) e.type = "login";
        out.append(e);
    }
    return true;
}

// A small, tolerant RFC-4180-ish CSV row splitter.
static QStringList parseCsvLine(const QString& line) {
    QStringList out;
    QString cur;
    bool inQuotes = false;
    for (int i = 0; i < line.size(); ++i) {
        QChar c = line[i];
        if (inQuotes) {
            if (c == '"') {
                if (i + 1 < line.size() && line[i + 1] == '"') { cur += '"'; ++i; }
                else inQuotes = false;
            } else {
                cur += c;
            }
        } else {
            if (c == '"') inQuotes = true;
            else if (c == ',') { out << cur; cur.clear(); }
            else cur += c;
        }
    }
    out << cur;
    return out;
}

bool importCsv(const QByteArray& csv, QVector<Entry>& out, QString& err) {
    const QString text = QString::fromUtf8(csv);
    QStringList lines = text.split(QRegularExpression("\r\n|\n|\r"), Qt::SkipEmptyParts);
    if (lines.isEmpty()) {
        err = "The CSV file is empty.";
        return false;
    }
    QStringList header = parseCsvLine(lines.first());
    QHash<QString, int> col;
    for (int i = 0; i < header.size(); ++i) col[header[i].trimmed().toLower()] = i;

    auto pick = [&](const QStringList& row, std::initializer_list<const char*> keys) -> QString {
        for (const char* k : keys) {
            auto it = col.find(QString(k));
            if (it != col.end() && it.value() < row.size()) return row[it.value()].trimmed();
        }
        return {};
    };
    const bool hasHeader = col.contains("password") || col.contains("username") ||
                           col.contains("login_password") || col.contains("name") || col.contains("url");
    const qint64 now = QDateTime::currentMSecsSinceEpoch();
    int start = hasHeader ? 1 : 0;
    for (int i = start; i < lines.size(); ++i) {
        QStringList row = parseCsvLine(lines[i]);
        if (row.isEmpty()) continue;
        Entry e = newEntry("login");
        e.created = e.updated = now;
        if (hasHeader) {
            e.title = pick(row, {"name", "title", "account"});
            e.url = pick(row, {"url", "website", "uri", "login_uri"});
            e.username = pick(row, {"username", "user", "login", "login_username", "email"});
            e.password = pick(row, {"password", "login_password", "pass"});
            e.notes = pick(row, {"notes", "note", "comment", "extra"});
            e.totp = pick(row, {"totp", "otpauth", "otp"});
        } else {
            // positional: name,url,username,password,notes
            if (row.size() > 0) e.title = row[0].trimmed();
            if (row.size() > 1) e.url = row[1].trimmed();
            if (row.size() > 2) e.username = row[2].trimmed();
            if (row.size() > 3) e.password = row[3].trimmed();
            if (row.size() > 4) e.notes = row[4].trimmed();
        }
        if (e.title.isEmpty()) e.title = e.url.isEmpty() ? e.username : domainOf(e.url);
        if (e.title.isEmpty() && e.password.isEmpty() && e.username.isEmpty()) continue;
        out.append(e);
    }
    if (out.isEmpty()) {
        err = "No importable rows were found.";
        return false;
    }
    return true;
}

static QString csvEscape(const QString& s) {
    if (s.contains(',') || s.contains('"') || s.contains('\n')) {
        QString q = s;
        q.replace("\"", "\"\"");
        return "\"" + q + "\"";
    }
    return s;
}

QByteArray exportCsv(const Data& d) {
    QString out = "name,url,username,password,notes,totp\n";
    for (const auto& e : d.entries) {
        if (e.trashed || !typeHasPassword(e.type)) continue;
        QStringList cells = {csvEscape(e.title), csvEscape(e.url), csvEscape(e.username),
                             csvEscape(e.password), csvEscape(e.notes), csvEscape(e.totp)};
        out += cells.join(",") + "\n";
    }
    return out.toUtf8();
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------
QString newId() {
    return QString::fromLatin1(toQBA(vc::randomBytes(12)).toHex());
}

Entry newEntry(const QString& type) {
    Entry e;
    e.id = newId();
    e.type = type;
    e.created = e.updated = QDateTime::currentMSecsSinceEpoch();
    return e;
}

QString detectCardBrand(const QString& number) {
    QString n = number;
    n.remove(' ');
    if (n.startsWith('4')) return "Visa";
    if (n.startsWith("34") || n.startsWith("37")) return "Amex";
    if (n.startsWith('5')) return "Mastercard";
    if (n.startsWith("6")) return "Discover";
    if (n.startsWith("35")) return "JCB";
    if (n.startsWith("62")) return "UnionPay";
    return "Card";
}

QString domainOf(const QString& url) {
    if (url.isEmpty()) return {};
    QUrl u(url.contains("://") ? url : "https://" + url);
    QString h = u.host();
    if (h.startsWith("www.")) h = h.mid(4);
    return h.isEmpty() ? url : h;
}

QString subtitleFor(const Entry& e) {
    if (e.type == "login") return e.username.isEmpty() ? domainOf(e.url) : e.username;
    if (e.type == "card") return e.cardNumber.isEmpty() ? e.cardBrand : "•••• " + e.cardNumber.right(4);
    if (e.type == "identity") return e.email.isEmpty() ? e.fullName : e.email;
    if (e.type == "totp") return e.otpIssuer;
    if (e.type == "ssh") return e.username.isEmpty() ? e.url : e.username + "@" + e.url;
    if (e.type == "api") return e.url.isEmpty() ? "API key" : domainOf(e.url);
    if (e.type == "wifi") return e.wifiSsid.isEmpty() ? "Wi-Fi" : e.wifiSsid;
    if (e.type == "bank") return e.bankName.isEmpty() ? (e.accountNumber.isEmpty() ? "Account" : "••" + e.accountNumber.right(4)) : e.bankName;
    if (e.type == "crypto") return e.walletType.isEmpty() ? "Wallet" : e.walletType;
    if (e.type == "server") return e.serverHost.isEmpty() ? e.username : (e.username.isEmpty() ? e.serverHost : e.username + "@" + e.serverHost);
    if (e.type == "license") return e.licenseOwner.isEmpty() ? "Licence" : e.licenseOwner;
    return e.notes.left(48);
}

// ---------------------------------------------------------------------------
// statistics
// ---------------------------------------------------------------------------
Stats computeStats(const Data& d) {
    Stats s;
    const qint64 now = QDateTime::currentMSecsSinceEpoch();
    const qint64 month = 30LL * 24 * 3600 * 1000;
    QHash<QString, int> typeCount, folderCount;
    for (const auto& e : d.entries) {
        if (e.trashed) { s.trashed++; continue; }
        s.total++;
        if (e.favorite) s.favorites++;
        if (!e.totp.isEmpty() || !e.otpSecret.isEmpty()) s.withTotp++;
        if (e.expiresAt > 0) {
            if (e.expiresAt < now) s.expired++;
            else if (e.expiresAt - now < month) s.expiringSoon++;
        }
        typeCount[e.type]++;
        if (!e.folder.isEmpty()) folderCount[e.folder]++;
        if (e.updated > s.newestUpdate) s.newestUpdate = e.updated;
        if (s.oldestCreate == 0 || (e.created > 0 && e.created < s.oldestCreate)) s.oldestCreate = e.created;
    }
    for (const auto& t : types())
        if (typeCount.value(t.id) > 0) s.byType.append({t.id, typeCount.value(t.id)});
    for (const auto& f : d.folders)
        if (folderCount.value(f.id) > 0) s.byFolder.append({f.id, folderCount.value(f.id)});
    return s;
}

// ---------------------------------------------------------------------------
// security audit
// ---------------------------------------------------------------------------
Audit audit(const QVector<Entry>& entries, int ageDays) {
    Audit a;
    QVector<const Entry*> creds;
    for (const auto& e : entries)
        if (!e.trashed && typeHasPassword(e.type) && !e.password.isEmpty()) creds.append(&e);

    a.totalWithPasswords = creds.size();

    QHash<QByteArray, QVector<const Entry*>> byHash;
    double entropySum = 0;
    const qint64 now = QDateTime::currentMSecsSinceEpoch();
    const qint64 ageMs = static_cast<qint64>(ageDays) * 24 * 3600 * 1000;
    const qint64 month = 30LL * 24 * 3600 * 1000;

    for (const Entry* e : creds) {
        vc::Strength s = vc::analyzeStrength(sstr(e->password));
        entropySum += s.entropyBits;
        if (s.score <= 1)
            a.weak.append({e->id, e->title, QString("~%1 bits").arg(static_cast<int>(s.entropyBits))});

        QByteArray h = QCryptographicHash::hash(e->password.toUtf8(), QCryptographicHash::Sha256);
        byHash[h].append(e);

        if (now - (e->updated ? e->updated : e->created) > ageMs)
            a.old.append({e->id, e->title, QString("over %1 days old").arg(ageDays)});
        if (e->type == "login" && e->totp.isEmpty())
            a.no2fa.append({e->id, e->title, "no 2FA"});
        if (e->url.startsWith("http://", Qt::CaseInsensitive))
            a.insecure.append({e->id, e->title, "HTTP (not HTTPS)"});
    }

    // expiry (across all password-bearing & non-bearing items)
    for (const auto& e : entries) {
        if (e.trashed || e.expiresAt <= 0) continue;
        if (e.expiresAt < now)
            a.expiring.append({e.id, e.title, "expired"});
        else if (e.expiresAt - now < month)
            a.expiring.append({e.id, e.title, "expires soon"});
    }

    for (auto it = byHash.begin(); it != byHash.end(); ++it) {
        if (it.value().size() > 1)
            for (const Entry* e : it.value())
                a.reused.append({e->id, e->title, QString("reused ×%1").arg(it.value().size())});
    }

    if (creds.isEmpty()) { a.avgEntropy = 0; a.score = 100; return a; }
    a.avgEntropy = entropySum / creds.size();
    const int total = creds.size();
    const int penalty = a.weak.size() * 14 + a.reused.size() * 10 + a.old.size() * 4 +
                        a.no2fa.size() * 3 + a.insecure.size() * 6 + a.expiring.size() * 4;
    a.score = std::max(0, std::min(100, 100 - penalty / total));
    return a;
}

}  // namespace vault
