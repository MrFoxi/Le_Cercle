// Administration du Cercle : le pseudo « MrFoxi » est réservé à l'administrateur.
// Le mot de passe vient de la variable d'environnement ADMIN_PASSWORD (jamais dans le code) ; sans elle, personne ne peut
// prendre ce pseudo. Une fois connecté, le navigateur garde un cookie signé que tous les jeux reconnaissent.
// Les salons (lib/rooms.js, le 7,5) et les classements (lib/leaderboard.js) s'inscrivent ici pour être gérés depuis
// /admin.html : présence, salons (fermer, exclure, message), classements (supprimer, annuler), bannissements, annonce,
// journal des événements et des actions, statistiques de fréquentation.
const crypto = require('crypto');
const express = require('express');
const store = require('./store');

const ADMIN = 'MrFoxi';
const COOKIE = 'cercle_admin';
const DAYS = 30;
const PASSWORD = () => process.env.ADMIN_PASSWORD || '';
const key = () => crypto.createHash('sha256').update(`cercle-admin:${PASSWORD()}`).digest(); // changer le mot de passe déconnecte tout le monde
const sign = exp => crypto.createHmac('sha256', key()).update(`${ADMIN}:${exp}`).digest('hex');
const same = (a, b) => a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
const lower = s => String(s ?? '').trim().toLowerCase();

// Le cookie de la requête (ou de la connexion Socket.io) est-il celui de l'administrateur ?
function isAdmin(cookieHeader) {
  if (!PASSWORD()) return false;
  const raw = String(cookieHeader ?? '').split(/;\s*/).find(c => c.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1);
  const [exp, sig] = decodeURIComponent(raw ?? '').split('.');
  return Number(exp) > Date.now() && !!sig && same(sig, sign(exp));
}

// ---------- Bannissements, annonce, journaux (gardés dans le stockage durable) ----------
let bans = [];          // [{ name, reason, at }]
let announce = null;    // { text, at } affiché sur l'accueil
let events = [];        // fil des événements du site (récents d'abord)
let actions = [];       // journal des actions de l'administrateur
let history = [];       // [{ at, total, games: { jeu: n } }] toutes les 5 minutes, 24 h
let days = {};          // 'AAAA-MM-JJ' -> { jeu: nombre d'onglets différents } (7 jours)
store.load('admin-bans', []).then(v => (bans = v));
store.load('admin-announce', null).then(v => (announce = v));
store.load('admin-actions', []).then(v => (actions = [...actions, ...v].slice(0, 200)));
store.load('admin-stats', { history: [], days: {} }).then(v => { history = [...v.history, ...history].slice(-288); days = { ...v.days, ...days }; });

// Message d'erreur si ce pseudo est refusé (réservé sans être l'administrateur, ou banni), sinon null.
function reserved(name, cookieHeader) {
  const n = lower(name);
  if (n === lower(ADMIN)) return isAdmin(cookieHeader) ? null : 'Ce pseudo est réservé';
  return bans.some(b => lower(b.name) === n) ? 'Ce pseudo a été banni du Cercle' : null;
}
// Un événement du site (salon créé, record…) pour le fil de la page d'administration
function event(kind, game, text) {
  events.unshift({ kind, game, text: String(text).slice(0, 160), at: Date.now() });
  events = events.slice(0, 150);
}
function logAction(text, reason) {
  actions.unshift({ text, reason: String(reason ?? '').slice(0, 140), at: Date.now() });
  actions = actions.slice(0, 200);
  store.save('admin-actions', actions);
}

// ---------- Ce que la page peut voir ----------
const rooms = {};    // jeu -> { list(), close(code, msg), kick(code, pseudo), say(code, texte) }
const boards = {};   // nom du classement -> { game, all(), drop(clé, pseudo), restore(clé, entrées, annuler), inspect?(clé, entrée) }
const presence = new Map(); // id d'onglet -> { game, pseudo, at, since, hidden }
const PRESENCE_MS = 60 * 1000;
// Messages de l'administrateur pour des joueurs précis (« jeu:pseudo »), remis à leur page au prochain signal de présence
const inbox = new Map();
function notify(game, names, text) {
  for (const n of names) { const k = `${game}:${lower(n)}`; inbox.set(k, [...(inbox.get(k) ?? []), { text, at: Date.now() }].slice(-5)); }
}
const alive = () => { const now = Date.now(); for (const [id, p] of presence) if (now - p.at > PRESENCE_MS) presence.delete(id); return [...presence.values()]; };
// Fréquentation : un relevé toutes les 5 minutes, et les onglets différents vus chaque jour
const seenToday = new Map(); // jeu -> Set(id)
setInterval(() => {
  const list = alive(), games = {};
  for (const p of list) games[p.game] = (games[p.game] ?? 0) + 1;
  history.push({ at: Date.now(), total: list.length, games });
  history = history.slice(-288);
  const day = new Date().toISOString().slice(0, 10);
  days[day] = Object.fromEntries([...seenToday].map(([g, s]) => [g, s.size]));
  for (const d of Object.keys(days).sort().slice(0, -7)) delete days[d];
  store.save('admin-stats', { history, days });
}, 5 * 60 * 1000).unref();
let today = new Date().toISOString().slice(0, 10);

