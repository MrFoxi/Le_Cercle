// Décor de Top Formula : terrain en relief, eau, bateaux, stands, tribunes (foule qui bouge), forêts, immeubles (néons la nuit),
// commissaires et drapeaux, hélicoptère TV, dirigeable, et les lieux propres à chaque circuit : tunnel et piscine (Riviera),
// pont (Lago), grande roue (Marina).
import * as THREE from 'three';
import { hillsAt, locateAll } from './tracks.js';
import * as TX from './textures.js';

export const rnd = (() => { let s = 1; return { seed: v => (s = v), next: () => ((s = (s * 16807) % 2147483647) / 2147483647) }; })();
const smooth = x => x * x * (3 - 2 * x);

// Hauteur du sol partout : collines au loin, et aplanie à la hauteur de la piste à ses abords.
export function heightField(t) {
  const cell = 20, map = new Map(), key = (a, b) => a * 100003 + b;
  for (let i = 0; i < t.N; i += 2) { const k = key(Math.floor(t.x[i] / cell), Math.floor(t.y[i] / cell)); if (!map.has(k)) map.set(k, []); map.get(k).push(i); }
  const nearest = (x, y, R) => {
    let best = -1, bd = R * R;
    const cx = Math.floor(x / cell), cy = Math.floor(y / cell), span = Math.ceil(R / cell);
    for (let a = -span; a <= span; a++) for (let b = -span; b <= span; b++) for (const i of map.get(key(cx + a, cy + b)) ?? []) {
      const d = (x - t.x[i]) ** 2 + (y - t.y[i]) ** 2; if (d < bd) { bd = d; best = i; }
    }
    return best < 0 ? null : { i: best, d: Math.sqrt(bd) };
  };
  const wall = i => Math.max(t.wl[i], t.wr[i]);
  const at = (x, y) => {
    const base = hillsAt(t.def, x, y), n = nearest(x, y, 90);
    if (!n) return base;
    const d0 = wall(n.i) + 6, k = n.d < d0 ? 1 : n.d > d0 + 50 ? 0 : 1 - smooth((n.d - d0) / 50);
    return base + (t.h[n.i] - 0.25 - base) * k;
  };
  // true si le disque (x, y, r) ne touche ni la piste ni ses murs
  const free = (x, y, r) => { const n = nearest(x, y, r + 45); return !n || n.d > wall(n.i) + r; };
  return { at, free, nearest };
}

export function inside(t, x, y) {
  let c = false;
  for (let i = 0, j = t.N - 1; i < t.N; j = i, i += 1) if ((t.y[i] > y) !== (t.y[j] > y) && x < (t.x[j] - t.x[i]) * (y - t.y[i]) / (t.y[j] - t.y[i]) + t.x[i]) c = !c;
  return c;
}

// Terrain : une grille qui suit le relief, plus un grand plan au-delà.
export function terrain(scene, t, hf, mat, bbox, low) {
  const cs = low ? 20 : 12, x0 = bbox.x0 - 900, z0 = bbox.y0 - 900, nx = Math.ceil((bbox.x1 - bbox.x0 + 1800) / cs), nz = Math.ceil((bbox.y1 - bbox.y0 + 1800) / cs);
  const pos = new Float32Array((nx + 1) * (nz + 1) * 3), uv = new Float32Array((nx + 1) * (nz + 1) * 2), idx = [];
  for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) {
    const k = j * (nx + 1) + i, x = x0 + i * cs, z = z0 + j * cs;
    pos.set([x, hf.at(x, z), z], k * 3); uv.set([x / 25, -z / 25], k * 2);
    if (i < nx && j < nz) idx.push(k, k + nx + 1, k + 1, k + 1, k + nx + 1, k + nx + 2);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
  const m = new THREE.Mesh(g, mat); m.receiveShadow = true; scene.add(m);
  const far = new THREE.Mesh(new THREE.PlaneGeometry(12000, 12000), mat.clone()); far.material.map = mat.map.clone(); far.material.map.repeat.set(480, 480); far.material.map.needsUpdate = true;
  far.rotation.x = -Math.PI / 2; far.position.set((bbox.x0 + bbox.x1) / 2, -1.5, (bbox.y0 + bbox.y1) / 2); scene.add(far);
}

