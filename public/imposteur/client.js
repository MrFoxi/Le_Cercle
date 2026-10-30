// Interface de L'Imposteur : pseudo, salons, réglages, cartes secrètes, indices, vote, révélations, fin de manche.
/* global io */
import { ROLE, esc, card, revealCard, tallyHtml, overHtml, cluesHtml } from './ui.js';

const socket = io('/imposteur');
const $ = s => document.querySelector(s);
let state = null, toastTimer, clockSkew = 0, phaseKey = '', stageKey = '', phaseTotal = 1;

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
  if (button) button.disabled = true;
  socket.emit('act', ...args, res => {
    if (button) button.disabled = false;
    if (res?.error) toast(res.error);
  });
}

/* ---------- Pseudo, page principale, salons ---------- */
let pseudo = store.get('imp-pseudo') || store.get('p4-pseudo') || store.get('cote-pseudo') || '';
function entry() {
  $('#meName').textContent = pseudo;
  $('#nameForm').pseudo.value = pseudo;
  show(pseudo ? 'home' : 'name');
}
$('#nameForm').onsubmit = e => {
  e.preventDefault();
  pseudo = e.target.pseudo.value.trim().slice(0, 20);
  if (!pseudo) return;
  store.set('imp-pseudo', pseudo);
  entry();
};
$('#changeName').onclick = e => {
  e.preventDefault();
  show('name');
  $('#nameForm').pseudo.focus();
};
function reset() {
  store.set('imp-session', null);
  state = null;
  phaseKey = '';
  document.body.classList.remove('in-room');
  $('#peek').hidden = true;
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
    const playing = state && state.game?.me && !['lobby', 'over'].includes(state.phase);
    if (playing && !confirm('Quitter la manche en cours ? Elle sera annulée pour tout le monde.')) return;
    socket.emit('leave');
    reset();
  }
  const b = e.target.closest('[data-room]');
  if (b) enter('join', { code: b.dataset.room, name: pseudo, watch: b.dataset.mode === 'watch' }, b);
});

socket.on('session', s => {
  store.set('imp-session', JSON.stringify(s));
  history.replaceState(null, '', `?salon=${s.code}`);
});
entry();
socket.on('connect', () => {
  let s = null;
  try { s = JSON.parse(store.get('imp-session')); } catch { /* session illisible */ }
  if (s && (!urlCode || urlCode === s.code)) {
    socket.emit('resume', s, res => {
      if (!res?.error) return;
      store.set('imp-session', null);
      toast(res.error);
      entry();
    });
  } else if (urlCode) {
    $('#joinForm').code.value = urlCode;
  }
});

const PHASE_NAME = { lobby: 'Dans le salon', reveal: 'Distribution des cartes', clues: 'Tour d’indices', discussion: 'Discussion', vote: 'Vote', guess: 'Mr. White devine', elim: 'Élimination', over: 'Manche terminée' };
socket.on('rooms', list => {
  $('#rooms').innerHTML = list.length ? list.map(r => {
    const open = r.players.length < 12;
    return `<li><div><b>${r.players.map(esc).join(', ')}</b><small>${r.players.length} joueur${r.players.length > 1 ? 's' : ''} · ${r.phase === 'lobby' ? 'Dans le salon' : `Manche ${r.round} · ${PHASE_NAME[r.phase] ?? ''}`}${r.spectators ? ` · 👁 ${r.spectators}` : ''}</small></div>
      ${open ? `<button class="gold small" data-room="${r.code}" data-mode="play">Rejoindre</button>` : ''}
      <button class="ghost small" data-room="${r.code}" data-mode="watch">👁 Regarder</button></li>`;
  }).join('') : '<li class="empty">Aucun salon public pour l’instant. Crée le tien !</li>';
});

/* ---------- Dans un salon ---------- */
socket.on('state', s => {
  state = s;
  clockSkew = s.now - Date.now();
  document.body.classList.add('in-room');
  renderChat(s);
  if (s.phase === 'lobby') renderLobby(s);
  else renderGame(s);
});

$('#copyLink').onclick = () => navigator.clipboard.writeText(`${location.origin}${location.pathname}?salon=${state.code}`)
  .then(() => toast('Lien copié : envoie-le à tes amis !', true), () => toast('Copie impossible'));
$('#startBtn').onclick = e => act(e.target, 'start');

