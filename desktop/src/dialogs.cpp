#include "dialogs.hpp"

#include <QCheckBox>
#include <QComboBox>
#include <QDateEdit>
#include <QDateTime>
#include <QDialogButtonBox>
#include <QFormLayout>
#include <QFrame>
#include <QHBoxLayout>
#include <QLabel>
#include <QLineEdit>
#include <QPushButton>
#include <QScrollArea>
#include <QSpinBox>
#include <QTextEdit>
#include <QTimer>
#include <QVBoxLayout>

#include "crypto.hpp"
#include "effects.hpp"
#include "generator.hpp"
#include "theme.hpp"

// ===========================================================================
//  CustomFieldsEditor
// ===========================================================================
CustomFieldsEditor::CustomFieldsEditor(const QVector<vault::CustomField>& fields, QWidget* parent)
    : QWidget(parent) {
    auto* root = new QVBoxLayout(this);
    root->setContentsMargins(0, 0, 0, 0);
    root->setSpacing(6);
    rows_ = new QVBoxLayout();
    rows_->setSpacing(6);
    root->addLayout(rows_);

    auto* add = new QPushButton("＋ Add custom field", this);
    add->setObjectName("chip");
    connect(add, &QPushButton::clicked, this, [this] { addRow({}); });
    root->addWidget(add, 0, Qt::AlignLeft);

    for (const auto& f : fields) addRow(f);
}

void CustomFieldsEditor::addRow(const vault::CustomField& f) {
    auto* container = new QWidget(this);
    auto* h = new QHBoxLayout(container);
    h->setContentsMargins(0, 0, 0, 0);
    h->setSpacing(6);
    auto* label = new QLineEdit(f.label, container);
    label->setPlaceholderText("Label");
    label->setMaximumWidth(150);
    auto* value = new QLineEdit(f.value, container);
    value->setPlaceholderText("Value");
    value->setObjectName("mono");
    if (f.secret) value->setEchoMode(QLineEdit::Password);
    auto* secret = new QCheckBox("hide", container);
    secret->setChecked(f.secret);
    connect(secret, &QCheckBox::toggled, value, [value](bool on) {
        value->setEchoMode(on ? QLineEdit::Password : QLineEdit::Normal);
    });
    auto* del = new QPushButton("✕", container);
    del->setObjectName("ghost");
    del->setFixedWidth(30);
    h->addWidget(label);
    h->addWidget(value, 1);
    h->addWidget(secret);
    h->addWidget(del);
    rows_->addWidget(container);

    Row row{label, value, secret, container};
    items_.append(row);
    connect(del, &QPushButton::clicked, this, [this, container] {
        for (int i = 0; i < items_.size(); ++i)
            if (items_[i].container == container) { items_.remove(i); break; }
        container->deleteLater();
    });
}

QVector<vault::CustomField> CustomFieldsEditor::fields() const {
    QVector<vault::CustomField> out;
    for (const auto& r : items_) {
        if (r.label->text().trimmed().isEmpty() && r.value->text().isEmpty()) continue;
        out.append({r.label->text().trimmed(), r.value->text(), r.secret->isChecked()});
    }
    return out;
}

// ===========================================================================
//  EntryDialog
// ===========================================================================
QLineEdit* EntryDialog::addLine(QFormLayout* form, const QString& key, const QString& label,
                                const QString& val, bool mono) {
    auto* le = new QLineEdit(val, this);
    if (mono) le->setObjectName("mono");
    fields_[key] = le;
    form->addRow(label, le);
    return le;
}

QTextEdit* EntryDialog::addArea(QFormLayout* form, const QString& key, const QString& label,
                                const QString& val, int height, bool mono) {
    auto* te = new QTextEdit(val, this);
    te->setFixedHeight(height);
    if (mono) te->setObjectName("mono");
    areas_[key] = te;
    form->addRow(label, te);
    return te;
}

