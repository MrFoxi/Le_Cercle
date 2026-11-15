// Mode Aventure (la Tour) : la physique et une ascension complète, du marais jusqu'au trou, avec de vrais coups.
// Si la tour change, relancer la recherche de coups et mettre à jour ROUTE (yaw en radians, puissance 0..1, levée en degrés).
const test = require('node:test');
const assert = require('node:assert');
const P = require('./client/aventure/physics');
const L = require('./client/aventure/tower');

const ROUTE = [
  ['fer', -2.8587989303424646, 0.95, 30], ['fer', 3.4446500881974003, 0.9, 40], ['fer', -2.6206990073527248, 0.7, 40],
  ['fer', -1.290052121179329, 0.95, 30], ['wedge', -0.3099943112996488, 0.9, 56], ['wedge', 0.4831976149344063, 0.95, 64],
  ['fer', -0.29810331382149713, 0.85, 18], ['fer', 1.258353990897922, 0.8, 18], ['putter', -3.700225079402711, 0.45, 6],
  ['wedge', -1.5091332640026105, 0.9, 46], ['putter', -1.6850374216136899, 0.95, 6], ['fer', 0.1261636483615839, 0.9, 40],
  ['fer', 2.2283565688095774, 0.9, 40], ['fer', 1.8801922571605272, 1, 40], ['putter', 2.3982546667513844, 0.4, 6],
  ['fer', 3.045179198633693, 0.9, 40], ['fer', -1.7560005441373145, 0.85, 40], ['wedge', -1.4965252835094611, 0.9, 64],
  ['wedge', 1.2915568071691341, 0.85, 64], ['wedge', 0.9540400778518716, 0.7, 56], ['putter', 1.1725176016186125, 0.55, 6],
  ['wedge', 1.5852773887007423, 0.7, 64], ['wedge', 0.17341480533233208, 0.75, 64], ['wedge', -0.19249386819271108, 0.75, 64],
  ['wedge', -0.7703263224684337, 0.7, 56], ['wedge', -1.3794757403390727, 0.75, 64], ['fer', -2.7312269131905977, 0.8, 30],
  ['wedge', -2.1101827048999198, 0.95, 64], ['wedge', 2.714839408957127, 1, 46], ['wedge', 1.326708813733322, 0.85, 64],
  ['wedge', 1.5991112345794, 0.9, 64], ['wedge', 0.4381657758275694, 0.8, 64], ['wedge', -0.036096133660438755, 0.8, 46],
  ['wedge', -1.0658204902272366, 0.95, 64], ['wedge', -2.270969524611795, 0.85, 46], ['wedge', 2.616482233298673, 0.85, 46],
  ['wedge', 0.31024235870892325, 0.85, 56], ['putter', 0.7437700983640281, 0.4, 2],
];
const near = (a, b) => Math.abs(a - b) < 1e-9;

test('la balle tombe, se pose et reste immobile', () => {
  const w = P.createWorld(L), b = P.newBall([6, 3, 26]);
  const r = P.simulate(w, b, { maxT: 6 });
  assert.strictEqual(r.end, 'rest');
  assert.ok(near(Math.round(b.p[1] * 100) / 100, 0.3), `posée sur le plateau (y = ${b.p[1]})`);
});

test('chaque surface a son caractère : le sable arrête, la glace glisse', () => {
  const roll = surf => {
    const w = P.createWorld({ ...L, blocks: [{ c: [0, -1, 0], h: [80, 1, 80], s: surf, yaw: 0, pitch: 0, roll: 0 }], zones: [], pickups: [] });
    const b = P.newBall([0, 0.31, 0]); b.v = [6, 0, 0];
    P.simulate(w, b, { maxT: 20 });
    return b.p[0];
  };
  assert.ok(roll('sand') < 4, 'le sable freine fort');
  assert.ok(roll('ice') > roll('grass') * 3, 'la glace glisse bien plus loin que l’herbe');
});

test('l’effet : rétro qui arrête la balle, effet latéral qui la fait courber', () => {
  const flat = { ...L, blocks: [{ c: [0, -1, 0], h: [200, 1, 200], s: 'grass', yaw: 0, pitch: 0, roll: 0 }], zones: [], pickups: [] };
  const shot = (ix, iy) => { const w = P.createWorld(flat), b = P.newBall([0, 0.3, 0]); P.launch(b, 'fer', 0, 0.8, 30, ix, iy); P.simulate(w, b, { maxT: 20 }); return b.p; };
  const center = shot(0, 0), low = shot(0, -1), right = shot(1, 0);
  assert.ok(low[0] < center[0], 'frappée en bas, la balle roule moins');
  assert.ok(right[2] > center[2] + 1, 'frappée à droite, la balle courbe à droite');
});

