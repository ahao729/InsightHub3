const express = require('express');
const { query } = require('../db/pool');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

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
  { name: '创业商业情报', icon: 'ti-rocket', color: 'ri-green', desc: '行业趋势、竞品分析、项目评估、MVP 建议' },
  { name: 'AI / GEO 分析', icon: 'ti-brand-google', color: 'ri-blue', desc: '网站 AI 可见度评分、品牌内容覆盖、GEO 优化建议' },
  { name: '企业情报与风控', icon: 'ti-building', color: 'ri-amber', desc: '企业查询、风险评分、关系图谱、招投标' },
];

// ──────────────────────────────────────────────
// GET /api/v1/dashboard/stats
// ──────────────────────────────────────────────

router.get('/stats', authenticate, async (req, res, next) => {
  try {
    try {
      // Attempt DB query first
      // For now, return fallback — a real implementation would aggregate
      // from usage_logs, reports, monitors, etc.
      const usageResult = await query(
        `SELECT DATE(created_at) as date, COUNT(*) as calls
         FROM usage_logs
         WHERE user_id = $1
           AND created_at >= NOW() - INTERVAL '14 days'
         GROUP BY DATE(created_at)
         ORDER BY date ASC`,
        [req.user.id]
      );

      const logResult = await query(
        `SELECT ul.api_path as api, ul.status, ul.duration_ms as time, ul.created_at as timestamp, ak.name as key_name
         FROM usage_logs ul
         LEFT JOIN api_keys ak ON ak.id = ul.api_key_id
         WHERE ul.user_id = $1
         ORDER BY ul.created_at DESC
         LIMIT 10`,
        [req.user.id]
      );

      // Build response from DB data where available + fallback for rest
      const trendData = usageResult.rows.map(r => ({
        date: r.date.toISOString ? r.date.toISOString().slice(5, 10) : r.date,
        calls: parseInt(r.calls, 10),
      }));

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
          trend: {
            labels: trendData.length > 0 ? trendData.map(t => t.date) : fallbackTrend.labels,
            values: trendData.length > 0 ? trendData.map(t => t.calls) : fallbackTrend.values,
          },
          recentReports: fallbackReports,
          monitors: fallbackMonitors,
          subscribedPackages: fallbackPackages,
          apiKeys: fallbackApiKeys,
          recentLogs: logResult.rows.length > 0
            ? logResult.rows.map(r => ({
                api: r.api,
                status: String(r.status),
                time: r.time + 'ms',
                ts: r.timestamp,
                key: r.key_name || '未知',
              }))
            : fallbackRecentLogs,
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

module.exports = router;
