// Little District : plans propres à certains quartiers (le quartier japonais garde sa grille, définie dans sim.js).
// Données pures : parcelles, hauteurs du sol, chemins des habitants, points de vue. Aucun Three.js ici.
import { DISTRICT } from './theme.js';

const GY = 0.06;

// ---------- Quartier moderne : « Les Hauteurs » ----------
// Marina en bas (vers +z, côté caméra), puis trois terrasses de villas qui montent vers -z, reliées par une route en lacets.
// x ∈ [-16.5, 16.5], z ∈ [-21.5, 18]. Les rampes longent les bords : à droite, puis à gauche, puis à droite.
const T = [0, 1.8, 3.6, 5.4]; // hauteur de chaque terrasse
const BAND = [[3, 11], [-5, 3], [-13, -5], [-21.5, -13]]; // [zmin, zmax] de chaque terrasse
const ROAD = [8.5, 1.8, -6.2, -14.2]; // axe de la route sur chaque terrasse (largeur 2.4)
const RAMPS = [ // x, z bas, z haut, hauteur basse, hauteur haute
  { x: 15.5, z0: 7.3, z1: 3, y0: T[0], y1: T[1] },
  { x: -15.5, z0: 0.6, z1: -5, y0: T[1], y1: T[2] },
  { x: 15.5, z0: -7.4, z1: -13, y0: T[2], y1: T[3] },
];
const lerp = (a, b, t) => a + (b - a) * Math.min(1, Math.max(0, t));
function heightModerne(x, z) {
  for (const r of RAMPS) if (Math.abs(x - r.x) < 0.95 && z <= r.z0 && z >= r.z1 - 0.01) return lerp(r.y0, r.y1, (r.z0 - z) / (r.z0 - r.z1));
  if (z > 11) return -0.4; // la marina
  for (let k = 0; k < 4; k++) if (z >= BAND[k][0] && z <= BAND[k][1]) return T[k];
  return T[3];
}
const moderne = {
  bounds: { x0: -15, x1: 15, z0: -19, z1: 15 },
  view: { x: 0, z: -3, dist: 48 },
  height: heightModerne,
  T, BAND, ROAD, RAMPS, MARINA: { z0: 11, z1: 18, quay: 9.7 }, BOARD: { x: 16.5, z0: -21.5, z1: 18 },
  // kind : 'shop' (commerces du quai) ou 'villa' (logements) · size : multiplie le prix et les revenus
  plots: [
    ...[-9, -3, 3, 9].map(x => ({ x, z: 5.15, y: T[0], ry: 0, w: 4.3, depth: 4.2, sector: 0, kind: 'shop', size: 1 })),
    ...[-9.5, 0, 9.5].map(x => ({ x, z: -2.2, y: T[1], ry: 0, w: 8.4, depth: 5.4, sector: 1, kind: 'villa', size: 2.5 })),
    ...[-9.5, 0, 9.5].map(x => ({ x, z: -10.2, y: T[2], ry: 0, w: 8.4, depth: 5.4, sector: 2, kind: 'villa', size: 3.5 })),
    ...[-6.6, 6.6].map(x => ({ x, z: -18.2, y: T[3], ry: 0, w: 11.4, depth: 6, sector: 3, kind: 'villa', size: 5 })),
  ],
  start: 2, // le café du quai, au centre
  // Chemins : des lignes de points [x, z, hauteur du sol] reliées dans l'ordre (les points communs se rejoignent)
  paths: [
    [[-16.2, 8.2], [-12, 8.2], [-9, 8.2], [-6, 8.2], [-3, 8.2], [0, 8.2], [3, 8.2], [6, 8.2], [9, 8.2], [12, 8.2], [15.5, 8.2]], // route du quai
    [[-16.2, 10.4], [-9, 10.4], [-3, 10.4], [3, 10.4], [9, 10.4], [16.2, 10.4]], // promenade de la marina
    [[-9, 8.2], [-9, 10.4]], [[0, 8.2], [0, 10.4]], [[9, 8.2], [9, 10.4]],
    [[0, 10.4], [0, 12.4, 0.12], [0, 15.6, 0.12]], // ponton
    [[15.5, 8.2], [15.5, 7.3], [15.5, 3], [15.5, 1.8]], // première rampe
    [[15.5, 1.8], [9.5, 1.8], [4.5, 1.8], [0, 1.8], [-4.5, 1.8], [-9.5, 1.8], [-15.5, 1.8]], // terrasse 1
    [[-15.5, 1.8], [-15.5, 0.6], [-15.5, -5], [-15.5, -6.2]], // deuxième rampe
    [[-15.5, -6.2], [-9.5, -6.2], [-4.5, -6.2], [0, -6.2], [4.5, -6.2], [9.5, -6.2], [15.5, -6.2]], // terrasse 2
    [[15.5, -6.2], [15.5, -7.4], [15.5, -13], [15.5, -14.2]], // troisième rampe
    [[15.5, -14.2], [6.6, -14.2], [0, -14.2], [-6.6, -14.2], [-13.5, -14.2]], // le sommet, jusqu'au belvédère
  ],
  edges: [[-16.2, 8.2], [-16.2, 10.4], [16.2, 10.4]], // arrivées et départs des passants
  // Où l'on s'arrête pour regarder : [x, z, direction du regard]
  views: [[-13.5, -14.2, 0], [0, 15.6, 0], [-5, 10.6, 0], [6, 10.6, 0], [-12, 1.8, 0.4], [12, -6.2, -0.4]],
  pigeons: [[-5, 10.6], [6, 10.6], [-13.5, -14], [0, 1.6]],
  vendor: { z: 7.9, y: T[0] + GY }, // le glacier longe le quai
  // pas de déco sur la chaussée ni dans l'eau
  decorOK: (x, z) => Math.abs(x) < 16.2 && z > -21.3 && z < 10.9 && !ROAD.some(r => Math.abs(z - r) < 1.25 && Math.abs(x) < 16.4) && !RAMPS.some(r => Math.abs(x - r.x) < 1 && z <= r.z0 + 0.5 && z >= r.z1 - 0.5),
};

