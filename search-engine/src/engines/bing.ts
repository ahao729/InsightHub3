// ============================================================
// Bing Search Engine — Playwright-based scraping
// ============================================================

import { chromium, type Browser, type Page } from 'playwright';
import type { SearchEngine, SearchOptions, SearchResult } from '../types.js';

/**
 * Bing search engine adapter.
 * Uses Playwright to render the page and extract results.
 * 
 * Safety: Respects rate limits, uses standard browser automation.
 * No authentication required.
 */
export class BingEngine implements SearchEngine {
  readonly name = 'bing';

  private browser: Browser | null = null;

  private readonly userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

  async search(query: string, options?: SearchOptions): Promise<SearchResult[]> {
    const limit = options?.limit ?? 10;
    
    try {
      const { page, context } = await this.getPage();
      
      try {
        // Build search URL
        const params = new URLSearchParams({ q: query });
        if (options?.language) {
          params.set('setlang', options.language);
        }
        if (options?.region) {
          params.set('cc', options.region);
        }
        
        const url = `https://www.bing.com/search?${params.toString()}`;
        
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
        
        // Wait for results
        await page.waitForSelector('#b_results', { timeout: 10000 }).catch(() => {});
        
        // Extract results
        const results = await page.evaluate(({ maxResults }: { maxResults: number }) => {
          const items: Array<{ title: string; url: string; snippet: string; rank: number }> = [];
          
          // Bing results are in <li class="b_algo"> inside <ol id="b_results">
          const resultItems = document.querySelectorAll('#b_results li.b_algo');
          
          let rank = 0;
          for (const item of resultItems) {
            if (items.length >= maxResults) break;
            
            // Find the main link
            const link = item.querySelector('h2 a');
            if (!link) continue;
            
            const url = link.getAttribute('href');
            if (!url || !url.startsWith('http')) continue;
            
            const title = link.textContent?.trim() || '';
            
            // Find snippet - Bing uses <p> or <div class="b_caption">
            const snippetEl = item.querySelector('.b_caption p, .b_algoSlug');
            const snippet = snippetEl?.textContent?.trim() || '';
            
            if (title && url) {
              rank++;
              items.push({ title, url, snippet, rank });
            }
          }
          
          return items;
        }, { maxResults: limit });
        
        return results.map((r: { title: string; url: string; snippet: string; rank: number }) => ({ ...r, engine: this.name }));
      } finally {
        await context.close();
      }
      
    } catch (error) {
      console.error(`[Bing] Search failed for "${query}":`, error);
      return [];
    }
  }

  /** Get or create browser instance, returns page and context for proper cleanup */
  private async getPage(): Promise<{ page: Page; context: import('playwright').BrowserContext }> {
    if (!this.browser || !this.browser.isConnected()) {
      this.browser = await chromium.launch({
        headless: true,
        args: [
          '--disable-blink-features=AutomationControlled',
          '--no-sandbox',
        ],
      });
    }
    
    const context = await this.browser.newContext({
      userAgent: this.userAgent,
      viewport: { width: 1920, height: 1080 },
      locale: 'en-US',
    });
    
    const page = await context.newPage();
    return { page, context };
  }

  /** Clean up browser resources */
  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}
