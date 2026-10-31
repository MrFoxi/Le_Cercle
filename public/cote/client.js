// Interface du Demi-Cercle : écrans, thèmes, synchronisation avec le serveur, révélation animée.
/* global io */
import { createDial } from './dial.js';

const socket = io('/cote');
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);
let state = null, catalog = [], shown = '', toastTimer;

// Session : le jeton permet de retrouver sa place après un rechargement ou une coupure réseau.
const loadSession = () => { try { return JSON.parse(localStorage.getItem('cote-session')); } catch { return null; } };
const saveSession = s => { try { s ? localStorage.setItem('cote-session', JSON.stringify(s)) : localStorage.removeItem('cote-session'); } catch { /* stockage bloqué */ } };
const urlCode = new URLSearchParams(location.search).get('salon')?.toUpperCase();

// Le devineur envoie sa position au plus toutes les 50 ms, pour que les spectateurs voient l'aiguille bouger.
let aimTimer = null;
const dial = createDial($('#dial'), {
  onChange: v => {
    $('#readout').textContent = Math.round(v);
    aimTimer ??= setTimeout(() => {
      aimTimer = null;
      socket.emit('aim', Math.round(dial.value * 10) / 10);
    }, 50);
  },
});
socket.on('aim', v => {
  if (state?.spectator && state.phase === 'guess') dial.set(v, 'live');
});

function show(id) {
  for (const s of document.querySelectorAll('.screen')) s.hidden = s.id !== id;
}

function toast(text, ok = false) {
  const t = $('#toast');
  t.textContent = text;
  t.className = ok ? 'ok' : '';
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.hidden = true), 2800);
}

// Envoie une action ; le bouton reste grisé jusqu'à la réponse, pour éviter les doubles envois.
function act(button, ...args) {
  if (button) button.disabled = true;
  socket.emit('act', ...args, res => {
    if (res?.error) {
      toast(res.error);
      if (button) button.disabled = false;
    }
  });
}

/* ---------- Avant d'entrer dans un salon : pseudo, puis page principale ---------- */
let pseudo = (() => { try { return localStorage.getItem('cote-pseudo') || ''; } catch { return ''; } })();

// Sans pseudo, on commence par le choisir ; ensuite, page principale (lobbys, création, code).
function entry() {
  $('#meName').textContent = pseudo;
  $('#nameForm').pseudo.value = pseudo;
  show(pseudo ? 'home' : 'name');
}
$('#nameForm').onsubmit = e => {
  e.preventDefault();
  pseudo = e.target.pseudo.value.trim().slice(0, 20);
  if (!pseudo) return;
  try { localStorage.setItem('cote-pseudo', pseudo); } catch { /* stockage bloqué */ }
  entry();
};
$('#changeName').onclick = e => {
  e.preventDefault();
  show('name');
  $('#nameForm').pseudo.focus();
};

// Retour à la page principale, hors de tout salon.
function reset() {
  saveSession(null);
  state = null;
  document.body.classList.remove('in-room');
  history.replaceState(null, '', location.pathname);
  entry();
}
socket.on('closed', msg => {
  toast(msg);
  reset();
});

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
    // Un joueur qui part en pleine partie l'arrête pour l'autre : on confirme.
    const playing = state && !state.spectator && !['lobby', 'over'].includes(state.phase);
    if (playing && !confirm('Quitter la partie en cours ? Elle s’arrêtera pour ton adversaire.')) return;
    socket.emit('leave');
    reset();
  }
  const b = e.target.closest('[data-room]');
  if (b) enter('join', { code: b.dataset.room, name: pseudo, watch: b.dataset.mode === 'watch' }, b);
});

socket.on('session', s => {
  saveSession(s);
  history.replaceState(null, '', `?salon=${s.code}`);
});

// À chaque (re)connexion, on reprend sa place si on était dans ce salon ; un lien d'invitation préremplit le code.
entry();
socket.on('connect', () => {
  const s = loadSession();
  if (s && (!urlCode || urlCode === s.code)) {
    socket.emit('resume', s, res => {
      if (!res?.error) return;
      saveSession(null);
      toast(res.error);
      entry();
    });
  } else if (urlCode) {
    $('#joinForm').code.value = urlCode;
  }
});

