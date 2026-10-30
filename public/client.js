const socket = io();
const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);
const fmt = n => String(n).replace('.', ',');
const signed = n => (n >= 0 ? `+${n}` : `−${-n}`);
const act = (type, arg) => socket.emit('act', type, arg);
const hue = name => [...name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7);
const VAL = { A: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7, 8: 0, V: 0.5, D: 0.5, R: 0.5 };
const points = cards => cards.reduce((t, c) => t + (VAL[c.rank] ?? 0), 0);
const AVATARS = ['🦊', '🐼', '🐯', '🦁', '🐸', '🐙', '🦄', '🐺', '🐵', '🐨', '🦉', '🐲', '🤠', '😎', '🎩', '👑'];
const TITLE = document.title;

let me = null, state = null, toastTimer, blinkTimer;
let seen = {}; // par joueur : 'f' (face visible) ou 'b' (dos / cachée) pour chaque carte au dernier affichage
const seatPos = {}; // position de chaque place, pour les effets
const chipAnim = {}; // soldes en train de défiler
const bubbles = {}; // dernières bulles de chat par joueur
const openRounds = new Set(); // manches passées que j'ai dépliées dans l'historique
let tab = 'log', seenChat = 0; // onglet affiché à droite, dernier message de chat lu
let kept = -1; // index de la carte que j'ai choisi de garder cachée pendant ce tour
let avatar = localStorage.getItem('avatar') || AVATARS[Math.floor(Math.random() * AVATARS.length)];
let muted = localStorage.getItem('muted') === '1';
const invite = new URLSearchParams(location.search).get('lobby');

/* ---------- Accueil ---------- */
$('#pseudo').value = localStorage.getItem('pseudo') || '';
if (invite) $('#nameHint').textContent = 'Tu as été invité : entre ton pseudo pour rejoindre la table.';

function renderAvatars() {
  $('#avatarPick').innerHTML = AVATARS.map(a =>
    `<button type="button" role="radio" aria-checked="${a === avatar}" aria-label="Avatar ${a}" data-avatar="${a}">${a}</button>`).join('');
}
renderAvatars();
$('#avatarPick').onclick = e => {
  const a = e.target.closest('button')?.dataset.avatar;
  if (!a) return;
  avatar = a;
  localStorage.setItem('avatar', a);
  renderAvatars();
};

$('#nameForm').onsubmit = e => {
  e.preventDefault();
  me = $('#pseudo').value.trim();
  localStorage.setItem('pseudo', me);
  socket.emit('hello', me, avatar);
  if (invite) {
    socket.emit('join', invite);
    history.replaceState(null, '', location.pathname);
  }
  $('#nameForm').hidden = $('#avatarPick').hidden = true;
  $('#nameHint').textContent = `Connecté en tant que ${avatar} ${me}.`;
  $('#lobbyName').placeholder = `${me}'s lobby`.slice(0, 30);
  $('#lobbyPane').hidden = false;
};
$('#createForm').onsubmit = e => {
  e.preventDefault();
  socket.emit('create', $('#lobbyName').value.trim() || $('#lobbyName').placeholder);
};
$('#lobbies').onclick = e => {
  const id = e.target.closest('button')?.dataset.join;
  if (id) socket.emit('join', id);
};

const face = p => `<span class="face" style="--h:${hue(p.name)}" title="${esc(p.name)}">${esc(p.avatar || p.name[0].toUpperCase())}</span>`;

socket.on('lobbies', ls => {
  $('#lobbies').innerHTML = ls.length
    ? ls.map(l => `<li class="lobby">
        <div><b>${esc(l.name)}</b>
          <span class="status ${l.playing ? 'live' : 'open'}">${l.playing ? 'En cours' : 'En attente'}</span></div>
        <div class="faces" aria-label="${l.players.length} joueurs sur ${l.max}">${l.players.map(face).join('')}<small>${l.players.length}/${l.max}</small></div>
        <button class="gold" data-join="${l.id}" ${l.players.length >= l.max ? 'disabled' : ''}>Rejoindre</button></li>`).join('')
    : '<li class="empty">Aucune table pour l’instant. Crée la tienne !</li>';
});

// Après une coupure réseau, se ré-annoncer suffit à retrouver sa place.
socket.on('connect', () => me && socket.emit('hello', me, avatar));

