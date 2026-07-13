# InsightHub MCP Server 集成指南

> Model Context Protocol (MCP) 是一种标准化协议，允许 AI Agent（如 Claude Desktop、Cursor、Cline）直接调用外部工具和数据源。InsightHub MCP Server 将平台的 8 大数据包、24 个工具无缝接入任何兼容 MCP 的 AI 客户端。

---

## 目录

- [架构概览](#架构概览)
- [快速开始](#快速开始)
- [客户端配置](#客户端配置)
  - [Claude Desktop](#claude-desktop)
  - [Cursor](#cursor)
  - [Cline (VS Code)](#cline-vs-code)
- [工具清单](#工具清单)
- [工具详细说明](#工具详细说明)
- [使用示例](#使用示例)
- [故障排除](#故障排除)
- [高级配置](#高级配置)

---

## 架构概览

```
┌─────────────────────────────────────────────────┐
│  AI Agent (Claude Desktop / Cursor / Cline)     │
│                                                 │
│  用户提问: "中国2026年GDP增长率是多少？"           │
└──────────────────────┬──────────────────────────┘
                       │ MCP Protocol (stdio)
                       ▼
┌─────────────────────────────────────────────────┐
│  InsightHub MCP Server (mcp-server/index.js)    │
│                                                 │
│  • 8 个数据包 × 3 个工具 = 24 个工具              │
│  • 工具命名: {package}-{action}                  │
│  • 自然语言参数 → REST API 路由                   │
└──────────────────────┬──────────────────────────┘
                       │ HTTP GET
                       ▼
┌─────────────────────────────────────────────────┐
│  InsightHub Backend API (localhost:4000)         │
│                                                 │
│  GET /api/v1/data/{package}/search?q=...         │
│  GET /api/v1/data/{package}/{id}                 │
│  GET /api/v1/data/{package}/stats                │
└─────────────────────────────────────────────────┘
```

**数据流**：
1. 用户在 AI Agent 中提问
2. AI Agent 通过 MCP 协议调用对应工具
3. MCP Server 解析工具名和参数，调用 InsightHub Backend API
4. Backend 返回数据，MCP Server 格式化后返回给 AI Agent
5. AI Agent 将数据整合到回答中

---

## 快速开始

### 前置条件

- Node.js ≥ 18
- InsightHub Backend 运行中（默认 `http://localhost:4000`）

### 安装

```bash
cd mcp-server
npm install
```

### 验证

```bash
# 运行自检测试
npm test

# 预期输出:
# ✅ 工具列表获取成功（24 个工具）
# ✅ finance-macro-stats 调用成功
# ✅ startup-intel-search 调用成功
```

### 启动

```bash
npm start
```

MCP Server 通过 **stdio** 与客户端通信，启动后等待客户端连接。

---

## 客户端配置

### Claude Desktop

编辑配置文件：

- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "insighthub": {
      "command": "node",
      "args": ["/absolute/path/to/insighthub/mcp-server/index.js"],
      "env": {}
    }
  }
}
```

> 使用绝对路径。配置后重启 Claude Desktop。

### Cursor

编辑 `~/.cursor/mcp.json`：

```json
{
  "mcpServers": {
    "insighthub": {
      "command": "node",
      "args": ["/absolute/path/to/insighthub/mcp-server/index.js"],
      "env": {}
    }
  }
}
```

### Cline (VS Code)

在 VS Code 设置中搜索 `cline.mcpServers`，或编辑 `.vscode/settings.json`：

```json
{
  "cline.mcpServers": {
    "insighthub": {
      "command": "node",
      "args": ["/absolute/path/to/insighthub/mcp-server/index.js"],
      "env": {}
    }
  }
}
```

---

## 工具清单

InsightHub MCP Server 暴露 **24 个工具**，按 8 个数据包组织，每个数据包提供 3 个标准操作：

| 数据包 | 搜索工具 | 详情工具 | 统计工具 |
|--------|---------|---------|---------|
| 创业/投融资情报 | `startup-intel-search` | `startup-intel-detail` | `startup-intel-stats` |
| AI 地理空间智能 | `ai-geo-search` | `ai-geo-detail` | `ai-geo-stats` |
| 企业风险监控 | `enterprise-risk-search` | `enterprise-risk-detail` | `enterprise-risk-stats` |
| 金融宏观数据 | `finance-macro-search` | `finance-macro-detail` | `finance-macro-stats` |
| Web3 & 加密市场 | `web3-crypto-search` | `web3-crypto-detail` | `web3-crypto-stats` |
| 政策与招投标 | `policy-bidding-search` | `policy-bidding-detail` | `policy-bidding-stats` |
| 专利与技术创新 | `patent-tech-search` | `patent-tech-detail` | `patent-tech-stats` |
| 教育数据 | `education-search` | `education-detail` | `education-stats` |

---

## 工具详细说明

### 搜索工具 (`{package}-search`)

搜索指定数据包中的数据。

**参数**：

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| query | string | ✅ | — | 搜索关键词，支持自然语言和关键字组合 |
| page | number | ❌ | 1 | 页码，从 1 开始 |
| pageSize | number | ❌ | 10 | 每页条数，最大 50 |

**返回**：

```json
{
  "data": [
    {
      "id": "rec-001",
      "title": "记录标题",
      "summary": "摘要内容...",
      "source": "数据来源",
      "score": 0.95,
      "created_at": "2026-07-14T10:00:00Z"
    }
  ],
  "meta": {
    "total": 142,
    "page": 1,
    "pageSize": 10
  }
}
```

---

### 详情工具 (`{package}-detail`)

获取单条记录的完整数据。

**参数**：

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| id | string | ✅ | 记录唯一标识 ID（通常从搜索结果中获取） |

**返回**：

```json
{
  "id": "rec-001",
  "title": "中国2026年Q2 GDP增长率",
  "content": "完整内容...",
  "metadata": { ... },
  "source": "国家统计局",
  "created_at": "2026-07-14T10:00:00Z"
}
```

---

### 统计工具 (`{package}-stats`)

获取数据包的统计概览。

**参数**：无

**返回**：

```json
{
  "package": "finance-macro",
  "totalRecords": 12580,
  "lastUpdated": "2026-07-14T08:00:00Z",
  "categories": [
    { "name": "GDP", "count": 3200 },
    { "name": "CPI", "count": 2800 }
  ]
}
```

---

## 使用示例

### 示例 1：查询 GDP 数据

在 Claude Desktop 中直接输入：

> "帮我查一下中国最近的 GDP 数据"

Claude 会自动调用 `finance-macro-search`：

```json
{
  "query": "中国 GDP 增长率 2026",
  "pageSize": 5
}
```

### 示例 2：查找创业融资信息

> "最近有哪些AI客服赛道的融资事件？"

Claude 调用 `startup-intel-search`：

```json
{
  "query": "AI客服 融资 2026",
  "pageSize": 10
}
```

### 示例 3：企业风险查询

> "帮我查一下字节跳动的工商信息和风险记录"

Claude 先搜索再查详情：

```
Step 1: enterprise-risk-search → query: "字节跳动"
Step 2: enterprise-risk-detail → id: "ent-bytedance-001"
```

### 示例 4：统计概览

> "金融宏观数据包有多少条记录？"

Claude 调用 `finance-macro-stats`。

---

## 故障排除

### MCP Server 无法启动

```bash
# 检查 Node.js 版本
node --version  # 需要 ≥ 18

# 重新安装依赖
cd mcp-server && rm -rf node_modules && npm install

# 手动测试
npm test
```

### 工具调用返回错误

| 错误信息 | 原因 | 解决方案 |
|---------|------|---------|
| `Backend API error: 404` | Backend API 路径不匹配 | 确认 Backend 运行在 `localhost:4000` |
| `Backend API error: 401` | 需要认证 | 在 env 中配置 API Key（见高级配置） |
| `Backend API error: 500` | Backend 内部错误 | 检查 Backend 日志 |
| `Connection refused` | Backend 未启动 | 启动 Backend: `npm run start:backend` |

### Claude Desktop 未显示工具

1. 确认配置文件路径正确
2. 确认使用绝对路径
3. 重启 Claude Desktop
4. 检查 Claude Desktop 日志（Help → View Logs）

---

## 高级配置

### 自定义 Backend 地址

如果 Backend 不在默认地址，修改 `mcp-server/index.js` 中的常量：

```javascript
const BACKEND_BASE = "https://your-api-domain.com/api/v1/data";
```

### 带认证的 MCP 调用

如需认证，在 MCP Server 中添加 API Key Header：

```javascript
// 修改 callBackend 函数中的 fetch 调用
const response = await fetch(url.toString(), {
  method: "GET",
  headers: {
    Accept: "application/json",
    "X-API-Key": process.env.INSIGHTHUB_API_KEY || "",
  },
});
```

然后在客户端配置中传递环境变量：

```json
{
  "mcpServers": {
    "insighthub": {
      "command": "node",
      "args": ["/path/to/mcp-server/index.js"],
      "env": {
        "INSIGHTHUB_API_KEY": "sk-your-api-key-here"
      }
    }
  }
}
```

### 以 npx 方式运行

```json
{
  "mcpServers": {
    "insighthub": {
      "command": "npx",
      "args": ["@insighthub/mcp-server"],
      "env": {}
    }
  }
}
```

---

## 技术规格

| 项目 | 值 |
|------|-----|
| 协议 | Model Context Protocol (MCP) |
| 传输方式 | stdio |
| SDK | `@modelcontextprotocol/sdk` ^1.29.0 |
| 运行时 | Node.js ≥ 18 (ESM) |
| 工具数量 | 24 (8 数据包 × 3 操作) |
| 数据包 | startup-intel, ai-geo, enterprise-risk, finance-macro, web3-crypto, policy-bidding, patent-tech, education |
| Backend API | `GET /api/v1/data/{package}/{action}` |

---

> 📌 更多 MCP 协议信息请参考：[modelcontextprotocol.io](https://modelcontextprotocol.io)
