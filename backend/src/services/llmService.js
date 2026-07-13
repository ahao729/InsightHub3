/**
 * LLM Service
 * Multi-model routing with Langfuse observability, retry, and fallback.
 * Supports OpenAI, DeepSeek, Anthropic Claude, and custom endpoints.
 */

const config = require('../config');
const tokenUsage = require('./tokenUsage');

class LLMService {
  constructor() {
    this.clients = {};
    this.langfuse = null;
    this.initialized = false;
    this.mockMode = false;
    this.debug = config.isDev;
  }

  /**
   * Lazy initialize all LLM clients and Langfuse.
   */
  async init() {
    if (this.initialized) return;

    // Force mock mode when LLM_MOCK_MODE=true (e.g. no API credits yet)
    if (process.env.LLM_MOCK_MODE === 'true') {
      console.log('[LLM] LLM_MOCK_MODE=true — using mock responses');
      this.mockMode = true;
      this.initialized = true;
      return;
    }

    // Check if any LLM provider has an API key configured
    const hasApiKey = Object.values(config.llmProviders || {}).some(
      p => p.apiKey && p.apiKey !== ''
    );

    if (!hasApiKey) {
      console.warn('[LLM] No API keys configured — using mock responses in development');
      this.mockMode = true;
      this.initialized = true;
      return;
    }

    // Initialize Langfuse if configured
    if (config.langfusePublicKey && config.langfuseSecretKey) {
      try {
        const { Langfuse } = require('langfuse');
        this.langfuse = new Langfuse({
          publicKey: config.langfusePublicKey,
          secretKey: config.langfuseSecretKey,
          baseUrl: config.langfuseBaseUrl || 'https://cloud.langfuse.com',
        });
        console.log('[LLM] Langfuse initialized');
      } catch (err) {
        console.warn(`[LLM] Failed to init Langfuse: ${err.message}`);
      }
    }

    this.initialized = true;
  }

  /**
   * Get or create an OpenAI-compatible client.
   */
  _getClient(provider) {
    if (this.clients[provider]) return this.clients[provider];

    const providerConfig = config.llmProviders?.[provider];
    if (!providerConfig) {
      throw new Error(`Unknown LLM provider: ${provider}`);
    }

    const { OpenAI } = require('openai');
    const client = new OpenAI({
      apiKey: providerConfig.apiKey,
      baseURL: providerConfig.baseUrl,
    });

    this.clients[provider] = client;
    return client;
  }

  /**
   * Get the provider and model for a given task type.
   * Falls back through providers if the primary is unavailable.
   */
  _resolveModel(taskType) {
    const taskConfig = config.taskModels?.[taskType];
    if (!taskConfig) {
      // Default fallback
      return { provider: 'openai', model: 'gpt-4o' };
    }

    return {
      provider: taskConfig.provider || 'openai',
      model: taskConfig.model || 'gpt-4o',
    };
  }

  /**
   * Send a chat completion request with automatic retry and fallback.
   *
   * @param {Object} params
   * @param {string} params.taskType - 'analysis' | 'fast' | 'reasoning' etc.
   * @param {string} params.systemPrompt - System message
   * @param {string} params.userMessage - User message content
   * @param {Array} params.messages - Alternative to systemPrompt+userMessage (full message array)
   * @param {Object} params.options - Additional options (temperature, max_tokens, etc.)
   * @param {string} params.userId - User ID for tracking
   * @param {string} params.packageCode - Package code for tracking
   * @param {Object} params.langfuseTrace - Existing Langfuse trace to add to
   * @returns {Promise<Object>} { content, model, usage, cost, traceId }
   */
  async chat(params) {
    await this.init();

    const {
      taskType = 'analysis',
      systemPrompt,
      userMessage,
      messages: rawMessages,
      options = {},
      userId,
      packageCode,
      langfuseTrace,
    } = params;

    // Mock mode short-circuit
    if (this.mockMode) {
      return this._mockResponse(taskType, systemPrompt, userMessage, rawMessages, options);
    }

    // Build messages array
    let messages;
    if (rawMessages && rawMessages.length > 0) {
      messages = rawMessages;
    } else {
      messages = [];
      if (systemPrompt) {
        messages.push({ role: 'system', content: systemPrompt });
      }
      if (userMessage) {
        messages.push({ role: 'user', content: userMessage });
      }
    }

    // Resolve model and prepare fallback chain
    const primary = this._resolveModel(taskType);
    const providers = this._getFallbackChain(primary.provider);

    // Start Langfuse trace
    let trace;
    let span;
    if (this.langfuse) {
      if (langfuseTrace) {
        span = this.langfuse.trace({ id: langfuseTrace }).span({
          name: `llm.${taskType}`,
          input: { messages, options },
        });
      } else {
        trace = this.langfuse.trace({
          name: `llm.${taskType}`,
          input: { messages, options },
        });
        span = trace.span({
          name: `llm.${taskType}`,
          input: { messages, options },
        });
      }
    }

    let lastError = null;

    for (let attemptIdx = 0; attemptIdx < providers.length; attemptIdx++) {
      const provider = providers[attemptIdx];
      const providerConfig = config.llmProviders?.[provider];

      if (!providerConfig) {
        if (this.debug) console.warn(`[LLM] Provider '${provider}' not configured, skipping`);
        continue;
      }

      const model = provider === primary.provider
        ? primary.model
        : (providerConfig.fallbackModel || 'gpt-4o-mini');

      try {
        if (this.debug) {
          console.log(`[LLM] Attempt ${attemptIdx + 1}: ${provider}/${model}`);
        }

        const client = this._getClient(provider);

        const completion = await client.chat.completions.create({
          model,
          messages,
          temperature: options.temperature ?? 0.3,
          max_tokens: options.maxTokens ?? 4096,
          top_p: options.topP ?? 1,
          ...(options.adapterId ? { adapter_id: options.adapterId } : {}),
        });

        const result = completion.choices[0]?.message?.content || '';
        const usage = completion.usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };

        // Track token usage
        tokenUsage.track({
          userId,
          model: `${provider}/${model}`,
          inputTokens: usage.prompt_tokens || 0,
          outputTokens: usage.completion_tokens || 0,
          taskType,
          packageCode,
        });

        // Update Langfuse span
        if (span) {
          span.end({
            output: result,
            usage: {
              input: usage.prompt_tokens,
              output: usage.completion_tokens,
              unit: 'tokens',
            },
            model: `${provider}/${model}`,
          });
          if (trace) {
            await this.langfuse.flushAsync();
          }
        }

        return {
          success: true,
          content: result,
          model: `${provider}/${model}`,
          provider,
          usage: {
            inputTokens: usage.prompt_tokens || 0,
            outputTokens: usage.completion_tokens || 0,
            totalTokens: usage.total_tokens || 0,
          },
          traceId: trace?.id || span?.id || null,
        };
      } catch (err) {
        lastError = err;
        console.warn(`[LLM] ${provider}/${model} failed: ${err.message}`);

        if (span) {
          span.end({
            level: 'ERROR',
            status: 'error',
            metadata: { error: err.message, attempt: attemptIdx + 1 },
          });
        }

        // Don't retry on auth errors or invalid requests
        if (err.status === 401 || err.status === 403 || err.status === 400) {
          break;
        }
      }
    }

