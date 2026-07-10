// ── Auth Routes Tests ──
// Tests: POST /api/v1/auth/register, POST /api/v1/auth/login,
//        GET  /api/v1/auth/me, PUT /api/v1/auth/me

/* ── Module-level mocks (hoisted) ── */
const mockQuery = jest.fn();
jest.mock('../db/pool', () => ({ query: (...args) => mockQuery(...args) }));

const mockHash = jest.fn((pw) => Promise.resolve(`hashed_${pw}`));
const mockCompare = jest.fn((pw, hash) => Promise.resolve(hash === `hashed_${pw}`));
jest.mock('bcryptjs', () => ({ hash: (...args) => mockHash(...args), compare: (...args) => mockCompare(...args) }));

const mockJwtSign = jest.fn((payload) => `test_jwt_${payload.sub}_${Date.now()}`);
jest.mock('jsonwebtoken', () => ({
  sign: (...args) => mockJwtSign(...args),
  verify: jest.fn(),
}));

// Always-unique UUIDs to avoid fallback Map collisions across tests
const mockUuidV4 = jest.fn(() => `uuid-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`);
jest.mock('uuid', () => ({ v4: () => mockUuidV4() }));

const mockAuthenticate = jest.fn((req, res, next) => {
  const uid = req.headers['x-test-user-id'];
  if (uid) {
    req.user = {
      id: uid,
      email: req.headers['x-test-email'] || 'test@example.com',
      name: req.headers['x-test-name'] || 'Test User',
    };
    return next();
  }
  return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: '未提供认证信息。' } });
});
const mockOptionalAuth = jest.fn((req, res, next) => {
  if (req.headers['x-test-user-id']) {
    req.user = { id: req.headers['x-test-user-id'], email: 'test@example.com', name: 'Test User' };
  }
  next();
});
jest.mock('../middleware/auth', () => ({
  authenticate: (...args) => mockAuthenticate(...args),
  optionalAuth: (...args) => mockOptionalAuth(...args),
}));

/* ── Imports ── */
const request = require('supertest');
const express = require('express');

function buildApp() {
  const app = express();
  app.use(express.json());
  const authRoutes = require('../routes/auth');
  app.use('/api/v1/auth', authRoutes);
  return app;
}

/* ── Helpers ── */
function mockDbUnavailable(code = 'ECONNREFUSED') {
  const err = new Error(code);
  err.code = code;
  mockQuery.mockRejectedValue(err);
}

function mockDbOk(rows) {
  mockQuery.mockResolvedValue({ rows });
}

/* ── Tests ── */
describe('POST /api/v1/auth/register', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('201 — successful registration via DB', async () => {
    mockDbOk([{ id: 'user-1', email: 'new@test.com', name: 'New User', created_at: '2026-01-01T00:00:00Z' }]);

    const app = buildApp();
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ email: 'new@test.com', password: 'secret123', name: 'New User' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.email).toBe('new@test.com');
    expect(res.body.data.token).toContain('test_jwt_');
    expect(mockHash).toHaveBeenCalledWith('secret123', 10);
    expect(mockQuery).toHaveBeenCalledTimes(1);
  });

  test('400 — missing email', async () => {
    const app = buildApp();
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ password: 'secret123', name: 'No Email' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  test('400 — missing password', async () => {
    const app = buildApp();
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ email: 'a@b.com', name: 'No Pw' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  test('400 — missing name', async () => {
    const app = buildApp();
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ email: 'a@b.com', password: 'secret123' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  test('400 — password too short (< 6)', async () => {
    const app = buildApp();
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ email: 'a@b.com', password: '12', name: 'Short' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.message).toMatch(/6位/);
  });

  test('409 — duplicate email (DB code 23505)', async () => {
    const dbErr = new Error('duplicate');
    dbErr.code = '23505';
    mockQuery.mockRejectedValue(dbErr);

    const app = buildApp();
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ email: 'dup@test.com', password: 'secret123', name: 'Dup' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('DUPLICATE_ENTRY');
  });

  test('201 — fallback registration (DB unavailable)', async () => {
    mockDbUnavailable();

    const app = buildApp();
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ email: 'fallback@test.com', password: 'secret123', name: 'Fallback' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.email).toBe('fallback@test.com');
    expect(res.body.data.token).toContain('test_jwt_');
  });

  test('409 — fallback duplicate email in-memory', async () => {
    mockDbUnavailable();

    const app = buildApp();
    // First registration
    await request(app)
      .post('/api/v1/auth/register')
      .send({ email: 'fdup@test.com', password: 'secret123', name: 'First' });

    // Second registration with same email -> 409
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ email: 'fdup@test.com', password: 'secret123', name: 'Second' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('DUPLICATE_ENTRY');
  });
});

describe('POST /api/v1/auth/login', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('200 — successful login via DB', async () => {
    mockDbOk([{ id: 'user-1', email: 'user@test.com', name: 'Some User', password_hash: 'hashed_mypass' }]);

    const app = buildApp();
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'user@test.com', password: 'mypass' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.email).toBe('user@test.com');
    expect(res.body.data.token).toContain('test_jwt_');
    expect(mockCompare).toHaveBeenCalledWith('mypass', 'hashed_mypass');
  });

  test('401 — wrong email', async () => {
    mockDbOk([]);

    const app = buildApp();
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'nobody@test.com', password: 'mypass' });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  test('401 — wrong password', async () => {
    mockDbOk([{ id: 'user-1', email: 'user@test.com', name: 'User', password_hash: 'hashed_correctpass' }]);

    const app = buildApp();
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'user@test.com', password: 'wrongpass' });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  test('400 — missing email', async () => {
    const app = buildApp();
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ password: 'mypass' });
    expect(res.status).toBe(400);
  });

  test('400 — missing password', async () => {
    const app = buildApp();
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'a@b.com' });
    expect(res.status).toBe(400);
  });

  test('200 — fallback login (DB unavailable)', async () => {
    mockDbUnavailable();
    const app = buildApp();
    // First register a fallback user
    await request(app)
      .post('/api/v1/auth/register')
      .send({ email: 'flogin@test.com', password: 'secret123', name: 'FLogin' });

    // Login should also fallback
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'flogin@test.com', password: 'secret123' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test('401 — fallback login with wrong email', async () => {
    mockDbUnavailable();
    const app = buildApp();
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'noexist@test.com', password: 'secret123' });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });
});

