// Textures des astres dessinées par le code (bruit fractal sur la sphère) : aucune image à télécharger.
// Chaque texture est une projection équirectangulaire calculée point par point sur la sphère, donc sans couture.
const TAU = Math.PI * 2;
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

export function noiseFor(seed) {
  const hash = (x, y, z) => {
    let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(z, 1274126177) ^ Math.imul(seed, 2246822519);
    h = Math.imul(h ^ (h >>> 13), 3266489917);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  };
  const noise = (x, y, z) => {
    const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
    const xf = x - xi, yf = y - yi, zf = z - zi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), w = zf * zf * (3 - 2 * zf);
    const l = (a, b, t) => a + (b - a) * t;
    return l(
      l(l(hash(xi, yi, zi), hash(xi + 1, yi, zi), u), l(hash(xi, yi + 1, zi), hash(xi + 1, yi + 1, zi), u), v),
      l(l(hash(xi, yi, zi + 1), hash(xi + 1, yi, zi + 1), u), l(hash(xi, yi + 1, zi + 1), hash(xi + 1, yi + 1, zi + 1), u), v), w);
  };
  // Bruit fractal, recentré et étiré pour couvrir à peu près 0..1
  const fbm = (x, y, z, oct = 5) => {
    let s = 0, a = 0.5, f = 1, n = 0;
    for (let i = 0; i < oct; i++) { s += a * noise(x * f + i * 17.3, y * f, z * f); n += a; a *= 0.5; f *= 2.03; }
    return clamp((s / n - 0.5) * 2.2 + 0.5);
  };
  return { noise, fbm };
}

export function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = Math.imul(s ^ (s >>> 15), 2246822519) + 0x6d2b79f5 >>> 0) / 4294967296);
}

function ramp(stops, t) {
  t = clamp(t);
  for (let i = 1; i < stops.length; i++) {
    if (t <= stops[i][0]) {
      const [a, ca] = stops[i - 1], [b, cb] = stops[i];
      return mix(ca, cb, (t - a) / (b - a || 1));
    }
  }
  return stops.at(-1)[1];
}

const canvas = (w, h) => Object.assign(document.createElement('canvas'), { width: w, height: h });

// fn(x, y, z, lat, lon) -> [r, g, b, a?, relief?, rugosité?] ; relief et rugosité donnent des textures à part si demandées.
function paint(w, h, fn, { bump = false, rough = false } = {}) {
  const make = () => { const c = canvas(w, h), ctx = c.getContext('2d'), img = ctx.createImageData(w, h); return { c, ctx, img, d: img.data }; };
  const col = make(), b = bump && make(), r = rough && make();
  for (let j = 0; j < h; j++) {
    const lat = (0.5 - (j + 0.5) / h) * Math.PI, cl = Math.cos(lat), y = Math.sin(lat);
    for (let i = 0; i < w; i++) {
      const lon = ((i + 0.5) / w) * TAU, x = cl * Math.cos(lon), z = cl * Math.sin(lon);
      const o = fn(x, y, z, lat, lon), k = (j * w + i) * 4;
      col.d[k] = o[0]; col.d[k + 1] = o[1]; col.d[k + 2] = o[2]; col.d[k + 3] = o[3] ?? 255;
      if (b) { b.d[k] = b.d[k + 1] = b.d[k + 2] = o[4] * 255; b.d[k + 3] = 255; }
      if (r) { r.d[k] = r.d[k + 1] = r.d[k + 2] = o[5] * 255; r.d[k + 3] = 255; }
    }
  }
  for (const m of [col, b, r]) if (m) m.ctx.putImageData(m.img, 0, 0);
  return { map: col.c, bump: b?.c, rough: r?.c };
}

