// Boule de Pute : accueil (pseudo, personnage, modes, boutique, statistiques, réglages), salon et manches.
// Le navigateur lit les touches et le regard (souris) 60 fois par seconde, les envoie numérotés au serveur (« in ») et
// fait bouger son joueur tout de suite avec la même physique ; à chaque état reçu (« snap »), il reprend la position du
// serveur et rejoue ce que le serveur n'a pas vu. Les autres joueurs sont affichés avec un léger retard, lissé.
// Autour : ralenti des renvois parfaits (le temps affiché ralentit puis rattrape), compteur d'échanges et commentateur,
// cercle de timing, mire de visée, emotes, replay de son élimination vu depuis la boule, musique, commandes tactiles.
import { createArena, drawPortrait, LOOKS, TEAM, TEAM_NAMES, ACC_NAMES, ACC_PRICES, TRAIL_NAMES, TRAIL_PRICES, EMOTE_ICONS } from './render.js';
import { $, $$, esc, store, audio, sound, party } from '/shared/party.js';

const BD = window.BD, { IN, B, P } = BD;
const socket = io('/boule');
const V = createArena($('#view'));
addEventListener('resize', () => V.resize());

/* ---------------- Réglages (gardés dans le navigateur) ---------------- */
const SET = { sens: 1, invert: false, fov: 68, music: 0.5, fx: 0.8, alarm: 0.7, timing: true, ...(() => { try { return JSON.parse(store.get('boule-settings')) ?? {}; } catch { return {}; } })() };
const saveSet = () => store.set('boule-settings', JSON.stringify(SET));

/* ---------------- Sons : trois volumes (effets, alarmes, musique) ---------------- */
const buses = {};
function bus(name) {
  const ac = sound(); if (!ac) return null;
  if (!buses[name]) { buses[name] = ac.createGain(); buses[name].connect(ac.destination); }
  buses[name].gain.value = SET[name];
  return buses[name];
}
function tone(f0, f1, dur, type = 'sine', vol = 0.12, at = 0, out = 'fx') {
  const ac = sound(), dst = bus(out); if (!ac || !dst) return;
  const t = ac.currentTime + at, o = ac.createOscillator(), g = ac.createGain();
  o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g).connect(dst); o.start(t); o.stop(t + dur + 0.02);
}
function noise(dur, freq, vol, type = 'bandpass', to, at = 0, out = 'fx') {
  const ac = sound(), dst = bus(out); if (!ac || !dst) return;
  const t = ac.currentTime + at, b = ac.createBuffer(1, Math.ceil(ac.sampleRate * dur), ac.sampleRate), d = b.getChannelData(0);
  for (let k = 0; k < d.length; k++) d[k] = Math.random() * 2 - 1;
  const s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
  s.buffer = b; f.type = type; f.frequency.setValueAtTime(freq, t); if (to) f.frequency.exponentialRampToValueAtTime(to, t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + Math.min(0.03, dur / 4)); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  s.connect(f).connect(g).connect(dst); s.start(t);
}
const blip = (f0, f1, dur, type, vol, at) => tone(f0, f1, dur, type, vol, at);
const SFX = {
  swing: () => noise(0.18, 1800, 0.12, 'bandpass', 500),
  reflect: (v, perfect) => { const p = 1 + Math.min(1.5, v / 40); tone(140 * p, 50 * p, 0.25, 'sine', 0.35); noise(0.12, 2500, 0.2, 'highpass'); tone(600 * p, 1200 * p, 0.1, 'square', 0.06); },
  ding: power => { for (const [f, at] of [[1568, 0], [2093, 0.06], [3136, 0.12]]) tone(f, f, 1.2 + power, 'triangle', 0.16, at); tone(98, 40, 0.6, 'sine', 0.4); noise(0.5, 4000, 0.15, 'highpass', 800); },
  kill: () => { noise(0.8, 300, 0.4, 'lowpass', 60); tone(880, 110, 0.6, 'square', 0.12, 0.05); tone(220, 330, 0.12, 'square', 0.08, 0.45); tone(330, 180, 0.4, 'square', 0.08, 0.57); },
  fall: () => { tone(1200, 120, 1.4, 'sine', 0.15); noise(0.4, 600, 0.2, 'lowpass', 100, 1.3); },
  splash: () => noise(0.25, 900, 0.12, 'bandpass', 300),
  piston: () => { tone(80, 300, 0.25, 'square', 0.12); noise(0.2, 500, 0.2, 'lowpass'); },
  thud: () => noise(0.1, 400, 0.18, 'lowpass'),
  jump: () => tone(300, 600, 0.1, 'triangle', 0.05),
  beep: f => tone(f, f, 0.06, 'square', 0.05, 0, 'alarm'),
  round: () => [523, 659, 784, 1046, 1318].forEach((f, k) => tone(f, f, 0.24, 'triangle', 0.11, k * 0.1)),
  coin: () => { tone(988, 988, 0.08, 'square', 0.05); tone(1319, 1319, 0.2, 'square', 0.05, 0.08); },
  hype: () => { tone(400, 1600, 0.4, 'sawtooth', 0.05); noise(0.6, 1200, 0.1, 'bandpass', 3000); },
};
// le bourdonnement de la boule (volume « alarmes »)
let hum = null;
function humTo(v, near) {
  const ac = sound(); if (!ac) return;
  if (!hum) { const o = ac.createOscillator(), o2 = ac.createOscillator(), f = ac.createBiquadFilter(), g = ac.createGain(); o.type = 'sawtooth'; o2.type = 'sine'; f.type = 'lowpass'; f.frequency.value = 900; g.gain.value = 0; o.connect(f); o2.connect(f); f.connect(g).connect(bus('alarm')); o.start(); o2.start(); hum = { o, o2, g }; }
  const t = ac.currentTime; hum.o.frequency.setTargetAtTime(70 + v * 5, t, 0.05); hum.o2.frequency.setTargetAtTime(140 + v * 10, t, 0.05); hum.g.gain.setTargetAtTime(v ? 0.015 + near * 0.06 : 0, t, 0.08);
}
// Musique arcade : batterie, basse et arpège joués en boucle (128 battements par minute), seulement en partie.
const music = { on: false, next: 0, step: 0 };
const BASS = [41, 41, 53, 41, 44, 44, 56, 46], ARP = [65, 68, 72, 75, 72, 68];
const midi = n => 440 * 2 ** ((n - 69) / 12);
setInterval(() => {
  const ac = sound(); if (!ac || !music.on || !SET.music) return;
  const spb = 60 / 128 / 2; // croches
  if (music.next < ac.currentTime) music.next = ac.currentTime + 0.05;
  while (music.next < ac.currentTime + 0.2) {
    const s = music.step++, at = music.next - ac.currentTime;
    if (s % 4 === 0) { tone(120, 45, 0.18, 'sine', 0.35, at, 'music'); }
    if (s % 8 === 4) noise(0.12, 1800, 0.12, 'bandpass', 900, at, 'music');
    noise(0.04, 8000, 0.03, 'highpass', null, at, 'music');
    if (s % 2 === 0) { const n = BASS[Math.floor(s / 4) % BASS.length]; tone(midi(n), midi(n), spb * 1.8, 'square', 0.05, at, 'music'); }
    if (Math.floor(s / 16) % 2) tone(midi(ARP[s % ARP.length]), midi(ARP[s % ARP.length]), spb * 0.9, 'triangle', 0.03, at, 'music');
    music.next += spb;
  }
}, 50);

