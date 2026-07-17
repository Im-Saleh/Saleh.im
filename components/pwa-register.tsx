"use client";

import { useEffect } from "react";

/**
 * Registers the offline service worker so Vault (and the site) can be installed
 * as a PWA and run without a network. Registration is deferred until after load
 * so it never competes with first paint.
 *
 * Crucially it also keeps the app *fresh*: it checks for a new worker on every
 * load, asks a waiting worker to activate, and reloads the page once when a new
 * worker takes control — so a deploy is never masked by a stale cache.
 */
export function PwaRegister() {
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;

    let reloading = false;
    const onControllerChange = () => {
      if (reloading) return;
      reloading = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

    const register = async () => {
      try {
        const reg = await navigator.serviceWorker.register("/sw.js");
        // Proactively check for an updated worker.
        reg.update().catch(() => {});
        // If one is already waiting, activate it now.
        if (reg.waiting) reg.waiting.postMessage("skip-waiting");
        reg.addEventListener("updatefound", () => {
          const nw = reg.installing;
          if (!nw) return;
          nw.addEventListener("statechange", () => {
            // A new worker installed while an old one controls the page → swap.
            if (nw.state === "installed" && navigator.serviceWorker.controller) {
              reg.waiting?.postMessage("skip-waiting");
            }
          });
        });
      } catch {
        /* SW is a progressive enhancement — ignore failures */
      }
    };

    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });

    return () => navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
  }, []);

  return null;
}
