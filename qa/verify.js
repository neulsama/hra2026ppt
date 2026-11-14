const puppeteer = require('puppeteer-core');
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

async function verify() {
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
  });

  const page = await browser.newPage();
  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', err => errors.push(err.toString()));

  await page.goto('http://127.0.0.1:8080/index.html', { waitUntil: 'domcontentloaded' });
  await new Promise(r => setTimeout(r, 1000));

  const slideCount = await page.evaluate(() => window.HraStage ? window.HraStage.total : 0);
  console.log('Total Slides Loaded:', slideCount);

  // 모든 슬라이드를 순회하며 JS 에러가 발생하는지 점검
  for (let i = 1; i <= slideCount; i++) {
    await page.evaluate((num) => {
      window.HraStage.go(num);
    }, i);
    await new Promise(r => setTimeout(r, 100));
  }

  console.log('All slides navigated successfully. Console errors:', errors);
  await browser.close();
}

verify().catch(console.error);
