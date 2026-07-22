// ── Subscriptions Routes Tests ──
// Tests: GET /plans, GET /current, POST /subscribe, POST /cancel

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
      role: req.headers['x-test-role'] || 'user',
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
const subscriptionsRoutes = require('../routes/subscriptions');

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/subscriptions', subscriptionsRoutes);
  return app;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockQuery.mockReset();
});

/* ══════════════════════════════════════════════
   GET /api/v1/subscriptions/plans
   ══════════════════════════════════════════════ */
describe('GET /api/v1/subscriptions/plans', () => {
  test('200 — returns plans from DB', async () => {
    const fakePlans = [
      { id: 'plan-free-001', name: '免费版', code: 'free', price_monthly: 0 },
      { id: 'plan-pro-001', name: '专业版', code: 'pro', price_monthly: 299 },
    ];
    mockQuery.mockResolvedValue({ rows: fakePlans });

    const app = buildApp();
    const res = await request(app).get('/api/v1/subscriptions/plans');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.meta.total).toBe(2);
    expect(res.body.data[0].code).toBe('free');
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('FROM subscription_plans')
    );
  });

  test('200 — DB unavailable → fallback plans', async () => {
    mockQuery.mockRejectedValue(new Error('ECONNREFUSED'));

    const app = buildApp();
    const res = await request(app).get('/api/v1/subscriptions/plans');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(3);
    expect(res.body.data.find(p => p.code === 'free')).toBeDefined();
    expect(res.body.data.find(p => p.code === 'pro')).toBeDefined();
    expect(res.body.data.find(p => p.code === 'enterprise')).toBeDefined();
  });
});

/* ══════════════════════════════════════════════
   GET /api/v1/subscriptions/current
   ══════════════════════════════════════════════ */
describe('GET /api/v1/subscriptions/current', () => {
  test('200 — returns active subscription from DB', async () => {
    const fakeSub = {
      id: 'sub-001',
      user_id: 'user-1',
      status: 'active',
      plan_name: '专业版',
      plan_code: 'pro',
      price_monthly: 299,
    };
    mockQuery.mockResolvedValue({ rows: [fakeSub] });

    const app = buildApp();
    const res = await request(app)
      .get('/api/v1/subscriptions/current')
      .set('x-test-user-id', 'user-1');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.plan_name).toBe('专业版');
    expect(res.body.data.status).toBe('active');
  });

  test('200 — no active subscription → returns default free plan', async () => {
    mockQuery.mockResolvedValue({ rows: [] });

    const app = buildApp();
    const res = await request(app)
      .get('/api/v1/subscriptions/current')
      .set('x-test-user-id', 'user-1');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.plan.code).toBe('free');
    expect(res.body.data.isDefault).toBe(true);
  });

  test('200 — DB unavailable → fallback returns free plan', async () => {
    mockQuery.mockRejectedValue(new Error('ECONNREFUSED'));

    const app = buildApp();
    const res = await request(app)
      .get('/api/v1/subscriptions/current')
      .set('x-test-user-id', 'user-1');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.plan.code).toBe('free');
    expect(res.body.data.isDefault).toBe(true);
  });

  test('401 — unauthenticated', async () => {
    const app = buildApp();
    const res = await request(app).get('/api/v1/subscriptions/current');

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });
});

/* ══════════════════════════════════════════════
   POST /api/v1/subscriptions/subscribe
   ══════════════════════════════════════════════ */
describe('POST /api/v1/subscriptions/subscribe', () => {
  test('201 — subscribes to pro plan via DB', async () => {
    mockQuery.mockImplementation((sql) => {
      if (sql.includes('SELECT * FROM subscription_plans')) {
        return Promise.resolve({ rows: [{ id: 'plan-pro-001', code: 'pro', name: '专业版', price_monthly: 299 }] });
      }
      if (sql.includes('UPDATE subscriptions')) {
        return Promise.resolve({ rows: [] });
      }
      if (sql.includes('INSERT INTO subscriptions')) {
        return Promise.resolve({ rows: [{ id: 'sub-new', user_id: 'user-1', plan_id: 'plan-pro-001', status: 'active' }] });
      }
      return Promise.resolve({ rows: [] });
    });

    const app = buildApp();
    const res = await request(app)
      .post('/api/v1/subscriptions/subscribe')
      .set('x-test-user-id', 'user-1')
      .send({ plan_code: 'pro' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.subscription.status).toBe('active');
  });

  test('400 — missing plan_code', async () => {
    const app = buildApp();
    const res = await request(app)
      .post('/api/v1/subscriptions/subscribe')
      .set('x-test-user-id', 'user-1')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.message).toContain('plan_code');
  });

  test('400 — invalid plan_code', async () => {
    const app = buildApp();
    const res = await request(app)
      .post('/api/v1/subscriptions/subscribe')
      .set('x-test-user-id', 'user-1')
      .send({ plan_code: 'nonexistent' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test('201 — DB unavailable → fallback in-memory subscribe', async () => {
    mockQuery.mockRejectedValue(new Error('ECONNREFUSED'));

    const app = buildApp();
    const res = await request(app)
      .post('/api/v1/subscriptions/subscribe')
      .set('x-test-user-id', 'user-1')
      .send({ plan_code: 'pro' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
  });

  test('401 — unauthenticated', async () => {
    const app = buildApp();
    const res = await request(app)
      .post('/api/v1/subscriptions/subscribe')
      .send({ plan_code: 'pro' });

    expect(res.status).toBe(401);
  });
});

/* ══════════════════════════════════════════════
   POST /api/v1/subscriptions/cancel
   ══════════════════════════════════════════════ */
describe('POST /api/v1/subscriptions/cancel', () => {
  test('200 — cancels active subscription via DB', async () => {
    mockQuery.mockResolvedValue({
      rows: [{ id: 'sub-001', user_id: 'user-1', status: 'cancelled' }],
    });

    const app = buildApp();
    const res = await request(app)
      .post('/api/v1/subscriptions/cancel')
      .set('x-test-user-id', 'user-1');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('cancelled');
  });

  test('404 — no active subscription to cancel', async () => {
    mockQuery.mockResolvedValue({ rows: [] });

    const app = buildApp();
    const res = await request(app)
      .post('/api/v1/subscriptions/cancel')
      .set('x-test-user-id', 'user-1');

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  test('200 — DB unavailable → fallback cancel', async () => {
    mockQuery.mockRejectedValue(new Error('ECONNREFUSED'));

    // First subscribe, then cancel
    const app = buildApp();

    // Subscribe first (to populate fallback store)
    await request(app)
      .post('/api/v1/subscriptions/subscribe')
      .set('x-test-user-id', 'user-fb')
      .send({ plan_code: 'pro' });

    // Then cancel
    const res = await request(app)
      .post('/api/v1/subscriptions/cancel')
      .set('x-test-user-id', 'user-fb');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('cancelled');
  });

  test('404 — fallback: no subscription exists', async () => {
    mockQuery.mockRejectedValue(new Error('ECONNREFUSED'));

    const app = buildApp();
    const res = await request(app)
      .post('/api/v1/subscriptions/cancel')
      .set('x-test-user-id', 'nonexistent-user');

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });
});
