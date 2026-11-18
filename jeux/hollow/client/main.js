// THE HOLLOW — la boucle : le rendu « encre vivante », les strates (une à la fois en mémoire), le voyageur, la chute
// d'une strate à l'autre, et la carte de ce qu'il a vu. La strate atteinte la plus profonde est retenue.
import * as THREE from 'three';
import { U, createPipeline, setLook, ink, glowy } from './ink.js';
import { paint, lump } from './modelage.js';
import { createHero } from './hero.js';
import { createFall } from './chute.js';
import { createUI } from './ui.js';

// les strates, de haut en bas ; celles qui n'ont pas encore de module arrivent plus tard
const STRATES = [
  { n: 1, name: 'Les Jardins suspendus', load: () => import('./jardins.js') },
  { n: 2, name: 'Les Brumes éternelles', load: () => import('./brumes.js') },
  { n: 3, name: 'La Forêt des géants', load: () => import('./foret.js') },
  { n: 4, name: 'Les Abysses engloutis', load: () => import('./abysses.js') },
  { n: 5, name: 'Les Terres organiques', load: () => import('./terres.js') },
  { n: 6, name: 'La Cité oubliée', load: () => import('./cite.js') }, ];

// Qualité : le jeu est réglé pour une machine puissante ; il se replie tout seul si les images tardent.
const PRESETS = {
  haute: { trees: 1500, umbrellas: 260, rocks: 5000, arches: 34, islands: 70, falls: 40, grass: 160000, grassRadius: 110, seeders: 400, lanterns: 22, algae: 7000, phares: 40, rays: 160, flock: 220, vines: 420, shrooms: 1400, sensitives: 600, jellies: 90, spores: 3000, porters: 16, dpr: 2, shadows: true },
  moyenne: { trees: 900, umbrellas: 160, rocks: 2600, arches: 24, islands: 45, falls: 28, grass: 70000, grassRadius: 75, seeders: 200, lanterns: 14, algae: 4000, phares: 28, rays: 110, flock: 140, vines: 260, shrooms: 800, sensitives: 380, jellies: 60, spores: 1800, porters: 12, dpr: 1.25, shadows: true },
  basse: { trees: 450, umbrellas: 80, rocks: 1200, arches: 14, islands: 25, falls: 18, grass: 20000, grassRadius: 45, seeders: 80, lanterns: 8, algae: 1600, phares: 16, rays: 60, flock: 70, vines: 140, shrooms: 400, sensitives: 200, jellies: 30, spores: 800, porters: 8, dpr: 1, shadows: false },
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
const hero = createHero(camera, canvas), fall = createFall(camera), ui = createUI(camera, canvas);

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
  if (world) { world.leave?.(); scene.remove(hero.rig.g); dispose(scene); } // leave : ce que la strate doit arrêter (un son)
  scene = new THREE.Scene(); cur = S;
  ui.clear(); world = mod.create(scene, Q, { ui, hero });
  seen.fill(0); revealTex.needsUpdate = true; reveal(world.start[0], world.start[2], 70);
  if (place) { setLook(world.look); hero.enter(scene, world); U.uRevealAll.value = gardener() ? 1 : 0; }
  column = motes = null; if (gardener()) celebrate(n); // la fête du voyage achevé (sinon, rien)
  if (world.hint) setTimeout(() => toast(world.hint), 4000); // ce qui change dans cette strate (la nage, par exemple)
  save(n);
  document.title = `The Hollow · Strate ${String(n).padStart(2, '0')}`;
}
// le voyage achevé (« achever » à la fin de la Cité) : le Hollow brille de tous ses feux, plus besoin d'encre ; une fête
// de lumière autour du voyageur, et à l'arrivée de chaque strate (sauf la première) une colonne dorée qui fait remonter
const gardener = () => { try { return JSON.parse(localStorage.getItem('hollow-fin')) === 'achever'; } catch { return false; } };
let column = null, motes = null;
function celebrate(n) {
  const [x0, , z0] = world.start, x = x0 + 14, z = z0, y = world.swim ? world.start[1] - 40 : world.terrain(x, z).h;
  if (n > 1) {
    const g = new THREE.Group(); g.position.set(x, y, z);
    g.add(new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 260, 24, 1, true).translate(0, 130, 0), glowy({ color: '#ffd860', alpha: 0.45, add: true, soft: 1 })));
    g.add(new THREE.Mesh(new THREE.RingGeometry(2.2, 3.2, 40).rotateX(-Math.PI / 2).translate(0, 0.1, 0), glowy({ color: '#ffe8a0', alpha: 0.8, add: true, soft: 0.2 })));
    scene.add(g); column = { g, armed: false, n };
  } else column = null;
  motes = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.22, 0.22), glowy({ color: '#ffd860', alpha: 0.9, add: true, soft: 0.2 }), 260); motes.frustumCulled = false; scene.add(motes);
  motes.userData = Array.from({ length: 260 }, () => [Math.random() * 80 - 40, Math.random() * 30, Math.random() * 80 - 40, Math.random() * 6.28]);
}
const m4 = new THREE.Matrix4(), q0 = new THREE.Quaternion(), s1 = new THREE.Vector3(), p1 = new THREE.Vector3();
function party(t) {
  if (!motes) return;
  const h = hero.state.p;
  motes.userData.forEach(([x, y, z, ph], i) => motes.setMatrixAt(i, m4.compose(p1.set(h.x + x + Math.sin(t * 0.3 + ph) * 3, h.y + ((y + t * 1.2) % 30) - 4, h.z + z + Math.cos(t * 0.25 + ph) * 3), q0.setFromEuler(new THREE.Euler(0, t + ph, 0)), s1.setScalar(0.6 + Math.sin(t * 3 + ph) * 0.4))));
  motes.instanceMatrix.needsUpdate = true;
  // la colonne : il faut d'abord s'en éloigner (on arrive à côté), puis y entrer
  if (column && !falling && !fall.active) {
    const d = Math.hypot(h.x - column.g.position.x, h.z - column.g.position.z);
    if (d > 8) column.armed = true;
    if (column.armed && d < 2.4 && Math.abs(h.y - column.g.position.y) < 8) travel(STRATES[column.n - 2], true);
  }
}
// sauter dans la sortie : la chute, puis la strate suivante (ou un mot si elle n'est pas encore dessinée) ; une strate
// peut dire où l'on tombe (next : le vide de la Cité, une fois la fin choisie, ramène tout en haut)
let falling = false;
function descend() {
  world.onExit?.();
  travel(STRATES[(world.next?.() ?? cur.n + 1) - 1], false);
}
// aller vers une autre strate : en tombant (up = false), ou en remontant par la colonne de lumière (up = true)
function travel(next, up) {
  if (!next?.load) { toast(`Strate ${String(cur.n + 1).padStart(2, '0')} — ${next?.name ?? '?'} : elle se dessine encore…`); hero.state.p.copy(hero.state.safe); hero.state.v.set(0, 0, 0); hero.state.exit = false; hero.state.fade = 1; return; }
  falling = true;
  const from = world.look;
  next.load().then(mod => {
    scene.remove(hero.rig.g);
    let built = null;
    // à la fin de la chute (ou dès que la strate est prête, si elle a tardé), on pose le voyageur à son départ
    fall.start(from, mod.LOOK, next.n, hero, () => built.then(() => { setLook(world.look); hero.enter(scene, world, !up); U.uRevealAll.value = gardener() ? 1 : 0; falling = false; }), up);
    // la strate suivante se construit pendant la chute
    built = new Promise(res => setTimeout(() => enter(next.n, false).then(res), 300));
  });
}
// l'impact de l'arrivée : deux ondes d'encre qui courent sur le sol, et des bouffées de la couleur de la brume qui s'écartent
const fx = [];
hero.onLand = p => {
  const col = '#' + U.uFogCol.value.clone().lerp(new THREE.Color('#ffffff'), 0.5).getHexString();
  for (const [k, delay] of [[0, 0], [1, 0.18]]) {
    const ring = new THREE.Mesh(paint(new THREE.TorusGeometry(1, 0.07 - k * 0.03, 6, 64).rotateX(Math.PI / 2), '#2a2838'), ink({ line: 1 }));
    ring.position.set(p.x, p.y + 0.15, p.z); ring.visible = false; scene.add(ring);
    fx.push({ m: ring, t: -delay, life: 1.1, step(m, k2) { m.visible = true; m.scale.setScalar(1 + k2 * (16 - k * 5)); m.scale.y = 1; } });
  }
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2 + Math.random() * 0.3, puff = new THREE.Mesh(paint(lump(0.35 + Math.random() * 0.3, { detail: 2, lumpy: 0.3, seed: i }), '#ffffff', col), ink({ line: 0.5, glow: 0.35 }));
    puff.visible = false; scene.add(puff);
    const sp = 5 + Math.random() * 5, upv = 0.4 + Math.random() * 0.8;
    fx.push({ m: puff, t: 0, life: 1.4, step(m, k2) { m.visible = true; const d = 1.4 + sp * Math.sqrt(k2); m.position.set(p.x + Math.cos(a) * d, p.y + 0.15 + upv * Math.sin(k2 * Math.PI), p.z + Math.sin(a) * d); m.scale.setScalar(Math.max(0.01, 1 - k2) * (0.7 + k2 * 1.2)); } });
  }
};
function stepFX(dt) {
  for (let i = fx.length - 1; i >= 0; i--) {
    const f = fx[i]; f.t += dt;
    if (f.t < 0) continue;
    const k = f.t / f.life;
    if (k >= 1) { scene.remove(f.m); f.m.geometry.dispose(); f.m.material.dispose(); fx.splice(i, 1); continue; }
    f.step(f.m, k);
  }
}
function toast(msg) { const t = document.getElementById('toast'); t.textContent = msg; t.classList.remove('on'); void t.offsetWidth; t.classList.add('on'); }

