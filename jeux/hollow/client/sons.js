// THE HOLLOW — les sons : tout est fabriqué par le code (oscillateurs, bruits, réverbération), sans aucun fichier audio.
// Chaque strate a son ambiance ; le thème du manteau (cinq notes) revient de strate en strate ; le jeu appelle sons.play(…).
/* ---------- Le moteur : oscillateurs, bruits, réverbération ---------- */
let ctx, master, bus, busWet, rev, W, P, B, vol = 0.75;
const hz = m => 440 * 2 ** ((m - 69) / 12), rnd = (a, b) => a + Math.random() * (b - a), pick = a => a[Math.floor(Math.random() * a.length)];
const t0 = () => ctx.currentTime + 0.04;
function makeBus() { bus = ctx.createGain(); busWet = ctx.createGain(); bus.connect(master); busWet.connect(rev); }
function noiseBuf(kind) {
  const b = ctx.createBuffer(1, ctx.sampleRate * 4, ctx.sampleRate), d = b.getChannelData(0); let l = 0, p = [0, 0, 0];
  for (let i = 0; i < d.length; i++) {
    const w = Math.random() * 2 - 1;
    if (kind === 'w') d[i] = w;
    else if (kind === 'b') { l = (l + 0.02 * w) / 1.02; d[i] = l * 3.5; }
    else { p[0] = 0.997 * p[0] + w * 0.03; p[1] = 0.96 * p[1] + w * 0.15; p[2] = 0.6 * p[2] + w * 0.4; d[i] = (p[0] + p[1] + p[2] + w * 0.1) * 0.4; }
  }
  return b;
}
function boot() {
  if (ctx) { ctx.resume(); return; }
  ctx = new (window.AudioContext || window.webkitAudioContext)();
  master = ctx.createGain(); master.gain.value = vol;
  const lim = ctx.createDynamicsCompressor(); lim.threshold.value = -10; lim.ratio.value = 12; lim.attack.value = 0.003; lim.release.value = 0.2;
  master.connect(lim); lim.connect(ctx.destination);
  rev = ctx.createConvolver();
  const ir = ctx.createBuffer(2, ctx.sampleRate * 3.2, ctx.sampleRate);
  for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length) ** 2.6; }
  rev.buffer = ir; rev.connect(master);
  W = noiseBuf('w'); P = noiseBuf('p'); B = noiseBuf('b'); makeBus();
}
function route(n, out, wet) { n.connect(out || bus); if (wet) { const g = ctx.createGain(); g.gain.value = wet; n.connect(g); g.connect((out && out.wetTo) || busWet); } }
function shape(g, t, a, d, v) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(v, 0.0002), t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); }
function tone(f, t, d, o = {}) {
  const { type = 'sine', v = 0.2, a = 0.01, to, out, wet = 0, det = 0 } = o, n = ctx.createOscillator(), g = ctx.createGain();
  n.type = type; n.detune.value = det; n.frequency.setValueAtTime(f, t); if (to) n.frequency.exponentialRampToValueAtTime(to, t + a + d);
  shape(g, t, a, d, v); n.connect(g); route(g, out, wet); n.start(t); n.stop(t + a + d + 0.05);
}
function nz(t, d, o = {}) {
  const { buf = W, ft = 'bandpass', f = 1000, q = 1, to, v = 0.2, a = 0.01, out, wet = 0 } = o, s = ctx.createBufferSource(), fl = ctx.createBiquadFilter(), g = ctx.createGain();
  s.buffer = buf; s.loop = true; fl.type = ft; fl.Q.value = q; fl.frequency.setValueAtTime(f, t); if (to) fl.frequency.exponentialRampToValueAtTime(to, t + a + d);
  shape(g, t, a, d, v); s.connect(fl); fl.connect(g); route(g, out, wet); s.start(t, rnd(0, 3)); s.stop(t + a + d + 0.05);
}
function pad(f, t, a, h, r, o = {}) {
  const { type = 'sawtooth', v = 0.05, lp = 900, out, wet = 0.4, det = 0 } = o, n = ctx.createOscillator(), fl = ctx.createBiquadFilter(), g = ctx.createGain();
  n.type = type; n.frequency.value = f; n.detune.value = det; fl.type = 'lowpass'; fl.frequency.value = lp;
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + a); g.gain.setValueAtTime(v, t + a + h); g.gain.linearRampToValueAtTime(0, t + a + h + r);
  n.connect(fl); fl.connect(g); route(g, out, wet); n.start(t); n.stop(t + a + h + r + 0.05);
}
const VOW = { a: [800, 1150, 2900], o: [450, 800, 2830], u: [325, 700, 2700], e: [400, 1700, 2600], i: [270, 2100, 3000] };
function voice(f, t, d, o = {}) {
  const { vowel = 'a', v = 0.14, a = 0.03, out, wet = 0, vib = 0, to, det = 0, breath = false } = o, g = ctx.createGain(); let s, lfo;
  if (breath) { s = ctx.createBufferSource(); s.buffer = P; s.loop = true; }
  else {
    s = ctx.createOscillator(); s.type = 'sawtooth'; s.detune.value = det; s.frequency.setValueAtTime(f, t); if (to) s.frequency.exponentialRampToValueAtTime(to, t + a + d);
    if (vib) { lfo = ctx.createOscillator(); lfo.frequency.value = 5.4; const m = ctx.createGain(); m.gain.value = f * 0.016 * vib; lfo.connect(m); m.connect(s.frequency); lfo.start(t); lfo.stop(t + a + d + 0.05); }
  }
  VOW[vowel].forEach((fm, i) => { const b = ctx.createBiquadFilter(), m = ctx.createGain(); b.type = 'bandpass'; b.frequency.value = fm; b.Q.value = 9; m.gain.value = [1, 0.55, 0.22][i] * (breath ? 2.2 : 1); s.connect(b); b.connect(m); m.connect(g); });
  shape(g, t, a, d, v * 4); route(g, out, wet); s.start(t); s.stop(t + a + d + 0.05); // les formants étroits mangent le niveau
}
function bell(f, t, d, o = {}) { const { v = 0.1, wet = 0.5, out } = o; [[1, 1, 1], [2, 0.5, 0.7], [2.76, 0.3, 0.5], [5.4, 0.12, 0.25]].forEach(([k, m, l]) => tone(f * k, t, d * l, { v: v * m, a: 0.004, wet, out })); }
function pluck(f, t, d, o = {}) { const { v = 0.2, wet = 0.3, det = 0 } = o; tone(f, t, d, { type: 'triangle', v, a: 0.006, wet, det }); tone(f * 2, t, d * 0.5, { v: v * 0.25, a: 0.004, wet, det }); tone(f * 3, t, d * 0.25, { v: v * 0.08, a: 0.003, wet, det }); }
function heart(t, v = 0.5, gap = 0.34, out) { for (const [dt, k] of [[0, 1], [gap, 0.62]]) { const u = t + dt; tone(62, u, 0.24, { to: 34, v: v * k, a: 0.012, out }); tone(124, u, 0.1, { to: 70, type: 'triangle', v: v * k * 0.35, a: 0.008, out }); nz(u, 0.05, { ft: 'lowpass', f: 240, v: v * k * 0.45, out }); } }
function breath(t, inn, ex, v = 0.14, f = 1100, out) { nz(t, inn, { buf: P, f, q: 1.2, a: inn * 0.7, v, to: f * 1.3, out }); nz(t + inn + 0.15, ex, { buf: P, f: f * 0.75, q: 1, a: ex * 0.25, v: v * 0.9, to: f * 0.5, out }); }
function drop(t, o = {}) { const f = o.f ?? rnd(650, 1100); tone(f, t, 0.07, { to: f * 2.1, v: o.v ?? 0.16, a: 0.003, wet: o.wet ?? 0.6, out: o.out }); }
function bubble(t, o = {}) { const f = rnd(260, 520); tone(f, t, rnd(0.05, 0.11), { to: f * rnd(1.8, 2.8), v: o.v ?? 0.13, a: 0.006, wet: 0.3, out: o.out }); }
function creak(t, o = {}) { let u = t, gap = 0.06; const n = o.n ?? 26, f = rnd(520, 820); for (let i = 0; i < n; i++) { nz(u, 0.014, { f: f + i * 14, q: 7, v: (o.v ?? 0.3) * 3, a: 0.002, out: o.out, wet: o.wet ?? 0.4 }); gap = Math.max(0.018, gap * rnd(0.9, 1.04)); u += gap; } return u - t; }
function chirp(t, o = {}) { const f = rnd(2700, 3700); for (let i = 0, n = 2 + Math.floor(rnd(0, 3)); i < n; i++) tone(f, t + i * 0.13, 0.08, { to: f * rnd(1.15, 1.45), v: o.v ?? 0.05, a: 0.008, wet: 0.45, out: o.out }); }
function rumble(t, d, v = 0.5, out) { nz(t, d * 0.55, { buf: B, ft: 'lowpass', f: 130, q: 0.7, a: d * 0.45, v, out }); tone(38, t, d * 0.5, { a: d * 0.5, v: v * 0.45, out }); tone(76, t, d * 0.45, { a: d * 0.5, v: v * 0.14, type: 'triangle', out }); }
// le thème du manteau : cinq notes, la même mélodie descend de strate en strate
const TH = [[0, 1], [7, 1], [5, 0.5], [3, 0.5], [2, 2]];
function theme(base, beat, fn, start) { let t = start; for (const [s, b] of TH) { fn(hz(base + s), t, b * beat); t += b * beat; } return t; }
function steps(fn, n = 4, gap = 0.44) { const T = t0(); for (let i = 0; i < n; i++) fn(T + i * gap, i); return n * gap + 0.5; }
function babble(n, rate, fn) { const T = t0(); let t = T; for (let i = 0; i < n; i++) { const d = rate * rnd(0.7, 1.3); fn(t, d, i); t += d + rate * (i % 4 === 3 ? 0.9 : 0.25); } return t - T + 0.6; }

