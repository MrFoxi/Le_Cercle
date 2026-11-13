// Caboche Cup : accueil, profil (pièces, boutique, statistiques), modes hors ligne (tournoi, survie, défis, deux joueurs
// sur le même clavier : le match tourne dans le navigateur avec local.js) et salons en ligne (le serveur fait foi).
// En ligne, le navigateur lit les touches 60 fois par seconde, les envoie numérotées (« in ») et fait bouger son joueur
// tout de suite avec la même physique ; à chaque état reçu (« snap »), il reprend la position du serveur et rejoue
// les touches pas encore vues. Le ballon aussi est anticipé : quand tu frappes, il part tout de suite, et le serveur
// corrige en douceur. Les autres joueurs sont affichés avec un léger retard, lissé.
// Autour du match : ralenti des buts (replay), arrêt sur image des grosses frappes, commentateur, sons du public,
// commandes tactiles.
import { createPitch, drawPortrait, TEAM, BALLS } from './render.js';
import { LocalMatch } from './local.js';
import { $, $$, esc, store, audio, sound, blip, fanfare, party } from '/shared/party.js';

const CC = window.CC, { IN } = CC;
const socket = io('/caboche');
const V = createPitch($('#view'));
addEventListener('resize', () => V.resize());

/* ---------------- Sons ---------------- */
function noise(dur, freq, vol, type = 'bandpass', to, at = 0) {
  const ac = sound(); if (!ac) return;
  const t = ac.currentTime + at, b = ac.createBuffer(1, Math.ceil(ac.sampleRate * dur), ac.sampleRate), d = b.getChannelData(0);
  for (let k = 0; k < d.length; k++) d[k] = Math.random() * 2 - 1;
  const s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
  s.buffer = b; f.type = type; f.frequency.setValueAtTime(freq, t); if (to) f.frequency.exponentialRampToValueAtTime(to, t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + Math.min(0.05, dur / 4)); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  s.connect(f).connect(g).connect(ac.destination); s.start(t);
}
const SFX = {
  kick: p => { blip(170, 55, 0.12, 'sine', 0.32); noise(0.05, 1400, 0.3, 'lowpass'); if (p > 20) { blip(95, 38, 0.22, 'sine', 0.3); noise(0.12, 300, 0.2, 'lowpass'); } },
  head: () => { blip(320, 140, 0.1, 'sine', 0.25); noise(0.05, 1200, 0.15); },
  bounce: v => blip(140, 70, 0.08, 'sine', Math.min(0.2, v * 0.02)),
  post: () => { blip(1400, 1300, 0.6, 'triangle', 0.12); blip(2100, 2000, 0.4, 'sine', 0.06); },
  wall: () => noise(0.08, 2400, 0.12, 'highpass'),
  whistle: (n = 1) => { for (let k = 0; k < n; k++) blip(2600, 2500, 0.28, 'sine', 0.08, k * 0.36); },
  goal: () => { noise(3, 900, 0.55, 'bandpass', 600); noise(2.5, 400, 0.4, 'lowpass', 200, 0.1); fanfare([523, 659, 784, 1046], 0.1); },
  ooh: () => noise(1.2, 700, 0.25, 'bandpass', 450),
  boing: () => { blip(220, 660, 0.18, 'triangle', 0.12); blip(660, 330, 0.15, 'sine', 0.06, 0.12); },
  bump: () => { blip(120, 50, 0.15, 'sine', 0.25); noise(0.08, 400, 0.15, 'lowpass'); },
  perfect: () => { blip(880, 1760, 0.12, 'square', 0.07); blip(1320, 2640, 0.2, 'triangle', 0.06, 0.05); },
  power: () => { blip(300, 1200, 0.5, 'sawtooth', 0.07); blip(600, 2400, 0.4, 'sine', 0.05, 0.1); },
  jump: () => blip(300, 600, 0.1, 'triangle', 0.05),
  item: () => { blip(660, 1320, 0.15, 'square', 0.06); blip(990, 1980, 0.15, 'square', 0.05, 0.08); },
  freeze: () => { noise(0.6, 4000, 0.2, 'highpass'); blip(2000, 600, 0.5, 'sine', 0.06); },
  coin: () => { blip(988, 988, 0.08, 'square', 0.05); blip(1319, 1319, 0.2, 'square', 0.05, 0.08); },
};
V.onThunder = () => noise(2.8, 140, 0.5, 'lowpass', 50);
// rumeur du public en continu, qui monte quand le ballon approche d'un but
let crowdNode = null;
function crowd(level) {
  const ac = sound(); if (!ac) return;
  if (!crowdNode) {
    const b = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate), d = b.getChannelData(0); for (let k = 0; k < d.length; k++) d[k] = Math.random() * 2 - 1;
    const s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain(); s.buffer = b; s.loop = true; f.type = 'bandpass'; f.frequency.value = 600; f.Q.value = 0.6; g.gain.value = 0;
    s.connect(f).connect(g).connect(ac.destination); s.start(); crowdNode = g;
  }
  crowdNode.gain.setTargetAtTime(level, ac.currentTime, 0.4);
}

/* ---------------- Profil : pièces, objets, statistiques (dans le navigateur) ---------------- */
const BASE = { coins: 150, chars: ['bouboule', 'lila'], accs: ['aucun'], balls: ['classique'], acc: 'aucun', ball: 'classique', defis: {}, tour: null, stats: { played: 0, won: 0, drawn: 0, lost: 0, goals: 0, conceded: 0, kinds: {}, survie: 0, tournois: 0, streak: 0, bestStreak: 0 } };
let P = null; try { P = JSON.parse(store.get('caboche-profile')); } catch { /* illisible */ }
P = { ...BASE, ...(P ?? {}), stats: { ...BASE.stats, ...(P?.stats ?? {}) } };
const saveP = () => store.set('caboche-profile', JSON.stringify(P));
let myChar = store.get('caboche-char'); if (!P.chars.includes(myChar)) myChar = 'bouboule';
V.setBallSkin(P.ball);
function renderCoins() { for (const el of $$('.coins')) el.textContent = `${P.coins} 🪙`; }
function earn(n, why) { if (!n) return; P.coins += n; saveP(); renderCoins(); coinPop(`+${n} 🪙 ${why}`); SFX.coin(); }
function coinPop(t) { const el = document.createElement('div'); el.className = 'coinpop'; el.textContent = t; document.body.append(el); setTimeout(() => el.remove(), 2200); }

