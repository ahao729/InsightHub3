// ── Analyze Routes Tests ──
// Tests: POST /rag, POST /quick, POST /compare, GET /token-usage, GET /admin/token-usage

/* ── Module-level mocks ── */
jest.mock('../db/pool', () => ({ query: jest.fn().mockResolvedValue({ rows: [] }) }));

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

const mockRagQuery = jest.fn();
const mockRagQuickAnalyze = jest.fn();
const mockRagCompare = jest.fn();
jest.mock('../services/ragService', () => ({
  query: (...args) => mockRagQuery(...args),
  quickAnalyze: (...args) => mockRagQuickAnalyze(...args),
  compare: (...args) => mockRagCompare(...args),
}));

const mockGetUserStats = jest.fn();
const mockGetGlobalStats = jest.fn();
const mockIsUserRateLimited = jest.fn();
const mockIsGloballyRateLimited = jest.fn();
jest.mock('../services/tokenUsage', () => ({
  getUserStats: (...args) => mockGetUserStats(...args),
  getGlobalStats: (...args) => mockGetGlobalStats(...args),
  isUserRateLimited: (...args) => mockIsUserRateLimited(...args),
  isGloballyRateLimited: (...args) => mockIsGloballyRateLimited(...args),
  userDailyLimit: 100000,
  dailyLimit: 1000000,
}));

/* ── Imports ── */
const request = require('supertest');
const express = require('express');
const analyzeRoutes = require('../routes/analyze');

const { errorHandler } = require('../middleware/errorHandler');

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/analyze', analyzeRoutes);
  app.use(errorHandler);
  return app;
}

beforeEach(() => {
  jest.clearAllMocks();
});

/* ══════════════════════════════════════════════
   POST /api/v1/analyze/rag
   ══════════════════════════════════════════════ */
