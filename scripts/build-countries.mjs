// Génère public/pays/countries.json (TopoJSON compact) depuis Natural Earth 1:50m.
// À relancer seulement pour mettre à jour la carte : node scripts/build-countries.mjs
import { writeFileSync } from 'node:fs';
import { topology } from 'topojson-server';
import { presimplify, simplify, quantile } from 'topojson-simplify';
import { quantize, mergeArcs } from 'topojson-client';

const SOURCE = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/v5.1.2/geojson/ne_50m_admin_0_countries.geojson';
// Régions séparatistes rattachées à l'État reconnu par l'ONU, pour qu'un clic dessus compte pour ce pays.
const MERGE = { Somaliland: 'Somalia', 'Northern Cyprus': 'Cyprus' };
// États à demander en plus des pays « souverains » de Natural Earth.
const EXTRA = ['Palestine', 'Kosovo', 'Israel'];

const continent = p => p.REGION_UN === 'Americas'
  ? (p.SUBREGION === 'South America' ? 'Amérique du Sud' : 'Amérique du Nord')
  : { Africa: 'Afrique', Europe: 'Europe', Asia: 'Asie', Oceania: 'Océanie' }[p.REGION_UN];

const geo = await (await fetch(SOURCE)).json();
const features = geo.features.filter(f => f.properties.REGION_UN !== 'Antarctica');
for (const f of features) {
  const p = f.properties;
  // ADM0_A3 est unique ; le code ISO ne l'est pas (l'Australie et ses îles partagent « AUS »).
  f.id = p.ADM0_A3;
  const quiz = !MERGE[p.ADMIN] && (EXTRA.includes(p.ADMIN) || (['Sovereign country', 'Sovereignty', 'Country'].includes(p.TYPE) && p.SOVEREIGNT === p.ADMIN));
  f.properties = { fr: p.NAME_FR, en: p.NAME_EN, iso: p.ISO_A3_EH !== '-99' ? p.ISO_A3_EH : p.ADM0_A3, c: continent(p), ...(quiz ? { q: 1 } : {}), admin: p.ADMIN };
}

let topo = topology({ countries: { type: 'FeatureCollection', features } });
const geoms = topo.objects.countries.geometries;
for (const [child, parent] of Object.entries(MERGE)) {
  const a = geoms.find(g => g.properties.admin === parent), b = geoms.find(g => g.properties.admin === child);
  Object.assign(a, mergeArcs(topo, [a, b]));
  geoms.splice(geoms.indexOf(b), 1);
}
for (const g of geoms) delete g.properties.admin;

topo = presimplify(topo);
topo = quantize(simplify(topo, quantile(topo, 0.35)), 1e5);
writeFileSync(new URL('../public/pays/countries.json', import.meta.url), JSON.stringify(topo));

const quiz = geoms.filter(g => g.properties.q);
console.log(`${geoms.length} territoires, dont ${quiz.length} pays à trouver`);
console.log('Hors quiz :', geoms.filter(g => !g.properties.q).map(g => g.properties.fr).join(', '));
