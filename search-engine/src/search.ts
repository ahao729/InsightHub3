// ============================================================
// InsightHub Search — Main Search Engine (with resilience)
// ============================================================

import type {
  SearchEngine,
  SearchOptions,
  ScoredResult,
  SearchConfig,
  EngineErrorLog,
  RateLimiterConfig,
  RetryConfig,
  RobotsConfig,
  ProxyConfig,
} from './types.js';
import { defaultEngines } from './engines/index.js';
import { reciprocalRankFusion, normalizeScores, deduplicateResults } from './ranker/fusion.js';
import { SQLiteCache } from './cache/sqlite.js';
import { PageCrawler } from './crawler/crawler.js';
import { RateLimiter } from './rate-limiter.js';
import { withRetry } from './retry.js';
import { RobotsChecker } from './robots.js';
import { generateFingerprint } from './anti-fingerprint.js';

/**
 * Main search engine that coordinates multiple search providers,
 * applies rank fusion, manages caching, and provides resilience features
 * including rate limiting, retry, robots.txt compliance, anti-fingerprinting,
 * and graceful degradation.
 */
export class InsightHubSearch {
  private engines: SearchEngine[];
  private cache: SQLiteCache | null = null;
  private crawler: PageCrawler | null = null;
  private rateLimiter: RateLimiter | null = null;
  private robotsChecker: RobotsChecker | null = null;
  private proxy: ProxyConfig | undefined;

  // Configuration
  private enableRateLimiter: boolean;
  private enableRetry: boolean;
  private enableRobots: boolean;
  private enableAntiFingerprint: boolean;
  private retryConfig: Partial<RetryConfig>;
  private onEngineError?: (log: EngineErrorLog) => void;
  private minHealthyEngines: number;

  constructor(options?: SearchConfig) {
    this.engines = options?.engines ?? defaultEngines;

    // Cache
    if (options?.enableCache !== false) {
      this.cache = new SQLiteCache(options?.cache);
    }

    // Crawler
    if (options?.enableCrawler !== false) {
      this.crawler = new PageCrawler();
    }

    // Rate limiter
    this.enableRateLimiter = options?.enableRateLimiter !== false;
    if (this.enableRateLimiter) {
      this.rateLimiter = new RateLimiter(options?.rateLimiter as Partial<RateLimiterConfig> | undefined);
    }

    // Retry
    this.enableRetry = options?.enableRetry !== false;
    this.retryConfig = options?.retry ?? {};

    // robots.txt
    this.enableRobots = options?.enableRobots !== false;
    if (this.enableRobots) {
      this.robotsChecker = new RobotsChecker(options?.robots as Partial<RobotsConfig> | undefined);
    }

    // Anti-fingerprint
    this.enableAntiFingerprint = options?.enableAntiFingerprint !== false;

    // Proxy
    this.proxy = options?.proxy;

    // Error callback
    this.onEngineError = options?.onEngineError;

    // Graceful degradation
    this.minHealthyEngines = options?.minHealthyEngines ?? 1;
  }

  /**
   * Search across all configured engines with resilience features and return fused results.
   * Uses Promise.allSettled for graceful degradation — partial results are returned
   * as long as minHealthyEngines thresholds are met.
   */
  async search(
    query: string,
    options?: SearchOptions & {
      /** Maximum results to return (default: 20) */
      maxResults?: number;
    }
  ): Promise<ScoredResult[]> {
    const maxResults = options?.maxResults ?? 20;

    // Collect results from all engines with resilience features
    const resultsArrays = await Promise.all(
      this.engines.map(async engine => {
        try {
          return await this.queryEngineWithResilience(engine, query, options);
        } catch (error) {
          const errLog: EngineErrorLog = {
            engine: engine.name,
            error: String(error),
            timestamp: new Date(),
            query,
          };
          this.onEngineError?.(errLog);
          console.error(`[Search] ${engine.name} failed: ${String(error)}`);
          return [];
        }
      })
    );

    // Validate minimum healthy engines
    const healthyCount = resultsArrays.filter(r => r.length > 0).length;
    if (healthyCount < this.minHealthyEngines) {
      throw new Error(
        `Only ${healthyCount} engine(s) returned results, ` +
        `minimum ${this.minHealthyEngines} required`
      );
    }

    // Apply rank fusion
    let fused = reciprocalRankFusion(resultsArrays);
    fused = deduplicateResults(fused);
    fused = normalizeScores(fused);

    // Return top results
    return fused.slice(0, maxResults);
  }

