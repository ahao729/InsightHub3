const mockQuery = jest.fn();

jest.mock('../config', () => ({
  tokenTrackingEnabled: true,
  dailyTokenLimit: 1000000,
  userDailyTokenLimit: 100000,
  modelPricing: {
    'openai/gpt-4o': { input: 0.01, output: 0.03 },
    'deepseek/deepseek-chat': { input: 0.001, output: 0.002 },
  },
  isDev: false,
  models: { embedding: 'text-embedding-3-small' },
}));

jest.mock('../db/pool', () => ({
  query: (...args) => mockQuery(...args),
}));

const tokenUsage = require('../services/tokenUsage');

beforeEach(() => {
  jest.clearAllMocks();
  tokenUsage.buffer = [];
  tokenUsage.enabled = true;
  tokenUsage.dailyLimit = 1000000;
  tokenUsage.userDailyLimit = 100000;
  tokenUsage.pricing = {
    'openai/gpt-4o': { input: 0.01, output: 0.03 },
    'deepseek/deepseek-chat': { input: 0.001, output: 0.002 },
  };
  // Clear any flush interval
  if (tokenUsage.flushInterval) {
    clearInterval(tokenUsage.flushInterval);
    tokenUsage.flushInterval = null;
  }
});

afterAll(() => {
  if (tokenUsage.flushInterval) {
    clearInterval(tokenUsage.flushInterval);
    tokenUsage.flushInterval = null;
  }
});

