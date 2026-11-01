// Little District : boucle de jeu, interface, sauvegarde. La logique est dans sim.js, la maquette dans world.js.
import * as S from './sim.js';
import { createWorld, nightOf } from './world.js';
import { isOpen } from './people.js';
import { KANJI } from './models.js';
import { startAudio, setVolumes, setAmbience, sound, thunder } from './audio.js';
import { createCinema } from './cinema.js';

const { BUILDINGS, DECOR, PLOTS, SECTORS, OBJECTIVES, CATS, LEVEL_TEXT, MAX_LEVEL, money } = S;
const $ = id => document.getElementById(id);
const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const LOW = matchMedia('(pointer: coarse)').matches || /[?&](low|mobile)/.test(location.search);
const ICON = { ramen: '🍜', street: '🐙', cafe: '☕', konbini: '🏪', appart: '🏢', fleurs: '💐', pain: '🥐', maison: '🏠', livres: '📚', sushi: '🍣', bar: '🏮', karaoke: '🎤', mode: '👘', immeuble: '🏬', arcade: '🕹️', hotel: '🛏️', ryotei: '🍱' };
const DICON = { plante: '🪴', caisses: '📦', banc: '🪑', velo: '🚲', lampe: '💡', bambou: '🎋', toro: '🏮', panneau: '🪧', bonsai: '🌳', vending: '🥤', cerisier: '🌸', erable: '🍁', torii: '⛩️', puits: '🚰', neko: '🐱', sakura: '🌸', jizo: '🗿', kiosque: '🛖', fontaine: '⛲' };
const WEATHER = { soleil: '☀️ Soleil', nuages: '☁️ Nuageux', pluie: '🌧 Pluie', orage: '⛈ Orage', neige: '❄️ Neige', brouillard: '🌫 Brouillard' };
const SEASONS = { printemps: '🌸 Printemps', ete: '🎐 Été', automne: '🍁 Automne', hiver: '⛄ Hiver' };
const TIMES = { auto: 'Cycle naturel', matin: 'Matin', aprem: 'Après-midi', soir: 'Soirée', nuit: 'Nuit' };
const TIME_HOUR = { matin: 8.5, aprem: 14, soir: 19.3, nuit: 23 };
const DISTRICTS = [['Quartier japonais', true], ['Quartier moderne', false], ['Village côtier', false], ['Vieille ville européenne', false], ['Quartier futuriste', false], ['Quartier méditerranéen', false]];
const DAY_LENGTH = 1200; // une journée du quartier = 20 minutes

// ---------- Sauvegarde ----------
let state = (() => { try { return S.load(localStorage.getItem(S.SAVE_KEY)); } catch { return null; } })();
const fresh = !state;
state ||= S.newState();
let away = fresh ? null : S.offline(state);
function save() {
  state.savedAt = Date.now();
  try { localStorage.setItem(S.SAVE_KEY, JSON.stringify(state)); } catch { /* stockage plein ou bloqué : on continue sans */ }
}
addEventListener('pagehide', save);
let hiddenAt = 0;
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { save(); hiddenAt = Date.now(); return; }
  // Onglet resté en arrière-plan : on compte ce temps comme une absence
  const sum = hiddenAt && Date.now() - hiddenAt > 60000 ? S.offline(state) : null;
  hiddenAt = 0;
  if (sum) toast(`Pendant ton absence : +${money(sum.money)} ¥ et ${money(sum.clients)} clients`);
});

// ---------- Monde ----------
const world = createWorld($('scene'), { low: LOW || state.settings.quality === 'low' });
world.resize();
addEventListener('resize', world.resize);
const start = PLOTS[S.START_PLOT];
// Plan d'ensemble de la maquette à l'arrivée, puis on s'approche du restaurant
world.controls.target.set(0, 0, 0);
world.camera.position.set(22, 26, 30);
world.onThunder = thunder;
world.onSound = sound;
const cinema = createCinema(world, { fade: $('fade'), label: $('shot') });
await document.fonts.load(`800 40px ${KANJI}`, '麺処龍寿司').catch(() => {}); // les enseignes sont peintes avec cette police
world.sync(state);
setVolumes({ music: state.settings.music, sfx: state.settings.sfx });
world.setTilt(state.settings.tilt !== false);

// Pièces qui montent au-dessus d'un commerce quand un client paie
let floaters = 0;
world.onPay = (i, pos) => {
  const p = state.plots[i];
  if (!p || floaters > 6 || document.body.classList.contains('photo')) return;
  const v = pos.clone().project(world.camera);
  if (Math.abs(v.x) > 1 || Math.abs(v.y) > 1 || v.z > 1) return;
  const el = document.createElement('div');
  el.className = 'coin';
  el.textContent = `+${money(BUILDINGS[p.type].ticket * S.multiplier(state))} ¥`;
  el.style.left = `${(v.x * 0.5 + 0.5) * innerWidth}px`; el.style.top = `${(-v.y * 0.5 + 0.5) * innerHeight}px`;
  $('floaters').append(el); floaters++;
  setTimeout(() => { el.remove(); floaters--; }, 1600);
  if (Math.random() < 0.3) sound('coin');
};

