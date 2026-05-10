import crypto from 'node:crypto';
import { createApp, silentLogger } from '../src/app.js';
import { loadConfig } from '../src/config.js';
import { openDatabase } from '../src/db.js';
import { staticProfileSource } from '../src/profile.js';

export const SAMPLE_PROFILE = {
  name: 'Ali Altimimi',
  role: 'Software engineer',
  location: 'Michigan, USA',
  email: 'ali@example.test',
  phone: '+1 555 0100 999',
  bio: 'Builds friendly web apps.',
  resume: 'resume.pdf',
  socials: [{ label: 'github', url: 'https://github.com/alia49' }],
  highlights: ['B.S. Computer Science'],
  stats: [{ value: '5+', label: 'projects shipped' }],
  posts: [],
  projects: [
    {
      slug: 'pixel',
      title: 'Pixel Room',
      category: 'Web',
      desc: 'A tiny multiplayer room.',
      bullets: ['Canvas rendering'],
      stack: ['React'],
      image: 'images/projects/pixel.jpg',
      links: { demo: 'https://demo.example.test', repo: '' },
    },
  ],
  experience: [{ year: '2024', role: 'Intern', org: 'Acme', dates: '2024' }],
  education: [{ degree: 'B.S. CS', school: 'State U', date: '2025' }],
  stack: ['JavaScript', 'Node.js'],
  githubUser: 'alia49',
  gaze: { enabled: false, dir: 'images/gaze' },
};

export function newClientId() {
  return crypto.randomUUID();
}

/** A controllable clock. */
export function fakeClock(start = Date.UTC(2026, 0, 15, 12, 0, 0)) {
  let t = start;
  const now = () => t;
  now.advance = (ms) => {
    t += ms;
  };
  now.set = (ms) => {
    t = ms;
  };
  return now;
}

/**
 * A mock Anthropic client recording calls. `respond(params)` may return a response object or
 * throw. Both `messages.create` and `beta.messages.create` are supported.
 */
export function mockAnthropic(respond = defaultResponse) {
  const calls = [];
  const create = (kind) => async (params) => {
    calls.push({ kind, params });
    return respond(params);
  };
  return {
    calls,
    messages: { create: create('messages') },
    beta: { messages: { create: create('beta') } },
  };
}

export function defaultResponse(params) {
  return {
    model: params.model,
    stop_reason: 'end_turn',
    content: [
      { type: 'thinking', thinking: '' },
      { type: 'text', text: 'Ali is a software engineer who builds friendly web apps.' },
    ],
    usage: { input_tokens: 900, output_tokens: 40, cache_read_input_tokens: 800, cache_creation_input_tokens: 0 },
  };
}

/**
 * Starts the app on an ephemeral port with an in-memory database.
 * Options: env (config env vars), anthropic, profile (object | null), db, clock, limits.
 */
export async function startServer(opts = {}) {
  const config = loadConfig({ DB_PATH: ':memory:', ...opts.env });
  const db = opts.db ?? openDatabase(':memory:');
  const clock = opts.clock ?? fakeClock();
  const profileSource =
    opts.profileSource ?? staticProfileSource(opts.profile === undefined ? SAMPLE_PROFILE : opts.profile);
  const app = createApp({
    config,
    db,
    anthropic: opts.anthropic ?? null,
    profileSource,
    now: clock,
    logger: opts.logger ?? silentLogger,
    limits: opts.limits,
  });
  const server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const base = `http://127.0.0.1:${server.address().port}`;

  /** fetch wrapper: request('POST', '/api/chat', { body, clientId, headers, raw }) → { status, headers, json } */
  async function request(method, path, { body, clientId, headers = {}, raw } = {}) {
    const h = { ...headers };
    if (clientId) h['X-Client-Id'] = clientId;
    let payload;
    if (raw !== undefined) payload = raw;
    else if (body !== undefined) {
      payload = JSON.stringify(body);
      h['Content-Type'] ??= 'application/json';
    }
    const res = await fetch(base + path, { method, headers: h, body: payload });
    const text = await res.text();
    let json = null;
    if (text) {
      try {
        json = JSON.parse(text);
      } catch {
        json = text;
      }
    }
    return { status: res.status, headers: res.headers, json };
  }

  async function close() {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    if (!opts.db) db.close();
  }

  return { base, request, close, clock, db, config };
}
