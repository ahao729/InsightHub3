import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SogouEngine } from '../../src/engines/sogou.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const FIXTURE_HTML = readFileSync(
  join(__dirname, 'sogou.html'),
  'utf-8'
);

describe('SogouEngine', () => {
  let engine: SogouEngine;

  beforeEach(() => {
    engine = new SogouEngine({ timeout: 5000 });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('has correct name', () => {
    expect(engine.name).toBe('sogou');
  });

  it('parses results from HTML fixture', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      text: async () => FIXTURE_HTML,
    })));

    const results = await engine.search('测试');
    expect(results.length).toBeGreaterThan(0);
    expect(results.length).toBeLessThanOrEqual(10);

    for (const r of results) {
      expect(r.title).toBeTruthy();
      expect(r.url).toBeTruthy();
      expect(r.engine).toBe('sogou');
      expect(typeof r.rank).toBe('number');
    }
  });

  it('extracts titles from h3 > a elements', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      text: async () => FIXTURE_HTML,
    })));

    const results = await engine.search('测试');
    const titles = results.map(r => r.title);

    expect(titles.some(t => t.includes('测试结果一'))).toBe(true);
    expect(titles.some(t => t.includes('第二个搜狗搜索结果'))).toBe(true);
    expect(titles.some(t => t.includes('直接链接的搜狗结果'))).toBe(true);
  });

  it('extracts Sogou redirect URLs', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      text: async () => FIXTURE_HTML,
    })));

    const results = await engine.search('测试');
    // First result has hl_url=real_url_1
    const firstResult = results.find(r => r.title.includes('测试结果一'));
    expect(firstResult).toBeDefined();
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
      status: 503,
      statusText: 'Service Unavailable',
      text: async () => '',
    })));

    await expect(engine.search('test')).rejects.toThrow('Sogou returned 503');
  });

  it('throws on timeout', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => {
      const err = new DOMException('The operation was aborted.', 'AbortError');
      throw err;
    }));

    await expect(engine.search('test')).rejects.toThrow('timed out');
  });

  it('returns empty array for no results HTML', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      text: async () => '<html><body>Nothing here</body></html>',
    })));

    const results = await engine.search('xyznonexistent');
    expect(results).toEqual([]);
  });

  it('strips HTML tags from titles', async () => {
    const htmlWithTags = `
    <html><body>
    <div class="vrwrap">
      <h3><a href="https://example.com"><b>Bold</b> <span>title</span></a></h3>
    </div>
    </body></html>`;

    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      text: async () => htmlWithTags,
    })));

    const results = await engine.search('test');
    expect(results.length).toBe(1);
    expect(results[0].title).toBe('Bold title');
    expect(results[0].title).not.toContain('<b>');
  });

  it('close() resolves without error', async () => {
    await expect(engine.close()).resolves.toBeUndefined();
  });
});
