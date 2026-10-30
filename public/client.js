const socket = io();
const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);
const fmt = n => String(n).replace('.', ',');
const act = (type, arg) => socket.emit('act', type, arg);
const hue = name => [...name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7);
let me = null, state = null, seen = {}, toastTimer;
const openRounds = new Set(); // manches passées que j'ai dépliées dans l'historique
let tab = 'log', seenChat = 0; // onglet affiché à droite, dernier message de chat lu
let kept = -1; // index de la carte que j'ai choisi de garder cachée pendant ce tour

$('#pseudo').value = localStorage.getItem('pseudo') || '';

$('#nameForm').onsubmit = e => {
  e.preventDefault();
  me = $('#pseudo').value.trim();
  localStorage.setItem('pseudo', me);
  socket.emit('hello', me);
  $('#nameForm').hidden = true;
  $('#nameHint').textContent = `Connecté en tant que ${me}.`;
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

// Après une coupure réseau, se ré-annoncer suffit à retrouver sa place.
socket.on('connect', () => me && socket.emit('hello', me));

socket.on('lobbies', ls => {
  $('#lobbies').innerHTML = ls.length
    ? ls.map(l => `<li class="lobby">
        <div><b>${esc(l.name)}</b>
          <span class="status ${l.playing ? 'live' : 'open'}">${l.playing ? 'En cours' : 'En attente'}</span></div>
        <div class="seats-meter" aria-label="${l.count} joueurs sur ${l.max}">${'<i class="on"></i>'.repeat(l.count)}${'<i></i>'.repeat(l.max - l.count)}</div>
        <button class="gold" data-join="${l.id}" ${l.count >= l.max ? 'disabled' : ''}>Rejoindre</button></li>`).join('')
    : '<li class="empty">Aucune table pour l’instant. Crée la tienne !</li>';
});

socket.on('err', m => {
  $('#toast').textContent = m;
  $('#toast').hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => ($('#toast').hidden = true), 2500);
});

socket.on('state', s => {
  state = s;
  $('#home').hidden = !!s;
  $('#game').hidden = !s;
  if (s) render();
  else {
    seen = {};
    seenChat = 0;
  }
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
  else if (a === 'bet') act('bet', $('#bet').value);
  // Sans carte cachée, la nouvelle carte arrive cachée puis on demande « Caché » ou « Montrer ».
  else if (a === 'draw') act('draw', !state.players.find(p => p.name === state.me).cards.some(c => c.hidden));
  else if (a) act(a);
};

function card(c, isNew) {
  const cls = 'card' + (isNew ? ' deal' : '');
  if (!c.rank) return `<span class="${cls} back" aria-label="carte cachée"></span>`;
  const red = '♥♦'.includes(c.suit) ? ' red' : '';
  const face = 'VDR'.includes(c.rank);
  const corner = `${c.rank}<br>${c.suit}`;
  return `<span class="${cls}${red}${c.hidden ? ' secret' : ''}" aria-label="${c.rank}${c.suit}${c.hidden ? ' cachée' : ''}">
    <span class="corner tl">${corner}</span>
    <span class="pip${face ? ' face' : ''}">${face ? c.rank : c.suit}</span>
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

  $('#seats').className = n > 6 ? 'many' : '';
  $('#seats').innerHTML = s.players.map((p, i) => {
    // Ma place en bas au centre, les suivants dans l'ordre des places.
    const a = Math.PI / 2 + ((i - i0 + n) % n) * 2 * Math.PI / n;
    let prev = seen[p.name] || 0;
    if (p.cards.length < prev) prev = 0;
    seen[p.name] = p.cards.length;
    const isTurn = s.turn === p.name || (s.phase === 'banker' && p.isBanker);
    const r = p.result;
    const badge = r ? `<span class="badge ${r.delta >= 0 ? 'win' : 'lose'}">${r.delta >= 0 ? 'Gagné +' : 'Perdu −'}${Math.abs(r.delta)}</span>` : '';
    const cls = ['seat', p.isBanker && 'banker', isTurn && 'turn', p.name === s.me && 'me', !p.connected && 'off',
      r && (r.delta >= 0 ? 'won' : 'lost')].filter(Boolean).join(' ');
    return `<div class="${cls}" style="--x:${Math.cos(a).toFixed(3)};--y:${Math.sin(a).toFixed(3)};--h:${hue(p.name)}">
      ${p.isBanker ? '<div class="banker-chip">BANQUIER</div>' : ''}
      ${s.host === s.me && p.name !== s.me ? `<div class="mod">
        <button data-kick="${esc(p.name)}" title="Exclure" aria-label="Exclure ${esc(p.name)}">✕</button>
        <button data-ban="${esc(p.name)}" title="Bannir" aria-label="Bannir ${esc(p.name)}">⛔</button></div>` : ''}
      <div class="head">
        <span class="avatar">${esc(p.name[0].toUpperCase())}</span>
        <div class="who">
          <div class="name">${esc(p.name)}${p.name === s.host ? ' <span class="crown" title="Chef du lobby">♛</span>' : ''}</div>
          <div class="info"><span class="coin"></span>${p.chips}${p.chips === 0 ? ' · spectateur' : ''}${p.connected ? '' : ' · absent'}</div>
        </div>
      </div>
      <div class="cards">${p.cards.map((c, j) => card(c, j >= prev)).join('')}</div>
      <div class="foot">
        ${p.bet !== null ? `<span class="bet-chip">${p.bet}</span>` : ''}
        ${p.total !== null && p.cards.length ? `<span class="total${p.total > 7.5 ? ' bust' : ''}">${fmt(p.total)}</span>` : ''}
        ${badge}
      </div>
      ${canChallenge && p.inRound && !p.challenged ? `<button class="defy" data-challenge="${esc(p.name)}">Défier</button>` : ''}
    </div>`;
  }).join('');

  $('#center').textContent = {
    waiting: s.host === s.me ? 'Lance la partie dès que vous êtes 2' : `En attente de ${s.host}…`,
    betting: 'Faites vos jeux…',
    playing: s.turn === s.me ? 'À toi de jouer' : `Au tour de ${s.turn}`,
    banker: iAmBanker ? (bankerP.cards.length ? 'Tire ou défie un joueur' : 'Tire ta première carte') : 'Le banquier tire…',
    results: s.cancelled ? 'Manche annulée' : 'Fin de la manche',
  }[s.phase];

  const keptBet = $('#bet')?.value;
  let html = '';
  if (s.phase === 'waiting' && s.host === s.me) {
    const ready = s.players.filter(p => p.connected && p.chips > 0).length >= 2;
    html += `<button class="gold big" data-a="start" ${ready ? '' : 'disabled'}>Lancer la partie</button>`;
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
