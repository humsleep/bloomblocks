# 실기기 재측정 (Phase 5 이후) — 2026-10-16 오후

진행 기록. 단계마다 갱신한다.

## 0. 사전 확인 (15:29)
- devicectl: iPhone 14 Pro FAECA527-… "available (paired)".
- `devicectl device info lockState` → passcodeRequired: **true** (잠김으로 판정). 측정 스크립트는 이 상태에서 exit 2.
- 15:30 재확인 3회(20 s 간격) 모두 passcodeRequired: true → **기기 작업 중단**(규칙). 기기 없이 할 수 있는 일만 진행.
- 15:31 Release 빌드(build:m1 + ios:sync + xcodebuild Release, build/dd-device) 성공 — 다른 에이전트의 Info.plist/PrivacyInfo 편집 상태로도 빌드됨.
- `scripts/check-no-probe.sh build/dd-device/Build/Products/Release-iphoneos/App.app` → OK (프로브 기호·문자열 0건).
- 이전 실행 재분석(`node stats.mjs */run.jsonl`, 이 폴더의 stats.mjs 새로 작성): 오전 M1 p75 917 ms의 95% 신뢰구간은 bootstrap [871, 2525] — n=20, 이상값 3개라 p75가 이상값 경계 바로 아래. 단일 배치로는 판정이 불안정.
- 15:4x lockState passcodeRequired: false 로 바뀜 → 측정 재개.

## 1. 배치 A — M1 Measure (15:36, 20261016-153632-m1/)
- n=20 p50 368 / p75 379 / p90 380 / max 385 ms, >1.5 s 이상값 0.
- 중앙값 분해: 프로세스 시작→didFinishLaunching 38 | 시작→WebView 내비게이션 시작 166 | 내비게이션→인터랙티브(webMs) 206.
- 오전(Phase 5 이전) M1: 시작→내비 395, webMs 466(비이상값). 이번이 두 구간 모두 약 2배 빠름 → 코드보다 기기 상태(오전 발열/저전력/재부팅 직후 백그라운드 작업 추정) 차이가 큼.

## 1. 배치 B — M0 Measure (15:40, 20261016-154038-m0/)
    20261016-154038-m0/run.jsonl  m0  n=20 p50=164 p75=169 p90=173 max=184  >1.5s: 0
       median split: start→didFinishLaunching 35 | start→nav 160 | nav→interactive (webMs) 4   (non-outliers webMs median 4)
- 오전 M0(p50 429–484)보다 약 2.7배 빠름 → 기기 상태 차이 확인(빈 앱에서도).

## 1. 배치 C — M1 Measure (15:44, 20261016-154433-m1/)
- n=20 p50 372 / p75 375 / p90 378 / max 402 ms, 이상값 0. 분해: dfl 36 | 시작→내비 162 | webMs 207.

## 1. 합산 결과
| 배치 | n | p50 | p75 | p90 | max | >1.5 s |
|---|---|---|---|---|---|---|
| A M1 15:36 | 20 | 368 | 379 | 380 | 385 | 0 |
| B M0 15:40 | 20 | 164 | 169 | 173 | 184 | 0 |
| C M1 15:44 | 20 | 372 | 375 | 378 | 402 | 0 |
| (오전) M1 08:42, Phase 5 이전 | 20 | 871 | 917 | 2525 | 2625 | 3 |
- **합산 M1 n=40 p75 377 ms, 95% CI [374, 380] (bootstrap·순서통계 일치) → 게이트 1.0 s PASS, 여유 약 620 ms.**
- M1−M0 웹 구간(번들 평가 + Phaser 부트 + create/bake + 첫 렌더 + 2 rAF) ≈ 203 ms.
- 오전 대비: M0도 2.6배 느렸으므로(시작→내비 395 vs 160) 오전은 기기 상태가 나빴다(원인 미확인: 발열·저전력 모드·재부팅 직후 작업 등). 오전 상태에서의 Phase 5 M1을 비례 환산하면 약 0.85–0.95 s로 추정(측정 아님) → 나쁜 상태에서는 여유가 좁을 수 있음.
- 이번에는 ~2 s 이상값이 60회 중 0회. 오전 이상값(webMs ≈ 2.2 s, M0에서도)은 기기 상태와 함께 사라짐 → 앱 코드가 아니라 OS/WebKit 쪽이라는 오전 추정과 맞음.
- 판정 규칙(p75 > 1.0 s 또는 여유 < 50 ms)에 해당하지 않음 → 2단계 코드 변경 없음. (분석·제안은 아래 2단계에 기록)

