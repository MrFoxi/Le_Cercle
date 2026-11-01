// Physique du flipper, dans le plan de la table (x vers la droite, y vers le haut de la table, en cm).
// Pas de Three.js ici : testée seule par test-pinball.mjs. 600 sous-pas par seconde : à la vitesse
// maximale, la bille avance d'à peine 1 cm par sous-pas, moins que son rayon : elle ne traverse rien.
export const R = 1.35; // bille de 27 mm
export const G = 270; // gravité le long de la table inclinée (cm/s²)
const G_RAMP = 520; // gravité qui freine la bille quand elle monte une rampe
const FLIP_SPEED = 45; // vitesse de rotation des flippers (rad/s) : coup complet en ~25 ms, comme un vrai
const MAX_SPEED = 620;
export const STEP = 1 / 600;

// Courbe lisse (Catmull-Rom) échantillonnée à pas réguliers, avec la longueur cumulée.
export function sampleRamp(points, every = 0.6) {
  const out = [];
  const P = [points[0], ...points, points.at(-1)];
  for (let i = 1; i < P.length - 2; i++) {
    for (let k = 0; k < 16; k++) {
      const t = k / 16, t2 = t * t, t3 = t2 * t;
      const f = j => 0.5 * ((2 * P[i][j]) + (-P[i - 1][j] + P[i + 1][j]) * t + (2 * P[i - 1][j] - 5 * P[i][j] + 4 * P[i + 1][j] - P[i + 2][j]) * t2 + (-P[i - 1][j] + 3 * P[i][j] - 3 * P[i + 1][j] + P[i + 2][j]) * t3);
      out.push([f(0), f(1), f(2)]);
    }
  }
  out.push(points.at(-1));
  // Rééchantillonnage à distance constante (vitesse régulière sur la rampe)
  const pts = [{ x: out[0][0], y: out[0][1], z: out[0][2], s: 0 }];
  let s = 0;
  for (let i = 1; i < out.length; i++) {
    const a = out[i - 1], b = out[i];
    s += Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    if (s - pts.at(-1).s >= every || i === out.length - 1) pts.push({ x: b[0], y: b[1], z: b[2], s });
  }
  return pts;
}
function rampAt(r, s) {
  const p = r.pts;
  let i = 1;
  while (i < p.length - 1 && p[i].s < s) i++;
  const a = p[i - 1], b = p[i], t = Math.min(1, Math.max(0, (s - a.s) / (b.s - a.s || 1)));
  const ds = b.s - a.s || 1;
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t, dx: (b.x - a.x) / ds, dy: (b.y - a.y) / ds, dz: (b.z - a.z) / ds };
}

export function createWorld(table) {
  return {
    walls: table.walls.map(w => ({ e: 0.45, r: 0.3, active: true, ...w })),
    circles: table.circles.map(c => ({ e: 0.5, active: true, ...c })),
    flippers: table.flippers.map(f => ({ e: 0.5, ...f, angle: f.rest, omega: 0, pressed: false })),
    triggers: table.triggers.map(t => ({ active: true, ...t })),
    ramps: table.ramps.map(r => ({ ...r, pts: sampleRamp(r.points) })),
    saucers: table.saucers.map(s => ({ active: false, ...s })),
    lane: table.lane,
    balls: [],
    events: [],
    flippersDead: false,
    time: 0,
  };
}

let nextId = 1;
export function addBall(w, x, y, vx = 0, vy = 0) {
  const b = { id: nextId++, x, y, z: 0, vx, vy, ramp: null, held: false, still: 0 };
  w.balls.push(b);
  return b;
}
export const inLane = (w, b) => !b.ramp && !b.held && b.x > w.lane.x0 && b.y < w.lane.y1;

// Lance la bille posée sur le poussoir : power de 0 à 1.
export function launch(w, power) {
  const b = w.balls.find(x => inLane(w, x) && Math.hypot(x.vx, x.vy) < 30);
  if (!b) return false;
  b.vy = w.lane.min + (w.lane.max - w.lane.min) * Math.min(1, Math.max(0, power));
  b.vx = 0;
  w.events.push({ type: 'launch', ball: b, power });
  return true;
}

// Secousse de la table : petite impulsion sur toutes les billes en jeu.
export function nudge(w, dir, rng = Math.random) {
  for (const b of w.balls) {
    if (b.ramp || b.held || inLane(w, b)) continue;
    b.vx += dir * (18 + rng() * 14);
    b.vy += 22 + rng() * 10;
  }
}

export function releaseHeld(w, b, vx, vy) {
  b.held = false;
  b.escape = true;
  b.vx = vx;
  b.vy = vy;
}

