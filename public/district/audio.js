// Little District : ambiance sonore synthétisée (aucun fichier). Musique douce, pluie, rumeur de la rue, cuisine, grillons, tonnerre.
let ctx = null, music, sfx, noise, amb = {};
const vol = { music: 0.5, sfx: 0.7 };
import { DISTRICT } from './theme.js';
// Une musique lo-fi par quartier : grille d'accords (bass : note grave, notes : l'accord, tones : notes de mélodie),
// tempo, instrument d'accompagnement (keys), instrument de mélodie (lead), rythmique (drums).
const C = (bass, notes, tones) => ({ bass, notes, tones });
const STYLES = {
  // ruelle japonaise : piano électrique feutré et koto pincé, sans batterie
  japon: { bpm: 66, keys: 'rhodes', lead: 'koto', drums: null, chords: [
    C(41, [53, 57, 60, 64], [69, 72, 76, 77]), C(40, [52, 55, 59, 62], [67, 71, 74, 76]), C(38, [50, 53, 57, 60, 64], [69, 72, 74, 77]), C(36, [48, 52, 55, 59, 62], [67, 72, 74, 76])] },
  // villas : bossa jazzy, Rhodes, vibraphone, batterie feutrée qui balance
  moderne: { bpm: 80, keys: 'rhodes', lead: 'vibe', drums: 'kit', swing: true, chords: [
    C(38, [54, 57, 61, 64], [69, 73, 74, 76, 78]), C(35, [50, 54, 57, 61], [71, 73, 74, 78]), C(40, [55, 59, 62, 66], [71, 74, 76, 78]), C(33, [55, 61, 64, 66], [69, 71, 73, 76])] },
  // front de mer : guitare grattée, sifflet, shaker
  cotier: { bpm: 86, keys: 'guitar', lead: 'flute', drums: 'shaker', chords: [
    C(43, [55, 59, 62, 67], [67, 71, 74, 79]), C(40, [55, 59, 62, 64], [67, 71, 74, 76]), C(36, [55, 59, 60, 64], [64, 67, 71, 72]), C(38, [54, 57, 62, 66], [66, 69, 74, 78])] },
  // vieille ville : harpe en arpèges, flûte à bec, mineur et lent
  europe: { bpm: 62, keys: 'harp', lead: 'flute', drums: null, chords: [
    C(45, [57, 60, 64, 69], [69, 72, 76, 74]), C(41, [57, 60, 65, 69], [69, 72, 77, 76]), C(36, [55, 60, 64, 67], [67, 72, 76, 74]), C(43, [55, 59, 62, 67], [67, 71, 74, 72])] },
  // néo-cité : nappe de synthé, arpège, kick et charleston
  futur: { bpm: 74, keys: 'pad', lead: 'arp', drums: 'kit', chords: [
    C(33, [57, 60, 64, 71], [69, 72, 76, 79]), C(29, [57, 60, 64, 65], [69, 72, 76, 77]), C(36, [55, 59, 60, 64], [67, 71, 72, 76]), C(31, [55, 59, 62, 64], [67, 71, 74, 76])] },
  // village blanc : guitare et bouzouki en trémolo, couleur grecque (ré mineur, mi bémol)
  med: { bpm: 72, keys: 'guitar', lead: 'bouzouki', drums: 'shaker', chords: [
    C(38, [57, 62, 65, 69], [69, 74, 77, 76]), C(39, [55, 58, 63, 67], [67, 70, 75, 74]), C(38, [57, 62, 65, 69], [69, 74, 77, 72]), C(36, [55, 60, 64, 67], [67, 72, 76, 74])] },
};
const STYLE = STYLES[DISTRICT] || STYLES.japon;
const CHORDS = STYLE.chords;
const BEAT = 60 / STYLE.bpm;
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
  amb.sea = loop([['lowpass', 600], ['highpass', 120]]); // ressac (quartiers au bord de l'eau)
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
  amb.sea.gain.setTargetAtTime((state.sea || 0) * (0.05 + 0.04 * Math.sin(t * 0.7)), t, 1.2); // vagues qui vont et viennent
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

