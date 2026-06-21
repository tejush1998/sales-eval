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

  const historyBtns = await page.$$('.history-row');
  console.log('History items found:', historyBtns.length);
  if (historyBtns.length === 0) { await browser.close(); process.exit(1); }

  // Click first
  console.log('Clicking history item 1...');
  await historyBtns[0].click();
  await page.waitForSelector('[data-testid="results"]', { timeout: 5000 });
  let title = await page.$eval('[data-testid="video-title"]', el => el.innerText);
  console.log('  Result 1 title:', title.substring(0, 60));

  // Back
  await page.click('.back-btn');
  await new Promise(r => setTimeout(r, 300));

  if (historyBtns.length >= 2) {
    const btns2 = await page.$$('.history-row');
    console.log('Clicking history item 2...');
    await btns2[1].click();
    await page.waitForSelector('[data-testid="results"]', { timeout: 5000 });
    let title2 = await page.$eval('[data-testid="video-title"]', el => el.innerText);
    console.log('  Result 2 title:', title2.substring(0, 60));
  }

  // Back again
  await page.click('.back-btn');
  await new Promise(r => setTimeout(r, 300));

  // Try first again
  const btns3 = await page.$$('.history-row');
  console.log('Re-clicking history item 1...');
  await btns3[0].click();
  await page.waitForSelector('[data-testid="results"]', { timeout: 5000 });
  let title3 = await page.$eval('[data-testid="video-title"]', el => el.innerText);
  console.log('  Result 3 title:', title3.substring(0, 60));

  console.log('\nAll clicks succeeded!');
  await browser.close();
})();
