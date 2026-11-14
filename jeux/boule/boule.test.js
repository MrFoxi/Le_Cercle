// Tests de Boule de Pute : chacun reste dans sa moitié, la boule poursuit sa cible et l'élimine, le renvoi (dans la
// fenêtre et à portée) la retourne vers l'adversaire visé et l'accélère, le renvoi parfait encore plus, le sursis
// pardonne un renvoi tardif, fin de manche quand une équipe est vide, touches mal formées refusées, partie complète.
const assert = require('assert');
const BD = require('./client/sim');
const { Room } = require('./server/game');
const { IN, A, B, P } = BD;

const mk = () => BD.world([{ id: 'a', team: 0, look: 'bobby' }, { id: 'b', team: 1, look: 'zaza' }]);
const run = (w, inputs, n) => { const ev = []; let win = null; for (let k = 0; k < n && win === null; k++) win = BD.stepWorld(w, typeof inputs === 'function' ? inputs(k) : inputs, ev); return { ev, win }; };

// Chacun dans sa moitié : impossible de traverser la barrière.
{
  const w = mk(), [a] = w.players;
  run(w, { a: [IN.F, 0] }, 300); // a regarde vers +x et fonce
  assert(a.x <= -A.MID + 1e-9, `a reste dans sa moitié (x ${a.x})`);
}

// La boule poursuit sa cible et l'élimine ; l'équipe adverse gagne la manche.
{
  const w = mk(), [a] = w.players; w.ball = null;
  BD.spawn(w); w.ball.target = 'a'; w.ball.team = 1;
  const { ev, win } = run(w, {}, 60 * 8);
  assert(ev.some(e => e.t === 'kill' && e.id === 'a') && !a.alive, 'a éliminé');
  assert.strictEqual(win, 1, 'manche pour l’équipe 1');
}

// Renvoi : impulsion quand la boule arrive → elle repart vers b, plus vite ; trop tôt (hors de portée) : rien.
function incoming(dist, press = true) {
  const w = mk(), [a] = w.players; w.ball = null; BD.spawn(w);
  Object.assign(w.ball, { x: a.x + dist, y: P.chest, z: a.z, dx: -1, dy: 0, dz: 0, v: 12, target: 'a', team: 1, launch: 0 });
  const ev = []; BD.stepWorld(w, { a: [press ? IN.HIT : 0, 0] }, ev);
  return { w, ev, a };
}
{
  const ok = incoming(2.2), e = ok.ev.find(e => e.t === 'reflect');
  assert(e && !e.perfect, 'renvoi');
  assert.strictEqual(ok.w.ball.target, 'b'); assert.strictEqual(ok.w.ball.team, 0);
  assert(ok.w.ball.v > 12 && ok.w.ball.dx > 0, 'plus vite, vers l’adversaire');
  const perfect = incoming(1.0).ev.find(e => e.t === 'reflect');
  assert(perfect?.perfect && perfect.v > e.v, 'renvoi parfait, encore plus rapide');
  assert(!incoming(5).ev.some(e => e.t === 'reflect'), 'trop loin : pas de renvoi');
  // l'impulsion ne dure qu'un instant : appuyer trop tôt laisse sans défense
  const early = mk(), [p] = early.players; early.ball = null; BD.spawn(early);
  Object.assign(early.ball, { x: p.x + 8, y: P.chest, z: p.z, dx: -1, dy: 0, dz: 0, v: 12, target: 'a', team: 1, launch: 0 });
  const out = run(early, k => ({ a: [k === 0 ? IN.HIT : 0, 0] }), 120);
  assert(!out.ev.some(e => e.t === 'reflect') && !p.alive, 'trop tôt : éliminé');
}

// Sursis : la boule a déjà touché, un renvoi qui arrive dans les images qui suivent la sauve encore (décalage réseau).
{
  const w = mk(), [a] = w.players; w.ball = null; BD.spawn(w);
  Object.assign(w.ball, { x: a.x + 0.3, y: P.chest, z: a.z, dx: -1, dy: 0, dz: 0, v: 12, target: 'a', team: 1, launch: 0 });
  BD.stepWorld(w, {}, []); assert.strictEqual(w.ball.state, 'grace');
  run(w, {}, B.grace - 2);
  const ev = []; BD.stepWorld(w, { a: [IN.HIT, 0] }, ev);
  assert(ev.some(e => e.t === 'reflect' && e.perfect) && a.alive, 'sauvé de justesse (et c’est un renvoi parfait)');
}

