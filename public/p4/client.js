// Interface du Puissance 4 : pseudo, salons, grille animée, revanche, sons.
/* global io */
const socket = io('/p4');
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);
const COLS = 7, ROWS = 6;
const COLOR_NAME = { red: 'rubis', yellow: 'or' }; // jetons de casino : rubis (joue en premier) et or
let state = null, toastTimer, shownMoves = -1, shownRound = -1, animating = false, hoverCol = null;

const store = {
  get: k => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { v === null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch { /* stockage bloqué */ } },
};
const urlCode = new URLSearchParams(location.search).get('salon')?.toUpperCase();

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
// Envoie une action ; le bouton reste grisé jusqu'à la réponse, pour éviter les doubles envois.
function act(button, ...args) {
  sfx.click();
  if (button) button.disabled = true;
  socket.emit('act', ...args, res => {
    if (button) button.disabled = false;
    if (res?.error) toast(res.error);
  });
}

/* ---------- Sons (synthétisés, aucun fichier) ---------- */
let ac, muted = store.get('p4-muted') === '1';
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
const sfx = {
  // Jeton de casino qui claque : choc sourd puis tintement métallique.
  drop: () => { tone(180, 0.1, 'triangle', 0.14, 0, 90); tone(2600, 0.07, 'sine', 0.05, 0.01); tone(3400, 0.05, 'sine', 0.03, 0.03); },
  click: () => tone(1200, 0.04, 'sine', 0.04),
  win: () => [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.3, 'triangle', 0.09, i * 0.09)),
  draw: () => [440, 349].forEach((f, i) => tone(f, 0.35, 'sine', 0.08, i * 0.2)),
};
function renderMute() {
  $('#muteBtn').textContent = muted ? '🔇 Son coupé' : '🔊 Son';
  $('#muteBtn').setAttribute('aria-label', muted ? 'Activer le son' : 'Couper le son');
}
$('#muteBtn').onclick = () => {
  muted = !muted;
  store.set('p4-muted', muted ? '1' : '0');
  renderMute();
};
renderMute();

