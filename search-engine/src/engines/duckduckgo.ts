// ============================================================
// DuckDuckGo Search Engine — Uses official API (no key required)
// ============================================================

import type { SearchEngine, SearchOptions, SearchResult } from '../types.js';

/**
 * DuckDuckGo search engine adapter.
 * Uses the public API endpoint that powers the DDG instant answers.
 * 
 * Reference: https://duckduckgo.com/html/
 * This uses the HTML form endpoint which is the most reliable.
 */
export class DuckDuckGoEngine implements SearchEngine {
  readonly name = 'duckduckgo';

  private readonly baseUrl = 'https://html.duckduckgo.com/html/';
  private readonly userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

  async search(query: string, options?: SearchOptions): Promise<SearchResult[]> {
    const limit = options?.limit ?? 10;
    
    try {
      const params = new URLSearchParams({
        q: query,
        kl: options?.region === 'zh' ? 'cn-zh' : 'us-en',
      });

      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': this.userAgent,
        },
        body: params.toString(),
      });

      if (!response.ok) {
        throw new Error(`DDG search failed: ${response.status} ${response.statusText}`);
      }

      const html = await response.text();
      return this.parseResults(html, limit);
    } catch (error) {
      console.error(`[DuckDuckGo] Search failed for "${query}":`, error);
      return [];
    }
  }

  /**
   * Parse HTML results from DDG HTML endpoint.
   * The HTML structure has `.result` divs with `.result__title` and `.result__snippet`.
   */
  private parseResults(html: string, limit: number): SearchResult[] {
    const results: SearchResult[] = [];
    
    // Match result blocks: <div class="result results_links results_links_deep web-result">
    // Inside each: <a class="result__a" href="...">title</a>
    //              <a class="result__snippet" href="...">snippet</a>
    
    const resultRegex = /<div[^>]*class="[^"]*result[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/gi;
    const titleLinkRegex = /<a[^>]*class="result__a"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/i;
    const snippetRegex = /<a[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/a>/i;
    
    let match: RegExpExecArray | null;
    
    while ((match = resultRegex.exec(html)) !== null && results.length < limit) {
      const block = match[1];
      
      const titleMatch = titleLinkRegex.exec(block);
      const snippetMatch = snippetRegex.exec(block);
      
      if (titleMatch && snippetMatch) {
        let url = titleMatch[1];
        // DDG wraps URLs in a redirect, extract the actual URL
        const uddgMatch = url.match(/uddg=([^&]+)/);
        if (uddgMatch) {
          url = decodeURIComponent(uddgMatch[1]);
        }
        
        const title = this.decodeHtmlEntities(titleMatch[2].replace(/<[^>]+>/g, '').trim());
        const snippet = this.decodeHtmlEntities(snippetMatch[1].replace(/<[^>]+>/g, '').trim());
        
        if (title && url) {
          results.push({
            title,
            url,
            snippet,
            engine: this.name,
            rank: results.length + 1,
          });
        }
      }
    }
    
    return results;
  }

  /** Decode common HTML entities */
  private decodeHtmlEntities(text: string): string {
    return text
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&#x27;/g, "'")
      .replace(/&nbsp;/g, ' ');
  }
}
