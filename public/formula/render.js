// Rendu 3D de Top Formula, vu du dessus : piste, vibreurs, murs, tribunes, stands, décor selon le thème du circuit,
// monoplaces détaillées, traces de pneus, fumée, étincelles. Caméra qui suit la voiture et anticipe sa trajectoire.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { KERB } from './tracks.js';
import { CAR, steerMax } from './physics.js';

const THEMES = {
  city: { ground: '#8a8c8f', groundNoise: 18, runoff: '#6c7076', wall: ['#e8e8e8', '#d0352f'], sun: 2.6, hemi: 1.2, sky: '#b9d4ea', buildings: true, water: '#2f7fa8' },
  park: { ground: '#4f8f3a', groundNoise: 26, stripes: true, runoff: '#c9b48a', wall: ['#1d1d1f', '#e33b2f'], sun: 2.8, hemi: 1.1, sky: '#a9d2f0', trees: true, water: '#3a86a8' },
  night: { ground: '#1a1d24', groundNoise: 10, runoff: '#2b3039', wall: ['#cfd6e4', '#2d6bff'], sun: 0.6, hemi: 1.0, sky: '#05070d', buildings: true, lights: true, water: '#0b1f33' },
};

const rnd = (() => { let s = 1; return { seed: v => (s = v), next: () => ((s = (s * 16807) % 2147483647) / 2147483647) }; })();

function canvasTex(w, h, draw, repeat = true) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}
const noise = (g, w, h, base, amp, n = 6000, size = 2) => {
  g.fillStyle = base; g.fillRect(0, 0, w, h);
  for (let k = 0; k < n; k++) { const v = (Math.random() - 0.5) * amp; g.fillStyle = `rgba(${v > 0 ? '255,255,255' : '0,0,0'},${Math.abs(v) / 255})`; g.fillRect(Math.random() * w, Math.random() * h, size, size); }
};

// Bande qui suit le tracé, entre deux décalages latéraux (gauche +), découpée selon filter(i).
function strip(t, a, b, h, mat, { vScale = 0.1, filter = null, hB = h } = {}) {
  const pos = [], uv = [], idx = [], N = t.N;
  for (let i = 0; i <= N; i++) {
    const k = i % N, la = a(k), lb = b(k);
    pos.push(t.x[k] + t.nx[k] * la, h, t.y[k] + t.ny[k] * la, t.x[k] + t.nx[k] * lb, hB, t.y[k] + t.ny[k] * lb);
    uv.push(0, i * t.ds * vScale, 1, i * t.ds * vScale);
    if (i < N && (!filter || filter(k))) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, mat);
  m.receiveShadow = true;
  return m;
}

// Mur vertical (face + dessus) à un décalage donné.
function wall(t, off, height, faceMat, topMat, thick = 0.5) {
  const grp = new THREE.Group();
  const face = strip(t, off, off, 0, faceMat, { hB: height, vScale: 0.05 });
  const top = strip(t, off, i => off(i) + Math.sign(off(i)) * thick, height, topMat, { vScale: 0.25 });
  face.castShadow = true;
  grp.add(face, top);
  return grp;
}

// Index spatial des points du tracé, pour placer le décor sans empiéter sur la piste.
function spatial(t) {
  const cell = 25, map = new Map(), key = (a, b) => a * 100003 + b;
  for (let i = 0; i < t.N; i += 2) {
    const k = key(Math.floor(t.x[i] / cell), Math.floor(t.y[i] / cell));
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(i);
  }
  return (x, y, r) => { // true si le disque (x, y, r) ne touche ni la piste ni ses murs
    const cx = Math.floor(x / cell), cy = Math.floor(y / cell), span = Math.ceil((r + 30) / cell);
    for (let a = -span; a <= span; a++) for (let b = -span; b <= span; b++) {
      for (const i of map.get(key(cx + a, cy + b)) ?? []) if (Math.hypot(x - t.x[i], y - t.y[i]) < Math.max(t.wl[i], t.wr[i]) + r) return false;
    }
    return true;
  };
}
function inside(t, x, y) { // point dans la boucle du tracé
  let c = false;
  for (let i = 0, j = t.N - 1; i < t.N; j = i, i += 1) if ((t.y[i] > y) !== (t.y[j] > y) && x < (t.x[j] - t.x[i]) * (y - t.y[i]) / (t.y[j] - t.y[i]) + t.x[i]) c = !c;
  return c;
}

