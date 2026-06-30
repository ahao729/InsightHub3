/**
 * RAG Service
 * Retrieval-Augmented Generation pipeline: context retrieval + LLM synthesis.
 * Assembles relevant data from package services and feeds it to the LLM for analysis.
 */

const llmService = require('./llmService');
const embeddingService = require('./embeddingService');
const tokenUsage = require('./tokenUsage');

// Lazy-loaded package services to avoid circular deps
const packageServices = {};

function getPackageService(code) {
  if (packageServices[code]) return packageServices[code];

  try {
    switch (code) {
      case 'startup':
        packageServices[code] = require('./startupIntel');
        break;
      case 'ai-geo':
      case 'aigeo':
        packageServices[code] = require('./aiGeo');
        break;
      case 'enterprise':
        packageServices[code] = require('./enterpriseRisk');
        break;
      case 'finance':
        packageServices[code] = require('./financeMacro');
        break;
      case 'patent':
        packageServices[code] = require('./patentTech');
        break;
      case 'policy':
        packageServices[code] = require('./policyBidding');
        break;
      case 'education':
        packageServices[code] = require('./education');
        break;
      case 'web3':
        packageServices[code] = require('./web3Crypto');
        break;
      default:
        return null;
    }
    return packageServices[code];
  } catch (err) {
    console.warn(`[RAG] Could not load service '${code}': ${err.message}`);
    return null;
  }
}

class RAGService {
  /**
   * Perform a full RAG query: retrieve context and synthesize an answer.
   *
   * @param {Object} params
   * @param {string} params.query - User's natural language query
   * @param {string} params.packageCode - Data package code (e.g. 'startup', 'education')
   * @param {Object} params.filters - Additional filters (e.g. { country: '中国', subject: 'AI' })
   * @param {string} params.userId - User ID for tracking
   * @param {number} params.topK - Number of context items to retrieve (default 5)
   * @param {string} params.analysisType - Type of analysis: 'summary' | 'comparison' | 'trend' | 'custom'
   * @returns {Promise<Object>} Analysis result with context and LLM response
   */
  async query(params) {
    const {
      query,
      packageCode,
      filters = {},
      userId,
      topK = 5,
      analysisType = 'summary',
    } = params;

    if (!query || !query.trim()) {
      return { success: false, error: '查询内容不能为空' };
    }

    if (!packageCode) {
      return { success: false, error: '必须指定数据包代码' };
    }

    // Step 1: Retrieve context from the data service
    const contextResult = await this._retrieveContext(query, packageCode, filters, topK);
    if (!contextResult.success) {
      return contextResult;
    }

    // Step 2: Assemble prompt with context
    const prompt = this._buildPrompt(query, contextResult.context, packageCode, analysisType);

    // Step 3: Call LLM
    const llmResult = await llmService.chat({
      taskType: 'analysis',
      systemPrompt: this._getSystemPrompt(packageCode, analysisType),
      userMessage: prompt,
      userId,
      packageCode,
      options: {
        temperature: 0.3,
        maxTokens: 4096,
      },
    });

    if (!llmResult.success) {
      return {
        success: false,
        error: llmResult.error || 'LLM 分析失败',
        context: contextResult.context,
        usage: llmResult.usage,
      };
    }

    return {
      success: true,
      analysis: llmResult.content,
      context: contextResult.context,
      contextCount: contextResult.context.length,
      model: llmResult.model,
      usage: llmResult.usage,
      traceId: llmResult.traceId,
    };
  }

  /**
   * Simple quick analysis (no RAG retrieval, just LLM on provided data).
   *
   * @param {Object} params
   * @param {string} params.query - Analysis query
   * @param {Array} params.data - Data items to analyze
   * @param {string} params.packageCode - Package code
   * @param {string} params.analysisType - Type of analysis
   * @param {string} params.userId - User ID
   * @returns {Promise<Object>}
   */
  async quickAnalyze(params) {
    const { query, data, packageCode, analysisType = 'summary', userId } = params;

    if (!data || data.length === 0) {
      return { success: false, error: '没有可供分析的数据' };
    }

    const prompt = this._buildPrompt(query, data, packageCode, analysisType);
    const llmResult = await llmService.chat({
      taskType: 'fast',
      systemPrompt: this._getSystemPrompt(packageCode, analysisType),
      userMessage: prompt,
      userId,
      packageCode,
      options: { temperature: 0.3, maxTokens: 2048 },
    });

    if (!llmResult.success) {
      return { success: false, error: llmResult.error || '快速分析失败' };
    }

    return {
      success: true,
      analysis: llmResult.content,
      dataCount: data.length,
      model: llmResult.model,
      usage: llmResult.usage,
    };
  }

