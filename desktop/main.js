/* ============================================================================
   Vault — Electron main process (Linux desktop app).

   A deliberately hardened, feature-rich native shell around the Vault web app
   so it installs and runs like a first-class application on Ubuntu / Kubuntu
   (and any Debian-based distro). The renderer runs fully sandboxed with no Node
   access; all cryptography still happens client-side — this wrapper never sees
   your secrets. On top of that it adds native super-powers the browser can't:

     • System tray with quick Show / Lock / Quit.
     • Global hotkeys — Ctrl+Shift+L locks instantly, Ctrl+Shift+V toggles.
     • A real application menu with accelerators (lock, find, zoom, quit…).
     • Auto-lock on system suspend / screen-lock, on idle, and on blur timeout.
     • Clipboard is wiped on lock and on quit (defeats clipboard snooping).
     • Screenshot / screen-recording protection (setContentProtection).
     • DevTools and off-origin navigation are blocked in the packaged build.
     • Single-instance, permission-deny-all, isolated persistent partition.

   "Locking" simply reloads the window: the vault keeps its master key only in
   memory, so a reload instantly returns to the locked unlock screen.
   ========================================================================== */

const {
  app,
  BrowserWindow,
  Tray,
  Menu,
  shell,
  session,
  globalShortcut,
  powerMonitor,
  nativeImage,
  nativeTheme,
  clipboard,
  dialog,
} = require("electron");
const path = require("path");

// Where the vault lives. Defaults to the hosted app (crypto is fully
// client-side and it caches offline via a service worker). Point this at a
// self-hosted / localhost instance for a 100% offline, air-gapped setup:
//   VAULT_URL=http://localhost:3000/vault npm start
const VAULT_URL = process.env.VAULT_URL || "https://saleh.im/vault";
const BASE_ORIGIN = new URL(VAULT_URL).origin;

const IS_PACKAGED = app.isPackaged;
const AUTO_LOCK_BLUR_MS = 5 * 60 * 1000; // lock 5 min after the window loses focus
const AUTO_LOCK_IDLE_S = 10 * 60; // lock after 10 min of system-wide inactivity

/** @type {BrowserWindow | null} */
let mainWindow = null;
/** @type {Tray | null} */
let tray = null;
let blurTimer = null;
let idleInterval = null;

// Harden the whole process before any window exists.
app.enableSandbox();
app.setName("Vault");
// Reduce fingerprintable GPU quirks / crashes on odd Linux GPU stacks.
app.commandLine.appendSwitch("disable-features", "OutOfBlinkCors");

function isSameOrigin(url) {
  try {
    return new URL(url).origin === BASE_ORIGIN;
  } catch {
    return false;
  }
}

function trayImage() {
  try {
    const img = nativeImage.createFromPath(path.join(__dirname, "build", "icon.png"));
    return img.isEmpty() ? undefined : img.resize({ width: 22, height: 22 });
  } catch {
    return undefined;
  }
}

/* --------------------------------------------------------------------------
   Lock / show helpers
   ------------------------------------------------------------------------ */

function wipeClipboard() {
  try {
    clipboard.clear();
  } catch {
    /* no-op */
  }
}

/** Lock the vault: reload drops the in-memory master key, and we scrub the clipboard. */
function lockVault() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    try {
      mainWindow.webContents.reload();
    } catch {
      /* no-op */
    }
  }
  wipeClipboard();
}

function showWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    createWindow();
    return;
  }
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

function toggleWindow() {
  if (mainWindow && mainWindow.isVisible() && mainWindow.isFocused()) {
    mainWindow.hide();
  } else {
    showWindow();
  }
}

function aboutDialog() {
  dialog.showMessageBox(mainWindow ?? undefined, {
    type: "info",
    title: "About Vault",
    message: "Vault",
    detail:
      "Zero-knowledge, eight-layer encrypted password vault by Saleh.\n\n" +
      "• PBKDF2-SHA-512 → HKDF → AES-256-GCM/CTR/CBC → HMAC cascade\n" +
      "• Optional keyfile second factor · RFC-6238 authenticator\n" +
      "• Runs locally — your master password never leaves this device.\n\n" +
      "saleh.im/vault",
    buttons: ["OK"],
    noLink: true,
  });
}

/* --------------------------------------------------------------------------
   Application menu (accelerators work even with the bar auto-hidden)
   ------------------------------------------------------------------------ */

