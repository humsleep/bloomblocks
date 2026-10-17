# Duskwick 1.0 App Review 통과 가능성 판정 — Reality Checker (2026-10-18)

**판정: 지금 상태로는 NOT READY.** 지금 내면 거의 확실히 거절된다. 이유는 코드가 아니라 **게시되지 않은 웹 페이지와 테스트 광고 설정**이다. 아래 "차단" 4건을 닫으면 첫 제출 통과를 현실적으로 기대할 수 있다.

## 근거로 삼은 것

**읽은 파일**
- `docs/app-review-preflight.md`, `docs/app-store-connect-pack.md`, `docs/team/DECISIONS.md`, `docs/team/r3-critique-reality.md`
- `apps/client/ios/App/App/Info.plist`, `App.entitlements`, `PrivacyInfo.xcprivacy`
- `apps/client/src/ads/{config,AdMobAds,policy}.ts`, `apps/client/src/legal.ts`, `apps/client/scripts/release-gates.mjs`, `apps/client/scripts/archive-ios.sh`
- `docs/web/*`, `playtest/store/README.md`
- `docs/store/screenshots/en-US/contact.png`, `05.png`
- `docs/store/review/att-flow.mp4`: 파일 존재만 확인했다(21.7 MB). 영상 내용은 README·pack의 기록을 근거로 삼았다.

**이미 빌드된 앱에서 읽은 것** (새로 빌드하지 않음, 2026-09-25 산출물 `apps/client/build/dd-sim/…`)
- GMA, UMP, Capacitor, Cordova, App의 `PrivacyInfo.xcprivacy`를 `plutil`로 읽었다.

**실제 URL 확인** (2026-10-18, `curl`, HTTP 상태)

| URL | 결과 |
| --- | --- |
| `https://humsleep.github.io/duskwick/privacy` | **404** |
| `https://humsleep.github.io/duskwick/support` | **404** |
| `https://humsleep.github.io/duskwick/` (Marketing URL 후보, 공유 링크 랜딩) | **404** |
| `https://humsleep.github.io/.well-known/apple-app-site-association` | **404** |
| `https://app-site-association.cdn-apple.com/a/v1/humsleep.github.io` | **404** |
| `https://humsleep.github.io/app-ads.txt` | 200 (`pub-4073994600346533` 한 줄) |

- 저장소 `humsleep/humsleep.github.io`는 있다. 다만 안에는 `app-ads.txt`와 `index.html` 두 파일뿐이다.
- 루트 `index.html`이 가리키는 `/apps/`도 없다.

**하지 않은 것**: 앱 실행, 빌드, e2e, 서버 기동, 영상 재생, 실기기 확인, App Store Connect 확인. 모두 하지 않았다.

**지침 확인 (2026-10-18)**
- App Review Guidelines 페이지 표기는 **"Last Updated: October 16, 2026"**이다.
  - preflight가 기준으로 삼은 2026-06-08판보다 새것이다.
  - 바뀐 조항: 1.2, 2.3.14(신설, 크리에이티브 에셋), 2.5.19(신설, 숨긴·휴면 기능. 옛 2.3.1에서 분리), 3.1.1(a), 5
  - 이 앱에 걸리는 것은 2.5.19뿐이다(아래 R13).
- URL
  - 지침: https://developer.apple.com/app-store/review/guidelines/
  - 변경 공지: https://developer.apple.com/news/?id=92th7e5i
  - 개인정보·ATT FAQ: https://developer.apple.com/app-store/user-privacy-and-data-use/
  - 서드파티 SDK 요건: https://developer.apple.com/support/third-party-SDK-requirements/
  - 연령 등급: https://developer.apple.com/help/app-store-connect/reference/app-information/age-ratings-values-and-definitions/
  - DSA trader 요건(2차 출처, 2025년 2월 EU 스토어 일괄 내림 보도): https://www.techrepublic.com/article/eu-app-store-apple-digital-services-act/
  - ATT 사전 안내 관련 거절 사례(포럼, 2차): https://developer.apple.com/forums/thread/817672 , https://www.appfigures.com/resources/guides/att-prompt-copywriting

## 이전 문서와 다르게 본 점

