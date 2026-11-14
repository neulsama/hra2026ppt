const slides = [
  ['입장 대기', 'HRA 2026 Year-End Party', 'welcome to hra-wart', 'hero opening'], // 0
  ['', '', '', 'wine', 'owl-parchment'], // 1: 2페이지 입학 축하 (부엉이 + 양피지 언롤)
  ['', '내빈 소개', '', 'wine', 'guests'], // 2: 3페이지 내빈 소개 (정하늘 교수님 대형 학생증)
  ['기숙사 배정', '네 기숙사, 하나의 연회', '오늘 밤 함께 기숙사 컵에 도전합니다.', 'wine', 'banners'], // 3
  ['암전', '', '', 'blackout', 'blackout'], // 4
  ['1부 · 퀴즈', '20기를 맞혀라', '활동 사진과 함께하는 전반기 퀴즈 대항전', 'hero', 'quiz-intro'], // 5
  ['20기를 맞춰라 · 문제 01', '전반기에 가장 많이 발표한 사람은?', '기숙사별로 상의한 뒤 후보를 선택하세요.', '', 'quiz'], // 6
  ['20기를 맞춰라 · 정답 01', '정답 공개', '', 'paper', 'answer'], // 7
  ['잠시 숨고르기', '', '', 'hero interlude', 'interlude'], // 8
  ['교수님을 맞혀라', '타임캡슐 속 어린 시절', '교수님의 어린 시절 사진을 보고 누구인지 맞혀보세요.', 'wine', 'photo-intro'], // 9
  ['교수님을 맞혀라 · 문제 02', '이 어린이는 누구일까요?', '', '', 'photo'], // 10
  ['교수님을 맞혀라 · 정답 02', '정답 공개', '', 'paper', 'photo'], // 11
  ['크리스마스 만찬', 'Time for dinner', '함께 식사하며 오늘의 이야기를 나눠 주세요.', 'wine', '✦'], // 12
  ['20기 활동 영상', '전반기 활동 영상', 'HRA 20기의 전반기 활동을 돌아봅니다.', '', 'video'], // 13
  ['2부 · 교류 빙고', '이름 빙고', '종이 빙고판에 알맞은 사람을 적으세요.', 'paper', 'bingo'], // 14
  ['2부 · 빙고 진행', '제한 시간 15분', '', '', 'timer15'], // 15
  ['2부 · 물약병 볼링', '', '', '', 'scores-large'], // 16
  ['2부 · 최종 우승', '영예의 1위 기숙사', '2026 HRA 기숙사 컵 우승을 축하합니다!', 'wine', 'champion'], // 17
  ['휴식', 'Break Time', '10분 뒤 3부 명예의 전당에서 만나요.', 'hero', 'timer10'], // 18
  ['3부 · 시상식', '명예의 전당', '새로운 문이 열리고 영예로운 순간이 시작됩니다.', 'wine', 'awards-gate'], // 19
  ['부문별 시상', '영광의 수상자', '부엉이가 전해온 명예의 양피지', 'paper', 'ballroom'], // 20
  ['귀빈 말씀', '감사와 격려의 말씀', '교수님 격려 말씀 · 위원장 마무리 인사', '', '✧'], // 21
  ['기념 촬영', 'Happy 2026 HRA Year-End Party', 'Happy Christmas, HRA', 'hero photo-star'], // 22
  ['폐회', '다음 목적지를 향해서', '오늘 밤의 여정에 함께해 주셔서 감사합니다.', 'hero'], // 23
];

const houses = [
  { name: '그리핀도르', color: '#bc626b', crest: '🦁', desc: '용기와 결단' },
  { name: '슬리데린', color: '#62a88f', crest: '🐍', desc: '야망과 지혜' },
  { name: '래번클로', color: '#739dd5', crest: '🦅', desc: '지성과 창의' },
  { name: '후플푸프', color: '#e0b85b', crest: '🦡', desc: '성실과 헌신' },
];
const get = id => document.getElementById(id);
const storeKey = 'hra-live-slides-v2';
const defaultGuests = [
  { name: '정하늘', role: '지도 교수 · 언론홍보학부', photo: './portraits/candidate-2.webp' },
  { name: '허영준', role: '지도 교수 · 경영학부', photo: './portraits/candidate-1.webp' },
  { name: '김도아', role: 'HRA 멘토 위원', photo: './portraits/candidate-3.webp' },
  { name: '송채은', role: 'HRA 총동문회 선배', photo: './portraits/candidate-4.webp' },
  { name: '박지성', role: 'HRA 20기 대표', photo: './portraits/candidate-1.webp' },
  { name: '김강민', role: 'HRA 20기 부대표', photo: './portraits/candidate-4.webp' }
];
const initialState = {
  scores: [120, 95, 140, 110],
  guests: defaultGuests,
};
let state = readState();
if (!state.guests || !state.guests.some(g => g.name === '정하늘')) {
  state.guests = defaultGuests;
}
let index = 0;
let countdown;
let memory = 1;
const mediaFiles = new Map();
const photoAnswerNames = new Map();
const slide = get('slide');
let presenterWindow;
let staged = false;
let revealed = false;
let captionJob;
let lastRendered = -1;
const revealLabels = new Map([[1, '양피지 펼치기'], [7, '정답 공개'], [11, '현재 사진 공개'], [17, '1위 기숙사 공개'], [20, '양피지 공개']]);
const cueLabels = new Map([[2, '다음 교수님'], [10, '15초 시작'], [13, '영상 재생'], [15, '15분 시작'], [18, '10분 시작']]);
const origin = location.protocol === 'file:' ? '*' : location.origin;
const candidates = ['정하늘', '허영준', '김도아', '송채은'];
const correctCandidate = 0;
const answerPages = new Set([7, 11]);
let chosenCandidate = null;
let answerLocked = false;

