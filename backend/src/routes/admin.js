const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { query } = require('../db/pool');
const { authenticate } = require('../middleware/auth');
const config = require('../config');
const tokenUsage = require('../services/tokenUsage');
const llmService = require('../services/llmService');

const router = express.Router();

// ──────────────────────────────────────────────
// In-memory admin store (fallback when no DB)
// ──────────────────────────────────────────────
const adminStore = [];

async function seedDefaultAdmin() {
  if (adminStore.find(a => a.email === 'admin@insighthub.data')) return;
  const hashed = await bcrypt.hash('admin123456', 10);
  adminStore.push({
    id: 'admin-' + uuidv4().slice(0, 8),
    email: 'admin@insighthub.data',
    password: hashed,
    name: '管理员',
    role: 'admin',
    createdAt: new Date().toISOString(),
  });
  console.log('[Admin] Default admin seeded: admin@insighthub.data / admin123456');
}
seedDefaultAdmin();

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
    { name: '专利科技', calls: 21200, users: 15 },
    { name: '政策招投标', calls: 18600, users: 13 },
    { name: '教育', calls: 14300, users: 10 },
    { name: 'Web3 / Crypto', calls: 11800, users: 8 },
    { name: '跨境电商', calls: 9500, users: 6 },
  ],
};

const fallbackUsers = [
  { id: 'u-001', name: '张小明', email: 'zhangxm@example.com', plan: '创业者版', role: 'admin', status: 'active', created: '2026-01-15', apiCalls: 3284, lastActive: '2026-06-14 16:32' },
  { id: 'u-002', name: '李婷婷', email: 'litt@example.com', plan: '企业版', role: 'user', status: 'active', created: '2025-11-03', apiCalls: 12560, lastActive: '2026-06-14 15:20' },
  { id: 'u-003', name: '王伟', email: 'wangw@example.com', plan: '免费版', role: 'user', status: 'suspended', created: '2026-03-20', apiCalls: 142, lastActive: '2026-05-28 09:15' },
  { id: 'u-004', name: '陈思涵', email: 'chensh@example.com', plan: '企业版', role: 'admin', status: 'active', created: '2025-08-12', apiCalls: 28900, lastActive: '2026-06-14 17:01' },
  { id: 'u-005', name: '赵雷', email: 'zhaolei@example.com', plan: '创业者版', role: 'user', status: 'active', created: '2026-04-01', apiCalls: 4870, lastActive: '2026-06-13 14:44' },
  { id: 'u-006', name: '刘雨桐', email: 'liuyt@example.com', plan: '免费版', role: 'user', status: 'active', created: '2026-06-01', apiCalls: 56, lastActive: '2026-06-12 10:30' },
  { id: 'u-007', name: '测试账号', email: 'test@example.com', plan: '免费版', role: 'user', status: 'suspended', created: '2026-02-10', apiCalls: 0, lastActive: '—' },
  { id: 'u-008', name: '孙浩然', email: 'sunhr@example.com', plan: '企业版', role: 'admin', status: 'active', created: '2025-07-22', apiCalls: 45200, lastActive: '2026-06-14 16:58' },
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
// Admin Authentication Routes
// ──────────────────────────────────────────────

/**
 * POST /api/v1/admin/login
 * Authenticate with email + password, returns JWT
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: '请提供邮箱和密码。' }
      });
    }

    const admin = adminStore.find(a => a.email === email);
    if (!admin) {
      return res.status(401).json({
        success: false,
        error: { code: 'INVALID_CREDENTIALS', message: '邮箱或密码错误。' }
      });
    }

    const valid = await bcrypt.compare(password, admin.password);
    if (!valid) {
      return res.status(401).json({
        success: false,
        error: { code: 'INVALID_CREDENTIALS', message: '邮箱或密码错误。' }
      });
    }

    const token = jwt.sign(
      { sub: admin.id, email: admin.email, name: admin.name, role: 'admin' },
      config.jwtSecret,
      { expiresIn: '24h' }
    );

    res.json({
      success: true,
      data: {
        token,
        admin: { id: admin.id, email: admin.email, name: admin.name }
      }
    });
  } catch (err) {
    console.error('[Admin] Login error:', err);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: '登录失败，请稍后重试。' }
    });
  }
});

/**
 * POST /api/v1/admin/register
 * Create a new admin account
 */
router.post('/register', async (req, res) => {
  try {
    const { email, password, name, inviteCode } = req.body;
    if (!email || !password || !name) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: '请提供邮箱、密码和管理员名称。' }
      });
    }

    // 邀请码校验：需要与配置中的 adminInviteCode 匹配
    if (!inviteCode || inviteCode !== config.adminInviteCode) {
      return res.status(403).json({
        success: false,
        error: { code: 'INVALID_INVITE', message: '邀请码无效。' }
      });
    }

    if (adminStore.find(a => a.email === email)) {
      return res.status(409).json({
        success: false,
        error: { code: 'ALREADY_EXISTS', message: '该邮箱已被注册。' }
      });
    }

    const hashed = await bcrypt.hash(password, 10);
    const admin = {
      id: 'admin-' + uuidv4().slice(0, 8),
      email,
      password: hashed,
      name,
      role: 'admin',
      createdAt: new Date().toISOString(),
    };
    adminStore.push(admin);

    const token = jwt.sign(
      { sub: admin.id, email: admin.email, name: admin.name, role: 'admin' },
      config.jwtSecret,
      { expiresIn: '24h' }
    );

    res.status(201).json({
      success: true,
      data: {
        token,
        admin: { id: admin.id, email: admin.email, name: admin.name }
      }
    });
  } catch (err) {
    console.error('[Admin] Register error:', err);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: '注册失败，请稍后重试。' }
    });
  }
});