function toast(m, ok = false) {
  $('#toast').textContent = m;
  $('#toast').className = ok ? 'ok' : '';
  $('#toast').hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => ($('#toast').hidden = true), 2500);
}
socket.on('err', m => toast(m));

/* ---------- Sons (synthétisés, aucun fichier) ---------- */
let ac;
document.addEventListener('pointerdown', () => {
  ac ??= new (window.AudioContext || window.webkitAudioContext)();
  ac.resume();
});
function tone(freq, dur, type = 'sine', vol = 0.12, delay = 0) {
  if (muted || !ac) return;
  const t = ac.currentTime + delay, o = ac.createOscillator(), g = ac.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g).connect(ac.destination);
  o.start(t);
  o.stop(t + dur);
}
const sfx = {
  deal: () => { tone(320, 0.07, 'triangle', 0.08); tone(1400, 0.03, 'square', 0.02, 0.01); },
  chip: () => { tone(2300, 0.06, 'sine', 0.07); tone(2900, 0.05, 'sine', 0.05, 0.06); tone(2500, 0.05, 'sine', 0.04, 0.12); },
  win: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.28, 'triangle', 0.1, i * 0.09)),
  lose: () => [392, 294].forEach((f, i) => tone(f, 0.4, 'sawtooth', 0.04, i * 0.18)),
  bust: () => [620, 460, 320, 190].forEach((f, i) => tone(f, 0.22, 'square', 0.05, i * 0.1)),
  turn: () => { tone(880, 0.15, 'sine', 0.1); tone(1320, 0.3, 'sine', 0.09, 0.12); },
};

/* ---------- Notification « à toi » ---------- */
function myTurn(s) {
  const mine = s.players.find(p => p.name === s.me);
  return (s.phase === 'playing' && s.turn === s.me) || (s.phase === 'banker' && s.banker === s.me) ||
    (s.phase === 'betting' && mine?.inRound && mine.bet === null);
}
function blink(on) {
  clearInterval(blinkTimer);
  document.title = TITLE;
  if (on && document.hidden) blinkTimer = setInterval(() => (document.title = document.title === TITLE ? '🔔 À toi !' : TITLE), 1000);
}
document.addEventListener('visibilitychange', () => !document.hidden && blink(false));

/* ---------- Effets visuels ---------- */
function fx(cls, x, y, html = '', style = '') {
  const el = document.createElement('div');
  el.className = `fx ${cls}`;
  el.style.cssText = `--x:${x};--y:${y};${style}`;
  el.innerHTML = html;
  el.addEventListener('animationend', () => el.remove(), { once: true });
  $('#fx').append(el);
}
function flyChips(from, to) {
  if (!from || !to) return;
  for (let i = 0; i < 4; i++) fx('fly', 0, 0, '', `--x0:${from.x};--y0:${from.y};--x1:${to.x};--y1:${to.y};animation-delay:${i * 0.09}s`);
}
function confetti(pos) {
  const colors = ['#f5d27a', '#fff1c4', '#3ee08f', '#6ff5d6', '#ff8a96', '#c8973a'];
  for (let i = 0; i < 36; i++) {
    const a = Math.random() * Math.PI * 2, d = 60 + Math.random() * 110;
    fx('confetti', pos.x, pos.y, '', `--dx:${Math.cos(a) * d}px;--dy:${Math.sin(a) * d - 40}px;--r:${Math.random() * 720 - 360}deg;--c:${colors[i % colors.length]};animation-delay:${Math.random() * 0.15}s`);
  }
}
function shownChips(name, v) {
  const a = chipAnim[name];
  if (!a) return v;
  const k = Math.min(1, (performance.now() - a.t0) / 1000);
  if (k >= 1) {
    delete chipAnim[name];
    return v;
  }
  return Math.round(a.from + (a.to - a.from) * (1 - (1 - k) ** 3));
}
function tickChips() {
  for (const el of document.querySelectorAll('[data-chips]')) el.textContent = shownChips(el.dataset.chips, Number(el.dataset.v));
  if (Object.keys(chipAnim).length) requestAnimationFrame(tickChips);
}

