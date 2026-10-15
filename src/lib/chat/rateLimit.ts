// Best-effort in-memory limiter. On serverless each instance keeps its own counters,
// so this only blunts casual abuse; swap for Upstash/Vercel KV for a hard limit.
const hits = new Map<string, number[]>();

export function isRateLimited(key: string, max = 15, windowMs = 60_000): boolean {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= max) {
    hits.set(key, recent);
    return true;
  }
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 5000) {
    for (const [k, v] of hits) if (v.every((t) => now - t >= windowMs)) hits.delete(k);
  }
  return false;
}
