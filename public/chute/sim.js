// Chute Libre : arène et déplacements, partagés par le serveur (robots, dalles) et le navigateur (son propre personnage).
// Script classique : window.Chute ou require().
// Trois étages de dalles hexagonales. Une dalle touchée craque puis tombe ; on chute à l'étage du dessous,
// et sous le dernier étage, c'est perdu.
(function (root) {
  const SIZE = 1; // rayon d'une dalle (m)
  const RAD = 7; // rayon de l'arène en dalles
  const LAYERS = [0, -7, -14, -21]; // hauteur de chaque étage
  const DEATH = -28; // en dessous : éliminé
  const SPEED = 5.6, ACCEL = 11, JUMP = 7.2, G = 21, DASH = 14, DASH_T = 0.22, DASH_CD = 2.4, CRACK = 0.45;
  const R = 0.45; // rayon d'un joueur
  const S3 = Math.sqrt(3);

  // Dalles : pour chaque étage, toutes les cases (q, r) à moins de RAD du centre.
  const tiles = [], index = new Map();
  LAYERS.forEach((h, layer) => {
    for (let q = -RAD; q <= RAD; q++) for (let r = Math.max(-RAD, -q - RAD); r <= Math.min(RAD, -q + RAD); r++) {
      index.set(`${layer},${q},${r}`, tiles.length);
      tiles.push({ layer, q, r, x: SIZE * S3 * (q + r / 2), y: SIZE * 1.5 * r, h });
    }
  });

  // Case sous le point (x, y) d'un étage, ou -1.
  function tileAt(layer, x, y) {
    const qf = (S3 / 3 * x - y / 3) / SIZE, rf = (2 / 3 * y) / SIZE, sf = -qf - rf;
    let q = Math.round(qf), r = Math.round(rf); const s = Math.round(sf);
    const dq = Math.abs(q - qf), dr = Math.abs(r - rf), ds = Math.abs(s - sf);
    if (dq > dr && dq > ds) q = -r - s; else if (dr > ds) r = -q - s;
    const k = index.get(`${layer},${q},${r}`);
    return k === undefined ? -1 : k;
  }
  // state : tableau d'états par dalle (0 solide, 1 craque, 2 tombée).
  const solid = (state, layer, x, y) => { const k = tileAt(layer, x, y); return k >= 0 && state[k] < 2 ? k : -1; };

  function newPlayer(x, y) { return { x, y, z: 0, vx: 0, vy: 0, vz: 0, ground: 0, onTile: -1, dashT: 0, dashCd: 0, dx: 1, dy: 0, alive: true }; }

  // Un pas pour un joueur. input : { x, y (direction, longueur ≤ 1), jump, dash }. Renvoie la liste des événements.
  function step(p, input, state, dt) {
    const ev = [];
    let ix = input.x || 0, iy = input.y || 0;
    const l = Math.hypot(ix, iy); if (l > 1) { ix /= l; iy /= l; }
    if (l > 0.1) { p.dx = ix / Math.max(l, 1e-6); p.dy = iy / Math.max(l, 1e-6); }
    p.dashCd = Math.max(0, p.dashCd - dt);
    if (input.dash && p.dashCd <= 0) { p.dashT = DASH_T; p.dashCd = DASH_CD; ev.push('dash'); }
    if (p.dashT > 0) { p.dashT -= dt; p.vx = p.dx * DASH; p.vy = p.dy * DASH; }
    else {
      const k = Math.min(1, dt * (p.ground ? ACCEL : ACCEL * 0.45)); // moins de contrôle en l'air
      p.vx += (ix * SPEED - p.vx) * k; p.vy += (iy * SPEED - p.vy) * k;
    }
    if (input.jump && p.ground) { p.vz = JUMP; p.ground = 0; ev.push('jump'); }
    const z0 = p.z;
    p.x += p.vx * dt; p.y += p.vy * dt;
    p.vz -= G * dt; p.z += p.vz * dt;
    p.ground = 0; p.onTile = -1;
    for (let layer = 0; layer < LAYERS.length; layer++) {
      const h = LAYERS[layer];
      if (z0 >= h - 0.05 && p.z <= h) {
        const k = solid(state, layer, p.x, p.y);
        if (k >= 0) { if (p.vz < -9) ev.push('land'); p.z = h; p.vz = 0; p.ground = 1; p.onTile = k; break; }
      }
    }
    if (p.z < DEATH && p.alive) { p.alive = false; ev.push('out'); }
    return ev;
  }

  // Deux joueurs qui se touchent se repoussent ; celui qui fonce (ruée) envoie l'autre valser.
  function collide(a, b, onlyA) {
    if (Math.abs(a.z - b.z) > 1.2 || !a.alive || !b.alive) return false;
    const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy);
    if (d >= 2 * R || d < 1e-6) return false;
    const nx = dx / d, ny = dy / d, pen = 2 * R - d;
    const wa = onlyA ? 1 : 0.5, wb = onlyA ? 0 : 0.5;
    a.x -= nx * pen * wa; a.y -= ny * pen * wa; b.x += nx * pen * wb; b.y += ny * pen * wb;
    if (b.dashT > 0) { a.vx -= nx * 11; a.vy -= ny * 11; a.vz = Math.max(a.vz, 3); a.dashT = 0; }
    if (!onlyA && a.dashT > 0) { b.vx += nx * 11; b.vy += ny * 11; b.vz = Math.max(b.vz, 3); b.dashT = 0; }
    return true;
  }

  // Les robots : regardent dans 12 directions combien de dalles solides il y a devant, et y vont.
  function bot(p, b, state, others, rng) {
    b.t = (b.t || 0) - 1;
    const layer = LAYERS.findIndex(h => Math.abs(p.z - h) < 0.6);
    if (layer < 0) return { x: b.x || 0, y: b.y || 0 };
    if (b.t <= 0) {
      b.t = 5 + Math.floor(rng() * 5);
      let best = null;
      for (let k = 0; k < 12; k++) {
        const a = k / 12 * Math.PI * 2 + rng() * 0.3, cx = Math.cos(a), cy = Math.sin(a);
        let score = (cx * (b.x || 0) + cy * (b.y || 0)) * 0.8 + rng() * 0.6 - Math.hypot(p.x + cx * 3, p.y + cy * 3) * 0.04;
        for (const d of [0.9, 1.8, 2.7, 3.6]) {
          const t = tileAt(layer, p.x + cx * d, p.y + cy * d);
          score += t < 0 ? -3 : state[t] === 0 ? 1 : state[t] === 1 ? -0.6 : -2.2 / d;
        }
        if (!best || score > best.score) best = { score, cx, cy };
      }
      b.x = best.cx; b.y = best.cy;
    }
    const ahead = tileAt(layer, p.x + b.x * 1.1, p.y + b.y * 1.1), far = tileAt(layer, p.x + b.x * 2.4, p.y + b.y * 2.4);
    // Saute les trous, et sautille souvent : en l'air, on ne casse pas de dalles.
    const land = tileAt(layer, p.x + b.x * 3.6, p.y + b.y * 3.6), safeLanding = land >= 0 && state[land] === 0;
    const gap = (ahead < 0 || state[ahead] === 2) && far >= 0 && state[far] === 0;
    const jump = p.ground && (gap || (safeLanding && rng() < 0.06));
    let dash = false;
    const prey = others.find(o => o !== p && o.alive && Math.abs(o.z - p.z) < 0.5 && Math.hypot(o.x - p.x, o.y - p.y) < 2.6);
    if (prey && p.dashCd <= 0 && rng() < 0.04 * b.aggr) { const d = Math.hypot(prey.x - p.x, prey.y - p.y) || 1; b.x = (prey.x - p.x) / d; b.y = (prey.y - p.y) / d; dash = true; }
    return { x: b.x, y: b.y, jump, dash };
  }

  const api = { SIZE, RAD, LAYERS, DEATH, R, CRACK, DASH_CD, tiles, tileAt, solid, newPlayer, step, collide, bot };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Chute = api;
})(this);