// Le renvoi vise l'adversaire que l'on regarde.
{
  const w = BD.world([{ id: 'a', team: 0 }, { id: 'b', team: 1 }, { id: 'c', team: 1 }]), [a, b, c] = w.players;
  b.z = -5; c.z = 5; a.z = 0;
  assert.strictEqual(BD.aimTarget(w, { ...a, yaw: Math.atan2(5, b.x - a.x) }).id, 'c');
  assert.strictEqual(BD.aimTarget(w, { ...a, yaw: Math.atan2(-5, b.x - a.x) }).id, 'b');
}

// Salon : touches mal formées refusées ; les robots complètent les équipes ; personnage inconnu refusé.
{
  const r = new Room('ABCDE', Math.random, false, () => 0);
  r.addPlayer('Moi');
  assert.throws(() => r.pick('Moi', 'dragon'), /inconnu/);
  r.configure('Moi', 'teamSize', 3);
  r.start('Moi'); r.stop();
  assert.strictEqual(r.players.length, 6);
  assert.deepStrictEqual([0, 1].map(t => r.world.players.filter(p => p.team === t).length), [3, 3]);
  r.input('Moi', [[1, 2, 0.5], [2, 999, 0], [3, 1, NaN], ['x', 1, 0], [1, 4, 0], [4, IN.HIT, 1]]);
  assert.deepStrictEqual(r.queues.Moi, [[1, 2, 0.5], [4, IN.HIT, 1]]);
  r.input('Moi', 'n’importe quoi');
}

// Partie complète entre robots (le joueur ne touche à rien) : des renvois, des éliminations, et la partie se termine.
{
  let now = 0;
  let seed = 9; const rng = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const r = new Room('MATCH', rng, false, () => now);
  r.addPlayer('Moi'); r.configure('Moi', 'teamSize', 2); r.configure('Moi', 'rounds', 3);
  r.start('Moi'); r.stop();
  const ev = []; const o = r.stepOnce.bind(r); r.stepOnce = () => { const n = r.events.length; o(); ev.push(...r.events.slice(n)); };
  for (let k = 0; k < 60 * 60 * 15 && r.phase !== 'over'; k++) { now += 1000 / 60; r.timeout(); if (r.phase !== 'over') r.tick(); }
  r.stop();
  assert.strictEqual(r.phase, 'over', 'la partie est finie');
  assert(Math.max(...r.teamWins) === 2, `une équipe a gagné 2 manches (${r.teamWins})`);
  assert(ev.filter(e => e.t === 'reflect').length > 10, `des renvois (${ev.filter(e => e.t === 'reflect').length})`);
  assert(ev.some(e => e.t === 'kill'));
}

/* ---- Modes et arènes ---- */
const near = (w, id, dx = 0.3) => { const t = w.players.find(p => p.id === id); w.ball = null; BD.spawn(w); Object.assign(w.ball, { x: t.x + dx, y: P.chest, z: t.z, dx: -1, dy: 0, dz: 0, v: 12, target: id, team: 1 - t.team, launch: 0 }); };

// Chacun pour soi : pas de moitiés, dernier debout gagne.
{
  const w = BD.world([{ id: 'a', team: 0 }, { id: 'b', team: 1 }, { id: 'c', team: 2 }], { mode: 'chacun' });
  assert.strictEqual(w.halves, false);
  const [a] = w.players; a.x = 0; a.yaw = 0; run(w, { a: [IN.F, 0] }, 120); assert(a.x > 3, 'on traverse le milieu');
  w.players[1].alive = false; near(w, 'c');
  const { win } = run(w, {}, 60 * 3);
  assert.strictEqual(win, 0, 'a, dernier debout, gagne');
}

// Patate chaude : au bout de 10 s, la boule explose sur sa cible.
{
  const w = BD.world([{ id: 'a', team: 0 }, { id: 'b', team: 1 }], { mode: 'patate' }); w.players[0].x = -15; w.players[1].x = 15;
  BD.spawn(w); w.ball.target = 'a'; w.ball.fuse = 0.1; w.ball.launch = 0; w.ball.x = 0;
  const { ev } = run(w, {}, 20);
  assert(ev.some(e => e.t === 'kill' && e.how === 'patate'), 'explosion de la patate chaude');
}

