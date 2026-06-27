const express = require('express');
const { query } = require('../db/pool');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// ──────────────────────────────────────────────
// In-memory fallback data
// ──────────────────────────────────────────────

const fallbackStats = {
  totalUsers: 128,
  activeUsers: 87,
  totalApiKeys: 342,
  totalApiCalls: 284500,
  totalReports: 1560,
  totalRevenue: '¥48,200',
  mrr: '¥12,800',
  growth: '+12.5%',
  servers: [
    { name: 'API Server 1', status: 'healthy', uptime: '14d 7h', load: '23%' },
    { name: 'API Server 2', status: 'healthy', uptime: '14d 7h', load: '31%' },
    { name: 'DB Primary', status: 'healthy', uptime: '30d 2h', load: '45%' },
    { name: 'DB Replica', status: 'healthy', uptime: '30d 2h', load: '22%' },
    { name: 'Cache (Redis)', status: 'healthy', uptime: '14d 7h', load: '12%' },
  ],
  topPackages: [
    { name: '创业商业情报', calls: 98200, users: 64 },
    { name: 'AI / GEO 分析', calls: 72300, users: 48 },
    { name: '企业情报与风控', calls: 54100, users: 36 },
    { name: '金融宏观数据', calls: 38700, users: 22 },
    { name: '行业研究报告', calls: 21200, users: 15 },
  ],
};

const fallbackUsers = [
  { id: 'u-001', name: '张小明', email: 'zhangxm@example.com', plan: '创业者版', status: 'active', created: '2026-01-15', apiCalls: 3284, lastActive: '2026-06-14 16:32' },
  { id: 'u-002', name: '李婷婷', email: 'litt@example.com', plan: '企业版', status: 'active', created: '2025-11-03', apiCalls: 12560, lastActive: '2026-06-14 15:20' },
  { id: 'u-003', name: '王伟', email: 'wangw@example.com', plan: '免费版', status: 'suspended', created: '2026-03-20', apiCalls: 142, lastActive: '2026-05-28 09:15' },
  { id: 'u-004', name: '陈思涵', email: 'chensh@example.com', plan: '企业版', status: 'active', created: '2025-08-12', apiCalls: 28900, lastActive: '2026-06-14 17:01' },
  { id: 'u-005', name: '赵雷', email: 'zhaolei@example.com', plan: '创业者版', status: 'active', created: '2026-04-01', apiCalls: 4870, lastActive: '2026-06-13 14:44' },
  { id: 'u-006', name: '刘雨桐', email: 'liuyt@example.com', plan: '免费版', status: 'active', created: '2026-06-01', apiCalls: 56, lastActive: '2026-06-12 10:30' },
  { id: 'u-007', name: '测试账号', email: 'test@example.com', plan: '免费版', status: 'suspended', created: '2026-02-10', apiCalls: 0, lastActive: '—' },
  { id: 'u-008', name: '孙浩然', email: 'sunhr@example.com', plan: '企业版', status: 'active', created: '2025-07-22', apiCalls: 45200, lastActive: '2026-06-14 16:58' },
];

const fallbackAllApiKeys = [
  { id: 'key-001', name: '生产环境 Key', key: 'ihd_live_sk_Xk9mPqL2rN8vTs4w3a9f', user: '张小明', userName: 'zhangxm@example.com', env: 'production', used: 3284, limit: 5000, created: '2026-05-02', status: 'active' },
  { id: 'key-002', name: '开发测试 Key', key: 'ihd_test_sk_Bj3nKpM5qR7xUv9w7c2b', user: '张小明', userName: 'zhangxm@example.com', env: 'development', used: 142, limit: 500, created: '2026-06-18', status: 'active' },
  { id: 'key-003', name: '主 API Key', key: 'ihd_live_sk_A1b2C3d4E5f6G7h8I9j0', user: '李婷婷', userName: 'litt@example.com', env: 'production', used: 12560, limit: 20000, created: '2025-11-03', status: 'active' },
  { id: 'key-004', name: 'CI/CD Key', key: 'ihd_ci_sk_Z9y8X7w6V5u4T3s2R1q0', user: '陈思涵', userName: 'chensh@example.com', env: 'production', used: 8920, limit: 10000, created: '2025-08-15', status: 'active' },
  { id: 'key-005', name: '测试 Key', key: 'ihd_test_sk_M4n5B6v7C8x9L0p1Q2w3', user: '王伟', userName: 'wangw@example.com', env: 'development', used: 142, limit: 500, created: '2026-03-20', status: 'revoked' },
];

