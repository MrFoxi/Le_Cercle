// Sons du flipper, tous synthétisés (aucun fichier) : mécanique, bumpers, rampes, roulement, musique d'arcade.
let ac, master, sfxGain, musicGain, rollGain, rollFilter;
export const volume = { sfx: 0.8, music: 0.45 };

export function startAudio() {
  if (ac) return ac.resume();
  ac = new (window.AudioContext || window.webkitAudioContext)();
  master = ac.createGain();
  master.connect(ac.destination);
  sfxGain = ac.createGain();
  musicGain = ac.createGain();
  sfxGain.connect(master);
  musicGain.connect(master);
  setVolume();
  // Roulement de la bille : bruit filtré permanent, dont le volume suit la vitesse.
  const buf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const src = ac.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  rollFilter = ac.createBiquadFilter();
  rollFilter.type = 'bandpass';
  rollFilter.frequency.value = 300;
  rollFilter.Q.value = 0.8;
  rollGain = ac.createGain();
  rollGain.gain.value = 0;
  src.connect(rollFilter).connect(rollGain).connect(sfxGain);
  src.start();
}
export function setVolume() {
  if (!ac) return;
  sfxGain.gain.value = volume.sfx;
  musicGain.gain.value = volume.music * 0.5;
}

function tone(freq, dur, { type = 'sine', vol = 0.2, slide = 0, delay = 0, out = sfxGain } = {}) {
  if (!ac) return;
  const t = ac.currentTime + delay, o = ac.createOscillator(), g = ac.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g).connect(out);
  o.start(t);
  o.stop(t + dur + 0.02);
}
function noise(dur, { vol = 0.2, freq = 1500, type = 'bandpass', q = 1, delay = 0, slide } = {}) {
  if (!ac) return;
  const t = ac.currentTime + delay, n = Math.ceil(ac.sampleRate * dur), buf = ac.createBuffer(1, n, ac.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const src = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
  src.buffer = buf;
  f.type = type;
  f.frequency.setValueAtTime(freq, t);
  if (slide) f.frequency.exponentialRampToValueAtTime(slide, t + dur);
  f.Q.value = q;
  g.gain.value = vol;
  src.connect(f).connect(g).connect(sfxGain);
  src.start(t);
}
const arp = (notes, step = 0.07, opts = {}) => notes.forEach((f, i) => tone(f, 0.25, { type: 'square', vol: 0.07, delay: i * step, ...opts }));

// Un son par effet de jeu (mêmes noms que les effets visuels).
export function play(fx) {
  if (!ac) return;
  switch (fx.kind) {
    case 'flip': noise(0.07, { vol: 0.35, freq: 900, q: 2 }); tone(110, 0.08, { vol: 0.25, slide: 60 }); break;
    case 'bumper': tone(190, 0.18, { type: 'triangle', vol: 0.45, slide: 70 }); noise(0.12, { vol: 0.3, freq: 2400, q: 1.5 }); tone(880, 0.06, { type: 'square', vol: 0.05, delay: 0.02 }); break;
    case 'sling': noise(0.08, { vol: 0.4, freq: 1700, q: 3 }); tone(300, 0.07, { type: 'square', vol: 0.08, slide: 150 }); break;
    case 'target': tone(1320, 0.12, { type: 'triangle', vol: 0.18 }); noise(0.05, { vol: 0.2, freq: 3000 }); break;
    case 'drop': tone(140, 0.15, { vol: 0.35, slide: 70 }); noise(0.1, { vol: 0.25, freq: 600, type: 'lowpass' }); break;
    case 'rollover': tone(660 + Math.random() * 200, 0.15, { type: 'triangle', vol: 0.12 }); break;
    case 'spinner': for (let i = 0; i < Math.min(fx.turns, 16); i++) noise(0.025, { vol: 0.18, freq: 3500, delay: i * 0.05 * (1 + i * 0.08) }); break;
    case 'rampIn': noise(0.6, { vol: 0.15, freq: 400, slide: 1800, q: 2 }); break;
    case 'ramp': arp([523, 659, 784, 1047]); break;
    case 'rampFail': tone(400, 0.3, { type: 'sawtooth', vol: 0.06, slide: 120 }); break;
    case 'orbit': arp([392, 523, 659], 0.06); break;
    case 'saucer': tone(90, 0.3, { vol: 0.4, slide: 45 }); noise(0.2, { vol: 0.25, freq: 300, type: 'lowpass' }); break;
    case 'launch': noise(0.25, { vol: 0.3 + fx.power * 0.3, freq: 500, slide: 2500, q: 1.5 }); tone(70, 0.2, { vol: 0.3 }); break;
    case 'spark': if (fx.speed > 140) noise(0.04, { vol: Math.min(0.3, fx.speed / 1200), freq: fx.metal ? 4200 : 1800, q: 4 }); break;
    case 'thud': tone(80, 0.12, { vol: 0.3, slide: 50 }); break;
    case 'drain': tone(330, 0.5, { type: 'sawtooth', vol: 0.09, slide: 80 }); tone(220, 0.6, { type: 'square', vol: 0.05, slide: 55, delay: 0.1 }); break;
    case 'mission': arp([523, 659, 784, 1047, 1319], 0.08, { vol: 0.09 }); break;
    case 'multiball': arp([392, 494, 587, 784, 587, 784, 988, 1175], 0.09, { vol: 0.1 }); break;
    case 'jackpot': arp([523, 659, 784, 1047, 784, 1047, 1319, 1568, 2093], 0.08, { vol: 0.12 }); noise(1.2, { vol: 0.15, freq: 6000, slide: 800 }); break;
    case 'shake': tone(55, 0.15, { vol: 0.35 }); break;
    case 'tilt': tone(110, 0.8, { type: 'sawtooth', vol: 0.15 }); tone(116, 0.8, { type: 'sawtooth', vol: 0.15 }); break;
    case 'portal': tone(300, 0.4, { type: 'sine', vol: 0.15, slide: 1800 }); tone(1200, 0.3, { type: 'triangle', vol: 0.06, slide: 300, delay: 0.15 }); break;
    case 'jet': noise(0.5, { vol: 0.3, freq: 3000, type: 'highpass', slide: 1200 }); break;
    case 'burn': noise(0.35, { vol: 0.22, freq: 5000, type: 'highpass' }); tone(90, 0.2, { vol: 0.15, slide: 60 }); break;
    case 'mover': tone(260, 0.12, { type: 'square', vol: 0.06, slide: 520 }); noise(0.1, { vol: 0.2, freq: 1200 }); break;
    case 'trap': tone(400, 0.6, { type: 'sawtooth', vol: 0.1, slide: 70 }); noise(0.4, { vol: 0.2, freq: 300, type: 'lowpass' }); break;
    case 'slot': for (let i = 0; i < 10; i++) tone(700 + (i % 3) * 140, 0.04, { type: 'square', vol: 0.05, delay: i * 0.06 }); break;
    case 'roulette': for (let i = 0; i < 16; i++) noise(0.02, { vol: 0.2, freq: 4000, delay: i * 0.05 * (1 + i * 0.12) }); break;
    case 'secret': arp([392, 466, 587, 698, 932], 0.1, { type: 'triangle', vol: 0.09 }); break;
    case 'gameover': arp([523, 494, 440, 392, 349, 330], 0.14, { vol: 0.08 }); break;
    default:
  }
}

// Volume du roulement selon la vitesse de la bille la plus rapide sur la table.
export function rolling(speed) {
  if (!ac) return;
  const t = ac.currentTime;
  rollGain.gain.setTargetAtTime(Math.min(0.18, speed / 2400), t, 0.05);
  rollFilter.frequency.setTargetAtTime(180 + speed * 1.4, t, 0.05);
}

// Musique de chaque table : basse, accords en arpège et percussions, programmés un peu à l'avance.
const THEMES = {
  arcade: { step: 0.16, bass: [110, 110, 146.8, 130.8], chords: [[440, 523, 659], [440, 523, 659], [587, 698, 880], [523, 659, 784]], bassType: 'triangle', lead: 'square', leadVol: 0.035, kick: [0, 4] },
  space: { step: 0.22, bass: [55, 43.65, 65.4, 49], chords: [[440, 523, 659], [349, 440, 523], [523, 659, 784], [392, 494, 587]], bassType: 'sine', lead: 'triangle', leadVol: 0.05, kick: [0], echo: true },
  casino: { step: 0.19, bass: [65.4, 73.4, 82.4, 98], chords: [[523, 659, 784, 988], [587, 698, 880, 1047], [659, 784, 988, 1175], [784, 988, 1175, 1319]], bassType: 'triangle', lead: 'sine', leadVol: 0.05, kick: [0, 3, 6], swing: true },
  jungle: { step: 0.15, bass: [98, 98, 110, 87.3], chords: [[392, 440, 587], [392, 523, 587], [440, 523, 659], [349, 440, 523]], bassType: 'sine', lead: 'sine', leadVol: 0.07, kick: [0, 3, 5, 6], tom: true },
  volcan: { step: 0.14, bass: [82.4, 82.4, 98, 73.4], chords: [[330, 494, 659], [330, 494, 659], [392, 587, 784], [294, 440, 587]], bassType: 'sawtooth', lead: 'sawtooth', leadVol: 0.025, kick: [0, 2, 4, 6] },
};
let musicTimer = null, beat = 0;
export function music(on, theme = 'arcade') {
  if (!ac) return;
  clearInterval(musicTimer);
  musicTimer = null;
  if (!on) return;
  const T = THEMES[theme] || THEMES.arcade;
  let next = ac.currentTime + 0.1;
  musicTimer = setInterval(() => {
    while (next < ac.currentTime + 0.3) {
      const bar = Math.floor(beat / 8) % 4, i = beat % 8, d = next - ac.currentTime;
      tone(T.bass[bar] * (i % 2 ? 2 : 1), T.step * 1.4, { type: T.bassType, vol: T.bassType === 'sawtooth' ? 0.08 : 0.16, delay: d, out: musicGain });
      if (i % 2 === 0) {
        const note = T.chords[bar][(i / 2) % T.chords[bar].length] * 2;
        tone(note, T.step * 0.8, { type: T.lead, vol: T.leadVol, delay: d, out: musicGain });
        if (T.echo) tone(note, T.step * 1.6, { type: 'sine', vol: T.leadVol * 0.4, delay: d + T.step * 1.5, out: musicGain });
      }
      if (T.kick.includes(i)) noise(0.05, { vol: 0.06 * volume.music, freq: 120, type: 'lowpass', delay: d });
      if (T.tom && i % 4 === 2) tone(180, 0.12, { vol: 0.08 * volume.music, slide: 90, delay: d });
      next += T.swing && i % 2 ? T.step * 0.7 : T.swing ? T.step * 1.3 : T.step;
      beat++;
    }
  }, 100);
}
