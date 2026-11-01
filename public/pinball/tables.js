// Les tables : géométrie (cm, x vers la droite, y vers le haut de la table), éléments, lumières, règles, missions.
// Table de 52 × 110 cm ; aire de jeu de x = 0 à 46, couloir de lancement de 46 à 52.
// Toutes partagent la même ossature (bords, flippers, slingshots, couloirs du haut) ; le haut du plateau change.
const seg = (ax, ay, bx, by, o = {}) => ({ ax, ay, bx, by, ...o });
function arc(cx, cy, r, a0, a1, n, o = {}) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const t0 = a0 + ((a1 - a0) * i) / n, t1 = a0 + ((a1 - a0) * (i + 1)) / n;
    out.push(seg(cx + r * Math.cos(t0), cy + r * Math.sin(t0), cx + r * Math.cos(t1), cy + r * Math.sin(t1), o));
  }
  return out;
}
// Triangle de slingshot : seule la face tournée vers le centre éjecte la bille.
const sling = ([a, b, c], id) => [
  seg(a[0], a[1], b[0], b[1], { kind: 'rubber', e: 0.6 }),
  seg(b[0], b[1], c[0], c[1], { kind: 'rubber', e: 0.6 }),
  seg(c[0], c[1], a[0], a[1], { kind: 'sling', id, kick: 95, e: 0.7 }),
];
const SLINGS = [[[4.5, 35], [4.5, 29.5], [10.5, 23]], [[41.5, 35], [41.5, 29.5], [35.5, 23]]];

// Emplacements de cibles le long des murs gauche (x = 0,6) et droit (x = 45,4)
const LEFT = { 3: [[38, 41], [42.5, 45.5], [47, 50]], 4: [[37.5, 40], [40.8, 43.3], [44.1, 46.6], [47.4, 49.9]] };
const RIGHT = { 3: [[44, 47], [47.6, 50.6], [51.2, 54.2]], 4: [[42.5, 45], [45.8, 48.3], [49.1, 51.6], [52.4, 54.9]] };
const wallTargets = (x, slots, ids, kind) => ids.map((id, i) => seg(x, slots[ids.length][i][0], x, slots[ids.length][i][1], { kind, id, e: kind === 'drop' ? 0.25 : 0.35 }));
const leftTargets = (ids, kind) => wallTargets(0.6, LEFT, ids, kind);
const rightTargets = (ids, kind) => wallTargets(45.4, RIGHT, ids, kind);
// Voyants des cibles, à côté de chacune
const targetLights = (ids, side, color, labels = {}) => ids.map((id, i) => {
  const s = (side === 'L' ? LEFT : RIGHT)[ids.length][i];
  return { id, x: side === 'L' ? 3 : 42.6, y: (s[0] + s[1]) / 2, color, label: labels[id] };
});

const shell = () => [
  seg(52, 0, 52, 84, { kind: 'outer' }),
  ...arc(26, 84, 26, 0, Math.PI, 30, { kind: 'outer' }),
  seg(0, 84, 0, 28, { kind: 'outer' }),
  seg(0, 28, 13.6, 13.4, { kind: 'apron' }),
  seg(46, 28, 32.4, 13.4, { kind: 'apron' }),
  seg(46, 3, 46, 84, { kind: 'lane' }),
  seg(46, 2, 52, 2, { kind: 'plunger', e: 0.1 }),
  seg(46, 84.5, 46, 100, { kind: 'gate', oneWay: [-1, 0] }), // la bille sort du couloir mais n'y revient pas
  ...sling(SLINGS[0], 'slingL'), ...sling(SLINGS[1], 'slingR'),
  ...[14, 20, 26, 32].map(x => seg(x, 94, x, 100, { kind: 'post' })), // couloirs du haut 1, 2, 3
  seg(8.6, 57, 8.6, 66, { kind: 'metal' }), // embouchure de la rampe gauche
];
// Poche du trou central, fermée ou non par une porte ; embouchure de la rampe droite
const pocket = door => [
  seg(20, 58, 20, 65, { kind: 'metal' }), seg(26, 58, 26, 65, { kind: 'metal' }), seg(20, 65, 26, 65, { kind: 'metal' }),
  ...(door ? [seg(20, 58, 26, 58, { kind: 'door', id: door, e: 0.3 })] : []),
];
const rightMouth = () => [seg(33, 57, 33, 64, { kind: 'metal' }), seg(40.5, 57, 40.5, 64, { kind: 'metal' })];
const threeBumpers = (look, kick = 230, r = 2.8) => [
  { x: 17, y: 84, r, kind: 'bumper', id: 'B1', kick, e: 0.7, look },
  { x: 29, y: 84, r, kind: 'bumper', id: 'B2', kick, e: 0.7, look },
  { x: 23, y: 75, r, kind: 'bumper', id: 'B3', kick, e: 0.7, look },
];

