const { chromium } = require('playwright-core');

(async () => {
  const browser = await chromium.launch({
    executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    headless: true,
  });
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
  await page.waitForSelector('text=Idex Finance', { timeout: 15000 });
  await page.waitForSelector('text=Gestão que move resultados', { timeout: 15000 });
  await page.screenshot({ path: 'brand-check.png' });
  console.log('BRAND UPDATED OK');
  await browser.close();
})().catch((err) => {
  console.error('SCRIPT FAILED:', err);
  process.exit(1);
});