// Corbeille : un temps supprimé peut être remis pendant 20 s
const trash = new Map(); // id -> { board, key, entries, undo, at }

const router = express.Router();
router.use(express.json({ limit: '4kb' }));
// Connexion : quelques essais seulement par adresse, pour éviter de deviner le mot de passe
const tries = new Map();
router.post('/login', (req, res) => {
  const ip = req.ip, t = tries.get(ip) ?? { n: 0, at: Date.now() };
  if (Date.now() - t.at > 15 * 60 * 1000) Object.assign(t, { n: 0, at: Date.now() });
  if (t.n >= 8) return res.status(429).json({ error: 'Trop d’essais : réessaie dans un quart d’heure' });
  if (!PASSWORD()) return res.status(503).json({ error: 'Mot de passe administrateur non configuré sur le serveur (ADMIN_PASSWORD)' });
  if (!same(crypto.createHash('sha256').update(String(req.body?.password ?? '')).digest('hex'), crypto.createHash('sha256').update(PASSWORD()).digest('hex'))) {
    t.n++; tries.set(ip, t);
    return res.status(401).json({ error: 'Mot de passe incorrect' });
  }
  tries.delete(ip);
  const exp = Date.now() + DAYS * 24 * 3600 * 1000, secure = req.secure || req.headers['x-forwarded-proto'] === 'https';
  res.setHeader('Set-Cookie', `${COOKIE}=${exp}.${sign(exp)}; Path=/; Max-Age=${DAYS * 86400}; HttpOnly; SameSite=Strict${secure ? '; Secure' : ''}`);
  res.json({ ok: true, name: ADMIN });
});
router.post('/logout', (req, res) => { res.setHeader('Set-Cookie', `${COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Strict`); res.json({ ok: true }); });
router.get('/me', (req, res) => res.json({ admin: isAdmin(req.headers.cookie), name: ADMIN, configured: !!PASSWORD() }));
router.get('/announce', (req, res) => res.json(announce));
// Présence : chaque page de jeu signale toutes les 20 s qui y joue (solo compris)
router.post('/presence', (req, res) => {
  const { id, game, pseudo, hidden } = req.body ?? {};
  if (typeof id === 'string' && id.length <= 40 && typeof game === 'string' && /^[a-z0-9-]{1,20}$/.test(game)) {
    const prev = presence.get(id), name = String(pseudo ?? '').trim().slice(0, 20);
    if (!prev && game !== 'accueil') event('presence', game, `${name || 'Quelqu’un'} arrive`);
    presence.set(id, { game, pseudo: name, at: Date.now(), since: prev?.game === game ? prev.since : Date.now(), hidden: !!hidden });
    const day = new Date().toISOString().slice(0, 10);
    if (day !== today) { today = day; seenToday.clear(); }
    if (!seenToday.has(game)) seenToday.set(game, new Set());
    seenToday.get(game).add(id);
    // messages en attente pour ce joueur (2 minutes au plus)
    const k = `${game}:${lower(name)}`, box = (inbox.get(k) ?? []).filter(m => Date.now() - m.at < 120000);
    inbox.delete(k);
    return res.json({ messages: box.map(m => m.text) });
  }
  res.status(204).end();
});

