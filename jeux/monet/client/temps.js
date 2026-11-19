// LES EAUX DE MONET — le temps qui passe : l'heure, le moment de la journée, la météo qui change lentement, la lumière.
import { TEMPS } from './reglages.js';

const couleur = h => [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255];
const mixe = (a, b, k) => a.map((v, i) => v + (b[i] - v) * k);
const CLES = TEMPS.lumieres.map(l => ({ ...l, soleil: couleur(l.soleil), ombre: couleur(l.ombre), horizon: couleur(l.horizon), zenith: couleur(l.zenith), brume: couleur(l.brume) }));
const GRIS = { horizon: couleur('#b9bcc0'), zenith: couleur('#8d95a2'), brume: couleur('#c3c6c6'), soleil: couleur('#d6d8d8'), ombre: couleur('#7d8796') };

export function momentDe(h) { const m = TEMPS.moments; let cur = m[0]; for (const x of m) if (x.de <= h) cur = x; return h < m[1].de ? m[0] : cur; }

export function creerTemps(hasard = Math.random, depart = {}) {
  const T = { heure: depart.heure ?? TEMPS.heureDepart, jour: 1, meteo: depart.meteo ?? 'soleil', suivante: null, fondu: 1, attente: 5, couvert: 0, pluie: 0, brume: 0, vent: 0.25, lumiere: null };
  const m0 = TEMPS.meteos[T.meteo]; Object.assign(T, { couvert: m0.couvert, pluie: m0.pluie, brume: m0.brume, vent: m0.vent });
  function tirer() {
    const noms = Object.keys(TEMPS.meteos).filter(n => n !== T.meteo), total = noms.reduce((s, n) => s + TEMPS.meteos[n].poids, 0); let x = hasard() * total;
    for (const n of noms) { x -= TEMPS.meteos[n].poids; if (x <= 0) return n; } return noms[0];
  }
  // changer de météo (fondu lent) ; sans argument, l'étang choisit
  T.changer = nom => { T.suivante = nom ?? tirer(); T.fondu = 0; };
  T.maj = dt => {
    const dh = (dt / TEMPS.dureeJour) * 24; T.heure += dh; if (T.heure >= 24) { T.heure -= 24; T.jour++; }
    T.attente -= dh; if (T.attente <= 0) { T.attente = TEMPS.dureeMeteo[0] + hasard() * (TEMPS.dureeMeteo[1] - TEMPS.dureeMeteo[0]); T.changer(); }
    const cible = TEMPS.meteos[T.suivante ?? T.meteo], k = Math.min(1, dt / (TEMPS.fondu * 0.35));
    for (const c of ['couvert', 'pluie', 'brume', 'vent']) T[c] += (cible[c] - T[c]) * k;
    if (T.suivante) { T.fondu += dt / TEMPS.fondu; if (T.fondu >= 1) { T.meteo = T.suivante; T.suivante = null; T.fondu = 1; } }
    T.lumiere = lumiere(T);
    return T;
  };
  T.lumiere = lumiere(T);
  return T;
}
// la lumière de l'instant : la clé horaire, grisée par les nuages, voilée par la brume
export function lumiere({ heure: h, couvert, brume }) {
  let i = 0; while (i < CLES.length - 2 && CLES[i + 1].h <= h) i++;
  const a = CLES[i], b = CLES[i + 1], k = (h - a.h) / (b.h - a.h), g = Math.min(1, couvert) * 0.75, mx = c => mixe(a[c], b[c], k), force = (a.force + (b.force - a.force) * k);
  const nuit = 1 - Math.max(0, Math.min(1, (force - 0.45) / 0.4)), voile = v => mixe(mx(v), GRIS[v].map(c => c * (0.42 + force * 0.58)), g);
  const ang = ((h - 6) / 12) * Math.PI, jour = h > 5 && h < 21;
  const dir = jour ? [Math.cos(ang) * 0.75, Math.max(0.1, Math.sin(ang)), -0.42] : [0.3, 0.8, 0.5], n = Math.hypot(...dir);
  return { soleil: voile('soleil'), ombre: voile('ombre'), horizon: voile('horizon'), zenith: voile('zenith'), brume: mixe(voile('brume'), GRIS.brume.map(c => c * (0.4 + force * 0.6)), brume * 0.5), force: force * (1 - g * 0.34), nuit, dir: dir.map(v => v / n), densite: 0.0016 + brume * 0.03 + couvert * 0.0012 };
}
