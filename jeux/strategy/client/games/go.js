// Go : 9 × 9, 13 × 13 ou 19 × 19 ; captures par les libertés, suicide interdit, ko, passe.
// Deux passes de suite : on marque les pierres mortes (géré par le salon), puis compte chinois (aire) ou japonais (territoire + prisonniers).
(function (root, factory) {
  const game = factory();
  if (typeof module === 'object' && module.exports) module.exports = game;
  else (root.StrategyGames = root.StrategyGames || {})[game.id] = game;
})(this, function () {
  // Point = ligne * n + colonne. 0 = vide, 1 = noir (joue en premier, camp 0), 2 = blanc (camp 1).
  const LETTERS = 'ABCDEFGHJKLMNOPQRST';
  const stone = side => side + 1;

  function init({ goSize = 19, goRules = 'chinese' } = {}) {
    const n = [9, 13, 19].includes(+goSize) ? +goSize : 19;
    return { n, b: Array(n * n).fill(0), turn: 0, caps: [0, 0], ko: -1, passes: 0, komi: goRules === 'japanese' ? 6.5 : 7.5, rules: goRules === 'japanese' ? 'japanese' : 'chinese', count: 0 };
  }
  const neighbors = (n, p) => {
    const r = Math.floor(p / n), c = p % n, out = [];
    if (r > 0) out.push(p - n);
    if (r < n - 1) out.push(p + n);
    if (c > 0) out.push(p - 1);
    if (c < n - 1) out.push(p + 1);
    return out;
  };
  // Groupe contenant p : pierres et libertés.
  function group(b, n, p) {
    const color = b[p], stones = [p], libs = new Set(), seen = new Set([p]);
    for (let i = 0; i < stones.length; i++) {
      for (const q of neighbors(n, stones[i])) {
        if (b[q] === 0) libs.add(q);
        else if (b[q] === color && !seen.has(q)) { seen.add(q); stones.push(q); }
      }
    }
    return { stones, libs };
  }

  // Pose une pierre (sans vérifier) : renvoie le plateau, les pierres prises, et le groupe posé.
  function place(b0, n, p, side) {
    const b = b0.slice(), me = stone(side), foe = stone(1 - side), taken = [];
    b[p] = me;
    for (const q of neighbors(n, p)) {
      if (b[q] !== foe) continue;
      const g = group(b, n, q);
      if (!g.libs.size) for (const x of g.stones) { b[x] = 0; taken.push(x); }
    }
    return { b, taken, own: group(b, n, p) };
  }

  function legalAt(s, p) {
    if (s.b[p] || p === s.ko) return false;
    for (const q of neighbors(s.n, p)) if (!s.b[q]) return true; // une liberté immédiate : jamais un suicide
    return place(s.b, s.n, p, s.turn).own.libs.size > 0;
  }

  const name = (n, p) => `${LETTERS[p % n]}${n - Math.floor(p / n)}`;
  function moves(s) {
    const out = [];
    for (let p = 0; p < s.n * s.n; p++) if (legalAt(s, p)) out.push({ at: p, key: name(s.n, p) });
    out.push({ pass: true, key: 'pass' });
    return out;
  }

  function play(s, m) {
    if (m.pass) return { ...s, turn: 1 - s.turn, ko: -1, passes: s.passes + 1, count: s.count + 1 };
    const { b, taken, own } = place(s.b, s.n, m.at, s.turn);
    const caps = s.caps.slice();
    caps[s.turn] += taken.length;
    // Ko : on vient de prendre une seule pierre avec une pierre seule qui n'a plus qu'une liberté (la case reprise).
    const ko = taken.length === 1 && own.stones.length === 1 && own.libs.size === 1 ? taken[0] : -1;
    return { ...s, b, caps, ko, turn: 1 - s.turn, passes: 0, count: s.count + 1 };
  }

  // Compte final ; dead = points des pierres déclarées mortes (retirées et comptées comme prisonniers).
  function score(s, dead = []) {
    const n = s.n, b = s.b.slice(), caps = s.caps.slice();
    for (const p of dead) { if (b[p]) { caps[2 - b[p]] += 1; b[p] = 0; } }
    const area = [0, 0], terr = [0, 0], owner = Array(n * n).fill(-1), seen = new Set();
    for (let p = 0; p < n * n; p++) {
      if (b[p]) { area[b[p] - 1]++; owner[p] = b[p] - 1; continue; }
      if (seen.has(p)) continue;
      const region = [p], borders = new Set();
      seen.add(p);
      for (let i = 0; i < region.length; i++) {
        for (const q of neighbors(n, region[i])) {
          if (b[q]) borders.add(b[q]);
          else if (!seen.has(q)) { seen.add(q); region.push(q); }
        }
      }
      if (borders.size === 1) {
        const side = [...borders][0] - 1;
        terr[side] += region.length;
        area[side] += region.length;
        for (const q of region) owner[q] = side;
      }
    }
    const total = s.rules === 'chinese' ? [area[0], area[1] + s.komi] : [terr[0] + caps[0], terr[1] + caps[1] + s.komi];
    return { total, owner, winner: total[0] > total[1] ? 0 : 1, rules: s.rules };
  }

  // Sans marquage des pierres mortes (robots, ou si tout le monde s'est arrêté) : on compte le plateau tel quel.
  function over(s) {
    if (s.passes < 2) return null;
    const sc = score(s);
    return { winner: sc.winner, reason: `Score ${sc.total[0]} – ${sc.total[1]}` };
  }

  const notation = (s, m) => (m.pass ? 'Passe' : name(s.n, m.at));

  /* ---------- Pour les robots ---------- */
  // Influence : chaque pierre rayonne sur 3 points ; un point est à celui qui y domine.
  function evaluate(s) {
    const n = s.n, inf = new Float32Array(n * n);
    for (let p = 0; p < n * n; p++) {
      if (!s.b[p]) continue;
      const sign = s.b[p] === 1 ? 1 : -1, r = Math.floor(p / n), c = p % n;
      for (let dr = -3; dr <= 3; dr++) for (let dc = -3; dc <= 3; dc++) {
        const d = Math.abs(dr) + Math.abs(dc), rr = r + dr, cc = c + dc;
        if (d > 3 || rr < 0 || cc < 0 || rr >= n || cc >= n) continue;
        inf[rr * n + cc] += sign * (4 - d);
      }
    }
    let score = 0;
    for (let p = 0; p < n * n; p++) {
      if (s.b[p]) score += s.b[p] === 1 ? 1 : -1;
      else if (inf[p] > 1.5) score += 1;
      else if (inf[p] < -1.5) score -= 1;
    }
    // Groupes en atari : en danger pour leur camp, surtout si c'est à l'adversaire de jouer.
    const seen = new Set();
    for (let p = 0; p < n * n; p++) {
      if (!s.b[p] || seen.has(p)) continue;
      const g = group(s.b, n, p);
      for (const x of g.stones) seen.add(x);
      const sign = s.b[p] === 1 ? 1 : -1, toMove = s.b[p] - 1 === s.turn;
      if (g.libs.size === 1) score -= sign * g.stones.length * (toMove ? 1.5 : 4);
      else if (g.libs.size === 2) score -= sign * g.stones.length * 0.5;
    }
    score += s.caps[0] - s.caps[1] - (s.komi / 2);
    return (s.turn === 0 ? score : -score) * 10;
  }

  // Coups candidats triés par une heuristique (prises, sauvetages, atari, pas de suicide d'œil) ; les robots ne regardent que ceux-là.
  function candidates(s, limit) {
    const n = s.n, me = stone(s.turn), foe = stone(1 - s.turn), scored = [];
    const any = s.b.some(Boolean);
    for (let p = 0; p < n * n; p++) {
      if (!legalAt(s, p)) continue;
      const r = Math.floor(p / n), c = p % n, line = Math.min(r, c, n - 1 - r, n - 1 - c);
      let v = 0, near = false, eye = true;
      for (const q of neighbors(n, p)) {
        if (s.b[q] !== me) eye = false;
        if (s.b[q]) near = true;
      }
      if (eye) continue; // ne jamais boucher son propre œil
      for (let dr = -2; dr <= 2 && !near; dr++) for (let dc = -2; dc <= 2; dc++) {
        const rr = r + dr, cc = c + dc;
        if (rr >= 0 && cc >= 0 && rr < n && cc < n && s.b[rr * n + cc]) near = true;
      }
      const { taken, own } = place(s.b, n, p, s.turn);
      v += taken.length * 12;
      for (const q of neighbors(n, p)) {
        if (s.b[q] === me) { const g = group(s.b, n, q); if (g.libs.size === 1 && own.libs.size > 1) v += 9 * g.stones.length; }
        if (s.b[q] === foe) { const g = group(s.b, n, q); if (g.libs.size === 2) v += 3; }
      }
      if (own.libs.size === 1 && !taken.length) v -= 15; // se mettre soi-même en atari
      if (!any) v += line === 3 || (n === 9 && line === 2) ? 6 : 0;
      else {
        if (line === 0) v -= 4;
        if (line === 1) v -= 1;
        if (line === 2 || line === 3) v += 1.5;
        if (near) v += 2;
      }
      scored.push({ at: p, key: name(n, p), h: v });
    }
    scored.sort((a, b) => b.h - a.h);
    return scored.slice(0, limit);
  }

  // Partie jouée au hasard jusqu'au bout depuis s (sans boucher ses propres yeux), comptée à l'aire.
  // Renvoie 1 si le camp qui doit jouer en s gagne. Plateau typé et marquage par tampon : des milliers de parties par seconde.
  const NB = {}, MARK = {};
  function playout(s, rng) {
    const n = s.n, n2 = n * n;
    const nb = NB[n] || (NB[n] = Array.from({ length: n2 }, (_, p) => neighbors(n, p)));
    const mark = MARK[n] || (MARK[n] = { stamp: new Int32Array(n2), t: 0 });
    const b = Int8Array.from(s.b), stack = new Int32Array(n2);
    const libs = p => { // le groupe de p a-t-il une liberté ?
      const color = b[p], t = ++mark.t;
      let top = 0;
      stack[top++] = p; mark.stamp[p] = t;
      while (top) {
        const x = stack[--top];
        for (const q of nb[x]) {
          if (!b[q]) return true;
          if (b[q] === color && mark.stamp[q] !== t) { mark.stamp[q] = t; stack[top++] = q; }
        }
      }
      return false;
    };
    const remove = p => {
      const color = b[p];
      let top = 0, count = 0;
      stack[top++] = p; b[p] = 0;
      while (top) {
        const x = stack[--top]; count++;
        for (const q of nb[x]) if (b[q] === color) { b[q] = 0; stack[top++] = q; }
      }
      return count;
    };
    let turn = s.turn, ko = s.ko, passes = 0, limit = n2 * 3;
    while (passes < 2 && limit-- > 0) {
      const me = turn + 1, foe = 2 - turn, start = Math.floor(rng() * n2);
      let played = false;
      for (let i = 0; i < n2 && !played; i++) {
        const p = (start + i) % n2;
        if (b[p] || p === ko) continue;
        let eye = true;
        for (const q of nb[p]) if (b[q] !== me) { eye = false; break; }
        if (eye) continue;
        b[p] = me;
        let taken = 0, last = -1;
        for (const q of nb[p]) if (b[q] === foe && !libs(q)) { last = q; taken += remove(q); }
        if (!taken && !libs(p)) { b[p] = 0; continue; } // suicide
        ko = taken === 1 && nb[p].every(q => b[q] !== me) ? last : -1;
        played = true;
      }
      passes = played ? 0 : passes + 1;
      turn = 1 - turn;
    }
    let black = 0, white = s.komi;
    for (let p = 0; p < n2; p++) {
      if (b[p] === 1) black++;
      else if (b[p] === 2) white++;
      else if (nb[p].every(q => b[q] === 1)) black++;
      else if (nb[p].every(q => b[q] === 2)) white++;
    }
    return (black > white ? 0 : 1) === s.turn ? 1 : 0;
  }

  return {
    id: 'go', name: 'Go', sides: ['Noirs', 'Blancs'], options: ['goSize', 'goRules'],
    init, moves, play, over, notation, evaluate, candidates, score, group, neighbors, name, playout, scoring: true,
    terminal: () => 0,
    isCapture: () => false,
  };
});
