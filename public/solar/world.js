// Le système solaire de Solar Explorer : astres, lunes, station, astéroïdes, étoiles, nébuleuses, et les collisions avec tout ça.
// Distances réduites mais grandes : 1 unité = KM km affichés. Les astres sont fixes (seules leurs rotations tournent),
// donc tous les pilotes voient exactement le même univers sans rien synchroniser.
import * as THREE from 'three';
import * as TX from './textures.js';

export const KM = 20;
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const polar = (d, a, y = 0) => V(Math.cos(a) * d, y, Math.sin(a) * d);

// kind : star | planet | moon | station | zone
export const BODIES = [];
const add = b => (BODIES.push(b), b);
add({ id: 'soleil', name: 'Soleil', kind: 'star', r: 2600, pos: V(0, 0, 0), color: '#ffb340', desc: 'Notre étoile. Son éclat baisse à mesure qu’on s’en éloigne : au-delà de Saturne, l’espace devient sombre.' });
const P = (id, name, d, a, r, color, desc, extra = {}) => add({ id, name, kind: 'planet', r, pos: polar(d, a), color, desc, ...extra });
P('mercure', 'Mercure', 9000, 2.5, 140, '#a29d96', 'Petite planète rocheuse criblée de cratères, brûlée par le Soleil tout proche.');
P('venus', 'Vénus', 14500, 1.1, 300, '#e8c27a', 'Une atmosphère épaisse de nuages jaunes : la planète la plus lumineuse du ciel.');
const terre = P('terre', 'Terre', 21000, 0, 330, '#3c8fd9', 'Océans, continents et nuages : la maison. La station Horizon est en orbite juste à côté.');
const mars = P('mars', 'Mars', 29000, 0.5, 190, '#d0603a', 'La planète rouge : déserts, cratères, volcans et calottes glacées. Deux minuscules lunes.');
const jupiter = P('jupiter', 'Jupiter', 56000, 0.95, 1500, '#d9a877', 'La géante : bandes de nuages et Grande Tache rouge. Quatre grandes lunes.');
const saturne = P('saturne', 'Saturne', 76000, 1.75, 1250, '#e5cf98', 'Ses anneaux de glace et de roche se traversent… en évitant les blocs !', { ringIn: 1650, ringOut: 3100, tilt: 0.47 });
P('uranus', 'Uranus', 94000, 2.6, 700, '#9fe0ea', 'Géante de glace bleu pâle, couchée sur le côté.', { tilt: 1.7 });
const neptune = P('neptune', 'Neptune', 110000, 3.4, 680, '#3f6fe0', 'Aux confins sombres du système : la planète des vents les plus violents.');
const M = (id, name, parent, off, r, color, desc) => add({ id, name, kind: 'moon', parent: parent.id, r, pos: parent.pos.clone().add(off), color, desc });
M('lune', 'Lune', terre, V(-300, 160, -1700), 90, '#bdbdbd', 'Le satellite de la Terre : mers sombres et cratères.');
M('phobos', 'Phobos', mars, V(420, 40, 160), 18, '#8c7b6b', 'Petite lune de Mars, en forme de patate.');
M('deimos', 'Deimos', mars, V(-650, -60, 480), 12, '#9c8a78', 'La plus petite lune de Mars.');
M('io', 'Io', jupiter, V(2600, 80, 300), 70, '#e6d36a', 'Lune volcanique de Jupiter, soufrée et jaune.');
M('europe', 'Europe', jupiter, V(-1200, -60, 3100), 60, '#d9cdb8', 'Lune glacée de Jupiter, striée de fissures.');
M('ganymede', 'Ganymède', jupiter, V(-3900, 120, -2000), 100, '#9b8f84', 'La plus grande lune du système solaire.');
M('callisto', 'Callisto', jupiter, V(2400, -150, -5100), 90, '#6f6458', 'Lune sombre, la plus cratérisée de toutes.');
M('titan', 'Titan', saturne, V(-5200, 300, 2600), 105, '#d8a64e', 'Grande lune de Saturne, enveloppée d’une brume orange.');
M('triton', 'Triton', neptune, V(900, 100, -1100), 60, '#c9c3c0', 'Lune glacée de Neptune, aux geysers d’azote.');
export const STATION = add({ id: 'horizon', name: 'Station Horizon', kind: 'station', r: 100, pos: terre.pos.clone().add(V(950, 90, 700)), color: '#7cf3ff', desc: 'Point de départ et lieu de rendez-vous des pilotes, en orbite autour de la Terre. Ta coque s’y répare.' });
export const KEPLER = add({ id: 'kepler', name: 'Champ de Kepler', kind: 'zone', r: 2200, pos: polar(38500, 0.3), color: '#c7b39a', desc: 'L’amas le plus dense de la ceinture d’astéroïdes : faufile-toi entre les rochers.' });
export const BELT = { inner: 35500, outer: 41500, half: 700 };
const STATION_TILT = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.25, 0, 0.12));
const byId = id => BODIES.find(b => b.id === id);