/* ---------------- Eau et bateaux ---------------- */
export function water(scene, t, th, hf, bbox, uTime) {
  const waves = TX.canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#fff'; g.fillRect(0, 0, w, h);
    for (let k = 0; k < 220; k++) { g.strokeStyle = `rgba(0,0,0,${0.05 + Math.random() * 0.08})`; g.lineWidth = 1 + Math.random() * 2; const x = Math.random() * w, y = Math.random() * h; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + 10, y - 4, x + 22 + Math.random() * 20, y); g.stroke(); }
  }, { key: 'waves' });
  const mat = new THREE.MeshStandardMaterial({ color: th.water, map: waves, roughness: 0.08, metalness: 0.35, transparent: true, opacity: 0.93 });
  const tests = [], boats = [], places = {};
  if (t.def.water === 'south') { // port au sud de la ligne droite
    const y0 = Math.max(...t.y) + Math.max(...t.wl, ...t.wr) + 9; // le port longe la ligne droite, juste derrière le mur
    const geo = new THREE.PlaneGeometry(bbox.x1 - bbox.x0 + 2000, 1400); geo.attributes.uv.array.forEach((v, k, a) => (a[k] = v * 40));
    const m = new THREE.Mesh(geo, mat); m.rotation.x = -Math.PI / 2; m.position.set((bbox.x0 + bbox.x1) / 2, 0.05, y0 + 700); scene.add(m);
    const quay = new THREE.Mesh(new THREE.BoxGeometry(bbox.x1 - bbox.x0 + 2000, 1.4, 3), new THREE.MeshStandardMaterial({ color: '#cfc7b4', roughness: 0.9 }));
    quay.position.set((bbox.x0 + bbox.x1) / 2, 0.3, y0); quay.receiveShadow = true; scene.add(quay);
    boats.push(...addBoats(scene, bbox.x0 + 100, bbox.x1 - 100, y0 + 40, y0 + 190, th, 18));
    tests.push((x, y, r) => y + r > y0 - 4);
    places.harbor = { y0, x0: bbox.x0, x1: bbox.x1 };
  }
  if (t.def.water === 'lake') { // lac au milieu du circuit, là où il y a le plus de place
    let best = null;
    for (let x = bbox.x0 + 260; x < bbox.x1 - 260; x += 12) for (let y = bbox.y0 + 260; y < bbox.y1 - 260; y += 12) {
      if (!inside(t, x, y)) continue;
      let d = Infinity; for (let i = 0; i < t.N; i += 3) d = Math.min(d, Math.hypot(x - t.x[i], y - t.y[i]) - Math.max(t.wl[i], t.wr[i]));
      if (!best || d > best.d) best = { x, y, d };
    }
    if (best && best.d > 40) {
      const r = best.d - 22, lvl = hf.at(best.x, best.y) + 0.1, geo = new THREE.CircleGeometry(1, 64);
      geo.attributes.uv.array.forEach((v, k, a) => (a[k] = v * 10));
      const m = new THREE.Mesh(geo, mat); m.rotation.x = -Math.PI / 2; m.scale.set(r * 1.25, r * 0.85, 1); m.position.set(best.x, lvl, best.y); scene.add(m);
      const shore = new THREE.Mesh(new THREE.RingGeometry(1, 1.07, 64), new THREE.MeshStandardMaterial({ color: '#d8c79a', roughness: 1 }));
      shore.rotation.x = -Math.PI / 2; shore.scale.set(r * 1.25, r * 0.85, 1); shore.position.set(best.x, lvl + 0.01, best.y); scene.add(shore);
      tests.push((x, y, rr) => ((x - best.x) / (r * 1.25 + rr + 4)) ** 2 + ((y - best.y) / (r * 0.85 + rr + 4)) ** 2 < 1);
      boats.push(...addBoats(scene, best.x - r * 0.6, best.x + r * 0.6, best.y - r * 0.35, best.y + r * 0.35, th, 6, lvl));
    }
  }
  return {
    wet: (x, y, r) => tests.some(f => f(x, y, r)), boats, places,
    update(dt) { waves.offset.x += dt * 0.004; waves.offset.y += dt * 0.002; for (const b of boats) b.update(dt); },
  };
}

function addBoats(scene, x0, x1, y0, y1, th, n, lvl = 0) {
  const hull = new THREE.MeshStandardMaterial({ color: '#f4f4f2', roughness: 0.35 }), deck = new THREE.MeshStandardMaterial({ color: '#b98a5a', roughness: 0.7 });
  const glass = new THREE.MeshStandardMaterial({ color: '#1b2a3a', emissive: th.lights ? '#ffd27a' : '#000', emissiveIntensity: th.lights ? 1.4 : 0, roughness: 0.15, metalness: 0.4 });
  const wake = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.35, depthWrite: false });
  const list = [];
  for (let k = 0; k < n; k++) {
    const g = new THREE.Group(), L = 10 + rnd.next() * 26;
    const s = new THREE.Shape(); s.moveTo(L / 2, 0); s.quadraticCurveTo(L * 0.2, L * 0.13, -L / 2, L * 0.12); s.lineTo(-L / 2, -L * 0.12); s.quadraticCurveTo(L * 0.2, -L * 0.13, L / 2, 0);
    const geo = new THREE.ExtrudeGeometry(s, { depth: 1.4, bevelEnabled: false }); geo.rotateX(-Math.PI / 2);
    const h = new THREE.Mesh(geo, hull); h.castShadow = true; g.add(h);
    const d = new THREE.Mesh(new THREE.BoxGeometry(L * 0.35, 0.3, L * 0.14), deck); d.position.set(-L * 0.25, 1.5, 0); g.add(d);
    const c = new THREE.Mesh(new THREE.BoxGeometry(L * 0.32, 1.4, L * 0.15), hull); c.position.set(L * 0.05, 2.1, 0); c.castShadow = true; g.add(c);
    const w = new THREE.Mesh(new THREE.BoxGeometry(L * 0.2, 0.5, L * 0.155), glass); w.position.set(L * 0.1, 2.3, 0); g.add(w);
    const moving = rnd.next() < 0.4, speed = moving ? 2 + rnd.next() * 4 : 0;
    if (moving) { const wk = new THREE.Mesh(new THREE.PlaneGeometry(L * 1.4, L * 0.35), wake); wk.rotation.x = -Math.PI / 2; wk.position.set(-L * 0.9, 0.1, 0); g.add(wk); }
    const b = { g, x: x0 + rnd.next() * (x1 - x0), y: y0 + rnd.next() * (y1 - y0), a: moving ? (rnd.next() < 0.5 ? 0 : Math.PI) : rnd.next() < 0.7 ? Math.PI / 2 : rnd.next() * 6, bob: rnd.next() * 6 };
    b.update = dt => {
      b.x += Math.cos(b.a) * speed * dt; b.bob += dt;
      if (b.x > x1) b.x = x0; if (b.x < x0) b.x = x1;
      g.position.set(b.x, lvl + Math.sin(b.bob * 1.3) * 0.12, b.y); g.rotation.set(Math.sin(b.bob) * 0.02, -b.a, 0);
    };
    b.update(0);
    scene.add(g); list.push(b);
  }
  return list;
}

