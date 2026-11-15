// Mode Aventure (la Tour) : la physique, les mécanismes de chaque monde, et une ascension complète du Jardin jusqu'au
// trou du Sommet, avec de vrais coups. Si la tour ou la physique change, retrouver une suite de coups et mettre à jour
// aventure.route.json : { name (étape), club, yaw (radians), power (0..1), loft (degrés), wait (attente avant de frapper, s) }.
const test = require('node:test');
const assert = require('node:assert');
const P = require('./client/aventure/physics');
const L = require('./client/aventure/tower');

const ROUTE = require('./aventure.route.json');
// étapes après lesquelles on laisse le monde vivre (un plateau qui monte, des livres qui tombent, le vol du trébuchet)
const AFTER = { plateau1: 3, plateau2: 3, livre: 3 };
const idle = (w, b, s) => { for (let i = 0; i < s / P.DT; i++) P.step(w, b); };
const flat = surf => ({ ...L, blocks: [{ c: [0, -1, 0], h: [200, 1, 200], s: surf, yaw: 0, pitch: 0, roll: 0 }], zones: [], pickups: [], shards: [], cup: [999, 0, 999] });

test('la balle se pose au départ et ne bouge plus', () => {
  const w = P.createWorld(L), b = P.newBall(L.start);
  assert.strictEqual(P.simulate(w, b, { maxT: 6 }).end, 'rest');
  assert.ok(Math.abs(b.p[1] - 0.3) < 0.01);
});

test('aucun bloc fixe n’en chevauche un autre (sinon l’image scintille)', () => {
  const st = L.blocks.filter(b => !b.kin && !b.topple && !b.pitch && !b.roll && !b.yaw);
  const bad = [];
  for (let i = 0; i < st.length; i++) for (let j = i + 1; j < st.length; j++) {
    const a = st[i], b = st[j], o = [0, 1, 2].map(k => Math.min(a.c[k] + a.h[k], b.c[k] + b.h[k]) - Math.max(a.c[k] - a.h[k], b.c[k] - b.h[k]));
    if (o.every(x => x > 1e-6)) bad.push(`${a.look} / ${b.look} en ${a.c.map(v => v.toFixed(1))}`);
  }
  assert.deepStrictEqual(bad, []);
});

test('chaque surface a son caractère, et l’effet compte', () => {
  const roll = s => { const w = P.createWorld(flat(s)), b = P.newBall([0, 0.31, 0]); b.v = [6, 0, 0]; P.simulate(w, b, { maxT: 20 }); return b.p[0]; };
  assert.ok(roll('sand') < 4 && roll('ice') > roll('grass') * 3);
  const shot = (ix, iy) => { const w = P.createWorld(flat('grass')), b = P.newBall([0, 0.3, 0]); P.launch(b, 'fer', 0, 0.8, 30, ix, iy); P.simulate(w, b, { maxT: 20 }); return b.p; };
  const c = shot(0, 0);
  assert.ok(shot(0, -1)[0] < c[0], 'frappée en bas, la balle roule moins');
  assert.ok(shot(1, 0)[2] > c[2] + 1, 'frappée à droite, elle courbe à droite');
  assert.strictEqual(P.simulate(P.createWorld(L), P.newBall([60, 5, 60]), { maxT: 12 }).end, 'lost');
});

