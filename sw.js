/* ════════════════════════════════════════════════════════════════════════════
   El Temps — Service Worker (PWA instal·lable + offline robust)
   ════════════════════════════════════════════════════════════════════════════
   Objectiu: que MAI es vegi una pàgina en blanc.
   - Navegació (HTML): network-first amb temps d'espera; si falla, s'usa la
     còpia en memòria cau; si tampoc hi és, una pàgina mínima que recarrega.
   - Estàtics propis: cache-first amb actualització.
   - Peticions externes (APIs, tiles, Meteoalarm…): sempre a la xarxa.
   ════════════════════════════════════════════════════════════════════════════ */
const CACHE = 'eltemps-v21';
const SHELL = ['./', './index.html', './manifest.json', './icon.svg', './icon-192.png', './icon-512.png',
               './vendor/leaflet.js', './vendor/leaflet.css'];

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

// Només val la pena desar respostes correctes i del nostre propi origen.
// (type 'basic' = mateixa procedència; descarta opaques i redireccions a fora.)
function cacheable(r) {
  return !!r && r.ok && r.type === 'basic';
}

// fetch amb temps d'espera (evita quedar penjat si la xarxa no respon)
function fetchTimeout(req, ms) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), ms);
    fetch(req).then(r => { clearTimeout(t); resolve(r); }, err => { clearTimeout(t); reject(err); });
  });
}

/* ── Avisos (push) ───────────────────────────────────────────────────────────
   La tasca horària de GitHub envia un missatge amb {title, body, url} i aquí es
   converteix en una notificació del sistema. Wear OS la repeteix al canell tot sol.
   El navegador OBLIGA a mostrar-ne una: si el missatge arribés buit o trencat,
   igualment se n'ensenya una de genèrica, o el navegador acabaria retirant el permís. */
self.addEventListener('push', e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = {}; }
  const title = d.title || 'El Temps';
  const opts = {
    body: d.body || 'Toca per veure la previsió.',
    icon: './icon-192.png',
    badge: './icon-192.png',
    tag: d.tag || 'eltemps-avis',      // un avís del mateix tipus en reemplaça un altre
    renotify: true,
    data: { url: d.url || './' }
  };
  e.waitUntil(self.registration.showNotification(title, opts));
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const target = new URL(e.notification.data?.url || './', self.location.href).href;
  e.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of all) {
      // Si l'app ja és oberta, la portem al davant en comptes d'obrir-ne una altra
      if (c.url.startsWith(self.location.origin) && 'focus' in c) {
        try { await c.navigate(target); } catch {}
        return c.focus();
      }
    }
    if (self.clients.openWindow) return self.clients.openWindow(target);
  })());
});

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
        // Només es desa una resposta bona i del nostre origen. Sense aquesta comprovació,
        // una pàgina d'error (404/500) o la pantalla d'un portal captiu (wifi d'hotel)
        // es quedaria desada com a carcassa de l'app i es serviria offline.
        if (cacheable(net)) {
          const c = await caches.open(CACHE); c.put('./index.html', net.clone()); c.put('./', net.clone());
        }
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
      if (cacheable(r)) { const cp = r.clone(); caches.open(CACHE).then(c => c.put(req, cp)); }
      return r;
    }).catch(() => m))
  );
});
