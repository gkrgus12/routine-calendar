# tests/

실행: `python tests/run.py` — 헤드리스 Chrome 이 필요하고(못 찾으면 환경변수 `CHROME` 에 실행 파일 경로), `--only 이름조각` 으로 일부만, `--verbose` 로 하네스 로그까지 본다. 실패가 있으면 종료 코드 1.

| 파일 | 내용 |
|---|---|
| `run.py` | 러너. 저장소를 임시 로컬 HTTP 서버로 서빙하고 `t-*.html` 을 새 프로필의 헤드리스 Chrome(`--force-prefers-reduced-motion`, 가상 시간)으로 열어 `<pre id="RESULT">` 의 PASS/FAIL 을 모은다 |
| `lib.js` | 공용. `app.js` 를 IIFE 래퍼 없이 평가해 내부 함수·상태를 `RC.<이름>` 으로 노출(프로덕션 코드에 훅 없음), `seed`/`check`/`btn`/`toastText`/`text`/`sleep`, 결과 기록 |
| `t-conflicts.html` | 충돌 계산: `overlap`·`itemSegs`·`eventSegs`·`eventConflicts`·`pageConflicts`, 페이지 켤 때 토스트, 월간 겹침 점, 약속 폼 경고 박스 |
| `t-backup.html` | 백업: `validateBackup` 통과·거부·정규화, `mergeBackup`, 설정 모달 백업 탭 파일 선택 → 미리보기 → 합치기, 깨진 파일 거부 |
| `t-google-scope.html` | 구글 스코프 4시나리오 (변형 `s=A` 정상, `s=B` 권한 없는 토큰, `s=C` API 403, `s=D` 조용한 재연결). GIS·fetch 스텁, 실제 구글 접근 없음 |
| `t-event-drag.html` | 주간·일간 약속 블록 드래그 이동·리사이즈 (변형 `s=local` 로컬 약속, `s=google` 구글 이벤트 PATCH 스텁) |
| `t-popover.html` | 팝오버 배치 (변형 `s=wide` 1400×900, `s=narrow` 600×800 = 하단 시트) |

새 하네스는 `t-<이름>.html` 로 만들고 `<script src="lib.js">` 다음에 `run(async()=>{ seed(...); await loadApp(); check('이름', 조건, 부가정보) })`. 변형이 필요하면 파일 첫 줄에 `<!-- variants: s=A s=B@600x800 -->`.
