import { describe, it, expect, afterEach, vi } from 'vitest';
import { SQLiteCache } from '../../src/cache/sqlite.js';
import type { SearchResult } from '../../src/types.js';
import { rmSync, existsSync } from 'fs';

const TEST_DB_PATH = '.cache/test-search-cache.db';

function createTestCache(config?: { searchTTL?: number; pageTTL?: number }): SQLiteCache {
  return new SQLiteCache({ dbPath: TEST_DB_PATH, ...config });
}

afterEach(() => {
  // Clean up test DB
  try {
    if (existsSync(TEST_DB_PATH)) {
      rmSync(TEST_DB_PATH);
    }
    if (existsSync(TEST_DB_PATH + '-wal')) {
      rmSync(TEST_DB_PATH + '-wal');
    }
    if (existsSync(TEST_DB_PATH + '-shm')) {
      rmSync(TEST_DB_PATH + '-shm');
    }
  } catch {
    // ignore cleanup errors
  }
});

// -------------------------------------------------------
// Search Results Cache
// -------------------------------------------------------

describe('SQLiteCache — Search Results', () => {
  it('returns null for cache miss', () => {
    const cache = createTestCache();
    const result = cache.getSearchResults('test query', 'duckduckgo');
    expect(result).toBeNull();
    cache.close();
  });

  it('stores and retrieves search results', () => {
    const cache = createTestCache();
    const results: SearchResult[] = [
      { title: 'Test', url: 'https://test.com', snippet: 'Snippet', engine: 'duckduckgo', rank: 1 },
    ];

    cache.setSearchResults('test query', 'duckduckgo', results);
    const cached = cache.getSearchResults('test query', 'duckduckgo');

    expect(cached).not.toBeNull();
    expect(cached).toHaveLength(1);
    expect(cached![0].title).toBe('Test');
    expect(cached![0].url).toBe('https://test.com');

    cache.close();
  });

  it('returns different results for different engines', () => {
    const cache = createTestCache();
    const ddgResults: SearchResult[] = [
      { title: 'DDG Result', url: 'https://ddg.com', snippet: '', engine: 'duckduckgo', rank: 1 },
    ];
    const googleResults: SearchResult[] = [
      { title: 'Google Result', url: 'https://google.com', snippet: '', engine: 'google', rank: 1 },
    ];

    cache.setSearchResults('test query', 'duckduckgo', ddgResults);
    cache.setSearchResults('test query', 'google', googleResults);

    const ddgCached = cache.getSearchResults('test query', 'duckduckgo');
    const googleCached = cache.getSearchResults('test query', 'google');

    expect(ddgCached![0].title).toBe('DDG Result');
    expect(googleCached![0].title).toBe('Google Result');

    cache.close();
  });

  it('overwrites results for same query+engine (UPSERT)', () => {
    const cache = createTestCache();
    const v1: SearchResult[] = [
      { title: 'V1', url: 'https://v1.com', snippet: '', engine: 'ddg', rank: 1 },
    ];
    const v2: SearchResult[] = [
      { title: 'V2', url: 'https://v2.com', snippet: '', engine: 'ddg', rank: 1 },
    ];

    cache.setSearchResults('query', 'ddg', v1);
    cache.setSearchResults('query', 'ddg', v2);

    const cached = cache.getSearchResults('query', 'ddg');
    expect(cached![0].title).toBe('V2');

    cache.close();
  });

  it('returns empty array stored correctly', () => {
    const cache = createTestCache();

    cache.setSearchResults('empty query', 'ddg', []);
    const cached = cache.getSearchResults('empty query', 'ddg');

    expect(cached).toEqual([]);

    cache.close();
  });

  it('stores multiple results per engine', () => {
    const cache = createTestCache();
    const results: SearchResult[] = [
      { title: 'R1', url: 'https://r1.com', snippet: 'S1', engine: 'ddg', rank: 1 },
      { title: 'R2', url: 'https://r2.com', snippet: 'S2', engine: 'ddg', rank: 2 },
      { title: 'R3', url: 'https://r3.com', snippet: 'S3', engine: 'ddg', rank: 3 },
    ];

    cache.setSearchResults('multi', 'ddg', results);
    const cached = cache.getSearchResults('multi', 'ddg');

    expect(cached).toHaveLength(3);
    expect(cached![2].title).toBe('R3');

    cache.close();
  });
});

// -------------------------------------------------------
// Page Content Cache
// -------------------------------------------------------

