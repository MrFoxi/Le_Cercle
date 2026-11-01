// Une partie roguelike : niveaux, vies, pièces, personnages, améliorations (combinaisons, évolutions, pactes), pouvoirs,
// boutique, chemins, événements, boss. Aucune dépendance au DOM (testée par test-mines.mjs).
import { makeBoard, generate, reveal, chordTargets, cleared, area, recount, solvable, moveMine, carve } from './board.js';

export const RARITY = {
  common: { name: 'Commune', weight: 60 },
  rare: { name: 'Rare', weight: 28 },
  epic: { name: 'Épique', weight: 10 },
  legendary: { name: 'Légendaire', weight: 2 },
};

// Hasard reproductible : une graine donne la même partie (partie du jour, défi entre amis).
export function seeded(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export const seedOf = text => [...String(text)].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0, 2166136261);

// Personnages de départ : un avantage, un défaut.
export const CHARACTERS = {
  demineur: { name: 'Le Démineur', icon: '🪖', desc: 'Équilibré : 3 vies, aucune particularité.' },
  sapeur: { name: 'Le Sapeur', icon: '🧯', desc: '1 Désamorçage par grille, mais seulement 2 vies.', lives: 2, power: 'defuse', unlock: 'boss1' },
  banquier: { name: 'Le Banquier', icon: '💼', desc: '+50 % de pièces, mais pas de boutique au niveau 2.', coin: 1.5, unlock: 'rich' },
  voyant: { name: 'Le Voyant', icon: '🔮', desc: '1 Détecteur par grille, mais des grilles plus denses.', power: 'detect', density: 0.015, unlock: 'level10' },
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

// Améliorations : passives ou charges de pouvoir par grille. unlock : déblocage permanent ; max : exemplaires cumulables.
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
  // Pacte maudit : jamais tiré normalement, il remplace parfois une carte.
  { id: 'pact', name: 'Pacte maudit', icon: '🩸', rarity: 'legendary', desc: '−1 vie, mais une amélioration légendaire (ou épique) tout de suite.', max: 99, special: true },
];
export const UNLOCKS = { runs3: 'Joue 3 parties', boss1: 'Bats un boss', level10: 'Atteins le niveau 10', rich: 'Gagne 400 pièces en une partie' };

// Évolutions : à ce nombre d'exemplaires, l'amélioration devient plus forte.
export const EVOLUTIONS = {
  vision: { at: 3, name: 'Vision totale', desc: '4 cases sûres de plus au début de chaque grille.' },
  purse: { at: 4, name: 'Coffre-fort', desc: '+15 pièces à chaque grille terminée.' },
};
// Combinaisons cachées : deux améliorations précises débloquent un effet secret.
export const COMBOS = [
  { id: 'sonar', needs: ['p_scan', 'p_radar'], name: 'Sonar', icon: '🔊', desc: 'Un radar gratuit se place tout seul au début de chaque grille.' },
  { id: 'fortress', needs: ['shieldUp', 'second'], name: 'Forteresse', icon: '🏰', desc: '+1 bouclier par grille.' },
  { id: 'fortune', needs: ['purse', 'risky'], name: 'Fortune', icon: '💎', desc: '+3 pièces par drapeau juste en fin de grille.' },
  { id: 'oracle', needs: ['p_detect', 'vision'], name: 'Oracle', icon: '🧿', desc: 'Le détecteur ne s’use pas sur une case sûre.' },
];

