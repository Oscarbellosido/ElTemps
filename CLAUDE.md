# CLAUDE.md — guia del repositori per a assistents d'IA

Guia de treball per a Claude Code (i qualsevol altre assistent) sobre el projecte
**El Temps**. El `README.md` explica el projecte a l'usuari; aquest fitxer explica
**com s'hi treballa** i **què no s'hi pot trencar**.

---

## 1. Què és aquest projecte

Aplicació web meteorològica d'**una sola pàgina**, estàtica, publicada a GitHub Pages:

- **App:** https://oscarbellosido.github.io/ElTemps/
- **Repo:** https://github.com/Oscarbellosido/ElTemps
- Fa **consens de diversos models meteorològics** (ECMWF, ICON, AROME, GFS, GEM, UKMO, JMA)
  per donar una predicció amb indicador de fiabilitat.
- És una **PWA** instal·lable, amb notificacions push enviades des d'un workflow de GitHub Actions.

**No hi ha build, ni bundler, ni `package.json`, ni tests, ni dependències instal·lades.**
`index.html` conté HTML + CSS + JavaScript en un sol fitxer i s'obre directament al navegador.
No introdueixis un pas de compilació, un framework ni un gestor de paquets: la manca de
tooling és una decisió deliberada perquè el propietari pugui editar el fitxer des del mòbil
o des de l'editor web de GitHub.

---

## 2. Mapa de fitxers

```
ElTemps/
├── index.html               ← TOTA l'aplicació (~3.300 línies: <style> + HTML + <script>)
├── sw.js                    ← service worker: offline, instal·lació i notificacions push
├── manifest.json            ← manifest PWA (icones, nom, dreceres a 4 ciutats)
├── icon.svg / icon-192.png / icon-512.png
├── vendor/leaflet.js|.css   ← Leaflet allotjat al repo (mai CDN, vegeu §6)
├── scripts/avisos.js        ← Node: decideix i envia els avisos push (només s'executa a Actions)
├── .github/workflows/
│   ├── avisos.yml           ← cada hora: executa scripts/avisos.js
│   └── mantenir-viu.yml     ← cada dilluns: commit buit si fa ≥50 dies que no es toca el repo
├── README.md                ← documentació per a l'usuari (en català)
└── CLAUDE.md                ← aquest fitxer
```

`.gitignore` exclou `.claude/` i `*.txt`.

---

## 3. Estructura interna d'`index.html`

Tres blocs, en aquest ordre: `<style>` → marcatge del `<body>` → `<script>`.

El fitxer és llarg però està **dividit amb banderoles de comentari** del tipus
`/* ── Nom de la secció ─── */`. Per orientar-t'hi ràpid:

```bash
grep -n "── " index.html
```