// Les instruments, tous synthétisés.
function osc(type, f, t, dur, e, detune = 0) { const o = ctx.createOscillator(); o.type = type; o.frequency.value = f; o.detune.value = detune; o.connect(e); o.start(t); o.stop(t + dur + 0.05); return o; }
function env(t, a, peak, dur, sustain = 0.35) {
  const e = ctx.createGain();
  e.gain.setValueAtTime(0, t); e.gain.linearRampToValueAtTime(peak, t + a);
  e.gain.exponentialRampToValueAtTime(Math.max(peak * sustain, 0.0002), t + a + 0.5); e.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  return e;
}
function play(kind, m, t, dur, g) {
  const f = hz(m);
  if (kind === 'rhodes') { // piano électrique feutré : fondamentale et harmoniques légères
    const e = env(t, 0.02, g, dur); e.connect(music.input);
    for (const [mul, k] of [[1, 1], [2, 0.12], [3, 0.03]]) { const og = ctx.createGain(); og.gain.value = k; og.connect(e); osc('sine', f * mul, t, dur, og, (Math.random() - 0.5) * 6); }
  } else if (kind === 'vibe') { // vibraphone : son pur qui tremble doucement
    const e = env(t, 0.01, g, dur * 1.3, 0.5), trem = ctx.createGain(), lfo = ctx.createOscillator(), depth = ctx.createGain();
    lfo.frequency.value = 5; depth.gain.value = 0.35; lfo.connect(depth).connect(trem.gain); trem.gain.value = 0.65;
    e.connect(trem).connect(music.input); osc('sine', f, t, dur * 1.3, e); osc('sine', f * 4, t, 0.3, e).detune.value = 3;
    lfo.start(t); lfo.stop(t + dur * 1.3);
  } else if (kind === 'flute') { // flûte / sifflet : attaque douce, léger vibrato
    const e = env(t, 0.08, g * 0.8, dur, 0.7), v = ctx.createOscillator(), vd = ctx.createGain();
    v.frequency.value = 5.5; vd.gain.value = f * 0.006; v.connect(vd);
    const o = osc('sine', f, t, dur, e); vd.connect(o.frequency); v.start(t + 0.15); v.stop(t + dur);
    e.connect(music.input);
  } else if (kind === 'pad') { // nappe de synthé : deux dents de scie désaccordées, très filtrées
    const e = ctx.createGain(), lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 700;
    e.gain.setValueAtTime(0, t); e.gain.linearRampToValueAtTime(g * 0.45, t + 1.2); e.gain.setValueAtTime(g * 0.45, t + dur - 1); e.gain.linearRampToValueAtTime(0, t + dur + 0.6);
    lp.connect(e).connect(music.input); osc('sawtooth', f, t, dur + 0.6, lp, -8); osc('sawtooth', f, t, dur + 0.6, lp, 8);
  } else { // cordes pincées : koto, guitare, harpe, bouzouki, arpège de synthé
    const bright = { koto: 2600, guitar: 1800, harp: 2200, bouzouki: 3400, arp: 1500 }[kind];
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(bright, t); lp.frequency.exponentialRampToValueAtTime(400, t + dur);
    const e = ctx.createGain(); e.gain.setValueAtTime(0, t); e.gain.linearRampToValueAtTime(g, t + 0.004); e.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    lp.connect(e).connect(music.input);
    osc({ koto: 'triangle', guitar: 'triangle', harp: 'triangle', bouzouki: 'sawtooth', arp: 'square' }[kind], f, t, dur, lp, (Math.random() - 0.5) * 8);
    if (kind === 'koto' || kind === 'bouzouki') osc('sine', f * 2, t, dur * 0.5, lp); // timbre plus métallique
  }
}
function bassNote(m, t, dur, g) {
  const o = ctx.createOscillator(), e = ctx.createGain();
  o.type = 'sine'; o.frequency.value = hz(m);
  e.gain.setValueAtTime(0, t); e.gain.linearRampToValueAtTime(g, t + 0.08); e.gain.setValueAtTime(g, t + dur * 0.6); e.gain.linearRampToValueAtTime(0, t + dur);
  o.connect(e).connect(music.input); o.start(t); o.stop(t + dur + 0.05);
}
// Rythmique feutrée (étouffée par le filtre de la musique, comme sur une vieille cassette)
function kick(t, g) { const o = ctx.createOscillator(), e = ctx.createGain(); o.frequency.setValueAtTime(110, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.18); e.gain.setValueAtTime(g, t); e.gain.exponentialRampToValueAtTime(0.0001, t + 0.3); o.connect(e).connect(music.input); o.start(t); o.stop(t + 0.32); }
function tick(t, g, f = 7000, d = 0.05) { const src = ctx.createBufferSource(), b = ctx.createBiquadFilter(), e = ctx.createGain(); src.buffer = noise; b.type = 'bandpass'; b.frequency.value = f; b.Q.value = 0.8; e.gain.setValueAtTime(g, t); e.gain.exponentialRampToValueAtTime(0.0001, t + d); src.connect(b).connect(e).connect(music); src.start(t, Math.random()); src.stop(t + d + 0.02); }
let nextBar = 0, bar = 0;
function scheduleMusic() {
  const loop = () => {
    if (ctx.state === 'running' && vol.music > 0) while (nextBar < ctx.currentTime + 1.5) {
      const t = Math.max(nextBar, ctx.currentTime + 0.05), c = CHORDS[bar % CHORDS.length], len = BEAT * 4, night = state.night > 0.5;
      music.warm.frequency.setTargetAtTime(night ? 1300 : 2000, t, 2);
      const K = STYLE.keys, sw = STYLE.swing ? 0.08 : 0; // swing : les contretemps arrivent un peu en retard
      // l'accompagnement
      if (K === 'rhodes') {
        c.notes.forEach((n, i) => play('rhodes', n, t + i * 0.035, len * 0.95, 0.05));
        if (Math.random() < 0.7) c.notes.slice(1).forEach((n, i) => play('rhodes', n, t + BEAT * 2.5 + sw + i * 0.03, len * 0.5, 0.025));
      } else if (K === 'guitar') { // grattée : bas, bas-haut, haut-bas
        for (const [b, up, g] of [[0, false, 0.05], [1.5, false, 0.03], [2, true, 0.03], [3, false, 0.04], [3.5, true, 0.025]]) {
          const ns = up ? [...c.notes].reverse() : c.notes;
          ns.forEach((n, i) => play('guitar', n, t + b * BEAT + i * 0.022, BEAT * 1.4, g));
        }
      } else if (K === 'harp') { // arpèges montants et descendants
        const ns = [...c.notes, c.notes[1] + 12, ...c.notes.slice(1, -1).reverse()];
        ns.forEach((n, i) => play('harp', n, t + i * (len / ns.length), BEAT * 2.4, 0.045));
      } else if (K === 'pad') c.notes.forEach(n => play('pad', n, t, len, 0.05));
      bassNote(c.bass, t, BEAT * 2.2, 0.09);
      bassNote(c.bass + (Math.random() < 0.5 ? 7 : 12), t + BEAT * 2.5 + sw, BEAT * 1.4, 0.06);
      // la mélodie
      const L = STYLE.lead;
      if (L === 'arp') { // arpège régulier en doubles croches, plus calme la nuit
        const ns = [...c.notes, ...c.tones.slice(0, 2)];
        for (let k = 0; k < (night ? 8 : 16); k++) play('arp', ns[k % ns.length] + 12, t + k * (len / (night ? 8 : 16)), BEAT * 0.5, 0.02);
      } else if (bar % 2 === 0 || Math.random() < 0.3) {
        let beat = Math.random() < 0.5 ? 0.5 : 1;
        for (let k = 0; k < (night ? 2 : 3) && beat < 4; k++) {
          const n = c.tones[Math.floor(Math.random() * c.tones.length)] - (night ? 12 : 0), at = t + beat * BEAT + (beat % 1 ? sw : 0);
          if (L === 'bouzouki') for (let r = 0; r < 6; r++) play('bouzouki', n, at + r * 0.09, 0.22, 0.03 * (1 - r * 0.08)); // trémolo
          else play(L, n, at, BEAT * (L === 'flute' ? 1.6 : 2.5), L === 'koto' ? 0.05 : 0.035);
          beat += [0.5, 1, 1, 1.5][Math.floor(Math.random() * 4)];
        }
      }
      // la rythmique (plus discrète la nuit)
      const dg = night ? 0.5 : 1;
      if (STYLE.drums === 'kit') {
        kick(t, 0.22 * dg); kick(t + BEAT * 2, 0.18 * dg); if (Math.random() < 0.4) kick(t + BEAT * 2.5 + sw, 0.12 * dg);
        for (let k = 0; k < 8; k++) tick(t + k * BEAT * 0.5 + (k % 2 ? sw : 0), (k % 2 ? 0.012 : 0.02) * dg);
        tick(t + BEAT, 0.03 * dg, 1800, 0.12); tick(t + BEAT * 3, 0.03 * dg, 1800, 0.12); // caisse claire balai
      } else if (STYLE.drums === 'shaker') for (let k = 0; k < 8; k++) tick(t + k * BEAT * 0.5, (k % 2 ? 0.016 : 0.008) * dg, 5000, 0.07);
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