function readState() {
  try {
    return JSON.parse(localStorage.getItem(storeKey)) ?? structuredClone(initialState);
  } catch {
    return structuredClone(initialState);
  }
}

function save() {
  try {
    localStorage.setItem(storeKey, JSON.stringify(state));
  } catch {
    // This tab can continue the demo when browser storage is unavailable.
  }
}

function node(tag, content, className) {
  const el = document.createElement(tag);
  if (content) el.textContent = content;
  if (className) el.className = className;
  return el;
}

function button(label, action) {
  const el = node('button', label);
  el.type = 'button';
  el.addEventListener('click', action);
  return el;
}

function tiles(parent, entries, className = '') {
  const list = node('div', '', 'tiles ' + className);
  for (const [title, detail, accent] of entries) {
    const item = node('div', '', 'tile');
    item.append(node('strong', title));
    if (detail) item.append(node('span', detail));
    if (accent) item.style.setProperty('--house', accent);
    list.append(item);
  }
  parent.append(list);
}

function choices(parent, labels, action) {
  const list = node('div', '', 'tiles');
  labels.forEach((label, i) => {
    const choice = button(label, () => {
      for (const other of list.children) other.setAttribute('aria-pressed', String(other === choice));
      action?.(i);
    });
    choice.setAttribute('aria-pressed', 'false');
    list.append(choice);
  });
  parent.append(list);
}

function timer(parent, duration) {
  const wrapper = node('div', '', 'timer');
  const output = node('output');
  const progress = node('progress');
  progress.max = duration;
  progress.setAttribute('aria-label', '남은 시간');
  let remaining = duration;
  const draw = () => {
    output.textContent = String(Math.floor(remaining / 60)).padStart(2, '0') + ':' + String(remaining % 60).padStart(2, '0');
    output.style.color = remaining < 60 && duration >= 60 ? '#ff9696' : '';
    progress.value = remaining;
  };
  const start = button('시작', () => {
    if (countdown || remaining === 0) return;
    const end = Date.now() + remaining * 1000;
    countdown = setInterval(() => {
      remaining = Math.max(0, Math.ceil((end - Date.now()) / 1000));
      draw();
      if (!remaining) stopTimer();
    }, 150);
  });
  start.dataset.cue = 'true';
  const reset = button('초기화', () => {
    stopTimer();
    remaining = duration;
    draw();
  });
  wrapper.append(output, start, reset);
  if (duration === 15) wrapper.append(progress);
  parent.append(wrapper);
  draw();
}

function stopTimer() {
  clearInterval(countdown);
  countdown = undefined;
}

function media(parent, video, label) {
  const wrapper = node('div', '', 'media');
  const asset = node(video ? 'video' : 'img');
  const key = index + ':' + (video ? 'video' : memory);
  const sample = index === 10 ? './portraits/child.webp' : index === 11 ? './portraits/adult.webp' : undefined;
  const saved = mediaFiles.get(key) ?? sample;
  asset.hidden = !saved;
  if (saved) asset.src = saved;
  if (video) {
    asset.controls = true;
    asset.playsInline = true;
  } else {
    asset.alt = label;
    asset.className = 'photo-demo';
  }
  const younger = index === 11 ? mediaFiles.get('10:' + memory) ?? './portraits/child.webp' : undefined;
  if (younger) {
    const previous = node('img', '', 'photo-demo photo-before');
    previous.src = younger;
    previous.alt = '';
    const portraits = node('div', '', 'portrait-transition');
    portraits.append(previous, asset);
    wrapper.append(portraits);
  } else {
    wrapper.append(asset);
  }
  parent.append(wrapper);
  if (!video && !mediaFiles.has(key)) parent.append(node('p', '시연용 인물 사진', 'note'));
}