// Lobbys publics visibles depuis la page principale (les privés n'y figurent pas).
socket.on('rooms', list => {
  const status = r => r.phase === 'lobby' ? (r.players.length < 2 ? 'Attend un adversaire' : 'Dans le lobby')
    : r.phase === 'over' ? 'Partie terminée' : `Manche ${r.round} / 10`;
  $('#rooms').innerHTML = list.length ? list.map(r => {
    const open = r.phase === 'lobby' && r.players.length < 2;
    return `<li>
      <div><b>${r.players.map(esc).join(' <span>vs</span> ')}</b><small>${status(r)}${r.spectators ? ` · 👁 ${r.spectators}` : ''}</small></div>
      ${open ? `<button class="gold small" data-room="${r.code}" data-mode="play">Rejoindre</button>` : ''}
      <button class="ghost small" data-room="${r.code}" data-mode="watch">👁 Regarder</button></li>`;
  }).join('') : '<li class="empty">Aucun lobby public pour l’instant. Crée le tien !</li>';
});

/* ---------- Thèmes ---------- */
socket.on('catalog', c => {
  catalog = c;
  const cats = [...new Set(c.map(t => t.category))];
  $('#themeList').innerHTML = cats.map(cat => `<fieldset data-category="${esc(cat)}">
      <legend><label><input type="checkbox" data-cat="${esc(cat)}"> ${esc(cat)}</label><small></small></legend>
      <div class="chips">${c.filter(t => t.category === cat).map(t =>
        `<label class="chip"><input type="checkbox" value="${t.id}"><span>${esc(t.name)}</span></label>`).join('')}</div>
    </fieldset>`).join('');
  if (state?.phase === 'lobby') renderThemes(state);
});

const send = ids => act(null, 'setThemes', ids);
$('#themeList').onchange = e => {
  const cat = e.target.dataset.cat;
  if (cat) {
    for (const i of $(`fieldset[data-category="${CSS.escape(cat)}"]`).querySelectorAll('.chips input')) i.checked = e.target.checked;
  }
  send([...document.querySelectorAll('#themeList .chips input:checked')].map(i => i.value));
};
$('#allThemes').onclick = () => send(catalog.map(t => t.id));
$('#noThemes').onclick = () => send([]);

let shownThemes = null; // thèmes affichés juste avant : ceux qui changent clignotent chez l'invité
function renderThemes(s) {
  const host = s.me === s.host, chosen = new Set(s.themes), before = shownThemes;
  shownThemes = chosen;
  $('#themeCount').textContent = chosen.size
    ? `${chosen.size} thème${chosen.size > 1 ? 's' : ''} sélectionné${chosen.size > 1 ? 's' : ''} sur ${catalog.length}`
    : 'Aucun thème sélectionné';
  document.querySelector('.themes-card').classList.toggle('readonly', !host);
  for (const fs of document.querySelectorAll('#themeList fieldset')) {
    const inputs = [...fs.querySelectorAll('.chips input')];
    let n = 0;
    for (const i of inputs) {
      i.checked = chosen.has(i.value);
      i.disabled = !host;
      const chip = i.closest('.chip');
      if (!host && before && before.has(i.value) !== i.checked) { chip.classList.remove('flash'); void chip.offsetWidth; chip.classList.add('flash'); }
      n += i.checked;
    }
    const all = fs.querySelector('[data-cat]');
    all.checked = n === inputs.length;
    all.indeterminate = n > 0 && n < inputs.length;
    all.disabled = !host;
    fs.querySelector('legend small').textContent = `${n} / ${inputs.length}`;
  }
}

/* ---------- Dans un salon ---------- */
socket.on('state', s => {
  state = s;
  document.body.classList.add('in-room');
  renderChat(s);
  if (s.phase === 'lobby') renderWait(s);
  else if (s.phase === 'over') renderResults(s);
  else renderGame(s);
});

$('#copyLink').onclick = () => {
  navigator.clipboard.writeText(`${location.origin}${location.pathname}?salon=${state.code}`)
    .then(() => toast('Lien copié : envoie-le à ton adversaire !', true), () => toast('Copie impossible'));
};
$('#startBtn').onclick = e => act(e.target, 'start');
$('#again').onclick = e => act(e.target, 'start');
$('#toLobby').onclick = e => act(e.target, 'toLobby');

