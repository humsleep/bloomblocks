# 대기 중 프레임 거버너 (idle frame governor) — 2026-10-16

진행 기록. 단계마다 갱신한다. 배경: playtest/perf/20261016-device/remeasure.md §3b (iPhone 14 Pro, 보드 화면 5분 무입력:
WebContent 11.4% + GPU 28.7% + App 5.3% ≈ 45%/코어, 열 상태 Serious).

## 0. 조사 (시작)
- 애니메이션은 Phaser tween을 쓰지 않는다. 모든 채널이 `LanternsScene.update(time)` 안에서 시각(time) 기반으로 계산된다
  (BoardView/Guide/Scenery/SettingsSheet/ResultSheet/AskCard `.update(now)`, step* 함수들). TownScene도 자체 update.
- Phaser 3.90 TimeStep: rAF마다 `step()` → `this.callback(time, delta)` = Game.step(update + CANVAS 전체 렌더).
  CANVAS 렌더러에는 dirty-rect가 없다 → 매 프레임 전체 캔버스(1179×2556 @3x)를 다시 그리고 합성기가 업로드한다.
- Phaser는 document.hidden에서 이미 loop.pause()(rAF 정지)를 한다(VisibilityHandler).

## 1. 기준 측정 (BEFORE, 15:5x 전후 아님 — 이 세션 첫 측정)
도구: `apps/client/scripts/measure-idle.mjs` (새 파일). Chromium(Playwright, channel "chromium" = GPU 프로세스가 있는 new-headless),
e2e 빌드(가짜 Capacitor + e2e 브리지), 393×852 @3x, 화면이 안정된 뒤(3–4 s) 20 s 무입력.
열: renders/s = Phaser 렌더 패스(postrender), frames/s = 합성기 DrawFrame(trace), task/script = CDP Performance.getMetrics 증가분,
renderer/GPU = CDP SystemInfo.getProcessInfo cpuTime 증가분(프로세스 전체), 탭 = 합성 pointerdown → 다음 Phaser 렌더(5회 중앙값).
| 화면 | 회차 | renders/s | frames/s | task ms/s | script ms/s | renderer CPU ms/s | GPU CPU ms/s | 탭→렌더 ms |
|---|---|---|---|---|---|---|---|---|
| 보드 | 1 | 60 | 60 | 94.0 | 51.9 | 145.7 | 164.7 | 11.6 |
| 보드 | 2 | 60 | 60 | 79.6 | 43.6 | 123.9 | 158.2 | 13.3 |
| 마을 | 1 | 60 | 60 | 54.8 | 24.3 | 140.1 | 125.4 | 13.5 |
| 마을 | 2 | 60 | 60 | 52.1 | 22.7 | 128.7 | 116.1 | 13.3 |
| 결과 시트 | 1 | 60 | 60 | 88.2 | 51.0 | 152.1 | 144.5 | 13.6 |
| 결과 시트 | 2 | 60 | 60 | 65.0 | 36.6 | 118.9 | 104.8 | 13.3 |
- 세 화면 모두 아무것도 안 해도 **60 렌더/s = 60 합성 프레임/s**. renderer+GPU ≈ 250–310 ms/s (Mac 기준, 한 코어의 25–31%) — 기기의 45%/코어와 같은 모양(GPU 쪽이 더 큼).
- (참고) 보드 화면 5번째 탭에서 약 190 ms 한 번 — 탭 자체와 무관한 주기 작업으로 보임(아래에서 확인).

## 2. 매 프레임 무엇이 도는가 (프로파일)
- 대기 중 매 프레임: `LanternsScene.update` 전체(보드 채널 9개 step + render, 가이드, 풍경, 시트, HUD step*, a11y 동기화 ≤4 Hz) +
  Phaser CANVAS 전체 렌더. 대기 중에 실제로 값이 바뀌는 것은 "주변 연출"뿐이다:
  - 풍경(Scenery): 별 반짝임, 반딧불 16마리 이동(최대 약 44 pt/s, 보통 12–20 pt/s), 굴뚝 연기 3개(약 18 pt/s), 창문 깜빡임, 하트 창 빛, 탑 창문·등대 숨쉬기, 먼 집 창, 달 숨쉬기(데일리 대기 중).
  - HUD: 오늘 타일 빛, 먼 집 빛, 골목 현재 칸 빛, 힌트 버튼 숨쉬기(remove 상태).
  - 보드: 등불 불꽃 숨쉬기(1.6 s), 바닥 빛 웅덩이 깜빡임(0.8 Hz), 달/차가운 테, 숫자 따뜻한 빛, 넘침 베일·꼬리표 흔들림, 막힘 표시, 실, 거의 완성 칸 숨쉬기, ✕ 숨쉬기, 힌트 유령 흔들림.
  - 결과 시트: 공유 버튼 숨쉬기. 마을: 빛 24개, 별, 나방, 고양이 꼬리(5.2 s마다 0.9 s).
