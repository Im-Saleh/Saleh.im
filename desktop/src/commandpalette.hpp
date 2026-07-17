// ============================================================================
//  Vault — command palette (Ctrl+K): a fast, keyboard-first overlay that
//  fuzzy-searches both actions (new item, lock, generator, settings…) and
//  every entry in the vault, then jumps straight to it.
// ============================================================================
#pragma once
#include <QDialog>
#include <QString>
#include <QVector>

class QLineEdit;
class QListWidget;

class CommandPalette : public QDialog {
    Q_OBJECT
public:
    struct Item {
        QString kind;      // "action" | "entry"
        QString id;        // action id or entry id
        QString title;
        QString subtitle;
        QString icon;      // emoji glyph
    };

    CommandPalette(const QVector<Item>& items, QWidget* parent = nullptr);

signals:
    void chosen(const QString& kind, const QString& id);

protected:
    bool eventFilter(QObject* o, QEvent* e) override;

private:
    void refilter(const QString& query);
    void commit();
    static int fuzzyScore(const QString& query, const QString& haystack);

    QVector<Item> items_;
    QLineEdit* search_ = nullptr;
    QListWidget* list_ = nullptr;
};