// ---------- Heure, météo, saison ----------
let hour = state.hour, weather = 'soleil', weatherT = 120, lastWeather = 'soleil';
const autoSeason = () => ['hiver', 'hiver', 'printemps', 'printemps', 'printemps', 'ete', 'ete', 'ete', 'automne', 'automne', 'automne', 'hiver'][new Date().getMonth()];
const season = () => (state.settings.season === 'auto' ? autoSeason() : state.settings.season);
function nextWeather() {
  const w = { printemps: { soleil: 4, nuages: 3, pluie: 3, brouillard: 1 }, ete: { soleil: 6, nuages: 2, pluie: 2, orage: 1.5 }, automne: { soleil: 3, nuages: 3, pluie: 4, brouillard: 2, orage: 0.5 }, hiver: { soleil: 3, nuages: 3, neige: 4, brouillard: 1.5 } }[season()];
  let r = Math.random() * Object.values(w).reduce((a, b) => a + b, 0);
  for (const [k, v] of Object.entries(w)) if ((r -= v) < 0) return k;
  return 'soleil';
}
if (!fresh) weather = nextWeather();
const curWeather = () => (state.settings.weather === 'auto' ? weather : state.settings.weather);

// ---------- Interface ----------
let mode = 'view', sel = null, buildType = null, movingFrom = null, decorId = null, decorRot = 0, movingDecor = -1, panel = null;
const panelEl = $('panel'), tipEl = $('tip');

function toast(text) {
  const t = $('toast');
  t.textContent = text; t.hidden = false;
  t.style.animation = 'none'; void t.offsetWidth; t.style.animation = '';
  clearTimeout(toast.h); toast.h = setTimeout(() => (t.hidden = true), 3200);
}
function setMode(m, opts = {}) {
  mode = m;
  ({ buildType = null, movingFrom = null, decorId = null } = opts);
  movingDecor = opts.movingDecor ?? -1;
  $('buildBtn').classList.toggle('on', m === 'build' || m === 'move');
  $('decoBtn').classList.toggle('on', m === 'decor' || m === 'erase');
  world.setGhost(null);
  refreshRings();
  if (m === 'build' && buildType) tip(`Choisis une parcelle libre pour : ${BUILDINGS[buildType].name}`);
  else if (m === 'move') tip(`Où déplacer : ${BUILDINGS[state.plots[movingFrom].type].name} ? (échange possible)`);
  else if (m === 'decor') tip(movingDecor >= 0 ? `Nouvel emplacement pour : ${DECOR[decorId].name}` : `Pose : ${DECOR[decorId].name} (${DECOR[decorId].cost ? DECOR[decorId].cost + ' ¥' : 'offert'})`, true);
  else if (m === 'erase') tip('Touche une décoration pour la ranger (moitié du prix rendue)');
  else tip(null);
}
function tip(text, rotate) {
  tipEl.hidden = !text;
  if (!text) return;
  tipEl.innerHTML = `<span>${esc(text)}</span>${rotate ? '<button id="rotBtn">↻ Tourner</button>' : ''}<button id="cancelBtn">Terminer</button>`;
  $('cancelBtn').onclick = () => setMode('view');
  if (rotate) $('rotBtn').onclick = () => { decorRot += Math.PI / 4; sound('click'); };
}
function refreshRings() {
  const m = new Map();
  if (mode === 'build' || mode === 'move') PLOTS.forEach((p, i) => { if (state.sectors[p.sector] && (!state.plots[i] || mode === 'move') && i !== movingFrom) m.set(i, state.plots[i] ? '#ffd28a' : '#9cffb8'); });
  if (mode === 'move' && movingFrom != null) m.set(movingFrom, '#ffffff');
  if (mode === 'view' && sel != null) m.set(sel, '#ffd28a');
  world.highlight(m);
}

function open(kind, arg) {
  panel = { kind, arg };
  panelEl.hidden = false;
  render();
}
function close() { panel = null; panelEl.hidden = true; sel = null; refreshRings(); }

