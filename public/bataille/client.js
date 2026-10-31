// Interface de la Bataille navale : salons, déploiement de la flotte, poste de commandement, tirs animés, capacités, fin de partie.
/* global io */
const socket = io('/bataille');
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);
const LETTERS = 'ABCDEFGHIJ';
const coord = (r, c) => `${LETTERS[c]}${r + 1}`;
const ICON = { fire: '🎯', missiles: '🚀', radar: '📡', drone: '🛸', sonar: '🔊', jam: '📶' };
let state = null, toastTimer, shown = { round: -1, moves: -1 }, busy = false, hidden = new Set();

const store = {
  get: k => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { v === null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch { /* stockage bloqué */ } },
};
const urlCode = new URLSearchParams(location.search).get('salon')?.toUpperCase();
const wait = ms => new Promise(r => setTimeout(r, ms));
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
// Téléphone ou tablette : visée en deux temps, barre d'actions en bas, onglets entre les grilles, vibrations.
const TOUCH = matchMedia('(pointer: coarse)').matches || new URLSearchParams(location.search).has('mobile');
document.body.classList.toggle('touch', TOUCH);
const buzz = p => TOUCH && navigator.vibrate?.(p);
function tapFlash(cell) {
  cell.classList.remove('tap');
  void cell.offsetWidth; // relance l'animation
  cell.classList.add('tap');
}

function show(id) {
  for (const s of document.querySelectorAll('.screen')) s.hidden = s.id !== id;
}
function toast(text, ok = false) {
  const t = $('#toast');
  t.textContent = text;
  t.className = ok ? 'ok' : '';
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.hidden = true), 2600);
}
function act(button, ...args) {
  if (button) button.disabled = true;
  socket.emit('act', ...args, res => {
    if (button) button.disabled = false;
    if (res?.error) toast(res.error);
  });
}

/* ---------- Sons (synthétisés, discrets) ---------- */
let ac, muted = store.get('bn-muted') === '1';
document.addEventListener('pointerdown', () => { ac ??= new (window.AudioContext || window.webkitAudioContext)(); ac.resume(); });
function noise(dur, { vol = 0.2, freq = 800, q = 1, type = 'lowpass', delay = 0, slide } = {}) {
  if (muted || !ac) return;
  const t = ac.currentTime + delay, buf = ac.createBuffer(1, ac.sampleRate * dur, ac.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
  const src = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
  src.buffer = buf;
  f.type = type;
  f.frequency.setValueAtTime(freq, t);
  if (slide) f.frequency.exponentialRampToValueAtTime(slide, t + dur);
  f.Q.value = q;
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(f).connect(g).connect(ac.destination);
  src.start(t);
}
function tone(freq, dur, type = 'sine', vol = 0.06, delay = 0, slide = 0) {
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
const sfx = {
  launch: () => noise(0.6, { vol: 0.08, freq: 3000, slide: 400, type: 'bandpass', q: 2 }),
  boom: () => { noise(0.7, { vol: 0.35, freq: 900, slide: 80 }); tone(70, 0.5, 'sine', 0.12, 0, 35); },
  splash: () => noise(0.45, { vol: 0.12, freq: 2200, slide: 600, type: 'highpass' }),
  sunk: () => { noise(1.4, { vol: 0.4, freq: 600, slide: 50 }); tone(55, 1.2, 'sawtooth', 0.05, 0.1, 30); },
  ping: (ok) => { tone(1320, 0.18, 'sine', 0.06); if (ok) tone(1760, 0.3, 'sine', 0.06, 0.2); },
  jam: () => noise(0.8, { vol: 0.1, freq: 4000, type: 'bandpass', q: 0.5 }),
  click: () => tone(900, 0.04, 'square', 0.02),
};
const renderMute = () => ($('#muteBtn').textContent = muted ? '🔇 Son coupé' : '🔊 Son');
$('#muteBtn').onclick = () => { muted = !muted; store.set('bn-muted', muted ? '1' : '0'); renderMute(); };
renderMute();

/* ---------- Pseudo, accueil, salons ---------- */
let pseudo = store.get('bn-pseudo') || store.get('p4-pseudo') || store.get('imp-pseudo') || '';
function entry() {
  $('#meName').textContent = pseudo;
  $('#nameForm').pseudo.value = pseudo;
  show(pseudo ? 'home' : 'name');
}
$('#nameForm').onsubmit = e => {
  e.preventDefault();
  pseudo = e.target.pseudo.value.trim().slice(0, 20);
  if (!pseudo) return;
  store.set('bn-pseudo', pseudo);
  entry();
};
$('#changeName').onclick = e => { e.preventDefault(); show('name'); $('#nameForm').pseudo.focus(); };
function reset() {
  store.set('bn-session', null);
  state = null;
  shown = { round: -1, moves: -1 };
  $('#overlay').hidden = true;
  history.replaceState(null, '', location.pathname);
  keepAwake(false);
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
    const live = state && !state.spectator && ['setup', 'battle'].includes(state.phase);
    if (live && !confirm('Quitter la bataille ? Elle s’arrêtera pour ton adversaire.')) return;
    socket.emit('leave');
    reset();
  }
  const b = e.target.closest('[data-room]');
  if (b) enter('join', { code: b.dataset.room, name: pseudo, watch: b.dataset.mode === 'watch' }, b);
});
socket.on('session', s => { store.set('bn-session', JSON.stringify(s)); history.replaceState(null, '', `?salon=${s.code}`); });
entry();
socket.on('connect', () => {
  let s = null;
  try { s = JSON.parse(store.get('bn-session')); } catch { /* session illisible */ }
  if (s && (!urlCode || urlCode === s.code)) {
    socket.emit('resume', s, res => {
      if (!res?.error) return;
      store.set('bn-session', null);
      toast(res.error);
      entry();
    });
  } else if (urlCode) $('#joinForm').code.value = urlCode;
});
const PHASE = { lobby: 'Dans le salon', setup: 'Déploiement des flottes', battle: 'Bataille en cours', over: 'Bataille terminée' };
socket.on('rooms', list => {
  $('#rooms').innerHTML = list.length ? list.map(r => `<li><div><b>${r.players.map(esc).join(' <span>vs</span> ')}</b><small>${r.phase === 'lobby' && r.players.length < 2 ? 'Attend un adversaire' : PHASE[r.phase]}${r.spectators ? ` · 👁 ${r.spectators}` : ''}</small></div>
    ${r.players.length < 2 ? `<button class="primary small" data-room="${r.code}" data-mode="play">Affronter</button>` : ''}
    <button class="ghost small" data-room="${r.code}" data-mode="watch">👁 Regarder</button></li>`).join('')
    : '<li class="empty">Aucun salon public pour l’instant. Crée le tien !</li>';
});

