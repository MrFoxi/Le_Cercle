// THE HOLLOW — l'histoire des Brumes éternelles. Le Passeur, un vieil homme aveugle qui devient lentement de la brume,
// attend au bord de la première île, sa lanterne éteinte. Il prend le voyageur pour quelqu'un d'autre. Il faut
// rallumer sa lanterne, puis trois Lanternes perdues sur des îles de côté, au bout de ponts qui ne sont qu'une
// esquisse : on les encre avec le rouge des trompettes (passer tout près d'une grande trompette remplit l'encrier).
// Quand les trois brûlent, la brume se retire du Puits. Tout est retenu ; chaque moment fort devient une page.
import * as THREE from 'three';
import { ink, glowy } from './ink.js';
import { rng, paint, lump, tube, merge, cast, TAU } from './modelage.js';
import { save } from './ui.js';

const INK_MAX = 6, BRIDGE_COST = 2, LAMP_COST = 1;

// le Passeur : très grand et maigre, une longue cape grise qui s'effiloche en brume, un bandeau sur les yeux, un bâton
function passeurGeometry() {
  const cape = paint(new THREE.LatheGeometry([[0, 0], [0.42, 0], [0.5, 0.25], [0.36, 0.9], [0.27, 1.5], [0.2, 1.8], [0, 1.86]].map(([x, y]) => new THREE.Vector2(x, y)), 18), '#c8ccd8', '#6a7088');
  const hood = paint(new THREE.SphereGeometry(0.21, 14, 10, 0, TAU, 0, 1.9).scale(1, 1.2, 1).translate(0, 1.98, -0.03), '#b8bccc', '#8a8ea0');
  const face = paint(new THREE.SphereGeometry(0.14, 12, 10).scale(1, 1.15, 1).translate(0, 1.95, 0.06), '#d8c8c0', '#a89890');
  const band = paint(new THREE.TorusGeometry(0.14, 0.025, 6, 18).translate(0, 1.99, 0.07).scale(1, 1, 0.9), '#f0eadc');
  const beard = paint(lump(0.13, { sy: 1.6, sz: 0.6, lumpy: 0.3, detail: 1 }).translate(0, 1.76, 0.13), '#e8e4ec', '#a8a4b0');
  const staff = paint(tube([[0.42, 0, 0.18], [0.46, 1.2, 0.16], [0.44, 2.3, 0.14], [0.3, 2.55, 0.14]], 0.03, 0.025, 5, 6), '#7a6a5a', '#4a3a30');
  return merge([cape, hood, face, band, beard, staff]);
}
// une Lanterne : un poteau de bois tordu, un crochet, une cage de verre ; la flamme est à part (elle s'allume)
function lanternGeometry(h = 3.2) {
  const pole = paint(tube([[0, 0, 0], [0.1, h * 0.5, 0.05], [-0.05, h, 0], [0.5, h + 0.25, 0]], 0.08, 0.05, 6, 10), '#8a7a6a', '#4a3a30');
  const cage = paint(new THREE.CylinderGeometry(0.18, 0.22, 0.42, 8, 1, true).translate(0.5, h - 0.3, 0), '#3a3848');
  const cap = paint(new THREE.ConeGeometry(0.26, 0.2, 8).translate(0.5, h - 0.02, 0), '#3a3848');
  return merge([pole, cage, cap]);
}

