// La Tour en ligne (mode Aventure) : tous les grimpeurs partagent la même tour et se voient en fantômes.
// Chaque navigateur envoie la position de sa balle (~5 fois par seconde) ; le serveur la relaie aux autres, sans
// rien garder après le départ du joueur. Les fantômes sont purement visuels : la partie reste calculée chez chacun.
// Salles Socket.io : « tour » (ceux qui grimpent), « tour-veille » (tous ceux qui ont la page ouverte : compteur, annonces).
const admin = require('../../../lib/admin');

const COLORS = ['#ff6476', '#5ab4ff', '#7ae08a', '#ffd84a', '#c89cff', '#ff9a5a', '#5ae0d0', '#ff9ac0'];
const MODES = { normal: 'normal', zen: 'zen', hardcore: 'hardcore' };
const climbers = new Map(); // socket.id → { id, name, c, p, at }
let next = 1;

const num = v => typeof v === 'number' && Number.isFinite(v);
// une position plausible : trois nombres, dans le volume de la tour et de sa chute
const okPos = p => Array.isArray(p) && p.length === 3 && p.every(num) && Math.abs(p[0]) < 80 && Math.abs(p[2]) < 80 && p[1] > -80 && p[1] < 200;
const cleanName = s => String(s ?? '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 20);
const pub = c => ({ id: c.id, name: c.name, c: c.c, p: c.p });

module.exports = function tour(nsp, socket) {
  const count = () => nsp.to('tour-veille').emit('tour:count', climbers.size);
  let lastPos = 0, won = false;
  const leave = () => {
    const me = climbers.get(socket.id);
    if (!me) return;
    climbers.delete(socket.id); socket.leave('tour');
    nsp.to('tour').emit('tour:out', me.id);
    count();
  };
  socket.on('tour:watch', () => { socket.join('tour-veille'); socket.emit('tour:count', climbers.size); });
  socket.on('tour:join', (name, p, cb) => {
    if (typeof cb !== 'function' || climbers.has(socket.id)) return;
    const id = next++;
    let n = cleanName(name);
    if (!n || admin.reserved(n, socket.handshake.headers.cookie)) n = `Grimpeur ${id}`;
    const me = { id, name: n, c: COLORS[id % COLORS.length], p: okPos(p) ? p : [0, 0, 0] };
    cb({ me: pub(me), others: [...climbers.values()].map(pub) });
    climbers.set(socket.id, me); socket.join('tour'); socket.join('tour-veille');
    socket.to('tour').emit('tour:in', pub(me));
    count();
  });
  socket.on('tour:pos', p => {
    const me = climbers.get(socket.id), now = Date.now();
    if (!me || !okPos(p) || now - lastPos < 120) return; // au plus ~8 positions par seconde
    lastPos = now; me.p = p.map(v => Math.round(v * 100) / 100);
    socket.volatile.to('tour').emit('tour:pos', me.id, me.p);
  });
  socket.on('tour:lost', () => { const me = climbers.get(socket.id); if (me) socket.to('tour').emit('tour:lost', me.id); });
  // la victoire est annoncée à tous ; une seule fois par grimpeur, et seulement s'il a été vu près du sommet
  socket.on('tour:win', (shots, mode, warped) => {
    const me = climbers.get(socket.id);
    if (!me || won || me.p[1] < 110 || !Number.isInteger(shots) || shots < 1 || shots > 999 || !MODES[mode]) return;
    won = true;
    nsp.to('tour-veille').emit('tour:win', me.name, shots, MODES[mode] + (warped ? ' · téléporté' : ''));
  });
  socket.on('tour:leave', leave);
  socket.on('disconnect', leave);
};
module.exports.climbers = climbers;