const dot = p => `<span class="dot ${p.connected ? 'on' : 'off'}" title="${p.connected ? 'Connecté' : 'Déconnecté'}"></span>`;
const plural = (n, word) => `${n} ${word}${n > 1 && !word.startsWith('Mr') ? 's' : ''}`;
const split = c => [plural(c.civils, 'civil'), plural(c.impostors, 'imposteur'), c.whites ? `${c.whites} Mr. White` : ''].filter(Boolean).join(' · ');

// Réglages : l'hôte les modifie, les autres les voient en lecture seule.
const OPTIONS = { rounds: [1, 2, 3, 4, 5, 6, 8, 10], impostors: [0, 1, 2, 3, 4], whites: [0, 1, 2, 3] };
function sendSettings(patch) {
  act(null, 'setSettings', { ...state.settings, ...patch });
}
$('#settings').onchange = e => {
  const f = e.target.closest('form');
  if (e.target.matches('select')) return sendSettings({ [e.target.name]: Number(e.target.value) });
  sendSettings({ categories: [...f.querySelectorAll('[name="cat"]:checked')].map(c => c.value) });
};
$('#allCats').onclick = () => sendSettings({ categories: state.categories.map(c => c.id) });
$('#noCats').onclick = () => sendSettings({ categories: [state.categories[0].id] }); // au moins une catégorie reste cochée

function renderLobby(s) {
  show('wait');
  phaseKey = '';
  $('#peek').hidden = true;
  $('#waitCode').textContent = s.code;
  $('#waitPrivacy').textContent = s.private ? '🔒 Salon privé : partage le code pour inviter' : '🌍 Salon public : visible dans la liste';
  $('#notice').hidden = !s.notice;
  $('#notice').textContent = s.notice ?? '';
  $('#waitPlayers').innerHTML = s.players.map(p => `<li>${dot(p)}<b>${esc(p.name)}</b>${p.name === s.host ? '<small>hôte</small>' : ''}${p.name === s.me ? '<small>toi</small>' : ''}<span>${p.connected ? 'connecté' : 'déconnecté'}</span></li>`).join('')
    + (s.players.length < s.min ? `<li class="empty"><span class="dot wait"></span>Encore ${s.min - s.players.length} joueur${s.min - s.players.length > 1 ? 's' : ''} minimum…</li>` : '');
  $('#waitWatchers').hidden = !s.spectators.length;
  $('#waitWatchers').textContent = `👁 Spectateurs : ${s.spectators.join(', ')}`;
  const ready = s.players.length >= s.min && s.players.every(p => p.connected), b = $('#startBtn'), host = s.me === s.host;
  b.hidden = s.spectator;
  b.disabled = !(ready && host);
  b.textContent = !host ? `${s.host} va lancer la partie…` : ready ? `Lancer la partie (${s.players.length} joueurs)` : `Il faut ${s.min} joueurs connectés`;

  const f = $('#settings');
  f.classList.toggle('readonly', !host);
  $('#settingsWho').textContent = host ? 'Tu es l’hôte : choisis les règles de la partie.' : `Réglages choisis par ${s.host}.`;
  const sel = (name, values, label) => {
    f[name].innerHTML = values.map(v => `<option value="${v}">${label(v)}</option>`).join('');
    f[name].value = s.settings[name];
    f[name].disabled = !host;
  };
  sel('rounds', OPTIONS.rounds, v => `${v} manche${v > 1 ? 's' : ''}`);
  sel('impostors', OPTIONS.impostors, v => String(v));
  sel('whites', OPTIONS.whites, v => String(v));
  sel('discussion', s.discussions, v => (v ? `${v} s` : 'Aucune (vote direct)'));
  const n = Math.max(s.players.length, s.min);
  $('#split').innerHTML = `Avec <b>${n} joueurs</b> : ${split(s.counts)}`
    + (s.counts.impostors !== s.settings.impostors || s.counts.whites !== s.settings.whites ? '<small>Ajusté automatiquement pour que les civils restent majoritaires.</small>' : '');
  const on = new Set(s.settings.categories);
  $('#cats').innerHTML = s.categories.map(c => `<label class="chip"><input type="checkbox" name="cat" value="${c.id}" ${on.has(c.id) ? 'checked' : ''} ${host ? '' : 'disabled'}><span>${c.emoji} ${esc(c.name)}</span></label>`).join('');
}

/* ---------- Cartes ---------- */
$('#peekBtn').onclick = () => {
  $('#peekCard').innerHTML = card(state.game.me, false, 'big');
  $('#peek').hidden = false;
  requestAnimationFrame(() => requestAnimationFrame(() => $('#peekCard .card3d').classList.add('flipped')));
};
$('#peekClose').onclick = () => ($('#peek').hidden = true);