- Phaser tween은 쓰지 않는다(모든 채널이 시각 기반 수식). 프레임 수에 묶인 이징은 하나뿐: 반딧불 모이기(`fW += (goal-fW)*0.025`/프레임).
- 도구: `__test.governor.movers()` (DEV/e2e) — ambient 표시가 없는 객체 중 프레임 사이에 바뀐 것을 나열. `apps/client/scripts/_movers.mjs`(임시)로 화면별 확인.

## 3. 설계와 구현 (frameGovernor.ts)
- `src/game/frameGovernor.ts`: `game.loop.callback`(= Game.step)을 감싼다. rAF는 계속 돈다 → 대기 뒤 첫 탭도 다음 vsync에 그려진다.
  - 전체 속도: 입력 뒤 1.5 s, `keepAwake()`, Phaser tween 실행 중, 또는 **움직임 서명**(실행 중·보이는 씬의 카메라 + ambient 아닌 표시 객체의 위치·크기·회전·알파·보임·Text 내용·Graphics 명령 수 해시)이 바뀐 뒤 1.5 s.
  - 주변(ambient) 20 fps: 위 조건이 없을 때. 건너뛴 프레임의 delta는 다음 step에 합쳐서 넘긴다(플레이 시간·Phaser 타이머 정확).
  - 잠듦(rAF 없음): document.hidden, Capacitor App pause, 전면 광고(adsApi.onFullscreen) — `loop.sleep()`/`wake()`.
  - 입력 깨우기: window capture 단계 pointer/touch/mouse/wheel/keydown/click(VoiceOver 활성화 포함) → Phaser보다 먼저. 깨울 때 씬 시계(`sys.time.now`)를 마지막 vsync 시각으로 당겨서, 그 탭이 시작하는 애니메이션(t0 = time.now)이 최대 50 ms 늦게 시작해 앞부분이 잘리는 일을 막는다.
  - 실패 방향이 안전하다: ambient 표시를 빠뜨린 객체가 계속 움직이면 전체 속도로 남는다(화질 손실 없음, 절약만 없음).
- `ambient(obj)` 표시: Scenery(달, 하트 빛, 창문, 별, 반딧불, 연기, 탑 창·등대, 먼 집 창), LanternsScene(힌트 버튼, 오늘 빛, 먼 집 빛, 골목 빛),
  BoardView(거의 완성 칸, 막힘 표시, 베일, 따뜻한 숫자, 넘침 꼬리표, 실, ✕, 힌트 유령·고리, 등불의 웅덩이·불꽃·달 고리·차가운 테 — 몸통·그림자는 아님),
  ResultSheet(공유 버튼), TownScene(빛, 별, 나방, 꼬리).
- 반딧불 모이기 이징을 시간 기반으로 바꿈(60 Hz에서는 같은 값) + 모이는 동안 keepAwake. 충돌 등불의 빠른(~7 Hz) 깜빡임 중에는 keepAwake(20 fps에서 엘리어싱).
- main.ts: 첫 프레임 뒤(afterInteractive)에 install → 콜드 스타트 경로 변화 없음. App pause/resume, 광고 전면 열림/닫힘에 sleep/resume.
- 1차 확인(movers): 보드 g14, 탑 d5, 설정 시트, 결과 시트, 데일리 보드, 마을 → 모두 3.5 s 뒤 ambient 20 fps. 첫 실행(가이드 시연)은 손가락이 움직이므로 전체 속도(의도).

## 3b. 1차 구현(콜백 감싸기) 측정 → 스케줄러 방식으로 변경
- 1차(rAF는 매 vsync, 20 fps만 step): 보드 renders 60→20, GPU CPU 158–165 → 65–68 ms/s, renderer 124–146 → 70–77 ms/s.
- 실험: 루프를 완전히 재우면 renderer 5.8 / GPU 5.4 ms/s. **아무것도 안 하는 60 Hz rAF만으로** renderer 38.8 / GPU 17.3 ms/s
  → 남은 비용의 약 절반이 빈 vsync 콜백이었다.
