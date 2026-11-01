// Little District : ambiance sonore synthétisée (aucun fichier). Musique douce, pluie, rumeur de la rue, cuisine, grillons, tonnerre.
let ctx = null, music, sfx, noise, amb = {};
const vol = { music: 0.5, sfx: 0.7 };
// Grille lo-fi en do majeur : Fa maj7, Mi m7, Ré m9, Do maj9 (une mesure chacun). bass : la note grave.
const CHORDS = [
  { bass: 41, notes: [53, 57, 60, 64], tones: [69, 72, 76, 77] },
  { bass: 40, notes: [52, 55, 59, 62], tones: [67, 71, 74, 76] },
  { bass: 38, notes: [50, 53, 57, 60, 64], tones: [69, 72, 74, 77] },
  { bass: 36, notes: [48, 52, 55, 59, 62], tones: [67, 72, 74, 76] },
];
const BEAT = 60 / 66; // tempo lent
const hz = m => 440 * 2 ** ((m - 69) / 12);

export function startAudio() {
  if (ctx) { ctx.resume(); return; }
  ctx = new (window.AudioContext || window.webkitAudioContext)();
  const master = ctx.createDynamicsCompressor();
  master.connect(ctx.destination);
  music = ctx.createGain(); sfx = ctx.createGain();
  music.connect(master); sfx.connect(master);
  setVolumes(vol);
  // Musique : filtre chaud + réverbération douce (réponse impulsionnelle générée)
  const warm = ctx.createBiquadFilter(); warm.type = 'lowpass'; warm.frequency.value = 2000; warm.Q.value = 0.3;
  const verb = ctx.createConvolver(), ir = ctx.createBuffer(2, ctx.sampleRate * 3, ctx.sampleRate);
  for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length) ** 3; }
  verb.buffer = ir;
  const wet = ctx.createGain(); wet.gain.value = 0.45;
  warm.connect(music); warm.connect(verb).connect(wet).connect(music);
  music.input = warm; music.warm = warm;
  const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  noise = buf;
  const loop = (filters, g = 0) => {
    const src = ctx.createBufferSource(); src.buffer = noise; src.loop = true;
    let node = src;
    for (const [type, f, q = 0.7] of filters) { const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; node.connect(b); node = b; }
    const gain = ctx.createGain(); gain.gain.value = g; node.connect(gain).connect(sfx);
    src.start(0, Math.random() * 2);
    return gain;
  };
  amb.rain = loop([['highpass', 900], ['lowpass', 7000]]);
  amb.roof = loop([['bandpass', 2400, 1.5]]);
  amb.street = loop([['bandpass', 380, 0.9]]);
  amb.wind = loop([['lowpass', 320]]);
  scheduleMusic();
  setInterval(sprinkle, 400);
}
export function setVolumes(v) {
  Object.assign(vol, v);
  if (!ctx) return;
  music.gain.setTargetAtTime(vol.music * 0.5, ctx.currentTime, 0.2);
  sfx.gain.setTargetAtTime(vol.sfx, ctx.currentTime, 0.2);
}

// Ce qui se passe dans le quartier : intensités 0..1
let state = { rain: 0, crowd: 0.3, night: 0, cricket: false, wind: 0, kitchen: 0.5 };
export function setAmbience(s) {
  state = { ...state, ...s };
  if (!ctx) return;
  const t = ctx.currentTime;
  amb.rain.gain.setTargetAtTime(state.rain * 0.16, t, 1);
  amb.roof.gain.setTargetAtTime(state.rain * 0.05, t, 1);
  amb.street.gain.setTargetAtTime(0.012 + state.crowd * 0.05 * (1 - state.night * 0.6), t, 1.5);
  amb.wind.gain.setTargetAtTime(state.wind * 0.12, t, 2);
}