// Contenu du panneau, redessiné quand l'argent change
let holding = false; // ne pas redessiner sous le doigt : le clic serait perdu
panelEl.addEventListener('pointerdown', () => (holding = true));
addEventListener('pointerup', () => setTimeout(() => (holding = false), 0));
function render(auto) {
  if (!panel || (auto && (holding || panel.kind === 'settings'))) return;
  const html = { building, lot, sale, build: buildList, decor: decorList, goals, settings, decorItem }[panel.kind](panel.arg);
  if (html !== panel.html) { panelEl.innerHTML = `<button class="close" aria-label="Fermer">✕</button>${html}`; panel.html = html; wire(); }
}
const cost = n => `${money(n)} ¥`;
function building(i) {
  const p = state.plots[i];
  if (!p) return lot(i);
  const b = BUILDINGS[p.type], info = world.plots[i].info, o = isOpen(p.type, hour);
  const up = p.level < MAX_LEVEL ? S.upgradeCost(p.type, p.level) : 0;
  const home = b.cat === 'home';
  return `<h2>${ICON[p.type]} ${esc(b.name)}${home ? '' : `<span class="status ${o ? '' : 'off'}">${o ? 'Ouvert' : 'Fermé'}</span>`}</h2>
    <p class="sub">${esc(b.desc)}</p>
    <div class="stars">${Array.from({ length: MAX_LEVEL }, (_, k) => `<i class="${k < p.level ? 'on' : ''}"></i>`).join('')}</div>
    <div class="stats">
      <div><small>Niveau</small><b>${p.level} / ${MAX_LEVEL}</b></div>
      <div><small>Revenus</small><b>${money(S.incomeOf(state, i) * 60)} ¥/min</b></div>
      ${home ? `<div><small>Habitants</small><b>${b.home * p.level}</b></div><div><small>Bonus au quartier</small><b>+${b.home * p.level * 2} %</b></div>`
        : `<div><small>Clients servis</small><b>${money(p.served)}</b></div><div><small>Places · personnel</small><b>${info?.seats.length ?? 0} · ${info?.staff.length ?? 0}</b></div>`}
    </div>
    ${p.level < MAX_LEVEL ? `<div class="next"><small>Niveau ${p.level + 1}</small>${esc(home ? homeText(p.level + 1) : LEVEL_TEXT[p.level + 1])} · +${money((S.levelIncome(p.type, p.level + 1) - S.levelIncome(p.type, p.level)) * S.multiplier(state) * 60)} ¥/min</div>
      <div class="actions"><button class="primary" data-act="upgrade" ${state.money < up ? 'disabled' : ''}>Améliorer · ${cost(up)}</button></div>`
      : '<div class="next"><small>Niveau maximum</small>Ce bâtiment est au sommet du quartier.</div>'}
    <div class="actions"><button class="ghost" data-act="move">↔ Déplacer</button><button class="ghost" data-act="look">🔍 Regarder</button></div>`;
}
const homeText = l => ({ 2: 'Une famille de plus', 3: 'Lanternes et jardinet', 4: 'Un étage de plus (immeuble)', 5: 'Un étage de plus', 6: 'Lanterne de pierre au jardin', 7: 'Encore un étage (immeuble)', 8: 'Un érable dans le jardin', 9: 'Plus d’habitants', 10: 'Le plus bel immeuble du quartier' })[l];
function lot(i) {
  return `<h2>Parcelle libre</h2><p class="sub">${esc(SECTORS[PLOTS[i].sector].name)} · choisis ce que tu veux y construire.</p>${buildList(i)}`;
}
function sale(i) {
  const k = PLOTS[i].sector, sec = SECTORS[k], n = PLOTS.filter(p => p.sector === k).length;
  return `<h2>売地 · ${esc(sec.name)}</h2><p class="sub">${n} parcelles à vendre. Agrandis ton quartier.</p>
    <div class="actions"><button class="primary" data-act="sector" data-k="${k}" ${state.money < sec.cost ? 'disabled' : ''}>Acheter · ${cost(sec.cost)}</button></div>
    ${state.money < sec.cost ? `<p class="hint">Encore ${cost(sec.cost - state.money)} à réunir. Ton quartier gagne ${money(S.totalIncome(state) * 60)} ¥ par minute, même quand tu n’es pas là.</p>` : ''}`;
}
let buildTab = 'food';
function buildList(plot) {
  const types = Object.values(BUILDINGS).filter(b => b.cat === buildTab && b.id !== 'ramen' || (buildTab === 'food' && b.id === 'ramen' && !state.plots.some(p => p?.type === 'ramen')));
  return `${plot === undefined ? '<h2>Construire</h2><p class="sub">Choisis un bâtiment, puis une parcelle libre.</p>' : ''}
    <div class="tabs">${Object.entries(CATS).map(([k, v]) => `<button data-tab="${k}" class="${k === buildTab ? 'on' : ''}">${v}</button>`).join('')}</div>
    <div class="cards">${types.map(b => {
      const ok = S.unlocked(state, b.id), rate = S.levelIncome(b.id, 1) * S.multiplier(state) * 60;
      return `<button data-build="${b.id}" ${plot !== undefined ? `data-plot="${plot}"` : ''} class="${ok ? '' : 'locked'} ${buildType === b.id ? 'sel' : ''}" ${ok && state.money >= b.cost ? '' : 'disabled'}>
        <span class="ico">${ICON[b.id]}</span><b>${esc(b.name)}</b><small>${b.home ? `${b.home} habitants · ` : ''}+${money(rate)} ¥/min</small>
        <span class="price">${ok ? (b.cost ? cost(b.cost) : 'Gratuit') : `🔒 à ${money(b.need)} ¥ gagnés`}</span></button>`;
    }).join('')}</div>
    <p class="hint">Tu as gagné ${money(state.earned)} ¥ en tout. De nouveaux bâtiments se débloquent au fil de tes gains.</p>`;
}
function decorList() {
  const ids = Object.keys(DECOR);
  return `<h2>Décorer</h2><p class="sub">Chaque décoration rend le quartier plus charmant : +${Math.round(S.charm(state) * 100)} % de revenus (max 30 %).</p>
    <div class="cards">${ids.map(id => {
      const d = DECOR[id], ok = !d.rare || state.rare.includes(id);
      return `<button data-decor="${id}" class="${ok ? '' : 'locked'} ${decorId === id ? 'sel' : ''}" ${ok && state.money >= d.cost ? '' : 'disabled'}>
        <span class="ico">${DICON[id]}</span><b>${esc(d.name)}</b><span class="price">${ok ? (d.cost ? cost(d.cost) : '✨ Offert') : '🔒 Objectif'}</span></button>`;
    }).join('')}</div>
    <div class="actions"><button class="ghost" data-act="erase">🧹 Ranger des décorations</button></div>`;
}
function decorItem(k) {
  const d = state.decor[k];
  if (!d) return '<h2>Décoration</h2>';
  return `<h2>${DICON[d.id]} ${esc(DECOR[d.id].name)}</h2><p class="sub">${DECOR[d.id].rare ? 'Décoration rare, gagnée avec un objectif.' : 'Petit détail qui donne vie à la rue.'}</p>
    <div class="actions"><button data-act="drot">↻ Tourner</button><button data-act="dmove">↔ Déplacer</button></div>
    <div class="actions"><button class="ghost" data-act="dremove">Ranger${DECOR[d.id].cost ? ` (+${Math.floor(DECOR[d.id].cost / 2)} ¥)` : ''}</button></div>`;
}
function goals() {
  const list = OBJECTIVES.map(o => {
    const got = state.claimed.includes(o.id), cur = S.progress(state, o), ok = cur >= o.goal;
    const reward = [o.reward.money && `${money(o.reward.money)} ¥`, o.reward.decor && `${DICON[o.reward.decor]} ${DECOR[o.reward.decor].name}`].filter(Boolean).join(' + ');
    return { got, ok, html: `<div class="goal ${got ? 'claimed' : ok ? 'done' : ''}"><p>${esc(o.text)}<small>${esc(reward)}</small></p>
      <div class="bar"><i style="width:${(cur / o.goal) * 100}%"></i></div>${ok && !got ? `<button class="primary" data-claim="${o.id}">Récupérer</button>` : ''}</div>` };
  });
  const order = [...list.filter(g => g.ok && !g.got), ...list.filter(g => !g.ok).slice(0, 6), ...list.filter(g => g.got)];
  return `<h2>Objectifs</h2><p class="sub">Des idées pour faire grandir le quartier, à ton rythme. Aucun n’est obligatoire.</p>${order.map(g => g.html).join('')}`;
}
function settings() {
  const sel = (key, opts) => `<select data-set="${key}">${Object.entries(opts).map(([k, v]) => `<option value="${k}" ${state.settings[key] === k ? 'selected' : ''}>${v}</option>`).join('')}</select>`;
  return `<h2>Réglages</h2>
    <h3>Son</h3>
    <div class="row">🎵 Musique<input type="range" min="0" max="1" step="0.05" value="${state.settings.music}" data-vol="music"></div>
    <div class="row">🔊 Ambiance et effets<input type="range" min="0" max="1" step="0.05" value="${state.settings.sfx}" data-vol="sfx"></div>
    <h3>Ambiance</h3>
    <div class="row">Heure ${sel('time', TIMES)}</div>
    <div class="row">Météo ${sel('weather', { auto: 'Selon la saison', ...WEATHER })}</div>
    <div class="row">Saison ${sel('season', { auto: `Comme dehors (${SEASONS[autoSeason()]})`, ...SEASONS })}</div>
    <h3>Image</h3>
    <div class="row">Effet maquette (flou) <input type="checkbox" data-tilt ${state.settings.tilt !== false ? 'checked' : ''}></div>
    <div class="row">Qualité ${sel('quality', { auto: 'Automatique', low: 'Économie (téléphone)' })}</div>
    <h3>Quartiers</h3>
    <div class="districts">${DISTRICTS.map(([n, on]) => `<div class="${on ? 'on' : ''}">${n}<small>${on ? 'Ton quartier' : 'Bientôt'}</small></div>`).join('')}</div>
    <h3>Comment jouer</h3>
    <ul class="rules">
      <li>🍜 Tes commerces gagnent des ¥ <b>tout seuls</b>, même quand le jeu est fermé.</li>
      <li>⬆️ Touche un bâtiment pour l’<b>améliorer</b> : il rapporte plus et change d’apparence.</li>
      <li>🏗 Plus tu gagnes, plus de <b>bâtiments</b> se débloquent. Achète des parcelles 売地 pour agrandir le quartier.</li>
      <li>🏠 Chaque <b>habitant</b> (logements) et chaque <b>décoration</b> augmentent les revenus de tout le quartier.</li>
      <li>📜 Les <b>objectifs</b> donnent des récompenses et des décorations rares. Rien n’est obligatoire.</li>
      <li>✨ Des <b>événements</b> arrivent parfois : festival, chat doré, marchand… Touche-les pour un bonus.</li>
    </ul>
    <div class="actions"><button data-act="tuto">🎓 Revoir le tutoriel</button></div>
    <h3>Partie</h3>
    <div class="actions"><button class="ghost" data-act="reset">Recommencer de zéro</button></div>
    <p class="hint">Raccourcis : B construire, D décorer, R tourner, H contempler, Échap pour annuler. Ta partie est sauvegardée sur cet appareil.</p>`;
}

