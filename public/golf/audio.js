// Mini-golf : sons, public, musique et ambiance par thème, tout synthétisé (aucun fichier à télécharger).
const store = {
  get: k => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* stockage bloqué */ } },
};
export const settings = { sound: store.get('golf-sound') !== '0', music: store.get('golf-music') !== '0' };
let ac = null, master = null, musicBus = null, ambBus = null;

export function startAudio() {
  if (ac) return void ac.resume();
  ac = new (window.AudioContext || window.webkitAudioContext)();
  master = ac.createGain(); master.gain.value = settings.sound ? 0.9 : 0; master.connect(ac.destination);
  musicBus = ac.createGain(); musicBus.gain.value = settings.music ? 0.16 : 0; musicBus.connect(ac.destination);
  ambBus = ac.createGain(); ambBus.gain.value = settings.sound ? 0.5 : 0; ambBus.connect(ac.destination);
}
export function setAudio(key, on) {
  settings[key] = on;
  store.set(`golf-${key}`, on ? '1' : '0');
  if (!ac) return;
  if (key === 'sound') { master.gain.value = on ? 0.9 : 0; ambBus.gain.value = on ? 0.5 : 0; }
  if (key === 'music') musicBus.gain.value = on ? 0.16 : 0;
}

function tone(freq, dur, { type = 'sine', vol = 0.1, delay = 0, slide = 0, bus = master, attack = 0.005 } = {}) {
  if (!ac) return;
  const t = ac.currentTime + delay, o = ac.createOscillator(), g = ac.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(vol, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(bus);
  o.start(t);
  o.stop(t + dur + 0.05);
}
let noiseBuf = null;
function noise(dur, { vol = 0.2, freq = 1200, type = 'lowpass', delay = 0, q = 1, bus = master, sweep = 0 } = {}) {
  if (!ac) return;
  noiseBuf ??= (() => { const b = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; return b; })();
  const t = ac.currentTime + delay, src = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
  src.buffer = noiseBuf; f.type = type; f.Q.value = q;
  f.frequency.setValueAtTime(freq, t);
  if (sweep) f.frequency.exponentialRampToValueAtTime(sweep, t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(bus);
  src.start(t, Math.random());
  src.stop(t + dur + 0.05);
}

export const sfx = {
  hit: p => { tone(260 - p * 60, 0.09, { type: 'triangle', vol: 0.22 + p * 0.15, slide: 110 }); noise(0.05, { vol: 0.12 + p * 0.2, freq: 3000, type: 'bandpass' }); },
  clack: () => { tone(2400, 0.05, { vol: 0.12 }); tone(1700, 0.07, { vol: 0.08, type: 'triangle' }); },
  bump: () => tone(330, 0.05, { type: 'square', vol: 0.04, slide: 200 }),
  bump2: () => { tone(170, 0.1, { type: 'square', vol: 0.06, slide: 90 }); noise(0.07, { vol: 0.2, freq: 1500 }); },
  kick: () => { tone(880, 0.12, { type: 'square', vol: 0.06 }); tone(1320, 0.15, { vol: 0.06, delay: 0.04 }); },
  water: theme => {
    if (theme === 'volcano') { noise(0.8, { vol: 0.35, freq: 4000, type: 'highpass', sweep: 800 }); tone(90, 0.6, { type: 'sawtooth', vol: 0.05 }); return; }
    if (theme === 'space') { tone(600, 0.9, { vol: 0.12, slide: 60 }); noise(0.9, { vol: 0.15, freq: 600, sweep: 100 }); return; }
    noise(0.55, { vol: 0.4, freq: 1400, sweep: 300 }); tone(520, 0.25, { vol: 0.08, slide: 160 }); tone(900, 0.12, { vol: 0.05, delay: 0.1, slide: 1400 });
  },
  holed: () => { [0, 0.06, 0.11, 0.15].forEach((d, i) => tone(1100 - i * 120, 0.05, { type: 'triangle', vol: 0.09, delay: d })); [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.3, { type: 'triangle', vol: 0.08, delay: 0.28 + i * 0.09 })); },
  bonus: () => [784, 988, 1175, 1568, 1976].forEach((f, i) => tone(f, 0.35, { type: 'triangle', vol: 0.08, delay: i * 0.07 })),
  tp: () => { tone(300, 0.4, { vol: 0.1, slide: 1800 }); tone(450, 0.4, { vol: 0.05, slide: 2400, type: 'triangle' }); },
  pipe: () => { tone(200, 0.12, { type: 'square', vol: 0.05, slide: 600 }); tone(600, 0.12, { type: 'square', vol: 0.05, delay: 0.25, slide: 200 }); },
  spring: () => tone(150, 0.35, { type: 'triangle', vol: 0.14, slide: 700 }),
  jump: () => tone(300, 0.25, { vol: 0.08, slide: 900 }),
  land: () => { noise(0.08, { vol: 0.2, freq: 600 }); tone(140, 0.1, { type: 'triangle', vol: 0.1 }); },
  plate: () => { tone(220, 0.1, { type: 'square', vol: 0.05 }); noise(0.6, { vol: 0.12, freq: 300, delay: 0.1 }); tone(110, 0.6, { type: 'sawtooth', vol: 0.03, delay: 0.1 }); },
  turn: () => [660, 880, 1100].forEach((f, i) => tone(f, 0.18, { vol: 0.06, delay: i * 0.1 })),
  click: () => tone(1300, 0.03, { vol: 0.04 }),
  coin: () => { tone(988, 0.08, { type: 'square', vol: 0.04 }); tone(1319, 0.25, { type: 'square', vol: 0.04, delay: 0.08 }); },
  pop: () => tone(500, 0.08, { vol: 0.08, slide: 1000 }),
  gong: () => { tone(110, 1.6, { vol: 0.15, type: 'triangle' }); tone(165, 1.4, { vol: 0.06 }); },
  fanfare: () => [[523, 0], [659, 0.15], [784, 0.3], [1047, 0.45], [784, 0.65], [1047, 0.8]].forEach(([f, d]) => { tone(f, 0.4, { type: 'sawtooth', vol: 0.04, delay: d }); tone(f / 2, 0.4, { type: 'triangle', vol: 0.05, delay: d }); }),
  // Le public : applaudissements (beaucoup de petits claquements) et « oooh » déçu
  applause: (n = 1) => { for (let i = 0; i < 40 * n; i++) noise(0.03, { vol: 0.12 + Math.random() * 0.1, freq: 1500 + Math.random() * 2500, type: 'bandpass', q: 2, delay: Math.random() * 1.6 * n }); },
  ooh: () => {
    for (const [f, v] of [[220, 0.05], [277, 0.04], [330, 0.03], [196, 0.04]]) {
      if (!ac) return;
      const t = ac.currentTime, o = ac.createOscillator(), g = ac.createGain(), fl = ac.createBiquadFilter(), lfo = ac.createOscillator(), lg = ac.createGain();
      o.type = 'sawtooth'; o.frequency.setValueAtTime(f * 1.15, t); o.frequency.exponentialRampToValueAtTime(f * 0.8, t + 1.1);
      fl.type = 'bandpass'; fl.frequency.value = 700; fl.Q.value = 3;
      lfo.frequency.value = 5 + Math.random() * 2; lg.gain.value = 6; lfo.connect(lg).connect(o.frequency);
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + 0.15); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.2);
      o.connect(fl).connect(g).connect(master); o.start(t); lfo.start(t); o.stop(t + 1.3); lfo.stop(t + 1.3);
    }
  },
};