/* ---------------- Profil : pièces, objets, statistiques ---------------- */
const BASE = { coins: 100, looks: ['bobby', 'mama', 'tonton', 'zaza', 'robox', 'mamie'], accs: ['aucun'], trails: ['classique'], look: 'bobby', acc: 'aucun', trail: 'classique', stats: { matches: 0, wins: 0, reflects: 0, perfect: 0, kills: 0, deaths: 0, bestSpeed: 0, bestRally: 0, survie: 0 } };
let PR = null; try { PR = JSON.parse(store.get('boule-profile')); } catch { /* illisible */ }
PR = { ...BASE, ...(PR ?? {}), stats: { ...BASE.stats, ...(PR?.stats ?? {}) } };
if (!PR.looks.includes(PR.look)) PR.look = 'bobby';
const saveP = () => store.set('boule-profile', JSON.stringify(PR));
function earn(n, why) { if (!n) return; PR.coins += n; saveP(); renderCoins(); const el = document.createElement('div'); el.className = 'coinpop'; el.textContent = `+${n} 🪙 ${why}`; document.body.append(el); setTimeout(() => el.remove(), 1800); SFX.coin(); }
function renderCoins() { for (const el of $$('.coins')) el.textContent = `${PR.coins} 🪙`; }

/* ---------------- Personnages et salon ---------------- */
function picks(box) { box.innerHTML = Object.entries(LOOKS).map(([id, L]) => `<button class="char ${PR.looks.includes(id) ? '' : 'locked'}" data-look="${id}"><canvas width="160" height="160"></canvas><b>${esc(L.name)}</b>${PR.looks.includes(id) ? '' : `<span class="price">🔒 ${L.price} 🪙</span>`}</button>`).join(''); }
function refreshPicks() { picks($('#homePicks')); picks($('#picks')); renderPicks(); }
function renderPicks() { for (const b of $$('[data-look]')) b.classList.toggle('on', b.dataset.look === PR.look); }
function buy(kind, id, price, name) {
  if (PR.coins < price) { toast(`Il te faut ${price} 🪙 (tu en as ${PR.coins}) : renvoie, élimine, gagne !`); return false; }
  if (!confirm(`Débloquer ${name} pour ${price} pièces ?`)) return false;
  PR.coins -= price; PR[kind].push(id); saveP(); renderCoins(); SFX.coin(); return true;
}
const sendPick = () => { if (ui.room && ['lobby', 'over'].includes(ui.room.phase)) act('pick', PR.look, PR.acc, PR.trail); };
for (const box of [$('#homePicks'), $('#picks')]) box.onclick = e => { const b = e.target.closest('[data-look]'); if (!b) return; audio(); const id = b.dataset.look; if (!PR.looks.includes(id) && !buy('looks', id, LOOKS[id].price, LOOKS[id].name)) return; PR.look = id; saveP(); refreshPicks(); sendPick(); tone(500, 800, 0.1, 'triangle', 0.06); };
setInterval(() => { if (document.body.classList.contains('playing')) return; const t = performance.now() / 1000; for (const cv of $$('canvas[data-look-c], .char canvas')) if (cv.offsetParent) { const id = cv.dataset.lookC ?? cv.parentNode.dataset.look; drawPortrait(cv, id, +(cv.dataset.team ?? (cv.closest('.on') ? 0 : 1)), t, cv.dataset.acc ?? (id === PR.look ? PR.acc : 'aucun')); } }, 60);
refreshPicks(); renderCoins();

const MODE_NAMES = { equipes: '⚔️ Équipes', chacun: '🤪 Chacun pour soi', patate: '💣 Patate chaude', survie: '💀 Survie', entrainement: '🎯 Entraînement', coupe: '🏆 Coupe des amis' };
$('#modeSel').innerHTML = Object.entries(MODE_NAMES).map(([k, v]) => `<option value="${k}">${v}</option>`).join('');
$('#arenaSel').innerHTML = Object.entries(BD.ARENAS).map(([k, a]) => `<option value="${k}">${a.name}</option>`).join('') + '<option value="hasard">🎲 Au hasard</option>';
const ui = party({
  id: 'boule', socket, max: 8, bots: 3, busy: '💥 en partie', onError: t => toast(t),
  onShow: sc => { if (sc !== 'game') { humTo(0, 0); music.on = false; document.exitPointerLock?.(); } else music.on = true; },
  onRoom: (s, host) => {
    for (const [id, k] of [['teamSel', 'teamSize'], ['levelSel', 'level'], ['modeSel', 'mode'], ['arenaSel', 'arena']]) { const el = $(`#${id}`); el.disabled = !host; el.value = String(s.settings[k]); }
    $('#modeHint').textContent = { equipes: 'Deux équipes, chacune dans sa moitié.', chacun: 'Tout le monde contre tout le monde, partout.', patate: 'En équipes, mais la boule explose au bout de 10 s sur celui qu’elle vise.', survie: 'Vous contre des vagues de robots de plus en plus nombreuses.', entrainement: 'Face à un lanceur qui renvoie tout. Personne n’est éliminé.', coupe: 'Tournoi à 4 équipes : demi-finales puis finale.' }[s.settings.mode];
    renderPicks();
  },
});
const { show, act } = ui;
for (const [id, k, num] of [['teamSel', 'teamSize', true], ['levelSel', 'level', true], ['modeSel', 'mode'], ['arenaSel', 'arena']]) $(`#${id}`).onchange = e => act('configure', k, num ? Number(e.target.value) : e.target.value);
// modes en un clic depuis l'accueil (partie privée contre des robots)
async function quick(mode) { audio(); if (!(await ui.enter('create', { private: true }))) return; await act('configure', 'mode', mode); if (mode !== 'survie' && mode !== 'entrainement') for (let k = 0; k < 3; k++) await act('addBot'); act('start'); }
$('#survieBtn').onclick = () => quick('survie');
$('#trainBtn').onclick = () => quick('entrainement');
$('#chacunBtn').onclick = () => quick('chacun');

