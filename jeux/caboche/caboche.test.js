// Tests de Caboche Cup (2D, vue de profil) : gestes de tir (course, charge, volée, plongeon, retourné), amorti, but sous la
// barre seulement, barre qui renvoie (dessus du but compris), tête, tacle, sprint et endurance, pouvoirs (super tir, tête
// géante, gel, rétrécisseur, mur), bonus, multi-ballons, touches mal formées, 2 contre 2 complété par des robots,
// match complet contre un robot, forfait, match hors ligne (local.js) entre robots.
const assert = require('assert');
const CC = require('./client/sim');
const Bot = require('./client/bot');
const { Room } = require('./server/game');
const { IN, F, BALL, WALL } = CC;

const mk = (a = 'bouboule', b = 'lila', opts) => CC.world([{ id: 'a', char: a }, { id: 'b', char: b }], opts);
const run = (w, inputs, n) => { const ev = []; let side = null; for (let k = 0; k < n && side === null; k++) side = CC.stepWorld(w, typeof inputs === 'function' ? inputs(k) : inputs, ev); return { ev, side }; };
const away = w => { w.players[1].x = 9; }; // l'adversaire loin du ballon
const ball = w => w.balls[0];

// Tir : le geste dépend de la course (piqué à l'arrêt, frappe en avançant, boulet en sprint, lob en reculant).
function kick(prep, bits) {
  const w = mk(), [a] = w.players; away(w); prep(a);
  Object.assign(ball(w), { x: a.x + 0.6, y: BALL.r, vx: 0, vy: 0 });
  const { ev } = run(w, k => ({ a: k === 0 ? bits | IN.KICK : bits }), 6);
  return { e: ev.find(e => e.t === 'kick'), b: ball(w) };
}
{
  const still = kick(() => {}, 0), fwd = kick(a => (a.vx = 6), IN.R), boulet = kick(a => (a.vx = 8.5), IN.R | IN.SPRINT), lob = kick(a => (a.vx = -5), IN.L);
  assert.deepStrictEqual([still.e?.kind, fwd.e?.kind, boulet.e?.kind, lob.e?.kind], ['pique', 'frappe', 'boulet', 'lob']);
  assert(fwd.b.vx > 15 && boulet.b.vx > fwd.b.vx, 'la frappe part fort vers le but adverse, le boulet encore plus');
  assert(lob.b.vy > lob.b.vx, 'le lob monte plus qu’il n’avance');
}

// En l'air : volée (ballon bas), tête plongeante (à hauteur de poitrine), retourné (au-dessus de la tête).
for (const [rel, kind] of [[0.3, 'volee'], [1.0, 'plongeon'], [1.8, 'retourne']]) {
  const w = mk(), [a] = w.players; away(w); Object.assign(a, { y: 1, vy: 3, ground: false });
  Object.assign(ball(w), { x: a.x + 0.4, y: a.y + rel, vx: 0, vy: 0 });
  assert.strictEqual(run(w, k => ({ a: k === 0 ? IN.KICK : 0 }), 3).ev.find(e => e.t === 'kick')?.kind, kind, `geste en l'air à ${rel} m`);
}

// Tir chargé : garder la touche puis relâcher ; plus fort et plus tendu qu'un piqué.
{
  const w = mk(), [a] = w.players; away(w); ball(w).x = -9; // ballon loin pendant la charge
  run(w, { a: IN.KICK }, 50);
  assert(a.charge > 0.6, 'la charge monte');
  Object.assign(ball(w), { x: a.x + 0.6, y: BALL.r, vx: 0, vy: 0 });
  const e = run(w, {}, 4).ev.find(e => e.t === 'kick');
  assert.strictEqual(e?.kind, 'canon'); assert(e.charged && e.p > CC.CHARS.bouboule.kick * 0.85 * 1.4, `tir chargé puissant (${e.p})`);
}

// Amorti : un ballon qui arrive doucement reste devant le joueur.
{
  const w = mk(), [a] = w.players; away(w);
  Object.assign(ball(w), { x: a.x + 1.4, y: BALL.r, vx: -3.5, vy: 0 });
  const { ev } = run(w, {}, 30);
  assert(ev.some(e => e.t === 'trap' && e.id === 'a'), 'ballon amorti');
  assert(Math.abs(ball(w).vx) < 1.5 && Math.abs(ball(w).x - a.x) < 1.6, 'le ballon reste près du joueur');
}

// But : seulement sous la barre ; au-dessus, le ballon rebondit sur le dessus de la cage. Des deux côtés.
{
  const w = mk(); w.players.forEach(p => (p.x = 0));
  Object.assign(ball(w), { x: F.HL - 2, y: 1, vx: 18, vy: 0 });
  assert.strictEqual(run(w, {}, 60).side, 0, 'but pour le joueur de gauche');
  const w2 = mk(); w2.players.forEach(p => (p.x = 0));
  Object.assign(ball(w2), { x: F.HL + 0.8, y: F.GH + 1.2, vx: 0, vy: 0 });
  assert.strictEqual(run(w2, {}, 120).side, null, 'tombé sur la cage : pas de but');
  assert(ball(w2).y > F.GH, 'le ballon reste sur le dessus de la cage');
  const w3 = mk(); w3.players.forEach(p => (p.x = 0));
  Object.assign(ball(w3), { x: -F.HL + 2, y: 1, vx: -18, vy: 0 });
  assert.strictEqual(run(w3, {}, 60).side, 1, 'but pour le joueur de droite');
}

