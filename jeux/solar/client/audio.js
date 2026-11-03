// Sons de Solar Explorer, tous synthétisés (aucun fichier) : réacteur, chocs, alarme de coque, radio de la station,
// carillon de découverte, voix des annonces, et musique d'ambiance douce qui change selon la zone.
let ac = null, master, musicBus, engine, delay;
const settings = { sound: true, music: true };

export function startAudio() {
  if (ac) return void ac.resume();
  ac = new (window.AudioContext || window.webkitAudioContext)();
  master = ac.createGain();
  master.connect(ac.destination);
  // Écho spatial pour la musique (un retard qui se répète en s'atténuant)
  musicBus = ac.createGain();
  delay = ac.createDelay(2);
  delay.delayTime.value = 0.9;
  const fb = ac.createGain();
  fb.gain.value = 0.45;
  musicBus.connect(master);
  musicBus.connect(delay).connect(fb).connect(delay);
  fb.connect(master);
  // Réacteur : bruit brun filtré
  const buf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate), d = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < d.length; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = last * 3.5; }
  const src = ac.createBufferSource(), filter = ac.createBiquadFilter(), gain = ac.createGain();
  src.buffer = buf; src.loop = true;
  filter.type = 'lowpass';
  gain.gain.value = 0;
  src.connect(filter).connect(gain).connect(master);
  src.start();
  engine = { filter, gain };
  apply();
}

function apply() {
  if (!ac) return;
  master.gain.setTargetAtTime(settings.sound ? 1 : 0, ac.currentTime, 0.1);
  musicBus.gain.setTargetAtTime(settings.music ? 1 : 0, ac.currentTime, 0.5);
}
export function setAudio(opts) { Object.assign(settings, opts); apply(); if (!settings.sound) speechSynthesis?.cancel(); }
export const audioSettings = () => ({ ...settings });

export function engineSound(on, thrust, boost) {
  if (!engine) return;
  const t = ac.currentTime;
  engine.gain.gain.setTargetAtTime(on ? 0.05 + thrust * 0.12 + (boost ? 0.08 : 0) : 0, t, 0.15);
  engine.filter.frequency.setTargetAtTime(180 + thrust * 500 + (boost ? 700 : 0), t, 0.2);
}

function tone(freq, dur, { type = 'sine', vol = 0.1, at = 0, slide, bus = master, attack = 0.01 } = {}) {
  if (!ac) return;
  const t = ac.currentTime + at, o = ac.createOscillator(), g = ac.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(bus);
  o.start(t);
  o.stop(t + dur + 0.05);
}
function noise(dur, { vol = 0.1, freq = 1500, q = 1, at = 0 } = {}) {
  if (!ac) return;
  const t = ac.currentTime + at, buf = ac.createBuffer(1, Math.ceil(ac.sampleRate * dur), ac.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
  s.buffer = buf;
  f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f).connect(g).connect(master);
  s.start(t);
}

export const sfx = {
  bump: v => tone(90, 0.45, { type: 'triangle', vol: 0.25 * v, slide: 35 }),
  alarm: () => { tone(880, 0.18, { type: 'square', vol: 0.05 }); tone(660, 0.18, { type: 'square', vol: 0.05, at: 0.22 }); },
  radio: () => { for (let i = 0; i < 4; i++) noise(0.05 + Math.random() * 0.12, { vol: 0.06, freq: 1800 + Math.random() * 1500, q: 2, at: i * 0.11 }); },
  chime: () => [784, 988, 1175, 1568].forEach((f, i) => tone(f, 0.9, { vol: 0.06, at: i * 0.09 })),
  ping: () => { tone(1320, 0.25, { vol: 0.07 }); tone(1980, 0.4, { vol: 0.05, at: 0.12 }); },
  message: () => tone(1046, 0.15, { vol: 0.05 }),
  warp: () => { tone(200, 0.6, { type: 'sawtooth', vol: 0.05, slide: 1600 }); noise(0.5, { vol: 0.08, freq: 3000, q: 0.7 }); },
  firework: () => { for (let i = 0; i < 3; i++) { noise(0.5, { vol: 0.12, freq: 900, q: 0.6, at: i * 0.35 }); tone(1200 + Math.random() * 800, 0.6, { vol: 0.03, at: i * 0.35 + 0.05, slide: 300 }); } },
};

// Annonces de la station, lues à voix haute (si le navigateur sait parler français).
export function speak(text) {
  if (!settings.sound || !window.speechSynthesis) return;
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'fr-FR';
  u.rate = 1.05;
  u.pitch = 0.9;
  u.voice = speechSynthesis.getVoices().find(v => v.lang?.startsWith('fr')) ?? null;
  speechSynthesis.cancel();
  speechSynthesis.speak(u);
}

// Musique : nappes d'accords lents et notes éparses, dans une gamme propre à chaque zone.
const MOODS = {
  terre: { root: 220, scale: [0, 2, 4, 7, 9], wave: 'sine' }, // calme, pentatonique majeure
  soleil: { root: 247, scale: [0, 2, 4, 6, 7, 11], wave: 'triangle' }, // lumineux (lydien)
  mars: { root: 196, scale: [0, 2, 3, 5, 7, 9, 10], wave: 'sine' }, // aventure (dorien)
  ceinture: { root: 174.6, scale: [0, 2, 5, 7, 10], wave: 'triangle' }, // suspendu
  geantes: { root: 130.8, scale: [0, 2, 4, 5, 7, 9, 10], wave: 'sine' }, // majestueux (mixolydien), grave
  confins: { root: 110, scale: [0, 1, 3, 5, 7, 8, 10], wave: 'sine' }, // mystérieux (phrygien)
};
let mood = 'terre', nextChord = 0;
export function setMood(m) { mood = MOODS[m] ? m : 'terre'; }
export function music() {
  if (!ac || !settings.music) return;
  const now = ac.currentTime;
  if (now < nextChord) return;
  const { root, scale, wave } = MOODS[mood], pick = () => scale[Math.floor(Math.random() * scale.length)];
  const deg = [pick(), pick(), pick()].sort((a, b) => a - b);
  deg.forEach((s, i) => tone(root * 2 ** ((s + 12 * (i === 0 ? -1 : 0)) / 12), 9, { type: wave, vol: 0.022, attack: 3, bus: musicBus }));
  for (let k = 0; k < 3; k++) if (Math.random() < 0.6) tone(root * 2 ** ((pick() + 24) / 12), 2.5, { vol: 0.012, at: 1.5 + k * 2 + Math.random(), attack: 0.4, bus: musicBus });
  nextChord = now + 7 + Math.random() * 3;
}
