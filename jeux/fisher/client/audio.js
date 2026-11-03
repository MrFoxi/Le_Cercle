// Little Fisher : sons synthétisés. Vagues, vent, pluie et moteur en continu ; mouettes, pêche et musique douce par-dessus.
// Le contexte audio vient de /shared/party.js (créé au premier geste du joueur).
import { audio } from '/shared/party.js';

let ac = null, master = null, music = null, amb = null;
let muted = false;
try { muted = localStorage.getItem('fisher-mute') === '1'; } catch { /* stockage bloqué */ }

function noiseBuffer(sec = 2) {
  const b = ac.createBuffer(1, ac.sampleRate * sec, ac.sampleRate), d = b.getChannelData(0);
  for (let k = 0; k < d.length; k++) d[k] = Math.random() * 2 - 1;
  return b;
}
function loop(type, freq, q = 0.7) {
  const s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
  s.buffer = noiseBuffer(); s.loop = true; f.type = type; f.frequency.value = freq; f.Q.value = q; g.gain.value = 0;
  s.connect(f).connect(g).connect(master); s.start();
  return { f, g };
}
// Une note : attaque douce, longue extinction
function tone(freq, { type = 'sine', vol = 0.1, at = 0, attack = 0.01, dur = 0.3, to = freq, out = master } = {}) {
  if (!ac) return;
  const t = ac.currentTime + at, o = ac.createOscillator(), g = ac.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t); o.frequency.exponentialRampToValueAtTime(to, t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(out); o.start(t); o.stop(t + dur + 0.05);
}
function burst(dur, freq, vol, type = 'lowpass', at = 0) {
  if (!ac) return;
  const t = ac.currentTime + at, s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
  s.buffer = noiseBuffer(dur + 0.1); f.type = type; f.frequency.setValueAtTime(freq, t); f.frequency.exponentialRampToValueAtTime(freq * 0.3, t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f).connect(g).connect(master); s.start(t);
}

// À appeler sur un geste du joueur
export function startAudio() {
  if (ac) { audio(); return; }
  ac = audio(); if (!ac) return;
  master = ac.createGain(); master.gain.value = muted ? 0 : 0.9; master.connect(ac.destination);
  music = ac.createGain(); music.gain.value = 0.55; music.connect(master);
  const engine = ac.createOscillator(), engine2 = ac.createOscillator(), ef = ac.createBiquadFilter(), eg = ac.createGain();
  engine.type = 'sawtooth'; engine2.type = 'square'; engine.frequency.value = 48; engine2.frequency.value = 24; ef.type = 'lowpass'; ef.frequency.value = 260; eg.gain.value = 0;
  engine.connect(ef); engine2.connect(ef); ef.connect(eg).connect(master); engine.start(); engine2.start();
  amb = { waves: loop('lowpass', 420), surf: loop('bandpass', 1400, 0.4), wind: loop('bandpass', 700, 1.2), rain: loop('highpass', 3000), engine, engine2, ef, eg };
}
export const isMuted = () => muted;
export function toggleMute() {
  muted = !muted;
  try { localStorage.setItem('fisher-mute', muted ? '1' : '0'); } catch { /* stockage bloqué */ }
  if (master) master.gain.setTargetAtTime(muted ? 0 : 0.9, ac.currentTime, 0.1);
  return muted;
}

