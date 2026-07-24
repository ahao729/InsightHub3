// ============================================================
// InsightHubSearch — Main Search Engine Unit Tests
// ============================================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { SearchEngine, SearchResult, SearchOptions } from '../src/types.js';

// Mock PageCrawler to avoid jsdom/playwright dependency issues in unit tests
const mockFetchPage = vi.fn().mockResolvedValue({ url: '', title: '', content: '', html: '', fetchedAt: new Date() });
const mockCloseCrawler = vi.fn().mockResolvedValue(undefined);
vi.mock('../src/crawler/crawler.js', () => ({
  PageCrawler: vi.fn().mockImplementation(() => ({
    fetch: mockFetchPage,
    close: mockCloseCrawler,
  })),
}));

import { InsightHubSearch } from '../src/search.js';
// -------------------------------------------------------
// Mock Search Engine Factory
// -------------------------------------------------------

function createMockEngine(
  name: string,
  results: SearchResult[] = [],
  opts?: { closeCalled?: () => void; closeError?: string }
): SearchEngine {
  let closeMock: (() => Promise<void>) | undefined;
  if (opts?.closeError) {
    closeMock = vi.fn().mockRejectedValue(new Error(opts.closeError));
  } else if (opts?.closeCalled) {
    closeMock = vi.fn().mockImplementation(async () => opts.closeCalled!());
  } else {
    closeMock = vi.fn().mockResolvedValue(undefined);
  }
  return {
    name,
    search: vi.fn().mockResolvedValue(results),
    close: closeMock,
  };
}

// -------------------------------------------------------
// Tests
// -------------------------------------------------------

