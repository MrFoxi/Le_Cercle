// LES EAUX DE MONET — la bande originale : cinq pièces écrites pour l'étang, une par moment du jour et une pour la pluie.
// Une mesure par case, « note:durée » en temps, r pour un silence. Le jeu les arrange un peu différemment à chaque écoute.
import { alea } from './instruments.js';

export const MORCEAUX = [
  { id: 'matin', titre: 'La brume se lève', tempo: 58, mesure: 3, chant: 'flute', acc: 'harpe', motif: 'arpege', nappe: true, forme: ['a', 'A', 'B', 'A', 'fin'],
    A: { accords: ['D3 A3 E4 F#4 A4', 'D3 G#3 B3 E4 F#4', 'B2 F#3 A3 D4', 'G2 D3 A3 B3 F#4', 'D3 A3 E4 F#4 A4', 'F#2 C#3 A3 E4 G#4', 'E3 B3 D4 F#4 G#4', 'A2 E3 B3 D4 E4'],
      chant: ['A4:1 F#5:2', 'E5:1.5 G#5:.5 F#5:1', 'D5:2 C#5:1', 'B4:3', 'r:1 A4:.5 B4:.5 F#5:1', 'G#5:1.5 E5:1.5', 'F#5:1 E5:1 D5:1', 'E5:3'] },
    B: { accords: ['G2 D3 B3 D4 F#4', 'A2 E3 C#4 E4 G#4', 'F#2 C#3 A3 C#4 E4', 'B2 F#3 D4 E4 A4', 'G2 D3 A3 B3 E4', 'E2 B2 G#3 D4 F#4', 'A2 E3 G3 C#4 E4', 'D3 A3 C#4 E4 F#4'],
      chant: ['B5:1 A5:1 F#5:1', 'G#5:2 E5:1', 'C#5:1.5 E5:.5 A5:1', 'F#5:3', 'E5:1 F#5:1 A5:1', 'G#5:1.5 F#5:.5 D5:1', 'E5:1 C#5:1 A4:1', 'F#5:3'] } },
  { id: 'jour', titre: 'Les reflets de midi', tempo: 66, mesure: 4, chant: 'piano', acc: 'harpe', motif: 'vagues', nappe: true, forme: ['a', 'A', 'B', 'A', 'fin'],
    A: { accords: ['F2 C3 A3 E4 G4', 'D2 A2 F3 C4 E4', 'Bb2 F3 A3 D4 G4', 'C3 G3 Bb3 D4 F4', 'F2 C3 A3 E4 G4', 'A2 E3 G3 C4 E4', 'Bb2 F3 A3 C4 D4', 'C3 G3 A3 D4 E4'],
      chant: ['C5:1.5 A4:.5 G4:1 A4:1', 'E5:2 D5:1 C5:1', 'D5:1.5 F5:.5 G5:2', 'F5:1 D5:1 C5:2', 'C5:1.5 A4:.5 G4:1 C5:1', 'E5:1 G5:1 E5:2', 'F5:1 D5:1 C5:1 A4:1', 'G4:4'] },
    B: { accords: ['D2 A2 F3 A3 C4', 'G2 D3 F3 Bb3 D4', 'C3 G3 Bb3 E4', 'F2 C3 A3 C4 E4', 'Db3 Ab3 C4 F4', 'Bb2 F3 Ab3 Db4', 'G2 D3 F3 A3 C4', 'C3 G3 Bb3 D4 E4'],
      chant: ['A5:2 F5:1 E5:1', 'D5:2 Bb4:1 D5:1', 'E5:1.5 G5:.5 Bb5:2', 'A5:4', 'Ab5:2 F5:1 C5:1', 'Db5:1.5 F5:.5 Ab5:2', 'G5:1 F5:1 D5:1 C5:1', 'E5:4'] } },
  { id: 'soir', titre: 'L’heure dorée', tempo: 52, mesure: 3, chant: 'violoncelle', acc: 'piano', motif: 'balance', nappe: true, forme: ['a', 'A', 'B', 'A', 'fin'],
    A: { accords: ['Db2 Ab2 F3 C4 Eb4', 'Bb1 F2 Db3 Ab3 C4', 'Gb2 Db3 Bb3 F4', 'Ab2 Eb3 Bb3 C4 Eb4', 'F2 C3 Ab3 Eb4', 'Bb1 F2 Ab3 Db4', 'Eb2 Bb2 Gb3 Db4', 'Ab2 Eb3 Gb3 Bb3 C4'],
      chant: ['F4:2 Ab4:1', 'C5:2 Bb4:1', 'F4:3', 'Eb4:1 C4:1 Eb4:1', 'C5:1.5 Bb4:.5 Ab4:1', 'F4:2 Db4:1', 'Eb4:1 Gb4:1 Bb4:1', 'Ab4:3'] },
    B: { accords: ['Gb2 Db3 Bb3 Db4 F4', 'Eb2 Bb2 Gb3 Bb3 Db4', 'Db2 Ab2 F3 Ab3 C4', 'Bb1 F2 Db3 F3 Ab3', 'Gb2 Db3 Ab3 Bb3 Eb4', 'Ab2 Eb3 Gb3 C4 Eb4', 'Bb1 F2 Ab3 C4 Db4', 'Db2 Ab2 F3 C4 F4'],
      chant: ['Bb4:2 Db5:1', 'Eb5:1.5 Db5:.5 Bb4:1', 'C5:3', 'Ab4:1 Bb4:1 C5:1', 'Db5:2 Bb4:1', 'C5:1 Bb4:1 Ab4:1', 'F4:1 Ab4:1 C5:1', 'C5:3'] } },
  { id: 'nuit', titre: 'Sous les étoiles', tempo: 46, mesure: 4, chant: 'piano', acc: 'piano', motif: 'rares', nappe: true, forme: ['a', 'A', 'B', 'fin'],
    A: { accords: ['A2 E3 C4 G4', 'F2 C3 A3 E4', 'D3 A3 C4 F#4', 'E2 B2 G3 D4', 'A2 E3 C4 G4', 'C3 G3 B3 E4', 'F2 C3 G3 A3 E4', 'E2 B2 D4 F#4'],
      chant: ['E5:3 r:1', 'r:1 C5:1 A4:2', 'F#5:3 r:1', 'r:2 D5:1 B4:1', 'E5:2 G5:2', 'r:1 E5:1 B4:2', 'C5:2 A4:2', 'B4:4'] },
    B: { accords: ['F2 C3 A3 C4 G4', 'G2 D3 B3 E4', 'E2 B2 G3 D4', 'A2 E3 C4 E4', 'F2 C3 E4 A4', 'D3 A3 C4 E4', 'B2 F#3 D4 A4', 'E2 B2 E4 G4'],
      chant: ['G5:2 E5:2', 'r:1 D5:1 E5:2', 'B4:4', 'r:1 C5:1 E5:2', 'A5:3 r:1', 'r:1 E5:1 C5:2', 'D5:2 F#5:2', 'E5:4'] } },
  { id: 'pluie', titre: 'Pluie sur les nymphéas', tempo: 60, mesure: 3, chant: 'violoncelle', acc: 'harpe', motif: 'gouttes', nappe: false, forme: ['a', 'A', 'B', 'A', 'fin'],
    A: { accords: ['G2 D3 Bb3 F4', 'Eb2 Bb2 G3 D4 F4', 'C3 G3 Bb3 D4 E4', 'D3 A3 C4 F4', 'G2 D3 Bb3 F4', 'Bb2 F3 A3 C4 D4', 'Eb2 Bb2 G3 D4', 'D3 A3 C4 E4 F#4'],
      chant: ['D5:1 Bb4:1 A4:1', 'G4:2 Bb4:1', 'E5:2 D5:1', 'C5:3', 'D5:1 F5:1 A5:1', 'A5:1.5 F5:.5 D5:1', 'Bb4:1 A4:1 G4:1', 'F#4:3'] },
    B: { accords: ['Eb2 Bb2 G3 D4 G4', 'C3 G3 Bb3 D4 G4', 'F2 C3 A3 Eb4', 'Bb2 F3 A3 D4', 'G2 D3 Bb3 D4', 'A2 E3 G3 C#4', 'D3 A3 C4 F#4', 'G2 D3 Bb3 F4'],
      chant: ['G5:2 D5:1', 'D5:1 Bb4:1 G4:1', 'C5:2 Eb5:1', 'D5:3', 'Bb4:1 D5:1 G5:1', 'A4:1.5 G4:.5 E5:1', 'F#5:1 D5:1 A4:1', 'G4:3'] } },
];

