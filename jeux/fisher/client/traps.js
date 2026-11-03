// Little Fisher : casiers et filet de traîne. Un casier se pose sur un fond peu profond (T) ; sa bouée porte un fanion
// qui passe au vert quand il est plein (3 heures de jeu) ; on le relève avec E. Le filet (N) traîne derrière le bateau
// et remonte des petits poissons pendant qu'on navigue (le bateau va un peu moins vite).
import * as THREE from 'three';
import { S, persist, waveH } from './state.js';
import * as G from './game.js';
import { SFX } from './audio.js';
import { toast, showCatch, gain, esc } from './hud.js';
import { splashAt, jumpFish } from './fx.js';

const buoys = new Map(); // casier (objet de la sauvegarde) -> bouée
let netMesh = null, netDist = 0;
export const net = { on: false };

function makeBuoy() {
  const g = new THREE.Group();
  const float = new THREE.Mesh(new THREE.SphereGeometry(0.55, 12, 10), new THREE.MeshStandardMaterial({ color: '#ff8a2a', roughness: 0.5 }));
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2, 5), new THREE.MeshStandardMaterial({ color: '#3a3a3a' })); pole.position.y = 1;
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.5).translate(0.4, 0, 0), new THREE.MeshStandardMaterial({ color: '#ff8a2a', side: THREE.DoubleSide, emissive: '#000000' }));
  flag.position.y = 1.75; g.add(float, pole, flag);
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  S.scene.add(g);
  return { g, flag };
}
// Bouées en accord avec la sauvegarde (casiers posés, relevés, partie rechargée)
function sync() {
  for (const [t, b] of buoys) if (!S.save.traps.includes(t)) { S.scene.remove(b.g); buoys.delete(t); }
  for (const t of S.save.traps) if (!buoys.has(t)) buoys.set(t, makeBuoy());
}

export function initTraps() {
  // le filet : deux tangons à l'arrière et une nappe qui plonge dans l'eau
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d'); g.strokeStyle = '#e8e2d0'; g.lineWidth = 3;
  for (let k = 0; k <= 64; k += 16) { g.beginPath(); g.moveTo(k, 0); g.lineTo(k, 64); g.moveTo(0, k); g.lineTo(64, k); g.stroke(); }
  const tex = new THREE.CanvasTexture(c); tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(4, 3);
  netMesh = new THREE.Group();
  const sheet = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 6, 4, 6), new THREE.MeshStandardMaterial({ map: tex, transparent: true, alphaTest: 0.3, side: THREE.DoubleSide, roughness: 1 }));
  sheet.rotation.x = -Math.PI / 2; sheet.position.set(0, 0.03, -7.2); // à plat dans le sillage
  for (const s of [-1, 1]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 3.4, 5), new THREE.MeshStandardMaterial({ color: '#6b4a2f' })); p.rotation.x = 1.25; p.position.set(s * 1.4, 0.6, -4.2); netMesh.add(p); }
  const floatMat = new THREE.MeshStandardMaterial({ color: '#ff8a2a' });
  for (let k = 0; k < 5; k++) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), floatMat); b.position.set(-1.6 + k * 0.8, 0.1, -10.2); netMesh.add(b); } // flotteurs au bout de la nappe
  netMesh.add(sheet); netMesh.visible = false;
  S.boat.group.add(netMesh);
  sync();
}

