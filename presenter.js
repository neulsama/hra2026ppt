const find = id => document.getElementById(id);
const origin = location.protocol === 'file:' ? '*' : location.origin;
const send = (action, text) => window.opener?.postMessage({ hra: 'presenter', action, text }, origin);
const buttons = [...document.querySelectorAll('[data-action]')];
const scoreForm = find('cue-score-form');
const scoreInputs = [...scoreForm.querySelectorAll('input')];
scoreForm.addEventListener('submit', event => {
  event.preventDefault();
  send('scores', scoreInputs.map(input => input.valueAsNumber));
});
buttons.forEach(button => {
  button.disabled = true;
  button.addEventListener('click', () => send(button.dataset.action, find('caption-input').value));
});

let shownIndex = -1;
let lastSeen = 0;
let startedAt = 0;
let digits = '';
let digitTimer;
let total = 26;
const pad = n => String(n).padStart(2, '0');

window.addEventListener('message', event => {
  if (event.source !== window.opener || (origin !== '*' && event.origin !== origin)) return;
  const data = event.data;
  if (data?.hra !== 'stage') return;
  const { index, title, next, actionLabel } = data;
  const [line, direction, caption] = eventCues[index];
  lastSeen = Date.now();
  startedAt ||= lastSeen;
  total = data.total ?? total;
  scoreInputs.forEach((input, i) => { if (document.activeElement !== input) input.value = data.scores[i]; });
  find('connection').textContent = '발표 화면 연결됨 · ' + pad(index + 1) + ' / ' + total;
  find('cue-title').textContent = title;
  find('cue-line').textContent = line;
  find('cue-direction').textContent = direction;
  find('cue-next').textContent = next ? '다음 화면 · ' + next : '마지막 화면';
  if (shownIndex !== index) find('caption-input').value = caption;
  shownIndex = index;
  buttons.forEach(button => { button.disabled = false; });
  const action = find('cue-action');
  action.textContent = actionLabel || '장면 진행';
  action.disabled = !actionLabel;
  document.querySelector('[data-action=prev]').disabled = index === 0;
  document.querySelector('[data-action=next]').disabled = !next;

  const jump = find('cue-jump');
  if (data.agenda && jump.options.length !== data.agenda.length) {
    jump.replaceChildren(...data.agenda.map((name, i) => new Option(pad(i + 1) + '  ' + name, i + 1)));
    jump.disabled = false;
  }
  jump.value = String(index + 1);
  const blank = data.blank;
  find('blank-black').disabled = find('blank-white').disabled = false;
  find('blank-black').textContent = blank === 'black' ? '화면 복귀 (B)' : '검은 화면 (B)';
  find('blank-white').textContent = blank === 'white' ? '화면 복귀 (W)' : '흰 화면 (W)';
  find('blank-state').hidden = !blank;
  find('blank-state').textContent = '● 관객 화면 가림 중 (' + (blank === 'white' ? '흰' : '검은') + ' 화면)';
});

find('cue-jump').addEventListener('change', event => {
  send('goto', Number(event.target.value));
  event.target.blur();
});
find('blank-black').addEventListener('click', () => send('blank', 'black'));
find('blank-white').addEventListener('click', () => send('blank', 'white'));
find('elapsed-reset').addEventListener('click', () => { startedAt = Date.now(); });

// 시계와 경과 시간, 연결 상태
function tick() {
  const now = new Date();
  find('clock').textContent = pad(now.getHours()) + ':' + pad(now.getMinutes());
  if (startedAt) {
    const sec = Math.floor((Date.now() - startedAt) / 1000);
    const h = Math.floor(sec / 3600);
    find('elapsed').textContent = (h ? h + ':' : '') + pad(Math.floor(sec / 60) % 60) + ':' + pad(sec % 60);
  }
  if (lastSeen && Date.now() - lastSeen > 6000) find('connection').textContent = '발표 화면과 연결이 끊겼습니다. 다시 연결하는 중…';
}
tick();
setInterval(tick, 1000);
// 무대가 새로고침되어도 이 창에서 계속 조작할 수 있도록 주기적으로 확인
setInterval(() => send('ping'), 2000);

function showDigits() {
  clearTimeout(digitTimer);
  if (!digits) return;
  find('connection').textContent = '이동할 장면 번호: ' + digits + ' (Enter로 이동)';
  digitTimer = setTimeout(() => { digits = ''; }, 2500);
}

document.addEventListener('keydown', event => {
  if (event.target.matches('input,textarea,select')) return;
  if (event.ctrlKey || event.metaKey || event.altKey || shownIndex < 0) return;
  if (/^[0-9]$/.test(event.key)) {
    digits = (digits + event.key).slice(-2);
    showDigits();
    return;
  }
  if (event.key === 'Enter' && digits) {
    event.preventDefault();
    send('goto', Number(digits));
    digits = '';
    return;
  }
  const blank = { KeyB: 'black', Period: 'black', KeyW: 'white', Comma: 'white' }[event.code];
  if (blank) {
    event.preventDefault();
    if (!event.repeat) send('blank', blank);
    return;
  }
  const action = { ArrowLeft: 'prev', ArrowRight: 'next', PageUp: 'prev', PageDown: 'next', ' ': 'cue' }[event.key];
  if (event.key === 'Home' || event.key === 'End') {
    event.preventDefault();
    send('goto', event.key === 'Home' ? 1 : total);
    return;
  }
  if (!action) return;
  event.preventDefault();
  if (!event.repeat) send(action);
});

// 버튼을 누른 뒤에도 키보드 조작이 계속되도록 포커스를 풀어 준다
document.addEventListener('click', event => {
  const el = event.target.closest('button');
  if (el) setTimeout(() => el.blur(), 0);
}, true);

send('ready');
setTimeout(() => {
  if (shownIndex < 0) find('connection').textContent = '발표 화면에서 사회자 버튼을 눌러 이 창을 열어 주세요.';
}, 1600);
