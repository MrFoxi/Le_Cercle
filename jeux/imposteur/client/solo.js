// L'Imposteur sur un seul appareil (soirée) : on se passe l'appareil pour les cartes et les votes secrets,
// les indices se disent à voix haute. Mêmes règles que le mode en ligne (engine.js = le moteur du serveur), tout se passe dans le navigateur.
import { Room, roleCounts, CATEGORIES, MIN_PLAYERS, MAX_PLAYERS } from './engine.js';
import { ROLE, esc, card, revealCard, tallyHtml, overHtml, cluesHtml } from './ui.js';

const $ = s => document.querySelector(s);
const store = {
  get: k => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* stockage bloqué */ } },
};
const DEFAULTS = new Room('X').settings;
let names = store.get('imp-solo-names') ?? [];
let settings = { ...DEFAULTS, ...store.get('imp-solo-settings') };
let room = null, holder = null, animKey = '', toastTimer;

function toast(text, ok = false) {
  const t = $('#toast');
  t.textContent = text;
  t.className = ok ? 'ok' : '';
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.hidden = true), 2400);
}
// Joue un coup sur le moteur ; une règle enfreinte s'affiche sans casser la partie.
function act(fn) {
  try { fn(); } catch (e) { toast(e.message); }
  render();
}
const show = id => { for (const s of document.querySelectorAll('.screen')) s.hidden = s.id !== id; window.scrollTo(0, 0); };

/* ---------- Préparation ---------- */
const OPTIONS = { rounds: [1, 2, 3, 4, 5, 6, 8, 10], impostors: [0, 1, 2, 3, 4], whites: [0, 1, 2, 3], discussion: [0, 30, 60, 90, 120, 180] };
const LABEL = { rounds: v => `${v} manche${v > 1 ? 's' : ''}`, impostors: String, whites: String, discussion: v => (v ? (v < 60 ? `${v} s` : `${v / 60} min${v % 60 ? ' 30' : ''}`) : 'Aucune (vote direct)') };
const plural = (n, w) => `${n} ${w}${n > 1 ? 's' : ''}`;

function renderSetup() {
  store.set('imp-solo-names', names);
  store.set('imp-solo-settings', settings);
  $('#names').innerHTML = names.map((n, i) => `<li><span class="avatar">${esc(n[0].toUpperCase())}</span><b>${esc(n)}</b><button type="button" class="ghost small" data-del="${i}" aria-label="Retirer ${esc(n)}">✕</button></li>`).join('')
    || '<li class="empty">Ajoutez au moins 3 joueurs.</li>';
  $('#addForm').hidden = names.length >= MAX_PLAYERS;
  const ok = names.length >= MIN_PLAYERS;
  $('#go').disabled = !ok;
  $('#go').textContent = ok ? `Lancer la partie (${names.length} joueurs)` : `Encore ${MIN_PLAYERS - names.length} joueur${MIN_PLAYERS - names.length > 1 ? 's' : ''}`;
  const f = $('#settings');
  for (const k of Object.keys(OPTIONS)) {
    f[k].innerHTML = OPTIONS[k].map(v => `<option value="${v}">${LABEL[k](v)}</option>`).join('');
    f[k].value = settings[k];
  }
  const n = Math.max(names.length, MIN_PLAYERS), c = roleCounts(n, settings);
  $('#split').innerHTML = `Avec <b>${n} joueurs</b> : ${[plural(c.civils, 'civil'), plural(c.impostors, 'imposteur'), c.whites ? `${c.whites} Mr. White` : ''].filter(Boolean).join(' · ')}`
    + (c.impostors !== settings.impostors || c.whites !== settings.whites ? '<small>Ajusté automatiquement pour que les civils restent majoritaires.</small>' : '');
  const on = new Set(settings.categories);
  $('#cats').innerHTML = CATEGORIES.map(c => `<label class="chip"><input type="checkbox" name="cat" value="${c.id}" ${on.has(c.id) ? 'checked' : ''}><span>${c.emoji} ${esc(c.name)}</span></label>`).join('');
}
$('#addForm').onsubmit = e => {
  e.preventDefault();
  const n = e.target.who.value.trim().slice(0, 20);
  if (!n) return;
  if (names.some(x => x.toLowerCase() === n.toLowerCase())) return toast('Ce prénom est déjà dans la liste');
  names.push(n);
  e.target.who.value = '';
  e.target.who.focus();
  renderSetup();
};
$('#names').onclick = e => {
  const d = e.target.closest('[data-del]');
  if (d) { names.splice(Number(d.dataset.del), 1); renderSetup(); }
};
$('#settings').onchange = e => {
  if (e.target.matches('select')) settings[e.target.name] = Number(e.target.value);
  else {
    const cats = [...$('#settings').querySelectorAll('[name="cat"]:checked')].map(c => c.value);
    if (!cats.length) { toast('Garde au moins une catégorie'); e.target.checked = true; return; }
    settings.categories = cats;
  }
  renderSetup();
};
$('#allCats').onclick = () => { settings.categories = CATEGORIES.map(c => c.id); renderSetup(); };
$('#noCats').onclick = () => { settings.categories = [CATEGORIES[0].id]; renderSetup(); };
$('#go').onclick = () => {
  room = new Room('SOLO');
  for (const n of names) room.addPlayer(n);
  act(() => { room.setSettings(names[0], settings); room.start(names[0]); });
};
$('#quit').onclick = () => {
  if (room.phase !== 'over' && !confirm('Quitter la partie en cours ?')) return;
  room = null;
  show('setup');
  renderSetup();
};