// Branche les boutons du panneau
function wire() {
  panelEl.querySelector('.close').onclick = () => { close(); setMode('view'); };
  panelEl.querySelectorAll('[data-tab]').forEach(b => (b.onclick = () => { buildTab = b.dataset.tab; render(); }));
  panelEl.querySelectorAll('[data-build]').forEach(b => (b.onclick = () => {
    const type = b.dataset.build;
    if (b.dataset.plot !== undefined) return doBuild(type, +b.dataset.plot);
    panel = null; panelEl.hidden = true; // le panneau cacherait les parcelles
    setMode('build', { buildType: type });
  }));
  panelEl.querySelectorAll('[data-decor]').forEach(b => (b.onclick = () => { decorRot = 0; setMode('decor', { decorId: b.dataset.decor }); render(); if (innerWidth < 720) panelEl.hidden = true; }));
  panelEl.querySelectorAll('[data-claim]').forEach(b => (b.onclick = () => { if (S.claim(state, b.dataset.claim)) { sound('goal'); toast('🎁 Récompense récupérée'); afterChange(); } }));
  panelEl.querySelectorAll('[data-vol]').forEach(r => (r.oninput = () => { state.settings[r.dataset.vol] = +r.value; setVolumes({ [r.dataset.vol]: +r.value }); }));
  panelEl.querySelectorAll('[data-set]').forEach(s => (s.onchange = () => {
    state.settings[s.dataset.set] = s.value;
    if (s.dataset.set === 'quality') { save(); location.reload(); }
    if (s.dataset.set === 'season') weather = nextWeather();
  }));
  panelEl.querySelectorAll('[data-tilt]').forEach(c => (c.onchange = () => { state.settings.tilt = c.checked; world.setTilt(c.checked); }));
  panelEl.querySelectorAll('[data-act]').forEach(b => (b.onclick = () => act(b.dataset.act, b.dataset)));
}
function act(a, data) {
  const i = panel?.arg;
  if (a === 'upgrade' && S.upgrade(state, i)) { world.syncPlot(i, state, true); sound('upgrade'); toast(`${BUILDINGS[state.plots[i].type].name} passe au niveau ${state.plots[i].level}`); afterChange(); }
  if (a === 'move') { close(); setMode('move', { movingFrom: i }); }
  if (a === 'look') { const p = PLOTS[i]; world.focus(p.x, p.z + p.face * 0.6, 8); }
  if (a === 'sector' && S.buySector(state, +data.k)) { PLOTS.forEach((_, j) => world.syncPlot(j, state)); sound('build'); toast(`📜 ${SECTORS[+data.k].name} t’appartient !`); close(); afterChange(); }
  if (a === 'erase') { setMode('erase'); close(); }
  if (a === 'drot') { state.decor[i].r = ((state.decor[i].r || 0) + Math.PI / 4) % (Math.PI * 2); world.syncDecor(state); sound('click'); }
  if (a === 'dmove') { const d = state.decor[i]; close(); decorRot = d.r || 0; setMode('decor', { decorId: d.id, movingDecor: i }); }
  if (a === 'dremove' && S.removeDecor(state, i)) { world.syncDecor(state); sound('place'); close(); afterChange(); }
  if (a === 'tuto') { close(); startTutorial(); return; }
  if (a === 'reset') {
    if (data.sure) { localStorage.removeItem(S.SAVE_KEY); removeEventListener('pagehide', save); location.reload(); return; }
    const b = panelEl.querySelector('[data-act=reset]'); b.dataset.sure = '1'; b.textContent = 'Sûr ? Tout sera effacé'; b.classList.add('primary');
  }
}
function doBuild(type, i) {
  if (!S.build(state, type, i)) return sound('error');
  world.syncPlot(i, state, true); world.syncDecor(state);
  sound('build');
  toast(`${ICON[type]} ${BUILDINGS[type].name} ouvre ses portes !`);
  setMode('view'); sel = i; open('building', i); refreshRings();
  afterChange();
}
function afterChange() { save(); render(); checkGoals(); }

