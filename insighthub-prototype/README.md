# InsightHub Data — 前端原型（HTML/CSS/JS）

本目录是 InsightHub Data 平台的完整可交互原型，共 **19 个页面**，对应产品需求文档（PRD）中描述的全部前台、账户与工作台模块。所有页面均为纯静态 HTML，可直接在浏览器中双击打开，无需安装任何依赖或启动服务器。

## 如何查看

直接用浏览器打开 `index.html`（首页），通过页面内的导航链接即可在全部 19 个页面之间跳转体验完整流程。也可以单独打开任意页面查看。

## 页面清单

| 文件 | 页面 | 说明 |
|---|---|---|
| `index.html` | 首页 | 产品定位、数据包入口、平台架构、定价摘要 |
| `marketplace.html` | 数据产品市场 | 10 个数据包列表，含搜索/筛选/排序 |
| `package-startup-intel.html` | 创业商业情报包详情页 | 含可交互 Demo |
| `package-ai-geo.html` | AI / GEO 数据包详情页 | 含可交互 Demo（评分圆环动画） |
| `package-enterprise-risk.html` | 企业情报与风控包详情页 | 含可交互 Demo（风险评分随机切换） |
| `package-finance-macro.html` | 金融宏观数据包详情页 | 含 Chart.js 指标走势图 |
| `package-web3-crypto.html` | Web3 / Crypto 数据包详情页 | 规划中状态展示 |
| `package-policy-bidding.html` | 政策与招投标数据包详情页 | 规划中状态展示 |
| `package-patent-tech.html` | 技术专利趋势数据包详情页 | 含 Chart.js 专利趋势图 |
| `package-education.html` | 教育与选校数据包详情页 | 规划中状态展示 |
| `solutions.html` | 行业解决方案页 | 4 个场景方案 Tab 切换 |
| `pricing.html` | 定价对比页 | 5 档套餐 × 19 项功能矩阵 |
| `api-docs.html` | API 文档中心 | 三栏布局，多语言代码示例 |
| `status.html` | 接口状态页 | 服务状态监控展示 |
| `auth.html` | 注册 / 登录页 | 含密码强度检测 |
| `checkout.html` | 订阅结账页 | 套餐选择、数据包勾选、价格联动 |
| `dashboard.html` | 用户工作台 | 总览 / API Keys / 报告中心 / 监控任务 |
| `report-generator.html` | AI 报告生成器 | 模拟流式生成效果 |
| `mcp-guide.html` | MCP 接入指南 | 4 个客户端配置代码自动生成 |

## 目录结构

```
insighthub-prototype/
├── index.html                       # 首页（建议从这里开始）
├── marketplace.html
├── package-*.html                   # 10 个数据包详情页
├── solutions.html
├── pricing.html
├── api-docs.html
├── status.html
├── auth.html
├── checkout.html
├── dashboard.html
├── report-generator.html
├── mcp-guide.html
└── assets/
    ├── tokens.css                   # 共享设计变量（颜色/圆角/字体）
    └── stub-runtime.js               # 独立运行环境的轻量 stub
```

## 技术说明

- **无构建依赖**：纯 HTML + 内联 `<style>` + 内联 `<script>`，每个页面自包含，方便单独审阅。
- **共享设计变量**：`assets/tokens.css` 定义了全平台统一的 CSS 变量（颜色、圆角、字体），对应 PRD 第 6.1 节「设计系统与 UI/UX 规范」。
- **外部依赖（通过 CDN 加载）**：
  - [Tabler Icons](https://tabler.io/icons) — 图标字体
  - [Chart.js 4.4.0](https://www.chartjs.org/) — 用于金融指标走势图、专利趋势图、接口延迟 sparkline
- **跳转方式**：页面间跳转统一使用 `location.href = 'xxx.html'`，与真实路由解耦，方便迁移到 React/Next.js 等框架时按 1:1 路由映射重写。
- **`assets/stub-runtime.js`**：原型最初在 Claude 对话环境中通过 `sendPrompt()` 触发下一步操作、通过 `window.storage` 模拟持久化存储。导出为独立文件后，这两个 API 被替换为轻量 stub（提示 Toast + 内存级 Key-Value 存储），仅用于保证原型脱离 Claude 环境后仍可点击体验，**不代表生产实现**，正式开发时请忽略此文件，按 PRD 描述对接真实后端。

## 与 PRD 的对应关系

本套原型与已交付的《InsightHub Data 产品需求文档 v1.2》逐页对应：
- 第 6 章「前台页面详细需求」对应 `index.html` ~ `status.html`
- 第 7 章「数据包详情页」对应 10 个 `package-*.html`
- 第 8 章「账户与工作台模块」对应 `auth.html`、`checkout.html`、`dashboard.html`、`report-generator.html`、`mcp-guide.html`
- 第 6.1 节「设计系统与 UI/UX 规范」对应 `assets/tokens.css` 中的设计变量与各页面复用的组件样式（状态标签、进度条、评分圆环、数据来源卡片等）

## 已知限制（移交开发前请注意）

1. 所有数据均为前端硬编码的模拟数据（含随机生成的 Demo 结果），**不连接任何真实后端**。
2. 表单（注册、结账、新建 API Key 等）未做真实校验与提交逻辑，部分操作仅用 `alert()` 占位。
3. 响应式适配仅做了基础测试，移动端体验需在正式开发阶段补充设计（详见 PRD 6.1.5 节）。
4. AI 报告生成器中的「流式输出」是前端 `setInterval` 模拟的打字机效果，正式开发需替换为真实的 LLM streaming API 对接（详见 PRD 8.4 节技术实现建议）。
