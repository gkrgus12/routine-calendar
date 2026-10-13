# 루틴 캘린더 — 현재 상태 (2026-10-13 기준)

코드(`app.js`, `styles.css`, `index.html`, `config.js`, `manifest.json`)와 저장소 문서(`CLAUDE.md`, `README.md`, `docs/design-review.md`)를 읽고 확인한 사실만 적는다. 추측·계획은 넣지 않는다.

## 1. 기능 목록 (사용자 관점)

### 루틴 페이지
- 사이드바 `+ 새 루틴 페이지` 로 페이지 생성 (이름 "새 페이지", 색은 페이지 수 순환, 비활성 상태로 시작).
- 페이지 이름 입력, 6색 스와치로 색 선택.
- 활성/비활성 토글: 사이드바 스위치 또는 페이지 상단 `활성화`/`비활성화` 버튼. 켤 때 다른 활성 페이지와 겹치는 시간이 있으면 토스트로 목록(최대 6건 + "외 N개")을 알리고 둘 다 켠 채로 둔다. 끌 때는 검사하지 않는다.
- 페이지 삭제 (브라우저 `confirm`).
- `같은 이름끼리 같은 색` 토글: 라벨별로 페이지 색의 밝기·채도를 바꿔 배정.
- 편집 그리드: 빈 칸 드래그로 루틴 생성(30분 단위), 블록 본체 드래그로 이동(다른 요일로도), 위·아래 가장자리로 시작/끝 조절(30분 스냅, 최소 30분), 하단을 24:00 넘겨 당기면 다음 날까지 이어지는 루틴. 다른 활성 페이지의 루틴은 흐리게 깔림(클릭 불가). 같은 페이지 안에서 겹치는 블록은 경고 테두리 + 툴팁.
- 블록 클릭 → 이름 편집기: 이름 입력(Enter 확정 / Esc 취소), ✕ 삭제, 월~일 체크박스로 같은 시간·이름 블록을 다른 요일에 만들거나 지움(현재 요일은 해제 불가). 이름 확정은 같은 시간·이름의 형제 블록 전체에 적용.
- 표: 요일 select, 시작/끝 `time` 입력, 이름 입력, ✕ 삭제. `+ 루틴 추가`(마지막 항목 뒤 1시간), `월요일을 평일에 복사`(화~금).
- 설정 시간 범위 밖은 그리드 위아래 띠로 접히고, 클릭하면 그 페이지에서만 펼쳐진다.

### 캘린더 뷰
- 월간·주간·일간. 상단바: 왼쪽 제목, 가운데 일간/주간/월간 세그먼트, 오른쪽 `‹ 오늘 ›`. 월간·일간에는 `+ 약속` 버튼. 마지막으로 본 뷰를 기억.
- 월간: 6주(마지막 주가 전부 다음 달이면 5주) 격자, 날짜 칸 클릭으로 약속 추가, 칩 클릭으로 편집, 종일 약속은 칸 상단 한 줄, 활성 루틴과 겹치는 약속에 점 표시, 오늘 강조, 평일/주말 헤더 구분.
- 주간(7열)·일간(1열): 활성 루틴 블록(배경, 설정한 불투명도), 같은 요일에서 겹치는 루틴은 폭을 n등분(3개 이상이면 라벨 생략), 약속 블록(채움 + 왼쪽 띠, 60분 이상이면 시간 줄), 종일 약속 줄(있을 때만), 범례 칩, 오늘 열의 현재 시각 선 + 시각 pill(1분마다 갱신), 범위 밖 접힌 띠(그 주/그 날의 루틴·약속 개수 표시, 클릭 펼침).
- 주간·일간의 빈 시간 드래그로 약속 생성(30분 스냅, 고스트 표시). 5px 미만 움직임은 클릭 = 그 슬롯부터 기본 길이.
- 약속 블록 드래그: 본체를 끌면 이동(주간은 다른 날 열로도), 위·아래 가장자리를 끌면 시작/끝 조절(30분 스냅, 최소 30분, 끝은 23:59 까지). 드래그 중 활성 루틴과 겹치면 경고 테두리 미리 표시. 놓으면 로컬 약속은 저장, 구글 이벤트는 `start`/`end` 만 PATCH(실패 시 원위치 + 토스트). 5px 미만 움직임은 클릭 = 편집. 종일 약속과 자정 넘김·여러 날 조각은 클릭만. 월간 뷰 드래그와 반복 이벤트 전체 시리즈 이동은 범위 밖.
- 자정을 넘긴 루틴·약속은 두 조각(첫날 아래쪽, 다음 날 위쪽)으로 표시.
- 활성 페이지가 없어도 그리드는 그리고 위에 안내 한 줄.

