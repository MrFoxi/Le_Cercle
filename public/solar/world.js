// Le système solaire de Solar Explorer : astres en orbite, lunes, station, astéroïdes, Kuiper, comètes, ciel,
// ombres, événements en direct (météorites, comète de passage), et les collisions avec tout ça.
// Toutes les positions dépendent d'une heure commune (envoyée par le serveur) : chaque pilote voit les astres au même endroit.
import * as THREE from 'three';
import * as TX from './textures.js';
import { shadowed, inShadow } from './shadows.js';

export const KM = 20; // 1 unité = 20 km affichés
export const EPOCH = Date.UTC(2026, 0, 1); // origine des orbites
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const TAU = Math.PI * 2;
const Y = V(0, 1, 0);
// Périodes (en secondes de jeu) : la Terre fait le tour du Soleil en 2 h, les autres suivent la 3e loi de Kepler.
const YEAR = 7200;
const period = d => YEAR * (d / 21000) ** 1.5;
const moonPeriod = d => 600 * (d / 1000) ** 1.5;

// kind : star | planet | dwarf | moon | station | zone | comet
export const BODIES = [];
const add = b => (BODIES.push({ pos: V(0, 0, 0), ...b }), BODIES.at(-1));
export const byId = id => BODIES.find(b => b.id === id);
add({ id: 'soleil', name: 'Soleil', kind: 'star', r: 2600, color: '#ffb340', desc: 'Notre étoile. Son éclat baisse à mesure qu’on s’en éloigne. Gare à la chaleur si on la frôle !' });
const P = (id, name, d, a0, r, color, desc, extra = {}) => add({ id, name, kind: 'planet', r, color, desc, orbit: { d, a0, T: period(d) }, ...extra });
P('mercure', 'Mercure', 9000, 2.5, 140, '#a29d96', 'Petite planète rocheuse criblée de cratères, brûlée par le Soleil tout proche.');
P('venus', 'Vénus', 14500, 1.1, 300, '#e8c27a', 'Une atmosphère épaisse de nuages jaunes : la planète la plus lumineuse du ciel.');
P('terre', 'Terre', 21000, 0, 330, '#3c8fd9', 'Océans, continents et nuages : la maison. La station Horizon est en orbite juste à côté.');
P('mars', 'Mars', 29000, 0.5, 260, '#d0603a', 'La planète rouge : déserts, cratères, volcans et calottes glacées. Descends au ras du sol !', { amp: 0.05 });
P('jupiter', 'Jupiter', 56000, 0.95, 1500, '#d9a877', 'La géante : bandes de nuages et Grande Tache rouge. Quatre grandes lunes.');
P('saturne', 'Saturne', 76000, 1.75, 1250, '#e5cf98', 'Ses anneaux de glace et de roche se traversent… en évitant les blocs !', { ringIn: 1650, ringOut: 3100, tilt: 0.47 });
P('uranus', 'Uranus', 94000, 2.6, 700, '#9fe0ea', 'Géante de glace bleu pâle, couchée sur le côté.', { tilt: 1.7 });
P('neptune', 'Neptune', 110000, 3.4, 680, '#3f6fe0', 'Aux confins sombres du système : la planète des vents les plus violents.');
add({ id: 'pluton', name: 'Pluton', kind: 'dwarf', r: 120, color: '#d9c3a5', desc: 'Planète naine au cœur de glace, perdue dans la ceinture de Kuiper.', orbit: { d: 150000, a0: 4.3, T: period(150000) } });
const M = (id, name, parent, d, a0, y, r, color, desc, extra = {}) => add({ id, name, kind: 'moon', parent, r, color, desc, orbit: { d, a0, y, T: moonPeriod(d) }, ...extra });
M('lune', 'Lune', 'terre', 1750, 4.4, 160, 130, '#bdbdbd', 'Le satellite de la Terre : mers sombres et cratères. Descends au ras du sol !', { amp: 0.05 });
M('phobos', 'Phobos', 'mars', 700, 0.4, 40, 18, '#8c7b6b', 'Petite lune de Mars, en forme de patate.');
M('deimos', 'Deimos', 'mars', 1150, 2.5, -60, 12, '#9c8a78', 'La plus petite lune de Mars.');
M('io', 'Io', 'jupiter', 2600, 0.1, 80, 70, '#e6d36a', 'Lune volcanique de Jupiter, soufrée et jaune.');
M('europe', 'Europe', 'jupiter', 3300, 1.9, -60, 60, '#d9cdb8', 'Lune glacée de Jupiter, striée de fissures.');
M('ganymede', 'Ganymède', 'jupiter', 4400, 3.6, 120, 100, '#9b8f84', 'La plus grande lune du système solaire.');
M('callisto', 'Callisto', 'jupiter', 5600, 5.1, -150, 90, '#6f6458', 'Lune sombre, la plus cratérisée de toutes.');
M('titan', 'Titan', 'saturne', 5800, 2.7, 300, 105, '#d8a64e', 'Grande lune de Saturne, enveloppée d’une brume orange.');
M('triton', 'Triton', 'neptune', 1400, 5.4, 100, 60, '#c9c3c0', 'Lune glacée de Neptune, aux geysers d’azote.');
M('charon', 'Charon', 'pluton', 650, 1, 30, 60, '#a9a19a', 'La grande lune de Pluton, presque sa jumelle.');
export const STATION = add({ id: 'horizon', name: 'Station Horizon', kind: 'station', r: 100, parent: 'terre', off: V(950, 90, 700), color: '#7cf3ff', desc: 'Point de départ et lieu de rendez-vous des pilotes, en orbite autour de la Terre. Ta coque s’y répare et le hangar y est ouvert.' });
export const BELT = { inner: 35500, outer: 41500, half: 700, T: period(38500) };
export const KUIPER_RING = { inner: 135000, outer: 165000, half: 3000, T: period(150000) };
export const KEPLER = add({ id: 'kepler', name: 'Champ de Kepler', kind: 'zone', r: 2200, color: '#c7b39a', desc: 'L’amas le plus dense de la ceinture d’astéroïdes : faufile-toi entre les rochers.', orbit: { d: 38500, a0: 0.3, T: BELT.T } });
add({ id: 'kuiper', name: 'Ceinture de Kuiper', kind: 'zone', ring: KUIPER_RING, r: 15000, color: '#9fb3c8', desc: 'Au-delà de Neptune : un immense anneau de blocs de glace, très sombre.', orbit: { d: 150000, a0: 2.2, T: KUIPER_RING.T } });
// Comète de Halley : orbite très allongée, elle passe près du Soleil puis repart vers les confins.
add({ id: 'halley', name: 'Comète de Halley', kind: 'comet', r: 25, color: '#bfefff', desc: 'Sa queue s’allonge près du Soleil et pointe toujours à l’opposé de lui. Rattrape-la !', ellipse: { a: 68000, e: 0.765, i: 0.35, w: 2.0, m0: 2.6, T: period(68000) } });
// Comète de passage (événement en direct) : cachée le reste du temps.
add({ id: 'visiteuse', name: 'Comète visiteuse', kind: 'comet', r: 30, color: '#d8b8ff', desc: 'Une comète venue d’ailleurs, qui ne fait que passer. Approche-la avant qu’elle ne reparte !', hidden: true });
const STATION_TILT = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.25, 0, 0.12));
export const shown = b => !b.hidden;

