// Mini-golf : menus et salon, parcours dessiné en 2D (vue du dessus), visée au lance-pierre (souris ou doigt),
// trajectoires calculées par le serveur et rejouées au même moment chez tout le monde, scores et sons.
/* global io, Golf */
const socket = io('/golf');
const { W, H, R, CUP, WALL, FPS, HOLES, movers, active, label } = Golf;
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);
const store = {
  get: k => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { v === null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch { /* stockage bloqué */ } },
};
const urlCode = new URLSearchParams(location.search).get('salon')?.toUpperCase();
let state = null, toastTimer, clockOffset = -Infinity;
const serverNow = () => Date.now() + clockOffset;
if (new URLSearchParams(location.search).has('debug')) window.__golf = () => state; // ?debug : pour les tests automatiques

function show(id) { for (const s of document.querySelectorAll('.screen')) s.hidden = s.id !== id; }
function toast(text, ok = false) {
  const t = $('#toast');
  t.textContent = text;
  t.className = ok ? 'ok' : '';
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.hidden = true), 2800);
}
function bigText(text) {
  const b = $('#bigText');
  b.textContent = text;
  b.classList.remove('show');
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

/* ---------- Sons (synthétisés, aucun fichier) ---------- */
let ac, muted = store.get('golf-muted') === '1';
document.addEventListener('pointerdown', () => { ac ??= new (window.AudioContext || window.webkitAudioContext)(); ac.resume(); });
function tone(freq, dur, type = 'sine', vol = 0.1, delay = 0, slide = 0) {
  if (muted || !ac) return;
  const t = ac.currentTime + delay, o = ac.createOscillator(), g = ac.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g).connect(ac.destination);
  o.start(t);
  o.stop(t + dur);
}
function noise(dur, vol, freq) {
  if (muted || !ac) return;
  const buf = ac.createBuffer(1, ac.sampleRate * dur, ac.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
  const src = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
  src.buffer = buf; f.type = 'lowpass'; f.frequency.value = freq; g.gain.value = vol;
  src.connect(f).connect(g).connect(ac.destination);
  src.start();
}
const sfx = {
  hit: p => { tone(240, 0.08, 'triangle', 0.18 + p * 0.1, 0, 120); tone(1900, 0.03, 'sine', 0.05); },
  bump: () => tone(320, 0.05, 'square', 0.04, 0, 200),
  bump2: () => { tone(180, 0.09, 'square', 0.06, 0, 90); noise(0.06, 0.15, 1500); },
  water: () => { noise(0.5, 0.35, 900); tone(500, 0.3, 'sine', 0.06, 0, 120); },
  holed: () => { [0, 0.07, 0.13].forEach(d => tone(900 + d * 2000, 0.05, 'triangle', 0.08, d)); [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.25, 'triangle', 0.08, 0.25 + i * 0.09)); },
  tp: () => tone(300, 0.35, 'sine', 0.09, 0, 1600),
  spring: () => tone(160, 0.3, 'triangle', 0.12, 0, 640),
  turn: () => [660, 880].forEach((f, i) => tone(f, 0.15, 'sine', 0.07, i * 0.12)),
};
function renderMute() { $('#muteBtn').textContent = muted ? '🔇' : '🔊'; $('#muteBtn').title = muted ? 'Activer le son' : 'Couper le son'; }
$('#muteBtn').onclick = () => { muted = !muted; store.set('golf-muted', muted ? '1' : '0'); renderMute(); };
renderMute();