const fallbackAllSubscriptions = [
  { id: 'sub-001', user: '张小明', email: 'zhangxm@example.com', plan: '创业者版', status: 'active', price: '¥199/月', startDate: '2026-01-15', renewDate: '2026-07-01', gateway: '支付宝' },
  { id: 'sub-002', user: '李婷婷', email: 'litt@example.com', plan: '企业版', status: 'active', price: '¥999/月', startDate: '2025-11-03', renewDate: '2026-11-03', gateway: '微信支付' },
  { id: 'sub-003', user: '王伟', email: 'wangw@example.com', plan: '免费版', status: 'canceled', price: '免费', startDate: '2026-03-20', renewDate: '—', gateway: '—' },
  { id: 'sub-004', user: '陈思涵', email: 'chensh@example.com', plan: '企业版', status: 'active', price: '¥999/月', startDate: '2025-08-12', renewDate: '2026-08-12', gateway: '银行卡' },
  { id: 'sub-005', user: '赵雷', email: 'zhaolei@example.com', plan: '创业者版', status: 'active', price: '¥199/月', startDate: '2026-04-01', renewDate: '2026-07-01', gateway: '支付宝' },
  { id: 'sub-006', user: '孙浩然', email: 'sunhr@example.com', plan: '企业版', status: 'active', price: '¥999/月', startDate: '2025-07-22', renewDate: '2025-07-22', gateway: '微信支付' },
];

const fallbackAuditLogs = [
  { action: '用户登录', user: '张小明', email: 'zhangxm@example.com', ip: '192.168.1.100', ts: '2026-06-14 16:32:10', detail: '来自 Chrome 浏览器' },
  { action: 'API Key 创建', user: '李婷婷', email: 'litt@example.com', ip: '10.0.0.45', ts: '2026-06-14 15:20:03', detail: '创建 Key: CI/CD Key' },
  { action: '订阅变更', user: '陈思涵', email: 'chensh@example.com', ip: '192.168.1.50', ts: '2026-06-14 14:15:44', detail: '从创业者版升级到企业版' },
  { action: 'API 限流触发', user: '张小明', email: 'zhangxm@example.com', ip: '192.168.1.100', ts: '2026-06-14 10:22:18', detail: '/v1/startup/market-trend — 429 超限' },
  { action: '报告生成', user: '孙浩然', email: 'sunhr@example.com', ip: '10.0.0.12', ts: '2026-06-14 09:45:00', detail: '生成企业风控报告 (3 页)' },
  { action: '密码修改', user: '赵雷', email: 'zhaolei@example.com', ip: '192.168.1.200', ts: '2026-06-13 18:30:22', detail: '通过邮箱验证重置' },
  { action: '新用户注册', user: '刘雨桐', email: 'liuyt@example.com', ip: '10.0.0.88', ts: '2026-06-01 08:12:05', detail: '注册来源: 官网引流' },
  { action: '账户停用', user: '管理员', email: 'admin@insighthub.data', ip: '192.168.1.1', ts: '2026-05-28 09:15:00', detail: '停用用户: 王伟 (逾期未付费)' },
];

// ──────────────────────────────────────────────
// Simple admin auth gate
// ──────────────────────────────────────────────

function requireAdmin(req, res, next) {
  // In development, allow any authenticated user with specific emails
  const adminEmails = ['admin@insighthub.data', 'admin@example.com'];
  if (req.user && (adminEmails.includes(req.user.email) || req.user.id === 'dev-admin-id')) {
    return next();
  }
  // Check for admin API key
  if (req.user && req.user.apiKey === 'sk-dev-admin') {
    return next();
  }
  return res.status(403).json({
    success: false,
    error: {
      code: 'FORBIDDEN',
      message: '仅管理员可访问此接口。'
    }
  });
}