/* ---------- Les ambiances : elles tournent en boucle jusqu'à ce qu'on les coupe ---------- */
let curAmb = null;
function stopAmb() { if (!curAmb) return; const A = curAmb; curAmb = null; A.timers.forEach(clearTimeout); A.alive = false; A.g.gain.cancelScheduledValues(ctx.currentTime); A.g.gain.setTargetAtTime(0, ctx.currentTime, 0.25); setTimeout(() => { A.src.forEach(s => { try { s.stop(); } catch {} }); A.g.disconnect(); }, 1500); }
function startAmb(build, muffle) {
  stopAmb();
  const g = ctx.createGain(); g.gain.setValueAtTime(0, ctx.currentTime); g.gain.linearRampToValueAtTime(1, ctx.currentTime + 1.5); g.connect(bus);
  let out = g;
  if (muffle) { out = ctx.createBiquadFilter(); out.type = 'lowpass'; out.frequency.value = muffle; out.connect(g); const w = ctx.createBiquadFilter(); w.type = 'lowpass'; w.frequency.value = muffle; w.connect(busWet); out.wetTo = w; }
  const A = curAmb = { g, src: [], timers: [], alive: true };
  const hold = o => {
    const { buf = P, ft = 'bandpass', f = 600, q = 0.8, v = 0.1, sweep = 0, rate = 0.08, swell = 0 } = o, s = ctx.createBufferSource(), fl = ctx.createBiquadFilter(), m = ctx.createGain();
    s.buffer = buf; s.loop = true; fl.type = ft; fl.frequency.value = f; fl.Q.value = q; m.gain.value = v; s.connect(fl); fl.connect(m); m.connect(out); s.start(); A.src.push(s);
    if (sweep || swell) { const l = ctx.createOscillator(); l.frequency.value = rate; if (sweep) { const d = ctx.createGain(); d.gain.value = sweep; l.connect(d); d.connect(fl.frequency); } if (swell) { const d = ctx.createGain(); d.gain.value = v * swell; l.connect(d); d.connect(m.gain); } l.start(); A.src.push(l); }
  };
  const drone = (f, v, type = 'sine') => { const n = ctx.createOscillator(), m = ctx.createGain(); n.type = type; n.frequency.value = f; m.gain.value = v; n.connect(m); m.connect(out); n.start(); A.src.push(n); };
  const every = (a, b, fn) => { const tick = () => { if (!A.alive) return; fn(t0()); A.timers.push(setTimeout(tick, rnd(a, b))); }; A.timers.push(setTimeout(tick, rnd(a * 0.2, a))); };
  build({ hold, drone, every, out });
}

