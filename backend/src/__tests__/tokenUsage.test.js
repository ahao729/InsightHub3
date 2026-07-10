jest.mock('../db/pool');
jest.mock('../config', () => ({
  tokenTrackingEnabled: true,
  dailyTokenLimit: 1000000,
  userDailyTokenLimit: 100000,
  modelPricing: {
    'gpt-4o': { input: 0.01, output: 0.03 },
    'deepseek-chat': { input: 0.001, output: 0.002 },
  },
  models: { embedding: 'text-embedding-3-small' },
}));

const { query } = require('../db/pool');
const tokenUsage = require('../services/tokenUsage');

jest.useFakeTimers();

beforeEach(() => {
  jest.clearAllMocks();
  jest.clearAllTimers();

  // Reset the singleton state for a clean slate
  tokenUsage.buffer = [];
  tokenUsage.enabled = true;
  tokenUsage.dailyLimit = 1000000;
  tokenUsage.userDailyLimit = 100000;
  tokenUsage.pricing = {
    'gpt-4o': { input: 0.01, output: 0.03 },
    'deepseek-chat': { input: 0.001, output: 0.002 },
  };

  // Tear down any flush interval from the previous test
  if (tokenUsage.flushInterval) {
    clearInterval(tokenUsage.flushInterval);
    tokenUsage.flushInterval = null;
  }

  // Start a fresh flush interval (under fake timers this just registers a
  // pending timer — it never actually fires unless we advance the clock)
  tokenUsage._startFlushInterval();
});

afterEach(() => {
  if (tokenUsage.flushInterval) {
    clearInterval(tokenUsage.flushInterval);
    tokenUsage.flushInterval = null;
  }
  jest.clearAllMocks();
});

// ── track() ──────────────────────────────────────────────────────────────

describe('track', () => {
  it('records input/output tokens and calculates cost', () => {
    const result = tokenUsage.track({
      userId: 'user-abc',
      model: 'gpt-4o',
      inputTokens: 500,
      outputTokens: 200,
      taskType: 'analysis',
      packageCode: 'startup-123',
    });

    expect(result.tracked).toBe(true);
    expect(result.totalTokens).toBe(700);
    // (500/1000)*0.01 + (200/1000)*0.03 = 0.005 + 0.006 = 0.011
    expect(result.costUsd).toBeCloseTo(0.011, 6);
    expect(result.record).toBeDefined();
    expect(result.record.user_id).toBe('user-abc');
    expect(result.record.model).toBe('gpt-4o');
    expect(result.record.input_tokens).toBe(500);
    expect(result.record.output_tokens).toBe(200);
    expect(result.record.total_tokens).toBe(700);
    expect(result.record.task_type).toBe('analysis');
    expect(result.record.package_code).toBe('startup-123');
    expect(result.record.cost_usd).toBeCloseTo(0.011, 6);
    expect(result.record.timestamp).toBeInstanceOf(Date);
  });

  it('returns tracked: false when tracking is disabled', () => {
    tokenUsage.enabled = false;

    const result = tokenUsage.track({
      model: 'gpt-4o',
      inputTokens: 100,
      outputTokens: 50,
    });

    expect(result.tracked).toBe(false);
    expect(tokenUsage.buffer.length).toBe(0);
  });

  it('handles missing optional fields with defaults', () => {
    const result = tokenUsage.track({});

    expect(result.tracked).toBe(true);
    expect(result.record.user_id).toBeNull();
    expect(result.record.model).toBe('unknown');
    expect(result.record.input_tokens).toBe(0);
    expect(result.record.output_tokens).toBe(0);
    expect(result.record.total_tokens).toBe(0);
    expect(result.record.task_type).toBe('general');
    expect(result.record.package_code).toBeNull();
  });

  it('adds the record to the in-memory buffer', () => {
    tokenUsage.track({
      userId: 'u1',
      model: 'gpt-4o',
      inputTokens: 10,
      outputTokens: 5,
    });

    expect(tokenUsage.buffer.length).toBe(1);
    expect(tokenUsage.buffer[0].user_id).toBe('u1');
  });
});

// ── trackEmbedding() ─────────────────────────────────────────────────────

describe('trackEmbedding', () => {
  it('delegates to track with taskType=embedding and given model', () => {
    const trackSpy = jest.spyOn(tokenUsage, 'track');

    tokenUsage.trackEmbedding({
      userId: 'u1',
      model: 'text-embedding-3-small',
      inputTokens: 200,
      packageCode: 'patent-007',
    });

    expect(trackSpy).toHaveBeenCalledTimes(1);
    expect(trackSpy).toHaveBeenCalledWith({
      userId: 'u1',
      model: 'text-embedding-3-small',
      inputTokens: 200,
      outputTokens: 0,
      taskType: 'embedding',
      packageCode: 'patent-007',
    });
  });

  it('uses config.models.embedding when no model is provided', () => {
    const trackSpy = jest.spyOn(tokenUsage, 'track');

    tokenUsage.trackEmbedding({
      userId: 'u2',
      inputTokens: 100,
    });

    expect(trackSpy).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'text-embedding-3-small' }),
    );
  });
});