### 약속
- 필드: 제목, 시작일, 종료일, 시작 시간, 끝 시간, 메모(여러 줄). 시작일을 종료일보다 뒤로 바꾸면 종료일을 따라 맞춤.
- 입력할 때마다 활성 루틴과의 겹침을 계산해 경고 박스(최대 8건 + "외 N개"). 경고만 하고 저장은 막지 않는다.
- 검증: 날짜·시간 모두 필요, 종료일 ≥ 시작일, 같은 날이면 끝 > 시작.
- 데스크톱 폭(창 너비 > 720px)은 클릭 지점 옆 팝오버, 그 이하는 하단 시트.
- 미연결 상태: 브라우저 `localStorage` 에 저장되고 "임시" 배지가 붙는다. 연결 상태: 구글 캘린더에 바로 저장·수정·삭제된다(아래 3절).

### 설정 (사이드바 맨 아래 ⚙, 하단 시트, 바꾸는 즉시 저장)
- 일반: 테마(시스템/라이트/다크), 주 시작 요일(월/일), 주간·편집 그리드 시간 범위(시작 0~23시, 끝 1~24시), 루틴 블록 불투명도(5~100%), 시간당 높이(높이 맞춤 / 고정 24~80px).
- 약속: 새 약속 기본 시작 시간, 기본 길이(분, 최소 5), 약속 색(6색 중 하나, 모든 약속에 공통).
- 구글: 연결 / 연결 해제 / 새로고침(목록·이벤트 재조회), 로그인 유지 체크, 읽을 캘린더 체크박스(이름·색 점, 기본 캘린더는 고정, 읽기 전용 표시), 로컬 약속을 구글로 옮기기, 서드파티 쿠키·팝업 허용 안내.
- 백업: JSON 내려받기(`routine-calendar-YYYY-MM-DD.json`), 파일 선택 → 미리보기(페이지·루틴·약속 수) → 덮어쓰기(`confirm`) 또는 합치기.

### 기타
- `index.html` 을 열면 빌드 없이 동작(`file://` 포함, 단 구글 OAuth 팝업은 `file://` 에서 동작하지 않는다 — README).
- PWA `manifest.json`(standalone) + `icon.svg`. 서비스 워커 없음(오프라인 캐시 없음).
- 라이트/다크: OS 설정 따름 또는 고정. `prefers-reduced-motion` 이면 애니메이션·전환 전부 즉시.
- 720px 이하 미디어쿼리가 있으나 모바일 지원이 목표는 아니다(CLAUDE.md "범위").

## 2. 데이터 모델

### localStorage (이 브라우저에만 있음, 서버 없음)

| 키 | 값 | 용도 |
|---|---|---|
| `routine-cal-v1` | `{pages, events, settings}` JSON | 본 데이터. 키를 바꾸면 기존 데이터가 사라진다 |
| `routine-cal-view` | `"day"` \| `"week"` \| `"month"` | 마지막 캘린더 뷰. 백업에 포함되지 않음 |
| `routine-cal-google-linked` | `"1"` | 구글에 연결한 적 있음 플래그(로드 시 조용한 재연결 근거) |
| `routine-cal-google-hint` | 이메일 문자열 | 마지막 연결 계정. GIS `hint` 로 넘겨 계정 선택을 건너뜀 |
| `routine-cal-google-cals` | 캘린더 id JSON 배열 | 읽을 캘린더 선택(기본 캘린더는 항상 읽음). 해제 시 삭제 |

구글 토큰은 메모리(`G.token`)에만 있고 어디에도 저장하지 않는다.

`load()` 는 저장값에 `pages` 와 `events` 가 있으면 그대로 쓰고, 아니면 `{pages:[], events:[], settings:{defaultStart:'10:00', defaultDur:60}}` 으로 시작한다. 마이그레이션 로직은 없다.

### Page

| 필드 | 타입 | 설명 |
|---|---|---|
| `id` | string | 7자리 랜덤(`uid()`) |
| `name` | string | 빈 문자열이면 "(이름 없음)" |
| `color` | number | 0~5, `--p0`~`--p5` |
| `active` | boolean | 켜져 있어야 뷰 표시·겹침 검사 대상 |
| `colorByLabel` | boolean | 라벨별 변형색 |
| `items` | Item[] | |

