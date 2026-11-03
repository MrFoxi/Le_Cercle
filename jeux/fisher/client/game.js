// Little Fisher : les règles (sans affichage) : zones, choix du poisson qui mord, appâts, prises, casiers, filet, plongée,
// marché, chantier, missions, temps qui passe, sauvegarde.
import { ISLANDS, FOSSE, OPEN_SEA, NORTH, CAVE, WORLD, FISH, RARITY, UPGRADES, VILLAGES, PEOPLE, TREASURES, DAY_SECONDS, BAITS, BAIT_SHOPS, GEAR,
  WRECKS, RELICS, HUNTS, WONDERS, BOATS, HULL_COLORS, FLAGS, AQUARIUM, STORY, MARGOT_ROUTE, MARGOT_STOCK, CONTEST, SEASONS } from './data.js';

export const fishById = id => FISH.find(f => f.id === id);
export const lvl = (save, key) => UPGRADES[key].levels[save.levels[key]];

// ---------- Sauvegarde ----------
export function newSave() {
  return {
    v: 1, money: 20, cargo: [], items: [], levels: { moteur: 0, cale: 0, canne: 0, coque: 0, lanterne: 0, filet: 0, casiers: 0, sonar: 0 },
    catalog: {}, quests: {}, seen: ['port'], treasures: [], sold: 0, earned: 0,
    time: 0.3, days: 0, boat: null, // null : au ponton de Port-Galet ; on part à 7 h du matin
    baits: { ver: 5 }, bait: 'ver', gear: {}, traps: [],
    relics: [], wrecks: {}, hunts: {}, fog: '',   // reliques trouvées, dernier jour de fouille de chaque épave, cartes au trésor, carte explorée
    boats: ['barque'], model: 'barque', custom: { hull: 'auto', flag: 'jaune', name: 'Petit Galet', mascot: null }, aquarium: [],
    story: 0, flags: {}, orders: { day: -1, done: [] }, contest: null, // chapitre en cours, moments vécus, commandes livrées aujourd'hui, concours
  };
}
// Relit une sauvegarde (ou en crée une) ; les champs ajoutés plus tard prennent leur valeur par défaut.
export function loadSave(text) {
  const base = newSave();
  let s = null;
  try { s = JSON.parse(text); } catch { /* illisible : partie neuve */ }
  if (!s || s.v !== 1) return base;
  return { ...base, ...s, levels: { ...base.levels, ...s.levels }, custom: { ...base.custom, ...s.custom } };
}

// ---------- Le monde ----------
const dist = (x, z, p) => Math.hypot(x - p.x, z - p.z);
// Les eaux où l'on se trouve : celles de l'île la plus proche, sinon le large (ou la Fosse).
export function zoneAt(x, z) {
  if (dist(x, z, CAVE) < CAVE.r) return 'grotte';
  if (dist(x, z, FOSSE) < FOSSE.r) return 'fosse';
  let best = null, bd = Infinity;
  for (const i of ISLANDS) { const d = dist(x, z, i) - i.r; if (d < bd) { bd = d; best = i; } }
  return bd < 75 ? best.zone : 'large';
}
// Coque nécessaire pour naviguer ici (Infinity : la brume, on ne passe pas).
export function hullNeeded(x, z) {
  if (Math.abs(x) > WORLD || Math.abs(z) > WORLD) return Infinity;
  if (dist(x, z, FOSSE) < FOSSE.r + 40 || z < NORTH) return 2;
  return Math.hypot(x, z) > OPEN_SEA ? 1 : 0;
}

// ---------- Heure et météo ----------
export const clock = t => { const m = Math.floor(((t % 1) + 1) % 1 * 24 * 60); return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; };
export function period(t) {
  const h = (((t % 1) + 1) % 1) * 24;
  if ((h >= 5.5 && h < 7.5) || (h >= 18 && h < 20)) return 'crepuscule';
  return h >= 7.5 && h < 18 ? 'jour' : 'nuit';
}
export const advance = (t, dt) => (t + dt / DAY_SECONDS) % 1;
export const season = save => Math.floor(save.days / 7) % SEASONS.length; // une saison par semaine
// Fait passer le temps ; renvoie true quand un nouveau jour commence.
export function tick(save, dt) {
  const t = save.time + dt / DAY_SECONDS;
  save.time = t % 1;
  if (t >= 1) { save.days++; return true; }
  return false;
}
export const now = save => save.days + save.time; // en jours depuis le début de la partie
// Attendre au port jusqu'à une heure donnée (le lendemain si elle est passée)
export function waitUntil(save, t) { if (t <= save.time) save.days++; save.time = t; }

