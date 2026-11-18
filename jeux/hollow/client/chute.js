// THE HOLLOW — la chute d'une strate à l'autre. Le voyageur plonge dans le gouffre ; la caméra le rattrape et zoome
// sur lui pendant qu'il tombe en faisant des figures (vrille, saltos, étoile, tire-bouchon, puis il plane), dans un
// tunnel d'anneaux d'encre, de nuages et de traits de vitesse qui remontent. Le ciel passe des couleurs de la strate
// quittée à celles de la suivante, et le nom de la strate qui arrive s'écrit à l'encre. Un clic (ou Espace) abrège.
import * as THREE from 'three';
import { ink, glowy, skyMaterial, U } from './ink.js';
import { rng, paint, lump, tube, merge } from './modelage.js';

const DUR = 7.5, TAU = Math.PI * 2;
const ease = t => t * t * (3 - 2 * t);

function setupScene() {
  const s = new THREE.Scene(), r = rng(77), live = {};
  const sky = new THREE.Mesh(new THREE.SphereGeometry(900, 32, 16), skyMaterial()); sky.renderOrder = -1; s.add(sky);
  // les anneaux du tunnel : ils remontent autour du voyageur, chacun penché à sa façon
  live.rings = Array.from({ length: 14 }, (_, k) => {
    const R = 9 + r() * 9, g = new THREE.TorusGeometry(R, 0.35 + r() * 0.5, 8, 64);
    const m = new THREE.Mesh(paint(g, k % 2 ? '#ffffff' : '#e8e0f0', '#9a90b8'), ink({ line: 1 }));
    m.userData = { y: -k * 14, tilt: (r() - 0.5) * 0.5, spin: (r() - 0.5) * 0.8 }; s.add(m); return m;
  });
  // les nuages qui défilent, et des traits de vitesse (de longues tiges fines)
  live.clouds = Array.from({ length: 26 }, (_, k) => {
    const K = []; for (let i = 0; i < 4; i++) K.push(paint(lump(2 + r() * 3, { sy: 0.7, lumpy: 0.2, seed: k * 5 + i, detail: 2 }).translate((i - 1.5) * 3, r() * 1.5, (r() - 0.5) * 2), '#ffffff', '#c8d0e8'));
    const m = new THREE.Mesh(merge(K), ink({ line: 0.8 })); const a = r() * TAU, d = 14 + r() * 40;
    m.userData = { x: Math.cos(a) * d, z: Math.sin(a) * d, y: -r() * 200, sp: 30 + r() * 40 }; s.add(m); return m;
  });
  live.lines = Array.from({ length: 40 }, () => {
    const m = new THREE.Mesh(paint(tube([[0, 0, 0], [0, 6 + r() * 14, 0]], 0.05, 0.05, 4, 2), '#2a2838'), ink({ line: 0.6 })); const a = r() * TAU, d = 4 + r() * 22;
    m.userData = { x: Math.cos(a) * d, z: Math.sin(a) * d, y: -r() * 120, sp: 60 + r() * 60 }; s.add(m); return m;
  });
  // de petits débris qui tombent avec lui (feuilles, cailloux, pétales)
  live.bits = Array.from({ length: 30 }, (_, k) => {
    const m = new THREE.Mesh(paint(lump(0.15 + r() * 0.3, { detail: 0, lumpy: 0.4, seed: k }), ['#7fd090', '#ffd6e8', '#a8b0b8'][k % 3]), ink({ line: 1 }));
    m.userData = { a: r() * TAU, d: 2 + r() * 6, y: (r() - 0.5) * 10, w: (r() - 0.5) * 4 }; s.add(m); return m;
  });
  const mist = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), glowy({ color: '#ffffff', alpha: 0.9, soft: 1 })); mist.rotation.x = -Math.PI / 2; s.add(mist); live.mist = mist;
  live.sky = sky;
  return { s, live };
}

// le nom de la strate qui arrive, écrit à l'encre (le texte se dévoile de gauche à droite, avec une bavure)
function card(el, n, name) {
  el.innerHTML = `<small>Strate ${String(n).padStart(2, '0')}</small><b>${name}</b>`;
  el.classList.remove('on'); void el.offsetWidth; el.classList.add('on');
}

