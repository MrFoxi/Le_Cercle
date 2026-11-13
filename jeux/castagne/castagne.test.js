// Tests de La Castagne : sauts (un au sol, deux en l'air), planches traversables, éjection qui grandit avec les dégâts,
// vie perdue hors de l'arène puis retour, touches mal formées refusées, parties complètes entre robots.
const assert = require('assert');
const BR = require('./client/sim');
const { Room } = require('./server/game');
const { IN } = BR;
const A = BR.ARENAS.phare;

const run = (f, bits, n) => { for (let k = 0; k < n; k++) BR.step(f, typeof bits === 'function' ? bits(k) : bits, A); };
const settle = f => run(f, 0, 90);

// Sauts : un au sol, deux en l'air, pas un de plus ; on retrouve ses sauts en atterrissant.
{
  const f = BR.fighter('a', 'fenna', [0, -10]);
  settle(f);
  assert(f.ground && f.y === 0, 'posé sur l’île');
  run(f, k => (k % 20 < 2 ? IN.JUMP : 0), 50);
  assert(!f.ground && f.jumps === 0, 'les deux sauts en l’air utilisés');
  const before = f.vy; BR.step(f, IN.JUMP, A);
  assert(f.vy > before, 'pas de quatrième saut : on continue de retomber');
  settle(f);
  assert(f.ground && f.jumps === 2, 'sauts retrouvés au sol');
}

// Planche : on la traverse en montant, on s'y pose en descendant, bas pour la traverser.
{
  const p = A.plats[0], f = BR.fighter('a', 'fenna', [(p.x0 + p.x1) / 2, p.y - 200]);
  settle(f);
  assert(f.ground && Math.abs(f.y - p.y) < 0.01, 'posé sur la planche');
  run(f, IN.D, 2); run(f, 0, 60);
  assert(f.ground && f.y === 0, 'retombé sur l’île après avoir traversé la planche');
}

// Éjection : plus forte quand on a déjà beaucoup de dégâts.
function launch(dmg) {
  const a = BR.fighter('a', 'gromm', [0, 0]), b = BR.fighter('b', 'fenna', [60, 0]);
  settle(a); settle(b);
  a.facing = 1; b.dmg = dmg;
  const ev = [];
  for (let k = 0; k < 40 && !ev.length; k++) { BR.step(a, k === 0 ? IN.HEAVY | IN.R : IN.R, A); BR.step(b, 0, A); BR.resolve([a, b], ev); }
  assert.strictEqual(ev.length, 1, 'le coup touche');
  assert(b.dmg > dmg && b.state === 'hitstun' && b.vx > 0, 'dégâts, recul vers l’avant');
  return Math.hypot(b.vx, b.vy);
}
assert(launch(120) > launch(0) * 2, 'éjection bien plus forte à 120 de dégâts');

// Esquive : invulnérable, le coup ne passe pas.
{
  const a = BR.fighter('a', 'fenna', [0, 0]), b = BR.fighter('b', 'fenna', [50, 0]);
  settle(a); settle(b); a.facing = 1;
  BR.step(b, IN.DODGE, A);
  const ev = [];
  for (let k = 0; k < 12; k++) { BR.step(a, k === 0 ? IN.LIGHT : 0, A); BR.step(b, 0, A); BR.resolve([a, b], ev); }
  assert(!ev.some(e => e.t === 'hit'), 'esquive réussie');
}

// Hors de l'arène : une vie de moins, retour en haut, invulnérable un moment ; plus de vie : éliminé.
{
  const w = BR.world('phare', [{ id: 'a', char: 'fenna' }, { id: 'b', char: 'gromm' }], 2);
  const [a] = w.fighters;
  a.x = A.blast.r + 10;
  const ev = BR.stepWorld(w, {});
  assert(ev.some(e => e.t === 'ko' && e.id === 'a') && a.stocks === 1);
  for (let k = 0; k < 101; k++) BR.stepWorld(w, {});
  assert(a.state === 'air' && a.invuln > 0 && a.dmg === 0 && a.y < 0, 'de retour');
  a.x = A.blast.l - 10; BR.stepWorld(w, {});
  for (let k = 0; k < 101; k++) BR.stepWorld(w, {});
  assert.strictEqual(a.state, 'out');
  assert.strictEqual(BR.alive(w).length, 1);
}

