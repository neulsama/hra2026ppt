---
name: hra-ppt-qa
description: HRA 송년회 발표 슬라이드(HTML)를 수정·추가할 때 항상 적용. 요청을 측정 가능한 요구사항으로 적고, 구현 후 qa/qa.py 로 스스로 검증하며, 요청하지 않은 슬라이드가 바뀌지 않았는지 확인한다.
---

# HRA 발표 슬라이드 작업 절차

이 프로젝트의 모든 수정 작업에 사용자의 별도 요청 없이 적용한다. 도구: `python3 -I qa/qa.py <명령>` (Python 3, playwright, opencv-python, Pillow, Chrome 필요. 없으면 `pip install --break-system-packages playwright opencv-python pillow`).

## 0. 시작 전 한 번
- `python3 -I qa/qa.py baseline` 이 모두 OK 인지 확인해 출발점을 잡는다.
- 사용자가 준 참조 이미지·영상이 있으면 `qa/refs/` 에 보관(없으면 폴더 생성)하고 구도·위치를 좌표로 기록한다.

## 1. 요청 → 요구사항
`qa/requirements.json` 에 항목 추가. 모호한 표현은 숫자로 바꾼다.
- 글자: 문구 `text`, 크기 `fontPx` (pt × 4/3 = px @1920×1080, 예 60pt = 80px)
- 움직임: `motion` (영역 비율, 구간, 평균 변화 허용 범위). "배가 움직인다" 같은 요구는 상하 이동 px 도 `motion`/`qa.py motion` 으로 잰다
- 존재·상태: `exists`, `js`
- 참조 이미지와 같아야 하면 `compare` 로 영역별 SSIM·차이 지도를 본다 (구도가 다르면 영역을 맞춰 비교)

## 2. 구현 원칙
- 요청한 슬라이드 외에는 건드리지 않는다. 공통 CSS 를 바꿀 때는 영향 범위를 `baseline` 으로 확인한다.
- 슬라이드 목록·문구는 `stage.js` 의 `slides`, 사회자 대사는 `cues.js` (장수·순서가 바뀌면 `eventCues` 와 `revealLabels`/`cueLabels`/`answerPages` 의 인덱스, `index.html` 의 `/ 26`, `qa/qa.py` 의 `TOTAL` 도 함께 맞춘다).
- 단축키는 `event.code`. 새 단축키는 `#help` 와 README 에 기록.
- 연출 캔버스는 `HraOpening.freeze(t)` 같은 시간 고정 훅을 유지해 재현 가능하게 한다.

## 3. 스스로 점검 (생략 금지)
1. `python3 -I qa/qa.py check --only <id>` — 새 요구사항 수치 확인
2. `shot --slides N --size 1920x1080` / `motion` / `compare` 로 만든 이미지를 **직접 열어 눈으로 확인**. 수치 통과 ≠ 의도와 같음
3. `baseline` — 요청하지 않은 장이 그대로인지
4. `check` 전체 — FAIL 0, WARN 은 원인 확인
5. 필요하면 `selftest` — 검사기가 아직 문제를 잡는지
6. 의도한 변경이면 `baseline --update --slides ...` 로 해당 장만 갱신

## 4. 보고
측정값(px, SSIM, 움직임 px)과 한계, 바뀐 파일을 짧게. 수치가 목표에 못 미치면 통과로 포장하지 말고 그대로 말하고 개선 방향을 제시한다.