/* ---------------- Monoplace ---------------- */
const numberTex = new Map();
function numTex(n, color) {
  const key = n + color;
  if (!numberTex.has(key)) numberTex.set(key, canvasTex(128, 128, (g) => {
    g.fillStyle = '#fff'; g.beginPath(); g.arc(64, 64, 60, 0, 7); g.fill();
    g.fillStyle = color; g.font = '900 78px Inter, system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(n, 64, 70);
  }, false));
  return numberTex.get(key);
}
export function buildCar(look, { ghost = false } = {}) {
  const grp = new THREE.Group();
  const mat = c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.35, metalness: 0.25 });
  const body = mat(look.color), accent = mat(look.accent), dark = new THREE.MeshStandardMaterial({ color: '#16181c', roughness: 0.6, metalness: 0.3 });
  const carbon = new THREE.MeshStandardMaterial({ color: '#2a2d33', roughness: 0.45, metalness: 0.5 });
  // Coque vue de dessus : nez fin, pontons larges, arrière effilé.
  const s = new THREE.Shape();
  const P = [[2.55, 0], [1.7, 0.17], [0.75, 0.32], [0.35, 0.74], [-0.25, 0.8], [-1.2, 0.7], [-1.85, 0.36], [-2.25, 0.2]];
  s.moveTo(...P[0]);
  for (const p of P.slice(1)) s.lineTo(p[0], p[1]);
  for (const p of [...P].reverse()) s.lineTo(p[0], -p[1]);
  const shell = new THREE.ExtrudeGeometry(s, { depth: 0.32, bevelEnabled: true, bevelThickness: 0.14, bevelSize: 0.1, bevelSegments: 3, curveSegments: 2 });
  shell.rotateX(-Math.PI / 2);
  const hull = new THREE.Mesh(shell, body); hull.position.y = 0.2; grp.add(hull);
  // Capot moteur bombé + aileron de requin
  const cover = new THREE.Mesh(new THREE.CapsuleGeometry(0.3, 1.5, 4, 10), look.motif === 'split' ? accent : body);
  cover.rotation.z = Math.PI / 2; cover.scale.set(1, 1, 0.85); cover.position.set(-0.75, 0.62, 0); grp.add(cover);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.3, 0.05), accent); fin.position.set(-1.45, 0.78, 0); grp.add(fin);
  // Livrée
  if (look.motif === 'stripe') { const st = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.02, 0.22), accent); st.position.set(0.1, 0.68, 0); grp.add(st); }
  if (look.motif === 'arrow') for (const z of [-1, 1]) { const ar = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.04, 0.14), accent); ar.position.set(-0.1, 0.67, z * 0.5); ar.rotation.y = z * 0.45; grp.add(ar); }
  if (look.motif === 'split') { const sp = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.04, 1.45), accent); sp.position.set(-0.6, 0.63, 0); grp.add(sp); }
  // Cockpit, halo, casque
  const cock = new THREE.Mesh(new THREE.CircleGeometry(0.3, 16), dark); cock.rotation.x = -Math.PI / 2; cock.scale.set(1.7, 1, 1); cock.position.set(0.4, 0.67, 0); grp.add(cock);
  const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.2, 14, 10), mat(look.helmet ?? look.accent)); helmet.position.set(0.35, 0.72, 0); grp.add(helmet);
  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.07, 0.26), dark); visor.position.set(0.52, 0.76, 0); grp.add(visor);
  const halo = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.045, 6, 18, Math.PI), carbon); halo.rotation.set(-Math.PI / 2, 0, -Math.PI / 2); halo.position.set(0.48, 0.9, 0); grp.add(halo);
  const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.25, 0.06), carbon); pillar.position.set(0.82, 0.78, 0); grp.add(pillar);
  // Numéro
  const num = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.42), new THREE.MeshBasicMaterial({ map: numTex(look.number ?? 1, look.color), transparent: true }));
  num.rotation.x = -Math.PI / 2; num.rotation.z = -Math.PI / 2; num.position.set(1.45, 0.58, 0); grp.add(num);
  // Ailerons
  const fw = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.05, 2.05), accent); fw.position.set(2.3, 0.22, 0); grp.add(fw);
  const fw2 = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.05, 1.9), body); fw2.position.set(2.05, 0.3, 0); grp.add(fw2);
  for (const z of [-1, 1]) { const ep = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.22, 0.04), carbon); ep.position.set(2.25, 0.3, z * 1.03); grp.add(ep); }
  const rw = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.05, 1.55), body); rw.position.set(-2.2, 0.98, 0); grp.add(rw);
  const flap = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.04, 1.5), accent); flap.position.set(-2.0, 1.05, 0); grp.add(flap);
  for (const z of [-1, 1]) { const ep = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.6, 0.04), carbon); ep.position.set(-2.15, 0.78, z * 0.78); grp.add(ep); }
  const pylon = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.45, 0.06), carbon); pylon.position.set(-2.1, 0.72, 0); grp.add(pylon);
  // Feu arrière (s'allume sous la pluie… et la nuit)
  const rain = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.08, 0.16), new THREE.MeshStandardMaterial({ color: '#300', emissive: '#ff2a2a', emissiveIntensity: 0 }));
  rain.position.set(-2.4, 0.45, 0); grp.add(rain);
  // Roues
  const tyre = new THREE.MeshStandardMaterial({ color: '#141414', roughness: 0.9 });
  const rimM = new THREE.MeshStandardMaterial({ color: look.rim ?? '#c9ccd2', roughness: 0.3, metalness: 0.8 });
  const wheels = [], pivots = [];
  for (const [x, z, w, front] of [[1.55, 0.95, 0.36, true], [1.55, -0.95, 0.36, true], [-1.5, 0.93, 0.44, false], [-1.5, -0.93, 0.44, false]]) {
    const piv = new THREE.Group(); piv.position.set(x, 0.37, z);
    const wheel = new THREE.Group();
    const tg = new THREE.CylinderGeometry(0.37, 0.37, w, 18); tg.rotateX(Math.PI / 2);
    wheel.add(new THREE.Mesh(tg, tyre));
    const rim = new THREE.Mesh(new THREE.CircleGeometry(0.22, 12), rimM); rim.position.z = Math.sign(z) * (w / 2 + 0.005); rim.rotation.y = z > 0 ? 0 : Math.PI; wheel.add(rim);
    const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.06, 0.01), tyre); spoke.position.z = rim.position.z * 1.02; wheel.add(spoke);
    piv.add(wheel); grp.add(piv);
    wheels.push(wheel); if (front) pivots.push(piv);
    // bras de suspension
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.04, Math.abs(z) - 0.25), carbon); arm.position.set(x, 0.42, z / 2 + Math.sign(z) * 0.1); grp.add(arm);
  }
  grp.traverse(o => {
    if (!o.isMesh) return;
    o.castShadow = !ghost;
    if (ghost) { o.material = o.material.clone(); o.material.transparent = true; o.material.opacity = 0.35; o.material.depthWrite = false; }
  });
  return { group: grp, wheels, pivots, flap, rain };
}

