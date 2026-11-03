// Little Fisher : les règles (sans affichage) : zones, choix du poisson qui mord, prises, marché, chantier, missions, sauvegarde.
import { ISLANDS, FOSSE, OPEN_SEA, WORLD, FISH, RARITY, UPGRADES, VILLAGES, PEOPLE, TREASURES, DAY_SECONDS } from './data.js';

export const fishById = id => FISH.find(f => f.id === id);
export const lvl = (save, key) => UPGRADES[key].levels[save.levels[key]];

// ---------- Sauvegarde ----------
export function newSave() {
  return {
    v: 1, money: 20, cargo: [], items: [], levels: { moteur: 0, cale: 0, canne: 0, coque: 0, lanterne: 0 },
    catalog: {}, quests: {}, seen: ['port'], treasures: [], sold: 0, earned: 0,
    time: 0.3, boat: null, // null : au ponton de Port-Galet ; on part à 7 h du matin
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

// ---------- La pêche ----------
// Le poisson peut-il mordre ici et maintenant ?
export function canBite(f, { zone, time, weather, rod, lantern }) {
  if (!f.zones.includes(zone)) return false;
  const p = period(time);
  if (f.when === 'jour' && p !== 'jour') return false;
  if (f.when === 'nuit' && p !== 'nuit') return false;
  if (f.when === 'crepuscule' && p !== 'crepuscule') return false;
  if (f.when === 'nuit' && !lantern) return false;   // la nuit, il faut de la lumière pour les attirer
  if (f.weather && f.weather !== weather) return false;
  return (f.minRod ?? 0) <= rod;
}
// Tire le poisson qui va mordre (null : rien ici). spot : on pêche dans un remous (les rares mordent plus).
export function pickFish(ctx, rng = Math.random, spot = false) {
  const luck = UPGRADES.canne.levels[ctx.rod].luck;
  const list = FISH.filter(f => canBite(f, ctx)).map(f => {
    let w = RARITY[f.rarity].weight;
    if (f.rarity !== 'commun') w *= luck * (spot ? 1.8 : 1);
    return [f, w];
  });
  const total = list.reduce((a, [, w]) => a + w, 0);
  let r = rng() * total;
  for (const [f, w] of list) if ((r -= w) <= 0) return f;
  return list.at(-1)?.[0] ?? null;
}
// Attente avant la touche (s) : un remous fait mordre plus vite.
export const biteDelay = (f, rng = Math.random, spot = false) => (f.wait[0] + rng() * (f.wait[1] - f.wait[0])) * (spot ? 0.7 : 1);

// Le moulinet : une aiguille tourne, il faut appuyer quand elle passe dans l'arc vert.
// hits : réussites à enchaîner ; misses : ratés permis ; speed : tours par seconde ; arc : taille de l'arc (radians).
export function reelSpec(f, rod) {
  const d = f.difficulty, a = UPGRADES.canne.levels[rod].arc;
  return { hits: 1 + Math.ceil(d / 2), misses: d >= 4 ? 1 : 2, speed: 0.45 + d * 0.14, arc: Math.max(0.35, (1.35 - d * 0.17) * a) };
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
