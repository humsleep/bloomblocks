# Duskwick 웹 페이지와 유니버설 링크 — 소유자 게시 가이드 (2026-10-18)

앱이 쓰는 주소는 소유자의 **기존 사이트** 체계를 따른다. 사이트는 저장소가 **둘**이다. 헷갈리기 쉬우니 먼저 이것부터 본다.

| 저장소 (GitHub) | 게시 주소 | Duskwick 몫 |
| --- | --- | --- |
| `humsleep/apps` (프로젝트 사이트) | `https://humsleep.github.io/apps/…` | 안내·문의 `/apps/duskwick/`, 방침 `/apps/duskwick/privacy/`, 아이콘, 공유 카드, 번호별 착륙 페이지 `/apps/duskwick/<n>/`(1–400), 앱 목록(`apps/index.html`)과 README 한 줄 |
| `humsleep/humsleep.github.io` (사용자 사이트) | `https://humsleep.github.io/…` (루트) | `/.well-known/apple-app-site-association`(유니버설 링크)와 `/.nojekyll`. 루트 `app-ads.txt`는 이미 있어 **바꾸지 않는다** |

AASA는 **루트 도메인**에만 둘 수 있어서 사용자 사이트 저장소에 들어가고, 페이지들은 `apps` 저장소에 들어간다(프로젝트 사이트의 `/.well-known/`은 Apple이 읽지 않는다).

## 앱 쪽 주소 (코드와 일치해야 하며 릴리스 게이트가 검사한다)

| 용도 | 값 | 어디서 |
| --- | --- | --- |
| 방침 URL (ASC, 앱 설정 시트) | `https://humsleep.github.io/apps/duskwick/privacy/` | `apps/client/src/legal.ts` `PRIVACY_POLICY_URL` |
| 지원 URL (ASC) | `https://humsleep.github.io/apps/duskwick/` | `legal.ts` `SUPPORT_URL` |
| 마케팅 URL (ASC) | `https://humsleep.github.io` (경로 없이 루트. AdMob이 루트 `app-ads.txt`를 찾는다) | pack §3 |
| 공유 링크 | `https://humsleep.github.io/apps/duskwick/<n>?ct=share` (방 엽서: `…/apps/duskwick/?ct=room`) | `games/lanterns-pips/share.ts` `DAILY_URL_BASE`, `dailyLink` |
| 딥링크 | `duskwick://daily[/<n>]`, `duskwick://today`, 위 https 경로 | `apps/client/src/game/deepLink.ts` |
| AASA 사본 | 앱 ID `68BP5NY48R.com.humsleep.duskwick`, 경로 `/apps/duskwick`, `/apps/duskwick/`, `/apps/duskwick/*` (방침은 `exclude`) | `docs/web/apple-app-site-association` (사이트 파일과 같은 내용) |

팀 ID `68BP5NY48R`는 `apps/client/app.identity.json`에서 왔고 Xcode 프로젝트는 그 값을 `APP_TEAM_ID`로 읽는다. 엔타이틀먼트는 `applinks:humsleep.github.io`.
앱 안에서는 아무것도 이 도메인이 열려 있는 것에 의존하지 않는다(링크는 공유 문구의 한 줄일 뿐).

## 준비된 것 (로컬 브랜치 `add-duskwick`, push 전)

- `apps` 저장소: `duskwick/index.html`(영어+한국어 FAQ), `duskwick/privacy/index.html`(영어+한국어, 데이터 표는 pack §2와 같음, 시행일 2026-10-18),
  `duskwick/icon.png`(256×256, 44 KB), `duskwick/og.jpg`(스포일러 없는 공유 카드 1200×630), `duskwick/duskwick.css`(황금빛 강조색: 밝은 모드 `#9A5A00` 대비 5.25:1, 어두운 모드 `#FFC864`),
  `duskwick/config.js`(**App Store 주소 상수 한 곳**), `duskwick/app-store.js`, `duskwick/<n>/index.html` ×400, `_scripts/duskwick-days.mjs`(그 400개를 만드는 스크립트; `_`로 시작해 게시되지 않는다), `index.html`의 목록 한 줄, README 표 한 줄.
- `humsleep.github.io` 저장소: `.well-known/apple-app-site-association`, `.nojekyll`.
- 번호별 페이지는 Open Graph/Twitter 카드(제목 "Duskwick #n", 공유 카드 이미지), "Open in Duskwick"(`duskwick://daily/<n>`, 눌렀을 때만 시도) 버튼, App Store 버튼을 가진 작은 페이지(약 1.7 KB)다.
  자동으로 앱을 열지 않는 이유: 앱이 없을 때 Safari가 "주소가 잘못되었습니다" 경고를 띄운다. 앱이 있으면 공유 링크는 유니버설 링크로 바로 앱이 열리므로 페이지가 보이지 않는다.

## 1. 검토

```sh
# 두 저장소의 로컬 클론에서 (리드가 준비한 클론 경로 또는 ~/workspace/apps, ~/workspace/humsleep.github.io 에 브랜치를 가져온 뒤)
git -C ~/workspace/apps diff main..add-duskwick --stat      # 410개 안팎: 번호별 페이지 400 + 손으로 쓴 10개
git -C ~/workspace/humsleep.github.io diff main..add-duskwick --stat   # AASA + .nojekyll 둘
# 눈으로 보기 (사이트 구조와 같게 /apps/ 아래로 서비스)
git -C ~/workspace/apps checkout add-duskwick
python3 -m http.server 8765 --directory ~/workspace            # http://localhost:8765/apps/duskwick/ , /privacy/ , /14/ 를 모바일 폭으로
# 끝나면 서버 터미널에서 Ctrl-C
```
확인할 것: 방침의 데이터 표가 pack §2와 같은지, 연락처 `humsleep@naver.com`, 시행일, 한국어 문구. 방침은 법적 문서라서 **소유자가 직접 읽고 동의한 뒤** 게시한다.

