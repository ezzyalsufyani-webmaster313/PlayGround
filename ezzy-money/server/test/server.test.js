'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { createServer } = require('../src/server');
const { goodMod, makeZip } = require('./helpers');

test('pair, upload, list and download a mod', async (t) => {
  const server = createServer().listen(0);
  t.after(() => server.close());
  await new Promise((r) => server.once('listening', r));
  const base = `http://127.0.0.1:${server.address().port}`;

  const page = await fetch(base + '/');
  assert.match(await page.text(), /Ezzy Money Mods/);

  const { code, token } = await (await fetch(base + '/api/pair', { method: 'POST' })).json();
  assert.match(code, /^\d{6}$/);

  const wrong = await fetch(base + '/api/upload?code=999999x', { method: 'POST', body: goodMod() });
  assert.strictEqual(wrong.status, 404);

  const rejected = await fetch(`${base}/api/upload?code=${code}`, { method: 'POST', body: makeZip({ 'hack.dll': 'x' }) });
  assert.strictEqual(rejected.status, 422);

  const mod = goodMod();
  const up = await (await fetch(`${base}/api/upload?code=${code}`, { method: 'POST', body: mod })).json();
  assert.strictEqual(up.ok, true);

  assert.strictEqual((await fetch(base + '/api/pending', { headers: { 'x-pair-token': 'nope' } })).status, 401);
  const pending = await (await fetch(base + '/api/pending', { headers: { 'x-pair-token': token } })).json();
  assert.deepStrictEqual(pending.map((p) => p.id), [up.id]);

  const dl = await fetch(`${base}/api/download/${up.id}`, { headers: { 'x-pair-token': token } });
  assert.strictEqual(dl.status, 200);
  assert.deepStrictEqual(Buffer.from(await dl.arrayBuffer()), mod);

  const again = await fetch(`${base}/api/download/${up.id}`, { headers: { 'x-pair-token': token } });
  assert.strictEqual(again.status, 404, 'each upload downloads once');
});