// Compare l'état précédent au nouveau pour lancer animations et sons.
function effects(old, s) {
  const byName = Object.fromEntries(old.players.map(p => [p.name, p]));
  const banker = s.players.find(p => p.isBanker);
  let dealt = false, chipsMoved = false;
  for (const p of s.players) {
    const o = byName[p.name];
    if (!o) continue;
    if (p.cards.length > o.cards.length) dealt = true;
    if (p.chips !== o.chips) {
      chipAnim[p.name] = { from: shownChips(p.name, o.chips), to: p.chips, t0: performance.now() };
      fx(`float ${p.chips > o.chips ? 'up' : 'down'}`, seatPos[p.name]?.x ?? 0, seatPos[p.name]?.y ?? 0, signed(p.chips - o.chips));
      chipsMoved = true;
    }
    if (p.result && !o.result && !p.isBanker && banker) {
      const win = p.result.delta > 0;
      flyChips(seatPos[win ? banker.name : p.name], seatPos[win ? p.name : banker.name]);
      if (win && p.cards.length === 2 && points(p.cards) === 7.5) confetti(seatPos[p.name]);
      if (p.name === s.me) (win ? sfx.win : sfx.lose)();
    }
  }
  if (dealt) sfx.deal();
  if (chipsMoved) sfx.chip();
  if (banker && points(banker.cards) > 7.5 && !(old.players.find(p => p.isBanker)?.cards.length >= banker.cards.length)) {
    $('.table-wrap').classList.add('shake');
    fx('flash', 0, 0);
    fx('boom', 0, -0.15, 'Le banquier saute !');
    sfx.bust();
  }
  if (s.banker === s.me && s.phase === 'results' && old.phase !== 'results' && !s.cancelled) {
    const d = banker?.result?.delta ?? 0;
    if (d) (d > 0 ? sfx.win : sfx.lose)();
  }
  for (const m of s.chat) {
    if (m.id <= (old.chat.at(-1)?.id || 0)) continue;
    bubbles[m.name] = { text: m.text, until: Date.now() + 4000 };
    setTimeout(() => state && render(), 4100);
  }
  if (myTurn(s) && !myTurn(old)) {
    sfx.turn();
    navigator.vibrate?.(200);
    blink(true);
  } else if (!myTurn(s)) blink(false);
  if (s.phase === 'results' && old.phase !== 'results') setTimeout(() => showOverlay(s.roundNo), 1300);
}
$('.table-wrap').addEventListener('animationend', e => e.target.classList.remove('shake'));

/* ---------- Écran de fin de manche ---------- */
function showOverlay(roundNo) {
  const s = state;
  if (!s || s.phase !== 'results' || s.roundNo !== roundNo) return;
  const rows = s.players.filter(p => p.result || p.isBanker).map(p => ({ p, d: p.result?.delta ?? 0 })).sort((a, b) => b.d - a.d);
  const i = s.players.findIndex(p => p.isBanker), n = s.players.length;
  let next = null;
  for (let k = 1; k <= n && !next; k++) {
    const p = s.players[(i + k) % n];
    if (p.connected && p.chips > 0) next = p;
  }
  $('#overlay').innerHTML = `<button class="close" data-a="closeOverlay" aria-label="Fermer">✕</button>
    <h3>${s.cancelled ? 'Manche annulée' : `Fin de la manche ${roundNo}`}</h3>
    ${s.cancelled ? '<p>Toutes les mises ont été rendues.</p>' : `<ol>${rows.map(({ p, d }, k) => `<li class="${d > 0 ? 'win' : d < 0 ? 'lose' : ''}">
      ${face(p)}<span class="n">${esc(p.name)}${p.isBanker ? ' <small>banquier</small>' : ''}${k === 0 && d > 0 ? ' <small class="top">★ meilleur coup</small>' : ''}</span>
      <b>${signed(d)}</b></li>`).join('')}</ol>`}
    ${next ? `<p class="next">Prochain banquier : ${face(next)} <b>${esc(next.name)}</b></p>` : ''}`;
  $('#overlay').hidden = false;
}

/* ---------- Réception de l'état ---------- */
socket.on('state', s => {
  const old = state;
  state = s;
  $('#home').hidden = !!s;
  $('#game').hidden = !s;
  if (!s) {
    seen = {};
    seenChat = 0;
    $('#overlay').hidden = true;
    blink(false);
    return;
  }
  if (old && old.id === s.id) effects(old, s);
  render();
  requestAnimationFrame(tickChips);
});

