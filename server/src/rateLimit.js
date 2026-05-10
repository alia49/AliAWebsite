/**
 * In-memory sliding-window rate limiter. Keys (IP addresses) live only in process memory
 * and are dropped once their window has passed; they are never persisted or logged.
 */
export function createRateLimiter({ limit, windowMs, now = Date.now, maxKeys = 50_000 }) {
  const hits = new Map(); // key -> ascending timestamps within the window
  let callsSinceSweep = 0;

  function sweep(t = now()) {
    const cutoff = t - windowMs;
    for (const [key, times] of hits) {
      if (times.length === 0 || times[times.length - 1] <= cutoff) hits.delete(key);
    }
    // Still too many live keys (e.g. a flood of spoofed IPs): drop the oldest-inserted.
    for (const key of hits.keys()) {
      if (hits.size <= maxKeys) break;
      hits.delete(key);
    }
  }

  return {
    /** Records a hit for key. Returns { ok: true } or { ok: false, retryAfter: seconds }. */
    consume(key) {
      const t = now();
      if (++callsSinceSweep >= 1000 || hits.size > maxKeys) {
        callsSinceSweep = 0;
        sweep(t);
      }
      const cutoff = t - windowMs;
      const times = hits.get(key) ?? [];
      while (times.length && times[0] <= cutoff) times.shift();
      if (times.length >= limit) {
        hits.set(key, times);
        return { ok: false, retryAfter: Math.max(1, Math.ceil((times[0] + windowMs - t) / 1000)) };
      }
      times.push(t);
      hits.set(key, times);
      return { ok: true };
    },
    sweep,
    get size() {
      return hits.size;
    },
  };
}