void EntryDialog::buildPasswordRow(QFormLayout* form, const QString& label) {
    pwEdit_ = new QLineEdit(e_.password, this);
    pwEdit_->setObjectName("mono");
    pwEdit_->setEchoMode(QLineEdit::Password);
    auto* rev = new QPushButton("👁", this);
    rev->setObjectName("ghost");
    rev->setCheckable(true);
    rev->setFixedWidth(38);
    connect(rev, &QPushButton::toggled, this, [this](bool on) {
        pwEdit_->setEchoMode(on ? QLineEdit::Normal : QLineEdit::Password);
    });
    auto* gen = new QPushButton("Generate", this);
    connect(gen, &QPushButton::clicked, this, [this] {
        QDialog d(this);
        d.setWindowTitle("Password generator");
        d.setMinimumWidth(420);
        auto* v = new QVBoxLayout(&d);
        auto* g = new GeneratorWidget(&d, true);
        v->addWidget(g);
        connect(g, &GeneratorWidget::useRequested, &d, [this, &d](const QString& val) {
            pwEdit_->setText(val);
            d.accept();
        });
        d.exec();
    });
    auto* pwRow = new QHBoxLayout();
    pwRow->addWidget(pwEdit_, 1);
    pwRow->addWidget(rev);
    pwRow->addWidget(gen);
    form->addRow(label, pwRow);

    pwStrength_ = new QLabel(this);
    pwStrength_->setObjectName("muted");
    form->addRow("", pwStrength_);
    auto upStr = [this] {
        if (pwEdit_->text().isEmpty()) { pwStrength_->setText(""); return; }
        vc::Strength s = vc::analyzeStrength(pwEdit_->text().toStdString());
        static const char* col[] = {"#ef4444", "#f97316", "#eab308", "#84cc16", "#22c55e"};
        pwStrength_->setText(QString("<span style='color:%1'>~%2 bits · %3</span>")
                                 .arg(col[qBound(0, s.score, 4)])
                                 .arg(int(s.entropyBits))
                                 .arg(QString::fromStdString(s.crackTime)));
    };
    connect(pwEdit_, &QLineEdit::textChanged, this, [upStr] { upStr(); });
    upStr();
}

