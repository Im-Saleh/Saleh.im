#include "extradialogs.hpp"

#include <QButtonGroup>
#include <QDateTime>
#include <QDialogButtonBox>
#include <QFrame>
#include <QGridLayout>
#include <QGroupBox>
#include <QHBoxLayout>
#include <QIcon>
#include <QLabel>
#include <QLineEdit>
#include <QListWidget>
#include <QPainter>
#include <QPainterPath>
#include <QPixmap>
#include <QProgressBar>
#include <QPushButton>
#include <QScrollArea>
#include <QVBoxLayout>

#include <algorithm>

#include "crypto.hpp"
#include "theme.hpp"

// ---------------------------------------------------------------------------
//  ThemePickerDialog
// ---------------------------------------------------------------------------
static QIcon swatchIcon(const theme::Palette& p) {
    QPixmap pm(64, 40);
    pm.fill(Qt::transparent);
    QPainter g(&pm);
    g.setRenderHint(QPainter::Antialiasing);
    QPainterPath path;
    path.addRoundedRect(0, 0, 64, 40, 9, 9);
    g.fillPath(path, QColor(p.bg));
    g.setPen(QPen(QColor(p.line2), 1));
    g.drawPath(path);
    // two accent chips + a text bar
    g.setPen(Qt::NoPen);
    g.setBrush(QColor(p.acc));
    g.drawRoundedRect(8, 9, 22, 22, 6, 6);
    g.setBrush(QColor(p.acc2));
    g.drawRoundedRect(34, 9, 14, 22, 5, 5);
    g.setBrush(QColor(p.fg2));
    g.drawRoundedRect(8, 34, 40, 3, 1, 1);
    g.end();
    return QIcon(pm);
}

ThemePickerDialog::ThemePickerDialog(const QString& currentId, QWidget* parent)
    : QDialog(parent), selected_(currentId), original_(currentId) {
    setWindowTitle("Choose a theme");
    setModal(true);
    setMinimumSize(640, 560);

    auto* root = new QVBoxLayout(this);
    auto* head = new QLabel("Pick a palette — the app updates live as you hover.", this);
    head->setObjectName("muted");
    root->addWidget(head);

    auto* scroll = new QScrollArea(this);
    scroll->setWidgetResizable(true);
    scroll->setFrameShape(QFrame::NoFrame);
    auto* inner = new QWidget();
    auto* iv = new QVBoxLayout(inner);

    auto* group = new QButtonGroup(this);
    group->setExclusive(true);

    auto addGroup = [&](const QString& name) -> QGridLayout* {
        auto* box = new QGroupBox(name, inner);
        auto* grid = new QGridLayout(box);
        grid->setSpacing(10);
        iv->addWidget(box);
        return grid;
    };
    QGridLayout* darkGrid = addGroup("DARK");
    QGridLayout* lightGrid = addGroup("LIGHT");
    int dc = 0, lc = 0;

    for (const auto& p : theme::palettes()) {
        auto* btn = new QPushButton(inner);
        btn->setObjectName("swatch");
        btn->setCheckable(true);
        btn->setChecked(p.id == currentId);
        btn->setIcon(swatchIcon(p));
        btn->setIconSize(QSize(64, 40));
        btn->setText("  " + p.name);
        btn->setMinimumHeight(58);
        btn->setStyleSheet(QString("QPushButton{background:%1;color:%2;border:1px solid %3;border-radius:12px;"
                                   "padding:8px 12px;text-align:left;font-weight:600;} "
                                   "QPushButton:checked{border:2px solid %4;} "
                                   "QPushButton:hover{border-color:%4;}")
                               .arg(p.bg2, p.fg, p.line2, p.acc));
        group->addButton(btn);
        QString id = p.id;
        connect(btn, &QPushButton::clicked, this, [this, id] {
            selected_ = id;
            emit preview(id);
        });
        if (p.dark) darkGrid->addWidget(btn, dc / 3, dc % 3), dc++;
        else lightGrid->addWidget(btn, lc / 3, lc % 3), lc++;
    }
    iv->addStretch();
    scroll->setWidget(inner);
    root->addWidget(scroll, 1);

    auto* bb = new QDialogButtonBox(QDialogButtonBox::Ok | QDialogButtonBox::Cancel, this);
    bb->button(QDialogButtonBox::Ok)->setObjectName("accent");
    bb->button(QDialogButtonBox::Ok)->setText("Apply theme");
    connect(bb, &QDialogButtonBox::accepted, this, &QDialog::accept);
    connect(bb, &QDialogButtonBox::rejected, this, [this] {
        emit preview(original_);  // revert live preview
        reject();
    });
    root->addWidget(bb);
}

