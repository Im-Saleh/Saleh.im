#include "livemonitor.hpp"

#include <QFileInfo>
#include <QFileSystemWatcher>
#include <QTimer>

namespace bimport {

LiveMonitor::LiveMonitor(QObject* parent) : QObject(parent) {
    watcher_ = new QFileSystemWatcher(this);
    connect(watcher_, &QFileSystemWatcher::fileChanged, this, [this](const QString&) {
        // Debounce: browsers can fsync a Login Data file multiple times in a
        // burst while committing a transaction — coalesce into one rescan.
        debounce_->start();
    });

    debounce_ = new QTimer(this);
    debounce_->setSingleShot(true);
    debounce_->setInterval(650);
    connect(debounce_, &QTimer::timeout, this, [this] { refreshWatchList(); });

    rediscoverTimer_ = new QTimer(this);
    rediscoverTimer_->setInterval(30000);  // pick up newly-installed browsers every 30s
    connect(rediscoverTimer_, &QTimer::timeout, this, [this] { refreshWatchList(); });
}

LiveMonitor::~LiveMonitor() = default;

void LiveMonitor::start() {
    if (running_) return;
    running_ = true;
    emit statusChanged("Scanning browsers…");
    refreshWatchList();   // first call baselines every newly-discovered profile
    rediscoverTimer_->start();
    emit statusChanged(watcher_->files().isEmpty()
                           ? "No supported browsers with saved logins were found to watch."
                           : QString("Watching %1 login file(s) in real time.").arg(watcher_->files().size()));
}

void LiveMonitor::stop() {
    if (!running_) return;
    running_ = false;
    rediscoverTimer_->stop();
    debounce_->stop();
    const QStringList files = watcher_->files();
    if (!files.isEmpty()) watcher_->removePaths(files);
    emit statusChanged("Live monitor stopped.");
}

void LiveMonitor::rescanNow() {
    if (!running_) return;
    refreshWatchList();
}

int LiveMonitor::unreviewedCount() const {
    int n = 0;
    for (const auto& e : feed_) if (!e.reviewed) n++;
    return n;
}

void LiveMonitor::markAllReviewed() {
    for (auto& e : feed_) e.reviewed = true;
    emit feedChanged();
}

void LiveMonitor::clearFeed() {
    feed_.clear();
    emit feedChanged();
}

QString LiveMonitor::keyFor(const Credential& c) {
    // origin + username uniquely identifies "this site, this account" for our
    // purposes — a changed *password* on an already-known account is a normal
    // update, not a brand-new login, so it intentionally does not re-fire.
    return c.origin.toLower() + "\x1f" + c.username.toLower() + "\x1f" + methodKey(c.method);
}

void LiveMonitor::refreshWatchList() {
    const QVector<Profile> profiles = detectProfiles();

    // Re-arm the watcher against the current on-disk paths. Chromium/Firefox
    // sometimes replace the file's inode on checkpoint (WAL -> main db merge),
    // which silently drops it from QFileSystemWatcher — so every refresh both
    // adds new paths and re-adds ones QFileSystemWatcher may have lost.
    QStringList wanted;
    for (const auto& p : profiles) {
        wanted << p.loginData;
        for (const char* ext : {"-wal", "-shm"}) {
            const QString sib = p.loginData + ext;
            if (QFileInfo::exists(sib)) wanted << sib;
        }
    }
    const QStringList current = watcher_->files();
    QStringList toAdd;
    for (const QString& w : wanted) if (!current.contains(w)) toAdd << w;
    if (!toAdd.isEmpty()) watcher_->addPaths(toAdd);
    // Re-add everything we're still supposed to be watching in case the OS
    // dropped a path silently after a replace-on-write.
    if (!wanted.isEmpty()) watcher_->addPaths(wanted);

    for (const auto& p : profiles) {
        // A profile is only ever baselined the *first* time we've seen it —
        // on every later pass (whether triggered by a file change or the
        // periodic rediscovery sweep) it gets a real diff scan, so a login
        // that lands during a rediscovery tick is never silently swallowed.
        const bool firstTimeEver = !known_.contains(p.path);
        scanProfile(p, firstTimeEver);
    }
}

void LiveMonitor::scanProfile(const Profile& p, bool baselineOnly) {
    QString note;
    const QVector<Credential> creds = readProfile(p, note);

    QSet<QString>& knownSet = known_[p.path];

    if (baselineOnly) {
        // Silent baseline: remember what's already there, report nothing.
        for (const auto& c : creds) knownSet.insert(keyFor(c));
        return;
    }

    for (const auto& c : creds) {
        const QString key = keyFor(c);
        if (knownSet.contains(key)) continue;
        knownSet.insert(key);

        LiveEvent ev;
        ev.cred = c;
        ev.seenAt = QDateTime::currentMSecsSinceEpoch();
        feed_.prepend(ev);
        if (feed_.size() > kMaxFeed) feed_.resize(kMaxFeed);

        emit newLogin(c);
        emit statusChanged(QString("New sign-in detected: %1 on %2")
                               .arg(c.username.isEmpty() ? methodLabel(c.method) : c.username, c.site));
    }
    if (!creds.isEmpty()) emit feedChanged();
}

}  // namespace bimport