/* ---------------- Stands, tribunes, drapeaux ---------------- */
const flagMat = c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.7, side: THREE.DoubleSide });
function flagRow(group, n, x0, step, y, z, colors, flags) {
  const pole = new THREE.MeshStandardMaterial({ color: '#d9dde3', roughness: 0.4, metalness: 0.6 });
  for (let k = 0; k < n; k++) {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 5, 5), pole); p.position.set(x0 + k * step, y + 2.5, z); group.add(p);
    const f = new THREE.Group(); f.position.set(x0 + k * step, y + 4.6, z);
    const geo = new THREE.PlaneGeometry(1.8, 1.1, 6, 1); geo.translate(0.9, 0, 0);
    const m = new THREE.Mesh(geo, flagMat(colors[k % colors.length])); f.add(m); group.add(f);
    flags.push({ f, geo, base: geo.attributes.position.array.slice(), ph: k * 0.7 });
  }
}
export function waveFlags(flags, time) {
  for (const { geo, base, ph } of flags) {
    const a = geo.attributes.position.array;
    for (let k = 0; k < a.length; k += 3) a[k + 2] = base[k + 2] + Math.sin(time * 7 + base[k] * 2.4 + ph) * 0.18 * (base[k] / 1.8);
    geo.attributes.position.needsUpdate = true;
  }
}

export function pits(scene, t, side, th, hf, flags) {
  const i = t.wrap(-Math.round(60 / t.ds)), w = side > 0 ? t.wl[i] : t.wr[i], off = side * (w + 16);
  const ang = Math.atan2(t.ty[i], t.tx[i]);
  const g = new THREE.Group();
  const lane = new THREE.Mesh(new THREE.PlaneGeometry(170, 10), new THREE.MeshStandardMaterial({ map: TX.asphalt(!!th.lights), roughness: 0.85 }));
  lane.rotation.x = -Math.PI / 2; lane.receiveShadow = true; lane.position.set(0, 0.3, 13);
  const roof = TX.canvasTex(1024, 96, (c, W, H) => {
    c.fillStyle = '#e9ecf1'; c.fillRect(0, 0, W, H); c.fillStyle = '#d92b2b'; c.fillRect(0, H - 14, W, 14);
    c.fillStyle = '#1b1f2a'; c.font = 'italic 900 54px Titillium Web, Inter, system-ui, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText('TOP FORMULA', W / 2, H / 2 - 4);
  }, { repeat: false, key: 'pitroof' });
  const mats = [0, 1, 2, 3, 4, 5].map(k => k === 2 ? new THREE.MeshStandardMaterial({ map: roof, roughness: 0.6 }) : new THREE.MeshStandardMaterial({ color: '#cfd4dc', roughness: 0.7 }));
  const bld = new THREE.Mesh(new THREE.BoxGeometry(170, 12, 16), mats); bld.position.set(0, 3, 0); bld.castShadow = bld.receiveShadow = true;
  const teams = ['#e10600', '#00d2be', '#ff8700', '#0600ef', '#006f62', '#f596c8', '#2b4562', '#b6babd', '#52e252', '#ffd400'];
  teams.forEach((c, k) => {
    const d = new THREE.Mesh(new THREE.PlaneGeometry(12, 5), new THREE.MeshStandardMaterial({ color: c, roughness: 0.5 })); d.position.set(-72 + k * 16, 2.6, 8.05); g.add(d);
    // voitures de l'équipe garées devant le garage : de simples silhouettes
    const car = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.6, 1.5), new THREE.MeshStandardMaterial({ color: c, roughness: 0.4 })); car.position.set(-72 + k * 16, 0.6, 10.5); car.castShadow = true; g.add(car);
  });
  g.add(bld, lane);
  const pitWall = new THREE.Mesh(new THREE.BoxGeometry(170, 1.2, 0.6), new THREE.MeshStandardMaterial({ color: '#dfe3e8' })); pitWall.position.set(0, 0.9, 18.5); pitWall.castShadow = true; g.add(pitWall);
  flagRow(g, 10, -75, 16.5, 9, -6, teams, flags);
  g.position.set(t.x[i] + t.nx[i] * (off + side * 7), t.h[i], t.y[i] + t.ny[i] * (off + side * 7));
  g.rotation.y = -ang + (side < 0 ? Math.PI : 0);
  scene.add(g);
  return { x: g.position.x, y: g.position.z, r: 90 };
}