/* ---------------- Scène ---------------- */
export function createView(canvas, t, { quality = 'high' } = {}) {
  const th = THEMES[t.def.theme];
  rnd.seed(t.N * 7 + 11);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, quality === 'low' ? 1 : 1.6));
  renderer.shadowMap.enabled = quality !== 'low' && !th.lights;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = th.lights ? 1.1 : 1.0;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(th.sky);
  const camera = new THREE.PerspectiveCamera(36, 1, 5, 900);
  camera.up.set(0, 0, -1);

  const hemi = new THREE.HemisphereLight(th.lights ? '#6d7fb0' : '#ffffff', th.lights ? '#10131a' : '#5c6b4a', th.hemi);
  const sun = new THREE.DirectionalLight(th.lights ? '#9fb4ff' : '#fff4e2', th.sun);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -110, right: 110, top: 110, bottom: -110, near: 10, far: 400 });
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.4;
  scene.add(hemi, sun, sun.target);

  // Sol
  const groundTex = canvasTex(512, 512, (g, w, h) => {
    noise(g, w, h, th.ground, th.groundNoise, 14000, 2);
    if (th.stripes) { g.fillStyle = 'rgba(255,255,255,.05)'; for (let k = 0; k < 8; k += 2) g.fillRect(0, k * h / 8, w, h / 8); }
  });
  groundTex.repeat.set(160, 160);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000), new THREE.MeshStandardMaterial({ map: groundTex, roughness: 0.95 }));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true;
  const cx = (Math.min(...t.x) + Math.max(...t.x)) / 2, cz = (Math.min(...t.y) + Math.max(...t.y)) / 2;
  ground.position.set(cx, 0, cz);
  scene.add(ground);

  // Piste
  const half = t.half;
  const asphalt = canvasTex(256, 256, (g, w, h) => noise(g, w, h, th.lights ? '#2e3138' : '#3b3e44', 34, 9000, 1.5));
  const trackMat = new THREE.MeshStandardMaterial({ map: asphalt, roughness: 0.85, metalness: 0.05 });
  scene.add(strip(t, () => half, () => -half, 0.03, trackMat, { vScale: 1 / 14 }));
  const rubber = new THREE.MeshBasicMaterial({ color: '#000', transparent: true, opacity: 0.18, depthWrite: false });
  scene.add(strip(t, i => t.line[i] + 1.6, i => t.line[i] - 1.6, 0.04, rubber));
  const white = new THREE.MeshStandardMaterial({ color: '#f2f2f2', roughness: 0.6 });
  scene.add(strip(t, () => half - 0.15, () => half - 0.5, 0.045, white), strip(t, () => -half + 0.5, () => -half + 0.15, 0.045, white));
  // Vibreurs rouge et blanc
  const kerbTex = canvasTex(16, 64, (g, w, h) => { g.fillStyle = '#e8322b'; g.fillRect(0, 0, w, h / 2); g.fillStyle = '#f4f4f4'; g.fillRect(0, h / 2, w, h / 2); });
  const kerbMat = new THREE.MeshStandardMaterial({ map: kerbTex, roughness: 0.55 });
  const kerbOn = i => t.kerb[i];
  scene.add(strip(t, () => half + KERB, () => half, 0.06, kerbMat, { vScale: 1 / 4, filter: kerbOn }), strip(t, () => -half, () => -half - KERB, 0.06, kerbMat, { vScale: 1 / 4, filter: kerbOn }));
  // Dégagements
  const runMat = new THREE.MeshStandardMaterial({ color: th.runoff, roughness: 0.95 });
  if (t.def.runoffKind === 'paved' || t.def.theme !== 'park') {
    scene.add(strip(t, i => t.wl[i], () => half + KERB, 0.02, runMat), strip(t, () => -half - KERB, i => -t.wr[i], 0.02, runMat));
  } else { // bacs à graviers à l'extérieur des virages
    const gravel = i => (t.wl[i] > half + KERB + t.def.runoff + 3) || (t.wr[i] > half + KERB + t.def.runoff + 3);
    scene.add(strip(t, i => t.wl[i] - 0.5, () => half + KERB + 2, 0.02, runMat, { filter: i => t.wl[i] > half + KERB + t.def.runoff + 3 }));
    scene.add(strip(t, () => -half - KERB - 2, i => -(t.wr[i] - 0.5), 0.02, runMat, { filter: i => t.wr[i] > half + KERB + t.def.runoff + 3 && gravel(i) }));
  }
  // Murs (dessus rayé)
  const wallTop = canvasTex(16, 64, (g, w, h) => { g.fillStyle = th.wall[0]; g.fillRect(0, 0, w, h / 2); g.fillStyle = th.wall[1]; g.fillRect(0, h / 2, w, h / 2); });
  const wallFace = new THREE.MeshStandardMaterial({ color: th.wall[0], roughness: 0.7, side: THREE.DoubleSide });
  const wallTopMat = new THREE.MeshStandardMaterial({ map: wallTop, roughness: 0.6, side: THREE.DoubleSide });
  scene.add(wall(t, i => t.wl[i], 1.1, wallFace, wallTopMat), wall(t, i => -t.wr[i], 1.1, wallFace, wallTopMat));

  // Ligne de départ, grille, portique des feux
  const checker = canvasTex(64, 16, (g) => { for (let a = 0; a < 16; a++) for (let b = 0; b < 4; b++) { g.fillStyle = (a + b) % 2 ? '#111' : '#fff'; g.fillRect(a * 4, b * 4, 4, 4); } }, false);
  const ang0 = Math.atan2(t.ty[0], t.tx[0]);
  const line = new THREE.Mesh(new THREE.PlaneGeometry(t.def.width, 1.6), new THREE.MeshStandardMaterial({ map: checker, roughness: 0.6 }));
  line.rotation.set(-Math.PI / 2, 0, -ang0 + Math.PI / 2); line.position.set(t.x[0], 0.05, t.y[0]); scene.add(line);
  for (let k = 0; k < 12; k++) {
    const back = 14 + k * 9 - 2.8, i = t.wrap(-Math.round(back / t.ds)), side = k % 2 ? -1 : 1, lat = side * half * 0.42;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 3), white);
    m.rotation.set(-Math.PI / 2, 0, -Math.atan2(t.ty[i], t.tx[i]) + Math.PI / 2); m.position.set(t.x[i] + t.nx[i] * lat, 0.05, t.y[i] + t.ny[i] * lat); scene.add(m);
  }
  const gantry = new THREE.Group();
  const span = t.wl[0] + t.wr[0] + 1;
  const beam = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.4, span), new THREE.MeshStandardMaterial({ color: '#222630', roughness: 0.5, metalness: 0.4 }));
  beam.castShadow = true; gantry.add(beam);
  const lamps = [];
  for (let k = 0; k < 5; k++) {
    const l = new THREE.Mesh(new THREE.CircleGeometry(0.42, 16), new THREE.MeshStandardMaterial({ color: '#200', emissive: '#ff1a1a', emissiveIntensity: 0 }));
    l.rotation.x = -Math.PI / 2; l.position.set(0, 0.72, (k - 2) * 1.2); gantry.add(l); lamps.push(l);
  }
  gantry.position.set(t.x[0] + t.tx[0] * 3 + t.nx[0] * (t.wl[0] - t.wr[0]) / 2, 8, t.y[0] + t.ty[0] * 3 + t.ny[0] * (t.wl[0] - t.wr[0]) / 2);
  gantry.rotation.y = -ang0;
  scene.add(gantry);

  // Décor
  const clear = spatial(t);
  const bbox = { x0: Math.min(...t.x) - 260, x1: Math.max(...t.x) + 260, y0: Math.min(...t.y) - 260, y1: Math.max(...t.y) + 260 };
  const waterAt = addWater(scene, t, th, clear, bbox);
  const freeSpot = (x, y, r) => clear(x, y, r) && !waterAt(x, y, r);
  const outside = Math.sign(inside(t, t.x[0] + t.nx[0] * 30, t.y[0] + t.ny[0] * 30) ? -1 : 1); // côté extérieur au départ (gauche = +1)
  addPits(scene, t, outside, th);
  const stands = addStands(scene, t, freeSpot, -outside);
  if (th.trees) addTrees(scene, freeSpot, bbox, stands);
  if (th.buildings) addBuildings(scene, t, th, freeSpot, stands);
  if (th.lights) addFloodlights(scene, t);

  // Effets : traces, fumée, étincelles
  const fx = createFx(scene);

  let composer = null;
  if (th.lights && quality !== 'low') {
    composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    composer.addPass(new UnrealBloomPass(new THREE.Vector2(512, 512), 0.7, 0.4, 0.92));
    composer.addPass(new OutputPass());
  }

  const cam = { x: t.x[0], z: t.y[0], h: 80, shake: 0, lx: 0, lz: 0 };
  const cars = new Map(); // id -> { mesh, prev }
  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    renderer.setSize(w, h, false);
    composer?.setSize(w, h);
    camera.aspect = w / h;
    // Écran en portrait : on recule pour garder de la visibilité sur les côtés.
    camera.fov = w < h ? 52 : 36;
    camera.updateProjectionMatrix();
  }

  return {
    renderer, scene, camera,
    addCar(id, look, opts) {
      const m = buildCar(look, opts);
      scene.add(m.group);
      cars.set(id, { m, rx: null, rz: null });
      if (th.lights) m.rain.material.emissiveIntensity = 2.2;
      return m;
    },
    removeCar(id) { const c = cars.get(id); if (c) scene.remove(c.m.group); cars.delete(id); },
    setLights(n) { lamps.forEach((l, k) => (l.material.emissiveIntensity = k < n ? 4 : 0)); },
    shake(v) { cam.shake = Math.min(1.6, cam.shake + v); },
    // Place les voitures, émet traces et fumée, suit la cible avec la caméra.
    update(list, follow, dt, time) {
      for (const car of list) {
        const c = cars.get(car.id);
        if (!c) continue;
        const g = c.m.group;
        g.visible = !car.hidden;
        g.position.set(car.x, 0, car.y);
        g.rotation.y = -car.a;
        const spin = (car.speed || 0) * dt / 0.37;
        for (const w of c.m.wheels) w.rotation.z -= spin;
        const st = (car.steer || 0) * steerMax(car.speed || 0) * 1.8;
        for (const p of c.m.pivots) p.rotation.y = st;
        c.m.flap.rotation.x = 0; c.m.flap.scale.x = car.drsOpen ? 0.35 : 1;
        if (car.ghost || car.hidden) continue;
        // Traces de pneus et fumée quand ça glisse
        const fxx = Math.cos(car.a), fyy = Math.sin(car.a);
        const rear = [-1, 1].map(s => [car.x - fxx * 1.5 + fyy * 0.93 * s, car.y - fyy * 1.5 - fxx * 0.93 * s]);
        if (car.skid > 2.2 && c.rear) for (let k = 0; k < 2; k++) fx.skid(c.rear[k][0], c.rear[k][1], rear[k][0], rear[k][1]);
        c.rear = rear;
        if (car.skid > 3) for (const r of rear) if (Math.random() < Math.min(0.9, car.skid * 0.06)) fx.smoke(r[0], r[1], 0.8, 1);
        if ((car.surface === 'grass' || car.surface === 'sand') && Math.abs(car.speed) > 8 && Math.random() < 0.5) fx.smoke(rear[0][0], rear[0][1], 0.6, 0, car.surface === 'sand' ? '#cbb68c' : '#6b5a3a');
        if (car.drsOpen && Math.random() < 0.3) fx.trail(car.x - fxx * 2.4, car.y - fyy * 2.4);
      }
      fx.update(dt);
      // Caméra : un peu en avant de la voiture, plus haute quand on va vite.
      if (follow) {
        const sp = Math.hypot(follow.vx || 0, follow.vy || 0);
        const ax = Math.max(-38, Math.min(38, (follow.vx || 0) * 0.55)), az = Math.max(-38, Math.min(38, (follow.vy || 0) * 0.55));
        cam.lx += (ax - cam.lx) * Math.min(1, dt * 2.2); cam.lz += (az - cam.lz) * Math.min(1, dt * 2.2);
        const k = Math.min(1, dt * 7);
        cam.x += (follow.x + cam.lx - cam.x) * k; cam.z += (follow.y + cam.lz - cam.z) * k;
        cam.h += (62 + sp * 0.8 - cam.h) * Math.min(1, dt * 1.5);
      }
      cam.shake *= Math.exp(-dt * 6);
      const sx = (Math.random() - 0.5) * cam.shake, sz = (Math.random() - 0.5) * cam.shake;
      camera.position.set(cam.x + sx, cam.h, cam.z + cam.h * 0.18 + sz);
      camera.lookAt(cam.x + sx, 0, cam.z + sz);
      sun.position.set(cam.x - 60, 140, cam.z - 45); sun.target.position.set(cam.x, 0, cam.z);
    },
    fx,
    resize,
    render() { composer ? composer.render() : renderer.render(scene, camera); },
    dispose() { renderer.dispose(); },
  };
}