// Touches : numérotées dans l'ordre, valeurs bornées ; les mal formées sont ignorées.
{
  const r = new Room('ABCDE', Math.random, false, () => 0);
  r.addPlayer('Moi'); r.addBot('Moi');
  r.start('Moi'); r.stop();
  r.input('Moi', [[1, 2], [2, 2000], ['x', 1], [1, 4], [3, IN.JUMP]]);
  assert.deepStrictEqual(r.queues.Moi, [[1, 2], [3, IN.JUMP]]);
  r.input('Moi', 'n’importe quoi');
  assert.throws(() => r.pick('Moi', 'dragon'), /inconnu/);
}

// Rebord : en tombant près du bord, on s'accroche ; haut pour remonter sur l'île.
{
  const S = A.solids[0], f = BR.fighter('a', 'fenna', [S.x1 + BR.HW + 4, -40]);
  for (let k = 0; k < 40 && f.state !== 'ledge'; k++) BR.step(f, 0, A);
  assert.strictEqual(f.state, 'ledge', 'accroché au rebord');
  BR.step(f, IN.U, A);
  assert(f.ground && f.y === 0 && f.x < S.x1, 'remonté sur l’île');
}

// Armes : une caisse tombe, on la ramasse (les coups changent), on la lance sur quelqu'un.
{
  const w = BR.world('phare', [{ id: 'a', char: 'gromm' }, { id: 'b', char: 'fenna' }], 3), [a, b] = w.fighters;
  for (let k = 0; k < 60; k++) BR.stepWorld(w, {});
  w.items.push({ id: 99, x: a.x, y: a.y, vy: 0, ground: true, life: 500, kind: 'arme' });
  const ev = BR.stepWorld(w, { a: IN.PICK });
  assert(ev.some(e => e.t === 'pick') && BR.CHARS.gromm.weapons.includes(a.weapon), 'arme ramassée');
  assert.notStrictEqual(BR.movesOf(a).sHeavy.hits[0].dmg, BR.CHARS.gromm.moves.sHeavy.hits[0].dmg, 'les coups changent avec l’arme');
  Object.assign(b, { x: a.x + 160, y: a.y }); a.facing = 1;
  BR.stepWorld(w, {}); BR.stepWorld(w, { a: IN.PICK });
  assert(a.weapon === null && w.shots.length === 1, 'arme lancée');
  let hit = false;
  for (let k = 0; k < 30 && !hit; k++) hit = BR.stepWorld(w, {}).some(e => e.t === 'hit' && e.b === 'b');
  assert(hit && b.dmg > 0, 'l’arme lancée touche');
}

// Pistolets : le coup léger tire une balle qui touche de loin.
{
  const w = BR.world('phare', [{ id: 'a', char: 'fenna' }, { id: 'b', char: 'gromm' }], 3), [a, b] = w.fighters;
  for (let k = 0; k < 60; k++) BR.stepWorld(w, {});
  a.weapon = 'pistolets'; a.wdur = 14; Object.assign(b, { x: a.x + 300, y: a.y }); a.facing = 1;
  let hit = false;
  for (let k = 0; k < 50 && !hit; k++) hit = BR.stepWorld(w, { a: k === 0 ? IN.LIGHT : 0 }).some(e => e.t === 'hit' && e.b === 'b');
  assert(hit, 'la balle touche à 300 px');
}

// Combo et esquive qui annule : deux coups enchaînés comptent ×2 ; l'esquive annule un coup qui a touché.
{
  const a = BR.fighter('a', 'fenna', [0, 0]), b = BR.fighter('b', 'gromm', [50, 0]);
  settle(a); settle(b); a.facing = 1;
  const ev = [];
  for (let k = 0; k < 12; k++) { BR.step(a, k === 0 ? IN.LIGHT : 0, A); BR.step(b, 0, A); BR.resolve([a, b], ev); }
  assert.strictEqual(ev.length, 1);
  while (a.hitlag > 0) BR.step(a, 0, A);
  BR.step(a, IN.DODGE, A);
  assert.strictEqual(a.state, 'dodge', 'l’esquive annule le coup');
  b.state = 'hitstun'; b.hitstun = 30; b.invuln = 0; b.combo = 1;
  const a2 = BR.fighter('c', 'fenna', [b.x - 50, 0]); settle(a2); a2.facing = 1;
  for (let k = 0; k < 12; k++) { BR.step(a2, k === 0 ? IN.LIGHT : 0, A); BR.resolve([a2, b], ev); }
  assert(ev.at(-1).combo >= 2, 'combo compté');
}

