// Tests de Prop Hunt : carte (pas d'objet dans un mur), rôles qui tournent, chasseurs immobiles pendant la cachette,
// déguisement, tirs (trouvé / raté), sifflets, fin de manche, partie complète entre robots.
const assert = require('assert');
const M = require('./public/prophunt/map');
const { Room, HIDE_MS, HUNT_MS } = require('./prophunt/game');

let seed = 11;
const rng = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

// Carte : objets dans la place, hors des bâtiments, sans se chevaucher ; collisions qui repoussent.
assert(M.decor.length >= 60 && M.buildings.length === 16);
for (const d of M.decor) {
  assert(Math.abs(d.x) < M.HALF && Math.abs(d.z) < M.HALF);
  assert(!M.buildings.some(b => Math.abs(d.x - b.x) < b.hw && Math.abs(d.z - b.z) < b.hd), 'objet dans un bâtiment');
}
{ const b = M.buildings[0], p = M.collide({ x: b.x, z: b.z + 0.1 }, M.R); assert(Math.abs(p.z - b.z) >= b.hd || Math.abs(p.x - b.x) >= b.hw, 'sorti du bâtiment'); }

const setup = (n, bots = 0) => {
  let now = 1000;
  const r = new Room('ABCDE', rng, false, () => now);
  for (let k = 0; k < n; k++) r.addPlayer('J' + k);
  for (let k = 0; k < bots; k++) r.addBot('J0');
  r.start('J0'); r.stop();
  r.at = v => (now = v); r.now = () => now;
  return r;
};

// Rôles : 1 chasseur pour 4 joueurs, et ça tourne d'une manche à l'autre.
{
  const r = setup(4);
  const first = Object.entries(r.roles).filter(([, v]) => v === 'hunter').map(([n]) => n);
  assert.strictEqual(first.length, 1);
  // pendant la cachette, le chasseur ne bouge pas, les objets oui
  const h = first[0], prop = Object.keys(r.roles).find(n => r.roles[n] === 'prop');
  const hb = r.bodies[h], pb = r.bodies[prop], hx = hb.x, px = pb.x;
  r.move(h, { x: hx + 1, z: hb.z, ry: 0 }); r.move(prop, { x: px + 1, z: pb.z, ry: 0 });
  assert.strictEqual(hb.x, hx); assert.strictEqual(pb.x, px + 1);
  // un chasseur qui attend pendant toute la cachette n'est pas pris pour un joueur parti
  for (let t = 0; t < 320; t++) { r.at(r.now() + 100); r.move(h, { x: hx, z: hb.z, ry: 0 }); r.move(prop, { x: pb.x, z: pb.z, ry: 0 }); for (const n of Object.keys(r.bodies)) if (n !== h && n !== prop) r.bodies[n].heard = r.now(); r.tick(); }
  assert(hb.alive, 'chasseur toujours là après la cachette');
  r.move(prop, { x: px + 20, z: pb.z, ry: 0 }); assert.strictEqual(pb.x, px + 1, 'téléportation refusée');
  // déguisement : seulement en objet qu'on a près de soi
  const d = M.decor[0];
  const far = M.TYPES.find(t => !M.decor.some(x => x.type === t && Math.hypot(x.x - pb.x, x.z - pb.z) < 4.5));
  if (far) assert.throws(() => r.disguise(prop, far), /Approche/);
  Object.assign(pb, { x: d.x + 0.6, z: d.z });
  r.disguise(prop, d.type);
  assert.strictEqual(pb.type, d.type);
  assert.throws(() => r.disguise(h, d.type), /pas te transformer/);
  // la chasse commence
  r.at(r.deadline); r.timeout(); r.stop();
  assert.strictEqual(r.phase, 'hunt');
  // tir sur un objet innocent : -12 PV ; sur un vrai joueur : trouvé, +2 points
  const near = M.decor.find(x => x.id !== d.id);
  Object.assign(hb, { x: near.x + 0.5, z: near.z });
  r.tag(h, { decor: near.id });
  assert.strictEqual(hb.hp, 88);
  r.at(r.now() + 500);
  Object.assign(hb, { x: pb.x + 1, z: pb.z });
  r.tag(h, { player: prop });
  assert(!pb.alive && r.order.includes(prop));
  assert.strictEqual(r.get(h).points, 2);
  // sifflet : +1 point, pas plus d'une fois toutes les 8 s ; sifflet forcé après 35 s de silence
  const other = Object.keys(r.roles).find(n => r.roles[n] === 'prop' && r.bodies[n].alive);
  const fx = []; r.emit = (ev, data) => ev === 'fx' && fx.push(data);
  r.at(r.now() + 9000); r.whistle(other); r.whistle(other);
  assert.strictEqual(r.get(other).points, 1); assert.strictEqual(fx.filter(f => f.kind === 'whistle').length, 1);
  r.at(r.now() + 36000); for (const b of Object.values(r.bodies)) b.heard = r.now(); r.tick();
  assert(fx.filter(f => f.kind === 'whistle' && f.forced).length >= 1, 'sifflet forcé');
  // temps écoulé : les objets survivants gagnent la manche (+3)
  const before = r.get(other).points;
  r.at(r.phaseAt + HUNT_MS); r.timeout();
  assert.strictEqual(r.phase, 'roundEnd'); assert.strictEqual(r.result.winner, 'props');
  assert.strictEqual(r.get(other).points, before + 3);
  r.at(r.deadline); r.timeout(); r.stop();
  const second = Object.entries(r.roles).filter(([, v]) => v === 'hunter').map(([n]) => n);
  assert.notDeepStrictEqual(second, first, 'le chasseur change');
}

