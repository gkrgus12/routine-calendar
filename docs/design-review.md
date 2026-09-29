# 룩 · 인터랙션 맞춤 검토 (docs/ref 기준)

기준 이미지: `docs/ref/ios_calendar_*.png` 4장 = **컴포넌트**(알약 버튼, 세그먼트, 토글, 그룹 리스트, 굵은 제목, 옅은 칩), `docs/ref/macOS_calendar_*.png` 3장 = **레이아웃**(사이드바 + 상단 툴바 + 시간축 그리드, 요일 헤더, 오늘 표시, 현재 시각 선, 편집 팝업).
앱 스크린샷은 헤드리스 Chrome 1200×800, 같은 시드 데이터(학교·운동·개인 페이지, 약속 4개, 시간당 36px)로 라이트·다크를 각각 찍었다. 동작·데이터·구조는 바꾸지 않았고 추가 의존성도 없다(모션은 Web Animations API).

나란히 놓은 그림: `docs/shots/cmp-*.png` (왼쪽 참고 이미지 → 앱 라이트 → 앱 다크)

| 화면 | 비교 그림 | 앱 단독 |
|---|---|---|
| 주간 | [cmp-week](shots/cmp-week.png) | [light](shots/week-light.png) · [dark](shots/week-dark.png) |
| 일간 | [cmp-day](shots/cmp-day.png) | [light](shots/day-light.png) · [dark](shots/day-dark.png) |
| 월간 | [cmp-month](shots/cmp-month.png) | [light](shots/month-light.png) · [dark](shots/month-dark.png) |
| 약속 시트 | [cmp-event](shots/cmp-event.png) | [light](shots/event-light.png) · [dark](shots/event-dark.png) |
| 설정 시트 | [cmp-settings](shots/cmp-settings.png) | [light](shots/settings-light.png) · [dark](shots/settings-dark.png) |
| 루틴 편집 | [cmp-edit](shots/cmp-edit.png) | [light](shots/edit-light.png) · [dark](shots/edit-dark.png) |

## 1차 비교표 (룩 패치 직후)

| 컴포넌트 | 참고 이미지 | 앱 (1차) | 차이 | 조치 |
|---|---|---|---|---|
| 상단 툴바 | macOS: Day/Week/Month 세그먼트가 툴바 **가운데**, 제목은 굵은 월 + 얇은 연도 | 세그먼트 가운데, `9월` 굵게 + `2026년` 얇게(22px) | 제목이 툴바 한 줄 안에 있어 크기가 작음(macOS 28pt, iOS 34pt) | 수용(PC 한 줄 툴바 유지) |
| 알약 버튼 | iOS: 흰 알약, 옅은 그림자 | ‹ › 오늘 이번 주: 흰 알약 + 그림자, + 약속: 파란 알약 | 없음 | — |
| 세그먼트 | iOS/macOS: 회색 트랙 위 흰 선택 배경 | 회색 트랙 + `.pill` 흰 배경(슬라이드) | 없음 | — |
| 토글 | iOS 스위치(초록, 흰 노브) | `.sw` + `.knob` 실제 요소 | 없음 | — |
| 사이드바 | macOS: 폭 ≈ 1/4, 색 점 + 이름 목록 | 216px, 색 점 + 이름 + 토글 | macOS 는 체크박스, 앱은 iOS 토글(컴포넌트 규칙) | 수용 |
| 요일 헤더(주간·일간) | macOS: `Tue` 작게 + `1` 굵게, 오늘 빨간 원 | `화` 작게 + `29` 굵게, 오늘 빨간 원 | 없음 | — |
| 요일 헤더(월간) | iOS: 평일 진하게, 토·일 흐리게 | 전부 흐린 회색 | 평일·주말 구분 없음 | **2차에서 수정** |
| 날짜 숫자(월간) | iOS: 크고 굵게, 오늘 빨간 원 | 14px 굵게, 오늘 빨간 원, 일요일 빨강 | 조금 작음 | **2차: 15px** |
| 시간 눈금 | macOS: 작은 회색 `9 AM` | 10px `09:00` | 표기 방식(24h) | 수용 |
| 현재 시각 | macOS: 빨간 선 + 시간 pill + 점 | 오늘 열 빨간 선 + `.nowpill` + 점 | 없음 | — |
| 약속 블록(주간·일간) | macOS: 옅은 배경 + 왼쪽 색 띠 + 진한 글자, 45분 이상은 시간 줄 | 약속 색으로 **채움**(브리프 15), 60분 이상 시간 줄 | 왼쪽 띠 없음. 채움 vs 옅음은 브리프 15 결정 유지 | **2차: 왼쪽 띠 추가** |
| 루틴 블록(주간·일간) | (참고 없음) | 흐림 슬라이더로 배경처럼 | — | — |
| 월간 칩 | iOS: 옅은 배경 + 같은 색 진한 글자 + 시간 | 약속 색으로 채움 + 흰 글자 | 채움 vs 옅음 | **2차: 옅은 배경으로** |
| 종일 줄 | macOS: `all-day` 줄 | 주간·일간에 종일 약속이 있을 때만 `.wad` 줄 | 빈 줄을 항상 두지 않음 | 수용(구조 유지) |
| 모달 | macOS: 팝오버, iOS: 하단 시트 | 하단 시트(`.md`, 그랩 핸들, 딤) | 없음 | — |
| 설정 | iOS: 그룹 리스트(둥근 카드, 행 구분선) | 탭 + 그룹 카드(`.frow`, `.chk`) | 없음 | — |
| 편집 그리드 | (참고 없음, 주간 레이아웃 공유) | 같은 헤더·눈금·블록 규칙 | — | — |
| 미니 월(일간) | macOS: 오른쪽 미니 달력 | 없음 | 구조 변경이라 범위 밖 | 수용 |
| 모션 | 150~250ms 스프링 | 스프링 ω=12 를 정규화 시간에 적용 → 실제로는 ~60ms 만에 끝남 | 지정 시간의 1/3 에 끝남 | **2차: ω=2π 로 교정** |

