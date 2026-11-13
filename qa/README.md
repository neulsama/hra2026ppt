# QA 환경 (발표 화면 자동 점검)

요청받은 수정이 **요청한 그대로인지** 스스로 확인하기 위한 도구입니다. 발표 자료를 여는 데는 필요 없고,
수정 작업 때만 씁니다. (Python 3 + playwright + opencv + Chrome 필요)

모든 촬영은 화면 크기와 연출 시각을 고정해서 하므로, 같은 명령은 항상 같은 결과를 냅니다.

```
python3 -I qa/qa.py <명령>
```

| 명령 | 하는 일 |
|---|---|
| `shot --slides 1,2,9 --size 1920x1080 [--t 8.5]` | 슬라이드를 찍어서 `qa/out/shot/` 에 저장하고 `sheet.jpg` 로 묶음. `--t` 는 P01 같은 연출 장면의 시각(초) |
| `baseline` | 26장을 기준 이미지(`qa/baseline/`)와 비교. 바뀐 장은 `qa/out/baseline/pNN_diff.jpg` (기준 / 현재 / 차이×4) |
| `baseline --update [--slides 10,12]` | 의도한 변경일 때만 기준 이미지를 갱신 |
| `check [--sizes ...] [--slides ...] [--only id,id]` | 공통 검사 + `requirements.json` 항목. 결과는 `qa/out/check.md` |
| `motion --slide 1 --t0 11 --dur 4 --fps 4 --region x0,y0,x1,y1` | 영역이 시간에 따라 얼마나 움직이는지 수치(평균 변화, 상하 이동 px)와 필름스트립·움직임 지도 |
| `compare 참조.png --slide 1 --t 12 [--region ...]` | 참조 이미지와 비교: SSIM, 색분포 상관, 나란히 보기 + 차이 지도 |
| `selftest` | 검사기가 일부러 망가뜨린 화면에서 문제를 잡아내는지 확인 (검사기 자체 점검) |
| `all` | baseline + check |

## 요청을 받았을 때 작업 순서

1. 요청을 `requirements.json` 에 **측정 가능한 항목**으로 적는다 (문구, 글자 크기 px, 움직임 범위, 위치 비율 등).
   60pt = 1920×1080 에서 80px, 35pt = 46.67px.
2. 구현한다.
3. `check --only <id>` 로 항목을 확인하고, `shot` / `motion` / `compare` 이미지를 **눈으로 본다**.
   수치가 통과해도 그림이 어색할 수 있고, 그림이 좋아 보여도 수치가 어긋날 수 있다.
4. `baseline` 으로 **요청하지 않은 슬라이드가 바뀌지 않았는지** 확인한다.
5. 전체 `check` 를 돌려 FAIL 이 0 인지 확인한다. 의도한 변경이면 `baseline --update` 후 이유를 남긴다.

## 알아 둘 점

- **기준 이미지는 "관객이 보는 화면"** (발표 모드, 1280×720, 운영자용 버튼·안내 숨김) 입니다.
  전체화면과 창 모드는 같은 규칙으로 그려지며 `check` 가 두 화면의 일치(SSIM)를 확인합니다.
- `present.js` 가 있는데 `window.HraPresent` 가 없으면 `check` 가 FAIL 로 알려 줍니다. 스크립트 오류를 대체 CSS 로 덮지 않습니다.
- P01 연출은 `HraOpening.freeze(t)` 로 시간을 고정해 찍습니다 (QA 전용 훅, 평소 동작에는 영향 없음).
- `check` 의 WARN(1080p 기준 18px 미만 글자)과 FAIL(안전 영역 3% 밖으로 나간 글자)은 슬라이드를 바꿀 때 자동으로 잡힙니다.
- 글자 안전 영역·크기 검사는 보이는 글자만 대상으로 합니다.