export function stands(scene, t, hf, free, side, uTime, flags) {
  const placed = [], crowdGeo = new THREE.BoxGeometry(0.55, 0.9, 0.55), stepMat = new THREE.MeshStandardMaterial({ color: '#9aa1ab', roughness: 0.8 });
  const colors = ['#e63946', '#f1faee', '#ffb703', '#219ebc', '#8ecae6', '#fb8500', '#2a9d8f', '#e9c46a', '#ffffff', '#264653'];
  const crowdMat = new THREE.MeshStandardMaterial({ roughness: 0.8 });
  // La foule saute un peu, chacun à son rythme.
  crowdMat.onBeforeCompile = sh => {
    sh.uniforms.uTime = uTime;
    sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n float ph = instanceMatrix[3].x * 1.7 + instanceMatrix[3].z * 3.1; transformed.y += max(0.0, sin(uTime * (4.0 + fract(ph) * 3.0) + ph)) * 0.28;');
  };
  const candidates = [];
  for (let i = 0; i < t.N; i += 6) if (Math.abs(t.curv[i]) < 0.002 && Math.abs(t.curv[t.wrap(i + 20)]) < 0.002 && Math.abs(t.curv[t.wrap(i - 20)]) < 0.002) candidates.push(i);
  for (const i0 of [0, ...candidates.filter(i => i > 40)]) {
    if (placed.length >= 5) break;
    const i = t.wrap(i0 - (i0 === 0 ? Math.round(10 / t.ds) : 0));
    for (const s of i0 === 0 ? [side] : [side, -side]) {
      const L = 60, D = 14, w = s > 0 ? t.wl[i] : t.wr[i], off = s * (w + 4 + D / 2);
      const x = t.x[i] + t.nx[i] * off, y = t.y[i] + t.ny[i] * off;
      if (!free(x, y, D / 2 + 1) || placed.some(p => Math.hypot(p.x - x, p.y - y) < 90)) continue;
      if (![-1, 1].every(e => free(x + t.tx[i] * e * L / 2, y + t.ty[i] * e * L / 2, D / 2))) continue;
      const g = new THREE.Group(), people = [];
      for (let r = 0; r < 6; r++) {
        const st = new THREE.Mesh(new THREE.BoxGeometry(L, 3 + r * 0.9, D / 6), stepMat);
        st.position.set(0, (r * 0.9 - 1) / 2, -D / 2 + (r + 0.5) * D / 6); st.castShadow = st.receiveShadow = true; g.add(st);
        for (let k = 0; k < 70; k++) if (rnd.next() < 0.85) people.push([-L / 2 + 0.6 + k * (L - 1.2) / 70, 1 + r * 0.9 - 0.05, -D / 2 + (r + 0.5) * D / 6, colors[Math.floor(rnd.next() * colors.length)]]);
      }
      const im = new THREE.InstancedMesh(crowdGeo, crowdMat, people.length), m = new THREE.Matrix4(), col = new THREE.Color();
      people.forEach(([px, py, pz, c], k) => { im.setMatrixAt(k, m.makeTranslation(px, py, pz)); im.setColorAt(k, col.set(c)); });
      im.castShadow = true; g.add(im);
      // auvent et drapeaux en haut de la tribune
      const roof = new THREE.Mesh(new THREE.BoxGeometry(L, 0.3, 4), new THREE.MeshStandardMaterial({ color: '#eef1f5', roughness: 0.5 })); roof.position.set(0, 9, D / 2 - 1); roof.castShadow = true; g.add(roof);
      flagRow(g, 6, -L / 2 + 5, (L - 10) / 5, 8.5, D / 2 + 0.5, colors, flags);
      g.position.set(x, hf.at(x, y), y);
      g.rotation.y = -Math.atan2(t.ty[i], t.tx[i]) + (s > 0 ? Math.PI : 0);
      scene.add(g);
      placed.push({ x, y, r: L / 2 + 4 });
    }
  }
  return placed;
}

/* ---------------- Végétation, immeubles, éclairage ---------------- */
export function trees(scene, t, hf, free, bbox, avoid, low) {
  const list = [], want = t.def.theme === 'park' ? (low ? 900 : 1900) : 160;
  for (let k = 0; k < want * 6 && list.length < want; k++) {
    const x = bbox.x0 - 300 + rnd.next() * (bbox.x1 - bbox.x0 + 600), y = bbox.y0 - 300 + rnd.next() * (bbox.y1 - bbox.y0 + 600), r = 2.5 + rnd.next() * 3.5;
    if (!free(x, y, r + 6) || avoid(x, y, r)) continue;
    // forêts : surtout sur les collines et en bosquets
    const hill = hillsAt(t.def, x, y);
    if (list.length > 40 && hill < 1 && rnd.next() < 0.65 && !list.some(o => Math.hypot(o.x - x, o.y - y) < 12)) continue;
    list.push({ x, y, r, conifer: hill > 3 ? rnd.next() < 0.7 : rnd.next() < 0.25 });
  }
  const make = (geo, items, hue) => {
    const im = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ roughness: 0.85, flatShading: true }), items.length);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), col = new THREE.Color(), Y = new THREE.Vector3(0, 1, 0);
    items.forEach((p, k) => {
      const h = hf.at(p.x, p.y);
      m.compose(new THREE.Vector3(p.x, h + (p.conifer ? p.r * 1.6 : p.r * 1.3), p.y), q.setFromAxisAngle(Y, rnd.next() * 6), new THREE.Vector3(p.r, p.conifer ? p.r * 1.7 : p.r * 0.9, p.r));
      im.setMatrixAt(k, m); im.setColorAt(k, col.setHSL(hue + rnd.next() * 0.07, 0.42 + rnd.next() * 0.2, (p.conifer ? 0.16 : 0.22) + rnd.next() * 0.12));
    });
    im.castShadow = im.receiveShadow = true;
    scene.add(im);
  };
  make(new THREE.IcosahedronGeometry(1, 1), list.filter(p => !p.conifer), 0.25);
  make(new THREE.ConeGeometry(1, 2, 7), list.filter(p => p.conifer), 0.32);
}

