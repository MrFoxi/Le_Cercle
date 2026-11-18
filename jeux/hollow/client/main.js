// THE HOLLOW — la boucle : le rendu « encre vivante », les strates (une à la fois en mémoire), le voyageur, la chute
// d'une strate à l'autre, et la carte de ce qu'il a vu. La strate atteinte la plus profonde est retenue.
import * as THREE from 'three';
import { U, createPipeline, setLook } from './ink.js';
import { createHero } from './hero.js';
import { createFall } from './chute.js';

// les strates, de haut en bas ; celles qui n'ont pas encore de module arrivent plus tard
const STRATES = [
  { n: 1, name: 'Les Jardins suspendus', load: () => import('./jardins.js') },
  { n: 2, name: 'Les Brumes éternelles', load: () => import('./brumes.js') },
  { n: 3, name: 'La Forêt des géants' }, { n: 4, name: 'Les Abysses engloutis' }, { n: 5, name: 'Les Terres organiques' }, { n: 6, name: 'La Cité oubliée' },
];

// Qualité : le jeu est réglé pour une machine puissante ; il se replie tout seul si les images tardent.
const PRESETS = {
  haute: { trees: 1500, umbrellas: 260, rocks: 5000, arches: 34, islands: 70, falls: 40, grass: 160000, grassRadius: 110, seeders: 400, lanterns: 22, flock: 220, dpr: 2, shadows: true },
  moyenne: { trees: 900, umbrellas: 160, rocks: 2600, arches: 24, islands: 45, falls: 28, grass: 70000, grassRadius: 75, seeders: 200, lanterns: 14, flock: 140, dpr: 1.25, shadows: true },
  basse: { trees: 450, umbrellas: 80, rocks: 1200, arches: 14, islands: 25, falls: 18, grass: 20000, grassRadius: 45, seeders: 80, lanterns: 8, flock: 70, dpr: 1, shadows: false },
};
const params = new URLSearchParams(location.search);
const Q = PRESETS[params.get('q')] || (matchMedia('(pointer: coarse)').matches ? PRESETS.basse : PRESETS.haute);
const saved = () => { try { return +localStorage.getItem('hollow-strate') || 1; } catch { return 1; } };
const save = n => { try { if (n > saved()) localStorage.setItem('hollow-strate', n); } catch { /* stockage bloqué */ } };

const canvas = document.getElementById('view');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
renderer.autoClear = false;
const camera = new THREE.PerspectiveCamera(52, 1, 0.3, 12000);
const pipe = createPipeline(renderer);
const hero = createHero(camera, canvas), fall = createFall(camera);

// la carte de ce que le voyageur a vu : 1024 × 1024 cases sur 5 km (une case = 5 m) ; remise à blanc à chaque strate
const N = 1024, seen = new Uint8Array(N * N), revealTex = new THREE.DataTexture(seen, N, N, THREE.RedFormat, THREE.UnsignedByteType);
revealTex.magFilter = revealTex.minFilter = THREE.LinearFilter; revealTex.needsUpdate = true; U.uReveal.value = revealTex;
const rect = U.uRevealRect.value;
function reveal(x, z, R) {
  const cx = ((x - rect.x) / rect.z) * N, cz = ((z - rect.y) / rect.w) * N, rc = (R / rect.z) * N;
  let changed = false;
  for (let j = Math.max(0, Math.floor(cz - rc)); j <= Math.min(N - 1, Math.ceil(cz + rc)); j++)
    for (let i = Math.max(0, Math.floor(cx - rc)); i <= Math.min(N - 1, Math.ceil(cx + rc)); i++) {
      const d = Math.hypot(i - cx, j - cz) / rc, v = Math.round(255 * Math.max(0, Math.min(1, (1 - d) / 0.4)));
      if (v > seen[j * N + i]) { seen[j * N + i] = v; changed = true; }
    }
  if (changed) revealTex.needsUpdate = true;
}

