// THE HOLLOW — l'histoire de la Forêt des géants. La Veilleuse, une enfant assise sur un rocher au pied de l'Endormi,
// chante sans cesse pour qu'il ne se réveille jamais : il dort sur le seul passage vers le bas. Le voyageur récolte
// l'encre qui luit (les grappes de spores, le long de la descente), puis il choisit :
// — réveiller l'Endormi au pinceau (3 gouttes) : il se lève, le gouffre s'ouvre ; la Veilleuse se tait pour toujours ;
// — ou demander à la Veilleuse l'autre chemin : elle le lui donne, avec une graine qui luit ; c'est le chemin des
//   racines, loin, dans le coin le plus noir de la grotte. L'Endormi dort encore.
// Le choix est retenu (localStorage, « hollow-foret ») : le jeu s'en souviendra. Chaque moment fort devient une page.
import * as THREE from 'three';
import { ink, glowy } from './ink.js';
import { rng, paint, lump, tube, merge, cast, TAU } from './modelage.js';
import { save } from './ui.js';

const INK_MAX = 6, WAKE_COST = 3;

// la Veilleuse : une enfant assise, genoux repliés, un grand chapeau-champignon pour capuche, une lueur dans les mains
function veilleuseGeometry() {
  const body = paint(new THREE.LatheGeometry([[0, 0], [0.3, 0], [0.28, 0.2], [0.2, 0.5], [0.15, 0.68], [0, 0.7]].map(([x, y]) => new THREE.Vector2(x, y)), 14), '#e8d8ff', '#8a7ab8');
  const knees = paint(lump(0.16, { sx: 1.4, sy: 0.7, detail: 1 }).translate(0, 0.25, 0.2), '#d8c8f0', '#8a7ab8');
  const head = paint(new THREE.SphereGeometry(0.13, 12, 10).translate(0, 0.83, 0.02), '#f0dccc', '#c8a898');
  const hat = paint(new THREE.LatheGeometry([[0, 0.3], [0.2, 0.26], [0.36, 0.12], [0.4, 0], [0.32, -0.02], [0, 0]].map(([x, y]) => new THREE.Vector2(x, y)), 18).translate(0, 0.88, 0), '#ff6ad8', '#8a3aa8');
  const spots = [0, 1, 2, 3, 4].map(k => paint(lump(0.04, { detail: 1 }).translate(Math.cos(k * 1.3) * 0.22, 1.07 - (k % 2) * 0.05, Math.sin(k * 1.3) * 0.22), '#ffffff'));
  return merge([body, knees, head, hat, ...spots]);
}

