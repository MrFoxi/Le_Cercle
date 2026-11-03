// Little Fisher : la partie. Rendu, commandes, navigation du bateau, caméra, découvertes, heure et météo, boucle de jeu.
// Le reste est rangé à part : pêche à la canne (fishing.js), casiers et filet (traps.js), plongée (dive.js),
// fenêtres (panels.js), interface en mer (hud.js), règles (game.js), contenu (data.js).
import * as THREE from 'three';
import { createWorld } from './world.js';
import { createPost } from './post.js';
import { buildBoat, createWake } from './boat.js';
import { startAudio, ambience, SFX, toggleMute, isMuted } from './audio.js';
import { ISLANDS, UPGRADES, VILLAGES, ZONES, FOSSE, PEOPLE, HUNTS, RELICS, STORY } from './data.js';
import * as G from './game.js';
import { S, persist, fwd, right, dressBoat } from './state.js';
import { toast, banner, gain, updateHud, drawMinimap, buildMapLand, catchOpen, closeCatch, coins, baitLabel, esc, showDialog, closeDialog } from './hud.js';
import { openPanel, closePanel, togglePanel, openVillage } from './panels.js';
import * as Fishing from './fishing.js';
import * as Traps from './traps.js';
import * as Dive from './dive.js';
import { updateFx, splashAt } from './fx.js';
import { $, store } from '/shared/party.js';

const params = new URLSearchParams(location.search);
// Qualité : « haute » (effets, ombres fines, herbe dense) ou « basse » (téléphones, petits ordinateurs)
const coarse = matchMedia('(pointer: coarse)').matches;
const LOW = (store.get('fisher-quality') || (coarse ? 'basse' : 'haute')) === 'basse';

/* ---------------- Rendu ---------------- */
const renderer = new THREE.WebGLRenderer({ canvas: $('#view'), antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, LOW ? 1 : 1.75));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
const scene = S.scene = new THREE.Scene();
const camera = S.camera = new THREE.PerspectiveCamera(55, 1, 0.3, 6000);
let post = null, wake = null;
function resize() { renderer.setSize(innerWidth, innerHeight, false); post?.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); }
addEventListener('resize', resize); resize();
const B = S.B, W = S.W;