### Item (루틴 한 칸)

| 필드 | 타입 | 설명 |
|---|---|---|
| `id` | string | |
| `day` | number | 0=월 … 6=일 |
| `start`, `end` | string | `"HH:MM"`. 둘 중 하나라도 비면 무시. `end < start` 면 자정을 넘겨 다음 요일 `end` 까지. `end == start` 는 무시 |
| `label` | string | 비어 있으면 페이지 이름으로 표시 |

### Event (로컬 약속)

| 필드 | 타입 | 설명 |
|---|---|---|
| `id` | string | |
| `title` | string | |
| `startDate`, `endDate` | string | `"YYYY-MM-DD"`. `endDate < startDate` 면 `startDate` 로 취급 |
| `startTime`, `endTime` | string | `"HH:MM"`. 기간 내 모든 날짜에 같은 시간대. 종료일이 다음 날이고 `endTime < startTime` 이면 자정을 넘긴 하나의 약속 |
| `note` | string | 선택. 예전 데이터엔 키가 없을 수 있음 |

### Settings (없는 키는 기본값으로 읽음)

| 필드 | 기본값 | 범위 |
|---|---|---|
| `defaultStart` | `"10:00"` | HH:MM |
| `defaultDur` | 60 | 분, 최소 5 |
| `theme` | `"system"` | system / light / dark |
| `weekStart` | `"mon"` | mon / sun (표시 순서만) |
| `dayStart` | 6 | 0~23 |
| `dayEnd` | 24 | 1~24, `dayStart` 보다 커야 함 |
| `googleKeepLogin` | true | |
| `routineAlpha` | 22 | 5~100 (%) |
| `eventColor` | 0 | 0~5, `--e0`~`--e5` |
| `hourHeight` | `"fit"` | `"fit"` 또는 24~80 (px) |

### 백업 파일
`{version:1, exportedAt, pages, events, settings}`. 가져올 때 `version` 이 1이 아니면 거부. 모든 레코드를 검사(id 문자열, day 0~6, HH:MM, YYYY-MM-DD, 같은 배열 안 id 중복 없음)하고 알려진 필드만 복사한다. 로컬 약속만 들어간다(구글 이벤트는 포함되지 않음).

### 구글 캘린더에 저장되는 것
- 연결 상태에서 만든 약속은 로컬에 저장되지 않고 primary 캘린더의 이벤트로 저장된다. 보내는 필드: `summary`(제목), `description`(메모), `start`/`end`(시간이면 `dateTime`+`timeZone`, 종일이면 `date`).
- 읽어 온 이벤트는 화면용 객체로만 존재한다(`id:'g:<구글 id>'`, 여러 날에 걸친 시간 이벤트는 날짜별 조각 `'g:<id>:<날짜>'`, `google:true`, `gid`, `raw`, `allDay`, `recurring`, `link`, `note`=description, `seg`, `cal`=속한 캘린더). `localStorage` 에는 쓰지 않는다.

## 3. 구글 연동 상태

- **방식**: 서버 없이 브라우저에서 Google Identity Services 토큰 클라이언트 + Calendar API v3 를 직접 호출. GIS 스크립트(`accounts.google.com/gsi/client`)는 연결을 시도할 때만 로드. 클라이언트 ID 는 `config.js` 의 `GOOGLE_CLIENT_ID`(저장소에 커밋됨, 공개값).
- **스코프**: 요청은 `calendar.events`(필수) + `calendar.calendarlist.readonly`(선택, 읽을 캘린더 목록용). 토큰에 `calendar.events`(또는 전체 권한 `calendar`)가 없으면 토큰을 버리고 미연결. 목록 스코프(또는 `calendar`/`calendar.readonly`)가 없으면 연결은 유지하되 primary 만 읽고 구글 탭에 "다시 연결 (권한 허용)"(`prompt:'consent'`).
- **호출하는 API**:

| 용도 | 호출 |
|---|---|
| 계정 이메일 | `GET calendars/primary/events?maxResults=1&fields=summary` (primary 캘린더의 `summary` = 이메일) |
| 읽을 캘린더 목록 | `GET users/me/calendarList?fields=items(id,summary,summaryOverride,backgroundColor,accessRole,primary)` (목록 스코프 있을 때만, 403 이어도 연결 유지) |
| 이벤트 읽기 | 읽을 캘린더마다 병렬 `GET calendars/{id}/events?timeMin&timeMax&singleEvents=true&orderBy=startTime&maxResults=2500` (+`pageToken` 반복) |
| 추가 | `POST calendars/primary/events` |
| 수정 / 삭제 | `PATCH` / `DELETE calendars/{이벤트가 속한 캘린더 id}/events/{id}` |