// Équipes : pas de coup entre coéquipiers ; duel à 2, équipes en nombre pair.
{
  const a = BR.fighter('a', 'fenna', [0, 0]), b = BR.fighter('b', 'gromm', [50, 0]);
  settle(a); settle(b); a.facing = 1; a.team = b.team = 'rouge';
  const ev = [];
  for (let k = 0; k < 12; k++) { BR.step(a, k === 0 ? IN.LIGHT : 0, A); BR.resolve([a, b], ev); }
  assert.strictEqual(ev.length, 0, 'pas de coup entre coéquipiers');
  const r = new Room('MODE1', Math.random, false, () => 0);
  r.addPlayer('Moi'); r.addBot('Moi'); r.addBot('Moi');
  r.configure('Moi', 'mode', 'duel');
  assert.throws(() => r.start('Moi'), /2 exactement/);
  r.configure('Moi', 'mode', 'teams');
  assert.throws(() => r.start('Moi'), /pair/);
  r.addBot('Moi'); r.start('Moi'); r.stop();
  assert.deepStrictEqual(new Set(r.world.fighters.map(f => f.team)), new Set(['rouge', 'bleu']));
}

// Mémoire des touches : un coup demandé pendant le précédent part dès que possible ; portée d'au moins 80 px.
{
  const f = BR.fighter('a', 'fenna', [0, 0]); settle(f); f.facing = 1;
  BR.step(f, IN.LIGHT, A); BR.step(f, 0, A);
  run(f, k => (k === 13 ? IN.HEAVY : 0), 14);
  for (let k = 0; k < 40 && f.move !== 'nHeavy'; k++) BR.step(f, 0, A);
  assert.strictEqual(f.move, 'nHeavy', 'le coup lourd demandé trop tôt est parti');
  assert(BR.CHARS.fenna.moves.jab.hits[0].x + BR.CHARS.fenna.moves.jab.hits[0].w / 2 >= 80, 'portée du coup léger');
}

// Serveur en retard : il calcule les images manquées (au plus 5 d'un coup).
{
  let now = 0;
  const r = new Room('LAG01', Math.random, false, () => now);
  r.addPlayer('Moi'); r.addBot('Moi'); r.start('Moi'); r.stop();
  now = r.deadline; r.timeout(); r.tick();
  const f0 = r.world.frame;
  now += 50; r.tick();
  assert.strictEqual(r.world.frame - f0, 3, '50 ms = 3 images');
}

// Signatures : chaque arme a ses coups légers et son trio de coups lourds ; on les charge en gardant la touche.
{
  const M = BR.MOVES.gromm;
  assert.notDeepStrictEqual(M.marteau.jab.hits[0].w, M.mains.jab.hits[0].w, 'coup léger propre à l’arme');
  assert(['nHeavy', 'sHeavy', 'dHeavy'].every(k => M.hache[k].sig && M.hache[k].fx), 'signatures avec effet');
  const hitWith = charge => {
    const a = BR.fighter('a', 'gromm', [0, 0]), b = BR.fighter('b', 'fenna', [70, 0]);
    settle(a); settle(b); a.facing = 1;
    const ev = [];
    for (let k = 0; k < 160 && !ev.length; k++) { BR.step(a, k === 0 || k < charge ? IN.HEAVY | (k === 0 ? IN.R : 0) : 0, A); BR.step(b, 0, A); BR.resolve([a, b], ev); }
    assert(ev.length, 'la signature touche');
    return b.dmg;
  };
  assert(hitWith(60) > hitWith(1) * 1.3, 'chargée, elle fait plus mal');
}

