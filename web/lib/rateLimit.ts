// Lightweight in-memory sliding-window rate limiter.
// Keyed by `${action}:${userId}`. Catches rapid floods within a warm instance.
// (For multi-instance guarantees you'd move this to the DB/Redis, but this
// stops the common single-user spam case cheaply.)

const store = new Map<string, number[]>();
let lastSweep = 0;

export function rateLimit(key: string, limit: number, windowMs: number): { ok: boolean; retryAfter: number } {
  const now = Date.now();

  // Occasional cleanup so the map can't grow unbounded.
  if (now - lastSweep > 120000) {
    lastSweep = now;
    for (const [k, arr] of store) {
      if (!arr.length || now - arr[arr.length - 1] > 600000) store.delete(k);
    }
  }

  const arr = store.get(key) || [];
  const recent = arr.filter((t) => now - t < windowMs);
  if (recent.length >= limit) {
    const retryAfter = Math.max(1, Math.ceil((windowMs - (now - recent[0])) / 1000));
    store.set(key, recent);
    return { ok: false, retryAfter };
  }
  recent.push(now);
  store.set(key, recent);
  return { ok: true, retryAfter: 0 };
}

// Convenience wrapper: rate-limit an action for a user.
export function limited(userId: string, action: string, limit: number, windowMs: number) {
  return rateLimit(`${action}:${userId}`, limit, windowMs);
}
