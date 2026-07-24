// ============================================================
// Rate Limiter — Sliding window per-engine rate limiting
// ============================================================

export interface RateLimiterConfig {
  /** Max requests within the time window (default: 10) */
  maxRequests: number;
  /** Time window in milliseconds (default: 60000 = 1 minute) */
  windowMs: number;
}

interface RequestRecord {
  timestamps: number[];
}

/**
 * Per-engine sliding window rate limiter.
 * Tracks request timestamps and blocks when limit is exceeded.
 */
export class RateLimiter {
  private config: RateLimiterConfig;
  private engines: Map<string, RequestRecord> = new Map();

  constructor(config?: Partial<RateLimiterConfig>) {
    this.config = {
      maxRequests: config?.maxRequests ?? 10,
      windowMs: config?.windowMs ?? 60_000,
    };
  }

  /**
   * Check if a request to the given engine is allowed.
   * If allowed, the request is automatically recorded.
   */
  allow(engineName: string): boolean {
    const now = Date.now();
    const record = this.getOrCreate(engineName);

    // Remove timestamps outside the window
    record.timestamps = record.timestamps.filter(
      (t) => now - t < this.config.windowMs
    );

    if (record.timestamps.length >= this.config.maxRequests) {
      return false;
    }

    record.timestamps.push(now);
    return true;
  }

  /**
   * Return the number of milliseconds until the next request is allowed.
   * Returns 0 if a request is allowed now.
   */
  waitTimeMs(engineName: string): number {
    const now = Date.now();
    const record = this.getOrCreate(engineName);

    // Remove timestamps outside the window
    record.timestamps = record.timestamps.filter(
      (t) => now - t < this.config.windowMs
    );

    if (record.timestamps.length < this.config.maxRequests) {
      return 0;
    }

    // Wait until the oldest request in the window expires
    const oldest = record.timestamps[0];
    return Math.max(0, oldest + this.config.windowMs - now);
  }

  /**
   * Manually record a request (useful when calling external APIs).
   */
  record(engineName: string): void {
    const record = this.getOrCreate(engineName);
    record.timestamps.push(Date.now());
  }

  /**
   * Reset tracking for a specific engine.
   */
  reset(engineName?: string): void {
    if (engineName) {
      this.engines.delete(engineName);
    } else {
      this.engines.clear();
    }
  }

  private getOrCreate(engineName: string): RequestRecord {
    let record = this.engines.get(engineName);
    if (!record) {
      record = { timestamps: [] };
      this.engines.set(engineName, record);
    }
    return record;
  }
}
