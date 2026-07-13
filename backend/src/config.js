require('dotenv').config();

const config = {
  port: parseInt(process.env.PORT, 10) || 4000,
  databaseUrl: process.env.DATABASE_URL || 'postgresql://localhost:5432/insighthub',
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: '7d',
  corsOrigins: process.env.CORS_ORIGINS || 'http://localhost:3000,http://localhost:3001,http://localhost:5173',
  adminInviteCode: process.env.ADMIN_INVITE_CODE || (process.env.NODE_ENV === 'production' ? '' : 'INSIGHTHUB2024'),
  nodeEnv: process.env.NODE_ENV || 'development',
  isDev: (process.env.NODE_ENV || 'development') === 'development',

  // ============================================================
  // LLM / AI Configuration
  // ============================================================

  // ============================================================
  // LLM Providers (used by llmService for dynamic routing)
  // ============================================================
  openaiApiKey: process.env.OPENAI_API_KEY || '',
  openaiBaseUrl: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
  deepseekApiKey: process.env.DEEPSEEK_API_KEY || '',
  deepseekBaseUrl: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com/v1',
  anthropicApiKey: process.env.ANTHROPIC_API_KEY || '',
  zhipuApiKey: process.env.ZHIPU_API_KEY || '',
  zhipuBaseUrl: process.env.ZHIPU_BASE_URL || 'https://open.bigmodel.cn/api/paas/v4',

  llmProviders: {
    openai: {
      apiKey: process.env.OPENAI_API_KEY || '',
      baseUrl: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
      models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo'],
      fallbackModel: 'gpt-4o-mini',
    },
    deepseek: {
      apiKey: process.env.DEEPSEEK_API_KEY || '',
      baseUrl: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com/v1',
      models: ['deepseek-chat', 'deepseek-reasoner'],
      fallbackModel: 'deepseek-chat',
    },
    anthropic: {
      apiKey: process.env.ANTHROPIC_API_KEY || '',
      baseUrl: process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com/v1',
      models: ['claude-3-opus', 'claude-3-sonnet', 'claude-3-haiku'],
      fallbackModel: 'claude-3-haiku',
    },
    zhipu: {
      apiKey: process.env.ZHIPU_API_KEY || '',
      baseUrl: process.env.ZHIPU_BASE_URL || 'https://open.bigmodel.cn/api/paas/v4',
      models: ['glm-4-plus', 'glm-4', 'glm-4-flash'],
      fallbackModel: 'glm-4-flash',
    },
  },

  // ============================================================
  // Email Configuration
  // ============================================================
  email: {
    host: process.env.SMTP_HOST || 'smtp.ethereal.email',
    port: parseInt(process.env.SMTP_PORT, 10) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.EMAIL_FROM || 'InsightHub <no-reply@insighthub.data>',
    devMode: process.env.NODE_ENV !== 'production',
    frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3001',
  },

  // ============================================================
  // Password Reset
  // ============================================================
  passwordReset: {
    expiryMinutes: parseInt(process.env.RESET_TOKEN_EXPIRY, 10) || 30,
  },

  // Task → model mapping for llmService routing
  taskModels: {
    fast: { provider: 'openai', model: process.env.FAST_MODEL || 'gpt-4o-mini' },
    analysis: { provider: 'openai', model: process.env.ANALYSIS_MODEL || 'gpt-4o' },
    reasoning: { provider: 'deepseek', model: process.env.REASONING_MODEL || 'deepseek-chat' },
    embedding: { model: process.env.EMBEDDING_MODEL || 'text-embedding-3-small' },
  },

  // Default model selection by task (legacy)
  models: {
    embedding: process.env.EMBEDDING_MODEL || 'text-embedding-3-small',
    fast: process.env.FAST_MODEL || 'gpt-4o-mini',
    analysis: process.env.ANALYSIS_MODEL || 'gpt-4o',
    reasoning: process.env.REASONING_MODEL || 'deepseek-chat',
  },

  // Embedding dimensions
  embeddingDimensions: parseInt(process.env.EMBEDDING_DIMENSIONS, 10) || 1536,

  // ============================================================
  // Langfuse (LLM Observability)
  // ============================================================
  langfusePublicKey: process.env.LANGFUSE_PUBLIC_KEY || '',
  langfuseSecretKey: process.env.LANGFUSE_SECRET_KEY || '',
  langfuseBaseUrl: process.env.LANGFUSE_BASE_URL || 'https://cloud.langfuse.com',

  // ============================================================
  // Token Usage & Rate Limiting
  // ============================================================
  tokenTrackingEnabled: process.env.TOKEN_TRACKING !== 'false',
  dailyTokenLimit: parseInt(process.env.DAILY_TOKEN_LIMIT, 10) || 1000000,
  userDailyTokenLimit: parseInt(process.env.USER_DAILY_TOKEN_LIMIT, 10) || 100000,

  // Model pricing per 1K tokens (USD)
  modelPricing: {
    'text-embedding-3-small': { input: 0.00002, output: 0 },
    'gpt-4o-mini': { input: 0.00015, output: 0.0006 },
    'gpt-4o': { input: 0.0025, output: 0.01 },
    'deepseek-chat': { input: 0.00014, output: 0.00028 },
    'claude-3-opus': { input: 0.015, output: 0.075 },
    'claude-3-sonnet': { input: 0.003, output: 0.015 },
    'glm-4-plus': { input: 0.007, output: 0.007 },
    'glm-4': { input: 0.002, output: 0.002 },
    'glm-4-flash': { input: 0.00014, output: 0.00014 },
  },
};

module.exports = config;
