import puppeteer from 'puppeteer';

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    defaultViewport: { width: 1280, height: 900 },
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const page = await browser.newPage();
  page.on('pageerror', (err) => console.error('[PAGE ERROR]', err.message));

  await page.goto(FRONTEND_URL, { waitUntil: 'networkidle2', timeout: 30000 });
  await page.waitForSelector('[data-testid="evaluate-form"]');
  console.log('Page loaded');

  // Scroll to bottom to simulate user browsing history
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await new Promise(r => setTimeout(r, 500));
  const scrollYBefore = await page.evaluate(() => window.scrollY);
  console.log('Scrolled to bottom, scrollY:', scrollYBefore);

  const historyBtns = await page.$$('.history-row');
  console.log('Clicking first history item from bottom...');
  await historyBtns[0].click();

  // Wait for results to appear and scroll
  await new Promise(r => setTimeout(r, 1000));
  const scrollYAfter = await page.evaluate(() => window.scrollY);
  console.log('After click, scrollY:', scrollYAfter);

  if (scrollYAfter < scrollYBefore) {
    console.log('SCROLL FIX WORKS: page scrolled up to show results');
  } else {
    console.log('ScrollY did not decrease (may already be visible)');
  }

  await browser.close();
})();