EntryDialog::EntryDialog(const vault::Entry& e, const QVector<vault::Folder>& folders, QWidget* parent)
    : QDialog(parent), e_(e), folders_(folders) {
    setWindowTitle(QString("%1 %2").arg(vault::typeIcon(e.type),
                                        e.title.isEmpty() ? "New " + vault::typeLabel(e.type).toLower() : e.title));
    setModal(true);
    setMinimumWidth(500);

    auto* root = new QVBoxLayout(this);
    auto* scroll = new QScrollArea(this);
    scroll->setWidgetResizable(true);
    scroll->setFrameShape(QFrame::NoFrame);
    auto* inner = new QWidget();
    auto* form = new QFormLayout(inner);
    form->setLabelAlignment(Qt::AlignLeft);
    form->setFieldGrowthPolicy(QFormLayout::AllNonFixedFieldsGrow);
    form->setSpacing(10);

    addLine(form, "title", "Title", e.title);

    const QString t = e.type;
    if (t == "login") {
        addLine(form, "username", "Username / email", e.username, true);
        buildPasswordRow(form, "Password");
        addLine(form, "url", "Website", e.url, true);
        addLine(form, "totp", "2FA secret (otpauth:// or base32)", e.totp, true);
        totpKey_ = "totp";
    } else if (t == "note") {
        // large notes editor is added below (shared section)
    } else if (t == "card") {
        addLine(form, "cardholder", "Cardholder", e.cardholder);
        addLine(form, "cardNumber", "Card number", e.cardNumber, true);
        addLine(form, "cardExpiry", "Expiry (MM/YY)", e.cardExpiry, true);
        addLine(form, "cardCvv", "CVV", e.cardCvv, true);
        addLine(form, "cardPin", "PIN", e.cardPin, true);
    } else if (t == "identity") {
        addLine(form, "fullName", "Full name", e.fullName);
        addLine(form, "email", "Email", e.email, true);
        addLine(form, "phone", "Phone", e.phone, true);
        addArea(form, "address", "Address", e.address, 70);
    } else if (t == "totp") {
        addLine(form, "otpSecret", "2FA secret (otpauth:// or base32)", e.otpSecret, true);
        addLine(form, "otpIssuer", "Issuer", e.otpIssuer);
        totpKey_ = "otpSecret";
    } else if (t == "ssh") {
        addLine(form, "username", "User", e.username, true);
        addLine(form, "url", "Host", e.url, true);
        buildPasswordRow(form, "Key passphrase");
        addArea(form, "sshPublicKey", "Public key", e.sshPublicKey, 80, true);
        addArea(form, "sshPrivateKey", "Private key", e.sshPrivateKey, 120, true);
    } else if (t == "api") {
        addLine(form, "url", "Endpoint / base URL", e.url, true);
        addLine(form, "apiKey", "API key / client id", e.apiKey, true);
        addLine(form, "apiSecret", "API secret", e.apiSecret, true);
    } else if (t == "wifi") {
        addLine(form, "wifiSsid", "Network (SSID)", e.wifiSsid);
        wifiSec_ = new QComboBox(this);
        wifiSec_->addItems({"WPA3", "WPA2", "WPA", "WEP", "Open"});
        int wi = wifiSec_->findText(e.wifiSecurity);
        wifiSec_->setCurrentIndex(wi >= 0 ? wi : 1);
        form->addRow("Security", wifiSec_);
        buildPasswordRow(form, "Wi-Fi password");
    } else if (t == "bank") {
        addLine(form, "bankName", "Bank", e.bankName);
        addLine(form, "cardholder", "Account holder", e.cardholder);
        addLine(form, "accountNumber", "Account number", e.accountNumber, true);
        addLine(form, "routingNumber", "Routing / sort code", e.routingNumber, true);
        addLine(form, "iban", "IBAN", e.iban, true);
        addLine(form, "swift", "SWIFT / BIC", e.swift, true);
        buildPasswordRow(form, "PIN / access code");
    } else if (t == "crypto") {
        addLine(form, "walletType", "Network / wallet", e.walletType);
        addLine(form, "walletAddress", "Public address", e.walletAddress, true);
        addArea(form, "walletSeed", "Recovery phrase (seed)", e.walletSeed, 90, true);
        buildPasswordRow(form, "Spending password");
    } else if (t == "server") {
        addLine(form, "serverHost", "Host / IP", e.serverHost, true);
        addLine(form, "serverPort", "Port", e.serverPort, true);
        addLine(form, "username", "User", e.username, true);
        buildPasswordRow(form, "Password");
        addLine(form, "dbName", "Database (optional)", e.dbName, true);
    } else if (t == "license") {
        addLine(form, "licenseOwner", "Licensed to", e.licenseOwner);
        addLine(form, "licenseKey", "Licence key", e.licenseKey, true);
        addLine(form, "url", "Vendor / download", e.url, true);
    }

    // live TOTP preview
    if (t == "login" || t == "totp") {
        totpPreview_ = new QLabel(this);
        totpPreview_->setObjectName("code");
        form->addRow("2FA code", totpPreview_);
        if (fields_.contains(totpKey_))
            connect(fields_[totpKey_], &QLineEdit::textChanged, this, [this] { refreshTotp(); });
    }

    // optional expiry (cards, licences, API tokens)
    if (t == "card" || t == "license" || t == "api") {
        auto* exRow = new QHBoxLayout();
        expiryEnable_ = new QCheckBox("Set expiry", this);
        expiry_ = new QDateEdit(this);
        expiry_->setCalendarPopup(true);
        expiry_->setDisplayFormat("yyyy-MM-dd");
        if (e.expiresAt > 0) {
            expiryEnable_->setChecked(true);
            expiry_->setDate(QDateTime::fromMSecsSinceEpoch(e.expiresAt).date());
        } else {
            expiry_->setDate(QDate::currentDate().addYears(1));
            expiry_->setEnabled(false);
        }
        connect(expiryEnable_, &QCheckBox::toggled, expiry_, &QWidget::setEnabled);
        exRow->addWidget(expiryEnable_);
        exRow->addWidget(expiry_, 1);
        form->addRow("Expires", exRow);
    }

    // shared: folder + tags + icon + favorite
    folder_ = new QComboBox(this);
    folder_->addItem("No folder", "");
    for (const auto& f : folders_) folder_->addItem(f.icon + " " + f.name, f.id);
    int fi = folder_->findData(e.folder);
    if (fi >= 0) folder_->setCurrentIndex(fi);
    form->addRow("Folder", folder_);

    tags_ = new QLineEdit(e.tags.join(", "), this);
    tags_->setPlaceholderText("comma, separated, tags");
    form->addRow("Tags", tags_);

    icon_ = new QLineEdit(e.iconEmoji, this);
    icon_->setPlaceholderText(vault::typeIcon(t) + "  (optional custom emoji)");
    icon_->setMaxLength(4);
    icon_->setFixedWidth(90);
    form->addRow("Icon", icon_);

    favorite_ = new QCheckBox("Favorite", this);
    favorite_->setChecked(e.favorite);
    form->addRow("", favorite_);

    notes_ = new QTextEdit(e.notes, this);
    notes_->setFixedHeight(t == "note" ? 200 : 70);
    form->addRow(t == "note" ? "Content" : "Notes", notes_);

    // custom fields
    auto* cfLabel = new QLabel("CUSTOM FIELDS", this);
    cfLabel->setObjectName("label");
    form->addRow(cfLabel);
    custom_ = new CustomFieldsEditor(e.customFields, this);
    form->addRow(custom_);

    scroll->setWidget(inner);
    root->addWidget(scroll, 1);

    auto* bb = new QDialogButtonBox(QDialogButtonBox::Save | QDialogButtonBox::Cancel, this);
    bb->button(QDialogButtonBox::Save)->setObjectName("accent");
    connect(bb, &QDialogButtonBox::accepted, this, &QDialog::accept);
    connect(bb, &QDialogButtonBox::rejected, this, &QDialog::reject);
    root->addWidget(bb);

    resize(560, 640);

    if (totpPreview_) {
        totpTimer_ = new QTimer(this);
        connect(totpTimer_, &QTimer::timeout, this, &EntryDialog::refreshTotp);
        totpTimer_->start(1000);
        refreshTotp();
    }
    fx::popIn(this);
}

