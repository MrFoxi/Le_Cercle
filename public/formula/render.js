// Rendu 3D de Top Formula, vu du dessus. Assemble la piste (asphalte, gomme, vibreurs, dégagements, murs, panneaux),
// le décor (decor.js), les monoplaces (car.js) et les effets (fx.js) ; éclairage selon le moment (jour, coucher de soleil, nuit)
// et la météo ; post-traitement : occlusion ambiante, bloom, étalonnage des couleurs, chaleur au-dessus des échappements.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { KERB } from './tracks.js';
import { steerMax, CAR } from './physics.js';
import { speedProfile } from './ai.js';
import { gearOf } from './audio.js';
import { buildCar } from './car.js';
import { createFx } from './fx.js';
import * as D from './decor.js';
import * as TX from './textures.js';

export { buildCar };

const THEMES = {
  city: { wall: ['#e8e8e8', '#d0352f'], water: '#2f7fa8', buildings: true },
  park: { wall: ['#1d1d1f', '#e33b2f'], water: '#3a86a8', trees: true },
  night: { wall: ['#cfd6e4', '#2d6bff'], water: '#0b1f33', buildings: true, lights: true },
};
// Ambiance : soleil, ciel, reflets, étalonnage. Le thème « night » reste de nuit quel que soit le moment choisi.
function mood(theme, time, wet) {
  const m = theme === 'night'
    ? { sky: '#05070d', sun: ['#9fb4ff', 0.6, [0.3, 1, 0.2]], hemi: ['#6d7fb0', '#10131a', 1.0], env: 0.25, exposure: 1.1, tint: [0.95, 0.98, 1.08], sat: 1.15, contrast: 1.08, bloom: [0.75, 0.8] }
    : time === 'sunset'
      ? { sky: '#e9925e', sun: ['#ffad6a', 2.3, [-1, 0.34, -0.2]], hemi: ['#ffc39a', '#3c3050', 0.6], env: 0.3, exposure: 0.95, tint: [1.1, 0.96, 0.86], sat: 1.12, contrast: 1.1, bloom: [0.2, 1.4] }
      : { sky: '#a9d2f0', sun: ['#fff4e2', 2.4, [-0.45, 1, -0.35]], hemi: ['#ffffff', '#5c6b4a', 0.75], env: 0.32, exposure: 0.92, tint: [1.02, 1.0, 0.97], sat: 1.12, contrast: 1.1, bloom: [0.08, 1.6] };
  if (wet) Object.assign(m, { sky: theme === 'night' ? '#05070d' : '#8d97a3', sun: [m.sun[0], m.sun[1] * 0.4, m.sun[2]], hemi: [theme === 'night' ? m.hemi[0] : '#c9d3df', m.hemi[1], theme === 'night' ? m.hemi[2] : 0.8], env: m.env * 1.5, exposure: theme === 'night' ? m.exposure : 0.85, tint: [0.95, 0.99, 1.05], sat: 0.85, bloom: theme === 'night' ? m.bloom : [0.06, 1.6] });
  return m;
}

// Bande qui suit le tracé (à la hauteur de la piste), entre deux décalages latéraux (gauche +).
function strip(t, a, b, y, mat, { vScale = 0.1, filter = null, yB = y, world = false, alpha = null } = {}) {
  const pos = [], uv = [], col = [], idx = [], N = t.N;
  for (let i = 0; i <= N; i++) {
    const k = i % N, la = a(k), lb = b(k), h = t.h[k];
    const xa = t.x[k] + t.nx[k] * la, za = t.y[k] + t.ny[k] * la, xb = t.x[k] + t.nx[k] * lb, zb = t.y[k] + t.ny[k] * lb;
    pos.push(xa, h + y, za, xb, h + yB, zb);
    if (world) uv.push(xa / 25, -za / 25, xb / 25, -zb / 25); else uv.push(0, i * t.ds * vScale, 1, i * t.ds * vScale);
    if (alpha) { const al = alpha(k); col.push(1, 1, 1, al, 1, 1, 1, al); }
    if (i < N && (!filter || filter(k))) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  if (alpha) g.setAttribute('color', new THREE.Float32BufferAttribute(col, 4));
  g.setIndex(idx);
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, mat);
  m.receiveShadow = true;
  return m;
}

