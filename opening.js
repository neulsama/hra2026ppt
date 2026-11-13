// P01 오프닝: 원본 그림(opening/opening.webp)의 물결과 배를 그대로 살려 움직이는 장면.
// - 수면: 원본 수면의 반사광 무늬를 여러 겹의 파도(원근 적용)로 굴절시켜 일렁이게 함(WebGL)
// - 배 3척: 원본에서 오려 낸 모양 그대로, 같은 파도 함수로 계산한 자리의 물결에 맞춰 오르내리고 기욺
// - 카메라: 호수 → 성으로 다가가는 오프닝, 다음 장면으로 갈 때 장미창 안으로 들어감
(() => {
  const W = 1660, H = 928, WT = 637;             // 그림 크기, 수면 레이어 시작 y
  const WH = H - WT;
  const MOON = { x: 685, y: 169 };
  const WINDOW = { x: 1137, y: 300 };             // 성의 큰 고딕 창: 진입 목표
  const SPIRE = { x: 1135, y: 40 };
  const INTRO = 9.6;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');

  const load = src => { const i = new Image(); i.decoding = 'async'; i.src = './opening/' + src; return i; };
  const base = load('opening.webp');
  const dataImg = src => { const i = new Image(); i.src = src; return i; };
  const waterImg = dataImg(window.HRA_OPENING_TEX.water);
  const glintImg = dataImg(window.HRA_OPENING_TEX.glints);
  // 원본에서의 위치(x, y), 수면에 닿는 선(base), 등불 위치(그림 좌표)
  const boats = [
    { img: load('opening-b1.webp'), x: 621, y: 605, base: 665, cx: 655, lamps: [[654, 626, 13]], ph: 0 },
    { img: load('opening-b2.webp'), x: 811, y: 596, base: 703, cx: 880, lamps: [[899, 652, 16], [920, 652, 14], [828, 664, 11]], ph: 1.7 },
    { img: load('opening-b3.webp'), x: 1282, y: 543, base: 807, cx: 1470, lamps: [[1552, 688, 34], [1339, 713, 22]], ph: 3.1 },
  ];
  const all = [base, waterImg, glintImg, ...boats.map(b => b.img)];
  const ready = () => all.every(i => i.complete && i.naturalWidth);

  let canvas, ctx, host, raf, ro, start = 0, last = 0, entering = null, dpr = 1;
  const snow = [], sparks = [];
  let starBurst = -1;
  let fixedT = null;                              // QA용: 시간을 고정해 같은 장면을 반복 촬영

  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const easeInOut = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  const rand = n => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
  const bez = (a, b, c, t) => (1 - t) * (1 - t) * a + 2 * (1 - t) * t * b + t * t * c;

  // ---------- 파도(셰이더와 같은 식) ----------
  // [진폭, 가로 파수, 깊이 파수, 속도, 위상]
  const WAVES = [[1, .018, 1.3, 1.05, 0], [.62, -.035, 2.05, 1.6, 1.7], [.38, .06, 2.9, 2.25, 4.1], [.22, -.09, 4.3, 3.1, 2.3]];
  const wind = t => .8 + .28 * Math.sin(t * .31) + .16 * Math.sin(t * .83 + 1.3);
  const persp = y => .25 + .75 * clamp((y - WT) / WH, 0, 1);
  function wave(x, y, t) {
    const p = persp(y), X = (x - 830) / p, Z = 40 / p, k = wind(t);
    let h = 0, dx = 0;
    for (const [A, kx, kz, w, f] of WAVES) {
      const a = kx * X + kz * Z + w * t + f;
      h += A * Math.sin(a);
      dx += A * kx * Math.cos(a);
    }
    return { h: h * k, dx: dx * k / p, p };
  }

  // ---------- WebGL 수면 ----------
  const FRAG = `precision highp float;
uniform sampler2D uWater, uGlint;
uniform float uT, uWind;
varying vec2 vUv;
const float W = ${W}.0, WT = ${WT}.0, WH = ${WH}.0;
void main(){
  vec2 px = vec2(vUv.x * W, WT + vUv.y * WH);
  float p = 0.25 + 0.75 * clamp((px.y - WT) / WH, 0.0, 1.0);
  float X = (px.x - 830.0) / p, Z = 40.0 / p;
  vec4 A = vec4(1.0, .62, .38, .22), KX = vec4(.018, -.035, .06, -.09), KZ = vec4(1.3, 2.05, 2.9, 4.3);
  vec4 S = vec4(1.05, 1.6, 2.25, 3.1), F = vec4(0.0, 1.7, 4.1, 2.3);
  vec4 a = KX * X + KZ * Z + S * uT + F;
  vec4 c = cos(a);
  float h = dot(A, sin(a)) * uWind;
  float gx = dot(A * KX, c) * uWind;
  float gz = dot(A * KZ, c) * uWind;
  // 가까울수록 크게, 먼 곳은 잔잔하게 굴절
  float near = p * p;
  vec2 disp = vec2(gx * 34.0 + gz * 0.35, gz * 1.55) * near;
  vec2 uv = vec2((px.x + disp.x) / W, (px.y + disp.y - WT) / WH);
  vec4 col = texture2D(uWater, uv);
  vec4 g = texture2D(uGlint, uv + vec2(0.0, gz * 0.0035 * near));
  float sh = 0.5 + 0.5 * sin(uT * 3.3 + px.x * 0.06 + h * 2.2 + px.y * 0.8);
  col.rgb += g.rgb * (0.15 + 0.55 * sh * sh) * near;
  // 물결 경사면에 비친 밤하늘빛
  float facet = smoothstep(0.55, 1.0, gz * 0.45 + 0.5);
  col.rgb += vec3(0.34, 0.42, 0.62) * facet * 0.07 * near * col.a;
  col.rgb *= 0.94 + 0.08 * facet;
  gl_FragColor = vec4(col.rgb * col.a, col.a);
}`;
  let gl, glCanvas, glProg, glU = {};
  function initGL() {
    if (gl !== undefined) return gl;
    glCanvas = document.createElement('canvas');
    glCanvas.width = W; glCanvas.height = WH;
    gl = glCanvas.getContext('webgl', { premultipliedAlpha: true, alpha: true }) || null;
    if (!gl) return gl;
    const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; };
    glProg = gl.createProgram();
    gl.attachShader(glProg, sh(gl.VERTEX_SHADER, 'attribute vec2 a;varying vec2 vUv;void main(){vUv=a;gl_Position=vec4(a.x*2.0-1.0,1.0-a.y*2.0,0.0,1.0);}'));
    gl.attachShader(glProg, sh(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(glProg);
    if (!gl.getProgramParameter(glProg, gl.LINK_STATUS)) { gl = null; return gl; }
    gl.useProgram(glProg);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(glProg, 'a');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    [['uWater', waterImg, 0], ['uGlint', glintImg, 1]].forEach(([name, image, unit]) => {
      const tex = gl.createTexture();
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
      for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
      gl.uniform1i(gl.getUniformLocation(glProg, name), unit);
    });
    glU.t = gl.getUniformLocation(glProg, 'uT');
    glU.w = gl.getUniformLocation(glProg, 'uWind');
    gl.viewport(0, 0, W, WH);
    return gl;
  }
  function drawWater(t) {
    if (!initGL()) return;                       // WebGL이 없으면 원본 수면을 그대로 둠
    gl.uniform1f(glU.t, t);
    gl.uniform1f(glU.w, wind(t));
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    ctx.drawImage(glCanvas, 0, WT);
  }

  // ---------- 배 ----------
  function drawBoat(b, t) {
    // 배 길이 양 끝의 물 높이 차이로 기울기, 가운데 물 높이로 오르내림
    const mid = wave(b.cx, b.base, t);
    const half = (b.img.naturalWidth || 100) * .35;
    const l = wave(b.cx - half, b.base, t), r = wave(b.cx + half, b.base, t);
    const scale = 1.25 * mid.p;
    const lift = mid.h * scale + Math.sin(t * .55 + b.ph) * .8 * mid.p;   // 잔물결 + 느린 너울
    const roll = Math.atan2((r.h - l.h) * scale, half * 2) * 1.6;
    const sway = Math.sin(t * .4 + b.ph) * 1.2 * mid.p;                  // 묶인 배가 살짝 밀렸다 돌아옴
    b.pose = { lift, roll, sway };

    ctx.save();
    // 물에 잠기는 부분은 가림
    ctx.beginPath(); ctx.rect(b.x - 40, b.y - 40, b.img.naturalWidth + 80, b.base - b.y + 40 + 1.2); ctx.clip();
    ctx.translate(b.cx + sway, b.base - lift);
    ctx.rotate(roll);
    ctx.drawImage(b.img, b.x - b.cx, b.y - b.base);
    ctx.restore();
  }

  function drawLamps(b, t) {
    const { lift, roll, sway } = b.pose;
    ctx.globalCompositeOperation = 'lighter';
    b.lamps.forEach(([lx, ly, r], i) => {
      const dx = lx - b.cx, dy = ly - b.base;
      const x = b.cx + sway + dx * Math.cos(roll) - dy * Math.sin(roll);
      const y = b.base - lift + dx * Math.sin(roll) + dy * Math.cos(roll);
      const f = .5 + .5 * Math.sin(t * 8.3 + i * 2 + b.ph * 3) * Math.sin(t * 3.1 + i + b.ph);
      const rad = r * (1.6 + f * .25);
      const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
      g.addColorStop(0, `rgba(255,214,140,${.32 + f * .14})`);
      g.addColorStop(.4, 'rgba(255,170,80,.10)');
      g.addColorStop(1, 'rgba(255,150,60,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, rad, 0, Math.PI * 2); ctx.fill();
    });
    ctx.globalCompositeOperation = 'source-over';
  }

  // ---------- 하늘 연출 ----------
  function makeFog() {
    const c = document.createElement('canvas');
    c.width = 1024; c.height = 160;
    const g = c.getContext('2d');
    for (let i = 0; i < 46; i++) {
      const x = rand(i) * 1024, y = 50 + rand(i + 40) * 70, r = 40 + rand(i + 80) * 90;
      const grad = g.createRadialGradient(x, y, 0, x, y, r);
      grad.addColorStop(0, 'rgba(160,176,206,.22)'); grad.addColorStop(1, 'rgba(160,176,206,0)');
      g.fillStyle = grad;
      g.save(); g.translate(x, y); g.scale(2.4, .55); g.translate(-x, -y);
      for (const o of [0, -1024 / 2.4, 1024 / 2.4]) { g.beginPath(); g.arc(x + o, y, r, 0, Math.PI * 2); g.fill(); }
      g.restore();
    }
    return c;
  }
  const fog = makeFog();
  let band;
  function drawFog(t, x0, x1, y, h, speed, alpha) {
    // 좌우 끝이 서서히 사라지는 안개 띠
    if (!band) { band = document.createElement('canvas'); band.width = W; band.height = 200; }
    const b = band.getContext('2d');
    b.globalCompositeOperation = 'source-over';
    b.clearRect(0, 0, W, 200);
    const w = 1024 * 1.9, off = -((t * speed) % w);
    for (let x = off - w; x < W + w; x += w) b.drawImage(fog, x, 0, w, 200);
    const m = b.createLinearGradient(x0, 0, x1, 0);
    m.addColorStop(0, 'rgba(0,0,0,1)'); m.addColorStop(.65, 'rgba(0,0,0,.8)'); m.addColorStop(1, 'rgba(0,0,0,0)');
    b.globalCompositeOperation = 'destination-in';
    b.fillStyle = m; b.fillRect(0, 0, W, 200);
    ctx.globalAlpha = alpha;
    ctx.drawImage(band, 0, 0, W, 200, 0, y, W, h);
    ctx.globalAlpha = 1;
  }

  function drawArc(t, dt) {
    const a = 6.1, b = 8.3;
    ctx.globalCompositeOperation = 'lighter';
    if (t > a && t < b) {
      const q = easeInOut((t - a) / (b - a));
      const hx = bez(120, 560, SPIRE.x, q), hy = bez(420, -170, SPIRE.y, q);
      for (let i = 0; i < 4; i++) sparks.push({ x: hx + (Math.random() - .5) * 8, y: hy + (Math.random() - .5) * 8, life: 1.4 + Math.random() * 1.2, age: 0, r: .8 + Math.random() * 2, vy: 4 + Math.random() * 10 });
      const g = ctx.createRadialGradient(hx, hy, 0, hx, hy, 28);
      g.addColorStop(0, 'rgba(255,248,225,.95)'); g.addColorStop(.3, 'rgba(255,215,150,.45)'); g.addColorStop(1, 'rgba(255,200,120,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(hx, hy, 28, 0, Math.PI * 2); ctx.fill();
    }
    if (t >= b && starBurst < 0) starBurst = t;
    for (let i = sparks.length - 1; i >= 0; i--) {
      const p = sparks[i];
      p.age += dt; p.y += p.vy * dt;
      if (p.age > p.life) { sparks.splice(i, 1); continue; }
      ctx.fillStyle = `rgba(255,232,190,${(1 - p.age / p.life) * (.55 + .45 * Math.sin(p.age * 18 + i))})`;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
    }
    if (starBurst > 0) {
      const k = t - starBurst, a3 = Math.max(0, 1 - k / 1.8), glow = .22 + .08 * Math.sin(t * 2.2);
      const r = 18 + 60 * a3;
      const g = ctx.createRadialGradient(SPIRE.x, SPIRE.y, 0, SPIRE.x, SPIRE.y, r * 2);
      g.addColorStop(0, `rgba(255,240,205,${Math.max(a3, glow)})`); g.addColorStop(1, 'rgba(255,220,160,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(SPIRE.x, SPIRE.y, r * 2, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = `rgba(255,240,210,${Math.max(a3, glow * .8)})`; ctx.lineWidth = 1.4;
      const L = 14 + 70 * a3;
      ctx.beginPath(); ctx.moveTo(SPIRE.x - L, SPIRE.y); ctx.lineTo(SPIRE.x + L, SPIRE.y); ctx.moveTo(SPIRE.x, SPIRE.y - L * .8); ctx.lineTo(SPIRE.x, SPIRE.y + L * .8); ctx.stroke();
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  // ---------- 카메라 ----------
  function camera(t) {
    // 호수 가운데 낮은 곳 → 배들 위를 지나 성으로 상승 → 그림 전체가 보이는 구도로 안착
    const u = easeInOut(clamp(t / INTRO, 0, 1));
    const c = [bez(420, 1180, W / 2, u), bez(770, 560, H / 2, u), bez(2.15, 1.45, 1.035, u)];
    const idle = smooth(INTRO, INTRO + 3, t);
    c[0] += Math.sin(t * .11) * 10 * idle;
    c[1] += Math.sin(t * .07 + 1) * 5 * idle;
    c[2] += (.012 + Math.sin(t * .05) * .012) * idle;
    return c;
  }

  function resize() {
    if (!canvas || !host) return;
    dpr = Math.min(devicePixelRatio || 1, 2);
    const w = Math.max(1, Math.round(host.clientWidth * dpr)), h = Math.max(1, Math.round(host.clientHeight * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w; canvas.height = h;
      snow.length = 0;
      for (let i = 0; i < 140; i++) snow.push({ x: rand(i) * w, y: rand(i + 500) * h, r: (.5 + rand(i + 900) * 1.5) * dpr, v: 12 + rand(i + 1300) * 24, ph: rand(i + 1700) * 6 });
    }
  }

  function frame(now) {
    raf = requestAnimationFrame(frame);
    if (!ready() || !canvas.width) return;
    const dt = fixedT !== null ? 0 : Math.min(.05, last ? (now - last) / 1000 : 0);
    last = now;
    const t = fixedT !== null ? fixedT : reduce.matches ? INTRO + 4 : (now - start) / 1000;
    let [cx, cy, z] = camera(t);
    let bloom = 0;
    if (entering) {
      const p = clamp((now - entering.at) / 2400, 0, 1), e = easeInOut(p);
      cx = lerp(entering.c[0], WINDOW.x, e);
      cy = lerp(entering.c[1], WINDOW.y, e);
      z = entering.c[2] * Math.pow(7 / entering.c[2], Math.pow(p, 1.8));
      bloom = smooth(.55, 1, p);
      if (p >= 1 && !entering.done) { entering.done = true; setTimeout(entering.cb, 0); }
    }
    const cw = canvas.width, ch = canvas.height;
    const s = Math.max(cw / (W / z), ch / (H / z));
    const hw = cw / 2 / s, hh = ch / 2 / s;
    cx = clamp(cx, hw, W - hw); cy = clamp(cy, hh, H - hh);

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#04070f'; ctx.fillRect(0, 0, cw, ch);
    ctx.setTransform(s, 0, 0, s, cw / 2 - cx * s, ch / 2 - cy * s);
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(base, 0, 0);
    // 달무리
    ctx.globalCompositeOperation = 'lighter';
    let g = ctx.createRadialGradient(MOON.x, MOON.y, 30, MOON.x, MOON.y, 150);
    g.addColorStop(0, `rgba(200,210,235,${.07 + .03 * Math.sin(t * .8)})`); g.addColorStop(1, 'rgba(200,210,235,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(MOON.x, MOON.y, 150, 0, Math.PI * 2); ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    drawFog(t, 0, 820, 470, 190, 8 * wind(t), .45);       // 산자락 안개
    drawWater(t);
    for (const b of boats) drawBoat(b, t);
    for (const b of boats) drawLamps(b, t);
    drawFog(t + 40, 0, 780, WT - 30, 70, 14 * wind(t), .3); // 수면 위 물안개
    drawArc(t, dt);
    if (entering) {
      ctx.globalCompositeOperation = 'lighter';
      const r = 50 + 170 * bloom;
      g = ctx.createRadialGradient(WINDOW.x, WINDOW.y, 0, WINDOW.x, WINDOW.y, r);
      g.addColorStop(0, `rgba(255,214,150,${.25 + .6 * bloom})`); g.addColorStop(1, 'rgba(255,190,110,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(WINDOW.x, WINDOW.y, r, 0, Math.PI * 2); ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
    }

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const w = wind(t);
    ctx.fillStyle = 'rgba(235,240,255,.5)';
    for (const f of snow) {
      f.y += f.v * dpr * dt; f.x += (Math.sin(t * .6 + f.ph) * 6 + 14 * w) * dpr * dt;
      if (f.y > ch) { f.y = -4; f.x = Math.random() * cw; }
      if (f.x > cw) f.x = 0;
      ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2); ctx.fill();
    }
    g = ctx.createRadialGradient(cw / 2, ch / 2, ch * .38, cw / 2, ch / 2, cw * .72);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,6,.5)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, cw, ch);
    const fade = 1 - smooth(0, 2.4, t);
    if (fade > 0) { ctx.fillStyle = `rgba(2,3,8,${fade})`; ctx.fillRect(0, 0, cw, ch); }
    if (bloom > 0) {
      g = ctx.createRadialGradient(cw / 2, ch / 2, 0, cw / 2, ch / 2, cw * .7);
      g.addColorStop(0, `rgba(255,236,196,${bloom * .9})`); g.addColorStop(1, `rgba(255,214,150,${bloom * .45})`);
      ctx.fillStyle = g; ctx.fillRect(0, 0, cw, ch);
      const white = smooth(.6, 1, bloom);
      if (white > 0) { ctx.fillStyle = `rgba(255,246,226,${white})`; ctx.fillRect(0, 0, cw, ch); }
    }
  }

  window.HraOpening = {
    // replay: 다른 장면에서 1페이지로 돌아왔을 때 처음부터 다시 재생
    attach(slideEl, replay) {
      if (!canvas) {
        canvas = document.createElement('canvas');
        canvas.className = 'opening-canvas';
        canvas.setAttribute('aria-hidden', 'true');
        ctx = canvas.getContext('2d');
        ro = new ResizeObserver(resize);
      }
      if (replay || !start) { start = performance.now(); last = 0; sparks.length = 0; starBurst = -1; }
      entering = null;
      host = slideEl;
      host.prepend(canvas);
      ro.disconnect(); ro.observe(host);
      resize();
      host.style.setProperty('--elapsed', (reduce.matches ? 99 : (performance.now() - start) / 1000).toFixed(2) + 's');
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(frame);
    },
    detach() {
      cancelAnimationFrame(raf);
      ro?.disconnect();
      entering = null;
      host = null;
    },
    freeze(t) { fixedT = t; },                     // QA 전용
    unfreeze() { fixedT = null; },
    // 성 안으로 들어가는 전환. 시작했으면 true
    enter(done) {
      if (!host || reduce.matches) return false;
      if (entering) return true;
      const t = (performance.now() - start) / 1000;
      entering = { at: performance.now(), c: camera(t), cb: done, done: false };
      host.classList.add('opening-entering');
      return true;
    },
  };
})();
