# 마을 현지화 상태 (2026-10-17 갱신)

**10개 로캘 모두 앱에 들어 있다. 마을에서 영어로 대체되는 로캘은 없다.**
- 대사 61줄: `apps/client/src/village/lines/<locale>.json`. 생성은 `node apps/client/scripts/village-lines.mjs`이고, 정본은 `docs/team/r2-village-lines.<locale>.json`(ko는 내러티브 md)이다. id가 빠지거나 남으면 스크립트가 멈춘다.
- UI·VoiceOver 문자열, 가구·탭·주민 이름: `apps/client/src/village/strings.ts`.
- 용어: `docs/i18n-glossary.md`의 "Village" 절(등불 병, 오두막, 방석 …).

| 로캘 | 대사 | UI·이름 | 상태 | 남은 일 |
|---|---|---|---|---|
| en | 정본 | 정본 | 확정 | — |
| ko | 내러티브 재작성("당신" 0, 18줄 교체) | Frontend | 확정 후보 | 원어민 낭독 검토 10분(사용자 몫, Reality §3) |
| ja · de · fr · es · pt-BR · it · zh-Hans · zh-Hant | 내러티브 AI 초안(파일마다 `uncertain` 목록) | Frontend AI 초안 | **초안** | 출시 전 원어민 검토(`lines/<loc>.json`의 `uncertain` 먼저) |

## 검사
- G3(넘침 0, 1×에서 1–3줄, 17 pt 아래로 줄지 않음, 외톨이 줄 0, 라틴 단어 안 쪼갬, CJK 금칙):
  - 노드 폭 모델: `npm --prefix apps/client test -- village-wrap`
  - 실제 글꼴(브라우저): `npx playwright test e2e/village.spec.ts -g G3`
  - 실제 캡처 375 pt × 10개 로캘: `SHOTS_DIR=village-v2 SHOTS_VILLAGE=1 npx playwright test --project=chromium e2e/village-shots.spec.ts`
- 편지 손글씨 글꼴: 대사가 바뀌면 `apps/client/scripts/subset-letter-fonts.py`를 실제 대사 파일로 다시 돌린다(라틴 = en·de·fr·es·pt-BR·it, ko, ja, zh-Hans, zh-Hant). 빠진 글리프는 `tests/village-art.test.ts`가 잡는다.
- 다음 원어민 검토 뒤 줄 길이가 바뀌면 위 세 검사를 다시 돌린다.