// Barre : le ballon qui la frappe de face repart en arrière (« post »).
{
  const w = mk(); w.players.forEach(p => (p.x = 0));
  Object.assign(ball(w), { x: F.HL - 2, y: F.GH, vx: 18, vy: 0 });
  const { ev, side } = run(w, {}, 40);
  assert(ev.some(e => e.t === 'post'), 'barre touchée');
  assert.strictEqual(side, null); assert(ball(w).vx < 0, 'ballon renvoyé');
  assert(Math.abs(ball(w).x) <= WALL, 'jamais hors du stade');
}

// Tête : un ballon qui tombe sur la tête repart ; en sautant dedans, il part vers l'avant.
{
  const w = mk(), [a] = w.players; away(w);
  Object.assign(ball(w), { x: a.x + 0.1, y: 4, vx: 0, vy: 0 });
  const { ev } = run(w, k => ({ a: k === 20 ? IN.JUMP : 0 }), 50);
  assert(ev.some(e => e.t === 'header' && e.id === 'a'), 'tête');
  assert(ball(w).vx > 0, 'renvoyé vers le but adverse');
}

// Tacle : il fait tomber l'adversaire (étourdi un moment, ses touches ne font plus rien).
{
  const w = mk(), [a, b] = w.players;
  a.x = -2; b.x = -0.6; ball(w).x = 6;
  const { ev } = run(w, k => ({ a: k === 0 ? IN.TACKLE | IN.R : 0 }), 30);
  assert(ev.some(e => e.t === 'fall' && e.id === 'b'), 'adversaire tombé');
  assert(b.stun > 0, 'étourdi');
  const x = b.x; run(w, { b: IN.L }, 5); assert(Math.abs(b.x - x) < 0.6, 'ne court pas pendant qu’il est au sol');
}

// Sprint : plus rapide, mais l'endurance s'use ; à zéro, plus de sprint tant qu'on n'a pas soufflé.
{
  const a = CC.player('a', 'bouboule', 0); a.x = 9; // le joueur seul, avec de la place pour courir vers la gauche
  const go = (bits, n) => { for (let k = 0; k < n; k++) CC.step(a, bits); };
  go(IN.L, 60); const walk = Math.abs(a.vx);
  go(IN.L | IN.SPRINT, 30); assert(Math.abs(a.vx) > walk * 1.3, 'sprint plus rapide');
  go(IN.L | IN.SPRINT, 150);
  assert(a.tired && !a.sprint, 'essoufflé');
  go(0, 90); assert(!a.tired, 'endurance revenue');
}

// Pouvoirs : jauge pleine → E. Tête Géante double la tête, Super Tir enflamme le prochain tir.
{
  const w = mk(), [a, b] = w.players;
  run(w, { a: IN.POWER }, 3); assert.strictEqual(a.power, null, 'jauge vide : rien');
  b.gauge = 1; run(w, k => ({ b: k === 0 ? IN.POWER : 0 }), 2);
  assert.strictEqual(b.power, 'tete'); assert.strictEqual(CC.headR(b), CC.CHARS.lila.head * 2);
  a.gauge = 1; run(w, k => ({ a: k === 0 ? IN.POWER : 0 }), 2); assert.strictEqual(a.power, 'super');
  b.x = 9; Object.assign(ball(w), { x: a.x + 0.6, y: BALL.r, vx: 0, vy: 0 });
  const { ev } = run(w, k => ({ a: k === 0 ? IN.KICK : 0 }), 5);
  assert(ev.some(e => e.t === 'kick' && e.fire) && ball(w).fire > 0 && a.power === null, 'tir enflammé, pouvoir consommé');
}
// Gel : l'adversaire ne bouge plus ; rétrécisseur : sa tête rapetisse ; mur : le ballon ne rentre pas.
{
  const w = mk('givre', 'tiko'), [a, b] = w.players;
  a.gauge = 1; run(w, k => ({ a: k === 0 ? IN.POWER : 0 }), 2);
  assert(b.frozen > 0, 'congelé'); const x = b.x; run(w, { b: IN.L }, 30); assert(Math.abs(b.x - x) < 0.05, 'congelé : immobile');
  b.gauge = 1; run(w, { b: 0 }, 100); run(w, k => ({ b: k === 0 ? IN.POWER : 0 }), 2);
  assert(a.mini > 0 && CC.headR(a) < CC.CHARS.givre.head * 0.6, 'rétréci');
  const m = mk('roco', 'lila'), [r] = m.players; m.players.forEach(p => (p.x = 0));
  r.gauge = 1; run(m, k => ({ a: k === 0 ? IN.POWER : 0 }), 2);
  assert(m.walls[0] > 0, 'mur devant le but de gauche');
  Object.assign(ball(m), { x: -F.HL + 2, y: 1, vx: -18, vy: 0 });
  const out = run(m, {}, 60);
  assert(out.side === null && out.ev.some(e => e.t === 'block'), 'le mur arrête le ballon');
}