function candidatePortrait(position) {
  const portrait = node('img', '', 'candidate-portrait');
  portrait.src = './portraits/candidate-' + (position + 1) + '.webp';
  portrait.alt = '';
  return portrait;
}

function renderQuestion(body) {
  const options = node('div', '', 'candidate-grid');
  const status = node('p', '', 'answer-status');
  status.setAttribute('role', 'status');
  const lock = button('답안 확정', () => {
    if (chosenCandidate === null || answerLocked) return;
    answerLocked = true;
    draw();
  });
  lock.dataset.cue = 'true';
  const draw = () => {
    [...options.children].forEach((choice, i) => {
      choice.setAttribute('aria-pressed', String(i === chosenCandidate));
      choice.disabled = answerLocked;
    });
    lock.disabled = chosenCandidate === null || answerLocked;
    status.textContent = answerLocked ? '답안 확정 · ' + (chosenCandidate + 1) + '번' : '시연 문제';
    notifyPresenter();
  };
  candidates.forEach((name, i) => {
    const option = button('', () => {
      chosenCandidate = i;
      draw();
    });
    const label = node('span', '', 'candidate-name');
    label.append(node('b', String(i + 1)), node('span', name));
    option.append(candidatePortrait(i), label);
    options.append(option);
  });
  const controls = node('div', '', 'question-controls');
  controls.append(status, lock);
  body.append(options, controls);
  draw();
}

function renderAnswer(body) {
  const result = node('div', '', 'answer-feature');
  const photo = candidatePortrait(correctCandidate);
  const text = node('div', '', 'answer-copy');
  text.append(node('span', '정답 · 2번', 'answer-tag'), node('strong', candidates[correctCandidate]), node('span', '최다 발표자 · 시연 정답'));
  if (answerLocked) {
    text.append(node('span', chosenCandidate === correctCandidate ? '확정 답안과 일치합니다' : '확정 답안 · ' + (chosenCandidate + 1) + '번', 'answer-outcome'));
  }
  text.append(node('span', '정답 기숙사 +30점', 'answer-points'));
  result.append(photo, text);
  body.append(result);
}

function createOwlSvg() {
  const container = node('div', '', 'owl-character');
  container.innerHTML = `
    <svg class="owl-svg" viewBox="0 0 180 120" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="owlEyeGrad" cx="40%" cy="35%" r="60%">
          <stop offset="0%" stop-color="#ffe270"/>
          <stop offset="65%" stop-color="#e59b12"/>
          <stop offset="100%" stop-color="#5a3103"/>
        </radialGradient>
        <linearGradient id="owlFeather" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#fdfbf7"/>
          <stop offset="40%" stop-color="#dfcfb7"/>
          <stop offset="100%" stop-color="#937a5c"/>
        </linearGradient>
        <linearGradient id="owlWingGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#eae0cf"/>
          <stop offset="60%" stop-color="#b69b7c"/>
          <stop offset="100%" stop-color="#5d442c"/>
        </linearGradient>
      </defs>
      <g class="owl-wing-left">
        <path d="M70,48 C50,25 20,18 2,30 C-2,38 8,55 22,65 C38,76 56,80 72,55 Z" fill="url(#owlWingGrad)" stroke="#4d3521" stroke-width="1.5"/>
        <path d="M12,34 C25,48 45,58 65,52" stroke="#48321e" stroke-width="1.2" fill="none"/>
        <path d="M22,46 C35,58 52,65 68,54" stroke="#48321e" stroke-width="1.2" fill="none"/>
        <path d="M5,32 C-1,42 6,52 16,58" stroke="#3d2716" stroke-width="1.2" fill="none"/>
      </g>
      <g class="owl-wing-right">
        <path d="M110,48 C130,25 160,18 178,30 C182,38 172,55 158,65 C142,76 124,80 108,55 Z" fill="url(#owlWingGrad)" stroke="#4d3521" stroke-width="1.5"/>
        <path d="M168,34 C155,48 135,58 115,52" stroke="#48321e" stroke-width="1.2" fill="none"/>
        <path d="M158,46 C145,58 128,65 112,54" stroke="#48321e" stroke-width="1.2" fill="none"/>
        <path d="M175,32 C181,42 174,52 164,58" stroke="#3d2716" stroke-width="1.2" fill="none"/>
      </g>
      <g>
        <ellipse cx="80" cy="98" rx="5" ry="3" fill="#cf9d34"/>
        <ellipse cx="100" cy="98" rx="5" ry="3" fill="#cf9d34"/>
        <path d="M75,98 L85,98 M95,98 L105,98" stroke="#4a300a" stroke-width="2"/>
      </g>
      <path d="M72,40 C65,55 64,80 75,98 C82,104 98,104 105,98 C116,80 115,55 108,40 Z" fill="url(#owlFeather)" stroke="#523c28" stroke-width="1.5"/>
      <path d="M82,65 Q90,70 98,65 M80,75 Q90,81 100,75 M84,85 Q90,90 96,85" stroke="#7a5f45" stroke-width="1.3" fill="none"/>
      <path d="M70,38 L65,18 C72,25 78,28 82,30 C86,29 94,29 98,30 C102,28 108,25 115,18 L110,38 C116,48 64,48 70,38 Z" fill="#dfcfb7" stroke="#523c28" stroke-width="1.5"/>
      <circle cx="81" cy="36" r="10" fill="#f8f4ec" stroke="#b4997e" stroke-width="1"/>
      <circle cx="99" cy="36" r="10" fill="#f8f4ec" stroke="#b4997e" stroke-width="1"/>
      <circle cx="81" cy="36" r="6.5" fill="url(#owlEyeGrad)"/>
      <circle cx="99" cy="36" r="6.5" fill="url(#owlEyeGrad)"/>
      <circle cx="81" cy="36" r="3.2" fill="#0d0905"/>
      <circle cx="99" cy="36" r="3.2" fill="#0d0905"/>
      <circle cx="79.5" cy="34.5" r="1.3" fill="#ffffff"/>
      <circle cx="97.5" cy="34.5" r="1.3" fill="#ffffff"/>
      <polygon points="90,36 86,47 94,47" fill="#f5af19" stroke="#754b08" stroke-width="1"/>
    </svg>
  `;
  return container;
}