export function buildings(scene, t, th, hf, free, avoid) {
  const list = [];
  for (const row of [0, 1, 2]) for (let i = 0; i < t.N; i += 7) for (const s of [1, -1]) {
    const L = 12 + rnd.next() * 14, D = 12 + rnd.next() * 14, H = th.lights ? 12 + rnd.next() * (row ? 40 : 26) : 9 + rnd.next() * 22;
    const w = s > 0 ? t.wl[i] : t.wr[i], off = s * (w + 7 + D / 2 + row * 30);
    const x = t.x[i] + t.nx[i] * off, y = t.y[i] + t.ny[i] * off, r = Math.max(L, D) / 2;
    if (!free(x, y, r * 0.8 + 3) || avoid(x, y, r) || list.some(b => Math.hypot(b.x - x, b.y - y) < (b.r + r) * 0.85)) continue;
    list.push({ x, y, r, L, D, H, a: Math.atan2(t.ty[i], t.tx[i]), base: hf.at(x, y) });
  }
  // Façades : fenêtres sur fond blanc (teinté par la couleur de l'immeuble) ; la nuit, seules les fenêtres allumées brillent.
  const lit = Array.from({ length: 40 }, () => Math.random() < 0.5);
  const win = TX.canvasTex(64, 128, (g, w, h) => {
    g.fillStyle = '#fff'; g.fillRect(0, 0, w, h);
    for (let a = 0; a < 4; a++) for (let b = 0; b < 10; b++) { g.fillStyle = th.lights ? '#1a1f2b' : '#8fa8bd'; g.fillRect(4 + a * 15, 5 + b * 12, 9, 7); g.fillStyle = 'rgba(255,255,255,.35)'; if (!th.lights) g.fillRect(4 + a * 15, 5 + b * 12, 9, 2); }
    TX.speckle(g, w, h, 300, 1, 0.08);
  }, { key: 'win' + !!th.lights });
  const emis = th.lights ? TX.canvasTex(64, 128, (g, w, h) => {
    g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
    for (let a = 0; a < 4; a++) for (let b = 0; b < 10; b++) if (lit[a * 10 + b]) { g.fillStyle = ['#ffd58a', '#ffe9c4', '#a8d4ff'][(a + b) % 3]; g.fillRect(4 + a * 15, 5 + b * 12, 9, 7); }
  }, { key: 'winlit' }) : null;
  const mat = new THREE.MeshStandardMaterial({ map: win, roughness: 0.7, emissiveMap: emis, emissive: th.lights ? '#ffffff' : '#000000', emissiveIntensity: th.lights ? 1.3 : 0 });
  const box = new THREE.BoxGeometry(1, 1, 1);
  const im = new THREE.InstancedMesh(box, mat, list.length), roofs = new THREE.InstancedMesh(box, new THREE.MeshStandardMaterial({ roughness: 0.9 }), list.length * 3);
  const neon = th.lights ? new THREE.InstancedMesh(box, new THREE.MeshBasicMaterial({ toneMapped: false }), list.length * 4) : null;
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), col = new THREE.Color(), Y = new THREE.Vector3(0, 1, 0), p = new THREE.Vector3();
  const palette = th.lights ? ['#4b5a74', '#39465c', '#5d6b85', '#2f3a4e'] : ['#f2e6cf', '#e9d2b0', '#f5efe4', '#e7c7a0', '#d9b48e', '#efe0c6', '#cfd6dc'];
  const neons = ['#ff2bd6', '#2be9ff', '#7a5cff', '#ff5a2b', '#38ff9a'];
  list.forEach((b, k) => {
    q.setFromAxisAngle(Y, -b.a);
    m.compose(new THREE.Vector3(b.x, b.base + b.H / 2 - 2, b.y), q, new THREE.Vector3(b.L, b.H + 4, b.D));
    im.setMatrixAt(k, m); im.setColorAt(k, col.set(palette[Math.floor(rnd.next() * palette.length)]));
    const top = b.base + b.H;
    for (let r = 0; r < 3; r++) {
      const sx = r ? 2 + rnd.next() * 3 : b.L * 0.86, sz = r ? 2 + rnd.next() * 3 : b.D * 0.86, sy = r ? 1.2 : 0.3;
      p.set(r ? (rnd.next() - 0.5) * b.L * 0.6 : 0, 0, r ? (rnd.next() - 0.5) * b.D * 0.6 : 0).applyQuaternion(q);
      m.compose(new THREE.Vector3(b.x + p.x, top + sy / 2, b.y + p.z), q, new THREE.Vector3(sx, sy, sz));
      roofs.setMatrixAt(k * 3 + r, m);
      roofs.setColorAt(k * 3 + r, col.set(r ? '#9ca3ad' : th.lights ? '#283246' : ['#c96f4a', '#b7b1a6', '#d08a5c', '#a9a39a'][Math.floor(rnd.next() * 4)]));
    }
    if (neon) { // bordures néon sur le toit
      const c = neons[k % neons.length];
      [[0, b.D / 2, b.L, 0.35], [0, -b.D / 2, b.L, 0.35], [b.L / 2, 0, 0.35, b.D], [-b.L / 2, 0, 0.35, b.D]].forEach(([ox, oz, sx, sz], e) => {
        p.set(ox, 0, oz).applyQuaternion(q);
        m.compose(new THREE.Vector3(b.x + p.x, top + 0.3, b.y + p.z), q, new THREE.Vector3(sx, 0.35, sz));
        neon.setMatrixAt(k * 4 + e, m); neon.setColorAt(k * 4 + e, col.set(c).multiplyScalar(k % 3 ? 0 : 2.2)); // un immeuble sur trois
      });
    }
  });
  im.castShadow = im.receiveShadow = true; roofs.castShadow = roofs.receiveShadow = true;
  scene.add(im, roofs);
  if (neon) scene.add(neon);
}

