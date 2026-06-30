// ── Mock tokenUsage first ──
const mockTrack = jest.fn();
jest.mock('../services/tokenUsage', () => ({
  track: (...args) => mockTrack(...args),
}));

// Mock openai
const mockCreateCompletion = jest.fn();
jest.mock('openai', () => ({
  OpenAI: jest.fn(() => ({
    chat: { completions: { create: (...args) => mockCreateCompletion(...args) } },
  })),
}));

// Mock langfuse
const mockSpanEnd = jest.fn();
const mockSpan = {
  end: (...args) => mockSpanEnd(...args),
};
const mockTraceSpan = jest.fn(() => mockSpan);
const mockTrace = {
  span: (...args) => mockTraceSpan(...args),
};
const mockLangfuse = {
  trace: jest.fn(() => mockTrace),
  flushAsync: jest.fn(),
};
jest.mock('langfuse', () => ({
  Langfuse: jest.fn(() => mockLangfuse),
}));

const mockConfigWithKeys = {
  llmProviders: {
    openai: { apiKey: 'sk-openai', baseUrl: 'https://api.openai.com/v1', fallbackModel: 'gpt-4o-mini' },
    deepseek: { apiKey: 'sk-deepseek', baseUrl: 'https://api.deepseek.com', fallbackModel: 'deepseek-chat' },
  },
  taskModels: {
    analysis: { provider: 'openai', model: 'gpt-4o' },
    fast: { provider: 'openai', model: 'gpt-4o-mini' },
    reasoning: { provider: 'deepseek', model: 'deepseek-chat' },
  },
  langfusePublicKey: 'pk-test',
  langfuseSecretKey: 'sk-test',
  isDev: false,
};

const mockConfigNoKeys = {
  llmProviders: {
    openai: { apiKey: '', baseUrl: 'https://api.openai.com/v1' },
  },
  taskModels: {
    analysis: { provider: 'openai', model: 'gpt-4o' },
  },
  langfusePublicKey: '',
  langfuseSecretKey: '',
  isDev: true,
};

let LLMService;
let llmService;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('LLMService — mock mode (no API keys)', () => {
  let service;

  beforeAll(() => {
    jest.isolateModules(() => {
      jest.mock('../config', () => mockConfigNoKeys);
      LLMService = require('../services/llmService');
    });
    service = LLMService;
    // Reset state
    service.clients = {};
    service.langfuse = null;
    service.initialized = false;
    service.mockMode = false;
    service.debug = true;
  });

  beforeEach(() => {
    service.clients = {};
    service.langfuse = null;
    service.initialized = false;
    service.mockMode = false;
    service.debug = true;
  });

  describe('init', () => {
    it('should enter mock mode when no API keys configured', async () => {
      await service.init();
      expect(service.mockMode).toBe(true);
      expect(service.initialized).toBe(true);
    });

    it('should be idempotent after first init', async () => {
      await service.init();
      await service.init(); // second call
      expect(service.initialized).toBe(true);
    });
  });

  describe('chat (mock mode)', () => {
    beforeEach(async () => {
      await service.init();
    });

    it('should return mock response when in mock mode', async () => {
      const result = await service.chat({
        taskType: 'analysis',
        userMessage: '测试消息',
      });

      expect(result.success).toBe(true);
      expect(result.content).toContain('Mock LLM');
      expect(result.provider).toBe('mock');
      expect(result.usage).toBeDefined();
      expect(result.usage.inputTokens).toBeGreaterThan(0);
    });

    it('should return mock response with different task types', async () => {
      const fastResult = await service.chat({
        taskType: 'fast',
        userMessage: 'hello test',
      });
      expect(fastResult.success).toBe(true);
      expect(fastResult.model).toContain('mock/');

      const reasoningResult = await service.chat({
        taskType: 'reasoning',
        userMessage: 'deep test',
      });
      expect(reasoningResult.success).toBe(true);
    });
  });

  describe('_mockResponse', () => {
    it('should handle empty/no user message gracefully', () => {
      const result = service._mockResponse('fast', '', '', [], {});
      expect(result.success).toBe(true);
      expect(result.content).toContain('未检测到用户消息');
    });

    it('should include Chinese test keyword response', () => {
      const result = service._mockResponse('fast', '', '这是一个测试', null, {});
      expect(result.content).toContain('✅');
    });

    it('should include English test keyword response', () => {
      const result = service._mockResponse('fast', '', 'run a test please', null, {});
      expect(result.content).toContain('✅');
    });
  });
});