/* ---------- Collisions ---------- */
function bounce(b, nx, ny, e, svx = 0, svy = 0) {
  const rvn = (b.vx - svx) * nx + (b.vy - svy) * ny;
  if (rvn >= 0) return 0;
  const j = -(1 + e) * rvn;
  b.vx += j * nx;
  b.vy += j * ny;
  // un peu de frottement le long de la surface
  const tx = -ny, ty = nx, vt = (b.vx - svx) * tx + (b.vy - svy) * ty;
  b.vx -= vt * 0.04 * tx;
  b.vy -= vt * 0.04 * ty;
  return -rvn;
}

function hitWall(w, b, s) {
  const dx = s.bx - s.ax, dy = s.by - s.ay;
  let t = ((b.x - s.ax) * dx + (b.y - s.ay) * dy) / (dx * dx + dy * dy);
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const qx = s.ax + t * dx, qy = s.ay + t * dy, rad = R + s.r;
  let nx = b.x - qx, ny = b.y - qy;
  const d2 = nx * nx + ny * ny;
  if (d2 >= rad * rad) return;
  // Porte à sens unique : seul le côté « oneWay » bloque la bille.
  if (s.oneWay && (b.x - s.ax) * s.oneWay[0] + (b.y - s.ay) * s.oneWay[1] < 0) return;
  const d = Math.sqrt(d2) || 1e-6;
  nx /= d; ny /= d;
  b.x = qx + nx * rad;
  b.y = qy + ny * rad;
  const speed = bounce(b, nx, ny, s.e);
  if (s.kick && speed > 6) { b.vx += nx * s.kick; b.vy += ny * s.kick; }
  if (speed > 6 || (s.kick && speed > 0)) w.events.push({ type: 'hit', obj: s, ball: b, speed, x: qx, y: qy });
}

function hitCircle(w, b, c) {
  let nx = b.x - c.x, ny = b.y - c.y;
  const rad = R + c.r, d2 = nx * nx + ny * ny;
  if (d2 >= rad * rad) return;
  const d = Math.sqrt(d2) || 1e-6;
  nx /= d; ny /= d;
  b.x = c.x + nx * rad;
  b.y = c.y + ny * rad;
  const speed = bounce(b, nx, ny, c.e);
  // Bumper : la bille repart toujours fort, même si elle l'a juste effleuré.
  if (c.kick) {
    const out = b.vx * nx + b.vy * ny;
    if (out < c.kick) { b.vx += nx * (c.kick - out); b.vy += ny * (c.kick - out); }
  }
  if (speed > 4 || c.kick) w.events.push({ type: 'hit', obj: c, ball: b, speed, x: c.x + nx * c.r, y: c.y + ny * c.r });
}

function hitFlipper(w, b, f) {
  const cx = Math.cos(f.angle), cy = Math.sin(f.angle);
  let t = ((b.x - f.x) * cx + (b.y - f.y) * cy) / f.len;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const qx = f.x + cx * f.len * t, qy = f.y + cy * f.len * t, rad = R + f.r0 + (f.r1 - f.r0) * t;
  let nx = b.x - qx, ny = b.y - qy;
  const d2 = nx * nx + ny * ny;
  if (d2 >= rad * rad) return;
  const d = Math.sqrt(d2) || 1e-6;
  nx /= d; ny /= d;
  b.x = qx + nx * rad;
  b.y = qy + ny * rad;
  // Vitesse de la surface du flipper au point de contact : c'est elle qui donne la puissance du tir.
  const px = b.x - f.x, py = b.y - f.y, svx = -f.omega * py, svy = f.omega * px;
  const speed = bounce(b, nx, ny, f.e, svx, svy);
  if (speed > 10) w.events.push({ type: 'hit', obj: f, ball: b, speed, x: qx, y: qy });
}

function hitBalls(w, a, b) {
  let nx = b.x - a.x, ny = b.y - a.y;
  const d2 = nx * nx + ny * ny;
  if (d2 >= 4 * R * R || d2 === 0) return;
  const d = Math.sqrt(d2);
  nx /= d; ny /= d;
  const push = (2 * R - d) / 2;
  a.x -= nx * push; a.y -= ny * push;
  b.x += nx * push; b.y += ny * push;
  const rv = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
  if (rv >= 0) return;
  const j = -rv * 0.95;
  a.vx -= j * nx; a.vy -= j * ny;
  b.vx += j * nx; b.vy += j * ny;
  if (-rv > 20) w.events.push({ type: 'clack', ball: a, speed: -rv, x: a.x + nx * R, y: a.y + ny * R });
}

// La trajectoire [p0, p1] coupe-t-elle la ligne du déclencheur ?
function crosses(x0, y0, x1, y1, t) {
  const d = (x1 - x0) * (t.by - t.ay) - (y1 - y0) * (t.bx - t.ax);
  if (!d) return false;
  const u = ((t.ax - x0) * (t.by - t.ay) - (t.ay - y0) * (t.bx - t.ax)) / d;
  const v = ((t.ax - x0) * (y1 - y0) - (t.ay - y0) * (x1 - x0)) / d;
  return u >= 0 && u <= 1 && v >= 0 && v <= 1;
}

