# InsightHub Search Engine — 开发计划

## 项目概述

构建一个本地优先的搜索引擎，支持多引擎查询、结果融合、页面抓取和本地缓存。核心目标是 **$0/query、无 API key 依赖**。

---

## 技术架构

```
┌─────────────────────────────────────────────────────────────┐
│                      InsightHub Search                       │
├─────────────────────────────────────────────────────────────┤
│                        API Layer                             │
│                    search() / fetch() / cache()              │
├─────────────────────────────────────────────────────────────┤
│                     Orchestration Layer                      │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │ SearchRouter │  │ FetchRouter │  │ CacheManager        │ │
│  └─────────────┘  └─────────────┘  └─────────────────────┘ │
├─────────────────────────────────────────────────────────────┤
│                       Engine Layer                           │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐   │
│  │Google│ │ Bing │ │ DDG  │ │Baidu │ │Sogou │ │ ...  │   │
│  └──────┘ └──────┘ └──────┘ └──────┘ └──────┘ └──────┘   │
├─────────────────────────────────────────────────────────────┤
│                      Crawler Layer                           │
│           Playwright + Anti-Fingerprint + Proxy              │
├─────────────────────────────────────────────────────────────┤
│                       Storage Layer                          │
│              SQLite (cache) + JSON (config)                  │
└─────────────────────────────────────────────────────────────┘
```

---

## 技术栈

| 层级 | 技术 | 理由 |
|-----|------|------|
| **语言** | TypeScript + Node.js | 生态成熟，AI 生成效率高 |
| **爬虫** | Playwright | 官方维护，反检测能力最强 |
| **缓存** | SQLite (better-sqlite3) | 零配置，本地运行 |
| **排序** | 自实现 RRF + 可选 Cohere | 开源算法 + 可选商业增强 |
| **包管理** | pnpm | 快速，节省磁盘 |
| **构建** | tsup | 快速，支持 ESM/CJS |
| **测试** | vitest | 快速，TypeScript 原生 |

---

## 模块设计

### 模块 1：搜索引擎适配器

**目标**：为每个搜索引擎创建独立的适配器，统一接口。

```typescript
// 接口定义
interface SearchEngine {
  name: string;
  search(query: string, options?: SearchOptions): Promise<SearchResult[]>;
}

interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  engine: string;
  rank: number;
}

interface SearchOptions {
  limit?: number;
  language?: string;
  region?: string;
  timeRange?: 'day' | 'week' | 'month' | 'year';
}
```

**实现清单**：

| 优先级 | 引擎 | 实现方式 | 难度 |
|-------|------|---------|------|
| P0 | Google | Playwright 抓取 | ⭐⭐ |
| P0 | Bing | Playwright 抓取 | ⭐⭐ |
| P0 | DuckDuckGo | 官方 API (无需 key) | ⭐ |
| P1 | Baidu | Playwright 抓取 | ⭐⭐ |
| P1 | Sogou | Playwright 抓取 | ⭐⭐ |
| P2 | Brave Search | 官方 API (免费额度) | ⭐ |
| P2 | Yandex | Playwright 抓取 | ⭐⭐⭐ |

**文件结构**：
```
src/engines/
├── types.ts           # 类型定义
├── base.ts            # 基类（可选）
├── google.ts
├── bing.ts
├── duckduckgo.ts
├── baidu.ts
├── sogou.ts
└── index.ts           # 导出和注册
```

---

### 模块 2：Rank Fusion 算法

**目标**：将多个引擎的结果合并为统一排序。

**算法**：Reciprocal Rank Fusion (RRF)

```
RRF_score(d) = Σ 1 / (k + rank_i(d))

其中：
- k = 60 (常数，论文推荐值)
- rank_i(d) = 文档 d 在第 i 个引擎中的排名
```

**实现清单**：

```typescript
// src/ranker/fusion.ts
export function reciprocalRankFusion(
  resultsArrays: SearchResult[][],
  options?: { k?: number }
): ScoredResult[];

// src/ranker/dedup.ts
export function deduplicateResults(
  results: ScoredResult[]
): ScoredResult[];

// src/ranker/score.ts
export function normalizeScores(
  results: ScoredResult[]
): ScoredResult[];
```

---

### 模块 3：页面抓取器

**目标**：使用 Playwright 抓取页面内容，支持反检测。

**功能清单**：

| 功能 | 说明 | 优先级 |
|-----|------|-------|
| 基础抓取 | 获取 HTML 内容 | P0 |
| 内容提取 | 提取正文（Readability） | P0 |
| 反指纹 | 随机化浏览器指纹 | P1 |
| 代理支持 | HTTP/SOCKS5 代理 | P1 |
| 速率限制 | 每域名请求间隔 | P0 |
| 重试机制 | 失败自动重试 | P1 |
| robots.txt | 遵守爬虫协议 | P0 |

**文件结构**：
```
src/crawler/
├── types.ts
├── fetcher.ts          # 核心抓取逻辑
├── extractor.ts        # 内容提取（Readability）
├── fingerprint.ts      # 反指纹
├── rate-limiter.ts     # 速率限制
├── robots.ts           # robots.txt 解析
└── index.ts
```

---

### 模块 4：本地缓存

**目标**：缓存搜索结果和页面内容，减少重复请求。

**数据模型**：

