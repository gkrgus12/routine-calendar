# 루틴 캘린더

요일별 루틴 페이지를 켜고 끄며, 약속을 넣을 때 활성 루틴과 겹치는 시간을 알려주는 개인용 캘린더. 빌드 없이 `index.html` 을 열면 바로 동작한다.

## GitHub Pages 배포

1. GitHub 저장소에 push 한다 (`index.html`, `app.js`, `styles.css`, `manifest.json`, `icon.svg` 가 루트에 있어야 한다).
2. 저장소 **Settings → Pages** 에서 Source 를 **Deploy from a branch**, Branch 를 `main` / `/ (root)` 로 지정하고 Save.
3. 1~2분 뒤 `https://<계정>.github.io/<저장소>/` 에서 열린다. 경로가 전부 상대경로라 하위 경로에서도 그대로 동작한다.
4. 작업 완료 시 커밋·푸시, 하나의 브리프는 하나의 커밋

## Google Calendar 연결 (읽기 전용, 선택)

1. `config.js` 의 `GOOGLE_CLIENT_ID` 에 Google Cloud 콘솔의 OAuth 클라이언트 ID(웹 애플리케이션)를 넣는다.
2. 그 클라이언트의 **승인된 JavaScript 원본**에 배포 주소(`https://<계정>.github.io`)와 로컬 테스트 주소(`http://localhost:8000`)를 등록한다. 로컬은 `python -m http.server 8000` 으로 띄운다 (`file://` 에서는 OAuth 팝업이 동작하지 않는다).
3. 앱의 ⚙ 설정 → 구글 탭에서 `Google 연결`. 토큰은 메모리에만 있어 새로고침하면 다시 연결한다.
