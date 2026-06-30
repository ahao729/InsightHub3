const express = require('express');
const { authenticate } = require('../middleware/auth');
const ragService = require('../services/ragService');
const tokenUsage = require('../services/tokenUsage');

const router = express.Router();

// ──────────────────────────────────────────────
// POST /api/v1/analyze/rag
// RAG 分析查询：检索数据包上下文 + LLM 合成
// ──────────────────────────────────────────────

router.post('/rag', authenticate, async (req, res, next) => {
  try {
    const { query, packageCode, filters = {}, topK = 5, analysisType = 'summary' } = req.body;

    if (!query || !query.trim()) {
      return res.status(400).json({
        success: false,
        error: '查询内容不能为空',
      });
    }

    if (!packageCode) {
      return res.status(400).json({
        success: false,
        error: '必须指定数据包代码（packageCode）',
      });
    }

    const result = await ragService.query({
      query,
      packageCode,
      filters,
      topK,
      analysisType,
      userId: req.user.id,
    });

    if (!result.success) {
      return res.status(404).json({
        success: false,
        error: result.error || '分析失败',
        context: result.context || [],
        usage: result.usage,
      });
    }

    return res.json({
      success: true,
      data: {
        analysis: result.analysis,
        contextCount: result.contextCount,
        model: result.model,
        usage: result.usage,
        traceId: result.traceId,
      },
    });
  } catch (err) {
    next(err);
  }
});

// ──────────────────────────────────────────────
// POST /api/v1/analyze/quick
// 快速分析：直接对传入数据进行分析（无 RAG 检索）
// ──────────────────────────────────────────────

router.post('/quick', authenticate, async (req, res, next) => {
  try {
    const { query, data, packageCode, analysisType = 'summary' } = req.body;

    if (!query || !query.trim()) {
      return res.status(400).json({ success: false, error: '查询内容不能为空' });
    }

    if (!data || !Array.isArray(data) || data.length === 0) {
      return res.status(400).json({ success: false, error: '必须提供待分析的数据（data 数组）' });
    }

    const result = await ragService.quickAnalyze({
      query,
      data,
      packageCode: packageCode || 'general',
      analysisType,
      userId: req.user.id,
    });

    if (!result.success) {
      return res.status(500).json({ success: false, error: result.error });
    }

    return res.json({
      success: true,
      data: {
        analysis: result.analysis,
        dataCount: result.dataCount,
        model: result.model,
        usage: result.usage,
      },
    });
  } catch (err) {
    next(err);
  }
});

// ──────────────────────────────────────────────
// POST /api/v1/analyze/compare
// 对比分析：比较数据包中的多个条目
// ──────────────────────────────────────────────

router.post('/compare', authenticate, async (req, res, next) => {
  try {
    const { items, packageCode, dimension } = req.body;

    if (!items || !Array.isArray(items) || items.length < 2) {
      return res.status(400).json({ success: false, error: '至少需要 2 个条目进行比较' });
    }

    const result = await ragService.compare({
      items,
      packageCode: packageCode || 'general',
      dimension,
      userId: req.user.id,
    });

    if (!result.success) {
      return res.status(500).json({ success: false, error: result.error });
    }

    return res.json({
      success: true,
      data: {
        analysis: result.analysis,
        model: result.model,
        usage: result.usage,
      },
    });
  } catch (err) {
    next(err);
  }
});

// ──────────────────────────────────────────────
// GET /api/v1/analyze/token-usage
// 查看当前用户的 Token 用量统计
// ──────────────────────────────────────────────

router.get('/token-usage', authenticate, async (req, res, next) => {
  try {
    const period = req.query.period || 'today';

    const stats = await tokenUsage.getUserStats(req.user.id, period);
    const isLimited = await tokenUsage.isUserRateLimited(req.user.id);

    return res.json({
      success: true,
      data: {
        ...stats,
        isRateLimited: isLimited,
        dailyLimit: tokenUsage.userDailyLimit,
      },
    });
  } catch (err) {
    next(err);
  }
});

// ──────────────────────────────────────────────
// GET /api/v1/analyze/admin/token-usage
// 管理员：查看全局 Token 用量统计
// ──────────────────────────────────────────────

router.get('/admin/token-usage', authenticate, async (req, res, next) => {
  try {
    // TODO: 添加管理员权限检查
    const period = req.query.period || 'today';

    const stats = await tokenUsage.getGlobalStats(period);
    const isLimited = await tokenUsage.isGloballyRateLimited();

    return res.json({
      success: true,
      data: {
        ...stats,
        isRateLimited: isLimited,
        globalDailyLimit: tokenUsage.dailyLimit,
      },
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
