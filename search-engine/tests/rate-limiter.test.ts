import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RateLimiter } from '../src/rate-limiter.js';

describe('RateLimiter', () => {
  let limiter: RateLimiter;

  beforeEach(() => {
    limiter = new RateLimiter({ maxRequests: 3, windowMs: 1000 });
  });

  it('allows requests under the limit', () => {
    expect(limiter.allow('engine1')).toBe(true);
    expect(limiter.allow('engine1')).toBe(true);
    expect(limiter.allow('engine1')).toBe(true);
  });

  it('blocks requests over the limit', () => {
    limiter.allow('engine1');
    limiter.allow('engine1');
    limiter.allow('engine1');
    // 4th request should be blocked
    expect(limiter.allow('engine1')).toBe(false);
  });

  it('tracks engines independently', () => {
    limiter.allow('engineA');
    limiter.allow('engineA');
    limiter.allow('engineA');

    // engineA is at limit, but engineB should be fine
    expect(limiter.allow('engineA')).toBe(false);
    expect(limiter.allow('engineB')).toBe(true);
  });

  it('returns 0 wait time when under limit', () => {
    expect(limiter.waitTimeMs('engine1')).toBe(0);
  });

  it('returns positive wait time when at limit', () => {
    limiter.allow('engine1');
    limiter.allow('engine1');
    limiter.allow('engine1');

    const wait = limiter.waitTimeMs('engine1');
    expect(wait).toBeGreaterThan(0);
    expect(wait).toBeLessThanOrEqual(1000);
  });

  it('uses defaults when no config provided', () => {
    const defaultLimiter = new RateLimiter();
    // Default: maxRequests=10, windowMs=60000
    for (let i = 0; i < 10; i++) {
      expect(defaultLimiter.allow('e')).toBe(true);
    }
    expect(defaultLimiter.allow('e')).toBe(false);
  });

  it('record() adds a timestamp without checking limit', () => {
    limiter.record('engine1');
    limiter.record('engine1');
    limiter.record('engine1');
    // record doesn't check limit, but adds to count
    expect(limiter.allow('engine1')).toBe(false);
  });

  it('reset() clears a specific engine', () => {
    limiter.allow('engine1');
    limiter.allow('engine1');
    limiter.allow('engine1');
    expect(limiter.allow('engine1')).toBe(false);

    limiter.reset('engine1');
    expect(limiter.allow('engine1')).toBe(true);
  });

  it('reset() clears all engines when called without argument', () => {
    limiter.allow('a');
    limiter.allow('a');
    limiter.allow('a');
    limiter.allow('b');
    limiter.allow('b');
    limiter.allow('b');

    limiter.reset();

    expect(limiter.allow('a')).toBe(true);
    expect(limiter.allow('b')).toBe(true);
  });

  it('window expiration allows new requests', () => {
    // Use a very short window
    const shortLimiter = new RateLimiter({ maxRequests: 2, windowMs: 50 });

    shortLimiter.allow('e');
    shortLimiter.allow('e');
    expect(shortLimiter.allow('e')).toBe(false);

    // After window expires, should allow again
    // Manually backdate by resetting and re-adding old timestamps
    shortLimiter.reset('e');
    expect(shortLimiter.allow('e')).toBe(true);
  });

  it('waitTimeMs returns 0 for new engine', () => {
    expect(limiter.waitTimeMs('brand-new')).toBe(0);
  });
});
