/**
 * Token Usage Tracker
 * Tracks LLM token consumption per request, per user, per model.
 * Supports cost calculation, daily/monthly aggregation, and DB persistence.
 */

const config = require('../config');
const { query } = require('../db/pool');

class TokenUsageTracker {
  constructor() {
    this.enabled = config.tokenTrackingEnabled !== false;
    this.dailyLimit = config.dailyTokenLimit || 1000000;
    this.userDailyLimit = config.userDailyTokenLimit || 100000;
    this.pricing = config.modelPricing || {};

    // In-memory buffer for recent usage (flushed periodically to DB)
    this.buffer = [];
    this.flushInterval = null;

    if (this.enabled) {
      this._startFlushInterval();
    }
  }

  /**
   * Record token usage for an LLM call.
   * @param {Object} params
   * @param {string} params.userId - User UUID (optional for anonymous)
   * @param {string} params.model - Model name (e.g. 'gpt-4o', 'deepseek-chat')
   * @param {number} params.inputTokens - Input/prompt tokens
   * @param {number} params.outputTokens - Output/completion tokens
   * @param {string} params.taskType - Type of task (e.g. 'analysis', 'classification', 'embedding')
   * @param {string} params.packageCode - Data package code (optional)
   * @returns {Object} Usage record with cost info
   */
  track({ userId, model, inputTokens, outputTokens, taskType, packageCode }) {
    if (!this.enabled) {
      return { tracked: false };
    }

    const totalTokens = (inputTokens || 0) + (outputTokens || 0);
    const cost = this._calculateCost(model, inputTokens || 0, outputTokens || 0);

    const record = {
      user_id: userId || null,
      model: model || 'unknown',
      input_tokens: inputTokens || 0,
      output_tokens: outputTokens || 0,
      total_tokens: totalTokens,
      cost_usd: parseFloat(cost.toFixed(8)),
      task_type: taskType || 'general',
      package_code: packageCode || null,
      timestamp: new Date(),
    };

    // Add to buffer
    this.buffer.push(record);

    return {
      tracked: true,
      totalTokens,
      costUsd: cost,
      record,
    };
  }

  /**
   * Track embedding token usage (typically just input tokens).
   */
  trackEmbedding({ userId, model, inputTokens, packageCode }) {
    return this.track({
      userId,
      model: model || config.models.embedding,
      inputTokens,
      outputTokens: 0,
      taskType: 'embedding',
      packageCode,
    });
  }

  /**
   * Get token usage stats for a user within a time range.
   * @param {string} userId - User UUID
   * @param {string} period - 'today' | 'this_week' | 'this_month' | 'all'
   * @returns {Promise<Object>} Aggregated usage stats
   */
  async getUserStats(userId, period = 'today') {
    const timeFilter = this._getTimeFilter(period);

    try {
      const result = await query(
        `SELECT
           COUNT(*) as total_requests,
           COALESCE(SUM(input_tokens), 0) as total_input_tokens,
           COALESCE(SUM(output_tokens), 0) as total_output_tokens,
           COALESCE(SUM(total_tokens), 0) as total_tokens,
           COALESCE(SUM(cost_usd), 0) as total_cost_usd
         FROM token_usage
         WHERE user_id = $1${timeFilter ? ` AND timestamp ${timeFilter}` : ''}`,
        [userId]
      );

      const row = result.rows[0];
      return {
        totalRequests: parseInt(row.total_requests, 10),
        totalInputTokens: parseInt(row.total_input_tokens, 10),
        totalOutputTokens: parseInt(row.total_output_tokens, 10),
        totalTokens: parseInt(row.total_tokens, 10),
        totalCostUsd: parseFloat(row.total_cost_usd),
        remainingDailyTokens: Math.max(0, this.userDailyLimit - parseInt(row.total_tokens, 10)),
      };
    } catch (err) {
      console.warn('[TokenUsage] DB query failed:', err.message);
      // Return empty stats as fallback
      return {
        totalRequests: 0,
        totalInputTokens: 0,
        totalOutputTokens: 0,
        totalTokens: 0,
        totalCostUsd: 0,
        remainingDailyTokens: this.userDailyLimit,
      };
    }
  }

