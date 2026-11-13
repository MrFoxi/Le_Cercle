// Caboche Cup : la physique du match en 2D (vue de profil), partagée par le serveur (qui fait foi) et le navigateur
// (qui anticipe son joueur). Script classique : window.CC ou require. Mètres et secondes, 60 images par seconde ;
// x le long du terrain (le joueur de gauche attaque vers +x), y vers le haut, sol en y = 0.
// Deux joueurs à grosse tête, toujours tournés vers le but adverse : courir (et sprinter, ce qui use l'endurance),
// sauter, tirer (le geste change selon la course : piqué, frappe, boulet, lob, reprise de volée), faire une tête (la tête
// est un gros cercle qui renvoie le ballon), tacler (glissade qui fait tomber), pouvoir spécial quand la jauge est pleine.
// Ballon : gravité, rebonds, barre transversale (dessus du but compris), filets, murs du stade.
// Testé par jeux/caboche/caboche.test.js.
(function (root, factory) {
  const CC = factory();
  if (typeof module === 'object' && module.exports) module.exports = CC;
  else root.CC = CC;
})(this, () => {
  const FPS = 60, DT = 1 / FPS;
  const IN = { L: 1, R: 2, JUMP: 4, KICK: 8, TACKLE: 16, POWER: 32, SPRINT: 64 };
  // Terrain : demi-longueur jusqu'aux lignes de but, profondeur et hauteur des buts, plafond invisible, épaisseur de la barre
  const F = { HL: 10, GD: 1.5, GH: 2.9, CEIL: 9, BAR: 0.12 };
  const WALL = F.HL + F.GD; // murs du stade, derrière les buts
  const BALL = { r: 0.34, g: 15, bounce: 0.72, wall: 0.72, drag: 0.998, roll: 0.985, max: 32 };
  const PG = 26; // gravité des joueurs
  const BODY = { y: 0.55, r: 0.42 }, HEAD = { y: 1.55 }, SPRINT = 1.4;
  const CHARS = {
    bouboule: { name: 'Bouboule', title: 'le canonnier', run: 6.2, accel: 45, jump: 9.6, kick: 19, head: 0.7, weight: 1.25, power: 'super', stats: { vitesse: 3, tir: 5, saut: 3, tête: 4 } },
    lila: { name: 'Lila', title: 'la fusée', run: 7.2, accel: 55, jump: 10.6, kick: 16, head: 0.62, weight: 0.85, power: 'tete', stats: { vitesse: 5, tir: 3, saut: 5, tête: 3 } },
  };
  const CHAR_IDS = Object.keys(CHARS);
  const POWERS = {
    super: { name: 'Super Tir', icon: '🔥', text: 'Ton prochain tir part comme un boulet enflammé', dur: 6 },
    tete: { name: 'Tête Géante', icon: '🎈', text: 'Ta tête double de volume pendant 6 s', dur: 6 },
  };
  const GAUGE_S = 26; // secondes pour remplir la jauge

  const dirOf = p => (p.side ? -1 : 1); // sens d'attaque
  function player(id, char, side) {
    return { id, char, side, x: (side ? 1 : -1) * 4.5, y: 0, vx: 0, vy: 0, ground: true, kickT: 0, kickCd: 0, kicked: false, kind: '', tackleT: 0, tackleCd: 0, tackled: false, tdir: 0, stun: 0, gauge: 0, power: null, powerT: 0, sta: 1, tired: false, sprint: false, prevIn: 0, goals: 0 };
  }
  const C = p => CHARS[p.char];
  const headR = p => C(p).head * (p.power === 'tete' ? 2 : 1);
  const headY = p => p.y + HEAD.y * (p.power === 'tete' ? 1.2 : 1);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  // Une image pour un joueur (course, sprint, saut, tir, tacle, pouvoir). Le contact avec le ballon est réglé par stepWorld.
  function step(p, inp) {
    const c = C(p), pressed = inp & ~p.prevIn, s = dirOf(p);
    p.prevIn = inp;
    p.kickCd = Math.max(0, p.kickCd - DT); p.tackleCd = Math.max(0, p.tackleCd - DT);
    if (p.kickT > 0) p.kickT -= DT;
    if (p.powerT > 0 && (p.powerT -= DT) <= 0) p.power = null;
    p.gauge = Math.min(1, p.gauge + DT / GAUGE_S);
    p.sprint = false;
    if (p.stun > 0) { // à terre après un tacle
      p.stun -= DT;
      if (p.ground) p.vx *= 0.9;
    } else if (p.tackleT > 0) { // glissade
      p.tackleT -= DT; p.vx *= 0.975;
    } else {
      const mx = (inp & IN.R ? 1 : 0) - (inp & IN.L ? 1 : 0);
      p.sprint = !!(inp & IN.SPRINT) && mx !== 0 && !p.tired && p.sta > 0;
      const target = mx * c.run * (p.sprint ? SPRINT : 1), a = c.accel * (p.ground ? 1 : 0.6) * DT;
      p.vx += clamp(target - p.vx, -a, a);
      if (pressed & IN.JUMP && p.ground) { p.vy = c.jump; p.ground = false; p.ev?.push('jump'); }
      if (pressed & IN.KICK && p.kickCd <= 0) { p.kickT = 0.22; p.kickCd = 0.32; p.kicked = false; p.kind = ''; p.ev?.push('swing'); }
      if (pressed & IN.TACKLE && p.tackleCd <= 0 && p.ground) { p.tdir = mx || s; p.tackleT = 0.45; p.tackleCd = 1.4; p.tackled = false; p.vx = p.tdir * 12.5; p.ev?.push('tackle'); }
      if (pressed & IN.POWER && p.gauge >= 1) { p.gauge = 0; p.power = c.power; p.powerT = POWERS[c.power].dur; p.ev?.push('power'); }
    }
    // endurance : le sprint l'use, elle revient sans sprinter ; à zéro, il faut souffler un peu
    if (p.sprint) { p.sta -= DT * 0.55; if (p.sta <= 0) { p.sta = 0; p.tired = true; } }
    else { p.sta = Math.min(1, p.sta + DT * 0.28); if (p.tired && p.sta > 0.35) p.tired = false; }
    p.vy -= PG * DT;
    p.x += p.vx * DT; p.y += p.vy * DT;
    if (p.y <= 0) { if (!p.ground && p.vy < -6) p.ev?.push('land'); p.y = 0; p.vy = 0; p.ground = true; }
    const lim = F.HL - 0.25; // on ne rentre pas dans les buts
    if (Math.abs(p.x) > lim) { p.x = Math.sign(p.x) * lim; p.vx = 0; }
  }

  // Rebond du ballon sur un cercle (corps ou tête d'un joueur) : il repart en tenant compte de la vitesse du joueur.
  function bounceOff(b, cx, cy, r, vx, vy, e) {
    const dx = b.x - cx, dy = b.y - cy, d = Math.hypot(dx, dy), min = r + BALL.r;
    if (d >= min || d < 1e-6) return false;
    const nx = dx / d, ny = dy / d;
    b.x = cx + nx * min; b.y = cy + ny * min;
    const rv = (b.vx - vx) * nx + (b.vy - vy) * ny;
    if (rv < 0) { b.vx -= (1 + e) * rv * nx; b.vy -= (1 + e) * rv * ny; }
    b.vx += vx * 0.2; b.vy += Math.max(0, vy) * 0.2;
    return true;
  }

  // Ballon sur un pas de temps h : sol, plafond, murs, intérieur des buts (filet), barres transversales.
  function stepBall(w, ev, h = DT) {
    const b = w.ball, r = BALL.r;
    b.vy -= BALL.g * h;
    const k = Math.pow(BALL.drag, h * FPS); b.vx *= k; b.vy *= k;
    const sp = Math.hypot(b.vx, b.vy); if (sp > BALL.max) { b.vx *= BALL.max / sp; b.vy *= BALL.max / sp; }
    b.x += b.vx * h; b.y += b.vy * h;
    if (b.fire > 0) b.fire -= h;
    if (b.y < r) { b.y = r; if (b.vy < 0) { if (b.vy < -3.5) ev.push({ t: 'bounce', x: +b.x.toFixed(2), y: 0, v: +(-b.vy).toFixed(1) }); b.vy = -b.vy * BALL.bounce; if (b.vy < 1) b.vy = 0; } }
    if (b.y <= r + 1e-3) b.vx *= Math.pow(BALL.roll, h * FPS);
    if (b.y > F.CEIL - r) { b.y = F.CEIL - r; b.vy = -Math.abs(b.vy) * BALL.wall; }
    if (Math.abs(b.x) > WALL - r) { b.x = Math.sign(b.x) * (WALL - r); b.vx = -b.vx * BALL.wall; if (Math.abs(b.vx) > 4) ev.push({ t: 'wall', x: +b.x.toFixed(2), y: +b.y.toFixed(2) }); }
    // dans le but : le filet freine
    if (Math.abs(b.x) > F.HL && b.y < F.GH) b.vx *= Math.pow(0.95, h * FPS);
    // barre transversale : un segment épais de la ligne de but au fond ; son bout avant fait « poteau »
    for (const s of [-1, 1]) {
      const x0 = s * F.HL, cx = s * clamp(b.x * s, F.HL, WALL), dx = b.x - cx, dy = b.y - F.GH, d = Math.hypot(dx, dy), min = r + F.BAR;
      if (d < min && d > 1e-6) {
        const nx = dx / d, ny = dy / d, rv = b.vx * nx + b.vy * ny;
        b.x = cx + nx * min; b.y = F.GH + ny * min;
        if (rv < 0) { b.vx -= 1.75 * rv * nx; b.vy -= 1.75 * rv * ny; if (-rv > 4) ev.push({ t: Math.abs(cx - x0) < 0.05 ? 'post' : 'bounce', x: +b.x.toFixed(2), y: +b.y.toFixed(2), v: +(-rv).toFixed(1) }); }
      }
    }
  }

  // Tir : le geste dépend de la situation (pouvoir, en l'air, sprint, course vers l'avant, recul, arrêté).
  // Renvoie [nom, angle en degrés, puissance].
  function kickOf(p, b) {
    const c = C(p);
    if (p.power === 'super') return ['feu', 6, c.kick * 1.7];
    if (!p.ground) return ['volee', b.y > p.y + 1.0 ? -10 : 8, c.kick * 1.05];
    const fwd = p.vx * dirOf(p);
    if (p.sprint && fwd > 0) return ['boulet', 13, c.kick * 1.2 + fwd * 0.3];
    if (fwd > 1.5) return ['frappe', 22, c.kick + fwd * 0.3];
    if (fwd < -1.5) return ['lob', 58, c.kick * 0.78];
    return ['pique', 40, c.kick * 0.85];
  }

  // Une image pour le match : joueurs, contacts (pied, corps, tête), tacles, ballon, but.
  // Renvoie le côté qui marque (0 : joueur de gauche, qui attaque vers +x ; 1 : celui de droite), ou null.
  function stepWorld(w, inputs, ev = []) {
    w.frame++;
    for (const p of w.players) { p.ev = []; step(p, inputs[p.id] ?? 0); for (const t of p.ev) ev.push({ t, id: p.id, x: +p.x.toFixed(2), y: +p.y.toFixed(2) }); delete p.ev; }
    const [a, o] = w.players;
    // les joueurs se bousculent ; le tacle fait tomber
    if (a && o && Math.abs(a.y - o.y) < 1.6) {
      const dx = o.x - a.x, d = Math.abs(dx);
      if (d < 0.95) {
        // chacun recule selon son poids, et celui qui pousse est freiné
        const push = 0.95 - d, n = Math.sign(dx) || 1, wa = C(a).weight, wo = C(o).weight;
        a.x -= n * push * (wo / (wa + wo)); o.x += n * push * (wa / (wa + wo));
        if (a.vx * n > 0) a.vx *= 0.6; if (o.vx * n < 0) o.vx *= 0.6;
        for (const [t, v] of [[a, o], [o, a]]) if (t.tackleT > 0 && !t.tackled && v.stun <= 0 && v.tackleT <= 0 && v.y < 1) {
          t.tackled = true; v.stun = 1.1; v.vx = t.tdir * 4 / C(v).weight; v.vy = 4.5; v.ground = false; v.kickT = 0;
          ev.push({ t: 'fall', id: v.id, by: t.id, x: +v.x.toFixed(2), y: +v.y.toFixed(2) });
        }
      }
    }
    const b = w.ball;
    for (let k = 0; k < 2; k++) stepBall(w, ev, DT / 2); // deux demi-pas : pas de ballon qui traverse la barre
    for (const p of w.players) {
      const s = dirOf(p);
      // le pied : pendant le geste, le ballon devant le joueur part selon le geste choisi
      if (p.kickT > 0 && !p.kicked && p.stun <= 0) {
        const fx = p.x + s * 0.5, fy = p.y + 0.35, d = Math.hypot(b.x - fx, b.y - fy);
        if (d < 0.95 && (b.x - p.x) * s > -0.3) {
          const [kind, deg, pw] = kickOf(p, b), an = (deg * Math.PI) / 180;
          p.kicked = true; p.kind = kind;
          b.vx = s * Math.cos(an) * pw; b.vy = Math.sin(an) * pw;
          if (b.y < BALL.r + 0.02 && b.vy < 0) b.vy = -b.vy * 0.6;
          if (kind === 'feu') { p.power = null; p.powerT = 0; b.fire = 2.2; }
          w.touch = p.id;
          ev.push({ t: 'kick', id: p.id, x: +b.x.toFixed(2), y: +b.y.toFixed(2), p: +pw.toFixed(1), kind, fire: kind === 'feu' });
          continue;
        }
      }
      // la glissade emporte le ballon au ras du sol
      if (p.tackleT > 0 && b.y < 0.9 && Math.abs(b.x - (p.x + p.tdir * 0.55)) < 0.75) { b.vx = p.tdir * 11; b.vy = 3; w.touch = p.id; }
      // le corps (dribble, contrôle) et la tête (gros cercle, rebond vif ; en sautant dedans, elle pousse vers l'avant)
      const body = bounceOff(b, p.x, p.y + BODY.y, BODY.r, p.vx, p.vy, 0.3);
      const head = bounceOff(b, p.x, headY(p), headR(p), p.vx, p.vy + (p.vy > 0 ? 2 : 0), p.vy > 1 ? 0.8 : 0.6); // tête prise en sautant : plus vive
      if (head && p.vy > 1) { b.vx += s * 3; b.vy += 1.5; }
      if (body || head) w.touch = p.id;
      if (head) { const sp = Math.hypot(b.vx, b.vy); if (sp > 6 && w.frame - (w.headAt ?? 0) > 10) { w.headAt = w.frame; ev.push({ t: 'header', id: p.id, x: +b.x.toFixed(2), y: +b.y.toFixed(2) }); } }
    }
    // but : le ballon a entièrement franchi la ligne, sous la barre
    if (Math.abs(b.x) > F.HL + BALL.r && b.y < F.GH) return b.x > 0 ? 0 : 1;
    return null;
  }

  function world(entries) {
    const w = { frame: 0, players: entries.map((e, k) => player(e.id, e.char, k)), ball: null, touch: null };
    kickoff(w);
    return w;
  }
  // Coup d'envoi : chacun dans son camp, le ballon tombe au centre.
  function kickoff(w) {
    w.players.forEach(p => Object.assign(p, { x: (p.side ? 1 : -1) * 4.5, y: 0, vx: 0, vy: 0, ground: true, kickT: 0, tackleT: 0, stun: 0 }));
    w.ball = { x: 0, y: 4, vx: 0, vy: 0, fire: 0 };
    w.touch = null;
  }

  const KEYS = ['x', 'y', 'vx', 'vy', 'ground', 'kickT', 'kickCd', 'kicked', 'kind', 'tackleT', 'tackleCd', 'tackled', 'tdir', 'stun', 'gauge', 'power', 'powerT', 'sta', 'tired', 'sprint', 'prevIn'];
  const pack = p => { const o = { id: p.id, char: p.char, side: p.side }; for (const k of KEYS) o[k] = typeof p[k] === 'number' ? Math.round(p[k] * 1000) / 1000 : p[k]; return o; };
  const packBall = b => [b.x, b.y, b.vx, b.vy].map(v => Math.round(v * 1000) / 1000).concat([b.fire > 0 ? 1 : 0]);

  return { FPS, DT, IN, F, WALL, BALL, BODY, HEAD, SPRINT, CHARS, CHAR_IDS, POWERS, dirOf, kickOf, player, step, stepBall, stepWorld, world, kickoff, headR, headY, pack, packBall };
});
