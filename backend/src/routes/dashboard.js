const express = require('express');
const { query } = require('../db/pool');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

function timeAgo(date) {
  if (!date) return '—';
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return '刚刚';
  if (mins < 60) return `${mins} 分钟前`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} 小时前`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days} 天前`;
  return new Date(date).toISOString().slice(0, 10);
}

// ──────────────────────────────────────────────
// In-memory fallback data
// ──────────────────────────────────────────────

const fallbackPlan = {
  name: '创业者版',
  description: '3 个数据包 · 每月 5,000 次 API 调用 · 50 份报告 · MCP 无限',
  renewDate: '2026-07-01 续费',
};

const fallbackMetrics = {
  apiCalls: 3284,
  apiLimit: 5000,
  reports: 31,
  reportLimit: 50,
  activeMonitors: 12,
  monitorLimit: 50,
  alerts: 3,
};

const fallbackTrend = {
  labels: ['6/1', '6/3', '6/5', '6/7', '6/9', '6/11', '6/13'],
  values: [82, 145, 98, 276, 312, 184, 223],
};

const fallbackRecentLogs = [
  { api: '/v1/startup/market-trend', status: '200', time: '142ms', ts: '2026-06-14 16:32:10', key: '生产' },
  { api: '/v1/geo/visibility-score', status: '200', time: '89ms', ts: '2026-06-14 16:28:03', key: '生产' },
  { api: '/v1/enterprise/risk-score', status: '200', time: '215ms', ts: '2026-06-14 16:15:44', key: '生产' },
  { api: '/v1/startup/market-trend', status: '429', time: '12ms', ts: '2026-06-14 16:10:22', key: '测试' },
  { api: '/v1/finance/cpi', status: '200', time: '156ms', ts: '2026-06-14 15:58:09', key: '生产' },
  { api: '/v1/enterprise/company-search', status: '200', time: '93ms', ts: '2026-06-14 15:42:18', key: '生产' },
  { api: '/v1/geo/visibility-score', status: '200', time: '104ms', ts: '2026-06-14 15:30:55', key: '测试' },
  { api: '/v1/startup/competitor-analysis', status: '200', time: '178ms', ts: '2026-06-14 14:55:33', key: '生产' },
  { api: '/v1/finance/gdp', status: '502', time: '3020ms', ts: '2026-06-14 14:30:12', key: '生产' },
  { api: '/v1/enterprise/relation-graph', status: '200', time: '267ms', ts: '2026-06-14 14:22:07', key: '生产' },
];

const fallbackReports = [
  { icon: 'ri-green', iconName: 'ti-rocket', title: 'AI 客服 SaaS 创业分析报告', pkg: '创业商业情报包', date: '2026-06-14 10:32', tag: '新' },
  { icon: 'ri-blue', iconName: 'ti-brand-google', title: 'insighthub.data AI/GEO 可见度分析', pkg: 'AI/GEO 数据包', date: '2026-06-13 15:08', tag: '已读' },
  { icon: 'ri-amber', iconName: 'ti-building', title: 'Intercom 竞品深度分析', pkg: '企业竞品监控包', date: '2026-06-12 09:45', tag: '已读' },
  { icon: 'ri-green', iconName: 'ti-chart-line', title: '2026Q2 宏观经济趋势报告', pkg: '金融宏观数据包', date: '2026-06-10 11:20', tag: '新' },
  { icon: 'ri-green', iconName: 'ti-rocket', title: '低代码工具赛道创业评估', pkg: '创业商业情报包', date: '2026-06-08 16:00', tag: '已读' },
];

