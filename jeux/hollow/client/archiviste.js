// THE HOLLOW — l'histoire de la Cité oubliée, et la fin. Quatre anneaux dorment : réveiller leur nœud au pinceau fait
// paraître un escalier de lumière, puis le pont des Archives. L'Archiviste, un personnage d'encre qui gomme les pages,
// n'a rien à demander : il t'attendait. Il se souvient de ce que tu as fait plus haut (il lit ce que le jeu a retenu).
// Les archives contiennent le dessin de chaque voyageur, et le tien est inachevé. Deux pupitres, deux fins :
// — achever ton dessin : tu remontes tout en haut, tailler les Jardins ; le Jardinier qu'on voyait au loin dès la
//   première strate, c'était le voyageur d'avant ; désormais il porte ton manteau ;
// — déchirer la page : le monde retourne à l'esquisse ; le Hollow continue sans toi.
// Retenu dans localStorage (« hollow-cite », et « hollow-fin » pour la fin choisie).
import * as THREE from 'three';
import { ink, U } from './ink.js';
import { rng, paint, lump, tube, merge, cast, TAU } from './modelage.js';
import { save } from './ui.js';

// l'Archiviste : une silhouette d'encre très haute et très mince, de longs bras, une gomme pâle dans une main
function archivisteGeometry() {
  const K = [paint(tube([[0, 0, 0], [0.1, 1.4, 0], [-0.05, 2.8, 0.05], [0, 3.4, 0]], 0.34, 0.16, 8, 14), '#141428', '#0a0a14'), paint(lump(0.26, { sy: 1.3, detail: 2 }).translate(0, 3.7, 0.03), '#141428', '#0a0a14')];
  for (const s of [-1, 1]) K.push(paint(tube([[s * 0.2, 3.2, 0], [s * 0.55, 2.4, 0.2], [s * 0.7, 1.6, 0.45], [s * 0.6, 1.1, 0.6]], 0.07, 0.04, 5, 12), '#141428'));
  K.push(paint(new THREE.BoxGeometry(0.28, 0.16, 0.12).translate(0.6, 1.02, 0.66), '#f0e8e0', '#c8b8b0')); // la gomme
  return merge(K);
}
const PUPITRE = () => merge([paint(new THREE.BoxGeometry(0.4, 1.1, 0.4).translate(0, 0.55, 0), '#3a3a7a', '#1c2440'), paint(new THREE.BoxGeometry(1.4, 0.1, 1).rotateX(-0.5).translate(0, 1.2, 0), '#6a7088', '#3a3a7a')]);

