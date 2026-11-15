// Mini-golf, mode Aventure : les sons, tous synthétisés. Une ambiance par étage (eau et grenouilles, oiseaux et feuillage,
// gouttes et écho, vent sec, sifflement glacé, carillons), une musique très discrète, et les bruits des matériaux.
let ac = null, master, ambBus, musBus, sfxBus, noiseBuf, verb, biome = -1, timers = [];
export const settings = { sound: true, music: true };
try { Object.assign(settings, JSON.parse(localStorage.getItem('tour-audio') || '{}')); } catch { /* stockage bloqué */ }

export function startAudio() {
  if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
  ac = new AudioContext();
  master = ac.createGain(); master.gain.value = 0.8; master.connect(ac.destination);
  for (const k of ['amb', 'mus', 'sfx']) { const g = ac.createGain(); g.connect(master); if (k === 'amb') ambBus = g; else if (k === 'mus') musBus = g; else sfxBus = g; }
  noiseBuf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
  const d = noiseBuf.getChannelData(0); let b = 0; for (let i = 0; i < d.length; i++) { b = 0.97 * b + 0.03 * (Math.random() * 2 - 1); d[i] = b * 3; } // bruit doux
  // petit écho (grottes, carillons)
  verb = ac.createDelay(1); verb.delayTime.value = 0.32; const fb = ac.createGain(); fb.gain.value = 0.38; verb.connect(fb); fb.connect(verb); verb.connect(master);
  apply();
  if (biome >= 0) { const b = biome; biome = -1; setBiome(b); }
}
function apply() { if (!ac) return; ambBus.gain.value = settings.sound ? 0.5 : 0; sfxBus.gain.value = settings.sound ? 0.9 : 0; musBus.gain.value = settings.music ? 0.22 : 0; }
export function toggle(k) { settings[k] = !settings[k]; try { localStorage.setItem('tour-audio', JSON.stringify(settings)); } catch { /* */ } apply(); }

function tone(f, dur, { type = 'sine', vol = 0.2, bus = sfxBus, at = 0, glide, attack = 0.005, echo = 0 } = {}) {
  if (!ac) return;
  const t = ac.currentTime + at, o = ac.createOscillator(), g = ac.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t); if (glide) o.frequency.exponentialRampToValueAtTime(glide, t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(bus); if (echo) { const e = ac.createGain(); e.gain.value = echo; g.connect(e); e.connect(verb); }
  o.start(t); o.stop(t + dur + 0.05);
}
function noise(dur, { vol = 0.2, freq = 1200, q = 1, type = 'bandpass', bus = sfxBus, at = 0, attack = 0.005, sweep } = {}) {
  if (!ac) return;
  const t = ac.currentTime + at, s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
  s.buffer = noiseBuf; s.loop = true; f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q; if (sweep) f.frequency.exponentialRampToValueAtTime(sweep, t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f); f.connect(g); g.connect(bus); s.start(t, Math.random()); s.stop(t + dur + 0.05);
}
// Un fond continu (vent, eau) : bruit filtré qui ondule doucement
function bed(freq, vol, q = 0.7, wobble = 0.3) {
  const s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain(), lfo = ac.createOscillator(), lg = ac.createGain();
  s.buffer = noiseBuf; s.loop = true; f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
  lfo.frequency.value = 0.07 + Math.random() * 0.08; lg.gain.value = freq * wobble; lfo.connect(lg); lg.connect(f.frequency);
  g.gain.value = 0; g.gain.linearRampToValueAtTime(vol, ac.currentTime + 3);
  s.connect(f); f.connect(g); g.connect(ambBus); s.start(); lfo.start();
  return () => { g.gain.linearRampToValueAtTime(0, ac.currentTime + 2.5); setTimeout(() => { s.stop(); lfo.stop(); }, 2800); };
}
const every = (ms, fn) => { const id = setInterval(() => { if (!document.hidden) fn(); }, ms); timers.push(() => clearInterval(id)); };
const rnd = (a, b) => a + Math.random() * (b - a);
// Les gammes de la musique : une humeur par étage
const MUSIC = [[50, [0, 3, 7, 10]], [55, [0, 4, 7, 9]], [52, [0, 2, 7, 11]], [50, [0, 1, 5, 7]], [57, [0, 4, 7, 11]], [60, [0, 2, 4, 7, 9]], [45, [0, 1, 5, 6]], [62, [0, 2, 5, 7, 9]], [57, [0, 4, 7, 11, 14]]];
const midi = n => 440 * 2 ** ((n - 69) / 12);

