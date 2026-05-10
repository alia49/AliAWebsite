import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, test } from 'node:test';
import { newClientId, startServer } from './helpers.js';

const DESKTOP_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
const MOBILE_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148';

const MESSAGE_KEYS = ['body', 'createdAt', 'device', 'editedAt', 'id', 'mine', 'name'];

let srv;
beforeEach(async () => {
  // A generous IP limit so the per-client cooldown is what's under test (IP guard tested below).
  srv = await startServer({ limits: { chatIp: { limit: 1000, windowMs: 60_000 } } });
});
afterEach(async () => {
  await srv.close();
});

const post = (clientId, body, headers) => srv.request('POST', '/api/chat', { clientId, body, headers });

describe('POST /api/chat', () => {
  test('creates a message (201) with the documented shape', async () => {
    const id = newClientId();
    const res = await post(id, { name: '  Sam  ', body: '  Hello there!  ' }, { 'User-Agent': DESKTOP_UA });
    assert.equal(res.status, 201);
    const m = res.json.message;
    assert.deepEqual(Object.keys(m).sort(), MESSAGE_KEYS);
    assert.equal(typeof m.id, 'number');
    assert.equal(m.name, 'Sam');
    assert.equal(m.body, 'Hello there!');
    assert.equal(m.device, 'desktop');
    assert.equal(m.createdAt, new Date(srv.clock()).toISOString());
    assert.equal(m.editedAt, null);
    assert.equal(m.mine, true);
  });

  test('derives a coarse device from the User-Agent', async () => {
    const a = await post(newClientId(), { name: 'M', body: 'from a phone' }, { 'User-Agent': MOBILE_UA });
    assert.equal(a.json.message.device, 'mobile');
    const b = await post(newClientId(), { name: 'U', body: 'from curl' }, { 'User-Agent': 'curl/8.5.0' });
    assert.equal(b.json.message.device, 'unknown');
  });

  test('400 no_client without a valid X-Client-Id', async () => {
    for (const clientId of [undefined, 'not-a-uuid', '12345', '----------------']) {
      const res = await post(clientId, { name: 'Sam', body: 'hi' });
      assert.equal(res.status, 400);
      assert.deepEqual(res.json, { error: 'no_client' });
    }
  });

  test('400 bad_name for missing, blank, non-string or over-24-char names', async () => {
    for (const name of [undefined, '', '    ', 42, 'x'.repeat(25)]) {
      const res = await post(newClientId(), { name, body: 'hi' });
      assert.equal(res.status, 400, JSON.stringify(name));
      assert.deepEqual(res.json, { error: 'bad_name' });
    }
    const ok = await post(newClientId(), { name: 'x'.repeat(24), body: 'hi' });
    assert.equal(ok.status, 201);
  });

  test('400 empty for missing or whitespace-only bodies', async () => {
    for (const body of [undefined, '', '   \n\t ', null]) {
      const res = await post(newClientId(), { name: 'Sam', body });
      assert.deepEqual([res.status, res.json], [400, { error: 'empty' }]);
    }
  });

  test('400 too_long above 280 characters (emoji count as one)', async () => {
    const tooLong = await post(newClientId(), { name: 'Sam', body: 'a'.repeat(281) });
    assert.deepEqual([tooLong.status, tooLong.json], [400, { error: 'too_long' }]);
    const exact = await post(newClientId(), { name: 'Sam', body: '😀'.repeat(280) });
    assert.equal(exact.status, 201);
    // An oversized JSON body is also reported as too_long.
    const huge = await post(newClientId(), { name: 'Sam', body: 'a'.repeat(20_000) });
    assert.deepEqual([huge.status, huge.json], [400, { error: 'too_long' }]);
  });

  test('400 link for URLs, www, bare domains and obfuscated domains', async () => {
    for (const body of [
      'see https://spam.test/x',
      'go to www.spam',
      'visit example.com today',
      'EXAMPLE.CO.UK',
      'example[.]com',
      'example dot com',
      'my ip is 10.0.0.1',
      'mail me@gmail.com',
    ]) {
      const res = await post(newClientId(), { name: 'Sam', body });
      assert.deepEqual([res.status, res.json], [400, { error: 'link' }], body);
    }
    const nameLink = await post(newClientId(), { name: 'spam.com', body: 'hi' });
    assert.deepEqual(nameLink.json, { error: 'link' });
  });

  test('400 offensive for profanity, including leetspeak and spacing', async () => {
    for (const body of ['what the fuck', 'sh1t', 'fuuuuck this', 'f u c k', 'you @ss', 'bull$hit!']) {
      const res = await post(newClientId(), { name: 'Sam', body });
      assert.deepEqual([res.status, res.json], [400, { error: 'offensive' }], body);
    }
    const badName = await post(newClientId(), { name: 'b1tch', body: 'hi' });
    assert.deepEqual(badName.json, { error: 'offensive' });
  });

  test('allows ordinary text that merely resembles blocked patterns', async () => {
    for (const body of [
      'I passed my class assessment in Scunthorpe',
      'I use node.js and React e.g. hooks',
      'Great work.It really rocks',
      'version 1.2.3 shipped',
    ]) {
      const res = await post(newClientId(), { name: 'Sam', body });
      assert.equal(res.status, 201, `${body}: ${JSON.stringify(res.json)}`);
    }
  });

  test('429 cooldown within 15 s for the same client, with retryAfter', async () => {
    const id = newClientId();
    assert.equal((await post(id, { name: 'Sam', body: 'one' })).status, 201);
    srv.clock.advance(4_000);
    const res = await post(id, { name: 'Sam', body: 'two' });
    assert.equal(res.status, 429);
    assert.deepEqual(res.json, { error: 'cooldown', retryAfter: 11 });
    assert.equal(res.headers.get('retry-after'), '11');
    // Other clients are unaffected.
    assert.equal((await post(newClientId(), { name: 'Kim', body: 'hey' })).status, 201);
    srv.clock.advance(11_000);
    assert.equal((await post(id, { name: 'Sam', body: 'three' })).status, 201);
  });

  test('rejected posts do not start the cooldown', async () => {
    const id = newClientId();
    assert.equal((await post(id, { name: 'Sam', body: '' })).status, 400);
    assert.equal((await post(id, { name: 'Sam', body: 'fine' })).status, 201);
  });

  test('per-IP guard also answers 429 cooldown when one IP rotates client ids', async () => {
    const limited = await startServer({ limits: { chatIp: { limit: 2, windowMs: 60_000 } } });
    try {
      const p = (body) => limited.request('POST', '/api/chat', { clientId: newClientId(), body: { name: 'A', body } });
      assert.equal((await p('1')).status, 201);
      assert.equal((await p('2')).status, 201);
      const res = await p('3');
      assert.equal(res.status, 429);
      assert.equal(res.json.error, 'cooldown');
      assert.equal(res.json.retryAfter, 60);
    } finally {
      await limited.close();
    }
  });
});

