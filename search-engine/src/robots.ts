// ============================================================
// robots.txt — Fetch, parse, and enforce robots.txt rules
// ============================================================

export interface RobotsConfig {
  /** User agent string to check rules against (default: '*' for all agents) */
  userAgent: string;
  /** Timeout for fetching robots.txt in ms (default: 5000) */
  fetchTimeoutMs: number;
  /** Max age of cached robots.txt in ms (default: 1 hour) */
  cacheTtlMs: number;
}

interface RobotsEntry {
  allow: string[];
  disallow: string[];
  crawlDelay: number | null;
  fetchedAt: number;
}

type RobotsCache = Map<string, RobotsEntry>;

const DEFAULT_USER_AGENT = '*';
const DEFAULT_TIMEOUT = 5000;
const DEFAULT_CACHE_TTL = 3_600_000; // 1 hour

/**
 * Manages robots.txt fetching, parsing, and path-matching.
 */
export class RobotsChecker {
  private config: RobotsConfig;
  private cache: RobotsCache = new Map();

  constructor(config?: Partial<RobotsConfig>) {
    this.config = {
      userAgent: config?.userAgent ?? DEFAULT_USER_AGENT,
      fetchTimeoutMs: config?.fetchTimeoutMs ?? DEFAULT_TIMEOUT,
      cacheTtlMs: config?.cacheTtlMs ?? DEFAULT_CACHE_TTL,
    };
  }

  /**
   * Check if a URL is allowed for crawling.
   * Returns true if allowed, false if disallowed.
   * Returns true on fetch failure (fail-open).
   */
  async isAllowed(url: string): Promise<boolean> {
    try {
      const parsedUrl = new URL(url);
      const origin = parsedUrl.origin;
      const path = parsedUrl.pathname + parsedUrl.search;

      const entry = await this.getRobots(origin);
      if (!entry) {
        return true; // No robots.txt = everything allowed
      }

      // Check disallow rules (most specific first)
      const disallowed = entry.disallow.some((pattern) =>
        matchesPath(path, pattern)
      );

      if (disallowed) {
        return false;
      }

      return true;
    } catch {
      return true; // Fail-open on errors
    }
  }

  /**
   * Get the crawl-delay for a given URL, if specified.
   * Returns null if no crawl-delay is set.
   */
  async getCrawlDelay(url: string): Promise<number | null> {
    try {
      const parsedUrl = new URL(url);
      const origin = parsedUrl.origin;

      const entry = await this.getRobots(origin);
      return entry?.crawlDelay ?? null;
    } catch {
      return null;
    }
  }

  /**
   * Manually clear the cache (useful in tests).
   */
  clearCache(origin?: string): void {
    if (origin) {
      this.cache.delete(origin);
    } else {
      this.cache.clear();
    }
  }

  private async getRobots(origin: string): Promise<RobotsEntry | null> {
    const cached = this.cache.get(origin);
    if (cached && Date.now() - cached.fetchedAt < this.config.cacheTtlMs) {
      return cached;
    }

    const entry = await this.fetchAndParse(origin);
    if (entry) {
      this.cache.set(origin, entry);
    }
    return entry;
  }

  private async fetchAndParse(origin: string): Promise<RobotsEntry | null> {
    try {
      const controller = new AbortController();
      const timer = setTimeout(
        () => controller.abort(),
        this.config.fetchTimeoutMs
      );

      const res = await fetch(`${origin}/robots.txt`, {
        signal: controller.signal,
        headers: { 'User-Agent': this.config.userAgent },
      });
      clearTimeout(timer);

      if (!res.ok) {
        return null;
      }

      const text = await res.text();
      return parseRobotsTxt(text, this.config.userAgent);
    } catch {
      return null; // Fail-open
    }
  }
}

/**
 * Parse robots.txt content into an entry.
 */
export function parseRobotsTxt(
  text: string,
  userAgent: string
): RobotsEntry {
  const lines = text.split(/\r?\n/);
  const result: RobotsEntry = {
    allow: [],
    disallow: [],
    crawlDelay: null,
    fetchedAt: Date.now(),
  };

  let relevantSection = false;
  let seenAnySection = false;

  for (const rawLine of lines) {
    const line = rawLine.split('#')[0].trim(); // Strip comments
    if (!line) continue;

    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;

    const key = line.slice(0, colonIdx).trim().toLowerCase();
    const value = line.slice(colonIdx + 1).trim();

    if (key === 'user-agent') {
      // Start a new section
      if (relevantSection) {
        // If we were in a relevant section and hit a new User-agent, stop
        // (only use rules from the last matching section)
      }
      seenAnySection = true;
      relevantSection =
        value === '*' ||
        userAgent.toLowerCase().startsWith(value.toLowerCase());
    } else if (key === 'disallow' && relevantSection && value) {
      result.disallow.push(value);
    } else if (key === 'allow' && relevantSection && value) {
      result.allow.push(value);
    } else if (key === 'crawl-delay' && relevantSection) {
      const delay = parseFloat(value);
      if (!isNaN(delay)) {
        result.crawlDelay = delay;
      }
    }
  }

  // If no sections matched at all, use the wildcard section
  if (!seenAnySection) {
    return {
      allow: [],
      disallow: [],
      crawlDelay: null,
      fetchedAt: Date.now(),
    };
  }

  return result;
}

/**
 * Check if a path matches a robots.txt pattern.
 */
function matchesPath(path: string, pattern: string): boolean {
  if (pattern === '/') return true;
  // Simple prefix matching (standard robots.txt behavior)
  const normalizedPattern = pattern.endsWith('/') ? pattern : pattern;
  const normalizedPath = path.startsWith('/') ? path : '/' + path;

  if (normalizedPattern.endsWith('*')) {
    // Wildcard suffix
    return normalizedPath.startsWith(normalizedPattern.slice(0, -1));
  }

  return normalizedPath.startsWith(normalizedPattern);
}