1. **preflight §0이 2.1 위험 1순위로 둔 "테스트 광고 ID"보다 개인정보처리방침 404가 더 확실한 거절 사유다.**
   - 심사관은 방침 링크를 거의 항상 누른다.
   - 지금은 앱 안 링크(설정 → Privacy policy, 스크린샷 08에서 보임)와 ASC 링크가 모두 404다.
   - preflight는 이것을 "사용자 조치 필요"로만 적었다. 이 판정은 **제출 차단**으로 올린다.
2. **"Tap Allow" 문구는 테스트 앱 ID 상태에서 반드시 나온다.**
   - 녹화에서 확인됐다(pack §4).
   - 첨부할 `att-flow.mp4`에도 그 화면이 들어 있다. 이대로 첨부하면 심사관에게 5.1.1(iv) 근거를 직접 보여 주는 셈이다.
3. **출시 게이트는 `npm run ios:archive`를 쓸 때만 막는다.**
   - `project.pbxproj`에는 게이트를 부르는 Run Script 단계가 없다.
   - 따라서 Xcode에서 Product → Archive를 직접 누르면 테스트 ID 그대로 아카이브와 업로드가 된다.
   - preflight의 "출시 게이트가 아카이브를 막는다"는 조건부로만 참이다.
4. **App Privacy 라벨(pack §2)은 GMA 13.11.0 매니페스트와 맞는다.** 확인한 내용은 아래와 같다.
   - DeviceID: 연결 Yes, 추적 Yes
   - CoarseLocation, ProductInteraction, AdvertisingData: 연결 Yes
   - Performance, OtherDiagnostic, Crash: 연결 No
   - UMP는 CoarseLocation, Performance, ProductInteraction을 더한다. 모두 표에 있다.
   - pack은 일부 항목에 App Functionality 목적을 더 체크했다. 과다 신고는 거절 사유가 아니다.
5. **R3 P1-1(서랍 위 대사 카드)은 스토어 샷 05에서 해소됐다.**
   - 05에는 상태 표시줄 "9:41"이 방 그림 위에 겹치는 문제(P2)만 남았다.
   - 스크린샷 쪽 2.3.3 위험은 낮다.

## 거절 위험 표

확률은 "이 항목 때문에 거절(또는 제출 불가)될 가능성"이다. 모두 AI 추정이고 사람 심사 데이터는 0이다.

### 차단 (지금 그대로면 거의 확실)

| # | 위험 | 조항 | 확률 | 근거 | 해결책 | 담당 |
| --- | --- | --- | --- | --- | --- | --- |
| R1 | 개인정보처리방침 URL 404 (앱 안 링크와 ASC 필드) | 5.1.1(i), 2.1("fully functional URLs … empty websites … scrubbed") | **높음** (게시 전이면 사실상 확정) | `curl` 404. `src/legal.ts`가 이 URL을 가리키고, 설정 시트 마지막 줄(샷 08)이 Safari로 연다 | pack §6 문안의 `[ ]`를 채워 `duskwick/privacy`로 게시한다. 브라우저와 앱 안 링크로 둘 다 열어 확인한다 | 오너 |
| R2 | 지원 URL 404 / 연락처 없음 | 1.5, 5.6.2(정확하고 연락 가능한 정보) | **높음** | `curl` 404 | pack §6-1을 게시하고 실제 이메일을 넣는다. Marketing URL(`/duskwick/`)도 404이니 게시하거나 ASC에서 비운다 | 오너 |
| R3 | 테스트 AdMob ID로 제출 → Google 기본 IDFA 설명("Tap "Allow" on the next screen")이 ATT 바로 앞에 뜸. 전면 광고는 "Test Ad" 표시. 수익 0 | 5.1.1(iv), 5.1.2(i), 2.1 | **높음** (테스트 ID 상태) | `config.ts` `testing: true`, Info.plist `GADApplicationIdentifier` = 샘플(`…3940256099942544~1458002511`). 녹화에서 해당 문구 확인(pack §4). 게이트는 `archive-ios.sh`에만 있고 Xcode Archive에는 없다 | ① 실제 앱 ID와 단위 ID를 넣고 `testing: false`(preflight §A). `app-ads.txt`의 pub ID가 이미 있으니 같은 계정을 쓴다. ② AdMob → 개인정보 및 메시지에서 IDFA 설명 메시지를 **게시하지 않거나** 중립 문구("다음 화면에서 선택할 수 있습니다", 단일 "Continue")로 바꾼다. ③ 실제 ID로 `att-flow.mp4`를 **다시 녹화**한다. ④ 아카이브는 반드시 `npm run ios:archive`로 한다(아래 R12) | ①②③ 오너, ④ 리드 |
| R4 | EU DSA trader 상태 미신고 | 지침 밖. ASC 배포 요건(DSA 30·31조) | **높음** (신고 전에는 새 앱 제출 자체가 막힌다) | 2024-10-16부터 신고 없이 새 앱·업데이트를 제출할 수 없다(2차 출처). 신고 여부를 확인할 근거가 레포에 없다 | ASC → Business에서 trader로 신고(광고 수익 = 영리)하고 주소·전화·이메일 공개를 받아들인다. 받아들이지 않으면 non-trader로 신고하고 EU 27개국을 배포에서 뺀다. 결정은 오너 몫이다 | 오너 |