    // All providers failed
    if (span) {
      span.end({ level: 'ERROR', status: 'error' });
      if (trace) await this.langfuse.flushAsync();
    }

    console.error(`[LLM] All providers failed for taskType=${taskType}`);
    return {
      success: false,
      content: null,
      error: lastError?.message || 'All LLM providers failed',
      model: null,
      provider: null,
      usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
      traceId: trace?.id || null,
    };
  }

  /**
   * Simple completion with just a prompt (no system message).
   */
  async complete(prompt, options = {}) {
    return this.chat({
      taskType: options.taskType || 'fast',
      userMessage: prompt,
      options,
      userId: options.userId,
      packageCode: options.packageCode,
    });
  }

  /**
   * Generate a mock LLM response for development/testing without API keys.
   */
  _mockResponse(taskType, systemPrompt, userMessage, rawMessages, options) {
    // Extract the last user message for context
    let lastMessage = '';
    if (rawMessages && rawMessages.length > 0) {
      const userMsgs = rawMessages.filter(m => m.role === 'user');
      lastMessage = userMsgs.length > 0 ? userMsgs[userMsgs.length - 1].content : '';
    } else if (userMessage) {
      lastMessage = userMessage;
    }

    const modelMap = {
      fast: 'mock/gpt-4o-mini',
      analysis: 'mock/gpt-4o',
      reasoning: 'mock/deepseek-chat',
    };
    const model = modelMap[taskType] || 'mock/gpt-4o';

    let content;
    if (!lastMessage) {
      content = '（Mock 响应 — 未检测到用户消息）';
    } else if (lastMessage.includes('test') || lastMessage.includes('测试')) {
      content = `✅ Mock LLM 响应 (${model}): 系统运行正常。这是一个开发环境下的模拟回复。\n\n任务类型: ${taskType}\n输入长度: ${lastMessage.length} 字符\n\n您可以在 .env 文件中配置 API Key 来启用真实的 LLM 调用。`;
    } else {
      content = `📝 Mock LLM 响应 (${model})\n\n接收到您的查询:\n"${lastMessage.substring(0, 200)}"\n\n---\n这是一个模拟响应。当前未配置 LLM API Key，系统以 Mock 模式运行。\n配置 API Key 后重启即可获得真实的大模型分析结果。`;
    }

    if (this.debug) {
      console.log(`[LLM] Mock response for taskType=${taskType}, model=${model}`);
    }

    // Track mock token usage
    const mockInput = lastMessage.length;
    const mockOutput = content.length;

    return {
      success: true,
      content,
      model,
      provider: 'mock',
      usage: {
        inputTokens: Math.ceil(mockInput / 4),
        outputTokens: Math.ceil(mockOutput / 4),
        totalTokens: Math.ceil((mockInput + mockOutput) / 4),
      },
      traceId: null,
    };
  }

  /**
   * Get the fallback chain of providers for a given primary provider.
   */
  _getFallbackChain(primaryProvider) {
    const allProviders = Object.keys(config.llmProviders || {});
    const chain = [primaryProvider];

    allProviders.forEach(p => {
      if (p !== primaryProvider && !chain.includes(p)) {
        chain.push(p);
      }
    });

    return chain;
  }
}

// Singleton instance
const llmService = new LLMService();

module.exports = llmService;