// ── _calculateCost() ─────────────────────────────────────────────────────

describe('_calculateCost', () => {
  it('calculates cost for gpt-4o correctly', () => {
    const cost = tokenUsage._calculateCost('gpt-4o', 1000, 500);
    // (1000/1000)*0.01 + (500/1000)*0.03 = 0.01 + 0.015 = 0.025
    expect(cost).toBeCloseTo(0.025, 6);
  });

  it('calculates cost for deepseek-chat correctly', () => {
    const cost = tokenUsage._calculateCost('deepseek-chat', 2000, 1000);
    // (2000/1000)*0.001 + (1000/1000)*0.002 = 0.002 + 0.002 = 0.004
    expect(cost).toBeCloseTo(0.004, 6);
  });

  it('returns 0 for an unknown model', () => {
    const cost = tokenUsage._calculateCost('unknown-model', 1000, 500);
    expect(cost).toBe(0);
  });

  it('returns 0 when input and output tokens are both 0', () => {
    const cost = tokenUsage._calculateCost('gpt-4o', 0, 0);
    expect(cost).toBe(0);
  });
});

// ── _getTimeFilter() ─────────────────────────────────────────────────────

describe('_getTimeFilter', () => {
  it('returns a filter for "today"', () => {
    const filter = tokenUsage._getTimeFilter('today');
    expect(filter).toContain('CURRENT_DATE');
  });

  it('returns a filter for "this_week"', () => {
    const filter = tokenUsage._getTimeFilter('this_week');
    expect(filter).toContain("date_trunc('week'");
  });

  it('returns a filter for "this_month"', () => {
    const filter = tokenUsage._getTimeFilter('this_month');
    expect(filter).toContain("date_trunc('month'");
  });

  it('returns an empty string for "all"', () => {
    expect(tokenUsage._getTimeFilter('all')).toBe('');
  });

  it('defaults to today for an unrecognised period', () => {
    const filter = tokenUsage._getTimeFilter('invalid-period');
    expect(filter).toContain('CURRENT_DATE');
  });
});

// ── getUserStats() ───────────────────────────────────────────────────────

describe('getUserStats', () => {
  const baseRow = {
    total_requests: '5',
    total_input_tokens: '1000',
    total_output_tokens: '500',
    total_tokens: '1500',
    total_cost_usd: '0.025',
  };

  it('returns parsed aggregated stats from the database', async () => {
    query.mockResolvedValueOnce({ rows: [baseRow] });

    const stats = await tokenUsage.getUserStats('user-1', 'today');

    expect(stats.totalRequests).toBe(5);
    expect(stats.totalInputTokens).toBe(1000);
    expect(stats.totalOutputTokens).toBe(500);
    expect(stats.totalTokens).toBe(1500);
    expect(stats.totalCostUsd).toBeCloseTo(0.025, 6);
    expect(stats.remainingDailyTokens).toBe(98500); // 100000 - 1500

    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('FROM token_usage'),
      ['user-1'],
    );
    expect(query.mock.calls[0][0]).toContain('CURRENT_DATE');
  });

  it('accepts period "this_week" and includes the correct time filter', async () => {
    query.mockResolvedValueOnce({ rows: [baseRow] });

    await tokenUsage.getUserStats('user-1', 'this_week');
    expect(query.mock.calls[0][0]).toContain("date_trunc('week'");
  });

  it('accepts period "this_month" and includes the correct time filter', async () => {
    query.mockResolvedValueOnce({ rows: [baseRow] });

    await tokenUsage.getUserStats('user-1', 'this_month');
    expect(query.mock.calls[0][0]).toContain("date_trunc('month'");
  });

  it('accepts period "all" with no time filter', async () => {
    query.mockResolvedValueOnce({ rows: [baseRow] });

    await tokenUsage.getUserStats('user-1', 'all');
    expect(query.mock.calls[0][0]).not.toMatch(/AND timestamp/);
  });

  it('defaults to "today" when no period is provided', async () => {
    query.mockResolvedValueOnce({
      rows: [{
        ...baseRow,
        total_requests: '0',
        total_tokens: '0',
        total_cost_usd: '0',
      }],
    });

    const stats = await tokenUsage.getUserStats('user-1');
    expect(stats.totalTokens).toBe(0);
    expect(query.mock.calls[0][0]).toContain('CURRENT_DATE');
  });

  it('returns fallback empty stats when the database query fails', async () => {
    query.mockRejectedValueOnce(new Error('connection lost'));

    const stats = await tokenUsage.getUserStats('user-1', 'today');

    expect(stats.totalRequests).toBe(0);
    expect(stats.totalInputTokens).toBe(0);
    expect(stats.totalOutputTokens).toBe(0);
    expect(stats.totalTokens).toBe(0);
    expect(stats.totalCostUsd).toBe(0);
    expect(stats.remainingDailyTokens).toBe(tokenUsage.userDailyLimit);
  });
});

// ── getGlobalStats() ─────────────────────────────────────────────────────