void EntryDialog::refreshTotp() {
    if (!totpPreview_ || !fields_.contains(totpKey_)) return;
    const QString raw = fields_[totpKey_]->text();
    vc::OtpAuth p = vc::parseOtpAuth(raw.toStdString());
    if (p.secret.empty()) {
        totpPreview_->setText(raw.isEmpty() ? "—" : "invalid");
        return;
    }
    int rem = 0;
    std::string code = vc::totp(p.secret, QDateTime::currentSecsSinceEpoch(), p.digits, p.period, rem);
    QString pretty = QString::fromStdString(code);
    if (pretty.size() == 6) pretty = pretty.left(3) + " " + pretty.mid(3);
    totpPreview_->setText(QString("%1   (%2s)").arg(pretty).arg(rem));
}

vault::Entry EntryDialog::result() const {
    vault::Entry e = e_;
    auto get = [&](const QString& k) { return fields_.contains(k) ? fields_[k]->text() : QString(); };
    auto area = [&](const QString& k) { return areas_.contains(k) ? areas_[k]->toPlainText() : QString(); };

    e.title = get("title");
    e.username = get("username");
    if (pwEdit_) {
        QString np = pwEdit_->text();
        if (np != e_.password && !e_.password.isEmpty()) e.passwordHistory.prepend(e_.password);
        if (e.passwordHistory.size() > 20) e.passwordHistory = e.passwordHistory.mid(0, 20);
        e.password = np;
    }
    e.url = get("url");
    e.totp = get("totp");
    e.cardholder = get("cardholder");
    e.cardNumber = get("cardNumber");
    if (!e.cardNumber.isEmpty()) e.cardBrand = vault::detectCardBrand(e.cardNumber);
    e.cardExpiry = get("cardExpiry");
    e.cardCvv = get("cardCvv");
    e.cardPin = get("cardPin");
    e.fullName = get("fullName");
    e.email = get("email");
    e.phone = get("phone");
    e.address = area("address");
    e.otpSecret = get("otpSecret");
    e.otpIssuer = get("otpIssuer");
    e.sshPublicKey = area("sshPublicKey");
    e.sshPrivateKey = area("sshPrivateKey");
    e.apiKey = get("apiKey");
    e.apiSecret = get("apiSecret");
    e.wifiSsid = get("wifiSsid");
    if (wifiSec_) e.wifiSecurity = wifiSec_->currentText();
    e.bankName = get("bankName");
    e.accountNumber = get("accountNumber");
    e.routingNumber = get("routingNumber");
    e.iban = get("iban");
    e.swift = get("swift");
    e.walletType = get("walletType");
    e.walletAddress = get("walletAddress");
    e.walletSeed = area("walletSeed");
    e.serverHost = get("serverHost");
    e.serverPort = get("serverPort");
    e.dbName = get("dbName");
    e.licenseKey = get("licenseKey");
    e.licenseOwner = get("licenseOwner");

    e.iconEmoji = icon_->text().trimmed();
    e.folder = folder_->currentData().toString();
    e.tags.clear();
    for (const QString& tg : tags_->text().split(',', Qt::SkipEmptyParts)) e.tags << tg.trimmed();
    e.favorite = favorite_->isChecked();
    e.notes = notes_->toPlainText();
    e.customFields = custom_->fields();

    if (expiryEnable_ && expiry_)
        e.expiresAt = expiryEnable_->isChecked()
                          ? QDateTime(expiry_->date(), QTime(0, 0)).toMSecsSinceEpoch()
                          : 0;

    if (e.title.isEmpty())
        e.title = !e.url.isEmpty() ? vault::domainOf(e.url)
                                   : (!e.username.isEmpty() ? e.username : vault::typeLabel(e.type));
    e.updated = QDateTime::currentMSecsSinceEpoch();
    return e;
}

