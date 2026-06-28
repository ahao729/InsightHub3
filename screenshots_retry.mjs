import { chromium } from 'playwright';
import { mkdirSync } from 'fs';

const BASE = 'http://127.0.0.1:8080';
const OUT = '/Users/cyqsz/Documents/InsightHub3/screenshots';

mkdirSync(OUT, { recursive: true });

/** Timeout race helper */
function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`⏱ ${label} timed out after ${ms}ms`)), ms)
    ),
  ]);
}

// Pages whose screenshots are still stale (329K from first run)
const pages = [
  { path: '/solutions.html',                name: 'solutions' },
  { path: '/package-startup-intel.html',    name: 'package-startup-intel' },
  { path: '/package-ai-geo.html',           name: 'package-ai-geo' },
  { path: '/package-enterprise-risk.html',  name: 'package-enterprise-risk' },
  { path: '/package-finance-macro.html',    name: 'package-finance-macro' },
  { path: '/package-patent-tech.html',      name: 'package-patent-tech' },
  { path: '/mcp-guide.html',               name: 'mcp-guide' },
  { path: '/status.html',                   name: 'status' },
  { path: '/terms.html',                    name: 'terms' },
  { path: '/privacy.html',                  name: 'privacy' },
];

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });

// ── Block ALL external requests ──
// Only allow requests to our local server
await context.route('**/*', (route) => {
  const url = route.request().url();
  if (url.startsWith(BASE) || url.startsWith('data:')) {
    return route.continue();
  }
  // Block everything else (fonts, CDNs, analytics, images from external hosts)
  return route.abort();
});

let success = 0;
let failed = 0;

for (const { path, name } of pages) {
  const page = await context.newPage();
  let done = false;

  try {
    // Use 'commit' to avoid waiting for external resources at all
    await withTimeout(
      page.goto(BASE + path, { waitUntil: 'commit', timeout: 10000 }),
      10000,
      'goto'
    );
    // Wait for internal content to render
    await page.waitForTimeout(2500);
    // Screenshot
    await withTimeout(
      page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true, timeout: 10000 }),
      10000,
      'screenshot'
    );
    console.log(`✓ ${name}`);
    success++;
    done = true;
  } catch (e) {
    // Retry once
    try {
      await page.close().catch(() => {});
      const retry = await context.newPage();
      await withTimeout(
        retry.goto(BASE + path, { waitUntil: 'commit', timeout: 15000 }),
        15000,
        'goto-retry'
      );
      await retry.waitForTimeout(3000);
      await withTimeout(
        retry.screenshot({ path: `${OUT}/${name}.png`, fullPage: true, timeout: 10000 }),
        10000,
        'screenshot-retry'
      );
      console.log(`✓ ${name} (retry)`);
      success++;
      done = true;
      await retry.close().catch(() => {});
    } catch (e2) {
      console.log(`✗ ${name}: ${e2.message}`);
      failed++;
    }
  }

  if (!done) {
    try { await page.close(); } catch (_) {}
  } else {
    await page.close().catch(() => {});
  }
}

await browser.close();
console.log(`\nDone — ${success} succeeded, ${failed} failed`);
