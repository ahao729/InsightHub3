// ============================================================
// Retry — Configurable retry with exponential backoff
// ============================================================

export interface RetryConfig {
  /** Max retry attempts (default: 3) */
  maxAttempts: number;
  /** Base delay in ms for exponential backoff (default: 1000) */
  baseDelayMs: number;
  /** Maximum delay in ms (default: 30000) */
  maxDelayMs: number;
  /** Optional predicate: return true to retry on this error */
  retryOn?: (error: Error) => boolean;
}

interface RetryResult<T> {
  ok: true;
  value: T;
}

interface RetryError {
  ok: false;
  error: Error;
  attempts: number;
}

export type RetryOutcome<T> = RetryResult<T> | RetryError;

/**
 * Execute an async function with retry and exponential backoff.
 * Returns a discriminated union instead of throwing on final failure.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  config?: Partial<RetryConfig>
): Promise<RetryOutcome<T>> {
  const maxAttempts = config?.maxAttempts ?? 3;
  const baseDelay = config?.baseDelayMs ?? 1000;
  const maxDelay = config?.maxDelayMs ?? 30_000;
  const retryOn = config?.retryOn;

  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const value = await fn();
      return { ok: true, value };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));

      // If custom retry predicate says don't retry, stop immediately
      if (retryOn && !retryOn(lastError)) {
        break;
      }

      // Don't sleep after the last attempt
      if (attempt < maxAttempts) {
        const delay = Math.min(
          baseDelay * 2 ** (attempt - 1) + Math.random() * baseDelay,
          maxDelay
        );
        await sleep(delay);
      }
    }
  }

  return {
    ok: false,
    error: lastError!,
    attempts: maxAttempts,
  };
}

/**
 * Execute with retry, throwing on final failure (convenience wrapper).
 */
export async function withRetryThrow<T>(
  fn: () => Promise<T>,
  config?: Partial<RetryConfig>
): Promise<T> {
  const result = await withRetry(fn, config);
  if (!result.ok) {
    throw result.error;
  }
  return result.value;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
