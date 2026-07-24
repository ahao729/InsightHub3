import { describe, it, expect, vi } from 'vitest';
import { withRetry, withRetryThrow } from '../src/retry.js';

describe('withRetry', () => {
  it('returns ok result on first success', async () => {
    const fn = vi.fn(async () => 'success');
    const result = await withRetry(fn, { maxAttempts: 3, baseDelayMs: 1 });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe('success');
    }
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries on failure and returns ok on eventual success', async () => {
    let callCount = 0;
    const fn = vi.fn(async () => {
      callCount++;
      if (callCount < 3) throw new Error('fail');
      return 'recovered';
    });

    const result = await withRetry(fn, { maxAttempts: 3, baseDelayMs: 1 });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe('recovered');
    }
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('returns error after all attempts exhausted', async () => {
    const fn = vi.fn(async () => {
      throw new Error('always fail');
    });

    const result = await withRetry(fn, { maxAttempts: 2, baseDelayMs: 1 });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toBe('always fail');
      expect(result.attempts).toBe(2);
    }
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('stops retrying when retryOn returns false', async () => {
    const fn = vi.fn(async () => {
      throw new Error('fatal error');
    });

    const result = await withRetry(fn, {
      maxAttempts: 5,
      baseDelayMs: 1,
      retryOn: (err) => !err.message.includes('fatal'),
    });

    expect(result.ok).toBe(false);
    // Should stop immediately, not try all 5
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries when retryOn returns true', async () => {
    let callCount = 0;
    const fn = vi.fn(async () => {
      callCount++;
      if (callCount < 3) throw new Error('timeout connection reset');
      return 'ok';
    });

    const result = await withRetry(fn, {
      maxAttempts: 5,
      baseDelayMs: 1,
      retryOn: (err) => {
        const msg = err.message.toLowerCase();
        return msg.includes('timeout') || msg.includes('connection reset');
      },
    });

    expect(result.ok).toBe(true);
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('handles non-Error throws', async () => {
    const fn = vi.fn(async () => {
      throw 'string error';
    });

    const result = await withRetry(fn, { maxAttempts: 1, baseDelayMs: 1 });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toBe('string error');
    }
  });

  it('does not sleep after the last attempt', async () => {
    const fn = vi.fn(async () => {
      throw new Error('fail');
    });

    const start = Date.now();
    await withRetry(fn, { maxAttempts: 2, baseDelayMs: 100 });
    const elapsed = Date.now() - start;

    // Should complete quickly — only 1 sleep between attempt 1 and 2
    // with baseDelayMs=100, sleep is ~100ms + random jitter
    expect(elapsed).toBeLessThan(500);
  });

  it('defaults to 3 max attempts', async () => {
    const fn = vi.fn(async () => {
      throw new Error('fail');
    });

    const result = await withRetry(fn, { baseDelayMs: 1 });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.attempts).toBe(3);
    }
    expect(fn).toHaveBeenCalledTimes(3);
  });
});

describe('withRetryThrow', () => {
  it('returns value on success', async () => {
    const result = await withRetryThrow(async () => 42, { baseDelayMs: 1 });
    expect(result).toBe(42);
  });

  it('throws on final failure', async () => {
    await expect(
      withRetryThrow(async () => { throw new Error('boom'); }, { maxAttempts: 2, baseDelayMs: 1 })
    ).rejects.toThrow('boom');
  });

  it('recovers after retry', async () => {
    let calls = 0;
    const result = await withRetryThrow(async () => {
      calls++;
      if (calls < 2) throw new Error('not yet');
      return 'done';
    }, { maxAttempts: 3, baseDelayMs: 1 });
    expect(result).toBe('done');
  });
});