test('les mécanismes portent la balle : aiguille, cliquet, godet, mobile, orgue, trébuchet, trou qui tourne', () => {
  // la grande aiguille de l'horloge emporte une balle posée dessus
  let w = P.createWorld(L), b = P.newBall([0, 12.4, 8]);
  idle(w, b, 5);
  assert.ok(b.base?.look === 'hand' && b.p[0] > 4, `l’aiguille a tourné avec la balle (${b.p.map(x => x.toFixed(1))})`);
  // plateau à cliquet : la balle sur A fait monter B, qui reste en haut
  w = P.createWorld(L); b = P.newBall([9, 24.4, -11]);
  idle(w, b, 3.5);
  const plateB = w.blocks.find(x => x.kin?.type === 'lever' && x.kin.id === 1 && x.kin.role === 'B');
  assert.ok(plateB.c[1] > 26, 'le plateau jumeau est monté');
  // livres-dominos : le premier entraîne le second
  w = P.createWorld(L); b = P.newBall([0, 37, 9]); b.v = [0, 0, -8];
  P.simulate(w, b, { maxT: 2, until: (bb, ev) => ev.some(e => e.t === 'topple') });
  idle(w, b, 3);
  assert.ok(w.tags.livre2.c[1] < 37, 'le second livre est tombé');
  // un godet de la roue monte la balle
  w = P.createWorld(L); b = P.newBall([20, 49.5, 0]);
  const y0 = 49.5; idle(w, b, 4);
  assert.ok(b.p[1] > y0 + 2 && b.base?.look === 'bucket', `le godet monte (${b.p[1].toFixed(1)} m)`);
  // le mobile penche sous la balle
  w = P.createWorld(L); b = P.newBall([5, 86.4, 6]); idle(w, b, 2);
  const mob = w.blocks.find(x => x.kin?.type === 'mobile');
  assert.ok(Math.abs(mob.roll) > 0.05, 'le plateau a penché');
  // une touche d'orgue fait souffler son tuyau
  w = P.createWorld(L); b = P.newBall([-4.5, 96.35, 9.5]); idle(w, b, 0.3);
  assert.ok(P.windOn(w, L.zones.find(z => z.key === 1)), 'le tuyau souffle');
  // le trou bouge avec le disque du sommet
  w = P.createWorld(L); const c0 = P.cupAt(w); idle(w, P.newBall([0, -10, 0]), 3);
  assert.ok(Math.hypot(P.cupAt(w)[0] - c0[0], P.cupAt(w)[2] - c0[2]) > 0.5, 'le trou a tourné');
});

test('le téléport de l’administrateur pose la balle dans chaque monde', () => {
  assert.strictEqual(L.spawns.length, L.worlds.length);
  L.spawns.forEach((p, i) => {
    const w = P.createWorld(L), b = P.newBall(p), end = P.simulate(w, b, { maxT: 4 }).end;
    assert.ok(end === 'rest' && Math.abs(b.p[1] - p[1]) < 1, `${L.worlds[i].name} : la balle tient (${b.p.map(x => x.toFixed(1))})`);
  });
});

test('une ascension complète est possible, du Jardin au trou du Sommet (120 m)', () => {
  const w = P.createWorld(L), b = P.newBall(L.start);
  P.simulate(w, b, { maxT: 3 });
  let end = null;
  for (const [i, r] of ROUTE.entries()) {
    if (r.name === 'vol') { end = P.simulate(w, b, { maxT: 25, every: 1e5, wait: r.idle }).end; if (end === 'holed') break; assert.ok(end === 'rest' && b.base?.look === 'summit', `le trébuchet pose la balle au sommet (${b.p.map(x => x.toFixed(1))})`); continue; }
    assert.ok(w.clubs.has(r.club), `coup ${i + 1} (${r.name}) : le club ${r.club} doit avoir été trouvé`);
    if (r.wait) idle(w, b, r.wait);
    P.launch(b, r.club, r.yaw, r.power, r.loft, r.ix || 0, r.iy || 0);
    end = P.simulate(w, b, { maxT: 20, every: 1e5 }).end;
    if (end === 'rest' && AFTER[r.name]) end = P.simulate(w, b, { maxT: 25, every: 1e5, wait: AFTER[r.name] }).end;
    if (i < ROUTE.length - 1) assert.strictEqual(end, 'rest', `coup ${i + 1} (${r.name}) : la balle doit se poser (${b.p.map(x => x.toFixed(1))})`);
  }
  assert.strictEqual(end, 'holed', 'dernier coup : dans le trou');
});
