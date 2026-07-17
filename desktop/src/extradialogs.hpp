// ============================================================================
//  Vault — additional dialogs that make the app feel like a full suite:
//    • ThemePickerDialog     — a visual gallery of every colour palette
//    • PasswordHistoryDialog — browse / copy / restore previous passwords
//    • StatsDialog           — a dashboard of vault statistics & health
//    • AboutDialog           — app / crypto information + keyboard shortcuts
// ============================================================================
#pragma once
#include <QDialog>
#include <QString>

#include "vault.hpp"

// Visual palette gallery. Live-previews on hover/selection and returns the id.
class ThemePickerDialog : public QDialog {
    Q_OBJECT
public:
    explicit ThemePickerDialog(const QString& currentId, QWidget* parent = nullptr);
    QString selected() const { return selected_; }

signals:
    void preview(const QString& id);

private:
    QString selected_;
    QString original_;
};

// Browse the rolling history of previous passwords for one entry.
class PasswordHistoryDialog : public QDialog {
    Q_OBJECT
public:
    PasswordHistoryDialog(const QString& title, const QStringList& history, QWidget* parent = nullptr);
    QString restored() const { return restored_; }

signals:
    void copyRequested(const QString& value);

private:
    QString restored_;
};

// A dashboard: totals, health, coverage and per-type / per-folder breakdowns.
class StatsDialog : public QDialog {
    Q_OBJECT
public:
    explicit StatsDialog(const vault::Data& data, QWidget* parent = nullptr);
};

// About / help.
class AboutDialog : public QDialog {
    Q_OBJECT
public:
    explicit AboutDialog(QWidget* parent = nullptr);
};

// Create / rename / re-icon / delete folders.
class FolderManagerDialog : public QDialog {
    Q_OBJECT
public:
    explicit FolderManagerDialog(const QVector<vault::Folder>& folders, QWidget* parent = nullptr);
    QVector<vault::Folder> folders() const;

private:
    void addRow(const vault::Folder& f);
    class QVBoxLayout* rows_ = nullptr;
    struct Row { class QLineEdit* icon; class QLineEdit* name; QString id; class QWidget* container; };
    QVector<Row> items_;
};