// Ciel : qui sort des îles tombe et est éliminé ; cantine : la boule rebondit sur une table ; piscine : le bassin la freine.
{
  const w = BD.world([{ id: 'a', team: 0 }, { id: 'b', team: 1 }], { arena: 'ciel' }), [a] = w.players;
  Object.assign(a, { x: -5.5, z: 6, yaw: 0 }); // entre deux îles
  const { ev } = run(w, {}, 120);
  assert(!a.alive && ev.some(e => e.t === 'kill' && e.how === 'chute'), 'tombé dans le vide');
  const c = BD.world([{ id: 'a', team: 0 }, { id: 'b', team: 1 }], { arena: 'cantine' }); c.players[0].x = -16; c.players[1].x = 16;
  BD.spawn(c); Object.assign(c.ball, { x: -8, y: 0.6, z: -5, dx: -1, dy: 0, dz: 0, v: 15, launch: 0, target: 'a' });
  const out = run(c, {}, 20);
  assert(out.ev.some(e => e.t === 'thud'), 'la table arrête la boule');
  const pz = BD.world([{ id: 'a', team: 0 }, { id: 'b', team: 1 }], { arena: 'piscine' }); pz.players[0].x = -16; pz.players[1].x = 16;
  BD.spawn(pz); Object.assign(pz.ball, { x: 3.5, y: 0.6, z: 0, dx: -1, dy: 0, dz: 0, v: 30, launch: 0, target: 'a', team: 1 });
  run(pz, {}, 20);
  assert(pz.ball.v < 30, `le bassin freine la boule (${pz.ball.v.toFixed(1)})`);
}

// Visée automatique (tactile) : le renvoi part vers l'adversaire le plus proche.
{
  const w = BD.world([{ id: 'a', team: 0 }, { id: 'b', team: 1 }, { id: 'c', team: 1 }]), [a, b, c] = w.players;
  a.z = 0; b.x = 4; b.z = 8; c.x = 15; c.z = -1; a.yaw = Math.atan2(-1, c.x - a.x);
  assert.strictEqual(BD.aimTarget(w, a).id, 'c'); assert.strictEqual(BD.aimTarget(w, a, true).id, 'b');
}

// Salon : entraînement (personne n'est éliminé), survie (la vague augmente), coupe (demi-finales puis finale), emotes.
function play(mode, frames, set = {}) {
  let now = 0, seed = 5; const rng = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const r = new Room('M' + mode.slice(0, 4), rng, false, () => now); r.addPlayer('Moi'); r.configure('Moi', 'mode', mode); for (const [k, v] of Object.entries(set)) r.configure('Moi', k, v);
  r.start('Moi'); r.stop();
  const ev = []; const o = r.stepOnce.bind(r); r.stepOnce = () => { const n = r.events.length; o(); ev.push(...r.events.slice(n)); };
  for (let k = 0; k < frames && r.phase !== 'over'; k++) { now += 1000 / 60; r.timeout(); if (r.phase !== 'over') r.tick(); }
  r.stop();
  return { r, ev };
}
{
  const t = play('entrainement', 60 * 40);
  assert(t.r.phase === 'play' && t.r.world.players.every(p => p.alive), 'entraînement : personne n’est éliminé');
  assert(t.ev.some(e => e.t === 'miss'), 'un raté remet l’échange à zéro');
  const s = play('survie', 60 * 60 * 6);
  assert.strictEqual(s.r.phase, 'over', 'la survie finit quand on perd une manche');
  const c = play('coupe', 60 * 60 * 30, { teamSize: 1 });
  assert.strictEqual(c.r.phase, 'over'); assert.strictEqual(c.r.cup.matches.length, 3, 'deux demi-finales et une finale');
  assert(c.r.cup.champion !== undefined && c.r.cup.winners.length === 3);
  const e = new Room('EMOTE', Math.random, false, () => 0); e.addPlayer('Moi'); e.start('Moi'); e.stop();
  e.emote('Moi', 'danse'); e.emote('Moi', 'nimporte'); e.emote('Moi', 'bravo'); // la deuxième est refusée, la troisième arrive trop tôt
  assert.deepStrictEqual(e.events.filter(x => x.t === 'emote').map(x => x.e), ['danse']);
}