const RAMPS = {
  left: [[4.4, 66, 0], [4.3, 73, 1.5], [4.8, 84, 4.5], [8, 96, 7.5], [16, 104, 8.5], [27, 105, 8.5], [37, 101, 8], [43, 92, 7], [44.2, 78, 5], [44.2, 60, 2.2], [44.1, 46, 0.4], [44, 41, 0]],
  right: [[36.7, 64, 0], [36.9, 71, 1.5], [38, 82, 4.5], [38.5, 93, 8], [33, 101.5, 10], [23, 102.5, 10], [13, 101.5, 10], [6, 95, 9], [2.6, 84, 7], [2.4, 66, 4], [2.3, 50, 1.2], [2.3, 44, 0.2], [2.3, 40.5, 0]],
  center: [[23, 60, 0], [23, 68, 2], [22.5, 80, 6], [29, 94, 9], [23, 103.5, 10.5], [15, 97, 10], [8.5, 88, 8.5], [4, 74, 5.5], [2.6, 60, 2.4], [2.3, 46, 0.4], [2.3, 40.5, 0]],
};
const RAMP_IN = {
  left: { ax: 0.3, ay: 66, bx: 8.3, by: 66 },
  right: { ax: 33.3, ay: 64, bx: 40.2, by: 64 },
  center: { ax: 19.3, ay: 60, bx: 26.7, by: 60 },
};
const RAMP_LIGHT = { left: [4.4, 60.5], right: [36.7, 59], center: [23, 55] };

// Assemble une table : ossature + éléments propres, lumières communes, rampes et leurs entrées.
function table(def) {
  const ramps = def.ramps.map(r => ({ ...r, points: RAMPS[r.id] }));
  const c = def.colors;
  return {
    flippers: [
      { id: 'L', x: 14.8, y: 12, len: 7.2, r0: 1.1, r1: 0.55, rest: -0.55, up: 0.5 },
      { id: 'R', x: 31.2, y: 12, len: 7.2, r0: 1.1, r1: 0.55, rest: Math.PI + 0.55, up: Math.PI - 0.5 },
    ],
    lane: { x0: 46, y1: 14, start: [49, 4], min: 300, max: 560 }, // même un lancer faible sort du couloir
    slings: SLINGS,
    groups: [], banks: [], fields: [], portals: [],
    ...def,
    walls: [...shell(), ...def.walls],
    ramps,
    triggers: [
      { ax: 14.3, ay: 97, bx: 19.7, by: 97, kind: 'rollover', id: 'L1' },
      { ax: 20.3, ay: 97, bx: 25.7, by: 97, kind: 'rollover', id: 'L2' },
      { ax: 26.3, ay: 97, bx: 31.7, by: 97, kind: 'rollover', id: 'L3' },
      { ax: 0.3, ay: 55, bx: 8.3, by: 55, kind: 'spinner', id: 'spinner' },
      ...ramps.map(r => ({ ...RAMP_IN[r.id], kind: 'ramp', ramp: r.id, dir: [0, 1] })),
      ...(def.triggers || []),
    ],
    lights: [
      { id: 'L1', x: 17, y: 98.5, color: c.c }, { id: 'L2', x: 23, y: 98.5, color: c.c }, { id: 'L3', x: 29, y: 98.5, color: c.c },
      ...ramps.map(r => ({ id: `ramp:${r.id}`, x: RAMP_LIGHT[r.id][0], y: RAMP_LIGHT[r.id][1], color: r.color, arrow: true })),
      { id: 'x2', x: 17, y: 30, color: c.c, label: '×2' }, { id: 'x3', x: 21, y: 30, color: c.c, label: '×3' },
      { id: 'x4', x: 25, y: 30, color: c.c, label: '×4' }, { id: 'x5', x: 29, y: 30, color: c.c, label: '×5' },
      { id: 'jackpot', x: 23, y: 40, color: '#ff8a00', label: 'JACKPOT', big: true },
      { id: 'save', x: 23, y: 8, color: '#5bff8f', label: 'SAVE' },
      ...(def.lights || []),
    ],
  };
}

