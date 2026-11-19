// LES EAUX DE MONET — l'ambiance sonore, fabriquée par le code : clapotis, vent dans les arbres, oiseaux selon l'heure, grillons la
// nuit, pluie, pas, moulinet, éclaboussures, et une musique très discrète qu'on peut couper (touche M).
let ctx, sortie, W, P, B, vent, eau, pluie, grillons, tic = 0, musiqueT = 0, oiseauT = 2, ok = false;
export const audio = { musique: true, volume: 0.8 };
try { audio.musique = localStorage.getItem('monet-musique') !== '0'; } catch { /* stockage bloqué */ }
const rnd = (a, b) => a + Math.random() * (b - a), now = () => ctx.currentTime + 0.02;
function bruit(k) { const b = ctx.createBuffer(1, ctx.sampleRate * 4, ctx.sampleRate), d = b.getChannelData(0); let l = 0, a = 0, c = 0; for (let i = 0; i < d.length; i++) { const w = Math.random() * 2 - 1; if (k === 'w') d[i] = w; else if (k === 'b') { l = (l + 0.02 * w) / 1.02; d[i] = l * 3.5; } else { a = 0.99 * a + w * 0.05; c = 0.9 * c + w * 0.1; d[i] = a + c + w * 0.08; } } return b; }
function nappe(buf, type, f, q) { const s = ctx.createBufferSource(), fl = ctx.createBiquadFilter(), g = ctx.createGain(); s.buffer = buf; s.loop = true; fl.type = type; fl.frequency.value = f; fl.Q.value = q; g.gain.value = 0; s.connect(fl); fl.connect(g); g.connect(sortie); s.start(); return { g, fl }; }
function env(g, t, a, d, v) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(v, 0.0002), t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); }
function ton(f, t, d, o = {}) { const { type = 'sine', v = 0.1, a = 0.01, to } = o, n = ctx.createOscillator(), g = ctx.createGain(); n.type = type; n.frequency.setValueAtTime(f, t); if (to) n.frequency.exponentialRampToValueAtTime(to, t + a + d); env(g, t, a, d, v); n.connect(g); g.connect(sortie); n.start(t); n.stop(t + a + d + 0.05); }
function souffle(t, d, o = {}) { const { buf = W, type = 'bandpass', f = 1000, q = 1, to, v = 0.1, a = 0.01 } = o, s = ctx.createBufferSource(), fl = ctx.createBiquadFilter(), g = ctx.createGain(); s.buffer = buf; s.loop = true; fl.type = type; fl.Q.value = q; fl.frequency.setValueAtTime(f, t); if (to) fl.frequency.exponentialRampToValueAtTime(to, t + a + d); env(g, t, a, d, v); s.connect(fl); fl.connect(g); g.connect(sortie); s.start(t, rnd(0, 3)); s.stop(t + a + d + 0.05); }
const oiseau = t => { const f = rnd(2300, 3600), n = 2 + Math.floor(rnd(0, 4)); for (let i = 0; i < n; i++) ton(f * rnd(0.9, 1.15), t + i * rnd(0.12, 0.2), 0.08, { to: f * rnd(1.1, 1.4), v: 0.018, a: 0.02 }); };

