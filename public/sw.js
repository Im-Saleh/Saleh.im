/* Vault / saleh.im — offline service worker (v3).

   Freshness-first: page navigations and dynamic assets always try the network
   first so a new deploy is picked up immediately. Only Next's content-hashed,
   immutable build chunks (/_next/static/…) are served cache-first for speed.
   The cache version is bumped on every meaningful change so old caches are
   purged on activate, and the page auto-reloads when a new worker takes over
   (see components/pwa-register). Nothing sensitive is cached — the vault
   ciphertext lives in localStorage, not here. */

const CACHE = "saleh-site-v3";
const APP_SHELL = ["/", "/vault", "/manifest.webmanifest", "/icon.svg", "/favicon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      await Promise.allSettled(APP_SHELL.map((url) => cache.add(url)));
      await self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

// Allow the page to tell a waiting worker to activate immediately.
self.addEventListener("message", (event) => {
  if (event.data === "skip-waiting") self.skipWaiting();
});

const isImmutable = (url) => url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/_next/image");

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return; // never cache live endpoints

  // Immutable, content-hashed build assets → cache-first (safe + fast).
  if (isImmutable(url)) {
    event.respondWith(
      (async () => {
        const cached = await caches.match(req);
        if (cached) return cached;
        const res = await fetch(req);
        if (res && res.status === 200) caches.open(CACHE).then((c) => c.put(req, res.clone()));
        return res;
      })()
    );
    return;
  }

  // Everything else (navigations + dynamic assets) → network-first so updates
  // always win when online, with a cache fallback for offline.
  event.respondWith(
    (async () => {
      try {
        const fresh = await fetch(req);
        if (fresh && fresh.status === 200 && fresh.type === "basic") {
          const cache = await caches.open(CACHE);
          cache.put(req, fresh.clone());
        }
        return fresh;
      } catch {
        const cached = await caches.match(req);
        if (cached) return cached;
        if (req.mode === "navigate") return (await caches.match("/vault")) || (await caches.match("/")) || Response.error();
        return Response.error();
      }
    })()
  );
});