// ===========================================================================
//  SettingsDialog
// ===========================================================================
SettingsDialog::SettingsDialog(const vault::Settings& s, QWidget* parent) : QDialog(parent), s_(s) {
    setWindowTitle("Settings");
    setModal(true);
    setMinimumWidth(480);
    auto* root = new QVBoxLayout(this);
    auto* form = new QFormLayout();
    form->setSpacing(9);

    // ---- appearance --------------------------------------------------------
    auto* appLbl = new QLabel("APPEARANCE", this);
    appLbl->setObjectName("label");
    form->addRow(appLbl);

    theme_ = new QComboBox(this);
    for (const auto& p : theme::palettes())
        theme_->addItem(QString("%1  ·  %2").arg(p.group, p.name), p.id);
    int ti = theme_->findData(s.theme);
    theme_->setCurrentIndex(ti >= 0 ? ti : 0);
    connect(theme_, QOverload<int>::of(&QComboBox::currentIndexChanged), this, [this] {
        emit themePreview(theme_->currentData().toString());
    });
    auto* themeRow = new QHBoxLayout();
    themeRow->addWidget(theme_, 1);
    auto* browse = new QPushButton("Browse…", this);
    connect(browse, &QPushButton::clicked, this, [this] { emit pickThemeRequested(); });
    themeRow->addWidget(browse);
    form->addRow("Theme", themeRow);

    compact_ = new QCheckBox("Compact list rows", this);
    compact_->setChecked(s.compactList);
    form->addRow("", compact_);
    badges_ = new QCheckBox("Show password-strength badges", this);
    badges_->setChecked(s.showStrengthBadges);
    form->addRow("", badges_);

    // ---- security ----------------------------------------------------------
    auto* secLbl = new QLabel("SECURITY & PRIVACY", this);
    secLbl->setObjectName("label");
    form->addRow(secLbl);

    autoLock_ = new QSpinBox(this);
    autoLock_->setRange(0, 120);
    autoLock_->setValue(s.autoLockMinutes);
    autoLock_->setSuffix(" min");
    autoLock_->setSpecialValueText("Never");
    form->addRow("Auto-lock after", autoLock_);

    clip_ = new QSpinBox(this);
    clip_->setRange(0, 300);
    clip_->setValue(s.clipboardClearSeconds);
    clip_->setSuffix(" s");
    clip_->setSpecialValueText("Never");
    form->addRow("Clear clipboard after", clip_);

    reveal_ = new QSpinBox(this);
    reveal_->setRange(0, 120);
    reveal_->setValue(s.revealSeconds);
    reveal_->setSuffix(" s");
    reveal_->setSpecialValueText("Never");
    form->addRow("Re-hide revealed after", reveal_);

    ageDays_ = new QSpinBox(this);
    ageDays_->setRange(30, 3650);
    ageDays_->setValue(s.passwordAgeDays);
    ageDays_->setSuffix(" days");
    form->addRow("Flag passwords older than", ageDays_);

    conceal_ = new QCheckBox("Conceal passwords by default", this);
    conceal_->setChecked(s.concealByDefault);
    form->addRow("", conceal_);
    lockMin_ = new QCheckBox("Lock when minimized / hidden", this);
    lockMin_->setChecked(s.lockOnMinimize);
    form->addRow("", lockMin_);
    tray_ = new QCheckBox("Minimize to system tray", this);
    tray_->setChecked(s.minimizeToTray);
    form->addRow("", tray_);
    quick_ = new QCheckBox("Quick Capture — save credentials with Ctrl+Shift+A", this);
    quick_->setChecked(s.quickCapture);
    form->addRow("", quick_);
    confirmDel_ = new QCheckBox("Ask before deleting items", this);
    confirmDel_->setChecked(s.confirmDelete);
    form->addRow("", confirmDel_);

    // ---- behaviour ---------------------------------------------------------
    auto* behLbl = new QLabel("BEHAVIOUR", this);
    behLbl->setObjectName("label");
    form->addRow(behLbl);

    defType_ = new QComboBox(this);
    for (const auto& ty : vault::types()) defType_->addItem(ty.icon + "  " + ty.label, ty.id);
    int di = defType_->findData(s.defaultNewType);
    defType_->setCurrentIndex(di >= 0 ? di : 0);
    form->addRow("Default new item", defType_);

    kdf_ = new QComboBox(this);
    kdf_->addItem("Fast (Argon2id, 64 MB)", "interactive");
    kdf_->addItem("Recommended (256 MB)", "moderate");
    kdf_->addItem("Paranoid (1 GB)", "sensitive");
    kdf_->setCurrentIndex(s.kdf == "interactive" ? 0 : s.kdf == "sensitive" ? 2 : 1);
    form->addRow("Key strength (next save)", kdf_);

    root->addLayout(form);

    auto* actions = new QHBoxLayout();
    auto* chg = new QPushButton("Change master password", this);
    auto* exp = new QPushButton("Export backup", this);
    auto* fld = new QPushButton("Open vault folder", this);
    connect(chg, &QPushButton::clicked, this, [this] { emit changeMasterRequested(); });
    connect(exp, &QPushButton::clicked, this, [this] { emit exportRequested(); });
    connect(fld, &QPushButton::clicked, this, [this] { emit openFolderRequested(); });
    actions->addWidget(chg);
    actions->addWidget(exp);
    actions->addWidget(fld);
    root->addLayout(actions);

    auto* wipe = new QPushButton("Erase this vault", this);
    wipe->setObjectName("danger");
    connect(wipe, &QPushButton::clicked, this, [this] { emit wipeRequested(); });
    root->addWidget(wipe);

    auto* bb = new QDialogButtonBox(QDialogButtonBox::Save | QDialogButtonBox::Cancel, this);
    bb->button(QDialogButtonBox::Save)->setObjectName("accent");
    connect(bb, &QDialogButtonBox::accepted, this, &QDialog::accept);
    connect(bb, &QDialogButtonBox::rejected, this, [this] {
        emit themePreview(s_.theme);  // revert live preview on cancel
        reject();
    });
    root->addWidget(bb);
}