/* ---------- Partie ---------- */
const g = () => state.game;
const alive = n => g().alive.includes(n);
const roleOf = n => g().elims.find(e => e.name === n)?.role ?? g().reveal?.roles[n];

function renderGame(s) {
  show('game');
  const G = s.game, me = G.me, over = s.phase === 'over';
  const key = `${s.round}|${s.phase}|${G.tour}|${G.speaker}|${G.revote}|${G.out?.name}`;
  const fresh = key !== phaseKey;
  if (fresh) phaseTotal = Math.max(1, (s.deadline ?? 0) - s.now);
  phaseKey = key;

  $('#roundNo').textContent = `Manche ${s.round} / ${s.settings.rounds}`;
  $('#tourNo').textContent = G.tour ? ` · Tour ${G.tour}` : '';
  $('#peekBtn').hidden = !me || over;
  const watcher = s.spectator || !me;
  $('#watchBadge').hidden = over ? !!me && !s.spectator : !watcher && alive(s.me);
  $('#watchBadge').textContent = s.spectator ? '👁 Tu regardes cette partie en spectateur' : !me ? '⏳ Tu viens d’arriver : tu joueras à la prochaine manche' : '☠ Tu es éliminé : suis la fin de la manche et discute dans le chat';

  renderPhase(s);
  renderTable(s);
  renderStage(s, fresh);
  renderClues(s);
}

function renderPhase(s) {
  const G = s.game, me = s.me, out = G.out;
  const titles = {
    reveal: ['Découvre ta carte', 'Personne d’autre ne la voit. Retourne-la, mémorise ton mot, puis valide.'],
    clues: G.speaker === me ? ['À toi de parler !', 'Un seul indice, court, sans dire ton mot.'] : [`${esc(G.speaker)} donne son indice…`, 'Écoute bien : qui n’a pas le même mot que toi ?'],
    discussion: ['Discussion', 'Accusez, défendez-vous, posez des questions dans le chat. Le vote arrive.'],
    vote: G.revote ? ['Égalité : on revote !', `Départage ${G.candidates.map(esc).join(' et ')}. Les votes restent secrets jusqu’au dernier.`] : ['Vote secret', 'Clique sur le joueur que tu veux éliminer. Les votes sont révélés quand tout le monde a voté.'],
    guess: ['Mr. White est démasqué !', `${esc(out?.name)} a une dernière chance : deviner le mot des civils.`],
    elim: out ? [`${esc(out.name)} est éliminé`, ''] : ['Personne n’est éliminé', 'L’égalité persiste : nouveau tour d’indices.'],
    over: ['Fin de la manche', ''],
  };
  const [title, hint] = titles[s.phase] ?? ['', ''];
  $('#phaseTitle').innerHTML = title;
  $('#phaseHint').innerHTML = hint;
}

// Les joueurs autour de la table : qui parle, qui a vu sa carte, qui a voté, qui est éliminé (et son rôle).
function renderTable(s) {
  const G = s.game, canVote = s.phase === 'vote' && alive(s.me);
  const players = G.order.map(n => s.players.find(p => p.name === n) ?? { name: n, connected: false, score: 0, gone: true });
  $('#table').innerHTML = players.map(p => {
    const n = p.name, dead = !alive(n), role = dead || s.phase === 'over' ? roleOf(n) : null;
    const target = canVote && G.candidates.includes(n) && n !== s.me;
    const badge = s.phase === 'reveal' ? (G.seen.includes(n) ? '✓ prêt' : '…')
      : s.phase === 'discussion' && !dead ? (G.ready.includes(n) ? '✓ prêt à voter' : '')
      : s.phase === 'vote' && !dead ? (G.voted.includes(n) ? '✓ a voté' : 'vote…')
      : s.phase === 'clues' && G.speaker === n ? '🎙 parle' : '';
    const cls = ['seat', dead && 'dead', G.speaker === n && 'speaking', n === s.me && 'me', target && 'target', G.myVote === n && 'voted-for',
      s.phase === 'vote' && G.revote && !G.candidates.includes(n) && 'out-of-vote', role && `is-${role}`].filter(Boolean).join(' ');
    const inner = `<span class="avatar">${esc(n[0]?.toUpperCase())}</span>
      <span class="who"><b>${esc(n)}${n === s.me ? ' <small>(toi)</small>' : ''}</b><small>${dot(p)}${p.score} pt${p.score > 1 ? 's' : ''}</small></span>
      ${role ? `<span class="tag ${role}">${ROLE[role].label}</span>` : badge ? `<span class="badge">${badge}</span>` : ''}`;
    return `<li>${target ? `<button class="${cls}" data-vote="${esc(n)}" aria-label="Voter contre ${esc(n)}">${inner}</button>` : `<div class="${cls}">${inner}</div>`}</li>`;
  }).join('');
}
$('#table').onclick = e => {
  const b = e.target.closest('[data-vote]');
  if (b) act(null, 'vote', b.dataset.vote);
};