export function floodlights(scene, t, rain) {
  const pool = TX.canvasTex(128, 128, (g, w) => {
    const r = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    r.addColorStop(0, `rgba(255,244,214,${rain ? 0.3 : 0.2})`); r.addColorStop(0.5, 'rgba(255,240,200,.07)'); r.addColorStop(1, 'rgba(255,240,200,0)');
    g.fillStyle = r; g.fillRect(0, 0, w, w);
  }, { repeat: false, key: 'pool' + rain });
  const poolMat = new THREE.MeshBasicMaterial({ map: pool, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  const head = new THREE.MeshStandardMaterial({ color: '#fff', emissive: '#fff6e0', emissiveIntensity: 3 });
  const pole = new THREE.MeshStandardMaterial({ color: '#222', roughness: 0.6 });
  const n = Math.floor(t.N / 16), heads = new THREE.InstancedMesh(new THREE.BoxGeometry(2.2, 0.5, 1.2), head, n), poles = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.2, 0.25, 12, 6), pole, n);
  const pools = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), poolMat, n);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), Y = new THREE.Vector3(0, 1, 0), X = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);
  for (let k = 0; k < n; k++) {
    const i = k * 16, s = k % 2 ? 1 : -1, w = (s > 0 ? t.wl[i] : t.wr[i]) + 1.5, h = t.h[i];
    const x = t.x[i] + t.nx[i] * w * s, y = t.y[i] + t.ny[i] * w * s;
    q.setFromAxisAngle(Y, -Math.atan2(t.ty[i], t.tx[i]));
    m.compose(new THREE.Vector3(x, h + 6, y), q, new THREE.Vector3(1, 1, 1)); poles.setMatrixAt(k, m);
    m.compose(new THREE.Vector3(x - t.nx[i] * s * 1.2, h + 12, y - t.ny[i] * s * 1.2), q, new THREE.Vector3(1, 1, 1)); heads.setMatrixAt(k, m);
    m.compose(new THREE.Vector3(t.x[i] + t.nx[i] * s * 2, h + 0.09, t.y[i] + t.ny[i] * s * 2), X, new THREE.Vector3(34, 34, 1)); pools.setMatrixAt(k, m);
  }
  scene.add(heads, poles, pools);
}

/* ---------------- Commissaires ---------------- */
export function marshals(scene, t) {
  const list = [], suit = new THREE.MeshStandardMaterial({ color: '#ff7a1a', roughness: 0.7 }), skin = new THREE.MeshStandardMaterial({ color: '#e7b48f', roughness: 0.8 });
  const hut = new THREE.MeshStandardMaterial({ color: '#e9ecef', roughness: 0.6 }), yellow = flagMat('#ffd400');
  for (let i = 40; i < t.N - 20; i += Math.round(140 / t.ds)) {
    const s = t.wl[i] > t.wr[i] ? 1 : -1, w = (s > 0 ? t.wl[i] : t.wr[i]) + 2.2;
    const x = t.x[i] + t.nx[i] * w * s, y = t.y[i] + t.ny[i] * w * s;
    const g = new THREE.Group();
    const box = new THREE.Mesh(new THREE.BoxGeometry(1.6, 2.2, 1.4), hut); box.position.set(0, 1.1, 1.4); box.castShadow = true; g.add(box);
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 0.8, 4, 8), suit); body.position.y = 0.95; body.castShadow = true; g.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), skin); head.position.y = 1.75; g.add(head);
    const arm = new THREE.Group(); arm.position.set(0, 1.5, -0.3); g.add(arm);
    const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.6, 4), hut); stick.position.y = 0.8; arm.add(stick);
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.75), yellow); flag.position.set(0.55, 1.25, 0); arm.add(flag);
    g.position.set(x, t.h[i], y);
    g.rotation.y = -Math.atan2(t.ty[i], t.tx[i]) + (s > 0 ? 0 : Math.PI);
    scene.add(g);
    list.push({ g, arm, flag, x, y, alert: 0, ph: Math.random() * 6 });
  }
  return {
    incident(x, y) { for (const m of list) if (Math.hypot(m.x - x, m.y - y) < 120) m.alert = 6; },
    update(dt, time) {
      for (const m of list) {
        m.alert = Math.max(0, m.alert - dt);
        m.flag.visible = m.alert > 0;
        m.arm.rotation.x = m.alert > 0 ? Math.sin(time * 9 + m.ph) * 0.9 : 0.15;
      }
    },
  };
}

/* ---------------- Hélicoptère TV et dirigeable (ombre seule) ---------------- */
export function aircraft(scene, th, center, radius) {
  const heli = new THREE.Group();
  const paint = new THREE.MeshStandardMaterial({ color: '#1d3b8f', roughness: 0.35, metalness: 0.4 }), white = new THREE.MeshStandardMaterial({ color: '#f2f4f8', roughness: 0.4 });
  const body = new THREE.Mesh(new THREE.SphereGeometry(1.4, 14, 10), paint); body.scale.set(1.8, 1, 1); heli.add(body);
  const boom = new THREE.Mesh(new THREE.BoxGeometry(5, 0.35, 0.35), paint); boom.position.set(-3.6, 0.3, 0); heli.add(boom);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.2, 0.1), white); fin.position.set(-6, 0.8, 0); heli.add(fin);
  for (const z of [-0.9, 0.9]) { const sk = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.1, 0.12), white); sk.position.set(0, -1.4, z); heli.add(sk); }
  const rotor = new THREE.Group(); rotor.position.y = 1.4; heli.add(rotor);
  for (const r of [0, Math.PI / 2]) { const b = new THREE.Mesh(new THREE.BoxGeometry(11, 0.06, 0.35), new THREE.MeshStandardMaterial({ color: '#222' })); b.rotation.y = r; rotor.add(b); }
  heli.traverse(o => o.isMesh && (o.castShadow = true));
  let beam = null;
  if (th.lights) { // projecteur la nuit
    beam = new THREE.Mesh(new THREE.ConeGeometry(7, 36, 24, 1, true), new THREE.MeshBasicMaterial({ color: '#fff6dc', transparent: true, opacity: 0.07, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    beam.position.y = -18; heli.add(beam);
  }
  scene.add(heli);
  // Dirigeable : invisible (au-dessus de la caméra) mais son ombre glisse sur le circuit.
  const blimp = new THREE.Mesh(new THREE.CapsuleGeometry(7, 28, 6, 16), new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false }));
  blimp.rotation.z = Math.PI / 2; blimp.castShadow = true; scene.add(blimp);
  const st = { x: center.x, y: center.y, a: 0, h: 30, b: Math.random() * 6 };
  heli.scale.setScalar(0.8);
  return {
    update(dt, focus, time) {
      if (focus) {
        const tx = focus.x + 70, ty = focus.y - 50; // de côté, pour ne pas cacher la course
        const vx = (tx - st.x) * Math.min(1, dt * 0.8), vy = (ty - st.y) * Math.min(1, dt * 0.8);
        st.x += vx; st.y += vy;
        const sp = Math.hypot(vx, vy) / Math.max(dt, 1e-3);
        if (sp > 1) { let d = Math.atan2(vy, vx) - st.a; d = Math.atan2(Math.sin(d), Math.cos(d)); st.a += d * Math.min(1, dt * 2); }
        heli.position.set(st.x, (focus.h ?? 0) + st.h + Math.sin(time) * 0.6, st.y);
        heli.rotation.set(0, -st.a, -Math.min(0.25, sp * 0.008)); // penche vers l'avant en accélérant
      }
      rotor.rotation.y += dt * 40;
      st.b += dt * 0.012;
      blimp.position.set(center.x + Math.cos(st.b) * radius, 160, center.y + Math.sin(st.b) * radius * 0.6);
      blimp.rotation.y = -st.b - Math.PI / 2;
    },
  };
}

