# Duskwick App Review 사전 점검 (2026-10-16)

대상: `apps/client` iOS 빌드 (번들 `com.humsleep.duskwick`, 1.0 (1), Xcode 26.6 / iOS 26.5 SDK, 최소 iOS 17, iPhone 전용 `TARGETED_DEVICE_FAMILY = 1`).
기준: App Review Guidelines (2026-06-08 개정판), App Store Connect 도움말, Apple 기술 노트. 2026-10-16에 웹에서 다시 확인했다(출처는 맨 아래).
App Store Connect에 실제로 입력할 값은 `docs/app-store-connect-pack.md`에 있다.

상태 표기
- **OK**: 이미 기준을 만족한다.
- **고침**: 이번 점검에서 코드나 설정을 바꿨다.
- **사용자 조치 필요**: 개발자 계정이 있어야 하거나 판단이 필요한 일이다.

## 0. 거절 가능성 순위 (높은 순)

| # | 위험 | 가이드라인 | 상태 |
| --- | --- | --- | --- |
| 1 | Google 샘플 AdMob ID(테스트 광고)로 심사에 제출 | 2.1, 2.3.1 | 출시 게이트가 아카이브를 막는다 → **사용자 조치 필요** (실제 ID 입력, §A) |
| 2 | 심사관이 ATT 요청을 찾지 못함 | 2.1(정보 요청), 5.1.2 | **고침**: 첫 트랙 판을 끝낸 뒤 판 사이에 뜨도록 앞당겼다(리드 결정). 심사 메모에 위치를 적고 화면 녹화를 첨부한다 → 녹화는 **사용자 조치 필요** |
| 3 | 개인정보처리방침이 앱 안에 없음 / 웹 페이지가 게시되지 않음 | 5.1.1(i) | 앱 안 링크 **고침**. 페이지 게시는 **사용자 조치 필요** |
| 4 | 광고 수준(PG)이 연령 등급(4+)보다 높음 | 2.5.18, 연령 등급 | 결정: ASC에서 "Override to Higher → 9+", `maxAdContentRating: PG` 유지(pack §1). 입력은 **사용자 조치 필요** |
| 5 | 흔한 Akari/Light Up 류라서 4.3(b) "포화 카테고리" 판정을 받음 | 4.3(b), 4.1 | 번들에 상표명이 없다(OK). 심사 메모에 고유 요소를 적는다 |
| 6 | App Privacy 답변이 SDK와 맞지 않음(추적 표시 누락) | 5.1.1, 5.1.2 | pack §2 표대로 입력 → **사용자 조치 필요** |
| 7 | 지원 URL에 연락처가 없음 | ASC 필수 항목 | 페이지 문안 제공, 게시는 **사용자 조치 필요** |
| 8 | EU DSA 판매자(trader) 상태 미신고 / 중국 본토 게임 판호 | ASC 배포 | **사용자 조치 필요**(pack §8) |
| 9 | iPad 호환 모드에서 화면 깨짐 | 2.4.1 | 첫 실행과 판 화면은 확인됨. 설정, 마을, 회전은 손으로 확인해야 한다 → **사용자 조치 필요** |
| 10 | 웹 래퍼 판정 | 4.2 | 낮음. 네이티브 기능 목록은 §4.2 |

---

## 2.1 앱 완성도

