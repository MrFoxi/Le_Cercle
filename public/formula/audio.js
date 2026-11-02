// Sons de Top Formula, tous synthétisés : moteur à régime variable (passages de rapports), moteurs voisins,
// crissement des pneus, vibreurs, chocs, bips des feux de départ, ambiance de foule et petite fanfare de victoire.
let ctx = null, master = null, engine = null, rival = null, skid = null, rumble = null, crowd = null, rain = null, rainOn = false;
let volume = (() => { try { return Number(localStorage.getItem('formula-volume') ?? 0.7); } catch { return 0.7; } })();

function noiseBuffer(ac, seconds = 2) {
  const b = ac.createBuffer(1, ac.sampleRate * seconds, ac.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return b;
}
function loopNoise(ac, freq, q, type = 'bandpass') {
  const src = ac.createBufferSource(); src.buffer = noiseBuffer(ac); src.loop = true;
  const f = ac.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
  const g = ac.createGain(); g.gain.value = 0;
  src.connect(f).connect(g).connect(master); src.start();
  return { g, f };
}
function motor(ac) {
  // Deux dents de scie désaccordées + une carrée à l'octave en dessous, filtrées : un V6 hybride… à peu près.
  const g = ac.createGain(); g.gain.value = 0;
  const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1200; lp.Q.value = 3;
  const oscs = [['sawtooth', 1, 0.5], ['sawtooth', 1.007, 0.4], ['square', 0.5, 0.25]].map(([type, mul, vol]) => {
    const o = ac.createOscillator(); o.type = type; const og = ac.createGain(); og.gain.value = vol;
    o.connect(og).connect(lp); o.start(); return { o, mul };
  });
  lp.connect(g).connect(master);
  return { g, lp, oscs };
}

export function startAudio() {
  if (ctx) { ctx.resume(); return; }
  try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { return; }
  master = ctx.createGain(); master.gain.value = volume;
  const comp = ctx.createDynamicsCompressor(); master.connect(comp).connect(ctx.destination);
  engine = motor(ctx);
  rival = motor(ctx);
  skid = loopNoise(ctx, 1500, 2.5);
  rumble = loopNoise(ctx, 90, 1.2, 'lowpass');
  crowd = loopNoise(ctx, 700, 0.4);
  rain = loopNoise(ctx, 4500, 0.3, 'highpass');
  setRain(rainOn);
}
// Bruit de pluie continu pendant les courses sous la pluie.
export function setRain(on) { rainOn = on; if (rain) rain.g.gain.setTargetAtTime(on ? 0.05 : 0, ctx.currentTime, 0.4); }
export function setVolume(v) {
  volume = v;
  try { localStorage.setItem('formula-volume', v); } catch { /* stockage bloqué */ }
  if (master) master.gain.value = v;
}
export const getVolume = () => volume;

// Rapport et régime à partir de la vitesse (8 rapports).
const GEARS = [0, 0.16, 0.27, 0.38, 0.5, 0.62, 0.75, 0.88, 1.04];
export function gearOf(v, vmax) {
  const r = Math.max(0, v) / vmax;
  let g = 1; while (g < 8 && r > GEARS[g]) g++;
  const lo = GEARS[g - 1], hi = GEARS[g];
  return { gear: g, rpm: Math.min(1, 0.3 + 0.7 * (r - lo) / (hi - lo)) };
}

// Appelé à chaque image : player = voiture du joueur, near = voiture la plus proche (ou null), dist en mètres.
export function updateAudio(player, near, dist, { throttle = 0, vmax = 76, crowdLevel = 0.04, on = true } = {}) {
  if (!ctx) return;
  const t = ctx.currentTime, set = (p, v, k = 0.05) => p.setTargetAtTime(v, t, k);
  if (!on || !player) { for (const n of [engine.g, rival.g, skid.g, rumble.g, crowd.g]) set(n.gain, 0, 0.1); return; }
  const { rpm } = gearOf(player.speed, vmax);
  const f = 70 + rpm * 260;
  for (const o of engine.oscs) set(o.o.frequency, f * o.mul, 0.03);
  set(engine.lp.frequency, 500 + rpm * 2600 * (0.5 + throttle * 0.5), 0.05);
  set(engine.g.gain, 0.07 + throttle * 0.07 + rpm * 0.03);
  if (near && dist < 60) {
    const r2 = gearOf(near.speed, vmax).rpm, f2 = 70 + r2 * 260;
    for (const o of rival.oscs) set(o.o.frequency, f2 * o.mul * 1.01, 0.05);
    set(rival.lp.frequency, 400 + r2 * 1600);
    set(rival.g.gain, 0.06 * (1 - dist / 60));
  } else set(rival.g.gain, 0, 0.2);
  set(skid.g.gain, Math.min(0.16, Math.max(0, player.skid - 2) * 0.03));
  set(skid.f.frequency, 1300 + Math.random() * 300);
  set(rumble.g.gain, player.rumble ? 0.35 : 0, 0.02);
  set(crowd.g.gain, crowdLevel, 0.5);
}

function blip(freq, dur, type = 'sine', vol = 0.25, at = 0) {
  if (!ctx) return;
  const t = ctx.currentTime + at, o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.value = freq;
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g).connect(master); o.start(t); o.stop(t + dur + 0.05);
}
export const beep = go => blip(go ? 880 : 440, go ? 0.6 : 0.25, 'square', 0.12);
export function bang(power) {
  if (!ctx) return;
  const t = ctx.currentTime, src = ctx.createBufferSource(), g = ctx.createGain(), f = ctx.createBiquadFilter();
  src.buffer = noiseBuffer(ctx, 0.4); f.type = 'lowpass'; f.frequency.value = 600 + power * 60;
  g.gain.setValueAtTime(Math.min(0.6, 0.08 + power * 0.025), t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
  src.connect(f).connect(g).connect(master); src.start(t);
}
export const lapChime = best => { blip(best ? 1046 : 784, 0.18, 'triangle', 0.15); blip(best ? 1318 : 988, 0.3, 'triangle', 0.15, 0.12); };
export function fanfare(win) {
  const notes = win ? [523, 659, 784, 1046, 784, 1046, 1318] : [523, 659, 784, 659];
  notes.forEach((n, k) => blip(n, 0.35, 'triangle', 0.14, k * 0.14));
}
