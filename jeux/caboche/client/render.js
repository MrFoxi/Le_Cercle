// Rendu de Caboche Cup : le « Caboche Arena », un stade de quartier en soirée sous les projecteurs. Pelouse tondue en
// bandes avec ses lignes, buts et filets qui bougent, parois vitrées, panneaux lumineux qui défilent, tribunes pleines
// d'un public qui saute à chaque but, tours d'éclairage, écran géant, ciel du soir. Les joueurs reprennent le modèle
// détaillé du Loup-Garou, avec une tête énorme. Effets : poussière d'herbe, traînée et feu du ballon, confettis.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { makeCharacter, animate, play } from '/loupgarou/characters.js';

const CC = window.CC, F = CC.F, TAU = Math.PI * 2;
let seed = 11;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
export const TEAM = ['#ff4d4d', '#3d8bff'];
const BODY_S = 0.75, SKULL_R = 0.195; // corps réduit ; la tête affichée a le rayon de la tête de la physique (CC.headR)
const headScale = (char, power) => (CC.CHARS[char].head * (power === 'tete' ? 2 : 1)) / (SKULL_R * BODY_S);

function canvasTex(w, h, draw, rep) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 16;
  if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...rep); }
  return t;
}
const std = (o) => new THREE.MeshStandardMaterial({ roughness: 0.8, ...o });
function put(parent, geo, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); m.castShadow = m.receiveShadow = true; parent.add(m); return m; }

