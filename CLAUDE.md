# puzzle-lab

모바일 퍼즐 프로토타입 포트폴리오(B1 등불 정원 → A1 화단 라운드 → A2 문 심기)의  **결정론적 규칙 정본**. 같은 코드가 게임 클라이언트(`apps/client`, Capacitor 8 + Phaser WebView, iOS 먼저), Cloudflare Workers 재생 검증, Node 봇 시뮬레이터, 웹 데일리에서 돈다. 엔진은 iPhone 시작 속도 게이트 통과 시 확정(실패하면 Unity C# 포트). 기준 계획: ~/Downloads/Puzzle_Portfolio_결정_v3_현금0원.md

현재 기본 규칙은 `games/lanterns-pips/`(숫자 돌 Akari, 정답 하나, gentle·deduce 두 트랙). 근거: `playtest/ANALYSIS.md`. `games/lanterns/`(숫자 없는 예산형)는 비교용으로만 남긴다.

## 구조

- `core/` — 엔진 중립 코어 (~580줄 이하 유지, 순수성 테스트가 상한을 검사). `rng.ts` xoshiro128** + SHA-256 시드, `hash.ts` FNV-1a·CRC-32, `game.ts` `Game<State, Move>` 인터페이스, `runlog.ts` run.bin 인코딩·재생·검증, `bytes.ts`, `sha256.ts`
- `games/lanterns/` — B1 규칙 + 시드 생성기(`generator.ts`: `levelForIndex`/`levelForDaily`, 명세 `docs/lanterns-generator.md`), 정확 솔버(`solver.ts`), 사람 흉내 봇(`human.ts`). `fixtureLevel.ts`는 테스트 전용 수제 레벨. 생성 결과가 바뀌면 `GENERATOR_VERSION`을 올린다
- `games/lanterns-pips/` — 플레이테스트 실험용 변형 P(숫자 돌 = Akari, gameId 5): 규칙·정확 유일성 솔버·T1–T3 추론·생성기. 명세 `docs/lanterns-pips.md`. 기존 lanterns를 import만 한다
- `tools/` — `play.ts` AI 플레이테스터용 CLI(`npm run play`, 사용법 `tools/PLAYTEST.md`; `--variant N|P|E|<코드>`, 변형 정의 `tools/variantLevels.ts`, 블라인드 코드표 `playtest/variants.json` — 페르소나에게 보여 주지 않는다), `sim-shots.ts` iOS 시뮬레이터 스크린샷
- `fixtures/` — 골든 픽스처(JSON). C# 포트도 이 파일을 그대로 통과해야 한다
- `scripts/` — 픽스처 생성기 (`fixtureLib.ts`는 테스트와 공유)
- `sim/` — worker_threads 봇 시뮬레이터 + 시간 모델
- `tests/` — vitest
- `docs/runlog-format.md` — run.bin 바이트 표, `docs/lanterns-rules.md` — 포트용 규칙 명세
- `apps/client/` — iOS 클라이언트 껍데기(코어를 import만, core/·games/ 수정 금지). 측정: `npm run ios:device:m1 && npm run measure:ios -- m1 20`

## 규칙

- **core/ 또는 games/*/ 규칙을 바꾸면 fixtures를 다시 생성하지 말고 먼저 기존 fixtures 테스트가 왜 깨졌는지 확인한다; 의도한 변경일 때만 npm run fixtures 후 diff를 검토한다.**
- 앞으로의 C# 포트(또는 다른 언어 포트)는 반드시 같은 `fixtures/`를 바이트 단위로 통과해야 한다. core/ TS를 바꾸면 포트도 같이 바꾼다.
- 게임 로직은 **정수 연산만** 쓴다. 상태에 영향을 주는 부동소수점, `Math.random`, `Date`, 플랫폼 API(DOM, Node, TextEncoder, crypto) 금지. 32비트는 `>>> 0`, 곱셈은 `Math.imul`. `tests/purity.test.ts`와 `tsconfig.core.json`(lib ES2022, types 없음)이 이를 검사한다.
- `apply()`는 입력 상태를 변경하지 않는다. 불법 수는 `null`.
- `stateBytes()`나 수 인코딩을 바꾸는 것은 포맷 변경이다. `docs/runlog-format.md`도 갱신한다.

## 명령

```sh
npm test            # vitest (픽스처 바이트 일치 포함)
npm run typecheck   # 전체 + core 전용(DOM/Node 없음) 두 번
npm run fixtures    # 골든 픽스처 재생성 — 의도한 변경일 때만
npm run play -- new --variant P --track gentle|deduce --index 1   # 숫자 돌 규칙(현재 기본), 플레이테스트 하네스 — tools/PLAYTEST.md
npm run gen:stats:pips -- --track gentle|deduce                    # 트랙별 생성 통계
npm run sim -- --game lanterns --policy random-dark --games 2000 --sec-per-action 4
npm run sim:curve   # 사람 흉내 봇으로 levelForIndex(1..30) 시간 추정 vs 목표
npm run gen:stats -- --count 1000
npm run play -- new --mode free --index 1
npm run play -- new --variant <코드> --index 1   # 블라인드 변형(N/P/E)
npm run depth -- --levels   # N/P/E 깊이 사전 점검(무작위·한 줄 휴리스틱·사람 흉내 봇)
npm run gen:stats:pips -- --count 200
```