| 항목 | 상태 | 근거 | 변경 |
| --- | --- | --- | --- |
| 샘플 광고 ID가 Release에 들어가지 않음 | 게이트 동작 확인, **사용자 조치 필요** | `apps/client/src/ads/config.ts:9-22`(테스트 ID, `testing: true`), `ios/App/App/Info.plist:35-36` `GADApplicationIdentifier` = 샘플. `npm run ios:release-check` → `FAILED (0 hard, 3 test-ad)` | 실패 메시지에 실제 ID를 넣는 방법 3단계와 이 문서 §A 안내를 넣었다(`scripts/release-gates.mjs`, 보고 부분) |
| Release에 측정 프로브 없음 | OK | `scripts/check-no-probe.sh`. 현재 Release-iphoneos 빌드에 대해 `OK` | — |
| Release 웹 번들에 테스트 브리지 없음(`window.__test`, `__e2e`, DEV 캡처 훅) | **고침**(게이트 추가) | `src/main.ts:74`. 브리지는 DEV 또는 `--mode e2e`에서만 import한다. 프로덕션 `dist`에는 없음을 grep으로 확인했다 | `check-no-probe.sh`가 `App.app/public/**/*.js`에서 `__test`·`__e2e`·`devShot`를 찾으면 실패한다. e2e 번들로 실패하는 것도 확인했다 |
| 네트워크·원격 콘텐츠 없음 | OK | `capacitor.config.ts`: `server.url` 없음. `src/`에 `fetch`, XHR, 외부 URL 없음(광고 SDK만 통신) | — |
| 첫 실행에 권한 팝업 없음 | OK | 광고 init은 첫 수 뒤(`src/ads/index.ts` 머리말). 동의(UMP·ATT)는 첫 트랙 판을 끝낸 뒤 판 사이(`src/ads/policy.ts` `consentAfterUnits`, `consentAllowed`). 알림은 두 번째로 집계된 데일리 결과에서 소프트 카드를 먼저 띄운다(`src/notify/index.ts:3-5, 222`) | — |
| 크래시 경로 | 부분 OK | `npm run verify` 녹색(HANDOFF). 단, 실기기 10분 소크는 아직 안 했다(HANDOFF "실기기 측정") | 다른 에이전트가 측정 중이다. 소크는 제출 전에 끝내야 한다 |
| 플레이스홀더·테스트 문구 | OK | 사용자에게 보이는 문자열은 `src/a11y/strings.ts`, `src/ads/breakCard.ts`, `src/notify/texts.ts` 3곳뿐이고 모두 10개 언어다(v12: it, zh-Hans, zh-Hant 추가) | — |

## 2.3 메타데이터 일관성

| 항목 | 상태 | 근거 | 변경 |
| --- | --- | --- | --- |
| 앱 이름 Duskwick | OK, 게이트 추가 | `app.identity.json`, `ios/identity.xcconfig` → `CFBundleDisplayName`, 7개 `*.lproj/InfoPlist.strings` | 게이트: 모든 언어의 `CFBundleDisplayName`이 `appName`과 같아야 한다 |
| 다른 플랫폼 언급(2.3.10) | OK | 번들 JS의 "Android"는 Capacitor·Phaser 라이브러리 내부 문자열이고 화면에 나오지 않는다. UI 문자열에는 없다 | — |
| 버전 1.0 / 빌드 1 | OK, 게이트 추가 | `ios/version.xcconfig` | 게이트: `x.y[.z]`와 양의 정수 |
| 스크린샷 | **사용자 조치 필요** | iPhone 전용이라 6.9″ iPhone 스크린샷만 있으면 된다. iPad 스크린샷은 필요 없다 | — |

## 2.4.1 / iPad (심사관은 iPad에서도 실행한다)

| 항목 | 상태 | 근거 |
| --- | --- | --- |
| iPhone 전용 앱을 iPad 호환 창으로 실행 | OK(일부) | `project.pbxproj` `TARGETED_DEVICE_FAMILY = 1`, 세로 고정 `Info.plist:699`. README "iPad": iPadOS 26.5 시뮬레이터에서 첫 실행과 6×6 판 정상 |
| 공유 시트·UMP·ATT가 iPad에서 표시됨 | OK | 호환 모드에서는 idiom이 phone이라 팝오버가 생기지 않는다. 그래도 `@capacitor/share`는 `sourceView`를 지정한다(`node_modules/@capacitor/share/ios/Sources/SharePlugin/SharePlugin.swift:83-86`). ATT·UMP는 시스템이나 Google이 띄우는 시트다 |
| `UIRequiresFullScreen` | OK(영향 없음) | TN3192: iOS 27 SDK 전에는 iOS 앱에서 무시된다. iOS 27 SDK로 옮길 때 지운다(README 계획 그대로) |
| 설정·마을·회전 수동 확인 | **사용자 조치 필요** | iPad 시뮬레이터에서 손으로 확인한다(HANDOFF 할 일 3) |

## 4.1 / 4.3 따라 하기·스팸