vault::Settings SettingsDialog::result() const {
    vault::Settings s = s_;
    s.autoLockMinutes = autoLock_->value();
    s.clipboardClearSeconds = clip_->value();
    s.concealByDefault = conceal_->isChecked();
    s.lockOnMinimize = lockMin_->isChecked();
    s.minimizeToTray = tray_->isChecked();
    s.quickCapture = quick_->isChecked();
    s.revealSeconds = reveal_->value();
    s.theme = theme_->currentData().toString();
    s.kdf = kdf_->currentData().toString();
    s.compactList = compact_->isChecked();
    s.showStrengthBadges = badges_->isChecked();
    s.confirmDelete = confirmDel_->isChecked();
    s.passwordAgeDays = ageDays_->value();
    s.defaultNewType = defType_->currentData().toString();
    return s;
}

// ===========================================================================
//  AuditDialog
// ===========================================================================
AuditDialog::AuditDialog(const vault::Audit& a, QWidget* parent) : QDialog(parent) {
    setWindowTitle("Security audit");
    setModal(true);
    setMinimumSize(480, 500);
    auto* root = new QVBoxLayout(this);

    const QString col = a.score >= 80 ? "#22c55e" : a.score >= 55 ? "#eab308" : "#ef4444";
    auto* score = new QLabel(QString("<span style='font-size:46px;font-weight:800;color:%1'>%2</span>"
                                     "<span style='color:#8b929e'> / 100</span>")
                                 .arg(col)
                                 .arg(a.score),
                             this);
    root->addWidget(score);
    auto* meta = new QLabel(QString("%1 credentials · avg ~%2 bits entropy")
                                .arg(a.totalWithPasswords)
                                .arg(int(a.avgEntropy)),
                            this);
    meta->setObjectName("muted");
    root->addWidget(meta);

    auto* area = new QScrollArea(this);
    area->setWidgetResizable(true);
    area->setFrameShape(QFrame::NoFrame);
    auto* inner = new QWidget();
    auto* iv = new QVBoxLayout(inner);

    auto section = [&](const QString& title, const QVector<vault::AuditIssue>& items, const QString& c) {
        if (items.isEmpty()) return;
        auto* h = new QLabel(QString("<b style='color:%1'>%2</b> (%3)").arg(c).arg(title).arg(items.size()), inner);
        iv->addWidget(h);
        for (const auto& it : items) {
            auto* row = new QLabel(QString("• %1 — <span style='color:#8b929e'>%2</span>").arg(it.title.toHtmlEscaped(), it.detail), inner);
            iv->addWidget(row);
        }
    };
    section("Weak passwords", a.weak, "#ef4444");
    section("Reused passwords", a.reused, "#f97316");
    section("Aging passwords", a.old, "#eab308");
    section("Missing 2FA", a.no2fa, "#67e8f9");
    section("Insecure URLs", a.insecure, "#f97316");
    section("Expiring items", a.expiring, "#a78bfa");
    if (a.weak.isEmpty() && a.reused.isEmpty() && a.old.isEmpty() && a.no2fa.isEmpty() &&
        a.insecure.isEmpty() && a.expiring.isEmpty())
        iv->addWidget(new QLabel("<b style='color:#22c55e'>No issues found — your vault looks healthy.</b>", inner));
    iv->addStretch();
    area->setWidget(inner);
    root->addWidget(area, 1);

    auto* bb = new QDialogButtonBox(QDialogButtonBox::Close, this);
    connect(bb, &QDialogButtonBox::rejected, this, &QDialog::accept);
    connect(bb, &QDialogButtonBox::accepted, this, &QDialog::accept);
    root->addWidget(bb);
}

