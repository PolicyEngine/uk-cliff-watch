import { chromium } from 'playwright';

const BASE = process.env.CHECK_URL || 'http://localhost:3000';
const consoleErrors = [];
const pageErrors = [];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1700 } });
page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
page.on('pageerror', (e) => pageErrors.push(e.message));

console.log('goto', BASE);
await page.goto(BASE, { waitUntil: 'networkidle', timeout: 60000 });
await page.getByRole('heading', { name: 'Household information' }).waitFor({ timeout: 60000 });

// List the buttons we can see (to locate the calculate action).
const buttonTexts = await page.locator('button').allInnerTexts();
console.log('BUTTONS:', JSON.stringify(buttonTexts.slice(0, 20)));

await page.screenshot({ path: 'ported-initial.png', fullPage: true });

// Choose a complete preset, then trigger the calculation.
const preset = page.getByRole('button', { name: /Universal Credit/i }).first();
if (await preset.count()) {
  await preset.click();
}
const calc = page.getByRole('button', { name: /find cliffs|cliffs|calculate/i }).first();
let clicked = false;
if (await calc.count()) {
  await calc.click().catch(() => {});
  clicked = true;
}
console.log('clicked calculate:', clicked);

// Wait for the chart / cliff report to appear.
await page.waitForFunction(
  () => {
    const t = document.body.innerText;
    return (t.includes('Cliff chart') || t.includes('Cliff report') || document.querySelectorAll('svg').length > 1);
  },
  { timeout: 60000 },
).then(() => console.log('chart appeared')).catch(() => console.log('WARN: chart not detected'));
await page.waitForTimeout(3000);

const text = await page.evaluate(() => document.body.innerText);
console.log('CHECKS:', JSON.stringify({
  cliffChart: text.includes('Cliff chart'),
  cliffReport: text.includes('Cliff report'),
  region_NW: /North West/i.test(text),
  pounds: text.includes('£'),
  noDollars: !/\$\d/.test(text),
  svgCount: await page.locator('svg').count(),
}, null, 2));
await page.screenshot({ path: 'ported-results.png', fullPage: true });

console.log('CONSOLE ERRORS:', consoleErrors.length, JSON.stringify(consoleErrors.slice(0, 10), null, 2));
console.log('PAGE ERRORS:', pageErrors.length, JSON.stringify(pageErrors.slice(0, 10), null, 2));
await browser.close();
console.log(pageErrors.length === 0 ? 'RESULT: no fatal errors' : 'RESULT: page errors present');