| 항목 | 상태 | 근거 |
| --- | --- | --- |
| 상표명(Nikoli, Akari, Light Up) | OK | `src/`, `index.html`, `ios/App/App` 문자열, 빌드된 `public/`을 grep한 결과, 걸린 것은 주석의 "light up"(동사)과 내부 폴더명 `lanternly`뿐이다. 둘 다 화면에 나오지 않는다 |
| 스토어 메타데이터 | **사용자 조치 필요** | 키워드·부제에 "Akari", "Light Up", "Nikoli"를 쓰지 않는다(pack §5) |
| 포화 카테고리 | 낮음~중간 | 고유 요소: 글자 없는 등불 테마, 마을 메타, 데일리와 연속 기록, 결정론적 생성기, VoiceOver 판. 심사 메모에 적는다(pack §4) |

## 4.2 최소 기능 / 웹 래퍼 위험

이미 쓰는 네이티브 기능은 아래와 같다.
- **iCloud 키-값 저장소 동기화**: `ios/App/App/CloudKV.swift`, 로그인 없음
- **로컬 알림**: 옵트인, alert만 요청한다. `ios/App/App/NotifyAuth.swift`
- **햅틱**: `@capacitor/haptics`
- **공유 시트**: `@capacitor/share`
- **VoiceOver 레이어**: DOM 버튼 + ARIA 그리드
- **iOS 접근성 설정 연동**: 굵은 텍스트, 대비 증가, 동작 줄이기, 글자 크기. `ios/App/App/A11yPrefs.swift`
- **오디오 세션**: `.ambient`(무음 스위치 존중)와 광고 음소거 연동. `ios/App/App/AdAudio.swift`
- **실행 화면 이어 붙이기**: `MainViewController.installLaunchBackdrop`

앱은 완전 오프라인 번들이다. Phaser 캔버스 게임이라 "웹사이트를 포장한 앱"으로 판정될 여지는 적다. 추가로 싸게 할 일은 없다.

외부 링크: 개인정보처리방침 하나뿐이다. 앱 안 웹뷰가 아니라 **Safari로** 연다(`src/native/external.ts`). Capacitor의 `WebViewDelegationHandler`는 앱 바깥 URL로의 최상위 이동을 취소하고 `UIApplication.open`에 넘긴다(`node_modules/@capacitor/ios/Capacitor/Capacitor/WebViewDelegationHandler.swift:108-120`). 그래서 연령 등급의 "제한 없는 웹 접근"은 해당이 **아니다**.

## 5.1.1 개인정보

| 항목 | 상태 | 근거 | 변경 |
| --- | --- | --- | --- |
| 앱 안 개인정보처리방침 링크 | **고침** | `src/legal.ts`(`PRIVACY_POLICY_URL`, `SUPPORT_URL`: URL은 이 한 곳에서만 관리), 설정 시트 마지막 줄 `src/game/SettingsSheet.ts:65-68, 193, 259`, 탭 처리 `src/game/LanternsScene.ts:778-783`, VoiceOver 라벨 `src/a11y/strings.ts` P5(`cap.policy`, `policy`, 10개 언어) | 문서 아이콘 + 캡션 "Privacy policy" 줄을 **항상** 표시한다. EEA에서는 UMP "개인정보 선택"과 같은 줄에 반반으로 놓는다. 그래서 줄 수는 최대 7개로 그대로이고 iPhone SE(375×667)에 들어간다(스크린샷으로 확인). e2e `flow.spec.ts` 기대값을 갱신했다 |
| 방침 웹 페이지 게시 | **사용자 조치 필요** | 문안: pack §6. 주소: `https://humsleep.github.io/duskwick/privacy` | 게이트는 형식만 검사한다(https, placeholder 아님) |
| 수집 데이터와 App Privacy 답변 | OK(문서) | `PrivacyInfo.xcprivacy`(앱 자체는 수집 없음, `NSPrivacyTracking=false`) + GMA 13.11.0·UMP 3.1.0 번들 매니페스트. 빌드된 앱의 `Frameworks/*/PrivacyInfo.xcprivacy`를 직접 읽어 README 표와 대조했다 | pack §2 |
| 계정 삭제 | 해당 없음 | 계정이 없다. iCloud KVS는 사용자 본인의 iCloud에 있다 | — |
| 서드파티 고지 | **고침**(심사 요건은 아님) | MIT 라이선스는 고지문 동봉을 요구하는데, 빌드된 JS에서 라이선스 주석이 빠져 있었다 | `apps/client/public/licenses.txt` 추가(Phaser, Capacitor, 플러그인, IONFilesystemLib, Fredoka OFL). 폰트 OFL 원문은 이미 `public/fonts/OFL-Fredoka.txt` |