// Événements (hasard, ou choisis sur le chemin entre deux niveaux)
export const EVENTS = {
  cursed: { name: 'Grille maudite', icon: '💀', desc: '40 % de mines en plus, mais ×2,5 pièces.' },
  safezone: { name: 'Zone sécurisée', icon: '🟩', desc: 'Une bande de la grille est garantie sans mine (surlignée).' },
  merchant: { name: 'Marchand mystérieux', icon: '🧙', desc: 'Après cette grille, un marchand vend un objet rare à prix réduit.' },
  double: { name: 'Double récompense', icon: '✖️2', desc: 'Pièces doublées sur cette grille.' },
  fog: { name: 'Brouillard', icon: '🌫️', desc: 'Les chiffres restent cachés 8 secondes après leur découverte.' },
  timed: { name: 'Défi chronométré', icon: '⏱️', desc: 'Finis avant la fin du chrono pour +60 % de pièces.' },
  traps: { name: 'Grille piégée', icon: '🧨', desc: 'Une explosion referme les cases ouvertes autour d’elle.' },
  treasure: { name: 'Chasse au trésor', icon: '🗝️', desc: '4 tas de pièces et un coffre cachés dans les cases sûres.' },
  stranger: { name: 'L’inconnu', icon: '🎭', desc: 'Un inconnu te fait une offre avant la grille.' },
  elite: { name: 'Grille d’élite', icon: '⚔️', desc: 'Plus dense, mais l’amélioration suivante sera rare ou mieux.' },
};
// Boss : tous les 5 niveaux, chacun avec sa contrainte (ils reviennent en boucle, de plus en plus durs)
export const BOSSES = [
  { id: 'colosse', name: 'Le Colosse', icon: '🗿', desc: 'Grille géante. Ses mines sont lourdes : chacune coûte 2 vies.', heavy: true },
  { id: 'ombre', name: 'L’Ombre', icon: '🌑', desc: 'Des cases muettes n’affichent aucun chiffre.', silent: 0.12 },
  { id: 'echo', name: 'L’Écho', icon: '🔔', desc: 'Les chiffres comptent les mines jusqu’à 2 cases de distance (carré 5 × 5).', radius: 2 },
  { id: 'fou', name: 'Le Démineur fou', icon: '🤡', desc: 'Pour gagner, il faut aussi poser un drapeau sur chaque mine. Quelques cases muettes.', needFlags: true, silent: 0.06 },
  { id: 'pendule', name: 'La Pendule', icon: '⏳', desc: 'Chaque fois que le sablier se vide, une vie s’en va (il se remplit à chaque case ouverte).', clock: 25 },
];

const has = (run, id) => run.upgrades[id] || 0;
const pick = (rng, list) => list[Math.floor(rng() * list.length)];
export const combosOf = run => COMBOS.filter(c => c.needs.every(id => has(run, id)));
const hasCombo = (run, id) => combosOf(run).some(c => c.id === id);
const evolved = (run, id) => EVOLUTIONS[id] && has(run, id) >= EVOLUTIONS[id].at;

export function newRun(rng = Math.random, meta = {}, { char = 'demineur', seed = null, daily = null } = {}) {
  const ch = CHARACTERS[char] || CHARACTERS.demineur;
  return {
    rng, meta, char: CHARACTERS[char] ? char : 'demineur', seed, daily, level: 0, lives: ch.lives || 3, coins: 0, earned: 0,
    upgrades: {}, items: {}, streak: 0, bestStreak: 0, cleared: 0, bosses: 0, minesAvoided: 0, secondUsed: false, maxCombo: 0,
    startedAt: Date.now(), phase: 'play', lv: null, choices: [], picksLeft: 0, shop: null, paths: null, offer: null, log: [], seen: { up: {}, boss: {}, event: {}, combo: {} },
  };
}