/* ---------- Le catalogue ---------- */
const BOOK = [
  { id: 'theme', title: 'Le thème du manteau', sub: 'la mélodie qui relie les six strates', c: '#1a1828', items: [
    ['theme', 'Le thème, tout simple', 'Les cinq notes, jouées sans décor.', () => { const T = t0(); const e = theme(62, 0.62, (f, t, d) => pluck(f, t, d + 0.8), T); return e - T + 1.2; }],
    ['fin-a', 'Fin : achever ton dessin', 'Le thème revient en entier, et s’ouvre.', () => { const T = t0(); const e = theme(62, 0.85, (f, t, d) => { pluck(f, t, d + 1.2, { v: 0.24, wet: 0.6 }); pad(f / 2, t, 0.3, d, 0.8, { v: 0.05 }); pad(f * 0.75, t, 0.3, d, 0.8, { v: 0.03 }); }, T); [50, 57, 62, 66, 69, 74].forEach((m, i) => pad(hz(m), e, 1, 3, 3.5, { v: 0.05, lp: 1400 })); [74, 78, 81, 86].forEach((m, i) => bell(hz(m), e + 0.3 + i * 0.32, 3.5, { v: 0.07 })); return e - T + 7.5; }],
    ['fin-d', 'Fin : déchirer la page', 'Le thème se désaccorde et casse sur une note.', () => { const T = t0(); let t = T, k = 0; for (const [s, b] of TH.slice(0, 4)) { pluck(hz(62 + s), t, 1.2, { v: 0.22, det: -k * k * 14, wet: 0.5 }); t += b * 0.85; k++; } for (let i = 0; i < 34; i++) nz(t + i * 0.024 + rnd(0, 0.012), 0.016, { f: rnd(1800, 4200), q: 1.5, v: rnd(0.08, 0.32), a: 0.002 }); tone(hz(39), t + 1, 3, { type: 'triangle', v: 0.2, det: -35, wet: 0.8, a: 0.01 }); return t - T + 4.2; }],
  ] },
  { id: 'jardins', title: 'Strate 01 · Les Jardins suspendus', sub: 'vivant et lumineux', c: '#2f7a5f', items: [
    ['j-hum', 'La Glaneuse fredonne', 'Le thème, d’une vieille voix qui tremble.', () => { const T = t0(); const e = theme(57, 0.72, (f, t, d) => voice(f, t, d * 0.9, { vowel: 'o', v: 0.17, a: 0.09, vib: 1.4, wet: 0.35 }), T); return e - T + 0.8; }],
    ['j-pollen', 'Cueillir le pollen', 'Une goutte d’encre, un carillon doré.', () => { const T = t0(); drop(T, { f: 900 }); [76, 81, 83, 88].forEach((m, i) => bell(hz(m), T + 0.08 + i * 0.09, 1.4, { v: 0.07 })); return 1.8; }],
    ['j-fall', 'Cascade au loin', 'De l’eau qui tombe de très haut.', () => { const T = t0(); nz(T, 2.6, { ft: 'lowpass', f: 1700, a: 1.6, v: 0.16, wet: 0.5 }); nz(T, 2.6, { buf: P, f: 450, q: 0.5, a: 1.6, v: 0.16 }); return 4.4; }],
  ] },
  { id: 'brumes', title: 'Strate 02 · Les Brumes éternelles', sub: 'vide et inquiétant', c: '#65708a', items: [
    ['b-horn', 'Les trompettes rouges', 'Le thème joué faux, puis une réponse d’une autre île.', () => { const T = t0(); const e = theme(57, 0.7, (f, t, d) => voice(f, t, d * 0.9, { vowel: 'a', v: 0.11, a: 0.1, wet: 1, det: -32 }), T); theme(52, 0.7, (f, t, d) => voice(f, t, d * 0.9, { vowel: 'a', v: 0.045, a: 0.14, wet: 1.2, det: 24 }), e + 0.3); return e - T + 4.6; }],
    ['b-lamp', 'Une Lanterne rallumée', 'La flamme prend, une note reste.', () => { const T = t0(); nz(T, 0.35, { f: 2400, q: 0.7, to: 800, v: 0.16 }); bell(hz(69), T + 0.2, 3, { v: 0.1 }); return 3; }],
    ['b-three', 'Les trois Lanternes', 'Chaque flamme ajoute une note, jusqu’à l’accord.', () => { const T = t0(); [57, 64, 69].forEach((m, i) => { nz(T + i * 1.4, 0.3, { f: 2400, to: 800, v: 0.12 }); bell(hz(m), T + 0.15 + i * 1.4, 5 - i, { v: 0.1 }); pad(hz(m), T + 0.15 + i * 1.4, 0.8, 4 - i * 1.4, 2, { v: 0.035 }); }); return 7.5; }],
    ['b-well', 'Le Puits s’ouvre', 'La brume se retire, un grand souffle aspire vers le bas.', () => { const T = t0(); nz(T, 2.4, { buf: P, f: 1500, to: 150, q: 0.8, a: 2, v: 0.35, wet: 0.6 }); rumble(T + 1, 4, 0.5); return 6; }],
  ] },
  { id: 'foret', title: 'Strate 03 · La Forêt des géants', sub: 'intime et magique', c: '#47327e', items: [
    ['f-song', 'La berceuse de la Veilleuse', 'Le thème, chanté par une enfant.', () => { const T = t0(); const e = theme(69, 0.85, (f, t, d) => voice(f, t, d * 0.92, { vowel: 'u', v: 0.2, a: 0.1, vib: 0.8, wet: 0.7 }), T); return e - T + 1.6; }],
    ['f-drop', 'Gouttes', 'L’eau qui tombe des lamelles.', () => { const T = t0(); [0, 0.5, 0.75, 1.5].forEach(d => drop(T + d)); return 2.4; }],
    ['f-spore', 'Encre qui luit', 'Ramasser une grappe de spores.', () => { const T = t0(); nz(T, 0.5, { f: 3500, q: 5, to: 6500, v: 0.08, wet: 0.7 }); [84, 91, 96].forEach((m, i) => bell(hz(m), T + i * 0.07, 1.6, { v: 0.07 })); return 2; }],
  ] },
  { id: 'abysses', title: 'Strate 04 · Les Abysses engloutis', sub: 'pression et solitude', c: '#0f4148', items: [
    ['a-long', 'Le chant du Long', 'Le thème, très lent, comme une baleine immense.', () => { const T = t0(), n = ctx.createOscillator(), o2 = ctx.createOscillator(), g = ctx.createGain(), g2 = ctx.createGain(), beat = 1.7; let u = T; n.frequency.setValueAtTime(hz(45), T); o2.frequency.setValueAtTime(hz(45) * 2.01, T); for (const [s, b] of TH) { const f = hz(45 + s); n.frequency.exponentialRampToValueAtTime(f, u + 0.6 * b * beat); o2.frequency.exponentialRampToValueAtTime(f * 2.01, u + 0.6 * b * beat); u += b * beat; } g.gain.setValueAtTime(0, T); g.gain.linearRampToValueAtTime(0.3, T + 1.6); g.gain.setValueAtTime(0.3, u - 1); g.gain.linearRampToValueAtTime(0, u + 1.5); g2.gain.value = 0.25; n.connect(g); o2.connect(g2); g2.connect(g); route(g, null, 1); n.start(T); o2.start(T); n.stop(u + 1.6); o2.stop(u + 1.6); return u - T + 3.5; }],
    ['a-bell', 'Cloche de nacre', 'Elle s’ouvre et rend le souffle.', () => { const T = t0(); bell(hz(69), T, 3.5, { v: 0.14, wet: 1 }); for (let i = 0; i < 6; i++) bubble(T + 0.5 + i * 0.13); breath(T + 1.1, 0.9, 0.2, 0.2, 900); return 3.6; }],
    ['a-low', 'Le souffle manque', 'Le cœur s’emballe, le son se referme.', () => { const T = t0(), lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(2400, T); lp.frequency.exponentialRampToValueAtTime(170, T + 7); lp.connect(bus); let t = T, gap = 0.95; while (t < T + 7) { heart(t, 0.55, gap * 0.34, lp); breath(t, 0.2, 0.2, 0.14, 1000, lp); t += gap; gap = Math.max(0.36, gap * 0.92); } return 8; }],
    ['a-win', 'Détourer une fenêtre', 'Le pinceau, puis la vitre qui se décroche et remonte.', () => { const T = t0(); nz(T, 0.8, { f: 1200, to: 500, q: 1, a: 0.12, v: 0.16 }); bell(hz(76), T + 0.9, 3, { v: 0.12, wet: 1 }); for (let i = 0; i < 5; i++) bell(hz(76 + i * 3), T + 1.2 + i * 0.32, 1.6, { v: 0.05, wet: 1 }); return 4.4; }],
  ] },
  { id: 'terres', title: 'Strate 05 · Les Terres organiques', sub: 'organique et oppressant', c: '#a8402c', items: [
    ['t-amb', 'Ambiance des Terres', 'Le Battement, une respiration géante, des bruits humides.', { loop: x => { x.hold({ buf: B, ft: 'lowpass', f: 220, v: 0.2 }); x.every(8000, 8100, t => { nz(t, 3.2, { buf: P, f: 320, q: 0.8, a: 3, v: 0.24, to: 500, out: x.out }); nz(t + 3.3, 3.5, { buf: P, f: 240, q: 0.8, a: 0.8, v: 0.22, to: 150, out: x.out }); }); x.every(1600, 5200, t => nz(t, 0.16, { f: 480, to: 1200, q: 5, v: 0.1, a: 0.02, out: x.out, wet: 0.4 })); } }],
    ['t-mouth', 'Bouche-fleur', 'Elle se referme quand tu passes.', () => { const T = t0(); [0, 0.7].forEach(d => { nz(T + d, 0.03, { f: 950, q: 2, v: 0.4, a: 0.002 }); tone(210, T + d + 0.012, 0.09, { to: 76, v: 0.34, a: 0.004 }); nz(T + d + 0.03, 0.15, { f: 500, to: 1300, q: 5, v: 0.1, a: 0.02 }); }); return 1.5; }],
    ['t-net', 'Les Nettoyeurs', 'De petites pattes qui grattent les os.', () => { const T = t0(); for (let i = 0; i < 34; i++) nz(T + i * rnd(0.05, 0.075), 0.014, { ft: 'highpass', f: rnd(2600, 4800), v: rnd(0.05, 0.16), a: 0.002 }); return 2.8; }],
  ] },
  { id: 'cite', title: 'Strate 06 · La Cité oubliée', sub: 'le silence', c: '#232d52', items: [
    ['c-amb', 'Ambiance de la Cité', 'Presque rien : un air immobile, une pierre au loin, de temps en temps.', { loop: x => { x.hold({ buf: B, ft: 'lowpass', f: 90, v: 0.14 }); x.every(9000, 20000, t => { nz(t, 0.04, { f: 500, q: 2, v: 0.12, out: x.out, wet: 2 }); }); x.every(14000, 26000, t => bell(hz(38), t, 7, { v: 0.05, out: x.out, wet: 1.5 })); } }],
    ['c-glyph', 'Inscription qui s’allume', 'Un grésillement, comme une machine en veille.', () => { const T = t0(); for (let i = 0; i < 26; i++) tone(rnd(2600, 5800), T + i * rnd(0.02, 0.05), 0.012, { type: 'square', v: rnd(0.012, 0.05), a: 0.002 }); pad(hz(86), T + 0.2, 0.4, 0.4, 0.8, { type: 'sine', v: 0.03, lp: 5000 }); return 2.2; }],
    ['c-stair', 'L’escalier de lumière', 'Les marches paraissent une à une.', () => { const T = t0(); [62, 65, 69, 72, 74, 77, 81, 84].forEach((m, i) => bell(hz(m), T + i * 0.16, 1.8, { v: 0.07, wet: 0.9 })); return 3.2; }],
  ] },
  { id: 'commun', title: 'Partout dans le jeu', sub: 'les pas, les gestes, les chutes', c: '#5f4c37', items: [
    ['g-brush', 'Coup de pinceau', 'Le grand trait d’encre.', () => { const T = t0(); nz(T, 0.75, { buf: P, f: 1500, to: 620, q: 1.1, a: 0.14, v: 0.42 }); for (let i = 0; i < 9; i++) nz(T + 0.12 + i * 0.07, 0.02, { f: rnd(2000, 3500), q: 2, v: 0.05, a: 0.002 }); drop(T + 0.95, { f: 620, v: 0.12 }); return 1.5; }],
    ['g-ink', 'Goutte d’encre', 'Une goutte ramassée.', () => { const T = t0(); drop(T, { f: 760, v: 0.2 }); bell(hz(84), T + 0.07, 0.9, { v: 0.05 }); return 1.1; }],
    ['g-page', 'Page du carnet', 'Une nouvelle page se tourne.', () => { const T = t0(); nz(T, 0.32, { ft: 'highpass', f: 1600, a: 0.1, v: 0.16 }); nz(T + 0.18, 0.1, { f: 3000, q: 1, v: 0.14 }); pluck(hz(74), T + 0.45, 1.2, { v: 0.09 }); return 1.7; }],
    ['g-land', 'L’impact d’arrivée', 'Le sol tremble, la poussière retombe.', () => { const T = t0(); tone(74, T, 0.7, { to: 28, v: 0.7, a: 0.006 }); nz(T, 0.32, { ft: 'lowpass', f: 900, v: 0.5, a: 0.004, wet: 0.5 }); nz(T + 0.15, 1.4, { buf: P, f: 700, to: 200, q: 0.5, a: 0.2, v: 0.12 }); return 2.4; }],
  ] },
  { id: 'voix', title: 'Les murmures des PNJ', sub: 'pas de vrais mots, un timbre pour chacun', c: '#7b5a22', items: [
    ['v-gl', 'La Glaneuse', 'Une vieille voix, douce et chevrotante.', () => babble(11, 0.15, (t, d) => voice(rnd(175, 215), t, d, { vowel: pick(['o', 'e', 'a']), v: 0.13, a: 0.03, vib: 2, wet: 0.2 }))],
    ['v-pa', 'Le Passeur', 'Un souffle grave, presque de la brume.', () => babble(9, 0.22, (t, d) => voice(90, t, d, { vowel: pick(['o', 'u', 'a']), v: 0.26, a: 0.06, breath: true, wet: 0.7 }))],
    ['v-ve', 'La Veilleuse', 'Une enfant : elle parle en chantant.', () => babble(12, 0.14, (t, d, i) => voice(hz(pick([69, 72, 74, 76])), t, d, { vowel: pick(['u', 'i', 'e']), v: 0.13, a: 0.03, wet: 0.5 }))],
    ['v-pl', 'Le Plongeur', 'Une voix enfermée dans un casque.', () => { const lp = ctx.createBiquadFilter(); lp.type = 'bandpass'; lp.frequency.value = 850; lp.Q.value = 2.4; lp.connect(bus); return babble(10, 0.17, (t, d) => { voice(rnd(100, 125), t, d, { vowel: pick(['o', 'a', 'e']), v: 0.4, a: 0.02, out: lp }); bubble(t + d, { v: 0.03 }); }); }],
    ['v-gr', 'La Greffée', 'Deux voix mêlées, qui parlent ensemble.', () => babble(10, 0.2, (t, d) => { const f = rnd(135, 165), w = pick(['a', 'o', 'e']); voice(f, t, d, { vowel: w, v: 0.12, a: 0.04, wet: 0.6 }); voice(f * 0.74, t + 0.03, d, { vowel: w, v: 0.1, a: 0.04, wet: 0.6, det: 16 }); })],
    ['v-ar', 'L’Archiviste', 'Il ne parle pas : une plume gratte, une voix très basse.', () => babble(12, 0.16, (t, d) => { for (let i = 0; i < 4; i++) nz(t + i * d * 0.22, 0.016, { ft: 'highpass', f: rnd(3000, 5500), v: rnd(0.06, 0.16), a: 0.002, wet: 0.5 }); voice(68, t, d, { vowel: 'o', v: 0.09, a: 0.05, wet: 0.7 }); })],
  ] },
];