/* ---------------- Choix du joueur ---------------- */
function charCards(box) {
  box.innerHTML = CC.CHAR_IDS.map(id => {
    const c = CC.CHARS[id], pw = CC.POWERS[c.power], own = P.chars.includes(id);
    return `<button class="char ${own ? '' : 'locked'}" data-char="${id}"><canvas width="240" height="240"></canvas><b>${c.name}</b><small>${c.title}</small><span class="pw" title="${esc(pw.text)}">${pw.icon} ${pw.name}</span>${own ? `<span class="stats">${Object.entries(c.stats).map(([k, v]) => `<i><em>${k}</em><u style="width:${v * 20}%"></u></i>`).join('')}</span>` : `<span class="price">🔒 ${c.price} 🪙</span>`}</button>`;
  }).join('');
}
function refreshCards() { for (const id of ['#homePicks', '#picks']) charCards($(id)); renderPicks(); }
function renderPicks() { for (const b of $$('[data-char]')) b.classList.toggle('on', b.dataset.char === myChar); }
function buy(kind, id, price, name) {
  if (P.coins < price) { toast(`Il te faut ${price} 🪙 (tu en as ${P.coins}) : gagne des matchs, des défis, le tournoi…`); return false; }
  if (!confirm(`Débloquer ${name} pour ${price} pièces ?`)) return false;
  P.coins -= price; P[kind].push(id); saveP(); renderCoins(); SFX.coin(); return true;
}
function pickChar(id) {
  const c = CC.CHARS[id];
  if (!P.chars.includes(id) && !buy('chars', id, c.price, c.name)) return;
  myChar = id; store.set('caboche-char', id); refreshCards();
  if (ui.room && ['lobby', 'over'].includes(ui.room.phase)) act('pick', myChar, P.acc);
  blip(500, 800, 0.1, 'triangle', 0.06);
}
for (const box of [$('#picks'), $('#homePicks')]) box.onclick = e => { const b = e.target.closest('[data-char]'); if (b) { audio(); pickChar(b.dataset.char); } };
// portraits animés (ils suivent un ballon imaginaire), seulement quand un menu est affiché
setInterval(() => {
  if (document.body.classList.contains('playing')) return;
  const t = performance.now() / 1000;
  for (const cv of $$('canvas[data-portrait], .char canvas')) if (cv.offsetParent) { const id = cv.dataset.portrait ?? cv.parentNode.dataset.char; drawPortrait(cv, id, +(cv.dataset.side ?? 0), t, cv.dataset.accShow ?? (id === myChar ? P.acc : 'aucun'), !P.chars.includes(id) && !cv.dataset.portrait); }
}, 50);

/* ---------------- Salons en ligne ---------------- */
const SET_IDS = { timeSel: 'time', goalsSel: 'goals', levelSel: 'level', modeSel: 'mode', stadeSel: 'stade', bonusSel: 'bonus', formatSel: 'format' };
const options = (o, sel) => Object.entries(o).map(([k, v]) => `<option value="${k}"${k === sel ? ' selected' : ''}>${esc(v)}</option>`).join('');
for (const el of $$('.modeOpts')) el.innerHTML = options(CC.MODES);
for (const el of $$('.stadeOpts')) el.innerHTML = options(CC.STADES);
const ui = party({
  id: 'caboche', socket, max: 4, bots: 1, busy: '⚽ en match', onError: t => toast(t),
  onShow: sc => { if (sc !== 'game') crowd(0); },
  onRoom: (s, host) => {
    for (const [id, k] of Object.entries(SET_IDS)) { const el = $(`#${id}`); el.disabled = !host; el.value = String(s.settings[k]); }
    $('#startBtn').disabled = s.players.length < 2;
    renderPicks(); V.setTheme(s.settings.stade);
  },
});
const { show, act } = ui;
for (const [id, k] of Object.entries(SET_IDS)) $(`#${id}`).onchange = e => { const v = e.target.value; act('configure', k, /^\d+$/.test(v) ? Number(v) : v); };
let rooms = [];
socket.on('rooms', l => (rooms = l));
$('#quickBtn').onclick = async () => {
  audio(); L = null;
  const open = rooms.find(r => r.phase === 'lobby' && r.players.length === 1);
  if (open) ui.enter('join', { code: open.code }); else { await ui.enter('create', { private: false }); toast('En attente d’un adversaire… (ou ajoute un robot)'); }
};

/* ---------------- Match en ligne : états reçus ---------------- */
let S = null, matchKey = '';
const snaps = [];
let pred = null, PW = null, pending = [], seq = 0, vis = { x: 0 }, ballOff = [];
const inMatch = s => s && ['kickoff', 'play', 'goal', 'end'].includes(s.phase);
socket.on('state', s => {
  if (L) return; // une partie hors ligne est en cours
  const old = S; S = s;
  const mine = s.players.find(p => p.name === s.me);
  if (mine && (mine.char !== myChar || mine.acc !== P.acc) && ['lobby', 'over'].includes(s.phase)) act('pick', myChar, P.acc);
  show(inMatch(s) || s.phase === 'over' ? 'game' : 'room');
  ui.renderRoom();
  const key = `${s.round}.${s.roundNo}`;
  if (inMatch(s) && key !== matchKey) { matchKey = key; pred = null; PW = null; ballOff = []; pending = []; snaps.length = 0; $('#board').hidden = true; newMatch(); }
  if (old?.phase !== s.phase) onPhase(s.phase, old?.phase);
  if (s.phase === 'end' && old?.phase !== 'end') matchOver(s.result);
  if (s.phase === 'end' || s.phase === 'over') showBoard(s); else $('#board').hidden = true;
});
socket.on('snap', snap => {
  if (L) return;
  snaps.push({ at: performance.now(), s: snap });
  while (snaps.length > 30) snaps.shift();
  const me = S?.me;
  for (const e of snap.ev) onEvent(e);
  const mine = snap.p.find(p => p.id === me);
  if (mine) {
    // monde anticipé : l'état du serveur, puis les touches qu'il n'a pas encore vues (ton joueur et les ballons bougent ;
    // les autres restent où le serveur les a vus)
    const ack = snap.ack[me] ?? 0, before = pred && { x: pred.x }, oldBalls = PW?.balls.map(b => ({ ...b }));
    const st = S?.settings ?? {};
    PW = { frame: snap.f, opts: { mode: st.mode, stade: st.stade, bonus: false }, players: snap.p.map(p => ({ ...p })), balls: snap.b.map(CC.unpackBall), items: [], itemIn: 1e9, itemId: 0, walls: [...(snap.wl ?? [0, 0])], shrink: [0, 0], ballMod: snap.bm ? { kind: snap.bm, t: 1 } : null, wind: snap.wd ?? 0, goalH: snap.gh, seed: 1, touch: null };
    pending = pending.filter(([q]) => q > ack);
    if (S?.phase === 'play' || S?.phase === 'goal') for (const [, bits] of pending) CC.stepWorld(PW, { [me]: bits }, []);
    pred = PW.players.find(p => p.id === me);
    if (before && Math.abs(before.x - pred.x) < 2) vis.x += before.x - pred.x;
    ballOff = PW.balls.map((b, k) => { const o = oldBalls?.[k], prev = ballOff[k] ?? { x: 0, y: 0 }; return o && Math.hypot(o.x + prev.x - b.x, o.y + prev.y - b.y) < 2.5 ? { x: o.x + prev.x - b.x, y: o.y + prev.y - b.y } : { x: 0, y: 0 }; });
  }
});

/* ---------------- Vue commune (en ligne ou hors ligne) ---------------- */
let L = null; // partie hors ligne : { match, humans: [{ id, pad }], ctx, phase }
function cur() {
  if (!L) return S;
  const m = L.match;
  return { phase: m.phase, score: m.score, sides: m.sides(), golden: m.golden, settings: m.settings, me: L.humans[0].id, players: m.players.map(p => ({ name: p.id, char: p.char, acc: p.acc, bot: !!p.bot })) };
}
const meId = () => cur()?.me;
const sideOf = id => cur()?.sides?.findIndex(t => t.includes(id)) ?? -1;
const nameOf = id => id;

