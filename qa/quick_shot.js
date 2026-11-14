const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const OUT_DIR = path.join(__dirname, 'out', 'shots');
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

async function quickShot() {
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--single-process',
      '--disable-gpu'
    ]
  });

  const page = await browser.newPage();
  
  // 다양한 크기 테스트
  const testCases = [
    { slide: 3, name: 'slide03_guests_1080p', w: 1920, h: 1080 },
    { slide: 3, name: 'slide03_guests_tablet', w: 1024, h: 768 },
    { slide: 3, name: 'slide03_guests_narrow', w: 500, h: 800 },
    { slide: 4, name: 'slide04_banners_1080p', w: 1920, h: 1080 },
    { slide: 15, name: 'slide15_bingo_1080p', w: 1920, h: 1080 },
    { slide: 17, name: 'slide17_scores_1080p', w: 1920, h: 1080 },
    { slide: 18, name: 'slide18_champion_1080p', w: 1920, h: 1080 },
    { slide: 21, name: 'slide21_ballroom_1080p', w: 1920, h: 1080 },
    { slide: 23, name: 'slide23_stars_1080p', w: 1920, h: 1080 },
  ];

  for (const tc of testCases) {
    await page.setViewport({ width: tc.w, height: tc.h });
    await page.goto(`http://127.0.0.1:8080/index.html#p${tc.slide}`, { waitUntil: 'domcontentloaded' });
    await new Promise(r => setTimeout(r, 400));
    const outPath = path.join(OUT_DIR, `${tc.name}.png`);
    await page.screenshot({ path: outPath, captureBeyondViewport: false });
    console.log(`Saved: ${tc.name}.png`);
  }

  await browser.close();
  console.log('Quick shot finished!');
}

quickShot().catch(console.error);