const nearTrap = () => S.save.traps.findIndex(t => Math.hypot(t.x - S.B.x, t.z - S.B.z) < 12);
export const trapNear = () => nearTrap() >= 0;
export function placeTrap() {
  const s = S.save, B = S.B;
  if (!G.trapsMax(s)) return toast('Tu n’as pas de casiers : Joseph en vend au chantier de Port-Galet.');
  if (Math.abs(B.speed) > 3) return toast('Arrête le bateau pour poser un casier');
  const depth = -S.world.heightAt(B.x, B.z), zone = G.zoneAt(B.x, B.z);
  if (!G.trapSpot(depth, zone)) return toast(depth > 26 || zone === 'large' || zone === 'fosse' ? 'Trop profond ici : pose ton casier plus près d’une île.' : 'Pas assez profond ici.');
  if (s.traps.some(t => Math.hypot(t.x - B.x, t.z - B.z) < 15)) return toast('Il y a déjà un casier juste là.');
  const err = G.placeTrap(s, B.x, B.z, zone);
  if (err) return toast(err);
  sync(); SFX.splash(); splashAt({ x: B.x, y: 0, z: B.z }, 1.2);
  const ready = G.clock((s.time + G.TRAP_HOURS / 24) % 1);
  toast(`🦀 Casier posé (${s.traps.length}/${G.trapsMax(s)}). Il sera plein vers <b>${ready}</b>.`);
  persist();
}
export function collectTrap() {
  const k = nearTrap(); if (k < 0) return false;
  const s = S.save, t = s.traps[k];
  if (!G.trapReady(s, t)) { toast(`Pas encore plein : reviens vers <b>${G.clock((t.at + G.TRAP_HOURS / 24) % 1)}</b>.`); return true; }
  if (G.cargoFull(s)) { toast('Ta cale est pleine : vide-la avant de relever le casier.'); return true; }
  const got = G.collectTrap(s, k);
  sync(); SFX.splash(); splashAt({ x: t.x, y: 0, z: t.z }, 1.5);
  if (!got.length) toast('Le casier était vide… pas de chance !');
  else {
    for (const g of got) S.onCatch(g.f, g);
    toast(`🦀 Dans le casier : ${got.map(g => `<b>${esc(g.f.name)}</b> (${g.fish.size} cm)`).join(', ')}`, 6000);
    jumpFish(got[0].f, { x: t.x, y: 0, z: t.z });
    const first = got.find(g => g.first);
    if (first) showCatch(first.f, first, '🦀 Pris au casier');
    SFX.catch(got.some(g => g.f.rarity === 'rare'));
  }
  persist();
  return true;
}
export function toggleNet() {
  if (!S.save.levels.filet) return toast('Tu n’as pas de filet : Joseph en vend au chantier de Port-Galet.');
  net.on = !net.on; netMesh.visible = net.on; netDist = 0;
  SFX.splash();
  toast(net.on ? '🥅 Filet déployé : navigue pour attraper des petits poissons (le bateau va moins vite).' : '🥅 Filet remonté.');
}

export function updateTraps(dt) {
  sync();
  for (const [t, b] of buoys) {
    const w = S.world.waveAt(t.x, t.z, S.time, S.amp);
    b.g.position.set(t.x, w.h, t.z); b.g.rotation.set(w.dz * 3, S.time * 0.2, -w.dx * 3);
    const ready = G.trapReady(S.save, t);
    b.flag.material.color.set(ready ? '#5fe08a' : '#ff8a2a'); b.flag.material.emissive.set(ready ? '#1f6a3a' : '#000000');
    b.flag.rotation.y = Math.sin(S.time * 3 + t.x) * 0.4;
  }
  // le filet se remplit pendant qu'on navigue
  if (net.on && S.mode === 'sail' && !S.B.docked) {
    netDist += Math.max(0, S.B.speed) * dt;
    const every = G.lvl(S.save, 'filet').every / (G.boatOf(S.save).nets ? 1.5 : 1); // le chalutier remplit son filet plus vite
    if (netDist > every) {
      netDist = 0;
      if (G.cargoFull(S.save)) toast('🥅 Le filet déborde : ta cale est pleine.');
      else {
        const f = G.netCatch(G.zoneAt(S.B.x, S.B.z));
        if (f) { const res = G.landFish(S.save, f); S.onCatch(f, res); SFX.plop(); toast(`🥅 Le filet a remonté : <b>${esc(f.name)}</b> (${res.fish.size} cm)${res.first ? ' · ✨ nouvelle espèce !' : ''}`); gain(0); persist(); }
      }
    }
  }
}
export function hint() {
  const k = nearTrap(); if (k < 0) return '';
  const t = S.save.traps[k];
  return G.trapReady(S.save, t) ? '<b>E</b> : relever le casier (plein !)' : `Casier : plein vers <b>${G.clock((t.at + G.TRAP_HOURS / 24) % 1)}</b>`;
}