// Coup en plusieurs touches : les gantelets enchaînent leurs trois coups sur la même cible.
{
  const a = BR.fighter('a', 'gromm', [0, 0]), b = BR.fighter('b', 'fenna', [60, 0]);
  settle(a); settle(b); a.facing = 1; a.weapon = 'gantelets';
  const ev = [];
  for (let k = 0; k < 60; k++) { BR.step(a, k === 0 ? IN.LIGHT | IN.R : 0, A); BR.step(b, 0, A); BR.resolve([a, b], ev); }
  assert(ev.length >= 2, `plusieurs touches (${ev.length})`);
}

// Esquive parfaite (au dernier moment) : l'attaquant est étourdi. Esquives enchaînées : recharge de plus en plus longue.
{
  const a = BR.fighter('a', 'gromm', [0, 0]), b = BR.fighter('b', 'fenna', [70, 0]);
  settle(a); settle(b); a.facing = 1;
  const ev = [];
  for (let k = 0; k < 40 && !ev.length; k++) { BR.step(a, k === 0 ? IN.HEAVY | IN.R : 0, A); const h = BR.activeHits(a).length; BR.step(b, h && b.state !== 'dodge' ? IN.DODGE : 0, A); BR.resolve([a, b], ev); }
  assert(ev.some(e => e.t === 'perfect') && a.move === 'stunned', 'esquive parfaite');
  const f = BR.fighter('c', 'fenna', [0, 0]); settle(f);
  BR.step(f, IN.DODGE, A); const cd1 = f.dodgeCd;
  run(f, 0, cd1); BR.step(f, IN.DODGE, A);
  assert(f.dodgeCd > cd1, 'deuxième esquive plus longue à recharger');
}

// Garde : encaisse sans être éjecté, puis se brise.
{
  const a = BR.fighter('a', 'gromm', [0, 0]), b = BR.fighter('b', 'fenna', [60, 0]);
  settle(a); settle(b); a.facing = 1;
  BR.step(b, IN.SHIELD, A);
  assert.strictEqual(b.state, 'shield');
  const ev = [];
  for (let k = 0; k < 40; k++) { BR.step(a, k === 0 ? IN.LIGHT : 0, A); BR.step(b, IN.SHIELD, A); BR.resolve([a, b], ev); }
  assert(ev.some(e => e.t === 'block') && b.dmg === 0 && b.shield < BR.SHIELD, 'coup encaissé par la garde');
  b.shield = 3; a.hitIds = []; a.state = 'idle';
  for (let k = 0; k < 40; k++) { BR.step(a, k === 0 ? IN.LIGHT : 0, A); BR.step(b, IN.SHIELD, A); BR.resolve([a, b], ev); }
  assert(ev.some(e => e.t === 'break') && b.move === 'broken', 'garde brisée');
}

// Rattrapage : esquive en touchant le sol après un coup ; coups qui se croisent : « clang ».
{
  const f = BR.fighter('a', 'fenna', [0, -60]); settle(f);
  Object.assign(f, { y: -40, state: 'hitstun', hitstun: 40, vy: 4, vx: 0, ground: false });
  let teched = false;
  for (let k = 0; k < 30 && !teched; k++) { BR.step(f, k === 5 ? IN.DODGE : 0, A); teched = f.move === 'roll'; }
  assert(teched, 'rattrapé en roulant');
  const a = BR.fighter('a', 'fenna', [0, 0]), b = BR.fighter('b', 'fenna', [110, 0], -1);
  settle(a); settle(b); a.facing = 1; b.facing = -1;
  const ev = [];
  for (let k = 0; k < 20; k++) { BR.step(a, k === 0 ? IN.LIGHT : 0, A); BR.step(b, k === 0 ? IN.LIGHT : 0, A); BR.resolve([a, b], ev); }
  assert(ev.some(e => e.t === 'clash') && a.dmg === 0 && b.dmg === 0, 'les deux coups s’annulent');
}

