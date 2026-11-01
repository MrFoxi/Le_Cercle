// Little District : logique pure (économie, parcelles, décorations, objectifs, hors ligne). Aucun Three.js ici.
export const MAX_LEVEL = 10;
export const CATS = { food: 'Restauration', shop: 'Commerces', fun: 'Loisirs', home: 'Logements' };

// base : ¥ par seconde au niveau 1 · ticket : dépense moyenne d'un client · home : habitants par niveau
export const BUILDINGS = {
  ramen:    { name: 'Restaurant de ramen',   cat: 'food', cost: 0,      base: 1.5,  ticket: 8,  desc: 'Le comptoir où tout a commencé. Bouillon fumant, bols qui claquent.' },
  street:   { name: 'Stand de takoyaki',     cat: 'food', cost: 120,    base: 1.1,  ticket: 4,  desc: 'Un petit stand de rue, des boulettes brûlantes et une file d’attente.' },
  cafe:     { name: 'Petit café',            cat: 'food', cost: 400,    base: 2.4,  ticket: 6,  desc: 'Café filtre, tables en bois et clients qui lisent.' },
  konbini:  { name: 'Supérette',             cat: 'shop', cost: 1300,    base: 5,  ticket: 5,  desc: 'Ouverte tard, néons blancs, rayons bien rangés.' },
  appart:   { name: 'Petits appartements',   cat: 'home', cost: 900,    base: 0.6,  home: 4,    desc: 'Coursives, linge aux balcons : de nouveaux habitants.' },
  fleurs:   { name: 'Fleuriste',             cat: 'shop', cost: 5100,   base: 10,  ticket: 12, desc: 'Des seaux de fleurs qui débordent sur le trottoir.' },
  pain:     { name: 'Boulangerie japonaise', cat: 'food', cost: 17000,   base: 19,   ticket: 6,  desc: 'Melon pan et pains au curry tout juste sortis du four.' },
  maison:   { name: 'Maison traditionnelle', cat: 'home', cost: 10000,   base: 2,  home: 3,    desc: 'Bois sombre, shōji lumineux et petit jardin.' },
  livres:   { name: 'Petite librairie',      cat: 'shop', cost: 56000,   base: 36,   ticket: 15, desc: 'Des piles de livres jusqu’au plafond.' },
  sushi:    { name: 'Restaurant de sushi',   cat: 'food', cost: 180000,  base: 70,   ticket: 30, desc: 'Comptoir en hinoki, le chef découpe sous tes yeux.' },
  bar:      { name: 'Izakaya',               cat: 'fun',  cost: 560000,  base: 130,   ticket: 25, desc: 'Le bar traditionnel : brochettes, bière et éclats de rire.' },
  karaoke:  { name: 'Karaoké',               cat: 'fun',  cost: 1700000,  base: 250,   ticket: 20, desc: 'Écrans, micros et chansons jusqu’au bout de la nuit.' },
  mode:     { name: 'Boutique de vêtements', cat: 'shop', cost: 5000000,  base: 480,  ticket: 40, desc: 'Vitrines soignées et portants colorés.' },
  immeuble: { name: 'Immeuble résidentiel',  cat: 'home', cost: 2400000,  base: 25,   home: 8,    desc: 'Des étages de fenêtres allumées le soir.' },
  arcade:   { name: 'Salle d’arcade',        cat: 'fun',  cost: 15000000, base: 900,  ticket: 10, desc: 'Bornes lumineuses, bruits de pièces et records.' },
  hotel:    { name: 'Petit hôtel',           cat: 'home', cost: 40000000, base: 600,  home: 5,    desc: 'Un ryokan accueillant pour les voyageurs.' },
  ryotei:   { name: 'Restaurant traditionnel', cat: 'food', cost: 120000000, base: 2000, ticket: 80, desc: 'Le ryōtei : salons privés, jardin et service en kimono.' },
};
for (const [id, b] of Object.entries(BUILDINGS)) { b.id = id; b.need = Math.round(b.cost * 0.7); }