/* ---------- Pseudo, accueil, salons ---------- */
let pseudo = store.get('golf-pseudo') || store.get('p4-pseudo') || '';
function entry() {
  $('#meName').textContent = pseudo;
  $('#nameForm').pseudo.value = pseudo;
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
  state = anim = null;
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
socket.on('session', s => { store.set('golf-session', JSON.stringify(s)); history.replaceState(null, '', `?salon=${s.code}`); });
entry();
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

/* ---------- Salon d'attente ---------- */
$('#copyLink').onclick = () => navigator.clipboard.writeText(`${location.origin}${location.pathname}?salon=${state.code}`)
  .then(() => toast('Lien copié : envoie-le à tes amis !', true), () => toast('Copie impossible'));
$('#startBtn').onclick = e => act(e.target, 'start');
const ballDot = p => `<i class="ball${p.connected ? '' : ' off'}" style="--c:${p.color}"></i>`;
function renderWait(s) {
  show('wait');
  $('#overlay').hidden = true;
  $('#waitCode').textContent = s.code;
  $('#waitPrivacy').textContent = s.private ? '🔒 Salon privé : partage le code pour inviter' : '🌍 Salon public : visible dans la liste';
  $('#notice').hidden = !s.notice;
  $('#notice').textContent = s.notice ?? '';
  $('#waitPlayers').innerHTML = s.players.map(p => `<li>${ballDot(p)}<b>${esc(p.name)}</b>${p.name === s.host ? '<small>créateur</small>' : ''}${p.name === s.me ? '<small>toi</small>' : ''}<span>${p.connected ? 'connecté' : 'déconnecté'}</span></li>`).join('')
    + (s.players.length < 8 ? '<li class="hint">En attente d’autres joueurs… (jusqu’à 8)</li>' : '');
  $('#waitWatchers').hidden = !s.spectators.length;
  $('#waitWatchers').textContent = `👁 Spectateurs : ${s.spectators.join(', ')}`;
  const ready = s.players.every(p => p.connected), b = $('#startBtn');
  b.hidden = s.spectator;
  b.disabled = !(ready && s.me === s.host);
  b.textContent = s.me !== s.host ? `${s.host} va lancer la partie…` : s.players.length < 2 ? '⛳ Jouer seul (entraînement)' : `⛳ Lancer la partie (${s.players.length} joueurs)`;
}

/* ---------- Partie : état reçu du serveur ---------- */
let anim = null, shownOverlay = '', lastNotice = null, sent = -1;
socket.on('state', s => {
  clockOffset = Math.max(clockOffset, s.now - Date.now()); // la latence ne peut que retarder : on garde le plus grand écart
  const prev = state;
  state = s;
  if (s.phase === 'lobby') { anim = null; shownOverlay = ''; return renderWait(s); }
  show('game');
  if (s.shot && s.shot.at !== anim?.shot.at) {
    anim = { shot: s.shot, fired: 0, trail: [] };
    sfx.hit(0.5);
  }
  if (s.notice && s.notice !== lastNotice) toast(s.notice);
  lastNotice = s.notice;
  if (s.turn === s.me && s.stage === 'aim' && !s.spectator && (prev?.stage !== 'aim' || prev.turn !== s.me)) sfx.turn();
  renderHud();
  renderOverlay();
});

const playerOf = name => state.players.find(p => p.name === name);
const holeOf = () => HOLES[state.holeNo];
const rel = p => p.scores.reduce((a, v, i) => a + v - HOLES[i].par, 0);
const fmtRel = r => (r === 0 ? '<span class="even">E</span>' : r < 0 ? `<span class="under">${r}</span>` : `<span class="over">+${r}</span>`);
const myTurn = () => state?.phase === 'playing' && state.stage === 'aim' && state.turn === state.me && !state.spectator && sent !== state.shotNo;

function renderHud() {
  const s = state, h = holeOf();
  $('#holeNo').textContent = s.holeNo + 1;
  $('#holeName').textContent = h.name;
  $('#par').textContent = h.par;
  $('#myStrokes').textContent = s.balls?.[s.me]?.strokes ?? '–';
  $('#holeHint').textContent = `💡 ${h.hint}`;
  const ranked = [...s.players].filter(p => s.order.includes(p.name)).sort((a, b) => rel(a) - rel(b) || a.total - b.total);
  $('#ranking').innerHTML = ranked.map((p, i) => {
    const b = s.balls[p.name];
    const now = !b ? '' : b.done ? (b.picked ? `ramassée · ${b.strokes} coups` : `⛳ ${label(b.strokes, h.par)} (${b.strokes})`) : `${b.strokes} coup${b.strokes > 1 ? 's' : ''} sur ce trou`;
    return `<li class="${p.name === s.turn ? 'turn' : ''}"><span class="pos">${i + 1}</span>${ballDot(p)}<span class="who">${esc(p.name)}${p.name === s.me ? ' (toi)' : ''}<small>${now}</small></span><span class="rel">${fmtRel(rel(p))}</span></li>`;
  }).join('');
  $('#watchers').textContent = s.spectators.length ? `👁 ${s.spectators.join(', ')}` : '';
}

// Ligne d'état (rafraîchie à chaque image pour le compte à rebours)
function renderStatus() {
  const s = state;
  let html = '';
  if (s.phase === 'over') html = 'Partie terminée !';
  else if (s.stage === 'holeEnd') html = 'Trou terminé !';
  else if (s.stage === 'roll') html = `<span class="c" style="--c:${playerOf(s.shot.name)?.color}">${esc(s.shot.name)}</span> a tiré…`;
  else {
    const left = Math.max(0, Math.ceil((s.deadline - serverNow()) / 1000)), timer = `<small class="${left <= 5 ? 'hurry' : ''}">⏱ ${left} s</small>`;
    html = myTurn() ? `À toi de jouer ! Tire en arrière, relâche pour frapper ${timer}`
      : `<span class="c" style="--c:${playerOf(s.turn)?.color}">${esc(s.turn)}</span> vise… ${timer}`;
  }
  if (s.spectator) html = `👁 ${html}`;
  if ($('#status').innerHTML !== html) $('#status').innerHTML = html;
}

/* ---------- Tableaux de scores ---------- */
const tagFor = (strokes, par, picked) => {
  const d = strokes - par;
  return `<span class="tag ${picked || d > 0 ? 'bad' : d < 0 ? 'great' : ''}">${picked ? 'Ramassée' : label(strokes, par)}</span>`;
};
function scoreTable(players) {
  const head = HOLES.map((_, i) => `<th>${i + 1}</th>`).join('');
  const parRow = `<tr class="parrow"><td>Par</td>${HOLES.map(h => `<td>${h.par}</td>`).join('')}<td>${HOLES.reduce((a, h) => a + h.par, 0)}</td></tr>`;
  return `<table class="scores"><tr><th></th>${head}<th>Total</th></tr>${parRow}${players.map(p => `<tr><td class="name">${ballDot(p)}${esc(p.name)}</td>${HOLES.map((h, i) => `<td>${p.scores[i] ?? '–'}</td>`).join('')}<td>${p.total} ${fmtRel(rel(p))}</td></tr>`).join('')}</table>`;
}
function renderOverlay() {
  const s = state, o = $('#overlay');
  const key = s.phase === 'over' ? `over${s.round}` : s.stage === 'holeEnd' ? `hole${s.round}-${s.holeNo}` : '';
  if (key === shownOverlay && key !== `over${s.round}`) return;
  shownOverlay = key;
  if (!key) { o.hidden = true; return; }
  const ranked = s.players.filter(p => s.order.includes(p.name)).sort((a, b) => a.total - b.total);
  if (s.phase === 'over') {
    const medals = ['🥇', '🥈', '🥉'];
    o.innerHTML = `<h2>Classement final</h2>
      <div class="podium">${ranked.slice(0, 3).map((p, i) => `<div><span>${medals[i]}</span>${esc(p.name)}<br><small>${p.total} coups</small></div>`).join('')}</div>
      ${scoreTable(ranked)}
      <div class="row">${s.me === s.host ? '<button class="primary" id="againBtn">⛳ Rejouer</button><button class="ghost" id="lobbyBtn">Retour au salon</button>' : `<p class="hint">${esc(s.host)} peut relancer une partie.</p>`}</div>`;
    $('#againBtn')?.addEventListener('click', e => act(e.target, 'start'));
    $('#lobbyBtn')?.addEventListener('click', e => act(e.target, 'toLobby'));
  } else {
    const h = holeOf();
    o.innerHTML = `<h2>Trou ${s.holeNo + 1} terminé</h2><p class="hint">${esc(h.name)} · par ${h.par}</p>
      <table class="scores"><tr><th>Joueur</th><th>Coups</th><th>Résultat</th><th>Total</th></tr>
      ${ranked.map(p => { const b = s.balls[p.name]; return `<tr><td class="name">${ballDot(p)}${esc(p.name)}</td><td>${b.strokes}</td><td>${tagFor(b.strokes, h.par, b.picked)}</td><td>${p.total} ${fmtRel(rel(p))}</td></tr>`; }).join('')}</table>
      <p class="hint" style="margin-top:10px">${s.holeNo + 1 < HOLES.length ? `Trou suivant : ${esc(HOLES[s.holeNo + 1].name)}` : 'Dernier trou joué : classement final dans un instant'}</p>`;
  }
  o.hidden = false;
}

/* ---------- Visée : on tire en arrière comme un lance-pierre ---------- */
const cv = $('#course'), ctx = cv.getContext('2d');
let aimAt = null;
const toCourse = e => { const r = cv.getBoundingClientRect(); return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H }; };
function shotFrom(p) {
  const b = state.balls[state.me], dx = b.x - p.x, dy = b.y - p.y;
  return { angle: Math.atan2(dy, dx), power: Math.min(1, Math.hypot(dx, dy) / 240) };
}
cv.addEventListener('pointerdown', e => {
  if (!myTurn()) return;
  cv.setPointerCapture(e.pointerId);
  aimAt = toCourse(e);
});
cv.addEventListener('pointermove', e => { if (aimAt) aimAt = toCourse(e); });
cv.addEventListener('pointerup', () => {
  if (!aimAt) return;
  const { angle, power } = shotFrom(aimAt);
  aimAt = null;
  setPower(0);
  if (power < 0.04 || !myTurn()) return; // relâché tout près de la balle : tir annulé
  sent = state.shotNo;
  socket.emit('act', 'shoot', angle, power, state.shotNo, res => { if (res?.error) { sent = -1; toast(res.error); } });
});
cv.addEventListener('pointercancel', () => { aimAt = null; setPower(0); });
function setPower(p) { $('#power').style.width = `${Math.round(p * 100)}%`; $('#power').style.background = p < 0.5 ? '#43c173' : p < 0.8 ? '#ffc93c' : '#ff5a5f'; $('#powerPct').textContent = `${Math.round(p * 100)} %`; }

