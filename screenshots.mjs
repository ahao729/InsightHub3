import { chromium } from 'playwright';
const BASE = 'http://127.0.0.1:8089';

const pages = [
  { path: '/insighthub-prototype/index.html',           name: 'prototype-home' },
  { path: '/insighthub-prototype/dashboard.html',       name: 'prototype-dashboard' },
  { path: '/insighthub-prototype/report-generator.html',name: 'prototype-generator' },
  { path: '/insighthub-prototype/pricing.html',         name: 'prototype-pricing' },
  { path: '/index.html',                                name: 'landing-home' },
  { path: '/report-overview.html',                      name: 'report-overview' },
  { path: '/report-generator.html',                     name: 'report-generator' },
  { path: '/dist/indicator.html',                       name: 'dist-indicator' },
];

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });

for (const { path, name } of pages) {
  const page = await context.newPage();
  try {
    await page.goto(BASE + path, { waitUntil: 'networkidle', timeout: 15000 });
    // wait for fonts/styles to settle
    await page.waitForTimeout(1000);
    await page.screenshot({ path: `/Users/cyqsz/Documents/InsightHub3/screenshots/${name}.png`, fullPage: true });
    console.log(`✓ ${name}`);
  } catch (e) {
    console.log(`✗ ${name}: ${e.message}`);
  }
  await page.close();
}

await browser.close();
console.log('All done');