export function createStory(scene, { floorAt, caps, exit, roots, gates, sleeper, lidY, ui }) {
  const st = Object.assign({ met: false, ink: 0, spores: [], choice: null, told: false }, save.load('hollow-foret', {}));
  const persist = () => save.keep('hollow-foret', st);
  const r = rng(3303);
  gates.main = st.choice === 'eveil'; gates.roots = st.choice === 'racines';

  // la Veilleuse, sur un rocher, entre l'Endormi et le gouffre ; une petite lueur dans ses mains
  const vx = sleeper.position.x - 60, vz = sleeper.position.z + 40, vy = floorAt(vx, vz);
  const rock = cast(new THREE.Mesh(paint(lump(1, { sx: 1.4, sy: 0.8, sz: 1.2, lumpy: 0.3, detail: 2 }), '#5a4a7a', '#2a1a48'), ink({ line: 1 })));
  rock.position.set(vx, vy + 0.4, vz); scene.add(rock);
  const vMat = ink({ line: 0.9, fade: st.choice === 'eveil' ? 0.9 : 0 }), girl = new THREE.Group();
  const hands = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 8).translate(0, 0.45, 0.32), ink({ glow: 2, color: '#7af0ff', vertexColors: false }));
  girl.add(cast(new THREE.Mesh(veilleuseGeometry(), vMat)), hands);
  girl.position.set(vx, vy + 1.05, vz); girl.rotation.y = Math.atan2(sleeper.position.x - vx, sleeper.position.z - vz); scene.add(girl);
  const head = () => girl.position.clone().add(new THREE.Vector3(0, 1.6, 0));
  // son théâtre : un cercle de petits champignons qui luisent, et une flaque de lumière cyan (on la voit de loin)
  const ring = [];
  for (let k = 0; k < 22; k++) { const an = (k / 22) * TAU, rr = 9 + (k % 3) * 1.5, x = vx + Math.cos(an) * rr, z = vz + Math.sin(an) * rr, s = 0.8 + (k % 4) * 0.35; ring.push(paint(new THREE.CylinderGeometry(0.08 * s, 0.12 * s, s, 6).translate(x, floorAt(x, z) + s / 2, z), '#e8d8ff', '#8a7ab8'), paint(new THREE.SphereGeometry(0.4 * s, 10, 6, 0, TAU, 0, Math.PI / 2).scale(1, 0.6, 1).translate(x, floorAt(x, z) + s, z), '#7af0ff', '#2a8ab8')); }
  scene.add(new THREE.Mesh(merge(ring), ink({ line: 0.5, glow: 1.1, pulse: 1 })));
  const pool = new THREE.Mesh(new THREE.CircleGeometry(16, 40).rotateX(-Math.PI / 2), glowy({ color: '#4ae8f0', alpha: 0.3, add: true })); pool.position.set(vx, vy + 0.2, vz); scene.add(pool);
  // les notes de son chant, qui montent vers l'Endormi
  const notes = Array.from({ length: 6 }, (_, k) => { const m = new THREE.Mesh(paint(lump(0.12, { sy: 0.8, detail: 1 }), '#7af0ff'), ink({ line: 0.5, glow: 1.6 })); scene.add(m); return m; });

  // les grappes de spores : l'encre qui luit, le long de la descente et au pied des géants
  const sporeMat = ink({ line: 0.4, glow: 1.8, pulse: 1, color: '#ff8ae0', vertexColors: false });
  const sporeG = merge(Array.from({ length: 9 }, (_, k) => lump(0.18 + r() * 0.12, { detail: 1, seed: k }).translate((r() - 0.5) * 0.8, r() * 0.9, (r() - 0.5) * 0.8)));
  const spots = [];
  for (let k = 0; k < caps.length; k += 2) { const C = caps[k], a = r() * TAU, d = C.R * 0.5; spots.push([C.x + Math.cos(a) * d, C.y + C.dome * 0.7, C.z + Math.sin(a) * d]); }
  // au pied des géants, autour de l'Endormi (jamais dans le gouffre ni le chemin des racines)
  for (let k = 0, n = 0; k < 6 && n < 60; n++) { const a = n * 1.1, x = sleeper.position.x - 60 + Math.cos(a) * (70 + n), z = sleeper.position.z + 60 + Math.sin(a) * (70 + n); if (floorAt(x, z) < -100 || Math.hypot(x - exit.x, z - exit.z) < exit.R + 25) continue; spots.push([x, floorAt(x, z), z]); k++; }
  const clusters = spots.map((p, i) => { const m = new THREE.Mesh(sporeG, sporeMat); m.position.set(p[0], p[1] + 0.6, p[2]); m.visible = !st.spores.includes(i); scene.add(m); return { m, i }; });

  // les treillis de racines sur les deux passages fermés ; une colonne de spores marque le chemin des racines ouvert
  const weave = (G, n) => {
    const K = [], y = lidY(G);
    for (let k = 0; k < n; k++) { const a = (k / n) * TAU; K.push(paint(tube([[G.x + Math.cos(a) * (G.R + 10), y + 3, G.z + Math.sin(a) * (G.R + 10)], [G.x + Math.cos(a + 0.4) * G.R * 0.5, y - 0.5, G.z + Math.sin(a + 0.4) * G.R * 0.5], [G.x + Math.cos(a + 0.9) * 3, y - 1, G.z + Math.sin(a + 0.9) * 3]], G.R * 0.06, G.R * 0.025, 6, 12), '#6a4a9a', '#2a1a48')); }
    const m = cast(new THREE.Mesh(merge(K), ink({ line: 0.9 }))); scene.add(m); return m;
  };
  const lidMain = weave(exit, 30), lidRoots = weave(roots, 14);
  lidMain.visible = !gates.main; lidRoots.visible = !gates.roots;
  const arch = cast(new THREE.Mesh(merge(Array.from({ length: 7 }, (_, k) => { const a = (k / 7) * Math.PI - Math.PI / 2 + 0.3; return paint(tube([[roots.x + Math.cos(a) * 22, lidY(roots) - 2, roots.z + Math.sin(a) * 22], [roots.x + Math.cos(a) * 10, lidY(roots) + 14, roots.z + Math.sin(a) * 10], [roots.x - Math.cos(a) * 18, lidY(roots) - 2, roots.z - Math.sin(a) * 18]], 1.6, 0.8, 7, 16), '#5a4a7a', '#2a1a48'); })), ink({ line: 1, glow: 0.25 })));
  scene.add(arch);
  const column = new THREE.Mesh(new THREE.CylinderGeometry(6, 10, 260, 20, 1, true), glowy({ color: '#7af0ff', alpha: 0.4, add: true })); column.position.set(roots.x, lidY(roots) + 120, roots.z);
  // des spores cyan qui dansent sous l'arche, et l'arche qui luit un peu : on la trouve dans le noir
  const motes = new THREE.Mesh(merge(Array.from({ length: 40 }, (_, k) => lump(0.25, { detail: 1, seed: k }).translate((r() - 0.5) * 30, 1 + r() * 14, (r() - 0.5) * 30))), ink({ glow: 2, pulse: 1, color: '#7af0ff', vertexColors: false }));
  motes.position.set(roots.x, lidY(roots), roots.z); motes.visible = gates.roots; scene.add(motes); column.visible = gates.roots; scene.add(column);

  const LINES = {
    first: ['Chut… Il dort. Il ne doit pas se réveiller.', 'Je chante pour lui depuis… je ne sais plus. Le manteau que je portais est devenu trop grand.', 'Sous lui, il y a le passage. Le seul. Enfin… presque le seul.'],
    choice: ['Tu peux le réveiller. Il te faut de l’encre qui luit, celle des spores.', 'Mais si tu le réveilles, je n’aurai plus de chanson.', 'Ou tu peux me demander l’autre chemin. Il est long, et il est noir.'],
    roots: ['… Merci de ne pas l’avoir réveillé.', 'Le chemin des racines est là où la forêt ne s’allume jamais. Prends ça.', 'Une graine. Elle luit quand tout s’éteint.'],
    eveil: ['Non… non !', '…'],
    after: { eveil: ['…'], racines: ['Va. Je continue de chanter.'] },
  };
  let queue = [], qT = 0, sing = 0, last = 0, near = null, wake = st.choice === 'eveil' ? 1 : 0, opened = st.choice ? 1 : 0;
  const talk = lines => { queue = [...lines]; qT = 0; };
  ui?.ink(st.ink, INK_MAX);
  const base = sleeper.position.y;
  if (st.choice === 'eveil') { sleeper.position.y = base + 140; sleeper.userData.awake = true; }
  function nearest(p) {
    const c = [], d = v => p.distanceTo(v);
    if (st.met && d(girl.position) < 6) c.push([st.told && !st.choice ? 'demander l’autre chemin' : 'parler', 'girl', d(girl.position)]);
    const sb = new THREE.Vector3(sleeper.position.x, floorAt(sleeper.position.x, sleeper.position.z), sleeper.position.z);
    if (st.told && !st.choice && Math.hypot(p.x - sb.x, p.z - sb.z) < 46) c.push([`réveiller l’Endormi (${WAKE_COST} gouttes)`, 'wake', 0]);
    return c.sort((a, b) => a[2] - b[2])[0] || null;
  }
  return {
    colliders: [[vx, vz, 1.6]],
    debug: { girl, clusters, st, sleeper, caps, roots, exit },
    interact() {
      if (!near) return;
      const [, what] = near;
      if (what === 'girl') {
        if (st.choice) { talk(LINES.after[st.choice]); return; }
        if (!st.told) { st.told = true; persist(); talk(LINES.choice); return; }
        st.choice = 'racines'; persist(); gates.roots = true; talk(LINES.roots);
        setTimeout(() => ui?.page('La graine de la Veilleuse'), 2500); setTimeout(() => ui?.page('Le chemin des racines'), 7000);
        return;
      }
      if (what === 'wake') {
        if (st.ink < WAKE_COST) { ui?.say('Il manque de l’encre qui luit…', sleeper.position.clone().add(new THREE.Vector3(0, -150, 0)), 2.5); return; }
        st.ink -= WAKE_COST; ui?.ink(st.ink, INK_MAX); st.choice = 'eveil'; persist(); talk(LINES.eveil);
        setTimeout(() => ui?.page('L’Endormi se lève'), 6000);
        return 'encre';
      }
    },
    update(t, p) {
      const dt = Math.min(0.1, last ? t - last : 0.016); last = t;
      if (!st.met && p.distanceTo(girl.position) < 14) { st.met = true; persist(); talk(LINES.first); setTimeout(() => ui?.page('La Veilleuse'), 1500); }
      if (queue.length) { qT -= dt; if (qT <= 0) { ui?.say(queue.shift(), head(), 4.8); qT = 4.6; sing = 8; } } // le chant attend que la dernière réplique soit lue
      // son chant : des notes qui montent vers l'Endormi (tant qu'il dort), et quelques mots quand on est près
      const singing = st.choice !== 'eveil';
      notes.forEach((m, k) => { const f = (t * 0.18 + k / 6) % 1; m.visible = singing; m.position.lerpVectors(head(), sleeper.position.clone().add(new THREE.Vector3(0, -170, 0)), f).add(new THREE.Vector3(Math.sin(t * 2 + k) * 2, Math.sin(f * Math.PI) * 12, Math.cos(t * 1.7 + k) * 2)); m.scale.setScalar(1 + f * 2); });
      sing -= dt; if (singing && st.met && !queue.length && sing <= 0 && p.distanceTo(girl.position) < 40) { ui?.say('♪ dors, dors, le grand, la lumière veille… ♪', head(), 3.5); sing = 9; }
      hands.material.uniforms.uGlow.value = singing ? 1.6 + Math.sin(t * 3) * 0.5 : 0.1;
      // l'encre qui luit : passer dans une grappe de spores
      for (const c of clusters) if (c.m.visible && st.ink < INK_MAX && p.distanceTo(c.m.position) < 3) { c.m.visible = false; st.spores.push(c.i); st.ink++; persist(); ui?.ink(st.ink, INK_MAX); ui?.say('+1 goutte d’encre qui luit', c.m.position.clone().add(new THREE.Vector3(0, 1.5, 0)), 1.6); }
      for (const c of clusters) if (c.m.visible) c.m.rotation.y = t * 0.4 + c.i;
      // l'éveil : l'Endormi se lève lentement, l'œil s'ouvre, le treillis se retire ; la Veilleuse s'efface
      if (st.choice === 'eveil' && wake < 1) {
        wake = Math.min(1, wake + dt / 8); const e = wake * wake * (3 - 2 * wake);
        sleeper.position.y = base + e * 140; sleeper.rotation.z = Math.sin(t * 6) * 0.02 * (1 - wake); sleeper.userData.awake = wake > 0.2;
        vMat.uniforms.uFade.value = e * 0.9;
        if (wake > 0.7 && !gates.main) gates.main = true;
      }
      // un passage s'ouvre : son treillis se retire dans le sol
      if (st.choice && opened < 1) { opened = Math.min(1, opened + dt / 5); const lid = st.choice === 'eveil' ? lidMain : lidRoots; lid.position.y = -opened * 30; if (opened >= 1) lid.visible = false; }
      if (st.choice === 'racines') { column.visible = motes.visible = true; motes.rotation.y = t * 0.1; }
      if (gates.main && lidMain.visible && opened >= 1) lidMain.visible = false;
      near = nearest(p); ui?.prompt(near ? near[0] : null);
    },
  };
}