// Cratères : creux sombre et rebord clair, calculés en 3D pour ne pas être déformés aux pôles.
function craterField(seed, count, minR, maxR) {
  const rand = rng(seed), list = [];
  for (let i = 0; i < count; i++) {
    const u = rand() * 2 - 1, a = rand() * TAU, s = Math.sqrt(1 - u * u);
    list.push({ x: s * Math.cos(a), y: u, z: s * Math.sin(a), r: minR + (maxR - minR) * rand() ** 2.2 });
  }
  return (x, y, z) => {
    let h = 0;
    for (const c of list) {
      const dx = x - c.x, dy = y - c.y, dz = z - c.z, d2 = dx * dx + dy * dy + dz * dz, lim = c.r * 1.3;
      if (d2 > lim * lim) continue;
      const t = Math.sqrt(d2) / c.r;
      h += t < 1 ? -0.35 * (1 - t * t) : 0.18 * (1 - (t - 1) / 0.3);
    }
    return h;
  };
}

// Relief d'un astre rocheux (0..1) : bosses fractales et cratères.
// La même fonction donne la texture, le maillage en relief (Lune, Mars) et les collisions au ras du sol.
export function rockyHeight({ seed, scale = 3, craters = 0 }) {
  const { fbm } = noiseFor(seed), crater = craters ? craterField(seed, craters, 0.02, 0.16) : () => 0;
  return (x, y, z) => clamp(fbm(x * scale + 3, y * scale, z * scale, 6) * 0.8 + fbm(x * 18, y * 18, z * 18, 3) * 0.2 + crater(x, y, z) * 0.6);
}

// spot : grande tache claire (le « cœur » de Pluton) { lat, lon, r, color }
export function rocky({ seed, w = 1024, h = 512, stops, scale = 3, craters = 0, caps = 0, spot = null }) {
  const { fbm } = noiseFor(seed), height = rockyHeight({ seed, scale, craters });
  const sp = spot && [Math.cos(spot.lat) * Math.cos(spot.lon), Math.sin(spot.lat), Math.cos(spot.lat) * Math.sin(spot.lon)];
  return paint(w, h, (x, y, z) => {
    const hh = height(x, y, z), detail = fbm(x * 18, y * 18, z * 18, 3);
    let c = ramp(stops, hh);
    c = mix(c, [c[0] * 0.75, c[1] * 0.75, c[2] * 0.75], detail * 0.5);
    if (caps && Math.abs(y) > caps - fbm(x * 6, y * 6, z * 6, 3) * 0.06) c = mix(c, [235, 232, 228], 0.85);
    if (sp) {
      const d = Math.hypot(x - sp[0], y - sp[1], z - sp[2]) / spot.r + (fbm(x * 7, y * 7, z * 7, 4) - 0.5) * 0.6;
      c = mix(c, spot.color, smooth(1, 0.7, d) * 0.9);
    }
    return [c[0], c[1], c[2], 255, hh];
  }, { bump: true });
}

