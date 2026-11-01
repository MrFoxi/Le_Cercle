// Une partie roguelike : niveaux, vies, pièces, améliorations, pouvoirs, boutique, événements, boss.
// Aucune dépendance au DOM (testée par test-mines.mjs).
import { makeBoard, generate, reveal, chordTargets, cleared, area, recount, solvable, moveMine } from './board.js';

export const RARITY = {
  common: { name: 'Commune', weight: 60 },
  rare: { name: 'Rare', weight: 28 },
  epic: { name: 'Épique', weight: 10 },
  legendary: { name: 'Légendaire', weight: 2 },
};

// Pouvoirs utilisables pendant une grille (cible : une case, sauf « reveal » et « shield »).
export const POWERS = {
  scan: { name: 'Scanner', icon: '📡', desc: 'Compte les mines dans un carré 3 × 3.', target: true },
  radar: { name: 'Radar', icon: '🛰️', desc: 'Compte les mines dans un carré 5 × 5.', target: true },
  detect: { name: 'Détecteur', icon: '🔍', desc: 'Dit si une case cache une mine.', target: true },
  defuse: { name: 'Désamorçage', icon: '🧯', desc: 'Retire la mine d’une case (ou l’ouvre sans risque).', target: true },
  reveal: { name: 'Révélation', icon: '✨', desc: 'Ouvre une case sûre que la déduction permet de trouver.' },
  shield: { name: 'Protection', icon: '🛡️', desc: 'Bloque la prochaine explosion de cette grille.' },
};

// Améliorations : passives (effets lus par les règles) ou charges de pouvoir à chaque grille.
// unlock : condition de déblocage permanente (méta-progression) ; max : nombre d'exemplaires cumulables.
export const UPGRADES = [
  { id: 'heart', name: 'Cœur de rechange', icon: '❤️', rarity: 'common', desc: '+1 vie tout de suite.', max: 9 },
  { id: 'purse', name: 'Bourse', icon: '💰', rarity: 'common', desc: '+25 % de pièces gagnées.', max: 4 },
  { id: 'vision', name: 'Vision améliorée', icon: '👁️', rarity: 'common', desc: 'Ouvre 2 cases sûres au début de chaque grille.', max: 3 },
  { id: 'p_scan', name: 'Scanner', icon: '📡', rarity: 'common', desc: '+1 Scanner (3 × 3) par grille.', power: 'scan', max: 3 },
  { id: 'p_detect', name: 'Détecteur', icon: '🔍', rarity: 'common', desc: '+1 Détecteur par grille.', power: 'detect', max: 3 },
  { id: 'shieldUp', name: 'Bouclier', icon: '🛡️', rarity: 'rare', desc: 'Absorbe 1 explosion par grille.', max: 2 },
  { id: 'p_radar', name: 'Radar', icon: '🛰️', rarity: 'rare', desc: '+1 Radar (5 × 5) par grille.', power: 'radar', max: 2 },
  { id: 'risky', name: 'Récompense risquée', icon: '🎲', rarity: 'rare', desc: '+80 % de pièces si la grille est finie sans pouvoir.', max: 2 },
  { id: 'streak', name: 'Bonus de série', icon: '🔥', rarity: 'rare', desc: '+6 pièces par grille parfaite consécutive.', max: 3 },
  { id: 'expert', name: 'Expert', icon: '🎓', rarity: 'rare', desc: 'Un drapeau juste est posé au début de chaque grille.', max: 3 },
  { id: 'p_defuse', name: 'Désamorceur', icon: '🧯', rarity: 'rare', desc: '+1 Désamorçage par grille.', power: 'defuse', max: 2 },
  { id: 'second', name: 'Seconde chance', icon: '🪽', rarity: 'epic', desc: 'Une fois par partie, survit à la perte de la dernière vie.', max: 1 },
  { id: 'insurance', name: 'Assurance', icon: '📜', rarity: 'epic', desc: 'Récupère 1 vie tous les 5 niveaux.', max: 1 },
  { id: 'luck', name: 'Chance', icon: '🍀', rarity: 'epic', desc: 'Les améliorations rares, épiques et légendaires sortent plus souvent.', max: 2 },
  { id: 'p_reveal', name: 'Révélation', icon: '✨', rarity: 'epic', desc: '+1 Révélation par grille.', power: 'reveal', max: 2 },
  { id: 'double', name: 'Double choix', icon: '🃏', rarity: 'epic', desc: 'Après un boss et tous les 3 niveaux, choisis 2 améliorations.', max: 1, unlock: 'runs3' },
  { id: 'sixth', name: 'Sixième sens', icon: '🔮', rarity: 'legendary', desc: 'Une fois par grille, un clic sur une mine est retenu (la case est marquée).', max: 1, unlock: 'boss1' },
  { id: 'midas', name: 'Toucher de Midas', icon: '👑', rarity: 'legendary', desc: '×2 pièces, et 1 pièce toutes les 10 cases ouvertes.', max: 1, unlock: 'level10' },
];
export const UNLOCKS = { runs3: 'Joue 3 parties', boss1: 'Bats un boss', level10: 'Atteins le niveau 10' };

