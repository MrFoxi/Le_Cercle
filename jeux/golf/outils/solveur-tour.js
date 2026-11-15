// Cherche une ascension complète de la nouvelle Tour, étape par étape. Une étape :
//   box : la balle doit s'arrêter dans [lo, hi] ; on : … ou posée sur un bloc de ce look ; ev : un évènement doit avoir lieu ;
//   idle : pas de coup, on laisse le monde vivre N secondes ; wait : on essaie d'attendre avant de frapper (mécanismes) ;
//   club : il faut avoir ramassé ce club ; hole : dans le trou.
// Usage : node jeux/golf/outils/solveur-tour.js [reprise] [jusqu'à l'étape]  (long : jusqu'à une heure)
// Écrit jeux/golf/aventure.route.json, que rejoue jeux/golf/aventure.test.js.
const path = require('path'), fs = require('fs');
const dir = path.join(__dirname, '..', 'client', 'aventure');
const P = require(path.join(dir, 'physics.js')), L = require(path.join(dir, 'tower.js'));
const OUT = path.join(__dirname, '..', 'aventure.route.json');
const S = (name, lo, hi, o = {}) => ({ name, lo, hi, ...o });
const ST = [
  S('muret', [-14, 0, -1.5], [21, 0.8, 7.5]),
  S('terrasse', [-3, 3, -21], [21, 3.8, -10.5]),
  S('coin', [-21, 3, -21], [-15, 3.8, -11]),
  S('terrasseG', [-21, 7, 5], [-14, 7.8, 16]),
  S('Lavant', [-21, 7, 16.5], [-14, 7.8, 20.6]),
  S('passerelle', [4, 12, 16.2], [10, 12.8, 21]),
  S('anneauAv', [-15, 12, 10.3], [15, 12.8, 14.8]),
  S('aiguille', null, null, { on: 'hand', wait: 20, putt: true }),
  S('anneauAr', [-11, 12, -15], [15, 12.8, -10.3], { wait: 20, putt: true }),
  S('wedge', [-11, 12, -15], [15, 12.8, -10.3], { club: 'wedge' }),
  S('versLift', [-11, 12, -15], [-8, 12.8, -10.3]),
  S('lift', null, null, { on: 'lift', wait: 12, putt: true }),
  S('balances', [-16, 24, -16], [16, 24.8, 16], { wait: 12, putt: true }),
  S('plateau1', null, null, { on: 'plateA', idle: 3 }),
  S('fosse1', [-16, 24, -16], [16, 24.8, 16]),
  S('plateau2', null, null, { on: 'plateA', idle: 3 }),
  S('fosse2', [-16, 24, -16], [16, 24.8, 16]),
  S('B1', [8.1, 27, 0.1], [13.9, 27.8, 5.9]),
  S('B2', [8.1, 30, 6.1], [13.9, 30.8, 11.9]),
  S('colonne', [8, 33, 12], [15, 33.8, 15]),
  S('biblio', [-16, 36, 4.2], [8, 36.8, 15]),
  S('livre', null, null, { ev: 'topple', idle: 3 }),
  S('nord', [-15, 36, -10], [15, 36.8, -6.2]),
  S('arche', [-4, 36, -15], [4, 36.8, -11]),
  S('pile1', [4, 38.5, -15], [7, 39.3, -11]),
  S('pile2', [7, 41, -15], [10, 41.8, -11]),
  S('pile4', [10, 45, -15], [15, 45.8, -11]),
  S('moulin', [-16, 48, -16], [16, 48.8, 16]),
  S('devantPorte', [8, 48, -1.4], [12, 48.8, 1.4]),
  S('quaiBas', [16, 49.15, -1.5], [18.8, 49.95, 1.5]),
  S('godet', null, null, { on: 'bucket', wait: 20, putt: true }),
  S('quaiHaut', [16, 60.15, -1.5], [18.8, 60.95, 1.5], { wait: 20, putt: true }),
  S('huit', [-15, 60, -9.5], [15, 60.8, 15]),
  S('rails', [-15, 66, -15], [-10, 66.8, -10]),
  S('petiteStation', [-10, 69, -15], [-6, 69.8, -12]),
  S('ville', [-16, 72, -16], [-4, 72.8, -4]),
  S('F1', [-2, 74, -14], [4, 74.8, -8]),
  S('F2', [6, 76.5, -8], [14, 77.3, -2]),
  S('F3', [6, 79, 2], [14, 79.8, 8]),
  S('F4', [-6, 81.5, 8], [2, 82.3, 14]),
  S('pont', [-16, 84, 0], [-2, 84.8, 16]),
  S('M1', [0, 85, 3], [6, 87, 9], { on: 'mobile' }),
  S('M2', [6.5, 87.5, -4], [12.5, 89.5, 2], { on: 'mobile' }),
  S('M3', [0, 90, -11], [6, 92, -5], { on: 'mobile' }),
  S('M4', [-10, 92.5, -10], [-4, 94.5, -4], { on: 'mobile' }),
  S('orgue', [-16, 96, -16], [16, 96.8, 16]),
  S('devantTouches', [-6, 96, 11.3], [6, 96.8, 14.6]),
  S('tribune', [-6, 102, -2], [6, 102.8, 2]),
  S('tribuneHaute', [-6, 104.5, -6], [6, 105.3, -2]),
  S('treb', [-16, 108, -16], [16, 108.8, 16]),
  S('contrepoids', null, null, { ev: 'weight' }),
  S('contrepoids2', null, null, { ev: 'weight' }),
  S('gauchePoche', [-15, 108, -4], [-10.5, 108.8, 4]),
  S('poche', null, null, { on: 'pocket' }),
  S('vol', null, null, { idle: 9, on: 'summit' }),
  S('trou', null, null, { hole: true, wait: 30, putt: true }),
];
const inside = (p, lo, hi) => p[0] >= lo[0] && p[0] <= hi[0] && p[1] >= lo[1] && p[1] <= hi[1] && p[2] >= lo[2] && p[2] <= hi[2];
const copy = b => ({ ...b, p: [...b.p], v: [...b.v], w: [...b.w], baseVel: [...(b.baseVel || [0, 0, 0])] });
function idle(w, ball, secs) { for (let i = 0; i < secs / P.DT; i++) P.step(w, ball); }
function ok(st, res, w2, b2) {
  if (st.hole) return res.end === 'holed';
  if (res.end !== 'rest') return false;
  if (st.on && !(b2.base?.look || '').startsWith(st.on)) return false;
  if (st.lo && !inside(b2.p, st.lo, st.hi)) return false;
  if (st.club && !w2.clubs.has(st.club)) return false;
  if (st.ev && !res.events.some(e => e.t === st.ev)) return false;
  return true;
}
function tryShot(w, ball, s, st) {
  const w2 = P.clone(w), b2 = copy(ball);
  if (s.wait) idle(w2, b2, s.wait);
  P.launch(b2, s.club, s.yaw, s.power, s.loft, s.ix || 0, 0);
  const res = P.simulate(w2, b2, { maxT: 20, every: 100000 });
  if (res.end === 'rest' && st.idle) { const r2 = P.simulate(w2, b2, { maxT: 25, every: 100000, wait: st.idle }); res.events.push(...r2.events); res.end = r2.end; }
  return { res, w2, b2 };
}
function center(st, w) {
  if (st.lo) return [(st.lo[0] + st.hi[0]) / 2, (st.lo[2] + st.hi[2]) / 2];
  if (st.hole) { const c = P.cupAt(w); return [c[0], c[2]]; }
  const b = w.blocks.find(x => x.look === (st.on || '') ) || null;
  if (st.ev === 'topple') return [0, 4.2];
  if (st.ev === 'weight') return [-2.5, 3.5];
  return b ? [b.c[0], b.c[2]] : [0, 0];
}
let w = P.createWorld(L), ball = P.newBall(L.start);
P.simulate(w, ball, { maxT: 3 });
const route = [], old = process.argv[2] === 'reprise' && fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT)) : [];
const until = process.argv[3];
for (const st of ST) {
  if (st.name === 'contrepoids2' && w.treb.lvl >= 3) { console.log('contrepoids2   déjà à la force 3'); continue; }
  // étapes sans coup : on laisse le monde vivre
  if (st.idle && !st.on && !st.ev && !st.lo) { idle(w, ball, st.idle); continue; }
  if (st.name === 'vol') {
    const res = P.simulate(w, ball, { maxT: 25, every: 100000, wait: st.idle });
    console.log('vol', res.end, ball.p.map(x => x.toFixed(1)).join(' '), ball.base?.look);
    if (res.end === 'holed') { route.push({ name: 'vol', idle: st.idle }); console.log('ARRIVÉ EN', route.filter(r => r.club).length, 'coups (le trébuchet met la balle dans le trou !)'); break; }
    if (!(res.end === 'rest' && ball.base?.look === 'summit')) { console.log('ÉCHEC : le trébuchet ne pose pas la balle au sommet'); break; }
    route.push({ name: 'vol', idle: st.idle });
    continue;
  }
  const prev = old.find(r => r.name === st.name);
  if (prev && route.length === old.indexOf(prev)) {
    const t = tryShot(w, ball, prev, st);
    if (ok(st, t.res, t.w2, t.b2)) { w = t.w2; ball = t.b2; route.push(prev); console.log(st.name.padEnd(14), 'repris'); continue; }
    console.log(st.name, 'ne marche plus : on cherche'); old.length = 0;
  }
  const [tx, tz] = center(st, w), a0 = Math.atan2(tz - ball.p[2], tx - ball.p[0]);
  let best = null;
  // ordre des clubs : pour monter, ceux qui lèvent ; sinon le putter d'abord
  const up = st.lo ? st.lo[1] - ball.p[1] : 0;
  const pref = up > 3.5 ? ['wedge', 'lob', 'fer', 'driver'] : up > 1 ? ['fer', 'wedge', 'lob', 'driver', 'putter'] : ['putter', 'fer', 'wedge', 'driver', 'lob'];
  const clubs = st.putt ? ['putter', 'fer'] : pref.filter(c => w.clubs.has(c));
  const waits = st.wait ? Array.from({ length: Math.round(st.wait / 0.5) + 1 }, (_, i) => i * 0.5) : [0];
  for (const wt of waits) {
    for (const club of clubs) {
      if (!w.clubs.has(club)) continue;
      const C = P.CLUBS[club], lofts = st.putt ? [C.loft] : [C.loft, C.min, C.max];
      for (const loft of lofts) {
        const grid = new Map(), span = st.wait ? 10 : 18, pw = st.wait ? [0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4, 0.5, 0.6, 0.7] : Array.from({ length: 19 }, (_, k) => 0.1 + k * 0.05);
        for (let i = -span; i <= span; i++) pw.forEach((power, k) => {
          const s = { club, yaw: a0 + i * 0.045 * (st.wait ? 1.6 : 1), power, loft, wait: wt };
          const t = tryShot(w, ball, s, st);
          if (ok(st, t.res, t.w2, t.b2)) grid.set(`${i},${k}`, { s, t });
        });
        for (const [key, g] of grid) {
          const [i, k] = key.split(',').map(Number);
          const e = g.t.b2.p, mid = st.lo ? Math.hypot(e[0] - (st.lo[0] + st.hi[0]) / 2, e[2] - (st.lo[2] + st.hi[2]) / 2) / Math.hypot(st.hi[0] - st.lo[0], st.hi[2] - st.lo[2]) : 0;
          const score = [[-1, 0], [1, 0], [0, -1], [0, 1], [-2, 0], [2, 0]].filter(([a, b]) => grid.has(`${i + a},${k + b}`)).length + (club === 'putter' ? 0.5 : 0) - mid * 3 - wt * 0.05;
          if (!best || score > best.score) best = { ...g, score };
        }
      }
      if (best && best.score >= 4.5) break;
    }
    if (best && best.score >= 3) break;
  }
  if (!best) { console.log('ÉCHEC à', st.name, 'depuis', ball.p.map(x => x.toFixed(1)).join(' '), 'clubs', [...w.clubs].join(',')); break; }
  console.log(st.name.padEnd(14), best.s.club.padEnd(8), 'robustesse', best.score.toFixed(1), 'attente', best.s.wait, '→', best.t.b2.p.map(x => x.toFixed(1)).join(' '), best.t.res.events.filter(e => e.t === 'club' || e.t === 'shard').map(e => '+' + (e.club || 'éclat')).join(''));
  route.push({ name: st.name, ...best.s });
  w = best.t.w2; ball = best.t.b2;
  if (st.hole) { console.log('ARRIVÉ EN', route.filter(r => r.club).length, 'coups'); break; }
  if (until && st.name === until) break;
  fs.writeFileSync(OUT, JSON.stringify(route));
}
fs.writeFileSync(OUT, JSON.stringify(route));
