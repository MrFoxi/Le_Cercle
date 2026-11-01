// Les tables : géométrie (cm, x vers la droite, y vers le haut de la table), éléments, lumières, missions.
// Table de 52 × 110 cm ; aire de jeu de x = 0 à 46, couloir de lancement de 46 à 52.
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
const sling = (a, b, c, id) => [
  seg(a[0], a[1], b[0], b[1], { kind: 'rubber', e: 0.6 }),
  seg(b[0], b[1], c[0], c[1], { kind: 'rubber', e: 0.6 }),
  seg(c[0], c[1], a[0], a[1], { kind: 'sling', id, kick: 95, e: 0.7 }),
];

const arcade = {
  id: 'arcade',
  name: 'Arcade classique',
  tagline: 'Néons, bumpers et rampes chromées : la table pour apprendre.',
  colors: { felt: '#1b0f3a', a: '#ff2e88', b: '#22d3ee', c: '#ffd23f', wall: '#e8e8f0' },
  walls: [
    seg(52, 0, 52, 84, { kind: 'outer' }),
    ...arc(26, 84, 26, 0, Math.PI, 30, { kind: 'outer' }),
    seg(0, 84, 0, 28, { kind: 'outer' }),
    seg(0, 28, 13.6, 13.4, { kind: 'apron' }),
    seg(46, 28, 32.4, 13.4, { kind: 'apron' }),
    seg(46, 3, 46, 84, { kind: 'lane' }),
    seg(46, 2, 52, 2, { kind: 'plunger', e: 0.1 }),
    seg(46, 84.5, 46, 100, { kind: 'gate', oneWay: [-1, 0] }), // la bille sort du couloir mais n'y revient pas
    ...sling([4.5, 35], [4.5, 29.5], [10.5, 23], 'slingL'),
    ...sling([41.5, 35], [41.5, 29.5], [35.5, 23], 'slingR'),
    // Couloirs de passage du haut (1, 2, 3)
    ...[14, 20, 26, 32].map(x => seg(x, 94, x, 100, { kind: 'post' })),
    // Poche du trou de capture, fermée par la porte
    seg(20, 58, 20, 65, { kind: 'metal' }), seg(26, 58, 26, 65, { kind: 'metal' }), seg(20, 65, 26, 65, { kind: 'metal' }),
    seg(20, 58, 26, 58, { kind: 'door', id: 'door', e: 0.3 }),
    // Embouchures des rampes
    seg(8.6, 57, 8.6, 66, { kind: 'metal' }),
    seg(33, 57, 33, 64, { kind: 'metal' }), seg(40.5, 57, 40.5, 64, { kind: 'metal' }),
    // Cibles A, R, C (2 coups chacune) et cibles tombantes
    seg(0.6, 38, 0.6, 41, { kind: 'target', id: 'A', e: 0.35 }),
    seg(0.6, 42.5, 0.6, 45.5, { kind: 'target', id: 'R', e: 0.35 }),
    seg(0.6, 47, 0.6, 50, { kind: 'target', id: 'C', e: 0.35 }),
    seg(45.4, 44, 45.4, 47, { kind: 'drop', id: 'D1', e: 0.25 }),
    seg(45.4, 47.6, 45.4, 50.6, { kind: 'drop', id: 'D2', e: 0.25 }),
    seg(45.4, 51.2, 45.4, 54.2, { kind: 'drop', id: 'D3', e: 0.25 }),
  ],
  circles: [
    { x: 17, y: 84, r: 2.8, kind: 'bumper', id: 'B1', kick: 230, e: 0.7 },
    { x: 29, y: 84, r: 2.8, kind: 'bumper', id: 'B2', kick: 230, e: 0.7 },
    { x: 23, y: 75, r: 2.8, kind: 'bumper', id: 'B3', kick: 230, e: 0.7 },
  ],
  flippers: [
    { id: 'L', x: 14.8, y: 12, len: 7.2, r0: 1.1, r1: 0.55, rest: -0.55, up: 0.5 },
    { id: 'R', x: 31.2, y: 12, len: 7.2, r0: 1.1, r1: 0.55, rest: Math.PI + 0.55, up: Math.PI - 0.5 },
  ],
  triggers: [
    { ax: 14.3, ay: 97, bx: 19.7, by: 97, kind: 'rollover', id: 'L1' },
    { ax: 20.3, ay: 97, bx: 25.7, by: 97, kind: 'rollover', id: 'L2' },
    { ax: 26.3, ay: 97, bx: 31.7, by: 97, kind: 'rollover', id: 'L3' },
    { ax: 0.3, ay: 55, bx: 8.3, by: 55, kind: 'spinner', id: 'spinner' },
    { ax: 0.3, ay: 66, bx: 8.3, by: 66, kind: 'ramp', ramp: 'left', dir: [0, 1] },
    { ax: 33.3, ay: 64, bx: 40.2, by: 64, kind: 'ramp', ramp: 'right', dir: [0, 1] },
    { ax: 40.8, ay: 72, bx: 45.7, by: 72, kind: 'orbit', id: 'orbit', dir: [0, 1] },
  ],
  ramps: [
    { id: 'left', name: 'Rampe gauche', color: '#ff2e88', points: [[4.4, 66, 0], [4.3, 73, 1.5], [4.8, 84, 4.5], [8, 96, 7.5], [16, 104, 8.5], [27, 105, 8.5], [37, 101, 8], [43, 92, 7], [44.2, 78, 5], [44.2, 60, 2.2], [44.1, 46, 0.4], [44, 41, 0]] },
    { id: 'right', name: 'Rampe droite', color: '#22d3ee', points: [[36.7, 64, 0], [36.9, 71, 1.5], [38, 82, 4.5], [38.5, 93, 8], [33, 101.5, 10], [23, 102.5, 10], [13, 101.5, 10], [6, 95, 9], [2.6, 84, 7], [2.4, 66, 4], [2.3, 50, 1.2], [2.3, 44, 0.2], [2.3, 40.5, 0]] },
  ],
  saucers: [{ x: 23, y: 62, r: 2.6, id: 'saucer' }], // couvre toute la poche : une bille entrée est toujours capturée
  lane: { x0: 46, y1: 14, start: [49, 4], min: 300, max: 560 }, // même un lancer faible sort du couloir
  // Lumières décoratives et indicateurs (l'état vient des règles : allumée, éteinte, clignotante)
  lights: [
    { id: 'L1', x: 17, y: 98.5, color: '#ffd23f' }, { id: 'L2', x: 23, y: 98.5, color: '#ffd23f' }, { id: 'L3', x: 29, y: 98.5, color: '#ffd23f' },
    { id: 'A', x: 3, y: 39.5, color: '#ff2e88', label: 'A' }, { id: 'R', x: 3, y: 44, color: '#ff2e88', label: 'R' }, { id: 'C', x: 3, y: 48.5, color: '#ff2e88', label: 'C' },
    { id: 'D1', x: 42.6, y: 45.5, color: '#22d3ee' }, { id: 'D2', x: 42.6, y: 49.1, color: '#22d3ee' }, { id: 'D3', x: 42.6, y: 52.7, color: '#22d3ee' },
    { id: 'rampL', x: 4.4, y: 60.5, color: '#ff2e88', arrow: true }, { id: 'rampR', x: 36.7, y: 59, color: '#22d3ee', arrow: true },
    { id: 'door', x: 23, y: 54.5, color: '#ffd23f', arrow: true },
    { id: 'x2', x: 17, y: 30, color: '#ffd23f', label: '×2' }, { id: 'x3', x: 21, y: 30, color: '#ffd23f', label: '×3' },
    { id: 'x4', x: 25, y: 30, color: '#ffd23f', label: '×4' }, { id: 'x5', x: 29, y: 30, color: '#ffd23f', label: '×5' },
    { id: 'jackpot', x: 23, y: 44, color: '#ff8a00', label: 'JACKPOT', big: true },
    { id: 'save', x: 23, y: 8, color: '#5bff8f', label: 'SAVE' },
  ],
  missions: [
    { id: 'arc', name: 'A-R-C dans l’ordre', desc: 'Allume A, puis R, puis C (2 coups par cible).', bonus: 50000 },
    { id: 'ramps', name: 'Tour des rampes', desc: 'Réussis la rampe gauche et la rampe droite.', bonus: 75000 },
    { id: 'drops', name: 'Cibles tombantes', desc: 'Abats les 3 cibles : la porte du trou s’ouvre.', bonus: 40000 },
    { id: 'combo', name: 'Combo ×5', desc: 'Enchaîne 5 actions sans temps mort.', bonus: 60000 },
    { id: 'multiball', name: 'Multiball', desc: 'Capture 2 billes dans le trou derrière la porte.', bonus: 150000 },
    { id: 'million', name: 'Le million', desc: 'Atteins 1 000 000 de points.', bonus: 100000 },
    { id: 'super', name: 'Super Jackpot', desc: 'En multiball : 3 rampes, puis le trou.', bonus: 500000, final: true },
  ],
};

// Les autres univers, présentés dans le menu (à venir).
export const TABLES = [
  arcade,
  { id: 'space', name: 'Espace', tagline: 'Planètes, portails et trou noir.', soon: true },
  { id: 'casino', name: 'Casino', tagline: 'Roulette, machines à sous et jackpot.', soon: true },
  { id: 'jungle', name: 'Jungle', tagline: 'Temples, serpents et trésors cachés.', soon: true },
  { id: 'volcan', name: 'Volcan', tagline: 'Lave, vapeur et bumpers surpuissants.', soon: true },
];
export const tableById = id => TABLES.find(t => t.id === id && !t.soon);
