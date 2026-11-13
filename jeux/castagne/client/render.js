// Rendu de La Castagne (canvas 2D) : l'arène « Le Phare des Nuées » en couches qui défilent à des vitesses différentes
// (ciel du couchant, mer de nuages, îles lointaines, phare et son faisceau, mouettes, île principale avec cascade,
// planches suspendues), les combattants articulés (Fenna la renarde, Gromm l'ours) avec leurs poses pour chaque coup,
// et les effets : étincelles, anneaux de choc, onomatopées, traînées des éjectés, explosion de K.O., secousses d'écran.
const BR = window.BR;
const TAU = Math.PI * 2;
const INK = '#1c1226';
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ease = t => t * t * (3 - 2 * t);
const rad = d => (d * Math.PI) / 180;
let seed = 7;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

/* ---------------- Personnages : couleurs et proportions ---------------- */
export const LOOKS = {
  fenna: { fur: '#f08a32', fur2: '#c9611d', belly: '#fff3e2', dark: '#3a2418', scarf: '#2ec4b6', scarf2: '#1b8c84', vest: '#7a4a2e', head: 17, torso: 30, limb: 15, arm: 13, girth: 1, ears: 'fox', tail: true },
  gromm: { fur: '#8a5a38', fur2: '#6a4128', belly: '#e8cfa0', dark: '#2a1a10', scarf: '#d8433a', scarf2: '#a12a24', vest: '#4a3426', head: 19, torso: 34, limb: 15, arm: 15, girth: 1.35, ears: 'bear', tail: false },
};

// Pose : angles en degrés (0 = pendu vers le bas, positif = vers l'avant) ; bob = enfoncement ; lean = inclinaison du buste.
const BASE = { lean: 4, bob: 0, sq: 1, rot: 0, head: 0, aF: [22, 70], aB: [12, 55], lF: [14, 12], lB: [-14, 16], face: 'calm' };
const P = o => ({ ...BASE, ...o });
// Pour chaque coup : pose d'élan (W) puis pose de frappe (K).
const MOVE_POSES = {
  jab: { W: P({ aF: [60, 120], lean: 0 }), K: P({ aF: [92, 4], aB: [30, 80], lean: 14, face: 'shout' }) },
  sLight: { W: P({ aF: [40, 110], lean: -6 }), K: P({ aF: [95, 0], aB: [-20, 40], lean: 24, lF: [40, 20], lB: [-40, 30], face: 'shout' }) },
  dLight: { W: P({ bob: 12, lF: [50, 80] }), K: P({ bob: 30, lean: -28, lF: [92, 0], lB: [-30, 110], aF: [-30, 20], aB: [-50, 20], face: 'shout' }) },
  nHeavy: { W: P({ bob: 16, aF: [-10, 140], lean: 18, lF: [40, 80], lB: [-30, 80], face: 'grit' }), K: P({ aF: [178, 6], aB: [40, 60], lean: -14, bob: -6, lF: [10, 10], lB: [-20, 30], face: 'shout' }) },
  sHeavy: { W: P({ lF: [70, 120], lean: -8, aF: [-30, 60], aB: [40, 60], face: 'grit' }), K: P({ lF: [100, 0], lB: [-18, 10], lean: -22, aF: [-50, 30], aB: [70, 20], face: 'shout' }) },
  dHeavy: { W: P({ bob: 22, lF: [40, 100], lB: [-40, 100], aF: [60, 80], face: 'grit' }), K: P({ bob: 26, lF: [88, 0], lB: [-88, 0], aF: [100, 10], aB: [-100, 10], lean: 0, face: 'shout', spin: true }) },
  nAir: { W: P({ lF: [60, 110], lB: [40, 110], aF: [80, 100] }), K: P({ lF: [80, 0], lB: [-70, 10], aF: [120, 20], aB: [-120, 20], spin: true, face: 'shout' }) },
  sAir: { W: P({ lF: [80, 130], lB: [10, 90], lean: -10 }), K: P({ lF: [96, 0], lB: [-10, 70], lean: -28, aF: [-40, 40], aB: [60, 40], face: 'shout' }) },
  dAir: { W: P({ lF: [80, 120], lB: [70, 120], aF: [140, 60], aB: [140, 60] }), K: P({ lF: [10, 0], lB: [-6, 0], aF: [160, 20], aB: [150, 20], lean: 0, face: 'shout' }) },
  recovery: { W: P({ bob: 10, aF: [10, 130], lF: [60, 90] }), K: P({ aF: [178, 0], aB: [170, 10], lF: [-10, 30], lB: [20, 60], lean: -8, face: 'shout', spin: true }) },
  pound: { W: P({ lF: [90, 140], lB: [90, 140], aF: [150, 40], aB: [150, 40], rot: -20 }), K: P({ lF: [4, 0], lB: [-4, 0], aF: [170, 10], aB: [170, 10], lean: 0, face: 'grit' }) },
};
function mix(a, b, t) {
  const o = {};
  for (const k in a) o[k] = Array.isArray(a[k]) ? a[k].map((v, i) => lerp(v, b[k][i], t)) : typeof a[k] === 'number' ? lerp(a[k], b[k] ?? a[k], t) : t < 0.5 ? a[k] : b[k];
  return o;
}
// La pose d'un combattant à cet instant.
function poseOf(f, t) {
  const sp = Math.abs(f.vx);
  if (f.state === 'run' || (f.state === 'idle' && sp > 0.8)) {
    const ph = (f.runPh ?? 0), s = Math.sin(ph), k = clamp(sp / 6, 0.3, 1);
    return P({ lean: 14 * k, bob: -Math.abs(Math.cos(ph)) * 4 * k, lF: [s * 50 * k + 10, Math.max(0, -Math.cos(ph)) * 80 * k + 10], lB: [-s * 50 * k + 10, Math.max(0, Math.cos(ph)) * 80 * k + 10], aF: [-s * 45 * k + 20, 80], aB: [s * 45 * k + 10, 70], face: 'calm' });
  }
  if (f.state === 'idle') return P({ bob: Math.sin(t * 3) * 1.4, aF: [24 + Math.sin(t * 3) * 3, 78], aB: [14, 62] });
  if (f.state === 'air') return f.vy < 0 ? P({ lF: [45, 80], lB: [-5, 50], aF: [-40, 50], aB: [-70, 40], lean: 6, sq: 1.06 }) : P({ lF: [20, 30], lB: [-25, 40], aF: [70, 30], aB: [100, 30], lean: -4 });
  if (f.state === 'lag') return P({ bob: 14, sq: 0.84, lF: [35, 70], lB: [-35, 70], aF: [50, 60], aB: [40, 60], face: 'grit' });
  if (f.state === 'dodge') return P({ bob: f.ground ? 10 : 0, lF: [70, 120], lB: [50, 120], aF: [60, 130], aB: [40, 130], lean: 30, face: 'calm', ghost: true });
  if (f.state === 'ledge') return P({ aF: [178, 12], aB: [172, 18], lF: [8, 25], lB: [-12, 35], lean: -6, face: 'grit', head: -10 });
  if (f.state === 'hitstun') { const w = t * 30; return P({ lF: [Math.sin(w) * 40 - 20, 40], lB: [Math.cos(w) * 40 + 20, 50], aF: [140 + Math.sin(w * 1.3) * 30, 30], aB: [-120 + Math.cos(w) * 30, 30], lean: -20, face: 'hurt', tumble: true }); }
  if (f.state === 'attack' && MOVE_POSES[f.move]) {
    const m = BR.movesOf(f)[f.move], h = m.hits[0], P2 = MOVE_POSES[f.move], mt = f.mt;
    if (mt < h.s) return mix(BASE, P2.W, ease(clamp(mt / Math.max(1, h.s), 0, 1)));
    if (mt <= h.e || m.pound) return mix(P2.W, P2.K, ease(clamp((mt - h.s + 1) / 2.5, 0, 1)));
    return mix(P2.K, BASE, ease(clamp((mt - h.e) / Math.max(1, m.f - h.e), 0, 1)));
  }
  return P({});
}