/* ---------- Orbites ---------- */
const tmp = V(0, 0, 0);
function ellipsePos(o, t, out) {
  const M0 = o.m0 + (TAU * t) / o.T;
  let E = M0;
  for (let k = 0; k < 6; k++) E -= (E - o.e * Math.sin(E) - M0) / (1 - o.e * Math.cos(E));
  out.set(o.a * (Math.cos(E) - o.e), 0, o.a * Math.sqrt(1 - o.e * o.e) * Math.sin(E));
  return out.applyAxisAngle(Y, o.w).applyAxisAngle(V(1, 0, 0), o.i);
}
let event = null; // événement en direct venu du serveur
// Place chaque astre à l'heure t (secondes depuis EPOCH).
export function orbits(t) {
  for (const b of BODIES) {
    const o = b.orbit;
    if (b.ellipse) ellipsePos(b.ellipse, t, b.pos);
    else if (b.off) b.pos.copy(byId(b.parent).pos).add(b.off);
    else if (o) {
      const a = o.a0 + (TAU * t) / o.T;
      b.pos.set(Math.cos(a) * o.d, o.y ?? 0, Math.sin(a) * o.d);
      if (b.parent) b.pos.add(byId(b.parent).pos);
    }
  }
  const v = byId('visiteuse'), ev = event;
  v.hidden = !(ev?.type === 'comet' && ev.phase === 'active');
  if (!v.hidden) {
    // Trajet en ligne droite qui frôle l'astre visé au milieu de l'événement
    const rand = TX.rng(ev.seed), mid = ((ev.start + ev.end) / 2 - EPOCH) / 1000, target = byId(ev.target) ?? byId('terre');
    const dir = V(rand() - 0.5, (rand() - 0.5) * 0.3, rand() - 0.5).normalize(), side = V(0, 1, 0).cross(dir).normalize();
    v.pos.copy(target.pos).addScaledVector(side, (target.ringOut ?? target.r) * 3 + 1500).addScaledVector(dir, (t - mid) * 450);
  }
}
export const setEvent = ev => (event = ev);

/* ---------- Distances, zones, collisions (sans rendu) ---------- */
const ringDist = (p, R) => { const rr = Math.hypot(p.x, p.z); return Math.max(R.inner - rr, rr - R.outer, Math.abs(p.y) - R.half); };

// Distance à la surface la plus proche : règle la vitesse de croisière (rapide dans le vide, précise près des astres).
export function nearest(p) {
  let best = Infinity, body = null;
  for (const b of BODIES) {
    if (!shown(b) || b.ring) continue;
    const reach = b.ringOut ?? (b.kind === 'station' ? 150 : b.kind === 'comet' ? 300 : b.r);
    const d = p.distanceTo(b.pos) - reach;
    if (d < best) { best = d; body = b; }
  }
  const belt = ringDist(p, BELT), kuiper = ringDist(p, KUIPER_RING);
  return { dist: Math.min(best, Math.max(belt, 0) + 1200, Math.max(kuiper, 0) + 2500), body, inBelt: belt < 0, inKuiper: kuiper < 0 };
}

// Astre qui « entraîne » le vaisseau : tout près d'une planète on suit son orbite, sans dériver.
export function hostOf(p) {
  let best = null, reach = Infinity;
  for (const b of BODIES) {
    if (!shown(b) || b.kind === 'star' || b.ring) continue;
    const r = b.kind === 'moon' ? b.r * 8 : b.kind === 'zone' ? b.r : b.kind === 'comet' ? 600 : b.kind === 'station' ? 400 : (b.ringOut ?? b.r) * 6;
    if (r < reach && p.distanceTo(b.pos) < r) { best = b; reach = r; }
  }
  return best;
}

export function zoneName(p) {
  if (p.distanceTo(STATION.pos) < 260) return 'Station Horizon';
  if (p.distanceTo(KEPLER.pos) < KEPLER.r) return 'Champ d’astéroïdes de Kepler';
  for (const b of BODIES) if (shown(b) && b.kind === 'comet' && p.distanceTo(b.pos) < 3000) return `Sillage de la ${b.name.toLowerCase()}`;
  for (const b of BODIES) if (b.kind === 'moon' && p.distanceTo(b.pos) < b.r * 8) return `Près de ${b.name}`;
  for (const b of BODIES) if (['planet', 'star', 'dwarf'].includes(b.kind) && p.distanceTo(b.pos) < (b.ringOut ?? b.r) * 5) return b.kind === 'star' ? 'Couronne solaire' : `Orbite de ${b.name}`;
  const n = nearest(p);
  if (n.inBelt) return 'Ceinture d’astéroïdes';
  if (n.inKuiper) return 'Ceinture de Kuiper';
  return Math.hypot(p.x, p.z) > 120000 ? 'Confins du système' : Math.hypot(p.x, p.z) > 60000 ? 'Système solaire externe' : 'Espace interplanétaire';
}

// Ce qu'on peut découvrir pour le journal, et à quelle distance on « l'a vu de près ».
export const PLACES = BODIES.filter(b => b.id !== 'visiteuse');
export function visited(b, p) {
  if (!shown(b)) return false;
  if (b.ring) return ringDist(p, b.ring) < 0;
  const d = p.distanceTo(b.pos);
  return d < ({ star: b.r * 2.2, planet: (b.ringOut ?? b.r) * 3, dwarf: b.r * 5, moon: b.r * 5, station: 600, zone: b.r, comet: 900 }[b.kind]);
}

