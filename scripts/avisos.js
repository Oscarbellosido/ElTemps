#!/usr/bin/env node
/* ════════════════════════════════════════════════════════════════════════════
   El Temps — avisos al mòbil
   ════════════════════════════════════════════════════════════════════════════
   L'executa .github/workflows/avisos.yml cada 15 minuts (el "despertador" de
   Cloudflare, scripts/despertador-avisos.js) i, de reserva, la programació
   horària de GitHub, que en realitat només arriba a passar unes 5 vegades al dia.

   Què fa: per cada telèfon donat d'alta al secret PUSH_SUBS, mira el temps del
   seu poble i, si hi ha calor forta, tempesta elèctrica, pluja o vent fort a
   punt d'arribar, li envia un avís. El mòbil el mostra encara que l'app estigui
   tancada, i el rellotge (Wear OS) el repeteix al canell tot sol.

   COM S'EVITEN ELS AVISOS REPETITS: com que passa tan sovint, cal recordar què
   s'ha enviat. Es desa en un fitxer petit (ESTAT, per defecte estat-avisos.json)
   que el workflow guarda a la memòria cau d'Actions entre una passada i l'altra:
     · La calor s'avisa un sol cop al dia, el primer cop que passa entre les 7 i
       les 12 (abans, si GitHub no passava entre les 7 i les 9, no avisava).
     · La tempesta, la pluja i el vent fort només s'avisen si encara NO hi són i
       no se n'ha avisat en les últimes COOLDOWN_H hores. Si s'acaba d'avisar
       d'una tempesta, la pluja no s'avisa a part (ja ve amb la tempesta).
   El fitxer no porta ni noms ni adreces dels telèfons: només un resum (hash) de
   cada subscripció i quan se li ha enviat cada tipus d'avís. Si es perd, l'únic
   que passa és que un avís es pot repetir una vegada.
   ════════════════════════════════════════════════════════════════════════════ */
const fs = require('fs');
const crypto = require('crypto');
const webpush = require('web-push');

const VAPID_PUBLIC = process.env.VAPID_PUBLIC || '';
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY || '';
const SUBS_RAW = process.env.PUSH_SUBS || '';
/* Prova forçada des de la pestanya Actions. GitHub passa les caselles com a text. */
const PROVA = /^(true|1)$/i.test((process.env.PROVA || '').trim());
const SITE = 'https://oscarbellosido.github.io/ElTemps/';
const ESTAT = process.env.ESTAT || 'estat-avisos.json';

/* Llindars. Si algun dia et sembla que avisa massa (o massa poc), es toquen aquí. */
const HEAT_MIN      = 35;   // graus a partir dels quals s'avisa de calor
const HEAT_DANGER   = 40;   // a partir d'aquí, avís més seriós
const RAIN_MIN_PROB = 60;   // % de probabilitat per avisar de pluja
const WIND_GUST_MIN  = 50;  // ratxes (km/h) a partir de les quals s'avisa de vent (rèplica d'index.html)
const WIND_SPEED_MIN = 35;  // vent mitjà (km/h) a partir del qual s'avisa (rèplica d'index.html)
const STORM_CODES    = [95, 96, 99];  // codis WMO de tempesta (mateixos que la taula WMO d'index.html)
const HEAT_HOURS    = [7, 12];      // franja local en què es pot avisar de calor (un cop al dia)
const STORM_HOURS   = [7, 22];      // franja local en què es pot avisar de tempesta
const RAIN_HOURS    = [7, 22];      // franja local en què es pot avisar de pluja
const WIND_HOURS    = [7, 22];      // franja local en què es pot avisar de vent (igual que la pluja)
const COOLDOWN_H    = 3;            // hores sense repetir un avís de tempesta, pluja o vent

function log(...a) { console.log(...a); }

/* Accepta tant una llista [{...},{...}] com un sol telèfon {...}, i també un
   text amb salts de línia entremig: així no falla per un detall en enganxar-ho. */
function parseSubs(raw) {
  const t = raw.trim();
  if (!t) return [];
  let v;
  try { v = JSON.parse(t); }
  catch (e) { throw new Error('El secret PUSH_SUBS no és un JSON vàlid: ' + e.message); }
  const arr = Array.isArray(v) ? v : [v];
  return arr.filter(s => s && s.endpoint && s.keys && s.keys.p256dh && s.keys.auth);
}

