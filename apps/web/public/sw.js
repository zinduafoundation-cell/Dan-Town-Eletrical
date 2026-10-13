const CACHE_NAME = "dantown-centre-pwa-v1";
const OFFLINE_PAGE = "/centre/offline";

function isPrivateNavigation(url) {
  return ["/centre", "/admin", "/pos", "/staff", "/business", "/business-center", "/login", "/logout",
    "/register", "/forgot-password", "/reset-password", "/verify-email", "/callback-error", "/auth", "/api",
    "/401", "/403"].some((prefix) => url.pathname === prefix || url.pathname.startsWith(`${prefix}/`));
}

async function cacheOfflineShell() {
  const response = await fetch(OFFLINE_PAGE, { cache: "reload" });
  if (!response.ok) throw new Error("Unable to cache the Centre offline page.");
  const cache = await caches.open(CACHE_NAME);
  await cache.put(OFFLINE_PAGE, response.clone());
  const html = await response.text();
  const assets = [...html.matchAll(/(?:src|href)="([^"]+\.(?:js|css)(?:\?[^"]*)?)"/g)]
    .map((match) => new URL(match[1].replaceAll("&amp;", "&"), self.location.origin).href)
    .filter((url) => new URL(url).origin === self.location.origin);
  await Promise.all(assets.map(async (asset) => {
    try {
      const assetResponse = await fetch(asset, { cache: "reload" });
      if (assetResponse.ok) await cache.put(asset, assetResponse);
    } catch (error) {
      console.warn("Unable to cache an offline Centre asset.", error);
    }
  }));
}

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) =>
    cache.addAll(["/manifest.json", "/centre.webmanifest", "/icon.svg"])
  ));
  self.skipWaiting();
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "CACHE_CENTRE_OFFLINE_SHELL") {
    event.waitUntil(cacheOfflineShell().catch((error) => {
      console.error("Unable to prepare the Centre offline page.", error);
    }));
  }
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((key) => ["dantown-pos-v3", "dantown-centre-pwa-v0"].includes(key))
        .map((key) => caches.delete(key))
    ))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET" || new URL(request.url).origin !== self.location.origin) return;

  if (request.mode === "navigate" && new URL(request.url).pathname === OFFLINE_PAGE) {
    event.respondWith(fetch(request).catch(async () =>
      (await caches.open(CACHE_NAME)).match(OFFLINE_PAGE) ?? Response.error()
    ));
    return;
  }

  if (request.mode === "navigate" && isPrivateNavigation(new URL(request.url))) {
    event.respondWith(fetch(request).catch(async () => {
      const cache = await caches.open(CACHE_NAME);
      const offlinePage = await cache.match(OFFLINE_PAGE);
      if (!offlinePage) return Response.error();
      const target = new URL(OFFLINE_PAGE, self.location.origin);
      target.searchParams.set("from", new URL(request.url).pathname);
      return Response.redirect(target.href, 302);
    }));
    return;
  }

  if (request.destination === "script" || request.destination === "style" || request.destination === "font") {
    event.respondWith(fetch(request).catch(async () => {
      const cached = await caches.match(request);
      return cached ?? Response.error();
    }));
  }
});
