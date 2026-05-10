import crypto from 'node:crypto';

// The frontend sends crypto.randomUUID(). Any other random-looking id of 16-64 letters, digits,
// "-" or "_" (with at least 16 letters/digits) is accepted too, so a slightly different client
// id format never locks a visitor out with no_client.
const CLIENT_ID_RE = /^[0-9a-z_-]{16,64}$/;

export function normaliseClientId(rawId) {
  if (typeof rawId !== 'string') return null;
  const id = rawId.trim().toLowerCase();
  if (!CLIENT_ID_RE.test(id)) return null;
  if (id.replace(/[-_]/g, '').length < 16) return null;
  return id;
}

/**
 * Turns the X-Client-Id header (a random id the browser keeps in localStorage) into a
 * salted, non-reversible HMAC-SHA256 hex digest. The raw id is never stored or returned.
 */
export function createIdentity(salt) {
  return {
    hash(rawId) {
      const id = normaliseClientId(rawId);
      if (!id) return null;
      return crypto.createHmac('sha256', salt).update(id).digest('hex');
    },
    fromRequest(req) {
      return this.hash(req.get('x-client-id'));
    },
  };
}

/** Stable public avatar seed derived from the (already salted) client hash. */
export function avatarSeed(clientHash) {
  return crypto.createHash('sha256').update(`avatar:${clientHash}`).digest('hex').slice(0, 16);
}