// Zone centrale : ce qu'il faut faire maintenant, selon l'étape.
function renderStage(s, fresh) {
  const G = s.game, me = G.me, st = $('#stage'), mine = alive(s.me);
  // Un message de chat ou un vote d'un autre ne redessine pas la zone (carte retournée, champ en cours de saisie) : seuls les compteurs bougent.
  const key = [phaseKey, G.myVote, G.seen.includes(s.me), G.ready.includes(s.me), G.out?.guess, s.host, s.players.map(p => p.score)].join('|');
  if (!fresh && key === stageKey) return updateCounts(s);
  stageKey = key;
  if (s.phase === 'reveal') {
    const done = G.seen.includes(s.me);
    st.innerHTML = me ? `${card(me, false, 'big deal')}
      <p class="tap" id="tapHint">${done ? '' : 'Touche la carte pour la retourner'}</p>
      <button class="gold big" id="seenBtn" ${done ? 'disabled' : ''}>${done ? 'En attente des autres…' : 'J’ai mémorisé ma carte'}</button>
      <p class="hint" data-count></p>` : '<p class="hint">Les joueurs découvrent leur carte…</p><p class="hint" data-count></p>';
    const c = st.querySelector('.card3d');
    if (c) {
      if (done) c.classList.add('flipped');
      c.onclick = () => { c.classList.toggle('flipped'); $('#tapHint').textContent = c.classList.contains('flipped') ? 'Touche encore pour la cacher' : 'Touche la carte pour la retourner'; };
    }
    $('#seenBtn')?.addEventListener('click', e => act(e.target, 'seenCard'));
  } else if (s.phase === 'clues') {
    st.innerHTML = G.speaker === s.me ? `<form class="clue-form" id="clueForm">
        <input name="clue" maxlength="30" required autocomplete="off" placeholder="${me.role === 'white' ? 'Improvise un indice…' : 'Ton indice (sans dire ton mot)'}" aria-label="Ton indice">
        <button class="gold">Donner mon indice</button></form>
        <p class="hint">${me.role === 'white' ? 'Tu es Mr. White : reste vague et colle aux indices des autres.' : 'Ton mot : <b class="gold-t">' + esc(me.word) + '</b>'}</p>`
      : `<p class="speaking-now"><span class="mic">🎙</span><b>${esc(G.speaker)}</b> réfléchit<span class="typing"></span></p>`;
    const f = $('#clueForm');
    if (f) {
      f.clue.focus();
      f.onsubmit = e => { e.preventDefault(); act(e.submitter, 'giveClue', f.clue.value); };
    }
  } else if (s.phase === 'discussion') {
    const ready = G.ready.includes(s.me);
    st.innerHTML = `<p class="talk">💬 Débattez dans le <b>chat</b> : qui a donné un indice bizarre ?</p>
      ${mine ? `<button class="${ready ? 'ghost' : 'gold'}" id="readyBtn">${ready ? 'Annuler : je veux encore discuter' : 'Je suis prêt à voter'}</button>` : ''}
      <p class="hint" data-count></p>`;
    $('#readyBtn')?.addEventListener('click', e => act(e.target, 'readyVote'));
  } else if (s.phase === 'vote') {
    const tie = G.revote && G.lastVote ? `<div class="tally">${tallyHtml(G.lastVote)}</div>` : '';
    st.innerHTML = `${tie}<p class="talk">${!mine ? 'Les joueurs en vie votent…' : G.myVote ? `Ton vote : <b class="gold-t">${esc(G.myVote)}</b> · tu peux changer d’avis tant que tout le monde n’a pas voté.` : '👆 Clique sur un joueur autour de la table pour voter contre lui.'}</p>
      <p class="hint" data-count></p>`;
  } else if (s.phase === 'guess') {
    st.innerHTML = `${revealCard(G.out, fresh)}${G.lastVote ? `<div class="tally">${tallyHtml(G.lastVote)}</div>` : ''}` + (G.out.name === s.me
      ? `<form class="clue-form" id="guessForm"><input name="word" maxlength="40" required autocomplete="off" placeholder="Le mot des civils est…" aria-label="Mot des civils">
          <button class="gold">Tenter ma chance</button></form>`
      : `<p class="speaking-now"><span class="mic">🤔</span><b>${esc(G.out.name)}</b> cherche le mot des civils<span class="typing"></span></p>`);
    const f = $('#guessForm');
    if (f) {
      if (fresh) setTimeout(() => f.word.focus(), 1600);
      f.onsubmit = e => { e.preventDefault(); act(e.submitter, 'guess', f.word.value); };
    }
  } else if (s.phase === 'elim') {
    const o = G.out;
    st.innerHTML = o ? `${revealCard(o, fresh && o.guess === undefined)}
        ${o.role === 'white' ? `<p class="verdict bad">${o.guess ? `Mr. White a proposé « ${esc(o.guess)} » : raté !` : 'Mr. White n’a rien proposé à temps.'} Il est éliminé.</p>`
          : `<p class="verdict ${o.role === 'civil' ? 'bad' : 'good'}">${o.role === 'civil' ? 'Aïe… c’était un civil innocent.' : 'Bien vu, c’était un imposteur !'}</p>`}
        ${G.lastVote ? `<div class="tally">${tallyHtml(G.lastVote)}</div>` : ''}`
      : `${G.lastVote ? `<div class="tally">${tallyHtml(G.lastVote)}</div>` : ''}<p class="talk">Personne n’est éliminé.</p>`;
  } else if (s.phase === 'over') {
    st.innerHTML = overHtml(s);
    $('#nextBtn')?.addEventListener('click', e => act(e.target, 'next'));
    $('#lobbyBtn')?.addEventListener('click', e => act(e.target, 'toLobby'));
  }
  updateCounts(s);
}

