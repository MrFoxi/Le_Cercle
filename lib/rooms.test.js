// Changer de place dans le salon (événement « swap » de lib/rooms.js), avec de faux sockets et le salon du Puissance 4.
const test = require('node:test');
const assert = require('node:assert');
const rooms = require('./rooms');
const { Room } = require('../jeux/p4/server/game');

let connect;
rooms({ name: '/p4', on: (ev, fn) => { connect = fn; }, emit() {} }, { Room, actions: ['start'] });
const client = () => {
  const on = {}, got = {};
  const s = { handshake: { headers: { cookie: '' } }, on: (ev, fn) => { on[ev] = fn; }, emit: (ev, v) => { got[ev] = v; }, disconnect() {} };
  s.volatile = s;
  connect(s);
  const call = (ev, ...args) => new Promise(res => on[ev](...args, res));
  return { got, call };
};

test('un joueur passe spectateur puis revient, seulement dans le salon', async () => {
  const a = client(), b = client(), c = client();
  await a.call('create', { name: 'Ana' });
  const code = a.got.session.code;
  await b.call('join', { code, name: 'Bob' });
  await c.call('join', { code, name: 'Cléo', watch: true });

  assert.match((await c.call('swap')).error, /complet/); // 2 joueurs déjà : Cléo reste spectatrice
  assert.ok(c.got.state.spectator);

  assert.ok((await b.call('swap')).ok); // Bob regarde, Cléo peut prendre sa place
  assert.ok(b.got.state.spectator);
  assert.ok((await c.call('swap')).ok);
  assert.ok(!c.got.state.spectator);
  assert.deepStrictEqual(a.got.state.players.map(p => p.name).sort(), ['Ana', 'Cléo']);

  await a.call('act', 'start');
  assert.match((await b.call('swap')).error, /avant la partie/);
});

test('le dernier joueur humain ne peut pas passer spectateur', async () => {
  const a = client();
  await a.call('create', { name: 'Seul' });
  assert.match((await a.call('swap')).error, /autre joueur/);
});
