// Nachklang Service Worker: App-Dateien offline verfügbar machen.
// Immer zuerst das Netz fragen (damit Updates sofort ankommen),
// nur ohne Verbindung aus dem Cache laden. Spotify-Anfragen gehen nie über den Cache.
const CACHE = "nachklang-v3";
const SHELL = [
  "./",
  "index.html",
  "css/app.css",
  "js/app.js",
  "js/api.js",
  "js/auth.js",
  "js/color.js",
  "js/config.js",
  "js/demo.js",
  "js/icons.js",
  "js/library.js",
  "js/store.js",
  "manifest.webmanifest",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/apple-touch-icon.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(SHELL.map((u) => new Request(u, { cache: "no-cache" }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== self.location.origin) return;

  // Seitenaufrufe (navigate) dürfen keine zusätzlichen Optionen bekommen
  const fresh = e.request.mode === "navigate" ? fetch(e.request) : fetch(e.request, { cache: "no-cache" });
  e.respondWith(
    fresh
      .then((res) => {
        if (res.ok && url.search === "") {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy));
        }
        return res;
      })
      .catch(async () => (await caches.match(e.request, { ignoreSearch: true })) || (e.request.mode === "navigate" ? caches.match("index.html") : Response.error()))
  );
});
