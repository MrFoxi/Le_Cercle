// THE HOLLOW — l'histoire des Jardins suspendus. La Glaneuse, une vieille femme à demi effacée (elle perd sa couleur,
// un peu plus si l'on tarde), récolte le pollen des ombrelles : ici, ce qui n'est pas encré n'existe pas. Elle apprend au
// voyageur à encrer, et lui demande de ramener trois Semeurs dorés à l'arbre-mère, sur son île, au bout d'une
// passerelle encore au crayon. Quand les trois sont rentrés, l'arbre parle : le treillis de racines qui ferme le gouffre
// se retire, la descente est ouverte. Tout est retenu (localStorage) ; chaque moment fort devient une page du carnet.
import * as THREE from 'three';
import { ink, glowy } from './ink.js';
import { rng, paint, lump, tube, merge, cast, TAU } from './modelage.js';
import { tree, umbrella, seeder } from './jardins.js';
import { R_ABYSS } from './terrain.js';
import { save } from './ui.js';
import { beacon } from './sol.js';

const INK_MAX = 6, BRIDGE_COST = 3;

// la Glaneuse : dos voûté, longue robe, châle, chignon, une hotte pleine de pollen qui luit, un bâton
function glaneuse() {
  const robe = paint(new THREE.LatheGeometry([[0, 0.02], [0.5, 0.02], [0.42, 0.5], [0.3, 1.0], [0.22, 1.3], [0, 1.34]].map(([x, y]) => new THREE.Vector2(x, y)), 18), '#8a6a58', '#4a3430');
  const shawl = paint(lump(1, { sx: 0.42, sy: 0.22, sz: 0.36, lumpy: 0.2, detail: 2 }).translate(0, 1.26, -0.03), '#c8a878', '#8a6a48');
  const head = paint(new THREE.SphereGeometry(0.15, 14, 10).translate(0, 1.47, 0.12), '#e0c0a8', '#b89a88');
  const bun = paint(lump(0.11, { detail: 1 }).translate(0, 1.58, 0.02), '#e8e4ec', '#a8a4b0');
  const basket = paint(new THREE.CylinderGeometry(0.26, 0.2, 0.5, 12, 1, true).translate(0, 1.0, -0.36), '#b08850', '#6a4a28');
  const stick = paint(tube([[0.42, 0, 0.25], [0.45, 0.8, 0.22], [0.4, 1.45, 0.2]], 0.025, 0.02, 5, 4), '#7a5a3a');
  const g = merge([robe, shawl, head, bun, basket, stick]);
  g.rotateX(0.12); // le dos voûté
  return g;
}
// une borne d'encrier : une pierre creusée, au départ de la passerelle
function borne() {
  return merge([paint(lump(1, { sx: 0.9, sy: 1.2, sz: 0.9, lumpy: 0.25, detail: 2 }).translate(0, 0.9, 0), '#c8ccd0', '#6a7280'), paint(new THREE.TorusGeometry(0.35, 0.08, 6, 16).rotateX(Math.PI / 2).translate(0, 2.0, 0), '#3a3848')]);
}