// Petit relief qui se répète : grain du sol, visible seulement de très près.
export function grain(seed = 9) {
  const { noise } = noiseFor(seed), s = 256, c = canvas(s, s), ctx = c.getContext('2d'), img = ctx.createImageData(s, s);
  const crat = craterField(seed, 60, 0.03, 0.12);
  for (let j = 0; j < s; j++) for (let i = 0; i < s; i++) {
    // tore : le motif se raccorde sur tous les bords
    const a = (i / s) * TAU, b = (j / s) * TAU, x = Math.cos(a), y = Math.sin(a), z = Math.cos(b), w = Math.sin(b);
    let v = 0.5 + (noise(x * 4 + 9, y * 4, z * 4 + w * 3) - 0.5) * 0.6 + (noise(x * 12, y * 12 + w * 9, z * 12) - 0.5) * 0.3;
    v += crat(x * 0.7071, y * 0.7071, z * 0.7071 + w * 0.3) * 0.5;
    const g = clamp(v) * 255;
    img.data.set([g, g, g, 255], (j * s + i) * 4);
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

export function earth(seed = 7) {
  const { fbm } = noiseFor(seed), m = noiseFor(seed + 1);
  return paint(2048, 1024, (x, y, z) => {
    const wx = fbm(x * 1.5, y * 1.5, z * 1.5, 3) - 0.5;
    const h = fbm(x * 2.1 + wx, y * 2.1 + wx, z * 2.1 - wx, 7);
    const ice = Math.abs(y) > 0.965 - fbm(x * 5, y * 5, z * 5, 3) * 0.04;
    let c, rough = 0.85, relief = 0;
    if (h < 0.53) {
      c = ramp([[0, [6, 22, 64]], [0.42, [10, 44, 110]], [0.53, [30, 105, 160]]], h);
      rough = 0.25;
    } else {
      const e = (h - 0.53) / 0.47, wet = m.fbm(x * 3, y * 3, z * 3, 5), dry = 0.28 * Math.exp(-(((Math.abs(y) - 0.38) / 0.14) ** 2)); // déserts vers les tropiques, sans frontière nette
      c = wet - dry > 0.48 ? mix([46, 98, 44], [92, 118, 62], wet) : mix([196, 168, 112], [160, 120, 80], wet);
      c = mix(c, [120, 104, 92], smooth(0.35, 0.8, e));
      relief = e;
    }
    if (ice) { c = [236, 242, 248]; rough = 0.6; }
    return [c[0], c[1], c[2], 255, relief, rough];
  }, { bump: true, rough: true });
}

export function clouds(seed, { scale = 2.4, cover = 0.52, w = 1024, h = 512, tint = [255, 255, 255] } = {}) {
  const { fbm } = noiseFor(seed);
  return paint(w, h, (x, y, z) => {
    const wx = fbm(x * 2, y * 4, z * 2, 3) - 0.5;
    const v = fbm(x * scale + wx * 1.5, y * scale * 1.6, z * scale - wx, 6), wisp = fbm(x * 14, y * 20, z * 14, 4);
    return [tint[0], tint[1], tint[2], smooth(cover, cover + 0.4, v) * (0.45 + 0.55 * wisp) * 235];
  }).map;
}

export function venus(seed = 11) {
  const { fbm } = noiseFor(seed);
  return paint(1024, 512, (x, y, z) => {
    const wx = fbm(x * 1.2, y * 1.2, z * 1.2, 4) - 0.5;
    const v = fbm(x * 1.4 + wx * 2, y * 5 + wx, z * 1.4 - wx * 2, 6);
    const c = ramp([[0, [168, 120, 60]], [0.45, [222, 182, 112]], [0.7, [242, 214, 156]], [1, [255, 242, 205]]], v);
    return [c[0], c[1], c[2]];
  }).map;
}

// Géantes gazeuses : bandes selon la latitude, ondulées par le bruit, plus une tache éventuelle.
export function gas(seed, { stops, turb = 0.06, spot = null, w = 1536, h = 768, fine = 0.18 }) {
  const { fbm } = noiseFor(seed);
  return paint(w, h, (x, y, z, lat, lon) => {
    const warp = (fbm(x * 3, y * 14, z * 3, 5) - 0.5) * turb;
    let c = ramp(stops, y * 0.5 + 0.5 + warp);
    const d = fbm(x * 9, y * 26, z * 9, 3);
    c = mix(c, [c[0] * 0.82, c[1] * 0.82, c[2] * 0.82], d * fine * 2);
    if (spot) {
      let dl = lon - spot.lon; dl -= Math.round(dl / TAU) * TAU;
      const ex = (dl * Math.cos(lat)) / spot.w, ey = (lat - spot.lat) / spot.h, e = ex * ex + ey * ey;
      if (e < 1) {
        const swirl = 0.5 + 0.5 * Math.sin(Math.sqrt(e) * 14 + Math.atan2(ey, ex) * 2);
        c = mix(c, mix(spot.color, spot.color.map(v => v * 0.75), swirl * 0.5), smooth(1, 0.35, e));
      }
    }
    return [c[0], c[1], c[2]];
  }).map;
}

export function sun(seed = 3) {
  const { fbm } = noiseFor(seed);
  return paint(1024, 512, (x, y, z) => {
    const v = fbm(x * 10, y * 10, z * 10, 5) * 0.7 + fbm(x * 2.5, y * 2.5, z * 2.5, 3) * 0.3;
    const c = ramp([[0, [255, 96, 10]], [0.45, [255, 170, 50]], [0.75, [255, 222, 120]], [1, [255, 250, 220]]], v);
    return [c[0], c[1], c[2]];
  }).map;
}

// Anneaux : texture radiale (de l'intérieur vers l'extérieur) avec la division de Cassini.
export function rings(seed = 5) {
  const { noise } = noiseFor(seed), w = 1024, c = canvas(w, 4), ctx = c.getContext('2d'), img = ctx.createImageData(w, 4);
  for (let i = 0; i < w; i++) {
    const t = i / w;
    let a = 0.35 + 0.45 * noise(t * 60, 0, 0) + 0.2 * noise(t * 220, 3, 0);
    a *= smooth(0, 0.08, t) * smooth(1, 0.9, t);
    if (t > 0.6 && t < 0.66) a *= 0.08; // division de Cassini
    if (t > 0.86 && t < 0.875) a *= 0.3;
    const col = mix([150, 130, 105], [235, 220, 190], noise(t * 30, 9, 0));
    for (let j = 0; j < 4; j++) img.data.set([col[0], col[1], col[2], clamp(a) * 255], (j * w + i) * 4);
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

// Halo lumineux (Soleil, moteurs, balises).
export function glow(stops = [[0, 'rgba(255,255,255,1)'], [0.2, 'rgba(255,220,150,.8)'], [0.5, 'rgba(255,140,40,.25)'], [1, 'rgba(255,100,0,0)']]) {
  const c = canvas(256, 256), ctx = c.getContext('2d'), g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  for (const [o, col] of stops) g.addColorStop(o, col);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  return c;
}

// Nuage de nébuleuse : bruit 2D, estompé vers les bords.
export function nebula(seed, rgb) {
  const { fbm } = noiseFor(seed), s = 256, c = canvas(s, s), ctx = c.getContext('2d'), img = ctx.createImageData(s, s);
  for (let j = 0; j < s; j++) for (let i = 0; i < s; i++) {
    const u = i / s - 0.5, v = j / s - 0.5, r = Math.sqrt(u * u + v * v) * 2;
    const n = fbm(u * 4, v * 4, seed * 0.37, 6);
    const a = smooth(0.42, 0.9, n) * smooth(1, 0.25, r);
    img.data.set([rgb[0], rgb[1], rgb[2], a * 255], (j * s + i) * 4);
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

// Panneaux de station : grille de hublots éclairés.
export function windows(seed = 1) {
  const rand = rng(seed), c = canvas(512, 64), ctx = c.getContext('2d');
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, 512, 64);
  for (let x = 4; x < 512; x += 12) for (let y = 20; y < 44; y += 12) {
    if (rand() < 0.55) continue;
    ctx.fillStyle = rand() < 0.8 ? '#ffd9a0' : '#9fe8ff';
    ctx.fillRect(x, y, 6, 5);
  }
  return c;
}

export function solarPanel() {
  const c = canvas(128, 128), ctx = c.getContext('2d');
  ctx.fillStyle = '#0d2350';
  ctx.fillRect(0, 0, 128, 128);
  ctx.strokeStyle = '#4c79c9';
  ctx.lineWidth = 2;
  for (let i = 0; i <= 128; i += 16) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, 128); ctx.moveTo(0, i); ctx.lineTo(128, i); ctx.stroke(); }
  return c;
}
