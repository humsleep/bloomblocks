# B1 등불 정원(lanterns) 규칙 — 포트용 정본

구현: `games/lanterns/rules.ts`, `games/lanterns/index.ts`, `games/lanterns/level.ts`. 포트(C# 등)는 이 문서와 `fixtures/lanterns/`(정상 + `reject/`)를 바이트 단위로 통과해야 한다. run.bin 바이트 표는 `docs/runlog-format.md`.

모든 연산은 정수다. 비트보드 워드는 **부호 없는 32비트**로 다룬다(C#은 `uint`; `int`로 두면 칸 31·63에서 부호 비트가 켜져 비교·시프트가 틀어진다 — `wide8` 픽스처가 이를 잡는다).

## 보드와 칸 인덱스

- 보드 W×H, `5 ≤ W, H ≤ 8`.
- 칸 인덱스는 보드 폭과 무관하게 **stride 8**: `i = y*8 + x` (`x`는 열 0..W−1, `y`는 행 0..H−1, 위에서 아래).
- 64칸 비트보드 = u32 두 개: `lo` = 칸 0..31(행 0–3), `hi` = 칸 32..63(행 4–7). 칸 i는 `i < 32`면 `lo`의 비트 i, 아니면 `hi`의 비트 `i−32`.
- 보드 밖 비트는 항상 0이다.
- 레벨 = `{ w, h, budget, stones }`. `budget`은 정수 0..255. `stones.lo`/`stones.hi`는 각각 **정수 0..0xFFFFFFFF**여야 하고(음수, 2³² 이상, 소수, NaN 거부) 보드 밖 비트가 없어야 한다. 위반 시 레벨 거부.
- 바닥(floor) = 보드 안이면서 돌이 아닌 칸.

## 레벨 텍스트 문법

행 문자열 H개, 모두 같은 길이 W. 한 글자 = 한 칸:

| 글자 | 의미 |
| --- | --- |
| `#` | 돌 |
| `.` | 바닥 |
| `L` | 바닥 + 등불(해답 오버레이에서만 의미; 레벨 파싱에서는 `.`과 같다) |

다른 글자, 행 길이 불일치, 크기 범위 밖은 거부. 예: `pocket5` = `.#...` / `...#.` / `.....` / `.#...` / `...#.`, 예산 4.

## 빛 (`lit`)

등불이 있는 각 칸 L에 대해:

1. L 자신이 켜진다(**`lit`은 등불 칸을 포함한다**).
2. 네 방향(+x, −x, +y, −y)으로 한 칸씩 나아가며 켠다. **돌**을 만나거나 보드 **가장자리**를 넘으면 그 방향은 멈춘다(돌 칸은 켜지지 않는다).
3. 다른 등불은 빛을 막지 않는다(빛은 등불 칸을 지나간다).

## 충돌 (`conflicts`)

등불 A의 빛줄기(2단계)가 다른 등불 칸에 닿으면 A는 충돌 상태다. 관계는 대칭이므로 충돌은 항상 2개 이상씩 생긴다. 픽스처의 **`conflicts`는 충돌 상태인 등불의 개수**(쌍의 개수가 아님)다. 예: 한 행에 서로 보이는 등불 3개 → 3. 사이에 돌이 있으면 충돌 아님. 대각선은 서로 보지 않는다.

## 예산과 완료

- `lanternsUsed` = 등불 개수(popcount).
- 예산을 넘겨 놓는 것은 **합법**이다(UI가 초과를 보여 준다). 다만 완료될 수 없다.
- **완료(complete)** ⇔ 다음 셋을 모두 만족:
  1. 모든 바닥 칸이 `lit`,
  2. 충돌 등불 0개,
  3. `lanternsUsed ≤ budget`.
- 어느 하나라도 어기면 미완료. 정본 반례 픽스처: `pocket5-lit-conflict`(모두 켜짐·예산 이내·충돌 3 → 미완료), `cross5-lit-over-budget`(모두 켜짐·충돌 0·5개/예산 4 → 미완료).

## 수(move)와 합법성

수 = "(x, y) 등불 토글"(없으면 놓고 있으면 치움). `apply(state, move)`는 입력을 바꾸지 않고 새 상태 또는 `null`(불법)을 돌려준다. 불법 조건:

1. `x`, `y`가 정수가 아니거나 보드 밖,
2. (x, y)가 돌,
3. **현재 상태가 이미 완료**(완료 후 수 금지).

### 완료 후 정책

한 번 완료되면 **그 뒤의 모든 수는 불법**(`apply`가 `null`)이다. 해결 → 끄기 → 다시 켜기 같은 우회로를 막고, 완료 시 다음 레벨로 넘어가는 클라이언트와 일치한다. 완료 이후 수가 들어 있는 run.bin은 `illegal`로 거부된다(`reject/move-after-complete.json`).

### 수 바이트 (W = 1)

| 비트 | 의미 |
| --- | --- |
| 0–2 | x (0–7) |
| 3–5 | y (0–7) |
| 6–7 | 예비, **반드시 0** |

값 = 칸 인덱스 `y*8 + x`. 디코드는 바이트 0..63만 수로 받아들이고 `0x40` 이상(예비 비트가 하나라도 켜짐)은 malformed → run.bin 검증에서 `move`. 인코드는 0 ≤ x, y < 8 정수만 받는다. 보드 밖 좌표(예: 5×5에서 x=6)는 인코딩은 되지만 `apply`에서 불법이다.

## stateBytes (해시 입력, 20바이트, LE)

`w h budget 0 | stones.lo stones.hi | lanterns.lo lanterns.hi` (각 u32 LE). 해시 = FNV-1a 32. 자세한 표는 `docs/runlog-format.md`.

## 픽스처 스키마 (`fixtureVersion` 2)

### `fixtures/lanterns/*.json` — 통과해야 하는 기록

입력(포트가 읽는 것):

| 필드 | 형식 |
| --- | --- |
| `name` | 문자열 |
| `levelId` | u32 |
| `level` | `{ rows: string[], budget }` — 위 텍스트 문법 |
| `mode` `flags` | u8 (`flags`는 항상 0) |
| `seedKey` | 시드 키 문자열 |
| `moves` | 수 바이트들의 hex(1바이트 = 2글자) |

기대 출력(포트가 재현해야 하는 것):

| 필드 | 형식 |
| --- | --- |
| `fixtureVersion` `game` `gameId` | 2, `"lanterns"`, 1 |
| `seed` | `sha256(utf8(seedKey))[0..16)` hex |
| `initialStateBytes` `initialStateHash` | hex, u32 hex(8글자) |
| `perMoveHashes[i]` | i번째 수 적용 후 stateHash, u32 hex |
| `perMoveStateBytes[i]` | i번째 수 적용 후 stateBytes hex |
| `perMove[i]` | i번째 수 적용 후 분석: `{ lit: { lo, hi }, conflicts, lanternsUsed, complete }` — `lit` 워드는 u32 hex(8글자), `conflicts`는 충돌 등불 개수 |
| `final` | `{ stateHash, complete, lanternsUsed, conflicts, lit }` — `lit`은 켜진 칸 개수(popcount) |
| `runBin` | 전체 run.bin hex |

포트 테스트 절차: `level`을 파싱하고 `moves`를 한 바이트씩 decode → apply 하면서 매 수마다 `perMoveStateBytes`, `perMoveHashes`, `perMove`를 비교한다. 마지막에 `final`과, 같은 입력으로 인코딩한 run.bin이 `runBin`과 바이트 단위로 같은지 비교한다. `runBin`을 디코드·재생한 결과도 통과(ok)여야 한다.

`wide8-*`는 8×8 보드에서 칸 31 (7,3)과 63 (7,7)을 쓴다(lo/hi 워드의 부호 비트).

### `fixtures/lanterns/reject/*.json` — 거부해야 하는 run.bin

| 필드 | 형식 |
| --- | --- |
| `fixtureVersion` `game` `gameId` | 2, `"lanterns"`, 1 |
| `name` `description` | 문자열 |
| `level` | `{ rows, budget }` — 재생에 쓸 레벨(`params`) |
| `runBin` | hex |
| `expectedCode` | `verifyRun`이 돌려줘야 하는 에러 코드 |

포트는 `verifyRun(runBin, level)`이 실패하고 코드가 `expectedCode`와 같아야 한다. 헤더·본문을 고친 벡터는 CRC를 다시 계산해 두었으므로 의도한 결함 하나만 남아 있다. `move-on-stone`, `spare-bits`, `move-after-complete`는 헤더 stateHash를 "규칙을 어긴 구현이 계산할 값"으로 맞춰 두었다 — 그런 포트는 이 파일을 통과시켜 버리므로 반드시 잡힌다.

| 파일 | expectedCode | 결함 |
| --- | --- | --- |
| `bad-crc` | `crc` | CRC 마지막 바이트 반전 |
| `bad-magic` | `magic` | `QL` |
| `unknown-version` | `version` | formatVersion 2 |
| `mode-3` | `mode` | mode 3 |
| `flags-nonzero` | `flags` | flags 1 |
| `wrong-game` | `game` | gameId 2 |
| `hash-mismatch` | `hash` | stateHash 1비트 반전 |
| `count-mismatch` | `length` | moveCount 5, 본문은 4수 |
| `truncated` | `length` | 마지막 2바이트 잘림 |
| `truncated-header` | `length` | 20바이트뿐 |
| `trailing-bytes` | `length` | CRC 뒤에 0x00 한 바이트 |
| `spare-bits` | `move` | 첫 수 0x84 = (4,0) + 예비 비트 7 |
| `move-on-stone` | `illegal` | (1,0) 돌에 토글 |
| `move-after-complete` | `illegal` | 해답 4수 후 (4,0) 다시 토글 |

검사 순서(포트도 같은 코드를 내려면 이 순서): 길이 ≥ 36 → magic → formatVersion → mode → flags → 정확한 길이 → CRC → gameId → 각 수 decode(`move`) → apply(`illegal`) → 최종 해시(`hash`).
