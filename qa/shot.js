const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const OUT_DIR = path.join(__dirname, 'out', 'shots');
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

// 다양한 화면 비율/크기 프리셋
const PRESETS = {
  fhd: { width: 1920, height: 1080, name: '1080p_16x9' },
  hd: { width: 1280, height: 720, name: '720p_16x9' },
  ultrawide: { width: 2560, height: 1080, name: 'ultrawide_21x9' },
  tablet: { width: 1024, height: 768, name: 'tablet_4x3' },
  narrow: { width: 600, height: 800, name: 'narrow_window' },
  mobile: { width: 390, height: 844, name: 'mobile_portrait' }
};

async function main() {
  const args = process.argv.slice(2);
  let slides = [3, 4, 15, 17, 18, 21]; // 기본: 내빈소개(3), 기숙사배너(4), 이름빙고(15), 점수판(17), 1위(18), 시상식(21)
  let viewports = [PRESETS.fhd, PRESETS.tablet, PRESETS.mobile];

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--slides' && args[i+1]) {
      slides = args[i+1].split(',').map(Number);
    }
    if (args[i] === '--all-sizes') {
      viewports = Object.values(PRESETS);
    }
  }

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.goto('http://127.0.0.1:8080/index.html', { waitUntil: 'networkidle0' });

  for (const vp of viewports) {
    await page.setViewport({ width: vp.width, height: vp.height });
    await new Promise(r => setTimeout(r, 200));

    for (const slideNum of slides) {
      await page.evaluate((n) => {
        if (window.HraStage) window.HraStage.go(n);
      }, slideNum);

      await new Promise(r => setTimeout(r, 300));

      const filename = `s${String(slideNum).padStart(2, '0')}_${vp.name}.png`;
      const outPath = path.join(OUT_DIR, filename);
      await page.screenshot({ path: outPath });
      console.log(`Captured: ${filename} (${vp.width}x${vp.height})`);
    }
  }

  await browser.close();
  console.log('Finished capturing all requested slides!');
}

main().catch(console.error);