// Missions : type group / bank (série de cibles), ramps, combo, multiball, score, count (événements comptés), super (finale).
const common = (score, extra) => [
  ...extra,
  { id: 'ramps', type: 'ramps', name: 'Tour des rampes', desc: 'Réussis chaque rampe au moins une fois.', bonus: 75000 },
  { id: 'combo', type: 'combo', n: 5, name: 'Combo ×5', desc: 'Enchaîne 5 actions sans temps mort.', bonus: 60000 },
  { id: 'multiball', type: 'multiball', name: 'Multiball', desc: 'Capture 2 billes dans le trou.', bonus: 150000 },
  { id: 'score', type: 'score', n: score, name: score >= 2e6 ? 'Deux millions' : score > 1e6 ? 'Un million et demi' : 'Le million', desc: `Atteins ${score.toLocaleString('fr-FR')} points.`, bonus: 100000 },
  { id: 'super', type: 'super', name: 'Super Jackpot', desc: 'En multiball : 3 rampes, puis le trou.', bonus: 500000, final: true },
];

const arcade = table({
  id: 'arcade',
  name: 'Arcade classique',
  tagline: 'Néons, bumpers et rampes chromées : la table pour apprendre.',
  colors: { felt: '#1b0f3a', a: '#ff2e88', b: '#22d3ee', c: '#ffd23f' },
  title: 'ARCADE',
  walls: [
    ...pocket('door'), ...rightMouth(),
    ...leftTargets(['A', 'R', 'C'], 'target'),
    ...rightTargets(['D1', 'D2', 'D3'], 'drop'),
  ],
  circles: threeBumpers('neon'),
  triggers: [{ ax: 40.8, ay: 72, bx: 45.7, by: 72, kind: 'orbit', id: 'orbit', dir: [0, 1] }],
  ramps: [{ id: 'left', name: 'Rampe gauche', color: '#ff2e88' }, { id: 'right', name: 'Rampe droite', color: '#22d3ee' }],
  saucers: [{ x: 23, y: 62, r: 2.6, id: 'saucer', role: 'lock', door: 'door' }], // couvre toute la poche
  groups: [{ id: 'arc', ids: ['A', 'R', 'C'], hits: 2, ordered: true }],
  banks: [{ id: 'drops', ids: ['D1', 'D2', 'D3'], opens: ['door'] }],
  lights: [
    ...targetLights(['A', 'R', 'C'], 'L', '#ff2e88', { A: 'A', R: 'R', C: 'C' }),
    ...targetLights(['D1', 'D2', 'D3'], 'R', '#22d3ee'),
    { id: 'door', x: 23, y: 54.5, color: '#ffd23f', arrow: true, label: 'LOCK' },
  ],
  missions: common(1e6, [
    { id: 'arc', type: 'group', ref: 'arc', name: 'A-R-C dans l’ordre', desc: 'Allume A, puis R, puis C (2 coups par cible).', bonus: 50000 },
    { id: 'drops', type: 'bank', ref: 'drops', name: 'Cibles tombantes', desc: 'Abats les 3 cibles : la porte du trou s’ouvre.', bonus: 40000 },
  ]),
});

