// Little District : ambiance sonore synthétisée (aucun fichier). Musique douce, pluie, rumeur de la rue, cuisine, grillons, tonnerre.
let ctx = null, music, sfx, noise, amb = {};
const vol = { music: 0.5, sfx: 0.7 };
// Gamme pentatonique (ré, mi, sol, la, si) et accords qui tournent lentement
const SCALE = [62, 64, 67, 69, 71, 74, 76, 79, 81];
const CHORDS = [[50, 57, 62, 66, 69], [47, 54, 59, 62, 66], [43, 50, 55, 59, 62], [45, 52, 57, 61, 64]];
const hz = m => 440 * 2 ** ((m - 69) / 12);

export function startAudio() {
  if (ctx) { ctx.resume(); return; }
  ctx = new (window.AudioContext || window.webkitAudioContext)();
  const master = ctx.createDynamicsCompressor();
  master.connect(ctx.destination);
  music = ctx.createGain(); sfx = ctx.createGain();
  music.connect(master); sfx.connect(master);
  setVolumes(vol);
  // écho doux pour les notes pincées
  const delay = ctx.createDelay(), fb = ctx.createGain(), wet = ctx.createGain();
  delay.delayTime.value = 0.42; fb.gain.value = 0.35; wet.gain.value = 0.3;
  delay.connect(fb).connect(delay); delay.connect(wet).connect(music);
  music.echo = delay;
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
  if (state.cricket && state.night > 0.6 && Math.random() < 0.35) { for (let i = 0; i < 4; i++) tone('sine', 4600 + Math.random() * 200, t + i * 0.06, 0.04, 0.006); }
}

export function thunder() {
  if (!ctx) return;
  const t = ctx.currentTime + 0.6 + Math.random() * 1.5;
  burst(t, 3.5, 120, 0.5, 'lowpass', 0.5);
  burst(t + 0.1, 1.2, 300, 0.18, 'lowpass', 0.5);
}

// Musique : nappes lentes et quelques notes de koto ; plus calme la nuit.
let nextBar = 0, bar = 0;
function scheduleMusic() {
  const loop = () => {
    if (ctx.state === 'running' && vol.music > 0) while (nextBar < ctx.currentTime + 1) {
      const t = Math.max(nextBar, ctx.currentTime + 0.05), chord = CHORDS[bar % CHORDS.length], len = 8;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900 - state.night * 400; lp.connect(music);
      for (const n of chord.slice(0, 4)) for (const det of [-4, 4]) {
        const { o, e } = tone('triangle', hz(n), t, len + 2, 0.022, lp, 2.5);
        o.detune.value = det;
        e.gain.cancelScheduledValues(t); e.gain.setValueAtTime(0, t); e.gain.linearRampToValueAtTime(0.022, t + 2.5); e.gain.setValueAtTime(0.022, t + len - 1); e.gain.linearRampToValueAtTime(0, t + len + 2);
      }
      const notes = state.night > 0.5 ? 3 : 6;
      for (let i = 0; i < notes; i++) if (Math.random() < 0.7) {
        const nt = t + (i * len) / notes + Math.random() * 0.3, f = hz(SCALE[Math.floor(Math.random() * SCALE.length)] - (state.night > 0.5 ? 12 : 0));
        const { o } = tone('triangle', f, nt, 1.6, 0.05, music);
        o.connect(music.echo);
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
}
