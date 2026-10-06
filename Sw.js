// Kit Prima Visita: salva l'app sul telefono per usarla senza internet.
// Cambia VERSION ogni volta che aggiorni index.html, così il telefono scarica la nuova versione.
const VERSION = "kpv-v1";
const APP = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
  "./apple-touch-icon.png"
];
const CDN = [
  "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js",
  "https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,800&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@500&display=swap"
];

self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const cache = await caches.open(VERSION);
    await cache.addAll(APP);
    // Le risorse esterne non devono bloccare l'installazione se una manca.
    await Promise.all(CDN.map(async url => {
      try { await cache.put(url, await fetch(url, { mode: "no-cors" })); } catch (e) {}
    }));
    self.skipWaiting();
  })());
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", event => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Pagina: prima la rete (per avere gli aggiornamenti), poi la copia salvata.
  if (req.mode === "navigate") {
    event.respondWith((async () => {
      const cache = await caches.open(VERSION);
      try {
        const fresh = await fetch(req);
        cache.put("./index.html", fresh.clone());
        return fresh;
      } catch (e) {
        return (await cache.match("./index.html")) || (await cache.match("./"));
      }
    })());
    return;
  }

  // Tutto il resto (libreria PDF, caratteri, icone): prima la copia salvata, poi la rete.
  const cacheable = url.origin === location.origin ||
    url.hostname === "cdnjs.cloudflare.com" ||
    url.hostname === "fonts.googleapis.com" ||
    url.hostname === "fonts.gstatic.com";
  if (!cacheable) return;

  event.respondWith((async () => {
    const cache = await caches.open(VERSION);
    const hit = await cache.match(req, { ignoreVary: true }) || await cache.match(req.url, { ignoreVary: true });
    if (hit) return hit;
    try {
      const res = await fetch(req);
      if (res.ok || res.type === "opaque") cache.put(req, res.clone());
      return res;
    } catch (e) {
      return new Response("", { status: 504 });
    }
  })());
});
