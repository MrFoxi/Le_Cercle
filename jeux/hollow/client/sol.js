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
// un beau vide. Le bord réel du trou est mesuré dans 96 directions (floorAt < -100 : le vide) : la paroi part de ce bord,
// exactement à la hauteur du sol, et s'enfonce en noircissant (elle cache les bords en escalier du sol vu d'en dessous).
// Juste sous le bord, une mer de brume épaisse, en plusieurs voiles (et des nuages, pour les Jardins) : on y plonge, et
// la chute vers la strate suivante commence dedans. top() : la hauteur du bord le plus bas (pour la brume et la sortie).
// o : { x, z, R (on cherche le bord en partant d'un peu au-delà), floorAt, depth, wall (deux couleurs), mist, clouds }
export function abyss(scene, o) {
  const { x, z, R, floorAt, depth = 300, wall = ['#4a4a5a', '#0a0a12'], mist = '#ffffff', clouds = 0 } = o, N = 96, M = 14;
  const E = [], Y = [];
  for (let i = 0; i < N; i++) {
    const a = (i / N) * TAU, c = Math.cos(a), s = Math.sin(a); let r = R * 1.15 + 6;
    while (r > 1 && floorAt(x + c * r, z + s * r) > -100) r -= 0.25;
    E.push(r); Y.push(floorAt(x + c * (r + 1), z + s * (r + 1))); // la paroi part du vide même : la lèvre couvre la fin du sol, qui s'arrête en escalier
  }
  const low = Math.min(...Y), P = [], I = [];
  // une lèvre peinte comme le sol (même matière : elle ne se voit pas) : elle comble l'écart entre la fin du sol, qui
  // s'arrête en escalier, et la paroi
  const LP = [], LI = [];
  for (let i = 0; i <= N; i++) { const k = i % N, a = (k / N) * TAU; for (const [rr, dy] of [[E[k], 0.06], [E[k] + 9, 0.15]]) LP.push(x + Math.cos(a) * rr, (dy < 0.1 ? Y[k] : floorAt(x + Math.cos(a) * rr, z + Math.sin(a) * rr)) + dy, z + Math.sin(a) * rr); }
  for (let i = 0; i < N; i++) { const p = i * 2; LI.push(p, p + 1, p + 2, p + 1, p + 3, p + 2); }
  const lip = new THREE.BufferGeometry(); lip.setAttribute('position', new THREE.Float32BufferAttribute(LP, 3)); lip.setIndex(LI); lip.computeVertexNormals();
  scene.add(cast(new THREE.Mesh(lip, ink({ kind: 'terrain', vertexColors: false, side: THREE.DoubleSide }))));
  for (let j = 0; j <= M; j++) for (let i = 0; i <= N; i++) {
    const k = i % N, a = (k / N) * TAU, t = j / M, rr = E[k] * (1 - t * 0.12) * (1 + Math.sin(a * 7 + j) * 0.015 * t);
    P.push(x + Math.cos(a) * rr, (j === 0 ? Y[k] + 0.06 : low - depth * t ** 1.4), z + Math.sin(a) * rr);
  }
  for (let j = 0; j < M; j++) for (let i = 0; i < N; i++) { const p = j * (N + 1) + i, q = p + N + 1; I.push(p, q, p + 1, p + 1, q, q + 1); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setIndex(I); g.computeVertexNormals();
  scene.add(new THREE.Mesh(paint(g, ...wall, 0.08), ink({ line: 0.6, side: THREE.DoubleSide })));
  const Rm = Math.max(...E);
  // la mer de brume : des voiles serrés juste sous le bord, de plus en plus épais, qui tournent l'un contre l'autre
  const veils = [];
  for (let k = 0; k < 5; k++) { const m = new THREE.Mesh(new THREE.CircleGeometry(Rm + 2, 64).rotateX(-Math.PI / 2), glowy({ color: mist, alpha: 0.22 + k * 0.1, soft: -1 })); m.position.set(x, low - 5 - k * 5, z); scene.add(m); veils.push(m); }
  // des nuages, dans la mer de brume (les Jardins) : on les voit d'en haut, et on les traverse en tombant
  if (clouds) { const K = []; for (let k = 0; k < clouds; k++) { const a = k * 2.39996, d = Math.sqrt((k + 0.5) / clouds) * Rm * 0.85; for (let i = 0; i < 4; i++) K.push(paint(lump(Rm * 0.04 + (i % 2) * Rm * 0.025, { sy: 0.5, lumpy: 0.25, seed: k * 4 + i, detail: 2 }).translate(x + Math.cos(a) * d + (i - 1.5) * Rm * 0.04, low - 8 - (k % 3) * 4 + (i % 2) * 2, z + Math.sin(a) * d + (i % 3) * Rm * 0.02), '#ffffff', '#d8e0ec')); } scene.add(new THREE.Mesh(merge(K), ink({ line: 0.5, trans: 0.4, glow: 0.15 }))); }
  return { top: low, update(t) { veils.forEach((m, k) => { m.rotation.y = t * 0.015 * (k % 2 ? 1 : -1); }); } };
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

