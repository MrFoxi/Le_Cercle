// Little Fisher : les règles (sans affichage) : zones, choix du poisson qui mord, appâts, prises, casiers, filet, plongée,
// marché, chantier, missions, temps qui passe, sauvegarde.
import { ISLANDS, FOSSE, OPEN_SEA, WORLD, FISH, RARITY, UPGRADES, VILLAGES, PEOPLE, TREASURES, DAY_SECONDS, BAITS, BAIT_SHOPS, GEAR } from './data.js';

export const fishById = id => FISH.find(f => f.id === id);
export const lvl = (save, key) => UPGRADES[key].levels[save.levels[key]];

// ---------- Sauvegarde ----------
export function newSave() {
  return {
    v: 1, money: 20, cargo: [], items: [], levels: { moteur: 0, cale: 0, canne: 0, coque: 0, lanterne: 0, filet: 0, casiers: 0 },
    catalog: {}, quests: {}, seen: ['port'], treasures: [], sold: 0, earned: 0,
    time: 0.3, days: 0, boat: null, // null : au ponton de Port-Galet ; on part à 7 h du matin
    baits: { ver: 5 }, bait: 'ver', gear: {}, traps: [],
  };
}
// Relit une sauvegarde (ou en crée une) ; les champs ajoutés plus tard prennent leur valeur par défaut.
export function loadSave(text) {
  const base = newSave();
  let s = null;
  try { s = JSON.parse(text); } catch { /* illisible : partie neuve */ }
  if (!s || s.v !== 1) return base;
  return { ...base, ...s, levels: { ...base.levels, ...s.levels } };
}

// ---------- Le monde ----------
const dist = (x, z, p) => Math.hypot(x - p.x, z - p.z);
// Les eaux où l'on se trouve : celles de l'île la plus proche, sinon le large (ou la Fosse).
export function zoneAt(x, z) {
  if (dist(x, z, FOSSE) < FOSSE.r) return 'fosse';
  let best = null, bd = Infinity;
  for (const i of ISLANDS) { const d = dist(x, z, i) - i.r; if (d < bd) { bd = d; best = i; } }
  return bd < 75 ? best.zone : 'large';
}
// Coque nécessaire pour naviguer ici (Infinity : la brume, on ne passe pas).
export function hullNeeded(x, z) {
  if (Math.abs(x) > WORLD || Math.abs(z) > WORLD) return Infinity;
  if (dist(x, z, FOSSE) < FOSSE.r + 40) return 2;
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
  if (f.weather && f.weather !== weather) return false;
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
  const fish = { id: f.id, size, price };
  save.cargo.push(fish);
  return { fish, first, record: record && !first };
}
export const slots = save => lvl(save, 'cale').slots;
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
export const trapsMax = save => lvl(save, 'casiers').count;
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
export const priceAt = (fish, village) => Math.round(fish.price * VILLAGES[village].market);
export function sell(save, village, index = null) {
  if (!VILLAGES[village].market) return 0;
  const list = index == null ? save.cargo : [save.cargo[index]];
  const total = list.reduce((a, f) => a + priceAt(f, village), 0);
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
  return false;
}
// Rend la mission : le poisson ou l'objet est donné, la récompense versée.
export function completeQuest(save, q) {
  if (!questReady(save, q)) return false;
  if (q.type === 'catch') { const k = save.cargo.findIndex(f => f.id === q.fish); save.cargo.splice(k, 1); }
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
  return true;
}
export const treasuresLeft = save => TREASURES.filter(t => !save.treasures.includes(t.id));
export const catalogCount = save => Object.keys(save.catalog).length;