/* ---------------- Clavier, souris, tactile ---------------- */
const keys = S.keys;
addEventListener('keydown', e => {
  if (e.target.closest?.('input, textarea')) return;
  if (S.mode === 'title') return;
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  if (e.repeat) return;
  if (e.code === 'Escape') { if (S.panel) closePanel(); return; }
  if (catchOpen()) { if (['Space', 'Enter', 'KeyE'].includes(e.code)) closeCatch(); return; }
  if (S.mode === 'dive') {
    keys.add(e.code);
    if (e.code === 'Space') Dive.shoot();
    if (e.code === 'KeyE' || e.code === 'KeyH') Dive.endDive();
    return;
  }
  if (e.code === 'KeyI') return togglePanel('inv');
  if (e.code === 'KeyC') return togglePanel('book');
  if (e.code === 'KeyM' || e.code === 'Semicolon') return togglePanel('map');
  if (S.panel) return;
  keys.add(e.code);
  if (e.code === 'Space') fishAction();
  if (e.code === 'KeyE') interact();
  if (e.code === 'KeyB') cycleBait();
  if (e.code === 'KeyT') act(Traps.placeTrap);
  if (e.code === 'KeyN') act(Traps.toggleNet);
  if (e.code === 'KeyH') startDive();
});
addEventListener('keyup', e => keys.delete(e.code));
addEventListener('blur', () => keys.clear());
{
  const stick = $('#stick'), knob = stick.querySelector('i');
  let id = null;
  const move = e => {
    const r = stick.getBoundingClientRect(), dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2), m = r.width / 2, l = Math.hypot(dx, dy), k = l > m ? m / l : 1;
    S.touch.x = dx * k / m; S.touch.y = dy * k / m; knob.style.transform = `translate(${dx * k}px, ${dy * k}px)`;
  };
  stick.addEventListener('pointerdown', e => { id = e.pointerId; stick.setPointerCapture(id); move(e); });
  stick.addEventListener('pointermove', e => e.pointerId === id && move(e));
  const end = () => { id = null; S.touch.x = S.touch.y = 0; knob.style.transform = ''; };
  stick.addEventListener('pointerup', end); stick.addEventListener('pointercancel', end);
  $('#tFish').onclick = () => (S.mode === 'dive' ? Dive.shoot() : fishAction());
  $('#tAct').onclick = () => (S.mode === 'dive' ? Dive.endDive() : interact());
  $('#tTrap').onclick = () => act(Traps.placeTrap);
  $('#tNet').onclick = () => act(Traps.toggleNet);
  $('#tDive').onclick = () => startDive();
}
function input() {
  const k = c => keys.has(c);
  let throttle = (k('KeyW') || k('KeyZ') || k('ArrowUp') ? 1 : 0) - (k('KeyS') || k('ArrowDown') ? 0.45 : 0) - S.touch.y;
  let steer = (k('KeyD') || k('ArrowRight') ? 1 : 0) - (k('KeyA') || k('KeyQ') || k('ArrowLeft') ? 1 : 0) + S.touch.x;
  const gp = navigator.getGamepads?.()[0];
  if (gp) { if (Math.abs(gp.axes[0]) > 0.15) steer = gp.axes[0]; const t = (gp.buttons[7]?.value ?? 0) - (gp.buttons[6]?.value ?? 0) * 0.45; if (Math.abs(t) > 0.05) throttle = t; }
  return { throttle: Math.max(-0.45, Math.min(1, throttle)), steer: Math.max(-1, Math.min(1, steer)) };
}
// Caméra : glisser pour tourner autour du bateau, molette pour zoomer
const cam = { dist: 24, yawOff: 0, pitch: 0.4, drag: null };
$('#view').addEventListener('pointerdown', e => { if (S.mode === 'sail' && e.pointerType === 'mouse') cam.drag = { x: e.clientX, y: e.clientY }; });
addEventListener('pointermove', e => { if (!cam.drag) return; cam.yawOff -= (e.clientX - cam.drag.x) * 0.006; cam.pitch = Math.max(0.12, Math.min(1.1, cam.pitch + (e.clientY - cam.drag.y) * 0.004)); cam.drag = { x: e.clientX, y: e.clientY }; });
addEventListener('pointerup', () => (cam.drag = null));
$('#view').addEventListener('wheel', e => { cam.dist = Math.max(10, Math.min(60, cam.dist * (1 + Math.sign(e.deltaY) * 0.1))); e.preventDefault(); }, { passive: false });

$('#bInv').onclick = () => togglePanel('inv');
$('#bBook').onclick = () => togglePanel('book');
$('#bMap').onclick = () => togglePanel('map');
$('#minimap').onclick = () => togglePanel('map');
$('#hBait').onclick = () => cycleBait();
$('#cOk').onclick = closeCatch;
$('#dOk').onclick = closeDialog;
// Chaque prise compte pour le concours du dimanche
S.onCatch = (f, res) => { if (G.contestCatch(S.save, f, res.fish.size)) setTimeout(() => toast(`🏆 Nouveau meilleur score au concours : <b>${S.save.contest.best} points</b> (${esc(f.name)})`), 400); };
$('#bMute').onclick = () => { $('#bMute').textContent = toggleMute() ? '🔇' : '🔊'; };
$('#bMute').textContent = isMuted() ? '🔇' : '🔊';
$('#bQuality').textContent = LOW ? '⚙️ léger' : '⚙️';
$('#bQuality').onclick = () => { if (S.mode === 'sail') persist(); store.set('fisher-quality', LOW ? 'haute' : 'basse'); location.reload(); };