// ---------- La pêche ----------
export const lightOk = ctx => !!ctx.lantern || ctx.bait === 'lumineux';
// Le poisson peut-il mordre ici et maintenant ? (à la canne)
export function canBite(f, ctx) {
  const { zone, time, weather, rod } = ctx;
  if (!f.zones.includes(zone)) return false;
  const p = period(time);
  if (f.when === 'jour' && p !== 'jour') return false;
  if (f.when === 'nuit' && p !== 'nuit') return false;
  if (f.when === 'crepuscule' && p !== 'crepuscule') return false;
  if (f.when === 'nuit' && !lightOk(ctx)) return false;   // la nuit, il faut de la lumière pour les attirer
  if (f.weather && f.weather !== weather && !(f.weather === 'pluie' && weather === 'orage')) return false; // l'orage, c'est aussi de la pluie
  return (f.minRod ?? 0) <= rod;
}
// Tire le poisson qui va mordre (null : rien ici). spot : on pêche dans un remous (les rares mordent plus).
// ctx.bait : l'appât accroché (null : sans appât, les rares mordent moins) ; le poisson qui l'aime mord trois fois plus.
export function pickFish(ctx, rng = Math.random, spot = false) {
  const luck = UPGRADES.canne.levels[ctx.rod].luck;
  const list = FISH.filter(f => canBite(f, ctx)).map(f => {
    let w = RARITY[f.rarity].weight;
    if (f.rarity !== 'commun') w *= luck * (spot ? 1.8 : 1) * (ctx.bait ? 1 : 0.6);
    if (ctx.bait && f.bait === ctx.bait) w *= 3;
    if (ctx.bait === 'dore') w *= f.rarity === 'legende' ? 3 : f.rarity === 'rare' ? 1.5 : 1;
    if (ctx.season != null && SEASONS[ctx.season].fish.includes(f.id)) w *= 2; // poisson de saison
    return [f, w];
  });
  const total = list.reduce((a, [, w]) => a + w, 0);
  let r = rng() * total;
  for (const [f, w] of list) if ((r -= w) <= 0) return f;
  return list.at(-1)?.[0] ?? null;
}
// Attente avant la touche (s) : un remous et un appât font mordre plus vite.
export const biteDelay = (f, rng = Math.random, spot = false, bait = 'ver') => (f.wait[0] + rng() * (f.wait[1] - f.wait[0])) * (spot ? 0.7 : 1) * (bait ? 1 : 1.6);

// Le moulinet : une aiguille tourne, il faut appuyer quand elle passe dans l'arc vert.
// hits : réussites à enchaîner ; misses : ratés permis ; speed : tours par seconde ; arc : taille de l'arc (radians) ; fight : façon de se battre.
export function reelSpec(f, rod) {
  const d = f.difficulty, a = UPGRADES.canne.levels[rod].arc;
  return { hits: 1 + Math.ceil(d / 2), misses: d >= 4 ? 1 : 2, speed: 0.45 + d * 0.14, arc: Math.max(0.35, (1.35 - d * 0.17) * a), fight: f.fight ?? 'calme' };
}

// La prise : une taille au hasard (les grands sont plus rares) et son prix.
export function landFish(save, f, rng = Math.random) {
  const k = rng() ** 1.6, size = Math.round(f.size[0] + k * (f.size[1] - f.size[0]));
  const price = Math.max(1, Math.round(f.price * (0.75 + 0.5 * k)));
  const c = save.catalog[f.id] ?? { count: 0, best: 0 };
  const first = c.count === 0, record = size > c.best;
  save.catalog[f.id] = { count: c.count + 1, best: Math.max(c.best, size) };
  const fish = { id: f.id, size, price, at: now(save) }; // at : quand il a été pêché (fraîcheur)
  save.cargo.push(fish);
  return { fish, first, record: record && !first };
}
export const boatOf = save => BOATS[save.model] ?? BOATS.barque;
export const slots = save => lvl(save, 'cale').slots + boatOf(save).cargo;
export const cargoFull = save => save.cargo.length >= slots(save);

