#pragma once
#include <QWidget>

class QLineEdit;
class QProgressBar;
class QLabel;
class QComboBox;
class QSlider;
class QSpinBox;
class QCheckBox;
class QListWidget;
class QStackedWidget;

// A reusable password / passphrase / PIN / memorable / key generator with a
// live strength read-out and a short history of recent results.
class GeneratorWidget : public QWidget {
    Q_OBJECT
public:
    explicit GeneratorWidget(QWidget* parent = nullptr, bool showUseButton = false);
    QString value() const;

signals:
    void useRequested(const QString& value);

public slots:
    void regenerate();

private:
    void updateStrength();
    QWidget* buildPasswordOpts();
    QWidget* buildPassphraseOpts();
    QWidget* buildPinOpts();
    QWidget* buildMemorableOpts();
    QWidget* buildHexOpts();

    QLineEdit* out_ = nullptr;
    QProgressBar* strength_ = nullptr;
    QLabel* strengthLabel_ = nullptr;
    QComboBox* mode_ = nullptr;
    QStackedWidget* stack_ = nullptr;
    QListWidget* history_ = nullptr;

    // password
    QSlider* length_ = nullptr;
    QLabel* lengthVal_ = nullptr;
    QCheckBox* upper_ = nullptr;
    QCheckBox* lower_ = nullptr;
    QCheckBox* digits_ = nullptr;
    QCheckBox* symbols_ = nullptr;
    QCheckBox* ambiguous_ = nullptr;
    QLineEdit* exclude_ = nullptr;
    QSpinBox* minDigits_ = nullptr;
    QSpinBox* minSymbols_ = nullptr;

    // passphrase
    QSpinBox* words_ = nullptr;
    QComboBox* sep_ = nullptr;
    QCheckBox* cap_ = nullptr;
    QCheckBox* num_ = nullptr;

    // pin
    QSpinBox* pinDigits_ = nullptr;

    // memorable
    QSlider* memLen_ = nullptr;
    QLabel* memLenVal_ = nullptr;
    QCheckBox* memCap_ = nullptr;
    QCheckBox* memNum_ = nullptr;

    // hex
    QSpinBox* hexBytes_ = nullptr;
};
