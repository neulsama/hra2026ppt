#!/usr/bin/env python3
"""HRA 발표 자동 점검 도구.

사용법은 qa/README.md 참고. 핵심 명령:
  shot      슬라이드를 원하는 해상도·시각으로 촬영하고 한 장짜리 시트로 묶음
  baseline  슬라이드 26장을 기준 이미지와 픽셀 비교 (내용이 안 바뀌었는지 확인)
  check     공통 검사 + requirements.json 의 요구사항 검사 (PASS/WARN/FAIL)
  motion    영역의 움직임을 시간 순으로 재서 "실제로 움직이는지/얼마나" 수치화
  compare   참조 이미지와 화면을 비교 (SSIM, 차이 지도, 나란히 보기)
  all       baseline + check 를 한 번에

화면 크기와 시간을 고정해서 찍기 때문에 같은 명령은 항상 같은 결과를 냅니다.
"""
import argparse, json, math, os, pathlib, shutil, sys, time
import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
QA = ROOT / 'qa'
OUT = QA / 'out'
BASE = QA / 'baseline'
INDEX = (ROOT / 'index.html').as_uri()
TOTAL = 26
CHROME = next((p for p in ['/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'] if os.path.exists(p)), None)
ARGS = ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required',
        '--force-device-scale-factor=1']

# 발표 모드가 아직 없는 옛 버전에서도 같은 크기로 찍기 위한 대체 CSS
PRESENT_FALLBACK = (".top,.controls{display:none!important}.workspace{padding:0!important}"
                    "body{grid-template-rows:1fr!important}"
                    ".stage{width:min(100vw,calc(100vh*16/9))!important;box-shadow:none!important}")


def parse_size(s):
    w, h = s.lower().split('x')
    return int(w), int(h)


def parse_slides(s):
    if not s or s == 'all':
        return list(range(1, TOTAL + 1))
    out = []
    for part in s.split(','):
        if '-' in part:
            a, b = part.split('-')
            out += list(range(int(a), int(b) + 1))
        else:
            out.append(int(part))
    return out


class Session:
    """브라우저 한 개 + 오류 수집. with 문으로 사용."""

    def __init__(self, size=(1280, 720), mode='present'):
        self.size, self.mode = size, mode
        self.errors, self.warnings, self.failed = [], [], []

    def __enter__(self):
        self.pw = sync_playwright().start()
        self.browser = self.pw.chromium.launch(executable_path=CHROME, args=ARGS)
        self.ctx = self.browser.new_context(viewport={'width': self.size[0], 'height': self.size[1]}, device_scale_factor=1)
        self.page = self.ctx.new_page()
        self._hook(self.page)
        return self

    def _hook(self, page):
        page.on('console', lambda m: self.errors.append(m.text) if m.type == 'error' else None)
        page.on('pageerror', lambda e: self.errors.append('pageerror: ' + str(e)))
        page.on('requestfailed', lambda r: self.failed.append(r.url))

    def __exit__(self, *a):
        self.browser.close()
        self.pw.stop()

    def resize(self, size):
        self.size = size
        self.page.set_viewport_size({'width': size[0], 'height': size[1]})

    def open(self, slide=1, mode=None):
        mode = mode or self.mode
        pg = self.page
        pg.goto(INDEX + ('?present' if mode == 'present' else '') + '#p%d' % slide)
        pg.reload()                                   # 해시만 바뀐 이동과 달리 상태를 완전히 초기화
        pg.wait_for_function("document.querySelector('#slide h1,#slide .opening-titles')")
        if mode == 'present' and not pg.evaluate("!!window.HraPresent"):
            if (ROOT / 'present.js').exists():       # 파일이 있는데 동작하지 않으면 대체 CSS로 덮지 말고 실패로 기록
                self.errors.append('present.js 가 있는데 window.HraPresent 가 만들어지지 않음 (스크립트 오류)')
            else:
                pg.add_style_tag(content=PRESENT_FALLBACK)
        pg.evaluate("document.fonts.ready")
        return pg

    def settle(self, t=None):
        """애니메이션을 끝난 상태(t=None) 또는 t초 시점으로 고정."""
        pg = self.page
        if pg.evaluate("!!document.querySelector('.opening-canvas')"):
            pg.evaluate("t => window.HraOpening.freeze(t)", 14.0 if t is None else float(t))
        pg.evaluate("""t => { for (const a of document.getAnimations()) { try {
            if (t === null) a.finish(); else { a.pause(); a.currentTime = t * 1000; } } catch (e) {} } }""", t)
        pg.wait_for_timeout(450 if pg.evaluate("!!document.querySelector('.opening-canvas')") else 120)

    def stage_png(self, path=None):
        el = self.page.locator('#stage')
        data = el.screenshot(path=str(path) if path else None)
        return data


