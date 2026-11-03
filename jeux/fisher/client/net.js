// Little Fisher à plusieurs : rejoindre un archipel partagé avec des amis (canal Socket.io « /fisher »).
// Chacun garde sa propre partie ; on voit les bateaux des autres (à leur image, avec leur nom), on partage l'heure et la météo,
// et les belles prises sont annoncées à tout le monde.
import * as THREE from 'three';
import { S } from './state.js';
import { buildBoat } from './boat.js';
import { HULL_COLORS, FLAGS, RELICS } from './data.js';
import * as G from './game.js';
import { toast, esc } from './hud.js';
import { SFX } from './audio.js';
import { $, store } from '/shared/party.js';

export const Net = { on: false, room: null, offset: 0 };
let socket = null, onEnter = () => {}, lastSend = 0;
const remotes = new Map(); // pseudo -> { b, label, snaps, key }
const tmp = new THREE.Vector3();

const styleOf = p => ({ model: p.boat.model, custom: { hull: p.boat.hull, flag: p.boat.flag, name: p.boat.name, mascot: null } });
function addRemote(p) {
  const b = buildBoat();
  b.setStyle(p.boat.model, styleOf(p).custom, { colors: HULL_COLORS, flags: FLAGS, relics: RELICS });
  b.setLevels({ coque: p.boat.coque, moteur: p.boat.moteur, lanterne: p.boat.lanterne, cale: 1, canne: 1 });
  b.group.visible = false; S.scene.add(b.group);
  const label = Object.assign(document.createElement('span'), { textContent: p.name }); $('#netLabels').append(label);
  remotes.set(p.name, { b, label, snaps: [], key: JSON.stringify(p.boat) });
}
function dropRemote(name) { const r = remotes.get(name); if (!r) return; S.scene.remove(r.b.group); r.label.remove(); remotes.delete(name); }
function syncRemotes(players) {
  const others = players.filter(p => p.name !== Net.room.me);
  for (const name of [...remotes.keys()]) if (!others.some(p => p.name === name)) dropRemote(name);
  for (const p of others) {
    const r = remotes.get(p.name);
    if (r && r.key !== JSON.stringify(p.boat)) dropRemote(p.name); // son bateau a changé : on le redessine
    if (!remotes.has(p.name)) addRemote(p);
    remotes.get(p.name).online = p.connected;
  }
}

// Connexion (au premier besoin) et messages du serveur
export function connect(enter) {
  if (enter) onEnter = enter;
  if (socket) return socket;
  socket = io('/fisher');
  socket.on('rooms', list => {
    $('#roomList').innerHTML = list.length ? list.map(r => `<li><div class="grow"><b>${r.players.map(esc).join(', ')}</b><small>${r.players.length} pêcheur${r.players.length > 1 ? 's' : ''}</small></div><button class="small primary" data-room="${r.code}">Rejoindre</button></li>`).join('')
      : '<li class="empty">Aucun archipel public pour l’instant : crée le tien !</li>';
  });
  socket.on('session', s => { store.set('fisher-session', JSON.stringify(s)); history.replaceState(null, '', `?salon=${s.code}`); });
  socket.on('state', s => {
    const first = !Net.room;
    Net.room = s; Net.on = true; Net.offset = s.time - Date.now();
    syncRemotes(s.players);
    renderRoom();
    if (first) { sendBoat(); onEnter(); toast(`👥 Archipel <b>${s.code}</b> : ${s.players.length} pêcheur${s.players.length > 1 ? 's' : ''}. Invite tes amis avec le code !`, 6000); }
    else if (s.players.length > prevCount) { SFX.horn(); toast(`👋 <b>${esc(s.players.at(-1).name)}</b> arrive dans l’archipel !`); }
    prevCount = s.players.length;
  });
  socket.on('pos', (name, a) => {
    const r = remotes.get(name); if (!r) return;
    r.snaps.push({ t: performance.now(), x: a[0], z: a[1], h: a[2], v: a[3], fishing: !!a[4] });
    if (r.snaps.length > 20) r.snaps.shift();
  });
  socket.on('catch', (name, c) => {
    const f = G.fishById(c.fish); if (!f) return;
    toast(`🎣 <b>${esc(name)}</b> a pêché ${f.rarity === 'legende' ? '⭐ ' : ''}<b>${esc(f.name)}</b> (${c.size} cm) !`, 5000);
  });
  socket.on('closed', msg => { toast(msg); leave(); });
  socket.on('connect', () => {
    let s = null; try { s = JSON.parse(store.get('fisher-session')); } catch { /* illisible */ }
    const code = new URLSearchParams(location.search).get('salon');
    if (s && (!code || code === s.code)) socket.emit('resume', s, r => { if (r?.error) store.set('fisher-session', null); });
  });
  return socket;
}
let prevCount = 0;
const ask = (ev, payload) => new Promise(res => connect().emit(ev, payload, r => res(r)));
export async function create(name, isPrivate) { const r = await ask('create', { name, private: isPrivate }); if (r?.error) toast(r.error); return !r?.error; }
export async function join(name, code) { const r = await ask('join', { name, code }); if (r?.error) toast(r.error); return !r?.error; }
export function leave() {
  socket?.emit('leave'); store.set('fisher-session', null);
  Net.on = false; Net.room = null; prevCount = 0;
  for (const name of [...remotes.keys()]) dropRemote(name);
  history.replaceState(null, '', location.pathname);
  renderRoom();
}
// Ce que les autres doivent voir de mon bateau
export function sendBoat() {
  if (!Net.on) return;
  const s = S.save;
  socket.emit('act', 'setBoat', { model: s.model, hull: s.custom.hull, flag: s.custom.flag, name: s.custom.name, coque: s.levels.coque, moteur: s.levels.moteur, lanterne: s.levels.lanterne });
}
export function sendCatch(f, size) { if (Net.on && (f.rarity !== 'commun' || Math.random() < 0.3)) socket.emit('catch', { fish: f.id, size }); }
// Heure du jour commune au salon
export const timeOfDay = () => { const r = Net.room; return (r.day0 + (Date.now() + Net.offset - r.start) / r.dayMs) % 1; };