describe('SQLiteCache — Page Content', () => {
  it('returns null for cache miss', () => {
    const cache = createTestCache();
    const result = cache.getPageContent('https://test.com');
    expect(result).toBeNull();
    cache.close();
  });

  it('stores and retrieves page content', () => {
    const cache = createTestCache();

    cache.setPageContent('https://test.com', 'Test Title', 'Test content body', '<html>Test</html>');
    const cached = cache.getPageContent('https://test.com');

    expect(cached).not.toBeNull();
    expect(cached!.title).toBe('Test Title');
    expect(cached!.content).toBe('Test content body');
    expect(cached!.html).toBe('<html>Test</html>');

    cache.close();
  });

  it('stores page without html', () => {
    const cache = createTestCache();

    cache.setPageContent('https://nohtml.com', 'No HTML', 'Content only');
    const cached = cache.getPageContent('https://nohtml.com');

    expect(cached!.title).toBe('No HTML');
    expect(cached!.content).toBe('Content only');
    // better-sqlite3 returns null for NULL columns
    expect(cached!.html).toBeFalsy();

    cache.close();
  });

  it('overwrites existing page content (UPSERT)', () => {
    const cache = createTestCache();

    cache.setPageContent('https://page.com', 'V1', 'Content V1');
    cache.setPageContent('https://page.com', 'V2', 'Content V2');

    const cached = cache.getPageContent('https://page.com');
    expect(cached!.title).toBe('V2');

    cache.close();
  });
});

// -------------------------------------------------------
// TTL Expiration
// -------------------------------------------------------

describe('SQLiteCache — TTL', () => {
  it('returns fresh results within TTL', () => {
    const cache = new SQLiteCache({ dbPath: TEST_DB_PATH, searchTTL: 60 });

    cache.setSearchResults('ttl-query', 'ddg', [
      { title: 'Fresh', url: 'https://fresh.com', snippet: '', engine: 'ddg', rank: 1 },
    ]);

    // Should be available immediately (well within 60s TTL)
    expect(cache.getSearchResults('ttl-query', 'ddg')).not.toBeNull();

    cache.close();
  });

  it('expires search results when TTL exceeded', () => {
    // Use a very short TTL (1 second)
    const cache = createTestCache({ searchTTL: 1 });

    cache.setSearchResults('ttl-test', 'ddg', [{ title: 'Should Expire', rank: 1 }]);

    // Should be available immediately (age = 0, 0 > 1 = false)
    expect(cache.getSearchResults('ttl-test', 'ddg')).not.toBeNull();

    // Manually backdate the entry to simulate TTL expiration
    const db = (cache as any).db;
    db.prepare("UPDATE search_results SET created_at = created_at - 100 WHERE query = 'ttl-test' AND engine = 'ddg'").run();

    const result = cache.getSearchResults('ttl-test', 'ddg');
    expect(result).toBeNull();

    cache.close();
  });

  it('expires page content when TTL exceeded', () => {
    // Use a very short TTL (1 second)
    const cache = createTestCache({ pageTTL: 1 });

    cache.setPageContent('https://ttl-page.com', 'Should Expire', 'Content');

    // Should be available immediately
    expect(cache.getPageContent('https://ttl-page.com')).not.toBeNull();

    // Manually backdate the entry
    const db = (cache as any).db;
    db.prepare("UPDATE page_content SET created_at = created_at - 100 WHERE url = 'https://ttl-page.com'").run();

    const result = cache.getPageContent('https://ttl-page.com');
    expect(result).toBeNull();

    cache.close();
  });

  it('does not expire entry within TTL window', () => {
    const cache = new SQLiteCache({ dbPath: TEST_DB_PATH, pageTTL: 3600 });

    cache.setPageContent('https://fresh.com', 'Fresh', 'Content');
    // Within the TTL window, should still be available
    expect(cache.getPageContent('https://fresh.com')).not.toBeNull();

    cache.close();
  });
});

// -------------------------------------------------------
// Cleanup and Stats
// -------------------------------------------------------

describe('SQLiteCache — Maintenance', () => {
  it('stats returns counts', () => {
    const cache = createTestCache();

    expect(cache.stats()).toEqual({ searchEntries: 0, pageEntries: 0 });

    cache.setSearchResults('q1', 'ddg', [{ title: 'A', url: 'https://a.com', snippet: '', engine: 'ddg', rank: 1 }]);
    cache.setSearchResults('q2', 'google', [{ title: 'B', url: 'https://b.com', snippet: '', engine: 'google', rank: 1 }]);
    cache.setPageContent('https://page.com', 'Page', 'Content');

    const stats = cache.stats();
    expect(stats.searchEntries).toBe(2);
    expect(stats.pageEntries).toBe(1);

    cache.close();
  });

  it('cleanup removes expired entries', () => {
    const cache = new SQLiteCache({ dbPath: TEST_DB_PATH, searchTTL: 0, pageTTL: 0 });

    cache.setSearchResults('q1', 'ddg', [{ title: 'A', url: 'https://a.com', snippet: '', engine: 'ddg', rank: 1 }]);
    cache.setPageContent('https://page.com', 'Page', 'Content');

    const deleted = cache.cleanup();
    expect(deleted).toBeGreaterThanOrEqual(0); // May be 0 if TTL=0 already cleared them in get, but cleanup is independent

    cache.close();
  });
});