// Événements aléatoires (hors boss, à partir du niveau 2)
export const EVENTS = {
  cursed: { name: 'Grille maudite', icon: '💀', desc: '40 % de mines en plus, mais ×2,5 pièces.' },
  safezone: { name: 'Zone sécurisée', icon: '🟩', desc: 'Une bande de la grille est garantie sans mine (surlignée).' },
  merchant: { name: 'Marchand mystérieux', icon: '🧙', desc: 'Après cette grille, un marchand vend un objet rare à prix réduit.' },
  double: { name: 'Double récompense', icon: '✖️2', desc: 'Pièces doublées sur cette grille.' },
  fog: { name: 'Brouillard', icon: '🌫️', desc: 'Les chiffres restent cachés 8 secondes après leur découverte.' },
  timed: { name: 'Défi chronométré', icon: '⏱️', desc: 'Finis avant la fin du chrono pour +60 % de pièces.' },
  traps: { name: 'Grille piégée', icon: '🧨', desc: 'Une explosion referme les cases ouvertes autour d’elle.' },
};
// Boss : tous les 5 niveaux, chacun avec sa contrainte
export const BOSSES = [
  { id: 'colosse', name: 'Le Colosse', icon: '🗿', desc: 'Grille géante. Ses mines sont lourdes : chacune coûte 2 vies.', heavy: true },
  { id: 'ombre', name: 'L’Ombre', icon: '🌑', desc: 'Des cases muettes n’affichent aucun chiffre.', silent: 0.12 },
  { id: 'fou', name: 'Le Démineur fou', icon: '🤡', desc: 'Pour gagner, il faut aussi poser un drapeau sur chaque mine. Quelques cases muettes.', needFlags: true, silent: 0.06 },
];

const has = (run, id) => run.upgrades[id] || 0;
const pick = (rng, list) => list[Math.floor(rng() * list.length)];

export function newRun(rng = Math.random, meta = {}) {
  return {
    rng, meta, level: 0, lives: 3, coins: 0, earned: 0, upgrades: {}, items: {}, streak: 0, cleared: 0, bosses: 0,
    minesAvoided: 0, secondUsed: false, startedAt: Date.now(), phase: 'play', lv: null, choices: [], picksLeft: 0, shop: null, log: [],
  };
}