// Un astre plus proche cache-t-il ce point vu depuis l'œil ? (pour masquer les noms derrière une planète)
const seg = V(0, 0, 0), toC = V(0, 0, 0);
export function hiddenFrom(eye, target, except) {
  const d = seg.subVectors(target, eye).length();
  seg.multiplyScalar(1 / d);
  for (const b of BODIES) {
    if (b === except || !['star', 'planet', 'dwarf', 'moon'].includes(b.kind)) continue;
    toC.subVectors(b.pos, eye);
    const t = toC.dot(seg);
    if (t > 0 && t < d - b.r && toC.addScaledVector(seg, -t).length() < b.r) return true;
  }
  return false;
}

// Abri contre la tempête solaire : une planète, une lune ou la station cache-t-elle le Soleil ?
export const blocksSun = p => inShadow(p, BODIES.filter(b => ['planet', 'dwarf', 'moon', 'station'].includes(b.kind)));

const n = V(0, 0, 0);
// Repousse un point (et sa vitesse) hors d'une sphère ; renvoie la vitesse d'impact.
function pushOut(p, v, c, min) {
  n.subVectors(p, c);
  const d2 = n.lengthSq();
  if (d2 >= min * min || d2 === 0) return 0;
  n.multiplyScalar(1 / Math.sqrt(d2));
  p.copy(c).addScaledVector(n, min);
  const vn = v.dot(n);
  if (vn >= 0) return 0;
  v.addScaledVector(n, -vn * 1.5); // rebond amorti
  return -vn;
}

// Relief réel (Lune, Mars) : rayon du sol sous le point p, dans le repère tournant de l'astre.
const terrains = new Map(); // id -> { mesh, height, amp }
const wq = new THREE.Quaternion(), ld = V(0, 0, 0);
export function groundRadius(b, p) {
  const t = terrains.get(b.id);
  if (!t) return b.r;
  t.mesh.getWorldQuaternion(wq);
  ld.subVectors(p, b.pos).normalize().applyQuaternion(wq.invert());
  // repère de SphereGeometry -> repère des textures (voir textures.js)
  const phi = Math.atan2(ld.z, -ld.x), lat = Math.asin(THREE.MathUtils.clamp(ld.y, -1, 1));
  return b.r * (1 + t.amp * (t.height(Math.cos(lat) * Math.cos(phi), Math.sin(lat), Math.cos(lat) * Math.sin(phi)) - 0.5));
}

const rockSets = []; // { arr: x,y,z,rayon dans le repère de obj, obj }
const lp = V(0, 0, 0), lv = V(0, 0, 0), c2 = V(0, 0, 0), segC = V(0, 0, 0), local = V(0, 0, 0), inv = STATION_TILT.clone().invert();
const im = new THREE.Matrix4(), oq = new THREE.Quaternion(), oqi = new THREE.Quaternion();
export function collide(p, v, rad) {
  let impact = 0;
  for (const b of BODIES) {
    if (!shown(b) || ['station', 'zone'].includes(b.kind)) continue;
    const r = b.amp && p.distanceTo(b.pos) < b.r * 1.2 ? groundRadius(b, p) : b.r;
    impact = Math.max(impact, pushOut(p, v, b.pos, r + rad));
  }
  for (const s of rockSets) {
    lp.copy(p).applyMatrix4(im.copy(s.obj.matrixWorld).invert());
    s.obj.getWorldQuaternion(oq);
    lv.copy(v).applyQuaternion(oqi.copy(oq).invert());
    let hit = 0;
    for (let i = 0; i < s.arr.length; i += 4) {
      const dx = lp.x - s.arr[i], dy = lp.y - s.arr[i + 1], dz = lp.z - s.arr[i + 2], m = s.arr[i + 3] + rad;
      if (dx * dx + dy * dy + dz * dz < m * m) hit = Math.max(hit, pushOut(lp, lv, c2.set(s.arr[i], s.arr[i + 1], s.arr[i + 2]), m));
    }
    if (hit) { p.copy(lp).applyMatrix4(s.obj.matrixWorld); v.copy(lv).applyQuaternion(oq); impact = Math.max(impact, hit); }
  }
  // Station : anneau (tore) et moyeu (capsule), dans son repère propre ; le reste se traverse.
  local.subVectors(p, STATION.pos).applyQuaternion(inv);
  if (local.lengthSq() < 200 * 200) {
    const ring = Math.hypot(local.x, local.z);
    if (ring > 0.01) {
      segC.set((local.x / ring) * 90, 0, (local.z / ring) * 90).applyQuaternion(STATION_TILT).add(STATION.pos);
      impact = Math.max(impact, pushOut(p, v, segC, 8 + rad));
    }
    segC.set(0, THREE.MathUtils.clamp(local.y, -40, 40), 0).applyQuaternion(STATION_TILT).add(STATION.pos);
    impact = Math.max(impact, pushOut(p, v, segC, 21 + rad));
  }
  return impact;
}

/* ---------- Construction de la scène ---------- */
const tex = (canvas, color = true) => {
  const t = new THREE.CanvasTexture(canvas);
  if (color) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
};

const ATMO_VERT = `#include <common>
#include <logdepthbuf_pars_vertex>
varying vec3 vN; varying vec3 vW;
void main() {
  vN = normalize(mat3(modelMatrix) * normal);
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
  #include <logdepthbuf_vertex>
}`;
const ATMO_FRAG = `uniform vec3 color; uniform float strength; uniform float power;
#include <logdepthbuf_pars_fragment>
varying vec3 vN; varying vec3 vW;
void main() {
  #include <logdepthbuf_fragment>
  vec3 n = normalize(vN), v = normalize(cameraPosition - vW);
  float rim = pow(1.0 - max(dot(v, n), 0.0), power);
  float lit = smoothstep(-0.25, 0.45, dot(n, normalize(-vW))); // le Soleil est à l'origine
  gl_FragColor = vec4(color * rim * lit * strength, 1.0);
}`;
function atmosphere(r, color, strength = 1.2, power = 3, scale = 1.035) {
  return new THREE.Mesh(new THREE.SphereGeometry(r * scale, 96, 48), new THREE.ShaderMaterial({
    uniforms: { color: { value: new THREE.Color(color) }, strength: { value: strength }, power: { value: power } },
    vertexShader: ATMO_VERT, fragmentShader: ATMO_FRAG, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false,
  }));
}

