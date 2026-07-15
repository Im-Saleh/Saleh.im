#include "mainwindow.hpp"

#include <QApplication>
#include <QCloseEvent>
#include <QClipboard>
#include <QDateTime>
#include <QDesktopServices>
#include <QEvent>
#include <QFile>
#include <QFileDialog>
#include <QHBoxLayout>
#include <QIcon>
#include <QKeySequence>
#include <QLabel>
#include <QLineEdit>
#include <QListWidget>
#include <QListWidgetItem>
#include <QMenu>
#include <QMessageBox>
#include <QPushButton>
#include <QScrollArea>
#include <QShortcut>
#include <QSystemTrayIcon>
#include <QTimer>
#include <QUrl>
#include <QVBoxLayout>

#include "authdialog.hpp"
#include "crypto.hpp"
#include "dialogs.hpp"
#include "generator.hpp"
#include "theme.hpp"

static QString iconFor(const QString& type) {
    if (type == "login") return "🔑";
    if (type == "note") return "📝";
    if (type == "card") return "💳";
    if (type == "identity") return "🪪";
    if (type == "totp") return "🛡️";
    return "•";
}

MainWindow::MainWindow(const QString& path, const QString& password, const QByteArray& keyfile,
                       const QString& kdfPreset, const vault::Data& data, QWidget* parent)
    : QMainWindow(parent), path_(path), password_(password), keyfile_(keyfile),
      kdfPreset_(kdfPreset), data_(data) {
    setWindowTitle("Vault");
    resize(1120, 760);
    buildUi();
    buildTray();
    installShortcuts();
    rebuildSidebar();
    rebuildList();

    idleTimer_ = new QTimer(this);
    idleTimer_->setSingleShot(true);
    connect(idleTimer_, &QTimer::timeout, this, &MainWindow::lock);
    auto resetIdle = [this] {
        if (data_.settings.autoLockMinutes > 0)
            idleTimer_->start(data_.settings.autoLockMinutes * 60 * 1000);
        else
            idleTimer_->stop();
    };
    resetIdle();
    qApp->installEventFilter(this);

    totpTimer_ = new QTimer(this);
    connect(totpTimer_, &QTimer::timeout, this, [this] {
        if (totpLabel_ && !totpSecretForDetail_.isEmpty()) {
            vc::OtpAuth p = vc::parseOtpAuth(totpSecretForDetail_.toStdString());
            if (!p.secret.empty()) {
                int rem = 0;
                std::string c = vc::totp(p.secret, QDateTime::currentSecsSinceEpoch(), p.digits, p.period, rem);
                QString pretty = QString::fromStdString(c);
                if (pretty.size() == 6) pretty = pretty.left(3) + " " + pretty.mid(3);
                totpLabel_->setText(QString("%1   (%2s)").arg(pretty).arg(rem));
            }
        }
    });
    totpTimer_->start(1000);

    clipTimer_ = new QTimer(this);
    clipTimer_->setSingleShot(true);
    connect(clipTimer_, &QTimer::timeout, this, [this] {
        if (!lastClip_.isEmpty() && QApplication::clipboard()->text() == lastClip_)
            QApplication::clipboard()->clear();
        lastClip_.clear();
    });

    applyTheme(data_.settings.theme);
}