// Taille, mines et particularités du niveau n (event : imposé par le chemin choisi)
export function levelSpec(n, rng = Math.random, { event: forced, char } = {}) {
  const boss = n % 5 === 0 ? BOSSES[(n / 5 - 1) % BOSSES.length] : null;
  const loop = Math.floor((n - 1) / 25); // chaque tour des boss durcit un peu tout
  let w = Math.min(24, 8 + Math.ceil(n * 1.1)), h = Math.min(16, 8 + Math.floor(n * 0.6));
  let density = Math.min(0.2, 0.12 + n * 0.0055 + loop * 0.01) + (CHARACTERS[char]?.density || 0);
  if (boss) { w = Math.min(26, w + 4); h = Math.min(18, h + 3); density = Math.min(0.21, density + 0.015); }
  if (boss?.radius) density = Math.min(0.17, density); // compter sur 5 × 5 est déjà assez dur
  let event = forced ?? null;
  if (!boss && event === null && n >= 2 && rng() < 0.3) event = pick(rng, ['cursed', 'safezone', 'merchant', 'double', 'fog', 'timed', 'traps', 'treasure']);
  if (boss) event = null;
  if (event === 'cursed') density = Math.min(0.22, density * 1.4);
  if (event === 'elite') density = Math.min(0.22, density + 0.03);
  // Grilles de formes différentes : en losange ou trouées (à partir du niveau 4, hors boss)
  const shape = !boss && n >= 4 && rng() < 0.3 ? pick(rng, ['diamond', 'holes']) : null;
  return { n, w, h, density, mines: Math.round(w * h * density), boss, event, shape, time: event === 'timed' ? Math.round(w * h * 0.75) : 0 };
}

function shapeCells(spec, rng) {
  const out = [], { w, h } = spec;
  if (spec.shape === 'diamond') {
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (Math.abs(x - (w - 1) / 2) / (w / 2) + Math.abs(y - (h - 1) / 2) / (h / 2) > 1.15) out.push(y * w + x);
    }
  } else if (spec.shape === 'holes') {
    for (let k = 0; k < 3; k++) {
      const s = 2 + Math.floor(rng() * 2), x0 = 1 + Math.floor(rng() * (w - s - 2)), y0 = 1 + Math.floor(rng() * (h - s - 2));
      for (let y = y0; y < y0 + s; y++) for (let x = x0; x < x0 + s; x++) out.push(y * w + x);
    }
  }
  return out;
}

export function nextLevel(run, forcedEvent) {
  run.level++;
  const spec = levelSpec(run.level, run.rng, { event: forcedEvent, char: run.char });
  const b = makeBoard(spec.w, spec.h, spec.boss?.radius || 1);
  const voids = shapeCells(spec, run.rng);
  carve(b, voids);
  if (voids.length) spec.mines = Math.round((b.n - voids.length) * spec.density);
  // Zone sécurisée : une bande verticale garantie sans mine
  const safe = [];
  if (spec.event === 'safezone') {
    const x0 = Math.floor(run.rng() * (spec.w - 3));
    for (let y = 0; y < spec.h; y++) for (let x = x0; x < x0 + 3; x++) if (!b.void[y * spec.w + x]) safe.push(y * spec.w + x);
  }
  const charges = {};
  for (const u of UPGRADES) if (u.power && has(run, u.id)) charges[u.power] = (charges[u.power] || 0) + has(run, u.id);
  const ch = CHARACTERS[run.char];
  if (ch.power) charges[ch.power] = (charges[ch.power] || 0) + 1;
  run.lv = {
    spec, b, safe, charges, shield: has(run, 'shieldUp') + (hasCombo(run, 'fortress') ? 1 : 0), sixth: has(run, 'sixth'), hits: 0, usedPower: false,
    startedAt: null, markers: [], detected: {}, fogged: {}, armed: null, combo: 0, lastOpen: 0, maxCombo: 0, clockAt: null, loot: 0,
  };
  if (spec.boss) run.seen.boss[spec.boss.id] = 1;
  if (spec.event) run.seen.event[spec.event] = 1;
  // L'inconnu : une offre à accepter avant de jouer
  run.offer = spec.event === 'stranger' ? { coins: 40 + run.level * 5, card: drawUpgrades(run, 1, 2)[0] } : null;
  run.phase = 'play';
  return run.lv;
}
export function acceptOffer(run, what) {
  if (!run.offer) return false;
  let got = null;
  if (what === 'coins') { run.coins += run.offer.coins; run.earned += run.offer.coins; }
  if (what === 'card' && run.offer.card) got = gain(run, run.offer.card);
  run.offer = null;
  return got || true;
}