## 5.1.2 ATT

| 항목 | 상태 | 근거 | 변경 |
| --- | --- | --- | --- |
| `NSUserTrackingUsageDescription` 존재 + 10개 언어(+ es-419) | OK, 게이트 추가 | `Info.plist:41-42`, `*.lproj/InfoPlist.strings`. 영어 문구는 Apple 문서의 예시와 같은 구조다("used only to show ads that are more relevant"). 거절해도 똑같이 플레이된다고 적어 보상이나 강요가 없다 | 한국어 문구의 "회원님께"를 뺐다. 계정이 없는 앱이라 '회원'은 사실이 아니다(`ko.lproj/InfoPlist.strings`). 게이트: 모든 언어에 문구가 있어야 하고, en이 plist와 같아야 한다 |
| 흐름: UMP 먼저, 그다음 ATT | OK | `src/ads/AdMobAds.ts:118-144`: 동의 양식(필요할 때) → 동의가 허락하고 상태가 notDetermined일 때만 시스템 ATT. 사전 안내(pre-prompt) 화면은 없다(HIG 위반 소지 없음) | — |
| 게임플레이를 막지 않음 | OK | 1판의 피날레에서 옛 판이 나간 뒤, 2판이 들어오기 전 "판 사이" 순간(`LanternsScene.runGates` → `ads.beforeNextBoard`)에 한 번 뜬다. 피날레를 탭으로 넘겼다면 400 ms 오탭 방지 뒤에 뜬다. 1판의 안내 카드나 손가락 시범은 판이 끝나기 전에 끝나고, 2판의 안내는 2판이 들어온 뒤에 시작하므로 끊기지 않는다. 거절해도 게임은 같다 | — |
| 허락 전 추적 금지 | OK(설명) | 첫 수 뒤 SDK를 init하고 광고를 미리 로드한다(비EEA). ATT가 허락되기 전에는 iOS가 IDFA를 0으로 돌려주므로 IDFA 기반 추적은 일어나지 않는다. 우리 코드는 IDFA·IDFV를 읽지 않는다 | — |
| 심사관이 찾을 수 있는가 | **고침** | `RULES.consentAfterUnits = 1`(원격 값도 1 미만 불가), `consentAllowed` = 완료한 데일리 외 판 수 ≥ 1(`src/ads/policy.ts`). 데일리는 세지 않는다. 전면 유예 5판(`graceUnits`)과는 별개라 동의 양식 뒤 90초 쿨다운이 걸리고, 6번째 판 전에는 전면이 나오지 않는다. 테스트: `src/ads/__tests__/policy.test.ts`("consent from the 1st non-daily unit"), `ads.test.ts`("consent after the 1st track unit …") | 리드 결정으로 앞당겼다. 주석, 테스트, `docs/ads-plan.md` v1.1, 심사 메모를 갱신했다. 화면 녹화는 계속 권장 |
| SKAdNetworkItems | OK, 게이트 추가 | `Info.plist:43~`. 약 160개. Google 목록 50개(2026-01-30판) + AppLovin·Unity·Mintegral. `cstr6suwn9` 포함 | 게이트: Google id가 있어야 한다. 갱신은 `npm run ios:skan` |
| `GADApplicationIdentifier` | 게이트(샘플 차단) | `Info.plist:35-36` | — |
| 아동 대상 태그 | OK | `tagForChildDirectedTreatment`·`tagForUnderAgeOfConsent`를 보내지 않는다. `maxAdContentRating: PG`(`AdMobAds.ts:297`) | 연령 등급과 맞추는 결정: pack §1 |

## 개인정보 매니페스트

