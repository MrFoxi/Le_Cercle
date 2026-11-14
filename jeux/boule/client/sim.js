// Boule de Pute : la physique, partagée par le serveur (qui fait foi) et le navigateur (qui anticipe son joueur).
// Script classique : window.BD ou require. Mètres et secondes, 60 images par seconde ; x le long de l'arène (l'équipe 0
// est du côté x < 0, l'équipe 1 du côté x > 0, une barrière d'énergie les sépare), z en largeur, y vers le haut.
// Une boule d'énergie à tête chercheuse poursuit un joueur ; on la renvoie avec une impulsion (fenêtre courte devant
// soi) : elle repart vers l'équipe d'en face, plus vite à chaque renvoi, et plus encore sur un renvoi parfait (au tout
// dernier moment). Si elle touche sa cible, la cible est éliminée (avec un court sursis qui pardonne le décalage réseau).
// Testé par jeux/boule/boule.test.js.
(function (root, factory) {
  const BD = factory();
  if (typeof module === 'object' && module.exports) module.exports = BD;
  else root.BD = BD;
})(this, () => {
  const FPS = 60, DT = 1 / FPS;
  const IN = { F: 1, B: 2, L: 4, R: 8, JUMP: 16, HIT: 32 };
  const A = { X: 13, Z: 8, MID: 0.9, CEIL: 9 }; // demi-longueur, demi-largeur, bord de la barrière, plafond
  const P = { speed: 7.2, accel: 70, air: 0.45, jump: 8.6, g: 24, r: 0.42, chest: 1.0 };
  const B = { r: 0.42, v0: 11, inc: 2.6, perfect: 4.4, max: 75, creep: 0.18, range: 2.8, perfectRange: 1.35, window: 0.2, cd: 0.5, grace: 6, wait: 1.3, launch: 0.9 };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  function player(id, team, look) {
    return { id, team, look, x: team ? 6 : -6, y: 0, z: 0, vx: 0, vy: 0, vz: 0, yaw: team ? Math.PI : 0, ground: true, alive: true, hitT: 0, hitCd: 0, swing: 0, prevIn: 0, kills: 0, saves: 0 };
  }
  // Où regarde le joueur : avant (cos, sin) et droite (-sin, cos) dans le plan x, z.
  const fwd = yaw => [Math.cos(yaw), Math.sin(yaw)];

  // Une image pour un joueur : déplacement relatif au regard, saut, impulsion de renvoi.
  function step(p, bits, yaw) {
    if (Number.isFinite(yaw)) p.yaw = yaw;
    const pressed = bits & ~p.prevIn; p.prevIn = bits;
    p.hitT = Math.max(0, p.hitT - DT); p.hitCd = Math.max(0, p.hitCd - DT); p.swing = Math.max(0, p.swing - DT);
    if (!p.alive) return;
    const [fx, fz] = fwd(p.yaw), f = (bits & IN.F ? 1 : 0) - (bits & IN.B ? 1 : 0), s = (bits & IN.R ? 1 : 0) - (bits & IN.L ? 1 : 0);
    let wx = fx * f - fz * s, wz = fz * f + fx * s; const l = Math.hypot(wx, wz) || 1; wx /= l; wz /= l;
    const a = P.accel * (p.ground ? 1 : P.air) * DT;
    p.vx += clamp(wx * P.speed - p.vx, -a, a); p.vz += clamp(wz * P.speed - p.vz, -a, a);
    if (pressed & IN.JUMP && p.ground) { p.vy = P.jump; p.ground = false; p.ev?.push('jump'); }
    if (pressed & IN.HIT && p.hitCd <= 0) { p.hitT = B.window; p.hitCd = B.cd; p.swing = 0.3; p.ev?.push('swing'); }
    p.vy -= P.g * DT;
    p.x += p.vx * DT; p.y += p.vy * DT; p.z += p.vz * DT;
    if (p.y <= 0) { p.y = 0; p.vy = 0; p.ground = true; }
    // chacun dans sa moitié d'arène
    const [x0, x1] = p.team ? [A.MID, A.X - P.r] : [-A.X + P.r, -A.MID];
    if (p.x < x0) { p.x = x0; p.vx = 0; } if (p.x > x1) { p.x = x1; p.vx = 0; }
    if (Math.abs(p.z) > A.Z - P.r) { p.z = Math.sign(p.z) * (A.Z - P.r); p.vz = 0; }
  }

  const rand = w => (w.seed = (w.seed * 16807) % 2147483647) / 2147483647;
  const alive = (w, team) => w.players.filter(p => p.alive && (team === undefined || p.team === team));
  // Nouvelle boule au centre, en hauteur, vers un joueur au hasard.
  function spawn(w) {
    const pool = alive(w); if (!pool.length) return;
    const t = pool[Math.floor(rand(w) * pool.length)];
    w.ball = { x: 0, y: 4.5, z: 0, dx: 0, dy: 1, dz: 0, v: B.v0, target: t.id, team: 1 - t.team, state: 'fly', graceT: 0, waitT: 0, launch: B.launch, last: null, hits: 0 };
  }
  // La cible d'un renvoi : l'adversaire vivant le plus proche de la direction du regard.
  function aimTarget(w, p) {
    const [fx, fz] = fwd(p.yaw);
    let best = null, bestA = 9;
    for (const o of alive(w, 1 - p.team)) { const dx = o.x - p.x, dz = o.z - p.z, d = Math.hypot(dx, dz) || 1, ang = Math.acos(clamp((dx * fx + dz * fz) / d, -1, 1)); if (ang < bestA) { bestA = ang; best = o; } }
    return best;
  }

  // Une image pour la boule : poursuite (virage limité : plus elle va vite, plus ses courbes sont larges), rebonds sur
  // les murs, contact avec la cible (sursis), puis élimination ; une nouvelle boule arrive peu après.
  function stepBall(w, ev) {
    const b = w.ball; if (!b) return;
    if (b.state === 'wait') { if ((b.waitT -= DT) <= 0) spawn(w); return; }
    let t = w.players.find(p => p.id === b.target);
    if (!t || !t.alive) { const pool = alive(w, 1 - b.team).length ? alive(w, 1 - b.team) : alive(w); t = pool[Math.floor(rand(w) * pool.length)]; if (!t) return; b.target = t.id; b.team = 1 - t.team; }
    if (b.state === 'grace') {
      if (--b.graceT > 0) return;
      t.alive = false; t.vy = 9; t.vx = b.dx * 9; t.vz = b.dz * 9;
      const by = w.players.find(p => p.id === b.last); if (by && by.team !== t.team) by.kills++;
      ev.push({ t: 'kill', id: t.id, by: b.last, v: +b.v.toFixed(1), x: +t.x.toFixed(2), y: 1, z: +t.z.toFixed(2) });
      w.ball = { ...b, state: 'wait', waitT: B.wait };
      return;
    }
    // lancement : elle s'élève doucement en montrant sa cible, le temps de se préparer
    if (b.launch > 0) { b.launch -= DT; b.y += 2.2 * DT; return; }
    b.v = Math.min(B.max, b.v + B.creep * DT); // elle accélère doucement toute seule : pas de partie qui s'éternise
    let ex = t.x - b.x, ey = t.y + P.chest - b.y, ez = t.z - b.z; const d = Math.hypot(ex, ey, ez) || 1; ex /= d; ey /= d; ez /= d;
    const turn = (2.6 + b.v * 0.035) * DT, dot = clamp(b.dx * ex + b.dy * ey + b.dz * ez, -1, 1), ang = Math.acos(dot);
    if (ang > 1e-4) { const k = Math.min(1, turn / ang); b.dx += (ex - b.dx) * k; b.dy += (ey - b.dy) * k; b.dz += (ez - b.dz) * k; const l = Math.hypot(b.dx, b.dy, b.dz) || 1; b.dx /= l; b.dy /= l; b.dz /= l; }
    b.x += b.dx * b.v * DT; b.y += b.dy * b.v * DT; b.z += b.dz * b.v * DT;
    if (Math.abs(b.x) > A.X - B.r) { b.x = Math.sign(b.x) * (A.X - B.r); b.dx = -b.dx; }
    if (Math.abs(b.z) > A.Z - B.r) { b.z = Math.sign(b.z) * (A.Z - B.r); b.dz = -b.dz; }
    if (b.y < B.r) { b.y = B.r; b.dy = Math.abs(b.dy); } if (b.y > A.CEIL - B.r) { b.y = A.CEIL - B.r; b.dy = -Math.abs(b.dy); }
    // contact avec la cible (corps de 0 à 1,8 m) : sursis de quelques images, le temps qu'un renvoi tardif arrive
    const cy = clamp(b.y, t.y + 0.3, t.y + 1.5);
    if (Math.hypot(b.x - t.x, b.y - cy, b.z - t.z) < P.r + B.r) { b.state = 'grace'; b.graceT = B.grace; }
  }

  // Renvoi : un joueur en pleine impulsion, boule à portée et qui vise son équipe → elle repart vers l'adversaire.
  function reflect(w, p, ev) {
    const b = w.ball; if (!b || !p.alive || p.hitT <= 0 || (b.state !== 'fly' && b.state !== 'grace') || b.team === p.team) return false;
    const d = Math.hypot(b.x - p.x, b.y - (p.y + P.chest), b.z - p.z);
    if (d > B.range) return false;
    const perfect = d < B.perfectRange || b.state === 'grace', tgt = aimTarget(w, p);
    if (!tgt) return false;
    const [fx, fz] = fwd(p.yaw), l = Math.hypot(fx, 0.18, fz);
    Object.assign(b, { dx: fx / l, dy: 0.18 / l, dz: fz / l, v: Math.min(B.max, b.v + (perfect ? B.perfect : B.inc)), team: p.team, target: tgt.id, state: 'fly', graceT: 0, last: p.id, hits: b.hits + 1 });
    b.x = p.x + fx * 1.2; b.y = Math.max(B.r, p.y + P.chest + 0.2); b.z = p.z + fz * 1.2;
    p.hitT = 0; p.saves++;
    ev.push({ t: 'reflect', id: p.id, perfect, v: +b.v.toFixed(1), target: tgt.id, x: +b.x.toFixed(2), y: +b.y.toFixed(2), z: +b.z.toFixed(2) });
    return true;
  }

  // Une image du round. inputs : { id: [bits, yaw] }. Renvoie l'équipe gagnante quand l'autre n'a plus personne, sinon null.
  function stepWorld(w, inputs, ev = [], live = true) {
    w.frame++;
    for (const p of w.players) {
      const [bits, yaw] = inputs[p.id] ?? [0, p.yaw];
      p.ev = []; step(p, bits, yaw);
      for (const t of p.ev) ev.push({ t, id: p.id });
      delete p.ev;
      if (!p.alive) { p.vy -= P.g * DT; p.x += p.vx * DT; p.y = Math.max(0, p.y + p.vy * DT); p.z += p.vz * DT; }
    }
    if (!live) return null;
    if (!w.ball) spawn(w);
    for (const p of w.players) if (reflect(w, p, ev)) break;
    stepBall(w, ev);
    for (const team of [0, 1]) if (!alive(w, team).length && alive(w, 1 - team).length) return 1 - team;
    return null;
  }

  // entries : [{ id, team, look }]
  function world(entries, seed = 1) {
    const w = { frame: 0, seed, players: entries.map(e => player(e.id, e.team, e.look)), ball: null };
    reset(w);
    return w;
  }
  // Début de round : tout le monde revit, en ligne de son côté, sans boule.
  function reset(w) {
    for (const team of [0, 1]) {
      const list = w.players.filter(p => p.team === team);
      list.forEach((p, k) => Object.assign(p, { x: (team ? 1 : -1) * 7, z: (k - (list.length - 1) / 2) * 3, y: 0, vx: 0, vy: 0, vz: 0, yaw: team ? Math.PI : 0, ground: true, alive: true, hitT: 0, hitCd: 0, swing: 0 }));
    }
    w.ball = null;
  }

  const KEYS = ['x', 'y', 'z', 'vx', 'vy', 'vz', 'yaw', 'ground', 'alive', 'hitT', 'hitCd', 'swing', 'prevIn'];
  const pack = p => { const o = { id: p.id, team: p.team, look: p.look }; for (const k of KEYS) o[k] = typeof p[k] === 'number' ? Math.round(p[k] * 1000) / 1000 : p[k]; return o; };
  const packBall = b => b && [b.x, b.y, b.z, b.dx, b.dy, b.dz, b.v].map(v => Math.round(v * 1000) / 1000).concat([b.target, b.team, b.state]);

  return { FPS, DT, IN, A, P, B, fwd, player, step, stepBall, reflect, aimTarget, stepWorld, world, reset, spawn, alive, pack, packBall };
});