/* ---------- Navires (dessin) ---------- */
// Silhouette vue de dessus, dessinée à l'horizontale sur size × 100 ; les navires verticaux sont tournés en CSS.
function shipSVG(id, size) {
  const L = size * 100;
  const hull = id === 'sousmarin'
    ? `<path class="hull" d="M8 50 Q8 30 40 29 L${L - 50} 29 Q${L - 4} 32 ${L - 4} 50 Q${L - 4} 68 ${L - 50} 71 L40 71 Q8 70 8 50Z"/>`
    : `<path class="hull" d="M6 50 L20 24 L${L - 40} 20 Q${L - 6} 30 ${L - 2} 50 Q${L - 6} 70 ${L - 40} 80 L20 76 Z"/>`;
  const turret = (x, dir = 1) => `<circle class="turret" cx="${x}" cy="50" r="11"/><path class="barrel" d="M${x} 46 L${x + dir * 30} 46 M${x} 54 L${x + dir * 30} 54"/>`;
  const det = {
    porteavions: `<rect class="deck" x="22" y="27" width="${L - 80}" height="46" rx="3"/><path class="runway" d="M40 50 L${L - 80} 50"/><path class="runway" d="M60 66 L${L * 0.55} 34"/>
      <rect class="tower" x="${L * 0.62}" y="12" width="56" height="18" rx="3"/>${[0.18, 0.3, 0.42].map(f => `<path class="plane" d="M${L * f} 40 l14 6 l-14 6 l4 -6z"/>`).join('')}`,
    cuirasse: `<rect class="tower" x="${L * 0.42}" y="34" width="${L * 0.18}" height="32" rx="4"/><path class="mast" d="M${L * 0.51} 50 L${L * 0.51} 28"/>${turret(L * 0.2, -1)}${turret(L * 0.32, -1)}${turret(L * 0.72)}${turret(L * 0.84)}`,
    destroyer: `<rect class="tower" x="${L * 0.38}" y="36" width="${L * 0.22}" height="28" rx="4"/><circle class="radar" cx="${L * 0.49}" cy="50" r="7"/>${turret(L * 0.22, -1)}${turret(L * 0.8)}`,
    sousmarin: `<rect class="tower" x="${L * 0.52}" y="40" width="56" height="20" rx="10"/><path class="mast" d="M${L * 0.58} 50 L${L * 0.58 + 26} 50"/><path class="runway" d="M30 50 L${L * 0.48} 50"/>`,
    patrouilleur: `<rect class="tower" x="${L * 0.4}" y="36" width="${L * 0.26}" height="28" rx="5"/>${turret(L * 0.78)}`,
  }[id];
  return `<svg viewBox="0 0 ${L} 100" preserveAspectRatio="none">${hull}${det}</svg>`;
}

/* ---------- Grilles ---------- */
// Une grille = en-têtes A… / 1… + cases + calques (navires, impacts, scans, visée).
function mountBoard(wrap, n, owner) {
  if (wrap.dataset.n === String(n) && wrap.dataset.owner === owner) return wrap.querySelector('.board');
  wrap.dataset.n = n;
  wrap.dataset.owner = owner;
  wrap.innerHTML = `<div class="frame" style="--n:${n}">
    <span class="corner"></span>
    <div class="cols">${Array.from({ length: n }, (_, i) => `<span>${LETTERS[i]}</span>`).join('')}</div>
    <div class="rows">${Array.from({ length: n }, (_, i) => `<span>${i + 1}</span>`).join('')}</div>
    <div class="board" data-owner="${esc(owner)}">
      <div class="sweep"></div>
      ${Array.from({ length: n * n }, (_, i) => `<div class="cell" data-r="${Math.floor(i / n)}" data-c="${i % n}"></div>`).join('')}
      <div class="layer ships"></div><div class="layer scans"></div><div class="layer marks"></div><div class="layer aim"></div>
    </div></div>`;
  return wrap.querySelector('.board');
}
const box = (r, c, h, w, n) => `left:${(c * 100) / n}%;top:${(r * 100) / n}%;width:${(w * 100) / n}%;height:${(h * 100) / n}%`;
function shipsHTML(ships, n, extra = '') {
  return ships.map(s => {
    const size = state.ships[s.id].size, v = s.dir === 'v';
    return `<div class="ship ${v ? 'v' : 'h'}${s.sunk ? ' sunk' : s.spotted ? ' spotted' : ''} ${extra}" data-ship="${s.id}" style="${box(s.r, s.c, v ? size : 1, v ? 1 : size, n)};--L:${size}">${shipSVG(s.id, size)}</div>`;
  }).join('');
}
function marksHTML(marks, n) {
  return marks.map(([r, c, m]) => `<div class="mark ${m}" style="${box(r, c, 1, 1, n)}"><i></i></div>`).join('');
}
// Zones scannées par « by » : radar et sonar (zone), drone (case).
function scansHTML(by, n) {
  return state.history.filter(e => e.by === by && e.cells && ['radar', 'sonar', 'drone'].includes(e.kind) && !hidden.has(`scan${e.n}`)).map(e => {
    const rs = e.cells.map(x => x[0]), cs = e.cells.map(x => x[1]), r = Math.min(...rs), c = Math.min(...cs);
    return `<div class="scan ${e.kind} ${e.found ? 'found' : 'none'}" style="${box(r, c, Math.max(...rs) - r + 1, Math.max(...cs) - c + 1, n)}"><b>${ICON[e.kind]} ${e.kind === 'sonar' ? (e.found ? 'SOUS-MARIN' : 'RIEN') : e.found ? 'CONTACT' : 'RIEN'}</b></div>`;
  }).join('');
}