const sceneBodies = {
  'owl-parchment': body => {
    const scene = node('div', '', 'owl-scene');
    const owl = createOwlSvg();
    
    const unrollSystem = node('div', '', 'parchment-unroll-system');
    
    const topRoller = node('div', '', 'parchment-roller');
    topRoller.append(node('div', '', 'roller-knob'), node('div', '', 'roller-knob'));
    
    const windowDiv = node('div', '', 'parchment-scroll-window');
    const sheet = node('div', '', 'parchment-sheet-content');
    sheet.append(
      node('div', '✦ HRA 2026 ACADEMY ✦', 'parchment-crest'),
      node('h2', '신입생 여러분 입학을 축하합니다', 'parchment-korean'),
      node('p', 'Welcome to HRA-Warts', 'parchment-english'),
      node('div', 'HRA 마법학교 겨울 연회 · 입학 통지서', 'parchment-seal')
    );
    windowDiv.append(sheet);
    
    const bottomRoller = node('div', '', 'parchment-roller');
    bottomRoller.append(node('div', '', 'roller-knob'), node('div', '', 'roller-knob'));
    
    unrollSystem.append(topRoller, windowDiv, bottomRoller);
    scene.append(owl, unrollSystem);
    body.append(scene);
  },
  guests: body => {
    const exitOwl = node('div', '', 'owl-fly-exit');
    exitOwl.append(createOwlSvg());
    body.append(exitOwl);

    const visible = state.guests.filter(guest => !guest.hidden);
    if (!visible.length) return body.append(node('p', '표시할 내빈이 없습니다.'));
    let selected = 0;
    
    const cardContainer = node('div', '', 'guest-card-container');
    const renderCard = () => {
      cardContainer.replaceChildren();
      const guest = visible[selected];
      
      const card = node('div', '', 'faculty-id-card-giant');
      card.append(node('div', 'HONORARY FACULTY', 'guest-id-badge'));
      
      const photoFrame = node('div', '', 'faculty-photo-frame');
      const photoImg = node('img');
      photoImg.src = guest.photo || './portraits/candidate-2.webp';
      photoImg.alt = guest.name;
      photoFrame.append(photoImg);
      
      const infoBox = node('div', '', 'faculty-info-box');
      infoBox.append(
        node('div', 'HRA 마법학교 명예 교수증', 'faculty-tag'),
        node('h2', `${guest.name} 교수님`, 'faculty-giant-name'),
        node('div', guest.role, 'faculty-dept'),
        node('div', 'HRA 지도교수 · 2026 연회에 함께해 주심을 감사드립니다.', 'faculty-role-desc'),
        node('div', 'FACULTY MEMBER OF HRA', 'faculty-seal-stamp')
      );
      
      card.append(photoFrame, infoBox);
      cardContainer.append(card);
    };
    
    body.append(cardContainer);
    
    if (visible.length > 1) {
      const controls = node('div', '', 'guest-nav-controls');
      const counter = node('span', `1 / ${visible.length}`);
      const prev = button('◀ 이전 내빈', () => {
        selected = (selected - 1 + visible.length) % visible.length;
        renderCard();
        counter.textContent = `${selected + 1} / ${visible.length}`;
      });
      const next = button('다음 내빈 ▶', () => {
        selected = (selected + 1) % visible.length;
        renderCard();
        counter.textContent = `${selected + 1} / ${visible.length}`;
      });
      next.dataset.cue = 'true';
      controls.append(prev, counter, next);
      body.append(controls);
    }
    renderCard();
  },
  banners: body => {
    const grid = node('div', '', 'house-banners-grid');
    houses.forEach(house => {
      const banner = node('div', '', 'house-banner');
      banner.style.setProperty('--banner-accent', house.color);
      banner.append(
        node('div', house.crest, 'banner-crest'),
        node('div', house.name, 'banner-name'),
        node('div', house.desc, 'banner-sub')
      );
      grid.append(banner);
    });
    body.append(grid);
  },
  blackout: () => {},
  'quiz-intro': body => {
    const reel = node('div', '', 'quiz-film-reel');
    const track = node('div', '', 'film-track');
    const moments = ['전반기 워크숍', '기업실무 발표', '팀 프로젝트', '열띤 토론', '스터디 세션', '네트워킹 데이', '멘토링 세션', '20기의 추억'];
    for (let loop = 0; loop < 2; loop++) {
      moments.forEach(m => {
        const frame = node('div', m, 'film-frame');
        track.append(frame);
      });
    }
    reel.append(track);
    body.append(reel);
    body.append(node('p', '20기의 소중한 기억이 필름처럼 흐르며 퀴즈가 시작됩니다!', 'note'));
  },
  quiz: renderQuestion,
  answer: renderAnswer,
  interlude: () => {},
  'photo-intro': body => {
    body.append(node('div', '⏳', 'ornament'));
    body.append(node('p', '타임캡슐이 서서히 열리며 교수님의 어린 시절 추억이 떠오릅니다.', 'note'));
  },
  photo: body => {
    media(body, false, '카드 ' + memory + '번 사진 선택');
    if (index === 10) timer(body, 15);
    else {
      const hasEventPhoto = mediaFiles.has('10:' + memory) || mediaFiles.has('11:' + memory);
      const name = photoAnswerNames.get(String(memory)) || (hasEventPhoto ? '현재 모습' : '정하늘 교수님 · 시연');
      body.append(node('p', name, 'photo-answer-name'));
    }
  },
  video: body => media(body, true, '20기 활동 영상 선택'),
  bingo: body => {
    const grid = node('div', '', 'bingo-grid');
    const items = [
      '흰 양말을 신은 사람',
      '한라산을 간 사람',
      '커피를 좋아하는 사람',
      '한국 문학을 선호하는 사람',
      '기업실무 2회 이상 발표자',
      '안경을 쓴 사람',
      '다른 기숙사인 사람',
      '피자를 좋아하는 사람',
      '운동이 취미인 사람'
    ];
    items.forEach(text => {
      const tile = node('button', text, 'tile');
      tile.addEventListener('click', () => tile.classList.toggle('marked'));
      grid.append(tile);
    });
    body.append(grid);
  },
  timer15: body => timer(body, 900),
  timer10: body => timer(body, 600),
  'scores-large': body => {
    const max = Math.max(...state.scores);
    const board = node('div', '', 'score-board-giant');
    houses.forEach((house, i) => {
      const row = node('div', '', 'score-row');
      const track = node('div', '', 'score-track');
      const bar = node('i');
      const score = state.scores[i];
      bar.style.width = (max ? score / max * 100 : 0) + '%';
      bar.style.background = house.color;
      track.append(bar);
      row.append(node('strong', house.crest + ' ' + house.name), track, node('span', score + '점'));
      board.append(row);
    });
    body.append(board);
  },
  champion: body => {
    const max = Math.max(...state.scores);
    const winnerIdx = state.scores.indexOf(max);
    const winner = houses[winnerIdx] || houses[0];
    const spot = node('div', '', 'champion-spotlight');
    spot.append(
      node('div', '👑', 'champion-crown'),
      node('div', `${winner.crest} ${winner.name}`, 'champion-house-name'),
      node('div', `최종 점수 ${max}점 · 2026 기숙사 컵 우승`, 'champion-trophy-banner')
    );
    body.append(spot);
  },
  'awards-gate': body => {
    body.append(node('div', '🏰', 'ornament'));
    body.append(node('p', '웅장한 연회장의 문이 활짝 열리며 명예의 전당 시상식이 시작됩니다.', 'note'));
  },
  ballroom: body => {
    const container = node('div', '', 'scrolls-container');
    const awards = [
      { title: '교수님 감사장', winner: '정하늘 교수님', desc: '아낌없는 사랑과 헌신으로 20기를 이끌어주신 언론홍보학부 지도교수님께 감사와 존경을 바칩니다.' },
      { title: '전반기 개근상', winner: '박지성 마법사', desc: '한 번의 결석 없이 언제나 성실하게 자리를 지킨 열정의 마법사에게 수여합니다.' },
      { title: '최다 발표상', winner: '김강민 마법사', desc: '깊이 있는 분석과 당당한 발표로 학문적 지평을 넓힌 마법사에게 수여합니다.' }
    ];
    awards.forEach(award => {
      const scroll = node('div', '', 'parchment-scroll');
      scroll.append(
        node('div', award.title, 'scroll-header'),
        node('div', award.winner, 'scroll-winner'),
        node('p', award.desc, 'scroll-desc'),
        node('div', '✦ HRA 2026 ✦', 'scroll-badge')
      );
      container.append(scroll);
    });
    body.append(container);
  },
  'photo-star': body => {
    const container = node('div', '', 'starfall-container');
    for (let i = 0; i < 40; i++) {
      const star = node('div', '', 'star-particle');
      star.style.left = (Math.random() * 100) + '%';
      star.style.top = (Math.random() * -20) + 'px';
      const size = Math.random() * 6 + 3;
      star.style.width = size + 'px';
      star.style.height = size + 'px';
      star.style.animationDuration = (Math.random() * 3 + 2) + 's';
      star.style.animationDelay = (Math.random() * 3) + 's';
      container.append(star);
    }
    body.append(container);
  },
  staff: body => body.append(button('운영 패널 열기', openOperator)),
};