/* ---------------- Lieux propres à chaque circuit ---------------- */
// Riviera : tunnel (le toit s'efface quand la caméra suit une voiture dessous) et piscine sur le port.
export function tunnel(scene, t) {
  const [a0, b0] = [locateAll(t, -130, -300).i, locateAll(t, -260, -310).i];
  const len = t.wrap(b0 - a0), a = t.wrap(a0 + Math.round(len * 0.15)), b = t.wrap(b0 - Math.round(len * 0.15));
  const inRange = (i, m = 0) => t.wrap(i - a + m) <= t.wrap(b - a) + 2 * m;
  const H = 7;
  const roofMat = new THREE.MeshStandardMaterial({ map: TX.garden(), roughness: 0.9, transparent: true, side: THREE.DoubleSide });
  const wallMat = new THREE.MeshStandardMaterial({ color: '#b9b2a4', roughness: 0.85, transparent: true, side: THREE.DoubleSide });
  const lamp = new THREE.MeshBasicMaterial({ color: '#ffb35a', toneMapped: false });
  const strip = (fa, fb, ya, yb, mat) => {
    const pos = [], uv = [], idx = [];
    let n = 0;
    for (let i = a; ; i = t.wrap(i + 1)) {
      pos.push(t.x[i] + t.nx[i] * fa(i), t.h[i] + ya, t.y[i] + t.ny[i] * fa(i), t.x[i] + t.nx[i] * fb(i), t.h[i] + yb, t.y[i] + t.ny[i] * fb(i));
      uv.push(0, n * 0.08, 1, n * 0.08);
      if (n) idx.push((n - 1) * 2, (n - 1) * 2 + 1, n * 2, (n - 1) * 2 + 1, n * 2 + 1, n * 2);
      n++;
      if (i === b) break;
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
    const m = new THREE.Mesh(g, mat); m.castShadow = true; m.receiveShadow = true; scene.add(m); return m;
  };
  const roof = strip(i => t.wl[i] + 1.2, i => -t.wr[i] - 1.2, H, H, roofMat);
  const walls = [strip(i => t.wl[i], i => t.wl[i], 0, H, wallMat), strip(i => -t.wr[i], i => -t.wr[i], 0, H, wallMat)];
  strip(i => t.wl[i] - 0.1, i => t.wl[i] - 0.6, H - 1.5, H - 1.5, lamp); strip(i => -t.wr[i] + 0.6, i => -t.wr[i] + 0.1, H - 1.5, H - 1.5, lamp);
  let op = 1;
  return {
    update(dt, focus) {
      const under = focus && inRange(focus.i, 12);
      op += ((under ? 0.12 : 1) - op) * Math.min(1, dt * 6);
      for (const m of [roof, ...walls]) { m.material.opacity = op; m.material.depthWrite = op > 0.95; }
    },
  };
}

export function pool(scene, harbor) {
  const g = new THREE.Group(), x = harbor.x0 + (harbor.x1 - harbor.x0) * 0.35, y = harbor.y0 + 19;
  const deck = new THREE.Mesh(new THREE.BoxGeometry(56, 1, 30), new THREE.MeshStandardMaterial({ color: '#e7dcc6', roughness: 0.8 })); deck.position.y = 0.4; deck.receiveShadow = deck.castShadow = true; g.add(deck);
  const water = new THREE.Mesh(new THREE.PlaneGeometry(34, 14), new THREE.MeshStandardMaterial({ color: '#2ec4e6', emissive: '#0b6f8a', emissiveIntensity: 0.4, roughness: 0.05, metalness: 0.2 }));
  water.rotation.x = -Math.PI / 2; water.position.set(-4, 0.93, 0); g.add(water);
  const lanes = new THREE.MeshBasicMaterial({ color: '#ffffff' });
  for (let k = 1; k < 5; k++) { const l = new THREE.Mesh(new THREE.PlaneGeometry(34, 0.12), lanes); l.rotation.x = -Math.PI / 2; l.position.set(-4, 0.95, -7 + k * 2.8); g.add(l); }
  const lounger = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.5 }), cols = ['#e63946', '#ffb703', '#219ebc', '#2a9d8f'];
  for (let k = 0; k < 8; k++) {
    const lg = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.3, 2), lounger); lg.position.set(-20 + k * 5, 1.05, 11); lg.castShadow = true; g.add(lg);
    if (k % 2 === 0) { const um = new THREE.Mesh(new THREE.ConeGeometry(1.8, 0.7, 10), new THREE.MeshStandardMaterial({ color: cols[k / 2 % 4], roughness: 0.6 })); um.position.set(-17.5 + k * 5, 3, 11); um.castShadow = true; g.add(um); }
  }
  g.position.set(x, 0, y); scene.add(g);
}