/* ---------- Dessin ---------- */
const THEMES = {
  classic: { bg: '#3e9a47', g1: '#5cbf5f', g2: '#53b356', wall: '#a86c38', hi: '#d39a5f', dark: '#5e3a1a', water: '#4fb3ea', waterHi: '#c9ecfd', sand: '#efdca3', sandDot: '#d4bc7b', rock: '#9aa3a8', bridge: '#b98149' },
  tropical: { bg: '#1fa3b8', g1: '#6fd06b', g2: '#66c662', wall: '#c99c5c', hi: '#efcd8f', dark: '#7a5a2a', water: '#25c6d6', waterHi: '#c4f6f8', sand: '#f6e2a8', sandDot: '#e1c47e', rock: '#7a5230', bridge: '#c8935a' },
  space: { bg: '#0d0b1e', g1: '#2b2456', g2: '#2b2456', wall: '#58e1ff', hi: '#e0fcff', dark: '#1b4f7a', water: '#000', ice: 'rgba(160,215,255,.32)', rock: '#8c86ac', bridge: '#6b6f8a', neon: true },
  volcano: { bg: '#1c1412', g1: '#5c4942', g2: '#56443d', wall: '#3b2d28', hi: '#8a6656', dark: '#1a120f', water: '#ff5a1f', waterHi: '#ffd25a', rock: '#8a6a5c', bridge: '#6e5a50', sand: '#3a2f2a', sandDot: '#2a201c' },
  candy: { bg: '#ffb3d5', g1: '#ffd6ea', g2: '#ffcde4', wall: '#ffffff', stripe: '#ff4f7b', hi: '#ffffff', dark: '#c23a62', sand: '#8a5434', sandDot: '#5e3520', rock: '#ff7eb6', bridge: '#fff', slope: '#eab05c' },
};
const rng = seed => () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
const shapePath = (c, z) => { c.beginPath(); if (z.r) c.rect(...z.r); else c.arc(z.c[0], z.c[1], z.c[2], 0, Math.PI * 2); };
let staticLayer = null, staticKey = '';