const space = table({
  id: 'space',
  name: 'Espace',
  tagline: 'Planètes, vaisseau, portails et trou noir qui aspire la bille.',
  colors: { felt: '#070a24', a: '#8a5cff', b: '#22d3ee', c: '#ffb36b' },
  title: 'ESPACE',
  unlock: { from: 'arcade', score: 100000 },
  walls: [
    seg(19, 53, 19, 60, { kind: 'metal' }), seg(27, 53, 27, 60, { kind: 'metal' }), // embouchure de la rampe centrale
    ...leftTargets(['AS1', 'AS2', 'AS3'], 'drop'),
    ...rightTargets(['S1', 'S2', 'S3', 'S4'], 'target'),
  ],
  circles: [
    { x: 15, y: 83, r: 3.1, kind: 'bumper', id: 'B1', kick: 230, e: 0.7, look: 'jupiter' },
    { x: 31, y: 85, r: 2.5, kind: 'bumper', id: 'B2', kick: 230, e: 0.7, look: 'mars' },
    { x: 23, y: 75, r: 2.3, kind: 'bumper', id: 'B3', kick: 230, e: 0.7, look: 'saturn' },
    { x: 23, y: 66, r: 1.6, kind: 'mover', id: 'ufo', e: 0.8, move: { ax: 9, freq: 0.3 }, look: 'ufo' },
  ],
  fields: [{ kind: 'pull', id: 'hole', x: 36, y: 50, r: 8, k: 2600 }],
  portals: [
    { id: 'P1', x: 43.2, y: 68, r: 1.8, up: true, to: { x: 23, y: 103, dir: [0, -1] }, color: '#22d3ee' },
    { id: 'P2', x: 9.5, y: 46, r: 1.7, up: true, to: { x: 40, y: 98, dir: [-0.6, -0.8] }, color: '#ff4dd8' },
  ],
  ramps: [{ id: 'left', name: 'Hyperespace', color: '#8a5cff' }, { id: 'center', name: 'Orbite', color: '#22d3ee' }],
  saucers: [{ x: 36, y: 50, r: 1.7, id: 'hole', role: 'lock', active: true }],
  groups: [{ id: 'stars', ids: ['S1', 'S2', 'S3', 'S4'], hits: 1 }],
  banks: [{ id: 'asteroids', ids: ['AS1', 'AS2', 'AS3'] }],
  lights: [
    ...targetLights(['AS1', 'AS2', 'AS3'], 'L', '#ffb36b'),
    ...targetLights(['S1', 'S2', 'S3', 'S4'], 'R', '#22d3ee', { S1: 'S', S2: 'T', S3: 'A', S4: 'R' }),
    { id: 'lock', x: 30.5, y: 50, color: '#8a5cff', arrow: true },
  ],
  missions: common(1.5e6, [
    { id: 'stars', type: 'group', ref: 'stars', name: 'Constellation', desc: 'Allume les 4 étoiles S-T-A-R.', bonus: 60000 },
    { id: 'asteroids', type: 'bank', ref: 'asteroids', name: 'Champ d’astéroïdes', desc: 'Pulvérise les 3 astéroïdes.', bonus: 45000 },
    { id: 'portals', type: 'count', ref: 'portal', n: 5, name: 'Voyageur', desc: 'Traverse 5 portails.', bonus: 70000 },
  ]),
});

