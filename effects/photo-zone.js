// P23 포토존: 표지의 성과 검은 호수 위로, 들어오자마자 금빛 반짝이가 화면 위에서부터 차르륵 쏟아지고
// 촬영하는 동안 끊김 없이 계속 내린다. 다음 버튼은 바로 24페이지로 간다(남은 연출 없음).
// 콘티: 작업지침/콘티/P23_포토존.md
(() => {
  const W = 1920, H = 1080;                 // 계산 기준 좌표(무대 크기에 맞춰 늘린다)
  const START = 0.1;                        // 쏟아짐 시작(초)
  const FRONT_DUR = 1.9;                    // 띠 앞머리가 화면 끝까지 가는 시간
  const POUR_END = 2.4;                     // 쏟아지는 반짝이가 모두 사라지는 시각
  const HOLD_T = 8;                         // 머무름 대표 시각(QA 고정, 움직임 줄이기 모드)
  const TAU = Math.PI * 2;
  const COLORS = ['#fff2c8', '#ffd98a', '#f4bf5a', '#e3a63f'];
  const SPARK = '#fff6dc';

  // 정해진 씨앗으로 만든 난수: 언제 열어도 같은 반짝이가 같은 자리에 있다
  let seed = 2026;
  const rand = () => {
    seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
  const between = (a, b) => a + (b - a) * rand();
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const pourEase = u => 1 - Math.pow(1 - clamp(u, 0, 1), 2.2);   // 빠르게 쏟아져 천천히 멈춤
  const frontY = t => -20 + 1.1 * H * pourEase((t - START) / FRONT_DUR);
  const depthFade = y => y < 0.4 * H ? 1 : Math.max(0.3, 1 - 0.7 * (y - 0.4 * H) / (0.6 * H));   // 아래(사람 자리)로 갈수록 옅게

  // 세 겹: 먼 것은 작고 느리고 흐리게, 가까운 것은 크고 빠르게(시차)
  const LAYERS = [
    { n: 100, size: [1.2, 2.0], speed: [55, 80], sway: [3, 6], alpha: [0.5, 0.75], glint: false, soft: false, front: false },
    { n: 70, size: [2.2, 3.6], speed: [110, 160], sway: [6, 12], alpha: [0.7, 0.95], glint: true, soft: false, front: false },
    { n: 14, size: [4.0, 6.5], speed: [220, 300], sway: [12, 22], alpha: [0.55, 0.8], glint: true, soft: true, front: true },
  ];
  const flake = (layer, size) => ({
    x: rand() * W, size, sway: between(...layer.sway), swayF: between(0.12, 0.3), swayP: rand() * TAU,
    alpha: between(...layer.alpha), flipF: between(1.2, 2.6), flipP: rand() * TAU,
    glintF: between(0.3, 0.9), glintP: rand() * TAU, color: Math.floor(rand() * COLORS.length),
    glint: layer.glint, soft: layer.soft,
  });
  const steady = [];
  for (const layer of LAYERS) {
    for (let i = 0; i < layer.n; i++) {
      const f = flake(layer, between(...layer.size));
      f.phase = rand();
      f.speed = between(...layer.speed);
      f.gate = rand() * 80;
      f.front = layer.front;
      steady.push(f);
    }
  }
  const pour = [];
  for (let i = 0; i < 240; i++) {
    const f = flake({ sway: [4, 14], alpha: [0.8, 1], glint: true, soft: false }, between(2.4, 5.5));
    f.delay = rand() * 0.35;
    f.dist = between(0.55, 1.1) * H;
    f.dur = between(1.4, 1.95);             // START + 0.35 + 1.95 = 2.4초에 모두 끝난다
    pour.push(f);
  }

  // 미리 그려 두는 그림(빛 점, 흐린 빛 점, 십자 빛). 매 프레임에는 찍기만 한다
  const sprite = (size, draw) => {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    draw(c.getContext('2d'), size / 2);
    return c;
  };
  let dots, softDots, spark;
  const prepare = () => {
    if (dots) return;
    const dot = (color, soft) => sprite(64, (g, r) => {
      const grad = g.createRadialGradient(r, r, 0, r, r, r);
      if (soft) {
        grad.addColorStop(0, color + 'cc'); grad.addColorStop(0.45, color + '55'); grad.addColorStop(1, color + '00');
      } else {
        grad.addColorStop(0, '#fffaf0'); grad.addColorStop(0.24, color); grad.addColorStop(0.5, color + '80'); grad.addColorStop(1, color + '00');
      }
      g.fillStyle = grad;
      g.fillRect(0, 0, r * 2, r * 2);
    });
    dots = COLORS.map(c => dot(c, false));
    softDots = COLORS.map(c => dot(c, true));
    spark = sprite(128, (g, r) => {
      for (const [w, h] of [[r * 2, r * 0.09], [r * 0.09, r * 2]]) {
        const grad = w > h ? g.createLinearGradient(0, r, r * 2, r) : g.createLinearGradient(r, 0, r, r * 2);
        grad.addColorStop(0, SPARK + '00'); grad.addColorStop(0.5, SPARK); grad.addColorStop(1, SPARK + '00');
        g.fillStyle = grad;
        g.fillRect(r - w / 2, r - h / 2, w, h);
      }
      const core = g.createRadialGradient(r, r, 0, r, r, r * 0.3);
      core.addColorStop(0, '#ffffff'); core.addColorStop(1, SPARK + '00');
      g.fillStyle = core;
      g.fillRect(0, 0, r * 2, r * 2);
    });
  };

  // 반짝이 하나 그리기: 뒤집히며(폭이 줄었다 늘었다) 흔들리고, 기울기가 맞는 순간 반짝 빛난다
  const drawFlake = (g, f, x, y, alpha, t) => {
    if (alpha <= 0.01 || y < -40 || y > H + 40) return;
    const flip = Math.abs(Math.cos(TAU * f.flipF * t + f.flipP));
    const d = f.size * 2 * 2.6;             // 빛 번짐 포함 지름
    const glint = Math.pow(Math.max(0, Math.cos(TAU * f.glintF * t + f.glintP)), 24);
    g.globalAlpha = alpha * (f.glint ? 0.75 + 0.25 * flip : 0.7 + 0.3 * (0.5 + 0.5 * Math.cos(TAU * f.glintF * t + f.glintP)));
    const w = d * (f.glint ? 0.35 + 0.65 * flip : 1);
    g.drawImage((f.soft ? softDots : dots)[f.color], x - w / 2, y - d / 2, w, d);
    if (f.glint && glint > 0.04) {
      const s = f.size * 2 * 3.5;
      g.globalAlpha = alpha * glint;
      g.drawImage(spark, x - s / 2, y - s / 2, s, s);
    }
  };

  const steadyAt = (f, t) => {
    const range = H + 40;
    const y = -20 + ((f.phase * range + f.speed * t) % range);
    return { x: f.x + f.sway * Math.sin(TAU * f.swayF * t + f.swayP), y };
  };
  const pourAt = (f, t) => {
    const u = (t - START - f.delay) / f.dur;
    if (u < 0 || u > 1) return null;
    return { x: f.x + f.sway * Math.sin(TAU * f.swayF * t + f.swayP), y: -20 + f.dist * pourEase(u), fade: u < 0.65 ? 1 : 1 - (u - 0.65) / 0.35 };
  };

  let back, front, ro, raf = 0, start = 0, fixedT = null, reduced = false;
  const effect = {
    running: false,
    reducedFrame: HOLD_T,
    enter(slide, api = {}) {
      this.leave();
      prepare();
      reduced = !!api.reduced;
      back = document.createElement('canvas');
      front = document.createElement('canvas');
      back.className = 'photo-zone-canvas is-back';
      front.className = 'photo-zone-canvas is-front';
      for (const c of [back, front]) c.setAttribute('aria-hidden', 'true');
      slide.querySelector('h1')?.before(back);
      if (!back.isConnected) slide.append(back);
      slide.append(front);
      const fit = () => {
        const r = slide.getBoundingClientRect();
        const dpr = Math.min(devicePixelRatio || 1, 1.5);
        for (const c of [back, front]) {
          c.width = Math.max(1, Math.round(r.width * dpr));
          c.height = Math.max(1, Math.round(r.height * dpr));
        }
        if (fixedT !== null || reduced) this.draw(fixedT ?? HOLD_T);
      };
      ro = new ResizeObserver(fit);
      ro.observe(slide);
      fit();
      start = performance.now();
      if (reduced) {
        this.draw(HOLD_T);                  // 움직임 줄이기: 머무름 모습 한 장
      } else {
        this.running = true;
        const tick = now => {
          if (!this.running) return;
          this.draw(fixedT ?? (now - start) / 1000);
          raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      }
      return () => this.leave();
    },
    leave() {
      this.running = false;
      cancelAnimationFrame(raf);
      ro?.disconnect();
      back?.remove();
      front?.remove();
      back = front = ro = null;
    },
    draw(t) {
      if (!back) return;
      const gb = back.getContext('2d'), gf = front.getContext('2d');
      for (const [c, g] of [[back, gb], [front, gf]]) {
        g.setTransform(1, 0, 0, 1, 0, 0);
        g.clearRect(0, 0, c.width, c.height);
        g.setTransform(c.width / W, 0, 0, c.height / H, 0, 0);
        g.globalCompositeOperation = 'lighter';
      }
      const yf = frontY(t);
      for (const f of steady) {
        const p = steadyAt(f, t);
        const shown = clamp((yf - f.gate - p.y) / 40, 0, 1);   // 띠 앞머리가 지나간 자리부터 드러남
        drawFlake(f.front ? gf : gb, f, p.x, p.y, f.alpha * shown * depthFade(p.y), t);
      }
      if (t < POUR_END + 0.05) {
        for (const f of pour) {
          const p = pourAt(f, t);
          if (p) drawFlake(gb, f, p.x, p.y, f.alpha * p.fade, t);
        }
      }
      gb.globalAlpha = gf.globalAlpha = 1;
    },
    // t초에 그려지는 반짝이 수(QA: 입자 수 상한 확인)
    count(t) {
      return steady.length + pour.filter(f => pourAt(f, t)).length;
    },
    pending() { return false; },
    cue() {},
    freeze(t) { fixedT = t === null || t === undefined ? HOLD_T : t; this.draw(fixedT); },   // QA 전용
    unfreeze() { fixedT = null; start = performance.now(); },
  };
  (window.HRA_EFFECTS ||= {})['photo-zone'] = effect;
})();