/* ---------------- États reçus ---------------- */
let S = null, matchKey = '';
const snaps = [];
let syncYaw = false, pred = null, pending = [], seq = 0, vis = { x: 0, z: 0 }, myYaw = 0, winTeam = null, myRally = 0, trainBest = { rally: 0, speed: 0 };
const inMatch = s => s && ['count', 'play', 'roundEnd'].includes(s.phase);
socket.on('state', s => {
  const old = S; S = s;
  const mine = s.players.find(p => p.name === s.me);
  if (mine && mine.look !== PR.look && ['lobby', 'over'].includes(s.phase)) sendPick();
  show(inMatch(s) || s.phase === 'over' ? 'game' : 'room');
  ui.renderRoom();
  const key = `${s.round}.${s.roundNo}.${s.cup?.idx ?? 0}`;
  const me = s.inWorld?.find(p => p.id === s.me);
  if (inMatch(s) && key !== matchKey) { matchKey = key; pred = null; pending = []; snaps.length = 0; winTeam = null; $('#board').hidden = true; syncYaw = true; }
  if (old?.phase !== s.phase) {
    if (s.phase === 'count') countdown();
    if (s.phase === 'play') { banner(s.settings.mode === 'survie' ? `VAGUE ${s.wave} !` : 'RENVOIE-LUI DANS LA GUEULE !', s.settings.mode === 'coupe' ? cupLabel(s) : MODE_NAMES[s.settings.mode]); tone(990, 990, 0.25, 'square', 0.08); }
    if (s.phase === 'roundEnd') humTo(0, 0);
    if (s.phase === 'over') matchOver(s);
  }
  if (s.phase === 'over') showBoard(s); else $('#board').hidden = true;
});
const cupLabel = s => { const c = s.cup; if (!c) return ''; const [a, b] = c.matches[c.idx] ?? []; return `${c.idx < 2 ? `Demi-finale ${c.idx + 1}` : 'FINALE'} : équipe ${a + 1} contre équipe ${b + 1}`; };
let countT = null;
function countdown() { let n = 3; clearInterval(countT); const el = $('#cd'); const tick = () => { el.textContent = n > 0 ? n : '💥'; el.hidden = false; el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop'); tone(n > 0 ? 660 : 990, n > 0 ? 660 : 990, 0.12, 'square', 0.06); if (n-- <= 0) { clearInterval(countT); setTimeout(() => (el.hidden = true), 500); } }; tick(); countT = setInterval(tick, 900); }
socket.on('snap', snap => {
  snaps.push({ at: performance.now(), s: snap });
  while (snaps.length > 40) snaps.shift();
  for (const e of snap.ev) onEvent(e);
  const me = S?.me, mine = snap.p.find(p => p.id === me);
  if (mine) {
    const ack = snap.ack[me] ?? 0, before = pred && { x: pred.x, z: pred.z };
    pred = { ...mine };
    if (syncYaw) { myYaw = mine.yaw; syncYaw = false; } // début de manche : on regarde là où le serveur nous a placés
    pending = pending.filter(([q]) => q > ack);
    const w = { arena: S?.arena, halves: halves(), frame: snap.f };
    for (const [, bits, yaw] of pending) { w.frame++; BD.step(pred, bits, yaw, w); }
    if (before && Math.hypot(before.x - pred.x, before.z - pred.z) < 2) { vis.x += before.x - pred.x; vis.z += before.z - pred.z; }
  }
});
const halves = () => S && S.settings.mode !== 'chacun' && new Set((S.inWorld ?? []).map(p => p.team)).size === 2;
const teamOf = id => S?.inWorld?.find(p => p.id === id)?.team ?? 0;

/* ---------------- Ralenti, commentateur ---------------- */
let lag = 0, slowUntil = 0;
const HYPE = [[5, 'ÇA CHAUFFE !'], [10, 'C’EST DU PING-PONG !'], [15, 'INCROYABLE !'], [20, 'LÉGENDAIRE !'], [30, 'DIVIN !!!'], [45, 'ON N’A JAMAIS VU ÇA !!!']];
function rally(n) {
  const el = $('#rally'); if (n < 2) { el.hidden = true; return; }
  el.hidden = false; el.querySelector('b').textContent = `ÉCHANGE x${n}`; el.classList.remove('pump'); void el.offsetWidth; el.classList.add('pump');
  el.style.setProperty('--h', Math.min(1, n / 25));
  const h = HYPE.find(([k]) => k === n); if (h) { say(h[1]); SFX.hype(); }
}
function say(t) { const el = $('#comment'); el.querySelector('span').textContent = t; el.hidden = true; void el.offsetWidth; el.hidden = false; clearTimeout(say.t); say.t = setTimeout(() => (el.hidden = true), 2200); }

/* ---------------- Événements ---------------- */
function onEvent(e) {
  const me = S?.me;
  if (e.t === 'swing') { if (e.id !== me) SFX.swing(); return; }
  if (e.t === 'jump') { if (e.id !== me) SFX.jump(); return; }
  if (e.t === 'piston') { SFX.piston(); return; }
  if (e.t === 'splash') { V.fx.splash(e.x, e.z); if (Math.random() < 0.3) SFX.splash(); return; }
  if (e.t === 'thud') { V.fx.thud(e.x, e.y, e.z); SFX.thud(); return; }
  if (e.t === 'emote') { if (!e.alive) ui.feed(`👻 ${e.id} ${EMOTE_ICONS[e.e] ?? ''}`); return; }
  if (e.t === 'reflect') {
    const power = Math.min(1, (e.v - B.v0) / 55);
    V.fx.reflect(e, TEAM[teamOf(e.id) % 8], e.perfect, power); SFX.reflect(e.v, e.perfect); recEv.push(e);
    rally(e.hits);
    if (e.perfect) { SFX.ding(power); slowUntil = performance.now() + 300; flash(e.id === me ? '⚡ RENVOI PARFAIT !' : `⚡ ${e.id} : PARFAIT !`); }
    if (e.target === me) toast('⚠️ Elle arrive sur toi !');
    ui.feed(`${e.perfect ? '⚡' : '🏓'} ${e.id} → ${e.target} · ${Math.round(e.v * 3.6)} km/h`);
    if (e.id === me) {
      PR.stats.reflects++; if (e.perfect) PR.stats.perfect++; PR.stats.bestSpeed = Math.max(PR.stats.bestSpeed, Math.round(e.v * 3.6)); PR.stats.bestRally = Math.max(PR.stats.bestRally, e.hits); saveP();
      if (S?.settings.mode === 'entrainement') { trainBest.rally = Math.max(trainBest.rally, e.hits); trainBest.speed = Math.max(trainBest.speed, e.v); V.fx && flash(`${Math.round(e.v * 3.6)} km/h`); }
      else earn(e.perfect ? 5 : 2, e.perfect ? 'renvoi parfait' : 'renvoi');
    }
    return;
  }
  if (e.t === 'miss') { rally(0); if (e.id === me) banner('RATÉ !', `Échange de ${e.hits} · record ${trainBest.rally}`); return; }
  if (e.t === 'kill') {
    V.fx.kill(e); if (e.how === 'chute') SFX.fall(); else SFX.kill(); rally(0);
    const killer = e.by && e.by !== e.id ? e.by : null;
    const how = { chute: 'tombé dans le vide', patate: 'explosé (patate chaude)', boule: 'pulvérisé' }[e.how] ?? 'pulvérisé';
    ui.feed(`💥 ${e.id} ${how}${killer ? ` par ${killer}` : ''}${e.v ? ` (${Math.round(e.v * 3.6)} km/h)` : ''}`);
    if (e.id === me) { banner(e.how === 'chute' ? 'AU REVOIR !' : 'PULVÉRISÉ !', `${e.v ? `${Math.round(e.v * 3.6)} km/h` : 'Trop loin du bord…'}${killer ? ` · merci ${killer}` : ''}`); PR.stats.deaths++; saveP(); startReplay(); }
    else if (killer === me) { flash('🎯 ÉLIMINATION !'); PR.stats.kills++; saveP(); earn(10, 'élimination'); }
    return;
  }
  if (e.t === 'round') {
    winTeam = e.win; SFX.round(); rally(0);
    const myTeam = teamOf(me), mode = S?.settings.mode;
    const title = mode === 'chacun' ? (e.winner ? `${e.winner.toUpperCase()} SURVIT !` : 'PERSONNE !') : mode === 'survie' ? (e.win === 0 ? `VAGUE ${e.wave} REPOUSSÉE !` : 'LES ROBOTS GAGNENT…') : e.win >= 0 ? `MANCHE POUR ${TEAM_NAMES[e.win % 2].toUpperCase()} !` : 'MATCH NUL !';
    banner(title, mode === 'chacun' || mode === 'survie' ? '' : `${e.teamWins[0]} - ${e.teamWins[1]}`);
    if ((mode === 'chacun' && e.winner === me) || (mode !== 'chacun' && e.win === myTeam && S?.inWorld?.some(p => p.id === me))) earn(20, 'manche gagnée');
    $('#awards').innerHTML = (e.awards ?? []).map(a => `<li><span>${esc(a.label)}</span><b>${esc(a.id)}</b><em>${a.n}</em></li>`).join(''); $('#awards').hidden = !e.awards?.length; clearTimeout(onEvent.aw); onEvent.aw = setTimeout(() => ($('#awards').hidden = true), 4300);
    return;
  }
  if (e.t === 'cup') banner('MATCH SUIVANT !', `équipe ${e.next[0] + 1} contre équipe ${e.next[1] + 1}`);
}
// Fin de partie : statistiques, pièces, classement de la survie.
async function matchOver(s) {
  const me = s.me, mode = s.settings.mode; if (mode === 'entrainement') return;
  PR.stats.matches++;
  const won = s.ranking[0]?.name === me && s.ranking[0]?.points > 0; if (won) { PR.stats.wins++; earn(50, 'victoire'); }
  if (mode === 'survie') {
    const waves = Math.max(0, (s.wave ?? 1) - 1), st = s.stats?.[me] ?? { reflects: 0 }; PR.stats.survie = Math.max(PR.stats.survie, waves); saveP();
    if (waves > 0) { const out = await fetch('/api/boule/board', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode: 'survie', name: me, waves, reflects: Math.max(waves, st.reflects), seconds: Math.round((Date.now() - (S.startedAt ?? Date.now() - waves * 30000)) / 1000) }) }).then(r => r.json()).catch(() => null); if (out?.place) toast(`🌍 ${out.place}e du classement mondial de la survie !`); }
  }
  saveP();
}

