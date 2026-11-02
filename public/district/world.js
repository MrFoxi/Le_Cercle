// Little District : la maquette 3D. Plateau, rues, bâtiments, décorations, lumière du jour et de la nuit, météo.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { HorizontalTiltShiftShader } from 'three/addons/shaders/HorizontalTiltShiftShader.js';
import { VerticalTiltShiftShader } from 'three/addons/shaders/VerticalTiltShiftShader.js';
import { TEX, MATS, SEASON_LEAVES, std, textured, glowMat, box, bake, buildBuilding, makeDecor, lightPool, streak, lantern, seeded, foliage } from './models.js';
import { PLOTS, SECTORS, BUILDINGS } from './sim.js';
import { createPeople } from './people.js';
import { buildTerrain, groundY, BASE } from './terrain.js';
import { createLife } from './life.js';
import { DISTRICT, T } from './theme.js';
import { streetLamp, GROUND } from './styles.js';
const JP = DISTRICT === 'japon';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const GROUND_Y = 0.06, ROAD_Y = 0.01;
const smooth = (a, b, t) => { t = Math.min(1, Math.max(0, (t - a) / (b - a))); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;

// Ambiance par heure : fond, ciel, sol, intensité du ciel, couleur et intensité du soleil (ou de la lune)
const KEYS = [
  [0, '#0a0f20', '#3a4f8a', '#20182a', 0.5, '#9db4ff', 0.45],
  [5, '#121833', '#4a5a8a', '#2a2030', 0.5, '#a0b0ff', 0.3],
  [6.5, '#6a5060', '#f0b89a', '#4a3a38', 0.65, '#ffb37a', 1.9],
  [9, '#5f6f7e', '#bcd3ea', '#5a4a3c', 0.75, '#fff1dc', 3.2],
  [15, '#647384', '#c4d8ec', '#5a4a3c', 0.75, '#ffefd2', 3.1],
  [18, '#6e4a5c', '#f2a07a', '#4a3434', 0.6, '#ff9450', 2.3],
  [19.5, '#30284a', '#6a5a9a', '#2a2030', 0.55, '#ff7a5a', 0.45],
  [21, '#0c1126', '#3a4f8a', '#20182a', 0.5, '#9db4ff', 0.45],
  [24, '#0a0f20', '#3a4f8a', '#20182a', 0.5, '#9db4ff', 0.45],
];
const cA = new THREE.Color(), cB = new THREE.Color();
function sky(hour) {
  let i = 0;
  while (KEYS[i + 1][0] <= hour) i++;
  const a = KEYS[i], b = KEYS[i + 1], t = smooth(0, 1, (hour - a[0]) / (b[0] - a[0]));
  const col = k => cA.set(a[k]).lerp(cB.set(b[k]), t).clone();
  return { bg: col(1), sky: col(2), ground: col(3), hemi: lerp(a[4], b[4], t), sun: col(5), sunI: lerp(a[6], b[6], t) };
}
// 0 en plein jour, 1 la nuit
export const nightOf = h => Math.max(smooth(17, 19.8, h), 1 - smooth(5.2, 7.4, h));

export function createWorld(canvas, { low }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !low, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, low ? 1.25 : 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#0a0f20');
  scene.fog = new THREE.Fog('#0a0f20', 30, 90);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  const dome = new THREE.Mesh(new THREE.SphereGeometry(220, 32, 16), new THREE.ShaderMaterial({
    uniforms: { top: { value: new THREE.Color() }, horizon: { value: new THREE.Color() } },
    vertexShader: 'varying vec3 vP; void main(){ vP=normalize(position); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }',
    fragmentShader: 'uniform vec3 top; uniform vec3 horizon; varying vec3 vP; void main(){ float h=clamp(vP.y,-0.2,1.); vec3 c=mix(horizon,top,pow(max(h,0.),0.55)); if(h<0.) c=mix(horizon,horizon*0.35,-h*5.); gl_FragColor=vec4(c,1.); }',
    side: THREE.BackSide, depthWrite: false, fog: false,
  }));
  dome.renderOrder = -10; scene.add(dome);
  const starGeo = new THREE.BufferGeometry(), starPos = [];
  for (let i = 0; i < 900; i++) { const u = Math.random() * 0.92 + 0.08, a = Math.random() * Math.PI * 2, r = Math.sqrt(1 - u * u); starPos.push(Math.cos(a) * r * 200, u * 200, Math.sin(a) * r * 200); }
  starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3));
  const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: '#ffffff', size: 1.4, sizeAttenuation: false, transparent: true, opacity: 0, depthWrite: false, fog: false }));
  scene.add(stars);
  const moon = new THREE.Mesh(new THREE.SphereGeometry(5, 24, 16), new THREE.MeshBasicMaterial({ color: '#fff6dc', transparent: true, fog: false }));
  const moonHalo = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.glow(), color: '#9fb4ff', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  moonHalo.scale.set(40, 40, 1); moon.add(moonHalo); scene.add(moon);
  const shooting = new THREE.Mesh(new THREE.PlaneGeometry(14, 0.25), new THREE.MeshBasicMaterial({ map: TEX.streak(), color: '#ffffff', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  scene.add(shooting);
  let shootT = 10, shootLife = 0;

  const camera = new THREE.PerspectiveCamera(30, 1, 0.5, 500);
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true; controls.dampingFactor = 0.08;
  controls.minDistance = 6; controls.maxDistance = 62;
  controls.minPolarAngle = 0.42; controls.maxPolarAngle = 1.12;
  controls.screenSpacePanning = false;
  controls.zoomToCursor = true;
  controls.target.set(PLOTS[0].x, 0, 0);
  camera.position.set(14, 15, 18);

  // ---------- Lumières ----------
  const hemi = new THREE.HemisphereLight('#cfe2f5', '#6a5a4a', 1);
  const sun = new THREE.DirectionalLight('#fff', 2.5);
  sun.castShadow = true;
  sun.shadow.mapSize.set(low ? 1024 : 2048, low ? 1024 : 2048);
  Object.assign(sun.shadow.camera, { left: -17, right: 17, top: 17, bottom: -17, near: 1, far: 80 });
  sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.03;
  scene.add(hemi, sun, sun.target);
  // Quelques vraies lumières, données aux bâtiments les plus proches de la caméra ; le reste, ce sont des taches de lumière peintes.
  const points = Array.from({ length: low ? 2 : 6 }, () => { const l = new THREE.PointLight('#ffb56b', 0, 5, 2); scene.add(l); return l; });

  // ---------- Plateau de maquette ----------
  const groundMats = [];
  const groundMat = (key, tex, rep, tint) => { const t = tex.clone(); t.needsUpdate = true; t.repeat.set(...rep); const m = new THREE.MeshStandardMaterial({ map: t, roughness: 0.9 }); if (tint) m.userData.tint = new THREE.Color(tint).multiplyScalar(key === 'road' ? 1 : GROUND.gain || 1); groundMats.push(m); return m; };
  const flat = (w, d, m, x, y, z) => { const o = new THREE.Mesh(new THREE.PlaneGeometry(w, d), m); o.rotation.x = -Math.PI / 2; o.position.set(x, y, z); o.receiveShadow = true; scene.add(o); return o; };
  flat(26.6, 2.8, GROUND.roadPave ? groundMat('road', TEX.pave(), [9, 0.9], GROUND.road) : groundMat('road', TEX.asphalt(), [7, 0.8], GROUND.road), 0, ROAD_Y, 0); // au-dessus du socle, jamais à la même hauteur
  for (const s of [-1, 1]) {
    flat(26.6, 1.26, groundMat('walk', TEX.slab(), [26, 1.26], GROUND.pave), 0, GROUND_Y, s * 2.07); // commence après la bordure
    flat(26.6, 10.6, groundMat('pave', TEX.pave(), [9, 3.6], GROUND.pave), 0, GROUND_Y, s * 8);
    const curb = box(scene, 26.6, GROUND_Y + 0.02, 0.1, std('#8f8b84'), 0, 0, s * 1.39); curb.receiveShadow = true; // un peu plus haute que le trottoir : pas de surfaces confondues
  }
  // Marquages : ligne médiane, passages piétons
  const paint = std('#bdb8ac', { roughness: 0.8 }); // pas trop blanc : sinon ça brille comme un néon au soleil
  for (let x = -12; x <= 12; x += 1.6) if (!GROUND.roadPave && Math.abs(x) > 1.6 && Math.abs(Math.abs(x) - 9.3) > 1) box(scene, 0.8, 0.006, 0.07, paint, x, ROAD_Y, 0);
  for (const cx of [0, -9.3, 9.3]) for (let z = -1.1; z <= 1.1; z += 0.44) box(scene, 1.3, 0.006, 0.22, paint, cx, ROAD_Y, z);
  for (const [x, z] of [[-3, 0.5], [6, -0.6], [-8, -0.4]]) { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.01, 18), std('#3a3a3c', { metalness: 0.6, roughness: 0.5 })); m.position.set(x, ROAD_Y + 0.006, z); scene.add(m); }
  // Relief : colline du sanctuaire, canal, rive d'en face ; socle en bois ; table sombre et brillante dessous
  const terrain = buildTerrain(scene, low);
  groundMats.push(...terrain.groundMats);
  const tableTop = new THREE.Mesh(new THREE.PlaneGeometry(160, 160), new THREE.MeshStandardMaterial({ color: '#0d0f14', roughness: 0.32, metalness: 0.3 }));
  tableTop.rotation.x = -Math.PI / 2; tableTop.position.y = -1.69; tableTop.receiveShadow = true; scene.add(tableTop);

  if (T.futur) for (const s of [-1, 1]) box(scene, 26.6, 0.012, 0.05, glowMat('roadNeon', s < 0 ? '#ff4fd8' : '#3ff0ff', null, 1, 3, 0), 0, ROAD_Y, s * 1.25);
  // Touffes d'herbe dans les recoins : bordures de trottoir, pied du mur de la colline, bord du canal (couleur de saison)
  {
    const lines = [[1.47, 0.06], [-1.47, 0.06], [14.68, 0.06], [-15.18, 0.06], [-18.95, 0.06], [12.5, 0.06], [-13.35, 0.06]];
    const blade = (rz, rx, h) => new THREE.ConeGeometry(0.014, h, 3).translate(0, h / 2, 0).rotateZ(rz).rotateX(rx);
    const tufts = new THREE.InstancedMesh(mergeGeometries([blade(0, 0, 0.13), blade(0.35, 0.1, 0.11), blade(-0.3, -0.15, 0.1), blade(0.1, 0.4, 0.09), blade(-0.15, -0.4, 0.1)]), foliage('grass'), low ? 160 : 360); // brins d'herbe
    const r = seeded(73), d = new THREE.Object3D();
    for (let i = 0; i < tufts.count; i++) {
      const [z, y] = lines[i % lines.length];
      const x = r() * 25.6 - 12.8;
      if (Math.abs(x) < 1 && (z > 12 || z < -14)) { d.scale.setScalar(0); } // pas sur l'escalier ni sur le pont
      else { d.position.set(x, y, z + (r() - 0.5) * 0.06); d.rotation.set((r() - 0.5) * 0.4, r() * 6, (r() - 0.5) * 0.4); d.scale.set(0.7 + r() * 0.8, 0.6 + r() * 1.1, 0.7 + r() * 0.8); }
      d.updateMatrix(); tufts.setMatrixAt(i, d.matrix);
    }
    tufts.receiveShadow = true; scene.add(tufts);
  }

  // Flaques (visibles quand le sol est mouillé)
  const puddleMat = new THREE.MeshStandardMaterial({ color: '#0d1014', roughness: 0.03, metalness: 0.7, transparent: true, opacity: 0, depthWrite: false });
  const prng = seeded(41);
  for (let i = 0; i < 16; i++) {
    const m = new THREE.Mesh(new THREE.CircleGeometry(1, 20), puddleMat);
    m.rotation.x = -Math.PI / 2;
    const onRoad = i < 9;
    m.position.set(prng() * 24 - 12, onRoad ? ROAD_Y + 0.012 : GROUND_Y + 0.012, onRoad ? prng() * 2.2 - 1.1 : (prng() < 0.5 ? -1 : 1) * (7.4 + prng() * 0.3 - 0.15));
    m.scale.set(0.4 + prng() * 0.7, 0.25 + prng() * 0.35, 1); m.rotation.z = prng() * 3;
    scene.add(m);
  }

  // ---------- Décor fixe : poteaux électriques et fils, arbres d'angle ----------
  const glows = []; // { mesh pools/streaks } des éléments fixes
  const scenery = new THREE.Group(); scene.add(scenery);
  const poleMat = std('#5d5a55', { roughness: 0.8 }), wireMat = new THREE.MeshBasicMaterial({ color: '#111' });
  const poles = [-11.8, -6.8, -1.9, 1.9, 6.8, 11.8];
  for (const s of [-1, 1]) {
    poles.forEach(x => {
      const z = s * 2.5;
      if (!JP) {
        streetLamp(scenery, x, z, s);
        const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), glowMat('streetbulb', DISTRICT === 'futur' ? '#bff8ff' : '#ffe1b0', null, 0.1, 4, 0));
        bulb.position.set(x, 2.55, z - s * (DISTRICT === 'futur' ? 0 : 0.42)); scenery.add(bulb);
        glows.push(lightPool(scenery, x, z - s * 0.5, 1.15, DISTRICT === 'futur' ? '#9ff0ff' : '#ffcf96', 0.55), streak(scenery, x, z - s * 0.6, 0.35, '#ffcf96', 0.8));
        return;
      }
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 3.6, 8), poleMat);
      p.position.set(x, 1.8, z); p.castShadow = true; scenery.add(p);
      box(scenery, 0.9, 0.05, 0.05, poleMat, x, 3.25, z);
      if (Math.round(x) % 2) { const t = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.4, 10), std('#7a7d80', { metalness: 0.5 })); t.position.set(x, 2.7, z - s * 0.15); scenery.add(t); }
      const lampArm = box(scenery, 0.45, 0.04, 0.04, poleMat, x, 2.6, z - s * 0.2, Math.PI / 2);
      lampArm.castShadow = false;
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), glowMat('streetbulb', '#ffe1b0', null, 0.1, 4, 0));
      bulb.position.set(x, 2.55, z - s * 0.42); scenery.add(bulb);
      glows.push(lightPool(scenery, x, z - s * 0.5, 1.15, '#ffcf96', 0.55), streak(scenery, x, z - s * 0.6, 0.35, '#ffcf96', 0.8));
    });
    if (JP) for (let i = 0; i < poles.length - 1; i++) for (const dy of [0, 0.22]) {
      const a = new THREE.Vector3(poles[i] + 0.4, 3.24 - dy, s * 2.5), b = new THREE.Vector3(poles[i + 1] - 0.4, 3.24 - dy, s * 2.5);
      const mid = a.clone().lerp(b, 0.5); mid.y -= 0.35;
      const tube = new THREE.Mesh(new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(a, mid, b), 16, 0.012, 4), wireMat);
      scenery.add(tube);
    }
  }
  const trees = [];
  for (const [x, z, id] of [[12.4, 12.4, 'cerisier'], [-12.4, 12.4, 'erable'], [12.4, -12.4, 'erable'], [-12.4, -12.4, 'cerisier'], [-12.5, 7.4, 'cerisier'], [12.5, -7.4, 'cerisier']]) {
    const t = makeDecor(id); t.position.set(x, GROUND_Y, z); t.scale.setScalar(1.15); t.rotation.y = x * z;
    t.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    scenery.add(t); trees.push(t);
  }
  // Guirlandes de saison au-dessus de la grand-rue : lanternes d'été, illuminations d'hiver
  const festoon = { ete: new THREE.Group(), hiver: new THREE.Group() };
  for (const x of [-9.3, -4.3, 4.3, 9.3]) {
    const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(x - 0.6, 2.7, -2.45), new THREE.Vector3(x, 2.2, 0), new THREE.Vector3(x + 0.6, 2.7, 2.45));
    for (const k of ['ete', 'hiver']) festoon[k].add(new THREE.Mesh(new THREE.TubeGeometry(curve, 16, 0.01, 4), wireMat));
    for (let i = 1; i < 10; i++) {
      const p = curve.getPoint(i / 10);
      lantern(festoon.ete, p.x, p.y - 0.15, p.z, i % 2 ? '#d8342c' : '#f4efe4', '', 0.7);
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 5), glowMat('xmas' + (i % 3), ['#bfe3ff', '#ffffff', '#ffd59a'][i % 3], null, 0.4, 5, 0));
      b.position.copy(p).y -= 0.04; festoon.hiver.add(b);
    }
  }
  scene.add(festoon.ete, festoon.hiver);

  // ---------- Parcelles ----------
  const plotRoot = new THREE.Group(); scene.add(plotRoot);
  const pickables = [];
  const plots = PLOTS.map((p, i) => {
    const holder = new THREE.Group();
    holder.position.set(p.x, GROUND_Y, p.z); holder.rotation.y = p.face > 0 ? 0 : Math.PI;
    plotRoot.add(holder);
    const pick = new THREE.Mesh(new THREE.BoxGeometry(4.3, 3, p.depth), new THREE.MeshBasicMaterial({ visible: false }));
    pick.position.y = 1.5; pick.userData.plot = i; holder.add(pick); pickables.push(pick);
    // Contour (mode construction et sélection)
    const ring = new THREE.Mesh(new THREE.PlaneGeometry(4.3, p.depth), new THREE.MeshBasicMaterial({ map: ringTex(), color: '#9cffb8', transparent: true, opacity: 0, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.05; ring.renderOrder = 3; holder.add(ring);
    return { holder, ring, model: null, info: null, key: '', lot: null, glows: [], anim: 0 };
  });
  function ringTex() {
    if (ringTex.t) return ringTex.t;
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const x = c.getContext('2d'); x.strokeStyle = '#fff'; x.lineWidth = 6; x.setLineDash([14, 8]); x.strokeRect(6, 6, 116, 116);
    x.fillStyle = 'rgba(255,255,255,.12)'; x.fillRect(6, 6, 116, 116);
    return (ringTex.t = new THREE.CanvasTexture(c));
  }
  // Terrain vague (parcelle libre) ou à vendre (barrière + panneau 売地)
  function makeLot(depth, forSale, kind) {
    const g = new THREE.Group();
    const dirt = box(g, 4.2, 0.03, depth - 0.1, textured('dirtT', TEX.dirt()), 0, 0, 0); dirt.receiveShadow = true;
    const r = seeded(Math.round(depth * 100));
    for (let i = 0; i < 8; i++) { const t = new THREE.Mesh(new THREE.IcosahedronGeometry(0.12 + r() * 0.1, 0), std('#5f7a3a', { flatShading: true })); t.position.set(r() * 3.6 - 1.8, 0.06, r() * (depth - 1) - (depth - 1) / 2); t.scale.y = 0.6; g.add(t); }
    if (forSale) {
      // Vieille maison fermée (rideau de fer baissé) : le quartier a de l'arrière-plan dès le début
      const { group } = buildBuilding(kind, 1, depth);
      const old = bake(group);
      old.scale.setScalar(0.94);
      g.add(old);
      const front = -depth / 2 + 3.1;
      box(g, 2.6, 0.9, 0.04, textured('shutter', TEX.stripes('#5d6166', '#6e7277')), 0.3, 0, front + 0.06);
      const fence = std('#7a5a3a');
      for (let i = 0; i < 9; i++) box(g, 0.06, 0.4, 0.06, fence, -2 + i * 0.5, 0, depth / 2 - 0.1);
      box(g, 4.1, 0.05, 0.04, fence, 0, 0.3, depth / 2 - 0.1);
      box(g, 0.05, 0.75, 0.05, fence, 1.2, 0, depth / 2 - 0.4);
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.36), textured('forsale', TEX.sign(JP ? '売地' : 'À VENDRE', '#f4efe4', '#b8321f')));
      sign.position.set(1.2, 0.72, depth / 2 - 0.37); g.add(sign);
    } else {
      box(g, 0.04, 0.5, 0.04, std('#7a5a3a'), -1.6, 0, depth / 2 - 0.3);
      const s = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.26), textured('akichi', TEX.sign(JP ? '空き地' : 'LIBRE', '#f4efe4', '#3a3a3a'))); s.position.set(-1.6, 0.5, depth / 2 - 0.27); g.add(s);
    }
    g.traverse(o => { if (o.isMesh) o.castShadow = true; });
    return g;
  }

  // Taches de lumière et reflets d'un bâtiment ou d'une décoration
  function addGlows(holder, list) {
    const out = [];
    for (const gl of list) {
      if (gl.pool || gl.strong || gl.y < 2.2) out.push(lightPool(holder, gl.x, gl.z + (gl.pool ? 0 : 0.2), gl.r || (gl.strong ? 1.6 : 1.1), gl.color, gl.pool ? 0.9 : 0.6));
      out.push(streak(holder, gl.x, gl.z + 0.2, gl.strong ? 0.8 : 0.45, gl.color, gl.strong ? 1.4 : 1));
    }
    return out;
  }

  function clearPlot(P) {
    for (const o of [P.model, P.lot]) if (o) { P.holder.remove(o); o.traverse(c => { if (c.isMesh && c.geometry && !c.geometry.parameters) c.geometry.dispose(); }); }
    P.model = P.lot = null; P.glows = [];
  }
  // Met une parcelle à jour (bâtiment, niveau, terrain libre ou à vendre). anim : petite animation de construction.
  function syncPlot(i, state, anim = false) {
    const P = plots[i], p = state.plots[i], open = state.sectors[PLOTS[i].sector];
    const key = p ? `${p.type}:${p.level}` : open ? 'lot' : 'sale';
    if (key === P.key) return;
    P.key = key;
    clearPlot(P);
    if (p) {
      const { group, info } = buildBuilding(p.type, p.level, PLOTS[i].depth);
      const baked = bake(group);
      P.model = baked; P.info = info; P.type = p.type;
      P.holder.add(baked);
      P.glows = addGlows(baked, info.glows);
      if (anim) { P.anim = 1; baked.scale.set(1, 0.01, 1); burst(P.holder.position); }
    } else {
      P.info = null; P.type = null;
      P.lot = makeLot(PLOTS[i].depth, !open, ['maison', 'appart'][i % 2]);
      P.holder.add(P.lot);
    }
    people.plotChanged(i);
  }

  // ---------- Décorations posées ----------
  const decorRoot = new THREE.Group(); scene.add(decorRoot);
  let decorKey = '';
  function syncDecor(state) {
    const key = JSON.stringify(state.decor);
    if (key === decorKey) return;
    decorKey = key;
    for (const c of [...decorRoot.children]) decorRoot.remove(c);
    state.decor.forEach((d, k) => {
      const g = makeDecor(d.id);
      g.position.set(d.x, GROUND_Y, d.z); g.rotation.y = d.r || 0;
      g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; o.userData.decor = k; } });
      g.userData.glowMeshes = addGlows(g, g.userData.glows);
      decorRoot.add(g);
    });
    trees.length = 6; decorRoot.children.forEach(g => g.userData.tree && trees.push(g));
  }
  // Fantôme de la décoration en cours de placement
  let ghost = null;
  const ghostOk = new THREE.MeshBasicMaterial({ color: '#8dffb0', transparent: true, opacity: 0.55, depthWrite: false });
  const ghostKo = new THREE.MeshBasicMaterial({ color: '#ff8d8d', transparent: true, opacity: 0.55, depthWrite: false });
  function setGhost(id, x, z, r, ok) {
    if (!id) { if (ghost) scene.remove(ghost); ghost = null; return; }
    if (!ghost || ghost.userData.id !== id) {
      if (ghost) scene.remove(ghost);
      ghost = makeDecor(id); ghost.userData.id = id;
      ghost.traverse(o => { if (o.isMesh) o.castShadow = false; });
      scene.add(ghost);
    }
    ghost.position.set(x, GROUND_Y + 0.02, z); ghost.rotation.y = r;
    ghost.traverse(o => { if (o.isMesh && !o.userData.pool && !o.userData.streak) o.material = ok ? ghostOk : ghostKo; });
  }

  // ---------- Particules : pluie, éclaboussures, neige, pétales, vapeur, poussière ----------
  const N_RAIN = low ? 1000 : 2600;
  const rainGeo = new THREE.BufferGeometry(), rainPos = new Float32Array(N_RAIN * 6);
  for (let i = 0; i < N_RAIN; i++) resetDrop(i, Math.random() * 14);
  function resetDrop(i, y) { const x = Math.random() * 30 - 15, z = Math.random() * 46 - 23; rainPos.set([x, y, z, x - 0.02, y + 0.22, z - 0.01], i * 6); }
  rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
  const rain = new THREE.LineSegments(rainGeo, new THREE.LineBasicMaterial({ color: '#b8c8dc', transparent: true, opacity: 0, depthWrite: false }));
  rain.frustumCulled = false; scene.add(rain);
  const ripples = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: TEX.ripple(), color: '#cfe0f0', transparent: true, opacity: 0, depthWrite: false }), 90);
  const ripState = Array.from({ length: 90 }, () => ({ x: 0, z: 0, t: 1 + Math.random(), y: 0 }));
  ripples.frustumCulled = false; scene.add(ripples);
  const dummy = new THREE.Object3D();

  function particleSystem(n, color, size, additive = false) {
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(n * 3), alpha = new Float32Array(n), sz = new Float32Array(n);
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aAlpha', new THREE.BufferAttribute(alpha, 1));
    geo.setAttribute('aSize', new THREE.BufferAttribute(sz, 1));
    const m = new THREE.ShaderMaterial({
      uniforms: { uMap: { value: TEX.flake() }, uColor: { value: new THREE.Color(color) }, uScale: { value: 300 } },
      vertexShader: 'attribute float aAlpha; attribute float aSize; varying float vA; uniform float uScale; void main(){ vA=aAlpha; vec4 mv=modelViewMatrix*vec4(position,1.); gl_PointSize=aSize*uScale/-mv.z; gl_Position=projectionMatrix*mv; }',
      fragmentShader: 'uniform sampler2D uMap; uniform vec3 uColor; varying float vA; void main(){ vec4 t=texture2D(uMap,gl_PointCoord); gl_FragColor=vec4(uColor,t.a*vA); }',
      transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    const pts = new THREE.Points(geo, m);
    pts.frustumCulled = false; scene.add(pts);
    return { pts, pos, alpha, sz, geo, m, n, data: Array.from({ length: n }, () => ({ life: 0, vx: 0, vy: 0, vz: 0, max: 1 })) };
  }
  const snow = particleSystem(low ? 700 : 1800, '#ffffff', 0.09);
  snow.data.forEach((d, i) => { snow.pos.set([Math.random() * 28 - 14, Math.random() * 12, Math.random() * 44 - 22], i * 3); snow.sz[i] = 0.06 + Math.random() * 0.06; d.ph = Math.random() * 7; });
  const petals = particleSystem(low ? 60 : 160, '#f6b8cc', 0.08);
  petals.data.forEach((d, i) => { petals.pos.set([Math.random() * 28 - 14, Math.random() * 6, Math.random() * 28 - 14], i * 3); petals.sz[i] = 0.045; d.ph = Math.random() * 7; });
  const steam = particleSystem(low ? 120 : 260, '#ffffff', 0.25);
  const dust = particleSystem(140, '#e8dcc6', 0.3);
  let steamNext = 0;
  function emit(sys, x, y, z, o) {
    for (let k = 0; k < sys.n; k++) {
      const d = sys.data[k];
      if (d.life > 0) continue;
      Object.assign(d, { life: o.life, max: o.life, vx: o.vx ?? 0, vy: o.vy ?? 0.3, vz: o.vz ?? 0, size: o.size });
      sys.pos.set([x, y, z], k * 3);
      return;
    }
  }
  function burst(at) {
    for (let i = 0; i < 40; i++) { const a = Math.random() * 7; emit(dust, at.x + Math.cos(a) * 1.6, 0.2, at.z + Math.sin(a) * 1.6, { life: 0.9 + Math.random() * 0.6, vx: Math.cos(a) * 1.2, vy: 0.4 + Math.random() * 0.6, vz: Math.sin(a) * 1.2, size: 0.35 + Math.random() * 0.3 }); }
  }
  function stepSystem(sys, dt, fade = true) {
    for (let k = 0; k < sys.n; k++) {
      const d = sys.data[k];
      if (d.life <= 0) { sys.alpha[k] = 0; continue; }
      d.life -= dt;
      const i = k * 3;
      sys.pos[i] += d.vx * dt; sys.pos[i + 1] += d.vy * dt; sys.pos[i + 2] += d.vz * dt;
      const f = Math.pow(0.97, dt * 60); d.vx *= f; d.vz *= f;
      const t = 1 - d.life / d.max;
      sys.alpha[k] = fade ? Math.sin(Math.PI * t) * 0.5 : 1;
      sys.sz[k] = d.size * (0.6 + t * 1.2);
    }
    sys.geo.attributes.position.needsUpdate = sys.geo.attributes.aAlpha.needsUpdate = sys.geo.attributes.aSize.needsUpdate = true;
  }

  // ---------- Habitants ----------
  const people = createPeople({ scene, plots, low, emitCoin: (...a) => api.onPay?.(...a), onFlash: p => life?.flash(p) });
  let life = null;
  life = createLife({ scene, people, low, camera, target: controls.target, onSound: n => api.onSound?.(n) });

  // ---------- Rendu : bloom (néons) et flou de maquette (tilt-shift) ----------
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  let gtao = null;
  if (!low) {
    gtao = new GTAOPass(scene, camera, 512, 512);
    gtao.blendIntensity = 0.85;
    gtao.updateGtaoMaterial({ radius: 0.45, distanceExponent: 1.4, thickness: 0.8, scale: 1.1, samples: 12 });
    gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 5, rings: 2, samples: 12 });
    // pas d'ombre de contact sous les taches de lumière, l'eau ou les vitres
    const hide = gtao._overrideVisibility.bind(gtao);
    gtao._overrideVisibility = () => { hide(); scene.traverse(o => { if (o.isMesh && o.visible && o.material.transparent && o.material.depthWrite === false) { o.visible = false; gtao._visibilityCache.push(o); } }); };
    composer.addPass(gtao);
  }
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.6, 0.45, 0.9);
  composer.addPass(bloom);
  const tiltH = new ShaderPass(HorizontalTiltShiftShader), tiltV = new ShaderPass(VerticalTiltShiftShader);
  tiltH.uniforms.r.value = tiltV.uniforms.r.value = 0.52;
  composer.addPass(tiltH); composer.addPass(tiltV);
  composer.addPass(new OutputPass());
  const grade = new ShaderPass({
    uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uTint: { value: new THREE.Vector3(1, 1, 1) }, uVig: { value: 0.35 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }',
    fragmentShader: `uniform sampler2D tDiffuse; uniform float uTime; uniform vec3 uTint; uniform float uVig; varying vec2 vUv;
      float rnd(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)) + uTime) * 43758.5453); }
      void main(){
        vec3 c = texture2D(tDiffuse, vUv).rgb;
        c = (c - 0.5) * 1.06 + 0.5;
        float l = dot(c, vec3(0.299, 0.587, 0.114));
        c = mix(vec3(l), c, 1.1) * uTint;
        c += vec3(0.012, 0.008, 0.02) * (1.0 - l); // ombres légèrement bleutées, comme sur pellicule
        float d = distance(vUv, vec2(0.5));
        c *= 1.0 - uVig * smoothstep(0.35, 0.9, d);
        c += (rnd(vUv * 731.0) - 0.5) * 0.025;
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  composer.addPass(grade);
  let tiltOn = true;

  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    renderer.setSize(w, h, false);
    composer.setSize(w, h);
    bloom.resolution.set(w / (low ? 3 : 2), h / (low ? 3 : 2));
    camera.aspect = w / h; camera.updateProjectionMatrix();
    tiltH.uniforms.h.value = 2.2 / w; tiltV.uniforms.v.value = 2.2 / h;
    // taille des particules en pixels : même perspective que la caméra
    const scale = (h * renderer.getPixelRatio()) / (2 * Math.tan((camera.fov * Math.PI) / 360));
    for (const sys of [snow, petals, steam, dust]) sys.m.uniforms.uScale.value = scale;
    life?.setScale(scale);
  }

  // ---------- Ambiance (heure, météo, saison) ----------
  const amb = { wet: 0, snowCover: 0, rain: 0, snowfall: 0, fog: 0, cloud: 0, flash: 0, nextFlash: 8, season: '', night: 0, bolt: null };
  const roofBase = new Map();
  let festivalOn = false;
  function setSeason(season) {
    if (season === amb.season) return;
    amb.season = season;
    for (const m of MATS.values()) if (m.userData.leaf) m.color.set(SEASON_LEAVES[season][m.userData.leaf]);
    festoon.ete.visible = JP && (season === 'ete' || festivalOn);
    festoon.hiver.visible = season === 'hiver' || (!JP && (season === 'ete' || festivalOn));
    petals.m.uniforms.uColor.value.set(season === 'automne' ? '#e0782f' : '#f6b8cc');
  }

  function updateAmbience(dt, hour, weather, season) {
    setSeason(season);
    const want = { rain: weather === 'pluie' ? 1 : weather === 'orage' ? 1.4 : 0, snowfall: weather === 'neige' ? 1 : 0, fog: weather === 'brouillard' ? 1 : 0, cloud: weather === 'soleil' ? 0 : weather === 'nuages' ? 0.6 : 1 };
    for (const k of Object.keys(want)) amb[k] += (want[k] - amb[k]) * Math.min(1, dt * 0.25);
    amb.wet = Math.min(1, Math.max(0, amb.wet + (amb.rain > 0.2 ? dt / 25 : -dt / 140)));
    amb.snowCover = Math.min(1, Math.max(0, amb.snowCover + (amb.snowfall > 0.3 ? dt / 60 : -dt / 200)));
    const n = (amb.night = nightOf(hour));
    const S = sky(hour);
    // nuages : lumière plus douce et plus grise
    const grey = new THREE.Color('#5a626e').lerp(new THREE.Color('#141824'), n);
    S.bg.lerp(grey, amb.cloud * 0.55);
    S.sunI *= 1 - amb.cloud * 0.68;
    if (amb.fog > 0.01) S.bg.lerp(new THREE.Color(n > 0.5 ? '#1c2230' : '#a8b0b8'), amb.fog * 0.7);
    if (amb.snowCover > 0.01 || amb.snowfall > 0.01) S.bg.lerp(new THREE.Color(n > 0.5 ? '#1a2030' : '#c4ccd6'), amb.snowfall * 0.4);
    // éclairs
    if (weather === 'orage' && (amb.nextFlash -= dt) < 0) { amb.flash = 1; amb.nextFlash = 6 + Math.random() * 12; api.onThunder?.(); }
    amb.flash = Math.max(0, amb.flash - dt * 3.5);
    const flicker = amb.flash > 0 ? amb.flash * (0.6 + Math.random() * 0.4) : 0;

    scene.background.copy(S.bg);
    dome.material.uniforms.top.value.copy(S.bg).multiplyScalar(0.55);
    dome.material.uniforms.horizon.value.copy(S.bg).lerp(S.sky, 0.25 * (1 - n));
    dome.position.copy(camera.position);
    stars.position.copy(camera.position);
    const clear = 1 - Math.min(1, amb.cloud + amb.fog + amb.rain);
    stars.material.opacity = n * clear * 0.9;
    const mAz = (hour / 24) * Math.PI * 2 + 0.8 + Math.PI;
    moon.position.set(camera.position.x + Math.cos(mAz) * 150, 70 + 40 * n, camera.position.z + Math.sin(mAz) * 150);
    moon.material.opacity = n * (0.4 + 0.6 * clear); moonHalo.material.opacity = n * clear * 0.35;
    if (n > 0.7 && clear > 0.6 && (shootT -= dt) < 0) { shootT = 12 + Math.random() * 25; shootLife = 1; const a = Math.random() * 6.28; shooting.position.set(camera.position.x + Math.cos(a) * 140, 90 + Math.random() * 30, camera.position.z + Math.sin(a) * 140); shooting.lookAt(camera.position); shooting.rotateZ(-0.4); }
    shootLife = Math.max(0, shootLife - dt * 1.4);
    shooting.material.opacity = Math.sin(shootLife * Math.PI) * 0.9;
    if (shootLife > 0) shooting.translateX(-dt * 60);
    scene.fog.color.copy(S.bg);
    const dist = api.cam ? 28 : camera.position.distanceTo(controls.target); // en plan de cinéma, brouillard normal
    scene.fog.near = dist * lerp(1.2, 0.35, amb.fog); scene.fog.far = dist * lerp(3.2, 1.5, amb.fog);
    hemi.color.copy(S.sky); hemi.groundColor.copy(S.ground);
    hemi.intensity = S.hemi * (1 - amb.cloud * 0.15) + flicker * 4;
    sun.color.copy(S.sun); sun.intensity = S.sunI;
    const az = (hour / 24) * Math.PI * 2 + 0.8, el = 0.75 + 0.25 * Math.sin(((hour - 6) / 12) * Math.PI);
    sun.position.set(controls.target.x + Math.cos(az) * 22 * Math.cos(el), 22 * Math.sin(el), controls.target.z + Math.sin(az) * 22 * Math.cos(el));
    sun.target.position.copy(controls.target);
    scene.environmentIntensity = lerp(0.3, 0.06, n);
    renderer.toneMappingExposure = lerp(1, 1.12, n);
    bloom.strength = lerp(0.25, 0.7, n);
    grade.uniforms.uTime.value = (grade.uniforms.uTime.value + dt) % 100;
    grade.uniforms.uTint.value.set(lerp(1.03, 0.96, n), lerp(1.0, 0.99, n), lerp(0.95, 1.06, n));

    // Lumières émissives : enseignes, lanternes, fenêtres (chaque groupe de fenêtres a ses horaires)
    const sched = { 0: 1, 1: 1, A: smooth(16.5, 18, hour) * (1 - smooth(23.5, 24, hour)) + (1 - smooth(6, 7, hour)) * 0.15, B: smooth(18, 19.5, hour) * (1 - smooth(22, 23, hour)) + smooth(5, 5.5, hour) * (1 - smooth(7, 8, hour)), C: smooth(17.5, 19, hour) * (1 - smooth(1, 2, hour + (hour < 12 ? 24 : 0) - 24)) };
    sched.C = hour > 12 ? smooth(17.5, 19, hour) : 1 - smooth(1, 2, hour);
    for (const m of MATS.values()) {
      const g = m.userData.glow;
      if (!g) continue;
      const s = sched[g.sched] ?? 1;
      m.emissiveIntensity = g.day + (g.night - g.day) * n * (g.sched === 'A' || g.sched === 'B' || g.sched === 'C' ? s : 1);
    }
    // Sol mouillé : plus sombre et brillant ; neige : blanc
    const snowC = new THREE.Color('#e8edf3');
    for (const m of groundMats) {
      (m.userData.tint ? m.color.copy(m.userData.tint) : m.color.setScalar(1)).multiplyScalar(1 - amb.wet * 0.45).lerp(snowC, amb.snowCover * 0.85);
      m.roughness = lerp(lerp(0.92, 0.16, amb.wet), 0.85, amb.snowCover);
    }
    for (const m of MATS.values()) if (m.userData.roof) {
      if (!roofBase.has(m)) roofBase.set(m, m.color.clone());
      m.color.copy(roofBase.get(m)).lerp(snowC, amb.snowCover * 0.9);
    }
    puddleMat.opacity = amb.wet * 0.85;
    // taches de lumière et reflets
    const toCam = new THREE.Vector3().subVectors(camera.position, controls.target).setY(0).normalize();
    const phi = Math.atan2(toCam.x, toCam.z);
    const poolO = n * 0.5, streakO = n * (amb.wet * 0.75 + 0.05) + amb.wet * 0.05;
    const each = list => { for (const o of list) {
      if (o.userData.pool) o.material.opacity = poolO * o.userData.pool;
      else if (o.userData.water) { o.material.opacity = n * 0.35 * o.userData.streak; if (o.material.opacity > 0.005) { o.rotation.set(-Math.PI / 2, 0, phi); const b = (o.userData.base ??= o.position.clone()); o.position.copy(b).addScaledVector(toCam, 1.3); } }
      else {
        o.material.opacity = streakO * o.userData.streak;
        if (o.material.opacity < 0.005) continue;
        // reflet : part de la lumière et s'étire vers la caméra
        o.rotation.set(-Math.PI / 2, 0, phi - worldRotY(o.parent));
        const base = (o.userData.base ??= o.position.clone());
        o.position.copy(o.parent.worldToLocal(o.parent.localToWorld(base.clone()).addScaledVector(toCam, 1.3)));
      }
    } };
    each(glows); each(terrain.glows);
    for (const P of plots) each(P.glows);
    for (const g of decorRoot.children) each(g.userData.glowMeshes);
    // pluie : opacité selon l'intensité
    rain.material.opacity = Math.min(1, amb.rain) * 0.22;
    ripples.material.opacity = Math.min(1, amb.rain) * 0.5;
    // lumières ponctuelles pour les bâtiments près de la caméra
    const near = plots.filter(P => P.info?.light).map(P => { const l = P.info.light, v = new THREE.Vector3(l.x, l.y, l.z).applyMatrix4(P.holder.matrixWorld); return { v, c: l.color, d: v.distanceToSquared(controls.target) }; }).sort((a, b) => a.d - b.d);
    points.forEach((l, k) => { const t = near[k]; l.intensity = t ? lerp(0.15, 3.2, n) : 0; if (t) { l.position.copy(t.v); l.color.set(t.c); } });
  }
  const worldRotY = o => { let r = 0; for (let p = o; p; p = p.parent) r += p.rotation.y; return r; };

  function updateParticles(dt, hour) {
    // pluie
    if (amb.rain > 0.02) {
      const sp = 11 * dt;
      for (let i = 0; i < N_RAIN; i++) {
        const k = i * 6;
        rainPos[k + 1] -= sp; rainPos[k + 4] -= sp;
        if (rainPos[k + 1] < 0) {
          const rs = ripState.find(r => r.t >= 1);
          const gy = groundY(rainPos[k], rainPos[k + 2]);
          if (rs && gy != null && Math.random() < 0.25) Object.assign(rs, { x: rainPos[k], z: rainPos[k + 2], t: 0, y: gy });
          resetDrop(i, 11 + Math.random() * 3);
        }
      }
      rainGeo.attributes.position.needsUpdate = true;
      rain.visible = true;
    } else rain.visible = false;
    ripState.forEach((r, k) => {
      r.t = Math.min(1, r.t + dt * 2.2);
      dummy.position.set(r.x, r.y, r.z); dummy.scale.setScalar(r.t < 1 ? 0.05 + r.t * 0.28 : 0.0001); dummy.updateMatrix();
      ripples.setMatrixAt(k, dummy.matrix);
    });
    ripples.instanceMatrix.needsUpdate = true;
    // neige
    snow.pts.visible = amb.snowfall > 0.02;
    if (snow.pts.visible) {
      for (let k = 0; k < snow.n; k++) {
        const i = k * 3, d = snow.data[k];
        snow.pos[i + 1] -= dt * (0.6 + (k % 5) * 0.08);
        snow.pos[i] += Math.sin((d.ph += dt)) * dt * 0.25;
        if (snow.pos[i + 1] < 0) { snow.pos[i + 1] = 11 + Math.random(); snow.pos[i] = Math.random() * 28 - 14; snow.pos[i + 2] = Math.random() * 44 - 22; }
        snow.alpha[k] = Math.min(1, amb.snowfall) * 0.9;
      }
      snow.geo.attributes.position.needsUpdate = snow.geo.attributes.aAlpha.needsUpdate = snow.geo.attributes.aSize.needsUpdate = true;
    }
    // pétales (printemps) et feuilles (automne)
    const leafy = (amb.season === 'printemps' || amb.season === 'automne') && amb.rain < 0.3 && amb.snowfall < 0.3;
    petals.pts.visible = leafy;
    if (leafy) {
      for (let k = 0; k < petals.n; k++) {
        const i = k * 3, d = petals.data[k];
        petals.pos[i + 1] -= dt * 0.35;
        petals.pos[i] += (Math.sin((d.ph += dt * 1.3)) * 0.5 + 0.3) * dt;
        petals.pos[i + 2] += Math.cos(d.ph * 0.7) * dt * 0.3;
        if (petals.pos[i + 1] < GROUND_Y) { petals.pos[i + 1] = 3 + Math.random() * 4; petals.pos[i] = Math.random() * 28 - 14; petals.pos[i + 2] = Math.random() * 28 - 14; }
        petals.alpha[k] = 0.9;
      }
      petals.geo.attributes.position.needsUpdate = petals.geo.attributes.aAlpha.needsUpdate = petals.geo.attributes.aSize.needsUpdate = true;
    }
    // vapeur des cuisines (pas en pleine nuit quand c'est fermé)
    if ((steamNext -= dt) < 0) {
      steamNext = low ? 0.12 : 0.05;
      const sources = [];
      plots.forEach(P => P.info?.steam.length && people.isOpen(P.type, hour) && P.info.steam.forEach(s => sources.push([P, s])));
      if (sources.length) {
        const [P, s] = sources[Math.floor(Math.random() * sources.length)];
        const v = new THREE.Vector3(s.x + (Math.random() - 0.5) * 0.15, s.y, s.z).applyMatrix4(P.model.matrixWorld);
        emit(steam, v.x, v.y, v.z, { life: 1.8 + Math.random(), vy: 0.32, vx: (Math.random() - 0.5) * 0.08, vz: (Math.random() - 0.5) * 0.08, size: 0.22 });
      }
    }
    steam.m.uniforms.uColor.value.set(amb.night > 0.5 ? '#ffe2c0' : '#ffffff');
    stepSystem(steam, dt);
    stepSystem(dust, dt);
  }

  // ---------- Animation des bâtiments neufs, écrans ----------
  let clock = 0;
  function updatePlots(dt) {
    clock += dt;
    for (const P of plots) {
      if (P.anim > 0 && P.model) {
        P.anim = Math.max(0, P.anim - dt * 1.4);
        const t = 1 - P.anim, e = 1 + Math.sin(t * Math.PI * 2.5) * (1 - t) * 0.25; // rebond
        P.model.scale.set(1, Math.max(0.01, Math.min(1.15, t * 1.2)) * (t >= 1 ? 1 : e), 1);
        if (P.anim === 0) P.model.scale.set(1, 1, 1);
      }
      if (P.info?.screens.length) P.info.screens.forEach((s, k) => s.material.color.setHSL((clock * 0.1 + k * 0.3) % 1, 0.7, 0.65));
    }
  }

  // ---------- Sélection ----------
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -GROUND_Y);
  function setRay(cx, cy) {
    const r = canvas.getBoundingClientRect();
    ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
  }
  function pick(cx, cy) {
    setRay(cx, cy);
    const hitL = ray.intersectObjects(life.pickables, true)[0];
    if (hitL) { const u = hitL.object.userData; return u.golden ? { golden: true } : u.vendor ? { vendor: true } : { cat: u.cat, point: hitL.point }; }
    const hitD = ray.intersectObjects(decorRoot.children, true)[0];
    const hitP = ray.intersectObjects(pickables, false)[0];
    if (hitD && (!hitP || hitD.distance < hitP.distance)) return { decor: hitD.object.userData.decor };
    if (hitP) return { plot: hitP.object.userData.plot };
    return null;
  }
  function groundAt(cx, cy) {
    setRay(cx, cy);
    const v = new THREE.Vector3();
    return ray.ray.intersectPlane(groundPlane, v) ? { x: v.x, z: v.z } : null;
  }
  // Contours des parcelles : mode construction, déplacement, sélection
  let rings = new Map(), pulse = 0;
  function highlight(map) { rings = map; }
  function updateRings(dt) {
    pulse += dt;
    plots.forEach((P, i) => {
      const c = rings.get(i);
      P.ring.material.opacity += ((c ? 0.55 + Math.sin(pulse * 4) * 0.25 : 0) - P.ring.material.opacity) * Math.min(1, dt * 10);
      if (c) P.ring.material.color.set(c);
    });
  }

  // ---------- Caméra ----------
  let fly = null;
  function focus(x, z, dist) {
    const dir = new THREE.Vector3().subVectors(camera.position, controls.target).normalize();
    fly = { from: controls.target.clone(), to: new THREE.Vector3(x, 0, z), d0: camera.position.distanceTo(controls.target), d1: dist != null ? dist * (camera.aspect < 1 ? 1.7 : 1) : camera.position.distanceTo(controls.target), dir, t: 0 }; // en portrait, on voit moins large : on recule
  }
  function updateCamera(dt) {
    if (fly) {
      fly.t = Math.min(1, fly.t + dt * 1.3 / Math.max(1, Math.abs(fly.d1 - fly.d0) / 10)); // les grands trajets prennent plus de temps
      const e = smooth(0, 1, fly.t);
      controls.target.lerpVectors(fly.from, fly.to, e);
      const dir = new THREE.Vector3().subVectors(camera.position, controls.target).normalize();
      camera.position.copy(controls.target).addScaledVector(dir, lerp(fly.d0, fly.d1, e));
      if (fly.t >= 1) fly = null;
    }
    const cx = THREE.MathUtils.clamp(controls.target.x, -12, 12) - controls.target.x, cz = THREE.MathUtils.clamp(controls.target.z, BASE.z0 + 2, BASE.z1 - 2) - controls.target.z;
    controls.target.x += cx; controls.target.z += cz; camera.position.x += cx; camera.position.z += cz;
    controls.target.y = 0;
    controls.update();
    // le flou de maquette se renforce quand on zoome
    const d = camera.position.distanceTo(controls.target);
    const k = tiltOn ? lerp(3.2, 1.2, smooth(8, 40, d)) : 0;
    tiltH.uniforms.h.value = k / canvas.clientWidth; tiltV.uniforms.v.value = k / canvas.clientHeight;
  }

  const api = {
    renderer, scene, camera, controls, plots, people, amb,
    syncPlot, syncDecor, pick, groundAt, highlight, setGhost, focus, resize,
    sync(state) { PLOTS.forEach((_, i) => syncPlot(i, state)); syncDecor(state); },
    setTilt(on) { tiltOn = on; },
    setFestival(on) { festivalOn = on; const s = amb.season; amb.season = ''; setSeason(s); },
    life, terrain, cam: null,
    update(dt, { hour, weather, season, state, festival = false, crowd = 1 }) {
      if (api.cam) { // plan de cinéma
        camera.position.copy(api.cam.pos); camera.lookAt(api.cam.look);
        const k = tiltOn ? lerp(4, 1.4, smooth(3, 30, camera.position.distanceTo(api.cam.look))) * (api.cam.blur ?? 1) : 0;
        tiltH.uniforms.h.value = k / canvas.clientWidth; tiltV.uniforms.v.value = k / canvas.clientHeight;
        controls.target.copy(api.cam.look);
      } else updateCamera(dt);
      terrain.update(dt, amb.night);
      life.update(dt, { night: amb.night, season, rain: amb.rain > 0.3 || amb.snowfall > 0.3, festival, hour });
      updateAmbience(dt, hour, weather, season);
      updateParticles(dt, hour);
      updatePlots(dt);
      updateRings(dt);
      people.update(dt, { hour, wet: amb.rain > 0.25 || amb.snowfall > 0.3, state, night: amb.night, camera, crowd });
      composer.render();
    },
    worldPos(i, local) { return new THREE.Vector3(local.x, local.y ?? 0, local.z).applyMatrix4(plots[i].holder.matrixWorld); },
  };
  return api;
}