export function setBiome(i) {
  if (i === biome) return;
  biome = i;
  if (!ac) return;
  for (const stop of timers) stop();
  timers = [];
  const add = stop => timers.push(stop);
  switch (i) {
    case 0: // marais : clapotis, grenouilles, brise
      add(bed(500, 0.08)); add(bed(220, 0.05, 0.5));
      every(1700, () => { if (Math.random() < 0.6) { const f = rnd(110, 160); tone(f, 0.12, { type: 'triangle', vol: 0.05, bus: ambBus, glide: f * 0.7 }); tone(f, 0.12, { type: 'triangle', vol: 0.04, bus: ambBus, at: 0.18, glide: f * 0.7 }); } });
      break;
    case 1: // forêt : feuillage et oiseaux
      add(bed(1800, 0.05, 0.6, 0.4)); add(bed(400, 0.04));
      every(1300, () => { if (Math.random() < 0.7) { const f = rnd(2200, 3600), n = 2 + Math.floor(Math.random() * 3); for (let k = 0; k < n; k++) tone(f * rnd(0.9, 1.1), 0.09, { vol: 0.035, bus: ambBus, at: k * 0.12, glide: f * 1.3 }); } });
      break;
    case 2: // grottes : gouttes avec écho, bourdon grave
      add(bed(140, 0.06, 2, 0.1));
      every(900, () => { if (Math.random() < 0.55) tone(rnd(900, 1700), 0.25, { vol: 0.06, bus: ambBus, glide: rnd(500, 700), echo: 0.6 }); });
      break;
    case 3: // canyon : vent sec, rapace au loin
      add(bed(700, 0.09, 0.9, 0.5));
      every(7000, () => { if (Math.random() < 0.4) tone(rnd(1400, 1700), 1.1, { vol: 0.03, bus: ambBus, glide: 900, attack: 0.2, echo: 0.4 }); });
      break;
    case 4: // glacier : sifflement du vent, glace qui craque
      add(bed(1400, 0.06, 4, 0.25)); add(bed(320, 0.07));
      every(2500, () => { if (Math.random() < 0.3) noise(0.3, { vol: 0.05, freq: rnd(2000, 4000), q: 6, bus: ambBus }); });
      break;
    case 6: // orgues de feu : grondement, crépitements
      add(bed(90, 0.12, 1.2, 0.3)); add(bed(600, 0.03, 1));
      every(700, () => { if (Math.random() < 0.6) noise(0.05, { vol: 0.05, freq: rnd(1500, 4000), q: 3, bus: ambBus }); });
      break;
    case 7: // cité des vents : rafales, fanions qui claquent
      add(bed(800, 0.11, 0.7, 0.7)); add(bed(250, 0.06));
      every(2200, () => { if (Math.random() < 0.5) noise(0.25, { vol: 0.06, freq: rnd(1500, 2500), q: 2, bus: ambBus }); });
      break;
    case 8: // observatoire : scintillements dans la nuit
      add(bed(3000, 0.02, 3, 0.2));
      every(1100, () => { if (Math.random() < 0.6) tone(midi(88 + [0, 4, 7, 11, 14][Math.floor(Math.random() * 5)]), 1.4, { vol: 0.03, bus: ambBus, echo: 0.6 }); });
      break;
    default: // sanctuaire : carillons dans le vent
      add(bed(900, 0.04, 0.6));
      every(1600, () => { if (Math.random() < 0.6) tone(midi(84 + [0, 2, 4, 7, 9][Math.floor(Math.random() * 5)]), 1.6, { type: 'triangle', vol: 0.035, bus: ambBus, echo: 0.5 }); });
  }
  // musique : un accord tenu, de loin en loin
  const [root, sc] = MUSIC[Math.min(i, MUSIC.length - 1)];
  let step = 0;
  every(5200, () => { const base = root + sc[step++ % sc.length]; for (const n of [0, 7, 12]) tone(midi(base + n - 12), 5, { vol: 0.05, bus: musBus, attack: 1.4 }); if (Math.random() < 0.5) tone(midi(base + 24 + sc[Math.floor(Math.random() * sc.length)]), 1.2, { type: 'triangle', vol: 0.03, bus: musBus, at: 1.5, echo: 0.4 }); });
}