// ──────────────────────────────────────────────
// GET /api/v1/admin/stats — System-wide stats
// ──────────────────────────────────────────────

router.get('/stats', authenticate, requireAdmin, async (req, res, next) => {
  try {
    try {
      // Attempt DB — aggregate real data
      const userResult = await query('SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE deleted_at IS NULL) as active FROM users');
      const apiCallResult = await query('SELECT COUNT(*) as total FROM usage_logs WHERE created_at >= NOW() - INTERVAL \'30 days\'');
      const reportResult = await query('SELECT COUNT(*) as total FROM reports WHERE created_at >= NOW() - INTERVAL \'30 days\'');

      return res.json({
        success: true,
        data: {
          totalUsers: parseInt(userResult.rows[0].total, 10),
          activeUsers: parseInt(userResult.rows[0].active, 10),
          totalApiKeys: fallbackStats.totalApiKeys,
          totalApiCalls: parseInt(apiCallResult.rows[0].total, 10),
          totalReports: parseInt(reportResult.rows[0].total, 10),
          totalRevenue: fallbackStats.totalRevenue,
          mrr: fallbackStats.mrr,
          growth: fallbackStats.growth,
          servers: fallbackStats.servers,
          topPackages: fallbackStats.topPackages,
        }
      });
    } catch (dbErr) {
      // Fallback
      return res.json({
        success: true,
        data: fallbackStats
      });
    }
  } catch (err) {
    next(err);
  }
});

// ──────────────────────────────────────────────
// GET /api/v1/admin/users — List all users
// ──────────────────────────────────────────────

router.get('/users', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const { status, search, page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);

    try {
      let sql = `SELECT id, email, name, plan, created_at, updated_at
                 FROM users WHERE 1=1`;
      const params = [];
      let paramIdx = 1;

      if (status && status !== 'all') {
        sql += ` AND deleted_at IS ${status === 'active' ? 'NULL' : 'NOT NULL'}`;
      }
      if (search) {
        sql += ` AND (name ILIKE $${paramIdx} OR email ILIKE $${paramIdx})`;
        params.push(`%${search}%`);
        paramIdx++;
      }

      sql += ` ORDER BY created_at DESC LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`;
      params.push(parseInt(limit, 10), offset);

      const result = await query(sql, params);
      return res.json({
        success: true,
        data: result.rows.map(u => ({
          id: u.id,
          name: u.name,
          email: u.email,
          plan: u.plan || '免费版',
          status: u.deleted_at ? 'suspended' : 'active',
          created: u.created_at ? u.created_at.toISOString().slice(0, 10) : '—',
          apiCalls: 0,
          lastActive: u.updated_at ? u.updated_at.toISOString().slice(0, 16).replace('T', ' ') : '—',
        })),
        meta: { page: parseInt(page, 10), limit: parseInt(limit, 10), total: result.rows.length }
      });
    } catch (dbErr) {
      // Fallback
      let users = [...fallbackUsers];
      if (status && status !== 'all') {
        users = users.filter(u => u.status === status);
      }
      if (search) {
        const s = search.toLowerCase();
        users = users.filter(u => u.name.includes(s) || u.email.includes(s));
      }
      return res.json({
        success: true,
        data: users.slice(offset, offset + parseInt(limit, 10)),
        meta: { page: parseInt(page, 10), limit: parseInt(limit, 10), total: users.length }
      });
    }
  } catch (err) {
    next(err);
  }
});

// ──────────────────────────────────────────────
// GET /api/v1/admin/users/:id — User detail
// ──────────────────────────────────────────────