function tone(type, f, t, dur, g, dest = sfx, attack = 0.005) {
  const o = ctx.createOscillator(), e = ctx.createGain();
  o.type = type; o.frequency.value = f;
  e.gain.setValueAtTime(0, t); e.gain.linearRampToValueAtTime(g, t + attack); e.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(e).connect(dest); o.start(t); o.stop(t + dur + 0.05);
  return { o, e };
}
function burst(t, dur, f, g, type = 'bandpass', q = 1) {
  const src = ctx.createBufferSource(), b = ctx.createBiquadFilter(), e = ctx.createGain();
  src.buffer = noise; b.type = type; b.frequency.value = f; b.Q.value = q;
  e.gain.setValueAtTime(g, t); e.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(b).connect(e).connect(sfx); src.start(t, Math.random()); src.stop(t + dur + 0.05);
}

// Petits bruits du quartier, au hasard : vaisselle, carillon de porte, grillons la nuit.
function sprinkle() {
  if (!ctx || ctx.state !== 'running') return;
  const t = ctx.currentTime + Math.random() * 0.3;
  if (Math.random() < 0.18 * state.kitchen) { for (let i = 0; i < 1 + Math.random() * 3; i++) tone('sine', 2200 + Math.random() * 1800, t + i * 0.07, 0.25, 0.012); }
  if (Math.random() < 0.025 * state.crowd) { tone('sine', 1318, t, 0.9, 0.018); tone('sine', 1046, t + 0.18, 1.2, 0.018); }
  if (state.night < 0.3 && state.rain < 0.2 && Math.random() < 0.05) { const n = 2 + Math.floor(Math.random() * 3); for (let i = 0; i < n; i++) { const o = tone('sine', 3000, t + i * 0.11, 0.07, 0.006).o; o.frequency.setValueAtTime(2800 + Math.random() * 1200, t + i * 0.11); o.frequency.linearRampToValueAtTime(3800 + Math.random() * 800, t + i * 0.11 + 0.06); } }
  if (state.cricket && state.night > 0.6 && Math.random() < 0.35) { for (let i = 0; i < 4; i++) tone('sine', 4600 + Math.random() * 200, t + i * 0.06, 0.04, 0.006); }
}

export function thunder() {
  if (!ctx) return;
  const t = ctx.currentTime + 0.6 + Math.random() * 1.5;
  burst(t, 3.5, 120, 0.5, 'lowpass', 0.5);
  burst(t + 0.1, 1.2, 300, 0.18, 'lowpass', 0.5);
}

// Musique : piano électrique feutré, basse ronde, quelques notes de mélodie sur les accords. Plus rare et plus grave la nuit.
function epiano(m, t, dur, g) {
  const f = hz(m), e = ctx.createGain();
  e.gain.setValueAtTime(0, t);
  e.gain.linearRampToValueAtTime(g, t + 0.02);
  e.gain.exponentialRampToValueAtTime(g * 0.35, t + 0.9);
  e.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  e.connect(music.input);
  for (const [mul, k] of [[1, 1], [2, 0.12], [3, 0.03]]) { // fondamentale + harmoniques légères : son de Rhodes doux
    const o = ctx.createOscillator(), og = ctx.createGain();
    o.type = 'sine'; o.frequency.value = f * mul; o.detune.value = (Math.random() - 0.5) * 6;
    og.gain.value = k; o.connect(og).connect(e); o.start(t); o.stop(t + dur + 0.05);
  }
}
function bassNote(m, t, dur, g) {
  const o = ctx.createOscillator(), e = ctx.createGain();
  o.type = 'sine'; o.frequency.value = hz(m);
  e.gain.setValueAtTime(0, t); e.gain.linearRampToValueAtTime(g, t + 0.08); e.gain.setValueAtTime(g, t + dur * 0.6); e.gain.linearRampToValueAtTime(0, t + dur);
  o.connect(e).connect(music.input); o.start(t); o.stop(t + dur + 0.05);
}
let nextBar = 0, bar = 0;
function scheduleMusic() {
  const loop = () => {
    if (ctx.state === 'running' && vol.music > 0) while (nextBar < ctx.currentTime + 1.5) {
      const t = Math.max(nextBar, ctx.currentTime + 0.05), c = CHORDS[bar % CHORDS.length], len = BEAT * 4, night = state.night > 0.5;
      music.warm.frequency.setTargetAtTime(night ? 1300 : 2000, t, 2);
      // accord égrené doucement, puis rejoué plus bas sur le temps 3
      c.notes.forEach((n, i) => epiano(n, t + i * 0.035, len * 0.95, 0.05));
      if (Math.random() < 0.7) c.notes.slice(1).forEach((n, i) => epiano(n, t + BEAT * 2.5 + i * 0.03, len * 0.5, 0.025));
      bassNote(c.bass, t, BEAT * 2.2, 0.09);
      bassNote(c.bass + (Math.random() < 0.5 ? 7 : 12), t + BEAT * 2.5, BEAT * 1.4, 0.06);
      // mélodie : une petite phrase une mesure sur deux, sur les notes de l'accord
      if (bar % 2 === 0 || Math.random() < 0.3) {
        let beat = Math.random() < 0.5 ? 0.5 : 1;
        for (let k = 0; k < (night ? 2 : 3) && beat < 4; k++) {
          epiano(c.tones[Math.floor(Math.random() * c.tones.length)] - (night ? 12 : 0), t + beat * BEAT, BEAT * 2.5, 0.035);
          beat += [0.5, 1, 1, 1.5][Math.floor(Math.random() * 4)];
        }
      }
      nextBar = t + len; bar++;
    }
    setTimeout(loop, 500);
  };
  nextBar = ctx.currentTime + 0.5;
  loop();
}