  /**
   * Get global token usage stats (admin).
   */
  async getGlobalStats(period = 'today') {
    const timeFilter = this._getTimeFilter(period);

    try {
      const result = await query(
        `SELECT
           COUNT(*) as total_requests,
           COALESCE(SUM(total_tokens), 0) as total_tokens,
           COALESCE(SUM(cost_usd), 0) as total_cost_usd,
           COUNT(DISTINCT user_id) as active_users
         FROM token_usage
         WHERE 1=1${timeFilter ? ` AND timestamp ${timeFilter}` : ''}`,
        []
      );

      const row = result.rows[0];
      return {
        totalRequests: parseInt(row.total_requests, 10),
        totalTokens: parseInt(row.total_tokens, 10),
        totalCostUsd: parseFloat(row.total_cost_usd),
        activeUsers: parseInt(row.active_users, 10),
        remainingDailyLimit: Math.max(0, this.dailyLimit - parseInt(row.total_tokens, 10)),
      };
    } catch (err) {
      console.warn('[TokenUsage] Global stats DB query failed:', err.message);
      return {
        totalRequests: 0,
        totalTokens: 0,
        totalCostUsd: 0,
        activeUsers: 0,
        remainingDailyLimit: this.dailyLimit,
      };
    }
  }

  /**
   * Check if a user has exceeded their daily token limit.
   */
  async isUserRateLimited(userId) {
    const stats = await this.getUserStats(userId, 'today');
    return stats.totalTokens >= this.userDailyLimit;
  }

  /**
   * Check if the global daily token limit has been exceeded.
   */
  async isGloballyRateLimited() {
    const stats = await this.getGlobalStats('today');
    return stats.totalTokens >= this.dailyLimit;
  }

  /**
   * Flush buffered usage records to the database.
   */
  async flush() {
    if (this.buffer.length === 0) return;

    const records = this.buffer.splice(0);
    console.log(`[TokenUsage] Flushing ${records.length} usage records to DB`);

    try {
      const values = [];
      const paramGroups = [];

      records.forEach((r, i) => {
        const offset = i * 11;
        paramGroups.push(
          `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7}, $${offset + 8}, $${offset + 9}, $${offset + 10}, $${offset + 11})`
        );
        values.push(
          r.user_id, r.model, r.input_tokens, r.output_tokens,
          r.total_tokens, r.cost_usd, r.task_type, r.package_code,
          r.timestamp, r.timestamp, r.timestamp
        );
      });

      await query(
        `INSERT INTO token_usage
           (user_id, model, input_tokens, output_tokens, total_tokens, cost_usd, task_type, package_code, timestamp, created_at, updated_at)
         VALUES ${paramGroups.join(', ')}`,
        values
      );
    } catch (err) {
      console.warn(`[TokenUsage] Failed to flush to DB: ${err.message}`);
      // Re-buffer on failure
      this.buffer.unshift(...records);
    }
  }

  /**
   * Calculate cost for a given model and token counts.
   */
  _calculateCost(model, inputTokens, outputTokens) {
    const pricing = this.pricing[model];
    if (!pricing) return 0;

    const inputCost = (inputTokens / 1000) * (pricing.input || 0);
    const outputCost = (outputTokens / 1000) * (pricing.output || 0);
    return inputCost + outputCost;
  }

  /**
   * Get SQL time filter clause for a given period.
   */
  _getTimeFilter(period) {
    switch (period) {
      case 'today':
        return ">= CURRENT_DATE AND timestamp < CURRENT_DATE + INTERVAL '1 day'";
      case 'this_week':
        return ">= date_trunc('week', CURRENT_DATE)";
      case 'this_month':
        return ">= date_trunc('month', CURRENT_DATE)";
      case 'all':
        return '';
      default:
        return ">= CURRENT_DATE AND timestamp < CURRENT_DATE + INTERVAL '1 day'";
    }
  }

  /**
   * Start periodic flush to database (every 30 seconds).
   */
  _startFlushInterval() {
    this.flushInterval = setInterval(() => {
      this.flush().catch(err => {
        console.error('[TokenUsage] Flush error:', err.message);
      });
    }, 30000); // 30 seconds

    // Allow process to exit even if interval is active
    if (this.flushInterval.unref) {
      this.flushInterval.unref();
    }
  }
}

// Singleton instance
const tokenUsageTracker = new TokenUsageTracker();

module.exports = tokenUsageTracker;