function drawStatic(c, hole) {
  const th = THEMES[hole.theme], rand = rng(hole.name.length * 977 + hole.par);
  c.fillStyle = th.g1;
  c.fillRect(0, 0, W, H);
  // Sol : bandes de tonte, étoiles, fissures ou vermicelles selon le thème
  if (hole.theme === 'classic' || hole.theme === 'tropical') { c.fillStyle = th.g2; for (let x = 0; x < W; x += 100) c.fillRect(x, 0, 50, H); }
  for (const d of hole.deco || []) {
    if (d.t === 'stars') for (let i = 0; i < 160; i++) { c.fillStyle = `rgba(255,255,255,${0.2 + rand() * 0.6})`; c.beginPath(); c.arc(rand() * W, rand() * H, rand() * 1.6 + 0.3, 0, 7); c.fill(); }
    if (d.t === 'cracks') { c.strokeStyle = 'rgba(255,110,40,.35)'; c.lineWidth = 2; for (let i = 0; i < 26; i++) { let x = rand() * W, y = rand() * H; c.beginPath(); c.moveTo(x, y); for (let k = 0; k < 4; k++) { x += (rand() - 0.5) * 50; y += (rand() - 0.5) * 50; c.lineTo(x, y); } c.stroke(); } }
    if (d.t === 'sprinkles') for (let i = 0; i < 220; i++) { c.fillStyle = ['#ff6fa8', '#7bd3ff', '#ffe066', '#8ee88e', '#c49bff'][i % 5]; c.save(); c.translate(rand() * W, rand() * H); c.rotate(rand() * 3); c.fillRect(-4, -1.3, 8, 2.6); c.restore(); }
    if (d.t === 'flowers') for (const [x, y] of d.at) for (let k = 0; k < 5; k++) { c.fillStyle = ['#fff', '#ffe066', '#ff8fb1'][k % 3]; c.beginPath(); c.arc(x + Math.cos(k * 1.3) * 12, y + Math.sin(k * 1.3) * 12, 5, 0, 7); c.fill(); }
    if (d.t === 'shells') for (const [x, y] of d.at) { c.fillStyle = '#ffd9c2'; c.beginPath(); c.arc(x, y, 9, Math.PI, 0); c.fill(); c.strokeStyle = '#e8a98a'; c.lineWidth = 1.5; for (let k = -2; k <= 2; k++) { c.beginPath(); c.moveTo(x, y); c.lineTo(x + k * 4, y - 8); c.stroke(); } }
  }
  // Zones
  for (const z of hole.zones || []) {
    c.save();
    shapePath(c, z);
    if (z.t === 'sand') {
      c.fillStyle = th.sand; c.fill(); c.clip();
      c.fillStyle = th.sandDot;
      for (let i = 0; i < 120; i++) { const x = z.r ? z.r[0] + rand() * z.r[2] : z.c[0] + (rand() - 0.5) * 2 * z.c[2], y = z.r ? z.r[1] + rand() * z.r[3] : z.c[1] + (rand() - 0.5) * 2 * z.c[2]; c.fillRect(x, y, 2, 2); }
    } else if (z.t === 'ice') {
      c.fillStyle = th.ice; c.fill(); c.clip();
      c.strokeStyle = 'rgba(255,255,255,.35)'; c.lineWidth = 2;
      for (let i = 0; i < 18; i++) { const x = z.r[0] + rand() * z.r[2], y = z.r[1] + rand() * z.r[3]; c.beginPath(); c.moveTo(x, y); c.lineTo(x + 30, y - 12); c.stroke(); }
    } else if (z.t === 'water') {
      if (th.neon) { // trou noir
        const g = c.createRadialGradient(z.c[0], z.c[1], 0, z.c[0], z.c[1], z.c[2]);
        g.addColorStop(0, '#000'); g.addColorStop(0.6, '#0a0418'); g.addColorStop(0.85, '#5b2bb5'); g.addColorStop(1, 'rgba(160,110,255,0)');
        c.fillStyle = g; c.fill();
      } else {
        c.fillStyle = th.water; c.fill(); c.clip();
        if (hole.theme === 'volcano') {
          for (let i = 0; i < 40; i++) { c.fillStyle = `rgba(${rand() < 0.5 ? '120,30,10' : '255,210,90'},.45)`; c.beginPath(); c.arc(z.r[0] + rand() * z.r[2], z.r[1] + rand() * z.r[3], 4 + rand() * 12, 0, 7); c.fill(); }
        } else {
          c.strokeStyle = th.waterHi; c.lineWidth = 2;
          const [x0, y0, w, hh] = z.r ?? [z.c[0] - z.c[2], z.c[1] - z.c[2], z.c[2] * 2, z.c[2] * 2];
          for (let i = 0; i < (w * hh) / 2500; i++) { const x = x0 + rand() * w, y = y0 + rand() * hh; c.beginPath(); c.arc(x, y, 8, Math.PI * 1.15, Math.PI * 1.85); c.stroke(); }
        }
      }
    } else if (z.t === 'slope') {
      c.fillStyle = th.slope ?? 'rgba(0,0,0,.12)'; c.fill(); c.clip();
      c.strokeStyle = 'rgba(255,255,255,.55)'; c.lineWidth = 4;
      for (let y = z.r[1] + 20; y < z.r[1] + z.r[3]; y += 44) for (let x = z.r[0] + 22; x < z.r[0] + z.r[2]; x += 40) chevron(c, x, y, z.dir, 9);
    } else if (z.t === 'fan') {
      c.fillStyle = 'rgba(0,0,0,.18)'; c.fill(); c.clip();
      c.strokeStyle = 'rgba(255,140,60,.25)'; c.lineWidth = 2;
      for (let x = z.r[0]; x < z.r[0] + z.r[2]; x += 14) { c.beginPath(); c.moveTo(x, z.r[1]); c.lineTo(x, z.r[1] + z.r[3]); c.stroke(); }
    }
    c.restore();
  }
  // Départ, téléporteurs (sortie), ressorts
  c.fillStyle = 'rgba(0,0,0,.14)';
  c.beginPath(); c.roundRect(hole.tee[0] - 22, hole.tee[1] - 22, 44, 44, 8); c.fill();
  for (const t of hole.teleports || []) { c.strokeStyle = 'rgba(190,140,255,.6)'; c.lineWidth = 3; c.setLineDash([6, 6]); c.beginPath(); c.arc(t.to[0], t.to[1], t.r, 0, 7); c.stroke(); c.setLineDash([]); }
  for (const s of hole.springs || []) {
    c.fillStyle = '#ff4f9a'; c.beginPath(); c.arc(s.x, s.y, s.r, 0, 7); c.fill();
    c.strokeStyle = '#fff'; c.lineWidth = 3; chevron(c, s.x - 4, s.y, s.dir, 7); chevron(c, s.x + 5, s.y, s.dir, 7);
  }
  // Trou
  c.fillStyle = 'rgba(255,255,255,.55)'; c.beginPath(); c.arc(hole.cup[0], hole.cup[1], CUP + 3, 0, 7); c.fill();
  c.fillStyle = '#18241c'; c.beginPath(); c.arc(hole.cup[0], hole.cup[1], CUP, 0, 7); c.fill();
  // Murs et obstacles fixes
  for (const w of hole.walls) wallPath(c, w, th);
  for (const b of hole.bumpers || []) bumper(c, b, th);
}
function chevron(c, x, y, [dx, dy], s) {
  const px = -dy, py = dx;
  c.beginPath(); c.moveTo(x - dx * s + px * s, y - dy * s + py * s); c.lineTo(x, y); c.lineTo(x - dx * s - px * s, y - dy * s - py * s); c.stroke();
}
function wallPath(c, pts, th, dash = 0) {
  const trace = (off = 0) => { c.beginPath(); c.moveTo(pts[0], pts[1] + off); for (let k = 2; k < pts.length; k += 2) c.lineTo(pts[k], pts[k + 1] + off); };
  c.lineCap = c.lineJoin = 'round';
  c.save();
  if (th.neon) { c.shadowColor = th.wall; c.shadowBlur = 14; }
  trace(2); c.strokeStyle = 'rgba(0,0,0,.25)'; c.lineWidth = WALL * 2 + 2; c.stroke(); // ombre portée
  trace(); c.strokeStyle = th.dark; c.lineWidth = WALL * 2 + 3; c.stroke();
  trace(); c.strokeStyle = th.wall; c.lineWidth = WALL * 2 - 1; c.stroke();
  c.restore();
  if (th.stripe) { trace(); c.strokeStyle = th.stripe; c.lineWidth = WALL * 2 - 1; c.lineCap = 'butt'; c.setLineDash([9, 9]); c.lineDashOffset = dash; c.stroke(); c.setLineDash([]); c.lineCap = 'round'; }
  trace(-2); c.strokeStyle = th.hi; c.globalAlpha = 0.5; c.lineWidth = 2; c.stroke(); c.globalAlpha = 1;
}
function bumper(c, b, th) {
  c.fillStyle = 'rgba(0,0,0,.22)'; c.beginPath(); c.arc(b.x + 3, b.y + 4, b.r, 0, 7); c.fill();
  const g = c.createRadialGradient(b.x - b.r * 0.4, b.y - b.r * 0.4, 1, b.x, b.y, b.r);
  if (b.jelly) { const col = ['#ff5fa2', '#59c8ff', '#ffd23f', '#8be37a', '#b98cff'][Math.round(b.x + b.y) % 5]; g.addColorStop(0, '#fff'); g.addColorStop(0.3, col); g.addColorStop(1, col); }
  else if (b.palm) { g.addColorStop(0, '#b07a45'); g.addColorStop(1, '#6b4422'); }
  else { g.addColorStop(0, '#fff'); g.addColorStop(0.15, th.rock); g.addColorStop(1, shade(th.rock, -40)); }
  c.fillStyle = g; c.beginPath(); c.arc(b.x, b.y, b.r, 0, 7); c.fill();
  if (th.neon && !b.palm) { c.fillStyle = 'rgba(0,0,0,.25)'; for (const [ox, oy, rr] of [[-0.3, 0.2, 0.25], [0.35, -0.1, 0.18]]) { c.beginPath(); c.arc(b.x + ox * b.r, b.y + oy * b.r, rr * b.r, 0, 7); c.fill(); } }
}
function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16), f = v => Math.max(0, Math.min(255, v + amt));
  return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
}