- 그래서 거버너가 루프 스케줄링을 맡도록 바꿈: install 때 Phaser rAF를 한 번 `loop.sleep()`, 이후
  - 전체 속도: 매 vsync에 `TimeStep.step(t)`(Phaser의 delta 평활화 그대로),
  - ambient: 타이머(다음 step 한 vsync 전) → rAF 1회 → step. step의 delta는 실제 경과 시간(최대 250 ms) → 플레이 시간·타이머 정확,
  - 입력: 타이머 취소 + 다음 vsync 요청(지연은 전과 같음), 잠듦: 타이머·rAF 모두 취소, 재개 첫 프레임 delta ≤ 1 vsync.
- 단위 테스트 `tests/frameGovernor.test.ts`(가짜 60 Hz 디스플레이): 대기 → 19–21 fps, 탭 → 다음 vsync, 움직임 → 전체 속도 후 복귀, delta 합 = 경과 시간, sleep/resume, force. 5/5 통과.
- e2e `e2e/smoke.spec.ts` "idle frame governor": 대기 1 s 렌더 14–26회, 실제 탭 → 다음 렌더 < 50 ms, 600 ms 뒤 fps > 40.
- 23:01 1차 verify: 루트 생성기 테스트 3개가 600 s/300 s 타임아웃(1,000 seeds 3670 s 등) — 같은 시간대 측정 스크립트의 20 s sleep이 974–1011 s로 늘어남 → 기기(Mac) 일시 정지/과부하. 코드와 무관(core/games 미변경). caffeinate로 재실행.
- 00:0x 2차 verify도 루트 생성기 테스트에서 1,000 s 이상 걸림. 원인: Mac이 **저전력 모드(lowpowermode 1)** + 메모리 부족(사용 가능 100 MB, 스왑 5.6 GB, 다른 프로세스 chroma-mcp 150% CPU) — vitest 워커가 1시간 동안 CPU 55 s만 받음. 시스템 설정은 바꾸지 않는다(규칙).
  → 순서를 바꿔 이 변경과 직접 관련된 e2e(chromium+webkit)와 build:m1을 먼저 돌리고, 루트/fuzz는 그 뒤에 단독으로 돌린다.

## 4. 검증 (진행 중, 00:xx — Mac 부하 매우 큼: load avg 최대 161, 저전력 모드, 스왑 5.6 GB)
- `npm --prefix apps/client run typecheck:all` 통과. 클라이언트 vitest 21 파일 355/355 통과(새 frameGovernor.test.ts 5개 포함).
- e2e 전체(chromium+webkit, 2 workers, 18.3 min): 102 통과 / 10 실패 / 26 건너뜀(shots, 원래 skip).
  실패 분석(각각 단독 재실행):
  - flow:70 "finale gates … a tap during the finale still skips", play:104 PERF-1 → 거버너 켠 빌드로 단독 재실행 chromium+webkit **4/4 통과** → 부하 플레이크.
  - smoke "idle frame governor"(새 테스트) webkit 실패: Playwright WebKit의 rAF가 **30 Hz**라 "fps > 40" 가정이 틀림(ambient도 15 fps). 테스트를 화면 자체 rAF 속도 기준으로 바꿈 → chromium+webkit ×3 **6/6 통과**.
  - daily:94 "streak across days", sync:83, sync:127 → **거버너를 끈 빌드(VITE_IDLE_GOVERNOR=off)로도 실패**(chromium 3/3 실패). 실패 화면은 "내일 퍼즐을 조용히 알려 드릴까요?" 확인 카드(알림 soft ask)가 떠서 `isIdle()`이 false인 상태 — 홈 탭 뒤 setTimeout으로 뜨는 카드와 waitIdle 사이 경합. 거버너와 무관(프레임이 아니라 타이머·폴링). 켠 빌드로 daily:94 단독 1회는 통과, 2 workers에서는 다시 실패.
- 빌드 시 끄기 스위치: `VITE_IDLE_GOVERNOR=off` (A/B 측정용, 기본은 켜짐).
- 루트 `npm run typecheck` + `npm test` 249/249 + `test:fuzz` 10 통과(2 skip, 원래) + `build:m1` 성공. m1 번들에 `__test` 없음(거버너 본체와 DEV용 movers() 메서드만 포함).

