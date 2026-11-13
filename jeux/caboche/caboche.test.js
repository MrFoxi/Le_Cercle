// Tests de Caboche Cup : tir qui part vers le but adverse, but compté seulement ballon entièrement dans la cage,
// poteau qui renvoie, tacle qui fait tomber, pouvoirs, touches mal formées refusées, match complet contre un robot.
const assert = require('assert');
const CC = require('./client/sim');
const { Room } = require('./server/game');
const { IN, F, BALL } = CC;

const mk = () => CC.world([{ id: 'a', char: 'bouboule' }, { id: 'b', char: 'lila' }]);
const run = (w, inputs, n) => { const ev = []; let side = null; for (let k = 0; k < n && side === null; k++) side = CC.stepWorld(w, typeof inputs === 'function' ? inputs(k) : inputs, ev); return { ev, side }; };

// Tir : le ballon au pied part fort, vers l'avant et vers le but adverse (+x pour le joueur de gauche).
{
  const w = mk(), [a] = w.players;
  w.players[1].x = 12; w.players[1].z = 6; // l'adversaire hors du chemin
  Object.assign(w.ball, { x: a.x + 0.7, y: BALL.r, z: 0 });
  const { ev } = run(w, k => ({ a: k === 0 ? IN.KICK | IN.R : IN.R }), 5);
  assert(ev.some(e => e.t === 'kick'), 'le tir est parti');
  assert(w.ball.vx > 15, `ballon envoyé vers le but adverse (vx ${w.ball.vx})`);
}

// But : seulement quand le ballon a franchi la ligne entre les poteaux et sous la barre ; à côté, le mur renvoie.
{
  const w = mk(); w.players.forEach(p => (p.z = 8));
  Object.assign(w.ball, { x: F.HL - 2, y: 1, z: 0, vx: 20, vy: 0, vz: 0 });
  assert.strictEqual(run(w, {}, 60).side, 0, 'but pour le joueur de gauche');
  const w2 = mk(); w2.players.forEach(p => (p.z = -8));
  Object.assign(w2.ball, { x: F.HL - 2, y: 1, z: F.GW / 2 + 1.5, vx: 20, vy: 0, vz: 0 });
  assert.strictEqual(run(w2, {}, 60).side, null, 'à côté : pas de but');
  assert(w2.ball.vx < 0 && Math.abs(w2.ball.x) <= F.HL, 'renvoyé par le mur du fond');
  const w3 = mk(); w3.players.forEach(p => (p.z = 8));
  Object.assign(w3.ball, { x: -F.HL + 2, y: 1, z: 0, vx: -20, vy: 0, vz: 0 });
  assert.strictEqual(run(w3, {}, 60).side, 1, 'but pour le joueur de droite de l’autre côté');
}

// Poteau : le ballon qui le frappe de face repart en arrière (« post »).
{
  const w = mk(); w.players.forEach(p => (p.z = -8));
  Object.assign(w.ball, { x: F.HL - 2, y: 1, z: F.GW / 2, vx: 20, vy: 0, vz: 0 });
  const { ev, side } = run(w, {}, 30);
  assert(ev.some(e => e.t === 'post'), 'poteau touché');
  assert.strictEqual(side, null); assert(w.ball.vx < 0, 'ballon renvoyé');
}

// Tacle : il fait tomber l'adversaire (étourdi un moment, ses touches ne font plus rien).
{
  const w = mk(), [a, b] = w.players;
  a.x = -2; b.x = -0.5; b.face = Math.PI; w.ball.x = 5; w.ball.z = 6;
  const { ev } = run(w, k => ({ a: k === 0 ? IN.TACKLE | IN.R : IN.R }), 30);
  assert(ev.some(e => e.t === 'fall' && e.id === 'b'), 'adversaire tombé');
  assert(b.stun > 0, 'étourdi');
  const x = b.x; run(w, { b: IN.L }, 5); assert(Math.abs(b.x - x) < 0.6, 'ne court pas pendant qu’il est au sol');
}

// Pouvoirs : jauge pleine → E ; Tête Géante double la tête, Super Tir enflamme le prochain tir.
{
  const w = mk(), [a, b] = w.players;
  run(w, { a: IN.POWER }, 3); assert.strictEqual(a.power, null, 'jauge vide : rien');
  b.gauge = 1; run(w, k => ({ b: k === 0 ? IN.POWER : 0 }), 2);
  assert.strictEqual(b.power, 'tete'); assert.strictEqual(CC.headR(b), CC.CHARS.lila.head * 2);
  a.gauge = 1; run(w, k => ({ a: k === 0 ? IN.POWER : 0 }), 2); assert.strictEqual(a.power, 'super');
  b.x = 12; b.z = 6; Object.assign(w.ball, { x: a.x + 0.7, y: BALL.r, z: 0, vx: 0, vy: 0, vz: 0 });
  const { ev } = run(w, k => ({ a: k === 0 ? IN.KICK | IN.R : IN.R }), 5);
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
  const r = new Room('MATCH', Math.random, false, () => now);
  r.addPlayer('Moi'); r.addBot('Moi');
  r.configure('Moi', 'level', 3); r.configure('Moi', 'time', 120);
  r.start('Moi'); r.stop();
  const bot = r.players.find(p => p.bot).name;
  for (let k = 0; k < 60 * 60 * 6 && r.phase !== 'over'; k++) { now += 1000 / 60; r.timeout(); if (r.phase !== 'over') r.tick(); }
  r.stop();
  assert.strictEqual(r.phase, 'over', 'la partie est finie');
  assert(r.result.winner === bot && r.result.score[r.result.sides.indexOf(bot)] > 0, `le robot gagne (${r.result.score})`);
  assert.strictEqual(r.get(bot).points, 3);
}

// Forfait : quitter en plein match donne la victoire à l'autre.
{
  const r = new Room('FORFA', Math.random, false, () => 0);
  r.addPlayer('Moi'); r.addBot('Moi'); r.start('Moi'); r.stop();
  r.left('Moi');
  assert.strictEqual(r.phase, 'end'); assert.strictEqual(r.result.winner, r.players.find(p => p.bot).name);
}