/* ---------- Bruits de jeu ---------- */
const HIT = { grass: [400, 2], moss: [300, 2], rock: [1800, 4], wood: [700, 3], sand: [600, 0.7], mud: [200, 0.6], ice: [3200, 6], snow: [800, 0.5], crystal: [2600, 8], shroom: [180, 1.5], gold: [1500, 5] };
export function hit(surf, f) {
  const [freq, q] = HIT[surf] || HIT.rock;
  noise(0.08 + f * 0.1, { vol: 0.08 + f * 0.25, freq, q });
  if (surf === 'crystal' || surf === 'ice') tone(freq * 0.8, 0.4, { vol: 0.05 + f * 0.1, echo: 0.4 });
  if (surf === 'shroom') tone(160, 0.25, { type: 'triangle', vol: 0.15, glide: 420 });
  if (surf === 'wood' || surf === 'rock') tone(freq * 0.12, 0.08, { type: 'triangle', vol: 0.06 + f * 0.1 });
}
export function swing(power) { noise(0.12, { vol: 0.12 + power * 0.2, freq: 3000, q: 1.5, sweep: 900 }); tone(900, 0.05, { type: 'square', vol: 0.06 + power * 0.06 }); }
export function cue(kind) {
  if (kind === 'club') [0, 4, 7, 12].forEach((n, k) => tone(midi(72 + n), 0.5, { type: 'triangle', vol: 0.12, at: k * 0.11, echo: 0.4 }));
  if (kind === 'break') { noise(0.4, { vol: 0.3, freq: 2500, q: 2 }); for (let k = 0; k < 5; k++) tone(rnd(1500, 3500), 0.2, { vol: 0.05, at: k * 0.05 }); }
  if (kind === 'trigger') { noise(1.4, { vol: 0.2, freq: 150, q: 1, type: 'lowpass', attack: 0.3 }); tone(220, 0.6, { type: 'triangle', vol: 0.08, at: 0.2, echo: 0.5 }); }
  if (kind === 'topple') { noise(1.6, { vol: 0.35, freq: 120, type: 'lowpass', attack: 0.4 }); noise(0.3, { vol: 0.3, freq: 300, at: 1.4 }); }
  if (kind === 'holed') [0, 4, 7, 12, 16, 19, 24].forEach((n, k) => tone(midi(67 + n), 0.9, { type: 'triangle', vol: 0.14, at: k * 0.13, echo: 0.5 }));
  if (kind === 'lost') { tone(330, 1.6, { type: 'triangle', vol: 0.12, glide: 70, attack: 0.05 }); noise(1.5, { vol: 0.12, freq: 600, sweep: 150 }); }
  if (kind === 'rotate') noise(0.35, { vol: 0.07, freq: 300, q: 1, sweep: 700, attack: 0.08 });
  if (kind === 'lava') { noise(0.6, { vol: 0.3, freq: 400, q: 0.8, sweep: 1500 }); tone(120, 0.4, { type: 'sawtooth', vol: 0.06, glide: 300 }); }
  if (kind === 'shard') [0, 7, 12, 19].forEach((n, k) => tone(midi(84 + n), 0.7, { vol: 0.08, at: k * 0.07, echo: 0.6 }));
  if (kind === 'water') noise(0.4, { vol: 0.15, freq: 900, q: 0.8, sweep: 300 });
}