/* ---------- Pendant la grille ---------- */
// Premier clic : la grille est tirée autour de lui (zone vide garantie), puis les bonus de début de grille s'appliquent.
function firstClick(run, i) {
  const { b, spec, safe } = run.lv;
  generate(b, i, { mines: spec.mines, safe, silent: spec.boss?.silent || 0, rng: run.rng });
  run.lv.startedAt = run.lv.clockAt = Date.now();
  // Pièces et coffres cachés dans des cases sûres (à partir du niveau 3 ; beaucoup plus pendant une chasse au trésor)
  const piles = spec.event === 'treasure' ? 4 : run.level >= 3 ? 1 : 0, chests = spec.event === 'treasure' || run.rng() < 0.25 ? 1 : 0;
  for (let k = 0; k < piles + chests; k++) {
    const j = randomCell(run, x => !b.mine[x] && !b.void[x] && !b.loot[x] && !b.nb[i].includes(x) && x !== i);
    if (j !== undefined) b.loot[j] = k < piles ? 1 : 2;
  }
  const opened = reveal(b, i);
  // Expert : drapeaux justes sur des mines au bord de la zone ouverte ; Vision : cases sûres ouvertes.
  for (let k = 0; k < has(run, 'expert'); k++) {
    const m = frontier(b).find(j => b.mine[j] && !b.flag[j]) ?? randomCell(run, j => b.mine[j] && !b.flag[j]);
    if (m !== undefined) b.flag[m] = 1;
  }
  for (let k = 0; k < has(run, 'vision') * 2 + (evolved(run, 'vision') ? 4 : 0); k++) {
    const s = randomCell(run, j => !b.mine[j] && !b.open[j] && b.nb[j].some(x => b.open[x] && !b.void[x])) ?? randomCell(run, j => !b.mine[j] && !b.open[j]);
    if (s !== undefined) opened.push(...reveal(b, s).map(o => ({ ...o, d: o.d + 4 })));
  }
  // Sonar : un radar gratuit au bord de la zone ouverte
  if (hasCombo(run, 'sonar')) {
    const f = frontier(b), c = f.length ? pick(run.rng, f) : i;
    run.lv.markers.push({ i: c, r: 2, value: area(b, c, 2).filter(j => b.mine[j]).length });
  }
  return opened;
}
const frontier = b => { const out = []; for (let i = 0; i < b.n; i++) if (!b.open[i] && b.nb[i].some(j => b.open[j] && !b.mine[j] && !b.void[j])) out.push(i); return out; };
function randomCell(run, test) {
  const list = [];
  for (let i = 0; i < run.lv.b.n; i++) if (test(i)) list.push(i);
  return list.length ? pick(run.rng, list) : undefined;
}

// Pièces et coffres trouvés dans les cases qui viennent de s'ouvrir
function collect(run, opened) {
  const b = run.lv.b, found = [];
  for (const o of opened) {
    const kind = b.loot[o.i];
    if (!kind) continue;
    b.loot[o.i] = 0;
    if (kind === 1) { const n = 5 + run.level * 2; run.coins += n; run.earned += n; run.lv.loot += n; found.push({ i: o.i, coins: n }); }
    else { const p = pick(run.rng, Object.keys(POWERS)); run.items[p] = (run.items[p] || 0) + 1; found.push({ i: o.i, item: p }); }
  }
  return found;
}