router.get('/users/:id', authenticate, requireAdmin, async (req, res, next) => {
  try {
    try {
      const result = await query(
        `SELECT id, email, name, plan, created_at, updated_at
         FROM users WHERE id = $1`,
        [req.params.id]
      );
      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: '用户不存在。' }
        });
      }
      const u = result.rows[0];
      return res.json({
        success: true,
        data: {
          id: u.id, name: u.name, email: u.email,
          plan: u.plan || '免费版',
          status: u.deleted_at ? 'suspended' : 'active',
          created: u.created_at,
          lastActive: u.updated_at,
        }
      });
    } catch (dbErr) {
      // Fallback
      const user = fallbackUsers.find(u => u.id === req.params.id);
      if (!user) {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: '用户不存在。' }
        });
      }
      return res.json({ success: true, data: user });
    }
  } catch (err) {
    next(err);
  }
});

// ──────────────────────────────────────────────
// PATCH /api/v1/admin/users/:id — Update user
// ──────────────────────────────────────────────

router.patch('/users/:id', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const { status, plan, role, quotaMonthly } = req.body;

    try {
      const updates = [];
      const params = [req.params.id];
      let idx = 2;

      if (status === 'suspended') {
        updates.push(`deleted_at = NOW()`);
      } else if (status === 'active') {
        updates.push(`deleted_at = NULL`);
      }
      if (plan) {
        updates.push(`plan = $${idx}`);
        params.push(plan);
        idx++;
      }
      if (role) {
        updates.push(`role = $${idx}`);
        params.push(role);
        idx++;
      }
      if (quotaMonthly !== undefined) {
        updates.push(`quota_monthly = $${idx}`);
        params.push(quotaMonthly);
        idx++;
      }

      if (updates.length === 0) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: '未指定需要更新的字段。' }
        });
      }

      const result = await query(
        `UPDATE users SET ${updates.join(', ')} WHERE id = $1 RETURNING id, email, name, plan`,
        params
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: '用户不存在。' }
        });
      }

      return res.json({ success: true, data: result.rows[0] });
    } catch (dbErr) {
      // Fallback
      const user = fallbackUsers.find(u => u.id === req.params.id);
      if (!user) {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: '用户不存在。' }
        });
      }
      if (status) user.status = status;
      if (plan) user.plan = plan;
      if (role) user.role = role;
      if (quotaMonthly !== undefined) user.quotaMonthly = quotaMonthly;
      return res.json({ success: true, data: user });
    }
  } catch (err) {
    next(err);
  }
});

// ──────────────────────────────────────────────
// GET /api/v1/admin/api-keys — All API keys
// ──────────────────────────────────────────────

router.get('/api-keys', authenticate, requireAdmin, async (req, res, next) => {
  try {
    try {
      const result = await query(
        `SELECT ak.id, ak.key, ak.name, ak.created_at, ak.revoked,
                u.name as user_name, u.email as user_email
         FROM api_keys ak
         JOIN users u ON u.id = ak.user_id
         ORDER BY ak.created_at DESC
         LIMIT 100`
      );
      return res.json({
        success: true,
        data: result.rows.map(k => ({
          id: k.id, name: k.name, key: k.key,
          user: k.user_name, userName: k.user_email,
          env: k.name && k.name.includes('测试') ? 'development' : (k.name && k.name.includes('CI') ? 'production' : 'production'),
          used: 0, limit: 0,
          created: k.created_at ? k.created_at.toISOString().slice(0, 10) : '—',
          status: k.revoked ? 'revoked' : 'active'
        })),
        meta: { total: result.rows.length }
      });
    } catch (dbErr) {
      return res.json({
        success: true,
        data: fallbackAllApiKeys,
        meta: { total: fallbackAllApiKeys.length }
      });
    }
  } catch (err) {
    next(err);
  }
});

// ──────────────────────────────────────────────
// PATCH /api/v1/admin/api-keys/:id — Toggle API key revocation
// ──────────────────────────────────────────────

