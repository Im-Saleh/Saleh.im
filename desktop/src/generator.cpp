#include "generator.hpp"

#include <QCheckBox>
#include <QClipboard>
#include <QComboBox>
#include <QGuiApplication>
#include <QHBoxLayout>
#include <QLabel>
#include <QLineEdit>
#include <QListWidget>
#include <QProgressBar>
#include <QPushButton>
#include <QSlider>
#include <QSpinBox>
#include <QStackedWidget>
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
    out_->setMinimumHeight(46);
    auto* regen = new QPushButton("↻", this);
    regen->setToolTip("Regenerate");
    regen->setFixedWidth(46);
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

    // mode selector
    mode_ = new QComboBox(this);
    mode_->addItems({"Password", "Passphrase", "PIN", "Memorable", "Hex key"});
    root->addWidget(mode_);

    // options stack (one page per mode)
    stack_ = new QStackedWidget(this);
    stack_->addWidget(buildPasswordOpts());
    stack_->addWidget(buildPassphraseOpts());
    stack_->addWidget(buildPinOpts());
    stack_->addWidget(buildMemorableOpts());
    stack_->addWidget(buildHexOpts());
    root->addWidget(stack_);

    // recent history
    auto* histLabel = new QLabel("RECENT", this);
    histLabel->setObjectName("label");
    root->addWidget(histLabel);
    history_ = new QListWidget(this);
    history_->setObjectName("mono");
    history_->setFixedHeight(96);
    connect(history_, &QListWidget::itemClicked, this, [this](QListWidgetItem* it) {
        if (it) QGuiApplication::clipboard()->setText(it->text());
    });
    root->addWidget(history_);

    if (showUseButton) {
        auto* use = new QPushButton("Use this value", this);
        use->setObjectName("accent");
        root->addWidget(use);
        connect(use, &QPushButton::clicked, this, [this] { emit useRequested(value()); });
    }

    // wiring
    connect(regen, &QPushButton::clicked, this, &GeneratorWidget::regenerate);
    connect(copy, &QPushButton::clicked, this, [this] { QGuiApplication::clipboard()->setText(value()); });
    connect(mode_, QOverload<int>::of(&QComboBox::currentIndexChanged), this, [this](int i) {
        stack_->setCurrentIndex(i);
        regenerate();
    });

    regenerate();
}

QWidget* GeneratorWidget::buildPasswordOpts() {
    auto* w = new QWidget(this);
    auto* v = new QVBoxLayout(w);
    v->setContentsMargins(0, 0, 0, 0);

    auto* lenRow = new QHBoxLayout();
    lenRow->addWidget(new QLabel("Length", w));
    length_ = new QSlider(Qt::Horizontal, w);
    length_->setRange(6, 96);
    length_->setValue(20);
    lengthVal_ = new QLabel("20", w);
    lengthVal_->setFixedWidth(30);
    lenRow->addWidget(length_, 1);
    lenRow->addWidget(lengthVal_);
    v->addLayout(lenRow);

    upper_ = new QCheckBox("Uppercase (A–Z)", w);
    lower_ = new QCheckBox("Lowercase (a–z)", w);
    digits_ = new QCheckBox("Digits (0–9)", w);
    symbols_ = new QCheckBox("Symbols (!@#$)", w);
    ambiguous_ = new QCheckBox("Avoid ambiguous (l1O0)", w);
    upper_->setChecked(true);
    lower_->setChecked(true);
    digits_->setChecked(true);
    symbols_->setChecked(true);
    v->addWidget(upper_);
    v->addWidget(lower_);
    v->addWidget(digits_);
    v->addWidget(symbols_);
    v->addWidget(ambiguous_);

    auto* minRow = new QHBoxLayout();
    minRow->addWidget(new QLabel("Min digits", w));
    minDigits_ = new QSpinBox(w);
    minDigits_->setRange(0, 12);
    minRow->addWidget(minDigits_);
    minRow->addSpacing(12);
    minRow->addWidget(new QLabel("Min symbols", w));
    minSymbols_ = new QSpinBox(w);
    minSymbols_->setRange(0, 12);
    minRow->addWidget(minSymbols_);
    minRow->addStretch();
    v->addLayout(minRow);

    auto* exRow = new QHBoxLayout();
    exRow->addWidget(new QLabel("Exclude", w));
    exclude_ = new QLineEdit(w);
    exclude_->setPlaceholderText("characters to never use, e.g. {}[]");
    exclude_->setObjectName("mono");
    exRow->addWidget(exclude_, 1);
    v->addLayout(exRow);

    connect(length_, &QSlider::valueChanged, this, [this](int val) {
        lengthVal_->setText(QString::number(val));
        regenerate();
    });
    for (auto* c : {upper_, lower_, digits_, symbols_, ambiguous_})
        connect(c, &QCheckBox::toggled, this, &GeneratorWidget::regenerate);
    connect(minDigits_, QOverload<int>::of(&QSpinBox::valueChanged), this, &GeneratorWidget::regenerate);
    connect(minSymbols_, QOverload<int>::of(&QSpinBox::valueChanged), this, &GeneratorWidget::regenerate);
    connect(exclude_, &QLineEdit::textChanged, this, &GeneratorWidget::regenerate);
    return w;
}

