// THE HOLLOW — la chute d'une strate à l'autre. Le voyageur plonge dans la sortie ; la caméra le rattrape et zoome
// sur lui pendant qu'il tombe en faisant des figures. Chaque passage a sa propre mise en scène (son tunnel, ce qui
// défile) : vers les Brumes, des anneaux d'encre et des nuages ; vers la Forêt, des chapeaux géants qui remontent en
// luisant, des spores, des méduses d'air ; vers les Abysses, des anneaux de racines, puis l'eau : bulles, méduses, et la
// surface verte qui monte à sa rencontre ; vers les Terres organiques, des anneaux d'os (des côtes), une poussière
// laiteuse, et le fond qui devient chair. La chute elle-même est une vraie chute libre, sans pirouettes. Le ciel passe des couleurs d'une strate à l'autre, et le nom de la
// strate qui arrive s'écrit à l'encre. Un clic (ou Espace) abrège.
import * as THREE from 'three';
import { ink, glowy, skyMaterial, U } from './ink.js';
import { rng, paint, lump, tube, merge } from './modelage.js';

const DUR = 7.5, TAU = Math.PI * 2;
const ease = t => t * t * (3 - 2 * t);

/* ---------- La chute libre ---------- */
// Comme un vrai saut : il bascule en sortant, se stabilise à plat ventre (cambré, bras et jambes écartés, coudes et
// genoux pliés), le vent le fait tanguer ; il passe en piqué (bras le long du corps) pour prendre de la vitesse, se
// remet à plat pour freiner, puis se redresse pieds en bas avant l'arrivée. Aucune pirouette.
function skydive(t, rig, seg) {
  const { g, torso, L, R, AL, AR, KL, KR, EL, ER, head } = rig;
  const exit = seg(0, 1.2), track = seg(2.8, 3.4) - seg(4.6, 5.2), upright = seg(6.2, 7.2);
  const buffet = Math.sin(t * 2.3) * 0.06 + Math.sin(t * 5.1) * 0.025;
  // l'assiette du corps : debout à la sortie, à plat ventre (π/2), un peu tête en bas en piqué, debout à la fin
  g.rotation.set((Math.PI / 2) * exit * (1 - upright) + track * 0.45 + buffet, Math.sin(t * 0.4) * 0.15 * (1 - upright), Math.sin(t * 1.7) * 0.05);
  g.position.y = 0;
  // la cambrure : bassin en avant, tête relevée pour regarder le sol (puis l'horizon en se redressant)
  torso.rotation.x = -0.25 * exit * (1 - track) * (1 - upright); head.rotation.x = -0.45 * exit * (1 - upright);
  const spread = exit * (1 - track) * (1 - upright), tuck = track;
  AL.rotation.set(-0.3 * spread + 0.25 * tuck, 0, -0.1 - 1.35 * spread - 0.2 * tuck + buffet); AR.rotation.set(-0.3 * spread + 0.25 * tuck, 0, 0.1 + 1.35 * spread + 0.2 * tuck - buffet);
  EL.rotation.x = ER.rotation.x = -1.1 * spread - 0.1;
  L.rotation.set(0.25 * spread, 0, -0.32 * spread); R.rotation.set(0.25 * spread, 0, 0.32 * spread);
  KL.rotation.x = KR.rotation.x = 0.7 * spread + 0.25 * upright + 0.05;
  rig.flare(0.35 * spread + 0.15 * tuck + 0.45 * upright + Math.sin(t * 13) * 0.05); // le manteau claque au vent
}