export function createView(canvas, t, { quality = 'high', weather = 'dry', time = 'day' } = {}) {
  const th = THEMES[t.def.theme], low = quality === 'low', wet = weather === 'rain', night = !!th.lights;
  const md = mood(t.def.theme, time, wet);
  D.rnd.seed(t.N * 7 + 11);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, low ? 1 : 1.6));
  renderer.shadowMap.enabled = !low;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = md.exposure;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(md.sky);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = md.env;
  const camera = new THREE.PerspectiveCamera(36, 1, 5, 1600);
  camera.up.set(0, 0, -1);
  const uTime = { value: 0 };

  const hemi = new THREE.HemisphereLight(md.hemi[0], md.hemi[1], md.hemi[2]);
  const sun = new THREE.DirectionalLight(md.sun[0], md.sun[1]);
  const sunDir = new THREE.Vector3(...md.sun[2]).normalize();
  sun.castShadow = !night;
  sun.shadow.mapSize.set(low ? 1024 : 2048, low ? 1024 : 2048);
  Object.assign(sun.shadow.camera, { left: -120, right: 120, top: 120, bottom: -120, near: 10, far: 900 });
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.5;
  scene.add(hemi, sun, sun.target);

  /* ---------- Terrain et piste ---------- */
  const hf = D.heightField(t);
  const bbox = { x0: Math.min(...t.x) - 260, x1: Math.max(...t.x) + 260, y0: Math.min(...t.y) - 260, y1: Math.max(...t.y) + 260 };
  const groundMap = t.def.theme === 'park' ? TX.grass() : TX.pavement(night);
  const groundMat = new THREE.MeshStandardMaterial({ map: groundMap, roughness: wet ? 0.5 : 0.95, color: wet ? '#b8bdc4' : '#ffffff' });
  D.terrain(scene, t, hf, groundMat, bbox, low);

  const half = t.half;
  const trackMat = new THREE.MeshStandardMaterial({ map: TX.asphalt(night), roughness: wet ? 0.16 : 0.82, metalness: wet ? 0.15 : 0.02, color: wet ? '#8c9199' : '#ffffff' });
  scene.add(strip(t, () => half, () => -half, 0.03, trackMat, { vScale: 1 / 14 }));
  // Gomme : plus marquée dans les zones de freinage et les virages.
  const prof = speedProfile(t);
  const rubberMat = new THREE.MeshBasicMaterial({ map: TX.rubber(), transparent: true, depthWrite: false, vertexColors: true, opacity: wet ? 0.5 : 0.9 });
  scene.add(strip(t, i => t.line[i] + 1.7, i => t.line[i] - 1.7, 0.04, rubberMat, { vScale: 1 / 20, alpha: i => Math.min(0.95, 0.25 + (prof[i] - prof[t.wrap(i + 15)] > 4 ? 0.5 : 0) + Math.min(0.3, Math.abs(t.curv[i]) * 60)) }));
  const paintMat = new THREE.MeshStandardMaterial({ map: TX.paint(), transparent: true, roughness: wet ? 0.2 : 0.6 });
  scene.add(strip(t, () => half - 0.15, () => half - 0.5, 0.045, paintMat, { vScale: 1 / 6 }), strip(t, () => -half + 0.5, () => -half + 0.15, 0.045, paintMat, { vScale: 1 / 6 }));
  const kerbMat = new THREE.MeshStandardMaterial({ map: TX.kerb(), roughness: wet ? 0.2 : 0.5 });
  const kerbOn = i => t.kerb[i];
  scene.add(strip(t, () => half + KERB, () => half, 0.07, kerbMat, { vScale: 1 / 4, filter: kerbOn }), strip(t, () => -half, () => -half - KERB, 0.07, kerbMat, { vScale: 1 / 4, filter: kerbOn }));
  // Dégagements : peints (circuits urbains), herbe et bacs à graviers (Lago).
  if (t.def.theme !== 'park') {
    const runMat = new THREE.MeshStandardMaterial({ map: TX.runoffPaint(night), roughness: wet ? 0.25 : 0.9 });
    scene.add(strip(t, i => t.wl[i] + 0.3, () => half + KERB, 0.02, runMat, { vScale: 1 / 12 }), strip(t, () => -half - KERB, i => -t.wr[i] - 0.3, 0.02, runMat, { vScale: 1 / 12 }));
  } else {
    const grassMat = new THREE.MeshStandardMaterial({ map: groundMap, roughness: 0.95, color: groundMat.color });
    scene.add(strip(t, i => t.wl[i] + 0.3, () => half + KERB, 0.01, grassMat, { world: true }), strip(t, () => -half - KERB, i => -t.wr[i] - 0.3, 0.01, grassMat, { world: true }));
    const gravelMat = new THREE.MeshStandardMaterial({ map: TX.gravel(), roughness: 1 });
    const big = w => w > half + KERB + t.def.runoff + 3;
    scene.add(strip(t, i => t.wl[i] - 0.5, () => half + KERB + 2, 0.025, gravelMat, { world: true, filter: i => big(t.wl[i]) }));
    scene.add(strip(t, () => -half - KERB - 2, i => -(t.wr[i] - 0.5), 0.025, gravelMat, { world: true, filter: i => big(t.wr[i]) }));
  }
  // Murs (face + dessus rayé)
  const wallFace = new THREE.MeshStandardMaterial({ color: th.wall[0], roughness: 0.7, side: THREE.DoubleSide });
  const wallTopMat = new THREE.MeshStandardMaterial({ map: TX.wallTop(th.wall[0], th.wall[1]), roughness: 0.6, side: THREE.DoubleSide });
  for (const off of [i => t.wl[i], i => -t.wr[i]]) {
    const face = strip(t, off, off, -0.5, wallFace, { yB: 1.1, vScale: 0.05 }); face.castShadow = true;
    scene.add(face, strip(t, off, i => off(i) + Math.sign(off(i)) * 0.5, 1.1, wallTopMat, { vScale: 0.25 }));
  }
  // Panneaux publicitaires le long des lignes droites, inclinés vers le ciel pour se lire d'en haut.
  for (let i = 30, k = 0; i < t.N; i += 13) {
    if (Math.abs(t.curv[i]) > 0.002 || D.rnd.next() < 0.4) continue;
    const s = k++ % 2 ? 1 : -1, w = (s > 0 ? t.wl[i] : t.wr[i]) + 1.4;
    const b = new THREE.Mesh(new THREE.PlaneGeometry(10, 1.6), new THREE.MeshStandardMaterial({ map: TX.banner(TX.BRANDS[k % TX.BRANDS.length], ['#111', '#c8102e', '#0a3d91', '#f2f2f2'][k % 4], k % 4 === 3 ? '#111' : '#fff'), roughness: 0.6 }));
    b.position.set(t.x[i] + t.nx[i] * w * s, t.h[i] + 1.1, t.y[i] + t.ny[i] * w * s);
    b.rotation.order = 'YXZ'; b.rotation.y = -Math.atan2(t.ty[i], t.tx[i]) + (s > 0 ? Math.PI : 0); b.rotation.x = -1.1;
    b.castShadow = true; scene.add(b);
  }

  // Ligne de départ, grille, portique des feux
  const checker = TX.canvasTex(64, 16, (g) => { for (let a = 0; a < 16; a++) for (let b = 0; b < 4; b++) { g.fillStyle = (a + b) % 2 ? '#111' : '#fff'; g.fillRect(a * 4, b * 4, 4, 4); } }, { repeat: false, key: 'checker' });
  const ang0 = Math.atan2(t.ty[0], t.tx[0]);
  const line = new THREE.Mesh(new THREE.PlaneGeometry(t.def.width, 1.6), new THREE.MeshStandardMaterial({ map: checker, roughness: 0.6 }));
  line.rotation.set(-Math.PI / 2, 0, -ang0 + Math.PI / 2); line.position.set(t.x[0], t.h[0] + 0.05, t.y[0]); scene.add(line);
  const white = new THREE.MeshStandardMaterial({ color: '#f2f2f2', roughness: 0.6 });
  for (let k = 0; k < 12; k++) {
    const back = 14 + k * 9 - 2.8, i = t.wrap(-Math.round(back / t.ds)), side = k % 2 ? -1 : 1, lat = side * half * 0.42;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 3), white);
    m.rotation.set(-Math.PI / 2, 0, -Math.atan2(t.ty[i], t.tx[i]) + Math.PI / 2); m.position.set(t.x[i] + t.nx[i] * lat, t.h[i] + 0.05, t.y[i] + t.ny[i] * lat); scene.add(m);
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
  gantry.position.set(t.x[0] + t.tx[0] * 3 + t.nx[0] * (t.wl[0] - t.wr[0]) / 2, t.h[0] + 8, t.y[0] + t.ty[0] * 3 + t.ny[0] * (t.wl[0] - t.wr[0]) / 2);
  gantry.rotation.y = -ang0;
  scene.add(gantry);

  /* ---------- Décor ---------- */
  const flags = [], spots = [];
  const wat = D.water(scene, t, th, hf, bbox, uTime);
  const avoid = (x, y, r) => wat.wet(x, y, r) || spots.some(s => Math.hypot(s.x - x, s.y - y) < s.r + r);
  let outside = D.inside(t, t.x[0] + t.nx[0] * 30, t.y[0] + t.ny[0] * 30) ? -1 : 1; // côté extérieur au départ (gauche = +1)
  if (t.def.water === 'south') outside = -outside; // le port est dehors : les stands vont de l'autre côté
  spots.push(D.pits(scene, t, outside, th, hf, flags));
  spots.push(...D.stands(scene, t, hf, (x, y, r) => hf.free(x, y, r) && !avoid(x, y, r), -outside, uTime, flags));
  const ferris = t.def.id === 'marina' ? D.wheel(scene, t, hf, hf.free, avoid, bbox) : null;
  if (ferris) spots.push(ferris);
  if (th.buildings) D.buildings(scene, t, th, hf, hf.free, avoid);
  D.trees(scene, t, hf, hf.free, bbox, avoid, low);
  if (night) D.floodlights(scene, t, wet);
  const marshals = D.marshals(scene, t);
  const air = D.aircraft(scene, th, { x: (bbox.x0 + bbox.x1) / 2, y: (bbox.y0 + bbox.y1) / 2 }, Math.max(bbox.x1 - bbox.x0, bbox.y1 - bbox.y0) * 0.35);
  const tun = t.def.id === 'riviera' ? D.tunnel(scene, t) : null;
  if (t.def.id === 'riviera' && wat.places.harbor) D.pool(scene, wat.places.harbor);
  if (t.def.id === 'lago') D.bridge(scene, t);
  if (wet) D.puddles(scene, t);

  const fx = createFx(scene, { low });

  /* ---------- Post-traitement ---------- */
  let composer = null, grade = null, bloom = null;
  if (!low) {
    const rt = new THREE.WebGLRenderTarget(1, 1, { samples: 4, type: THREE.HalfFloatType });
    composer = new EffectComposer(renderer, rt);
    composer.addPass(new RenderPass(scene, camera));
    const gtao = new GTAOPass(scene, camera, 512, 512);
    gtao.blendIntensity = 0.7;
    gtao.updateGtaoMaterial({ radius: 2.2, distanceExponent: 1.5, thickness: 2, scale: 1, samples: 12 });
    gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 5, rings: 2, samples: 12 });
    // pas d'occlusion sous les particules, l'eau ou les flaques de lumière
    const hide = gtao._overrideVisibility.bind(gtao);
    gtao._overrideVisibility = () => { hide(); scene.traverse(o => { if ((o.isMesh || o.isPoints || o.isLineSegments) && o.visible && o.material.transparent && o.material.depthWrite === false) { o.visible = false; gtao._visibilityCache.push(o); } }); };
    composer.addPass(gtao);
    bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), md.bloom[0], 0.45, md.bloom[1]);
    composer.addPass(bloom);
    composer.addPass(new OutputPass());
    grade = new ShaderPass({
      uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uTint: { value: new THREE.Vector3(...md.tint) }, uSat: { value: md.sat }, uCon: { value: md.contrast }, uHaze: { value: new THREE.Vector3() }, uAspect: { value: 1 } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }',
      fragmentShader: `uniform sampler2D tDiffuse; uniform float uTime, uSat, uCon, uAspect; uniform vec3 uTint, uHaze; varying vec2 vUv;
        float rnd(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)) + uTime) * 43758.5453); }
        void main(){
          vec2 uv = vUv;
          // air chaud derrière l'échappement de la voiture suivie
          if (uHaze.z > 0.0) {
            vec2 d = (uv - uHaze.xy) * vec2(uAspect, 1.0);
            float k = uHaze.z * smoothstep(0.07, 0.0, length(d));
            uv += vec2(sin(uv.y * 260.0 + uTime * 30.0), cos(uv.x * 220.0 + uTime * 26.0)) * 0.0018 * k;
          }
          vec3 c = texture2D(tDiffuse, uv).rgb;
          c = (c - 0.5) * uCon + 0.5;
          float l = dot(c, vec3(0.299, 0.587, 0.114));
          c = mix(vec3(l), c, uSat) * uTint;
          c *= 1.0 - 0.32 * smoothstep(0.4, 0.95, distance(vUv, vec2(0.5)));
          c += (rnd(vUv * 731.0) - 0.5) * 0.018;
          gl_FragColor = vec4(c, 1.0);
        }`,
    });
    composer.addPass(grade);
  }

  const cam = { x: t.x[0], z: t.y[0], y: t.h[0], h: 80, shake: 0, lx: 0, lz: 0 };
  const cars = new Map();
  const trackH = car => { const i = car.i ?? 0; return t.h[i] + (t.slope[i] ?? 0) * (car.along ?? 0); };
  const v3 = new THREE.Vector3();

  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    renderer.setSize(w, h, false);
    composer?.setSize(w, h);
    bloom?.resolution.set(w / 2, h / 2);
    camera.aspect = w / h;
    camera.fov = w < h ? 52 : 36; // écran en portrait : on recule pour voir sur les côtés
    camera.updateProjectionMatrix();
    if (grade) grade.uniforms.uAspect.value = w / h;
    fx.setScale((h * renderer.getPixelRatio()) / (2 * Math.tan((camera.fov * Math.PI) / 360)));
  }

  return {
    renderer, scene, camera, fx,
    addCar(id, look, opts) {
      const m = buildCar(look, opts);
      scene.add(m.group);
      cars.set(id, { m, gear: 1, flame: 0 });
      if (night || wet) m.rain.material.emissiveIntensity = 2.2;
      return m;
    },
    removeCar(id) { const c = cars.get(id); if (c) scene.remove(c.m.group); cars.delete(id); },
    setLights(n) { lamps.forEach((l, k) => (l.material.emissiveIntensity = k < n ? 4 : 0)); },
    shake(v) { cam.shake = Math.min(1.6, cam.shake + v); },
    // Choc : étincelles, fumée, débris pour les gros impacts, drapeaux jaunes des commissaires.
    impact(x, y, power, color) {
      const h = hf.at(x, y) + 0.25;
      if (power > 5) fx.sparks(x, y, h, power);
      if (power > 8) fx.smoke(x, y, h, 1, 1, '#bbbbbb');
      if (power > 13) { fx.debris(x, y, h, power, color); marshals.incident(x, y); }
    },
    update(list, follow, dt, time) {
      uTime.value = time;
      const camDist = c => Math.hypot(c.x - cam.x, c.y - cam.z);
      for (const car of list) {
        const c = cars.get(car.id);
        if (!c) continue;
        const g = c.m.group, h = trackH(car);
        g.visible = !car.hidden;
        const fx_ = Math.cos(car.a), fy_ = Math.sin(car.a);
        const pitch = Math.atan((t.slope[car.i ?? 0] ?? 0) * (fx_ * t.tx[car.i ?? 0] + fy_ * t.ty[car.i ?? 0]));
        g.position.set(car.x, h, car.y);
        g.rotation.set(0, -car.a, pitch);
        const spin = (car.speed || 0) * dt / 0.37;
        for (const w of c.m.wheels) w.rotation.z -= spin;
        const st = (car.steer || 0) * steerMax(car.speed || 0) * 1.8;
        for (const p of c.m.pivots) p.rotation.y = st;
        c.m.flap.scale.x = car.drsOpen ? 0.35 : 1;
        if (car.ghost || car.hidden || !dt) continue;
        const near = camDist(car) < 140, sp = car.speed || 0;
        const vx = car.vx ?? fx_ * sp, vy = car.vy ?? fy_ * sp;
        // Traces de pneus et fumée quand ça glisse
        const rear = [-1, 1].map(s => [car.x - fx_ * 1.5 + fy_ * 0.93 * s, car.y - fy_ * 1.5 - fx_ * 0.93 * s]);
        if (car.skid > 2.2 && c.rear && !wet) for (let k = 0; k < 2; k++) fx.skid(c.rear[k][0], c.rear[k][1], rear[k][0], rear[k][1], h);
        c.rear = rear;
        if (!near) continue;
        if (car.skid > 3 && !wet) for (const r of rear) if (Math.random() < Math.min(0.9, car.skid * 0.06)) fx.smoke(r[0], r[1], h, 0.8, 1);
        if ((car.surface === 'grass' || car.surface === 'sand') && Math.abs(sp) > 8 && Math.random() < 0.7) fx.dust(rear[Math.random() < 0.5 ? 0 : 1][0], rear[0][1], h, vx, vy, car.surface === 'sand' || t.def.theme !== 'park' ? '#cbb68c' : '#7a6847');
        if (wet && sp > 15) for (const r of rear) if (Math.random() < Math.min(1, sp / 50)) fx.spray(r[0], r[1], h, vx, vy);
        // Fond plat qui touche à haute vitesse ou sur les vibreurs
        if (sp > 58 && (car.rumble || Math.random() < 0.05)) fx.plank(car.x - fx_ * 0.5, car.y - fy_ * 0.5, h, vx, vy);
        // Flammes d'échappement quand on rétrograde
        const gear = gearOf(sp, CAR.vmax).gear;
        if (gear < c.gear && sp > 12) c.flame = 0.14;
        c.gear = gear;
        if (c.flame > 0) { c.flame -= dt; fx.flame(car.x - fx_ * 2.45, car.y - fy_ * 2.45, h, -fx_, -fy_); }
        if (car.drsOpen && Math.random() < 0.3) fx.trail(car.x - fx_ * 2.4, car.y - fy_ * 2.4, h);
      }
      fx.update(dt);
      wat.update(dt);
      marshals.update(dt, time);
      ferris?.update(dt);
      tun?.update(dt, follow);
      if (!low) D.waveFlags(flags, time);
      // Caméra : un peu en avant de la voiture, plus haute quand on va vite, à la hauteur du relief.
      if (follow) {
        const sp = Math.hypot(follow.vx || 0, follow.vy || 0);
        const ax = Math.max(-38, Math.min(38, (follow.vx || 0) * 0.55)), az = Math.max(-38, Math.min(38, (follow.vy || 0) * 0.55));
        cam.lx += (ax - cam.lx) * Math.min(1, dt * 2.2); cam.lz += (az - cam.lz) * Math.min(1, dt * 2.2);
        const k = Math.min(1, dt * 7);
        cam.x += (follow.x + cam.lx - cam.x) * k; cam.z += (follow.y + cam.lz - cam.z) * k;
        cam.y += (trackH(follow) - cam.y) * Math.min(1, dt * 3);
        cam.h += (62 + sp * 0.8 - cam.h) * Math.min(1, dt * 1.5);
        air.update(dt, { x: follow.x, y: follow.y, h: cam.y }, time);
      }
      fx.rain(wet, cam.x, cam.z, cam.y, dt);
      cam.shake *= Math.exp(-dt * 6);
      const sx = (Math.random() - 0.5) * cam.shake, sz = (Math.random() - 0.5) * cam.shake;
      camera.position.set(cam.x + sx, cam.y + cam.h, cam.z + cam.h * 0.18 + sz);
      camera.lookAt(cam.x + sx, cam.y, cam.z + sz);
      sun.target.position.set(cam.x, cam.y, cam.z);
      sun.position.copy(sun.target.position).addScaledVector(sunDir, 400);
      if (grade) {
        grade.uniforms.uTime.value = time;
        // Air chaud au-dessus de l'échappement (temps sec, de jour)
        const hz = grade.uniforms.uHaze.value;
        if (follow && !wet && !night) {
          v3.set(follow.x - Math.cos(follow.a) * 3.2, trackH(follow) + 0.8, follow.y - Math.sin(follow.a) * 3.2).project(camera);
          hz.set(v3.x * 0.5 + 0.5, v3.y * 0.5 + 0.5, Math.max(0, Math.min(1, ((follow.speed || 0) - 25) / 40)));
        } else hz.z = 0;
      }
    },
    resize,
    render() { composer ? composer.render() : renderer.render(scene, camera); },
    dispose() { renderer.dispose(); composer?.dispose?.(); pmrem.dispose(); },
  };
}