async function forecast(lat, lon) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}`
    + `&current=temperature_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,wind_gusts_10m`
    + `&hourly=temperature_2m,apparent_temperature,precipitation_probability,weather_code,wind_speed_10m,wind_gusts_10m,wind_direction_10m`
    + `&timezone=auto&forecast_days=2`;
  const r = await fetch(url, { signal: AbortSignal.timeout(20000) });
  if (!r.ok) throw new Error('Open-Meteo ha respost ' + r.status);
  return r.json();
}

/* Índex de l'hora actual dins la llista horària (mateixa idea que a l'app). */
function nowIndex(fc) {
  const h = fc.hourly, c = fc.current;
  if (!h?.time || !c?.time) return -1;
  const key = c.time.slice(0, 13);
  const i = h.time.findIndex(t => t.slice(0, 13) === key);
  return i < 0 ? 0 : i;
}

/* Pic de calor de les properes 24 h. Rèplica de heatPeak() de index.html: si es
   canvia un llindar en un lloc, s'ha de canviar a l'altre perquè l'avís i el que
   es veu a la pantalla diguin el mateix. */
function heatPeak(fc) {
  const h = fc.hourly, s = nowIndex(fc);
  if (s < 0) return null;
  const end = Math.min(s + 24, h.time.length);
  let best = null;
  for (let i = s; i < end; i++) {
    const ap = h.apparent_temperature?.[i], te = h.temperature_2m?.[i];
    if (ap == null && te == null) continue;
    const v = Math.max(ap ?? -99, te ?? -99);
    if (!best || v > best.v) best = { v, i };
  }
  if (!best || best.v < HEAT_MIN) return null;
  // L'hora surt del text tal com el dona Open-Meteo (ja és local del lloc);
  // no es passa per new Date() perquè això la reinterpretaria en un altre fus.
  return { v: best.v, hour: parseInt(h.time[best.i].slice(11, 13), 10), danger: best.v >= HEAT_DANGER };
}

/* Pluja a punt de caure: les properes 2 h, i només si ara encara no plou. */
function rainSoon(fc) {
  const h = fc.hourly, c = fc.current, s = nowIndex(fc);
  if (s < 0) return null;
  if ((c.precipitation ?? 0) > 0) return null;          // ja plou: no cal avisar
  let best = 0, at = null;
  for (let i = s; i < Math.min(s + 3, h.time.length); i++) {
    const p = h.precipitation_probability?.[i] ?? 0;
    if (p > best) { best = p; at = h.time[i]; }
  }
  if (best < RAIN_MIN_PROB) return null;
  return { prob: best, hour: at ? parseInt(at.slice(11, 13), 10) : null };
}

/* Vent fort a punt d'arribar: les properes 3 h, i només si ara encara no en fa
   (mateix criteri que rainSoon: quan comença, la condició deixa de complir-se sola). */
function windSoon(fc) {
  const h = fc.hourly, c = fc.current, s = nowIndex(fc);
  if (s < 0) return null;
  if ((c.wind_gusts_10m ?? 0) >= WIND_GUST_MIN) return null;   // ja fa vent fort: no cal avisar
  let best = null;
  for (let i = s; i < Math.min(s + 3, h.time.length); i++) {
    const gust = h.wind_gusts_10m?.[i] ?? 0, speed = h.wind_speed_10m?.[i] ?? 0;
    if (gust < WIND_GUST_MIN && speed < WIND_SPEED_MIN) continue;
    if (!best || gust > best.gust) {
      best = { gust, dir: h.wind_direction_10m?.[i] ?? 0, hour: parseInt(h.time[i].slice(11, 13), 10) };
    }
  }
  return best;
}

/* Tempesta elèctrica a punt d'arribar: les properes 3 h, i només si ara encara
   no hi som (mateix criteri que rainSoon/windSoon). */
function stormSoon(fc) {
  const h = fc.hourly, c = fc.current, s = nowIndex(fc);
  if (s < 0) return null;
  if (STORM_CODES.includes(c.weather_code)) return null;   // ja hi som: no cal avisar
  for (let i = s; i < Math.min(s + 3, h.time.length); i++) {
    if (STORM_CODES.includes(h.weather_code?.[i])) {
      return { hour: parseInt(h.time[i].slice(11, 13), 10) };
    }
  }
  return null;
}

/* Rosa dels vents catalana. Rèplica de windName() de index.html: si en canvies
   una, canvia l'altra, o l'avís i la pantalla diran noms diferents. */
function windName(deg) {
  const names = ['Tramuntana', 'Gregal', 'Llevant', 'Xaloc', 'Migjorn', 'Garbí', 'Ponent', 'Mestral'];
  return names[Math.round(deg / 45) % 8];
}

function linkFor(sub) {
  return `${SITE}?lat=${sub.lat}&lon=${sub.lon}&name=${encodeURIComponent(sub.name || '')}`;
}

/* Ja s'ha avisat d'això fa menys de COOLDOWN_H hores? `sent` és el que recordem
   d'aquest telèfon: { calor:'AAAA-MM-DD', tempesta:ms, pluja:ms, vent:ms }. */
function recent(sent, tag, nowMs) {
  const t = sent?.[tag];
  return typeof t === 'number' && nowMs - t < COOLDOWN_H * 3600e3;
}
const inHours = (h, [from, to]) => h >= from && h < to;

/* Decideix si toca avisar. Torna null quan no hi ha res a dir.
   `sent` (opcional) és el que ja s'ha enviat a aquest telèfon; sense, no es filtra res. */
function buildMessage(fc, sub, sent = {}, nowMs = Date.now()) {
  // Mode de prova: forçat des de la pestanya Actions marcant la casella "prova".
  // Serveix per comprovar que l'avís arriba al mòbil i al rellotge sense haver
  // d'esperar que faci calor de debò.
  if (PROVA) {
    const ara = fc.current?.temperature_2m;
    return {
      title: `🔔 Prova d'avís${sub.name ? ' · ' + sub.name : ''}`,
      body: `Si llegeixes això, els avisos funcionen.${ara != null ? ` Ara hi fa ${Math.round(ara)}°.` : ''}`,
      // Etiqueta diferent a cada prova. Amb una de fixa, si l'avís anterior encara
      // era a la safata del mòbil, el nou el substituïa en silenci i el rellotge no
      // tornava a vibrar. Als avisos de debò sí que interessa reemplaçar (tag fix).
      tag: 'prova-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7),
      url: linkFor(sub)
    };
  }

  // L'hora local del poble surt de la mateixa resposta d'Open-Meteo (demanem
  // timezone=auto), no del rellotge del servidor: així val igual on s'executi.
  const localHour = parseInt(fc.current.time.slice(11, 13), 10);
  const where = sub.name ? ` a ${sub.name}` : '';

  const today = fc.current.time.slice(0, 10);   // data local, del text d'Open-Meteo

  const heat = heatPeak(fc);
  if (heat && inHours(localHour, HEAT_HOURS) && sent.calor !== today) {
    return {
      title: `${heat.danger ? '🥵' : '⚠️'} ${heat.danger ? 'Calor perillosa' : 'Calor extrema'}${where}`,
      body: heat.danger
        ? `Avui s'arribarà als ${Math.round(heat.v)}° cap a les ${heat.hour}h. Evita sortir entre les 12h i les 17h i beu aigua sovint.`
        : `Avui s'arribarà als ${Math.round(heat.v)}° cap a les ${heat.hour}h. Beu aigua i busca l'ombra a les hores centrals.`,
      tag: 'calor',
      url: linkFor(sub)
    };
  }

  const storm = stormSoon(fc);
  if (storm && inHours(localHour, STORM_HOURS) && !recent(sent, 'tempesta', nowMs)) {
    return {
      title: `⛈️ Tempesta elèctrica${where}`,
      body: `Es preveu tempesta cap a les ${storm.hour}h. Si ets fora, busca aixopluc.`,
      tag: 'tempesta',
      url: linkFor(sub)
    };
  }

  const rain = rainSoon(fc);
  if (rain && inHours(localHour, RAIN_HOURS) && !recent(sent, 'pluja', nowMs) && !recent(sent, 'tempesta', nowMs)) {
    return {
      title: `🌧️ Pluja${where}`,
      body: rain.hour != null
        ? `Es preveu pluja cap a les ${rain.hour}h (${rain.prob}% de probabilitat).`
        : `Es preveu pluja aviat (${rain.prob}% de probabilitat).`,
      tag: 'pluja',
      url: linkFor(sub)
    };
  }

  const wind = windSoon(fc);
  if (wind && inHours(localHour, WIND_HOURS) && !recent(sent, 'vent', nowMs)) {
    return {
      title: `💨 Vent fort${where}`,
      body: `Cap a les ${wind.hour}h bufarà ${windName(wind.dir)}, amb ratxes de fins a ${Math.round(wind.gust)} km/h.`,
      tag: 'vent',
      url: linkFor(sub)
    };
  }

  return null;
}