/* ---------- Les sons choisis ---------- */
const grains = (t, n, d, fn) => { for (let i = 0; i < n; i++) fn(t + rnd(0, d), i); };
function trill(f, t, d, v = 0.05, out) { const n = ctx.createOscillator(), m = ctx.createOscillator(), mg = ctx.createGain(), g = ctx.createGain(); n.frequency.value = f; m.frequency.value = 27; mg.gain.value = f * 0.07; m.connect(mg); mg.connect(n.frequency); shape(g, t, 0.03, d, v); n.connect(g); route(g, out, 0.6); n.start(t); m.start(t); n.stop(t + d + 0.1); m.stop(t + d + 0.1); }
const softBird = (t, v, out) => { tone(2100, t, 0.2, { to: 2500, v, a: 0.05, wet: 0.8, out }); tone(1760, t + 0.3, 0.32, { to: 1660, v: v * 0.8, a: 0.05, wet: 0.8, out }); };
const FRESH = [
  { id: 'n-j', title: 'Les Jardins suspendus', sub: 'quatre sons, deux versions chacun', c: '#2f7a5f', items: [
    ['n-j-a2', 'Ambiance · B, jardin musical', 'Une nappe chaude, des notes de pollen, presque pas de vent.', { loop: x => { x.drone(hz(50), 0.035, 'triangle'); x.drone(hz(57), 0.024); x.drone(hz(62), 0.016); x.hold({ ft: 'lowpass', f: 500, q: 0.3, v: 0.06, swell: 0.5, rate: 0.06 }); x.every(2200, 5200, t => bell(hz(pick([74, 76, 78, 81, 83, 86])), t, 3, { v: 0.035, out: x.out, wet: 0.9 })); } }],
    ['n-j-b1', 'Oiseau-graine · A, sifflet', 'Deux notes douces, comme quelqu’un qui siffle.', () => { const T = t0(); softBird(T, 0.08); softBird(T + 1, 0.06); return 2.2; }],
    ['n-j-k1', 'Rires d’enfants · A, clochettes', 'Pas de voix : des notes qui courent et sautillent.', () => { const T = t0(); [79, 83, 86, 83, 88, 86, 91].forEach((m, i) => pluck(hz(m), T + i * 0.13, 0.5, { v: 0.11, wet: 0.5 })); [86, 91, 88, 93].forEach((m, i) => pluck(hz(m), T + 1.15 + i * 0.11, 0.5, { v: 0.08, wet: 0.5 })); return 2.4; }],
    ['n-j-t1', 'L’arbre-mère · A, chœur', 'Un chœur qui s’élève, des clochettes tout en haut.', () => { const T = t0(); [50, 57, 62, 66, 69].forEach((m, i) => voice(hz(m), T + i * 0.45, 6.5 - i * 0.45, { vowel: i % 2 ? 'o' : 'a', v: 0.04, a: 1.8, vib: 0.6, wet: 0.9 })); for (let i = 0; i < 9; i++) bell(hz(pick([86, 88, 90, 93])), T + 3 + i * 0.38, 2.2, { v: 0.03, wet: 1 }); return 9; }],
  ] },
  { id: 'n-b', title: 'Les Brumes éternelles', sub: 'une ambiance, deux versions', c: '#65708a', items: [
    ['n-b-a2', 'Ambiance · B, la brume habitée', 'Une cloche de bouée, le thème joué très loin par les trompettes.', { loop: x => { x.hold({ buf: B, ft: 'lowpass', f: 240, v: 0.2, swell: 0.4, rate: 0.05 }); x.hold({ f: 380, q: 1, v: 0.04, sweep: 100, rate: 0.05, swell: 0.6 }); x.every(7000, 11000, t => bell(hz(57), t, 4.5, { v: 0.05, wet: 1.2, out: x.out })); x.every(16000, 28000, t => theme(45, 0.9, (f, u, d) => voice(f, u, d * 0.9, { vowel: 'a', v: 0.016, a: 0.2, wet: 1.4, det: -28, out: x.out }), t)); } }],
  ] },
  { id: 'n-f', title: 'La Forêt des géants', sub: 'deux sons, deux versions chacun', c: '#47327e', items: [
    ['n-f-a2', 'Ambiance · B, forêt magique', 'Des notes de verre, et la berceuse qui revient au loin.', { loop: x => { x.drone(110, 0.02); x.drone(165, 0.012); x.every(1400, 3200, t => bell(hz(pick([81, 83, 85, 88, 90])), t, 2.4, { v: 0.04, wet: 1, out: x.out })); x.every(9000, 16000, t => theme(81, 0.7, (f, u) => bell(f, u, 2.2, { v: 0.024, wet: 1, out: x.out }), t)); } }],
    ['f-wake2', 'Le réveil de l’Endormi · le grand grondement', 'Douze secondes : la terre gronde de plus en plus fort, roule, puis un choc énorme.', () => { const T = t0(), D = 12, sat = ctx.createWaveShaper(), curve = new Float32Array(1024), lp = ctx.createBiquadFilter(), roll = ctx.createGain(), g = ctx.createGain(); for (let i = 0; i < 1024; i++) curve[i] = Math.tanh((i / 512 - 1) * 6); sat.curve = curve; lp.type = 'lowpass'; lp.frequency.setValueAtTime(150, T); lp.frequency.linearRampToValueAtTime(420, T + 8.5); lp.frequency.linearRampToValueAtTime(190, T + D); g.gain.setValueAtTime(0, T); g.gain.linearRampToValueAtTime(0.18, T + 2.5); g.gain.linearRampToValueAtTime(0.5, T + 8.5); g.gain.setValueAtTime(0.5, T + 9.2); g.gain.linearRampToValueAtTime(0, T + D); for (let u = T; u < T + D; u += rnd(0.22, 0.5)) roll.gain.linearRampToValueAtTime(rnd(0.5, 1), u); sat.connect(lp); lp.connect(roll); roll.connect(g); route(g, null, 0.35); const n = ctx.createBufferSource(), ng = ctx.createGain(); n.buffer = B; n.loop = true; ng.gain.value = 3; n.connect(ng); ng.connect(sat); n.start(T); n.stop(T + D); [[29, 44, 'sawtooth'], [29.6, 45, 'sawtooth'], [22, 33, 'square']].forEach(([a, b, type]) => { const o = ctx.createOscillator(), m = ctx.createGain(); o.type = type; o.frequency.setValueAtTime(a, T); o.frequency.linearRampToValueAtTime(b, T + 8.5); m.gain.value = 0.55; o.connect(m); m.connect(sat); o.start(T); o.stop(T + D); }); tone(36, T, 6, { a: 6, v: 0.5 }); grains(T + 3, 60, 6, u => nz(u, 0.05, { f: rnd(160, 800), q: 2, v: rnd(0.12, 0.42), a: 0.003, wet: 0.9 })); tone(62, T + 8.6, 2.4, { to: 22, v: 0.5, a: 0.006 }); nz(T + 8.6, 0.8, { ft: 'lowpass', f: 900, v: 0.3, a: 0.004, wet: 0.7 }); return D + 1.5; }],
  ] },
  { id: 'n-a', title: 'Les Abysses engloutis', sub: 'deux sons, deux versions chacun', c: '#0f4148', items: [
    ['n-a-a1', 'Ambiance · A, la profondeur', 'Un grondement doux, de rares bulles, une baleine très loin.', { muffle: 900, loop: x => { x.hold({ buf: B, ft: 'lowpass', f: 110, v: 0.28, swell: 0.3, rate: 0.03 }); x.every(4000, 10000, t => { for (let i = 0; i < 3; i++) bubble(t + i * 0.14, { v: 0.07, out: x.out }); }); x.every(16000, 30000, t => tone(hz(45), t, 5, { to: hz(52), a: 1.8, v: 0.07, wet: 1.4, out: x.out })); } }],
    ['n-a-r2', 'Respiration · B, le souffle calme', 'Très doux et lent, sans effet.', () => { const T = t0(); [0, 4.2].forEach(d => { nz(T + d, 0.5, { buf: P, ft: 'lowpass', f: 520, a: 1.2, v: 0.24 }); nz(T + d + 1.9, 1.5, { buf: P, ft: 'lowpass', f: 380, a: 0.5, v: 0.22 }); }); return 8; }],
  ] },
  { id: 'n-c', title: 'Partout dans le jeu', sub: 'cinq sons, deux versions chacun', c: '#5f4c37', items: [
    ['n-g-f1', 'La chute · A, le vent qui siffle', 'Le vent monte en sifflant, le manteau claque.', () => { const T = t0(); nz(T, 1, { buf: P, f: 500, to: 2000, q: 4, a: 5, v: 1 }); nz(T, 1, { buf: P, f: 300, to: 1200, q: 0.6, a: 5, v: 0.6 }); for (let i = 0; i < 28; i++) nz(T + 2.6 + i * 0.1, 0.04, { f: 260, q: 1.5, v: 0.08 + i * 0.01, a: 0.006 }); return 6.5; }],
  ] },
];


