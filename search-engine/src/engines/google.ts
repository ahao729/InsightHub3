// ============================================================
// Google Search Engine — Playwright-based scraping
// ============================================================

import { chromium, type Browser, type Page } from 'playwright';
import type { SearchEngine, SearchOptions, SearchResult } from '../types.js';

/**
 * Google search engine adapter.
 * Uses Playwright to render the page and extract results.
 * 
 * Safety: Respects rate limits, uses standard browser automation.
 * No authentication required.
 */
export class GoogleEngine implements SearchEngine {
  readonly name = 'google';

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
          params.set('hl', options.language);
        }
        if (options?.region) {
          params.set('gl', options.region);
        }
        if (options?.timeRange) {
          const tbs = this.getTimeRangeParam(options.timeRange);
          if (tbs) params.set('tbs', tbs);
        }
        
        const url = `https://www.google.com/search?${params.toString()}`;
        
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
        
        // Wait for results to appear
        await page.waitForSelector('#search', { timeout: 10000 }).catch(() => {
          // Sometimes Google shows CAPTCHA or different layout
        });
        
        // Extract results
        const results = await page.evaluate(({ maxResults }: { maxResults: number }) => {
          const items: Array<{ title: string; url: string; snippet: string; rank: number }> = [];
          
          // Google search results are in <div id="search"> with <div class="g"> for each result
          const resultDivs = document.querySelectorAll('#search div.g');
          
          let rank = 0;
          for (const div of resultDivs) {
            if (items.length >= maxResults) break;
            
            // Find the main link
            const link = div.querySelector('a[href^="http"]');
            if (!link) continue;
            
            const url = link.getAttribute('href');
            if (!url || url.includes('google.com')) continue;
            
            // Find title
            const titleEl = div.querySelector('h3');
            const title = titleEl?.textContent?.trim() || '';
            
            // Find snippet - usually in <span class="aCOpRe"> or similar
            const snippetEl = div.querySelector('[data-sncf], .VwiC3b, .aCOpRe, [style*="-webkit-line-clamp"]');
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
      console.error(`[Google] Search failed for "${query}":`, error);
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

  /** Convert timeRange to Google's tbs parameter */
  private getTimeRangeParam(timeRange: string): string | null {
    switch (timeRange) {
      case 'day': return 'qdr:d';
      case 'week': return 'qdr:w';
      case 'month': return 'qdr:m';
      case 'year': return 'qdr:y';
      default: return null;
    }
  }

  /** Clean up browser resources */
  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}