describe('InsightHubSearch', () => {
  describe('constructor', () => {
    it('creates instance with defaults', () => {
      const search = new InsightHubSearch();
      expect(search).toBeInstanceOf(InsightHubSearch);
    });

    it('accepts custom engines', () => {
      const engine = createMockEngine('test-engine');
      const search = new InsightHubSearch({ engines: [engine], enableCache: false, enableCrawler: false });
      expect(search).toBeInstanceOf(InsightHubSearch);
    });

    it('can disable cache', () => {
      const search = new InsightHubSearch({ enableCache: false, enableCrawler: false });
      expect(search.cacheStats()).toBeNull();
    });

    it('can disable crawler', async () => {
      const engine = createMockEngine('test-engine');
      const search = new InsightHubSearch({
        engines: [engine],
        enableCache: false,
        enableCrawler: false,
      });

      await expect(search.fetchPage('https://test.com')).rejects.toThrow(
        'Page crawler is not enabled'
      );
    });
  });

  describe('search()', () => {
    it('queries all engines and returns fused results', async () => {
      const engine1 = createMockEngine('engine-1', [
        { title: 'R1', url: 'https://a.com', snippet: 's1', engine: 'engine-1', rank: 1 },
      ]);
      const engine2 = createMockEngine('engine-2', [
        { title: 'R2', url: 'https://b.com', snippet: 's2', engine: 'engine-2', rank: 1 },
      ]);

      const search = new InsightHubSearch({
        engines: [engine1, engine2],
        enableCache: false,
        enableCrawler: false,
        enableAntiFingerprint: false,
        enableRateLimiter: false,
        enableRobots: false,
        enableRetry: false,
      });

      const results = await search.search('test query');
      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(engine1.search).toHaveBeenCalledWith('test query', {});
      expect(engine2.search).toHaveBeenCalledWith('test query', {});
    });

    it('applies maxResults limit', async () => {
      const engine = createMockEngine('eng', [
        { title: 'R1', url: 'https://1.com', snippet: '', engine: 'eng', rank: 1 },
        { title: 'R2', url: 'https://2.com', snippet: '', engine: 'eng', rank: 2 },
        { title: 'R3', url: 'https://3.com', snippet: '', engine: 'eng', rank: 3 },
      ]);

      const search = new InsightHubSearch({
        engines: [engine],
        enableCache: false,
        enableCrawler: false,
      });

      const results = await search.search('query', { maxResults: 2 });
      expect(results.length).toBeLessThanOrEqual(2);
    });

    it('passes search options through to engines', async () => {
      const engine = createMockEngine('eng', [
        { title: 'R1', url: 'https://1.com', snippet: '', engine: 'eng', rank: 1 },
      ]);
      const search = new InsightHubSearch({
        engines: [engine],
        enableCache: false,
        enableCrawler: false,
        enableAntiFingerprint: false,
        enableRateLimiter: false,
        enableRobots: false,
        enableRetry: false,
      });

      const opts: SearchOptions = { language: 'zh', region: 'CN', limit: 5 };
      await search.search('query', opts);
      expect(engine.search).toHaveBeenCalledWith('query', opts);
    });

    it('deduplicates results with same URL', async () => {
      const sharedUrl = 'https://shared.com';
      const engine1 = createMockEngine('eng1', [
        { title: 'From E1', url: sharedUrl, snippet: 'short', engine: 'eng1', rank: 1 },
      ]);
      const engine2 = createMockEngine('eng2', [
        { title: 'From E2', url: sharedUrl, snippet: 'a much longer snippet for dedup', engine: 'eng2', rank: 1 },
      ]);

      const search = new InsightHubSearch({
        engines: [engine1, engine2],
        enableCache: false,
        enableCrawler: false,
      });

      const results = await search.search('query');
      const urls = results.map(r => r.url);
      // Deduplication: each URL should appear only once
      const uniqueUrls = [...new Set(urls)];
      expect(urls.length).toBe(uniqueUrls.length);
    });

    it('returns empty array when no engines', async () => {
      const search = new InsightHubSearch({
        engines: [],
        enableCache: false,
        enableCrawler: false,
        minHealthyEngines: 0,
      });

      const results = await search.search('query');
      expect(results).toEqual([]);
    });

    it('handles engine throwing an error gracefully', async () => {
      const goodEngine = createMockEngine('good', [
        { title: 'OK', url: 'https://ok.com', snippet: '', engine: 'good', rank: 1 },
      ]);
      const badEngine = createMockEngine('bad');
      (badEngine.search as any).mockRejectedValue(new Error('Engine failed'));

      const search = new InsightHubSearch({
        engines: [goodEngine, badEngine],
        enableCache: false,
        enableCrawler: false,
        enableRetry: false,
        enableRobots: false,
        enableRateLimiter: false,
        enableAntiFingerprint: false,
      });

      // With resilience layers, the bad engine error is caught and logged,
      // returning partial results from the good engine instead of throwing
      const results = await search.search('query');
      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(results[0].engine).toBe('good');
    });
  });

  describe('fetchPage()', () => {
    it('throws when crawler is disabled', async () => {
      const search = new InsightHubSearch({
        engines: [],
        enableCache: false,
        enableCrawler: false,
      });

      await expect(search.fetchPage('https://example.com')).rejects.toThrow(
        'Page crawler is not enabled'
      );
    });
  });

  describe('cacheStats()', () => {
    it('returns null when cache is disabled', () => {
      const search = new InsightHubSearch({
        engines: [],
        enableCache: false,
        enableCrawler: false,
      });
      expect(search.cacheStats()).toBeNull();
    });

    it('returns stats when cache is enabled', () => {
      const search = new InsightHubSearch({ engines: [] });
      const stats = search.cacheStats();
      expect(stats).not.toBeNull();
      expect(stats!.searchEntries).toBeGreaterThanOrEqual(0);
      expect(stats!.pageEntries).toBeGreaterThanOrEqual(0);
    });
  });

  describe('cleanupCache()', () => {
    it('returns 0 when cache is disabled', () => {
      const search = new InsightHubSearch({
        engines: [],
        enableCache: false,
        enableCrawler: false,
      });
      expect(search.cleanupCache()).toBe(0);
    });
  });

  describe('close()', () => {
    it('calls close on engines that implement it', async () => {
      const closeCalled = { called: false };
      const engine = createMockEngine('eng', [], {
        closeCalled: () => { closeCalled.called = true; },
      });

      const search = new InsightHubSearch({
        engines: [engine],
        enableCache: false,
        enableCrawler: false,
      });

      await search.close();
      expect(closeCalled.called).toBe(true);
    });

    it('skips engines without close()', async () => {
      const engine: SearchEngine = {
        name: 'no-close',
        search: vi.fn().mockResolvedValue([]),
        // no close method
      };

      const search = new InsightHubSearch({
        engines: [engine],
        enableCache: false,
        enableCrawler: false,
      });

      // Should not throw
      await search.close();
    });

    it('closes crawler and cache', async () => {
      const search = new InsightHubSearch({ engines: [] });
      // Should not throw — crawler.close() and cache.close() both succeed
      await search.close();
    });

    it('handles close errors gracefully', async () => {
      const engine = createMockEngine('bad-eng', [], { closeError: 'close failed' });

      const search = new InsightHubSearch({
        engines: [engine],
        enableCache: false,
        enableCrawler: false,
      });

      await expect(search.close()).rejects.toThrow('close failed');
    });
  });
});