// changer de strate : on vide l'ancienne scène (tout ce qui a été fabriqué est rendu à la carte graphique)
let scene = new THREE.Scene(), world = null, cur = null;
function dispose(s) { s.traverse(o => { o.geometry?.dispose(); if (o.material && o.material !== hero.rig.torso.material) o.material.dispose?.(); }); }
async function enter(n, place = true) {
  const S = STRATES[n - 1], mod = await S.load();
  if (world) { scene.remove(hero.rig.g); dispose(scene); }
  scene = new THREE.Scene(); cur = S;
  world = mod.create(scene, Q);
  seen.fill(0); revealTex.needsUpdate = true; reveal(world.start[0], world.start[2], 70);
  if (place) { setLook(world.look); hero.enter(scene, world); }
  save(n);
  document.title = `The Hollow · Strate ${String(n).padStart(2, '0')}`;
}
// sauter dans la sortie : la chute, puis la strate suivante (ou un mot si elle n'est pas encore dessinée)
let falling = false;
function descend() {
  const next = STRATES[cur.n];
  if (!next?.load) { toast(`Strate ${String(cur.n + 1).padStart(2, '0')} — ${next?.name ?? '?'} : elle se dessine encore…`); hero.state.p.copy(hero.state.safe); hero.state.v.set(0, 0, 0); hero.state.exit = false; hero.state.fade = 1; return; }
  falling = true;
  const from = world.look;
  next.load().then(mod => {
    scene.remove(hero.rig.g);
    let built = null;
    // à la fin de la chute (ou dès que la strate est prête, si elle a tardé), on pose le voyageur à son départ
    fall.start(from, mod.LOOK, next.n, hero, () => built.then(() => { setLook(world.look); hero.enter(scene, world); falling = false; }));
    // la strate suivante se construit pendant la chute
    built = new Promise(res => setTimeout(() => enter(next.n, false).then(res), 300));
  });
}
function toast(msg) { const t = document.getElementById('toast'); t.textContent = msg; t.classList.remove('on'); void t.offsetWidth; t.classList.add('on'); }

function resize() {
  const w = innerWidth, h = innerHeight, dpr = Math.min(devicePixelRatio || 1, Q.dpr);
  renderer.setPixelRatio(dpr); renderer.setSize(w, h, false);
  camera.aspect = w / h; camera.updateProjectionMatrix();
  pipe.setSize(w, h, dpr);
}
addEventListener('resize', resize); resize();

// R : tout montrer en couleur (pour comparer avec l'esquisse)
addEventListener('keydown', e => { if (e.code === 'KeyR' && !fall.active) U.uRevealAll.value = U.uRevealAll.value ? 0 : 1; });
if (params.has('debug')) window.hollow = { hero, U, reveal, camera, enter, descend, get world() { return world; }, set: (x, z) => { hero.state.p.set(x, 2000, z); hero.state.v.set(0, 0, 0); } };

// l'écran-titre : commencer en haut, ou reprendre à la strate la plus profonde atteinte
const title = document.getElementById('title'), deep = Math.min(saved(), STRATES.filter(s => s.load).length);
const first = Math.min(+params.get('strate') || 1, STRATES.filter(s => s.load).length);
if (deep > 1) { const b = document.getElementById('resume'); b.hidden = false; b.textContent = `Reprendre : Strate ${String(deep).padStart(2, '0')} — ${STRATES[deep - 1].name}`; b.onclick = e => { e.stopPropagation(); title.classList.add('gone'); enter(deep); }; }
title.addEventListener('click', () => { title.classList.add('gone'); canvas.requestPointerLock?.(); });
await enter(first);

let last = performance.now(), slow = 0, frames = 0;
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  const t = now / 1000;
  U.uTime.value = t; U.uBoil.value = t * 8; // le trait se redessine 8 fois par seconde
  if (fall.active) { fall.update(dt); if (fall.active) pipe.render(fall.scene, camera, new THREE.Vector3(), false); return; }
  if (falling) return;
  hero.update(dt);
  if (hero.state.exit) { descend(); return; }
  world.update(t, hero.state.p);
  world.sky.position.copy(camera.position);
  reveal(hero.state.p.x, hero.state.p.z, 46);
  pipe.render(scene, camera, hero.state.p, Q.shadows && world.look.shadows);
  document.body.style.setProperty('--fade', hero.state.fade.toFixed(3));
  // repli automatique : si les images tardent trop longtemps, on allège (moins de pixels, plus d'ombres)
  if (++frames > 90) { slow = dt > 0.034 ? slow + 1 : Math.max(0, slow - 1); if (slow > 120) { slow = 0; Q.dpr = Math.max(0.75, Q.dpr - 0.25); if (Q.dpr <= 1) Q.shadows = false; resize(); } }
}
requestAnimationFrame(frame);