- **읽기 범위**: 표시 중인 달 ±1개월(`[전달 1일, 다다음달 1일)`), 기본 캘린더 + 체크한 캘린더. 캐시는 캘린더별이라 체크 해제·재체크는 조회 없이 조립만 하고, 달이 바뀌거나 새로 체크한 캘린더만 조회. 쓰기 뒤에는 그 캘린더만 재조회. `cancelled` 는 버림. 종일 이벤트의 `end.date` 는 exclusive 라 하루 뺌. 여러 날에 걸친 시간 이벤트는 날짜별 조각으로 표시(최대 62일).
- **쓰기 범위**: 제목·메모·시작·끝만(블록 드래그는 `start`/`end` 만 PATCH). 읽기 권한뿐인 공유 캘린더(accessRole reader/freeBusyReader)의 일정은 폼에 안내 + 저장·삭제 비활성, 드래그 불가. 종일 이벤트는 폼에 00:00~23:59 로 보이고 그대로 저장하면 종일 유지. 반복 일정은 `singleEvents` 인스턴스 id 로 PATCH/DELETE 하므로 "이 일정만" 바뀐다. 실패하면 토스트에 "상태코드 메시지" 를 보이고 로컬 상태는 바꾸지 않는다.
- **충돌 검사**: 시간 있는 구글 이벤트는 로컬 약속과 같은 규칙으로 활성 루틴과 검사. 종일 이벤트는 검사하지 않음.
- **상태** `G.status`: `off` / `connecting` / `on` / `expired`. API 401 또는 `expires_in` 경과 → `expired`, 이벤트 비움, 탭에 "다시 연결".
- **재연결**:
  - 페이지 로드 시 `googleKeepLogin` 이 켜져 있고 연결 플래그가 있으면 `prompt:'none'` + `hint` 로 UI 없이 재연결. 실패하면(`consent_required`, `interaction_required`, 쿠키·팝업 차단 등) 자동 팝업 없이 `expired` + 안내 + "다시 연결" 버튼. 플래그는 유지.
  - 수동 연결은 `prompt:''` + `hint`.
  - 토큰 `scope` 부족 또는 API 403 scope 부족(메시지 "insufficient authentication scopes" / `errors[].reason` `insufficientPermissions` / `details[].reason` `ACCESS_TOKEN_SCOPE_INSUFFICIENT`) → 미연결(`expired`) + `needConsent`, 버튼이 "다시 연결 (권한 허용)" 으로 바뀌고 `prompt:'consent'` 로 동의 화면을 다시 띄운다. `needConsent` 는 메모리에만 있다.
  - `연결 해제`: 토큰 revoke + 구글 이벤트 제거 + 플래그·힌트 삭제. 로컬 데이터는 그대로.
  - 흐름은 콘솔 `[gcal]` 로그로 남긴다.
- **알려진 제약**
  - 토큰을 저장하지 않으므로 새로고침마다 재연결(조용한 재연결 또는 수동).
  - Chrome 이 서드파티 쿠키나 팝업을 막으면 조용한 재연결이 실패한다(탭에 허용 안내).
  - `file://` 로 열면 OAuth 팝업이 동작하지 않는다(README). 승인된 JavaScript 원본에 배포 주소와 `http://localhost:8000` 등록 필요.
  - `<input type="time">` 이 24:00 을 표시하지 못해 자정에 끝나는 이벤트는 다음날 00:00 으로, 드래그 생성 끝 시간은 23:59 까지.
  - 미연결 상태에서 만든 로컬 약속은 연결 후 배지 없이 편집·삭제만 되고, 구글 탭의 "옮기기" 로 날짜마다 이벤트 하나씩 만들어 옮긴다(성공한 것만 로컬에서 삭제).
  - 범위 밖(CLAUDE.md): 루틴 업로드, 캘린더별 색, 캘린더 간 이동, 참석자·알림·장소, 반복 규칙 편집.
  - 커밋 `07eb7f4`(연결 시 403 수정)는 GIS·fetch 를 스텁한 헤드리스 Chrome 으로 검증했고, 실제 구글 계정으로의 연결은 이 커밋 이후 저장소에 기록된 확인이 없다.

## 4. 구조

