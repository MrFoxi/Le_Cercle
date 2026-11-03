// Little Fisher : la plongée au harpon. Avec le masque et le harpon, on saute à l'eau (H) là où elle est claire et peu
// profonde : on nage parmi les poissons (ils fuient quand on approche), on tire au harpon (Espace) et on ouvre les huîtres
// (parfois une perle). L'oxygène dure 45 secondes ; E pour remonter.
import * as THREE from 'three';
import { S, persist, right, waveH } from './state.js';
import * as G from './game.js';
import { SFX } from './audio.js';
import { toast, showCatch, gain, catchOpen, esc } from './hud.js';
import { fishMesh, swim } from './fishmodel.js';
import { bubbles, splashAt } from './fx.js';
import { $ } from '/shared/party.js';

const O2 = 45;
const D = { yaw: 0, pitch: 0, pos: new THREE.Vector3(), vel: new THREE.Vector3(), o2: O2, zone: 'recif', shot: null, cool: 0, kick: 0, drag: null };
let diver, legs = [], gun, harpoon, cord, snow, fishes = [], oysters = [];
const dir = new THREE.Vector3(), tmp = new THREE.Vector3();

export function initDive() {
  const m = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.6, ...o });
  diver = new THREE.Group();
  const suit = m('#1f3b6b'), skin = m('#f1c9a5'), yellow = m('#f2c230');
  const add = (geo, mat, x, y, z, rx = 0) => { const o = new THREE.Mesh(geo, mat); o.position.set(x, y, z); o.rotation.x = rx; o.castShadow = true; diver.add(o); return o; };
  add(new THREE.CapsuleGeometry(0.28, 0.9, 4, 10), suit, 0, 0, 0, Math.PI / 2);
  add(new THREE.SphereGeometry(0.22, 12, 10), skin, 0, 0.05, 0.78);
  add(new THREE.BoxGeometry(0.34, 0.14, 0.12), m('#1a2a3a', { roughness: 0.1, metalness: 0.5 }), 0, 0.1, 0.95);
  add(new THREE.CylinderGeometry(0.13, 0.13, 0.7, 10), yellow, 0, 0.3, 0, Math.PI / 2);
  for (const s of [-1, 1]) {
    const leg = new THREE.Group(); leg.position.set(s * 0.13, 0, -0.55); diver.add(leg);
    const l = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.08, 0.7, 6), suit); l.rotation.x = Math.PI / 2; l.position.z = -0.35; leg.add(l);
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.03, 0.5), yellow); fin.position.z = -0.9; leg.add(fin);
    legs.push(leg);
  }
  gun = add(new THREE.CylinderGeometry(0.04, 0.04, 1.1, 6), m('#2b2b30', { metalness: 0.6 }), 0.32, -0.12, 0.75, Math.PI / 2);
  diver.visible = false; S.scene.add(diver);
  harpoon = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.4, 5).rotateX(Math.PI / 2), m('#c8ccd0', { metalness: 0.8, roughness: 0.3 }));
  harpoon.visible = false; S.scene.add(harpoon);
  cord = new THREE.Line(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3)), new THREE.LineBasicMaterial({ color: '#e8e2d0' }));
  cord.frustumCulled = false; cord.visible = false; S.scene.add(cord);
  // particules en suspension (la « neige marine »)
  const p = new Float32Array(600 * 3); for (let k = 0; k < p.length; k++) p[k] = (Math.random() - 0.5) * 40;
  snow = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(p, 3)), new THREE.PointsMaterial({ color: '#dff6ff', size: 0.06, transparent: true, opacity: 0.6 }));
  snow.visible = false; snow.frustumCulled = false; S.scene.add(snow);
  // regarder autour de soi en glissant (souris ou doigt)
  $('#view').addEventListener('pointerdown', e => { if (S.mode === 'dive' && !e.target.closest('#touch')) D.drag = { x: e.clientX, y: e.clientY }; });
  addEventListener('pointermove', e => { if (!D.drag) return; D.yaw -= (e.clientX - D.drag.x) * 0.005; D.pitch = clampPitch(D.pitch - (e.clientY - D.drag.y) * 0.004); D.drag = { x: e.clientX, y: e.clientY }; });
  addEventListener('pointerup', () => (D.drag = null));
}
const clampPitch = p => Math.max(-1.2, Math.min(1.1, p));

