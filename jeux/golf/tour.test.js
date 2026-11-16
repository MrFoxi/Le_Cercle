// La Tour en ligne : un faux canal Socket.io suffit à vérifier ce que le serveur relaie et ce qu'il refuse
const test = require('node:test');
const assert = require('node:assert');
const tour = require('./server/tour');

function fakeNsp() {
  const sent = [], rooms = new Map();
  const nsp = { sent, to: r => ({ emit: (...a) => sent.push([r, ...a]) }) };
  let n = 0;
  nsp.socket = (cookie = '') => {
    const h = {}, s = { id: 's' + ++n, handshake: { headers: { cookie } }, on: (e, f) => (h[e] = f), emit: (...a) => sent.push(['moi:' + s.id, ...a]), join: r => rooms.set(s.id + r, 1), leave: () => {} };
    s.to = r => ({ emit: (...a) => sent.push([r + ' sauf ' + s.id, ...a]) }); s.volatile = s; s.fire = (e, ...a) => h[e](...a);
    tour(nsp, s);
    return s;
  };
  return nsp;
}

test('les grimpeurs se voient, le pseudo réservé est remplacé, une victoire n’est annoncée qu’une fois près du sommet', () => {
  const nsp = fakeNsp(), a = nsp.socket(), b = nsp.socket();
  let ra, rb;
  a.fire('tour:join', 'MrFoxi', [0, 0.3, 0], r => (ra = r));
  assert.match(ra.me.name, /^Grimpeur \d+$/, 'MrFoxi sans le cookie admin');
  b.fire('tour:join', 'Paul', [1, 0.3, 1], r => (rb = r));
  assert.deepStrictEqual(rb.others.map(o => o.name), [ra.me.name], 'Paul voit le premier grimpeur');
  // positions : refusées si ce ne sont pas trois nombres dans la tour, relayées sinon
  const before = nsp.sent.length;
  b.fire('tour:pos', [NaN, 1, 1]); b.fire('tour:pos', 'x'); b.fire('tour:pos', [1, 999, 1]);
  assert.strictEqual(nsp.sent.length, before);
  b.fire('tour:pos', [2, 5.123456, 3]);
  assert.deepStrictEqual(nsp.sent.at(-1).slice(1), ['tour:pos', rb.me.id, [2, 5.12, 3]]);
  // victoire : refusée loin du sommet, acceptée une seule fois ensuite
  b.fire('tour:win', 40, 'normal', false);
  assert.ok(!nsp.sent.some(m => m[1] === 'tour:win'));
  const t = Date.now(); while (Date.now() - t < 130); // la limite de débit des positions
  b.fire('tour:pos', [10, 120.3, 0]);
  b.fire('tour:win', 40, 'hardcore', false); b.fire('tour:win', 40, 'hardcore', false);
  assert.deepStrictEqual(nsp.sent.filter(m => m[1] === 'tour:win').map(m => m.slice(2)), [['Paul', 40, 'hardcore']]);
  // départ : les autres sont prévenus
  b.fire('disconnect');
  assert.ok(nsp.sent.some(m => m[0] === 'tour' && m[1] === 'tour:out' && m[2] === rb.me.id));
  a.fire('tour:leave');
  assert.strictEqual(tour.climbers.size, 0);
});
