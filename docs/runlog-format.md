# run.bin 포맷 (formatVersion 1)

저장 파일이자 재생 로그다. 클라이언트는 수가 확정될 때마다(연출 시작 전) 전체 파일을 임시파일 + 교체로 원자 저장하고, Workers는 이 바이트만으로 재생 검증한다. 구현: `core/runlog.ts`. 정본 예시: `fixtures/lanterns/*.json`의 `runBin`.

모든 정수는 **little-endian**이다.

## 레이아웃

| 오프셋 | 크기 | 필드 | 설명 |
| --- | --- | --- | --- |
| 0 | 2 | magic | `0x50 0x4C` ("PL") |
| 2 | 1 | formatVersion | u8, 현재 `1`. 다르면 거부 |
| 3 | 1 | gameId | u8, `core/game.ts`의 `GAME_ID` (1 lanterns, 2 seedlock, 3 doorfall, 4 hueblend, 5 lanternsPips — 수 인코딩은 lanterns와 같음) |
| 4 | 1 | mode | u8, 0 free · 1 daily · 2 bud(봉오리). 2 초과는 거부 |
| 5 | 1 | flags | u8, formatVersion 1에서는 반드시 0. 0이 아니면 거부(`flags`) |
| 6 | 16 | seed | 실제로 쓴 128비트 시드 (`sha256(utf8(seedKey))[0..16)`) |
| 22 | 4 | levelId | u32. `0xF0000000` 이상(`TEST_LEVEL_MIN`)은 테스트 픽스처 전용 — daily 제출에서는 거부 |
| 26 | 2 | moveCount | u16, 최대 65535 (`MAX_MOVES`). 기록기는 그 이상을 거부한다(`count`) |
| 28 | 4 | stateHash | u32, 마지막 수 적용 후 `fnv1a32(game.stateBytes(state))`. 수가 0개면 초기 상태의 해시 |
| 32 | moveCount × W | moves | 수 로그. W = 게임별 고정 폭(1~2바이트). lanterns는 W = 1. 인코더는 모든 수가 정확히 W바이트인지 확인한다 |
| 32 + moveCount × W | 4 | crc32 | 앞의 모든 바이트에 대한 CRC-32/IEEE (poly 0xEDB88320, init/xorout 0xFFFFFFFF) |

전체 길이 = `32 + moveCount × W + 4`. 정확히 일치하지 않으면 거부한다.

필드 합(2+1+1+1+1+16+4+2+4)이 정확히 32바이트라 별도 reserved 바이트는 없다. 확장은 formatVersion을 올려서 한다.

## 시드

- 키 문자열 예: `lanterns:daily:2026-10-12`, `lanterns:free:<n>`, `lanterns:bud:<date>:<slot>`.
- `seed16 = sha256(utf8(key))`의 앞 16바이트. xoshiro128** 상태 `s[i]` = `seed16[4i..4i+4)`의 LE u32.
- 헤더에는 파생된 16바이트만 저장하므로 재생 시 키(또는 데일리 비밀값)가 필요 없다. `Game.init`은 키 문자열과 16바이트 둘 다 받는다.

## 수 인코딩: lanterns (W = 1)

| 비트 | 의미 |
| --- | --- |
| 0–2 | x (0–7) |
| 3–5 | y (0–7) |
| 6–7 | 예비, 반드시 0 (아니면 malformed → `move`) |

값은 stride-8 칸 인덱스 `y*8 + x`와 같다. 의미는 "(x, y) 등불 토글". 규칙 전체(완료 후 수 금지 포함)는 `docs/lanterns-rules.md`.

## lanterns stateBytes (해시 입력, 20바이트)

| 오프셋 | 크기 | 필드 |
| --- | --- | --- |
| 0 | 1 | w |
| 1 | 1 | h |
| 2 | 1 | budget |
| 3 | 1 | 0 (예비) |
| 4 | 4 | stones.lo (칸 0–31) |
| 8 | 4 | stones.hi (칸 32–63) |
| 12 | 4 | lanterns.lo |
| 16 | 4 | lanterns.hi |

칸 i = `y*8 + x`, 비트 i는 i < 32면 lo의 비트 i, 아니면 hi의 비트 i−32.

## 인코딩 (`encodeRun`, `recordRun`, `appendMove`)