// Compteurs « 3 / 5 ont voté » mis à jour sans réécrire la zone.
function updateCounts(s) {
  const G = s.game, n = G.alive.length;
  const text = s.phase === 'reveal' ? `${G.seen.length} / ${n} joueurs ont vu leur carte`
    : s.phase === 'discussion' ? `${G.ready.length} / ${n} prêts à voter` : s.phase === 'vote' ? `${G.voted.length} / ${n} ont voté` : '';
  for (const el of document.querySelectorAll('[data-count]')) el.textContent = text;
}

// Les indices de la manche, tour par tour.
function renderClues(s) {
  $('#clues').hidden = !s.game.clues.length;
  $('#clues').innerHTML = cluesHtml(s.game, '— (temps écoulé)');
}

/* ---------- Chronomètre ---------- */
setInterval(() => {
  const t = $('#timer');
  if (!state?.deadline || state.phase === 'lobby' || $('#game').hidden) return void (t.hidden = true);
  const left = Math.max(0, state.deadline - (Date.now() + clockSkew));
  t.hidden = false;
  t.querySelector('b').textContent = `${Math.ceil(left / 1000)} s`;
  t.querySelector('i').style.width = `${Math.min(100, (left / phaseTotal) * 100)}%`;
  t.classList.toggle('hurry', left < 10000 && ['clues', 'discussion', 'vote', 'guess'].includes(state.phase));
}, 250);

/* ---------- Chat ---------- */
let chatSeen = 0;
function renderChat(s) {
  $('#chatWho').textContent = s.spectator ? '· tu es spectateur' : '';
  const last = s.chat.at(-1)?.id || 0;
  if (last === chatSeen && $('#chatMsgs').childElementCount) return;
  chatSeen = last;
  const box = $('#chatMsgs'), atBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 40;
  box.innerHTML = s.chat.length ? s.chat.map(m => `<div class="msg${m.name === s.me ? ' mine' : ''}">
      <b>${m.spectator ? '👁 ' : ''}${esc(m.name)}</b><span>${esc(m.text)}</span></div>`).join('')
    : '<p class="empty">Aucun message. Dis bonjour !</p>';
  if (atBottom) box.scrollTop = box.scrollHeight;
}
$('#chatForm').onsubmit = e => {
  e.preventDefault();
  socket.emit('chat', e.target.msg.value);
  e.target.msg.value = '';
};