/* ---------------- Décor ---------------- */
function addWater(scene, t, th, clear, bbox) {
  const mat = new THREE.MeshStandardMaterial({ color: th.water, roughness: 0.15, metalness: 0.35, transparent: true, opacity: 0.94 });
  const tests = [];
  if (t.def.water === 'south') { // port au sud de la ligne droite
    const y0 = Math.max(...t.y) + Math.max(...t.wl, ...t.wr) + 26;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(bbox.x1 - bbox.x0 + 1200, 900), mat);
    m.rotation.x = -Math.PI / 2; m.position.set((bbox.x0 + bbox.x1) / 2, 0.05, y0 + 450); scene.add(m);
    // quai
    const quay = new THREE.Mesh(new THREE.BoxGeometry(bbox.x1 - bbox.x0 + 1200, 0.6, 3), new THREE.MeshStandardMaterial({ color: '#c8c2b4', roughness: 0.9 }));
    quay.position.set((bbox.x0 + bbox.x1) / 2, 0.3, y0); quay.receiveShadow = true; scene.add(quay);
    addBoats(scene, bbox.x0 + 150, bbox.x1 - 150, y0 + 14, y0 + 140, th);
    tests.push((x, y, r) => y + r > y0 - 4);
  }
  if (t.def.water === 'lake') { // lac au milieu du circuit, là où il y a le plus de place
    let best = null;
    for (let x = bbox.x0 + 260; x < bbox.x1 - 260; x += 12) for (let y = bbox.y0 + 260; y < bbox.y1 - 260; y += 12) {
      if (!inside(t, x, y)) continue;
      let d = Infinity; for (let i = 0; i < t.N; i += 3) d = Math.min(d, Math.hypot(x - t.x[i], y - t.y[i]) - Math.max(t.wl[i], t.wr[i]));
      if (!best || d > best.d) best = { x, y, d };
    }
    if (best && best.d > 40) {
      const r = best.d - 22, m = new THREE.Mesh(new THREE.CircleGeometry(1, 48), mat);
      m.rotation.x = -Math.PI / 2; m.scale.set(r * 1.25, r * 0.85, 1); m.position.set(best.x, 0.05, best.y); scene.add(m);
      const shore = new THREE.Mesh(new THREE.RingGeometry(1, 1.06, 48), new THREE.MeshStandardMaterial({ color: '#d8c79a', roughness: 1 }));
      shore.rotation.x = -Math.PI / 2; shore.scale.set(r * 1.25, r * 0.85, 1); shore.position.set(best.x, 0.06, best.y); scene.add(shore);
      tests.push((x, y, rr) => ((x - best.x) / (r * 1.25 + rr + 4)) ** 2 + ((y - best.y) / (r * 0.85 + rr + 4)) ** 2 < 1);
      addBoats(scene, best.x - r * 0.6, best.x + r * 0.6, best.y - r * 0.4, best.y + r * 0.4, th, 5);
    }
  }
  return (x, y, r) => tests.some(f => f(x, y, r));
}

