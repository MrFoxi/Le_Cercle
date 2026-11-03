// Strategy Club : le club (choix du jeu), l'entrée d'un jeu, le salon, la partie, la fin de partie.
/* global io */
import { createBoard, demoState, kanji, esc } from './boards.js';

const G = window.StrategyGames;
const socket = io('/strategy');
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const store = {
  get: k => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { v === null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch { /* stockage bloqué */ } },
};
const TOUCH = matchMedia('(pointer: coarse)').matches;
const urlCode = new URLSearchParams(location.search).get('salon')?.toUpperCase();

// Pour ajouter un jeu : ses règles dans games/, sa fiche ici, et son nom dans strategy/game.js.
const INFO = {
  chess: { title: 'Échecs', kicker: 'Classique · élégant · prestigieux', desc: 'Le roi des jeux de stratégie. Mettez le roi adverse échec et mat : roque, prise en passant, promotion, pat et nulles selon les règles officielles.', board: '8 × 8' },
  draughts: { title: 'Dames', kicker: 'Sobre · convivial', desc: 'Les dames internationales sur 10 × 10. Prise obligatoire et majoritaire, rafles en avant comme en arrière, dames volantes.', board: '10 × 10' },
  shogi: { title: 'Shogi', kicker: 'Bois · papier · Japon', desc: 'Les échecs japonais. Les pièces capturées changent de camp et peuvent être parachutées sur le plateau ; elles se promeuvent en zone adverse.', board: '9 × 9' },
  go: { title: 'Go', kicker: 'Minimaliste · millénaire', desc: 'Entourez plus de territoire que l’adversaire. Captures par les libertés, règle du ko, compte chinois ou japonais.', board: '9 × 9 · 13 × 13 · 19 × 19' },
};
const GAME_IDS = Object.keys(INFO);
const LEVELS = [['debutant', 'Débutant'], ['facile', 'Facile'], ['intermediaire', 'Intermédiaire'], ['difficile', 'Difficile'], ['expert', 'Expert']];
const levelName = id => LEVELS.find(l => l[0] === id)?.[1] ?? id;
const TIMES = [0, 5, 10, 15, 30];
const timeLabel = t => (t ? `${t} min` : 'Sans limite');
const RULES = { chinese: 'Compte chinois (aire)', japanese: 'Compte japonais (territoire)' };
const clock = ms => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

let me = store.get('sc-pseudo') || store.get('pseudo') || '';
let view = null, offset = 0, toastTimer;

function show(id) { for (const s of $$('.screen')) s.hidden = s.id !== id; }
function toast(text, ok = false) {
  const t = $('#toast');
  t.textContent = text;
  t.className = ok ? 'ok' : '';
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.hidden = true), 2800);
}
const act = (...args) => new Promise(done => socket.emit('act', ...args, res => { if (res?.error) toast(res.error); done(res); }));

/* ---------- Sons (bois synthétisé) ---------- */
let ac;
document.addEventListener('pointerdown', () => { ac ??= new (window.AudioContext || window.webkitAudioContext)(); ac.resume(); });
function knock(freq = 220, vol = 0.25, len = 0.12) {
  if (!ac || looks.mute) return;
  const t = ac.currentTime, o = ac.createOscillator(), g = ac.createGain(), f = ac.createBiquadFilter();
  o.type = 'triangle';
  o.frequency.setValueAtTime(freq, t);
  o.frequency.exponentialRampToValueAtTime(freq * 0.55, t + len);
  f.type = 'lowpass'; f.frequency.value = 1800;
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + len);
  o.connect(f).connect(g).connect(ac.destination);
  o.start(t); o.stop(t + len);
}
const sfx = { move: () => knock(240, 0.22), capture: () => { knock(170, 0.3, 0.18); knock(320, 0.12, 0.08); }, end: () => [0, 0.12, 0.24].forEach((d, i) => setTimeout(() => knock(330 + i * 110, 0.15, 0.3), d * 1000)) };

/* ---------- Apparence ---------- */
const LOOKS = {
  board: { label: 'Plateau', options: { bois: 'Bois noble', marbre: 'Marbre', tournoi: 'Vert tournoi', nuit: 'Nuit moderne' } },
  pieces: { label: 'Pièces d’échecs', options: { classique: 'Classiques pleines', contour: 'Contours', lettres: 'Lettres (R, D, T…)' } },
  ambiance: { label: 'Ambiance', options: { feutree: 'Feutrée', claire: 'Claire', moderne: 'Moderne' } },
  coords: { label: 'Coordonnées', options: { oui: 'Affichées', non: 'Masquées' } },
};
let looks = { board: 'bois', pieces: 'classique', ambiance: 'feutree', coords: 'oui', mute: false };
try { looks = { ...looks, ...JSON.parse(store.get('sc-looks')) }; } catch { /* réglages illisibles */ }
function applyLooks() {
  for (const k of Object.keys(LOOKS)) document.body.dataset[k] = looks[k];
  store.set('sc-looks', JSON.stringify(looks));
}
applyLooks();
function renderLooks() {
  $('#looksBody').innerHTML = Object.entries(LOOKS).map(([k, l]) => `<h3>${l.label}</h3><div class="chips">${Object.entries(l.options).map(([v, t]) =>
    `<button class="chip${looks[k] === v ? ' on' : ''}" data-look="${k}" data-v="${v}">${t}</button>`).join('')}</div>`).join('')
    + `<h3>Son</h3><div class="chips"><button class="chip${looks.mute ? '' : ' on'}" data-look="mute" data-v="0">Activé</button><button class="chip${looks.mute ? ' on' : ''}" data-look="mute" data-v="1">Coupé</button></div>`;
}
$('#looksBody').onclick = e => {
  const b = e.target.closest('[data-look]');
  if (!b) return;
  looks[b.dataset.look] = b.dataset.look === 'mute' ? b.dataset.v === '1' : b.dataset.v;
  applyLooks();
  renderLooks();
  if (view && view.phase !== 'lobby') drawGame();
  if (!$('#hall').hidden) openHall(hallGame, false);
};
document.addEventListener('click', e => { if (e.target.closest('[data-open="looks"]')) { renderLooks(); $('#looksDlg').showModal(); } });

