// LES EAUX DE MONET — ce qu'on entend : la nature en stéréo (eau, vent, pluie, oiseaux selon l'heure, grillons, grenouilles),
// les gestes du pêcheur et la bande originale. Tout passe par une même grande acoustique de plein air.
import { SR, boucleEau, boucleVent, bouclePluie, boucleGrillons, reponse } from './instruments.js';
import { MORCEAUX, morceauDe, composer } from './partition.js';
import { momentDe } from './temps.js';

export const audio = { musique: true, volume: 0.85, morceau: null };
try { audio.musique = localStorage.getItem('monet-musique') !== '0'; } catch { /* stockage bloqué */ }
const rnd = (a, b) => a + Math.random() * (b - a), choix = l => l[Math.floor(Math.random() * l.length)];
let ctx, sortie, nature, gestes, orchestre, salle, W, ok = false, eau, vent, pluie, grillons, oiseauT = 3, nuitT = 6, rouage = 0, frein = 0;
// la musique : du silence, une pièce préparée note par note sans à-coup, puis de nouveau le silence
const M = { attente: 9, etat: 'silence', notes: [], i: 0, t0: 0, duree: 0, file: [], tampons: new Map(), commandes: new Set(), luth: null, graine: 1 };

const tampon = canaux => { const b = ctx.createBuffer(canaux.length, canaux[0].length, SR); canaux.forEach((c, i) => b.copyToChannel(c, i)); return b; };
function boucle(canaux, sortieNoeud, filtre) { const s = ctx.createBufferSource(), g = ctx.createGain(); s.buffer = tampon(canaux); s.loop = true; g.gain.value = 0; let n = s; if (filtre) { const f = ctx.createBiquadFilter(); Object.assign(f, { type: filtre.type }); f.frequency.value = filtre.f; s.connect(f); n = f; g.filtre = f; } n.connect(g); g.connect(sortieNoeud); s.start(0, Math.random() * 5); return g; }
// un point dans l'espace : à gauche ou à droite, plus ou moins loin (donc plus ou moins dans l'écho)
function lieu(pan, loin, dest = nature) { const p = ctx.createStereoPanner(), g = ctx.createGain(), e = ctx.createGain(); p.pan.value = pan; g.gain.value = 1 - loin * 0.55; e.gain.value = 0.12 + loin * 0.75; p.connect(g); g.connect(dest); p.connect(e); e.connect(salle); return p; }
function env(g, t, a, d, v) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(v, 0.0002), t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); }
function ton(dest, t, f0, f1, d, v, o = {}) { const n = ctx.createOscillator(), g = ctx.createGain(), a = o.a ?? Math.min(0.02, d * 0.3); n.type = o.type ?? 'sine'; n.frequency.setValueAtTime(f0, t); n.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + d); env(g, t, a, d, v); n.connect(g); g.connect(dest); n.start(t); n.stop(t + a + d + 0.05); }
function souffle(dest, t, d, v, f0, f1 = f0, o = {}) { const s = ctx.createBufferSource(), fl = ctx.createBiquadFilter(), g = ctx.createGain(); s.buffer = W; s.loop = true; fl.type = o.type ?? 'bandpass'; fl.Q.value = o.q ?? 1; fl.frequency.setValueAtTime(f0, t); fl.frequency.exponentialRampToValueAtTime(f1, t + d); env(g, t, o.a ?? 0.008, d, v); s.connect(fl); fl.connect(g); g.connect(dest); s.start(t, rnd(0, 2)); s.stop(t + d + 0.1); }
// une phrase d'oiseau : [fréquence de départ, d'arrivée, durée, silence après, force]
function phrase(t, notes, pan, loin) { const d = lieu(pan, loin); let c = t; for (const [a, b, l, s, v = 1] of notes) { ton(d, c, a, b, l, 0.05 * v, { a: l * 0.25 }); c += l + s; } }
const OISEAUX = {
  // le merle : une mélodie flûtée, posée, qui finit en petit grincement
  merle: (t, p, l) => { const n = []; let f = rnd(1500, 2100); for (let i = 0, N = 4 + Math.floor(rnd(0, 4)); i < N; i++) { const g = f * choix([0.84, 0.89, 1, 1.12, 1.19, 1.33]); n.push([f, g, rnd(0.13, 0.32), rnd(0.02, 0.1), 1]); f = Math.min(2900, Math.max(1300, g)); } n.push([4200, 5600, 0.05, 0.02, 0.3], [5100, 3900, 0.07, 0, 0.25]); phrase(t, n, p, l); },
  // la mésange : deux notes qui se balancent
  mesange: (t, p, l) => { const h = rnd(4700, 5300), b = h * 0.74, n = []; for (let i = 0, N = 3 + Math.floor(rnd(0, 3)); i < N; i++) n.push([h, h * 0.97, 0.09, 0.03, 0.55], [b, b * 0.98, 0.14, 0.09, 0.6]); phrase(t, n, p, l); },
  // le pouillot : tchip, tchap, sans se presser
  pouillot: (t, p, l) => { const n = []; for (let i = 0, N = 6 + Math.floor(rnd(0, 6)); i < N; i++) { const f = choix([4300, 3500]) * rnd(0.98, 1.02); n.push([f * 1.12, f * 0.92, 0.09, rnd(0.24, 0.36), 0.5]); } phrase(t, n, p, l); },
  // la rousserolle : un bavardage rapide dans les roseaux
  rousserolle: (t, p, l) => { const n = []; for (let i = 0, N = 12 + Math.floor(rnd(0, 14)); i < N; i++) { const f = rnd(1800, 4600); n.push([f, f * rnd(0.7, 1.3), rnd(0.04, 0.09), rnd(0.01, 0.05), 0.42]); } phrase(t, n, p, l); },
  // le pigeon ramier : un roucoulement grave, dans les arbres
  ramier: (t, p, l) => { const n = []; for (let k = 0; k < 2; k++) n.push([440, 520, 0.28, 0.08, 0.7], [530, 470, 0.56, 0.1, 1], [470, 430, 0.26, 0.42, 0.75]); phrase(t, n, p, l); },
  // le coucou, très loin
  coucou: (t, p, l) => { const n = []; for (let k = 0; k < 3; k++) n.push([660, 650, 0.2, 0.1, 1], [525, 515, 0.34, 0.75, 1]); phrase(t, n, p, l); },
};
// la chouette hulotte : un long hou tremblé dans la nuit
const hulotte = (t, p) => phrase(t, [[720, 760, 0.7, 2.1, 1], [700, 760, 0.16, 0.14, 0.7], [760, 700, 1.1, 0, 1]], p, 0.85);