// Explosion : bouclier, sixième sens, vies, seconde chance. Renvoie ce qui s'est passé pour l'animation.
function explode(run, i, cause = 'mine') {
  const lv = run.lv, b = lv.b;
  if (i !== null && lv.sixth) { lv.sixth--; b.flag[i] = 1; return { kind: 'sixth', i }; }
  if (i !== null) { b.open[i] = 1; b.exploded.push(i); }
  if (i !== null && lv.shield) { lv.shield--; return { kind: 'shield', i }; }
  lv.hits++;
  lv.combo = 0;
  run.streak = 0;
  const cost = lv.spec.boss?.heavy ? 2 : 1;
  run.lives -= cost;
  const closed = [];
  // Grille piégée : les cases ouvertes autour de l'explosion se referment
  if (i !== null && lv.spec.event === 'traps') for (const j of area(b, i, 1)) if (j !== i && b.open[j] && !b.mine[j] && !b.void[j]) { b.open[j] = 0; closed.push(j); }
  if (run.lives <= 0 && has(run, 'second') && !run.secondUsed) { run.secondUsed = true; run.lives = 1; return { kind: 'second', i, cost, closed }; }
  if (run.lives <= 0) { run.lives = 0; run.phase = 'over'; run.endedAt = Date.now(); run.cause = cause; return { kind: 'dead', i, cost, closed }; }
  return { kind: 'boom', i, cost, closed };
}

// Combo : des ouvertures rapprochées (moins de 2,5 s) sans erreur
function comboTick(run) {
  const lv = run.lv, now = Date.now();
  lv.combo = now - lv.lastOpen < 2500 ? lv.combo + 1 : 1;
  lv.lastOpen = now;
  lv.maxCombo = Math.max(lv.maxCombo, lv.combo);
  run.maxCombo = Math.max(run.maxCombo, lv.combo);
  lv.clockAt = now; // la Pendule se remplit à chaque case ouverte
}

export function open(run, i) {
  const lv = run.lv, b = lv.b;
  if (run.phase !== 'play' || run.offer || b.open[i] || b.flag[i]) return null;
  if (lv.armed) return usePower(run, lv.armed, i);
  if (!b.generated) { comboTick(run); const opened = firstClick(run, i); return finishCheck(run, { opened, loot: collect(run, opened) }); }
  // Coup forcé : si rien n'était déductible sur une grille qui n'a pas pu être rendue juste, la mine est déplacée.
  if (b.mine[i] && !b.fair && solvable(b, -1, true) < 0 && moveMine(b, i, run.rng)) { comboTick(run); const opened = reveal(b, i); return finishCheck(run, { opened, spared: true, loot: collect(run, opened) }); }
  if (b.mine[i]) return finishCheck(run, { opened: [], boom: explode(run, i) });
  comboTick(run);
  const opened = reveal(b, i);
  return finishCheck(run, { opened, loot: collect(run, opened) });
}
export function chord(run, i) {
  const b = run.lv.b;
  if (run.phase !== 'play' || run.offer) return null;
  const targets = chordTargets(b, i);
  if (!targets.length) return null;
  const res = { opened: [] };
  comboTick(run);
  for (const j of targets) {
    if (b.open[j]) continue;
    if (b.mine[j]) { res.boom = explode(run, j); if (run.phase === 'over') break; continue; }
    res.opened.push(...reveal(b, j));
  }
  res.loot = collect(run, res.opened);
  return finishCheck(run, res);
}
export function toggleFlag(run, i) {
  const b = run.lv.b;
  if (run.phase !== 'play' || b.open[i] || !b.generated) return false;
  b.flag[i] ^= 1;
  return finishCheck(run, { opened: [], flagged: true });
}
// La Pendule : le sablier vidé coûte une vie (appelée régulièrement par l'interface).
export function clockLeft(run) {
  const lv = run.lv, limit = lv?.spec.boss?.clock;
  if (!limit || !lv.clockAt || run.phase !== 'play') return null;
  return limit - (Date.now() - lv.clockAt) / 1000;
}
export function tickClock(run) {
  const left = clockLeft(run);
  if (left === null || left > 0) return null;
  run.lv.clockAt = Date.now();
  return { opened: [], boom: explode(run, null, 'temps') };
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
  run.powerUsed = true;
  lv.armed = null;
}
export function usePower(run, id, i) {
  const lv = run.lv, b = lv.b;
  if (!powerCount(run, id)) return null;
  if (POWERS[id].target && (!b.generated || b.open[i])) return null; // les pouvoirs ciblés s'utilisent après le premier clic
  spend(run, id);
  if (id === 'shield') { lv.shield++; return { power: id }; }
  if (id === 'reveal') {
    let s = solvable(b, -1, true); // une case que la déduction permettait de trouver
    if (s < 0) s = randomCell(run, j => !b.mine[j] && !b.open[j] && !b.flag[j]);
    const opened = s === undefined ? [] : reveal(b, s);
    return finishCheck(run, { power: id, at: s, opened, loot: collect(run, opened) });
  }
  if (id === 'scan' || id === 'radar') {
    const cells = area(b, i, id === 'scan' ? 1 : 2), value = cells.filter(j => b.mine[j]).length;
    lv.markers.push({ i, r: id === 'scan' ? 1 : 2, value });
    return { power: id, at: i, value, cells };
  }
  if (id === 'detect') {
    lv.detected[i] = b.mine[i] ? 'mine' : 'safe';
    if (!b.mine[i] && hasCombo(run, 'oracle')) lv.charges.detect = (lv.charges.detect || 0) + 1; // Oracle : charge rendue
    return { power: id, at: i, value: lv.detected[i] };
  }
  if (id === 'defuse') {
    if (b.mine[i]) { b.mine[i] = 0; b.mines--; b.flag[i] = 0; recount(b); run.minesAvoided++; }
    const opened = reveal(b, i);
    return finishCheck(run, { power: id, at: i, defused: true, opened, loot: collect(run, opened) });
  }
  return null;
}

