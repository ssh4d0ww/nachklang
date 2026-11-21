// Nachklang Service Worker: App-Dateien offline verfügbar machen.
// Spotify-Anfragen gehen nie über den Cache.
const CACHE = "nachklang-v1";
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
  "js/store.js",
  "manifest.webmanifest",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/apple-touch-icon.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
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

  // Seitenaufrufe: zuerst Netz (frische Version, Login-Rückkehr), sonst Cache
  if (e.request.mode === "navigate") {
    e.respondWith(fetch(e.request).catch(() => caches.match("index.html")));
    return;
  }

  // Dateien: sofort aus dem Cache, im Hintergrund aktualisieren
  e.respondWith(
    caches.match(e.request).then((cached) => {
      const fresh = fetch(e.request)
        .then((res) => {
          if (res.ok) caches.open(CACHE).then((c) => c.put(e.request, res.clone()));
          return res;
        })
        .catch(() => cached);
      return cached || fresh;
    })
  );
});
