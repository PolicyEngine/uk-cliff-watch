import { chromium } from 'playwright';

const BASE = process.env.CHECK_URL || 'http://127.0.0.1:3000';
const consoleErrors = [];
const pageErrors = [];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 1600 } });

page.on('console', (msg) => {
  if (msg.type() === 'error') consoleErrors.push(msg.text());
});
page.on('pageerror', (err) => pageErrors.push(err.message));

console.log('navigating to', BASE);
await page.goto(BASE, { waitUntil: 'networkidle', timeout: 60000 });

// Wait for the dashboard to compute and render the chart.
await page.waitForFunction(
  () => document.body.innerText.includes('Net income') &&
        !document.body.innerText.includes('Loading…'),
  { timeout: 45000 },
).catch(() => console.log('WARN: did not detect "Net income" header in time'));

// Give recharts a beat to paint.
await page.waitForTimeout(2500);

const text = await page.evaluate(() => document.body.innerText);
const has = (s) => text.includes(s);

const checks = {
  header: has('UK CliffWatch'),
  scenarios: has('Scenarios'),
  presetTrap: has('The £100k trap'),
  netIncomeChart: has('Net income'),
  marginalRate: /marginal rate/i.test(text),
  regionComparison: /region/i.test(text),
  svgCount: await page.locator('svg').count(),
};
console.log('DEFAULT VIEW CHECKS:', JSON.stringify(checks, null, 2));
await page.screenshot({ path: 'check-default.png', fullPage: true });

// Click the "£100k trap" preset and wait for the right-hand panels to recompute.
const trap = page.getByRole('button', { name: /£100k trap/i });
if (await trap.count()) {
  await trap.first().click();
  // The £100k-trap household nets ~£68,398; wait until that lands (regions = 12 sims, slow).
  await page.waitForFunction(
    () => {
      const t = document.body.innerText;
      return t.includes('£68,398') || (t.includes('£68,') && !t.includes('£25,413'));
    },
    { timeout: 60000 },
  ).then(() => console.log('  recompute landed'))
   .catch(() => console.log('  WARN: recompute did not land in 60s'));
  await page.waitForTimeout(1500);
  const t2 = await page.evaluate(() => document.body.innerText);
  console.log('AFTER £100k PRESET:');
  console.log('  net income updated to ~£68,398:', t2.includes('£68,'));
  console.log('  stale £25,413 gone:', !t2.includes('£25,413'));
  console.log('  marginal-rate band 6x% shown:', /\b6\d%/.test(t2));
  console.log('  earnings axis reaches >=£100k:', /£1[0-3]\d,\d\d\d/.test(t2));
  await page.screenshot({ path: 'check-100k-trap.png', fullPage: true });
}

console.log('CONSOLE ERRORS:', consoleErrors.length, JSON.stringify(consoleErrors.slice(0, 8), null, 2));
console.log('PAGE ERRORS:', pageErrors.length, JSON.stringify(pageErrors.slice(0, 8), null, 2));

await browser.close();
const ok = pageErrors.length === 0 && checks.header && checks.netIncomeChart && checks.svgCount > 0;
console.log(ok ? 'RESULT: PASS' : 'RESULT: FAIL');
process.exit(ok ? 0 : 1);
