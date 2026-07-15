#include "authdialog.hpp"

#include <QApplication>
#include <QCheckBox>
#include <QComboBox>
#include <QFile>
#include <QFileDialog>
#include <QFileInfo>
#include <QHBoxLayout>
#include <QLabel>
#include <QLineEdit>
#include <QProgressBar>
#include <QPushButton>
#include <QVBoxLayout>

#include "crypto.hpp"

AuthDialog::AuthDialog(const QString& vaultPath, QWidget* parent)
    : QDialog(parent), path_(vaultPath) {
    create_ = !vault::vaultExists(path_);
    needKeyfile_ = !create_ && vault::metaKeyfileRequired(path_);

    setWindowTitle(create_ ? "Create your vault" : "Unlock Vault");
    setModal(true);
    setMinimumWidth(440);

    auto* root = new QVBoxLayout(this);
    root->setContentsMargins(28, 28, 28, 24);
    root->setSpacing(14);

    auto* logo = new QLabel("🔐", this);
    logo->setStyleSheet("font-size:40px;");
    logo->setAlignment(Qt::AlignCenter);
    root->addWidget(logo);

    auto* title = new QLabel(create_ ? "Create your vault" : "Unlock Vault", this);
    title->setObjectName("h1");
    title->setAlignment(Qt::AlignCenter);
    root->addWidget(title);

    auto* sub = new QLabel(
        create_ ? "Your master password is the only key — it never leaves this device and "
                  "cannot be recovered. Choose something strong."
                : "Enter your master password to decrypt this vault locally.",
        this);
    sub->setObjectName("muted");
    sub->setWordWrap(true);
    sub->setAlignment(Qt::AlignCenter);
    root->addWidget(sub);

    // master password + reveal
    pw_ = new QLineEdit(this);
    pw_->setEchoMode(QLineEdit::Password);
    pw_->setPlaceholderText("Master password");
    pw_->setMinimumHeight(44);
    auto* reveal = new QPushButton("👁", this);
    reveal->setObjectName("ghost");
    reveal->setCheckable(true);
    reveal->setFixedWidth(40);
    connect(reveal, &QPushButton::toggled, this, [this](bool on) {
        pw_->setEchoMode(on ? QLineEdit::Normal : QLineEdit::Password);
    });
    auto* pwRow = new QHBoxLayout();
    pwRow->addWidget(pw_, 1);
    pwRow->addWidget(reveal);
    root->addLayout(pwRow);

    if (create_) {
        strength_ = new QProgressBar(this);
        strength_->setRange(0, 100);
        strength_->setTextVisible(false);
        strengthLabel_ = new QLabel(this);
        strengthLabel_->setObjectName("muted");
        auto* sr = new QHBoxLayout();
        sr->addWidget(strength_, 1);
        sr->addWidget(strengthLabel_);
        root->addLayout(sr);
        connect(pw_, &QLineEdit::textChanged, this, [this](const QString& t) {
            vc::Strength s = vc::analyzeStrength(t.toStdString());
            static const char* col[] = {"#ef4444", "#f97316", "#eab308", "#84cc16", "#22c55e"};
            strength_->setValue(t.isEmpty() ? 0 : 20 + s.score * 20);
            strength_->setStyleSheet(QString("QProgressBar::chunk{background:%1;border-radius:4px;}").arg(col[qBound(0, s.score, 4)]));
            strengthLabel_->setText(t.isEmpty() ? "" : QString::fromStdString(s.crackTime));
        });

        pw2_ = new QLineEdit(this);
        pw2_->setEchoMode(QLineEdit::Password);
        pw2_->setPlaceholderText("Confirm master password");
        pw2_->setMinimumHeight(44);
        root->addWidget(pw2_);

        auto* kdfRow = new QHBoxLayout();
        kdfRow->addWidget(new QLabel("Key strength", this));
        kdfCombo_ = new QComboBox(this);
        kdfCombo_->addItem("Fast (Argon2id, 64 MB)", "interactive");
        kdfCombo_->addItem("Recommended (256 MB)", "moderate");
        kdfCombo_->addItem("Paranoid (1 GB)", "sensitive");
        kdfCombo_->setCurrentIndex(1);
        kdfRow->addWidget(kdfCombo_, 1);
        root->addLayout(kdfRow);
    }

    // keyfile
    keyfileLabel_ = new QLabel(this);
    keyfileLabel_->setObjectName("muted");
    auto* kfBtn = new QPushButton(create_ ? "Add keyfile (optional 2nd factor)" : "Choose keyfile", this);
    connect(kfBtn, &QPushButton::clicked, this, &AuthDialog::chooseKeyfile);
    if (create_ || needKeyfile_) {
        root->addWidget(kfBtn);
        root->addWidget(keyfileLabel_);
        if (needKeyfile_) keyfileLabel_->setText("This vault requires its keyfile.");
    }

    error_ = new QLabel(this);
    error_->setStyleSheet("color:#ff6b6b;");
    error_->setWordWrap(true);
    root->addWidget(error_);

    submitBtn_ = new QPushButton(create_ ? "Create vault" : "Unlock", this);
    submitBtn_->setObjectName("accent");
    submitBtn_->setMinimumHeight(46);
    submitBtn_->setDefault(true);
    root->addWidget(submitBtn_);

    auto* note = new QLabel("Encrypted locally with Argon2id + XChaCha20-Poly1305 · nothing is uploaded.", this);
    note->setObjectName("muted");
    note->setAlignment(Qt::AlignCenter);
    note->setWordWrap(true);
    root->addWidget(note);

    connect(submitBtn_, &QPushButton::clicked, this, &AuthDialog::submit);
    connect(pw_, &QLineEdit::returnPressed, this, &AuthDialog::submit);
    if (pw2_) connect(pw2_, &QLineEdit::returnPressed, this, &AuthDialog::submit);
    pw_->setFocus();
}

void AuthDialog::chooseKeyfile() {
    QString path = QFileDialog::getOpenFileName(this, "Select keyfile");
    if (path.isEmpty()) return;
    QFile f(path);
    if (!f.open(QIODevice::ReadOnly)) {
        error_->setText("Could not read that file.");
        return;
    }
    keyfile_ = f.readAll();
    QFileInfo fi(path);
    keyfileLabel_->setText("Keyfile: " + fi.fileName());
    error_->clear();
}

void AuthDialog::submit() {
    error_->clear();
    const QString pw = pw_->text();
    if (create_) {
        if (pw != pw2_->text()) {
            error_->setText("Passwords don't match.");
            return;
        }
        if (vc::analyzeStrength(pw.toStdString()).score < 2) {
            error_->setText("Please choose a stronger master password.");
            return;
        }
        kdfPreset_ = kdfCombo_->currentData().toString();
    } else if (needKeyfile_ && keyfile_.isEmpty()) {
        error_->setText("Please attach the keyfile.");
        return;
    }

    submitBtn_->setEnabled(false);
    submitBtn_->setText(create_ ? "Encrypting…" : "Unlocking…");
    QApplication::processEvents();

    QString err;
    bool ok = create_
                  ? vault::createVault(path_, pw, keyfile_, kdfPreset_, data_, err)
                  : vault::unlock(path_, pw, keyfile_, data_, err);
    if (!ok) {
        error_->setText(err);
        submitBtn_->setEnabled(true);
        submitBtn_->setText(create_ ? "Create vault" : "Unlock");
        return;
    }
    password_ = pw;
    if (!create_) kdfPreset_ = data_.settings.kdf;
    accept();
}