function material(maps, bumpScale) {
  const mat = new THREE.MeshStandardMaterial({ roughness: 1, metalness: 0 });
  if (maps.map) mat.map = tex(maps.map);
  if (maps.bump) { mat.bumpMap = tex(maps.bump, false); mat.bumpScale = bumpScale; }
  if (maps.rough) mat.roughnessMap = tex(maps.rough, false);
  return mat;
}

// Sphère en relief (Lune, Mars) : la même fonction de hauteur que la texture, et un grain de sol qui se répète pour le détail de près.
function terrainMesh(b, maps, height) {
  const geo = new THREE.SphereGeometry(b.r, 768, 384), pos = geo.attributes.position, uv = geo.attributes.uv, nrm = geo.attributes.normal;
  for (let i = 0; i < pos.count; i++) {
    const lon = uv.getX(i) * TAU, lat = (uv.getY(i) - 0.5) * Math.PI;
    const k = b.r * b.amp * (height(Math.cos(lat) * Math.cos(lon), Math.sin(lat), Math.cos(lat) * Math.sin(lon)) - 0.5);
    pos.setXYZ(i, pos.getX(i) + nrm.getX(i) * k, pos.getY(i) + nrm.getY(i) * k, pos.getZ(i) + nrm.getZ(i) * k);
  }
  geo.computeVertexNormals();
  const mat = material({ map: maps.map }, 0);
  const grain = tex(TX.grain(b.r), false);
  grain.wrapS = grain.wrapT = THREE.RepeatWrapping;
  grain.repeat.set(96, 48);
  mat.bumpMap = grain;
  mat.bumpScale = 1.5;
  return new THREE.Mesh(geo, mat);
}

const ROCKY = {
  grey: [[0, [60, 60, 62]], [0.45, [95, 95, 98]], [0.55, [150, 150, 150]], [1, [210, 210, 210]]],
  mercure: [[0, [70, 66, 62]], [0.5, [130, 124, 116]], [1, [195, 188, 178]]],
  mars: [[0, [90, 38, 22]], [0.4, [150, 68, 38]], [0.65, [198, 108, 64]], [1, [232, 172, 122]]],
  brown: [[0, [70, 58, 48]], [0.5, [125, 108, 92]], [1, [175, 160, 145]]],
  io: [[0, [150, 110, 30]], [0.4, [220, 190, 80]], [0.7, [240, 225, 140]], [1, [200, 90, 40]]],
  ice: [[0, [150, 130, 110]], [0.5, [215, 205, 190]], [1, [245, 240, 232]]],
  dark: [[0, [40, 36, 32]], [0.5, [85, 76, 68]], [1, [140, 130, 120]]],
  triton: [[0, [150, 130, 125]], [0.5, [200, 185, 180]], [1, [235, 225, 222]]],
  pluton: [[0, [90, 60, 45]], [0.45, [160, 120, 90]], [0.7, [205, 175, 140]], [1, [235, 220, 200]]],
};

// Petits rochers bosselés : quelques formes de base, réutilisées des milliers de fois.
function rockShapes(seed) {
  const { fbm } = TX.noiseFor(seed);
  return [0, 1, 2].map(k => {
    const g = new THREE.IcosahedronGeometry(1, 2), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i), f = 0.7 + 0.6 * fbm(x * 1.6 + k * 5, y * 1.6, z * 1.6, 3);
      p.setXYZ(i, x * f, y * f * (0.75 + k * 0.1), z * f);
    }
    g.computeVertexNormals();
    return g;
  });
}

// Un champ d'astéroïdes dans le repère de parent : place(rand) -> [pos, taille]. Ajouté aux collisions.
function rockField(parent, count, seed, place, color) {
  const rand = TX.rng(seed), shapes = rockShapes(seed), arr = new Float32Array(count * 4);
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.95, metalness: 0.05, flatShading: true });
  const meshes = shapes.map(g => new THREE.InstancedMesh(g, mat, Math.ceil(count / 3)));
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sc = V(0, 0, 0), used = [0, 0, 0];
  for (let i = 0; i < count; i++) {
    const [pos, size] = place(rand), k = i % 3;
    q.setFromEuler(e.set(rand() * 6.3, rand() * 6.3, rand() * 6.3));
    sc.set(size * (0.8 + rand() * 0.4), size * (0.8 + rand() * 0.4), size * (0.8 + rand() * 0.4));
    meshes[k].setMatrixAt(used[k]++, m.compose(pos, q, sc));
    arr.set([pos.x, pos.y, pos.z, size * 0.85], i * 4);
  }
  meshes.forEach((mesh, k) => { mesh.count = used[k]; mesh.instanceMatrix.needsUpdate = true; mesh.computeBoundingSphere(); parent.add(mesh); });
  rockSets.push({ arr, obj: parent });
}

// Point rond et doux pour les particules (sinon WebGL dessine des carrés)
let dotTex = null;
const DOT = () => (dotTex ??= tex(TX.glow([[0, 'rgba(255,255,255,1)'], [0.35, 'rgba(255,255,255,.6)'], [1, 'rgba(255,255,255,0)']])));

function dust(count, seed, place, size, color, opacity) {
  const rand = TX.rng(seed), pos = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) pos.set(place(rand), i * 3);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  return new THREE.Points(geo, new THREE.PointsMaterial({ size, color, map: DOT(), transparent: true, opacity, depthWrite: false }));
}

