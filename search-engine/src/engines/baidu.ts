// ============================================================
// Baidu Engine Adapter
// ============================================================

import type { SearchEngine, SearchResult, SearchOptions } from '../types.js';

interface BaiduConfig {
  timeout: number;
}

const DEFAULT_CONFIG: BaiduConfig = {
  timeout: 15_000,
};

/**
 * Baidu (百度) search engine adapter.
 * Scrapes Baidu search results from the HTML response.
 */
export class BaiduEngine implements SearchEngine {
  name = 'baidu';

  private config: BaiduConfig;

  constructor(config?: Partial<BaiduConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  async search(query: string, options?: SearchOptions): Promise<SearchResult[]> {
    const limit = options?.limit ?? 10;
    const params = new URLSearchParams({
      wd: query,
      pn: '0',
      rn: String(limit),
    });

    // Add language/regional hints
    if (options?.language === 'zh' || options?.region === 'CN') {
      params.set('cl', '3'); // Chinese language
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const res = await fetch(`https://www.baidu.com/s?${params.toString()}`, {
        signal: controller.signal,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Accept:
            'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        },
      });

      if (!res.ok) {
        throw new Error(`Baidu returned ${res.status}: ${res.statusText}`);
      }

      const html = await res.text();
      return this.parseResults(html, limit);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('abort')) {
        throw new Error(`Baidu search timed out after ${this.config.timeout}ms`);
      }
      throw new Error(`Baidu search failed: ${msg}`);
    } finally {
      clearTimeout(timer);
    }
  }

  async close(): Promise<void> {
    // Nothing to clean up
  }

  /**
   * Parse Baidu search results from HTML.
   * Baidu uses <div class="result"> blocks with <h3><a> for titles.
   */
  private parseResults(html: string, limit: number): SearchResult[] {
    const results: SearchResult[] = [];

    // Match result blocks: <div class="result c-container ...">
    const resultPattern =
      /<div[^>]*class="[^"]*result[^"]*c-container[^"]*"[^>]*>([\s\S]*?)(?=<div[^>]*class="[^"]*result[^"]*c-container|$)/g;

    // Fallback: try simpler pattern for <h3><a href="...">title</a></h3> pairs
    const simplePattern =
      /<h3[^>]*>\s*<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>\s*<\/h3>/gi;

    let match: RegExpExecArray | null;

    // Try the simple pattern (more reliable across Baidu variants)
    while ((match = simplePattern.exec(html)) !== null) {
      if (results.length >= limit) break;

      const rawUrl = match[1];
      const title = stripHtml(match[2]).trim();

      if (!title) continue;

      // Baidu wraps real URLs in redirects; extract the actual URL
      const url = extractBaiduUrl(rawUrl) || rawUrl;

      // Try to find a snippet near the match
      const snippet = extractSnippet(html, match.index, 200);

      results.push({
        title,
        url,
        snippet,
        engine: 'baidu',
        rank: results.length + 1,
      });
    }

    return results;
  }
}

/** Strip HTML tags from a string */
function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '');
}

/** Extract the real URL from Baidu redirect URLs */
function extractBaiduUrl(rawUrl: string): string | null {
  // Baidu uses /link?url=... redirects
  const linkMatch = rawUrl.match(/\/link\?url=([^&]+)/);
  if (linkMatch) {
    try {
      return decodeURIComponent(linkMatch[1]);
    } catch {
      return null;
    }
  }

  // Direct URL
  if (rawUrl.startsWith('http')) {
    return rawUrl;
  }

  return null;
}

/** Extract surrounding text as a snippet */
function extractSnippet(html: string, position: number, maxLength: number): string {
  const start = Math.max(0, position - 50);
  const end = Math.min(html.length, position + maxLength);
  const chunk = html.slice(start, end);
  return stripHtml(chunk)
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}