describe('TokenUsageTracker', () => {
  // ── track ────────────────────────────────────────────
  describe('track', () => {
    it('should record usage and return cost info', () => {
      const result = tokenUsage.track({
        userId: 'user-1',
        model: 'openai/gpt-4o',
        inputTokens: 500,
        outputTokens: 200,
        taskType: 'analysis',
        packageCode: 'startup',
      });

      expect(result.tracked).toBe(true);
      expect(result.totalTokens).toBe(700);
      expect(result.costUsd).toBeCloseTo(0.005 + 0.006); // (500/1000)*0.01 + (200/1000)*0.03
      expect(result.record).toBeDefined();
      expect(result.record.user_id).toBe('user-1');
      expect(result.record.model).toBe('openai/gpt-4o');
      expect(result.record.input_tokens).toBe(500);
      expect(result.record.output_tokens).toBe(200);
      expect(result.record.total_tokens).toBe(700);
      expect(result.record.task_type).toBe('analysis');
      expect(result.record.package_code).toBe('startup');
    });

    it('should not track when disabled', () => {
      tokenUsage.enabled = false;

      const result = tokenUsage.track({
        userId: 'user-1',
        model: 'openai/gpt-4o',
        inputTokens: 100,
        outputTokens: 50,
      });

      expect(result.tracked).toBe(false);
      expect(tokenUsage.buffer.length).toBe(0);
    });

    it('should handle missing optional fields gracefully', () => {
      const result = tokenUsage.track({});

      expect(result.tracked).toBe(true);
      expect(result.record.user_id).toBeNull();
      expect(result.record.model).toBe('unknown');
      expect(result.record.task_type).toBe('general');
      expect(result.record.package_code).toBeNull();
    });

    it('should buffer the record', () => {
      tokenUsage.track({
        userId: 'u1',
        model: 'm1',
        inputTokens: 10,
        outputTokens: 5,
      });

      expect(tokenUsage.buffer.length).toBe(1);
      expect(tokenUsage.buffer[0].user_id).toBe('u1');
    });

    it('should calculate cost as 0 for unknown model', () => {
      const result = tokenUsage.track({
        model: 'unknown/model',
        inputTokens: 1000,
        outputTokens: 500,
      });

      expect(result.costUsd).toBe(0);
    });
  });

  // ── trackEmbedding ────────────────────────────────────
  describe('trackEmbedding', () => {
    it('should delegate to track with embedding task type', () => {
      const trackSpy = jest.spyOn(tokenUsage, 'track');

      tokenUsage.trackEmbedding({
        userId: 'u1',
        model: 'text-embedding-3-small',
        inputTokens: 200,
        packageCode: 'patent',
      });

      expect(trackSpy).toHaveBeenCalledWith({
        userId: 'u1',
        model: 'text-embedding-3-small',
        inputTokens: 200,
        outputTokens: 0,
        taskType: 'embedding',
        packageCode: 'patent',
      });
    });

    it('should use default embedding model when model is not provided', () => {
      const trackSpy = jest.spyOn(tokenUsage, 'track');

      tokenUsage.trackEmbedding({
        userId: 'u1',
        inputTokens: 100,
      });

      expect(trackSpy).toHaveBeenCalledWith(
        expect.objectContaining({ model: 'text-embedding-3-small' }),
      );
    });
  });

  // ── _calculateCost ──────────────────────────────────────
  describe('_calculateCost', () => {
    it('should calculate cost based on pricing config', () => {
      const cost = tokenUsage._calculateCost('openai/gpt-4o', 1000, 500);
      // (1000/1000)*0.01 + (500/1000)*0.03 = 0.01 + 0.015 = 0.025
      expect(cost).toBeCloseTo(0.025);
    });

    it('should return 0 for unknown model', () => {
      expect(tokenUsage._calculateCost('unknown', 100, 100)).toBe(0);
    });

    it('should handle zero tokens', () => {
      const cost = tokenUsage._calculateCost('openai/gpt-4o', 0, 0);
      expect(cost).toBe(0);
    });
  });

  // ── _getTimeFilter ─────────────────────────────────────
  describe('_getTimeFilter', () => {
    it('should return today filter', () => {
      const filter = tokenUsage._getTimeFilter('today');
      expect(filter).toContain('CURRENT_DATE');
    });

    it('should return this_week filter', () => {
      const filter = tokenUsage._getTimeFilter('this_week');
      expect(filter).toContain("date_trunc('week'");
    });

    it('should return this_month filter', () => {
      const filter = tokenUsage._getTimeFilter('this_month');
      expect(filter).toContain("date_trunc('month'");
    });

    it('should return empty for all', () => {
      expect(tokenUsage._getTimeFilter('all')).toBe('');
    });

    it('should default to today for unknown period', () => {
      const filter = tokenUsage._getTimeFilter('unknown');
      expect(filter).toContain('CURRENT_DATE');
    });
  });

  // ── getUserStats ─────────────────────────────────────
  describe('getUserStats', () => {
    it('should return aggregated stats from DB', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{
          total_requests: '5',
          total_input_tokens: '1000',
          total_output_tokens: '500',
          total_tokens: '1500',
          total_cost_usd: '0.025',
        }],
      });

      const stats = await tokenUsage.getUserStats('user-1', 'today');

      expect(stats.totalRequests).toBe(5);
      expect(stats.totalInputTokens).toBe(1000);
      expect(stats.totalOutputTokens).toBe(500);
      expect(stats.totalTokens).toBe(1500);
      expect(stats.totalCostUsd).toBeCloseTo(0.025);
      expect(stats.remainingDailyTokens).toBe(98500); // 100000 - 1500
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('FROM token_usage'),
        ['user-1'],
      );
    });

    it('should default to today period', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ total_requests: '0', total_input_tokens: '0', total_output_tokens: '0', total_tokens: '0', total_cost_usd: '0' }],
      });

      const stats = await tokenUsage.getUserStats('user-1');
      expect(stats.totalRequests).toBe(0);
    });

    it('should return fallback stats on DB error', async () => {
      mockQuery.mockRejectedValueOnce(new Error('DB connection lost'));

      const stats = await tokenUsage.getUserStats('user-1', 'today');

      expect(stats.totalRequests).toBe(0);
      expect(stats.totalTokens).toBe(0);
      expect(stats.remainingDailyTokens).toBe(100000);
    });

    it('should include time filter for non-all periods', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ total_requests: '0', total_input_tokens: '0', total_output_tokens: '0', total_tokens: '0', total_cost_usd: '0' }],
      });

      await tokenUsage.getUserStats('user-1', 'this_month');
      expect(mockQuery.mock.calls[0][0]).toContain("date_trunc('month'");
    });
  });

  // ── getGlobalStats ─────────────────────────────────
  describe('getGlobalStats', () => {
    it('should return aggregated global stats', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{
          total_requests: '100',
          total_tokens: '50000',
          total_cost_usd: '1.25',
          active_users: '10',
        }],
      });

      const stats = await tokenUsage.getGlobalStats('today');

      expect(stats.totalRequests).toBe(100);
      expect(stats.totalTokens).toBe(50000);
      expect(stats.totalCostUsd).toBeCloseTo(1.25);
      expect(stats.activeUsers).toBe(10);
      expect(stats.remainingDailyLimit).toBe(950000); // 1000000 - 50000
    });

    it('should return fallback stats on DB error', async () => {
      mockQuery.mockRejectedValueOnce(new Error('timeout'));

      const stats = await tokenUsage.getGlobalStats('today');

      expect(stats.totalRequests).toBe(0);
      expect(stats.activeUsers).toBe(0);
      expect(stats.remainingDailyLimit).toBe(1000000);
    });

    it('should not include time filter for all period', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ total_requests: '0', total_tokens: '0', total_cost_usd: '0', active_users: '0' }],
      });

      await tokenUsage.getGlobalStats('all');
      // Should not contain "AND timestamp"
      expect(mockQuery.mock.calls[0][0]).not.toMatch(/AND timestamp/);
    });
  });

  // ── isUserRateLimited ────────────────────────────────
  describe('isUserRateLimited', () => {
    it('should return false when user is under limit', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ total_requests: '1', total_input_tokens: '100', total_output_tokens: '50', total_tokens: '150', total_cost_usd: '0.005' }],
      });

      const limited = await tokenUsage.isUserRateLimited('user-1');
      expect(limited).toBe(false);
    });

    it('should return true when user exceeds limit', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ total_requests: '999', total_input_tokens: '99999', total_output_tokens: '1', total_tokens: '100000', total_cost_usd: '1.0' }],
      });

      const limited = await tokenUsage.isUserRateLimited('user-1');
      expect(limited).toBe(true);
    });

    it('should use today period by default', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ total_requests: '0', total_input_tokens: '0', total_output_tokens: '0', total_tokens: '0', total_cost_usd: '0' }],
      });

      await tokenUsage.isUserRateLimited('user-1');
      // Should query with today filter
      expect(mockQuery.mock.calls[0][0]).toContain('CURRENT_DATE');
    });
  });

  // ── isGloballyRateLimited ─────────────────────────────
  describe('isGloballyRateLimited', () => {
    it('should return false when under global limit', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ total_requests: '10', total_tokens: '50000', total_cost_usd: '1.0', active_users: '2' }],
      });

      const limited = await tokenUsage.isGloballyRateLimited();
      expect(limited).toBe(false);
    });

    it('should return true when global limit exceeded', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ total_requests: '999', total_tokens: '1000000', total_cost_usd: '100', active_users: '50' }],
      });

      const limited = await tokenUsage.isGloballyRateLimited();
      expect(limited).toBe(true);
    });
  });

  // ── flush ────────────────────────────────────────────
  describe('flush', () => {
    it('should do nothing when buffer is empty', async () => {
      await tokenUsage.flush();
      expect(mockQuery).not.toHaveBeenCalled();
    });

    it('should insert buffered records to DB', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      tokenUsage.track({ model: 'm1', inputTokens: 10, outputTokens: 5 });
      tokenUsage.track({ model: 'm2', inputTokens: 20, outputTokens: 10 });

      await tokenUsage.flush();

      expect(mockQuery).toHaveBeenCalledTimes(1);
      const [sql] = mockQuery.mock.calls[0];
      expect(sql).toContain('INSERT INTO token_usage');
      expect(sql).toContain('VALUES'); // Should have param groups
      expect(tokenUsage.buffer.length).toBe(0); // Buffer cleared
    });

    it('should re-buffer records on DB failure', async () => {
      mockQuery.mockRejectedValueOnce(new Error('DB error'));

      tokenUsage.track({ model: 'm1', inputTokens: 10, outputTokens: 5 });
      expect(tokenUsage.buffer.length).toBe(1);

      await tokenUsage.flush();

      // Records should be back in buffer
      expect(tokenUsage.buffer.length).toBe(1);
      expect(tokenUsage.buffer[0].model).toBe('m1');
    });
  });
});
