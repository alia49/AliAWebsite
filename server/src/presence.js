import { avatarSeed } from './identity.js';

/**
 * In-memory presence: who has sent a heartbeat within the last `ttlMs`.
 * Keyed by the hashed client id; exposes only a count and derived avatar seeds.
 */
export function createPresence({ now = Date.now, ttlMs = 45_000, maxEntries = 10_000, maxAvatars = 5 } = {}) {
  const entries = new Map(); // clientHash -> { lastSeen, seed }; insertion order = first seen

  function prune() {
    const cutoff = now() - ttlMs;
    for (const [hash, entry] of entries) {
      if (entry.lastSeen <= cutoff) entries.delete(hash);
    }
  }

  function snapshot(selfHash) {
    prune();
    const avatars = [];
    const self = selfHash ? entries.get(selfHash) : undefined;
    if (self) avatars.push(self.seed);
    for (const [hash, entry] of entries) {
      if (avatars.length >= maxAvatars) break;
      if (hash !== selfHash) avatars.push(entry.seed);
    }
    return { count: entries.size, avatars };
  }

  return {
    heartbeat(clientHash) {
      prune();
      const existing = entries.get(clientHash);
      if (existing) existing.lastSeen = now();
      else if (entries.size < maxEntries) {
        entries.set(clientHash, { lastSeen: now(), seed: avatarSeed(clientHash) });
      }
      return snapshot(clientHash);
    },
    snapshot,
    clear() {
      entries.clear();
    },
  };
}