| 항목 | 상태 | 근거 |
| --- | --- | --- |
| 앱 매니페스트 | OK, 게이트 추가 | `ios/App/App/PrivacyInfo.xcprivacy`: UserDefaults CA92.1(Preferences), FileTimestamp C617.1(Filesystem의 ION 라이브러리가 creation/modificationDate를 읽음). 시스템 부팅 시간과 디스크 공간 API는 우리 코드에 없다. GMA가 자기 매니페스트에 35F9.1과 E174.1로 선언한다. 게이트: tracking=true인데 도메인이 비면 실패(TN3181), CA92.1·C617.1 필수 |
| SDK 매니페스트·서명 | OK | 빌드된 `App.app/Frameworks/`에 Capacitor, Cordova, GoogleMobileAds 13.11.0, UserMessagingPlatform 3.1.0이 있고 각각 `PrivacyInfo.xcprivacy`를 갖는다. SPM xcframework에는 `_CodeSignature`가 있다. Apple 목록에서 서명 대상은 Capacitor와 Cordova이고, Google 두 SDK는 목록에 없지만 매니페스트를 포함한다 |
| 플러그인 | OK | `@capacitor-community/admob`과 Ionic 플러그인은 소스로 빌드되고 자체 매니페스트가 없다. 필요한 API 이유는 앱 매니페스트가 덮는다 |

## 권한 부여(Entitlements)

| 항목 | 상태 | 근거 |
| --- | --- | --- |
| iCloud KVS + Associated Domains | OK, 게이트 추가 | `ios/App/App/App.entitlements`: `com.apple.developer.ubiquity-kvstore-identifier`와 (R2, A5) `com.apple.developer.associated-domains = [applinks:humsleep.github.io]`. 게이트: 그 외 키(특히 `aps-environment`)나 다른 도메인이 있으면 실패. AASA 파일이 아직 게시되지 않았으면 공유 링크는 Safari로 열릴 뿐 앱 동작은 같다(docs/web/README.md). App ID에 Associated Domains capability가 켜져 있어야 서명된다 |
| 백그라운드 모드 없음 | OK, 게이트 추가 | `Info.plist`에 `UIBackgroundModes` 없음. 로컬 알림에는 필요 없다 |

## 알림

| 항목 | 상태 | 근거 |
| --- | --- | --- |
| 맥락 안에서 요청 | OK | 두 번째로 집계된 데일리 결과에서 소프트 카드 "내일 퍼즐을 조용히 알려 드릴까요?"를 띄우고, "알려 주세요"를 누를 때만 시스템 프롬프트(alert만). 설정 줄에서도 켤 수 있다(`src/notify/index.ts:3-11`, `LanternsScene.ts:1212-1237`) |
| 거절해도 동작 | OK | 권한 없이는 예약하지 않는다. 마케팅 문구 없음(4.5.4) |

## 광고 배치

| 항목 | 상태 | 근거 |
| --- | --- | --- |
| 첫 실행·앱 시작 시 광고 없음 | OK | 앱 오픈 광고 삭제. 실행·복귀 뒤 120초 금지. 트랙 5판 유예(`policy.ts` 머리말) |
| 플레이 중 전면 광고 없음 | OK | 슬롯은 `beforeNextBoard` 하나뿐: 옛 판이 나간 뒤, 새 판이 들어오기 전. 데일리에는 0 |
| 보상형은 명확한 선택 | OK | 칩 → 확인 카드(제목, 설명, "광고 보기"·"나중에", 10개 언어) `src/ads/breakCard.ts` |
| 소리 | OK | `.ambient` + `isApplicationMuted`(`AdAudio.swift`) |
| 고참여 광고 끄기, 서버 빈도 상한 | **사용자 조치 필요** | AdMob 콘솔 설정(ads-plan §9-4) |
| Kids 카테고리 아님 | **사용자 조치 필요** | ASC에서 "Made for Kids"를 고르지 않는다(가이드라인 1.3은 Kids 앱의 서드파티 광고를 금지) |

## 수출 규정

| 항목 | 상태 | 근거 |
| --- | --- | --- |
| `ITSAppUsesNonExemptEncryption = false` | OK, 게이트 추가 | `Info.plist:37-38`. 자체 암호화가 없고 OS의 HTTPS만 쓴다(면제). 이 키가 있으면 ASC가 빌드마다 묻지 않는다 |

## 접근성 영양 라벨 (선택 사항, 아직 의무 아님)

