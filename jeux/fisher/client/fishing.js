// Little Fisher : la pêche à la canne. Lancer (avec l'appât choisi), attendre la touche, ferrer, puis le moulinet :
// chaque poisson se bat à sa façon. Des ombres de poissons tournent autour des remous, et celle qui va mordre s'approche du bouchon.
import * as THREE from 'three';
import { S, fwd, right, waveH, persist } from './state.js';
import * as G from './game.js';
import { SPOTS, BAITS, FIGHTS } from './data.js';
import { SFX, startAudio } from './audio.js';
import { toast, showCatch } from './hud.js';
import { splashAt, jumpFish } from './fx.js';
import { $ } from '/shared/party.js';

export const F = { phase: 'idle' };
const LINE_N = 18, tipPos = new THREE.Vector3();
let bobber, line, lineGeo, biteShadow;
const shadows = [];

// Une ombre de poisson vue de dessus (silhouette floue)
function shadowTexture() {
  const c = document.createElement('canvas'); c.width = 64; c.height = 128;
  const g = c.getContext('2d'); g.filter = 'blur(5px)'; g.fillStyle = 'rgba(8,30,48,1)';
  g.beginPath(); g.ellipse(32, 52, 13, 34, 0, 0, 7); g.fill();
  g.beginPath(); g.moveTo(32, 80); g.lineTo(16, 116); g.lineTo(48, 116); g.closePath(); g.fill();
  return new THREE.CanvasTexture(c);
}
export function initFishing() {
  bobber = new THREE.Group();
  const top = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#e8402f' }));
  const bot = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#ffffff' }));
  const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.4, 5), new THREE.MeshStandardMaterial({ color: '#e8402f' })); stick.position.y = 0.35;
  bobber.add(top, bot, stick); bobber.visible = false; S.scene.add(bobber);
  lineGeo = new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(LINE_N * 3), 3));
  line = new THREE.Line(lineGeo, new THREE.LineBasicMaterial({ color: '#f4f4f4', transparent: true, opacity: 0.85 }));
  line.frustumCulled = false; line.visible = false; S.scene.add(line);
  const tex = shadowTexture(), geo = new THREE.PlaneGeometry(1, 2).rotateX(-Math.PI / 2);
  const make = () => { const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.32, depthWrite: false, color: '#ffffff' })); m.renderOrder = 1; m.visible = false; S.scene.add(m); return m; };
  SPOTS.forEach((p, k) => { for (let j = 0; j < 3; j++) shadows.push({ m: make(), p, r: 3 + Math.random() * 6, sp: (0.25 + Math.random() * 0.35) * (Math.random() < 0.5 ? 1 : -1), ph: Math.random() * 7, s: 0.6 + Math.random() * 1.1 }); });
  biteShadow = make();
}

const spotNear = (x, z) => SPOTS.some(p => Math.hypot(p.x - x, p.z - z) < 15);
export const castPoint = () => { const B = S.B, r = right(B.heading), f = fwd(B.heading); return { x: B.x + r.x * 9 + f.x * 2, z: B.z + r.z * 9 + f.z * 2 }; };
export const busy = () => F.phase !== 'idle';
export const bobberPos = () => bobber.position;

