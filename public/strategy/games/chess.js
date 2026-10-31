// Échecs : règles complètes (roque, prise en passant, promotion, mat, pat, 50 coups, répétition, matériel insuffisant).
// Même fichier pour le serveur (arbitre, robots) et le navigateur (coups possibles, notation).
(function (root, factory) {
  const game = factory();
  if (typeof module === 'object' && module.exports) module.exports = game;
  else (root.StrategyGames = root.StrategyGames || {})[game.id] = game;
})(this, function () {
  // Case = ligne * 8 + colonne, ligne 0 = 8e rangée (en haut, côté noir). Pièces : majuscule = blanc, minuscule = noir.
  const FILES = 'abcdefgh';
  const KN = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]];
  const KG = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
  const DIAG = [[-1, -1], [-1, 1], [1, -1], [1, 1]], ORTH = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  const VALUE = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };
  const GLYPH = { k: '♔', q: '♕', r: '♖', b: '♗', n: '♘' };
  const inside = (r, c) => r >= 0 && r < 8 && c >= 0 && c < 8;
  const sideOf = p => (p ? (p === p.toUpperCase() ? 0 : 1) : -1);
  const as = (side, t) => (side === 0 ? t.toUpperCase() : t);
  const sqName = sq => FILES[sq & 7] + (8 - (sq >> 3));

  // Tables de position (vue des blancs, ligne 0 = 8e rangée) : avancer les pions, centraliser cavaliers et fous, roi à l'abri.
  const PST = {
    p: [0, 0, 0, 0, 0, 0, 0, 0, 50, 50, 50, 50, 50, 50, 50, 50, 10, 10, 20, 30, 30, 20, 10, 10, 5, 5, 10, 25, 25, 10, 5, 5, 0, 0, 0, 20, 20, 0, 0, 0, 5, -5, -10, 0, 0, -10, -5, 5, 5, 10, 10, -20, -20, 10, 10, 5, 0, 0, 0, 0, 0, 0, 0, 0],
    n: [-50, -40, -30, -30, -30, -30, -40, -50, -40, -20, 0, 0, 0, 0, -20, -40, -30, 0, 10, 15, 15, 10, 0, -30, -30, 5, 15, 20, 20, 15, 5, -30, -30, 0, 15, 20, 20, 15, 0, -30, -30, 5, 10, 15, 15, 10, 5, -30, -40, -20, 0, 5, 5, 0, -20, -40, -50, -40, -30, -30, -30, -30, -40, -50],
    b: [-20, -10, -10, -10, -10, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 10, 10, 5, 0, -10, -10, 5, 5, 10, 10, 5, 5, -10, -10, 0, 10, 10, 10, 10, 0, -10, -10, 10, 10, 10, 10, 10, 10, -10, -10, 5, 0, 0, 0, 0, 5, -10, -20, -10, -10, -10, -10, -10, -10, -20],
    r: [0, 0, 0, 0, 0, 0, 0, 0, 5, 10, 10, 10, 10, 10, 10, 5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, 0, 0, 0, 5, 5, 0, 0, 0],
    q: [-20, -10, -10, -5, -5, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 5, 5, 5, 0, -10, -5, 0, 5, 5, 5, 5, 0, -5, 0, 0, 5, 5, 5, 5, 0, -5, -10, 5, 5, 5, 5, 5, 0, -10, -10, 0, 5, 0, 0, 0, 0, -10, -20, -10, -10, -5, -5, -10, -10, -20],
    k: [-30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -20, -30, -30, -40, -40, -30, -30, -20, -10, -20, -20, -20, -20, -20, -20, -10, 20, 20, 0, 0, 0, 0, 20, 20, 20, 30, 10, 0, 0, 10, 30, 20],
  };

  function init() {
    const back = 'rnbqkbnr', b = Array(64).fill('');
    for (let c = 0; c < 8; c++) { b[c] = back[c]; b[8 + c] = 'p'; b[48 + c] = 'P'; b[56 + c] = back[c].toUpperCase(); }
    const s = { b, turn: 0, castle: 'KQkq', ep: -1, half: 0, full: 1, hist: null };
    s.hist = { k: posKey(s), prev: null };
    return s;
  }
  const posKey = s => `${s.b.join(',')}|${s.turn}|${s.castle}|${s.ep}`;

  // La case sq est-elle attaquée par le camp « by » ?
  function attacked(b, sq, by) {
    const r = sq >> 3, c = sq & 7, pr = by === 0 ? r + 1 : r - 1;
    for (const dc of [-1, 1]) if (inside(pr, c + dc) && b[pr * 8 + c + dc] === as(by, 'p')) return true;
    for (const [dr, dc] of KN) if (inside(r + dr, c + dc) && b[(r + dr) * 8 + c + dc] === as(by, 'n')) return true;
    for (const [dr, dc] of KG) if (inside(r + dr, c + dc) && b[(r + dr) * 8 + c + dc] === as(by, 'k')) return true;
    for (const [dirs, t] of [[DIAG, 'b'], [ORTH, 'r']]) {
      for (const [dr, dc] of dirs) {
        let rr = r + dr, cc = c + dc;
        while (inside(rr, cc)) {
          const p = b[rr * 8 + cc];
          if (p) { if (p === as(by, t) || p === as(by, 'q')) return true; break; }
          rr += dr; cc += dc;
        }
      }
    }
    return false;
  }
  const inCheck = (s, side = s.turn) => attacked(s.b, s.b.indexOf(as(side, 'k')), 1 - side);

  function pseudo(s) {
    const { b, turn } = s, out = [];
    const add = (from, to, extra) => out.push({ from, to, piece: b[from], cap: b[to] || null, ...extra });
    for (let sq = 0; sq < 64; sq++) {
      const p = b[sq];
      if (sideOf(p) !== turn) continue;
      const r = sq >> 3, c = sq & 7, t = p.toLowerCase();
      if (t === 'p') {
        const d = turn === 0 ? -1 : 1, start = turn === 0 ? 6 : 1, last = turn === 0 ? 0 : 7;
        const push = (to, extra) => {
          if (to >> 3 === last) for (const q of 'qrbn') add(sq, to, { ...extra, promo: as(turn, q) });
          else add(sq, to, extra);
        };
        const f = sq + d * 8;
        if (!b[f]) {
          push(f);
          if (r === start && !b[f + d * 8]) add(sq, f + d * 8, { double: true });
        }
        for (const dc of [-1, 1]) {
          if (!inside(r + d, c + dc)) continue;
          const to = (r + d) * 8 + c + dc;
          if (b[to] && sideOf(b[to]) !== turn) push(to);
          else if (to === s.ep) add(sq, to, { ep: true, cap: as(1 - turn, 'p') });
        }
      } else if (t === 'n' || t === 'k') {
        for (const [dr, dc] of t === 'n' ? KN : KG) {
          if (!inside(r + dr, c + dc)) continue;
          const to = (r + dr) * 8 + c + dc;
          if (sideOf(b[to]) !== turn) add(sq, to);
        }
        if (t === 'k') {
          const home = turn === 0 ? 60 : 4, foe = 1 - turn;
          if (sq === home && !attacked(b, home, foe)) {
            if (s.castle.includes(as(turn, 'k')) && !b[home + 1] && !b[home + 2] && b[home + 3] === as(turn, 'r')
              && !attacked(b, home + 1, foe) && !attacked(b, home + 2, foe)) add(sq, home + 2, { castle: 'k' });
            if (s.castle.includes(as(turn, 'q')) && !b[home - 1] && !b[home - 2] && !b[home - 3] && b[home - 4] === as(turn, 'r')
              && !attacked(b, home - 1, foe) && !attacked(b, home - 2, foe)) add(sq, home - 2, { castle: 'q' });
          }
        }
      } else {
        const dirs = t === 'b' ? DIAG : t === 'r' ? ORTH : DIAG.concat(ORTH);
        for (const [dr, dc] of dirs) {
          let rr = r + dr, cc = c + dc;
          while (inside(rr, cc)) {
            const to = rr * 8 + cc;
            if (sideOf(b[to]) === turn) break;
            add(sq, to);
            if (b[to]) break;
            rr += dr; cc += dc;
          }
        }
      }
    }
    for (const m of out) m.key = sqName(m.from) + sqName(m.to) + (m.promo ? m.promo.toLowerCase() : '');
    return out;
  }

  function play(s, m) {
    const b = s.b.slice(), turn = s.turn;
    b[m.to] = m.promo || b[m.from];
    b[m.from] = '';
    if (m.ep) b[m.to + (turn === 0 ? 8 : -8)] = '';
    if (m.castle === 'k') { b[m.to - 1] = b[m.to + 1]; b[m.to + 1] = ''; }
    if (m.castle === 'q') { b[m.to + 1] = b[m.to - 2]; b[m.to - 2] = ''; }
    let castle = s.castle;
    if (m.piece.toLowerCase() === 'k') castle = castle.replace(turn === 0 ? /[KQ]/g : /[kq]/g, '');
    for (const [sq, f] of [[63, 'K'], [56, 'Q'], [7, 'k'], [0, 'q']]) if (m.from === sq || m.to === sq) castle = castle.replace(f, '');
    const irreversible = m.piece.toLowerCase() === 'p' || m.cap;
    const n = { b, turn: 1 - turn, castle, ep: m.double ? (m.from + m.to) / 2 : -1, half: irreversible ? 0 : s.half + 1, full: s.full + turn, hist: null };
    n.hist = { k: posKey(n), prev: irreversible ? null : s.hist };
    return n;
  }

  function moves(s) {
    return pseudo(s).filter(m => !inCheck(play(s, m), s.turn));
  }

  function insufficient(b) {
    const rest = b.filter(p => p && p.toLowerCase() !== 'k');
    if (!rest.length) return true;
    if (rest.length === 1 && 'nb'.includes(rest[0].toLowerCase())) return true;
    // Fous seulement, tous sur des cases de même couleur
    const bishops = b.map((p, i) => (p && p.toLowerCase() === 'b' ? ((i >> 3) + (i & 7)) % 2 : -1)).filter(x => x >= 0);
    return bishops.length === rest.length && new Set(bishops).size === 1;
  }
  function repetitions(s) {
    let n = 0;
    for (let h = s.hist; h; h = h.prev) if (h.k === s.hist.k) n++;
    return n;
  }

  // Fin de partie : null si elle continue, sinon { winner: 0 | 1 | null, reason }.
  function over(s, legal = moves(s)) {
    if (!legal.length) return inCheck(s) ? { winner: 1 - s.turn, reason: 'Échec et mat' } : { winner: null, reason: 'Pat' };
    if (s.half >= 100) return { winner: null, reason: 'Règle des 50 coups' };
    if (repetitions(s) >= 3) return { winner: null, reason: 'Triple répétition' };
    if (insufficient(s.b)) return { winner: null, reason: 'Matériel insuffisant' };
    return null;
  }

  // Notation algébrique avec figurines : ♘f3, exd5, O-O, e8=♕+, ♖axd1#.
  function notation(s, m) {
    let txt;
    if (m.castle) txt = m.castle === 'k' ? 'O-O' : 'O-O-O';
    else {
      const t = m.piece.toLowerCase(), dest = sqName(m.to), x = m.cap ? 'x' : '';
      if (t === 'p') txt = (m.cap ? FILES[m.from & 7] + x : '') + dest + (m.promo ? '=' + GLYPH[m.promo.toLowerCase()] : '');
      else {
        const twins = moves(s).filter(o => o.piece === m.piece && o.to === m.to && o.from !== m.from);
        let dis = '';
        if (twins.length) {
          if (!twins.some(o => (o.from & 7) === (m.from & 7))) dis = FILES[m.from & 7];
          else if (!twins.some(o => o.from >> 3 === m.from >> 3)) dis = String(8 - (m.from >> 3));
          else dis = sqName(m.from);
        }
        txt = GLYPH[t] + dis + x + dest;
      }
    }
    const next = play(s, m);
    if (inCheck(next)) txt += moves(next).length ? '+' : '#';
    return txt;
  }

  // Évaluation pour les robots, du point de vue du camp qui doit jouer.
  function evaluate(s) {
    let score = 0;
    for (let sq = 0; sq < 64; sq++) {
      const p = s.b[sq];
      if (!p) continue;
      const t = p.toLowerCase(), white = p !== t;
      const v = VALUE[t] + PST[t][white ? sq : (7 - (sq >> 3)) * 8 + (sq & 7)];
      score += white ? v : -v;
    }
    return s.turn === 0 ? score : -score;
  }
  const order = m => (m.cap ? 10 * VALUE[m.cap.toLowerCase()] - VALUE[m.piece.toLowerCase()] : 0) + (m.promo ? 800 : 0);

  // Pour les robots : la position est-elle déjà apparue récemment ? (elle mène alors à la nulle)
  function repeated(s) {
    let n = 0;
    for (let h = s.hist?.prev; h && n < 16; h = h.prev, n++) if (h.k === s.hist.k) return true;
    return false;
  }

  return {
    repeated,
    id: 'chess', name: 'Échecs', sides: ['Blancs', 'Noirs'], size: 8,
    init, moves, play, over, notation, evaluate, order, inCheck, attacked, sqName, VALUE,
    captures: s => pseudo(s).filter(m => (m.cap || m.promo) && !inCheck(play(s, m), s.turn)),
    terminal: s => (inCheck(s) ? -1 : 0), // sans coup légal : mat (perdu) ou pat (nul)
    isCapture: m => !!m.cap || !!m.promo,
  };
});
