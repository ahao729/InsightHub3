// ── Dashboard Routes Tests ──
// Tests: GET /stats, POST /monitors, DELETE /monitors/:id, PATCH /monitors/:id

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

/* ══════════════════════════════════════════════
   GET /api/v1/dashboard/stats
   ══════════════════════════════════════════════ */
describe('GET /api/v1/dashboard/stats', () => {
  test('200 — returns dashboard data from DB with trend', async () => {
    mockQuery.mockImplementation((sql) => {
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
            { api: '/v1/test', status: '200', duration_ms: 100, timestamp: '2026-06-14T10:00:00Z', key_name: '生产' },
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
    expect(res.body.data.recentLogs).toHaveLength(1);
    expect(res.body.data.recentReports).toBeDefined();
    expect(res.body.data.monitors).toBeDefined();
    expect(res.body.data.apiKeys).toBeDefined();
  });

  test('200 — DB trend empty, uses fallback trend', async () => {
    mockQuery.mockImplementation(() => Promise.resolve({ rows: [] }));

    const app = buildApp();
    const res = await request(app)
      .get('/api/v1/dashboard/stats')
      .set('x-test-user-id', 'user-1');

    expect(res.status).toBe(200);
    expect(res.body.data.trend.labels).toEqual(['6/1', '6/3', '6/5', '6/7', '6/9', '6/11', '6/13']);
    expect(res.body.data.trend.values).toEqual([82, 145, 98, 276, 312, 184, 223]);
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
    expect(res.body.data.plan.name).toBe('创业者版');
    expect(res.body.data.metrics.apiCalls).toBe(3284);
    expect(res.body.data.trend.labels).toHaveLength(7);
    expect(res.body.data.recentLogs).toHaveLength(10);
    expect(res.body.data.recentReports).toHaveLength(5);
    expect(res.body.data.monitors).toHaveLength(5);
    expect(res.body.data.apiKeys).toHaveLength(2);
  });

  test('401 — unauthenticated', async () => {
    const app = buildApp();
    const res = await request(app).get('/api/v1/dashboard/stats');
    expect(res.status).toBe(401);
  });

  test('200 — DB log rows use fallback when logResult is empty', async () => {
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
    expect(res.body.data.recentLogs).toHaveLength(10); // fallback
  });
});

/* ══════════════════════════════════════════════
   POST /api/v1/dashboard/monitors
   ══════════════════════════════════════════════ */
describe('POST /api/v1/dashboard/monitors', () => {
  test('401 — unauthenticated', async () => {
    const app = buildApp();
    const res = await request(app)
      .post('/api/v1/dashboard/monitors')
      .send({ name: 'Test Monitor', package: 'startup-intel' });
    expect(res.status).toBe(401);
  });

  test('400 — missing name', async () => {
    const app = buildApp();
    const res = await request(app)
      .post('/api/v1/dashboard/monitors')
      .set('x-test-user-id', 'u1')
      .send({ package: 'startup-intel' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  test('400 — missing package', async () => {
    const app = buildApp();
    const res = await request(app)
      .post('/api/v1/dashboard/monitors')
      .set('x-test-user-id', 'u1')
      .send({ name: 'Test Monitor' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  test('201 — creates monitor via DB', async () => {
    mockQuery.mockResolvedValue({
      rows: [{
        id: 'mon-1',
        name: '竞品监控',
        package: 'enterprise-risk',
        frequency: '15min',
        status: 'active',
        created_at: '2026-07-01T00:00:00Z',
        updated_at: '2026-07-01T00:00:00Z',
      }],
    });

    const app = buildApp();
    const res = await request(app)
      .post('/api/v1/dashboard/monitors')
      .set('x-test-user-id', 'u1')
      .send({ name: '竞品监控', package: 'enterprise-risk' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe('mon-1');
    expect(res.body.data.name).toBe('竞品监控');
  });

  test('201 — creates monitor with custom frequency', async () => {
    mockQuery.mockResolvedValue({
      rows: [{
        id: 'mon-2',
        name: '市场趋势',
        package: 'startup-intel',
        frequency: '1h',
        status: 'active',
        created_at: '2026-07-01T00:00:00Z',
        updated_at: '2026-07-01T00:00:00Z',
      }],
    });

    const app = buildApp();
    const res = await request(app)
      .post('/api/v1/dashboard/monitors')
      .set('x-test-user-id', 'u1')
      .send({ name: '市场趋势', package: 'startup-intel', frequency: '1h' });

    expect(res.status).toBe(201);
    expect(res.body.data.frequency).toBe('1h');
  });

  test('201 — fallback: DB unavailable, simulates success', async () => {
    const dbErr = new Error('ECONNREFUSED');
    dbErr.code = 'ECONNREFUSED';
    mockQuery.mockRejectedValue(dbErr);

    const app = buildApp();
    const res = await request(app)
      .post('/api/v1/dashboard/monitors')
      .set('x-test-user-id', 'u1')
      .send({ name: 'Fallback Monitor', package: 'ai-geo' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toMatch(/^mon_/);
    expect(res.body.data.status).toBe('active');
    expect(res.body.data.frequency).toBe('15min'); // default
  });
});

/* ══════════════════════════════════════════════
   DELETE /api/v1/dashboard/monitors/:id
   ══════════════════════════════════════════════ */
describe('DELETE /api/v1/dashboard/monitors/:id', () => {
  test('401 — unauthenticated', async () => {
    const app = buildApp();
    const res = await request(app).delete('/api/v1/dashboard/monitors/mon-1');
    expect(res.status).toBe(401);
  });

  test('200 — deletes monitor via DB', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'mon-1' }] });

    const app = buildApp();
    const res = await request(app)
      .delete('/api/v1/dashboard/monitors/mon-1')
      .set('x-test-user-id', 'u1');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe('mon-1');
  });

  test('404 — monitor not found', async () => {
    mockQuery.mockResolvedValue({ rows: [] });

    const app = buildApp();
    const res = await request(app)
      .delete('/api/v1/dashboard/monitors/mon-999')
      .set('x-test-user-id', 'u1');

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  test('200 — fallback: DB unavailable, simulates success', async () => {
    const dbErr = new Error('ECONNREFUSED');
    dbErr.code = 'ECONNREFUSED';
    mockQuery.mockRejectedValue(dbErr);

    const app = buildApp();
    const res = await request(app)
      .delete('/api/v1/dashboard/monitors/mon-1')
      .set('x-test-user-id', 'u1');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe('mon-1');
  });
});

/* ══════════════════════════════════════════════
   PATCH /api/v1/dashboard/monitors/:id
   ══════════════════════════════════════════════ */
describe('PATCH /api/v1/dashboard/monitors/:id', () => {
  test('401 — unauthenticated', async () => {
    const app = buildApp();
    const res = await request(app)
      .patch('/api/v1/dashboard/monitors/mon-1')
      .send({ status: 'paused' });
    expect(res.status).toBe(401);
  });

  test('400 — invalid status', async () => {
    const app = buildApp();
    const res = await request(app)
      .patch('/api/v1/dashboard/monitors/mon-1')
      .set('x-test-user-id', 'u1')
      .send({ status: 'invalid' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  test('400 — missing status', async () => {
    const app = buildApp();
    const res = await request(app)
      .patch('/api/v1/dashboard/monitors/mon-1')
      .set('x-test-user-id', 'u1')
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  test('200 — updates monitor status to paused via DB', async () => {
    mockQuery.mockResolvedValue({
      rows: [{
        id: 'mon-1',
        name: 'Monitor',
        package: 'test',
        frequency: '15min',
        status: 'paused',
        created_at: '2026-07-01T00:00:00Z',
        updated_at: '2026-07-01T00:00:00Z',
      }],
    });

    const app = buildApp();
    const res = await request(app)
      .patch('/api/v1/dashboard/monitors/mon-1')
      .set('x-test-user-id', 'u1')
      .send({ status: 'paused' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('paused');
  });

  test('200 — updates monitor status to active', async () => {
    mockQuery.mockResolvedValue({
      rows: [{
        id: 'mon-1',
        name: 'Monitor',
        package: 'test',
        frequency: '15min',
        status: 'active',
        created_at: '2026-07-01T00:00:00Z',
        updated_at: '2026-07-01T00:00:00Z',
      }],
    });

    const app = buildApp();
    const res = await request(app)
      .patch('/api/v1/dashboard/monitors/mon-1')
      .set('x-test-user-id', 'u1')
      .send({ status: 'active' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('active');
  });

  test('404 — monitor not found', async () => {
    mockQuery.mockResolvedValue({ rows: [] });

    const app = buildApp();
    const res = await request(app)
      .patch('/api/v1/dashboard/monitors/mon-999')
      .set('x-test-user-id', 'u1')
      .send({ status: 'paused' });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  test('200 — fallback: DB unavailable, simulates success', async () => {
    const dbErr = new Error('ECONNREFUSED');
    dbErr.code = 'ECONNREFUSED';
    mockQuery.mockRejectedValue(dbErr);

    const app = buildApp();
    const res = await request(app)
      .patch('/api/v1/dashboard/monitors/mon-1')
      .set('x-test-user-id', 'u1')
      .send({ status: 'alert' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe('mon-1');
    expect(res.body.data.status).toBe('alert');
  });

  test('400 — status "alert" is valid', async () => {
    mockQuery.mockResolvedValue({
      rows: [{
        id: 'mon-1',
        name: 'Monitor',
        package: 'test',
        frequency: '15min',
        status: 'alert',
        created_at: '2026-07-01T00:00:00Z',
        updated_at: '2026-07-01T00:00:00Z',
      }],
    });

    const app = buildApp();
    const res = await request(app)
      .patch('/api/v1/dashboard/monitors/mon-1')
      .set('x-test-user-id', 'u1')
      .send({ status: 'alert' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('alert');
  });
});
