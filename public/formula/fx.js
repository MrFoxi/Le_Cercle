// Effets de course : traces de pneus, fumée et poussière, étincelles (contacts, fond plat), flammes d'échappement,
// débris de carrosserie, pluie et gerbes d'eau derrière les voitures.
import * as THREE from 'three';
import { sprite } from './textures.js';

export function createFx(scene, { low = false } = {}) {
  /* ---- Traces de pneus : anneau de quadrilatères réutilisés ---- */
  const MAX = low ? 1200 : 3000, pos = new Float32Array(MAX * 4 * 3), idx = [];
  for (let k = 0; k < MAX; k++) idx.push(k * 4, k * 4 + 1, k * 4 + 2, k * 4 + 1, k * 4 + 3, k * 4 + 2);
  const sg = new THREE.BufferGeometry();
  sg.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  sg.setIndex(idx);
  const skidMesh = new THREE.Mesh(sg, new THREE.MeshBasicMaterial({ color: '#000', transparent: true, opacity: 0.34, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
  skidMesh.frustumCulled = false; skidMesh.renderOrder = 1;
  scene.add(skidMesh);
  let sk = 0, dirty = false;

  /* ---- Particules : un système par mode de mélange ---- */
  const scale = { value: 600 };
  const mat = additive => new THREE.ShaderMaterial({
    uniforms: { map: { value: sprite() }, scale }, transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    vertexShader: 'attribute float size; attribute vec4 color; varying vec4 vC; uniform float scale; void main(){ vC=color; vec4 mv=modelViewMatrix*vec4(position,1.); gl_PointSize=size*scale/-mv.z; gl_Position=projectionMatrix*mv; }',
    fragmentShader: 'uniform sampler2D map; varying vec4 vC; void main(){ vec4 t=texture2D(map,gl_PointCoord); gl_FragColor=vec4(vC.rgb, vC.a*t.a); }',
  });
  const system = (n, additive, gravity) => {
    const g = new THREE.BufferGeometry();
    const P = new Float32Array(n * 3), S = new Float32Array(n), C = new Float32Array(n * 4);
    g.setAttribute('position', new THREE.BufferAttribute(P, 3)); g.setAttribute('size', new THREE.BufferAttribute(S, 1)); g.setAttribute('color', new THREE.BufferAttribute(C, 4));
    const pts = new THREE.Points(g, mat(additive)); pts.frustumCulled = false; pts.renderOrder = 3; scene.add(pts);
    return { g, P, S, C, gravity, list: Array.from({ length: n }, () => ({ life: 0 })), next: 0 };
  };
  const smoke = system(low ? 700 : 1600, false, -0.6), sparks = system(500, true, 14), glow = system(300, true, 0);
  const col = new THREE.Color();
  const emit = (sys, p) => { const o = sys.list[sys.next]; sys.next = (sys.next + 1) % sys.list.length; Object.assign(o, { drag: 1.5, ground: 0 }, p, { age: 0 }); };
  const step = (sys, dt) => {
    sys.list.forEach((o, k) => {
      if (o.life <= 0) { sys.S[k] = 0; return; }
      o.age += dt;
      if (o.age >= o.life) { o.life = 0; sys.S[k] = 0; return; }
      const f = o.age / o.life;
      o.x += o.vx * dt; o.y += o.vy * dt; o.z += o.vz * dt; o.vz -= sys.gravity * dt;
      if (o.z < o.ground + 0.1) { o.z = o.ground + 0.1; o.vz *= -0.35; }
      const damp = Math.exp(-dt * o.drag); o.vx *= damp; o.vy *= damp;
      sys.P[k * 3] = o.x; sys.P[k * 3 + 1] = o.z; sys.P[k * 3 + 2] = o.y;
      sys.S[k] = o.size0 + (o.size1 - o.size0) * f;
      col.set(o.color);
      sys.C[k * 4] = col.r; sys.C[k * 4 + 1] = col.g; sys.C[k * 4 + 2] = col.b; sys.C[k * 4 + 3] = o.alpha * (1 - f) * Math.min(1, f * 8);
    });
    for (const a of ['position', 'size', 'color']) sys.g.attributes[a].needsUpdate = true;
  };

  /* ---- Débris : petits éclats qui rebondissent puis disparaissent ---- */
  const DEB = 90, debris = new THREE.InstancedMesh(new THREE.BoxGeometry(0.34, 0.06, 0.22), new THREE.MeshStandardMaterial({ roughness: 0.5, metalness: 0.3 }), DEB);
  debris.castShadow = true; debris.frustumCulled = false;
  const dList = Array.from({ length: DEB }, () => ({ life: 0 })), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v3 = new THREE.Vector3(), one = new THREE.Vector3();
  for (let k = 0; k < DEB; k++) { debris.setMatrixAt(k, m4.makeScale(0, 0, 0)); debris.setColorAt(k, col.set('#222')); }
  scene.add(debris);
  let dNext = 0;

  /* ---- Pluie : traits qui tombent autour de la caméra ---- */
  const DROPS = low ? 700 : 1800, rp = new Float32Array(DROPS * 6), rainGeo = new THREE.BufferGeometry();
  rainGeo.setAttribute('position', new THREE.BufferAttribute(rp, 3).setUsage(THREE.DynamicDrawUsage));
  const rain = new THREE.LineSegments(rainGeo, new THREE.LineBasicMaterial({ color: '#cfdcea', transparent: true, opacity: 0.45, depthWrite: false }));
  rain.frustumCulled = false; rain.visible = false; scene.add(rain);
  const drops = Array.from({ length: DROPS }, () => ({ x: 0, y: -1, z: 0, v: 0 }));

  return {
    setScale(v) { scale.value = v; },
    skid(x1, y1, x2, y2, h) {
      const dx = x2 - x1, dy = y2 - y1, l = Math.hypot(dx, dy);
      if (l < 0.05 || l > 4) return;
      const nx = -dy / l * 0.2, ny = dx / l * 0.2, o = sk * 12, y = h + 0.075;
      pos.set([x1 + nx, y, y1 + ny, x1 - nx, y, y1 - ny, x2 + nx, y, y2 + ny, x2 - nx, y, y2 - ny], o);
      sk = (sk + 1) % MAX; dirty = true;
    },
    smoke(x, y, h, amount = 1, heat = 1, color = '#d8d8d8') {
      emit(smoke, { x, y, z: h + 0.4, ground: h, vx: (Math.random() - 0.5) * 3, vy: (Math.random() - 0.5) * 3, vz: 1 + Math.random(), life: 0.9 + Math.random() * 0.8 * amount, size0: 1.2, size1: 4.5 * amount + heat, alpha: 0.45, color, drag: 2 });
    },
    dust(x, y, h, vx, vy, color) {
      emit(smoke, { x, y, z: h + 0.5, ground: h, vx: vx * 0.3 + (Math.random() - 0.5) * 4, vy: vy * 0.3 + (Math.random() - 0.5) * 4, vz: 1.5 + Math.random() * 2, life: 1.2 + Math.random(), size0: 2, size1: 9, alpha: 0.5, color, drag: 1.2 });
    },
    spray(x, y, h, vx, vy) {
      emit(smoke, { x, y, z: h + 0.5, ground: h, vx: vx * 0.25 + (Math.random() - 0.5) * 3, vy: vy * 0.25 + (Math.random() - 0.5) * 3, vz: 1 + Math.random() * 1.5, life: 0.45 + Math.random() * 0.4, size0: 1.2, size1: 5, alpha: 0.13, color: '#e4ebf2', drag: 2.5 });
    },
    trail(x, y, h) { emit(smoke, { x, y, z: h + 0.9, ground: h, vx: 0, vy: 0, vz: 0, life: 0.35, size0: 0.6, size1: 1.6, alpha: 0.25, color: '#bfe3ff', drag: 1 }); },
    sparks(x, y, h, power, n = Math.min(40, 6 + power * 2)) {
      for (let k = 0; k < n; k++) {
        const a = Math.random() * 6.28, v = 4 + Math.random() * power * 0.8;
        emit(sparks, { x, y, z: h + 0.5, ground: h, vx: Math.cos(a) * v, vy: Math.sin(a) * v, vz: 2 + Math.random() * 5, life: 0.25 + Math.random() * 0.4, size0: 0.5, size1: 0.15, alpha: 1, color: Math.random() < 0.5 ? '#ffd27a' : '#ff8a3a' });
      }
    },
    // Fond plat qui frotte : gerbe vers l'arrière
    plank(x, y, h, vx, vy) {
      for (let k = 0; k < 4; k++) emit(sparks, { x, y, z: h + 0.15, ground: h, vx: -vx * (0.15 + Math.random() * 0.2) + (Math.random() - 0.5) * 4, vy: -vy * (0.15 + Math.random() * 0.2) + (Math.random() - 0.5) * 4, vz: 0.5 + Math.random() * 2, life: 0.2 + Math.random() * 0.25, size0: 0.45, size1: 0.1, alpha: 1, color: Math.random() < 0.6 ? '#fff1b8' : '#ffb347', drag: 0.5 });
    },
    flame(x, y, h, dx, dy) {
      for (let k = 0; k < 3; k++) emit(glow, { x, y, z: h + 0.45, ground: h, vx: dx * (6 + Math.random() * 4), vy: dy * (6 + Math.random() * 4), vz: 0, life: 0.08 + Math.random() * 0.08, size0: 0.9, size1: 0.3, alpha: 1, color: k ? '#ff8a2a' : '#7fb2ff', drag: 3 });
    },
    debris(x, y, h, power, color) {
      const n = Math.min(14, 3 + Math.floor(power / 3));
      for (let k = 0; k < n; k++) {
        const a = Math.random() * 6.28, v = 3 + Math.random() * power * 0.5, d = dList[dNext];
        Object.assign(d, { x, y, z: h + 0.6, vx: Math.cos(a) * v, vy: Math.sin(a) * v, vz: 3 + Math.random() * 5, rx: 0, ry: 0, rz: 0, wx: (Math.random() - 0.5) * 20, wy: (Math.random() - 0.5) * 20, ground: h, life: 4, age: 0 });
        debris.setColorAt(dNext, col.set(Math.random() < 0.5 ? color : '#25282e'));
        dNext = (dNext + 1) % DEB;
      }
      debris.instanceColor.needsUpdate = true;
    },
    // Pluie autour du point regardé par la caméra (x, y au sol, h hauteur du sol)
    rain(on, cx, cy, h, dt) {
      rain.visible = on;
      if (!on) return;
      drops.forEach((d, k) => {
        if (d.y < h) { d.x = cx + (Math.random() - 0.5) * 160; d.z = cy + (Math.random() - 0.5) * 120; d.y = h + 10 + Math.random() * 50; d.v = 30 + Math.random() * 10; }
        d.y -= d.v * dt; d.x += 6 * dt;
        rp.set([d.x, d.y, d.z, d.x - 0.5, d.y + 1.8, d.z - 0.2], k * 6);
      });
      rainGeo.attributes.position.needsUpdate = true;
    },
    update(dt) {
      if (dirty) { sg.attributes.position.needsUpdate = true; dirty = false; }
      step(smoke, dt); step(sparks, dt); step(glow, dt);
      let moved = false;
      dList.forEach((d, k) => {
        if (d.life <= 0) return;
        moved = true;
        d.age += dt;
        d.x += d.vx * dt; d.y += d.vy * dt; d.z += d.vz * dt; d.vz -= 14 * dt;
        if (d.z < d.ground + 0.05) { d.z = d.ground + 0.05; d.vz *= -0.3; d.vx *= 0.6; d.vy *= 0.6; d.wx *= 0.5; d.wy *= 0.5; }
        d.rx += d.wx * dt; d.rz += d.wy * dt;
        const s = d.age > d.life - 0.6 ? Math.max(0, (d.life - d.age) / 0.6) : 1;
        if (d.age >= d.life) d.life = 0;
        m4.compose(v3.set(d.x, d.z, d.y), q.setFromEuler(e.set(d.rx, d.ry, d.rz)), one.set(s, s, s));
        debris.setMatrixAt(k, m4);
      });
      if (moved) debris.instanceMatrix.needsUpdate = true;
    },
  };
}
