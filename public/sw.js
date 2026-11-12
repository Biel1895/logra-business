const offlineCache = "logra-business-offline-v1";
const offlineFiles = ["/offline.html", "/assets/offline.css", "/assets/fonts.css",
    "/assets/InterVariable.woff2", "/assets/logra/icon-192.png"];

self.addEventListener("install", (event) => {
    event.waitUntil(caches.open(offlineCache).then((cache) => cache.addAll(offlineFiles)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
    event.waitUntil(caches.keys().then((keys) => Promise.all(keys
        .filter((key) => (key.startsWith("logra-business-offline-") || key.startsWith("soma-clara-caixa-offline-")) && key !== offlineCache)
        .map((key) => caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", (event) => {
    const { request } = event;
    const url = new URL(request.url);
    if (request.method !== "GET" || url.origin !== self.location.origin) return;
    if (request.mode === "navigate" && !url.pathname.startsWith("/api/")) {
        event.respondWith(fetch(request).catch(async () => (await caches.open(offlineCache)).match("/offline.html")));
    } else if (offlineFiles.includes(url.pathname)) {
        event.respondWith(fetch(request).catch(async () => (await caches.open(offlineCache)).match(url.pathname)));
    }
});