/* ---------- Pseudo, page principale, salons ---------- */
let pseudo = store.get('p4-pseudo') || store.get('cote-pseudo') || '';
function entry() {
  $('#meName').textContent = pseudo;
  $('#nameForm').pseudo.value = pseudo;
  show(pseudo ? 'home' : 'name');
}
$('#nameForm').onsubmit = e => {
  e.preventDefault();
  pseudo = e.target.pseudo.value.trim().slice(0, 20);
  if (!pseudo) return;
  store.set('p4-pseudo', pseudo);
  entry();
};
$('#changeName').onclick = e => {
  e.preventDefault();
  show('name');
  $('#nameForm').pseudo.focus();
};
function reset() {
  store.set('p4-session', null);
  state = null;
  shownMoves = shownRound = -1;
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
$('#createForm').onsubmit = e => {
  e.preventDefault();
  enter('create', { name: pseudo, private: e.target.vis.value === 'private' }, e.submitter);
};
$('#joinForm').onsubmit = e => {
  e.preventDefault();
  enter('join', { code: e.target.code.value, name: pseudo, watch: e.submitter?.value === 'watch' }, e.submitter);
};
$('#joinForm').code.oninput = e => (e.target.value = e.target.value.toUpperCase());
document.addEventListener('click', e => {
  if (e.target.closest('[data-leave]')) {
    const playing = state && !state.spectator && state.phase === 'playing';
    if (playing && !confirm('Quitter la partie en cours ? Elle s’arrêtera pour ton adversaire.')) return;
    socket.emit('leave');
    reset();
  }
  const b = e.target.closest('[data-room]');
  if (b) enter('join', { code: b.dataset.room, name: pseudo, watch: b.dataset.mode === 'watch' }, b);
});

socket.on('session', s => {
  store.set('p4-session', JSON.stringify(s));
  history.replaceState(null, '', `?salon=${s.code}`);
});
entry();
socket.on('connect', () => {
  let s = null;
  try { s = JSON.parse(store.get('p4-session')); } catch { /* session illisible */ }
  if (s && (!urlCode || urlCode === s.code)) {
    socket.emit('resume', s, res => {
      if (!res?.error) return;
      store.set('p4-session', null);
      toast(res.error);
      entry();
    });
  } else if (urlCode) {
    $('#joinForm').code.value = urlCode;
  }
});

socket.on('rooms', list => {
  const status = r => r.phase === 'lobby' ? (r.players.length < 2 ? 'Attend un adversaire' : 'Dans le salon')
    : r.phase === 'over' ? `Manche ${r.round} terminée` : `Manche ${r.round} en cours`;
  $('#rooms').innerHTML = list.length ? list.map(r => {
    const open = r.players.length < 2;
    return `<li><div><b>${r.players.map(esc).join(' <span>vs</span> ')}</b><small>${status(r)}${r.spectators ? ` · 👁 ${r.spectators}` : ''}</small></div>
      ${open ? `<button class="gold small" data-room="${r.code}" data-mode="play">Affronter</button>` : ''}
      <button class="ghost small" data-room="${r.code}" data-mode="watch">👁 Regarder</button></li>`;
  }).join('') : '<li class="empty">Aucun salon public pour l’instant. Crée le tien !</li>';
});

/* ---------- Dans un salon ---------- */
socket.on('state', s => {
  if (s.moves !== state?.moves || s.turn !== state?.turn) remoteCol = sentCol = null; // nouveau coup : le survol repart de zéro
  state = s;
  if (s.phase === 'lobby') return renderWait(s);
  renderGame(s);
});

$('#copyLink').onclick = () => navigator.clipboard.writeText(`${location.origin}${location.pathname}?salon=${state.code}`)
  .then(() => toast('Lien copié : envoie-le à ton adversaire !', true), () => toast('Copie impossible'));
$('#startBtn').onclick = e => act(e.target, 'start');
$('#restartBtn').onclick = e => {
  if (state.phase === 'playing' && !confirm('Proposer de recommencer la manche ? Ton adversaire devra accepter.')) return;
  act(e.target, 'requestRematch');
};

const dot = p => `<span class="dot ${p.connected ? 'on' : 'off'}" title="${p.connected ? 'Connecté' : 'Déconnecté'}"></span>`;

function renderWait(s) {
  show('wait');
  shownMoves = shownRound = -1;
  $('#waitCode').textContent = s.code;
  $('#waitPrivacy').textContent = s.private ? '🔒 Salon privé : partage le code pour inviter' : '🌍 Salon public : visible dans la liste';
  $('#notice').hidden = !s.notice;
  $('#notice').textContent = s.notice ?? '';
  $('#waitPlayers').innerHTML = [...s.players, null].slice(0, 2).map(p => p
    ? `<li>${dot(p)}<b>${esc(p.name)}</b>${p.name === s.host ? '<small>créateur</small>' : ''}${p.name === s.me ? '<small>toi</small>' : ''}<span>${p.connected ? 'connecté' : 'déconnecté'}</span></li>`
    : '<li class="empty"><span class="dot wait"></span>En attente d’un adversaire…</li>').join('');
  $('#waitWatchers').hidden = !s.spectators.length;
  $('#waitWatchers').textContent = `👁 Spectateurs : ${s.spectators.join(', ')}`;
  const ready = s.players.length === 2 && s.players.every(p => p.connected), b = $('#startBtn');
  b.hidden = s.spectator;
  b.disabled = !(ready && s.me === s.host);
  b.textContent = s.me !== s.host ? `${s.host} va lancer la partie…` : ready ? 'Lancer la partie' : 'En attente du 2ᵉ joueur…';
}

/* ---------- Grille ---------- */
// Les 7 colonnes cliquables (souris, doigt, clavier) sont créées une fois.
$('#cols').innerHTML = Array.from({ length: COLS }, (_, c) => `<button class="col" data-col="${c}" aria-label="Jouer dans la colonne ${c + 1}"></button>`).join('');
$('#preview').innerHTML = Array.from({ length: COLS }, () => '<span></span>').join('');

const myTurn = () => state?.phase === 'playing' && state.turn === state.me && !animating;
const landingRow = c => { for (let r = ROWS - 1; r >= 0; r--) if (!state.board[r][c]) return r; return -1; };

// Jeton au-dessus de la grille, à la couleur du joueur qui a la main : le sien quand c'est son tour,
// sinon celui de l'adversaire, à la colonne qu'il survole (vu en direct par l'adversaire et les spectateurs).
let remoteCol = null, sentCol = null;
socket.on('hover', c => { remoteCol = c; renderHover(); });
function renderHover() {
  const mine = myTurn(), col = mine ? hoverCol : remoteCol;
  if (mine && hoverCol !== sentCol) socket.emit('hover', (sentCol = hoverCol));
  const color = state?.players.find(p => p.name === state.turn)?.color;
  const ok = col !== null && state?.phase === 'playing' && !animating && (mine || state.turn !== state.me) && landingRow(col) >= 0;
  [...$('#preview').children].forEach((el, c) => (el.className = ok && c === col ? `ghost ${color}` : ''));
  for (const el of document.querySelectorAll('.slot.target')) el.classList.remove('target');
  if (ok) document.querySelector(`.slot[data-rc="${landingRow(col)}-${col}"]`)?.classList.add('target');
}
$('#cols').addEventListener('pointerover', e => { hoverCol = e.target.closest('.col') ? Number(e.target.closest('.col').dataset.col) : null; renderHover(); });
$('#cols').addEventListener('pointerleave', () => { hoverCol = null; renderHover(); });
$('#cols').addEventListener('focusin', e => { hoverCol = Number(e.target.dataset.col); renderHover(); });
$('#cols').onclick = e => {
  const b = e.target.closest('.col');
  if (!b || !state) return;
  const c = Number(b.dataset.col);
  if (state.spectator || state.phase !== 'playing') return;
  if (state.turn !== state.me) return toast('Attends ton tour');
  if (animating) return;
  if (landingRow(c) < 0) {
    b.classList.remove('full');
    void b.offsetWidth;
    b.classList.add('full');
    return toast('Cette colonne est pleine');
  }
  hoverCol = null;
  act(null, 'play', c, state.moves);
};

function renderBoard(s) {
  const fresh = s.round !== shownRound, newMove = !fresh && s.moves === shownMoves + 1 && s.last;
  // Nouvelle manche : les jetons de la précédente tombent par le fond de la grille.
  if (fresh && shownRound > 0 && $('#discs .disc')) {
    $('#clearing').innerHTML = $('#discs').innerHTML.replace(/ (drop|win|dim|last)/g, '');
    setTimeout(() => ($('#clearing').innerHTML = ''), 1200);
  }
  shownRound = s.round;
  shownMoves = s.moves;
  const line = new Set((s.line ?? []).map(([r, c]) => `${r}-${c}`));
  let html = '';
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const color = s.board[r][c], key = `${r}-${c}`;
      const drop = newMove && s.last.row === r && s.last.col === c;
      const cls = [color && `disc ${color}`, drop && 'drop', line.has(key) && 'win', s.line && color && !line.has(key) && 'dim',
        !drop && s.last && s.last.row === r && s.last.col === c && !s.line && 'last'].filter(Boolean).join(' ');
      html += `<div class="slot" data-rc="${key}" style="--r:${r};--c:${c}">${color ? `<span class="${cls}" style="--fall:${r + 1}"></span>` : ''}</div>`;
    }
  }
  $('#discs').innerHTML = html;
  $('#board').classList.toggle('ended', !!s.line);
  // Trait d'or tracé d'un bout à l'autre de l'alignement gagnant.
  const ends = (s.line ?? []).slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  $('#winline').innerHTML = ends.length
    ? `<line x1="${ends[0][1] + 0.5}" y1="${ends[0][0] + 0.5}" x2="${ends.at(-1)[1] + 0.5}" y2="${ends.at(-1)[0] + 0.5}"/>` : '';
  // Pendant la chute du jeton, on ne peut pas rejouer ; le son part à l'arrivée.
  if (newMove) {
    animating = true;
    const ms = 280 + s.last.row * 55;
    setTimeout(() => {
      animating = false;
      sfx.drop();
      if (s.phase === 'over') (s.winner ? sfx.win : sfx.draw)();
      if (state === s) renderGame(s);
    }, ms + 120);
  }
}

