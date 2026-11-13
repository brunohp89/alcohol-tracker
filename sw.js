// Service worker for Contatore Alcol: makes the app shell available offline.
// Bump CACHE when shipping a change that must drop previously cached files.
const CACHE = "alcol-shell-v1";
const SHELL = ["./", "./index.html", "./manifest.json", "./icon-192.png", "./icon-512.png", "./icon-maskable-512.png"];
const FONT_HOSTS = ["fonts.googleapis.com", "fonts.gstatic.com"];
const NETWORK_TIMEOUT_MS = 2500;

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

async function fetchAndCache(request) {
  const response = await fetch(request);
  if (response.ok || response.type === "opaque") {
    const cache = await caches.open(CACHE);
    await cache.put(request, response.clone());
  }
  return response;
}

// App files: fresh copy when the network answers quickly, cached copy otherwise.
async function networkFirst(request) {
  const cached = await caches.match(request, { ignoreSearch: true });
  const network = fetchAndCache(request);
  if (!cached) return network;
  network.catch(() => {});
  const timeout = new Promise((resolve) => setTimeout(() => resolve(cached), NETWORK_TIMEOUT_MS));
  return Promise.race([network.catch(() => cached), timeout]);
}

// Fonts never change at a given URL: serve from cache, fetch once.
async function cacheFirst(request) {
  return (await caches.match(request)) || fetchAndCache(request);
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return; // sync calls to Apps Script are POSTs and must never be cached
  const url = new URL(request.url);
  if (url.origin === self.location.origin) event.respondWith(networkFirst(request));
  else if (FONT_HOSTS.includes(url.hostname)) event.respondWith(cacheFirst(request));
});