/* ---------- Pseudo et club ---------- */
function entry() {
  $('#meName').textContent = me;
  $('#nameForm').pseudo.value = me;
  if (!me) return show('name');
  show('club');
  if (urlCode) $('#joinForm').code.value = urlCode;
}
$('#nameForm').onsubmit = e => {
  e.preventDefault();
  me = e.target.pseudo.value.trim().slice(0, 20);
  if (!me) return;
  store.set('sc-pseudo', me);
  entry();
};
$('#changeName').onclick = e => { e.preventDefault(); show('name'); $('#nameForm').pseudo.focus(); };

// Petites illustrations des cartes : chaque jeu son plateau.
function miniArt(g) {
  if (g === 'chess') {
    let s = '';
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) if ((r + c) % 2) s += `<rect x="${c}" y="${r}" width="1" height="1" class="d"/>`;
    return `<svg viewBox="0 0 8 8" class="art chess"><rect width="8" height="8" class="l"/>${s}<text x="3.5" y="5.6">♚︎</text><text x="5.5" y="3.6" class="w">♛︎</text><text x="1.5" y="7.6" class="w">♞︎</text></svg>`;
  }
  if (g === 'draughts') {
    let s = '';
    for (let r = 0; r < 10; r++) for (let c = 0; c < 10; c++) if ((r + c) % 2) {
      s += `<rect x="${c}" y="${r}" width="1" height="1" class="d"/>`;
      if (r < 3 || r > 6) s += `<circle cx="${c + 0.5}" cy="${r + 0.5}" r=".38" class="${r < 3 ? 'pb' : 'pw'}"/>`;
    }
    return `<svg viewBox="0 0 10 10" class="art draughts"><rect width="10" height="10" class="l"/>${s}</svg>`;
  }
  if (g === 'shogi') {
    let s = '';
    for (let i = 0; i <= 9; i++) s += `<line x1="${i}" y1="0" x2="${i}" y2="9"/><line x1="0" y1="${i}" x2="9" y2="${i}"/>`;
    return `<svg viewBox="-.2 -.2 9.4 9.4" class="art shogi"><rect x="-.2" y="-.2" width="9.4" height="9.4" class="wood"/>${s}
      <g transform="translate(4.5 7.5) scale(1.7)"><path d="M0 -.48 L.36 -.3 L.42 .45 L-.42 .45 L-.36 -.3Z" class="pc"/><text y=".28">玉</text></g>
      <g transform="translate(4.5 1.5) rotate(180) scale(1.7)"><path d="M0 -.48 L.36 -.3 L.42 .45 L-.42 .45 L-.36 -.3Z" class="pc"/><text y=".28">王</text></g>
      <g transform="translate(2.5 5.5) scale(1.7)"><path d="M0 -.48 L.36 -.3 L.42 .45 L-.42 .45 L-.36 -.3Z" class="pc"/><text y=".28" class="red">龍</text></g></svg>`;
  }
  let s = '';
  for (let i = 0; i < 9; i++) s += `<line x1="${i + 1}" y1="1" x2="${i + 1}" y2="9"/><line x1="1" y1="${i + 1}" x2="9" y2="${i + 1}"/>`;
  const stones = [[3, 3, 1], [7, 3, 2], [3, 7, 2], [5, 5, 1], [6, 4, 2], [4, 6, 1], [7, 7, 1], [4, 4, 2]].map(([x, y, v]) => `<circle cx="${x}" cy="${y}" r=".45" class="s${v}"/>`).join('');
  return `<svg viewBox="0 0 10 10" class="art go"><rect width="10" height="10" class="wood"/>${s}${stones}</svg>`;
}
$('#cards').innerHTML = GAME_IDS.map(g => `<article class="card ${g}" data-game="${g}" tabindex="0">
  <div class="art-wrap">${miniArt(g)}</div>
  <div class="card-body"><p class="kicker">${INFO[g].kicker}</p><h2>${INFO[g].title}</h2><p>${INFO[g].desc}</p>
  <p class="meta"><span>👥 2 joueurs ou contre un robot</span><span>▦ ${INFO[g].board}</span></p>
  <button class="primary">Entrer →</button></div></article>`).join('');
