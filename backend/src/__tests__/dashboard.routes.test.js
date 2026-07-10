// ── Dashboard Routes Tests ──
// Tests: GET /api/v1/dashboard/stats

/* ── Module-level mocks ── */
const mockQuery = jest.fn();
jest.mock('../db/pool', () => ({ query: (...args) => mockQuery(...args) }));

const mockAuthenticate = jest.fn((req, res, next) => {
  const uid = req.headers['x-test-user-id'];
  if (uid) {
    req.user = {
      id: uid,
      email: req.headers['x-test-email'] || 'test@test.com',
      name: req.headers['x-test-name'] || 'Test User',
    };
    return next();
  }
  return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: '未提供认证信息。' } });
});
jest.mock('../middleware/auth', () => ({
  authenticate: (...args) => mockAuthenticate(...args),
}));

/* ── Imports ── */
const request = require('supertest');
const express = require('express');

function buildApp() {
  const app = express();
  app.use(express.json());
  const dashboardRoutes = require('../routes/dashboard');
  app.use('/api/v1/dashboard', dashboardRoutes);
  return app;
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('GET /api/v1/dashboard/stats', () => {
  test('200 — returns dashboard data from DB with trend', async () => {
    mockQuery.mockImplementation((sql, params) => {
      if (sql.includes('usage_logs') && sql.includes('GROUP BY')) {
        return Promise.resolve({
          rows: [
            { date: new Date('2026-06-01'), calls: 10 },
            { date: new Date('2026-06-02'), calls: 20 },
          ],
        });
      }
      if (sql.includes('usage_logs ul')) {
        return Promise.resolve({
          rows: [
            { api: '/v1/test', status: '200', duration_ms: 100, created_at: '2026-06-14T10:00:00Z', key_name: '生产' },
          ],
        });
      }
      return Promise.resolve({ rows: [] });
    });

    const app = buildApp();
    const res = await request(app)
      .get('/api/v1/dashboard/stats')
      .set('x-test-user-id', 'user-1');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.name).toBe('Test User');
    expect(res.body.data.plan).toBeDefined();
    expect(res.body.data.metrics).toBeDefined();
    expect(res.body.data.trend.labels).toEqual(['06-01', '06-02']);
    expect(res.body.data.trend.values).toEqual([10, 20]);
    // Recent logs from DB
    expect(res.body.data.recentLogs).toHaveLength(1);
    expect(res.body.data.recentLogs[0].api).toBe('/v1/test');
    // Fallback sections still present
    expect(res.body.data.recentReports).toBeDefined();
    expect(res.body.data.monitors).toBeDefined();
    expect(res.body.data.apiKeys).toBeDefined();
  });

  test('200 — DB trend empty, uses fallback trend', async () => {
    mockQuery.mockImplementation((sql) => {
      if (sql.includes('usage_logs ul')) {
        return Promise.resolve({ rows: [] });
      }
      return Promise.resolve({ rows: [] });
    });

    const app = buildApp();
    const res = await request(app)
      .get('/api/v1/dashboard/stats')
      .set('x-test-user-id', 'user-1');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    // Should use fallbackTrend labels/values when DB returns no rows
    expect(res.body.data.trend.labels).toEqual(['6/1', '6/3', '6/5', '6/7', '6/9', '6/11', '6/13']);
    expect(res.body.data.trend.values).toEqual([82, 145, 98, 276, 312, 184, 223]);
    // Recent logs should be fallback
    expect(res.body.data.recentLogs).toHaveLength(10);
  });

  test('200 — DB unavailable, uses full fallback', async () => {
    const dbErr = new Error('ECONNREFUSED');
    dbErr.code = 'ECONNREFUSED';
    mockQuery.mockRejectedValue(dbErr);

    const app = buildApp();
    const res = await request(app)
      .get('/api/v1/dashboard/stats')
      .set('x-test-user-id', 'user-1');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.plan.name).toBe('创业者版');
    expect(res.body.data.metrics.apiCalls).toBe(3284);
    expect(res.body.data.trend.labels).toEqual(['6/1', '6/3', '6/5', '6/7', '6/9', '6/11', '6/13']);
    expect(res.body.data.recentLogs).toHaveLength(10);
    expect(res.body.data.recentReports).toHaveLength(5);
    expect(res.body.data.monitors).toHaveLength(5);
    expect(res.body.data.apiKeys).toHaveLength(2);
  });

  test('401 — unauthenticated', async () => {
    const app = buildApp();
    const res = await request(app).get('/api/v1/dashboard/stats');

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });
});
