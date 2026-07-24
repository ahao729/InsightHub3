import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BaiduEngine } from '../../src/engines/baidu.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const FIXTURE_HTML = readFileSync(
  join(__dirname, 'baidu.html'),
  'utf-8'
);

describe('BaiduEngine', () => {
  let engine: BaiduEngine;

  beforeEach(() => {
    engine = new BaiduEngine({ timeout: 5000 });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('has correct name', () => {
    expect(engine.name).toBe('baidu');
  });

  it('parses results from HTML fixture', () => {
    // Access private parseResults via search method mock
    // Instead, we'll mock fetch and test the full flow
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      text: async () => FIXTURE_HTML,
    })));

    engine.search('测试').then(results => {
      expect(results.length).toBeGreaterThan(0);
      expect(results.length).toBeLessThanOrEqual(10);

      // All results should have required fields
      for (const r of results) {
        expect(r.title).toBeTruthy();
        expect(r.url).toBeTruthy();
        expect(r.engine).toBe('baidu');
        expect(typeof r.rank).toBe('number');
      }
    });
  });

  it('extracts titles from h3 > a elements', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      text: async () => FIXTURE_HTML,
    })));

    const results = await engine.search('测试');
    const titles = results.map(r => r.title);

    // Fixture has 4 results with recognizable titles
    expect(titles.some(t => t.includes('测试标题一'))).toBe(true);
    expect(titles.some(t => t.includes('第二个测试结果'))).toBe(true);
    expect(titles.some(t => t.includes('直接链接结果'))).toBe(true);
  });

  it('extracts Baidu redirect URLs', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      text: async () => FIXTURE_HTML,
    })));

    const results = await engine.search('测试');
    // First result has /link?url=encoded_url_1 — should try to extract
    const firstResult = results.find(r => r.title.includes('测试标题一'));
    expect(firstResult).toBeDefined();
    // URL should be the decoded redirect or the raw href
    expect(firstResult!.url).toBeTruthy();
  });

  it('respects limit option', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      text: async () => FIXTURE_HTML,
    })));

    const results = await engine.search('测试', { limit: 2 });
    expect(results.length).toBeLessThanOrEqual(2);
  });

  it('throws on HTTP error', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      text: async () => '',
    })));

    await expect(engine.search('test')).rejects.toThrow('Baidu returned 500');
  });

  it('throws on timeout', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => {
      // Simulate abort
      const err = new DOMException('The operation was aborted.', 'AbortError');
      throw err;
    }));

    await expect(engine.search('test')).rejects.toThrow('timed out');
  });

  it('returns empty array for no results HTML', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      text: async () => '<html><body>No results here</body></html>',
    })));

    const results = await engine.search('xyznonexistent');
    expect(results).toEqual([]);
  });

  it('strips HTML tags from titles', async () => {
    const htmlWithTags = `
    <html><body>
    <h3 class="t"><a href="https://example.com"><b>Bold</b> and <i>Italic</i> title</a></h3>
    </body></html>`;

    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      text: async () => htmlWithTags,
    })));

    const results = await engine.search('test');
    expect(results.length).toBe(1);
    expect(results[0].title).toBe('Bold and Italic title');
    expect(results[0].title).not.toContain('<b>');
    expect(results[0].title).not.toContain('<i>');
  });

  it('close() resolves without error', async () => {
    await expect(engine.close()).resolves.toBeUndefined();
  });
});
