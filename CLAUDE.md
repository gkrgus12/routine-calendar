# 루틴 캘린더

요일별 루틴(시간표)을 페이지 단위로 만들어 켜고 끄고, 날짜별 약속을 등록하면 활성 루틴과 겹치는 시간을 경고해 주는 개인용 캘린더.

## 스택

- 바닐라 JS (ES2015+), 프레임워크·번들러·빌드 도구 없음
- 파일 3개: `index.html`(마크업), `styles.css`(스타일), `app.js`(전체 로직, IIFE 하나)
- 저장소는 `localStorage` 한 키뿐. 서버·백엔드 없음
- `manifest.json` + `icon.svg` 로 PWA(standalone) 설치 가능. 서비스 워커는 없음
- 폰트는 시스템 폰트 스택(-apple-system / Segoe UI / Apple SD Gothic Neo / Malgun Gothic …). 외부 CDN 없음
- UI는 iOS 느낌: `styles.css` 상단의 토큰으로 관리. 사이드바·상단바·모달·토스트·라벨 팝오버는 반투명 유리(`--glass`, backdrop-filter), 배경은 그라데이션. 캘린더 격자·표·루틴/약속 블록은 불투명(`--panel`, `--grid-line`) — 페이지 색 구분이 기능이라 투명도를 주지 않는다. 라이트/다크는 `prefers-color-scheme` 과 `:root[data-theme]` 둘 다 지원

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
| `colorByLabel` | boolean | 기본 false. 켜면 이 페이지 블록 색을 라벨별 변형색으로 배정 (아래 "라벨 색·형제 블록") |
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
| `theme` | string | `"system"` \| `"light"` \| `"dark"`. 없으면 system(OS 설정 따름). 설정 모달 일반 탭에서 바꾸며 `applyTheme()` 이 `<html data-theme>` 에 반영 |
| `weekStart` | string | `"mon"` \| `"sun"`. 없으면 mon. 월간·주간·편집 그리드·표·요일 체크박스의 **표시 순서만** 바뀌고 데이터의 `day`(0=월)는 그대로 (`dayOrder()`, `dayPos()`, `weekStartOf()`) |
| `dayStart` | number | 주간 뷰·편집 그리드가 보여줄 시작 시(0~23). 없으면 6 |
| `dayEnd` | number | 끝 시(1~24, `dayStart` 보다 커야 함). 없으면 24. 범위 밖 루틴은 잘려 보이거나(일부) 그리드에서 안 보이지만(전부 밖) 데이터·표는 그대로 |

저장값에 없는 설정 키는 `cfg(key)` 가 `SETTINGS_DEFAULTS` 로 채워 읽는다. 설정 모달(`openSettings(tab)`, 상단바 ⚙ 설정)은 좌측 탭 일반(테마·주 시작 요일·시간 범위) / 약속(기본 시작·길이) / 백업 으로 나뉘고, 값은 바꾸는 즉시 `save()`+`render()` 된다(저장 버튼 없음).

`load()` 는 저장값에 `pages` 와 `events` 가 있으면 그대로 쓰고, 아니면 빈 상태로 시작한다. 마이그레이션 로직은 없다.

## 충돌(겹침) 규칙

- **검사 대상은 활성(`active: true`) 페이지의 `start`·`end` 가 모두 있는 아이템뿐.** 비활성 페이지는 어디에서도 검사하지 않는다
- **겹침 판정**: `a.start < b.end && b.start < a.end` (분 단위). 끝나는 시각과 시작 시각이 같으면 겹치지 않는다
- **약속 ↔ 루틴** (`eventConflicts`): 약속의 `startDate`~`endDate` 각 날짜의 요일(월=0)과 같은 `day` 인 활성 아이템 중 시간이 겹치는 것을 `{date, item}` 목록으로 반환
  - 약속 모달에서 입력할 때마다 재계산해 경고 박스 표시 (최대 8건 + "외 N개")
  - 월간 뷰: 해당 날짜의 약속 앞에 점 표시. 주간 뷰: 약속 블록 테두리를 경고색으로
  - **경고만 하고 저장은 막지 않는다**
- **루틴 페이지 ↔ 루틴 페이지** (`pageConflicts`): 페이지를 켤 때, 다른 활성 페이지 아이템과 같은 `day` 에 시간이 겹치는 쌍을 찾아 토스트로 알린다 (최대 6건). **양쪽 모두 활성 상태로 유지**한다. 끌 때는 검사하지 않는다
- 같은 페이지 안의 아이템끼리는 충돌 검사(토스트·약속 경고)에 넣지 않는다. 대신 편집 그리드에서만 경고색 테두리(`.ovl`)와 툴팁 "같은 페이지 루틴과 겹침"으로 표시한다
- 페이지 편집 그리드에는 다른 활성 페이지의 아이템이 흐리게 깔려 보인다 (참고용, 클릭 불가)

## 라벨 색 · 형제 블록 (페이지 편집기)

