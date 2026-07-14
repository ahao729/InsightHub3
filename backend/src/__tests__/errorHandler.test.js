// ── Error Handler Middleware Tests ──
// Tests: errorHandler, ValidationError, NotFoundError, UnauthorizedError, ForbiddenError

/* ── Mock config ── */
jest.mock('../config', () => ({
  isDev: false,
}));

const { errorHandler, ValidationError, NotFoundError, UnauthorizedError, ForbiddenError } = require('../middleware/errorHandler');

/* ── Helpers ── */
function mockReq(method = 'GET', path = '/test') {
  return { method, path };
}

function mockRes() {
  const res = {
    _status: null,
    _body: null,
    _headers: {},
    status(code) { res._status = code; return res; },
    json(body) { res._body = body; return res; },
    setHeader(name, value) { res._headers[name] = value; return res; },
  };
  return res;
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('errorHandler middleware', () => {
  test('500 — generic error returns INTERNAL_ERROR', () => {
    const res = mockRes();
    const err = new Error('something broke');
    errorHandler(err, mockReq(), res, jest.fn());
    expect(res._status).toBe(500);
    expect(res._body.success).toBe(false);
    expect(res._body.error.code).toBe('INTERNAL_ERROR');
    expect(res._body.error.message).toBe('服务器内部错误，请稍后再试。');
  });

  test('400 — ValidationError returns VALIDATION_ERROR', () => {
    const res = mockRes();
    const err = new ValidationError('参数不合法');
    errorHandler(err, mockReq(), res, jest.fn());
    expect(res._status).toBe(400);
    expect(res._body.error.code).toBe('VALIDATION_ERROR');
    expect(res._body.error.message).toBe('参数不合法');
  });

  test('404 — NotFoundError returns NOT_FOUND', () => {
    const res = mockRes();
    const err = new NotFoundError('资源不存在');
    errorHandler(err, mockReq(), res, jest.fn());
    expect(res._status).toBe(404);
    expect(res._body.error.code).toBe('NOT_FOUND');
    expect(res._body.error.message).toBe('资源不存在');
  });

  test('401 — UnauthorizedError returns UNAUTHORIZED', () => {
    const res = mockRes();
    const err = new UnauthorizedError('未授权');
    errorHandler(err, mockReq(), res, jest.fn());
    expect(res._status).toBe(401);
    expect(res._body.error.code).toBe('UNAUTHORIZED');
    expect(res._body.error.message).toBe('未授权');
  });

  test('403 — ForbiddenError returns FORBIDDEN', () => {
    const res = mockRes();
    const err = new ForbiddenError('禁止访问');
    errorHandler(err, mockReq(), res, jest.fn());
    expect(res._status).toBe(403);
    expect(res._body.error.code).toBe('FORBIDDEN');
    expect(res._body.error.message).toBe('禁止访问');
  });

  test('409 — PostgreSQL unique violation (code 23505)', () => {
    const res = mockRes();
    const err = new Error('duplicate key');
    err.code = '23505';
    errorHandler(err, mockReq(), res, jest.fn());
    expect(res._status).toBe(409);
    expect(res._body.error.code).toBe('DUPLICATE_ENTRY');
  });

  test('uses default message when error has no message', () => {
    const res = mockRes();
    const err = new ValidationError();
    errorHandler(err, mockReq(), res, jest.fn());
    expect(res._status).toBe(400);
    expect(res._body.error.message).toBe('请求参数验证失败。');
  });

  test('uses default message for NotFoundError with no message', () => {
    const res = mockRes();
    const err = new NotFoundError();
    errorHandler(err, mockReq(), res, jest.fn());
    expect(res._status).toBe(404);
    expect(res._body.error.message).toBe('请求的资源不存在。');
  });

  test('uses default message for UnauthorizedError with no message', () => {
    const res = mockRes();
    const err = new UnauthorizedError();
    errorHandler(err, mockReq(), res, jest.fn());
    expect(res._status).toBe(401);
    expect(res._body.error.message).toBe('未授权的访问。');
  });

  test('uses default message for ForbiddenError with no message', () => {
    const res = mockRes();
    const err = new ForbiddenError();
    errorHandler(err, mockReq(), res, jest.fn());
    expect(res._status).toBe(403);
    expect(res._body.error.message).toBe('没有权限执行此操作。');
  });

  test('statusCode property takes precedence for generic errors', () => {
    const res = mockRes();
    const err = new Error('custom');
    err.statusCode = 418;
    errorHandler(err, mockReq(), res, jest.fn());
    expect(res._status).toBe(418);
  });

  test('statusCode on err.status also works', () => {
    const res = mockRes();
    const err = new Error('custom');
    err.status = 422;
    errorHandler(err, mockReq(), res, jest.fn());
    expect(res._status).toBe(422);
  });
});

describe('errorHandler — dev mode', () => {
  test('dev mode — 500 error includes message and stack details', () => {
    // Reset modules so config mock takes effect, then re-require
    jest.resetModules();
    jest.mock('../config', () => ({ isDev: true }));
    const handlerModule = require('../middleware/errorHandler');
    // Must call init() to reload config (lazy-loaded pattern)
    handlerModule.init();
    const { errorHandler: devHandler } = handlerModule;

    const res = mockRes();
    const err = new Error('dev detail');
    err.stack = 'Error: dev detail\n    at test.js:1:1';
    devHandler(err, mockReq(), res, jest.fn());
    expect(res._status).toBe(500);
    expect(res._body.error.message).toBe('dev detail');
    expect(res._body.error.details).toBe(err.stack);
  });

  test('dev mode — 404 includes details (all errors get details in dev)', () => {
    jest.resetModules();
    jest.mock('../config', () => ({ isDev: true }));
    const handlerModule = require('../middleware/errorHandler');
    handlerModule.init();
    const { errorHandler: devHandler } = handlerModule;

    const res = mockRes();
    const err = new handlerModule.NotFoundError('not found');
    devHandler(err, mockReq(), res, jest.fn());
    expect(res._status).toBe(404);
    expect(res._body.error.details).toBeDefined();
    expect(res._body.error.message).toBe('not found');
  });
});

describe('error classes', () => {
  test('ValidationError properties', () => {
    const err = new ValidationError('bad input');
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('ValidationError');
    expect(err.message).toBe('bad input');
    expect(err.statusCode).toBe(400);
  });

  test('NotFoundError properties', () => {
    const err = new NotFoundError('missing');
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('NotFoundError');
    expect(err.message).toBe('missing');
    expect(err.statusCode).toBe(404);
  });

  test('UnauthorizedError properties', () => {
    const err = new UnauthorizedError('no auth');
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('UnauthorizedError');
    expect(err.message).toBe('no auth');
    expect(err.statusCode).toBe(401);
  });

  test('ForbiddenError properties', () => {
    const err = new ForbiddenError('forbidden');
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('ForbiddenError');
    expect(err.message).toBe('forbidden');
    expect(err.statusCode).toBe(403);
  });
});