const casino = table({
  id: 'casino',
  name: 'Casino',
  tagline: 'Roulette, machine à sous, cartes et jetons : faites vos jeux.',
  colors: { felt: '#063a22', a: '#e31b3b', b: '#ffcc33', c: '#fff3c4' },
  title: 'CASINO',
  unlock: { from: 'space', score: 100000 },
  walls: [
    ...pocket(null), ...rightMouth(),
    ...leftTargets(['J', 'Q', 'K', 'AS'], 'target'),
    ...rightTargets(['C1', 'C2', 'C3'], 'drop'),
    seg(40.8, 76, 45.7, 76, { kind: 'target', id: 'slot', e: 0.4 }), // la machine à sous, au bout du couloir droit
  ],
  circles: threeBumpers('chip'),
  ramps: [{ id: 'left', name: 'Rampe d’or', color: '#ffcc33' }, { id: 'right', name: 'Rampe rouge', color: '#e31b3b' }],
  saucers: [{ x: 23, y: 62, r: 2.6, id: 'roulette', role: 'roulette', active: true }],
  groups: [{ id: 'royal', ids: ['J', 'Q', 'K', 'AS'], hits: 1 }],
  banks: [{ id: 'chips', ids: ['C1', 'C2', 'C3'] }],
  lights: [
    ...targetLights(['J', 'Q', 'K', 'AS'], 'L', '#ffcc33', { J: 'J', Q: 'Q', K: 'K', AS: 'A' }),
    ...targetLights(['C1', 'C2', 'C3'], 'R', '#e31b3b'),
    { id: 'slot', x: 43.2, y: 72, color: '#ffcc33', label: '777' },
    { id: 'lock', x: 23, y: 54.5, color: '#e31b3b', arrow: true, label: 'ROULETTE' },
  ],
  missions: common(2e6, [
    { id: 'royal', type: 'group', ref: 'royal', name: 'Main royale', desc: 'Touche le Valet, la Dame, le Roi et l’As.', bonus: 60000 },
    { id: 'chips', type: 'bank', ref: 'chips', name: 'Pile de jetons', desc: 'Abats les 3 jetons.', bonus: 40000 },
    { id: 'slots', type: 'count', ref: 'slotWin', n: 1, name: 'Jackpot de la machine', desc: 'Aligne 3 symboles identiques (touche la machine au bout du couloir droit).', bonus: 90000 },
  ]),
});

const jungle = table({
  id: 'jungle',
  name: 'Jungle',
  tagline: 'Statues, serpents, temple, pièges et trésor caché.',
  colors: { felt: '#0d2b14', a: '#3ddc84', b: '#ffc23d', c: '#ffe7a0' },
  title: 'JUNGLE',
  unlock: { from: 'casino', score: 100000 },
  walls: [
    ...pocket('door'), ...rightMouth(),
    ...leftTargets(['T1', 'T2', 'T3', 'T4'], 'target'),
    ...rightTargets(['I1', 'I2', 'I3'], 'drop'),
    seg(40.8, 70, 45.7, 70, { kind: 'secret', id: 'secret', e: 0.3 }), // passage secret, fermé par une dalle
    seg(21, 54, 25, 54, { kind: 'target', id: 'treasure', active: false }), // trésor caché : sort du sol plus tard
  ],
  circles: [
    ...threeBumpers('idol'),
    { x: 23, y: 69, r: 1.3, kind: 'mover', id: 'snake1', e: 0.6, move: { ax: 8, freq: 0.25 }, look: 'snake' },
    { x: 23, y: 46, r: 1.3, kind: 'mover', id: 'snake2', e: 0.6, move: { ax: 7, freq: 0.18, phase: 1.5 }, look: 'snake' },
  ],
  triggers: [{ ax: 40.8, ay: 82, bx: 45.7, by: 82, kind: 'secret', id: 'secretPass', dir: [0, 1] }],
  ramps: [{ id: 'left', name: 'Liane', color: '#3ddc84' }, { id: 'right', name: 'Cascade', color: '#ffc23d' }],
  saucers: [
    { x: 23, y: 62, r: 2.6, id: 'temple', role: 'lock', door: 'door' },
    { x: 12, y: 47, r: 1.3, id: 'trap', role: 'trap', active: true, maxSpeed: 130 },
  ],
  groups: [{ id: 'tiki', ids: ['T1', 'T2', 'T3', 'T4'], hits: 1, ordered: true, opens: ['secret'] }],
  banks: [{ id: 'idols', ids: ['I1', 'I2', 'I3'], opens: ['door'] }],
  lights: [
    ...targetLights(['T1', 'T2', 'T3', 'T4'], 'L', '#3ddc84', { T1: 'T', T2: 'I', T3: 'K', T4: 'I' }),
    ...targetLights(['I1', 'I2', 'I3'], 'R', '#ffc23d'),
    { id: 'door', x: 23, y: 51, color: '#ffc23d', arrow: true, label: 'TEMPLE' },
    { id: 'secret', x: 43.2, y: 66, color: '#3ddc84', arrow: true },
    { id: 'trap', x: 12, y: 43.5, color: '#ff5c6c', label: 'PIÈGE' },
  ],
  missions: common(1.5e6, [
    { id: 'tiki', type: 'group', ref: 'tiki', name: 'T-I-K-I', desc: 'Touche les 4 totems dans l’ordre : le passage secret s’ouvre.', bonus: 60000 },
    { id: 'idols', type: 'bank', ref: 'idols', name: 'Idoles', desc: 'Renverse les 3 idoles : le temple s’ouvre.', bonus: 40000 },
    { id: 'secret', type: 'count', ref: 'secret', n: 1, name: 'Passage secret', desc: 'Emprunte le passage secret du couloir droit.', bonus: 70000 },
    { id: 'treasure', type: 'count', ref: 'treasure', n: 1, name: 'Trésor caché', desc: 'Touche le trésor qui surgit après le passage secret.', bonus: 120000 },
  ]),
});

