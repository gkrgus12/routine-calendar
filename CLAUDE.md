# 루틴 캘린더

요일별 루틴(시간표)을 페이지 단위로 만들어 켜고 끄고, 날짜별 약속을 등록하면 활성 루틴과 겹치는 시간을 경고해 주는 개인용 캘린더.

## 스택

- 바닐라 JS (ES2015+), 프레임워크·번들러·빌드 도구 없음
- 파일 3개: `index.html`(마크업), `styles.css`(스타일), `app.js`(전체 로직, IIFE 하나)
- 저장소는 `localStorage` 한 키뿐. 서버·백엔드 없음
- `manifest.json` + `icon.svg` 로 PWA(standalone) 설치 가능. 서비스 워커는 없음
- 폰트는 Google Fonts(IBM Plex Sans KR)를 CDN으로 로드. 오프라인이면 시스템 폰트로 폴백

## 실행

- 그냥 `index.html`을 브라우저로 열면 된다 (`file://` 로도 동작)
- 로컬 서버가 필요하면 `python -m http.server 8000` 후 `http://localhost:8000/`
- 테스트·린트·빌드 단계 없음. 수정 후 새로고침으로 확인

## 범위

- **PC 전용, 나만 씀.** 다중 사용자·동기화·인증·모바일 최적화는 고려하지 않는다
- 720px 이하 미디어쿼리가 있지만 "깨지지 않는" 수준이지 모바일 지원 목표는 아니다
- 데이터는 이 브라우저의 `localStorage`에만 있다. 내보내기/가져오기 없음

## 데이터 모델

`localStorage` 키: **`routine-cal-v1`** (이 키를 바꾸면 기존 데이터가 사라진다). 값은 아래 객체의 JSON.

```
{
  pages: Page[],
  events: Event[],
  settings: Settings
}
```

### Page (루틴 페이지)

| 필드 | 타입 | 설명 |
|---|---|---|
| `id` | string | `uid()` 로 생성한 7자리 랜덤 문자열 |
| `name` | string | 페이지 이름. 빈 문자열이면 UI에 "(이름 없음)" |
| `color` | number | 0~5. `PCOL` 팔레트 인덱스 (`--p0`~`--p5`) |
| `active` | boolean | 켜져 있어야 주간 뷰에 표시되고 겹침 검사 대상이 된다 |
| `items` | Item[] | 이 페이지의 루틴 목록 |

### Item (루틴 한 칸)

| 필드 | 타입 | 설명 |
|---|---|---|
| `id` | string | `uid()` |
| `day` | number | 0=월 … 6=일 (`wd()` 기준, `Date.getDay()` 와 다름) |
| `start` | string | `"HH:MM"` 24시간제 |
| `end` | string | `"HH:MM"`. `start`/`end` 중 하나라도 비어 있으면 뷰·검사에서 무시 |
| `label` | string | 표시 이름. 비어 있으면 페이지 이름으로 대체 |

### Event (약속)

| 필드 | 타입 | 설명 |
|---|---|---|
| `id` | string | `uid()` |
| `title` | string | 제목. 비어 있으면 "(제목 없음)" |
| `startDate` | string | `"YYYY-MM-DD"` |
| `endDate` | string | `"YYYY-MM-DD"`. `startDate` 보다 앞이면 `startDate` 로 취급 |
| `startTime` | string | `"HH:MM"`. 기간 내 모든 날짜에 같은 시간대로 적용 |
| `endTime` | string | `"HH:MM"`. 저장 시 `startTime` 보다 늦어야 함 |

### Settings

| 필드 | 타입 | 설명 |
|---|---|---|
| `defaultStart` | string | 새 약속의 기본 시작 시간 `"HH:MM"` (초기값 `"10:00"`) |
| `defaultDur` | number | 새 약속의 기본 길이(분, 최소 5, 초기값 60) |

`load()` 는 저장값에 `pages` 와 `events` 가 있으면 그대로 쓰고, 아니면 빈 상태로 시작한다. 마이그레이션 로직은 없다.

## 충돌(겹침) 규칙

- **검사 대상은 활성(`active: true`) 페이지의 `start`·`end` 가 모두 있는 아이템뿐.** 비활성 페이지는 어디에서도 검사하지 않는다
- **겹침 판정**: `a.start < b.end && b.start < a.end` (분 단위). 끝나는 시각과 시작 시각이 같으면 겹치지 않는다
- **약속 ↔ 루틴** (`eventConflicts`): 약속의 `startDate`~`endDate` 각 날짜의 요일(월=0)과 같은 `day` 인 활성 아이템 중 시간이 겹치는 것을 `{date, item}` 목록으로 반환
  - 약속 모달에서 입력할 때마다 재계산해 경고 박스 표시 (최대 8건 + "외 N개")
  - 월간 뷰: 해당 날짜의 약속 앞에 점 표시. 주간 뷰: 약속 블록 테두리를 경고색으로
  - **경고만 하고 저장은 막지 않는다**
- **루틴 페이지 ↔ 루틴 페이지** (`pageConflicts`): 페이지를 켤 때, 다른 활성 페이지 아이템과 같은 `day` 에 시간이 겹치는 쌍을 찾아 토스트로 알린다 (최대 6건). **양쪽 모두 활성 상태로 유지**한다. 끌 때는 검사하지 않는다
- 같은 페이지 안의 아이템끼리는 검사하지 않는다
- 페이지 편집 그리드에는 다른 활성 페이지의 아이템이 흐리게 깔려 보인다 (참고용, 클릭 불가)

## 코드 구조 (`app.js`)

세 섹션으로 나뉜 IIFE 하나. 더 쪼개지 말 것.

1. **상태 · 충돌 로직**: 상수(`KEY`, `DAYS`, `PCOL`), 유틸(`toMin`, `fromMin`, `ymd`, `wd`, `overlap`…), `load`/`save`, `view` 상태, `activeItems`/`eventConflicts`/`pageConflicts`
2. **렌더링**: `render()` 가 `#app` 을 통째로 다시 그린다. `h()` 로 DOM 생성. 사이드바, 월간, 주간, 페이지 편집기, 드래그 그리드, 라벨 편집기
   - 편집 그리드 블록 조작(`renderEditGrid`): 본체 드래그=이동(요일 간 이동 가능), 상단/하단 6px 핸들(`.rs`)=시작/끝 조절. 30분 스냅, 최소 30분, 06:00~24:00 안으로 클램프. 5px 미만 움직임은 클릭(이름 편집기). 드래그 중엔 시간 텍스트만 바꾸고 놓을 때 `save()`+`render()`. 블록을 누르면 열려 있던 이름 편집기는 `settleLabelEditor()` 로 렌더 없이 확정한다 (드래그 도중 재렌더 방지)
3. **이벤트 모달 · 설정 · 토스트**: `openEvent`, `openSettings`, `toast`

상태가 바뀌면 `save()` 후 `render()` 를 호출하는 단순한 방식. 부분 갱신·가상 DOM 없음.

## 작업 시 주의

- 기능 추가·디자인 변경보다 현재 동작 유지가 우선. 동작이 바뀌는 수정은 먼저 확인
- `KEY` 값과 위 데이터 모델의 필드명은 기존 `localStorage` 데이터와 호환되어야 한다
- 프레임워크·빌드 도구·파일 추가 분할 금지
