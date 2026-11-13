// Tests de Caboche Cup (2D, vue de profil) : gestes de tir selon la course, but seulement sous la barre, barre qui renvoie
// (dessus du but compris), tête qui renvoie, tacle qui fait tomber, sprint qui use l'endurance, pouvoirs, touches mal
// formées refusées, match complet contre un robot, forfait.
const assert = require('assert');
const CC = require('./client/sim');
const { Room } = require('./server/game');
const { IN, F, BALL, WALL } = CC;

const mk = () => CC.world([{ id: 'a', char: 'bouboule' }, { id: 'b', char: 'lila' }]);
const run = (w, inputs, n) => { const ev = []; let side = null; for (let k = 0; k < n && side === null; k++) side = CC.stepWorld(w, typeof inputs === 'function' ? inputs(k) : inputs, ev); return { ev, side }; };
const away = w => { w.players[1].x = 12; }; // l'adversaire loin du ballon

// Tir : le geste dépend de la course (piqué à l'arrêt, frappe en avançant, boulet en sprint, lob en reculant, volée en l'air).
function kick(prep, bits) {
  const w = mk(), [a] = w.players; away(w); prep(a);
  Object.assign(w.ball, { x: a.x + 0.6, y: BALL.r, vx: 0, vy: 0 });
  const { ev } = run(w, k => ({ a: k === 0 ? bits | IN.KICK : bits }), 6);
  return { e: ev.find(e => e.t === 'kick'), b: w.ball };
}
{
  const still = kick(() => {}, 0), fwd = kick(a => (a.vx = 6), IN.R), boulet = kick(a => (a.vx = 8.5), IN.R | IN.SPRINT), lob = kick(a => (a.vx = -5), IN.L);
  assert.deepStrictEqual([still.e?.kind, fwd.e?.kind, boulet.e?.kind, lob.e?.kind], ['pique', 'frappe', 'boulet', 'lob']);
  assert(fwd.b.vx > 15 && boulet.b.vx > fwd.b.vx, 'la frappe part fort vers le but adverse, le boulet encore plus');
  assert(lob.b.vy > lob.b.vx, 'le lob monte plus qu’il n’avance');
  const air = mk(), [p] = air.players; away(air); Object.assign(p, { y: 1, vy: 2, ground: false });
  Object.assign(air.ball, { x: p.x + 0.5, y: 1.4, vx: 0, vy: 0 });
  assert.strictEqual(run(air, k => ({ a: k === 0 ? IN.KICK : 0 }), 4).ev.find(e => e.t === 'kick')?.kind, 'volee');
}

// But : seulement sous la barre ; au-dessus, le ballon rebondit sur le dessus de la cage. Des deux côtés.
{
  const w = mk(); w.players.forEach(p => (p.x = 0));
  Object.assign(w.ball, { x: F.HL - 2, y: 1, vx: 18, vy: 0 });
  assert.strictEqual(run(w, {}, 60).side, 0, 'but pour le joueur de gauche');
  const w2 = mk(); w2.players.forEach(p => (p.x = 0));
  Object.assign(w2.ball, { x: F.HL + 0.8, y: F.GH + 1.2, vx: 0, vy: 0 });
  const r2 = run(w2, {}, 120);
  assert.strictEqual(r2.side, null, 'tombé sur la cage : pas de but');
  assert(w2.ball.y > F.GH, 'le ballon reste sur le dessus de la cage');
  const w3 = mk(); w3.players.forEach(p => (p.x = 0));
  Object.assign(w3.ball, { x: -F.HL + 2, y: 1, vx: -18, vy: 0 });
  assert.strictEqual(run(w3, {}, 60).side, 1, 'but pour le joueur de droite');
}

// Barre : le ballon qui la frappe de face repart en arrière (« post »).
{
  const w = mk(); w.players.forEach(p => (p.x = 0));
  Object.assign(w.ball, { x: F.HL - 2, y: F.GH, vx: 18, vy: 0 });
  const { ev, side } = run(w, {}, 40);
  assert(ev.some(e => e.t === 'post'), 'barre touchée');
  assert.strictEqual(side, null); assert(w.ball.vx < 0, 'ballon renvoyé');
  assert(Math.abs(w.ball.x) <= WALL, 'jamais hors du stade');
}

// Tête : un ballon qui tombe sur la tête repart vers le haut ; en sautant dedans, il part vers l'avant.
{
  const w = mk(), [a] = w.players; away(w);
  Object.assign(w.ball, { x: a.x + 0.1, y: 4, vx: 0, vy: 0 });
  const { ev } = run(w, k => ({ a: k === 20 ? IN.JUMP : 0 }), 50);
  assert(ev.some(e => e.t === 'header' && e.id === 'a'), 'tête');
  assert(w.ball.vx > 0, 'renvoyé vers le but adverse');
}

