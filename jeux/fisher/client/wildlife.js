// Little Fisher : un monde qui vit autour de toi. Dauphins qui accompagnent le bateau, baleines qui soufflent au large,
// tortues dans le lagon des Palmes, crabes sur les plages, et d'autres pêcheurs qui font la tournée des villages.
import * as THREE from 'three';
import { S, waveH, fwd, right } from './state.js';
import { buildBoat } from './boat.js';
import { HULL_COLORS, FLAGS, RELICS, ISLANDS } from './data.js';

const mat = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.6, ...o });
const add = (g, geo, m, x, y, z, s = [1, 1, 1], r = [0, 0, 0]) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.scale.set(...s); o.rotation.set(...r); o.castShadow = true; g.add(o); return o; };

// Trajets des autres pêcheurs (en pleine eau, entre les villages)
const ROUTES = [
  [[0, 135], [150, 60], [330, -120], [372, -220]],
  [[-30, 140], [-150, 230], [-170, 560], [-80, 690]],
  [[-300, -190], [-420, -380], [-660, -330], [-680, -110], [-470, -10]],
  [[372, -220], [380, -120], [560, -100], [560, 250], [300, 300], [120, 160]],
];
const WHALES = [[300, 500], [-500, 600], [650, -650], [-200, -700]];

function dolphinMesh() {
  const g = new THREE.Group(), grey = mat('#7f8c9a', { roughness: 0.3 }), belly = mat('#dfe6ea', { roughness: 0.3 });
  add(g, new THREE.SphereGeometry(0.5, 12, 8), grey, 0, 0, 0, [0.55, 0.6, 2]);
  add(g, new THREE.SphereGeometry(0.45, 10, 8), belly, 0, -0.12, 0.1, [0.5, 0.45, 1.7]);
  add(g, new THREE.ConeGeometry(0.15, 0.6, 6), grey, 0, 0, 1.2, [1, 1, 1], [Math.PI / 2, 0, 0]);              // rostre
  add(g, new THREE.ConeGeometry(0.25, 0.6, 4), grey, 0, 0.45, -0.1, [0.3, 1, 1], [-0.4, 0, 0]);              // aileron
  add(g, new THREE.BoxGeometry(1.1, 0.06, 0.4), grey, 0, 0, -1.1);                                             // queue
  return g;
}
function whaleMesh() {
  const g = new THREE.Group(), blue = mat('#3a4a5e', { roughness: 0.5 }), belly = mat('#c8d0d8', { roughness: 0.5 });
  add(g, new THREE.SphereGeometry(1, 16, 12), blue, 0, 0, 0, [3, 2.6, 10]);
  add(g, new THREE.SphereGeometry(1, 14, 10), belly, 0, -0.9, 1, [2.6, 1.6, 8]);
  for (const s of [-1, 1]) add(g, new THREE.BoxGeometry(4, 0.2, 1.4), blue, s * 3.4, -1, 3, [1, 1, 1], [0, s * 0.4, s * -0.3]); // nageoires
  const tail = new THREE.Group(); tail.position.z = -10; g.add(tail);
  add(tail, new THREE.CylinderGeometry(0.6, 1.2, 4, 8), blue, 0, 0, -2, [1, 1, 1], [Math.PI / 2, 0, 0]);
  const fluke = add(tail, new THREE.BoxGeometry(7, 0.3, 2.2), blue, 0, 0, -4.4);
  g.userData.tail = tail; g.userData.fluke = fluke;
  return g;
}
function turtleMesh() {
  const g = new THREE.Group(), shell = mat('#6a7a3a', { flatShading: true }), skin = mat('#9aa86a');
  add(g, new THREE.SphereGeometry(0.6, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), shell, 0, 0, 0, [1, 0.5, 1.2]);
  add(g, new THREE.SphereGeometry(0.2, 8, 6), skin, 0, 0, 0.8);
  const fl = [];
  for (const [x, z] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) fl.push(add(g, new THREE.BoxGeometry(0.5, 0.06, 0.22), skin, x * 0.55, -0.05, z * 0.45));
  g.userData.fl = fl;
  return g;
}

