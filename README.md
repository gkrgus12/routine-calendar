# 루틴 캘린더

요일별 루틴 페이지를 켜고 끄며, 약속을 넣을 때 활성 루틴과 겹치는 시간을 알려주는 개인용 캘린더. 빌드 없이 `index.html` 을 열면 바로 동작한다.

## GitHub Pages 배포

1. GitHub 저장소에 push 한다 (`index.html`, `app.js`, `styles.css`, `manifest.json`, `icon.svg` 가 루트에 있어야 한다).
2. 저장소 **Settings → Pages** 에서 Source 를 **Deploy from a branch**, Branch 를 `main` / `/ (root)` 로 지정하고 Save.
3. 1~2분 뒤 `https://<계정>.github.io/<저장소>/` 에서 열린다. 경로가 전부 상대경로라 하위 경로에서도 그대로 동작한다.
4. 작업 완료 시 커밋·푸시, 하나의 브리프는 하나의 커밋