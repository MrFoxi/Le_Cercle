// Tests de l'administration : pseudo réservé, connexion par mot de passe, cookie, accès refusé sans lui, essais limités.
const assert = require('assert');
const express = require('express');
const admin = require('./admin');

(async () => {
  delete process.env.ADMIN_PASSWORD;
  // sans mot de passe configuré : personne ne peut prendre le pseudo, pas même avec un faux cookie
  assert.strictEqual(admin.reserved('mrfoxi ', ''), 'Ce pseudo est réservé');
  assert.strictEqual(admin.reserved('Ana', ''), null);
  process.env.ADMIN_PASSWORD = 'test-secret';
  let closed = null;
  admin.rooms.test = { list: () => [{ code: 'ABCDE', players: [] }], close: code => (closed = code) === 'ABCDE' };
  // bannissement : le pseudo est refusé partout
  assert.strictEqual(admin.reserved('Triche', ''), null);
  const app = express().use('/api/admin', admin.router), server = app.listen(0), url = `http://localhost:${server.address().port}/api/admin`;
  const post = (p, body, cookie = '') => fetch(`${url}/${p}`, { method: 'POST', headers: { 'Content-Type': 'application/json', cookie }, body: JSON.stringify(body) });
  assert.strictEqual((await fetch(`${url}/state`)).status, 403);
  assert.strictEqual((await post('login', { password: 'faux' })).status, 401);
  const ok = await post('login', { password: 'test-secret' });
  assert.strictEqual(ok.status, 200);
  const cookie = ok.headers.get('set-cookie').split(';')[0];
  assert(admin.isAdmin(cookie) && admin.reserved('MrFoxi', cookie) === null);
  assert(!admin.isAdmin(cookie.replace(/.$/, c => (c === '0' ? '1' : '0')))); // signature modifiée : refusée
  const st = await (await fetch(`${url}/state`, { headers: { cookie } })).json();
  assert.deepStrictEqual(st.rooms.test, [{ code: 'ABCDE', players: [] }]);
  assert.strictEqual((await post('close', { game: 'test', code: 'ABCDE' }, cookie)).status, 200);
  assert.strictEqual(closed, 'ABCDE');
  assert.strictEqual((await post('close', { game: 'test', code: 'ABCDE' })).status, 403); // sans cookie
  assert.strictEqual((await post('ban', { name: 'Triche', reason: 'test' }, cookie)).status, 200);
  assert.strictEqual(admin.reserved('triche', ''), 'Ce pseudo a été banni du Cercle');
  await post('unban', { name: 'Triche' }, cookie);
  assert.strictEqual(admin.reserved('Triche', ''), null);
  // annonce publique
  await post('announce', { text: 'Maintenance à 22 h' }, cookie);
  assert.strictEqual((await (await fetch(`${url}/announce`)).json()).text, 'Maintenance à 22 h');
  await post('announce', { text: '' }, cookie);
  // changer le mot de passe déconnecte
  process.env.ADMIN_PASSWORD = 'autre';
  assert(!admin.isAdmin(cookie));
  // essais limités
  let last; for (let k = 0; k < 9; k++) last = await post('login', { password: 'non' });
  assert.strictEqual(last.status, 429);
  server.close();
  console.log('Tests de l’administration : OK');
})();