function note(n, t) { const b = M.tampons.get(cle(n)); if (!b) return; const s = ctx.createBufferSource(), g = ctx.createGain(), p = ctx.createStereoPanner(), e = ctx.createGain(); s.buffer = b; g.gain.value = n.v; p.pan.value = n.pan ?? 0; e.gain.value = 0.55; s.connect(g); g.connect(p); p.connect(orchestre); p.connect(e); e.connect(orchestre.echo); s.start(t); }
const cle = n => (n.inst === 'harpe' ? `harpe:${n.m}` : `${n.inst}:${n.m}:${n.dur}`);
const PRISE = [62, 69, 74, 78, 81, 86].map((m, i) => ({ inst: 'harpe', m, dur: 3, v: 0.62 - i * 0.04, pan: -0.3 + i * 0.12, i }));
function commander(n) { const k = cle(n); if (M.tampons.has(k) || M.commandes.has(k)) return; M.commandes.add(k); M.luth.postMessage({ k, inst: n.inst, m: n.m, dur: n.dur }); }
function majMusique(dt, T) {
  const now = ctx.currentTime;
  if (M.etat === 'silence' && (M.attente -= dt) <= 0) { const id = T.pluie > 0.5 ? 'pluie' : (morceauDe(momentDe(T.heure).id) ?? MORCEAUX[0]).id, c = composer(morceauDe(id), ++M.graine); Object.assign(M, { id, etat: 'prepare', notes: c.notes, duree: c.duree, i: 0, file: [...new Map(c.notes.map(n => [cle(n), n])).values()] }); M.file.forEach(commander); }
  if (M.etat === 'prepare') { if (M.file.every(n => M.tampons.has(cle(n)))) { M.etat = 'joue'; M.t0 = now + 0.5; audio.morceau = M.id; } }
  if (M.etat === 'joue') { while (M.i < M.notes.length && M.t0 + M.notes[M.i].t < now + 1.2) { const n = M.notes[M.i++]; note(n, Math.max(now + 0.02, M.t0 + n.t)); } if (now > M.t0 + M.duree) { M.etat = 'silence'; audio.morceau = null; M.attente = rnd(45, 100); if (M.tampons.size > 260) { M.tampons.clear(); PRISE.forEach(commander); } } } // shortcut: on vide tout le cache d'un coup, à revoir si une pièce devient plus longue
}

