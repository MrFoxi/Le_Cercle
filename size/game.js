// Règles de Size It Up : choix des paires d'objets, score et verdict. Aucune notion de réseau : testé par test-size.js.
const OBJECTS = require('./objects');

const ROUNDS = 10;
const MIN_RATIO = 0.2, MAX_RATIO = 5; // l'objet rouge fait entre 1/5 et 5 fois la hauteur du bleu

// Paires possibles : deux objets différents, de tailles comparables, pas trop évidentes (au moins 15 % d'écart).
const PAIRS = OBJECTS.flatMap(ref => OBJECTS
  .filter(t => t !== ref && t.h / ref.h >= MIN_RATIO && t.h / ref.h <= MAX_RATIO && Math.abs(Math.log(t.h / ref.h)) > Math.log(1.15))
  .map(target => ({ ref, target })));

// Tire les paires d'une partie : jamais deux fois le même objet à estimer, ni la même référence d'affilée.
function pickRounds(rng = Math.random, n = ROUNDS) {
  const out = [], usedTargets = new Set();
  for (const p of [...PAIRS].sort(() => rng() - 0.5)) {
    if (out.length === n) break;
    if (usedTargets.has(p.target.id) || out.at(-1)?.ref === p.ref) continue;
    usedTargets.add(p.target.id);
    out.push(p);
  }
  return out;
}

// Score : 100 si l'estimation est juste (à 2 % près), 0 à partir d'un facteur 2 d'erreur, en échelle logarithmique
// (se tromper de 2× trop grand ou 2× trop petit coûte autant).
function score(estimate, truth) {
  const err = Math.abs(Math.log(estimate / truth));
  if (err <= Math.log(1.02)) return 100;
  return Math.max(0, Math.round(100 * (1 - err / Math.log(2))));
}

function verdict(points) {
  if (points >= 95) return 'Parfait !';
  if (points >= 80) return 'Très proche !';
  if (points >= 60) return 'Pas loin';
  if (points >= 30) return 'Bof…';
  return 'Loin du compte';
}

module.exports = { OBJECTS, PAIRS, ROUNDS, pickRounds, score, verdict };