/* ---------- Un sous-pas ---------- */
function substep(w, h) {
  for (const f of w.flippers) {
    const target = f.pressed && !w.flippersDead ? f.up : f.rest;
    const before = f.angle, dir = Math.sign(target - f.angle);
    f.angle += dir * Math.min(Math.abs(target - f.angle), FLIP_SPEED * h);
    f.omega = (f.angle - before) / h;
  }
  for (const b of w.balls) {
    if (b.held) continue;
    if (b.ramp) { rampStep(w, b, h); continue; }
    const x0 = b.x, y0 = b.y;
    b.vy -= G * h;
    b.vx *= 1 - 0.12 * h; // roulement
    b.vy *= 1 - 0.12 * h;
    const sp = Math.hypot(b.vx, b.vy);
    if (sp > MAX_SPEED) { b.vx *= MAX_SPEED / sp; b.vy *= MAX_SPEED / sp; }
    b.x += b.vx * h;
    b.y += b.vy * h;
    for (const s of w.walls) if (s.active) hitWall(w, b, s);
    for (const c of w.circles) if (c.active) hitCircle(w, b, c);
    for (const f of w.flippers) hitFlipper(w, b, f);
    for (const t of w.triggers) {
      if (!t.active || !crosses(x0, y0, b.x, b.y, t)) continue;
      const along = t.dir ? (b.x - x0) * t.dir[0] + (b.y - y0) * t.dir[1] : 1;
      if (t.kind === 'ramp') {
        if (along <= 0) continue; // on ne monte une rampe que dans le bon sens
        const r = w.ramps.find(x => x.id === t.ramp);
        b.ramp = { r, s: 0, v: Math.max(0, b.vx * t.dir[0] + b.vy * t.dir[1]) };
        w.events.push({ type: 'rampIn', ramp: r.id, ball: b });
        break;
      }
      w.events.push({ type: 'trigger', obj: t, ball: b, speed: Math.hypot(b.vx, b.vy), forward: along > 0 });
    }
    for (const s of w.saucers) {
      const d = Math.hypot(b.x - s.x, b.y - s.y);
      if (b.escape) { if (d > s.r + 1.5) b.escape = false; continue; } // bille éjectée : pas reprise avant d'être sortie
      if (!s.active || b.ramp || d > s.r) continue;
      b.held = true;
      b.x = s.x; b.y = s.y; b.vx = b.vy = 0;
      w.events.push({ type: 'saucer', obj: s, ball: b });
    }
  }
  const live = w.balls.filter(b => !b.ramp && !b.held);
  for (let i = 0; i < live.length; i++) for (let j = i + 1; j < live.length; j++) hitBalls(w, live[i], live[j]);
}

// Sur une rampe, la bille suit le rail : la pente la freine ; trop lente, elle redescend.
function rampStep(w, b, h) {
  const st = b.ramp, r = st.r;
  const p = rampAt(r, st.s);
  st.v += (-G * p.dy - G_RAMP * p.dz - st.v * 0.25) * h;
  st.s += st.v * h;
  const end = r.pts.at(-1).s;
  if (st.s <= 0) { // retombe par l'entrée
    const q = rampAt(r, 0);
    b.ramp = null;
    b.x = q.x; b.y = q.y - 0.4; b.z = 0;
    b.vx = q.dx * st.v; b.vy = q.dy * st.v;
    w.events.push({ type: 'rampFail', ramp: r.id, ball: b });
    return;
  }
  if (st.s >= end) { // sortie en bas du rail
    const q = rampAt(r, end - 0.01);
    b.ramp = null;
    b.x = q.x; b.y = q.y; b.z = 0;
    const v = Math.max(st.v, 60);
    b.vx = q.dx * v; b.vy = q.dy * v;
    w.events.push({ type: 'ramp', ramp: r.id, ball: b });
    return;
  }
  const q = rampAt(r, st.s);
  b.x = q.x; b.y = q.y; b.z = q.z;
  b.vx = q.dx * st.v; b.vy = q.dy * st.v;
}

// Avance la simulation de dt secondes (par sous-pas fixes). Les billes tombées entre les flippers sont retirées.
export function step(w, dt) {
  w.acc = (w.acc || 0) + Math.min(dt, 0.05);
  while (w.acc >= STEP) {
    substep(w, STEP);
    w.acc -= STEP;
    w.time += STEP;
  }
  for (const b of w.balls) {
    const sp = Math.hypot(b.vx, b.vy);
    b.still = !b.ramp && !b.held && !inLane(w, b) && sp < 4 ? b.still + dt : 0;
  }
  w.balls = w.balls.filter(b => {
    if (b.y > -3) return true;
    w.events.push({ type: 'drain', ball: b });
    return false;
  });
}

// Bille immobile trop longtemps : petite poussée pour la décoincer.
export function unstick(w, b, rng = Math.random) {
  b.vx += (rng() - 0.5) * 80;
  b.vy += 60 + rng() * 40;
  b.still = 0;
}