/* ---------------- Actions en mer ---------------- */
const free = () => S.mode === 'sail' && !S.panel && !B.docked && !catchOpen();
const act = f => free() && Fishing.F.phase === 'idle' && f();
function fishAction() { if (free()) Fishing.fishAction(); }
function cycleBait() {
  if (S.mode !== 'sail') return;
  G.nextBait(S.save); SFX.click();
  toast(`Appât : ${baitLabel()}`, 1600); persist();
}
function startDive() {
  if (!free() || Fishing.busy()) return;
  const k = Dive.diveKind();
  if (k.why) return toast(k.why);
  if (Traps.net.on) Traps.toggleNet();
  Dive.startDive(k.kind);
}
const nearDock = () => S.world.docks.find(d => Math.hypot(d.x - B.x, d.z - B.z) < 18);
function interact() {
  if (!free() || Fishing.F.phase === 'reel') return;
  if (Traps.collectTrap()) return;
  if (searchWreck() || dig()) return;
  const d = nearDock();
  if (!d) return;
  if (Math.abs(B.speed) > 6) return toast('Ralentis pour accoster');
  Fishing.stop();
  if (Traps.net.on) Traps.toggleNet();
  B.docked = d; B.dockAnim = 0; B.speed = 0;
  SFX.horn();
  setTimeout(() => openVillage(d.village), 450);
}

// Fouiller l'épave toute proche (grappin)
function searchWreck() {
  const w = G.wreckNear(B.x, B.z); if (!w) return false;
  if (Math.abs(B.speed) > 3) { toast('Arrête-toi au-dessus de l’épave pour la fouiller.'); return true; }
  const r = G.searchWreck(S.save, w);
  if (r.error) { toast(r.error); return true; }
  SFX.splash(); splashAt({ x: w.x, y: 0, z: w.z }, 1.6); gain(r.money);
  toast(`🪝 <b>${esc(w.name)}</b> : ${r.money} 🪙${r.relic ? ` et une relique : <b>${RELICS[r.relic].icon} ${esc(RELICS[r.relic].name)}</b> !` : '.'}`, 6000);
  if (r.relic) SFX.treasure();
  persist(); return true;
}
// Creuser à l'endroit d'une carte au trésor
const huntNear = (r = 16) => G.activeHunts(S.save).find(id => { const p = S.world.huntSpots[id].water; return Math.hypot(p.x - B.x, p.z - B.z) < r; });
function dig() {
  const id = huntNear(); if (!id) return false;
  const h = G.digHunt(S.save, id);
  S.world.setHunt(id, false); SFX.treasure(); gain(h.money);
  banner('Trésor !', h.name);
  toast(`⛏️ Tu débarques et tu creuses… un coffre ! <b>+${coins(h.money)}</b> et <b>${RELICS[h.relic].icon} ${esc(RELICS[h.relic].name)}</b>`, 7000);
  persist(); return true;
}

