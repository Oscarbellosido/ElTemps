/* ════════════════════════════════════════════════════════════════════════════
   El Temps — Service Worker (PWA instal·lable + offline robust)
   ════════════════════════════════════════════════════════════════════════════
   Objectiu: que MAI es vegi una pàgina en blanc.
   - Navegació (HTML): network-first amb temps d'espera; si falla, s'usa la
     còpia en memòria cau; si tampoc hi és, una pàgina mínima que recarrega.
   - Estàtics propis: cache-first amb actualització.
   - Peticions externes (APIs, tiles, Meteoalarm…): sempre a la xarxa.
   ════════════════════════════════════════════════════════════════════════════ */
const CACHE = 'eltemps-v12';
const SHELL = ['./', './index.html', './manifest.json', './icon.svg', './icon-192.png', './icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    // add() individual amb catch: si un recurs falla, NO trenca tota la instal·lació
    await Promise.all(SHELL.map(u => c.add(u).catch(() => {})));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

// fetch amb temps d'espera (evita quedar penjat si la xarxa no respon)
function fetchTimeout(req, ms) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), ms);
    fetch(req).then(r => { clearTimeout(t); resolve(r); }, err => { clearTimeout(t); reject(err); });
  });
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  let url;
  try { url = new URL(req.url); } catch { return; }
  if (url.origin !== location.origin) return;            // externs → xarxa directa

  // Navegació: network-first (sempre versió nova si hi ha xarxa), amb xarxa de seguretat
  if (req.mode === 'navigate') {
    e.respondWith((async () => {
      try {
        const net = await fetchTimeout(req, 6000);
        const c = await caches.open(CACHE); c.put('./index.html', net.clone()); c.put('./', net.clone());
        return net;
      } catch {
        const cached = await caches.match('./index.html') || await caches.match('./') || await caches.match(req);
        return cached || new Response(
          '<!doctype html><meta charset="utf-8"><meta http-equiv="refresh" content="1">' +
          '<body style="background:#0b1929;color:#8da9c0;font-family:sans-serif;text-align:center;padding-top:30vh">Carregant El Temps…</body>',
          { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
        );
      }
    })());
    return;
  }

  // Estàtics propis: cache-first amb actualització en segon pla
  e.respondWith(
    caches.match(req).then(m => m || fetchTimeout(req, 8000).then(r => {
      const cp = r.clone(); caches.open(CACHE).then(c => c.put(req, cp)); return r;
    }).catch(() => m))
  );
});