function onPhase(phase, old) {
  if (phase === 'kickoff') countdown();
  if (phase === 'play' && old === 'kickoff') { SFX.whistle(); banner('C’EST PARTI !', ''); }
  if (phase === 'end') { SFX.whistle(3); crowd(0.15); }
}
let countT = null;
function countdown() { let n = 2; clearInterval(countT); const el = $('#cd'); const tick = () => { el.textContent = n > 0 ? n : '⚽'; el.hidden = false; el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop'); blip(n > 0 ? 660 : 990, n > 0 ? 660 : 990, 0.12, 'square', 0.06); if (n-- <= 0) { clearInterval(countT); setTimeout(() => (el.hidden = true), 500); } }; tick(); countT = setInterval(tick, 700); }

/* ---------------- Commentateur ---------------- */
const SAY = {
  parfaite: ['Frappe parfaite !', 'Une frappe de mule !', 'Quel boulet de canon !'], lob: ['Oh, le joli lob !', 'Par-dessus tout le monde !'], tete: ['Quelle tête !', 'Coup de boule magistral !'],
  volee: ['Reprise de volée !', 'Sans contrôle, en pleine course !'], boing: ['Il lui a marché sur la tête !', 'Boing ! Il s’en sert de trampoline !'], bump: ['Ça cogne !', 'Choc des têtes !'],
  feu: ['Le ballon est en FEU !'], tornade: ['Une tornade ! Personne ne sait où il va !'], save: ['Quel arrêt !', 'Parade de grande classe !'], post: ['Sur le poteau !', 'La barre tremble encore !'],
  goal: ['BUUUT !', 'Dans la lucarne !', 'Le stade explose !'], own: ['Contre son camp… aïe aïe aïe.'], item: ['Un bonus tombé du ciel !'],
  block: ['Le mur tient bon !'], trap: ['Joli contrôle.', 'Le ballon lui colle au pied.'], golden: ['But en or : le prochain gagne tout !'], freeze: ['Congelé sur place !'], mini: ['Il a rétréci !'],
};
let sayAt = 0;
function say(kind, force = false) {
  const now = performance.now(), list = SAY[kind]; if (!list || (!force && now < sayAt)) return;
  sayAt = now + 1600;
  const el = $('#comment'); el.querySelector('span').textContent = list[Math.floor(Math.random() * list.length)];
  el.hidden = true; void el.offsetWidth; el.hidden = false; clearTimeout(say.t); say.t = setTimeout(() => (el.hidden = true), 2400);
}

/* ---------------- Événements du match ---------------- */
const KICKS = { volee: '🦶 VOLÉE !', lob: '🌈 LOB !' };
const SPECIAL = ['lob', 'volee', 'tete', 'parfaite', 'feu', 'tornade'];
let lastKick = {}, track = null, recEv = [], stopUntil = 0, myKickAt = 0;
function newMatch() { lastKick = {}; track = { kinds: {}, jumped: false, goalsFor: 0, conceded: 0, powerGoal: false }; rec.length = 0; replay = null; }
// Effets d'une frappe : affichés tout de suite pour la sienne (anticipée), sans doublon quand le serveur la confirme.
function kickFx(e, local) {
  const now = performance.now();
  if (!local && e.id === meId() && now - myKickAt < 500) return;
  if (local) myKickAt = now;
  V.fx.kick(e); SFX.kick(e.p);
  if (e.perfect) { V.fx.pop(e.x, e.y + 0.9, '⚡ PARFAIT !', '#ffe14a', 0.55); SFX.perfect(); say('parfaite'); }
  if (e.perfect || e.p > 23) stopUntil = now + (e.perfect ? 80 : 50); // arrêt sur image
  if (L?.ctx.type === 'train') V.fx.pop(e.x, e.y + 1.5, `${Math.round(e.p * 3.6)} km/h`, '#ffffff', 0.4);
}
function onEvent(e) {
  const me = meId(), mySide = sideOf(me);
  if (e.t === 'kick') {
    kickFx(e); recEv.push(e); lastKick[e.id] = { kind: e.perfect ? 'parfaite' : e.kind, at: performance.now() };
    if (e.fire) { banner('🔥 SUPER TIR !', ''); SFX.power(); say('feu', true); }
    else if (e.kind === 'tornade') { banner('🌪️ TORNADE !', ''); SFX.power(); say('tornade', true); }
    else if (KICKS[e.kind] && !e.perfect) { V.fx.pop(e.x, e.y + 0.8, KICKS[e.kind], '#ffe14a', 0.5); say(e.kind); }
    return;
  }
  if (e.t === 'header') { V.fx.header(e); SFX.head(); recEv.push(e); lastKick[e.id] = { kind: 'tete', at: performance.now() }; return; }
  if (e.t === 'boing') { V.fx.boing(e); SFX.boing(); say('boing'); return; }
  if (e.t === 'bump') { V.fx.bump(e); SFX.bump(); say('bump'); return; }
  if (e.t === 'save') { V.fx.header(e); V.fx.pop(e.x, e.y + 0.6, '🧤 ARRÊT !', '#9fe8ff'); SFX.head(); SFX.ooh(); say('save', true); return; }
  if (e.t === 'trap') { if (e.id === me && Math.random() < 0.33) say('trap'); return; }
  if (e.t === 'bounce') { SFX.bounce(e.v); if (e.y < 0.5) V.fx.dust(e.x, 3); return; }
  if (e.t === 'post') { V.fx.spark(e.x, e.y, '#ffffff', 30); V.fx.shake(0.4); SFX.post(); SFX.ooh(); flash('POTEAU !'); say('post', true); V.fx.chance(e.x > 0 ? 0 : 1); return; }
  if (e.t === 'block') { V.fx.spark(e.x, e.y, '#ffb35a', 20); SFX.wall(); say('block'); return; }
  if (e.t === 'wall') { SFX.wall(); if (Math.abs(e.x) > CC.F.HL && e.y < CC.F.GH) V.fx.net(e.x, e.y); return; }
  if (e.t === 'jump') { if (e.id === me && track) track.jumped = true; if (e.id !== me) SFX.jump(); return; }
  if (e.t === 'land') { V.fx.dust(e.x, 6); return; }
  if (e.t === 'item') { const it = CC.ITEMS[e.kind]; V.fx.pop(e.x, e.y + 1, `${it.icon} ${it.name}`, '#ffffff', 0.42); SFX.item(); say('item'); if (e.kind === 'gel') { SFX.freeze(); say('freeze', true); } return; }
  if (e.t === 'power') {
    const p = cur()?.players.find(x => x.name === e.id), pw = CC.POWERS[CC.CHARS[p?.char ?? 'bouboule'].power];
    banner(`${pw.icon} ${pw.name.toUpperCase()} !`, nameOf(e.id)); SFX.power();
    if (pw === CC.POWERS.gel) { SFX.freeze(); say('freeze', true); } if (pw === CC.POWERS.mini) say('mini', true);
    return;
  }
  if (e.t === 'golden') { banner('BUT EN OR !', 'Le prochain but gagne le match'); SFX.whistle(2); say('golden', true); return; }
  if (e.t === 'goal') {
    V.fx.goal(e.side); SFX.goal(); crowd(0.6); setTimeout(() => crowd(0.18), 3500);
    banner(e.own ? 'CONTRE SON CAMP !' : 'BUUUT !', `${nameOf(e.by)} · ${e.score[0]} - ${e.score[1]}`);
    say(e.own ? 'own' : 'goal', true);
    for (const id of cur()?.sides?.[e.side] ?? []) V.celebrate(id, 'win');
    for (const id of cur()?.sides?.[1 - e.side] ?? []) V.celebrate(id, 'sad');
    goalFlash = performance.now() + 2500;
    replay = { start: performance.now() + 1200, from: performance.now() - 2000, to: performance.now(), speed: 0.55, fired: 0 };
    if (e.side === mySide && track) {
      track.goalsFor++;
      const k = lastKick[me], fresh = k && performance.now() - k.at < 3500 && e.touch === me;
      if (e.touch === me || e.by === me) { P.stats.goals++; if (fresh) { track.kinds[k.kind] = (track.kinds[k.kind] ?? 0) + 1; P.stats.kinds[k.kind] = (P.stats.kinds[k.kind] ?? 0) + 1; } }
      const mine = L ? L.match.world.players.find(p => p.id === me) : snaps.at(-1)?.s.p.find(p => p.id === me);
      if (mine?.power || (fresh && ['feu', 'tornade'].includes(k.kind))) track.powerGoal = true;
      if (!L || !['duo', 'train'].includes(L.ctx.type)) earn(fresh && SPECIAL.includes(k.kind) ? 15 : 10, 'but');
      blip(784, 1568, 0.4, 'square', 0.06, 0.3);
    } else if (track && mySide >= 0 && e.side !== mySide) track.conceded++;
    saveP();
    if (L) checkDefi();
  }
}
// Fin d'un match (en ligne ou hors ligne) : statistiques et pièces.
function matchOver(r) {
  if (!r || (L && ['duo', 'train'].includes(L.ctx.type))) return null;
  const my = sideOf(meId()), res = r.win === null || r.win === undefined ? 'nul' : r.win === my ? 'win' : 'loss';
  P.stats.played++; P.stats[{ win: 'won', nul: 'drawn', loss: 'lost' }[res]]++;
  P.stats.conceded += r.score[1 - my] ?? 0;
  P.stats.streak = res === 'win' ? P.stats.streak + 1 : 0; P.stats.bestStreak = Math.max(P.stats.bestStreak, P.stats.streak);
  saveP();
  earn({ win: 50, nul: 20, loss: 10 }[res], { win: 'victoire', nul: 'match nul', loss: 'pour avoir joué' }[res]);
  return res;
}

/* ---------------- Replay au ralenti ---------------- */
const rec = [];
let replay = null;
function record(now, scene) {
  rec.push({ at: now, scene: { ...scene, players: scene.players.map(p => ({ ...p })), balls: scene.balls.map(b => ({ ...b })) }, ev: recEv.splice(0) });
  while (rec.length && now - rec[0].at > 3200) rec.shift();
}
function replayScene(now) {
  if (!replay || now < replay.start) return null;
  const at = replay.from + (now - replay.start) * replay.speed;
  if (at > replay.to) { replay = null; return null; }
  let i = rec.findIndex(r => r.at >= at); if (i < 0) return null;
  for (let k = replay.fired; k <= i; k++) for (const e of rec[k]?.ev ?? []) { if (e.t === 'kick') V.fx.kick(e); if (e.t === 'header') V.fx.header(e); }
  replay.fired = i + 1;
  return { ...rec[i].scene, replay: true };
}

/* ---------------- Commandes : deux claviers, souris, manettes, tactile ---------------- */
const keys = new Set();
const KEYS1 = { KeyA: IN.L, KeyD: IN.R, KeyW: IN.JUMP, Space: IN.KICK, KeyJ: IN.KICK, ShiftLeft: IN.SPRINT, KeyS: IN.LOB, KeyK: IN.LOB, KeyE: IN.POWER };
const KEYS2 = { ArrowLeft: IN.L, ArrowRight: IN.R, ArrowUp: IN.JUMP, Enter: IN.KICK, NumpadEnter: IN.KICK, ShiftRight: IN.SPRINT, ArrowDown: IN.LOB, ControlRight: IN.POWER, Numpad0: IN.POWER, KeyL: IN.KICK, KeyP: IN.POWER };
let mouse = 0, touchBits = 0;
const duo = () => L?.ctx.type === 'duo';
addEventListener('keydown', e => { if (e.target.closest?.('input, select')) return; if ((KEYS1[e.code] ?? KEYS2[e.code]) !== undefined && document.body.classList.contains('playing')) { e.preventDefault(); keys.add(e.code); audio(); } });
addEventListener('keyup', e => keys.delete(e.code));
addEventListener('blur', () => { keys.clear(); mouse = 0; touchBits = 0; });
$('#view').addEventListener('mousedown', e => { audio(); mouse |= e.button === 2 ? IN.LOB : IN.KICK; });
addEventListener('mouseup', e => { mouse &= e.button === 2 ? ~IN.LOB : ~IN.KICK; });
$('#view').addEventListener('contextmenu', e => e.preventDefault());
function pad(g) {
  let bits = 0; if (!g) return 0;
  const ax = g.axes[0] ?? 0, ay = g.axes[1] ?? 0, b = i => g.buttons[i]?.pressed;
  if (ax < -0.35 || b(14)) bits |= IN.L; if (ax > 0.35 || b(15)) bits |= IN.R; if (ay < -0.6 || b(0)) bits |= IN.JUMP;
  if (b(2) || b(7)) bits |= IN.KICK; if (b(1)) bits |= IN.LOB; if (b(4) || b(5) || b(6)) bits |= IN.SPRINT; if (b(3)) bits |= IN.POWER;
  return bits;
}
function readInput(n = 1) {
  const gp = [...(navigator.getGamepads?.() ?? [])].filter(Boolean);
  let bits = 0;
  if (n === 1) { bits = mouse | touchBits | pad(gp[0]); for (const k of keys) bits |= KEYS1[k] ?? (duo() ? 0 : KEYS2[k] ?? 0); }
  else { bits = pad(gp[1]); for (const k of keys) bits |= KEYS2[k] ?? 0; }
  return bits;
}
// boutons tactiles (téléphones, tablettes)
if (matchMedia('(pointer: coarse)').matches) document.body.classList.add('touch');
for (const b of $$('#touch [data-bit]')) {
  const bit = IN[b.dataset.bit];
  b.addEventListener('pointerdown', e => { e.preventDefault(); audio(); touchBits |= bit; b.classList.add('on'); });
  for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) b.addEventListener(ev, () => { touchBits &= ~bit; b.classList.remove('on'); });
}

/* ---------------- Interface ---------------- */
let toastT = 0, goalFlash = 0;
function toast(t) { const el = $('#toast'); el.textContent = t; el.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => (el.hidden = true), 2600); }
function banner(title, sub) { const b = $('#banner'); b.hidden = true; void b.offsetWidth; b.innerHTML = `<b>${esc(title)}</b>${sub ? `<span>${esc(sub)}</span>` : ''}`; b.hidden = false; clearTimeout(banner.t); banner.t = setTimeout(() => (b.hidden = true), 2600); }
function flash(t) { const el = $('#flash'); el.textContent = t; el.hidden = true; void el.offsetWidth; el.hidden = false; clearTimeout(flash.t); flash.t = setTimeout(() => (el.hidden = true), 1200); }
const teamName = ids => (ids ?? []).join(' & ');
function showBoard(s) {
  const over = s.phase === 'over', r = s.result;
  if (over) {
    $('#boardTitle').textContent = `🏆 ${s.ranking[0]?.name === s.me ? 'Tu gagnes la Caboche Cup !' : `${s.ranking[0]?.name} gagne la Caboche Cup !`}`;
    $('#boardList').innerHTML = s.ranking.map((p, k) => `<li class="${p.name === s.me ? 'me' : ''}"><b>${k + 1}</b><span>${esc(p.name)}</span><strong>${p.points} pts</strong></li>`).join('');
    $('#boardHint').textContent = '';
  } else if (r) {
    const my = sideOf(s.me);
    $('#boardTitle').textContent = r.win === null ? '🤝 Match nul' : r.win === my ? '🎉 Victoire !' : `${r.winner} gagne le match`;
    $('#boardList').innerHTML = r.sides.map((n, k) => `<li class="${k === my ? 'me' : ''}"><i class="dot" style="background:${TEAM[k]}"></i><span>${esc(teamName(n))}</span><strong>${r.score[k]}</strong></li>`).join('');
    $('#boardHint').textContent = r.forfeit !== null ? 'Victoire par forfait' : s.roundNo < s.settings.rounds ? `Match ${s.roundNo}/${s.settings.rounds} · le suivant arrive…` : '';
  }
  ui.endButtons(s, over ? s.ranking : []);
  if (!over) $('#boardButtons').innerHTML = '';
  $('#board').hidden = false;
}
// Panneau de fin pour les parties hors ligne : titre, lignes, texte, boutons [[libellé, action, classe]].
function localBoard(title, rows, hint, buttons) {
  $('#boardTitle').textContent = title;
  $('#boardList').innerHTML = rows.join('');
  $('#boardHint').innerHTML = hint;
  const box = $('#boardButtons'); box.innerHTML = '';
  for (const [label, fn, cls = 'primary'] of buttons) { const b = document.createElement('button'); b.className = cls; b.textContent = label; b.onclick = () => { audio(); fn(); }; box.append(b); }
  $('#board').hidden = false;
}
const scoreRows = r => r.sides.map((n, k) => `<li class="${k === 0 ? 'me' : ''}"><i class="dot" style="background:${TEAM[k]}"></i><span>${esc(teamName(n))}</span><strong>${r.score[k]}</strong></li>`);
function hud(list, clockMs, golden) {
  const s = cur(), score = s?.score ?? [0, 0], names = s?.sides ?? [];
  const secs = Math.ceil((clockMs ?? 0) / 1000), clock = golden ? 'BUT EN OR' : `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
  $('#sbL').textContent = teamName(names[0]); $('#sbR').textContent = teamName(names[1]);
  $('#sbScore').textContent = `${score[0]} - ${score[1]}`; $('#sbClock').textContent = clock;
  $('#sbClock').classList.toggle('hurry', !golden && secs <= 10 && s?.phase === 'play');
  const me = s?.me;
  for (const d of [0, 1]) {
    const p = list.find(q => q.side === d && (q.me || (duo() && L.humans.some(h => h.id === q.id)))) ?? list.find(q => q.side === d && !s.players.find(x => x.name === q.id)?.bot) ?? list.find(q => q.side === d);
    const el = $(d ? '#gR' : '#gL'); if (!p) { el.hidden = true; continue; }
    el.hidden = false;
    const pw = CC.POWERS[CC.CHARS[p.char].power], key = duo() ? (d ? 'Ctrl' : 'E') : 'E';
    el.style.setProperty('--g', `${Math.round(p.gauge * 100)}%`);
    el.classList.toggle('full', p.gauge >= 1); el.classList.toggle('active', !!p.power);
    el.querySelector('span').textContent = p.power ? `${pw.icon} ${pw.name} !` : p.gauge >= 1 ? `${pw.icon} ${p.id === me || duo() ? `${key} : ` : ''}${pw.name}` : `${pw.icon} ${Math.round(p.gauge * 100)} %`;
  }
  return clock;
}
for (const el of $$('[data-close]')) el.onclick = () => ($(`#${el.dataset.close}`).hidden = true);
// « Quitter » pendant une partie hors ligne : on revient à l'accueil (le salon en ligne garde son propre bouton)
document.addEventListener('click', e => { if (L && e.target.closest('#quitGame')) { e.stopPropagation(); quitLocal(); } }, true);
function quitLocal() { L = null; $('#board').hidden = true; show('home'); V.setTheme('nuit'); }

/* ---------------- Parties hors ligne ---------------- */
const pseudo = () => ui.pseudo || 'Toi';
const BOT_NAMES = ['Crampon', 'Lucarne', 'Petit-Pont', 'Gazon', 'Tonnerre', 'Ciseau', 'Coup-Franc', 'Biscotte'];
function startLocal(players, settings, ctx) {
  if (!ui.pseudo) { $('#nameForm').pseudo.focus(); toast('Choisis d’abord un pseudo'); return; }
  if (ui.room) ui.leave();
  audio();
  L = { match: new LocalMatch(players, settings), humans: players.filter(p => !p.bot).map(p => ({ id: p.id, pad: p.pad ?? 1 })), ctx, phase: null };
  V.setTheme(settings.stade ?? 'nuit');
  for (const id of ['panel', 'board']) $(`#${id}`).hidden = true;
  newMatch(); show('game');
}
const meP = () => ({ id: pseudo(), char: myChar, acc: P.acc, side: 0, bot: 0 });
const botP = (char, lvl, name, side = 1) => ({ id: `${name}`, char, acc: ['aucun', 'casquette', 'bandana', 'lunettes', 'cornes'][Math.floor(Math.random() * 5)], side, bot: lvl });
const randChar = (but = []) => { const l = CC.CHAR_IDS.filter(c => !but.includes(c)); return l[Math.floor(Math.random() * l.length)]; };
function localEnd() {
  const m = L.match, r = m.result, ctx = L.ctx, res = matchOver(r);
  const again = () => startLocal(m.players, m.settings, ctx);
  if (ctx.type === 'train') return localBoard('🎯 Fin de l’entraînement', scoreRows(r), 'Les tirs affichaient leur vitesse : vise la frappe parfaite (milieu du geste) !', [['Encore', again], ['Accueil', quitLocal, 'ghost']]);
  if (ctx.type === 'duo') return localBoard(r.win === null ? '🤝 Match nul' : `🏆 ${teamName(r.sides[r.win])} gagne !`, scoreRows(r), '', [['Revanche', again], ['Accueil', quitLocal, 'ghost']]);
  if (ctx.type === 'tour') return tourEnd(res, r);
  if (ctx.type === 'survie') return survieEnd(res, r);
  if (ctx.type === 'defi') return defiEnd(res, r);
}

/* Tournoi : sept adversaires de plus en plus forts jusqu'à la coupe */
const TOUR = [{ lvl: 1, stade: 'nuit', name: 'Tour 1' }, { lvl: 1, stade: 'plage', name: 'Tour 2' }, { lvl: 2, stade: 'neige', name: 'Tour 3' }, { lvl: 2, stade: 'toit', name: '8e de finale' }, { lvl: 2, stade: 'orage', name: 'Quart de finale' }, { lvl: 3, stade: 'nuit', name: 'Demi-finale' }, { lvl: 3, stade: 'nuit', name: 'FINALE' }];
function openTour() {
  if (!P.tour) { const opps = []; for (let k = 0; k < TOUR.length; k++) opps.push(randChar([myChar, ...opps]) ?? randChar([myChar])); P.tour = { stage: 0, opps }; saveP(); }
  const t = P.tour;
  panel('🏆 Tournoi de la Caboche Cup', `<p class="hint">Sept matchs, des robots de plus en plus forts, des stades différents. Une défaite et c'est l'élimination ! 40 🪙 par victoire, 400 🪙 pour la coupe.</p>
    <ol class="ladder">${TOUR.map((s, k) => `<li class="${k < t.stage ? 'done' : k === t.stage ? 'next' : ''}"><canvas data-portrait="${t.opps[k]}" data-side="1" width="96" height="96"></canvas><span><b>${s.name}</b><small>${CC.CHARS[t.opps[k]].name} · ${CC.STADES[s.stade]} · ${'⭐'.repeat(s.lvl)}</small></span>${k < t.stage ? '✅' : k === t.stage ? '⚽' : '🔒'}</li>`).join('')}</ol>
    <div class="row center"><button class="primary big" id="tourGo">${t.stage ? 'Match suivant' : 'Coup d’envoi !'}</button><button class="ghost" id="tourReset">Recommencer</button></div>`);
  $('#tourGo').onclick = tourMatch;
  $('#tourReset').onclick = () => { P.tour = null; saveP(); openTour(); };
}
function tourMatch() {
  const t = P.tour, s = TOUR[t.stage];
  startLocal([meP(), botP(t.opps[t.stage], s.lvl, `${CC.CHARS[t.opps[t.stage]].name} FC`)], { time: 90, stade: s.stade, bonus: 1 }, { type: 'tour' });
}
function tourEnd(res, r) {
  const t = P.tour, s = TOUR[t.stage];
  if (res === 'win') {
    t.stage++; earn(40, s.name);
    if (t.stage >= TOUR.length) { P.tour = null; P.stats.tournois++; saveP(); fanfare([523, 659, 784, 1046, 1318, 1568]); earn(400, 'la coupe !'); return localBoard('🏆 CHAMPION DE LA CABOCHE CUP !', scoreRows(r), `Tu as remporté le tournoi ! Tournois gagnés : ${P.stats.tournois}`, [['Nouveau tournoi', openTour], ['Accueil', quitLocal, 'ghost']]); }
    saveP();
    return localBoard(`✅ Qualifié ! (${s.name})`, scoreRows(r), `Prochain : <b>${TOUR[t.stage].name}</b> contre ${CC.CHARS[t.opps[t.stage]].name}`, [['Match suivant', tourMatch], ['Voir le tableau', () => { quitLocal(); openTour(); }, 'ghost']]);
  }
  P.tour = null; saveP();
  return localBoard(res === 'nul' ? '😬 Éliminé aux… nuls' : '😢 Éliminé !', scoreRows(r), `Tu t'arrêtes en ${s.name}. Retente ta chance !`, [['Nouveau tournoi', () => { quitLocal(); openTour(); }], ['Accueil', quitLocal, 'ghost']]);
}

/* Survie : un but et c'est fini ; les robots durcissent ; classement mondial */
let surv = null;
async function openSurvie() {
  panel('💀 Survie', `<p class="hint">Chaque match se joue au premier but. Gagne et un robot plus fort arrive ; encaisse un but et c'est terminé. Ton record : <b>${P.stats.survie}</b> robot(s).</p>
    <div class="row center"><button class="primary big" id="survGo">Commencer</button></div><h3>🌍 Classement mondial</h3><ol class="ranking" id="survBoard"><li class="hint">Chargement…</li></ol>`);
  $('#survGo').onclick = () => { surv = { streak: 0, goals: 0, start: Date.now() }; survieMatch(); };
  const list = await fetch('/api/caboche/board?mode=survie').then(r => (r.ok ? r.json() : [])).catch(() => []);
  const el = $('#survBoard'); if (el) el.innerHTML = list.length ? list.map((e, k) => `<li class="${e.name === ui.pseudo ? 'me' : ''}"><b>${k + 1}</b><span>${esc(e.name)}</span><strong>${e.streak} 🤖</strong></li>`).join('') : '<li class="hint">Personne encore : sois le premier !</li>';
}
function survieMatch() {
  const lvl = Math.min(3, 1 + Math.floor(surv.streak / 2)), stades = Object.keys(CC.STADES), ch = randChar();
  startLocal([meP(), botP(ch, lvl, `Robot n°${surv.streak + 1}`)], { time: 90, goals: 1, stade: stades[surv.streak % stades.length], bonus: 1 }, { type: 'survie' });
}
async function survieEnd(res, r) {
  surv.goals += r.score[0];
  if (res === 'win') { surv.streak++; earn(25, 'robot battu'); return localBoard(`💪 Robot n°${surv.streak} battu !`, scoreRows(r), `Série : <b>${surv.streak}</b>. Le suivant sera plus coriace…`, [['Robot suivant', survieMatch], ['Arrêter', () => survieOver(r), 'ghost']]); }
  return survieOver(r);
}
async function survieOver(r) {
  const n = surv.streak, best = n > P.stats.survie; if (best) { P.stats.survie = n; saveP(); }
  let place = '';
  if (n > 0) { const out = await fetch('/api/caboche/board', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode: 'survie', name: ui.pseudo, streak: n, goals: Math.max(n, surv.goals), seconds: Math.round((Date.now() - surv.start) / 1000) }) }).then(x => x.json()).catch(() => null); if (out?.place) place = ` · ${out.place}e du classement mondial !`; }
  localBoard('💀 Fin de la survie', scoreRows(r), `${n} robot${n > 1 ? 's' : ''} battu${n > 1 ? 's' : ''}${best ? ' · nouveau record !' : ''}${place}`, [['Rejouer', () => { surv = { streak: 0, goals: 0, start: Date.now() }; survieMatch(); }], ['Accueil', quitLocal, 'ghost']]);
}