### 중간

| # | 위험 | 조항 | 확률 | 근거 | 해결책 | 담당 |
| --- | --- | --- | --- | --- | --- | --- |
| R5 | 심사관이 ATT 요청을 찾지 못함 ("we were unable to locate the App Tracking Transparency request") | 5.1.2(i), 2.1 | **중간** | ATT는 첫 판 5×5를 풀고 "Next house"를 눌러야 나온다. 심사 기기의 "Allow Apps to Request to Track"이 꺼져 있으면 iOS가 띄우지 않는다. App Privacy에 추적 = Yes로 적었으니 심사관은 반드시 찾는다. 이 유형의 거절이 흔하다 | 심사 메모(pack §4)는 충분히 구체적이다. 다시 녹화한 영상을 첨부한다. 메모 첫머리에 "ATT appears after solving the first board (~1 min)"를 한 줄 올린다. 거절되면 Resolution Center에 영상 시각을 짚어 답한다 | 오너(메모·첨부) |
| R6 | 실기기 소크·메모리 미검증 상태의 크래시 또는 WebContent jetsam | 2.1 | **낮음~중간** | HANDOFF: 실기기 10분 소크가 09:22에 기기가 잠겨 중단됐다. R3 P1-3(콜드 스타트 G5)과 P1-4(3 GB 메모리 소크 G4)가 열려 있다. 마을 전체판에서 텍스처가 늘었다 | `CONFIG=Release npm run ios:device:m1 && scripts/soak-ios.sh`로 마무리한다. 퍼즐 ↔ 마을 ↔ 방 ↔ 엽서를 20회 왕복한다. Release 빌드를 TestFlight 내부 설치로 한 번 끝까지 해 본다 | 리드(측정), 오너(기기) |
| R7 | 흔한 Akari/Light Up 류라서 "이미 널리 있는 것과 구별되지 않음" 판정 | 4.3(b), 4.2 | **낮음~중간** | 2026-06 개정에서 포화 범주에 대한 표현이 강해졌다("meaningfully different or improved experience"). 반면 마을(주민 7명, 가구, 편지, 장터), 등불 얼굴, 데일리 엽서는 실제로 다르고 스크린샷 04–06에 보인다. 상표명은 0개다 | 심사 메모의 고유 요소 단락을 유지한다. 장터·부탁·시간대·계절을 메모에 추가한다(R13과 겸함). 스크린샷 1장 이상에 마을이 보이게 한다(현재 3장) | 리드(메모 문안) |
| R8 | iPad 호환 모드에서 설정·마을·방·회전 화면이 깨짐 | 2.4.1, 2.1 | **낮음~중간** | 첫 실행과 판 화면만 iPad 시뮬레이터에서 확인했다. 설정, 마을, 방, 서랍, 엽서는 미확인(preflight §2.4.1) | iPad 시뮬레이터(13" 하나, 11" 하나)에서 마을 → 방 → 서랍 → 엽서 공유 → 설정 → 방침 링크를 캡처로 확인한다 | 리드 |

### 낮음