솔직하게 표시할 수 있는 항목만 고른다. 근거는 pack §7에 있다.
- **Dark Interface**: 앱 전체가 어두운 화면이다.
- **Reduced Motion**: `src/game/motion.ts`의 `reduced`를 따른다. 기기에서 확인한 뒤 표시한다.
- **VoiceOver**: DOM 레이어와 판 그리드가 있다. 하지만 기기에서 데일리 한 판을 VoiceOver만으로 처음부터 끝까지 해 본 기록이 없다. 확인 전에는 표시하지 않는다.
- **Larger Text: 표시 불가.** 캡션 배율 상한이 1.35×라 200% 기준에 못 미친다.
- 그 밖의 항목(Voice Control, Sufficient Contrast, Differentiate Without Color, Captions, Audio Descriptions)은 확인 전이거나 해당 없음이다.

## 실행 화면, 아이콘, 현지화

| 항목 | 상태 | 근거 |
| --- | --- | --- |
| 실행 화면 스토리보드 | OK, 게이트 추가 | `Info.plist:691` `LaunchScreen` → `Base.lproj/LaunchScreen.storyboard`(iOS 27 SDK에서는 필수) |
| 아이콘 | OK, 게이트 추가 | `AppIcon.appiconset`과 PPO용 대체 세트 `AppIconWick.appiconset`(R2, A6): 1024 Any는 불투명(`hasAlpha: no`). Dark와 Tinted 변형은 알파가 허용된다. 게이트: 모든 appiconset의 Any 1024가 불투명한 1024×1024인지, 대체 세트가 모든 설정의 `ASSETCATALOG_COMPILER_ALTERNATE_APPICON_NAMES`에 있는지 검사 |
| 권한 문구 현지화 | OK | ATT 문구 10개 언어(+ es-419 "Configuración"). locales 게이트가 JS 언어 목록·CFBundleLocalizations·knownRegions·번들 포함을 맞춘다. 다른 사용 설명 키는 필요 없다(카메라, 위치 등 미사용) |
| Settings.bundle | 해당 없음 | 없음 |
| 폰트 라이선스 | OK | Fredoka OFL 1.1(앱 번들 허용), 원문 동봉 |

---

## 바뀐 파일

- `apps/client/src/legal.ts` (새 파일): 개인정보처리방침·지원 URL 상수
- `apps/client/src/native/external.ts` (새 파일): Safari로 열기
- `apps/client/src/game/SettingsSheet.ts`: 옵션 13 `policy`, 개인정보 줄, `N_CAPS` 9
- `apps/client/src/game/hudArt.ts`: `drawPolicy` 글리프
- `apps/client/src/game/LanternsScene.ts`: `policy` 탭 처리, VoiceOver 키와 동작
- `apps/client/src/a11y/strings.ts`: `cap.policy`, `policy` 10개 언어
- `apps/client/e2e/flow.spec.ts`: 설정 캡션 기대값 + `shown(13)`
- `apps/client/ios/App/App/ko.lproj/InfoPlist.strings`: ATT 문구에서 '회원님께' 제거
- `apps/client/scripts/release-gates.mjs`: store 게이트 묶음 + 실제 ID 안내 메시지
- `apps/client/scripts/check-no-probe.sh`: 웹 번들 테스트 브리지 검사
- `apps/client/public/licenses.txt` (새 파일): 서드파티 고지
- `apps/client/README.md`: 출시 게이트 절
- `apps/client/src/ads/policy.ts`: `RULES.consentAfterUnits = 1`(범위 1–50), `consentAllowed` 분리. `index.ts`, `AdMobAds.ts`, `src/ads/README.md`는 주석만 고쳤다
- `apps/client/src/ads/__tests__/policy.test.ts`, `ads.test.ts`: 동의 시점 테스트 추가·수정
- `docs/ads-plan.md`: §6 표와 변경 기록 v1.1

## 검증 (2026-10-16)

