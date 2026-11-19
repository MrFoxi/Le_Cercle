// LES EAUX DE MONET — la lutherie : chaque instrument et chaque nappe de la nature sont calculés ici, échantillon par échantillon.
// Aucun fichier son, aucune banque : du calcul pur, sans navigateur (les tests l'écoutent aussi).
export const SR = 22050;
export const hertz = m => 440 * 2 ** ((m - 69) / 12);
export const alea = g => () => { g = (g + 0x6d2b79f5) | 0; let t = Math.imul(g ^ (g >>> 15), 1 | g); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const TAU = Math.PI * 2;
function normer(d, v = 0.85) { let m = 0; for (let i = 0; i < d.length; i++) m = Math.max(m, Math.abs(d[i])); if (m > 0) for (let i = 0; i < d.length; i++) d[i] *= v / m; return d; }
// un partiel qui s'éteint : un oscillateur par rotation, bien plus rapide que des sinus
function partiel(d, f, a, tau, debut = 0) {
  const w = TAU * f / SR, c = Math.cos(w), s = Math.sin(w), k = Math.exp(-1 / (tau * SR)); let x = Math.sin(debut), y = Math.cos(debut), g = a;
  for (let i = 0; i < d.length; i++) { d[i] += x * g; const n = x * c + y * s; y = y * c - x * s; x = n; g *= k; }
}
function enveloppe(d, attaque, fin, relache) {
  const A = Math.max(1, attaque * SR), R = Math.max(1, relache * SR), F = Math.floor(fin * SR);
  for (let i = 0; i < d.length; i++) { let e = Math.min(1, i / A); e *= e * (3 - 2 * e); if (i > F) { const k = Math.min(1, (i - F) / R); e *= (1 - k) * (1 - k); } d[i] *= e; }
}

// le piano feutré : des cordes doubles légèrement désaccordées, un marteau tendre, des aigus qui s'éteignent vite
function piano(m, dur) {
  const f = hertz(m), d = new Float32Array(Math.floor(Math.min(dur + 2.2, 7) * SR)), base = Math.max(0.9, 4.4 - (m - 36) * 0.05), B = 0.00035, r = alea(m * 31);
  for (let n = 1; n <= 10; n++) { const fn = n * f * Math.sqrt(1 + B * n * n); if (fn > SR * 0.42) break; const a = n ** -1.75, tau = Math.max(0.16, base / (1 + 0.55 * (n - 1))); partiel(d, fn * 0.9996, a, tau, n); partiel(d, fn * 1.0004, a * 0.8, tau * 1.25, n * 2); }
  let l = 0; const coup = Math.floor(0.02 * SR); for (let i = 0; i < coup; i++) { l += ((r() * 2 - 1) - l) * 0.16; d[i] += l * 0.5 * (1 - i / coup); }
  enveloppe(d, 0.007, Math.min(dur + 1.2, 5.5), 1.1); return normer(d);
}
// la harpe : une corde pincée au tiers, qui sonne longtemps
function harpe(m) {
  const f = hertz(m), d = new Float32Array(Math.floor(4.5 * SR)), base = Math.max(1.1, 3.4 - (m - 40) * 0.035);
  for (let n = 1; n <= 12; n++) { if (n * f > SR * 0.42) break; partiel(d, n * f * (1 + 0.00012 * n * n), Math.abs(Math.sin(Math.PI * n * 0.29)) / n ** 1.55, Math.max(0.1, base / (1 + 0.42 * (n - 1))), n); }
  enveloppe(d, 0.003, 3.7, 0.75); return normer(d);
}
// les instruments tenus : un souffle ou un archet, avec un vibrato qui arrive après l'attaque
function tenu(m, dur, { harm, attaque, relache, vib, vitesse, voix = 1, ecart = 0, souffle = 0, graine = 1 }) {
  const f = hertz(m), L = Math.floor((dur + relache) * SR), d = new Float32Array(L), r = alea(m * 17 + graine);
  for (let v = 0; v < voix; v++) {
    let ph = r() * TAU, lfo = r() * TAU; const ff = f * (1 + (v - (voix - 1) / 2) * ecart), dl = TAU * vitesse / SR, retard = Math.max(1, 0.7 * SR);
    for (let i = 0; i < L; i++) { lfo += dl; ph += TAU * ff * (1 + vib * Math.min(1, i / retard) * Math.sin(lfo)) / SR; const s = Math.sin(ph), c = 2 * Math.cos(ph); let a = 0, b = s, o = 0; for (let n = 0; n < harm.length; n++) { o += b * harm[n]; const e = c * b - a; a = b; b = e; } d[i] += o; }
  }
  if (souffle) { let h = 0, p = 0; for (let i = 0; i < L; i++) { const w = r() * 2 - 1; h = w - p; p = w; d[i] += h * souffle * (0.7 + 0.3 * Math.sin(i * 0.0007)); } }
  enveloppe(d, attaque, dur, relache); return normer(d);
}
const TIMBRES = {
  flute: d => ({ harm: [1, 0.3, 0.14, 0.04], attaque: 0.11, relache: 0.32, vib: 0.0042, vitesse: 4.7, souffle: 0.1 }),
  violoncelle: d => ({ harm: [1, 0.62, 0.46, 0.33, 0.2, 0.14, 0.09, 0.05], attaque: 0.24, relache: 0.7, vib: 0.0048, vitesse: 5.1, voix: 2, ecart: 0.0011, souffle: 0.02 }),
  cordes: d => ({ harm: [1, 0.42, 0.22, 0.12, 0.06], attaque: Math.min(1.3, d * 0.4), relache: 1.5, vib: 0.0016, vitesse: 4.2, voix: 3, ecart: 0.0016 }),
};
// jouer une note : instrument, hauteur MIDI, durée en secondes
export function rendre(inst, m, dur) { if (inst === 'piano') return piano(m, dur); if (inst === 'harpe') return harpe(m); return tenu(m, dur, TIMBRES[inst](dur)); }
export const INSTRUMENTS = ['piano', 'harpe', ...Object.keys(TIMBRES)];

/* ---------- Les nappes de la nature : des boucles stéréo sans couture ---------- */
function stereo(duree, remplir) {
  const n = Math.floor(duree * SR), f = Math.floor(1.5 * SR), L = new Float32Array(n + f), R = new Float32Array(n + f); remplir(L, R, n + f);
  for (const c of [L, R]) { for (let i = 0; i < f; i++) { const k = i / f; c[i] = c[i] * Math.sqrt(k) + c[n + i] * Math.sqrt(1 - k); } normer(c, 0.8); }
  return [L.subarray(0, n), R.subarray(0, n)];
}
// une petite bulle : la note de l'eau, qui monte en s'éteignant
function bulle(c, debut, f, duree, a) { const n = Math.floor(duree * SR); let ph = 0; for (let i = 0; i < n && debut + i < c.length; i++) { const k = i / n; ph += TAU * f * (1 + k * 0.55) / SR; c[debut + i] += Math.sin(ph) * a * Math.min(1, i / 30) * (1 - k) * (1 - k); } }
export function boucleEau(g = 11) {
  const r = alea(g);
  return stereo(24, (L, R, n) => {
    let a = 0, b = 0; for (let i = 0; i < n; i++) { const h = 0.5 + 0.5 * Math.sin(i / SR * 0.9) * Math.sin(i / SR * 0.37 + 1); a += (r() * 2 - 1 - a) * 0.018; b += (r() * 2 - 1 - b) * 0.018; L[i] = a * (0.5 + h); R[i] = b * (1.1 - h * 0.6); }
    // le clapotis : des bulles par petites grappes, contre la berge
    for (let t = 0; t < n / SR;) { t += 0.25 + r() * 1.4; const nb = 2 + Math.floor(r() * 7), p = r(); for (let k = 0; k < nb; k++) { const d = Math.floor((t + k * (0.03 + r() * 0.09)) * SR), f = 340 + r() * r() * 1500, v = 0.07 + r() * 0.13; bulle(L, d, f, 0.03 + r() * 0.07, v * (1 - p)); bulle(R, d, f, 0.03 + r() * 0.07, v * p); } }
  });
}
export function boucleVent(g = 23) {
  const r = alea(g);
  return stereo(30, (L, R, n) => {
    const passe = (c, ph) => { let lp = 0, bp = 0, fr = 0; for (let i = 0; i < n; i++) { const t = i / SR, souffle = 0.45 + 0.3 * Math.sin(t * 0.42 + ph) + 0.25 * Math.sin(t * 1.13 + ph * 2); const w = r() * 2 - 1, F = 0.05 + 0.05 * souffle; lp += F * bp; const hp = w - lp - 0.8 * bp; bp += F * hp; fr += (w - fr) * 0.55; const bruisse = (w - fr) * Math.max(0, souffle - 0.42) ** 1.4 * (0.6 + 0.4 * Math.sin(t * 37 + ph * 5) * Math.sin(t * 13.3)); c[i] = bp * souffle * 0.34 + bruisse * 0.5; } };
    passe(L, 0.3); passe(R, 2.1);
  });
}
export function bouclePluie(g = 37) {
  const r = alea(g);
  return stereo(16, (L, R, n) => {
    let a = 0, b = 0; for (let i = 0; i < n; i++) { const u = r() * 2 - 1, v = r() * 2 - 1; a += (u - a) * 0.5; b += (v - b) * 0.5; L[i] = (u - a) * 0.16; R[i] = (v - b) * 0.16; }
    // des milliers de gouttes, chacune sa petite note sur l'eau
    for (let k = 0; k < 2600; k++) { const d = Math.floor(r() * (n - 900)), f = 900 + r() * 3200, p = r(), v = 0.05 + r() * r() * 0.26; bulle(L, d, f, 0.012 + r() * 0.03, v * (1 - p)); bulle(R, d, f, 0.012 + r() * 0.03, v * p); }
  });
}
export function boucleGrillons(g = 51) {
  const r = alea(g);
  return stereo(10, (L, R, n) => {
    for (let c = 0; c < 5; c++) { const f = 3700 + r() * 1100, p = r(), per = 0.5 + r() * 0.45, v = 0.14 + r() * 0.14; for (let t = r() * per; t < n / SR - 0.2; t += per) for (let k = 0; k < 3; k++) { const d = Math.floor((t + k * 0.045) * SR), N = Math.floor(0.03 * SR); let ph = 0; for (let i = 0; i < N && d + i < n; i++) { ph += TAU * f / SR; const s = Math.sin(ph) * v * Math.sin(Math.PI * i / N) ** 2; L[d + i] += s * (1 - p); R[d + i] += s * p; } } }
  });
}
// la grande salle de plein air : un écho très doux, qui s'assombrit en s'éteignant
export function reponse(sr, duree = 3.4, g = 71) {
  const r = alea(g), n = Math.floor(duree * sr), out = [new Float32Array(n), new Float32Array(n)];
  for (const c of out) { let l = 0; for (let i = 0; i < n; i++) { const t = i / n, k = 0.5 * (1 - t) ** 2 + 0.03; l += ((r() * 2 - 1) - l) * k; c[i] = l * (1 - t) ** 2.6 * Math.min(1, i / (0.012 * sr)); } normer(c, 0.5); }
  return out;
}
