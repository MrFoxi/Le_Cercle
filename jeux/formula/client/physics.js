// Conduite arcade de Top Formula : modèle « bicyclette » avec adhérence limitée.
// La voiture tourne selon sa vitesse (jamais sur place comme un char) ; si le virage demande plus que l'adhérence,
// la vitesse latérale n'est plus effacée d'un coup : la voiture glisse, puis retrouve peu à peu le grip.
// Unités : mètres, secondes. Vitesse affichée = v × KMH.
import { locate, KERB } from './tracks.js';

export const KMH = 4.2;
// Conditions de la course (pluie : moins d'adhérence et de freinage).
export const env = { wet: false };
export const CAR = { len: 5, wid: 2, base: 3.2, accel: 19, vmax: 76, brake: 40, grip: 31, reverse: 9 };
const SURF = { asphalt: [1, 0], kerb: [0.92, 0], paved: [0.82, 0.15], grass: [0.5, 1.1], sand: [0.45, 2.2] }; // [adhérence, frein en plus]
const R = 1.15, AXLE = 1.45; // deux cercles par voiture pour les contacts

export function createCar(track, slot, extra = {}) {
  const c = {
    x: slot.x, y: slot.y, a: slot.a, vx: 0, vy: 0, steer: 0, i: slot.i, k: slot.i - track.N, along: 0, lat: 0,
    s: 0, damage: 0, slipstream: 0, drsAvail: false, drsOpen: false, drsZone: null, surface: 'asphalt', skid: 0, speed: 0,
    lap: 0, lapStart: 0, lapTimes: [], best: null, finished: null, events: [], rumble: 0, overtakes: 0, ...extra,
  };
  c.s = progress(track, c);
  return c;
}
const progress = (t, c) => c.k * t.ds + c.along;

// Braquage maximal : à toute vitesse, juste de quoi dépasser un peu l'adhérence (au clavier, un coup de volant à fond glisse à peine).
export const steerMax = v => Math.min(0.44, Math.atan(1.2 * CAR.grip * CAR.base / Math.max(1, v * v)));

// Un pas de simulation pour une voiture. input : { throttle, brake, steer (gauche +), handbrake, drs }
export function stepCar(car, input, t, dt, time) {
  const fx = Math.cos(car.a), fy = Math.sin(car.a);
  let vf = car.vx * fx + car.vy * fy;
  // Surface sous la voiture
  const absLat = Math.abs(car.lat), half = t.half;
  car.surface = absLat < half ? 'asphalt' : absLat < half + KERB ? 'kerb' : t.def.runoffKind ?? 'grass';
  const [gripMul, drag] = SURF[car.surface];
  // Vitesse de pointe : dégâts, aspiration, DRS
  const perf = car.perf ?? 1;
  const vmax = CAR.vmax * perf * (1 - car.damage * 0.0012) * (1 + car.slipstream * 0.06 + (car.drsOpen ? 0.075 : 0));
  let acc = 0;
  const thr = Math.max(0, Math.min(1, input.throttle || 0)), brk = Math.max(0, Math.min(1, input.brake || 0));
  if (thr && vf > -1) acc += CAR.accel * perf * thr * Math.max(0, 1 - (vf / vmax) ** 2) * (vf < 0 ? 1.5 : 1);
  if (brk) {
    if (vf > 0.5) acc -= CAR.brake * brk * (0.55 + 0.45 * gripMul) * (env.wet ? 0.85 : 1);
    else acc -= vf > -CAR.reverse ? 7 * brk : 0; // marche arrière
  }
  if (input.handbrake && vf > 0) acc -= 9;
  acc -= 9.81 * (t.slope?.[car.i] ?? 0) * (fx * t.tx[car.i] + fy * t.ty[car.i]); // ça freine en montée, ça pousse en descente
  acc -= vf * (0.012 + drag) + Math.sign(vf) * 0.25 * (!thr || vf < 0 ? 1 : 0);
  if (Math.abs(vf) > vmax * 1.02 && vf > 0) acc -= (vf - vmax) * 2; // au-delà de la vitesse de pointe (DRS refermé) : on ralentit doucement
  const vf2 = vf + acc * dt;
  vf = (!thr && Math.sign(vf2) !== Math.sign(vf) && !brk) ? 0 : vf2; // on ne repart pas en arrière tout seul
  const old = car.vx * fx + car.vy * fy;
  car.vx += (vf - old) * fx;
  car.vy += (vf - old) * fy;
  // DRS : s'ouvre à la demande dans la zone (si on y a droit), se referme au freinage.
  if (input.drs && car.drsAvail && car.drsZone && inZone(t, car.drsZone, car.i)) car.drsOpen = true;
  if (brk > 0.1 || !car.drsAvail) car.drsOpen = false;
  // Direction : volant progressif, angle de braquage réduit à haute vitesse.
  car.steer += ((input.steer || 0) - car.steer) * Math.min(1, dt * (Math.abs(input.steer || 0) > Math.abs(car.steer) ? 7 : 10));
  let yaw = vf * Math.tan(car.steer * steerMax(vf)) / CAR.base;
  if (input.handbrake) yaw *= 1.35;
  car.a -= yaw * dt;
  // Adhérence : on efface la vitesse latérale, dans la limite du grip (moins de grip en freinant fort, ou frein à main).
  const nfx = Math.cos(car.a), nfy = Math.sin(car.a), lx = nfy, ly = -nfx;
  let along = car.vx * nfx + car.vy * nfy, side = car.vx * lx + car.vy * ly;
  const grip = CAR.grip * Math.sqrt(perf) * gripMul * (env.wet ? 0.8 : 1) * (input.handbrake ? 0.5 : 1) * (1 - 0.3 * brk * (along > 15 ? 1 : 0)) * (1 - car.damage * 0.001);
  const corr = Math.max(-grip * dt, Math.min(grip * dt, side));
  side -= corr;
  if (!input.handbrake) side *= Math.exp(-dt * 2.5); // les pneus remordent vite après une glisse (sauf au frein à main)
  car.skid = Math.abs(side) + (brk > 0.8 && along > 25 ? 1.5 : 0);
  if (Math.abs(side) > 0.3) along -= Math.sign(along) * Math.min(Math.abs(along), Math.abs(side) * 1.3 * dt); // la glisse freine
  car.vx = nfx * along + lx * side;
  car.vy = nfy * along + ly * side;
  car.x += car.vx * dt;
  car.y += car.vy * dt;
  car.speed = along;
  locateCar(car, t);
  walls(car, t);
  laps(car, t, time);
  car.rumble = car.surface === 'kerb' && along > 8 ? 1 : 0;
}