// Ce que le joueur voit changer au niveau suivant (affiché sur le bouton d'amélioration).
export const LEVEL_TEXT = {
  2: 'Lanternes à l’entrée et une place de plus',
  3: 'Rideau noren et plantes devant',
  4: 'Plus de places, menu en vitrine',
  5: 'Un étage, du personnel en plus',
  6: 'Nouvelle déco intérieure',
  7: 'Une terrasse devant l’entrée',
  8: 'Plus de lanternes, plus de monde',
  9: 'Façade rénovée',
  10: 'Grande enseigne lumineuse, au sommet du quartier',
};

// Parcelles : 4 rangées de 4. face = côté de la rue (+1 : la façade regarde vers +z).
export const SECTORS = [
  { name: 'La ruelle', cost: 0 },
  { name: 'Rue des lanternes', cost: 1500 },
  { name: 'Le haut quartier', cost: 500000 },
  { name: 'Les jardins', cost: 26000000 },
];
export const PLOTS = [];
for (const [z, sector] of [[-4.8, 0], [4.8, 0], [-4.8, 1], [4.8, 1], [10.15, 2], [-10.15, 3]]) {
  const xs = sector === 0 ? [-4.3, 4.3] : sector === 1 ? [-9.3, 9.3] : [-9.3, -4.3, 4.3, 9.3];
  for (const x of xs) PLOTS.push({ x, z, face: z < 0 ? 1 : -1, sector, depth: Math.abs(z) > 8 ? 4.5 : 4.2 });
}
export const START_PLOT = PLOTS.findIndex(p => p.x === 4.3 && p.z === -4.8);

// Décorations : prix, et celles qui se débloquent par les objectifs (rare).
export const DECOR = {
  plante:   { name: 'Plante en pot',      cost: 15 },
  caisses:  { name: 'Caisses en bois',    cost: 10 },
  banc:     { name: 'Banc',               cost: 30 },
  velo:     { name: 'Vélo',               cost: 35 },
  lampe:    { name: 'Lampadaire',         cost: 40 },
  bambou:   { name: 'Bambous',            cost: 45 },
  toro:     { name: 'Lanterne de pierre', cost: 50 },
  panneau:  { name: 'Panneau menu',       cost: 25 },
  bonsai:   { name: 'Bonsaï',             cost: 60 },
  vending:  { name: 'Distributeur',       cost: 120 },
  cerisier: { name: 'Cerisier',           cost: 200 },
  erable:   { name: 'Érable',             cost: 220 },
  torii:    { name: 'Torii',              cost: 0, rare: true },
  puits:    { name: 'Pompe à eau',        cost: 0, rare: true },
  neko:     { name: 'Maneki-neko géant',  cost: 0, rare: true },
  sakura:   { name: 'Grand cerisier',     cost: 0, rare: true },
  jizo:     { name: 'Statue jizō',        cost: 0, rare: true },
  kiosque:  { name: 'Kiosque à thé',      cost: 0, rare: true },
  fontaine: { name: 'Fontaine',           cost: 0, rare: true },
};

export const SAVE_KEY = 'district-save-v1';

export function newState(now = Date.now()) {
  const plots = PLOTS.map(() => null);
  plots[START_PLOT] = { type: 'ramen', level: 1, served: 0 };
  return {
    v: 1, district: 'japon', money: 60, earned: 0, clients: 0, residents: 0,
    plots, sectors: [true, false, false, false], decor: [], rare: [], claimed: [],
    savedAt: now, hour: 17.5, // on arrive en fin d'après-midi : les lanternes s'allument bientôt
    settings: { music: 0.5, sfx: 0.7, time: 'auto', weather: 'auto', season: 'auto', quality: 'auto' },
  };
}