// ---------------------------------------------------------------------------
//  PasswordHistoryDialog
// ---------------------------------------------------------------------------
PasswordHistoryDialog::PasswordHistoryDialog(const QString& title, const QStringList& history, QWidget* parent)
    : QDialog(parent) {
    setWindowTitle("Password history");
    setModal(true);
    setMinimumSize(460, 420);
    auto* root = new QVBoxLayout(this);

    auto* h = new QLabel(QString("Previous passwords for <b>%1</b>").arg(title.toHtmlEscaped()), this);
    h->setWordWrap(true);
    root->addWidget(h);
    auto* sub = new QLabel("Copy an old value, or restore it as the current password.", this);
    sub->setObjectName("muted");
    root->addWidget(sub);

    auto* scroll = new QScrollArea(this);
    scroll->setWidgetResizable(true);
    scroll->setFrameShape(QFrame::NoFrame);
    auto* inner = new QWidget();
    auto* iv = new QVBoxLayout(inner);

    if (history.isEmpty()) {
        auto* none = new QLabel("No previous passwords recorded yet.", inner);
        none->setObjectName("muted");
        iv->addWidget(none);
    }

    int idx = 1;
    for (const QString& pw : history) {
        auto* card = new QFrame(inner);
        card->setObjectName("card");
        auto* cv = new QVBoxLayout(card);
        cv->setContentsMargins(12, 10, 12, 10);

        auto* topRow = new QHBoxLayout();
        auto* num = new QLabel(QString("#%1").arg(idx++), card);
        num->setObjectName("label");
        vc::Strength s = vc::analyzeStrength(pw.toStdString());
        static const char* col[] = {"#ef4444", "#f97316", "#eab308", "#84cc16", "#22c55e"};
        auto* str = new QLabel(QString("<span style='color:%1'>~%2 bits</span>")
                                   .arg(col[qBound(0, s.score, 4)]).arg(int(s.entropyBits)), card);
        topRow->addWidget(num);
        topRow->addStretch();
        topRow->addWidget(str);
        cv->addLayout(topRow);

        auto* valRow = new QHBoxLayout();
        auto* val = new QLineEdit(pw, card);
        val->setReadOnly(true);
        val->setObjectName("mono");
        val->setEchoMode(QLineEdit::Password);
        auto* eye = new QPushButton("👁", card);
        eye->setObjectName("ghost");
        eye->setCheckable(true);
        eye->setFixedWidth(34);
        connect(eye, &QPushButton::toggled, val, [val](bool on) {
            val->setEchoMode(on ? QLineEdit::Normal : QLineEdit::Password);
        });
        auto* cp = new QPushButton("Copy", card);
        connect(cp, &QPushButton::clicked, this, [this, pw] { emit copyRequested(pw); });
        auto* rs = new QPushButton("Restore", card);
        rs->setObjectName("accent");
        connect(rs, &QPushButton::clicked, this, [this, pw] { restored_ = pw; accept(); });
        valRow->addWidget(val, 1);
        valRow->addWidget(eye);
        valRow->addWidget(cp);
        valRow->addWidget(rs);
        cv->addLayout(valRow);
        iv->addWidget(card);
    }
    iv->addStretch();
    scroll->setWidget(inner);
    root->addWidget(scroll, 1);

    auto* bb = new QDialogButtonBox(QDialogButtonBox::Close, this);
    connect(bb, &QDialogButtonBox::rejected, this, &QDialog::reject);
    root->addWidget(bb);
}

// ---------------------------------------------------------------------------
//  StatsDialog
// ---------------------------------------------------------------------------
static QWidget* statCard(QWidget* parent, const QString& big, const QString& label) {
    auto* card = new QFrame(parent);
    card->setObjectName("card");
    auto* v = new QVBoxLayout(card);
    v->setContentsMargins(16, 14, 16, 14);
    auto* b = new QLabel(big, card);
    b->setObjectName("bigstat");
    auto* l = new QLabel(label.toUpper(), card);
    l->setObjectName("label");
    v->addWidget(b);
    v->addWidget(l);
    return card;
}