// ---------- Appâts ----------
export const baitsOwned = save => Object.keys(BAITS).filter(b => save.baits[b] > 0);
// Appât accroché pour ce lancer (consommé, sauf le leurre) ; null s'il n'en reste plus.
export function useBait(save) {
  const b = save.bait;
  if (!b || !(save.baits[b] > 0)) return null;
  if (!BAITS[b].forever) save.baits[b]--;
  if (save.baits[b] <= 0 && !BAITS[b].forever) save.bait = baitsOwned(save)[0] ?? null;
  return b;
}
// Appât suivant (touche B) : on fait le tour de ceux qu'on a, puis « sans appât ».
export function nextBait(save) {
  const list = [...baitsOwned(save), null], k = list.indexOf(save.bait);
  save.bait = list[(k + 1) % list.length];
  return save.bait;
}
export function buyBait(save, id, village) {
  const b = BAITS[id];
  if (!BAIT_SHOPS[village]?.includes(id)) return 'Pas vendu ici';
  if (b.forever && save.baits[id] > 0) return 'Tu l’as déjà';
  if (save.money < b.cost) return `Il te manque ${b.cost - save.money} pièces`;
  save.money -= b.cost;
  save.baits[id] = (save.baits[id] ?? 0) + b.pack;
  if (!save.bait) save.bait = id;
  return null;
}
export function buyGear(save, id, village) {
  const g = GEAR[id];
  if (g.shop !== village) return 'Pas vendu ici';
  if (save.gear[id]) return 'Tu l’as déjà';
  if (save.money < g.cost) return `Il te manque ${g.cost - save.money} pièces`;
  save.money -= g.cost; save.gear[id] = true;
  return null;
}

// ---------- Casiers ----------
export const TRAP_HOURS = 3; // heures de jeu avant que le casier soit plein
export const trapsMax = save => lvl(save, 'casiers').count + (save.levels.casiers && boatOf(save).nets ? 2 : 0);
export const trapReady = (save, t) => now(save) - t.at >= TRAP_HOURS / 24;
// Un fond où poser un casier : ni trop peu, ni trop profond, et pas en pleine mer.
export const trapSpot = (depth, zone) => depth >= 2 && depth <= 26 && zone !== 'large' && zone !== 'fosse';
export function placeTrap(save, x, z, zone) {
  if (save.traps.length >= trapsMax(save)) return 'Tous tes casiers sont déjà posés';
  save.traps.push({ x: Math.round(x), z: Math.round(z), zone, at: now(save) });
  return null;
}
// Ce que le casier a attrapé : 1 à 3 bêtes des eaux où il est posé.
export function trapLoot(zone, rng = Math.random) {
  const list = FISH.filter(f => f.trap?.includes(zone)).map(f => [f, RARITY[f.rarity].weight]);
  const n = 1 + Math.floor(rng() * 3), out = [], total = list.reduce((a, [, w]) => a + w, 0);
  for (let k = 0; k < n && total; k++) { let r = rng() * total; for (const [f, w] of list) if ((r -= w) <= 0) { out.push(f); break; } }
  return out;
}
// Relève le casier k : ce qui tient dans la cale y va, le reste est relâché. Renvoie les prises (ou null s'il n'est pas prêt).
export function collectTrap(save, k, rng = Math.random) {
  const t = save.traps[k];
  if (!t || !trapReady(save, t)) return null;
  save.traps.splice(k, 1);
  const got = [];
  for (const f of trapLoot(t.zone, rng)) { if (cargoFull(save)) break; got.push({ f, ...landFish(save, f, rng) }); }
  return got;
}

// ---------- Filet de traîne ----------
// Un petit poisson commun des eaux traversées.
export function netCatch(zone, rng = Math.random) {
  const list = FISH.filter(f => f.zones.includes(zone) && f.rarity === 'commun');
  return list.length ? list[Math.floor(rng() * list.length)] : null;
}