describe('GET /api/v1/auth/me', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    uuidCounter = 0;
  });

  test('200 — authenticated user (DB path)', async () => {
    mockDbOk([{ id: 'u1', email: 'me@test.com', name: 'Me', created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-02T00:00:00Z' }]);

    const app = buildApp();
    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('x-test-user-id', 'u1')
      .set('x-test-email', 'me@test.com');

    expect(res.status).toBe(200);
    expect(res.body.data.user.email).toBe('me@test.com');
    expect(res.body.data.user.name).toBe('Me');
  });

  test('401 — no auth header', async () => {
    const app = buildApp();
    const res = await request(app).get('/api/v1/auth/me');
    expect(res.status).toBe(401);
  });

  test('404 — user not found in DB', async () => {
    mockDbOk([]);

    const app = buildApp();
    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('x-test-user-id', 'nonexist');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  test('200 — fallback (DB unavailable, found in memory)', async () => {
    // Register fallback user
    mockDbUnavailable();
    const app = buildApp();
    const registerRes = await request(app)
      .post('/api/v1/auth/register')
      .send({ email: 'mem@test.com', password: 'secret123', name: 'MemUser' });
    const userId = registerRes.body.data.user.id;

    // GET /me should find in memory (mockQuery will reject since mock is persistent)
    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('x-test-user-id', userId);
    expect(res.status).toBe(200);
    expect(res.body.data.user.email).toBe('mem@test.com');
  });
});

describe('PUT /api/v1/auth/me', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    uuidCounter = 0;
  });

  test('200 — update name via DB', async () => {
    mockDbOk([{ id: 'u1', email: 'me@test.com', name: 'NewName', created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-02T00:00:00Z' }]);

    const app = buildApp();
    const res = await request(app)
      .put('/api/v1/auth/me')
      .set('x-test-user-id', 'u1')
      .send({ name: 'NewName' });
    expect(res.status).toBe(200);
    expect(res.body.data.user.name).toBe('NewName');
  });

  test('400 — no update fields', async () => {
    const app = buildApp();
    const res = await request(app)
      .put('/api/v1/auth/me')
      .set('x-test-user-id', 'u1')
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  test('401 — no auth header', async () => {
    const app = buildApp();
    const res = await request(app)
      .put('/api/v1/auth/me')
      .send({ name: 'X' });
    expect(res.status).toBe(401);
  });

  test('404 — user not found in DB', async () => {
    mockDbOk([]);

    const app = buildApp();
    const res = await request(app)
      .put('/api/v1/auth/me')
      .set('x-test-user-id', 'nonexist')
      .send({ name: 'X' });
    expect(res.status).toBe(404);
  });

  test('409 — duplicate email on update', async () => {
    const dbErr = new Error('duplicate');
    dbErr.code = '23505';
    mockQuery.mockRejectedValue(dbErr);

    const app = buildApp();
    const res = await request(app)
      .put('/api/v1/auth/me')
      .set('x-test-user-id', 'u1')
      .send({ email: 'dup@test.com' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('DUPLICATE_ENTRY');
  });
});
