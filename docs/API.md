# InsightHub API Reference

> **Base URL**: `http://localhost:3000/api/v1` (本地) 或 `https://your-domain.com/api/v1` (生产)
> **Content-Type**: `application/json`

---

## 目录

- [认证方式](#认证方式)
- [统一响应格式](#统一响应格式)
- [错误码表](#错误码表)
- [1. 认证模块 — `/auth`](#1-认证模块)
- [2. 用户模块 — `/users`](#2-用户模块)
- [3. 数据包模块 — `/packages`](#3-数据包模块)
- [4. 搜索模块 — `/search`](#4-搜索模块)
- [5. 订阅模块 — `/subscriptions`](#5-订阅模块)
- [6. API Key 模块 — `/api-keys`](#6-api-key-模块)
- [7. 仪表盘模块 — `/dashboard`](#7-仪表盘模块)
- [8. 报告模块 — `/reports`](#8-报告模块)
- [9. AI 报告模块 — `/ai-reports`](#9-ai-报告模块)
- [10. 监控模块 — `/monitors`](#10-监控模块)
- [11. 收藏模块 — `/favorites`](#11-收藏模块)
- [12. 通知模块 — `/notifications`](#12-通知模块)
- [13. 数据分析模块 — `/analytics`](#13-数据分析模块)
- [14. LLM 配置模块 — `/llm`](#14-llm-配置模块)
- [15. 定价模块 — `/pricing`](#15-定价模块)
- [16. 管理后台模块 — `/admin`](#16-管理后台模块)
- [17. AI 代理模块 — `/agent`](#17-ai-代理模块)

---

## 认证方式

InsightHub 支持两种认证方式：

### 方式一：JWT Bearer Token（推荐前端使用）

```
Authorization: Bearer <token>
```

### 方式二：API Key（推荐后端/MCP 使用）

```
X-API-Key: <api_key>
```

### 获取 Token

通过登录/注册接口获取：

```bash
# 注册
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"mypassword","name":"张三"}'

# 登录
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"mypassword"}'
```

响应中包含 `token`，后续请求在 Header 中携带即可。

---

## 统一响应格式

### 成功响应

```json
{
  "success": true,
  "data": { ... },
  "meta": { "total": 10 }
}
```

### 错误响应

```json
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "缺少认证凭证。"
  }
}
```

---

## 错误码表

| HTTP 状态码 | 错误码 | 说明 |
|------------|--------|------|
| 400 | `VALIDATION_ERROR` | 参数校验失败 |
| 401 | `UNAUTHORIZED` | 未认证 |
| 401 | `TOKEN_EXPIRED` | Token 已过期 |
| 401 | `INVALID_TOKEN` | 无效 Token |
| 401 | `INVALID_API_KEY` | 无效或已撤销的 API Key |
| 401 | `INVALID_CREDENTIALS` | 邮箱或密码错误 |
| 404 | `NOT_FOUND` | 资源不存在 |
| 409 | `DUPLICATE_ENTRY` | 资源已存在（如重复注册） |
| 429 | `RATE_LIMITED` | 请求频率超限 |
| 503 | `SERVICE_UNAVAILABLE` | 服务暂不可用 |

---

## 1. 认证模块

### POST `/auth/register` — 用户注册

**请求体**：

```json
{
  "email": "user@example.com",
  "password": "mypassword",
  "name": "张三"
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| email | string | 是 | 邮箱地址，全局唯一 |
| password | string | 是 | 密码，至少 6 位 |
| name | string | 是 | 用户名 |

**成功响应** `201 Created`：

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "email": "user@example.com",
      "name": "张三",
      "email_verified": false,
      "created_at": "2026-07-14T10:00:00.000Z",
      "updated_at": "2026-07-14T10:00:00.000Z"
    },
    "token": "eyJhbGciOiJIUzI1NiIs..."
  }
}
```

**错误响应**：

| 状态码 | 场景 |
|--------|------|
| 400 | 缺少必填字段或密码不足 6 位 |
| 409 | 邮箱已被注册 |

---

### POST `/auth/login` — 用户登录

**请求体**：

```json
{
  "email": "user@example.com",
  "password": "mypassword"
}
```

**成功响应** `200 OK`：

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "email": "user@example.com",
      "name": "张三",
      "email_verified": true,
      "created_at": "2026-07-14T10:00:00.000Z",
      "updated_at": "2026-07-14T10:00:00.000Z"
    },
    "token": "eyJhbGciOiJIUzI1NiIs..."
  }
}
```

---

### POST `/auth/forgot-password` — 发送重置密码邮件

**请求体**：

```json
{
  "email": "user@example.com"
}
```

**成功响应** `200 OK`：

```json
{
  "success": true,
  "data": {
    "message": "如果该邮箱已注册，重置链接已发送。"
  }
}
```

> 安全提示：无论邮箱是否存在，均返回相同消息，防止邮箱枚举攻击。

---

### POST `/auth/reset-password` — 重置密码

**请求体**：

```json
{
  "token": "abc123def456...",
  "password": "newpassword"
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| token | string | 是 | 邮件中的重置令牌 |
| password | string | 是 | 新密码，至少 6 位 |

---

### POST `/auth/verify-email` — 验证邮箱

**请求体**：

```json
{
  "token": "abc123def456..."
}
```

---

## 2. 用户模块

### GET `/users/me` — 获取当前用户信息 🔒

**请求头**：`Authorization: Bearer <token>`

**成功响应** `200 OK`：

```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "user@example.com",
    "name": "张三",
    "email_verified": true,
    "role": "user",
    "created_at": "2026-07-14T10:00:00.000Z"
  }
}
```

---

### PATCH `/users/me` — 更新用户信息 🔒

**请求体**：

```json
{
  "name": "张三丰"
}
```

---

### POST `/users/me/change-password` — 修改密码 🔒

**请求体**：

```json
{
  "current_password": "oldpassword",
  "new_password": "newpassword"
}
```

---

## 3. 数据包模块

### GET `/packages` — 获取所有数据包列表

**成功响应** `200 OK`：

```json
{
  "success": true,
  "data": [
    {
      "id": "pkg-001",
      "name": "创业商业情报",
      "code": "startup_intel",
      "description": "行业趋势分析、竞品情报、项目评估、MVP 规划",
      "icon": "ti-rocket",
      "features": ["行业趋势分析", "竞品情报收集", "项目可行性评估", "MVP规划建议"],
      "api_count": 25,
      "is_active": true,
      "created_at": "2026-01-01T00:00:00.000Z"
    }
  ],
  "meta": { "total": 9 }
}
```

### GET `/packages/:id` — 获取单个数据包详情

**路径参数**：

| 参数 | 说明 |
|------|------|
| id | 数据包 ID 或 code |

---

## 4. 搜索模块

### POST `/search` — 全局搜索 🔒

**请求体**：

```json
{
  "query": "AI 客服",
  "packages": ["startup_intel", "ai_geo"],
  "page": 1,
  "limit": 20
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| query | string | 是 | 搜索关键词 |
| packages | string[] | 否 | 限定搜索范围的数据包 code 列表 |
| page | number | 否 | 页码，默认 1 |
| limit | number | 否 | 每页条数，默认 20 |

**成功响应** `200 OK`：

```json
{
  "success": true,
  "data": {
    "results": [
      {
        "id": "result-001",
        "title": "AI 客服 SaaS 市场趋势 2026",
        "content": "全球 AI 客服市场规模预计在 2026 年达到 120 亿美元...",
        "source": "GDELT",
        "package_code": "startup_intel",
        "score": 0.95,
        "created_at": "2026-07-14T10:00:00.000Z"
      }
    ],
    "total": 42,
    "page": 1,
    "limit": 20
  }
}
```

---

## 5. 订阅模块

### GET `/subscriptions/plans` — 获取所有套餐

**成功响应** `200 OK`：

```json
{
  "success": true,
  "data": [
    {
      "id": "plan-free-001",
      "name": "免费版",
      "code": "free",
      "price_monthly": 0,
      "price_yearly": 0,
      "requests_per_month": 1000,
      "requests_per_minute": 10,
      "features": ["基础数据访问", "每日10次API调用", "社区支持"]
    },
    {
      "id": "plan-pro-001",
      "name": "专业版",
      "code": "pro",
      "price_monthly": 299,
      "price_yearly": 2990,
      "requests_per_month": 50000,
      "requests_per_minute": 100,
      "features": ["全部数据包访问", "高级搜索过滤", "AI报告生成", "邮件支持", "API密钥管理"]
    },
    {
      "id": "plan-ent-001",
      "name": "企业版",
      "code": "enterprise",
      "price_monthly": 999,
      "price_yearly": 9990,
      "requests_per_month": 500000,
      "requests_per_minute": 1000,
      "features": ["全部数据包访问", "高级搜索过滤", "AI报告生成", "优先技术支持", "自定义集成", "SLA保障", "专属客户经理"]
    }
  ],
  "meta": { "total": 3 }
}
```

---

### GET `/subscriptions/current` — 获取当前订阅 🔒

**成功响应** `200 OK`：

```json
{
  "success": true,
  "data": {
    "id": "sub-001",
    "user_id": "550e8400-e29b-41d4-a716-446655440000",
    "plan_id": "plan-pro-001",
    "status": "active",
    "current_period_start": "2026-07-01T00:00:00.000Z",
    "current_period_end": "2026-08-01T00:00:00.000Z",
    "plan_name": "专业版",
    "plan_code": "pro",
    "price_monthly": 299,
    "price_yearly": 2990,
    "requests_per_month": 50000,
    "requests_per_minute": 100,
    "features": ["全部数据包访问", "高级搜索过滤", "AI报告生成"]
  }
}
```

> 未订阅的用户返回默认免费版，`isDefault: true`。

---

### POST `/subscriptions/subscribe` — 订阅套餐 🔒

**请求体**：

```json
{
  "plan_code": "pro"
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| plan_code | string | 是 | 套餐代码：`free` / `pro` / `enterprise` |

**成功响应** `201 Created`：

```json
{
  "success": true,
  "data": {
    "subscription": {
      "id": "sub-002",
      "user_id": "550e8400-e29b-41d4-a716-446655440000",
      "plan_id": "plan-pro-001",
      "status": "active",
      "current_period_start": "2026-07-14T10:00:00.000Z",
      "current_period_end": "2026-08-14T10:00:00.000Z"
    },
    "plan": {
      "id": "plan-pro-001",
      "name": "专业版",
      "code": "pro",
      "price_monthly": 299
    }
  }
}
```

---

### POST `/subscriptions/cancel` — 取消订阅 🔒

**成功响应** `200 OK`：

```json
{
  "success": true,
  "data": {
    "subscription": { "id": "sub-001", "status": "cancelled" },
    "status": "cancelled"
  }
}
```

---

## 6. API Key 模块

### GET `/api-keys` — 获取 API Key 列表 🔒

**成功响应** `200 OK`：

```json
{
  "success": true,
  "data": [
    {
      "id": "key-001",
      "key": "sk-abc123...",
      "name": "生产环境 Key",
      "last_used_at": "2026-07-14T10:00:00.000Z",
      "created_at": "2026-06-01T00:00:00.000Z",
      "revoked": false
    }
  ],
  "meta": { "total": 2 }
}
```

---

### POST `/api-keys` — 创建 API Key 🔒

**请求体**：

```json
{
  "name": "生产环境 Key"
}
```

**成功响应** `201 Created`：

```json
{
  "success": true,
  "data": {
    "id": "key-002",
    "key": "sk-a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0",
    "name": "生产环境 Key",
    "created_at": "2026-07-14T10:00:00.000Z",
    "revoked": false
  }
}
```

> ⚠️ API Key 仅在创建时返回完整值，请妥善保存。

---

### DELETE `/api-keys/:id` — 撤销 API Key 🔒

**路径参数**：

| 参数 | 说明 |
|------|------|
| id | API Key 的 ID |

**成功响应** `200 OK`：

```json
{
  "success": true,
  "data": {
    "id": "key-001",
    "key": "sk-abc123...",
    "name": "生产环境 Key",
    "revoked": true
  }
}
```

---

## 7. 仪表盘模块

### GET `/dashboard/stats` — 获取仪表盘数据 🔒

返回当前用户的综合仪表盘数据，包含用量指标、趋势图、最近日志、报告、监控、订阅包和 API Key。

**成功响应** `200 OK`：

```json
{
  "success": true,
  "data": {
    "user": {
      "name": "张三",
      "email": "user@example.com",
      "avatar": null
    },
    "plan": {
      "name": "创业者版",
      "description": "3 个数据包 · 每月 5,000 次 API 调用 · 50 份报告 · MCP 无限",
      "renewDate": "2026-07-01 续费"
    },
    "metrics": {
      "apiCalls": 3284,
      "apiLimit": 5000,
      "reports": 31,
      "reportLimit": 50,
      "activeMonitors": 12,
      "monitorLimit": 50,
      "alerts": 3
    },
    "trend": {
      "labels": ["6/1", "6/3", "6/5", "6/7", "6/9", "6/11", "6/13"],
      "values": [82, 145, 98, 276, 312, 184, 223]
    },
    "recentReports": [
      {
        "icon": "ri-green",
        "iconName": "ti-rocket",
        "title": "AI 客服 SaaS 创业分析报告",
        "pkg": "创业商业情报包",
        "date": "2026-06-14 10:32",
        "tag": "新"
      }
    ],
    "monitors": [
      {
        "status": "ms-alert",
        "name": "竞品 Intercom — 定价页变动",
        "pkg": "企业竞品监控包",
        "date": "2026-06-14 08:17",
        "pill": "新告警",
        "pillCls": "alert-pill"
      }
    ],
    "subscribedPackages": [
      {
        "name": "创业商业情报",
        "icon": "ti-rocket",
        "color": "ri-green",
        "desc": "行业趋势、竞品分析、项目评估、MVP 建议",
        "link": "package-startup-intel.html"
      }
    ],
    "apiKeys": [
      {
        "name": "生产环境 Key",
        "key": "ihd_live_sk_Xk9mPqL2rN8vTs4w3a9f",
        "env": "production",
        "used": 3284,
        "limit": 5000
      }
    ],
    "recentLogs": [
      {
        "api": "/v1/startup/market-trend",
        "status": "200",
        "time": "142ms",
        "ts": "2026-06-14 16:32:10",
        "key": "生产"
      }
    ]
  }
}
```

---

## 8. 报告模块

### POST `/reports/generate` — AI 生成报告 🔒

**请求体**：

```json
{
  "topic": "AI 客服 SaaS 创业可行性分析",
  "package_code": "startup_intel",
  "data_sources": ["web_search", "market_data"],
  "options": {
    "depth": "detailed",
    "language": "zh"
  }
}
```

**SSE 流式响应**（`text/event-stream`）：

```
data: {"type":"start","message":"开始生成报告..."}
data: {"type":"progress","percent":25,"message":"正在分析市场数据..."}
data: {"type":"progress","percent":50,"message":"正在生成竞品分析..."}
data: {"type":"progress","percent":75,"message":"正在撰写建议..."}
data: {"type":"complete","report_id":"rpt-001","title":"AI 客服 SaaS 创业可行性分析"}
```

---

### GET `/reports` — 获取报告列表 🔒

**查询参数**：

| 参数 | 类型 | 说明 |
|------|------|------|
| page | number | 页码，默认 1 |
| limit | number | 每页条数，默认 20 |
| package_code | string | 按数据包筛选 |

---

### GET `/reports/:id` — 获取报告详情 🔒

---

### DELETE `/reports/:id` — 删除报告 🔒

---

## 9. AI 报告模块

### POST `/ai-reports/generate` — 生成 AI 分析报告 🔒

使用大语言模型生成结构化的数据分析报告。

**请求体**：

```json
{
  "topic": "2026年AI客服市场趋势分析",
  "data_package": "startup_intel",
  "context": "我正在评估AI客服SaaS创业的可行性",
  "template": "market_analysis"
}
```

**SSE 流式响应**：

```
data: {"type":"start","id":"rpt-001","message":"开始分析..."}
data: {"type":"content","id":"rpt-001","content":"# AI 客服市场趋势分析\n\n## 市场概览\n..."}
data: {"type":"complete","id":"rpt-001","token_usage":{"input":1200,"output":3500}}
```

---

### GET `/ai-reports/templates` — 获取报告模板 🔒

---

### GET `/ai-reports/history` — 获取报告历史 🔒

---

## 10. 监控模块

### POST `/monitors` — 创建监控任务 🔒

**请求体**：

```json
{
  "name": "竞品 Zendesk 产品更新监控",
  "type": "price_change",
  "target_url": "https://www.zendesk.com/pricing/",
  "package_code": "enterprise_risk",
  "schedule": "daily",
  "notify_email": true,
  "notify_threshold": 5
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| name | string | 是 | 监控名称 |
| type | string | 是 | 监控类型：`price_change` / `content_update` / `keyword` / `competitor` |
| target_url | string | 否 | 监控目标 URL |
| package_code | string | 是 | 关联数据包 |
| schedule | string | 否 | 检查频率：`hourly` / `daily` / `weekly`，默认 `daily` |
| notify_email | boolean | 否 | 是否邮件通知 |
| notify_threshold | number | 否 | 触发阈值 |

---

### GET `/monitors` — 获取监控列表 🔒

---

### GET `/monitors/:id` — 获取监控详情 🔒

---

### PATCH `/monitors/:id` — 更新监控 🔒

---

### DELETE `/monitors/:id` — 删除监控 🔒

---

### POST `/monitors/:id/toggle` — 启停监控 🔒

---

## 11. 收藏模块

### POST `/favorites` — 添加收藏 🔒

**请求体**：

```json
{
  "item_type": "data_point",
  "item_id": "dp-001",
  "title": "中国2026年GDP增长率",
  "package_code": "finance_macro"
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| item_type | string | 是 | 收藏类型：`data_point` / `report` / `monitor` |
| item_id | string | 是 | 资源 ID |
| title | string | 否 | 收藏标题 |
| package_code | string | 否 | 关联数据包 |

---

### GET `/favorites` — 获取收藏列表 🔒

---

### DELETE `/favorites/:id` — 取消收藏 🔒

---

## 12. 通知模块

### GET `/notifications` — 获取通知列表 🔒

**查询参数**：

| 参数 | 类型 | 说明 |
|------|------|------|
| page | number | 页码 |
| limit | number | 每页条数 |
| unread_only | boolean | 仅未读 |

---

### PATCH `/notifications/:id/read` — 标记已读 🔒

---

### POST `/notifications/mark-all-read` — 全部标记已读 🔒

---

## 13. 数据分析模块

### GET `/analytics/overview` — 数据概览 🔒

---

### GET `/analytics/trends` — 趋势分析 🔒

**查询参数**：

| 参数 | 类型 | 说明 |
|------|------|------|
| metric | string | 指标名：`api_calls` / `reports` / `users` |
| period | string | 时间范围：`7d` / `30d` / `90d` |
| granularity | string | 粒度：`hourly` / `daily` / `weekly` |

---

## 14. LLM 配置模块

### GET `/llm/config` — 获取 LLM 配置 🔒

---

### POST `/llm/config` — 更新 LLM 配置 🔒

**请求体**：

```json
{
  "provider": "deepseek",
  "model": "deepseek-chat",
  "api_key": "sk-xxx",
  "temperature": 0.7,
  "max_tokens": 4096
}
```

---

### POST `/llm/test` — 测试 LLM 连接 🔒

---

## 15. 定价模块

### GET `/pricing/plans` — 获取定价方案

公开接口，无需认证。

**成功响应** `200 OK`：

```json
{
  "success": true,
  "data": [
    {
      "id": "plan-free-001",
      "name": "免费版",
      "code": "free",
      "price_monthly": 0,
      "price_yearly": 0,
      "requests_per_month": 1000,
      "requests_per_minute": 10,
      "features": ["基础数据访问", "每日10次API调用", "社区支持"]
    },
    {
      "id": "plan-pro-001",
      "name": "专业版",
      "code": "pro",
      "price_monthly": 299,
      "price_yearly": 2990,
      "requests_per_month": 50000,
      "requests_per_minute": 100,
      "features": ["全部数据包访问", "高级搜索过滤", "AI报告生成"]
    },
    {
      "id": "plan-ent-001",
      "name": "企业版",
      "code": "enterprise",
      "price_monthly": 999,
      "price_yearly": 9990,
      "requests_per_month": 500000,
      "requests_per_minute": 1000,
      "features": ["全部数据包访问", "SLA保障", "专属客户经理"]
    }
  ],
  "meta": { "total": 3 }
}
```

---

## 16. 管理后台模块

> 所有管理后台接口需要 `admin` 角色认证。

### POST `/admin/login` — 管理员登录

**请求体**：

```json
{
  "email": "admin@insighthub.data",
  "password": "admin123456"
}
```

**成功响应** `200 OK`：

```json
{
  "success": true,
  "data": {
    "admin": {
      "id": "admin-seed-01",
      "email": "admin@insighthub.data",
      "name": "管理员",
      "role": "admin"
    },
    "token": "eyJhbGciOiJIUzI1NiIs..."
  }
}
```

---

### GET `/admin/stats` — 系统统计概览 🔒👑

**成功响应** `200 OK`：

```json
{
  "success": true,
  "data": {
    "totalUsers": 128,
    "activeUsers": 87,
    "totalApiKeys": 342,
    "totalApiCalls": 284500,
    "totalReports": 1560,
    "totalRevenue": "¥48,200",
    "mrr": "¥12,800",
    "growth": "+12.5%",
    "servers": [
      { "name": "API Server 1", "status": "healthy", "uptime": "14d 7h", "load": "23%" }
    ],
    "topPackages": [
      { "name": "创业商业情报", "calls": 98200, "users": 64 }
    ]
  }
}
```

---

### GET `/admin/users` — 用户管理 🔒👑

### PATCH `/admin/users/:id/status` — 更新用户状态 🔒👑

**请求体**：

```json
{
  "status": "active"
}
```

| 字段 | 说明 |
|------|------|
| status | `active` / `suspended` |

---

### GET `/admin/api-keys` — API Key 管理 🔒👑

### PATCH `/admin/api-keys/:id/revoke` — 撤销 API Key 🔒👑

---

### GET `/admin/subscriptions` — 订阅管理 🔒👑

### PATCH `/admin/subscriptions/:id` — 更新订阅状态 🔒👑

**请求体**：

```json
{
  "status": "active"
}
```

---

### GET `/admin/audit-logs` — 审计日志 🔒👑

### GET `/admin/system-health` — 系统健康检查 🔒👑

### GET `/admin/servers` — 服务器状态 🔒👑

### GET `/admin/packages` — 数据包管理 🔒👑

### GET `/admin/backup` — 数据备份 🔒👑

### GET `/admin/metrics` — 监控指标 🔒👑

### GET `/admin/alerts` — 告警列表 🔒👑

### PATCH `/admin/alerts/:id/resolve` — 处理告警 🔒👑

---

## 17. AI 代理模块

### POST `/agent/query` — 智能查询 🔒

通过 AI 代理进行自然语言查询，自动路由到对应数据包。

**请求体**：

```json
{
  "query": "中国2026年GDP增长率是多少？",
  "context": "finance_macro",
  "stream": true
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| query | string | 是 | 自然语言查询 |
| context | string | 否 | 上下文数据包 |
| stream | boolean | 否 | 是否流式响应，默认 true |

**SSE 流式响应**：

```
data: {"type":"thinking","message":"分析查询意图..."}
data: {"type":"routing","target":"finance_macro","confidence":0.95}
data: {"type":"content","chunk":"根据最新数据，中国2026年GDP增长率预计为..."}
data: {"type":"complete","tokens_used":850}
```

---

## 附录

### 认证对照表

| 标记 | 说明 |
|------|------|
| 🔒 | 需要认证（JWT 或 API Key） |
| 👑 | 需要 admin 角色 |
| 无标记 | 公开接口 |

### 套餐权限对比

| 能力 | 免费版 | 专业版 (¥299/月) | 企业版 (¥999/月) |
|------|--------|-----------------|-----------------|
| 月 API 调用 | 1,000 | 50,000 | 500,000 |
| 每分钟限流 | 10 | 100 | 1,000 |
| 数据包访问 | 基础 | 全部 | 全部 |
| AI 报告生成 | ❌ | ✅ | ✅ |
| 优先支持 | ❌ | 邮件 | 专属客户经理 |
| SLA 保障 | ❌ | ❌ | ✅ |

---

> 📌 完整的交互式 API 文档请访问 `/api-docs.html` 页面，包含所有接口的在线测试功能。