// Peut-on plonger ici ? (renvoie un message si non)
export function whyNot() {
  const s = S.save, B = S.B;
  if (!s.gear.harpon) return 'Il te faut un masque et un harpon : Inès en vend à Anse-Corail.';
  if (Math.abs(B.speed) > 2) return 'Arrête le bateau pour plonger.';
  const r = right(B.heading), x = B.x + r.x * 4, z = B.z + r.z * 4, depth = -S.world.heightAt(x, z), zone = G.zoneAt(x, z);
  if (!G.canDive(s, zone, depth)) return depth > 28 || zone === 'large' || zone === 'fosse' ? 'Trop profond ici : plonge dans les eaux claires du récif ou des côtes de Port-Galet.' : zone === 'cote' || zone === 'recif' ? 'Pas assez d’eau ici.' : 'L’eau est trop sombre ici : plonge au récif des Palmes ou près de Port-Galet.';
  return null;
}
export function startDive() {
  const B = S.B, r = right(B.heading);
  D.pos.set(B.x + r.x * 4, -1.4, B.z + r.z * 4); D.vel.set(0, 0, 0);
  D.yaw = B.heading; D.pitch = -0.35; D.o2 = O2; D.zone = G.zoneAt(D.pos.x, D.pos.z); D.cool = 0; D.shot = null;
  S.mode = 'dive'; S.boat.fisher.visible = false;
  diver.visible = snow.visible = true; S.world.setUnder(true);
  SFX.splash(); splashAt({ x: D.pos.x, y: 0, z: D.pos.z }, 1.6);
  for (let k = 0; k < 16; k++) spawnFish(true);
  for (let k = 0; k < 7; k++) spawnOyster();
  $('#o2').hidden = false; $('#tFish').textContent = '🎯'; $('#tAct').textContent = '⬆️';
  toast('🤿 Sous l’eau ! <b>Z/S</b> nager · <b>Q/D</b> tourner · <b>↑/↓</b> ou glisser pour regarder · <b>Espace</b> harpon · <b>E</b> remonter', 6000);
}
export function endDive(msg) {
  S.mode = 'sail'; S.boat.fisher.visible = true;
  diver.visible = snow.visible = harpoon.visible = cord.visible = false; S.world.setUnder(false);
  for (const f of fishes) S.scene.remove(f.m); fishes = [];
  for (const o of oysters) S.scene.remove(o.g); oysters = [];
  $('#o2').hidden = true; $('#tFish').textContent = '🎣'; $('#tAct').textContent = '⚓';
  SFX.splash(); splashAt({ x: D.pos.x, y: 0, z: D.pos.z }, 1.4);
  if (msg) toast(msg);
  persist();
}

function seabed(x, z) { return S.world.heightAt(x, z); }
function spawnFish(around) {
  const f = G.diveFish(D.zone); if (!f) return;
  for (let tries = 0; tries < 12; tries++) {
    const a = around ? Math.random() * Math.PI * 2 : D.yaw + (Math.random() - 0.5) * 1.6, d = around ? 4 + Math.random() * 20 : 18 + Math.random() * 10;
    const x = D.pos.x + Math.sin(a) * d, z = D.pos.z + Math.cos(a) * d, h = seabed(x, z);
    if (h > -2.2) continue;
    const m = fishMesh(f); m.scale.multiplyScalar(1.3);
    const y = h + 0.8 + Math.random() * Math.max(0.2, -h - 2);
    m.position.set(x, y, z); S.scene.add(m);
    fishes.push({ f, m, vel: new THREE.Vector3(), target: new THREE.Vector3(x, y, z), wait: 0, flee: 0 });
    return;
  }
}
function spawnOyster() {
  for (let tries = 0; tries < 20; tries++) {
    const a = Math.random() * Math.PI * 2, d = 3 + Math.random() * 22, x = D.pos.x + Math.sin(a) * d, z = D.pos.z + Math.cos(a) * d, h = seabed(x, z);
    if (h > -2.5 || h < -26) continue;
    const g = new THREE.Group(), shell = new THREE.MeshStandardMaterial({ color: '#b8a6a0', roughness: 0.8, flatShading: true });
    const bot = new THREE.Mesh(new THREE.SphereGeometry(0.4, 10, 6, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), shell); bot.scale.y = 0.4;
    const lid = new THREE.Group(), top = new THREE.Mesh(new THREE.SphereGeometry(0.4, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), shell);
    top.scale.y = 0.35; top.position.z = 0.4; lid.position.z = -0.4; lid.add(top);
    const pearl = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), new THREE.MeshStandardMaterial({ color: '#fff8f0', roughness: 0.15, metalness: 0.3, emissive: '#554b44' }));
    pearl.position.y = 0.05; pearl.visible = false;
    g.add(bot, lid, pearl); g.position.set(x, h + 0.05, z); g.rotation.y = Math.random() * 6; S.scene.add(g);
    oysters.push({ g, lid, pearl, open: false });
    return;
  }
}