- `npm --prefix apps/client run typecheck:all`: 통과
- 클라이언트 vitest: 20개 파일, 350개 테스트 통과(동의 시점 변경 뒤)
- e2e `flow.spec.ts` + `play.spec.ts`(chromium): 26개 통과(동의 시점 변경 뒤)
- e2e `flow.spec.ts`의 설정 테스트 1건(chromium): 통과. 임시 스크립트로 375×667(ko)과 390×844(fr)에서 설정 시트를 캡처했다. 새 줄을 탭하면 `https://humsleep.github.io/duskwick/privacy` 새 탭이 열린다
- Debug 시뮬레이터 빌드(`-derivedDataPath apps/client/build/dd-review`): 성공. 빌드된 Info.plist의 `ITSAppUsesNonExemptEncryption=false`와 ATT 문구 확인
- `npm run ios:release-check`: 테스트 광고 3건으로만 실패(`0 hard, 3 test-ad`). `--allow-test-ads`를 주면 `OK … 6 store checks`
- 새 게이트 음성 테스트(스크래치 복사본에서 일부러 깨뜨림): 수출 키, 표시 이름, 언어별 ATT 문구, 백그라운드 모드, `aps-environment`, tracking=true + 빈 도메인, 알파 아이콘, 빌드 번호, URL 9건 모두 실패 처리됨

## §A. 실제 AdMob ID 넣기 (게이트 실패 메시지가 이 절을 가리킨다)

1. AdMob 콘솔에서 앱(iOS, 아직 스토어에 없음)을 만든다. 광고 단위 **전면 1개 + 보상형 1개**를 만든다(보상형 이름 예: `break`).
2. `apps/client/src/ads/config.ts`를 고친다.
   - `appId` ← `ca-app-pub-XXXXXXXXXXXXXXXX~YYYYYYYYYY`
   - `interstitial`, `rewardedBreak` ← 각 단위 ID
   - `testing: false`
   - 플래그가 꺼진 3개(`rewardedKeepsake`, `rewardedArchive`, `bannerTrack`)는 요청되지 않는다. 형식만 맞으면 된다. 지금 값을 그대로 두거나 실제 단위로 바꾼다.
3. `apps/client/ios/App/App/Info.plist`의 `GADApplicationIdentifier`를 같은 `appId`로 바꾼다(게이트가 둘이 일치하는지 검사한다).
4. `npm --prefix apps/client run ios:release-check`가 `release gates: OK`인지 확인한다.
5. 실기기 시험 전에 AdMob 콘솔 → 설정 → 테스트 기기에 본인 iPhone을 등록한다. 실제 ID로 자기 광고를 보거나 누르면 무효 트래픽이 된다.
6. AdMob 콘솔에서 할 일:
   - 고참여 광고 OFF
   - 전면 광고 빈도 상한: 사용자당 하루 10회
   - 개인정보 및 메시지 → GDPR 메시지 게시(EEA/UK/CH). ATT 앞 IDFA 설명 메시지는 선택 사항이다. 우리 코드가 UMP 다음에 ATT를 직접 요청한다.
7. `npm --prefix apps/client run ios:archive -- --marketing 1.0` → Xcode Organizer → Distribute App.

## 출처 (2026-10-16 확인)

- App Review Guidelines(2026-06-08): https://developer.apple.com/app-store/review/guidelines/
- 업로드 요건(2026-04-28부터 Xcode 26 / iOS 26 SDK): https://developer.apple.com/news/upcoming-requirements/
- 연령 등급 값과 정의: https://developer.apple.com/help/app-store-connect/reference/app-information/age-ratings-values-and-definitions/
- 사용자 개인정보와 ATT: https://developer.apple.com/app-store/user-privacy-and-data-use/
- 서드파티 SDK 요건: https://developer.apple.com/support/third-party-SDK-requirements/
- TN3181: https://developer.apple.com/documentation/technotes/tn3181-debugging-invalid-privacy-manifest
- TN3192: https://developer.apple.com/documentation/technotes/tn3192-migrating-your-app-from-the-deprecated-uirequiresfullscreen-key
- 접근성 영양 라벨: https://developer.apple.com/help/app-store-connect/manage-app-accessibility/overview-of-accessibility-nutrition-labels/
- 수출 규정: https://developer.apple.com/documentation/bundleresources/information-property-list/itsappusesnonexemptencryption
- AdMob 데이터 공개: https://developers.google.com/admob/ios/privacy/data-disclosure
- AdMob SKAdNetwork 목록: https://developers.google.com/admob/ios/3p-skadnetworks
- ATT를 찾지 못해 받는 거절 사례: https://developer.apple.com/forums/thread/758583