/* ---------- Les mises en scène ---------- */
const THEMES = {
  // vers les Brumes : anneaux d'encre, nuages, traits de vitesse ; vrille, saltos, étoile, tire-bouchon, il plane
  2: {
    ring: (k, r) => { const m = new THREE.Mesh(paint(new THREE.TorusGeometry(9 + r() * 9, 0.35 + r() * 0.5, 8, 64), k % 2 ? '#ffffff' : '#e8e0f0', '#9a90b8'), ink({ line: 1 })); m.userData.flat = true; return m; },
    cloud: (k, r) => { const K = []; for (let i = 0; i < 4; i++) K.push(paint(lump(2 + r() * 3, { sy: 0.7, lumpy: 0.2, seed: k * 5 + i, detail: 2 }).translate((i - 1.5) * 3, r() * 1.5, (r() - 0.5) * 2), '#ffffff', '#c8d0e8')); return new THREE.Mesh(merge(K), ink({ line: 0.8 })); },
    line: { color: '#2a2838', glow: 0 }, bits: ['#7fd090', '#ffd6e8', '#a8b0b8'], bitsGlow: 0, mist: '#ffffff',
    tricks: skydive,
  },
  // vers la Forêt : chapeaux géants qui remontent (dessous rose qui luit), spores, fils cyan, méduses d'air ;
  // en boule, la planche, la brasse dans le vide, un rebond sur un chapeau, assis en tailleur, puis le plongeon
  3: {
    ring: (k, r) => {
      const R = 7 + r() * 9, prof = [[0, R * 0.2], [R * 0.6, R * 0.15], [R, 0], [R * 0.95, -R * 0.08], [0, -R * 0.06]];
      const cap = paint(new THREE.LatheGeometry(prof.map(([x, y]) => new THREE.Vector2(x, y)), 32), k % 2 ? '#7a5ab8' : '#5a7ad8', '#2a2a6a');
      const m = new THREE.Mesh(cap, ink({ line: 1 })), gl = new THREE.Mesh(new THREE.CircleGeometry(R * 0.9, 32).rotateX(Math.PI / 2).translate(0, -R * 0.07, 0), ink({ line: 0.2, glow: 1.6, color: '#ff8ae0', vertexColors: false }));
      const grp = new THREE.Group(); grp.add(m, gl); grp.userData.side = 6 + r() * 14; return grp;
    },
    cloud: (k, r) => { const K = []; for (let i = 0; i < 6; i++) K.push(paint(lump(0.6 + r() * 1.2, { lumpy: 0.3, seed: k * 7 + i, detail: 1 }).translate((r() - 0.5) * 5, (r() - 0.5) * 4, (r() - 0.5) * 5), r() < 0.5 ? '#ff8ae0' : '#7af0ff')); return new THREE.Mesh(merge(K), ink({ line: 0.4, glow: 1.2 })); },
    line: { color: '#4ae8f0', glow: 1.4 }, bits: ['#ff6ad8', '#7af0ff', '#b8a8ff'], bitsGlow: 1.2, mist: '#6a4aa8',
    jellies: true,
    tricks: skydive,
  },
  // vers les Abysses : des anneaux de racines (le chemin des racines), des grappes de bulles, des méduses ; la brume du
  // fond est la surface verte de l'eau
  4: {
    ring: (k, r) => {
      const K = [paint(new THREE.TorusGeometry(10 + r() * 8, 0.9 + r() * 0.8, 8, 48), '#6a4a9a', '#2a1a48')];
      for (let i = 0; i < 5; i++) { const a = r() * TAU; K.push(paint(tube([[Math.cos(a) * 11, Math.sin(a) * 11, 0], [Math.cos(a) * 13, Math.sin(a) * 13, (r() - 0.5) * 6], [Math.cos(a + 0.3) * 16, Math.sin(a + 0.3) * 16, (r() - 0.5) * 10]], 0.5, 0.1, 5, 8), '#5a4a7a', '#2a1a48')); }
      const m = new THREE.Mesh(merge(K), ink({ line: 1, glow: 0.15 })); m.userData.flat = true; return m;
    },
    cloud: (k, r) => { const K = []; for (let i = 0; i < 7; i++) K.push(lump(0.3 + r() * 0.9, { detail: 1, seed: k * 7 + i }).translate((r() - 0.5) * 3, (r() - 0.5) * 6, (r() - 0.5) * 3)); return new THREE.Mesh(merge(K), ink({ line: 0.4, trans: 0.8, glow: 0.5, color: '#e8fff8', vertexColors: false })); },
    line: { color: '#7af0e8', glow: 0.9 }, bits: ['#4ae8e0', '#e8fff4', '#ffe08a'], bitsGlow: 0.8, mist: '#2f8a84',
    jellies: true,
    tricks: skydive,
  },
  // vers les Terres organiques : des côtes d'os en anneaux brisés, des touffes de corail-poumon, la chair au fond
  5: {
    ring: (k, r) => { const m = new THREE.Mesh(paint(new THREE.TorusGeometry(10 + r() * 8, 0.8 + r() * 0.6, 10, 40, Math.PI * (1.2 + r() * 0.6)), '#fff6e8', '#d8c0a0'), ink({ line: 1, trans: 0.3 })); m.userData.flat = true; return m; },
    cloud: (k, r) => { const K = []; for (let i = 0; i < 5; i++) K.push(paint(lump(0.6 + r() * 1, { sy: 1.3, lumpy: 0.3, seed: k * 5 + i, detail: 1 }).translate((r() - 0.5) * 4, (r() - 0.5) * 3, (r() - 0.5) * 4), '#ff9a5a', '#c84a2a')); return new THREE.Mesh(merge(K), ink({ line: 0.5, trans: 0.7, glow: 0.3 })); },
    line: { color: '#e8705a', glow: 0.4 }, bits: ['#e8705a', '#fff6e8', '#d0602a'], bitsGlow: 0.3, mist: '#ead8b8',
    tricks: skydive,
  },
};