/* ---------- Dans un salon ---------- */
let wasMine = false;
const TITLE = document.title;
socket.on('state', s => {
  const prev = state;
  state = s;
  keepAwake(['setup', 'battle'].includes(s.phase));
  const mine = s.phase === 'battle' && s.turn === s.me && !s.spectator;
  if (mine && !wasMine && TOUCH) {
    buzz([60, 40, 60]);
    if (document.hidden) document.title = '🎯 À toi ! · Bataille navale';
  }
  wasMine = mine;
  if (s.phase === 'lobby') return renderLobby(s);
  // Le spectateur suit le déploiement directement sur les deux grilles de bataille.
  if (s.phase === 'setup') return s.spectator ? renderBattle(s) : renderSetup(s, prev);
  // Une nouvelle action pendant qu'on regarde : on l'anime avant d'afficher son résultat.
  const fresh = s.round === shown.round && s.moves === shown.moves + 1 && s.history.length;
  if (fresh && !busy) return play(s.history.at(-1), prev);
  if (!busy) renderBattle(s);
});

$('#copyLink').onclick = () => navigator.clipboard.writeText(`${location.origin}${location.pathname}?salon=${state.code}`)
  .then(() => toast('Lien copié : envoie-le à ton adversaire !', true), () => toast('Copie impossible'));
$('#startBtn').onclick = e => act(e.target, 'start');
const dot = p => `<span class="dot ${p.connected ? 'on' : 'off'}"></span>`;

function renderLobby(s) {
  show('wait');
  shown = { round: -1, moves: -1 };
  $('#overlay').hidden = true;
  $('#waitCode').textContent = s.code;
  $('#waitPrivacy').textContent = s.private ? '🔒 Salon privé : partage le code pour inviter' : '🌍 Salon public : visible dans la liste';
  $('#notice').hidden = !s.notice;
  $('#notice').textContent = s.notice ?? '';
  $('#waitPlayers').innerHTML = [...s.players, null].slice(0, 2).map(p => p
    ? `<li>${dot(p)}<b>${esc(p.name)}</b>${p.name === s.host ? '<small>hôte</small>' : ''}${p.name === s.me ? '<small>toi</small>' : ''}<span>${p.connected ? 'connecté' : 'déconnecté'}</span></li>`
    : '<li class="empty"><span class="dot wait"></span>En attente d’un adversaire…</li>').join('');
  $('#waitWatchers').hidden = !s.spectators.length;
  $('#waitWatchers').textContent = `👁 Spectateurs : ${s.spectators.join(', ')}`;
  const host = s.me === s.host, ready = s.players.length === 2 && s.players.every(p => p.connected), b = $('#startBtn');
  b.hidden = s.spectator;
  b.disabled = !(ready && host);
  b.textContent = !host ? `${s.host} va lancer la bataille…` : ready ? 'Lancer la bataille' : 'En attente du 2ᵉ joueur…';
  $('#modeWho').textContent = host ? 'Tu es l’hôte : choisis le mode.' : `Mode choisi par ${s.host}.`;
  $('#modes').innerHTML = Object.entries(s.modes).map(([id, m]) => `<button class="mode${id === s.mode ? ' on' : ''}" data-setmode="${id}" ${host ? '' : 'disabled'}>
    <b>${esc(m.name)}</b><small>${m.size} × ${m.size} · ${m.fleet.length} navires${m.abilities ? ' · capacités' : ''}</small><span>${esc(m.desc)}</span></button>`).join('');
  $('#abilityList').innerHTML = s.rules.abilities ? `<h3>Capacités du mode Moderne</h3><ul class="ab-list">${Object.entries(s.abilities).map(([k, a]) =>
    `<li><span>${ICON[k]}</span><div><b>${esc(a.name)}</b> <small>×${a.charges} · dès ton ${a.from}ᵉ tour</small><p>${esc(a.desc)}</p></div></li>`).join('')}</ul><p class="hint">Utiliser une capacité remplace ton tir du tour.</p>` : '';
}
$('#modes').onclick = e => { const b = e.target.closest('[data-setmode]'); if (b) act(null, 'setMode', b.dataset.setmode); };

/* ---------- Déploiement ---------- */
let placed = {}, selected = null, dir = 'h', setupRound = -1;
let pending = null; // mobile : navire montré en fantôme, posé au 2e toucher
const fleetIds = () => state.rules.fleet;
const cellsOf = (id, p) => Array.from({ length: state.ships[id].size }, (_, i) => (p.dir === 'v' ? [p.r + i, p.c] : [p.r, p.c + i]));
function fits(id, p, others = placed) {
  const n = state.rules.size, taken = new Set(Object.entries(others).filter(([k]) => k !== id).flatMap(([k, q]) => cellsOf(k, q).map(x => x.join())));
  return cellsOf(id, p).every(([r, c]) => r >= 0 && c >= 0 && r < n && c < n && !taken.has(`${r},${c}`));
}
function randomFleet() {
  const out = {}, n = state.rules.size;
  for (const id of [...fleetIds()].sort((a, b) => state.ships[b].size - state.ships[a].size)) {
    for (let k = 0; k < 500; k++) {
      const d = Math.random() < 0.5 ? 'h' : 'v', p = { r: Math.floor(Math.random() * n), c: Math.floor(Math.random() * n), dir: d };
      if (fits(id, p, out)) { out[id] = p; break; }
    }
  }
  return Object.keys(out).length === fleetIds().length ? out : randomFleet();
}

