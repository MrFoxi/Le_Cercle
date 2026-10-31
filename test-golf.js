const assert = require('node:assert');
const Golf = require('./public/golf/physics');
const HO = require('./public/golf/holes');
const Looks = require('./public/golf/looks');
const { bestShot } = require('./golf/bot');
const { Room, daily } = require('./golf/game');

const hole = id => HO.resolve(id);

// Physique : trou, eau, arrêt, rebonds, limites
{
  const ile = hole('ile');
  const holed = Golf.shot1(ile, 110, 300, 0, 0.8, 0.2); // pont du milieu présent : droit au trou
  assert.strictEqual(holed.result, 'holed');
  assert.strictEqual(Golf.shot1(hole('volcan'), 100, 300, 0, 1, 2.3).result, 'water'); // pont absent : dans la lave
  const back = Golf.shot1(hole('moulin'), 120, 300, Math.PI, 0.6, 0);
  assert.strictEqual(back.result, 'stop');
  assert.ok(back.events.some(e => e.type.startsWith('bump')));
  for (const id of HO.ORDER) for (let a = 0; a < 6.28; a += 0.9) {
    const h = hole(id), s = Golf.shot1(h, h.tee[0], h.tee[1], a, 1, 1);
    assert.ok(s.path.every(([x, y]) => x >= 0 && x <= Golf.W && y >= 0 && y <= Golf.H), id);
  }
  assert.deepStrictEqual([Golf.label(1, 3), Golf.label(2, 4), Golf.label(2, 3), Golf.label(3, 3), Golf.label(5, 3), Golf.label(9, 3)], ['Trou en un !', 'Eagle', 'Birdie', 'Par', 'Double Bogey', '+6']);
}

// Collisions : la balle tirée pousse l'autre ; en mode fantôme elle passe à travers
{
  const h = hole('moulin'), balls = { a: { x: 150, y: 300 }, b: { x: 230, y: 300 } };
  const hit = Golf.simulate(h, { balls, shooter: 'a', angle: 0, power: 0.35, t0: 0 });
  assert.ok(hit.paths.b && hit.results.b.x > 240, 'la balle b est poussée');
  assert.ok(hit.events.some(e => e.type === 'clack'));
  const ghost = Golf.simulate(h, { balls, shooter: 'a', angle: 0, power: 0.35, t0: 0, opts: { collide: false } });
  assert.ok(!ghost.paths.b);
}

// Effet, vent, rampe, plaque et porte, tuyau, trou bonus
{
  const h = hole('moulin');
  const left = Golf.shot1(h, 120, 120, 0, 0.4, 0, { spin: -1 }), right = Golf.shot1(h, 120, 120, 0, 0.4, 0, { spin: 1 });
  assert.ok(left.y < right.y - 10, 'l’effet courbe la trajectoire');
  const windy = Golf.shot1(h, 120, 120, 0, 0.4, 0, { opts: { wind: [0, 200] } });
  assert.ok(windy.y > 140);
  const jungle = hole('jungle');
  const jump = Golf.shot1(jungle, 200, 295, 0, 0.85, 0);
  assert.ok(jump.events.some(e => e.type === 'jump') && jump.path.some(p => p[2] > 0), 'la rampe fait sauter');
  const manoir = hole('manoir');
  const plate = Golf.shot1(manoir, 100, 500, Math.atan2(390 - 500, 210 - 100), 0.3, 0);
  assert.deepStrictEqual(plate.open, ['crypte']);
  assert.strictEqual(Golf.movers(manoir, 0, plate.open).some(m => m.kind === 'door'), false);
  const pipe = Golf.shot1(manoir, 470, 520, 0, 0.3, 0);
  assert.ok(pipe.events.some(e => e.type === 'pipe'));
  const fond = hole('fond');
  const bonus = Golf.shot1(fond, 520, 220, -Math.PI / 2, 0.25, 0);
  assert.ok(bonus.result === 'holed' && bonus.bonus, 'trou bonus dans l’épave');
}

