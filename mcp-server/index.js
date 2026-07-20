#!/usr/bin/env node

/**
 * InsightHub MCP Server
 *
 * 将 InsightHub 的 8 大数据包（24 个工具）接入 MCP 协议，
 * 供 Claude Desktop、Cursor、Cline 等 AI Agent 调用。
 *
 * 数据包：
 *   startup-intel   创业/投融资情报
 *   ai-geo          AI 地理空间智能
 *   enterprise-risk 企业风险监控
 *   finance-macro   金融宏观数据
 *   web3-crypto     Web3 & 加密市场
 *   policy-bidding  政策与招投标
 *   patent-tech     专利与技术创新
 *   education       教育数据
 *
 * 每个数据包暴露 3 个工具：
 *   {package}-search   搜索
 *   {package}-detail   详情
 *   {package}-stats    统计
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  ListToolsRequestSchema,
  ListToolsResultSchema,
  CallToolRequestSchema,
  CallToolResultSchema,
  ErrorCode,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";

// ---------------------------------------------------------------------------
// 配置
// ---------------------------------------------------------------------------

const BACKEND_BASE = process.env.INSIGHTHUB_BACKEND_URL || "http://localhost:4000/api/v1/data";

const PACKAGES = [
  {
    id: "startup-intel",
    label: "创业/投融资情报",
    description: "初创公司融资、并购、估值、赛道分析等投融资情报数据",
  },
  {
    id: "ai-geo",
    label: "AI 地理空间智能",
    description: "基于 AI 的地理空间分析、遥感数据、位置智能等信息",
  },
  {
    id: "enterprise-risk",
    label: "企业风险监控",
    description: "企业信用风险、经营异常、法律诉讼等风险监控数据",
  },
  {
    id: "finance-macro",
    label: "金融宏观数据",
    description: "宏观经济指标、利率、汇率、通胀、GDP 等金融市场数据",
  },
  {
    id: "web3-crypto",
    label: "Web3 & 加密市场",
    description: "加密货币行情、链上数据、DeFi 协议、NFT 市场等 Web3 数据",
  },
  {
    id: "policy-bidding",
    label: "政策与招投标",
    description: "政策法规、招投标公告、政府采购等政务公开信息",
  },
  {
    id: "patent-tech",
    label: "专利与技术创新",
    description: "专利检索、技术趋势、创新图谱等知识产权数据",
  },
  {
    id: "education",
    label: "教育数据",
    description: "教育资源、课程数据、学术研究、教育政策等信息",
  },
];

// ---------------------------------------------------------------------------
// 构建工具定义
// ---------------------------------------------------------------------------

function buildToolDefinitions() {
  const tools = [];

  for (const pkg of PACKAGES) {
    // 1) search
    tools.push({
      name: `${pkg.id}-search`,
      description: `搜索${pkg.label}数据 – ${pkg.description}`,
      inputSchema: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "搜索关键词，支持自然语言和关键字组合",
          },
          page: {
            type: "number",
            description: "页码，从 1 开始（默认 1）",
            default: 1,
          },
          pageSize: {
            type: "number",
            description: "每页返回条数（默认 10，最大 50）",
            default: 10,
          },
        },
        required: ["query"],
      },
    });

    // 2) detail
    tools.push({
      name: `${pkg.id}-detail`,
      description: `获取${pkg.label}中某条记录的详细数据 – ${pkg.description}`,
      inputSchema: {
        type: "object",
        properties: {
          id: {
            type: "string",
            description: "记录唯一标识 ID",
          },
        },
        required: ["id"],
      },
    });

    // 3) stats
    tools.push({
      name: `${pkg.id}-stats`,
      description: `获取${pkg.label}的统计概览（记录总数、更新时间等）– ${pkg.description}`,
      inputSchema: {
        type: "object",
        properties: {},
      },
    });
  }

  return tools;
}

// ---------------------------------------------------------------------------
// 调用后端 API
// ---------------------------------------------------------------------------

async function callBackend(packageName, action, params) {
  // 根据 action 构建路径和后端参数
  //    search → GET /{package}/search?q=&page=&limit=
  //    detail → GET /{package}/{id}
  //    stats  → GET /{package}/stats
  let pathSuffix = "";
  const queryParams = {};

  if (action === "search") {
    pathSuffix = "/search";
    queryParams.q = params.query ?? params.q;
    queryParams.page = params.page ?? 1;
    queryParams.limit = params.pageSize ?? params.limit ?? 10;
  } else if (action === "detail") {
    pathSuffix = `/${encodeURIComponent(String(params.id))}`;
  } else if (action === "stats") {
    pathSuffix = "/stats";
    // 后端 stats 目前无需额外参数
  }

  const url = new URL(
    `${BACKEND_BASE}/${encodeURIComponent(packageName)}${pathSuffix}`,
  );

  for (const [key, value] of Object.entries(queryParams)) {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  }

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "");
    throw new Error(
      `Backend API error: ${response.status} ${response.statusText}${
        errorBody ? ` – ${errorBody.slice(0, 500)}` : ""
      }`,
    );
  }

  const body = await response.json();

  // 后端统一返回 { success, data, meta? }
  // 如果是失败响应则报错
  if (!body.success) {
    const err = body.error ?? {};
    throw new Error(
      `Backend error: ${err.code ?? "UNKNOWN"} – ${err.message ?? "未知错误"}`,
    );
  }

  // 返回 data，并带上 meta（如果有分页信息）
  if (body.meta) {
    return {
      data: body.data,
      meta: body.meta,
    };
  }
  return body.data;
}

// ---------------------------------------------------------------------------
// 处理工具调用
// ---------------------------------------------------------------------------

async function handleToolCall(name, args) {
  // 解析 package name 和 action
  // 工具名格式: {package}-{action}，action ∈ {search, detail, stats}
  const validActions = ["search", "detail", "stats"];
  let packageName = null;
  let action = null;

  // Try matching from the end: find the last dash and check if suffix is a valid action
  for (const act of validActions) {
    if (name.endsWith(`-${act}`)) {
      packageName = name.slice(0, name.length - act.length - 1);
      action = act;
      break;
    }
  }

  if (!packageName || !action) {
    throw new McpError(
      ErrorCode.MethodNotFound,
      `Unknown tool: ${name}. Expected format: {package}-{search|detail|stats}`,
    );
  }

  // 验证 package 存在
  const pkg = PACKAGES.find((p) => p.id === packageName);
  if (!pkg) {
    throw new McpError(
      ErrorCode.MethodNotFound,
      `Unknown data package: ${packageName}`,
    );
  }

  try {
    const result = await callBackend(packageName, action, args);
    return CallToolResultSchema.parse({
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2),
        },
      ],
      isError: false,
    });
  } catch (err) {
    // 如果是 McpError 则直接透传
    if (err instanceof McpError) throw err;

    return CallToolResultSchema.parse({
      content: [
        {
          type: "text",
          text: `Error calling ${packageName}-${action}: ${err.message}`,
        },
      ],
      isError: true,
    });
  }
}

// ---------------------------------------------------------------------------
// 导出（供测试和外部模块使用）
// ---------------------------------------------------------------------------

export { PACKAGES, buildToolDefinitions, callBackend, handleToolCall };

// ---------------------------------------------------------------------------
// 主入口
// ---------------------------------------------------------------------------

async function main() {
  const server = new Server(
    {
      name: "@insighthub/mcp-server",
      version: "1.0.0",
    },
    {
      capabilities: {
        tools: {},
      },
    },
  );

  // ---- 列出所有工具 ----
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    const tools = buildToolDefinitions();
    return ListToolsResultSchema.parse({ tools });
  });

  // ---- 调用工具 ----
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    return handleToolCall(name, args ?? {});
  });

  // ---- 启动 ----
  const transport = new StdioServerTransport();
  await server.connect(transport);

  // stderr 日志（stdio 传输模式下，stdout 被 MCP 协议占用）
  console.error(`InsightHub MCP Server v1.0.0 started`);
  console.error(`  Packages: ${PACKAGES.length}`);
  console.error(`  Tools: ${PACKAGES.length * 3}`);
  console.error(`  Backend: ${BACKEND_BASE}`);
}

// 仅在直接运行时启动 stdio server，导入时不启动
// process.argv[1] 在直接运行时等于当前文件路径
const _selfPath = new URL(import.meta.url).pathname;
if (process.argv[1] && process.argv[1] === _selfPath) {
  main().catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
  });
}