describe('GET /api/chat', () => {
  async function seed(n) {
    const ids = [];
    for (let i = 1; i <= n; i++) {
      const clientId = newClientId();
      const res = await post(clientId, { name: `U${i}`, body: `msg ${i}` });
      assert.equal(res.status, 201);
      ids.push({ clientId, id: res.json.message.id });
    }
    return ids;
  }

  test('returns an empty list initially', async () => {
    const res = await srv.request('GET', '/api/chat');
    assert.deepEqual([res.status, res.json], [200, { messages: [], total: 0 }]);
  });

  test('returns the latest 50 ascending, with total', async () => {
    await seed(60);
    const res = await srv.request('GET', '/api/chat');
    assert.equal(res.status, 200);
    assert.equal(res.json.total, 60);
    assert.equal(res.json.messages.length, 50);
    assert.deepEqual(
      res.json.messages.map((m) => m.body),
      Array.from({ length: 50 }, (_, i) => `msg ${i + 11}`),
    );
  });

  test('?after returns only newer messages; invalid after is ignored', async () => {
    const seeded = await seed(5);
    const res = await srv.request('GET', `/api/chat?after=${seeded[2].id}`);
    assert.deepEqual(res.json.messages.map((m) => m.body), ['msg 4', 'msg 5']);
    assert.equal(res.json.total, 5);
    const none = await srv.request('GET', `/api/chat?after=${seeded[4].id}`);
    assert.deepEqual(none.json.messages, []);
    const bad = await srv.request('GET', '/api/chat?after=abc');
    assert.equal(bad.json.messages.length, 5);
  });

  test('mine is computed per request and no client ids or hashes leak', async () => {
    const [a, b] = await seed(2);
    const asA = await srv.request('GET', '/api/chat', { clientId: a.clientId });
    assert.deepEqual(asA.json.messages.map((m) => m.mine), [true, false]);
    const asB = await srv.request('GET', '/api/chat', { clientId: b.clientId });
    assert.deepEqual(asB.json.messages.map((m) => m.mine), [false, true]);
    const anon = await srv.request('GET', '/api/chat');
    assert.deepEqual(anon.json.messages.map((m) => m.mine), [false, false]);
    for (const m of anon.json.messages) assert.deepEqual(Object.keys(m).sort(), MESSAGE_KEYS);
    const raw = JSON.stringify(asA.json);
    assert.ok(!raw.includes(a.clientId) && !raw.includes(b.clientId));
    const hashes = srv.db.prepare('SELECT client_hash FROM messages').all().map((r) => r.client_hash);
    for (const h of hashes) assert.ok(!raw.includes(h));
  });

  test('keeps only the latest 200 messages', async () => {
    await seed(205);
    const count = srv.db.prepare('SELECT COUNT(*) AS n, MIN(body) AS any FROM messages').get();
    assert.equal(count.n, 200);
    const res = await srv.request('GET', '/api/chat?after=0');
    assert.equal(res.json.total, 200);
    assert.equal(res.json.messages[0].body, 'msg 6');
    assert.equal(res.json.messages.at(-1).body, 'msg 205');
  });
});

