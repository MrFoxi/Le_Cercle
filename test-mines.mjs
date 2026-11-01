// Tests du démineur roguelike : grille (premier clic sûr, flot, accord, solveur), équité des grilles,
// partie complète jouée par déduction, améliorations, pouvoirs, boutique, événements, boss.
import assert from 'node:assert';
import { makeBoard, generate, reveal, chordTargets, solvable } from './public/mines/board.js';
import { newRun, nextLevel, open, chord, toggleFlag, armPower, usePower, pickUpgrade, skipUpgrade, buy, leaveShop, levelSpec, UPGRADES, BOSSES, EVENTS, powerCount } from './public/mines/run.js';

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
      if (run.phase === 'reward') pickUpgrade(run, run.choices[0]);
      if (run.phase === 'shop') { buy(run, 'life'); leaveShop(run); }
    }
    stats.levels += run.cleared;
    stats.bosses += run.bosses;
  }
  console.log(`  robot par déduction : ${stats.levels} grilles finies sur 4 parties, ${stats.bosses} boss battus, ${stats.guesses} coups devinés`);
  assert(stats.levels >= 40 && stats.bosses >= 6, 'le robot doit franchir des niveaux et des boss');
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
    assert.strictEqual(run.upgrades[id], 1);
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
      assert.strictEqual(run.level, 3);
    }
  }
}
console.log('Tests du démineur : OK');