test('tomber dans le vide fait perdre ; le trou fait gagner', () => {
  const w = P.createWorld(L), b = P.newBall([40, 5, 40]);
  assert.strictEqual(P.simulate(w, b, { maxT: 10 }).end, 'lost');
});

test('une ascension complète est possible, du marais jusqu’à la couronne (98 m), en ramassant le wedge', () => {
  const w = P.createWorld(L), b = P.newBall(L.start);
  P.simulate(w, b, { maxT: 3 });
  let end = null;
  for (const [i, [club, yaw, power, loft]] of ROUTE.entries()) {
    assert.ok(w.clubs.has(club), `coup ${i + 1} : le club ${club} doit avoir été trouvé`);
    P.launch(b, club, yaw, power, loft);
    end = P.simulate(w, b, { maxT: 20, every: 1000 }).end;
    if (i < ROUTE.length - 1) assert.strictEqual(end, 'rest', `coup ${i + 1} : la balle doit se poser (y = ${b.p[1].toFixed(1)})`);
  }
  assert.strictEqual(end, 'holed', `dernier coup : dans le trou (balle en ${b.p.map(x => x.toFixed(1)).join(' ')})`);
});

test('les mécanismes : racines qui cassent, obélisque qui bascule, dalle qui fait sortir des marches, ascenseur qui porte', () => {
  const w = P.createWorld(L);
  // racines du terrier (face avant du socle)
  const roots = P.newBall([9, 1.2, 22]); roots.v = [0, 0, -12];
  assert.ok(P.simulate(w, roots, { maxT: 3 }).events.some(e => e.t === 'break'));
  // l'obélisque du canyon, frappé de côté, bascule et forme un pont
  const ob = P.newBall([1, 30.5, -20.5]); ob.v = [-8, 0, 0];
  assert.ok(P.simulate(w, ob, { maxT: 2 }).events.some(e => e.t === 'topple'));
  for (let i = 0; i < 2 / P.DT; i++) P.step(w, ob);
  const obelisk = w.blocks.find(b => b.look === 'obelisk');
  assert.ok(obelisk.c[1] < 30.5 && obelisk.c[0] < -5, 'l’obélisque est couché en travers de la faille');
  // la dalle du col fait apparaître des marches
  const plate = P.newBall([10.5, 40.6, 2.5]);
  P.simulate(w, plate, { maxT: 1 });
  assert.ok(w.triggered.has('marches'));
  // les deux cachettes : la vitre de cristal (Grand Lob) et la paroi de glace (Faucille) cèdent sous un bon coup
  const lob = P.newBall([-4.5, 20.3, -3]); lob.v = [0, 0, 9];
  assert.ok(P.simulate(w, lob, { maxT: 5 }).events.some(e => e.t === 'club' && e.club === 'lob'));
  const fau = P.newBall([-20, 44.3, -8]); fau.v = [10, 0, 0];
  assert.ok(P.simulate(w, fau, { maxT: 5 }).events.some(e => e.t === 'club' && e.club === 'faucille'));
  // la lave de la forge recrache la balle vers le haut ; un coup courbé (Faucille) contourne la flèche jusqu'à la terrasse cachée
  const lava = P.newBall([13.3, 71, -3.5]);
  const lv = P.simulate(P.createWorld(L), lava, { maxT: 0.5, until: (b, ev) => ev.some(e => e.t === 'lava') });
  assert.ok(lv.events.some(e => e.t === 'lava') && lava.v[1] > 5, 'la lave renvoie la balle en l’air');
  const wc = P.createWorld(L); wc.clubs.add('faucille');
  const curve = P.newBall([10.5, 66.3, 6.5]); P.launch(curve, 'faucille', -1.8, 0.7, 26, -1, 0);
  assert.ok(P.simulate(wc, curve, { maxT: 12 }).events.some(e => e.t === 'shard' && e.id === 6), 'l’éclat caché derrière la flèche');
  // l'ascenseur : une balle posée dessus monte avec lui
  const w2 = P.createWorld(L), lift = P.newBall([8, 29.6, -20]);
  let top = 0;
  for (let i = 0; i < 5 / P.DT; i++) { P.step(w2, lift); top = Math.max(top, lift.p[1]); }
  assert.ok(top > 34, `la balle monte avec l’ascenseur (max ${top.toFixed(1)} m)`);
});