export function createFall(camera) {
  const { s, live } = setupScene(), el = document.getElementById('card');
  let run = null;
  const lerpLook = (A, B, k) => {
    const c = new THREE.Color(), lc = (a, b) => c.set(a).lerp(new THREE.Color(b), k).clone();
    U.uFogCol.value.copy(lc(A.fog, B.fog)); U.uSkyMid.value.copy(lc(A.skyMid, B.skyMid)); U.uSkyTop.value.copy(lc(A.skyTop, B.skyTop));
    U.uSunDir.value.set(0.3, 1, 0.2).normalize(); U.uFogDensity.value = 0.004;
  };
  return {
    get active() { return !!run; },
    // from, to : les allures des deux strates ; n : numéro de la strate qui arrive ; hero : le voyageur ; done() à la fin
    start(from, to, n, hero, done) {
      run = { t: 0, from, to, n, hero, done, skip: false, carded: false };
      s.add(hero.rig.g); hero.rig.g.position.set(0, 0, 0); hero.pose();
      U.uRevealAll.value += 10; // pendant la chute, tout est en couleur
      const skip = e => { if (run && run.t > 1.5 && (e.type === 'click' || e.code === 'Space')) run.skip = true; };
      addEventListener('click', skip); addEventListener('keydown', skip);
      run.off = () => { removeEventListener('click', skip); removeEventListener('keydown', skip); };
    },
    scene: s,
    update(dt) {
      if (!run) return;
      const R = run; R.t += dt; const t = R.skip ? DUR : R.t, k = Math.min(1, t / DUR);
      lerpLook(R.from, R.to, ease(k));
      if (!R.carded && t > 2.2) { R.carded = true; card(el, R.n, R.to.name); }
      // le décor remonte : anneaux, nuages, traits ; la brume du fond monte à la fin (on arrive)
      for (const m of live.rings) { const u = m.userData; u.y += dt * 38; if (u.y > 40) u.y -= 196; m.position.set(0, u.y, 0); m.rotation.set(Math.PI / 2 + u.tilt, 0, 0); m.rotation.z += t * u.spin; }
      for (const m of live.clouds) { const u = m.userData; u.y += dt * u.sp; if (u.y > 60) u.y -= 260; m.position.set(u.x, u.y, u.z); }
      for (const m of live.lines) { const u = m.userData; u.y += dt * u.sp; if (u.y > 40) u.y -= 160; m.position.set(u.x, u.y, u.z); }
      for (const m of live.bits) { const u = m.userData; m.position.set(Math.cos(u.a + t * 0.8) * u.d, u.y + Math.sin(t * 2 + u.a) * 0.6, Math.sin(u.a + t * 0.8) * u.d); m.rotation.set(t * u.w, t * u.w * 0.7, 0); }
      live.mist.position.y = -60 + ease(Math.max(0, (t - 5.5) / 2)) * 58;
      // les figures du voyageur
      const { g, torso, L, R: Rl, AL, AR } = R.hero.rig;
      const seg = (a, b) => ease(Math.max(0, Math.min(1, (t - a) / (b - a))));
      g.rotation.set(0, 0, 0);
      g.rotation.y = seg(0.3, 1.6) * TAU * 2;                                  // la vrille
      g.rotation.x = -0.4 + seg(1.6, 3.0) * TAU * 2 - seg(5.6, 7) * 0.2;     // deux saltos avant
      g.rotation.z = seg(4.0, 5.4) * TAU;                                     // le tire-bouchon
      const star = seg(3.0, 3.4) - seg(3.9, 4.2), glide = seg(5.4, 6.0);      // l'étoile, puis il plane
      AL.rotation.set(0, 0, -0.12 - star * 2.4 - glide * 1.3 + Math.sin(t * 9) * 0.15); AR.rotation.set(0, 0, 0.12 + star * 2.4 + glide * 1.3 - Math.sin(t * 9) * 0.15);
      L.rotation.set(Math.sin(t * 7) * 0.4 * (1 - star), 0, -star * 0.5); Rl.rotation.set(-Math.sin(t * 7) * 0.4 * (1 - star), 0, star * 0.5);
      torso.scale.set(1 + star * 0.25 + Math.sin(t * 14) * 0.05, 1, 1 + star * 0.25); // le manteau claque
      torso.rotation.x = glide * 0.9;
      // la caméra : loin au début, elle plonge vers lui, tourne autour, puis le regarde arriver d'en dessous
      const d = 22 - seg(0, 2.2) * 16 + seg(6.2, 7.5) * 6, a = t * 0.7, h = 3 - seg(5.5, 7.5) * 7;
      camera.position.set(Math.sin(a) * d, h, Math.cos(a) * d); camera.lookAt(0, 0.9, 0);
      live.sky.position.copy(camera.position);
      if (t >= DUR) { const done = R.done; R.off(); el.classList.remove('on'); U.uRevealAll.value -= 10; run = null; done(); }
    },
  };
}
