const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const OUT_DIR = path.join(__dirname, 'out', 'shots');
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

async function checkP2andP3() {
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-gpu',
      '--disable-dev-shm-usage',
      '--single-process'
    ]
  });

  const page = await browser.newPage();
  
  const testCases = [
    { slide: 2, name: 'p02_owl_parchment_1080p', w: 1920, h: 1080, wait: 2800 },
    { slide: 2, name: 'p02_owl_parchment_tablet', w: 1024, h: 768, wait: 2800 },
    { slide: 3, name: 'p03_professor_jung_1080p', w: 1920, h: 1080, wait: 800 },
    { slide: 3, name: 'p03_professor_jung_tablet', w: 1024, h: 768, wait: 800 },
    { slide: 3, name: 'p03_professor_jung_narrow', w: 600, h: 800, wait: 800 },
  ];

  for (const tc of testCases) {
    await page.setViewport({ width: tc.w, height: tc.h });
    await page.goto(`http://127.0.0.1:8080/index.html#p${tc.slide}`, { waitUntil: 'domcontentloaded' });
    await new Promise(r => setTimeout(r, tc.wait));
    const outPath = path.join(OUT_DIR, `${tc.name}.png`);
    await page.screenshot({ path: outPath, captureBeyondViewport: false });
    console.log(`Saved: ${tc.name}.png`);
  }

  await browser.close();
  console.log('Capture complete!');
}

checkP2andP3().catch(console.error);