let sentDraft = null;
function renderSetup(s) {
  show('setup');
  $('#overlay').hidden = true;
  shown = { round: s.round, moves: 0 };
  if (setupRound !== s.round) { placed = {}; selected = fleetIds()[0]; dir = 'h'; setupRound = s.round; pending = null; }
  if (!selected) pending = null;
  const n = s.rules.size, mine = s.boards[s.me], foe = s.players.find(p => p.name !== s.me);
  $('#setupBrand').textContent = `Mode ${s.rules.name} · Grille ${n} × ${n}`;
  const done = mine?.ready;
  const draft = JSON.stringify(Object.entries(placed).map(([id, p]) => ({ id, ...p })));
  if (!done && draft !== sentDraft) { sentDraft = draft; act(null, 'draft', JSON.parse(draft)); } // les spectateurs suivent le placement en direct
  for (const b of document.querySelectorAll('#setup .tools, #readyBtn')) b.hidden = done;
  const board = mountBoard($('#setupBoard'), n, `setup-${s.round}`);
  const ships = done ? mine.ships : Object.entries(placed).map(([id, p]) => ({ id, ...p }));
  board.querySelector('.ships').innerHTML = shipsHTML(ships, n, done ? '' : 'movable');
  board.classList.toggle('placing', !done && !!selected);
  $('#dock').innerHTML = fleetIds().map(id => `<li><button class="dock-ship${selected === id ? ' on' : ''}${placed[id] ? ' placed' : ''}" data-pick="${id}" ${done ? 'disabled' : ''}>
    <span class="pips">${'<i></i>'.repeat(s.ships[id].size)}</span><b>${esc(s.ships[id].name)}</b><small>${placed[id] || done ? '✓ en place' : `${s.ships[id].size} cases`}</small></button></li>`).join('');
  const all = Object.keys(placed).length === fleetIds().length;
  $('#readyBtn').disabled = !all;
  const foeReady = foe && s.boards[foe.name]?.ready;
  $('#setupStatus').innerHTML = done ? `✓ Flotte validée. ${foeReady ? 'Le combat commence…' : `En attente de <b>${esc(foe?.name)}</b>…`}`
    : `${foe ? `${esc(foe.name)} : ${foeReady ? '<b class="ok">flotte prête</b>' : 'déploiement en cours…'}` : ''}`;
  renderSetupBar(done, all);
}
// Mobile : barre fixe en bas avec le navire en cours, Pivoter, Poser, puis Valider.
function renderSetupBar(done, all) {
  if (!TOUCH) return;
  const ship = selected && state.ships[selected], ok = pending && fits(selected, pending);
  $('#setupBar').innerHTML = done ? ''
    : ship ? `<span class="what"><b>${esc(ship.name)}</b><small>${pending ? (ok ? 'touche encore pour poser' : 'pas de place ici') : 'touche la grille'}</small></span>
      <button class="ghost" data-sb="rotate">⟳ Pivoter</button><button class="primary" data-sb="place" ${ok ? '' : 'disabled'}>✓ Poser</button>`
    : all ? '<button class="primary" data-sb="ready">✓ Valider ma flotte</button>' : '';
}
$('#setupBar').onclick = e => {
  const k = e.target.closest('[data-sb]')?.dataset.sb;
  if (k === 'rotate') rotate();
  if (k === 'place' && pending) placeShip(pending);
  if (k === 'ready') $('#readyBtn').click();
};
function placeShip(p) {
  if (!fits(selected, p)) return toast('Pas de place ici : les navires ne peuvent pas se chevaucher');
  placed[selected] = p;
  sfx.click();
  buzz(15);
  pending = null;
  selected = fleetIds().find(id => !placed[id]) ?? null;
  $('#setupBoard .aim').innerHTML = '';
  renderSetup(state);
}
function aimSetup(r, c) {
  const board = $('#setupBoard .board');
  if (!board || !selected || state.boards[state.me]?.ready) return;
  const size = state.ships[selected].size, n = state.rules.size;
  const p = { r: dir === 'v' ? Math.min(r, n - size) : r, c: dir === 'h' ? Math.min(c, n - size) : c, dir };
  board.querySelector('.aim').innerHTML = `<div class="ghost-ship ${fits(selected, p) ? 'ok' : 'bad'}" style="${box(p.r, p.c, dir === 'v' ? size : 1, dir === 'h' ? size : 1, n)}"></div>`;
  return p;
}
$('#setupBoard').addEventListener('pointermove', e => {
  const cell = document.elementsFromPoint(e.clientX, e.clientY).find(el => el.classList?.contains('cell'));
  if (cell && e.pointerType === 'mouse') aimSetup(+cell.dataset.r, +cell.dataset.c);
});
$('#setupBoard').addEventListener('pointerleave', () => { const a = $('#setupBoard .aim'); if (a && !pending) a.innerHTML = ''; });
$('#setupBoard').addEventListener('click', e => {
  if (!state || state.boards[state.me]?.ready) return;
  const ship = e.target.closest('.ship'), under = document.elementsFromPoint(e.clientX, e.clientY).find(el => el.classList?.contains('cell'));
  if (ship && (!selected || !fits(selected, aimSetup(+under.dataset.r, +under.dataset.c)))) { // reprendre un navire posé pour le déplacer
    selected = ship.dataset.ship;
    dir = placed[selected].dir;
    delete placed[selected];
    pending = null;
    $('#setupBoard .aim').innerHTML = '';
    sfx.click();
    return renderSetup(state);
  }
  const cell = under;
  if (!cell || !selected) return;
  const p = aimSetup(+cell.dataset.r, +cell.dataset.c);
  // Mobile : le 1er toucher montre le navire, le 2e au même endroit le pose.
  if (TOUCH && (pending?.r !== p.r || pending?.c !== p.c || pending?.dir !== p.dir)) {
    pending = p;
    tapFlash(cell);
    return renderSetup(state);
  }
  placeShip(p);
});
$('#dock').onclick = e => {
  const b = e.target.closest('[data-pick]');
  if (!b) return;
  selected = b.dataset.pick;
  if (placed[selected]) { dir = placed[selected].dir; delete placed[selected]; }
  pending = null;
  $('#setupBoard .aim').innerHTML = '';
  renderSetup(state);
};
function rotate() {
  if (state?.phase !== 'setup') return;
  dir = dir === 'h' ? 'v' : 'h';
  armDir = armDir === 'h' ? 'v' : 'h';
  if (pending) pending = aimSetup(pending.r, pending.c);
  renderSetup(state);
}
$('#rotateBtn').onclick = rotate;
document.addEventListener('keydown', e => {
  if (e.key.toLowerCase() !== 'r' || e.target.matches('input')) return;
  if (state?.phase === 'setup') rotate();
  if (state?.phase === 'battle') { armDir = armDir === 'h' ? 'v' : 'h'; renderArmed(); }
});
const dropPending = () => { pending = null; $('#setupBoard .aim').innerHTML = ''; };
$('#randomBtn').onclick = () => { placed = randomFleet(); selected = null; dropPending(); sfx.click(); renderSetup(state); };
$('#clearBtn').onclick = () => { placed = {}; selected = fleetIds()[0]; dropPending(); renderSetup(state); };
$('#readyBtn').onclick = e => act(e.target, 'placeFleet', Object.entries(placed).map(([id, p]) => ({ id, ...p })));

