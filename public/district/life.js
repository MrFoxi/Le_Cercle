// Little District : tout ce qui vit autour des habitants. Chats, pigeons, oiseaux, carpes, lucioles,
// et les événements : festival (feux d'artifice, lanternes célestes), chat doré, marchand ambulant, arc-en-ciel.
import * as THREE from 'three';
import { TEX, std, glowMat, box, cyl, ball, lantern, makePerson, canvasTex, seeded } from './models.js';
import { makeCat, animateCat, CAT_COLORS, makePigeon, makeBird, flap, makeKoi } from './animals.js';
import { NAV } from './people.js';
import { CANAL, HILL } from './terrain.js';

const Y = 0.06;
const rnd = (a, b) => a + Math.random() * (b - a);

// Particules colorées (feux d'artifice, cœurs, étincelles, lucioles) : un seul système, couleur par particule.
function colorParticles(scene, n) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(n * 3), col = new Float32Array(n * 3), alpha = new Float32Array(n), size = new Float32Array(n);
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('aAlpha', new THREE.BufferAttribute(alpha, 1));
  geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
  const m = new THREE.ShaderMaterial({
    uniforms: { uMap: { value: TEX.flake() }, uScale: { value: 800 } },
    vertexShader: 'uniform float uScale; attribute float aAlpha; attribute float aSize; attribute vec3 color; varying float vA; varying vec3 vC; void main(){ vA=aAlpha; vC=color; vec4 mv=modelViewMatrix*vec4(position,1.); gl_PointSize=aSize*uScale/-mv.z; gl_Position=projectionMatrix*mv; }',
    fragmentShader: 'uniform sampler2D uMap; varying float vA; varying vec3 vC; void main(){ float a=texture2D(uMap,gl_PointCoord).a*vA; gl_FragColor=vec4(vC*2.2,a); }',
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const pts = new THREE.Points(geo, m);
  pts.frustumCulled = false; pts.renderOrder = 5; scene.add(pts);
  const data = Array.from({ length: n }, () => ({ life: 0 }));
  let cursor = 0;
  const c = new THREE.Color();
  return {
    m,
    emit(x, y, z, o) {
      for (let k = 0; k < n; k++) {
        const i = (cursor + k) % n;
        if (data[i].life > 0) continue;
        cursor = i + 1;
        Object.assign(data[i], { life: o.life, max: o.life, vx: o.vx || 0, vy: o.vy || 0, vz: o.vz || 0, g: o.g || 0, drag: o.drag ?? 1, size: o.size || 0.1, blink: o.blink || 0, ph: Math.random() * 6 });
        pos.set([x, y, z], i * 3);
        c.set(o.color || '#ffffff'); col.set([c.r, c.g, c.b], i * 3);
        return;
      }
    },
    update(dt) {
      for (let i = 0; i < n; i++) {
        const d = data[i];
        if (d.life <= 0) { alpha[i] = 0; continue; }
        d.life -= dt;
        const k = i * 3, f = Math.pow(d.drag, dt * 60);
        d.vx *= f; d.vy = d.vy * f - d.g * dt; d.vz *= f;
        pos[k] += d.vx * dt; pos[k + 1] += d.vy * dt; pos[k + 2] += d.vz * dt;
        const t = d.life / d.max;
        alpha[i] = Math.min(1, t * 2.5) * (d.blink ? Math.max(0, Math.sin((d.ph += dt * d.blink))) : 1);
        size[i] = d.size;
      }
      for (const a of ['position', 'color', 'aAlpha', 'aSize']) geo.attributes[a].needsUpdate = true;
    },
  };
}

export function createLife({ scene, people, low, camera, target, onSound }) {
  const root = new THREE.Group(); scene.add(root);
  const fx = colorParticles(scene, low ? 900 : 2200);
  const pickables = [];
  const nodes = NAV.nodes.map((n, i) => ({ ...n, i })).filter(n => !n.edge);
  const neighbors = i => NAV.adj[i].map(([j]) => j).filter(j => !NAV.nodes[j].edge);

  // ---------- Chats du quartier ----------
  const cats = [0, 1, 2, 3].map(k => {
    const c = makeCat(CAT_COLORS[k % CAT_COLORS.length]);
    const n = nodes[(k * 13 + 5) % nodes.length];
    Object.assign(c, { x: n.x + 0.5, z: n.z + 0.3, y: n.y, node: n.i, dir: 0, mode: 'sleep', t: rnd(3, 20), path: [] });
    c.root.traverse(o => { if (o.isMesh) o.userData.cat = k; });
    root.add(c.root); pickables.push(c.root);
    return c;
  });
  function catNext(c) {
    const r = Math.random();
    if (r < 0.45) { // trotte vers un carrefour voisin (parfois deux)
      const a = NAV.nodes[c.node], hop = neighbors(c.node);
      if (!hop.length) { c.mode = 'sit'; c.t = 5; return; }
      let j = hop[Math.floor(Math.random() * hop.length)];
      if (Math.random() < 0.5) { const h2 = neighbors(j).filter(x => x !== c.node); if (h2.length) j = h2[Math.floor(Math.random() * h2.length)]; }
      const b = NAV.nodes[j], side = (Math.random() < 0.5 ? -1 : 1) * rnd(0.35, 0.55);
      c.path = [{ x: a.x + side * 0.2, z: a.z + side, y: a.y }, { x: b.x + side * 0.2, z: b.z + side, y: b.y }];
      c.node = j; c.mode = 'walk';
    } else { c.mode = r < 0.7 ? 'sit' : r < 0.85 ? 'groom' : 'sleep'; c.t = c.mode === 'sleep' ? rnd(25, 60) : rnd(5, 14); c.dir += rnd(-1, 1); }
  }
  function stepCat(c, dt) {
    if (c.mode === 'walk') {
      const p = c.path[0];
      if (!p) return catNext(c);
      const dx = p.x - c.x, dz = p.z - c.z, d = Math.hypot(dx, dz), sp = dt * 0.32;
      c.y += (p.y - c.y) * Math.min(1, sp / Math.max(d, 1e-6));
      if (d < sp) { c.x = p.x; c.z = p.z; c.path.shift(); } else { c.x += (dx / d) * sp; c.z += (dz / d) * sp; c.dir = Math.atan2(dx, dz); }
    } else if ((c.t -= dt) < 0) catNext(c);
    animateCat(c, dt, c.mode);
    c.root.position.set(c.x, c.y, c.z); c.root.rotation.y = c.dir;
  }

  // ---------- Pigeons : picorent en groupe, s'envolent quand on s'approche ----------
  const SPOTS = [[0, 16.2, 1.66], [4.5, -14.8, Y], [-5, -14.8, Y], [-7, 2.2, Y], [8, -7.4, Y], [-3.2, -20.5, Y], [6, 16.6, 1.66]];
  const flock = { spot: 0, t: rnd(30, 60), birds: [] };
  for (let i = 0; i < 7; i++) {
    const b = makePigeon(); root.add(b.root);
    const [sx, sz, sy] = SPOTS[0];
    Object.assign(b, { x: sx + rnd(-0.6, 0.6), z: sz + rnd(-0.5, 0.5), y: sy, dir: rnd(0, 6), fly: null, peck: rnd(0, 3) });
    flock.birds.push(b);
  }
  function scatter() {
    let k = flock.spot;
    while (k === flock.spot) k = Math.floor(Math.random() * SPOTS.length);
    flock.spot = k; flock.t = rnd(40, 90);
    const [sx, sz, sy] = SPOTS[k];
    flock.birds.forEach((b, i) => { b.fly = { from: { x: b.x, y: b.y, z: b.z }, to: { x: sx + rnd(-0.7, 0.7), y: sy, z: sz + rnd(-0.5, 0.5) }, t: -i * 0.08, dur: rnd(3, 4.5) }; });
    onSound?.('flap');
  }
  function stepPigeons(dt) {
    const [sx, sz] = SPOTS[flock.spot];
    if (flock.birds.every(b => !b.fly) && ((flock.t -= dt) < 0 || people.near(sx, sz, 0.9))) scatter();
    for (const b of flock.birds) {
      if (b.fly) {
        const f = b.fly; f.t += dt;
        const t = Math.max(0, Math.min(1, f.t / f.dur)), e = t * t * (3 - 2 * t);
        b.x = f.from.x + (f.to.x - f.from.x) * e; b.z = f.from.z + (f.to.z - f.from.z) * e;
        b.y = f.from.y + (f.to.y - f.from.y) * e + Math.sin(Math.PI * t) * 3.2;
        b.dir = Math.atan2(f.to.x - f.from.x, f.to.z - f.from.z);
        flap(b, dt, 22, 0.9);
        if (t >= 1) b.fly = null;
      } else {
        b.wings.forEach(w => (w.rotation.z = 0));
        b.peck -= dt;
        b.head.position.y = b.peck > 0 && b.peck < 0.4 ? 0.05 : 0.1;
        if (b.peck < 0) { b.peck = rnd(0.6, 2.5); if (Math.random() < 0.4) { b.dir += rnd(-1.2, 1.2); b.x += Math.sin(b.dir) * 0.08; b.z += Math.cos(b.dir) * 0.08; } }
      }
      b.root.position.set(b.x, b.y, b.z); b.root.rotation.y = b.dir;
    }
  }

  // ---------- Oiseaux qui traversent le ciel de la maquette, en V ----------
  let birds = null, birdT = rnd(10, 30);
  function stepBirds(dt, night) {
    if (!birds && (birdT -= dt) < 0 && !night) {
      const a = rnd(0, Math.PI * 2), dir = new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
      const start = target.clone().addScaledVector(dir, -26).setY(rnd(5, 7.5));
      birds = { list: [], dir, t: 0 };
      for (let i = 0; i < 5; i++) {
        const b = makeBird(), side = i === 0 ? 0 : (i % 2 ? 1 : -1) * Math.ceil(i / 2);
        b.off = new THREE.Vector3(-dir.z * side * 0.5, Math.abs(side) * 0.1, dir.x * side * 0.5).addScaledVector(dir, -Math.abs(side) * 0.45);
        b.root.position.copy(start).add(b.off); b.root.rotation.y = Math.atan2(dir.x, dir.z);
        root.add(b.root); birds.list.push(b);
      }
      onSound?.('chirp');
    }
    if (birds) {
      birds.t += dt;
      for (const b of birds.list) { b.root.position.addScaledVector(birds.dir, dt * 2.6); b.root.position.y += Math.sin(birds.t * 1.5 + b.off.x) * dt * 0.2; flap(b, dt, 10, 0.7); }
      if (birds.t > 20) { birds.list.forEach(b => root.remove(b.root)); birds = null; birdT = rnd(35, 80); }
    }
  }

  // ---------- Carpes koï ----------
  const kois = Array.from({ length: low ? 4 : 8 }, (_, i) => {
    const k = makeKoi(i); root.add(k.root);
    return Object.assign(k, { cx: rnd(-10, 10), cz: (CANAL.z0 + CANAL.z1) / 2 + rnd(-0.6, 0.6), ax: rnd(1.5, 4), az: rnd(0.4, 1), w: rnd(0.08, 0.18) * (Math.random() < 0.5 ? -1 : 1), ph: rnd(0, 6) });
  });
  function stepKoi(dt) {
    for (const k of kois) {
      k.ph += dt * k.w;
      const x = k.cx + Math.sin(k.ph) * k.ax, z = k.cz + Math.sin(k.ph * 2) * k.az;
      const dx = Math.cos(k.ph) * k.ax * k.w, dz = Math.cos(k.ph * 2) * 2 * k.az * k.w;
      k.root.position.set(x, CANAL.water - 0.09, z); k.root.rotation.y = Math.atan2(dx, dz);
      k.tail.rotation.y = Math.sin(performance.now() / 160 + k.cx) * 0.5;
    }
  }

  // ---------- Lucioles (soirs d'été et de fin de printemps, au bord de l'eau et sur la colline) ----------
  let flyT = 0;
  function stepFireflies(dt, on) {
    if (!on || (flyT -= dt) > 0) return;
    flyT = low ? 0.25 : 0.1;
    const onHill = Math.random() < 0.35;
    const x = rnd(-12, 12), z = onHill ? rnd(17, 20) : Math.random() < 0.5 ? rnd(CANAL.z1 - 0.3, CANAL.z1 + 1.2) : rnd(-21, CANAL.z0 + 0.3);
    fx.emit(x, (onHill ? HILL.y : 0) + rnd(0.3, 1.2), z, { life: rnd(4, 7), vx: rnd(-0.15, 0.15), vy: rnd(-0.03, 0.06), vz: rnd(-0.15, 0.15), color: '#c8ff6a', size: 0.09, blink: rnd(1.5, 3) });
  }

  // ---------- Lanternes célestes ----------
  const skyLanterns = [];
  let lanT = 0;
  function stepSkyLanterns(dt, on) {
    if (on && (lanT -= dt) < 0) {
      lanT = rnd(1.2, 3);
      const g = new THREE.Group();
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.08, 0.2, 10, 1, true), glowMat('skyLantern', '#ffb35a', null, 1.5, 3.2, 0, { side: THREE.DoubleSide }));
      g.add(body);
      g.position.set(rnd(-9, 9), HILL.y + 0.5, rnd(16, 20));
      root.add(g);
      skyLanterns.push({ g, vx: rnd(-0.08, 0.08), vz: rnd(-0.2, -0.05), ph: rnd(0, 6) });
    }
    for (let i = skyLanterns.length - 1; i >= 0; i--) {
      const l = skyLanterns[i];
      l.ph += dt;
      l.g.position.x += (l.vx + Math.sin(l.ph * 0.6) * 0.05) * dt; l.g.position.z += l.vz * dt; l.g.position.y += 0.32 * dt;
      if (Math.random() < dt * 3) fx.emit(l.g.position.x, l.g.position.y, l.g.position.z, { life: 0.4, color: '#ffb35a', size: 0.5 });
      if (l.g.position.y > 16) { root.remove(l.g); skyLanterns.splice(i, 1); }
    }
  }

  // ---------- Feux d'artifice (miniatures, au fond de la maquette par rapport à la caméra) ----------
  const rockets = [];
  let fwT = 0;
  const PALETTE = [['#ff4f6a', '#ffd36a'], ['#6ad1ff', '#ffffff'], ['#b56aff', '#ff8ad8'], ['#ffd36a', '#ff8a3a'], ['#7dff9a', '#d6ffd0']];
  function launch() {
    const away = new THREE.Vector3().subVectors(target, camera.position).setY(0).normalize();
    const side = new THREE.Vector3(-away.z, 0, away.x);
    const base = target.clone().addScaledVector(away, rnd(0, 4)).addScaledVector(side, rnd(-6, 6));
    base.x = THREE.MathUtils.clamp(base.x, -13, 13); base.z = THREE.MathUtils.clamp(base.z, -22, 21);
    rockets.push({ x: base.x, y: 0.5, z: base.z, vy: rnd(5, 6.5), top: rnd(3, 4.6), colors: PALETTE[Math.floor(Math.random() * PALETTE.length)] });
  }
  function burst(r) {
    const n = low ? 50 : 90, ring = Math.random() < 0.3;
    for (let i = 0; i < n; i++) {
      const u = Math.random() * 2 - 1, a = Math.random() * Math.PI * 2, s = ring ? 1.9 : rnd(1.2, 2.1);
      const k = ring ? 0 : Math.sqrt(1 - u * u);
      const vx = Math.cos(a) * (ring ? 1 : k) * s, vy = (ring ? Math.sin(a) : u) * s, vz = ring ? 0.2 * Math.sin(a * 3) : Math.sin(a) * k * s;
      fx.emit(r.x, r.y, r.z, { life: rnd(1.4, 2.2), vx, vy, vz, g: 1.1, drag: 0.965, color: r.colors[i % 2], size: 0.2, blink: Math.random() < 0.3 ? 14 : 0 });
    }
    fx.emit(r.x, r.y, r.z, { life: 0.2, color: '#ffe6c0', size: 0.8 });
    onSound?.('firework');
  }
  function stepFireworks(dt, on) {
    if (on && (fwT -= dt) < 0) { fwT = rnd(1.4, 4); launch(); if (Math.random() < 0.3) setTimeout(launch, 300); }
    for (let i = rockets.length - 1; i >= 0; i--) {
      const r = rockets[i];
      r.y += r.vy * dt; r.vy *= Math.pow(0.985, dt * 60);
      fx.emit(r.x + rnd(-0.02, 0.02), r.y, r.z, { life: 0.5, vy: -0.3, color: '#ffcf8a', size: 0.08 });
      if (r.y >= r.top || r.vy < 1) { burst(r); rockets.splice(i, 1); } // explose au sommet, même si elle s’essouffle
    }
  }

  // ---------- Arc-en-ciel (après la pluie, en journée) ----------
  const rainbowTex = canvasTex('rainbow', 8, 128, (x, w, h) => {
    const g = x.createLinearGradient(0, 0, 0, h);
    ['rgba(255,0,0,0)', '#ff3b3b', '#ff9a3b', '#ffe33b', '#5be35b', '#3bb8ff', '#6a5bff', 'rgba(160,80,255,0)'].forEach((c, i, a) => g.addColorStop(i / (a.length - 1), c));
    x.fillStyle = g; x.fillRect(0, 0, w, h);
  });
  const rainbow = new THREE.Mesh(new THREE.RingGeometry(12, 13.6, 64, 1, 0, Math.PI), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, onBeforeCompile: () => {} }));
  // la texture suit le rayon : on remplace les UV par la distance au centre
  {
    const g = rainbow.geometry, pos = g.attributes.position, uv = g.attributes.uv;
    for (let i = 0; i < pos.count; i++) uv.setXY(i, 0.5, (Math.hypot(pos.getX(i), pos.getY(i)) - 12) / 1.6);
    rainbow.material.map = rainbowTex;
  }
  rainbow.visible = false; scene.add(rainbow);
  let rainbowT = 0;

  // ---------- Chat doré (à toucher) et marchand ambulant ----------
  let golden = null, vendor = null;
  function spawnGolden() {
    if (golden) return;
    const n = nodes[Math.floor(Math.random() * nodes.length)];
    const c = makeCat(CAT_COLORS[0], { gold: true });
    c.root.position.set(n.x + 0.5, n.y, n.z + 0.4); c.root.scale.setScalar(1.3);
    c.root.traverse(o => { if (o.isMesh) o.userData.golden = true; });
    root.add(c.root); pickables.push(c.root);
    golden = { c, t: 70, x: n.x + 0.5, y: n.y, z: n.z + 0.4 };
    return golden;
  }
  function removeGolden() { if (!golden) return; root.remove(golden.c.root); pickables.splice(pickables.indexOf(golden.c.root), 1); golden = null; }
  function spawnVendor() {
    if (vendor) return;
    const g = new THREE.Group(), wood = std('#7a5434');
    box(g, 0.9, 0.35, 0.5, wood, 0, 0.22, 0);
    box(g, 0.95, 0.04, 0.55, std('#3a2a20'), 0, 0.57, 0);
    for (const s of [-1, 1]) { const w = cyl(g, 0.17, 0.04, std('#2a2420'), 0.15, 0.17, s * 0.28); w.rotation.x = Math.PI / 2; }
    cyl(g, 0.04, 0.5, std('#555', { metalness: 0.6 }), 0.3, 0.6, 0); // cheminée
    box(g, 0.5, 0.18, 0.3, glowMat('imoStove', '#ff7a2a', null, 0.6, 2.2, 0), -0.15, 0.57, 0);
    const lan = new THREE.Group(); lantern(lan, 0, 0, 0, '#d8342c', '芋', 1.1); lan.position.set(-0.4, 1.05, 0); g.add(lan);
    cyl(g, 0.012, 0.5, std('#333'), -0.4, 0.6, 0);
    for (const s of [-1, 1]) box(g, 0.5, 0.03, 0.03, wood, -0.65, 0.45, s * 0.2);
    const man = makePerson(seeded(Math.floor(Math.random() * 1e6)), '#5a6a8a');
    man.root.position.set(-1.05, 0, 0); man.root.rotation.y = Math.PI / 2; g.add(man.root);
    g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.userData.vendor = true; } });
    const dir = Math.random() < 0.5 ? 1 : -1;
    g.rotation.y = dir > 0 ? 0 : Math.PI;
    g.position.set(-14 * dir, Y, dir > 0 ? -1.0 : 1.0);
    root.add(g); pickables.push(g);
    vendor = { g, man, dir, ph: 0, bell: 2 };
    return vendor;
  }
  function removeVendor() { if (!vendor) return; root.remove(vendor.g); pickables.splice(pickables.indexOf(vendor.g), 1); vendor = null; }

  return {
    pickables, cats,
    setScale(v) { fx.m.uniforms.uScale.value = v; },
    get golden() { return golden; }, get vendor() { return vendor; },
    spawnGolden, removeGolden, spawnVendor, removeVendor,
    rainbow() { rainbowT = 90; },
    hearts(p) { for (let i = 0; i < 6; i++) fx.emit(p.x + rnd(-0.1, 0.1), p.y + 0.35, p.z + rnd(-0.1, 0.1), { life: 1.4, vy: rnd(0.4, 0.7), vx: rnd(-0.15, 0.15), color: '#ff6a9a', size: 0.14 }); },
    sparkle(p, color = '#ffd36a', n = 30) { for (let i = 0; i < n; i++) { const a = rnd(0, 6.28); fx.emit(p.x, p.y + 0.3, p.z, { life: rnd(0.6, 1.2), vx: Math.cos(a) * rnd(0.5, 1.5), vy: rnd(0.5, 2), vz: Math.sin(a) * rnd(0.5, 1.5), g: 2, color, size: 0.12 }); } },
    flash(p) { fx.emit(p.x, p.y, p.z, { life: 0.15, color: '#ffffff', size: 0.7 }); },
    followables() { return [...cats.filter(c => c.mode === 'walk').map(c => ({ obj: c.root, h: 0.3 })), ...(vendor ? [{ obj: vendor.g, h: 0.8 }] : [])]; },
    update(dt, { night, season, rain, festival, hour }) {
      cats.forEach(c => stepCat(c, dt));
      stepPigeons(dt);
      stepBirds(dt, night > 0.5 || rain);
      stepKoi(dt);
      stepFireflies(dt, night > 0.6 && !rain && (season === 'ete' || season === 'printemps'));
      stepSkyLanterns(dt, festival && night > 0.4);
      stepFireworks(dt, festival && night > 0.5);
      // arc-en-ciel face à la caméra, au fond de la maquette
      if (rainbowT > 0) {
        rainbowT -= dt;
        const away = new THREE.Vector3().subVectors(target, camera.position).setY(0).normalize();
        rainbow.position.copy(target).addScaledVector(away, 16).setY(-3);
        rainbow.lookAt(camera.position.x, -3, camera.position.z);
        rainbow.material.opacity = Math.min(1, rainbowT / 10, (90 - rainbowT) / 6) * 0.28 * (1 - night);
        rainbow.visible = true;
      } else rainbow.visible = false;
      if (golden) {
        golden.t -= dt;
        animateCat(golden.c, dt, 'sit');
        if (Math.random() < dt * 8) fx.emit(golden.x + rnd(-0.3, 0.3), golden.y + rnd(0.1, 0.6), golden.z + rnd(-0.3, 0.3), { life: 0.8, vy: 0.3, color: '#ffe27a', size: 0.1 });
        if (golden.t < 0) removeGolden();
      }
      if (vendor) {
        vendor.g.position.x += vendor.dir * dt * 0.38;
        vendor.ph += dt * 5;
        const m = vendor.man;
        m.legL.rotation.x = Math.sin(vendor.ph) * 0.5; m.legR.rotation.x = -Math.sin(vendor.ph) * 0.5;
        m.armL.rotation.x = m.armR.rotation.x = -1.2;
        if (Math.random() < dt * 4) { const v = new THREE.Vector3(0.3, 1.15, 0).applyMatrix4(vendor.g.matrixWorld); fx.emit(v.x, v.y, v.z, { life: 1.5, vy: 0.35, color: '#bbbbbb', size: 0.18 }); }
        if ((vendor.bell -= dt) < 0) { vendor.bell = 7; onSound?.('vendor'); }
        if (Math.abs(vendor.g.position.x) > 14.5) removeVendor();
      }
      fx.update(dt);
    },
  };
}
