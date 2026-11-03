// Rendu 3D du flipper (Three.js) : la table est construite dans ses coordonnées (cm), puis inclinée.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { R, jetOn } from './physics.js';

export const LOW = matchMedia('(pointer: coarse)').matches || /[?&](low|mobile)/.test(location.search);
const TILT = (7 * Math.PI) / 180;
const W = 52, H = 110;

// Apparences de bille (débloquées dans la progression)
export const SKINS = {
  chrome: { name: 'Chrome', color: '#ffffff', metal: 1, rough: 0.06 },
  or: { name: 'Or', color: '#ffc94d', metal: 1, rough: 0.1 },
  neon: { name: 'Néon', color: '#7df9ff', metal: 0.6, rough: 0.15, emissive: '#22d3ee', trail: '#22d3ee' },
  feu: { name: 'Feu', color: '#ff9a4d', metal: 0.8, rough: 0.2, emissive: '#ff4d00', trail: '#ff6a00' },
};

const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.4, metalness: 0, ...o });

// Hasard reproductible (le décor est le même à chaque partie)
const seeded = seed => () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

// Fonds peints : un par univers.
const PAINTERS = {
  arcade(x, P, col, c) {
    const bg = x.createLinearGradient(0, 0, 0, c.height);
    bg.addColorStop(0, '#2a0b4d'); bg.addColorStop(0.5, col.felt); bg.addColorStop(1, '#090418');
    x.fillStyle = bg; x.fillRect(0, 0, c.width, c.height);
    const [cx, cy] = P(23, 64);
    for (let i = 0; i < 36; i++) {
      const a = (i / 36) * Math.PI * 2;
      x.fillStyle = i % 2 ? 'rgba(255,46,136,.07)' : 'rgba(34,211,238,.05)';
      x.beginPath(); x.moveTo(cx, cy); x.arc(cx, cy, 1600, a, a + Math.PI / 36); x.fill();
    }
    x.strokeStyle = 'rgba(255,46,136,.35)'; x.lineWidth = 3;
    for (let i = 0; i <= 12; i++) { const [ax, ay] = P(23 + (i - 6) * 1.5, 36); const [bx, by] = P(23 + (i - 6) * 7, 4); x.beginPath(); x.moveTo(ax, ay); x.lineTo(bx, by); x.stroke(); }
    for (let j = 0; j < 7; j++) { const yy = 36 - j * j * 0.75; const [ax, ay] = P(0, yy); const [bx] = P(46, yy); x.beginPath(); x.moveTo(ax, ay); x.lineTo(bx, ay); x.stroke(); }
    x.lineWidth = 8; x.strokeStyle = col.c;
    x.beginPath(); x.arc(cx, cy + 40, 230, 0, Math.PI * 2); x.stroke();
  },
  space(x, P, col, c) {
    const rnd = seeded(42);
    const bg = x.createLinearGradient(0, 0, 0, c.height);
    bg.addColorStop(0, '#02030f'); bg.addColorStop(0.5, col.felt); bg.addColorStop(1, '#000005');
    x.fillStyle = bg; x.fillRect(0, 0, c.width, c.height);
    for (const [px, py, r, color] of [[14, 70, 420, 'rgba(138,92,255,.28)'], [34, 40, 380, 'rgba(34,211,238,.18)'], [28, 95, 300, 'rgba(255,77,216,.15)']]) {
      const [gx, gy] = P(px, py), gr = x.createRadialGradient(gx, gy, 0, gx, gy, r);
      gr.addColorStop(0, color); gr.addColorStop(1, 'rgba(0,0,0,0)');
      x.fillStyle = gr; x.fillRect(0, 0, c.width, c.height);
    }
    for (let i = 0; i < 900; i++) { x.fillStyle = `rgba(255,255,255,${0.3 + rnd() * 0.7})`; const r = rnd() < 0.08 ? 3 : 1.4; x.fillRect(rnd() * c.width, rnd() * c.height, r, r); }
    x.strokeStyle = 'rgba(255,179,107,.25)'; x.setLineDash([14, 12]); x.lineWidth = 3;
    for (const r of [120, 200, 290]) { x.beginPath(); x.ellipse(...P(23, 70), r * 1.3, r * 0.55, -0.25, 0, Math.PI * 2); x.stroke(); }
    x.setLineDash([]);
  },
  casino(x, P, col, c) {
    const [cx, cy] = P(23, 62);
    const bg = x.createRadialGradient(cx, cy, 50, cx, cy, 1700);
    bg.addColorStop(0, '#0f6b3d'); bg.addColorStop(1, col.felt);
    x.fillStyle = bg; x.fillRect(0, 0, c.width, c.height);
    x.strokeStyle = 'rgba(255,204,51,.08)'; x.lineWidth = 2;
    for (let i = -40; i < 80; i++) { x.beginPath(); x.moveTo(i * 40, 0); x.lineTo(i * 40 + c.height, c.height); x.stroke(); x.beginPath(); x.moveTo(i * 40, 0); x.lineTo(i * 40 - c.height, c.height); x.stroke(); }
    // La roue de roulette peinte autour du trou
    for (let i = 0; i < 37; i++) {
      const a = (i / 37) * Math.PI * 2;
      x.fillStyle = i === 0 ? 'rgba(0,160,70,.6)' : i % 2 ? 'rgba(227,27,59,.45)' : 'rgba(10,10,10,.55)';
      x.beginPath(); x.moveTo(cx, cy); x.arc(cx, cy, 190, a, a + (Math.PI * 2) / 37); x.fill();
    }
    x.fillStyle = col.felt; x.beginPath(); x.arc(cx, cy, 120, 0, Math.PI * 2); x.fill();
    x.strokeStyle = '#ffcc33'; x.lineWidth = 6; x.beginPath(); x.arc(cx, cy, 192, 0, Math.PI * 2); x.stroke();
    x.font = '120px serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
    const rnd = seeded(7);
    for (const s of ['♠', '♥', '♦', '♣', '♠', '♥', '♦', '♣']) { x.fillStyle = s === '♥' || s === '♦' ? 'rgba(227,27,59,.25)' : 'rgba(0,0,0,.25)'; x.fillText(s, ...P(6 + rnd() * 34, 20 + rnd() * 70)); }
  },
  jungle(x, P, col, c) {
    const rnd = seeded(11);
    const bg = x.createLinearGradient(0, 0, 0, c.height);
    bg.addColorStop(0, '#0a2410'); bg.addColorStop(0.5, col.felt); bg.addColorStop(1, '#06140a');
    x.fillStyle = bg; x.fillRect(0, 0, c.width, c.height);
    // Dalles du temple au centre
    x.strokeStyle = 'rgba(255,231,160,.12)'; x.lineWidth = 3;
    for (let r = 0; r < 14; r++) for (let k = 0; k < 6; k++) { const [px, py] = P(10 + k * 4.4 + (r % 2) * 2.2, 40 + r * 2.4); x.strokeRect(px, py, 84, 44); }
    // Rivière et feuillage
    x.strokeStyle = 'rgba(60,140,200,.25)'; x.lineWidth = 40;
    x.beginPath(); x.moveTo(...P(46, 95)); x.bezierCurveTo(...P(30, 80), ...P(40, 60), ...P(28, 40)); x.stroke();
    for (let i = 0; i < 160; i++) {
      const edge = rnd() < 0.5 ? rnd() * 10 : 36 + rnd() * 10;
      const [px, py] = P(edge, rnd() * 110);
      x.save(); x.translate(px, py); x.rotate(rnd() * Math.PI * 2);
      x.fillStyle = `rgba(${40 + rnd() * 60},${120 + rnd() * 100},${50 + rnd() * 40},.35)`;
      x.beginPath(); x.ellipse(0, 0, 60 + rnd() * 50, 18 + rnd() * 12, 0, 0, Math.PI * 2); x.fill();
      x.restore();
    }
  },
  volcan(x, P, col, c) {
    const rnd = seeded(5);
    const bg = x.createLinearGradient(0, 0, 0, c.height);
    bg.addColorStop(0, '#2b0a04'); bg.addColorStop(0.5, col.felt); bg.addColorStop(1, '#080202');
    x.fillStyle = bg; x.fillRect(0, 0, c.width, c.height);
    x.fillStyle = 'rgba(0,0,0,.35)';
    x.beginPath(); x.moveTo(...P(4, 60)); x.lineTo(...P(18, 92)); x.lineTo(...P(28, 92)); x.lineTo(...P(42, 60)); x.fill();
    // Fissures de lave lumineuses
    x.strokeStyle = '#ff6a00'; x.shadowColor = '#ff3d00'; x.shadowBlur = 25; x.lineCap = 'round';
    for (let i = 0; i < 22; i++) {
      let px = rnd() * c.width, py = rnd() * c.height;
      x.lineWidth = 2 + rnd() * 6;
      x.beginPath(); x.moveTo(px, py);
      for (let k = 0; k < 6; k++) { px += (rnd() - 0.5) * 160; py += (rnd() - 0.3) * 120; x.lineTo(px, py); }
      x.stroke();
    }
    x.shadowBlur = 0;
  },
};