$('#cards').onclick = e => { const c = e.target.closest('[data-game]'); if (c) warpTo(c.dataset.game, e); };
$('#cards').onkeydown = e => { const c = e.target.closest('[data-game]'); if (c && e.key === 'Enter') warpTo(c.dataset.game, e); };

// Transition : un voile aux couleurs du jeu s'ouvre depuis le clic, puis le plateau se construit.
function warpTo(g, e) {
  const w = $('#warp');
  const r = e.target.closest('[data-game]').getBoundingClientRect();
  w.style.setProperty('--x', `${e.clientX || r.left + r.width / 2}px`);
  w.style.setProperty('--y', `${e.clientY || r.top + r.height / 2}px`);
  w.className = `warp ${g}`;
  w.hidden = false;
  void w.offsetWidth;
  w.classList.add('open');
  setTimeout(() => { openHall(g); w.classList.add('fade'); }, 520);
  setTimeout(() => { w.hidden = true; w.className = 'warp'; }, 1150);
}

/* ---------- Entrée d'un jeu ---------- */
let hallGame = 'chess', hallBoard = null;
const botPrefs = { level: store.get('sc-level') || 'intermediaire', side: 'random', time: 0, goSize: 9, goRules: 'chinese' };
function chipRow(key, options, current) {
  return `<div class="chips" data-pref="${key}">${options.map(([v, t]) => `<button class="chip${String(current) === String(v) ? ' on' : ''}" data-v="${v}">${t}</button>`).join('')}</div>`;
}
function renderBotOpts() {
  const g = G[hallGame];
  $('#botLevels').innerHTML = chipRow('level', LEVELS, botPrefs.level);
  $('#botOpts').innerHTML = `<label>Ton camp</label>${chipRow('side', [['random', '🎲 Au hasard'], [0, g.sides[0]], [1, g.sides[1]]], botPrefs.side)}
    <label>Temps de réflexion</label>${chipRow('time', TIMES.map(t => [t, timeLabel(t)]), botPrefs.time)}
    ${hallGame === 'go' ? `<label>Plateau</label>${chipRow('goSize', [[9, '9 × 9'], [13, '13 × 13'], [19, '19 × 19']], botPrefs.goSize)}
    <label>Compte</label>${chipRow('goRules', Object.entries(RULES), botPrefs.goRules)}` : ''}`;
}
$('#hall').addEventListener('click', e => {
  const b = e.target.closest('[data-pref] [data-v]');
  if (!b) return;
  const key = b.closest('[data-pref]').dataset.pref, v = b.dataset.v;
  botPrefs[key] = ['time', 'goSize'].includes(key) ? +v : key === 'side' && v !== 'random' ? +v : v;
  if (key === 'level') store.set('sc-level', v);
  renderBotOpts();
});
function openHall(g, animate = true) {
  hallGame = g;
  show('hall');
  document.body.dataset.game = g;
  $('#hallKicker').textContent = INFO[g].kicker;
  $('#hallTitle').textContent = INFO[g].title;
  $('#hallDesc').textContent = INFO[g].desc;
  renderBotOpts();
  hallBoard = createBoard($('#hallBoard'), g);
  hallBoard.render(demoState(g), { look: looks, bottom: 0 });
  if (animate) hallBoard.intro();
  renderRooms();
}
$('#hallBack').onclick = () => { document.body.dataset.game = ''; show('club'); };

function createRoom(isPrivate, then) {
  socket.emit('create', { name: me, private: isPrivate }, res => {
    if (res?.error) return toast(res.error);
    then();
  });
}
async function configure(g, prefs) {
  await act('configure', 'game', g);
  await act('configure', 'time', prefs.time);
  if (g === 'go') { await act('configure', 'goSize', prefs.goSize); await act('configure', 'goRules', prefs.goRules); }
}
$('#playBot').onclick = e => {
  e.target.disabled = true;
  setTimeout(() => (e.target.disabled = false), 1500);
  createRoom(true, async () => {
    await configure(hallGame, botPrefs);
    const side = botPrefs.side === 'random' ? (Math.random() < 0.5 ? 0 : 1) : botPrefs.side;
    if (side === 1) await act('sit', 1);
    await act('addBot', 1 - side, botPrefs.level);
    await act('setReady', true);
  });
};
document.addEventListener('click', e => {
  const b = e.target.closest('[data-create]');
  if (b) createRoom(b.dataset.create === 'private', () => configure(hallGame, botPrefs));
});

