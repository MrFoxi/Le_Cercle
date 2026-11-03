// Interface : écrans, branchement entre le quiz, la carte et les statistiques.
/* global topojson */
import { Quiz, MODES, CONTINENTS } from './quiz.js';
import { createMap } from './map.js';
import { loadStats, resetStats, recordGame, bestFor, loadSettings, saveSettings, modeKey } from './stats.js';

const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);
const clock = sec => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;

let settings = loadSettings();
let quiz = null, timer = null, startAt = 0, locked = false;

/* ---------- Données ---------- */
const topo = await (await fetch('countries.json')).json();
const features = topojson.feature(topo, topo.objects.countries).features;
const countries = features.filter(f => f.properties.q).map(f => ({ id: f.id, continent: f.properties.c }));
const props = new Map(features.map(f => [f.id, f.properties]));
const name = id => props.get(id)?.[settings.lang] || props.get(id)?.fr || id;

/* ---------- Écrans ---------- */
function show(id) {
  for (const s of document.querySelectorAll('.screen')) s.hidden = s.id !== id;
}

/* ---------- Menu ---------- */
$('#optScope').innerHTML = ['Monde', ...CONTINENTS].map(c => `<option>${c}</option>`).join('');
$('#modes').innerHTML = Object.entries(MODES).map(([key, m]) =>
  `<button role="radio" data-mode="${key}"><b>${m.label}</b><small>${m.desc}</small></button>`).join('');

const readOptions = () => ({ scope: $('#optScope').value, time: Number($('#optTime').value), lives: Number($('#optLives').value) });
function writeOptions(o) {
  $('#optScope').value = o.scope;
  $('#optTime').value = o.time;
  $('#optLives').value = o.lives;
  syncMenu();
}
// Le mode s'allume s'il correspond aux options ; en mode continent, n'importe quel continent convient.
function syncMenu() {
  const o = readOptions();
  for (const b of document.querySelectorAll('[data-mode]')) {
    const m = MODES[b.dataset.mode];
    const match = m.time === o.time && m.lives === o.lives && (b.dataset.mode === 'continent' ? o.scope !== 'Monde' : m.scope === o.scope);
    b.setAttribute('aria-checked', match);
  }
  const best = bestFor(o);
  $('#bestLine').textContent = best ? `Record pour ces réglages : ${best.points} pts · ${best.found}/${best.total} pays · ${best.accuracy} % · ${clock(best.seconds)}` : 'Pas encore de record pour ces réglages.';
  settings.options = o;
  saveSettings(settings);
}
$('#modes').onclick = e => {
  const key = e.target.closest('[data-mode]')?.dataset.mode;
  if (!key) return;
  const m = MODES[key];
  writeOptions({ ...m, scope: key === 'continent' && readOptions().scope !== 'Monde' ? readOptions().scope : m.scope });
};
for (const id of ['#optScope', '#optTime', '#optLives']) $(id).onchange = syncMenu;
writeOptions(settings.options || MODES.classic);

/* ---------- Carte ---------- */
const tip = $('#tip');
const map = createMap($('#map'), features, {
  onPick: pick,
  onHover(f, e) {
    // Le nom n'apparaît que pour ce qui est déjà découvert, pour ne pas donner la réponse.
    const known = f && quiz && (quiz.found.has(f.id) || quiz.skipped.includes(f.id));
    const label = !f ? '' : !f.properties.q ? `${name(f.id)} (territoire)` : known && settings.labels ? name(f.id) : '';
    tip.hidden = !label;
    if (!label) return;
    const r = $('.map-wrap').getBoundingClientRect();
    tip.textContent = label;
    tip.style.left = `${e.clientX - r.left}px`;
    tip.style.top = `${e.clientY - r.top}px`;
  },
});
$('.zoom').onclick = e => {
  const z = e.target.closest('[data-zoom]')?.dataset.zoom;
  if (z === 'in') map.zoomBy(1.8);
  if (z === 'out') map.zoomBy(1 / 1.8);
  if (z === 'reset') quiz && quiz.options.scope !== 'Monde' ? map.zoomToIds([...quiz.pool]) : map.reset();
};
$('#play').disabled = false;
$('#play').textContent = 'Jouer';

/* ---------- Partie ---------- */
function start(options) {
  quiz = new Quiz(countries, options);
  locked = false;
  $('#feedback').className = '';
  map.clear();
  map.setScope([...quiz.pool]);
  show('game');
  if (settings.autoZoom && options.scope !== 'Monde') map.zoomToIds([...quiz.pool]);
  else map.reset(0);
  $('#hLivesBox').hidden = !options.lives;
  startAt = performance.now();
  clearInterval(timer);
  timer = setInterval(tick, 250);
  ask();
}

function tick() {
  quiz.tick((performance.now() - startAt) / 1000);
  hud();
  if (quiz.over) end();
}

