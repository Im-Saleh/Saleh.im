#include "commandpalette.hpp"

#include <QKeyEvent>
#include <QLineEdit>
#include <QListWidget>
#include <QListWidgetItem>
#include <QVBoxLayout>

#include <algorithm>

#include "effects.hpp"

CommandPalette::CommandPalette(const QVector<Item>& items, QWidget* parent)
    : QDialog(parent), items_(items) {
    setWindowFlags(Qt::Dialog | Qt::FramelessWindowHint);
    setModal(true);
    setMinimumWidth(560);
    setObjectName("card");

    auto* root = new QVBoxLayout(this);
    root->setContentsMargins(14, 14, 14, 14);
    root->setSpacing(10);

    search_ = new QLineEdit(this);
    search_->setPlaceholderText("Type a command or search your vault…");
    search_->setMinimumHeight(46);
    search_->installEventFilter(this);
    root->addWidget(search_);

    list_ = new QListWidget(this);
    list_->setMinimumHeight(360);
    list_->setSpacing(2);
    root->addWidget(list_);

    connect(search_, &QLineEdit::textChanged, this, &CommandPalette::refilter);
    connect(list_, &QListWidget::itemActivated, this, [this] { commit(); });
    connect(list_, &QListWidget::itemClicked, this, [this] { commit(); });

    refilter(QString());
    search_->setFocus();
    fx::popIn(this, 140);
}

// A light subsequence fuzzy match with contiguity + word-boundary bonuses.
int CommandPalette::fuzzyScore(const QString& query, const QString& haystack) {
    if (query.isEmpty()) return 1;
    const QString q = query.toLower();
    const QString h = haystack.toLower();
    int score = 0, hi = 0, streak = 0;
    for (int qi = 0; qi < q.size(); ++qi) {
        QChar qc = q[qi];
        bool found = false;
        while (hi < h.size()) {
            if (h[hi] == qc) {
                found = true;
                score += 2 + streak;                       // reward contiguous runs
                if (hi == 0 || h[hi - 1] == ' ' || h[hi - 1] == '.') score += 4;  // word start
                ++streak;
                ++hi;
                break;
            }
            streak = 0;
            ++hi;
        }
        if (!found) return -1;  // not a subsequence
    }
    score -= (h.size() - q.size()) / 12;  // gentle length penalty
    return score;
}

void CommandPalette::refilter(const QString& query) {
    list_->clear();
    QVector<QPair<int, const Item*>> ranked;
    for (const Item& it : items_) {
        int s = fuzzyScore(query, it.title + " " + it.subtitle);
        if (s >= 0) ranked.append({s, &it});
    }
    std::stable_sort(ranked.begin(), ranked.end(),
                     [](const auto& a, const auto& b) { return a.first > b.first; });

    for (const auto& r : ranked) {
        const Item* it = r.second;
        QString label = QString("%1  %2").arg(it->icon, it->title);
        if (!it->subtitle.isEmpty()) label += "\n" + it->subtitle;
        auto* row = new QListWidgetItem(label, list_);
        row->setData(Qt::UserRole, it->kind);
        row->setData(Qt::UserRole + 1, it->id);
    }
    if (list_->count() > 0) list_->setCurrentRow(0);
}

void CommandPalette::commit() {
    QListWidgetItem* it = list_->currentItem();
    if (!it) return;
    emit chosen(it->data(Qt::UserRole).toString(), it->data(Qt::UserRole + 1).toString());
    accept();
}

bool CommandPalette::eventFilter(QObject* o, QEvent* e) {
    if (o == search_ && e->type() == QEvent::KeyPress) {
        auto* ke = static_cast<QKeyEvent*>(e);
        switch (ke->key()) {
            case Qt::Key_Down:
                list_->setCurrentRow(std::min(list_->currentRow() + 1, list_->count() - 1));
                return true;
            case Qt::Key_Up:
                list_->setCurrentRow(std::max(list_->currentRow() - 1, 0));
                return true;
            case Qt::Key_Return:
            case Qt::Key_Enter:
                commit();
                return true;
            case Qt::Key_Escape:
                reject();
                return true;
            default:
                break;
        }
    }
    return QDialog::eventFilter(o, e);
}