export const levelIncome = (type, level) => BUILDINGS[type].base * level * 1.12 ** (level - 1);
export const upgradeCost = (type, level) => Math.round(Math.max(50, BUILDINGS[type].cost * 0.5) * 2.2 ** (level - 1));
export const capacity = s => s.plots.reduce((n, p) => n + (p && BUILDINGS[p.type].home ? BUILDINGS[p.type].home * p.level : 0), 0);
export const charm = s => Math.min(0.3, s.decor.reduce((n, d) => n + (DECOR[d.id]?.rare ? 0.03 : 0.01), 0));
export const multiplier = s => (1 + 0.01 * s.residents) * (1 + charm(s));
export const incomeOf = (s, i) => (s.plots[i] ? levelIncome(s.plots[i].type, s.plots[i].level) * multiplier(s) : 0);
export const totalIncome = s => s.plots.reduce((n, p, i) => n + incomeOf(s, i), 0);
export const clientRate = (s, i) => (s.plots[i] && BUILDINGS[s.plots[i].type].ticket ? incomeOf(s, i) / BUILDINGS[s.plots[i].type].ticket : 0);
export const unlocked = (s, type) => s.earned >= BUILDINGS[type].need;
export const built = s => s.plots.filter(Boolean);

// Le temps qui passe : argent, clients servis, habitants qui emménagent (1 toutes les 12 s).
export function tick(s, dt) {
  for (let i = 0; i < s.plots.length; i++) {
    const p = s.plots[i];
    if (!p) continue;
    const gain = incomeOf(s, i) * dt, c = clientRate(s, i) * dt;
    s.money += gain;
    s.earned += gain;
    p.served += c;
    s.clients += c;
  }
  s.residents = Math.min(capacity(s), s.residents + dt / 12);
}

export function build(s, type, plot) {
  const b = BUILDINGS[type];
  if (!b || s.plots[plot] || !s.sectors[PLOTS[plot].sector] || !unlocked(s, type) || s.money < b.cost) return false;
  s.money -= b.cost;
  s.plots[plot] = { type, level: 1, served: 0 };
  s.decor = s.decor.filter(d => !inPlot(d, plot) || (s.money += refund(d), false)); // la parcelle est libérée
  return true;
}

export function upgrade(s, plot) {
  const p = s.plots[plot];
  if (!p || p.level >= MAX_LEVEL) return false;
  const c = upgradeCost(p.type, p.level);
  if (s.money < c) return false;
  s.money -= c;
  p.level++;
  return true;
}

// Déplacer un bâtiment : vers une parcelle libre, ou échange avec celle d'un autre.
export function move(s, from, to) {
  if (from === to || !s.plots[from] || !s.sectors[PLOTS[to].sector]) return false;
  [s.plots[from], s.plots[to]] = [s.plots[to], s.plots[from]];
  s.decor = s.decor.filter(d => !inPlot(d, to) || (s.money += refund(d), false));
  return true;
}

export function buySector(s, k) {
  if (s.sectors[k] || s.money < SECTORS[k].cost) return false;
  s.money -= SECTORS[k].cost;
  s.sectors[k] = true;
  return true;
}

const refund = d => Math.floor((DECOR[d.id]?.cost || 0) / 2);
export const inPlot = (d, i) => Math.abs(d.x - PLOTS[i].x) < 2.2 && Math.abs(d.z - PLOTS[i].z) < PLOTS[i].depth / 2;

// Où peut-on poser une décoration ? Pas sur la chaussée, ni sur un bâtiment ou une parcelle à vendre, ni sur une autre déco.
export function canPlace(s, x, z, ignore = -1) {
  if (Math.abs(x) > 12.6 || Math.abs(z) > 12.6 || Math.abs(z) < 1.45) return false;
  for (let i = 0; i < PLOTS.length; i++) if (inPlot({ x, z }, i) && (s.plots[i] || !s.sectors[PLOTS[i].sector])) return false;
  return s.decor.every((d, k) => k === ignore || Math.hypot(d.x - x, d.z - z) > 0.55);
}

