# humsleep.github.io — 공유 링크와 유니버설 링크 (R2, 결정 A5)

앱의 공유 문구 셋째 줄은 `https://humsleep.github.io/duskwick/<n>?ct=share`다(`games/lanterns-pips/share.ts` `dailyLink`).
이 폴더의 파일을 **GitHub 사용자 사이트**(저장소 `humsleep/humsleep.github.io`, 사이트 루트 = `https://humsleep.github.io/`)에 올린다.

| 이 폴더 | 사이트 경로 | 역할 |
| --- | --- | --- |
| `apple-app-site-association` | `/.well-known/apple-app-site-association` | 유니버설 링크: `/duskwick`, `/duskwick/*`를 앱(팀 68BP5NY48R, `com.humsleep.duskwick`)이 연다 |
| `.nojekyll` | `/.nojekyll` | Jekyll이 `.well-known`(점으로 시작하는 폴더)을 빼지 않게 한다 |
| `duskwick/index.html` | `/duskwick/` | 데일리 안내 페이지(앱이 없거나 AASA가 아직 없을 때 Safari가 보여 준다) |
| `404.html` | `/404.html` | `/duskwick/14` 같은 번호 주소는 파일이 없으므로 GitHub Pages가 루트 404.html을 보여 준다. 같은 안내 페이지에 `#14`를 표시한다 |

## 주인이 할 일 (정확한 순서)

1. GitHub에 로그인해 저장소 `humsleep/humsleep.github.io`가 있는지 본다. 없으면 **Public** 저장소를 그 이름으로 만든다
   (Settings → Pages → Source: "Deploy from a branch", Branch `main` / `(root)`).
   사용자 사이트는 저장소 루트가 곧 `https://humsleep.github.io/`이다. 프로젝트 사이트(`humsleep.github.io/<repo>/`)에는
   `/.well-known/`을 둘 수 없으므로 반드시 사용자 사이트여야 한다.
2. 이 폴더의 내용을 저장소 루트에 그대로 복사한다:
   ```sh
   git clone https://github.com/humsleep/humsleep.github.io.git && cd humsleep.github.io
   mkdir -p .well-known duskwick
   cp ~/workspace/puzzle-lab/docs/web/apple-app-site-association .well-known/apple-app-site-association
   cp ~/workspace/puzzle-lab/docs/web/.nojekyll .nojekyll
   cp ~/workspace/puzzle-lab/docs/web/duskwick/index.html duskwick/index.html
   cp ~/workspace/puzzle-lab/docs/web/404.html 404.html      # 이미 다른 404.html이 있으면 합칠지 먼저 판단
   git add -A && git commit -m "Duskwick: universal links + daily landing" && git push
   ```
   - 파일 이름에 확장자를 붙이지 않는다(`apple-app-site-association`, `.json` 아님). 리디렉션이 없어야 한다.
   - app-ads.txt와 개인정보 페이지도 같은 저장소 루트에 둔다(HANDOFF "사용자가 해야 할 일" 5번).
3. 1–2분 뒤 확인한다:
   ```sh
   curl -sI https://humsleep.github.io/.well-known/apple-app-site-association   # 200, 리디렉션 없음
   curl -s  https://humsleep.github.io/.well-known/apple-app-site-association | python3 -m json.tool
   curl -s  https://app-site-association.cdn-apple.com/a/v1/humsleep.github.io    # Apple CDN 사본(갱신까지 최대 하루)
   curl -sI https://humsleep.github.io/duskwick/14                                 # 404 상태 + 안내 페이지 본문(정상)
   ```
   GitHub Pages는 확장자 없는 파일을 `application/octet-stream`으로 준다. Apple 문서는 `application/json`을 권하지만
   Apple CDN은 내용이 올바른 JSON이면 받아들인다(확인은 위 CDN 주소로). CDN에 사본이 보이지 않으면 그때 Cloudflare Pages 같은
   무료 호스트로 헤더를 지정하는 방법을 검토한다(현금 0원 유지).
4. Apple Developer → Certificates, Identifiers & Profiles → Identifiers → `com.humsleep.duskwick`에서 **Associated Domains**가
   켜져 있는지 본다. Xcode 자동 서명이면 다음 기기·아카이브 빌드 때 켜진다(`-allowProvisioningUpdates`).
5. 앱을 새로 설치한 iPhone의 메모 앱에 `https://humsleep.github.io/duskwick/1`을 붙여 넣고 길게 누른다 → "Duskwick에서 열기"가
   보이면 성공. (Safari 주소창에 직접 치면 유니버설 링크가 열리지 않는 것이 정상이다.)
   개발 중 바로 확인: 설정 → 개발자 → Associated Domains Development를 켜고 엔타이틀먼트에 `applinks:humsleep.github.io?mode=developer`를
   잠시 쓰는 방법도 있으나, 출시 게이트가 그 값을 거절하므로 커밋하지 않는다.
6. App Store 레코드가 생기면 `duskwick/index.html`과 `404.html`의 `APP_STORE_URL`에 앱 주소(`?pt=<provider>&ct=web_daily`)를 넣는다.
   그 전에는 "Coming soon to the App Store."가 보인다.

## 아직 게시하지 않았을 때 (App Review 포함)
- 앱 안에서는 아무것도 이 도메인에 의존하지 않는다. 공유 문구에 링크가 한 줄 들어갈 뿐이다.
- 링크를 누르면 Safari가 열린다. 저장소가 아직 없으면 GitHub의 "Site not found" 페이지가 보이므로, **심사 제출 전에 1–3단계를
  끝내 두는 것을 권한다**(안내 페이지는 앱 설명과 같은 말만 한다).
- 앱의 `duskwick://daily/<n>` 스킴은 도메인과 무관하게 동작한다.

## 앱이 링크를 받았을 때 (src/game/deepLink.ts)
- 받는 주소: `duskwick://daily`, `duskwick://daily/<n>`, `duskwick://today`, `https://humsleep.github.io/duskwick[/<n>][?ct=…]`.
- 1.0에는 지난 데일리 보관함이 없다. 그래서 #n이 오늘이면 오늘의 데일리, 지난 날이나 미래면 **오늘의 데일리**를 연다
  (지난 날 허용 여부는 `routeDaily`의 `allowPast` 하나로 켠다 — 보관함이 생기는 1.1 이후).
- 아직 데일리가 열리지 않은 새 플레이어(gentle 5판 전, 튜토리얼 중)는 링크를 무시하고 평소처럼 시작한다.
- 다른 화면(설정, 게임 방법, 질문 카드, 판 전환 중)이 떠 있으면 그것이 끝난 뒤 최대 20초 안에 연다.