// Bonus : il tombe en parachute ; le toucher donne son effet.
{
  const w = mk('bouboule', 'lila', { bonus: true }), [a] = w.players; away(w);
  w.items.push({ id: 1, kind: 'vite', x: a.x, y: 1, life: 5 });
  const { ev } = run(w, {}, 2);
  assert(ev.some(e => e.t === 'item' && e.id === 'a') && a.fast > 0 && !w.items.length, 'turbo ramassé');
  for (let k = 0; k < 60 * 30; k++) CC.stepWorld(w, {}, []);
  assert(w.itemId > 1, 'd’autres bonus tombent au fil du match');
}

// Multi-ballons : trois ballons ; n'importe lequel peut marquer.
{
  const w = mk('bouboule', 'lila', { mode: 'multi' }); w.players.forEach(p => (p.x = 0));
  assert.strictEqual(w.balls.length, 3);
  Object.assign(w.balls[2], { x: F.HL - 1, y: 1, vx: 15, vy: 0 });
  assert.strictEqual(run(w, {}, 60).side, 0, 'le troisième ballon marque');
}

// Touches : mal formées refusées, déjà vues ignorées ; personnage ou accessoire inconnu refusé ; il faut un adversaire.
{
  const r = new Room('ABCDE', Math.random, false, () => 0);
  r.addPlayer('Moi');
  assert.throws(() => r.start('Moi'), /adversaire/);
  assert.throws(() => r.pick('Moi', 'lila', 'chapeau-magique'), /Accessoire/);
  r.pick('Moi', 'roco', 'couronne'); assert.strictEqual(r.viewFor('Moi').players[0].acc, 'couronne');
  r.addBot('Moi'); r.start('Moi'); r.stop();
  r.input('Moi', [[1, 2], [2, 2000], ['x', 1], [1, 4], [3, IN.JUMP]]);
  assert.deepStrictEqual(r.queues.Moi, [[1, 2], [3, IN.JUMP]]);
  r.input('Moi', 'n’importe quoi');
  assert.throws(() => r.pick('Moi', 'dragon'), /inconnu/);
  assert.throws(() => r.pick('Moi', 'lila'), /fin du match/);
}

// 2 contre 2 : les robots complètent les équipes, deux par côté ; ça joue sans erreur.
{
  let now = 0;
  const r = new Room('DUO22', Math.random, false, () => now);
  r.addPlayer('Moi'); r.addBot('Moi');
  r.configure('Moi', 'format', '2v2'); r.configure('Moi', 'mode', 'multi'); r.configure('Moi', 'stade', 'neige');
  r.start('Moi'); r.stop();
  assert.strictEqual(r.players.length, 4);
  assert.deepStrictEqual(r.sides().map(t => t.length), [2, 2]);
  for (let k = 0; k < 60 * 20; k++) { now += 1000 / 60; r.timeout(); r.tick(); }
  r.stop();
  assert(r.world.frame > 900, 'le match avance');
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

// Premier à 3 buts : le match s'arrête dès le troisième but.
{
  let now = 0;
  const r = new Room('GOALS', Math.random, false, () => now);
  r.addPlayer('Moi'); r.addBot('Moi'); r.configure('Moi', 'goals', 3); r.configure('Moi', 'level', 3); r.configure('Moi', 'time', 180);
  r.start('Moi'); r.stop();
  for (let k = 0; k < 60 * 60 * 5 && r.phase !== 'over'; k++) { now += 1000 / 60; r.timeout(); if (r.phase !== 'over') r.tick(); }
  r.stop();
  assert(r.phase === 'over' && Math.max(...r.result.score) === 3, `arrêt à 3 buts (${r.result?.score})`);
}

// Forfait : quitter en plein match donne la victoire à l'autre.
{
  const r = new Room('FORFA', Math.random, false, () => 0);
  r.addPlayer('Moi'); r.addBot('Moi'); r.start('Moi'); r.stop();
  r.left('Moi');
  assert.strictEqual(r.phase, 'end'); assert.strictEqual(r.result.winner, r.players.find(p => p.bot).name);
}

// Match hors ligne (tournoi, survie, défis) : deux robots jusqu'au bout, avec le module du navigateur.
(async () => {
  global.window = { CC, CCBot: Bot };
  const { LocalMatch } = await import('./client/local.js');
  const m = new LocalMatch([{ id: 'A', char: 'siroco', side: 0, bot: 3 }, { id: 'B', char: 'magnus', side: 1, bot: 1 }], { time: 60, goals: 0, mode: 'vent', stade: 'toit', bonus: 1 });
  for (let k = 0; k < 60 * 600 && m.phase !== 'end'; k++) m.step({}); // chaque but ajoute 7 s de pause
  assert.strictEqual(m.phase, 'end', 'le match hors ligne se termine');
  assert(m.result && m.result.score[0] + m.result.score[1] > 0, `des buts (${m.result?.score})`);
})().catch(e => { console.error(e); process.exitCode = 1; });
