// Loup-Garou : accueil, salon et partie dans le village 3D. Le serveur tient les rôles, les nuits et les votes ; le
// navigateur déplace son villageois le jour (positions envoyées, « pos »), envoie emotes et objets lancés, et met en scène
// ce que le serveur annonce : jour et nuit, morts, verdicts, bulles de discussion, effets (« fx ») et positions (« snap »).
import { createWorld } from './world.js';
import { $, esc, store, audio, sound, blip, fanfare, party } from '/shared/party.js';

const LG = window.LG;
const socket = io('/loupgarou');
const view = createWorld($('#view'));
const coarse = matchMedia('(pointer: coarse)').matches;
addEventListener('resize', () => view.resize());
const now = () => performance.now() / 1000;
const EMOTE_LIST = Object.keys(LG.EMOTES), ITEM_LIST = Object.keys(LG.ITEMS);
const roleTxt = r => (r ? `${LG.ROLES[r].icon} ${LG.ROLES[r].name}` : '');
const CAUSE = { loups: 'a été dévoré', sorciere: 'a été empoisonné', vote: 'a été chassé', chasseur: 'a reçu une flèche' };

/* ---------------- Sons (synthétisés) ---------------- */
function noise(dur, freq, vol, { type = 'bandpass', q = 1, at = 0, to } = {}) {
  const ac = sound(); if (!ac) return;
  const t = ac.currentTime + at, b = ac.createBuffer(1, Math.ceil(ac.sampleRate * dur), ac.sampleRate), d = b.getChannelData(0);
  for (let k = 0; k < d.length; k++) d[k] = Math.random() * 2 - 1;
  const src = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
  src.buffer = b; f.type = type; f.Q.value = q; f.frequency.setValueAtTime(freq, t); if (to) f.frequency.exponentialRampToValueAtTime(to, t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(f).connect(g).connect(ac.destination); src.start(t);
}
const SFX = {
  howl() { blip(300, 560, 0.9, 'sine', 0.06); blip(560, 545, 1.3, 'sine', 0.06, 0.9); blip(545, 320, 1, 'sine', 0.05, 2.2); blip(600, 1120, 0.9, 'triangle', 0.015); blip(1120, 1090, 1.3, 'triangle', 0.015, 0.9); },
  bell() { for (let k = 0; k < 3; k++) { blip(392, 390, 2.2, 'sine', 0.09, k * 0.9); blip(784, 780, 1.6, 'sine', 0.035, k * 0.9); blip(1176, 1170, 1, 'sine', 0.02, k * 0.9); } },
  drum() { for (let k = 0; k < 3; k++) blip(95, 55, 0.3, 'sine', 0.18, k * 0.22); },
  gong() { blip(130, 64, 2, 'sine', 0.14); blip(262, 130, 1.4, 'triangle', 0.04); },
  mystery() { [262, 311, 392, 466].forEach((f, k) => blip(f, f, 1.4, 'triangle', 0.05, k * 0.18)); },
  whoosh() { noise(0.35, 600, 0.12, { to: 2400, q: 2 }); },
  splat() { noise(0.25, 900, 0.3, { type: 'lowpass', to: 200 }); blip(180, 60, 0.15, 'sine', 0.12); },
  bonk() { blip(520, 260, 0.12, 'square', 0.08); blip(780, 390, 0.1, 'triangle', 0.06, 0.05); },
  slap() { noise(0.12, 2000, 0.3, { type: 'highpass' }); },
  thud() { blip(120, 50, 0.2, 'sine', 0.2); noise(0.1, 400, 0.2); },
  chime() { [880, 1175, 1568].forEach((f, k) => blip(f, f, 0.5, 'sine', 0.05, k * 0.07)); },
  clap() { for (let k = 0; k < 6; k++) noise(0.06, 1800, 0.25, { q: 0.8, at: k * 0.16 }); },
  rire() { [0, 0.15, 0.3, 0.46, 0.62].forEach((t, k) => blip(560 - k * 30, 420 - k * 30, 0.11, 'triangle', 0.06, t)); },
  pleurer() { blip(520, 380, 0.5, 'sine', 0.05); blip(500, 340, 0.6, 'sine', 0.05, 0.55); },
  bisou() { blip(1100, 1900, 0.09, 'sine', 0.07); },
  pop() { blip(500, 900, 0.08, 'triangle', 0.05); },
  chirp() { const f = 2600 + Math.random() * 1200; blip(f, f * 1.3, 0.06, 'sine', 0.025); blip(f * 1.1, f * 1.4, 0.05, 'sine', 0.02, 0.09); },
  cricket() { for (let k = 0; k < 3; k++) blip(4300, 4300, 0.025, 'square', 0.006, k * 0.05); },
  owl() { blip(420, 380, 0.35, 'sine', 0.04); blip(400, 360, 0.5, 'sine', 0.04, 0.5); },
  tick() { blip(900, 900, 0.05, 'square', 0.03); },
};
const HIT_SFX = { tomate: 'splat', oeuf: 'splat', chou: 'thud', chaussure: 'bonk', poisson: 'slap', rose: 'chime', fleche: 'thud' };

/* ---------------- Apparence ---------------- */
const LOOK_NAMES = { skin: 'Peau', hair: 'Coiffure', hairColor: 'Cheveux', outfit: 'Tenue', outfitColor: 'Couleur', hat: 'Chapeau', extra: 'Détail' };
const SWATCH = ['skin', 'hairColor', 'outfitColor'];
let look = (() => { try { const v = JSON.parse(store.get('loupgarou-look')); if (LG.validLook(v)) return v; } catch { /* illisible */ } return LG.randomLook(); })();
store.set('loupgarou-look', JSON.stringify(look));
function renderDress() {
  $('#dressRows').innerHTML = LG.LOOK_KEYS.map((k, i) => {
    const v = LG.LOOK[k][look[i]], sw = SWATCH.includes(k);
    return `<div class="opt"><b>${LOOK_NAMES[k]}</b><button class="ghost" data-k="${i}" data-d="-1" aria-label="${LOOK_NAMES[k]} précédent">‹</button><span>${sw ? `<i style="background:${v}"></i>` : esc(v)}</span><button class="ghost" data-k="${i}" data-d="1" aria-label="${LOOK_NAMES[k]} suivant">›</button></div>`;
  }).join('');
}
$('#dressRows').onclick = e => { const b = e.target.closest('[data-k]'); if (!b) return; const i = +b.dataset.k, n = LG.LOOK[LG.LOOK_KEYS[i]].length; look[i] = (look[i] + +b.dataset.d + n) % n; lookChanged(); };
$('#dressRandom').onclick = () => { look = LG.randomLook(); lookChanged(); };
$('#dressToggle').onclick = () => { const d = $('#dress'); d.toggleAttribute('data-closed'); $('#dressToggle').setAttribute('aria-expanded', !d.hasAttribute('data-closed')); };
if (coarse || innerWidth <= 820) $('#dress').setAttribute('data-closed', '');
let lookTimer = 0;
function lookChanged() {
  store.set('loupgarou-look', JSON.stringify(look));
  renderDress(); refreshChars(); SFX.pop();
  clearTimeout(lookTimer);
  if (ui.room && !ui.room.spectator) lookTimer = setTimeout(() => ui.act('dress', look), 250);
}
$('#tryEmotes').innerHTML = EMOTE_LIST.map(e => `<button class="ghost" data-e="${e}" title="${LG.EMOTES[e].name}">${LG.EMOTES[e].icon}</button>`).join('');
$('#tryEmotes').onclick = e => { const b = e.target.closest('[data-e]'); if (!b) return; audio(); if (ui.room) doEmote(b.dataset.e); else { view.emote(PREVIEW, b.dataset.e, null, now()); emojiPop(PREVIEW, LG.EMOTES[b.dataset.e].icon); SFX[b.dataset.e]?.(); } };
renderDress();

/* ---------------- Salon ---------------- */
const PREVIEW = ' moi';
let screen = 'home';
const ui = party({
  id: 'loupgarou', socket, max: LG.MAX_PLAYERS, bots: 7, busy: '🌙 en jeu', onError: text => toast(text),
  onShow: sc => { if (sc !== screen) { fpKey = ''; ghost = null; if (sc === 'home' && document.pointerLockElement) document.exitPointerLock(); } screen = sc; $('#dress').hidden = sc === 'game'; if (sc === 'home') { ui.room = null; refreshChars(); } },
  onRoom: (s, host) => {
    $('#dayT').disabled = $('#voteT').disabled = !host; $('#dayT').value = s.settings.day; $('#voteT').value = s.settings.vote;
    $('#startBtn').disabled = s.players.length < LG.MIN_PLAYERS;
    if (host && s.players.length < LG.MIN_PLAYERS) $('#roomHint').textContent = `Il faut au moins ${LG.MIN_PLAYERS} villageois : ajoute des robots ou invite des amis.`;
    $('#comp').innerHTML = compHtml(LG.composition(Math.max(LG.MIN_PLAYERS, s.players.length)));
  },
});
const { show, act } = ui;
$('#dayT').onchange = e => act('configure', 'day', Number(e.target.value));
$('#voteT').onchange = e => act('configure', 'vote', Number(e.target.value));
function compHtml(list) { const c = {}; for (const r of list) c[r] = (c[r] ?? 0) + 1; return Object.entries(c).map(([r, n]) => `<span title="${LG.ROLES[r].name}">${LG.ROLES[r].icon}${n > 1 ? `×${n}` : ''}</span>`).join(''); }
function refreshChars() {
  const s = ui.room;
  if (!s) return view.syncPlayers([{ name: PREVIEW, look, color: '#e8b84a' }]);
  view.syncPlayers(s.players.map(p => (p.name === s.me ? { ...p, look } : p)));
  view.setFPLook(look, s.players.find(p => p.name === s.me)?.color ?? '#e8b84a');
}

/* ---------------- État reçu ---------------- */
let S = null, offset = 0, phaseKey = '', phaseT0 = 0, sentLook = '', boardAt = 0, seerPick = null;
const remotes = new Map(); // pseudo -> [{ at, x, z, ry, sit }]
let me = null; // ma position quand je me promène (le jour)
const inGame = s => !!s?.roles && s.phase !== 'lobby';
socket.on('state', s => {
  if (!s) return;
  const old = S; S = s;
  offset = s.now - Date.now();
  const mine = s.players.find(p => p.name === s.me);
  if (mine && JSON.stringify(mine.look) !== JSON.stringify(look) && sentLook !== s.code + look.join()) { sentLook = s.code + look.join(); act('dress', look); }
  refreshChars();
  show(inGame(s) ? 'game' : 'room');
  ui.renderRoom();
  if (!inGame(s)) { view.setGraves([]); $('#board').hidden = true; $('#roleCard').hidden = true; closeCtx(); phaseKey = ''; }
  else game(s, old);
  chatSync(s, old);
});
socket.on('snap', list => {
  const at = now();
  for (const [n, x, z, ry, sit] of list) {
    if (!remotes.has(n)) remotes.set(n, []);
    const b = remotes.get(n); b.push({ at, x, z, ry, sit });
    if (b.length > 12) b.shift();
  }
});
function remoteAt(n, t) {
  const b = remotes.get(n); if (!b?.length) return null;
  let k = b.findIndex(s => s.at > t); if (k < 0) k = b.length - 1;
  const B = b[k], A = b[Math.max(0, k - 1)], f = B.at > A.at ? Math.max(0, Math.min(1, (t - A.at) / (B.at - A.at))) : 1;
  let dr = B.ry - A.ry; dr = Math.atan2(Math.sin(dr), Math.cos(dr));
  return { x: A.x + (B.x - A.x) * f, z: A.z + (B.z - A.z) * f, ry: A.ry + dr * f, sit: B.sit };
}
const seatOf = (s, n) => LG.SEATS[s.seats?.[n] ?? Math.max(0, s.players.findIndex(p => p.name === n))];
const alive = (s, n) => !!s.life?.[n];

// Changements de phase : ciel, bandeau, sons, caméra.
function game(s, old) {
  const key = `${s.round}.${s.roundNo}.${s.phase}.${s.step}.${s.dayNo}`;
  if (key !== phaseKey) { phaseKey = key; enter(s); }
  if (old?.life && old.round === s.round && old.roundNo === s.roundNo) for (const n of Object.keys(s.life)) if (old.life[n] && !s.life[n]) died(n, s);
  renderVillage(s); renderAction(s); renderRoleChip(s);
  view.setGraves(s.players.filter(p => !alive(s, p.name)).map(p => ({ name: p.name, sub: LG.ROLES[s.roles[p.name]]?.name ?? '' })));
  if (['roundEnd', 'over'].includes(s.phase)) { if (Date.now() > boardAt) showBoard(s); else setTimeout(() => S === s && showBoard(s), boardAt - Date.now()); }
  else $('#board').hidden = true;
}
function enter(s) {
  const p = s.phase;
  phaseT0 = s.now; closeCtx(); aiming = null; renderBars();
  const seat = seatOf(s, s.me);
  if (seat && !['night', 'day'].includes(p) && alive(s, s.me)) { view.cam.yaw = Math.atan2(seat.x, seat.z); view.cam.pitch = -0.1; }
  if (alive(s, s.me) && !s.spectator) ghost = null;
  if (p === 'reveal') { view.setTime(0.38, 0.3); seerPick = null; $('#feed').innerHTML = ''; openRole(s); SFX.mystery(); }
  if (p === 'night') {
    view.setTime(1, 0.22); $('#roleCard').hidden = true; seerPick = null;
    if (s.step === 'wolves') { banner('🌙 La nuit tombe', s.dayNo === 1 ? 'Le village s’endort… et les loups-garous ouvrent les yeux.' : 'Le village s’endort.'); setTimeout(SFX.howl, 1400); }
    else feed('🧪 La sorcière se réveille…');
  }
  if (p === 'dawn') {
    view.setTime(0.06, 0.3); SFX.bell();
    banner('🌅 Le jour se lève', s.deaths.length ? s.deaths.map(d => `${d.name} ${CAUSE[d.cause]} · ${roleTxt(d.role)}`).join('\n') : 'Miracle : personne n’est mort cette nuit !');
  }
  if (p === 'day') {
    view.setTime(0.3, 0.24 / s.settings.day);
    feed(`☀️ Jour ${s.dayNo} : promenez-vous, discutez, accusez !`);
    const r = remoteAt(s.me, now()), st = seatOf(s, s.me);
    me = alive(s, s.me) && !s.spectator ? { x: r?.x ?? st.x, z: r?.z ?? st.z, ry: r?.ry ?? st.ry, sit: r?.sit ?? s.seats[s.me] } : null;
  } else me = null;
  if (p === 'vote') { view.setTime(0.44, 0.06); SFX.drum(); banner('🗳 L’heure du vote', 'Clique sur celui qui doit quitter le village.'); }
  if (p === 'verdict') {
    view.setTime(0.56, 0.05);
    const v = s.verdict;
    banner(v?.name ? `⚖️ ${v.name} est chassé` : v?.tie ? '⚖️ Égalité !' : '🤷 Aucun vote', v?.name ? `${v.votes} voix · c’était ${roleTxt(v.role)}` : 'Personne ne quitte le village ce soir.');
  }
  if (p === 'hunter') { banner(`🏹 ${s.hunter}, le chasseur`, s.hunter === s.me ? 'Choisis qui emporter avec toi.' : 'tire sa dernière flèche…'); }
  if (p === 'roundEnd') {
    view.setTime(0.36, 0.25);
    const mineWon = LG.ROLES[s.role]?.camp === s.winner;
    banner(s.winner === 'loups' ? '🐺 Les loups-garous ont gagné' : '🏡 Le village a gagné', mineWon ? 'Bravo, ton camp l’emporte !' : s.spectator ? '' : 'Ton camp a perdu…');
    view.spawn('confetti', { x: 0, y: 0, z: 0 });
    if (mineWon) fanfare([523, 659, 784, 1046, 1318]); else SFX.gong();
    boardAt = Date.now() + 3200;
  }
}
function died(n, s) {
  view.poof(n, s.roles?.[n] === 'loup' ? '#ffb4a6' : '#e8e4ff');
  SFX.gong();
  if (n === s.me) toast('💀 Tu es mort… tu deviens un fantôme. Tu vois tout, mais tu ne peux plus parler.');
}

/* ---------------- Carte du rôle ---------------- */
function openRole(s) {
  if (s.spectator || !s.role) return;
  const r = LG.ROLES[s.role];
  $('#rcIcon').textContent = r.icon; $('#rcName').textContent = r.name; $('#rcText').textContent = r.text;
  $('#rcCamp').textContent = r.camp === 'loups' ? 'Camp des loups' : 'Camp du village'; $('#rcCamp').className = `camp camp-${r.camp}`;
  $('#rcComp').innerHTML = compHtml(s.comp ?? []);
  const mates = Object.entries(s.roles).filter(([n, x]) => x === 'loup' && n !== s.me).map(([n]) => n);
  $('#rcMates').textContent = s.role === 'loup' ? (mates.length ? `Ta meute : ${mates.join(', ')}` : 'Tu chasses seul cette fois.') : '';
  $('#roleCard').hidden = false;
}
$('#rcOk').onclick = () => ($('#roleCard').hidden = true);
$('#roleChip').onclick = () => S && openRole(S);
function renderRoleChip(s) {
  const c = $('#roleChip');
  c.textContent = s.spectator ? '👁 Spectateur' : `${roleTxt(s.role)}${alive(s, s.me) ? '' : ' · 👻'}`;
  c.classList.toggle('dead', !s.spectator && !alive(s, s.me));
}

/* ---------------- Panneaux ---------------- */
function renderVillage(s) {
  const votes = {};
  for (const t of Object.values(s.votes ?? {})) votes[t] = (votes[t] ?? 0) + 1;
  const living = s.players.filter(p => alive(s, p.name));
  $('#aliveCount').textContent = `${living.length}/${s.players.length} en vie`;
  $('#villageList').innerHTML = s.players.map(p => {
    const r = s.roles?.[p.name], dead = !alive(s, p.name), my = s.votes?.[s.me] === p.name;
    return `<li class="${p.name === s.me ? 'me' : ''} ${dead ? 'dead' : ''}" data-who="${esc(p.name)}"><i class="dot" style="background:${p.color}"></i><span>${esc(p.name)}${p.bot ? ' 🤖' : ''}</span>${!p.connected && !p.bot ? '<em class="off">absent</em>' : ''}${s.phase === 'day' && s.ready?.includes(p.name) ? '<em title="Prêt à voter">⏩</em>' : ''}${votes[p.name] ? `<em class="votes">${my ? '✓ ' : ''}${votes[p.name]}</em>` : ''}${r ? `<em title="${LG.ROLES[r].name}">${LG.ROLES[r].icon}</em>` : ''}${dead ? '<em>💀</em>' : ''}</li>`;
  }).join('');
}
$('#villageToggle').onclick = () => $('#village').classList.toggle('closed');
$('#villageList').onclick = e => { const li = e.target.closest('[data-who]'); if (li && li.dataset.who !== S?.me) { const r = li.getBoundingClientRect(); openCtx(li.dataset.who, r.left - 230, r.top); } };
if (coarse || innerWidth <= 820) $('#village').classList.add('closed');

function targetsHtml(s, list, on, extra = () => '') {
  return list.map(n => { const p = s.players.find(x => x.name === n); return `<button data-t="${esc(n)}" class="${on === n ? 'on' : ''}"><i style="background:${p?.color}"></i><span>${esc(n)}</span>${extra(n)}</button>`; }).join('');
}
function renderAction(s) {
  const card = $('#actionCard'), role = s.role, live = alive(s, s.me) && !s.spectator, others = s.players.map(p => p.name).filter(n => n !== s.me && alive(s, n));
  let html = null, title = '', text = '', buttons = '', wolf = false;
  if (s.phase === 'night' && s.step === 'wolves' && live && role === 'loup') {
    wolf = true; title = '🐺 La chasse'; text = 'Mettez-vous d’accord sur une victime.';
    const by = {}; for (const [w, t] of Object.entries(s.wolfVotes ?? {})) (by[t] ??= []).push(w);
    html = targetsHtml(s, others.filter(n => s.roles[n] !== 'loup'), s.wolfVotes?.[s.me], n => (by[n] ? `<em>🐺 ${by[n].length}</em>` : ''));
  } else if (s.phase === 'night' && s.step === 'wolves' && live && role === 'voyante') {
    title = '🔮 La boule de cristal';
    if (!s.seerDone) { text = 'Choisis un joueur : tu verras son vrai rôle.'; html = targetsHtml(s, others, null, n => (s.roles[n] ? `<em>${LG.ROLES[s.roles[n]].icon}</em>` : '')); }
    else { text = ''; html = ''; buttons = seerPick && s.roles[seerPick] ? `<p class="seen">${esc(seerPick)} est ${roleTxt(s.roles[seerPick])}</p>` : '<p class="seen">La vision s’estompe…</p>'; }
  } else if (s.phase === 'night' && s.step === 'witch' && live && role === 'sorciere') {
    title = '🧪 Tes potions';
    text = s.victim ? `Les loups ont attaqué ${s.victim}.` : 'Les loups n’ont attaqué personne cette nuit.';
    if (s.potions?.kill) { text += ' Potion de mort : clique sur un joueur.'; html = targetsHtml(s, others, null, () => '<em>☠️</em>'); } else html = '';
    buttons = `${s.potions?.heal && s.victim ? `<button class="primary" data-p="heal">💚 Sauver ${esc(s.victim)}</button>` : ''}<button class="ghost" data-p="done">Ne rien faire</button>`;
  } else if (s.phase === 'hunter' && s.hunter === s.me && !s.shot) {
    title = '🏹 Ta dernière flèche'; text = 'Qui emportes-tu avec toi ?'; html = targetsHtml(s, others);
  } else if (s.phase === 'vote' && live) {
    const votes = {}; for (const t of Object.values(s.votes ?? {})) votes[t] = (votes[t] ?? 0) + 1;
    title = '🗳 Le vote'; text = 'Clique ici ou sur un villageois de la place. Tu peux changer d’avis.';
    html = targetsHtml(s, others, s.votes?.[s.me], n => (votes[n] ? `<em>${votes[n]} voix</em>` : ''));
  }
  card.hidden = html === null && !buttons;
  card.classList.toggle('wolf', wolf);
  if (!card.hidden) {
    $('#acTitle').textContent = title; $('#acText').textContent = text;
    const t = $('#acTargets'), sig = html + buttons;
    if (card.dataset.sig !== sig) { t.innerHTML = html ?? ''; $('#acButtons').innerHTML = buttons; card.dataset.sig = sig; }
    $('#packChat').innerHTML = wolf ? (s.wolfChat ?? []).map(m => `<li><b>${esc(m.name)}</b> : ${esc(m.text)}</li>`).join('') : '';
    $('#packForm').hidden = !wolf;
  }
  // Ceux qui dorment
  const sleeping = s.phase === 'night' && card.hidden;
  $('#sleep').hidden = !sleeping;
  if (sleeping) $('#sleep').innerHTML = !live ? '👻 Tu observes le village endormi<small>Les morts voient tout… mais se taisent.</small>' : `💤 Tu dors…<small>${s.step === 'witch' ? 'La sorcière prépare ses potions.' : 'Les loups-garous rôdent dans les ruelles.'}</small>`;
  $('#veil').classList.toggle('on', s.phase === 'night');
  $('#veil').classList.toggle('wolf', s.phase === 'night' && wolf);
}
$('#acTargets').onclick = e => {
  const b = e.target.closest('[data-t]'); if (!b || !S) return;
  const n = b.dataset.t, s = S;
  if (s.phase === 'night' && s.step === 'wolves' && s.role === 'loup') act('wolf', n);
  else if (s.phase === 'night' && s.role === 'voyante') { seerPick = n; act('see', n).then(() => SFX.chime()); }
  else if (s.phase === 'night' && s.role === 'sorciere') act('potion', 'kill', n);
  else if (s.phase === 'hunter') act('shoot', n);
  else if (s.phase === 'vote') castVote(n);
};
$('#acButtons').onclick = e => { const b = e.target.closest('[data-p]'); if (b) act('potion', b.dataset.p); };
$('#packForm').onsubmit = e => { e.preventDefault(); const v = $('#packIn').value.trim(); if (v) act('whisper', v); $('#packIn').value = ''; };
function castVote(n) { const s = S; act('vote', s.votes?.[s.me] === n ? null : n).then(r => { if (r?.ok && s.votes?.[s.me] !== n) { socket.emit('emote', 'pointer', n); SFX.drum(); } }); }
$('#rushBtn').onclick = () => act('rush');

/* ---------------- Fin de partie ---------------- */
function showBoard(s) {
  const over = s.phase === 'over';
  $('#boardKicker').textContent = over ? 'Fin de la soirée' : `Partie ${s.roundNo} sur ${s.settings.rounds}`;
  if (over) {
    $('#boardTitle').textContent = `🏆 ${s.ranking[0]?.name === s.me ? 'Tu remportes la soirée !' : `${s.ranking[0]?.name} remporte la soirée`}`;
    $('#boardList').innerHTML = s.ranking.map((p, k) => `<li class="${p.name === s.me ? 'me' : ''}"><b>${k + 1}</b><i class="dot" style="width:12px;height:12px;border-radius:50%;background:${p.color}"></i><span>${esc(p.name)}</span><strong>${p.points} pts</strong></li>`).join('');
    $('#boardHint').textContent = '';
    ui.endButtons(s, s.ranking);
  } else {
    $('#boardTitle').textContent = s.winner === 'loups' ? '🐺 Les loups-garous ont gagné' : '🏡 Le village a gagné';
    $('#boardList').innerHTML = [...s.players].sort((a, b) => (LG.ROLES[s.roles[b.name]]?.camp === s.winner) - (LG.ROLES[s.roles[a.name]]?.camp === s.winner)).map(p => {
      const r = s.roles[p.name], win = LG.ROLES[r]?.camp === s.winner;
      return `<li class="${p.name === s.me ? 'me' : ''} ${win ? 'win' : ''} ${alive(s, p.name) ? '' : 'dead'}"><b>${LG.ROLES[r]?.icon ?? ''}</b><span>${esc(p.name)} <em>${LG.ROLES[r]?.name ?? ''}${alive(s, p.name) ? '' : ' · 💀'}</em></span><strong>${p.points} pts</strong></li>`;
    }).join('');
    const hits = Object.entries(s.hits ?? {}).sort((a, b) => b[1] - a[1])[0];
    $('#boardHint').textContent = `${hits ? `🍅 Cible préférée du village : ${hits[0]} (${hits[1]} projectile${hits[1] > 1 ? 's' : ''}) · ` : ''}${s.roundNo < s.settings.rounds ? 'Nouvelle partie dans un instant…' : 'Classement final dans un instant…'}`;
    $('#boardButtons').innerHTML = '';
  }
  $('#board').hidden = false;
}

/* ---------------- Discussion ---------------- */
let chatSeen = 0;
const lines = [];
function line(html, cls = '') { lines.push(`<li class="${cls}">${html}</li>`); if (lines.length > 80) lines.shift(); $('#chatLog').innerHTML = lines.join(''); $('#chatLog').scrollTop = 1e9; }
const colorOf = n => S?.players.find(p => p.name === n)?.color ?? '#e8b84a';
function chatSync(s, old) {
  if (old?.code !== s.code) { chatSeen = s.chat.at(-1)?.id ?? 0; lines.length = 0; }
  for (const m of s.chat.filter(m => m.id > chatSeen)) { line(`<b style="--c:${colorOf(m.name)}">${esc(m.name)}</b> ${esc(m.text)}`, m.spectator ? 'spect' : ''); speak(m.name, m.text); }
  chatSeen = s.chat.at(-1)?.id ?? chatSeen;
  // le journal de la partie (morts, nuits, jours)
  if (inGame(s)) {
    const k = `${s.round}.${s.roundNo}`;
    if (logKey !== k) { logKey = k; logSeen = 0; }
    const fresh = s.log.slice(Math.max(0, s.log.length - (s.logN - logSeen)));
    for (const l of fresh) line(esc(l), 'sys');
    logSeen = s.logN;
  }
  const c = canChat(s), wolfNight = s.phase === 'night' && s.role === 'loup' && alive(s, s.me);
  $('#chatIn').disabled = !c && !wolfNight;
  $('#chatIn').placeholder = wolfNight ? '🐺 Chuchoter à la meute (Entrée)' : c ? 'Parler au village (Entrée)' : s.spectator ? 'Les spectateurs se taisent pendant la partie' : !alive(s, s.me) ? '👻 Les morts ne parlent pas…' : 'Chut… le village dort';
}
let logKey = '', logSeen = 0;
const canChat = s => !s.roles || ['lobby', 'roundEnd', 'over'].includes(s.phase) || (alive(s, s.me) && s.phase !== 'night');
$('#chatForm').onsubmit = e => {
  e.preventDefault();
  const v = $('#chatIn').value.trim(); if (!v || !S) return;
  if (S.phase === 'night' && S.role === 'loup') act('whisper', v); else socket.emit('chat', v);
  $('#chatIn').value = ''; $('#chatIn').blur();
};

/* ---------------- Effets reçus ---------------- */
// Touché en plein visage (je vois par mes yeux) : la tache coule sur l'écran
function screenSplat(item) {
  const el = $('#splat'), col = { tomate: '200,22,10', oeuf: '255,216,74', chou: '108,178,74', poisson: '160,210,240' }[item];
  if (!col) { el.className = 'splat bonk'; } else { el.className = 'splat'; el.style.setProperty('--c', col); }
  el.hidden = true; void el.offsetWidth; el.hidden = false; clearTimeout(screenSplat.t); screenSplat.t = setTimeout(() => (el.hidden = true), 2600);
}
function selfEmote(icon) { const el = $('#selfEmote'); el.textContent = icon ?? ''; el.hidden = true; void el.offsetWidth; el.hidden = false; clearTimeout(selfEmote.t); selfEmote.t = setTimeout(() => (el.hidden = true), 1600); }
socket.on('fx', f => {
  const t = now();
  if (f.kind === 'emote') { view.emote(f.who, f.e, f.to, t); emojiPop(f.who, LG.EMOTES[f.e]?.icon); if (f.who === S?.me) selfView = { until: now() + LG.EMOTES[f.e].ms / 1000 + 0.35, fresh: true }; SFX[f.e]?.(); }
  if (f.kind === 'toss') { SFX.whoosh(); view.toss(f.who, f.to, f.item, t, item => { SFX[HIT_SFX[item]]?.(); if (f.to === S?.me) toast(`${LG.ITEMS[item].icon} ${f.who} t’a lancé ${item === 'oeuf' ? 'un œuf' : item === 'rose' ? 'une rose' : item === 'chaussure' ? 'une chaussure' : item === 'tomate' ? 'une tomate' : item === 'chou' ? 'un chou' : 'un poisson'} !`); if (f.to === S?.me) screenSplat(item); }, f.who === S?.me); }
  if (f.kind === 'say') { speak(f.who, f.text); line(`<b style="--c:${colorOf(f.who)}">${esc(f.who)}</b> ${esc(f.text)}`); }
  if (f.kind === 'shot') { SFX.whoosh(); view.toss(f.who, f.to, 'fleche', t, () => SFX.thud()); }
});

/* ---------------- Étiquettes, bulles, emojis ---------------- */
const tags = new Map(); // pseudo -> { el, name, bubble, bubbleUntil }
function tagOf(n) {
  let g = tags.get(n);
  if (!g) {
    const el = document.createElement('div'); el.className = 'tag';
    el.innerHTML = '<div class="slot"></div><div class="name"></div>';
    $('#labels').append(el);
    g = { el, slot: el.firstChild, name: el.lastChild, until: 0, sig: '' };
    tags.set(n, g);
  }
  return g;
}
function speak(n, text) {
  const g = tagOf(n), b = document.createElement('div');
  b.className = 'bubble'; b.textContent = text;
  g.slot.replaceChildren(b); g.until = now() + Math.min(7, 2.5 + text.length * 0.05);
  view.talk(n, now(), Math.min(4, 0.6 + text.length * 0.05));
}
function emojiPop(n, icon) {
  if (!icon) return;
  const g = tagOf(n), b = document.createElement('div');
  b.className = 'emoji'; b.textContent = icon;
  g.slot.replaceChildren(b); g.until = now() + 1.6;
}
function labels(list) {
  const seen = new Set(), t = now(), s = S, v = view.headAt.bind(view);
  const votes = {}; for (const x of Object.values(s?.votes ?? {})) votes[x] = (votes[x] ?? 0) + 1;
  for (const o of list) {
    if (!o.visible) continue;
    const p = v(o.name); if (!p) continue;
    const sc = view.project(p); if (!sc.ok) continue;
    const g = tagOf(o.name); seen.add(o.name);
    const r = s?.roles?.[o.name], showName = o.name !== PREVIEW;
    const sig = `${o.name}|${o.ghost}|${r}|${votes[o.name] ?? 0}|${o.color}|${o.bot}`;
    if (g.sig !== sig) { g.sig = sig; g.name.innerHTML = showName ? `<i style="background:${o.color}"></i>${o.ghost ? '👻 ' : ''}${esc(o.name)}${r && (o.ghost || o.name === s?.me || s?.role === 'loup' || !alive(s, s?.me)) ? ` ${LG.ROLES[r].icon}` : ''}${votes[o.name] ? `<span class="vc">${votes[o.name]}</span>` : ''}` : ''; g.name.hidden = !showName; }
    g.el.classList.toggle('ghost', !!o.ghost);
    if (g.until && t > g.until) { g.slot.replaceChildren(); g.until = 0; }
    g.el.style.transform = `translate(${sc.x}px, ${sc.y}px) translate(-50%, -100%)`;
    g.el.hidden = false;
  }
  for (const [n, g] of tags) if (!seen.has(n)) { g.el.hidden = true; if (!list.some(o => o.name === n)) { g.el.remove(); tags.delete(n); } }
}

/* ---------------- Commandes ---------------- */
const keys = new Set(), canvas = $('#view');
let hover = null, ctxWho = null, aiming = null, held = 'tomate', lastThrow = 0, lastEmote = 0, drag = null, hoverAt = 0, lookAt = 0, ghost = null;
const touch = { x: 0, y: 0, run: false };
const playing = () => document.body.classList.contains('playing') || screen === 'room';
const socialOk = () => {
  const s = S; if (!s || s.spectator) return false;
  if (!s.roles || ['lobby', 'roundEnd', 'over'].includes(s.phase)) return true;
  return alive(s, s.me) && s.phase !== 'night';
};
function doEmote(e, to = null) {
  if (!socialOk()) return toast('Pas maintenant…');
  if (now() - lastEmote < 1.2) return;
  lastEmote = now();
  socket.emit('emote', e, e === 'pointer' ? to ?? hover ?? ctxWho : to);
}
function doToss(item, to) {
  if (!socialOk()) return toast('Pas maintenant…');
  if (S.roles && S.phase !== 'lobby' && !alive(S, to) && !['roundEnd', 'over'].includes(S.phase)) return toast('On ne lance rien sur un fantôme');
  const wait = 2 - (now() - lastThrow);
  if (wait > 0) return toast(`Encore ${wait.toFixed(1)} s pour recharger`);
  lastThrow = now(); audio();
  socket.emit('toss', item, to);
}
function renderBars() {
  $('#emoteBar').innerHTML = '<button id="emoteBtn" class="wide-btn" title="Emotes : maintiens G, vise, relâche">😀 Emotes<small>G</small></button>';
  $('#itemBar').innerHTML = ITEM_LIST.map(i => `<button data-i="${i}" class="${held === i ? 'on' : ''}" title="Lancer : ${LG.ITEMS[i].name} (molette pour changer)">${LG.ITEMS[i].icon}</button>`).join('');
}
renderBars();
$('#emoteBar').onclick = e => { if (e.target.closest('#emoteBtn')) { audio(); wheel.open ? closeWheel(false) : openWheel(); } };
// Roue des emotes : maintenir G (ou le bouton), viser une emote avec la souris, relâcher (ou cliquer).
const wheel = { open: false, sel: -1, vx: 0, vy: 0 };
$('#wheel').insertAdjacentHTML('afterbegin', EMOTE_LIST.map((e, k) => { const a = -Math.PI / 2 + (k * Math.PI * 2) / EMOTE_LIST.length; return `<button data-k="${k}" style="left:${50 + Math.cos(a) * 37}%;top:${50 + Math.sin(a) * 37}%" title="${LG.EMOTES[e].name}">${LG.EMOTES[e].icon}</button>`; }).join(''));
function wheelSel(k) { wheel.sel = k; [...$('#wheel').querySelectorAll('[data-k]')].forEach(b => b.classList.toggle('on', +b.dataset.k === k)); $('#wheelLabel').innerHTML = k >= 0 ? `<b>${LG.EMOTES[EMOTE_LIST[k]].icon}</b>${LG.EMOTES[EMOTE_LIST[k]].name}` : '<small>Vise une emote<br>puis relâche</small>'; }
function openWheel() { if (!socialOk()) return toast('Pas maintenant…'); if (wheel.open) return; wheel.open = true; wheel.vx = wheel.vy = 0; wheelSel(-1); $('#wheel').hidden = false; }
function closeWheel(fire) { if (!wheel.open) return; wheel.open = false; $('#wheel').hidden = true; if (fire && wheel.sel >= 0) { audio(); doEmote(EMOTE_LIST[wheel.sel], hover); } }
$('#wheel').addEventListener('pointerover', e => { const b = e.target.closest('[data-k]'); if (b) wheelSel(+b.dataset.k); });
$('#wheel').addEventListener('click', e => { const b = e.target.closest('[data-k]'); if (b) { wheelSel(+b.dataset.k); closeWheel(true); } else closeWheel(false); });
$('#itemBar').onclick = e => {
  const b = e.target.closest('[data-i]'); if (!b) return;
  held = b.dataset.i; aiming = locked() ? null : held; renderBars();
  toast(`${LG.ITEMS[held].icon} prêt : vise un villageois et clique`, 2200);
};
function openCtx(n, x, y) {
  const s = S; if (!s) return;
  ctxWho = n;
  const ok = socialOk(), live = alive(s, n) || !s.roles || ['lobby', 'roundEnd', 'over'].includes(s.phase);
  $('#ctxName').textContent = `${n}${s.roles?.[n] && (!alive(s, n) || s.role === 'loup' || !alive(s, s.me)) ? ` · ${roleTxt(s.roles[n])}` : ''}`;
  $('#ctxItems').innerHTML = ok && live ? ITEM_LIST.map(i => `<button data-i="${i}" title="${LG.ITEMS[i].name}">${LG.ITEMS[i].icon}</button>`).join('') : '';
  const voteOk = s.phase === 'vote' && alive(s, s.me) && alive(s, n) && !s.spectator;
  $('#ctxMore').innerHTML = `${voteOk ? `<button class="vote" data-a="vote">${s.votes?.[s.me] === n ? '↩ Retirer mon vote' : `🗳 Voter contre ${esc(n)}`}</button>` : ''}${ok && live ? `<button class="ghost" data-a="point">👉 L’accuser du doigt</button>` : ''}${!ok && !voteOk ? '<p class="hint">Rien à faire pour l’instant.</p>' : ''}`;
  const c = $('#ctx'); c.hidden = false;
  const w = c.offsetWidth, h = c.offsetHeight;
  c.style.left = `${Math.max(8, Math.min(innerWidth - w - 8, x + 12))}px`; c.style.top = `${Math.max(8, Math.min(innerHeight - h - 8, y - h / 2))}px`;
  view.mark(n, 'target');
}
function closeCtx() { $('#ctx').hidden = true; if (ctxWho) view.mark(ctxWho, null); ctxWho = null; }
$('#ctxItems').onclick = e => { const b = e.target.closest('[data-i]'); if (b && ctxWho) { doToss(b.dataset.i, ctxWho); closeCtx(); } };
$('#ctxMore').onclick = e => { const b = e.target.closest('[data-a]'); if (!b || !ctxWho) return; if (b.dataset.a === 'vote') castVote(ctxWho); else doEmote('pointer', ctxWho); closeCtx(); };
// Vue à la première personne : un clic dans l'image capture la souris (elle tourne le regard, Échap la libère).
// Souris capturée : viseur au centre ; clic = lancer l'objet choisi sur celui qu'on vise ; clic droit = son menu ; molette = objet.
// Souris libre ou tactile : glisser pour tourner la tête, cliquer sur quelqu'un pour son menu.
const fp = () => view.cam.mode === 'fp';
const locked = () => document.pointerLockElement === canvas;
const clampP = v => Math.max(-1.35, Math.min(1.35, v));
function turn(dx, dy, k) {
  const c = view.cam;
  if (fp()) { c.yaw -= dx * k; c.pitch = clampP(c.pitch - dy * k); } else { c.showYaw -= dx * k * 1.4; c.showPitch = Math.max(-0.1, Math.min(0.9, c.showPitch + dy * k)); }
  lookAt = now();
}
const aimed = () => { const n = view.pick(innerWidth / 2, innerHeight / 2); return n && n !== S?.me && n !== PREVIEW ? n : null; };
function click(x, y) {
  if (wheel.open) { closeWheel(true); return; }
  const n = locked() ? aimed() : view.pick(x, y), my = S?.me;
  if (locked()) { if (n) doToss(held, n); return; }
  if (!n || n === my || n === PREVIEW) { closeCtx(); if (fp() && !coarse && playing()) canvas.requestPointerLock?.(); return; }
  if (aiming) { doToss(aiming, n); return; }
  openCtx(n, x, y);
}
canvas.addEventListener('pointerdown', e => { if (e.button === 2) return; audio(); drag = { id: e.pointerId, x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, moved: false }; });
canvas.addEventListener('contextmenu', e => {
  e.preventDefault();
  const lock = locked(), n = lock ? aimed() : view.pick(e.clientX, e.clientY);
  if (!n || n === S?.me || n === PREVIEW) return;
  if (lock) document.exitPointerLock();
  openCtx(n, lock ? innerWidth / 2 : e.clientX, lock ? innerHeight / 2 : e.clientY);
});
addEventListener('mousemove', e => {
  if (!locked()) return;
  if (!wheel.open) return turn(e.movementX, e.movementY, 0.0022);
  wheel.vx += e.movementX; wheel.vy += e.movementY;
  const l = Math.hypot(wheel.vx, wheel.vy);
  if (l > 120) { wheel.vx *= 120 / l; wheel.vy *= 120 / l; }
  if (l > 25) { const a = Math.atan2(wheel.vy, wheel.vx) + Math.PI / 2, n = EMOTE_LIST.length; wheelSel(((Math.round(a / ((Math.PI * 2) / n)) % n) + n) % n); }
});
addEventListener('pointermove', e => {
  if (locked()) return;
  if (drag && e.pointerId === drag.id) {
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) > 6) drag.moved = true;
    if (drag.moved) turn(dx, dy, 0.005);
    drag.x = e.clientX; drag.y = e.clientY;
  } else if (e.target === canvas && e.pointerType === 'mouse' && performance.now() - hoverAt > 80) {
    hoverAt = performance.now();
    const n = view.pick(e.clientX, e.clientY), h = n && n !== S?.me && n !== PREVIEW ? n : null;
    if (h !== hover) { if (hover && hover !== ctxWho) view.mark(hover, null); hover = h; if (h && h !== ctxWho) view.mark(h, 'hover'); canvas.style.cursor = h ? (aiming ? 'crosshair' : 'pointer') : fp() ? 'crosshair' : 'grab'; }
  }
});
addEventListener('pointerup', e => { if (drag && e.pointerId === drag.id) { if (!drag.moved) click(e.clientX, e.clientY); drag = null; } });
canvas.addEventListener('wheel', e => { e.preventDefault(); const k = ITEM_LIST.indexOf(held), n = ITEM_LIST.length; held = ITEM_LIST[(k + (e.deltaY > 0 ? 1 : -1) + n) % n]; renderBars(); toast(`${LG.ITEMS[held].icon} ${LG.ITEMS[held].name}`, 900); }, { passive: false });
document.addEventListener('pointerlockchange', () => { if (locked()) { aiming = null; closeCtx(); } $('#cross').hidden = !locked(); $('#lockHint').hidden = locked(); });
// Ce que je vise au centre de l'écran (souris capturée)
setInterval(() => {
  if (!locked()) { $('#aimName').hidden = true; return; }
  const n = aimed();
  if (n !== hover) { if (hover && hover !== ctxWho) view.mark(hover, null); hover = n; if (n) view.mark(n, 'hover'); }
  $('#cross').classList.toggle('on', !!n);
  $('#aimName').hidden = !n; if (n) $('#aimName').textContent = `${n} · clic : ${LG.ITEMS[held].icon} · F : accuser${S?.phase === 'vote' ? ' · V : voter' : ''} · clic droit : menu`;
}, 100);
addEventListener('keydown', e => {
  if (e.target.closest?.('input, select, textarea')) { if (e.key === 'Escape') e.target.blur(); return; }
  if (e.key === 'Escape') { closeWheel(false); closeCtx(); aiming = null; renderBars(); $('#roleCard').hidden = true; return; }
  if (e.key === 'Enter' && !$('#chatIn').disabled && screen === 'game') { e.preventDefault(); $('#chatIn').focus(); return; }
  if (!playing()) return;
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  keys.add(e.code);
  if (e.repeat) return;
  const d = /^(Digit|Numpad)(\d)$/.exec(e.code);
  if (d) { const k = (Number(d[2]) + 9) % 10; if (EMOTE_LIST[k]) { audio(); doEmote(EMOTE_LIST[k]); } }
  if (e.code === 'KeyE') toggleSit();
  if (e.code === 'KeyG') openWheel();
  if (e.code === 'KeyF') { const n = locked() ? aimed() : hover; if (n) doEmote('pointer', n); }
  if (e.code === 'KeyV' && S?.phase === 'vote') { const n = locked() ? aimed() : hover; if (n) castVote(n); }
});
addEventListener('keyup', e => { keys.delete(e.code); if (e.code === 'KeyG') closeWheel(true); });
addEventListener('blur', () => keys.clear());
// Tactile : joystick et boutons
$('#touch').hidden = !coarse;
{
  const stick = $('#stick'), knob = stick.querySelector('i');
  let id = null;
  const move = e => { const r = stick.getBoundingClientRect(), dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2), l = Math.hypot(dx, dy), m = r.width / 2, k = l > m ? m / l : 1; touch.x = (dx * k) / m; touch.y = (dy * k) / m; knob.style.transform = `translate(${dx * k}px, ${dy * k}px)`; };
  stick.addEventListener('pointerdown', e => { e.stopPropagation(); id = e.pointerId; stick.setPointerCapture(id); move(e); audio(); });
  stick.addEventListener('pointermove', e => e.pointerId === id && move(e));
  const end = () => { id = null; touch.x = touch.y = 0; knob.style.transform = ''; };
  stick.addEventListener('pointerup', end); stick.addEventListener('pointercancel', end);
  $('#tSit').onclick = toggleSit;
  $('#tRun').onclick = () => { touch.run = !touch.run; $('#tRun').classList.toggle('on', touch.run); };
}
function seatTaken(k) { for (const [n, b] of remotes) if (n !== S?.me && b.at(-1)?.sit === k) return true; return false; }
function toggleSit() {
  if (!me) return;
  if (me.sit >= 0) { const s = LG.SEATS[me.sit]; me.sit = -1; me.x -= s.x * 0.12; me.z -= s.z * 0.12; LG.collide(me); return; }
  let best = -1, bd = 1.9;
  LG.SEATS.forEach((s, k) => { const d = Math.hypot(s.x - me.x, s.z - me.z); if (d < bd && !seatTaken(k)) { bd = d; best = k; } });
  if (best < 0) return toast('Approche-toi d’un siège libre');
  const s = LG.SEATS[best]; Object.assign(me, { x: s.x, z: s.z, ry: s.ry, sit: best });
  sendPos(true);
}
let lastSend = 0;
function sendPos(force) { const t = performance.now(); if (!me || (!force && t - lastSend < 66)) return; lastSend = t; socket.volatile.emit('pos', { x: +me.x.toFixed(2), z: +me.z.toFixed(2), ry: +me.ry.toFixed(2), s: me.sit }); }