/* Défis */
const DEFIS = [
  { id: 'lob', icon: '🌈', name: 'Arc-en-ciel', text: 'Marque 2 buts sur un lob (clic droit ou S).', reward: 120, lvl: 1, done: c => (c.kinds.lob ?? 0) >= 2 },
  { id: 'volee', icon: '🦶', name: 'De volée', text: 'Marque 2 buts de volée (tire en l’air).', reward: 120, lvl: 1, done: c => (c.kinds.volee ?? 0) >= 2 },
  { id: 'parfait', icon: '⚡', name: 'Pied parfait', text: 'Marque 2 buts sur une frappe parfaite (le ballon au milieu du geste).', reward: 200, lvl: 1, done: c => (c.kinds.parfaite ?? 0) >= 2 },
  { id: 'tete', icon: '🗿', name: 'Coup de boule', text: 'Marque 2 buts de la tête.', reward: 150, lvl: 1, done: c => (c.kinds.tete ?? 0) >= 2 },
  { id: 'sol', icon: '👟', name: 'Pieds sur terre', text: 'Gagne sans jamais sauter (premier à 3 buts).', reward: 150, lvl: 1, set: { goals: 3 }, fail: c => c.jumped, win: true },
  { id: 'blanchir', icon: '🧤', name: 'Cage inviolée', text: 'Gagne 3-0 contre un robot Normal.', reward: 200, lvl: 2, set: { goals: 3 }, fail: c => c.conceded > 0, win: true },
  { id: 'pouvoir', icon: '⚡', name: 'Super-héros', text: 'Marque pendant que ton super-pouvoir agit.', reward: 120, lvl: 1, done: c => c.powerGoal },
  { id: 'eclair', icon: '⏱️', name: 'Éclair', text: 'Marque 3 buts en une minute.', reward: 150, lvl: 1, set: { time: 60 }, done: c => c.goalsFor >= 3 },
  { id: 'lune', icon: '🌙', name: 'Premier pas', text: 'Gagne sur la Lune contre un robot Normal.', reward: 150, lvl: 2, set: { mode: 'lune' }, win: true },
  { id: 'multi', icon: '⚽', name: 'Jongleur', text: 'Marque 5 buts en Multi-ballons.', reward: 180, lvl: 1, set: { mode: 'multi' }, done: c => c.goalsFor >= 5 },
  { id: 'coriace', icon: '😈', name: 'Le boss', text: 'Bats le robot Coriace.', reward: 300, lvl: 3, win: true },
  { id: 'equipe', icon: '🤝', name: 'Esprit d’équipe', text: 'Gagne un 2 contre 2 avec un robot coéquipier.', reward: 200, lvl: 2, team: true, win: true },
];
function openDefis() {
  const n = DEFIS.filter(d => P.defis[d.id]).length;
  panel(`🎯 Défis (${n}/${DEFIS.length})`, `<div class="defis">${DEFIS.map(d => `<button class="defi ${P.defis[d.id] ? 'done' : ''}" data-defi="${d.id}"><i>${d.icon}</i><span><b>${d.name}</b><small>${esc(d.text)}</small></span><em>${P.defis[d.id] ? '✅' : `+${d.reward} 🪙`}</em></button>`).join('')}</div>`);
  $('#panelBody').onclick = e => { const b = e.target.closest('[data-defi]'); if (b) defiMatch(DEFIS.find(d => d.id === b.dataset.defi)); };
}
function defiMatch(d) {
  const opp = randChar([myChar]), players = [meP(), botP(opp, d.lvl, `Robot ${BOT_NAMES[Math.floor(Math.random() * 8)]}`)];
  if (d.team) players.push(botP(randChar(), 2, 'Ton coéquipier', 0), botP(randChar(), 2, `Robot ${BOT_NAMES[3]}`));
  startLocal(players, { time: 120, bonus: 1, stade: 'nuit', ...d.set }, { type: 'defi', defi: d });
}
function checkDefi() {
  const d = L?.ctx.defi; if (!d || L.match.phase === 'end') return;
  if (d.done?.(track)) L.match.end(); // réussi tout de suite
  else if (d.fail?.(track)) L.match.end(0);
}
function defiEnd(res, r) {
  const d = L.ctx.defi, ok = d.done ? d.done(track) : res === 'win' && !d.fail?.(track);
  const retry = () => defiMatch(d);
  if (ok) { const first = !P.defis[d.id]; P.defis[d.id] = true; saveP(); if (first) earn(d.reward, `défi « ${d.name} »`); fanfare([659, 784, 1046, 1318]); return localBoard(`🎯 Défi réussi : ${d.name} !`, scoreRows(r), first ? `+${d.reward} 🪙` : 'Déjà réussi : pas de nouvelle récompense.', [['Autres défis', () => { quitLocal(); openDefis(); }], ['Accueil', quitLocal, 'ghost']]); }
  return localBoard(`❌ Défi raté : ${d.name}`, scoreRows(r), esc(d.text), [['Réessayer', retry], ['Autres défis', () => { quitLocal(); openDefis(); }, 'ghost']]);
}

