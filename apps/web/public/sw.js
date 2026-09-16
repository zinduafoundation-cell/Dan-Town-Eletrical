const CACHE_NAME = "dantown-pos-v3";
const APP_SHELL = ["/manifest.json", "/icon.svg", "/403", "/pos"];

function isProductRequest(request) {
  return new URL(request.url).pathname === "/api/pos/products";
}

function isAppShellRequest(request) {
  const url = new URL(request.url);
  return url.origin === self.location.origin && (request.destination === "document" || request.destination === "script" || request.destination === "style" || request.destination === "image");
}

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const request = event.request;

  if (!isProductRequest(request) && !isAppShellRequest(request)) return;

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(() => caches.match(request).then((cached) => {
        if (cached) return cached;
        if (request.mode === "navigate" || request.destination === "document") return caches.match("/pos");
        throw new Error("Network request failed and no cached asset is available");
      }))
  );
});