def png_to_arr(data):
    return cv2.imdecode(np.frombuffer(data, np.uint8), cv2.IMREAD_COLOR)


def label(img, text):
    im = Image.fromarray(cv2.cvtColor(img, cv2.COLOR_BGR2RGB))
    d = ImageDraw.Draw(im)
    d.rectangle([0, 0, 8 + 7 * len(text), 20], fill=(0, 0, 0))
    d.text((4, 3), text, fill=(255, 230, 150))
    return cv2.cvtColor(np.array(im), cv2.COLOR_RGB2BGR)


def sheet(images, labels, cols, tw, path):
    h, w = images[0].shape[:2]
    th = int(h * tw / w)
    rows = math.ceil(len(images) / cols)
    canvas = np.zeros((rows * th, cols * tw, 3), np.uint8)
    for i, (im, lb) in enumerate(zip(images, labels)):
        small = label(cv2.resize(im, (tw, th), interpolation=cv2.INTER_AREA), lb)
        canvas[(i // cols) * th:(i // cols + 1) * th, (i % cols) * tw:(i % cols + 1) * tw] = small
    cv2.imwrite(str(path), canvas, [cv2.IMWRITE_JPEG_QUALITY, 88])


def ssim(a, b):
    a = cv2.cvtColor(a, cv2.COLOR_BGR2GRAY).astype(np.float64)
    b = cv2.cvtColor(b, cv2.COLOR_BGR2GRAY).astype(np.float64)
    C1, C2 = (0.01 * 255) ** 2, (0.03 * 255) ** 2
    k = (11, 11)
    mu1, mu2 = cv2.GaussianBlur(a, k, 1.5), cv2.GaussianBlur(b, k, 1.5)
    s1 = cv2.GaussianBlur(a * a, k, 1.5) - mu1 ** 2
    s2 = cv2.GaussianBlur(b * b, k, 1.5) - mu2 ** 2
    s12 = cv2.GaussianBlur(a * b, k, 1.5) - mu1 * mu2
    m = ((2 * mu1 * mu2 + C1) * (2 * s12 + C2)) / ((mu1 ** 2 + mu2 ** 2 + C1) * (s1 + s2 + C2))
    return float(m.mean())


# ------------------------------------------------------------------ shot
def cmd_shot(a):
    size = parse_size(a.size)
    out = pathlib.Path(a.out or OUT / 'shot')
    out.mkdir(parents=True, exist_ok=True)
    imgs, labels = [], []
    with Session(size, a.mode) as s:
        for n in parse_slides(a.slides):
            s.open(n)
            s.settle(a.t)
            data = s.stage_png(out / ('p%02d.png' % n))
            imgs.append(png_to_arr(data)); labels.append('P%02d' % n)
    if len(imgs) > 1:
        sheet(imgs, labels, a.cols, a.thumb, out / 'sheet.jpg')
    print('저장:', out, '/ 장수', len(imgs))
    if imgs and len(imgs) > 1:
        print('시트:', out / 'sheet.jpg')


# ------------------------------------------------------------------ baseline
BW, BH = 960, 540


def cmd_baseline(a):
    BASE.mkdir(exist_ok=True)
    out = OUT / 'baseline'
    shutil.rmtree(out, ignore_errors=True)
    out.mkdir(parents=True)
    rows, bad = [], 0
    with Session((1280, 720), 'present') as s:
        for n in parse_slides(a.slides):
            s.open(n); s.settle(None)
            cur = cv2.resize(png_to_arr(s.stage_png()), (BW, BH), interpolation=cv2.INTER_AREA)
            ref_path = BASE / ('p%02d.jpg' % n)
            if a.update or not ref_path.exists():
                cv2.imwrite(str(ref_path), cur, [cv2.IMWRITE_JPEG_QUALITY, 90])
                rows.append((n, 'NEW', 0, 1)); continue
            ref = cv2.imread(str(ref_path))
            cur_j = cv2.imdecode(cv2.imencode('.jpg', cur, [cv2.IMWRITE_JPEG_QUALITY, 90])[1], 1)
            mad = float(np.abs(cur_j.astype(int) - ref.astype(int)).mean())
            sm = ssim(cur_j, ref)
            ok = mad < a.tol and sm > 0.985
            rows.append((n, 'OK' if ok else 'DIFF', mad, sm))
            if not ok:
                bad += 1
                diff = np.clip(np.abs(cur_j.astype(int) - ref.astype(int)) * 4, 0, 255).astype(np.uint8)
                cv2.imwrite(str(out / ('p%02d_diff.jpg' % n)), np.hstack([label(ref, 'baseline'), label(cur_j, 'now'), label(diff, 'diff x4')]))
    for n, st, mad, sm in rows:
        print('P%02d %-4s  평균차이 %.2f  SSIM %.4f' % (n, st, mad, sm))
    if a.update:
        print('기준 이미지를 갱신했습니다:', BASE)
    elif bad:
        print('\n내용이 바뀐 슬라이드 %d장. 차이 이미지:' % bad, out)
        return 1
    else:
        print('\n모든 슬라이드가 기준과 같습니다.')
    return 0


# ------------------------------------------------------------------ check
class Report:
    def __init__(self):
        self.items = []

    def add(self, level, id_, msg):
        self.items.append({'level': level, 'id': id_, 'msg': msg})

    def count(self, lv):
        return sum(1 for i in self.items if i['level'] == lv)


JS_TEXT_BOXES = """() => {
  const st = document.getElementById('stage').getBoundingClientRect();
  const out = [];
  const sel = '#slide h1,#slide p,#slide .tile,#slide button,#slide output,#slide strong,#slide .candidate-name,#slide .answer-copy span';
  for (const el of document.querySelectorAll(sel)) {
    if (el.closest('[hidden]') || el.classList.contains('mark')) continue;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) continue;
    const t = (el.innerText || '').trim();
    if (!t) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) continue;
    out.push({ t: t.slice(0, 24), x0: (r.left - st.left) / st.width, y0: (r.top - st.top) / st.height,
               x1: (r.right - st.left) / st.width, y1: (r.bottom - st.top) / st.height,
               fs: parseFloat(cs.fontSize), sw: st.width, tag: el.tagName.toLowerCase(), cls: el.className });
  }
  return out;
}"""


def generic_checks(s, rep, sizes, slides):
    pg = s.page
    for size in sizes:
        s.resize(size)
        tag = '%dx%d' % size
        # 1) 화면 맞춤: 16:9, 여백 없음, 스크롤 없음
        s.open(1); s.settle(None)
        g = pg.evaluate("""() => { const r = document.getElementById('stage').getBoundingClientRect();
          return { w: r.width, h: r.height, x: r.left, y: r.top, vw: innerWidth, vh: innerHeight,
                   sx: document.documentElement.scrollWidth > innerWidth, sy: document.documentElement.scrollHeight > innerHeight }; }""")
        ratio = g['w'] / g['h']
        rep.add('PASS' if abs(ratio - 16 / 9) < 0.01 else 'FAIL', 'fit/ratio@' + tag, '무대 비율 %.3f (16:9=1.778)' % ratio)
        fills = (abs(g['w'] - g['vw']) < 1.5 and g['h'] <= g['vh'] + 1.5) or (abs(g['h'] - g['vh']) < 1.5 and g['w'] <= g['vw'] + 1.5)
        rep.add('PASS' if fills else 'FAIL', 'fit/fill@' + tag, '발표 모드에서 무대가 창을 꽉 채움 (무대 %.0fx%.0f / 창 %dx%d)' % (g['w'], g['h'], g['vw'], g['vh']))
        rep.add('PASS' if not (g['sx'] or g['sy']) else 'FAIL', 'fit/scroll@' + tag, '스크롤바 없음')
        # 2) 슬라이드별 글자가 안전 영역 안에 있는지, 너무 작은 글자가 있는지
        for n in slides:
            s.open(n); s.settle(None)
            boxes = pg.evaluate(JS_TEXT_BOXES)
            out = [b for b in boxes if b['x0'] < 0.03 or b['y0'] < 0.03 or b['x1'] > 0.97 or b['y1'] > 0.97]
            if out:
                rep.add('FAIL', 'layout/safe-area P%02d@%s' % (n, tag), '안전 영역(3%%)을 벗어난 글자: ' + ', '.join('“%s”' % b['t'] for b in out[:4]))
            if size == sizes[0]:
                small = [b for b in boxes if b['fs'] / b['sw'] * 1920 < 18]
                if small:
                    rep.add('WARN', 'legibility P%02d' % n, '1080p 기준 18px 미만 글자: ' + ', '.join('“%s” %.0fpx' % (b['t'], b['fs'] / b['sw'] * 1920) for b in small[:3]))
    return


def functional_checks(s, rep):
    pg = s.page
    s.resize((1280, 720))
    # 글꼴
    s.open(2); s.settle(None)
    ok = pg.evaluate("document.fonts.check('700 20px Gowun')")
    rep.add('PASS' if ok else 'FAIL', 'font/loaded', '고운바탕 글꼴 로드')
    # 키보드 이동
    s.open(1); s.settle(None)
    def hash_():
        return pg.evaluate('location.hash')
    pg.keyboard.press('End'); pg.wait_for_timeout(200)
    rep.add('PASS' if hash_() == '#p26' else 'FAIL', 'nav/end', 'End → 마지막 장 (%s)' % hash_())
    pg.keyboard.press('Home'); pg.wait_for_timeout(200)
    rep.add('PASS' if hash_() == '#p1' else 'FAIL', 'nav/home', 'Home → 첫 장 (%s)' % hash_())
    pg.evaluate("location.hash='#p5'"); pg.wait_for_timeout(200)
    pg.keyboard.press('ArrowRight'); pg.wait_for_timeout(200)
    pg.keyboard.press('PageDown'); pg.wait_for_timeout(200)
    pg.keyboard.press('ArrowLeft'); pg.wait_for_timeout(200)
    rep.add('PASS' if hash_() == '#p6' else 'FAIL', 'nav/arrows', '5→→PageDown←= 6 (%s)' % hash_())
    # 1→2 은 성 안으로 들어가는 전환 후 이동
    s.open(1); s.settle(None); pg.evaluate("window.HraOpening.unfreeze()")
    pg.keyboard.press('ArrowRight')
    pg.wait_for_function("location.hash === '#p2'", timeout=6000)
    rep.add('PASS', 'nav/p1-to-p2', 'P1 → P2 전환 완료')
    # 현재 기능이 있을 때만 검사하는 항목
    if pg.evaluate("!!window.HraPresent"):
        s.open(3)
        pg.keyboard.press('b'); pg.wait_for_timeout(100)
        black = pg.evaluate("document.body.dataset.blank")
        rep.add('PASS' if black == 'black' else 'FAIL', 'present/blackout', 'B → 검은 화면 (%s)' % black)
        pg.keyboard.press('ArrowRight'); pg.wait_for_timeout(150)
        still = pg.evaluate("[document.body.dataset.blank || '', location.hash]")
        rep.add('PASS' if still == ['', '#p3'] else 'FAIL', 'present/blackout-release', '검은 화면에서 → 는 화면만 복귀 (%s)' % still)
        pg.keyboard.press('w'); pg.wait_for_timeout(100)
        rep.add('PASS' if pg.evaluate("document.body.dataset.blank") == 'white' else 'FAIL', 'present/whiteout', 'W → 흰 화면')
        pg.keyboard.press('w'); pg.wait_for_timeout(100)
        # 한글 입력 상태: 키 값은 'ㅠ' 이지만 물리 키는 KeyB — 그래도 동작해야 함
        for key, code in [('ㅠ', 'KeyB')]:
            pg.dispatch_event('body', 'keydown', {'key': key, 'code': code, 'bubbles': True}); pg.wait_for_timeout(100)
        was = pg.evaluate("document.body.dataset.blank || ''")
        rep.add('PASS' if was == 'black' else 'FAIL', 'present/ime-key', '한글 입력 상태(ㅠ/KeyB)에서도 검은 화면 (%s)' % was)
        pg.dispatch_event('body', 'keydown', {'key': 'ㅠ', 'code': 'KeyB', 'bubbles': True}); pg.wait_for_timeout(100)
        for k in ['1', '2', 'Enter']:
            pg.keyboard.press(k)
        pg.wait_for_timeout(300)
        rep.add('PASS' if hash_() == '#p12' else 'FAIL', 'present/number-jump', '1,2,Enter → 12장 (%s)' % hash_())
        hidden = pg.evaluate("[getComputedStyle(document.querySelector('.top')).display, getComputedStyle(document.querySelector('.controls')).display]")
        rep.add('PASS' if hidden == ['none', 'none'] else 'FAIL', 'present/chrome-hidden', '발표 모드에서 상단·하단 바 숨김 (%s)' % hidden)
        pg.keyboard.press('Escape'); pg.wait_for_timeout(200)
        shown = pg.evaluate("getComputedStyle(document.querySelector('.top')).display")
        rep.add('PASS' if shown != 'none' else 'FAIL', 'present/esc-exit', 'Esc → 발표 모드 해제')
        # 커서 숨김
        pg.keyboard.press('h'); pg.wait_for_timeout(100)
        pg.mouse.move(300, 300); pg.wait_for_timeout(2600)
        cur = pg.evaluate("document.body.classList.contains('idle')")
        rep.add('PASS' if cur else 'FAIL', 'present/cursor-idle', '가만히 두면 커서 숨김')
        pg.mouse.move(310, 310); pg.wait_for_timeout(150)
        rep.add('PASS' if not pg.evaluate("document.body.classList.contains('idle')") else 'FAIL', 'present/cursor-wake', '마우스를 움직이면 커서 복귀')
    if pg.evaluate("!!window.HraPresent"):
        # 실제 전체화면(F5)이 창 모드와 같은 그림인지: 글자 크기·배치가 달라지면 안 됨
        for size in [(1280, 720), (1366, 768), (1024, 768)]:
            s.resize(size)
            for n in (3, 16):
                s.open(n, mode='normal'); s.settle(None)
                s.page.evaluate("document.body.classList.add('present')")     # 창 모드 쪽 기준: 바만 숨김
                s.page.wait_for_timeout(150)
                win = png_to_arr(s.stage_png())
                s.page.evaluate("document.body.classList.remove('present')")
                s.page.keyboard.press('F5')
                s.page.wait_for_function("!!document.fullscreenElement", timeout=4000); s.page.wait_for_timeout(300)
                s.settle(None)
                full = png_to_arr(s.stage_png())
                sm = ssim(win, full) if win.shape == full.shape else 0
                rep.add('PASS' if sm > 0.99 else 'FAIL', 'present/fullscreen-same@%dx%d P%02d' % (size[0], size[1], n),
                        '전체화면과 창 모드 화면 일치 (SSIM %.4f, 크기 %s vs %s)' % (sm, win.shape[1::-1], full.shape[1::-1]))
                s.page.keyboard.press('Escape'); s.page.wait_for_timeout(250)
        s.resize((1280, 720))
    # 사회자 창 연동
    s.open(2, mode='normal')
    with pg.expect_popup() as pop:
        pg.click('#presenter')
    pw = pop.value
    s._hook(pw)
    pw.wait_for_function("document.getElementById('connection').textContent.includes('연결됨')", timeout=5000)
    rep.add('PASS', 'presenter/connect', '사회자 창 연결')
    pw.click('[data-action=next]'); pg.wait_for_timeout(400)
    rep.add('PASS' if hash_() == '#p3' else 'FAIL', 'presenter/next', '사회자 창 “다음” → 무대 3장 (%s)' % hash_())
    shown = pw.evaluate("document.getElementById('cue-title').textContent")
    rep.add('PASS' if shown else 'FAIL', 'presenter/title', '사회자 창에 현재 장 제목 표시 (%s)' % shown)
    # 봉인 열기 (큐 공개) 흐름: p02 는 큐를 기다리는 상태로 시작해야 함
    pw.evaluate("document.querySelector('[data-action=prev]').click()"); pg.wait_for_timeout(400)
    waiting = pg.evaluate("document.getElementById('slide').classList.contains('awaiting-cue')")
    rep.add('PASS' if waiting else 'FAIL', 'presenter/await-cue', 'P02 는 사회자 큐를 기다림')
    pw.click('#cue-action'); pg.wait_for_timeout(400)
    waiting = pg.evaluate("document.getElementById('slide').classList.contains('awaiting-cue')")
    rep.add('PASS' if not waiting else 'FAIL', 'presenter/reveal', '큐 실행 → 공개')
    if pg.evaluate("!!window.HraPresent"):
        pw.keyboard.press('b'); pg.wait_for_timeout(300)
        rep.add('PASS' if pg.evaluate("document.body.dataset.blank") == 'black' else 'FAIL', 'presenter/blackout', '사회자 창 B → 무대 검은 화면')
        pw.keyboard.press('b'); pg.wait_for_timeout(200)
        # 무대 새로고침 후 자동 재연결
        pg.reload(); pg.wait_for_timeout(500)
        try:
            pw.wait_for_function("document.getElementById('connection').textContent.includes('연결됨')", timeout=6000)
            pw.click('[data-action=next]'); pg.wait_for_timeout(500)
            moved = pg.evaluate('location.hash')
            rep.add('PASS' if moved == '#p3' else 'FAIL', 'presenter/reconnect', '무대 새로고침 뒤에도 사회자 조작 가능 (%s)' % moved)
        except Exception as e:
            rep.add('FAIL', 'presenter/reconnect', '무대 새로고침 뒤 재연결 실패: %s' % str(e)[:60])
    pw.close()


def eval_requirements(s, rep, only=None):
    path = QA / 'requirements.json'
    if not path.exists():
        return
    reqs = json.loads(path.read_text(encoding='utf-8'))['requirements']
    pg = s.page
    for r in reqs:
        if only and r['id'] not in only:
            continue
        try:
            w, h = r.get('viewport', [1920, 1080])
            s.resize((w, h))
            s.open(r.get('slide', 1))
            t = r.get('t')
            s.settle(t if t is not None else None)
            kind = r['type']
            if kind == 'text':
                got = pg.evaluate("sel => (document.querySelector(sel)||{}).innerText || ''", r['selector']).strip()
                ok = got == r['equals']
                rep.add('PASS' if ok else 'FAIL', r['id'], '%s → “%s”' % (r['desc'], got))
            elif kind == 'fontPx':
                got = pg.evaluate("sel => parseFloat(getComputedStyle(document.querySelector(sel)).fontSize)", r['selector'])
                ok = abs(got - r['px']) <= r.get('tol', 1)
                rep.add('PASS' if ok else 'FAIL', r['id'], '%s → %.2fpx (목표 %.2fpx)' % (r['desc'], got, r['px']))
            elif kind == 'exists':
                got = pg.evaluate("sel => !!document.querySelector(sel)", r['selector'])
                rep.add('PASS' if got else 'FAIL', r['id'], r['desc'])
            elif kind == 'js':
                got = pg.evaluate(r['expr'])
                ok = got == r.get('equals', True)
                rep.add('PASS' if ok else 'FAIL', r['id'], '%s → %s' % (r['desc'], got))
            elif kind == 'motion':
                res = measure_motion(s, r['slide'], r['t0'], r['dur'], r.get('fps', 4), r['region'], r.get('size'))
                lo, hi = r.get('minMeanDiff', 0), r.get('maxMeanDiff', 255)
                ok = lo <= res['meanDiff'] <= hi
                rep.add('PASS' if ok else 'FAIL', r['id'], '%s → 평균 변화 %.2f (허용 %.2f~%.2f), 최대 이동 %.1fpx' % (r['desc'], res['meanDiff'], lo, hi, res['maxShiftPx']))
            elif kind == 'shot':
                pass
        except Exception as e:  # 한 항목이 깨져도 나머지는 계속
            rep.add('FAIL', r['id'], '검사 중 오류: %s' % str(e)[:100])


def cmd_check(a):
    sizes = [parse_size(x) for x in a.sizes.split(',')]
    slides = parse_slides(a.slides)
    rep = Report()
    with Session(sizes[0], 'present') as s:
        generic_checks(s, rep, sizes, slides)
        functional_checks(s, rep)
        eval_requirements(s, rep, a.only.split(',') if a.only else None)
        for m in sorted(set(s.errors)):
            rep.add('FAIL', 'console/error', m[:140])
        if s.failed:
            rep.add('FAIL', 'network/failed', ', '.join(sorted(set(s.failed)))[:200])
    write_report(rep, 'check')
    return 1 if rep.count('FAIL') else 0


def write_report(rep, name):
    OUT.mkdir(exist_ok=True)
    (OUT / (name + '.json')).write_text(json.dumps(rep.items, ensure_ascii=False, indent=1), encoding='utf-8')
    lines = ['# QA 결과  PASS %d / WARN %d / FAIL %d' % (rep.count('PASS'), rep.count('WARN'), rep.count('FAIL')), '']
    for lv in ['FAIL', 'WARN', 'PASS']:
        for i in rep.items:
            if i['level'] == lv:
                lines.append('- [%s] %s — %s' % (lv, i['id'], i['msg']))
    (OUT / (name + '.md')).write_text('\n'.join(lines), encoding='utf-8')
    print('\n'.join(l for l in lines if not l.startswith('- [PASS]')))
    print('(PASS 상세: %s)' % (OUT / (name + '.md')))


# ------------------------------------------------------------------ motion
def region_px(region, w, h):
    x0, y0, x1, y1 = region
    if max(region) <= 1.0:
        x0, x1, y0, y1 = x0 * w, x1 * w, y0 * h, y1 * h
    return int(x0), int(y0), int(x1), int(y1)


def measure_motion(s, slide, t0, dur, fps, region, size=None, keep=None):
    s.open(slide)
    pg = s.page
    frames = []
    n = int(dur * fps) + 1
    for i in range(n):
        t = t0 + i / fps
        s.settle(t)
        im = png_to_arr(s.stage_png())
        h, w = im.shape[:2]
        x0, y0, x1, y1 = region_px(region, w, h)
        frames.append(im[y0:y1, x0:x1].copy())
    diffs, shifts = [], []
    for a, b in zip(frames, frames[1:]):
        diffs.append(float(np.abs(a.astype(int) - b.astype(int)).mean()))
        ga, gb = [np.float32(cv2.cvtColor(x, cv2.COLOR_BGR2GRAY)) for x in (a, b)]
        (dx, dy), _ = cv2.phaseCorrelate(ga, gb)
        shifts.append((dx, dy))
    # 첫 프레임 기준 누적 이동량 (배가 오르내린 폭)
    ref = np.float32(cv2.cvtColor(frames[0], cv2.COLOR_BGR2GRAY))
    off = []
    for f in frames:
        (dx, dy), _ = cv2.phaseCorrelate(ref, np.float32(cv2.cvtColor(f, cv2.COLOR_BGR2GRAY)))
        off.append((dx, dy))
    ys = [o[1] for o in off]
    res = {'meanDiff': float(np.mean(diffs)), 'maxDiff': float(np.max(diffs)),
           'maxShiftPx': float(max(abs(o[0]) for o in off) if False else max(ys) - min(ys)),
           'xRangePx': float(max(o[0] for o in off) - min(o[0] for o in off)), 'frames': len(frames)}
    if keep is not None:
        keep.extend(frames)
    return res


def cmd_motion(a):
    size = parse_size(a.size)
    region = [float(x) for x in a.region.split(',')]
    out = OUT / 'motion'
    out.mkdir(parents=True, exist_ok=True)
    frames = []
    with Session(size, 'present') as s:
        res = measure_motion(s, a.slide, a.t0, a.dur, a.fps, region, keep=frames)
    print(json.dumps(res, ensure_ascii=False, indent=1))
    labels = ['t=%.2f' % (a.t0 + i / a.fps) for i in range(len(frames))]
    cols = min(4, len(frames))
    sheet(frames, labels, cols, max(240, 1280 // cols), out / ('p%02d_motion.jpg' % a.slide))
    # 연속 프레임 차이 지도: 어디가 움직였는지
    acc = np.zeros(frames[0].shape[:2], np.float32)
    for x, y in zip(frames, frames[1:]):
        acc += np.abs(x.astype(np.float32) - y.astype(np.float32)).mean(2)
    acc = np.clip(acc / max(1, len(frames) - 1) * 12, 0, 255).astype(np.uint8)
    cv2.imwrite(str(out / ('p%02d_heat.png' % a.slide)), cv2.applyColorMap(acc, cv2.COLORMAP_INFERNO))
    print('필름스트립:', out / ('p%02d_motion.jpg' % a.slide), '\n움직임 지도:', out / ('p%02d_heat.png' % a.slide))


# ------------------------------------------------------------------ compare
def cmd_compare(a):
    size = parse_size(a.size)
    ref = cv2.imread(a.ref)
    if ref is None:
        sys.exit('참조 이미지를 열 수 없습니다: ' + a.ref)
    with Session(size, 'present') as s:
        s.open(a.slide); s.settle(a.t)
        cur = png_to_arr(s.stage_png())
    if a.region:
        rg = [float(x) for x in a.region.split(',')]
        x0, y0, x1, y1 = region_px(rg, cur.shape[1], cur.shape[0])
        cur = cur[y0:y1, x0:x1]
        rx0, ry0, rx1, ry1 = region_px(rg, ref.shape[1], ref.shape[0])
        ref = ref[ry0:ry1, rx0:rx1]
    h = min(cur.shape[0], 720)
    w = int(h * cur.shape[1] / cur.shape[0])
    cur_r = cv2.resize(cur, (w, h), interpolation=cv2.INTER_AREA)
    ref_r = cv2.resize(ref, (w, h), interpolation=cv2.INTER_AREA)
    sm = ssim(cur_r, ref_r)
    mad = float(np.abs(cur_r.astype(int) - ref_r.astype(int)).mean())
    hc = [cv2.calcHist([x], [c], None, [32], [0, 256]) for x in (cur_r, ref_r) for c in range(3)]
    corr = float(np.mean([cv2.compareHist(hc[c], hc[c + 3], cv2.HISTCMP_CORREL) for c in range(3)]))
    diff = np.clip(np.abs(cur_r.astype(int) - ref_r.astype(int)) * 3, 0, 255).astype(np.uint8)
    out = OUT / 'compare'
    out.mkdir(parents=True, exist_ok=True)
    path = out / ('p%02d_vs_ref.jpg' % a.slide)
    cv2.imwrite(str(path), np.hstack([label(ref_r, 'reference'), label(cur_r, 'now'), label(diff, 'diff x3')]), [cv2.IMWRITE_JPEG_QUALITY, 88])
    print('SSIM %.3f  평균차이 %.1f  색분포 상관 %.3f' % (sm, mad, corr))
    print('나란히 보기:', path)


# ------------------------------------------------------------------ selftest
def cmd_selftest(a):
    """검사기 자체가 문제를 잡아내는지 확인: 일부러 망가뜨린 화면에서 FAIL/감지가 나와야 통과."""
    res = []
    def expect(name, cond, detail=''):
        res.append(cond); print(('OK   ' if cond else 'MISS ') + name + (' — ' + detail if detail else ''))
    with Session((1280, 720), 'present') as s:
        pg = s.page
        # 1) 글자가 화면 밖으로 나가면 안전 영역 검사가 잡는가
        s.open(2); s.settle(None)
        pg.add_style_tag(content='#slide h1{position:relative;left:85%}')
        boxes = pg.evaluate(JS_TEXT_BOXES)
        expect('안전 영역 이탈 감지', any(b['x1'] > 0.97 for b in boxes))
        # 2) 기준 이미지 비교가 색 하나 바뀐 것도 잡는가
        s.open(2); s.settle(None)
        pg.add_style_tag(content='#slide h1{color:#ff2020!important}')
        cur = cv2.resize(png_to_arr(s.stage_png()), (BW, BH), interpolation=cv2.INTER_AREA)
        ref = cv2.imread(str(BASE / 'p02.jpg'))
        mad = float(np.abs(cur.astype(int) - ref.astype(int)).mean())
        expect('기준 이미지 비교가 제목 색 변경을 감지', mad > 0.3 or ssim(cur, ref) < 0.985, 'MAD %.2f SSIM %.4f' % (mad, ssim(cur, ref)))
        # 3) 움직임 측정: 정지한 곳(하늘 왼쪽)은 거의 0, 물결은 뚜렷이 > 0
        still = measure_motion(s, 1, 11, 2, 4, [0.02, 0.05, 0.25, 0.3])
        water = measure_motion(s, 1, 11, 2, 4, [0.45, 0.78, 0.7, 0.97])
        expect('움직임 측정: 정지 영역은 거의 0', still['meanDiff'] < 0.35, '%.3f' % still['meanDiff'])
        expect('움직임 측정: 물결은 뚜렷이 움직임', water['meanDiff'] > 3 * max(still['meanDiff'], 0.05), '물 %.3f / 정지 %.3f' % (water['meanDiff'], still['meanDiff']))
        # 4) 같은 장면은 SSIM 1, 다른 장면은 낮음
        s.open(1); s.settle(12); a1 = png_to_arr(s.stage_png())
        s.settle(12); a2 = png_to_arr(s.stage_png())
        s.open(2); s.settle(None); b1 = png_to_arr(s.stage_png())
        expect('SSIM: 같은 장면 > 0.99', ssim(a1, a2) > 0.99, '%.4f' % ssim(a1, a2))
        expect('SSIM: 다른 장면 < 0.6', ssim(a1, b1) < 0.6, '%.4f' % ssim(a1, b1))
        # 5) 글자 크기 측정이 실제 값을 읽는가 (1920 기준 80px)
        s.resize((1920, 1080)); s.open(1); s.settle(None)
        px = pg.evaluate("parseFloat(getComputedStyle(document.querySelector('.opening-titles h1')).fontSize)")
        expect('글자 크기 측정 (60pt = 80px)', abs(px - 80) < 1, '%.2fpx' % px)
    print('\n자가 검증 %d/%d 통과' % (sum(res), len(res)))
    return 0 if all(res) else 1


def cmd_all(a):
    r = cmd_baseline(argparse.Namespace(slides='all', update=False, tol=1.0))
    class A: pass
    c = A(); c.sizes = a.sizes; c.slides = 'all'; c.only = None
    return r or cmd_check(c)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest='cmd', required=True)
    p = sub.add_parser('shot'); p.add_argument('--slides', default='all'); p.add_argument('--size', default='1920x1080')
    p.add_argument('--t', type=float, default=None, help='P01 같은 연출 장면의 시각(초). 생략하면 끝난 상태')
    p.add_argument('--mode', default='present', choices=['present', 'normal']); p.add_argument('--out'); p.add_argument('--cols', type=int, default=4)
    p.add_argument('--thumb', type=int, default=480); p.set_defaults(fn=cmd_shot)
    p = sub.add_parser('baseline'); p.add_argument('--slides', default='all'); p.add_argument('--update', action='store_true')
    p.add_argument('--tol', type=float, default=1.0); p.set_defaults(fn=cmd_baseline)
    p = sub.add_parser('check'); p.add_argument('--sizes', default='1920x1080,1366x768,1280x720,1024x768')
    p.add_argument('--slides', default='all'); p.add_argument('--only', help='requirements.json 의 id 만 (쉼표)'); p.set_defaults(fn=cmd_check)
    p = sub.add_parser('motion'); p.add_argument('--slide', type=int, default=1); p.add_argument('--t0', type=float, default=11)
    p.add_argument('--dur', type=float, default=4); p.add_argument('--fps', type=float, default=4)
    p.add_argument('--region', required=True, help='x0,y0,x1,y1 (0~1 비율 또는 px)'); p.add_argument('--size', default='1280x720'); p.set_defaults(fn=cmd_motion)
    p = sub.add_parser('compare'); p.add_argument('ref'); p.add_argument('--slide', type=int, default=1); p.add_argument('--t', type=float, default=None)
    p.add_argument('--size', default='1280x720'); p.add_argument('--region'); p.set_defaults(fn=cmd_compare)
    p = sub.add_parser('selftest'); p.set_defaults(fn=cmd_selftest)
    p = sub.add_parser('all'); p.add_argument('--sizes', default='1920x1080,1366x768,1280x720,1024x768'); p.set_defaults(fn=cmd_all)
    a = ap.parse_args()
    sys.exit(a.fn(a) or 0)


if __name__ == '__main__':
    main()
