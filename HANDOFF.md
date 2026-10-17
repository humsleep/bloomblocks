# HANDOFF — Duskwick (2026-10-16, Phase 5 반영)

이 세션을 압축한 뒤 이어서 작업할 때 이 문서부터 읽는다. 저장소는 **아직 커밋하지 않았다**(사용자 요청 시에만 커밋).

## 사용자 제약 (변하지 않음)
- 이 작업은 **반드시 agency agents(전문 에이전트)** 로 진행한다. 결과가 서로 충돌하면 직접 확인한다.
- **실제 현금 지출은 0원**이다. 에이전트 사용은 무제한이다. **iOS를 먼저** 내고 그다음 Android. **글로벌 서비스, AdMob 광고만으로 수익**을 낸다(결제 상품은 사업자 등록 뒤로).
- 판단은 **냉정하게** 한다. 시장성이 나쁘면 그대로 말한다.
- 다음 일은 사용자 허락 없이 하지 않는다: 계정 생성, 라이선스 동의(Android SDK 등), 기기 보안 우회, 로그인.

## 기준 문서
- 계획: ~/Downloads/Puzzle_Portfolio_결정_v3_현금0원.md (광고 규칙 §2-4), v2 §10-3 (iPhone 게이트)
- 저장소 규칙: CLAUDE.md
- 담당 영역과 계약: docs/phase2-plan.md (Phase 2, Phase 4 iCloud 포함)
- 이름: docs/naming.md (**Duskwick**, 번들 ID com.humsleep.duskwick)
- 아이콘: docs/icon/ (C3 나무 틀 등불, 달 없음. 다시 만들 때는 `npm --prefix apps/client run art`), 직접 그릴 때의 프롬프트: docs/app-icon-prompts.md
- 플레이테스트: playtest/ANALYSIS.md … ANALYSIS-r6.md (6라운드 평균 8.44, 8명 중 6명이 데일리 선택)
- 감사와 리뷰: playtest/UX-AUDIT.md, CODE-REVIEW.md, CODE-REVIEW-ui.md, REALITY-CHECK.md (NEEDS WORK — 사유는 실기기 측정과 실제 AdMob ID 부재)
- 클라이언트: apps/client/README.md (App Privacy 답변 표, iCloud 동기화, iPad, 출시 게이트)

