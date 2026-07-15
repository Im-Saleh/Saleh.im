// ============================================================================
//  Vault — application theme (Qt stylesheet). Dark + light, brand accent.
// ============================================================================
#pragma once

#include <QString>

namespace theme {

inline QString accent(const QString& mode) { return mode == "light" ? "#0f9b6c" : "#c8ff4d"; }

inline QString qss(const QString& mode) {
    const bool light = (mode == "light");
    const QString bg     = light ? "#f4f1ea" : "#0e0f12";
    const QString bg2    = light ? "#ffffff" : "#16181d";
    const QString bg3c   = light ? "#ece7dd" : "#1e2128";  // panel-inset
    const QString line   = light ? "#e0dacd" : "#262a31";
    const QString line2  = light ? "#cfc7b6" : "#333944";
    const QString fg     = light ? "#1a1712" : "#e7e9ee";
    const QString fg2    = light ? "#6b6456" : "#8b929e";
    const QString acc    = accent(mode);
    const QString onAcc  = light ? "#ffffff" : "#0e0f12";

    return QString(R"QSS(
* { outline: none; }
QWidget { background: %BG%; color: %FG%; font-size: 14px;
  font-family: "Inter","Ubuntu","Noto Sans","Segoe UI",sans-serif; }

QToolTip { background: %BG2%; color: %FG%; border: 1px solid %LINE2%; padding: 4px 8px; border-radius: 6px; }

/* panels / frames */
#panel, QFrame#panel { background: %BG2%; border: 1px solid %LINE%; border-radius: 14px; }
#sidebar { background: %BG2%; border-right: 1px solid %LINE%; }
#detail { background: %BG2%; border-left: 1px solid %LINE%; }
#hairline { background: %LINE%; max-height: 1px; min-height: 1px; }

QLabel#h1 { font-size: 26px; font-weight: 700; }
QLabel#h2 { font-size: 18px; font-weight: 600; }
QLabel#muted { color: %FG2%; }
QLabel#label { color: %FG2%; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; }
QLabel#mono { font-family: "JetBrains Mono","DejaVu Sans Mono",monospace; }
QLabel#code { font-family: "JetBrains Mono","DejaVu Sans Mono",monospace; font-size: 20px; color: %ACC%; }

/* inputs */
QLineEdit, QTextEdit, QPlainTextEdit, QComboBox, QSpinBox {
  background: %BG3%; color: %FG%; border: 1px solid %LINE2%;
  border-radius: 10px; padding: 8px 12px; selection-background-color: %ACC%; selection-color: %ONACC%; }
QLineEdit:focus, QTextEdit:focus, QComboBox:focus, QSpinBox:focus { border: 1px solid %ACC%; }
QComboBox::drop-down { border: none; width: 24px; }
QComboBox QAbstractItemView { background: %BG2%; border: 1px solid %LINE2%; selection-background-color: %ACC%; selection-color: %ONACC%; border-radius: 8px; }

/* buttons */
QPushButton { background: %BG3%; color: %FG%; border: 1px solid %LINE2%; border-radius: 10px; padding: 8px 14px; }
QPushButton:hover { border-color: %ACC%; }
QPushButton:pressed { background: %LINE%; }
QPushButton#accent { background: %ACC%; color: %ONACC%; border: none; font-weight: 600; }
QPushButton#accent:hover { background: %ACC%; }
QPushButton#ghost { background: transparent; border: none; color: %FG2%; padding: 6px; }
QPushButton#ghost:hover { color: %ACC%; }
QPushButton#danger { color: #ff6b6b; border-color: rgba(255,107,107,0.4); }
QPushButton#nav { background: transparent; border: none; text-align: left; padding: 9px 12px; border-radius: 10px; color: %FG2%; }
QPushButton#nav:hover { background: %BG3%; color: %FG%; }
QPushButton#nav:checked { background: %BG3%; color: %ACC%; font-weight: 600; }

/* lists */
QListWidget { background: transparent; border: none; }
QListWidget::item { background: %BG3%; border: 1px solid %LINE%; border-radius: 12px; padding: 10px; margin: 3px 2px; }
QListWidget::item:hover { border-color: %LINE2%; }
QListWidget::item:selected { border-color: %ACC%; color: %FG%; }

/* scrollbars */
QScrollBar:vertical { background: transparent; width: 10px; margin: 2px; }
QScrollBar::handle:vertical { background: %LINE2%; border-radius: 5px; min-height: 30px; }
QScrollBar::handle:vertical:hover { background: %FG2%; }
QScrollBar::add-line, QScrollBar::sub-line { height: 0; }
QScrollBar:horizontal { height: 0; }

/* misc */
QCheckBox::indicator { width: 18px; height: 18px; border-radius: 5px; border: 1px solid %LINE2%; background: %BG3%; }
QCheckBox::indicator:checked { background: %ACC%; border-color: %ACC%; }
QProgressBar { background: %BG3%; border: none; border-radius: 4px; height: 6px; }
QProgressBar::chunk { border-radius: 4px; }
QSlider::groove:horizontal { height: 6px; background: %BG3%; border-radius: 3px; }
QSlider::handle:horizontal { width: 16px; height: 16px; margin: -6px 0; border-radius: 8px; background: %ACC%; }
QMenu { background: %BG2%; border: 1px solid %LINE2%; border-radius: 8px; padding: 4px; }
QMenu::item { padding: 6px 20px; border-radius: 6px; }
QMenu::item:selected { background: %BG3%; color: %ACC%; }
QTabWidget::pane { border: none; }
QTabBar::tab { background: transparent; color: %FG2%; padding: 8px 14px; border: none; }
QTabBar::tab:selected { color: %ACC%; border-bottom: 2px solid %ACC%; }
)QSS")
        .replace("%BG%", bg)
        .replace("%BG2%", bg2)
        .replace("%BG3%", bg3c)
        .replace("%LINE2%", line2)
        .replace("%LINE%", line)
        .replace("%FG2%", fg2)
        .replace("%FG%", fg)
        .replace("%ACC%", acc)
        .replace("%ONACC%", onAcc);
}

}  // namespace theme