// Particules : éclaboussures, étincelles, confettis
const parts = [];
function burst(x, y, n, colors, speed = 120, life = 0.8, grav = 0) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, v = speed * (0.3 + Math.random());
    parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life, age: 0, c: colors[i % colors.length], s: 2 + Math.random() * 3, grav });
  }
}

// Position d'une balle en train de rouler : trajectoire du serveur, rejouée à l'heure du serveur.
function rolling(now) {
  if (!anim) return null;
  const { shot } = anim, f = ((now - shot.at) / 1000) * FPS, path = shot.path;
  const i = Math.max(0, Math.min(path.length - 1, Math.floor(f))), k = Math.min(1, Math.max(0, f - i)), a = path[i], b = path[Math.min(path.length - 1, i + 1)];
  const tp = shot.events.some(e => e.type === 'tpout' && e.i === i + 1); // pas d'interpolation à travers un téléporteur
  return { x: tp ? a[0] : a[0] + (b[0] - a[0]) * k, y: tp ? a[1] : a[1] + (b[1] - a[1]) * k, f, end: f >= path.length - 1 };
}
function fireEvents(f) {
  const { shot } = anim, hole = holeOf(), th = THEMES[hole.theme];
  while (anim.fired < shot.events.length && shot.events[anim.fired].i <= f) {
    const e = shot.events[anim.fired++];
    if (e.type === 'bump' || e.type === 'bump2') { sfx[e.type](); if (e.type === 'bump2') burst(e.x, e.y, 8, ['#fff', '#ffe066'], 90, 0.4); }
    if (e.type === 'tp') { sfx.tp(); burst(e.x, e.y, 24, ['#c49bff', '#7bd3ff', '#fff'], 140, 0.6); }
    if (e.type === 'spring') { sfx.spring(); burst(e.x, e.y, 14, ['#ff4f9a', '#fff'], 130, 0.5); }
    if (e.type === 'water') {
      sfx.water();
      const hot = hole.theme === 'volcano', space = hole.theme === 'space';
      burst(e.x, e.y, 30, hot ? ['#ff5a1f', '#ffd25a', '#333'] : space ? ['#a37bff', '#5b2bb5', '#fff'] : [th.water, th.waterHi, '#fff'], 110, 0.9);
      toast(`${shot.name} : ${hot ? 'dans la lave' : space ? 'avalée par un trou noir' : 'à l’eau'} ! +1 coup, retour au point de départ`);
    }
    if (e.type === 'holed') {
      sfx.holed();
      const strokes = state.balls[shot.name]?.strokes ?? 0;
      burst(e.x, e.y, 60, ['#ff5a5f', '#ffc93c', '#3d8bff', '#43c173', '#f15bb5', '#fff'], 220, 1.4, 160);
      if (shot.name === state.me) bigText(label(strokes, hole.par));
      else toast(`${shot.name} : ${label(strokes, hole.par)} !`, true);
    }
  }
}

