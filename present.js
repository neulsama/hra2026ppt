// 발표 모드 조작층: 슬라이드 내용은 건드리지 않고 "발표할 때 필요한 동작"만 담당한다.
//  - 발표 시작(F5/버튼): 전체화면 + 상단·하단 바 숨김, 끝나면 원래 화면
//  - 검은/흰 화면(B/W), 숫자+Enter 장면 이동, 단축키 도움말(?)
//  - 가만히 두면 마우스 커서 숨김, 화면 꺼짐 방지, 실수로 창을 닫는 것 방지
//  - 터치 스와이프, 리모컨 호환, 이미지 미리 읽기
(() => {
  const stage = document.getElementById('stage');
  const frame = document.querySelector('.workspace');   // 전체화면 대상: 무대를 감싸는 틀 (창 모드와 같은 규칙으로 그려짐)
  const body = document.body;
  const total = window.HraStage?.total ?? 26;
  let presenting = false, enteredFullscreen = false, idleTimer, lock, digits = '', digitTimer, toast, toastTimer;

  const live = () => presenting || document.fullscreenElement === frame;

  function wake() {
    body.classList.remove('idle');
    clearTimeout(idleTimer);
    if (live()) idleTimer = setTimeout(() => body.classList.add('idle'), 2000);
  }

  async function acquireLock() {
    if (!('wakeLock' in navigator) || lock) return;
    try {
      lock = await navigator.wakeLock.request('screen');
      lock.addEventListener('release', () => { lock = null; });
    } catch { /* 지원하지 않거나 거부됨: 발표는 그대로 가능 */ }
  }

  function refresh() {
    const on = live();
    stage.classList.toggle('live', on);
    if (on) {
      wake();
      acquireLock();
    } else {
      body.classList.remove('idle');
      lock?.release().catch(() => {});
      lock = null;
    }
  }

  function setPresent(on) {
    presenting = on;
    body.classList.toggle('present', on);
    refresh();
    window.HraStage?.notify();
  }

  async function start() {
    setPresent(true);
    if (document.fullscreenElement !== frame) {
      try {
        await frame.requestFullscreen();
        enteredFullscreen = true;
      } catch { /* 전체화면이 막혀도 바 숨김 모드로 발표 가능 */ }
    }
  }

  function stop() {
    enteredFullscreen = false;
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    setPresent(false);
  }

  function setBlank(kind) {
    const current = body.dataset.blank || '';
    const next = kind === current ? '' : kind;
    if (next === 'black' || next === 'white') body.dataset.blank = next;
    else delete body.dataset.blank;
    window.HraStage?.notify();
  }

  function showToast(text) {
    if (live()) return;                       // 관객 화면에는 띄우지 않음
    toast ??= Object.assign(document.createElement('div'), { className: 'toast', role: 'status' });
    toast.textContent = text;
    document.body.append(toast);
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.remove(), 1400);
  }

  function clearDigits() {
    digits = '';
    clearTimeout(digitTimer);
  }

  const MOVE_KEYS = new Set(['ArrowRight', 'ArrowLeft', 'PageDown', 'PageUp', ' ', 'Enter', 'Escape', 'Home', 'End']);
  const BLANK_CODES = { KeyB: 'black', Period: 'black', KeyW: 'white', Comma: 'white' };

  // 캡처 단계: 화면을 가리고 있을 때는 어떤 이동 키든 먼저 화면부터 되돌린다
  document.addEventListener('keydown', event => {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.target.matches?.('input,textarea,select')) return;
    if (event.key === 'F5') {
      event.preventDefault();
      if (!live()) start();
      return;
    }
    if (document.querySelector('dialog[open]')) return;
    const kind = BLANK_CODES[event.code];
    if (kind) {
      event.preventDefault();
      if (!event.repeat) setBlank(kind);
      return;
    }
    if (body.dataset.blank && MOVE_KEYS.has(event.key)) {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (!event.repeat) setBlank('');
      return;
    }
    if (/^[0-9]$/.test(event.key)) {
      digits = (digits + event.key).slice(-2);
      showToast('→ ' + digits);
      clearTimeout(digitTimer);
      digitTimer = setTimeout(clearDigits, 2500);
      return;
    }
    if (event.key === 'Enter' && digits) {
      event.preventDefault();
      const n = Number(digits);
      clearDigits();
      if (n >= 1 && n <= total) window.HraStage.go(n);
      return;
    }
    if (event.key === 'Escape') {
      clearDigits();
      if (presenting && !document.fullscreenElement) {
        event.preventDefault();
        stop();
      }
      return;
    }
    if (event.code === 'KeyH' && !event.repeat) {
      event.preventDefault();
      presenting ? stop() : setPresent(true);
    } else if ((event.key === '?' || (event.code === 'Slash' && event.shiftKey)) && !event.repeat) {
      event.preventDefault();
      document.getElementById('help').showModal();
    }
  }, true);

  document.addEventListener('fullscreenchange', () => {
    if (!document.fullscreenElement && enteredFullscreen) {
      enteredFullscreen = false;
      setPresent(false);
    } else refresh();
  });

  addEventListener('mousemove', wake);
  addEventListener('mousedown', wake);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && live()) acquireLock();
  });
  // 발표 중 실수로 새로고침·닫기 방지 (자동 테스트 브라우저에서는 끔)
  addEventListener('beforeunload', event => {
    if (live() && !navigator.webdriver) {
      event.preventDefault();
      event.returnValue = '';
    }
  });

  // 버튼을 누른 뒤 포커스가 남아 Space가 버튼을 또 누르는 일을 막는다
  document.addEventListener('click', event => {
    const el = event.target.closest('button');
    if (el && !el.closest('dialog')) setTimeout(() => el.blur(), 0);
  }, true);

  // 터치 스와이프 (태블릿으로 넘길 때)
  let sx = null, sy = 0, st = 0;
  stage.addEventListener('pointerdown', event => {
    sx = event.pointerType === 'touch' && !event.target.closest('button,input,video,select,textarea,dialog') ? event.clientX : null;
    sy = event.clientY;
    st = performance.now();
  });
  stage.addEventListener('pointerup', event => {
    if (sx === null) return;
    const dx = event.clientX - sx, dy = event.clientY - sy;
    sx = null;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5 && performance.now() - st < 900) window.HraStage.step(dx < 0 ? 1 : -1);
  });

  document.getElementById('present').addEventListener('click', start);
  document.getElementById('helpbtn').addEventListener('click', () => document.getElementById('help').showModal());

  // 모든 장면 이미지를 한가할 때 미리 읽어 두어 넘길 때 깜빡임을 없앤다
  const warm = [];
  const preload = () => {
    for (let i = 1; i <= total; i++) warm.push(Object.assign(new Image(), { src: './scenes/p' + String(i).padStart(2, '0') + '.webp' }));
    for (const f of ['scenes/parchment.webp', 'scenes/filigree.webp', 'portraits/child.webp', 'portraits/adult.webp',
      'portraits/candidate-1.webp', 'portraits/candidate-2.webp', 'portraits/candidate-3.webp', 'portraits/candidate-4.webp']) warm.push(Object.assign(new Image(), { src: './' + f }));
  };
  if ('requestIdleCallback' in window) requestIdleCallback(preload, { timeout: 4000 });
  else setTimeout(preload, 1500);

  window.HraPresent = { start, stop, setBlank, get presenting() { return presenting; } };
  if (new URLSearchParams(location.search).has('present')) setPresent(true);
})();