function render() {
  stopTimer();
  const [chapter, title, description, theme, content] = slides[index];
  const page = String(index + 1).padStart(2, '0');
  slide.className = 'slide ' + theme + (theme === 'hero' || index === 0 ? '' : ' center');
  slide.dataset.content = content ?? '';
  slide.dataset.page = page;
  slide.style.setProperty('--scene-image', index === 1 ? 'url("./castle.webp")' : 'url("./scenes/p' + page + '.webp")');
  const frame = node('div', '', 'scene-frame');
  frame.setAttribute('aria-hidden', 'true');
  for (let corner = 0; corner < 4; corner++) frame.append(node('span', '❦'));
  slide.replaceChildren(frame, node('span', 'HRA', 'mark'));
  if (index === 0) {
    window.HraOpening?.attach(slide, lastRendered !== 0);
    const titles = node('div', '', 'opening-titles');
    titles.append(node('h1', title), node('p', description, 'opening-subtitle'));
    slide.append(titles);
  } else {
    window.HraOpening?.detach();
    if (content && !sceneBodies[content]) slide.append(node('div', content, 'ornament'));
    slide.append(node('p', chapter, 'eyebrow'), node('h1', title));
    if (description) slide.append(node('p', description, 'description'));
  }
  lastRendered = index;
  if (sceneBodies[content]) {
    const body = node('div', '', 'scene-body');
    sceneBodies[content](body);
    slide.append(body);
  }
  slide.append(node('span', index === 0 ? '2026.12.26  ·  JEJU' : 'HRA 2026  /  P' + page, 'corner'));
  updateReveal();
  notifyPresenter();
  get('number').textContent = page;
  const totalSpan = document.querySelector('.position span');
  if (totalSpan) totalSpan.textContent = ' / ' + slides.length;
  get('progress').style.width = ((index + 1) * 100 / slides.length) + '%';
  get('prev').disabled = index === 0;
  get('next').disabled = index === slides.length - 1;
}