export function fishAction() {
  if (F.phase === 'idle') return cast();
  if (F.phase === 'bite') return startReel();
  if (F.phase === 'reel') return reelPress();
  if (F.phase === 'wait' || F.phase === 'cast') { stop(); toast('Tu remontes ta ligne.'); }
}
function cast() {
  const s = S.save;
  if (Math.abs(S.B.speed) > 2.5) return toast('Arrête le bateau pour pêcher');
  if (G.cargoFull(s)) return toast('Ta cale est pleine ! Va vendre tes poissons (ou relâches-en un).');
  const { x, z } = castPoint();
  if (S.world.heightAt(x, z) > -0.6) return toast('Trop près du bord : éloigne-toi un peu de la côte');
  const had = s.bait, bait = G.useBait(s);
  if (had && !bait) toast(`Plus de ${BAITS[had].name.toLowerCase()} : tu pêches sans appât (ça mord moins).`);
  else if (had && s.bait !== had) toast(`C’était ton dernier appât « ${BAITS[had].name} ».`);
  startAudio(); SFX.cast();
  S.boat.rodTip.getWorldPosition(tipPos);
  Object.assign(F, { phase: 'cast', t: 0, from: tipPos.clone(), tx: x, tz: z, spot: spotNear(x, z), fish: null, nibble: 0, bait, shAng: Math.random() * Math.PI * 2 });
  bobber.visible = line.visible = true;
}
function startWaiting() {
  F.phase = 'wait'; F.t = 0;
  const ctx = { zone: G.zoneAt(F.tx, F.tz), time: S.save.time, weather: S.W.kind, rod: S.save.levels.canne, lantern: S.save.levels.lanterne, bait: F.bait };
  F.fish = G.pickFish(ctx, Math.random, F.spot);
  F.delay = F.fish ? G.biteDelay(F.fish, Math.random, F.spot, F.bait) : Infinity;
}
function startReel() {
  const s = G.reelSpec(F.fish, S.save.levels.canne);
  Object.assign(F, { phase: 'reel', spec: s, hits: 0, misses: 0, needle: Math.random() * Math.PI * 2, dir: 1, arcAt: Math.random() * Math.PI * 2, flash: 0, arcScale: 1, flipIn: 1, jumpIn: 1.2 });
  $('#bite').classList.remove('on'); $('#reel').hidden = false;
  $('#reelText').textContent = FIGHTS[s.fight] || 'Appuie quand l’aiguille est dans le vert !';
  SFX.splash();
}
const angDiff = (a, b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
const arcNow = () => F.spec.arc * F.arcScale;
function reelPress() {
  const s = F.spec;
  if (angDiff(F.needle, F.arcAt) <= arcNow() / 2) {
    F.hits++; F.flash = 1; F.flashOk = true; F.arcScale = 1; SFX.hit(); splashAt(bobber.position, 0.8);
    if (F.hits >= s.hits) return landed();
    F.arcAt = F.needle + Math.PI * (0.6 + Math.random() * 0.8);
    if (F.fish.difficulty >= 3 && s.fight !== 'zigzag') F.dir *= -1;
  } else {
    F.misses++; F.flash = 1; F.flashOk = false; SFX.miss();
    if (F.misses > s.misses) { SFX.escape(); toast('Oh non… le poisson s’est échappé !'); stop(); }
  }
}
function landed() {
  const f = F.fish, res = G.landFish(S.save, f);
  jumpFish(f, bobber.position.clone());
  SFX.catch(f.rarity === 'rare' || f.rarity === 'legende');
  stop();
  showCatch(f, res, F.bait && f.bait === F.bait ? `${BAITS[F.bait].icon} Il adore cet appât !` : '');
  persist();
}
export function stop() {
  F.phase = 'idle'; bobber.visible = line.visible = biteShadow.visible = false;
  $('#bite').classList.remove('on'); $('#reel').hidden = true;
}

export function updateFishing(dt) {
  updateShadows();
  if (F.phase === 'idle') return;
  F.t += dt;
  S.boat.rodTip.getWorldPosition(tipPos);
  const wv = waveH(F.tx, F.tz);
  if (F.phase === 'cast') {
    const k = Math.min(1, F.t / 0.7);
    bobber.position.set(F.from.x + (F.tx - F.from.x) * k, F.from.y + (wv - F.from.y) * k + Math.sin(k * Math.PI) * 5, F.from.z + (F.tz - F.from.z) * k);
    if (k >= 1) { SFX.plop(); splashAt(bobber.position, 1); startWaiting(); }
  } else if (F.phase === 'wait') {
    F.nibble = Math.max(0, F.nibble - dt * 4);
    if (F.fish && Math.random() < dt * 0.35 && F.t < F.delay - 1) F.nibble = 1; // le poisson goûte l'appât
    bobber.position.set(F.tx, wv - F.nibble * 0.15, F.tz);
    if (F.t > F.delay) { F.phase = 'bite'; F.t = 0; SFX.bite(); splashAt(bobber.position, 0.7); $('#bite').classList.add('on'); }
  } else if (F.phase === 'bite') {
    bobber.position.set(F.tx + Math.sin(F.t * 40) * 0.08, wv - 0.45 + Math.sin(F.t * 25) * 0.12, F.tz);
    if (F.t > 1.35 - F.fish.difficulty * 0.09) { $('#bite').classList.remove('on'); toast('Trop tard, il a filé…'); startWaiting(); }
  } else if (F.phase === 'reel') {
    const s = F.spec;
    // chaque poisson se bat à sa façon
    let speed = s.speed;
    if (s.fight === 'course') speed *= 1 + 0.75 * Math.sin(F.t * 2.3);
    if (s.fight === 'fond') F.arcScale = Math.max(0.45, F.arcScale - dt * 0.13);
    if (s.fight === 'saut') { F.arcAt += Math.sin(F.t * 2.6) * dt * 1.8; if ((F.jumpIn -= dt) < 0) { F.jumpIn = 1 + Math.random() * 1.5; splashAt(bobber.position, 1.2); SFX.splash(); } }
    if (s.fight === 'zigzag' && (F.flipIn -= dt) < 0) { F.flipIn = 0.5 + Math.random() * 0.9; F.dir *= -1; }
    F.needle += F.dir * speed * Math.PI * 2 * dt;
    F.flash = Math.max(0, F.flash - dt * 3);
    const k = F.hits / s.hits, bx = F.tx + (S.B.x - F.tx) * k * 0.6, bz = F.tz + (S.B.z - F.tz) * k * 0.6;
    bobber.position.set(bx + Math.sin(F.t * 9) * 0.3, wv - 0.3 - (s.fight === 'fond' ? (1 - F.arcScale) * 0.6 : 0), bz + Math.cos(F.t * 7) * 0.3);
    drawReel();
  }
  // la ligne : du bout de la canne au bouchon, avec un peu de mou
  const p = lineGeo.attributes.position, sag = F.phase === 'reel' ? 0.2 : F.phase === 'cast' ? 0 : 1.2;
  for (let k = 0; k < LINE_N; k++) {
    const t = k / (LINE_N - 1);
    p.setXYZ(k, tipPos.x + (bobber.position.x - tipPos.x) * t, tipPos.y + (bobber.position.y + 0.3 - tipPos.y) * t - Math.sin(t * Math.PI) * sag, tipPos.z + (bobber.position.z - tipPos.z) * t);
  }
  p.needsUpdate = true;
}
// Ombres : autour des remous proches, et celle du poisson qui approche du bouchon
function updateShadows() {
  const B = S.B, t = S.time;
  for (const sh of shadows) {
    const near = Math.hypot(sh.p.x - B.x, sh.p.z - B.z) < 170 && S.mode === 'sail';
    sh.m.visible = near; if (!near) continue;
    const a = t * sh.sp + sh.ph, x = sh.p.x + Math.cos(a) * sh.r, z = sh.p.z + Math.sin(a) * sh.r;
    sh.m.position.set(x, waveH(x, z) + 0.03, z); sh.m.rotation.y = -a + (sh.sp > 0 ? 0 : Math.PI); sh.m.scale.setScalar(sh.s);
  }
  const f = F.fish, show = f && ((F.phase === 'wait' && F.t > F.delay - 3.5) || F.phase === 'bite');
  biteShadow.visible = !!show;
  if (show) {
    const d = F.phase === 'bite' ? 0.4 : Math.max(0.4, (F.delay - F.t) / 3.5 * 9), x = F.tx + Math.cos(F.shAng) * d, z = F.tz + Math.sin(F.shAng) * d;
    biteShadow.position.set(x, waveH(x, z) + 0.04, z); biteShadow.rotation.y = Math.PI / 2 - F.shAng;
    biteShadow.scale.setScalar(Math.max(0.6, (f.size[0] + f.size[1]) / 90)); biteShadow.material.opacity = 0.4;
  }
}
function drawReel() {
  const cv = $('#reelCanvas'), g = cv.getContext('2d'), N = cv.width, c = N / 2, R = N * 0.38, s = F.spec, arc = arcNow();
  g.clearRect(0, 0, N, N);
  g.lineCap = 'round';
  g.lineWidth = 22; g.strokeStyle = 'rgba(29,59,79,.55)'; g.beginPath(); g.arc(c, c, R, 0, 7); g.stroke();
  g.strokeStyle = F.flash && !F.flashOk ? '#ff7a59' : '#5fe08a'; g.beginPath(); g.arc(c, c, R, F.arcAt - arc / 2, F.arcAt + arc / 2); g.stroke();
  g.lineWidth = 6; g.strokeStyle = '#fff'; g.beginPath(); g.moveTo(c, c); g.lineTo(c + Math.cos(F.needle) * (R + 14), c + Math.sin(F.needle) * (R + 14)); g.stroke();
  g.fillStyle = '#fbf5e9'; g.beginPath(); g.arc(c, c, 34, 0, 7); g.fill();
  g.fillStyle = '#1d3b4f'; g.font = '700 26px Fredoka, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(`${F.hits}/${s.hits}`, c, c - 2);
  g.font = '600 15px Fredoka, sans-serif'; g.fillStyle = '#ff7a59';
  g.fillText('✕'.repeat(F.misses) + '·'.repeat(s.misses + 1 - F.misses), c, c + 22);
  if (F.flash) { g.globalAlpha = F.flash * 0.5; g.fillStyle = F.flashOk ? '#5fe08a' : '#ff7a59'; g.beginPath(); g.arc(c, c, R + 18, 0, 7); g.fill(); g.globalAlpha = 1; }
}
export function hint() {
  if (F.phase === 'wait') return F.fish ? 'Patience… <b>Espace</b> : remonter la ligne' : 'Rien ne mord ici pour l’instant… essaie un autre appât, un autre endroit ou une autre heure';
  if (F.phase === 'bite') return '<b>Espace</b> : ferrer !';
  if (F.phase === 'reel') return '<b>Espace</b> quand l’aiguille est dans le vert';
  return '';
}