| # | 위험 | 조항 | 확률 | 근거 | 해결책 | 담당 |
| --- | --- | --- | --- | --- | --- | --- |
| R9 | 유니버설 링크 AASA 미게시 | 2.1(빈 웹사이트) | **낮음** | 심사는 AASA를 검사하지 않는다. 엔타이틀먼트는 App ID에 Associated Domains가 켜져 있으면 서명이 통과한다. 다만 공유 문구의 `https://humsleep.github.io/duskwick/<n>`가 지금은 GitHub 404로 열린다. 심사관이 공유 결과의 링크를 누르면 "깨진 링크"로 볼 수 있다 | `docs/web/README.md` 1–3단계(AASA, `.nojekyll`, `duskwick/index.html`, `404.html`)를 R1·R2와 같은 푸시로 끝낸다. Apple CDN 사본은 `curl …cdn-apple.com…`으로 확인한다 | 오너 |
| R10 | 광고 내용 수준과 연령 등급 불일치 | 2.5.18, 연령 등급 | **낮음** (pack대로 입력할 때) | `maxAdContentRating: ParentalGuidance` + ASC "Override to Higher → 9+"(pack §1). Made for Kids를 고르지 않으면 1.3에 해당하지 않는다. 귀여운 화풍이 아동 대상 오해를 부를 수 있지만 방침에 "not directed to children under 13"이 있다 | pack §1 그대로 입력한다. 9+가 싫으면 `MaxAdContentRating.General` + 4+를 대안으로 둔다(eCPM 감소). 둘을 섞지 않는다 | 오너(입력) |
| R11 | 프라이버시 매니페스트·SDK 서명 (업로드 단계 ITMS-91053/91061) | 5.1.1, 서드파티 SDK 요건 | **낮음** | 앱 매니페스트: UserDefaults CA92.1, FileTimestamp C617.1, tracking=false. 앱 Swift 코드에서 다른 required-reason API(systemUptime, mach_absolute_time, statfs 등)를 grep한 결과 0건. `ColdStartProbe`는 `#if PERF_PROBE`. GMA·UMP·Capacitor·Cordova 매니페스트가 빌드에 들어간다. 단, 9월 25일 Debug 산출물 기준이다 | 최종 Release 아카이브에서 Xcode Organizer → Generate Privacy Report를 한 번 뽑아 pack §2 표와 맞춘다. 업로드 메일(ITMS-910xx)이 없는지 본다 | 리드 |
| R12 | 게이트 우회 아카이브 | 2.1 | **낮음~중간** (사람 실수) | 게이트는 `archive-ios.sh`에만 있다. Xcode의 Release Archive에는 Run Script가 없다 | (코드 변경이라 이번에는 하지 않음) Release 구성에서만 `node scripts/release-gates.mjs`를 부르는 Run Script 단계를 넣는 것을 검토한다. 그 전까지 pack §9-8 절차를 지킨다 | 리드 |
| R13 | 휴면 기능·미기재 기능 (새 2.5.19, 2.3.1(a)) | 2.5.19, 2.3.1(a) | **낮음** | `policy.ts` FLAGS의 `banner`, `rewardKeepsake`, `rewardArchive`는 꺼진 상수다. "Remote config (none wired yet)" 주석이 있지만 원격 소스는 없다. 다만 심사 메모가 장터, 부탁, 시간대·계절, 방 엽서를 적지 않았다. 2.3.1(a)는 기능을 구체적으로 적으라고 한다 | 메모 "Village" 줄에 market(하루 하나 고르기, 가격 없음), requests, time of day/seasons, room postcard를 더한다. 출시 뒤 원격 설정으로 배너를 켜는 계획은 2.5.19상 업데이트 심사로 하는 것이 안전하다 | 리드 |
| R14 | 스크린샷·메타데이터 정확성 | 2.3.3, 2.3.7, 2.3.14 | **낮음** | contact.png 8장 모두 실제 빌드 화면이다. 마을 7명(04), 방(05), 편지(06)가 1.0 전체판과 맞는다. 캡션 "No rush · No lives"는 사실이다. 상표·타 앱 이름은 0개다. 남은 것: 05의 상태 표시줄 겹침(미관), ja·ko·zh 키워드의 "無料·무료·免費"(가격 정보에 가까움. 거절 사례는 드묾), en-US 외 로캘 스크린샷 없음(기본 로캘로 대체되어 허용), **en-US 설명(Description) 문안이 pack에 없음**(필수 필드) | 05를 다시 찍는다(상태 표시줄 영역 비우기). "무료" 계열 키워드를 다른 단어로 바꾼다. 설명 문안을 써서 pack에 넣는다 | 리드(문안·재촬영), 오너(입력) |
| R15 | ATT 허락 전 광고 SDK 초기화·프리로드 | 5.1.2(i) | **낮음** | 비EEA에서는 첫 수 뒤 init과 프리로드를 하고, ATT는 첫 판 뒤에 나온다. IDFA는 허락 전 0이고 우리 코드는 IDFA/IDFV를 읽지 않는다. AdMob 앱의 일반적인 패턴이고 심사에서 드러나지 않는다 | 현행 유지. 엄격히 하려면 ATT 응답 전 요청에 `npa`를 강제하는 방법이 있다(eCPM 감소, 선택) | 리드(선택) |
| R16 | 계정 삭제 | 5.1.1(v) | **해당 없음** | 계정 생성이나 로그인이 없다. Sign in with Apple, GameKit 사용이 없다(grep 0건). iCloud KVS는 사용자 본인 계정이다. ASC "Sign-in required" 해제 | 없음 | — |
| R17 | 별점 요청·대체 아이콘·알림 | 5.6.1, 4.5.4 | **낮음** | `AppStore.requestReview` 시스템 시트만 쓰고 사전 질문이 없다. 대체 아이콘은 PPO용으로 바이너리에만 있고 `setAlternateIconName` 호출이 없다. 알림은 로컬, 옵트인 | 없음 | — |
| R18 | 중국 본토 판호 | ASC 배포 | **낮음** (빼면 0) | 게임은 ISBN이 필요하다 | Pricing and Availability에서 China mainland를 뺀다 | 오너 |