/* ---------- Distances et collisions (aussi utiles sans rendu) ---------- */
let rocks = new Float32Array(0); // x, y, z, rayon de chaque astéroïde

// Distance à la surface la plus proche : sert à régler la vitesse de croisière (rapide dans le vide, précise près des astres).
export function nearest(p) {
  let best = Infinity, body = null;
  for (const b of BODIES) {
    const reach = b.ringOut ?? (b.kind === 'station' ? 150 : b.r);
    const d = p.distanceTo(b.pos) - reach;
    if (d < best) { best = d; body = b; }
  }
  const rr = Math.hypot(p.x, p.z), belt = Math.max(BELT.inner - rr, rr - BELT.outer, Math.abs(p.y) - BELT.half);
  return { dist: Math.min(best, Math.max(belt, 0) + 1200), body, inBelt: belt < 0 };
}

const n = new THREE.Vector3();
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

const local = new THREE.Vector3(), inv = STATION_TILT.clone().invert(), q2 = new THREE.Vector3(), segC = new THREE.Vector3();
export function collide(p, v, rad) {
  let impact = 0;
  for (const b of BODIES) if (b.kind !== 'station' && b.kind !== 'zone') impact = Math.max(impact, pushOut(p, v, b.pos, b.r + rad));
  for (let i = 0; i < rocks.length; i += 4) {
    const dx = p.x - rocks[i], dy = p.y - rocks[i + 1], dz = p.z - rocks[i + 2], m = rocks[i + 3] + rad;
    if (dx * dx + dy * dy + dz * dz < m * m) impact = Math.max(impact, pushOut(p, v, q2.set(rocks[i], rocks[i + 1], rocks[i + 2]), m));
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

// Zone traversée, pour l'interface.
export function zoneName(p) {
  if (p.distanceTo(STATION.pos) < 260) return 'Station Horizon';
  if (p.distanceTo(KEPLER.pos) < KEPLER.r) return 'Champ d’astéroïdes de Kepler';
  for (const b of BODIES) if ((b.kind === 'planet' || b.kind === 'star') && p.distanceTo(b.pos) < (b.ringOut ?? b.r) * 5) return b.kind === 'star' ? 'Couronne solaire' : `Orbite de ${b.name}`;
  for (const b of BODIES) if (b.kind === 'moon' && p.distanceTo(b.pos) < b.r * 8) return `Près de ${b.name}`;
  if (nearest(p).inBelt) return 'Ceinture d’astéroïdes';
  return Math.hypot(p.x, p.z) > 60000 ? 'Système solaire externe' : 'Espace interplanétaire';
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

function sphere(b, maps, { bumpScale = 3, segs } = {}) {
  const s = segs ?? (b.r > 500 ? 160 : b.r > 100 ? 112 : 48);
  const mat = new THREE.MeshStandardMaterial({ roughness: 1, metalness: 0 });
  if (maps.map) mat.map = tex(maps.map);
  if (maps.bump) { mat.bumpMap = tex(maps.bump, false); mat.bumpScale = bumpScale; }
  if (maps.rough) mat.roughnessMap = tex(maps.rough, false);
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(b.r, s, s / 2), mat);
  return mesh;
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

// Un champ d'astéroïdes : place les rochers (place(i) -> [pos, taille]) et les ajoute à la liste des collisions.
function rockField(scene, count, seed, place, color) {
  const rand = TX.rng(seed), shapes = rockShapes(seed), out = new Float32Array(count * 4);
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.95, metalness: 0.05, flatShading: true });
  const meshes = shapes.map(g => new THREE.InstancedMesh(g, mat, Math.ceil(count / 3)));
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sc = new THREE.Vector3(), used = [0, 0, 0];
  for (let i = 0; i < count; i++) {
    const [pos, size] = place(rand), k = i % 3;
    q.setFromEuler(e.set(rand() * 6.3, rand() * 6.3, rand() * 6.3));
    sc.set(size * (0.8 + rand() * 0.4), size * (0.8 + rand() * 0.4), size * (0.8 + rand() * 0.4));
    meshes[k].setMatrixAt(used[k]++, m.compose(pos, q, sc));
    out.set([pos.x, pos.y, pos.z, size * 0.85], i * 4);
  }
  meshes.forEach((mesh, k) => { mesh.count = used[k]; mesh.instanceMatrix.needsUpdate = true; mesh.computeBoundingSphere(); scene.add(mesh); });
  return out;
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
  const rand = TX.rng(99), dir = () => { const u = rand() * 2 - 1, a = rand() * Math.PI * 2, s = Math.sqrt(1 - u * u); return V(s * Math.cos(a), u, s * Math.sin(a)); };
  const tint = () => ['#ffffff', '#cfe0ff', '#fff1d6', '#ffd2a8', '#a9c8ff'][Math.floor(rand() * 5)];
  const dim = (hex, f) => new THREE.Color(hex).multiplyScalar(f).getHex();
  layer(9000, 1.4, () => [dir(), dim(tint(), 0.4 + rand() * 0.5)]);
  layer(1600, 2.2, () => [dir(), dim(tint(), 0.7 + rand() * 0.3)]);
  layer(220, 3.4, () => [dir(), tint()]);
  // Voie lactée : bande de petites étoiles autour d'un grand cercle incliné
  const tilt = new THREE.Quaternion().setFromEuler(new THREE.Euler(1.05, 0.3, 0.4));
  layer(16000, 1.2, () => {
    const a = rand() * Math.PI * 2, lat = (rand() + rand() + rand() - 1.5) * 0.18;
    return [V(Math.cos(a) * Math.cos(lat), Math.sin(lat), Math.sin(a) * Math.cos(lat)).applyQuaternion(tilt), dim(['#9fb8ff', '#ffe2c4', '#ffffff'][Math.floor(rand() * 3)], 0.25 + rand() * 0.3)];
  });
  // Nébuleuses : grands voiles colorés au loin
  const colors = [[150, 70, 255], [40, 170, 255], [255, 70, 150], [255, 140, 60], [60, 230, 200], [120, 90, 255], [255, 90, 90]];
  colors.forEach((rgb, i) => {
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
  const ring = new THREE.Mesh(new THREE.TorusGeometry(90, 8, 24, 128).rotateX(Math.PI / 2), hull);
  spin.add(ring);
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
  // Balises clignotantes rouges et vertes
  const beacons = [];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2, m = new THREE.Mesh(new THREE.SphereGeometry(1.6, 10, 8), new THREE.MeshBasicMaterial({ color: i % 2 ? new THREE.Color(0.3, 3, 0.6) : new THREE.Color(3, 0.3, 0.3) }));
    m.position.set(Math.cos(a) * 99, 0, Math.sin(a) * 99);
    spin.add(m);
    beacons.push(m);
  }
  g.position.copy(STATION.pos);
  g.quaternion.copy(STATION_TILT);
  return { g, spin, beacons };
}

const wait = () => new Promise(r => setTimeout(r, 0));
const join = (...arrs) => { const out = new Float32Array(arrs.reduce((n, a) => n + a.length, 0)); let o = 0; for (const a of arrs) { out.set(a, o); o += a.length; } return out; };

// Construit tout le système dans la scène, étape par étape (progress(0..1) pour la barre de chargement).
export async function buildWorld(scene, progress = () => {}) {
  const spinners = [], b = byId;
  let stars;
  const place = (mesh, body) => { mesh.position.copy(body.pos); scene.add(mesh); return mesh; };
  const planet = (body, maps, opts = {}) => {
    const holder = new THREE.Group();
    holder.position.copy(body.pos);
    holder.rotation.z = body.tilt ?? 0.1;
    const mesh = sphere(body, maps, opts);
    holder.add(mesh);
    spinners.push([mesh, opts.spin ?? 0.004]);
    if (opts.clouds) {
      const c = new THREE.Mesh(new THREE.SphereGeometry(body.r * 1.012, 128, 64), new THREE.MeshStandardMaterial({ map: tex(opts.clouds), transparent: true, depthWrite: false, roughness: 1 }));
      holder.add(c);
      spinners.push([c, (opts.spin ?? 0.004) * 1.4]);
    }
    if (opts.atmo) holder.add(atmosphere(body.r, ...opts.atmo));
    scene.add(holder);
    return holder;
  };

  const steps = [
    () => {
      scene.add(new THREE.AmbientLight(0x8fa3c8, 0.35));
      scene.add(new THREE.PointLight(0xfff1df, 1300, 0, 0.6)); // décroissance douce : plus sombre au loin, sans être noir
      const s = b('soleil');
      const sunMesh = new THREE.Mesh(new THREE.SphereGeometry(s.r, 96, 48), new THREE.MeshBasicMaterial({ map: tex(TX.sun()), color: new THREE.Color(1.9, 1.55, 1.2) }));
      scene.add(sunMesh);
      spinners.push([sunMesh, 0.003]);
      const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex(TX.glow()), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, color: new THREE.Color(1.4, 1.1, 0.8) }));
      halo.scale.setScalar(s.r * 3.4);
      scene.add(halo);
      const corona = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex(TX.glow([[0, 'rgba(255,240,200,.9)'], [0.3, 'rgba(255,170,60,.25)'], [1, 'rgba(255,100,0,0)']])), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.3 }));
      corona.scale.setScalar(s.r * 9);
      scene.add(corona);
    },
    () => scene.add(stars = starfield()),
    () => planet(b('mercure'), TX.rocky({ seed: 21, stops: ROCKY.mercure, craters: 110, scale: 3 }), { bumpScale: 4 }),
    () => planet(b('venus'), { map: TX.venus() }, { atmo: ['#ffd27a', 1.6, 2.2, 1.05], spin: 0.002 }),
    () => planet(b('terre'), TX.earth(), { clouds: TX.clouds(31, { w: 2048, h: 1024, scale: 3.2, cover: 0.5 }), atmo: ['#5aa8ff', 1.7, 2.6, 1.04], bumpScale: 6 }),
    () => planet(b('lune'), TX.rocky({ seed: 41, stops: ROCKY.grey, craters: 140, scale: 2.5 }), { bumpScale: 4 }),
    () => {
      planet(b('mars'), TX.rocky({ seed: 51, stops: ROCKY.mars, craters: 45, scale: 2.6, caps: 0.965 }), { atmo: ['#ff9a6b', 0.7, 3.2, 1.025], bumpScale: 6 });
      planet(b('phobos'), TX.rocky({ seed: 52, w: 256, h: 128, stops: ROCKY.brown, craters: 20 }), { segs: 32 }).children[0].scale.set(1.3, 0.85, 1);
      planet(b('deimos'), TX.rocky({ seed: 53, w: 256, h: 128, stops: ROCKY.brown, craters: 14 }), { segs: 32 }).children[0].scale.set(1.2, 0.9, 1);
    },
    () => {
      rocks = new Float32Array(0);
      const k = KEPLER, belt = BELT;
      const parts = [
        rockField(scene, 3000, 61, rand => {
          const u = rand() * 2 - 1, a = rand() * 6.283, s = Math.sqrt(1 - u * u), d = k.r * Math.cbrt(rand());
          return [V(k.pos.x + s * Math.cos(a) * d, k.pos.y + u * d * 0.35, k.pos.z + s * Math.sin(a) * d), 6 + 70 * rand() ** 3];
        }, 0x8a7e72),
        rockField(scene, 5000, 62, rand => {
          const a = rand() * 6.283, d = belt.inner + (belt.outer - belt.inner) * rand(), y = (rand() + rand() - 1) * belt.half;
          return [V(Math.cos(a) * d, y, Math.sin(a) * d), 15 + 110 * rand() ** 3];
        }, 0x7d7266),
      ];
      // Poussière de la ceinture, visible de loin, et voile autour de Kepler
      const rand = TX.rng(63), count = 30000, pos = new Float32Array(count * 3);
      for (let i = 0; i < count; i++) {
        const a = rand() * 6.283, d = belt.inner + (belt.outer - belt.inner) * rand(), y = (rand() + rand() - 1) * belt.half * 1.5;
        pos.set([Math.cos(a) * d, y, Math.sin(a) * d], i * 3);
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      scene.add(new THREE.Points(geo, new THREE.PointsMaterial({ size: 18, color: 0x6b6258, transparent: true, opacity: 0.4, depthWrite: false })));
      const veil = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex(TX.nebula(70, [200, 170, 130])), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.25 }));
      veil.scale.setScalar(k.r * 3.2);
      place(veil, k);
      rocks = join(rocks, ...parts);
    },
    () => planet(b('jupiter'), { map: TX.gas(71, { stops: [[0, [200, 175, 150]], [0.08, [170, 120, 85]], [0.16, [225, 205, 180]], [0.24, [185, 130, 90]], [0.32, [235, 220, 200]], [0.38, [160, 105, 70]], [0.44, [240, 228, 210]], [0.5, [215, 180, 140]], [0.56, [245, 232, 212]], [0.62, [175, 115, 75]], [0.7, [230, 212, 188]], [0.78, [190, 140, 100]], [0.86, [220, 200, 175]], [0.94, [165, 130, 105]], [1, [190, 170, 150]]], turb: 0.05, spot: { lat: -0.38, lon: 1.2, w: 0.2, h: 0.085, color: [190, 85, 55] } }) }, { atmo: ['#ffd9b0', 0.6, 3, 1.02], spin: 0.012 }),
    () => {
      planet(b('io'), TX.rocky({ seed: 72, w: 512, h: 256, stops: ROCKY.io, craters: 10 }));
      planet(b('europe'), TX.rocky({ seed: 73, w: 512, h: 256, stops: ROCKY.ice, craters: 6, scale: 6 }));
      planet(b('ganymede'), TX.rocky({ seed: 74, w: 512, h: 256, stops: ROCKY.brown, craters: 50 }));
      planet(b('callisto'), TX.rocky({ seed: 75, w: 512, h: 256, stops: ROCKY.dark, craters: 90 }));
    },
    () => {
      const s = b('saturne');
      const holder = planet(s, { map: TX.gas(81, { w: 1024, h: 512, stops: [[0, [200, 185, 150]], [0.15, [215, 195, 150]], [0.3, [230, 210, 165]], [0.42, [205, 180, 130]], [0.5, [235, 215, 170]], [0.58, [210, 185, 135]], [0.7, [232, 212, 168]], [0.85, [215, 195, 150]], [1, [190, 175, 140]]], turb: 0.03, fine: 0.1 }) }, { atmo: ['#ffe9b8', 0.5, 3, 1.02], spin: 0.01 });
      const geo = new THREE.RingGeometry(s.ringIn, s.ringOut, 256, 1), p = geo.attributes.position, uv = geo.attributes.uv;
      for (let i = 0; i < p.count; i++) uv.setXY(i, (Math.hypot(p.getX(i), p.getY(i)) - s.ringIn) / (s.ringOut - s.ringIn), 0.5);
      geo.rotateX(-Math.PI / 2);
      holder.add(new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: tex(TX.rings()), transparent: true, side: THREE.DoubleSide, depthWrite: false, roughness: 1 })));
      // Blocs de glace dans les anneaux : on peut les traverser… en slalomant
      const tilt = new THREE.Quaternion().setFromEuler(holder.rotation);
      rocks = join(rocks, rockField(scene, 6000, 82, rand => {
        let d;
        do d = s.ringIn + 60 + (s.ringOut - s.ringIn - 120) * rand(); while ((d - s.ringIn) / (s.ringOut - s.ringIn) > 0.6 && (d - s.ringIn) / (s.ringOut - s.ringIn) < 0.66);
        const a = rand() * 6.283;
        return [V(Math.cos(a) * d, (rand() - 0.5) * 24, Math.sin(a) * d).applyQuaternion(tilt).add(s.pos), 2 + 14 * rand() ** 3];
      }, 0xcfc4b0));
      planet(b('titan'), { map: TX.gas(83, { w: 512, h: 256, stops: [[0, [190, 130, 50]], [0.5, [216, 166, 78]], [1, [190, 130, 50]]], fine: 0.08 }) }, { atmo: ['#ffb347', 1.2, 2.5, 1.06] });
    },
    () => planet(b('uranus'), { map: TX.gas(91, { w: 512, h: 256, stops: [[0, [150, 205, 215]], [0.5, [176, 226, 234]], [1, [150, 205, 215]]], fine: 0.05 }) }, { atmo: ['#a8f0ff', 1, 2.6, 1.03] }),
    () => {
      planet(b('neptune'), { map: TX.gas(101, { w: 1024, h: 512, stops: [[0, [40, 70, 170]], [0.3, [60, 100, 210]], [0.45, [45, 80, 190]], [0.55, [70, 120, 225]], [0.7, [50, 85, 195]], [1, [35, 60, 160]]], spot: { lat: -0.35, lon: 2, w: 0.12, h: 0.06, color: [25, 40, 110] } }) }, { atmo: ['#5d8bff', 1.3, 2.6, 1.03] });
      planet(b('triton'), TX.rocky({ seed: 102, w: 256, h: 128, stops: ROCKY.triton, craters: 12 }));
    },
  ];
  let station;
  steps.push(() => { station = buildStation(); scene.add(station.g); });
  for (let i = 0; i < steps.length; i++) {
    steps[i]();
    progress((i + 1) / steps.length);
    await wait();
  }
  return {
    update(dt, t, camPos) {
      for (const [m, s] of spinners) m.rotation.y += s * dt;
      station.spin.rotation.y += 0.05 * dt;
      const on = Math.sin(t * 3) > 0.2;
      for (const b of station.beacons) b.visible = on;
      stars.position.copy(camPos); // le ciel suit la caméra : on ne l'atteint jamais
    },
  };
}
