// ============================================================
// Sogou Engine Adapter
// ============================================================

import type { SearchEngine, SearchResult, SearchOptions } from '../types.js';

interface SogouConfig {
  timeout: number;
}

const DEFAULT_CONFIG: SogouConfig = {
  timeout: 15_000,
};

/**
 * Sogou (搜狗) search engine adapter.
 * Scrapes Sogou web search results from the HTML response.
 */
export class SogouEngine implements SearchEngine {
  name = 'sogou';

  private config: SogouConfig;

  constructor(config?: Partial<SogouConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  async search(query: string, options?: SearchOptions): Promise<SearchResult[]> {
    const limit = options?.limit ?? 10;
    const params = new URLSearchParams({
      query,
      num: String(limit),
    });

    if (options?.language === 'zh' || options?.region === 'CN') {
      params.set('ie', 'utf8');
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const res = await fetch(
        `https://www.sogou.com/web?${params.toString()}`,
        {
          signal: controller.signal,
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            Accept:
              'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
          },
        }
      );

      if (!res.ok) {
        throw new Error(`Sogou returned ${res.status}: ${res.statusText}`);
      }

      const html = await res.text();
      return this.parseResults(html, limit);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('abort')) {
        throw new Error(`Sogou search timed out after ${this.config.timeout}ms`);
      }
      throw new Error(`Sogou search failed: ${msg}`);
    } finally {
      clearTimeout(timer);
    }
  }

  async close(): Promise<void> {
    // Nothing to clean up
  }

  /**
   * Parse Sogou search results from HTML.
   * Sogou uses <div class="vrwrap"> for result blocks
   * with <h3><a href="...">title</a></h3>.
   */
  private parseResults(html: string, limit: number): SearchResult[] {
    const results: SearchResult[] = [];

    // Sogou wraps results in <div class="vrwrap"> blocks
    // Each has <h3><a href="...">title</a></h3>
    const h3Pattern =
      /<h3[^>]*>\s*<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>\s*<\/h3>/gi;

    let match: RegExpExecArray | null;

    while ((match = h3Pattern.exec(html)) !== null) {
      if (results.length >= limit) break;

      const rawUrl = match[1];
      const title = stripHtml(match[2]).trim();

      if (!title) continue;

      // Sogou uses redirect URLs too
      const url = extractSogouUrl(rawUrl) || rawUrl;

      const snippet = extractSnippet(html, match.index, 200);

      results.push({
        title,
        url,
        snippet,
        engine: 'sogou',
        rank: results.length + 1,
      });
    }

    return results;
  }
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '');
}

function extractSogouUrl(rawUrl: string): string | null {
  // Sogou redirect URLs contain hl_url or url parameter
  const urlMatch = rawUrl.match(/(?:hl_url|url)=([^&]+)/);
  if (urlMatch) {
    try {
      return decodeURIComponent(urlMatch[1]);
    } catch {
      return null;
    }
  }

  if (rawUrl.startsWith('http')) {
    return rawUrl;
  }

  return null;
}

function extractSnippet(html: string, position: number, maxLength: number): string {
  const start = Math.max(0, position - 50);
  const end = Math.min(html.length, position + maxLength);
  const chunk = html.slice(start, end);
  return stripHtml(chunk)
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}
