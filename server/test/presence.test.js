import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';
import { newClientId, startServer } from './helpers.js';

let srv;
beforeEach(async () => {
  srv = await startServer();
});
afterEach(async () => {
  await srv.close();
});

const beat = (clientId) => srv.request('POST', '/api/presence', { clientId });

test('400 no_client without a valid X-Client-Id', async () => {
  for (const clientId of [undefined, 'nope']) {
    const res = await beat(clientId);
    assert.deepEqual([res.status, res.json], [400, { error: 'no_client' }]);
  }
});

test('counts distinct live clients and returns their avatar seeds', async () => {
  const a = newClientId();
  const first = await beat(a);
  assert.equal(first.status, 200);
  assert.deepEqual(Object.keys(first.json).sort(), ['avatars', 'count']);
  assert.equal(first.json.count, 1);
  assert.equal(first.json.avatars.length, 1);

  const b = newClientId();
  const second = await beat(b);
  assert.equal(second.json.count, 2);
  // Repeated heartbeats don't double count.
  assert.equal((await beat(a)).json.count, 2);
});

test('avatar seeds are stable, non-reversible and at most 5; own seed first', async () => {
  const ids = Array.from({ length: 7 }, newClientId);
  const seeds = [];
  for (const id of ids) seeds.push((await beat(id)).json.avatars[0]);

  const res = await beat(ids[3]);
  assert.equal(res.json.count, 7);
  assert.equal(res.json.avatars.length, 5);
  assert.equal(res.json.avatars[0], seeds[3]);
  assert.equal(new Set(res.json.avatars).size, 5);

  // Stable across heartbeats.
  assert.equal((await beat(ids[0])).json.avatars[0], seeds[0]);

  // Seeds are short hex strings unrelated to the raw id or the stored hash format.
  for (const seed of seeds) assert.match(seed, /^[0-9a-f]{16}$/);
  const raw = JSON.stringify(res.json);
  for (const id of ids) {
    assert.ok(!raw.includes(id));
    assert.ok(!raw.includes(id.replaceAll('-', '').slice(0, 16)));
  }
});

test('the same client id maps to the same seed in chat and presence only via the hash', async () => {
  // Seeds must not equal the stored client hash (or a prefix of it).
  const id = newClientId();
  await srv.request('POST', '/api/chat', { clientId: id, body: { name: 'Sam', body: 'hi' } });
  const hash = srv.db.prepare('SELECT client_hash FROM messages').get().client_hash;
  const seed = (await beat(id)).json.avatars[0];
  assert.ok(!hash.startsWith(seed));
});

test('entries expire 45 s after the last heartbeat (injected clock)', async () => {
  const a = newClientId();
  const b = newClientId();
  await beat(a);
  srv.clock.advance(30_000);
  await beat(b);

  srv.clock.advance(14_000); // a: 44 s since last beat → still present
  assert.equal((await beat(b)).json.count, 2);

  srv.clock.advance(1_000); // a: 45 s → expired
  const res = await beat(b);
  assert.equal(res.json.count, 1);
  assert.equal(res.json.avatars.length, 1);

  // A heartbeat keeps a client alive indefinitely.
  for (let i = 0; i < 5; i++) {
    srv.clock.advance(40_000);
    assert.equal((await beat(b)).json.count, 1);
  }
  // And a returning client is counted again.
  assert.equal((await beat(a)).json.count, 2);
});
