// Administration du Cercle : le pseudo « MrFoxi » est réservé à l'administrateur.
// Le mot de passe vient de la variable d'environnement ADMIN_PASSWORD (jamais dans le code) ; sans elle, personne ne peut
// prendre ce pseudo. Une fois connecté sur /admin.html, le navigateur garde un cookie signé que tous les jeux reconnaissent.
// Les salons (lib/rooms.js, le 7,5) et les classements (lib/leaderboard.js) s'inscrivent ici pour être gérés depuis la page.
const crypto = require('crypto');
const express = require('express');

const ADMIN = 'MrFoxi';
const COOKIE = 'cercle_admin';
const DAYS = 30;
const PASSWORD = () => process.env.ADMIN_PASSWORD || '';
const key = () => crypto.createHash('sha256').update(`cercle-admin:${PASSWORD()}`).digest(); // changer le mot de passe déconnecte tout le monde
const sign = exp => crypto.createHmac('sha256', key()).update(`${ADMIN}:${exp}`).digest('hex');
const same = (a, b) => a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));

// Le cookie de la requête (ou de la connexion Socket.io) est-il celui de l'administrateur ?
function isAdmin(cookieHeader) {
  if (!PASSWORD()) return false;
  const raw = String(cookieHeader ?? '').split(/;\s*/).find(c => c.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1);
  const [exp, sig] = decodeURIComponent(raw ?? '').split('.');
  return Number(exp) > Date.now() && !!sig && same(sig, sign(exp));
}
// Message d'erreur si ce pseudo est réservé et que la personne n'est pas l'administrateur, sinon null.
const reserved = (name, cookieHeader) => (String(name ?? '').trim().toLowerCase() === ADMIN.toLowerCase() && !isAdmin(cookieHeader) ? 'Ce pseudo est réservé' : null);

// Ce que la page d'administration peut voir et faire
const rooms = {};    // jeu -> { list(), close(code) }
const boards = {};   // nom du classement -> { game, all(), drop(clé, pseudo) }
const presence = new Map(); // id d'onglet -> { game, pseudo, at }
const PRESENCE_MS = 60 * 1000;

const router = express.Router();
router.use(express.json({ limit: '2kb' }));
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
router.get('/me', (req, res) => res.json({ admin: isAdmin(req.headers.cookie), name: ADMIN }));
// Présence : chaque page de jeu signale toutes les 20 s qui y joue (solo compris)
router.post('/presence', (req, res) => {
  const { id, game, pseudo } = req.body ?? {};
  if (typeof id === 'string' && id.length <= 40 && typeof game === 'string' && /^[a-z0-9-]{1,20}$/.test(game)) {
    presence.set(id, { game, pseudo: String(pseudo ?? '').trim().slice(0, 20), at: Date.now() });
  }
  res.status(204).end();
});
// Tout le reste : administrateur seulement
router.use((req, res, next) => (isAdmin(req.headers.cookie) ? next() : res.status(403).json({ error: 'Réservé à l’administrateur' })));
router.get('/state', (req, res) => {
  const now = Date.now();
  for (const [id, p] of presence) if (now - p.at > PRESENCE_MS) presence.delete(id);
  res.json({
    presence: [...presence.values()].map(p => ({ game: p.game, pseudo: p.pseudo, ago: Math.round((now - p.at) / 1000) })),
    rooms: Object.fromEntries(Object.entries(rooms).map(([g, r]) => [g, r.list()])),
    boards: Object.fromEntries(Object.entries(boards).map(([n, b]) => [n, { game: b.game, lists: b.all() }])),
  });
});
router.post('/close', (req, res) => {
  const r = rooms[req.body?.game];
  if (!r || !r.close(String(req.body.code ?? ''))) return res.status(404).json({ error: 'Salon introuvable' });
  res.json({ ok: true });
});
router.post('/drop', async (req, res) => {
  const b = boards[req.body?.board];
  if (!b) return res.status(404).json({ error: 'Classement inconnu' });
  const n = await b.drop(String(req.body.key ?? ''), String(req.body.name ?? ''));
  res.json({ ok: true, removed: n });
});

module.exports = { ADMIN, isAdmin, reserved, rooms, boards, router };
