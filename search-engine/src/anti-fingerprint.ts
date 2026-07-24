// ============================================================
// Anti-Fingerprint — Randomize browser-like request characteristics
// ============================================================

const USER_AGENTS = [
  // Chrome on macOS
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  // Chrome on Windows
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
  // Firefox on macOS
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:121.0) Gecko/20100101 Firefox/121.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:120.0) Gecko/20100101 Firefox/120.0',
  // Firefox on Windows
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
  // Edge on Windows
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0',
  // Safari on macOS
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15',
];

const ACCEPT_LANGUAGES = [
  'en-US,en;q=0.9',
  'en-US,en;q=0.9,zh-CN;q=0.8,zh;q=0.7',
  'zh-CN,zh;q=0.9,en-US;q=0.8,en;q=0.7',
  'zh-CN,zh;q=0.9',
  'en-GB,en;q=0.9',
  'ja-JP,ja;q=0.9,en-US;q=0.8,en;q=0.7',
];

const REFERERS = [
  'https://www.google.com/',
  'https://www.bing.com/',
  'https://duckduckgo.com/',
  'https://www.baidu.com/',
];

export interface FingerprintOptions {
  /** Include Referer header (default: true) */
  includeReferer?: boolean;
  /** Override User-Agent (skip randomization) */
  userAgent?: string;
  /** Prefer specific locale, used for Accept-Language selection */
  locale?: 'en' | 'zh' | 'ja';
}

export interface RequestFingerprint {
  headers: Record<string, string>;
  userAgent: string;
}

/**
 * Generate a randomized set of request headers that look like a real browser.
 */
export function generateFingerprint(
  options?: FingerprintOptions
): RequestFingerprint {
  const ua = options?.userAgent ?? pickRandom(USER_AGENTS);
  const lang = options?.locale
    ? pickLocaleLanguage(options.locale)
    : pickRandom(ACCEPT_LANGUAGES);

  const headers: Record<string, string> = {
    'User-Agent': ua,
    Accept:
      'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': lang,
    'Accept-Encoding': 'gzip, deflate, br',
    'Cache-Control': 'no-cache',
    Pragma: 'no-cache',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-User': '?1',
    'Upgrade-Insecure-Requests': '1',
    'Sec-Ch-Ua': `"Not_A Brand";v="8", "Chromium";v="${randomVersion(118, 122)}", "Google Chrome";v="${randomVersion(118, 122)}"`,
    'Sec-Ch-Ua-Mobile': '?0',
    'Sec-Ch-Ua-Platform': pickRandom(['"macOS"', '"Windows"', '"Linux"']),
  };

  if (options?.includeReferer !== false) {
    headers['Referer'] = pickRandom(REFERERS);
  }

  return { headers, userAgent: ua };
}

/**
 * Return the wait time in ms before a next request should be sent.
 * Adds randomized jitter to avoid detectable patterns.
 */
export function getRequestInterval(): number {
  // Random interval between 500ms and 2500ms
  return 500 + Math.floor(Math.random() * 2000);
}

/**
 * Generate a random viewport size (common resolutions).
 */
export function getRandomViewport(): { width: number; height: number } {
  const viewports = [
    { width: 1920, height: 1080 },
    { width: 1366, height: 768 },
    { width: 1536, height: 864 },
    { width: 1440, height: 900 },
    { width: 1280, height: 720 },
    { width: 2560, height: 1440 },
    { width: 1280, height: 800 },
  ];
  return pickRandom(viewports);
}

function pickLocaleLanguage(locale: 'en' | 'zh' | 'ja'): string {
  const map: Record<string, string> = {
    en: 'en-US,en;q=0.9',
    zh: 'zh-CN,zh;q=0.9,en-US;q=0.8,en;q=0.7',
    ja: 'ja-JP,ja;q=0.9,en-US;q=0.8,en;q=0.7',
  };
  return map[locale] ?? pickRandom(ACCEPT_LANGUAGES);
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomVersion(min: number, max: number): string {
  return String(min + Math.floor(Math.random() * (max - min + 1)));
}