## 현재 상태
- `npm run verify` 녹색 (루트 249, 클라이언트 310, fuzz, e2e 86/86 chromium+webkit, build:m1). 부하가 크면 생성기 테스트가 가끔 30초 타임아웃으로 실패하므로 단독으로 다시 돌려서 확인한다.
- 구현 완료: 숫자 돌 Akari 규칙, gentle·deduce 트랙(마무리 판은 0 돌 ≤2, 진짜 T2 ≥5), 데일리(T2 1–2), 막힘 범인 + deadEnd, 단계 힌트, 글 없는 안내, 데일리와 오늘 달력 버튼, 연속 기록과 보호막(리본 등불), 결과 시트(#n, ✨ = 힌트 없음), 공유, 탑, 마을과 기념 판, VoiceOver·큰 글자·대비, AdMob 테스트 ID(전면 광고 + 30분 휴식, 동의는 유예 5판 뒤), PrivacyInfo, 출시 게이트(`ios:release-check`, Release 빌드에서 프로브 제외), **무로그인 iCloud KVS 동기화**(src/sync/, 로컬 우선, 날짜 합집합 병합, 재설치 복원), 탑 공개 연출의 입력 레이스 수정.
- 결정: Google 로그인과 ID·국적이 보이는 글로벌 랭킹은 **하지 않는다**. 대신 DAU에 따라 단계적으로 간다: 퍼센타일 → 가족 모임·등불 축제 → Game Center 친구 순위. Android에서는 1회용 이전 코드를 쓴다. 광고 제거 1회 결제는 사업자 등록 뒤 1순위(8명 중 5명이 결제 의향).

## 실기기 측정 (2026-10-16, playtest/perf/20261016-device/)
- **M1 p75 917 ms → 잠정 PASS** (게이트 ≤ 1.0 s, 여유 83 ms, 1회 측정). M0는 두 번 쟀다: 1회차 p75 1326 ms(9–20번째 실행에 지연 몰림), 2회차 537 ms.
- 실행의 10–25%에서 약 2 s 이상값이 나온다. 빈 M0에서도 나와서 WebKit/OS 쪽으로 추정한다.
- 광고 SDK는 정적 링크라 시작 비용이 거의 없다. iCloud 플러그인의 load()는 비어 있다.
- rename 덮어쓰기: 소스로 확인했다(지운 뒤 옮김, 비원자적). 중간 실패는 readAtomic의 .tmp 복구로 처리된다. 기기에서는 확인하지 못했다.
- **09:22에 iPhone이 잠기면서 중단됨.** 아직 남은 일: M1 재측정, 10분 소크(메모리·크래시), 일반 Release 빌드 재설치. 지금 기기에는 Measure 빌드가 설치돼 있다.
  - 이어서 하려면 iPhone 잠금 해제, 자동 잠금 = 안 함, 충전기 연결 뒤 `apps/client`에서 다음을 실행한다:
    - `npm run measure:ios -- m1 20`
    - `CONFIG=Release npm run ios:device:m1 && scripts/soak-ios.sh`
    - `scripts/check-no-probe.sh build/dd-device/Build/Products/Release-iphoneos/App.app`

## 사용자가 해야 할 일
1. iPhone 자동 잠금을 '안 함'으로 바꾸기 (이번에 측정 도중 잠겼다).
2. iCloud 동기화를 실기기에서 확인: 같은 Apple ID인 iPhone과 iPad에서 데일리를 풀어 보고, 삭제 후 재설치해 본다 (README 5단계).
3. iPad 화면 확인: 설정, 마을, 회전 (App Review가 iPad에서도 실행해 본다).
4. AdMob 계정을 만들고 실제 앱 ID·광고 단위 ID 발급, UMP 메시지 설정 → 그 뒤 우리가 config와 Info.plist에 넣고 `ios:release-check`가 녹색인지 확인.
5. App Store Connect에 앱 레코드 생성, App Privacy 답변(추적함, README 표 참고), humsleep.github.io에 app-ads.txt 게시.
6. 실제 사람 3–5명에게 데일리 3일 플레이와 아이콘 첫인상 확인.

## 다음 후보 작업 (사용자 승인 필요)
- 출시 전: 결과 화면에 내 최고 기록과 "어제보다 ↑" 표시, 화면 타이머 옵션(기본 꺼짐).
- iOS 27 SDK 대응: UIRequiresFullScreen 폐기(TN3192) → 크기 변경에 맞춘 레이아웃.
- 웹 데일리와 웹 포털 병행, Android(Firebase Test Lab — 사용자 로그인 필요).

## Phase 5 (2026-10-16) — 벤치마크 기반 개선
- 벤치마크 문서: playtest/BENCHMARK-VISUAL.md (5.2), BENCHMARK-UX.md (5.7), docs/ads-plan.md (구성 B 확정), ~/Downloads/Puzzle_Portfolio_결정_v4_매출재계산.md
- 매출 재계산 결과: 실제 전면 광고는 DAU당 하루 약 1회(v3는 약 5회로 가정). 12개월째 월 매출은 하루 설치 10명이면 약 3.3만 원, 70명이면 약 23만 원(B+). 월 30만 원에는 하루 약 90건 필요. 월 30만 원 이상 확률 약 1.5%. 새 중단선: W8(출시 30일) 예상 DAU 80 미만이면 중단, W21 예상 월 10만 원 미만이면 중단. 효과가 큰 순서: 설치 > 리텐션 > 안드로이드 > 배너 > 미디에이션 > IAP.
- 비주얼 6.8/10 (v10): 빛 모델, 돌판 재질, 액자형 등불(아이콘과 같은 모양), 돌담 안뜰과 디딤돌, 이끼 낀 돌에 숫자를 새긴 형태, 하늘에 걸린 등불 줄(골목 진행), 피날레 2.6 s(playFinale), 집 파사드 조합, 마을 깊이와 블룸, HUD 문법 통일. 7점을 넘으려면 WebGL 블룸(콜드 스타트 재측정 필요), 손으로 그린 SVG, 스토어 스크린샷이 필요하다.
- 흐름: 골목 10칸 진행, 5·10판마다 거리 들르기, 결과 시트 v2(정리됨), 설정 v2(캡션 7개 언어, 알림, 처음부터, 개인정보 옵션), 로컬 알림(옵트인, 백오프), HUD 역할 고정, 탑은 gentle 8 이후 두 번째 세션부터.
- 광고 구성 B: beforeNextBoard 단일 슬롯, 2판 AND 240 s, 세션 2(3)회, 하루 10회, 복귀 120 s·다른 전면 광고 뒤 90 s 동안 금지, 앱 오픈 광고 삭제, 배너는 플래그를 꺼 둔 채 50% 홀드아웃, 보상형 휴식은 확인 카드(7개 언어)를 거침, UMP 개인정보 옵션, 광고 소리(.ambient + setApplicationMuted). local-notifications 8.3.1.
- 검증: `npm run verify` 녹색(루트 249, 클라이언트 348, e2e 110 chromium+webkit, fuzz, build). 스크린샷은 playtest/shots/v9, v10.
- 재측정이 필요한 위험: 첫 화면 bake가 늘었다(저속 기준 105→251 ms) → 실기기 M1 콜드 스타트를 다시 잰다. 실기기 확인 항목: 무음 스위치를 켠 상태에서 광고 소리, 첫 실행에 알림·ATT 프롬프트가 뜨지 않는지.
- 다음 후보: Sonar ASO로 키워드와 스토어 스크린샷, WebGL 블룸 실험(측정 게이트), 웹 데일리·포털, 안드로이드.

## 대기 중 프레임 거버너 (2026-10-16 밤, playtest/perf/idle-governor.md)
- `apps/client/src/game/frameGovernor.ts`: 입력·움직임 뒤 1.5 s는 60 fps, 그 밖에는 주변 연출만 20 fps, 숨김·백그라운드·전면 광고 중에는 프레임 0. 화면 움직임은 "움직임 서명"(ambient() 표시 없는 객체의 변환·알파 해시)으로 감지한다 — 표시를 빠뜨리면 전체 속도로 남는다(안전한 실패).
- 새 주변 연출 객체를 추가하면 `ambient(obj)`로 감싸고 `node scripts/idle-movers.mjs`로 확인한다. Chromium 측정: `node scripts/measure-idle.mjs`.
- 실기기(Activity Monitor 5분 대기) 재측정은 다른 에이전트 몫.

## v11 초보자 쉬운 사용 (2026-10-17, playtest/ux-v11.md)
- "글 없는 게임" 원칙을 거두고 짧은 현지화 문장(7개 언어, a11y/strings.ts의 V11 블록)을 보인다.
- (c) 판 안 오류 한 줄(`LineBand`, 우선순위 충돌 > 초과 > 0 > 막힘 > 숫자 확인, 한 번에 하나), 오류 신호를 하나로(✕만 / 산호색 숫자만), 1–3판 막힘 표시 끔. 만족한 숫자 = 잉크 숫자 + 금색 고리.
- (a) 첫 실행 튜토리얼 "첫 마당"(`Tutorial.ts` 지연 청크, T1–T5 + 끝 카드, guide 비트 256). 세션·광고 단위를 건드리지 않는다. 안내자는 `GuideActor` 인터페이스(지금은 손가락, 나중에 Wick).
- (b) "?" 게임 방법 시트(`HowToSheet.ts` 지연 청크, 카드 4장 + 튜토리얼 다시 하기, 데일리 시계 멈춤).
- (d) HUD 캡션, "완성!" + 1–3판 "다음 집 →", 결과 시트 글자 + "계속" 주 버튼, 첫 데일리 소개 카드, 데일리 안내 5판 뒤, 설정 ✕, 힌트 점 제거.
- 스크린샷 playtest/shots/v11/(en15·ko15·enSE·koSE), 구동 `playtest/novice/run.mjs`. 새 e2e `e2e/novice.spec.ts`. 실기기 콜드 스타트 재측정과 원어민 번역 검토가 남았다.

## v12 다국어 10개 (2026-10-17, playtest/i18n-v12.md)
- it, zh-Hans(싱가포르·말레이시아·해외), zh-Hant(대만·홍콩·마카오, 대만 어휘) 추가 → 10개 언어. 감지는 `langOf()`(a11y/strings.ts): 중국어는 스크립트 우선, 그다음 지역(TW·HK·MO → 번체), 맨 zh → 간체. es는 전 지역 중립 하나(+ ATT만 es-419 "Configuración").
- 용어집 `docs/i18n-glossary.md`. CJK 글꼴은 `uiFont()`(uiText.ts)가 PingFang TC/SC·Hiragino를 system-ui 앞에 넣는다. 폭 점검 `node playtest/i18n/fit.mjs`(실제 글꼴, SE 375 pt). 출시 게이트에 locales 검사 추가.
- 스크린샷 playtest/shots/v11-i18n/(it·zhHans·zhHant × 15·SE). 번역은 AI 작성 + AI 원어민 역할 검토 — 출시 전 실제 원어민 검토 권장.