function addBoats(scene, x0, x1, y0, y1, th, n = 14) {
  const hull = new THREE.MeshStandardMaterial({ color: '#f4f4f2', roughness: 0.4 }), deck = new THREE.MeshStandardMaterial({ color: '#b98a5a', roughness: 0.7 });
  const glass = new THREE.MeshStandardMaterial({ color: '#1b2a3a', emissive: th.lights ? '#ffd27a' : '#000', emissiveIntensity: th.lights ? 1.4 : 0, roughness: 0.2 });
  for (let k = 0; k < n; k++) {
    const g = new THREE.Group(), L = 10 + rnd.next() * 26;
    const s = new THREE.Shape(); s.moveTo(L / 2, 0); s.quadraticCurveTo(L * 0.2, L * 0.13, -L / 2, L * 0.12); s.lineTo(-L / 2, -L * 0.12); s.quadraticCurveTo(L * 0.2, -L * 0.13, L / 2, 0);
    const geo = new THREE.ExtrudeGeometry(s, { depth: 1.4, bevelEnabled: false }); geo.rotateX(-Math.PI / 2);
    const h = new THREE.Mesh(geo, hull); h.castShadow = true; g.add(h);
    const d = new THREE.Mesh(new THREE.BoxGeometry(L * 0.35, 0.3, L * 0.14), deck); d.position.set(-L * 0.25, 1.5, 0); g.add(d);
    const c = new THREE.Mesh(new THREE.BoxGeometry(L * 0.32, 1.4, L * 0.15), hull); c.position.set(L * 0.05, 2.1, 0); c.castShadow = true; g.add(c);
    const w = new THREE.Mesh(new THREE.BoxGeometry(L * 0.2, 0.5, L * 0.155), glass); w.position.set(L * 0.1, 2.3, 0); g.add(w);
    g.position.set(x0 + rnd.next() * (x1 - x0), 0, y0 + rnd.next() * (y1 - y0));
    g.rotation.y = rnd.next() < 0.7 ? Math.PI / 2 + (rnd.next() - 0.5) * 0.3 : rnd.next() * 6;
    scene.add(g);
  }
}

function addPits(scene, t, side, th) {
  // Bâtiment des stands le long de la ligne droite de départ, avec voie des stands et toit peint.
  const i = t.wrap(-Math.round(60 / t.ds)), w = side > 0 ? t.wl[i] : t.wr[i], off = side * (w + 16);
  const ang = Math.atan2(t.ty[i], t.tx[i]);
  const g = new THREE.Group();
  const lane = new THREE.Mesh(new THREE.PlaneGeometry(170, 10), new THREE.MeshStandardMaterial({ color: th.lights ? '#2a2d34' : '#44474d', roughness: 0.9 }));
  lane.rotation.x = -Math.PI / 2; lane.receiveShadow = true;
  const roof = canvasTex(1024, 96, (c, W, H) => {
    c.fillStyle = '#e9ecf1'; c.fillRect(0, 0, W, H); c.fillStyle = '#d92b2b'; c.fillRect(0, H - 14, W, 14);
    c.fillStyle = '#1b1f2a'; c.font = '900 54px Inter, system-ui, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText('TOP FORMULA', W / 2, H / 2 - 4);
  }, false);
  const mats = [0, 1, 2, 3, 4, 5].map(k => k === 2 ? new THREE.MeshStandardMaterial({ map: roof, roughness: 0.6 }) : new THREE.MeshStandardMaterial({ color: '#cfd4dc', roughness: 0.7 }));
  const bld = new THREE.Mesh(new THREE.BoxGeometry(170, 9, 16), mats);
  bld.position.set(0, 4.5, 0); bld.castShadow = bld.receiveShadow = true;
  // Portes des garages, couleurs des écuries
  const teams = ['#e10600', '#00d2be', '#ff8700', '#0600ef', '#006f62', '#f596c8', '#2b4562', '#b6babd', '#52e252', '#ffd400'];
  teams.forEach((c, k) => {
    const d = new THREE.Mesh(new THREE.PlaneGeometry(12, 5), new THREE.MeshStandardMaterial({ color: c, roughness: 0.5 }));
    d.position.set(-72 + k * 16, 2.6, 8.05); g.add(d);
  });
  g.add(bld);
  lane.position.set(0, 0.04, 13);
  g.add(lane);
  const pitWall = new THREE.Mesh(new THREE.BoxGeometry(170, 1.2, 0.6), new THREE.MeshStandardMaterial({ color: '#dfe3e8' }));
  pitWall.position.set(0, 0.6, 18.5); pitWall.castShadow = true; g.add(pitWall);
  // Le groupe est construit « porte vers +z » : on le tourne pour que les portes regardent la piste.
  g.position.set(t.x[i] + t.nx[i] * (off + side * 7), 0, t.y[i] + t.ny[i] * (off + side * 7));
  g.rotation.y = -ang + (side < 0 ? Math.PI : 0);
  scene.add(g);
}

