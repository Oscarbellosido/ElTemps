#!/usr/bin/env node
/* ════════════════════════════════════════════════════════════════════════════
   El Temps — avisos al mòbil
   ════════════════════════════════════════════════════════════════════════════
   L'executa .github/workflows/avisos.yml un cop cada hora.

   Què fa: per cada telèfon donat d'alta al secret PUSH_SUBS, mira el temps del
   seu poble i, si hi ha calor forta o pluja a punt de caure, li envia un avís.
   El mòbil el mostra encara que l'app estigui tancada, i el rellotge (Wear OS)
   el repeteix al canell tot sol.

   PER QUÈ NO CAL RECORDAR QUÈ S'HA ENVIAT: no es desa cap estat enlloc. Perquè
   no arribin avisos repetits, cada regla només pot disparar en un moment concret:
     · La calor només s'avisa al matí (una vegada al dia, entre les 7 i les 9).
     · La pluja només s'avisa si encara NO plou; quan comença a ploure, la
       condició deixa de complir-se tota sola.
   ════════════════════════════════════════════════════════════════════════════ */
const webpush = require('web-push');

const VAPID_PUBLIC = process.env.VAPID_PUBLIC || '';
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY || '';
const SUBS_RAW = process.env.PUSH_SUBS || '';
/* Prova forçada des de la pestanya Actions. GitHub passa les caselles com a text. */
const PROVA = /^(true|1)$/i.test((process.env.PROVA || '').trim());
const SITE = 'https://oscarbellosido.github.io/ElTemps/';

/* Llindars. Si algun dia et sembla que avisa massa (o massa poc), es toquen aquí. */
const HEAT_MIN      = 35;   // graus a partir dels quals s'avisa de calor
const HEAT_DANGER   = 40;   // a partir d'aquí, avís més seriós
const RAIN_MIN_PROB = 60;   // % de probabilitat per avisar de pluja
const HEAT_HOURS    = [7, 8, 9];    // hores locals en què es pot avisar de calor
const RAIN_HOURS    = [7, 22];      // franja local en què es pot avisar de pluja

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
    + `&current=temperature_2m,apparent_temperature,precipitation,weather_code`
    + `&hourly=temperature_2m,apparent_temperature,precipitation_probability`
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

function linkFor(sub) {
  return `${SITE}?lat=${sub.lat}&lon=${sub.lon}&name=${encodeURIComponent(sub.name || '')}`;
}

/* Decideix si toca avisar. Torna null quan no hi ha res a dir. */
function buildMessage(fc, sub) {
  // Mode de prova: forçat des de la pestanya Actions marcant la casella "prova".
  // Serveix per comprovar que l'avís arriba al mòbil i al rellotge sense haver
  // d'esperar que faci calor de debò.
  if (PROVA) {
    const ara = fc.current?.temperature_2m;
    return {
      title: `🔔 Prova d'avís${sub.name ? ' · ' + sub.name : ''}`,
      body: `Si llegeixes això, els avisos funcionen.${ara != null ? ` Ara hi fa ${Math.round(ara)}°.` : ''}`,
      tag: 'prova',
      url: linkFor(sub)
    };
  }

  // L'hora local del poble surt de la mateixa resposta d'Open-Meteo (demanem
  // timezone=auto), no del rellotge del servidor: així val igual on s'executi.
  const localHour = parseInt(fc.current.time.slice(11, 13), 10);
  const where = sub.name ? ` a ${sub.name}` : '';

  const heat = heatPeak(fc);
  if (heat && HEAT_HOURS.includes(localHour)) {
    return {
      title: `${heat.danger ? '🥵' : '⚠️'} ${heat.danger ? 'Calor perillosa' : 'Calor extrema'}${where}`,
      body: heat.danger
        ? `Avui s'arribarà als ${Math.round(heat.v)}° cap a les ${heat.hour}h. Evita sortir entre les 12h i les 17h i beu aigua sovint.`
        : `Avui s'arribarà als ${Math.round(heat.v)}° cap a les ${heat.hour}h. Beu aigua i busca l'ombra a les hores centrals.`,
      tag: 'calor',
      url: linkFor(sub)
    };
  }

  const rain = rainSoon(fc);
  if (rain && localHour >= RAIN_HOURS[0] && localHour < RAIN_HOURS[1]) {
    return {
      title: `🌧️ Pluja${where}`,
      body: rain.hour != null
        ? `Es preveu pluja cap a les ${rain.hour}h (${rain.prob}% de probabilitat).`
        : `Es preveu pluja aviat (${rain.prob}% de probabilitat).`,
      tag: 'pluja',
      url: linkFor(sub)
    };
  }

  return null;
}

async function main() {
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
      const msg = buildMessage(fc, sub);
      if (!msg) { log(`· ${who}: res a avisar.`); quiet++; continue; }
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: sub.keys },
        JSON.stringify(msg)
      );
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
  // No es falla la tasca per un avís no entregat: no volem correus d'error cada hora.
}

main().catch(e => { console.error('Error inesperat:', e); process.exit(1); });