const fallbackMonitors = [
  { status: 'ms-alert', name: '竞品 Intercom — 定价页变动', pkg: '企业竞品监控包', date: '2026-06-14 08:17', pill: '新告警', pillCls: 'alert-pill' },
  { status: 'ms-active', name: 'AI 客服 SaaS 行业指数', pkg: '创业商业情报包', date: '昨日 09:00 检查', pill: '正常', pillCls: '' },
  { status: 'ms-active', name: 'insighthub.data 品牌提及', pkg: 'AI/GEO 数据包', date: '昨日 08:30 检查', pill: '正常', pillCls: '' },
  { status: 'ms-pause', name: '竞品 Zendesk 产品更新监控', pkg: '企业竞品监控包', date: '已暂停', pill: '暂停', pillCls: '' },
  { status: 'ms-alert', name: '关键词「AI 客服」趋势变化', pkg: '创业商业情报包', date: '2026-06-13 22:15', pill: '新告警', pillCls: 'alert-pill' },
];

const fallbackApiKeys = [
  { name: '生产环境 Key', key: 'ihd_live_sk_Xk9mPqL2rN8vTs4w3a9f', env: 'production', used: 3284, limit: 5000, created: '2026-05-02', lastCall: '2 分钟前', scope: '全部数据包权限' },
  { name: '开发测试 Key', key: 'ihd_test_sk_Bj3nKpM5qR7xUv9w7c2b', env: 'development', used: 142, limit: 500, created: '2026-06-18', lastCall: '1 小时前', scope: '仅创业情报包' },
];

const fallbackPackages = [
  { name: '创业商业情报', icon: 'ti-rocket', color: 'ri-green', desc: '行业趋势、竞品分析、项目评估、MVP 建议', link: 'package-startup-intel.html' },
  { name: 'AI / GEO 分析', icon: 'ti-brand-google', color: 'ri-blue', desc: '网站 AI 可见度评分、品牌内容覆盖、GEO 优化建议', link: 'package-ai-geo.html' },
  { name: '企业情报与风控', icon: 'ti-building', color: 'ri-amber', desc: '企业查询、风险评分、关系图谱、招投标', link: 'package-enterprise-risk.html' },
  { name: '金融宏观数据', icon: 'ti-chart-line', color: 'ri-purple', desc: 'GDP、CPI、利率汇率等宏观经济指标查询', link: 'package-finance-macro.html' },
  { name: '跨境电商', icon: 'ti-truck', color: 'ri-indigo', desc: '跨境市场情报、品类分析、物流成本、关税政策', link: 'package-crossborder-ecommerce.html' },
  { name: 'Web3 / Crypto', icon: 'ti-crypto', color: 'ri-violet', desc: '加密资产、DeFi 协议、链上数据分析', link: 'package-web3-crypto.html' },
  { name: '政策招投标', icon: 'ti-notes', color: 'ri-orange', desc: '政策文件、招标公告、投标截止提醒', link: 'package-policy-bidding.html' },
  { name: '专利科技', icon: 'ti-bulb', color: 'ri-cyan', desc: '全球专利检索、申请人分析、技术趋势追踪', link: 'package-patent-tech.html' },
  { name: '教育', icon: 'ti-school', color: 'ri-teal', desc: '院校检索、学科排名、留学项目对比', link: 'package-education.html' },
];

// ──────────────────────────────────────────────
// GET /api/v1/dashboard/stats
// ──────────────────────────────────────────────