| 파일 | 줄 수 | 역할 |
|---|---|---|
| `index.html` | 17 | 마크업. `#app` 하나, `config.js` → `app.js` 순서로 로드 |
| `app.js` | 1,259 | 전체 로직. IIFE 하나, 세 섹션: ① 상태·충돌 로직(1~360: 상수·유틸·`load`/`save`·설정 기본값·백업 검증·합치기·구글 연동·겹침 계산) ② 렌더링(361~962: 모션 `anim()`/스프링, `render()`/`h()`, 라벨 색, 그리드 높이, 사이드바, 월간·주간·일간, 페이지 편집기, 편집 그리드, 이름 편집기) ③ 이벤트 모달·설정·토스트(963~1259: 하단 시트, 팝오버, `openEvent`, `exportBackup`, `openSettings`, `toast`, 부트) |
| `styles.css` | 397 | 토큰(라이트/다크, 유리·불투명 패널, 팔레트 `--p0..5`, `--e0..5`) + 컴포넌트. 미디어쿼리: `prefers-color-scheme`, `max-width:720px`, `prefers-reduced-motion` |
| `config.js` | 3 | `var GOOGLE_CLIENT_ID` |
| `manifest.json` | 14 | PWA(standalone, 아이콘 `icon.svg`) |
| `icon.svg` | 12 | 앱 아이콘 |
| `README.md` | 16 | GitHub Pages 배포, 구글 연결 설정 |
| `CLAUDE.md` | 184 | 작업 규칙·데이터 모델·충돌 규칙·룩·구글·백업·코드 구조 |
| `docs/design-review.md` | 104 | iOS/macOS 참고 이미지 대비 룩·모션 비교표와 검증 메모 |
| `docs/ref/` | 7개 PNG | 참고 이미지(iOS 4, macOS 3) |
| `docs/shots/` | 47개(GIF 10, PNG 37) | 앱 스크린샷·비교 그림·모션 프레임 |
| `tests/` | `run.py`, `lib.js`, `t-*.html` 6개, `README.md` | 헤드리스 Chrome 회귀 하네스 (6절) |

- 의존성: 런타임 외부 의존성 없음(프레임워크·번들러·빌드·npm·CDN·외부 폰트 없음). 구글 연동 시에만 `accounts.google.com/gsi/client` 와 `www.googleapis.com/calendar/v3` 에 접근.
- 상태 변경은 `save()` 후 `render()` 로 `#app` 전체를 다시 그린다(부분 갱신·가상 DOM 없음). 모달·시트·팝오버·토스트는 `body` 에 붙어 렌더에 지워지지 않는다.
- 모션은 Web Animations API(`anim()`, `springEasing()`), 세로 좌표는 CSS 변수 `--px`(시간당 높이).
- 저장소: 브랜치 `main` 하나, `.gitignore`·CI 설정·패키지 파일 없음.

## 5. 미완 · 보류 · 알려진 버그

- 코드 안 `TODO`/`FIXME` 주석: 없음.
- 저장소 문서에 기록된 알려진 버그: 없음. 최근 고친 버그: 연결 시 403(`07eb7f4`); 종료일이 시작일보다 앞선 약속(폼은 막지만 백업 파일·저장값으로는 들어올 수 있음)을 그릴 때 `eventSegs`/`indexEvents`/`migrateLocalEvents` 가 시작·끝에 같은 Date 객체를 써서 무한 루프에 빠지던 것(하네스 복원 때 `t-conflicts.html` 이 발견).
- 범위 밖으로 명시된 것(CLAUDE.md, docs/design-review.md): 다중 사용자·동기화·인증·모바일 최적화, 모바일 레이아웃, 햅틱·제스처 내비게이션, 아이콘 세트, 팝오버 드래그 이동, 일간 뷰의 미니 달력, 루틴 업로드, 캘린더별 색, 캘린더 간 이동, 참석자·알림·장소, 반복 규칙 편집.
- 구현되지 않은 것(코드 기준): 월간 뷰의 약속 드래그, 반복 이벤트 전체 시리즈 이동, 서비스 워커(오프라인), 데이터 마이그레이션, 구글 이벤트의 백업 포함.
- `docs/design-review.md` 의 "검증 메모" 에 적힌 룩·모션 회귀 하네스(25종)와 상단바 배치 검사(34건)는 저장소에 없다. 그중 팝오버 배치만 `tests/t-popover.html` 로 다시 만들었다.

## 6. 테스트