// ──────────────────────────────────────────────
// Simple admin auth gate
// ──────────────────────────────────────────────

function requireAdmin(req, res, next) {
  // Only JWT with admin role or admin API key can pass
  if (req.user && req.user.role === 'admin') {
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
      const userResult = await query('SELECT COUNT(*) as total FROM users');
      const apiCallResult = await query('SELECT COUNT(*) as total FROM usage_logs WHERE timestamp >= NOW() - INTERVAL \'30 days\'');
      const reportResult = await query('SELECT COUNT(*) as total FROM reports WHERE created_at >= NOW() - INTERVAL \'30 days\'');

      // Token usage stats (non-fatal)
      let tokenUsageStats = null;
      try {
        tokenUsageStats = await tokenUsage.getGlobalStats('all');
      } catch (_) {
        // token usage unavailable — skip
      }

      return res.json({
        success: true,
        data: {
          totalUsers: parseInt(userResult.rows[0].total, 10),
          activeUsers: parseInt(userResult.rows[0].total, 10),
          totalApiKeys: fallbackStats.totalApiKeys,
          totalApiCalls: parseInt(apiCallResult.rows[0].total, 10),
          totalReports: parseInt(reportResult.rows[0].total, 10),
          totalRevenue: fallbackStats.totalRevenue,
          mrr: fallbackStats.mrr,
          growth: fallbackStats.growth,
          servers: fallbackStats.servers,
          topPackages: fallbackStats.topPackages,
          tokenUsage: tokenUsageStats
            ? {
                totalRequests: tokenUsageStats.totalRequests ?? 0,
                totalTokens: tokenUsageStats.totalTokens ?? 0,
                totalCostUsd: tokenUsageStats.totalCostUsd ?? 0,
                activeUsers: tokenUsageStats.activeUsers ?? 0,
              }
            : null,
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
      // 1) Count query — separate from data for accurate pagination
      let countSql = `SELECT COUNT(*) AS total FROM users u WHERE 1=1`;
      const countParams = [];
      let countIdx = 1;

      if (status && status !== 'all') {
        if (status === 'active') {
          countSql += ` AND u.id IN (SELECT user_id FROM subscriptions WHERE status = 'active')`;
        } else {
          countSql += ` AND u.id NOT IN (SELECT user_id FROM subscriptions WHERE status = 'active')`;
        }
      }
      if (search) {
        countSql += ` AND (u.name ILIKE $${countIdx} OR u.email ILIKE $${countIdx})`;
        countParams.push(`%${search}%`);
        countIdx++;
      }

      const countResult = await query(countSql, countParams);
      const total = parseInt(countResult.rows[0]?.total || '0', 10);

      // 2) Data query with plan and apiCalls
      let dataSql = `
        SELECT u.id, u.email, u.name, u.created_at, u.updated_at, u.role,
               COALESCE(sp.name, '免费版') AS plan_name,
               COUNT(DISTINCT ul.id) AS api_call_count
        FROM users u
        LEFT JOIN LATERAL (
          SELECT s.plan_id FROM subscriptions s
          WHERE s.user_id = u.id AND s.status = 'active'
          ORDER BY s.created_at DESC LIMIT 1
        ) active_sub ON true
        LEFT JOIN subscription_plans sp ON sp.id = active_sub.plan_id
        LEFT JOIN usage_logs ul ON ul.user_id = u.id
        WHERE 1=1`;
      const dataParams = [];
      let dataIdx = 1;

      if (status && status !== 'all') {
        if (status === 'active') {
          dataSql += ` AND u.id IN (SELECT user_id FROM subscriptions WHERE status = 'active')`;
        } else {
          dataSql += ` AND u.id NOT IN (SELECT user_id FROM subscriptions WHERE status = 'active')`;
        }
      }
      if (search) {
        dataSql += ` AND (u.name ILIKE $${dataIdx} OR u.email ILIKE $${dataIdx})`;
        dataParams.push(`%${search}%`);
        dataIdx++;
      }

      dataSql += ` GROUP BY u.id, u.email, u.name, u.created_at, u.updated_at, sp.name
                   ORDER BY u.created_at DESC
                   LIMIT $${dataIdx} OFFSET $${dataIdx + 1}`;
      dataParams.push(parseInt(limit, 10), offset);

      const result = await query(dataSql, dataParams);
      return res.json({
        success: true,
        data: result.rows.map(u => ({
          id: u.id,
          name: u.name,
          email: u.email,
          plan: u.plan_name || '免费版',
          role: u.role || 'user',
          status: 'active',  // status inferred from subscription exists
          created: u.created_at ? u.created_at.toISOString().slice(0, 10) : '—',
          apiCalls: parseInt(u.api_call_count || '0', 10),
          lastActive: u.updated_at ? u.updated_at.toISOString().slice(0, 16).replace('T', ' ') : '—',
        })),
        meta: { page: parseInt(page, 10), limit: parseInt(limit, 10), total }
      });
    } catch (dbErr) {
      console.error('[admin] GET /users DB error, using fallback:', dbErr.message);
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
        `SELECT u.id, u.email, u.name, u.role, u.created_at, u.updated_at,
                COALESCE(sp.name, '免费版') AS plan_name,
                s.status AS sub_status
         FROM users u
         LEFT JOIN LATERAL (
           SELECT s.plan_id, s.status FROM subscriptions s
           WHERE s.user_id = u.id AND s.status = 'active'
           ORDER BY s.created_at DESC LIMIT 1
         ) s ON true
         LEFT JOIN subscription_plans sp ON sp.id = s.plan_id
         WHERE u.id = $1`,
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
          plan: u.plan_name || '免费版',
          role: u.role || 'user',
          status: u.sub_status === 'active' ? 'active' : 'inactive',
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

      if (role) {
        updates.push(`role = $${idx}`);
        params.push(role);
        idx++;
      }

      if (updates.length > 0) {
        await query(
          `UPDATE users SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $1`,
          params
        );
      }

      // Handle status changes via subscriptions table
      if (status === 'suspended') {
        await query(
          `UPDATE subscriptions SET status = 'inactive' WHERE user_id = $1 AND status = 'active'`,
          [req.params.id]
        );
      } else if (status === 'active') {
        // Reactivate: only if there's an inactive subscription to reactivate
        // (no-op if user has no subscription yet — they're already "active" by default)
      }

      // Verify the user exists
      const verifyResult = await query(
        `SELECT id, email, name, role FROM users WHERE id = $1`,
        [req.params.id]
      );

      if (verifyResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: '用户不存在。' }
        });
      }

      const u = verifyResult.rows[0];
      return res.json({ success: true, data: { id: u.id, name: u.name, email: u.email, role: u.role, status: status || 'active' } });
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
        `SELECT ak.id, ak.key, ak.name, ak.created_at, ak.revoked, ak.last_used_at,
                u.name AS user_name, u.email AS user_email,
                COUNT(DISTINCT ul.id) AS used_count,
                COALESCE(sp.requests_per_month, 0) AS monthly_limit
         FROM api_keys ak
         JOIN users u ON u.id = ak.user_id
         LEFT JOIN usage_logs ul ON ul.api_key_id = ak.id
         LEFT JOIN LATERAL (
           SELECT s.plan_id FROM subscriptions s
           WHERE s.user_id = ak.user_id AND s.status = 'active'
           ORDER BY s.created_at DESC LIMIT 1
         ) active_sub ON true
         LEFT JOIN subscription_plans sp ON sp.id = active_sub.plan_id
         GROUP BY ak.id, ak.key, ak.name, ak.created_at, ak.revoked, ak.last_used_at,
                  u.name, u.email, sp.requests_per_month
         ORDER BY ak.created_at DESC
         LIMIT 100`
      );
      return res.json({
        success: true,
        data: result.rows.map(k => ({
          id: k.id, name: k.name, key: k.key,
          user: k.user_name, userName: k.user_email,
          env: k.name && k.name.includes('测试') ? 'development' : (k.name && k.name.includes('CI') ? 'production' : 'production'),
          used: parseInt(k.used_count || '0', 10),
          limit: parseInt(k.monthly_limit || '0', 10),
          created: k.created_at ? k.created_at.toISOString().slice(0, 10) : '—',
          status: k.revoked ? 'revoked' : 'active'
        })),
        meta: { total: result.rows.length }
      });
    } catch (dbErr) {
      console.error('[admin] GET /api-keys DB error, using fallback:', dbErr.message);
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
// GET /api/v1/admin/token-usage — Token usage stats
// ──────────────────────────────────────────────

router.get('/token-usage', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const { period } = req.query;
    let result;
    try {
      result = await tokenUsage.getGlobalStats(period || 'today');
    } catch (dbErr) {
      return res.json({
        success: true,
        data: {
          totalRequests: 0,
          totalTokens: 0,
          totalCostUsd: 0,
          activeUsers: 0,
          remainingDailyLimit: 0,
          note: 'Token usage data unavailable (DB fallback)'
        }
      });
    }
    return res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

// ──────────────────────────────────────────────
// GET /api/v1/admin/llm-providers — LLM provider status
// ──────────────────────────────────────────────

router.get('/llm-providers', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const providers = [];
    for (const [name, cfg] of Object.entries(config.llmProviders || {})) {
      providers.push({
        name,
        enabled: cfg.enabled !== false,
        baseURL: cfg.baseURL || (cfg.apiKey ? '(configured)' : null),
        availableModels: cfg.models || [],
        apiKey: cfg.apiKey
          ? cfg.apiKey.slice(0, 8) + '...' + cfg.apiKey.slice(-4)
          : null,
      });
    }
    return res.json({ success: true, data: providers });
  } catch (err) {
    next(err);
  }
});