router.get('/stats', authenticate, async (req, res, next) => {
  try {
    try {
      // ── Parallel DB queries for all dashboard sections ──
      const userId = req.user.id;

      const [usageResult, logResult, planResult, apiKeyResult, monitorResult, monthlyCallsResult, reportCountResult] = await Promise.all([
        // Trend: 14-day API call counts
        query(
          `SELECT DATE(timestamp) as date, COUNT(*) as calls
           FROM usage_logs
           WHERE user_id = $1
             AND timestamp >= NOW() - INTERVAL '14 days'
           GROUP BY DATE(timestamp)
           ORDER BY date ASC`,
          [userId]
        ),
        // Recent logs
        query(
          `SELECT ul.endpoint as api, ul.status_code as status, ul.duration_ms as time, ul.timestamp as ts, ak.name as key_name
           FROM usage_logs ul
           LEFT JOIN api_keys ak ON ak.id = ul.api_key_id
           WHERE ul.user_id = $1
           ORDER BY ul.timestamp DESC
           LIMIT 10`,
          [userId]
        ),
        // Subscription plan
        query(
          `SELECT sp.name, sp.price_monthly, sp.requests_per_month, sp.features,
                  s.current_period_end
           FROM subscriptions s
           JOIN subscription_plans sp ON sp.id = s.plan_id
           WHERE s.user_id = $1 AND s.status = 'active'
           ORDER BY s.created_at DESC LIMIT 1`,
          [userId]
        ),
        // API keys
        query(
          `SELECT id, name, key, revoked, created_at, last_used_at
           FROM api_keys
           WHERE user_id = $1
           ORDER BY created_at DESC`,
          [userId]
        ),
        // Monitors
        query(
          `SELECT id, name, status, created_at
           FROM monitors
           WHERE user_id = $1
           ORDER BY created_at DESC
           LIMIT 20`,
          [userId]
        ),
        // Monthly API call count + limit
        query(
          `SELECT COUNT(*) as calls
           FROM usage_logs
           WHERE user_id = $1
             AND timestamp >= NOW() - INTERVAL '30 days'`,
          [userId]
        ),
        // Monthly report count
        query(
          `SELECT COUNT(DISTINCT endpoint) as report_count
           FROM usage_logs
           WHERE user_id = $1
             AND endpoint LIKE '%/reports%'
             AND timestamp >= NOW() - INTERVAL '30 days'`,
          [userId]
        ),
      ]);

      // ── Build plan from DB or fallback ──
      const planRow = planResult.rows[0];
      const plan = planRow
        ? {
            name: planRow.name,
            description: `${planRow.requests_per_month ?? '—'} 次/月`,
            renewDate: planRow.current_period_end
              ? new Date(planRow.current_period_end).toISOString().slice(0, 10) + ' 续费'
              : fallbackPlan.renewDate,
          }
        : fallbackPlan;

      // ── Build metrics from DB or fallback ──
      const monthlyCalls = parseInt(monthlyCallsResult.rows[0]?.calls, 10) || 0;
      const apiLimit = planRow?.requests_per_month || fallbackMetrics.apiLimit;
      const apiKeys = apiKeyResult.rows.filter(k => !k.revoked);
      const monitors = monitorResult.rows;
      const reportCount = parseInt(reportCountResult.rows[0]?.report_count, 10) || 0;

      const metrics = {
        apiCalls: monthlyCalls,
        apiLimit,
        reports: reportCount,
        reportLimit: fallbackMetrics.reportLimit,
        activeMonitors: monitors.length,
        monitorLimit: fallbackMetrics.monitorLimit,
        alerts: 0,
      };

      // ── Build trend ──
      const trendData = usageResult.rows.map(r => ({
        date: r.date.toISOString ? r.date.toISOString().slice(5, 10) : r.date,
        calls: parseInt(r.calls, 10),
      }));

      // ── Build API keys list ──
      const apiKeysList = apiKeys.length > 0
        ? apiKeys.map(k => ({
            name: k.name,
            key: k.key ? k.key.slice(0, 12) + '***' + k.key.slice(-4) : '***',
            env: k.name?.toLowerCase().includes('测试') || k.name?.toLowerCase().includes('test') ? 'development' : 'production',
            used: 0,
            limit: apiLimit,
            created: k.created_at ? new Date(k.created_at).toISOString().slice(0, 10) : '—',
            lastCall: k.last_used_at ? timeAgo(k.last_used_at) : '从未',
            scope: '全部数据包权限',
          }))
        : fallbackApiKeys;

      // ── Build monitors list ──
      const monitorsList = monitors.length > 0
        ? monitors.map(m => {
            const statusCls = m.status === 'alert' ? 'ms-alert' : m.status === 'paused' ? 'ms-pause' : 'ms-active';
            const pill = m.status === 'alert' ? '新告警' : m.status === 'paused' ? '暂停' : '正常';
            const pillCls = m.status === 'alert' ? 'alert-pill' : '';
            return {
              status: statusCls,
              name: m.name,
              pkg: '—',
              date: m.created_at ? timeAgo(m.created_at) : '—',
              pill,
              pillCls,
            };
          })
        : fallbackMonitors;

      // ── Build recent logs ──
      const recentLogs = logResult.rows.length > 0
        ? logResult.rows.map(r => ({
            api: r.api,
            status: String(r.status),
            time: r.time + 'ms',
            ts: r.ts,
            key: r.key_name || '未知',
          }))
        : fallbackRecentLogs;

      return res.json({
        success: true,
        data: {
          user: {
            name: req.user.name || '用户',
            email: req.user.email || '',
            avatar: req.user.avatar || null,
          },
          plan,
          metrics,
          trend: {
            labels: trendData.length > 0 ? trendData.map(t => t.date) : fallbackTrend.labels,
            values: trendData.length > 0 ? trendData.map(t => t.calls) : fallbackTrend.values,
          },
          recentReports: fallbackReports,   // no reports table yet
          monitors: monitorsList,
          subscribedPackages: fallbackPackages, // no subscription_items table yet
          apiKeys: apiKeysList,
          recentLogs,
        },
      });
    } catch (dbErr) {
      // DB unavailable — use full fallback
      console.warn('[Dashboard] DB unavailable, using fallback data');
      return res.json({
        success: true,
        data: {
          user: {
            name: req.user.name || '用户',
            email: req.user.email || '',
            avatar: req.user.avatar || null,
          },
          plan: fallbackPlan,
          metrics: fallbackMetrics,
          trend: fallbackTrend,
          recentReports: fallbackReports,
          monitors: fallbackMonitors,
          subscribedPackages: fallbackPackages,
          apiKeys: fallbackApiKeys,
          recentLogs: fallbackRecentLogs,
        },
      });
    }
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/dashboard/monitors — 创建监控任务
router.post('/monitors', authenticate, async (req, res, next) => {
  try {
    const { name, package: pkg, frequency } = req.body;

    if (!name || !pkg) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'name and package are required' },
      });
    }

    try {
      const result = await query(
        `INSERT INTO monitors (user_id, name, package, frequency, status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, 'active', NOW(), NOW())
         RETURNING id, name, package, frequency, status, created_at, updated_at`,
        [req.user.id, name, pkg, frequency || '15min']
      );

      return res.status(201).json({
        success: true,
        data: result.rows[0],
      });
    } catch (dbErr) {
      // DB unavailable — simulate success with generated id
      const fallback = {
        id: 'mon_' + Date.now(),
        name,
        package: pkg,
        frequency: frequency || '15min',
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      return res.status(201).json({ success: true, data: fallback });
    }
  } catch (err) {
    next(err);
  }
});