// Rebord protégé une seule fois avant de retoucher le sol.
{
  const S = A.solids[0], f = BR.fighter('a', 'fenna', [S.x1 + BR.HW + 4, -40]);
  for (let k = 0; k < 40 && f.state !== 'ledge'; k++) BR.step(f, 0, A);
  assert(f.invuln > 0);
  f.invuln = 0; BR.step(f, IN.D, A); run(f, 0, 45); f.x = S.x1 + BR.HW + 4; f.y = 30; f.vy = 2; f.state = 'air'; f.ledgeCd = 0;
  for (let k = 0; k < 20 && f.state !== 'ledge'; k++) BR.step(f, 0, A);
  assert(f.state === 'ledge' && f.invuln === 0, 'pas de deuxième protection');
}

// Arme usée : elle casse. Objets : potion, plume, bombe qui explose, boule de neige qui gèle.
{
  const w = BR.world('phare', [{ id: 'a', char: 'gromm' }, { id: 'b', char: 'fenna' }], 3), [a, b] = w.fighters;
  for (let k = 0; k < 60; k++) BR.stepWorld(w, {});
  a.weapon = 'marteau'; a.wdur = 0;
  assert(BR.stepWorld(w, {}).some(e => e.t === 'wbreak') && a.weapon === null, 'arme cassée');
  b.dmg = 40;
  w.items.push({ id: 90, x: b.x, y: b.y, ground: true, life: 99, kind: 'potion' }, { id: 91, x: a.x, y: a.y, ground: true, life: 99, kind: 'plume' });
  BR.stepWorld(w, {});
  assert(b.dmg === 15 && a.feather > 0 && a.jumps === 3, 'potion et plume');
  w.items.push({ id: 92, x: a.x, y: a.y, ground: true, life: 99, kind: 'bombe' });
  BR.stepWorld(w, {});
  assert.strictEqual(a.item, 'bombe');
  Object.assign(b, { x: a.x + 120, y: a.y, invuln: 0 }); a.facing = 1;
  BR.stepWorld(w, {}); BR.stepWorld(w, { a: IN.PICK });
  let boom = false;
  for (let k = 0; k < 130 && !boom; k++) boom = BR.stepWorld(w, {}).some(e => e.t === 'boom');
  assert(boom && b.dmg > 15, 'la bombe explose sur l’adversaire');
  for (let k = 0; k < 120; k++) BR.stepWorld(w, {});
  Object.assign(b, { x: a.x + 200, y: 0, invuln: 0, state: 'idle', vx: 0, vy: 0 });
  a.item = 'neige'; a.facing = 1; a.invuln = 0;
  BR.stepWorld(w, {}); BR.stepWorld(w, { a: IN.PICK });
  let frozen = false;
  for (let k = 0; k < 40 && !frozen; k++) frozen = BR.stepWorld(w, {}).some(e => e.t === 'freeze');
  assert(frozen && b.move === 'frozen', 'gelé par la boule de neige');
}

// Parties complètes entre robots : chaque manche se termine (un seul debout, ou le temps), la partie aussi.
for (let game = 0; game < 8; game++) {
  let now = 0;
  const r = new Room('BOTS1', Math.random, false, () => now);
  r.addPlayer('Moi');
  for (let k = 0; k < 1 + (game % 6); k++) r.addBot('Moi');
  r.configure('Moi', 'rounds', 1); r.configure('Moi', 'stocks', 1);
  if (game >= 6) { while (r.players.length < 4) r.addBot('Moi'); r.configure('Moi', 'mode', game === 6 ? 'teams' : 'lms'); }
  r.start('Moi'); r.stop();
  r.emit = () => {};
  now = r.deadline; r.timeout();
  assert.strictEqual(r.phase, 'fight');
  r.left('Moi'); // l'humain s'en va : les robots finissent entre eux
  let frames = 0;
  while (r.phase === 'fight' && frames++ < 60 * 300) { r.tick(); now += 1000 / 60; r.timeout(); }
  r.stop();
  assert.strictEqual(r.phase, 'roundEnd', `partie ${game} : la manche se termine`);
  assert.strictEqual(r.result.ranking.length, r.players.length);
  now = r.deadline; r.timeout(); r.stop();
  assert.strictEqual(r.phase, 'over');
}

console.log('La Castagne : tests OK');
