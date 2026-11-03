// API de Size It Up : la vraie taille reste sur le serveur et n'est envoyée qu'après la validation de l'estimation.
const crypto = require('crypto');
const express = require('express');
const { pickRounds, score, verdict, ROUNDS } = require('./game');

const GAME_TTL_MS = 2 * 60 * 60 * 1000; // une partie oubliée est effacée au bout de 2 h
const games = new Map(); // id -> { rounds: [{ ref, target, answered }], created }

const router = express.Router();
router.use(express.json({ limit: '2kb' }));

// Ce que le navigateur peut savoir d'un objet : son nom et ses proportions, pas sa taille.
const shape = o => ({ id: o.id, name: o.name, emoji: o.emoji, aspect: o.w / o.h });

router.post('/games', (req, res) => {
  const now = Date.now();
  for (const [id, g] of games) if (now - g.created > GAME_TTL_MS) games.delete(id);
  const id = crypto.randomBytes(12).toString('hex');
  const rounds = pickRounds().map(p => ({ ...p, answered: false }));
  games.set(id, { rounds, created: now });
  res.json({ id, rounds: rounds.map(r => ({ ref: shape(r.ref), target: shape(r.target) })), total: ROUNDS });
});

// L'estimation est la hauteur de l'objet rouge, exprimée en hauteurs de l'objet bleu.
router.post('/games/:id/rounds/:n', (req, res) => {
  const g = games.get(req.params.id), r = g?.rounds[Number(req.params.n)];
  const estimate = Number(req.body?.estimate);
  if (!r) return res.status(404).json({ error: 'Partie introuvable' });
  if (r.answered) return res.status(409).json({ error: 'Manche déjà validée' });
  if (!Number.isFinite(estimate) || estimate <= 0 || estimate > 1000) return res.status(400).json({ error: 'Estimation invalide' });
  r.answered = true;
  const truth = r.target.h / r.ref.h, points = score(estimate, truth);
  res.json({ truth, points, verdict: verdict(points), ref: { name: r.ref.name, h: r.ref.h }, target: { name: r.target.name, h: r.target.h } });
});

module.exports = router;
