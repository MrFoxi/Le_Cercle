// Mini-golf : menus, vestiaire et profil, salon et réglages, partie (visée au lance-pierre avec effet, trajectoires du
// serveur rejouées au même moment chez tout le monde, effets, caméra, ralentis), paris, émotes, chat, succès.
/* global io, Golf, GolfHoles, GolfLooks */
import { createRenderer, drawBall, drawClub } from './render.js';
import { startAudio, setAudio, settings as audioSettings, sfx, setMood } from './audio.js';
import { loadProfile, saveProfile, unlocked, onHole, onGame, onEvent } from './profile.js';

const socket = io('/golf');
const { FPS, label } = Golf;
const { CATALOG, ACHIEVEMENTS, hexOf, titleOf } = GolfLooks;
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);
const store = {
  get: k => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { v === null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch { /* stockage bloqué */ } },
};
const params = new URLSearchParams(location.search);
const urlCode = params.get('salon')?.toUpperCase();
const EMOTES = ['👏', '😂', '😱', '🔥', '😎', '🙏', '💩', '❤️'];
const MODES = {
  tour: ['🎯 Chacun son tour', 'Les balles se cognent : vise celles des autres !'],
  simul: ['⚡ Tous en même temps', 'Personne n’attend, balles fantômes.'],
  course: ['🏁 Course', 'Tous en même temps : le premier dans le trou marque le plus de points.'],
  elim: ['💀 Mort subite', 'Le pire score de chaque trou est éliminé.'],
  equipes: ['🤝 Par équipes', '2 équipes : le meilleur score de l’équipe compte.'],
};
const TEAMS = [['🌞 Soleil', '#ff9a1f'], ['🌙 Lune', '#5b6cff']];
let state = null, clockOffset = -Infinity, profile = loadProfile();
const serverNow = () => Date.now() + clockOffset;
if (params.has('debug')) window.__golf = () => state; // ?debug : pour les tests automatiques

function show(id) { for (const s of $$('.screen')) s.hidden = s.id !== id; if (id === 'home' || id === 'name') heroLoop(); }
function toast(text, kind = '') {
  const t = document.createElement('div');
  t.className = `toast ${kind}`;
  t.textContent = text;
  $('#toasts').append(t);
  setTimeout(() => t.remove(), 3300);
  while ($('#toasts').children.length > 4) $('#toasts').firstChild.remove();
}
function bigText(text, gold = false) {
  const b = $('#bigText');
  b.textContent = text;
  b.className = gold ? 'gold' : '';
  void b.offsetWidth; // relance l'animation
  b.classList.add('show');
}
function act(button, ...args) {
  if (button) button.disabled = true;
  socket.emit('act', ...args, res => {
    if (button) button.disabled = false;
    if (res?.error) toast(res.error);
  });
}
addEventListener('pointerdown', () => startAudio());

/* ---------- Pseudo, accueil, salons ---------- */
let pseudo = store.get('golf-pseudo') || store.get('p4-pseudo') || '';
function entry() {
  $('#meName').textContent = pseudo;
  $('#nameForm').pseudo.value = pseudo;
  renderProfile();
  show(pseudo ? 'home' : 'name');
}
$('#nameForm').onsubmit = e => {
  e.preventDefault();
  pseudo = e.target.pseudo.value.trim().slice(0, 20);
  if (!pseudo) return;
  store.set('golf-pseudo', pseudo);
  entry();
};
$('#changeName').onclick = e => { e.preventDefault(); show('name'); $('#nameForm').pseudo.focus(); };
function reset() {
  store.set('golf-session', null);
  state = null;
  anims.clear();
  setMood(null);
  $('#overlay').hidden = true;
  history.replaceState(null, '', location.pathname);
  entry();
}
socket.on('closed', msg => { toast(msg); reset(); });
function enter(event, payload, button) {
  if (button) button.disabled = true;
  socket.emit(event, payload, res => {
    if (button) button.disabled = false;
    if (res?.error) toast(res.error);
  });
}
$('#createForm').onsubmit = e => { e.preventDefault(); enter('create', { name: pseudo, private: e.target.vis.value === 'private' }, e.submitter); };
$('#joinForm').onsubmit = e => { e.preventDefault(); enter('join', { code: e.target.code.value, name: pseudo, watch: e.submitter?.value === 'watch' }, e.submitter); };
$('#joinForm').code.oninput = e => (e.target.value = e.target.value.toUpperCase());
document.addEventListener('click', e => {
  if (e.target.closest('[data-leave]')) {
    if (state?.phase === 'playing' && !state.spectator && !confirm('Quitter la partie en cours ?')) return;
    socket.emit('leave');
    reset();
  }
  const b = e.target.closest('[data-room]');
  if (b) enter('join', { code: b.dataset.room, name: pseudo, watch: b.dataset.mode === 'watch' }, b);
});
socket.on('session', s => { store.set('golf-session', JSON.stringify(s)); history.replaceState(null, '', `?salon=${s.code}${params.has('debug') ? '&debug' : ''}`); });
socket.on('connect', () => {
  let s = null;
  try { s = JSON.parse(store.get('golf-session')); } catch { /* session illisible */ }
  if (s && (!urlCode || urlCode === s.code)) {
    socket.emit('resume', s, res => {
      if (!res?.error) return;
      store.set('golf-session', null);
      toast(res.error);
      entry();
    });
  } else if (urlCode) $('#joinForm').code.value = urlCode;
});
socket.on('rooms', list => {
  const status = r => (r.phase === 'lobby' ? `${r.players.length}/8 joueurs · en attente` : r.phase === 'over' ? 'Partie terminée' : 'Partie en cours');
  $('#rooms').innerHTML = list.length ? list.map(r => `<li><div><b>${r.players.map(esc).join(', ')}</b><small>${status(r)}${r.spectators ? ` · 👁 ${r.spectators}` : ''}</small></div>
    ${r.phase === 'lobby' && r.players.length < 8 ? `<button class="primary small" data-room="${r.code}" data-mode="play">Rejoindre</button>` : ''}
    <button class="ghost small" data-room="${r.code}" data-mode="watch">👁 Regarder</button></li>`).join('')
    : '<li class="empty">Aucun salon public pour l’instant. Crée le tien !</li>';
});