// Décor peint de la table (texture dessinée par le code).
function playfieldTexture(table) {
  const S = 20, c = document.createElement('canvas');
  c.width = W * S; c.height = H * S;
  const x = c.getContext('2d'), P = (px, py) => [px * S, (H - py) * S];
  const col = table.colors;
  (PAINTERS[table.id] || PAINTERS.arcade)(x, P, col, c);
  x.font = '900 116px Impact, Arial Black, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillStyle = col.a; x.shadowColor = col.a; x.shadowBlur = 30;
  x.fillText(table.title, ...P(23, 35.5));
  x.font = '800 40px Arial Black, sans-serif'; x.fillStyle = col.b; x.shadowColor = col.b;
  x.fillText('LE CERCLE', ...P(23, 32.3));
  x.shadowBlur = 0;
  // Étiquettes des inserts lumineux
  x.font = '800 28px Arial, sans-serif'; x.fillStyle = 'rgba(255,255,255,.85)';
  for (const l of table.lights) if (l.label && !l.big) x.fillText(l.label, ...P(l.x, l.y - 1.9));
  x.font = '900 40px Arial Black, sans-serif'; x.fillStyle = 'rgba(255,170,60,.35)';
  for (const l of table.lights) if (l.big) x.fillText(l.label, ...P(l.x, l.y));
  x.font = '800 26px Arial'; x.fillStyle = col.c;
  x.fillText('1', ...P(17, 95.3)); x.fillText('2', ...P(23, 95.3)); x.fillText('3', ...P(29, 95.3));
  x.fillStyle = 'rgba(255,255,255,.6)'; x.font = '700 22px Arial';
  x.fillText('SPINNER', ...P(4.4, 53));
  // Couloir de lancement
  x.fillStyle = 'rgba(0,0,0,.35)'; x.fillRect(...P(46, 100), 6 * S, 100 * S);
  return new THREE.CanvasTexture(c);
}

// Texture de jeton de casino (bords rayés)
function chipTexture(color) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 32;
  const x = c.getContext('2d');
  for (let i = 0; i < 16; i++) { x.fillStyle = i % 2 ? '#fff' : color; x.fillRect(i * 16, 0, 16, 32); }
  return new THREE.CanvasTexture(c);
}