function addStands(scene, t, free, side) {
  // Tribunes le long des lignes droites, côté opposé aux stands, avec une foule colorée.
  const placed = [], crowdGeo = new THREE.BoxGeometry(0.55, 0.9, 0.55), stepMat = new THREE.MeshStandardMaterial({ color: '#9aa1ab', roughness: 0.8 });
  const roofMat = new THREE.MeshStandardMaterial({ color: '#f1f3f6', roughness: 0.5, transparent: true, opacity: 0.0 });
  const people = [], colors = ['#e63946', '#f1faee', '#ffb703', '#219ebc', '#8ecae6', '#fb8500', '#2a9d8f', '#e9c46a', '#ffffff', '#264653'];
  const candidates = [];
  for (let i = 0; i < t.N; i += 6) if (Math.abs(t.curv[i]) < 0.002 && Math.abs(t.curv[t.wrap(i + 20)]) < 0.002 && Math.abs(t.curv[t.wrap(i - 20)]) < 0.002) candidates.push(i);
  const want = [0, ...candidates.filter(i => i > 40)];
  for (const i0 of want) {
    if (placed.length >= 5) break;
    const i = t.wrap(i0 - (i0 === 0 ? Math.round(10 / t.ds) : 0));
    for (const s of i0 === 0 ? [side] : [side, -side]) {
      const L = 60, D = 14, w = s > 0 ? t.wl[i] : t.wr[i], off = s * (w + 4 + D / 2);
      const x = t.x[i] + t.nx[i] * off, y = t.y[i] + t.ny[i] * off;
      if (!free(x, y, D / 2 + 1) || placed.some(p => Math.hypot(p.x - x, p.y - y) < 90)) continue;
      const okEnds = [-1, 1].every(e => free(x + t.tx[i] * e * L / 2, y + t.ty[i] * e * L / 2, D / 2));
      if (!okEnds) continue;
      const g = new THREE.Group();
      for (let r = 0; r < 6; r++) {
        const st = new THREE.Mesh(new THREE.BoxGeometry(L, 1 + r * 0.9, D / 6), stepMat);
        st.position.set(0, (1 + r * 0.9) / 2, -D / 2 + (r + 0.5) * D / 6); st.castShadow = st.receiveShadow = true; g.add(st);
        for (let k = 0; k < 70; k++) if (rnd.next() < 0.85) people.push({ g, x: -L / 2 + 0.6 + k * (L - 1.2) / 70, y: 1 + r * 0.9 + 0.45, z: -D / 2 + (r + 0.5) * D / 6, c: colors[Math.floor(rnd.next() * colors.length)] });
      }
      const roof = new THREE.Mesh(new THREE.BoxGeometry(L, 0.3, D), roofMat); roof.position.set(0, 7.5, 0); g.add(roof);
      g.position.set(x, 0, y);
      // l'arrière (z+) s'éloigne de la piste
      const ang = Math.atan2(t.ty[i], t.tx[i]);
      g.rotation.y = -ang + (s > 0 ? Math.PI : 0);
      scene.add(g);
      placed.push({ x, y, r: L / 2 + 4 });
    }
  }
  // Foule en une seule instance par tribune
  const byStand = new Map();
  for (const p of people) { if (!byStand.has(p.g)) byStand.set(p.g, []); byStand.get(p.g).push(p); }
  for (const [g, list] of byStand) {
    const im = new THREE.InstancedMesh(crowdGeo, new THREE.MeshStandardMaterial({ roughness: 0.8 }), list.length);
    const m = new THREE.Matrix4(), col = new THREE.Color();
    list.forEach((p, k) => { m.makeTranslation(p.x, p.y, p.z); im.setMatrixAt(k, m); im.setColorAt(k, col.set(p.c)); });
    im.castShadow = true;
    g.add(im);
  }
  return placed;
}

function addTrees(scene, free, bbox, stands) {
  const geo = new THREE.IcosahedronGeometry(1, 1), list = [];
  for (let k = 0; k < 2600 && list.length < 700; k++) {
    const x = bbox.x0 + rnd.next() * (bbox.x1 - bbox.x0), y = bbox.y0 + rnd.next() * (bbox.y1 - bbox.y0), r = 2.5 + rnd.next() * 3.5;
    if (!free(x, y, r + 6) || stands.some(s => Math.hypot(s.x - x, s.y - y) < s.r + r)) continue;
    // en bosquets : on garde surtout les arbres proches d'un autre
    if (list.length > 40 && rnd.next() < 0.6 && !list.some(o => Math.hypot(o.x - x, o.y - y) < 14)) continue;
    list.push({ x, y, r });
  }
  const im = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ roughness: 0.85, flatShading: true }), list.length);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), col = new THREE.Color();
  list.forEach((p, k) => {
    m.compose(new THREE.Vector3(p.x, p.r * 1.3, p.y), q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rnd.next() * 6), new THREE.Vector3(p.r, p.r * 0.9, p.r));
    im.setMatrixAt(k, m); im.setColorAt(k, col.setHSL(0.27 + rnd.next() * 0.08, 0.45 + rnd.next() * 0.2, 0.22 + rnd.next() * 0.12));
  });
  im.castShadow = true; im.receiveShadow = true;
  scene.add(im);
}