StatsDialog::StatsDialog(const vault::Data& data, QWidget* parent) : QDialog(parent) {
    setWindowTitle("Vault dashboard");
    setModal(true);
    setMinimumSize(560, 620);
    vault::Stats st = vault::computeStats(data);
    vault::Audit au = vault::audit(data.entries, data.settings.passwordAgeDays);

    auto* root = new QVBoxLayout(this);
    auto* scroll = new QScrollArea(this);
    scroll->setWidgetResizable(true);
    scroll->setFrameShape(QFrame::NoFrame);
    auto* inner = new QWidget();
    auto* iv = new QVBoxLayout(inner);
    iv->setSpacing(14);

    // hero: health score
    auto* hero = new QFrame(inner);
    hero->setObjectName("hero");
    auto* hv = new QVBoxLayout(hero);
    hv->setContentsMargins(20, 18, 20, 18);
    const QString col = au.score >= 80 ? "#22c55e" : au.score >= 55 ? "#eab308" : "#ef4444";
    auto* score = new QLabel(QString("<span style='font-size:15px;color:#8b929e'>SECURITY HEALTH</span><br>"
                                     "<span style='font-size:52px;font-weight:800;color:%1'>%2</span>"
                                     "<span style='color:#8b929e;font-size:20px'> / 100</span>")
                                 .arg(col).arg(au.score), hero);
    hv->addWidget(score);
    auto* gauge = new QProgressBar(hero);
    gauge->setRange(0, 100);
    gauge->setValue(au.score);
    gauge->setTextVisible(false);
    gauge->setStyleSheet(QString("QProgressBar::chunk{background:%1;border-radius:4px;}").arg(col));
    hv->addWidget(gauge);
    iv->addWidget(hero);

    // top stat cards
    auto* grid = new QGridLayout();
    grid->setSpacing(10);
    grid->addWidget(statCard(inner, QString::number(st.total), "Items"), 0, 0);
    grid->addWidget(statCard(inner, QString::number(st.favorites), "Favorites"), 0, 1);
    grid->addWidget(statCard(inner, QString::number(st.withTotp), "With 2FA"), 0, 2);
    grid->addWidget(statCard(inner, QString::number(au.weak.size()), "Weak"), 1, 0);
    grid->addWidget(statCard(inner, QString::number(au.reused.size()), "Reused"), 1, 1);
    grid->addWidget(statCard(inner, QString::number(st.expiringSoon + st.expired), "Expiring"), 1, 2);
    iv->addLayout(grid);

    // per-type breakdown
    auto* typeBox = new QGroupBox("BY TYPE", inner);
    auto* tv = new QVBoxLayout(typeBox);
    int maxCount = 1;
    for (const auto& kv : st.byType) maxCount = std::max(maxCount, kv.second);
    for (const auto& kv : st.byType) {
        auto* row = new QHBoxLayout();
        auto* name = new QLabel(vault::typeIcon(kv.first) + "  " + vault::typeLabel(kv.first), typeBox);
        name->setMinimumWidth(160);
        auto* bar = new QProgressBar(typeBox);
        bar->setRange(0, maxCount);
        bar->setValue(kv.second);
        bar->setTextVisible(false);
        bar->setFixedHeight(9);
        auto* cnt = new QLabel(QString::number(kv.second), typeBox);
        cnt->setObjectName("mono");
        cnt->setFixedWidth(36);
        cnt->setAlignment(Qt::AlignRight);
        row->addWidget(name);
        row->addWidget(bar, 1);
        row->addWidget(cnt);
        tv->addLayout(row);
    }
    if (st.byType.isEmpty()) tv->addWidget(new QLabel("Your vault is empty.", typeBox));
    iv->addWidget(typeBox);

    // coverage
    auto* covBox = new QGroupBox("COVERAGE", inner);
    auto* cvv = new QVBoxLayout(covBox);
    int creds = au.totalWithPasswords;
    int cov = creds > 0 ? (100 * (creds - au.no2fa.size()) / creds) : 100;
    auto* covLabel = new QLabel(QString("2FA coverage on logins: <b>%1%</b>  ·  avg entropy ~%2 bits")
                                    .arg(cov).arg(int(au.avgEntropy)), covBox);
    covLabel->setWordWrap(true);
    cvv->addWidget(covLabel);
    if (st.newestUpdate > 0) {
        auto* upd = new QLabel("Last change: " +
                                   QDateTime::fromMSecsSinceEpoch(st.newestUpdate).toString("yyyy-MM-dd HH:mm"),
                               covBox);
        upd->setObjectName("muted");
        cvv->addWidget(upd);
    }
    iv->addWidget(covBox);

    iv->addStretch();
    scroll->setWidget(inner);
    root->addWidget(scroll, 1);

    auto* bb = new QDialogButtonBox(QDialogButtonBox::Close, this);
    connect(bb, &QDialogButtonBox::rejected, this, &QDialog::accept);
    connect(bb, &QDialogButtonBox::accepted, this, &QDialog::accept);
    root->addWidget(bb);
}

