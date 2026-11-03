// Dames internationales (10 × 10, règles FMJD) : prise obligatoire et majoritaire, rafles, dames volantes,
// promotion en fin de coup seulement, nulles (répétition, 25 coups de dames, fins de partie à 16 et 5 coups).
(function (root, factory) {
  const game = factory();
  if (typeof module === 'object' && module.exports) module.exports = game;
  else (root.StrategyGames = root.StrategyGames || {})[game.id] = game;
})(this, function () {
  // Case = ligne * 10 + colonne ; seules les cases foncées ((ligne + colonne) impaire) servent.
  // Blancs en bas (montent, jouent en premier), noirs en haut. w/b = pion, W/B = dame.
  const N = 10, DIRS = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
  const inside = (r, c) => r >= 0 && r < N && c >= 0 && c < N;
  const sideOf = p => (p ? (p.toLowerCase() === 'w' ? 0 : 1) : -1);
  const isKing = p => p === 'W' || p === 'B';
  const num = sq => Math.floor(sq / N) * 5 + Math.floor((sq % N) / 2) + 1; // numérotation officielle 1 à 50

  function init() {
    const b = Array(N * N).fill('');
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
      if ((r + c) % 2 === 0) continue;
      if (r < 4) b[r * N + c] = 'b';
      else if (r > 5) b[r * N + c] = 'w';
    }
    const s = { b, turn: 0, kingMoves: 0, late: 0, lateKind: 0, hist: null };
    s.hist = { k: posKey(s), prev: null };
    return s;
  }
  const posKey = s => `${s.b.join(',')}|${s.turn}`;

  // Rafles depuis « from » : on explore toutes les suites de prises ; les pièces prises restent sur le plateau
  // jusqu'à la fin du coup (on ne peut ni les sauter deux fois ni passer dessus).
  function captures(b, from, piece) {
    const side = sideOf(piece), king = isKing(piece), out = [];
    const walk = (sq, path, taken) => {
      const r = Math.floor(sq / N), c = sq % N;
      let extended = false;
      for (const [dr, dc] of DIRS) {
        let rr = r + dr, cc = c + dc;
        if (king) while (inside(rr, cc) && !b[rr * N + cc]) { rr += dr; cc += dc; }
        if (!inside(rr, cc)) continue;
        const mid = rr * N + cc;
        if (sideOf(b[mid]) !== 1 - side || taken.includes(mid)) continue;
        let lr = rr + dr, lc = cc + dc;
        while (inside(lr, lc) && !b[lr * N + lc]) {
          const land = lr * N + lc;
          extended = true;
          walk(land, path.concat(land), taken.concat(mid));
          if (!king) break;
          lr += dr; lc += dc;
        }
      }
      if (!extended && taken.length) out.push({ path, caps: taken });
    };
    const saved = b[from];
    b[from] = ''; // la case de départ est libre pendant la rafle
    walk(from, [from], []);
    b[from] = saved;
    return out;
  }

  function moves(s) {
    const b = s.b.slice(), all = [];
    let best = 0;
    for (let sq = 0; sq < N * N; sq++) {
      if (sideOf(b[sq]) !== s.turn) continue;
      for (const m of captures(b, sq, b[sq])) {
        if (m.caps.length > best) { best = m.caps.length; all.length = 0; }
        if (m.caps.length === best) all.push(m);
      }
    }
    if (!best) {
      for (let sq = 0; sq < N * N; sq++) {
        const p = b[sq];
        if (sideOf(p) !== s.turn) continue;
        const r = Math.floor(sq / N), c = sq % N;
        for (const [dr, dc] of DIRS) {
          if (!isKing(p) && dr !== (s.turn === 0 ? -1 : 1)) continue;
          let rr = r + dr, cc = c + dc;
          while (inside(rr, cc) && !b[rr * N + cc]) {
            all.push({ path: [sq, rr * N + cc], caps: [] });
            if (!isKing(p)) break;
            rr += dr; cc += dc;
          }
        }
      }
    }
    // Deux rafles au trajet identique sont le même coup.
    const seen = new Set(), out = [];
    for (const m of all) {
      m.key = m.path.join(m.caps.length ? 'x' : '-');
      if (seen.has(m.key)) continue;
      seen.add(m.key);
      m.from = m.path[0];
      m.to = m.path.at(-1);
      m.piece = b[m.from];
      m.cap = m.caps.length;
      out.push(m);
    }
    return out;
  }

  // Catégorie de fin de partie limitée : dame seule contre 3 pièces dont une dame (16 coups chacun),
  // ou contre 2 pièces / 1 dame (5 coups chacun).
  function lateKind(b) {
    const count = [[0, 0], [0, 0]]; // [pions, dames] par camp
    for (const p of b) if (p) count[sideOf(p)][isKing(p) ? 1 : 0]++;
    for (const side of [0, 1]) {
      const [men, kings] = count[side], [omen, okings] = count[1 - side];
      if (men === 0 && kings === 1 && okings >= 1) {
        const total = omen + okings;
        if (total === 3) return 16;
        if (total <= 2) return 5;
      }
    }
    return 0;
  }

  function play(s, m) {
    const b = s.b.slice();
    let piece = b[m.from];
    b[m.from] = '';
    for (const c of m.caps) b[c] = '';
    const last = s.turn === 0 ? 0 : N - 1;
    if (!isKing(piece) && Math.floor(m.to / N) === last) piece = piece.toUpperCase();
    b[m.to] = piece;
    const quietKing = isKing(m.piece) && !m.caps.length;
    const kind = lateKind(b);
    const n = {
      b, turn: 1 - s.turn,
      kingMoves: quietKing ? s.kingMoves + 1 : 0,
      lateKind: kind, late: kind && kind === s.lateKind ? s.late + 1 : kind ? 1 : 0, hist: null,
    };
    n.hist = { k: posKey(n), prev: quietKing ? s.hist : null };
    return n;
  }

  function over(s, legal = moves(s)) {
    if (!legal.length) return { winner: 1 - s.turn, reason: s.b.some(p => sideOf(p) === s.turn) ? 'Plus aucun coup possible' : 'Toutes les pièces prises' };
    let reps = 0;
    for (let h = s.hist; h; h = h.prev) if (h.k === s.hist.k) reps++;
    if (reps >= 3) return { winner: null, reason: 'Triple répétition' };
    if (s.kingMoves >= 50) return { winner: null, reason: '25 coups de dames sans prise ni pion joué' };
    if (s.lateKind && s.late >= s.lateKind * 2) return { winner: null, reason: `Fin de partie : ${s.lateKind} coups sans conclusion` };
    return null;
  }

  // Notation officielle : 32-28, 28x19x10 (rafle : cases d'arrivée successives).
  const notation = (s, m) => m.caps.length ? m.path.map(num).join('x') : `${num(m.from)}-${num(m.to)}`;

  function evaluate(s) {
    let score = 0;
    for (let sq = 0; sq < N * N; sq++) {
      const p = s.b[sq];
      if (!p) continue;
      const r = Math.floor(sq / N), c = sq % N, side = sideOf(p);
      let v = isKing(p) ? 320 : 100 + (side === 0 ? 9 - r : r) * 4; // un pion qui avance vaut plus
      if (!isKing(p) && c > 2 && c < 7 && r > 2 && r < 7) v += 6; // centre
      if (!isKing(p) && r === (side === 0 ? 9 : 0)) v += 8; // la dernière rangée protège contre les dames adverses
      score += side === 0 ? v : -v;
    }
    return s.turn === 0 ? score : -score;
  }

  // Pour les robots : la position est-elle déjà apparue récemment ? (elle mène alors à la nulle)
  function repeated(s) {
    let n = 0;
    for (let h = s.hist?.prev; h && n < 16; h = h.prev, n++) if (h.k === s.hist.k) return true;
    return false;
  }

  return {
    repeated,
    id: 'draughts', name: 'Dames', sides: ['Blancs', 'Noirs'], size: N,
    init, moves, play, over, notation, evaluate, num,
    order: m => m.caps.length * 100 + (isKing(m.piece) ? 0 : 1),
    terminal: () => -1, // sans coup possible, on perd
    isCapture: m => m.caps.length > 0,
    forcedCaptures: true,
  };
});
