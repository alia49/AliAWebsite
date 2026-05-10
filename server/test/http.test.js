import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { mockAnthropic, newClientId, startServer } from './helpers.js';

describe('GET /api/health', () => {
  test('reports ask=false without an Anthropic client', async () => {
    const srv = await startServer();
    try {
      const res = await srv.request('GET', '/api/health');
      assert.equal(res.status, 200);
      assert.deepEqual(res.json, { ok: true, features: { chat: true, presence: true, ask: false } });
    } finally {
      await srv.close();
    }
  });

  test('reports ask=true with a client and a usable profile', async () => {
    const srv = await startServer({ anthropic: mockAnthropic() });
    try {
      const res = await srv.request('GET', '/api/health');
      assert.deepEqual(res.json, { ok: true, features: { chat: true, presence: true, ask: true } });
    } finally {
      await srv.close();
    }
  });

  test('reports ask=false when the profile is missing, even with a key', async () => {
    const srv = await startServer({ anthropic: mockAnthropic(), profile: null });
    try {
      const res = await srv.request('GET', '/api/health');
      assert.equal(res.json.features.ask, false);
    } finally {
      await srv.close();
    }
  });
});

describe('HTTP basics', () => {
  let srv;
  before(async () => {
    srv = await startServer();
  });
  after(async () => {
    await srv.close();
  });

  test('unknown routes return JSON 404 not_found', async () => {
    for (const [method, path] of [
      ['GET', '/'],
      ['GET', '/api/nope'],
      ['PUT', '/api/chat'],
      ['GET', '/api/chat/1'],
    ]) {
      const res = await srv.request(method, path);
      assert.equal(res.status, 404, `${method} ${path}`);
      assert.deepEqual(res.json, { error: 'not_found' });
    }
  });

  test('malformed JSON returns 400 bad_json', async () => {
    const res = await srv.request('POST', '/api/chat', {
      raw: '{"name": "x", ',
      clientId: newClientId(),
      headers: { 'Content-Type': 'application/json' },
    });
    assert.equal(res.status, 400);
    assert.deepEqual(res.json, { error: 'bad_json' });
  });

  test('sets security headers and hides x-powered-by', async () => {
    const res = await srv.request('GET', '/api/health');
    assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(res.headers.get('x-frame-options'), 'DENY');
    assert.equal(res.headers.get('referrer-policy'), 'no-referrer');
    assert.match(res.headers.get('content-security-policy'), /default-src 'none'/);
    assert.equal(res.headers.get('cache-control'), 'no-store');
    assert.equal(res.headers.get('x-powered-by'), null);
    assert.match(res.headers.get('content-type'), /application\/json/);
  });
});

describe('CORS', () => {
  let srv;
  before(async () => {
    srv = await startServer();
  });
  after(async () => {
    await srv.close();
  });

  const preflight = (origin, method = 'POST') =>
    srv.request('OPTIONS', '/api/chat', {
      headers: {
        Origin: origin,
        'Access-Control-Request-Method': method,
        'Access-Control-Request-Headers': 'content-type,x-client-id',
      },
    });

  test('answers preflight for allowed origins (both defaults)', async () => {
    for (const origin of ['http://localhost:3000', 'https://alia49.github.io']) {
      const res = await preflight(origin, 'PATCH');
      assert.equal(res.status, 204);
      assert.equal(res.headers.get('access-control-allow-origin'), origin);
      assert.equal(res.headers.get('access-control-allow-methods'), 'GET, POST, PATCH, DELETE');
      assert.equal(res.headers.get('access-control-allow-headers'), 'Content-Type, X-Client-Id');
      assert.match(res.headers.get('vary'), /Origin/);
    }
  });

  test('rejects preflight from other origins without CORS headers', async () => {
    const res = await preflight('https://evil.example');
    assert.equal(res.status, 403);
    assert.deepEqual(res.json, { error: 'origin_not_allowed' });
    assert.equal(res.headers.get('access-control-allow-origin'), null);
  });

  test('echoes allowed origin on simple requests, including errors', async () => {
    const ok = await srv.request('GET', '/api/chat', { headers: { Origin: 'https://alia49.github.io' } });
    assert.equal(ok.headers.get('access-control-allow-origin'), 'https://alia49.github.io');
    assert.equal(ok.headers.get('access-control-expose-headers'), 'Retry-After');
    const err = await srv.request('POST', '/api/presence', { headers: { Origin: 'http://localhost:3000' } });
    assert.equal(err.status, 400);
    assert.equal(err.headers.get('access-control-allow-origin'), 'http://localhost:3000');
  });

  test('omits CORS headers for disallowed origins', async () => {
    const res = await srv.request('GET', '/api/chat', { headers: { Origin: 'https://evil.example' } });
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('access-control-allow-origin'), null);
  });

  test('ALLOWED_ORIGINS overrides the defaults; "*" allows any origin', async () => {
    const custom = await startServer({ env: { ALLOWED_ORIGINS: 'https://example.com/, https://b.test' } });
    try {
      const allowed = await custom.request('GET', '/api/health', { headers: { Origin: 'https://example.com' } });
      assert.equal(allowed.headers.get('access-control-allow-origin'), 'https://example.com');
      const old = await custom.request('GET', '/api/health', { headers: { Origin: 'http://localhost:3000' } });
      assert.equal(old.headers.get('access-control-allow-origin'), null);
    } finally {
      await custom.close();
    }
    const any = await startServer({ env: { ALLOWED_ORIGINS: '*' } });
    try {
      const res = await any.request('GET', '/api/health', { headers: { Origin: 'https://anything.test' } });
      assert.equal(res.headers.get('access-control-allow-origin'), 'https://anything.test');
    } finally {
      await any.close();
    }
  });
});