export const sons = {
  // le navigateur n'autorise le son qu'après un geste du joueur
  ouvrir() {
    if (ctx) { ctx.resume(); return; }
    try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { return; }
    sortie = ctx.createGain(); sortie.gain.value = audio.volume; const lim = ctx.createDynamicsCompressor(); sortie.connect(lim); lim.connect(ctx.destination);
    W = bruit('w'); P = bruit('p'); B = bruit('b'); vent = nappe(P, 'bandpass', 600, 0.5); eau = nappe(B, 'lowpass', 520, 0.4); pluie = nappe(W, 'highpass', 1800, 0.3); grillons = ctx.createGain(); grillons.gain.value = 0; grillons.connect(sortie); ok = true;
  },
  // l'ambiance suit le temps qu'il fait ; pres : à quel point on est près de l'eau (0 à 1)
  maj(dt, T, pres) {
    if (!ok) return; const t = ctx.currentTime, k = 0.5;
    vent.g.gain.setTargetAtTime(0.03 + T.vent * 0.1, t, k); vent.fl.frequency.setTargetAtTime(420 + Math.sin(t * 0.3) * 160 + T.vent * 420, t, k); eau.g.gain.setTargetAtTime((0.05 + Math.sin(t * 0.8) * 0.018) * (0.25 + pres * 0.9), t, 0.3); pluie.g.gain.setTargetAtTime(T.pluie * 0.075, t, k);
    const nuit = T.lumiere.nuit, jour = 1 - nuit; oiseauT -= dt;
    if (oiseauT <= 0) { oiseauT = rnd(2, 8) / (0.3 + jour); if (T.pluie < 0.4 && jour > 0.25) oiseau(now()); else if (nuit > 0.5) ton(rnd(380, 460), now(), 0.5, { v: 0.018, a: 0.15, to: 340 }); }
    if (nuit > 0.4 && (tic += dt) > 0.32 && T.pluie < 0.5) { tic = 0; const f = rnd(4100, 4500); for (let i = 0; i < 3; i++) ton(f, now() + i * 0.05, 0.03, { v: 0.009 * nuit, a: 0.005 }); }
    musiqueT -= dt;
    if (audio.musique && musiqueT <= 0) { musiqueT = rnd(14, 26); const n = now(), pal = [[62, 69, 74, 78], [59, 66, 71, 74], [57, 64, 69, 76], [64, 71, 76, 83]][Math.floor(rnd(0, 4))]; pal.forEach((m, i) => ton(440 * 2 ** ((m - 69) / 12), n + i * rnd(0.5, 0.9), 4.5, { type: 'triangle', v: 0.03, a: 0.05 })); }
  },
  pas(sur) { if (!ok) return; const t = now(); if (sur === 'pont') { souffle(t, 0.05, { f: 700, q: 2, v: 0.08 }); ton(170, t, 0.06, { to: 110, v: 0.07 }); } else if (sur === 'eau') souffle(t, 0.2, { buf: P, f: 900, to: 400, a: 0.03, v: 0.11 }); else souffle(t, 0.13, { buf: P, f: 1500, to: 700, q: 0.6, a: 0.03, v: 0.05 }); },
  lancer() { if (ok) souffle(now(), 0.4, { buf: P, f: 700, to: 2400, q: 0.8, a: 0.1, v: 0.12 }); },
  plouf(f = 1) { if (!ok) return; const t = now(); ton(280, t, 0.12, { to: 620, v: 0.1 * f, a: 0.006 }); souffle(t, 0.3, { f: 1400, to: 500, q: 0.7, v: 0.1 * f, a: 0.006 }); },
  saut() { if (!ok) return; const t = now(); souffle(t, 0.5, { f: 1100, to: 400, q: 0.5, v: 0.2, a: 0.01 }); ton(180, t, 0.2, { to: 90, v: 0.14 }); },
  moulinet(dt, vit) { if (!ok) return; tic += dt * vit * 26; if (tic > 1) { tic = 0; ton(rnd(1500, 1800), now(), 0.012, { type: 'square', v: 0.012, a: 0.002 }); } },
  tiree() { if (ok) souffle(now(), 0.1, { f: 900, to: 1800, q: 1, v: 0.05 }); },
  touche() { if (!ok) return; const t = now(); ton(90, t, 0.1, { to: 60, v: 0.2 }); souffle(t, 0.1, { f: 600, v: 0.08 }); },
  frein(k) { if (ok && Math.random() < k) ton(rnd(2100, 2600), now(), 0.018, { type: 'square', v: 0.016, a: 0.002 }); },
  casse() { if (ok) { const t = now(); ton(1900, t, 0.1, { to: 300, v: 0.09 }); souffle(t, 0.1, { f: 3000, v: 0.08 }); } },
  prise() { if (!ok) return; const t = now(); [74, 78, 81, 86].forEach((m, i) => ton(440 * 2 ** ((m - 69) / 12), t + i * 0.13, 1.5, { type: 'triangle', v: 0.05, a: 0.01 })); },
  page() { if (ok) souffle(now(), 0.26, { type: 'highpass', f: 1800, a: 0.08, v: 0.06 }); },
  photo() { if (!ok) return; const t = now(); souffle(t, 0.03, { f: 3000, v: 0.18 }); souffle(t + 0.13, 0.04, { f: 2200, v: 0.14 }); },
  grenouille() { if (!ok) return; const t = now(); for (let i = 0; i < 3; i++) ton(rnd(170, 210), t + i * 0.2, 0.13, { type: 'sawtooth', to: 130, v: 0.035, a: 0.02 }); },
  envol() { if (!ok) return; const t = now(); for (let i = 0; i < 12; i++) souffle(t + i * 0.09, 0.08, { buf: P, f: rnd(900, 1800), v: 0.05 }); },
  musique() { audio.musique = !audio.musique; try { localStorage.setItem('monet-musique', audio.musique ? '1' : '0'); } catch { /* stockage bloqué */ } return audio.musique; },
};