const dot = p => `<span class="dot ${p.connected ? 'on' : 'off'}" title="${p.connected ? 'Connecté' : 'Déconnecté'}"></span>`;

function renderWait(s) {
  show('wait');
  shown = '';
  $('#waitCode').textContent = s.code;
  $('#waitPrivacy').textContent = s.private ? '🔒 Lobby privé : partage le code pour inviter' : '🌍 Lobby public : visible dans la liste';
  $('#notice').hidden = !s.notice;
  $('#notice').textContent = s.notice ?? '';
  const slots = [...s.players, null].slice(0, 2);
  $('#waitPlayers').innerHTML = slots.map(p => p
    ? `<li>${dot(p)}<b>${esc(p.name)}</b>${p.name === s.host ? '<small>créateur</small>' : ''}${p.name === s.me ? '<small>toi</small>' : ''}<span>${p.connected ? 'connecté' : 'déconnecté'}</span></li>`
    : '<li class="empty"><span class="dot wait"></span>En attente d’un adversaire…</li>').join('');
  const ready = s.players.length === 2 && s.players.every(p => p.connected);
  $('#waitWatchers').hidden = !s.spectators.length;
  $('#waitWatchers').textContent = `👁 Spectateurs : ${s.spectators.join(', ')}`;
  const b = $('#startBtn');
  b.hidden = s.spectator;
  b.disabled = !(ready && s.me === s.host && s.themes.length);
  b.textContent = s.me !== s.host ? `${s.host} va lancer la partie…` : !ready ? 'En attente du 2ᵉ joueur…' : !s.themes.length ? 'Choisis au moins un thème' : 'Commencer la partie';
  renderThemes(s);
}