// ---------------------------------------------------------------------------
// UI
// ---------------------------------------------------------------------------
void MainWindow::buildUi() {
    auto* central = new QWidget(this);
    auto* h = new QHBoxLayout(central);
    h->setContentsMargins(0, 0, 0, 0);
    h->setSpacing(0);

    // sidebar
    sidebar_ = new QWidget(central);
    sidebar_->setObjectName("sidebar");
    sidebar_->setFixedWidth(210);
    sidebarLayout_ = new QVBoxLayout(sidebar_);
    sidebarLayout_->setContentsMargins(10, 14, 10, 14);
    sidebarLayout_->setSpacing(2);
    h->addWidget(sidebar_);

    // middle column
    auto* mid = new QWidget(central);
    auto* mv = new QVBoxLayout(mid);
    mv->setContentsMargins(14, 12, 14, 12);
    mv->setSpacing(10);

    auto* top = new QHBoxLayout();
    searchEdit_ = new QLineEdit(mid);
    searchEdit_->setPlaceholderText("Search vault…   (Ctrl+F)");
    searchEdit_->setClearButtonEnabled(true);
    connect(searchEdit_, &QLineEdit::textChanged, this, [this](const QString& t) {
        search_ = t;
        rebuildList();
    });
    top->addWidget(searchEdit_, 1);

    auto* newBtn = new QPushButton("＋ New", mid);
    newBtn->setObjectName("accent");
    auto* newMenu = new QMenu(newBtn);
    struct { const char* label; const char* type; } types[] = {
        {"🔑  Login", "login"}, {"🛡️  2FA code", "totp"}, {"📝  Secure note", "note"},
        {"💳  Card", "card"}, {"🪪  Identity", "identity"}};
    for (auto& t : types) {
        QString ty = t.type;
        newMenu->addAction(t.label, this, [this, ty] { newEntry(ty); });
    }
    newBtn->setMenu(newMenu);
    top->addWidget(newBtn);

    auto* genBtn = new QPushButton("🎲", mid);
    genBtn->setToolTip("Generator (Ctrl+G)");
    connect(genBtn, &QPushButton::clicked, this, &MainWindow::openGenerator);
    top->addWidget(genBtn);
    auto* audBtn = new QPushButton("🛡", mid);
    audBtn->setToolTip("Security audit");
    connect(audBtn, &QPushButton::clicked, this, &MainWindow::openAudit);
    top->addWidget(audBtn);
    auto* setBtn = new QPushButton("⚙", mid);
    setBtn->setToolTip("Settings");
    connect(setBtn, &QPushButton::clicked, this, &MainWindow::openSettings);
    top->addWidget(setBtn);
    auto* lockBtn = new QPushButton("🔒", mid);
    lockBtn->setToolTip("Lock (Ctrl+L)");
    connect(lockBtn, &QPushButton::clicked, this, &MainWindow::lock);
    top->addWidget(lockBtn);
    mv->addLayout(top);

    list_ = new QListWidget(mid);
    list_->setSpacing(2);
    connect(list_, &QListWidget::currentItemChanged, this, [this](QListWidgetItem* it) {
        if (it) showDetail(it->data(Qt::UserRole).toString());
    });
    connect(list_, &QListWidget::itemDoubleClicked, this, [this](QListWidgetItem* it) {
        if (it) editEntry(it->data(Qt::UserRole).toString());
    });
    mv->addWidget(list_, 1);
    h->addWidget(mid, 1);

    // detail
    auto* scroll = new QScrollArea(central);
    scroll->setObjectName("detail");
    scroll->setWidgetResizable(true);
    scroll->setFixedWidth(380);
    scroll->setFrameShape(QFrame::NoFrame);
    detail_ = new QWidget();
    detailLayout_ = new QVBoxLayout(detail_);
    detailLayout_->setContentsMargins(20, 20, 20, 20);
    detailLayout_->setSpacing(10);
    detailLayout_->addStretch();
    scroll->setWidget(detail_);
    h->addWidget(scroll);

    setCentralWidget(central);
}

void MainWindow::rebuildSidebar() {
    // clear
    QLayoutItem* item;
    while ((item = sidebarLayout_->takeAt(0)) != nullptr) {
        if (item->widget()) item->widget()->deleteLater();
        delete item;
    }
    struct Nav { QString key; QString label; };
    QVector<Nav> navs = {
        {"all", "🗂  All items"}, {"favorites", "★  Favorites"}, {"login", "🔑  Logins"},
        {"totp", "🛡  2FA codes"}, {"note", "📝  Notes"}, {"card", "💳  Cards"}, {"identity", "🪪  Identities"}};
    auto addBtn = [this](const QString& key, const QString& label) {
        auto* b = new QPushButton(label, sidebar_);
        b->setObjectName("nav");
        b->setCheckable(true);
        b->setChecked(filter_ == key);
        connect(b, &QPushButton::clicked, this, [this, key] {
            filter_ = key;
            rebuildSidebar();
            rebuildList();
        });
        sidebarLayout_->addWidget(b);
    };
    for (const auto& n : navs) addBtn(n.key, n.label);

    if (!data_.folders.isEmpty()) {
        auto* lbl = new QLabel("FOLDERS", sidebar_);
        lbl->setObjectName("label");
        lbl->setContentsMargins(10, 10, 0, 4);
        sidebarLayout_->addWidget(lbl);
        for (const auto& f : data_.folders) addBtn("folder:" + f.id, f.icon + "  " + f.name);
    }
    sidebarLayout_->addStretch();
}

