// THE HOLLOW — ce que toutes les strates partagent pour poser leur monde : le sol par morceaux (fin près du voyageur,
// grossier au loin) et les instances rangées par secteurs (la carte graphique ne dessine que ce qui est dans le champ).
import * as THREE from 'three';
import { ink } from './ink.js';
import { cast } from './modelage.js';

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