export function createWildlife() {
  const scene = S.scene, rnd = Math.random;

  /* ----- Autres pêcheurs ----- */
  const colors = Object.keys(HULL_COLORS).filter(k => !HULL_COLORS[k].need), flags = Object.keys(FLAGS).filter(k => !FLAGS[k].need);
  const npcs = ROUTES.map((route, k) => {
    const b = buildBoat();
    b.setStyle(['barque', 'voilier', 'chalutier', 'barque'][k], { hull: colors[(k * 3 + 1) % colors.length], flag: flags[k % flags.length], name: ['L’Hirondelle', 'Brise', 'Le Vaillant', 'Coquillage'][k], mascot: null }, { colors: HULL_COLORS, flags: FLAGS, relics: RELICS });
    b.setLevels({ moteur: k % 3, cale: 1, canne: 1, coque: k % 2, lanterne: 1 });
    scene.add(b.group);
    const [x, z] = route[0];
    return { b, route, i: 1, dir: 1, x, z, h: 0, speed: 7 + k, wait: 0 };
  });
  function updateNpcs(dt, t, night) {
    for (const n of npcs) {
      if (n.wait > 0) n.wait -= dt; // arrêté : il pêche un moment
      else {
        const [tx, tz] = n.route[n.i], dx = tx - n.x, dz = tz - n.z, d = Math.hypot(dx, dz);
        if (d < 6) { // point atteint : on repart vers le suivant (aller-retour), parfois une pause pêche
          if (n.i + n.dir >= n.route.length || n.i + n.dir < 0) n.dir *= -1;
          n.i += n.dir; if (rnd() < 0.35) n.wait = 8 + rnd() * 15;
        } else {
          const want = Math.atan2(dx, dz), dh = Math.atan2(Math.sin(want - n.h), Math.cos(want - n.h));
          n.h += Math.max(-dt * 0.6, Math.min(dt * 0.6, dh));
          n.x += Math.sin(n.h) * n.speed * dt; n.z += Math.cos(n.h) * n.speed * dt;
        }
      }
      const w = S.world.waveAt(n.x, n.z, t, S.amp);
      n.b.group.position.set(n.x, w.h + 0.05, n.z); n.b.group.rotation.y = n.h;
      n.b.body.rotation.x = -Math.atan(w.dz * 1.4) * 0.8; n.b.body.rotation.z = Math.atan(w.dx * 1.4) * 0.8;
      n.b.fisher.rotation.y = n.wait > 0 ? -Math.PI / 2 + 0.3 : Math.sin(t * 0.3 + n.speed) * 0.4;
      n.b.tick(dt, night, n.wait > 0 ? 0 : 0.6);
    }
  }

  /* ----- Dauphins : de temps en temps, une bande vient sauter à côté du bateau ----- */
  const pod = Array.from({ length: 4 }, () => { const m = dolphinMesh(); m.visible = false; scene.add(m); return { m, side: 0, off: 0, ph: 0 }; });
  let podT = -1, podNext = 40, podSide = 1;
  function updatePod(dt, t) {
    const B = S.B;
    if (podT < 0) {
      podNext -= dt;
      const zone = S.world && S.mode === 'sail' ? true : false;
      if (zone && podNext < 0 && Math.abs(B.speed) > 6 && S.world.heightAt(B.x, B.z) < -10) { podT = 0; podSide = rnd() < 0.5 ? 1 : -1; pod.forEach((d, k) => { d.off = 4 + k * 2.2; d.ph = rnd() * 6; d.back = k * 2.5; }); }
      if (podNext < 0) podNext = 50 + rnd() * 70;
      for (const d of pod) d.m.visible = false;
      return null;
    }
    podT += dt;
    const life = 22, f = fwd(B.heading), r = right(B.heading);
    let jumped = false;
    for (const d of pod) {
      const ph = podT * 2.4 + d.ph, arc = Math.sin(ph), x = B.x + r.x * d.off * podSide + f.x * (4 - d.back + Math.sin(podT * 0.5 + d.ph) * 2), z = B.z + r.z * d.off * podSide + f.z * (4 - d.back + Math.sin(podT * 0.5 + d.ph) * 2);
      d.m.visible = podT < life;
      d.m.position.set(x, waveH(x, z) - 0.6 + Math.max(0, arc) * 2.4, z);
      d.m.rotation.set(-Math.cos(ph) * 0.8, B.heading, 0);
      if (arc > 0.98) jumped = true;
    }
    if (podT > life) { podT = -1; for (const d of pod) d.m.visible = false; }
    return jumped;
  }

  /* ----- Baleines : elles nagent en rond au large, soufflent, puis plongent en montrant la queue ----- */
  const spoutTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,.95)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })();
  const whales = WHALES.map(([cx, cz], k) => {
    const m = whaleMesh(); scene.add(m);
    const spouts = Array.from({ length: 10 }, () => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: spoutTex, transparent: true, depthWrite: false, opacity: 0 })); scene.add(s); return s; });
    return { m, spouts, cx, cz, ph: k * 1.7, r: 90 + k * 25 };
  });
  function updateWhales(dt, t) {
    let near = null;
    for (const w of whales) {
      const a = t * 0.025 + w.ph, x = w.cx + Math.cos(a) * w.r, z = w.cz + Math.sin(a) * w.r;
      const cycle = (t * 0.05 + w.ph) % 1;                 // 0–0,45 en surface, puis plongée
      const up = cycle < 0.45, dive = Math.max(0, (cycle - 0.45) / 0.15);
      const y = up ? -0.7 + Math.sin(t * 0.8 + w.ph) * 0.4 : -0.7 - Math.min(1, dive) * 14; // le dos affleure
      w.m.position.set(x, y, z); w.m.rotation.set(up ? 0 : Math.min(0.6, dive * 0.6), a + Math.PI, 0);
      w.m.userData.tail.rotation.x = Math.sin(t * 1.2 + w.ph) * 0.25 + (up ? 0 : -Math.min(1, dive) * 0.9);
      w.m.visible = cycle < 0.7;
      const blow = up && (cycle % 0.15) < 0.06;
      w.spouts.forEach((s, k) => { const kk = ((t * 0.9 + k / 10) % 1); s.position.set(x + Math.sin(a + Math.PI) * 6, y + 3 + kk * 12, z + Math.cos(a + Math.PI) * 6); s.scale.setScalar(2 + kk * 7); s.material.opacity = blow ? (1 - kk) * 0.9 : Math.max(0, s.material.opacity - dt); });
      if (up && Math.hypot(x - S.B.x, z - S.B.z) < 110) near = w;
    }
    return near;
  }

  /* ----- Tortues du lagon et crabes des plages ----- */
  const palmes = ISLANDS.find(i => i.id === 'palmes'), turtles = [];
  for (let k = 0; k < 7; k++) { const m = turtleMesh(); scene.add(m); turtles.push({ m, a: rnd() * 6.3, r: palmes.r + 15 + rnd() * 40, sp: (0.03 + rnd() * 0.03) * (rnd() < 0.5 ? 1 : -1), ph: rnd() * 6 }); }
  const crabs = [], crabMat = mat('#d8432f');
  for (const id of ['port', 'palmes', 'naufrages']) {
    const isl = ISLANDS.find(i => i.id === id);
    for (let k = 0; k < 10; k++) {
      const a = rnd() * 6.3; let d = isl.r * 0.6;
      while (S.world.heightAt(isl.x + Math.cos(a) * d, isl.z + Math.sin(a) * d) > 0.6 && d < isl.r * 1.6) d += 0.5; // le bord de l'eau
      const x = isl.x + Math.cos(a) * (d - 2), z = isl.z + Math.sin(a) * (d - 2), h = S.world.heightAt(x, z);
      if (h < 0 || h > 2.5) continue;
      const g = new THREE.Group();
      add(g, new THREE.SphereGeometry(0.22, 8, 6), crabMat, 0, 0.1, 0, [1.3, 0.5, 1]);
      for (const s of [-1, 1]) add(g, new THREE.SphereGeometry(0.09, 6, 4), crabMat, s * 0.3, 0.12, 0.18);
      g.position.set(x, h, z); g.rotation.y = a; scene.add(g);
      crabs.push({ g, x, z, h, a, ph: rnd() * 6 });
    }
  }
  function updateSmall(dt, t) {
    for (const tt of turtles) {
      const a = tt.a + t * tt.sp, x = palmes.x + Math.cos(a) * tt.r, z = palmes.z + Math.sin(a) * tt.r;
      tt.m.position.set(x, waveH(x, z) - 0.15 - Math.max(0, Math.sin(t * 0.2 + tt.ph)) * 1.2, z);
      tt.m.rotation.y = Math.atan2(-Math.sin(a) * Math.sign(tt.sp), Math.cos(a) * Math.sign(tt.sp));
      tt.m.userData.fl.forEach((f, k) => (f.rotation.y = Math.sin(t * 2 + k) * 0.5));
    }
    for (const c of crabs) { const s = Math.sin(t * 0.7 + c.ph); c.g.position.set(c.x + Math.cos(c.a + Math.PI / 2) * s * 1.5, c.h + Math.abs(Math.sin(t * 12 + c.ph)) * 0.04, c.z + Math.sin(c.a + Math.PI / 2) * s * 1.5); }
  }

  return {
    dolphinsNow: () => (podNext = 0), // pour les tests automatiques
    // renvoie ce qui s'est passé de notable (pour les merveilles et les sons)
    update(dt, t, night) {
      updateNpcs(dt, t, night);
      const jumped = updatePod(dt, t), whale = updateWhales(dt, t);
      updateSmall(dt, t);
      return { dolphins: podT >= 0, jumped, whale: !!whale };
    },
  };
}
