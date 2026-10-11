// Service worker: guarda la app para poder jugar sin conexión.
// Cambia VERSION al publicar una versión nueva para que se renueve la caché.
const VERSION = "hp-v1";
const ARCHIVOS = [
  "./", "index.html", "css/estilo.css",
  "js/app.js", "js/motor.js", "js/textos.js", "js/estrellas.js",
  "datos/es.json", "datos/en.json",
  "fuentes/space-grotesk.woff2", "fuentes/jetbrains-mono.woff2",
  "iconos/icono.svg", "manifest.webmanifest",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(ARCHIVOS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((claves) => Promise.all(claves.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// Red primero (para ver siempre la última versión) y caché si no hay conexión.
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  e.respondWith(
    fetch(e.request)
      .then((r) => { const copia = r.clone(); caches.open(VERSION).then((c) => c.put(e.request, copia)); return r; })
      .catch(() => caches.match(e.request)),
  );
});
