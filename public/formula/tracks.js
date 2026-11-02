// Circuits de Top Formula. Chaque circuit est un polygone dont les coins sont arrondis (rayon donné, en mètres) :
// on obtient des virages au rayon exact, faciles à régler. Le tracé est ensuite échantillonné tous les DS mètres.
export const DS = 2;
export const KERB = 1.4; // largeur des vibreurs

// [x, y, rayon] : y vers le bas de l'écran. Le départ est sur le segment qui va du dernier coin au premier.
export const TRACKS = [
  {
    id: 'riviera', name: 'Riviera', laps: 3, theme: 'city', width: 12, runoff: 1.2, escape: 2, runoffKind: 'paved', water: 'south',
    desc: 'Circuit urbain en bord de mer : murs tout proches, épingle serrée, aucune erreur permise.',
    corners: [
      [150, 0, 18], [160, -150, 70], [80, -250, 40], [-20, -255, 22], [-40, -200, 14], [-120, -200, 17],
      [-130, -300, 26], [-260, -310, 30], [-330, -250, 24], [-330, -150, 12], [-300, -130, 12], [-300, -60, 10], [-330, -40, 10], [-330, 0, 16],
    ],
  },
  {
    id: 'lago', name: 'Autodromo del Lago', laps: 3, theme: 'park', width: 14, runoff: 9, escape: 14, runoffKind: 'grass', water: 'lake',
    desc: 'Le temple de la vitesse : longues lignes droites, aspiration, DRS et freinages à la limite.',
    corners: [
      [260, 0, 12], [276, 12, 12], [300, 12, 12], [316, 0, 30], [470, -170, 160], [400, -420, 110], [120, -460, 12],
      [104, -446, 12], [80, -446, 12], [64, -460, 12], [-160, -460, 60], [-200, -340, 50], [-320, -320, 60], [-500, -340, 70], [-480, 0, 90],
    ],
  },
  {
    id: 'marina', name: 'Marina by Night', laps: 3, theme: 'night', width: 13, runoff: 4, escape: 6, runoffKind: 'paved', water: 'south',
    desc: 'Grand prix de nuit sous les projecteurs : virages à angle droit, chicanes et longue ligne droite.',
    corners: [
      [200, 0, 14], [200, -120, 14], [300, -120, 16], [330, -260, 40], [200, -330, 12], [120, -330, 12], [120, -250, 10],
      [40, -250, 10], [40, -380, 20], [-200, -380, 24], [-200, -240, 12], [-180, -220, 10], [-200, -200, 10], [-200, 0, 24],
    ],
  },
];
export const trackById = id => TRACKS.find(t => t.id === id) ?? TRACKS[0];

// Polygone aux coins arrondis -> polyligne fine.
function filleted(corners) {
  const n = corners.length, out = [];
  for (let i = 0; i < n; i++) {
    const [px, py] = corners[(i + n - 1) % n], [vx, vy, r] = corners[i], [qx, qy] = corners[(i + 1) % n];
    let ax = vx - px, ay = vy - py, bx = qx - vx, by = qy - vy;
    const la = Math.hypot(ax, ay), lb = Math.hypot(bx, by);
    ax /= la; ay /= la; bx /= lb; by /= lb;
    const cross = ax * by - ay * bx, theta = Math.acos(Math.max(-1, Math.min(1, ax * bx + ay * by)));
    const t = r * Math.tan(theta / 2);
    if (t > la / 2 + 1e-6 || t > lb / 2 + 1e-6) throw new Error(`Coin ${i} trop arrondi (${t.toFixed(1)} m pour des côtés de ${la.toFixed(0)} et ${lb.toFixed(0)} m)`);
    const sx = vx - ax * t, sy = vy - ay * t, s = Math.sign(cross) || 1;
    const cx = sx - ay * r * s, cy = sy + ax * r * s; // centre du virage, du côté où l'on tourne
    const a0 = Math.atan2(sy - cy, sx - cx), steps = Math.max(2, Math.ceil(theta * r / 0.5));
    for (let k = 0; k <= steps; k++) {
      const a = a0 + s * theta * k / steps;
      out.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
    }
  }
  return out;
}