function hud() {
  $('#hScore').textContent = quiz.points;
  $('#hGood').textContent = quiz.correct;
  $('#hBad').textContent = quiz.wrong;
  $('#hLives').textContent = quiz.livesLeft ?? '';
  $('#hTime').textContent = clock(quiz.timeLeft ?? quiz.elapsed);
  $('#hTime').parentElement.classList.toggle('urgent', quiz.timeLeft !== null && quiz.timeLeft <= 10);
  $('#hProg').textContent = `${quiz.answered} / ${quiz.total}`;
  $('#bar').style.width = `${(quiz.answered / quiz.total) * 100}%`;
}

function ask() {
  hud();
  const t = $('#target');
  t.textContent = quiz.current ? name(quiz.current) : '';
  t.classList.remove('swap');
  void t.offsetWidth; // relance l'animation d'entrée
  t.classList.add('swap');
}

function feedback(text, kind) {
  const f = $('#feedback');
  f.textContent = text;
  f.className = '';
  void f.offsetWidth;
  f.className = `show ${kind}`;
}

// Verrou pendant les retours visuels : un même clic ne peut pas valider deux réponses.
function lockFor(ms, then) {
  const q = quiz;
  locked = true;
  setTimeout(() => {
    if (quiz !== q) return; // partie quittée ou relancée entre-temps
    locked = false;
    if (quiz.over) end();
    else then?.();
  }, ms);
}

function pick(id) {
  if (locked || !quiz || quiz.over) return;
  const result = quiz.answer(id);
  if (result === 'ignored') {
    if (quiz.found.has(id)) feedback(`${name(id)} est déjà trouvé`, 'info');
    return;
  }
  hud();
  if (result === 'correct') {
    map.setState(id, 'found');
    map.flash(id, 'good', 600);
    feedback(`Bravo ! ${name(id)}`, 'good');
    lockFor(500, ask);
  } else {
    map.flash(id, 'wrong', 700);
    feedback(`Raté : ça, c’est ${name(id)}`, 'bad');
    $('.question').classList.remove('shake');
    void $('.question').offsetWidth;
    $('.question').classList.add('shake');
    lockFor(300);
  }
}

$('#skip').onclick = () => {
  if (locked || !quiz?.current) return;
  const id = quiz.skip();
  map.setState(id, 'revealed');
  map.ping(id);
  feedback(`C’était ici : ${name(id)}`, 'info');
  hud();
  lockFor(900, ask);
};
$('#restart').onclick = () => start(quiz.options);
$('#quit').onclick = () => {
  clearInterval(timer);
  quiz = null;
  show('menu');
  syncMenu();
};

function end() {
  if (!quiz || $('#end').hidden === false) return;
  clearInterval(timer);
  const q = quiz, record = recordGame(q);
  $('#endTitle').textContent = { done: q.skipped.length ? 'Partie terminée !' : 'Bravo, tout est trouvé !', time: 'Temps écoulé !', lives: 'Plus d’essais !' }[q.reason];
  $('#endSub').textContent = settingsLabel(q.options);
  $('#endPoints').textContent = q.points;
  $('#newBest').hidden = !record;
  $('#eGood').textContent = q.correct;
  $('#eBad').textContent = q.wrong;
  $('#eAcc').textContent = `${q.accuracy} %`;
  $('#eFound').textContent = `${q.found.size} / ${q.total}`;
  $('#eSkip').textContent = q.skipped.length;
  $('#eTime').textContent = clock(q.elapsed);
  const review = [...new Set([...q.skipped, ...Object.keys(q.misses)])];
  $('#missedBox').hidden = !review.length;
  $('#missed').innerHTML = review.slice(0, 24).map(id => `<li>${esc(name(id))}</li>`).join('');
  showEndBoard(q);
  show('end');
}
$('#again').onclick = () => start(quiz.options);
$('#toMenu').onclick = $('#endBack').onclick = () => { quiz = null; show('menu'); syncMenu(); };
$('#play').onclick = () => start(readOptions());

/* ---------- Classement en ligne ---------- */
const settingsLabel = o => `${o.scope}${o.time ? ` · ${clock(o.time)}` : ''}${o.lives ? ` · ${o.lives} erreur${o.lives > 1 ? 's' : ''} max` : ''}`;
const boardHtml = (list, me) => list.length
  ? list.map(e => `<li class="${e.name === me ? 'me' : ''}"><b>${esc(e.name)}</b><span>${e.points} pts</span><small>${e.found}/${e.total} · ${clock(e.seconds)}</small></li>`).join('')
  : '<li class="empty">Personne pour l’instant : à toi de jouer !</li>';
async function fetchBoard(o) {
  const r = await fetch(`/api/pays/board?key=${encodeURIComponent(modeKey(o))}`);
  if (!r.ok) throw new Error();
  return r.json();
}
const loadPseudo = () => { try { return localStorage.getItem('pseudo') || ''; } catch { return ''; } };