function locateCar(car, t) {
  const loc = locate(t, car.x, car.y, car.i);
  let d = loc.i - car.i;
  if (d > t.N / 2) d -= t.N; else if (d < -t.N / 2) d += t.N;
  car.k += d; car.i = loc.i; car.along = loc.along; car.lat = loc.lat;
  car.s = progress(t, car);
}

// Murs : on teste les 4 coins de la voiture ; rebond amorti, frottement, la voiture se remet dans l'axe du mur.
function walls(car, t) {
  const i = car.i, nx = t.nx[i], ny = t.ny[i];
  const fx = Math.cos(car.a), fy = Math.sin(car.a), hl = CAR.len / 2, hw = CAR.wid / 2;
  let worstL = 0, worstR = 0;
  for (const [a, b] of [[hl, hw], [hl, -hw], [-hl, hw], [-hl, -hw]]) {
    const ox = fx * a + fy * b, oy = fy * a - fx * b;
    const lat = car.lat + ox * nx + oy * ny;
    worstL = Math.max(worstL, lat - t.wl[i]);
    worstR = Math.max(worstR, -lat - t.wr[i]);
  }
  for (const [pen, s] of [[worstL, 1], [worstR, -1]]) {
    if (pen <= 0) continue;
    car.x -= nx * pen * s; car.y -= ny * pen * s; car.lat -= pen * s;
    const vn = (car.vx * nx + car.vy * ny) * s; // vitesse vers le mur
    if (vn <= 0) continue;
    car.vx -= nx * s * vn * 1.3; car.vy -= ny * s * vn * 1.3;
    const loss = Math.max(0.55, 1 - vn * 0.03);
    car.vx *= loss; car.vy *= loss;
    // Remise dans l'axe : la voiture pivote un peu vers la tangente du mur.
    const ta = Math.atan2(t.ty[i], t.tx[i]);
    let d = ta - car.a; d = Math.atan2(Math.sin(d), Math.cos(d));
    if (Math.abs(d) < Math.PI / 2) car.a += d * Math.min(0.5, vn * 0.04);
    if (vn > 3) {
      car.damage = Math.min(100, car.damage + Math.max(0, vn - 7) * 1.4);
      car.events.push({ type: 'wall', power: vn, x: car.x + nx * s * CAR.wid * 0.5, y: car.y + ny * s * CAR.wid * 0.5 });
    }
  }
}