/* ── Memòria del que s'ha enviat ─────────────────────────────────────────────── */
function subKey(sub) {
  return crypto.createHash('sha256').update(sub.endpoint).digest('hex').slice(0, 16);
}
function loadState() {
  try {
    const j = JSON.parse(fs.readFileSync(ESTAT, 'utf8'));
    return (j && typeof j.s === 'object' && j.s) || {};
  } catch { return {}; }   // primer cop, o fitxer perdut: es comença de zero
}
function saveState(state) {
  // Fora el que ja no pot fer de res (més de 3 dies) perquè el fitxer no creixi.
  const lim = Date.now() - 3 * 864e5, limDia = new Date(lim).toISOString().slice(0, 10);
  for (const k of Object.keys(state)) {
    const e = state[k];
    for (const t of Object.keys(e)) {
      if (typeof e[t] === 'number' ? e[t] < lim : String(e[t]) < limDia) delete e[t];
    }
    if (!Object.keys(e).length) delete state[k];
  }
  try { fs.writeFileSync(ESTAT, JSON.stringify({ v: 1, s: state })); }
  catch (e) { log('No s\'ha pogut desar què s\'ha enviat: ' + e.message); }
}

async function main() {
  const state = loadState();
  try { await run(state); }
  finally { saveState(state); }   // sempre, perquè el workflow el pugui guardar
}