let lastGame = null;
function showEndBoard(q) {
  lastGame = q;
  const ok = q.found.size > 0;
  $('#boardForm').hidden = !ok;
  $('#boardForm button').disabled = false;
  $('#boardName').value = loadPseudo();
  $('#boardMsg').textContent = ok ? '' : 'Trouve au moins un pays pour entrer au classement.';
  $('#endBoard').innerHTML = '';
  fetchBoard(q.options).then(list => { if (lastGame === q) $('#endBoard').innerHTML = boardHtml(list); })
    .catch(() => { $('#boardMsg').textContent = 'Classement indisponible pour le moment.'; });
}
$('#boardForm').onsubmit = async e => {
  e.preventDefault();
  const q = lastGame, pseudo = $('#boardName').value.trim();
  if (!q || !pseudo) return;
  try { localStorage.setItem('pseudo', pseudo); } catch { /* stockage bloqué */ }
  $('#boardForm button').disabled = true;
  try {
    const r = await fetch('/api/pays/board', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: modeKey(q.options), name: pseudo, points: q.points, found: q.found.size, total: q.total, seconds: Math.round(q.elapsed) }),
    });
    const res = await r.json();
    if (!r.ok) throw new Error(res.error);
    $('#endBoard').innerHTML = boardHtml(res.board, pseudo);
    $('#boardMsg').textContent = res.improved ? `Tu es ${res.place === 1 ? '1er' : `${res.place}e`} du classement !`
      : res.place ? `Ton meilleur score reste devant (${res.place}e place).` : 'Pas assez pour entrer dans le top 10, retente ta chance !';
    $('#boardForm').hidden = true;
  } catch (err) {
    $('#boardMsg').textContent = err.message || 'Envoi impossible, réessaie.';
    $('#boardForm button').disabled = false;
  }
};
$('#openBoard').onclick = () => {
  const o = readOptions();
  $('#boardDlgSub').textContent = settingsLabel(o);
  $('#dlgBoard').innerHTML = '<li class="empty">Chargement…</li>';
  fetchBoard(o).then(list => { $('#dlgBoard').innerHTML = boardHtml(list, loadPseudo()); })
    .catch(() => { $('#dlgBoard').innerHTML = '<li class="empty">Classement indisponible pour le moment.</li>'; });
  $('#boardDlg').showModal();
};

/* ---------- Statistiques ---------- */
const optionsLabel = key => {
  const [scope, time, lives] = key.split('|').map((v, i) => (i ? Number(v) : v));
  return [scope, time ? `chrono ${clock(time)}` : 'sans chrono', lives ? `${lives} erreur${lives > 1 ? 's' : ''} max` : ''].filter(Boolean).join(' · ');
};
$('#openStats').onclick = () => {
  const s = loadStats(), total = s.correct + s.wrong;
  const best = Object.entries(s.best).sort((a, b) => b[1].points - a[1].points);
  const missed = Object.entries(s.misses).sort((a, b) => b[1] - a[1]).slice(0, 5);
  $('#statsBody').innerHTML = `
    <div class="grid">
      <div><dt>Parties</dt><dd>${s.games}</dd></div>
      <div><dt>Pays trouvés</dt><dd>${s.found}</dd></div>
      <div><dt>Réussite</dt><dd>${total ? Math.round((s.correct / total) * 100) : 0} %</dd></div>
      <div><dt>Temps de jeu</dt><dd>${clock(s.seconds)}</dd></div>
    </div>
    <h3>Records</h3>
    ${best.length ? `<table><tr><th>Réglages</th><th>Points</th><th>Pays</th><th>Temps</th></tr>${best.map(([k, b]) =>
      `<tr><td>${esc(optionsLabel(k))}</td><td>${b.points}</td><td>${b.found}/${b.total}</td><td>${clock(b.seconds)}</td></tr>`).join('')}</table>` : '<p class="sub">Aucune partie terminée pour l’instant.</p>'}
    ${missed.length ? `<h3>Pays qui te résistent</h3><ol>${missed.map(([id, n]) => `<li>${esc(name(id))} <small>(${n})</small></li>`).join('')}</ol>` : ''}`;
  $('#statsDlg').showModal();
};

/* ---------- Paramètres ---------- */
$('#openSettings').onclick = () => {
  $('#setLang').value = settings.lang;
  $('#setLabels').checked = settings.labels;
  $('#setZoom').checked = settings.autoZoom;
  $('#settingsDlg').showModal();
};
$('#settingsDlg').onchange = () => {
  settings = { ...settings, lang: $('#setLang').value, labels: $('#setLabels').checked, autoZoom: $('#setZoom').checked };
  saveSettings(settings);
};
$('#resetStats').onclick = () => {
  if (!confirm('Effacer toutes les statistiques et tous les records ?')) return;
  resetStats();
  syncMenu();
};

