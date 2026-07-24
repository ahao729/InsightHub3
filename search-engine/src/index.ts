// ============================================================
// InsightHub Search — Public API
// ============================================================

// Main class
export { InsightHubSearch } from './search.js';

// Types
export type {
  SearchEngine,
  SearchOptions,
  SearchResult,
  ScoredResult,
  FusionOptions,
  FetchOptions,
  PageContent,
  CacheConfig,
  SearchConfig,
  EngineErrorLog,
  RateLimiterConfig,
  RetryConfig,
  RobotsConfig,
  ProxyConfig,
} from './types.js';

// Engines
export {
  DuckDuckGoEngine,
  GoogleEngine,
  BingEngine,
  BaiduEngine,
  SogouEngine,
  defaultEngines,
  createEngine,
} from './engines/index.js';

// Rank fusion
export {
  reciprocalRankFusion,
  normalizeScores,
  deduplicateResults,
} from './ranker/fusion.js';

// Cache
export { SQLiteCache } from './cache/sqlite.js';

// Crawler
export { PageCrawler } from './crawler/crawler.js';

// Resilience & anti-detection
export { RateLimiter } from './rate-limiter.js';
export { withRetry, withRetryThrow } from './retry.js';
export { RobotsChecker, parseRobotsTxt } from './robots.js';
export {
  generateFingerprint,
  getRequestInterval,
  getRandomViewport,
} from './anti-fingerprint.js';
export {
  toPlaywrightProxy,
  toFetchProxyUrl,
  toProxyEnv,
  shouldBypassProxy,
} from './proxy.js';