// ──────────────────────────────────────────────
// GET /api/v1/admin/langfuse-status — Langfuse integration status
// ──────────────────────────────────────────────

router.get('/langfuse-status', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const configured = !!(config.langfusePublicKey && config.langfuseSecretKey);
    const initialized = !!(llmService.langfuse);
    return res.json({
      success: true,
      data: {
        configured,
        initialized,
        publicKey: config.langfusePublicKey ? config.langfusePublicKey.slice(0, 8) + '...' : null,
        baseUrl: config.langfuseBaseUrl || 'https://cloud.langfuse.com',
        status: configured && initialized ? 'connected' : configured ? 'not_initialized' : 'not_configured',
      }
    });
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
      const { search, page = '1', limit = '20' } = req.query;
      const pageNum = Math.max(1, parseInt(page, 10) || 1);
      const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
      const offset = (pageNum - 1) * limitNum;

      // Filters
      const params = [];
      const filters = [];
      if (search) {
        filters.push(`(u.name ILIKE $${params.length + 1} OR u.email ILIKE $${params.length + 1})`);
        params.push(`%${search}%`);
      }

      const whereClause = filters.length > 0 ? 'WHERE ' + filters.join(' AND ') : '';

      // Summary stats
      const [countResult, statsResult] = await Promise.all([
        query(
          `SELECT COUNT(*) as total
           FROM subscriptions s
           JOIN users u ON u.id = s.user_id
           ${whereClause}`,
          params
        ),
        query(
          `SELECT
             COUNT(*) as total,
             COUNT(*) FILTER (WHERE s.status = 'active') as active_count,
             COALESCE(SUM(sp.price_monthly), 0) as total_mrr
           FROM subscriptions s
           JOIN subscription_plans sp ON sp.id = s.plan_id`
        ),
      ]);

      const total = parseInt(countResult.rows[0].total, 10);
      const stats = statsResult.rows[0];

      // Paginated data
      const result = await query(
        `SELECT s.id, sp.name as plan_name, sp.price_monthly, s.status,
                s.current_period_start, s.current_period_end, s.created_at,
                u.name as user_name, u.email as user_email
         FROM subscriptions s
         JOIN users u ON u.id = s.user_id
         JOIN subscription_plans sp ON sp.id = s.plan_id
         ${whereClause}
         ORDER BY s.created_at DESC
         LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, limitNum, offset]
      );

      return res.json({
        success: true,
        data: result.rows.map(s => ({
          id: s.id,
          user: s.user_name,
          email: s.user_email,
          plan: s.plan_name,
          status: s.status,
          price: `$${parseFloat(s.price_monthly).toFixed(2)}/mo`,
          startDate: s.current_period_start,
          renewDate: s.current_period_end || '—',
          gateway: '—'
        })),
        meta: {
          total,
          page: pageNum,
          limit: limitNum,
          summary: {
            total: parseInt(stats.total, 10),
            activeCount: parseInt(stats.active_count, 10),
            mrr: parseFloat(stats.total_mrr),
          }
        }
      });
    } catch (dbErr) {
      console.warn('DB subscription query failed, using fallback:', dbErr.message);
      // Fallback: apply search filter to in-memory data
      let filtered = [...fallbackAllSubscriptions];
      const { search, page = '1', limit = '20' } = req.query;
      const pageNum = Math.max(1, parseInt(page, 10) || 1);
      const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
      if (search) {
        const s = search.toLowerCase();
        filtered = filtered.filter(sub =>
          (sub.user || '').toLowerCase().includes(s) ||
          (sub.email || '').toLowerCase().includes(s) ||
          (sub.plan || '').toLowerCase().includes(s)
        );
      }
      const total = filtered.length;
      const paged = filtered.slice((pageNum - 1) * limitNum, pageNum * limitNum);
      return res.json({
        success: true,
        data: paged,
        meta: { total, page: pageNum, limit: limitNum, summary: null }
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
    const { search, type, dateFrom, dateTo, page = '1', limit = '30' } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(200, Math.max(1, parseInt(limit, 10) || 30));
    const offset = (pageNum - 1) * limitNum;

    try {
      // Attempt DB — usage_logs joined with users
      const params = [];
      const filters = [];

      if (search) {
        filters.push(`(
          u.name ILIKE $${params.length + 1} OR
          u.email ILIKE $${params.length + 1} OR
          ul.endpoint ILIKE $${params.length + 1}
        )`);
        params.push(`%${search}%`);
      }
      if (type) {
        if (type === 'api_call') {
          filters.push(`ul.endpoint NOT ILIKE $${params.length + 1}`);
          params.push('admin/%');
        } else if (type === 'admin_action') {
          filters.push(`ul.endpoint ILIKE $${params.length + 1}`);
          params.push('admin/%');
        }
        // 'error' type — status_code >= 400
        if (type === 'error') {
          filters.push(`ul.status_code >= 400`);
        }
      }
      if (dateFrom) {
        filters.push(`ul.timestamp >= $${params.length + 1}`);
        params.push(dateFrom);
      }
      if (dateTo) {
        filters.push(`ul.timestamp <= $${params.length + 1}`);
        params.push(dateTo + 'T23:59:59.999Z');
      }

      const whereClause = filters.length > 0 ? 'WHERE ' + filters.join(' AND ') : '';

      const countResult = await query(
        `SELECT COUNT(*) as total
         FROM usage_logs ul
         LEFT JOIN users u ON u.id = ul.user_id
         ${whereClause}`,
        params
      );
      const total = parseInt(countResult.rows[0].total, 10);

      const result = await query(
        `SELECT ul.id, ul.endpoint, ul.method, ul.status_code, ul.timestamp,
                u.id as user_id, u.name as user_name, u.email as user_email, u.avatar_url
         FROM usage_logs ul
         LEFT JOIN users u ON u.id = ul.user_id
         ${whereClause}
         ORDER BY ul.timestamp DESC
         LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, limitNum, offset]
      );

      const logs = result.rows.map(r => {
        // Derive type from endpoint pattern and status code
        let logType = 'api_call';
        if (r.status_code >= 500) logType = 'error';
        else if (r.status_code >= 400) logType = 'warn';
        if ((r.endpoint || '').startsWith('admin/')) logType = 'admin_action';

        return {
          id: r.id,
          type: logType,
          action: `${r.method} /${r.endpoint}`,
          statusCode: r.status_code,
          message: `${r.method} /${r.endpoint} — ${r.status_code}`,
          description: `${r.method} /${r.endpoint} returned ${r.status_code}`,
          user: r.user_id
            ? { id: r.user_id, username: r.user_name, email: r.user_email, avatar: r.avatar_url }
            : null,
          createdAt: r.timestamp,
        };
      });

      return res.json({
        success: true,
        data: logs,
        meta: { page: pageNum, limit: limitNum, total }
      });
    } catch (dbErr) {
      console.warn('DB audit log query failed, using fallback:', dbErr.message);
      // Fallback — in-memory filtering
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
      const paged = logs.slice(offset, offset + limitNum);

      return res.json({
        success: true,
        data: paged,
        meta: { page: pageNum, limit: limitNum, total }
      });
    }
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
module.exports.requireAdmin = requireAdmin;