/* Deux joueurs sur le même clavier */
let p2Char = 'lila';
function openDuo() {
  panel('🎮 À deux sur le même clavier', `<div class="duo"><div><h3>Joueur 1 · ${esc(pseudo())}</h3><canvas data-portrait="${myChar}" width="160" height="160"></canvas><p class="hint"><kbd>Q</kbd><kbd>D</kbd> courir · <kbd>Z</kbd> sauter · <kbd>Espace</kbd> tirer · <kbd>Maj</kbd> sprint · <kbd>S</kbd> lob · <kbd>E</kbd> pouvoir</p></div>
    <div><h3>Joueur 2</h3><canvas data-portrait="${p2Char}" data-side="1" width="160" height="160"></canvas><div class="row center"><button class="ghost small" id="p2Prev">◀</button><b id="p2Name">${CC.CHARS[p2Char].name}</b><button class="ghost small" id="p2Next">▶</button></div><p class="hint"><kbd>←</kbd><kbd>→</kbd> courir · <kbd>↑</kbd> sauter · <kbd>Entrée</kbd> tirer · <kbd>Maj</kbd> droite sprint · <kbd>↓</kbd> lob · <kbd>Ctrl</kbd> droite pouvoir</p></div></div>
    <div class="grid three"><label>Durée <select id="duoTime"><option value="60">1 min</option><option value="120" selected>2 min</option><option value="180">3 min</option></select></label><label>Mode <select id="duoMode">${options(CC.MODES, 'normal')}</select></label><label>Stade <select id="duoStade">${options(CC.STADES, 'nuit')}</select></label></div>
    <div class="row center"><button class="primary big" id="duoGo">⚽ Jouer !</button></div>`);
  const step = k => { const l = CC.CHAR_IDS; p2Char = l[(l.indexOf(p2Char) + k + l.length) % l.length]; $('canvas[data-side="1"]').dataset.portrait = p2Char; $('#p2Name').textContent = CC.CHARS[p2Char].name; };
  $('#p2Prev').onclick = () => step(-1); $('#p2Next').onclick = () => step(1);
  $('#duoGo').onclick = () => startLocal([meP(), { id: 'Joueur 2', char: p2Char, acc: 'aucun', side: 1, bot: 0, pad: 2 }], { time: +$('#duoTime').value, mode: $('#duoMode').value, stade: $('#duoStade').value, bonus: 1 }, { type: 'duo' });
}