## 2. 게시 (소유자 승인 뒤, 이 순서)

```sh
cd ~/workspace/apps && git checkout main && git merge --ff-only add-duskwick && git push
cd ~/workspace/humsleep.github.io && git checkout main && git merge --ff-only add-duskwick && git push
```
GitHub Pages가 1–2분 안에 반영한다. `apps` 저장소의 Pages 설정(Source: main / root)은 이미 켜져 있다.
`~/workspace/apps`에 커밋하지 않은 변경(예: `app-ads.txt`)이 있으면 먼저 소유자가 정리한다.

## 3. 확인 (curl)

```sh
# 페이지 (모두 200)
for u in apps/duskwick/ apps/duskwick/privacy/ apps/duskwick/14/ apps/duskwick/400/ apps/duskwick/icon.png apps/duskwick/og.jpg apps/; do
  printf '%s ' "$u"; curl -s -o /dev/null -w '%{http_code}\n' "https://humsleep.github.io/$u"; done
curl -sI https://humsleep.github.io/apps/duskwick/14          # 301 → /14/ (정상, 쿼리 ?ct=share 유지). 유니버설 링크는 이 주소를 앱이 받는다
curl -s -o /dev/null -w '%{http_code}\n' https://humsleep.github.io/apps/duskwick/401/   # 404 (400일 뒤, 아래 "한계")

# 유니버설 링크 파일
curl -sI https://humsleep.github.io/.well-known/apple-app-site-association   # 200, 리디렉션(301/302) 없음
curl -s  https://humsleep.github.io/.well-known/apple-app-site-association | python3 -m json.tool
curl -s  https://app-site-association.cdn-apple.com/a/v1/humsleep.github.io  # Apple CDN 사본. 위와 같은 JSON이 나오면 성공(처음엔 최대 하루 걸릴 수 있음)

# AdMob 줄이 그대로인지 (바꾸지 않았다)
curl -s https://humsleep.github.io/app-ads.txt
```
`Content-Type`은 확장자 없는 파일이라 `application/octet-stream`으로 나온다. Apple CDN이 내용이 올바른 JSON이면 받아들이므로 CDN 사본이 보이면 괜찮다.
CDN에 사본이 없으면 그때 헤더를 지정할 수 있는 무료 호스트를 검토한다(현금 0원 유지).

실기기 확인: 앱을 새로 설치한 iPhone의 메모 앱에 `https://humsleep.github.io/apps/duskwick/1`을 붙여 넣고 길게 누르면 "Duskwick에서 열기"가 보인다. Safari 주소창에 직접 입력하면 열리지 않는 것이 정상이다.
Apple Developer → Identifiers → `com.humsleep.duskwick`에서 **Associated Domains**가 켜져 있어야 한다(Xcode 자동 서명이면 다음 빌드 때 켜진다).

주의: `/apps/duskwick/`(지원 URL)도 AASA 경로라서, iPhone에서 그 링크를 메시지·메모에서 누르면 앱이 열린다(오늘의 데일리). Safari나 App Store Connect에서 여는 것은 영향이 없다. 방침 `/apps/duskwick/privacy/`는 `exclude`로 항상 웹이다.

## 4. App Store 주소가 생긴 뒤 (상수 한 곳)

1. `apps` 저장소의 `duskwick/config.js`에서 `var APP_STORE_URL = "";`를 앱 주소로 바꾼다. 예: `https://apps.apple.com/app/id1234567890?pt=<provider>&ct=web_daily` (`id` 뒤 숫자가 있어야 한다).
2. `node _scripts/duskwick-days.mjs`를 한 번 실행한다(번호별 페이지에 Smart App Banner `app-id=…, app-argument=…`가 들어간다. Safari는 이 태그를 HTML에서만 읽는다).
3. 커밋하고 push한다. 버튼은 "Coming soon to the App Store"에서 "Download on the App Store"로 바뀐다(모든 페이지, `app-store.js`가 `config.js`를 읽는다).
4. ASC의 지원·마케팅·방침 URL은 이미 위 표의 값이다(변경 없음). 앱 코드 변경 없음.

## 한계와 유지

- 번호별 페이지는 **400개**(#400 = 2027-12-05)다. 그 뒤 날짜의 공유 링크는 GitHub의 기본 404가 나온다(앱이 설치돼 있으면 유니버설 링크로 앱이 열려 영향이 없다). 늦어도 2027-11월에 `node _scripts/duskwick-days.mjs 800`처럼 늘려 push한다.
- 번호별 페이지를 손으로 고치지 않는다. 바꾸려면 `_scripts/duskwick-days.mjs`를 고쳐 다시 만든다.
- 방침을 고치면 시행일을 바꾼다. SDK나 ASC 데이터 표(pack §2)가 바뀌면 방침 표도 같이 고친다.
- 정적 페이지는 `?ct=` 값을 읽지 않는다. 채널 구분은 App Store 주소의 `ct`(상수 한 곳)로 한다.
- 앱 안 동작: #n이 오늘이면 오늘의 데일리, 지난 날·미래는 오늘의 데일리(1.0에는 보관함이 없다, `routeDaily`의 `allowPast`로 켠다). 아직 데일리가 열리지 않은 새 플레이어는 링크를 무시한다.