  /**
   * Compare entities within a data package.
   */
  async compare(params) {
    const { items, packageCode, userId, dimension } = params;

    if (!items || items.length < 2) {
      return { success: false, error: '至少需要 2 个条目进行比较' };
    }

    const prompt = `请比较以下 ${items.length} 个条目${dimension ? `，重点关注 ${dimension} 维度` : ''}：

${items.map((item, i) => `--- 条目 ${i + 1} ---
${JSON.stringify(item, null, 2)}`).join('\n\n')}

请提供结构化的对比分析，包括：
1. 共同点
2. 差异点
3. ${dimension ? `针对「${dimension}」的详细对比` : '综合评分或推荐'}
4. 结论和建议`;

    const llmResult = await llmService.chat({
      taskType: 'reasoning',
      systemPrompt: this._getSystemPrompt(packageCode, 'comparison'),
      userMessage: prompt,
      userId,
      packageCode,
      options: { temperature: 0.2, maxTokens: 4096 },
    });

    return {
      success: llmResult.success,
      analysis: llmResult.content,
      model: llmResult.model,
      usage: llmResult.usage,
      error: llmResult.error,
    };
  }

  /**
   * Retrieve relevant context from a data package service.
   */
  async _retrieveContext(query, packageCode, filters, topK) {
    const service = getPackageService(packageCode);

    if (!service) {
      return { success: false, error: `未知的数据包代码: ${packageCode}` };
    }

    try {
      // Search for relevant data
      const searchResult = await service.search({ q: query, ...filters }, { page: 1, limit: topK * 3 });
      const items = searchResult.data || [];

      if (items.length === 0) {
        return { success: false, error: '未找到相关数据', context: [] };
      }

      // Score by embedding similarity if possible
      let scored = items;
      if (items.length > 1) {
        try {
          const itemTexts = items.map(item => this._itemToText(item));
          const similar = await embeddingService.searchSimilar(query, itemTexts, topK, 0.3);
          const textToItem = new Map(items.map((item, i) => [itemTexts[i], { item, index: i }]));

          scored = similar
            .map(s => textToItem.get(s.text))
            .filter(Boolean)
            .map(({ item }) => item);
        } catch (err) {
          // Embedding search failed, use first topK items
          console.warn('[RAG] Embedding search failed, using raw search results:', err.message);
          scored = items.slice(0, topK);
        }
      }

      return {
        success: true,
        context: scored.slice(0, topK),
      };
    } catch (err) {
      console.error(`[RAG] Context retrieval error:`, err);
      return { success: false, error: `数据检索失败: ${err.message}`, context: [] };
    }
  }

  /**
   * Build the analysis prompt with context.
   */
  _buildPrompt(query, contextItems, packageCode, analysisType) {
    const contextStr = contextItems
      .map((item, i) => `[${i + 1}] ${JSON.stringify(item, null, 2)}`)
      .join('\n\n');

    return `## 数据上下文（共 ${contextItems.length} 条）

${contextStr}

## 分析请求

用户问题：${query}

请基于以上数据上下文，提供${this._getAnalysisTypeDesc(analysisType)}。引用具体数据时请标注对应的条目编号。
`;
  }

  /**
   * Get the system prompt for a given analysis type.
   */
  _getSystemPrompt(packageCode, analysisType) {
    const packageName = this._getPackageName(packageCode);

    const basePrompt = `你是一个专业的商业情报分析助手，专注于 ${packageName} 领域的数据分析。
你的任务是基于提供的结构化数据，生成有洞察力的分析报告。

回答要求：
1. 基于数据事实进行分析，不要编造数据
2. 引用数据时标注来源条目编号 [1]、[2] 等
3. 提供结构化的分析，便于阅读
4. 指出数据中的趋势、模式和异常
5. 给出 actionable 的建议和结论
6. 使用中文回答`;

    return basePrompt;
  }

  /**
   * Convert a data item to text representation for embedding.
   */
  _itemToText(item) {
    if (!item) return '';
    const fields = [];
    for (const [key, value] of Object.entries(item)) {
      if (value !== null && value !== undefined && typeof value !== 'object') {
        fields.push(`${key}: ${value}`);
      }
    }
    return fields.join(' | ');
  }

  _getAnalysisTypeDesc(type) {
    switch (type) {
      case 'summary': return '全面的数据摘要和分析';
      case 'comparison': return '详细的对比分析';
      case 'trend': return '趋势分析和预测';
      case 'custom': return '定制化分析';
      default: return '专业的数据分析';
    }
  }

  _getPackageName(code) {
    const names = {
      startup: '创业商业情报',
      'ai-geo': 'AI/GEO 分析',
      aigeo: 'AI/GEO 分析',
      enterprise: '企业情报与风控',
      finance: '金融宏观数据',
      patent: '专利技术情报',
      policy: '政策与招投标',
      education: '教育数据',
      web3: 'Web3 加密数据',
    };
    return names[code] || code;
  }
}

module.exports = new RAGService();