export function createStory(scene, { islands, bridges, exit, hole, horns, topAt, ui }) {
  const st = Object.assign({ met: false, ink: 0, own: false, lamps: [], bridges: [], tapped: [], done: false }, save.load('hollow-brumes', {}));
  const persist = () => save.keep('hollow-brumes', st);
  const r = rng(2202), up = new THREE.Vector3(0, 1, 0);
  for (const i of st.bridges) { bridges[i].inked = true; bridges[i].mat.uniforms.uFade.value = 0; }
  exit.open = st.done;

  // le Passeur, au bord de la première île, face au premier pont
  const I0 = islands[0], I1 = islands[1], dir = Math.atan2(I1.z - I0.z, I1.x - I0.x);
  const px = I0.x + Math.cos(dir) * I0.R * 0.62 + Math.cos(dir + 1.4) * 6, pz = I0.z + Math.sin(dir) * I0.R * 0.62 + Math.sin(dir + 1.4) * 6;
  const pMat = ink({ line: 0.9, fade: 0.3 }), passeur = new THREE.Group();
  passeur.add(cast(new THREE.Mesh(passeurGeometry(), pMat)));
  passeur.position.set(px, topAt(I0, px, pz) ?? I0.y, pz); passeur.rotation.y = Math.PI / 2 - dir; scene.add(passeur);
  // la brume qui s'en échappe : des voiles qui montent de sa cape
  const wisps = Array.from({ length: 5 }, () => { const m = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.9), glowy({ color: '#ffffff', alpha: 0.5 })); scene.add(m); return m; });
  const head = () => passeur.position.clone().add(new THREE.Vector3(0, 2.5, 0));

  // les Lanternes : celle du Passeur à côté de lui, et trois sur des îles de côté (au bout d'un pont en esquisse)
  const lamp = (x, y, z, ry) => {
    const g = new THREE.Group(), flameMat = ink({ line: 0.3, glow: 0.05, color: '#ffb84a', vertexColors: false });
    g.add(cast(new THREE.Mesh(lanternGeometry(), ink({ line: 0.9 }))), new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8).scale(1, 1.5, 1).translate(0.5, 2.92, 0), flameMat));
    const halo = new THREE.Mesh(new THREE.SphereGeometry(4, 16, 10), glowy({ color: '#ffcf7a', alpha: 0, add: true })); halo.position.set(0.5, 2.9, 0); g.add(halo);
    g.position.set(x, y, z); g.rotation.y = ry; scene.add(g);
    return { g, flameMat, halo, top: new THREE.Vector3(x, y + 3.4, z) };
  };
  const own = lamp(px + Math.cos(dir + 1.6) * 2.4, passeur.position.y, pz + Math.sin(dir + 1.6) * 2.4, -dir);
  const sideB = bridges.map((B, i) => ({ B, i })).filter(o => o.B.sketch);
  const picks = [0, Math.floor(sideB.length / 2), sideB.length - 1].map(k => sideB[k]);
  const lamps = picks.map(({ B }, k) => { const I = B.to; return { k, I, B, ...lamp(I.x, topAt(I, I.x, I.z) ?? I.y, I.z, r() * TAU) }; });
  const light = (L, on) => { L.flameMat.uniforms.uGlow.value = on ? 2.2 : 0.05; L.halo.material.uniforms.uAlpha.value = on ? 0.35 : 0; };
  light(own, st.own); for (const L of lamps) light(L, st.lamps.includes(L.k));
  // un fanion d'encre au départ de chaque pont en esquisse : on voit où encrer
  const marks = sideB.map(({ B, i }) => { const m = new THREE.Mesh(paint(new THREE.ConeGeometry(0.25, 0.8, 6).translate(0, 0.4, 0), '#d84a5a', '#8a2a38'), ink({ line: 0.6, glow: 0.4 })); m.position.set(B.a[0], B.ya, B.a[1]); m.visible = !B.inked; scene.add(m); return { m, B, i }; });
  // le bouchon de brume sur le Puits, tant qu'il est fermé
  const lid = new THREE.Group();
  for (let k = 0; k < 4; k++) { const m = new THREE.Mesh(new THREE.CircleGeometry(hole * (1.05 - k * 0.12), 40).rotateX(-Math.PI / 2), glowy({ color: '#ffffff', alpha: 0.75 - k * 0.12, soft: 0.6 })); m.position.y = 0.4 + k * 1.6; lid.add(m); }
  lid.position.set(exit.x, exit.y, exit.z); lid.visible = !st.done; scene.add(lid);

  const LINES = {
    first: ['… Tu es revenu ? Je reconnais ce pas.', 'Non. Tu n’es pas lui. Lui portait mon manteau.', 'Ma lanterne s’est éteinte. Je n’y vois plus, mais elle, elle voyait pour moi.', 'Le rouge des trompettes, c’est de l’encre. Ramène-la-moi.'],
    lamps: n => [`Il reste ${n} lanterne${n > 1 ? 's' : ''} éteinte${n > 1 ? 's' : ''}, sur les îles où les ponts ne sont que des rêves.`, 'Dessine les ponts. Puis rallume-les. La brume a peur du feu.'],
    own: ['Ah… la chaleur. Merci.', 'Trois autres se sont éteintes, là-bas, sur les îles de côté. Tant qu’elles dorment, le Puits reste fermé.'],
    done: ['Elles brûlent toutes. La brume se retire.', 'Va. Ne te retourne pas : moi, je me suis retourné.', '…'],
  };
  let queue = [], qT = 0;
  const talk = lines => { queue = [...lines]; qT = 0; };

  let near = null, last = 0, began = performance.now() / 1000, opening = st.done ? 1 : 0;
  ui?.ink(st.ink, INK_MAX);
  const spend = (n, at) => { if (st.ink < n) { ui?.say('Il manque de l’encre rouge…', at, 2.5); return false; } st.ink -= n; ui?.ink(st.ink, INK_MAX); return true; };
  function nearest(p) {
    const c = [], d = v => p.distanceTo(v);
    if (d(passeur.position) < 6 && st.met) c.push(['parler', 'p', d(passeur.position) + 3]); // agir passe avant parler
    if (st.met && !st.own && d(own.g.position) < 5) c.push([`rallumer la lanterne du Passeur (${LAMP_COST} goutte)`, 'own', d(own.g.position)]);
    for (const M of marks) if (!M.B.inked) { const v = new THREE.Vector3(M.B.a[0], M.B.ya, M.B.a[1]); if (d(v) < 5) c.push([`encrer le pont (${BRIDGE_COST} gouttes)`, M, d(v)]); }
    for (const L of lamps) if (!st.lamps.includes(L.k) && d(L.g.position) < 5) c.push([`rallumer la Lanterne (${LAMP_COST} goutte)`, L, d(L.g.position)]);
    return c.sort((a, b) => a[2] - b[2])[0] || null;
  }
  return {
    colliders: [[passeur.position.x, passeur.position.z, 0.6], [own.g.position.x, own.g.position.z, 0.3], ...lamps.map(L => [L.g.position.x, L.g.position.z, 0.3])],
    debug: { passeur, own, lamps, marks, st },
    interact() {
      if (!near) return;
      const [, what] = near;
      if (what === 'p') { talk(st.done ? LINES.done : !st.own ? LINES.first.slice(2) : LINES.lamps(3 - st.lamps.length)); return; }
      if (what === 'own') { if (!spend(LAMP_COST, own.top)) return; st.own = true; persist(); light(own, true); setTimeout(() => talk(LINES.own), 1500); setTimeout(() => ui?.page('La lanterne du Passeur'), 2200); return 'encre'; }
      if (what.B && what.m) { if (!spend(BRIDGE_COST, what.m.position.clone().add(new THREE.Vector3(0, 2, 0)))) return; what.B.inked = true; what.m.visible = false; st.bridges.push(what.i); persist(); what.fading = 1; return 'encre'; }
      if (what.flameMat) {
        if (!spend(LAMP_COST, what.top)) return;
        st.lamps.push(what.k); persist(); light(what, true); ui?.say(`${st.lamps.length} sur 3`, what.top, 2.5);
        if (st.lamps.length === 1) setTimeout(() => ui?.page('Une Lanterne perdue'), 2000);
        return 'encre';
      }
    },
    update(t, p) {
      const dt = Math.min(0.1, last ? t - last : 0.016); last = t;
      if (!st.met && p.distanceTo(passeur.position) < 10) { st.met = true; persist(); talk(LINES.first); setTimeout(() => ui?.page('Le Passeur'), 1200); }
      if (queue.length) { qT -= dt; if (qT <= 0) { ui?.say(queue.shift(), head(), 4.8); qT = 4.6; } }
      // il tourne la tête vers le bruit des pas ; il devient brume avec le temps (et presque tout à la fin)
      const want = Math.atan2(p.x - passeur.position.x, p.z - passeur.position.z);
      passeur.rotation.y += Math.atan2(Math.sin(want - passeur.rotation.y), Math.cos(want - passeur.rotation.y)) * 0.03;
      pMat.uniforms.uFade.value = st.done ? 0.85 : 0.3 + Math.min(0.4, (t - began) / 3000);
      wisps.forEach((w, k) => { const f = (t * 0.15 + k / 5) % 1; w.position.copy(passeur.position).add(new THREE.Vector3(Math.sin(k * 2 + t * 0.3) * 0.4, 0.4 + f * 2.6, Math.cos(k * 2 + t * 0.3) * 0.4)); w.lookAt(p.x, w.position.y, p.z); w.material.uniforms.uAlpha.value = 0.45 * (1 - f); });
      // l'encre rouge : passer tout près d'une grande trompette
      if (st.ink < INK_MAX) horns.forEach((h, i) => { if (h[3] > 4 && !st.tapped.includes(i) && Math.hypot(p.x - h[0], p.z - h[2]) < 1.6 + h[3] * 0.12 && Math.abs(p.y - (h[1] - h[3])) < 4 && st.ink < INK_MAX) { st.tapped.push(i); st.ink++; persist(); ui?.ink(st.ink, INK_MAX); ui?.say('+1 goutte d’encre rouge', new THREE.Vector3(h[0], h[1] + 1, h[2]), 1.6); } });
      // un pont encré : la couleur s'y répand après le trait de pinceau
      for (const M of marks) if (M.fading !== undefined && M.fading > 0) { M.fading -= dt * 0.5; M.B.mat.uniforms.uFade.value = Math.max(0, Math.min(1, M.fading + 0.45)); if (M.fading <= -0.45) { M.fading = undefined; if (st.bridges.length === 1) ui?.page('Un pont dessiné'); } }
      // les Lanternes allumées vacillent
      for (const L of [own, ...lamps]) if (L.flameMat.uniforms.uGlow.value > 1) L.flameMat.uniforms.uGlow.value = 2 + Math.sin(t * 9 + L.g.position.x) * 0.3;
      // les trois brûlent : le Puits s'ouvre
      if (st.lamps.length === 3 && !st.done) { st.done = true; exit.open = true; persist(); talk(LINES.done); setTimeout(() => ui?.page('Le Puits s’ouvre'), 4000); }
      if (st.done && opening < 1) { opening = Math.min(1, opening + dt / 4); lid.children.forEach((m, k) => (m.material.uniforms.uAlpha.value = (0.75 - k * 0.12) * (1 - opening))); lid.position.y = exit.y - opening * 20; if (opening >= 1) lid.visible = false; }
      near = nearest(p); ui?.prompt(near ? near[0] : null);
    },
  };
}