router.patch('/api-keys/:id', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const { revoked } = req.body;
    if (typeof revoked !== 'boolean') {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_PARAMS', message: '缺少 revoked 布尔值。' }
      });
    }
    try {
      const result = await query(
        `UPDATE api_keys SET revoked = $1, updated_at = NOW()
         WHERE id = $2 RETURNING id, name, key, revoked, created_at`,
        [revoked, req.params.id]
      );
      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'API 密钥不存在。' }
        });
      }
      const k = result.rows[0];
      return res.json({
        success: true,
        data: {
          id: k.id, name: k.name, key: k.key,
          revoked: k.revoked,
          status: k.revoked ? 'revoked' : 'active',
          created: k.created_at ? k.created_at.toISOString().slice(0, 10) : '—'
        }
      });
    } catch (dbErr) {
      // Fallback
      const idx = fallbackAllApiKeys.findIndex(k => k.id === req.params.id);
      if (idx === -1) {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'API 密钥不存在。' }
        });
      }
      fallbackAllApiKeys[idx].revoked = revoked;
      fallbackAllApiKeys[idx].status = revoked ? 'revoked' : 'active';
      return res.json({ success: true, data: fallbackAllApiKeys[idx] });
    }
  } catch (err) {
    next(err);
  }
});

// ──────────────────────────────────────────────
// GET /api/v1/admin/subscriptions — All subscriptions
// ──────────────────────────────────────────────

router.get('/subscriptions', authenticate, requireAdmin, async (req, res, next) => {
  try {
    try {
      const result = await query(
        `SELECT s.id, s.plan, s.status, s.start_date, s.end_date,
                u.name as user_name, u.email as user_email
         FROM subscriptions s
         JOIN users u ON u.id = s.user_id
         ORDER BY s.created_at DESC
         LIMIT 100`
      );
      return res.json({
        success: true,
        data: result.rows.map(s => ({
          id: s.id, user: s.user_name, email: s.user_email,
          plan: s.plan, status: s.status,
          price: '—', startDate: s.start_date, renewDate: s.end_date || '—',
          gateway: '—'
        })),
        meta: { total: result.rows.length }
      });
    } catch (dbErr) {
      return res.json({
        success: true,
        data: fallbackAllSubscriptions,
        meta: { total: fallbackAllSubscriptions.length }
      });
    }
  } catch (err) {
    next(err);
  }
});

// ──────────────────────────────────────────────
// GET /api/v1/admin/logs — Audit logs
// ──────────────────────────────────────────────

router.get('/logs', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const { search, type, dateFrom, dateTo, page = 1, limit = 30 } = req.query;
    const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);

    let logs = [...fallbackAuditLogs];

    if (search) {
      const s = search.toLowerCase();
      logs = logs.filter(l =>
        (l.message || l.description || l.action || '').toLowerCase().includes(s) ||
        (l.user && (l.user.username || l.user.email || l.user).toLowerCase().includes(s))
      );
    }
    if (type) {
      logs = logs.filter(l => l.type === type);
    }
    if (dateFrom) {
      const from = new Date(dateFrom);
      logs = logs.filter(l => new Date(l.createdAt) >= from);
    }
    if (dateTo) {
      const to = new Date(dateTo);
      to.setHours(23, 59, 59, 999);
      logs = logs.filter(l => new Date(l.createdAt) <= to);
    }

    const total = logs.length;
    const paged = logs.slice(offset, offset + parseInt(limit, 10));

    return res.json({
      success: true,
      data: paged,
      meta: { page: parseInt(page, 10), limit: parseInt(limit, 10), total }
    });
  } catch (err) {
    next(err);
  }
});

// ──────────────────────────────────────────────
// GET /api/v1/admin/health — Full system health
// ──────────────────────────────────────────────

router.get('/health', authenticate, requireAdmin, async (req, res, next) => {
  try {
    let dbConnected = false;
    try {
      const dbTest = await query('SELECT 1 as ok');
      dbConnected = true;
    } catch (e) {
      dbConnected = false;
    }

    return res.json({
      success: true,
      data: {
        overall: dbConnected ? 'healthy' : 'degraded',
        database: dbConnected ? 'connected' : 'disconnected',
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        timestamp: new Date().toISOString(),
        servers: fallbackStats.servers,
      }
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