function updateReveal() {
  const waiting = !revealed && revealLabels.has(index) && (staged || answerPages.has(index));
  slide.classList.toggle('awaiting-cue', waiting);
  for (const item of slide.querySelectorAll('.description,.scene-body')) item.hidden = waiting;
  if (waiting) {
    if (answerPages.has(index)) slide.append(node('p', '정답을 공개할 준비가 되면 큐를 실행하세요.', 'suspense-line'));
    const reveal = button(revealLabels.get(index), runCue);
    reveal.className = 'reveal-standalone';
    slide.append(reveal);
  }
}

function runCue() {
  if (slide.classList.contains('awaiting-cue')) {
    revealed = true;
    slide.classList.remove('awaiting-cue');
    slide.classList.add('cue-revealed');
    for (const item of slide.querySelectorAll('.description,.scene-body')) item.hidden = false;
    slide.querySelector('.reveal-standalone')?.remove();
    slide.querySelector('.suspense-line')?.remove();
    notifyPresenter();
  } else if (index === 14) {
    const video = slide.querySelector('video:not([hidden])');
    if (video) video.play().catch(() => video.focus());
  } else {
    slide.querySelector('[data-cue]')?.click();
  }
}

function setCaption(value) {
  clearTimeout(captionJob);
  const caption = get('caption');
  const text = typeof value === 'string' ? value.trim().slice(0, 100) : '';
  caption.hidden = !text;
  caption.textContent = '';
  if (!text || matchMedia('(prefers-reduced-motion: reduce)').matches) {
    caption.textContent = text;
    return;
  }
  const letters = [...text];
  let length = 1;
  function write() {
    caption.textContent = letters.slice(0, length).join('');
    if (length++ < letters.length) captionJob = setTimeout(write, 27);
  }
  write();
}