// ---------- Tout le reste : administrateur seulement ----------
router.use((req, res, next) => (isAdmin(req.headers.cookie) ? next() : res.status(403).json({ error: 'Réservé à l’administrateur' })));
router.get('/state', (req, res) => {
  const now = Date.now(), inRoom = new Set();
  const roomList = Object.fromEntries(Object.entries(rooms).map(([g, r]) => {
    const list = r.list();
    for (const x of list) for (const p of x.players) inRoom.add(`${g}:${lower(p.name)}`);
    return [g, list];
  }));
  res.json({
    now,
    presence: alive().map(p => ({ game: p.game, pseudo: p.pseudo, ago: Math.round((now - p.at) / 1000), since: p.since, hidden: p.hidden, multi: inRoom.has(`${p.game}:${lower(p.pseudo)}`) })),
    rooms: roomList,
    boards: Object.fromEntries(Object.entries(boards).map(([n, b]) => [n, { game: b.game, lists: Object.fromEntries(Object.entries(b.all()).map(([k, l]) => [k, l.map(e => ({ ...e, ...(b.inspect?.(k, e) ?? {}) }))])) }])),
    events, actions, bans, announce, history, days,
  });
});
router.post('/close', (req, res) => {
  const { game, code, message, reason } = req.body ?? {}, r = rooms[game];
  if (!r || !r.close(String(code ?? ''), message ? String(message).slice(0, 200) : null)) return res.status(404).json({ error: 'Salon introuvable' });
  logAction(`Salon ${code} fermé (${game})`, reason);
  res.json({ ok: true });
});
router.post('/kick', (req, res) => {
  const { game, code, name, reason } = req.body ?? {}, r = rooms[game];
  if (!r?.kick || !r.kick(String(code ?? ''), String(name ?? ''))) return res.status(404).json({ error: 'Joueur introuvable dans ce salon' });
  logAction(`${name} exclu du salon ${code} (${game})`, reason);
  res.json({ ok: true });
});
router.post('/say', (req, res) => {
  const { game, code, text } = req.body ?? {}, r = rooms[game], msg = String(text ?? '').trim().slice(0, 200);
  if (!msg) return res.status(400).json({ error: 'Message vide' });
  if (!r?.say || !r.say(String(code ?? ''), msg)) return res.status(404).json({ error: 'Salon introuvable' });
  logAction(`Message au salon ${code} (${game}) : « ${msg} »`);
  res.json({ ok: true });
});
router.post('/drop', async (req, res) => {
  const { board, key: k, name, reason } = req.body ?? {}, b = boards[board];
  if (!b) return res.status(404).json({ error: 'Classement inconnu' });
  const { entries, undo } = await b.drop(String(k ?? ''), String(name ?? ''));
  if (!entries.length) return res.status(404).json({ error: 'Temps introuvable' });
  const id = crypto.randomBytes(6).toString('hex');
  trash.set(id, { board, key: String(k), entries, undo, at: Date.now() });
  setTimeout(() => trash.delete(id), 20000).unref();
  logAction(`Temps de ${name} supprimé (${board}, ${k})`, reason);
  res.json({ ok: true, removed: entries.length, undo: id });
});
router.post('/undo', async (req, res) => {
  const t = trash.get(String(req.body?.id ?? ''));
  if (!t) return res.status(404).json({ error: 'Trop tard pour annuler' });
  trash.delete(req.body.id);
  await boards[t.board].restore(t.key, t.entries, t.undo);
  logAction(`Suppression annulée (${t.entries.map(e => e.name).join(', ')}, ${t.board}, ${t.key})`);
  res.json({ ok: true });
});
router.post('/ban', (req, res) => {
  const name = String(req.body?.name ?? '').trim().slice(0, 20);
  if (!name || lower(name) === lower(ADMIN)) return res.status(400).json({ error: 'Pseudo invalide' });
  if (!bans.some(b => lower(b.name) === lower(name))) bans.push({ name, reason: String(req.body.reason ?? '').slice(0, 140), at: Date.now() });
  store.save('admin-bans', bans);
  for (const r of Object.values(rooms)) for (const x of r.list()) if (x.players.some(p => lower(p.name) === lower(name))) r.kick?.(x.code, name);
  logAction(`${name} banni`, req.body.reason);
  res.json({ ok: true });
});
router.post('/unban', (req, res) => {
  const name = String(req.body?.name ?? '');
  bans = bans.filter(b => lower(b.name) !== lower(name));
  store.save('admin-bans', bans);
  logAction(`${name} débanni`);
  res.json({ ok: true });
});
router.post('/announce', (req, res) => {
  const text = String(req.body?.text ?? '').trim().slice(0, 200);
  announce = text ? { text, at: Date.now() } : null;
  store.save('admin-announce', announce);
  logAction(text ? `Annonce publiée : « ${text} »` : 'Annonce retirée');
  res.json({ ok: true, announce });
});

module.exports = { ADMIN, isAdmin, reserved, event, notify, rooms, boards, router };