QWidget* GeneratorWidget::buildPassphraseOpts() {
    auto* w = new QWidget(this);
    auto* v = new QVBoxLayout(w);
    v->setContentsMargins(0, 0, 0, 0);
    auto* wRow = new QHBoxLayout();
    wRow->addWidget(new QLabel("Words", w));
    words_ = new QSpinBox(w);
    words_->setRange(3, 12);
    words_->setValue(4);
    wRow->addWidget(words_, 1);
    v->addLayout(wRow);
    auto* sRow = new QHBoxLayout();
    sRow->addWidget(new QLabel("Separator", w));
    sep_ = new QComboBox(w);
    sep_->addItems({"-", ".", "_", " ", "•", "/", "+"});
    sRow->addWidget(sep_, 1);
    v->addLayout(sRow);
    cap_ = new QCheckBox("Capitalize words", w);
    num_ = new QCheckBox("Include a number", w);
    cap_->setChecked(true);
    num_->setChecked(true);
    v->addWidget(cap_);
    v->addWidget(num_);
    connect(words_, QOverload<int>::of(&QSpinBox::valueChanged), this, &GeneratorWidget::regenerate);
    connect(sep_, QOverload<int>::of(&QComboBox::currentIndexChanged), this, &GeneratorWidget::regenerate);
    connect(cap_, &QCheckBox::toggled, this, &GeneratorWidget::regenerate);
    connect(num_, &QCheckBox::toggled, this, &GeneratorWidget::regenerate);
    return w;
}

QWidget* GeneratorWidget::buildPinOpts() {
    auto* w = new QWidget(this);
    auto* v = new QVBoxLayout(w);
    v->setContentsMargins(0, 0, 0, 0);
    auto* row = new QHBoxLayout();
    row->addWidget(new QLabel("Digits", w));
    pinDigits_ = new QSpinBox(w);
    pinDigits_->setRange(3, 16);
    pinDigits_->setValue(6);
    row->addWidget(pinDigits_, 1);
    v->addLayout(row);
    connect(pinDigits_, QOverload<int>::of(&QSpinBox::valueChanged), this, &GeneratorWidget::regenerate);
    return w;
}

QWidget* GeneratorWidget::buildMemorableOpts() {
    auto* w = new QWidget(this);
    auto* v = new QVBoxLayout(w);
    v->setContentsMargins(0, 0, 0, 0);
    auto* row = new QHBoxLayout();
    row->addWidget(new QLabel("Length", w));
    memLen_ = new QSlider(Qt::Horizontal, w);
    memLen_->setRange(6, 40);
    memLen_->setValue(12);
    memLenVal_ = new QLabel("12", w);
    memLenVal_->setFixedWidth(30);
    row->addWidget(memLen_, 1);
    row->addWidget(memLenVal_);
    v->addLayout(row);
    memCap_ = new QCheckBox("Capitalize", w);
    memNum_ = new QCheckBox("Append a number", w);
    memCap_->setChecked(true);
    memNum_->setChecked(true);
    v->addWidget(memCap_);
    v->addWidget(memNum_);
    connect(memLen_, &QSlider::valueChanged, this, [this](int val) {
        memLenVal_->setText(QString::number(val));
        regenerate();
    });
    connect(memCap_, &QCheckBox::toggled, this, &GeneratorWidget::regenerate);
    connect(memNum_, &QCheckBox::toggled, this, &GeneratorWidget::regenerate);
    return w;
}

QWidget* GeneratorWidget::buildHexOpts() {
    auto* w = new QWidget(this);
    auto* v = new QVBoxLayout(w);
    v->setContentsMargins(0, 0, 0, 0);
    auto* row = new QHBoxLayout();
    row->addWidget(new QLabel("Bytes", w));
    hexBytes_ = new QSpinBox(w);
    hexBytes_->setRange(8, 128);
    hexBytes_->setValue(32);
    hexBytes_->setSuffix(" B");
    row->addWidget(hexBytes_, 1);
    v->addLayout(row);
    connect(hexBytes_, QOverload<int>::of(&QSpinBox::valueChanged), this, &GeneratorWidget::regenerate);
    return w;
}

QString GeneratorWidget::value() const { return out_->text(); }

void GeneratorWidget::regenerate() {
    QString result;
    switch (mode_->currentIndex()) {
        case 0: {  // password
            vc::GenOptions o;
            o.length = length_->value();
            o.upper = upper_->isChecked();
            o.lower = lower_->isChecked();
            o.digits = digits_->isChecked();
            o.symbols = symbols_->isChecked();
            o.avoidAmbiguous = ambiguous_->isChecked();
            o.exclude = exclude_->text().toStdString();
            o.minDigits = minDigits_->value();
            o.minSymbols = minSymbols_->value();
            result = QString::fromStdString(vc::generatePassword(o));
            break;
        }
        case 1:  // passphrase
            result = QString::fromStdString(vc::generatePassphrase(
                words_->value(), sep_->currentText().toStdString(), cap_->isChecked(), num_->isChecked()));
            break;
        case 2:  // pin
            result = QString::fromStdString(vc::generatePin(pinDigits_->value()));
            break;
        case 3:  // memorable
            result = QString::fromStdString(
                vc::generatePronounceable(memLen_->value(), memCap_->isChecked(), memNum_->isChecked()));
            break;
        case 4:  // hex
            result = QString::fromStdString(vc::generateHexKey(hexBytes_->value()));
            break;
    }
    out_->setText(result);
    updateStrength();

    if (history_ && !result.isEmpty()) {
        history_->insertItem(0, result);
        while (history_->count() > 8) delete history_->takeItem(history_->count() - 1);
    }
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