describe('POST /api/v1/analyze/rag', () => {
  test('200 — returns RAG analysis result', async () => {
    mockRagQuery.mockResolvedValue({
      success: true,
      analysis: 'This is a summary of the startup ecosystem.',
      contextCount: 5,
      model: 'gpt-4o-mini',
      usage: { inputTokens: 120, outputTokens: 80, totalTokens: 200 },
      traceId: 'trace-abc-123',
    });

    const app = buildApp();
    const res = await request(app)
      .post('/api/v1/analyze/rag')
      .set('x-test-user-id', 'user-1')
      .send({
        query: 'What are the latest trends in startups?',
        packageCode: 'startup',
        topK: 5,
        analysisType: 'summary',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.analysis).toBe('This is a summary of the startup ecosystem.');
    expect(res.body.data.contextCount).toBe(5);
    expect(res.body.data.model).toBe('gpt-4o-mini');
    expect(res.body.data.traceId).toBe('trace-abc-123');
    expect(mockRagQuery).toHaveBeenCalledWith(expect.objectContaining({
      query: 'What are the latest trends in startups?',
      packageCode: 'startup',
      userId: 'user-1',
    }));
  });

  test('400 — missing query', async () => {
    const app = buildApp();
    const res = await request(app)
      .post('/api/v1/analyze/rag')
      .set('x-test-user-id', 'user-1')
      .send({ packageCode: 'startup' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toContain('查询内容不能为空');
  });

  test('400 — blank query (whitespace only)', async () => {
    const app = buildApp();
    const res = await request(app)
      .post('/api/v1/analyze/rag')
      .set('x-test-user-id', 'user-1')
      .send({ query: '   ', packageCode: 'startup' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test('400 — missing packageCode', async () => {
    const app = buildApp();
    const res = await request(app)
      .post('/api/v1/analyze/rag')
      .set('x-test-user-id', 'user-1')
      .send({ query: 'Analyze this' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toContain('packageCode');
  });

  test('404 — RAG service returns failure', async () => {
    mockRagQuery.mockResolvedValue({
      success: false,
      error: 'No data found for package "nonexistent"',
      context: [],
    });

    const app = buildApp();
    const res = await request(app)
      .post('/api/v1/analyze/rag')
      .set('x-test-user-id', 'user-1')
      .send({ query: 'test query', packageCode: 'nonexistent' });

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toContain('No data found');
  });

  test('401 — unauthenticated', async () => {
    const app = buildApp();
    const res = await request(app)
      .post('/api/v1/analyze/rag')
      .send({ query: 'test', packageCode: 'startup' });

    expect(res.status).toBe(401);
  });

  test('500 — RAG service throws', async () => {
    mockRagQuery.mockRejectedValue(new Error('LLM provider timeout'));

    const app = buildApp();
    const res = await request(app)
      .post('/api/v1/analyze/rag')
      .set('x-test-user-id', 'user-1')
      .send({ query: 'test query', packageCode: 'startup' });

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
  });
});

/* ══════════════════════════════════════════════
   POST /api/v1/analyze/quick
   ══════════════════════════════════════════════ */
describe('POST /api/v1/analyze/quick', () => {
  test('200 — returns quick analysis result', async () => {
    mockRagQuickAnalyze.mockResolvedValue({
      success: true,
      analysis: 'The data shows a 15% growth.',
      dataCount: 3,
      model: 'gpt-4o-mini',
      usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
    });

    const app = buildApp();
    const res = await request(app)
      .post('/api/v1/analyze/quick')
      .set('x-test-user-id', 'user-1')
      .send({
        query: 'Summarize this data',
        data: [{ name: 'A' }, { name: 'B' }, { name: 'C' }],
        packageCode: 'startup',
        analysisType: 'summary',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.analysis).toBe('The data shows a 15% growth.');
    expect(res.body.data.dataCount).toBe(3);
    expect(mockRagQuickAnalyze).toHaveBeenCalledWith(expect.objectContaining({
      query: 'Summarize this data',
      data: expect.arrayContaining([expect.objectContaining({ name: 'A' })]),
      packageCode: 'startup',
      userId: 'user-1',
    }));
  });

  test('400 — missing query', async () => {
    const app = buildApp();
    const res = await request(app)
      .post('/api/v1/analyze/quick')
      .set('x-test-user-id', 'user-1')
      .send({ data: [{ a: 1 }] });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test('400 — missing data', async () => {
    const app = buildApp();
    const res = await request(app)
      .post('/api/v1/analyze/quick')
      .set('x-test-user-id', 'user-1')
      .send({ query: 'test' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toContain('data');
  });

  test('400 — empty data array', async () => {
    const app = buildApp();
    const res = await request(app)
      .post('/api/v1/analyze/quick')
      .set('x-test-user-id', 'user-1')
      .send({ query: 'test', data: [] });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test('400 — data is not an array', async () => {
    const app = buildApp();
    const res = await request(app)
      .post('/api/v1/analyze/quick')
      .set('x-test-user-id', 'user-1')
      .send({ query: 'test', data: 'not-an-array' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test('200 — defaults packageCode to "general" if not provided', async () => {
    mockRagQuickAnalyze.mockResolvedValue({
      success: true,
      analysis: 'Analysis done.',
      dataCount: 1,
      model: 'test-model',
      usage: {},
    });

    const app = buildApp();
    await request(app)
      .post('/api/v1/analyze/quick')
      .set('x-test-user-id', 'user-1')
      .send({ query: 'test', data: [{ a: 1 }] });

    expect(mockRagQuickAnalyze).toHaveBeenCalledWith(expect.objectContaining({
      packageCode: 'general',
    }));
  });

  test('500 — quick analyze returns failure', async () => {
    mockRagQuickAnalyze.mockResolvedValue({
      success: false,
      error: 'LLM rate limit exceeded',
    });

    const app = buildApp();
    const res = await request(app)
      .post('/api/v1/analyze/quick')
      .set('x-test-user-id', 'user-1')
      .send({ query: 'test', data: [{ a: 1 }] });

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
  });

  test('401 — unauthenticated', async () => {
    const app = buildApp();
    const res = await request(app)
      .post('/api/v1/analyze/quick')
      .send({ query: 'test', data: [{ a: 1 }] });

    expect(res.status).toBe(401);
  });
});

/* ══════════════════════════════════════════════
   POST /api/v1/analyze/compare
   ══════════════════════════════════════════════ */
describe('POST /api/v1/analyze/compare', () => {
  test('200 — returns compare analysis', async () => {
    mockRagCompare.mockResolvedValue({
      success: true,
      analysis: 'Company A is stronger in revenue but weaker in growth.',
      model: 'gpt-4o-mini',
      usage: { inputTokens: 200, outputTokens: 120, totalTokens: 320 },
    });

    const app = buildApp();
    const res = await request(app)
      .post('/api/v1/analyze/compare')
      .set('x-test-user-id', 'user-1')
      .send({
        items: [{ name: 'Company A', revenue: 100 }, { name: 'Company B', revenue: 200 }],
        packageCode: 'enterprise',
        dimension: 'revenue',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.analysis).toContain('Company A');
    expect(mockRagCompare).toHaveBeenCalledWith(expect.objectContaining({
      items: expect.arrayContaining([expect.objectContaining({ name: 'Company A' })]),
      packageCode: 'enterprise',
      dimension: 'revenue',
      userId: 'user-1',
    }));
  });

  test('400 — missing items', async () => {
    const app = buildApp();
    const res = await request(app)
      .post('/api/v1/analyze/compare')
      .set('x-test-user-id', 'user-1')
      .send({ packageCode: 'enterprise' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toContain('2 个条目');
  });

  test('400 — only 1 item (need at least 2)', async () => {
    const app = buildApp();
    const res = await request(app)
      .post('/api/v1/analyze/compare')
      .set('x-test-user-id', 'user-1')
      .send({ items: [{ name: 'Only one' }], packageCode: 'enterprise' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test('400 — items is not an array', async () => {
    const app = buildApp();
    const res = await request(app)
      .post('/api/v1/analyze/compare')
      .set('x-test-user-id', 'user-1')
      .send({ items: 'not-an-array' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test('500 — compare service returns failure', async () => {
    mockRagCompare.mockResolvedValue({
      success: false,
      error: 'Insufficient data for comparison',
    });

    const app = buildApp();
    const res = await request(app)
      .post('/api/v1/analyze/compare')
      .set('x-test-user-id', 'user-1')
      .send({
        items: [{ name: 'A' }, { name: 'B' }],
        packageCode: 'enterprise',
      });

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
  });

  test('401 — unauthenticated', async () => {
    const app = buildApp();
    const res = await request(app)
      .post('/api/v1/analyze/compare')
      .send({ items: [{ name: 'A' }, { name: 'B' }] });

    expect(res.status).toBe(401);
  });
});

/* ══════════════════════════════════════════════
   GET /api/v1/analyze/token-usage
   ══════════════════════════════════════════════ */
describe('GET /api/v1/analyze/token-usage', () => {
  test('200 — returns user token usage stats', async () => {
    mockGetUserStats.mockResolvedValue({
      totalRequests: 42,
      totalTokens: 12345,
      totalCostUsd: 0.15,
    });
    mockIsUserRateLimited.mockResolvedValue(false);

    const app = buildApp();
    const res = await request(app)
      .get('/api/v1/analyze/token-usage')
      .set('x-test-user-id', 'user-1');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.totalRequests).toBe(42);
    expect(res.body.data.totalTokens).toBe(12345);
    expect(res.body.data.isRateLimited).toBe(false);
    expect(res.body.data.dailyLimit).toBe(100000);
    expect(mockGetUserStats).toHaveBeenCalledWith('user-1', 'today');
  });

  test('200 — accepts period query param', async () => {
    mockGetUserStats.mockResolvedValue({ totalTokens: 500 });
    mockIsUserRateLimited.mockResolvedValue(false);

    const app = buildApp();
    const res = await request(app)
      .get('/api/v1/analyze/token-usage?period=30d')
      .set('x-test-user-id', 'user-1');

    expect(res.status).toBe(200);
    expect(mockGetUserStats).toHaveBeenCalledWith('user-1', '30d');
  });

  test('200 — rate limited user', async () => {
    mockGetUserStats.mockResolvedValue({ totalTokens: 99999 });
    mockIsUserRateLimited.mockResolvedValue(true);

    const app = buildApp();
    const res = await request(app)
      .get('/api/v1/analyze/token-usage')
      .set('x-test-user-id', 'user-1');

    expect(res.status).toBe(200);
    expect(res.body.data.isRateLimited).toBe(true);
  });

  test('401 — unauthenticated', async () => {
    const app = buildApp();
    const res = await request(app).get('/api/v1/analyze/token-usage');

    expect(res.status).toBe(401);
  });
});

/* ══════════════════════════════════════════════
   GET /api/v1/analyze/admin/token-usage
   ══════════════════════════════════════════════ */
describe('GET /api/v1/analyze/admin/token-usage', () => {
  test('200 — admin gets global token usage stats', async () => {
    mockGetGlobalStats.mockResolvedValue({
      totalRequests: 1200,
      totalTokens: 500000,
      totalCostUsd: 5.50,
      activeUsers: 30,
    });
    mockIsGloballyRateLimited.mockResolvedValue(false);

    const app = buildApp();
    const res = await request(app)
      .get('/api/v1/analyze/admin/token-usage')
      .set('x-test-user-id', 'admin-1')
      .set('x-test-role', 'admin');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.totalRequests).toBe(1200);
    expect(res.body.data.activeUsers).toBe(30);
    expect(res.body.data.isRateLimited).toBe(false);
    expect(res.body.data.globalDailyLimit).toBe(1000000);
    expect(mockGetGlobalStats).toHaveBeenCalledWith('today');
  });

  test('200 — admin accepts period query param', async () => {
    mockGetGlobalStats.mockResolvedValue({ totalTokens: 1000 });
    mockIsGloballyRateLimited.mockResolvedValue(false);

    const app = buildApp();
    await request(app)
      .get('/api/v1/analyze/admin/token-usage?period=7d')
      .set('x-test-user-id', 'admin-1')
      .set('x-test-role', 'admin');

    expect(mockGetGlobalStats).toHaveBeenCalledWith('7d');
  });

  test('403 — non-admin user blocked', async () => {
    const app = buildApp();
    const res = await request(app)
      .get('/api/v1/analyze/admin/token-usage')
      .set('x-test-user-id', 'user-1');

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error.message).toContain('管理员');
  });

  test('401 — unauthenticated', async () => {
    const app = buildApp();
    const res = await request(app).get('/api/v1/analyze/admin/token-usage');

    expect(res.status).toBe(401);
  });
});