// ---------- Plongée ----------
export const canDive = (save, zone, depth) => !!save.gear.harpon && (zone === 'recif' || zone === 'cote') && depth >= 3 && depth <= 28;
// Le sous-marin : seulement en eau profonde, au large ou dans la Fosse
export const canSub = (save, zone, depth) => !!save.gear.sousmarin && (zone === 'fosse' || zone === 'large') && depth >= 25;
// Les poissons qu'on croise sous l'eau, avec leur fréquence
export function diveFish(zone, rng = Math.random) {
  const list = FISH.filter(f => f.dive?.includes(zone)).map(f => [f, RARITY[f.rarity].weight]);
  const total = list.reduce((a, [, w]) => a + w, 0);
  let r = rng() * total;
  for (const [f, w] of list) if ((r -= w) <= 0) return f;
  return list.at(-1)?.[0] ?? null;
}
// Une huître : parfois une perle (pièces), souvent rien.
export const oyster = (rng = Math.random) => (rng() < 0.3 ? 40 + Math.floor(rng() * 110) : 0);

// ---------- Village : marché, chantier ----------
// Un poisson vendu très frais rapporte 15 % de plus (3 heures, 12 avec la cale réfrigérée). Jamais de pénalité.
export const freshHours = save => (save.levels.cale >= 2 ? 12 : 3);
export const isFresh = (save, fish) => fish.at != null && now(save) - fish.at < freshHours(save) / 24;
export const priceAt = (fish, village, save = null) => Math.round(fish.price * VILLAGES[village].market * (save && isFresh(save, fish) ? 1.15 : 1));
export function sell(save, village, index = null) {
  if (!VILLAGES[village].market) return 0;
  const list = index == null ? save.cargo : [save.cargo[index]];
  const total = list.reduce((a, f) => a + priceAt(f, village, save), 0);
  save.sold += list.length; save.earned += total; save.money += total;
  save.cargo = index == null ? [] : save.cargo.filter((_, k) => k !== index);
  return total;
}
export function nextUpgrade(save, key) { return UPGRADES[key].levels[save.levels[key] + 1] ?? null; }
export function buy(save, key) {
  const next = nextUpgrade(save, key);
  if (!next) return 'Déjà au maximum';
  if (save.money < next.cost) return `Il te manque ${next.cost - save.money} pièces`;
  save.money -= next.cost;
  save.levels[key]++;
  return null;
}

// ---------- Missions ----------
// La mission en cours d'un habitant (les siennes se suivent), ou null quand il n'en a plus.
export const questOf = (save, person) => person.quests.find(q => !save.quests[q.id]) ?? null;
export function questReady(save, q) {
  if (q.type === 'sell') return save.sold >= q.count;
  if (q.type === 'catch') return save.cargo.some(f => f.id === q.fish);
  if (q.type === 'find') return save.items.includes(q.item);
  if (q.type === 'see') return save.seen.includes(q.place);
  if (q.type === 'legend') return save.cargo.some(f => fishById(f.id)?.rarity === 'legende');
  if (q.type === 'explore') return explored(save) >= q.amount;
  return false;
}
// Rend la mission : le poisson ou l'objet est donné, la récompense versée.
export function completeQuest(save, q) {
  if (!questReady(save, q)) return false;
  if (q.type === 'catch') { const k = save.cargo.findIndex(f => f.id === q.fish); save.cargo.splice(k, 1); }
  if (q.type === 'legend') { const k = save.cargo.findIndex(f => fishById(f.id)?.rarity === 'legende'); save.cargo.splice(k, 1); }
  if (q.type === 'find') save.items = save.items.filter(i => i !== q.item);
  save.quests[q.id] = true;
  save.money += q.reward;
  return true;
}
export const peopleOf = village => PEOPLE.filter(p => p.village === village);

// ---------- Exploration ----------
export function see(save, place) { if (save.seen.includes(place)) return false; save.seen.push(place); return true; }
export function takeTreasure(save, t) {
  if (save.treasures.includes(t.id)) return false;
  save.treasures.push(t.id);
  if (t.money) save.money += t.money;
  if (t.item) save.items.push(t.item);
  if (t.map) startHunt(save, t.map);
  return true;
}
export const treasuresLeft = save => TREASURES.filter(t => !save.treasures.includes(t.id));
export const catalogCount = save => Object.keys(save.catalog).length;