/* ---------- Bataille ---------- */
let armed = 'fire', armDir = 'h';
let aimed = null; // mobile : case visée, en attente de confirmation
const foeOf = (s, name) => s.players.find(p => p.name !== name)?.name;
// Pour un joueur : en grand la zone ennemie (où il tire), en petit sa flotte. Pour un spectateur : les deux flottes.
const layout = s => (s.spectator ? [s.players[1]?.name, s.players[0]?.name] : [foeOf(s, s.me), s.me]);

function renderBattle(s) {
  show('battle');
  busy = false;
  shown = { round: s.round, moves: s.moves };
  const [a, b] = layout(s), n = s.rules.size, me = s.boards[s.me];
  $('#battleBrand').textContent = `Mode ${s.rules.name} · Bataille ${s.round}`;
  document.body.classList.toggle('spectating', s.spectator);
  for (const [zone, owner] of [['A', a], ['B', b]]) {
    const bd = s.boards[owner], board = mountBoard($(`#board${zone}`), n, owner);
    board.querySelector('.ships').innerHTML = shipsHTML(bd.ships, n);
    board.querySelector('.marks').innerHTML = marksHTML(bd.marks, n);
    board.querySelector('.scans').innerHTML = scansHTML(foeOf(s, owner), n);
    const sunk = bd.fleet.filter(x => x.sunk).length;
    $(`#count${zone}`).textContent = s.phase === 'setup' ? (bd.ready ? '✓ flotte prête' : 'déploiement…') : `${sunk} / ${bd.fleet.length} coulés`;
    $(`#title${zone}`).innerHTML = s.spectator ? `Flotte de ${esc(owner)}` : owner === s.me ? 'Ta flotte' : `Zone ennemie · ${esc(owner)}`;
  }
  if (TOUCH) for (const z of ['A', 'B']) $(`#tab${z}`).innerHTML = `${$(`#title${z}`).innerHTML}<small>${$(`#count${z}`).textContent}</small>`;
  const myTurn = s.phase === 'battle' && s.turn === s.me;
  if (!myTurn) aimed = null;
  if (!aimed && TOUCH) $('#boardA .aim').innerHTML = '';
  $('#boardA .board').classList.toggle('target', myTurn);
  $('#zoneA').classList.toggle('live', myTurn);
  const thinking = '<span class="dots"></span>';
  $('#banner').className = `banner ${myTurn ? 'mine' : ''}`;
  $('#banner').innerHTML = s.phase === 'setup' ? '⚓ Les commandants déploient leur flotte…'
    : s.phase === 'over' ? `🏁 Bataille terminée : victoire de <b>${esc(s.winner)}</b>`
    : s.spectator ? `🎯 <b>${esc(s.turn)}</b> vise${thinking}`
    : myTurn ? (me.jammed && s.rules.abilities ? '🎯 À toi de tirer, commandant ! <small>📶 capteurs brouillés</small>' : '🎯 À toi de tirer, commandant !')
    : `⏳ <b>${esc(s.turn)}</b> réfléchit${thinking}`;
  renderAbilities(s);
  renderFleets(s);
  renderHistory(s);
  renderArmed();
  renderOver(s);
}