function notifyPresenter() {
  if (!presenterWindow || presenterWindow.closed) return;
  const next = index === 3 ? slides[5] : slides[index + 1];
  const reveal = !revealed && revealLabels.get(index);
  presenterWindow.postMessage({
    hra: 'stage', index, title: slides[index][1], next: next?.[0], scores: state.scores,
    total: slides.length, agenda: slides.map(item => item[0]), blank: document.body.dataset.blank || '',
    actionLabel: reveal || (index === 8 && chosenCandidate !== null && !answerLocked ? '답안 확정' : cueLabels.get(index)) || '',
  }, origin);
}

get('presenter').addEventListener('click', () => {
  if (presenterWindow && !presenterWindow.closed) {
    presenterWindow.focus();
    return;
  }
  presenterWindow = window.open('./presenter.html', 'hra-presenter', 'popup,width=680,height=760');
  if (!presenterWindow) get('presenter').textContent = '팝업 허용 필요';
});

addEventListener('message', event => {
  const data = event.data;
  if (data?.hra !== 'presenter' || (origin !== '*' && event.origin !== origin)) return;
  // 무대를 새로고침해도, 이 창이 연 사회자 창이면 다시 연결한다
  if ((data.action === 'ready' || data.action === 'ping') && event.source?.opener === window) {
    const fresh = presenterWindow !== event.source;
    presenterWindow = event.source;
    if (data.action === 'ping') {
      if (fresh || !staged) {
        staged = true;
        render();
      } else notifyPresenter();
      return;
    }
  }
  if (event.source !== presenterWindow) return;
  switch (data.action) {
    case 'ready':
      staged = true;
      render();
      break;
    case 'next':
      go(index === 3 ? 5 : index + 1);
      break;
    case 'prev':
      go(index === 5 ? 3 : index - 1);
      break;
    case 'cue':
      runCue();
      break;
    case 'goto': {
      const target = Number(data.text);
      if (Number.isInteger(target)) go(target - 1);
      break;
    }
    case 'blank':
      window.HraPresent?.setBlank(data.text);
      break;
    case 'caption':
      setCaption(data.text);
      break;
    case 'clear':
      setCaption('');
      break;
    case 'scores':
      if (Array.isArray(data.text) && data.text.length === houses.length &&
          data.text.every(score => Number.isInteger(score) && score >= 0 && score <= 99999)) {
        state.scores = data.text;
        save();
        if (index === 18) render();
        else notifyPresenter();
      }
      break;
  }
});

function go(position) {
  if (position < 0 || position >= slides.length || position === index) return;
  const move = () => { location.hash = 'p' + (position + 1); };
  // 1페이지에서 다음으로 넘어갈 때는 카메라가 성 안으로 들어간 뒤 이동
  if (index === 0 && position === 1 && window.HraOpening?.enter(move)) return;
  move();
}

function openOperator() {
  const scores = get('score-inputs');
  scores.replaceChildren();
  houses.forEach((house, i) => {
    const label = node('label', house.name);
    const input = node('input');
    Object.assign(input, { type: 'number', name: 'score' + i, min: 0, max: 99999, required: true, value: state.scores[i] });
    label.append(input);
    scores.append(label);
  });
  renderGuestList();
  get('media-card').value = String(memory);
  updateMediaStatus();
  get('operator').showModal();
}

function updateMediaStatus() {
  const card = get('media-card').value;
  const child = mediaFiles.has('11:' + card) ? '등록됨' : '시연 사진';
  const adult = mediaFiles.has('12:' + card) ? '등록됨' : '시연 사진';
  const video = mediaFiles.has('14:video') ? '등록됨' : '미등록';
  get('photo-answer-name').value = photoAnswerNames.get(card) ?? '';
  get('media-status').textContent = '카드 ' + card + '번 · 어린 시절 ' + child + ' · 현재 ' + adult + ' · 영상 ' + video;
}

