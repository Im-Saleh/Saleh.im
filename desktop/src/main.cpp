// ============================================================================
//  Vault — native Linux password manager (Qt6 + libsodium). Entry point.
// ============================================================================
#include <QApplication>
#include <QDir>
#include <QFileInfo>
#include <QIcon>
#include <QMessageBox>

#include "authdialog.hpp"
#include "crypto.hpp"
#include "mainwindow.hpp"
#include "theme.hpp"
#include "vault.hpp"

static QIcon loadAppIcon() {
    const QStringList candidates = {
        "/usr/share/icons/hicolor/512x512/apps/saleh-vault.png",
        QCoreApplication::applicationDirPath() + "/../share/icons/hicolor/512x512/apps/saleh-vault.png",
        QCoreApplication::applicationDirPath() + "/resources/icon.png",
        QFileInfo(__FILE__).absolutePath() + "/../resources/icon.png",
    };
    for (const QString& p : candidates)
        if (QFileInfo::exists(p)) return QIcon(p);
    QIcon themed = QIcon::fromTheme("saleh-vault");
    return themed.isNull() ? QIcon() : themed;
}

int main(int argc, char** argv) {
    QApplication app(argc, argv);
    QApplication::setApplicationName("Vault");
    QApplication::setOrganizationName("Saleh");
    QApplication::setApplicationDisplayName("Vault");
    QApplication::setQuitOnLastWindowClosed(false);  // we manage the lifecycle (tray + lock)

    if (!vc::init()) {
        QMessageBox::critical(nullptr, "Vault", "Could not initialise libsodium.");
        return 2;
    }

    QIcon icon = loadAppIcon();
    if (!icon.isNull()) app.setWindowIcon(icon);
    app.setStyleSheet(theme::qss("dark"));

    const QString path = vault::defaultVaultPath();

    AuthDialog auth(path);
    if (!icon.isNull()) auth.setWindowIcon(icon);
    if (auth.exec() != QDialog::Accepted) return 0;

    auto* w = new MainWindow(path, auth.password(), auth.keyfile(), auth.kdfPreset(), auth.data());
    if (!icon.isNull()) w->setWindowIcon(icon);
    w->show();

    const int rc = app.exec();
    delete w;
    return rc;
}