describe('getGlobalStats', () => {
  const baseRow = {
    total_requests: '100',
    total_tokens: '50000',
    total_cost_usd: '1.25',
    active_users: '10',
  };

  it('returns aggregated admin stats from the database', async () => {
    query.mockResolvedValueOnce({ rows: [baseRow] });

    const stats = await tokenUsage.getGlobalStats('today');

    expect(stats.totalRequests).toBe(100);
    expect(stats.totalTokens).toBe(50000);
    expect(stats.totalCostUsd).toBeCloseTo(1.25, 6);
    expect(stats.activeUsers).toBe(10);
    expect(stats.remainingDailyLimit).toBe(950000); // 1000000 - 50000

    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('FROM token_usage'),
      [],
    );
  });

  it('accepts period "all" with no time filter', async () => {
    query.mockResolvedValueOnce({ rows: [baseRow] });

    await tokenUsage.getGlobalStats('all');
    expect(query.mock.calls[0][0]).not.toMatch(/AND timestamp/);
  });

  it('returns fallback empty stats when the database query fails', async () => {
    query.mockRejectedValueOnce(new Error('timeout'));

    const stats = await tokenUsage.getGlobalStats('today');

    expect(stats.totalRequests).toBe(0);
    expect(stats.totalTokens).toBe(0);
    expect(stats.totalCostUsd).toBe(0);
    expect(stats.activeUsers).toBe(0);
    expect(stats.remainingDailyLimit).toBe(tokenUsage.dailyLimit);
  });
});

// ── isUserRateLimited() ──────────────────────────────────────────────────

describe('isUserRateLimited', () => {
  it('returns false when totalTokens < userDailyLimit', async () => {
    query.mockResolvedValueOnce({
      rows: [{
        total_requests: '3',
        total_input_tokens: '200',
        total_output_tokens: '100',
        total_tokens: '300',
        total_cost_usd: '0.01',
      }],
    });

    const limited = await tokenUsage.isUserRateLimited('user-1');
    expect(limited).toBe(false);
  });

  it('returns true when totalTokens >= userDailyLimit', async () => {
    query.mockResolvedValueOnce({
      rows: [{
        total_requests: '999',
        total_input_tokens: '80000',
        total_output_tokens: '20000',
        total_tokens: '100000',
        total_cost_usd: '1.0',
      }],
    });

    const limited = await tokenUsage.isUserRateLimited('user-1');
    expect(limited).toBe(true);
  });

  it('passes the userId to getUserStats', async () => {
    query.mockResolvedValueOnce({
      rows: [{
        total_requests: '0', total_input_tokens: '0', total_output_tokens: '0',
        total_tokens: '0', total_cost_usd: '0',
      }],
    });

    await tokenUsage.isUserRateLimited('specific-user-id');
    expect(query.mock.calls[0][1]).toEqual(['specific-user-id']);
  });
});

// ── isGloballyRateLimited() ──────────────────────────────────────────────

describe('isGloballyRateLimited', () => {
  it('returns false when totalTokens < dailyLimit', async () => {
    query.mockResolvedValueOnce({
      rows: [{
        total_requests: '10', total_tokens: '50000',
        total_cost_usd: '1.0', active_users: '2',
      }],
    });

    const limited = await tokenUsage.isGloballyRateLimited();
    expect(limited).toBe(false);
  });

  it('returns true when totalTokens >= dailyLimit', async () => {
    query.mockResolvedValueOnce({
      rows: [{
        total_requests: '999', total_tokens: '1000000',
        total_cost_usd: '100', active_users: '50',
      }],
    });

    const limited = await tokenUsage.isGloballyRateLimited();
    expect(limited).toBe(true);
  });
});

// ── flush() ──────────────────────────────────────────────────────────────

describe('flush', () => {
  it('does nothing when the buffer is empty', async () => {
    await tokenUsage.flush();
    expect(query).not.toHaveBeenCalled();
  });

  it('inserts buffered records and clears the buffer on success', async () => {
    query.mockResolvedValueOnce({ rows: [] });

    tokenUsage.track({ model: 'gpt-4o', inputTokens: 10, outputTokens: 5 });
    tokenUsage.track({ model: 'deepseek-chat', inputTokens: 20, outputTokens: 10 });

    expect(tokenUsage.buffer.length).toBe(2);

    await tokenUsage.flush();

    expect(query).toHaveBeenCalledTimes(1);
    const [sql, params] = query.mock.calls[0];
    expect(sql).toContain('INSERT INTO token_usage');
    expect(sql).toContain('VALUES');
    // 2 records × 11 params each
    expect(params.length).toBe(22);
    expect(tokenUsage.buffer.length).toBe(0);
  });

  it('re-buffers records when the database insert fails', async () => {
    query.mockRejectedValueOnce(new Error('DB write failed'));

    tokenUsage.track({ model: 'gpt-4o', inputTokens: 50, outputTokens: 25 });
    expect(tokenUsage.buffer.length).toBe(1);

    await tokenUsage.flush();

    // Buffer should still contain the record (re-buffered on failure)
    expect(tokenUsage.buffer.length).toBe(1);
    expect(tokenUsage.buffer[0].model).toBe('gpt-4o');
  });
});