// Miroir : le trou est retourné, et chaque trou (et un miroir de chacun) se termine avec le robot
{
  const m = hole('station~x');
  assert.deepStrictEqual([m.tee, m.cup], [[890, 470], [850, 130]]);
  assert.strictEqual(m.zones[0].r[0], 1000 - 240 - 520);
  for (const id of [...HO.ORDER, ...HO.ORDER.map((id, i) => id + ['~x', '~y', '~xy'][i % 3])]) { // les 40 versions sont vérifiées à la main (longues)
    const h = hole(id);
    let x = h.tee[0], y = h.tee[1], strokes = 0, done = false, open = [];
    while (!done && strokes < h.par + 3) {
      strokes++;
      let best = null;
      for (const w of [0, 1.2, 2.4]) {
        const s = { balls: { me: { x, y } }, shooter: 'me', t0: strokes * 7.3 + w, open };
        const b = bestShot(h, s, { angles: 48 });
        if (!best || b.score < best.score) best = { ...b, s };
      }
      const r = Golf.simulate(h, { ...best.s, angle: best.angle, power: best.power });
      open = r.open;
      if (r.results.me.result === 'holed') done = true;
      else if (r.results.me.result === 'water') strokes++;
      else ({ x, y } = r.results.me);
    }
    assert.ok(done, `${id} : trou impossible à finir`);
  }
}

// Parcours et trou du jour
{
  assert.strictEqual(HO.COURSES.grandtour.holes().length, 10);
  assert.strictEqual(HO.COURSES.marathon.holes(Math.random).length, 18);
  assert.ok(HO.COURSES.aleatoire.holes(Math.random).every(id => hole(id)));
  assert.strictEqual(HO.dailyId('2026-10-31'), HO.dailyId('2026-10-31'));
  assert.deepStrictEqual(Looks.validLook({ color: 'bleu', motif: 'pirate' }), { ...Looks.DEFAULT, color: 'bleu' });
}

let now = 1e9;
const clock = () => now;
const room = (names, settings = {}) => {
  const r = new Room('X', Math.random, false, clock);
  names.forEach(n => r.addPlayer(n));
  for (const [k, v] of Object.entries(settings)) r.configure(names[0], k, v);
  r.start(names[0]);
  return r;
};
const run = (r, ms) => { now += ms; r.timeout(); };
const untilAim = r => { let g = 0; while (r.shots.length) { now = Math.min(...r.shots.map(s => s.end)); r.timeout(); assert.ok(++g < 50); } };

// Salon : 8 joueurs maximum, robots, réglages réservés au créateur, pas d'entrée en cours de partie
{
  const r = new Room('X', Math.random, false, clock);
  r.addPlayer('Ana');
  r.addBot('Ana');
  assert.ok(r.players[1].bot);
  assert.throws(() => r.addBot('Robot Birdie'), /créateur/);
  for (let i = 0; i < 6; i++) r.addPlayer(`J${i}`);
  assert.throws(() => r.addPlayer('Neuf'), /complet/);
  assert.throws(() => r.configure('J0', 'mode', 'simul'), /créateur/);
  assert.throws(() => r.configure('Ana', 'mode', 'golf'), /invalide/);
  r.removeBot('Ana', 'Robot Birdie');
  r.configure('Ana', 'course', 'express');
  r.start('Ana');
  assert.strictEqual(r.course.length, 3);
  assert.throws(() => r.addPlayer('Tard'), /en cours/);
  r.setLook('Ana', { color: 'noir', motif: 'planete', trail: 'n’importe quoi' });
  assert.deepStrictEqual([r.get('Ana').look.color, r.get('Ana').look.trail], ['noir', 'classique']);
}

// Chacun son tour : tir, balle poussée, eau, temps écoulé, paris
{
  const r = room(['Ana', 'Ben']);
  assert.strictEqual(r.turn, 'Ana');
  assert.throws(() => r.shoot('Ben', 0, 0.5, 0, 0), /pas ton tour/);
  assert.throws(() => r.shoot('Ana', 0, 2, 0, 0), /invalide/);
  r.bet('Ben', 'miss');
  assert.throws(() => r.bet('Ana', 'in'), /Trop tard/);
  r.shoot('Ana', Math.PI, 0.4, 0, 0);
  assert.throws(() => r.shoot('Ana', 0, 0.5, 0, 1), /pas ton tour|roule/);
  assert.ok(r.viewFor('Ben').shots[0].paths.Ana.p.length > 2);
  untilAim(r);
  assert.deepStrictEqual([r.turn, r.balls.Ana.strokes, r.betPts.Ben], ['Ben', 1, 1]);
  const before = { ...r.balls.Ben };
  run(r, 31000); // Ben laisse filer le temps
  assert.deepStrictEqual([r.balls.Ben.strokes, r.balls.Ben.x], [before.strokes + 1, before.x]);
  assert.match(r.notice, /à temps/);
}