function resize() {
  const w = innerWidth, h = innerHeight, dpr = Math.min(devicePixelRatio || 1, Q.dpr);
  renderer.setPixelRatio(dpr); renderer.setSize(w, h, false);
  camera.aspect = w / h; camera.updateProjectionMatrix();
  pipe.setSize(w, h, dpr);
}
addEventListener('resize', resize); resize();

// L'administrateur (MrFoxi, connecté sur le site) : F bascule le vol libre (on traverse tout, Maj pour filer à 220 m/s)
let admin = false;
fetch('/api/admin/me').then(r => r.json()).then(r => { admin = !!r.admin; if (admin) { toast('Administrateur : F pour voler'); warpMenu(); } }).catch(() => {});
// le menu de l'administrateur : aller tout de suite au départ de n'importe quelle strate dessinée
function warpMenu() {
  const sel = document.createElement('select'); sel.id = 'warp'; sel.title = 'Aller à une strate';
  sel.innerHTML = '<option value="">Aller à une strate…</option>' + STRATES.filter(s => s.load).map(s => `<option value="${s.n}">Strate ${String(s.n).padStart(2, '0')} — ${s.name}</option>`).join('');
  sel.onchange = async () => {
    const n = +sel.value; sel.value = ''; sel.blur(); // les touches reviennent au voyageur
    if (!n || fall.active || falling) return;
    title.classList.add('gone'); hero.setFly(false); await enter(n); toast(`Strate ${String(n).padStart(2, '0')} — ${STRATES[n - 1].name}`);
  };
  sel.addEventListener('keydown', e => e.stopPropagation());
  document.body.append(sel);
}
addEventListener('keydown', e => {
  if (e.code !== 'KeyF' || !admin || fall.active || falling) return;
  hero.setFly(!hero.state.fly);
  toast(hero.state.fly ? 'Vol libre · Espace monte, Ctrl descend, Maj très vite' : 'Vol libre coupé');
});
// E : agir (parler, encrer, emmener) ; ce que la strate propose dépend de ce qui est tout près
addEventListener('keydown', e => { if (e.code === 'KeyE' && !fall.active && !falling && world?.interact?.(hero.state.p) === 'encre') hero.play('ink'); });
// R : tout montrer en couleur (pour comparer avec l'esquisse)
addEventListener('keydown', e => { if (e.code === 'KeyR' && !fall.active) U.uRevealAll.value = U.uRevealAll.value ? 0 : 1; });
if (params.has('debug')) window.hollow = { hero, U, reveal, camera, enter, descend, arrive: () => hero.enter(scene, world, true), get world() { return world; }, set: (x, z) => { hero.state.p.set(x, 2000, z); hero.state.v.set(0, 0, 0); } };

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
  hero.update(dt); stepFX(dt); party(t);
  if (hero.state.exit) { descend(); return; }
  world.update(t, hero.state.p);
  world.sky.position.copy(camera.position);
  reveal(hero.state.p.x, hero.state.p.z, 46);
  pipe.render(scene, camera, hero.state.p, Q.shadows && world.look.shadows);
  ui.update(dt); ui.capture(); // une page du carnet se prend juste après le dessin (l'image est encore là)
  document.body.style.setProperty('--fade', hero.state.fade.toFixed(3));
  // repli automatique : si les images tardent trop longtemps, on allège (moins de pixels, plus d'ombres)
  if (++frames > 90) { slow = dt > 0.034 ? slow + 1 : Math.max(0, slow - 1); if (slow > 120) { slow = 0; Q.dpr = Math.max(0.75, Q.dpr - 0.25); if (Q.dpr <= 1) Q.shadows = false; resize(); } }
}
requestAnimationFrame(frame);