// ---------- Clics dans la maquette ----------
const canvas = $('scene');
let down = null, idle = 0;
canvas.addEventListener('pointerdown', e => { down = { x: e.clientX, y: e.clientY, t: performance.now() }; idle = 0; });
addEventListener('keydown', () => (idle = 0));
canvas.addEventListener('pointermove', e => {
  if (mode !== 'decor' || e.pointerType === 'touch') return;
  const g = world.groundAt(e.clientX, e.clientY);
  if (g) { const x = snap(g.x), z = snap(g.z); world.setGhost(decorId, x, z, decorRot, S.canPlace(state, x, z, movingDecor)); }
});
canvas.addEventListener('pointerup', e => {
  if (!down) return;
  const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y), quick = performance.now() - down.t < 500;
  down = null;
  if (moved < 8 && quick) tap(e.clientX, e.clientY);
});
const snap = v => Math.round(v * 4) / 4;
function tap(x, y) {
  if (cinema.active) return exitPhoto();
  if (mode === 'decor') {
    const g = world.groundAt(x, y);
    if (!g) return;
    const gx = snap(g.x), gz = snap(g.z);
    if (movingDecor >= 0) {
      if (!S.canPlace(state, gx, gz, movingDecor)) return sound('error');
      Object.assign(state.decor[movingDecor], { x: gx, z: gz, r: decorRot });
      world.syncDecor(state); sound('place'); setMode('view'); return afterChange();
    }
    if (!S.placeDecor(state, decorId, gx, gz, decorRot)) { sound('error'); world.setGhost(decorId, gx, gz, decorRot, false); return; }
    world.syncDecor(state); sound('place'); afterChange();
    if (state.money < DECOR[decorId].cost) setMode('view');
    return;
  }
  const hit = world.pick(x, y);
  if (hit?.golden) return collect('golden');
  if (hit?.vendor) return collect('vendor');
  if (hit?.cat != null) { sound('meow'); world.life.hearts(world.life.cats[hit.cat].root.position); if (Math.random() < 0.3) toast(['Miaou ~', 'Ronron…', 'Le chat te regarde, l’air satisfait', 'Il s’étire et repart'][Math.floor(Math.random() * 4)]); return; }
  if (mode === 'erase') {
    if (hit?.decor != null && S.removeDecor(state, hit.decor)) { world.syncDecor(state); sound('place'); afterChange(); }
    return;
  }
  if (!hit) return mode === 'view' && close();
  if (hit.decor != null && mode === 'view') { sel = null; refreshRings(); sound('click'); return open('decorItem', hit.decor); }
  const i = hit.plot;
  if (i == null) return;
  if (mode === 'build') {
    if (!state.sectors[PLOTS[i].sector]) { setMode('view'); return open('sale', i); }
    if (state.plots[i]) return sound('error');
    return doBuild(buildType, i);
  }
  if (mode === 'move') {
    if (!state.sectors[PLOTS[i].sector] || !S.move(state, movingFrom, i)) return sound('error');
    world.syncPlot(movingFrom, state); world.syncPlot(i, state, true); world.syncDecor(state);
    sound('build'); setMode('view'); sel = i; open('building', i); refreshRings(); return afterChange();
  }
  sound('click');
  sel = i;
  refreshRings();
  if (!state.sectors[PLOTS[i].sector]) open('sale', i);
  else if (!state.plots[i]) { buildType = null; open('lot', i); }
  else open('building', i);
}

