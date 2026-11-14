// Boule de Pute : la physique, partagée par le serveur (qui fait foi) et le navigateur (qui anticipe son joueur).
// Script classique : window.BD ou require. Mètres et secondes, 60 images par seconde ; x le long de l'arène, z en
// largeur, y vers le haut. En équipes, l'équipe 0 est du côté x < 0 et l'équipe 1 du côté x > 0 (barrière au milieu) ;
// en chacun pour soi, tout le monde circule partout.
// Une boule d'énergie à tête chercheuse poursuit un joueur ; on la renvoie avec une impulsion (fenêtre courte devant
// soi) : elle repart vers l'adversaire visé, plus vite à chaque renvoi, et plus encore sur un renvoi parfait (au tout
// dernier moment). Si elle touche sa cible, la cible est éliminée (avec un court sursis qui pardonne le décalage réseau).
// Arènes à règles : tables qui abritent (cantine), bassin qui freine la boule (piscine), tapis roulants et pistons
// (usine), îles flottantes dont on peut tomber (ciel). Patate chaude : la boule explose au bout de 10 s sur sa cible.
// Testé par jeux/boule/boule.test.js.
(function (root, factory) {
  const BD = factory();
  if (typeof module === 'object' && module.exports) module.exports = BD;
  else root.BD = BD;
})(this, () => {
  const FPS = 60, DT = 1 / FPS;
  const IN = { F: 1, B: 2, L: 4, R: 8, JUMP: 16, HIT: 32, AUTO: 64 }; // AUTO : renvoi visé automatiquement (tactile)
  const A = { X: 18, Z: 11, MID: 1.0, CEIL: 11 }; // demi-longueur, demi-largeur, bord de la barrière, plafond
  const P = { speed: 7.6, accel: 70, air: 0.45, jump: 8.6, g: 24, r: 0.42, chest: 1.0 };
  const B = { r: 0.42, v0: 11, inc: 2.6, perfect: 4.4, max: 80, creep: 0.18, range: 2.8, perfectRange: 1.35, window: 0.2, cd: 0.5, grace: 6, wait: 1.3, launch: 0.9, fuse: 10 };
  // Arènes et leurs règles (géométrie partagée avec le rendu).
  const ARENAS = {
    gym: { name: '🏀 Gymnase Cosmique' },
    neon: { name: '🌃 Néon City' },
    cantine: { name: '🍽️ Cantine scolaire', boxes: [[-11, -5, 3.2, 1.4, 0.9], [-11, 5, 3.2, 1.4, 0.9], [-6, 0, 1.4, 3.2, 0.9], [11, -5, 3.2, 1.4, 0.9], [11, 5, 3.2, 1.4, 0.9], [6, 0, 1.4, 3.2, 0.9]] }, // x, z, largeur, profondeur, hauteur
    piscine: { name: '🏊 Piscine municipale', water: [-4, 4] }, // bassin au milieu : la boule y ralentit, on y patauge
    usine: { name: '🏭 Usine énergétique', belts: [[-15, -3, -9, -6, 0, 3], [-15, -3, 6, 9, 0, -3], [3, 15, -9, -6, 0, 3], [3, 15, 6, 9, 0, -3]], pistons: [[-5, -4.5, 1.3, 4, 0], [5, 4.5, 1.3, 4, 2], [-13.5, 4.5, 1.3, 5, 1], [13.5, -4.5, 1.3, 5, 3.5]] }, // tapis : x0, x1, z0, z1, vx, vz ; pistons : x, z, rayon, période, décalage
    ciel: { name: '☁️ Arène dans le ciel', islands: [[-18, -6, -11, 11], [-5, -1, -5, 5], [-5, -1, 7, 11], [1, 5, -5, 5], [1, 5, -11, -7], [6, 18, -11, 11], [-1.2, 1.2, -2, 2]] }, // x0, x1, z0, z1 : sol seulement là
  };
  const ARENA_IDS = Object.keys(ARENAS);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  function player(id, team, look) {
    return { id, team, look, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, yaw: 0, ground: true, alive: true, immortal: false, hitT: 0, hitCd: 0, swing: 0, prevIn: 0, auto: false, kills: 0, saves: 0, emote: null, emoteT: 0, rs: { reflects: 0, perfect: 0, targeted: 0, whiffs: 0 } };
  }
  const fwd = yaw => [Math.cos(yaw), Math.sin(yaw)]; // avant (cos, sin), droite (-sin, cos) dans le plan x, z
  const inRect = (x, z, r) => x >= r[0] && x <= r[1] && z >= r[2] && z <= r[3];
  const ar = w => ARENAS[w?.arena] ?? ARENAS.gym;
  // Hauteur d'un piston à l'instant t (secondes) : il jaillit 0,5 s par période.
  const pistonUp = (pi, t) => ((t + pi[4]) % pi[3]) < 0.5;
  const onGround = (w, x, z) => !ar(w).islands || ar(w).islands.some(r => inRect(x, z, r));

  // Une image pour un joueur : déplacement relatif au regard, saut, impulsion, règles de l'arène.
  function step(p, bits, yaw, w = null) {
    if (Number.isFinite(yaw)) p.yaw = yaw;
    const pressed = bits & ~p.prevIn; p.prevIn = bits;
    const hadHit = p.hitT > 0;
    p.hitT = Math.max(0, p.hitT - DT); p.hitCd = Math.max(0, p.hitCd - DT); p.swing = Math.max(0, p.swing - DT); p.emoteT = Math.max(0, p.emoteT - DT);
    if (hadHit && p.hitT === 0) p.whiffed = true; // impulsion terminée sans rien renvoyer
    if (!p.alive) return;
    const A2 = ar(w), t = (w?.frame ?? 0) * DT;
    const [fx, fz] = fwd(p.yaw), f = (bits & IN.F ? 1 : 0) - (bits & IN.B ? 1 : 0), s = (bits & IN.R ? 1 : 0) - (bits & IN.L ? 1 : 0);
    let wx = fx * f - fz * s, wz = fz * f + fx * s; const l = Math.hypot(wx, wz) || 1; wx /= l; wz /= l;
    const wade = A2.water && p.x > A2.water[0] && p.x < A2.water[1] ? 0.55 : 1; // on patauge dans le bassin
    const a = P.accel * (p.ground ? 1 : P.air) * DT;
    p.vx += clamp(wx * P.speed * wade - p.vx, -a, a); p.vz += clamp(wz * P.speed * wade - p.vz, -a, a);
    if (pressed & IN.JUMP && p.ground) { p.vy = P.jump; p.ground = false; p.ev?.push('jump'); }
    if (pressed & (IN.HIT | IN.AUTO) && p.hitCd <= 0) { p.hitT = B.window; p.hitCd = B.cd; p.swing = 0.3; p.auto = !!(bits & IN.AUTO); p.whiffed = false; p.ev?.push('swing'); }
    p.vy -= P.g * DT;
    p.x += p.vx * DT; p.y += p.vy * DT; p.z += p.vz * DT;
    // tapis roulants
    if (p.ground && A2.belts) for (const b of A2.belts) if (inRect(p.x, p.z, b)) { p.x += b[4] * DT; p.z += b[5] * DT; }
    // pistons : ils propulsent en l'air
    if (A2.pistons) for (const pi of A2.pistons) if (pistonUp(pi, t) && p.y < 0.6 && Math.hypot(p.x - pi[0], p.z - pi[1]) < pi[2]) { p.vy = 12; p.ground = false; p.ev?.push('piston'); }
    // sol (dans le ciel : seulement sur les îles ; ailleurs, on tombe)
    if (p.y <= 0 && p.vy <= 0 && onGround(w, p.x, p.z) && p.y > -0.6) { p.y = 0; p.vy = 0; p.ground = true; }
    else if (p.y > 0.02 || !onGround(w, p.x, p.z)) p.ground = false;
    // tables (cantine) : on ne les traverse pas
    if (A2.boxes) for (const [bx, bz, bw, bd, bh] of A2.boxes) {
      if (p.y > bh) continue;
      const cx = clamp(p.x, bx - bw / 2, bx + bw / 2), cz = clamp(p.z, bz - bd / 2, bz + bd / 2), dx = p.x - cx, dz = p.z - cz, d = Math.hypot(dx, dz);
      if (d < P.r) { if (d > 1e-6) { p.x = cx + (dx / d) * P.r; p.z = cz + (dz / d) * P.r; } else p.x += P.r; }
    }
    // chacun dans sa moitié (en équipes), murs de l'arène
    if (w?.halves) { const [x0, x1] = p.team ? [A.MID, A.X - P.r] : [-A.X + P.r, -A.MID]; if (p.x < x0) { p.x = x0; p.vx = 0; } if (p.x > x1) { p.x = x1; p.vx = 0; } }
    if (Math.abs(p.x) > A.X - P.r) { p.x = Math.sign(p.x) * (A.X - P.r); p.vx = 0; }
    if (Math.abs(p.z) > A.Z - P.r) { p.z = Math.sign(p.z) * (A.Z - P.r); p.vz = 0; }
  }

  const rand = w => (w.seed = (w.seed * 16807) % 2147483647) / 2147483647;
  const alive = (w, team) => w.players.filter(p => p.alive && (team === undefined || p.team === team));
  const foes = (w, p) => w.players.filter(o => o.alive && o.team !== p.team);
  function setTarget(w, b, t) { b.target = t.id; t.rs.targeted++; }
  // Nouvelle boule au centre, en hauteur, vers un joueur au hasard.
  function spawn(w) {
    const pool = alive(w).filter(p => !p.launcher); if (!pool.length) return;
    const t = pool[Math.floor(rand(w) * pool.length)];
    w.ball = { x: 0, y: 4.5, z: 0, dx: 0, dy: 1, dz: 0, v: B.v0, target: null, team: null, state: 'fly', graceT: 0, waitT: 0, launch: B.launch, fuse: B.fuse, last: null, hits: 0 };
    setTarget(w, w.ball, t);
  }
  // La cible d'un renvoi : l'adversaire vivant le plus proche de la direction du regard (ou le plus proche tout court).
  function aimTarget(w, p, nearest = false) {
    const [fx, fz] = fwd(p.yaw);
    let best = null, score = Infinity;
    for (const o of foes(w, p)) { const dx = o.x - p.x, dz = o.z - p.z, d = Math.hypot(dx, dz) || 1, v = nearest ? d : Math.acos(clamp((dx * fx + dz * fz) / d, -1, 1)); if (v < score) { score = v; best = o; } }
    return best;
  }
  function eliminate(w, b, t, ev, how) {
    if (t.immortal) { ev.push({ t: 'miss', id: t.id, v: +b.v.toFixed(1), hits: b.hits, x: +t.x.toFixed(2), y: 1, z: +t.z.toFixed(2) }); w.ball = { ...b, state: 'wait', waitT: 0.8 }; return; }
    t.alive = false; t.vy = 9; t.vx = b.dx * 9; t.vz = b.dz * 9;
    const by = w.players.find(p => p.id === b.last); if (by && by.team !== t.team) by.kills++;
    ev.push({ t: 'kill', id: t.id, by: b.last, how, v: +b.v.toFixed(1), hits: b.hits, x: +t.x.toFixed(2), y: 1, z: +t.z.toFixed(2) });
    w.ball = { ...b, state: 'wait', waitT: B.wait };
  }

  // Une image pour la boule : poursuite (virage limité : plus elle va vite, plus ses courbes sont larges), rebonds sur
  // les murs et les tables, bassin qui freine, contact avec la cible (sursis), mèche de la patate chaude.
  function stepBall(w, ev) {
    const b = w.ball; if (!b) return;
    if (b.state === 'wait') { if ((b.waitT -= DT) <= 0) spawn(w); return; }
    let t = w.players.find(p => p.id === b.target);
    if (!t || !t.alive) { const from = w.players.find(p => p.id === b.last), pool = from ? foes(w, from) : alive(w); t = pool[Math.floor(rand(w) * pool.length)] ?? alive(w)[0]; if (!t) return; setTarget(w, b, t); }
    if (b.state === 'grace') { if (--b.graceT <= 0) eliminate(w, b, t, ev, 'boule'); return; }
    if (b.launch > 0) { b.launch -= DT; b.y += 2.2 * DT; return; } // elle s'élève doucement en montrant sa cible
    if (w.mode === 'patate' && (b.fuse -= DT) <= 0) return eliminate(w, b, t, ev, 'patate');
    b.v = Math.min(B.max, b.v + B.creep * DT); // elle accélère doucement toute seule : pas de partie qui s'éternise
    const A2 = ar(w);
    if (A2.water && b.x > A2.water[0] && b.x < A2.water[1] && b.y < 1.4) { b.v = Math.max(B.v0, b.v - 9 * DT); if (w.frame % 8 === 0) ev.push({ t: 'splash', x: +b.x.toFixed(2), z: +b.z.toFixed(2) }); }
    let ex = t.x - b.x, ey = t.y + P.chest - b.y, ez = t.z - b.z; const d = Math.hypot(ex, ey, ez) || 1; ex /= d; ey /= d; ez /= d;
    const turn = (2.6 + b.v * 0.035) * DT, dot = clamp(b.dx * ex + b.dy * ey + b.dz * ez, -1, 1), ang = Math.acos(dot);
    if (ang > 1e-4) { const k = Math.min(1, turn / ang); b.dx += (ex - b.dx) * k; b.dy += (ey - b.dy) * k; b.dz += (ez - b.dz) * k; const l = Math.hypot(b.dx, b.dy, b.dz) || 1; b.dx /= l; b.dy /= l; b.dz /= l; }
    b.x += b.dx * b.v * DT; b.y += b.dy * b.v * DT; b.z += b.dz * b.v * DT;
    if (Math.abs(b.x) > A.X - B.r) { b.x = Math.sign(b.x) * (A.X - B.r); b.dx = -b.dx; }
    if (Math.abs(b.z) > A.Z - B.r) { b.z = Math.sign(b.z) * (A.Z - B.r); b.dz = -b.dz; }
    if (b.y < B.r) { b.y = B.r; b.dy = Math.abs(b.dy); } if (b.y > A.CEIL - B.r) { b.y = A.CEIL - B.r; b.dy = -Math.abs(b.dy); }
    // tables : la boule rebondit dessus (on peut s'abriter derrière)
    if (A2.boxes) for (const [bx, bz, bw, bd, bh] of A2.boxes) {
      const cx = clamp(b.x, bx - bw / 2, bx + bw / 2), cy = clamp(b.y, 0, bh), cz = clamp(b.z, bz - bd / 2, bz + bd / 2), dx = b.x - cx, dy = b.y - cy, dz = b.z - cz, dd = Math.hypot(dx, dy, dz);
      if (dd < B.r && dd > 1e-6) { const nx = dx / dd, ny = dy / dd, nz = dz / dd, dn = b.dx * nx + b.dy * ny + b.dz * nz; b.x = cx + nx * B.r; b.y = cy + ny * B.r; b.z = cz + nz * B.r; if (dn < 0) { b.dx -= 2 * dn * nx; b.dy -= 2 * dn * ny; b.dz -= 2 * dn * nz; } ev.push({ t: 'thud', x: +b.x.toFixed(2), y: +b.y.toFixed(2), z: +b.z.toFixed(2) }); }
    }
    // contact avec la cible (corps de 0 à 1,8 m) : sursis de quelques images, le temps qu'un renvoi tardif arrive
    const cy = clamp(b.y, t.y + 0.3, t.y + 1.5);
    if (Math.hypot(b.x - t.x, b.y - cy, b.z - t.z) < P.r + B.r) { b.state = 'grace'; b.graceT = B.grace; }
  }

  // Renvoi : un joueur en pleine impulsion, boule à portée et qui vise son équipe → elle repart vers l'adversaire visé.
  function reflect(w, p, ev) {
    const b = w.ball; if (!b || !p.alive || p.hitT <= 0 || b.launch > 0 || (b.state !== 'fly' && b.state !== 'grace')) return false;
    const tg = w.players.find(o => o.id === b.target); if (!tg || tg.team !== p.team) return false; // elle vise mon équipe (ou moi)
    const d = Math.hypot(b.x - p.x, b.y - (p.y + P.chest), b.z - p.z);
    if (d > B.range) return false;
    const perfect = d < B.perfectRange || b.state === 'grace', tgt = aimTarget(w, p, p.auto);
    if (!tgt) return false;
    const [fx, fz] = fwd(p.auto ? Math.atan2(tgt.z - p.z, tgt.x - p.x) : p.yaw), l = Math.hypot(fx, 0.18, fz);
    Object.assign(b, { dx: fx / l, dy: 0.18 / l, dz: fz / l, v: Math.min(B.max, b.v + (perfect ? B.perfect : B.inc)), team: p.team, state: 'fly', graceT: 0, last: p.id, hits: b.hits + 1 });
    setTarget(w, b, tgt);
    b.x = p.x + fx * 1.2; b.y = Math.max(B.r, p.y + P.chest + 0.2); b.z = p.z + fz * 1.2;
    p.hitT = 0; p.whiffed = false; p.saves++; p.rs.reflects++; if (perfect) p.rs.perfect++;
    ev.push({ t: 'reflect', id: p.id, perfect, v: +b.v.toFixed(1), target: tgt.id, hits: b.hits, x: +b.x.toFixed(2), y: +b.y.toFixed(2), z: +b.z.toFixed(2) });
    return true;
  }

  // Une image du round. inputs : { id: [bits, yaw] }. Renvoie l'équipe gagnante quand il n'en reste qu'une, sinon null.
  function stepWorld(w, inputs, ev = [], live = true) {
    w.frame++;
    for (const p of w.players) {
      const [bits, yaw] = inputs[p.id] ?? [0, p.yaw];
      p.ev = []; step(p, bits, yaw, w);
      for (const t of p.ev) ev.push({ t, id: p.id });
      delete p.ev;
      if (!p.alive) { p.vy -= P.g * DT; p.x += p.vx * DT; p.y = Math.max(ar(w).islands ? -40 : 0, p.y + p.vy * DT); p.z += p.vz * DT; }
      // tombé d'une île (ciel)
      if (p.alive && p.y < -7) { p.alive = false; ev.push({ t: 'kill', id: p.id, by: w.ball?.last ?? null, how: 'chute', v: 0, hits: 0, x: +p.x.toFixed(2), y: -6, z: +p.z.toFixed(2) }); if (w.ball?.target === p.id) w.ball = { ...w.ball, state: 'wait', waitT: B.wait }; }
    }
    if (!live) return null;
    if (!w.ball) spawn(w);
    for (const p of w.players) if (reflect(w, p, ev)) break;
    for (const p of w.players) if (p.whiffed) { p.whiffed = false; if (w.ball?.target === p.id) p.rs.whiffs++; }
    stepBall(w, ev);
    const teams = [...new Set(w.players.map(p => p.team))], left = [...new Set(alive(w).map(p => p.team))];
    if (teams.length >= 2 && left.length <= 1) return left[0] ?? -1; // -1 : plus personne (match nul)
    return null;
  }

  // entries : [{ id, team, look, immortal?, launcher? }] ; opts : { arena, mode, seed }
  function world(entries, opts = {}) {
    const w = { frame: 0, seed: opts.seed || 1, arena: ARENAS[opts.arena] ? opts.arena : 'gym', mode: opts.mode ?? 'equipes', players: entries.map(e => Object.assign(player(e.id, e.team, e.look), { immortal: !!e.immortal, launcher: !!e.launcher })), ball: null };
    w.halves = new Set(entries.map(e => e.team)).size === 2 && w.mode !== 'chacun';
    reset(w);
    return w;
  }
  // Début de round : tout le monde revit, en ligne de son côté (ou en cercle en chacun pour soi), sans boule.
  function reset(w) {
    const teams = [...new Set(w.players.map(p => p.team))];
    if (w.halves) for (const [k, team] of teams.entries()) {
      const list = w.players.filter(p => p.team === team), side = k ? 1 : -1;
      list.forEach((p, i) => Object.assign(p, { x: side * 9, z: (i - (list.length - 1) / 2) * 3.5, yaw: side > 0 ? Math.PI : 0 }));
    } else w.players.forEach((p, i) => { const a = (i / w.players.length) * Math.PI * 2; Object.assign(p, { x: Math.cos(a) * 10, z: Math.sin(a) * 7, yaw: a + Math.PI }); });
    for (const p of w.players) Object.assign(p, { y: 0, vx: 0, vy: 0, vz: 0, ground: true, alive: true, hitT: 0, hitCd: 0, swing: 0, rs: { reflects: 0, perfect: 0, targeted: 0, whiffs: 0 } });
    w.ball = null;
  }

  const KEYS = ['x', 'y', 'z', 'vx', 'vy', 'vz', 'yaw', 'ground', 'alive', 'hitT', 'hitCd', 'swing', 'prevIn', 'emote', 'emoteT'];
  const pack = p => { const o = { id: p.id, team: p.team, look: p.look }; for (const k of KEYS) o[k] = typeof p[k] === 'number' ? Math.round(p[k] * 1000) / 1000 : p[k]; return o; };
  const packBall = b => b && [b.x, b.y, b.z, b.dx, b.dy, b.dz, b.v].map(v => Math.round(v * 1000) / 1000).concat([b.target, b.team, b.state, b.last, b.hits, Math.round((b.fuse ?? 0) * 10) / 10, b.launch > 0 ? 1 : 0]);

  return { FPS, DT, IN, A, P, B, ARENAS, ARENA_IDS, fwd, inRect, pistonUp, onGround, player, step, stepBall, reflect, aimTarget, stepWorld, world, reset, spawn, alive, foes, pack, packBall };
});