void MainWindow::rebuildList() {
    list_->clear();
    const QString q = search_.trimmed().toLower();
    for (const auto& e : data_.entries) {
        // filter
        if (filter_ == "favorites") { if (!e.favorite) continue; }
        else if (filter_.startsWith("folder:")) { if (e.folder != filter_.mid(7)) continue; }
        else if (filter_ != "all") { if (e.type != filter_) continue; }
        // search
        if (!q.isEmpty()) {
            QString hay = (e.title + " " + e.username + " " + e.url + " " + e.email + " " +
                           e.notes + " " + e.otpIssuer + " " + e.tags.join(" ")).toLower();
            if (!hay.contains(q)) continue;
        }
        QString sub = e.type == "login" ? (e.username.isEmpty() ? vault::domainOf(e.url) : e.username)
                      : e.type == "card" ? (e.cardNumber.isEmpty() ? e.cardBrand : "•••• " + e.cardNumber.right(4))
                      : e.type == "identity" ? e.email
                      : e.type == "totp" ? e.otpIssuer
                                          : e.notes.left(40);
        auto* it = new QListWidgetItem(QString("%1  %2\n     %3").arg(iconFor(e.type), e.title.isEmpty() ? "—" : e.title, sub));
        it->setData(Qt::UserRole, e.id);
        if (e.favorite) it->setText(it->text() + "   ★");
        list_->addItem(it);
    }
    if (list_->count() > 0) list_->setCurrentRow(0);
    else showDetail(QString());
}

void MainWindow::addDetailRow(QVBoxLayout* v, const QString& label, const QString& value, bool copyable, bool secret) {
    if (value.isEmpty()) return;
    auto* l = new QLabel(label.toUpper(), detail_);
    l->setObjectName("label");
    v->addWidget(l);
    auto* row = new QHBoxLayout();
    auto* val = new QLabel(secret && !reveal_ ? QString("•").repeated(qMin(16, value.size())) : value, detail_);
    val->setObjectName("mono");
    val->setWordWrap(true);
    val->setTextInteractionFlags(Qt::TextSelectableByMouse);
    row->addWidget(val, 1);
    if (secret) {
        auto* eye = new QPushButton(reveal_ ? "🙈" : "👁", detail_);
        eye->setObjectName("ghost");
        eye->setFixedWidth(34);
        connect(eye, &QPushButton::clicked, this, [this] { reveal_ = !reveal_; showDetail(selectedId_); });
        row->addWidget(eye);
    }
    if (copyable) {
        auto* cp = new QPushButton("⧉", detail_);
        cp->setObjectName("ghost");
        cp->setFixedWidth(34);
        connect(cp, &QPushButton::clicked, this, [this, value] { copyValue(value); });
        row->addWidget(cp);
    }
    v->addLayout(row);
}

