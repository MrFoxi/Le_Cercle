// Mini-golf, mode Aventure : le mobilier des étages, de l'Horloge au Sommet, modelé à la main comme le reste (decor.js).
// Règle : rien sur le chemin de la balle. On habille les murs (entre les fenêtres, au-dessus), les coins, le plafond, et
// le ciel autour de la tour (une île à thème par étage). Un objet accroché à un mur s'efface avec lui côté caméra.
import * as THREE from 'three';
import { rng, MAT, glow, paint, pc, blob, stem, turned, soft, gearGeo, fuse, mesh, group, island, potted, PETALS } from './decor.js';

const TAU = Math.PI * 2;
const dark = (c, k = 0.18) => new THREE.Color(c).offsetHSL(0, 0, -k).getStyle();
const light = (c, k = 0.12) => new THREE.Color(c).offsetHSL(0, 0, k).getStyle();

/* ---------- Poser contre un mur : l'avant de l'objet (+z) regarde la salle ---------- */
const WALL = { n: (t, y) => [[t, y, -14.96], 0], s: (t, y) => [[t, y, 14.96], Math.PI], e: (t, y) => [[14.96, y, t], -Math.PI / 2], w: (t, y) => [[-14.96, y, t], Math.PI / 2] };
function onWall(ctx, face, t, y, obj) { const [p, ry] = WALL[face](t, y); ctx.put(obj, p, 1, ry); ctx.live.deco.at(-1).face = face; return obj; }

/* ---------- Pièces de mobilier ---------- */
// Un tableau : un paysage inventé (ciel, soleil, collines, une petite tour), dans un cadre doré
function paintingTex(seed) {
  const c = document.createElement('canvas'); c.width = 160; c.height = 120;
  const x = c.getContext('2d'), r = rng(seed), H = r() * 360;
  const g = x.createLinearGradient(0, 0, 0, 120); g.addColorStop(0, `hsl(${H},70%,78%)`); g.addColorStop(1, `hsl(${(H + 40) % 360},80%,90%)`);
  x.fillStyle = g; x.fillRect(0, 0, 160, 120);
  x.fillStyle = `hsl(${(H + 180) % 360},90%,85%)`; x.beginPath(); x.arc(30 + r() * 100, 25 + r() * 20, 10 + r() * 8, 0, TAU); x.fill();
  for (let k = 0; k < 3; k++) {
    x.fillStyle = `hsl(${(H + 90 + k * 25) % 360},${45 + k * 10}%,${62 - k * 12}%)`; x.beginPath(); x.moveTo(0, 120);
    for (let i = 0; i <= 16; i++) x.lineTo(i * 10, 70 + k * 14 - Math.sin(i * 0.6 + r() * 6) * (8 + r() * 10));
    x.lineTo(160, 120); x.fill();
  }
  if (r() < 0.6) { const tx = 40 + r() * 80; x.fillStyle = '#fff4e0'; x.fillRect(tx, 50, 10, 30); x.fillStyle = '#c0503e'; x.beginPath(); x.moveTo(tx - 3, 50); x.lineTo(tx + 5, 38); x.lineTo(tx + 13, 50); x.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function painting(seed, w, h, frame = ['#ffe08a', '#b8862e']) {
  const f = new THREE.Shape(); f.moveTo(-w / 2, -h / 2); f.lineTo(w / 2, -h / 2); f.lineTo(w / 2, h / 2); f.lineTo(-w / 2, h / 2); f.closePath();
  const hole = new THREE.Path(); hole.moveTo(-w / 2 + 0.18, -h / 2 + 0.18); hole.lineTo(-w / 2 + 0.18, h / 2 - 0.18); hole.lineTo(w / 2 - 0.18, h / 2 - 0.18); hole.lineTo(w / 2 - 0.18, -h / 2 + 0.18); hole.closePath(); f.holes.push(hole);
  const fr = mesh(paint(new THREE.ExtrudeGeometry(f, { depth: 0.1, bevelEnabled: true, bevelSize: 0.05, bevelThickness: 0.05, bevelSegments: 2 }), frame), MAT.shiny, false);
  const canvas = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.3, h - 0.3), new THREE.MeshStandardMaterial({ map: paintingTex(seed), roughness: 0.9 })); canvas.position.z = 0.04;
  return group(fr, canvas);
}
// Une applique : une coupelle et une flamme qui luit
function sconce(c = '#e8c068', flame = '#ffcf6a') {
  const K = [pc(turned([[0.12, 0], [0.16, 0.05], [0.1, 0.12], [0, 0.12]], 12), [c, dark(c)], 0, 0, 0.02, Math.PI / 2, 0, 0), pc(stem([[0, 0, 0.1], [0, -0.1, 0.35], [0, 0.05, 0.5]], 0.04, 0.035, 5, 6), [c, dark(c)]), pc(turned([[0, 0], [0.2, 0.02], [0.17, 0.12], [0, 0.1]], 14), [c, dark(c)], 0, 0.05, 0.5)];
  K.push(pc(turned([[0.07, 0], [0.07, 0.3], [0, 0.3]], 10), ['#fff8e8', '#e8dcc0'], 0, 0.12, 0.5));
  const f = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6).scale(1, 1.8, 1), glow(flame, 2.2)); f.position.set(0, 0.5, 0.5);
  return group(mesh(fuse(K), MAT.shiny, false), f);
}
// Une horloge murale : cadran, chiffres en traits, aiguilles qui tournent (vite : le temps file dans la Tour)
function wallClock(ctx, r, cols, speed = 1) {
  const K = [pc(turned([[0, 0], [r, 0], [r * 1.1, 0.08], [r * 1.06, 0.22], [r * 0.93, 0.24], [0, 0.2]], 36), cols, 0, 0, 0, Math.PI / 2, 0, 0)];
  K.push(pc(new THREE.CircleGeometry(r * 0.9, 32).translate(0, 0, 0.245), ['#fffaf0', '#f0e6d4']));
  for (let k = 0; k < 12; k++) { const a = (k / 12) * TAU; K.push(pc(soft(0.05 * r * 2, (k % 3 ? 0.1 : 0.18) * r * 2, 0.03, 0.01), ['#4a3a20'], Math.sin(a) * r * 0.78, Math.cos(a) * r * 0.78, 0.26, 0, 0, -a)); }
  const hand = (len, w, c) => { const m = mesh(fuse([pc(soft(w, len, 0.03, 0.01).translate(0, len / 2 - 0.05, 0), [c])]), MAT.clay, false); m.position.z = 0.28; return m; };
  const hh = hand(r * 0.5, 0.08 * r, '#3a2a10'), mm = hand(r * 0.78, 0.05 * r, '#3a2a10'); mm.position.z = 0.3;
  const pin = mesh(fuse([pc(blob(0.06 * r + 0.03, { detail: 1 }), ['#e8c068'], 0, 0, 0.32)]), MAT.shiny, false);
  const ph = r * 7;
  ctx.live.anim.push(t => { mm.rotation.z = -(t * 0.6 * speed + ph); hh.rotation.z = -(t * 0.05 * speed + ph * 0.3); });
  return group(mesh(fuse(K), MAT.shiny, false), hh, mm, pin);
}
// Un tuyau de cuivre le long d'un mur (axe x local), avec ses colliers et ses vannes
function pipeRun(len, y = 0, c = ['#f0b070', '#a86a30']) {
  const K = [pc(stem([[-len / 2, y, 0.25], [len / 2, y, 0.25]], 0.13, 0.13, 10, 2), c)];
  for (let x = -len / 2 + 1; x < len / 2; x += 2.5) K.push(pc(new THREE.TorusGeometry(0.17, 0.05, 6, 14).rotateY(Math.PI / 2), ['#c8a070', '#8a6040'], x, y, 0.25));
  for (const x of [-len / 4, len / 4]) K.push(pc(new THREE.TorusGeometry(0.3, 0.05, 6, 18), ['#ff6a5a', '#b83a3a'], x, y + 0.45, 0.25, 0, 0, 0), pc(stem([[x, y, 0.25], [x, y + 0.45, 0.25]], 0.04, 0.04, 5, 2), ['#c8a070']));
  return mesh(fuse(K), MAT.shiny, false);
}
// Rideau de velours drapé, retenu par une embrasse
function curtain(w, h, c) {
  const g = new THREE.PlaneGeometry(w, h, 10, 12), q = g.attributes.position;
  for (let i = 0; i < q.count; i++) { const x = q.getX(i), y = q.getY(i), k = (y + h / 2) / h, pinch = 1 - Math.exp(-((y + h * 0.15) ** 2) * 1.2) * 0.45; q.setX(i, x * pinch); q.setZ(i, 0.12 + Math.sin(x * 9) * 0.07 * (0.4 + k)); }
  g.computeVertexNormals();
  return mesh(fuse([pc(g, [light(c, 0.05), dark(c, 0.2)]), pc(new THREE.TorusGeometry(0.12, 0.05, 6, 12), ['#ffe08a', '#c8902e'], 0, -h * 0.15, 0.25), pc(stem([[-w / 2 - 0.2, h / 2 + 0.05, 0.12], [w / 2 + 0.2, h / 2 + 0.05, 0.12]], 0.06, 0.06, 6, 2), ['#ffe08a', '#c8902e'])]), MAT.cloth, false);
}
// Bougie (seule, ou flottante)
function candle(h = 0.5) {
  const m = group(mesh(fuse([pc(turned([[0.08, 0], [0.08, h], [0.06, h + 0.03], [0, h + 0.03]], 10), ['#fff8e8', '#e8dcc0']), pc(blob(0.05, { detail: 1, sy: 1.4 }), ['#fff8e8'], 0.06, h - 0.05, 0)]), MAT.clay, false));
  const f = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6).scale(1, 2, 1), glow('#ffcf6a', 2.4)); f.position.y = h + 0.12; m.add(f);
  return m;
}
// Une échelle de bois appuyée
function ladder(h) {
  const K = [];
  for (const x of [-0.3, 0.3]) K.push(pc(soft(0.09, h, 0.09, 0.02), ['#c99260', '#8a5a35'], x, h / 2, 0));
  for (let y = 0.35; y < h - 0.2; y += 0.42) K.push(pc(stem([[-0.3, y, 0], [0.3, y, 0]], 0.035, 0.035, 5, 2), ['#b07a42']));
  return mesh(fuse(K), MAT.clay, false);
}
// Une chouette (sur les étagères de la Bibliothèque)
function owl(seed) {
  const K = [pc(blob(0.32, { sy: 1.25, lump: 0.08, detail: 2, seed }), ['#c8a070', '#8a6040'], 0, 0.4, 0), pc(blob(0.22, { sy: 0.8, sz: 0.7, detail: 2 }), ['#f4e6c8', '#d8c098'], 0, 0.36, 0.17)];
  for (const s of [-1, 1]) {
    K.push(pc(blob(0.11, { detail: 2 }), ['#ffffff'], s * 0.12, 0.62, 0.22), pc(blob(0.06, { detail: 1 }), ['#2a2030'], s * 0.12, 0.62, 0.31));
    K.push(pc(blob(0.07, { sx: 0.6, sy: 1.6, detail: 1 }), ['#8a6040'], s * 0.2, 0.86, 0.02, 0, 0, s * 0.4));
  }
  K.push(pc(blob(0.04, { sy: 1.3, detail: 1 }), ['#ffb84a'], 0, 0.53, 0.32));
  return mesh(fuse(K));
}
// Engrenage de bois (le moulin) ou de laiton
const gear = (R, n, cols, depth = 0.25) => mesh(fuse([pc(gearGeo(R, n, depth), cols), pc(turned([[0.25 * R, -0.25], [0.25 * R, 0.25], [0, 0.3]], 14), [dark(cols[0], 0.3)], 0, 0, 0, Math.PI / 2, 0, 0)]), MAT.shiny, false);