let toastTimer = 0;
function toast(text, ms = 2200) { const h = $('#aimHint'); h.textContent = text; h.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => (h.hidden = true), ms); }
function banner(title, text) {
  const b = $('#banner'); b.hidden = true; void b.offsetWidth;
  $('#bannerTitle').textContent = title; $('#bannerText').innerHTML = esc(text).replace(/\n/g, '<br>'); b.hidden = false;
  clearTimeout(banner.t); banner.t = setTimeout(() => (b.hidden = true), 4700);
}
const feed = text => ui.feed(text, 6000);

/* ---------------- Boucle ---------------- */
let last = performance.now(), ambientAt = 0, tickLeft = -1;
const lastPos = new Map();
function frame(t0) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, (t0 - last) / 1000); last = t0;
  const t = t0 / 1000, s = ui.room, list = [];
  const wide = innerWidth > 820, c = view.cam;
  if (!s) {
    // Accueil : mon villageois au milieu de la place, vu de face
    list.push({ name: PREVIEW, x: 0, z: 3, ry: 0, visible: true, color: '#e8b84a', ring: false });
    c.mode = 'show'; c.want.set(wide ? -0.75 : 0, wide ? 1.12 : 1.35, 3); c.wantDist = wide ? 2.7 : 3.6;
    if (window.lg?.close) { c.want.set(0, window.lg.close[0], 3); c.wantDist = window.lg.close[1]; } // captures de test
    if (!drag) { c.showYaw += (0 - c.showYaw) * dt * 0.8; c.showPitch += (0.1 - c.showPitch) * dt * 0.8; }
    fpKey = '';
  } else if (!inGame(s)) {
    // Salon : tout le monde debout en cercle ; je vois par mes yeux
    s.players.forEach((p, k) => { const st = LG.SEATS[k]; list.push({ name: p.name, x: st.x * 0.86, z: st.z * 0.86, ry: st.ry, visible: p.name !== s.me, color: p.color, bot: p.bot }); });
    const st = LG.SEATS[Math.max(0, s.players.findIndex(p => p.name === s.me))];
    if (s.spectator) floatGhost(s, dt); else { c.mode = 'fp'; c.eye.set(st.x * 0.86, 1.52, st.z * 0.86); }
    faceCenter(`salon${s.code}`, st);
  } else {
    const night = s.phase === 'night', live = alive(s, s.me) && !s.spectator;
    // Moi, quand je me promène
    if (me && s.phase === 'day') {
      const k = x => keys.has(x);
      let fwd = (k('KeyW') || k('ArrowUp') ? 1 : 0) - (k('KeyS') || k('ArrowDown') ? 1 : 0) - touch.y;
      let side = (k('KeyD') || k('ArrowRight') ? 1 : 0) - (k('KeyA') || k('ArrowLeft') ? 1 : 0) + touch.x;
      const l = Math.hypot(fwd, side);
      if (l > 0.1) {
        fwd /= Math.max(1, l); side /= Math.max(1, l);
        const y = c.yaw, fx = -Math.sin(y), fz = -Math.cos(y), run = k('ShiftLeft') || k('ShiftRight') || touch.run, sp = (run ? LG.RUN : LG.SPEED) * dt;
        const vx = (fx * fwd - fz * side) * sp, vz = (fz * fwd + fx * side) * sp;
        me.x += vx; me.z += vz; me.sit = -1; me.bob = (me.bob ?? 0) + dt * (run ? 13 : 9);
        LG.collide(me);
      }
      if (me.sit < 0) me.ry = c.yaw + Math.PI; // mon corps suit mon regard
      sendPos();
    }
    for (const p of s.players) {
      const mine = p.name === s.me && me && s.phase === 'day';
      const r = mine ? me : remoteAt(p.name, now() - 0.1) ?? { ...seatOf(s, p.name), sit: s.seats?.[p.name] };
      list.push({ name: p.name, x: r.x, z: r.z, ry: r.ry, seated: r.sit >= 0 && alive(s, p.name), ghost: !alive(s, p.name), visible: !night && p.name !== s.me, color: p.color, bot: p.bot });
    }
    // Mes yeux : là où je marche, ou assis à ma place ; fantôme ou spectateur : je flotte au-dessus du village
    if (me && s.phase === 'day') { c.mode = 'fp'; c.eye.set(me.x, me.sit >= 0 ? 1.24 : 1.52 + Math.sin(me.bob ?? 0) * 0.025, me.z); }
    else if (live) { const r = remoteAt(s.me, now() - 0.1) ?? seatOf(s, s.me); c.mode = 'fp'; c.eye.set(r.x, 1.24, r.z); }
    else floatGhost(s, dt);
    // Le regard se tourne tout seul vers ce qui se passe (sauf si je bouge la souris)
    const focus = s.phase === 'verdict' ? s.verdict?.name : s.phase === 'hunter' ? (s.shot?.who ?? s.hunter) : s.phase === 'dawn' ? s.deaths?.[0]?.name : null;
    if (focus && focus !== s.me && now() - lookAt > 1.5) lookToward(focus, dt);
    $('#veil').classList.toggle('sleep', night && live && s.role !== 'loup' && $('#actionCard').hidden);
    hud(s, t);
  }
  // Pendant mon emote : je me vois, de face
  const mine = s && list.find(o => o.name === s.me);
  if (selfView && now() < selfView.until && mine && c.mode === 'fp') {
    mine.visible = true;
    c.mode = 'show'; c.want.set(mine.x, mine.seated ? 0.95 : 1.2, mine.z); c.wantDist = 2.6; c.showYaw = mine.ry; c.showPitch = 0.1;
    if (selfView.fresh) { selfView.fresh = false; c.target.copy(c.want); c.dist = 2.6; }
  } else selfView = null;
  // Vitesse de chacun (pour l'animation de marche)
  for (const o of list) {
    const lp = lastPos.get(o.name), d = lp ? Math.hypot(o.x - lp.x, o.z - lp.z) : 0;
    const sp = dt > 0 ? d / dt : 0; o.moving = lp ? lp.sp + (Math.min(8, sp) - lp.sp) * Math.min(1, dt * 10) : 0;
    lastPos.set(o.name, { x: o.x, z: o.z, sp: o.moving });
    view.place(o.name, o);
  }
  view.update(dt, t);
  labels(list);
  // Ambiance : oiseaux le jour, grillons et chouette la nuit
  if (sound() && t > ambientAt) { ambientAt = t + 2 + Math.random() * 5; const k = view.env.k; if (k < 0.45) SFX.chirp(); else if (k > 0.8) (Math.random() < 0.15 ? SFX.owl : SFX.cricket)(); }
  if (!loaded) { loaded = true; $('#loading').classList.add('done'); }
}
let loaded = false, fpKey = '', selfView = null;
// Regarder vers le centre de la place depuis sa place (une fois, en arrivant)
function faceCenter(key, st) { if (fpKey === key) return; fpKey = key; view.cam.yaw = Math.atan2(st.x, st.z); view.cam.pitch = -0.08; }
// Tourner la tête vers quelqu'un, en douceur
function lookToward(n, dt) {
  const h = view.headAt(n); if (!h) return;
  const c = view.cam, dx = h.x - c.eye.x, dy = h.y - 0.42 - c.eye.y, dz = h.z - c.eye.z;
  let dyaw = Math.atan2(-dx, -dz) - c.yaw; dyaw = Math.atan2(Math.sin(dyaw), Math.cos(dyaw));
  const f = Math.min(1, dt * 2.5);
  c.yaw += dyaw * f; c.pitch += (clampP(Math.atan2(dy, Math.hypot(dx, dz))) - c.pitch) * f;
}
// Fantôme ou spectateur : on flotte librement au-dessus de la place (ZQSD, Espace pour monter, C pour descendre)
function floatGhost(s, dt) {
  const c = view.cam;
  if (!ghost) { const st = seatOf(s, s.me) ?? { x: 0, z: 9 }; ghost = { x: st.x * 1.2, z: st.z * 1.2, y: 2.6 }; c.yaw = Math.atan2(ghost.x, ghost.z); c.pitch = -0.2; }
  const k = x => keys.has(x), fwd = (k('KeyW') || k('ArrowUp') ? 1 : 0) - (k('KeyS') || k('ArrowDown') ? 1 : 0) - touch.y, side = (k('KeyD') || k('ArrowRight') ? 1 : 0) - (k('KeyA') || k('ArrowLeft') ? 1 : 0) + touch.x;
  const y = c.yaw, fx = -Math.sin(y), fz = -Math.cos(y), sp = 5 * dt;
  ghost.x += (fx * fwd - fz * side) * sp; ghost.z += (fz * fwd + fx * side) * sp;
  ghost.y = Math.max(0.8, Math.min(8, ghost.y + ((k('Space') ? 1 : 0) - (k('KeyC') ? 1 : 0)) * sp));
  const d = Math.hypot(ghost.x, ghost.z); if (d > 30) { ghost.x *= 30 / d; ghost.z *= 30 / d; }
  c.mode = 'fp'; c.eye.set(ghost.x, ghost.y + Math.sin(performance.now() / 900) * 0.05, ghost.z);
}
const PHASE = {
  reveal: s => ['🃏', 'Les rôles sont distribués', 'Regarde bien ta carte…'],
  night: s => ['🌙', `Nuit ${s.dayNo}`, s.step === 'witch' ? 'La sorcière se réveille' : 'Les loups-garous choisissent leur victime'],
  dawn: s => ['🌅', `Aube du jour ${s.dayNo}`, s.deaths.length ? `${s.deaths.length} mort${s.deaths.length > 1 ? 's' : ''} cette nuit` : 'Personne n’est mort'],
  day: s => ['☀️', `Jour ${s.dayNo}`, 'Promenez-vous, discutez, accusez'],
  vote: s => ['🗳', 'Le vote', `${Object.keys(s.votes).length}/${s.players.filter(p => alive(s, p.name)).length} ont voté`],
  verdict: s => ['⚖️', 'Le verdict', s.verdict?.name ? `${s.verdict.name} quitte le village` : 'Personne n’est chassé'],
  hunter: s => ['🏹', 'Le chasseur', `${s.hunter} vise…`],
  roundEnd: s => ['🏁', 'Fin de la partie', s.winner === 'loups' ? 'Victoire des loups-garous' : 'Victoire du village'],
  over: () => ['🏆', 'Fin de la soirée', ''],
};
function hud(s, t) {
  const [icon, title, sub] = PHASE[s.phase]?.(s) ?? ['', '', ''];
  $('#phaseIcon').textContent = icon; $('#phaseTitle').textContent = title; $('#phaseSub').textContent = sub;
  const left = s.deadline ? Math.max(0, (s.deadline - (Date.now() + offset)) / 1000) : 0, total = s.deadline ? (s.deadline - phaseT0) / 1000 : 1, sec = Math.ceil(left);
  $('#timer').textContent = s.deadline ? `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}` : '';
  $('#timer').classList.toggle('hurry', s.deadline && left < 6 && ['day', 'vote', 'night', 'hunter'].includes(s.phase));
  $('#phaseBar').style.width = `${Math.max(0, Math.min(100, (left / Math.max(1, total)) * 100))}%`;
  if (['vote', 'night'].includes(s.phase) && sec <= 3 && sec > 0 && sec !== tickLeft) { tickLeft = sec; SFX.tick(); }
  const humans = s.players.filter(p => alive(s, p.name) && !p.bot && p.connected).length;
  $('#rushBtn').hidden = !(s.phase === 'day' && alive(s, s.me) && !s.spectator);
  $('#rushBtn').textContent = `⏩ On vote ! (${s.ready.filter(n => !s.players.find(p => p.name === n)?.bot).length}/${humans})`;
  $('#rushBtn').classList.toggle('on', s.ready.includes(s.me));
  $('#actions').classList.toggle('off', !socialOk());
}
if (location.hostname === 'localhost') window.lg = { view, look: v => { look = v; lookChanged(); }, toss: (i, n) => doToss(i, n), emote: e => doEmote(e), state: () => S }; // pour les captures de test
requestAnimationFrame(frame);
show('home');
