// ============================================================
// Page Crawler — Fetch and extract web page content
// ============================================================

import { chromium, type Browser } from 'playwright';
import { Readability } from '@mozilla/readability';
import { JSDOM } from 'jsdom';
import type { FetchOptions, PageContent } from '../types.js';

/**
 * Web page crawler that fetches content using Playwright
 * and extracts readable text using Mozilla's Readability.
 * 
 * Safety: Uses standard browser, respects timeouts.
 * No authentication or headless detection bypass needed.
 */
export class PageCrawler {
  private browser: Browser | null = null;
  private userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

  /**
   * Fetch a URL and extract its content.
   */
  async fetch(url: string, options?: FetchOptions): Promise<PageContent> {
    const timeout = options?.timeout ?? 15000;
    const extractContent = options?.extractContent ?? true;
    
    try {
      const { page, context } = await this.getPage();
      
      try {
        // Navigate to the URL
        const response = await page.goto(url, {
          waitUntil: 'domcontentloaded',
          timeout,
        });
        
        const html = await page.content();
        const title = await page.title();
        
        let content = '';
        
        if (extractContent) {
          // Use Readability to extract main content
          content = this.extractReadableContent(html, url);
        }
        
        return {
          url,
          title,
          content,
          html,
          fetchedAt: new Date(),
        };
      } finally {
        await context.close();
      }
      
    } catch (error) {
      console.error(`[Crawler] Failed to fetch ${url}:`, error);
      throw error;
    }
  }

  /**
   * Extract readable content from HTML using Mozilla Readability.
   */
  private extractReadableContent(html: string, url: string): string {
    try {
      const dom = new JSDOM(html, { url });
      const reader = new Readability(dom.window.document);
      const article = reader.parse();
      
      if (article && article.textContent) {
        return article.textContent.trim();
      }
      
      // Fallback: extract all text
      return dom.window.document.body?.textContent?.trim() || '';
    } catch (error) {
      // If Readability fails, return empty
      console.warn('[Crawler] Readability extraction failed:', error);
      return '';
    }
  }

  /**
   * Get or create browser instance, returns page and context for proper cleanup.
   */
  private async getPage() {
    if (!this.browser || !this.browser.isConnected()) {
      this.browser = await chromium.launch({
        headless: true,
        args: ['--no-sandbox'],
      });
    }
    
    const context = await this.browser.newContext({
      userAgent: this.userAgent,
      viewport: { width: 1920, height: 1080 },
    });
    
    const page = await context.newPage();
    return { page, context };
  }

  /**
   * Clean up browser resources.
   */
  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}
