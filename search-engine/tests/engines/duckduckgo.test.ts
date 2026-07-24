import { describe, it, expect, vi, afterEach } from 'vitest';
import { DuckDuckGoEngine } from '../../src/engines/duckduckgo.js';

// -------------------------------------------------------
// Helpers
// -------------------------------------------------------

function makeDDGHtml(results: Array<{ title: string; url: string; snippet: string }>): string {
  const blocks = results.map(r => `
    <div class="result results_links results_links_deep web-result">
      <div class="links_main links_deep result__body">
        <a rel="nofollow" class="result__a" href="https://duckduckgo.com/l/?uddg=${encodeURIComponent(r.url)}">${r.title}</a>
        <a class="result__snippet" href="#">${r.snippet}</a>
      </div>
    </div>
  `).join('');
  return `<html><body>${blocks}</body></html>`;
}

const mockFetch = vi.fn() as any;

beforeEach(() => {
  vi.stubGlobal('fetch', mockFetch);
});

afterEach(() => {
  vi.restoreAllMocks();
});

// -------------------------------------------------------
// Tests
// -------------------------------------------------------

describe('DuckDuckGoEngine', () => {
  it('has name "duckduckgo"', () => {
    const engine = new DuckDuckGoEngine();
    expect(engine.name).toBe('duckduckgo');
  });

  it('parses search results from DDG HTML', async () => {
    const html = makeDDGHtml([
      { title: 'Result 1', url: 'https://example.com/1', snippet: 'Snippet 1' },
      { title: 'Result 2', url: 'https://example.com/2', snippet: 'Snippet 2' },
    ]);

    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => html,
    });

    const engine = new DuckDuckGoEngine();
    const results = await engine.search('test query');

    expect(results).toHaveLength(2);
    expect(results[0].title).toBe('Result 1');
    expect(results[0].url).toBe('https://example.com/1');
    expect(results[0].snippet).toBe('Snippet 1');
    expect(results[0].engine).toBe('duckduckgo');
    expect(results[0].rank).toBe(1);

    expect(results[1].rank).toBe(2);
  });

  it('extracts actual URL from DDG uddg redirect', async () => {
    const actualUrl = 'https://real-site.com/article';
    const html = makeDDGHtml([
      { title: 'Redirected', url: actualUrl, snippet: 'Test' },
    ]);

    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => html,
    });

    const engine = new DuckDuckGoEngine();
    const results = await engine.search('redirect test');

    expect(results[0].url).toBe(actualUrl);
  });

  it('respects limit option', async () => {
    const html = makeDDGHtml([
      { title: 'R1', url: 'https://1.com', snippet: 'S1' },
      { title: 'R2', url: 'https://2.com', snippet: 'S2' },
      { title: 'R3', url: 'https://3.com', snippet: 'S3' },
    ]);

    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => html,
    });

    const engine = new DuckDuckGoEngine();
    const results = await engine.search('limit test', { limit: 2 });

    expect(results).toHaveLength(2);
  });

  it('returns empty array on network failure', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    const engine = new DuckDuckGoEngine();
    const results = await engine.search('fail query');

    expect(results).toEqual([]);
  });

  it('returns empty array on non-ok response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 429,
      statusText: 'Too Many Requests',
      text: async () => 'Rate limited',
    });

    const engine = new DuckDuckGoEngine();
    const results = await engine.search('rate limited');

    expect(results).toEqual([]);
  });

  it('sends correct POST request', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => '<html></html>',
    });

    const engine = new DuckDuckGoEngine();
    await engine.search('hello world');

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe('https://html.duckduckgo.com/html/');
    expect(options.method).toBe('POST');
    expect(options.headers['Content-Type']).toBe('application/x-www-form-urlencoded');
    expect(options.body).toContain('q=hello+world');
  });

  it('returns empty array for HTML with no results', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => '<html><body>No results here</body></html>',
    });

    const engine = new DuckDuckGoEngine();
    const results = await engine.search('no results');

    expect(results).toEqual([]);
  });

  it('decodes HTML entities in titles and snippets', async () => {
    const html = makeDDGHtml([
      {
        title: 'A &amp; B &lt; C',
        url: 'https://entities.com',
        snippet: 'Quote: &quot;hello&quot; &amp; &#39;world&#39;',
      },
    ]);

    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => html,
    });

    const engine = new DuckDuckGoEngine();
    const results = await engine.search('entities test');

    expect(results[0].title).toBe('A & B < C');
    expect(results[0].snippet).toBe('Quote: "hello" & \'world\'');
  });

  it('strips HTML tags from titles and snippets', async () => {
    const html = makeDDGHtml([
      {
        title: '<b>Bold</b> title',
        url: 'https://tags.com',
        snippet: '<em>Italic</em> <strong>snippet</strong>',
      },
    ]);

    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => html,
    });

    const engine = new DuckDuckGoEngine();
    const results = await engine.search('tags test');

    expect(results[0].title).toBe('Bold title');
    expect(results[0].snippet).toBe('Italic snippet');
  });
});