## 2. 원인 분석과 제안 (코드 변경 없음 — 게이트 여유 충분)
측정: 비압축 M1 번들(vite build --mode m1 --minify false)을 Chromium(Playwright, 393×852 @3x, CPU 4배 감속)에서 6회 콜드 로드 + CDP CPU 프로파일.
- `[boot] scene create (sky/board bake)` 217–254 ms(인계 문서의 "저속 기준 251 ms"와 일치). web mark 662–873 ms.
- create 248 ms 내역(포함 시간): layout 191 ms [보드 바탕 bake(BoardView.build→canvas) 59 ms, **Guide.layoutCard 목표 카드(goalPanel+goalYard+lit) ≈ 56 ms**, SettingsSheet.layout 19 ms, Scenery.layout 11 ms, redraw 9 ms], **SettingsSheet 생성자 29 ms**(Text 7개 생성·MeasureText), BoardView 생성 11 ms, AskCard 8 ms.
- stampSlab(돌판 스탬프)가 자체 시간 1위(약 125 ms, 보드 바탕과 목표 카드 바닥 양쪽에서 호출).
- ensureLit(밝은 바닥, 68 ms)은 delayedCall(120)이라 mark 이후에 실행됨 — 임계 경로 아님.
- **첫 프레임에 보이지 않는 bake ≈ 100 ms / 248 ms(약 40%)**: 목표 카드(첫 실행에서도 idle ≥ 600 ms 뒤 Guide.start({kind:"goal"})에서야 보임), 설정 시트(열 때만 보임).
제안(가장 싼 순서, 필요해지면 적용):
1. Guide.layout()에서 layoutCard()를 바로 부르지 않고 `cardDirty = true`만 표시 → `start(d)`에서 `d.kind === "goal" && cardDirty`일 때 layoutCard(). 목표 카드가 이미 떠 있는 중 relayout이면 즉시 bake. mcs는 goal 경로에서만 쓰므로 안전. (약 −56 ms @4x, 파일 1개 10줄 내외)
2. SettingsSheet.layout()을 지연: 값만 저장하고 show()에서 실제 layout(이미 show()에 relayout 분기가 있음). cloudBox()/controls()/hit()가 열리기 전에 불리는지(VoiceOver 트리) 확인 필요. (약 −19 ms)
3. SettingsSheet의 Text 7개 생성을 첫 show()로 미루기 — markHud(objects) 등록 순서를 바꿔야 해서 리팩터 규모. (약 −29 ms)
실기기 환산: 오늘 상태에서 M1−M0 웹 구간 전체가 약 203 ms이므로 1+2 적용 시 기기에서 수십 ms 단축 예상. 지금은 불필요, WebGL 블룸 등 다음 첫 프레임 비용이 붙을 때 먼저 적용할 후보.

## 3. Release 빌드 + 소크 (15:49–15:54, playtest/perf/20261016-154912-soak/)
- `CONFIG=Release npm run ios:device:m1` 설치 OK.
- phase A(30 s마다 콜드 재실행 10회): 10/10 살아 있음(alive.tsv 모두 1).
- phase B 실패: `xctrace record --device FAECA527-…` → "No devices found" (xctrace는 하드웨어 UDID 00008120-001A3D1C3468C01E를 씀). crash-listing도 grep 대소문자 문제로 Jetsam을 못 잡음.
- **scripts/soak-ios.sh 수정**: devicectl details에서 하드웨어 UDID를 읽어 xctrace에 넘김(HWUDID), crash grep을 대소문자 무시 + Retired/ 포함 + WebContent.
- 수동 확인: 기기 crash 로그 목록에 오늘 App-*.ips 없음, 마지막 JetsamEvent는 10/15 22:51(측정 전) → 크래시·jetsam 0.