void MainWindow::showDetail(const QString& id) {
    selectedId_ = id;
    totpLabel_ = nullptr;
    totpSecretForDetail_.clear();
    // clear
    QLayoutItem* item;
    while ((item = detailLayout_->takeAt(0)) != nullptr) {
        if (item->widget()) item->widget()->deleteLater();
        if (item->layout()) {
            QLayoutItem* c;
            while ((c = item->layout()->takeAt(0)) != nullptr) {
                if (c->widget()) c->widget()->deleteLater();
                delete c;
            }
        }
        delete item;
    }
    const vault::Entry* e = findEntry(id);
    if (!e) {
        auto* empty = new QLabel("Select an item, or press ＋ New.", detail_);
        empty->setObjectName("muted");
        empty->setAlignment(Qt::AlignCenter);
        detailLayout_->addWidget(empty);
        detailLayout_->addStretch();
        return;
    }

    // header
    auto* head = new QHBoxLayout();
    auto* title = new QLabel(QString("%1 %2").arg(iconFor(e->type), e->title), detail_);
    title->setObjectName("h2");
    title->setWordWrap(true);
    head->addWidget(title, 1);
    auto* fav = new QPushButton(e->favorite ? "★" : "☆", detail_);
    fav->setObjectName("ghost");
    fav->setFixedWidth(34);
    QString id2 = e->id;
    connect(fav, &QPushButton::clicked, this, [this, id2] { toggleFavorite(id2); });
    head->addWidget(fav);
    detailLayout_->addLayout(head);

    if (e->type == "login") {
        addDetailRow(detailLayout_, "Username", e->username, true);
        addDetailRow(detailLayout_, "Password", e->password, true, true);
        addDetailRow(detailLayout_, "Website", e->url, true);
        if (!e->url.isEmpty()) {
            auto* open = new QPushButton("Open website ↗", detail_);
            QString url = e->url;
            connect(open, &QPushButton::clicked, this, [url] { QDesktopServices::openUrl(QUrl(url.contains("://") ? url : "https://" + url)); });
            detailLayout_->addWidget(open);
        }
        if (!e->totp.isEmpty()) {
            auto* l = new QLabel("2FA CODE", detail_);
            l->setObjectName("label");
            detailLayout_->addWidget(l);
            totpLabel_ = new QLabel("…", detail_);
            totpLabel_->setObjectName("code");
            totpSecretForDetail_ = e->totp;
            auto* row = new QHBoxLayout();
            row->addWidget(totpLabel_, 1);
            auto* cp = new QPushButton("⧉", detail_);
            cp->setObjectName("ghost");
            cp->setFixedWidth(34);
            connect(cp, &QPushButton::clicked, this, [this] {
                vc::OtpAuth p = vc::parseOtpAuth(totpSecretForDetail_.toStdString());
                if (!p.secret.empty()) { int r; copyValue(QString::fromStdString(vc::totp(p.secret, QDateTime::currentSecsSinceEpoch(), p.digits, p.period, r))); }
            });
            row->addWidget(cp);
            detailLayout_->addLayout(row);
        }
    } else if (e->type == "note") {
        auto* n = new QLabel(e->notes, detail_);
        n->setWordWrap(true);
        n->setTextInteractionFlags(Qt::TextSelectableByMouse);
        detailLayout_->addWidget(n);
    } else if (e->type == "card") {
        addDetailRow(detailLayout_, "Cardholder", e->cardholder, true);
        addDetailRow(detailLayout_, QString("Number%1").arg(e->cardBrand.isEmpty() ? "" : " · " + e->cardBrand), e->cardNumber, true, true);
        addDetailRow(detailLayout_, "Expiry", e->cardExpiry, true);
        addDetailRow(detailLayout_, "CVV", e->cardCvv, true, true);
    } else if (e->type == "identity") {
        addDetailRow(detailLayout_, "Full name", e->fullName, true);
        addDetailRow(detailLayout_, "Email", e->email, true);
        addDetailRow(detailLayout_, "Phone", e->phone, true);
        addDetailRow(detailLayout_, "Address", e->address, true);
    } else if (e->type == "totp") {
        auto* l = new QLabel("2FA CODE", detail_);
        l->setObjectName("label");
        detailLayout_->addWidget(l);
        totpLabel_ = new QLabel("…", detail_);
        totpLabel_->setObjectName("code");
        totpSecretForDetail_ = e->otpSecret;
        detailLayout_->addWidget(totpLabel_);
    }

    if (!e->notes.isEmpty() && e->type != "note") {
        addDetailRow(detailLayout_, "Notes", e->notes, false);
    }
    if (!e->tags.isEmpty()) {
        auto* tags = new QLabel("#" + e->tags.join("  #"), detail_);
        tags->setObjectName("muted");
        detailLayout_->addWidget(tags);
    }

    // actions
    auto* actions = new QHBoxLayout();
    auto* edit = new QPushButton("Edit", detail_);
    edit->setObjectName("accent");
    connect(edit, &QPushButton::clicked, this, [this, id2] { editEntry(id2); });
    auto* del = new QPushButton("Delete", detail_);
    del->setObjectName("danger");
    connect(del, &QPushButton::clicked, this, [this, id2] { deleteEntry(id2); });
    actions->addWidget(edit, 1);
    actions->addWidget(del);
    detailLayout_->addLayout(actions);
    detailLayout_->addStretch();
}