// Taille, mines et particularités du niveau n
export function levelSpec(n, rng = Math.random) {
  const boss = n % 5 === 0 ? BOSSES[(n / 5 - 1) % BOSSES.length] : null;
  const loop = Math.floor((n - 1) / 15); // chaque tour des 3 boss durcit un peu tout
  let w = Math.min(24, 8 + Math.ceil(n * 1.1)), h = Math.min(16, 8 + Math.floor(n * 0.6));
  let density = Math.min(0.2, 0.12 + n * 0.0055 + loop * 0.01);
  if (boss) { w = Math.min(26, w + 4); h = Math.min(18, h + 3); density = Math.min(0.21, density + 0.015); }
  let event = null;
  if (!boss && n >= 2 && rng() < 0.4) event = pick(rng, Object.keys(EVENTS));
  if (event === 'cursed') density = Math.min(0.22, density * 1.4);
  const mines = Math.round(w * h * density);
  return { n, w, h, mines, boss, event, time: event === 'timed' ? Math.round(w * h * 0.75) : 0 };
}

export function nextLevel(run) {
  run.level++;
  const spec = levelSpec(run.level, run.rng);
  const b = makeBoard(spec.w, spec.h);
  // Zone sécurisée : une bande verticale garantie sans mine
  let safe = [];
  if (spec.event === 'safezone') {
    const x0 = Math.floor(run.rng() * (spec.w - 3));
    for (let y = 0; y < spec.h; y++) for (let x = x0; x < x0 + 3; x++) safe.push(y * spec.w + x);
  }
  const charges = {};
  for (const u of UPGRADES) if (u.power && has(run, u.id)) charges[u.power] = (charges[u.power] || 0) + has(run, u.id);
  run.lv = {
    spec, b, safe, charges, shield: has(run, 'shieldUp'), sixth: has(run, 'sixth'), hits: 0, usedPower: false,
    startedAt: null, markers: [], detected: {}, fogged: {}, armed: null, sixthWarn: null,
  };
  run.phase = 'play';
  return run.lv;
}

/* ---------- Pendant la grille ---------- */
// Premier clic : la grille est tirée autour de lui (zone vide garantie), puis les bonus de début de grille s'appliquent.
function firstClick(run, i) {
  const { b, spec, safe } = run.lv;
  generate(b, i, { mines: spec.mines, safe, silent: spec.boss?.silent || 0, rng: run.rng });
  run.lv.startedAt = Date.now();
  const opened = reveal(b, i);
  // Expert : drapeaux justes sur des mines au bord de la zone ouverte ; Vision : cases sûres ouvertes.
  for (let k = 0; k < has(run, 'expert'); k++) {
    const m = frontier(b).find(j => b.mine[j] && !b.flag[j]) ?? randomCell(run, j => b.mine[j] && !b.flag[j]);
    if (m !== undefined) b.flag[m] = 1;
  }
  for (let k = 0; k < has(run, 'vision') * 2; k++) {
    const s = randomCell(run, j => !b.mine[j] && !b.open[j] && b.nb[j].some(x => b.open[x])) ?? randomCell(run, j => !b.mine[j] && !b.open[j]);
    if (s !== undefined) opened.push(...reveal(b, s).map(o => ({ ...o, d: o.d + 4 })));
  }
  return opened;
}
const frontier = b => { const out = []; for (let i = 0; i < b.n; i++) if (!b.open[i] && b.nb[i].some(j => b.open[j] && !b.mine[j])) out.push(i); return out; };
function randomCell(run, test) {
  const list = [];
  for (let i = 0; i < run.lv.b.n; i++) if (test(i)) list.push(i);
  return list.length ? pick(run.rng, list) : undefined;
}

// Explosion : bouclier, sixième sens, vies, seconde chance. Renvoie ce qui s'est passé pour l'animation.
function explode(run, i) {
  const lv = run.lv, b = lv.b;
  if (lv.sixth) { lv.sixth--; b.flag[i] = 1; return { kind: 'sixth', i }; }
  b.open[i] = 1;
  b.exploded.push(i);
  if (lv.shield) { lv.shield--; return { kind: 'shield', i }; }
  lv.hits++;
  run.streak = 0;
  const cost = lv.spec.boss?.heavy ? 2 : 1;
  run.lives -= cost;
  let closed = [];
  // Grille piégée : les cases ouvertes autour de l'explosion se referment
  if (lv.spec.event === 'traps') for (const j of area(b, i, 1)) if (j !== i && b.open[j] && !b.mine[j]) { b.open[j] = 0; closed.push(j); }
  if (run.lives <= 0 && has(run, 'second') && !run.secondUsed) { run.secondUsed = true; run.lives = 1; return { kind: 'second', i, cost, closed }; }
  if (run.lives <= 0) { run.lives = 0; run.phase = 'over'; run.endedAt = Date.now(); return { kind: 'dead', i, cost, closed }; }
  return { kind: 'boom', i, cost, closed };
}