// ---------- Village côtier : « Le Front de mer » ----------
// Tout en longueur : la mer (vers +z, côté caméra) puis la plage, la promenade en planches, une rangée de maisons collées
// face à la mer, et le haut du village une marche plus haut. Le port à l'est, la falaise du phare à l'ouest.
const C = { up: 1.4, cliff: 3, row: -1, upRow: -9.3, prom: 3, upSt: -5.2, beach: [4.5, 9.5], stairs: [-20.3, 20.3], portX: 21.5, cliffX: -21.5, sea: -0.42 };
function heightCotier(x, z) {
  for (const sx of C.stairs) if (Math.abs(x - sx) < 0.9 && z <= 1.5 && z >= -4) return lerp(0, C.up, (1.5 - z) / 5.5);
  if (x < C.cliffX) return C.cliff;
  if (z > C.beach[1] || (x > C.portX && z > C.beach[0])) return C.sea; // la mer, et le bassin du port
  if (z > C.beach[0]) return lerp(0, -0.34, (z - C.beach[0]) / (C.beach[1] - C.beach[0]));
  return z < -4 ? C.up : 0;
}
const cotier = {
  bounds: { x0: -24, x1: 24, z0: -12, z1: 12 },
  view: { x: 0, z: 0, dist: 52 },
  height: heightCotier, C, BOARD: { x0: -27, x1: 27, z0: -14, z1: 16 },
  plots: [
    // la rangée face à la mer : 9 maisons collées (les 3 du centre d'abord)
    ...[-17.2, -12.9, -8.6, -4.3, 0, 4.3, 8.6, 12.9, 17.2].map(x => ({ x, z: C.row, y: 0, ry: 0, w: 4.3, depth: 5, sector: Math.abs(x) < 5 ? 0 : 1, size: 1 })),
    // le haut du village : maisons plus grandes, avec jardin
    ...[-16.5, -11, -5.5, 0, 5.5, 11, 16.5].map((x, k) => ({ x, z: C.upRow, y: C.up, ry: 0, w: 5.4, depth: 5, sector: k < 4 ? 2 : 3, size: 1.5 })),
  ],
  start: 4, // la crêperie, au centre du front de mer
  paths: [
    [[-21.2, 3], [-17.2, 3], [-12.9, 3], [-8.6, 3], [-4.3, 3], [0, 3], [4.3, 3], [8.6, 3], [12.9, 3], [17.2, 3], [20.3, 3], [24, 3], [26.2, 3]], // la promenade
    [[-8.6, 3], [-8.6, 7]], [[4.3, 3], [4.3, 7]], [[12.9, 3], [12.9, 7]], // descentes vers la plage
    [[24, 3], [24, 4.6, 0.12], [24, 9, 0.12], [24, 14.5, 0.12]], // la jetée du port
    [[-20.3, 3], [-20.3, 1.5], [-20.3, -4], [-20.3, -5.2]], [[20.3, 3], [20.3, 1.5], [20.3, -4], [20.3, -5.2]], // escaliers
    [[-21.2, -5.2], [-20.3, -5.2], [-16.5, -5.2], [-11, -5.2], [-5.5, -5.2], [0, -5.2], [5.5, -5.2], [11, -5.2], [16.5, -5.2], [20.3, -5.2]], // rue du haut
  ],
  edges: [[26.2, 3], [-21.2, 3], [-21.2, -5.2]],
  views: [[-8.6, 7, 0], [4.3, 7, 0], [12.9, 7, 0], [24, 14.5, 0], [-19, 3.6, 0], [0, -5.2, 0]],
  pigeons: [[-3, 6.5], [9, 7.5], [24, 8], [-14, 3.8]],
  vendor: { z: 3.6, y: 0.06 },
  lanterns: { x: [-18, 18], z: [-13, -11], y: 2 },
  decorOK: (x, z) => x > C.cliffX + 0.4 && x < 26.5 && z > -13.8 && z < C.beach[1] - 0.6 && !(x > C.portX && z > C.beach[0] - 0.2) && Math.abs(z - C.prom) > 0.7 && Math.abs(z - C.upSt) > 0.75 && !C.stairs.some(sx => Math.abs(x - sx) < 1.1 && z < 2 && z > -4.5),
};
// ---------- Vieille ville : « Intra-muros » (Mont-Saint-Michel) ----------
// Une île ronde entourée de grèves. Remparts au bord, puis une rue en anneau (niveau 0), un escalier à l'est vers la
// seconde rue en anneau (niveau 1), un escalier à l'ouest vers le sommet et l'abbaye : on monte en spirale.
// Les maisons sont entre les deux rues, tournées vers l'extérieur (vers leur rue).
const E = { y: [0.3, 2, 3.8], r: [16, 10.8, 5.5], street: [15, 9.8], houses: [12.4, 7.2], rampart: [16, 16.6], sand: -0.3, sea: -0.42, flats: 27, gateZ: 16.6, causeway: 30 };
const deg = a => (a * Math.PI) / 180;
function heightEurope(x, z) {
  const r = Math.hypot(x, z);
  if (Math.abs(z) < 0.9 && x > 0 && r >= 10.8 && r <= 14.2) return lerp(E.y[0], E.y[1], (14.2 - r) / 3.4); // escalier est
  if (Math.abs(z) < 0.9 && x < 0 && r >= 5.5 && r <= 9) return lerp(E.y[1], E.y[2], (9 - r) / 3.5); // escalier ouest
  if (Math.abs(x) < 1 && z >= E.r[0] && z <= E.causeway) return 0.25; // la chaussée
  if (r < E.r[2]) return E.y[2];
  if (r < E.r[1]) return E.y[1];
  if (r < E.rampart[1]) return E.y[0];
  return r < E.flats ? E.sand : E.sea;
}
const ring = (r, step, y) => { const pts = []; for (let a = 0; a <= 360; a += step) pts.push([+(r * Math.cos(deg(a))).toFixed(3), +(r * Math.sin(deg(a))).toFixed(3), y]); return pts; };
const at = (r, a) => [+(r * Math.cos(deg(a))).toFixed(3), +(r * Math.sin(deg(a))).toFixed(3)];
// face vers l'extérieur (vers sa rue) : le devant d'une parcelle regarde +z dans son repère
const outward = a => Math.atan2(Math.cos(deg(a)), Math.sin(deg(a)));
const europe = {
  bounds: { x0: -18, x1: 18, z0: -18, z1: 20 },
  view: { x: 0, z: 2, dist: 50 },
  height: heightEurope, E, BOARD: { flats: E.flats },
  plots: [
    ...[25, 50, 75, 100, 125, 150, 175, 200, 225, 250, 275, 300, 325].map(a => ({ x: at(E.houses[0], a)[0], z: at(E.houses[0], a)[1], y: E.y[0], ry: outward(a), w: 4.3, depth: 3, sector: a >= 50 && a <= 125 ? 0 : 1, size: 1 })),
    ...[30, 80, 130, 230, 280, 330].map(a => ({ x: at(E.houses[1], a)[0], z: at(E.houses[1], a)[1], y: E.y[1], ry: outward(a), w: 4.3, depth: 3, sector: a < 180 ? 2 : 3, size: 2 })),
  ],
  start: 3, // la crêperie, juste en face de la porte
  paths: [
    ring(E.street[0], 7.5), ring(E.street[1], 10),
    [at(E.street[0], 0), [14.2, 0], [10.8, 0], at(E.street[1], 0)], // escalier est
    [at(E.street[1], 180), [-9, 0], [-5.5, 0], [-4.95, 0], [-4.6, 2.6]], // escalier ouest, puis le parvis de l'abbaye
    [at(E.street[0], 90), [0, 16.6], [0, 19, 0.25], [0, 23, 0.25], [0, 29.5, 0.25]], // la porte et la chaussée
    [[-4.6, 2.6], [-1.5, 4.6], [2, 4.6]], // tour du parvis, vue sur la baie
  ],
  edges: [[0, 29.5]],
  views: [[2, 4.6, 0.3], [-1.5, 4.6, 0], [0, 23, Math.PI], [0, 19, Math.PI]],
  pigeons: [[1.5, 4.7], [0, 14.6], [-9.6, 2], [0, 21]],
  vendor: { z: 21.5, y: E.sand + 0.06 }, // le colporteur traverse les grèves à marée basse
  lanterns: { x: [-3, 3], z: [-3, 3], y: E.y[2] + 0.5 },
  decorOK: (x, z) => {
    const r = Math.hypot(x, z);
    if (r > E.flats - 0.5 || (r > 15.9 && r < 16.8) || Math.abs(r - E.street[0]) < 0.85 || Math.abs(r - E.street[1]) < 0.85) return false;
    if (Math.abs(z) < 1.1 && ((x > 0 && r > 10.5 && r < 14.5) || (x < 0 && r > 5.2 && r < 9.3))) return false; // escaliers
    if (Math.abs(x) < 1.3 && z > 15.5) return false; // porte et chaussée
    return !(Math.abs(x) < 4.9 && Math.abs(z) < 2.8); // l'abbaye
  },
};