/* ---------- Liste des parties ---------- */
let roomList = [];
socket.on('rooms', list => { roomList = list; renderRooms(); });
function roomItem(r) {
  const names = (r.seats || []).map(s => (s ? esc(s.name) : '<i>place libre</i>')).join(' <span>vs</span> ');
  const phase = { lobby: 'Dans le salon', playing: 'Partie en cours', scoring: 'Compte des points', over: 'Partie terminée' }[r.phase];
  return `<li><span class="tag ${r.game}">${INFO[r.game]?.title ?? ''}</span><div><b>${names}</b><small>${phase}${r.spectators ? ` · 👁 ${r.spectators}` : ''}</small></div>
    ${r.players.length < 2 && r.phase === 'lobby' && (r.seats || []).some(s => !s) ? `<button class="primary small" data-room="${r.code}" data-mode="play">Rejoindre</button>` : ''}
    <button class="ghost small" data-room="${r.code}" data-mode="watch">👁 Regarder</button></li>`;
}
function renderRooms() {
  $('#rooms').innerHTML = roomList.map(roomItem).join('') || '<li class="empty">Aucune partie publique pour l’instant : lance la tienne !</li>';
  const mine = roomList.filter(r => r.game === hallGame);
  $('#hallRooms').innerHTML = mine.length ? mine.map(roomItem).join('') : '<li class="empty">Aucune partie publique de ce jeu. Crée la première !</li>';
}
function join(code, watch, button) {
  if (button) button.disabled = true;
  socket.emit('join', { code, name: me, watch }, res => {
    if (button) button.disabled = false;
    if (res?.error) toast(res.error);
  });
}
$('#joinForm').onsubmit = e => { e.preventDefault(); join(e.target.code.value.trim().toUpperCase(), e.submitter?.value === 'watch', e.submitter); };
$('#joinForm').code.oninput = e => (e.target.value = e.target.value.toUpperCase());
document.addEventListener('click', e => {
  const b = e.target.closest('[data-room]');
  if (b) join(b.dataset.room, b.dataset.mode === 'watch', b);
  if (e.target.closest('[data-leave]')) {
    const playing = view && ['playing', 'scoring'].includes(view.phase) && view.mySide >= 0;
    if (playing && !confirm('Quitter la partie ? Elle s’arrêtera pour ton adversaire.')) return;
    socket.emit('leave');
    reset();
  }
});

/* ---------- Session ---------- */
function reset() {
  store.set('sc-session', null);
  view = null;
  board = null;
  $('#overlay').hidden = true;
  history.replaceState(null, '', location.pathname);
  entry();
}
socket.on('session', s => { store.set('sc-session', JSON.stringify(s)); history.replaceState(null, '', `?salon=${s.code}`); });
socket.on('closed', msg => { toast(msg); reset(); });
socket.on('connect', () => {
  let s = null;
  try { s = JSON.parse(store.get('sc-session')); } catch { /* session illisible */ }
  if (s && (!urlCode || urlCode === s.code)) {
    socket.emit('resume', s, res => {
      if (!res?.error) return;
      store.set('sc-session', null);
      entry();
    });
  }
});
entry();

socket.on('state', v => {
  const prev = view;
  view = v;
  offset = v.now - Date.now();
  document.body.dataset.game = v.settings.game;
  renderChat(v);
  if (v.phase === 'lobby') { board = null; return renderLobby(v); }
  onGame(v, prev);
});

/* ---------- Discussion ---------- */
let chatSeen = 0;
function renderChat(v) {
  const html = (v.chat || []).map(m => `<li class="${m.name === v.me ? 'mine' : ''}"><b>${esc(m.name)}${m.spectator ? ' 👁' : ''}</b> ${esc(m.text)}</li>`).join('') || '<li class="empty">Dites bonjour !</li>';
  for (const ol of $$('.msgs')) { ol.innerHTML = html; ol.scrollTop = ol.scrollHeight; }
  const last = v.chat?.at(-1)?.id ?? 0;
  if (last > chatSeen && chatSeen && v.chat.at(-1).name !== v.me) knock(660, 0.06, 0.08);
  chatSeen = last;
}
for (const f of $$('.say')) f.onsubmit = e => {
  e.preventDefault();
  const input = f.querySelector('input'), text = input.value.trim();
  if (text) socket.emit('chat', text);
  input.value = '';
};

