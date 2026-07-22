/**
 * In-memory Rate Limiter
 * Configurable per plan limits. Returns X-RateLimit-* headers.
 * Will be replaced with Redis-based implementation in production.
 */

const DEFAULT_WINDOW_MS = 60 * 1000; // 1 minute window
const DEFAULT_MAX_REQUESTS = 100;

// In-memory store: Map<userId, { timestamps: number[], planMax: number }>
const requestLogs = new Map();

// Plan rate limits (requests per minute)
const PLAN_LIMITS = {
  free: 60,
  pro: 200,
  enterprise: 1000,
};

// Monthly limits
const PLAN_MONTHLY_LIMITS = {
  free: 1000,
  pro: 50000,
  enterprise: 500000,
};

// Monthly usage tracking
const monthlyUsage = new Map();

function rateLimit(planCode = 'free') {
  const maxRequests = PLAN_LIMITS[planCode] || DEFAULT_MAX_REQUESTS;
  const monthlyMax = PLAN_MONTHLY_LIMITS[planCode] || 1000;

  return (req, res, next) => {
    const userId = req.user ? req.user.id : req.ip || 'anonymous';
    const now = Date.now();

    // --- Minute-level rate limiting ---
    if (!requestLogs.has(userId)) {
      requestLogs.set(userId, []);
    }

    const timestamps = requestLogs.get(userId);
    // Remove timestamps older than the window
    const cutoff = now - DEFAULT_WINDOW_MS;
    while (timestamps.length > 0 && timestamps[0] < cutoff) {
      timestamps.shift();
    }

    if (timestamps.length >= maxRequests) {
      const oldestInWindow = timestamps[0];
      const retryAfter = Math.ceil((oldestInWindow + DEFAULT_WINDOW_MS - now) / 1000);

      res.setHeader('X-RateLimit-Limit', maxRequests);
      res.setHeader('X-RateLimit-Remaining', 0);
      res.setHeader('X-RateLimit-Reset', Math.ceil((oldestInWindow + DEFAULT_WINDOW_MS) / 1000));
      res.setHeader('Retry-After', retryAfter);

      return res.status(429).json({
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: `请求过于频繁。当前限制为每分钟 ${maxRequests} 次，请在 ${retryAfter} 秒后重试。`,
          retryAfter,
        }
      });
    }

    timestamps.push(now);
    requestLogs.set(userId, timestamps);

    // --- Monthly usage tracking ---
    const monthKey = getMonthKey();
    const usageKey = `${userId}:${monthKey}`;
    const currentMonthly = monthlyUsage.get(usageKey) || 0;

    if (currentMonthly >= monthlyMax) {
      return res.status(429).json({
        success: false,
        error: {
          code: 'MONTHLY_LIMIT_EXCEEDED',
          message: `本月API调用次数已达上限 (${monthlyMax})。请升级套餐以获取更多调用额度。`,
        }
      });
    }

    monthlyUsage.set(usageKey, currentMonthly + 1);

    // Set rate limit headers
    res.setHeader('X-RateLimit-Limit', maxRequests);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, maxRequests - timestamps.length));
    res.setHeader('X-RateLimit-Reset', Math.ceil((now + DEFAULT_WINDOW_MS) / 1000));
    res.setHeader('X-RateLimit-Monthly-Limit', monthlyMax);
    res.setHeader('X-RateLimit-Monthly-Remaining', Math.max(0, monthlyMax - currentMonthly - 1));

    next();
  };
}

function getMonthKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// Reset monthly tracking at midnight (simple approach)
const _cleanupTimer = setInterval(() => {
  const now = new Date();
  if (now.getHours() === 0 && now.getMinutes() === 0) {
    monthlyUsage.clear();
    // Also purge stale per-user timestamps older than 2 minutes
    const cutoff = Date.now() - 2 * 60 * 1000;
    for (const [userId, timestamps] of requestLogs) {
      const recent = timestamps.filter(t => t >= cutoff);
      if (recent.length === 0) {
        requestLogs.delete(userId);
      } else {
        requestLogs.set(userId, recent);
      }
    }
  }
}, 60 * 1000);

// Ensure timer does not keep the process alive on shutdown
if (_cleanupTimer.unref) {
  _cleanupTimer.unref();
}

module.exports = { rateLimit, PLAN_LIMITS, PLAN_MONTHLY_LIMITS };