function renderGame(s) {
  show('game');
  if (s.round !== shownRound || s.moves !== shownMoves) renderBoard(s);
  const watcher = s.spectator;
  $('#watchBadge').hidden = !watcher;
  s.players.forEach((p, i) => {
    const turn = s.phase === 'playing' && s.turn === p.name;
    $(`#p${i}`).className = `player ${p.color}${turn ? ' turn' : ''}${p.name === s.me ? ' me' : ''}${s.winner === p.name ? ' winner' : ''}`;
    $(`#p${i}`).innerHTML = `<span class="token ${p.color}"></span>
      <div class="who"><b>${esc(p.name)}${p.name === s.me ? ' <small>(toi)</small>' : ''}</b><small>${dot(p)}${COLOR_NAME[p.color]} · ${p.wins} victoire${p.wins > 1 ? 's' : ''}</small></div>
      ${turn ? `<span class="turn-tag">${p.name === s.me ? 'À toi !' : 'Son tour'}</span>` : ''}`;
  });
  const other = s.players.find(p => p.name !== s.me);
  const away = other && !other.connected && !watcher ? ` · ${other.name} est déconnecté, la partie reprendra à son retour` : '';
  const turnColor = s.players.find(p => p.name === s.turn)?.color;
  $('#status').className = `status ${turnColor ?? ''}`;
  $('#status').textContent = s.phase === 'over' ? (s.winner ? `${s.winner} a aligné 4 jetons !` : 'Grille pleine : match nul')
    : s.turn === s.me ? `À toi de jouer (${COLOR_NAME[turnColor]})${away}` : `Au tour de ${s.turn} (${COLOR_NAME[turnColor]})${away}`;
  $('#board').classList.toggle('my-turn', myTurn());
  $('#moveNo').textContent = s.moves;
  $('#roundNo').textContent = s.round;
  const [a, b] = s.players;
  $('#statsChip').innerHTML = `${esc(a.name)} <b>${a.wins}</b> · ${b ? `${esc(b.name)} <b>${b.wins}</b> · ` : ''}nuls <b>${s.draws}</b> · manches jouées <b>${s.games}</b>`;
  $('#restartBtn').hidden = watcher;
  $('#restartBtn').disabled = !!s.rematch || s.players.length < 2;

  // Proposition de recommencer pendant la partie : bandeau pour accepter ou refuser.
  const bar = $('#rematchBar');
  bar.hidden = !(s.phase === 'playing' && (s.rematch || s.notice));
  if (!bar.hidden) {
    bar.innerHTML = !s.rematch ? esc(s.notice)
      : s.rematch === s.me ? `En attente de la réponse de ${esc(other?.name)}…`
      : watcher ? `${esc(s.rematch)} propose de recommencer…`
      : `<span>${esc(s.rematch)} propose de recommencer la manche</span><button class="gold small" data-rm="yes">Accepter</button><button class="ghost small" data-rm="no">Refuser</button>`;
  }
  renderOverlay(s);
  renderHover();
}

