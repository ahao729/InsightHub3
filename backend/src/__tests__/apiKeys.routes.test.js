// ── API Keys Routes Tests ──
// Tests: GET /, POST /, DELETE /:id

/* ── Module-level mocks ── */
const mockQuery = jest.fn();
jest.mock('../db/pool', () => ({ query: (...args) => mockQuery(...args) }));

const mockUuidV4 = jest.fn(() => 'fixed-uuid-123');
jest.mock('uuid', () => ({ v4: () => mockUuidV4() }));

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
  const apiKeyRoutes = require('../routes/apiKeys');
  app.use('/api/v1/api-keys', apiKeyRoutes);
  return app;
}

beforeEach(() => {
  jest.clearAllMocks();
});

/* ── List keys ── */
describe('GET /api/v1/api-keys', () => {
  const dbRows = [
    { id: 'key-1', key: 'sk_abc', name: 'Production', last_used_at: '2026-06-14T10:00:00Z', created_at: '2026-01-01T00:00:00Z', revoked: false },
    { id: 'key-2', key: 'sk_def', name: 'Development', last_used_at: null, created_at: '2026-06-01T00:00:00Z', revoked: false },
  ];

  test('200 — list keys from DB', async () => {
    mockQuery.mockResolvedValue({ rows: dbRows });

    const app = buildApp();
    const res = await request(app)
      .get('/api/v1/api-keys')
      .set('x-test-user-id', 'user-1');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.meta.total).toBe(2);
    expect(res.body.data[0].name).toBe('Production');
  });

  test('200 — fallback keys when DB unavailable', async () => {
    const dbErr = new Error('ECONNREFUSED');
    dbErr.code = 'ECONNREFUSED';
    mockQuery.mockRejectedValue(dbErr);

    const app = buildApp();
    const res = await request(app)
      .get('/api/v1/api-keys')
      .set('x-test-user-id', 'user-1');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual([]);
    expect(res.body.meta.total).toBe(0);
  });

  test('401 — unauthenticated', async () => {
    const app = buildApp();
    const res = await request(app).get('/api/v1/api-keys');

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });
});

/* ── Create key ── */
describe('POST /api/v1/api-keys', () => {
  test('201 — create key via DB', async () => {
    mockQuery.mockResolvedValue({
      rows: [{ id: 'new-key-1', key: 'sk_newkey', name: 'My Key', created_at: '2026-06-14T00:00:00Z', revoked: false }],
    });

    const app = buildApp();
    const res = await request(app)
      .post('/api/v1/api-keys')
      .set('x-test-user-id', 'user-1')
      .send({ name: 'My Key' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.name).toBe('My Key');
    expect(res.body.data.revoked).toBe(false);
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO api_keys'),
      ['user-1', expect.any(String), 'My Key']
    );
  });

  test('400 — missing name', async () => {
    const app = buildApp();
    const res = await request(app)
      .post('/api/v1/api-keys')
      .set('x-test-user-id', 'user-1')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.message).toMatch(/密钥名称/);
  });

  test('201 — fallback create when DB unavailable', async () => {
    const dbErr = new Error('ECONNREFUSED');
    dbErr.code = 'ECONNREFUSED';
    mockQuery.mockRejectedValue(dbErr);

    const app = buildApp();
    const res = await request(app)
      .post('/api/v1/api-keys')
      .set('x-test-user-id', 'user-1')
      .send({ name: 'Fallback Key' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.name).toBe('Fallback Key');
    expect(res.body.data.user_id).toBe('user-1');
    expect(res.body.data.revoked).toBe(false);
  });

  test('401 — unauthenticated', async () => {
    const app = buildApp();
    const res = await request(app)
      .post('/api/v1/api-keys')
      .send({ name: 'My Key' });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });
});

/* ── Revoke (delete) key ── */
describe('DELETE /api/v1/api-keys/:id', () => {
  test('200 — revoke key via DB', async () => {
    mockQuery.mockResolvedValue({
      rows: [{ id: 'key-1', key: 'sk_abc', name: 'Production', revoked: true }],
    });

    const app = buildApp();
    const res = await request(app)
      .delete('/api/v1/api-keys/key-1')
      .set('x-test-user-id', 'user-1');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.revoked).toBe(true);
    expect(res.body.data.name).toBe('Production');
  });

  test('404 — key not found in DB', async () => {
    mockQuery.mockResolvedValue({ rows: [] });

    const app = buildApp();
    const res = await request(app)
      .delete('/api/v1/api-keys/nonexistent')
      .set('x-test-user-id', 'user-1');

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  test('200 — fallback revoke when DB unavailable', async () => {
    const dbErr = new Error('ECONNREFUSED');
    dbErr.code = 'ECONNREFUSED';
    mockQuery.mockRejectedValue(dbErr);

    const app = buildApp();
    // First create a key via fallback so it exists in the Map
    mockQuery.mockRejectedValue(dbErr); // persist the mock

    // Create the key first
    const createRes = await request(app)
      .post('/api/v1/api-keys')
      .set('x-test-user-id', 'user-1')
      .send({ name: 'To Delete' });

    const keyId = createRes.body.data.id;

    // Now delete it
    const res = await request(app)
      .delete(`/api/v1/api-keys/${keyId}`)
      .set('x-test-user-id', 'user-1');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.revoked).toBe(true);
  });

  test('404 — fallback key not found in Map', async () => {
    const dbErr = new Error('ECONNREFUSED');
    dbErr.code = 'ECONNREFUSED';
    mockQuery.mockRejectedValue(dbErr);

    const app = buildApp();
    const res = await request(app)
      .delete('/api/v1/api-keys/nonexistent')
      .set('x-test-user-id', 'user-1');

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  test('401 — unauthenticated', async () => {
    const app = buildApp();
    const res = await request(app).delete('/api/v1/api-keys/key-1');

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });
});
