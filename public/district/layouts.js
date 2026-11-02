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

export const LAYOUTS = { moderne };
export const LAYOUT = LAYOUTS[DISTRICT] || null;