/* ---------------- Replay de son élimination (vu depuis la boule) ---------------- */
const rec = [], recEv = [];
let replay = null;
function startReplay() { const now = performance.now(); replay = { start: now + 350, from: now - 1700, to: now, speed: 0.45 }; }
function recordFrame(now, state) {
  rec.push({ at: now, state: { ...state, players: state.players.map(p => ({ ...p })), ball: state.ball && { ...state.ball } } });
  while (rec.length && now - rec[0].at > 2600) rec.shift();
}
function replayState(now) {
  if (!replay || now < replay.start) return null;
  const at = replay.from + (now - replay.start) * replay.speed;
  if (at > replay.to) { replay = null; $('#replay').hidden = true; return null; }
  const i = rec.findIndex(r => r.at >= at); if (i < 1) return null;
  const st = rec[i].state, b = st.ball, pb = rec[i - 1].state.ball;
  $('#replay').hidden = false;
  if (b && b.state !== 'wait') { // caméra juste derrière la boule, qui regarde là où elle va
    const dx = b.x - (pb?.x ?? b.x - 1), dy = b.y - (pb?.y ?? b.y), dz = b.z - (pb?.z ?? b.z), l = Math.hypot(dx, dy, dz) || 1;
    st.cam = { pos: { x: b.x - (dx / l) * 2.4, y: b.y - (dy / l) * 2.4 + 0.6, z: b.z - (dz / l) * 2.4 }, look: { x: b.x + (dx / l) * 4, y: b.y + (dy / l) * 4, z: b.z + (dz / l) * 4 } };
  }
  return st;
}

