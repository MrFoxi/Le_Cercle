// Mini-golf, mode Aventure : la physique de la balle en 3D (mètres, secondes). Partagée par le navigateur (window.TourPhys)
// et les tests (require). La balle subit la gravité, la traînée de l'air, l'effet Magnus (l'effet courbe la trajectoire),
// rebondit et roule sur des blocs orientés (OBB) dont chaque surface a son rebond, son adhérence et sa résistance.
// Le monde : blocs fixes, blocs qui bougent, blocs qui cassent, statues qui basculent, zones d'eau et de vent.
(function (root) {
  const G = 9.81, R = 0.3, DT = 1 / 240;
  const AIR = 0.0035, MAGNUS = 0.0042, SPIN_AIR = 0.3; // traînée, portance de l'effet, perte d'effet en vol (par seconde)
  // e : rebond, grip : adhérence (l'effet mord sur la surface), roll : résistance au roulement (en g)
  const SURF = {
    grass: { e: 0.3, grip: 0.6, roll: 0.22 }, moss: { e: 0.2, grip: 0.7, roll: 0.35 }, rock: { e: 0.5, grip: 0.4, roll: 0.07 },
    wood: { e: 0.4, grip: 0.45, roll: 0.09 }, sand: { e: 0.05, grip: 0.95, roll: 0.9 }, mud: { e: 0.04, grip: 0.9, roll: 0.7 },
    ice: { e: 0.3, grip: 0.03, roll: 0.012 }, snow: { e: 0.06, grip: 0.85, roll: 0.5 }, crystal: { e: 0.6, grip: 0.18, roll: 0.04 },
    shroom: { e: 0.95, grip: 0.3, roll: 0.15 }, gold: { e: 0.3, grip: 0.55, roll: 0.13 }, ash: { e: 0.08, grip: 0.9, roll: 0.55 }, cloud: { e: 0.15, grip: 0.7, roll: 0.3 },
  };
  // Les clubs : vitesse maximale (m/s), angle de levée par défaut et ses limites, effet rétro, force de l'effet latéral
  const CLUBS = {
    putter: { name: 'Putter', icon: '🏑', v: 9, loft: 2, min: 0, max: 6, back: 0, side: 10, desc: 'Roule au ras du sol, très précis.' },
    fer: { name: 'Fer 7', icon: '🏌️', v: 16, loft: 30, min: 18, max: 40, back: 45, side: 30, desc: 'Le club à tout faire : ni trop haut, ni trop loin.' },
    wedge: { name: 'Wedge', icon: '⛰️', v: 13.5, loft: 56, min: 46, max: 64, back: 95, side: 25, desc: 'Monte très haut et retombe presque sur place.' },
    driver: { name: 'Driver', icon: '🚀', v: 27, loft: 13, min: 8, max: 20, back: 28, side: 35, desc: 'Le plus long : traverse les gouffres.' },
    lob: { name: 'Grand Lob', icon: '🎈', v: 12.5, loft: 74, min: 66, max: 82, back: 150, side: 15, desc: 'Presque à la verticale : cheminées et puits.' },
    faucille: { name: 'Faucille', icon: '🌙', v: 17, loft: 20, min: 10, max: 32, back: 35, side: 140, desc: 'L’effet latéral est énorme : contourne les murs.' },
  };
  const ORDER = ['putter', 'fer', 'wedge', 'driver', 'lob', 'faucille'];

  /* ---------- Blocs ---------- */
  // Bloc : centre c, demi-tailles h, rotation (yaw autour de y, pitch autour de x, roll autour de z, en radians)
  function axes(yaw = 0, pitch = 0, roll = 0) {
    // R = Ry(yaw) · Rx(pitch) · Rz(roll) ; colonnes = axes locaux dans le monde
    const cy = Math.cos(yaw), sy = Math.sin(yaw), cx = Math.cos(pitch), sx = Math.sin(pitch), cz = Math.cos(roll), sz = Math.sin(roll);
    const m = [
      cy * cz + sy * sx * sz, -cy * sz + sy * sx * cz, sy * cx,
      cx * sz, cx * cz, -sx,
      -sy * cz + cy * sx * sz, sy * sz + cy * sx * cz, cy * cx,
    ];
    return [[m[0], m[3], m[6]], [m[1], m[4], m[7]], [m[2], m[5], m[8]]];
  }
  function prepare(b) {
    b.ax = axes(b.yaw, b.pitch, b.roll);
    // boîte englobante alignée (pour le tri rapide)
    const e = [0, 1, 2].map(i => Math.abs(b.ax[0][i]) * b.h[0] + Math.abs(b.ax[1][i]) * b.h[1] + Math.abs(b.ax[2][i]) * b.h[2]);
    b.lo = [b.c[0] - e[0], b.c[1] - e[1], b.c[2] - e[2]];
    b.hi = [b.c[0] + e[0], b.c[1] + e[1], b.c[2] + e[2]];
  }

  /* ---------- Le monde ---------- */
  const CELL = 6;
  function createWorld(level) {
    const w = { level, t: 0, blocks: level.blocks.map((b, i) => ({ ...b, i, c: [...b.c], c0: [...b.c] })), broken: new Set(), toppled: new Map(), triggered: new Set(), clubs: new Set(level.startClubs), shards: new Set(), grid: new Map(), moving: [], topples: [] };
    for (const b of w.blocks) { prepare(b); if (b.move) w.moving.push(b); if (b.topple) w.topples.push(b); }
    for (const b of w.blocks) if (!b.move && !b.topple) addToGrid(w, b);
    return w;
  }
  const key = (x, y, z) => `${x},${y},${z}`;
  function addToGrid(w, b) {
    for (let x = Math.floor(b.lo[0] / CELL); x <= Math.floor(b.hi[0] / CELL); x++)
      for (let y = Math.floor(b.lo[1] / CELL); y <= Math.floor(b.hi[1] / CELL); y++)
        for (let z = Math.floor(b.lo[2] / CELL); z <= Math.floor(b.hi[2] / CELL); z++) {
          const k = key(x, y, z); if (!w.grid.has(k)) w.grid.set(k, []); w.grid.get(k).push(b);
        }
  }
  // Blocs qui bougent : aller-retour le long d'un axe (sinusoïde), position et vitesse à l'instant t
  function moveBlocks(w) {
    for (const b of w.moving) {
      const m = b.move, ph = (2 * Math.PI * w.t) / m.period + (m.phase || 0), s = Math.sin(ph), ds = (Math.cos(ph) * 2 * Math.PI) / m.period;
      if (m.axis) { for (let i = 0; i < 3; i++) b.c[i] = b.c0[i] + m.axis[i] * m.amp * s; b.vel = m.axis.map(a => a * m.amp * ds); }
      if (m.tilt) b[m.tilt] = m.angle * s; // plateau qui tangue (pitch ou roll)
      prepare(b);
    }
    // Statues qui basculent : rotation autour d'un pivot, en 1,4 s une fois touchées
    for (const [b, k0] of w.toppled) {
      const k = Math.min(1, k0 + DT / 1.4), e = k * k * (3 - 2 * k), tp = b.topple;
      w.toppled.set(b, k);
      const a = tp.angle * e, ca = Math.cos(a), sa = Math.sin(a);
      // centre tourné autour du pivot (rotation autour de l'axe x ou z du monde)
      const d = [b.c0[0] - tp.pivot[0], b.c0[1] - tp.pivot[1], b.c0[2] - tp.pivot[2]];
      if (tp.axis === 'z') { b.c = [tp.pivot[0] + d[0] * ca - d[1] * sa, tp.pivot[1] + d[0] * sa + d[1] * ca, tp.pivot[2] + d[2]]; b.roll = a; }
      else { b.c = [tp.pivot[0] + d[0], tp.pivot[1] + d[1] * ca - d[2] * sa, tp.pivot[2] + d[1] * sa + d[2] * ca]; b.pitch = a; }
      prepare(b);
    }
  }
  function nearBlocks(w, p) {
    const k = key(Math.floor(p[0] / CELL), Math.floor(p[1] / CELL), Math.floor(p[2] / CELL));
    const list = w.grid.get(k) || [];
    return w.moving.length || w.topples.length ? [...list, ...w.moving, ...w.topples] : list; // ce qui bouge n'est pas dans la grille
  }
  const inBox = (z, p) => p[0] >= z.lo[0] && p[0] <= z.hi[0] && p[1] >= z.lo[1] && p[1] <= z.hi[1] && p[2] >= z.lo[2] && p[2] <= z.hi[2];

  /* ---------- La balle ---------- */
  function newBall(p) { return { p: [...p], v: [0, 0, 0], w: [0, 0, 0], rest: 0, ground: null, surf: null, air: 0 }; }
  // Frapper : direction (yaw, dans le plan horizontal), puissance 0..1, levée en degrés, point d'impact (ix, iy) dans le disque
  function launch(ball, clubId, yaw, power, loftDeg, ix = 0, iy = 0) {
    const c = CLUBS[clubId], sp = c.v * Math.max(0.02, Math.min(1, power));
    const loft = ((loftDeg + -iy * 6) * Math.PI) / 180, d = [Math.cos(yaw), 0, Math.sin(yaw)];
    ball.v = [d[0] * Math.cos(loft) * sp, Math.sin(loft) * sp, d[2] * Math.cos(loft) * sp];
    // effet rétro autour de l'axe (direction × haut) ; frappé bas = plus de rétro, frappé haut = effet lifté
    const back = (c.back * (0.5 + 0.5 * power) + -iy * 60) * (clubId === 'putter' ? 0.2 : 1), side = -ix * c.side * (0.4 + 0.6 * power);
    const bx = -d[2], bz = d[0]; // d × haut
    ball.w = [bx * back, side, bz * back];
    ball.rest = 0; ball.ground = null;
  }

  // Un pas de calcul. Renvoie la liste des évènements (rebond, casse, club trouvé, trou, chute fatale…).
  function step(w, ball) {
    const ev = [], p = ball.p, v = ball.v, om = ball.w;
    w.t += DT;
    if (ball.burnt) ball.burnt = Math.max(0, ball.burnt - DT);
    if (w.moving.length || w.toppled.size) moveBlocks(w);
    // Air : gravité, traînée, effet Magnus (seulement en vol), eau et vent
    let ax = 0, ay = -G, az = 0;
    const sp = Math.hypot(v[0], v[1], v[2]);
    let drag = AIR * sp;
    for (const z of w.level.zones) {
      if (!inBox(z, p)) continue;
      if (z.t === 'water') { drag += 2.6; ay += G * 0.55; }
      // la lave recrache la balle : elle repart vers le haut et en arrière (une punition, pas une défaite)
      if (z.t === 'lava' && !ball.burnt) { ball.burnt = 0.6; v[0] *= -0.45; v[2] *= -0.45; v[1] = 8.5; ev.push({ t: 'lava', p: [...p] }); }
      if (z.t === 'wind' && (!z.period || ((w.t + (z.phase || 0)) % z.period) < z.on)) { ax += z.f[0]; ay += z.f[1]; az += z.f[2]; }
    }
    ax -= drag * v[0]; ay -= drag * v[1]; az -= drag * v[2];
    if (!ball.ground) {
      ax += MAGNUS * (om[1] * v[2] - om[2] * v[1]); ay += MAGNUS * (om[2] * v[0] - om[0] * v[2]); az += MAGNUS * (om[0] * v[1] - om[1] * v[0]);
      const k = 1 - SPIN_AIR * DT; om[0] *= k; om[1] *= k; om[2] *= k;
    }
    v[0] += ax * DT; v[1] += ay * DT; v[2] += az * DT;
    p[0] += v[0] * DT; p[1] += v[1] * DT; p[2] += v[2] * DT;
    // Contacts
    ball.ground = null;
    let still = true;
    for (const b of nearBlocks(w, p)) {
      if (b.off || w.broken.has(b.i) || (b.hidden && !w.triggered.has(b.hidden))) continue;
      if (p[0] < b.lo[0] - R || p[0] > b.hi[0] + R || p[1] < b.lo[1] - R || p[1] > b.hi[1] + R || p[2] < b.lo[2] - R || p[2] > b.hi[2] + R) continue;
      const d = [p[0] - b.c[0], p[1] - b.c[1], p[2] - b.c[2]], A = b.ax;
      const l = [0, 1, 2].map(i => d[0] * A[i][0] + d[1] * A[i][1] + d[2] * A[i][2]);
      const q = l.map((x, i) => Math.max(-b.h[i], Math.min(b.h[i], x)));
      const cp = [0, 1, 2].map(j => b.c[j] + A[0][j] * q[0] + A[1][j] * q[1] + A[2][j] * q[2]);
      let n = [p[0] - cp[0], p[1] - cp[1], p[2] - cp[2]], dist = Math.hypot(n[0], n[1], n[2]), pen;
      // les dalles-déclencheurs réagissent dès qu'on les frôle (elles sont au ras du sol)
      if (b.trigger && dist < R + 0.08 && !w.triggered.has(b.trigger)) { w.triggered.add(b.trigger); ev.push({ t: 'trigger', id: b.trigger, p: [...p] }); }
      if (dist > 1e-9) { if (dist >= R) continue; n = n.map(x => x / dist); pen = R - dist; }
      else { // centre dans le bloc : on sort par la face la plus proche
        let best = 0, bd = Infinity;
        for (let i = 0; i < 3; i++) { const dd = b.h[i] - Math.abs(l[i]); if (dd < bd) { bd = dd; best = i; } }
        const s = l[best] >= 0 ? 1 : -1; n = A[best].map(x => x * s); pen = R + bd;
      }
      const vb = b.vel || [0, 0, 0], vr = [v[0] - vb[0], v[1] - vb[1], v[2] - vb[2]], vn = vr[0] * n[0] + vr[1] * n[1] + vr[2] * n[2];
      p[0] += n[0] * pen; p[1] += n[1] * pen; p[2] += n[2] * pen;
      if (b.breakAt && -vn > b.breakAt) { w.broken.add(b.i); ev.push({ t: 'break', b: b.i, p: [...p] }); v[0] *= 0.7; v[1] *= 0.7; v[2] *= 0.7; continue; }
      if (b.topple && !w.toppled.has(b) && -vn > b.topple.at) { w.toppled.set(b, 0); ev.push({ t: 'topple', b: b.i, p: [...p] }); }
      const s = SURF[b.s] || SURF.rock;
      if (n[1] > 0.45) { ball.ground = n; ball.surf = b.s; ball.base = b; }
      if (vn >= 0) continue;
      const impact = -vn, bounce = impact > 1.1;
      if (bounce && impact > 2) ev.push({ t: 'hit', s: b.s, f: Math.min(1, impact / 14), p: [...p] });
      const e = bounce ? s.e : 0;
      for (let i = 0; i < 3; i++) vr[i] -= n[i] * vn * (1 + e);
      // Frottement au point de contact : l'effet « mord » sur la surface (rebond) ou la balle se met à rouler
      const r = [-n[0] * R, -n[1] * R, -n[2] * R];
      const vrn = vr[0] * n[0] + vr[1] * n[1] + vr[2] * n[2];
      const u = [0, 1, 2].map(i => vr[i] - n[i] * vrn);
      u[0] += om[1] * r[2] - om[2] * r[1]; u[1] += om[2] * r[0] - om[0] * r[2]; u[2] += om[0] * r[1] - om[1] * r[0];
      const k = bounce ? s.grip : Math.min(1, s.grip * 30 * DT + 0.02);
      for (let i = 0; i < 3; i++) vr[i] -= (2 / 7) * k * u[i];
      const cx = n[1] * u[2] - n[2] * u[1], cy = n[2] * u[0] - n[0] * u[2], cz = n[0] * u[1] - n[1] * u[0], f = ((5 / 7) * k) / R;
      om[0] += f * cx; om[1] += f * cy; om[2] += f * cz;
      // Résistance au roulement (contact posé)
      if (!bounce) {
        const vrn2 = vr[0] * n[0] + vr[1] * n[1] + vr[2] * n[2], t = [0, 1, 2].map(i => vr[i] - n[i] * vrn2), ts = Math.hypot(t[0], t[1], t[2]), dec = s.roll * G * DT * Math.max(0.3, n[1]);
        if (ts <= dec) { for (let i = 0; i < 3; i++) vr[i] -= t[i]; om[0] *= 0.9; om[1] *= 0.9; om[2] *= 0.9; }
        else for (let i = 0; i < 3; i++) vr[i] -= (t[i] / ts) * dec;
      } else still = false;
      v[0] = vr[0] + vb[0]; v[1] = vr[1] + vb[1]; v[2] = vr[2] + vb[2];
    }
    // Repos : posée et presque immobile (par rapport à ce qui la porte) pendant un moment
    const vb = ball.base?.vel || [0, 0, 0], rel = Math.hypot(v[0] - vb[0], v[1] - vb[1], v[2] - vb[2]);
    ball.rest = ball.ground && still && rel < 0.15 ? ball.rest + DT : 0;
    ball.air = ball.ground ? 0 : ball.air + DT;
    // Clubs trouvés, trou, limite fatale
    for (const s of w.level.shards || []) if (!w.shards.has(s.id) && Math.hypot(p[0] - s.p[0], p[1] - s.p[1], p[2] - s.p[2]) < 1.4) { w.shards.add(s.id); ev.push({ t: 'shard', id: s.id, p: [...p] }); }
    for (const c of w.level.pickups) if (!w.clubs.has(c.club) && Math.hypot(p[0] - c.p[0], p[1] - c.p[1], p[2] - c.p[2]) < 1.6) { w.clubs.add(c.club); ev.push({ t: 'club', club: c.club, p: [...p] }); }
    const cup = w.level.cup;
    if (Math.hypot(p[0] - cup[0], p[2] - cup[2]) < 0.5 && p[1] < cup[1] + R + 0.25 && p[1] > cup[1] - 1 && sp < 7) ev.push({ t: 'holed' });
    if (p[1] < w.level.fatal) ev.push({ t: 'lost' });
    return ev;
  }
  const ready = ball => ball.rest > 0.45;

  // Simuler jusqu'au repos (ou trou, ou chute fatale) ; path : positions tous les k pas. Pour l'aperçu et les tests.
  function simulate(w, ball, { maxT = 30, every = 8, until } = {}) {
    const path = [], events = [];
    for (let i = 0; i < maxT / DT; i++) {
      const ev = step(w, ball);
      if (i % every === 0) path.push([...ball.p]);
      for (const e of ev) events.push(e);
      if (ev.some(e => e.t === 'holed' || e.t === 'lost')) return { path, events, end: ev.find(e => e.t === 'holed' || e.t === 'lost').t };
      if (until && until(ball, ev)) return { path, events, end: 'until' };
      if (i > 30 && ready(ball)) return { path, events, end: 'rest' };
    }
    return { path, events, end: 'time' };
  }
  // Copie du monde (pour l'aperçu de trajectoire : sans toucher au vrai)
  function clone(w) {
    const c = { ...w, blocks: w.blocks.map(b => ({ ...b, c: [...b.c], ax: b.ax })), broken: new Set(w.broken), toppled: new Map(), triggered: new Set(w.triggered), clubs: new Set(w.clubs), shards: new Set(w.shards), moving: [] };
    c.moving = c.blocks.filter(b => b.move); c.topples = c.blocks.filter(b => b.topple);
    for (const [b, k] of w.toppled) c.toppled.set(c.blocks[b.i], k);
    return c;
  }

  // Hauteur du premier sol sous un point (rayon vertical vers le bas), ou null s'il n'y a que le vide
  function groundBelow(w, p) {
    let best = null;
    const test = b => {
      if (b.off || w.broken.has(b.i) || (b.hidden && !w.triggered.has(b.hidden))) return;
      if (p[0] < b.lo[0] || p[0] > b.hi[0] || p[2] < b.lo[2] || p[2] > b.hi[2] || b.lo[1] > p[1]) return;
      // rayon y décroissant, dans le repère du bloc : intersection avec la boîte (méthode des plaques)
      const A = b.ax, o = [0, 1, 2].map(i => (p[0] - b.c[0]) * A[i][0] + (p[1] - b.c[1]) * A[i][1] + (p[2] - b.c[2]) * A[i][2]), d = [0, 1, 2].map(i => -A[i][1]);
      let t0 = 0, t1 = Infinity;
      for (let i = 0; i < 3; i++) {
        if (Math.abs(d[i]) < 1e-9) { if (Math.abs(o[i]) > b.h[i]) return; continue; }
        let a = (-b.h[i] - o[i]) / d[i], c = (b.h[i] - o[i]) / d[i];
        if (a > c) [a, c] = [c, a];
        t0 = Math.max(t0, a); t1 = Math.min(t1, c);
        if (t0 > t1) return;
      }
      const y = p[1] - t0;
      if (best === null || y > best) best = y;
    };
    for (let y = Math.floor(p[1] / CELL); y >= Math.floor(w.level.fatal / CELL); y--) {
      for (const b of w.grid.get(key(Math.floor(p[0] / CELL), y, Math.floor(p[2] / CELL))) || []) test(b);
      if (best !== null) break;
    }
    for (const b of [...w.moving, ...w.topples]) test(b);
    return best;
  }

  const api = { G, R, DT, SURF, CLUBS, ORDER, createWorld, newBall, launch, step, ready, simulate, clone, axes, groundBelow };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.TourPhys = api;
})(this);
