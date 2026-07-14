// ── Database Pool Tests ──
// Tests: getPool singleton, query, testConnection

/* ── Mocks ── */
const mockRelease = jest.fn();
const mockClientQuery = jest.fn();
const mockConnect = jest.fn(() => Promise.resolve({ query: mockClientQuery, release: mockRelease }));
const mockPoolOn = jest.fn();

let PoolConstructorArgs = null;

jest.mock('pg', () => {
  return {
    Pool: jest.fn().mockImplementation((opts) => {
      PoolConstructorArgs = opts;
      return {
        connect: mockConnect,
        on: mockPoolOn,
      };
    }),
  };
});

jest.mock('../config', () => ({
  databaseUrl: 'postgresql://test:test@localhost:5432/testdb',
}));

beforeEach(() => {
  jest.clearAllMocks();
  jest.resetModules();
});

/* ── Tests ── */
describe('getPool', () => {
  test('creates pool with correct config on first call', async () => {
    // Fresh require
    const { getPool } = require('../db/pool');
    const pool = getPool();
    expect(pool).toBeDefined();
    expect(PoolConstructorArgs).toMatchObject({
      connectionString: 'postgresql://test:test@localhost:5432/testdb',
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });
    expect(mockPoolOn).toHaveBeenCalledWith('error', expect.any(Function));
  });

  test('returns same pool instance on subsequent calls (singleton)', () => {
    const { getPool } = require('../db/pool');
    const pool1 = getPool();
    const pool2 = getPool();
    expect(pool1).toBe(pool2);
    // Pool constructor should only be called once
    const { Pool } = require('pg');
    expect(Pool).toHaveBeenCalledTimes(1);
  });
});

describe('query', () => {
  test('executes query and releases client', async () => {
    mockClientQuery.mockResolvedValue({ rows: [{ now: '2026-01-01' }], rowCount: 1 });
    const { query } = require('../db/pool');

    const result = await query('SELECT NOW()', []);

    expect(mockConnect).toHaveBeenCalled();
    expect(mockClientQuery).toHaveBeenCalledWith('SELECT NOW()', []);
    expect(mockRelease).toHaveBeenCalled();
    expect(result).toEqual({ rows: [{ now: '2026-01-01' }], rowCount: 1 });
  });

  test('releases client even on query error', async () => {
    mockClientQuery.mockRejectedValue(new Error('query failed'));
    const { query } = require('../db/pool');

    await expect(query('BAD SQL', [])).rejects.toThrow('query failed');
    expect(mockRelease).toHaveBeenCalled();
  });

  test('passes params correctly to pg client', async () => {
    mockClientQuery.mockResolvedValue({ rows: [{ id: 1 }] });
    const { query } = require('../db/pool');

    await query('SELECT * FROM users WHERE id = $1', [1]);
    expect(mockClientQuery).toHaveBeenCalledWith('SELECT * FROM users WHERE id = $1', [1]);
  });
});

describe('testConnection', () => {
  test('returns connected=true with time on success', async () => {
    mockClientQuery.mockResolvedValue({ rows: [{ current_time: '2026-07-01T12:00:00Z' }] });
    const { testConnection } = require('../db/pool');

    const result = await testConnection();
    expect(result.connected).toBe(true);
    expect(result.time).toBe('2026-07-01T12:00:00Z');
    expect(mockRelease).toHaveBeenCalled();
  });

  test('returns connected=false with error on failure', async () => {
    mockClientQuery.mockRejectedValue(new Error('ECONNREFUSED'));
    const { testConnection } = require('../db/pool');

    const result = await testConnection();
    expect(result.connected).toBe(false);
    expect(result.error).toBe('ECONNREFUSED');
  });

  test('releases client after successful test', async () => {
    mockClientQuery.mockResolvedValue({ rows: [{ current_time: 'now' }] });
    const { testConnection } = require('../db/pool');

    await testConnection();
    expect(mockRelease).toHaveBeenCalledTimes(1);
  });
});

describe('pool error event', () => {
  test('error event handler logs to console.error', () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const { getPool } = require('../db/pool');
    getPool(); // trigger pool creation so pool.on('error', handler) is called
    // Get the error handler that was registered
    const errorHandler = mockPoolOn.mock.calls.find(call => call[0] === 'error')[1];

    const testErr = new Error('unexpected pool error');
    errorHandler(testErr);

    expect(consoleSpy).toHaveBeenCalledWith('[DB] Unexpected pool error:', 'unexpected pool error');
    consoleSpy.mockRestore();
  });
});