function setupScene(theme) {
  const s = new THREE.Scene(), r = rng(77), live = {};
  const sky = new THREE.Mesh(new THREE.SphereGeometry(900, 32, 16), skyMaterial()); sky.renderOrder = -1; s.add(sky); live.sky = sky;
  // ce qui remonte autour du voyageur (anneaux, ou chapeaux), chacun penché à sa façon
  live.rings = Array.from({ length: 14 }, (_, k) => { const m = theme.ring(k, r); m.userData = { ...m.userData, y: -k * 14, tilt: (r() - 0.5) * 0.5, spin: (r() - 0.5) * 0.8, a: r() * TAU }; s.add(m); return m; });
  // ce qui défile plus loin (nuages, ou grappes de spores), et des traits de vitesse
  live.clouds = Array.from({ length: 26 }, (_, k) => { const m = theme.cloud(k, r), a = r() * TAU, d = 14 + r() * 40; m.userData = { x: Math.cos(a) * d, z: Math.sin(a) * d, y: -r() * 200, sp: 30 + r() * 40 }; s.add(m); return m; });
  live.lines = Array.from({ length: 40 }, () => {
    const m = new THREE.Mesh(paint(tube([[0, 0, 0], [0, 6 + r() * 14, 0]], 0.05, 0.05, 4, 2), theme.line.color), ink({ line: 0.6, glow: theme.line.glow })); const a = r() * TAU, d = 4 + r() * 22;
    m.userData = { x: Math.cos(a) * d, z: Math.sin(a) * d, y: -r() * 120, sp: 60 + r() * 60 }; s.add(m); return m;
  });
  // de petits débris qui tombent avec lui
  live.bits = Array.from({ length: 30 }, (_, k) => {
    const m = new THREE.Mesh(paint(lump(0.15 + r() * 0.3, { detail: 0, lumpy: 0.4, seed: k }), theme.bits[k % 3]), ink({ line: 1, glow: theme.bitsGlow }));
    m.userData = { a: r() * TAU, d: 2 + r() * 6, y: (r() - 0.5) * 10, w: (r() - 0.5) * 4 }; s.add(m); return m;
  });
  // des méduses d'air qui passent (vers la Forêt)
  live.jellies = theme.jellies ? Array.from({ length: 8 }, (_, k) => {
    const K = [paint(new THREE.LatheGeometry([[0.01, 1.6], [1.1, 1.4], [1.6, 0.6], [1.5, 0], [1.1, 0.2]].map(([x, y]) => new THREE.Vector2(x, y)), 18), '#ffffff', '#c8b8ff')];
    for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU; K.push(paint(tube([[Math.cos(a), 0.2, Math.sin(a)], [Math.cos(a) * 1.1, -3, Math.sin(a) * 1.1], [Math.cos(a) * 0.7, -6, Math.sin(a) * 0.7]], 0.05, 0.02, 4, 8), '#e8d8ff')); }
    const m = new THREE.Mesh(merge(K), ink({ line: 0.4, trans: 0.7, glow: 0.5 })), a = r() * TAU, d = 9 + r() * 20;
    m.userData = { x: Math.cos(a) * d, z: Math.sin(a) * d, y: -r() * 160, sp: 10 + r() * 14, s: 1 + r() * 2 }; s.add(m); return m;
  }) : [];
  const mist = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), glowy({ color: theme.mist, alpha: 0.9, soft: 1 })); mist.rotation.x = -Math.PI / 2; s.add(mist); live.mist = mist;
  return { s, live };
}

// le nom de la strate qui arrive, écrit à l'encre (le texte se dévoile de gauche à droite, avec une bavure)
function card(el, n, name) {
  el.innerHTML = `<small>Strate ${String(n).padStart(2, '0')}</small><b>${name}</b>`;
  el.classList.remove('on'); void el.offsetWidth; el.classList.add('on');
}