export function shoot() {
  if (D.shot || D.cool > 0) return;
  if (G.cargoFull(S.save)) return toast('Ta cale est pleine : remonte vendre tes prises.');
  dir.set(Math.sin(D.yaw) * Math.cos(D.pitch), Math.sin(D.pitch), Math.cos(D.yaw) * Math.cos(D.pitch));
  D.shot = { pos: D.pos.clone().addScaledVector(dir, 1.2), dir: dir.clone(), dist: 0, back: false, hit: null };
  harpoon.visible = cord.visible = true; SFX.cast();
}

export function updateDive(dt) {
  if (S.mode !== 'dive') return;
  const k = c => S.keys.has(c), frozen = catchOpen() || S.panel;
  // nager : vers où l'on regarde
  if (!frozen) {
    const turn = (k('KeyA') || k('KeyQ') || k('ArrowLeft') ? 1 : 0) - (k('KeyD') || k('ArrowRight') ? 1 : 0) - S.touch.x;
    D.yaw += turn * dt * 1.6;
    D.pitch = clampPitch(D.pitch + ((k('ArrowUp') ? 1 : 0) - (k('ArrowDown') ? 1 : 0)) * dt * 1.2);
    const push = (k('KeyW') || k('KeyZ') ? 1 : 0) - (k('KeyS') ? 0.6 : 0) - S.touch.y;
    dir.set(Math.sin(D.yaw) * Math.cos(D.pitch), Math.sin(D.pitch), Math.cos(D.yaw) * Math.cos(D.pitch));
    D.vel.addScaledVector(dir, push * dt * 7);
    D.kick += dt * (2 + Math.abs(push) * 8);
  }
  D.vel.multiplyScalar(Math.exp(-dt * 2.2));
  D.pos.addScaledVector(D.vel, dt);
  const floor = seabed(D.pos.x, D.pos.z) + 0.7, top = waveH(D.pos.x, D.pos.z) - 0.6;
  if (D.pos.y < floor) { D.pos.y = floor; D.vel.y = Math.max(0, D.vel.y); }
  if (D.pos.y > top) { D.pos.y = top; D.vel.y = Math.min(0, D.vel.y); }
  const fromBoat = Math.hypot(D.pos.x - S.B.x, D.pos.z - S.B.z);
  if (fromBoat > 45) { D.pos.x += (S.B.x - D.pos.x) / fromBoat * dt * 4; D.pos.z += (S.B.z - D.pos.z) / fromBoat * dt * 4; }
  diver.position.copy(D.pos); diver.rotation.set(-D.pitch, D.yaw, Math.sin(D.kick * 0.5) * 0.06, 'YXZ');
  legs.forEach((l, j) => (l.rotation.x = Math.sin(D.kick + j * Math.PI) * 0.35));
  if (Math.random() < dt * 1.2) bubbles(tmp.set(D.pos.x, D.pos.y + 0.3, D.pos.z).addScaledVector(dir, 0.9), 3);
  // oxygène
  if (!frozen) D.o2 -= dt;
  $('#o2 i').style.width = `${Math.max(0, D.o2 / O2) * 100}%`;
  $('#o2').classList.toggle('low', D.o2 < 10);
  if (D.o2 <= 0) return endDive('😮‍💨 Plus d’air ! Tu remontes reprendre ton souffle.');
  D.cool = Math.max(0, D.cool - dt);
  updateFishes(dt);
  updateShot(dt);
  // huîtres
  for (const o of oysters) {
    if (o.open) { o.lid.rotation.x = Math.max(-1.1, o.lid.rotation.x - dt * 3); continue; }
    if (o.g.position.distanceTo(D.pos) > 1.9) continue;
    o.open = true; const money = G.oyster();
    if (money) { o.pearl.visible = true; S.save.money += money; gain(money); SFX.treasure(); toast(`🦪 Une perle ! <b>+${money} 🪙</b>`); persist(); }
    else { SFX.plop(); toast('🦪 Huître vide…', 1800); }
  }
  // caméra derrière le plongeur, neige marine autour
  tmp.set(Math.sin(D.yaw) * Math.cos(D.pitch), Math.sin(D.pitch), Math.cos(D.yaw) * Math.cos(D.pitch));
  const cam = S.camera, want = D.pos.clone().addScaledVector(tmp, -4.2).add(new THREE.Vector3(0, 1.1, 0));
  want.y = Math.min(want.y, waveH(want.x, want.z) - 0.3);
  cam.position.lerp(want, 1 - Math.exp(-dt * 6));
  cam.lookAt(D.pos.clone().addScaledVector(tmp, 5));
  snow.position.set(Math.round(cam.position.x / 40) * 40, Math.round(cam.position.y / 40) * 40, Math.round(cam.position.z / 40) * 40);
  snow.rotation.y += dt * 0.01;
}
function updateFishes(dt) {
  for (let n = fishes.length - 1; n >= 0; n--) {
    const F = fishes[n], m = F.m, d = m.position.distanceTo(D.pos);
    if (d > 48) { S.scene.remove(m); fishes.splice(n, 1); spawnFish(false); continue; }
    if (d < 4.5 && F.flee <= 0) F.flee = 1.5; // trop près : il file
    F.flee -= dt;
    if (F.flee > 0) F.target.copy(m.position).add(tmp.subVectors(m.position, D.pos).setLength(8));
    else if ((F.wait -= dt) < 0 || m.position.distanceTo(F.target) < 1) {
      F.wait = 2 + Math.random() * 4;
      const x = m.position.x + (Math.random() - 0.5) * 14, z = m.position.z + (Math.random() - 0.5) * 14, h = seabed(x, z);
      if (h < -2.2) F.target.set(x, h + 0.8 + Math.random() * Math.max(0.3, -h - 2.2), z);
    }
    const speed = F.flee > 0 ? 4.5 : 1.2;
    F.vel.lerp(tmp.subVectors(F.target, m.position).setLength(speed), 1 - Math.exp(-dt * 2));
    m.position.addScaledVector(F.vel, dt);
    const floor = seabed(m.position.x, m.position.z) + 0.4; if (m.position.y < floor) m.position.y = floor;
    if (F.vel.lengthSq() > 0.01) m.lookAt(tmp.copy(m.position).add(F.vel));
    swim(m, S.time + n, F.flee > 0 ? 1 : 0.3);
  }
}
function updateShot(dt) {
  const s = D.shot; if (!s) return;
  if (!s.back) {
    const step = 30 * dt; s.pos.addScaledVector(s.dir, step); s.dist += step;
    for (let n = 0; n < fishes.length; n++) {
      const F = fishes[n], r = F.m.userData.len * 1.3 * 0.6 + 0.35;
      if (F.m.position.distanceTo(s.pos) < r) { s.hit = F; fishes.splice(n, 1); s.back = true; SFX.hit(); bubbles(s.pos, 8); break; }
    }
    if (s.dist > 14 || s.pos.y < seabed(s.pos.x, s.pos.z)) s.back = true;
  } else {
    const home = tmp.copy(D.pos).addScaledVector(s.dir, 1.2), d = s.pos.distanceTo(home);
    s.pos.lerp(home, Math.min(1, dt * 7 + 2.5 / Math.max(1, d) * dt * 4));
    if (s.hit) s.hit.m.position.copy(s.pos);
    if (d < 0.6) {
      if (s.hit) caught(s.hit);
      D.shot = null; D.cool = 0.4; harpoon.visible = cord.visible = false;
      return;
    }
  }
  harpoon.position.copy(s.pos); harpoon.lookAt(tmp.copy(s.pos).add(s.dir));
  const p = cord.geometry.attributes.position; gun.getWorldPosition(tmp);
  p.setXYZ(0, tmp.x, tmp.y, tmp.z); p.setXYZ(1, s.pos.x, s.pos.y, s.pos.z); p.needsUpdate = true;
}
function caught(F) {
  S.scene.remove(F.m);
  const res = G.landFish(S.save, F.f);
  SFX.catch(F.f.rarity === 'rare');
  if (res.first) showCatch(F.f, res, '🤿 Pêché au harpon');
  else toast(`🎯 <b>${esc(F.f.name)}</b> (${res.fish.size} cm)${res.record ? ' · 🏆 record !' : ''}`);
  persist();
  spawnFish(false);
}
export function hint() {
  if (S.mode !== 'dive') return '';
  return `🫧 Air : ${Math.ceil(D.o2)} s · <b>Espace</b> harpon · <b>E</b> remonter`;
}
export { D as diveState }; // pour les tests automatiques