// Lago : passerelle publicitaire au-dessus de la piste.
export function bridge(scene, t) {
  let i = -1;
  for (let k = Math.round(t.N * 0.3); k < t.N * 0.7; k++) if ([-25, 0, 25].every(d => Math.abs(t.curv[t.wrap(k + d)]) < 0.002)) { i = k; break; }
  if (i < 0) return;
  const span = t.wl[i] + t.wr[i] + 8, g = new THREE.Group();
  const top = TX.banner('VELOCE  ·  TOP FORMULA  ·  KAIZEN', '#c8102e', '#ffffff');
  const mats = [0, 1, 2, 3, 4, 5].map(k => k === 2 ? new THREE.MeshStandardMaterial({ map: top, roughness: 0.6 }) : new THREE.MeshStandardMaterial({ color: '#c8102e', roughness: 0.6 }));
  const deck = new THREE.Mesh(new THREE.BoxGeometry(4.5, 1.4, span), mats); deck.position.y = 8; deck.castShadow = true; g.add(deck);
  top.rotation = Math.PI / 2; top.center.set(0.5, 0.5);
  for (const s of [-1, 1]) { const p = new THREE.Mesh(new THREE.BoxGeometry(2.2, 8, 2.2), new THREE.MeshStandardMaterial({ color: '#d9d9d9', roughness: 0.7 })); p.position.set(0, 4, s * (span / 2 - 1.2)); p.castShadow = true; g.add(p); }
  g.position.set(t.x[i] + t.nx[i] * (t.wl[i] - t.wr[i]) / 2, t.h[i], t.y[i] + t.ny[i] * (t.wl[i] - t.wr[i]) / 2);
  g.rotation.y = -Math.atan2(t.ty[i], t.tx[i]);
  scene.add(g);
}

// Marina : grande roue illuminée, inclinée vers la caméra pour se voir d'en haut.
export function wheel(scene, t, hf, free, avoid, bbox) {
  let best = null;
  for (let x = bbox.x0 - 60; x < bbox.x1 + 60; x += 15) for (let y = bbox.y0 - 60; y < bbox.y1 + 60; y += 15) {
    if (!free(x, y, 26) || avoid(x, y, 26)) continue;
    const n = hf.nearest(x, y, 120); if (!n) continue;
    const d = n.d + Math.hypot(x - t.x[0], y - t.y[0]) * 0.02; // au plus près de la piste, de préférence vers le départ
    if (!best || d < best.d) best = { x, y, d };
  }
  if (!best) return null;
  const R = 22, g = new THREE.Group(), spin = new THREE.Group();
  const neon = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff3fa4').multiplyScalar(2), toneMapped: false });
  const steel = new THREE.MeshStandardMaterial({ color: '#cfd6e4', roughness: 0.4, metalness: 0.7 });
  spin.add(new THREE.Mesh(new THREE.TorusGeometry(R, 0.45, 8, 64), neon));
  spin.add(new THREE.Mesh(new THREE.TorusGeometry(R * 0.55, 0.25, 6, 48), steel));
  const cabins = [];
  for (let k = 0; k < 18; k++) {
    const a = k / 18 * Math.PI * 2;
    const sp = new THREE.Mesh(new THREE.BoxGeometry(0.2, R, 0.2), steel); sp.position.set(Math.cos(a) * R / 2, Math.sin(a) * R / 2, 0); sp.rotation.z = a - Math.PI / 2; spin.add(sp);
    const c = new THREE.Mesh(new THREE.BoxGeometry(2, 2.2, 2), new THREE.MeshBasicMaterial({ color: new THREE.Color(['#ffd58a', '#7ad7ff', '#b98aff'][k % 3]).multiplyScalar(1.6), toneMapped: false }));
    c.position.set(Math.cos(a) * R, Math.sin(a) * R, 0); spin.add(c); cabins.push(c);
  }
  spin.position.y = R + 4; g.add(spin);
  for (const s of [-1, 1]) { const leg = new THREE.Mesh(new THREE.BoxGeometry(0.8, R + 6, 0.8), steel); leg.position.set(s * 7, (R + 4) / 2, 0); leg.rotation.z = s * 0.28; g.add(leg); }
  g.traverse(o => o.isMesh && (o.castShadow = true));
  g.position.set(best.x, hf.at(best.x, best.y), best.y);
  g.rotation.x = -0.7;
  scene.add(g);
  return { x: best.x, y: best.y, r: 32, update(dt) { spin.rotation.z += dt * 0.08; for (const c of cabins) c.rotation.z = -spin.rotation.z; } };
}

// Flaques d'eau (pluie) : taches sombres et brillantes sur la piste.
export function puddles(scene, t) {
  const mat = new THREE.MeshStandardMaterial({ color: '#1a2028', roughness: 0.03, metalness: 0.85, transparent: true, opacity: 0.6, depthWrite: false });
  for (let k = 0; k < 50; k++) {
    const i = Math.floor(rnd.next() * t.N), lat = (rnd.next() * 2 - 1) * (t.half - 1.5);
    const m = new THREE.Mesh(new THREE.CircleGeometry(1, 20), mat);
    m.rotation.set(-Math.PI / 2, 0, -Math.atan2(t.ty[i], t.tx[i]));
    m.scale.set(3 + rnd.next() * 6, 1.2 + rnd.next() * 2, 1);
    m.position.set(t.x[i] + t.nx[i] * lat, t.h[i] + 0.06, t.y[i] + t.ny[i] * lat);
    m.renderOrder = 1;
    scene.add(m);
  }
}