function starfield() {
  const g = new THREE.Group(), R = 600000;
  const layer = (count, size, pick) => {
    const pos = new Float32Array(count * 3), col = new Float32Array(count * 3), c = new THREE.Color();
    for (let i = 0; i < count; i++) {
      const [dir, color] = pick();
      pos.set([dir.x * R, dir.y * R, dir.z * R], i * 3);
      c.set(color);
      col.set([c.r, c.g, c.b], i * 3);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.add(new THREE.Points(geo, new THREE.PointsMaterial({ size, sizeAttenuation: false, vertexColors: true, depthWrite: false, transparent: true })));
  };
  const rand = TX.rng(99), dir = () => { const u = rand() * 2 - 1, a = rand() * TAU, s = Math.sqrt(1 - u * u); return V(s * Math.cos(a), u, s * Math.sin(a)); };
  const tint = () => ['#ffffff', '#cfe0ff', '#fff1d6', '#ffd2a8', '#a9c8ff'][Math.floor(rand() * 5)];
  const dim = (hex, f) => new THREE.Color(hex).multiplyScalar(f).getHex();
  layer(9000, 1.4, () => [dir(), dim(tint(), 0.4 + rand() * 0.5)]);
  layer(1600, 2.2, () => [dir(), dim(tint(), 0.7 + rand() * 0.3)]);
  layer(220, 3.4, () => [dir(), tint()]);
  // Voie lactée : bande de petites étoiles autour d'un grand cercle incliné
  const tilt = new THREE.Quaternion().setFromEuler(new THREE.Euler(1.05, 0.3, 0.4));
  layer(16000, 1.2, () => {
    const a = rand() * TAU, lat = (rand() + rand() + rand() - 1.5) * 0.18;
    return [V(Math.cos(a) * Math.cos(lat), Math.sin(lat), Math.sin(a) * Math.cos(lat)).applyQuaternion(tilt), dim(['#9fb8ff', '#ffe2c4', '#ffffff'][Math.floor(rand() * 3)], 0.25 + rand() * 0.3)];
  });
  // Nébuleuses : grands voiles colorés au loin
  [[150, 70, 255], [40, 170, 255], [255, 70, 150], [255, 140, 60], [60, 230, 200], [120, 90, 255], [255, 90, 90]].forEach((rgb, i) => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex(TX.nebula(i + 1, rgb)), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.1 + rand() * 0.1 }));
    const d = dir();
    if (Math.abs(d.y) > 0.6) d.y *= 0.4;
    s.position.copy(d.normalize().multiplyScalar(R * 0.8));
    s.scale.setScalar(R * (0.25 + rand() * 0.25));
    s.material.rotation = rand() * 6.3;
    g.add(s);
  });
  return g;
}

function buildStation() {
  const g = new THREE.Group(), spin = new THREE.Group();
  const metal = new THREE.MeshStandardMaterial({ color: 0xbcc8d4, metalness: 0.7, roughness: 0.35 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x2a3440, metalness: 0.6, roughness: 0.5 });
  const winTex = tex(TX.windows(4));
  winTex.wrapS = THREE.RepeatWrapping;
  winTex.repeat.set(10, 1);
  const hull = new THREE.MeshStandardMaterial({ color: 0x9aa7b4, metalness: 0.6, roughness: 0.4, emissive: 0xffffff, emissiveMap: winTex, emissiveIntensity: 1.3 });
  const cyan = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.3, 1.1, 1.5) });
  spin.add(new THREE.Mesh(new THREE.TorusGeometry(90, 8, 24, 128).rotateX(Math.PI / 2), hull));
  for (let i = 0; i < 4; i++) {
    const spoke = new THREE.Mesh(new THREE.CylinderGeometry(3, 3, 70, 10).rotateZ(Math.PI / 2), metal);
    const a = (i * Math.PI) / 2;
    spoke.position.set(Math.cos(a) * 55, 0, Math.sin(a) * 55);
    spoke.rotation.y = -a;
    spin.add(spoke);
  }
  spin.add(new THREE.Mesh(new THREE.TorusGeometry(90, 1.2, 8, 128).rotateX(Math.PI / 2).translate(0, 8.5, 0), cyan));
  g.add(spin);
  g.add(new THREE.Mesh(new THREE.CylinderGeometry(20, 20, 80, 40), metal));
  for (const y of [-44, 44]) {
    g.add(new THREE.Mesh(new THREE.CylinderGeometry(12, 16, 8, 32).translate(0, y, 0), dark));
    g.add(new THREE.Mesh(new THREE.TorusGeometry(12.5, 0.9, 8, 48).rotateX(Math.PI / 2).translate(0, y + Math.sign(y) * 4.2, 0), cyan));
  }
  g.add(new THREE.Mesh(new THREE.CylinderGeometry(2.5, 2.5, 100, 8).translate(0, 95, 0), metal));
  const panelMat = new THREE.MeshStandardMaterial({ map: tex(TX.solarPanel()), metalness: 0.5, roughness: 0.3 });
  for (const s of [-1, 1]) g.add(new THREE.Mesh(new THREE.BoxGeometry(110, 1.2, 30).translate(s * 64, 120, 0), panelMat));
  g.add(new THREE.Mesh(new THREE.ConeGeometry(16, 10, 32, 1, true).translate(0, -60, 0), metal));
  const beacons = [];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU, m = new THREE.Mesh(new THREE.SphereGeometry(1.6, 10, 8), new THREE.MeshBasicMaterial({ color: i % 2 ? new THREE.Color(0.3, 3, 0.6) : new THREE.Color(3, 0.3, 0.3) }));
    m.position.set(Math.cos(a) * 99, 0, Math.sin(a) * 99);
    spin.add(m);
    beacons.push(m);
  }
  g.quaternion.copy(STATION_TILT);
  return { g, spin, beacons };
}