// Ambiance, à chaque image : vitesse et gaz du bateau, météo, nuit
let nextGull = 4, nextNote = 2, nextChord = 0, chordIdx = 0;
const SCALE = [261.6, 293.7, 329.6, 392, 440, 523.3, 587.3, 659.3];      // pentatonique de do
const CHORDS = [[130.8, 196, 329.6], [110, 164.8, 261.6], [146.8, 220, 349.2], [98, 146.8, 246.9]];
export function ambience(dt, { speed, throttle, weather, night, nearLand, docked }) {
  if (!ac || !amb) return;
  const t = ac.currentTime, set = (p, v, k = 0.4) => p.setTargetAtTime(v, t, k);
  const wet = weather === 'pluie' || weather === 'orage', windy = wet || weather === 'nuageux';
  set(amb.waves.g.gain, 0.16 + Math.sin(t * 0.4) * 0.05 + (wet ? 0.08 : 0));
  set(amb.surf.g.gain, nearLand * 0.05 * (0.6 + Math.sin(t * 0.7) * 0.4));
  set(amb.wind.g.gain, 0.015 + (windy ? 0.035 : 0) + speed * 0.0015); set(amb.wind.f.frequency, 600 + speed * 18 + Math.sin(t * 0.3) * 150, 1);
  set(amb.rain.g.gain, wet ? (weather === 'orage' ? 0.1 : 0.06) : 0, 1);
  set(amb.eg.gain, docked ? 0 : 0.035 + Math.abs(throttle) * 0.05, 0.2);
  set(amb.engine.frequency, 44 + speed * 2.4, 0.2); set(amb.engine2.frequency, 22 + speed * 1.2, 0.2); set(amb.ef.frequency, 220 + Math.abs(throttle) * 500, 0.2);
  // mouettes, le jour près des côtes
  if ((nextGull -= dt) < 0) { nextGull = 5 + Math.random() * 10; if (!night && nearLand > 0.2) gull(); }
  // musique : des notes éparses, et un accord tenu de temps en temps
  if ((nextChord -= dt) < 0) {
    nextChord = 9;
    const ch = CHORDS[chordIdx++ % CHORDS.length];
    ch.forEach(f => tone(f, { type: 'sine', vol: 0.028, attack: 2, dur: 8.5, out: music }));
  }
  if ((nextNote -= dt) < 0) {
    nextNote = (night ? 2.4 : 1.4) + Math.random() * 2.2;
    const f = SCALE[Math.floor(Math.random() * SCALE.length)] * (night ? 0.5 : 1);
    tone(f, { type: 'triangle', vol: 0.035, attack: 0.02, dur: 2.2, out: music });
    if (Math.random() < 0.3) tone(f * 1.5, { type: 'sine', vol: 0.02, at: 0.35, dur: 1.8, out: music });
  }
}
export function gull() { const b = 1500 + Math.random() * 500; for (let k = 0; k < 3; k++) tone(b, { type: 'sawtooth', vol: 0.012, at: k * 0.22, dur: 0.18, to: b * 0.6 }); }

export const SFX = {
  cast: () => { burst(0.35, 2500, 0.08, 'bandpass'); tone(900, { vol: 0.03, dur: 0.3, to: 400 }); },
  plop: () => { tone(520, { vol: 0.12, dur: 0.12, to: 180 }); burst(0.2, 900, 0.05, 'lowpass', 0.03); },
  bite: () => { tone(880, { vol: 0.09, dur: 0.15 }); tone(1175, { vol: 0.08, at: 0.1, dur: 0.25 }); burst(0.25, 1200, 0.08, 'lowpass'); },
  click: () => tone(1800, { type: 'square', vol: 0.025, dur: 0.03, to: 1200 }),
  hit: () => { tone(660, { type: 'triangle', vol: 0.09, dur: 0.18 }); tone(990, { type: 'triangle', vol: 0.06, at: 0.05, dur: 0.2 }); },
  miss: () => tone(220, { type: 'sawtooth', vol: 0.05, dur: 0.25, to: 140 }),
  splash: () => { burst(0.6, 1800, 0.14, 'lowpass'); tone(300, { vol: 0.06, dur: 0.3, to: 120 }); },
  escape: () => { burst(0.4, 900, 0.1); tone(400, { type: 'triangle', vol: 0.06, dur: 0.5, to: 200 }); },
  catch: (rare) => [523, 659, 784, 1046].concat(rare ? [1318, 1568] : []).forEach((f, k) => tone(f, { type: 'triangle', vol: 0.07, at: k * 0.09, dur: 0.35 })),
  coin: () => { tone(1318, { type: 'square', vol: 0.03, dur: 0.08 }); tone(1760, { type: 'square', vol: 0.03, at: 0.07, dur: 0.18 }); },
  upgrade: () => [392, 523, 659, 784, 1046].forEach((f, k) => tone(f, { type: 'triangle', vol: 0.07, at: k * 0.07, dur: 0.4 })),
  bump: () => { burst(0.3, 300, 0.2); tone(90, { vol: 0.12, dur: 0.25, to: 50 }); },
  treasure: () => [784, 988, 1175, 1568].forEach((f, k) => tone(f, { type: 'sine', vol: 0.06, at: k * 0.08, dur: 0.6 })),
  open: () => tone(700, { type: 'sine', vol: 0.04, dur: 0.12, to: 900 }),
  thunder: () => { burst(2.6, 220, 0.5, 'lowpass'); burst(1.4, 600, 0.2, 'lowpass', 0.1); tone(50, { vol: 0.15, dur: 2, to: 30, attack: 0.05 }); },
  whale: () => { tone(180, { type: 'sine', vol: 0.06, attack: 0.6, dur: 2.6, to: 120 }); tone(260, { type: 'sine', vol: 0.04, at: 1.8, attack: 0.5, dur: 2.2, to: 340 }); },
  dolphin: () => { for (let k = 0; k < 6; k++) tone(2400 + Math.random() * 900, { type: 'sine', vol: 0.025, at: k * 0.07, dur: 0.06, to: 3200 }); },
  horn: () => { tone(110, { type: 'sawtooth', vol: 0.06, attack: 0.08, dur: 0.9 }); tone(165, { type: 'sawtooth', vol: 0.04, attack: 0.08, dur: 0.9 }); },
};