// ---------- Boutons et clavier ----------
$('buildBtn').onclick = () => { sound('click'); if (panel?.kind === 'build') { close(); setMode('view'); } else { sel = null; setMode('view'); open('build'); } };
$('decoBtn').onclick = () => { sound('click'); if (panel?.kind === 'decor' || mode === 'decor') { close(); setMode('view'); } else { sel = null; setMode('view'); open('decor'); } };
$('goalsBtn').onclick = () => { sound('click'); panel?.kind === 'goals' ? close() : open('goals'); };
$('settingsBtn').onclick = () => { sound('click'); panel?.kind === 'settings' ? close() : open('settings'); };
// Contempler : l'interface disparaît et la caméra enchaîne des plans de cinéma
function startCinema() { document.body.classList.add('photo'); close(); setMode('view'); cinema.start(ctx()); }
$('photoBtn').onclick = () => { startCinema(); toast('Touche l’écran pour revenir'); setTimeout(() => ($('toast').hidden = true), 1800); };
function exitPhoto() { document.body.classList.remove('photo'); cinema.stop(); idle = 0; }
const ctx = () => ({ state, festival: event?.id === 'festival', night: nightOf(hour) });

// ---------- Événements du quartier (jamais obligatoires) ----------
let event = null, eventT = 100;
const EVENTS = {
  festival: { when: h => h > 16.5 && h < 21.5, dur: 300, boost: 1.5, crowd: 1.6, icon: '🏮', name: 'Festival', text: '🏮 Festival ce soir ! Lanternes, feux d’artifice et clients en plus (revenus ×1,5)' },
  tourists: { when: h => h > 8 && h < 18.5, dur: 150, boost: 1.25, crowd: 1.1, icon: '📸', name: 'Touristes', text: '📸 Un groupe de touristes visite le quartier (revenus ×1,25)', start: () => world.people.tourists() },
  golden: { when: () => true, dur: 70, icon: '✨', name: 'Chat doré', text: '✨ Un chat doré se promène… trouve-le et touche-le !', start: () => world.life.spawnGolden(), end: () => world.life.removeGolden() },
  vendor: { when: h => h > 9 && h < 22, dur: 80, icon: '🍠', name: 'Marchand', text: '🍠 Le marchand de patates douces passe dans la rue. Touche sa charrette !', start: () => world.life.spawnVendor(), end: () => world.life.removeVendor() },
};
function startEvent() {
  const ok = Object.entries(EVENTS).filter(([, e]) => e.when(hour));
  const [id, e] = ok[Math.floor(Math.random() * ok.length)];
  event = { id, t: e.dur };
  state.boost = e.boost || 1;
  e.start?.();
  if (id === 'festival') world.setFestival(true);
  toast(e.text); sound('goal');
}
function endEvent() {
  EVENTS[event.id].end?.();
  if (event.id === 'festival') world.setFestival(false);
  event = null; state.boost = 1;
}
function collect(kind) {
  const gain = Math.round(Math.max(kind === 'golden' ? 150 : 60, S.totalIncome(state) * (kind === 'golden' ? 180 : 90)));
  state.money += gain; state.earned += gain;
  const at = kind === 'golden' ? world.life.golden : null;
  if (at) world.life.sparkle(at);
  if (kind === 'golden') world.life.removeGolden(); else world.life.removeVendor();
  if (event?.id === kind) endEvent();
  sound('golden');
  toast(kind === 'golden' ? `✨ Le chat doré te porte chance : +${money(gain)} ¥` : `🍠 Patates douces brûlantes pour tout le monde : +${money(gain)} ¥`);
  afterChange();
}
addEventListener('keydown', e => {
  if (e.target.closest?.('input, select')) return;
  const k = e.key.toLowerCase();
  if (k === 'escape') { if (document.body.classList.contains('photo')) exitPhoto(); else if (mode !== 'view') setMode('view'); else close(); }
  if (k === 'b') $('buildBtn').click();
  if (k === 'd') $('decoBtn').click();
  if (k === 'h') cinema.active ? exitPhoto() : $('photoBtn').click();
  if (k === 'r' && mode === 'decor') { decorRot += Math.PI / 4; sound('click'); }
});

