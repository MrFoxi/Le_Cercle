// Interface du Surcoté / Sous-coté : écrans, synchronisation avec le serveur, demi-cercle.
/* global io */
import { createDial } from './dial.js';

const socket = io('/cote');
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);
let state = null, shown = '', toastTimer;

// Session : le jeton permet de retrouver sa place après un rechargement ou une coupure réseau.
const loadSession = () => { try { return JSON.parse(localStorage.getItem('cote-session')); } catch { return null; } };
const saveSession = s => { try { s ? localStorage.setItem('cote-session', JSON.stringify(s)) : localStorage.removeItem('cote-session'); } catch { /* stockage bloqué */ } };
const urlCode = new URLSearchParams(location.search).get('salon')?.toUpperCase();

const dial = createDial($('#dial'), {
  onChange: v => { $('#readout').textContent = Math.round(v); },
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

/* ---------- Avant d'entrer dans un salon ---------- */
for (const f of ['#createForm', '#joinForm']) $(f).pseudo.value = localStorage.getItem('cote-pseudo') || '';
document.addEventListener('click', e => {
  const go = e.target.closest('[data-go]')?.dataset.go;
  if (go) {
    e.preventDefault();
    show(go);
    $(`#${go} input`)?.focus();
  }
  if (e.target.closest('[data-leave]')) {
    socket.emit('leave');
    saveSession(null);
    state = null;
    history.replaceState(null, '', location.pathname);
    show('home');
  }
});

function enter(event, payload, form) {
  const button = form.querySelector('button');
  button.disabled = true;
  try { localStorage.setItem('cote-pseudo', form.pseudo.value.trim()); } catch { /* stockage bloqué */ }
  socket.emit(event, payload, res => {
    button.disabled = false;
    if (res?.error) toast(res.error);
  });
}
$('#createForm').onsubmit = e => {
  e.preventDefault();
  enter('create', e.target.pseudo.value, e.target);
};
$('#joinForm').onsubmit = e => {
  e.preventDefault();
  enter('join', { code: e.target.code.value, name: e.target.pseudo.value }, e.target);
};
$('#joinForm').code.oninput = e => (e.target.value = e.target.value.toUpperCase());

socket.on('session', s => {
  saveSession(s);
  history.replaceState(null, '', `?salon=${s.code}`);
});

// À chaque (re)connexion, on reprend sa place si on était dans ce salon.
socket.on('connect', () => {
  const s = loadSession();
  if (s && (!urlCode || urlCode === s.code)) {
    socket.emit('resume', s, res => {
      if (!res?.error) return;
      saveSession(null);
      toast(res.error);
      show(urlCode ? 'join' : 'home');
    });
  } else if (urlCode) {
    $('#joinForm').code.value = urlCode;
    show('join');
  }
});

/* ---------- Dans un salon ---------- */
socket.on('state', s => {
  state = s;
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

const dot = p => `<span class="dot ${p.connected ? 'on' : 'off'}" title="${p.connected ? 'Connecté' : 'Déconnecté'}"></span>`;

function renderWait(s) {
  show('wait');
  $('#waitCode').textContent = s.code;
  $('#notice').hidden = !s.notice;
  $('#notice').textContent = s.notice ?? '';
  const slots = [...s.players, null].slice(0, 2);
  $('#waitPlayers').innerHTML = slots.map(p => p
    ? `<li>${dot(p)}<b>${esc(p.name)}</b>${p.name === s.host ? '<small>créateur</small>' : ''}${p.name === s.me ? '<small>toi</small>' : ''}<span>${p.connected ? 'connecté' : 'déconnecté'}</span></li>`
    : '<li class="empty"><span class="dot wait"></span>En attente d’un adversaire…</li>').join('');
  const ready = s.players.length === 2 && s.players.every(p => p.connected);
  const b = $('#startBtn');
  b.disabled = !(ready && s.me === s.host);
  b.textContent = s.me !== s.host ? `${s.host} va lancer la partie…` : ready ? 'Commencer la partie' : 'En attente du 2ᵉ joueur…';
}

function renderGame(s) {
  show('game');
  const c = s.current, giver = c.giver === s.me, key = `${s.round}-${s.phase}`;
  const fresh = key !== shown; // on entre dans une nouvelle étape (et pas une simple mise à jour)
  shown = key;

  s.players.forEach((p, i) => {
    $(`#p${i}`).className = `player ${p.role}${p.name === s.me ? ' me' : ''}`;
    $(`#p${i}`).innerHTML = `${dot(p)}<span class="name">${esc(p.name)}</span><b class="score">${p.score}</b>
      <small class="role">${p.role === 'giver' ? '✍️ donne l’indice' : '🎯 devine'}</small>`;
  });
  $('#roundNo').textContent = `${s.round} / ${s.rounds}`;
  $('#category').textContent = c.category;
  $('#subject').textContent = c.subject;
  $('#clue').hidden = !c.clue;
  $('#clue').textContent = c.clue ?? '';

  const other = s.players.find(p => p.name !== s.me);
  const away = other && !other.connected ? ` (${other.name} est déconnecté, la partie reprendra à son retour)` : '';
  const panel = $('#panel');

  if (fresh && s.phase === 'clue') {
    dial.set(50, false);
    dial.setTarget(null);
  }
  dial.setTarget(c.target, s.phase === 'reveal' && fresh);
  dial.showNeedle(!giver || s.phase === 'reveal');
  dial.setInteractive(!giver && s.phase === 'guess');
  $('#readout').hidden = !(s.phase === 'guess' && !giver);
  $('#readout').textContent = Math.round(dial.value);

  if (s.phase === 'clue') {
    if (giver) {
      $('#status').textContent = `Ta position secrète est ${c.target}. Écris un indice pour la faire deviner.`;
      if (fresh) {
        panel.innerHTML = `<form id="clueForm" class="clue-form">
          <textarea name="clue" maxlength="${s.maxClue}" rows="2" required placeholder="Ton indice, sans donner de chiffre…"></textarea>
          <div><small id="count">0 / ${s.maxClue}</small><button class="primary">Envoyer l’indice</button></div></form>`;
        const f = $('#clueForm');
        f.clue.oninput = () => ($('#count').textContent = `${f.clue.value.length} / ${s.maxClue}`);
        f.onsubmit = e => {
          e.preventDefault();
          act(f.querySelector('button'), 'giveClue', s.round, f.clue.value);
        };
        f.clue.focus();
      }
    } else {
      $('#status').innerHTML = `<span class="typing">${esc(c.giver)} écrit son indice</span>${esc(away)}`;
      panel.innerHTML = '';
    }
  } else if (s.phase === 'guess') {
    if (giver) {
      $('#status').innerHTML = `<span class="typing">${esc(c.guesser)} place l’aiguille</span>${esc(away)}`;
      panel.innerHTML = '';
    } else {
      $('#status').textContent = 'Fais glisser l’aiguille selon l’indice, puis valide.';
      if (fresh) {
        panel.innerHTML = '<button class="primary big" id="guessBtn">Valider ma réponse</button>';
        $('#guessBtn').onclick = e => act(e.target, 'guess', s.round, dial.value);
      }
    }
  } else if (s.phase === 'reveal') {
    $('#status').textContent = '';
    if (fresh) {
      dial.set(c.guess); // l'aiguille pivote jusqu'à la réponse donnée
      const last = s.round === s.rounds;
      panel.innerHTML = `<div class="result pts${c.points}">
          <div><small>Position secrète</small><b>${c.target}</b></div>
          <div><small>Réponse</small><b>${c.guess}</b></div>
          <div><small>Écart</small><b>${c.diff}</b></div>
          <div class="won"><small>${esc(c.guesser)}</small><b>+${c.points}</b><small>point${c.points > 1 ? 's' : ''}</small></div>
        </div>
        <button class="primary" id="nextBtn">${last ? 'Voir les résultats' : 'Manche suivante'}</button>`;
      $('#nextBtn').onclick = e => act(e.target, 'next', s.round);
    }
  }
}

function renderResults(s) {
  show('results');
  shown = '';
  const [a, b] = s.players;
  $('#winner').textContent = s.winner ? (s.winner === s.me ? '🏆 Tu as gagné !' : `🏆 ${s.winner} a gagné !`) : '🤝 Match nul !';
  $('#finalScores').innerHTML = [a, b].map(p =>
    `<div class="${p.name === s.winner ? 'win' : ''}"><span>${esc(p.name)}</span><b>${p.score}</b></div>`).join('<span class="vs">–</span>');
  $('#summary').innerHTML = s.history.map(h => `<tr>
    <td>${h.round}</td><td>${esc(h.subject)}</td><td class="q">« ${esc(h.clue)} »<small>${esc(h.giver)} → ${esc(h.guesser)}</small></td>
    <td>${h.target}</td><td>${h.guess}</td><td>${h.diff}</td><td class="pts pts${h.points}">+${h.points}</td></tr>`).join('');
  $('#again').disabled = !s.players.every(p => p.connected) || s.players.length < 2;
}
