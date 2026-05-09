export function createTtlCache(ttlSeconds) {
  const store = new Map();
  const ttlMs = Math.max(0, ttlSeconds) * 1000;

  return {
    get(key) {
      if (!ttlMs) return undefined;
      const entry = store.get(key);
      if (!entry) return undefined;
      if (Date.now() > entry.expiresAt) {
        store.delete(key);
        return undefined;
      }
      return entry.value;
    },
    set(key, value) {
      if (!ttlMs) return;
      store.set(key, { value, expiresAt: Date.now() + ttlMs });
    }
  };
}
