import { chromium } from 'playwright';
import { writeFileSync, mkdirSync, existsSync } from 'fs';

const MOCK_DASHBOARD_DATA = {
  plan: {
    name: '专业版',
    description: '适合成长中的分析团队，每月 50 万次 API 调用',
    renewDate: '2026-07-28 续费',
  },
  metrics: {
    apiCalls: 28453,
    apiLimit: 500000,
    reports: 42,
    reportLimit: 100,
    activeMonitors: 8,
    monitorLimit: 20,
    alerts: 3,
  },
  trend: {
    labels: ['6/1', '6/2', '6/3', '6/4', '6/5', '6/6', '6/7'],
    values: [1200, 1900, 800, 1600, 2100, 1800, 2400],
  },
  recentReports: [
    {
      title: '月度销售分析报告',
      pkg: '电商数据集',
      date: '2026-06-25',
      tag: '新',
      icon: 'ri-green',
      iconName: 'ti-file-text',
    },
    {
      title: '用户行为漏斗分析',
      pkg: '用户行为数据集',
      date: '2026-06-24',
      tag: '',
      icon: 'ri-blue',
      iconName: 'ti-chart-bar',
    },
    {
      title: '库存异常检测报告',
      pkg: '供应链数据集',
      date: '2026-06-23',
      tag: '',
      icon: 'ri-amber',
      iconName: 'ti-alert-triangle',
    },
  ],
  monitors: [
    {
      name: '销售数据质量监控',
      pkg: '电商数据集',
      date: '每小时',
      status: 'ms-active',
      pill: '健康',
    },
    {
      name: '用户注册异常检测',
      pkg: '用户行为数据集',
      date: '每 5 分钟',
      status: 'ms-alert',
      pill: '12 条告警',
      pillCls: 'alert-pill',
    },
    {
      name: 'API 可用性监控',
      pkg: '系统监控',
      date: '每分钟',
      status: 'ms-pause',
      pill: '已暂停',
    },
  ],
  subscribedPackages: [
    {
      name: '电商销售数据集',
      desc: '120 万条记录 · 每日更新',
      color: 'ri-green',
      icon: 'ti-package',
    },
  ],
  apiKeys: [
    { env: 'production', key: 'ihk_prod_8a7f3b2c9d1e4f5a', used: 68, limit: 100 },
    { env: 'development', key: 'ihk_dev_3b2c9d1e4f5a6a7b', used: 23, limit: 50 },
  ],
  recentLogs: [
    { api: 'GET /v1/data/ecommerce/stats', status: '200', time: '2 分钟前', ts: '2026-06-28 14:32', key: '生产' },
    { api: 'POST /v1/reports/generate', status: '200', time: '15 分钟前', ts: '2026-06-28 14:19', key: '生产' },
    { api: 'GET /v1/auth/me', status: '200', time: '1 小时前', ts: '2026-06-28 13:46', key: '开发' },
    { api: 'GET /v1/data/user/profile', status: '429', time: '2 小时前', ts: '2026-06-28 12:30', key: '开发' },
  ],
};