/* ---------- Salon ---------- */
function seatHTML(v, side) {
  const seat = v.seats[side], host = v.me === v.host, label = G[v.settings.game].sides[side];
  let body;
  if (!seat) {
    body = `<p class="free">Place libre</p><div class="row">${v.spectator ? '' : `<button class="ghost small" data-sit="${side}">S’asseoir ici</button>`}
      ${host ? `<select data-addbot="${side}" aria-label="Ajouter un robot"><option value="">🤖 Ajouter un robot…</option>${LEVELS.map(([id, t]) => `<option value="${id}">${t}</option>`).join('')}</select>` : ''}</div>`;
  } else if (seat.bot) {
    body = `<p class="who">🤖 ${esc(seat.name)}</p>${host ? `<div class="row"><select data-botlevel aria-label="Niveau du robot">${LEVELS.map(([id, t]) => `<option value="${id}"${id === seat.bot ? ' selected' : ''}>${t}</option>`).join('')}</select>
      <button class="ghost small" data-rmbot="${side}">Retirer</button></div>` : ''}<p class="ready on">Toujours prêt</p>`;
  } else {
    const p = v.players.find(x => x.name === seat.name);
    body = `<p class="who"><span class="dot ${p?.connected ? 'on' : 'off'}"></span>${esc(seat.name)}${seat.name === v.me ? ' <small>(toi)</small>' : ''}${seat.name === v.host ? ' <small>hôte</small>' : ''}</p>
      <p class="ready${v.ready.includes(seat.name) ? ' on' : ''}">${v.ready.includes(seat.name) ? '✓ Prêt' : 'Pas encore prêt'}</p>`;
  }
  return `<div class="seat side${side}"><span class="side-chip s${side}">${esc(label)}</span>${body}</div>`;
}
function renderLobby(v) {
  show('lobby');
  $('#overlay').hidden = true;
  const g = v.settings.game, host = v.me === v.host;
  $('#lobbyBrand').textContent = `Strategy Club · ${INFO[g].title}`;
  $('#lobbyTitle').textContent = `Salon · ${INFO[g].title}`;
  $('#lobbyNotice').hidden = !v.notice;
  $('#lobbyNotice').textContent = v.notice ?? '';
  $('#seats').innerHTML = seatHTML(v, 0) + '<span class="vs">VS</span>' + seatHTML(v, 1);
  const seated = v.mySide >= 0, ready = v.ready.includes(v.me);
  $('#readyBtn').hidden = !seated;
  $('#readyBtn').textContent = ready ? '✓ Prêt — annuler' : 'Je suis prêt';
  $('#readyBtn').classList.toggle('on', ready);
  $('#readyHint').textContent = !v.seats.every(Boolean) ? 'En attente d’un adversaire : invite un ami ou ajoute un robot.'
    : seated ? 'La partie commence dès que tout le monde est prêt.' : v.spectator ? 'Tu regardes ce salon.' : 'Assieds-toi pour jouer.';
  const s = v.settings, row = (key, opts) => `<div class="chips${host ? '' : ' readonly'}" data-set="${key}">${opts.map(([val, t]) => `<button class="chip${String(s[key]) === String(val) ? ' on' : ''}" data-v="${val}" ${host ? '' : 'disabled'}>${t}</button>`).join('')}</div>`;
  $('#settings').innerHTML = `<label>Jeu</label>${row('game', GAME_IDS.map(id => [id, INFO[id].title]))}
    <label>Temps par joueur</label>${row('time', TIMES.map(t => [t, timeLabel(t)]))}
    ${g === 'go' ? `<label>Plateau</label>${row('goSize', [[9, '9 × 9'], [13, '13 × 13'], [19, '19 × 19']])}<label>Compte</label>${row('goRules', Object.entries(RULES))}` : ''}
    ${host ? '' : `<p class="hint">Réglages choisis par ${esc(v.host)}.</p>`}`;
  $('#roomCode').textContent = v.code;
  $('#privacyLine').textContent = v.private ? '🔒 Salon privé : partage le code ou le lien.' : '🌍 Salon public : visible dans la liste du club.';
  $('#watchers').textContent = v.spectators.length ? `👁 Spectateurs : ${v.spectators.join(', ')}` : 'Aucun spectateur.';
}
$('#lobby').addEventListener('click', e => {
  const t = e.target;
  const set = t.closest('[data-set] [data-v]');
  if (set) {
    const key = set.closest('[data-set]').dataset.set, v = set.dataset.v;
    act('configure', key, ['time', 'goSize'].includes(key) ? +v : v);
  }
  if (t.closest('[data-sit]')) act('sit', +t.closest('[data-sit]').dataset.sit);
  if (t.closest('[data-rmbot]')) act('removeBot', +t.closest('[data-rmbot]').dataset.rmbot);
});
$('#lobby').addEventListener('change', e => {
  const t = e.target;
  if (t.dataset.addbot !== undefined && t.value) act('addBot', +t.dataset.addbot, t.value);
  if (t.matches('[data-botlevel]')) act('setBotLevel', t.value);
});
$('#readyBtn').onclick = () => act('setReady', !view.ready.includes(view.me));
$('#copyLink').onclick = () => navigator.clipboard.writeText(`${location.origin}${location.pathname}?salon=${view.code}`)
  .then(() => toast('Lien copié : envoie-le à ton adversaire !', true), () => toast('Copie impossible'));

/* ---------- Partie ---------- */
let board = null, boardKey = '', sel = {}, legal = [], anim = null;
const game = () => G[view.settings.game];
const bottomSide = () => (view.mySide >= 0 ? view.mySide : 0);
const canPlay = () => view && view.phase === 'playing' && view.mySide >= 0 && view.mySide === view.state.turn;

// Ce que le dernier coup a changé, pour l'animer : départ, arrivée, pièces prises.
function moveAnim(v, prev) {
  if (!prev || prev.round !== v.round || prev.phase === 'lobby' || v.history.length !== prev.history.length + 1) return null;
  const g = game(), last = v.history.at(-1), m = g.moves(prev.state).find(x => x.key === last.key);
  if (!m || m.pass) return { caps: [] };
  let caps = [];
  if (v.settings.game === 'chess' && m.cap) caps = [m.ep ? m.to + (last.side === 0 ? 8 : -8) : m.to];
  if (v.settings.game === 'draughts') caps = m.caps;
  if (v.settings.game === 'shogi' && m.cap) caps = [m.to];
  if (v.settings.game === 'go') caps = prev.state.b.map((x, i) => (x && !v.state.b[i] ? i : -1)).filter(i => i >= 0);
  return { from: m.from ?? null, to: m.to ?? m.at, caps, prev: prev.state, side: last.side };
}

function onGame(v, prev) {
  show('play');
  const key = `${v.code}|${v.round}|${v.settings.game}`;
  const fresh = key !== boardKey || !board;
  if (fresh) {
    boardKey = key;
    board = createBoard($('#board'), v.settings.game, { onSquare });
    sel = {};
  }
  anim = fresh ? null : moveAnim(v, prev);
  if (anim) (anim.caps.length ? sfx.capture : sfx.move)();
  if (prev && prev.phase !== 'over' && v.phase === 'over') sfx.end();
  if (!canPlay()) sel = {};
  drawGame();
  if (fresh) board.intro();
  anim = null;
}