const volcan = table({
  id: 'volcan',
  name: 'Volcan',
  tagline: 'Lave, rochers mobiles, jets de vapeur et bumpers surpuissants.',
  colors: { felt: '#1c0603', a: '#ff4d00', b: '#ffb300', c: '#ffe08a' },
  title: 'VOLCAN',
  unlock: { from: 'jungle', score: 100000 },
  walls: [
    ...pocket(null), ...rightMouth(),
    ...leftTargets(['V1', 'V2', 'V3', 'V4'], 'target'),
    ...rightTargets(['M1', 'M2', 'M3'], 'drop'),
  ],
  circles: [
    ...threeBumpers('lava', 340),
    { x: 23, y: 68, r: 1.9, kind: 'mover', id: 'rock1', e: 0.5, move: { ax: 8.5, freq: 0.22 }, look: 'rock' },
  ],
  fields: [
    { kind: 'jet', id: 'jet1', x: 12, y: 52, r: 3, force: [0, 12000], period: 3, duty: 0.3 },
    { kind: 'jet', id: 'jet2', x: 34, y: 49, r: 3, force: [0, 12000], period: 3, duty: 0.3, phase: 1.5 },
    { kind: 'repel', id: 'lava', x: 23, y: 44, r: 3.6, k: 900 },
  ],
  ramps: [{ id: 'left', name: 'Coulée', color: '#ff4d00' }, { id: 'right', name: 'Cheminée', color: '#ffb300' }],
  saucers: [{ x: 23, y: 62, r: 2.6, id: 'crater', role: 'lock', active: true }],
  groups: [{ id: 'lava', ids: ['V1', 'V2', 'V3', 'V4'], hits: 1 }],
  banks: [{ id: 'magma', ids: ['M1', 'M2', 'M3'] }],
  lights: [
    ...targetLights(['V1', 'V2', 'V3', 'V4'], 'L', '#ff4d00', { V1: 'L', V2: 'A', V3: 'V', V4: 'A' }),
    ...targetLights(['M1', 'M2', 'M3'], 'R', '#ffb300'),
    { id: 'lock', x: 23, y: 54.5, color: '#ff4d00', arrow: true, label: 'CRATÈRE' },
  ],
  missions: common(2e6, [
    { id: 'lavaword', type: 'group', ref: 'lava', name: 'L-A-V-A', desc: 'Touche les 4 cibles de lave.', bonus: 60000 },
    { id: 'magma', type: 'bank', ref: 'magma', name: 'Roches de magma', desc: 'Abats les 3 roches.', bonus: 40000 },
    { id: 'steam', type: 'count', ref: 'jet', n: 6, name: 'Propulsé', desc: 'Fais-toi propulser 6 fois par les jets de vapeur.', bonus: 70000 },
  ]),
});

export const TABLES = [arcade, space, casino, jungle, volcan];
export const tableById = id => TABLES.find(t => t.id === id);
