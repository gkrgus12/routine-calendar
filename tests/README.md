# tests/

실행: `python tests/run.py` — 헤드리스 Chrome 이 필요하고(못 찾으면 환경변수 `CHROME` 에 실행 파일 경로, 추가 플래그는 `CHROME_FLAGS` — root 로 도는 컨테이너라면 `--no-sandbox`), `--only 이름조각` 으로 일부만, `--verbose` 로 하네스 로그까지 본다. 실패가 있으면 종료 코드 1.

| 파일 | 내용 |
|---|---|
| `run.py` | 러너. 저장소를 임시 로컬 HTTP 서버로 서빙하고 `t-*.html` 을 새 프로필의 헤드리스 Chrome(`--force-prefers-reduced-motion`, 가상 시간)으로 열어 `<pre id="RESULT">` 의 PASS/FAIL 을 모은다 |
| `lib.js` | 공용. `app.js` 를 IIFE 래퍼 없이 평가해 내부 함수·상태를 `RC.<이름>` 으로 노출(프로덕션 코드에 훅 없음), `seed`/`check`/`btn`/`toastText`/`text`/`sleep`, 결과 기록 |
| `t-conflicts.html` | 충돌 계산: `overlap`·`itemSegs`·`eventSegs`·`eventConflicts`·`pageConflicts`, 페이지 켤 때 토스트, 월간 겹침 점, 약속 폼 경고 박스 |
| `t-backup.html` | 백업: `validateBackup` 통과·거부·정규화, `mergeBackup`, 설정 모달 백업 탭 파일 선택 → 미리보기 → 합치기, 깨진 파일 거부 |
| `t-google-scope.html` | 구글 스코프 4시나리오 (변형 `s=A` 정상, `s=B` 권한 없는 토큰, `s=C` API 403, `s=D` 조용한 재연결). GIS·fetch 스텁, 실제 구글 접근 없음 |
| `t-event-drag.html` | 주간·일간 약속 블록 드래그 이동·리사이즈 (변형 `s=local` 로컬 약속, `s=google` 구글 이벤트 PATCH 스텁) |
| `t-calendars.html` | 읽을 캘린더 선택 (변형 `s=list` 목록 스코프 있음, `s=nolist` 없음 → 재동의). calendarList·events 스텁 |
| `t-calcolors.html` | 캘린더별 색: 구글 탭 스와치로 캘린더 하나를 빨강으로 → 그 캘린더 일정만 빨강, 다른 캘린더는 구글 기본색, 로컬 약속은 설정 색. 월·주·일 즉시 반영, 범례 칩, 체크 해제 뒤에도 색 유지, `routine-cal-google-calendar-colors` 키 |
| `t-timepick.html` | 약속 폼 시간 휠 피커와 길이 유지(시작 바꾸면 끝이 따라옴, 자정 넘김 종료일 +1) |
| `t-notify.html` | 브라우저 알림 (변형 `s=grant`·`deny`·`none`; Notification 스텁 + 가짜 시계) |
| `t-settings-height.html` | 설정 모달 고정 높이 (변형 `s=wide`·`narrow`·`short`) |
| `t-popover.html` | 팝오버 배치 (변형 `s=wide` 1400×900, `s=narrow` 600×800 = 하단 시트) |

새 하네스는 `t-<이름>.html` 로 만들고 `<script src="lib.js">` 다음에 `run(async()=>{ seed(...); await loadApp(); check('이름', 조건, 부가정보) })`. 변형이 필요하면 파일 첫 줄에 `<!-- variants: s=A s=B@600x800 -->`.
