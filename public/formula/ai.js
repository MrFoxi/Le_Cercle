// Pilotes robots : ils suivent la trajectoire idéale, freinent avant les virages, prennent l'aspiration,
// tentent des dépassements, défendent leur place et font parfois une erreur (plus souvent quand ils sont débutants).
import { CAR, steerMax, env } from './physics.js';

export const LEVELS = [
// pace : part de l'allure maximale du circuit ; perf : petit avantage mécanique (moteur, adhérence) des meilleurs robots.
  { id: 'debutant', name: 'Débutant', pace: 0.74, mistake: 0.1, perf: 1 },
  { id: 'facile', name: 'Facile', pace: 0.86, mistake: 0.06, perf: 1 },
  { id: 'moyen', name: 'Moyen', pace: 0.95, mistake: 0.03, perf: 1 },
  { id: 'difficile', name: 'Difficile', pace: 0.985, mistake: 0.012, perf: 1.02 },
  { id: 'expert', name: 'Expert', pace: 1, mistake: 0.004, perf: 1.045 },
];

// Vitesse de passage à chaque point : limitée par l'adhérence dans les virages, puis par la distance de freinage.
const profiles = new Map();
export function speedProfile(t) {
  const key = t.def.id + (env.wet ? '|pluie' : '');
  if (profiles.has(key)) return profiles.get(key);
  const v = new Float32Array(t.N), G = CAR.grip * (env.wet ? 0.78 : 1), B = CAR.brake * (env.wet ? 0.78 : 0.92);
  for (let i = 0; i < t.N; i++) v[i] = Math.min(CAR.vmax, Math.sqrt(G / Math.max(1e-4, t.lineCurv[i])));
  for (let pass = 0; pass < 2; pass++) for (let i = t.N - 1; i >= 0; i--) v[i] = Math.min(v[i], Math.sqrt(v[(i + 1) % t.N] ** 2 + 2 * B * t.ds));
  profiles.set(key, v);
  return v;
}

export function createBrain(level, rng = Math.random) {
  return { pace: level.pace * (0.99 + rng() * 0.02), mistake: level.mistake, aggr: rng(), off: 0, mistakeUntil: -1, lastCorner: -1, rng, stuck: 0 };
}

export function drive(car, brain, t, cars, dt) {
  const prof = speedProfile(t), v = car.speed, N = t.N;
  // Erreur de pilotage : à l'entrée d'un virage, le robot arrive parfois trop vite.
  const ahead = t.wrap(car.i + Math.round((10 + v * 0.6) / t.ds));
  if (prof[ahead] < prof[car.i] - 6 && t.wrap(ahead - brain.lastCorner) > 60) {
    brain.lastCorner = ahead;
    if (brain.rng() < brain.mistake) brain.mistakeUntil = t.wrap(ahead + 40);
  }
  const erring = brain.mistakeUntil >= 0 && t.wrap(brain.mistakeUntil - car.i) < 80;
  if (!erring) brain.mistakeUntil = -1;
  // Circulation : doubler par le côté le plus libre, ou rester derrière en attendant.
  let want = 0, follow = Infinity;
  const fx = Math.cos(car.a), fy = Math.sin(car.a);
  for (const o of cars) {
    if (o === car || o.ghost) continue;
    let gap = o.s - car.s;
    if (gap < -8 || gap > 30) continue;
    const myLat = car.lat, side = o.lat - myLat;
    if (gap > 0 && Math.abs(side) < 2.8) {
      const room = o.lat > 0 ? -(t.half - 1.3) - o.lat : (t.half - 1.3) - o.lat; // place de l'autre côté
      want = o.lat + Math.sign(room || 1) * 3.4 - t.line[car.i];
      const safe = 6 + Math.max(0, v - o.speed) * 0.9; // distance pour freiner derrière lui
      if (gap < safe) follow = Math.min(follow, o.speed - (gap < 7 ? 2.5 : 0));
    } else if (gap > -8 && gap < 6 && Math.abs(side) < 3.2) {
      want = (myLat - o.lat > 0 ? 1 : -1) * 1.5; // côte à côte : on se laisse de la place
    }
  }
  // Défense : un rival juste derrière dans une ligne droite → on ferme la porte (une seule fois).
  if (!want && brain.aggr > 0.5) {
    const chaser = cars.find(o => o !== car && !o.ghost && car.s - o.s > 0 && car.s - o.s < 18);
    if (chaser && Math.abs(t.curv[car.i]) < 0.003) want = Math.max(-2, Math.min(2, chaser.lat - t.line[car.i])) * 0.6;
  }
  brain.off += (want - brain.off) * Math.min(1, dt * (want ? 1.6 : 0.6));
  // Direction : poursuite d'un point de la trajectoire devant soi.
  const look = 7 + Math.abs(v) * 0.32, j = t.wrap(car.i + Math.round(look / t.ds));
  const lat = Math.max(-(t.half - 1.2), Math.min(t.half - 1.2, t.line[j] + brain.off));
  const tx = t.x[j] + t.nx[j] * lat - car.x, ty = t.y[j] + t.ny[j] * lat - car.y;
  const dist = Math.hypot(tx, ty), sinA = (tx * fy - ty * fx) / dist; // > 0 : la cible est à gauche
  const curvature = 2 * sinA / dist;
  let steer = Math.atan(curvature * CAR.base) / steerMax(Math.max(3, v));
  steer = Math.max(-1, Math.min(1, steer * 1.1));
  // Vitesse : on vise le profil (un peu plus vite si on se trompe, moins vite derrière une voiture lente).
  const k = t.wrap(car.i + Math.round((2 + v * 0.12) / t.ds));
  let target = Math.min(prof[k], prof[t.wrap(k + 3)]) * (car.finished != null ? 0.7 : brain.pace * (t.def.aiPace ?? 1)) * (erring ? 1.12 : 1); // tour de décélération après l'arrivée
  if (follow < target) target = Math.max(follow, target * 0.8);
  if (car.surface === 'grass' || car.surface === 'sand') target = Math.min(target, 30);
  let throttle = 0, brake = 0;
  if (v < target - 0.5) throttle = Math.min(1, (target - v) / 3 + 0.4);
  else if (v > target + 1) brake = Math.min(1, (v - target) / 5);
  else throttle = 0.3;
  // Coincé contre un mur ou à l'envers : marche arrière quelques instants.
  const wrongWay = Math.cos(car.a - Math.atan2(t.ty[car.i], t.tx[car.i])) < -0.2;
  if (v < 2 && throttle > 0.5) brain.stuck += dt; else brain.stuck = Math.max(0, brain.stuck - dt * 0.5);
  if (brain.stuck > 1.2 || wrongWay && v < 5) { brain.stuck = brain.stuck > 2.4 ? 0 : brain.stuck; return { throttle: 0, brake: 1, steer: -steer, drs: false }; }
  return { throttle, brake, steer, handbrake: false, drs: car.drsAvail };
}