- 러너: `python tests/run.py` (헤드리스 Chrome 필요, 못 찾으면 환경변수 `CHROME` 에 경로). 임시 로컬 HTTP 서버로 저장소를 서빙하고 `tests/t-*.html` 을 각각 새 프로필의 헤드리스 Chrome 으로 연다(`--force-prefers-reduced-motion`, 가상 시간). 페이지가 남긴 `<pre id="RESULT">` JSON 의 PASS/FAIL 을 모아 출력하고, 실패가 하나라도 있으면 종료 코드 1. 린트·빌드·CI 는 없다.
- 공용 `tests/lib.js`: `app.js` 원문을 받아 IIFE 래퍼를 벗겨 평가하고 내부 함수·상태를 `RC.<이름>` 으로 노출한다. 프로덕션 코드에 테스트용 훅은 없다.
- 문서에 기록된 프레임 캡처 방식(`document.getAnimations()` 를 원하는 시각에 멈춰 찍기)의 결과물은 `docs/shots/` 와 `docs/design-review.md`.

| 하네스 | 커버 범위 |
|---|---|
| `t-conflicts.html` | `overlap`, `itemSegs`(자정 넘김·일→월·`end==start`·빈 시간), `eventSegs`(여러 날·자정 넘김·종일·종료일<시작일), `eventConflicts`(활성 페이지만·끝=시작 비겹침·여러 날·자정 꼬리/머리), `pageConflicts`(같은 페이지·비활성 제외), 페이지 켤 때 토스트와 양쪽 활성 유지, 월간 칩 겹침 점, 약속 폼 경고 박스 |
| `t-backup.html` | `validateBackup` 통과(알 수 없는 필드 제거, `note` 처리, 24:00 허용, settings 복사)·거부(version, 구조, id 중복, day·시간·날짜 형식, settings 범위)·정규화(theme 미지원 값 버림, color 순환, active/name 타입), `mergeBackup` 집계와 상태, 설정 모달 백업 탭에서 파일 선택 → 미리보기 → 합치기, 깨진 JSON 거부 |
| `t-google-scope.html` (변형 A·B·C·D) | GIS·fetch 스텁: A 정상 토큰 → 연결·이메일·events.list·POST/PATCH/DELETE 403 없음, B `calendar.events` 없는 토큰 → 미연결 + "다시 연결 (권한 허용)" + `prompt:'consent'` → 연결, C API 403 scope 부족 → 같은 처리, D 로드 시 `prompt:'none'`+`hint` 조용한 재연결 |
| `t-event-drag.html` (변형 local · google) | 주간·일간 약속 블록 드래그: 클릭 vs 이동 판별(5px), 같은 날 이동, 다른 날 열로 이동, 드래그 중 겹침 테두리, 상·하단 리사이즈와 최소 30분, 여러 날 로컬 약속의 범위 이동, 자정 넘김 조각·종일은 클릭만, 제자리 드롭·pointercancel 원위치, 일간 뷰는 날짜 고정, 구글은 `start`/`end` 만 PATCH + 캐시 갱신(재조회 없음) + 실패 시 원위치·토스트 |
| `t-calendars.html` (변형 list · nolist) | 읽을 캘린더: calendarList 조회와 체크박스(기본 고정·읽기 전용 표시·색), primary 만 읽다가 체크하면 그 캘린더만 조회, 월·주·일 표시와 겹침 검사, 툴팁의 캘린더 이름, 해제·재체크는 조회 없음(캘린더별 캐시), 수정·삭제는 그 캘린더 URL + 그 캘린더만 재조회, 추가는 primary, 읽기 전용 캘린더는 저장·삭제 비활성·드래그 불가, 새로고침, 해제 시 선택 삭제; 목록 스코프 없는 토큰이면 primary 별칭으로 읽고 "다시 연결 (권한 허용)" → `prompt:'consent'` → 목록 로드 |
| `t-popover.html` (변형 wide 1400×900 · narrow 600×800) | 팝오버 자리: 주간 블록 오른쪽 / 오른쪽 끝 블록은 왼쪽 / 아래가 부족하면 위로 / 월간 칸 클릭 지점 오른쪽·왼쪽 / `+ 약속` 버튼 왼쪽 / 일간 폭 전체 블록은 지점 기준, 폭 360, 투명 오버레이, Esc·바깥 클릭 닫힘, 720px 이하는 하단 시트 |

- 실제 구글 계정·브라우저 팝업을 거치는 연결은 자동화되어 있지 않다.
