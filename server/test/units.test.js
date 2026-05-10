import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, test } from 'node:test';
import { supportsDefaultFallbacks, supportsEffort } from '../src/ask.js';
import { SERVER_ROOT, loadConfig } from '../src/config.js';
import { openDatabase, resolveSalt } from '../src/db.js';
import { createIdentity } from '../src/identity.js';
import { cleanText, containsLink, deviceFromUserAgent, isOffensive } from '../src/moderation.js';
import { buildSystemPrompt, createProfileSource } from '../src/profile.js';
import { createRateLimiter } from '../src/rateLimit.js';
import { SAMPLE_PROFILE, fakeClock } from './helpers.js';
import { silentLogger } from '../src/app.js';

function tmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'websitedemo-server-test-'));
}

describe('config', () => {
  test('defaults', () => {
    const c = loadConfig({});
    assert.equal(c.port, 8787);
    assert.deepEqual(c.allowedOrigins, ['http://localhost:3000', 'https://alia49.github.io']);
    assert.equal(c.dbPath, path.join(SERVER_ROOT, 'data', 'site.db'));
    assert.equal(c.profilePath, path.resolve(SERVER_ROOT, '..', 'src', 'content', 'profile.json'));
    assert.equal(c.trustProxy, false);
    assert.equal(c.clientIdSalt, null);
    assert.equal(c.anthropicApiKey, null);
    assert.equal(c.anthropicModel, 'claude-opus-5');
    assert.equal(c.askDailyLimit, 300);
  });

  test('parses overrides', () => {
    const c = loadConfig({
      PORT: '9000',
      ALLOWED_ORIGINS: ' https://a.test/ ,https://b.test ',
      DB_PATH: '/tmp/x.db',
      TRUST_PROXY: '1',
      CLIENT_ID_SALT: 'pepper',
      PROFILE_PATH: 'profile.json',
      ANTHROPIC_API_KEY: ' sk-test ',
      ANTHROPIC_MODEL: 'claude-sonnet-5',
      ASK_DAILY_LIMIT: '50',
    });
    assert.equal(c.port, 9000);
    assert.deepEqual(c.allowedOrigins, ['https://a.test', 'https://b.test']);
    assert.equal(c.dbPath, '/tmp/x.db');
    assert.equal(c.trustProxy, 1);
    assert.equal(c.clientIdSalt, 'pepper');
    assert.equal(c.profilePath, path.join(SERVER_ROOT, 'profile.json'));
    assert.equal(c.anthropicApiKey, 'sk-test');
    assert.equal(c.anthropicModel, 'claude-sonnet-5');
    assert.equal(c.askDailyLimit, 50);
    assert.equal(loadConfig({ TRUST_PROXY: 'true' }).trustProxy, true);
    assert.equal(loadConfig({ TRUST_PROXY: 'loopback' }).trustProxy, 'loopback');
  });

  test('rejects invalid numbers', () => {
    assert.throws(() => loadConfig({ PORT: 'abc' }), /PORT/);
    assert.throws(() => loadConfig({ PORT: '70000' }), /PORT/);
    assert.throws(() => loadConfig({ ASK_DAILY_LIMIT: '-1' }), /ASK_DAILY_LIMIT/);
  });
});