export function open(run, i) {
  const lv = run.lv, b = lv.b;
  if (run.phase !== 'play' || b.open[i] || b.flag[i]) return null;
  if (lv.armed) return usePower(run, lv.armed, i);
  if (!b.generated) return finishCheck(run, { opened: firstClick(run, i) });
  // Coup forcé : si rien n'était déductible sur une grille qui n'a pas pu être rendue juste, la mine est déplacée.
  if (b.mine[i] && !b.fair && solvable(b, -1, true) < 0 && moveMine(b, i, run.rng)) return finishCheck(run, { opened: reveal(b, i), spared: true });
  if (b.mine[i]) return finishCheck(run, { opened: [], boom: explode(run, i) });
  return finishCheck(run, { opened: reveal(b, i) });
}
export function chord(run, i) {
  const b = run.lv.b;
  if (run.phase !== 'play') return null;
  const targets = chordTargets(b, i);
  if (!targets.length) return null;
  const res = { opened: [] };
  for (const j of targets) {
    if (b.open[j]) continue;
    if (b.mine[j]) { res.boom = explode(run, j); if (run.phase === 'over') break; continue; }
    res.opened.push(...reveal(b, j));
  }
  return finishCheck(run, res);
}
export function toggleFlag(run, i) {
  const b = run.lv.b;
  if (run.phase !== 'play' || b.open[i] || !b.generated) return false;
  b.flag[i] ^= 1;
  return finishCheck(run, { opened: [], flagged: true });
}

// Grille gagnée : toutes les cases sûres ouvertes (et, contre le Démineur fou, toutes les mines marquées).
function finishCheck(run, res) {
  const lv = run.lv, b = lv.b;
  for (const o of res.opened) if (lv.spec.event === 'fog' && b.count[o.i]) lv.fogged[o.i] = Date.now() + 8000;
  if (run.phase !== 'play' || !b.generated || !cleared(b)) return res;
  if (lv.spec.boss?.needFlags) for (let i = 0; i < b.n; i++) if (b.mine[i] && !b.flag[i] && !b.exploded.includes(i)) return { ...res, needFlags: true };
  res.won = true;
  res.reward = completeLevel(run);
  return res;
}

/* ---------- Pouvoirs ---------- */
export const powerCount = (run, id) => (run.lv?.charges[id] || 0) + (run.items[id] || 0);
export function armPower(run, id) {
  if (run.phase !== 'play' || !powerCount(run, id)) return false;
  if (!POWERS[id].target) return id === 'reveal' && !run.lv.b.generated ? false : usePower(run, id, null);
  run.lv.armed = run.lv.armed === id ? null : id;
  return true;
}
function spend(run, id) {
  const lv = run.lv;
  if (lv.charges[id]) lv.charges[id]--; else run.items[id]--;
  lv.usedPower = true;
  lv.armed = null;
}
export function usePower(run, id, i) {
  const lv = run.lv, b = lv.b;
  if (!powerCount(run, id)) return null;
  if (POWERS[id].target && (!b.generated || b.open[i])) return null; // les pouvoirs ciblés s'utilisent après le premier clic
  spend(run, id);
  if (id === 'shield') { lv.shield++; return { power: id }; }
  if (id === 'reveal') {
    if (!b.generated) return { power: id, opened: [] };
    let s = solvable(b, -1, true); // une case que la déduction permettait de trouver
    if (s < 0) s = randomCell(run, j => !b.mine[j] && !b.open[j] && !b.flag[j]);
    return finishCheck(run, { power: id, at: s, opened: s === undefined ? [] : reveal(b, s) });
  }
  if (id === 'scan' || id === 'radar') {
    const cells = area(b, i, id === 'scan' ? 1 : 2), value = cells.filter(j => b.mine[j]).length;
    lv.markers.push({ i, r: id === 'scan' ? 1 : 2, value });
    return { power: id, at: i, value, cells };
  }
  if (id === 'detect') { lv.detected[i] = b.mine[i] ? 'mine' : 'safe'; return { power: id, at: i, value: lv.detected[i] }; }
  if (id === 'defuse') {
    if (b.mine[i]) { b.mine[i] = 0; b.mines--; b.flag[i] = 0; recount(b); run.minesAvoided++; }
    return finishCheck(run, { power: id, at: i, defused: true, opened: reveal(b, i) });
  }
  return null;
}