/* ---------------- Navigation ---------------- */
let bumpAt = 0, gateAt = 0;
function blocked(x, z) {
  const f = fwd(B.heading);
  for (const k of [3.3, 0, -2.9]) if (S.world.heightAt(x + f.x * k, z + f.z * k) > -0.9) return true;
  for (const o of S.world.obstacles) {
    const dx = o.bx - o.ax, dz = o.bz - o.az, l2 = dx * dx + dz * dz;
    for (const k of [2.8, -2.4]) {
      const px = x + f.x * k, pz = z + f.z * k, t = l2 ? Math.max(0, Math.min(1, ((px - o.ax) * dx + (pz - o.az) * dz) / l2)) : 0;
      if (Math.hypot(px - (o.ax + dx * t), pz - (o.az + dz * t)) < o.w + 1.2) return true;
    }
  }
  return false;
}
function sail(dt) {
  if (B.docked) { // glisse jusqu'au ponton
    const d = B.docked; B.dockAnim = Math.min(1, B.dockAnim + dt * 1.2);
    const k = 1 - Math.pow(1 - B.dockAnim, 3), dh = Math.atan2(Math.sin(d.heading - B.heading), Math.cos(d.heading - B.heading));
    B.x += (d.x - B.x) * k * 0.2; B.z += (d.z - B.z) * k * 0.2; B.heading += dh * k * 0.2; B.speed = 0; B.turn = 0;
    return { throttle: 0 };
  }
  const inp = S.panel || Fishing.F.phase === 'reel' || catchOpen() ? { throttle: 0, steer: 0 } : input();
  if (Math.abs(inp.throttle) > 0.2 && (Fishing.F.phase === 'wait' || Fishing.F.phase === 'bite')) { Fishing.stop(); toast('Tu remontes ta ligne.'); }
  const def = G.boatOf(S.save), wind = def.wind ? G.sailFactor(B.heading - W.windDir, W.wind) : 1; // le voilier profite du vent
  const max = G.lvl(S.save, 'moteur').speed * def.speed * wind * (Traps.net.on ? 0.75 : 1), target = inp.throttle * max;
  B.speed += (target - B.speed) * Math.min(1, dt * (Math.abs(target) > Math.abs(B.speed) ? 0.6 : 0.45));
  const rate = (0.35 + 0.6 * Math.min(1, Math.abs(B.speed) / 7)) * (B.speed < -0.3 ? -1 : 1) * def.turn;
  B.turn += (-inp.steer * rate - B.turn) * Math.min(1, dt * 3);
  const oldH = B.heading; B.heading += B.turn * dt;
  const f = fwd(B.heading); let nx = B.x + f.x * B.speed * dt, nz = B.z + f.z * B.speed * dt;
  if (blocked(nx, nz)) {
    B.heading = oldH;
    if (blocked(B.x, B.z)) { // coincé : on s'écarte de la côte
      const h = S.world.heightAt, gx = h(B.x + 2, B.z) - h(B.x - 2, B.z), gz = h(B.x, B.z + 2) - h(B.x, B.z - 2), l = Math.hypot(gx, gz) || 1;
      nx = B.x - gx / l * 3 * dt * 4; nz = B.z - gz / l * 3 * dt * 4;
    } else { nx = B.x; nz = B.z; }
    if (Math.abs(B.speed) > 3 && S.time - bumpAt > 0.6) { bumpAt = S.time; SFX.bump(); splashAt({ x: B.x + f.x * 3.5, y: 0, z: B.z + f.z * 3.5 }, 1.5); }
    B.speed *= -0.25;
  }
  const need = G.hullNeeded(nx, nz);
  if (need > S.save.levels.coque) {
    nx = B.x; nz = B.z; B.speed *= -0.3;
    if (S.time - gateAt > 5) { gateAt = S.time; SFX.splash(); toast(need === Infinity ? '🌫️ Une brume épaisse : impossible d’aller plus loin.' : `🌊 Les vagues sont trop fortes pour ta coque ! Il faut la <b>${esc(UPGRADES.coque.levels[need].name)}</b> (chantier de Port-Galet).`, 5000); }
  }
  B.x = nx; B.z = nz;
  return inp;
}

