// Tests de Caboche Cup (2D, vue de profil, joueurs « grosse tête ») : la jambe frappe selon le point de contact (tendu,
// montant), frappe parfaite, lob, volée, touche gardée en mémoire, amorti, corps solides (on ne traverse pas, on se pose
// sur la tête de l'autre), but sous la barre seulement, barre, tête, sprint, pouvoirs (super tir, tête géante, gel,
// rétrécisseur, mur), bonus, multi-ballons, touches mal formées, 2 contre 2 complété par des robots, match complet
// contre un robot, premier à 3, forfait, match hors ligne (local.js) entre robots.
const assert = require('assert');
const CC = require('./client/sim');
const Bot = require('./client/bot');
const { Room } = require('./server/game');
const { IN, F, BALL, WALL, LEG } = CC;

const mk = (a = 'bouboule', b = 'lila', opts) => CC.world([{ id: 'a', char: a }, { id: 'b', char: b }], opts);
const run = (w, inputs, n) => { const ev = []; let side = null; for (let k = 0; k < n && side === null; k++) side = CC.stepWorld(w, typeof inputs === 'function' ? inputs(k) : inputs, ev); return { ev, side }; };
const away = w => { w.players[1].x = 9; }; // l'adversaire loin du ballon
const ball = w => w.balls[0];
// Le joueur a frappe (ou lobe) un ballon posé à (dx, y) devant lui ; renvoie l'événement et le ballon.
function strike(dx, y, bits = IN.KICK, prep = () => {}) {
  const w = mk(), [a] = w.players; away(w); prep(a);
  Object.assign(ball(w), { x: a.x + dx, y, vx: 0, vy: 0 });
  const { ev } = run(w, k => ({ a: k === 0 ? bits : bits & (IN.L | IN.R) }), 14); // on garde la direction
  return { e: ev.find(e => e.t === 'kick'), b: ball(w), a };
}

// La jambe : un ballon au sol devant le joueur part tendu et fort vers le but adverse ; un ballon plus haut part plus haut.
{
  const low = strike(0.95, BALL.r), high = strike(0.8, 0.85);
  assert.strictEqual(low.e?.kind, 'frappe', 'frappe au sol');
  assert(low.b.vx > 12, `ballon envoyé vers le but adverse (vx ${low.b.vx})`);
  assert(high.e && high.b.vy / high.b.vx > low.b.vy / low.b.vx + 0.2, 'touché plus bas que son centre, le ballon monte');
  const run1 = strike(0.95, BALL.r, IN.KICK | IN.R, a => (a.vx = 6));
  assert(run1.e.p > low.e.p, 'en courant, la frappe est plus forte');
}
// Frappe parfaite : le ballon au milieu du geste (pied tendu devant) ; plus fort.
{
  const perfect = strike(LEG.len + LEG.foot + BALL.r - 0.08, LEG.pivot);
  assert(perfect.e?.perfect, 'frappe parfaite');
  const early = strike(0.55, BALL.r);
  assert(early.e && !early.e.perfect, 'trop près, au début du geste : pas parfaite');
}
// Lob : il monte plus qu'il n'avance ; volée en l'air.
{
  const lob = strike(0.95, BALL.r, IN.LOB);
  assert.strictEqual(lob.e?.kind, 'lob'); assert(lob.b.vy > lob.b.vx * 1.2, 'le lob monte');
  const air = strike(0.9, 1.2, IN.KICK, a => Object.assign(a, { y: 0.6, vy: 2, ground: false }));
  assert.strictEqual(air.e?.kind, 'volee');
}
// Touche gardée en mémoire : appuyée pendant le geste précédent, le tir part dès que possible.
{
  const w = mk(), [a] = w.players; away(w); ball(w).x = 9;
  run(w, { a: IN.KICK }, 1); run(w, {}, 4);
  run(w, { a: IN.KICK }, 1); // trop tôt (la jambe se recharge)
  assert(a.queued !== 0 || a.kickT > 0, 'la touche est gardée');
  run(w, {}, 15);
  assert.strictEqual(a.queued, 0, 'et le geste est parti');
}

// Amorti : un ballon qui arrive doucement sur la chaussure reste devant le joueur.
{
  const w = mk(), [a] = w.players; away(w);
  Object.assign(ball(w), { x: a.x + 1.6, y: BALL.r, vx: -3.5, vy: 0 });
  const { ev } = run(w, {}, 40);
  assert(ev.some(e => e.t === 'trap' && e.id === 'a'), 'ballon amorti');
  assert(Math.abs(ball(w).vx) < 1.5 && Math.abs(ball(w).x - a.x) < 1.8, 'le ballon reste près du joueur');
}

// Corps solides : en fonçant sur l'adversaire, on le pousse mais on ne le traverse pas ; on peut se poser sur sa tête.
{
  const w = mk(), [a, b] = w.players; ball(w).x = 9; ball(w).y = 8;
  a.x = -3; b.x = 0;
  run(w, { a: IN.R, b: IN.L }, 120);
  assert(a.x < b.x, 'on ne traverse pas l’adversaire');
  assert(b.x - a.x > CC.baseR(a) + CC.baseR(b) - 0.1, 'les têtes ne se chevauchent pas');
  const v = mk(), [p, q] = v.players; ball(v).x = 9; ball(v).y = 8;
  q.x = 0; p.x = 0.1; p.y = 3; p.ground = false;
  const { ev } = run(v, {}, 40);
  assert(p.y > 1 && Math.abs(p.x - q.x) < 0.8, `posé sur la tête de l’autre (hauteur ${p.y.toFixed(2)})`);
  assert(ev.some(e => e.t === 'boing'), 'boing !');
  run(v, k => ({ a: k === 0 ? IN.JUMP : 0 }), 2); assert(p.vy > 3, 'on peut ressauter depuis sa tête');
}