function addBuildings(scene, t, th, free, stands) {
  // Immeubles alignés le long des rues du circuit, puis une seconde rangée.
  const list = [];
  for (const row of [0, 1]) for (let i = 0; i < t.N; i += 7) for (const s of [1, -1]) {
    const L = 12 + rnd.next() * 14, D = 12 + rnd.next() * 14, H = th.lights ? 10 + rnd.next() * 50 : 9 + rnd.next() * 22;
    const w = s > 0 ? t.wl[i] : t.wr[i], off = s * (w + 7 + D / 2 + row * 30);
    const x = t.x[i] + t.nx[i] * off, y = t.y[i] + t.ny[i] * off, r = Math.max(L, D) / 2;
    if (!free(x, y, r * 0.8 + 3) || stands.some(p => Math.hypot(p.x - x, p.y - y) < p.r + r) || list.some(b => Math.hypot(b.x - x, b.y - y) < (b.r + r) * 0.85)) continue;
    list.push({ x, y, r, L, D, H, a: Math.atan2(t.ty[i], t.tx[i]) });
  }
  // Façades : fenêtres sur fond blanc (teinté par la couleur de l'immeuble) ; la nuit, seules les fenêtres allumées brillent.
  const lit = Array.from({ length: 40 }, () => Math.random() < 0.5);
  const win = canvasTex(64, 128, (g, w, h) => {
    g.fillStyle = '#fff'; g.fillRect(0, 0, w, h);
    for (let a = 0; a < 4; a++) for (let b = 0; b < 10; b++) { g.fillStyle = th.lights ? '#1a1f2b' : '#9fb6c9'; g.fillRect(4 + a * 15, 5 + b * 12, 9, 7); }
  });
  const emis = th.lights ? canvasTex(64, 128, (g, w, h) => {
    g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
    for (let a = 0; a < 4; a++) for (let b = 0; b < 10; b++) if (lit[a * 10 + b]) { g.fillStyle = '#ffd58a'; g.fillRect(4 + a * 15, 5 + b * 12, 9, 7); }
  }) : null;
  const mat = new THREE.MeshStandardMaterial({ map: win, roughness: 0.75, emissiveMap: emis, emissive: th.lights ? '#ffffff' : '#000000', emissiveIntensity: th.lights ? 1.2 : 0 });
  const roofMat = new THREE.MeshStandardMaterial({ roughness: 0.9 });
  const box = new THREE.BoxGeometry(1, 1, 1);
  const im = new THREE.InstancedMesh(box, mat, list.length), roofs = new THREE.InstancedMesh(box, roofMat, list.length * 3);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), col = new THREE.Color(), Y = new THREE.Vector3(0, 1, 0);
  const palette = th.lights ? ['#4b5a74', '#39465c', '#5d6b85', '#2f3a4e'] : ['#f2e6cf', '#e9d2b0', '#f5efe4', '#e7c7a0', '#d9b48e', '#efe0c6', '#cfd6dc'];
  list.forEach((b, k) => {
    q.setFromAxisAngle(Y, -b.a);
    m.compose(new THREE.Vector3(b.x, b.H / 2, b.y), q, new THREE.Vector3(b.L, b.H, b.D));
    im.setMatrixAt(k, m); im.setColorAt(k, col.set(palette[Math.floor(rnd.next() * palette.length)]));
    // toit : terrasse + deux blocs techniques
    for (let r = 0; r < 3; r++) {
      const sx = r ? 2 + rnd.next() * 3 : b.L * 0.86, sz = r ? 2 + rnd.next() * 3 : b.D * 0.86, sy = r ? 1.2 : 0.3;
      const ox = r ? (rnd.next() - 0.5) * b.L * 0.6 : 0, oz = r ? (rnd.next() - 0.5) * b.D * 0.6 : 0;
      const p = new THREE.Vector3(ox, 0, oz).applyQuaternion(q);
      m.compose(new THREE.Vector3(b.x + p.x, b.H + sy / 2, b.y + p.z), q, new THREE.Vector3(sx, sy, sz));
      roofs.setMatrixAt(k * 3 + r, m);
      roofs.setColorAt(k * 3 + r, col.set(r ? '#9ca3ad' : th.lights ? '#283246' : ['#c96f4a', '#b7b1a6', '#d08a5c', '#a9a39a'][Math.floor(rnd.next() * 4)]));
    }
  });
  im.castShadow = im.receiveShadow = true; roofs.castShadow = true; roofs.receiveShadow = true;
  scene.add(im, roofs);
}

function addFloodlights(scene, t) {
  // Grand prix de nuit : mâts d'éclairage le long des murs et flaques de lumière sur la piste.
  const pool = canvasTex(128, 128, (g, w) => {
    const r = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    r.addColorStop(0, 'rgba(255,244,214,.2)'); r.addColorStop(0.5, 'rgba(255,240,200,.07)'); r.addColorStop(1, 'rgba(255,240,200,0)');
    g.fillStyle = r; g.fillRect(0, 0, w, w);
  }, false);
  const poolMat = new THREE.MeshBasicMaterial({ map: pool, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  const head = new THREE.MeshStandardMaterial({ color: '#fff', emissive: '#fff6e0', emissiveIntensity: 3 });
  const pole = new THREE.MeshStandardMaterial({ color: '#222', roughness: 0.6 });
  const n = Math.floor(t.N / 16), heads = new THREE.InstancedMesh(new THREE.BoxGeometry(2.2, 0.5, 1.2), head, n), poles = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.2, 0.25, 12, 6), pole, n);
  const pools = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), poolMat, n);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), Y = new THREE.Vector3(0, 1, 0), X = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);
  for (let k = 0; k < n; k++) {
    const i = k * 16, s = k % 2 ? 1 : -1, w = (s > 0 ? t.wl[i] : t.wr[i]) + 1.5;
    const x = t.x[i] + t.nx[i] * w * s, y = t.y[i] + t.ny[i] * w * s;
    q.setFromAxisAngle(Y, -Math.atan2(t.ty[i], t.tx[i]));
    m.compose(new THREE.Vector3(x, 6, y), q, new THREE.Vector3(1, 1, 1)); poles.setMatrixAt(k, m);
    m.compose(new THREE.Vector3(x - t.nx[i] * s * 1.2, 12, y - t.ny[i] * s * 1.2), q, new THREE.Vector3(1, 1, 1)); heads.setMatrixAt(k, m);
    m.compose(new THREE.Vector3(t.x[i] + t.nx[i] * s * 2, 0.08, t.y[i] + t.ny[i] * s * 2), X, new THREE.Vector3(34, 34, 1)); pools.setMatrixAt(k, m);
  }
  scene.add(heads, poles, pools);
}