/* ---------------- Découvertes : îles, zones, trésors ---------------- */
let zoneNow = null, zoneSince = 0, nightWarned = false, margotDay = -1;
function explore() {
  const s = S.save;
  for (const i of ISLANDS) if (i.name && Math.hypot(i.x - B.x, i.z - B.z) < i.r + 95 && G.see(s, i.id)) { banner(i.name, 'Nouvelle île découverte !'); toast(`🗺️ ${esc(i.desc)}`, 6000); questHint(i.id); persist(); }
  if (Math.hypot(FOSSE.x - B.x, FOSSE.z - B.z) < FOSSE.r && G.see(s, 'fosse')) { banner('La Fosse', 'Des eaux sans fond…'); questHint('fosse'); persist(); }
  const z = G.zoneAt(B.x, B.z);
  if (z !== zoneNow) { zoneNow = z; zoneSince = S.time; }
  else if (zoneSince && S.time - zoneSince > 2.5) { zoneSince = 0; if (!$('#place').classList.contains('on')) banner(ZONES[z], z === 'large' ? 'Loin des côtes' : ''); }
  for (const t of G.treasuresLeft(s)) {
    if (Math.hypot(t.x - B.x, t.z - B.z) > 7) continue;
    G.takeTreasure(s, t); S.world.hideTreasure(t.id); SFX.treasure();
    toast(`${t.kind === 'bouteille' ? '🍾' : '📦'} <b>${t.name ? esc(t.name) : t.kind === 'bouteille' ? 'Une bouteille à la mer !' : 'Un coffre !'}</b> ${esc(t.note)}${t.money ? ` <b>+${coins(t.money)}</b>` : ''}`, 7000);
    if (t.money) gain(t.money);
    if (t.map) setTimeout(() => toast(`📜 <b>${esc(HUNTS[t.map].name)}</b> : « ${esc(HUNTS[t.map].clue)} » (voir le carnet)`, 9000), 1200);
    persist();
  }
  // la carte se dévoile autour du bateau ; les merveilles ; les croix des trésors quand on approche
  G.reveal(s, B.x, B.z);
  const w = G.wonderHere(s, B.x, B.z, { time: s.time, weather: W.kind });
  if (w) { G.see(s, w.id); banner(`${w.icon} ${w.name}`, 'Merveille découverte !'); toast(`✨ ${esc(w.desc)}`, 6000); SFX.treasure(); questHint(w.id); persist(); }
  for (const id of Object.keys(HUNTS)) { const p = S.world.huntSpots[id].water; S.world.setHunt(id, s.hunts[id] === 'actif' && Math.hypot(p.x - B.x, p.z - B.z) < 70); }
  // l'histoire : un chapitre se termine dès que son objectif est atteint
  if (G.chapterReady(s)) {
    const c = G.finishChapter(s); gain(c.reward); SFX.upgrade(); persist();
    showDialog(c.end ? '🐉' : '📜', `Chapitre ${s.story} · ${c.title}`, c.end ? 'Fin de l’histoire' : 'Le mystère du Léviathan', `${c.say}\n\n+${c.reward} 🪙${c.relic ? ` · ${RELICS[c.relic].icon} ${RELICS[c.relic].name}` : ''}${G.chapter(s) ? `\n\nEnsuite : ${G.chapter(s).task}` : ''}`);
  }
  // la nuit d'orage dans la Fosse : le Léviathan passe sous le bateau
  const ch = G.chapter(s);
  if (ch?.goal.event === 'leviathan' && !s.flags.leviathan && G.zoneAt(B.x, B.z) === 'fosse' && G.period(s.time) === 'nuit' && W.kind === 'pluie') {
    s.flags.leviathan = true; S.world.leviathan(B.x, B.z); SFX.horn(); banner('…', 'Quelque chose d’immense passe sous le bateau'); persist();
  }
  // fin du concours : le classement
  if (s.contest && !s.contest.done && G.now(s) >= s.contest.until) {
    const r = G.endContest(s); persist();
    if (r.prize) gain(r.prize);
    showDialog('🏆', 'Résultats du concours', `Tu finis ${r.place === 1 ? '1er' : `${r.place}e`} !`, `${r.board.map((b, k) => `${k + 1}. ${b.name} : ${b.score} points`).join('\n')}${r.prize ? `\n\nPrix : +${r.prize} 🪙${r.place === 1 ? ' et la Coupe du concours !' : ''}` : ''}`);
  }
  // Margot change de village chaque matin
  if (margotDay !== s.days) { margotDay = s.days; S.world.setMargot(S.world.docks.find(d => d.village === G.margotAt(s))); }
  if (G.period(s.time) === 'nuit' && !s.levels.lanterne && s.bait !== 'lumineux' && !nightWarned) { nightWarned = true; toast('🌙 La nuit tombe. Avec une <b>lanterne</b> (chantier) ou un <b>appât lumineux</b> (Anse-Corail), les poissons de nuit viendraient mordre…', 6000); }
}
function questHint(place) {
  const p = PEOPLE.find(x => x.quests.some(q => q.type === 'see' && q.place === place && G.questOf(S.save, x) === q));
  if (p) toast(`📜 Mission accomplie : retourne voir <b>${esc(p.name)}</b> (${esc(VILLAGES[p.village].name)}).`, 5000);
}
function hint() {
  if (S.mode === 'dive') return Dive.hint();
  const h = Fishing.hint() || Traps.hint();
  if (h) return h;
  if (B.docked) return '';
  const wr = G.wreckNear(B.x, B.z);
  if (wr) return S.save.gear.grappin ? `<b>E</b> : fouiller l’épave « ${esc(wr.name)} »` : `L’épave « ${esc(wr.name)} »… il faudrait un grappin (boutique de Port-Galet)`;
  if (huntNear()) return '<b>E</b> : débarquer et creuser ici !';
  const d = nearDock(); if (d) return `<b>E</b> : accoster à ${esc(d.name)}`;
  if (Math.abs(B.speed) < 2.5) {
    const c = Fishing.castPoint(), extra = [G.trapsMax(S.save) > S.save.traps.length && '<b>T</b> casier', (S.save.gear.harpon || S.save.gear.sousmarin) && !Dive.whyNot() && '<b>H</b> plonger'].filter(Boolean).join(' · ');
    return `<b>Espace</b> : lancer la ligne${spotAt(c) ? ' · <b>un remous</b> !' : ` · ${ZONES[G.zoneAt(B.x, B.z)]}`}${extra ? ` · ${extra}` : ''}`;
  }
  if (S.save.cargo.length === 0 && S.save.sold === 0) return 'Arrête-toi et pêche avec <b>Espace</b> · les cercles blancs sur l’eau sont des remous';
  return Traps.net.on ? '🥅 Filet déployé · <b>N</b> pour le remonter' : '';
}
const spotAt = c => S.world.spots.some(m => Math.hypot(m.position.x - c.x, m.position.z - c.z) < 15);
// Boutons tactiles : seulement ceux du matériel qu'on a
function touchButtons() {
  if (!coarse) return;
  const s = S.save, sail = S.mode === 'sail';
  $('#tTrap').hidden = !sail || !G.trapsMax(s); $('#tNet').hidden = !sail || !s.levels.filet; $('#tDive').hidden = !sail || !(s.gear.harpon || s.gear.sousmarin);
}