get('media-card').addEventListener('change', updateMediaStatus);
get('photo-answer-name').addEventListener('change', event => {
  photoAnswerNames.set(get('media-card').value, event.target.value.trim());
  if (index === 12) render();
});
for (const [id, prefix] of [['child-file', '11:'], ['adult-file', '12:'], ['activity-file', '14:']]) {
  const picker = get(id);
  picker.addEventListener('change', () => {
    const file = picker.files[0];
    if (!file) return;
    const key = prefix + (prefix === '14:' ? 'video' : get('media-card').value);
    const previous = mediaFiles.get(key);
    if (previous) URL.revokeObjectURL(previous);
    mediaFiles.set(key, URL.createObjectURL(file));
    picker.value = '';
    updateMediaStatus();
    if (index === 11 || index === 12 || index === 14) render();
  });
}

function renderGuestList() {
  const list = get('guest-list');
  list.replaceChildren();
  state.guests.forEach((guest, i) => {
    const row = node('div');
    const name = node('input');
    const role = node('input');
    Object.assign(name, { value: guest.name, maxLength: 24 });
    Object.assign(role, { value: guest.role, maxLength: 30 });
    name.setAttribute('aria-label', '내빈 ' + (i + 1) + ' 이름');
    role.setAttribute('aria-label', '내빈 ' + (i + 1) + ' 소개');
    row.append(name, role, button('수정', () => {
      if (!name.value.trim() || !role.value.trim()) return;
      Object.assign(guest, { name: name.value.trim(), role: role.value.trim() });
      updateGuests();
    }), button(guest.hidden ? '표시' : '숨김', () => {
      guest.hidden = !guest.hidden;
      updateGuests();
    }));
    list.append(row);
  });
}

function updateGuests() {
  save();
  renderGuestList();
  if (index === 3) render();
}

get('score-form').addEventListener('submit', event => {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  state.scores = houses.map((_, i) => Number(data.get('score' + i)));
  save();
  if (index === 18) render();
  else notifyPresenter();
  get('operator').close();
});
get('guest-form').addEventListener('submit', event => {
  event.preventDefault();
  const form = event.currentTarget;
  const data = new FormData(form);
  const name = data.get('guest').trim();
  const role = data.get('role').trim();
  if (!name || !role) return;
  state.guests.push({ name, role });
  form.reset();
  updateGuests();
});
get('staff').addEventListener('click', openOperator);
get('contents').addEventListener('click', () => get('agenda').showModal());
get('prev').addEventListener('click', () => go(index - 1));
get('next').addEventListener('click', () => go(index + 1));
async function fullscreen() {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.querySelector('.workspace').requestFullscreen();
  } catch {
    get('fullscreen').textContent = '전체화면 사용 불가';
  }
}
document.addEventListener('fullscreenchange', () => {
  const parent = document.fullscreenElement === document.querySelector('.workspace') ? document.fullscreenElement : document.body;
  parent.append(get('agenda'), get('operator'), get('help'));
});
get('fullscreen').addEventListener('click', fullscreen);
document.querySelectorAll('[data-close]').forEach(el => el.addEventListener('click', () => el.closest('dialog').close()));
slides.forEach(([chapter], i) => {
  const item = node('li');
  item.append(button(chapter, () => {
    get('agenda').close();
    go(i);
  }));
  get('agenda-list').append(item);
});
document.addEventListener('keydown', event => {
  if (document.querySelector('dialog[open]') || event.target.matches('input,video,textarea,select')) return;
  if (event.ctrlKey || event.metaKey || event.altKey) return;
  if (['ArrowRight', 'PageDown', 'ArrowLeft', 'PageUp', 'Home', 'End'].includes(event.key)) {
    event.preventDefault();
    if (event.repeat) return;
    if (event.key === 'Home') go(0);
    else if (event.key === 'End') go(slides.length - 1);
    else go(index + (['ArrowRight', 'PageDown'].includes(event.key) ? 1 : -1));
  } else if (event.code === 'KeyF') fullscreen();   // event.code: 한글 입력 상태에서도 동작
  else if (event.code === 'KeyO') openOperator();
  else if (event.key === ' ' && event.target === document.body) {
    event.preventDefault();
    if (!event.repeat) runCue();
  }
});
function restorePosition() {
  const position = Number(location.hash.match(/^#p(\d+)$/)?.[1]);
  index = position >= 1 && position <= slides.length ? position - 1 : 0;
  if (index === 8) {
    chosenCandidate = null;
    answerLocked = false;
  }
  staged = Boolean(presenterWindow && !presenterWindow.closed);
  revealed = false;
  setCaption('');
  render();
  if (index < slides.length - 1) {
    const preload = new Image();
    preload.src = './scenes/p' + String(index + 2).padStart(2, '0') + '.webp';
  }
}
addEventListener('hashchange', restorePosition);
addEventListener('storage', event => {
  if (event.key !== storeKey) return;
  state = readState();
  if (index === 3 || index === 18) render();
});
restorePosition();
window.HraStage = { go: n => go(n - 1), step: d => go(index + d), get index() { return index; }, total: slides.length, notify: notifyPresenter, fullscreen };