function targetsFor(g) {
  const t = new Map();
  if (!canPlay()) return t;
  if (g === 'draughts') {
    if (!sel.path) for (const m of legal) t.set(m.from, 'can'); // pièces qui peuvent jouer (prise obligatoire : seulement elles)
    else for (const m of legal) if (sel.path.every((p, i) => m.path[i] === p) && m.path.length > sel.path.length) t.set(m.path[sel.path.length], m.caps.length ? 'cap' : 'move');
    return t;
  }
  if (sel.from === undefined && !sel.drop) return t;
  for (const m of legal) if (sel.drop ? m.drop === sel.drop : m.from === sel.from) t.set(m.to, m.cap ? 'cap' : 'move');
  return t;
}

function drawGame() {
  const v = view, g = v.settings.game, eng = game(), st = v.state, bottom = bottomSide();
  legal = canPlay() ? eng.moves(st) : [];
  const last = v.history.at(-1);
  const ui = {
    look: looks, bottom, flip: g !== 'go' && bottom === 1, anim, targets: targetsFor(g),
    selected: g === 'draughts' ? sel.path?.at(-1) : g === 'go' ? sel.go : sel.from,
    last: last && g !== 'go' && last.key !== 'pass' ? [last.from, last.to] : [], interactive: canPlay(),
  };
  if (g === 'draughts' && sel.path) ui.last = sel.path.slice(0, -1);
  if (eng.inCheck && v.phase === 'playing' && eng.inCheck(st)) ui.check = st.b.indexOf(g === 'chess' ? (st.turn ? 'k' : 'K') : (st.turn ? 'k' : 'K'));
  if (g === 'go') {
    ui.legal = new Set(legal.filter(m => !m.pass).map(m => m.at));
    ui.lastPoint = last && last.key !== 'pass' ? last.to : null;
    if (v.phase === 'scoring') { ui.dead = v.dead; ui.owner = v.score.owner; }
  }
  board.render(st, ui);
  renderBars(v);
  renderHands(v);
  renderStatus(v);
  renderMoves(v);
  renderScoring(v);
  renderOver(v);
}

function onSquare(i) {
  const v = view;
  if (!v) return;
  const g = v.settings.game;
  if (v.phase === 'scoring' && v.mySide >= 0) return act('markDead', i);
  if (!canPlay()) return;
  if (g === 'go') {
    const m = legal.find(x => x.at === i);
    if (!m) return;
    if (TOUCH && sel.go !== i) { sel = { go: i }; return drawGame(); } // au doigt : la pierre apparaît, un 2e toucher la pose
    return send(m);
  }
  if (g === 'draughts') {
    if (sel.path) {
      const next = sel.path.concat(i);
      const cands = legal.filter(m => next.every((p, k) => m.path[k] === p));
      if (cands.length) {
        const done = cands.find(m => m.path.length === next.length);
        if (done) return send(done);
        sel = { path: next };
        return drawGame();
      }
    }
    sel = legal.some(m => m.from === i) ? { path: [i] } : {};
    return drawGame();
  }
  if (sel.from !== undefined || sel.drop) {
    const options = legal.filter(m => m.to === i && (sel.drop ? m.drop === sel.drop : m.from === sel.from));
    if (options.length === 1) return send(options[0]);
    if (options.length > 1) return pickPromotion(options);
  }
  sel = legal.some(m => m.from === i) ? { from: i } : {};
  drawGame();
}
function send(m) {
  sel = {};
  act('move', m.key, view.history.length);
}
// Promotion : dame, tour, fou ou cavalier aux échecs ; promouvoir ou non au shogi.
function pickPromotion(options) {
  const g = view.settings.game, dlg = $('#choiceDlg');
  const label = m => (g === 'chess' ? { q: '♛ Dame', r: '♜ Tour', b: '♝ Fou', n: '♞ Cavalier' }[m.promo.toLowerCase()] : m.promo ? `Promouvoir (${kanji('+' + m.piece.replace('+', '').toUpperCase(), 0)})` : 'Ne pas promouvoir');
  $('#choiceText').textContent = g === 'chess' ? 'Promotion du pion :' : 'Promouvoir cette pièce ?';
  $('#choiceBtns').innerHTML = options.map((m, k) => `<button class="${k ? 'ghost' : 'primary'}" data-k="${k}">${label(m)}</button>`).join('');
  $('#choiceBtns').onclick = e => {
    const b = e.target.closest('[data-k]');
    if (!b) return;
    dlg.close();
    send(options[+b.dataset.k]);
  };
  dlg.showModal();
}