export const sons = {
  // le navigateur n'autorise le son qu'après un geste du joueur
  ouvrir() {
    if (ctx) { ctx.resume(); return; }
    try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { return; }
    sortie = ctx.createGain(); sortie.gain.value = audio.volume; const lim = ctx.createDynamicsCompressor(); lim.threshold.value = -14; lim.ratio.value = 3; lim.attack.value = 0.02; lim.release.value = 0.3; sortie.connect(lim); lim.connect(ctx.destination);
    salle = ctx.createConvolver(); const ir = reponse(ctx.sampleRate), bir = ctx.createBuffer(2, ir[0].length, ctx.sampleRate); ir.forEach((c, i) => bir.copyToChannel(c, i)); salle.buffer = bir; const retour = ctx.createGain(); retour.gain.value = 0.55; salle.connect(retour); retour.connect(sortie);
    nature = ctx.createGain(); nature.gain.value = 1.5; nature.connect(sortie); gestes = ctx.createGain(); gestes.gain.value = 0.85; gestes.connect(sortie);
    orchestre = ctx.createGain(); orchestre.gain.value = audio.musique ? 0.34 : 0; orchestre.connect(sortie); orchestre.echo = ctx.createGain(); orchestre.echo.gain.value = audio.musique ? 1 : 0; orchestre.echo.connect(salle);
    const n = ctx.createBuffer(1, SR * 3, SR), d = n.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; W = n;
    eau = boucle(boucleEau(), nature); vent = boucle(boucleVent(), nature, { type: 'lowpass', f: 1800 }); pluie = boucle(bouclePluie(), nature); grillons = boucle(boucleGrillons(), nature);
    M.luth = new Worker(new URL('./luth.js', import.meta.url), { type: 'module' }); M.luth.onmessage = ({ data }) => { M.commandes.delete(data.k); M.tampons.set(data.k, tampon([data.d])); }; PRISE.forEach(commander); ok = true;
  },
  // l'ambiance suit le temps qu'il fait ; pres : à quel point on est près de l'eau (0 à 1)
  maj(dt, T, pres) {
    if (!ok) return; const t = ctx.currentTime, nuit = T.lumiere.nuit, h = T.heure;
    eau.gain.setTargetAtTime(0.16 + pres * 0.34, t, 0.6); vent.gain.setTargetAtTime(0.1 + T.vent * 0.62, t, 1.2); vent.filtre.frequency.setTargetAtTime(900 + T.vent * 3800, t, 1.5); pluie.gain.setTargetAtTime(T.pluie * 0.62, t, 1.5); grillons.gain.setTargetAtTime(nuit > 0.4 && T.pluie < 0.5 ? 0.17 * nuit : 0, t, 3);
    // le chœur de l'aube, les oiseaux du jour, le merle du soir
    if ((oiseauT -= dt) <= 0) {
      const aube = h > 5 && h < 9.5, soir = h > 17.5 && h < 21.5, gene = T.pluie > 0.4 || nuit > 0.6; oiseauT = gene ? rnd(14, 30) : aube ? rnd(1.5, 5) : soir ? rnd(5, 12) : rnd(6, 15);
      if (!gene) OISEAUX[choix(aube ? ['merle', 'mesange', 'pouillot', 'rousserolle', 'coucou', 'merle'] : soir ? ['merle', 'merle', 'ramier', 'rousserolle'] : ['pouillot', 'mesange', 'ramier', 'rousserolle', 'merle'])](ctx.currentTime + 0.05, rnd(-0.85, 0.85), rnd(0.35, 0.95));
    }
    if (nuit > 0.55 && T.pluie < 0.5 && (nuitT -= dt) <= 0) { nuitT = rnd(14, 32); if (Math.random() < 0.45) hulotte(ctx.currentTime + 0.05, rnd(-0.8, 0.8)); else sons.grenouille(rnd(-0.7, 0.7), 0.75); }
    majMusique(dt, T);
  },
  pas(sur) {
    if (!ok) return; const t = ctx.currentTime + 0.01, d = lieu(rnd(-0.08, 0.08), 0.05, gestes);
    if (sur === 'pont') { const f = rnd(0.94, 1.06); ton(d, t, 165 * f, 120 * f, 0.09, 0.16, { a: 0.003 }); ton(d, t, 395 * f, 330 * f, 0.05, 0.05, { a: 0.002 }); souffle(d, t, 0.03, 0.06, 1400, 800, { q: 2 }); if (Math.random() < 0.15) ton(d, t + 0.07, rnd(620, 820), rnd(480, 600), 0.14, 0.012, { type: 'sawtooth', a: 0.05 }); }
    else if (sur === 'eau') { souffle(d, t, 0.26, 0.11, 1000, 320, { a: 0.04, q: 0.7 }); for (let i = 0; i < 3; i++) { const b = t + rnd(0.04, 0.2), f = rnd(380, 900); ton(d, b, f, f * 1.5, 0.05, 0.035, { a: 0.006 }); } }
    else { souffle(d, t, 0.15, 0.07, rnd(2200, 3200), 1300, { q: 0.5, a: 0.025 }); souffle(d, t + 0.05, 0.1, 0.035, rnd(4200, 5400), 3000, { q: 0.8, a: 0.02 }); ton(d, t, 95, 62, 0.07, 0.07, { a: 0.006 }); }
  },
  lancer() { if (!ok) return; const t = ctx.currentTime + 0.01, d = lieu(0.15, 0.2, gestes); souffle(d, t, 0.34, 0.15, 500, 2300, { q: 1.2, a: 0.12 }); ton(d, t + 0.12, 2100, 780, 0.6, 0.012, { a: 0.06 }); },
  plouf(f = 1) { if (!ok) return; const t = ctx.currentTime + 0.01, d = lieu(rnd(-0.25, 0.25), 0.55); souffle(d, t, 0.34, 0.15 * f, 1500, 380, { q: 0.6, a: 0.004 }); ton(d, t, 190, 420, 0.13, 0.13 * f, { a: 0.004 }); for (let i = 0, N = 5 + Math.floor(f * 4); i < N; i++) { const b = t + rnd(0.05, 0.42), h = rnd(420, 1500); ton(d, b, h, h * 1.6, rnd(0.03, 0.08), 0.05 * f, { a: 0.005 }); } },
  saut() { if (!ok) return; sons.plouf(1.5); const t = ctx.currentTime + 0.01, d = lieu(rnd(-0.3, 0.3), 0.5); souffle(d, t + 0.02, 0.5, 0.1, 2400, 700, { q: 0.5, a: 0.02 }); },
  // le moulinet de bois : un cliquet doux, plus serré quand on mouline vite
  moulinet(dt, vit) { if (!ok) return; rouage += dt * vit * 15; if (rouage > 1) { rouage = 0; const t = ctx.currentTime + 0.005, d = lieu(0.25, 0.02, gestes), f = rnd(0.96, 1.04); ton(d, t, 1250 * f, 900 * f, 0.016, 0.05, { a: 0.001 }); souffle(d, t, 0.012, 0.04, 2800 * f, 2200, { q: 3, a: 0.001 }); ton(d, t, 240, 190, 0.03, 0.03, { a: 0.002 }); } },
  tiree() { if (!ok) return; const t = ctx.currentTime + 0.01, d = lieu(0.15, 0.15, gestes); souffle(d, t, 0.12, 0.09, 900, 2100, { q: 1.4, a: 0.02 }); },
  touche() { if (!ok) return; const t = ctx.currentTime + 0.01, d = lieu(0.15, 0.1, gestes); ton(d, t, 150, 92, 0.3, 0.2, { a: 0.003 }); ton(d, t, 460, 280, 0.16, 0.05, { a: 0.002 }); souffle(d, t, 0.05, 0.08, 1700, 900, { q: 2 }); },
  // le frein : la ligne qui file, un crépitement rapide
  frein(k) { if (!ok) return; frein += k; if (frein > 0.5) { frein = 0; const t = ctx.currentTime + 0.005, d = lieu(0.25, 0.04, gestes); ton(d, t, rnd(2500, 2900), 2000, 0.012, 0.045, { a: 0.001 }); souffle(d, t, 0.012, 0.035, 5200, 4200, { q: 4, a: 0.001 }); } },
  casse() { if (!ok) return; const t = ctx.currentTime + 0.01, d = lieu(0.1, 0.3, gestes); souffle(d, t, 0.03, 0.26, 3800, 2400, { q: 2, a: 0.001 }); ton(d, t, 1800, 240, 0.22, 0.07, { a: 0.002 }); },
  // la prise : quelques notes de harpe qui montent, comme une page qu'on tourne
  prise() { if (!ok) return; const t = ctx.currentTime + 0.05; PRISE.forEach(n => { const b = M.tampons.get(cle(n)); if (!b) return; const s = ctx.createBufferSource(), g = ctx.createGain(), p = ctx.createStereoPanner(), e = ctx.createGain(); s.buffer = b; g.gain.value = n.v * 0.6; p.pan.value = n.pan; e.gain.value = 0.5; s.connect(g); g.connect(p); p.connect(gestes); p.connect(e); e.connect(salle); s.start(t + n.i * 0.13); }); },
  page() { if (!ok) return; const t = ctx.currentTime + 0.01, d = lieu(-0.1, 0.05, gestes); souffle(d, t, 0.2, 0.07, 3200, 5600, { type: 'highpass', a: 0.07 }); souffle(d, t + 0.13, 0.08, 0.05, 1300, 700, { q: 0.7 }); },
  // l'appareil à soufflet : le déclic du volet, puis le levier qu'on réarme
  photo() { if (!ok) return; const t = ctx.currentTime + 0.01, d = lieu(0, 0.05, gestes); souffle(d, t, 0.02, 0.2, 2600, 1900, { q: 3, a: 0.001 }); ton(d, t, 340, 220, 0.04, 0.09, { a: 0.002 }); souffle(d, t + 0.14, 0.03, 0.14, 1700, 1200, { q: 3, a: 0.001 }); souffle(d, t + 0.42, 0.13, 0.05, 900, 1600, { q: 2, a: 0.03 }); },
  // une grenouille : un coassement fait de petites pulsations
  grenouille(pan = rnd(-0.5, 0.5), loin = 0.45) { if (!ok) return; const t = ctx.currentTime + 0.02, d = lieu(pan, loin), f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = rnd(720, 1000); f.Q.value = 2.2; f.connect(d); for (let k = 0, N = 2 + Math.floor(rnd(0, 3)); k < N; k++) for (let i = 0; i < 9; i++) ton(f, t + k * 0.42 + i * 0.03, rnd(92, 104), 82, 0.022, 0.28, { type: 'sawtooth', a: 0.003 }); },
  // un envol : des battements d'ailes qui s'éloignent
  envol() { if (!ok) return; const t = ctx.currentTime + 0.01, p = rnd(-0.6, 0.6); for (let i = 0; i < 14; i++) souffle(lieu(p + i * 0.03, 0.35 + i * 0.03), t + i * 0.085, 0.06, 0.09 * (1 - i / 16), rnd(650, 1050), 420, { q: 0.7, a: 0.012 }); },
  // la brosse sur la toile
  pinceau() { if (!ok) return; const t = ctx.currentTime + 0.01, d = lieu(rnd(-0.2, 0.2), 0.05, gestes); souffle(d, t, rnd(0.12, 0.26), 0.035, rnd(1800, 2600), rnd(900, 1300), { q: 0.8, a: 0.04 }); },
  musique() {
    audio.musique = !audio.musique; try { localStorage.setItem('monet-musique', audio.musique ? '1' : '0'); } catch { /* stockage bloqué */ }
    if (ok) { const t = ctx.currentTime; orchestre.gain.setTargetAtTime(audio.musique ? 0.34 : 0, t, 0.5); orchestre.echo.gain.setTargetAtTime(audio.musique ? 1 : 0, t, 0.5); }
    return audio.musique;
  },
};