// Un chasseur qui rate trop souvent est éliminé ; plus de chasseur : les objets gagnent.
{
  const r = setup(2);
  r.at(r.now() + HIDE_MS); r.timeout(); r.stop();
  const h = Object.keys(r.roles).find(n => r.roles[n] === 'hunter'), hb = r.bodies[h];
  for (let k = 0; k < 9; k++) { const d = M.decor[k]; Object.assign(hb, { x: d.x + 0.5, z: d.z }); r.at(r.now() + 500); r.tag(h, { decor: d.id }); }
  assert(!hb.alive);
  assert.strictEqual(r.phase, 'roundEnd'); assert.strictEqual(r.result.winner, 'props');
}

// Partie complète entre robots (un humain spectateur dans son rôle) : les manches se terminent toutes.
{
  const r = setup(1, 7);
  r.settings.rounds = 2;
  for (let round = 1; round <= 2; round++) {
    for (let t = 0; t < HIDE_MS / 100; t++) { r.tick(); r.at(r.now() + 100); r.bodies.J0.heard = r.now(); }
    r.timeout(); r.stop();
    assert.strictEqual(r.phase, 'hunt');
    const bots = Object.keys(r.bodies).filter(n => r.get(n).bot && r.roles[n] === 'prop');
    assert(bots.every(n => r.bodies[n].type), 'les robots objets sont déguisés');
    for (let t = 0; t < HUNT_MS / 100 && r.phase === 'hunt'; t++) { r.tick(); r.at(r.now() + 100); r.bodies.J0.heard = r.now(); r.timeout(); }
    assert.strictEqual(r.phase, 'roundEnd', `manche ${round} : ${JSON.stringify(r.result)}`);
    r.at(r.deadline); r.timeout(); r.stop();
  }
  assert.strictEqual(r.phase, 'over');
  assert(r.ranking.length === 8);
}

// Moqueries, gadgets des chasseurs, changement de forme, vie regagnée, réglages.
{
  const r = setup(4);
  const h = Object.keys(r.roles).find(n => r.roles[n] === 'hunter'), props = Object.keys(r.roles).filter(n => r.roles[n] === 'prop');
  const hb = r.bodies[h], [p1, p2, p3] = props.map(n => r.bodies[n]);
  // tout le monde près d'un même objet
  const d = M.decor[5];
  [p1, p2].forEach((b, k) => Object.assign(b, { x: d.x + 0.5 + k * 0.4, z: d.z }));
  Object.assign(p3, { x: d.x + 9, z: d.z });
  r.disguise(props[0], d.type);
  r.at(r.deadline); r.timeout(); r.stop();
  for (const b of Object.values(r.bodies)) b.heard = r.now();
  // changer de forme pendant la chasse : pas avant 10 s
  const p3pts = r.get(props[2]).points; r.taunt(props[2], 'canard'); assert.strictEqual(r.get(props[2]).points, p3pts + 1, 'moquerie dès le début de la chasse');
  r.disguise(props[0], d.type);
  assert.throws(() => r.disguise(props[0], d.type), /Encore/);
  r.at(r.now() + 10500); r.disguise(props[0], d.type);
  // moqueries : points selon le son, une toutes les 8 s (et dès le début de la chasse)
  const pts = r.get(props[1]).points;
  r.taunt(props[1], 'coucou'); r.taunt(props[1], 'pet');
  assert.strictEqual(r.get(props[1]).points, pts + 3);
  r.at(r.now() + 8100); r.taunt(props[1], 'pet'); assert.strictEqual(r.get(props[1]).points, pts + 5);
  r.taunt(props[2], 'inventé'); // moquerie inconnue : ignorée
  // radar : les objets à moins de 7 m, une seule fois
  Object.assign(hb, { x: d.x - 1, z: d.z });
  const pings = r.radar(h);
  assert.strictEqual(pings.length, 2);
  assert.strictEqual(r.radar(h), null, 'un seul radar par manche');
  // grenade : marque les objets touchés, pas trop loin du chasseur
  const fx = []; r.emit = (ev, f) => ev === 'fx' && fx.push(f);
  r.grenade(h, d.x + 30, d.z); assert(hb.grenade, 'trop loin : pas lancée');
  r.grenade(h, d.x + 0.5, d.z);
  assert(!hb.grenade && p1.marked > r.now() && p2.marked > r.now() && !(p3.marked > r.now()));
  assert.deepStrictEqual(fx.find(f => f.kind === 'grenade').hits.sort(), [props[0], props[1]].sort());
  // vie regagnée en trouvant un objet
  hb.hp = 50; r.at(r.now() + 500); r.tag(h, { player: props[0] });
  assert.strictEqual(hb.hp, 70);
}
{
  let now = 0;
  const r = new Room('QWERT', rng, false, () => now);
  r.addPlayer('A'); r.addBot('A');
  r.configure('A', 'hide', 20); r.configure('A', 'hunt', 240);
  assert.throws(() => r.configure('A', 'hunt', 7), /invalide/);
  r.start('A'); r.stop();
  assert.strictEqual(r.deadline, 20000);
  now = 20000; r.timeout(); r.stop();
  assert.strictEqual(r.deadline, 20000 + 240000);
  assert.strictEqual(r.viewFor('A').night, false);
}

console.log('Prop Hunt : tests OK');