export function createStadium(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 600);
  const uTime = { value: 0 }, uJump = { value: 0.12 };

  /* ---- Ciel du soir ---- */
  scene.add(new THREE.Mesh(new THREE.SphereGeometry(400, 32, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `varying vec3 vP; float h(vec3 p){ return fract(sin(dot(p, vec3(12.9, 78.2, 37.7))) * 43758.5); }
      void main(){ vec3 d = normalize(vP); float y = d.y;
        vec3 c = mix(vec3(0.95, 0.5, 0.35), vec3(0.32, 0.24, 0.55), smoothstep(0.0, 0.18, y)); c = mix(c, vec3(0.05, 0.07, 0.2), smoothstep(0.15, 0.6, y));
        c += vec3(1.0) * step(0.997, h(floor(d * 220.0))) * smoothstep(0.25, 0.5, y) * 0.8;
        gl_FragColor = vec4(c, 1.0);
        #include <colorspace_fragment>
      }`,
  })));
  // silhouettes de la ville au loin
  {
    const g = new THREE.Group(), m = new THREE.MeshBasicMaterial({ color: '#1a1530' }), win = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 1.6, 0.8) });
    for (let k = 0; k < 70; k++) {
      const a = (k / 70) * TAU, r = 150 + rnd() * 40, w = 8 + rnd() * 14, h = 10 + rnd() * 40;
      const b = put(g, new THREE.BoxGeometry(w, h, w), m, Math.cos(a) * r, h / 2 - 2, Math.sin(a) * r, 0, -a);
      b.castShadow = false;
      for (let i = 0; i < 6; i++) { const wn = put(g, new THREE.PlaneGeometry(0.9, 1.2), win, 0, 0, 0); wn.castShadow = false; wn.position.set(Math.cos(a) * (r - w / 2 - 0.1), 3 + rnd() * (h - 4), Math.sin(a) * (r - w / 2 - 0.1)); wn.position.x += Math.sin(a) * (rnd() - 0.5) * w; wn.position.z -= Math.cos(a) * (rnd() - 0.5) * w; wn.lookAt(0, wn.position.y, 0); }
    }
    scene.add(g);
  }

  /* ---- Lumières : projecteurs du stade ---- */
  scene.add(new THREE.HemisphereLight('#c8d4ff', '#2f4a28', 0.75));
  const key = new THREE.DirectionalLight('#fff6e8', 2.6);
  key.position.set(-14, 34, 20); key.castShadow = true; key.shadow.mapSize.set(4096, 4096);
  Object.assign(key.shadow.camera, { left: -26, right: 26, top: 18, bottom: -18, near: 5, far: 90 }); key.shadow.bias = -0.0003; key.shadow.normalBias = 0.02;
  scene.add(key);
  const fill = new THREE.DirectionalLight('#ffd8b0', 0.8); fill.position.set(20, 20, -18); scene.add(fill);

  /* ---- Pelouse ---- */
  const PX = 40, PW = (F.HL + 6) * 2, PD = (F.HW + 4) * 2;
  const pitchTex = canvasTex(PW * PX, PD * PX, (c, w, h) => {
    const X = x => (x + PW / 2) * PX, Z = z => (z + PD / 2) * PX;
    c.fillStyle = '#3f8f3a'; c.fillRect(0, 0, w, h);
    for (let k = 0, x = -PW / 2; x < PW / 2; x += 2.6, k++) { c.fillStyle = k % 2 ? '#469c40' : '#3a8735'; c.fillRect(X(x), 0, 2.6 * PX, h); }
    for (let i = 0; i < 90000; i++) { c.fillStyle = `rgba(${Math.random() < 0.5 ? '20,60,15' : '120,190,90'},${Math.random() * 0.18})`; c.fillRect(Math.random() * w, Math.random() * h, 1.5, 4); }
    c.strokeStyle = 'rgba(255,255,255,.92)'; c.lineWidth = 0.12 * PX;
    const rect = (x0, z0, x1, z1) => c.strokeRect(X(x0), Z(z0), (x1 - x0) * PX, (z1 - z0) * PX);
    rect(-F.HL, -F.HW, F.HL, F.HW);
    c.beginPath(); c.moveTo(X(0), Z(-F.HW)); c.lineTo(X(0), Z(F.HW)); c.stroke();
    c.beginPath(); c.arc(X(0), Z(0), 3.2 * PX, 0, TAU); c.stroke();
    c.fillStyle = '#fff'; c.beginPath(); c.arc(X(0), Z(0), 0.2 * PX, 0, TAU); c.fill();
    for (const s of [-1, 1]) {
      rect(s > 0 ? F.HL - 5 : -F.HL, -6.2, s > 0 ? F.HL : -F.HL + 5, 6.2);
      rect(s > 0 ? F.HL - 1.8 : -F.HL, -3.8, s > 0 ? F.HL : -F.HL + 1.8, 3.8);
      c.beginPath(); c.arc(X(s * (F.HL - 3.6)), Z(0), 0.18 * PX, 0, TAU); c.fill();
      c.beginPath(); c.arc(X(s * (F.HL - 3.6)), Z(0), 3 * PX, s > 0 ? Math.PI * 0.62 : -Math.PI * 0.38, s > 0 ? Math.PI * 1.38 : Math.PI * 0.38); c.stroke();
      for (const t of [-1, 1]) { c.beginPath(); c.arc(X(s * F.HL), Z(t * F.HW), 0.8 * PX, 0, TAU); c.stroke(); }
    }
    // logo au rond central
    c.save(); c.translate(X(0), Z(0)); c.fillStyle = 'rgba(255,255,255,.12)'; c.font = `bold ${1.2 * PX}px Arial Black, Arial`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('CABOCHE', 0, -0.9 * PX); c.fillText('CUP', 0, 0.9 * PX); c.restore();
  });
  const pitch = new THREE.Mesh(new THREE.PlaneGeometry(PW, PD), std({ map: pitchTex, roughness: 0.92 }));
  pitch.rotation.x = -Math.PI / 2; pitch.receiveShadow = true; scene.add(pitch);
  const apron = new THREE.Mesh(new THREE.PlaneGeometry(120, 90), std({ color: '#2a5a2a', roughness: 1 }));
  apron.rotation.x = -Math.PI / 2; apron.position.y = -0.02; apron.receiveShadow = true; scene.add(apron);

  /* ---- Parois vitrées, panneaux lumineux ---- */
  const glass = new THREE.MeshPhysicalMaterial({ color: '#cfe8ff', transparent: true, opacity: 0.1, roughness: 0.05, metalness: 0, clearcoat: 1, depthWrite: false, side: THREE.DoubleSide });
  const frame = std({ color: '#d8dde6', metalness: 0.8, roughness: 0.3 });
  const wallH = 3.4;
  for (const s of [-1, 1]) {
    put(scene, new THREE.PlaneGeometry(F.HL * 2, wallH), glass, 0, wallH / 2, s * F.HW).castShadow = false;
    for (let x = -F.HL; x <= F.HL + 0.01; x += 4) put(scene, new THREE.BoxGeometry(0.08, wallH, 0.08), frame, x, wallH / 2, s * F.HW);
    put(scene, new THREE.BoxGeometry(F.HL * 2, 0.08, 0.08), frame, 0, wallH, s * F.HW);
    for (const t of [-1, 1]) { // fonds, de chaque côté du but, et au-dessus
      const zc = t * (F.HW + F.GW / 2) / 2, wz = F.HW - F.GW / 2;
      put(scene, new THREE.PlaneGeometry(wz, wallH), glass, s * F.HL, wallH / 2, zc, 0, Math.PI / 2).castShadow = false;
    }
    put(scene, new THREE.PlaneGeometry(F.GW, wallH - F.GH), glass, s * F.HL, (wallH + F.GH) / 2, 0, 0, Math.PI / 2).castShadow = false;
  }
  const ledCanvas = document.createElement('canvas'); ledCanvas.width = 2048; ledCanvas.height = 96;
  {
    const c = ledCanvas.getContext('2d');
    const ads = [['CABOCHE CUP', '#ffd23f', '#1a1240'], ['⚽ GROSSES TÊTES, GROS BUTS', '#ffffff', '#c8202a'], ['LE CERCLE', '#1a1240', '#3dd8ff'], ['🔥 SUPER TIR', '#ffe14a', '#ff6a1a'], ['TÊTE GÉANTE 🎈', '#ffffff', '#7a3dff']];
    let x = 0;
    for (let k = 0; k < ads.length; k++) { const [txt, fg, bg] = ads[k], w = 2048 / ads.length; c.fillStyle = bg; c.fillRect(x, 0, w, 96); c.fillStyle = fg; c.font = 'bold 42px Arial Black, Arial'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(txt, x + w / 2, 50, w - 36); x += w; }
    for (let y = 0; y < 96; y += 3) { c.fillStyle = 'rgba(0,0,0,.25)'; c.fillRect(0, y, 2048, 1); }
  }
  const ledTex = new THREE.CanvasTexture(ledCanvas); ledTex.colorSpace = THREE.SRGBColorSpace; ledTex.wrapS = THREE.RepeatWrapping; ledTex.repeat.set(2, 1);
  const ledMat = new THREE.MeshStandardMaterial({ map: ledTex, emissive: '#ffffff', emissiveMap: ledTex, emissiveIntensity: 1.1, roughness: 0.4 });
  for (const s of [-1, 1]) put(scene, new THREE.BoxGeometry(F.HL * 2 + 4, 0.9, 0.2), ledMat, 0, 0.45, s * (F.HW + 1.3));

  /* ---- Buts : poteaux, barre, filets ---- */
  const postMat = std({ color: '#ffffff', roughness: 0.25, metalness: 0.1 });
  const netTex = canvasTex(256, 256, (c, w, h) => { c.clearRect(0, 0, w, h); c.strokeStyle = 'rgba(255,255,255,.9)'; c.lineWidth = 3; for (let k = 0; k <= w; k += 32) { c.beginPath(); c.moveTo(k, 0); c.lineTo(k, h); c.stroke(); c.beginPath(); c.moveTo(0, k); c.lineTo(w, k); c.stroke(); } }, [1, 1]);
  const netMat = (rx, ry) => { const t = netTex.clone(); t.repeat.set(rx, ry); t.needsUpdate = true; return new THREE.MeshStandardMaterial({ map: t, transparent: true, alphaTest: 0.3, side: THREE.DoubleSide, roughness: 0.9 }); };
  const nets = [];
  for (const s of [-1, 1]) {
    const g = new THREE.Group(); g.position.x = s * F.HL; scene.add(g);
    for (const z of [-F.GW / 2, F.GW / 2]) { put(g, new THREE.CylinderGeometry(F.POST, F.POST, F.GH, 16), postMat, 0, F.GH / 2, z); put(g, new THREE.CylinderGeometry(0.05, 0.05, F.GH, 8), postMat, s * F.GD, F.GH / 2, z); put(g, new THREE.CylinderGeometry(0.05, 0.05, F.GD, 8), postMat, (s * F.GD) / 2, F.GH, z, 0, 0, Math.PI / 2); }
    put(g, new THREE.CylinderGeometry(F.POST, F.POST, F.GW + F.POST * 2, 16), postMat, 0, F.GH, 0, Math.PI / 2);
    put(g, new THREE.CylinderGeometry(0.05, 0.05, F.GW, 8), postMat, s * F.GD, F.GH, 0, Math.PI / 2);
    const back = new THREE.Mesh(new THREE.PlaneGeometry(F.GW, F.GH, 12, 6), netMat(F.GW * 2, F.GH * 2)); back.position.set(s * F.GD, F.GH / 2, 0); back.rotation.y = Math.PI / 2; g.add(back);
    const top = new THREE.Mesh(new THREE.PlaneGeometry(F.GD, F.GW), netMat(F.GD * 2, F.GW * 2)); top.position.set((s * F.GD) / 2, F.GH, 0); top.rotation.x = -Math.PI / 2; g.add(top);
    for (const z of [-F.GW / 2, F.GW / 2]) { const sd = new THREE.Mesh(new THREE.PlaneGeometry(F.GD, F.GH), netMat(F.GD * 2, F.GH * 2)); sd.position.set((s * F.GD) / 2, F.GH / 2, z); g.add(sd); }
    nets.push({ back, base: back.geometry.attributes.position.array.slice(), kick: 0, s });
  }
  // drapeaux de coin
  for (const s of [-1, 1]) for (const t of [-1, 1]) { put(scene, new THREE.CylinderGeometry(0.03, 0.03, 1.6, 8), postMat, s * F.HL, 0.8, t * F.HW); put(scene, new THREE.PlaneGeometry(0.5, 0.35), std({ color: '#ffd23f', side: THREE.DoubleSide }), s * F.HL + 0.25 * -s, 1.45, t * F.HW); }

  /* ---- Tribunes et public ---- */
  const concrete = std({ color: '#8a8698', roughness: 0.95 }), seatMat = std({ color: '#3a2f6a', roughness: 0.6 });
  const crowd = [];
  const stand = (cx, cz, len, ry, roof = true, rows = 8) => { // les gradins montent vers +z local, loin du terrain
    const g = new THREE.Group(); g.position.set(cx, 0, cz); g.rotation.y = ry; scene.add(g);
    for (let r = 0; r < rows; r++) {
      put(g, new THREE.BoxGeometry(len, 0.55 + r * 0.55, 0.9), concrete, 0, (0.55 + r * 0.55) / 2 + 0.8, r * 0.9);
      put(g, new THREE.BoxGeometry(len, 0.12, 0.35), seatMat, 0, 1.4 + r * 0.55, r * 0.9 - 0.15);
      for (let x = -len / 2 + 0.4; x < len / 2 - 0.3; x += 0.62) if (rnd() < 0.92) crowd.push({ g, x: x + (rnd() - 0.5) * 0.15, y: 1.45 + r * 0.55, z: r * 0.9 + 0.05, r });
    }
    if (roof) put(g, new THREE.BoxGeometry(len + 1, 0.3, 9.5), std({ color: '#d8dde6', metalness: 0.6, roughness: 0.4 }), 0, 7.6, 3.6, -0.12); // toit
    if (roof) for (let x = -len / 2; x <= len / 2; x += len / 4) put(g, new THREE.CylinderGeometry(0.12, 0.12, 7, 8), frame, x, 4.2, 7.6);
  };
  const SZ = F.HW + 2.6, SX = F.HL + 3.2;
  stand(0, SZ + 1, F.HL * 2 + 6, 0, false, 3); stand(0, -SZ, F.HL * 2 + 6, Math.PI); stand(SX, 0, F.HW * 2 + 2, Math.PI / 2); stand(-SX, 0, F.HW * 2 + 2, -Math.PI / 2); // pas de toit côté caméra
  for (const c of crowd) c.g.updateMatrixWorld(true);
  {
    const bodyG = new THREE.CapsuleGeometry(0.2, 0.32, 4, 8).translate(0, 0.36, 0), headG = new THREE.SphereGeometry(0.17, 10, 8).translate(0, 0.86, 0);
    const mk = (geo, colorOf) => {
      const m = new THREE.MeshStandardMaterial({ roughness: 0.75 });
      m.onBeforeCompile = sh => { sh.uniforms.uTime = uTime; sh.uniforms.uJump = uJump; sh.vertexShader = 'uniform float uTime; uniform float uJump;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
        float ph = instanceMatrix[3].x * 1.7 + instanceMatrix[3].z * 2.3;
        transformed.y += max(0.0, sin(uTime * (5.0 + mod(ph, 3.0)) + ph)) * uJump;`); };
      const im = new THREE.InstancedMesh(geo, m, crowd.length), o = new THREE.Object3D(), v = new THREE.Vector3();
      crowd.forEach((c, i) => { v.set(c.x, c.y, c.z); c.g.localToWorld(v); o.position.copy(v); o.rotation.y = c.g.rotation.y; o.scale.setScalar(0.9 + rnd() * 0.25); o.updateMatrix(); im.setMatrixAt(i, o.matrix); im.setColorAt(i, colorOf(c, v)); });
      im.castShadow = false; im.receiveShadow = true; scene.add(im);
    };
    const shirts = ['#ff4d4d', '#ff4d4d', '#3d8bff', '#3d8bff', '#ffd23f', '#ffffff', '#2fd47a', '#ff8a3d'];
    mk(bodyG, (c, v) => new THREE.Color(rnd() < 0.55 ? (v.x < 0 ? TEAM[0] : TEAM[1]) : shirts[Math.floor(rnd() * shirts.length)]).offsetHSL(0, 0, (rnd() - 0.5) * 0.15));
    mk(headG, () => new THREE.Color(['#f6d0b0', '#e2b08a', '#b07850', '#7a4e32', '#5a3a26'][Math.floor(rnd() * 5)]));
  }

  /* ---- Tours d'éclairage et écran géant ---- */
  const lamp = new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#fff6e0', emissiveIntensity: 3.5 });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const g = new THREE.Group(); g.position.set(sx * (F.HL + 7), 0, sz * (F.HW + 8)); g.lookAt(0, 0, 0); scene.add(g);
    put(g, new THREE.CylinderGeometry(0.25, 0.4, 22, 10), frame, 0, 11, 0);
    put(g, new THREE.BoxGeometry(4.2, 2.6, 0.4), std({ color: '#2a2a33' }), 0, 22.5, 0.2, -0.5);
    for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) put(g, new THREE.CircleGeometry(0.38, 16), lamp, -1.5 + i, 21.8 + j * 0.8 + 0, 0.42 + j * 0.0, -0.5).position.z = 0.43 + Math.sin(0.5) * 0;
    const cone = new THREE.Mesh(new THREE.ConeGeometry(9, 24, 24, 1, true), new THREE.MeshBasicMaterial({ color: '#fff2d0', transparent: true, opacity: 0.035, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
    cone.position.set(0, 11, 9); cone.rotation.x = -0.9; g.add(cone);
  }
  const boardCanvas = document.createElement('canvas'); boardCanvas.width = 1024; boardCanvas.height = 384;
  const boardTex = new THREE.CanvasTexture(boardCanvas); boardTex.colorSpace = THREE.SRGBColorSpace;
  {
    const g = new THREE.Group(); g.position.set(0, 0, -(SZ + 9)); scene.add(g);
    for (const x of [-5, 5]) put(g, new THREE.BoxGeometry(0.5, 12, 0.5), frame, x, 6, 0);
    put(g, new THREE.BoxGeometry(13.2, 5.2, 0.5), std({ color: '#15151c' }), 0, 12.5, 0);
    put(g, new THREE.PlaneGeometry(12.6, 4.7), new THREE.MeshStandardMaterial({ map: boardTex, emissive: '#ffffff', emissiveMap: boardTex, emissiveIntensity: 1.2 }), 0, 12.5, 0.27);
  }
  function drawBoard(names, score, clock, flash) {
    const c = boardCanvas.getContext('2d'), w = 1024, h = 384;
    c.fillStyle = flash ? '#ffd23f' : '#0c0c18'; c.fillRect(0, 0, w, h);
    if (flash) { c.fillStyle = '#1a1240'; c.font = 'bold 190px Arial Black, Arial'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('BUT !', w / 2, h / 2 + 10); }
    else {
      c.textBaseline = 'middle'; c.font = 'bold 54px Arial'; c.textAlign = 'center';
      c.fillStyle = TEAM[0]; c.fillText((names[0] ?? '').slice(0, 12), w * 0.22, 90); c.fillStyle = TEAM[1]; c.fillText((names[1] ?? '').slice(0, 12), w * 0.78, 90);
      c.fillStyle = '#ffffff'; c.font = 'bold 170px Arial Black, Arial'; c.fillText(`${score[0]} - ${score[1]}`, w / 2, 230);
      c.font = 'bold 56px Arial'; c.fillStyle = '#ffd23f'; c.fillText(clock, w / 2, 345);
    }
    for (let y = 0; y < h; y += 4) { c.fillStyle = 'rgba(0,0,0,.2)'; c.fillRect(0, y, w, 1); }
    boardTex.needsUpdate = true;
  }
  drawBoard(['', ''], [0, 0], '2:00');

  /* ---- Ballon ---- */
  const ballTex = canvasTex(1024, 512, (c, w, h) => {
    c.fillStyle = '#ffffff'; c.fillRect(0, 0, w, h);
    const pts = []; const gr = (1 + Math.sqrt(5)) / 2;
    for (const [a, b, d] of [[0, 1, gr], [0, -1, gr], [0, 1, -gr], [0, -1, -gr]]) pts.push([a, b, d], [b, d, a], [d, a, b]);
    for (const [x, y, z] of pts) {
      const l = Math.hypot(x, y, z), lon = Math.atan2(z / l, x / l), lat = Math.asin(y / l), u = ((lon / TAU) + 0.5) * w, v = (0.5 - lat / Math.PI) * h;
      for (const du of [-w, 0, w]) { c.fillStyle = '#16161e'; c.beginPath(); for (let k = 0; k < 5; k++) { const a = (k / 5) * TAU - Math.PI / 2, sx = 50 / Math.max(0.35, Math.cos(lat)); c.lineTo(u + du + Math.cos(a) * sx, v + Math.sin(a) * 50); } c.closePath(); c.fill(); }
    }
    c.strokeStyle = 'rgba(0,0,0,.25)'; c.lineWidth = 3; for (let k = 0; k < 40; k++) { c.beginPath(); c.moveTo(Math.random() * w, Math.random() * h); c.lineTo(Math.random() * w, Math.random() * h); c.stroke(); }
  });
  const ball = new THREE.Mesh(new THREE.SphereGeometry(CC.BALL.r, 40, 28), new THREE.MeshPhysicalMaterial({ map: ballTex, roughness: 0.35, clearcoat: 0.8, clearcoatRoughness: 0.2, emissive: '#ff5a10', emissiveIntensity: 0 }));
  ball.castShadow = true; scene.add(ball);
  const ballShadow = new THREE.Mesh(new THREE.CircleGeometry(0.5, 24), new THREE.MeshBasicMaterial({ color: '#000000', transparent: true, opacity: 0.35, depthWrite: false }));
  ballShadow.rotation.x = -Math.PI / 2; ballShadow.position.y = 0.015; scene.add(ballShadow);
  const fireGlow = new THREE.PointLight('#ff7a20', 0, 8, 2); scene.add(fireGlow);

  /* ---- Particules ---- */
  const MAXP = 2500, pPos = new Float32Array(MAXP * 3), pCol = new Float32Array(MAXP * 3), pSize = new Float32Array(MAXP), pAlpha = new Float32Array(MAXP);
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3)); pGeo.setAttribute('aColor', new THREE.BufferAttribute(pCol, 3)); pGeo.setAttribute('aSize', new THREE.BufferAttribute(pSize, 1)); pGeo.setAttribute('aAlpha', new THREE.BufferAttribute(pAlpha, 1));
  const pU = { scale: { value: 500 } };
  const points = new THREE.Points(pGeo, new THREE.ShaderMaterial({
    uniforms: pU, transparent: true, depthWrite: false,
    vertexShader: 'attribute vec3 aColor; attribute float aSize, aAlpha; uniform float scale; varying vec3 vC; varying float vA; void main(){ vC = aColor; vA = aAlpha; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = aSize * scale / -mv.z; gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'varying vec3 vC; varying float vA; void main(){ vec2 d = gl_PointCoord - 0.5; float a = smoothstep(0.5, 0.2, length(d)) * vA; if (a < 0.01) discard; gl_FragColor = vec4(vC, a);\n#include <colorspace_fragment>\n}',
  }));
  points.frustumCulled = false; scene.add(points);
  const parts = [];
  const emit = (x, y, z, o = {}) => { if (parts.length < MAXP) parts.push({ x, y, z, vx: o.vx ?? 0, vy: o.vy ?? 0, vz: o.vz ?? 0, g: o.g ?? 0, life: o.life ?? 1, max: o.life ?? 1, size: o.size ?? 0.2, grow: o.grow ?? 0, col: new THREE.Color(o.color ?? '#ffffff').multiplyScalar(o.hdr ?? 1), drag: o.drag ?? 0 }); };
  const r = (a = 1) => (Math.random() - 0.5) * a;
  let shake = 0;
  const fx = {
    kick(e) { for (let k = 0; k < (e.fire ? 40 : 14); k++) emit(e.x, e.y, e.z, { vx: r(5), vy: Math.random() * 4, vz: r(5), g: 9, life: 0.4, size: e.fire ? 0.35 : 0.15, color: e.fire ? '#ff9a2a' : '#ffffff', hdr: e.fire ? 3 : 1.5 }); shake = Math.max(shake, e.fire ? 0.5 : e.p > 20 ? 0.18 : 0.06); },
    dust(x, z, n = 10, col = '#7aa060') { for (let k = 0; k < n; k++) emit(x + r(0.5), 0.1, z + r(0.5), { vx: r(3), vy: 1 + Math.random() * 2, vz: r(3), g: 6, life: 0.6, size: 0.25, grow: 0.6, color: col, drag: 2 }); },
    spark(x, y, z, col = '#ffffff', n = 20) { for (let k = 0; k < n; k++) emit(x, y, z, { vx: r(8), vy: r(8), vz: r(8), life: 0.35, size: 0.12, color: col, hdr: 2.5, drag: 3 }); },
    goal(side) {
      const gx = (side === 0 ? 1 : -1) * F.HL;
      for (let k = 0; k < 400; k++) emit(gx + r(10), 6 + Math.random() * 6, r(18), { vx: r(3), vy: 2 + Math.random() * 3, vz: r(3), g: 3, life: 3 + Math.random(), size: 0.28, color: ['#ff4d4d', '#3d8bff', '#ffd23f', '#2fd47a', '#ffffff', '#ff8acb'][k % 6], drag: 0.6 });
      for (let k = 0; k < 60; k++) emit(gx, 1.4, r(F.GW), { vx: -Math.sign(gx) * Math.random() * 6, vy: Math.random() * 6, vz: r(6), g: 9, life: 0.8, size: 0.2, color: '#ffffff', hdr: 3 });
      nets[side === 0 ? 1 : 0].kick = 1; shake = 0.9; jumpUntil = performance.now() / 1000 + 5;
    },
    shake(v) { shake = Math.max(shake, v); },
  };
  let jumpUntil = 0;

  /* ---- Joueurs ---- */
  const chars = new Map();
  function syncPlayers(list) { // [{ name, char, side }]
    const seen = new Set();
    for (const p of list) {
      seen.add(p.name);
      const key = `${p.char}|${p.side}`, cur = chars.get(p.name);
      if (cur?.key === key) continue;
      if (cur) scene.remove(cur.ch.root);
      const look = [...CC.CHARS[p.char].look]; look[4] = p.side; // maillot à la couleur de l'équipe
      const ch = makeCharacter(look, TEAM[p.side]);
      ch.root.scale.setScalar(BODY_S); ch.head.scale.setScalar(headScale(p.char));
      ch.root.traverse(o => { if (o.isMesh) o.castShadow = true; });
      scene.add(ch.root);
      chars.set(p.name, { ch, key, char: p.char, head: headScale(p.char) });
    }
    for (const [n, c] of chars) if (!seen.has(n)) { scene.remove(c.ch.root); chars.delete(n); }
  }
  const celebrate = (name, e) => { const c = chars.get(name); if (c) play(c.ch, e, performance.now() / 1000); };
  const spawnFx = (kind, p) => { if (kind === 'drop') emit(p.x, p.y, p.z, { vy: 1, g: 6, life: 0.6, size: 0.06, color: '#7fd0ff' }); if (kind === 'note') emit(p.x, p.y, p.z, { vy: 1, life: 1, size: 0.2, color: '#ffd23f', hdr: 2 }); if (kind === 'puff') emit(p.x, p.y, p.z, { vy: 1, life: 0.6, size: 0.3, grow: 0.5, color: '#dddddd' }); if (kind === 'heart') emit(p.x, p.y, p.z, { vy: 1, life: 1, size: 0.25, color: '#ff4f7a', hdr: 2 }); };
  const tmp = new THREE.Vector3();
  // Pose d'un joueur selon l'état de la physique : marche, saut, frappe, glissade, à terre ; tête géante.
  function posePlayer(name, p, dt, t) {
    const c = chars.get(name); if (!c) return;
    const ch = c.ch, ro = ch.root;
    ro.position.set(p.x, p.y, p.z);
    const ry = Math.PI / 2 - p.face; let d = ry - ro.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d)); ro.rotation.y += d * Math.min(1, dt * 16);
    animate(ch, dt, t, { moving: Math.hypot(p.vx, p.vz) * 0.45, seated: false }, spawnFx);
    const [L, R] = ch.legs;
    if (!p.ground && p.stun <= 0 && p.tackleT <= 0) { L.hip.rotation.x = -0.7; L.knee.rotation.x = 1.2; R.hip.rotation.x = -0.3; R.knee.rotation.x = 0.8; }
    if (p.kickT > 0) { const u = 1 - p.kickT / 0.2, a = u < 0.3 ? (u / 0.3) * 0.9 : 0.9 - Math.min(1, (u - 0.3) / 0.25) * 2.7; R.hip.rotation.x = a; R.knee.rotation.x = u < 0.3 ? 1.1 : Math.max(0, 1.1 - (u - 0.3) * 6); ch.arms[0].sh.rotation.z = 0.9; ch.arms[1].sh.rotation.z = -0.6; ch.chest.rotation.x = -0.15; }
    if (p.tackleT > 0) { ch.body.rotation.x = -1.05; ch.body.position.y = 0.42; L.hip.rotation.x = -1.4; R.hip.rotation.x = -1.2; L.knee.rotation.x = 0.2; R.knee.rotation.x = 0.4; if (Math.random() < 0.6) fx.dust(p.x, p.z, 1); }
    if (p.stun > 0.25) { ch.body.rotation.x = -1.45; ch.body.position.y = 0.3; ch.arms[0].sh.rotation.z = 1.5; ch.arms[1].sh.rotation.z = -1.5; }
    const hs = headScale(c.char, p.power); c.head += (hs - c.head) * Math.min(1, dt * 8); ch.head.scale.setScalar(c.head);
    if (p.stun > 0) { const hp = ch.head.localToWorld(tmp.set(0, 0.5, 0)); if (Math.random() < 0.15) emit(hp.x + r(0.6), hp.y + 0.3, hp.z + r(0.6), { vy: 0.5, life: 0.5, size: 0.16, color: '#ffe14a', hdr: 2 }); }
    if (p.gauge >= 1 && Math.random() < 0.3) emit(p.x + r(0.8), 0.2 + Math.random() * 2, p.z + r(0.8), { vy: 1.2, life: 0.6, size: 0.1, color: TEAM[p.side], hdr: 3 });
    if (p.power && Math.random() < 0.5) emit(p.x + r(1), 0.3 + Math.random() * 2.4, p.z + r(1), { vy: 1.5, life: 0.5, size: 0.14, color: p.power === 'super' ? '#ff8a2a' : '#c08aff', hdr: 3 });
  }
  const headPos = name => { const c = chars.get(name); return c ? c.ch.head.localToWorld(new THREE.Vector3(0, 0.62, 0)) : null; };
  const project = v => { tmp.copy(v).project(camera); return { x: (tmp.x * 0.5 + 0.5) * innerWidth, y: (-tmp.y * 0.5 + 0.5) * innerHeight, ok: tmp.z < 1 }; };

  /* ---- Rendu ---- */
  const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType }));
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.45, 0.5, 1.0); composer.addPass(bloom);
  composer.addPass(new OutputPass()); composer.addPass(new SMAAPass());
  function resize() {
    const w = innerWidth, h = innerHeight;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
    composer.setPixelRatio(renderer.getPixelRatio()); composer.setSize(w, h);
    pU.scale.value = (h * renderer.getPixelRatio()) / (2 * Math.tan((camera.fov * Math.PI) / 360));
  }
  // Caméra de télévision : de côté, en hauteur, elle suit le ballon (et se rapproche d'un but marqué).
  const cam = { x: 0, z: 0, dist: 1, focus: null };
  let lastBall = new THREE.Vector3(), trailAt = 0;
  function update(dt, t, b) {
    uTime.value = t;
    uJump.value += ((t < jumpUntil ? 0.55 : 0.1) - uJump.value) * Math.min(1, dt * 3);
    ledTex.offset.x = (t * 0.03) % 1;
    // ballon
    if (b) {
      ball.position.set(b.x, b.y, b.z);
      const mv = tmp.copy(ball.position).sub(lastBall), dist = mv.length();
      if (dist > 1e-4 && dist < 2) { const axis = new THREE.Vector3(mv.z, 0, -mv.x).normalize(); ball.rotateOnWorldAxis(axis, dist / CC.BALL.r); }
      lastBall.copy(ball.position);
      ballShadow.position.set(b.x, 0.015, b.z); const hk = Math.max(0.25, 1 - b.y / 10); ballShadow.scale.setScalar(hk); ballShadow.material.opacity = 0.4 * hk;
      ball.material.emissiveIntensity = b.fire ? 1.6 + Math.sin(t * 30) * 0.4 : 0;
      fireGlow.position.copy(ball.position); fireGlow.intensity = b.fire ? 30 : 0;
      const speed = dist / Math.max(dt, 1e-3);
      if (t > trailAt && speed > 12) { trailAt = t + 0.012; emit(b.x, b.y, b.z, { life: 0.3, size: b.fire ? 0.6 : 0.3, color: b.fire ? '#ff7a1a' : '#ffffff', hdr: b.fire ? 3 : 1.2 }); }
      if (b.fire) for (let k = 0; k < 3; k++) emit(b.x + r(0.3), b.y + r(0.3), b.z + r(0.3), { vy: 1.5, life: 0.4, size: 0.4, grow: -0.5, color: k ? '#ff9a2a' : '#ffe07a', hdr: 3.5 });
      const tx = Math.max(-F.HL * 0.62, Math.min(F.HL * 0.62, b.x)), k = 1 - Math.exp(-dt * 2.2);
      cam.x += ((cam.focus?.x ?? tx) - cam.x) * k; cam.z += ((cam.focus ? 0 : b.z * 0.25) - cam.z) * k; cam.dist += ((cam.focus ? 0.62 : 1) - cam.dist) * k;
    }
    const narrow = camera.aspect < 1.2 ? 1.6 : 1;
    const sx = r(shake) * 0.6, sy = r(shake) * 0.6; shake = Math.max(0, shake - dt * 1.6);
    camera.position.set(cam.x * 0.85 + sx, 13.5 * cam.dist * narrow + sy, (cam.z + 25.5) * cam.dist * narrow + (1 - cam.dist) * 4);
    camera.lookAt(cam.x, 0.4, cam.z * 0.6 - 0.8);
    // filets qui ondulent après un but
    for (const n of nets) {
      if (n.kick <= 0.001) continue;
      n.kick *= Math.exp(-dt * 2.5);
      const pos = n.back.geometry.attributes.position, b0 = n.base;
      for (let i = 0; i < pos.count; i++) { const x = b0[i * 3], y = b0[i * 3 + 1]; pos.setZ(i, b0[i * 3 + 2] + Math.sin(t * 18 + x * 2 + y * 3) * 0.12 * n.kick + (1 - (Math.abs(x) / (F.GW / 2)) ** 2) * (1 - Math.abs(y) / (F.GH / 2)) * 0.5 * n.kick); }
      pos.needsUpdate = true;
    }
    // particules
    let w = 0;
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i]; p.life -= dt;
      if (p.life <= 0) { parts[i] = parts[parts.length - 1]; parts.pop(); continue; }
      p.vy -= p.g * dt; if (p.drag) { const d = Math.exp(-p.drag * dt); p.vx *= d; p.vy *= d; p.vz *= d; }
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; if (p.y < 0.03) { p.y = 0.03; p.vy = 0; p.vx *= 0.8; p.vz *= 0.8; }
      const a = Math.min(1, p.life / Math.min(0.4, p.max * 0.5));
      pPos[w * 3] = p.x; pPos[w * 3 + 1] = p.y; pPos[w * 3 + 2] = p.z; pCol[w * 3] = p.col.r; pCol[w * 3 + 1] = p.col.g; pCol[w * 3 + 2] = p.col.b;
      pSize[w] = Math.max(0.01, p.size * (1 + p.grow * (p.max - p.life))); pAlpha[w] = a; w++;
    }
    pGeo.setDrawRange(0, w);
    for (const k of ['position', 'aColor', 'aSize', 'aAlpha']) pGeo.attributes[k].needsUpdate = true;
    composer.render();
  }
  resize();
  return { resize, update, syncPlayers, posePlayer, celebrate, headPos, project, fx, cam, drawBoard, chars };
}
