// Prop Hunt : accueil, salons, et la partie. Le navigateur déplace son personnage et envoie sa position ; le serveur tient
// les rôles, les déguisements, les tirs et les sifflets, et renvoie les positions (« snap ») et les effets (« fx »).
import { createView } from './render.js';

const PH = window.PH;
let MAP = PH.get('place'); // carte de la manche en cours
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const store = {
  get: k => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch { /* stockage bloqué */ } },
};
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const params = new URLSearchParams(location.search);
const socket = io('/prophunt');
const RANGE = 4;

/* ---------------- Sons (synthétisés) ---------------- */
let ac = null;
const audio = () => { if (!ac) try { ac = new AudioContext(); } catch { /* pas de son */ } if (ac?.state === 'suspended') ac.resume(); return ac; };
function blip(f0, f1, dur, type = 'sine', vol = 0.12, at = 0) {
  if (!ac) return;
  const t = ac.currentTime + at, o = ac.createOscillator(), g = ac.createGain();
  o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g).connect(ac.destination); o.start(t); o.stop(t + dur + 0.02);
}
const SFX = {
  whistle: (vol = 0.12) => { blip(1400, 1700, 0.18, 'sine', vol); blip(1700, 1300, 0.25, 'sine', vol, 0.2); },
  shot: () => blip(300, 80, 0.12, 'square', 0.08),
  found: () => [523, 659, 784, 1046].forEach((f, k) => blip(f, f, 0.18, 'triangle', 0.1, k * 0.09)),
  miss: () => blip(160, 90, 0.35, 'sawtooth', 0.08),
  poof: () => blip(400, 1200, 0.25, 'triangle', 0.08),
  tick: () => blip(520, 520, 0.1, 'square', 0.05),
  go: () => blip(880, 1320, 0.35, 'square', 0.07),
  win: () => [523, 659, 784, 1046, 1318].forEach((f, k) => blip(f, f, 0.22, 'triangle', 0.1, k * 0.11)),
  canard: v => { for (const k of [0, 0.22]) { blip(520, 380, 0.16, 'sawtooth', v * 0.7, k); blip(1040, 760, 0.16, 'square', v * 0.25, k); } },
  pet: v => noise(0.55, 90, v * 2.2, 140),
  rire: v => [0, 0.16, 0.32, 0.5, 0.66].forEach((t, k) => blip(700 - k * 40, 520 - k * 40, 0.12, 'triangle', v, t)),
  coucou: v => { blip(784, 780, 0.28, 'sine', v); blip(622, 620, 0.4, 'sine', v, 0.32); },
  radar: () => blip(1800, 600, 0.6, 'sine', 0.08),
  heart: v => { blip(70, 45, 0.12, 'sine', v); blip(65, 40, 0.12, 'sine', v * 0.7, 0.16); },
};
// Bruit filtré (pet) : un souffle grave qui vibre.
function noise(dur, freq, vol, wobble) {
  if (!ac) return;
  const t = ac.currentTime, b = ac.createBuffer(1, ac.sampleRate * dur, ac.sampleRate), d = b.getChannelData(0);
  for (let k = 0; k < d.length; k++) d[k] = Math.random() * 2 - 1;
  const src = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain(), lfo = ac.createOscillator(), lg = ac.createGain();
  src.buffer = b; f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = 6; lfo.frequency.value = 28; lg.gain.value = wobble;
  lfo.connect(lg).connect(f.frequency); lfo.start(t); lfo.stop(t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(f).connect(g).connect(ac.destination); src.start(t);
}

/* ---------------- Écrans et salons ---------------- */
let pseudo = store.get('prophunt-pseudo') || store.get('pseudo') || '';
$('#nameForm').pseudo.value = pseudo;
$('#nameForm').pseudo.oninput = e => { pseudo = e.target.value.trim().slice(0, 20); store.set('prophunt-pseudo', pseudo); };
$('#nameForm').onsubmit = e => e.preventDefault();
function show(id) {
  for (const s of $$('.screen')) s.hidden = s.id !== id;
  const playing = id === 'game';
  $('#hud').hidden = !playing;
  document.body.classList.toggle('playing', playing);
  if (!playing && document.pointerLockElement) document.exitPointerLock();
}
const needName = () => { if (pseudo) return false; $('#nameForm').pseudo.focus(); alert('Choisis d’abord un pseudo'); return true; };
const ask = (ev, payload) => new Promise(res => socket.emit(ev, payload, r => res(r)));
const act = (...a) => new Promise(res => socket.emit('act', ...a, r => { if (r?.error) toast(r.error); res(r); }));
async function enter(ev, payload) {
  if (needName()) return null;
  const r = await ask(ev, { ...payload, name: pseudo });
  if (r?.error) alert(r.error);
  return r?.ok ? r : null;
}
$('#soloBtn').onclick = async () => {
  audio();
  if (!(await enter('create', { private: true }))) return;
  for (let k = 0; k < 5; k++) await act('addBot');
  act('start');
};
$('#createForm').onsubmit = e => { e.preventDefault(); audio(); enter('create', { private: e.target.vis.value === 'private' }); };
$('#joinForm').onsubmit = e => { e.preventDefault(); audio(); enter('join', { code: e.target.code.value, watch: e.submitter?.value === 'watch' }); };
$('#rooms').onclick = e => { const b = e.target.closest('[data-room]'); if (b) { audio(); enter('join', { code: b.dataset.room, watch: b.dataset.mode === 'watch' }); } };
socket.on('rooms', list => {
  $('#rooms').innerHTML = list.length ? list.map(r => `<li><span><b class="code">${r.code}</b> · ${r.players.map(esc).join(', ')} ${r.phase !== 'lobby' ? '· 🔎 en jeu' : ''}</span>
    ${r.phase === 'lobby' ? `<button class="small primary" data-room="${r.code}">Rejoindre</button>` : ''}<button class="small ghost" data-room="${r.code}" data-mode="watch">👁</button></li>`).join('') : '<li class="hint">Aucun salon public : crée le tien !</li>';
});
const leave = () => { socket.emit('leave'); store.set('prophunt-session', null); room = null; history.replaceState(null, '', location.pathname); $('#board').hidden = true; show('home'); };
$('#leave').onclick = leave;
$('#quitGame').onclick = leave;
$('#copyLink').onclick = () => { navigator.clipboard?.writeText(`${location.origin}/prophunt/?salon=${room.code}`); $('#copyLink').textContent = '✓ Copié'; setTimeout(() => ($('#copyLink').textContent = '🔗 Copier le lien'), 1500); };
$('#addBot').onclick = () => act('addBot');
$('#startBtn').onclick = () => { audio(); act('start'); };
$('#rounds').onchange = e => act('configure', 'rounds', Number(e.target.value));
$('#hideT').onchange = e => act('configure', 'hide', Number(e.target.value));
$('#mapSel').innerHTML = [['hasard', '🎲 Au hasard (une carte par manche)'], ...PH.MAPS.map(id => [id, PH.NAMES[id]])].map(([v, l]) => `<option value="${v}">${l}</option>`).join('');
$('#mapSel').onchange = e => act('configure', 'map', e.target.value);
$('#huntT').onchange = e => act('configure', 'hunt', Number(e.target.value));
$('#players').onclick = e => { const b = e.target.closest('[data-bot]'); if (b) act('removeBot', b.dataset.bot); };
socket.on('session', s => { store.set('prophunt-session', JSON.stringify(s)); history.replaceState(null, '', `?salon=${s.code}`); });
socket.on('closed', msg => { alert(msg); leave(); });
socket.on('connect', () => {
  let s = null; try { s = JSON.parse(store.get('prophunt-session')); } catch { /* illisible */ }
  const code = params.get('salon');
  if (s && (!code || s.code === code)) socket.emit('resume', s, r => { if (r?.error) { store.set('prophunt-session', null); if (code && pseudo) enter('join', { code }); } });
  else if (code && pseudo) enter('join', { code });
});

/* ---------------- État du salon ---------------- */
let room = null, offset = 0, roundKey = '', seenFound = 0, lastCount = null;
const remotes = new Map(); // pseudo -> [{ at, x, z, ry, type, alive, hp }]
let me = null, locked = false, watching = null;
const colorOf = n => room?.players.find(p => p.name === n)?.color ?? '#ffffff';
const roleOf = n => room?.roles?.[n];
socket.on('state', s => {
  room = s;
  if (!s) return;
  offset = s.now - Date.now();
  const inGame = ['hide', 'hunt', 'roundEnd', 'over'].includes(s.phase);
  if (inGame && s.map && view.mapId !== s.map) { MAP = PH.get(s.map); view.loadMap(s.map); }
  if (inGame) show('game'); else { show('room'); $('#board').hidden = true; }
  const key = `${s.round}.${s.roundNo}`;
  if (s.phase === 'hide' && key !== roundKey) {
    roundKey = key; seenFound = 0; lastCount = null; remotes.clear();
    MAP = PH.get(s.map); view.loadMap(s.map);
    me = s.spawn && !s.spectator ? { x: s.spawn.x, z: s.spawn.z, ry: 0, type: null, alive: true, hp: 100, moving: false } : null;
    locked = false; watching = null; gadgets = { radar: true, grenade: true }; tauntAt = 0;
    // objets : la place devant soi ; chasseurs (au pied de la fontaine) : regard vers l'extérieur
    if (me) view.cam.yaw = Math.atan2(me.x, me.z) + (s.role === 'hunter' ? Math.PI : 0);
    $('#feed').innerHTML = ''; $('#board').hidden = true; $('#spectating').hidden = true;
    view.setNight(s.night, s.role === 'hunter');
    feed(`📍 ${PH.NAMES[s.map]}`);
    if (s.night) feed('🌙 Manche de nuit !');
    feed(s.role === 'hunter' ? '🎯 Tu es chasseur ! Attends que les objets se cachent.' : '🪴 Tu es un objet : transforme-toi et cache-toi !');
  }
  for (const n of s.found.slice(seenFound)) feed(n === s.me ? '😱 Tu as été trouvé !' : `🔎 ${n} a été trouvé !`);
  seenFound = s.found.length;
  if (s.phase === 'roundEnd' || s.phase === 'over') showBoard(s);
  renderRoom();
});
function renderRoom() {
  const s = room, host = s.host === s.me;
  $('#roomCode').textContent = s.code;
  $('#count').textContent = `(${s.players.length}/12)`;
  $('#players').innerHTML = s.players.map(p => `<li class="${p.connected ? '' : 'off'}"><i class="dot" style="background:${p.color}"></i><span>${esc(p.name)}${p.name === s.host ? ' 👑' : ''}${p.wins ? ` · 🏆 ${p.wins}` : ''}</span>${p.bot && host ? `<button class="small ghost" data-bot="${esc(p.name)}" aria-label="Retirer ${esc(p.name)}">✕</button>` : ''}</li>`).join('');
  $('#spect').textContent = s.spectators.length ? `👁 ${s.spectators.join(', ')}` : '';
  $('#addBot').hidden = !host; $('#rounds').disabled = !host; $('#rounds').value = s.settings.rounds;
  $('#hideT').disabled = $('#huntT').disabled = $('#mapSel').disabled = !host; $('#mapSel').value = s.settings.map; $('#hideT').value = s.settings.hide; $('#huntT').value = s.settings.hunt;
  $('#startBtn').hidden = !host; $('#startBtn').disabled = s.players.length < 2;
  $('#roomHint').textContent = host ? (s.players.length < 3 ? 'C’est plus drôle à 4 ou plus : ajoute des robots ou invite des amis.' : 'Tout le monde est là ? Lance la partie !') : 'Le créateur du salon lance la partie.';
}
function feed(text) { const li = document.createElement('li'); li.textContent = text; $('#feed').prepend(li); setTimeout(() => li.remove(), 5000); }
let toastTimer = 0;
function toast(text) { $('#aimHint').textContent = text; $('#aimHint').hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => ($('#aimHint').hidden = true), 1400); }
function showBoard(s) {
  if (document.pointerLockElement) document.exitPointerLock();
  const over = s.phase === 'over', host = s.host === s.me;
  const rows = over ? s.ranking : [...s.players].sort((a, b) => b.points - a.points);
  $('#boardTitle').textContent = over ? `🏆 ${rows[0]?.name === s.me ? 'Tu gagnes la partie !' : `${rows[0]?.name} gagne la partie !`}` : s.result?.winner === 'hunters' ? '🎯 Les chasseurs ont tout trouvé !' : '🪴 Les objets ont tenu bon !';
  $('#boardList').innerHTML = rows.map((p, k) => `<li class="${p.name === s.me ? 'me' : ''}"><b>${k + 1}</b><i class="dot" style="width:14px;height:14px;border-radius:50%;background:${p.color}"></i><span>${esc(p.name)}</span>${over ? '' : `<em>${roleOf(p.name) === 'hunter' ? '🎯' : s.result?.survivors.includes(p.name) ? '🪴 caché' : '🔎 trouvé'}</em>`}<strong>${p.points} pts</strong></li>`).join('');
  const best = !over && s.result?.best ? `🏅 Meilleure cachette : ${s.result.best}${s.result.forms?.[s.result.best] ? ` (${MAP.PROPS[s.result.forms[s.result.best]]?.name ?? ''})` : ''} · ` : '';
  $('#boardHint').textContent = over ? '' : `${best}Manche ${s.roundNo}/${s.settings.rounds} terminée · les rôles changent…`;
  const btns = $('#boardButtons'); btns.innerHTML = '';
  if (over) {
    if (host) { const b = document.createElement('button'); b.className = 'primary'; b.textContent = 'Rejouer'; b.onclick = async () => { await act('again'); act('start'); }; btns.append(b); }
    const b2 = document.createElement('button'); b2.className = 'ghost'; b2.textContent = host ? 'Retour au salon' : 'Quitter'; b2.onclick = () => (host ? act('again') : leave()); btns.append(b2);
    if (rows[0]?.name === s.me) SFX.win();
  }
  $('#board').hidden = false;
}

