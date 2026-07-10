const express = require('express');
const { query } = require('../db/pool');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// In-memory fallback plans (matching schema.sql seed)
const fallbackPlans = [
  {
    id: 'plan-free-001',
    name: '免费版',
    code: 'free',
    price_monthly: 0,
    price_yearly: 0,
    requests_per_month: 1000,
    requests_per_minute: 10,
    features: ['基础数据访问', '每日10次API调用', '社区支持'],
  },
  {
    id: 'plan-pro-001',
    name: '专业版',
    code: 'pro',
    price_monthly: 299,
    price_yearly: 2990,
    requests_per_month: 50000,
    requests_per_minute: 100,
    features: ['全部数据包访问', '高级搜索过滤', 'AI报告生成', '邮件支持', 'API密钥管理'],
  },
  {
    id: 'plan-ent-001',
    name: '企业版',
    code: 'enterprise',
    price_monthly: 999,
    price_yearly: 9990,
    requests_per_month: 500000,
    requests_per_minute: 1000,
    features: ['全部数据包访问', '高级搜索过滤', 'AI报告生成', '优先技术支持', '自定义集成', 'SLA保障', '专属客户经理'],
  },
];

const fallbackSubscriptions = new Map();

// GET /api/v1/subscriptions/plans
router.get('/plans', async (req, res, next) => {
  try {
    try {
      const result = await query(
        'SELECT * FROM subscription_plans ORDER BY price_monthly ASC'
      );
      return res.json({
        success: true,
        data: result.rows,
        meta: { total: result.rows.length }
      });
    } catch (dbErr) {
      // Fallback
      return res.json({
        success: true,
        data: fallbackPlans,
        meta: { total: fallbackPlans.length }
      });
    }
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/subscriptions/current
router.get('/current', authenticate, async (req, res, next) => {
  try {
    try {
      const result = await query(
        `SELECT s.*, sp.name as plan_name, sp.code as plan_code, sp.price_monthly, sp.price_yearly,
                sp.requests_per_month, sp.requests_per_minute, sp.features
         FROM subscriptions s
         JOIN subscription_plans sp ON sp.id = s.plan_id
         WHERE s.user_id = $1 AND s.status = 'active'
         ORDER BY s.created_at DESC LIMIT 1`,
        [req.user.id]
      );

      if (result.rows.length === 0) {
        // Return free plan as default
        return res.json({
          success: true,
          data: {
            plan: fallbackPlans[0],
            status: 'active',
            isDefault: true,
          }
        });
      }

      return res.json({
        success: true,
        data: result.rows[0]
      });
    } catch (dbErr) {
      // Fallback
      const sub = fallbackSubscriptions.get(req.user.id);
      if (sub) {
        return res.json({ success: true, data: sub });
      }
      // Default to free plan
      return res.json({
        success: true,
        data: {
          plan: fallbackPlans[0],
          status: 'active',
          isDefault: true,
        }
      });
    }
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/subscriptions/subscribe
router.post('/subscribe', authenticate, async (req, res, next) => {
  try {
    const { plan_code } = req.body;

    if (!plan_code) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: '请提供套餐代码 (plan_code)。' }
      });
    }

    const validCodes = ['free', 'pro', 'enterprise'];
    if (!validCodes.includes(plan_code)) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: '无效的套餐代码。支持: free, pro, enterprise' }
      });
    }

    try {
      // Get plan
      const planResult = await query(
        'SELECT * FROM subscription_plans WHERE code = $1',
        [plan_code]
      );

      if (planResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: '套餐不存在。' }
        });
      }

      const plan = planResult.rows[0];

      // Cancel existing active subscriptions
      await query(
        `UPDATE subscriptions SET status = 'cancelled'
         WHERE user_id = $1 AND status = 'active'`,
        [req.user.id]
      );

      // Create new subscription
      const now = new Date();
      const endDate = new Date(now);
      endDate.setMonth(endDate.getMonth() + 1);

      const result = await query(
        `INSERT INTO subscriptions (user_id, plan_id, status, current_period_start, current_period_end)
         VALUES ($1, $2, 'active', $3, $4)
         RETURNING *`,
        [req.user.id, plan.id, now, endDate]
      );

      return res.status(201).json({
        success: true,
        data: {
          subscription: result.rows[0],
          plan: plan,
        }
      });
    } catch (dbErr) {
      // Fallback (in-memory only — will be lost on restart; TODO: queue for DB sync)
      const plan = fallbackPlans.find(p => p.code === plan_code);
      if (!plan) {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: '套餐不存在。' }
        });
      }

      const now = new Date();
      const endDate = new Date(now);
      endDate.setMonth(endDate.getMonth() + 1);

      fallbackSubscriptions.set(req.user.id, {
        id: 'sub-' + req.user.id,
        user_id: req.user.id,
        plan_id: plan.id,
        status: 'active',
        current_period_start: now.toISOString(),
        current_period_end: endDate.toISOString(),
        plan_name: plan.name,
        plan_code: plan.code,
        ...plan,
      });

      return res.status(201).json({
        success: true,
        data: fallbackSubscriptions.get(req.user.id)
      });
    }
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/subscriptions/cancel
router.post('/cancel', authenticate, async (req, res, next) => {
  try {
    try {
      const result = await query(
        `UPDATE subscriptions SET status = 'cancelled'
         WHERE user_id = $1 AND status = 'active'
         RETURNING *`,
        [req.user.id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: '没有活跃的订阅。' }
        });
      }

      return res.json({
        success: true,
        data: { subscription: result.rows[0], status: 'cancelled' }
      });
    } catch (dbErr) {
      // Fallback
      if (fallbackSubscriptions.has(req.user.id)) {
        const sub = fallbackSubscriptions.get(req.user.id);
        sub.status = 'cancelled';
        return res.json({
          success: true,
          data: { subscription: sub, status: 'cancelled' }
        });
      }
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: '没有活跃的订阅。' }
      });
    }
  } catch (err) {
    next(err);
  }
});

module.exports = router;
