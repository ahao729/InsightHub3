# InsightHub Data — AI 数据能力平台

> 面向企业级用户的多维数据智能平台，提供 9 大数据包、AI 驱动的 RAG 分析引擎、MCP Server 接入、Scrapy 爬虫管线，以及完整的用户/订阅/API Key 管理体系。

## 目录

- [功能亮点](#功能亮点)
- [技术栈](#技术栈)
- [项目结构](#项目结构)
- [快速开始](#快速开始)
  - [环境要求](#环境要求)
  - [一键启动（Docker）](#一键启动docker)
  - [本地开发](#本地开发)
- [环境变量配置](#环境变量配置)
- [数据库](#数据库)
- [API 文档](#api-文档)
- [数据包总览](#数据包总览)
- [MCP Server 接入](#mcp-server-接入)
- [爬虫模块](#爬虫模块)
- [测试](#测试)
- [前端页面](#前端页面)
- [Docker 部署](#docker-部署)
- [许可证](#许可证)

---

## 功能亮点

| 能力 | 说明 |
|------|------|
| **9 大数据包** | 创业商业情报、企业风控、金融宏观、专利科技、政策招投标、AI/GEO 分析、教育、Web3/Crypto、跨境电商 |
| **AI RAG 分析** | 检索增强生成 —— 基于数据包上下文的深度分析、快速分析、对比分析 |
| **多 LLM Provider** | OpenAI / DeepSeek / Anthropic / 智谱 GLM，自动 fallback 链 |
| **MCP Server** | 24 个工具（8 数据包 × 3 操作），接入 Claude Desktop、Cursor、Cline 等 AI Agent |
| **Scrapy 爬虫** | 10 个爬虫（ArXiv、CoinGecko、GDELT、OpenCorporates、世界银行等），支持定时/按需运行 |
| **Token 可观测性** | Langfuse 集成 + Token 用量追踪 + 限速控制 |
| **订阅体系** | 免费/专业/企业三档，JWT 认证 + API Key 管理 |
| **容器化部署** | Docker Compose 编排，PostgreSQL + Express + Nginx + Scrapy |

---

## 技术栈

| 层 | 技术 |
|----|------|
| 前端 | HTML / CSS / JavaScript, Vite 8 (MPA), Nginx |
| 后端 | Node.js 20, Express 4, JWT, Helmet, CORS |
| 数据库 | PostgreSQL 16 (Alpine) |
| AI / LLM | OpenAI SDK, DeepSeek, Anthropic, 智谱 GLM, Langfuse |
| 爬虫 | Python 3.11, Scrapy, psycopg2, Pydantic |
| MCP | `@modelcontextprotocol/sdk` |
| 测试 | Jest 30, Supertest 7 |
| 部署 | Docker, Docker Compose, Nginx reverse proxy |

---

## 项目结构

```
InsightHub3/
├── frontend (根目录)
│   ├── *.html                    # 24 个 MPA 页面
│   ├── assets/                   # CSS / JS 资源
│   │   ├── admin.css
│   │   ├── dashboard.css
│   │   ├── tokens.css
│   │   ├── api-client.js         # API 请求封装
│   │   ├── drawer.js
│   │   └── stub-runtime.js
│   ├── public/                   # 静态资源
│   ├── vite.config.js            # Vite 多页面配置
│   └── package.json
│
├── backend/
│   ├── src/
│   │   ├── index.js              # Express 入口
│   │   ├── config.js             # 集中配置
│   │   ├── db/
│   │   │   ├── init.sql          # 建表 + 种子数据
│   │   │   ├── migrate.js        # 迁移脚本
│   │   │   ├── pool.js           # PG 连接池
│   │   │   └── seed.js
│   │   ├── routes/
│   │   │   ├── auth.js           # 注册/登录/找回密码
│   │   │   ├── apiKeys.js        # API Key CRUD
│   │   │   ├── subscriptions.js  # 订阅管理
│   │   │   ├── dataPackages.js   # 数据包通用路由
│   │   │   ├── dashboard.js      # 仪表盘统计
│   │   │   ├── admin.js          # 管理后台
│   │   │   └── analyze.js        # RAG/快速/对比分析
│   │   ├── services/
│   │   │   ├── llmService.js     # 多 Provider LLM 路由
│   │   │   ├── ragService.js     # RAG 检索 + LLM 合成
│   │   │   ├── embeddingService.js
│   │   │   ├── tokenUsage.js     # Token 用量追踪
│   │   │   ├── emailService.js
│   │   │   ├── dataService.js
│   │   │   └── [9 个数据包服务].js
│   │   ├── middleware/
│   │   │   ├── auth.js           # JWT + API Key 认证
│   │   │   ├── rateLimit.js      # 全局限速
│   │   │   ├── authRateLimit.js  # 认证接口限速
│   │   │   └── errorHandler.js   # 统一错误处理
│   │   └── __tests__/            # Jest 测试 (10 个文件)
│   ├── seed/                     # 增量种子 SQL
│   ├── Dockerfile
│   └── package.json
│
├── crawler/
│   ├── spiders/                  # 10 个 Scrapy 爬虫
│   │   ├── arxiv_papers.py       # ArXiv 学术论文
│   │   ├── coingecko_web3.py     # CoinGecko 加密数据
│   │   ├── gdelt_news.py         # GDELT 全球新闻
│   │   ├── opencorporates_risk.py # OpenCorporates 企业
│   │   ├── policy_regulations.py # 政策法规
│   │   ├── public_company.py     # 上市公司
│   │   ├── uncomtrade_crossborder.py # UN Comtrade 跨境贸易
│   │   ├── unesco_education.py   # UNESCO 教育数据
│   │   ├── uspto_patents.py      # USPTO 专利
│   │   └── world_bank.py         # 世界银行宏观
│   ├── crawl_scheduler.py        # 定时调度
│   ├── run_spider.py             # 单爬虫运行
│   ├── requirements.txt
│   ├── Dockerfile
│   └── README-crawler.md
│
├── mcp-server/
│   ├── index.js                  # MCP Server 主入口 (24 个工具)
│   ├── package.json
│   └── README-crawler.md
│
├── docker-compose.yml            # 生产编排 (db / backend / frontend / crawler)
├── Dockerfile                    # 前端多阶段构建
├── nginx.conf                    # Nginx 反向代理配置
├── .env.example                  # 环境变量模板
└── package.json                  # 前端构建脚本
```

---

## 快速开始

### 环境要求

- **Node.js** >= 20
- **Python** >= 3.11（仅爬虫需要）
- **PostgreSQL** >= 16（或使用 Docker）
- **Docker** & **Docker Compose**（推荐一键部署）

### 一键启动（Docker）

```bash
# 1. 复制环境变量
cp .env.example .env

# 2. 编辑 .env，至少配置以下项：
#    DB_PASSWORD, JWT_SECRET, OPENAI_API_KEY（或 DEEPSEEK_API_KEY）

# 3. 启动全部服务
docker compose up -d

# 4. 访问
#    前端: http://localhost
#    API:  http://localhost:4000/api/health
```

### 本地开发

```bash
# ── 前端 ──
npm install
npm run dev          # Vite dev server → http://localhost:3000

# ── 后端 ──
cd backend
npm install
cp ../.env.example .env   # 编辑 DATABASE_URL 等
npm run migrate      # 初始化数据库
npm run seed         # 填充种子数据（可选）
npm run dev          # Express → http://localhost:4000

# ── 爬虫（可选）──
cd crawler
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python crawl_scheduler.py --all --dev
```

---

## 环境变量配置

完整模板见 [`.env.example`](.env.example)，核心变量：

| 变量 | 必填 | 说明 |
|------|------|------|
| `DB_PASSWORD` | ✅ | PostgreSQL 密码 |
| `JWT_SECRET` | ✅ | JWT 签名密钥 |
| `OPENAI_API_KEY` | ⚡ | OpenAI API Key（至少配一个 LLM Provider） |
| `DEEPSEEK_API_KEY` | ⚡ | DeepSeek API Key（默认用于 reasoning 任务） |
| `ANTHROPIC_API_KEY` | | Anthropic Claude Key（fallback） |
| `ZHIPU_API_KEY` | | 智谱 GLM Key（fallback） |
| `PORT` | | Nginx 监听端口，默认 `80` |
| `CORS_ORIGINS` | | CORS 允许源，默认 `http://localhost:80` |
| `LLM_MOCK_MODE` | | 设为任意值强制 Mock 模式（无 LLM 额度时使用） |
| `LANGFUSE_*` | | Langfuse 可观测性配置（可选） |

---

## 数据库

- **引擎**: PostgreSQL 16 (Alpine)
- **Schema 定义**: `backend/src/db/init.sql`
- **迁移工具**: `npm run migrate`（自动建库 + 建表 + 增量迁移）
- **种子数据**: init.sql 内置 3 档订阅计划 + 8 个数据源 + 示例数据

### 核心表

| 表名 | 用途 |
|------|------|
| `users` | 用户账号（邮箱、密码哈希、角色） |
| `api_keys` | API 密钥管理 |
| `subscription_plans` | 订阅计划（免费/专业/企业） |
| `subscriptions` | 用户订阅记录 |
| `token_usage` | LLM Token 用量追踪 |
| `usage_logs` | API 调用日志 |
| `monitors` | 用户监控任务 |

### 数据包表

| 表名 | 对应数据包 |
|------|-----------|
| `market_news` | 创业商业情报 / AI-GEO |
| `company_profiles` | 企业风控 |
| `financial_indicators` | 金融宏观 |
| `patents` | 专利科技 |
| `policy_documents` | 政策招投标 |
| `educational_data` | 教育 |
| `web3_data` | Web3 / Crypto |
| （通过 service 层扩展） | 跨境电商 |

---

## API 文档

### 基础信息

- **Base URL**: `http://localhost:4000/api/v1`
- **认证**: JWT Bearer Token 或 `X-API-Key` Header
- **健康检查**: `GET /api/health`

### 路由一览

| 方法 | 路径 | 认证 | 说明 |
|------|------|------|------|
| POST | `/auth/register` | ✗ | 注册 |
| POST | `/auth/login` | ✗ | 登录 |
| POST | `/auth/forgot-password` | ✗ | 找回密码 |
| GET | `/api-keys` | ✓ | 获取 API Key 列表 |
| POST | `/api-keys` | ✓ | 创建 API Key |
| GET | `/subscriptions` | ✓ | 查看订阅 |
| GET | `/dashboard` | ✓ | 仪表盘统计 |
| GET | `/data/:package/stats` | ○ | 数据包统计 |
| GET | `/data/:package/search` | ○ | 数据包搜索 |
| GET | `/data/:package/:id` | ○ | 数据包详情 |
| POST | `/analyze/rag` | ✓ | RAG 深度分析 |
| POST | `/analyze/quick` | ✓ | 快速分析 |
| POST | `/analyze/compare` | ✓ | 对比分析 |
| GET | `/analyze/token-usage` | ✓ | Token 用量 |
| GET | `/admin/*` | ✓ (admin) | 管理后台 |

> `✓` 必须认证 | `○` 可选认证 | `✗` 无需认证

---

## 数据包总览

| # | 代码 | 名称 | 说明 |
|---|------|------|------|
| 1 | `startup-intel` | 创业商业情报 | 初创公司融资、并购、估值、赛道分析 |
| 2 | `enterprise-risk` | 企业风控 | 企业信用风险、经营异常、法律诉讼 |
| 3 | `finance-macro` | 金融宏观 | 宏观经济指标、利率、汇率、通胀、GDP |
| 4 | `patent-tech` | 专利科技 | 专利检索、技术趋势、创新图谱 |
| 5 | `policy-bidding` | 政策招投标 | 政策法规、招投标公告、政府采购 |
| 6 | `ai-geo` | AI/GEO 分析 | AI 行业动态、地理空间数据、区域经济 |
| 7 | `education` | 教育 | 全球教育机构、课程项目、学术资源 |
| 8 | `web3-crypto` | Web3/Crypto | 加密货币行情、链上数据、DeFi/NFT |
| 9 | `crossborder-ecommerce` | 跨境电商 | 跨境贸易数据、关税、供应链分析 |

---

## MCP Server 接入

MCP Server 将 8 大数据包（24 个工具）接入 [Model Context Protocol](https://modelcontextprotocol.io)，供 AI Agent 直接调用。

### 安装

```bash
cd mcp-server
npm install
```

### 工具列表（24 个）

每个数据包暴露 3 个工具：

| 工具名 | 说明 |
|--------|------|
| `{package}-search` | 搜索数据（支持自然语言） |
| `{package}-detail` | 获取单条记录详情 |
| `{package}-stats` | 获取数据包统计概览 |

示例：`startup-intel-search`、`finance-macro-stats`、`enterprise-risk-detail`

### Claude Desktop 配置

在 `~/.claude/claude_desktop_config.json` 中添加：

```json
{
  "mcpServers": {
    "insighthub": {
      "command": "node",
      "args": ["/path/to/insighthub3/mcp-server/index.js"],
      "env": {
        "BACKEND_BASE": "http://localhost:4000/api/v1/data"
      }
    }
  }
}
```

---

## 爬虫模块

基于 Scrapy 的数据采集管线，支持 10 个数据源：

| 爬虫 | 数据源 | 目标表 |
|------|--------|--------|
| `arxiv_papers` | ArXiv | market_news |
| `coingecko_web3` | CoinGecko | web3_data |
| `gdelt_news` | GDELT | market_news |
| `opencorporates_risk` | OpenCorporates | company_profiles |
| `policy_regulations` | 政策法规 | policy_documents |
| `public_company` | 上市公司 | company_profiles |
| `uncomtrade_crossborder` | UN Comtrade | （跨境电商） |
| `unesco_education` | UNESCO | educational_data |
| `uspto_patents` | USPTO | patents |
| `world_bank` | 世界银行 | financial_indicators |

### 运行方式

```bash
# 单独运行某个爬虫
cd crawler
python run_spider.py arxiv_papers

# 定时调度器
python crawl_scheduler.py --all --dev

# Docker（按需启动）
docker compose --profile crawler run --rm crawler
```

---

## 测试

```bash
# 后端测试
cd backend
npm test                    # 运行全部测试
npm run test:watch          # 监听模式
npm run test:coverage       # 覆盖率报告
```

测试套件（10 个文件）：

| 测试文件 | 覆盖范围 |
|----------|---------|
| `auth.routes.test.js` | 注册/登录/密码找回 |
| `apiKeys.routes.test.js` | API Key CRUD |
| `dashboard.routes.test.js` | 仪表盘接口 |
| `dataPackages.routes.test.js` | 数据包搜索/详情/统计 |
| `dataService.test.js` | 数据服务层 |
| `llmService.test.js` | LLM 路由 + fallback |
| `ragService.test.js` | RAG 分析引擎 |
| `embeddingService.test.js` | Embedding 服务 |
| `startupIntel.test.js` | 创业情报数据包 |
| `tokenUsage.test.js` | Token 用量追踪 |

---

## 前端页面

共 24 个 MPA 页面，Vite 自动扫描根目录 `*.html` 作为入口：

| 页面 | 说明 |
|------|------|
| `index.html` | 首页 |
| `auth.html` | 登录/注册 |
| `dashboard.html` | 用户仪表盘 |
| `admin.html` | 管理后台 |
| `marketplace.html` | 数据市场 |
| `pricing.html` | 定价方案 |
| `solutions.html` | 解决方案 |
| `checkout.html` | 结算页 |
| `api-docs.html` | API 文档 |
| `report-generator.html` | AI 报告生成 |
| `mcp-guide.html` | MCP 接入指南 |
| `blog.html` / `status.html` | 博客 / 状态页 |
| `privacy.html` / `terms.html` | 隐私 / 条款 |
| `package-*.html` (×9) | 各数据包详情页 |

---

## Docker 部署

### 服务编排

| 服务 | 镜像/构建 | 端口 | 说明 |
|------|----------|------|------|
| `db` | postgres:16-alpine | 5432 (内部) | 数据库 |
| `backend` | ./backend | 4000 (内部) | API 服务 |
| `frontend` | ./ (根 Dockerfile) | `${PORT:-80}` | Nginx 静态 + 反向代理 |
| `crawler` | ./crawler | - | 爬虫（按需启动） |

### 常用命令

```bash
# 启动（不含爬虫）
docker compose up -d

# 含爬虫
docker compose --profile crawler up -d

# 查看日志
docker compose logs -f backend

# 停止
docker compose down

# 停止并清除数据
docker compose down -v
```

### 架构图

```
                    ┌─────────────┐
                    │   Browser   │
                    └──────┬──────┘
                           │ :80
                    ┌──────▼──────┐
                    │   Nginx     │  ← frontend container
                    │ (static +   │
                    │  /api proxy)│
                    └──────┬──────┘
                           │ :4000
                    ┌──────▼──────┐
                    │  Express    │  ← backend container
                    │  API Server │
                    └──┬───────┬──┘
                       │       │
              ┌────────▼─┐  ┌──▼──────────┐
              │ PostgreSQL│  │ LLM Providers│
              │    :5432  │  │ (OpenAI/DS/..)│
              └──────────┘  └──────────────┘
```

---

## Production Deployment

### Quick Start
```bash
# 1. Clone and install
git clone <repo-url> && cd InsightHub3
cp .env.example .env  # Edit with your values

# 2. Start with Docker
docker compose up -d

# 3. Initialize database
docker compose exec backend node src/db/migrate.js
```

### MCP Server Setup (for AI Agents)
```bash
cd mcp-server
npm install
# Configure in Claude Desktop / Cursor settings:
# command: "node"
# args: ["/path/to/mcp-server/index.js"]
# env: { "INSIGHTHUB_BACKEND_URL": "http://your-backend:4000/api/v1/data" }
```

### Environment Variables
| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `JWT_SECRET` | Yes (prod) | Min 32 chars, used for auth tokens |
| `ADMIN_DEFAULT_PASSWORD` | Recommended | Override default admin password |
| `ADMIN_INVITE_CODE` | Yes (prod) | Code for admin registration |
| `SMTP_HOST/USER/PASS` | Recommended | Email service for password reset |
| `INSIGHTHUB_BACKEND_URL` | No | MCP server backend URL (default: localhost:4000) |

---

## 许可证

ISC