// Sons d'interface
export function sound(name) {
  if (!ctx || ctx.state !== 'running') return;
  const t = ctx.currentTime;
  if (name === 'click') tone('sine', 880, t, 0.08, 0.04);
  if (name === 'coin') { tone('sine', 1568, t, 0.25, 0.025); tone('sine', 2093, t + 0.06, 0.3, 0.02); }
  if (name === 'build') { burst(t, 0.15, 300, 0.25); burst(t + 0.18, 0.15, 260, 0.22); [62, 67, 71, 74].forEach((n, i) => tone('triangle', hz(n + 12), t + 0.35 + i * 0.09, 0.6, 0.06)); }
  if (name === 'upgrade') [64, 67, 71, 76, 79].forEach((n, i) => tone('triangle', hz(n + 12), t + i * 0.07, 0.7, 0.05));
  if (name === 'place') { burst(t, 0.12, 500, 0.18); tone('sine', 660, t + 0.02, 0.15, 0.03); }
  if (name === 'goal') [67, 71, 74, 79, 83].forEach((n, i) => tone('sine', hz(n + 12), t + i * 0.1, 1, 0.05));
  if (name === 'error') tone('sine', 220, t, 0.18, 0.05);
  if (name === 'meow') { const o = ctx.createOscillator(), e = ctx.createGain(), f = ctx.createBiquadFilter(); o.type = 'sawtooth'; f.type = 'bandpass'; f.frequency.value = 1400; f.Q.value = 3; o.frequency.setValueAtTime(520, t); o.frequency.linearRampToValueAtTime(780, t + 0.15); o.frequency.linearRampToValueAtTime(480, t + 0.5); e.gain.setValueAtTime(0, t); e.gain.linearRampToValueAtTime(0.05, t + 0.05); e.gain.exponentialRampToValueAtTime(0.0001, t + 0.6); o.connect(f).connect(e).connect(sfx); o.start(t); o.stop(t + 0.65); }
  if (name === 'firework') { burst(t + 0.25, 1.4, 160, 0.16, 'lowpass', 0.6); for (let i = 0; i < 6; i++) burst(t + 0.4 + Math.random() * 0.6, 0.06, 3000, 0.02); }
  if (name === 'vendor') [72, 76, 79, 76, 72].forEach((n, i) => tone('sine', hz(n), t + i * 0.32, 0.6, 0.02));
  if (name === 'golden') [76, 79, 83, 88, 91].forEach((n, i) => tone('sine', hz(n), t + i * 0.06, 0.9, 0.035));
  if (name === 'flap') for (let i = 0; i < 8; i++) burst(t + i * 0.05, 0.05, 900, 0.03);
  if (name === 'chirp') for (let i = 0; i < 3; i++) { const o = tone('sine', 3200, t + i * 0.12, 0.08, 0.012).o; o.frequency.setValueAtTime(3600, t + i * 0.12); o.frequency.linearRampToValueAtTime(2600, t + i * 0.12 + 0.08); }
}