/* ---------- Petites scènes animées : accueil et vestiaire ---------- */
let heroRunning = false;
function heroLoop() {
  if (heroRunning) return;
  heroRunning = true;
  const tick = now => {
    const canvases = $$('.hero-canvas').filter(c => c.offsetParent), locker = $('#lockerCanvas');
    if (!canvases.length && !locker.offsetParent) { heroRunning = false; return; }
    for (const c of canvases) drawHero(c, now / 1000);
    if (locker.offsetParent) drawLocker(locker, now / 1000);
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}
function miniGreen(c, w, h) {
  c.fillStyle = '#5ec462'; c.fillRect(0, 0, w, h);
  c.fillStyle = 'rgba(255,255,255,.07)'; for (let x = 0; x < w; x += 40) c.fillRect(x, 0, 20, h);
  c.strokeStyle = '#9a6431'; c.lineWidth = 12; c.strokeRect(6, 6, w - 12, h - 12);
  c.strokeStyle = '#e7b276'; c.lineWidth = 2; c.strokeRect(2, 2, w - 4, h - 4);
}
function drawHero(cv, t) {
  const c = cv.getContext('2d'), w = cv.width, h = cv.height, cup = [w * 0.78, h * 0.5];
  miniGreen(c, w, h);
  c.fillStyle = 'rgba(255,255,255,.5)'; c.beginPath(); c.arc(cup[0], cup[1], 16, 0, 7); c.fill();
  c.fillStyle = '#0d1510'; c.beginPath(); c.arc(cup[0], cup[1], 11, 0, 7); c.fill();
  const cycle = t % 3.2, k = Math.min(1, cycle / 2.2), e = 1 - (1 - k) ** 3;
  const sx = w * 0.15, sy = h * 0.68, x = sx + (cup[0] - sx) * e, y = sy + (cup[1] - sy) * e + Math.sin(e * Math.PI) * -h * 0.18;
  if (k < 1) drawBall(c, x, y, 9, profile.look, t, [x, y]);
  else if (cycle < 2.6) { c.font = '900 26px "Baloo 2", sans-serif'; c.fillStyle = '#fff'; c.textAlign = 'center'; c.fillText('⛳ Trou en un !', w / 2, 40); }
  c.strokeStyle = '#eee'; c.lineWidth = 2.5; c.beginPath(); c.moveTo(cup[0], cup[1]); c.lineTo(cup[0] + 4, cup[1] - 52); c.stroke();
  c.fillStyle = '#ff4d5a'; c.beginPath(); c.moveTo(cup[0] + 4, cup[1] - 52); c.quadraticCurveTo(cup[0] + 20, cup[1] - 50 + Math.sin(t * 4) * 3, cup[0] + 34, cup[1] - 44); c.lineTo(cup[0] + 4, cup[1] - 34); c.fill();
}
const lockerTrail = [];
function drawLocker(cv, t) {
  const c = cv.getContext('2d'), w = cv.width, h = cv.height, look = profile.look;
  miniGreen(c, w, h);
  const a = t * 1.3, x = w / 2 + Math.cos(a) * w * 0.3, y = h / 2 + Math.sin(a) * h * 0.25;
  lockerTrail.push([x, y]); if (lockerTrail.length > 22) lockerTrail.shift();
  if (look.trail !== 'aucune') for (let i = 1; i < lockerTrail.length; i++) {
    const f = i / lockerTrail.length;
    c.globalAlpha = f * 0.6; c.lineCap = 'round'; c.lineWidth = 14 * f;
    c.strokeStyle = look.trail === 'arcenciel' ? `hsl(${(t * 300 + i * 25) % 360},90%,60%)` : look.trail === 'flammes' ? '#ff9a1f' : look.trail === 'bulles' ? '#bfe9ff' : look.trail === 'coeurs' ? '#ff6f9a' : look.trail === 'etincelles' ? '#ffe27a' : hexOf(look.color);
    c.beginPath(); c.moveTo(...lockerTrail[i - 1]); c.lineTo(...lockerTrail[i]); c.stroke();
  }
  c.globalAlpha = 1;
  drawBall(c, x, y, 16, look, t, [x * 2, y * 2]);
  drawClub(c, w * 0.18, h * 0.5, 0, 20 + Math.sin(t * 3) * 15, look, t);
  drawBall(c, w * 0.18, h * 0.5, 10, look, t);
}

/* ---------- Vestiaire et profil ---------- */
const KINDS = { color: '🎨 Couleur', motif: '🌀 Motif', finish: '✨ Finition', trail: '💫 Traînée', sink: '🎉 Victoire', club: '🏌 Club' };
let lockerTab = 'color';
function renderProfile() {
  $('#myPoints').textContent = `⭐ ${profile.points} pts`;
  $('#meTitle').textContent = profile.look.title ? `· ${titleOf(profile.look.title)}` : '';
  $('#lockerTabs').innerHTML = Object.entries(KINDS).map(([k, n]) => `<button class="ghost small ${k === lockerTab ? 'on' : ''}" data-tab="${k}">${n}</button>`).join('');
  $('#lockerItems').innerHTML = CATALOG[lockerTab].map(i => {
    const ok = unlocked(profile, lockerTab, i.id), on = profile.look[lockerTab] === i.id;
    return `<button class="chip-btn ${on ? 'on' : ''} ${ok ? '' : 'locked'}" data-item="${i.id}" ${ok ? '' : `title="Débloqué à ${i.need} points"`}>${lockerTab === 'color' ? `<i style="--c:${i.hex}"></i>` : ''}${esc(i.name)}${ok ? '' : ` 🔒 ${i.need}`}</button>`;
  }).join('');
  const titles = ACHIEVEMENTS.filter(a => profile.ach[a.id]);
  $('#titleSelect').innerHTML = `<option value="">— aucun —</option>${titles.map(a => `<option value="${a.id}" ${profile.look.title === a.id ? 'selected' : ''}>${esc(a.title)}</option>`).join('')}`;
  const s = profile.stats;
  $('#stats').innerHTML = [[s.games, 'parties'], [s.wins, 'victoires'], [s.holes, 'trous joués'], [s.aces, 'trous en un'], [s.birdies, 'birdies ou mieux'], [s.waters, 'balles à l’eau']]
    .map(([v, n]) => `<div><b>${v}</b><small>${n}</small></div>`).join('');
  $('#achCount').textContent = `${titles.length}/${ACHIEVEMENTS.length}`;
  $('#achievements').innerHTML = ACHIEVEMENTS.map(a => `<li class="${profile.ach[a.id] ? 'got' : ''}"><b>${profile.ach[a.id] ? '🏆' : '🔒'} ${esc(a.name)}</b>${esc(a.desc)}</li>`).join('');
}
$('#lockerTabs').onclick = e => { const b = e.target.closest('[data-tab]'); if (b) { lockerTab = b.dataset.tab; renderProfile(); } };
$('#lockerItems').onclick = e => {
  const b = e.target.closest('[data-item]');
  if (!b) return;
  if (!unlocked(profile, lockerTab, b.dataset.item)) return toast(`Encore ${CATALOG[lockerTab].find(i => i.id === b.dataset.item).need - profile.points} points pour le débloquer`, 'info');
  profile.look[lockerTab] = b.dataset.item;
  saveProfile(profile);
  sfx.click();
  renderProfile();
  syncLook(true);
};
$('#titleSelect').onchange = e => { profile.look.title = e.target.value; saveProfile(profile); renderProfile(); syncLook(true); };
// Ma tenue est envoyée au salon (les autres la voient)
function syncLook(force) {
  const me = state?.players?.find(p => p.name === state.me);
  if (!me || state.spectator) return;
  if (force || JSON.stringify(me.look) !== JSON.stringify(profile.look)) socket.emit('act', 'setLook', profile.look);
}

/* ---------- Salon d'attente ---------- */
$('#copyLink').onclick = () => navigator.clipboard.writeText(`${location.origin}${location.pathname}?salon=${state.code}`)
  .then(() => toast('Lien copié : envoie-le à tes amis !', 'ok'), () => toast('Copie impossible'));
$('#startBtn').onclick = e => act(e.target, 'start');
$('#addBot').onclick = e => act(e.target, 'addBot');
const ballDot = p => `<i class="ball${p.connected ? '' : ' off'}" style="--c:${hexOf(p.look?.color)}"></i>`;
function renderWait(s) {
  show('wait');
  $('#overlay').hidden = true;
  const host = s.me === s.host && !s.spectator;
  $('#waitCode').textContent = s.code;
  $('#waitPrivacy').textContent = s.private ? '🔒 Salon privé : partage le code pour inviter' : '🌍 Salon public : visible dans la liste';
  $('#notice').hidden = !s.notice;
  $('#notice').textContent = s.notice ?? '';
  $('#waitPlayers').innerHTML = s.players.map(p => `<li>${ballDot(p)}<span><b>${esc(p.name)}</b>${p.look.title ? ` <span class="t">${esc(titleOf(p.look.title))}</span>` : ''}</span>
    ${p.bot ? '<small>robot</small>' : ''}${p.name === s.host ? '<small>créateur</small>' : ''}${p.name === s.me ? '<small>toi</small>' : ''}
    ${p.bot && host ? `<button class="ghost small x" data-unbot="${esc(p.name)}" title="Retirer">✕</button>` : `<span class="wins">${p.wins ? `🏆 ${p.wins}` : p.connected ? '' : 'déconnecté'}</span>`}</li>`).join('')
    + (s.players.length < 8 ? '<li class="hint">En attente d’autres joueurs… (jusqu’à 8)</li>' : '');
  $('#addBot').hidden = !host || s.players.length >= 8;
  $('#waitWatchers').hidden = !s.spectators.length;
  $('#waitWatchers').textContent = `👁 Spectateurs : ${s.spectators.join(', ')}`;
  const ready = s.players.every(p => p.connected), b = $('#startBtn');
  b.hidden = s.spectator;
  b.disabled = !(ready && host);
  b.textContent = s.me !== s.host ? `${s.host} va lancer la partie…` : s.players.length < 2 ? '⛳ Jouer seul (ou ajoute un robot)' : `⛳ Lancer la partie (${s.players.length} joueurs)`;
  renderSettings(s, host);
  renderChat(s, '#waitChat');
}
$('#waitPlayers').onclick = e => { const b = e.target.closest('[data-unbot]'); if (b) act(b, 'removeBot', b.dataset.unbot); };
function renderSettings(s, host) {
  const st = s.settings;
  $('#settingsHint').textContent = host ? 'Tu choisis : les autres voient tes réglages en direct.' : `${s.host} règle la partie.`;
  $('#optCourse').innerHTML = Object.entries(GolfHoles.COURSES).map(([k, c]) => `<button data-set="course" data-v="${k}" class="${st.course === k ? 'on' : ''}" ${host ? '' : 'disabled'}><b>${esc(c.name)}</b><small>${esc(c.desc)}</small></button>`).join('');
  $('#optMode').innerHTML = Object.entries(MODES).map(([k, [n, d]]) => `<button data-set="mode" data-v="${k}" class="${st.mode === k ? 'on' : ''}" ${host ? '' : 'disabled'}><b>${n}</b><small>${d}</small></button>`).join('');
  const sel = (key, opts) => `<select data-set="${key}" ${host ? '' : 'disabled'}>${opts.map(([v, n]) => `<option value="${v}" ${String(st[key]) === String(v) ? 'selected' : ''}>${n}</option>`).join('')}</select>`;
  $('#optMore').innerHTML = `
    <label>🌀 Mode chaos <input type="checkbox" data-set="chaos" ${st.chaos ? 'checked' : ''} ${host ? '' : 'disabled'}></label>
    <label>🎲 Paris entre amis <input type="checkbox" data-set="bets" ${st.bets ? 'checked' : ''} ${host ? '' : 'disabled'}></label>
    <label>⏱ Temps pour tirer ${sel('aim', [[15, '15 s'], [30, '30 s'], [60, '60 s']])}</label>
    <label>⛳ Coups max ${sel('max', [[2, 'par + 2'], [3, 'par + 3'], [5, 'par + 5']])}</label>
    <label>🎯 Aide à la visée ${sel('assist', [[0, 'Aucune'], [1, 'Courte'], [2, 'Complète']])}</label>`;
}
$('#settingsCard').addEventListener('click', e => { const b = e.target.closest('button[data-set]'); if (b && !b.disabled) act(null, 'configure', b.dataset.set, b.dataset.v); });
$('#settingsCard').addEventListener('change', e => {
  const el = e.target.closest('[data-set]');
  if (!el) return;
  act(null, 'configure', el.dataset.set, el.type === 'checkbox' ? el.checked : Number(el.value));
});

/* ---------- Chat et émotes ---------- */
let chatSeen = 0;
function renderChat(s, sel) {
  const list = s.chat ?? [];
  $(sel).innerHTML = list.slice(-40).map(m => { const p = s.players.find(x => x.name === m.name); return `<li class="${m.name === s.me ? 'me' : ''}"><b style="--c:${p ? hexOf(p.look.color) : '#5d786a'}">${esc(m.name)}</b> ${esc(m.text)}</li>`; }).join('');
  $(sel).scrollTop = 1e6;
  const lastId = list.at(-1)?.id ?? 0;
  if (lastId > chatSeen && chatSeen && list.at(-1).name !== s.me) sfx.pop();
  chatSeen = lastId;
}
document.addEventListener('submit', e => {
  if (!e.target.matches('[data-chat]')) return;
  e.preventDefault();
  const text = e.target.msg.value.trim();
  if (text) socket.emit('chat', text);
  e.target.msg.value = '';
});
$('#emotes').innerHTML = EMOTES.map(e => `<button data-emote="${e}" title="Émote">${e}</button>`).join('');
$('#emotes').onclick = e => { const b = e.target.closest('[data-emote]'); if (b) socket.emit('emote', b.dataset.emote); };
socket.on('emote', (name, e) => {
  sfx.pop();
  const pos = ballPos.get(name);
  if (pos && !pos.hidden) renderer.float(pos.x, pos.y - 26, e, { size: 34, life: 2 });
  else renderer.float(0.5, 0.15, `${name} ${e}`, { size: 26, life: 2, screen: true });
});

/* ---------- Partie : état reçu du serveur ---------- */
const renderer = createRenderer($('#course'));
const anims = new Map(); // tir en cours de lecture -> { shot, fired }
const ballPos = new Map(), rolls = new Map();
let hole = null, holeKey = '', overlayKey = '', lastNotice = null, lastBet = null, sent = null, overKey = '', introUntil = 0, bestShot = null, replay = null;
let mine = null; // ce que je retiens du trou en cours pour mes succès
let gameMem = { streak: 0, waters: 0 };
socket.on('state', s => {
  clockOffset = Math.max(clockOffset, s.now - Date.now()); // la latence ne peut que retarder : on garde le plus grand écart
  const prev = state;
  state = s;
  if (s.phase === 'lobby') { anims.clear(); overlayKey = holeKey = ''; setMood(null); syncLook(); return renderWait(s); }
  show('game');
  syncLook();
  const key = `${s.round}:${s.holeNo}`;
  if (key !== holeKey) newHole(key);
  for (const shot of s.shots) if (!anims.has(shot.id)) startAnim(shot);
  if (s.notice && s.notice !== lastNotice) toast(s.notice, 'info');
  lastNotice = s.notice;
  if (s.betResult && JSON.stringify(s.betResult) !== JSON.stringify(lastBet) && s.betResult.winners.includes(s.me)) { sfx.coin(); toast(`🎲 Pari gagné : +${s.betResult.points} points !`, 'gold'); }
  lastBet = s.betResult;
  if (myTurnStart(prev, s)) { sfx.turn(); navigator.vibrate?.(30); }
  if (s.stage === 'holeEnd' && prev?.stage !== 'holeEnd') onHoleEnd(s);
  if (s.phase === 'over' && overKey !== `${s.round}`) { overKey = `${s.round}`; onGameOver(s); }
  renderHud();
  renderOverlay();
  renderChat(s, '#gameChat');
  renderBets();
});
const turnModeOf = s => ['tour', 'elim', 'equipes'].includes(s.settings.mode);
const turnMode = () => turnModeOf(state);
const myBall = () => state?.balls?.[state.me];
function canAim() {
  const b = myBall();
  if (!b || state.spectator || state.phase !== 'playing' || state.stage !== 'play' || b.done || b.rolling || sent === `${state.round}:${state.holeNo}:${b.n}` || replay) return false;
  return turnMode() ? state.turn === state.me && !state.shots.length : true;
}
function myTurnStart(prev, s) {
  const ready = x => x && x.stage === 'play' && x.balls?.[s.me] && !x.balls[s.me].done && (turnModeOf(x) ? x.turn === s.me && !x.shots.length : !x.balls[s.me].rolling);
  return !s.spectator && ready(s) && !ready(prev);
}
function newHole(key) {
  holeKey = key;
  hole = GolfHoles.resolve(state.course[state.holeNo]);
  anims.clear();
  ballPos.clear();
  replay = null;
  $('#replayTag').hidden = true;
  renderer.setHole(hole);
  setMood(hole.theme);
  mine = { waters: 0, holedShot: null };
  // Entrée du trou : bandeau, caméra qui part du drapeau et recule sur tout le parcours
  const b = $('#banner');
  b.innerHTML = `<small>Trou ${state.holeNo + 1} sur ${state.course.length}</small><b>${esc(hole.name)}</b><span>Par ${hole.par}</span>${state.chaos ? `<span class="chaos">${esc(state.chaos.name)} · ${esc(state.chaos.desc)}</span>` : ''}`;
  b.hidden = false;
  b.style.animation = 'none'; void b.offsetWidth; b.style.animation = '';
  renderer.focus(hole.cup[0], hole.cup[1], 2);
  renderer.snap();
  introUntil = performance.now() + 1500;
  setTimeout(() => (b.hidden = true), 2700);
}

function startAnim(shot) {
  anims.set(shot.id, { shot, fired: 0 });
  const p = state.players.find(x => x.name === shot.name), me = state.balls[shot.name];
  sfx.hit(0.6);
  if (shot.name === state.me) navigator.vibrate?.(15);
  if (me) renderer.burst(me.x, me.y, 8, ['#ffffff', 'rgba(255,255,255,.6)', hexOf(p?.look.color)], { speed: 70, life: 0.4, size: 2.5 });
}
// Position d'une balle à l'image f d'un tir (trajectoire du serveur, interpolée sauf à travers un téléporteur)
function pathAt(path, f) {
  const k = f - path.s, p = path.p;
  if (k <= 0) return { x: p[0][0], y: p[0][1], z: p[0][2] || 0, end: false };
  const i = Math.min(p.length - 1, Math.floor(k)), j = Math.min(p.length - 1, i + 1), u = Math.min(1, k - i), a = p[i], b = p[j];
  const jump = Math.hypot(b[0] - a[0], b[1] - a[1]) > 50;
  return { x: jump ? a[0] : a[0] + (b[0] - a[0]) * u, y: jump ? a[1] : a[1] + (b[1] - a[1]) * u, z: (a[2] || 0) + ((b[2] || 0) - (a[2] || 0)) * u, end: k >= p.length - 1 };
}

// Un événement du tir : sons, particules, textes, et ce qu'il faut retenir pour les succès
function fire(shot, e, isReplay = false) {
  const theme = hole.theme, isMe = !isReplay && e.n === state.me, shooterMe = !isReplay && shot.name === state.me;
  const p = state.players.find(x => x.name === e.n), look = p?.look ?? GolfLooks.DEFAULT;
  switch (e.type) {
    case 'bump': sfx.bump(); break;
    case 'bump2': sfx.bump2(); renderer.shake(0.35); renderer.burst(e.x, e.y, 10, ['#fff', '#ffe066'], { speed: 90, life: 0.4 }); break;
    case 'clack': sfx.clack(); renderer.burst(e.x, e.y, 12, ['#fff', '#ffe27a'], { speed: 110, life: 0.35, shape: 'star', size: 4 }); renderer.shake(0.2); break;
    case 'kick': sfx.kick(); renderer.burst(e.x, e.y, 14, ['#ff3d5a', '#ffd23f'], { speed: 140, life: 0.4, shape: 'star', size: 4 }); break;
    case 'jump': sfx.jump(); if (isMe) mine.jumped = true; break;
    case 'land': sfx.land(); renderer.burst(e.x, e.y, 10, ['rgba(255,255,255,.7)', 'rgba(120,90,60,.6)'], { speed: 70, life: 0.5, shape: 'circle', size: 3 }); renderer.shake(0.15); break;
    case 'tp': case 'pipe': sfx[e.type](); renderer.burst(e.x, e.y, 22, ['#c49bff', '#7bd3ff', '#fff'], { speed: 130, life: 0.6, shape: 'star', size: 4 }); if (isMe) mine.shortcut = true; break;
    case 'tpout': case 'pipeout': renderer.burst(e.x, e.y, 16, ['#c49bff', '#7bd3ff', '#fff'], { speed: 100, life: 0.5, shape: 'star', size: 4 }); break;
    case 'spring': sfx.spring(); renderer.burst(e.x, e.y, 12, ['#ff4f9a', '#fff'], { speed: 130, life: 0.5 }); break;
    case 'plate': sfx.plate(); renderer.float(e.x, e.y - 20, '🔓 La porte s’ouvre !', { size: 18, color: '#b8ff9a' }); renderer.shake(0.25); break;
    case 'ooh': sfx.ooh(); renderer.float(e.x, e.y - 22, 'Ooooh !', { size: 22, color: '#ffe27a' }); break;
    case 'water':
      sfx.water(theme); renderer.splash(e.x, e.y); renderer.clearTrail(e.n);
      if (e.n === shot.name) { renderer.float(e.x, e.y - 20, theme === 'volcano' ? '🔥 +1' : theme === 'space' ? '🕳 +1' : '💦 +1', { size: 24, color: '#ffdada' }); if (isMe) mine.waters++; }
      else { renderer.float(e.x, e.y - 20, '🎱 Billard !', { size: 24, color: '#ffe27a' }); if (shooterMe) achievements(onEvent(profile, 'billard')); }
      break;
    case 'holed': case 'bonus': {
      const strokes = state.balls[e.n]?.strokes ?? 0, lucky = e.n !== shot.name;
      const text = lucky ? '🍀 Chanceux !' : e.type === 'bonus' ? '⭐ Trou bonus ! -1' : label(strokes, hole.par);
      const great = !lucky && (strokes === 1 || strokes < hole.par || e.type === 'bonus');
      sfx[e.type === 'bonus' ? 'bonus' : 'holed']();
      sfx.applause(great ? 2 : 1);
      renderer.sink(e.x, e.y, look.sink, hexOf(look.color));
      renderer.clearTrail(e.n);
      renderer.shake(great ? 0.5 : 0.2);
      if (isReplay) break;
      if (isMe) { bigText(text, great); navigator.vibrate?.([40, 60, 90]); if (!lucky) mine.holedShot = { bounces: shot.bounces, shortcut: mine.shortcut, jumped: mine.jumped }; }
      else renderer.float(e.x, e.y - 28, `${e.n} : ${text}`, { size: 22, color: '#fff' });
      const score = (strokes === 1 ? 100 : 0) + shot.bounces * 3 + (e.type === 'bonus' ? 50 : 0) + (hole.par - strokes) * 10;
      if (!lucky && (strokes === 1 || shot.bounces >= 3 || e.type === 'bonus' || strokes < hole.par) && (!bestShot || bestShot.hk !== holeKey || score > bestShot.score)) bestShot = { shot, score, ace: strokes === 1, hk: holeKey };
      break;
    }
  }
}

/* ---------- Ma fin de trou et ma fin de partie : points et succès ---------- */
function achievements(list) {
  for (const a of list) { toast(`🏆 Succès débloqué : ${a.name} (+40 pts)`, 'gold'); sfx.fanfare(); }
  if (list.length) renderProfile();
}
function onHoleEnd(s) {
  if (s.eliminated?.length) { sfx.gong(); toast(`💀 Éliminé${s.eliminated.length > 1 ? 's' : ''} : ${s.eliminated.join(', ')}`, 'info'); }
  // Le beau coup du trou, revu au ralenti (automatique pour un trou en un)
  if (bestShot?.hk === holeKey && bestShot.ace) setTimeout(() => startReplay(bestShot.shot), 1400);
  const b = s.balls?.[s.me];
  if (!b || s.spectator || !mine) return;
  const res = onHole(profile, { id: hole.id, base: hole.base, par: hole.par, strokes: b.strokes, bonus: b.bonus, picked: b.picked, lucky: b.lucky, waters: mine.waters, holedShot: mine.holedShot }, gameMem);
  renderer.float(0.5, 0.86, `+${res.earned} pts`, { size: 26, color: '#ffe27a', screen: true });
  achievements(res.gained);
}
function onGameOver(s) {
  const me = s.players.find(p => p.name === s.me);
  if (me && !s.spectator) achievements(onGame(profile, { won: s.winners?.includes(s.me), players: s.players.length, holes: s.course.length, waters: gameMem.waters, course: s.settings.course, chaos: s.settings.chaos, betPts: me.betPts }));
  gameMem = { streak: 0, waters: 0 };
  sfx.fanfare();
  sfx.applause(3);
  for (let k = 0; k < 6; k++) setTimeout(() => renderer.sink(150 + Math.random() * 700, 120 + Math.random() * 360, ['feu', 'confettis', 'etoiles'][k % 3], '#fff'), k * 400);
}

/* ---------- Ralenti ---------- */
function startReplay(shot) {
  if (state?.stage !== 'holeEnd' && state?.phase !== 'over') return;
  replay = { shot, start: performance.now(), fired: 0 };
  $('#overlay').hidden = true;
  $('#replayTag').hidden = false;
}

/* ---------- Interface pendant la partie ---------- */
const rel = p => (p.scores ?? []).reduce((a, v, i) => a + v - (GolfHoles.resolve(state.course[i])?.par ?? 0), 0);
const fmtRel = r => (r === 0 ? '<span class="even">E</span>' : r < 0 ? `<span class="under">${r}</span>` : `<span class="over">+${r}</span>`);
const isOut = p => p.outAt !== null && p.outAt !== undefined;
function renderHud() {
  const s = state;
  $('#holeNo').textContent = s.holeNo + 1;
  $('#holeCount').textContent = s.course.length;
  $('#holeName').textContent = hole.name;
  $('#par').textContent = hole.par;
  $('#myStrokes').textContent = s.balls?.[s.me]?.strokes ?? '–';
  $('#holeHint').textContent = `💡 ${hole.hint}`;
  $('#chaosChip').hidden = !s.chaos;
  if (s.chaos) { $('#chaosChip').textContent = s.chaos.name; $('#chaosChip').title = s.chaos.desc; }
  const wind = [(hole.wind?.[0] || 0) + (s.opts?.wind?.[0] || 0), (hole.wind?.[1] || 0) + (s.opts?.wind?.[1] || 0)], ws = Math.hypot(...wind);
  $('#windChip').hidden = !ws;
  if (ws) { $('#windChip i').style.transform = `rotate(${Math.atan2(wind[1], wind[0])}rad)`; $('#windChip b').textContent = `vent ${Math.round(ws / 10)}`; }
  const mode = s.settings.mode, byName = n => s.players.find(p => p.name === n);
  $('#rankTitle').textContent = { course: '🏁 Points de course', elim: '💀 Survivants', equipes: '🤝 Équipes' }[mode] ?? 'Classement';
  $('#teams').innerHTML = s.teamTotals ? s.teamTotals.map((t, i) => `<div style="background:${TEAMS[i][1]}">${TEAMS[i][0]}<b>${t}</b></div>`).join('') : '';
  $('#ranking').innerHTML = (s.ranking ?? []).map((n, i) => {
    const p = byName(n), b = s.balls?.[n];
    if (!p) return '';
    const now = isOut(p) ? `éliminé au trou ${p.outAt + 1}` : !b ? '' : b.done ? (b.picked ? `ramassée · ${b.strokes} coups` : `⛳ ${label(b.strokes, hole.par)} (${b.strokes})`) : `${b.strokes} coup${b.strokes > 1 ? 's' : ''} sur ce trou`;
    const score = mode === 'course' ? `${p.points} pts` : fmtRel(rel(p));
    const team = mode === 'equipes' ? ` ${TEAMS[p.team]?.[0].split(' ')[0] ?? ''}` : '';
    return `<li class="${n === s.turn ? 'turn' : ''} ${isOut(p) ? 'out' : ''}"><span class="pos">${i + 1}</span>${ballDot(p)}<span class="who">${esc(n)}${team}${n === s.me ? ' (toi)' : ''}${p.bot ? ' 🤖' : ''}${p.look.title ? ` <em>${esc(titleOf(p.look.title))}</em>` : ''}<small>${now}</small></span><span class="rel">${score}${p.betPts ? `<small>🎲 ${p.betPts}</small>` : ''}</span></li>`;
  }).join('');
  $('#watchers').textContent = s.spectators.length ? `👁 ${s.spectators.join(', ')}` : '';
}
function renderStatus() {
  const s = state;
  let html = '';
  if (replay) html = '🎬 Le beau coup, au ralenti';
  else if (s.phase === 'over') html = '🏆 Partie terminée !';
  else if (s.stage === 'holeEnd') html = 'Trou terminé !';
  else {
    const color = n => hexOf(s.players.find(p => p.name === n)?.look.color);
    const left = d => Math.max(0, Math.ceil((d - serverNow()) / 1000)), timer = d => `<small class="${left(d) <= 5 ? 'hurry' : ''}">⏱ ${left(d)} s</small>`;
    const me = s.balls?.[s.me];
    if (turnMode()) {
      const b = s.balls?.[s.turn];
      if (s.shots.length) html = `<span class="c" style="--c:${color(s.shots[0].name)}">${esc(s.shots[0].name)}</span> a tiré…`;
      else if (canAim()) html = `À toi ! Tire en arrière, relâche pour frapper ${b?.aimUntil ? timer(b.aimUntil) : ''}`;
      else if (s.turn) html = `<span class="c" style="--c:${color(s.turn)}">${esc(s.turn)}</span> vise… ${b?.aimUntil ? timer(b.aimUntil) : ''}`;
    } else if (me && !me.done) html = canAim() ? `À toi, tire quand tu veux ! ${me.aimUntil ? timer(me.aimUntil) : ''}` : 'Ta balle roule…';
    else html = me?.done ? 'Tu as fini ce trou : regarde les autres !' : 'Tout le monde joue en même temps';
  }
  if (s.spectator) html = `👁 ${html}`;
  if ($('#status').innerHTML !== html) $('#status').innerHTML = html;
}
function renderBets() {
  const s = state, bar = $('#betbar');
  const can = s.settings.bets && turnMode() && s.stage === 'play' && s.turn && s.turn !== s.me && !s.spectator && s.balls?.[s.turn] && !s.shots.length && s.players.some(p => p.name === s.me);
  bar.hidden = !can;
  if (!can) return;
  const myBet = s.bets?.[s.me];
  bar.innerHTML = `🎲 Ton pari sur le tir de <b>${esc(s.turn)}</b> :
    <button class="ghost ${myBet === 'in' ? 'on' : ''}" data-bet="in">⛳ Dans le trou (+5)</button>
    <button class="ghost ${myBet === 'water' ? 'on' : ''}" data-bet="water">💦 À l’eau (+3)</button>
    <button class="ghost ${myBet === 'miss' ? 'on' : ''}" data-bet="miss">😐 Ni l’un ni l’autre (+1)</button>`;
}
$('#betbar').onclick = e => { const b = e.target.closest('[data-bet]'); if (b) { sfx.coin(); act(null, 'bet', b.dataset.bet); } };

const tagFor = (strokes, par, b) => {
  if (b?.picked) return '<span class="tag bad">Ramassée</span>';
  const d = strokes - par;
  return `<span class="tag ${d > 0 ? 'bad' : d < 0 || strokes === 1 ? 'great' : ''}">${b?.lucky ? '🍀 ' : ''}${b?.bonus ? '⭐ ' : ''}${label(strokes, par)}</span>`;
};
function scoreTable(players) {
  const holes = state.course.map(id => GolfHoles.resolve(id));
  const cell = (v, h) => (v === undefined ? '–' : v === 1 ? '<span class="ace">1</span>' : v < h.par ? `<span class="good">${v}</span>` : v);
  return `<div class="scores-wrap"><table class="scores"><tr><th></th>${holes.map((_, i) => `<th>${i + 1}</th>`).join('')}<th>Total</th></tr>
    <tr class="parrow"><td>Par</td>${holes.map(h => `<td>${h.par}</td>`).join('')}<td>${holes.reduce((a, h) => a + h.par, 0)}</td></tr>
    ${players.map(p => `<tr><td class="name">${ballDot(p)}${esc(p.name)}</td>${holes.map((h, i) => `<td>${cell(p.scores[i], h)}</td>`).join('')}<td>${p.total} ${fmtRel(rel(p))}</td></tr>`).join('')}</table></div>`;
}
function renderOverlay() {
  const s = state, o = $('#overlay');
  const key = s.phase === 'over' ? `over${s.round}:${s.host === s.me}` : s.stage === 'holeEnd' ? `hole${s.round}-${s.holeNo}` : '';
  if (key === overlayKey) return;
  overlayKey = key;
  if (!key) { o.hidden = true; return; }
  const ranked = (s.ranking ?? []).map(n => s.players.find(p => p.name === n)).filter(Boolean);
  const replayBtn = bestShot?.hk === holeKey ? '<button class="ghost" id="replayBtn">🎬 Revoir le beau coup</button>' : '';
  if (s.phase === 'over') {
    const medals = ['🥇', '🥈', '🥉'], mode = s.settings.mode, won = s.winners?.includes(s.me);
    const podium = mode === 'equipes'
      ? `<div class="podium">${[0, 1].sort((a, b) => s.teamTotals[a] - s.teamTotals[b]).map((t, i) => `<div><span>${medals[i]}</span>${TEAMS[t][0]}<br><small>${s.teamTotals[t]} coups</small></div>`).join('')}</div>`
      : `<div class="podium">${ranked.slice(0, 3).map((p, i) => `<div><span>${medals[i]}</span>${esc(p.name)}<br><small>${mode === 'course' ? `${p.points} pts` : `${p.total} coups`}</small></div>`).join('')}</div>`;
    const daily = s.daily ? `<h3>📅 Classement du trou du jour</h3><ol class="hint">${s.daily.map(d => `<li><b>${esc(d.name)}</b> : ${d.strokes} coup${d.strokes > 1 ? 's' : ''}</li>`).join('')}</ol>` : '';
    o.innerHTML = `<h2>${won ? '🏆 Victoire !' : 'Classement final'}</h2>${podium}${scoreTable(ranked)}${daily}
      <div class="rewards">⭐ Tu as maintenant ${profile.points} points · ${Object.keys(profile.ach).length}/${ACHIEVEMENTS.length} succès</div>
      <div class="row">${replayBtn}${s.me === s.host ? '<button class="primary" id="againBtn">⛳ Rejouer</button><button class="ghost" id="lobbyBtn">Retour au salon</button>' : `<p class="hint">${esc(s.host)} peut relancer une partie.</p>`}</div>`;
    $('#againBtn')?.addEventListener('click', e => act(e.target, 'start'));
    $('#lobbyBtn')?.addEventListener('click', e => act(e.target, 'toLobby'));
  } else {
    const left = Math.max(0, (s.holeEndAt ?? serverNow()) - serverNow());
    o.innerHTML = `<h2>Trou ${s.holeNo + 1} terminé</h2><p class="hint">${esc(hole.name)} · par ${hole.par}</p>
      <div class="scores-wrap"><table class="scores"><tr><th>Joueur</th><th>Coups</th><th>Résultat</th><th>${s.settings.mode === 'course' ? 'Points' : 'Total'}</th></tr>
      ${ranked.filter(p => s.balls[p.name]).map(p => { const b = s.balls[p.name]; return `<tr><td class="name">${ballDot(p)}${esc(p.name)}</td><td>${b.strokes}</td><td>${s.eliminated?.includes(p.name) ? '<span class="tag out">💀 Éliminé</span>' : tagFor(b.strokes, hole.par, b)}</td><td>${s.settings.mode === 'course' ? p.points : `${p.total} ${fmtRel(rel(p))}`}</td></tr>`; }).join('')}</table></div>
      <div class="row">${replayBtn}</div>
      <p class="hint" style="margin-top:10px">${s.holeNo + 1 < s.course.length ? `Trou suivant : ${esc(GolfHoles.resolve(s.course[s.holeNo + 1]).name)}` : 'Dernier trou : classement final dans un instant'}</p>
      <div class="countdown"><i style="animation-duration:${left}ms"></i></div>`;
  }
  $('#replayBtn')?.addEventListener('click', () => startReplay(bestShot.shot));
  o.hidden = !!replay;
}

/* ---------- Visée : tirer en arrière comme un lance-pierre, avec effet ---------- */
const cv = $('#course');
let aim = null, spin = 0, previewCache = { key: '', path: null };
function setSpin(v) { spin = v; for (const b of $$('[data-spin]')) b.classList.toggle('on', Number(b.dataset.spin) === v); }
$('.spin').onclick = e => { const b = e.target.closest('[data-spin]'); if (b) { setSpin(Number(b.dataset.spin)); sfx.click(); } };
addEventListener('keydown', e => {
  if (e.target.matches('input, select, textarea') || $('#game').hidden) return;
  const steps = [-1, -0.5, 0, 0.5, 1], i = steps.indexOf(spin);
  if (e.key === 'q' || e.key === 'a') setSpin(steps[Math.max(0, i - 1)]);
  if (e.key === 'e' || e.key === 'd') setSpin(steps[Math.min(4, i + 1)]);
});
function shotFrom(p) {
  const b = myBall(), dx = b.x - p.x, dy = b.y - p.y, d = Math.hypot(dx, dy);
  return { angle: Math.atan2(dy, dx), power: Math.min(1, d / 240), pull: Math.min(240, d) };
}
cv.addEventListener('pointerdown', e => {
  if (!canAim()) return;
  cv.setPointerCapture(e.pointerId);
  aim = renderer.toWorld(e.clientX, e.clientY);
});
cv.addEventListener('pointermove', e => { if (aim) aim = renderer.toWorld(e.clientX, e.clientY); });
cv.addEventListener('pointerup', () => {
  if (!aim) return;
  const { angle, power } = shotFrom(aim), b = myBall();
  aim = null;
  setPower(0);
  if (power < 0.04 || !canAim()) return; // relâché tout près de la balle : tir annulé
  const id = `${state.round}:${state.holeNo}:${b.n}`;
  sent = id;
  socket.emit('act', 'shoot', angle, power, spin, b.n, res => { if (res?.error) { if (sent === id) sent = null; toast(res.error); } });
  setSpin(0);
});
cv.addEventListener('pointercancel', () => { aim = null; setPower(0); });
function setPower(p) { $('#power').style.width = `${Math.round(p * 100)}%`; $('#power').style.background = p < 0.5 ? '#43c173' : p < 0.8 ? '#ffc93c' : '#ff5a5f'; $('#powerPct').textContent = `${Math.round(p * 100)} %`; }
// Aide à la visée : la trajectoire calculée avec la même physique (jusqu'au premier rebond, ou en entier)
function preview(angle, power) {
  const assist = state.settings.assist;
  if (!assist) return null;
  const key = `${angle.toFixed(3)}:${power.toFixed(3)}:${spin}:${Math.floor(serverNow() / 250)}`;
  if (previewCache.key === key) return previewCache.path;
  const b = myBall(), balls = { [state.me]: { x: b.x, y: b.y } };
  if (state.opts?.collide) for (const n of state.order) { const o = state.balls[n]; if (o && !o.done && n !== state.me) balls[n] = { x: o.x, y: o.y }; }
  const sim = Golf.simulate(hole, { balls, shooter: state.me, angle, power, spin, t0: (serverNow() - state.holeStart) / 1000 + 0.15, open: state.open, opts: state.opts, preview: assist === 1 });
  previewCache = { key, path: sim.paths[state.me]?.p ?? null };
  return previewCache.path;
}

/* ---------- Réglages son, musique, caméra ---------- */
let camFollow = store.get('golf-cam') !== '0';
function renderTools() {
  $('#soundBtn').classList.toggle('off', !audioSettings.sound);
  $('#musicBtn').classList.toggle('off', !audioSettings.music);
  $('#camBtn').classList.toggle('off', !camFollow);
}
$('#soundBtn').onclick = () => { setAudio('sound', !audioSettings.sound); renderTools(); };
$('#musicBtn').onclick = () => { setAudio('music', !audioSettings.music); renderTools(); };
$('#camBtn').onclick = () => { camFollow = !camFollow; store.set('golf-cam', camFollow ? '1' : '0'); renderTools(); toast(camFollow ? '🎥 La caméra suit la balle' : '🎥 Vue fixe sur tout le parcours', 'info'); };
renderTools();

/* ---------- Boucle d'affichage ---------- */
let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  if (!state || state.phase === 'lobby' || $('#game').hidden || !hole) return;
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  const sNow = serverNow();
  let t = (sNow - state.holeStart) / 1000;
  const overrides = new Map(); // positions des balles qui roulent
  let follow = null;
  if (replay) {
    // Ralenti : la trajectoire rejouée à mi-vitesse, obstacles compris
    const el = ((now - replay.start) / 1000) * 0.45, f = el * FPS, ev = replay.shot.events;
    t = (replay.shot.at - state.holeStart) / 1000 + el;
    while (replay.fired < ev.length && ev[replay.fired].i <= f) fire(replay.shot, ev[replay.fired++], true);
    let ended = true;
    for (const [n, path] of Object.entries(replay.shot.paths)) {
      const p = pathAt(path, f);
      if (!p.end) ended = false;
      if (p.end && replay.shot.results[n].result !== 'stop') p.hidden = true;
      overrides.set(n, p);
      if (n === replay.shot.name) follow = p;
    }
    if (ended && el > 0.5) { replay = null; $('#replayTag').hidden = true; overlayKey = ''; renderOverlay(); }
  } else {
    for (const [id, a] of anims) {
      const f = ((sNow - a.shot.at) / 1000) * FPS;
      while (a.fired < a.shot.events.length && a.shot.events[a.fired].i <= f) fire(a.shot, a.shot.events[a.fired++]);
      let ended = true;
      for (const [n, path] of Object.entries(a.shot.paths)) {
        const p = pathAt(path, f);
        if (!p.end) ended = false;
        if (p.end && a.shot.results[n].result !== 'stop') p.hidden = true; // dans le trou ou à l'eau
        overrides.set(n, p);
        if (n === a.shot.name && !p.end && (n === state.me || !follow)) follow = p;
      }
      // Le tir est fini et le serveur l'a retiré : on rend la main aux positions officielles
      if (ended && !state.shots.some(s => s.id === id)) anims.delete(id);
    }
  }
  // Caméra : entrée de trou, puis suit la balle qui roule (zoom près du trou)
  if (now > introUntil) {
    if (follow && camFollow) {
      const cup = Golf.cupAt(hole, t), near = Math.hypot(follow.x - cup[0], follow.y - cup[1]) < 140;
      renderer.focus(follow.x, follow.y, near ? 1.9 : 1.45);
    } else renderer.overview();
  }
  // Balles à dessiner
  const balls = [], many = state.order.length > 1;
  for (const n of state.order) {
    const b = state.balls?.[n], p = state.players.find(x => x.name === n);
    if (!b || !p) continue;
    const o = overrides.get(n);
    const pos = o ?? (!b.done ? { x: b.x, y: b.y, z: 0 } : null);
    if (!pos || pos.hidden) { ballPos.set(n, { hidden: true }); continue; }
    const prev = ballPos.get(n), roll = rolls.get(n) ?? [0, 0];
    const d = prev && !prev.hidden ? Math.hypot(pos.x - prev.x, pos.y - prev.y) : 0, moving = d > 0.05;
    if (moving && d < 50) { roll[0] += pos.x - prev.x; roll[1] += pos.y - prev.y; }
    rolls.set(n, roll);
    ballPos.set(n, { x: pos.x, y: pos.y });
    renderer.trail(n, pos.x, pos.y, pos.z || 0, p.look, moving);
    const ring = !replay && state.stage === 'play' && (turnMode() ? n === state.turn && !state.shots.length : n === state.me && canAim());
    balls.push({ name: n, x: pos.x, y: pos.y, z: pos.z || 0, look: p.look, roll, ring, label: many ? n : null, title: many && p.look.title ? titleOf(p.look.title) : null });
  }
  balls.sort((a, b) => a.ring - b.ring || a.z - b.z);
  // Noms qui se chevauchent : on garde celui de la balle qui joue
  for (const [i, b] of balls.entries()) if (!b.ring && balls.some((o, j) => j > i && o.label && Math.hypot(o.x - b.x, o.y - b.y) < 30)) { b.label = null; b.title = null; }
  // Visée
  let aimView = null, path = null;
  if (aim && canAim()) {
    const b = myBall(), s = shotFrom(aim), me = state.players.find(p => p.name === state.me);
    setPower(s.power);
    aimView = { x: b.x, y: b.y, ...s, look: me.look };
    if (s.power >= 0.04) path = preview(s.angle, s.power);
  }
  const ballsNear = c => balls.some(b => Math.hypot(b.x - c[0], b.y - c[1]) < 60);
  renderer.frame({ t, dt, open: state.open ?? [], balls, aim: aimView, preview: path, ballsNear, R: state.opts?.R });
  renderStatus();
}
requestAnimationFrame(frame);
entry();
