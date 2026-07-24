// ============================================================
// PageCrawler — Unit Tests (mocked Playwright)
// ============================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';

// All mock functions must live inside vi.hoisted() so they are available
// in the vi.mock() factory calls (which are hoisted before imports).
const {
  mockClose, mockContextClose, mockContent, mockTitle,
  mockGoto, mockNewPage, mockNewContext, mockIsConnected,
  mockLaunch, mockReadabilityParse, MockReadability, MockJSDOM,
} = vi.hoisted(() => {
  const mockClose = vi.fn();
  const mockContextClose = vi.fn();
  const mockContent = vi.fn().mockResolvedValue(
    '<html><head><title>Test Title</title></head><body><p>Hello World</p></body></html>'
  );
  const mockTitle = vi.fn().mockResolvedValue('Test Title');
  const mockGoto = vi.fn().mockResolvedValue({});

  const mockReadabilityParse = vi.fn().mockReturnValue({
    textContent: 'Parsed readable content from Readability',
  });
  const MockReadability = vi.fn().mockImplementation(() => ({
    parse: mockReadabilityParse,
  }));

  const MockJSDOM = vi.fn().mockImplementation(() => ({
    window: {
      document: {
        body: { textContent: 'DOM body fallback text' },
      },
    },
  }));

  const mockNewPage = vi.fn().mockResolvedValue({
    goto: mockGoto,
    content: mockContent,
    title: mockTitle,
  });
  const mockNewContext = vi.fn().mockResolvedValue({
    close: mockContextClose,
    newPage: mockNewPage,
  });
  const mockIsConnected = vi.fn().mockReturnValue(true);
  const mockBrowser = {
    isConnected: mockIsConnected,
    newContext: mockNewContext,
    close: mockClose,
  };
  const mockLaunch = vi.fn().mockResolvedValue(mockBrowser);

  return {
    mockClose, mockContextClose, mockContent, mockTitle,
    mockGoto, mockNewPage, mockNewContext, mockIsConnected,
    mockLaunch, mockReadabilityParse, MockReadability, MockJSDOM,
  };
});

vi.mock('playwright', () => ({
  chromium: { launch: mockLaunch },
}));

vi.mock('@mozilla/readability', () => ({
  Readability: MockReadability,
}));

vi.mock('jsdom', () => ({
  JSDOM: MockJSDOM,
}));

import { PageCrawler } from '../../src/crawler/crawler.js';

// -------------------------------------------------------
// Tests
// -------------------------------------------------------

describe('PageCrawler', () => {
  let crawler: PageCrawler;

  beforeEach(() => {
    // Reset all mocks (clears call counts AND mockReturnValueOnce queues)
    vi.resetAllMocks();

    // Re-establish Playwright mocks
    mockIsConnected.mockReturnValue(true);
    mockNewPage.mockResolvedValue({
      goto: mockGoto,
      content: mockContent,
      title: mockTitle,
    });
    mockNewContext.mockResolvedValue({
      close: mockContextClose,
      newPage: mockNewPage,
    });
    mockContent.mockResolvedValue(
      '<html><head><title>Test Title</title></head><body><p>Hello World</p></body></html>'
    );
    mockTitle.mockResolvedValue('Test Title');
    mockGoto.mockResolvedValue({});
    mockLaunch.mockResolvedValue({
      isConnected: mockIsConnected,
      newContext: mockNewContext,
      close: mockClose,
    });

    // Re-establish Readability / JSDOM mock implementations
    mockReadabilityParse.mockReturnValue({
      textContent: 'Parsed readable content from Readability',
    });
    MockReadability.mockImplementation(() => ({
      parse: mockReadabilityParse,
    }));
    MockJSDOM.mockImplementation(() => ({
      window: {
        document: {
          body: { textContent: 'DOM body fallback text' },
        },
      },
    }));

    crawler = new PageCrawler();
  });

  describe('fetch()', () => {
    it('fetches a URL and returns PageContent', async () => {
      const result = await crawler.fetch('https://example.com');

      expect(result.url).toBe('https://example.com');
      expect(result.title).toBe('Test Title');
      expect(result.content).toBe('Parsed readable content from Readability');
      expect(result.html).toContain('<html>');
      expect(result.fetchedAt).toBeInstanceOf(Date);
    });

    it('creates a new browser if not connected', async () => {
      mockIsConnected.mockReturnValueOnce(false);

      await crawler.fetch('https://test.com');

      expect(mockLaunch).toHaveBeenCalled();
    });

    it('reuses existing browser if connected', async () => {
      // First fetch to initialize browser
      await crawler.fetch('https://first.com');
      mockLaunch.mockClear();

      // Second fetch should reuse
      await crawler.fetch('https://second.com');

      expect(mockLaunch).not.toHaveBeenCalled();
    });

    it('creates a new context for each fetch', async () => {
      await crawler.fetch('https://a.com');
      await crawler.fetch('https://b.com');

      expect(mockNewContext).toHaveBeenCalledTimes(2);
    });

    it('closes context after each fetch (cleanup)', async () => {
      await crawler.fetch('https://test.com');

      expect(mockContextClose).toHaveBeenCalledTimes(1);
    });

    it('navigates with domcontentloaded wait', async () => {
      await crawler.fetch('https://test.com');

      expect(mockGoto).toHaveBeenCalledWith('https://test.com', {
        waitUntil: 'domcontentloaded',
        timeout: 15000,
      });
    });

    it('respects custom timeout option', async () => {
      await crawler.fetch('https://test.com', { timeout: 30000 });

      expect(mockGoto).toHaveBeenCalledWith('https://test.com', {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
      });
    });

    it('skips Readability when extractContent is false', async () => {
      const result = await crawler.fetch('https://test.com', { extractContent: false });

      // Content should be empty since extraction is disabled
      expect(result.content).toBe('');
    });

    it('propagates navigation errors', async () => {
      mockGoto.mockRejectedValueOnce(new Error('Navigation timeout'));

      await expect(crawler.fetch('https://timeout.com')).rejects.toThrow(
        'Navigation timeout'
      );
    });

    it('closes context even on error (finally block)', async () => {
      mockGoto.mockRejectedValueOnce(new Error('Page crash'));

      try {
        await crawler.fetch('https://crash.com');
      } catch {
        // expected
      }

      expect(mockContextClose).toHaveBeenCalled();
    });
  });

  describe('close()', () => {
    it('closes the browser', async () => {
      // Initialize browser
      await crawler.fetch('https://init.com');
      vi.clearAllMocks();
      mockClose.mockClear();

      await crawler.close();

      expect(mockClose).toHaveBeenCalledTimes(1);
    });

    it('sets browser to null after close', async () => {
      await crawler.fetch('https://init.com');
      await crawler.close();

      // Next fetch should launch a new browser
      mockLaunch.mockClear();
      await crawler.fetch('https://after-close.com');

      expect(mockLaunch).toHaveBeenCalled();
    });

    it('does nothing if browser is not initialized', async () => {
      // close() without any fetch first
      await crawler.close();
      expect(mockClose).not.toHaveBeenCalled();
    });
  });
});
