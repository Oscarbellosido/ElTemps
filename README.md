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
├── icon.svg        ← icona de l'app
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

**Models usats al consens** (variable `MODELS` dins l'script):
ECMWF · ICON (DWD) · AROME (Météo-France) · GFS (NOAA) · GEM (Canadà) · UKMO · JMA.

---

## ✨ Funcions actuals

- [x] Temps actual: temperatura, sensació, vent + ratxes + direcció, humitat, pressió, núvols, UV, sortida/posta de sol
- [x] Probabilitat de pluja destacada
- [x] Predicció horària (24 h) i diària (7 dies)
- [x] **Resum del dia** en llenguatge planer a dalt de tot (en entrar i en triar ciutat): condicions, màx/mín, quan plourà, vent, i avisos (UV, calor, fred, fiabilitat dels models)
- [x] **Consens multi-model** amb indicador de fiabilitat segons l'acord entre models
- [x] **Gràfic horari** (corba de temperatura + barres de pluja) a "Pròximes 24 hores"
- [x] Qualitat de l'aire (EAQI, PM2.5, PM10, NO₂, O₃)
- [x] **Radar de pluja** (mapa Leaflet + capes de RainViewer)
- [x] Cerca mundial amb autocompletar (català/castellà) + geolocalització
- [x] Accés ràpid a ciutats catalanes + històric de cerques recents
- [x] Tema clar/fosc + disseny responsive per a mòbil
- [x] **PWA**: icona pròpia i "afegir a la pantalla d'inici" (`manifest.json`)

---

## 💡 Idees per afegir (TODO)

Coses que es poden incorporar més endavant:

- [ ] **Alertes/avisos oficials** (Meteocat / AEMET / Meteoalarm) per pluja, vent, calor…
- [ ] **Notificacions** quan es preveu pluja a les pròximes hores (mentre la pestanya és oberta)
- [ ] **Service worker** per funcionar sense connexió (PWA completa offline)
- [ ] **Més dies de consens** (no només 3) i afegir-hi més models si Open-Meteo en treu de nous
- [ ] **Pol·len** i índex de raigs UV detallat (Open-Meteo ho ofereix)
- [ ] **Comparació de llocs** (veure dos pobles alhora)
- [ ] **Mode "platja/muntanya"** amb dades d'onatge o neu segons el lloc
- [ ] **Desar favorits** fixos (a part dels recents)
- [ ] **Idioma anglès** a part del català/castellà

> Quan afegeixis una funció nova, marca-la aquí amb `[x]` i mou-la a "Funcions actuals".

---

## 📝 Notes

- L'app no guarda res en cap servidor: les cerques recents i el tema es desen al navegador
  (`localStorage`), per dispositiu.
- La predicció és **orientativa**. El valor afegit és el **consens**: quan molts models
  coincideixen, més confiança; quan discrepen, més incertesa.
- Nom: s'ha evitat "Meteocat" a propòsit perquè és la marca del servei oficial de la Generalitat.