export function createFall(camera) {
  const el = document.getElementById('card');
  let run = null, stage = null;
  const lerpLook = (A, B, k) => {
    const c = new THREE.Color(), lc = (a, b) => c.set(a).lerp(new THREE.Color(b), k).clone();
    U.uFogCol.value.copy(lc(A.fog, B.fog)); U.uSkyMid.value.copy(lc(A.skyMid, B.skyMid)); U.uSkyTop.value.copy(lc(A.skyTop, B.skyTop));
    U.uSunDir.value.set(0.3, 1, 0.2).normalize(); U.uFogDensity.value = 0.004;
  };
  const fall = {
    get active() { return !!run; },
    get scene() { return stage?.s; },
    // from, to : les allures des deux strates ; n : numéro de la strate qui arrive ; hero : le voyageur ; done() à la fin
    start(from, to, n, hero, done) {
      if (stage) stage.s.traverse(o => { o.geometry?.dispose(); o.material?.dispose?.(); });
      const theme = THEMES[n] || THEMES[2];
      stage = setupScene(theme);
      run = { t: 0, from, to, n, hero, done, skip: false, carded: false, theme };
      stage.s.add(hero.rig.g); hero.rig.g.position.set(0, 0, 0); hero.pose();
      U.uRevealAll.value += 10; // pendant la chute, tout est en couleur
      const skip = e => { if (run && run.t > 1.5 && (e.type === 'click' || e.code === 'Space')) run.skip = true; };
      addEventListener('click', skip); addEventListener('keydown', skip);
      run.off = () => { removeEventListener('click', skip); removeEventListener('keydown', skip); };
    },
    update(dt) {
      if (!run) return;
      const R = run, live = stage.live; R.t += dt; const t = R.skip ? DUR : R.t, k = Math.min(1, t / DUR);
      lerpLook(R.from, R.to, ease(k));
      if (!R.carded && t > 2.2) { R.carded = true; card(el, R.n, R.to.name); }
      // le décor remonte ; la brume du fond monte à la fin (on arrive)
      for (const m of live.rings) {
        const u = m.userData; u.y += dt * 38; if (u.y > 40) u.y -= 196;
        if (u.flat) { m.position.set(0, u.y, 0); m.rotation.set(Math.PI / 2 + u.tilt, 0, t * u.spin); }
        else { m.position.set(Math.cos(u.a) * u.side, u.y, Math.sin(u.a) * u.side); m.rotation.set(u.tilt, t * u.spin, 0); }
      }
      for (const m of live.clouds) { const u = m.userData; u.y += dt * u.sp; if (u.y > 60) u.y -= 260; m.position.set(u.x, u.y, u.z); m.rotation.y = t * 0.2; }
      for (const m of live.lines) { const u = m.userData; u.y += dt * u.sp; if (u.y > 40) u.y -= 160; m.position.set(u.x, u.y, u.z); }
      for (const m of live.jellies) { const u = m.userData; u.y += dt * u.sp; if (u.y > 50) u.y -= 210; m.position.set(u.x + Math.sin(t + u.x) * 2, u.y, u.z); m.scale.set(u.s, u.s * (1 + Math.sin(t * 3 + u.z) * 0.1), u.s); }
      for (const m of live.bits) { const u = m.userData; m.position.set(Math.cos(u.a + t * 0.8) * u.d, u.y + Math.sin(t * 2 + u.a) * 0.6, Math.sin(u.a + t * 0.8) * u.d); m.rotation.set(t * u.w, t * u.w * 0.7, 0); }
      live.mist.position.y = -60 + ease(Math.max(0, (t - 5.5) / 2)) * 58;
      // les figures du voyageur
      const seg = (a, b) => ease(Math.max(0, Math.min(1, (t - a) / (b - a))));
      R.hero.rig.reset(); R.theme.tricks(t, R.hero.rig, seg); R.hero.rig.scarfStep(dt);
      // la caméra : loin au début, elle plonge vers lui, tourne autour, puis le regarde arriver d'en dessous
      const d = 16 - seg(0, 2.0) * 9 + seg(6.0, 7.5) * 3, a = 0.5 + t * 0.12, h = 2 + seg(0.8, 2.4) * 4 - seg(6.0, 7.5) * 5;
      camera.position.set(Math.sin(a) * d, h, Math.cos(a) * d); camera.lookAt(0, 0.4, 0);
      live.sky.position.copy(camera.position);
      if (t >= DUR) { const done = R.done; R.off(); el.classList.remove('on'); U.uRevealAll.value -= 10; R.hero.rig.g.position.y = 0; run = null; done(); }
    },
  };
  return fall;
}