function buildMenu() {
  const template = [
    {
      label: "Vault",
      submenu: [
        { label: "Lock now", accelerator: "CmdOrCtrl+L", click: () => lockVault() },
        { label: "Reload", accelerator: "CmdOrCtrl+R", click: () => mainWindow?.webContents.reload() },
        { type: "separator" },
        { label: "About Vault", click: () => aboutDialog() },
        { type: "separator" },
        { label: "Hide", accelerator: "CmdOrCtrl+H", click: () => mainWindow?.hide() },
        { label: "Quit", accelerator: "CmdOrCtrl+Q", click: () => app.quit() },
      ],
    },
    {
      label: "Edit",
      submenu: [
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        { role: "selectAll" },
      ],
    },
    {
      label: "View",
      submenu: [
        { role: "resetZoom", accelerator: "CmdOrCtrl+0" },
        { role: "zoomIn", accelerator: "CmdOrCtrl+Plus" },
        { role: "zoomOut", accelerator: "CmdOrCtrl+-" },
        { type: "separator" },
        { role: "togglefullscreen" },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function buildTray() {
  const img = trayImage();
  try {
    tray = img ? new Tray(img) : new Tray(nativeImage.createEmpty());
  } catch {
    return;
  }
  tray.setToolTip("Vault");
  const menu = Menu.buildFromTemplate([
    { label: "Show Vault", click: () => showWindow() },
    { label: "Lock now", click: () => lockVault() },
    { type: "separator" },
    { label: "About", click: () => aboutDialog() },
    { label: "Quit", click: () => app.quit() },
  ]);
  tray.setContextMenu(menu);
  tray.on("click", () => toggleWindow());
}

/* --------------------------------------------------------------------------
   Main window
   ------------------------------------------------------------------------ */

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1120,
    height: 800,
    minWidth: 360,
    minHeight: 560,
    backgroundColor: nativeTheme.shouldUseDarkColors ? "#0b0c0e" : "#f2eee4",
    title: "Vault",
    icon: path.join(__dirname, "build", "icon.png"),
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      nodeIntegrationInWorker: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      experimentalFeatures: false,
      spellcheck: false,
      devTools: !IS_PACKAGED,
      partition: "persist:vault",
    },
  });

  // Anti screen-capture (screenshots / screen recording) where the OS supports it.
  try {
    mainWindow.setContentProtection(true);
  } catch {
    /* unsupported on some Linux compositors — harmless */
  }

  mainWindow.once("ready-to-show", () => mainWindow?.show());
  mainWindow.loadURL(VAULT_URL);

  // External links → system browser, never inside the vault window.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) shell.openExternal(url);
    return { action: "deny" };
  });

  // Block navigation away from the vault origin.
  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (!isSameOrigin(url)) {
      event.preventDefault();
      if (/^https?:/i.test(url)) shell.openExternal(url);
    }
  });

  // Block DevTools shortcuts in the packaged build.
  mainWindow.webContents.on("before-input-event", (event, input) => {
    if (!IS_PACKAGED) return;
    const key = (input.key || "").toLowerCase();
    const blockDevtools =
      key === "f12" ||
      ((input.control || input.meta) && input.shift && (key === "i" || key === "j" || key === "c")) ||
      ((input.control || input.meta) && key === "u");
    if (blockDevtools) event.preventDefault();
  });
  mainWindow.webContents.on("devtools-opened", () => {
    if (IS_PACKAGED) mainWindow?.webContents.closeDevTools();
  });

  // Auto-lock a while after the window loses focus.
  mainWindow.on("blur", () => {
    clearTimeout(blurTimer);
    blurTimer = setTimeout(() => lockVault(), AUTO_LOCK_BLUR_MS);
  });
  mainWindow.on("focus", () => clearTimeout(blurTimer));

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

/* --------------------------------------------------------------------------
   App lifecycle
   ------------------------------------------------------------------------ */

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => showWindow());

  app.whenReady().then(() => {
    const ses = session.fromPartition("persist:vault");
    // Deny every permission request (camera, mic, geolocation, notifications…).
    ses.setPermissionRequestHandler((_wc, _permission, callback) => callback(false));
    ses.setPermissionCheckHandler(() => false);

    // Never allow <webview> embedding or extra window attachments.
    app.on("web-contents-created", (_e, contents) => {
      contents.on("will-attach-webview", (event) => event.preventDefault());
      contents.setWindowOpenHandler(({ url }) => {
        if (/^https?:/i.test(url)) shell.openExternal(url);
        return { action: "deny" };
      });
    });

    buildMenu();
    createWindow();
    buildTray();

    // Global hotkeys.
    try {
      globalShortcut.register("CommandOrControl+Shift+L", () => lockVault());
      globalShortcut.register("CommandOrControl+Shift+V", () => toggleWindow());
    } catch {
      /* no-op */
    }

    // Lock on system suspend / screen lock.
    try {
      powerMonitor.on("suspend", () => lockVault());
      powerMonitor.on("lock-screen", () => lockVault());
    } catch {
      /* no-op */
    }

    // Lock after prolonged system-wide inactivity.
    idleInterval = setInterval(() => {
      try {
        if (mainWindow && powerMonitor.getSystemIdleTime() >= AUTO_LOCK_IDLE_S) lockVault();
      } catch {
        /* no-op */
      }
    }, 30_000);

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });
}

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
  clearInterval(idleInterval);
  clearTimeout(blurTimer);
  wipeClipboard();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
