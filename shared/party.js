// Partagé par les jeux à manches (Chute Libre, Sillage Néon, Prop Hunt), côté navigateur : servi sur /shared/.
// Pseudo, création et entrée dans un salon, liste des salons publics, reconnexion, lien d'invitation, réglages du créateur,
// liste des joueurs, fil d'événements, boutons de fin de partie et petits sons. Chaque jeu y branche sa partie.
export const $ = s => document.querySelector(s);
export const $$ = s => [...document.querySelectorAll(s)];
export const store = {
  get: k => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch { /* stockage bloqué */ } },
};
export const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
export const restartAnim = el => { el.style.animation = 'none'; void el.offsetWidth; el.style.animation = ''; };

/* ---------------- Sons synthétisés ---------------- */
let ac = null;
export const sound = () => ac; // le contexte audio s'il existe déjà (sans le créer)
// À appeler sur un geste du joueur (clic, touche) : les navigateurs n'autorisent le son qu'après.
export const audio = () => { if (!ac) try { ac = new AudioContext(); } catch { /* pas de son */ } if (ac?.state === 'suspended') ac.resume(); return ac; };
export function blip(f0, f1, dur, type = 'sine', vol = 0.12, at = 0) {
  if (!ac) return;
  const t = ac.currentTime + at, o = ac.createOscillator(), g = ac.createGain();
  o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g).connect(ac.destination); o.start(t); o.stop(t + dur + 0.02);
}
export const fanfare = (notes = [523, 659, 784, 1046], gap = 0.12) => notes.forEach((f, k) => blip(f, f, 0.24, 'triangle', 0.11, k * gap));

