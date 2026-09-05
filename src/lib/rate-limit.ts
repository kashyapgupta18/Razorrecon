export interface RateLimiterOptions {
  windowMs: number;
  max: number;
}

export function rateLimit(options: RateLimiterOptions) {
  const tokenCache = new Map<string, { count: number; expiresAt: number }>();

  return {
    check: (limit: number, token: string) => {
      const now = Date.now();
      const record = tokenCache.get(token);

      if (!record || record.expiresAt < now) {
        tokenCache.set(token, { count: 1, expiresAt: now + options.windowMs });
        return { success: true, remaining: limit - 1 };
      }

      if (record.count >= limit) {
        return { success: false, remaining: 0 };
      }

      record.count += 1;
      tokenCache.set(token, record);
      return { success: true, remaining: limit - record.count };
    },
    // Cleanup interval can be run periodically if we have thousands of keys, 
    // but a Map will GC keys when memory grows if we clear it periodically.
    clear: () => tokenCache.clear(),
  };
}
