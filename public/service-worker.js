/* ========================================
   InsightHub Data — Service Worker v1
   离线缓存策略：
   - 静态资源（css/js/svg/ico/font）→ 缓存优先
   - HTML 页面 → 网络优先，回退缓存
   - 外部 CDN → 网络优先
   ======================================== */

const CACHE_NAME = 'insighthub-v1';
const STATIC_CACHE = 'insighthub-static-v1';

/** 预缓存的核心静态资源（相对于根路径） */
const PRECACHE_STATIC = [
  '/',
  '/assets/tokens.css',
  '/assets/stub-runtime.js',
  '/manifest.json',
  '/favicon.svg',
  '/icon.svg',
  '/icon-192.svg',
  '/icon-512.svg',
  '/logo.svg',
];

/** 安装阶段：预缓存核心静态资源 */
self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(STATIC_CACHE);
      await cache.addAll(PRECACHE_STATIC);
      await self.skipWaiting();
    })()
  );
});

/** 激活阶段：清理旧缓存 */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => k !== STATIC_CACHE && k !== CACHE_NAME)
          .map((k) => caches.delete(k))
      );
      await self.clients.claim();
    })()
  );
});

/** 判断请求是否为导航（HTML 页面） */
function isNavigationRequest(request) {
  return request.mode === 'navigate';
}

/** 判断是否为同源静态资源 */
function isStaticAsset(url) {
  const { pathname, origin } = url;
  if (origin !== self.location.origin) return false;
  // 样式 / 脚本 / 字体 / 图片 / SVG / JSON (manifest)
  return /\.(css|js|json|svg|png|jpg|jpeg|gif|webp|woff2?|ttf|ico)$/i.test(pathname);
}

/** 网络优先，超时回退缓存 */
async function networkFirst(request, timeoutMs = 3000) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const response = await fetch(request, { signal: controller.signal });
    clearTimeout(timer);
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    // 最后回退到离线页（当前首页作为离线 fallback）
    return caches.match('/');
  }
}

/** 缓存优先，回退网络 */
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    // 对于静态资源，如果网络也失败则返回空
    return new Response('', { status: 408, statusText: 'Offline' });
  }
}

/** 拦截请求 */
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 只处理 GET 请求
  if (request.method !== 'GET') return;

  // 忽略非 http(s) 和不必要的第三方请求
  if (!url.protocol.startsWith('http')) return;

  // 跳过 chrome-extension 等
  if (url.origin !== self.location.origin) {
    // 允许 tabler-icons CDN 走网络优先
    if (url.hostname.includes('tabler-icons') || url.hostname.includes('jsdelivr.net')) {
      event.respondWith(networkFirst(request));
    }
    return;
  }

  // 导航请求（HTML 页面）→ 网络优先
  if (isNavigationRequest(request)) {
    event.respondWith(networkFirst(request));
    return;
  }

  // 静态资源 → 缓存优先
  if (isStaticAsset(url)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // 其他同源请求（API 等）→ 网络优先
  event.respondWith(networkFirst(request));
});