export function createStory(scene, { nodes, nodeMeshes, rings, awake, plat, ramps, start, ui, hero }) {
  const st = Object.assign({ met: false, told: false, awake: [false, false, false, false], choice: null }, save.load('hollow-cite', {}));
  const persist = () => save.keep('hollow-cite', st);
  st.awake.forEach((v, k) => { awake[k] = v; });
  if (st.awake.some(Boolean)) rings.forEach((m, k) => { if (awake[k]) m.material.uniforms.uGlow.value = 1.2; });

  // l'Archiviste, au milieu des Archives, tourné vers le pont ; deux pupitres derrière lui
  const th = ramps[3].th, ax = Math.cos(th) * 6, az = Math.sin(th) * 6;
  const arch = cast(new THREE.Mesh(archivisteGeometry(), ink({ line: 1.25 }))); arch.position.set(ax, plat.y, az); arch.rotation.y = Math.atan2(Math.cos(th), Math.sin(th)); scene.add(arch);
  const head = () => arch.position.clone().add(new THREE.Vector3(0, 4.6, 0));
  const side = new THREE.Vector3(-Math.sin(th), 0, Math.cos(th));
  const lecterns = [-1, 1].map(s => { const m = cast(new THREE.Mesh(PUPITRE(), ink({ line: 0.9 }))); m.position.set(-Math.cos(th) * 4 + side.x * s * 7, plat.y, -Math.sin(th) * 4 + side.z * s * 7); m.rotation.y = arch.rotation.y; scene.add(m); return m; });
  // ta page, sur le pupitre de gauche : à moitié dessinée (elle luit un peu) ; l'autre pupitre est vide
  const page = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.65), ink({ color: '#f4efe4', vertexColors: false, glow: 0.4, pulse: 1, side: THREE.DoubleSide, line: 0.3 }));
  page.position.copy(lecterns[0].position).add(new THREE.Vector3(0, 1.3, 0)); page.rotation.set(-Math.PI / 2 + 0.5, 0, 0); page.rotation.order = 'YXZ'; page.rotation.y = arch.rotation.y; scene.add(page);

  // ce dont il se souvient : ce que tu as fait plus haut
  const memory = () => {
    const L = [], f = save.load('hollow-foret', {}), a = save.load('hollow-abysses', {}), t = save.load('hollow-terres', {});
    if (f.choice === 'eveil') L.push('Tu as réveillé l’Endormi. La Veilleuse ne chante plus.'); else if (f.choice === 'racines') L.push('Tu as laissé dormir l’Endormi. Elle chante encore.');
    if ((a.windows || []).length >= 3) L.push('Le Plongeur a ses trois fenêtres. Il ne remontera jamais, et c’est bien.');
    if (t.choice === 'nourrir') L.push('Tu as nourri le Battement. Il se souvient de toi.'); else if (t.choice === 'taire') L.push('Tu as fait taire le Battement. Ici, on l’a entendu s’arrêter.');
    return L;
  };
  const LINES = {
    first: () => ['Te voilà.', 'Je t’attendais. Je les attends tous.', ...memory(), 'Ici, il y a le dessin de chaque voyageur. La Glaneuse, le Passeur, la Veilleuse, le Plongeur, la Greffée…', 'Et le tien. Il est inachevé.', 'Achève-le, et tu remonteras tout en haut, tailler les Jardins. C’est ce qu’a fait celui d’avant.', 'Ou déchire-le. Le Hollow t’oubliera.'],
    achever: ['…', 'Il te ressemble. Il a toujours eu ton manteau.', 'Monte. Les Jardins t’attendent.'],
    dechirer: ['…', 'Bien.', 'Personne ne t’attendra plus.'],
  };
  let queue = [], qT = 0, last = 0, near = null, end = null;
  const talk = (lines, pages = {}) => { if (!queue.length) qT = 0; queue.push(...lines.map((l, k) => [l, pages[k]])); };
  const fin = document.getElementById('fin');
  // l'écran de fin : un titre écrit à l'encre, deux lignes, et de quoi recommencer (le carnet est gardé)
  function showEnd(kind) {
    const T = kind === 'achever'
      ? ['Le Jardinier', 'Tout en haut, sur la crête des Jardins, une silhouette immense taille les arbres et regarde descendre les manteaux.', 'C’est toi, maintenant.']
      : ['La page déchirée', 'Le Hollow continue, sans toi. Plus rien ne se souvient de ton passage.', 'Quelque part en haut, un manteau vide attend le prochain voyageur.'];
    fin.innerHTML = `<small>Fin</small><h2>${T[0]}</h2><p>${T[1]}</p><p>${T[2]}</p><div><button id="fin-again">Recommencer le voyage</button><button id="fin-stay">Rester ici</button></div>`;
    fin.hidden = false; document.exitPointerLock?.();
    fin.querySelector('#fin-again').onclick = () => { for (const k of ['hollow-jardins', 'hollow-brumes', 'hollow-foret', 'hollow-abysses', 'hollow-terres', 'hollow-cite', 'hollow-strate']) localStorage.removeItem(k); location.href = location.pathname; };
    fin.querySelector('#fin-stay').onclick = () => { fin.hidden = true; };
  }
  function nearest(p) {
    const c = [];
    nodes.forEach(([x, y, z], k) => { const d = Math.hypot(p.x - x, p.z - z); if (!st.awake[k] && d < 5 && Math.abs(p.y - y) < 4) c.push(['réveiller l’anneau au pinceau', k, d]); });
    if (st.met && p.distanceTo(arch.position) < 5) c.push(['écouter l’Archiviste', 'arch', p.distanceTo(arch.position)]);
    if (st.told && !st.choice && !queue.length) { const d0 = p.distanceTo(lecterns[0].position), d1 = p.distanceTo(lecterns[1].position); if (d0 < 3.5) c.push(['achever ton dessin', 'achever', d0]); if (d1 < 3.5) c.push(['déchirer la page', 'dechirer', d1]); }
    return c.sort((a, b) => a[2] - b[2])[0] || null;
  }
  return {
    colliders: [[ax, az, 0.8], ...lecterns.map(m => [m.position.x, m.position.z, 0.9])],
    debug: { st, arch, lecterns, awake, get end() { return end; } },
    leave() { U.uRevealAll.value = 0; fin.hidden = true; },
    interact() {
      if (!near) return;
      const [, what] = near;
      if (typeof what === 'number') { // un nœud : le pinceau le réveille, l'anneau se met à tourner, l'escalier paraît
        const k = what; setTimeout(() => { st.awake[k] = awake[k] = true; persist(); }, 1600);
        ui?.say(k < 3 ? 'L’anneau s’éveille. Un escalier se dessine.' : 'Le dernier anneau s’éveille. Un pont se dessine vers le centre.', new THREE.Vector3(nodes[k][0], nodes[k][1] + 5, nodes[k][2]), 4);
        if (k === 0) setTimeout(() => ui?.page('Les anneaux attendaient'), 3500);
        return 'encre';
      }
      if (what === 'arch') { if (!queue.length) talk(st.choice ? [st.choice === 'achever' ? 'Monte. Les Jardins t’attendent.' : '…'] : LINES.first().slice(-3)); return; }
      st.choice = what; persist(); save.keep('hollow-fin', what);
      talk(LINES[what], { 1: what === 'achever' ? 'Le Jardinier' : 'La page déchirée' });
      end = { kind: what, t: 0 };
      return what === 'achever' ? 'encre' : undefined; // achever, c'est un dernier trait de pinceau
    },
    update(t, p) {
      const dt = Math.min(0.05, last ? t - last : 0.016); last = t;
      if (!st.met && p.distanceTo(arch.position) < 18) { st.met = true; persist(); const L = LINES.first(); talk(L, { 0: 'L’Archiviste', [L.indexOf('Et le tien. Il est inachevé.')]: 'Ton dessin inachevé' }); }
      if (queue.length && p.distanceTo(arch.position) < 40) { qT -= dt; if (qT <= 0) { const [l, pg] = queue.shift(); ui?.say(l, head(), 5); qT = 4.8; if (pg) setTimeout(() => ui?.page(pg), 1500); } }
      // les pupitres ne s'offrent qu'une fois qu'il a tout dit
      if (st.met && !st.told && !queue.length) { st.told = true; persist(); }
      // il gomme : sa main va et vient ; les nœuds éveillés brillent
      arch.rotation.z = Math.sin(t * 0.7) * 0.015;
      nodeMeshes.forEach((g, k) => { g.children[0].material.uniforms.uGlow.value = st.awake[k] ? 1.4 : 0.3; });
      // la fin : achever (tout prend sa couleur, la page s'achève, une lumière blanche) ou déchirer (tout retourne à l'esquisse)
      if (end) {
        end.t += dt;
        if (end.kind === 'achever') { U.uRevealAll.value = Math.min(1, end.t / 4); page.material.uniforms.uGlow.value = 0.4 + end.t * 0.5; rings.forEach(m => { m.rotation.z += dt * 0.6; }); }
        else { const k = Math.min(1, end.t / 6); page.scale.set(1, Math.max(0.02, 1 - k * 1.5), 1); scene.traverse(o => { const u = o.material?.uniforms?.uFade; if (u && o !== hero?.rig.g && !hero?.rig.g.getObjectById(o.id)) u.value = Math.max(u.value, k); }); }
        if (end.t > 10 && !queue.length && qT < 0.5 && fin.hidden && !end.shown) { end.shown = true; showEnd(end.kind); }
      }
      near = nearest(p); ui?.prompt(near && !end ? near[0] : null);
    },
  };
}
