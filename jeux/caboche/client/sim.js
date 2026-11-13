// Caboche Cup : la physique du match, partagée par le serveur (qui fait foi) et le navigateur (qui anticipe son joueur).
// Script classique : window.CC ou require. Mètres et secondes, 60 images par seconde ; x le long du terrain, z en largeur
// (vers la caméra), y vers le haut. Deux joueurs à grosse tête : courir, sauter, frapper (le pied), faire une tête
// (la tête est une grosse sphère qui renvoie le ballon), tacler (glissade qui fait tomber l'adversaire), pouvoir spécial
// quand la jauge est pleine. Ballon : gravité, rebonds, poteaux et barre, filets, murs vitrés.
// Testé par jeux/caboche/caboche.test.js.
(function (root, factory) {
  const CC = factory();
  if (typeof module === 'object' && module.exports) module.exports = CC;
  else root.CC = CC;
})(this, () => {
  const FPS = 60, DT = 1 / FPS;
  const IN = { L: 1, R: 2, U: 4, D: 8, JUMP: 16, KICK: 32, TACKLE: 64, POWER: 128 };
  // Terrain : demi-longueur, demi-largeur, but (largeur, hauteur, profondeur), plafond invisible, rayon des poteaux
  const F = { HL: 16, HW: 9.5, GW: 6.4, GH: 2.8, GD: 1.8, CEIL: 14, POST: 0.13 };
  const BALL = { r: 0.36, g: 17, bounce: 0.66, wall: 0.78, drag: 0.997, roll: 0.986, max: 40 };
  const PG = 27; // gravité des joueurs
  const BODY = { y: 0.6, r: 0.48 }, HEAD = { y: 1.82 };
  const CHARS = {
    bouboule: { name: 'Bouboule', title: 'le canonnier', run: 8.4, accel: 60, jump: 8.8, kick: 22.5, head: 0.66, weight: 1.25, power: 'super', look: [1, 4, 0, 0, 0, 0, 2], stats: { vitesse: 3, tir: 5, saut: 3, tête: 4 } },
    lila: { name: 'Lila', title: 'la fusée', run: 9.8, accel: 75, jump: 10.2, kick: 19, head: 0.6, weight: 0.85, power: 'tete', look: [3, 5, 4, 4, 0, 0, 0], stats: { vitesse: 5, tir: 3, saut: 5, tête: 3 } },
  };
  const CHAR_IDS = Object.keys(CHARS);
  const POWERS = {
    super: { name: 'Super Tir', icon: '🔥', text: 'Ton prochain tir part comme un boulet enflammé', dur: 6 },
    tete: { name: 'Tête Géante', icon: '🎈', text: 'Ta tête double de volume pendant 6 s', dur: 6 },
  };
  const GAUGE_S = 26; // secondes pour remplir la jauge

  function player(id, char, side) {
    const s = side ? 1 : -1;
    return { id, char, side, x: s * 6, y: 0, z: 0, vx: 0, vy: 0, vz: 0, face: side ? Math.PI : 0, ground: true, kickT: 0, kickCd: 0, kicked: false, tackleT: 0, tackleCd: 0, tackled: false, stun: 0, gauge: 0, power: null, powerT: 0, prevIn: 0, goals: 0 };
  }
  const C = p => CHARS[p.char];
  const headR = p => C(p).head * (p.power === 'tete' ? 2 : 1);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  // Une image pour un joueur (déplacement, saut, tir, tacle, pouvoir). Le contact avec le ballon est réglé par stepWorld.
  function step(p, inp) {
    const c = C(p), pressed = inp & ~p.prevIn;
    p.prevIn = inp;
    p.kickCd = Math.max(0, p.kickCd - DT); p.tackleCd = Math.max(0, p.tackleCd - DT);
    if (p.kickT > 0) p.kickT -= DT;
    if (p.powerT > 0 && (p.powerT -= DT) <= 0) p.power = null;
    p.gauge = Math.min(1, p.gauge + DT / GAUGE_S);
    if (p.stun > 0) { // à terre après un tacle
      p.stun -= DT;
      if (p.ground) { p.vx *= 0.9; p.vz *= 0.9; }
    } else if (p.tackleT > 0) { // glissade
      p.tackleT -= DT; p.vx *= 0.985; p.vz *= 0.985;
    } else {
      const mx = (inp & IN.R ? 1 : 0) - (inp & IN.L ? 1 : 0), mz = (inp & IN.D ? 1 : 0) - (inp & IN.U ? 1 : 0), l = Math.hypot(mx, mz) || 1;
      const tx = (mx / l) * c.run, tz = (mz / l) * c.run, a = c.accel * (p.ground ? 1 : 0.55) * DT;
      p.vx += clamp(tx - p.vx, -a, a); p.vz += clamp(tz - p.vz, -a, a);
      if (mx || mz) p.face = Math.atan2(mz, mx);
      if (pressed & IN.JUMP && p.ground) { p.vy = c.jump; p.ground = false; p.ev?.push('jump'); }
      if (pressed & IN.KICK && p.kickCd <= 0) { p.kickT = 0.2; p.kickCd = 0.34; p.kicked = false; p.ev?.push('swing'); }
      if (pressed & IN.TACKLE && p.tackleCd <= 0 && p.ground) { p.tackleT = 0.4; p.tackleCd = 1.5; p.tackled = false; p.vx = Math.cos(p.face) * 15; p.vz = Math.sin(p.face) * 15; p.ev?.push('tackle'); }
      if (pressed & IN.POWER && p.gauge >= 1) { p.gauge = 0; p.power = c.power; p.powerT = POWERS[c.power].dur; p.ev?.push('power'); }
    }
    p.vy -= PG * DT;
    p.x += p.vx * DT; p.y += p.vy * DT; p.z += p.vz * DT;
    if (p.y <= 0) { if (!p.ground && p.vy < -6) p.ev?.push('land'); p.y = 0; p.vy = 0; p.ground = true; }
    const mxX = F.HL - 0.45, mxZ = F.HW - 0.45;
    if (Math.abs(p.x) > mxX) { p.x = Math.sign(p.x) * mxX; p.vx = 0; }
    if (Math.abs(p.z) > mxZ) { p.z = Math.sign(p.z) * mxZ; p.vz = 0; }
  }

  // Rebond du ballon sur une sphère (corps ou tête d'un joueur) : il repart en tenant compte de la vitesse du joueur.
  function bounceOff(b, cx, cy, cz, r, vx, vy, vz, e) {
    const dx = b.x - cx, dy = b.y - cy, dz = b.z - cz, d = Math.hypot(dx, dy, dz), min = r + BALL.r;
    if (d >= min || d < 1e-6) return false;
    const nx = dx / d, ny = dy / d, nz = dz / d;
    b.x = cx + nx * min; b.y = cy + ny * min; b.z = cz + nz * min;
    const rv = (b.vx - vx) * nx + (b.vy - vy) * ny + (b.vz - vz) * nz;
    if (rv < 0) { b.vx -= (1 + e) * rv * nx; b.vy -= (1 + e) * rv * ny; b.vz -= (1 + e) * rv * nz; }
    b.vx += vx * 0.25; b.vy += Math.max(0, vy) * 0.25; b.vz += vz * 0.25;
    return true;
  }

  function stepBall(w, ev) {
    const b = w.ball;
    b.vy -= BALL.g * DT;
    b.vx *= BALL.drag; b.vy *= BALL.drag; b.vz *= BALL.drag;
    const sp = Math.hypot(b.vx, b.vy, b.vz); if (sp > BALL.max) { b.vx *= BALL.max / sp; b.vy *= BALL.max / sp; b.vz *= BALL.max / sp; }
    b.x += b.vx * DT; b.y += b.vy * DT; b.z += b.vz * DT;
    if (b.fire > 0) b.fire -= DT;
    const r = BALL.r;
    // sol et plafond
    if (b.y < r) { b.y = r; if (b.vy < 0) { if (b.vy < -4) ev.push({ t: 'bounce', x: +b.x.toFixed(2), z: +b.z.toFixed(2), v: +(-b.vy).toFixed(1) }); b.vy = -b.vy * BALL.bounce; if (b.vy < 1.2) b.vy = 0; } b.vx *= BALL.roll; b.vz *= BALL.roll; }
    if (b.y > F.CEIL - r) { b.y = F.CEIL - r; b.vy = -Math.abs(b.vy) * BALL.wall; }
    const inGoal = Math.abs(b.x) > F.HL;
    // côtés vitrés
    if (!inGoal && Math.abs(b.z) > F.HW - r) { b.z = Math.sign(b.z) * (F.HW - r); b.vz = -b.vz * BALL.wall; if (Math.abs(b.vz) > 5) ev.push({ t: 'wall', x: +b.x.toFixed(2), z: +b.z.toFixed(2) }); }
    // fonds : mur, sauf dans l'embouchure du but
    const mouth = Math.abs(b.z) < F.GW / 2 - r * 0.4 && b.y < F.GH - r * 0.4;
    if (!inGoal && Math.abs(b.x) > F.HL - r && !mouth) {
      // un choc tout contre le cadre compte comme un poteau (ou la barre)
      const frame = Math.abs(Math.abs(b.z) - F.GW / 2) < r + F.POST && b.y < F.GH + r || Math.abs(b.z) < F.GW / 2 && Math.abs(b.y - F.GH) < r + F.POST;
      b.x = Math.sign(b.x) * (F.HL - r); b.vx = -b.vx * (frame ? 0.9 : BALL.wall);
      if (Math.abs(b.vx) > 4) ev.push({ t: frame ? 'post' : 'wall', x: +b.x.toFixed(2), z: +b.z.toFixed(2) });
    }
    // dans le but : le filet amortit
    if (inGoal) {
      const s = Math.sign(b.x);
      if (Math.abs(b.x) > F.HL + F.GD - r) { b.x = s * (F.HL + F.GD - r); b.vx = -b.vx * 0.2; }
      if (Math.abs(b.z) > F.GW / 2 - r) { b.z = Math.sign(b.z) * (F.GW / 2 - r); b.vz = -b.vz * 0.2; }
      if (b.y > F.GH - r) { b.y = F.GH - r; b.vy = -Math.abs(b.vy) * 0.2; }
    }
    // poteaux et barre transversale
    for (const s of [-1, 1]) {
      for (const pz of [-F.GW / 2, F.GW / 2]) {
        const dx = b.x - s * F.HL, dz = b.z - pz, d = Math.hypot(dx, dz), min = r + F.POST;
        if (d < min && b.y < F.GH + r && d > 1e-6) { const nx = dx / d, nz = dz / d, rv = b.vx * nx + b.vz * nz; b.x = s * F.HL + nx * min; b.z = pz + nz * min; if (rv < 0) { b.vx -= 1.8 * rv * nx; b.vz -= 1.8 * rv * nz; } if (-rv > 4) ev.push({ t: 'post', x: +b.x.toFixed(2), z: +b.z.toFixed(2) }); }
      }
      if (Math.abs(b.z) < F.GW / 2) {
        const dx = b.x - s * F.HL, dy = b.y - F.GH, d = Math.hypot(dx, dy), min = r + F.POST;
        if (d < min && d > 1e-6) { const nx = dx / d, ny = dy / d, rv = b.vx * nx + b.vy * ny; b.x = s * F.HL + nx * min; b.y = F.GH + ny * min; if (rv < 0) { b.vx -= 1.8 * rv * nx; b.vy -= 1.8 * rv * ny; } if (-rv > 4) ev.push({ t: 'post', x: +b.x.toFixed(2), z: +b.z.toFixed(2) }); }
      }
    }
  }

  // Une image pour le match : joueurs, contacts (pieds, corps, tête), tacles, ballon, but.
  // Renvoie le côté qui marque (0 : joueur de gauche, qui attaque vers +x ; 1 : celui de droite), ou null.
  function stepWorld(w, inputs, ev = []) {
    w.frame++;
    for (const p of w.players) { p.ev = []; step(p, inputs[p.id] ?? 0); for (const t of p.ev) ev.push({ t, id: p.id, x: +p.x.toFixed(2), z: +p.z.toFixed(2) }); delete p.ev; }
    const [a, o] = w.players;
    // les joueurs se bousculent ; le tacle fait tomber
    if (a && o) {
      const dx = o.x - a.x, dz = o.z - a.z, d = Math.hypot(dx, dz) || 1e-3;
      if (d < 0.95 && Math.abs(a.y - o.y) < 1.6) {
        const push = (0.95 - d) / 2, nx = dx / d, nz = dz / d;
        a.x -= nx * push; a.z -= nz * push; o.x += nx * push; o.z += nz * push;
        for (const [t, v, s] of [[a, o, 1], [o, a, -1]]) if (t.tackleT > 0 && !t.tackled && v.stun <= 0 && v.tackleT <= 0) {
          t.tackled = true; v.stun = 1.0; v.vx = nx * s * 7 / C(v).weight; v.vz = nz * s * 7 / C(v).weight; v.vy = 5; v.ground = false; v.kickT = 0;
          ev.push({ t: 'fall', id: v.id, by: t.id, x: +v.x.toFixed(2), z: +v.z.toFixed(2) });
        }
      }
    }
    const b = w.ball;
    stepBall(w, ev);
    for (const p of w.players) {
      // le pied : pendant le geste, le ballon proche part fort, vers l'avant et vers le but adverse
      if (p.kickT > 0 && !p.kicked && p.stun <= 0) {
        const fx = p.x + Math.cos(p.face) * 0.55, fz = p.z + Math.sin(p.face) * 0.55, d = Math.hypot(b.x - fx, b.z - fz);
        if (d < 1.15 && b.y < p.y + 1.35) {
          p.kicked = true;
          const gx = (p.side ? -1 : 1) * F.HL - p.x, gz = -p.z, gl = Math.hypot(gx, gz) || 1;
          let dx = Math.cos(p.face) + (gx / gl) * 0.55, dz = Math.sin(p.face) + (gz / gl) * 0.55;
          const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
          const sup = p.power === 'super', pw = C(p).kick * (sup ? 1.75 : 1) + Math.hypot(p.vx, p.vz) * 0.35, lift = b.y > 0.9 ? 0.18 : 0.3;
          b.vx = dx * pw; b.vz = dz * pw; b.vy = lift * pw + Math.max(0, p.vy) * 0.3;
          if (sup) { p.power = null; p.powerT = 0; b.fire = 2.2; }
          w.touch = p.id;
          ev.push({ t: 'kick', id: p.id, x: +b.x.toFixed(2), y: +b.y.toFixed(2), z: +b.z.toFixed(2), p: +pw.toFixed(1), fire: sup });
          continue;
        }
      }
      // le corps (dribble, glissade) et la tête (grosse sphère, rebond vif)
      const body = bounceOff(b, p.x, p.y + BODY.y, p.z, BODY.r, p.vx, p.vy, p.vz, 0.35);
      const head = bounceOff(b, p.x, p.y + HEAD.y * (p.power === 'tete' ? 1.15 : 1), p.z, headR(p), p.vx, p.vy + (p.vy > 0 ? 2 : 0), p.vz, 0.8);
      if (body || head) w.touch = p.id;
      if (head) { const s = Math.hypot(b.vx, b.vy, b.vz); if (s > 6 && w.frame - (w.headAt ?? 0) > 10) { w.headAt = w.frame; ev.push({ t: 'header', id: p.id, x: +b.x.toFixed(2), y: +b.y.toFixed(2), z: +b.z.toFixed(2) }); } }
    }
    // but : le ballon a entièrement franchi la ligne, sous la barre, entre les poteaux
    if (Math.abs(b.x) > F.HL + BALL.r && Math.abs(b.z) < F.GW / 2 && b.y < F.GH) return b.x > 0 ? 0 : 1;
    return null;
  }

  function world(entries) {
    const w = { frame: 0, players: entries.map((e, k) => player(e.id, e.char, k)), ball: null, touch: null };
    kickoff(w);
    return w;
  }
  // Coup d'envoi : chacun dans son camp, le ballon tombe au centre.
  function kickoff(w) {
    w.players.forEach(p => Object.assign(p, { x: (p.side ? 1 : -1) * 6, y: 0, z: 0, vx: 0, vy: 0, vz: 0, face: p.side ? Math.PI : 0, ground: true, kickT: 0, tackleT: 0, stun: 0 }));
    w.ball = { x: 0, y: 3, z: 0, vx: 0, vy: 0, vz: 0, fire: 0 };
    w.touch = null;
  }

  const KEYS = ['x', 'y', 'z', 'vx', 'vy', 'vz', 'face', 'ground', 'kickT', 'kickCd', 'kicked', 'tackleT', 'tackleCd', 'tackled', 'stun', 'gauge', 'power', 'powerT', 'prevIn'];
  const pack = p => { const o = { id: p.id, char: p.char, side: p.side }; for (const k of KEYS) o[k] = typeof p[k] === 'number' ? Math.round(p[k] * 1000) / 1000 : p[k]; return o; };
  const packBall = b => [b.x, b.y, b.z, b.vx, b.vy, b.vz].map(v => Math.round(v * 1000) / 1000).concat([b.fire > 0 ? 1 : 0]);

  return { FPS, DT, IN, F, BALL, BODY, HEAD, CHARS, CHAR_IDS, POWERS, player, step, stepBall, stepWorld, world, kickoff, headR, pack, packBall };
});