// Chaque image : envoyer ma position, placer les bateaux des autres (avec 150 ms de retard, pour interpoler en douceur)
export function update(dt, fishing) {
  if (!Net.on) return;
  const now = performance.now(), B = S.B;
  if (now - lastSend > 100 && S.mode !== 'title') { lastSend = now; socket.volatile.emit('pos', [Math.round(B.x * 10) / 10, Math.round(B.z * 10) / 10, Math.round(B.heading * 1000) / 1000, Math.round(B.speed * 10) / 10, fishing ? 1 : 0]); }
  const t = now - 150;
  for (const r of remotes.values()) {
    const s = r.snaps, last = s.at(-1);
    const show = r.online && last && now - last.t < 6000;
    r.b.group.visible = !!show; r.label.hidden = !show;
    if (!show) continue;
    let i = s.length - 1; while (i > 0 && s[i].t > t) i--;
    const a = s[i], b = s[i + 1] ?? a, k = b.t > a.t ? Math.min(1, Math.max(0, (t - a.t) / (b.t - a.t))) : 1;
    const x = a.x + (b.x - a.x) * k, z = a.z + (b.z - a.z) * k, dh = Math.atan2(Math.sin(b.h - a.h), Math.cos(b.h - a.h));
    const w = S.world.waveAt(x, z, S.time, S.amp);
    r.b.group.position.set(x, w.h + 0.05, z); r.b.group.rotation.y = a.h + dh * k;
    r.b.body.rotation.x = -Math.atan(w.dz * 1.4) * 0.8; r.b.body.rotation.z = Math.atan(w.dx * 1.4) * 0.8;
    r.b.fisher.rotation.y = b.fishing ? -Math.PI / 2 + 0.3 : 0;
    r.b.tick(dt, S.world.state.night, Math.min(1, Math.abs(b.v) / 15));
    // le nom au-dessus du bateau
    tmp.set(x, w.h + 5, z).project(S.camera);
    const on = tmp.z < 1 && Math.abs(tmp.x) < 1.1 && Math.abs(tmp.y) < 1.1;
    r.label.hidden = !on;
    if (on) { r.label.style.left = `${(tmp.x + 1) / 2 * innerWidth}px`; r.label.style.top = `${(1 - tmp.y) / 2 * innerHeight}px`; }
  }
}

// Fenêtre « Avec des amis » et pastille du salon
function renderRoom() {
  const r = Net.room;
  $('#hRoom').hidden = !r;
  if (r) $('#hRoom').textContent = `👥 ${r.code} · ${r.players.filter(p => p.connected).length}`;
  $('#multiIn').hidden = !r; $('#multiOut').hidden = !!r;
  if (r) {
    $('#multiCode').textContent = r.code;
    $('#multiPlayers').innerHTML = r.players.map(p => `<li><span>${p.boat.model === 'voilier' ? '⛵' : p.boat.model === 'chalutier' ? '🚢' : '🛶'}</span><div class="grow"><b>${esc(p.name)}</b>${p.name === r.me ? ' (toi)' : ''}<small>« ${esc(p.boat.name)} »${p.connected ? '' : ' · déconnecté'}</small></div></li>`).join('');
  }
}
export const roomLink = () => `${location.origin}/fisher/?salon=${Net.room?.code ?? ''}`;
