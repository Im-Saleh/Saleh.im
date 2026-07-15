#pragma once
#include <QByteArray>
#include <QDialog>

#include "vault.hpp"

class QLineEdit;
class QLabel;
class QProgressBar;
class QComboBox;
class QPushButton;

// Create-or-unlock dialog. In "create" mode it makes a new encrypted vault; in
// "unlock" mode it decrypts an existing one (asking for a keyfile if required).
class AuthDialog : public QDialog {
    Q_OBJECT
public:
    explicit AuthDialog(const QString& vaultPath, QWidget* parent = nullptr);

    QString password() const { return password_; }
    QByteArray keyfile() const { return keyfile_; }
    QString kdfPreset() const { return kdfPreset_; }
    vault::Data data() const { return data_; }

private:
    void submit();
    void chooseKeyfile();

    QString path_;
    bool create_ = false;
    bool needKeyfile_ = false;

    QLineEdit* pw_ = nullptr;
    QLineEdit* pw2_ = nullptr;
    QProgressBar* strength_ = nullptr;
    QLabel* strengthLabel_ = nullptr;
    QLabel* error_ = nullptr;
    QLabel* keyfileLabel_ = nullptr;
    QComboBox* kdfCombo_ = nullptr;
    QPushButton* submitBtn_ = nullptr;

    QString password_;
    QByteArray keyfile_;
    QString kdfPreset_ = "moderate";
    vault::Data data_;
};