/* ---------------- Positions et effets reçus ---------------- */
const view = createView($('#view'));
view.resize(); addEventListener('resize', () => view.resize());
socket.on('snap', list => {
  const at = performance.now() / 1000;
  for (const [n, x, z, ry, type, alive, hp, marked] of list) {
    if (!remotes.has(n)) remotes.set(n, []);
    const b = remotes.get(n); b.push({ at, x, z, ry, type, alive, hp, marked });
    if (b.length > 10) b.shift();
    if (me && n === room?.me) { me.hp = hp; me.type = type || null; me.marked = !!marked; if (!alive && me.alive) { me.alive = false; } }
  }
});
function remoteAt(n, t) {
  const b = remotes.get(n); if (!b?.length) return null;
  let k = b.findIndex(s => s.at > t); if (k < 0) k = b.length - 1;
  const B = b[k], A = b[Math.max(0, k - 1)], f = B.at > A.at ? Math.max(0, Math.min(1, (t - A.at) / (B.at - A.at))) : 1;
  let dr = B.ry - A.ry; dr = Math.atan2(Math.sin(dr), Math.cos(dr));
  return { x: A.x + (B.x - A.x) * f, z: A.z + (B.z - A.z) * f, ry: A.ry + dr * f, type: B.type, alive: B.alive, hp: B.hp, marked: B.marked, moving: Math.hypot(B.x - A.x, B.z - A.z) > 0.01 };
}
socket.on('fx', f => {
  const d = me ? Math.hypot(f.x - me.x, f.z - me.z) : 8, near = Math.max(0.02, 0.16 * (1 - Math.min(1, d / 30)));
  if (f.kind === 'whistle') {
    const t = f.taunt ?? 'sifflet';
    view.burst(f.x, f.z, 'taunt', t);
    (t === 'sifflet' ? SFX.whistle : SFX[t])?.(near);
    if (roleOf(room?.me) === 'hunter') feed(f.forced ? '🎵 Un objet s’est trahi en sifflant !' : { sifflet: '🎵 Un objet siffle…', canard: '🦆 Coin coin ?!', pet: '💨 Quelqu’un a… pété ?', rire: '😂 Un objet se moque de toi !', coucou: '👋 Coucou !' }[t]);
    return;
  }
  view.burst(f.x, f.z, f.kind === 'hunterOut' ? 'miss' : f.kind);
  if (f.kind === 'radar' && f.by !== room?.me) { SFX.radar(); if (roleOf(room?.me) === 'prop') feed('📡 Un chasseur a lancé son radar !'); }
  if (f.kind === 'grenade') { SFX.found(); feed(f.hits.length ? `🎉 Confettis : ${f.hits.includes(room?.me) ? 'tu scintilles, bouge !' : `${f.hits.length} objet(s) touché(s) !`}` : '🎉 Confettis… dans le vide'); }
  if (f.kind === 'found') { SFX.found(); }
  if (f.kind === 'miss' && f.by === room?.me) { SFX.miss(); toast('Raté ! −12 de vie'); }
  if (f.kind === 'hunterOut') feed(f.by === room?.me ? '💀 Plus de vie : tu ne chasses plus cette manche' : `💀 ${f.by} n’a plus de vie !`);
});