function drawBall(c, x, y, color, t, mine, name) {
  c.fillStyle = 'rgba(0,0,0,.28)'; c.beginPath(); c.ellipse(x + 2.5, y + 3.5, R, R * 0.8, 0, 0, 7); c.fill();
  const g = c.createRadialGradient(x - R * 0.4, y - R * 0.45, 0.5, x, y, R);
  g.addColorStop(0, '#fff'); g.addColorStop(0.35, color); g.addColorStop(1, shade(color.length === 7 ? color : '#888888', -50));
  c.fillStyle = g; c.beginPath(); c.arc(x, y, R, 0, 7); c.fill();
  c.strokeStyle = 'rgba(0,0,0,.35)'; c.lineWidth = 1; c.stroke();
  if (mine) { c.strokeStyle = color; c.globalAlpha = 0.5 + Math.sin(t * 6) * 0.3; c.lineWidth = 2.5; c.beginPath(); c.arc(x, y, R + 6 + Math.sin(t * 6) * 2, 0, 7); c.stroke(); c.globalAlpha = 1; }
  if (name) { c.font = '700 12px Nunito, sans-serif'; c.textAlign = 'center'; c.lineWidth = 3; c.strokeStyle = 'rgba(0,0,0,.5)'; c.strokeText(name, x, y - R - 6); c.fillStyle = '#fff'; c.fillText(name, x, y - R - 6); }
}

