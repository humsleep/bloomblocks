# Duskwick 출시 준비 독립 검증 (2026-10-15)

## 판정: NEEDS WORK, 등급 B

코드 쪽은 출시 후보 수준이다. 하지만 출시를 결정하는 증거 두 가지가 없다. 실기기 시작 속도와 실제 광고 ID다.

## 직접 돌린 것

### 테스트

`npm run verify`는 EXIT 0으로 끝났고 3분 2초가 걸렸다.

| 항목 | 결과 |
|---|---|
| typecheck | 통과 |
| 루트 테스트 | 243/243 |
| 클라이언트 테스트 | 255/255 |
| fuzz | 10 통과, 2 건너뜀(느린 레인) |
| e2e(chromium+webkit) | 70/70 |
| build:m1 | 통과 |

- 로컬 retries는 0이다. 실패나 플레이크가 없어서 다시 돌릴 대상이 없었다.
- `test:fuzz:slow`(생성 시간 게이트)는 2/2 통과했고 45.6 s가 걸렸다.

### 시뮬레이터 실행

- build:m1, ios:sync 뒤 Debug와 Release를 새로 빌드했다(derivedData는 /private/tmp).
- `public`과 `dist`가 일치하는 것을 확인했다.
- 앱을 지우고 새로 설치해 iPhone 17 Pro Max 시뮬레이터에서 실제 탭으로 진행했다.
- 진행 순서: 목표 카드 → gentle 1 풀이 → 피날레 → 재실행 이어하기 → 설정 → 마을(기념 판) → 탑 이동(deduce 1) → 데일리 풀이 → 결과 시트 → 홈.
- 스크린샷 22장과 탑 이동 연속 촬영 8장(`_burst/`)이 `playtest/shots/reality/`에 있다.
- JS 콘솔과 os_log에 예외, TypeError, 처리되지 않은 rejection이 0건이었다.
  - 첫 설치 때 파일이 없어서 readFile 오류 로그가 나오는데, 정상 동작이다.
  - 나머지는 시뮬레이터 플랫폼 소음이다.
- 프레임: 평균 16.6 ms, 20 ms를 넘는 프레임 0.
- Release 빌드도 설치하고 실행했다(`18-…`). 홈 화면 아이콘과 이름 Duskwick이 보였다(`19-…`).

### 코드 리뷰 수정이 실제로 들어갔는지

전부 코드와 테스트로 확인했다.

| 수정 | 코드 | 테스트 |
|---|---|---|
| journal `.tmp` 복구 후 다시 쓰기 | `readAtomic().fromTmp` → `rewriteJournal` | session.test 184 |
| `untilClosed` + `serial` 타임아웃 | 있음 | ads.test 64–114, 208 |
| `stillAtBreak` | 있음 | ads.test 180–203 |
| 마을 resize 리스너 해제 | `destroy`와 `finish`에서 `off` | e2e P1-5 |
| `create()` 실패 복구, 오래된 마을 장면 교체 | 있음 | e2e P1-6 |
| VoiceOver로 마을 닫기 | 있음 | e2e P1-7 |

광고 이벤트 이름은 플러그인 enum과 Swift `notifyListeners`에 나오는 이름과 맞춰 봤다.

### 출시 게이트

- `ios:release-check`는 테스트 광고 항목 3개(config ID, `testing:true`, plist 앱 ID)에서만 실패했다. 하드 실패는 0이다. 예상한 결과다.
- Release 빌드에서 `check-no-probe`가 OK였다. 대조군인 Debug에서는 94건이 잡혔다.
- `PrivacyInfo.xcprivacy`가 앱에 있고 lint를 통과했다. GMA, UMP, Capacitor 자체 매니페스트도 번들에 들어 있다.
- 표시 이름 Duskwick, 번들 ID `com.humsleep.duskwick`을 확인했다.
- 에셋 카탈로그에 AppIcon Any(불투명), Dark, Tinted가 컴파일돼 있다. LaunchDusk 이미지와 LaunchScreen도 들어 있다.

### UX 감사 대조

- 새로 찍은 스크린샷으로 확인한 것:
  - P0-2: 이동 중 HUD가 0이 된다(`_burst/13-*`).
  - P0-3: 안내에 실제 등불이 쓰인다.
  - P1-11: 하단 결과 시트.
  - P1-12: 집 아이콘이 하나로 통일됐다.
  - P1-13: 설정에 진동과 다시 보기가 있다.
- v7/v7b에서만 확인한 것: P0-1, P0-4(동작 줄이기 포함), P1-6/7/8, P1-14(SE).
- P0-5 VoiceOver: DOM 레이블은 e2e로 검증됐다. 실제 VoiceOver 낭독은 확인하지 못했다.

## 새로 발견한 것

1. **P1: 동의 UI가 온보딩을 끊는다.**
   - 첫 실행에서 레벨 1을 깨자마자 UMP의 IDFA 설명 화면이 뜬다. ATT 프롬프트는 그 다음에 온다.
   - 이때 화면은 gentle 2 숫자 교습 중이고, 손가락 애니메이션이 아래에서 계속 돈다(`06-consent-prompt-over-level2.png`).
   - 의도된 동작이다(`ads/index.ts`의 "첫 결과 순간"). 하지만 전면 광고 유예(5 단위)보다 먼저 묻는다.
   - 권고: 유예가 끝나거나 안내가 끝난 뒤로 미룬다.
   - 이 문제는 출시를 막지 않는다.
2. **P2: 숫자 교습 손가락이 "2" 돌의 위쪽 절반을 가린다** (`11-town-closed.png`). "숫자 위에 아무것도 없게" 원칙과 맞지 않는다.

## 여기서 검증할 수 없는 것

| 항목 | 출시 차단 | 담당 |
|---|---|---|
| 실기기 콜드 스타트 p75 ≤ 1.0 s | **예** | 개발자(기기) |
| 실제 AdMob ID와 `testing:false` | **예** | 계정 → 코드 |
| App Store Connect 레코드, App Privacy 답변 | **예** | 계정 |
| 실기기 Filesystem rename | 아니오 | 개발자(기기) |
| 실제 광고 채움, 동의 흐름 | 아니오 | 계정 |
| 사람 테스터, 실제 VoiceOver | 권장 | 사람 |

- 콜드 스타트: 이 수치는 엔진 결정 게이트다. `playtest/perf`에는 과부하 상태에서 돌린 SE 시뮬레이터 데이터 8건(6–24 s)뿐이다. 이제 GMA가 동적 프레임워크로 링크되므로 다시 측정해야 한다(`ios:device:m1 && measure:ios -- m1 20`).
- 참고로 시뮬레이터 Debug에서 잰 "tap→interactive"는 첫 설치 3.7 s, 재실행 1.4–1.5 s였다. 게이트 근거로는 쓸 수 없다.
- 실제 AdMob ID: 개발자가 계정에서 ID를 발급하고, 코드는 그 값을 config와 Info.plist에 넣는다.

## 출시 전 필수

1. 개발자: 실기기에서 Measure 20회 측정. p75 ≤ 1.0 s를 넘으면 엔진 결정을 다시 해야 한다.
2. 개발자 계정: AdMob 앱과 광고 단위 발급, UMP 메시지 설정. App Store Connect 레코드 생성, App Privacy 답변(README 표).
3. 코드: 실제 ID 반영, `testing:false`, `ios:release-check` 녹색 확인 뒤 `ios:archive`.
4. 개발자: 실기기에서 저장 rename 확인, 사람 테스터 한 차례.