/* ---------------- Dessin d'un combattant ---------------- */
function limb(c, x, y, a1, a2, l1, l2, w, col, end, endCol) {
  const ex = x + Math.sin(rad(a1)) * l1, ey = y + Math.cos(rad(a1)) * l1;
  const tx = ex + Math.sin(rad(a1 + a2 * (end === 'foot' ? -1 : 1))) * l2, ty = ey + Math.cos(rad(a1 + a2 * (end === 'foot' ? -1 : 1))) * l2;
  c.lineCap = 'round'; c.lineJoin = 'round';
  c.strokeStyle = INK; c.lineWidth = w + 6;
  c.beginPath(); c.moveTo(x, y); c.lineTo(ex, ey); c.lineTo(tx, ty); c.stroke();
  c.strokeStyle = col; c.lineWidth = w;
  c.beginPath(); c.moveTo(x, y); c.lineTo(ex, ey); c.lineTo(tx, ty); c.stroke();
  c.fillStyle = endCol; c.strokeStyle = INK; c.lineWidth = 3;
  c.beginPath();
  if (end === 'foot') c.ellipse(tx + Math.cos(rad(a1)) * 4, ty + 1, w * 0.85, w * 0.55, 0, 0, TAU);
  else c.arc(tx, ty, w * 0.7, 0, TAU);
  c.fill(); c.stroke();
  return { x: tx, y: ty, a: a1 + a2 * (end === 'foot' ? -1 : 1) };
}
function blob(c, x, y, rx, ry, fill, rot = 0) { c.beginPath(); c.ellipse(x, y, rx, ry, rot, 0, TAU); c.fillStyle = fill; c.fill(); c.strokeStyle = INK; c.lineWidth = 3; c.stroke(); }

