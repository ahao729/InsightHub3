// ============================================================
// Proxy — Proxy configuration for engines and crawler
// ============================================================

export interface ProxyConfig {
  /** Proxy server URL (e.g., 'http://proxy:8080') */
  server: string;
  /** Proxy username (optional) */
  username?: string;
  /** Proxy password (optional) */
  password?: string;
  /** Bypass rules: comma-separated patterns to bypass proxy */
  bypass?: string;
  /** Protocol: http, https, socks5 */
  protocol?: 'http' | 'https' | 'socks5';
}

/**
 * Build a Playwright proxy config object.
 */
export function toPlaywrightProxy(proxy?: ProxyConfig): Record<string, string> | undefined {
  if (!proxy) return undefined;

  const config: Record<string, string> = {
    server: normalizeProxyServer(proxy.server, proxy.protocol),
  };

  if (proxy.username) config.username = proxy.username;
  if (proxy.password) config.password = proxy.password;
  if (proxy.bypass) config.bypass = proxy.bypass;

  return config;
}

/**
 * Build a fetch proxy agent string for use with node-fetch or undici.
 * Returns the proxy URL string.
 */
export function toFetchProxyUrl(proxy?: ProxyConfig): string | undefined {
  if (!proxy) return undefined;
  return normalizeProxyServer(proxy.server, proxy.protocol);
}

/**
 * Build curl-style proxy env vars.
 */
export function toProxyEnv(proxy?: ProxyConfig): Record<string, string> {
  if (!proxy) return {};

  const url = normalizeProxyServer(proxy.server, proxy.protocol);

  return {
    HTTP_PROXY: url,
    HTTPS_PROXY: url,
    http_proxy: url,
    https_proxy: url,
  };
}

/**
 * Check if a hostname should bypass the proxy based on bypass rules.
 */
export function shouldBypassProxy(
  hostname: string,
  bypass?: string
): boolean {
  if (!bypass) return false;

  const rules = bypass.split(',').map((r) => r.trim());
  for (const rule of rules) {
    if (rule === '<local>') {
      // <local> matches localhost, 127.0.0.1, etc.
      if (
        hostname === 'localhost' ||
        hostname === '127.0.0.1' ||
        hostname === '::1'
      ) {
        return true;
      }
    } else if (rule.startsWith('*.')) {
      // Wildcard subdomain: *.example.com
      const suffix = rule.slice(1); // ".example.com"
      if (hostname.endsWith(suffix)) {
        return true;
      }
    } else if (hostname === rule) {
      return true;
    }
  }

  return false;
}

function normalizeProxyServer(server: string, protocol?: string): string {
  // Already has protocol
  if (server.startsWith('http://') || server.startsWith('https://') || server.startsWith('socks5://')) {
    return server;
  }

  const proto = protocol ?? 'http';
  return `${proto}://${server}`;
}