// But : seulement sous la barre ; au-dessus, le ballon rebondit sur le dessus de la cage. Des deux côtés.
{
  const w = mk(); w.players[0].x = -3; w.players[1].x = 0;
  Object.assign(ball(w), { x: F.HL - 2, y: 1, vx: 18, vy: 0 });
  assert.strictEqual(run(w, {}, 60).side, 0, 'but pour le joueur de gauche');
  const w2 = mk(); w2.players[0].x = -3;
  Object.assign(ball(w2), { x: F.HL + 0.8, y: F.GH + 1.2, vx: 0, vy: 0 });
  assert.strictEqual(run(w2, {}, 120).side, null, 'tombé sur la cage : pas de but');
  assert(ball(w2).y > F.GH, 'le ballon reste sur le dessus de la cage');
  const w3 = mk(); w3.players[1].x = 3; w3.players[0].x = 0;
  Object.assign(ball(w3), { x: -F.HL + 2, y: 1, vx: -18, vy: 0 });
  assert.strictEqual(run(w3, {}, 60).side, 1, 'but pour le joueur de droite');
}

// Barre : le ballon qui la frappe de face repart en arrière (« post »).
{
  const w = mk(); w.players[0].x = -3; w.players[1].x = 0;
  Object.assign(ball(w), { x: F.HL - 2, y: F.GH, vx: 18, vy: 0 });
  const { ev, side } = run(w, {}, 40);
  assert(ev.some(e => e.t === 'post'), 'barre touchée');
  assert.strictEqual(side, null); assert(ball(w).vx < 0, 'ballon renvoyé');
  assert(Math.abs(ball(w).x) <= WALL, 'jamais hors du stade');
}

// Tête : un ballon qui tombe sur la tête repart ; en sautant dedans, il part vers l'avant.
{
  const w = mk(), [a] = w.players; away(w);
  Object.assign(ball(w), { x: a.x + 0.15, y: 5, vx: 0, vy: 0 });
  const { ev } = run(w, k => ({ a: k === 22 ? IN.JUMP : 0 }), 50);
  assert(ev.some(e => e.t === 'header' && e.id === 'a'), 'tête');
  assert(ball(w).vx > 0, 'renvoyé vers le but adverse');
}

// Sprint : plus rapide, mais l'endurance s'use ; à zéro, plus de sprint tant qu'on n'a pas soufflé.
{
  const a = CC.player('a', 'bouboule', 0); a.x = 9;
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
  b.x = 9; Object.assign(ball(w), { x: a.x + 0.95, y: BALL.r, vx: 0, vy: 0 });
  const { ev } = run(w, k => ({ a: k === 0 ? IN.KICK : 0 }), 14);
  assert(ev.some(e => e.t === 'kick' && e.fire) && ball(w).fire > 0 && a.power === null, 'tir enflammé, pouvoir consommé');
}
// Gel : l'adversaire ne bouge plus ; rétrécisseur : sa tête rapetisse ; mur : le ballon ne rentre pas.
{
  const w = mk('givre', 'tiko'), [a, b] = w.players;
  a.gauge = 1; run(w, k => ({ a: k === 0 ? IN.POWER : 0 }), 2);
  assert(b.frozen > 0, 'congelé'); const x = b.x; run(w, { b: IN.L }, 30); assert(Math.abs(b.x - x) < 0.05, 'congelé : immobile');
  b.gauge = 1; run(w, { b: 0 }, 100); run(w, k => ({ b: k === 0 ? IN.POWER : 0 }), 2);
  assert(a.mini > 0 && CC.headR(a) < CC.CHARS.givre.head * 0.6, 'rétréci');
  const m = mk('roco', 'lila'), [r] = m.players; r.x = 0; m.players[1].x = 4;
  r.gauge = 1; run(m, k => ({ a: k === 0 ? IN.POWER : 0 }), 2);
  assert(m.walls[0] > 0, 'mur devant le but de gauche');
  Object.assign(ball(m), { x: -F.HL + 2, y: 1, vx: -18, vy: 0 });
  const out = run(m, {}, 60);
  assert(out.side === null && out.ev.some(e => e.t === 'block'), 'le mur arrête le ballon');
}

// Bonus : il tombe en parachute ; le toucher de la tête donne son effet.
{
  const w = mk('bouboule', 'lila', { bonus: true }), [a] = w.players; away(w);
  w.items.push({ id: 1, kind: 'vite', x: a.x, y: CC.headY(a), life: 5 });
  const { ev } = run(w, {}, 2);
  assert(ev.some(e => e.t === 'item' && e.id === 'a') && a.fast > 0 && !w.items.length, 'turbo ramassé');
  for (let k = 0; k < 60 * 30; k++) CC.stepWorld(w, {}, []);
  assert(w.itemId > 1, 'd’autres bonus tombent au fil du match');
}

// Multi-ballons : trois ballons ; n'importe lequel peut marquer.
{
  const w = mk('bouboule', 'lila', { mode: 'multi' }); w.players[0].x = -3; w.players[1].x = 0;
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
  let seed = 7; const rng = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const r = new Room('GOALS', rng, false, () => now);
  r.addPlayer('Moi'); r.addBot('Moi'); r.configure('Moi', 'goals', 3); r.configure('Moi', 'level', 3); r.configure('Moi', 'time', 180);
  r.start('Moi'); r.stop();
  for (let k = 0; k < 60 * 60 * 6 && r.phase !== 'over'; k++) { now += 1000 / 60; r.timeout(); if (r.phase !== 'over') r.tick(); }
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
