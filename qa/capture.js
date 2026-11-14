const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const OUT_DIR = path.join(__dirname, 'out', 'test_caps');

if (!fs.existsSync(OUT_DIR)) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
}

const VIEWPORTS = [
  { name: '1080p_16x9', width: 1920, height: 1080 },
  { name: '720p_16x9', width: 1280, height: 720 },
  { name: 'ultrawide_21x9', width: 2560, height: 1080 },
  { name: 'laptop_16x10', width: 1440, height: 900 },
  { name: 'standard_4x3', width: 1024, height: 768 },
  { name: 'narrow_600x800', width: 600, height: 800 },
  { name: 'mobile_390x844', width: 390, height: 844 },
  { name: 'tiny_480x360', width: 480, height: 360 },
];

async function capture(options = {}) {
  const slides = options.slides || [2, 7, 10]; // 2: 목차, 7: 퀴즈, 10: 카드
  const viewports = options.viewports || VIEWPORTS;
  const prefix = options.prefix || 'before';

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    protocolTimeout: 120000,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-gpu',
      '--force-device-scale-factor=1'
    ]
  });

  try {
    const page = await browser.newPage();
    await page.goto('http://127.0.0.1:8080/index.html', { waitUntil: 'domcontentloaded' });

    for (const vp of viewports) {
      await page.setViewport({ width: vp.width, height: vp.height });
      await new Promise(r => setTimeout(r, 200));

      for (const slideNum of slides) {
        await page.evaluate((num) => {
          if (window.HraStage && window.HraStage.go) {
            window.HraStage.go(num);
          }
          if (num === 1 && window.HraOpening && window.HraOpening.freeze) {
            window.HraOpening.freeze(8.5);
          }
        }, slideNum);

        await new Promise(r => setTimeout(r, 200));

        const fileName = `${prefix}_${vp.name}_s${String(slideNum).padStart(2, '0')}.png`;
        const filePath = path.join(OUT_DIR, fileName);
        await page.screenshot({ path: filePath, type: 'png' });
        console.log(`Saved: ${fileName}`);
      }
    }
  } catch (err) {
    console.error('Error during capture:', err);
  } finally {
    await browser.close();
    console.log('Capture finished.');
  }
}

const args = process.argv.slice(2);
const prefix = args[0] || 'before';
capture({ prefix });