async function testDashboard() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  // Ensure screenshots directory exists
  if (!existsSync('screenshots')) {
    mkdirSync('screenshots', { recursive: true });
  }

  // Set mock auth token before any page script runs
  await page.addInitScript(() => {
    localStorage.setItem('ih_token', 'playwright_mock_token_for_testing');
  });

  // Intercept dashboard stats API — return mock data so all sections render
  await page.route('**/dashboard/stats', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: MOCK_DASHBOARD_DATA }),
    });
  });

  // Listen for console errors
  const consoleErrors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });

  let passed = 0;
  let failed = 0;

  function check(name, condition, detail = '') {
    if (condition) {
      console.log(`  ✅ ${name}`);
      passed++;
    } else {
      console.log(`  ❌ ${name} ${detail}`);
      failed++;
    }
  }

  // 1. Navigate to dashboard
  console.log('\n📄 Loading dashboard...');
  await page.goto('http://localhost:5173/dashboard.html', { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'screenshots/dashboard-01-load.png', fullPage: true });
  console.log('   Screenshot saved: screenshots/dashboard-01-load.png');

  // 2. Check page title
  const title = await page.title();
  check('Page has title', title.length > 0, `title="${title}"`);
  check('Title is correct', title.includes('InsightHub') || title.includes('工作台'), `title="${title}"`);

  // 3. Check sidebar logo/brand
  const logo = await page.$('.sb-logo');
  check('Sidebar logo exists', !!logo);

  const logoText = await page.$('.sb-logo-text');
  if (logoText) check('Logo text present', (await logoText.textContent()).trim().length > 0);

  // 4. Check user info (static placeholder — API does not populate this)
  const userName = await page.$('.sb-name');
  if (userName) check('User name element exists', (await userName.textContent()).trim().length > 0);

  // 5. Find navigation items
  const navItems = await page.$$('.sb-nav-item');
  console.log(`\n🔍 Found ${navItems.length} sidebar navigation items`);
  check('Has navigation items', navItems.length > 0);

  const navTexts = [];
  for (const item of navItems) {
    const text = (await item.textContent()).trim();
    navTexts.push(text);
    const isActive = await item.evaluate((el) => el.classList.contains('active'));
    console.log(`   ${isActive ? '▶' : ' '} "${text}" ${isActive ? '(active)' : ''}`);
  }

  // Check key nav items exist
  const allNavText = navTexts.join(' ');
  check('Has 总览/工作台 nav item', allNavText.includes('工作台') || allNavText.includes('总览'));
  check('Has 数据接入 nav item', allNavText.includes('数据接入') || allNavText.includes('接入'));
  check('Has 报告中心 nav item', allNavText.includes('报告中心') || allNavText.includes('洞察'));

  // 6. Check content area(s)
  const content = await page.$('.content');
  check('Content area exists', !!content);

  const main = await page.$('.main');
  check('Main area exists', !!main);

  const topbarTitle = await page.$('.topbar-title');
  if (topbarTitle) {
    const tt = (await topbarTitle.textContent()).trim();
    check('Topbar title shown', tt.length > 0);
    console.log(`   Topbar title: "${tt}"`);
  }

  // 7. Check metrics section (static HTML + API-populated values)
  const metrics = await page.$$('.metric');
  check('Has metrics cards', metrics.length > 0, `found ${metrics.length}`);
  if (metrics.length > 0) {
    console.log('   Metrics:');
    for (const m of metrics) {
      const label = await m.$('.metric-label');
      const val = await m.$('.metric-val');
      const l = label ? (await label.textContent()).trim() : '?';
      const v = val ? (await val.textContent()).trim() : '?';
      console.log(`     ${l}: ${v}`);
    }
  }

  // 8. Check key cards (static HTML + API-populated keys)
  const keyCards = await page.$$('.key-card');
  check('Has API key cards', keyCards.length > 0, `found ${keyCards.length}`);

  // 9. Check recent reports (rendered by API mock)
  const reportRows = await page.$$('.report-row');
  check('Has report rows', reportRows.length > 0, `found ${reportRows.length}`);

  // 10. Check monitors (rendered by API mock)
  const monitorRows = await page.$$('.monitor-row');
  check('Has monitor rows', monitorRows.length > 0, `found ${monitorRows.length}`);

  // 11. Click navigation items and verify content changes
  if (navItems.length > 1) {
    for (let i = 0; i < Math.min(navItems.length, 3); i++) {
      // Re-query to avoid stale references
      const currentItems = await page.$$('.sb-nav-item');
      const item = currentItems[i];
      const itemText = (await item.textContent()).trim();

      console.log(`\n📌 Clicking nav item "${itemText}"...`);
      await item.click();
      await page.waitForTimeout(800);

      const safeName = itemText.replace(/[^a-zA-Z0-9_\u4e00-\u9fff]/g, '_');
      await page.screenshot({ path: `screenshots/dashboard-nav-${i}-${safeName}.png`, fullPage: true });

      // Check active class changed
      const allItemsAfter = await page.$$('.sb-nav-item');
      let activeText = '';
      for (const ai of allItemsAfter) {
        if (await ai.evaluate((el) => el.classList.contains('active'))) {
          activeText = (await ai.textContent()).trim();
          break;
        }
      }
      check(`"${itemText}" became active`, activeText === itemText, `active is "${activeText}"`);
    }
  }

  // 12. Check action buttons
  const topbarBtns = await page.$$('.topbar-btn');
  console.log(`\n🔘 Found ${topbarBtns.length} topbar buttons`);
  for (const btn of topbarBtns) {
    const txt = (await btn.textContent()).trim();
    console.log(`   - "${txt}"`);
  }

  // 13. Check plan banner (static HTML + API-populated content)
  const planBanner = await page.$('.plan-banner');
  check('Plan banner exists', !!planBanner);

  // 14. Report console errors
  if (consoleErrors.length > 0) {
    console.log(`\n⚠️  Console errors (${consoleErrors.length}):`);
    for (const err of consoleErrors) {
      console.log(`   ${err.substring(0, 200)}`);
    }
  }

  // Summary
  console.log(`\n${'='.repeat(40)}`);
  console.log(`📊 RESULTS: ${passed} passed, ${failed} failed, ${passed + failed} total`);
  console.log(`${'='.repeat(40)}`);

  writeFileSync(
    'screenshots/dashboard-test-results.json',
    JSON.stringify({ passed, failed, total: passed + failed, errors: consoleErrors }, null, 2)
  );

  await browser.close();
}

testDashboard().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