$('#game').onclick = e => {
  const b = e.target.closest('button');
  if (!b) return;
  if (b.dataset.challenge) return act('challenge', b.dataset.challenge);
  if (b.dataset.tab) {
    tab = b.dataset.tab;
    return render();
  }
  if (b.dataset.kick && confirm(`Exclure ${b.dataset.kick} de la table ?`)) return act('kick', b.dataset.kick);
  if (b.dataset.ban && confirm(`Bannir ${b.dataset.ban} ? Il ne pourra plus revenir sur cette table.`)) return act('ban', b.dataset.ban);
  if (b.dataset.add) {
    const input = $('#bet'), max = Number(input.max);
    input.value = b.dataset.add === 'all' ? max : Math.min(max, Number(input.value || 0) + Number(b.dataset.add));
    return;
  }
  if (b.dataset.keep) {
    kept = Number(b.dataset.keep);
    return render();
  }
  const a = b.dataset.a;
  if (a === 'leave') socket.emit('leave');
  else if (a === 'closeOverlay') $('#overlay').hidden = true;
  else if (a === 'mute') {
    muted = !muted;
    localStorage.setItem('muted', muted ? '1' : '0');
    render();
  } else if (a === 'invite') {
    navigator.clipboard.writeText(`${location.origin}/?lobby=${state.id}`)
      .then(() => toast('Lien d’invitation copié !', true), () => toast('Copie impossible'));
  } else if (a === 'bet') act('bet', $('#bet').value);
  // Sans carte cachée, la nouvelle carte arrive cachée puis on demande « Caché » ou « Montrer ».
  else if (a === 'draw') act('draw', !state.players.find(p => p.name === state.me).cards.some(c => c.hidden));
  else if (a) act(a);
};

function card(c, cls) {
  if (!c.rank) return `<span class="card back${cls}" aria-label="carte cachée"></span>`;
  const red = '♥♦'.includes(c.suit) ? ' red' : '';
  const isFace = 'VDR'.includes(c.rank);
  const corner = `${c.rank}<br>${c.suit}`;
  return `<span class="card${red}${c.hidden ? ' secret' : ''}${cls}" aria-label="${c.rank}${c.suit}${c.hidden ? ' cachée' : ''}">
    <span class="corner tl">${corner}</span>
    <span class="pip${isFace ? ' face' : ''}">${isFace ? c.rank : c.suit}</span>
    <span class="corner br">${corner}</span>
    ${c.hidden ? '<i>cachée</i>' : ''}</span>`;
}