// Comète : noyau, chevelure lumineuse, queue de poussière (jaune, courbée) et queue d'ions (bleue, droite).
// Les queues sont le long de +Z ; on oriente le tout à l'opposé du Soleil et on l'allonge près de lui.
function buildComet(seed, tint) {
  const g = new THREE.Group(), tails = new THREE.Group(), rand = TX.rng(seed);
  const nucleus = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 3), new THREE.MeshStandardMaterial({ color: 0x5f5850, roughness: 1, flatShading: true }));
  nucleus.scale.set(26, 18, 20);
  g.add(nucleus);
  const coma = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex(TX.glow([[0, 'rgba(255,255,255,1)'], [0.15, 'rgba(200,240,255,.7)'], [0.5, 'rgba(120,200,255,.15)'], [1, 'rgba(80,160,255,0)']])), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, color: new THREE.Color(tint) }));
  g.add(coma);
  const tail = (count, curve, spread, rgb) => {
    const pos = new Float32Array(count * 3), col = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const u = rand() ** 1.6, a = rand() * TAU, s = (0.01 + u * spread) * Math.sqrt(-2 * Math.log(rand() + 1e-6)) * 0.6;
      pos.set([Math.cos(a) * s + u * u * curve, Math.sin(a) * s, u], i * 3);
      const f = (1 - u) ** 1.4;
      col.set([rgb[0] * f, rgb[1] * f, rgb[2] * f], i * 3);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    tails.add(new THREE.Points(geo, new THREE.PointsMaterial({ size: 90, map: DOT(), vertexColors: true, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false })));
  };
  tail(5000, 0.18, 0.09, [1, 0.88, 0.65]);
  tail(3000, 0, 0.025, [0.45, 0.7, 1.2]);
  g.add(tails);
  return {
    g,
    update(pos, t, camPos) {
      g.position.copy(pos);
      // De tout près, la chevelure et la queue s'estompent (sinon l'écran devient blanc)
      nucleus.rotation.set(t * 0.05, t * 0.08, 0);
      // Loin du Soleil la comète « dort » : queue courte et pâle ; près de lui, longue et brillante.
      const L = THREE.MathUtils.clamp(1.1e8 / pos.length(), 400, 9000), active = L / 9000;
      const near = THREE.MathUtils.clamp((camPos.distanceTo(pos) - 80) / 2500, 0.06, 1);
      coma.material.opacity = near * (0.25 + 0.75 * active);
      for (const p of tails.children) { p.material.opacity = near * (0.08 + 0.92 * active); p.material.size = 15 + 75 * active; }
      tails.scale.setScalar(L);
      tails.lookAt(tmp.copy(pos).multiplyScalar(2)); // +Z vers l'extérieur du système, à l'opposé du Soleil
      coma.scale.setScalar(300 + L * 0.08);
    },
  };
}

// Pluie de météorites autour d'un astre : trajectoires tirées de la graine de l'événement (identiques pour tous).
function buildMeteors() {
  const N = 60;
  const mesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 1.1, 0.4) }), N);
  const lines = new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 6), 3)),
    new THREE.LineBasicMaterial({ color: 0xffa060, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false }));
  mesh.frustumCulled = lines.frustumCulled = false;
  const heads = Array.from({ length: N }, () => ({ p: V(0, 0, 0), r: 0 }));
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = V(0, 0, 0), a = V(0, 0, 0), b = V(0, 0, 0), u1 = V(0, 0, 0), u2 = V(0, 0, 0);
  let active = false;
  return {
    objs: [mesh, lines],
    heads: () => (active ? heads : []),
    update(ev, t) {
      const target = ev && ev.type === 'meteors' && ev.phase === 'active' && byId(ev.target);
      active = !!target;
      mesh.visible = lines.visible = active;
      if (!active) return;
      const rand = TX.rng(ev.seed), arr = lines.geometry.attributes.position.array, R = target.ringOut ?? target.r;
      for (let i = 0; i < N; i++) {
        u1.set(rand() - 0.5, rand() - 0.5, rand() - 0.5).normalize();
        u2.set(rand() - 0.5, rand() - 0.5, rand() - 0.5).normalize();
        const dur = 6 + rand() * 8, off = rand() * dur, size = 3 + rand() * 9, f = ((t + off) % dur) / dur;
        a.copy(target.pos).addScaledVector(u1, R * 4 + 2500);
        b.copy(target.pos).addScaledVector(u2, target.r * 0.98);
        const h = heads[i];
        h.p.lerpVectors(a, b, f);
        h.r = size;
        mesh.setMatrixAt(i, m.compose(h.p, q, s.setScalar(size)));
        const back = tmp.subVectors(a, b).normalize().multiplyScalar(40 + size * 25).add(h.p);
        arr.set([h.p.x, h.p.y, h.p.z, back.x, back.y, back.z], i * 6);
      }
      mesh.instanceMatrix.needsUpdate = true;
      lines.geometry.attributes.position.needsUpdate = true;
    },
  };
}

const wait = () => new Promise(r => setTimeout(r, 0));