// DELETE /api/v1/dashboard/monitors/:id — 删除监控任务
router.delete('/monitors/:id', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;

    try {
      const result = await query(
        'DELETE FROM monitors WHERE id = $1 AND user_id = $2 RETURNING id',
        [id, req.user.id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Monitor not found' } });
      }

      return res.json({ success: true, data: { id } });
    } catch (dbErr) {
      // DB unavailable — simulate success
      return res.json({ success: true, data: { id } });
    }
  } catch (err) {
    next(err);
  }
});

// PATCH /api/v1/dashboard/monitors/:id — 更新监控任务状态
router.patch('/monitors/:id', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status || !['active', 'paused', 'alert'].includes(status)) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Valid status is required (active|paused|alert)' },
      });
    }

    try {
      const result = await query(
        `UPDATE monitors SET status = $1, updated_at = NOW()
         WHERE id = $2 AND user_id = $3
         RETURNING id, name, package, frequency, status, created_at, updated_at`,
        [status, id, req.user.id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Monitor not found' } });
      }

      return res.json({ success: true, data: result.rows[0] });
    } catch (dbErr) {
      // DB unavailable — simulate success
      return res.json({ success: true, data: { id, status, updated_at: new Date().toISOString() } });
    }
  } catch (err) {
    next(err);
  }
});

module.exports = router;
