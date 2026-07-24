// ============================================================
// InsightHub Search — Core Type Definitions
// ============================================================

// ------------------------------------------------------------
// Search Engine Types
// ------------------------------------------------------------

/** Options for search queries */
export interface SearchOptions {
  /** Maximum results per engine (default: 10) */
  limit?: number;
  /** Search language (e.g., 'en', 'zh') */
  language?: string;
  /** Search region (e.g., 'US', 'CN') */
  region?: string;
  /** Time range filter */
  timeRange?: 'day' | 'week' | 'month' | 'year';
}

/** A single search result from any engine */
export interface SearchResult {
  /** Result title */
  title: string;
  /** Result URL */
  url: string;
  /** Snippet/description */
  snippet: string;
  /** Source engine name */
  engine: string;
  /** Rank within that engine (1-based) */
  rank: number;
}

/** Search engine adapter interface */
export interface SearchEngine {
  /** Engine identifier */
  readonly name: string;
  /** Perform a search */
  search(query: string, options?: SearchOptions): Promise<SearchResult[]>;
  /** Release browser/network resources (optional) */
  close?(): Promise<void>;
}

// ------------------------------------------------------------
// Rank Fusion Types
// ------------------------------------------------------------

/** A search result with fusion score */
export interface ScoredResult extends SearchResult {
  /** Combined score from fusion */
  score: number;
  /** Number of engines that returned this result */
  engineCount: number;
  /** All engines that returned this result */
  engines: string[];
}

/** Fusion algorithm options */
export interface FusionOptions {
  /** RRF constant k (default: 60) */
  k?: number;
}

// ------------------------------------------------------------
// Crawler Types
// ------------------------------------------------------------

/** Options for fetching a page */
export interface FetchOptions {
  /** Request timeout in milliseconds */
  timeout?: number;
  /** Whether to extract readable content */
  extractContent?: boolean;
  /** Custom headers */
  headers?: Record<string, string>;
}

/** Extracted page content */
export interface PageContent {
  /** Page URL */
  url: string;
  /** Page title */
  title: string;
  /** Extracted text content */
  content: string;
  /** Original HTML */
  html: string;
  /** Fetched at timestamp */
  fetchedAt: Date;
}

// ------------------------------------------------------------
// Cache Types
// ------------------------------------------------------------

/** Cache configuration */
export interface CacheConfig {
  /** Path to SQLite database file */
  dbPath?: string;
  /** Default TTL for search results in seconds */
  searchTTL?: number;
  /** Default TTL for page content in seconds */
  pageTTL?: number;
}

// ------------------------------------------------------------
// Resilience & Anti-Detection Types
// ------------------------------------------------------------

/** Rate limiter configuration */
export interface RateLimiterConfig {
  /** Max requests within the time window (default: 10) */
  maxRequests: number;
  /** Time window in milliseconds (default: 60000 = 1 minute) */
  windowMs: number;
}

/** Retry configuration */
export interface RetryConfig {
  /** Max retry attempts (default: 3) */
  maxAttempts: number;
  /** Base delay in ms for exponential backoff (default: 1000) */
  baseDelayMs: number;
  /** Maximum delay in ms (default: 30000) */
  maxDelayMs: number;
}

/** robots.txt checker configuration */
export interface RobotsConfig {
  /** User agent string to check rules against (default: '*') */
  userAgent: string;
  /** Timeout for fetching robots.txt in ms (default: 5000) */
  fetchTimeoutMs: number;
  /** Max age of cached robots.txt in ms (default: 3600000) */
  cacheTtlMs: number;
}

/** Proxy configuration */
export interface ProxyConfig {
  /** Proxy server URL (e.g., 'http://proxy:8080') */
  server: string;
  /** Proxy username (optional) */
  username?: string;
  /** Proxy password (optional) */
  password?: string;
  /** Bypass rules: comma-separated patterns to bypass proxy */
  bypass?: string;
  /** Protocol: http, https, socks5 */
  protocol?: 'http' | 'https' | 'socks5';
}

// ------------------------------------------------------------
// Error Logging Types
// ------------------------------------------------------------

/** Log entry for a failed engine query */
export interface EngineErrorLog {
  /** Engine name that failed */
  engine: string;
  /** Error message */
  error: string;
  /** Timestamp of the failure */
  timestamp: Date;
  /** Query that was attempted */
  query: string;
}

// ------------------------------------------------------------
// Full Search Configuration
// ------------------------------------------------------------

/** Complete search configuration with all options */
export interface SearchConfig {
  /** Engine list (default: all 5 engines) */
  engines?: SearchEngine[];
  /** Cache configuration */
  cache?: CacheConfig;
  /** Enable/disable cache (default: true) */
  enableCache?: boolean;
  /** Enable/disable crawler (default: true) */
  enableCrawler?: boolean;
  /** Enable rate limiting (default: true) */
  enableRateLimiter?: boolean;
  /** Rate limiter config overrides */
  rateLimiter?: Partial<RateLimiterConfig>;
  /** Enable retry on failure (default: true) */
  enableRetry?: boolean;
  /** Retry config overrides */
  retry?: Partial<RetryConfig>;
  /** Enable robots.txt checking (default: true) */
  enableRobots?: boolean;
  /** robots.txt config overrides */
  robots?: Partial<RobotsConfig>;
  /** Enable anti-fingerprint headers (default: true) */
  enableAntiFingerprint?: boolean;
  /** Proxy config (default: undefined — direct) */
  proxy?: ProxyConfig;
  /** Minimum healthy engines required for results (default: 1) */
  minHealthyEngines?: number;
  /** Callback when an engine fails (for logging/monitoring) */
  onEngineError?: (log: EngineErrorLog) => void;
}