// Tour en cours : 0 avant la ligne de départ, puis 1, 2… Reculer sur la ligne ne compte jamais deux fois.
function laps(car, t, time) {
  if (car.finished != null || car.s < 0) return;
  const lap = Math.floor(car.s / t.length) + 1;
  if (lap <= car.lap) return;
  if (car.lap === 0 && car.flying) car.lapStart = time; // contre-la-montre : le chrono part sur la ligne
  if (car.lap >= 1) {
    const lt = time - car.lapStart;
    car.lapTimes.push(lt);
    if (car.best == null || lt < car.best) car.best = lt;
    car.lapStart = time;
    car.events.push({ type: 'lap', time: lt });
  }
  car.lap = lap;
}

// Contacts entre voitures : deux cercles par voiture, choc mou (les voitures « distantes » ne bougent pas).
export function collideCars(cars) {
  for (let i = 0; i < cars.length; i++) for (let j = i + 1; j < cars.length; j++) {
    const A = cars[i], B = cars[j];
    if (A.ghost || B.ghost || A.hidden || B.hidden || A.noclip > 0 || B.noclip > 0 || (A.remote && B.remote)) continue;
    if (Math.abs(A.x - B.x) > 8 || Math.abs(A.y - B.y) > 8) continue;
    let best = null;
    for (const sa of [AXLE, -AXLE]) for (const sb of [AXLE, -AXLE]) {
      const ax = A.x + Math.cos(A.a) * sa, ay = A.y + Math.sin(A.a) * sa, bx = B.x + Math.cos(B.a) * sb, by = B.y + Math.sin(B.a) * sb;
      const d = Math.hypot(bx - ax, by - ay);
      if (d < 2 * R && (!best || d < best.d)) best = { d, nx: (bx - ax) / (d || 1), ny: (by - ay) / (d || 1), x: (ax + bx) / 2, y: (ay + by) / 2 };
    }
    if (!best) continue;
    const pen = 2 * R - best.d, wa = A.remote ? 0 : B.remote ? 1 : 0.5, wb = 1 - wa;
    A.x -= best.nx * pen * wa; A.y -= best.ny * pen * wa;
    B.x += best.nx * pen * wb; B.y += best.ny * pen * wb;
    const rel = (B.vx - A.vx) * best.nx + (B.vy - A.vy) * best.ny;
    if (rel >= 0) continue;
    const j2 = -rel * 1.25; // un peu de rebond
    A.vx -= best.nx * j2 * wa; A.vy -= best.ny * j2 * wa;
    B.vx += best.nx * j2 * wb; B.vy += best.ny * j2 * wb;
    if (-rel > 2.5) for (const c of [A, B]) {
      c.damage = Math.min(100, c.damage + Math.max(0, -rel - 8) * 0.6);
      c.events.push({ type: 'car', power: -rel, x: best.x, y: best.y });
    }
  }
}

// Aspiration et DRS : derrière une voiture (moins de 35 m, dans son axe), la vitesse de pointe augmente.
// Le DRS s'ouvre dans les zones de ligne droite si l'on était à moins d'une seconde au point de détection.
export function aero(cars, t, open) {
  for (const A of cars) {
    if (A.ghost || A.remote) continue;
    const fx = Math.cos(A.a), fy = Math.sin(A.a);
    let slip = 0, gapAhead = Infinity;
    for (const B of cars) {
      if (B === A || B.ghost || B.hidden) continue;
      const dx = B.x - A.x, dy = B.y - A.y, along = dx * fx + dy * fy, side = Math.abs(dx * fy - dy * fx);
      if (along > 6 && along < 35 && side < 3) slip = Math.max(slip, 1 - (along - 6) / 29);
      const ds = B.s - A.s;
      if (ds > 0 && ds < gapAhead) gapAhead = ds;
    }
    A.slipstream += (slip - A.slipstream) * 0.1;
    A.gapAhead = gapAhead;
    // Au point de détection : moins d'une seconde derrière la voiture de devant (toujours en contre-la-montre).
    const z = t.drs.find(z => t.wrap(A.i - z.detect) < 4);
    if (z && A.drsZone !== z) { A.drsZone = z; A.drsAvail = open && (cars.length === 1 || gapAhead < Math.max(12, A.speed)); }
    if (A.drsZone && !inZone(t, { from: A.drsZone.detect, to: A.drsZone.to }, A.i)) { A.drsZone = null; A.drsAvail = A.drsOpen = false; }
  }
}
export const inZone = (t, z, i) => z.from <= z.to ? i >= z.from && i <= z.to : i >= z.from || i <= z.to;