// Fenêtre de fin de manche : vainqueur ou match nul, score du salon, rejouer ou revenir au salon.
function renderOverlay(s) {
  const o = $('#overlay');
  o.hidden = s.phase !== 'over' || animating;
  if (o.hidden) return;
  const [a, b] = s.players, won = s.winner === s.me, other = s.players.find(p => p.name !== s.me);
  const title = s.winner ? (won ? 'Victoire !' : `${esc(s.winner)} l’emporte !`) : 'Match nul !';
  const msg = s.winner ? (won ? 'Félicitations, bien joué !' : s.spectator ? 'Félicitations au vainqueur !' : 'Dommage… prends ta revanche !') : 'Grille pleine, personne n’a aligné 4 jetons.';
  const ask = s.rematch && s.rematch !== s.me;
  o.innerHTML = `${s.winner ? '<div class="confetti">' + Array.from({ length: 28 }, (_, i) => `<i style="--i:${i}"></i>`).join('') + '</div>' : ''}
    <div class="modal">
      <span class="crown" aria-hidden="true">${s.winner ? '♛' : '◐'}</span>
      <h2>${title}</h2>
      <p>${msg}</p>
      <div class="score">${esc(a.name)} <b>${a.wins}</b> – <b>${b?.wins ?? 0}</b> ${esc(b?.name ?? '')}<small>${s.draws} nul${s.draws > 1 ? 's' : ''} · ${s.games} manche${s.games > 1 ? 's' : ''} · ${s.moves} coups</small></div>
      ${s.notice ? `<p class="notice">${esc(s.notice)}</p>` : ''}
      ${s.spectator ? '<p class="hint">Les joueurs décident de la suite…</p>' : `
      ${ask ? `<p class="ask">${esc(s.rematch)} veut rejouer !</p>` : ''}
      ${s.rematch === s.me ? `<p class="hint">En attente de ${esc(other?.name)}…</p>` : ''}
      <div class="row">
        <button class="gold" data-rm="yes" ${s.rematch === s.me || s.players.length < 2 ? 'disabled' : ''}>${ask ? 'Accepter la revanche' : 'Rejouer'}</button>
        ${ask ? '<button class="ghost" data-rm="no">Refuser</button>' : ''}
        <button class="ghost" data-tolobby>Retour au salon</button>
      </div>`}
    </div>`;
}
document.addEventListener('click', e => {
  const rm = e.target.closest('[data-rm]')?.dataset.rm;
  if (rm) act(e.target.closest('button'), rm === 'yes' ? 'requestRematch' : 'declineRematch');
  if (e.target.closest('[data-tolobby]')) act(e.target.closest('button'), 'toLobby');
});

// Reflet de la laque qui suit la souris.
$('#board').addEventListener('pointermove', e => {
  const r = $('#board').getBoundingClientRect();
  $('#board').style.setProperty('--mx', `${(((e.clientX - r.left) / r.width) * 100).toFixed(1)}%`);
  $('#board').style.setProperty('--my', `${(((e.clientY - r.top) / r.height) * 100).toFixed(1)}%`);
});
