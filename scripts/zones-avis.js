/* ════════════════════════════════════════════════════════════════════════════
   Genera data/zones-avis-es.json: el contorn de cada zona d'avís d'AEMET.
   ════════════════════════════════════════════════════════════════════════════
   Per què cal: AEMET no fa avisos per municipi sinó per zones (la província de
   Barcelona en té quatre: Litoral, Prelitoral, Depressió central i Prepirineu, més
   la franja de mar). Al feed de Meteoalarm cada zona porta un codi EMMA_ID
   (p. ex. ES179 = Depressió central de Barcelona), però no el seu contorn. Amb
   aquest fitxer l'app sap en quina zona cau el punt triat i només n'ensenya els
   avisos (abans, a Vic hi sortien els de les quatre zones de la província).

   D'on surt: el fitxer de geocodis oficial de Meteoalarm (GeoJSON amb un polígon
   per EMMA_ID). Se'n pot treure una còpia del paquet de Python "meteoalarm"
   (assets/geocodes.json):
     https://pypi.org/project/meteoalarm/

   Com es fa servir (només cal tornar-ho a fer si AEMET canvia les zones):
     node scripts/zones-avis.js camí/a/geocodes.json

   Què fa: es queda amb les zones d'Espanya, simplifica els contorns (Douglas-
   Peucker, ~500 m) i arrodoneix a 3 decimals (~100 m). Les zones de mar
   ("Costa - …") es marquen amb m:1 perquè l'app hi aplica més marge.
   ════════════════════════════════════════════════════════════════════════════ */
const fs = require('fs');
const path = require('path');

const TOL = 0.005;       // graus (~500 m): tolerància de la simplificació
const DEC = 1000;         // 3 decimals

function simplify(pts, tol){
  if(pts.length <= 4) return pts;
  const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length-1] = 1;
  const stack = [[0, pts.length-1]];
  while(stack.length){
    const [a, b] = stack.pop();
    const [x1, y1] = pts[a], [x2, y2] = pts[b];
    const dx = x2-x1, dy = y2-y1, len = Math.hypot(dx, dy);
    let best = -1, dmax = 0;
    for(let i = a+1; i < b; i++){
      const [x, y] = pts[i];
      const d = len ? Math.abs(dy*x - dx*y + x2*y1 - y2*x1)/len : Math.hypot(x-x1, y-y1);
      if(d > dmax){ dmax = d; best = i; }
    }
    if(best > 0 && dmax > tol){ keep[best] = 1; stack.push([a, best], [best, b]); }
  }
  const out = pts.filter((_, i) => keep[i]);
  return out.length >= 4 ? out : pts;   // un anell necessita almenys 3 punts + tancament
}

function main(){
  const src = process.argv[2];
  if(!src){ console.error('Ús: node scripts/zones-avis.js geocodes.json'); process.exit(1); }
  const gj = JSON.parse(fs.readFileSync(src, 'utf8'));
  const z = {};
  let nv = 0;
  for(const f of gj.features){
    const p = f.properties || {};
    if(p.type !== 'EMMA_ID' || p.country !== 'ES') continue;
    const g = f.geometry;
    const polys = g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : [];
    let b = [Infinity, Infinity, -Infinity, -Infinity];
    const P = polys.map(rings => rings.map(ring => {
      const flat = [];
      for(const [x, y] of simplify(ring, TOL)){
        const rx = Math.round(x*DEC)/DEC, ry = Math.round(y*DEC)/DEC;
        flat.push(rx, ry);
        b = [Math.min(b[0], rx), Math.min(b[1], ry), Math.max(b[2], rx), Math.max(b[3], ry)];
      }
      nv += flat.length/2;
      return flat;
    }));
    z[p.code] = { m: /^costa\b/i.test(p.name || '') ? 1 : 0, b, p: P };
  }
  const out = { v: 1, font: 'Meteoalarm, geocodis EMMA_ID', z };
  const dest = path.join(__dirname, '..', 'data', 'zones-avis-es.json');
  fs.writeFileSync(dest, JSON.stringify(out));
  console.log(`${Object.keys(z).length} zones, ${nv} vèrtexs, ${fs.statSync(dest).size} bytes → ${dest}`);
}

if(require.main === module) main();
