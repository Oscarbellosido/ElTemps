/* ════════════════════════════════════════════════════════════════════════════
   El Temps — despertador dels avisos (Cloudflare Worker)
   ════════════════════════════════════════════════════════════════════════════
   NO s'executa a GitHub ni al navegador: aquest codi s'enganxa en un Worker de
   Cloudflare (el mateix compte on hi ha el proxy "mecai").

   Per què cal: la tasca d'avisos (.github/workflows/avisos.yml) estava programada
   "cada hora", però GitHub endarrereix i se salta les tasques programades i a la
   pràctica només passava unes 5 vegades al dia. Un avís de pluja "en les properes
   2 hores" arribava tard o no arribava. Cloudflare sí que és puntual: cada 15
   minuts aquest Worker demana a GitHub que llanci la tasca ara mateix
   (workflow_dispatch), i això GitHub no ho endarrereix.

   Muntatge (un sol cop; els passos detallats són al README, "Que arribin a temps"):
     1. GitHub → token "fine-grained" només per a ElTemps, amb permís
        Actions: Read and write. Res més.
     2. Cloudflare → Workers → crear un Worker nou i enganxar-hi aquest codi.
     3. Al Worker → Settings → Variables and Secrets → secret GH_TOKEN = el token.
     4. Al Worker → Settings → Triggers → Cron Triggers → afegir el que diu CRON,
        aquí sota (cada 15 minuts).

   Seguretat: el token només viu com a secret al Worker, mai en aquest fitxer. Visitar
   l'adreça del Worker no llança res: només ho fa el rellotge de Cloudflare.
   ════════════════════════════════════════════════════════════════════════════ */
const CRON = '*/15 * * * *';   // només de referència: el cron es posa al tauler de Cloudflare
const WORKFLOW = 'https://api.github.com/repos/Oscarbellosido/ElTemps/actions/workflows/avisos.yml/dispatches';

async function desperta(env) {
  if (!env.GH_TOKEN) { console.log('Falta el secret GH_TOKEN.'); return; }
  const r = await fetch(WORKFLOW, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.GH_TOKEN}`,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'eltemps-despertador'          // GitHub el demana a totes les peticions
    },
    body: JSON.stringify({ ref: 'main' })
  });
  // 204 = d'acord. 401 = token caducat o mal copiat. 403/404 = al token li falta el permís.
  if (r.status !== 204) console.log(`GitHub ha respost ${r.status}: ${(await r.text()).slice(0, 300)}`);
}

export default {
  async scheduled(event, env, ctx) {
    ctx.waitUntil(desperta(env));
  },
  async fetch() {
    return new Response('El Temps · despertador dels avisos. Funciona sol cada 15 minuts.\n',
      { headers: { 'content-type': 'text/plain; charset=utf-8' } });
  }
};