/* ---------- Fin de grille : pièces, choix d'améliorations, boutique, chemin ---------- */
export function completeLevel(run) {
  const lv = run.lv, b = lv.b, spec = lv.spec;
  const perfect = lv.hits === 0;
  const seconds = (Date.now() - (lv.startedAt || Date.now())) / 1000;
  const lines = [];
  let coins = 8 + spec.n * 4 + Math.round(spec.mines * 0.6);
  lines.push(['Grille terminée', coins]);
  const add = (label, n) => { if (n) { coins += n; lines.push([label, n]); } };
  if (perfect) { run.streak++; run.bestStreak = Math.max(run.bestStreak, run.streak); add('Sans erreur', Math.round(coins * 0.3)); } else run.streak = 0;
  if (has(run, 'streak') && perfect) add(`Bonus de série ×${run.streak}`, 6 * run.streak * has(run, 'streak'));
  if (has(run, 'risky') && !lv.usedPower) add('Récompense risquée', Math.round(coins * 0.8 * has(run, 'risky')));
  if (spec.event === 'timed' && seconds <= spec.time) add('Défi chronométré réussi', Math.round(coins * 0.6));
  if (lv.maxCombo >= 5) add(`Combo ×${lv.maxCombo}`, lv.maxCombo * 2);
  if (has(run, 'midas')) add('Midas : cases ouvertes', Math.floor(b.n / 10));
  if (evolved(run, 'purse')) add('Coffre-fort', 15);
  if (hasCombo(run, 'fortune')) { let n = 0; for (let i = 0; i < b.n; i++) n += b.flag[i] && b.mine[i]; add('Fortune : drapeaux justes', n * 3); }
  let mult = (1 + 0.25 * has(run, 'purse')) * (CHARACTERS[run.char].coin || 1);
  if (has(run, 'midas')) mult *= 2;
  if (spec.event === 'double') mult *= 2;
  if (spec.event === 'cursed') mult *= 2.5;
  if (spec.boss) mult *= 3;
  if (run.doubleNext) { mult *= 2; run.doubleNext = false; }
  const total = Math.round(coins * mult);
  if (mult !== 1) lines.push([`Multiplicateur ×${+mult.toFixed(2)}`, total - coins]);
  if (lv.loot) lines.push(['Trésors trouvés dans la grille', lv.loot]);
  run.coins += total;
  run.earned += total;
  run.cleared++;
  run.minesAvoided += b.mines - b.exploded.length;
  let bonusLife = 0;
  if (spec.boss) { run.bosses++; bonusLife++; }
  if (has(run, 'insurance') && spec.n % 5 === 0) bonusLife++;
  run.lives += bonusLife;
  run.log.push({ level: spec.n, coins: total, perfect, boss: spec.boss?.id, event: spec.event });
  // Choix d'améliorations (2 après un boss ou tous les 3 niveaux avec Double choix) ; une grille d'élite garantit le rare.
  run.picksLeft = has(run, 'double') && (spec.boss || spec.n % 3 === 0) ? 2 : 1;
  run.choices = drawUpgrades(run, 3, spec.boss ? 1 : 0, spec.event === 'elite');
  // Pacte maudit : parfois proposé à la place d'une carte (à partir du niveau 3)
  if (run.level >= 3 && run.lives > 1 && run.choices.length && run.rng() < 0.18) run.choices[run.choices.length - 1] = 'pact';
  run.phase = 'reward';
  run.afterShop = (spec.n % 2 === 0 && !(run.char === 'banquier' && spec.n === 2)) || !!spec.boss || spec.event === 'merchant';
  return { total: total + lv.loot, lines, perfect, bonusLife, boss: spec.boss, seconds };
}