/* ---------- Les îles à thème, autour de la tour ---------- */
// une île volante (à l'échelle s) et ce qu'on pose dessus, en mètres d'île ; extra(g) y ajoute ce qui bouge
function floatIsle(ctx, y, a, d, s, props, extra) {
  const g = group(island(Math.round(y * 7 + a * 13), 1), ...props); g.scale.setScalar(s);
  const o = group(g); o.position.set(Math.cos(a) * d, y, Math.sin(a) * d); o.rotation.y = -a + Math.PI;
  o.userData = { y, ph: a * 3 }; ctx.tower.add(o); ctx.live.floaters.push(o); if (extra) extra(g);
  return o;
}

/* ---------- Le mobilier, monde par monde ---------- */
export function furnish(ctx) {
  const { put, live, LIGHT } = ctx;
  const W = (w, fn) => { ctx.world(w); fn(); };

  /* L'Horloge (12 m) : des horloges partout, des tuyaux de cuivre, des engrenages qui pendent au-dessus du puits */
  W(1, () => {
    const brass = ['#f0c860', '#b8862e'];
    for (const [f, t, y, r, sp] of [['n', -5.4, 17.4, 1.0, 1], ['n', -10.7, 18.6, 0.75, 2.2], ['e', -3, 17.6, 1.4, 0.6], ['e', 9, 18.6, 0.8, 3], ['w', -9, 17.4, 1.0, 1.4], ['s', -10.7, 17.6, 0.9, 1.8], ['s', 13, 18.4, 0.7, 2.6]]) onWall(ctx, f, t, y, wallClock(ctx, r, f === 'e' ? ['#ffe08a', '#c8902e'] : brass, sp));
    onWall(ctx, 'e', 0, 21.6, pipeRun(29.5)); onWall(ctx, 'w', 0, 21.6, pipeRun(29.5, 0, ['#d8b070', '#8a6030']));
    // le coucou : il sort toutes les dix secondes
    const roof = ['#7a4a24', '#4a2a16'], K = [pc(soft(1.3, 1.5, 0.6, 0.08), ['#c99260', '#8a5a35'], 0, 0, 0.3)];
    for (const s of [-1, 1]) K.push(pc(soft(1.0, 0.1, 0.8, 0.03), roof, s * 0.38, 0.95, 0.3, 0, 0, s * -0.7));
    K.push(pc(new THREE.CircleGeometry(0.38, 24).translate(0, 0.05, 0.61), ['#fffaf0']), pc(soft(0.3, 0.3, 0.05, 0.02), ['#3a2010'], 0, 0.55, 0.6));
    for (const x of [-0.25, 0.25]) K.push(pc(stem([[x, -0.75, 0.3], [x, -2.2, 0.3]], 0.015, 0.015, 3, 2), ['#c8a070']), pc(blob(0.12, { sy: 2, lump: 0.25, detail: 1 }), ['#8a5a35', '#5a3a1a'], x, -2.4, 0.3));
    const bird = mesh(fuse([pc(blob(0.14, { sx: 1.3, detail: 2 }), ['#ffd84a', '#e0a020']), pc(blob(0.04, { detail: 1 }), ['#ff7a3a'], 0, 0, 0.17)]));
    const ck = onWall(ctx, 's', -5.4, 18.2, group(mesh(fuse(K)), bird));
    live.anim.push(t => { const k = Math.max(0, Math.sin(((t % 10) / 10) * TAU * 5)) * (t % 10 < 1 ? 1 : 0); bird.position.set(0, 0.55, 0.45 + k * 0.5); });
    ck.children[0].castShadow = false;
    // l'horloge de parquet, dans le coin
    const G = [pc(soft(1.1, 3.6, 0.7, 0.1), ['#a8703e', '#6a4426'], 0, 1.8, 0), pc(turned([[0, 0], [0.5, 0], [0.52, 0.1], [0, 0.1]], 24), ['#ffe08a', '#c8902e'], 0, 3.0, 0.36, Math.PI / 2, 0, 0)];
    G.push(pc(new THREE.CircleGeometry(0.42, 24).translate(0, 3.0, 0.47), ['#fffaf0']), pc(soft(1.3, 0.25, 0.85, 0.06), ['#8a5a35'], 0, 3.72, 0), pc(soft(0.6, 1.3, 0.05, 0.03), ['#3a2a40'], 0, 1.55, 0.36));
    const pend = mesh(fuse([pc(stem([[0, 0, 0], [0, -0.9, 0]], 0.02, 0.02, 4, 2), ['#e8c068']), pc(blob(0.14, { sz: 0.3, detail: 2 }), ['#ffe08a', '#c8902e'], 0, -1.0, 0)]), MAT.shiny); pend.position.set(0, 2.3, 0.4);
    put(group(mesh(fuse(G)), pend), [14.2, 12, 14.2], 1, -Math.PI * 0.75);
    live.anim.push(t => (pend.rotation.z = Math.sin(t * 2.4) * 0.3));
    // des engrenages suspendus au-dessus du puits de l'horloge, qui tournent ensemble
    for (const [x, y, z, R, n, sp] of [[-4, 19.8, 3.5, 1.6, 12, 0.3], [-1.2, 20.6, 4.6, 1.0, 8, -0.48], [4, 19.4, -4, 1.9, 14, -0.22], [6.6, 20.4, -2.6, 0.9, 7, 0.44]]) {
      const g = gear(R, n, n % 2 ? ['#d0a0e0', '#8a6aa8'] : ['#f0c860', '#a87a28'], 0.22);
      const hang = mesh(fuse([pc(stem([[0, 0, 0], [0, 22.8 - y, 0]], 0.03, 0.03, 4, 2), ['#8a7050'])]), MAT.clay, false);
      put(group(g, hang), [x, y, z], 1, x > 0 ? 0.6 : -0.4); live.spins.push({ obj: g, axis: 'z', speed: sp });
    }
    floatIsle(ctx, 13, 0.9, 31, 1.5, [(() => {
      const T = [pc(soft(1.6, 4.5, 1.6, 0.15), ['#f4ead6', '#c8b898'], 0, 2.25, 0), pc(new THREE.ConeGeometry(1.4, 1.8, 4).rotateY(Math.PI / 4), ['#c0503e', '#8a2a2a'], 0, 5.4, 0), pc(new THREE.CircleGeometry(0.55, 24).translate(0, 3.6, 0.82), ['#fffaf0'])];
      return mesh(fuse(T));
    })()]);
  });

  /* Les Balances (24 m) : tableaux, appliques, bustes sur consoles, amphore et poids */
  W(2, () => {
    for (const [f, t, s] of [['n', -5.4, 1], ['w', -3, 2], ['e', 3, 3], ['s', 5.4, 4]]) onWall(ctx, f, t, 30.6, painting(70 + s, 2.6, 1.9));
    for (const [f, t] of [['n', -10.7], ['n', 0], ['n', 10.7], ['w', -9], ['w', 9], ['e', -9], ['e', 9], ['s', -5.4], ['s', 0]]) onWall(ctx, f, t, 28.4, sconce('#e8d8f0', '#ffd27a'));
    const bust = seed => mesh(fuse([pc(soft(0.9, 0.12, 0.5, 0.04), ['#f6f2fa', '#c8bed8'], 0, 0, 0.25), pc(stem([[0, 0, 0.12], [0, -0.35, 0.05]], 0.12, 0.05, 5, 3), ['#e8e0f0']), pc(turned([[0.22, 0], [0.18, 0.12], [0.12, 0.2], [0, 0.22]], 14), ['#f6f2fa', '#d4ccdf'], 0, 0.06, 0.25),
      pc(blob(0.28, { sx: 1.25, sy: 0.6, sz: 0.8, detail: 2, seed }), ['#f6f2fa', '#d4ccdf'], 0, 0.42, 0.25), pc(blob(0.2, { sy: 1.15, detail: 2, seed: seed + 1 }), ['#ffffff', '#e0d8ea'], 0, 0.78, 0.28), pc(blob(0.21, { sy: 0.6, lump: 0.35, freq: 4, detail: 2, seed }), ['#ece6f2'], 0, 0.92, 0.25)]));
    onWall(ctx, 's', -10.7, 27, bust(3)); onWall(ctx, 'e', -3, 27, bust(5)); onWall(ctx, 'w', 3, 27, bust(7));
    put(mesh(fuse([pc(turned([[0, 0], [0.35, 0], [0.3, 0.1], [0.55, 0.6], [0.6, 1.0], [0.3, 1.5], [0.25, 1.75], [0.35, 1.85], [0, 1.85]], 24), ['#ffb07a', '#c86a3a']), ...[-1, 1].map(s => pc(new THREE.TorusGeometry(0.28, 0.05, 6, 14, Math.PI).rotateZ(-Math.PI / 2), ['#c86a3a'], s * 0.48, 1.35, 0, 0, s > 0 ? 0 : Math.PI, 0)), pc(new THREE.TorusGeometry(0.62, 0.03, 4, 28).rotateX(Math.PI / 2), ['#3a2a40'], 0, 0.95, 0)])), [-14.1, 24, 14.1]);
    const wts = []; let wy = 0; for (const [r, h] of [[0.55, 0.35], [0.45, 0.3], [0.36, 0.26], [0.28, 0.22]]) { wts.push(pc(turned([[0, 0], [r, 0], [r, h], [r * 0.4, h + 0.06], [0.08, h + 0.06], [0.08, h + 0.2], [0, h + 0.22]], 18), ['#8a8aa0', '#4a4a58'], 0, wy, 0)); wy += h + 0.06; }
    put(mesh(fuse(wts), MAT.shiny), [14.1, 24, -14.2]);
    floatIsle(ctx, 25, 2.6, 30, 1.6, [(() => {
      const K = [pc(new THREE.ConeGeometry(0.7, 1.2, 4), ['#f6f2fa', '#c8bed8'], 0, 0.6, 0), pc(soft(5, 0.18, 0.7, 0.06), ['#e8c068', '#a07828'], 0, 1.25, 0, 0, 0, 0.18)];
      K.push(pc(blob(0.55, { detail: 2, seed: 4 }), ['#ffffff', '#c8bed8'], -2.2, 1.0, 0), pc(blob(0.35, { detail: 2, seed: 8 }), ['#ff9a8a', '#c86a5a'], 2.2, 1.95, 0));
      return mesh(fuse(K));
    })()]);
  });

  /* La Bibliothèque (36 m) : bougies qui flottent, échelles, bureau de lecture, chouettes, toiles d'araignée */
  W(3, () => {
    const r = rng(36), cands = [];
    for (let k = 0; k < (LIGHT ? 8 : 18); k++) { const c = candle(0.35 + r() * 0.3), p = [-13 + r() * 26, 42.6 + r() * 2.2, -9 + r() * 22]; put(c, p); cands.push([c, p, r() * TAU]); live.glows.push(c.children[1]); }
    live.anim.push(t => cands.forEach(([c, p, ph]) => { c.position.y = p[1] + Math.sin(t * 0.9 + ph) * 0.18; c.rotation.z = Math.sin(t * 0.7 + ph) * 0.05; }));
    // les échelles : le pied à 0,65 m du mur, le haut contre les rayonnages
    const l1 = onWall(ctx, 'e', -6, 36, ladder(7.5)); l1.rotation.order = 'YXZ'; l1.rotation.x = -0.087; l1.position.x -= 0.65;
    const l2 = onWall(ctx, 'w', 9, 36, ladder(6.8)); l2.rotation.order = 'YXZ'; l2.rotation.x = -0.1; l2.position.x += 0.68;
    // le bureau de lecture, un livre ouvert, une bougie, une plume
    const D = [pc(soft(2, 0.12, 0.9, 0.04), ['#b07a42', '#7a4a24'], 0, 1.0, 0), pc(soft(1.9, 0.9, 0.08, 0.03), ['#8a5a35'], 0, 0.5, -0.38)];
    for (const x of [-0.9, 0.9]) D.push(pc(soft(0.1, 1.0, 0.85, 0.03), ['#946238', '#6a4426'], x, 0.5, 0));
    for (const s of [-1, 1]) D.push(pc(soft(0.5, 0.04, 0.62, 0.01), ['#fffaf0', '#e8dcc0'], s * 0.27, 1.1, 0.05, 0, 0, s * 0.12));
    D.push(pc(soft(1.06, 0.04, 0.66, 0.01), ['#c0503e'], 0, 1.075, 0.05), pc(stem([[0.6, 1.08, -0.2], [0.75, 1.4, -0.25], [0.95, 1.7, -0.3]], 0.04, 0.005, 4, 6), ['#ffffff', '#e8e0f0']));
    const desk = group(mesh(fuse(D)), candle(0.35)); desk.children[1].position.set(-0.75, 1.06, -0.2); live.glows.push(desk.children[1].children[1]);
    put(desk, [6, 36, 14.4], 1, Math.PI);
    put(owl(2), [-8.5, 46.8, -10.5], 1, 0.3); put(owl(5), [-12.5, 41, -13], 1, 0.6); put(owl(9), [12.5, 46.8, 15.5], 1, Math.PI);
    // toiles d'araignée dans les coins hauts
    const web = () => { const P = []; for (let k = 0; k < 7; k++) { const a = (k / 6) * (Math.PI / 2); P.push(0, 0, 0, Math.cos(a) * 1.6, -Math.sin(a) * 1.6, 0); } for (const rr of [0.5, 0.95, 1.4]) for (let k = 0; k < 6; k++) { const a0 = (k / 6) * (Math.PI / 2), a1 = ((k + 1) / 6) * (Math.PI / 2); P.push(Math.cos(a0) * rr, -Math.sin(a0) * rr, 0, Math.cos(a1) * rr * 0.92, -Math.sin(a1) * rr * 0.92, 0); } return new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(P, 3)), new THREE.LineBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.55 })); };
    onWall(ctx, 'n', -15, 46.6, web()); onWall(ctx, 'e', -15, 46.6, web());
    // rouleaux et cartes dans une jarre, dans le coin
    const J = [pc(turned([[0, 0], [0.45, 0], [0.55, 0.5], [0.4, 1.0], [0.45, 1.1], [0, 1.1]], 18), ['#6a8ac0', '#3a5a90'])];
    for (let k = 0; k < 6; k++) { const a = (k / 6) * TAU; J.push(pc(turned([[0.08, 0], [0.08, 1.2], [0, 1.2]], 8), ['#fff4dc', '#e8d4a8'], Math.cos(a) * 0.18, 0.3, Math.sin(a) * 0.18, Math.cos(a) * 0.25, 0, Math.sin(a) * 0.25)); }
    put(mesh(fuse(J)), [14.2, 36, 4.9]);
    floatIsle(ctx, 37, 4.6, 32, 1.5, [(() => {
      const K = [], cols = ['#c0503e', '#4a7ab8', '#e0a040', '#5aa070', '#8a5ab0']; let y = 0;
      for (let k = 0; k < 5; k++) { const h = 0.5 + (k % 2) * 0.2; K.push(pc(soft(2.6 - k * 0.25, h, 1.8 - k * 0.12, 0.08), [cols[k], dark(cols[k])], 0, y + h / 2, 0, 0, k * 0.3, 0), pc(new THREE.BoxGeometry(2.45 - k * 0.25, h * 0.8, 1.6 - k * 0.12), ['#fff8e8'], 0.05, y + h / 2, 0, 0, k * 0.3, 0)); y += h; }
      K.push(pc(turned([[0.35, 0], [0.1, 0.1], [0.06, 1.1], [0.5, 1.2], [0.3, 1.6], [0, 1.65]], 16), ['#3fa070', '#1f6a48'], 0.4, y, 0));
      return mesh(fuse(K));
    })()]);
  });

  /* La Roue à godets (48 m) : le bief en eau, engrenages de bois, poutres, outils, sacs et gerbes */
  W(4, () => {
    // l'eau du bief (la zone d'eau de la physique) : une nappe qui coule, bordée de pierres plates
    const c = document.createElement('canvas'); c.width = 64; c.height = 64; const x2 = c.getContext('2d'); x2.fillStyle = '#7fd0ea'; x2.fillRect(0, 0, 64, 64);
    for (let i = 0; i < 26; i++) { x2.strokeStyle = 'rgba(255,255,255,.6)'; x2.lineWidth = 1.5; x2.beginPath(); const y = Math.random() * 64, x0 = Math.random() * 64; x2.moveTo(x0, y); x2.quadraticCurveTo(x0 + 6, y - 2, x0 + 12, y); x2.stroke(); }
    const tex = new THREE.CanvasTexture(c); tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(10, 1); tex.colorSpace = THREE.SRGBColorSpace;
    const water = new THREE.Mesh(new THREE.PlaneGeometry(30, 3).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: tex, transparent: true, opacity: 0.8, roughness: 0.1, emissive: '#3aa8c8', emissiveIntensity: 0.2, polygonOffset: true, polygonOffsetFactor: -2 }));
    put(water, [0, 48.02, -3.5]); live.anim.push(t => (tex.offset.x = -t * 0.25));
    const kerb = []; for (const z of [-5.05, -1.95]) for (let x = -14.5; x < 15; x += 1.05) kerb.push(pc(blob(0.5, { sx: 1.0, sy: 0.08, sz: 0.3, lump: 0.25, seed: Math.round(x * 3 + z), detail: 1 }), ['#d8d0c4', '#9a9080'], x, 0.02, z));
    put(mesh(fuse(kerb), MAT.stone), [0, 48, 0]);
    // engrenages de bois au mur du fond, qui tournent avec la roue
    const g1 = gear(2.0, 12, ['#c99260', '#7a4a24'], 0.3), g2 = gear(1.2, 8, ['#b07a42', '#6a4426'], 0.3);
    onWall(ctx, 'n', -8, 53.5, g1); onWall(ctx, 'n', -8 + 3.05, 53.5 - 0.9, g2); g1.position.z += 0.3; g2.position.z += 0.3;
    live.spins.push({ obj: g1, axis: 'z', speed: 0.3 }, { obj: g2, axis: 'z', speed: -0.3 * 12 / 8 });
    // poutres du plafond, lanternes qui pendent
    const B = []; for (const z of [-9, 0, 9]) B.push(pc(soft(30, 0.5, 0.55, 0.08), ['#946238', '#5a3a1a'], 0, 58.5, z));
    put(mesh(fuse(B)), [0, 0, 0]);
    for (const [x, z] of [[-6, 9], [6, 9], [0, -9]]) {
      const lan = group(mesh(fuse([pc(stem([[0, 0, 0], [0, -1.6, 0]], 0.02, 0.02, 3, 2), ['#4a4560']), pc(turned([[0, -2.5], [0.25, -2.45], [0.25, -1.9], [0.12, -1.75], [0, -1.7]], 8), ['#3a3550']), pc(new THREE.TorusGeometry(0.1, 0.03, 5, 10), ['#3a3550'], 0, -1.62, 0)]), MAT.shiny, false));
      const f = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), glow('#ffcf6a', 2)); f.position.y = -2.2; lan.add(f); live.glows.push(f);
      put(lan, [x, 58.25, z]); live.anim.push(t => (lan.rotation.z = Math.sin(t * 1.1 + x) * 0.05));
    }
    // outils pendus au mur, gerbes de blé et caisse de grain contre le mur de devant
    const T = [pc(soft(4, 0.2, 0.15, 0.04), ['#8a5a35'], 0, 0.6, 0.1)];
    for (const [x, kind] of [[-1.3, 0], [0, 1], [1.3, 2]]) {
      T.push(pc(stem([[x, 0.75, 0.25], [x + 0.05, -1.6, 0.25]], 0.05, 0.05, 5, 2), ['#c99260', '#8a5a35']));
      if (kind === 0) for (const d of [-0.18, 0, 0.18]) T.push(pc(stem([[x + d, -1.6, 0.25], [x + d * 1.3, -2.2, 0.28]], 0.025, 0.02, 4, 2), ['#9a9aa8']));
      if (kind === 1) T.push(pc(soft(0.7, 0.08, 0.06, 0.02), ['#7a7a8c'], x, -1.6, 0.25), ...[-0.3, -0.1, 0.1, 0.3].map(d => pc(stem([[x + d, -1.6, 0.25], [x + d, -2.0, 0.28]], 0.02, 0.015, 4, 2), ['#9a9aa8'])));
      if (kind === 2) T.push(pc(stem([[x, 0.75, 0.25], [x + 0.6, 0.85, 0.3], [x + 1.0, 0.6, 0.3]], 0.03, 0.01, 4, 6), ['#c8c8d8']));
    }
    onWall(ctx, 'w', -4, 52, mesh(fuse(T)));
    const sheaf = s => { const K = []; const r2 = rng(s); for (let k = 0; k < 26; k++) { const a = r2() * TAU, d = r2() * 0.22; K.push(pc(stem([[Math.cos(a) * d * 0.5, 0, Math.sin(a) * d * 0.5], [Math.cos(a) * d * 0.3, 0.8, Math.sin(a) * d * 0.3], [Math.cos(a) * d * 1.6, 1.5, Math.sin(a) * d * 1.6]], 0.02, 0.015, 3, 3), ['#ffe08a', '#c8a040']), pc(blob(0.05, { sy: 2, detail: 0 }), ['#f0c860'], Math.cos(a) * d * 1.6, 1.58, Math.sin(a) * d * 1.6)); } K.push(pc(new THREE.TorusGeometry(0.16, 0.04, 5, 12).rotateX(Math.PI / 2), ['#a87a3a'], 0, 0.75, 0)); return mesh(fuse(K)); };
    put(sheaf(1), [3.6, 48, 14.5]); put(sheaf(2), [4.3, 48, 14.3], 1, 1);
    const crate = [pc(soft(1.6, 1.0, 1.0, 0.06), ['#c99260', '#8a5a35'], 0, 0.5, 0), pc(blob(0.8, { sx: 0.95, sy: 0.25, sz: 0.55, lump: 0.15, detail: 2 }), ['#ffe8a0', '#e0b860'], 0, 1.0, 0)];
    for (const x of [-0.8, 0.8]) crate.push(pc(soft(0.08, 1.02, 1.04, 0.02), ['#7a4a24'], x, 0.5, 0));
    put(mesh(fuse(crate)), [6.2, 48, 14.3]);
    floatIsle(ctx, 49, 1.7, 33, 1.6, [(() => {
      const K = [pc(turned([[1.2, 0], [1.0, 3.2], [0.7, 3.4], [0, 3.4]], 14), ['#f4ead6', '#c8b898']), pc(new THREE.ConeGeometry(1.1, 1.2, 14), ['#c0503e', '#8a2a2a'], 0, 4.0, 0)];
      return mesh(fuse(K));
    })()], g => {
      const sails = group(mesh(fuse([0, 1, 2, 3].flatMap(k => { const a = (k / 4) * TAU; return [pc(soft(0.15, 3.2, 0.08, 0.02).translate(0, 1.6, 0), ['#8a5a35'], 0, 0, 0, 0, 0, a), pc(soft(0.75, 2.4, 0.04, 0.02).translate(0.42, 1.9, 0), ['#fff8e8', '#e8dcc0'], 0, 0, 0, 0, 0, a)]; })), MAT.cloth, false));
      sails.position.set(0, 3.0, 0.85); g.add(sails); live.spins.push({ obj: sails, axis: 'z', speed: 0.6 });
    });
  });

  /* Le Grand Huit (60 m) : guirlande d'ampoules au haut des murs, guichet, chariot de pop-corn, étoiles, enseigne */
  W(5, () => {
    const bulbs = [], step = LIGHT ? 1.6 : 1.0;
    for (const f of ['n', 's', 'e', 'w']) for (let t = -14.5; t <= 14.5; t += step) { const [p] = WALL[f](t, 70.3); bulbs.push(p); }
    const im = new THREE.InstancedMesh(new THREE.SphereGeometry(0.13, 8, 6), new THREE.MeshBasicMaterial({ color: '#ffffff' }), bulbs.length), o = new THREE.Object3D(), cc = new THREE.Color();
    bulbs.forEach((p, i) => { o.position.set(...p); o.updateMatrix(); im.setMatrixAt(i, o.matrix); im.setColorAt(i, cc.set(['#ffe08a', '#ff9ac0', '#9fe8ff'][i % 3])); });
    put(im, [0, 0, 0]); live.deco.at(-1).y = 70;
    live.anim.push(t => { const k = Math.floor(t * 3) % 3; bulbs.forEach((_, i) => im.setColorAt(i, cc.set(['#ffe08a', '#ff9ac0', '#9fe8ff'][(i + k) % 3]).multiplyScalar((i + k) % 3 === 0 ? 1 : 0.55))); im.instanceColor.needsUpdate = true; });
    // l'enseigne au-dessus des rails
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(6, 1.5), new THREE.MeshBasicMaterial({ map: ctx.text('GRAND HUIT', 54, '#ffffff'), transparent: true }));
    sign.position.z = 0.14; onWall(ctx, 'n', 2, 68.8, group(mesh(fuse([pc(soft(6.6, 1.9, 0.2, 0.08), ['#ff6476', '#c83a50'])]), MAT.shiny, false), sign));
    const star = c => { const s = new THREE.Shape(); for (let k = 0; k < 10; k++) { const a = (k / 10) * TAU + Math.PI / 2, rr = k % 2 ? 0.28 : 0.65; k ? s.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : s.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); } return mesh(fuse([pc(new THREE.ExtrudeGeometry(s, { depth: 0.1, bevelEnabled: true, bevelSize: 0.05, bevelThickness: 0.05, bevelSegments: 2 }), [light(c), c])]), MAT.shiny, false); };
    for (const [f, t, c] of [['w', -9, '#ffd84a'], ['w', 3, '#5ab4ff'], ['e', -9, '#ff9ac0'], ['e', 9, '#7ae08a'], ['s', -5.4, '#c89cff'], ['s', 5.4, '#ffd84a'], ['n', 10.7, '#ff9ac0']]) onWall(ctx, f, t, 64.6, star(c));
    // guichet à rayures, dans le coin
    const G = [pc(soft(2.2, 2.4, 1.8, 0.1), ['#fff3da', '#e8c8a0'], 0, 1.2, 0), pc(soft(1.4, 0.9, 0.1, 0.04), ['#5ab4ff', '#3a84cf'], 0, 1.6, 0.9)];
    for (let k = 0; k < 6; k++) G.push(pc(soft(0.42, 0.12, 2.3, 0.03), [k % 2 ? '#ffffff' : '#ff6476'], -1.05 + k * 0.42, 2.75, 0.2, 0.25, 0, 0));
    G.push(pc(soft(1.2, 0.45, 0.08, 0.03), ['#ffd84a', '#e0a020'], 0, 3.3, 0.6));
    put(mesh(fuse(G)), [-13.6, 60, 13.6], 1, Math.PI * 0.75);
    // chariot de pop-corn contre le mur de devant
    const P = [pc(soft(1.6, 1.0, 0.9, 0.08), ['#ff6476', '#c83a50'], 0, 0.9, 0), pc(new THREE.BoxGeometry(1.4, 0.9, 0.8), ['#e8f8ff'], 0, 1.85, 0)];
    for (let k = 0; k < 20; k++) P.push(pc(blob(0.1, { detail: 0, lump: 0.4, seed: k }), ['#fff4c0', '#f0d080'], (k % 5 - 2) * 0.22, 1.5 + Math.floor(k / 5) * 0.12, ((k * 7) % 5 - 2) * 0.12));
    P.push(pc(soft(1.7, 0.1, 1.0, 0.03), ['#ffd84a'], 0, 2.35, 0));
    for (const x of [-0.6, 0.6]) P.push(pc(new THREE.TorusGeometry(0.3, 0.06, 6, 16).rotateY(Math.PI / 2), ['#3a3550'], x, 0.32, 0.35));
    put(mesh(fuse(P)), [5.2, 60, 14.2], 1, Math.PI);
    floatIsle(ctx, 61, 3.6, 31, 1.6, [], g => {
      const wheel = group(mesh(fuse([pc(new THREE.TorusGeometry(2, 0.08, 6, 36), ['#ff6476', '#c83a50']), ...Array.from({ length: 8 }, (_, k) => pc(soft(0.06, 2, 0.06, 0.01).translate(0, 1, 0), ['#ffffff'], 0, 0, 0, 0, 0, (k / 8) * TAU)), ...Array.from({ length: 8 }, (_, k) => { const a = (k / 8) * TAU; return pc(soft(0.45, 0.4, 0.45, 0.08), [['#ffd84a', '#5ab4ff', '#7ae08a', '#c89cff'][k % 4]], Math.cos(a) * 2, Math.sin(a) * 2 - 0.3, 0); })]), MAT.shiny, false));
      wheel.position.set(0, 2.8, 0); g.add(wheel, mesh(fuse([-1, 1].map(s => pc(stem([[s * 1.2, 0, 0], [0, 2.8, 0]], 0.08, 0.06, 5, 2), ['#e8e0f0', '#a8a0b8']))))); live.spins.push({ obj: wheel, axis: 'z', speed: 0.35 });
    });
  });

  /* La Ville perchée (72 m) : une île avec deux maisonnettes, au loin */
  W(6, () => {
    floatIsle(ctx, 73, 5.5, 33, 1.7, [(() => {
      const K = [];
      for (const [x, z, c] of [[-0.8, 0.3, '#ffd8e4'], [0.9, -0.4, '#cfe6ff']]) { K.push(pc(soft(1.2, 1.1, 1.0, 0.1), [c, dark(c, 0.1)], x, 0.55, z), pc(new THREE.ConeGeometry(0.95, 0.8, 4).rotateY(Math.PI / 4), ['#e0605e', '#a83a3a'], x, 1.5, z), pc(soft(0.3, 0.4, 0.05, 0.02), ['#ffe08a'], x, 0.6, z + 0.52)); }
      return mesh(fuse(K));
    })()]);
  });

  /* Le Mobile (84 m) : planètes et grues de papier, plantes en pot sur le pont, longue-vue, montgolfière au loin */
  W(7, () => {
    for (const [x, z, len, c, ring] of [[12, 12, 4.5, '#ff9ac0', true], [-12, -12, 3.5, '#7fc8ff', false], [12, -13, 6, '#ffd84a', true], [-1, 13, 5, '#b89cff', false]]) {
      const K = [pc(blob(0.8, { lump: 0.04, detail: 3 }), [light(c), dark(c)], 0, 0, 0)];
      if (ring) K.push(pc(new THREE.TorusGeometry(1.25, 0.08, 4, 36).scale(1, 1, 0.25).rotateX(Math.PI / 2 - 0.4), ['#fff4c0', '#e0b860']));
      const pl = mesh(fuse(K), MAT.shiny), str = mesh(fuse([pc(stem([[0, 0, 0], [0, -len, 0]], 0.015, 0.015, 3, 2), ['#ffffff'])]), MAT.clay, false);
      pl.position.y = -len - 0.8; const h = group(str, pl); put(h, [x, 95, z]);
      live.anim.push(t => { pl.rotation.y = t * 0.3 + x; h.rotation.z = Math.sin(t * 0.6 + z) * 0.03; });
    }
    // des grues de papier qui tournent lentement dans la salle
    const crane = c => { const P = [0, 0, 0.35, 0, 0.1, -0.3, -0.45, 0.05, 0, 0, 0, 0.35, 0.45, 0.05, 0, 0, 0.1, -0.3, 0, 0, 0.35, 0, 0.25, 0.5, 0, 0.1, -0.3, 0, 0, 0.35, 0, 0.1, -0.3, 0, 0.3, -0.55]; const g = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.computeVertexNormals(); return new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: c, side: THREE.DoubleSide, roughness: 0.8 })); };
    for (let k = 0; k < (LIGHT ? 3 : 6); k++) {
      const cr = crane(PETALS[k % PETALS.length]), R = 4 + (k % 3) * 2.5, y = 89 + k * 0.9, ph = k * 1.3; put(cr, [0, y, 0]);
      live.anim.push(t => { const a = t * 0.25 + ph; cr.position.set(2 + Math.cos(a) * R, y + Math.sin(t * 1.2 + ph) * 0.3, 2 + Math.sin(a) * R); cr.rotation.y = -a; cr.rotation.z = Math.sin(t * 3 + ph) * 0.15; });
    }
    for (const [x, z, s] of [[-15.1, 15.1, 1], [-2.9, 15.1, 0.85], [-15.1, 0.9, 0.9]]) put(potted(Math.round(x * z) + 3, s), [x, 84, z]);
    const tel = [pc(stem([[0, 0, 0], [0.3, 1.1, 0]], 0.04, 0.04, 4, 2), ['#8a5a35']), pc(stem([[0, 0, 0], [-0.3, 1.1, 0.2]], 0.04, 0.04, 4, 2), ['#8a5a35']), pc(stem([[0, 0, 0], [0, 1.1, -0.3]], 0.04, 0.04, 4, 2), ['#8a5a35']), pc(turned([[0.1, -0.7], [0.13, 0.5], [0.17, 0.7], [0, 0.72]], 14), ['#ffe08a', '#c8902e'], 0, 1.3, 0, 0.8, 0, 0)];
    put(mesh(fuse(tel), MAT.shiny), [-3.2, 84, 1.1], 1, -0.8);
    // la montgolfière qui flotte dehors
    const B = [pc(blob(2.2, { sy: 1.15, lump: 0.03, detail: 3 }), ['#ffd84a', '#ff6476'], 0, 4.4, 0)];
    for (let k = 0; k < 8; k++) { const a = (k / 8) * TAU; B.push(pc(stem([[Math.cos(a) * 2.18, 4.4, Math.sin(a) * 2.18], [Math.cos(a) * 1.5, 2.2, Math.sin(a) * 1.5], [Math.cos(a) * 0.5, 0.9, Math.sin(a) * 0.5]], 0.04, 0.03, 4, 6), ['#ff6476'])); }
    B.push(pc(turned([[0.55, 0], [0.6, 0.6], [0, 0.6]], 12), ['#c99260', '#8a5a35']));
    const bal = mesh(fuse(B)); bal.position.set(-30, 88, 14); bal.userData = { y: 88, ph: 1 }; ctx.tower.add(bal); live.floaters.push(bal);
  });

  /* L'Orgue (96 m) : rideaux de velours, rosaces, candélabres, lustre, notes de musique qui flottent */
  W(8, () => {
    for (const f of ['e', 'w']) for (const t of [-9, 3]) onWall(ctx, f, t, 101.6, curtain(1.6, 6.6, '#c8303e'));
    const rose = seed => { const r2 = rng(seed), K = [pc(turned([[0, 0], [1.3, 0], [1.4, 0.1], [1.3, 0.2], [0, 0.18]], 32), ['#ffe08a', '#c8902e'], 0, 0, 0, Math.PI / 2, 0, 0)]; const G = []; for (let k = 0; k < 8; k++) { const a = (k / 8) * TAU, c = ['#ff6a8a', '#6ab4ff', '#ffd84a', '#7ae08a'][k % 4]; G.push(new THREE.Mesh(new THREE.CircleGeometry(0.42, 12).translate(Math.cos(a) * 0.75, Math.sin(a) * 0.75, 0.21), new THREE.MeshBasicMaterial({ color: c }))); } G.push(new THREE.Mesh(new THREE.CircleGeometry(0.35, 12).translate(0, 0, 0.21), new THREE.MeshBasicMaterial({ color: '#ffffff' }))); return group(mesh(fuse(K), MAT.shiny, false), ...G); };
    onWall(ctx, 'e', -3, 104.4, rose(1)); onWall(ctx, 'w', 9, 104.4, rose(2)); onWall(ctx, 's', -12, 105.3, rose(3)); onWall(ctx, 's', 12, 105.3, rose(4));
    const cand = () => { const K = [pc(turned([[0.5, 0], [0.45, 0.1], [0.12, 0.25], [0.08, 2.2], [0.14, 2.3], [0, 2.32]], 18), ['#ffe08a', '#a87a28'])], f = []; for (const a of [0, 2.1, 4.2]) { K.push(pc(stem([[0, 2.0, 0], [Math.cos(a) * 0.5, 2.25, Math.sin(a) * 0.5], [Math.cos(a) * 0.55, 2.55, Math.sin(a) * 0.55]], 0.035, 0.03, 4, 6), ['#e8c068'])); const c = candle(0.4); c.position.set(Math.cos(a) * 0.55, 2.55, Math.sin(a) * 0.55); f.push(c); } const c0 = candle(0.5); c0.position.y = 2.32; f.push(c0); return group(mesh(fuse(K), MAT.shiny), ...f); };
    for (const p of [[14.2, 96, 14.2], [-14.3, 96, 14.3], [14.2, 96, -8.6]]) { const c = cand(); put(c, p); c.children.slice(1).forEach(k => live.glows.push(k.children[1])); }
    const notes = [], noteGeo = (() => { const K = [pc(blob(0.22, { sx: 1.3, sz: 0.4, detail: 2 }), ['#ffffff'], 0, 0, 0, 0, 0, 0.4), pc(soft(0.06, 0.9, 0.06, 0.02), ['#ffffff'], 0.25, 0.45, 0)]; K.push(pc(soft(0.35, 0.08, 0.06, 0.02), ['#ffffff'], 0.4, 0.86, 0, 0, 0, -0.4)); return fuse(K); })();
    for (let k = 0; k < (LIGHT ? 5 : 10); k++) { const m = new THREE.Mesh(noteGeo, glow(['#ffe08a', '#ff9ac0', '#9fe8ff'][k % 3], 1.2)); const x = -13 + k * 2.1; put(m, [x, 101, -13]); live.deco.at(-1).face = 'n'; notes.push([m, x, k]); }
    live.anim.push(t => notes.forEach(([m, x, k]) => { const f = (t * 0.12 + k * 0.37) % 1; m.position.set(x + Math.sin(t + k) * 0.4, 100.8 + f * 5, -13.2 + Math.cos(t * 0.7 + k) * 0.3); m.scale.setScalar(Math.min(1, f * 5, (1 - f) * 5)); m.rotation.y = Math.sin(t + k) * 0.4; }));
    const L2 = [pc(new THREE.TorusGeometry(2, 0.09, 8, 40).rotateX(Math.PI / 2), ['#ffe08a', '#c8902e'])], fl = [];
    for (let k = 0; k < 4; k++) { const a = (k / 4) * TAU; L2.push(pc(stem([[Math.cos(a) * 2, 0, Math.sin(a) * 2], [0, 1.3, 0]], 0.03, 0.03, 4, 2), ['#e8c068'])); }
    L2.push(pc(stem([[0, 1.3, 0], [0, 106.8 - 105, 0]], 0.04, 0.04, 4, 2), ['#e8c068']));
    for (let k = 0; k < 10; k++) { const a = (k / 10) * TAU, c = candle(0.3); c.position.set(Math.cos(a) * 2, 0.05, Math.sin(a) * 2); fl.push(c); }
    const lustre = group(mesh(fuse(L2), MAT.shiny), ...fl); put(lustre, [0, 105, 7]); fl.forEach(c => live.glows.push(c.children[1]));
    floatIsle(ctx, 97, 0.2, 32, 1.6, [(() => {
      const K = [pc(turned([[1.5, 0], [1.5, 0.3], [0, 0.3]], 8), ['#f4ead6', '#c8b898'])];
      for (let k = 0; k < 8; k++) { const a = (k / 8) * TAU; K.push(pc(stem([[Math.cos(a) * 1.3, 0.3, Math.sin(a) * 1.3], [Math.cos(a) * 1.3, 2.1, Math.sin(a) * 1.3]], 0.06, 0.06, 5, 2), ['#ffffff'])); }
      K.push(pc(new THREE.ConeGeometry(1.8, 1.2, 8), ['#7ae08a', '#3a9a5a'], 0, 2.7, 0), pc(blob(0.18, { detail: 1 }), ['#ffd84a'], 0, 3.4, 0));
      return mesh(fuse(K));
    })()]);
  });

  /* Le Trébuchet (108 m) : oriflammes aux coins, torches, boucliers sur le rebord, camp de tentes au loin */
  W(9, () => {
    const flags = [];
    for (const [x, z, c] of [[15.3, 15.3, '#c0503e'], [-15.3, 15.3, '#4a7ab8'], [15.3, -15.3, '#e0a040'], [-15.3, -15.3, '#5aa070']]) {
      const pole = mesh(fuse([pc(stem([[0, 0, 0], [0, 6, 0]], 0.08, 0.06, 6, 2), ['#8a5a35', '#5a3a1a']), pc(blob(0.16, { detail: 1 }), ['#ffd84a'], 0, 6.1, 0)]));
      const g = new THREE.PlaneGeometry(2.6, 0.9, 12, 2); g.translate(1.3, 0, 0); { const q = g.attributes.position; for (let i = 0; i < q.count; i++) q.setY(i, q.getY(i) * (1 - q.getX(i) / 3.6)); }
      const fl = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: c, side: THREE.DoubleSide, roughness: 0.8 })); fl.position.y = 5.4; flags.push([fl, g.attributes.position.array.slice(), x + z]);
      put(group(pole, fl), [x, 108, z], 1, Math.atan2(z, -x));
    }
    live.anim.push(t => flags.forEach(([fl, base, ph]) => { const q = fl.geometry.attributes.position; for (let i = 0; i < q.count; i++) { const x = base[i * 3]; q.setZ(i, Math.sin(t * 4 - x * 2 + ph) * x * 0.12); } q.needsUpdate = true; }));
    const fires = [];
    for (const [x, z] of [[15.4, 0], [-15.4, -8], [0, 15.4], [6, -15.4]]) {
      const tg = group(mesh(fuse([pc(stem([[0, 0, 0], [0, 2.4, 0]], 0.07, 0.06, 5, 2), ['#6a4426']), pc(turned([[0.08, 0], [0.22, 0.3], [0.2, 0.4], [0, 0.35]], 10), ['#5a5a6a'], 0, 2.35, 0)])));
      const f = new THREE.Mesh(blob(0.22, { sy: 1.8, lump: 0.3, detail: 1 }), glow('#ff9a3a', 2.4)); f.position.y = 2.95; tg.add(f); fires.push(f);
      put(tg, [x, 108, z]);
    }
    live.anim.push(t => fires.forEach((f, k) => f.scale.set(1 + Math.sin(t * 9 + k) * 0.12, 1 + Math.sin(t * 13 + k * 2) * 0.2, 1)));
    // boucliers accrochés au rebord extérieur du plateau
    const shield = (c1, c2) => mesh(fuse([pc(blob(0.55, { sy: 1.2, sz: 0.25, lump: 0.02, detail: 2 }), [c1, dark(c1)]), pc(soft(0.16, 1.0, 0.1, 0.03), [c2], 0, 0, 0.13), pc(soft(0.8, 0.16, 0.1, 0.03), [c2], 0, 0.15, 0.13), pc(blob(0.1, { detail: 1 }), ['#ffd84a'], 0, 0.15, 0.2)]), MAT.shiny);
    for (let k = 0; k < 4; k++) { put(shield(['#c0503e', '#4a7ab8', '#5aa070', '#e0a040'][k], '#fff4dc'), [-10.5 + k * 7, 107.1, 16.45]); put(shield(['#4a7ab8', '#c0503e', '#e0a040', '#5aa070'][k], '#fff4dc'), [16.45, 107.1, -10.5 + k * 7], 1, Math.PI / 2); }
    floatIsle(ctx, 109, 2.2, 32, 1.7, [(() => {
      const K = [];
      for (const [x, z, c] of [[-0.8, 0.2, '#c0503e'], [1.0, -0.5, '#4a7ab8']]) { K.push(pc(new THREE.ConeGeometry(0.9, 1.4, 10), [light(c), c], x, 0.7, z)); for (let k = 0; k < 5; k++) K.push(pc(soft(0.04, 1.4, 0.04, 0.01), ['#ffffff'], x + Math.cos(k * 1.26) * 0.45, 0.7, z + Math.sin(k * 1.26) * 0.45, 0, 0, 0)); K.push(pc(stem([[x, 1.3, z], [x, 2.0, z]], 0.02, 0.02, 3, 2), ['#5a3a1a']), pc(soft(0.4, 0.22, 0.02, 0.01), ['#ffd84a'], x + 0.2, 1.88, z)); }
      K.push(...[0, 1, 2].map(k => pc(stem([[0.2 + Math.cos(k * 2.1) * 0.2, 0, 1.2 + Math.sin(k * 2.1) * 0.2], [0.2, 0.3, 1.2]], 0.04, 0.03, 4, 2), ['#6a4426'])));
      return mesh(fuse(K));
    })()], g => { const f = new THREE.Mesh(blob(0.15, { sy: 1.6, detail: 1 }), glow('#ff9a3a', 2.4)); f.position.set(0.2, 0.45, 1.2); g.add(f); live.glows.push(f); });
  });

  /* Le Sommet (120 m) : des cristaux qui tournent autour du disque, des aurores, un observatoire */
  W(10, () => {
    const ring = new THREE.Group(), cr = [];
    for (let k = 0; k < 9; k++) { const a = (k / 9) * TAU, c = new THREE.Mesh(new THREE.OctahedronGeometry(0.45, 0), glow(['#b49cff', '#7fe6ff', '#ff9ce6'][k % 3], 1.2)); c.scale.set(0.7, 1.8, 0.7); c.position.set(Math.cos(a) * 9.5, 1.5 + (k % 3) * 0.6, Math.sin(a) * 9.5); ring.add(c); cr.push(c); }
    put(ring, [10, 120, 0]); live.glows.push(ring);
    live.anim.push(t => { ring.rotation.y = t * 0.12; cr.forEach((c, k) => { c.position.y = 1.5 + (k % 3) * 0.6 + Math.sin(t * 1.3 + k) * 0.35; c.rotation.y = t * 0.8 + k; }); });
    const au = [];
    for (let k = 0; k < 3; k++) {
      const g = new THREE.PlaneGeometry(90, 14, 40, 1), m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: ['#7fffd0', '#b49cff', '#7fc8ff'][k], transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false, fog: false }));
      m.position.set(0, 140 + k * 6, -60 - k * 8); m.rotation.y = (k - 1) * 0.5; ctx.tower.add(m); au.push([m, g.attributes.position.array.slice(), k]);
    }
    live.anim.push(t => au.forEach(([m, base, k]) => { const q = m.geometry.attributes.position; for (let i = 0; i < q.count; i++) { const x = base[i * 3]; q.setZ(i, Math.sin(x * 0.08 + t * 0.3 + k) * 5); q.setY(i, base[i * 3 + 1] + Math.sin(x * 0.05 + t * 0.2 + k * 2) * 3); } q.needsUpdate = true; }));
    floatIsle(ctx, 121, 3.9, 30, 1.6, [(() => {
      const K = [pc(turned([[1.3, 0], [1.3, 1.4], [0, 1.4]], 20), ['#f4ead6', '#c8b898']), pc(new THREE.SphereGeometry(1.35, 20, 10, 0, TAU, 0, Math.PI / 2), ['#b8c8f0', '#7a8ac0'], 0, 1.4, 0)];
      K.push(pc(turned([[0.18, -1.0], [0.24, 0.8], [0.3, 1.0], [0, 1.02]], 14), ['#ffe08a', '#c8902e'], 0.6, 2.4, 0, 0, 0, -0.7));
      return mesh(fuse(K), MAT.shiny);
    })()]);
  });
}
