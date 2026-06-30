// ── Mock external dependencies ──

// Mock package services for getPackageService
const mockSearch = jest.fn();
jest.mock('../services/startupIntel', () => ({
  search: (...args) => mockSearch(...args),
}), { virtual: true });

jest.mock('../services/aiGeo', () => ({
  search: (...args) => mockSearch(...args),
}), { virtual: true });

jest.mock('../services/enterpriseRisk', () => ({
  search: (...args) => mockSearch(...args),
}), { virtual: true });

// Mock embedding service
const mockSearchSimilar = jest.fn();
jest.mock('../services/embeddingService', () => ({
  searchSimilar: (...args) => mockSearchSimilar(...args),
}));

// Mock token usage
jest.mock('../services/tokenUsage', () => ({
  track: jest.fn(),
}));

// Mock LLM service
const mockChat = jest.fn();
jest.mock('../services/llmService', () => ({
  chat: (...args) => mockChat(...args),
}));

const RAGService = require('../services/ragService');

// Since RAGService exports a singleton
const ragService = RAGService;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('RAGService', () => {
  // ── query ────────────────────────────────────────────
  describe('query', () => {
    it('should return error for empty query', async () => {
      const result = await ragService.query({ query: '', packageCode: 'startup' });
      expect(result.success).toBe(false);
      expect(result.error).toContain('不能为空');
    });

    it('should return error for missing packageCode', async () => {
      const result = await ragService.query({ query: 'test query' });
      expect(result.success).toBe(false);
      expect(result.error).toContain('必须指定数据包代码');
    });

    it('should return error when package service is unknown', async () => {
      const result = await ragService.query({ query: 'test', packageCode: 'nonexistent' });
      expect(result.success).toBe(false);
      expect(result.error).toContain('未知的数据包代码');
    });

    it('should return full result on successful RAG flow', async () => {
      // Mock search returns data
      mockSearch.mockResolvedValueOnce({
        data: [
          { id: 1, name: 'Company A', revenue: '100M' },
          { id: 2, name: 'Company B', revenue: '200M' },
        ],
      });

      // Mock LLM returns success
      mockChat.mockResolvedValueOnce({
        success: true,
        content: 'Analysis report here',
        model: 'openai/gpt-4o',
        usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
        traceId: 'trace-123',
      });

      const result = await ragService.query({
        query: 'Compare these companies',
        packageCode: 'startup',
        userId: 'user-1',
        topK: 3,
        analysisType: 'comparison',
      });

      expect(result.success).toBe(true);
      expect(result.analysis).toBe('Analysis report here');
      expect(result.context).toHaveLength(2);
      expect(result.contextCount).toBe(2);
      expect(result.model).toBe('openai/gpt-4o');
      expect(result.usage.inputTokens).toBe(100);

      // Verify LLM was called with correct params
      const chatCall = mockChat.mock.calls[0][0];
      expect(chatCall.taskType).toBe('analysis');
      expect(chatCall.userId).toBe('user-1');
      expect(chatCall.packageCode).toBe('startup');
      expect(chatCall.options.temperature).toBe(0.3);
    });

    it('should handle LLM failure gracefully', async () => {
      mockSearch.mockResolvedValueOnce({
        data: [{ id: 1, name: 'Item' }],
      });

      mockChat.mockResolvedValueOnce({
        success: false,
        error: 'LLM API error',
        usage: { inputTokens: 50, outputTokens: 0, totalTokens: 50 },
      });

      const result = await ragService.query({
        query: 'test',
        packageCode: 'startup',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('LLM API error');
      expect(result.context).toBeDefined(); // context still returned
    });

    it('should return context retrieval errors directly', async () => {
      mockSearch.mockResolvedValueOnce({ data: [] });

      const result = await ragService.query({
        query: 'test',
        packageCode: 'startup',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('未找到相关数据');
    });
  });

  // ── quickAnalyze ─────────────────────────────────────
  describe('quickAnalyze', () => {
    it('should return error for empty data', async () => {
      const result = await ragService.quickAnalyze({
        query: 'analyze',
        data: [],
        packageCode: 'startup',
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain('没有可供分析的数据');
    });

    it('should analyze provided data directly', async () => {
      mockChat.mockResolvedValueOnce({
        success: true,
        content: 'Quick analysis result',
        model: 'openai/gpt-4o-mini',
        usage: { inputTokens: 50, outputTokens: 30, totalTokens: 80 },
      });

      const data = [{ name: 'Item A', value: 100 }, { name: 'Item B', value: 200 }];
      const result = await ragService.quickAnalyze({
        query: 'Summarize this',
        data,
        packageCode: 'finance',
        analysisType: 'summary',
        userId: 'u1',
      });

      expect(result.success).toBe(true);
      expect(result.analysis).toBe('Quick analysis result');
      expect(result.dataCount).toBe(2);
      expect(result.model).toBe('openai/gpt-4o-mini');

      // Verify LLM called with fast task type
      expect(mockChat).toHaveBeenCalledWith(
        expect.objectContaining({ taskType: 'fast' }),
      );
    });

    it('should handle LLM failure', async () => {
      mockChat.mockResolvedValueOnce({
        success: false,
        error: 'LLM error',
      });

      const result = await ragService.quickAnalyze({
        query: 'test',
        data: [{ x: 1 }],
        packageCode: 'startup',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('LLM error');
    });
  });

  // ── compare ──────────────────────────────────────────
  describe('compare', () => {
    it('should return error for fewer than 2 items', async () => {
      const result = await ragService.compare({
        items: [{ id: 1 }],
        packageCode: 'startup',
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain('至少需要 2 个条目');
    });

    it('should compare items with LLM', async () => {
      mockChat.mockResolvedValueOnce({
        success: true,
        content: 'Comparison analysis',
        model: 'openai/gpt-4o',
        usage: { inputTokens: 100, outputTokens: 80, totalTokens: 180 },
      });

      const items = [{ name: 'A', score: 90 }, { name: 'B', score: 80 }];
      const result = await ragService.compare({
        items,
        packageCode: 'education',
        userId: 'u1',
        dimension: 'performance',
      });

      expect(result.success).toBe(true);
      expect(result.analysis).toBe('Comparison analysis');

      // Verify LLM called with reasoning task type
      expect(mockChat).toHaveBeenCalledWith(
        expect.objectContaining({
          taskType: 'reasoning',
          options: expect.objectContaining({ temperature: 0.2 }),
        }),
      );
    });

    it('should handle LLM failure in compare', async () => {
      mockChat.mockResolvedValueOnce({
        success: false,
        error: 'Compare failed',
      });

      const result = await ragService.compare({
        items: [{ name: 'A' }, { name: 'B' }],
        packageCode: 'startup',
      });

      expect(result.success).toBe(false);
      expect(result.analysis).toBeNull();
    });
  });

  // ── _retrieveContext ─────────────────────────────────
  describe('_retrieveContext', () => {
    it('should return error for unknown package code', async () => {
      const result = await ragService._retrieveContext('query', 'unknown', {}, 5);
      expect(result.success).toBe(false);
      expect(result.error).toContain('未知的数据包代码');
    });

    it('should return no results error when search returns empty', async () => {
      mockSearch.mockResolvedValueOnce({ data: [] });

      const result = await ragService._retrieveContext('query', 'startup', {}, 5);
      expect(result.success).toBe(false);
      expect(result.error).toContain('未找到相关数据');
    });

    it('should return context items on successful search', async () => {
      mockSearch.mockResolvedValueOnce({
        data: [
          { id: 1, name: 'Result A' },
          { id: 2, name: 'Result B' },
        ],
      });

      const result = await ragService._retrieveContext('query', 'startup', {}, 5);
      expect(result.success).toBe(true);
      expect(result.context).toHaveLength(2);
    });

    it('should use embedding scoring when multiple items returned', async () => {
      mockSearch.mockResolvedValueOnce({
        data: [
          { id: 1, name: 'Apple', revenue: '100M' },
          { id: 2, name: 'Banana', revenue: '200M' },
          { id: 3, name: 'Cherry', revenue: '300M' },
        ],
      });

      mockSearchSimilar.mockResolvedValueOnce([
        { text: 'id: 1 | name: Apple | revenue: 100M', score: 0.85 },
        { text: 'id: 2 | name: Banana | revenue: 200M', score: 0.72 },
      ]);

      const result = await ragService._retrieveContext('fruit companies', 'startup', {}, 2);
      expect(result.success).toBe(true);
      expect(result.context).toHaveLength(2);
      expect(result.context[0].name).toBe('Apple');
    });

    it('should fallback to top K when embedding search fails', async () => {
      mockSearch.mockResolvedValueOnce({
        data: [
          { id: 1, name: 'Item 1' },
          { id: 2, name: 'Item 2' },
          { id: 3, name: 'Item 3' },
        ],
      });

      mockSearchSimilar.mockRejectedValueOnce(new Error('Embedding error'));

      const result = await ragService._retrieveContext('query', 'startup', {}, 2);
      expect(result.success).toBe(true);
      expect(result.context).toHaveLength(2);
    });

    it('should pass filters to service search', async () => {
      mockSearch.mockResolvedValueOnce({
        data: [{ id: 1, name: 'Filtered' }],
      });

      await ragService._retrieveContext('query', 'startup', { country: '中国', year: 2024 }, 5);
      expect(mockSearch).toHaveBeenCalledWith(
        expect.objectContaining({ q: 'query', country: '中国', year: 2024 }),
        expect.any(Object),
      );
    });

    it('should search with limit = topK * 3', async () => {
      mockSearch.mockResolvedValueOnce({ data: [{ id: 1, name: 'A' }] });

      await ragService._retrieveContext('query', 'startup', {}, 10);
      expect(mockSearch).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({ limit: 30 }),
      );
    });
  });

  // ── _buildPrompt ─────────────────────────────────────
  describe('_buildPrompt', () => {
    it('should build a prompt with context items', () => {
      const items = [
        { name: 'Company X', revenue: '500M' },
        { name: 'Company Y', revenue: '300M' },
      ];
      const prompt = ragService._buildPrompt('Compare them', items, 'startup', 'comparison');
      expect(prompt).toContain('数据上下文（共 2 条）');
      expect(prompt).toContain('[1]');
      expect(prompt).toContain('[2]');
      expect(prompt).toContain('Company X');
      expect(prompt).toContain('Company Y');
      expect(prompt).toContain('对比');
    });

    it('should include analysis type description', () => {
      const items = [{ name: 'A' }];
      const prompt = ragService._buildPrompt('analyze', items, 'startup', 'trend');
      expect(prompt).toContain('趋势分析');
    });
  });

  // ── _getSystemPrompt ─────────────────────────────────
  describe('_getSystemPrompt', () => {
    it('should include package name in system prompt', () => {
      const prompt = ragService._getSystemPrompt('finance', 'summary');
      expect(prompt).toContain('金融宏观数据');
      expect(prompt).toContain('商业情报分析助手');
    });

    it('should handle unknown package code', () => {
      const prompt = ragService._getSystemPrompt('custom_pkg', 'analysis');
      expect(prompt).toContain('custom_pkg');
    });
  });

  // ── _itemToText ──────────────────────────────────────
  describe('_itemToText', () => {
    it('should convert item to pipe-separated string', () => {
      const item = { id: 1, name: 'Test', value: 100, nested: { x: 1 } };
      const text = ragService._itemToText(item);
      expect(text).toContain('id: 1');
      expect(text).toContain('name: Test');
      expect(text).toContain('value: 100');
      // Nested objects should be excluded
      expect(text).not.toContain('nested');
    });

    it('should return empty string for null/undefined', () => {
      expect(ragService._itemToText(null)).toBe('');
      expect(ragService._itemToText(undefined)).toBe('');
    });

    it('should skip null and undefined values', () => {
      const item = { a: 'ok', b: null, c: undefined };
      const text = ragService._itemToText(item);
      expect(text).toBe('a: ok');
    });
  });

  // ── _getPackageName ──────────────────────────────────
  describe('_getPackageName', () => {
    it('should return Chinese name for known codes', () => {
      expect(ragService._getPackageName('startup')).toBe('创业商业情报');
      expect(ragService._getPackageName('ai-geo')).toBe('AI/GEO 分析');
      expect(ragService._getPackageName('aigeo')).toBe('AI/GEO 分析');
      expect(ragService._getPackageName('enterprise')).toBe('企业情报与风控');
      expect(ragService._getPackageName('finance')).toBe('金融宏观数据');
      expect(ragService._getPackageName('patent')).toBe('专利技术情报');
      expect(ragService._getPackageName('policy')).toBe('政策与招投标');
      expect(ragService._getPackageName('education')).toBe('教育数据');
      expect(ragService._getPackageName('web3')).toBe('Web3 加密数据');
    });

    it('should return code as-is for unknown codes', () => {
      expect(ragService._getPackageName('unknown')).toBe('unknown');
    });
  });
});