describe('PATCH /api/chat/:id', () => {
  test('edits your own message and sets editedAt', async () => {
    const id = newClientId();
    const created = (await post(id, { name: 'Sam', body: 'first' })).json.message;
    srv.clock.advance(5_000);
    const res = await srv.request('PATCH', `/api/chat/${created.id}`, { clientId: id, body: { body: ' second ' } });
    assert.equal(res.status, 200);
    assert.equal(res.json.message.body, 'second');
    assert.equal(res.json.message.editedAt, new Date(srv.clock()).toISOString());
    assert.equal(res.json.message.createdAt, created.createdAt);
    assert.equal(res.json.message.mine, true);
    assert.deepEqual(Object.keys(res.json.message).sort(), MESSAGE_KEYS);
    // Edits are not subject to the post cooldown.
    const again = await srv.request('PATCH', `/api/chat/${created.id}`, { clientId: id, body: { body: 'third' } });
    assert.equal(again.status, 200);
  });

  test('403 forbidden for someone else’s message', async () => {
    const created = (await post(newClientId(), { name: 'Sam', body: 'mine' })).json.message;
    const res = await srv.request('PATCH', `/api/chat/${created.id}`, {
      clientId: newClientId(),
      body: { body: 'hijack' },
    });
    assert.deepEqual([res.status, res.json], [403, { error: 'forbidden' }]);
  });

  test('404 not_found for unknown or malformed ids', async () => {
    for (const path of ['/api/chat/999', '/api/chat/abc', '/api/chat/0', '/api/chat/-1']) {
      const res = await srv.request('PATCH', path, { clientId: newClientId(), body: { body: 'x' } });
      assert.deepEqual([res.status, res.json], [404, { error: 'not_found' }], path);
    }
  });

  test('400 validation codes and no_client', async () => {
    const id = newClientId();
    const created = (await post(id, { name: 'Sam', body: 'ok' })).json.message;
    const path = `/api/chat/${created.id}`;
    const cases = [
      [{ body: '' }, 'empty'],
      [{ body: 'y'.repeat(281) }, 'too_long'],
      [{ body: 'see example.com' }, 'link'],
      [{ body: 'fuck' }, 'offensive'],
    ];
    for (const [body, code] of cases) {
      const res = await srv.request('PATCH', path, { clientId: id, body });
      assert.deepEqual([res.status, res.json], [400, { error: code }]);
    }
    const noClient = await srv.request('PATCH', path, { body: { body: 'x' } });
    assert.deepEqual([noClient.status, noClient.json], [400, { error: 'no_client' }]);
  });
});