export function placeDecor(s, id, x, z, r = 0) {
  const d = DECOR[id];
  if (!d || (d.rare && !s.rare.includes(id)) || s.money < d.cost || !canPlace(s, x, z)) return false;
  s.money -= d.cost;
  s.decor.push({ id, x, z, r });
  return true;
}

export function removeDecor(s, k) {
  const d = s.decor[k];
  if (!d) return false;
  s.money += refund(d);
  s.decor.splice(k, 1);
  return true;
}

// Objectifs facultatifs : progression [actuel, but] et récompense.
const lvl = (s, type) => Math.max(0, ...s.plots.filter(p => p?.type === type).map(p => p.level));
const shops = s => built(s).filter(p => BUILDINGS[p.type].cat !== 'home').length;
export const OBJECTIVES = [
  { id: 'up2',      text: 'Améliorer le restaurant de ramen',          goal: 2,     get: s => lvl(s, 'ramen'),                    reward: { money: 100 } },
  { id: 'c50',      text: 'Accueillir 50 clients',                     goal: 50,    get: s => s.clients,                          reward: { money: 150 } },
  { id: 'shop2',    text: 'Ouvrir un deuxième commerce',               goal: 2,     get: shops,                                   reward: { money: 200 } },
  { id: 'deco3',    text: 'Installer 3 décorations',                   goal: 3,     get: s => s.decor.length,                     reward: { money: 120, decor: 'puits' } },
  { id: 'hab5',     text: 'Accueillir 5 habitants',                    goal: 5,     get: s => s.residents,                        reward: { money: 400 } },
  { id: 'shop3',    text: 'Construire trois commerces',                goal: 3,     get: shops,                                   reward: { money: 600 } },
  { id: 'rue',      text: 'Acheter la Rue des lanternes',              goal: 1,     get: s => +s.sectors[1],                      reward: { decor: 'torii' } },
  { id: 'inc600',   text: 'Gagner 600 ¥ par minute',                   goal: 600,   get: s => totalIncome(s) * 60,                reward: { money: 900 } },
  { id: 'deco10',   text: 'Installer dix décorations',                 goal: 10,    get: s => s.decor.length,                     reward: { decor: 'neko' } },
  { id: 'c500',     text: 'Accueillir 500 clients',                    goal: 500,   get: s => s.clients,                          reward: { money: 2500 } },
  { id: 'ramen5',   text: 'Ramen au niveau 5',                         goal: 5,     get: s => lvl(s, 'ramen'),                    reward: { decor: 'sakura' } },
  { id: 'hab20',    text: 'Accueillir 20 habitants',                   goal: 20,    get: s => s.residents,                        reward: { decor: 'jizo' } },
  { id: 'rue1',     text: 'Développer entièrement la grand-rue',       goal: 8,     get: s => s.plots.filter((p, i) => p && PLOTS[i].depth < 4.4).length, reward: { money: 20000 } },
  { id: 'cats',     text: 'Un bâtiment de chaque catégorie',           goal: 4,     get: s => new Set(built(s).map(p => BUILDINGS[p.type].cat)).size, reward: { decor: 'kiosque' } },
  { id: 'haut',     text: 'Acheter le Haut quartier',                  goal: 1,     get: s => +s.sectors[2],                      reward: { money: 15000 } },
  { id: 'lvl10',    text: 'Un bâtiment au niveau 10',                  goal: 10,    get: s => Math.max(0, ...built(s).map(p => p.level)), reward: { decor: 'fontaine' } },
  { id: 'c5000',    text: 'Accueillir 5 000 clients',                  goal: 5000,  get: s => s.clients,                          reward: { money: 40000 } },
  { id: 'deco30',   text: 'Installer trente décorations',              goal: 30,    get: s => s.decor.length,                     reward: { money: 30000 } },
  { id: 'hab50',    text: 'Accueillir 50 habitants',                   goal: 50,    get: s => s.residents,                        reward: { money: 80000 } },
  { id: 'jardins',  text: 'Acheter les Jardins',                       goal: 1,     get: s => +s.sectors[3],                      reward: { money: 100000 } },
  { id: 'types12',  text: 'Construire 12 types de bâtiments',          goal: 12,    get: s => new Set(built(s).map(p => p.type)).size, reward: { money: 300000 } },
  { id: 'c50000',   text: 'Accueillir 50 000 clients',                 goal: 50000, get: s => s.clients,                          reward: { money: 500000 } },
];
export const progress = (s, o) => Math.min(o.goal, Math.floor(o.get(s)));
export const done = (s, o) => progress(s, o) >= o.goal;