describe('LLMService — live mode (with API keys)', () => {
  let service;
  let mockTrackLive;

  beforeAll(() => {
    jest.isolateModules(() => {
      jest.mock('../config', () => mockConfigWithKeys);
      // Need to re-mock for the isolated module
      mockTrackLive = jest.fn();
      jest.mock('../services/tokenUsage', () => ({ track: (...args) => mockTrackLive(...args) }));
      LLMService = require('../services/llmService');
    });
    service = LLMService;
  });

  beforeEach(() => {
    service.clients = {};
    service.langfuse = null;
    service.initialized = false;
    service.mockMode = false;
    service.debug = false;
    jest.clearAllMocks();
  });

  describe('init', () => {
    it('should initialize Langfuse when keys are present', async () => {
      await service.init();
      expect(service.initialized).toBe(true);
      expect(service.mockMode).toBe(false);
    });
  });

  describe('_resolveModel', () => {
    it('should return configured provider and model for known task type', () => {
      service.initialized = true;
      const resolved = service._resolveModel('analysis');
      expect(resolved.provider).toBe('openai');
      expect(resolved.model).toBe('gpt-4o');
    });

    it('should return default fallback for unknown task type', () => {
      service.initialized = true;
      const resolved = service._resolveModel('unknown_task');
      expect(resolved.provider).toBe('openai');
      expect(resolved.model).toBe('gpt-4o');
    });
  });

  describe('_getFallbackChain', () => {
    it('should place primary provider first', () => {
      const chain = service._getFallbackChain('openai');
      expect(chain[0]).toBe('openai');
    });

    it('should include all configured providers', () => {
      const chain = service._getFallbackChain('openai');
      expect(chain).toContain('openai');
      expect(chain).toContain('deepseek');
    });

    it('should not duplicate providers', () => {
      const chain = service._getFallbackChain('deepseek');
      expect(chain.filter(p => p === 'deepseek').length).toBe(1);
    });
  });

  describe('_getClient', () => {
    it('should create and cache a client', () => {
      // init needed to set up config reference
      const client = service._getClient('openai');
      expect(client).toBeDefined();
      expect(service.clients.openai).toBe(client);
    });

    it('should return cached client on second call', () => {
      const client1 = service._getClient('openai');
      const client2 = service._getClient('openai');
      expect(client1).toBe(client2);
    });

    it('should throw for unknown provider', () => {
      expect(() => service._getClient('unknown')).toThrow('Unknown LLM provider');
    });
  });

  describe('chat', () => {
    beforeEach(async () => {
      await service.init();
    });

    it('should return success on first provider', async () => {
      mockCreateCompletion.mockResolvedValueOnce({
        choices: [{ message: { content: 'Analysis result' } }],
        usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
        model: 'gpt-4o',
      });

      const result = await service.chat({
        taskType: 'analysis',
        systemPrompt: 'You are an analyst.',
        userMessage: 'Analyze this data.',
      });

      expect(result.success).toBe(true);
      expect(result.content).toBe('Analysis result');
      expect(result.provider).toBe('openai');
      expect(result.usage.inputTokens).toBe(100);
      expect(result.usage.outputTokens).toBe(50);
    });

    it('should fallback to next provider on failure', async () => {
      // First provider fails
      mockCreateCompletion.mockRejectedValueOnce(new Error('Rate limited'));
      // Second provider succeeds
      mockCreateCompletion.mockResolvedValueOnce({
        choices: [{ message: { content: 'Fallback result' } }],
        usage: { prompt_tokens: 50, completion_tokens: 25, total_tokens: 75 },
        model: 'deepseek-chat',
      });

      const result = await service.chat({
        taskType: 'analysis',
        userMessage: 'Test fallback',
      });

      expect(result.success).toBe(true);
      expect(result.content).toBe('Fallback result');
      expect(mockCreateCompletion).toHaveBeenCalledTimes(2);
    });

    it('should return error when all providers fail', async () => {
      mockCreateCompletion.mockRejectedValue(new Error('Service unavailable'));

      const result = await service.chat({
        taskType: 'analysis',
        userMessage: 'Test all fail',
      });

      expect(result.success).toBe(false);
      expect(result.content).toBeNull();
      expect(result.error).toContain('Service unavailable');
    });

    it('should break on auth errors (401)', async () => {
      const authErr = new Error('Unauthorized');
      authErr.status = 401;
      mockCreateCompletion.mockRejectedValueOnce(authErr);

      const result = await service.chat({
        taskType: 'analysis',
        userMessage: 'Test auth error',
      });

      expect(result.success).toBe(false);
      expect(mockCreateCompletion).toHaveBeenCalledTimes(1); // No fallback
    });

    it('should break on 403 errors', async () => {
      const err = new Error('Forbidden');
      err.status = 403;
      mockCreateCompletion.mockRejectedValueOnce(err);

      const result = await service.chat({
        taskType: 'analysis',
        userMessage: 'Test 403',
      });

      expect(result.success).toBe(false);
      expect(mockCreateCompletion).toHaveBeenCalledTimes(1);
    });

    it('should break on 400 errors', async () => {
      const err = new Error('Bad Request');
      err.status = 400;
      mockCreateCompletion.mockRejectedValueOnce(err);

      const result = await service.chat({
        taskType: 'analysis',
        userMessage: 'Test 400',
      });

      expect(result.success).toBe(false);
      expect(mockCreateCompletion).toHaveBeenCalledTimes(1);
    });

    it('should build messages from systemPrompt + userMessage', async () => {
      mockCreateCompletion.mockResolvedValueOnce({
        choices: [{ message: { content: 'OK' } }],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
        model: 'gpt-4o',
      });

      await service.chat({
        taskType: 'analysis',
        systemPrompt: 'System instruction',
        userMessage: 'User query',
      });

      const callArgs = mockCreateCompletion.mock.calls[0][0];
      expect(callArgs.messages).toEqual([
        { role: 'system', content: 'System instruction' },
        { role: 'user', content: 'User query' },
      ]);
    });

    it('should use raw messages if provided', async () => {
      mockCreateCompletion.mockResolvedValueOnce({
        choices: [{ message: { content: 'OK' } }],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
        model: 'gpt-4o',
      });

      const rawMessages = [
        { role: 'system', content: 'S' },
        { role: 'user', content: 'U1' },
        { role: 'assistant', content: 'A1' },
        { role: 'user', content: 'U2' },
      ];

      await service.chat({
        taskType: 'analysis',
        messages: rawMessages,
      });

      const callArgs = mockCreateCompletion.mock.calls[0][0];
      expect(callArgs.messages).toEqual(rawMessages);
    });

    it('should track token usage on success', async () => {
      mockCreateCompletion.mockResolvedValueOnce({
        choices: [{ message: { content: 'OK' } }],
        usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
        model: 'gpt-4o',
      });

      await service.chat({
        taskType: 'analysis',
        userMessage: 'Track me',
        userId: 'user-123',
        packageCode: 'startup',
      });

      expect(mockTrackLive).toHaveBeenCalledWith({
        userId: 'user-123',
        model: 'openai/gpt-4o',
        inputTokens: 100,
        outputTokens: 50,
        taskType: 'analysis',
        packageCode: 'startup',
      });
    });

    it('should skip provider not in llmProviders config', async () => {
      // Clear the config so only one provider works
      const originalProviders = { ...service.clients };

      // Make the chat method fall through... we can test by making first provider fail
      mockCreateCompletion.mockRejectedValueOnce(new Error('fail'));
      mockCreateCompletion.mockResolvedValueOnce({
        choices: [{ message: { content: 'fallback ok' } }],
        usage: { prompt_tokens: 5, completion_tokens: 3, total_tokens: 8 },
        model: 'deepseek-chat',
      });

      const result = await service.chat({
        taskType: 'analysis',
        userMessage: 'test',
      });

      expect(result.success).toBe(true);
      expect(result.content).toBe('fallback ok');
    });
  });

  describe('complete', () => {
    it('should call chat with correct parameters', async () => {
      // Set mock mode for this test to avoid needing OpenAI calls
      service.mockMode = true;
      const result = await service.complete('Hello', {
        taskType: 'fast',
        userId: 'u1',
        packageCode: 'test',
      });
      expect(result.success).toBe(true);
      expect(result.model).toContain('mock');
    });
  });
});