/* ---------------- Commandes ---------------- */
const keys = new Set();
const canvas = $('#view');
const playing = () => document.body.classList.contains('playing');
const canMove = () => me?.alive && room && (room.phase === 'hunt' || (room.phase === 'hide' && room.role === 'prop'));
addEventListener('keydown', e => {
  if (e.target.closest?.('input, select') || !playing()) return;
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  keys.add(e.code);
  if (e.repeat) return;
  if (e.code === 'KeyE') action();
  if (e.code === 'KeyF') taunt('sifflet');
  const T = { Digit1: 'canard', Digit2: 'pet', Digit3: 'rire', Digit4: 'coucou', Numpad1: 'canard', Numpad2: 'pet', Numpad3: 'rire', Numpad4: 'coucou' }[e.code];
  if (T) taunt(T);
  if (e.code === 'KeyQ') radar();
  if (e.code === 'KeyG') grenade();
  if (e.code === 'KeyR') toggleLock();
  if (e.code === 'Tab' && !me?.alive) { e.preventDefault(); nextWatch(); }
});
addEventListener('keyup', e => keys.delete(e.code));
addEventListener('blur', () => keys.clear());
// Souris : clic dans l'image = verrouille le pointeur (la souris tourne la caméra) ; clic ensuite = action.
canvas.addEventListener('click', () => {
  if (!playing()) return;
  audio();
  if (matchMedia('(pointer: coarse)').matches) return;
  if (document.pointerLockElement !== canvas) canvas.requestPointerLock?.();
  else if (me?.alive) action(); else nextWatch();
});
addEventListener('mousemove', e => {
  if (document.pointerLockElement !== canvas) return;
  view.cam.yaw -= e.movementX * 0.0028;
  view.cam.pitch = Math.max(0.02, Math.min(1.25, view.cam.pitch + e.movementY * 0.0022));
});
// Tactile : joystick à gauche, glisser ailleurs pour regarder, boutons d'action.
const touch = { x: 0, y: 0 };
$('#touch').hidden = !matchMedia('(pointer: coarse)').matches;
{
  const stick = $('#stick'), knob = stick.querySelector('i');
  let id = null;
  const move = e => {
    const r = stick.getBoundingClientRect(), dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2), l = Math.hypot(dx, dy), m = r.width / 2, k = l > m ? m / l : 1;
    touch.x = dx * k / m; touch.y = dy * k / m; knob.style.transform = `translate(${dx * k}px, ${dy * k}px)`;
  };
  stick.addEventListener('pointerdown', e => { e.stopPropagation(); id = e.pointerId; stick.setPointerCapture(id); move(e); audio(); });
  stick.addEventListener('pointermove', e => e.pointerId === id && move(e));
  const end = () => { id = null; touch.x = touch.y = 0; knob.style.transform = ''; };
  stick.addEventListener('pointerup', end); stick.addEventListener('pointercancel', end);
  let look = null;
  canvas.addEventListener('pointerdown', e => { if (e.pointerType === 'mouse' && document.pointerLockElement === canvas) return; look = { id: e.pointerId, x: e.clientX, y: e.clientY }; });
  addEventListener('pointermove', e => {
    if (!look || e.pointerId !== look.id) return;
    view.cam.yaw -= (e.clientX - look.x) * 0.006; view.cam.pitch = Math.max(0.02, Math.min(1.25, view.cam.pitch + (e.clientY - look.y) * 0.005));
    look.x = e.clientX; look.y = e.clientY;
  });
  addEventListener('pointerup', e => { if (look?.id === e.pointerId) look = null; });
  $('#tAction').addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); audio(); me?.alive ? action() : nextWatch(); });
  $('#tWhistle').addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); $('#tauntBar').hidden = !$('#tauntBar').hidden; });
  for (const b of $$('#tauntBar [data-taunt]')) b.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); taunt(b.dataset.taunt); $('#tauntBar').hidden = true; });
  $('#tRadar').addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); radar(); });
  $('#tGrenade').addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); grenade(); });
  $('#tLock').addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); toggleLock(); });
}
// Ce qu'on vise, à portée
function aimed() {
  const a = view.aim(room?.me);
  if (!a || !me) return null;
  const d = Math.hypot(a.point.x - me.x, a.point.z - me.z);
  return d <= RANGE ? a : { ...a, far: true };
}
function action() {
  if (!me?.alive || !room) return;
  const a = aimed(), role = room.role;
  if (role === 'hunter') {
    if (room.phase !== 'hunt') return;
    if (!a) return toast('Vise un objet');
    if (a.far) return toast('Trop loin : approche-toi');
    SFX.shot();
    socket.emit('tag', a.player ? { player: a.player } : { decor: a.decor });
  } else {
    if (!a) return toast('Vise un objet de la place');
    if (a.far) return toast('Approche-toi de cet objet');
    const type = a.decor !== undefined ? MAP.decor[a.decor].type : remoteAt(a.player, performance.now() / 1000)?.type;
    if (!type || !MAP.PROPS[type]) return toast('Ça, tu ne peux pas le copier');
    act('disguise', type).then(r => { if (r?.ok) { me.type = type; SFX.poof(); view.burst(me.x, me.z, 'found'); } });
  }
}
let tauntAt = 0;
function taunt(kind) {
  if (!me?.alive || room?.role !== 'prop' || room.phase !== 'hunt') return;
  const wait = 8 - (performance.now() / 1000 - tauntAt);
  if (wait > 0) return toast(`Encore ${Math.ceil(wait)} s avant la prochaine moquerie`);
  tauntAt = performance.now() / 1000;
  socket.emit('taunt', kind);
}
// Radar : la réponse n'arrive qu'à moi (positions des objets proches, en rouge, pendant 2 s)
function radar() {
  if (!me?.alive || room?.role !== 'hunter' || room.phase !== 'hunt') return;
  if (!gadgets.radar) return toast('Radar déjà utilisé cette manche');
  gadgets.radar = false; SFX.radar();
  socket.emit('radar', pings => {
    if (!pings) return;
    toast(pings.length ? `📡 ${pings.length} objet(s) caché(s) tout près !` : '📡 Rien à moins de 7 m');
    for (const p of pings) view.burst(p.x, p.z, 'ping');
  });
}
// Grenade à confettis : là où l'on vise (jusqu'à 12 m), sinon devant soi
function grenade() {
  if (!me?.alive || room?.role !== 'hunter' || room.phase !== 'hunt') return;
  if (!gadgets.grenade) return toast('Grenade déjà lancée cette manche');
  const a = view.aim(room.me);
  let p = a?.point ?? null;
  if (!p || Math.hypot(p.x - me.x, p.z - me.z) > 12) { const y = view.cam.yaw; p = { x: me.x - Math.sin(y) * 6, z: me.z - Math.cos(y) * 6 }; }
  gadgets.grenade = false;
  socket.emit('grenade', { x: +p.x.toFixed(2), z: +p.z.toFixed(2) });
}
let gadgets = { radar: true, grenade: true };
function toggleLock() { if (room?.role !== 'prop') return; locked = !locked; toast(locked ? '🔒 Rotation bloquée' : '🔓 Rotation libre'); }
function nextWatch() {
  const alive = room?.players.map(p => p.name).filter(n => n !== room.me && remoteAt(n, performance.now() / 1000)?.alive) ?? [];
  if (!alive.length) return;
  watching = alive[(alive.indexOf(watching) + 1) % alive.length];
}

