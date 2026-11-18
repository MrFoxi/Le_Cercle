// THE HOLLOW — ce que toutes les strates partagent pour poser leur monde : le sol par morceaux (fin près du voyageur,
// grossier au loin) et les instances rangées par secteurs (la carte graphique ne dessine que ce qui est dans le champ).
import * as THREE from 'three';
import { ink, glowy } from './ink.js';
import { cast, paint, lump, merge, TAU } from './modelage.js';

/* ---------- Le sol d'une strate : 5 km de côté, par morceaux ---------- */
// Morceaux de 160 m, plus ou moins fins selon leur distance au voyageur (2 m près de lui, 27 m au loin), refaits quand
// il se déplace. Normales calculées sur le relief lui-même (les morceaux se raccordent sans couture d'ombrage) et une
// jupe qui descend sous chaque bord cache les petits écarts entre deux finesses.
const CHUNK = 160, SPAN = 2600;
function chunkGeometry(cx, cz, seg, heightAt) {
  const n = seg + 1, cell = CHUNK / seg, e = Math.max(1, cell * 0.5), P = [], Nm = [], I = [];
  const put = (x, z, dy = 0) => {
    const h = heightAt(x, z), hx = heightAt(x + e, z) - heightAt(x - e, z), hz = heightAt(x, z + e) - heightAt(x, z - e);
    const v = new THREE.Vector3(-hx, 2 * e, -hz).normalize();
    P.push(x, Math.max(h, -420) + dy, z); Nm.push(v.x, v.y, v.z);
    return h;
  };
  const hs = [];
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) hs.push(put(cx - CHUNK / 2 + i * cell, cz - CHUNK / 2 + j * cell));
  const ok = k => hs[k] > -100;
  for (let j = 0; j < seg; j++) for (let i = 0; i < seg; i++) {
    const a = j * n + i, b = a + 1, c = a + n, d = c + 1;
    if (ok(a) && ok(b) && ok(c) && ok(d)) I.push(a, c, b, b, c, d);
  }
  // la jupe : chaque bord est doublé 30 m plus bas
  const edge = [[...Array(n).keys()].map(i => i), [...Array(n).keys()].map(i => (n - 1) * n + i), [...Array(n).keys()].map(j => j * n), [...Array(n).keys()].map(j => j * n + n - 1)];
  for (const [ei, list] of edge.entries()) {
    const base = P.length / 3;
    for (const k of list) { P.push(P[k * 3], P[k * 3 + 1] - 30, P[k * 3 + 2]); Nm.push(Nm[k * 3], Nm[k * 3 + 1], Nm[k * 3 + 2]); }
    for (let t = 0; t + 1 < list.length; t++) {
      if (!ok(list[t]) || !ok(list[t + 1])) continue;
      const a = list[t], b = list[t + 1], c = base + t, d = base + t + 1;
      if (ei % 2) I.push(a, b, c, b, d, c); else I.push(a, c, b, b, c, d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(Nm, 3)); g.setIndex(I);
  g.computeBoundingSphere();
  return g;
}
// heightAt : le relief (moins de -100 = le vide) ; skip(cx, cz) : un morceau à ne pas construire du tout
export function createGround(scene, heightAt, skip = () => false) {
  const mat = ink({ kind: 'terrain', vertexColors: false, side: THREE.DoubleSide }), chunks = [];
  for (let z = -SPAN; z < SPAN; z += CHUNK) for (let x = -SPAN; x < SPAN; x += CHUNK) {
    const cx = x + CHUNK / 2, cz = z + CHUNK / 2;
    if (skip(cx, cz, CHUNK)) continue;
    const m = cast(new THREE.Mesh(new THREE.BufferGeometry(), mat)); scene.add(m);
    chunks.push({ cx, cz, seg: 0, m });
  }
  const want = d => (d < 260 ? 80 : d < 650 ? 40 : d < 1400 ? 16 : 6);
  // update : refait au plus « budget » morceaux par appel (pas d'à-coup quand on marche)
  return function update(p, budget = 3) {
    const todo = chunks.map(c => [Math.hypot(c.cx - p.x, c.cz - p.z), c]).filter(([d, c]) => want(d) !== c.seg).sort((a, b) => a[0] - b[0]);
    for (const [d, c] of todo.slice(0, budget)) { c.m.geometry.dispose(); c.seg = want(d); c.m.geometry = chunkGeometry(c.cx, c.cz, c.seg, heightAt); }
    return todo.length;
  };
}
// la balise d'un PNJ qui a quelque chose à te demander : une goutte d'encre dorée qui flotte au-dessus de lui, et un
// anneau de lumière à ses pieds (on la voit de loin). set(position | null)
export function beacon(scene) {
  const drop = new THREE.Mesh(paint(new THREE.SphereGeometry(0.35, 14, 10).scale(1, 1.3, 1), '#ffe08a', '#e8a020'), ink({ glow: 2.2, pulse: 1, line: 0.4 }));
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.25, 0.5, 12).translate(0, 0.6, 0), drop.material); drop.add(tip);
  const ring = new THREE.Mesh(new THREE.RingGeometry(1.4, 1.8, 40).rotateX(-Math.PI / 2), glowy({ color: '#ffd860', alpha: 0.55, add: true, soft: 0.2 }));
  const halo = new THREE.Mesh(new THREE.PlaneGeometry(7, 7), glowy({ color: '#ffd860', alpha: 0.35, add: true, soft: 1 }));
  scene.add(drop, ring, halo);
  let at = null;
  return {
    set(p, h = 2.6) { at = p ? p.clone() : null; drop.visible = ring.visible = halo.visible = !!p; if (p) { ring.position.set(p.x, p.y + 0.08, p.z); this.h = h; } },
    update(t, eye) { if (!at) return; drop.position.set(at.x, at.y + this.h + Math.sin(t * 2) * 0.2, at.z); drop.rotation.y = t; halo.position.copy(drop.position); halo.lookAt(eye); ring.scale.setScalar(1 + Math.sin(t * 2.4) * 0.08); },
  };
}
// un beau vide : sous le bord d'un trou, une paroi qui s'enfonce et noircit, des voiles de brume qui tournent l'un
// sous l'autre, et le fond qui se perd dans la couleur de la strate (on ne voit plus jamais à travers le monde)
// o : { x, z, R, y (le bord), depth, wall (couleurs de la paroi), mist, clouds (des nuages dedans) }
export function abyss(scene, o) {
  const { x, z, R, y, depth = 400, wall = ['#4a4a5a', '#0a0a12'], mist = '#ffffff', clouds = 0 } = o, grp = new THREE.Group();
  const g = new THREE.CylinderGeometry(R, R * 0.85, depth, 48, 12, true).translate(0, -depth / 2, 0), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const a = Math.atan2(p.getZ(i), p.getX(i)), yy = p.getY(i), k = 1 + (Math.sin(a * 7 + yy * 0.05) * 0.03 + Math.sin(a * 3 - yy * 0.02) * 0.04); p.setX(i, p.getX(i) * k); p.setZ(i, p.getZ(i) * k); }
  g.computeVertexNormals();
  grp.add(new THREE.Mesh(paint(g, ...wall, 0.08), ink({ line: 0.7, side: THREE.DoubleSide })));
  const floor = new THREE.Mesh(new THREE.CircleGeometry(R, 48).rotateX(-Math.PI / 2).translate(0, -depth + 2, 0), ink({ color: wall[1], vertexColors: false, line: 0, side: THREE.DoubleSide })); grp.add(floor);
  const veils = [];
  for (let k = 0; k < 6; k++) { const m = new THREE.Mesh(new THREE.PlaneGeometry(R * 2.4, R * 2.4).rotateX(-Math.PI / 2), glowy({ color: mist, alpha: 0.18 + k * 0.08, soft: 1 })); m.position.y = -(k + 1) * depth / 8; grp.add(m); veils.push(m); }
  // des nuages, dedans : on les traverse en tombant
  if (clouds) { const K = []; for (let k = 0; k < clouds; k++) { const a = k * 2.39996, d = Math.sqrt((k + 0.5) / clouds) * R * 0.85; for (let i = 0; i < 4; i++) K.push(paint(lump(R * 0.05 + (i % 2) * R * 0.03, { sy: 0.55, lumpy: 0.25, seed: k * 4 + i, detail: 2 }).translate(Math.cos(a) * d + (i - 1.5) * R * 0.05, -60 - (k % 3) * 18 + (i % 2) * 4, Math.sin(a) * d + (i % 3) * R * 0.02), '#ffffff', '#c8d4e8')); } grp.add(new THREE.Mesh(merge(K), ink({ line: 0.6, trans: 0.4 }))); }
  grp.position.set(x, y, z); scene.add(grp);
  return { update(t) { veils.forEach((m, k) => { m.rotation.y = t * 0.02 * (k % 2 ? 1 : -1); }); } };
}
// les instances d'un même modèle, rangées par secteurs de 400 m : la carte graphique ne dessine que les secteurs dans le champ
export function sectors(scene, geo, mat, items, place, shadow = true) {
  const by = new Map();
  for (const it of items) { const k = `${Math.floor(it[0] / 400)},${Math.floor(it[2] / 400)}`; if (!by.has(k)) by.set(k, []); by.get(k).push(it); }
  const out = [], m4 = new THREE.Matrix4();
  for (const list of by.values()) {
    const im = new THREE.InstancedMesh(geo, mat, list.length);
    list.forEach((it, i) => im.setMatrixAt(i, place(it, m4)));
    im.computeBoundingSphere(); scene.add(shadow ? cast(im) : im); out.push(im);
  }
  return out;
}

