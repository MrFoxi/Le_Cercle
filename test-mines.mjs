// Tests du démineur roguelike : grille (premier clic sûr, flot, accord, solveur), équité des grilles,
// partie complète jouée par déduction, améliorations, pouvoirs, boutique, événements, boss.
import assert from 'node:assert';
import { makeBoard, generate, reveal, chordTargets, solvable } from './public/mines/board.js';
import { newRun, nextLevel, open, chord, toggleFlag, armPower, usePower, pickUpgrade, skipUpgrade, buy, sell, leaveShop, levelSpec, choosePath, acceptOffer, seeded, tickClock, combosOf, UPGRADES, BOSSES, EVENTS, CHARACTERS, powerCount } from './public/mines/run.js';

let seed = 3;
const rng = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

// Premier clic : jamais une mine, et il ouvre une zone (aucune mine autour).
for (let t = 0; t < 20; t++) {
  const b = makeBoard(16, 12), first = Math.floor(rng() * b.n);
  generate(b, first, { mines: 38, rng });
  assert(!b.mine[first] && b.nb[first].every(j => !b.mine[j]));
  const opened = reveal(b, first);
  assert(opened.length > 1, 'le premier clic ouvre une zone');
  assert.strictEqual(b.mines, 38);
}
// Équité : presque toutes les grilles générées se finissent sans deviner.
{
  let fair = 0;
  for (let t = 0; t < 30; t++) { const b = makeBoard(16, 12); fair += generate(b, 50, { mines: 34, rng }); }
  assert(fair >= 27, `grilles résolubles : ${fair}/30`);
}
// Accord : un chiffre entouré de ses drapeaux ouvre le reste.
{
  const b = makeBoard(3, 3);
  b.mine[0] = 1; b.count.fill(0); for (const j of b.nb[0]) b.count[j] = 1;
  b.open[4] = 1; b.flag[0] = 1; b.generated = true;
  assert.deepStrictEqual(chordTargets(b, 4).sort(), [1, 2, 3, 5, 6, 7, 8]);
}

// Robot qui joue par déduction : case sûre trouvée par le solveur, sinon il devine.
function playLevel(run, stats) {
  const b = run.lv.b;
  open(run, Math.floor(b.n / 2) + Math.floor(b.w / 2));
  for (let guard = 0; guard < 2000 && run.phase === 'play'; guard++) {
    let i = solvable(b, -1, true);
    if (i < 0) {
      // Démineur fou : tout est ouvert, il reste à marquer les mines
      const unmarked = [...Array(b.n).keys()].filter(j => b.mine[j] && !b.flag[j] && !b.open[j]);
      if (unmarked.length && [...Array(b.n).keys()].every(j => b.mine[j] || b.open[j])) { toggleFlag(run, unmarked[0]); continue; }
      stats.guesses++;
      const pool = [...Array(b.n).keys()].filter(j => !b.open[j] && !b.flag[j]);
      i = pool[Math.floor(rng() * pool.length)];
    }
    open(run, i);
  }
}
{
  const stats = { guesses: 0, levels: 0, bosses: 0 };
  for (let k = 0; k < 4; k++) {
    const run = newRun(rng, { unlocked: ['runs3', 'boss1', 'level10'] });
    nextLevel(run);
    while (run.phase !== 'over' && run.level < 16) {
      if (run.phase === 'play') playLevel(run, stats);
      if (run.offer) acceptOffer(run, 'coins');
      if (run.phase === 'reward') pickUpgrade(run, run.choices[0]);
      if (run.phase === 'shop') { buy(run, 'life'); leaveShop(run); }
      if (run.phase === 'path') choosePath(run, Math.floor(rng() * run.paths.length));
    }
    stats.levels += run.cleared;
    stats.bosses += run.bosses;
  }
  console.log(`  robot par déduction : ${stats.levels} grilles finies sur 4 parties, ${stats.bosses} boss battus, ${stats.guesses} coups devinés`);
  assert(stats.levels >= 40 && stats.bosses >= 6, 'le robot doit franchir des niveaux et des boss');
  assert(stats.guesses <= 4, `la déduction doit suffire (${stats.guesses} coups devinés)`);
}