// ---------- Objectifs ----------
const seen = new Set(OBJECTIVES.filter(o => S.done(state, o)).map(o => o.id));
function checkGoals() {
  let any = false;
  for (const o of OBJECTIVES) {
    const ok = S.done(state, o);
    if (ok && !state.claimed.includes(o.id)) any = true;
    if (ok && !seen.has(o.id)) { seen.add(o.id); toast(`🎯 Objectif atteint : ${o.text}`); sound('goal'); }
  }
  $('goalDot').hidden = !any;
}

// ---------- HUD ----------
const pad = n => String(n).padStart(2, '0');
function hud() {
  $('money').textContent = money(state.money);
  $('rate').textContent = `+${money(S.totalIncome(state) * 60)} ¥/min`;
  $('pop').textContent = `🏠 ${Math.floor(state.residents)} habitant${state.residents >= 2 ? 's' : ''}`;
  $('clients').textContent = `🍜 ${money(state.clients)} client${state.clients >= 2 ? 's' : ''}`;
  $('clock').textContent = `${pad(Math.floor(hour))}:${pad(Math.floor((hour % 1) * 60))} ${WEATHER[curWeather()].split(' ')[0]}`;
  $('evt').hidden = !event;
  if (event) $('evt').textContent = `${EVENTS[event.id].icon} ${EVENTS[event.id].name} · ${Math.floor(event.t / 60)}:${pad(Math.floor(event.t % 60))}`;
}

// ---------- Arrivée ----------
const intro = $('intro'), enter = $('enter');
if (away) {
  const h = Math.floor(away.away / 3600), m = Math.floor((away.away % 3600) / 60);
  $('away').innerHTML = `<h2>Pendant ton absence (${h ? `${h} h ` : ''}${m} min)</h2><p class="big">+${money(away.money)} ¥</p>
    <ul><li>${money(away.clients)} clients accueillis</li>${away.events.map(e => `<li>${esc(e)}</li>`).join('')}</ul>`;
}
enter.disabled = false;
enter.textContent = fresh ? 'Ouvrir le restaurant' : 'Revenir dans le quartier';
// ---------- Tutoriel : on fait les deux premiers gestes, puis on découvre le reste ----------
const TOUCH = matchMedia('(pointer: coarse)').matches;
const ramenAt = () => state.plots.findIndex(p => p?.type === 'ramen');
const TUTO = [
  { text: '<b>Bienvenue à Little District</b> 🏮<br>Ici, pas de chrono ni de pression : ton quartier gagne de l’argent <b>tout seul</b>, même quand tu fermes le jeu. Ton but : le faire grandir et le rendre beau, à ton rythme.' },
  { text: TOUCH ? '<b>Regarder la maquette</b><br>Glisse un doigt pour tourner autour, pince pour zoomer, glisse à deux doigts pour te déplacer.' : '<b>Regarder la maquette</b><br>Clic gauche et glisser pour tourner autour, molette pour zoomer, clic droit et glisser pour te déplacer.' },
  { text: '<b>Ton premier commerce</b><br>Touche ton <b>restaurant de ramen</b> 🍜 (il clignote).', wait: () => panel?.kind === 'building' && state.plots[panel.arg]?.type === 'ramen', enter: () => { const i = ramenAt(); if (i >= 0) { world.focus(PLOTS[i].x, PLOTS[i].z + PLOTS[i].face, 14); sel = i; refreshRings(); } } },
  { text: '<b>Améliore-le</b><br>Appuie sur <b>Améliorer</b> : il rapportera plus, et tu le verras changer (lanternes, étage, terrasse…).', wait: () => (state.plots[ramenAt()]?.level || 0) >= 2, glow: '[data-act=upgrade]', enter: () => { if (state.money < S.upgradeCost('ramen', 1)) state.money = S.upgradeCost('ramen', 1); } },
  { text: '<b>Gagner et construire</b><br>Tes gains s’affichent en haut (¥ et ¥/min). Plus tu gagnes, plus de bâtiments se débloquent dans <b>Construire</b> : restaurants, boutiques, loisirs, logements.', glow: '#buildBtn', enter: () => close() },
  { text: '<b>Habitants et décoration</b><br>Les logements 🏠 attirent des habitants : chacun augmente les revenus du quartier. Les décorations 🌸 aussi, et elles rendent les rues plus belles.', glow: '#decoBtn' },
  { text: '<b>Agrandir le quartier</b><br>Les vieilles maisons au panneau <b>売地</b> sont à vendre : achète-les pour avoir de nouvelles parcelles.' },
  { text: '<b>Objectifs</b> 📜<br>Des idées de choses à faire, avec des récompenses et des décorations rares. Aucun n’est obligatoire.', glow: '#goalsBtn' },
  { text: '<b>Petites surprises</b> ✨<br>De temps en temps, il se passe quelque chose : festival, chat doré, marchand de patates douces… Touche-les pour un bonus. Les chats, eux, adorent les caresses.' },
  { text: '<b>Prends ton temps</b> 📷<br>Quand tu reviens, tu récupères ce que ton quartier a gagné pendant ton absence. <b>Contempler</b> lance un petit film du quartier. Bonne balade !', glow: '#photoBtn', last: true },
];
let tuto = -1;
const coach = $('coach');
function startTutorial() { tuto = 0; showStep(); }
function endTutorial() { tuto = -1; coach.hidden = true; document.querySelectorAll('.glow').forEach(e => e.classList.remove('glow')); state.tuto = true; save(); }
function showStep() {
  const s = TUTO[tuto];
  document.querySelectorAll('.glow').forEach(e => e.classList.remove('glow'));
  s.enter?.();
  coach.hidden = false;
  coach.innerHTML = `<p>${s.text}</p><div class="row"><small>${tuto + 1} / ${TUTO.length}</small><span>${s.last ? '' : '<button class="ghost" id="tutoSkip">Passer</button>'}${s.wait ? '' : `<button class="primary" id="tutoNext">${s.last ? 'C’est parti !' : 'Suivant'}</button>`}</span></div>`;
  coach.style.animation = 'none'; void coach.offsetWidth; coach.style.animation = '';
  $('tutoSkip')?.addEventListener('click', endTutorial);
  $('tutoNext')?.addEventListener('click', nextStep);
}
function nextStep() { sound('click'); if (++tuto >= TUTO.length) endTutorial(); else showStep(); }
// À chaque image : étape réussie ? élément à faire briller ?
function tutorialTick() {
  if (tuto < 0) return;
  const s = TUTO[tuto];
  if (s.wait?.()) { sound('goal'); nextStep(); return; }
  if (s.glow) document.querySelector(s.glow)?.classList.add('glow');
}

