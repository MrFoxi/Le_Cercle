// Tests du Strategy Club : règles des 4 jeux (comptages de référence « perft »), cas particuliers, salon, robots.
const assert = require('assert');
const chess = require('./public/strategy/games/chess');
const draughts = require('./public/strategy/games/draughts');
const shogi = require('./public/strategy/games/shogi');
const go = require('./public/strategy/games/go');
const AI = require('./public/strategy/ai');
const { Room } = require('./strategy/game');

const perft = (g, s, d) => (d ? g.moves(s).reduce((n, m) => n + perft(g, g.play(s, m), d - 1), 0) : 1);
const playKeys = (g, s, keys) => keys.reduce((st, k) => { const m = g.moves(st).find(x => x.key === k); assert(m, `coup ${k} introuvable`); return g.play(st, m); }, s);

/* ---------- Échecs ---------- */
function fen(f) {
  const [pos, turn, castle, ep] = f.split(' '), b = [];
  for (const ch of pos.replace(/\//g, '')) if (/\d/.test(ch)) for (let i = 0; i < +ch; i++) b.push(''); else b.push(ch);
  return { b, turn: turn === 'w' ? 0 : 1, castle: castle === '-' ? '' : castle, ep: ep === '-' ? -1 : (8 - +ep[1]) * 8 + 'abcdefgh'.indexOf(ep[0]), half: 0, full: 1, hist: { k: 'x', prev: null } };
}
assert.strictEqual(perft(chess, chess.init(), 3), 8902);
assert.strictEqual(perft(chess, fen('r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq -'), 2), 2039); // roques, prise en passant, promotions
assert.strictEqual(perft(chess, fen('8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - -'), 3), 2812);
{
  const s = playKeys(chess, chess.init(), ['f2f3', 'e7e5', 'g2g4']);
  const mate = chess.moves(s).find(m => m.key === 'd8h4');
  assert.strictEqual(chess.notation(s, mate), '♕h4#');
  assert.deepStrictEqual(chess.over(chess.play(s, mate)), { winner: 1, reason: 'Échec et mat' });
  const pat = fen('7k/5Q2/6K1/8/8/8/8/8 b - -');
  assert.deepStrictEqual(chess.over(pat), { winner: null, reason: 'Pat' });
  // Triple répétition : les cavaliers font l'aller-retour deux fois
  const rep = playKeys(chess, chess.init(), ['g1f3', 'g8f6', 'f3g1', 'f6g8', 'g1f3', 'g8f6', 'f3g1', 'f6g8']);
  assert.strictEqual(chess.over(rep).reason, 'Triple répétition');
}

/* ---------- Dames internationales ---------- */
assert.deepStrictEqual([1, 2, 3, 4].map(d => perft(draughts, draughts.init(), d)), [9, 81, 658, 4265]);
{
  const sq = n => { const i = n - 1, r = Math.floor(i / 5); return r * 10 + (i % 5) * 2 + (r % 2 === 0 ? 1 : 0); };
  const empty = () => ({ b: Array(100).fill(''), turn: 0, kingMoves: 0, late: 0, lateKind: 0, hist: { k: 'x', prev: null } });
  // Prise majoritaire : la rafle de 2 pièces est obligatoire, la prise simple n'est pas proposée
  const s = empty();
  s.b[sq(33)] = 'w'; s.b[sq(28)] = 'b'; s.b[sq(19)] = 'b'; s.b[sq(29)] = 'b';
  assert.deepStrictEqual(draughts.moves(s).map(m => draughts.notation(s, m)), ['33x24x13']);
  // Un pion qui traverse la dernière rangée pendant une rafle n'est pas promu
  const p = empty();
  p.b[sq(13)] = 'w'; p.b[sq(9)] = 'b'; p.b[sq(10)] = 'b';
  const m = draughts.moves(p)[0];
  assert.strictEqual(draughts.notation(p, m), '13x4x15');
  assert.strictEqual(draughts.play(p, m).b[sq(15)], 'w');
  // Plus de pièces : perdu
  const lone = empty(); lone.b[sq(20)] = 'b'; lone.turn = 0;
  assert.strictEqual(draughts.over(lone).winner, 1);
}

/* ---------- Shogi ---------- */
assert.deepStrictEqual([1, 2, 3].map(d => perft(shogi, shogi.init(), d)), [30, 900, 25470]);
{
  const empty = () => ({ b: Array(81).fill(''), hands: [{}, {}], turn: 0, hist: { k: 'x', t: 0, chk: false, prev: null } });
  const at = (file, rank) => 'abcdefghi'.indexOf(rank) * 9 + (9 - file);
  // Nifu : pas de 2e pion non promu sur une colonne
  const n = empty();
  n.b[at(5, 'i')] = 'K'; n.b[at(5, 'a')] = 'k'; n.b[at(7, 'g')] = 'P'; n.hands[0] = { P: 1 };
  const drops = shogi.moves(n).filter(m => m.drop === 'P').map(m => m.key);
  assert(!drops.some(k => k.startsWith('P*7')) && drops.includes('P*6e'));
  // Uchifuzume : parachuter un pion qui fait mat est interdit (mais un autre mat par parachutage est permis)
  const u = empty();
  u.b[at(1, 'a')] = 'k'; u.b[at(2, 'a')] = 'l'; u.b[at(2, 'b')] = 'p'; u.b[at(1, 'c')] = 'G'; u.b[at(5, 'i')] = 'K'; u.b[at(3, 'c')] = 'S';
  u.hands[0] = { P: 1, G: 1 };
  const keys = shogi.moves(u).map(m => m.key);
  assert(!keys.includes('P*1b'), 'uchifuzume accepté');
  assert(keys.includes('G*1b'));
  // Promotion forcée d'un pion qui arrive sur la dernière rangée
  const f = empty(); f.b[at(5, 'i')] = 'K'; f.b[at(9, 'a')] = 'k'; f.b[at(3, 'b')] = 'P';
  assert.deepStrictEqual(shogi.moves(f).filter(m => m.from === at(3, 'b')).map(m => m.key), ['3b3a+']);
  // Une pièce prise rejoint la réserve, sans sa promotion
  const c = empty(); c.b[at(5, 'i')] = 'K'; c.b[at(9, 'a')] = 'k'; c.b[at(5, 'e')] = 'R'; c.b[at(5, 'd')] = '+b';
  const after = shogi.play(c, shogi.moves(c).find(m => m.key === '5e5d'));
  assert.deepStrictEqual(after.hands[0], { B: 1 });
}

/* ---------- Go ---------- */
{
  const s0 = go.init({ goSize: 9 });
  const p = (c, r) => (9 - r) * 9 + 'ABCDEFGHJ'.indexOf(c); // ex. p('A', 1) = coin en bas à gauche
  // Capture au bord : la pierre blanche A1 n'a plus de liberté
  const cap = playKeys(go, s0, ['A2', 'A1', 'B1']);
  assert.strictEqual(cap.b[p('A', 1)], 0);
  assert.strictEqual(cap.caps[0], 1);
  // Ko : après la prise, la reprise immédiate est interdite
  let k = s0;
  k = playKeys(go, k, ['D5', 'E5', 'C4', 'F4', 'D3', 'E3', 'pass', 'D4']);
  k = playKeys(go, k, ['E4']); // noir prend D4
  assert.strictEqual(k.b[p('D', 4)], 0);
  assert(!go.moves(k).some(m => m.key === 'D4'), 'reprise du ko acceptée');
  // Suicide interdit
  let su = playKeys(go, s0, ['A2', 'pass', 'B1']);
  assert(!go.moves(su).some(m => m.key === 'A1'));
  // Compte : deux passes, territoires
  const sc = go.score(playKeys(go, s0, ['E5', 'pass']));
  assert.strictEqual(sc.total[0], 81); // tout le plateau est noir (compte chinois)
  assert.strictEqual(sc.winner, 0);
}

/* ---------- Robots : un coup légal à chaque jeu et chaque niveau ---------- */
for (const g of [chess, draughts, shogi, go]) {
  const s = g.init({ goSize: 9 });
  for (const level of ['debutant', 'intermediaire']) {
    const m = AI.choose(g, s, level);
    assert(g.moves(s).some(x => x.key === m.key), `${g.id} ${level}`);
  }
}
{
  // Le robot voit un mat en un
  const s = playKeys(chess, chess.init(), ['f2f3', 'e7e5', 'g2g4']);
  assert.strictEqual(AI.choose(chess, s, 'facile', () => 0.99).key, 'd8h4');
}

/* ---------- Salon ---------- */
(async () => {
  const r = new Room('ABCDE');
  r.addPlayer('Alice');
  r.addPlayer('Bob');
  assert.deepStrictEqual(r.seats.map(s => s.name), ['Alice', 'Bob']);
  assert.throws(() => r.configure('Bob', 'game', 'go'), /hôte/);
  r.setReady('Alice', true);
  assert.strictEqual(r.phase, 'lobby');
  r.setReady('Bob', true);
  assert.strictEqual(r.phase, 'playing');
  assert.throws(() => r.move('Bob', 'e7e5', 0), /ton tour/);
  r.move('Alice', 'f2f3', 0);
  assert.throws(() => r.move('Bob', 'e7e5', 0), /déjà joué/);
  r.move('Bob', 'e7e5', 1);
  r.move('Alice', 'g2g4', 2);
  r.move('Bob', 'd8h4', 3);
  assert.strictEqual(r.phase, 'over');
  assert.deepStrictEqual(r.result, { winner: 1, reason: 'Échec et mat' });
  assert.strictEqual(r.viewFor('Bob').history.at(-1).san, '♕h4#');
  // Revanche : il faut les deux, et les camps s'échangent
  r.requestRematch('Alice');
  assert.strictEqual(r.phase, 'over');
  r.requestRematch('Bob');
  assert.strictEqual(r.phase, 'playing');
  assert.deepStrictEqual(r.seats.map(s => s.name), ['Bob', 'Alice']);
  r.resign('Alice');
  assert.strictEqual(r.result.winner, 0);
  // Spectateur : voit la partie, ne peut pas jouer (le refus vient du salon commun, qui vérifie room.get)
  r.addSpectator('Zoé');
  assert.strictEqual(r.viewFor('Zoé').spectator, true);
  assert.strictEqual(r.get('Zoé'), undefined);

  // Pendule : le temps écoulé fait perdre
  const t = new Room('TIMER');
  t.addPlayer('A'); t.addPlayer('B');
  t.configure('A', 'time', 5);
  t.setReady('A', true); t.setReady('B', true);
  t.turnStart -= 5 * 60000 + 100;
  t.timeout();
  assert.strictEqual(t.result.winner, 1);

  // Contre un robot : il répond tout seul (thread), le salon est prévenu par notify
  const b = new Room('ROBOT');
  b.addPlayer('Alice');
  b.configure('Alice', 'game', 'draughts');
  b.addBot('Alice', 1, 'facile');
  const answered = new Promise(done => (b.notify = done));
  b.setReady('Alice', true);
  b.move('Alice', b.game.moves(b.state)[0].key, 0);
  await answered;
  assert.strictEqual(b.history.length, 2);
  assert.strictEqual(b.history[1].side, 1);
  b.resign('Alice');
  b.setBotLevel('Alice', 'expert');
  assert.strictEqual(b.seats[1].name, 'Robot Expert');

  // Go : deux passes, marquage d'une pierre morte, compte accepté par les deux
  const g = new Room('GOGOG');
  g.addPlayer('Noir'); g.addPlayer('Blanc');
  g.configure('Noir', 'game', 'go');
  g.configure('Noir', 'goSize', 9);
  g.setReady('Noir', true); g.setReady('Blanc', true);
  const keys = ['E5', 'A9', 'pass', 'pass'];
  keys.forEach((k, i) => g.move(i % 2 ? 'Blanc' : 'Noir', k, i));
  assert.strictEqual(g.phase, 'scoring');
  g.markDead('Blanc', 0); // A9 (point 0) déclarée morte
  g.acceptScore('Noir');
  g.acceptScore('Blanc');
  assert.strictEqual(g.phase, 'over');
  assert.strictEqual(g.result.winner, 0);
  console.log('Tests du Strategy Club : OK');
})().catch(e => { console.error(e); process.exit(1); });