/* Boutique */
function openShop(tab = 'chars') {
  const tabs = { chars: '🧑 Joueurs', accs: '🎩 Accessoires', balls: '⚽ Ballons' };
  const items = tab === 'chars' ? CC.CHAR_IDS.map(id => [id, CC.CHARS[id].name, CC.CHARS[id].price, `${CC.POWERS[CC.CHARS[id].power].icon} ${CC.POWERS[CC.CHARS[id].power].name}`]) : tab === 'accs' ? Object.entries(CC.ACCS).map(([id, a]) => [id, a.name, a.price, 'Visible en ligne']) : Object.entries(BALLS).map(([id, b]) => [id, b.name, b.price, 'Ton ballon à l’écran']);
  const eq = { chars: myChar, accs: P.acc, balls: P.ball }[tab];
  panel('🛒 Boutique', `<p class="hint">Tu as <b class="coins">${P.coins} 🪙</b>. On en gagne à chaque but, chaque match, chaque défi et au tournoi.</p>
    <div class="tabs">${Object.entries(tabs).map(([k, v]) => `<button class="${k === tab ? 'on' : ''}" data-tab="${k}">${v}</button>`).join('')}</div>
    <div class="shop">${items.map(([id, name, price, sub]) => { const own = P[tab].includes(id); return `<div class="item ${id === eq ? 'on' : ''}">${tab === 'balls' ? `<i class="ballico b-${id}"></i>` : `<canvas data-portrait="${tab === 'chars' ? id : myChar}"${tab === 'accs' ? ` data-acc-show="${id}"` : ''} width="120" height="120"></canvas>`}<b>${esc(name)}</b><small>${esc(sub)}</small>${own ? `<button class="small ${id === eq ? 'ghost' : 'primary'}" data-eq="${id}">${id === eq ? 'Équipé' : 'Équiper'}</button>` : `<button class="small primary" data-buy="${id}" data-price="${price}" data-name="${esc(name)}">${price} 🪙</button>`}</div>`; }).join('')}</div>`);
  $('#panelBody').onclick = e => {
    const t = e.target.closest('[data-tab]'), b = e.target.closest('[data-buy]'), q = e.target.closest('[data-eq]');
    if (t) return openShop(t.dataset.tab);
    if (b && buy(tab, b.dataset.buy, +b.dataset.price, b.dataset.name)) equip(tab, b.dataset.buy);
    if (q) equip(tab, q.dataset.eq);
    if (b || q) openShop(tab);
  };
}
function equip(tab, id) {
  if (tab === 'chars') return pickChar(id);
  if (tab === 'accs') { P.acc = id; saveP(); refreshCards(); if (ui.room && ['lobby', 'over'].includes(ui.room.phase)) act('pick', myChar, P.acc); }
  if (tab === 'balls') { P.ball = id; saveP(); V.setBallSkin(id); }
}

