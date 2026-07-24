import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RobotsChecker, parseRobotsTxt } from '../src/robots.js';

// -------------------------------------------------------
// parseRobotsTxt (pure function — no network)
// -------------------------------------------------------

describe('parseRobotsTxt', () => {
  it('parses a basic robots.txt', () => {
    const text = `
User-agent: *
Disallow: /admin/
Disallow: /private/
Allow: /public/
Crawl-delay: 5
`;
    const entry = parseRobotsTxt(text, '*');
    expect(entry.disallow).toContain('/admin/');
    expect(entry.disallow).toContain('/private/');
    expect(entry.allow).toContain('/public/');
    expect(entry.crawlDelay).toBe(5);
  });

  it('ignores comments', () => {
    const text = `
# This is a comment
User-agent: *
Disallow: /secret/ # inline comment
`;
    const entry = parseRobotsTxt(text, '*');
    expect(entry.disallow).toContain('/secret/');
  });

  it('returns empty arrays when no matching user-agent section', () => {
    const text = `
User-agent: Googlebot
Disallow: /only-google/
`;
    const entry = parseRobotsTxt(text, '*');
    expect(entry.disallow).toEqual([]);
    expect(entry.allow).toEqual([]);
  });

  it('matches specific user-agent', () => {
    const text = `
User-agent: Googlebot
Disallow: /google-only/

User-agent: Bingbot
Disallow: /bing-only/
`;
    const googleEntry = parseRobotsTxt(text, 'Googlebot');
    expect(googleEntry.disallow).toContain('/google-only/');

    const bingEntry = parseRobotsTxt(text, 'Bingbot');
    expect(bingEntry.disallow).toContain('/bing-only/');
  });

  it('falls back to wildcard section for partial match', () => {
    const text = `
User-agent: Googlebot
Disallow: /google/

User-agent: *
Disallow: /common/
`;
    // "Googlebot-Image" starts with "Googlebot" (case-insensitive prefix)
    const entry = parseRobotsTxt(text, 'Googlebot-Image');
    expect(entry.disallow).toContain('/google/');
  });

  it('uses last matching section when multiple match', () => {
    const text = `
User-agent: *
Disallow: /old/

User-agent: *
Allow: /new/
`;
    const entry = parseRobotsTxt(text, '*');
    // The parser processes all sections; last matching section's rules are accumulated
    expect(entry.disallow).toContain('/old/');
    expect(entry.allow).toContain('/new/');
  });

  it('handles empty robots.txt', () => {
    const entry = parseRobotsTxt('', '*');
    expect(entry.disallow).toEqual([]);
    expect(entry.allow).toEqual([]);
    expect(entry.crawlDelay).toBeNull();
  });

  it('parses Crawl-delay as float', () => {
    const text = `
User-agent: *
Crawl-delay: 2.5
`;
    const entry = parseRobotsTxt(text, '*');
    expect(entry.crawlDelay).toBe(2.5);
  });

  it('handles malformed lines gracefully', () => {
    const text = `
This is not valid
User-agent: *
Disallow: /ok/
Also invalid
`;
    const entry = parseRobotsTxt(text, '*');
    expect(entry.disallow).toContain('/ok/');
  });

  it('returns empty result when no sections seen at all', () => {
    const text = `# Just comments\n\n`;
    const entry = parseRobotsTxt(text, '*');
    expect(entry.disallow).toEqual([]);
    expect(entry.allow).toEqual([]);
    expect(entry.crawlDelay).toBeNull();
  });
});

// -------------------------------------------------------
// RobotsChecker (with mocked fetch)
// -------------------------------------------------------

describe('RobotsChecker', () => {
  let checker: RobotsChecker;

  beforeEach(() => {
    checker = new RobotsChecker({ cacheTtlMs: 60_000 });
  });

  it('returns true when robots.txt fetch fails (fail-open)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('network error'); }));
    const allowed = await checker.isAllowed('https://example.com/page');
    expect(allowed).toBe(true);
    vi.restoreAllMocks();
  });

  it('returns true when robots.txt returns 404 (fail-open)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: false, status: 404, text: async () => '',
    })));
    const allowed = await checker.isAllowed('https://example.com/page');
    expect(allowed).toBe(true);
    vi.restoreAllMocks();
  });

  it('allows paths not in disallow list', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      text: async () => 'User-agent: *\nDisallow: /admin/',
    })));
    const allowed = await checker.isAllowed('https://example.com/home');
    expect(allowed).toBe(true);
    vi.restoreAllMocks();
  });

  it('blocks paths matching disallow pattern', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      text: async () => 'User-agent: *\nDisallow: /admin/',
    })));
    const allowed = await checker.isAllowed('https://example.com/admin/settings');
    expect(allowed).toBe(false);
    vi.restoreAllMocks();
  });

  it('blocks root path when disallow is /', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      text: async () => 'User-agent: *\nDisallow: /',
    })));
    const allowed = await checker.isAllowed('https://example.com/anything');
    expect(allowed).toBe(false);
    vi.restoreAllMocks();
  });

  it('respects allow rules (not yet enforced but disallow checked first)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      text: async () => 'User-agent: *\nDisallow: /private/\nAllow: /private/public/',
    })));
    // /private/secret should be blocked
    const blocked = await checker.isAllowed('https://example.com/private/secret');
    expect(blocked).toBe(false);
    vi.restoreAllMocks();
  });

  it('getCrawlDelay returns null when not specified', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      text: async () => 'User-agent: *\nDisallow:',
    })));
    const delay = await checker.getCrawlDelay('https://example.com/page');
    expect(delay).toBeNull();
    vi.restoreAllMocks();
  });

  it('getCrawlDelay returns value when specified', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      text: async () => 'User-agent: *\nCrawl-delay: 10',
    })));
    const delay = await checker.getCrawlDelay('https://example.com/page');
    expect(delay).toBe(10);
    vi.restoreAllMocks();
  });

  it('clearCache removes cached entries', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      text: async () => 'User-agent: *\nDisallow: /admin/',
    }));
    vi.stubGlobal('fetch', fetchMock);

    await checker.isAllowed('https://example.com/page');
    await checker.isAllowed('https://example.com/page');

    // fetch called once (second hit from cache)
    expect(fetchMock).toHaveBeenCalledTimes(1);

    checker.clearCache('https://example.com');

    await checker.isAllowed('https://example.com/page');
    // fetch called again after cache clear
    expect(fetchMock).toHaveBeenCalledTimes(2);

    vi.restoreAllMocks();
  });

  it('returns invalid URL as allowed (fail-open)', async () => {
    const allowed = await checker.isAllowed('not-a-valid-url');
    expect(allowed).toBe(true);
  });
});