// ---------- Bateaux et personnalisation ----------
export function buyBoat(save, id) {
  const b = BOATS[id];
  if (save.boats.includes(id)) return 'Tu l’as déjà';
  if (save.money < b.cost) return `Il te manque ${b.cost - save.money} pièces`;
  save.money -= b.cost; save.boats.push(id); save.model = id;
  return null;
}
export function setBoat(save, id) { if (!save.boats.includes(id)) return false; save.model = id; return true; }
// Le voilier : vitesse selon l'angle avec le vent (rel : 0 vent dans le dos, π face au vent) et sa force (0 à 1)
export function sailFactor(rel, wind) {
  const c = Math.cos(rel), f = 0.55 + 0.3 * (c + 1) + 0.45 * (1 - c * c); // 1,15 vent arrière · 1,3 vent de travers · 0,55 face au vent
  return 1 + (f - 1) * wind;
}
// Couleurs, drapeaux et mascottes : certaines demandent une relique
export const unlocked = (save, item) => !item.need || save.relics.includes(item.need);
export function setCustom(save, key, value) {
  if (key === 'hull' && !(HULL_COLORS[value] && unlocked(save, HULL_COLORS[value]))) return false;
  if (key === 'flag' && !(FLAGS[value] && unlocked(save, FLAGS[value]))) return false;
  if (key === 'mascot' && value !== null && !save.relics.includes(value)) return false;
  if (key === 'name') value = String(value).replace(/[<>]/g, '').trim().slice(0, 18) || 'Petit Galet';
  save.custom[key] = value;
  return true;
}

// ---------- Maison : aquarium et trophées ----------
export function toAquarium(save, k) {
  if (save.aquarium.length >= AQUARIUM || !save.cargo[k]) return false;
  save.aquarium.push(save.cargo.splice(k, 1)[0]);
  return true;
}
export function releaseAquarium(save, k) { return save.aquarium.splice(k, 1).length > 0; }
// Records : le plus grand de chaque espèce pêchée, du plus impressionnant (par rapport à sa taille maximale) au moins
export const trophies = save => Object.entries(save.catalog).map(([id, c]) => ({ f: fishById(id), best: c.best, count: c.count }))
  .filter(t => t.f).sort((a, b) => b.best / b.f.size[1] - a.best / a.f.size[1]);

// ---------- L'histoire ----------
export const chapter = save => STORY[save.story] ?? null;
// L'objectif du chapitre est-il atteint ? (les « talk » se valident en parlant à l'habitant)
export function chapterReady(save) {
  const c = chapter(save); if (!c) return false;
  const g = c.goal;
  if (g.type === 'wreck') return g.wreck in save.wrecks;
  if (g.type === 'relic') return save.relics.includes(g.relic);
  if (g.type === 'upgrade') return save.levels[g.key] >= g.level;
  if (g.type === 'see') return save.seen.includes(g.place);
  if (g.type === 'event') return !!save.flags[g.event];
  if (g.type === 'catch') return !!save.catalog[g.fish];
  return false;
}
// Termine le chapitre en cours (récompense, relique) ; renvoie le chapitre terminé.
export function finishChapter(save) {
  const c = chapter(save); if (!c) return null;
  save.story++; save.money += c.reward;
  if (c.relic && !save.relics.includes(c.relic)) save.relics.push(c.relic);
  return c;
}
// Parler à un habitant fait avancer l'histoire si c'est lui qu'on cherchait
export const storyTalk = (save, who) => { const c = chapter(save); return c?.goal.type === 'talk' && c.goal.who === who ? finishChapter(save) : null; };

