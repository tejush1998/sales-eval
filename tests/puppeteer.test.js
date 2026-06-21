import puppeteer from 'puppeteer';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.join(__dirname, '..', '..');
const SHOTS = path.join(__dirname, 'screenshots');
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
const TEST_YT_URL = 'https://www.youtube.com/watch?v=eoTPt3XNHmk&pp=ygUbc2FsZXMgY2FsbCBleGFtcGxlIGluIGhpbmRp';
const HEADLESS = (process.env.HEADLESS ?? 'true').toLowerCase() !== 'false';
const TIMEOUT_MS = Number(process.env.E2E_TIMEOUT_MS) || 240_000;

if (!fs.existsSync(SHOTS)) fs.mkdirSync(SHOTS, { recursive: true });

function log(msg) { console.log(`[e2e] ${msg}`); }

(async () => {
  log(`Launching puppeteer (headless=${HEADLESS})`);
  const browser = await puppeteer.launch({
    headless: HEADLESS ? 'new' : false,
    defaultViewport: { width: 1280, height: 900 },
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();
  page.on('console', (msg) => {
    if (msg.type() === 'error') console.warn('[browser:error]', msg.text());
  });
  page.on('pageerror', (err) => console.warn('[browser:pageerror]', err.message));

  try {
    log(`Opening ${FRONTEND_URL}`);
    await page.goto(FRONTEND_URL, { waitUntil: 'networkidle2', timeout: 60_000 });

    await page.waitForSelector('[data-testid="evaluate-form"]', { timeout: 30_000 });
    log('Form loaded');

    await page.screenshot({ path: path.join(SHOTS, '01-empty.png'), fullPage: true });

    await page.click('[data-testid="yt-url-input"]');
    await page.type('[data-testid="yt-url-input"]', TEST_YT_URL, { delay: 10 });
    log(`Typed URL: ${TEST_YT_URL}`);

    await page.screenshot({ path: path.join(SHOTS, '02-filled.png'), fullPage: true });

    log('Submitting…');
    await page.click('[data-testid="submit-btn"]');

    await page.waitForSelector('[data-testid="status"]', { timeout: 10_000 });
    await page.screenshot({ path: path.join(SHOTS, '03-loading.png'), fullPage: true });

    log(`Waiting up to ${TIMEOUT_MS / 1000}s for results…`);
    await page.waitForFunction(
      () => {
        const el = document.querySelector('[data-testid="submit-btn"]');
        return el && !el.disabled;
      },
      { timeout: TIMEOUT_MS, polling: 1000 }
    );

    const errorEl = await page.$('.card.error');
    if (errorEl) {
      const errText = await page.$eval('.card.error', (el) => el.innerText);
      throw new Error(`Frontend reported error: ${errText}`);
    }

    await page.waitForSelector('[data-testid="results"]', { timeout: 30_000 });
    log('Results rendered');

    const title = await page.$eval('[data-testid="video-title"]', (el) => el.innerText);
    const overallScore = await page.$eval('[data-testid="overall-score"]', (el) => el.innerText);
    const criteriaCount = await page.$$eval('[data-testid="criteria"] li', (els) => els.length);

    log(`Title: ${title}`);
    log(`Overall score: ${overallScore.replace(/\s+/g, ' ')}`);
    log(`Criteria rows: ${criteriaCount}`);

    await page.screenshot({ path: path.join(SHOTS, '04-results.png'), fullPage: true });

    if (HEADLESS) {
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.screenshot({ path: path.join(SHOTS, '05-results-bottom.png'), fullPage: true });
    }

    const turnCount = await page.$$eval('[data-testid="turns"] .turn', (els) => els.length);
    log(`Transcript turns: ${turnCount}`);

    let timings = null;
    if (await page.$('[data-testid="timings"]')) {
      const totalTime = await page.$eval('[data-testid="total-time"]', (el) => el.innerText);
      const totalCost = await page.$eval('[data-testid="total-cost"]', (el) => el.innerText);
      const stageRows = await page.$$eval('[data-testid="timings"] .timings-table tbody tr', (rows) =>
        rows.map((r) => ({
          stage: r.children[0]?.innerText,
          time: r.children[1]?.innerText,
        }))
      );
      const costRows = await page.$$eval('[data-testid="timings"] .costs-table tbody tr', (rows) =>
        rows.map((r) => ({
          provider: r.children[0]?.innerText,
          cost: r.children[1]?.innerText,
        }))
      );
      const sarvamCostEl = await page.$('[data-testid="sarvam-cost"]');
      const sarvamCost = sarvamCostEl ? await page.$eval('[data-testid="sarvam-cost"]', (el) => el.innerText) : null;
      timings = { totalTime, totalCost, stageRows, costRows, sarvamCost };
      log(`Total time: ${totalTime} · Total cost: ${totalCost}`);
      log(`Sarvam cost: ${sarvamCost}`);
      log(`Stages: ${JSON.stringify(stageRows)}`);
      log(`Costs: ${JSON.stringify(costRows)}`);
    } else {
      log('Timings panel not rendered');
    }

    const summary = {
      ok: true,
      url: TEST_YT_URL,
      title,
      overallScore: overallScore.replace(/\s+/g, ' '),
      criteriaCount,
      turnCount,
      timings,
      screenshots: fs.readdirSync(SHOTS).map((f) => f),
    };
    fs.writeFileSync(path.join(SHOTS, 'summary.json'), JSON.stringify(summary, null, 2));
    log('PASS — wrote ' + path.join(SHOTS, 'summary.json'));
    process.exitCode = 0;
  } catch (err) {
    log('FAIL — ' + err.message);
    try {
      await page.screenshot({ path: path.join(SHOTS, 'fail.png'), fullPage: true });
    } catch {}
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
})();