Blocs principals del `<script>` (l'ordre a dins del fitxer):

| Bloc | Contingut |
|---|---|
| Configuració | claus de `localStorage`, `APP_VERSION`, `BUILD_DATE`, `VAPID_PUBLIC`, `WORKER_URL` |
| Taules de dades | `MA_COUNTRY`, `SEV`, `QUICK_CITIES`, `MODELS`, `WMO` |
| `wxFx` | efectes animats (canvas) sobre la targeta "Ara"; respecta `prefers-reduced-motion` |
| Helpers | `$`, `esc`, `coarse`, `r1`, `compass`, `showStatus` |
| Estat de l'usuari | tema, recents, favorits, compartir, avisos push, cache offline, frescor |
| Geocodificació | cerca amb autocompletar en català i castellà |
| `loadWeather()` | **punt d'entrada de tota càrrega de dades** |
| Avisos oficials | Meteoalarm via proxy Cloudflare |
| `render()` | compon tot el resultat concatenant els `renderXxx()` |
| Targetes | resum del dia, ara, horària, diària, mar i muntanya, aire, radar, consens, mesos vinents |
| Mesos vinents | estacional CFSv2, normal climàtica ERA5, risc d'incendi, crescudes GloFAS, El Niño |
| Radar | RainViewer + Leaflet + previsió de pluja del model a hores vista |
| Init | arrencada, paràmetres `?lat=&lon=&name=`, modal de benvinguda |
| Mode família | **actualment desactivat** (`funOn()` retorna sempre `false`) |

### Flux de dades (cal entendre'l abans de tocar res)

```
loadWeather(loc)
  └─ Promise.allSettled([fetchForecast, fetchModels, fetchAir, fetchMarine])
       └─ render(loc, fc, models, air, marine)      ← repinta #result SENCER
            ├─ scheduleRadar(loc)      ← IntersectionObserver: carrega Leaflet quan es veu
            ├─ scheduleOutlook(loc)    ← IntersectionObserver: ~350 KB, carrega quan es veu
            └─ loadAlerts(loc, gen)    ← asíncron, no bloqueja
```

Punts clau d'aquest flux:

- **`render()` reescriu `#result` sencer.** Qualsevol estat viu (mapa del radar, observers,
  timers, canvas) s'ha de reinicialitzar a cada render; per això `scheduleRadar` i
  `scheduleOutlook` es tornen a cridar sempre.
- **Comptador de generació.** `loadGen` (i `radarGen`) evita que una resposta lenta d'una
  ciutat s'enganxi a la pantalla d'una altra: després de cada `await` es comprova
  `if(gen!==loadGen) return;`. **Mantingues aquest patró** a qualsevol fetch nou.
- **Degradació elegant.** Només `fetchForecast` és obligatori; la resta pot fallar i l'app
  s'ha de veure igual. Si tot falla, es pinta la còpia de `OFFLINE_KEY`. El principi de tot
  el projecte —també del service worker— és **que mai es vegi una pantalla en blanc**.
- Tots els `fetch` porten `AbortSignal.timeout(...)`.

---

## 4. Flux de desenvolupament

### Provar els canvis

No hi ha servidor de desenvolupament ni tests. Per provar:

1. Obre `index.html` al navegador (doble clic o `file://`).
2. Per provar el **service worker o la PWA** cal `http://`, no `file://`:
   `python3 -m http.server 8000` i obre `http://localhost:8000/`.
3. Comprova la consola del navegador: no hi ha d'haver **cap error de CSP** ni excepcions.

**Abans de donar una feina per acabada, verifica com a mínim:** que carrega una ciutat de
`QUICK_CITIES`, que la cerca funciona, que el radar es pinta en baixar-hi, que el tema
clar/fosc no es trenca i que es veu bé en amplada de mòbil.

### Publicar

`git push` a `main` publica automàticament a GitHub Pages en 1–2 minuts. No hi ha cap
altre pas de desplegament.

⚠️ **En una sessió d'agent, desenvolupa i puja a la branca que t'hagin indicat, mai
directament a `main`,** tret que l'usuari ho demani explícitament.

### Ritual de versió (obligatori quan es toca `index.html` o `sw.js`)

Els usuaris tenen l'app instal·lada amb un service worker que cacheja la carcassa. Si no es
puja la versió, poden quedar-se amb la versió antiga. Sempre que facis un canvi visible:

1. `index.html`: puja `APP_VERSION` (semàntic: correcció → *patch*, funció nova → *minor*).
2. `index.html`: posa `BUILD_DATE` a la data d'avui (`AAAA-MM-DD`).
3. `sw.js`: incrementa `CACHE` (`'eltemps-v24'` → `'eltemps-v25'`). **Això és el que
   fa que els dispositius ja instal·lats agafin la versió nova.**

La versió es mostra al peu de la pàgina, així l'usuari pot comprovar què té carregat.

### Commits

Missatges **en català**, imperatius o descriptius, amb la versió entre parèntesis quan
n'hi ha: `El radar continua fins a 6 hores endavant (v1.6.0)`. El cos explica **per què**
es fa el canvi i quines conseqüències té, en llenguatge planer (el propietari no és
programador). Mira `git log` per calibrar el to.

Actualitza també el `README.md` quan un canvi afecti el que hi surt (llista de funcions,
taula d'APIs, instruccions). El README és per a l'usuari final, no per a desenvolupadors:
escriu-lo en llenguatge planer.

---

## 5. Idioma

**Tot és en català**: interfície, comentaris del codi, missatges de commit, README i les
descripcions dels workflows. Escriu-hi en català, amb accents i apòstrofs correctes. Els
noms d'identificadors del codi són majoritàriament en anglès (`loadWeather`, `renderDaily`)
amb alguns en català (`avisos.js`, `prova`); segueix el que ja hi ha al voltant.

---

## 6. Regles de seguretat (llegeix-les abans d'editar `index.html`)

Aquestes regles no són opcionals; el repositori és públic i l'app es publica sencera.

1. **Content-Security-Policy.** Hi ha una CSP a la capçalera d'`index.html`. Si afegeixes
   una **API nova, has d'afegir-ne el domini a `connect-src`**; si carrega imatges, a
   `img-src`. Si no, el navegador la bloqueja **en silenci**.
2. **Res de CDN.** La CSP no permet scripts externs. Les llibreries van a `vendor/`
   (com Leaflet) i s'afegeixen a la llista `SHELL` de `sw.js`.
3. **`esc()` sempre.** Qualsevol text que vingui de fora —nom de població, resposta d'una
   API, avisos de Meteoalarm, paràmetres de la URL— ha de passar per `esc()` abans
   d'inserir-lo amb `innerHTML`. Sense això, un topònim amb HTML s'executaria.
4. **`coarse()` per al GPS.** Les coordenades del dispositiu s'arrodoneixen a ~100 m abans
   d'enviar-les a cap servei extern.
5. **Validació d'URL de tercers.** El radar construeix URLs a partir de la resposta de
   RainViewer: `safeTileHost()` i `safeTilePath()` comproven que el host sigui de
   rainviewer.com per HTTPS i que el camí sigui normal. Mateix criteri per a fonts noves.
6. **Cap secret al codi.** `VAPID_PUBLIC` és pública a propòsit. La clau privada
   (`VAPID_PRIVATE_KEY`) i els telèfons donats d'alta (`PUSH_SUBS`) viuen als secrets del
   repositori i **no han d'aparèixer mai** al codi, als logs ni als commits.
7. **Dades personals.** `FAMILY`, `BIRTHDAYS` i `EVENTS` es publiquen tal qual.
   **Només noms de pila.** Res de cognoms, adreces, telèfons ni anys de naixement; les
   coordenades han de ser les del poble, mai les d'una casa.
8. **Permisos dels workflows.** `avisos.yml` té `contents: read`. L'únic amb permís
   d'escriptura és `mantenir-viu.yml`, i només per fer un commit buit. No ampliïs permisos.

**Nota sobre `onclick`:** tota la interactivitat va amb atributs `onclick` en línia, i per
això la CSP inclou `'unsafe-inline'` per als scripts. És coherent amb l'estil del fitxer;
si hi afegeixes controls, fes-ho igual (o migra-ho tot alhora, mai a mitges).

---

## 7. Origen de les dades

Tot d'**Open-Meteo** (gratuït, sense clau), més RainViewer per al radar:

| Què | Endpoint |
|---|---|
| Predicció actual/horària/7 dies | `api.open-meteo.com/v1/forecast` |
| Consens multi-model | mateix endpoint amb `&models=…` (constant `MODELS`) |
| Qualitat de l'aire i pol·len | `air-quality-api.open-meteo.com/v1/air-quality` |
| Mar (onatge, temperatura) | `marine-api.open-meteo.com/v1/marine` |
| Cerca de poblacions | `geocoding-api.open-meteo.com/v1/search` (ca + es en paral·lel) |
| Tendència estacional (CFSv2) | `seasonal-api.open-meteo.com/v1/seasonal` |
| Normal climàtica 1995-2024 (ERA5) | API d'arxiu d'Open-Meteo |
| Cabal de rius (GloFAS) | API d'inundacions d'Open-Meteo |
| Radar | `api.rainviewer.com/public/weather-maps.json` + tiles |
| Avisos oficials i índex ONI | `feeds.meteoalarm.org` / CPC, **via proxy Cloudflare** |

El **proxy Cloudflare** (`WORKER_URL` = `https://mecai.oscarbellosido.workers.dev`) és
necessari perquè Meteoalarm i el CPC bloquegen el CORS. El worker es comparteix amb un
altre projecte del propietari (Noticies) i **el seu codi no és en aquest repositori**.

Els blocs cars (mesos vinents, previsió del radar) es guarden a `localStorage` amb TTL
(`OUT_TTL`, `cacheGet`/`cacheSet`). Claus de `localStorage` en ús: `eltemps_recent`,
`eltemps_fav`, `eltemps_theme`, `eltemps_fun`, `eltemps_offline_v1`, `eltemps_welcomed`,
`eltemps_notif`, i les de cache `eltemps_seas_*`, `eltemps_normals_*`, `eltemps_river*`,
`eltemps_enso`, `eltemps_radarfc_*`.

---

## 8. Avisos push (notificacions al mòbil)

Peça per peça:

| Peça | Funció |
|---|---|
| Botó **🔔 Avisa'm** (`toggleNotif`) | crea la subscripció i mostra el text per enganxar al secret |
| Secret `PUSH_SUBS` | llista JSON de telèfons donats d'alta (nom, lat, lon, endpoint, keys) |
| Secret `VAPID_PRIVATE_KEY` | signa els enviaments |
| `.github/workflows/avisos.yml` | cada hora (i a mà, amb casella **prova**) |
| `scripts/avisos.js` | mira el temps de cada telèfon i decideix si cal avisar |
| `sw.js` (esdeveniment `push`) | mostra la notificació del sistema |

**No es desa cap estat d'enviament.** Per evitar repeticions, cada regla només pot disparar
en una finestra: la calor entre les 7 i les 9 hores locals (`HEAT_HOURS`), la pluja només
si encara no plou i entre les 7 i les 22 h (`RAIN_HOURS`). Si canvies aquesta lògica,
pensa primer com evites l'avís repetit cada hora.

⚠️ **Duplicació coneguda:** `heatPeak()` existeix a `index.html` **i** a `scripts/avisos.js`,
amb els mateixos llindars (35 °C / 40 °C). **Si en canvies un, canvia l'altre**, o l'avís i
la pantalla diran coses diferents. La resposta d'Open-Meteo es demana amb `timezone=auto` i
l'hora local es llegeix del **text** de la resposta (`.slice(11,13)`), mai amb `new Date()`,
perquè el runner d'Actions va en UTC.

El botó 🔔 **mai dona de baixa** el telèfon: només ensenya el text. Donar-se de baixa és una
acció explícita dins el diàleg (`disableNotif`). Això es va corregir a la v1.5.1 i no s'ha
de revertir.

---

## 9. Paranys i decisions que no s'han de desfer

- **Mode família desactivat.** `funOn()` retorna `false` i el botó 😜 ja no hi és (v1.4.2).
  El codi es conserva a propòsit per si es vol tornar a engegar. No el reactivis pel teu
  compte ni l'esborris.
- **Leaflet és de càrrega tardana** (`loadLeaflet`): ~160 KB que només es baixen quan el
  radar entra en pantalla. No el posis al `<head>`.
- **Els fotogrames de previsió del radar no són radar.** Van marcats amb ◈ i etiquetats amb
  l'hora del model. Aquesta distinció és intencionada; no la barregis amb les imatges reals.
- **`visibilitychange` i `pageshow`** comproven `lastLoadTime > 0` per no disparar un segon
  fetch durant l'arrencada freda (provocava una pantalla buida). No treguis la comprovació.
- **El service worker no cacheja respostes que no siguin `ok` i de tipus `basic`**
  (`cacheable()`): sense això, la pantalla d'un portal captiu de wifi es quedaria desada com
  a carcassa de l'app.
- **La caixa "Mesos vinents" és, per naturalesa, de fiabilitat baixa.** Va al final i ben
  etiquetada; el risc d'incendi és un índex propi, **no oficial**. Mantingues aquests avisos
  a la interfície.
- **No es fa servir la marca "Meteocat"**: és el servei oficial de la Generalitat.
- L'app **no desa res a cap servidor**: tot el que es recorda va a `localStorage` del
  dispositiu. No hi afegeixis analítica ni cap enviament de dades de l'usuari.

---

## 10. Llista de comprovació abans de tancar una feina

- [ ] `APP_VERSION` i `BUILD_DATE` actualitzats a `index.html`.
- [ ] `CACHE` incrementat a `sw.js` (si s'ha tocat `index.html`, `sw.js` o `vendor/`).
- [ ] Domini nou afegit a la CSP (`connect-src` / `img-src`) si s'ha afegit una API.
- [ ] Text de fora passat per `esc()`.
- [ ] Comprovació `gen !== loadGen` a qualsevol càrrega asíncrona nova.
- [ ] Cap dada personal ni secret afegit al codi.
- [ ] Provat al navegador, sense errors a la consola, i mirat en amplada de mòbil.
- [ ] `README.md` actualitzat si el canvi afecta el que hi surt.
- [ ] Missatge de commit en català, explicant el perquè.