const DEMI = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
export function midi(n) { const m = /^([A-G])(#|b)?(-?\d)$/.exec(n); if (!m) throw new Error('note illisible : ' + n); return 12 * (+m[3] + 1) + DEMI[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0); }
export const lireMesure = s => { let t = 0; return s.trim().split(/\s+/).map(x => { const [n, d] = x.split(':'), o = { note: n === 'r' ? null : midi(n), t, dur: +d }; t += +d; return o; }); };
export const lireAccord = s => s.trim().split(/\s+/).map(midi);
export const morceauDe = id => MORCEAUX.find(m => m.id === id);

// l'accompagnement d'une mesure : des notes (temps, durée en temps, force) tirées de l'accord
const MOTIFS = {
  arpege(n, M, r) { const o = [{ m: n[0], t: 0, d: M, v: 0.62 }]; const h = n.slice(1); let p = r() < 0.5 ? 0 : 1; for (let t = 0.5; t < M; t += 0.5) { o.push({ m: h[p % h.length], t, d: 1.5, v: 0.34 + r() * 0.14 }); p += r() < 0.8 ? 1 : 2; } return o; },
  vagues(n, M, r) { const o = [{ m: n[0], t: 0, d: M, v: 0.55 }, { m: n[1], t: 1, d: 2, v: 0.32 }]; const h = n.slice(2), up = r() < 0.6; h.forEach((m, i) => o.push({ m: m + 12, t: 2 + (up ? i : h.length - 1 - i) * 0.5, d: 2, v: 0.26 + r() * 0.1 })); return o; },
  balance(n, M, r) { const h = n.slice(1), o = [{ m: n[0], t: 0, d: M, v: 0.5 }]; for (let b = 1; b < M; b++) h.forEach((m, i) => o.push({ m, t: b + i * 0.025, d: 1, v: (b === 1 ? 0.26 : 0.19) + r() * 0.05 })); return o; },
  rares(n, M, r) { const o = [{ m: n[0], t: 0, d: M, v: 0.42 }]; n.slice(1).forEach((m, i) => o.push({ m, t: 1 + i * 0.32 + r() * 0.08, d: M - 1, v: 0.2 + r() * 0.06 })); return o; },
  gouttes(n, M, r) { const o = [{ m: n[0], t: 0, d: M, v: 0.44 }], h = n.slice(1); for (let t = 0.5; t < M; t += 0.5) if (r() < 0.62) o.push({ m: h[Math.floor(r() * h.length)] + 12 * (r() < 0.45 ? 2 : 1), t, d: 1.5, v: 0.2 + r() * 0.18 }); return o; },
};

// une interprétation : la liste de toutes les notes en secondes, jamais tout à fait la même
export function composer(P, graine = 1) {
  const r = alea(graine), b = 60 / P.tempo, notes = []; let t = 0;
  const ajoute = (inst, m, at, dur, v, pan) => notes.push({ inst, m, t: Math.max(0, at + (r() - 0.5) * 0.03), dur: Math.max(0.5, Math.round(dur * 4) / 4), v: v * (0.92 + r() * 0.16), pan });
  for (const pas of P.forme) {
    if (pas === 'fin') { lireAccord(P.A.accords[0]).forEach((m, i) => ajoute(P.acc, m, t + i * 0.22, 6, 0.42, -0.25 + i * 0.12)); t += 8; break; }
    const S = P[pas.toUpperCase()], chante = pas === pas.toUpperCase();
    S.accords.forEach((a, i) => {
      const n = lireAccord(a); for (const x of MOTIFS[P.motif](n, P.mesure, r)) ajoute(P.acc, x.m, t + x.t * b, x.d * b, x.v, ((x.m - 60) / 40) * 0.6);
      if (P.nappe) n.slice(1).forEach(m => ajoute('cordes', m, t, P.mesure * b * 1.1, 0.13, (m % 5 - 2) * 0.18));
      if (chante) for (const c of lireMesure(S.chant[i])) if (c.note !== null) ajoute(P.chant, c.note, t + c.t * b, c.dur * b * 1.04, 0.66, 0.08);
      t += P.mesure * b;
    });
  }
  return { duree: t, notes: notes.sort((x, y) => x.t - y.t) };
}