/* ---------------- Effets ---------------- */
function createFx(scene) {
  // Traces de pneus : anneau de quadrilatères réutilisés.
  const MAX = 2400, pos = new Float32Array(MAX * 4 * 3), idx = [];
  for (let k = 0; k < MAX; k++) idx.push(k * 4, k * 4 + 1, k * 4 + 2, k * 4 + 1, k * 4 + 3, k * 4 + 2);
  const sg = new THREE.BufferGeometry();
  sg.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  sg.setIndex(idx);
  const skidMesh = new THREE.Mesh(sg, new THREE.MeshBasicMaterial({ color: '#000', transparent: true, opacity: 0.32, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
  skidMesh.frustumCulled = false; skidMesh.renderOrder = 1;
  scene.add(skidMesh);
  let sk = 0, dirty = false;

  // Particules : fumée (normale) et étincelles (additives), même principe.
  const sprite = canvasTex(64, 64, (g, w) => { const r = g.createRadialGradient(32, 32, 0, 32, 32, 32); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, w, w); }, false);
  const pointsMat = additive => new THREE.ShaderMaterial({
    uniforms: { map: { value: sprite }, scale: { value: 600 } }, transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    vertexShader: 'attribute float size; attribute vec4 color; varying vec4 vC; uniform float scale; void main(){ vC=color; vec4 mv=modelViewMatrix*vec4(position,1.); gl_PointSize=size*scale/-mv.z; gl_Position=projectionMatrix*mv; }',
    fragmentShader: 'uniform sampler2D map; varying vec4 vC; void main(){ vec4 t=texture2D(map,gl_PointCoord); gl_FragColor=vec4(vC.rgb, vC.a*t.a); }',
  });
  const system = (n, additive) => {
    const g = new THREE.BufferGeometry();
    const P = new Float32Array(n * 3), S = new Float32Array(n), C = new Float32Array(n * 4);
    g.setAttribute('position', new THREE.BufferAttribute(P, 3)); g.setAttribute('size', new THREE.BufferAttribute(S, 1)); g.setAttribute('color', new THREE.BufferAttribute(C, 4));
    const pts = new THREE.Points(g, pointsMat(additive)); pts.frustumCulled = false; scene.add(pts);
    return { g, P, S, C, list: Array.from({ length: n }, () => ({ life: 0 })), next: 0 };
  };
  const smoke = system(600, false), sparks = system(400, true);
  const col = new THREE.Color();
  const emit = (sys, p) => { const o = sys.list[sys.next]; sys.next = (sys.next + 1) % sys.list.length; Object.assign(o, p, { age: 0 }); };
  const step = (sys, dt, gravity) => {
    sys.list.forEach((o, k) => {
      if (o.life <= 0) { sys.S[k] = 0; return; }
      o.age += dt;
      if (o.age >= o.life) { o.life = 0; sys.S[k] = 0; return; }
      const f = o.age / o.life;
      o.x += o.vx * dt; o.y += o.vy * dt; o.z += o.vz * dt; o.vz -= gravity * dt;
      if (o.z < 0.1) { o.z = 0.1; o.vz *= -0.4; }
      const damp = Math.exp(-dt * o.drag); o.vx *= damp; o.vy *= damp;
      sys.P.set([o.x, o.z, o.y], k * 3);
      sys.S[k] = o.size0 + (o.size1 - o.size0) * f;
      col.set(o.color);
      sys.C.set([col.r, col.g, col.b, o.alpha * (1 - f) * Math.min(1, f * 8)], k * 4);
    });
    for (const a of ['position', 'size', 'color']) sys.g.attributes[a].needsUpdate = true;
  };
  return {
    skid(x1, y1, x2, y2) {
      const dx = x2 - x1, dy = y2 - y1, l = Math.hypot(dx, dy);
      if (l < 0.05 || l > 4) return;
      const nx = -dy / l * 0.2, ny = dx / l * 0.2, o = sk * 12;
      pos.set([x1 + nx, 0.065, y1 + ny, x1 - nx, 0.065, y1 - ny, x2 + nx, 0.065, y2 + ny, x2 - nx, 0.065, y2 - ny], o);
      sk = (sk + 1) % MAX; dirty = true;
    },
    smoke(x, y, amount = 1, heat = 1, color = '#d8d8d8') {
      emit(smoke, { x, y, z: 0.4, vx: (Math.random() - 0.5) * 3, vy: (Math.random() - 0.5) * 3, vz: 1 + Math.random(), life: 0.9 + Math.random() * 0.8 * amount, size0: 1.2, size1: 4.5 * amount + heat, alpha: 0.45, color, drag: 2 });
    },
    trail(x, y) { emit(smoke, { x, y, z: 0.9, vx: 0, vy: 0, vz: 0, life: 0.35, size0: 0.6, size1: 1.6, alpha: 0.25, color: '#bfe3ff', drag: 1 }); },
    sparks(x, y, power) {
      const n = Math.min(40, 6 + power * 2);
      for (let k = 0; k < n; k++) {
        const a = Math.random() * 6.28, v = 4 + Math.random() * power * 0.8;
        emit(sparks, { x, y, z: 0.5, vx: Math.cos(a) * v, vy: Math.sin(a) * v, vz: 2 + Math.random() * 5, life: 0.25 + Math.random() * 0.4, size0: 0.5, size1: 0.15, alpha: 1, color: Math.random() < 0.5 ? '#ffd27a' : '#ff8a3a', drag: 1.5 });
      }
    },
    update(dt) {
      if (dirty) { sg.attributes.position.needsUpdate = true; dirty = false; }
      step(smoke, dt, -0.6); step(sparks, dt, 14);
    },
  };
}