const cache = new Map();
// Tracé échantillonné : centre, tangente, normale (vers la gauche du pilote), courbure, murs, trajectoire idéale.
export function buildTrack(def) {
  if (cache.has(def.id)) return cache.get(def.id);
  const poly = filleted(def.corners);
  // Le départ (indice 0) est au milieu de la ligne droite entre le dernier coin et le premier.
  const [lx, ly] = def.corners.at(-1), [fx, fy] = def.corners[0];
  const start = [(lx + fx) / 2 + (fx - lx) * 0.1, (ly + fy) / 2 + (fy - ly) * 0.1];
  const pts = poly;
  // Ré-échantillonnage à pas constant
  const cum = [0];
  for (let i = 1; i <= pts.length; i++) { const a = pts[i - 1], b = pts[i % pts.length]; cum.push(cum[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1])); }
  const length = cum.at(-1), N = Math.round(length / DS), ds = length / N;
  let x = new Float32Array(N), y = new Float32Array(N);
  for (let i = 0, j = 0; i < N; i++) {
    const s = i * ds;
    while (cum[j + 1] < s) j++;
    const a = pts[j], b = pts[(j + 1) % pts.length], f = (s - cum[j]) / (cum[j + 1] - cum[j] || 1);
    x[i] = a[0] + (b[0] - a[0]) * f; y[i] = a[1] + (b[1] - a[1]) * f;
  }
  // On fait commencer le tracé (indice 0) à la ligne de départ.
  let best = 0, bd = Infinity;
  for (let i = 0; i < N; i++) { const d = Math.hypot(x[i] - start[0], y[i] - start[1]); if (d < bd) { bd = d; best = i; } }
  const rot = a => Float32Array.from(a, (v, i) => a[(i + best) % N]);
  [x, y] = [rot(x), rot(y)];
  const wrap = i => ((i % N) + N) % N;
  const tx = new Float32Array(N), ty = new Float32Array(N), nx = new Float32Array(N), ny = new Float32Array(N), curv = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const a = wrap(i - 1), b = wrap(i + 1), dx = x[b] - x[a], dy = y[b] - y[a], l = Math.hypot(dx, dy);
    tx[i] = dx / l; ty[i] = dy / l; nx[i] = ty[i]; ny[i] = -tx[i]; // gauche du pilote (y vers le bas)
  }
  for (let i = 0; i < N; i++) {
    const a = wrap(i - 2), b = wrap(i + 2);
    let d = Math.atan2(ty[b], tx[b]) - Math.atan2(ty[a], tx[a]);
    d = Math.atan2(Math.sin(d), Math.cos(d));
    curv[i] = -d / (4 * ds); // > 0 : virage à gauche
  }
  const smooth = (arr, w) => { const o = new Float32Array(N); for (let i = 0; i < N; i++) { let s = 0; for (let k = -w; k <= w; k++) s += arr[wrap(i + k)]; o[i] = s / (2 * w + 1); } return o; };
  const curvS = smooth(curv, 8);
  // Murs : tout près en ligne droite, dégagement plus large à l'extérieur des virages, jamais plus loin que le rayon à l'intérieur.
  const half = def.width / 2, base = half + KERB + def.runoff;
  const wl = new Float32Array(N), wr = new Float32Array(N), kerb = new Uint8Array(N);
  const bend = smooth(curvS.map(c => Math.min(1, Math.abs(c) * 60)), 20);
  for (let i = 0; i < N; i++) {
    const c = curvS[i], out = def.escape * bend[i], radius = Math.abs(c) > 1e-4 ? 1 / Math.abs(c) : 1e9;
    wl[i] = c > 0 ? Math.min(base, radius * 0.8) : base + out;
    wr[i] = c < 0 ? Math.min(base, radius * 0.8) : base + out;
    kerb[i] = Math.abs(curvS[i]) > 0.006 ? 1 : 0;
  }
  // Murs lissés (sans à-coups), puis on garde la limite intérieure des virages serrés.
  const wl2 = smooth(wl, 8), wr2 = smooth(wr, 8);
  for (let i = 0; i < N; i++) {
    const radius = Math.abs(curvS[i]) > 1e-4 ? 1 / Math.abs(curvS[i]) : 1e9;
    wl[i] = Math.max(half + KERB + 0.6, curvS[i] > 0 ? Math.min(wl2[i], radius * 0.8) : wl2[i]);
    wr[i] = Math.max(half + KERB + 0.6, curvS[i] < 0 ? Math.min(wr2[i], radius * 0.8) : wr2[i]);
  }
  // Les vibreurs débordent un peu avant et après les virages.
  const k2 = kerb.slice(); for (let i = 0; i < N; i++) if (kerb[i]) for (let k = -6; k <= 6; k++) k2[wrap(i + k)] = 1;
  // Trajectoire idéale : on tend une corde entre les bords de la piste (courbure minimale).
  const line = new Float32Array(N), lim = half - 2;
  for (let it = 0; it < 500; it++) {
    for (let i = 0; i < N; i++) {
      const a = wrap(i - 7), b = wrap(i + 7);
      const mx = (x[a] + nx[a] * line[a] + x[b] + nx[b] * line[b]) / 2, my = (y[a] + ny[a] * line[a] + y[b] + ny[b] * line[b]) / 2;
      const o = line[i] + ((mx - x[i] - nx[i] * line[i]) * nx[i] + (my - y[i] - ny[i] * line[i]) * ny[i]) * 0.6;
      line[i] = Math.max(-lim, Math.min(lim, o));
    }
  }
  // Courbure le long de la trajectoire idéale, pour la vitesse de passage des robots.
  const lx2 = Float32Array.from(x, (v, i) => v + nx[i] * line[i]), ly2 = Float32Array.from(y, (v, i) => v + ny[i] * line[i]);
  const lineCurv = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const a = wrap(i - 4), b = wrap(i + 4);
    const ax = x[i] + nx[i] * line[i] - lx2[a], ay = y[i] + ny[i] * line[i] - ly2[a], bx = lx2[b] - x[i] - nx[i] * line[i], by = ly2[b] - y[i] - ny[i] * line[i];
    const d = Math.atan2(ax * by - ay * bx, ax * bx + ay * by);
    lineCurv[i] = Math.abs(d) / (Math.hypot(ax, ay) / 2 + Math.hypot(bx, by) / 2);
  }
  // Zones DRS : les lignes droites de plus de 220 m.
  const drs = [], straight = i => Math.abs(curvS[i]) < 0.0025;
  let i0 = 0; while (straight(i0)) i0++; // on part d'un virage
  for (let k = 0, run = 0, from = 0; k <= N; k++) {
    const i = wrap(i0 + k);
    if (k < N && straight(i)) { if (!run) from = i; run++; continue; }
    if (run * ds > 220) drs.push({ detect: wrap(from - Math.round(60 / ds)), from: wrap(from + 10), to: wrap(from + run - Math.round(50 / ds)) });
    run = 0;
  }
  const t = { def, N, ds, length, x, y, tx, ty, nx, ny, curv: curvS, wl, wr, kerb: k2, line, lineCurv: smooth(lineCurv, 3), drs, half, wrap };
  cache.set(def.id, t);
  return t;
}