function renderAbilities(s) {
  const me = s.boards[s.me];
  $('#abilityPanel').hidden = s.spectator || !s.rules.abilities;
  if ($('#abilityPanel').hidden) return;
  if (armed !== 'fire' && !canUse(s, armed)) armed = 'fire';
  $('#abilities').innerHTML = `<button class="ab${armed === 'fire' ? ' on' : ''}" data-arm="fire"><span>🎯</span><b>Tir simple</b><small>Illimité</small></button>`
    + Object.entries(s.abilities).map(([k, a]) => {
      const left = me.charges[k], wait = a.from - me.actions, jam = me.jammed && ['radar', 'drone', 'sonar'].includes(k);
      const why = !left ? 'Épuisé' : wait > 0 ? `Dans ${wait} tour${wait > 1 ? 's' : ''}` : jam ? 'Brouillé' : `${left} restant${left > 1 ? 's' : ''}`;
      return `<button class="ab${armed === k ? ' on' : ''}" data-arm="${k}" ${canUse(s, k) ? '' : 'disabled'} title="${esc(a.desc)}"><span>${ICON[k]}</span><b>${esc(a.name)}</b><small>${why}</small></button>`;
    }).join('');
}
function canUse(s, k) {
  const me = s.boards[s.me], a = s.abilities[k];
  return !!a && me.charges[k] > 0 && me.actions >= a.from && !(me.jammed && ['radar', 'drone', 'sonar'].includes(k));
}
$('#abilities').onclick = e => {
  const b = e.target.closest('[data-arm]');
  if (!b) return;
  sfx.click();
  if (b.dataset.arm === 'jam' && !TOUCH) {
    if (state.turn !== state.me) return toast('Attends ton tour');
    if (confirm('Brouiller les capteurs ennemis pendant ses 2 prochains tours ? Cela remplace ton tir.')) act(null, 'ability', 'jam', {}, state.moves);
    return;
  }
  armed = b.dataset.arm;
  if (TOUCH) $('#boardA .aim').innerHTML = '';
  if (aimed && armed !== 'jam') drawAim(aimed.r, aimed.c);
  renderAbilities(state);
  renderArmed();
};
function renderArmed() {
  if (!state || state.spectator || state.phase !== 'battle') return void ($('#armed').innerHTML = '');
  const a = state.abilities[armed];
  if (TOUCH) return renderArmedTouch(a);
  $('#armed').innerHTML = armed === 'fire' ? '🎯 Touche une case de la zone ennemie pour tirer.'
    : `${ICON[armed]} <b>${esc(a.name)}</b> : ${esc(a.desc)} ${armed === 'missiles' ? `<button class="ghost small" id="armRotate">⟳ ${armDir === 'h' ? 'Horizontal' : 'Vertical'}</button>` : ''}<button class="ghost small" id="armCancel">Annuler</button>`;
}
// Mobile : la barre du bas dit ce qui est visé et porte le bouton qui confirme.
function renderArmedTouch(a) {
  const rot = armed === 'missiles' ? `<button class="ghost small" id="armRotate">⟳ ${armDir === 'h' ? 'Horiz.' : 'Vert.'}</button>` : '';
  const cancel = armed !== 'fire' ? '<button class="ghost small" id="armCancel" aria-label="Revenir au tir simple">✕</button>' : '';
  const label = armed === 'fire' ? '🎯 Tir' : `${ICON[armed]} <b>${esc(a.name)}</b>`;
  $('#armed').innerHTML = state.turn !== state.me ? '⏳ Attends ton tour…'
    : armed === 'jam' ? `<span class="what">${label} : brouille ses capteurs 2 tours</span><button class="primary" id="armJam">Brouiller</button>${cancel}`
    : aimed ? `<span class="what">${label} en <b>${coord(aimed.r, aimed.c)}</b></span>${rot}<button class="primary" id="armGo">${armed === 'fire' ? '🎯 Tirer' : 'Lancer'}</button>${cancel}`
    : `<span class="what">${label} : touche une case pour viser</span>${rot}${cancel}`;
}
$('#armed').onclick = e => {
  const id = e.target.closest('button')?.id;
  if (id === 'armRotate') { armDir = armDir === 'h' ? 'v' : 'h'; if (aimed) drawAim(aimed.r, aimed.c); renderArmed(); }
  if (id === 'armCancel') { armed = 'fire'; if (aimed) drawAim(aimed.r, aimed.c); renderAbilities(state); renderArmed(); }
  if (id === 'armGo' && aimed) fireAt(aimed.r, aimed.c);
  if (id === 'armJam') { armed = 'fire'; act(null, 'ability', 'jam', {}, state.moves); renderAbilities(state); renderArmed(); }
};
// Cases visées selon l'arme choisie (aperçu au survol).
function targetCells(r, c) {
  const n = state.rules.size, inb = ([i, j]) => i >= 0 && j >= 0 && i < n && j < n;
  if (armed === 'radar' || armed === 'sonar') {
    const d = armed === 'radar' ? 1 : 2, out = [];
    for (let i = r - d; i <= r + d; i++) for (let j = c - d; j <= c + d; j++) out.push([i, j]);
    return out.filter(inb);
  }
  if (armed === 'missiles') return [0, 1, 2].map(k => (armDir === 'v' ? [r + k, c] : [r, c + k]));
  return [[r, c]];
}
function drawAim(r, c) {
  const n = state.rules.size, cells = targetCells(r, c), bad = cells.some(([i, j]) => i >= n || j >= n);
  $('#boardA .aim').innerHTML = cells.filter(([i, j]) => i < n && j < n).map(([i, j]) => `<div class="reticle ${armed}${bad ? ' bad' : ''}" style="${box(i, j, 1, 1, n)}"></div>`).join('')
    + `<div class="crosshair" style="--r:${r};--c:${c};--n:${n}"></div>`;
}
$('#boardA').addEventListener('pointermove', e => {
  const cell = e.target.closest('.cell'), board = $('#boardA .board');
  if (!cell || !board.classList.contains('target') || e.pointerType !== 'mouse') return;
  drawAim(+cell.dataset.r, +cell.dataset.c);
});
$('#boardA').addEventListener('pointerleave', () => { const a = $('#boardA .aim'); if (a && !aimed) a.innerHTML = ''; });
$('#boardA').addEventListener('click', e => {
  const cell = e.target.closest('.cell');
  if (!cell || !state || state.spectator || state.phase !== 'battle') return;
  if (state.turn !== state.me) return toast('Attends ton tour : l’ennemi réfléchit');
  if (busy) return;
  const r = +cell.dataset.r, c = +cell.dataset.c;
  if (armed === 'jam') return;
  if (armed === 'fire' && state.boards[layout(state)[0]].marks.some(([i, j]) => i === r && j === c)) return toast('Tu as déjà tiré sur cette case');
  // Mobile : le 1er toucher vise, le 2e sur la même case (ou le bouton Tirer) confirme.
  if (TOUCH && (aimed?.r !== r || aimed?.c !== c)) {
    aimed = { r, c };
    drawAim(r, c);
    tapFlash(cell);
    buzz(8);
    return renderArmed();
  }
  fireAt(r, c);
});
function fireAt(r, c) {
  if (armed === 'fire') act(null, 'fire', r, c, state.moves);
  else {
    act(null, 'ability', armed, { r, c, dir: armDir }, state.moves);
    armed = 'fire'; // une capacité sert une fois : on revient au tir simple
  }
  aimed = null;
  $('#boardA .aim').innerHTML = '';
  renderArmed();
}

