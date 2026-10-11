// Service worker: guarda la app para poder jugar sin conexión.
// Cambia VERSION al publicar una versión nueva para que se renueve la caché.
const VERSION = "hp-v4";
const ARCHIVOS = [
  "./", "index.html", "css/estilo.css",
  "js/app.js", "js/motor.js", "js/textos.js", "js/ui.js", "js/estado.js", "js/pixel.js", "js/fondo.js", "js/sonido.js",
  "js/red.js", "js/vendor/peerjs.min.js",
  "js/pantallas/comun.js", "js/pantallas/inicio.js", "js/pantallas/rondas.js", "js/pantallas/contrarreloj.js",
  "js/pantallas/resultados.js", "js/pantallas/reto.js", "js/pantallas/local.js", "js/pantallas/online.js", "js/pantallas/universo.js", "js/pantallas/hangar.js",
  "datos/es.json", "datos/en.json",
  "fuentes/pixelify-sans.woff2", "fuentes/space-grotesk.woff2",
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
  if (e.request.method !== "GET" || new URL(e.request.url).origin !== location.origin) return;   // PeerJS va directo
  e.respondWith(
    fetch(e.request)
      .then((r) => { const copia = r.clone(); caches.open(VERSION).then((c) => c.put(e.request, copia)); return r; })
      .catch(() => caches.match(e.request)),
  );
});