function render() {
  const s = state, n = s.players.length;
  const i0 = Math.max(0, s.players.findIndex(p => p.name === s.me));
  const mine = s.players[i0];
  const iAmBanker = s.banker === s.me;
  const bankerP = s.players.find(p => p.isBanker);
  const canChallenge = iAmBanker && s.phase === 'banker' && bankerP.cards.length > 0;
  // En attente, des places libres complètent la table.
  const slots = s.phase === 'waiting' ? Math.max(n, 6) : n;

  $('#seats').className = slots > 6 ? 'many' : '';
  $('#fx').className = $('#seats').className;
  const wrap = $('.table-wrap'), W = wrap.clientWidth, H = wrap.clientHeight, cs = getComputedStyle($('#seats'));
  const rx = parseFloat(cs.getPropertyValue('--rx')) / 100, ry = parseFloat(cs.getPropertyValue('--ry')) / 100;
  const now = Date.now();

  const seatHtml = s.players.map((p, i) => {
    // Ma place en bas au centre, les suivants dans l'ordre des places.
    const a = Math.PI / 2 + ((i - i0 + n) % n) * 2 * Math.PI / slots;
    const x = Math.cos(a), y = Math.sin(a);
    seatPos[p.name] = { x: x.toFixed(3), y: y.toFixed(3) };
    let prev = seen[p.name] || [];
    if (p.cards.length < prev.length) prev = [];
    const faces = p.cards.map(c => (c.rank && !c.hidden ? 'f' : 'b'));
    seen[p.name] = faces;
    const isTurn = s.turn === p.name || (s.phase === 'banker' && p.isBanker);
    const r = p.result;
    const badge = r ? `<span class="badge ${r.delta >= 0 ? 'win' : 'lose'}">${r.delta >= 0 ? 'Gagné +' : 'Perdu −'}${Math.abs(r.delta)}</span>` : '';
    const bubble = bubbles[p.name]?.until > now ? `<div class="bubble">${esc(bubbles[p.name].text)}</div>` : '';
    const cls = ['seat', p.isBanker && 'banker', isTurn && 'turn', p.name === s.me && 'me', !p.connected && 'off',
      r && (r.delta >= 0 ? 'won' : 'lost')].filter(Boolean).join(' ');
    // Décalage jusqu'au paquet, pour que les cartes partent du centre de la table.
    const dx = Math.round(-x * rx * W), dy = Math.round(-y * ry * H - 0.22 * H);
    return `<div class="${cls}" style="--x:${x.toFixed(3)};--y:${y.toFixed(3)};--h:${hue(p.name)};--dx:${dx}px;--dy:${dy}px">
      ${bubble}
      ${p.isBanker ? '<div class="banker-chip">BANQUIER</div>' : ''}
      ${s.host === s.me && p.name !== s.me ? `<div class="mod">
        <button data-kick="${esc(p.name)}" title="Exclure" aria-label="Exclure ${esc(p.name)}">✕</button>
        <button data-ban="${esc(p.name)}" title="Bannir" aria-label="Bannir ${esc(p.name)}">⛔</button></div>` : ''}
      <div class="head">
        <span class="avatar${p.avatar ? ' emoji' : ''}">${esc(p.avatar || p.name[0].toUpperCase())}</span>
        <div class="who">
          <div class="name">${esc(p.name)}${p.name === s.host ? ' <span class="crown" title="Chef du lobby">♛</span>' : ''}</div>
          <div class="info"><span class="coin"></span><span data-chips="${esc(p.name)}" data-v="${p.chips}">${shownChips(p.name, p.chips)}</span>${p.chips === 0 ? ' · spectateur' : ''}${p.connected ? '' : ' · absent'}</div>
        </div>
      </div>
      <div class="cards">${p.cards.map((c, j) => card(c, j >= prev.length ? ' deal' : prev[j] === 'b' && faces[j] === 'f' ? ' flip' : '')).join('')}</div>
      <div class="foot">
        ${p.bet !== null ? `<span class="bet-chip">${p.bet}</span>` : ''}
        ${p.total !== null && p.cards.length ? `<span class="total${p.total > 7.5 ? ' bust' : ''}">${fmt(p.total)}</span>` : ''}
        ${badge}
      </div>
      ${canChallenge && p.inRound && !p.challenged ? `<button class="defy" data-challenge="${esc(p.name)}">Défier</button>` : ''}
    </div>`;
  });
  for (let k = n; k < slots; k++) {
    const a = Math.PI / 2 + k * 2 * Math.PI / slots;
    seatHtml.push(`<div class="seat ghost" style="--x:${Math.cos(a).toFixed(3)};--y:${Math.sin(a).toFixed(3)}"><span>Place libre</span></div>`);
  }
  $('#seats').innerHTML = seatHtml.join('');

  // Projecteur sur le joueur qui doit agir.
  const active = s.turn || (s.phase === 'banker' ? s.banker : null);
  $('#spot').classList.toggle('on', !!active);
  if (active && seatPos[active]) $('#spot').style.cssText = `--x:${seatPos[active].x};--y:${seatPos[active].y}`;
  if (s.phase !== 'results') $('#overlay').hidden = true;

  $('#center').textContent = {
    waiting: s.host === s.me ? 'Lance la partie dès que vous êtes 2' : `En attente de ${s.host}…`,
    betting: 'Faites vos jeux…',
    playing: s.turn === s.me ? 'À toi de jouer' : `Au tour de ${s.turn}`,
    banker: iAmBanker ? (bankerP.cards.length ? 'Tire ou défie un joueur' : 'Tire ta première carte') : 'Le banquier tire…',
    results: s.cancelled ? 'Manche annulée' : 'Fin de la manche',
  }[s.phase];

  const keptBet = $('#bet')?.value;
  let html = '';
  if (s.phase === 'waiting') {
    if (s.host === s.me) {
      const ready = s.players.filter(p => p.connected && p.chips > 0).length >= 2;
      html += `<button class="gold big" data-a="start" ${ready ? '' : 'disabled'}>Lancer la partie</button>`;
    }
    html += '<button class="ghost" data-a="invite">🔗 Copier le lien d’invitation</button>';
  }
  if (s.phase === 'betting' && mine.inRound && mine.bet === null) {
    html += `<div class="bet-box">
      <div class="quick">${[10, 50, 100, 500].map(v => `<button class="chipbtn c${v}" data-add="${v}">+${v}</button>`).join('')}
        <button class="chipbtn all" data-add="all">Tapis</button></div>
      <label>Mise <input id="bet" type="number" min="${Math.min(10, mine.chips)}" max="${mine.chips}" value="${keptBet || Math.min(100, mine.chips)}"></label>
      <button class="gold big" data-a="bet">Miser</button></div>`;
  }
  if (s.phase !== 'playing' || s.turn !== s.me) kept = -1;
  else {
    const hiddenIdx = mine.cards.findIndex(c => c.hidden);
    // Étape 1 : garder caché ou montrer la carte reçue (sautée si une carte est déjà gardée cachée). Étape 2 : tirer ou rester.
    if (hiddenIdx >= 0 && hiddenIdx !== kept) {
      html += `<button class="dark" data-keep="${hiddenIdx}">Caché</button>
        <button class="gold" data-a="reveal">Montrer</button>`;
    } else {
      html += `<button class="gold" data-a="draw">Tirer</button>
        <button class="green" data-a="stand">Rester</button>`;
    }
  }
  if (s.phase === 'banker' && iAmBanker) html += `<button class="gold big" data-a="bankerDraw" ${mine.total >= 7.5 ? 'disabled' : ''}>Tirer</button>`;
  if (mine.total !== null && mine.cards.length) html += `<span class="mytotal${mine.total > 7.5 ? ' bust' : ''}"><small>Mon total</small>${fmt(mine.total)}</span>`;
  html += `<button class="quit icon" data-a="mute" title="${muted ? 'Activer' : 'Couper'} le son" aria-label="${muted ? 'Activer' : 'Couper'} le son">${muted ? '🔇' : '🔊'}</button>`;
  html += '<button class="quit" data-a="leave" title="Quitter la table">Quitter</button>';
  $('#actions').innerHTML = html;

  // Historique groupé par manche, la plus récente en haut et dépliée.
  const groups = new Map();
  for (const e of s.log) groups.set(e.r, [...(groups.get(e.r) || []), e]);
  $('#lobbyTitle').textContent = s.lobby;
  const scroll = $('#log').scrollTop;
  $('#log').innerHTML = [...groups].reverse().map(([r, es]) => {
    const banker = es.find(e => e.k === 'round');
    return `<details data-r="${r}" ${r === s.roundNo || openRounds.has(r) ? 'open' : ''}>
      <summary><b>${r ? `Manche ${r}` : 'Avant la partie'}</b>${banker ? `<span>Banquier : ${esc(banker.t.replace(' est le banquier', ''))}</span>` : ''}</summary>
      ${es.filter(e => e.k !== 'round').map(e => `<div class="e ${e.k}">${esc(e.t)}</div>`).join('')}</details>`;
  }).join('');
  $('#log').scrollTop = scroll;

  // Onglets Historique / Chat, avec le nombre de messages non lus.
  for (const t of document.querySelectorAll('[data-tab]')) t.setAttribute('aria-selected', t.dataset.tab === tab);
  $('#log').hidden = tab !== 'log';
  $('#chat').hidden = tab !== 'chat';
  const box = $('#chatMsgs'), atBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 40;
  box.innerHTML = s.chat.length ? s.chat.map(m => `<div class="msg${m.name === s.me ? ' mine' : ''}" style="--h:${hue(m.name)}">
    <b>${esc(m.name)}</b><span>${esc(m.text)}</span></div>`).join('') : '<p class="empty">Aucun message. Dis bonjour !</p>';
  if (atBottom) box.scrollTop = box.scrollHeight;
  const last = s.chat.at(-1)?.id || 0;
  if (tab === 'chat') seenChat = last;
  const unread = s.chat.filter(m => m.id > seenChat && m.name !== s.me).length;
  $('#unread').hidden = !unread;
  $('#unread').textContent = unread;
}

$('#log').addEventListener('toggle', e => {
  const r = Number(e.target.dataset.r);
  if (r !== state?.roundNo) e.target.open ? openRounds.add(r) : openRounds.delete(r);
}, true);

$('#chatForm').onsubmit = e => {
  e.preventDefault();
  socket.emit('chat', $('#chatInput').value);
  $('#chatInput').value = '';
};