/* Statistiques */
function openStats() {
  const s = P.stats, k = s.kinds, ratio = s.played ? Math.round((s.won / s.played) * 100) : 0;
  const KN = { frappe: 'Frappes', parfaite: 'Frappes parfaites', volee: 'Volées', lob: 'Lobs', tete: 'Têtes', feu: 'Super Tirs', tornade: 'Tornades' };
  panel('📊 Statistiques', `<div class="statgrid">${[['Matchs', s.played], ['Victoires', `${s.won} (${ratio} %)`], ['Nuls', s.drawn], ['Défaites', s.lost], ['Buts marqués', s.goals], ['Buts encaissés', s.conceded], ['Meilleure série', s.bestStreak], ['Record en survie', s.survie], ['Tournois gagnés', s.tournois], ['Défis réussis', `${Object.keys(P.defis).length}/${DEFIS.length}`], ['Pièces', `${P.coins} 🪙`], ['Joueurs débloqués', `${P.chars.length}/${CC.CHAR_IDS.length}`]].map(([a, b]) => `<div><small>${a}</small><b>${b}</b></div>`).join('')}</div>
    <h3>⚽ Tes buts par geste</h3><div class="statgrid">${Object.entries(KN).map(([id, n]) => `<div><small>${n}</small><b>${k[id] ?? 0}</b></div>`).join('')}</div>`);
}
function panel(title, html) { $('#panelTitle').innerHTML = title; $('#panelBody').innerHTML = html; $('#panelBody').onclick = null; $('#panel').hidden = false; renderCoins(); }
$('#tourBtn').onclick = () => { audio(); openTour(); };
$('#survieBtn').onclick = () => { audio(); openSurvie(); };
$('#defisBtn').onclick = () => { audio(); openDefis(); };
$('#duoBtn').onclick = () => { audio(); openDuo(); };
$('#trainBtn').onclick = () => { audio(); startLocal([meP()], { time: 300, bonus: 0, stade: 'nuit' }, { type: 'train' }); };
$('#shopBtn').onclick = () => { audio(); openShop(); };
$('#statsBtn').onclick = () => { audio(); openStats(); };

