import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const BASE = 'http://localhost:3000';
const OUT = join(process.cwd(), 'dogfood-screenshots');

mkdirSync(OUT, { recursive: true });

async function shot(page, name, opts = {}) {
  const path = join(OUT, `${name}.png`);
  await page.screenshot({ path, fullPage: opts.fullPage ?? true });
  console.log(`  ✓ ${name}.png`);
}

async function log(page, msg) {
  console.log(`\n📌 ${msg}`);
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();

  // Track console errors
  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', err => consoleErrors.push(err.message));

  try {
    // ========== 1. Home page ==========
    await log(page, 'Navigating to homepage');
    await page.goto(BASE, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(1000);
    await shot(page, '01-homepage');
    console.log(`   Title: ${await page.title()}`);

    // ========== 2. Toggle navigation ==========
    await log(page, 'Testing navigation toggle');
    // Try clicking the nav toggle button
    const toggleBtn = page.locator('[class*="toggle"], [class*="menu"], [class*="hamburger"], button[aria-label*="menu"i], .nav-toggle, [data-testid="nav-toggle"]');
    if (await toggleBtn.first().isVisible().catch(() => false)) {
      await toggleBtn.first().click();
      await page.waitForTimeout(500);
      await shot(page, '02-nav-toggled');
      // Toggle back
      await toggleBtn.first().click();
      await page.waitForTimeout(300);
    } else {
      console.log('   No nav toggle found, skipping');
    }

    // ========== 3. Click first link/article ==========
    await log(page, 'Clicking first link');
    const firstLink = page.locator('a').filter({ hasText: /.+/ }).first();
    if (await firstLink.isVisible().catch(() => false)) {
      const href = await firstLink.getAttribute('href');
      console.log(`   First link: ${href}`);
      await firstLink.click();
      await page.waitForTimeout(1500);
      await shot(page, '03-first-link-page');
      // Go back
      await page.goBack();
      await page.waitForTimeout(500);
    }

    // ========== 4. Mobile viewport ==========
    await log(page, 'Testing mobile viewport (375x812)');
    await page.setViewportSize({ width: 375, height: 812 });
    await page.waitForTimeout(500);
    await shot(page, '04-mobile-homepage');
    
    // ========== 5. Dark mode toggle if available ==========
    await log(page, 'Testing dark/theme toggle');
    const themeBtn = page.locator('[class*="theme"], [class*="dark"], [class*="mode"], button[aria-label*="theme"i], [data-testid="theme-toggle"]');
    if (await themeBtn.first().isVisible().catch(() => false)) {
      await themeBtn.first().click();
      await page.waitForTimeout(500);
      // Switch back to desktop for screenshot
      await page.setViewportSize({ width: 1280, height: 800 });
      await page.waitForTimeout(300);
      await shot(page, '05-theme-toggled');
    } else {
      console.log('   No theme toggle found, skipping');
    }

    // ========== 6. Check all visible links ==========
    await log(page, 'Scanning all links on page');
    const links = await page.locator('a[href]').all();
    const linkUrls = [];
    for (const link of links) {
      const href = await link.getAttribute('href');
      const text = (await link.textContent())?.trim().slice(0, 60) || '(no text)';
      if (href && !href.startsWith('#') && !href.startsWith('javascript:')) {
        linkUrls.push({ text, href });
      }
    }
    console.log(`   Found ${linkUrls.length} unique links`);
    
    // Visit internal links
    let visitedCount = 0;
    for (const { text, href } of linkUrls.slice(0, 10)) {
      if (href.startsWith('http') && !href.includes('localhost')) continue;
      try {
        const fullUrl = href.startsWith('http') ? href : new URL(href, BASE).toString();
        const resp = await page.goto(fullUrl, { waitUntil: 'domcontentloaded', timeout: 10000 });
        if (resp && resp.ok()) {
          visitedCount++;
          console.log(`   ✓ ${href} (${resp.status()})`);
        }
      } catch (e) {
        console.log(`   ✗ ${href} (error: ${e.message.slice(0, 50)})`);
      }
    }
    console.log(`   Successfully visited ${visitedCount} internal links`);

    // ========== 7. Final check - back to home ==========
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.waitForTimeout(500);
    await shot(page, '06-final-homepage');

  } finally {
    // Report console errors
    if (consoleErrors.length > 0) {
      console.log('\n⚠️  Console errors detected:');
      for (const err of new Set(consoleErrors)) {
        console.log(`   • ${err.slice(0, 200)}`);
      }
    } else {
      console.log('\n✅ No console errors detected');
    }

    await browser.close();
  }

  console.log('\n✅ Dogfood complete!');
}

main().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});