// ===========================================================================
//  ChangeMasterDialog
// ===========================================================================
ChangeMasterDialog::ChangeMasterDialog(QWidget* parent) : QDialog(parent) {
    setWindowTitle("Change master password");
    setModal(true);
    setMinimumWidth(380);
    auto* root = new QVBoxLayout(this);
    auto* form = new QFormLayout();
    cur_ = new QLineEdit(this);
    cur_->setEchoMode(QLineEdit::Password);
    nw_ = new QLineEdit(this);
    nw_->setEchoMode(QLineEdit::Password);
    nw2_ = new QLineEdit(this);
    nw2_->setEchoMode(QLineEdit::Password);
    form->addRow("Current password", cur_);
    form->addRow("New password", nw_);
    form->addRow("Confirm new", nw2_);
    root->addLayout(form);
    err_ = new QLabel(this);
    err_->setStyleSheet("color:#ff6b6b;");
    root->addWidget(err_);
    auto* bb = new QDialogButtonBox(QDialogButtonBox::Ok | QDialogButtonBox::Cancel, this);
    bb->button(QDialogButtonBox::Ok)->setObjectName("accent");
    connect(bb, &QDialogButtonBox::accepted, this, [this] {
        if (nw_->text() != nw2_->text()) { err_->setText("New passwords don't match."); return; }
        if (vc::analyzeStrength(nw_->text().toStdString()).score < 2) { err_->setText("Choose a stronger password."); return; }
        accept();
    });
    connect(bb, &QDialogButtonBox::rejected, this, &QDialog::reject);
    root->addWidget(bb);
}
QString ChangeMasterDialog::currentPassword() const { return cur_->text(); }
QString ChangeMasterDialog::newPassword() const { return nw_->text(); }
