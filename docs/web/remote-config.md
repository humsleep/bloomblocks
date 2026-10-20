# Duskwick 광고 원격 설정 — 소유자 게시 가이드 (2026-10-20)

앱은 `https://humsleep.github.io/apps/duskwick/config.json`을 읽어 광고 빈도와 플래그를 바꾼다. 새 빌드·심사 없이 바뀐다.
게시할 파일은 이 폴더의 [`duskwick-config.json`](duskwick-config.json)이다. `humsleep/apps` 저장소에 **`duskwick/config.json`** 으로 넣는다
(같은 폴더의 `config.js`는 App Store 주소 상수라 다른 파일이다).

## 값 바꾸는 법 (출시 뒤)

`humsleep/apps` 저장소의 `duskwick/config.json`에서 숫자나 `true`/`false`를 고치고 커밋해 push한다(GitHub 웹 편집기로도 된다).
GitHub Pages가 1–2분 안에 반영하고(캐시 최대 10분), 각 iPhone은 **다음 실행에서 첫 수를 둔 뒤** 파일을 받아 그 세션부터 쓰고 Preferences(`ads.remote.v1`)에 저장한다.
그 뒤 실행에서는 오프라인이어도 저장된 값이 먼저 적용된다. 파일이 없거나 JSON이 깨졌거나 5초 안에 오지 않으면 앱은 마지막으로 받은 값, 그것도 없으면 빌드 기본값을 쓴다.
범위를 벗어난 숫자는 아래 범위로 잘리고 숫자가 아닌 값은 무시되므로, 잘못 써도 "판마다 광고"나 "데일리 광고"는 불가능하다(데일리는 광고를 띄우지 않는 것이 코드에 고정, 유예 5판 이상).
되돌리려면 이전 커밋으로 되돌리거나 키를 지운다(지운 키는 빌드 기본값). push 전에 `python3 -m json.tool config.json`으로 JSON이 맞는지 본다.

## 키와 범위 (`apps/client/src/ads/policy.ts` `RANGES`)

| 키 | 기본값 | 범위 | 뜻 |
| --- | --- | --- | --- |
| `rules.graceUnits` | 5 | 5–50 | 설치 뒤 전면 광고 없는 완료 판 수 |
| `rules.unitsBetween` | 2 | 2–20 | 전면 광고 사이 최소 판 수 |
| `rules.playSecondsBetween` | 240 | 180–900 | 전면 광고 사이 최소 실제 플레이 초 |
| `rules.perSession` / `perSessionLong` | 2 / 3 | 0–3 / 0–4 | 세션당 최대(10분 넘은 세션은 Long) |
| `rules.perDay` | 10 | 0–10 | 하루 최대. `0`이면 전면 광고 끔 |
| `rules.consentAfterUnits` | 1 | 1–50 | 동의(UMP/ATT) 화면을 띄울 수 있는 완료 판 수 |
| `rules.resumeQuietMs`, `afterFullscreenMs`, `longSessionMs`, `sessionGapMs`, `resumeQuietMinBgMs` | policy.ts | policy.ts | 시간 창(밀리초) |
| `rules.breakAfterNthInterstitial` | 2 | 1–5 | 그날 몇 번째 전면 광고 뒤 "30분 쉬기"를 제안할지 |
| `rules.bannerHoldout` | 0.5 | 0–1 | 배너를 받지 않는 설치 비율(새 설치에만 적용) |
| `flags.banner` | false | true/false | 트랙 보드 배너(B+) |
| `flags.rewardKeepsake`, `flags.rewardArchive` | false | — | 아직 만들지 않은 기능. **켜지 않는다**(지침 2.5.19 휴면 기능) |

`breakMs`(30분)와 `streakGiftMs`는 카드에 약속한 값이라 원격으로 바뀌지 않는다. 파일에 적힌 키는 빌드 기본값을 덮으므로, 나중 빌드에서 기본값을 바꾸면 이 파일도 같이 본다.