/* ---------------- Boucle de jeu ---------------- */
let last = performance.now(), lastSend = 0, heartAt = 0;
const labelEls = new Map();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  const t = now / 1000, s = room, list = [];
  const inGame = s && ['hide', 'hunt', 'roundEnd', 'over'].includes(s.phase);
  if (inGame) {
    // Les autres (100 ms de retard pour être fluides)
    for (const p of s.players) {
      if (p.name === s.me && me) continue;
      const r = remoteAt(p.name, t - 0.1);
      if (r) list.push({ name: p.name, color: p.color, hunter: roleOf(p.name) === 'hunter', ...r });
    }
    // Moi
    if (me) {
      me.moving = false;
      if (canMove()) {
        const k = c => keys.has(c);
        let fwd = (k('KeyW') || k('ArrowUp') ? 1 : 0) - (k('KeyS') || k('ArrowDown') ? 1 : 0) - touch.y;
        let side = (k('KeyD') || k('ArrowRight') ? 1 : 0) - (k('KeyA') || k('ArrowLeft') ? 1 : 0) + touch.x;
        const l = Math.hypot(fwd, side);
        if (l > 0.1) {
          fwd /= Math.max(1, l); side /= Math.max(1, l);
          const y = view.cam.yaw, fx = -Math.sin(y), fz = -Math.cos(y);
          const sp = (k('ShiftLeft') || k('ShiftRight') || l > 0.9 && touch.x ? PH.RUN : PH.SPEED) * dt;
          const vx = (fx * fwd - fz * side) * sp, vz = (fz * fwd + fx * side) * sp;
          me.x += vx; me.z += vz; me.moving = true;
          if (!me.type) me.ry = Math.atan2(vx, vz);
        }
        const others = list.filter(o => o.alive).map(o => ({ x: o.x, z: o.z, r: o.type ? MAP.PROPS[o.type].r : PH.R }));
        MAP.collide(me, me.type ? MAP.PROPS[me.type].r : PH.R, others);
        if (me.type && !locked) me.ry = view.cam.yaw + Math.PI; // l'objet se tourne comme la caméra (R pour bloquer)
      }
      if (me.alive && now - lastSend > 66) { lastSend = now; socket.volatile.emit('pos', { x: +me.x.toFixed(2), z: +me.z.toFixed(2), ry: +me.ry.toFixed(2) }); }
      list.push({ name: s.me, color: colorOf(s.me), hunter: s.role === 'hunter', x: me.x, z: me.z, ry: me.ry, type: me.type, alive: me.alive, moving: me.moving, marked: me.marked });
    }
    // Caméra : moi, sinon un joueur encore en jeu (Tab ou clic pour changer)
    let focus = me?.alive ? me : null;
    if (!focus) {
      if (!watching || !list.find(o => o.name === watching && o.alive)) watching = list.find(o => o.alive)?.name ?? null;
      focus = list.find(o => o.name === watching) ?? { x: 0, z: 6 };
    }
    view.update(list, { x: focus.x, z: focus.z, h: focus.type ? Math.min(1.2, MAP.PROPS[focus.type].h * 0.7 + 0.2) : 0.55 }, dt, t);
    hud(s, list, now);
  } else {
    view.cam.yaw += dt * 0.05;
    view.update([], { x: 0, z: 8, h: 1.5 }, dt, t);
  }
  labels(list, s);
}
function hud(s, list, now) {
  const left = Math.max(0, Math.ceil(((s.deadline ?? 0) - (Date.now() + offset)) / 1000));
  const role = s.role, alive = me?.alive;
  $('#hRole').textContent = s.spectator ? '👁 Spectateur' : role === 'hunter' ? '🎯 Chasseur' : '🪴 Objet';
  $('#hTime').textContent = s.phase === 'hide' ? `Cachette ${left} s` : s.phase === 'hunt' ? `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}` : '';
  $('#hAlive').textContent = s.roles ? `${list.filter(o => o.alive && roleOf(o.name) === 'prop').length} objet(s) caché(s)` : '';
  // compte à rebours de la fin de la cachette
  if (s.phase === 'hide' && left <= 3 && left > 0 && left !== lastCount) { lastCount = left; SFX.tick(); }
  if (s.phase === 'hunt' && lastCount !== 0) { lastCount = 0; SFX.go(); feed(role === 'hunter' ? '🎯 À la chasse !' : '🤫 Les chasseurs arrivent… ne bouge plus !'); }
  $('#blind').hidden = !(s.phase === 'hide' && role === 'hunter' && alive);
  $('#blindTime').textContent = left;
  $('#cross').hidden = !alive || !['hide', 'hunt'].includes(s.phase);
  $('#hp').hidden = role !== 'hunter' || !me;
  $('#hp i').style.width = `${me?.hp ?? 100}%`;
  $('#lockHint').hidden = !alive || document.pointerLockElement === canvas || !['hide', 'hunt'].includes(s.phase);
  $('#keys').innerHTML = !alive ? '' : role === 'hunter'
    ? `Clic / <b>E</b> : tirer sur ce qui est louche<br><b>Q</b> : radar ${gadgets.radar ? '✅' : '❌'} · <b>G</b> : grenade à confettis ${gadgets.grenade ? '✅' : '❌'}<br><b>Maj</b> : courir`
    : `Vise un objet + <b>E</b> : te transformer · <b>R</b> : bloquer ta rotation<br><b>F</b> 🎵 <b>1</b> 🦆 <b>2</b> 💨 <b>3</b> 😂 <b>4</b> 👋 : se moquer${me?.marked ? '<br>✨ <b>Tu scintilles : change de place !</b>' : ''}<br><b>Maj</b> : courir`;
  $('#tWhistle').hidden = $('#tLock').hidden = role !== 'prop'; $('#tRadar').hidden = $('#tGrenade').hidden = role !== 'hunter';
  if (role !== 'prop' || !alive) $('#tauntBar').hidden = true;
  // Battement de cœur du chasseur dans la dernière minute, plus rapide près d'un objet caché
  if (role === 'hunter' && alive && s.phase === 'hunt' && left <= 60) {
    let d = Infinity;
    for (const o of list) if (o.alive && roleOf(o.name) === 'prop') d = Math.min(d, Math.hypot(o.x - me.x, o.z - me.z));
    if (d < 5 && now - heartAt > 320 + d * 160) { heartAt = now; SFX.heart(0.25 * (1 - d / 6)); }
  }
  $('#tAction').textContent = role === 'hunter' ? '🎯' : '✨';
  const sp = $('#spectating');
  sp.hidden = alive || !s.roles || !['hide', 'hunt'].includes(s.phase);
  sp.textContent = s.spectator ? 'Tu regardes la partie · Tab ou clic : changer de joueur' : role === 'hunter' ? 'Plus de vie… tu regardes la fin de la manche (Tab : changer)' : 'Trouvé ! Tu regardes la fin de la manche (Tab : changer)';
  // Visée : ce qu'on a sous le viseur
  if (alive && ['hide', 'hunt'].includes(s.phase) && now % 120 < 20) {
    const a = aimed();
    $('#cross').classList.toggle('on', !!a && !a.far);
    view.highlight(role === 'prop' && a && !a.far && a.decor !== undefined ? a.decor : null);
    if (a && !a.far && role === 'prop' && $('#aimHint').hidden) {
      const type = a.decor !== undefined ? MAP.decor[a.decor].type : null;
      if (type && MAP.PROPS[type] && type !== me.type) { $('#aimHint').textContent = `E : devenir ${MAP.PROPS[type].name}`; $('#aimHint').hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => ($('#aimHint').hidden = true), 400); }
    }
  }
}
// Pseudos : ceux de son camp seulement (on ne dévoile pas les objets aux chasseurs) ; les chasseurs, tout le monde les voit.
function labels(list, s) {
  const box = $('#labels'), seen = new Set();
  for (const o of list) {
    if (!o.alive || o.name === s?.me) continue;
    const mine = roleOf(s?.me), theirs = roleOf(o.name);
    if (!(theirs === 'hunter' || mine === theirs || s?.spectator || !me?.alive)) continue;
    seen.add(o.name);
    let el = labelEls.get(o.name);
    if (!el) { el = document.createElement('span'); box.append(el); labelEls.set(o.name, el); }
    el.textContent = (theirs === 'hunter' ? '🎯 ' : '') + o.name;
    const [x, y, ok] = view.project(o.x, o.type ? MAP.PROPS[o.type].h + 0.25 : 0.85, o.z);
    el.style.left = `${x}px`; el.style.top = `${y}px`; el.hidden = !ok;
  }
  for (const [n, el] of labelEls) if (!seen.has(n)) { el.remove(); labelEls.delete(n); }
}
if (params.has('debug')) window.ph = { view, me: () => me, aimed }; // pour les tests
view.loadMap('place');
requestAnimationFrame(frame);
show('home');