// Difficulté croissante, boss tous les 5 niveaux
{
  const a = levelSpec(1, () => 0.99), c = levelSpec(9, () => 0.99), boss = levelSpec(5);
  assert(c.w * c.h > a.w * a.h && c.mines / (c.w * c.h) > a.mines / (a.w * a.h));
  assert.strictEqual(boss.boss.id, BOSSES[0].id);
  assert.strictEqual(levelSpec(10).boss.id, BOSSES[1].id);
  assert(UPGRADES.length >= 15 && Object.keys(EVENTS).length >= 7);
}

// Vies, bouclier, seconde chance
{
  const run = newRun(rng);
  nextLevel(run);
  open(run, 40);
  const b = run.lv.b, mine = () => [...Array(b.n).keys()].find(j => b.mine[j] && !b.open[j] && !b.flag[j]);
  run.lv.shield = 1;
  assert.strictEqual(open(run, mine()).boom.kind, 'shield');
  assert.strictEqual(run.lives, 3);
  open(run, mine());
  assert.strictEqual(run.lives, 2);
  run.upgrades.second = 1;
  open(run, mine());
  assert.strictEqual(open(run, mine()).boom.kind, 'second');
  assert.strictEqual(run.lives, 1);
  assert.strictEqual(open(run, mine()).boom.kind, 'dead');
  assert.strictEqual(run.phase, 'over');
}

// Pouvoirs : scanner, détecteur, désamorçage, révélation ; charges limitées
{
  const run = newRun(rng);
  run.upgrades = { p_scan: 1, p_detect: 1, p_defuse: 1, p_reveal: 1 };
  nextLevel(run);
  open(run, 40);
  const b = run.lv.b, hidden = [...Array(b.n).keys()].filter(j => !b.open[j]), mine = hidden.find(j => b.mine[j]);
  armPower(run, 'scan');
  const scan = open(run, hidden[0]);
  assert.strictEqual(scan.power, 'scan');
  assert.strictEqual(powerCount(run, 'scan'), 0);
  assert(!armPower(run, 'scan'), 'plus de charge');
  armPower(run, 'detect');
  assert.strictEqual(open(run, mine).value, 'mine');
  const before = b.mines;
  armPower(run, 'defuse');
  open(run, mine);
  assert(b.mines === before - 1 && !b.mine[mine] && b.open[mine], 'mine désamorcée');
  const res = armPower(run, 'reveal');
  assert(res && res.opened.length >= 1 && !b.mine[res.at], 'révélation d’une case sûre');
}