## 최종 비교표 (2차 패치 후)

| 컴포넌트 | 참고 이미지 | 앱 (최종) | 남은 차이 |
|---|---|---|---|
| 상단 툴바 | 가운데 세그먼트, 굵은 월 + 얇은 연도 | 동일 구성, 한 줄 툴바 | 제목 크기(22px vs 28~34pt) — PC 한 줄 툴바라 수용 |
| 알약 버튼 · 세그먼트 · 토글 | iOS | 동일 | 없음 |
| 사이드바 | macOS 폭·목록 | 216px, 색 점 + 토글 | 체크박스 대신 iOS 토글(의도) |
| 요일 헤더(주간·일간) | 요일 작게 + 날짜 굵게, 오늘 빨간 원 | 동일 | 없음 |
| 요일 헤더(월간) | 평일 진하게, 주말 흐리게 | 평일 `--ink` 700, 토·일 `--muted` | 없음 |
| 날짜 숫자(월간) | 크고 굵게 | 15px 700, 오늘 빨간 원, 일요일 빨강 | 크기 차이 약간 |
| 현재 시각 | 빨간 선 + pill + 점 | 동일 | 없음 |
| 약속 블록(주간·일간) | 옅은 배경 + 왼쪽 띠 | 채움 + 3px 왼쪽 띠(`inset box-shadow`), 60분 이상 시간 줄 | 채움 유지(브리프 15) |
| 월간 칩 | 옅은 배경 + 진한 글자 | `color-mix` 로 약속 색 16%(다크 30%) 배경 + 진한 글자, 시간 앞 | 없음 |
| 종일 줄 | 항상 있음 | 종일 약속이 있을 때만 | 빈 줄 생략(구조 유지) |
| 모달 | 팝오버 / 하단 시트 | 하단 시트 + 그랩 핸들, 딤 | 없음 |
| 설정 | 그룹 리스트 | 탭 + 그룹 카드 | 없음 |
| 미니 월(일간) | 있음 | 없음 | 범위 밖 |

## 인터랙션 4종 (GIF + 연속 프레임, 라이트·다크)

모두 `anim()`(Web Animations API) + `springEasing(bounce)`(감쇠 진동 ζ=1−bounce, ω=2π 를 `linear()` 이징으로 32점 샘플링). `prefers-reduced-motion: reduce` 면 `anim()` 이 즉시 최종 상태를 적용하고 CSS 전환·애니메이션도 끈다.

| 인터랙션 | 시간·곡선 | GIF | 프레임(0·40·80·120·160·220ms) |
|---|---|---|---|
| 뷰 전환(주간 → 일간): 나가는 화면 페이드아웃, 새 화면 크로스페이드 + 8px 슬라이드 | 220ms, bounce .15 / 160ms ease-out | [light](shots/motion-view-light.gif) · [dark](shots/motion-view-dark.gif) | [light](shots/motion-view-light.png) · [dark](shots/motion-view-dark.png) |
| 하단 시트 열기·닫기(약속 편집): 딤 페이드, 시트 56px 아래서 스프링 진입 → Esc 로 닫힘 | 열기 250ms bounce .25 / 닫기 160ms ease-in | [light](shots/motion-sheet-light.gif) · [dark](shots/motion-sheet-dark.gif) | [light](shots/motion-sheet-light.png) · [dark](shots/motion-sheet-dark.png) (앞 6장 열기, 뒤 6장 닫기) |
| 세그먼트 선택(주간 → 월간): 흰 선택 배경이 미끄러짐 | 220ms, bounce .2 | [light](shots/motion-seg-light.gif) · [dark](shots/motion-seg-dark.gif) | [light](shots/motion-seg-light.png) · [dark](shots/motion-seg-dark.png) |
| 토글(개인 페이지 켜기): 노브 슬라이드 | 200ms, bounce .25 | [light](shots/motion-toggle-light.gif) · [dark](shots/motion-toggle-dark.gif) | [light](shots/motion-toggle-light.png) · [dark](shots/motion-toggle-dark.png) |
| 블록 드래그(편집 그리드): 잡으면 scale 1.02 + 그림자, 놓으면 1.02 → 1 스프링 안착 | 250ms, bounce .4 | [light](shots/motion-drag-light.gif) · [dark](shots/motion-drag-dark.gif) | [light](shots/motion-drag-light.png) · [dark](shots/motion-drag-dark.png) (1장 드래그 중, 이후 0·60·120·180·250ms) |