```sql
-- 搜索结果缓存
CREATE TABLE search_cache (
  query TEXT PRIMARY KEY,
  results TEXT NOT NULL,      -- JSON
  engine TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME
);

-- 页面内容缓存
CREATE TABLE page_cache (
  url TEXT PRIMARY KEY,
  content TEXT NOT NULL,
  title TEXT,
  fetched_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME
);
```

**实现清单**：

```typescript
// src/cache/search-cache.ts
export class SearchCache {
  get(query: string): SearchResult[] | null;
  set(query: string, results: SearchResult[], ttl?: number): void;
  has(query: string): boolean;
  clear(): void;
}

// src/cache/page-cache.ts
export class PageCache {
  get(url: string): string | null;
  set(url: string, content: string, ttl?: number): void;
}
```

---

### 模块 5：主入口 API

**目标**：提供简洁的 API 供外部调用。

```typescript
// src/index.ts
export async function search(query: string, options?: SearchOptions): Promise<SearchResult[]>;
export async function fetch(url: string, options?: FetchOptions): Promise<PageContent>;
export async function searchAndFetch(query: string): Promise<EnrichedResult[]>;
```

---

## 分阶段交付计划

### Phase 1：MVP（3-5 天）

**目标**：最小可用的搜索能力

| 天数 | 任务 | 交付物 |
|-----|------|-------|
| Day 1 | 项目初始化 + Google/Bing/DDG 适配器 | 3 个可用的搜索引擎 |
| Day 2 | RRF 算法 + 结果去重 | 融合排序功能 |
| Day 3 | 基础爬虫 + 内容提取 | 能抓取页面内容 |
| Day 4 | SQLite 缓存 | 搜索结果缓存 |
| Day 5 | 主 API 集成 + 测试 | 可调用的 search() 函数 |

**验收标准**：
- [ ] `search("typescript")` 返回融合后的结果
- [ ] 结果包含 title, url, snippet, score
- [ ] 重复搜索走缓存
- [ ] 能抓取任意 URL 的正文内容

---

### Phase 2：增强（1-2 周）

**目标**：提升搜索质量和稳定性

| 任务 | 说明 |
|-----|------|
| 反指纹技术 | 随机化浏览器指纹 |
| 代理支持 | HTTP/SOCKS5 代理池 |
| 速率限制 | 每域名限速 |
| robots.txt | 遵守爬虫协议 |
| 更多引擎 | 百度、搜狗、Brave |
| 错误处理 | 重试、降级、日志 |

---

### Phase 3：高级功能（可选）

| 功能 | 说明 |
|-----|------|
| ML Reranking | 使用 Cohere 或开源模型 |
| 向量搜索 | 语义搜索能力 |
| Research Loop | 自动化研究流程 |
| API Server | REST/MCP 接口 |

---

## 目录结构

```
insighthub-search/
├── src/
│   ├── engines/              # 搜索引擎适配器
│   │   ├── types.ts
│   │   ├── google.ts
│   │   ├── bing.ts
│   │   ├── duckduckgo.ts
│   │   └── index.ts
│   ├── ranker/               # 排序融合
│   │   ├── fusion.ts
│   │   ├── dedup.ts
│   │   └── index.ts
│   ├── crawler/              # 页面抓取
│   │   ├── fetcher.ts
│   │   ├── extractor.ts
│   │   ├── fingerprint.ts
│   │   └── index.ts
│   ├── cache/                # 本地缓存
│   │   ├── search-cache.ts
│   │   ├── page-cache.ts
│   │   └── index.ts
│   └── index.ts              # 主入口
├── tests/
│   ├── engines/
│   ├── ranker/
│   ├── crawler/
│   └── cache/
├── package.json
├── tsconfig.json
└── README.md
```

---

## 依赖清单

```json
{
  "dependencies": {
    "playwright": "^1.40.0",
    "better-sqlite3": "^9.4.0",
    "@mozilla/readability": "^0.5.0",
    "jsdom": "^24.0.0",
    "undici": "^6.0.0"
  },
  "devDependencies": {
    "typescript": "^5.3.0",
    "tsup": "^8.0.0",
    "vitest": "^1.0.0",
    "@types/better-sqlite3": "^7.6.0"
  }
}
```

---

## 风险与应对

| 风险 | 影响 | 应对 |
|-----|------|------|
| 搜索引擎反爬 | 搜索失败 | 多引擎降级 + 代理池 |
| 页面结构变化 | 提取失败 | 多选择器 + 定期维护 |
| 法律风险 | 侵权指控 | 独立实现 + 不复制代码 |
| 性能问题 | 响应慢 | 缓存 + 并发控制 |

---

## 法律合规检查清单

- [ ] 所有代码独立编写，未复制 wigolo 源码
- [ ] 使用公开算法（RRF 有论文引用）
- [ ] 使用公开库（Playwright、SQLite）
- [ ] 不使用 "wigolo" 商标名
- [ ] 遵守 robots.txt 协议
- [ ] 控制请求频率，不造成服务器压力

---

## 决策记录

| 决策项 | 选择 | 理由 |
|-------|------|------|
| **项目位置** | InsightHub3/search-engine/ | 统一管理 |
| **Phase 1 引擎** | Google + Bing + DDG | 覆盖主流，DDG 有免费 API |
| **代理支持** | Phase 2 再加 | MVP 先裸连，降低复杂度 |

## 下一步行动

1. **立即开始** — 用户确认方案后直接启动 Phase 1
2. **逐模块实现** — 每个模块独立生成，独立测试
3. **迭代验证** — 每完成一个功能立即验证
4. **持续集成** — 边写边测试，不积压
