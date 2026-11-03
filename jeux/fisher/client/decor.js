// Little Fisher : le décor des lieux à explorer. Volcan (lave, fumée, sources), icebergs, cathédrale de glace et neige,
// épaves, grotte aux lucioles, arche des Falaises, cascade de Port-Galet, hérons, et les croix des trésors enterrés.
import * as THREE from 'three';
import { ISLANDS, WRECKS, HUNTS, CAVE, WONDERS } from './data.js';

const island = id => ISLANDS.find(i => i.id === id);
const wonder = id => WONDERS.find(w => w.id === id);
function puffTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,0.9)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

export function buildDecor({ root, scene, heightAt, waveAt, shoreFrom, rng, obstacles, anim, box, cyl, low, sparkTex }) {
  const puff = puffTexture();
  const mat = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.9, flatShading: true, ...o });
  const rough = (geo, k, seed) => { const p = geo.attributes.position; for (let n = 0; n < p.count; n++) { const f = 1 + (Math.sin(p.getX(n) * 1.7 + seed) * Math.cos(p.getZ(n) * 1.3 + p.getY(n) + seed)) * k; p.setXYZ(n, p.getX(n) * f, p.getY(n) * f, p.getZ(n) * f); } geo.computeVertexNormals(); return geo; };
  const circle = (x, z, w) => obstacles.push({ ax: x, az: z, bx: x, bz: z, w });

  // Une colonne de fumée ou de vapeur : des bouffées qui montent, grossissent et s'effacent
  function plume(x, y, z, { n = 16, size = 8, rise = 40, color = '#cfcfcf', drift = 0.4, life = 9, opacity = 0.55 } = {}) {
    const items = [];
    for (let k = 0; k < n; k++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: puff, color, transparent: true, depthWrite: false, opacity: 0 }));
      root.add(s); items.push({ s, ph: k / n, ox: (rng() - 0.5) * 3, oz: (rng() - 0.5) * 3 });
    }
    anim.push((dt, t, night) => {
      for (const it of items) {
        const k = ((t / life + it.ph) % 1);
        it.s.position.set(x + it.ox + k * rise * drift, y + k * rise, z + it.oz + k * rise * drift * 0.3);
        it.s.scale.setScalar(size * (0.5 + k * 1.6));
        it.s.material.opacity = opacity * Math.sin(k * Math.PI) * (1 - night * 0.5);
      }
    });
    return items;
  }

  /* ----- Mont Braise : lave, lueur, fumée, sources fumantes ----- */
  {
    const v = island('braise'), top = heightAt(v.x, v.z);
    const lava = new THREE.Mesh(new THREE.CircleGeometry(v.r * 0.11, 24).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#ff6a1a', emissive: '#ff4a0a', emissiveIntensity: 1.6 }));
    lava.position.set(v.x, top + 2.5, v.z); root.add(lava);
    const glow = new THREE.PointLight('#ff7a2a', 0, 180, 1.6); glow.position.set(v.x, top + 12, v.z); root.add(glow);
    // trois coulées de lave qui descendent du cratère
    const lavaMat = new THREE.MeshStandardMaterial({ color: '#ff5a1a', emissive: '#ff3a0a', emissiveIntensity: 1.2, roughness: 0.6 });
    for (let k = 0; k < 3; k++) {
      const a = 0.4 + k * 2.1 + rng() * 0.5, pts = [];
      for (let j = 0; j <= 14; j++) {
        const d = v.r * (0.12 + j / 14 * 0.6), wob = Math.sin(j * 0.9 + k) * 0.12, x = v.x + Math.cos(a + wob) * d, z = v.z + Math.sin(a + wob) * d;
        pts.push(new THREE.Vector3(x, heightAt(x, z) + 0.35, z));
      }
      const tube = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, 1.1, 5), lavaMat); root.add(tube);
    }
    const smoke = plume(v.x, top + 4, v.z, { n: low ? 10 : 18, size: 14, rise: 90, color: '#9a9490', drift: 0.5, life: 14, opacity: 0.6 });
    anim.push((dt, t, night) => {
      lava.material.emissiveIntensity = 1.4 + Math.sin(t * 1.7) * 0.3 + Math.sin(t * 4.1) * 0.15;
      lavaMat.emissiveIntensity = 0.9 + night * 1.6 + Math.sin(t * 2.3) * 0.2;
      glow.intensity = 60 + night * 260;
      for (const it of smoke) it.s.material.color.set(night > 0.5 ? '#c07050' : '#9a9490'); // la nuit, la fumée rougeoie
    });
    const src = wonder('source');
    for (let k = 0; k < 4; k++) plume(src.x + (rng() - 0.5) * 30, 0.5, src.z + (rng() - 0.5) * 30, { n: 6, size: 5, rise: 14, color: '#ffffff', drift: 0.2, life: 5, opacity: 0.45 });
  }

  /* ----- Les Glaciers : icebergs, cathédrale de glace, neige ----- */
  const iceMat = mat('#e8f6ff', { roughness: 0.35, emissive: '#2a5a7a', emissiveIntensity: 0.15 });
  {
    const g = island('glaciers');
    for (let k = 0; k < 16; k++) {
      const a = rng() * Math.PI * 2;
      if (Math.abs(Math.atan2(Math.sin(a - Math.PI / 2), Math.cos(a - Math.PI / 2))) < 0.5) continue; // laisse libre le chemin du ponton (au sud)
      const d = g.r + 50 + rng() * 170, x = g.x + Math.cos(a) * d, z = g.z + Math.sin(a) * d, s = 3 + rng() * 7;
      if (heightAt(x, z) > -3) continue;
      const m = new THREE.Mesh(rough(new THREE.IcosahedronGeometry(1, 1), 0.18, k), iceMat);
      m.scale.set(s, s * (0.6 + rng() * 0.7), s * (0.8 + rng() * 0.5)); m.rotation.y = rng() * 6; m.castShadow = m.receiveShadow = true;
      root.add(m); circle(x, z, s * 0.95);
      const ph = rng() * 6;
      anim.push((dt, t) => { m.position.set(x, waveAt(x, z, t).h * 0.5 - s * 0.25, z); m.rotation.z = Math.sin(t * 0.4 + ph) * 0.03; });
    }
    // la cathédrale : une grande arche de glace bleue
    const w = wonder('cathedrale'), arch = new THREE.Mesh(rough(new THREE.TorusGeometry(15, 3.6, 8, 24, Math.PI), 0.12, 3), mat('#bfe8ff', { roughness: 0.25, transparent: true, opacity: 0.88, emissive: '#3a8ab0', emissiveIntensity: 0.25 }));
    arch.position.set(w.x, -2, w.z); arch.rotation.y = 0.6; arch.castShadow = true; root.add(arch);
    for (const s of [-1, 1]) circle(w.x + Math.cos(0.6) * 15 * s, w.z - Math.sin(0.6) * 15 * s, 4.5);
  }
  const SNOW = low ? 600 : 1500, snowPos = new Float32Array(SNOW * 3);
  for (let k = 0; k < SNOW; k++) snowPos.set([rng() * 120 - 60, rng() * 50, rng() * 120 - 60], k * 3);
  const snow = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(snowPos, 3)), new THREE.PointsMaterial({ color: '#ffffff', size: 0.35, transparent: true, opacity: 0.85 }));
  snow.frustumCulled = false; snow.visible = false; scene.add(snow);

  /* ----- Épaves ----- */
  const plank = mat('#5a4430'), dark = mat('#3a2e22'), algae = mat('#4a5a3a');
  function wreck(kind, x, y, z, ry, tilt) {
    const g = new THREE.Group(), big = kind === 'galion';
    const L = big ? 18 : 9, W = big ? 5 : 3, H = big ? 5.5 : 3;
    const hull = new THREE.Mesh(rough(new THREE.BoxGeometry(W, H, L, 2, 2, 6), 0.08, x), plank); hull.castShadow = true; g.add(hull);
    for (let k = -2; k <= 2; k++) { const rib = new THREE.Mesh(new THREE.BoxGeometry(W + 0.4, 0.3, 0.4), dark); rib.position.set(0, H / 2, k * L / 6); g.add(rib); }
    const bow = new THREE.Mesh(new THREE.ConeGeometry(W * 0.55, L * 0.25, 4).rotateX(Math.PI / 2), plank); bow.position.z = L * 0.62; bow.rotation.z = Math.PI / 4; g.add(bow);
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.35, big ? 14 : 6, 6), dark); mast.position.set(0, H / 2 + (big ? 5 : 2.5), big ? 2 : -1); mast.rotation.z = 0.5; mast.castShadow = true; g.add(mast);
    if (big) { const yard = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 7, 5), dark); yard.rotation.z = Math.PI / 2 + 0.5; yard.position.set(-2.5, H / 2 + 8.5, 2); g.add(yard); }
    const moss = new THREE.Mesh(new THREE.BoxGeometry(W * 1.02, H * 0.35, L * 0.9), algae); moss.position.y = -H * 0.3; g.add(moss);
    g.position.set(x, y, z); g.rotation.set(0, ry, tilt); root.add(g);
    return g;
  }
  for (const w of WRECKS) {
    wreck(w.kind, w.x, w.kind === 'galion' ? -1.6 : -0.8, w.z, rng() * 6, 0.3 + rng() * 0.25); // à moitié hors de l'eau
    circle(w.x, w.z, w.kind === 'galion' ? 6 : 3.5);
    plume(w.x, 0.2, w.z, { n: 4, size: 1.2, rise: 2, color: '#ffffff', drift: 0, life: 3, opacity: 0.35 }); // remous au-dessus de l'épave
  }
  { // deux carcasses échouées sur le banc de sable
    const b = island('naufrages');
    for (const [dx, dz, ry] of [[-14, 8, 0.8], [18, -14, 2.4]]) wreck('galion', b.x + dx, heightAt(b.x + dx, b.z + dz) + 1.2, b.z + dz, ry, 0.45);
  }

  /* ----- Grotte aux Lucioles : un dôme de roche ouvert vers le large ----- */
  {
    const R = CAVE.r + 4, gap = 1.1, phi = Math.PI - CAVE.open;
    const geo = rough(new THREE.SphereGeometry(R, 32, 14, phi + gap / 2, Math.PI * 2 - gap, 0, Math.PI / 2), 0.12, 7);
    const dome = new THREE.Mesh(geo, mat('#5a5650', { side: THREE.DoubleSide })); dome.position.set(CAVE.x, -3, CAVE.z); dome.castShadow = dome.receiveShadow = true; root.add(dome);
    // les lucioles sur la voûte
    const N = 260, dots = new THREE.InstancedMesh(new THREE.SphereGeometry(0.12, 6, 4), new THREE.MeshStandardMaterial({ color: '#9affef', emissive: '#5fffe0', emissiveIntensity: 2 }), N), o = new THREE.Object3D();
    for (let k = 0; k < N; k++) {
      const a = phi + gap / 2 + rng() * (Math.PI * 2 - gap), th = 0.15 + rng() * 1.3, r = R * 0.94;
      o.position.set(CAVE.x - Math.cos(a) * Math.sin(th) * r, -3 + Math.cos(th) * r, CAVE.z + Math.sin(a) * Math.sin(th) * r); o.scale.setScalar(0.6 + rng()); o.updateMatrix(); dots.setMatrixAt(k, o.matrix);
    }
    root.add(dots);
    const light = new THREE.PointLight('#5fffe0', 30, 45, 1.5); light.position.set(CAVE.x, 7, CAVE.z); root.add(light);
    anim.push((dt, t) => { dots.material.emissiveIntensity = 1.6 + Math.sin(t * 1.3) * 0.6; light.intensity = 24 + Math.sin(t * 0.9) * 8; });
    // les parois arrêtent le bateau, sauf à l'entrée
    for (let k = 0; k < 28; k++) {
      const a = phi + gap / 2 + (k + 0.5) / 28 * (Math.PI * 2 - gap);
      circle(CAVE.x - Math.cos(a) * R, CAVE.z + Math.sin(a) * R, 2.2);
    }
  }

  /* ----- L'Arche des Falaises ----- */
  {
    const w = wonder('arche'), rock = mat('#a39c90'), ang = 0.9, R = 16;
    const arch = new THREE.Mesh(rough(new THREE.TorusGeometry(R, 5.5, 8, 22, Math.PI), 0.16, 2), rock); // une demi-couronne de pierre posée dans l'eau
    arch.scale.set(1, 1.5, 1); arch.position.set(w.x, -3, w.z); arch.rotation.y = -ang; arch.castShadow = arch.receiveShadow = true; root.add(arch);
    for (const s of [-1, 1]) {
      const fx = w.x + Math.cos(ang) * R * s, fz = w.z + Math.sin(ang) * R * s;
      const foot = new THREE.Mesh(rough(new THREE.DodecahedronGeometry(7, 1), 0.2, s + 5), rock); foot.position.set(fx, -1, fz); foot.scale.y = 0.7; root.add(foot);
      circle(fx, fz, 7.5);
    }
  }

  /* ----- La Cascade de Port-Galet ----- */
  {
    const p = island('port'), s = shoreFrom(p, 0.12, -1), topX = s.x - s.dx * 18, topZ = s.z - s.dz * 18, topY = heightAt(topX, topZ) + 0.6;
    const c = document.createElement('canvas'); c.width = 32; c.height = 128;
    const g = c.getContext('2d'); g.fillStyle = '#bfe8ff'; g.fillRect(0, 0, 32, 128);
    for (let k = 0; k < 40; k++) { g.fillStyle = `rgba(255,255,255,${0.4 + rng() * 0.6})`; g.fillRect(rng() * 32, rng() * 128, 2 + rng() * 3, 10 + rng() * 30); }
    const tex = new THREE.CanvasTexture(c); tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(1, 3);
    const len = Math.hypot(18, topY + 0.4);
    const fall = new THREE.Mesh(new THREE.PlaneGeometry(5, len), new THREE.MeshStandardMaterial({ map: tex, transparent: true, opacity: 0.9, emissive: '#3a6a80', emissiveIntensity: 0.3, side: THREE.DoubleSide }));
    fall.position.set((s.x + topX) / 2, (topY - 0.4) / 2 + 0.3, (s.z + topZ) / 2);
    fall.rotation.order = 'YXZ'; fall.rotation.y = Math.atan2(s.dx, s.dz); fall.rotation.x = -Math.atan2(topY + 0.4, 18) - Math.PI / 2;
    root.add(fall);
    plume(s.x + s.dx * 2, 0.3, s.z + s.dz * 2, { n: 8, size: 4, rise: 5, color: '#ffffff', drift: 0, life: 3, opacity: 0.5 });
    anim.push((dt, t) => { tex.offset.y = (t * 1.2) % 1; });
  }

  /* ----- Hérons dans la mangrove ----- */
  {
    const m = island('mangrove'), white = mat('#f4f4f0', { flatShading: false }), yellow = mat('#f2c14e');
    let placed = 0;
    for (let k = 0; k < 60 && placed < 8; k++) {
      const a = rng() * Math.PI * 2, d = rng() * m.r * 1.1, x = m.x + Math.cos(a) * d, z = m.z + Math.sin(a) * d, h = heightAt(x, z);
      if (h > -0.3 || h < -1.4) continue;
      const g = new THREE.Group();
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.5, 10, 8), white); body.scale.set(0.6, 0.6, 1.1); body.position.y = 1.6; g.add(body);
      const neck = new THREE.Group(); neck.position.set(0, 1.9, 0.4); g.add(neck);
      const n1 = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.9, 6), white); n1.position.y = 0.4; neck.add(n1);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), white); head.position.set(0, 0.85, 0.1); neck.add(head);
      const beak = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.5, 5).rotateX(Math.PI / 2), yellow); beak.position.set(0, 0.85, 0.4); neck.add(beak);
      for (const s of [-1, 1]) { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.4, 4), yellow); l.position.set(s * 0.12, 0.6, 0); g.add(l); }
      g.position.set(x, -0.3, z); g.rotation.y = rng() * 6; root.add(g); placed++;
      const ph = rng() * 6;
      anim.push((dt, t) => { neck.rotation.x = Math.max(0, Math.sin(t * 0.5 + ph)) * 0.9; }); // il pique vers l'eau de temps en temps
    }
  }

  /* ----- Trésors enterrés : une croix rouge sur la plage, visible quand on approche ----- */
  const huntSpots = {}, marks = {};
  for (const [id, h] of Object.entries(HUNTS)) {
    const i = island(h.island), s = shoreFrom(i, h.dir[0], h.dir[1]);
    const land = { x: s.x - s.dx * 3, z: s.z - s.dz * 3 }, water = { x: s.x + s.dx * 10, z: s.z + s.dz * 10 };
    huntSpots[id] = { land, water };
    const g = new THREE.Group(), red = new THREE.MeshStandardMaterial({ color: '#d23b32', emissive: '#5a0a0a' });
    for (const r of [0.8, -0.8]) { const b = new THREE.Mesh(new THREE.BoxGeometry(3, 0.12, 0.6), red); b.rotation.y = r; g.add(b); }
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: sparkTex(), color: '#fff3c0', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); sp.position.y = 1.5; sp.scale.setScalar(4); g.add(sp);
    g.position.set(land.x, Math.max(0.2, heightAt(land.x, land.z)) + 0.08, land.z); g.visible = false; root.add(g);
    marks[id] = { g, sp };
    anim.push((dt, t) => { if (g.visible) sp.material.opacity = 0.5 + Math.sin(t * 4) * 0.4; });
  }

  /* ----- Le Léviathan : une ombre immense qui passe sous le bateau (une seule fois, pendant l'histoire) ----- */
  const levTex = (() => { const c = document.createElement('canvas'); c.width = 64; c.height = 256; const g = c.getContext('2d'); g.filter = 'blur(6px)'; g.fillStyle = 'rgba(4,14,26,1)';
    g.beginPath(); g.ellipse(32, 90, 20, 80, 0, 0, 7); g.fill(); g.beginPath(); g.moveTo(32, 160); g.lineTo(10, 245); g.lineTo(54, 245); g.fill(); return new THREE.CanvasTexture(c); })();
  const lev = new THREE.Mesh(new THREE.PlaneGeometry(14, 56).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: levTex, transparent: true, opacity: 0, depthWrite: false }));
  lev.renderOrder = 2; lev.visible = false; root.add(lev);
  const eyes = new THREE.Group(); for (const s of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 6), new THREE.MeshBasicMaterial({ color: '#dff6ff' })); e.position.set(s * 3, 0, -16); eyes.add(e); } lev.add(eyes);
  let levT = -1, levFrom = null;
  anim.push((dt, t) => {
    if (levT < 0) return;
    levT += dt; const k = levT / 9;
    if (k >= 1) { levT = -1; lev.visible = false; return; }
    lev.visible = true;
    lev.position.set(levFrom.x - 60 + k * 120, waveAt(levFrom.x, levFrom.z, t).h - 0.2, levFrom.z + Math.sin(k * 3) * 6); lev.rotation.y = -Math.PI / 2;
    lev.material.opacity = Math.sin(k * Math.PI) * 0.7; eyes.visible = k > 0.35 && k < 0.6;
  });

  /* ----- Margot : sa barque-boutique, amarrée au ponton du village du jour ----- */
  const margot = new THREE.Group();
  {
    const hull = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1, 6), mat('#8a5ab0')); hull.position.y = 0.2; margot.add(hull);
    for (const [x, z] of [[-1, -2], [1, -2], [-1, 2], [1, 2]]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.4, 5), mat('#5a4030')); p.position.set(x, 1.8, z); margot.add(p); }
    for (let k = 0; k < 6; k++) { const s = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.08, 0.72), mat(k % 2 ? '#ffffff' : '#ff7a59')); s.position.set(0, 3.05, -1.8 + k * 0.72); margot.add(s); }
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.52, 1.4, 8), mat('#2fb3a6')); body.position.set(0, 1.4, 0.6); margot.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.4, 10, 8), mat('#f1c9a5', { flatShading: false })); head.position.set(0, 2.4, 0.6); margot.add(head);
    const hat = new THREE.Mesh(new THREE.ConeGeometry(0.7, 0.5, 12), mat('#f2c14e')); hat.position.set(0, 2.85, 0.6); margot.add(hat);
    for (let k = 0; k < 5; k++) { const c = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.4, 0.5), mat(['#c8645a', '#e0b23c', '#5a8ab0', '#7a9a52', '#d08a4a'][k])); c.position.set(-0.8 + (k % 3) * 0.8, 0.9, -1.8 + Math.floor(k / 3) * 0.7); margot.add(c); }
    margot.traverse(o => { if (o.isMesh) o.castShadow = true; });
    margot.visible = false; root.add(margot);
  }

  return {
    leviathan(x, z) { levT = 0; levFrom = { x, z }; },
    setMargot(dock) { margot.visible = !!dock; if (dock) { margot.position.set(dock.x - Math.sin(dock.heading) * 10 + Math.cos(dock.heading) * 3, 0, dock.z - Math.cos(dock.heading) * 10 - Math.sin(dock.heading) * 3); margot.rotation.y = dock.heading; } },
    margotGroup: margot,
    huntSpots,
    setHunt: (id, on) => { if (marks[id]) marks[id].g.visible = on; },
    // la neige tombe autour de la caméra près des Glaciers
    update(dt, time, night, focus, camera, under) {
      const g = island('glaciers'), near = Math.hypot(focus.x - g.x, focus.z - g.z) < 420 && !under;
      snow.visible = near;
      if (!near) return;
      snow.position.set(camera.position.x, camera.position.y - 20, camera.position.z);
      const p = snow.geometry.attributes.position;
      for (let k = 0; k < SNOW; k++) {
        let y = p.getY(k) - dt * 3; if (y < 0) y += 50;
        p.setY(k, y); p.setX(k, p.getX(k) + Math.sin(time + k) * dt * 0.6);
      }
      p.needsUpdate = true;
    },
  };
}