// Tacle : il fait tomber l'adversaire (étourdi un moment, ses touches ne font plus rien).
{
  const w = mk(), [a, b] = w.players;
  a.x = -2; b.x = -0.6; w.ball.x = 6;
  const { ev } = run(w, k => ({ a: k === 0 ? IN.TACKLE | IN.R : 0 }), 30);
  assert(ev.some(e => e.t === 'fall' && e.id === 'b'), 'adversaire tombé');
  assert(b.stun > 0, 'étourdi');
  const x = b.x; run(w, { b: IN.L }, 5); assert(Math.abs(b.x - x) < 0.6, 'ne court pas pendant qu’il est au sol');
}

// Sprint : plus rapide, mais l'endurance s'use ; à zéro, plus de sprint tant qu'on n'a pas soufflé.
{
  const a = CC.player('a', 'bouboule', 0); a.x = 11; // le joueur seul, avec de la place pour courir vers la gauche
  const go = (bits, n) => { for (let k = 0; k < n; k++) CC.step(a, bits); };
  go(IN.L, 60); const walk = Math.abs(a.vx);
  go(IN.L | IN.SPRINT, 30); assert(Math.abs(a.vx) > walk * 1.3, 'sprint plus rapide');
  go(IN.L | IN.SPRINT, 150);
  assert(a.tired && !a.sprint, 'essoufflé');
  go(0, 90); assert(!a.tired, 'endurance revenue');
}

// Pouvoirs : jauge pleine → E ; Tête Géante double la tête, Super Tir enflamme le prochain tir.
{
  const w = mk(), [a, b] = w.players;
  run(w, { a: IN.POWER }, 3); assert.strictEqual(a.power, null, 'jauge vide : rien');
  b.gauge = 1; run(w, k => ({ b: k === 0 ? IN.POWER : 0 }), 2);
  assert.strictEqual(b.power, 'tete'); assert.strictEqual(CC.headR(b), CC.CHARS.lila.head * 2);
  a.gauge = 1; run(w, k => ({ a: k === 0 ? IN.POWER : 0 }), 2); assert.strictEqual(a.power, 'super');
  b.x = 12; Object.assign(w.ball, { x: a.x + 0.6, y: BALL.r, vx: 0, vy: 0 });
  const { ev } = run(w, k => ({ a: k === 0 ? IN.KICK : 0 }), 5);
  assert(ev.some(e => e.t === 'kick' && e.fire) && w.ball.fire > 0 && a.power === null, 'tir enflammé, pouvoir consommé');
}

// Touches : mal formées refusées, déjà vues ignorées ; personnage inconnu refusé ; il faut un adversaire.
{
  const r = new Room('ABCDE', Math.random, false, () => 0);
  r.addPlayer('Moi');
  assert.throws(() => r.start('Moi'), /adversaire/);
  r.addBot('Moi'); r.start('Moi'); r.stop();
  r.input('Moi', [[1, 2], [2, 2000], ['x', 1], [1, 4], [3, IN.JUMP]]);
  assert.deepStrictEqual(r.queues.Moi, [[1, 2], [3, IN.JUMP]]);
  r.input('Moi', 'n’importe quoi');
  assert.throws(() => r.pick('Moi', 'dragon'), /inconnu/);
  assert.throws(() => r.pick('Moi', 'lila'), /fin du match/);
}

// Match complet contre un robot coriace (le joueur ne touche à rien) : le robot marque, gagne, la partie se termine.
{
  let now = 0;
  let seed = 42; const rng = () => ((seed = (seed * 16807) % 2147483647) / 2147483647); // hasard fixé : toujours le même match
  const r = new Room('MATCH', rng, false, () => now);
  r.addPlayer('Moi'); r.addBot('Moi');
  r.configure('Moi', 'level', 3); r.configure('Moi', 'time', 120);
  r.start('Moi'); r.stop();
  const bot = r.players.find(p => p.bot).name;
  for (let k = 0; k < 60 * 60 * 6 && r.phase !== 'over'; k++) { now += 1000 / 60; r.timeout(); if (r.phase !== 'over') r.tick(); }
  r.stop();
  assert.strictEqual(r.phase, 'over', 'la partie est finie');
  assert(r.result.winner === bot, `le robot gagne (${r.result.score})`);
  assert.strictEqual(r.get(bot).points, 3);
}

// Forfait : quitter en plein match donne la victoire à l'autre.
{
  const r = new Room('FORFA', Math.random, false, () => 0);
  r.addPlayer('Moi'); r.addBot('Moi'); r.start('Moi'); r.stop();
  r.left('Moi');
  assert.strictEqual(r.phase, 'end'); assert.strictEqual(r.result.winner, r.players.find(p => p.bot).name);
}
