#include "generator.hpp"

#include <QCheckBox>
#include <QClipboard>
#include <QComboBox>
#include <QGuiApplication>
#include <QHBoxLayout>
#include <QLabel>
#include <QLineEdit>
#include <QProgressBar>
#include <QPushButton>
#include <QSlider>
#include <QSpinBox>
#include <QVBoxLayout>

#include "crypto.hpp"

GeneratorWidget::GeneratorWidget(QWidget* parent, bool showUseButton) : QWidget(parent) {
    auto* root = new QVBoxLayout(this);
    root->setContentsMargins(0, 0, 0, 0);
    root->setSpacing(12);

    // output row
    out_ = new QLineEdit(this);
    out_->setReadOnly(true);
    out_->setObjectName("mono");
    out_->setMinimumHeight(44);
    auto* regen = new QPushButton("↻", this);
    regen->setToolTip("Regenerate");
    regen->setFixedWidth(44);
    auto* copy = new QPushButton("Copy", this);
    auto* outRow = new QHBoxLayout();
    outRow->addWidget(out_, 1);
    outRow->addWidget(regen);
    outRow->addWidget(copy);
    root->addLayout(outRow);

    // strength
    strength_ = new QProgressBar(this);
    strength_->setRange(0, 100);
    strength_->setTextVisible(false);
    strengthLabel_ = new QLabel(this);
    strengthLabel_->setObjectName("muted");
    auto* strRow = new QHBoxLayout();
    strRow->addWidget(strength_, 1);
    strRow->addWidget(strengthLabel_);
    root->addLayout(strRow);

    // mode
    mode_ = new QComboBox(this);
    mode_->addItems({"Password", "Passphrase"});
    root->addWidget(mode_);

    // password options
    pwOpts_ = new QWidget(this);
    {
        auto* v = new QVBoxLayout(pwOpts_);
        v->setContentsMargins(0, 0, 0, 0);
        auto* lenRow = new QHBoxLayout();
        auto* lenL = new QLabel("Length", pwOpts_);
        length_ = new QSlider(Qt::Horizontal, pwOpts_);
        length_->setRange(8, 64);
        length_->setValue(20);
        lengthVal_ = new QLabel("20", pwOpts_);
        lengthVal_->setFixedWidth(28);
        lenRow->addWidget(lenL);
        lenRow->addWidget(length_, 1);
        lenRow->addWidget(lengthVal_);
        v->addLayout(lenRow);
        upper_ = new QCheckBox("Uppercase (A–Z)", pwOpts_);
        lower_ = new QCheckBox("Lowercase (a–z)", pwOpts_);
        digits_ = new QCheckBox("Digits (0–9)", pwOpts_);
        symbols_ = new QCheckBox("Symbols (!@#$)", pwOpts_);
        ambiguous_ = new QCheckBox("Avoid ambiguous (l1O0)", pwOpts_);
        upper_->setChecked(true);
        lower_->setChecked(true);
        digits_->setChecked(true);
        symbols_->setChecked(true);
        v->addWidget(upper_);
        v->addWidget(lower_);
        v->addWidget(digits_);
        v->addWidget(symbols_);
        v->addWidget(ambiguous_);
    }
    root->addWidget(pwOpts_);

    // passphrase options
    ppOpts_ = new QWidget(this);
    {
        auto* v = new QVBoxLayout(ppOpts_);
        v->setContentsMargins(0, 0, 0, 0);
        auto* wRow = new QHBoxLayout();
        wRow->addWidget(new QLabel("Words", ppOpts_));
        words_ = new QSpinBox(ppOpts_);
        words_->setRange(3, 10);
        words_->setValue(4);
        wRow->addWidget(words_, 1);
        v->addLayout(wRow);
        auto* sRow = new QHBoxLayout();
        sRow->addWidget(new QLabel("Separator", ppOpts_));
        sep_ = new QComboBox(ppOpts_);
        sep_->addItems({"-", ".", "_", " ", "•"});
        sRow->addWidget(sep_, 1);
        v->addLayout(sRow);
        cap_ = new QCheckBox("Capitalize words", ppOpts_);
        num_ = new QCheckBox("Include a number", ppOpts_);
        cap_->setChecked(true);
        num_->setChecked(true);
        v->addWidget(cap_);
        v->addWidget(num_);
    }
    ppOpts_->setVisible(false);
    root->addWidget(ppOpts_);

    if (showUseButton) {
        auto* use = new QPushButton("Use this password", this);
        use->setObjectName("accent");
        root->addWidget(use);
        connect(use, &QPushButton::clicked, this, [this] { emit useRequested(value()); });
    }

    // wiring
    connect(regen, &QPushButton::clicked, this, &GeneratorWidget::regenerate);
    connect(copy, &QPushButton::clicked, this, [this] {
        QGuiApplication::clipboard()->setText(value());
    });
    connect(mode_, QOverload<int>::of(&QComboBox::currentIndexChanged), this, [this](int i) {
        pwOpts_->setVisible(i == 0);
        ppOpts_->setVisible(i == 1);
        regenerate();
    });
    connect(length_, &QSlider::valueChanged, this, [this](int v) {
        lengthVal_->setText(QString::number(v));
        regenerate();
    });
    for (auto* c : {upper_, lower_, digits_, symbols_, ambiguous_, cap_, num_})
        connect(c, &QCheckBox::toggled, this, &GeneratorWidget::regenerate);
    connect(words_, QOverload<int>::of(&QSpinBox::valueChanged), this, &GeneratorWidget::regenerate);
    connect(sep_, QOverload<int>::of(&QComboBox::currentIndexChanged), this, &GeneratorWidget::regenerate);

    regenerate();
}

QString GeneratorWidget::value() const { return out_->text(); }

void GeneratorWidget::regenerate() {
    if (mode_->currentIndex() == 0) {
        vc::GenOptions o;
        o.length = length_->value();
        o.upper = upper_->isChecked();
        o.lower = lower_->isChecked();
        o.digits = digits_->isChecked();
        o.symbols = symbols_->isChecked();
        o.avoidAmbiguous = ambiguous_->isChecked();
        out_->setText(QString::fromStdString(vc::generatePassword(o)));
    } else {
        out_->setText(QString::fromStdString(
            vc::generatePassphrase(words_->value(), sep_->currentText().toStdString(),
                                   cap_->isChecked(), num_->isChecked())));
    }
    updateStrength();
}

void GeneratorWidget::updateStrength() {
    vc::Strength s = vc::analyzeStrength(out_->text().toStdString());
    static const char* colors[] = {"#ef4444", "#f97316", "#eab308", "#84cc16", "#22c55e"};
    int idx = qBound(0, s.score, 4);
    strength_->setValue(20 + s.score * 20);
    strength_->setStyleSheet(QString("QProgressBar::chunk{background:%1;border-radius:4px;}").arg(colors[idx]));
    strengthLabel_->setText(QString("~%1 bits · %2")
                                .arg(static_cast<int>(s.entropyBits))
                                .arg(QString::fromStdString(s.crackTime)));
}
