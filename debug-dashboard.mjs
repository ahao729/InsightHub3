import { chromium } from 'playwright';

async function debug() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

  // Log all requests
  page.on('request', req => console.log(`>> ${req.method()} ${req.url()}`));
  page.on('requestfailed', req => console.log(`!! FAIL ${req.url()}: ${req.failure()?.errorText}`));
  page.on('response', resp => {
    if (resp.status() >= 400) console.log(`!! ${resp.status()} ${resp.url()}`);
  });

  await page.goto('http://localhost:5173/dashboard.html', { waitUntil: 'load', timeout: 15000 });
  await page.waitForTimeout(2000);

  // Get full HTML
  const html = await page.content();
  console.log('\n=== PAGE HTML (first 3000 chars) ===');
  console.log(html.substring(0, 3000));
  console.log('...');
  
  // Get body children count
  const bodyHTML = await page.evaluate(() => document.body.innerHTML.substring(0, 2000));
  console.log('\n=== BODY HTML (first 2000 chars) ===');
  console.log(bodyHTML);

  // Check if elements exist by evaluating
  const hasShell = await page.evaluate(() => !!document.querySelector('.page-shell'));
  console.log(`\n.page-shell exists: ${hasShell}`);
  
  const hasSidebar = await page.evaluate(() => !!document.querySelector('.sidebar'));
  console.log(`.sidebar exists: ${hasSidebar}`);
  
  const hasMain = await page.evaluate(() => !!document.querySelector('.main'));
  console.log(`.main exists: ${hasMain}`);
  
  const navCount = await page.evaluate(() => document.querySelectorAll('.sb-nav-item').length);
  console.log(`.sb-nav-item count: ${navCount}`);

  // Check computed style of body
  const bodyStyle = await page.evaluate(() => {
    const s = getComputedStyle(document.body);
    return { bg: s.backgroundColor, color: s.color, font: s.fontFamily };
  });
  console.log(`Body styles:`, bodyStyle);

  await browser.close();
}

debug().catch(err => {
  console.error('Debug failed:', err);
  process.exit(1);
});