enter.onclick = () => {
  startAudio();
  intro.classList.add('out');
  setTimeout(() => intro.remove(), 900);
  world.focus(start.x, start.z + 1.2, 14);
  if (fresh) setTimeout(() => startTutorial(), 1600);
  save();
};
if (/[?&]debug/.test(location.search)) window.__district = { state, world, S, setHour: h => (hour = h), setWeather: w => (state.settings.weather = w), cinema, startEvent: id => { if (event) endEvent(); const e = EVENTS[id]; event = { id, t: e.dur }; state.boost = e.boost || 1; e.start?.(); if (id === 'festival') world.setFestival(true); } };

// ---------- Boucle ----------
let last = performance.now(), hudT = 0, saveT = 0;
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  // le temps du quartier
  if (state.settings.time === 'auto') hour = (hour + (dt * 24) / DAY_LENGTH) % 24;
  else { const t = TIME_HOUR[state.settings.time]; let d = t - hour; if (d > 12) d -= 24; if (d < -12) d += 24; hour = (hour + d * Math.min(1, dt * 0.8) + 24) % 24; }
  state.hour = hour;
  if ((weatherT -= dt) < 0) { weatherT = 150 + Math.random() * 180; weather = nextWeather(); }
  // après la pluie, en journée : un arc-en-ciel
  const wNow = curWeather();
  if (['pluie', 'orage'].includes(lastWeather) && ['soleil', 'nuages'].includes(wNow) && nightOf(hour) < 0.3) { world.life.rainbow(); toast('🌈 Un arc-en-ciel au-dessus du quartier'); }
  lastWeather = wNow;
  if (event && (event.t -= dt) < 0) endEvent();
  if (!event && (eventT -= dt) < 0) { eventT = 150 + Math.random() * 200; startEvent(); }
  S.tick(state, dt);
  const w = curWeather();
  world.update(dt, { hour, weather: w, season: season(), state, festival: event?.id === 'festival', crowd: event ? EVENTS[event.id].crowd || 1 : 1 });
  cinema.update(dt, ctx());
  // le son suit l'ambiance
  const dist = world.camera.position.distanceTo(world.controls.target);
  setAmbience({ rain: Math.min(1, world.amb.rain), crowd: Math.min(1, world.people.count / 24), night: world.amb.night, cricket: ['ete', 'automne'].includes(season()), wind: w === 'neige' || w === 'brouillard' ? 1 : w === 'orage' ? 0.6 : 0, kitchen: Math.max(0.2, 1 - dist / 40) });
  // fantôme de décoration au doigt (téléphone) : au centre de l'écran
  if (mode === 'decor' && matchMedia('(pointer: coarse)').matches) {
    const g = world.groundAt(innerWidth / 2, innerHeight / 2);
    if (g) world.setGhost(decorId, snap(g.x), snap(g.z), decorRot, S.canPlace(state, snap(g.x), snap(g.z), movingDecor));
  }
  if ((idle += dt) > 120 && !cinema.active && mode === 'view' && !panel && !$('intro') && tuto < 0) startCinema(); // laissé tranquille : le quartier se met en scène
  tutorialTick();
  if ((hudT -= dt) < 0) { hudT = 0.25; hud(); render(true); checkGoals(); }
  if ((saveT += dt) > 10) { saveT = 0; save(); }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