/* ---------------- Salon ---------------- */
// id : nom du jeu (canal, adresse, clés du navigateur) ; max : joueurs par salon ; bots : robots de la partie solo ;
// busy : texte des salons en jeu ; onShow(écran) et onRoom(état, créateur ?) : ce que le jeu ajoute.
export function party({ id, socket, max, bots = 5, busy = '🎮 en jeu', onShow, onRoom, onError = alert }) {
  const params = new URLSearchParams(location.search);
  const ui = { room: null, pseudo: store.get(`${id}-pseudo`) || store.get('pseudo') || '' };
  const form = $('#nameForm');
  form.pseudo.value = ui.pseudo;
  form.pseudo.oninput = e => { ui.pseudo = e.target.value.trim().slice(0, 20); store.set(`${id}-pseudo`, ui.pseudo); };
  form.onsubmit = e => e.preventDefault();

  ui.show = screen => {
    for (const s of $$('.screen')) s.hidden = s.id !== screen;
    const playing = screen === 'game';
    $('#hud').hidden = !playing;
    document.body.classList.toggle('playing', playing);
    onShow?.(screen);
  };
  const ask = (ev, payload) => new Promise(res => socket.emit(ev, payload, r => res(r)));
  ui.act = (...a) => new Promise(res => socket.emit('act', ...a, r => { if (r?.error) onError(r.error); res(r); }));
  ui.enter = async (ev, payload) => {
    if (!ui.pseudo) { form.pseudo.focus(); alert('Choisis d’abord un pseudo'); return null; }
    const r = await ask(ev, { ...payload, name: ui.pseudo });
    if (r?.error) alert(r.error);
    return r?.ok ? r : null;
  };
  ui.leave = () => { socket.emit('leave'); store.set(`${id}-session`, null); ui.room = null; history.replaceState(null, '', location.pathname); $('#board').hidden = true; ui.show('home'); };

  $('#soloBtn').onclick = async () => {
    audio();
    if (!(await ui.enter('create', { private: true }))) return;
    for (let k = 0; k < bots; k++) await ui.act('addBot');
    ui.act('start');
  };
  $('#createForm').onsubmit = e => { e.preventDefault(); audio(); ui.enter('create', { private: e.target.vis.value === 'private' }); };
  $('#joinForm').onsubmit = e => { e.preventDefault(); audio(); ui.enter('join', { code: e.target.code.value, watch: e.submitter?.value === 'watch' }); };
  $('#rooms').onclick = e => { const b = e.target.closest('[data-room]'); if (b) { audio(); ui.enter('join', { code: b.dataset.room, watch: b.dataset.mode === 'watch' }); } };
  socket.on('rooms', list => {
    $('#rooms').innerHTML = list.length ? list.map(r => `<li><span><b class="code">${r.code}</b> · ${r.players.map(esc).join(', ')} ${r.phase !== 'lobby' ? `· ${busy}` : ''}</span>
      ${r.phase === 'lobby' ? `<button class="small primary" data-room="${r.code}">Rejoindre</button>` : ''}<button class="small ghost" data-room="${r.code}" data-mode="watch">👁</button></li>`).join('') : '<li class="hint">Aucun salon public : crée le tien !</li>';
  });
  $('#leave').onclick = ui.leave;
  $('#quitGame').onclick = ui.leave;
  $('#copyLink').onclick = () => { navigator.clipboard?.writeText(`${location.origin}/${id}/?salon=${ui.room.code}`); $('#copyLink').textContent = '✓ Copié'; setTimeout(() => ($('#copyLink').textContent = '🔗 Copier le lien'), 1500); };
  $('#addBot').onclick = () => ui.act('addBot');
  $('#startBtn').onclick = () => { audio(); ui.act('start'); };
  $('#rounds').onchange = e => ui.act('configure', 'rounds', Number(e.target.value));
  $('#players').onclick = e => { const b = e.target.closest('[data-bot]'); if (b) ui.act('removeBot', b.dataset.bot); };
  socket.on('session', s => { store.set(`${id}-session`, JSON.stringify(s)); history.replaceState(null, '', `?salon=${s.code}`); });
  socket.on('closed', msg => { alert(msg); ui.leave(); });
  socket.on('connect', () => {
    let s = null; try { s = JSON.parse(store.get(`${id}-session`)); } catch { /* illisible */ }
    const code = params.get('salon');
    if (s && (!code || s.code === code)) socket.emit('resume', s, r => { if (r?.error) { store.set(`${id}-session`, null); if (code && ui.pseudo) ui.enter('join', { code }); } });
    else if (code && ui.pseudo) ui.enter('join', { code });
  });
  socket.on('state', s => (ui.room = s)); // enregistré avant celui du jeu : l'état est à jour quand le jeu le lit

  // Le salon : joueurs (✕ pour retirer un robot), spectateurs, réglages et lancement pour le créateur.
  ui.renderRoom = () => {
    const s = ui.room, host = s.host === s.me;
    $('#roomCode').textContent = s.code;
    $('#count').textContent = `(${s.players.length}/${max})`;
    $('#players').innerHTML = s.players.map(p => `<li class="${p.connected ? '' : 'off'}"><i class="dot" style="background:${p.color};--c:${p.color}"></i><span>${esc(p.name)}${p.name === s.host ? ' 👑' : ''}${p.wins ? ` · 🏆 ${p.wins}` : ''}</span>${p.bot && host ? `<button class="small ghost" data-bot="${esc(p.name)}" aria-label="Retirer ${esc(p.name)}">✕</button>` : ''}</li>`).join('');
    $('#spect').textContent = s.spectators.length ? `👁 ${s.spectators.join(', ')}` : '';
    $('#addBot').hidden = !host; $('#rounds').disabled = !host; $('#rounds').value = s.settings.rounds;
    $('#startBtn').hidden = !host; $('#startBtn').disabled = s.players.length < 2;
    $('#roomHint').textContent = host ? (s.players.length < 2 ? 'Ajoute des robots ou invite des amis (lien ci-dessus).' : 'Tout le monde est là ? Lance la partie !') : 'Le créateur du salon lance la partie.';
    onRoom?.(s, host);
  };
  // Fil des événements en jeu (4 s chacun)
  ui.feed = (text, ms = 4000) => { const li = document.createElement('li'); li.textContent = text; $('#feed').prepend(li); setTimeout(() => li.remove(), ms); };
  // Fin de partie : rejouer (créateur), revenir au salon ou quitter ; petite fanfare pour le vainqueur.
  ui.endButtons = (s, ranking) => {
    const btns = $('#boardButtons'), host = s.host === s.me;
    btns.innerHTML = '';
    if (s.phase !== 'over') return;
    if (host) { const b = document.createElement('button'); b.className = 'primary'; b.textContent = 'Rejouer'; b.onclick = async () => { await ui.act('again'); ui.act('start'); }; btns.append(b); }
    const b2 = document.createElement('button'); b2.className = 'ghost'; b2.textContent = host ? 'Retour au salon' : 'Quitter'; b2.onclick = () => (host ? ui.act('again') : ui.leave()); btns.append(b2);
    if (ranking[0]?.name === s.me) fanfare([523, 659, 784, 1046, 1318]);
  };
  return ui;
}