/* ---------------- Boucle ---------------- */
let last = performance.now(), hudAt = 0, mapAt = 0, exploreAt = 0;
const look = new THREE.Vector3(), want = new THREE.Vector3();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000); last = now; S.time += dt;
  const s = S.save, playing = (S.mode === 'sail' || S.mode === 'dive') && !S.panel && !catchOpen();
  if (playing || S.mode === 'title') {
    if (G.tick(s, dt) && S.mode !== 'title') toast(`☀️ Jour ${s.days + 1}${s.traps.some(t => G.trapReady(s, t)) ? ' · tes casiers sont pleins' : ''}.`);
    if ((W.left -= dt) < 0) {
      const night = G.period(s.time) === 'nuit', r = Math.random();
      W.kind = r < 0.42 ? 'clair' : r < 0.66 ? 'nuageux' : r < (night ? 0.78 : 0.86) ? 'pluie' : 'brume';
      W.left = 110 + Math.random() * 150;
      if (S.mode === 'sail' && W.kind !== 'clair') toast({ nuageux: '⛅ Les nuages arrivent.', pluie: '🌧️ Il se met à pleuvoir… certains poissons adorent ça.', brume: '🌫️ La brume se lève sur l’archipel.' }[W.kind]);
    }
  }
  S.amp = 1 + (W.kind === 'pluie' ? 0.9 : 0);
  // le vent tourne lentement et forcit sous la pluie
  W.windDir += Math.sin(S.time * 0.013) * dt * 0.03;
  W.wind = Math.min(1, 0.3 + 0.35 * (Math.sin(S.time * 0.021) + 1) / 2 + (W.kind === 'pluie' ? 0.35 : W.kind === 'nuageux' ? 0.15 : 0));
  const inp = S.mode === 'sail' ? sail(dt) : { throttle: 0 };
  // le bateau sur les vagues
  const boat = S.boat, w = S.world.waveAt(B.x, B.z, S.time, S.amp), f = fwd(B.heading), r = right(B.heading);
  boat.group.position.set(B.x, w.h + 0.05, B.z);
  boat.group.rotation.y = B.heading;
  const max = G.lvl(s, 'moteur').speed;
  boat.body.rotation.x = -Math.atan((w.dx * f.x + w.dz * f.z) * 1.4) - Math.max(0, B.speed) / max * 0.07;
  boat.body.rotation.z = -Math.atan((w.dx * r.x + w.dz * r.z) * 1.4) + B.turn * Math.abs(B.speed) / max * 0.12;
  boat.fisher.rotation.y = Fishing.busy() ? -Math.PI / 2 + 0.3 : Math.sin(S.time * 0.3) * 0.4;
  boat.tick(dt, S.world.state.night, inp.throttle ?? 0, B.heading - W.windDir, W.wind);
  wake.update(dt, B.x, B.z, B.heading, Math.abs(B.speed), (x, z) => S.world.waveAt(x, z, S.time, S.amp).h);
  Fishing.updateFishing(dt);
  Traps.updateTraps(dt);
  Dive.updateDive(dt);
  updateFx(dt);
  // caméra
  if (S.mode === 'title') {
    const a = S.time * 0.05;
    want.set(Math.sin(a) * 120 + 10, 45, Math.cos(a) * 120 + 60); look.set(0, 8, 40);
    camera.position.lerp(want, 1 - Math.exp(-dt * 2));
    camera.lookAt(look);
  } else if (S.mode === 'sail') {
    B.camHeading += Math.atan2(Math.sin(B.heading - B.camHeading), Math.cos(B.heading - B.camHeading)) * Math.min(1, dt * 2.2);
    if (!cam.drag && Math.abs(B.speed) > 3) cam.yawOff *= Math.exp(-dt * 0.8);
    const yaw = B.camHeading + Math.PI + cam.yawOff, dist = cam.dist * (Fishing.busy() ? 0.9 : 1);
    want.set(B.x + Math.sin(yaw) * Math.cos(cam.pitch) * dist, Math.sin(cam.pitch) * dist + 3, B.z + Math.cos(yaw) * Math.cos(cam.pitch) * dist);
    const ground = S.world.heightAt(want.x, want.z) + 4; if (want.y < ground) want.y = ground;
    camera.position.lerp(want, 1 - Math.exp(-dt * 5));
    const bp = Fishing.bobberPos(), tx = Fishing.busy() ? (B.x + bp.x) / 2 : B.x + f.x * 5, tz = Fishing.busy() ? (B.z + bp.z) / 2 : B.z + f.z * 5;
    look.lerp(want.set(tx, 2.2, tz), 1 - Math.exp(-dt * 6));
    camera.lookAt(look);
  } else look.copy(camera.position); // en plongée, dive.js place la caméra
  S.world.update(dt, S.time, s.time, W.kind, S.mode === 'dive' ? camera.position : boat.group.position, camera);
  if (S.mode !== 'title') {
    if (now - hudAt > 150) { hudAt = now; updateHud(hint()); touchButtons(); }
    if (now - mapAt > 100) { mapAt = now; drawMinimap(); }
    if (now - exploreAt > 400 && S.mode === 'sail') { exploreAt = now; if (!S.panel) explore(); }
    const near = Math.max(0, 1 - Math.min(...ISLANDS.map(i => Math.hypot(i.x - B.x, i.z - B.z) - i.r)) / 120);
    ambience(dt, { speed: Math.abs(B.speed), throttle: inp.throttle ?? 0, weather: W.kind, night: S.world.state.night > 0.5, nearLand: S.mode === 'dive' ? 0 : near, docked: !!B.docked || S.mode === 'dive' });
  }
  post.setMood(S.world.state.night);
  post.render();
}