/* ---------- Ce que le jeu demande ---------- */
const ALL = Object.fromEntries([...FRESH, ...BOOK].flatMap(s => s.items).map(i => [i[0], i[3]]));
const AMB = { 1: 'n-j-a2', 2: 'n-b-a2', 3: 'n-f-a2', 4: 'n-a-a1', 5: 't-amb', 6: 'c-amb' };
const key = 'hollow-volume', RINGS = [38, 45, 50, 53];
let level = 0.75, wanted = 0; try { const v = parseFloat(localStorage.getItem(key)); if (v >= 0 && v <= 1) level = v; } catch { /* stockage bloqué */ }
vol = level;
// un son joué plus doucement : le temps de l'appel, tout passe par sa propre sortie
function at(v, fn) { if (!ctx || ctx.state !== 'running') return; const a = bus, b = busWet; bus = ctx.createGain(); busWet = ctx.createGain(); bus.gain.value = busWet.gain.value = v; bus.connect(a); busWet.connect(b); try { fn(); } finally { bus = a; busWet = b; } }
// ce qui vit en plus dans l'ambiance de chaque strate
const EXTRA = {
  1: x => { x.every(9000, 20000, () => sons.play('n-j-b1', 0.35)); x.every(22000, 45000, () => sons.play('n-j-k1', 0.25)); x.every(30000, 50000, () => sons.play('j-fall', 0.3)); },
  3: x => x.every(2500, 7000, () => sons.play('f-drop', 0.4)),
  5: x => x.every(14000, 30000, () => sons.play('t-net', 0.4)),
};
const STEP = {
  1: t => { nz(t, 0.16, { buf: P, f: 1800, to: 800, q: 0.6, a: 0.05, v: 0.32 }); nz(t, 0.05, { ft: 'lowpass', f: 260, v: 0.2 }); },
  2: t => { nz(t, 0.045, { f: 1700, q: 1.1, v: 0.22, a: 0.003 }); tone(120, t, 0.06, { to: 70, v: 0.22 }); },
  3: t => { nz(t, 0.1, { buf: B, ft: 'lowpass', f: 340, v: 0.55, a: 0.02 }); tone(60, t, 0.07, { to: 44, v: 0.12, a: 0.01 }); },
  5: t => { tone(92, t, 0.1, { to: 52, v: 0.34 }); nz(t + 0.02, 0.13, { f: 420, to: 1100, q: 5, v: 0.11, a: 0.02 }); },
  6: t => { nz(t, 0.05, { f: 1500, q: 1, v: 0.24, wet: 1.6 }); tone(130, t, 0.06, { to: 80, v: 0.2, wet: 1.2 }); },
};
export const sons = {
  // le navigateur n'autorise le son qu'après un geste du joueur
  unlock() { boot(); if (wanted) { const n = wanted; wanted = 0; ctx.resume().then(() => { if (!curAmb) sons.ambience(n); }); } },
  play(id, v = 1) { at(v, ALL[id]); },
  ambience(n) { if (!ctx || ctx.state !== 'running') { wanted = n; return; } const fn = ALL[AMB[n]]; if (fn) startAmb(x => { fn.loop(x); EXTRA[n]?.(x); }, fn.muffle); },
  silence() { wanted = 0; if (ctx) stopAmb(); },
  // tout se tait lentement (le Battement qu'on fait taire, la fin)
  hush(secs) { if (curAmb) { curAmb.g.gain.cancelScheduledValues(ctx.currentTime); curAmb.g.gain.setTargetAtTime(0, ctx.currentTime, secs / 3); } },
  step(n, bridge) { at(n === 1 ? 0.5 : 0.6, () => { (STEP[n] || STEP[2])(t0()); if (bridge && Math.random() < 0.3) creak(t0(), { n: 12, v: 0.12 }); if (n === 3 && Math.random() < 0.2) bell(hz(pick([84, 88, 91, 93])), t0(), 1.3, { v: 0.05 }); }); },
  swim() { at(0.6, () => { const t = t0(); nz(t, 0.7, { buf: B, ft: 'lowpass', f: 500, to: 200, a: 0.3, v: 0.6 }); grains(t + 0.5, 5, 0.6, u => bubble(u, { v: 0.08 })); }); },
  climb() { at(0.6, () => { const t = t0(); nz(t, 0.08, { f: 700, to: 1200, q: 3, v: 0.16 }); tone(110, t, 0.07, { to: 66, v: 0.2 }); }); },
  jump() { at(0.7, () => nz(t0(), 0.32, { buf: P, f: 500, to: 1500, q: 0.7, a: 0.1, v: 0.3 })); },
  touch() { at(0.7, () => { const u = t0(); tone(70, u, 0.3, { to: 32, v: 0.6 }); nz(u, 0.1, { ft: 'lowpass', f: 600, v: 0.3 }); nz(u + 0.05, 0.7, { buf: P, f: 900, to: 300, q: 0.5, a: 0.1, v: 0.07 }); }); },
  heart(v) { at(1, () => heart(t0(), v, 0.36)); },
  ring(k) { at(1, () => { const T = t0(); nz(T, 1, { buf: B, ft: 'lowpass', f: 420, a: 0.4, v: 0.34 }); bell(hz(RINGS[k]), T + 0.5, 8, { v: 0.18, wet: 1 }); }); },
  get volume() { return level; },
  set volume(v) { level = vol = v; if (master) master.gain.setTargetAtTime(v, ctx.currentTime, 0.02); try { localStorage.setItem(key, v); } catch { /* stockage bloqué */ } },
};