async function run(state) {
  if (!VAPID_PRIVATE) { log('Falta el secret VAPID_PRIVATE_KEY. No es fa res.'); return; }
  if (!SUBS_RAW)      { log('Falta el secret PUSH_SUBS: encara no hi ha cap telèfon donat d\'alta. No es fa res.'); return; }

  const subs = parseSubs(SUBS_RAW);
  if (!subs.length) { log('PUSH_SUBS no conté cap telèfon vàlid.'); return; }
  webpush.setVapidDetails('https://github.com/Oscarbellosido/ElTemps', VAPID_PUBLIC, VAPID_PRIVATE);
  log(`${subs.length} telèfon(s) donats d'alta.`);

  let sent = 0, quiet = 0, failed = 0;
  for (const sub of subs) {
    const who = sub.name || sub.endpoint.slice(-12);
    try {
      const fc = await forecast(sub.lat, sub.lon);
      const key = subKey(sub), mem = state[key] || {};
      const msg = buildMessage(fc, sub, mem);
      if (!msg) { log(`· ${who}: res a avisar.`); quiet++; continue; }
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: sub.keys },
        JSON.stringify(msg)
      );
      // Només es recorda un cop enviat de debò (i les proves no compten).
      if (!PROVA) {
        mem[msg.tag] = msg.tag === 'calor' ? fc.current.time.slice(0, 10) : Date.now();
        state[key] = mem;
      }
      log(`✓ ${who}: enviat → ${msg.title} — ${msg.body}`);
      sent++;
    } catch (e) {
      failed++;
      const code = e?.statusCode;
      if (code === 404 || code === 410) {
        log(`✗ ${who}: la subscripció ja no val (${code}). Torna a prémer "Avisa'm" a l'app i actualitza el secret PUSH_SUBS.`);
      } else {
        log(`✗ ${who}: ${e?.message || e}${code ? ' (codi ' + code + ')' : ''}`);
      }
    }
  }
  log(`Resum: ${sent} enviat(s), ${quiet} sense novetat, ${failed} amb error.`);
  // No es falla la tasca per un avís no entregat: no volem correus d'error a cada passada.
}

// require.main !== module quan es carrega des d'una prova (p.ex. `require('./avisos.js')`)
// en lloc d'executar-se directament amb `node scripts/avisos.js`: així no s'envien avisos
// de debò només per haver-lo carregat per provar buildMessage() o windSoon() soles.
if (require.main === module) {
  main().catch(e => { console.error('Error inesperat:', e); process.exit(1); });
}

module.exports = { buildMessage, heatPeak, rainSoon, windSoon, stormSoon, windName, nowIndex };
