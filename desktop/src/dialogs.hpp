#pragma once
#include <QDialog>
#include <QHash>
#include <QWidget>

#include "vault.hpp"

class QLineEdit;
class QTextEdit;
class QComboBox;
class QCheckBox;
class QLabel;
class QSpinBox;
class QTimer;
class QDateEdit;
class QVBoxLayout;

// ---------------------------------------------------------------------------
//  CustomFieldsEditor — an add/remove list of user-defined key/value fields,
//  each optionally marked secret. Reused inside EntryDialog.
// ---------------------------------------------------------------------------
class CustomFieldsEditor : public QWidget {
    Q_OBJECT
public:
    explicit CustomFieldsEditor(const QVector<vault::CustomField>& fields, QWidget* parent = nullptr);
    QVector<vault::CustomField> fields() const;

private:
    void addRow(const vault::CustomField& f);
    QVBoxLayout* rows_ = nullptr;
    struct Row { QLineEdit* label; QLineEdit* value; QCheckBox* secret; QWidget* container; };
    QVector<Row> items_;
};

// Add / edit any item type in one adaptive form (schema-driven per type).
class EntryDialog : public QDialog {
    Q_OBJECT
public:
    EntryDialog(const vault::Entry& e, const QVector<vault::Folder>& folders, QWidget* parent = nullptr);
    vault::Entry result() const;

private:
    void refreshTotp();
    QLineEdit* addLine(class QFormLayout* form, const QString& key, const QString& label,
                       const QString& val, bool mono = false);
    QTextEdit* addArea(class QFormLayout* form, const QString& key, const QString& label,
                       const QString& val, int height, bool mono = false);
    void buildPasswordRow(class QFormLayout* form, const QString& label);

    QLineEdit* pwEdit_ = nullptr;
    QLabel* pwStrength_ = nullptr;
    QLabel* totpPreview_ = nullptr;
    QTimer* totpTimer_ = nullptr;
    QHash<QString, QLineEdit*> fields_;
    QHash<QString, QTextEdit*> areas_;
    QComboBox* wifiSec_ = nullptr;
    QComboBox* folder_ = nullptr;
    QLineEdit* tags_ = nullptr;
    QLineEdit* icon_ = nullptr;
    QCheckBox* favorite_ = nullptr;
    QCheckBox* expiryEnable_ = nullptr;
    QDateEdit* expiry_ = nullptr;
    QTextEdit* notes_ = nullptr;
    CustomFieldsEditor* custom_ = nullptr;
    QString totpKey_;  // which field feeds the live code ("totp" | "otpSecret")
    vault::Entry e_;
    QVector<vault::Folder> folders_;
};

// App preferences + master-password / backup / wipe / theme actions.
class SettingsDialog : public QDialog {
    Q_OBJECT
public:
    SettingsDialog(const vault::Settings& s, QWidget* parent = nullptr);
    vault::Settings result() const;

signals:
    void changeMasterRequested();
    void exportRequested();
    void wipeRequested();
    void openFolderRequested();
    void themePreview(const QString& id);
    void pickThemeRequested();

private:
    QSpinBox* autoLock_ = nullptr;
    QSpinBox* clip_ = nullptr;
    QSpinBox* reveal_ = nullptr;
    QSpinBox* ageDays_ = nullptr;
    QCheckBox* conceal_ = nullptr;
    QCheckBox* lockMin_ = nullptr;
    QCheckBox* tray_ = nullptr;
    QCheckBox* quick_ = nullptr;
    QCheckBox* compact_ = nullptr;
    QCheckBox* badges_ = nullptr;
    QCheckBox* confirmDel_ = nullptr;
    QCheckBox* liveEnabled_ = nullptr;
    QCheckBox* liveNotify_ = nullptr;
    QCheckBox* liveAutoSave_ = nullptr;
    QComboBox* theme_ = nullptr;
    QComboBox* kdf_ = nullptr;
    QComboBox* defType_ = nullptr;
    vault::Settings s_;
};

// Read-only security audit report.
class AuditDialog : public QDialog {
    Q_OBJECT
public:
    AuditDialog(const vault::Audit& a, QWidget* parent = nullptr);
};

// Small change-master-password dialog: returns new password + optional keyfile.
class ChangeMasterDialog : public QDialog {
    Q_OBJECT
public:
    explicit ChangeMasterDialog(QWidget* parent = nullptr);
    QString currentPassword() const;
    QString newPassword() const;

private:
    QLineEdit* cur_ = nullptr;
    QLineEdit* nw_ = nullptr;
    QLineEdit* nw2_ = nullptr;
    QLabel* err_ = nullptr;
};