// Écran de score du fronton (affichage matriciel orange).
function makeDMD() {
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 256;
  const tex = new THREE.CanvasTexture(c);
  let last = '';
  return {
    tex,
    draw(lines, flash) {
      const key = lines.join('|') + flash;
      if (key === last) return;
      last = key;
      const x = c.getContext('2d');
      x.fillStyle = '#120600'; x.fillRect(0, 0, c.width, c.height);
      x.fillStyle = flash ? '#ffe9a8' : '#ff8a1e';
      x.textAlign = 'center'; x.textBaseline = 'middle';
      x.font = '900 110px "Courier New", monospace';
      x.fillText(lines[0], 512, 100);
      x.font = '700 46px "Courier New", monospace';
      x.fillText(lines[1] || '', 512, 200);
      // trame de points
      x.fillStyle = 'rgba(0,0,0,.45)';
      for (let i = 0; i < c.width; i += 6) x.fillRect(i, 0, 2, c.height);
      for (let j = 0; j < c.height; j += 6) x.fillRect(0, j, c.width, 2);
      tex.needsUpdate = true;
    },
  };
}

export function createView(canvas, table) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !LOW, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, LOW ? 1.25 : 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.95;
  renderer.shadowMap.enabled = !LOW;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#05030a');
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.4;
  const camera = new THREE.PerspectiveCamera(42, 1, 1, 600);

  // Table : x vers la droite, y vers le fond (incliné vers le haut), z au-dessus de la table.
  const T = new THREE.Group();
  T.rotation.x = -Math.PI / 2 + TILT;
  scene.add(T);

  scene.add(new THREE.HemisphereLight('#8a7dff', '#1a0a20', 0.6));
  const key = new THREE.DirectionalLight('#ffffff', 1.1);
  key.position.set(10, 120, 40);
  key.castShadow = !LOW;
  key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, { left: -40, right: 40, top: 70, bottom: -70, near: 10, far: 300 });
  key.target.position.set(26, 0, -50);
  scene.add(key, key.target);

  // Plateau et caisson
  const field = new THREE.Mesh(new THREE.PlaneGeometry(W, H), std('#ffffff', { map: playfieldTexture(table), roughness: 0.35 }));
  field.position.set(W / 2, H / 2, 0);
  field.receiveShadow = true;
  T.add(field);
  const wood = std('#3a1a0e', { roughness: 0.6 });
  const cab = (w, h, d, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wood); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; T.add(m); };
  cab(3, H + 6, 9, -1.5, H / 2, 1.5); cab(3, H + 6, 9, W + 1.5, H / 2, 1.5); cab(W + 6, 3, 9, W / 2, H + 1.5, 1.5); cab(W + 6, 4, 6, W / 2, -2, 0);
  const under = new THREE.Mesh(new THREE.BoxGeometry(W + 6, H + 6, 4), wood);
  under.position.set(W / 2, H / 2, -2.2);
  T.add(under);
  // Bandes chromées sur les rebords
  const chrome = std('#dfe3ea', { metalness: 1, roughness: 0.18 });
  for (const x of [-0.2, W + 0.2]) { const m = new THREE.Mesh(new THREE.BoxGeometry(0.5, H, 0.5), chrome); m.position.set(x, H / 2, 6); T.add(m); }

  // Fronton avec l'écran de score
  const dmd = makeDMD();
  const back = new THREE.Group();
  back.position.set(W / 2, H + 4, 0);
  back.rotation.x = Math.PI / 2 - TILT * 0.5;
  const box = new THREE.Mesh(new THREE.BoxGeometry(W + 6, 30, 6), wood);
  box.position.set(0, 15, -3);
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(40, 10), new THREE.MeshBasicMaterial({ map: dmd.tex, toneMapped: false }));
  screen.position.set(0, 19, 0.05);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(W + 2, 6), new THREE.MeshBasicMaterial({ color: table.colors.a, toneMapped: false }));
  sign.position.set(0, 7, 0.05);
  back.add(box, screen, sign);
  T.add(back);

  // Murs
  const mats = {
    outer: wood, lane: std('#2a2a36', { metalness: 0.6, roughness: 0.3 }), apron: std('#1d1d28', { metalness: 0.4 }),
    metal: chrome, gate: chrome, post: std('#ffffff', { roughness: 0.6 }), rubber: std('#f4f4f4', { roughness: 0.7 }),
    sling: std('#ffffff', { roughness: 0.5, emissive: table.colors.a, emissiveIntensity: 0 }), plunger: chrome,
  };
  const HEIGHT = { outer: 5, lane: 3, apron: 3, metal: 2.6, gate: 0.6, post: 2.4, rubber: 2.2, sling: 2.2, plunger: 1 };
  const objects = new Map(); // élément physique -> maillage
  for (const s of table.walls) {
    if (['target', 'drop', 'door', 'secret'].includes(s.kind)) continue;
    const len = Math.hypot(s.bx - s.ax, s.by - s.ay), h = HEIGHT[s.kind] ?? 2.5;
    const m = new THREE.Mesh(new THREE.BoxGeometry(len + 0.6, (s.r ?? 0.3) * 2, h), s.kind === 'sling' ? mats.sling.clone() : mats[s.kind] || chrome);
    m.position.set((s.ax + s.bx) / 2, (s.ay + s.by) / 2, h / 2);
    m.rotation.z = Math.atan2(s.by - s.ay, s.bx - s.ax);
    m.castShadow = m.receiveShadow = true;
    T.add(m);
    if (s.kind === 'sling') objects.set(s.id, { mesh: m, flash: 0 });
  }
  // Plastiques des slingshots (triangles translucides)
  for (const [a, b, c] of table.slings) {
    const shape = new THREE.Shape([new THREE.Vector2(...a), new THREE.Vector2(...b), new THREE.Vector2(...c)]);
    const m = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: 0.3, bevelEnabled: false }), std(table.colors.b, { transparent: true, opacity: 0.75, emissive: table.colors.b, emissiveIntensity: 0.6 }));
    m.position.z = 2.3;
    T.add(m);
  }

  // Bumpers : leur allure dépend de l'univers (néon, planète, jeton, idole, rocher de lave)
  const PLANET = { jupiter: '#d9a066', mars: '#c1440e', saturn: '#e3c27a' };
  function bumper(c) {
    const g = new THREE.Group(), mats = [];
    const glow = color => { const m = std(color, { emissive: color, emissiveIntensity: 0.4 }); mats.push(m); return m; };
    let lightColor = table.colors.a;
    if (PLANET[c.look]) {
      const planet = new THREE.Mesh(new THREE.SphereGeometry(c.r * 0.95, 32, 20), std(PLANET[c.look], { roughness: 0.7, emissive: PLANET[c.look], emissiveIntensity: 0.15 }));
      planet.position.z = c.r;
      mats.push(planet.material);
      g.add(planet);
      if (c.look === 'saturn') { const ring = new THREE.Mesh(new THREE.TorusGeometry(c.r * 1.55, 0.25, 6, 40), glow('#ffe7b0')); ring.position.z = c.r; ring.rotation.x = 0.5; g.add(ring); }
      if (c.look === 'jupiter') { const band = new THREE.Mesh(new THREE.TorusGeometry(c.r * 0.96, 0.18, 6, 40), glow('#a0522d')); band.position.z = c.r; g.add(band); }
      const halo = new THREE.Mesh(new THREE.TorusGeometry(c.r + 0.2, 0.2, 8, 40), glow(table.colors.b));
      halo.position.z = 0.25;
      g.add(halo);
      lightColor = PLANET[c.look];
    } else if (c.look === 'chip') {
      const edge = new THREE.Mesh(new THREE.CylinderGeometry(c.r, c.r, 1.4, 40, 1, true), std('#fff', { map: chipTexture(table.colors.a), roughness: 0.4 }));
      edge.rotation.x = Math.PI / 2; edge.position.z = 1.1;
      const top = new THREE.Mesh(new THREE.CircleGeometry(c.r, 40), glow(table.colors.a));
      top.position.z = 1.81;
      const inner = new THREE.Mesh(new THREE.RingGeometry(c.r * 0.55, c.r * 0.65, 40), glow(table.colors.b));
      inner.position.z = 1.82;
      g.add(edge, top, inner);
    } else if (c.look === 'idol') {
      const body = new THREE.Mesh(new THREE.CylinderGeometry(c.r * 0.8, c.r, 3.4, 8), std('#6f7a5a', { roughness: 0.9 }));
      body.rotation.x = Math.PI / 2; body.position.z = 1.7;
      const head = new THREE.Mesh(new THREE.SphereGeometry(c.r * 0.75, 16, 12), glow('#ffc23d'));
      head.position.z = 3.8;
      const eyes = new THREE.Mesh(new THREE.TorusGeometry(c.r * 0.82, 0.18, 6, 24), glow(table.colors.a));
      eyes.position.z = 2.8;
      g.add(body, head, eyes);
      lightColor = '#ffc23d';
    } else if (c.look === 'lava') {
      const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(c.r, 1), std('#2a1410', { roughness: 0.95, emissive: '#ff4d00', emissiveIntensity: 0.35, flatShading: true }));
      rock.position.z = c.r * 0.8;
      mats.push(rock.material);
      g.add(rock);
      lightColor = '#ff4d00';
    } else {
      const base = new THREE.Mesh(new THREE.CylinderGeometry(c.r + 0.3, c.r + 0.4, 0.8, 32), std('#111'));
      base.rotation.x = Math.PI / 2; base.position.z = 0.4;
      const body = new THREE.Mesh(new THREE.CylinderGeometry(c.r - 0.2, c.r - 0.2, 2.2, 32), std('#f2f2f2', { roughness: 0.3 }));
      body.rotation.x = Math.PI / 2; body.position.z = 1.9;
      const ring = new THREE.Mesh(new THREE.TorusGeometry(c.r - 0.1, 0.35, 12, 32), glow(table.colors.a));
      ring.position.z = 1.2;
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(c.r - 0.4, c.r - 0.1, 0.9, 32), std(table.colors.c, { emissive: table.colors.c, emissiveIntensity: 0.5, transparent: true, opacity: 0.9 }));
      mats.push(cap.material);
      cap.rotation.x = Math.PI / 2; cap.position.z = 3.4;
      g.add(base, body, ring, cap);
    }
    g.traverse(m => { if (m.isMesh) m.castShadow = true; });
    return { g, mats, lightColor };
  }
  for (const c of table.circles.filter(x => x.kind === 'bumper')) {
    const { g, mats, lightColor } = bumper(c);
    g.position.set(c.x, c.y, 0);
    T.add(g);
    const light = new THREE.PointLight(lightColor, 0, 18, 2);
    light.position.set(c.x, c.y, 6);
    T.add(light);
    objects.set(c.id, { mesh: g, mats, light, flash: 0 });
  }
  // Obstacles mobiles : vaisseau, serpents, rochers
  const movers = table.circles.filter(x => x.kind === 'mover').map(c => {
    const g = new THREE.Group(), mats = [];
    let tail = null;
    if (c.look === 'ufo') {
      const hull = new THREE.Mesh(new THREE.CylinderGeometry(c.r * 1.25, c.r * 0.6, 0.7, 24), std('#cfd6e3', { metalness: 1, roughness: 0.2 }));
      hull.rotation.x = Math.PI / 2; hull.position.z = 1.6;
      const domeMat = std('#7df9ff', { emissive: '#22d3ee', emissiveIntensity: 0.8, transparent: true, opacity: 0.85 });
      const dome = new THREE.Mesh(new THREE.SphereGeometry(c.r * 0.6, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), domeMat);
      dome.rotation.x = Math.PI / 2; dome.position.z = 1.9;
      mats.push(domeMat);
      g.add(hull, dome);
    } else if (c.look === 'snake') {
      const skin = std('#3ddc84', { roughness: 0.5, emissive: '#0f5a2a', emissiveIntensity: 0.4 });
      mats.push(skin);
      const head = new THREE.Mesh(new THREE.SphereGeometry(c.r, 16, 12), skin);
      head.position.z = c.r;
      const eyes = new THREE.Mesh(new THREE.SphereGeometry(c.r * 0.25, 8, 6), std('#ffe14d', { emissive: '#ffe14d', emissiveIntensity: 1.5 }));
      eyes.position.set(0, c.r * 0.7, c.r * 1.5);
      g.add(head, eyes);
      tail = Array.from({ length: 7 }, (_, i) => { const m = new THREE.Mesh(new THREE.SphereGeometry(c.r * (0.9 - i * 0.09), 12, 8), skin); T.add(m); return m; });
    } else {
      const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(c.r, 0), std('#3a2a24', { roughness: 1, flatShading: true, emissive: '#ff3d00', emissiveIntensity: 0.15 }));
      rock.position.z = c.r;
      mats.push(rock.material);
      g.add(rock);
    }
    g.traverse(m => { if (m.isMesh) m.castShadow = true; });
    T.add(g);
    objects.set(c.id, { mesh: g, mats, flash: 0 });
    return { id: c.id, g, tail, hist: [] };
  });

  // Flippers : silhouette effilée extrudée, tournant autour du pivot
  const flippers = table.flippers.map(f => {
    const shape = new THREE.Shape();
    shape.absarc(0, 0, f.r0, Math.PI / 2, (3 * Math.PI) / 2, false);
    shape.absarc(f.len, 0, f.r1, -Math.PI / 2, Math.PI / 2, false);
    shape.closePath();
    const g = new THREE.Group();
    g.position.set(f.x, f.y, 0.2);
    const body = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: 1.7, bevelEnabled: true, bevelThickness: 0.15, bevelSize: 0.12, bevelSegments: 2 }), std('#ffffff', { roughness: 0.35 }));
    const rubber = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: 0.6, bevelEnabled: false }), std('#e0102f', { roughness: 0.8 }));
    rubber.scale.set(1.04, 1.12, 1); rubber.position.z = 0.55;
    const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 2.4, 12), chrome);
    pin.rotation.x = Math.PI / 2; pin.position.z = 1.1;
    for (const m of [body, rubber]) m.castShadow = true;
    g.add(rubber, body, pin);
    T.add(g);
    return g;
  });

  // Rampes : rails chromés et plancher translucide
  for (const r of table.ramps) {
    const pts = r.points.map(([x, y, z]) => new THREE.Vector3(x, y, z));
    const curve = new THREE.CatmullRomCurve3(pts);
    const N = 120, frames = curve.getSpacedPoints(N);
    for (const side of [-1, 1]) {
      const rail = frames.map((p, i) => {
        const q = frames[Math.min(N, i + 1)], o = frames[Math.max(0, i - 1)];
        const dx = q.x - o.x, dy = q.y - o.y, L = Math.hypot(dx, dy) || 1;
        return new THREE.Vector3(p.x - (dy / L) * 1.75 * side, p.y + (dx / L) * 1.75 * side, p.z + 1.6);
      });
      const tube = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(rail), 160, 0.22, 8), chrome);
      tube.castShadow = true;
      T.add(tube);
    }
    // Plancher en ruban
    const pos = [];
    for (let i = 0; i < N; i++) {
      const a = frames[i], b = frames[i + 1], dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy) || 1, nx = -dy / L * 1.6, ny = dx / L * 1.6;
      const v = (p, s) => [p.x + nx * s, p.y + ny * s, p.z + 0.05];
      pos.push(...v(a, -1), ...v(a, 1), ...v(b, 1), ...v(a, -1), ...v(b, 1), ...v(b, -1));
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.computeVertexNormals();
    const floor = new THREE.Mesh(geo, std(r.color, { transparent: true, opacity: 0.45, emissive: r.color, emissiveIntensity: 0.35, side: THREE.DoubleSide, depthWrite: false }));
    T.add(floor);
    // Supports
    for (let i = 10; i < N; i += 18) {
      const p = frames[i];
      if (p.z < 1.5) continue;
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, p.z, 6), chrome);
      post.rotation.x = Math.PI / 2;
      post.position.set(p.x, p.y, p.z / 2);
      T.add(post);
    }
  }

  // Cibles (A, R, C, tombantes) et porte
  for (const s of table.walls.filter(w => ['target', 'drop', 'door', 'secret'].includes(w.kind))) {
    const len = Math.hypot(s.bx - s.ax, s.by - s.ay);
    const color = s.id === 'treasure' ? '#ffd700' : s.kind === 'secret' ? '#6f7a5a' : s.id === 'slot' ? '#ffcc33' : s.kind === 'door' ? '#ffd23f' : s.kind === 'drop' ? table.colors.b : table.colors.a;
    const mat = std(color, { emissive: color, emissiveIntensity: 0.25, roughness: 0.3 });
    const m = new THREE.Mesh(new THREE.BoxGeometry(len, s.kind === 'door' ? 0.5 : 0.8, 2.6), mat);
    m.position.set((s.ax + s.bx) / 2, (s.ay + s.by) / 2, 1.3);
    m.rotation.z = Math.atan2(s.by - s.ay, s.bx - s.ax);
    m.castShadow = true;
    T.add(m);
    if (s.active === false) m.position.z = -1.5; // trésor caché sous la table au départ
    objects.set(s.id, { mesh: m, mats: [mat], flash: 0, z: 1.3, target: s.kind === 'target' });
  }

  // Trou de capture, spinner, poussoir
  let roulette = null, rouletteSpin = 0.4;
  for (const sc of table.saucers) {
    if (table.fields.some(f => f.kind === 'pull' && f.x === sc.x && f.y === sc.y)) continue; // le trou noir a son propre décor
    const r = Math.min(1.9, sc.r);
    const hole = new THREE.Mesh(new THREE.CircleGeometry(r, 32), new THREE.MeshBasicMaterial({ color: '#000' }));
    hole.position.set(sc.x, sc.y, 0.03);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(r + 0.1, 0.25, 8, 32), sc.role === 'trap' ? std('#ff3344', { emissive: '#ff0022', emissiveIntensity: 0.8 }) : chrome);
    rim.position.copy(hole.position);
    T.add(hole, rim);
    if (sc.role === 'roulette') {
      const c = document.createElement('canvas');
      c.width = c.height = 256;
      const x = c.getContext('2d');
      for (let i = 0; i < 37; i++) { x.fillStyle = i === 0 ? '#0a8a3a' : i % 2 ? '#c8102e' : '#111'; x.beginPath(); x.moveTo(128, 128); x.arc(128, 128, 128, (i / 37) * Math.PI * 2, ((i + 1) / 37) * Math.PI * 2); x.fill(); }
      roulette = new THREE.Mesh(new THREE.RingGeometry(2.1, 3.1, 48), new THREE.MeshStandardMaterial({ map: new THREE.CanvasTexture(c), roughness: 0.3, metalness: 0.3 }));
      roulette.position.set(sc.x, sc.y, 0.06);
      T.add(roulette);
    }
  }
  // Zones de force : trou noir, jets de vapeur, lave
  const fieldFx = table.fields.map(f => {
    const g = new THREE.Group();
    g.position.set(f.x, f.y, 0.05);
    let spin = null, core = null;
    if (f.kind === 'pull') {
      g.add(new THREE.Mesh(new THREE.CircleGeometry(2.4, 40), new THREE.MeshBasicMaterial({ color: '#000' })));
      spin = new THREE.Mesh(new THREE.TorusGeometry(3, 0.55, 8, 48), std('#8a5cff', { emissive: '#b48cff', emissiveIntensity: 1.6 }));
      spin.scale.z = 0.3;
      const outer = new THREE.Mesh(new THREE.RingGeometry(f.r - 0.3, f.r, 64), new THREE.MeshBasicMaterial({ color: '#8a5cff', transparent: true, opacity: 0.18, toneMapped: false }));
      g.add(spin, outer);
    } else if (f.kind === 'jet') {
      g.add(new THREE.Mesh(new THREE.TorusGeometry(f.r - 0.4, 0.3, 8, 32), std('#3a3a3a', { metalness: 0.8 })));
      core = new THREE.Mesh(new THREE.CircleGeometry(f.r - 0.6, 32), std('#331100', { emissive: '#ffb300', emissiveIntensity: 0.2 }));
      g.add(core);
    } else if (f.kind === 'repel') {
      core = new THREE.Mesh(new THREE.CircleGeometry(f.r, 40), std('#ff4d00', { emissive: '#ff5a00', emissiveIntensity: 1.4, roughness: 0.6 }));
      const crust = new THREE.Mesh(new THREE.TorusGeometry(f.r, 0.5, 8, 40), std('#2a1410', { roughness: 1, flatShading: true }));
      g.add(core, crust);
    }
    T.add(g);
    return { f, spin, core };
  });
  // Portails lumineux (entrée) et leur sortie
  const portals = table.portals.map(p => {
    const mat = std(p.color, { emissive: p.color, emissiveIntensity: 1.8 });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(p.r + 0.2, 0.35, 10, 40), mat);
    ring.position.set(p.x, p.y, 0.6);
    const disc = new THREE.Mesh(new THREE.CircleGeometry(p.r, 32), new THREE.MeshBasicMaterial({ color: p.color, transparent: true, opacity: 0.25, toneMapped: false }));
    disc.position.set(p.x, p.y, 0.05);
    const exit = new THREE.Mesh(new THREE.TorusGeometry(1.4, 0.15, 6, 32), mat);
    exit.position.set(p.to.x, p.to.y, 0.1);
    T.add(ring, disc, exit);
    return { ring, exit };
  });
  // Décor : deux vaisseaux en orbite au-dessus de la table spatiale
  const ships = table.id === 'space' ? [0, Math.PI].map(ph => {
    const m = new THREE.Mesh(new THREE.ConeGeometry(0.8, 2.6, 8), std('#cfd6e3', { metalness: 1, roughness: 0.25, emissive: '#22d3ee', emissiveIntensity: 0.3 }));
    T.add(m);
    return { m, ph };
  }) : [];
  const spinner = new THREE.Group();
  spinner.position.set(4.3, 55, 2.6);
  const plate = new THREE.Mesh(new THREE.BoxGeometry(7.4, 0.12, 2.2), std('#dfe3ea', { metalness: 1, roughness: 0.15, emissive: table.colors.c, emissiveIntensity: 0.15 }));
  plate.position.z = -1.1;
  spinner.add(plate);
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 8, 8), chrome);
  bar.rotation.z = Math.PI / 2;
  spinner.add(bar);
  T.add(spinner);
  const plunger = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 6, 16), std('#d0102a', { metalness: 0.3 }));
  plunger.position.set(49, -1, 1.4);
  T.add(plunger);

  // Inserts lumineux
  const lights = new Map();
  for (const l of table.lights) {
    let geo;
    if (l.arrow) { const s = new THREE.Shape([new THREE.Vector2(0, 1.6), new THREE.Vector2(-1.3, -1), new THREE.Vector2(1.3, -1)]); geo = new THREE.ShapeGeometry(s); }
    else if (l.big) geo = new THREE.PlaneGeometry(12, 2.6);
    else geo = new THREE.CircleGeometry(l.label ? 1.25 : 1, 24);
    const mat = new THREE.MeshStandardMaterial({ color: '#111', emissive: l.color, emissiveIntensity: 0.06, roughness: 0.2, transparent: true, opacity: 0.95 });
    mat.userData.big = !!l.big;
    const m = new THREE.Mesh(geo, mat);
    m.position.set(l.x, l.y, 0.04);
    T.add(m);
    lights.set(l.id, mat);
  }

  // Billes
  const ballGeo = new THREE.SphereGeometry(R, 40, 28);
  let skin = SKINS.chrome;
  const ballMat = new THREE.MeshStandardMaterial({ color: '#fff', metalness: 1, roughness: 0.06, envMapIntensity: 1.6 });
  const balls = [];
  const trailMat = new THREE.MeshBasicMaterial({ color: '#fff', transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  const trailGeo = new THREE.SphereGeometry(R * 0.85, 12, 8);

  // Étincelles et éclats (particules)
  const MAXP = 400, pPos = new Float32Array(MAXP * 3), pCol = new Float32Array(MAXP * 3), parts = [];
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
  pGeo.setAttribute('color', new THREE.BufferAttribute(pCol, 3));
  const points = new THREE.Points(pGeo, new THREE.PointsMaterial({ size: 0.55, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  points.frustumCulled = false;
  T.add(points);
  function burst(x, y, z, color, n = 14, speed = 30) {
    const c = new THREE.Color(color);
    for (let i = 0; i < n && parts.length < MAXP; i++) {
      const a = Math.random() * Math.PI * 2, s = speed * (0.4 + Math.random());
      parts.push({ x, y, z, vx: Math.cos(a) * s, vy: Math.sin(a) * s, vz: Math.random() * speed * 0.6, life: 0.35 + Math.random() * 0.35, c });
    }
  }

  // Lueur (bloom) : les néons et inserts allumés rayonnent
  let composer = null;
  if (!LOW) {
    composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    composer.addPass(new UnrealBloomPass(new THREE.Vector2(512, 512), 0.55, 0.45, 0.96));
    composer.addPass(new OutputPass());
  }

  // Caméra : au-dessus du bas de la table, qui regarde vers le fond ; recule sur un écran en hauteur.
  let shake = 0, flashAll = 0;
  const camLocal = new THREE.Vector3(), lookLocal = new THREE.Vector3();
  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    renderer.setSize(w, h, false);
    composer?.setSize(w, h);
    camera.aspect = w / h;
    const a = w / h, far = a < 1 ? 1 + (1 - a) * 0.75 : Math.max(0.82, 1.15 - a * 0.18);
    camera.fov = a < 1 ? 48 : 42;
    camera.updateProjectionMatrix();
    camLocal.set(W / 2, -34 * far, 112 * far);
    lookLocal.set(W / 2, 44, 0);
  }
  addEventListener('resize', resize);
  resize();

  const tmp = new THREE.Vector3();
  return {
    setSkin(id) {
      skin = SKINS[id] || SKINS.chrome;
      ballMat.color.set(skin.color);
      ballMat.metalness = skin.metal;
      ballMat.roughness = skin.rough;
      ballMat.emissive.set(skin.emissive || '#000');
      ballMat.emissiveIntensity = skin.emissive ? 0.6 : 0;
      trailMat.color.set(skin.trail || '#fff');
    },
    // Effet visuel demandé par les règles
    fx(e) {
      const o = e.obj && objects.get(e.obj.id);
      if (o) o.flash = 1;
      if (e.kind === 'bumper') burst(e.x, e.y, 2, table.colors.c, 18, 40);
      if (e.kind === 'sling') burst(e.x, e.y, 1.5, table.colors.b, 10, 30);
      if (e.kind === 'target' || e.kind === 'drop') burst(e.x, e.y, 1.5, table.colors.a, 12, 25);
      if (e.kind === 'spark') burst(e.x, e.y, 1, e.metal ? '#fff6c8' : '#ffd0a0', Math.min(12, e.speed / 30), e.speed / 8);
      if (e.kind === 'shake') shake = 0.6;
      if (e.kind === 'multiball' || e.kind === 'jackpot' || e.kind === 'mission') { flashAll = e.kind === 'mission' ? 1.2 : 2.5; shake = Math.max(shake, 0.4); }
      if (e.kind === 'drain') shake = Math.max(shake, 0.25);
      if (e.kind === 'ramp') { const r = table.ramps.find(x => x.id === e.ramp); const p = r.points.at(-1); burst(p[0], p[1], 1, r.color, 24, 35); }
      if (e.kind === 'portal') { burst(e.x, e.y, 1, e.obj.color, 30, 40); burst(e.obj.x, e.obj.y, 1, e.obj.color, 16, 30); }
      if (e.kind === 'jet') burst(e.x, e.y, 1, '#ffffff', 26, 50);
      if (e.kind === 'burn') burst(e.x, e.y, 1, '#ff6a00', 20, 30);
      if (e.kind === 'mover') burst(e.x, e.y, 1.5, table.colors.a, 12, 30);
      if (e.kind === 'trap') shake = Math.max(shake, 0.3);
      if (e.kind === 'saucer' && e.obj?.role === 'trap') burst(e.obj.x, e.obj.y, 1, '#ff2244', 24, 30);
      if (e.kind === 'secret') burst(43, 72, 1, '#3ddc84', 30, 35);
      if (e.kind === 'roulette') rouletteSpin = 14;
      if (e.kind === 'slot') burst(43, 74, 2, '#ffcc33', 20, 30);

    },
    update(g, dt, charge) {
      const w = g.w;
      w.flippers.forEach((f, i) => (flippers[i].rotation.z = f.angle));
      // Billes (création à la demande) et traînées
      while (balls.length < w.balls.length) {
        const m = new THREE.Mesh(ballGeo, ballMat);
        m.castShadow = true;
        const trail = Array.from({ length: 6 }, () => { const t = new THREE.Mesh(trailGeo, trailMat); t.visible = false; T.add(t); return t; });
        T.add(m);
        balls.push({ m, trail, hist: [] });
      }
      balls.forEach((B, i) => {
        const b = w.balls[i];
        B.m.visible = !!b;
        B.trail.forEach(t => (t.visible = false));
        if (!b) return;
        B.m.position.set(b.x, b.y, b.z + R);
        B.m.rotation.x -= b.vy * dt / R;
        B.m.rotation.y += b.vx * dt / R;
        B.hist.unshift([b.x, b.y, b.z + R]);
        B.hist.length = Math.min(B.hist.length, 13);
        if (skin.trail && Math.hypot(b.vx, b.vy) > 80) B.trail.forEach((t, k) => {
          const h = B.hist[(k + 1) * 2];
          if (!h) return;
          t.visible = true;
          t.position.set(...h);
          t.scale.setScalar(1 - k * 0.14);
        });
      });
      // Inserts : allumés, éteints ou clignotants ; tout clignote pendant les grands moments
      const L = g.lightsState, blink = Math.sin(performance.now() / 110) > 0;
      flashAll = Math.max(0, flashAll - dt);
      for (const [id, mat] of lights) {
        const v = flashAll > 0 ? (Math.sin(performance.now() / 60 + id.length) > 0 ? 1 : 0) : L[id] === 2 ? (blink ? 1 : 0) : L[id];
        mat.emissiveIntensity = v ? 2.6 : 0.06;
        if (mat.userData.big) mat.opacity = v ? 0.85 : 0; // le grand voyant éteint laisse voir le mot peint
      }
      // Éclats des bumpers, slingshots et cibles
      for (const [id, o] of objects) {
        o.flash = Math.max(0, o.flash - dt * 5);
        if (o.light) { o.light.intensity = o.flash * 60; o.mesh.scale.setScalar(1 + o.flash * 0.08); }
        if (o.mats) for (const m of o.mats) m.emissiveIntensity = 0.25 + o.flash * 3 + (o.target && L[id] ? 1.5 : 0);
        if (o.mesh.material?.emissive && !o.mats) o.mesh.material.emissiveIntensity = o.flash * 3;
        // Cibles tombantes et porte qui s'enfoncent
        const wall = w.walls.find(s => s.id === id);
        if (wall && o.z !== undefined) {
          const target = wall.active ? o.z : -1.5;
          o.mesh.position.z += (target - o.mesh.position.z) * Math.min(1, dt * 12);
        }
      }
      spinner.rotation.x += g.spin * dt * 9;
      // Obstacles mobiles (positions de la physique) ; les serpents traînent leur corps derrière eux
      const now = performance.now() / 1000;
      for (const mv of movers) {
        const c = w.circles.find(x => x.id === mv.id);
        mv.g.position.set(c.x, c.y, 0);
        if (mv.tail) {
          mv.hist.unshift([c.x, c.y]);
          mv.hist.length = Math.min(mv.hist.length, 60);
          mv.tail.forEach((m, i) => { const h = mv.hist[(i + 1) * 7] || mv.hist.at(-1); m.position.set(h[0], h[1] + Math.sin(now * 6 + i) * 0.3, c.r * 0.8); });
        } else mv.g.rotation.z += dt * 1.5;
      }
      for (const { f, spin, core } of fieldFx) {
        if (spin) spin.rotation.z += dt * 3;
        if (f.kind === 'jet') {
          const on = jetOn(f, w.time);
          core.material.emissiveIntensity = on ? 3 : 0.2;
          if (on && Math.random() < 0.6) burst(f.x + (Math.random() - 0.5) * 2, f.y, 0.5, '#f0f0f0', 2, 14);
        }
        if (f.kind === 'repel') core.material.emissiveIntensity = 1.2 + Math.sin(now * 3) * 0.4;
      }
      for (const p of portals) { p.ring.rotation.z += dt * 2; p.ring.scale.setScalar(1 + Math.sin(now * 4) * 0.05); p.exit.rotation.z -= dt * 2; }
      for (const s of ships) { const a = now * 0.4 + s.ph; s.m.position.set(23 + Math.cos(a) * 20, 70 + Math.sin(a) * 30, 14); s.m.rotation.z = a + Math.PI; }
      if (roulette) { roulette.rotation.z += dt * rouletteSpin; rouletteSpin = Math.max(0.4, rouletteSpin - dt * 4); }

      plunger.position.y = -1 - charge * 3.5;
      // Particules
      let k = 0;
      for (const p of parts) {
        p.life -= dt;
        p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; p.vz -= 60 * dt;
        if (p.z < 0.2) { p.z = 0.2; p.vz *= -0.4; }
      }
      for (let i = parts.length - 1; i >= 0; i--) if (parts[i].life <= 0) parts.splice(i, 1);
      for (const p of parts) {
        pPos[k * 3] = p.x; pPos[k * 3 + 1] = p.y; pPos[k * 3 + 2] = p.z;
        const f = Math.min(1, p.life * 3);
        pCol[k * 3] = p.c.r * f; pCol[k * 3 + 1] = p.c.g * f; pCol[k * 3 + 2] = p.c.b * f;
        k++;
      }
      pGeo.setDrawRange(0, k);
      pGeo.attributes.position.needsUpdate = pGeo.attributes.color.needsUpdate = true;
      // Écran du fronton
      const msg = g.messages.at(-1);
      dmd.draw([g.score.toLocaleString('fr-FR'), msg ? msg.text.toUpperCase().slice(0, 30) : `BILLE ${g.ball}   ×${g.mult}`], !!msg && msg.t < 0.4);
      // Caméra (avec secousse)
      shake = Math.max(0, shake - dt * 2);
      tmp.copy(camLocal);
      if (shake) tmp.add(new THREE.Vector3((Math.random() - 0.5) * shake * 1.6, (Math.random() - 0.5) * shake, 0));
      T.updateMatrixWorld();
      camera.position.copy(T.localToWorld(tmp.clone()));
      camera.up.set(0, 1, 0);
      camera.lookAt(T.localToWorld(lookLocal.clone()));
      if (composer) composer.render(); else renderer.render(scene, camera);
    },
    resize,
    dispose() { removeEventListener('resize', resize); composer?.dispose(); renderer.dispose(); renderer.forceContextLoss(); },
  };
}