/* ---------------- Commandes : clavier, souris, manette, tactile ---------------- */
const keys = new Set();
const KEYMAP = { KeyW: IN.F, ArrowUp: IN.F, KeyS: IN.B, ArrowDown: IN.B, KeyA: IN.L, KeyD: IN.R, Space: IN.JUMP, KeyJ: IN.HIT, KeyF: IN.HIT, KeyE: IN.HIT };
let mouse = 0, touchBits = 0, touchMove = { x: 0, y: 0 };
const playing = () => document.body.classList.contains('playing');
addEventListener('keydown', e => {
  if (e.target.closest?.('input, select')) return;
  if (!playing()) return;
  if (e.code === 'KeyG' || e.code === 'KeyT') { if (!e.repeat) openWheel(); e.preventDefault(); return; }
  const n = ['Digit1', 'Digit2', 'Digit3', 'Digit4'].indexOf(e.code); if (n >= 0) { socket.emit('emote', Object.keys(EMOTE_ICONS)[n]); return; }
  if (KEYMAP[e.code] !== undefined || e.code.startsWith('Arrow')) { e.preventDefault(); keys.add(e.code); audio(); }
});
addEventListener('keyup', e => { keys.delete(e.code); if (e.code === 'KeyG' || e.code === 'KeyT') closeWheel(true); });
addEventListener('blur', () => { keys.clear(); mouse = 0; touchBits = 0; });
$('#view').addEventListener('mousedown', e => { if (!playing()) return; audio(); if (document.pointerLockElement !== $('#view') && !document.body.classList.contains('touch')) $('#view').requestPointerLock?.(); if (e.button === 0) mouse |= IN.HIT; if (e.button === 2) mouse |= IN.JUMP; });
addEventListener('mouseup', e => { if (e.button === 0) mouse &= ~IN.HIT; if (e.button === 2) mouse &= ~IN.JUMP; });
$('#view').addEventListener('contextmenu', e => e.preventDefault());
addEventListener('mousemove', e => { if (document.pointerLockElement === $('#view')) myYaw += e.movementX * 0.0032 * SET.sens * (SET.invert ? -1 : 1); wheelMove(e); });
function readInput(dt) {
  let bits = mouse | touchBits;
  for (const k of keys) bits |= KEYMAP[k] ?? 0;
  if (keys.has('ArrowLeft')) myYaw -= dt * 2.6; if (keys.has('ArrowRight')) myYaw += dt * 2.6;
  if (touchMove.y < -0.35) bits |= IN.F; if (touchMove.y > 0.35) bits |= IN.B; if (touchMove.x < -0.35) bits |= IN.L; if (touchMove.x > 0.35) bits |= IN.R;
  for (const g of navigator.getGamepads?.() ?? []) {
    if (!g) continue;
    const ax = g.axes[0] ?? 0, ay = g.axes[1] ?? 0, rx = g.axes[2] ?? 0, b = i => g.buttons[i]?.pressed;
    if (ay < -0.35) bits |= IN.F; if (ay > 0.35) bits |= IN.B; if (ax < -0.35) bits |= IN.L; if (ax > 0.35) bits |= IN.R;
    if (Math.abs(rx) > 0.15) myYaw += rx * dt * 3 * SET.sens * (SET.invert ? -1 : 1);
    if (b(0)) bits |= IN.JUMP; if (b(2) || b(5) || b(7)) bits |= IN.HIT;
  }
  return bits;
}
// tactile : joystick à gauche, glisser à droite pour tourner, boutons saut et renvoi (visé automatiquement)
if (matchMedia('(pointer: coarse)').matches) document.body.classList.add('touch');
{
  const pad = $('#stick'), knob = pad.querySelector('i'); let id = null, cx = 0, cy = 0, lookId = null, lx = 0;
  pad.addEventListener('pointerdown', e => { id = e.pointerId; const r = pad.getBoundingClientRect(); cx = r.left + r.width / 2; cy = r.top + r.height / 2; pad.setPointerCapture(id); audio(); });
  pad.addEventListener('pointermove', e => { if (e.pointerId !== id) return; const dx = (e.clientX - cx) / 50, dy = (e.clientY - cy) / 50, l = Math.max(1, Math.hypot(dx, dy)); touchMove = { x: dx / l, y: dy / l }; knob.style.transform = `translate(${touchMove.x * 40}px, ${touchMove.y * 40}px)`; });
  for (const ev of ['pointerup', 'pointercancel']) pad.addEventListener(ev, () => { id = null; touchMove = { x: 0, y: 0 }; knob.style.transform = ''; });
  const look = $('#lookZone');
  look.addEventListener('pointerdown', e => { lookId = e.pointerId; lx = e.clientX; look.setPointerCapture(lookId); });
  look.addEventListener('pointermove', e => { if (e.pointerId !== lookId) return; myYaw += (e.clientX - lx) * 0.006 * SET.sens * (SET.invert ? -1 : 1); lx = e.clientX; });
  for (const ev of ['pointerup', 'pointercancel']) look.addEventListener(ev, () => (lookId = null));
  for (const b of $$('#touch [data-bit]')) { const bit = IN[b.dataset.bit]; b.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); audio(); touchBits |= bit; b.classList.add('on'); }); for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) b.addEventListener(ev, () => { touchBits &= ~bit; b.classList.remove('on'); }); }
}
// roue des emotes (G ou T maintenu, ou bouton 😜)
let wheelSel = null, wheelOpen = false, wheelC = { x: 0, y: 0 };
function openWheel() { wheelOpen = true; wheelSel = null; $('#wheel').hidden = false; wheelC = { x: innerWidth / 2, y: innerHeight / 2 }; for (const b of $$('#wheel [data-e]')) b.classList.remove('on'); }
function closeWheel(send) { if (!wheelOpen) return; wheelOpen = false; $('#wheel').hidden = true; if (send && wheelSel) socket.emit('emote', wheelSel); }
function wheelMove(e) {
  if (!wheelOpen) return;
  wheelC.x += e.movementX ?? 0; wheelC.y += e.movementY ?? 0;
  const dx = wheelC.x - innerWidth / 2, dy = wheelC.y - innerHeight / 2; if (Math.hypot(dx, dy) < 30) return;
  const k = Math.round(((Math.atan2(dy, dx) + Math.PI * 2.5) % (Math.PI * 2)) / (Math.PI / 2)) % 4;
  wheelSel = Object.keys(EMOTE_ICONS)[k]; for (const b of $$('#wheel [data-e]')) b.classList.toggle('on', b.dataset.e === wheelSel);
}
$('#wheel').onclick = e => { const b = e.target.closest('[data-e]'); if (b) { wheelSel = b.dataset.e; closeWheel(true); } };
$('#emoteBtn').onclick = () => (wheelOpen ? closeWheel(false) : openWheel());