// Point le plus proche du tracé, en cherchant autour de l'indice précédent (les voitures ne sautent pas de 50 m).
export function locate(t, px, py, hint) {
  let best = hint, bd = Infinity;
  for (let k = -12; k <= 16; k++) {
    const i = t.wrap(hint + k), d = (px - t.x[i]) ** 2 + (py - t.y[i]) ** 2;
    if (d < bd) { bd = d; best = i; }
  }
  const along = (px - t.x[best]) * t.tx[best] + (py - t.y[best]) * t.ty[best];
  const lat = (px - t.x[best]) * t.nx[best] + (py - t.y[best]) * t.ny[best];
  return { i: best, along, lat };
}
// Recherche sur tout le tracé (au départ, ou après une téléportation).
export function locateAll(t, px, py) {
  let best = 0, bd = Infinity;
  for (let i = 0; i < t.N; i++) { const d = (px - t.x[i]) ** 2 + (py - t.y[i]) ** 2; if (d < bd) { bd = d; best = i; } }
  return locate(t, px, py, best);
}

// Places sur la grille de départ : en quinconce, derrière la ligne.
export function gridSlot(t, k) {
  const back = 14 + k * 9, i = t.wrap(-Math.round(back / t.ds)), side = k % 2 ? -1 : 1;
  const lat = side * t.half * 0.42;
  return { x: t.x[i] + t.nx[i] * lat, y: t.y[i] + t.ny[i] * lat, a: Math.atan2(t.ty[i], t.tx[i]), i };
}