## 통과 확률 (추정)

**이 숫자는 AI의 판단 추정이다.** 이 앱의 실제 심사 기록이나 통계 모델에서 나온 값이 아니다. 비슷한 1인 AdMob 게임의 일반적 심사 양상에 위 표의 근거를 얹어 정했다.

| 시점 | 첫 제출 통과 확률 | 이유 |
| --- | --- | --- |
| **지금 제출하면** | **0–5%** | R4(DSA) 미신고면 제출 버튼부터 막힌다. 제출되더라도 R1 방침 404가 거의 확실한 거절이다. R3 테스트 ID 상태에서는 "Tap Allow" 화면이 녹화와 실제 흐름에 모두 나온다 |
| **이 목록을 모두 해결한 뒤** | **65–80%** (두 번째 제출까지 누적 85–95%) | 남는 불확실성은 주로 R5(ATT 찾기), R7(4.3(b) 해석), R8(iPad), R6(실기기 크래시)이다. 대부분 Resolution Center 답변이나 메모 보강 한 번으로 풀리는 유형이다 |

## 제출 전 최소 순서

1. **오너**
   - GitHub Pages에 `duskwick/privacy`, `duskwick/support`, `duskwick/index.html`, `404.html`, `.well-known/apple-app-site-association`, `.nojekyll`을 한 번에 게시한다. 6개 URL이 모두 200인지 `curl`로 확인한다.
   - DSA를 신고한다(또는 EU를 뺀다).
2. **오너**: 실제 AdMob ID를 넣는다. IDFA 설명 메시지를 끄거나 중립 문구로 바꾼다. 테스트 기기를 등록한다.
3. **리드**
   - `ios:release-check` 녹색을 확인한다.
   - iPad 화면과 실기기 소크를 확인한다.
   - Privacy Report를 대조한다.
   - 심사 메모를 보강한다(장터·부탁·계절, ATT 한 줄 요약).
   - 설명 문안을 쓰고 05를 다시 찍는다.
4. **오너**
   - 실제 ID 빌드로 `att-flow.mp4`를 다시 녹화한다. 새 영상에 "Tap Allow" 문구가 없어야 한다.
   - ASC 입력(pack §1–§3, §5)을 마친 뒤 `npm run ios:archive`로 아카이브하고 제출한다.

재판정 조건: 위 1–4를 마친 뒤 URL `curl` 결과, `ios:release-check` 출력, 새 녹화의 ATT 직전 프레임 캡처를 근거로 다시 본다.