describe('database and identity', () => {
  test('creates the database file (and folders) automatically', () => {
    const dir = tmpDir();
    const file = path.join(dir, 'nested', 'deeper', 'site.db');
    const db = openDatabase(file);
    db.close();
    assert.ok(fs.existsSync(file));
    fs.rmSync(dir, { recursive: true, force: true });
  });

  test('generates the salt once and persists it; CLIENT_ID_SALT wins', () => {
    const dir = tmpDir();
    const file = path.join(dir, 'site.db');
    let db = openDatabase(file);
    const salt = resolveSalt(db, null);
    assert.match(salt, /^[0-9a-f]{64}$/);
    db.close();
    db = openDatabase(file);
    assert.equal(resolveSalt(db, null), salt);
    assert.equal(resolveSalt(db, 'from-env'), 'from-env');
    db.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  test('client ids hash deterministically per salt and are case-insensitive', () => {
    const id = '0f8fad5b-d9cb-469f-a165-70867728950e';
    const a = createIdentity('s1');
    const b = createIdentity('s2');
    assert.match(a.hash(id), /^[0-9a-f]{64}$/);
    assert.equal(a.hash(id), a.hash(id.toUpperCase()));
    assert.notEqual(a.hash(id), b.hash(id));
    assert.equal(a.hash('nope'), null);
    assert.equal(a.hash(undefined), null);
    assert.equal(a.hash('-'.repeat(20)), null);
    assert.equal(a.hash('abc-def'), null);
    assert.equal(a.hash('x'.repeat(65)), null);
    assert.equal(a.hash('has spaces in it here!!'), null);
    // Non-UUID but random-looking ids (16-64 chars) are accepted.
    assert.match(a.hash('0123456789abcdef0123'), /^[0-9a-f]{64}$/);
    assert.match(a.hash('Vx3_k9-Qm2Lp8Rt4Yz1Wc'), /^[0-9a-f]{64}$/);
  });
});

describe('moderation', () => {
  test('cleanText trims, strips control/bidi characters and collapses blank lines', () => {
    assert.equal(cleanText('  a‮b\u0000c  '), 'abc');
    assert.equal(cleanText('a \n\n b'), 'a b');
    assert.equal(cleanText('a\r\n\r\n\r\n\r\nb', { multiline: true }), 'a\n\nb');
    assert.equal(cleanText('👨‍👩‍👧 family'), '👨‍👩‍👧 family'); // keeps ZWJ emoji
  });

  test('link detection', () => {
    for (const s of ['http://x.y', 'HTTPS://A.B', 'ftp://files', 'www.site', 'site.com', 'a.b.io/x', 'bit.ly/abc', 'ｅｘａｍｐｌｅ．ｃｏｍ', 'x (dot) com', 'mailto:me']) {
      assert.ok(containsLink(s), s);
    }
    for (const s of ['hello world', 'node.js rocks', 'e.g. this', 'i.e. that', 'v1.2.3', 'good job.It works', 'costs $3.50']) {
      assert.ok(!containsLink(s), s);
    }
  });

  test('profanity detection with leetspeak, repeats and spacing; avoids common false positives', () => {
    for (const s of ['FUCK', 'fück', 'sh!t', 'b!tch', '$lut', 's1ut', 'a55hole', 'f.u.c.k', 'f u c k', 'motherfucker', 'dumb ass']) {
      assert.ok(isOffensive(s), s);
    }
    for (const s of ['class', 'assess', 'Scunthorpe', 'passion', 'cocktail', 'grape', 'Dickens', 'hello', 'shiitake', 'fire retardant']) {
      assert.ok(!isOffensive(s), s);
    }
  });

  test('device from user agent', () => {
    assert.equal(deviceFromUserAgent(undefined), 'unknown');
    assert.equal(deviceFromUserAgent(''), 'unknown');
    assert.equal(deviceFromUserAgent('Mozilla/5.0 (Linux; Android 14; Pixel 8) Mobile Safari/537.36'), 'mobile');
    assert.equal(deviceFromUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) Safari/605.1.15'), 'desktop');
    assert.equal(deviceFromUserAgent('Mozilla/5.0 (compatible; Googlebot/2.1)'), 'unknown');
    assert.equal(deviceFromUserAgent('node'), 'unknown');
  });
});

describe('rate limiter', () => {
  test('sliding window with retryAfter', () => {
    const now = fakeClock(0);
    const rl = createRateLimiter({ limit: 2, windowMs: 10_000, now });
    assert.ok(rl.consume('a').ok);
    now.advance(4_000);
    assert.ok(rl.consume('a').ok);
    assert.deepEqual(rl.consume('a'), { ok: false, retryAfter: 6 });
    assert.ok(rl.consume('b').ok);
    now.advance(6_000);
    assert.ok(rl.consume('a').ok);
  });

  test('sweeps expired keys and bounds memory', () => {
    const now = fakeClock(0);
    const rl = createRateLimiter({ limit: 1, windowMs: 1_000, now, maxKeys: 10 });
    for (let i = 0; i < 50; i++) rl.consume(`k${i}`);
    assert.ok(rl.size <= 11);
    now.advance(2_000);
    rl.sweep();
    assert.equal(rl.size, 0);
  });
});

describe('ask model capabilities', () => {
  test('effort and fallback support by model id', () => {
    for (const m of ['claude-opus-5', 'claude-sonnet-5', 'claude-opus-4-8', 'claude-fable-5-1', 'claude-sonnet-4-6']) {
      assert.ok(supportsEffort(m), m);
    }
    for (const m of ['claude-haiku-4-5', 'claude-sonnet-4-5', 'claude-sonnet-4-20250514', 'claude-3-5-haiku-latest']) {
      assert.ok(!supportsEffort(m), m);
    }
    assert.ok(supportsDefaultFallbacks('claude-opus-5'));
    assert.ok(!supportsDefaultFallbacks('claude-haiku-4-5'));
  });
});

describe('profile source', () => {
  test('missing → null; invalid JSON → null; valid → prompt; reloads on change', () => {
    const dir = tmpDir();
    const file = path.join(dir, 'profile.json');
    const source = createProfileSource({ path: file, logger: silentLogger });
    assert.equal(source.get(), null);

    fs.writeFileSync(file, '{ not json');
    assert.equal(source.get(), null);

    fs.writeFileSync(file, JSON.stringify(SAMPLE_PROFILE));
    const loaded = source.get();
    assert.equal(loaded.profile.name, 'Ali Altimimi');
    assert.match(loaded.systemPrompt, /Ali Altimimi/);
    assert.equal(source.get(), loaded, 'cached while unchanged');

    fs.writeFileSync(file, JSON.stringify({ ...SAMPLE_PROFILE, name: 'Ali A. Altimimi', bio: 'Updated bio text.' }));
    assert.match(source.get().systemPrompt, /Updated bio text\./);

    fs.rmSync(dir, { recursive: true, force: true });
  });

  test('prompt includes optional about/focusAreas/contactIntro; pronouns and now line; never a phone number', () => {
    const extra = {
      ...SAMPLE_PROFILE,
      about: 'I like fast systems.',
      focusAreas: [{ title: 'Back-End', body: 'APIs and queues.' }],
      contactIntro: 'Open to new roles.',
    };
    const hidden = buildSystemPrompt(extra);
    assert.match(hidden, /About \(in Ali's own words\)\nI like fast systems\./);
    assert.match(hidden, /- Back-End: APIs and queues\./);
    assert.match(hidden, /Open to new roles\./);
    assert.ok(!hidden.includes('555 0100'));
    assert.ok(!buildSystemPrompt({ ...extra, showPhone: true }).includes('555 0100'));
    const withNow = buildSystemPrompt({ ...extra, pronouns: 'he/him', now: 'Looking for new-grad roles' });
    assert.match(withNow, /Pronouns: he\/him/);
    assert.match(withNow, /Currently: Looking for new-grad roles/);
  });

  test('prompt tolerates sparse profiles and omits empty sections', () => {
    const prompt = buildSystemPrompt({ name: 'Solo' });
    assert.match(prompt, /Name: Solo/);
    assert.ok(!prompt.includes('## Projects'));
    assert.match(prompt, /contacting Solo through this website/);
  });
});