인코더는 디코더가 거부할 파일을 만들지 않는다. `encodeRun(run, moveWidth?)`는 다음을 `RunError`로 던진다: `count`(moveCount ≠ moves 수, 65535 초과), `seed`(16바이트 아님), `version`(formatVersion ≠ 1), `field`(gameId가 u8 아님, levelId가 0..0xFFFFFFFF 정수 아님 — `>>> 0`로 감싸지 않는다), `mode`(0..2 아님), `flags`(≠ 0), `move`(수 폭 ≠ W). `recordRun`은 65535수 초과를 `count`로, 불법 수(완료 후 수 포함)를 `illegal`로 거부한다. 클라이언트의 수마다 저장 경로는 `appendMove(game, run, state, move)`를 쓴다 — 65535수에서 `count`를 던져 읽을 수 없는 저장 파일을 만들지 않는다.

## 검증 절차 (`verifyRun` — 무결성 전용)

1. 길이 ≥ 36, magic, formatVersion, mode, flags 확인.
2. 길이 = `32 + moveCount × W + 4` 확인, CRC-32 확인.
3. gameId가 게임과 일치하는지 확인.
4. `init(seed, params)` 후 각 수를 decode → apply. malformed면 `move`, 불법이면 `illegal`.
5. 재계산한 최종 해시와 헤더 stateHash 비교(`hash`). 통과하면 `complete` 여부를 함께 돌려준다.

에러 코드: `length` `magic` `version` `mode` `flags` `crc` `game` `move` `illegal` `hash` `exception`. 각 코드의 정본 거부 벡터는 `fixtures/lanterns/reject/*.json`(`docs/lanterns-rules.md` 참고).

`verifyRun`은 로컬 저장 파일 무결성·이어하기 확인, 봇, 픽스처용이다.

## 보안 경계 (서버: `verifySubmission`)

**CRC-32와 stateHash는 손상(corruption)만 감지한다. 보안 경계가 아니다.** 둘 다 누구나 다시 계산할 수 있으므로, 헤더의 mode·levelId·seed를 고친 뒤 CRC를 다시 계산한 파일도 `verifyRun`을 통과한다(lanterns `init`은 seed를 쓰지 않으므로 seed 변조는 재생 결과에도 드러나지 않는다). free 모드 기록을 daily `params`로 검증해도 통과한다.

**서버는 반드시 `verifySubmission(game, bytes, params, expected)`를 호출해야 하고, `params`와 `expected`는 서버가 자기 시드(날짜·슬롯·비밀값)에서 스스로 계산해야 한다. 파일에서 읽은 값으로 레벨이나 기대값을 고르면 안 된다.**

`expected = { gameId, mode, levelId, seed: Uint8Array(16) }`. 디코드·CRC 확인 후, 재생 전에 다음을 거부한다:

| 코드 | 조건 |
| --- | --- |
| `expected` | `expected.seed`가 16바이트가 아님(호출 측 버그) |
| `expect-game` | 헤더 gameId ≠ `expected.gameId` 또는 ≠ `game.id` |
| `expect-mode` | 헤더 mode ≠ `expected.mode` |
| `expect-level` | 헤더 levelId ≠ `expected.levelId` |
| `expect-seed` | 헤더 seed ≠ `expected.seed` (16바이트 비교) |
| `test-level` | mode = daily 이고 levelId ≥ `0xF0000000` |

그 뒤 `verifyRun`과 같은 재생·해시 검사를 하고 같은 결과(`complete`, `perMoveHashes`, `state`)를 돌려준다.

**포맷이 막을 수 없는 것**: run.bin에는 플레이어·논스·시각이 없다. 따라서 다른 플레이어의 run.bin을 그대로 복사해 제출하거나, 솔버가 만든 run을 제출하는 것은 포맷으로 막을 수 없다. 이는 서버 쪽 문제(레이트 리밋, 설치별 토큰, 제출 중복 탐지 등)이며 이 저장소의 범위 밖이다.

## 포맷을 바꿀 때

formatVersion을 올리고, 이 문서와 `core/runlog.ts`, C# 포트를 함께 바꾼 뒤 `npm run fixtures`로 다시 만들고 diff를 검토한다. 구버전 저장 파일 이전 경로가 필요하다(이어하기 성공률 ≥99% 게이트).