function renderGame(s) {
  show('game');
  const c = s.current, giver = c.giver === s.me, watcher = s.spectator, key = `${s.round}-${s.phase}`;
  $('#watchBadge').hidden = !watcher;
  const fresh = key !== shown; // on entre dans une nouvelle étape (et pas une simple mise à jour)
  shown = key;

  s.players.forEach((p, i) => {
    $(`#p${i}`).className = `player ${p.role}${p.name === s.me ? ' me' : ''}`;
    $(`#p${i}`).innerHTML = `${dot(p)}<span class="name">${esc(p.name)}</span><b class="score">${p.score}</b>
      <small class="role">${p.role === 'giver' ? '✍️ donne l’indice' : '🎯 devine'}</small>`;
  });
  $('#roundNo').textContent = `${s.round} / ${s.rounds}`;
  $('#theme').textContent = c.theme;
  $('#clue').hidden = !c.clue;
  $('#clue').textContent = c.clue ?? '';

  const other = s.players.find(p => p.name !== s.me);
  const away = other && !other.connected ? ` (${other.name} est déconnecté, la partie reprendra à son retour)` : '';
  const panel = $('#panel');

  if (fresh && s.phase !== 'reveal') {
    if (s.phase === 'clue') dial.set(50, false);
    dial.setTarget(c.target); // visible seulement pour le donneur d'indice (le serveur l'envoie à lui seul)
  }
  // Le donneur ne voit l'aiguille qu'à la révélation ; les spectateurs la voient bouger en direct.
  dial.showNeedle(!giver || s.phase === 'reveal');
  dial.setInteractive(!giver && !watcher && s.phase === 'guess');
  $('#readout').hidden = !(s.phase === 'guess' && !giver && !watcher);
  $('#readout').textContent = Math.round(dial.value);

  if (s.phase === 'clue') {
    if (giver) {
      $('#status').innerHTML = `Ta position secrète : <b>${c.target}</b>. Donne un mot du thème qui correspond à cette position.`;
      if (fresh) {
        panel.innerHTML = `<form id="clueForm" class="clue-form">
          <input name="clue" maxlength="${s.maxClue}" required autocomplete="off" placeholder="Un mot ou un nom en rapport avec « ${esc(c.theme)} »">
          <div><small id="count">0 / ${s.maxClue}</small><button class="gold">Envoyer le mot</button></div></form>`;
        const f = $('#clueForm');
        f.clue.oninput = () => ($('#count').textContent = `${f.clue.value.length} / ${s.maxClue}`);
        f.onsubmit = e => {
          e.preventDefault();
          act(f.querySelector('button'), 'giveClue', s.round, f.clue.value);
        };
        f.clue.focus();
      }
    } else {
      $('#status').innerHTML = `<span class="typing">${esc(c.giver)} cherche un mot</span>${esc(away)}`;
      panel.innerHTML = '';
    }
  } else if (s.phase === 'guess') {
    if (giver || watcher) {
      $('#status').innerHTML = `<span class="typing">${esc(c.guesser)} place l’aiguille</span>${esc(away)}`;
      panel.innerHTML = '';
    } else {
      $('#status').textContent = `Où ${c.giver} classe ce mot, entre MAUVAIS et BON ? Fais glisser l’aiguille, puis valide.`;
      if (fresh) {
        panel.innerHTML = '<button class="gold big" id="guessBtn">Valider ma réponse</button>';
        $('#guessBtn').onclick = e => act(e.target, 'guess', s.round, dial.value);
      }
    }
  } else if (s.phase === 'reveal' && fresh) {
    // Révélation : l'aiguille se place sur la réponse, la roue tourne jusqu'au secret, puis le score apparaît.
    $('#status').textContent = 'La roue tourne…';
    panel.innerHTML = '';
    dial.set(c.guess);
    const round = s.round;
    dial.reveal(c.target, c.guess).then(() => {
      if (state?.round !== round || state.phase !== 'reveal') return; // déjà passé à la suite
      $('#status').textContent = '';
      const last = s.round === s.rounds;
      panel.innerHTML = `<div class="result pts${c.points}">
          <div><small>Réponse</small><b>${c.guess}</b></div>
          <div><small>Position secrète</small><b>${c.target}</b></div>
          <div><small>Écart</small><b>${c.diff}</b></div>
          <div class="won"><small>${esc(c.guesser)}</small><b>+${c.points}</b><small>point${c.points > 1 ? 's' : ''}</small></div>
        </div>
        ${watcher ? '<p class="hint">Les joueurs passent à la suite…</p>' : `<button class="gold" id="nextBtn">${last ? 'Voir les résultats' : 'Manche suivante'}</button>`}`;
      if (!watcher) $('#nextBtn').onclick = e => act(e.target, 'next', s.round);
    });
  }
}

function renderResults(s) {
  show('results');
  shown = '';
  const [a, b] = s.players;
  $('#winner').textContent = s.winner ? (s.winner === s.me ? '🏆 Tu as gagné !' : `🏆 ${s.winner} a gagné !`) : '🤝 Match nul !';
  $('#finalScores').innerHTML = [a, b].map(p =>
    `<div class="${p.name === s.winner ? 'win' : ''}"><span>${esc(p.name)}</span><b>${p.score}</b></div>`).join('<span class="vs">–</span>');
  const best = [...s.history].sort((x, y) => x.diff - y.diff || x.round - y.round).slice(0, 3);
  $('#best').innerHTML = best.map((h, i) => `<li><span class="medal">${['🥇', '🥈', '🥉'][i]}</span>
    <div><b>${esc(h.theme)} : « ${esc(h.clue)} »</b><small>${esc(h.giver)} → ${esc(h.guesser)}</small></div>
    <span class="gap">écart ${h.diff} · +${h.points}</span></li>`).join('');
  $('#summary').innerHTML = s.history.map(h => `<tr>
    <td>${h.round}</td><td>${esc(h.theme)}</td><td class="q">« ${esc(h.clue)} »<small>${esc(h.giver)} → ${esc(h.guesser)}</small></td>
    <td>${h.target}</td><td>${h.guess}</td><td>${h.diff}</td><td class="pts pts${h.points}">+${h.points}</td></tr>`).join('');
  const ready = s.players.length === 2 && s.players.every(p => p.connected);
  $('#again').disabled = !ready;
  $('#toLobby').disabled = false;
  $('#again').hidden = $('#toLobby').hidden = s.spectator;
}

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
