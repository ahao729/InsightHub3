// ── Config Tests ──
// Tests: default values, production env ADMIN_INVITE_CODE requirement

// Mock dotenv so it does not re-read .env and override test env vars
jest.mock('dotenv', () => ({ config: jest.fn() }));

beforeEach(() => {
  jest.resetModules();
  delete process.env.NODE_ENV;
  delete process.env.ADMIN_INVITE_CODE;
  delete process.env.PORT;
  delete process.env.DATABASE_URL;
  delete process.env.JWT_SECRET;
});

describe('config', () => {
  test('defaults in development mode', () => {
    process.env.NODE_ENV = 'development';
    const config = require('../config');
    expect(config.port).toBe(4000);
    expect(config.isDev).toBe(true);
    expect(config.nodeEnv).toBe('development');
    expect(config.adminInviteCode).toBe('INSIGHTHUB2024');
  });

  test('uses PORT env var', () => {
    process.env.PORT = '8080';
    const config = require('../config');
    expect(config.port).toBe(8080);
  });

  test('uses DATABASE_URL env var', () => {
    process.env.DATABASE_URL = 'postgresql://user:pass@remote:5432/mydb';
    const config = require('../config');
    expect(config.databaseUrl).toBe('postgresql://user:pass@remote:5432/mydb');
  });

  test('ADMIN_INVITE_CODE defaults to INSIGHTHUB2024 in dev', () => {
    process.env.NODE_ENV = 'development';
    const config = require('../config');
    expect(config.adminInviteCode).toBe('INSIGHTHUB2024');
  });

  test('ADMIN_INVITE_CODE from env overrides default', () => {
    process.env.ADMIN_INVITE_CODE = 'MY_CUSTOM_CODE';
    const config = require('../config');
    expect(config.adminInviteCode).toBe('MY_CUSTOM_CODE');
  });

  test('production throws if ADMIN_INVITE_CODE is not set', () => {
    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = 'test-secret';
    process.env.DATABASE_URL = 'postgresql://test:pass@host:5432/db';
    expect(() => require('../config')).toThrow('生产环境必须设置 ADMIN_INVITE_CODE 环境变量');
  });

  test('production works if ADMIN_INVITE_CODE is set', () => {
    process.env.NODE_ENV = 'production';
    process.env.ADMIN_INVITE_CODE = 'prod-code-123';
    process.env.JWT_SECRET = 'test-secret';
    process.env.DATABASE_URL = 'postgresql://test:pass@host:5432/db';
    const config = require('../config');
    expect(config.adminInviteCode).toBe('prod-code-123');
    expect(config.isDev).toBe(false);
  });

  test('has llmProviders with expected keys', () => {
    const config = require('../config');
    expect(config.llmProviders).toHaveProperty('openai');
    expect(config.llmProviders).toHaveProperty('deepseek');
    expect(config.llmProviders).toHaveProperty('anthropic');
    expect(config.llmProviders).toHaveProperty('zhipu');
  });

  test('has email configuration', () => {
    const config = require('../config');
    expect(config.email).toHaveProperty('host');
    expect(config.email).toHaveProperty('port');
    expect(config.email).toHaveProperty('from');
  });

  test('has taskModels with expected keys', () => {
    const config = require('../config');
    expect(config.taskModels).toHaveProperty('fast');
    expect(config.taskModels).toHaveProperty('analysis');
    expect(config.taskModels).toHaveProperty('reasoning');
    expect(config.taskModels).toHaveProperty('embedding');
  });

  test('has modelPricing entries', () => {
    const config = require('../config');
    expect(config.modelPricing).toHaveProperty('gpt-4o');
    expect(config.modelPricing).toHaveProperty('gpt-4o-mini');
    expect(config.modelPricing).toHaveProperty('deepseek-chat');
    expect(config.modelPricing['gpt-4o']).toHaveProperty('input');
    expect(config.modelPricing['gpt-4o']).toHaveProperty('output');
  });

  test('jwtExpiresIn defaults to 7d', () => {
    const config = require('../config');
    expect(config.jwtExpiresIn).toBe('7d');
  });

  test('passwordReset defaults expiryMinutes to 30', () => {
    const config = require('../config');
    expect(config.passwordReset.expiryMinutes).toBe(30);
  });

  test('tokenTrackingEnabled defaults to true', () => {
    const config = require('../config');
    expect(config.tokenTrackingEnabled).toBe(true);
  });

  test('dailyTokenLimit defaults to 1000000', () => {
    const config = require('../config');
    expect(config.dailyTokenLimit).toBe(1000000);
  });

  test('userDailyTokenLimit defaults to 100000', () => {
    const config = require('../config');
    expect(config.userDailyTokenLimit).toBe(100000);
  });

  test('embeddingDimensions defaults to 1536', () => {
    const config = require('../config');
    expect(config.embeddingDimensions).toBe(1536);
  });

  // ── Production env validation ──

  test('production throws if JWT_SECRET is missing', () => {
    process.env.NODE_ENV = 'production';
    process.env.ADMIN_INVITE_CODE = 'test';
    process.env.DATABASE_URL = 'postgresql://valid:url@host:5432/db';
    // JWT_SECRET intentionally left unset (cleared in beforeEach)
    expect(() => require('../config')).toThrow('JWT_SECRET');
  });

  test('production throws if DATABASE_URL is missing', () => {
    process.env.NODE_ENV = 'production';
    process.env.ADMIN_INVITE_CODE = 'test';
    process.env.JWT_SECRET = 'my-secret';
    // DATABASE_URL intentionally left unset (cleared in beforeEach)
    expect(() => require('../config')).toThrow('DATABASE_URL');
  });

  test('production throws if multiple env vars are missing', () => {
    process.env.NODE_ENV = 'production';
    process.env.ADMIN_INVITE_CODE = 'test';
    // Both JWT_SECRET and DATABASE_URL left unset
    expect(() => require('../config')).toThrow('JWT_SECRET');
    expect(() => require('../config')).toThrow('DATABASE_URL');
  });

  test('production works if all required env vars are set', () => {
    process.env.NODE_ENV = 'production';
    process.env.ADMIN_INVITE_CODE = 'prod-code-123';
    process.env.JWT_SECRET = 'prod-jwt-secret';
    process.env.DATABASE_URL = 'postgresql://prod:pass@prod-host:5432/proddb';
    const config = require('../config');
    expect(config.isDev).toBe(false);
    expect(config.jwtSecret).toBe('prod-jwt-secret');
    expect(config.databaseUrl).toBe('postgresql://prod:pass@prod-host:5432/proddb');
  });

  test('non-production does not throw validation errors', () => {
    process.env.NODE_ENV = 'development';
    delete process.env.JWT_SECRET;
    delete process.env.DATABASE_URL;
    expect(() => require('../config')).not.toThrow();
  });

  test('PORT of "not-a-number" falls back to 4000', () => {
    process.env.PORT = 'not-a-number';
    const config = require('../config');
    expect(config.port).toBe(4000);
  });

  test('isDev is false in production', () => {
    process.env.NODE_ENV = 'production';
    process.env.ADMIN_INVITE_CODE = 'test';
    process.env.JWT_SECRET = 'test-secret';
    process.env.DATABASE_URL = 'postgresql://test:pass@host:5432/db';
    const config = require('../config');
    expect(config.isDev).toBe(false);
  });
});
