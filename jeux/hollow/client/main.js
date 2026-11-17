// THE HOLLOW — la boucle : le rendu « encre vivante », la Strate 01, le voyageur, et la carte de ce qu'il a vu.
import * as THREE from 'three';
import { U, createPipeline } from './ink.js';
import { buildJardins } from './jardins.js';
import { createHero } from './hero.js';
import { spawn } from './terrain.js';

// Qualité : le jeu est réglé pour une machine puissante ; il se replie tout seul si les images tardent.
const PRESETS = {
  haute: { terrain: 560, trees: 95, umbrellas: 24, rocks: 650, islands: 14, falls: 9, grass: 160000, seeders: 50, dpr: 2, shadows: true },
  moyenne: { terrain: 400, trees: 65, umbrellas: 16, rocks: 400, islands: 10, falls: 7, grass: 70000, seeders: 30, dpr: 1.25, shadows: true },
  basse: { terrain: 260, trees: 35, umbrellas: 10, rocks: 200, islands: 6, falls: 5, grass: 20000, seeders: 15, dpr: 1, shadows: false },
};
const asked = new URLSearchParams(location.search).get('q');
const Q = PRESETS[asked] || (matchMedia('(pointer: coarse)').matches ? PRESETS.basse : PRESETS.haute);

const canvas = document.getElementById('view');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
renderer.autoClear = false; renderer.setClearColor('#cdeee6');
const camera = new THREE.PerspectiveCamera(52, 1, 0.3, 4000);
const scene = new THREE.Scene();
const pipe = createPipeline(renderer);

// la carte de ce que le voyageur a vu : 256 × 256 cases sur 840 m ; la couleur s'y répand autour de lui
const N = 256, seen = new Uint8Array(N * N), revealTex = new THREE.DataTexture(seen, N, N, THREE.RedFormat, THREE.UnsignedByteType);
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

const start = spawn();
const world = buildJardins(scene, Q);
const hero = createHero(scene, camera, canvas, world.colliders, start);
reveal(start[0], start[2], 70);

function resize() {
  const w = innerWidth, h = innerHeight, dpr = Math.min(devicePixelRatio || 1, Q.dpr);
  renderer.setPixelRatio(dpr); renderer.setSize(w, h, false);
  camera.aspect = w / h; camera.updateProjectionMatrix();
  pipe.setSize(w, h, dpr);
}
addEventListener('resize', resize); resize();

// R : tout montrer en couleur (pour comparer avec l'esquisse)
addEventListener('keydown', e => { if (e.code === 'KeyR') U.uRevealAll.value = U.uRevealAll.value ? 0 : 1; });
if (location.search.includes('debug')) window.hollow = { hero, U, reveal, camera, set: (x, z) => { hero.state.p.set(x, 200, z); hero.state.v.set(0, 0, 0); } };

// l'écran-titre : on entre d'un clic
const title = document.getElementById('title');
title.addEventListener('click', () => { title.classList.add('gone'); canvas.requestPointerLock?.(); });

let last = performance.now(), slow = 0, frames = 0;
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  const t = now / 1000;
  U.uTime.value = t; U.uBoil.value = t * 8; // le trait se redessine 8 fois par seconde
  hero.update(dt);
  world.update(t, hero.state.p);
  world.sky.position.copy(camera.position);
  reveal(hero.state.p.x, hero.state.p.z, 46);
  pipe.render(scene, camera, hero.state.p, Q.shadows);
  document.body.style.setProperty('--fade', hero.state.fade.toFixed(3));
  // repli automatique : si les images tardent trop longtemps, on allège (moins de pixels, moins d'herbe, plus d'ombres)
  if (++frames > 90) { slow = dt > 0.034 ? slow + 1 : Math.max(0, slow - 1); if (slow > 120) { slow = 0; Q.dpr = Math.max(0.75, Q.dpr - 0.25); if (Q.dpr <= 1) { Q.shadows = false; world.grass.count = Math.floor(world.grass.count * 0.6); } resize(); } }
}
requestAnimationFrame(frame);