- 라벨 정규화 `labelKey()`: trim + 연속 공백을 하나로. 색과 형제 판정 모두 이 키로 비교
- **같은 이름끼리 같은 색** (`page.colorByLabel`): `blockStyle()` 이 현재 테마의 `--p0..--p5` 실제 색을 HSL 로 읽어(`refreshPalette()`, render 마다) 라벨 해시(FNV-1a) % 6 으로 고른 변형(`LABEL_VARIANTS`: 명도 -16/-8/+8/+16/+24/+32%p 사다리 + 채도 ±8~12%p, 색상 유지; 기본색이 밝은 다크 팔레트에서는 명도 방향을 반대로)을 배경으로 준다. 명도가 62% 를 넘으면 글자색을 어둡게. 이름 없는 블록은 기본색. 편집 그리드·주간 뷰 모두 적용, 꺼진 페이지는 단색
- **형제 블록** `siblingsOf(p,it)`: 같은 페이지에서 시작·끝·라벨키가 같은 블록들(요일만 다름). 라벨 편집창의 월~일 체크박스는 형제가 있는 요일이 체크되며, 현재 블록의 요일은 해제 불가
  - 체크: 입력 중인 이름을 `commitLabel()` 로 형제 전체에 확정한 뒤 그 요일에 같은 시간·이름 블록 생성. 해제: 그 요일 형제 삭제. 둘 다 `pendingEdit` 로 다시 그린 뒤 편집기를 같은 블록에 재오픈
  - 이름 확정(Enter/blur/드래그 전 settle)은 형제 전체의 이름을 바꾼다. 시간은 각자 독립이라 표·드래그로 한 요일 시간을 바꾸면 그 블록은 형제에서 빠진다(체크 해제로 보임)
  - ✕ 삭제는 현재 블록만

## 백업 (JSON 내보내기/가져오기)

- 설정 모달(상단바 ⚙ 설정, 모든 뷰) 의 백업 탭. 내보내기는 `routine-calendar-YYYY-MM-DD.json` 다운로드, 가져오기는 파일 선택 → 미리보기(페이지·루틴·약속 수) → 덮어쓰기 / 합치기
- 파일 형식: `{ version: 1, exportedAt: ISO 문자열, pages, events, settings }`. `version` 이 1이 아니면 거부
- `validateBackup()` 은 모든 레코드를 엄격히 검사(id 문자열, day 0~6, HH:MM, YYYY-MM-DD, 같은 배열 안 id 중복 없음)하고 알려진 필드만 복사한 새 객체를 만든다. 실패하면 에러 토스트만 띄우고 기존 데이터는 그대로
- 덮어쓰기: `confirm` 후 `S` 전체 교체(설정·테마 포함). 합치기(`mergeBackup`): id 기준 중복 제거 — 새 id 의 페이지·약속만 추가하고, 같은 id 페이지는 기존 것을 두고 그 안의 새 id 루틴만 추가. 설정은 유지

## 코드 구조 (`app.js`)

세 섹션으로 나뉜 IIFE 하나. 더 쪼개지 말 것.

1. **상태 · 충돌 로직**: 상수(`KEY`, `DAYS`, `PCOL`), 유틸(`toMin`, `fromMin`, `ymd`, `wd`, `overlap`…), `load`/`save`, `applyTheme`, 설정 기본값(`SETTINGS_DEFAULTS`, `cfg`, `dayOrder`, `weekStartOf`), 백업 검증·합치기(`validateBackup`, `mergeBackup`), `view` 상태, `activeItems`/`eventConflicts`/`pageConflicts`
2. **렌더링**: `render()` 가 `#app` 을 통째로 다시 그린다. `h()` 로 DOM 생성. 사이드바, 월간, 주간, 페이지 편집기, 드래그 그리드, 라벨 편집기
   - 주간 뷰 겹침 배치(`layoutOverlaps`): 같은 요일에서 겹치는 루틴 블록은 이어져 겹치는 묶음별로 열을 배정해 폭을 n등분(구글 캘린더 방식). 3열 이상이면 라벨을 빼고 title 툴팁만. 겹치지 않는 블록은 기본 폭. 약속 블록은 대상 아님
   - 편집 그리드 블록 조작(`renderEditGrid`): 본체 드래그=이동(요일 간 이동 가능), 상단/하단 6px 핸들(`.rs`)=시작/끝 조절. 30분 스냅, 최소 30분, 06:00~24:00 안으로 클램프. 5px 미만 움직임은 클릭(이름 편집기). 드래그 중엔 시간 텍스트만 바꾸고 놓을 때 `save()`+`render()`. 블록을 누르면 열려 있던 이름 편집기는 `settleLabelEditor()` 로 렌더 없이 확정한다 (드래그 도중 재렌더 방지)
3. **이벤트 모달 · 설정 · 토스트**: `openEvent`, `openSettings`(탭: 일반/약속/백업, `exportBackup` 포함), `toast`

상태가 바뀌면 `save()` 후 `render()` 를 호출하는 단순한 방식. 부분 갱신·가상 DOM 없음.

## 작업 시 주의

- 기능 추가·디자인 변경보다 현재 동작 유지가 우선. 동작이 바뀌는 수정은 먼저 확인
- `KEY` 값과 위 데이터 모델의 필드명은 기존 `localStorage` 데이터와 호환되어야 한다
- 프레임워크·빌드 도구·파일 추가 분할 금지