/* ---------- Musique et ambiance : une petite boucle par thème ---------- */
const MOODS = {
  classic: { bpm: 96, scale: [0, 2, 4, 7, 9], root: 60, chords: [[0, 4, 7], [5, 9, 12], [7, 11, 14], [5, 9, 12]], wave: 'triangle', amb: 'birds' },
  tropical: { bpm: 104, scale: [0, 2, 4, 7, 9], root: 62, chords: [[0, 4, 7], [7, 11, 14], [9, 12, 16], [5, 9, 12]], wave: 'triangle', amb: 'waves' },
  space: { bpm: 72, scale: [0, 3, 5, 7, 10], root: 57, chords: [[0, 3, 7], [8, 12, 15], [5, 8, 12], [7, 10, 14]], wave: 'sine', amb: 'hum' },
  volcano: { bpm: 84, scale: [0, 1, 4, 5, 7, 8], root: 52, chords: [[0, 3, 7], [1, 5, 8], [0, 3, 7], [-2, 2, 5]], wave: 'sawtooth', amb: 'rumble' },
  candy: { bpm: 120, scale: [0, 2, 4, 5, 7, 9, 11], root: 67, chords: [[0, 4, 7], [9, 12, 16], [5, 9, 12], [7, 11, 14]], wave: 'square', amb: null },
  haunted: { bpm: 70, scale: [0, 2, 3, 6, 7, 8, 11], root: 55, chords: [[0, 3, 7], [8, 11, 15], [6, 9, 12], [7, 11, 14]], wave: 'sine', amb: 'wind' },
  ice: { bpm: 80, scale: [0, 2, 4, 7, 9], root: 69, chords: [[0, 4, 7], [-3, 0, 4], [5, 9, 12], [7, 11, 14]], wave: 'sine', amb: 'wind' },
  fair: { bpm: 132, scale: [0, 2, 4, 5, 7, 9], root: 65, chords: [[0, 4, 7], [7, 11, 14], [0, 4, 7], [5, 9, 12]], wave: 'square', amb: null },
  sea: { bpm: 78, scale: [0, 2, 4, 7, 9], root: 58, chords: [[0, 4, 7, 11], [5, 9, 12, 16], [2, 5, 9, 12], [7, 11, 14, 17]], wave: 'sine', amb: 'bubbles' },
  jungle: { bpm: 100, scale: [0, 3, 5, 7, 10], root: 57, chords: [[0, 3, 7], [5, 8, 12], [3, 7, 10], [7, 10, 14]], wave: 'triangle', amb: 'birds' },
};
const midi = n => 440 * 2 ** ((n - 69) / 12);
let mood = null, timer = null, step = 0;
export function setMood(theme) {
  if (mood === theme) return;
  mood = theme;
  step = 0;
  clearInterval(timer);
  if (!theme) return;
  const m = MOODS[theme] ?? MOODS.classic, beat = 60 / m.bpm / 2;
  timer = setInterval(() => {
    if (!ac || document.hidden) return;
    const bar = Math.floor(step / 8) % m.chords.length, ch = m.chords[bar], s = step % 8;
    if (settings.music) {
      if (s === 0) for (const n of ch) tone(midi(m.root - 12 + n), beat * 7.5, { type: 'sine', vol: 0.05, bus: musicBus, attack: 0.08 });
      if (s % 4 === 0) tone(midi(m.root - 24 + ch[0]), beat * 1.8, { type: 'triangle', vol: 0.12, bus: musicBus });
      if (Math.random() < 0.55) { const n = m.scale[Math.floor(Math.random() * m.scale.length)]; tone(midi(m.root + n + (Math.random() < 0.3 ? 12 : 0)), beat * 1.5, { type: m.wave, vol: m.wave === 'square' || m.wave === 'sawtooth' ? 0.025 : 0.06, bus: musicBus }); }
      if (theme === 'fair' || theme === 'candy') if (s % 2 === 1) noise(0.03, { vol: 0.05, freq: 7000, type: 'highpass', bus: musicBus });
    }
    if (settings.sound && s === 0) ambience(m.amb, beat * 8);
    step++;
  }, beat * 1000);
}
function ambience(kind, dur) {
  if (kind === 'waves') noise(dur, { vol: 0.25, freq: 500, sweep: 1200, bus: ambBus });
  if (kind === 'wind') noise(dur, { vol: 0.2, freq: 400, type: 'bandpass', q: 4, sweep: 900, bus: ambBus });
  if (kind === 'rumble') noise(dur, { vol: 0.35, freq: 120, bus: ambBus });
  if (kind === 'hum') tone(55, dur, { vol: 0.05, bus: ambBus, attack: 0.5 });
  if (kind === 'bubbles') for (let i = 0; i < 4; i++) tone(400 + Math.random() * 500, 0.08, { vol: 0.05, delay: Math.random() * dur, slide: 1200, bus: ambBus });
  if (kind === 'birds') for (let i = 0; i < 2; i++) { const d = Math.random() * dur, f = 2200 + Math.random() * 1500; tone(f, 0.08, { vol: 0.03, delay: d, slide: f * 1.4, bus: ambBus }); tone(f, 0.08, { vol: 0.03, delay: d + 0.12, slide: f * 1.3, bus: ambBus }); }
}