/* ---------------- Boucle ---------------- */
let last = performance.now(), acc = 0, outbox = [];
const fmt = ms => { const s = Math.ceil(ms / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  const t = now / 1000;
  let scene = null;
  if (L) { // partie hors ligne : le navigateur fait tout
    const m = L.match;
    acc += dt;
    while (acc >= CC.DT) {
      acc -= CC.DT;
      const inputs = {}; for (const h of L.humans) inputs[h.id] = readInput(h.pad);
      m.step(inputs);
      for (const e of m.events.splice(0)) onEvent(e);
      if (!L) break;
      if (m.phase !== L.phase) { const old = L.phase; L.phase = m.phase; onPhase(m.phase, old); if (m.phase === 'end') { localEnd(); break; } }
    }
    if (L) {
      const w = L.match.world, env = CC.envOf(w.opts);
      const list = w.players.map(p => ({ ...p, name: p.id, acc: L.match.players.find(q => q.id === p.id)?.acc, me: L.humans.some(h => h.id === p.id) }));
      const clock = hud(list, L.match.clockMs, L.match.golden);
      scene = { players: list, balls: w.balls.map(b => ({ ...b, r: env.r })), items: w.items.map(i => [i.x, i.y, i.kind]), walls: w.walls, goalH: w.goalH, wind: w.wind, g: env.bg, board: { names: L.match.sides().map(teamName), score: L.match.score, clock, flash: now < goalFlash } };
    }
  } else {
    const s = S, live = s && (s.phase === 'play' || s.phase === 'goal'), env = CC.envOf(s?.settings);
    acc += dt;
    while (acc >= CC.DT) {
      acc -= CC.DT;
      if (live && PW) {
        const bits = readInput(1), ev = []; pending.push([++seq, bits]); outbox.push([seq, bits]);
        CC.stepWorld(PW, { [s.me]: bits }, ev);
        for (const e of ev) if (e.id === s.me) { if (e.t === 'jump') SFX.jump(); if (e.t === 'kick') kickFx(e, true); }
        if (pending.length > 120) pending.shift();
      }
    }
    if (outbox.length) socket.emit('in', outbox.splice(0));
    vis.x *= Math.exp(-dt * 14);
    for (const o of ballOff) { o.x *= Math.exp(-dt * 10); o.y *= Math.exp(-dt * 10); }
    if (inMatch(s) && snaps.length) {
      const snap = snaps.at(-1).s, rt = now - 66;
      let i = snaps.findIndex(x => x.at > rt); if (i < 0) i = snaps.length - 1;
      const B = snaps[i], A = snaps[Math.max(0, i - 1)], k = B.at > A.at ? Math.max(0, Math.min(1, (rt - A.at) / (B.at - A.at))) : 1;
      const list = B.s.p.map(b => {
        let p;
        if (b.id === s.me && pred) p = { ...pred, x: pred.x + vis.x };
        else { const a = A.s.p.find(x => x.id === b.id) ?? b; p = { ...b, x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k }; }
        return { ...p, name: p.id, acc: s.players.find(q => q.name === p.id)?.acc, me: p.id === s.me };
      });
      // ballons : dernier état connu, prolongé jusqu'à maintenant
      const Ls = snaps.at(-1), age = Math.min(0.12, (now - Ls.at) / 1000), lim = CC.WALL - env.r;
      const balls = live && PW ? PW.balls.map((b, k) => ({ ...b, r: env.r, x: b.x + (ballOff[k]?.x ?? 0), y: b.y + (ballOff[k]?.y ?? 0) })) // ballons anticipés
        : Ls.s.b.map(CC.unpackBall).map(b => ({ ...b, r: env.r, x: Math.max(-lim, Math.min(lim, b.x + b.vx * age)), y: Math.max(env.r, b.y + b.vy * age - 0.5 * env.bg * age * age) }));
      const clock = hud(list, snap.clock, snap.golden);
      scene = { players: list, balls, items: snap.it ?? [], walls: snap.wl, goalH: snap.gh, wind: snap.wd, g: env.bg, board: { names: s.sides.map(teamName), score: s.score, clock, flash: now < goalFlash } };
    }
  }
  if (scene) {
    record(now, scene);
    const rp = replayScene(now);
    V.frame(now < stopUntil ? 0 : rp ? dt * replay.speed : dt, t, rp ?? scene);
    // le public monte quand un ballon approche d'un but
    const near = Math.min(...scene.balls.map(b => CC.F.HL - Math.abs(b.x)));
    if (sound()) crowd(0.14 + Math.max(0, Math.min(1, (5 - near) / 5)) * 0.22);
  } else V.frame(dt, t, null);
}
if (location.hostname === 'localhost') window.cb = { V, state: () => S, pred: () => pred, local: () => L, profile: () => P, give: n => earn(n, 'test'), play: arg => { const [stade, mode = 'normal', a = 'roco', b = 'siroco'] = arg.split('/'); startLocal([{ ...meP(), char: a }, botP(b, 2, 'Robot')], { time: 120, stade, mode, bonus: 1 }, { type: 'duo' }); }, unlock: () => { P.chars = [...CC.CHAR_IDS]; refreshCards(); }, sheet: (t = 0) => { const d = document.createElement('div'); d.style.cssText = 'position:fixed;inset:0;z-index:99;background:#fff7ea;display:grid;grid-template-columns:repeat(4,1fr);align-items:center;justify-items:center'; for (const id of CC.CHAR_IDS) { const cv = document.createElement('canvas'); cv.width = cv.height = 420; cv.style.width = cv.style.height = '420px'; drawPortrait(cv, id, 0, t); d.append(cv); } document.body.append(d); } };
refreshCards(); renderCoins();
requestAnimationFrame(frame);
show('home');
