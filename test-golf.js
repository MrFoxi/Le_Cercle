const assert = require('node:assert');
const Golf = require('./public/golf/physics');
const { Room } = require('./golf/game');

// Physique : trou, eau, arrêt, rebonds dans les limites
{
  const [moulin, ile, , volcan] = Golf.HOLES;
  const holed = Golf.simulate(ile, 110, 300, 0, 0.8, 0.2); // pont du milieu présent : droit au trou
  assert.strictEqual(holed.result, 'holed');
  assert.deepStrictEqual(holed.path.at(-1), ile.cup);
  assert.strictEqual(Golf.simulate(volcan, 100, 300, 0, 1, 2.3).result, 'water'); // pont absent : dans la lave
  const back = Golf.simulate(moulin, 120, 300, Math.PI, 0.6, 0); // contre le mur, rebond, arrêt
  assert.strictEqual(back.result, 'stop');
  assert.ok(back.events.some(e => e.type.startsWith('bump')));
  for (const h of Golf.HOLES) for (let a = 0; a < 6.28; a += 0.7) {
    const s = Golf.simulate(h, h.tee[0], h.tee[1], a, 1, 1);
    assert.ok(s.path.every(([x, y]) => x >= 0 && x <= Golf.W && y >= 0 && y <= Golf.H), h.name);
  }
  assert.deepStrictEqual([Golf.label(1, 3), Golf.label(2, 4), Golf.label(2, 3), Golf.label(3, 3), Golf.label(5, 3), Golf.label(9, 3)], ['Trou en un !', 'Eagle', 'Birdie', 'Par', 'Double Bogey', 'Triple Bogey']);
}

// Chaque trou se termine : un joueur automatique (meilleur tir parmi une grille d'angles, de puissances et de moments) y arrive.
{
  for (const h of Golf.HOLES) {
    let [x, y] = h.tee, strokes = 0, done = false;
    while (!done && strokes < Golf.MAX_STROKES(h.par)) {
      strokes++;
      let best = null;
      for (const w of [0, 1.2, 2.4]) for (let a = 0; a < 360; a += 5) for (let p = 0.1; p <= 1.0001; p += 0.1) {
        const s = Golf.simulate(h, x, y, (a * Math.PI) / 180, p, strokes * 7.3 + w);
        const d = s.result === 'holed' ? -1 : s.result === 'water' ? 1e9 : Math.hypot(s.x - h.cup[0], s.y - h.cup[1]);
        if (!best || d < best.d) best = { d, s };
      }
      if (best.s.result === 'holed') done = true;
      else if (best.s.result !== 'water') [x, y] = [best.s.x, best.s.y];
    }
    assert.ok(done, `${h.name} : trou impossible à finir`);
  }
}

// Salon : 8 joueurs maximum, pas d'entrée en cours de partie, seul le créateur lance
let now = 1e6;
const clock = () => now;
const room = (...names) => {
  const r = new Room('X', Math.random, false, clock);
  names.forEach(n => r.addPlayer(n));
  r.start(names[0]);
  return r;
};
{
  const r = new Room('X', Math.random, false, clock);
  for (let i = 0; i < 8; i++) r.addPlayer(`J${i}`);
  assert.throws(() => r.addPlayer('Neuf'), /complet/);
  assert.strictEqual(new Set(r.players.map(p => p.color)).size, 8);
  assert.throws(() => r.start('J1'), /créateur/);
  r.start('J0');
  r.players.length = 1;
  assert.throws(() => r.addPlayer('Tard'), /en cours/);
  r.addSpectator('Tard');
}

// Tour par tour, tir, trajectoire envoyée à tous, pénalité d'eau, temps écoulé, abandon au maximum de coups
{
  const r = room('Ana', 'Ben');
  assert.deepStrictEqual([r.turn, r.stage, r.holeNo], ['Ana', 'aim', 0]);
  assert.throws(() => r.shoot('Ben', 0, 0.5, 0), /pas ton tour/);
  assert.throws(() => r.shoot('Ana', 0, 2, 0), /invalide/);
  assert.throws(() => r.shoot('Ana', NaN, 0.5, 0), /invalide/);
  r.shoot('Ana', Math.PI, 0.4, 0);
  assert.strictEqual(r.stage, 'roll');
  assert.ok(r.viewFor('Ben').shot.path.length > 2);
  assert.throws(() => r.shoot('Ana', 0, 0.5, 1), /Pas de tir/);
  now = r.deadline;
  r.timeout();
  assert.deepStrictEqual([r.turn, r.balls.Ana.strokes, r.stage], ['Ben', 1, 'aim']);
  assert.notDeepStrictEqual([r.balls.Ana.x, r.balls.Ana.y], Golf.HOLES[0].tee);
  assert.strictEqual(r.viewFor('Ben').shot, null);

  // Ana laisse filer le temps : +1 coup, la balle ne bouge pas
  now = r.deadline; r.timeout(); // tour de Ben passé aussi
  const before = { ...r.balls.Ana };
  now = r.deadline; r.timeout();
  assert.strictEqual(r.balls.Ana.strokes, before.strokes + 1);
  assert.deepStrictEqual([r.balls.Ana.x, r.balls.Ana.y], [before.x, before.y]);
  assert.match(r.notice, /à temps/);
}

// Volcan, pont absent : la balle tombe dans la lave, +1 coup et retour à son point de départ
{
  const r = room('Ana');
  r.startHole(3);
  now += 2300;
  r.shoot('Ana', 0, 1, 0);
  assert.strictEqual(r.shot.result, 'water');
  now = r.deadline;
  r.timeout();
  assert.deepStrictEqual([r.balls.Ana.strokes, r.balls.Ana.x, r.balls.Ana.y], [2, ...Golf.HOLES[3].tee]);
}

// Partie complète en ne laissant jamais tirer : chacun est arrêté au maximum de coups, scores, ordre et fin de partie
{
  const r = room('Ana', 'Ben', 'Cléo');
  for (let hole = 0; hole < Golf.HOLES.length; hole++) {
    assert.strictEqual(r.holeNo, hole);
    let guard = 0;
    while (r.stage !== 'holeEnd') { now = r.deadline; r.timeout(); assert.ok(++guard < 100); }
    const max = Golf.MAX_STROKES(Golf.HOLES[hole].par);
    assert.ok(['Ana', 'Ben', 'Cléo'].every(n => r.scores[n][hole] === max));
    now = r.deadline; r.timeout();
  }
  assert.strictEqual(r.phase, 'over');
  assert.strictEqual(r.viewFor('Ana').players[0].total, Golf.HOLES.reduce((s, h) => s + h.par + 3, 0));
  assert.throws(() => r.toLobby('Ben'), /créateur/);
  r.toLobby('Ana');
  r.start('Ana');
  assert.deepStrictEqual([r.phase, r.round, r.holeNo, r.scores.Ana.length], ['playing', 2, 0, 0]);
}

// Un joueur s'en va pendant son tour : on passe au suivant ; le trou se termine sans lui
{
  const r = room('Ana', 'Ben');
  r.removePlayer('Ana');
  assert.strictEqual(r.turn, 'Ben');
  r.shoot('Ben', 0, 0.3, 0);
  r.removePlayer('Ben');
  now = r.deadline;
  r.timeout(); // la trajectoire d'un joueur parti se termine sans erreur
}

console.log('Tests du Mini-golf : OK');