/* ---------- Partie ---------- */
const host = () => names[0];
const handoff = (who, text) => `<p class="pass">📱 Passe l’appareil à</p><p class="pass-name">${esc(who)}</p>
  <p class="hint">${text}</p><button class="gold big" data-me>Je suis ${esc(who)}</button>`;

function render() {
  if (!room) return;
  if (room.phase === 'lobby') { show('setup'); return renderSetup(); }
  show('play');
  const g = room.game, ph = room.phase, st = $('#stage');
  const key = `${room.round}|${g.tour}|${ph}|${g.out?.name}`, fresh = key !== animKey;
  animKey = key;
  $('#brand').textContent = `Manche ${room.round} / ${room.settings.rounds}${g.tour ? ` · Tour ${g.tour}` : ''}`;
  $('#timer').hidden = ph !== 'discussion';
  let title = '', hint = '';

  if (ph === 'reveal') {
    const who = g.order.find(n => !g.seen.includes(n));
    if (holder !== who) {
      title = 'Distribution des cartes';
      hint = `${g.seen.length} / ${g.alive.length} joueurs ont vu leur carte`;
      st.innerHTML = handoff(who, 'Les autres, on détourne les yeux !');
    } else {
      title = `${esc(who)}, voici ta carte`;
      hint = 'Touche la carte pour la retourner, mémorise-la, puis cache-la.';
      const role = g.roles[who];
      st.innerHTML = `${card(role === 'white' ? { role } : { role: 'word', word: g.words[role] }, false, 'big deal')}<button class="gold big" id="hide">J’ai mémorisé : cacher et passer</button>`;
      st.querySelector('.card3d').onclick = e => e.currentTarget.classList.toggle('flipped');
      $('#hide').onclick = () => act(() => { room.seenCard(who); holder = null; });
    }
  } else if (ph === 'clues') {
    title = `${esc(g.speaker)}, à toi de parler !`;
    hint = 'Donne ton indice à voix haute : un mot ou une courte expression, sans dire ton mot.';
    const next = g.order.slice(g.order.indexOf(g.speaker) + 1).find(n => g.alive.includes(n));
    st.innerHTML = `<p class="speaking-now"><span class="mic">🎙</span><b>${esc(g.speaker)}</b> donne son indice</p>
      <form class="clue-form" id="clueForm"><input name="clue" maxlength="30" autocomplete="off" placeholder="Noter l’indice (facultatif)" aria-label="Indice donné, facultatif">
      <button class="gold">Indice donné ✓</button></form>
      <p class="hint">${next ? `Ensuite : ${esc(next)}` : 'Dernier indice du tour, ensuite la discussion.'}</p>`;
    $('#clueForm').onsubmit = e => {
      e.preventDefault();
      const text = e.target.clue.value.trim();
      act(() => (text ? room.giveClue(g.speaker, text) : room.timeout())); // indice non noté : il a été dit à l'oral
    };
  } else if (ph === 'discussion') {
    title = 'Discussion';
    hint = 'Débattez à voix haute : qui a donné un indice bizarre ? Accusez, défendez-vous !';
    st.innerHTML = `<p class="talk">🗣 Tout le monde parle… puis on passe au vote secret.</p><button class="gold big" id="toVote">Passer au vote</button>`;
    $('#toVote').onclick = () => act(() => room.timeout());
  } else if (ph === 'vote') {
    const voter = g.alive.find(n => !(n in g.votes)), done = Object.keys(g.votes).length;
    const tie = g.revote && g.lastVote ? `<div class="tally">${tallyHtml(g.lastVote)}</div>` : '';
    if (holder !== voter) {
      title = g.revote ? 'Égalité : on revote !' : 'Vote secret';
      hint = g.revote ? `Départage ${g.candidates.map(esc).join(' et ')}. ${done} / ${g.alive.length} ont voté.` : `${done} / ${g.alive.length} ont voté. Les votes restent secrets jusqu’au dernier.`;
      st.innerHTML = (done ? '' : tie) + handoff(voter, 'Vote sans que les autres voient l’écran.');
    } else {
      title = `${esc(voter)}, qui veux-tu éliminer ?`;
      hint = 'Ton vote reste secret.';
      st.innerHTML = `<div class="vote-grid">${g.candidates.filter(n => n !== voter).map(n => `<button class="ghost big" data-vote="${esc(n)}">${esc(n)}</button>`).join('')}</div>`;
    }
  } else if (ph === 'guess') {
    title = 'Mr. White est démasqué !';
    hint = `${esc(g.out.name)}, prends l’appareil : devine le mot des civils pour gagner.`;
    st.innerHTML = `${revealCard(g.out, fresh)}<div class="tally">${tallyHtml(g.lastVote)}</div>
      <form class="clue-form" id="guessForm"><input name="word" maxlength="40" required autocomplete="off" placeholder="Le mot des civils est…" aria-label="Mot des civils"><button class="gold">Tenter ma chance</button></form>`;
    $('#guessForm').onsubmit = e => { e.preventDefault(); act(() => room.guess(g.out.name, e.target.word.value)); };
  } else if (ph === 'elim') {
    const o = g.out;
    title = o ? `${esc(o.name)} est éliminé` : 'Personne n’est éliminé';
    hint = o ? '' : 'L’égalité persiste : nouveau tour d’indices.';
    st.innerHTML = (o ? `${revealCard(o, fresh && o.guess === undefined)}
        <p class="verdict ${o.role === 'imposteur' ? 'good' : 'bad'}">${o.role === 'white' ? `${o.guess ? `Mr. White a proposé « ${esc(o.guess)} » : raté !` : 'Mr. White n’a rien proposé.'} Il est éliminé.`
          : o.role === 'civil' ? 'Aïe… c’était un civil innocent.' : 'Bien vu, c’était un imposteur !'}</p>` : '')
      + `<div class="tally">${tallyHtml(g.lastVote)}</div><button class="gold big" id="cont">Continuer</button>`;
    $('#cont').onclick = () => act(() => room.timeout());
  } else if (ph === 'over') {
    title = 'Fin de la manche';
    st.innerHTML = overHtml(room.viewFor(host()), true);
    $('#nextBtn').onclick = () => act(() => room.next(host()));
    $('#lobbyBtn').onclick = () => act(() => room.toLobby(host()));
  }

  $('#title').innerHTML = title;
  $('#hint').innerHTML = hint;
  // Autour de la table : qui parle, qui est éliminé (et son rôle, une fois révélé).
  $('#table').innerHTML = g.order.map(n => {
    const dead = !g.alive.includes(n), role = dead || ph === 'over' ? (g.elims.find(e => e.name === n)?.role ?? g.roles[n]) : null;
    const cls = ['seat', dead && 'dead', g.speaker === n && ph === 'clues' && 'speaking'].filter(Boolean).join(' ');
    return `<li><div class="${cls}"><span class="avatar">${esc(n[0].toUpperCase())}</span><span class="who"><b>${esc(n)}</b><small>${room.scores[n]} pt${room.scores[n] > 1 ? 's' : ''}</small></span>
      ${role ? `<span class="tag ${role}">${ROLE[role].label}</span>` : ''}</div></li>`;
  }).join('');
  $('#clues').hidden = !g.clues.some(c => c.text) || ph === 'reveal'; // indices tous dits à l'oral : rien à afficher
  $('#clues').innerHTML = cluesHtml(ph === 'over' ? room.viewFor(host()).game : g, '🗣 dit à l’oral');
}

$('#stage').addEventListener('click', e => {
  if (e.target.closest('[data-me]')) {
    const g = room.game;
    holder = room.phase === 'reveal' ? g.order.find(n => !g.seen.includes(n)) : g.alive.find(n => !(n in g.votes));
    render();
  }
  const v = e.target.closest('[data-vote]');
  if (v) {
    const voter = holder;
    holder = null;
    act(() => room.vote(voter, v.dataset.vote));
    if (room.phase === 'vote') toast('Vote enregistré, passe l’appareil', true);
  }
});

// Chrono de la discussion (indicatif : c'est le groupe qui décide quand voter).
let total = 1;
setInterval(() => {
  if (room?.phase !== 'discussion') return void (total = 0);
  const left = Math.max(0, room.deadline - Date.now());
  if (!total) total = left || 1;
  const t = $('#timer');
  t.querySelector('b').textContent = left ? `${Math.ceil(left / 1000)} s` : 'Temps écoulé : au vote !';
  t.querySelector('i').style.width = `${(left / total) * 100}%`;
  t.classList.toggle('hurry', left < 10000);
}, 250);

renderSetup();
