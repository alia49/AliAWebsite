import express from 'express';
import { transaction } from './db.js';
import { clientIp, isPlainObject, jsonBody, sendError } from './http.js';
import { charLength, cleanText, containsLink, deviceFromUserAgent, isOffensive } from './moderation.js';
import { createRateLimiter } from './rateLimit.js';

export const CHAT_LIMITS = Object.freeze({
  nameMax: 24,
  bodyMax: 280,
  cooldownMs: 15_000,
  keep: 200, // messages retained
  page: 50, // messages returned by GET /chat without ?after
  identityTtlMs: 180 * 24 * 60 * 60 * 1000, // forget a client's last-used name after 180 days idle
});

/** Returns { value } or { error }. Name: 1-24 chars after trimming, no links, no profanity. */
export function validateName(raw) {
  if (typeof raw !== 'string') return { error: 'bad_name' };
  const value = cleanText(raw);
  const len = charLength(value);
  if (len < 1 || len > CHAT_LIMITS.nameMax) return { error: 'bad_name' };
  if (containsLink(value)) return { error: 'link' };
  if (isOffensive(value)) return { error: 'offensive' };
  return { value };
}

/** Returns { value } or { error }. Body: 1-280 chars after trimming, no links, no profanity. */
export function validateBody(raw) {
  if (typeof raw !== 'string') return { error: 'empty' };
  const value = cleanText(raw, { multiline: true });
  const len = charLength(value);
  if (len < 1) return { error: 'empty' };
  if (len > CHAT_LIMITS.bodyMax) return { error: 'too_long' };
  if (containsLink(value)) return { error: 'link' };
  if (isOffensive(value)) return { error: 'offensive' };
  return { value };
}

function parseId(raw) {
  if (typeof raw !== 'string' || !/^\d{1,15}$/.test(raw)) return null;
  const id = Number(raw);
  return id > 0 ? id : null;
}

function toMessage(row, me) {
  return {
    id: row.id,
    name: row.name,
    body: row.body,
    device: row.device,
    createdAt: row.created_at,
    editedAt: row.edited_at ?? null,
    mine: me !== null && row.client_hash === me,
  };
}

export function createChatRouter({ db, identity, now, ipLimit = { limit: 10, windowMs: 60_000 } }) {
  const router = express.Router();
  const ipLimiter = createRateLimiter({ ...ipLimit, now });
  const parseJson = jsonBody({ limit: '10kb', tooLargeCode: 'too_long' });

  const COLS = 'id, client_hash, name, body, device, created_at, edited_at';
  const q = {
    latest: db.prepare(`SELECT * FROM (SELECT ${COLS} FROM messages ORDER BY id DESC LIMIT ?) ORDER BY id ASC`),
    after: db.prepare(`SELECT ${COLS} FROM messages WHERE id > ? ORDER BY id ASC LIMIT ?`),
    count: db.prepare('SELECT COUNT(*) AS n FROM messages'),
    byId: db.prepare(`SELECT ${COLS} FROM messages WHERE id = ?`),
    insert: db.prepare(
      'INSERT INTO messages (client_hash, name, body, device, created_at) VALUES (?, ?, ?, ?, ?) RETURNING ' + COLS,
    ),
    update: db.prepare(`UPDATE messages SET body = ?, edited_at = ? WHERE id = ? RETURNING ${COLS}`),
    remove: db.prepare('DELETE FROM messages WHERE id = ?'),
    prune: db.prepare('DELETE FROM messages WHERE id NOT IN (SELECT id FROM messages ORDER BY id DESC LIMIT ?)'),
    getIdentity: db.prepare('SELECT name, last_post_at FROM identities WHERE client_hash = ?'),
    upsertIdentity: db.prepare(`
      INSERT INTO identities (client_hash, name, last_post_at, updated_at) VALUES (?, ?, ?, ?)
      ON CONFLICT (client_hash) DO UPDATE SET
        name = excluded.name, last_post_at = excluded.last_post_at, updated_at = excluded.updated_at`),
    pruneIdentities: db.prepare('DELETE FROM identities WHERE updated_at < ?'),
  };

  router.get('/chat', (req, res) => {
    const me = identity.fromRequest(req);
    const afterRaw = req.query.after;
    const after = typeof afterRaw === 'string' && /^\d{1,15}$/.test(afterRaw) ? Number(afterRaw) : null;
    const rows = after === null ? q.latest.all(CHAT_LIMITS.page) : q.after.all(after, CHAT_LIMITS.keep);
    res.json({ messages: rows.map((row) => toMessage(row, me)), total: q.count.get().n });
  });

  router.get('/chat/identity', (req, res) => {
    const me = identity.fromRequest(req);
    const row = me ? q.getIdentity.get(me) : undefined;
    res.json({ name: row?.name ?? null });
  });

  router.post('/chat', parseJson, (req, res) => {
    const me = identity.fromRequest(req);
    if (!me) return sendError(res, 400, 'no_client');

    const input = isPlainObject(req.body) ? req.body : {};
    const name = validateName(input.name);
    if (name.error) return sendError(res, 400, name.error);
    const body = validateBody(input.body);
    if (body.error) return sendError(res, 400, body.error);

    const t = now();
    const previous = q.getIdentity.get(me);
    if (previous && t - previous.last_post_at < CHAT_LIMITS.cooldownMs) {
      const retryAfter = Math.max(1, Math.ceil((previous.last_post_at + CHAT_LIMITS.cooldownMs - t) / 1000));
      return sendError(res, 429, 'cooldown', { retryAfter });
    }
    // Secondary guard against one IP rotating client ids. The IP is used in memory only.
    const perIp = ipLimiter.consume(clientIp(req));
    if (!perIp.ok) return sendError(res, 429, 'cooldown', { retryAfter: perIp.retryAfter });

    const device = deviceFromUserAgent(req.get('user-agent'));
    const row = transaction(db, () => {
      const inserted = q.insert.get(me, name.value, body.value, device, new Date(t).toISOString());
      q.upsertIdentity.run(me, name.value, t, t);
      q.prune.run(CHAT_LIMITS.keep);
      q.pruneIdentities.run(t - CHAT_LIMITS.identityTtlMs);
      return inserted;
    });
    res.status(201).json({ message: toMessage(row, me) });
  });

  router.patch('/chat/:id', parseJson, (req, res) => {
    const me = identity.fromRequest(req);
    if (!me) return sendError(res, 400, 'no_client');
    const id = parseId(req.params.id);
    const existing = id === null ? undefined : q.byId.get(id);
    if (!existing) return sendError(res, 404, 'not_found');
    if (existing.client_hash !== me) return sendError(res, 403, 'forbidden');

    const input = isPlainObject(req.body) ? req.body : {};
    const body = validateBody(input.body);
    if (body.error) return sendError(res, 400, body.error);
    if (body.value === existing.body) return res.json({ message: toMessage(existing, me) });

    const row = q.update.get(body.value, new Date(now()).toISOString(), id);
    res.json({ message: toMessage(row, me) });
  });

  router.delete('/chat/:id', (req, res) => {
    const me = identity.fromRequest(req);
    const id = parseId(req.params.id);
    const existing = id === null ? undefined : q.byId.get(id);
    if (!existing) return sendError(res, 404, 'not_found');
    if (!me || existing.client_hash !== me) return sendError(res, 403, 'forbidden');
    q.remove.run(id);
    res.status(204).end();
  });

  return router;
}