// Fin de grille : pièces, choix d'améliorations, boutique
{
  const run = newRun(rng);
  nextLevel(run);
  playLevel(run, { guesses: 0 });
  if (run.phase === 'reward') {
    assert(run.coins > 0 && run.choices.length === 3);
    const id = run.choices[0];
    pickUpgrade(run, id);
    if (id !== 'pact') assert.strictEqual(run.upgrades[id], 1);
    assert.strictEqual(run.phase, 'path', 'choix du chemin après la récompense');
    assert.strictEqual(run.paths.length, 3);
    choosePath(run, 0);
    assert.strictEqual(run.level, 2);
    playLevel(run, { guesses: 0 });
    if (run.phase === 'reward') {
      skipUpgrade(run);
      assert.strictEqual(run.phase, 'shop', 'boutique après le niveau 2');
      run.coins = 1000;
      const lives = run.lives;
      assert(buy(run, 'life') && run.lives === lives + 1);
      assert(buy(run, 'item:shield') && run.items.shield === 1);
      leaveShop(run);
      choosePath(run, 0);
      assert.strictEqual(run.level, 3);
    }
  }
}
// Nouveautés : graine, personnages, boss L'Écho et La Pendule, formes, trésors, pacte, combinaison, évolution, revente, inconnu
{
  // Même graine, même partie (premier clic identique)
  const play = () => { const r = newRun(seeded(1234)); nextLevel(r); open(r, 40); return Array.from(r.lv.b.mine).join(''); };
  assert.strictEqual(play(), play(), 'partie du jour reproductible');
  // Personnages
  const sap = newRun(rng, {}, { char: 'sapeur' });
  nextLevel(sap);
  assert(sap.lives === 2 && powerCount(sap, 'defuse') === 1);
  assert(CHARACTERS.banquier.coin === 1.5);
  // L'Écho (niveau 15) : chiffres sur 5 × 5, grille quand même résoluble
  const echo = levelSpec(15);
  assert.strictEqual(echo.boss.id, 'echo');
  const re = newRun(rng);
  re.level = 14;
  nextLevel(re);
  assert.strictEqual(re.lv.b.nb[re.lv.b.w * 5 + 5].length, 24, 'voisinage 5 × 5');
  open(re, re.lv.b.w * 6 + 8);
  assert(re.lv.b.fair, 'grille de L’Écho résoluble');
  // La Pendule (niveau 25) : le sablier vidé coûte une vie
  const rp = newRun(rng);
  rp.level = 24;
  nextLevel(rp);
  assert.strictEqual(rp.lv.spec.boss.id, 'pendule');
  open(rp, 60);
  rp.lv.clockAt -= 30000;
  const lives = rp.lives;
  assert(tickClock(rp).boom && rp.lives === lives - 1, 'la Pendule prend une vie');
  // Grille en losange : des cases vides, et des mines seulement dans la forme
  let shaped = null;
  for (let k = 0; k < 40 && !shaped; k++) { const r = newRun(rng); r.level = 5; nextLevel(r); if (r.lv.spec.shape) shaped = r; }
  assert(shaped, 'des formes apparaissent');
  open(shaped, [...Array(shaped.lv.b.n).keys()].find(i => !shaped.lv.b.void[i] && shaped.lv.b.nb[i].every(j => !shaped.lv.b.void[j])));
  for (let i = 0; i < shaped.lv.b.n; i++) if (shaped.lv.b.void[i]) assert(!shaped.lv.b.mine[i]);
  // Trésors : chasse au trésor → pièces trouvées en ouvrant les cases
  const rt = newRun(rng);
  rt.level = 3;
  nextLevel(rt, 'treasure');
  open(rt, 50);
  assert(rt.lv.b.loot.some(Boolean) || rt.lv.loot > 0, 'trésors cachés');
  // Pacte, combinaison, évolution, revente
  const r = newRun(rng, { unlocked: ['boss1', 'level10'] });
  nextLevel(r);
  r.phase = 'reward'; r.choices = ['pact']; r.picksLeft = 1; r.afterShop = false;
  const got = pickUpgrade(r, 'pact');
  assert(got.pact && r.lives === 2 && Object.keys(r.upgrades).some(id => UPGRADES.find(u => u.id === id).rarity === 'legendary'));
  r.upgrades.p_scan = 1; r.upgrades.p_radar = 1;
  assert(combosOf(r).some(c => c.id === 'sonar'), 'combinaison Sonar');
  r.phase = 'reward'; r.choices = ['vision']; r.upgrades.vision = 2; r.picksLeft = 1;
  assert(pickUpgrade(r, 'vision').evolved, 'évolution Vision totale');
  r.phase = 'shop'; r.shop = []; const c0 = r.coins;
  assert(sell(r, 'p_scan') && r.coins > c0 && !r.upgrades.p_scan);
  // L'inconnu : une offre avant la grille, qui bloque le jeu tant qu'on n'a pas répondu
  const rs = newRun(rng);
  rs.level = 2;
  nextLevel(rs, 'stranger');
  assert(rs.offer && open(rs, 40) === null);
  acceptOffer(rs, 'coins');
  assert(rs.coins > 0 && !rs.offer && open(rs, 40));
}
console.log('Tests du démineur : OK');