export function claim(s, id) {
  const o = OBJECTIVES.find(o => o.id === id);
  if (!o || s.claimed.includes(id) || !done(s, o)) return false;
  s.claimed.push(id);
  if (o.reward.money) s.money += o.reward.money;
  if (o.reward.decor && !s.rare.includes(o.reward.decor)) s.rare.push(o.reward.decor);
  return true;
}

// Hors ligne : 70 % des revenus les 8 premières heures, 35 % ensuite, sans plafond.
export function offline(s, now = Date.now(), rng = Math.random) {
  const away = Math.max(0, (now - s.savedAt) / 1000);
  if (away < 60) return null;
  const eff = Math.min(away, 8 * 3600) * 0.7 + Math.max(0, away - 8 * 3600) * 0.35;
  const residents0 = s.residents, money0 = s.money, clients0 = s.clients;
  const served0 = s.plots.map(p => p?.served || 0);
  tick(s, eff); // même calcul qu'en jeu, en une fois
  s.residents = Math.min(capacity(s), residents0 + away / 12);
  const events = [];
  const best = s.plots.map((p, i) => [i, p ? p.served - served0[i] : 0]).sort((a, b) => b[1] - a[1])[0];
  if (best && best[1] >= 1) events.push(`${BUILDINGS[s.plots[best[0]].type].name} : ${Math.floor(best[1]).toLocaleString('fr-FR')} clients servis`);
  const moved = Math.floor(s.residents) - Math.floor(residents0);
  if (moved > 0) events.push(`${moved} nouvel${moved > 1 ? 'les familles ont' : 'le famille a'} emménagé`);
  if (away > 3600 && rng() < 0.5) {
    const bonus = Math.round((s.money - money0) * 0.05);
    s.money += bonus;
    s.earned += bonus;
    events.push(`Un critique culinaire est passé : +${bonus.toLocaleString('fr-FR')} ¥`);
  }
  if (away > 1800) events.push(['Il a plu toute la soirée sur la ruelle', 'Un chat errant a dormi sur le banc', 'Les lanternes sont restées allumées toute la nuit', 'Des touristes ont pris le quartier en photo'][Math.floor(rng() * 4)]);
  return { away, money: s.money - money0, clients: s.clients - clients0, events };
}

export function load(text, now = Date.now()) {
  try {
    const d = JSON.parse(text);
    if (!d || d.v !== 1 || !Array.isArray(d.plots) || d.plots.length !== PLOTS.length) return null;
    const s = { ...newState(now), ...d, settings: { ...newState().settings, ...d.settings } };
    s.plots = s.plots.map(p => (p && BUILDINGS[p.type] ? { type: p.type, level: Math.min(MAX_LEVEL, Math.max(1, p.level | 0)), served: +p.served || 0 } : null));
    s.decor = (s.decor || []).filter(d => DECOR[d.id] && Number.isFinite(d.x) && Number.isFinite(d.z));
    return s;
  } catch { return null; }
}

export const money = n => n < 1e4 ? Math.floor(n).toLocaleString('fr-FR') : n < 1e6 ? `${(n / 1e3).toFixed(n < 1e5 ? 1 : 0).replace('.', ',')} k` : n < 1e9 ? `${(n / 1e6).toFixed(2).replace('.', ',')} M` : `${(n / 1e9).toFixed(2).replace('.', ',')} Md`;