/* Barres des joueurs, pendules, réserve du shogi */
function remaining(v, side) {
  if (!v.settings.time) return null;
  const running = v.phase === 'playing' && v.state.turn === side;
  return v.clocks[side] - (running ? Date.now() + offset - v.turnStart : 0);
}
function barHTML(v, side) {
  const seat = v.seats[side], g = game(), p = seat && v.players.find(x => x.name === seat.name);
  const active = ['playing', 'scoring'].includes(v.phase) && v.state.turn === side;
  const t = remaining(v, side);
  const caps = v.settings.game === 'go' ? `<small>${v.state.caps[side]} prise${v.state.caps[side] > 1 ? 's' : ''}</small>` : '';
  return `<div class="pl${active ? ' active' : ''}"><span class="side-chip s${side}">${esc(g.sides[side])}</span>
    <b>${seat?.bot ? '🤖 ' : ''}${esc(seat?.name ?? 'Place libre')}</b>${seat && !seat.bot ? `<span class="dot ${p?.connected ? 'on' : 'off'}"></span>` : ''}
    ${seat?.name === v.me ? '<small>(toi)</small>' : ''}${caps}${active && v.phase === 'playing' && seat?.name !== v.me ? '<span class="thinking">réfléchit…</span>' : ''}</div>
    ${t === null ? '' : `<span class="clock${active ? ' run' : ''}${t < 30000 ? ' low' : ''}" data-clock="${side}">${clock(t)}</span>`}`;
}
function renderBars(v) {
  const bottom = bottomSide();
  $('#barTop').innerHTML = barHTML(v, 1 - bottom);
  $('#barBottom').innerHTML = barHTML(v, bottom);
  $('#playBrand').textContent = `Strategy Club · ${INFO[v.settings.game].title}${v.settings.game === 'go' ? ` ${v.state.n} × ${v.state.n}` : ''} · ${timeLabel(v.settings.time)}`;
  $('#watchCount').textContent = `👁 ${v.spectators.length}`;
  $('#watchBadge').hidden = !v.spectator;
}
setInterval(() => {
  if (!view || view.phase !== 'playing' || !view.settings.time) return;
  for (const el of $$('[data-clock]')) {
    const t = remaining(view, +el.dataset.clock);
    el.textContent = clock(t);
    el.classList.toggle('low', t < 30000);
  }
}, 250);

function renderHands(v) {
  const shogi = v.settings.game === 'shogi';
  $('#handTop').hidden = $('#handBottom').hidden = !shogi;
  if (!shogi) return;
  const bottom = bottomSide();
  for (const [el, side] of [['#handTop', 1 - bottom], ['#handBottom', bottom]]) {
    const hand = v.state.hands[side], mine = canPlay() && side === v.state.turn;
    const items = G.shogi.HAND.filter(t => hand[t]).map(t => `<button class="hp${sel.drop === t ? ' sel' : ''}${side !== bottom ? ' up' : ''}" data-drop="${t}" ${mine ? '' : 'disabled'}>
      <span>${kanji(t, side)}</span>${hand[t] > 1 ? `<b>${hand[t]}</b>` : ''}</button>`).join('');
    $(el).innerHTML = `<small>Réserve</small>${items || '<i>vide</i>'}`;
  }
}
document.addEventListener('click', e => {
  const b = e.target.closest('[data-drop]');
  if (!b || !canPlay()) return;
  sel = sel.drop === b.dataset.drop ? {} : { drop: b.dataset.drop };
  drawGame();
});

function renderStatus(v) {
  const g = game(), turn = v.state.turn, seat = v.seats[turn];
  let line;
  if (v.phase === 'over') line = v.result.winner === null ? `🤝 Partie nulle — ${v.result.reason}` : `🏆 ${esc(v.seats[v.result.winner]?.name)} gagne — ${esc(v.result.reason)}`;
  else if (v.phase === 'scoring') line = '⚖️ Deux passes : marquez les pierres mortes, puis acceptez le compte.';
  else if (canPlay()) line = `<b>À toi de jouer</b> (${esc(g.sides[turn])})${g.inCheck?.(v.state) ? ' — <span class="hot">échec !</span>' : ''}`;
  else line = `Au tour de <b>${esc(seat?.name)}</b> (${esc(g.sides[turn])})${g.inCheck?.(v.state) ? ' — <span class="hot">échec !</span>' : ''}`;
  $('#turnLine').innerHTML = line;
  const seated = v.mySide >= 0, live = ['playing', 'scoring'].includes(v.phase);
  $('#playActions').innerHTML = [
    v.settings.game === 'go' && canPlay() ? '<button class="ghost" data-pass>Passer</button>' : '',
    seated && live ? '<button class="ghost danger" data-resign>🏳 Abandonner</button>' : '',
    v.phase === 'over' ? '<button class="primary" data-showresult>Résultat</button><button class="ghost" data-tolobby>Retour au salon</button>' : '',
  ].join('');
}
$('#playActions').onclick = e => {
  if (e.target.closest('[data-pass]') && confirm('Passer ton tour ? Deux passes de suite terminent la partie.')) act('move', 'pass', view.history.length);
  if (e.target.closest('[data-resign]') && confirm('Abandonner la partie ?')) act('resign');
  if (e.target.closest('[data-tolobby]')) act('toLobby');
  if (e.target.closest('[data-showresult]')) { $('#overlay').dataset.closed = ''; $('#overlay').dataset.round = ''; renderOver(view); }
};