닫기 제스처(시트를 90px 넘게 아래로 드래그)와 바깥 클릭도 같은 `dismissSheet` 를 탄다.

## 3차: 데스크톱 잔손질 (약속 팝오버 · 고정 화살표)

- 약속 추가·편집은 데스크톱 폭에서 하단 시트 대신 **팝오버**: 기준점(클릭한 블록/칩/버튼, 또는 드래그를 놓은 지점) 오른쪽, 자리가 없으면 왼쪽, 아래가 부족하면 위로 밀어 화면 안에. 폭 360, 기준점을 가리키는 화살표, 딤 없음, 기준점 쪽에서 scale .9→1 스프링 120ms. Esc·바깥 클릭으로 닫힘. 설정 모달은 시트 그대로
- 상단바는 `[오늘/이번 주][‹ ›] 제목` — ‹ › 한 쌍이 왼쪽에 고정돼 제목 길이(12월 28일 – 1월 3일 등)와 무관

| 확인 | 그림 |
|---|---|
| 오른쪽 끝·아래쪽 끝(일요일 22시) 블록 → 왼쪽으로, 위로 밀려 잘리지 않음 | [popover-edge-light](shots/popover-edge-light.png) |
| 주간 드래그 생성 → 놓은 지점 옆 | [popover-drag-dark](shots/popover-drag-dark.png) |
| 일간 폭 전체 블록 → 클릭 지점 기준 | [popover-day-light](shots/popover-day-light.png) |
| 등장 프레임 0·40·80·120ms | [motion-popover-light](shots/motion-popover-light.png) |
| 상단바: 이번 주 / 12월 28일 – 1월 3일 / 12월 31일 (목) / 월간 — 화살표 자리 동일 | [bar-nav](shots/bar-nav.png) |

## 4차: 상단바 재배치 (macOS 캘린더 기준)

- 왼쪽 큰 제목(월간 `2026년 9월`, 주간 `2026년 9월` / 두 달에 걸치면 `2026년 9월–10월`, 일간 `9월 28일 월요일`), 가운데 세그먼트, 오른쪽 `‹ 오늘 ›` 한 묶음. 월간·일간의 + 약속은 묶음 왼쪽. grid `1fr auto 1fr` 이라 제목 길이와 무관하게 세그먼트는 정중앙, 묶음은 오른쪽 끝
- 범례 칩은 그리드 위 왼쪽 그대로

| 확인 | 그림 |
|---|---|
| 주간(두 달) · 12월 마지막 주(12월–1월) · 월간 · 일간 · 12월 31일 · 다크 — 화살표·세그먼트 자리 동일 | [bar-title](shots/bar-title.png) |
| 주간 전체 | [week-light](shots/week-light.png) · [week-dark](shots/week-dark.png) |

## 검증 메모

- 회귀 하네스 25종 전부 통과(`--force-prefers-reduced-motion` 으로 실행). 헤드리스 가상 시간에서는 애니메이션 클록이 돌지 않아 닫힘 애니메이션이 끝나지 않으므로, 동작 검증은 리듀스드 모션으로 돌리고 프레임 캡처는 `document.getAnimations()` 를 원하는 시각으로 멈춰 찍었다
- `anim()` 은 `finished` 와 `duration+40ms` 타이머 중 먼저 끝나는 쪽으로 resolve 해서, 애니메이션 클록이 멈춘 환경에서도 시트 제거·나가는 화면 제거는 반드시 진행된다
- 3차 하네스(팝오버 배치 8경우 + 화살표 위치 주간 14주·일간 10일·월간 12달 + 좁은 폭 시트 유지) 29건 통과, 기존 25종 회귀 통과
- 4차: 같은 하네스에 제목 형식(세 뷰)·오늘 버튼·세그먼트 중앙 검사를 더해 34건 통과, 기존 25종 회귀 통과(주간·일간 제목 기대값만 갱신)
- 범위 밖: 모바일 레이아웃, 햅틱·제스처 내비게이션, 아이콘 세트, 팝오버 드래그 이동