/* ---------------- Interface ---------------- */
let toastT = 0;
function toast(t) { const el = $('#toast'); el.textContent = t; el.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => (el.hidden = true), 2000); }
function banner(title, sub) { const b = $('#banner'); b.hidden = true; void b.offsetWidth; b.innerHTML = `<b>${esc(title)}</b>${sub ? `<span>${esc(sub)}</span>` : ''}`; b.hidden = false; clearTimeout(banner.t); banner.t = setTimeout(() => (b.hidden = true), 2600); }
function flash(t) { const el = $('#flash'); el.textContent = t; el.hidden = true; void el.offsetWidth; el.hidden = false; clearTimeout(flash.t); flash.t = setTimeout(() => (el.hidden = true), 1100); }
function showBoard(s) {
  const mode = s.settings.mode, st = s.stats ?? {};
  $('#boardTitle').textContent = mode === 'survie' ? `💀 ${Math.max(0, s.wave - 1)} vague${s.wave - 1 > 1 ? 's' : ''} repoussée${s.wave - 1 > 1 ? 's' : ''}` : mode === 'coupe' && s.cup?.champion != null ? `🏆 L'équipe ${s.cup.champion + 1} remporte la Coupe !` : `🏆 ${s.ranking[0]?.name} gagne !`;
  $('#boardList').innerHTML = s.ranking.map((p, k) => { const x = st[p.name] ?? {}; return `<li class="${p.name === s.me ? 'me' : ''}"><b>${k + 1}</b><span>${esc(p.name)}<small>🏓 ${x.reflects ?? 0} · ⚡ ${x.perfect ?? 0} · 💥 ${x.kills ?? 0} · ${Math.round((x.best ?? 0) * 3.6)} km/h</small></span><strong>${p.points}</strong></li>`; }).join('');
  $('#boardHint').textContent = '';
  ui.endButtons(s, s.ranking);
  $('#board').hidden = false;
}
const tags = {};
function hud(list, ball, now) {
  const s = S, me = list.find(p => p.id === s.me), mode = s.settings.mode;
  const teamMode = !['chacun', 'survie', 'entrainement'].includes(mode);
  $('#sb').classList.toggle('solo', !teamMode);
  $('#sL').textContent = s.teamWins?.[0] ?? 0; $('#sR').textContent = s.teamWins?.[1] ?? 0;
  $('#need').textContent = mode === 'survie' ? `VAGUE ${s.wave}` : mode === 'entrainement' ? `record x${trainBest.rally} · ${Math.round(trainBest.speed * 3.6)} km/h` : mode === 'chacun' ? `${s.ffaWins?.[s.me] ?? 0} manche(s) · premier à ${s.need}` : mode === 'coupe' ? cupLabel(s) : `premier à ${s.need}`;
  for (const t of [0, 1]) $(`#alive${t}`).innerHTML = list.filter(p => (teamMode || mode === 'survie' ? p.team % 2 === t : t === 0)).map(p => `<i class="${p.alive ? '' : 'dead'}" style="--c:${TEAM[p.team % 8]}" title="${esc(p.id)}"></i>`).join('');
  const live = ball && ball.state !== 'wait';
  $('#speed').textContent = live ? `${Math.round(ball.v * 3.6)} km/h` : '—';
  $('#speed').style.setProperty('--k', live ? Math.min(1, (ball.v - B.v0) / 55) : 0);
  $('#fuse').hidden = !(live && mode === 'patate'); if (live && mode === 'patate') $('#fuse').textContent = `💣 ${Math.max(0, ball.fuse).toFixed(1)} s`;
  const targeted = !!(me?.alive && live && ball.target === me.id);
  document.body.classList.toggle('targeted', targeted && !ball.launch);
  $('#cool').style.setProperty('--c', me ? 1 - me.hitCd / B.cd : 1);
  if (targeted && !ball.launch) { const d = Math.hypot(ball.x - me.x, ball.y - me.y - 1, ball.z - me.z), gap = Math.max(70, Math.min(600, d * 45)); if (now - (hud.beep ?? 0) > gap) { hud.beep = now; SFX.beep(d < B.range ? 1400 : 900); } }
  if (live && me) { const d = Math.hypot(ball.x - me.x, ball.z - me.z); humTo(ball.v, Math.max(0, 1 - d / 16)); } else humTo(0, 0);
  for (const p of list) {
    const el = (tags[p.id] ??= Object.assign(document.createElement('div'), { className: 'tag' }));
    if (!el.parentNode) $('#labels').append(el);
    const sc = V.project(p.x, p.y + 2.35, p.z);
    el.hidden = !sc.ok || !p.alive || (p.id === s.me && !(p.emoteT > 0));
    el.style.transform = `translate(${sc.x}px, ${sc.y}px) translate(-50%, -100%)`;
    el.innerHTML = `${p.emoteT > 0 ? `<i class="emo">${EMOTE_ICONS[p.emote] ?? ''}</i>` : ''}${p.id === s.me ? '' : `<b style="--c:${TEAM[p.team % 8]}">${esc(p.id)}</b>`}`;
  }
  for (const [id, el] of Object.entries(tags)) if (!list.some(p => p.id === id)) { el.remove(); delete tags[id]; }
}

