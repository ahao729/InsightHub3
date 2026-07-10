// ── Data Packages Routes Tests ──
// Tests: GET /:package/stats, GET /:package/search, GET /:package/:id

/* ── Mock services ── */
const mockGetStats = jest.fn();
const mockSearch = jest.fn();
const mockGetById = jest.fn();

const mockServices = {
  'startup-intel': { getStats: mockGetStats, search: mockSearch, getById: mockGetById },
};

jest.mock('../services/startupIntel', () => mockServices['startup-intel']);

// All other package services just need a basic mock so require() doesn't fail
jest.mock('../services/enterpriseRisk', () => ({ getStats: jest.fn(), search: jest.fn(), getById: jest.fn() }));
jest.mock('../services/financeMacro', () => ({ getStats: jest.fn(), search: jest.fn(), getById: jest.fn() }));
jest.mock('../services/patentTech', () => ({ getStats: jest.fn(), search: jest.fn(), getById: jest.fn() }));
jest.mock('../services/policyBidding', () => ({ getStats: jest.fn(), search: jest.fn(), getById: jest.fn() }));
jest.mock('../services/aiGeo', () => ({ getStats: jest.fn(), search: jest.fn(), getById: jest.fn() }));
jest.mock('../services/education', () => ({ getStats: jest.fn(), search: jest.fn(), getById: jest.fn() }));
jest.mock('../services/web3Crypto', () => ({ getStats: jest.fn(), search: jest.fn(), getById: jest.fn() }));
jest.mock('../services/crossborderEcommerce', () => ({ getStats: jest.fn(), search: jest.fn(), getById: jest.fn() }));

/* ── Mock auth middleware ── */
const mockOptionalAuth = jest.fn((req, res, next) => next());
jest.mock('../middleware/auth', () => ({
  authenticate: jest.fn((req, res, next) => {
    req.user = { id: 'user-1', email: 'test@test.com', name: 'Test' };
    next();
  }),
  optionalAuth: (...args) => mockOptionalAuth(...args),
}));

/* ── Imports ── */
const request = require('supertest');
const express = require('express');
const { errorHandler } = require('../middleware/errorHandler');

function buildApp() {
  const app = express();
  app.use(express.json());
  const routes = require('../routes/dataPackages');
  app.use('/api/v1/data', routes);
  // Use real global error handler for correct error code mapping
  app.use(errorHandler);
  return app;
}

beforeEach(() => {
  jest.clearAllMocks();
});

/* ── Stats ── */
describe('GET /api/v1/data/:package/stats', () => {
  test('200 — returns stats for valid package', async () => {
    mockGetStats.mockResolvedValue({ totalRecords: 42, lastUpdated: '2026-06-01T00:00:00Z' });

    const app = buildApp();
    const res = await request(app).get('/api/v1/data/startup-intel/stats');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.package).toBe('startup-intel');
    expect(res.body.data.totalRecords).toBe(42);
    expect(mockGetStats).toHaveBeenCalledTimes(1);
  });

  test('404 — invalid package code', async () => {
    const app = buildApp();
    const res = await request(app).get('/api/v1/data/invalid-pkg/stats');

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('INVALID_PACKAGE');
  });
});

/* ── Search ── */
describe('GET /api/v1/data/:package/search', () => {
  test('200 — returns paginated results', async () => {
    mockSearch.mockResolvedValue({
      data: [{ id: '1', name: 'Result 1' }, { id: '2', name: 'Result 2' }],
      total: 10,
    });

    const app = buildApp();
    const res = await request(app).get('/api/v1/data/startup-intel/search?page=1&limit=5');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.meta.total).toBe(10);
    expect(res.body.meta.page).toBe(1);
    expect(res.body.meta.limit).toBe(5);
    expect(mockSearch).toHaveBeenCalledWith(
      expect.objectContaining({ page: '1', limit: '5' }),
      { page: 1, limit: 5 }
    );
  });

  test('200 — returns empty array when result is null', async () => {
    mockSearch.mockResolvedValue(null);

    const app = buildApp();
    const res = await request(app).get('/api/v1/data/startup-intel/search');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual([]);
    expect(res.body.meta.total).toBe(0);
  });

  test('404 — invalid package', async () => {
    const app = buildApp();
    const res = await request(app).get('/api/v1/data/invalid-pkg/search');

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('INVALID_PACKAGE');
  });
});

/* ── Get by ID ── */
describe('GET /api/v1/data/:package/:id', () => {
  test('200 — returns item by ID', async () => {
    mockGetById.mockResolvedValue({ id: 'item-1', name: 'Item One' });

    const app = buildApp();
    const res = await request(app).get('/api/v1/data/startup-intel/item-1');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe('item-1');
    expect(mockGetById).toHaveBeenCalledWith('item-1');
  });

  test('404 — item not found', async () => {
    mockGetById.mockResolvedValue(null);

    const app = buildApp();
    const res = await request(app).get('/api/v1/data/startup-intel/nonexistent');

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  test('404 — invalid package', async () => {
    const app = buildApp();
    const res = await request(app).get('/api/v1/data/invalid-pkg/some-id');

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('INVALID_PACKAGE');
  });
});