// ---------------------------------------------------------------------------
// actions
// ---------------------------------------------------------------------------
const vault::Entry* MainWindow::findEntry(const QString& id) const {
    for (const auto& e : data_.entries)
        if (e.id == id) return &e;
    return nullptr;
}

void MainWindow::newEntry(const QString& type) {
    vault::Entry e = vault::newEntry(type);
    EntryDialog d(e, data_.folders, this);
    if (d.exec() == QDialog::Accepted) {
        data_.entries.prepend(d.result());
        persist();
        rebuildList();
    }
}

void MainWindow::editEntry(const QString& id) {
    const vault::Entry* e = findEntry(id);
    if (!e) return;
    EntryDialog d(*e, data_.folders, this);
    if (d.exec() == QDialog::Accepted) {
        vault::Entry updated = d.result();
        for (auto& x : data_.entries)
            if (x.id == id) { x = updated; break; }
        persist();
        rebuildList();
        showDetail(id);
    }
}

void MainWindow::deleteEntry(const QString& id) {
    if (QMessageBox::question(this, "Delete", "Delete this item permanently?") != QMessageBox::Yes) return;
    for (int i = 0; i < data_.entries.size(); ++i)
        if (data_.entries[i].id == id) { data_.entries.remove(i); break; }
    persist();
    rebuildList();
}

void MainWindow::toggleFavorite(const QString& id) {
    for (auto& e : data_.entries)
        if (e.id == id) { e.favorite = !e.favorite; break; }
    persist();
    rebuildList();
    showDetail(id);
}

void MainWindow::openGenerator() {
    QDialog d(this);
    d.setWindowTitle("Password generator");
    d.setMinimumWidth(440);
    auto* v = new QVBoxLayout(&d);
    v->addWidget(new GeneratorWidget(&d, false));
    d.exec();
}

void MainWindow::openAudit() {
    AuditDialog d(vault::audit(data_.entries), this);
    d.exec();
}

void MainWindow::openSettings() {
    SettingsDialog d(data_.settings, this);
    connect(&d, &SettingsDialog::themePreview, this, [this](const QString& m) { applyTheme(m); });
    connect(&d, &SettingsDialog::changeMasterRequested, this, &MainWindow::changeMaster);
    connect(&d, &SettingsDialog::exportRequested, this, &MainWindow::exportBackup);
    connect(&d, &SettingsDialog::wipeRequested, this, &MainWindow::wipeVault);
    if (d.exec() == QDialog::Accepted) {
        data_.settings = d.result();
        kdfPreset_ = data_.settings.kdf;
        persist();
        applyTheme(data_.settings.theme);
    } else {
        applyTheme(data_.settings.theme);
    }
}

void MainWindow::changeMaster() {
    ChangeMasterDialog d(this);
    if (d.exec() != QDialog::Accepted) return;
    if (d.currentPassword() != password_) {
        QMessageBox::warning(this, "Vault", "Current password is incorrect.");
        return;
    }
    password_ = d.newPassword();
    persist();
    QMessageBox::information(this, "Vault", "Master password changed.");
}

void MainWindow::exportBackup() {
    QString dst = QFileDialog::getSaveFileName(this, "Export encrypted backup",
                                               QDateTime::currentDateTime().toString("'vault-backup-'yyyy-MM-dd'.svlt'"),
                                               "Vault backup (*.svlt)");
    if (dst.isEmpty()) return;
    QString err;
    if (vault::exportBackup(path_, dst, err))
        QMessageBox::information(this, "Vault", "Encrypted backup saved.");
    else
        QMessageBox::warning(this, "Vault", err);
}

void MainWindow::wipeVault() {
    if (QMessageBox::warning(this, "Erase vault",
                             "This permanently deletes the encrypted vault on this device. Continue?",
                             QMessageBox::Yes | QMessageBox::No) != QMessageBox::Yes)
        return;
    QFile::remove(path_);
    quitting_ = true;
    qApp->quit();
}

