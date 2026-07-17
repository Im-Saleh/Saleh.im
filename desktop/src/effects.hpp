// ============================================================================
//  Vault — lightweight visual effects: soft shadows, fades, slides, glows.
//
//  Qt Style Sheets can't do transitions, so tasteful motion is provided here
//  through QPropertyAnimation + QGraphicsEffect. Everything is opt-in and
//  cleans itself up so it never leaves a lingering effect on a widget.
// ============================================================================
#pragma once
#include <QColor>
#include <QEasingCurve>
#include <QGraphicsDropShadowEffect>
#include <QGraphicsOpacityEffect>
#include <QParallelAnimationGroup>
#include <QPropertyAnimation>
#include <QTimer>
#include <QWidget>

namespace fx {

// A soft, elevated drop shadow.
inline void shadow(QWidget* w, int blur = 42, int dy = 14, int alpha = 90) {
    if (!w) return;
    auto* e = new QGraphicsDropShadowEffect(w);
    e->setBlurRadius(blur);
    e->setOffset(0, dy);
    e->setColor(QColor(0, 0, 0, alpha));
    w->setGraphicsEffect(e);
}

// A coloured, elevated glow shadow (used to make accent surfaces pop).
inline void glow(QWidget* w, const QColor& c, int blur = 34, int alpha = 130) {
    if (!w) return;
    auto* e = new QGraphicsDropShadowEffect(w);
    e->setBlurRadius(blur);
    e->setOffset(0, 6);
    QColor g = c;
    g.setAlpha(alpha);
    e->setColor(g);
    w->setGraphicsEffect(e);
}

// Fade a widget in (used for windows and panes).
inline void fadeIn(QWidget* w, int ms = 220) {
    if (!w) return;
    auto* e = new QGraphicsOpacityEffect(w);
    w->setGraphicsEffect(e);
    auto* a = new QPropertyAnimation(e, "opacity", w);
    a->setDuration(ms);
    a->setStartValue(0.0);
    a->setEndValue(1.0);
    a->setEasingCurve(QEasingCurve::OutCubic);
    QObject::connect(a, &QPropertyAnimation::finished, w, [w] { w->setGraphicsEffect(nullptr); });
    a->start(QAbstractAnimation::DeleteWhenStopped);
}

// Fade in with an optional start delay (for lightweight staggering).
inline void fadeInDelayed(QWidget* w, int ms, int delayMs) {
    if (!w) return;
    auto* e = new QGraphicsOpacityEffect(w);
    e->setOpacity(0.0);
    w->setGraphicsEffect(e);
    auto* a = new QPropertyAnimation(e, "opacity", w);
    a->setStartValue(0.0);
    a->setEndValue(1.0);
    a->setDuration(ms);
    a->setEasingCurve(QEasingCurve::OutCubic);
    QObject::connect(a, &QPropertyAnimation::finished, w, [w] { w->setGraphicsEffect(nullptr); });
    QTimer::singleShot(delayMs, w, [a] { a->start(QAbstractAnimation::DeleteWhenStopped); });
}

// Fade a top-level window (dialog) in on open via its window opacity.
inline void popIn(QWidget* w, int ms = 170) {
    if (!w) return;
    w->setWindowOpacity(0.0);
    auto* a = new QPropertyAnimation(w, "windowOpacity", w);
    a->setDuration(ms);
    a->setStartValue(0.0);
    a->setEndValue(1.0);
    a->setEasingCurve(QEasingCurve::OutCubic);
    a->start(QAbstractAnimation::DeleteWhenStopped);
}

// A perpetual, gentle "breathing" glow — great for a primary call-to-action.
// The animation parents itself to the effect, so it lives as long as the widget.
inline void pulseGlow(QWidget* w, const QColor& c, int minBlur = 12, int maxBlur = 34, int ms = 2200) {
    if (!w) return;
    auto* e = new QGraphicsDropShadowEffect(w);
    e->setOffset(0, 0);
    QColor g = c;
    g.setAlpha(150);
    e->setColor(g);
    e->setBlurRadius(minBlur);
    w->setGraphicsEffect(e);
    auto* a = new QPropertyAnimation(e, "blurRadius", e);
    a->setStartValue(minBlur);
    a->setKeyValueAt(0.5, maxBlur);
    a->setEndValue(minBlur);
    a->setDuration(ms);
    a->setLoopCount(-1);
    a->setEasingCurve(QEasingCurve::InOutSine);
    a->start(QAbstractAnimation::DeleteWhenStopped);
}

}  // namespace fx