function fleetList(s, owner) {
  const bd = s.boards[owner], mine = owner === s.me;
  return `<ul>${bd.fleet.map(f => {
    const ship = bd.ships.find(x => x.id === f.id), size = s.ships[f.id].size, dmg = ship?.hits ?? (f.sunk ? size : 0);
    return `<li class="${f.sunk ? 'sunk' : ''}"><span class="pips">${Array.from({ length: size }, (_, i) => `<i class="${i < dmg ? 'hit' : ''}"></i>`).join('')}</span><b>${esc(s.ships[f.id].name)}</b>${f.sunk ? '<small>coulé</small>' : mine && dmg ? '<small>endommagé</small>' : ''}</li>`;
  }).join('')}</ul>`;
}
function renderFleets(s) {
  const [a, b] = layout(s);
  $('#fleets').innerHTML = `<div><h3>${s.spectator ? esc(b) : 'Ta flotte'}</h3>${fleetList(s, b)}</div><div><h3>${s.spectator ? esc(a) : 'Flotte ennemie'}</h3>${fleetList(s, a)}</div>`;
}
function describe(e, s) {
  const who = e.by === s.me ? 'Tu' : esc(e.by), you = e.by === s.me;
  const res = x => (x.res === 'miss' ? 'à l’eau' : x.res === 'hit' ? '<b class="hit">touché</b>' : `<b class="sunk">coulé (${esc(s.ships[x.ship].name)})</b>`);
  if (e.kind === 'fire') return `${who} ${you ? 'tires' : 'tire'} en <b>${coord(e.results[0].r, e.results[0].c)}</b> : ${res(e.results[0])}`;
  if (e.kind === 'missiles') return `${who} ${you ? 'lances' : 'lance'} une frappe de missiles (${coord(...e.cells[0])}–${coord(...e.cells[2])}) : ${e.results.map(x => `${coord(x.r, x.c)} ${res(x)}`).join(', ')}`;
  if (e.kind === 'jam') return `${who} ${you ? 'brouilles' : 'brouille'} les capteurs adverses pour 2 tours`;
  const where = e.kind === 'drone' ? coord(...e.cells[0]) : `la zone ${coord(...e.cells[0])}–${coord(...e.cells.at(-1))}`;
  const what = { drone: e.found ? `<b class="hit">${esc(s.ships[e.ship]?.name ?? 'navire')} repéré et dévoilé</b>` : 'case vide', radar: e.found ? '<b class="hit">contact radar</b>' : 'aucun navire', sonar: e.found ? '<b class="hit">sous-marin détecté</b>' : 'pas de sous-marin' }[e.kind];
  return `${who} ${you ? 'envoies' : 'envoie'} ${e.kind === 'drone' ? 'un drone sur' : e.kind === 'radar' ? 'le radar sur' : 'le sonar sur'} ${where} : ${what}`;
}
function renderHistory(s) {
  $('#history').innerHTML = s.history.slice().reverse().map(e => `<li class="${e.by === s.me ? 'mine' : ''}"><span class="n">${e.n}</span><span>${ICON[e.kind]}</span><p>${describe(e, s)}</p></li>`).join('')
    || '<li class="empty">Aucun tir pour l’instant.</li>';
}

/* ---------- Animations ---------- */
const fx = $('#fx');
const center = el => { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width }; };
const cellEl = (owner, r, c) => document.querySelector(`.board[data-owner="${CSS.escape(owner)}"] .cell[data-r="${r}"][data-c="${c}"]`);
function burst(cls, at, ms = 1100) {
  const d = document.createElement('div');
  d.className = `burst ${cls}`;
  d.style.cssText = `left:${at.x}px;top:${at.y}px;--s:${at.w}px`;
  fx.append(d);
  setTimeout(() => d.remove(), ms);
}
// Missile : part d'un navire du tireur (ou du bord de sa zone), file en cloche jusqu'à la case.
async function missile(from, to, drone = false) {
  if (reduced) return;
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  const mx = (from.x + to.x) / 2, my = Math.min(from.y, to.y) - Math.max(80, Math.abs(from.x - to.x) * 0.35);
  svg.innerHTML = `<path class="trail${drone ? ' drone' : ''}" d="M${from.x} ${from.y} Q${mx} ${my} ${to.x} ${to.y}"/><g class="head">${drone ? '<rect x="-9" y="-3" width="18" height="6" rx="3"/><circle cx="-9" cy="-4" r="4"/><circle cx="9" cy="-4" r="4"/>' : '<circle r="4.5"/><circle class="glow" r="10"/>'}</g>`;
  fx.append(svg);
  const path = svg.querySelector('path'), head = svg.querySelector('.head'), len = path.getTotalLength(), ms = drone ? 900 : 650;
  path.style.strokeDasharray = len;
  if (!drone) sfx.launch();
  await new Promise(done => {
    const t0 = performance.now();
    const tick = now => {
      const t = Math.min(1, (now - t0) / ms), e = drone ? t : t * t * (3 - 2 * t), p = path.getPointAtLength(len * e);
      head.setAttribute('transform', `translate(${p.x} ${p.y})`);
      path.style.strokeDashoffset = len * (1 - e);
      if (t < 1) requestAnimationFrame(tick); else done();
    };
    requestAnimationFrame(tick);
  });
  svg.remove();
}
function origin(by, target) {
  // Depuis un navire encore à flot du tireur s'il est visible, sinon depuis le bord de la zone visée.
  // (sur mobile, la grille du tireur peut être cachée par les onglets : on ne garde que les navires visibles)
  const ship = [...document.querySelectorAll(`.board[data-owner="${CSS.escape(by)}"] .ship:not(.sunk)`)].filter(el => el.offsetWidth)[Math.floor(Math.random() * 3)];
  if (ship) return center(ship);
  const b = document.querySelector(`.board[data-owner="${CSS.escape(target)}"]`).getBoundingClientRect();
  return { x: b.left + b.width / 2, y: b.top - 40 };
}
function zoneRect(owner, cells) {
  const a = cellEl(owner, ...cells[0]).getBoundingClientRect(), b = cellEl(owner, ...cells.at(-1)).getBoundingClientRect();
  return { left: a.left, top: a.top, width: b.right - a.left, height: b.bottom - a.top };
}
async function play(e, prev) {
  const s = state, target = foeOf(s, e.by);
  // Pendant l'animation, la grille visée reste dans son état d'avant le tir, et la zone scannée reste cachée : pas de spoiler.
  hidden = new Set(e.results ? [] : [`scan${e.n}`]);
  const tab = layout(s)[0] === target ? 'A' : 'B';
  if (TOUCH) setTab(tab); // on montre la grille visée
  renderBattle({ ...s, phase: 'battle', turn: e.by, history: s.history.slice(0, -1), boards: { ...s.boards, [target]: prev?.boards?.[target] ?? s.boards[target] } });
  busy = true;
  try {
    if (e.kind === 'fire' || e.kind === 'missiles') {
      await Promise.all(e.results.map(async (x, i) => {
        await wait(i * 220);
        const to = center(cellEl(target, x.r, x.c));
        await missile(origin(e.by, target), to);
        if (x.res === 'miss') { burst('splash', to); sfx.splash(); } else { burst(x.res === 'sunk' ? 'boom big' : 'boom', to, 1400); (x.res === 'sunk' ? sfx.sunk : sfx.boom)(); }
        if (x.res !== 'miss' && !s.spectator) buzz(target === s.me ? (x.res === 'sunk' ? [250, 80, 350] : 160) : (x.res === 'sunk' ? [60, 40, 120] : 40));
      }));
      if (e.results.some(x => x.res === 'sunk')) {
        document.querySelector(`.board[data-owner="${CSS.escape(target)}"]`).closest('.zone').classList.add('shake');
        await wait(600);
      }
    } else if (e.kind === 'jam') {
      sfx.jam();
      document.body.classList.add('jammed');
      await wait(1100);
      document.body.classList.remove('jammed');
    } else {
      const z = zoneRect(target, e.cells);
      if (e.kind === 'drone') await missile(origin(e.by, target), center(cellEl(target, ...e.cells[0])), true);
      const d = document.createElement('div');
      d.className = `scanfx ${e.kind}`;
      d.style.cssText = `left:${z.left}px;top:${z.top}px;width:${z.width}px;height:${z.height}px`;
      fx.append(d);
      sfx.ping(false);
      await wait(1200);
      sfx.ping(e.found);
      d.remove();
    }
  } finally {
    hidden = new Set();
    document.querySelectorAll('.zone.shake').forEach(z => z.classList.remove('shake'));
    renderBattle(state);
    // Mobile : après le tir ennemi, retour sur la zone où l'on vise.
    if (TOUCH && tab === 'B' && !state.spectator) setTimeout(() => { if (!busy) setTab('A'); }, 900);
  }
}

