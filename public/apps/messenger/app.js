/**
 * Cipher — unified encrypted messenger.
 *
 *  • One app, two modes:
 *      P2P    → persistent; encrypted history saved on-device (vault key from password).
 *      Secret → ephemeral; nothing stored, extra passphrase lock, self-destruct.
 *  • Transport is always end-to-end: an ECDH handshake per connection derives a
 *    shared secret, expanded into a 4-layer seal (see crypto.js). The signalling
 *    broker (PeerJS) only helps peers find each other — it never sees plaintext.
 */
(function () {
  "use strict";

  var $ = function (id) { return document.getElementById(id); };

  var state = {
    user: null,
    password: null,
    vault: null,        // { key, salt } for at-rest encryption (P2P)
    mode: null,         // 'p2p' | 'secret'
    peer: null,         // PeerJS instance
    id: null,           // our peer id
    roomSecret: "",     // secret-mode shared passphrase
    active: null,       // active peer id
  };

  var conns = {};       // peerId -> { conn, keyPair, keys, ready, name }
  var histories = {};   // peerId -> [ {mine, text, ts} ]
  var destructTimers = [];

  /* ---------------- utils ---------------- */
  function sanitize(u) { return u.toLowerCase().replace(/[^a-z0-9]/g, ""); }
  function peerIdFor(u) { return "cipher-" + sanitize(u); }
  function nameFromId(id) { return id.replace(/^cipher-/, "").split("-")[0]; }
  function now() { return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }); }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function storeKey(peer) { return "cipher:hist:" + state.user + ":" + peer; }

  /* ---------------- persistence (P2P only) ---------------- */
  async function ensureVault() {
    var saltKey = "cipher:salt:" + state.user;
    var existing = null;
    try { existing = localStorage.getItem(saltKey); } catch (e) {}
    state.vault = await Cipher.deriveVaultKey(state.password, existing);
    if (!existing) {
      try { localStorage.setItem(saltKey, state.vault.salt); } catch (e) {}
    }
  }
  async function saveHistory(peer) {
    if (state.mode !== "p2p" || !state.vault) return;
    try {
      var payload = await Cipher.vaultEncrypt(state.vault, histories[peer] || []);
      localStorage.setItem(storeKey(peer), payload);
    } catch (e) {}
  }
  async function loadHistory(peer) {
    if (state.mode !== "p2p" || !state.vault) return [];
    try {
      var raw = localStorage.getItem(storeKey(peer));
      if (!raw) return [];
      return await Cipher.vaultDecrypt(state.vault, raw);
    } catch (e) { return []; }
  }
  async function loadAllThreads() {
    if (state.mode !== "p2p") return;
    var prefix = "cipher:hist:" + state.user + ":";
    for (var i = 0; i < localStorage.length; i++) {
      var k = localStorage.key(i);
      if (k && k.indexOf(prefix) === 0) {
        var peer = k.slice(prefix.length);
        histories[peer] = await loadHistory(peer);
        if (!conns[peer]) conns[peer] = { conn: null, ready: false, name: nameFromId(peer) };
      }
    }
    renderThreads();
  }

  /* ---------------- rendering ---------------- */
  function renderThreads() {
    var ul = $("thread-list");
    ul.innerHTML = "";
    var ids = Object.keys(conns);
    $("no-threads").hidden = ids.length > 0;
    ids.forEach(function (id) {
      var li = document.createElement("li");
      li.className = id === state.active ? "active" : "";
      var online = conns[id] && conns[id].conn && conns[id].conn.open;
      li.innerHTML =
        '<span class="tdot" style="opacity:' + (online ? 1 : 0.35) + '"></span>' +
        '<span class="tname">' + esc(conns[id].name || nameFromId(id)) + "</span>";
      li.onclick = function () { openThread(id); };
      ul.appendChild(li);
    });
  }

  function renderMessages() {
    var box = $("messages");
    box.innerHTML = "";
    if (!state.active) {
      box.innerHTML = '<div class="empty"><div class="empty-mark">◆</div><p>Link to a peer by their username to open a sealed channel.</p></div>';
      return;
    }
    var list = histories[state.active] || [];
    if (!list.length) {
      box.innerHTML = '<div class="sys">Sealed channel ready. Say hello — messages are protected by <b>4 layers</b> of encryption.</div>';
    }
    list.forEach(function (m) {
      if (m.sys) {
        var s = document.createElement("div");
        s.className = "sys";
        s.innerHTML = m.text;
        box.appendChild(s);
        return;
      }
      var d = document.createElement("div");
      d.className = "bubble " + (m.mine ? "me" : "them");
      d.innerHTML = esc(m.text) + '<span class="meta">' + m.ts + " · 🔒</span>";
      box.appendChild(d);
    });
    box.scrollTop = box.scrollHeight;
  }

  function pushMsg(peer, msg, opts) {
    if (!histories[peer]) histories[peer] = [];
    histories[peer].push(msg);
    if (peer === state.active) renderMessages();
    if (state.mode === "p2p" && !(opts && opts.noSave)) saveHistory(peer);
    // self-destruct for secret mode
    if (state.mode === "secret" && !msg.sys && $("self-destruct") && $("self-destruct").checked) {
      var t = setTimeout(function () {
        var arr = histories[peer] || [];
        var idx = arr.indexOf(msg);
        if (idx >= 0) arr.splice(idx, 1);
        if (peer === state.active) renderMessages();
      }, 60000);
      destructTimers.push(t);
    }
  }

  function openThread(id) {
    state.active = id;
    $("chat").classList.add("viewing");
    $("conv-name").textContent = conns[id] ? (conns[id].name || nameFromId(id)) : nameFromId(id);
    var online = conns[id] && conns[id].conn && conns[id].conn.open;
    var ready = conns[id] && conns[id].ready;
    $("conv-status").innerHTML = ready
      ? '<i class="dot"></i> sealed · connected'
      : online ? '<i class="dot"></i> establishing keys…' : "offline — link again to reconnect";
    $("conv-status").className = "me-status" + (ready ? " online" : "");
    $("fingerprint").textContent = ready && conns[id].keys ? "🔑 " + conns[id].keys.fingerprint : "";
    var canSend = !!ready;
    $("msg-input").disabled = !canSend;
    $("send-btn").disabled = !canSend;
    renderThreads();
    renderMessages();
    if (canSend) $("msg-input").focus();
  }

  /* ---------------- crypto handshake over the wire ---------------- */
  async function beginHandshake(entry) {
    entry.keyPair = await Cipher.genECDH();
    var pub = await Cipher.exportPub(entry.keyPair);
    entry.conn.send(JSON.stringify({ t: "hs", pub: pub, name: state.user }));
  }

  async function onHandshake(peer, data) {
    var entry = conns[peer];
    if (!entry) return;
    if (data.name) entry.name = data.name;
    if (!entry.keyPair) {
      // We hadn't sent ours yet (rare ordering) — do it now.
      await beginHandshake(entry);
    }
    var extra = state.mode === "secret" ? state.roomSecret : null;
    try {
      entry.keys = await Cipher.deriveShared(entry.keyPair, data.pub, extra);
      entry.ready = true;
      pushMsg(peer, { sys: true, text: "🔒 Secure channel established with <b>" + esc(entry.name) + "</b>." }, { noSave: true });
      if (peer === state.active) openThread(peer);
      renderThreads();
    } catch (e) {
      pushMsg(peer, { sys: true, text: "⚠︎ Key exchange failed." }, { noSave: true });
    }
  }

  async function onEncrypted(peer, data) {
    var entry = conns[peer];
    if (!entry || !entry.keys) return;
    try {
      var text = await Cipher.open(entry.keys, data.c);
      pushMsg(peer, { mine: false, text: text, ts: now() });
    } catch (e) {
      pushMsg(peer, { sys: true, text: "⚠︎ Dropped a message that failed authentication (wrong passphrase or tampered)." }, { noSave: true });
    }
  }

  /* ---------------- connection wiring ---------------- */
  function wireConn(conn) {
    var peer = conn.peer;
    if (!conns[peer]) conns[peer] = {};
    conns[peer].conn = conn;
    conns[peer].ready = false;
    conns[peer].name = conns[peer].name || nameFromId(peer);

    conn.on("open", function () {
      renderThreads();
      if (!state.active) openThread(peer);
      else if (peer === state.active) openThread(peer);
      beginHandshake(conns[peer]);
    });

    conn.on("data", function (raw) {
      var data;
      try { data = JSON.parse(raw); } catch (e) { return; }
      if (data.t === "hs") onHandshake(peer, data);
      else if (data.t === "msg") onEncrypted(peer, data);
    });

    conn.on("close", function () {
      if (conns[peer]) { conns[peer].ready = false; conns[peer].conn = null; }
      pushMsg(peer, { sys: true, text: "⚠︎ " + esc(nameFromId(peer)) + " disconnected." }, { noSave: true });
      if (peer === state.active) openThread(peer);
      renderThreads();
    });
    conn.on("error", function () {});
  }

  function connectTo(username) {
    var target = peerIdFor(username);
    if (target === state.id) return; // don't connect to self
    if (!conns[target]) conns[target] = { name: username };
    var conn = state.peer.connect(target, { reliable: true, metadata: { from: state.user } });
    wireConn(conn);
    openThread(target);
  }

  /* ---------------- peer bootstrap ---------------- */
  function startPeer() {
    var primary = peerIdFor(state.user);
    state.peer = new Peer(primary, {
      debug: 1,
      config: { iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:global.stun.twilio.com:3478" }
      ] }
    });
    state.id = primary;

    state.peer.on("open", function (id) {
      state.id = id;
      $("me-status").innerHTML = '<i class="dot"></i> online';
      $("me-status").className = "me-status online";
    });
    state.peer.on("connection", function (conn) { wireConn(conn); });
    state.peer.on("error", function (err) {
      if (err && err.type === "unavailable-id") {
        // username taken (probably ourselves in another tab) — use a hashed id.
        Cipher.sha256Hex(state.user + ":" + state.password).then(function (h) {
          var fid = peerIdFor(state.user) + "-" + h.slice(0, 6);
          state.peer = new Peer(fid, { debug: 1 });
          state.id = fid;
          state.peer.on("open", function () {
            $("me-status").innerHTML = '<i class="dot"></i> online';
            $("me-status").className = "me-status online";
          });
          state.peer.on("connection", function (conn) { wireConn(conn); });
        });
      } else {
        $("me-status").innerHTML = '<i class="dot"></i> ' + esc(err.type || "error");
      }
    });
  }

  /* ---------------- mode / screens ---------------- */
  function enterMode(mode) {
    state.mode = mode;
    document.body.classList.toggle("secret-mode", mode === "secret");
    $("mode-flag").innerHTML = mode === "secret" ? "🕶 Secret mode · ephemeral" : "⇄ P2P mode · saved";
    $("secret-extra").hidden = mode !== "secret";
    $("secret-banner").hidden = mode !== "secret";
    $("seal-badge").textContent = "🔒 4-layer";

    $("me-name").textContent = state.user;
    $("me-avatar").textContent = state.user.charAt(0);
    $("my-share").textContent = state.user;

    $("mode").classList.remove("active");
    $("chat").classList.add("active");

    startPeer();
    if (mode === "p2p") { ensureVault().then(loadAllThreads); }
    else { histories = {}; conns = {}; renderThreads(); renderMessages(); }
  }

  function resetToAuth() {
    if (state.peer) { try { state.peer.destroy(); } catch (e) {} }
    destructTimers.forEach(clearTimeout);
    state = { user: null, password: null, vault: null, mode: null, peer: null, id: null, roomSecret: "", active: null };
    conns = {}; histories = {}; destructTimers = [];
    document.body.classList.remove("secret-mode");
    $("chat").classList.remove("active", "viewing");
    $("mode").classList.remove("active");
    $("auth").classList.add("active");
    $("password").value = "";
  }

  /* ---------------- events ---------------- */
  document.addEventListener("DOMContentLoaded", function () {
    $("auth-form").addEventListener("submit", function (e) {
      e.preventDefault();
      var u = $("username").value.trim();
      var p = $("password").value;
      if (u.length < 3 || p.length < 4) return;
      state.user = u; state.password = p;
      $("mode-hello").textContent = u;
      $("auth").classList.remove("active");
      $("mode").classList.add("active");
    });

    document.querySelectorAll(".mode-card").forEach(function (card) {
      card.addEventListener("click", function () { enterMode(card.getAttribute("data-mode")); });
    });
    $("mode-back").addEventListener("click", resetToAuth);
    $("logout").addEventListener("click", resetToAuth);
    $("switch-mode").addEventListener("click", function () {
      if (state.peer) { try { state.peer.destroy(); } catch (e) {} }
      conns = {}; histories = {}; state.active = null;
      $("chat").classList.remove("active", "viewing");
      $("mode").classList.add("active");
    });

    $("back-to-list").addEventListener("click", function () {
      $("chat").classList.remove("viewing");
    });

    $("connect-btn").addEventListener("click", function () {
      var v = $("peer-id").value.trim();
      if (state.mode === "secret") state.roomSecret = $("room-secret").value;
      if (v) { connectTo(v); $("peer-id").value = ""; }
    });
    $("peer-id").addEventListener("keydown", function (e) {
      if (e.key === "Enter") $("connect-btn").click();
    });
    $("room-secret").addEventListener("input", function () {
      state.roomSecret = $("room-secret").value;
    });

    $("send-form").addEventListener("submit", async function (e) {
      e.preventDefault();
      var text = $("msg-input").value.trim();
      var entry = state.active ? conns[state.active] : null;
      if (!text || !entry || !entry.keys || !entry.conn) return;
      $("msg-input").value = "";
      try {
        var sealed = await Cipher.seal(entry.keys, text);
        entry.conn.send(JSON.stringify({ t: "msg", c: sealed }));
        pushMsg(state.active, { mine: true, text: text, ts: now() });
      } catch (err) {
        pushMsg(state.active, { sys: true, text: "⚠︎ Failed to seal message." }, { noSave: true });
      }
    });

    window.addEventListener("beforeunload", function () {
      // Secret mode leaves nothing behind.
      if (state.mode === "secret") { histories = {}; }
    });
  });
})();
