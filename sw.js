/* ════════════════════════════════════════════════════════════════════════════
   El Temps — Service Worker (PWA instal·lable + funcionament offline)
   ════════════════════════════════════════════════════════════════════════════
   Estratègia:
   - HTML (navegació): network-first → sempre la versió més nova si hi ha
     connexió; si no n'hi ha, es fa servir la versió en memòria cau.
   - Estàtics propis (icones, manifest): cache-first.
   - Peticions externes (Open-Meteo, Meteoalarm, Nominatim, Leaflet, tiles):
     NO es toquen → sempre van a la xarxa (dades sempre fresques).
   ════════════════════════════════════════════════════════════════════════════ */
const CACHE = 'eltemps-v1';
const SHELL = ['./', './index.html', './manifest.json', './icon.svg', './icon-192.png', './icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;            // externs → xarxa directa

  // HTML / navegació: network-first
  if (req.mode === 'navigate' || url.pathname.endsWith('/') || url.pathname.endsWith('index.html')) {
    e.respondWith(
      fetch(req)
        .then(r => { const cp = r.clone(); caches.open(CACHE).then(c => c.put(req, cp)); return r; })
        .catch(() => caches.match(req).then(m => m || caches.match('./index.html')))
    );
    return;
  }

  // Estàtics propis: cache-first
  e.respondWith(
    caches.match(req).then(m => m || fetch(req).then(r => {
      const cp = r.clone(); caches.open(CACHE).then(c => c.put(req, cp)); return r;
    }))
  );
});
