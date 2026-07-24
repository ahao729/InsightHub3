import { describe, it, expect } from 'vitest';
import {
  generateFingerprint,
  getRequestInterval,
  getRandomViewport,
} from '../src/anti-fingerprint.js';

describe('generateFingerprint', () => {
  it('returns headers object with required fields', () => {
    const fp = generateFingerprint();
    expect(fp.headers).toBeDefined();
    expect(fp.userAgent).toBeDefined();

    // Required browser-like headers
    expect(fp.headers['User-Agent']).toBeTruthy();
    expect(fp.headers['Accept']).toBeTruthy();
    expect(fp.headers['Accept-Language']).toBeTruthy();
    expect(fp.headers['Accept-Encoding']).toBeTruthy();
    expect(fp.headers['Sec-Fetch-Dest']).toBe('document');
    expect(fp.headers['Sec-Fetch-Mode']).toBe('navigate');
    expect(fp.headers['Sec-Ch-Ua']).toBeTruthy();
    expect(fp.headers['Sec-Ch-Ua-Mobile']).toBe('?0');
    expect(fp.headers['Sec-Ch-Ua-Platform']).toBeTruthy();
  });

  it('includes Referer by default', () => {
    const fp = generateFingerprint();
    expect(fp.headers['Referer']).toBeTruthy();
    expect(fp.headers['Referer']).toMatch(/^https?:\/\//);
  });

  it('excludes Referer when includeReferer is false', () => {
    const fp = generateFingerprint({ includeReferer: false });
    expect(fp.headers['Referer']).toBeUndefined();
  });

  it('uses specified userAgent when provided', () => {
    const customUA = 'MyCustomBot/1.0';
    const fp = generateFingerprint({ userAgent: customUA });
    expect(fp.userAgent).toBe(customUA);
    expect(fp.headers['User-Agent']).toBe(customUA);
  });

  it('uses locale-specific Accept-Language for en', () => {
    const fp = generateFingerprint({ locale: 'en' });
    expect(fp.headers['Accept-Language']).toBe('en-US,en;q=0.9');
  });

  it('uses locale-specific Accept-Language for zh', () => {
    const fp = generateFingerprint({ locale: 'zh' });
    expect(fp.headers['Accept-Language']).toBe('zh-CN,zh;q=0.9,en-US;q=0.8,en;q=0.7');
  });

  it('uses locale-specific Accept-Language for ja', () => {
    const fp = generateFingerprint({ locale: 'ja' });
    expect(fp.headers['Accept-Language']).toBe('ja-JP,ja;q=0.9,en-US;q=0.8,en;q=0.7');
  });

  it('generates different fingerprints on successive calls (probabilistic)', () => {
    const userAgents = new Set<string>();
    for (let i = 0; i < 50; i++) {
      userAgents.add(generateFingerprint().userAgent);
    }
    // With 12 user agents, 50 calls should produce at least 2 different ones
    expect(userAgents.size).toBeGreaterThan(1);
  });

  it('Sec-Ch-Ua contains version numbers', () => {
    const fp = generateFingerprint();
    const secChUa = fp.headers['Sec-Ch-Ua'];
    // Should contain at least one 3-digit version number
    expect(secChUa).toMatch(/\d{3}/);
  });
});

describe('getRequestInterval', () => {
  it('returns a number between 500 and 2500', () => {
    for (let i = 0; i < 100; i++) {
      const interval = getRequestInterval();
      expect(interval).toBeGreaterThanOrEqual(500);
      expect(interval).toBeLessThanOrEqual(2499);
    }
  });

  it('returns different values on successive calls (probabilistic)', () => {
    const intervals = new Set<number>();
    for (let i = 0; i < 50; i++) {
      intervals.add(getRequestInterval());
    }
    expect(intervals.size).toBeGreaterThan(1);
  });
});

describe('getRandomViewport', () => {
  it('returns object with width and height', () => {
    const vp = getRandomViewport();
    expect(typeof vp.width).toBe('number');
    expect(typeof vp.height).toBe('number');
    expect(vp.width).toBeGreaterThan(0);
    expect(vp.height).toBeGreaterThan(0);
  });

  it('returns common resolutions', () => {
    const validWidths = [1920, 1366, 1536, 1440, 1280, 2560];
    for (let i = 0; i < 50; i++) {
      const vp = getRandomViewport();
      expect(validWidths).toContain(vp.width);
    }
  });

  it('returns different viewports on successive calls (probabilistic)', () => {
    const viewports = new Set<string>();
    for (let i = 0; i < 50; i++) {
      const vp = getRandomViewport();
      viewports.add(`${vp.width}x${vp.height}`);
    }
    expect(viewports.size).toBeGreaterThan(1);
  });
});