const available = run => UPGRADES.filter(u => !u.special && (!u.unlock || run.meta.unlocked?.includes(u.unlock)) && has(run, u.id) < u.max);
// Tirage pondéré par rareté ; « boost » (boss) et Chance déplacent les chances vers le rare ; rareOnly : grille d'élite.
export function drawUpgrades(run, n, boost = 0, rareOnly = false) {
  const pool = available(run).filter(u => !rareOnly || u.rarity !== 'common'), out = [];
  const lucky = has(run, 'luck') + boost;
  const weight = u => RARITY[u.rarity].weight * (u.rarity === 'common' ? Math.pow(0.6, lucky) : Math.pow(1.8, lucky));
  while (out.length < n && pool.length) {
    const total = pool.reduce((s, u) => s + weight(u), 0);
    let r = run.rng() * total, k = 0;
    while (k < pool.length - 1 && r > weight(pool[k])) { r -= weight(pool[k]); k++; }
    out.push(pool.splice(k, 1)[0].id);
  }
  return out;
}

// Gagne une amélioration : renvoie l'évolution atteinte et les combinaisons découvertes à cette occasion.
function gain(run, id) {
  if (id === 'pact') {
    run.lives = Math.max(1, run.lives - 1);
    const leg = available(run).filter(u => u.rarity === 'legendary');
    const pool = leg.length ? leg : available(run).filter(u => u.rarity === 'epic');
    return { ...(pool.length ? gain(run, pick(run.rng, pool).id) : {}), pact: true };
  }
  const before = new Set(combosOf(run).map(c => c.id));
  run.upgrades[id] = has(run, id) + 1;
  run.seen.up[id] = 1;
  if (id === 'heart') run.lives++;
  const fresh = combosOf(run).filter(c => !before.has(c.id));
  for (const c of fresh) run.seen.combo[c.id] = 1;
  return { id, evolved: EVOLUTIONS[id] && has(run, id) === EVOLUTIONS[id].at ? EVOLUTIONS[id] : null, combos: fresh };
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
  const got = gain(run, id);
  run.picksLeft--;
  run.choices = run.choices.filter(x => x !== id);
  if (!(run.picksLeft > 0 && run.choices.length)) afterReward(run);
  return got;
}
export function skipUpgrade(run) { run.picksLeft = 0; afterReward(run); }
function afterReward(run) {
  run.choices = [];
  if (run.afterShop) openShop(run); else toPath(run);
}