export function createStory(scene, { terrain, exitAt, start, ui }) {
  const st = Object.assign({ met: false, ink: 0, pollen: [], bridge: false, delivered: [], open: false, spoke: 0 }, save.load('hollow-jardins', {}));
  const persist = () => save.keep('hollow-jardins', st);
  const r = rng(1201), up = new THREE.Vector3(0, 1, 0), [sx, sy, sz] = start, as = Math.atan2(sz, sx), rs = Math.hypot(sx, sz);
  const at = (a, rad) => [Math.cos(a) * rad, Math.sin(a) * rad];
  const ground = (x, z) => terrain(x, z).h;

  // l'île de l'arbre-mère, en contrebas de la terrasse du départ ; la passerelle part du bord de la terrasse
  const ai = as - 0.055;
  let re = rs; while (re > rs - 200 && Math.abs(ground(...at(ai, re)) - sy) < 9) re -= 1; // on part du rayon du départ et l'on rentre jusqu'au bord de la terrasse
  const E = at(ai, re + 3), Ey = ground(...E);
  // l'île est grande, l'arbre-mère immense (TREE : son échelle) ; la passerelle mord de 4 m dans l'île (pas de trou)
  const I = { R: 42, y: Ey + 0.4 }, TREE = 1.3, K2 = TREE / 0.55; [I.x, I.z] = at(ai, re - 62 - I.R);
  const B = { a: E, b: at(ai, re - 66), ya: Ey, yb: I.y, w: 3.6 };
  const deckAt = (x, z) => {
    const dx = B.b[0] - B.a[0], dz = B.b[1] - B.a[1], L2 = dx * dx + dz * dz, t = ((x - B.a[0]) * dx + (z - B.a[1]) * dz) / L2;
    if (t < -0.02 || t > 1.02) return null;
    if (Math.hypot(x - (B.a[0] + dx * t), z - (B.a[1] + dz * t)) > B.w / 2) return null;
    return B.ya + (B.yb - B.ya) * t - Math.sin(Math.max(0, Math.min(1, t)) * Math.PI) * 1.2;
  };
  // le treillis de racines sur le gouffre : on y marche tant que la descente est fermée
  const netY = ground(...at(0.3, R_ABYSS + 60)) - 9;

  /* --- les formes --- */
  // l'île, l'arbre-mère et ses fleurs d'or
  const isl = merge([paint(lump(1, { sx: I.R, sy: I.R * 1.7, sz: I.R, top: 0, lumpy: 0.3, seed: 7, detail: 3 }), '#a8b0b8', '#4a5468', 0.12),
    paint(lump(1, { sx: I.R * 1.03, sy: 0.6, sz: I.R * 1.03, lumpy: 0.1, seed: 8, detail: 3 }).translate(0, -0.25, 0), '#7fd090', '#4a9a5a'),
    ...Array.from({ length: 10 }, (_, k) => { const b = r() * TAU, rr = I.R * 0.7 * r(); return paint(tube([[Math.cos(b) * rr, -I.R * 0.9, Math.sin(b) * rr], [Math.cos(b) * rr * 1.2, -I.R * 2 - r() * 20, Math.sin(b) * rr * 1.2], [Math.cos(b) * rr * 0.8, -I.R * 3 - r() * 40, Math.sin(b) * rr * 0.8]], 1.2, 0.2, 6, 10), '#8a7a6a', '#5a4a42'); })]);
  const island = cast(new THREE.Mesh(isl, ink({ line: 0.9 }))); island.position.set(I.x, I.y, I.z); scene.add(island);
  const mother = cast(new THREE.Mesh(tree(77, true), ink({ line: 0.85, wind: 0.002 }))); mother.scale.setScalar(TREE); mother.position.set(I.x, I.y, I.z); mother.rotation.y = -ai; scene.add(mother);
  const bloomMat = ink({ line: 0.3, glow: st.open ? 1.4 : 0.2, color: '#ffd860', vertexColors: false });
  const bloom = new THREE.Mesh(merge(Array.from({ length: 60 }, (_, k) => { const a = r() * TAU, e = r() * 1.2; return lump(0.9 + r(), { detail: 1, seed: k }).translate(Math.cos(a) * Math.cos(e) * 18, 30 + Math.sin(e) * 14 + r() * 8, Math.sin(a) * Math.cos(e) * 18); })), bloomMat);
  bloom.position.copy(mother.position); bloom.scale.setScalar(K2); scene.add(bloom);
  const nest = [0, 1, 2].map(k => new THREE.Vector3(I.x + Math.cos(k * 2.1) * 9 * K2, I.y + (24 + k * 3) * K2, I.z + Math.sin(k * 2.1) * 9 * K2));
  // la passerelle : au crayon tant qu'elle n'est pas encrée (et on passe au travers), puis la couleur s'y répand
  const n = 30, dx = B.b[0] - B.a[0], dz = B.b[1] - B.a[1], L = Math.hypot(dx, dz), px = -dz / L, pz = dx / L;
  const P = (t, side, dy = 0) => [B.a[0] + dx * t + px * side, B.ya + (B.yb - B.ya) * t - Math.sin(t * Math.PI) * 1.2 + dy, B.a[1] + dz * t + pz * side];
  const K = [];
  for (let i = 0; i <= n; i++) { const t = i / n, a = P(t, -1.7, -0.15), b = P(t, 1.7, -0.15); K.push(paint(tube([a, b], 0.22, 0.22, 5, 2), '#c99260', '#8a5a35')); }
  for (const s of [-1.8, 1.8]) K.push(paint(tube(Array.from({ length: n + 1 }, (_, i) => P(i / n, s, 1.1)), 0.07, 0.07, 5, n * 2), '#7fc89a', '#3f8a5a'), paint(tube(Array.from({ length: n + 1 }, (_, i) => P(i / n, s, -0.35)), 0.12, 0.12, 5, n * 2), '#8a6a4a'));
  const bridgeMat = ink({ line: 0.9, fade: st.bridge ? 0 : 1 }), bridge = new THREE.Mesh(merge(K), bridgeMat); scene.add(bridge);
  const stone = new THREE.Mesh(borne(), ink({ line: 1 })); stone.position.set(E[0] - px * 3.4, Ey, E[1] - pz * 3.4); scene.add(stone);
  const inkPool = new THREE.Mesh(new THREE.CircleGeometry(0.32, 20).rotateX(-Math.PI / 2), ink({ glow: 0.6, color: '#2a2048', vertexColors: false })); inkPool.position.set(stone.position.x, Ey + 2.02, stone.position.z); scene.add(inkPool);
  // la Glaneuse, près du départ, face à lui
  const gl = new THREE.Group(), glMat = ink({ line: 1, fade: 0.45 });
  gl.add(new THREE.Mesh(glaneuse(), glMat));
  const pollenGlow = new THREE.Mesh(merge(Array.from({ length: 7 }, (_, k) => lump(0.09, { detail: 1, seed: k }).translate((r() - 0.5) * 0.3, 1.28 + r() * 0.1, -0.36 + (r() - 0.5) * 0.2))), ink({ glow: 1.4, color: '#ffd860', vertexColors: false }));
  gl.add(pollenGlow);
  const [gx, gz] = at(as + 0.007, rs + 4); gl.position.set(gx, ground(gx, gz), gz); scene.add(gl);
  const glHead = () => gl.position.clone().add(new THREE.Vector3(0, 2.1, 0));
  // les ombrelles à pollen, autour du départ
  const blooms = [];
  for (let k = 0; k < 7; k++) {
    let x, z; for (let i = 0; i < 40; i++) { [x, z] = at(as + (r() - 0.5) * 0.14, rs + (r() - 0.5) * 140); if (Math.abs(ground(x, z) - sy) < 6 && Math.hypot(x - sx, z - sz) > 25) break; }
    const u = umbrella(k * 13 + 5), g = new THREE.Group(), heart = ink({ line: 0.4, glow: st.pollen.includes(k) ? 0.1 : 1.6, color: '#ffd860' });
    g.add(cast(new THREE.Mesh(u.stem, ink({ line: 0.8 }))), cast(new THREE.Mesh(u.petals, ink({ line: 0.55, trans: 0.9, side: THREE.DoubleSide }))), new THREE.Mesh(u.heart, heart));
    g.position.set(x, ground(x, z), z); g.rotation.y = r() * TAU; scene.add(g);
    // une colonne de lumière dorée au-dessus des ombrelles à pollen : on les voit de loin (elle s'éteint une fois cueillie)
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 2.2, 26, 16, 1, true).translate(0, 13, 0), glowy({ color: '#ffd860', alpha: 0.35, add: true, soft: 1 }));
    pillar.position.copy(g.position).add(new THREE.Vector3(0, u.top[1], 0)); pillar.visible = !st.pollen.includes(k); scene.add(pillar);
    blooms.push({ k, x, z, heart, pillar, top: g.position.clone().add(new THREE.Vector3(...u.top)) });
  }
  // les trois Semeurs dorés, perdus sur la terrasse
  const seedG = seeder(), seeds = [0, 1, 2].map(k => {
    let x, z; for (let i = 0; i < 60; i++) { [x, z] = at(as + (k - 1) * 0.08 + (r() - 0.5) * 0.04, rs + (r() - 0.5) * 120); if (Math.abs(ground(x, z) - sy) < 6 && Math.hypot(x - sx, z - sz) > 70 + k * 50) break; }
    const m = new THREE.Mesh(seedG, ink({ line: 0.4, trans: 0.6, glow: 0.9, color: '#ffd860', wind: 0.08 })); m.scale.setScalar(1.6); scene.add(m);
    const done = st.delivered.includes(k);
    return { k, m, home: new THREE.Vector3(x, ground(x, z) + 2.5, z), follow: false, done, slot: done ? nest[st.delivered.indexOf(k)] : null };
  });
  // le treillis de racines sur le gouffre (il se retire quand la descente s'ouvre)
  const N = [];
  for (let k = 0; k < 40; k++) { const a = (k / 40) * TAU; N.push(paint(tube([[Math.cos(a) * (R_ABYSS + 70), netY + 12, Math.sin(a) * (R_ABYSS + 70)], [Math.cos(a + 0.2) * R_ABYSS * 0.6, netY + 1, Math.sin(a + 0.2) * R_ABYSS * 0.6], [Math.cos(a + 0.5) * 20, netY - 2, Math.sin(a + 0.5) * 20]], 3.2, 1.4, 6, 16), '#9a7a5a', '#5a4030')); }
  for (let k = 1; k <= 6; k++) { const rr = (k / 6) * R_ABYSS; N.push(paint(tube(Array.from({ length: 41 }, (_, i) => { const a = (i / 40) * TAU; return [Math.cos(a) * rr, netY - 1 + Math.sin(a * 5 + k) * 1.5, Math.sin(a) * rr]; }), 1.6, 1.6, 5, 120), '#8a6a4a', '#4a3020')); }
  const net = cast(new THREE.Mesh(merge(N), ink({ line: 0.9 }))); net.visible = !st.open; scene.add(net);

  /* --- les paroles --- */
  const LINES = {
    first: ['Encore un manteau qui descend…', 'Ici, ce qui n’est pas encré n’existe pas. Tout est au crayon, sauf ce que tu as vu.', 'Le pollen des ombrelles dorées, celles qui brillent sous une colonne de lumière, c’est de l’encre. Passe dessous pour le cueillir.', 'Avec trois gouttes, encre la passerelle : approche-toi de la borne de pierre, au bord de la terrasse, et appuie sur E.', 'De l’autre côté, sur l’île, l’arbre-mère a perdu trois Semeurs dorés. Approche-toi d’un Semeur, appuie sur E : il te suivra.', 'Quand les trois seront rentrés, la descente s’ouvrira. Et ne reste pas dans le regard du Jardinier.'],
    noInk: ['La passerelle n’est qu’un dessin. Il te faut trois gouttes d’encre.'],
    seeds: n => [`Encore ${n} Semeur${n > 1 ? 's' : ''}. Ils brillent d’or.`],
    done: ['L’arbre a parlé. La descente est ouverte.', '…', 'Je ne me souviens plus de mon nom.'],
  };
  let queue = [], qT = 0;
  const talk = lines => { queue = [...lines]; qT = 0; };
  // ce qu'il faut faire maintenant, et où : la ligne d'objectif et son repère ; la balise dorée sur la Glaneuse tant que
  // la descente n'est pas ouverte
  const mark = beacon(scene), V = (x, y, z) => new THREE.Vector3(x, y, z);
  function goal(p) {
    if (!st.met) return ['Parle à la Glaneuse, la vieille femme au panier doré', gl.position];
    if (st.open) { const a = Math.atan2(p.z, p.x); return ['La descente est ouverte : saute dans le gouffre, au centre des Jardins', V(Math.cos(a) * (R_ABYSS - 40), netY, Math.sin(a) * (R_ABYSS - 40))]; }
    if (!st.bridge && st.ink < BRIDGE_COST) { const b = blooms.filter(b => !st.pollen.includes(b.k)).sort((u, v) => Math.hypot(u.x - p.x, u.z - p.z) - Math.hypot(v.x - p.x, v.z - p.z))[0]; return [`Cueille le pollen : passe sous une ombrelle dorée, sous sa colonne de lumière (encre ${st.ink}/${BRIDGE_COST})`, b?.top ?? stone.position]; }
    if (!st.bridge) return ['Encre la passerelle : va à la borne de pierre, au bord de la terrasse, et appuie sur E', stone.position];
    if (seeds.some(s => s.follow)) return ['Emmène le Semeur sur l’île de l’arbre-mère, par la passerelle', V(I.x, I.y, I.z)];
    const s = seeds.filter(s => !s.done).sort((u, v) => u.m.position.distanceTo(p) - v.m.position.distanceTo(p))[0];
    return [`Trouve un Semeur doré, approche-toi et appuie sur E pour qu’il te suive (${st.delivered.length}/3 rentrés)`, s.m.position];
  }

  /* --- le terrain de la strate, avec l'île, la passerelle encrée et le treillis --- */
  function terrainX(x, z) {
    const t = terrain(x, z);
    if (Math.hypot(x - I.x, z - I.z) < I.R && I.y > t.h) return { h: I.y, kind: 'ground' };
    if (st.bridge) { const h = deckAt(x, z); if (h !== null && h > t.h - 0.3) return { h, kind: 'bridge' }; }
    if (!st.open && t.kind === 'void' && Math.hypot(x, z) < R_ABYSS + 70) return { h: netY, kind: 'ground' };
    return t;
  }

  /* --- ce qui se passe --- */
  let hum = 6, near = null, fadeB = st.bridge ? 0 : 1, inkDelay = 0, opening = st.open ? 1 : 0, last = 0, began = performance.now() / 1000;
  ui?.ink(st.ink, INK_MAX);
  function nearest(p) {
    const c = [];
    if (p.distanceTo(gl.position) < 6) c.push(['parler', 'gl', p.distanceTo(gl.position)]);
    if (!st.bridge && p.distanceTo(stone.position) < 6) c.push([`encrer la passerelle (${BRIDGE_COST} gouttes)`, 'bridge', p.distanceTo(stone.position)]);
    for (const s of seeds) if (!s.done && !s.follow && p.distanceTo(s.m.position) < 6) c.push(['emmener le Semeur', s, p.distanceTo(s.m.position)]);
    return c.sort((a, b) => a[2] - b[2])[0] || null;
  }
  return {
    debug: { gl, stone, I, B, seeds, blooms, st }, // pour les essais (?debug)
    colliders: [[I.x, I.z, 6], [gl.position.x, gl.position.z, 0.6], [stone.position.x, stone.position.z, 1.1]], // le tronc de l'arbre-mère, la Glaneuse, la borne
    terrain: terrainX,
    exitAt: (x, z) => st.open && exitAt(x, z),
    interact(p) {
      if (!near) return;
      const [, what] = near;
      if (what === 'gl') {
        if (!st.met) return;
        talk(st.open ? LINES.done : !st.bridge && st.ink < BRIDGE_COST ? LINES.noInk : LINES.seeds(3 - st.delivered.length));
      } else if (what === 'bridge') {
        if (st.ink < BRIDGE_COST) { ui?.say('Il manque de l’encre…', stone.position.clone().add(new THREE.Vector3(0, 3, 0)), 3); return; }
        st.ink -= BRIDGE_COST; st.bridge = true; persist(); ui?.ink(st.ink, INK_MAX);
        setTimeout(() => ui?.page('La passerelle encrée'), 2600);
        return 'encre'; // le voyageur fait le geste : il trace la passerelle au pinceau
      } else { what.follow = true; ui?.say('…', what.m.position.clone().add(new THREE.Vector3(0, 2, 0)), 1.5); }
    },
    update(t, p) {
      const dt = Math.min(0.1, last ? t - last : 0.016); last = t;
      // la première rencontre : elle parle d'elle-même quand on approche
      if (!st.met && p.distanceTo(gl.position) < 9) { st.met = true; persist(); talk(LINES.first); setTimeout(() => ui?.page('La Glaneuse'), 1200); }
      if (queue.length) { qT -= dt; if (qT <= 0) { ui?.say(queue.shift(), glHead(), 4.6); ui?.sons?.play('v-gl'); qT = 4.4; } }
      else if ((hum -= dt) <= 0 && p.distanceTo(gl.position) < 30) { hum = 26; ui?.sons?.play('j-hum', 0.5); } // elle fredonne le thème
      // elle se tourne vers le voyageur ; elle s'efface un peu plus si l'on tarde (et beaucoup quand tout est fini)
      gl.rotation.y += Math.atan2(Math.sin(Math.atan2(p.x - gl.position.x, p.z - gl.position.z) - gl.rotation.y), Math.cos(Math.atan2(p.x - gl.position.x, p.z - gl.position.z) - gl.rotation.y)) * 0.05;
      glMat.uniforms.uFade.value = st.open ? 0.85 : 0.45 + Math.min(0.35, (t - began) / 2400);
      // le pollen : passer sous une ombrelle remplit l'encrier
      for (const b of blooms) if (!st.pollen.includes(b.k) && st.ink < INK_MAX && Math.hypot(p.x - b.x, p.z - b.z) < 7) { st.pollen.push(b.k); st.ink++; persist(); ui?.ink(st.ink, INK_MAX); b.heart.uniforms.uGlow.value = 0.1; b.pillar.visible = false; ui?.say('+1 goutte d’encre', b.top, 1.6); ui?.sons?.play('j-pollen'); }
      // la passerelle encrée : la couleur s'y répand
      if (st.bridge && fadeB > 0 && (inkDelay += dt) > 0.9) { fadeB = Math.max(0, fadeB - dt * 0.5); bridgeMat.uniforms.uFade.value = fadeB; }
      // les Semeurs : ils flottent chez eux, suivent le voyageur, ou rentrent au nid de l'arbre-mère
      let follow = 0;
      for (const s of seeds) {
        let goal;
        if (s.slot) goal = s.slot;
        else if (s.follow) { goal = p.clone().add(new THREE.Vector3(Math.cos(t + s.k * 2.1) * 2.5, 2.6 + follow * 0.6, Math.sin(t + s.k * 2.1) * 2.5)); follow++;
          if (p.distanceTo(new THREE.Vector3(I.x, I.y, I.z)) < I.R + 4) { s.follow = false; s.done = true; s.slot = nest[st.delivered.length]; st.delivered.push(s.k); persist(); ui?.say(`${st.delivered.length} sur 3`, s.m.position.clone().add(new THREE.Vector3(0, 2, 0)), 2.5); } }
        else goal = s.home.clone().add(new THREE.Vector3(0, Math.sin(t * 1.3 + s.k) * 0.6, 0));
        s.m.position.lerp(goal, 1 - Math.exp(-dt * (s.follow ? 3 : 1.5))); s.m.rotation.y = t * 0.6 + s.k;
      }
      // les trois sont rentrés : l'arbre fleurit, le treillis se retire, la descente est ouverte
      if (st.delivered.length === 3 && !st.open) { st.open = true; persist(); ui?.sons?.play('n-j-t1'); ui?.say('L’arbre-mère fleurit…', mother.position.clone().add(new THREE.Vector3(0, 30 * K2, 0)), 4); setTimeout(() => ui?.page('L’arbre-mère'), 1500); setTimeout(() => ui?.page('La descente s’ouvre'), 6500); }
      if (st.open && opening < 1) { opening = Math.min(1, opening + dt / 5); bloomMat.uniforms.uGlow.value = 0.2 + opening * 1.2; net.position.y = -opening * 60; net.scale.setScalar(Math.max(0.01, 1 - opening * 0.6)); if (opening >= 1) net.visible = false; }
      // l'objectif et la balise
      { const [txt, at] = goal(p); ui?.goal(txt, at); mark.set(st.open ? null : gl.position, 2.3); mark.update(t, p); }
      // l'invite
      near = nearest(p); ui?.prompt(near ? (near[1] === 'gl' && !st.met ? null : near[0]) : null);
    },
  };
}