  /**
   * Query a single engine with all resilience layers applied:
   * 1. robots.txt check
   * 2. Anti-fingerprint headers
   * 3. Rate limiting
   * 4. Retry with backoff
   * 5. Cache (check first, store after)
   */
  private async queryEngineWithResilience(
    engine: SearchEngine,
    query: string,
    options?: SearchOptions,
  ): Promise<import('./types.js').SearchResult[]> {
    // 1. Cache check
    if (this.cache) {
      const cached = this.cache.getSearchResults(query, engine.name);
      if (cached) {
        console.log(`[Search] Cache hit: ${engine.name} for "${query}"`);
        return cached;
      }
    }

    // 2. robots.txt check
    if (this.robotsChecker) {
      const representativeUrl = `https://${engine.name}.com/search?q=${encodeURIComponent(query)}`;
      const isAllowed = await this.robotsChecker.isAllowed(representativeUrl);
      if (!isAllowed) {
        console.log(`[Search] ${engine.name}: blocked by robots.txt, skipping`);
        return [];
      }
    }

    // 3. Anti-fingerprint headers
    const fp = this.enableAntiFingerprint ? generateFingerprint() : undefined;
    const enrichedOptions: SearchOptions = {
      ...options,
      ...(fp?.headers ? { headers: fp.headers } : {}),
    };

    // 4. Rate limiting + Retry
    const fetchFn = async (): Promise<import('./types.js').SearchResult[]> => {
      // Rate limit: wait if needed
      if (this.rateLimiter) {
        const waitMs = this.rateLimiter.waitTimeMs(engine.name);
        if (waitMs > 0) {
          await new Promise(resolve => setTimeout(resolve, waitMs));
        }
        this.rateLimiter.record(engine.name);
      }
      return engine.search(query, enrichedOptions);
    };

    if (this.enableRetry) {
      const retryResult = await withRetry(fetchFn, {
        ...this.retryConfig,
        retryOn: (err) => {
          const msg = String(err).toLowerCase();
          return msg.includes('timeout') || msg.includes('econnreset') || msg.includes('rate limit') || msg.includes('429');
        },
      });

      if (retryResult.ok) {
        // Store in cache
        if (this.cache && retryResult.value.length > 0) {
          this.cache.setSearchResults(query, engine.name, retryResult.value);
        }
        return retryResult.value;
      } else {
        const errLog: EngineErrorLog = {
          engine: engine.name,
          error: retryResult.error.message ?? 'Unknown error',
          timestamp: new Date(),
          query,
        };
        this.onEngineError?.(errLog);
        console.error(`[Search] ${engine.name} failed after ${retryResult.attempts} retries: ${retryResult.error.message}`);
        return [];
      }
    } else {
      try {
        const results = await fetchFn();
        // Store in cache
        if (this.cache && results.length > 0) {
          this.cache.setSearchResults(query, engine.name, results);
        }
        return results;
      } catch (error) {
        const errLog: EngineErrorLog = {
          engine: engine.name,
          error: String(error),
          timestamp: new Date(),
          query,
        };
        this.onEngineError?.(errLog);
        return [];
      }
    }
  }

  /**
   * Fetch and extract content from a URL with retry.
   */
  async fetchPage(url: string): Promise<{
    title: string;
    content: string;
    url: string;
  }> {
    if (!this.crawler) {
      throw new Error('Page crawler is not enabled');
    }

    // robots.txt check
    if (this.robotsChecker) {
      const isAllowed = await this.robotsChecker.isAllowed(url);
      if (!isAllowed) {
        throw new Error(`Blocked by robots.txt: ${url}`);
      }
    }

    // Cache check
    if (this.cache) {
      const cached = this.cache.getPageContent(url);
      if (cached) {
        console.log(`[Search] Cache hit: page ${url}`);
        return { ...cached, url };
      }
    }

    // Fetch with retry
    console.log(`[Search] Fetching page: ${url}`);
    const fetchFn = async () => this.crawler!.fetch(url);

    let page;
    if (this.enableRetry) {
      const retryResult = await withRetry(fetchFn, {
        ...this.retryConfig,
        retryOn: (err) => {
          const msg = String(err).toLowerCase();
          return msg.includes('timeout') || msg.includes('econnreset');
        },
      });
      if (!retryResult.ok) {
        throw retryResult.error;
      }
      page = retryResult.value;
    } else {
      page = await fetchFn();
    }

    // Cache the result
    if (this.cache) {
      this.cache.setPageContent(url, page.title, page.content, page.html);
    }

    return {
      title: page.title,
      content: page.content,
      url: page.url,
    };
  }

  /**
   * Get cache statistics.
   */
  cacheStats(): { searchEntries: number; pageEntries: number } | null {
    return this.cache?.stats() ?? null;
  }

  /**
   * Clean up expired cache entries.
   */
  cleanupCache(): number {
    return this.cache?.cleanup() ?? 0;
  }

  /**
   * Release resources (engines, crawler, cache, robots).
   */
  async close(): Promise<void> {
    // Close all engines that implement close()
    await Promise.all(
      this.engines
        .filter((e): e is SearchEngine & { close(): Promise<void> } => typeof e.close === 'function')
        .map(e => e.close())
    );

    if (this.crawler) {
      await this.crawler.close();
    }
    if (this.cache) {
      this.cache.close();
    }
    if (this.robotsChecker) {
      this.robotsChecker.clearCache();
    }
  }
}
