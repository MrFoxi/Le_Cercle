// Robot joueur du Mini-golf : il essaie une grille de tirs avec la vraie physique et garde celui qui finit le plus près
// du trou (distance « à pied » qui contourne les murs et l'eau). skill < 1 ajoute une erreur de visée.
const Golf = require('../public/golf/physics');

const CELL = 10, COLS = Golf.W / CELL, ROWS = Golf.H / CELL;
const maps = new Map(); // id du trou -> carte des distances jusqu'au trou

function distMap(hole) {
  if (maps.has(hole.id)) return maps.get(hole.id);
  const d = new Float32Array(COLS * ROWS).fill(Infinity), R = Golf.R + Golf.WALL;
  const segs = [];
  for (const w of hole.walls) { const p = Golf.wallPts(w); for (let k = 0; k + 3 < p.length; k += 2) segs.push(p.slice(k, k + 4)); }
  for (const d of hole.doors || []) segs.push(d.seg); // porte fermée : le robot fait le tour (s'il roule sur la dalle, tant mieux)
  const blocked = (x, y) => {
    for (const [ax, ay, bx, by] of segs) {
      const dx = bx - ax, dy = by - ay, u = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy)));
      if (Math.hypot(x - ax - dx * u, y - ay - dy * u) < R) return true;
    }
    if ((hole.bumpers || []).some(b => Math.hypot(x - b.x, y - b.y) < b.r + Golf.R)) return true;
    const wet = (hole.zones || []).some(z => z.t === 'water' && Golf.inZone(z, x, y));
    return wet && !(hole.bridges || []).some(b => Golf.inZone(b, x, y));
  };
  const idx = (c, r) => r * COLS + c, q = [];
  for (const [cx, cy] of hole.bonus ? [hole.cup, hole.bonus] : [hole.cup]) {
    const c0 = Math.floor(cx / CELL), r0 = Math.floor(cy / CELL);
    d[idx(c0, r0)] = 0; q.push([c0, r0]);
  }
  // Téléporteurs et tuyaux : l'entrée est à la distance de la sortie (calculée après un premier passage)
  const bfs = () => {
    while (q.length) {
      const [c, r] = q.shift();
      for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nc = c + dc, nr = r + dr;
        if (nc < 0 || nr < 0 || nc >= COLS || nr >= ROWS || d[idx(nc, nr)] <= d[idx(c, r)] + 1) continue;
        if (blocked(nc * CELL + 5, nr * CELL + 5)) continue;
        d[idx(nc, nr)] = d[idx(c, r)] + 1;
        q.push([nc, nr]);
      }
    }
  };
  bfs();
  for (const t of [...(hole.teleports || []), ...(hole.pipes || [])]) {
    const out = d[idx(Math.floor(t.to[0] / CELL), Math.floor(t.to[1] / CELL))], c = Math.floor(t.from[0] / CELL), r = Math.floor(t.from[1] / CELL);
    if (out + 2 < d[idx(c, r)]) { d[idx(c, r)] = out + 2; q.push([c, r]); }
  }
  bfs();
  const f = (x, y) => d[idx(Math.min(COLS - 1, Math.max(0, Math.floor(x / CELL))), Math.min(ROWS - 1, Math.max(0, Math.floor(y / CELL))))];
  maps.set(hole.id, f);
  return f;
}

// Meilleur tir trouvé ; s : { balls, shooter, t0, open, opts } comme pour Golf.simulate
function bestShot(hole, s, { angles = 60, powers = [0.12, 0.2, 0.3, 0.42, 0.55, 0.7, 0.85, 1], skill = 1, rng = Math.random } = {}) {
  const dist = distMap(hole);
  let best = null;
  for (let a = 0; a < angles; a++) for (const power of powers) {
    const angle = (a / angles) * Math.PI * 2;
    const sim = Golf.simulate(hole, { ...s, angle, power });
    const r = sim.results[s.shooter];
    const score = r.result === 'holed' ? (r.bonus ? -2000 : -1000) : r.result === 'water' ? 1e6 : dist(r.x, r.y);
    if (!best || score < best.score) best = { angle, power, score, sim };
  }
  const err = (1 - skill);
  return { angle: best.angle + (rng() - 0.5) * 0.12 * err, power: Math.min(1, Math.max(0.05, best.power * (1 + (rng() - 0.5) * 0.3 * err))), spin: 0, score: best.score };
}

module.exports = { bestShot, distMap };
