# R2 — 공유 엽서·딥링크·대체 아이콘·데일리 고정 (A5, A6, A9) 진행 기록

담당: Mobile App Builder. 결정 근거: docs/team/DECISIONS.md A5·A6·A9.

## 1. A9 데일리 고정 (2026-10-17)
- `fixtures/lanterns-pips/daily-freeze.json`: DAILY_EPOCH(2026-11-01, #1)부터 400일의 `levelForDaily` 판(levelRows를 "/"로 이은 글자 + FNV-1a 32).
- `tests/lanterns-pips/dailyFreeze.test.ts`: 연속 400일 이상, 전부 바이트 일치(약 1 s). 실패하면 생성기가 데일리를 바꾼 것이다.
- `scripts/dailyFreeze.ts`(`npm run fixtures:daily`): 파일이 없을 때만 만든다. `--extend N`은 뒤에 덧붙이기만 하고, `--recut D --i-know`는 오늘+30일 이후 날짜만 다시 고정한다. `npm run fixtures`는 이 파일을 건드리지 않는다.
- 규칙 코드 변경 없음.

## 2. A6 대체 아이콘 (2026-10-17)
- UI Designer 에이전트가 만든 "등불 속 Wick"(B): `docs/icon/src/wick-icon.mjs`(절차 생성, C3 등불 틀 + `drawLanternFace` idle 규격) → `docs/icon/duskwick-icon-wick*.svg/png`, `Assets.xcassets/AppIconWick.appiconset`(Any 불투명 RGB + Dark + Tinted). `docs/icon/src/build.sh` 끝 섹션이 다시 만든다.
- project.pbxproj 앱 타깃 3개 설정(Debug·Release·Measure): `ASSETCATALOG_COMPILER_ALTERNATE_APPICON_NAMES = AppIconWick`, `ASSETCATALOG_COMPILER_INCLUDE_ALL_APPICON_ASSETS = YES`. 앱 안 전환 UI 없음.
- 출시 게이트: 모든 appiconset의 Any 1024 알파·크기 검사 + 대체 세트가 모든 설정의 ALTERNATE 목록에 있는지. 일부러 깨뜨려 3건 FAIL 확인 후 복구.
- 미리보기: `playtest/shots/v13-share/icon-alt-wick-preview.png`.

## 3. 딥링크 네이티브 설정
- `App.entitlements`: `com.apple.developer.associated-domains = [applinks:humsleep.github.io]`. Info.plist `CFBundleURLTypes` 스킴 `duskwick`.
- 게이트: 엔타이틀먼트 허용 목록에 Associated Domains 추가(값이 정확히 위 한 개일 때만), URL 스킴 존재·다른 스킴 없음.

## 4. A5 공유 문구 + 딥링크 + 엽서 (구현)
- 공유 문구 셋째 줄: `https://humsleep.github.io/duskwick/<n>?ct=share` (`share.ts` `dailyLink`, 에포크 전에는 번호 없는 `/duskwick/?ct=share`). 글자 허용 예외는 마지막 링크 줄 하나뿐이고, 테스트는 그 줄이 정확히 `dailyLink(n)`인지 본다(루트 share.test.ts 7개, 클라이언트 pipsApi/daily 테스트 갱신).
- 딥링크: `src/game/deepLink.ts`(파싱·라우팅·재시도·중복 제거), `main.ts` 첫 프레임 뒤 `installDeepLinks`(appUrlOpen + getLaunchUrl), 씬 훅 `openDailyLink(date)`(onMoon을 `goDaily(date, practice)`로 나눈 최소 수정). 1.0은 지난 데일리 보관함이 없어서 지난·미래 #n도 오늘로. 아직 데일리 전인 새 플레이어는 무시. 다른 화면이 떠 있으면 최대 20초 재시도.
- 엽서: `src/game/postcard.ts`(판을 받지 않는 `PostcardSpec`, `placementStrip`, 시트 카드·공유 이미지 그리기, `bakeSharePng`), `ResultSheet.ts` 상단을 엽서로(라벨 "시간/연속 기록/보호막" + 값, 숫자 중복 없음, ✨는 그림 위 "힌트 없이" 알약). 힌트 시점 `DailyState.hintAt`(씬 힌트 처리에 한 줄).
- 공유: 버튼을 누를 때만 1080×1350 PNG를 굽고 Caches/share/duskwick-<n>.png에 써서 `Share.share({text, files})`. 실패하면 문구만. 사용자가 시트를 닫으면(cancel) 웹 공유를 다시 띄우지 않는다.
- 새 문자열 6개 × 10개 언어(`POSTCARD` 블록, a11y.test 60자 제한 맞춤).
- 스크린샷 중간 확인(en15·enSE): 판 위 겹침 없음, 엽서·공유 이미지 정상. 공유 이미지에서 #n이 제목과 소인에 두 번 나오던 것을 소인 하나로.
- 범위 밖으로 남긴 것: SE에서 연속 기록 마일스톤/선물 순간(2.9 s)이 HUD "Back" 캡션과 잠깐 겹친다(기존 위치 공식, HUD는 다른 엔지니어 담당). 스크린샷은 순간이 사라진 뒤 찍었다.

## 5. 검증 (2026-10-17)
- 타입체크(루트 + core, 클라이언트 + tests) 통과. 루트 vitest 252, 클라이언트 vitest 427(새 postcard 4, deepLink 25 포함), fuzz 10(공유 퍼즈를 링크 줄 예외로 갱신).
- e2e 새 `e2e/share.spec.ts` 6개 × chromium·webkit 통과: 엽서 시트(라벨에 숫자 없음, 소인 #14, VoiceOver "엽서"), 공유 문구 3줄 + PNG 1080×1350 첨부, **픽셀 테스트**(실제 이동 기록 vs 칸을 무작위 일대일로 바꾼 다른 판 → 공유 이미지·시트 카드 모두 픽셀 동일, 대조군(이야기가 다름)은 달라짐, 실제 첨부 PNG = 같은 spec의 bake), 딥링크(오늘·과거·미래 #n → 오늘, 남의 주소 무시, getLaunchUrl 콜드 스타트, 이미 푼 날은 불 켜진 판 + 엽서, 새 플레이어는 무시).
- 기존 e2e 갱신: daily(공유 정규식 3줄), i18n·novice(라벨 키).
- 전체 e2e 1차에서 9개 실패 → 모두 다른 엔지니어가 동시에 고치던 HUD·설정·A7 스펙이었고, 재실행에서 통과(내 변경과 무관 확인).
- iOS Debug 시뮬레이터 빌드 성공(별도 derivedData `build/dd-sim-r2`): 서명된 엔타이틀먼트에 `applinks:humsleep.github.io`, Info.plist에 `CFBundleAlternateIcons.AppIconWick`, Assets.car에 AppIconWick, URL 스킴 `duskwick`. 임시로 만든 iPhone 15 시뮬레이터에서
  - `https://humsleep.github.io/duskwick/14` → AASA가 아직 없어서 Safari가 GitHub 404를 보여 줌(예상한 "도메인 미게시" 동작) — `shots/v13-share/sim15-https-link-before-aasa.png`
  - `duskwick://daily/14` → iOS가 "'Duskwick'에서 열겠습니까?"를 띄움(스킴 등록 확인) — `sim15-scheme-open-prompt.png`. "열기" 탭은 시뮬레이터 조작 권한이 없어 하지 못했다(JS 라우팅은 e2e로 검증).
  - 확인 뒤 임시 시뮬레이터는 지웠다.
- `npm run ios:release-check`: 샘플 광고 ID 3건만 실패(0 hard).
- 스크린샷 `playtest/shots/v13-share/`: en15·ko15·enSE·koSE의 `-01-postcard-sheet.png`, `-02-share-image.png`, `-share.json`(문구·spec). 구동 `node playtest/r2-share/shots.mjs`.
- **최종 `npm run verify` 녹색**(종료 코드 0): 루트 252, 클라이언트 427, fuzz 10(+2 skip), e2e 178 chromium+webkit, build:m1.
