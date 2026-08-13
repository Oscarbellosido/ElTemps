# 🌤️ El Temps — predicció meteorològica multi-model

Aplicació web d'una sola pàgina (igual que **FindBtc**) que mostra el temps de qualsevol lloc
del món, amb especial atenció a Catalunya, fent **consens de diversos models meteorològics**
per donar una predicció més fiable.

- **🌐 App en línia:** https://oscarbellosido.github.io/ElTemps/
- **📦 Repositori:** https://github.com/Oscarbellosido/ElTemps
- **🗂️ Fitxer principal:** `index.html` (tot —HTML, CSS i JavaScript— en un sol fitxer)

---

## 🧩 Estructura

Tot el codi és dins de **`index.html`**. No cal cap servidor, ni compilar res, ni instal·lar
dependències. Per provar-ho en local només cal obrir el fitxer amb el navegador (doble clic).

```
Temps/
├── index.html      ← l'aplicació sencera (edita aquí)
├── manifest.json   ← configuració PWA (instal·lable al mòbil)
├── sw.js           ← service worker (offline + instal·lació)
├── icon.svg        ← icona de l'app (vectorial)
├── icon-192.png    ← icona PWA 192px
├── icon-512.png    ← icona PWA 512px (i maskable)
├── README.md       ← aquest document
└── .gitignore
```

Dins de `index.html` hi ha tres parts clarament separades:
1. **`<style>`** — colors, tema clar/fosc i disseny.
2. **HTML** del cos — la barra de cerca i els contenidors.
3. **`<script>`** — tota la lògica (crides a les APIs i pintat dels resultats).

---

## 🚀 Com afegir coses i publicar

> ⚡ **Important:** cada vegada que es fa un *commit* a la branca `main`, **GitHub Pages
> torna a publicar l'app automàticament** en 1–2 minuts. No cal fer res més.

### Opció A — Des d'Android o des del despatx, SENSE instal·lar res (recomanat) 📱

La manera més fàcil quan no estàs al teu ordinador habitual:

1. Obre el repo al navegador: https://github.com/Oscarbellosido/ElTemps
2. Entra a **`index.html`** i prem el llapis ✏️ (*Edit this file*).
   - 💡 Truc: a la pàgina del repo, prem la tecla **`.`** (punt) per obrir l'editor complet
     **github.dev** dins el navegador (funciona també a Android amb teclat).
3. Fes els canvis.
4. Baixa fins a **Commit changes**, posa un títol curt i prem **Commit**.
5. Espera 1–2 min i recarrega https://oscarbellosido.github.io/ElTemps/ ✅

> Amb l'app **GitHub** per a Android també pots editar fitxers i fer commit igual.

### Opció B — Des d'un ordinador amb git (despatx) 💻

```bash
# 1. Clonar (només el primer cop)
git clone https://github.com/Oscarbellosido/ElTemps.git
cd ElTemps

# 2. Baixar els últims canvis (sempre abans de començar)
git pull

# 3. ...editar index.html...

# 4. Publicar
git add index.html
git commit -m "Descripció del canvi"
git push
```

> ⚠️ **Autenticació:** la primera vegada que facis `push`, git et demanarà usuari i
> contrasenya de GitHub. Com a contrasenya cal posar un **Personal Access Token**
> (Settings → Developer settings → Tokens). El token antic s'ha de revocar per seguretat.

> 🔄 **Treballar des de dos llocs (casa + despatx):** fes **sempre `git pull` abans
> d'editar** i `git push` en acabar, per no perdre canvis ni crear conflictes.

---

## 🛰️ D'on surten les dades (APIs)

Tot ve d'**[Open-Meteo](https://open-meteo.com)** — gratuït i sense clau d'API:

| Què | Endpoint |
|-----|----------|
| Predicció (actual + horària + 7 dies) | `api.open-meteo.com/v1/forecast` |
| Consens multi-model | mateix endpoint amb `&models=...` |
| Qualitat de l'aire | `air-quality-api.open-meteo.com/v1/air-quality` |
| Cerca de poblacions | `geocoding-api.open-meteo.com/v1/search` |
| Avisos oficials | `feeds.meteoalarm.org` (via proxy Cloudflare `mecai`) |