export function drawFighter(c, f, t, o = {}) {
  o.tip = null;
  const L = LOOKS[f.char], p = o.pose ?? poseOf(f, t), g = L.girth;
  c.save();
  c.translate(f.x, f.y);
  if (o.alpha !== undefined) c.globalAlpha = o.alpha;
  // vol plané : le corps tourne avec la vitesse
  let spin = 0;
  if (p.tumble) spin = (f.spinA ?? 0);
  if (p.spin && f.state === 'attack') { const m = BR.movesOf(f)[f.move], h = m.hits[0]; spin = clamp((f.mt - h.s) / Math.max(1, h.e - h.s), 0, 1) * TAU; }
  c.scale(f.facing, 1);
  const hipY = -40 + p.bob;
  c.translate(0, hipY);
  c.rotate(rad(p.rot) + spin);
  c.scale(2 - p.sq, p.sq);
  const sh = { x: 4, y: -L.torso + 6 };
  // ombre portée colorée (anneau du joueur)
  // membres arrière
  limb(c, -3, 0, p.lB[0], p.lB[1], L.limb, L.limb + 2, 11 * g, L.fur2, 'foot', L.dark);
  const backHand = limb(c, sh.x - 6, sh.y, p.aB[0], p.aB[1], L.arm, L.arm, 9 * g, L.fur2, 'hand', L.dark);
  if (f.weapon === 'pistolets' || f.weapon === 'gantelets') drawWeapon(c, f.weapon, backHand, g * 0.9);
  // queue de renard
  if (L.tail) {
    const sw = Math.sin(t * 5 + (f.x || 0) * 0.01) * 10 - clamp(f.vx * f.facing, -8, 8) * 3;
    c.save(); c.translate(-10, -4); c.rotate(rad(55 + sw));
    c.beginPath(); c.moveTo(0, 0); c.bezierCurveTo(-14, 10, -12, 34, 0, 46); c.bezierCurveTo(14, 34, 16, 10, 0, 0);
    c.fillStyle = L.fur; c.fill(); c.strokeStyle = INK; c.lineWidth = 3; c.stroke();
    c.beginPath(); c.moveTo(-8, 32); c.bezierCurveTo(-6, 40, -2, 46, 0, 46); c.bezierCurveTo(4, 44, 8, 40, 9, 32); c.closePath(); c.fillStyle = L.belly; c.fill(); c.stroke();
    c.restore();
  }
  // buste
  c.save(); c.rotate(rad(p.lean));
  const tw = 15 * g, th = L.torso;
  c.beginPath(); c.moveTo(-tw, 2); c.quadraticCurveTo(-tw - 3, -th * 0.6, -tw * 0.7, -th); c.lineTo(tw * 0.8, -th); c.quadraticCurveTo(tw + 4, -th * 0.5, tw, 2); c.quadraticCurveTo(0, 8, -tw, 2);
  c.fillStyle = L.fur; c.fill(); c.strokeStyle = INK; c.lineWidth = 3.5; c.stroke();
  c.save(); c.clip();
  c.fillStyle = L.belly; c.beginPath(); c.ellipse(tw * 0.35, -th * 0.45, tw * 0.6, th * 0.5, 0, 0, TAU); c.fill();
  c.fillStyle = 'rgba(0,0,0,.14)'; c.fillRect(-tw - 4, -th - 4, tw * 0.6, th + 10); // ombre
  if (f.char === 'gromm') { // tablier de forgeron
    c.fillStyle = L.vest; c.beginPath(); c.moveTo(-tw * 0.3, -th * 0.7); c.lineTo(tw * 0.95, -th * 0.7); c.lineTo(tw * 1.1, 4); c.lineTo(-tw * 0.4, 4); c.closePath(); c.fill(); c.strokeStyle = INK; c.lineWidth = 2; c.stroke();
    c.fillStyle = '#c8a040'; c.fillRect(tw * 0.25, -th * 0.42, 8, 6);
  } else { // gilet de cuir
    c.fillStyle = L.vest; c.beginPath(); c.moveTo(-tw, -th); c.lineTo(tw * 0.1, -th); c.lineTo(-tw * 0.2, 4); c.lineTo(-tw - 2, 4); c.closePath(); c.fill();
  }
  c.restore();
  // ceinture
  c.fillStyle = L.dark; c.fillRect(-tw - 1, -6, tw * 2 + 2, 6);
  c.fillStyle = '#e8c050'; c.fillRect(tw * 0.3, -6.5, 6, 7);
  // tête
  const hr = L.head, hx = 6, hy = -th - hr * 0.72;
  c.save(); c.translate(hx, hy); c.rotate(rad(p.head));
  // écharpe qui flotte derrière
  const wind = clamp(-f.vx * f.facing * 1.6, -12, 12) - 8, wave = Math.sin(t * 9) * 4;
  c.beginPath(); c.moveTo(-6, hr * 0.7); c.quadraticCurveTo(-22 + wind, hr * 0.8 + wave, -34 + wind * 1.6, hr * 0.4 - wave); c.lineTo(-30 + wind * 1.5, hr * 1.1 - wave); c.quadraticCurveTo(-18 + wind, hr * 1.3 + wave, -4, hr * 1.1); c.closePath();
  c.fillStyle = L.scarf2; c.fill(); c.strokeStyle = INK; c.lineWidth = 3; c.stroke();
  // oreilles
  if (L.ears === 'fox') for (const [ex, a] of [[-8, -0.35], [6, 0.2]]) { c.save(); c.translate(ex, -hr * 0.7); c.rotate(a); c.beginPath(); c.moveTo(-7, 4); c.lineTo(0, -16); c.lineTo(8, 4); c.closePath(); c.fillStyle = L.fur; c.fill(); c.strokeStyle = INK; c.lineWidth = 3; c.stroke(); c.beginPath(); c.moveTo(-3, 2); c.lineTo(0, -10); c.lineTo(4, 2); c.closePath(); c.fillStyle = L.dark; c.fill(); c.restore(); }
  else for (const ex of [-11, 9]) { blob(c, ex, -hr * 0.78, 7, 7, L.fur); blob(c, ex, -hr * 0.78, 3.5, 3.5, L.fur2); }
  // crâne et museau
  blob(c, 0, 0, hr, hr * 0.94, L.fur);
  c.save(); c.beginPath(); c.ellipse(0, 0, hr, hr * 0.94, 0, 0, TAU); c.clip(); c.fillStyle = 'rgba(0,0,0,.13)'; c.beginPath(); c.ellipse(-hr * 0.6, 2, hr * 0.6, hr, 0, 0, TAU); c.fill(); c.restore();
  const snout = f.char === 'fenna' ? 1.15 : 0.95;
  c.beginPath(); c.ellipse(hr * 0.62, hr * 0.32, hr * 0.62 * snout, hr * 0.42, 0.1, 0, TAU); c.fillStyle = L.belly; c.fill(); c.strokeStyle = INK; c.lineWidth = 3; c.stroke();
  blob(c, hr * 0.62 + hr * 0.55 * snout, hr * 0.18, 4, 3.4, INK);
  if (f.char === 'fenna') { c.fillStyle = '#5a4a3a'; c.fillRect(-hr * 0.8, -hr * 0.62, hr * 1.4, 5); blob(c, hr * 0.1, -hr * 0.6, 6, 5, '#9fe0ff'); blob(c, -hr * 0.55, -hr * 0.6, 5, 5, '#9fe0ff'); } // lunettes d'aviateur
  else { c.fillStyle = L.scarf; c.beginPath(); c.moveTo(-hr, -hr * 0.35); c.quadraticCurveTo(0, -hr * 1.15, hr, -hr * 0.4); c.lineTo(hr * 0.9, -hr * 0.62); c.quadraticCurveTo(0, -hr * 1.35, -hr * 0.95, -hr * 0.6); c.closePath(); c.fill(); c.strokeStyle = INK; c.lineWidth = 2.5; c.stroke(); } // bandana
  // œil et sourcil selon l'humeur
  const ex = hr * 0.32, ey = -hr * 0.12, blink = Math.sin(t * 1.7 + (f.char === 'gromm' ? 1 : 0)) > 0.985;
  if (p.face === 'hurt') { c.strokeStyle = INK; c.lineWidth = 3; c.beginPath(); c.moveTo(ex - 4, ey - 4); c.lineTo(ex + 4, ey + 4); c.moveTo(ex + 4, ey - 4); c.lineTo(ex - 4, ey + 4); c.stroke(); }
  else if (blink) { c.strokeStyle = INK; c.lineWidth = 3; c.beginPath(); c.moveTo(ex - 4, ey); c.lineTo(ex + 4, ey); c.stroke(); }
  else { blob(c, ex, ey, 4.6, 5.6, '#ffffff'); c.fillStyle = INK; c.beginPath(); c.arc(ex + 1.5, ey + 0.5, 2.6, 0, TAU); c.fill(); c.fillStyle = '#fff'; c.beginPath(); c.arc(ex + 2.3, ey - 1, 1, 0, TAU); c.fill(); }
  c.strokeStyle = INK; c.lineWidth = 3.4; c.beginPath();
  const bdy = p.face === 'grit' || p.face === 'shout' ? 3 : p.face === 'hurt' ? -2 : 0;
  c.moveTo(ex - 6, ey - 8 - (p.face === 'hurt' ? 2 : 0)); c.lineTo(ex + 6, ey - 8 + bdy); c.stroke();
  // bouche
  c.beginPath();
  if (p.face === 'shout' || p.face === 'hurt') { c.ellipse(hr * 0.72, hr * 0.56, 4, 3.4, 0, 0, TAU); c.fillStyle = '#6a1a20'; c.fill(); c.stroke(); }
  else if (p.face === 'grit') { c.rect(hr * 0.5, hr * 0.5, 8, 3); c.fillStyle = '#fff'; c.fill(); c.lineWidth = 2; c.stroke(); }
  else { c.lineWidth = 2.4; c.moveTo(hr * 0.5, hr * 0.55); c.quadraticCurveTo(hr * 0.75, hr * 0.72, hr * 0.98, hr * 0.5); c.stroke(); }
  c.restore();
  c.restore();
  // jambe et bras avant
  limb(c, 3, 0, p.lF[0], p.lF[1], L.limb, L.limb + 2, 12 * g, L.fur, 'foot', L.dark);
  c.save(); c.rotate(rad(p.lean));
  const hand = limb(c, sh.x + 4, sh.y, p.aF[0], p.aF[1], L.arm, L.arm, 10 * g, L.fur, 'hand', f.char === 'gromm' ? '#8a8f98' : L.dark);
  if (f.weapon) o.tip = drawWeapon(c, f.weapon, hand, g, true);
  c.restore();
  c.restore();
  return o.tip;
}
// Une arme dans la main (h : position et angle de l'avant-bras). Renvoie la pointe, en pixels de l'écran (pour la traînée).
const METAL = '#d8dde6', STEEL = '#9aa2ae', WOOD = '#8a5a34', GOLD = '#e8b84a';
export function drawWeapon(c, w, h, g = 1, held = false) {
  c.save(); c.translate(h.x, h.y); c.rotate(-rad(h.a)); // l'axe +y suit l'avant-bras, vers l'extérieur
  c.lineJoin = 'round'; c.lineCap = 'round'; c.strokeStyle = INK; c.lineWidth = 3;
  let tip = 60;
  const shape = (pts, fill) => { c.beginPath(); pts.forEach(([x, y], k) => (k ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath(); c.fillStyle = fill; c.fill(); c.stroke(); };
  if (w === 'epee') { shape([[-3, -8], [3, -8], [3, 6], [-3, 6]], WOOD); shape([[-12, 6], [12, 6], [12, 11], [-12, 11]], GOLD); shape([[-5, 11], [5, 11], [4, 66], [0, 76], [-4, 66]], METAL); c.strokeStyle = 'rgba(255,255,255,.7)'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(1.5, 14); c.lineTo(1, 64); c.stroke(); tip = 76; }
  if (w === 'lance') { c.strokeStyle = INK; c.lineWidth = 9; c.beginPath(); c.moveTo(0, -40); c.lineTo(0, 108); c.stroke(); c.strokeStyle = WOOD; c.lineWidth = 5; c.stroke(); shape([[0, 102], [9, 118], [0, 140], [-9, 118]], METAL); shape([[-7, 100], [7, 100], [5, 106], [-5, 106]], '#c8402e'); tip = 140; }
  if (w === 'marteau') { c.strokeStyle = INK; c.lineWidth = 10; c.beginPath(); c.moveTo(0, -8); c.lineTo(0, 62); c.stroke(); c.strokeStyle = WOOD; c.lineWidth = 6; c.stroke(); shape([[-22, 56], [22, 56], [24, 86], [-24, 86]], STEEL); shape([[-22, 56], [22, 56], [20, 62], [-20, 62]], METAL); shape([[-6, 60], [6, 60], [6, 84], [-6, 84]], '#6a7080'); tip = 86; }
  if (w === 'hache') { c.strokeStyle = INK; c.lineWidth = 9; c.beginPath(); c.moveTo(0, -8); c.lineTo(0, 70); c.stroke(); c.strokeStyle = WOOD; c.lineWidth = 5; c.stroke(); c.beginPath(); c.moveTo(2, 44); c.quadraticCurveTo(34, 40, 36, 60); c.quadraticCurveTo(34, 82, 2, 74); c.closePath(); c.fillStyle = METAL; c.fill(); c.stroke(); tip = 70; }
  if (w === 'pistolets') { shape([[-4, -2], [4, -2], [6, 10], [-3, 12]], WOOD); shape([[-3, 6], [4, 6], [4, 34], [-3, 34]], STEEL); c.fillStyle = GOLD; c.beginPath(); c.arc(0, 10, 3, 0, TAU); c.fill(); tip = 34; }
  if (w === 'gantelets') { c.beginPath(); c.arc(0, 4, 11 * g, 0, TAU); c.fillStyle = STEEL; c.fill(); c.stroke(); c.fillStyle = METAL; c.beginPath(); c.arc(-3, 1, 5 * g, 0, TAU); c.fill(); for (const k of [-6, 0, 6]) { c.beginPath(); c.arc(k * g, 12 * g, 2.5, 0, TAU); c.fillStyle = GOLD; c.fill(); } tip = 14; }
  const m = c.getTransform(), q = m.transformPoint(new DOMPoint(0, tip));
  c.restore();
  return held ? { x: q.x, y: q.y } : null;
}
// Portrait : en pied (cartes de choix) ou en buste (cartes du combat).
export function drawPortrait(canvas, char, bust = false) {
  const c = canvas.getContext('2d'), w = canvas.width, h = canvas.height, s = bust ? h / 54 : h / 140;
  c.clearRect(0, 0, w, h);
  c.save(); c.translate(w / 2 - (bust ? 6 * s : 0), bust ? h * 1.95 : h * 0.96); c.scale(s, s);
  drawFighter(c, { char, x: 0, y: 0, facing: 1, state: 'idle', vx: 0, vy: 0 }, 0.3);
  c.restore();
}

/* ---------------- L'arène, en couches ---------------- */
function layer(w, h, draw) { const cv = document.createElement('canvas'); cv.width = w; cv.height = h; draw(cv.getContext('2d'), w, h); return cv; }
function cloud(c, x, y, s, col, shade) {
  c.fillStyle = col;
  for (const [dx, dy, r] of [[0, 0, 1], [0.9, 0.2, 0.75], [-0.9, 0.25, 0.7], [0.4, -0.5, 0.7], [-0.4, -0.35, 0.6], [1.6, 0.4, 0.5], [-1.6, 0.45, 0.45]]) { c.beginPath(); c.arc(x + dx * s, y + dy * s, r * s, 0, TAU); c.fill(); }
  if (shade) { c.fillStyle = shade; c.fillRect(x - s * 2.2, y + s * 0.45, s * 4.4, s * 0.6); }
}
function island(c, x0, x1, y, depth, top, rock, rock2, opts = {}) {
  const w = x1 - x0;
  c.beginPath(); c.moveTo(x0 - 6, y);
  for (let k = 0; k <= 16; k++) { const t = k / 16, xx = x0 + w * t, dd = depth * (0.35 + Math.sin(t * Math.PI) * 0.65) * (0.85 + rnd() * 0.3); c.lineTo(xx, y + dd); }
  c.lineTo(x1 + 6, y); c.closePath();
  const g = c.createLinearGradient(0, y, 0, y + depth); g.addColorStop(0, rock); g.addColorStop(1, rock2);
  c.fillStyle = g; c.fill(); if (opts.ink) { c.strokeStyle = INK; c.lineWidth = 4; c.stroke(); }
  c.fillStyle = top; c.beginPath(); c.moveTo(x0 - 8, y + 2); c.lineTo(x1 + 8, y + 2); c.lineTo(x1 + 4, y - 8); c.quadraticCurveTo((x0 + x1) / 2, y - 16, x0 - 4, y - 8); c.closePath(); c.fill(); if (opts.ink) { c.stroke(); }
}
export function createRenderer(canvas) {
  const c = canvas.getContext('2d');
  const A = BR.ARENAS.phare;
  let W = 0, H = 0, dpr = 1;
  // ciel
  const sky = layer(16, 512, (x, w, h) => { const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#2b3f78'); g.addColorStop(0.35, '#6b6fb0'); g.addColorStop(0.62, '#f2a07a'); g.addColorStop(0.8, '#ffd59a'); g.addColorStop(1, '#ffe8c2'); x.fillStyle = g; x.fillRect(0, 0, w, h); });
  // îles lointaines (bleutées)
  const far = layer(2400, 500, (x, w, h) => {
    for (let k = 0; k < 7; k++) { const cx = 150 + k * 340 + rnd() * 80, wd = 120 + rnd() * 160, y = 200 + rnd() * 140; island(x, cx - wd / 2, cx + wd / 2, y, 60 + rnd() * 80, '#8a97c8', '#7a84b8', '#9aa4d0'); for (let i = 0; i < 4; i++) { x.fillStyle = '#7480b0'; x.beginPath(); const tx = cx - wd / 3 + rnd() * wd * 0.66; x.moveTo(tx, y - 6); x.lineTo(tx - 7, y + 4); x.lineTo(tx + 7, y + 4); x.fill(); x.fillRect(tx - 1, y - 30 + 20, 2, 10); x.beginPath(); x.moveTo(tx, y - 34); x.lineTo(tx - 9, y - 6); x.lineTo(tx + 9, y - 6); x.fill(); } }
  });
  const sea = layer(2400, 300, (x, w, h) => { for (let k = 0; k < 60; k++) cloud(x, rnd() * w, 60 + rnd() * 200, 30 + rnd() * 50, `rgba(255,${230 + rnd() * 20},${220 + rnd() * 30},${0.75 + rnd() * 0.25})`); });
  const mid = layer(2600, 400, (x, w, h) => { for (let k = 0; k < 14; k++) cloud(x, rnd() * w, 60 + rnd() * 280, 24 + rnd() * 30, 'rgba(255,240,235,.85)', 'rgba(220,170,180,.25)'); });
  // l'île du phare (plan moyen)
  const lighthouse = layer(700, 700, (x, w, h) => {
    island(x, 120, 580, 470, 200, '#5f9a48', '#8a7058', '#4a3a40', { ink: true });
    x.strokeStyle = INK; x.lineWidth = 4;
    const bx = 330, by = 470;
    x.fillStyle = '#f4ece0'; x.beginPath(); x.moveTo(bx - 40, by); x.lineTo(bx - 26, by - 250); x.lineTo(bx + 26, by - 250); x.lineTo(bx + 40, by); x.closePath(); x.fill(); x.stroke();
    x.save(); x.clip(); x.fillStyle = '#d8433a'; for (let k = 0; k < 4; k++) x.fillRect(bx - 50, by - 50 - k * 60, 100, 26); x.restore();
    x.fillStyle = '#3a2a40'; x.fillRect(bx - 34, by - 262, 68, 14); x.strokeRect(bx - 34, by - 262, 68, 14);
    x.fillStyle = '#ffe9a0'; x.fillRect(bx - 22, by - 300, 44, 38); x.strokeRect(bx - 22, by - 300, 44, 38);
    x.fillStyle = '#d8433a'; x.beginPath(); x.moveTo(bx - 30, by - 300); x.lineTo(bx, by - 336); x.lineTo(bx + 30, by - 300); x.closePath(); x.fill(); x.stroke();
    x.fillStyle = '#6a4a3a'; x.fillRect(bx - 10, by - 40, 20, 40); x.strokeRect(bx - 10, by - 40, 20, 40);
    x.fillStyle = '#8a5a3a'; x.fillRect(180, by - 50, 60, 50); x.strokeRect(180, by - 50, 60, 50); x.fillStyle = '#b84a3a'; x.beginPath(); x.moveTo(170, by - 50); x.lineTo(210, by - 82); x.lineTo(250, by - 50); x.closePath(); x.fill(); x.stroke(); x.fillStyle = '#ffe9a0'; x.fillRect(196, by - 36, 14, 14);
  });
  // l'île de combat, dessinée une fois (1,5 fois plus fine que l'écran)
  const S = A.solids[0], RS = 1.5, SX0 = S.x0 - 140, SY0 = -470, SW = S.x1 - S.x0 + 280, SH = 870;
  const stage = layer(SW * RS, SH * RS, (x) => {
    x.scale(RS, RS); x.translate(-SX0, -SY0);
    // corps rocheux : strates, fissures, racines
    x.beginPath(); x.moveTo(S.x0 - 20, 0);
    const pts = [];
    for (let k = 0; k <= 22; k++) { const t = k / 22, xx = lerp(S.x0 - 20, S.x1 + 20, t), d = 70 + Math.sin(t * Math.PI) * 300 + (rnd() - 0.5) * 40; pts.push([xx, d]); x.lineTo(xx, d); }
    x.lineTo(S.x1 + 20, 0); x.closePath();
    const g = x.createLinearGradient(0, 0, 0, 380); g.addColorStop(0, '#a07a5a'); g.addColorStop(0.5, '#7a5a4a'); g.addColorStop(1, '#3e2c3a');
    x.fillStyle = g; x.fill(); x.strokeStyle = INK; x.lineWidth = 5; x.stroke();
    x.save(); x.clip();
    for (let k = 0; k < 9; k++) { x.strokeStyle = `rgba(40,25,30,${0.15 + rnd() * 0.15})`; x.lineWidth = 3 + rnd() * 4; x.beginPath(); const y = 30 + k * 34; x.moveTo(S.x0 - 30, y); for (let xx = S.x0; xx < S.x1 + 40; xx += 40) x.lineTo(xx, y + Math.sin(xx * 0.02 + k) * 8); x.stroke(); }
    for (let k = 0; k < 40; k++) { x.fillStyle = `rgba(${rnd() < 0.5 ? '255,230,200' : '40,20,30'},${0.08 + rnd() * 0.12})`; x.beginPath(); x.ellipse(S.x0 + rnd() * (S.x1 - S.x0), 20 + rnd() * 260, 10 + rnd() * 30, 6 + rnd() * 14, rnd(), 0, TAU); x.fill(); }
    for (let k = 0; k < 14; k++) { x.strokeStyle = 'rgba(30,15,25,.5)'; x.lineWidth = 2; x.beginPath(); let xx = S.x0 + rnd() * (S.x1 - S.x0), y = 20 + rnd() * 120; x.moveTo(xx, y); for (let i = 0; i < 5; i++) { xx += (rnd() - 0.5) * 30; y += 10 + rnd() * 16; x.lineTo(xx, y); } x.stroke(); }
    x.restore();
    // racines et lianes qui pendent
    for (let k = 0; k < 16; k++) { const [rx, ry] = pts[1 + Math.floor(rnd() * (pts.length - 2))]; x.strokeStyle = rnd() < 0.5 ? '#4a3a2a' : '#3f7a3a'; x.lineWidth = 3 + rnd() * 3; x.beginPath(); x.moveTo(rx, ry - 5); x.bezierCurveTo(rx + 10, ry + 30, rx - 15, ry + 50, rx + (rnd() - 0.5) * 20, ry + 60 + rnd() * 60); x.stroke(); }
    // herbe et fleurs sur le dessus
    x.fillStyle = '#5fb04a'; x.beginPath(); x.moveTo(S.x0 - 26, 6); x.lineTo(S.x1 + 26, 6); x.lineTo(S.x1 + 20, -6); x.quadraticCurveTo(0, -14, S.x0 - 20, -6); x.closePath(); x.fill(); x.strokeStyle = INK; x.lineWidth = 4; x.stroke();
    x.fillStyle = '#4a9a3a'; x.fillRect(S.x0 - 24, 4, S.x1 - S.x0 + 48, 10);
    for (let xx = S.x0 - 18; xx < S.x1 + 18; xx += 5) { x.strokeStyle = rnd() < 0.5 ? '#7ad05a' : '#3f8a32'; x.lineWidth = 2; x.beginPath(); x.moveTo(xx, -4); x.lineTo(xx + (rnd() - 0.5) * 6, -12 - rnd() * 8); x.stroke(); }
    for (let k = 0; k < 26; k++) { const xx = S.x0 + rnd() * (S.x1 - S.x0); x.fillStyle = ['#ff6a8a', '#ffe14a', '#ffffff', '#b08aff'][k % 4]; x.beginPath(); x.arc(xx, -12 - rnd() * 6, 3, 0, TAU); x.fill(); }
    // pierres de bord et touffes pendantes
    for (const sx of [S.x0 - 14, S.x1 + 14]) { x.fillStyle = '#8a8070'; x.beginPath(); x.ellipse(sx, 10, 18, 14, 0, 0, TAU); x.fill(); x.strokeStyle = INK; x.lineWidth = 3; x.stroke(); }
    // petits rochers flottants dessous
    for (let k = 0; k < 6; k++) { const xx = S.x0 + 60 + rnd() * (S.x1 - S.x0 - 120), y = 330 + rnd() * 120; island(x, xx - 20, xx + 20, y, 30, '#5fa048', '#8a6a5a', '#4a3a40', { ink: true }); }
    // planches suspendues
    for (const p of A.plats) {
      const cx = (p.x0 + p.x1) / 2;
      for (const ax of [p.x0 + 14, p.x1 - 14]) { x.strokeStyle = '#3a2a20'; x.lineWidth = 3; x.beginPath(); x.moveTo(ax, p.y); x.lineTo(ax + (ax < cx ? -8 : 8), p.y - 60); x.stroke(); }
      blob(x, cx, p.y - 74, 26, 18, '#9a8a7a'); x.fillStyle = '#5fa048'; x.fillRect(cx - 24, p.y - 92, 48, 6);
      for (let k = 0; k < Math.floor((p.x1 - p.x0) / 28); k++) { const px = p.x0 + k * 28; x.fillStyle = k % 2 ? '#b07a4a' : '#a06a3e'; x.fillRect(px, p.y - 2, 27, 14); x.strokeStyle = INK; x.lineWidth = 2.5; x.strokeRect(px, p.y - 2, 27, 14); x.fillStyle = '#3a3030'; x.beginPath(); x.arc(px + 5, p.y + 5, 1.6, 0, TAU); x.arc(px + 22, p.y + 5, 1.6, 0, TAU); x.fill(); }
      x.fillStyle = '#5a3a24'; x.fillRect(p.x0 - 2, p.y + 12, p.x1 - p.x0 + 4, 5); x.strokeRect(p.x0 - 2, p.y + 12, p.x1 - p.x0 + 4, 5);
      x.fillStyle = '#ffd87a'; x.beginPath(); x.arc(cx, p.y + 32, 7, 0, TAU); x.fill(); x.strokeStyle = INK; x.lineWidth = 2.5; x.stroke(); x.beginPath(); x.moveTo(cx, p.y + 17); x.lineTo(cx, p.y + 25); x.stroke();
    }
  });

  /* ---- Effets ---- */
  const parts = [], texts = [];
  let shake = 0, flash = 0, focus = null;
  const trails = {}; // traînées des coups d'arme, en pixels de l'écran
  const cam = { x: 0, y: -150, z: 0.8 };
  const fx = {
    hit(e, colA) {
      const n = e.heavy ? 22 : 12;
      for (let k = 0; k < n; k++) { const a = rnd() * TAU, s = (e.heavy ? 9 : 6) * (0.5 + rnd()); parts.push({ k: 'spark', x: e.x, y: e.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.3 + rnd() * 0.2, max: 0.5, c: k % 3 ? '#fff3a0' : colA }); }
      parts.push({ k: 'ring', x: e.x, y: e.y, r: 8, vr: e.heavy ? 520 : 320, life: 0.25, max: 0.25, c: '#ffffff' });
      parts.push({ k: 'star', x: e.x, y: e.y, r: e.heavy ? 34 : 20, life: 0.12, max: 0.12, c: '#ffffff' });
      if (e.heavy || e.v > 14) texts.push({ x: e.x, y: e.y - 40, s: e.v > 16 ? 'BAM !' : ['PAF !', 'VLAN !', 'BIM !', 'POW !'][Math.floor(rnd() * 4)], life: 0.8, max: 0.8, c: colA });
      shake = Math.max(shake, e.heavy ? 14 : 5);
    },
    ko(e, col) {
      for (let k = 0; k < 70; k++) { const a = Math.atan2(-e.y + cam.y, -e.x + cam.x) + (rnd() - 0.5) * 1.6, s = 10 + rnd() * 26; parts.push({ k: 'spark', x: e.x, y: e.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.6 + rnd() * 0.5, max: 1.1, c: k % 2 ? col : '#ffffff', w: 6 }); }
      parts.push({ k: 'beam', x: e.x, y: e.y, a: Math.atan2(-e.y + cam.y, -e.x + cam.x), life: 0.9, max: 0.9, c: col });
      parts.push({ k: 'ring', x: e.x, y: e.y, r: 20, vr: 1400, life: 0.5, max: 0.5, c: col });
      shake = 30; flash = 0.35;
    },
    dust(x, y, n = 6, s = 1) { for (let k = 0; k < n; k++) parts.push({ k: 'dust', x: x + (rnd() - 0.5) * 20 * s, y: y - 4, vx: (rnd() - 0.5) * 3 * s, vy: -rnd() * 1.6, r: (6 + rnd() * 8) * s, life: 0.5 + rnd() * 0.3, max: 0.8, c: 'rgba(240,225,205,' }); },
    ring(x, y, c = '#ffffff', r = 6, vr = 180) { parts.push({ k: 'ring', x, y, r, vr, life: 0.3, max: 0.3, c }); },
    focus(x, y) { focus = { x, y, t: 0.55 }; },
    combo(x, y, n, col) { texts.push({ x: x + 30, y: y - 70, s: `×${n} COMBO`, life: 0.9, max: 0.9, c: col, small: true }); },
    trail(f, col) { parts.push({ k: 'ghost', f: { ...f }, life: 0.25, max: 0.25, c: col }); },
    streak(x, y, vx, vy, col) { parts.push({ k: 'streak', x, y, vx, vy, life: 0.35, max: 0.35, c: col }); },
  };

  function resize() {
    dpr = Math.min(devicePixelRatio || 1, 2);
    W = canvas.clientWidth; H = canvas.clientHeight;
    canvas.width = W * dpr; canvas.height = H * dpr;
  }

  // Une image : caméra qui cadre tout le monde, décor en couches, combattants, effets.
  let gulls = Array.from({ length: 5 }, () => ({ x: rnd() * 2000 - 1000, y: -500 - rnd() * 250, s: 0.6 + rnd() * 0.5, v: 30 + rnd() * 30 }));
  function draw(list, dt, t, colors, items = [], shots = []) {
    // caméra
    const live = list.filter(f => f.state !== 'out' && f.state !== 'dead');
    let x0 = -500, x1 = 500, y0 = -450, y1 = 120;
    if (live.length) { x0 = Math.min(...live.map(f => f.x)) - 260; x1 = Math.max(...live.map(f => f.x)) + 260; y0 = Math.min(...live.map(f => f.y)) - 300; y1 = Math.max(...live.map(f => f.y)) + 180; }
    x0 = Math.min(x0, -480); x1 = Math.max(x1, 480); y1 = Math.max(y1, 160); y0 = Math.min(y0, -420);
    const tz = clamp(Math.min(W / (x1 - x0), H / (y1 - y0)), 0.42, 1.25);
    const k = 1 - Math.exp(-dt * 4);
    let fx0 = (x0 + x1) / 2, fy0 = (y0 + y1) / 2, fz = tz, kk = k;
    if (focus) { focus.t -= dt; fx0 = focus.x; fy0 = focus.y; fz = Math.min(1.6, tz * 1.6); kk = 1 - Math.exp(-dt * 12); if (focus.t <= 0) focus = null; }
    cam.z = lerp(cam.z, fz, kk); cam.x = lerp(cam.x, fx0, kk); cam.y = lerp(cam.y, fy0, kk);
    shake = Math.max(0, shake - dt * 60); flash = Math.max(0, flash - dt);
    const sx = (rnd() - 0.5) * shake, sy = (rnd() - 0.5) * shake;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    // ciel et soleil
    c.drawImage(sky, 0, 0, W, H);
    const sunX = W * 0.72 - cam.x * 0.02, sunY = H * 0.62 - cam.y * 0.02;
    const sg = c.createRadialGradient(sunX, sunY, 0, sunX, sunY, H * 0.5); sg.addColorStop(0, 'rgba(255,240,190,.95)'); sg.addColorStop(0.12, 'rgba(255,220,150,.6)'); sg.addColorStop(1, 'rgba(255,200,150,0)'); c.fillStyle = sg; c.fillRect(0, 0, W, H);
    c.fillStyle = '#fff6d8'; c.beginPath(); c.arc(sunX, sunY, H * 0.06, 0, TAU); c.fill();
    // couches lointaines
    const par = (img, f, y, scale = 1) => { const s = cam.z * scale, w = img.width * s, ox = ((W / 2 - (cam.x * f) * cam.z - w / 2) % w + w) % w - w; for (let xx = ox; xx < W; xx += w) c.drawImage(img, xx, H / 2 + (y - cam.y * f) * cam.z, w, img.height * s); };
    par(far, 0.15, -520, 0.9);
    // île du phare + faisceau qui tourne
    const lz = cam.z * 0.75, lx = W / 2 + (-900 - cam.x * 0.35) * cam.z, ly = H / 2 + (-760 - cam.y * 0.35) * cam.z;
    const ba = Math.sin(t * 0.6) * 0.9, bx = lx + 330 * lz, by = ly + 190 * lz;
    c.save(); c.globalCompositeOperation = 'lighter'; const bg = c.createRadialGradient(bx, by, 0, bx, by, 900 * lz); bg.addColorStop(0, 'rgba(255,240,180,.35)'); bg.addColorStop(1, 'rgba(255,240,180,0)'); c.fillStyle = bg; c.beginPath(); c.moveTo(bx, by); c.arc(bx, by, 900 * lz, ba - 0.12 + Math.PI * (Math.cos(t * 0.6) > 0 ? 0 : 1), ba + 0.12 + Math.PI * (Math.cos(t * 0.6) > 0 ? 0 : 1)); c.closePath(); c.fill(); c.restore();
    c.drawImage(lighthouse, lx, ly, 700 * lz, 700 * lz);
    par(sea, 0.3, 260, 1);
    // mouettes
    for (const gl of gulls) { gl.x += gl.v * dt; if (gl.x > 1400) gl.x = -1400; const gx = W / 2 + (gl.x - cam.x * 0.5) * cam.z, gy = H / 2 + (gl.y - cam.y * 0.5) * cam.z, fl = Math.sin(t * 8 + gl.x) * 6 * gl.s; c.strokeStyle = '#3a3050'; c.lineWidth = 2.5; c.beginPath(); c.moveTo(gx - 12 * gl.s, gy - fl); c.quadraticCurveTo(gx - 5 * gl.s, gy - 8 * gl.s, gx, gy); c.quadraticCurveTo(gx + 5 * gl.s, gy - 8 * gl.s, gx + 12 * gl.s, gy - fl); c.stroke(); }
    par(mid, 0.55, -380, 1);
    // le monde (caméra)
    c.setTransform(dpr * cam.z, 0, 0, dpr * cam.z, dpr * (W / 2 - cam.x * cam.z + sx), dpr * (H / 2 - cam.y * cam.z + sy));
    // cascade qui tombe du bord de l'île
    c.fillStyle = 'rgba(180,230,255,.55)'; c.fillRect(S.x1 - 70, 60, 26, 700);
    for (let k = 0; k < 10; k++) { c.fillStyle = 'rgba(255,255,255,.55)'; const yy = 60 + (((t * 260 + k * 70) % 700)); c.fillRect(S.x1 - 66, yy, 18, 22); }
    c.drawImage(stage, SX0, SY0, SW, SH);
    // caisses d'armes : rayon de lumière en tombant, éclat posées
    for (const [, ix, iy, gr] of items) {
      if (!gr) { c.save(); c.globalCompositeOperation = 'lighter'; const lg = c.createLinearGradient(ix, iy, ix, iy + 900); lg.addColorStop(0, 'rgba(255,230,140,.5)'); lg.addColorStop(1, 'rgba(255,230,140,0)'); c.fillStyle = lg; c.fillRect(ix - 16, iy, 32, 900); c.restore(); }
      const bob = gr ? Math.sin(t * 4 + ix) * 3 : 0, y = iy - 22 + bob;
      c.save(); c.globalCompositeOperation = 'lighter'; const gg = c.createRadialGradient(ix, y, 0, ix, y, 46); gg.addColorStop(0, 'rgba(255,220,120,.7)'); gg.addColorStop(1, 'rgba(255,220,120,0)'); c.fillStyle = gg; c.beginPath(); c.arc(ix, y, 46, 0, TAU); c.fill(); c.restore();
      c.save(); c.translate(ix, y); c.rotate(Math.sin(t * 2 + ix) * 0.1);
      c.fillStyle = '#b8783e'; c.strokeStyle = INK; c.lineWidth = 3; c.fillRect(-18, -16, 36, 32); c.strokeRect(-18, -16, 36, 32);
      c.fillStyle = GOLD; c.fillRect(-18, -3, 36, 6); c.strokeRect(-18, -3, 36, 6);
      c.font = '20px serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('⚔️', 0, 0);
      c.restore();
    }
    for (const [, kind, sx, sy, svx, svy, sw, spin] of shots) {
      if (kind === 'balle') { c.save(); c.globalCompositeOperation = 'lighter'; c.strokeStyle = '#ffe07a'; c.lineWidth = 6; c.beginPath(); c.moveTo(sx, sy); c.lineTo(sx - svx * 2.2, sy - svy * 2.2); c.stroke(); c.fillStyle = '#ffffff'; c.beginPath(); c.arc(sx, sy, 4, 0, TAU); c.fill(); c.restore(); }
      else { c.save(); c.translate(sx, sy); drawWeapon(c, sw, { x: 0, y: -30, a: spin * 57.3 }); c.restore(); }
    }
    // ombres au sol et combattants
    for (const f of list) {
      if (f.state === 'out' || f.state === 'dead') continue;
      const gy = f.y <= 0 && f.x > S.x0 && f.x < S.x1 ? 0 : null;
      if (gy !== null) { const h = clamp(1 - (gy - f.y) / 400, 0.2, 1); c.fillStyle = `rgba(30,15,30,${0.28 * h})`; c.beginPath(); c.ellipse(f.x, gy, 26 * h, 6 * h, 0, 0, TAU); c.fill(); }
      const col = colors[f.id] ?? '#ffffff';
      if (f.invuln > 0 && Math.floor(t * 20) % 2) c.globalAlpha = 0.55;
      if (f.state === 'dodge') c.globalAlpha = 0.6;
      // anneau à la couleur du joueur
      c.strokeStyle = col; c.lineWidth = 4; c.beginPath(); c.ellipse(f.x, f.y + 2, 24, 6, 0, 0, TAU); c.stroke();
      const fo = {}, tip = drawFighter(c, f, t, fo);
      const tr = (trails[f.id] ??= []);
      if (tip && f.state === 'attack') { tr.push({ ...tip, t }); if (tr.length > 8) tr.shift(); } else tr.length = 0;
      c.globalAlpha = 1;
      if (f.flash > 0) { c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = f.flash; drawFighter(c, f, t); c.restore(); }
      // nom au-dessus
      c.font = '700 15px "Baloo 2", system-ui'; c.textAlign = 'center'; c.lineWidth = 4; c.strokeStyle = INK; c.strokeText(f.name ?? '', f.x, f.y - 112); c.fillStyle = col; c.fillText(f.name ?? '', f.x, f.y - 112);
    }
    // effets
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i]; p.life -= dt;
      if (p.life <= 0) { parts.splice(i, 1); continue; }
      const a = p.life / p.max;
      if (p.k === 'spark') { p.x += p.vx * dt * 60; p.y += p.vy * dt * 60; p.vx *= 0.9; p.vy *= 0.9; c.strokeStyle = p.c; c.globalAlpha = a; c.lineWidth = (p.w ?? 4) * a + 1; c.beginPath(); c.moveTo(p.x, p.y); c.lineTo(p.x - p.vx * 2, p.y - p.vy * 2); c.stroke(); }
      if (p.k === 'ring') { p.r += p.vr * dt; c.strokeStyle = p.c; c.globalAlpha = a; c.lineWidth = 6 * a; c.beginPath(); c.arc(p.x, p.y, p.r, 0, TAU); c.stroke(); }
      if (p.k === 'star') { c.fillStyle = p.c; c.globalAlpha = a; c.beginPath(); for (let k = 0; k < 16; k++) { const r = k % 2 ? p.r * 0.35 : p.r; c.lineTo(p.x + Math.cos((k / 16) * TAU) * r, p.y + Math.sin((k / 16) * TAU) * r); } c.fill(); }
      if (p.k === 'dust') { p.x += p.vx; p.y += p.vy; p.r += dt * 18; c.fillStyle = p.c + (0.6 * a) + ')'; c.globalAlpha = 1; c.beginPath(); c.arc(p.x, p.y, p.r, 0, TAU); c.fill(); }
      if (p.k === 'ghost') { c.globalAlpha = a * 0.5; drawFighter(c, p.f, t); }
      if (p.k === 'streak') { c.strokeStyle = p.c; c.globalAlpha = a * 0.8; c.lineWidth = 5 * a; c.beginPath(); c.moveTo(p.x, p.y); c.lineTo(p.x - p.vx * 3, p.y - p.vy * 3); c.stroke(); }
      if (p.k === 'beam') { c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = a; c.translate(p.x, p.y); c.rotate(p.a); const g = c.createLinearGradient(0, 0, 1400, 0); g.addColorStop(0, '#ffffff'); g.addColorStop(0.2, p.c); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.beginPath(); c.moveTo(0, 0); c.lineTo(1400, -220 * (1.2 - a)); c.lineTo(1400, 220 * (1.2 - a)); c.closePath(); c.fill(); c.restore(); }
      c.globalAlpha = 1;
    }
    for (let i = texts.length - 1; i >= 0; i--) {
      const tx = texts[i]; tx.life -= dt;
      if (tx.life <= 0) { texts.splice(i, 1); continue; }
      const a = tx.life / tx.max, s = 1 + (1 - a) * 0.25 + (a > 0.85 ? (a - 0.85) * 3 : 0);
      c.save(); c.translate(tx.x, tx.y - (1 - a) * 30); c.rotate(-0.12); c.scale(s, s); c.globalAlpha = Math.min(1, a * 2);
      c.font = `900 ${tx.small ? 26 : 38}px "Baloo 2", system-ui`; c.textAlign = 'center'; c.lineJoin = 'round'; c.lineWidth = 9; c.strokeStyle = INK; c.strokeText(tx.s, 0, 0); c.fillStyle = '#ffe14a'; c.fillText(tx.s, 0, 0); c.lineWidth = 2; c.strokeStyle = tx.c; c.strokeText(tx.s, 0, 0);
      c.restore();
    }
    // traînées d'arme (en pixels de l'écran)
    c.setTransform(1, 0, 0, 1, 0, 0);
    for (const [id, tr] of Object.entries(trails)) {
      if (tr.length < 2) continue;
      c.save(); c.globalCompositeOperation = 'lighter';
      for (let i = 1; i < tr.length; i++) { c.strokeStyle = `rgba(255,255,255,${(i / tr.length) * 0.7})`; c.lineWidth = (i / tr.length) * 14 * dpr; c.lineCap = 'round'; c.beginPath(); c.moveTo(tr[i - 1].x, tr[i - 1].y); c.lineTo(tr[i].x, tr[i].y); c.stroke(); }
      c.restore();
      void id;
    }
    // éclair de K.O.
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (flash > 0) { c.fillStyle = `rgba(255,255,255,${flash})`; c.fillRect(0, 0, W, H); }
  }
  return { resize, draw, fx, cam };
}