/* ---------- Fin de grille : pièces, choix d'améliorations, boutique ---------- */
export function completeLevel(run) {
  const lv = run.lv, b = lv.b, spec = lv.spec;
  const perfect = lv.hits === 0;
  const seconds = (Date.now() - (lv.startedAt || Date.now())) / 1000;
  const lines = [];
  let coins = 8 + spec.n * 4 + Math.round(spec.mines * 0.6);
  lines.push(['Grille terminée', coins]);
  const add = (label, n) => { if (n) { coins += n; lines.push([label, n]); } };
  if (perfect) { run.streak++; add('Sans erreur', Math.round(coins * 0.3)); } else run.streak = 0;
  if (has(run, 'streak') && perfect) add(`Bonus de série ×${run.streak}`, 6 * run.streak * has(run, 'streak'));
  if (has(run, 'risky') && !lv.usedPower) add('Récompense risquée', Math.round(coins * 0.8 * has(run, 'risky')));
  if (spec.event === 'timed' && seconds <= spec.time) add('Défi chronométré réussi', Math.round(coins * 0.6));
  if (has(run, 'midas')) add('Midas : cases ouvertes', Math.floor(b.n / 10));
  let mult = 1 + 0.25 * has(run, 'purse');
  if (has(run, 'midas')) mult *= 2;
  if (spec.event === 'double') mult *= 2;
  if (spec.event === 'cursed') mult *= 2.5;
  if (spec.boss) mult *= 3;
  if (run.doubleNext) { mult *= 2; run.doubleNext = false; }
  const total = Math.round(coins * mult);
  if (mult !== 1) lines.push([`Multiplicateur ×${mult.toFixed(2).replace(/\.?0+$/, '')}`, total - coins]);
  run.coins += total;
  run.earned += total;
  run.cleared++;
  run.minesAvoided += b.mines - b.exploded.length;
  let bonusLife = 0;
  if (spec.boss) { run.bosses++; bonusLife++; }
  if (has(run, 'insurance') && spec.n % 5 === 0) bonusLife++;
  run.lives += bonusLife;
  run.log.push({ level: spec.n, coins: total, perfect, boss: spec.boss?.id, event: spec.event });
  // Choix d'améliorations (2 à prendre après un boss ou tous les 3 niveaux avec Double choix)
  run.picksLeft = has(run, 'double') && (spec.boss || spec.n % 3 === 0) ? 2 : 1;
  run.choices = drawUpgrades(run, 3, spec.boss ? 1 : 0);
  run.phase = 'reward';
  run.afterShop = spec.n % 2 === 0 || !!spec.boss || spec.event === 'merchant';
  return { total, lines, perfect, bonusLife, boss: spec.boss, seconds };
}