/* ---------------- Démarrage ---------------- */
function applySave() {
  const at = S.save.boat ?? S.world.docks.find(d => d.village === 'port'); // première partie : au ponton de Port-Galet
  Object.assign(B, { x: at.x, z: at.z, heading: at.heading, speed: 0, turn: 0, docked: null, camHeading: at.heading });
  dressBoat();
  for (const g of S.world.treasures.values()) g.visible = true;
  for (const id of S.save.treasures) S.world.hideTreasure(id);
}
function play() {
  startAudio();
  S.mode = 'sail';
  $('#title').hidden = true; $('#hud').hidden = false; $('#touch').hidden = !coarse;
  camera.position.set(B.x - Math.sin(B.heading) * 30, 14, B.z - Math.cos(B.heading) * 30);
  look.set(B.x, 2, B.z);
  zoneNow = G.zoneAt(B.x, B.z); zoneSince = 0;
  const back = S.save.sold || S.save.cargo.length;
  banner(back ? 'Bon retour en mer !' : 'Port-Galet', back ? `Jour ${S.save.days + 1} · ${G.clock(S.save.time)}` : 'Ton petit port, ton petit bateau. L’archipel t’attend.');
  if (!back) setTimeout(() => toast('🧔 Joseph : « Va pêcher un peu, puis reviens au ponton (<b>E</b>) vendre tes prises ! »', 7000), 1500);
  else if (G.chapter(S.save)) setTimeout(() => toast(`📖 Histoire : ${esc(G.chapter(S.save).task)}`, 7000), 2500);
  if (G.isSunday(S.save) && S.save.contest?.day !== S.save.days) setTimeout(() => toast('🏆 C’est dimanche : concours de pêche à Port-Galet !', 6000), 4000);
}
$('#playBtn').onclick = play;
$('#newBtn').onclick = () => { if (!confirm('Recommencer une nouvelle partie ? Ta progression sera effacée.')) return; S.save = G.newSave(); persist(); applySave(); play(); };

setTimeout(() => {
  S.world = createWorld(renderer, scene, { low: LOW });
  post = createPost(renderer, scene, camera, LOW); resize();
  S.boat = buildBoat(); scene.add(S.boat.group);
  S.boat.group.traverse(o => { if (o.isMesh) o.castShadow = true; });
  wake = createWake(scene);
  Fishing.initFishing(); Traps.initTraps(); Dive.initDive();
  buildMapLand();
  applySave();
  camera.position.set(140, 50, 160); look.set(0, 8, 40);
  $('#loading').hidden = true; $('#title').hidden = false;
  $('#newBtn').hidden = !(S.save.sold || S.save.cargo.length || S.save.earned);
  $('#playBtn').textContent = S.save.sold || S.save.cargo.length ? '⛵ Reprendre la mer' : '⛵ Prendre la mer';
  requestAnimationFrame(frame);
  if (params.has('debug')) window.lf = { S, get save() { return S.save; }, B, F: Fishing.F, W, get world() { return S.world; }, get boat() { return S.boat; }, cam, camera, play, openPanel, setTime: t => (S.save.time = t), fishAction, interact, Dive, Traps };
  if (params.has('play')) play();
}, 30);
addEventListener('beforeunload', () => S.mode !== 'title' && persist());