## 3b. 소크 phase B 대체 — Activity Monitor 5 min 대기(보드 화면, 15:59–16:04, soak-activity.trace)
xctrace Activity Monitor, 하드웨어 UDID, --all-processes, 300 s. (Leaks 템플릿 대신: 메모리는 대부분 WebContent 프로세스에 있어서 전 프로세스 기록이 high-water에 맞음)
| 프로세스 | footprint 최대 | 처음 10% → 마지막 10% | CPU 평균 / 최대 |
|---|---|---|---|
| App (네이티브 셸) | 16.6 MB | 16.5 → 16.4 MB | 5.3% / 7.3% |
| WebKit.WebContent | **311 MB** | 297 → 294 MB | 11.4% / 21.1% |
| WebKit.GPU | 44 MB | 30 → 30 MB | **28.7%** / 30.9% |
- 메모리 증가 추세 없음(누수 징후 없음). 합계 high-water ≈ 370 MB(App+WebContent+GPU).
- **열 상태: 5분 내내 "Serious"** (device-thermal-state-intervals). 충전 중 + 연속 측정 직후. Serious에서는 CPU가 제한되므로 이 구간의 CPU 수치는 보수적이지 않음.
- **가만히 있는 보드 화면에서도 앱 관련 CPU 합계 ≈ 45%/코어**(GPU 프로세스 29% + WebContent 11% + App 5%) → 게임 루프가 정지 화면에서도 계속 그리는 것으로 보임. 배터리·발열 위험(목표 '활성 사용 시 시간당 < 5%'). 제안: 입력·애니메이션이 없으면 Phaser loop를 낮은 fps(예: game.loop 목표 fps 낮춤 또는 sleep/wake)로 전환. 이번에는 변경하지 않음(동작 영향 큼, 사용자 승인 필요).
- 크래시 재확인(16:1x): 오늘 날짜의 App-*.ips / JetsamEvent / WebContent 크래시 없음.

## 3c. 일반 Release 빌드 재설치 (16:1x, 현재 코드 — 컴플라이언스 에이전트의 consentAfterUnits=1 / 설정 개인정보 처리방침 행 포함)
- `CONFIG=Release npm run ios:device:m1` 설치 OK.
- `scripts/check-no-probe.sh build/dd-device/Build/Products/Release-iphoneos/App.app` → OK (probe / lanternly.perf / perf.jsonl / test bridge 0건).

## 4. 새로 설치 첫 실행 (16:12, Release, com.humsleep.duskwick만 삭제 후 재설치)
- 기기 화면은 볼 수 없음(devicectl에 스크린샷 없음). 기기 시스템 로그(`log collect --device-udid`)는 root 필요 → 하지 않음. 증거: `devicectl process launch --console` 출력(fresh-install-console.txt) + 앱 컨테이너 상태(fresh-install-container/).
- 타임라인(앱 저장값의 시각):
  - 16:12:09 실행, 16:12:11 lastActiveAt(세션 1).
  - 16:12:21 첫 확정 수 → 광고 init(ads.state.installAt) + 콘솔 `<UMP SDK> … testDeviceIdentifiers` = requestConsentInfo(화면 없음). **첫 실행에서 플레이 전에는 동의/ATT 호출 경로 자체가 없음.**
  - 그사이 누군가 기기에서 보드 1을 풀었음(progress gentle cleared 1, units 1, runs/p5-00000001.bin). 이 에이전트는 기기를 터치할 수 없다.
  - 16:12:47 lastFullscreenAt 기록 = gatherConsent()가 "표시함"으로 돌아온 시각(보드 1 완료 뒤 다음 판 사이). UMP 저장값: gdprApplies 0, ump_status 3, IDFA_freqCapNumViews "1" → UMP의 IDFA 안내 메시지가 1회 표시된 뒤 ATT 요청으로 이어진 것으로 보임. ATT를 기기 설정에서 전역으로 끈 경우에도 같은 값이 남으므로 실제 시스템 ATT 대화상자가 떴는지는 눈으로 확인 필요.
- 알림: Preferences에 notify 키 없음 → enable()(시스템 알림 요청의 유일한 경로) 미호출 → **첫 실행에서 알림 권한 요청 없음**.
- 콘솔 종료 시 devicectl이 앱에 SIGTERM(15)을 보냄(측정 도구 때문, 크래시 아님).

## 요약 (16:15)
- 콜드 스타트 게이트: **PASS** — 합산 M1 n=40 p75 377 ms, 95% CI [374, 380], 이상값 0/60. 단, 오전처럼 기기 상태가 나쁘면(M0도 2.6배 느림) 약 0.85–0.95 s 추정 → 출시 전 "발열/저전력 상태"에서 한 배치 더 재 보는 것을 권장.
- 소크: 재실행 10/10 생존, 크래시·jetsam 0, WebContent footprint 최대 311 MB(추세 평탄), 대기 중 CPU 합계 ~45%/코어, 열 상태 Serious(5분 내내).
- 기기에 남은 빌드: 일반 Release(현재 코드). check-no-probe OK.
- 변경한 파일: apps/client/scripts/soak-ios.sh(xctrace 하드웨어 UDID, crash grep). 수정본은 아직 전체 재실행 안 함.
- 이어서 할 일: 전체 소크 재실행 `cd apps/client && scripts/soak-ios.sh` (Leaks 포함, 기기를 식힌 뒤), 대기 중 프레임 루프 감속 검토(사용자 승인 필요).