void MainWindow::lock() {
    // drop secrets from memory, then re-authenticate
    password_.fill('*');
    password_.clear();
    keyfile_.fill('*');
    keyfile_.clear();
    data_ = vault::Data{};
    hide();
    if (tray_) tray_->hide();

    AuthDialog auth(path_, nullptr);
    if (auth.exec() != QDialog::Accepted) {
        quitting_ = true;
        qApp->quit();
        return;
    }
    password_ = auth.password();
    keyfile_ = auth.keyfile();
    kdfPreset_ = auth.kdfPreset();
    data_ = auth.data();
    rebuildSidebar();
    rebuildList();
    applyTheme(data_.settings.theme);
    if (tray_) tray_->show();
    showNormal();
    raise();
    activateWindow();
    if (idleTimer_ && data_.settings.autoLockMinutes > 0)
        idleTimer_->start(data_.settings.autoLockMinutes * 60 * 1000);
}

void MainWindow::copyValue(const QString& text) {
    QApplication::clipboard()->setText(text);
    lastClip_ = text;
    if (data_.settings.clipboardClearSeconds > 0)
        clipTimer_->start(data_.settings.clipboardClearSeconds * 1000);
}

void MainWindow::applyTheme(const QString& mode) {
    qApp->setStyleSheet(theme::qss(mode));
}

// ---------------------------------------------------------------------------
// tray + shortcuts + events
// ---------------------------------------------------------------------------
void MainWindow::buildTray() {
    if (!QSystemTrayIcon::isSystemTrayAvailable()) return;
    tray_ = new QSystemTrayIcon(windowIcon(), this);
    tray_->setToolTip("Vault");
    auto* menu = new QMenu(this);
    menu->addAction("Show", this, [this] { showNormal(); raise(); activateWindow(); });
    menu->addAction("Lock now", this, &MainWindow::lock);
    menu->addSeparator();
    menu->addAction("Quit", this, [this] { quitting_ = true; qApp->quit(); });
    tray_->setContextMenu(menu);
    connect(tray_, &QSystemTrayIcon::activated, this, [this](QSystemTrayIcon::ActivationReason r) {
        if (r == QSystemTrayIcon::Trigger) {
            if (isVisible()) hide();
            else { showNormal(); raise(); activateWindow(); }
        }
    });
    tray_->show();
}

void MainWindow::installShortcuts() {
    new QShortcut(QKeySequence("Ctrl+L"), this, [this] { lock(); });
    new QShortcut(QKeySequence("Ctrl+F"), this, [this] { searchEdit_->setFocus(); searchEdit_->selectAll(); });
    new QShortcut(QKeySequence("Ctrl+N"), this, [this] { newEntry("login"); });
    new QShortcut(QKeySequence("Ctrl+G"), this, [this] { openGenerator(); });
    new QShortcut(QKeySequence("Ctrl+Q"), this, [this] { quitting_ = true; qApp->quit(); });
}

void MainWindow::changeEvent(QEvent* e) {
    if (e->type() == QEvent::WindowStateChange && isMinimized()) {
        if (data_.settings.lockOnMinimize) {
            QTimer::singleShot(0, this, &MainWindow::lock);
        } else if (data_.settings.minimizeToTray && tray_) {
            QTimer::singleShot(0, this, [this] { hide(); });
        }
    }
    QMainWindow::changeEvent(e);
}

void MainWindow::closeEvent(QCloseEvent* e) {
    if (!quitting_ && data_.settings.minimizeToTray && tray_ && tray_->isVisible()) {
        e->ignore();
        hide();
        return;
    }
    if (!lastClip_.isEmpty() && QApplication::clipboard()->text() == lastClip_)
        QApplication::clipboard()->clear();
    QMainWindow::closeEvent(e);
}

bool MainWindow::eventFilter(QObject* o, QEvent* e) {
    if (idleTimer_ && (e->type() == QEvent::MouseMove || e->type() == QEvent::KeyPress ||
                       e->type() == QEvent::MouseButtonPress || e->type() == QEvent::Wheel)) {
        if (data_.settings.autoLockMinutes > 0 && isVisible()) idleTimer_->start(data_.settings.autoLockMinutes * 60 * 1000);
    }
    return QMainWindow::eventFilter(o, e);
}

void MainWindow::persist() {
    QString err;
    if (!vault::save(path_, password_, keyfile_, kdfPreset_, data_, err))
        QMessageBox::warning(this, "Vault", "Could not save: " + err);
}