/* ---------- Mobile : onglets, panneaux repliables, barres du bas, écran allumé ---------- */
function setTab(t) {
  document.body.dataset.tab = t;
  for (const z of ['A', 'B']) $(`#tab${z}`).setAttribute('aria-selected', z === t);
}
setTab('A');
$('#tabs').onclick = e => { const t = e.target.closest('[data-tab]')?.dataset.tab; if (t) { sfx.click(); setTab(t); } };
if (TOUCH) {
  $('#battleBar').append($('#armed'), $('#abilityPanel'));
  document.addEventListener('click', e => e.target.closest('.log h3, #fleets h3')?.closest('.panel').classList.toggle('open'));
  // La page garde de la place sous la barre fixe, quelle que soit sa hauteur.
  for (const bar of document.querySelectorAll('.touchbar')) {
    new ResizeObserver(() => (bar.closest('.screen').style.paddingBottom = `${bar.offsetHeight + 20}px`)).observe(bar);
  }
}
let lock = null;
async function keepAwake(on) {
  if (!TOUCH || !('wakeLock' in navigator)) return;
  if (on && !lock && !document.hidden) {
    lock = await navigator.wakeLock.request('screen').catch(() => null);
    lock?.addEventListener('release', () => (lock = null));
  }
  if (!on && lock) { lock.release(); lock = null; }
}
document.addEventListener('visibilitychange', () => {
  if (document.hidden) return;
  document.title = TITLE;
  keepAwake(['setup', 'battle'].includes(state?.phase));
});

/* ---------- Fin de bataille ---------- */
function renderOver(s) {
  const o = $('#overlay');
  o.hidden = s.phase !== 'over';
  if (o.hidden) return;
  const won = s.winner === s.me, foe = foeOf(s, s.me), ask = s.rematch && s.rematch !== s.me;
  const stat = p => {
    const bd = s.boards[p], foeBd = s.boards[foeOf(s, p)];
    return `<tr${p === s.winner ? ' class="win"' : ''}><th>${esc(p)}${p === s.winner ? ' 🏆' : ''}</th><td>${foeBd.fleet.filter(x => x.sunk).length} / ${foeBd.fleet.length}</td><td>${bd.shots}</td><td>${bd.hits}</td><td>${bd.shots ? Math.round((bd.hits / bd.shots) * 100) : 0} %</td></tr>`;
  };
  const n = s.rules.size;
  const mini = p => `<div class="mini"><h4>Flotte de ${esc(p)}</h4><div class="board-wrap" data-final="${esc(p)}"></div></div>`;
  o.innerHTML = `<div class="modal">
    <p class="kicker">${won ? 'Mission accomplie' : s.spectator ? 'Fin des combats' : 'Flotte détruite'}</p>
    <h2>${s.spectator ? `Victoire de ${esc(s.winner)}` : won ? 'Victoire !' : 'Défaite…'}</h2>
    <table class="stats"><thead><tr><th></th><th>Navires coulés</th><th>Tirs</th><th>Réussis</th><th>Précision</th></tr></thead><tbody>${s.players.map(p => stat(p.name)).join('')}</tbody></table>
    <div class="finals">${s.players.map(p => mini(p.name)).join('')}</div>
    <p class="hint">Score du salon : ${s.players.map(p => `${esc(p.name)} <b>${p.wins}</b>`).join(' · ')}</p>
    ${s.notice ? `<p class="notice">${esc(s.notice)}</p>` : ''}
    ${s.spectator ? '<p class="hint">Les commandants décident de la suite…</p>' : `
      ${ask ? `<p class="ask">${esc(s.rematch)} veut une revanche !</p>` : ''}
      ${s.rematch === s.me ? `<p class="hint">En attente de ${esc(foe)}…</p>` : ''}
      <div class="row">
        <button class="primary" data-rm="yes" ${s.rematch === s.me || s.players.length < 2 ? 'disabled' : ''}>${ask ? 'Accepter la revanche' : 'Rejouer (nouvelles flottes)'}</button>
        ${ask ? '<button class="ghost" data-rm="no">Refuser</button>' : ''}
        <button class="ghost" data-tolobby>Retour au salon</button>
      </div>`}
  </div>`;
  for (const p of s.players) {
    const b = mountBoard(o.querySelector(`[data-final="${CSS.escape(p.name)}"]`), n, `final-${p.name}`);
    b.querySelector('.ships').innerHTML = shipsHTML(s.boards[p.name].ships, n);
    b.querySelector('.marks').innerHTML = marksHTML(s.boards[p.name].marks, n);
  }
}
document.addEventListener('click', e => {
  const rm = e.target.closest('[data-rm]')?.dataset.rm;
  if (rm) act(e.target.closest('button'), rm === 'yes' ? 'requestRematch' : 'declineRematch');
  if (e.target.closest('[data-tolobby]')) act(e.target.closest('button'), 'toLobby');
});