/* ---------------- Panneaux : boutique, statistiques, réglages, classement ---------------- */
function panel(title, html) { $('#panelTitle').innerHTML = title; $('#panelBody').innerHTML = html; $('#panelBody').onclick = null; $('#panel').hidden = false; renderCoins(); }
for (const el of $$('[data-close]')) el.onclick = () => ($(`#${el.dataset.close}`).hidden = true);
function openShop(tab = 'looks') {
  const tabs = { looks: '🧍 Personnages', accs: '🎩 Accessoires', trails: '✨ Traînées' };
  const items = tab === 'looks' ? Object.entries(LOOKS).map(([id, L]) => [id, L.name, L.price]) : tab === 'accs' ? Object.entries(ACC_NAMES).map(([id, n]) => [id, n, ACC_PRICES[id]]) : Object.entries(TRAIL_NAMES).map(([id, n]) => [id, n, TRAIL_PRICES[id]]);
  const eq = { looks: PR.look, accs: PR.acc, trails: PR.trail }[tab];
  panel('🛒 Boutique', `<p class="hint">Tu as <b class="coins"></b>. On en gagne en renvoyant (2), en renvoi parfait (5), en éliminant (10), en gagnant une manche (20) et une partie (50).</p>
    <div class="tabs">${Object.entries(tabs).map(([k, v]) => `<button class="${k === tab ? 'on' : ''}" data-tab="${k}">${v}</button>`).join('')}</div>
    <div class="shop">${items.map(([id, name, price]) => { const own = PR[tab].includes(id); return `<div class="item ${id === eq ? 'on' : ''}">${tab === 'trails' ? `<i class="trailico t-${id}"></i>` : `<canvas data-look-c="${tab === 'looks' ? id : PR.look}" data-team="0"${tab === 'accs' ? ` data-acc="${id}"` : ''} width="120" height="120"></canvas>`}<b>${esc(name)}</b>${own ? `<button class="small ${id === eq ? 'ghost' : 'primary'}" data-eq="${id}">${id === eq ? 'Équipé' : 'Équiper'}</button>` : `<button class="small primary" data-buy="${id}" data-price="${price}" data-name="${esc(name)}">${price} 🪙</button>`}</div>`; }).join('')}</div>`);
  $('#panelBody').onclick = e => {
    const t = e.target.closest('[data-tab]'), b = e.target.closest('[data-buy]'), q = e.target.closest('[data-eq]');
    if (t) return openShop(t.dataset.tab);
    const id = b?.dataset.buy ?? q?.dataset.eq; if (!id) return;
    if (b && !buy(tab, id, +b.dataset.price, b.dataset.name)) return;
    PR[{ looks: 'look', accs: 'acc', trails: 'trail' }[tab]] = id; saveP(); refreshPicks(); sendPick(); openShop(tab);
  };
}
function openStats() {
  const s = PR.stats;
  panel('📊 Statistiques', `<div class="statgrid">${[['Parties', s.matches], ['Victoires', s.wins], ['Renvois', s.reflects], ['Renvois parfaits', s.perfect], ['Éliminations', s.kills], ['Pulvérisé', `${s.deaths} fois`], ['Vitesse record', `${s.bestSpeed} km/h`], ['Plus long échange', `x${s.bestRally}`], ['Record en survie', `${s.survie} vague(s)`], ['Pièces', `${PR.coins} 🪙`]].map(([a, b]) => `<div><small>${a}</small><b>${b}</b></div>`).join('')}</div>`);
}
function openSettings() {
  panel('⚙️ Réglages', `<div class="settings">
    <label>Sensibilité de la souris <input type="range" min="0.3" max="2.5" step="0.1" data-k="sens" value="${SET.sens}"></label>
    <label class="chip"><input type="checkbox" data-k="invert" ${SET.invert ? 'checked' : ''}> Inverser l'axe horizontal</label>
    <label>Champ de vision <input type="range" min="55" max="95" step="1" data-k="fov" value="${SET.fov}"></label>
    <label>🎵 Musique <input type="range" min="0" max="1" step="0.05" data-k="music" value="${SET.music}"></label>
    <label>💥 Effets <input type="range" min="0" max="1" step="0.05" data-k="fx" value="${SET.fx}"></label>
    <label>⚠️ Boule et alarmes <input type="range" min="0" max="1" step="0.05" data-k="alarm" value="${SET.alarm}"></label>
    <label class="chip"><input type="checkbox" data-k="timing" ${SET.timing ? 'checked' : ''}> Cercle de timing autour de la boule</label>
  </div>`);
  for (const el of $$('#panelBody [data-k]')) el.oninput = () => { SET[el.dataset.k] = el.type === 'checkbox' ? el.checked : Number(el.value); saveSet(); for (const k of ['music', 'fx', 'alarm']) bus(k); };
}
async function openBoard() {
  panel('💀 Survie : classement mondial', `<p class="hint">Ton record : <b>${PR.stats.survie}</b> vague(s). Lance une survie depuis l'accueil.</p><ol class="ranking" id="survBoard"><li class="hint">Chargement…</li></ol>`);
  const list = await fetch('/api/boule/board?mode=survie').then(r => (r.ok ? r.json() : [])).catch(() => []);
  const el = $('#survBoard'); if (el) el.innerHTML = list.length ? list.map((e, k) => `<li class="${e.name === ui.pseudo ? 'me' : ''}"><b>${k + 1}</b><span>${esc(e.name)}</span><strong>${e.waves} 🌊</strong></li>`).join('') : '<li class="hint">Personne encore : sois le premier !</li>';
}
$('#shopBtn').onclick = () => { audio(); openShop(); };
$('#statsBtn').onclick = () => { audio(); openStats(); };
for (const id of ['#setBtn', '#setBtn2']) $(id).onclick = () => { audio(); openSettings(); };
$('#boardBtn').onclick = () => { audio(); openBoard(); };