## 5. 최종 측정 (00:49–00:57, before/after 번갈아 2회, 같은 조건 · load 13→3)
| 화면 | 빌드 | renders/s | task ms/s | script ms/s | renderer CPU ms/s | GPU CPU ms/s | 탭→렌더 ms (중앙값) |
|---|---|---|---|---|---|---|---|
| 보드 | before | 56.5 / 57.1 | 79.8 / 62.7 | 44.0 / 35.2 | 121.9 / 98.3 | 149.1 / 124.6 | 11.3 / 11.9 |
| 보드 | after | **20 / 20** | 38.6 / 41.0 | 21.1 / 22.5 | 66.0 / 71.9 | **67.4 / 62.8** | 5.4 / 11.6 |
| 마을 | before | 57.6 / 58.6 | 51.7 / 56.1 | 23.9 / 25.6 | 122.3 / 129.0 | 110.0 / 119.6 | 10.2 / 11.8 |
| 마을 | after | **19.9 / 20** | 27.7 / 25.5 | 11.8 / 11.0 | 90.9 / 88.8 | **54.0 / 49.1** | 11.3 / 11.1 |
| 결과 시트 | before | 58.9 / 54.7 | 119.3 / 80.6 | 67.8 / 45.0 | 203.0 / 142.0 | 198.9 / 135.7 | 13.8 / 11.5 |
| 결과 시트 | after | **21.8 / 22.2** | 50.2 / 55.0 | 29.0 / 32.0 | 114.9 / 114.9 | **68.9 / 74.5** | 11.7 / 7.0 |
(before는 부하가 남아 있던 탓에 renders가 60에 못 미침. 결과 시트 ~22 = 20 fps + 시트 진입 직후의 짧은 전체 속도 구간.)
- 요약: 대기 중 캔버스 다시 그리기 약 −65%(60→20), 메인 스레드 task −45~55%, GPU 프로세스 CPU −50~55%, renderer 프로세스 −20~45%
  (renderer에 남은 몫은 레벨/기념품 워커와 20 fps 그리기). renderer+GPU 합계: 보드 247→134, 마을 241→141, 결과 340→187 ms/s (평균).
- 대기 뒤 첫 탭: pointerdown → 다음 렌더 중앙값 before 10–14 ms, after 5–12 ms(나빠지지 않음).
- 보드 5번째 탭의 230–520 ms 한 번은 before/after 모두 있음 → 거버너와 무관한 기존 주기 작업(별도 조사 필요).

## 6. 최종 `npm run verify` (01:0x, 부하가 내려간 뒤, caffeinate) — **녹색, EXIT 0**
- 루트 249/249, 클라이언트 355/355, fuzz 10 통과(2 skip), e2e chromium+webkit **112 통과 / 0 실패** / 26 skip(shots), build:m1 성공.
- 4절에서 실패했던 daily:94, sync:83, sync:127, flow:70, PERF-1도 이번에는 모두 통과 → 부하 때의 경합(알림 확인 카드 vs waitIdle)과 타임아웃이었다.

## 남은 위험 / 기기에서 확인할 것
- WKWebView에서 실제 절감폭(GPU 프로세스가 가장 큼)은 기기 측정이 필요하다(다른 에이전트). 기대: 보드 대기 중 GPU 28.7% → 약 10–13%, WebContent 11% → 약 6%.
- 20 fps에서 반딧불(최대 약 2 pt/프레임)·연기·나방 날갯짓이 "부드럽게" 보이는지 눈으로 확인. 문제가 있으면 AMBIENT_FPS를 24–30으로 올리면 된다(상수 하나).
- 충돌(서로 보는 등불) 상태와 "넘침" 흔들림 구간, 가이드 시연 중에는 의도적으로 60 fps를 유지한다(그 상태로 오래 두면 절약 없음).
- ambient() 표시를 새 연출에 빠뜨리면 그 화면은 60 fps로 남는다(안전한 실패) → `scripts/idle-movers.mjs`로 확인.
- 전면 광고 닫힘 콜백이 오지 않는 경우: 웹뷰에 터치가 닿으면 "ad" 잠듦을 풀도록 안전장치를 넣었다.