// Volcan, pont absent : lave, +1 coup et retour au point de départ
{
  const r = room(['Ana']);
  r.course = ['volcan'];
  r.startHole(0);
  now += 2300;
  r.shoot('Ana', 0, 1, 0, 0);
  assert.strictEqual(r.shots[0].results.Ana.result, 'water');
  untilAim(r);
  assert.deepStrictEqual([r.balls.Ana.strokes, r.balls.Ana.x, r.balls.Ana.y], [2, ...hole('volcan').tee]);
}

// Tous en même temps : chacun tire quand il veut, balles fantômes
{
  const r = room(['Ana', 'Ben'], { mode: 'simul' });
  assert.strictEqual(r.turn, null);
  r.shoot('Ana', 0, 0.3, 0, 0);
  r.shoot('Ben', 0, 0.3, 0, 0);
  assert.strictEqual(r.shots.length, 2);
  assert.ok(!r.shots[0].paths.Ben);
  untilAim(r);
  assert.ok(r.balls.Ana.aimUntil && r.balls.Ben.aimUntil);
}

// Partie complète avec des robots (qui jouent vraiment), mort subite, fin de partie, victoires du salon
{
  const r = new Room('X', Math.random, false, clock);
  r.addPlayer('Ana');
  r.addBot('Ana'); r.addBot('Ana');
  r.configure('Ana', 'mode', 'elim');
  r.configure('Ana', 'max', 2);
  r.start('Ana');
  r.get('Ana').connected = false; // Ana est partie : un robot joue à sa place
  let guard = 0;
  while (r.phase === 'playing') { now = r.deadline; r.timeout(); assert.ok(++guard < 2000, 'la partie avance'); }
  assert.strictEqual(r.phase, 'over');
  assert.strictEqual(r.winners.length, 1);
  assert.strictEqual(r.wins[r.winners[0]], 1);
  assert.ok(Object.keys(r.outAt).length >= 1);
  assert.deepStrictEqual(r.ranking()[0], r.winners[0]);
}

// Par équipes et course : scores calculés, chaos tiré au sort, trou du jour enregistré
{
  const r = new Room('X', Math.random, false, clock);
  r.addPlayer('Ana'); r.addPlayer('Ben'); r.addBot('Ana'); r.addBot('Ana');
  r.configure('Ana', 'mode', 'equipes');
  r.configure('Ana', 'course', 'jour');
  r.configure('Ana', 'chaos', true);
  r.start('Ana');
  assert.ok(r.chaos?.name);
  for (const p of r.players) p.connected = p.bot; // tout le monde joue en robot
  let guard = 0;
  while (r.phase === 'playing') { now = r.deadline; r.timeout(); assert.ok(++guard < 2000); }
  const t = r.teamTotals();
  assert.ok(t[0] > 0 && t[1] > 0);
  assert.ok(daily.get(r.day).has('Ana'));
  assert.ok(r.viewFor('Ana').daily.length >= 2);
}
{
  const r = new Room('X', Math.random, false, clock);
  r.addPlayer('Ana'); r.addBot('Ana');
  r.configure('Ana', 'mode', 'course');
  r.configure('Ana', 'course', 'express');
  r.start('Ana');
  r.get('Ana').connected = false;
  let guard = 0;
  while (r.phase === 'playing') { now = r.deadline; r.timeout(); assert.ok(++guard < 2000); }
  assert.ok(Object.values(r.points).some(p => p > 0));
}

// Le dernier humain s'en va : les robots partent aussi (le salon peut fermer)
{
  const r = room(['Ana']);
  r.removePlayer('Ana');
  assert.strictEqual(r.players.length, 0);
}

console.log('Tests du Mini-golf : OK');
