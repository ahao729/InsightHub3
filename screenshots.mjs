import { chromium } from 'playwright';
import { mkdirSync } from 'fs';

const BASE = 'http://127.0.0.1:8080';
const OUT = '/Users/cyqsz/Documents/InsightHub3/screenshots';

mkdirSync(OUT, { recursive: true });

/** Timeout helper: races a promise against a timeout */
function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`⏱ ${label} timed out after ${ms}ms`)), ms)
    ),
  ]);
}

const pages = [
  // ── Landing & auth ──────────────────────────────────────────
  { path: '/',                       name: 'landing-home' },
  { path: '/auth.html',              name: 'auth' },
  { path: '/dashboard.html',         name: 'dashboard' },
  { path: '/admin.html',             name: 'admin' },

  // ── Marketplace & discovery ─────────────────────────────────
  { path: '/marketplace.html',       name: 'marketplace' },
  { path: '/pricing.html',           name: 'pricing' },
  { path: '/solutions.html',         name: 'solutions' },
  { path: '/checkout.html',          name: 'checkout' },

  // ── Data packages ──────────────────────────────────────────
  { path: '/package-startup-intel.html',     name: 'package-startup-intel' },
  { path: '/package-ai-geo.html',            name: 'package-ai-geo' },
  { path: '/package-enterprise-risk.html',    name: 'package-enterprise-risk' },
  { path: '/package-finance-macro.html',      name: 'package-finance-macro' },
  { path: '/package-patent-tech.html',        name: 'package-patent-tech' },
  { path: '/package-policy-bidding.html',     name: 'package-policy-bidding' },
  { path: '/package-web3-crypto.html',        name: 'package-web3-crypto' },
  { path: '/package-education.html',          name: 'package-education' },

  // ── Tools & docs ───────────────────────────────────────────
  { path: '/report-generator.html',  name: 'report-generator' },
  { path: '/api-docs.html',          name: 'api-docs' },
  { path: '/mcp-guide.html',         name: 'mcp-guide' },
  { path: '/status.html',            name: 'status' },

  // ── Legal / info ───────────────────────────────────────────
  { path: '/terms.html',             name: 'terms' },
  { path: '/privacy.html',           name: 'privacy' },
];

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });

// ── Block external fonts & CDN resources that slow down screenshots ──
// Font files – screenshot waits for fonts to load, so block them
await context.route(/\.(woff2?|ttf|eot)(\?|$)/i, (route) => route.abort());
// Tabler Icons CSS from jsDelivr
await context.route(/cdn\.jsdelivr\.net\/.*tabler/i, (route) => route.abort());
// Google Fonts CSS
await context.route(/fonts\.googleapis\.com/, (route) => route.abort());

let success = 0;
let failed = 0;

for (const { path, name } of pages) {
  const page = await context.newPage();
  let ok = false;

  try {
    await withTimeout(
      page.goto(BASE + path, { waitUntil: 'domcontentloaded', timeout: 15000 }),
      15000, 'goto'
    );
    await page.waitForTimeout(1500);
    await withTimeout(
      page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true }),
      15000, 'screenshot'
    );
    console.log(`✓ ${name}`);
    success++;
    ok = true;
  } catch (e) {
    // Retry once with more permissive settings
    try {
      await page.close().catch(() => {});
      const retryPage = await context.newPage();
      await withTimeout(
        retryPage.goto(BASE + path, { waitUntil: 'commit', timeout: 20000 }),
        20000, 'goto-retry'
      );
      await retryPage.waitForTimeout(2000);
      await withTimeout(
        retryPage.screenshot({ path: `${OUT}/${name}.png`, fullPage: true, timeout: 15000 }),
        15000, 'screenshot-retry'
      );
      console.log(`✓ ${name} (retry)`);
      success++;
      ok = true;
      await retryPage.close().catch(() => {});
    } catch (e2) {
      console.log(`✗ ${name}: ${e2.message}`);
      failed++;
    }
  }

  if (!ok) {
    try { await page.close(); } catch (_) {}
  } else {
    await page.close().catch(() => {});
  }
}

await browser.close();
console.log(`\nDone — ${success} succeeded, ${failed} failed`);