// ---------- Néo-cité : « La Ville verticale » ----------
// Pas de sol : des plateformes flottantes au-dessus du vide, reliées par des passerelles lumineuses en pente.
// La place centrale (commerces), deux tours géantes à l'est et à l'ouest, deux autres au nord, l'arrivée au sud.
const F = {
  pads: [ // cx, cz, rayon, hauteur
    { id: 'hub', x: 0, z: 0, r: 7.5, y: 2 }, { id: 'est', x: 20, z: 0, r: 6.5, y: 4 }, { id: 'ouest', x: -20, z: 0, r: 6.5, y: 5.5 },
    { id: 'nord', x: 0, z: -22, r: 7.5, y: 6 }, { id: 'sud', x: 0, z: 18, r: 6.5, y: 0.8 }, { id: 'se', x: 14, z: 22, r: 4, y: 2 }, { id: 'so', x: -14, z: 22, r: 4, y: 0 },
  ],
  void: -30,
};
const padEdge = (a, b) => { const A = F.pads.find(p => p.id === a), B = F.pads.find(p => p.id === b), d = Math.hypot(B.x - A.x, B.z - A.z), ux = (B.x - A.x) / d, uz = (B.z - A.z) / d; return [A.x + ux * A.r, A.z + uz * A.r, A.y, B.x - ux * B.r, B.z - uz * B.r, B.y]; };
F.walks = [padEdge('hub', 'est'), padEdge('hub', 'ouest'), padEdge('hub', 'nord'), padEdge('hub', 'sud'), padEdge('sud', 'se'), padEdge('sud', 'so')].map(w => w.map(v => +v.toFixed(3)));
function heightFutur(x, z) {
  for (const p of F.pads) if (Math.hypot(x - p.x, z - p.z) <= p.r + 0.01) return p.y;
  for (const [ax, az, ay, bx, bz, by] of F.walks) {
    const dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz, t = ((x - ax) * dx + (z - az) * dz) / L2;
    if (t >= -0.01 && t <= 1.01 && Math.abs((x - ax) * dz - (z - az) * dx) / Math.sqrt(L2) < 0.95) return lerp(ay, by, t);
  }
  return F.void;
}
const inward = a => Math.atan2(-Math.cos(deg(a)), -Math.sin(deg(a)));
const futur = {
  bounds: { x0: -24, x1: 24, z0: -26, z1: 24 },
  view: { x: 0, z: -1, dist: 58 },
  height: heightFutur, F, BOARD: {},
  plots: [
    ...[45, 135, 225, 315].map(a => ({ x: +(4.6 * Math.cos(deg(a))).toFixed(3), z: +(4.6 * Math.sin(deg(a))).toFixed(3), y: 2, ry: inward(a), w: 4.3, depth: 3.6, sector: 0, size: 1 })),
    { x: 3.1, z: 19.5, y: 0.8, ry: Math.PI, w: 4.3, depth: 3.6, sector: 1, size: 1.5 }, { x: -3.1, z: 19.5, y: 0.8, ry: Math.PI, w: 4.3, depth: 3.6, sector: 1, size: 1.5 },
    { x: 14.5, z: 22, y: 2, ry: -Math.PI / 2, w: 4.3, depth: 3.6, sector: 1, size: 1.5 }, { x: -14.5, z: 22, y: 0, ry: Math.PI / 2, w: 4.3, depth: 3.6, sector: 1, size: 1.5 },
    { x: 21, z: 0, y: 4, ry: -Math.PI / 2, w: 6, depth: 6, sector: 2, size: 4 }, { x: -21, z: 0, y: 5.5, ry: Math.PI / 2, w: 6, depth: 6, sector: 2, size: 4.5 },
    { x: -3.3, z: -23, y: 6, ry: 0, w: 5.6, depth: 5.6, sector: 3, size: 6 }, { x: 3.3, z: -23, y: 6, ry: 0, w: 5.6, depth: 5.6, sector: 3, size: 6 },
  ],
  start: 0,
  paths: [
    ring(2.4, 15),
    [[2.4, 0], [7.5, 0], [13.5, 0], [17.5, 0]], // vers la tour est
    [[-2.4, 0], [-7.5, 0], [-13.5, 0], [-17.5, 0]], // vers la tour ouest
    [[0, -2.4], [0, -7.5], [0, -14.5], [0, -19.6], [-3.3, -19.7]], [[0, -19.6], [3.3, -19.7]], [[0, -14.5], [-4, -17], [-6.4, -20]], // le nord et son belvédère
    [[0, 2.4], [0, 7.5], [0, 11.5], [0, 15.2], [3.1, 17.2]], [[0, 15.2], [-3.1, 17.2]], [[0, 15.2], [0, 24]], // l'arrivée au sud
    [[0, 15.2], F.walks[4].slice(0, 2), F.walks[4].slice(3, 5), [12.4, 22]], [[0, 15.2], F.walks[5].slice(0, 2), F.walks[5].slice(3, 5), [-12.4, 22]],
    [[7.5, 0], [8.5, 0]], [[17.5, 0], [17.6, 4.5], [24.6, 4], [25.6, 1.2]], // tour du pad est jusqu'à son bord
  ],
  edges: [[0, 24]],
  views: [[25.6, 1.2, -Math.PI / 2], [-6.4, -20, 2.4], [0, 24, 0], [0, 7.5, 0]],
  pigeons: [[1.2, 1.5], [0, 22], [-5, -16]],
  vendor: { z: 0.6, y: 2.5 }, // le robot livreur traverse en volant
  lanterns: { x: [-5, 5], z: [-27, -19], y: 6.5 },
  lanes: [ // couloirs des voitures volantes : cercles autour du centre (rayon, altitude, vitesse en rad/s)
    { r: 11, y: 4, v: 0.22 }, { r: 14.5, y: 8.5, v: -0.16 }, { r: 27, y: 1.5, v: 0.1 }, { r: 19, y: 12, v: 0.13 }, { r: 33, y: 6, v: -0.08 },
  ],
  decorOK: (x, z) => {
    if (!F.pads.some(p => Math.hypot(x - p.x, z - p.z) < p.r - 0.4)) return false;
    if (Math.hypot(x, z) < 3 || (Math.abs(z) < 0.9 && Math.abs(x) > 2) || (Math.abs(x) < 0.9 && Math.abs(z) > 2)) return false; // la place et les allées
    return true;
  },
};

moderne.lanterns = { x: [-9, 9], z: [BAND[3][0] + 1, BAND[3][1] - 1], y: T[3] + 0.5 };

export const LAYOUTS = { moderne, cotier, europe, futur };
export const LAYOUT = LAYOUTS[DISTRICT] || null;