// ---------------------------------------------------------------------------
//  AboutDialog
// ---------------------------------------------------------------------------
AboutDialog::AboutDialog(QWidget* parent) : QDialog(parent) {
    setWindowTitle("About Vault");
    setModal(true);
    setMinimumWidth(460);
    auto* root = new QVBoxLayout(this);

    auto* logo = new QLabel("🔐", this);
    logo->setStyleSheet("font-size:42px;");
    logo->setAlignment(Qt::AlignCenter);
    root->addWidget(logo);
    auto* title = new QLabel("Vault", this);
    title->setObjectName("h1");
    title->setAlignment(Qt::AlignCenter);
    root->addWidget(title);
    auto* ver = new QLabel("Version 2.0 · native Linux (Qt6 + libsodium)", this);
    ver->setObjectName("muted");
    ver->setAlignment(Qt::AlignCenter);
    root->addWidget(ver);

    auto* info = new QLabel(
        "<p style='line-height:1.6'>A zero-knowledge, offline password &amp; secrets manager. "
        "Everything is encrypted locally with <b>Argon2id</b> key derivation and "
        "<b>XChaCha20-Poly1305</b> authenticated encryption. No account, no cloud, no telemetry.</p>", this);
    info->setWordWrap(true);
    root->addWidget(info);

    auto* keys = new QLabel(
        "<b>Keyboard shortcuts</b><br>"
        "<span style='font-family:monospace'>"
        "Ctrl+K</span>  Command palette<br>"
        "<span style='font-family:monospace'>Ctrl+F</span>  Search<br>"
        "<span style='font-family:monospace'>Ctrl+N</span>  New login<br>"
        "<span style='font-family:monospace'>Ctrl+G</span>  Generator<br>"
        "<span style='font-family:monospace'>Ctrl+L</span>  Lock now<br>"
        "<span style='font-family:monospace'>Ctrl+Shift+A</span>  Quick Capture<br>"
        "<span style='font-family:monospace'>Ctrl+Q</span>  Quit", this);
    keys->setTextFormat(Qt::RichText);
    root->addWidget(keys);

    auto* bb = new QDialogButtonBox(QDialogButtonBox::Close, this);
    connect(bb, &QDialogButtonBox::rejected, this, &QDialog::accept);
    root->addWidget(bb);
}

// ---------------------------------------------------------------------------
//  FolderManagerDialog
// ---------------------------------------------------------------------------
FolderManagerDialog::FolderManagerDialog(const QVector<vault::Folder>& folders, QWidget* parent)
    : QDialog(parent) {
    setWindowTitle("Manage folders");
    setModal(true);
    setMinimumWidth(420);
    auto* root = new QVBoxLayout(this);
    auto* head = new QLabel("Organise your vault into folders. Use a short emoji or symbol as the icon.", this);
    head->setObjectName("muted");
    head->setWordWrap(true);
    root->addWidget(head);

    rows_ = new QVBoxLayout();
    rows_->setSpacing(6);
    root->addLayout(rows_);

    auto* add = new QPushButton("＋ Add folder", this);
    add->setObjectName("chip");
    connect(add, &QPushButton::clicked, this, [this] { addRow({vault::newId(), "", "◆"}); });
    root->addWidget(add, 0, Qt::AlignLeft);
    root->addStretch();

    for (const auto& f : folders) addRow(f);

    auto* bb = new QDialogButtonBox(QDialogButtonBox::Save | QDialogButtonBox::Cancel, this);
    bb->button(QDialogButtonBox::Save)->setObjectName("accent");
    connect(bb, &QDialogButtonBox::accepted, this, &QDialog::accept);
    connect(bb, &QDialogButtonBox::rejected, this, &QDialog::reject);
    root->addWidget(bb);
}

void FolderManagerDialog::addRow(const vault::Folder& f) {
    auto* container = new QWidget(this);
    auto* h = new QHBoxLayout(container);
    h->setContentsMargins(0, 0, 0, 0);
    h->setSpacing(6);
    auto* icon = new QLineEdit(f.icon, container);
    icon->setMaxLength(3);
    icon->setFixedWidth(52);
    icon->setAlignment(Qt::AlignCenter);
    auto* name = new QLineEdit(f.name, container);
    name->setPlaceholderText("Folder name");
    auto* del = new QPushButton("✕", container);
    del->setObjectName("ghost");
    del->setFixedWidth(32);
    h->addWidget(icon);
    h->addWidget(name, 1);
    h->addWidget(del);
    rows_->addWidget(container);

    Row row{icon, name, f.id.isEmpty() ? vault::newId() : f.id, container};
    items_.append(row);
    connect(del, &QPushButton::clicked, this, [this, container] {
        for (int i = 0; i < items_.size(); ++i)
            if (items_[i].container == container) { items_.remove(i); break; }
        container->deleteLater();
    });
}

QVector<vault::Folder> FolderManagerDialog::folders() const {
    QVector<vault::Folder> out;
    for (const auto& r : items_) {
        if (r.name->text().trimmed().isEmpty()) continue;
        out.append({r.id, r.name->text().trimmed(), r.icon->text().trimmed().isEmpty() ? "◆" : r.icon->text().trimmed()});
    }
    return out;
}