const available = run => UPGRADES.filter(u => (!u.unlock || run.meta.unlocked?.includes(u.unlock)) && has(run, u.id) < u.max);
// Tirage pondéré par rareté ; « boost » (boss) et Chance déplacent les chances vers le rare.
export function drawUpgrades(run, n, boost = 0) {
  const pool = available(run), out = [];
  const lucky = has(run, 'luck') + boost;
  const weight = u => RARITY[u.rarity].weight * (u.rarity === 'common' ? Math.pow(0.6, lucky) : Math.pow(1.8, lucky));
  while (out.length < n && pool.length) {
    const total = pool.reduce((s, u) => s + weight(u), 0);
    let r = run.rng() * total, k = 0;
    while (r > weight(pool[k])) { r -= weight(pool[k]); k++; }
    out.push(pool.splice(Math.min(k, pool.length - 1), 1)[0].id);
  }
  return out;
}
export function rerollCost(run) { return 8 + run.level * 2; }
export function reroll(run) {
  const cost = rerollCost(run);
  if (run.phase !== 'reward' || run.coins < cost) return false;
  run.coins -= cost;
  run.choices = drawUpgrades(run, 3);
  return true;
}
export function pickUpgrade(run, id) {
  if (run.phase !== 'reward' || !run.choices.includes(id)) return false;
  const u = UPGRADES.find(x => x.id === id);
  run.upgrades[id] = has(run, id) + 1;
  if (id === 'heart') run.lives++;
  run.picksLeft--;
  run.choices = run.choices.filter(x => x !== id);
  if (run.picksLeft > 0 && run.choices.length) return u;
  run.choices = [];
  if (run.afterShop) openShop(run); else nextLevel(run);
  return u;
}
export const skipUpgrade = run => { run.picksLeft = 0; run.choices = []; if (run.afterShop) openShop(run); else nextLevel(run); };

// Boutique : vies, pouvoirs à usage unique, amélioration, bonus temporaire ; le marchand ajoute un objet rare soldé.
export function openShop(run) {
  const lvl = run.level, items = [
    { id: 'life', name: 'Vie supplémentaire', icon: '❤️', price: 30 + lvl * 4, stock: 2 },
    ...['scan', 'detect', 'shield', 'radar', 'reveal', 'defuse'].map(p => ({ id: `item:${p}`, name: POWERS[p].name, icon: POWERS[p].icon, desc: `${POWERS[p].desc} (usage unique)`, price: { scan: 12, detect: 16, shield: 26, radar: 22, reveal: 28, defuse: 32 }[p] + lvl, stock: 3 })),
    { id: 'doubleNext', name: 'Pièces doublées', icon: '✖️2', desc: 'Sur la prochaine grille.', price: 25 + lvl * 2, stock: 1 },
  ];
  const up = drawUpgrades(run, 1, 1)[0];
  if (up) items.push({ id: `up:${up}`, name: UPGRADES.find(u => u.id === up).name, icon: UPGRADES.find(u => u.id === up).icon, desc: UPGRADES.find(u => u.id === up).desc, price: 55 + lvl * 3, stock: 1, rarity: UPGRADES.find(u => u.id === up).rarity });
  if (run.lv?.spec.event === 'merchant') {
    const rare = drawUpgrades(run, 1, 3)[0];
    if (rare) { const u = UPGRADES.find(x => x.id === rare); items.unshift({ id: `up:${rare}`, name: u.name, icon: u.icon, desc: u.desc, price: Math.round((50 + lvl * 3) * 0.6), stock: 1, rarity: u.rarity, special: true }); }
  }
  run.shop = items;
  run.phase = 'shop';
}
export function buy(run, id) {
  const it = run.shop?.find(x => x.id === id);
  if (!it || !it.stock || run.coins < it.price) return false;
  run.coins -= it.price;
  it.stock--;
  if (id === 'life') run.lives++;
  else if (id === 'doubleNext') run.doubleNext = true;
  else if (id.startsWith('item:')) { const p = id.slice(5); run.items[p] = (run.items[p] || 0) + 1; }
  else if (id.startsWith('up:')) { const u = id.slice(3); run.upgrades[u] = has(run, u) + 1; if (u === 'heart') run.lives++; }
  it.price = Math.round(it.price * 1.35); // racheter coûte plus cher
  return true;
}
export const leaveShop = run => { run.shop = null; nextLevel(run); };