**Avisos oficials:** es llegeix el feed de Meteoalarm del país i es filtra per província
(camp `admin2` d'Open-Meteo), mostrant només avisos de nivell **groc o superior** vigents
ara. Com que Meteoalarm bloqueja el CORS, es passa pel **worker de Cloudflare `mecai`**
(`https://mecai.oscarbellosido.workers.dev/?action=rss&url=…`), el mateix proxy que fa servir
el projecte **Noticies**. Per editar el worker: fitxer `mecai_worker.js` a la carpeta de Noticies.

**Models usats al consens** (variable `MODELS` dins l'script):
ECMWF · ICON (DWD) · AROME (Météo-France) · GFS (NOAA) · GEM (Canadà) · UKMO · JMA.

---

## ✨ Funcions actuals

- [x] **Mode família** 😜 (botó, actiu per defecte): missatge divertit a dalt de tot segons el temps (calor, fred, pluja, tempesta, vent…), amb frases que van rotant
- [x] Temps actual: temperatura, sensació, vent + ratxes + direcció, humitat, pressió, núvols, UV, sortida/posta de sol
- [x] Probabilitat de pluja destacada
- [x] Predicció horària (24 h) i diària (7 dies)
- [x] **Avisos oficials** (Meteoalarm/AEMET) per província, només nivell groc o superior i actius ara — via proxy Cloudflare (worker `mecai`, compartit amb Noticies)
- [x] **Resum del dia** en llenguatge planer a dalt de tot (en entrar i en triar ciutat): condicions, màx/mín, quan plourà, vent, sensació amb humitat, nivell de contaminació, i avisos (UV, calor, fred, fiabilitat dels models)
- [x] **Consens multi-model** amb indicador de fiabilitat segons l'acord entre models
- [x] **Gràfic horari** (corba de temperatura + barres de pluja) a "Pròximes 24 hores"
- [x] Qualitat de l'aire (EAQI, PM2.5, PM10, NO₂, O₃) **+ pol·len** (gramínies, olivera, bedoll…)
- [x] **Mar i muntanya**: onatge i temperatura del mar (litoral) + cota de glaçada i neu (muntanya)
- [x] **Radar de pluja** (mapa Leaflet + capes de RainViewer)
- [x] Cerca mundial amb autocompletar (català/castellà) + geolocalització
- [x] Accés ràpid a ciutats catalanes + **favorits** + històric de cerques recents
- [x] **Compartir** (Web Share) amb enllaços directes (`?lat=&lon=&name=`)
- [x] **Frescor de dades**: refresc automàtic cada 10 min, "actualitzat fa X min" i número de versió visible
- [x] Tema clar/fosc + disseny responsive per a mòbil
- [x] **PWA instal·lable** a Android/escriptori (manifest + service worker + icones PNG): botó "Instal·la l'aplicació", funciona offline (la carcassa) i s'actualitza sola

---

## 💡 Idees per afegir (TODO)

Coses que es poden incorporar més endavant:

- [ ] **Notificacions** quan es preveu pluja a les pròximes hores (mentre la pestanya és oberta)
- [ ] **Més dies de consens** (no només 3) i afegir-hi més models si Open-Meteo en treu de nous
- [ ] **Comparació de llocs** (veure dos pobles alhora)
- [ ] **Idioma anglès** a part del català/castellà

> Quan afegeixis una funció nova, marca-la aquí amb `[x]` i mou-la a "Funcions actuals".

---

## 🔔 Avisos al mòbil (i al rellotge)

L'app pot avisar-te al telèfon quan es prevegi **calor forta** o **pluja a punt de caure**,
encara que la tinguis tancada. Si tens un rellotge Wear OS o Galaxy Watch, l'avís hi arriba
sol: el rellotge repeteix les notificacions del mòbil, no cal cap app de rellotge.

### Com s'activa (un sol cop per telèfon)

1. Obre l'app, tria la població i prem **🔔 Avisa'm**.
2. Accepta el permís de notificacions.
3. Surt un quadre amb un text: copia'l.
4. Ves a **Settings → Secrets and variables → Actions** del repositori, prem
   **New repository secret**, posa-li de nom `PUSH_SUBS` i enganxa-hi el text.

Per donar d'alta un segon telèfon, repeteix-ho i afegeix el nou bloc dins del mateix
secret, separat per una coma.

### Com funciona per dins

| Peça | Què fa |
|---|---|
| Botó **🔔 Avisa'm** a `index.html` | Demana permís i crea la subscripció del telèfon |
| `sw.js` (esdeveniment `push`) | Rep l'avís i el mostra com a notificació del sistema |
| `.github/workflows/avisos.yml` | Cada hora engega la comprovació (i es pot llançar a mà) |
| `scripts/avisos.js` | Mira el temps de cada telèfon i decideix si cal avisar |

**Secrets que fa servir** (a *Settings → Secrets and variables → Actions*):

- `VAPID_PRIVATE_KEY` — la clau privada que signa els avisos. **No ha d'anar mai al codi.**
- `PUSH_SUBS` — els telèfons donats d'alta.

La clau **pública** sí que és al codi (a `index.html` i al workflow): és pública a propòsit.

### Quan avisa i quan calla

Per no rebre l'avís repetit cada hora, **no es desa enlloc què s'ha enviat**. En comptes
d'això, cada regla només pot disparar en un moment concret:

- **Calor** (pic ≥ 35°, o ≥ 40° per a l'avís seriós): només entre les **7 i les 9 del matí**,
  o sigui un cop al dia.
- **Pluja** (≥ 60% de probabilitat en les properes 2 h): només **si encara no plou** — quan
  comença, la condició deixa de complir-se sola — i només entre les **7 i les 22 h**.

Els llindars són al principi de `scripts/avisos.js`, ben visibles, per si algun dia et
sembla que avisa massa o massa poc.

> ⚠️ Els criteris de calor de `scripts/avisos.js` són una còpia de `heatPeak()` de
> `index.html`. Si en canvies un, canvia l'altre, o l'avís i la pantalla diran coses diferents.

### Que no es desactivi sola

GitHub apaga les tasques programades quan un repositori passa **60 dies sense cap canvi**.
Si passés, deixaries de rebre avisos sense adonar-te'n. Per evitar-ho hi ha
`.github/workflows/mantenir-viu.yml`, que cada dilluns mira quant fa de l'últim canvi:

- **menys de 50 dies** → no fa res (el cas normal: no embruta l'historial)
- **50 dies o més** → fa un commit buit, que reinicia el compte enrere

Actua als 50 i no als 59 per tenir marge, perquè les tasques programades de GitHub es
retarden. És l'única tasca del repositori amb permís d'escriptura, i només per això.

### Provar-ho sense esperar

A la pestanya **Actions → Avisos del temps → Run workflow** es llança a l'instant. Si a
més marques la casella **prova**, s'envia un avís de mentida encara que no faci calor ni
hagi de ploure: serveix per comprovar que arriba al mòbil i al rellotge.

El registre de l'execució diu, per a cada telèfon, si s'ha enviat res i, si ha fallat, per què:

```
1 telèfon(s) donats d'alta.
· Taradell: res a avisar.
Resum: 0 enviat(s), 1 sense novetat, 0 amb error.
```

Si surt `res a avisar` no és cap error: vol dir que ha mirat el temps i no hi havia
res prou destacable, o que era fora de la franja horària de la regla.

## 🔒 Seguretat (llegeix-ho abans d'editar `index.html`)

- Hi ha una **Content-Security-Policy** a la capçalera de `index.html`. Limita a quins servidors
  es pot connectar l'app. **Si algun dia afegeixes una API nova, has d'afegir el seu domini al
  `connect-src`** (i si és una imatge, a l'`img-src`), o el navegador la bloquejarà en silenci.
  Per la mateixa raó no es poden carregar llibreries des d'un CDN: s'han de posar a `vendor/`.
- **Tot el text que ve de fora** (nom de la població, resposta d'una API, avisos de Meteoalarm,
  paràmetres de la URL) ha de passar per **`esc()`** abans d'inserir-lo amb `innerHTML`.
  Sense això, un nom de lloc amb codi HTML s'executaria al navegador.
- Les **coordenades del GPS** s'arrodoneixen amb `coarse()` (~100 m) abans d'enviar-les a la
  geocodificació inversa. No cal més precisió i així no surt la posició exacta del dispositiu.
- ⚠️ **El mode família (`FAMILY`, `BIRTHDAYS`, `EVENTS`) és públic.** Aquest repo és obert i
  `index.html` es publica sencer: tothom pot llegir el que hi posis. Regla: **només noms de
  pila**. Res de cognoms, adreces, telèfons, anys de naixement ni frases com "a casa d'en …".
  Les coordenades han de ser les del poble, mai les d'una casa. Si algun dia hi vols posar
  dades de debò, s'han de xifrar — no n'hi ha prou d'amagar-les.

## 📝 Notes

- L'app no guarda res en cap servidor: les cerques recents i el tema es desen al navegador
  (`localStorage`), per dispositiu.
- La predicció és **orientativa**. El valor afegit és el **consens**: quan molts models
  coincideixen, més confiança; quan discrepen, més incertesa.
- Nom: s'ha evitat "Meteocat" a propòsit perquè és la marca del servei oficial de la Generalitat.