// Chemin : avant un niveau normal, on choisit entre la grille normale et deux autres routes (le boss ne se contourne pas).
const ROUTES = ['cursed', 'treasure', 'double', 'elite', 'stranger', 'safezone', 'fog', 'timed', 'merchant', 'shop'];
function toPath(run) {
  if ((run.level + 1) % 5 === 0) return nextLevel(run);
  const options = [...ROUTES];
  for (let k = options.length - 1; k > 0; k--) { const j = Math.floor(run.rng() * (k + 1)); [options[k], options[j]] = [options[j], options[k]]; }
  run.paths = [null, ...options.slice(0, 2)];
  run.phase = 'path';
}
export function choosePath(run, k) {
  if (run.phase !== 'path' || !(k in run.paths)) return false;
  const route = run.paths[k];
  run.paths = null;
  if (route === 'shop') { run.shopThenNormal = true; openShop(run); return true; }
  nextLevel(run, route);
  return true;
}

// Boutique : vies, pouvoirs à usage unique, amélioration, bonus ; le marchand ajoute un objet rare soldé ; on peut revendre.
export const sellPrice = (run, id) => ({ common: 10, rare: 20, epic: 35, legendary: 60 })[UPGRADES.find(u => u.id === id).rarity] + run.level;
export function openShop(run) {
  const lvl = run.level, items = [
    { id: 'life', name: 'Vie supplémentaire', icon: '❤️', price: 30 + lvl * 4, stock: 2 },
    ...['scan', 'detect', 'shield', 'radar', 'reveal', 'defuse'].map(p => ({ id: `item:${p}`, name: POWERS[p].name, icon: POWERS[p].icon, desc: `${POWERS[p].desc} (usage unique)`, price: { scan: 12, detect: 16, shield: 26, radar: 22, reveal: 28, defuse: 32 }[p] + lvl, stock: 3 })),
    { id: 'doubleNext', name: 'Pièces doublées', icon: '✖️2', desc: 'Sur la prochaine grille.', price: 25 + lvl * 2, stock: 1 },
  ];
  const card = id => { const u = UPGRADES.find(x => x.id === id); return { id: `up:${id}`, name: u.name, icon: u.icon, desc: u.desc, rarity: u.rarity, stock: 1 }; };
  const up = drawUpgrades(run, 1, 1)[0];
  if (up) items.push({ ...card(up), price: 55 + lvl * 3 });
  if (run.lv?.spec.event === 'merchant') {
    const rare = drawUpgrades(run, 1, 3)[0];
    if (rare) items.unshift({ ...card(rare), price: Math.round((50 + lvl * 3) * 0.6), special: true });
  }
  run.shop = items;
  run.phase = 'shop';
}
export function buy(run, id) {
  const it = run.shop?.find(x => x.id === id);
  if (!it || !it.stock || run.coins < it.price) return false;
  run.coins -= it.price;
  it.stock--;
  it.price = Math.round(it.price * 1.35); // racheter coûte plus cher
  if (id === 'life') run.lives++;
  else if (id === 'doubleNext') run.doubleNext = true;
  else if (id.startsWith('item:')) { const p = id.slice(5); run.items[p] = (run.items[p] || 0) + 1; }
  else if (id.startsWith('up:')) return gain(run, id.slice(3));
  return true;
}
export function sell(run, id) {
  if (run.phase !== 'shop' || !has(run, id) || id === 'heart') return false;
  run.coins += sellPrice(run, id);
  run.upgrades[id]--;
  if (!run.upgrades[id]) delete run.upgrades[id];
  return true;
}
export function leaveShop(run) {
  run.shop = null;
  if (run.shopThenNormal) { run.shopThenNormal = false; return nextLevel(run); }
  toPath(run);
}