function movesHTML(v) {
  const h = v.history;
  if (!h.length) return '<li class="empty">Aucun coup pour l’instant.</li>';
  const out = [];
  for (let i = 0; i < h.length; i += 2) out.push(`<li><span class="n">${i / 2 + 1}.</span><span class="s${h[i].side}">${esc(h[i].san)}</span><span class="s${h[i + 1]?.side ?? ''}">${esc(h[i + 1]?.san ?? '')}</span></li>`);
  return out.join('');
}
function renderMoves(v) {
  const ol = $('#moves');
  ol.innerHTML = movesHTML(v);
  ol.scrollTop = ol.scrollHeight;
}

// Go : marquage des pierres mortes et accord sur le compte.
function renderScoring(v) {
  const box = $('#scoring');
  box.hidden = v.phase !== 'scoring';
  if (box.hidden) return;
  const [b, w] = v.score.total, accepted = v.accepts.includes(v.me);
  box.innerHTML = `<p><b>Compte provisoire</b> (${RULES[v.score.rules]}) : Noirs <b>${b}</b> · Blancs <b>${w}</b> <small>(komi compris)</small></p>
    <p class="hint">Touche un groupe pour le déclarer mort (ou vivant). Les deux joueurs doivent accepter le même compte.</p>
    ${v.mySide >= 0 ? `<div class="row"><button class="primary" data-accept ${accepted ? 'disabled' : ''}>${accepted ? '✓ Accepté, en attente…' : 'Accepter le compte'}</button><button class="ghost" data-resume>Reprendre la partie</button></div>` : ''}`;
}
$('#scoring').onclick = e => {
  if (e.target.closest('[data-accept]')) act('acceptScore');
  if (e.target.closest('[data-resume]')) act('resumePlay');
};

/* ---------- Fin de partie ---------- */
function renderOver(v) {
  const o = $('#overlay');
  if (v.phase !== 'over') { o.hidden = true; return; }
  const same = o.dataset.round === String(v.round) && o.dataset.rm === v.rematch.join();
  if (same && (!o.hidden || o.dataset.closed === String(v.round))) return; // déjà affiché, ou fermé pour voir le plateau
  o.dataset.round = v.round;
  o.dataset.rm = v.rematch.join();
  const r = v.result, g = game(), win = r.winner !== null ? v.seats[r.winner] : null, lose = r.winner !== null ? v.seats[1 - r.winner] : null;
  const mine = v.mySide >= 0, won = mine && r.winner === v.mySide, bot = v.seats.find(s => s?.bot), host = v.me === v.host;
  const mins = Math.round(((v.endedAt || Date.now()) - v.startedAt) / 1000);
  const asked = v.rematch.includes(v.me), other = v.rematch.find(n => n !== v.me);
  o.hidden = false;
  o.innerHTML = `<div class="modal">
    <p class="kicker">${INFO[v.settings.game].title}${bot ? ` · contre le robot ${levelName(bot.bot)}` : ''}</p>
    <h2>${r.winner === null ? 'Partie nulle' : mine ? (won ? 'Victoire !' : 'Défaite') : `Victoire de ${esc(win?.name)}`}</h2>
    <p class="reason">${esc(r.reason)}</p>
    <dl class="facts">
      <div><dt>Vainqueur</dt><dd>${win ? `${esc(win.name)} <small>(${esc(g.sides[r.winner])})</small>` : '—'}</dd></div>
      <div><dt>Perdant</dt><dd>${lose ? `${esc(lose.name)} <small>(${esc(g.sides[1 - r.winner])})</small>` : '—'}</dd></div>
      <div><dt>Durée</dt><dd>${Math.floor(mins / 60)} min ${String(mins % 60).padStart(2, '0')} s</dd></div>
      <div><dt>Coups joués</dt><dd>${v.history.length}</dd></div>
      ${bot ? `<div><dt>Niveau du robot</dt><dd>${levelName(bot.bot)}</dd></div>` : ''}
    </dl>
    <details><summary>Historique de la partie</summary><ol class="moves">${movesHTML(v)}</ol></details>
    ${other && !asked ? `<p class="ask">${esc(other)} propose une revanche !</p>` : ''}
    ${mine ? `<div class="row">
      <button class="primary" data-rematch ${asked ? 'disabled' : ''}>${asked ? 'En attente de l’adversaire…' : other ? 'Accepter la revanche' : 'Revanche (camps échangés)'}</button>
      ${bot && host ? `<select data-level aria-label="Niveau du robot">${LEVELS.map(([id, t]) => `<option value="${id}"${id === bot.bot ? ' selected' : ''}>Robot ${t}</option>`).join('')}</select>` : ''}
    </div>` : '<p class="hint">Les joueurs décident de la suite…</p>'}
    <div class="row">
      <button class="ghost" data-close>Voir le plateau</button>
      ${mine ? '<button class="ghost" data-tolobby>Retour au salon</button><button class="ghost" data-switch>Changer de jeu</button>' : ''}
    </div>
  </div>`;
}
$('#overlay').addEventListener('click', e => {
  if (e.target.closest('[data-rematch]')) act('requestRematch');
  if (e.target.closest('[data-tolobby]')) act('toLobby');
  if (e.target.closest('[data-close]')) { $('#overlay').hidden = true; $('#overlay').dataset.closed = view.round; }
  if (e.target.closest('[data-switch]')) { socket.emit('leave'); reset(); }
});
$('#overlay').addEventListener('change', e => { if (e.target.matches('[data-level]')) act('setBotLevel', e.target.value); });