let lastFrame = performance.now();
function frame() {
  requestAnimationFrame(frame);
  if (!state || state.phase === 'lobby' || $('#game').hidden) return;
  const nowMs = performance.now(), dt = Math.min(0.05, (nowMs - lastFrame) / 1000);
  lastFrame = nowMs;
  const hole = holeOf(), th = THEMES[hole.theme], sNow = serverNow(), t = (sNow - state.holeStart) / 1000;
  // Taille du canvas (netteté sur écran haute densité)
  const dpr = Math.min(devicePixelRatio || 1, 2), pw = Math.round(cv.clientWidth * dpr);
  if (pw && cv.width !== pw) { cv.width = pw; cv.height = Math.round((pw * H) / W); }
  const sc = cv.width / W, key = `${state.holeNo}:${cv.width}`;
  if (key !== staticKey) {
    staticKey = key;
    staticLayer = Object.assign(document.createElement('canvas'), { width: cv.width, height: cv.height });
    const sctx = staticLayer.getContext('2d');
    sctx.setTransform(sc, 0, 0, sc, 0, 0);
    drawStatic(sctx, hole);
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(staticLayer, 0, 0);
  ctx.setTransform(sc, 0, 0, sc, 0, 0);
  const c = ctx;

  // Ponts : présents, clignotants juste avant de disparaître, ou simple contour
  for (const br of hole.bridges || []) {
    const on = active(br, t), left = br.period ? br.on - (((t + (br.phase || 0)) % br.period) + br.period) % br.period : 9;
    c.save();
    if (!on) { c.strokeStyle = 'rgba(255,255,255,.35)'; c.setLineDash([8, 8]); c.lineWidth = 2; c.strokeRect(...br.r); c.restore(); continue; }
    c.globalAlpha = left < 0.8 ? 0.45 + 0.45 * Math.round((Math.sin(t * 30) + 1) / 2) : 1;
    c.fillStyle = 'rgba(0,0,0,.25)'; c.fillRect(br.r[0] + 3, br.r[1] + 4, br.r[2], br.r[3]);
    c.fillStyle = th.bridge; c.fillRect(...br.r);
    c.strokeStyle = 'rgba(0,0,0,.25)'; c.lineWidth = 2;
    for (let x = br.r[0] + 14; x < br.r[0] + br.r[2]; x += 14) { c.beginPath(); c.moveTo(x, br.r[1]); c.lineTo(x, br.r[1] + br.r[3]); c.stroke(); }
    c.restore();
  }
  // Ventilateurs (cheminées) : flèches qui montent quand ils soufflent
  for (const z of (hole.zones || []).filter(z => z.t === 'fan')) {
    if (!active(z, t)) continue;
    c.save(); c.beginPath(); c.rect(...z.r); c.clip();
    c.strokeStyle = 'rgba(255,190,120,.6)'; c.lineWidth = 4;
    const off = (t * 120) % 60;
    for (let x = z.r[0] + 30; x < z.r[0] + z.r[2]; x += 60) for (let y = z.r[1] + z.r[3] + 60 - off; y > z.r[1] - 20; y -= 60) chevron(c, x, y, z.dir, 10);
    c.restore();
  }
  // Téléporteurs : tourbillon
  for (const tp of hole.teleports || []) {
    for (let k = 0; k < 3; k++) { c.strokeStyle = ['#c49bff', '#7bd3ff', '#fff'][k]; c.lineWidth = 3; c.beginPath(); c.arc(tp.from[0], tp.from[1], tp.r - k * 5, t * (3 + k) + k, t * (3 + k) + k + 3.5); c.stroke(); }
  }
  // Moulins et portes
  for (const m of movers(hole, t)) {
    c.lineCap = 'round';
    if (m.w !== undefined) {
      c.strokeStyle = 'rgba(0,0,0,.25)'; c.lineWidth = WALL * 2 + 4; c.beginPath(); c.moveTo(m.ax + 3, m.ay + 4); c.lineTo(m.bx + 3, m.by + 4); c.stroke();
      c.strokeStyle = '#7a4a24'; c.lineWidth = WALL * 2 + 2; c.beginPath(); c.moveTo(m.ax, m.ay); c.lineTo(m.bx, m.by); c.stroke();
      c.strokeStyle = '#fff6e6'; c.lineWidth = WALL * 2 - 2; c.beginPath(); c.moveTo(m.ax + (m.bx - m.ax) * 0.25, m.ay + (m.by - m.ay) * 0.25); c.lineTo(m.bx, m.by); c.stroke();
    } else {
      c.strokeStyle = th.dark; c.lineWidth = WALL * 2 + 3; c.beginPath(); c.moveTo(m.ax, m.ay); c.lineTo(m.bx, m.by); c.stroke();
      c.strokeStyle = '#ffd23f'; c.lineWidth = WALL * 2 - 1; c.stroke();
      c.strokeStyle = '#222'; c.setLineDash([8, 8]); c.lineCap = 'butt'; c.stroke(); c.setLineDash([]);
    }
  }
  for (const m of hole.windmills || []) { c.fillStyle = '#c0392b'; c.beginPath(); c.arc(m.x, m.y, 15, 0, 7); c.fill(); c.fillStyle = '#ffe0b0'; c.beginPath(); c.arc(m.x, m.y, 6, 0, 7); c.fill(); }

  // Balles : trajectoire rejouée pour celle qui roule
  const roll = rolling(sNow);
  if (roll) fireEvents(roll.f);
  if (roll && state.stage === 'roll') {
    anim.trail.push([roll.x, roll.y]);
    if (anim.trail.length > 16) anim.trail.shift();
    const col = playerOf(anim.shot.name)?.color ?? '#fff';
    c.strokeStyle = col; c.lineCap = 'round';
    for (let i = 1; i < anim.trail.length; i++) { const [x0, y0] = anim.trail[i - 1], [x1, y1] = anim.trail[i]; if (Math.hypot(x1 - x0, y1 - y0) > 60) continue; c.globalAlpha = (i / anim.trail.length) * 0.5; c.lineWidth = R * 1.6 * (i / anim.trail.length); c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke(); }
    c.globalAlpha = 1;
  }
  const shown = [];
  for (const name of state.order) {
    const b = state.balls[name], p = playerOf(name);
    if (!b || !p) continue;
    if (roll && anim.shot.name === name && state.stage === 'roll') {
      if (!(roll.end && anim.shot.result !== 'stop')) shown.push({ name, x: roll.x, y: roll.y, color: p.color }); // sinon : dans le trou ou à l'eau
    } else if (!b.done) shown.push({ name, x: b.x, y: b.y, color: p.color, ring: name === state.turn && state.stage === 'aim' });
  }
  shown.sort((a, b) => !!a.ring - !!b.ring); // celle qui joue par-dessus les autres
  for (const b of shown) {
    const crowded = shown.some(o => o !== b && Math.hypot(o.x - b.x, o.y - b.y) < 34);
    drawBall(c, b.x, b.y, b.color, t, b.ring, shown.length > 1 && (!crowded || b.ring) && b.name); // pas de noms qui se chevauchent
  }

  // Visée : pointillés dans la direction du tir, longueur et couleur selon la puissance
  if (aimAt && myTurn()) {
    const b = state.balls[state.me], { angle, power } = shotFrom(aimAt), len = 30 + power * 170;
    setPower(power);
    const col = power < 0.5 ? '#43c173' : power < 0.8 ? '#ffc93c' : '#ff5a5f';
    c.strokeStyle = col; c.lineWidth = 4; c.setLineDash([2, 9]); c.lineCap = 'round';
    c.beginPath(); c.moveTo(b.x, b.y); c.lineTo(b.x + Math.cos(angle) * len, b.y + Math.sin(angle) * len); c.stroke(); c.setLineDash([]);
    c.fillStyle = col; c.save(); c.translate(b.x + Math.cos(angle) * len, b.y + Math.sin(angle) * len); c.rotate(angle);
    c.beginPath(); c.moveTo(10, 0); c.lineTo(-6, -8); c.lineTo(-6, 8); c.fill(); c.restore();
    c.strokeStyle = 'rgba(255,255,255,.5)'; c.lineWidth = 2; c.beginPath(); c.moveTo(b.x, b.y); c.lineTo(aimAt.x, aimAt.y); c.stroke(); // l'élastique du lance-pierre
  }

  // Particules
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i];
    p.age += dt;
    if (p.age > p.life) { parts.splice(i, 1); continue; }
    p.vx *= 1 - dt * 2; p.vy = p.vy * (1 - dt * 2) + p.grav * dt;
    p.x += p.vx * dt; p.y += p.vy * dt;
    c.globalAlpha = 1 - p.age / p.life; c.fillStyle = p.c;
    c.fillRect(p.x - p.s / 2, p.y - p.s / 2, p.s, p.s);
  }
  c.globalAlpha = 1;

  // Au-dessus des balles : toit des tunnels, palmes, drapeau
  for (const d of hole.deco || []) if (d.t === 'tunnel') {
    const [x, y, w, h] = d.r;
    c.fillStyle = 'rgba(0,0,0,.25)'; c.fillRect(x + 4, y + 6, w, h);
    c.fillStyle = '#8a5530'; c.fillRect(x, y, w, h);
    c.fillStyle = '#a86c38'; for (let k = 0; k < w; k += 20) c.fillRect(x + k + 2, y + 3, 16, h - 6);
    c.fillStyle = '#4a2c14'; c.fillRect(x, y, 8, h); c.fillRect(x + w - 8, y, 8, h);
  }
  for (const b of hole.bumpers || []) if (b.palm) {
    for (let k = 0; k < 6; k++) {
      const a = k * 1.05 + Math.sin(t * 1.2 + k) * 0.06;
      c.fillStyle = k % 2 ? 'rgba(46,140,60,.85)' : 'rgba(64,170,74,.85)';
      c.save(); c.translate(b.x, b.y); c.rotate(a); c.beginPath(); c.ellipse(26, 0, 28, 8, 0, 0, 7); c.fill(); c.restore();
    }
    c.fillStyle = '#8a5a2b'; c.beginPath(); c.arc(b.x, b.y, 7, 0, 7); c.fill();
  }
  const [fx, fy] = hole.cup;
  c.strokeStyle = '#eee'; c.lineWidth = 2.5; c.beginPath(); c.moveTo(fx, fy); c.lineTo(fx + 4, fy - 46); c.stroke();
  c.fillStyle = '#ff5a5f'; c.beginPath(); c.moveTo(fx + 4, fy - 46); c.quadraticCurveTo(fx + 18, fy - 44 + Math.sin(t * 4) * 3, fx + 30, fy - 38 + Math.sin(t * 4 + 1) * 2); c.lineTo(fx + 4, fy - 30); c.fill();

  renderStatus();
}
requestAnimationFrame(frame);