// ---------- Commandes du jour (chaque village de marché, renouvelées chaque matin) ----------
function seeded(n) { let a = n | 0; return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const ORDER_ZONES = { port: ['cote'], corail: ['recif', 'cote'], station: ['glace', 'large'], heron: ['mangrove', 'large'] };
export function ordersOf(save, village) {
  const zones = ORDER_ZONES[village]; if (!zones) return [];
  const rng = seeded(save.days * 977 + village.length * 131 + village.charCodeAt(0));
  const pool = FISH.filter(f => f.rarity !== 'legende' && f.zones.some(z => zones.includes(z)));
  return [0, 1].map(k => {
    const f = pool[Math.floor(rng() * pool.length)], count = f.rarity === 'commun' ? 2 + Math.floor(rng() * 2) : 1;
    return { id: `${save.days}-${village}-${k}`, fish: f.id, count, pay: Math.round(f.price * count * 2 + 15) };
  });
}
export function deliverOrder(save, o) {
  if (save.orders.day !== save.days) save.orders = { day: save.days, done: [] };
  if (save.orders.done.includes(o.id)) return 'Déjà livrée';
  const have = save.cargo.filter(f => f.id === o.fish).length;
  if (have < o.count) return `Il t’en faut ${o.count} (tu en as ${have})`;
  for (let k = 0; k < o.count; k++) save.cargo.splice(save.cargo.findIndex(f => f.id === o.fish), 1);
  save.orders.done.push(o.id); save.money += o.pay; save.earned += o.pay;
  return null;
}
export const orderDone = (save, o) => save.orders.day === save.days && save.orders.done.includes(o.id);

// ---------- Margot, Edmond le collectionneur, Barnabé le cartographe ----------
export const margotAt = save => MARGOT_ROUTE[save.days % MARGOT_ROUTE.length];
export function buyFromMargot(save, k, rng = Math.random) {
  const it = MARGOT_STOCK[k];
  if (save.money < it.cost) return { error: `Il te manque ${it.cost - save.money} pièces` };
  if (it.kind === 'relic') {
    const left = Object.keys(RELICS).filter(r => !save.relics.includes(r) && r !== 'statue' && r !== 'coupe');
    if (!left.length) return { error: 'Tu as déjà toutes ses reliques' };
    save.money -= it.cost; const r = left[Math.floor(rng() * left.length)]; save.relics.push(r); return { relic: r };
  }
  if (it.kind === 'map') { const h = buyMap(save, rng, it.cost); return h ? { map: h } : { error: 'Tu as déjà toutes les cartes' }; }
  save.money -= it.cost; save.baits[it.id] = (save.baits[it.id] ?? 0) + (BAITS[it.id].pack); if (!save.bait) save.bait = it.id;
  return { bait: it.id };
}
// Le collectionneur paie le double pour un poisson rare ou légendaire
export const collectorPrice = f => (['rare', 'legende'].includes(fishById(f.id)?.rarity) ? f.price * 2 : 0);
export function sellToCollector(save, k) {
  const f = save.cargo[k], p = f && collectorPrice(f);
  if (!p) return 0;
  save.cargo.splice(k, 1); save.money += p; save.earned += p; save.sold++;
  return p;
}
// Une carte au trésor pas encore commencée (cartographe ou Margot)
export function buyMap(save, rng = Math.random, cost = 160) {
  const left = Object.keys(HUNTS).filter(h => !save.hunts[h]);
  if (!left.length || save.money < cost) return null;
  save.money -= cost; const h = left[Math.floor(rng() * left.length)]; startHunt(save, h);
  return h;
}

// ---------- Le concours du dimanche ----------
export const isSunday = save => save.days % 7 === 6;
const RARE_BONUS = { commun: 1, peu: 1.2, rare: 1.5, legende: 2 };
// Score d'une prise : sa taille par rapport au plus grand de son espèce, plus pour les rares
export const contestScore = (f, size) => Math.round(size / f.size[1] * 100 * RARE_BONUS[f.rarity]);
export function startContest(save, rng = Math.random) {
  if (!isSunday(save)) return 'Le concours, c’est le dimanche !';
  if (save.contest?.day === save.days) return 'Tu as déjà participé aujourd’hui.';
  const rivals = CONTEST.rivals.slice().sort(() => rng() - 0.5).slice(0, 3).map(name => ({ name, score: 70 + Math.floor(rng() * 70) }));
  save.contest = { day: save.days, until: now(save) + CONTEST.hours / 24, best: 0, fish: null, rivals, done: false };
  return null;
}
export const contestOn = save => !!save.contest && !save.contest.done && now(save) < save.contest.until;
export function contestCatch(save, f, size) {
  if (!contestOn(save)) return false;
  const sc = contestScore(f, size);
  if (sc <= save.contest.best) return false;
  save.contest.best = sc; save.contest.fish = f.id;
  return true;
}
// Fin du concours : classement et prix (place 1 : la coupe en plus)
export function endContest(save) {
  const c = save.contest; if (!c || c.done) return null;
  c.done = true;
  const board = [...c.rivals, { name: 'Toi', score: c.best, me: true }].sort((a, b) => b.score - a.score);
  const place = board.findIndex(b => b.me) + 1, prize = c.best ? CONTEST.prizes[place - 1] ?? 0 : 0;
  save.money += prize;
  if (place === 1 && c.best && !save.relics.includes('coupe')) save.relics.push('coupe');
  return { board, place, prize };
}

// ---------- Épaves (au grappin) ----------
export const wreckNear = (x, z, r = 14) => WRECKS.find(w => Math.hypot(w.x - x, w.z - z) < r) ?? null;
// Fouille : la première fois, la relique de l'épave ; ensuite un peu d'argent, parfois une relique au hasard. Une fois par jour.
export function searchWreck(save, w, rng = Math.random) {
  if (!save.gear.grappin) return { error: 'Il te faut un grappin (boutique de Port-Galet).' };
  if (save.wrecks[w.id] === save.days) return { error: 'Tu as déjà fouillé cette épave aujourd’hui. Reviens demain !' };
  const first = !(w.id in save.wrecks);
  save.wrecks[w.id] = save.days;
  let relic = first ? w.relic : null;
  if (!relic && rng() < 0.12) { const left = Object.keys(RELICS).filter(r => !save.relics.includes(r)); relic = left.length ? left[Math.floor(rng() * left.length)] : null; }
  if (relic && save.relics.includes(relic)) relic = null;
  if (relic) save.relics.push(relic);
  const money = 10 + Math.floor(rng() * 50) + (first ? 40 : 0);
  save.money += money;
  return { money, relic };
}

// ---------- Cartes au trésor ----------
// L'endroit exact : sur la plage de l'île, dans la direction indiquée (calculé avec le relief, fourni par le monde).
export function startHunt(save, id) { if (save.hunts[id]) return false; save.hunts[id] = 'actif'; return true; }
export const activeHunts = save => Object.keys(save.hunts).filter(h => save.hunts[h] === 'actif');
export function digHunt(save, id) {
  if (save.hunts[id] !== 'actif') return null;
  const h = HUNTS[id];
  save.hunts[id] = 'trouve'; save.money += h.money;
  if (!save.relics.includes(h.relic)) save.relics.push(h.relic);
  return h;
}

// ---------- Merveilles ----------
// La merveille visible ici et maintenant (pas encore vue), ou null.
export function wonderHere(save, x, z, ctx) {
  for (const w of WONDERS) {
    if (w.special || save.seen.includes(w.id)) continue; // les merveilles « spéciales » se déclenchent ailleurs (animaux, arc-en-ciel)
    if (w.zone ? zoneAt(x, z) !== w.zone : Math.hypot(w.x - x, w.z - z) > w.r) continue;
    const h = ((ctx.time % 1) + 1) % 1 * 24;
    if (w.when === 'nuit' && period(ctx.time) !== 'nuit') continue;
    if (w.when === 'soir' && !(h >= 18.4 && h < 18.9)) continue;   // juste au coucher du soleil
    if (w.weather && ctx.weather !== w.weather) continue;
    return w;
  }
  return null;
}
export const wondersSeen = save => WONDERS.filter(w => save.seen.includes(w.id));

// ---------- Carte explorée (brouillard) ----------
// La carte est découpée en 64 × 64 cases ; une case vue reste découverte.
export const FOG_N = 64, FOG_SPAN = 2300;
export function reveal(save, x, z, radius = 190) {
  if (save.fog.length !== FOG_N * FOG_N) save.fog = '0'.repeat(FOG_N * FOG_N);
  const cell = FOG_SPAN / FOG_N, cx = (x / FOG_SPAN + 0.5) * FOG_N, cz = (z / FOG_SPAN + 0.5) * FOG_N, rc = radius / cell;
  let s = save.fog, changed = false;
  for (let r = Math.floor(cz - rc); r <= Math.ceil(cz + rc); r++) for (let c = Math.floor(cx - rc); c <= Math.ceil(cx + rc); c++) {
    if (r < 0 || c < 0 || r >= FOG_N || c >= FOG_N || Math.hypot(c + 0.5 - cx, r + 0.5 - cz) > rc) continue;
    const k = r * FOG_N + c;
    if (s[k] === '0') { s = s.slice(0, k) + '1' + s.slice(k + 1); changed = true; }
  }
  save.fog = s;
  return changed;
}
export const explored = save => (save.fog.match(/1/g)?.length ?? 0) / (FOG_N * FOG_N);