// Construit tout le système dans la scène, étape par étape (progress(0..1) pour la barre de chargement).
export async function buildWorld(scene, progress = () => {}) {
  orbits(0);
  const spinners = [], holders = [], shadows = [], b = byId;
  let stars, station, sunLight, halo, corona, meteors;
  const comets = {};
  // Un astre : un support (position, inclinaison) qui suit l'orbite, et la sphère qui tourne dedans.
  const planet = (body, maps, opts = {}) => {
    const holder = new THREE.Group(), segs = opts.segs ?? (body.r > 500 ? 160 : body.r > 100 ? 112 : 48);
    holder.rotation.z = body.tilt ?? 0.1;
    const mesh = opts.height ? terrainMesh(body, maps, opts.height) : new THREE.Mesh(new THREE.SphereGeometry(body.r, segs, segs / 2), material(maps, opts.bumpScale ?? 3));
    if (opts.height) terrains.set(body.id, { mesh, height: opts.height, amp: body.amp });
    holder.add(mesh);
    spinners.push([mesh, opts.spin ?? 0.004]);
    // Ombres : celles des lunes sur la planète, de la planète sur ses lunes, des anneaux sur Saturne
    const occluders = BODIES.filter(x => (x.parent === body.id && x.kind === 'moon') || (body.kind === 'moon' && x.id === body.parent));
    if (occluders.length || opts.ring) shadows.push({ h: shadowed(mesh.material, { ring: opts.ring }), occluders, ringOf: opts.ring && holder });
    if (opts.clouds) {
      const mat = new THREE.MeshStandardMaterial({ map: tex(opts.clouds), transparent: true, depthWrite: false, roughness: 1 });
      holder.add(new THREE.Mesh(new THREE.SphereGeometry(body.r * 1.012, 128, 64), mat));
      spinners.push([holder.children.at(-1), (opts.spin ?? 0.004) * 1.4]);
      if (occluders.length) shadows.push({ h: shadowed(mat), occluders });
    }
    if (opts.atmo) holder.add(atmosphere(body.r, ...opts.atmo));
    scene.add(holder);
    holders.push([holder, body]);
    return holder;
  };

  const steps = [
    () => {
      scene.add(new THREE.AmbientLight(0x8fa3c8, 0.35));
      sunLight = new THREE.PointLight(0xfff1df, 1300, 0, 0.6); // décroissance douce : plus sombre au loin, sans être noir
      scene.add(sunLight);
      const s = b('soleil');
      const sunMesh = new THREE.Mesh(new THREE.SphereGeometry(s.r, 96, 48), new THREE.MeshBasicMaterial({ map: tex(TX.sun()), color: new THREE.Color(1.9, 1.55, 1.2) }));
      scene.add(sunMesh);
      spinners.push([sunMesh, 0.003]);
      halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex(TX.glow()), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, color: new THREE.Color(1.4, 1.1, 0.8) }));
      corona = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex(TX.glow([[0, 'rgba(255,240,200,.9)'], [0.3, 'rgba(255,170,60,.25)'], [1, 'rgba(255,100,0,0)']])), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.3 }));
      corona.scale.setScalar(s.r * 9);
      scene.add(halo, corona);
    },
    () => scene.add(stars = starfield()),
    () => planet(b('mercure'), TX.rocky({ seed: 21, stops: ROCKY.mercure, craters: 110, scale: 3 }), { bumpScale: 4 }),
    () => planet(b('venus'), { map: TX.venus() }, { atmo: ['#ffd27a', 1.6, 2.2, 1.05], spin: 0.002 }),
    () => planet(b('terre'), TX.earth(), { clouds: TX.clouds(31, { w: 2048, h: 1024, scale: 3.2, cover: 0.5 }), atmo: ['#5aa8ff', 1.7, 2.6, 1.04], bumpScale: 6 }),
    () => {
      const o = { seed: 41, scale: 2.5, craters: 160 };
      planet(b('lune'), TX.rocky({ ...o, w: 2048, h: 1024, stops: ROCKY.grey }), { height: TX.rockyHeight(o) });
    },
    () => {
      const o = { seed: 51, scale: 2.6, craters: 60 };
      planet(b('mars'), TX.rocky({ ...o, w: 2048, h: 1024, stops: ROCKY.mars, caps: 0.965 }), { height: TX.rockyHeight(o), atmo: ['#ff9a6b', 0.7, 3.2, 1.025] });
      planet(b('phobos'), TX.rocky({ seed: 52, w: 256, h: 128, stops: ROCKY.brown, craters: 20 }), { segs: 32 }).children[0].scale.set(1.3, 0.85, 1);
      planet(b('deimos'), TX.rocky({ seed: 53, w: 256, h: 128, stops: ROCKY.brown, craters: 14 }), { segs: 32 }).children[0].scale.set(1.2, 0.9, 1);
    },
    () => {
      // Ceinture d'astéroïdes (avec le champ de Kepler), dans un repère qui tourne lentement autour du Soleil
      const belt = new THREE.Group(), k = KEPLER.orbit, kc = V(Math.cos(k.a0) * k.d, 0, Math.sin(k.a0) * k.d);
      rockField(belt, 3000, 61, rand => {
        const u = rand() * 2 - 1, a = rand() * TAU, s = Math.sqrt(1 - u * u), d = KEPLER.r * Math.cbrt(rand());
        return [V(kc.x + s * Math.cos(a) * d, u * d * 0.35, kc.z + s * Math.sin(a) * d), 6 + 70 * rand() ** 3];
      }, 0x8a7e72);
      rockField(belt, 5000, 62, rand => {
        const a = rand() * TAU, d = BELT.inner + (BELT.outer - BELT.inner) * rand(), y = (rand() + rand() - 1) * BELT.half;
        return [V(Math.cos(a) * d, y, Math.sin(a) * d), 15 + 110 * rand() ** 3];
      }, 0x7d7266);
      belt.add(dust(30000, 63, rand => { const a = rand() * TAU, d = BELT.inner + (BELT.outer - BELT.inner) * rand(); return [Math.cos(a) * d, (rand() + rand() - 1) * BELT.half * 1.5, Math.sin(a) * d]; }, 18, 0x6b6258, 0.4));
      const veil = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex(TX.nebula(70, [200, 170, 130])), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.25 }));
      veil.scale.setScalar(KEPLER.r * 3.2);
      veil.position.copy(kc);
      belt.add(veil);
      scene.add(belt);
      holders.push([belt, BELT]);
    },
    () => planet(b('jupiter'), { map: TX.gas(71, { stops: [[0, [200, 175, 150]], [0.08, [170, 120, 85]], [0.16, [225, 205, 180]], [0.24, [185, 130, 90]], [0.32, [235, 220, 200]], [0.38, [160, 105, 70]], [0.44, [240, 228, 210]], [0.5, [215, 180, 140]], [0.56, [245, 232, 212]], [0.62, [175, 115, 75]], [0.7, [230, 212, 188]], [0.78, [190, 140, 100]], [0.86, [220, 200, 175]], [0.94, [165, 130, 105]], [1, [190, 170, 150]]], turb: 0.05, spot: { lat: -0.38, lon: 1.2, w: 0.2, h: 0.085, color: [190, 85, 55] } }) }, { atmo: ['#ffd9b0', 0.6, 3, 1.02], spin: 0.012 }),
    () => {
      planet(b('io'), TX.rocky({ seed: 72, w: 512, h: 256, stops: ROCKY.io, craters: 10 }));
      planet(b('europe'), TX.rocky({ seed: 73, w: 512, h: 256, stops: ROCKY.ice, craters: 6, scale: 6 }));
      planet(b('ganymede'), TX.rocky({ seed: 74, w: 512, h: 256, stops: ROCKY.brown, craters: 50 }));
      planet(b('callisto'), TX.rocky({ seed: 75, w: 512, h: 256, stops: ROCKY.dark, craters: 90 }));
    },
    () => {
      const s = b('saturne'), ringMap = tex(TX.rings());
      const holder = planet(s, { map: TX.gas(81, { w: 1024, h: 512, stops: [[0, [200, 185, 150]], [0.15, [215, 195, 150]], [0.3, [230, 210, 165]], [0.42, [205, 180, 130]], [0.5, [235, 215, 170]], [0.58, [210, 185, 135]], [0.7, [232, 212, 168]], [0.85, [215, 195, 150]], [1, [190, 175, 140]]], turb: 0.03, fine: 0.1 }) }, { atmo: ['#ffe9b8', 0.5, 3, 1.02], spin: 0.01, ring: { map: ringMap, inner: s.ringIn, outer: s.ringOut } });
      const geo = new THREE.RingGeometry(s.ringIn, s.ringOut, 256, 1), p = geo.attributes.position, uv = geo.attributes.uv;
      for (let i = 0; i < p.count; i++) uv.setXY(i, (Math.hypot(p.getX(i), p.getY(i)) - s.ringIn) / (s.ringOut - s.ringIn), 0.5);
      geo.rotateX(-Math.PI / 2);
      const ringMat = new THREE.MeshStandardMaterial({ map: ringMap, transparent: true, side: THREE.DoubleSide, depthWrite: false, roughness: 1 });
      holder.add(new THREE.Mesh(geo, ringMat));
      shadows.push({ h: shadowed(ringMat), occluders: [s] }); // l'ombre de Saturne sur ses anneaux
      // Blocs de glace dans les anneaux, dans le repère (incliné) de Saturne
      rockField(holder, 6000, 82, rand => {
        let d;
        do d = s.ringIn + 60 + (s.ringOut - s.ringIn - 120) * rand(); while ((d - s.ringIn) / (s.ringOut - s.ringIn) > 0.6 && (d - s.ringIn) / (s.ringOut - s.ringIn) < 0.66);
        const a = rand() * TAU;
        return [V(Math.cos(a) * d, (rand() - 0.5) * 24, Math.sin(a) * d), 2 + 14 * rand() ** 3];
      }, 0xcfc4b0);
      planet(b('titan'), { map: TX.gas(83, { w: 512, h: 256, stops: [[0, [190, 130, 50]], [0.5, [216, 166, 78]], [1, [190, 130, 50]]], fine: 0.08 }) }, { atmo: ['#ffb347', 1.2, 2.5, 1.06] });
    },
    () => planet(b('uranus'), { map: TX.gas(91, { w: 512, h: 256, stops: [[0, [150, 205, 215]], [0.5, [176, 226, 234]], [1, [150, 205, 215]]], fine: 0.05 }) }, { atmo: ['#a8f0ff', 1, 2.6, 1.03] }),
    () => {
      planet(b('neptune'), { map: TX.gas(101, { w: 1024, h: 512, stops: [[0, [40, 70, 170]], [0.3, [60, 100, 210]], [0.45, [45, 80, 190]], [0.55, [70, 120, 225]], [0.7, [50, 85, 195]], [1, [35, 60, 160]]], spot: { lat: -0.35, lon: 2, w: 0.12, h: 0.06, color: [25, 40, 110] } }) }, { atmo: ['#5d8bff', 1.3, 2.6, 1.03] });
      planet(b('triton'), TX.rocky({ seed: 102, w: 256, h: 128, stops: ROCKY.triton, craters: 12 }));
    },
    () => {
      // Confins : Pluton (et son cœur), Charon, ceinture de Kuiper
      planet(b('pluton'), TX.rocky({ seed: 111, w: 1024, h: 512, stops: ROCKY.pluton, craters: 30, spot: { lat: 0.1, lon: 1.5, r: 0.55, color: [245, 236, 222] } }), { atmo: ['#bcd4ff', 0.6, 3, 1.03] });
      planet(b('charon'), TX.rocky({ seed: 112, w: 512, h: 256, stops: ROCKY.dark.map(([t, c]) => [t, c.map(v => v * 1.4)]), craters: 25 }));
      const kuiper = new THREE.Group(), R = KUIPER_RING;
      rockField(kuiper, 2500, 113, rand => {
        const a = rand() * TAU, d = R.inner + (R.outer - R.inner) * rand();
        return [V(Math.cos(a) * d, (rand() + rand() - 1) * R.half, Math.sin(a) * d), 20 + 140 * rand() ** 3];
      }, 0xaab4c0);
      kuiper.add(dust(30000, 114, rand => { const a = rand() * TAU, d = R.inner + (R.outer - R.inner) * rand(); return [Math.cos(a) * d, (rand() + rand() - 1) * R.half * 1.4, Math.sin(a) * d]; }, 40, 0x7f90a6, 0.35));
      scene.add(kuiper);
      holders.push([kuiper, R]);
    },
    () => {
      comets.halley = buildComet(121, '#bfefff');
      comets.visiteuse = buildComet(122, '#e0c8ff');
      scene.add(comets.halley.g, comets.visiteuse.g);
      meteors = buildMeteors();
      scene.add(...meteors.objs);
      station = buildStation();
      scene.add(station.g);
    },
  ];
  for (let i = 0; i < steps.length; i++) {
    steps[i]();
    progress((i + 1) / steps.length);
    await wait();
  }
  const ringN = V(0, 0, 0), sat = b('saturne');
  return {
    meteorHeads: () => meteors.heads(),
    // t : heure commune (s depuis EPOCH) ; storm : 0..1 (tempête solaire)
    update(t, camPos, storm = 0) {
      orbits(t);
      for (const [h, body] of holders) {
        if (body.T) h.rotation.y = -(TAU * t) / body.T; // ceintures : rotation d'ensemble autour du Soleil
        else h.position.copy(body.pos);
        h.updateMatrixWorld();
      }
      for (const [m, s] of spinners) m.rotation.y = (s * t) % TAU;
      for (const s of shadows) s.h.update(s.occluders, s.ringOf && { center: sat.pos, normal: ringN.set(0, 1, 0).applyQuaternion(s.ringOf.quaternion) });
      station.g.position.copy(STATION.pos);
      station.spin.rotation.y = (0.05 * t) % TAU;
      const on = Math.sin(t * 3) > 0.2;
      for (const x of station.beacons) x.visible = on;
      stars.position.copy(camPos); // le ciel suit la caméra : on ne l'atteint jamais
      comets.halley.update(b('halley').pos, t, camPos);
      const v = b('visiteuse');
      comets.visiteuse.g.visible = shown(v);
      if (shown(v)) comets.visiteuse.update(v.pos, t, camPos);
      meteors.update(event, t);
      sunLight.intensity = 1300 * (1 + storm * 0.8);
      halo.scale.setScalar(2600 * (3.4 + storm * 2.5));
      corona.material.opacity = 0.3 + storm * 0.4;
    },
  };
}