describe('DELETE /api/chat/:id', () => {
  test('deletes your own message (204)', async () => {
    const id = newClientId();
    const created = (await post(id, { name: 'Sam', body: 'bye' })).json.message;
    const res = await srv.request('DELETE', `/api/chat/${created.id}`, { clientId: id });
    assert.equal(res.status, 204);
    assert.equal(res.json, null);
    const list = await srv.request('GET', '/api/chat');
    assert.deepEqual(list.json, { messages: [], total: 0 });
    const gone = await srv.request('DELETE', `/api/chat/${created.id}`, { clientId: id });
    assert.deepEqual([gone.status, gone.json], [404, { error: 'not_found' }]);
  });

  test('403 forbidden for other clients or no client', async () => {
    const created = (await post(newClientId(), { name: 'Sam', body: 'stay' })).json.message;
    const other = await srv.request('DELETE', `/api/chat/${created.id}`, { clientId: newClientId() });
    assert.deepEqual([other.status, other.json], [403, { error: 'forbidden' }]);
    const anon = await srv.request('DELETE', `/api/chat/${created.id}`);
    assert.deepEqual([anon.status, anon.json], [403, { error: 'forbidden' }]);
  });

  test('404 not_found for unknown ids', async () => {
    const res = await srv.request('DELETE', '/api/chat/424242', { clientId: newClientId() });
    assert.deepEqual([res.status, res.json], [404, { error: 'not_found' }]);
  });
});

describe('GET /api/chat/identity', () => {
  test('returns null without a client or before posting', async () => {
    assert.deepEqual((await srv.request('GET', '/api/chat/identity')).json, { name: null });
    const fresh = await srv.request('GET', '/api/chat/identity', { clientId: newClientId() });
    assert.deepEqual([fresh.status, fresh.json], [200, { name: null }]);
  });

  test('returns the last name this client used', async () => {
    const id = newClientId();
    await post(id, { name: 'Sam', body: 'one' });
    assert.deepEqual((await srv.request('GET', '/api/chat/identity', { clientId: id })).json, { name: 'Sam' });
    srv.clock.advance(16_000);
    await post(id, { name: 'Samantha', body: 'two' });
    assert.deepEqual((await srv.request('GET', '/api/chat/identity', { clientId: id })).json, { name: 'Samantha' });
    // Other clients don't see it.
    const other = await srv.request('GET', '/api/chat/identity', { clientId: newClientId() });
    assert.deepEqual(other.json, { name: null });
  });
});

describe('privacy', () => {
  test('stores neither IP addresses nor raw client ids', async () => {
    const id = newClientId();
    await post(id, { name: 'Sam', body: 'hello' }, { 'User-Agent': DESKTOP_UA });
    const tables = srv.db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'")
      .all()
      .map((r) => r.name);
    const dump = JSON.stringify(tables.map((t) => srv.db.prepare(`SELECT * FROM "${t}"`).all()));
    assert.ok(!dump.includes(id), 'raw client id stored');
    assert.ok(!dump.includes('127.0.0.1'), 'IP stored');
    assert.ok(!dump.includes('Windows NT'), 'user agent stored');
    const columns = tables.flatMap((t) => srv.db.prepare(`PRAGMA table_info("${t}")`).all().map((c) => c.name));
    assert.ok(!columns.some((c) => /ip|addr|city|country|geo|lat|lon|location|agent/i.test(c)), columns.join());
  });
});