/* ---------------- Boucle ---------------- */
let last = performance.now(), acc = 0, outbox = [];
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  const t = now / 1000, s = S, live = inMatch(s);
  acc += dt;
  while (acc >= BD.DT) {
    acc -= BD.DT;
    if (live && pred) {
      const bits = readInput(BD.DT) | (touchBits & IN.HIT ? IN.AUTO : 0); pending.push([++seq, bits, myYaw]); outbox.push([seq, bits, +myYaw.toFixed(4)]);
      pred.ev = []; BD.step(pred, bits, myYaw, { arena: s.arena, halves: halves(), frame: snaps.at(-1)?.s.f ?? 0 }); for (const e of pred.ev) { if (e === 'swing') SFX.swing(); if (e === 'jump') SFX.jump(); } delete pred.ev;
      if (pending.length > 120) pending.shift();
    }
  }
  if (outbox.length) socket.emit('in', outbox.splice(0));
  vis.x *= Math.exp(-dt * 14); vis.z *= Math.exp(-dt * 14);
  // ralenti : le temps affiché avance à 30 % pendant 0,3 s, puis rattrape à 160 %
  if (now < slowUntil) lag += dt * 1000 * 0.7; else if (lag > 0) lag = Math.max(0, lag - dt * 1000 * 0.6);
  const slow = now < slowUntil;
  let state = null;
  if (live && snaps.length) {
    const rt = now - 80 - lag;
    let i = snaps.findIndex(x => x.at > rt); if (i < 0) i = snaps.length - 1;
    const Bs = snaps[i], As = snaps[Math.max(0, i - 1)], k = Bs.at > As.at ? Math.max(0, Math.min(1, (rt - As.at) / (Bs.at - As.at))) : 1;
    const info = id => s.inWorld?.find(p => p.id === id) ?? {};
    const list = Bs.s.p.map(b => {
      const extra = { acc: info(b.id).acc ?? 'aucun' };
      if (b.id === s.me && pred) return { ...pred, ...extra, emote: b.emote, emoteT: b.emoteT, yaw: myYaw, x: pred.x + vis.x, z: pred.z + vis.z };
      const a = As.s.p.find(x => x.id === b.id) ?? b, dy = Math.atan2(Math.sin(b.yaw - a.yaw), Math.cos(b.yaw - a.yaw));
      return { ...b, ...extra, x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, z: a.z + (b.z - a.z) * k, yaw: a.yaw + dy * k };
    });
    // boule : interpolée pendant le ralenti, sinon prolongée jusqu'à maintenant
    const L = lag > 1 ? Bs : snaps.at(-1), raw = L.s.b, rawA = As.s.b;
    let ball = null;
    if (raw) {
      const fresh = { x: raw[0], y: raw[1], z: raw[2], v: raw[6], target: raw[7], team: raw[8], state: raw[9], last: raw[10], hits: raw[11], fuse: raw[12], launch: raw[13] };
      if (lag > 1 && rawA && rawA[9] === raw[9]) Object.assign(fresh, { x: rawA[0] + (raw[0] - rawA[0]) * k, y: rawA[1] + (raw[1] - rawA[1]) * k, z: rawA[2] + (raw[2] - rawA[2]) * k });
      else if (raw[9] === 'fly' && !raw[13]) { const age = Math.min(0.1, (now - L.at) / 1000); fresh.x += raw[3] * raw[6] * age; fresh.y += raw[4] * raw[6] * age; fresh.z += raw[5] * raw[6] * age; }
      ball = fresh;
    }
    const me = list.find(p => p.id === s.me);
    // mire : l'adversaire au centre de l'écran ; cercle de timing quand la boule me vise
    const aimP = me?.alive ? BD.aimTarget({ players: list }, { ...me, yaw: myYaw }) : null;
    let timing = null;
    if (SET.timing && me?.alive && ball && ball.state !== 'wait' && !ball.launch && ball.target === me.id) timing = Math.max(0, Math.min(1, (Math.hypot(ball.x - me.x, ball.y - me.y - P.chest, ball.z - me.z) - B.perfectRange) / 8));
    const teamMode = !['chacun', 'survie', 'entrainement'].includes(s.settings.mode);
    state = { arena: s.arena, halves: halves(), frame: Bs.s.f, players: list, ball, me: s.me, aim: aimP?.id, timing, potato: s.settings.mode === 'patate', fov: SET.fov, trails: Object.fromEntries((s.inWorld ?? []).map(p => [p.id, p.trail])), winTeam: s.phase === 'roundEnd' ? winTeam : null, board: { wins: teamMode ? s.teamWins : null, need: s.need, speed: ball?.v ?? 0, label: s.settings.mode === 'survie' ? `VAGUE ${s.wave}` : MODE_NAMES[s.settings.mode].replace(/^\S+ /, '').toUpperCase() } };
    recordFrame(now, state);
    hud(list, ball, now);
  }
  const rp = replayState(now);
  V.frame(rp ? dt * replay.speed : slow ? dt * 0.3 : dt, t, rp ?? state);
}
if (location.hostname === 'localhost') window.bd = { V, state: () => S, pred: () => pred, give: n => earn(n, 'test'), quick, arena: async id => { if (!(await ui.enter('create', { private: true }))) return; await act('configure', 'arena', id); for (let k = 0; k < 3; k++) await act('addBot'); act('start'); } };
requestAnimationFrame(frame);
show('home');
