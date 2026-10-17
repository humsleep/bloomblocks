# Duskwick AdMob 연동 안내서 (오너용) — 2026-10-18

이 문서는 Duskwick iOS 앱(`apps/client`, Capacitor 8 + Phaser)에 **진짜 AdMob 광고**를 붙이기 위해 오너가 할 일을 순서대로 적은 것이다.
지금 코드에는 Google의 공개 테스트 ID(`ca-app-pub-3940256099942544…`)만 들어 있다. 그래서 광고는 나오지만 돈은 벌리지 않는다.

- 표시: **[오너]** = 오너가 AdMob, App Store Connect, GitHub 화면에서 직접 하는 일. **[리드]** = 개발 쪽에서 코드와 문서를 고치는 일.
- 비용: 모든 단계가 무료다. AdMob, GitHub Pages, 세금 양식 모두 돈이 들지 않는다.
- 메뉴 이름: AdMob 화면을 한국어로 보면 이름이 조금 다를 수 있다. 그래서 영어 이름을 괄호 안에 같이 적었다. Google은 메뉴를 자주 바꾸므로, 이름이 다르면 비슷한 이름을 찾는다.
- 웹 출처는 맨 아래에 있다(모두 2026-10-18에 확인했다).

## 0. 한눈에 보는 순서

| # | 할 일 | 누가 | 언제 |
| --- | --- | --- | --- |
| 1 | AdMob 계정 만들기, 결제 정보 입력 | 오너 | 지금 |
| 2 | 앱 등록 ("아직 스토어에 없음"으로) | 오너 | 지금 |
| 3 | 광고 단위 2개 만들기 (전면 1, 보상형 1) | 오너 | 지금 |
| 4 | 받은 ID 3개와 퍼블리셔 번호를 리드에게 전달 → 코드에 넣기 | 오너 → 리드 | 지금 |
| 5 | 개인정보 메시지 설정 (GDPR 게시, IDFA 설명 메시지는 게시하지 않음, 미국 주 메시지 게시) | 오너 | 심사 전 |
| 6 | app-ads.txt를 `https://humsleep.github.io/app-ads.txt`에 올리기 | 오너 (파일 내용은 리드가 준비) | 심사 전 |
| 7 | 테스트 기기 등록, 내 광고 절대 누르지 않기 | 오너 | 실제 ID 빌드를 처음 깔기 전 |
| 8 | 출시 전 확인 목록 | 둘 다 | 심사 제출 직전 |
| 9 | 출시 뒤 AdMob 앱을 App Store에 연결하기 | 오너 | 앱이 스토어에 뜬 날 |
| 10 | 세금 정보, 첫 지급 받기 (PIN 우편) | 오너 | 수익이 생긴 뒤(수개월) |

---

## 1. AdMob 계정 만들기와 결제·세금 정보

### 1-1. 계정 만들기 — [오너]

계정을 만들고 로그인하는 일은 오너가 직접 한다. 리드나 AI는 대신하지 않는다.

1. `https://admob.google.com`에 들어가 Google 계정으로 가입한다. 평소 쓰는 개인 Google 계정이면 된다.
2. **국가: 대한민국**을 고른다. 이 값은 **나중에 바꿀 수 없다.** 신원 확인과 지급이 이 국가 기준으로 진행된다.
3. 시간대와 통화를 묻는 화면이 나오면 시간대는 **(GMT+09:00) 서울**을 고른다. 통화는 화면 안내에 따라 고른다.
   - 지급 기준액이 이 통화 기준으로 정해진다(1-3).
   - 미국 달러(USD)를 고르면 아래 금액과 그대로 맞는다.
4. 전화번호를 인증한다(문자 6자리).
5. 결제 정보(Payment details)를 입력한다.
   - **계정 유형: 개인(Individual).** 사업자 등록이 없으면 개인이다.
   - 이름: **신분증, 은행 계좌와 같은 이름**을 영문으로 입력한다. 나중에 송금받을 때 이 이름이 계좌 이름과 달라 문제가 되는 일이 많다.
   - 주소: 우편을 실제로 받는 주소를 영문으로 입력한다. **PIN이 종이 우편으로 온다**(1-3).
6. 이용약관에 동의한다. Google은 계정 확인에 보통 24시간, 드물게 2주까지 걸린다고 한다. 확인이 끝나야 광고가 나간다.

주의: **AdMob 계정은 한 사람에 하나만 만든다.** 중복 계정은 하나 또는 둘 다 닫힌다(7-2).

### 1-2. 세금 정보 (미국 세금 양식) — [오너]

메뉴: **결제(Payments) → 설정(Settings)의 "설정 관리(Manage settings)" → 결제 프로필(Payments profile)에서 국가 옆 연필 → 세금 정보 관리(Manage tax info)**

- 화면의 질문에 답하면 Google이 맞는 양식을 골라 준다. 한국에 사는 개인이면 보통 **W-8BEN**(미국인이 아닌 개인용)이 나온다. 모두 온라인으로 제출한다.
- 미국 안에서 하는 활동이 있는지 묻는 질문에는 사실대로 답한다. 한국에서 혼자 개발하면 보통 "없음"이다.
- **조세조약(Tax treaty)**: 한국은 미국과 조세조약이 있다. 조약 혜택을 받으면 원천징수가 줄어들 수 있다. 하지만 어떤 조항과 세율을 쓸지는 Google도 대신 정해 주지 않는다. 확신이 없으면 국세청 상담(전화 126, 무료)에 묻는다.
- **외국 납세자 번호(Foreign TIN)** 칸에 주민등록번호를 넣는지 다른 번호를 넣는지는 블로그마다 말이 다르다. 그러니 그 화면의 도움말을 따르고, 애매하면 국세청 상담에 묻는다.
- 세금 정보를 넣지 않으면 지급액에서 세금을 더 많이 떼어 갈 수 있다(Google 안내).
- 참고: 옛 AdMob 도움말 중에는 "개인은 W-8BEN 대신 8233"이라고 적힌 페이지(계약 주체가 Google Inc.일 때)가 남아 있다. **화면의 안내가 우선이다.**
- 한국 쪽 세금(종합소득세 신고)은 별개의 일이다. 금액이 작아도 해마다 5월 신고 때 확인한다.

### 1-3. 지급 받기 — [오너] (수익이 생긴 뒤)

| 단계 | 기준(USD 계정) | 하는 일 |
| --- | --- | --- |
| 확인 기준액 | 수익 **$10** | 신원 확인을 마치면 **PIN(6자리)이 종이 우편**으로 온다. 2~3주 걸린다. **4개월 안에** 결제 메뉴의 확인 화면에 입력한다. 늦으면 광고 게재가 멈출 수 있다. 3주가 지나도 오지 않으면 같은 화면에서 다시 보내기를 누른다 |
| 지급 수단 선택 | 수익 **$10** | 결제 → 지급 수단 추가. 한국은 보통 **전신 송금(Wire transfer)**이다. 은행 영문명, SWIFT 코드, 계좌번호, 영문 예금주명이 필요하다(통장 앱이나 은행에 묻는다) |
| 지급 기준액 | 잔액 **$100** | 매달 3일쯤 지난달 수익이 확정되고, 20일까지 잔액이 기준을 넘으면 **21일쯤 지급**된다. 전신 송금은 10일 정도 더 걸린다. 넘지 못하면 다음 달로 넘어간다 |

- 원화(KRW)로 계정을 만들었다면 원화 기준액이 따로 있다. 공식 표에서 원화 줄을 확인하지 못했으니 결제 화면에서 확인한다.
- 현실적인 기대치: `docs/ads-plan.md` §0의 모델로는 하루 10설치일 때 월 4~6만 원 수준이다. 첫 $100까지 몇 달 걸릴 수 있다.
- 받는 은행이 해외 송금 수취 수수료를 떼기도 한다. 지급액에서 빠지는 것이라 따로 돈이 나가지는 않는다.

---

## 2. 앱 등록

### 2-1. 지금: 아직 스토어에 없는 앱으로 등록 — [오너]

1. AdMob 왼쪽 메뉴 **앱(Apps) → 앱 추가(Add app)**.
2. 플랫폼: **iOS**.
3. "앱이 지원되는 앱 스토어에 등록되어 있나요?(Is the app listed on a supported app store?)" → **아니요(No)**.
4. 앱 이름: **Duskwick**. 스토어에 올릴 이름과 똑같이 쓴다. Google이 나중에 앱 심사에 이 이름을 쓴다.
5. "사용자 측정항목(User metrics)" 같은 Firebase 연동 질문이 나오면 **끈다.** 이 앱은 Firebase를 쓰지 않는다.
6. **앱 추가**를 누르면 **앱 ID**가 나온다. 모양: `ca-app-pub-0000000000000000~0000000000`(물결 `~`가 있다). 이것을 적어 둔다.

미출시 앱에는 **광고가 조금만 나간다(limited ad serving).** 앱이 스토어에 올라가고 2-2의 연결과 Google 검토를 마치면 이 제한이 풀린다. App Review 심사관에게 광고가 안 보여도 문제가 아니다. 심사 메모에 "광고는 차분하게 나온다"고 이미 적어 두었다.

### 2-2. 출시 후: App Store에 연결 — [오너] (앱이 스토어에 뜬 날)

1. **앱(Apps) → 모든 앱 보기(View all apps)** → Duskwick 줄의 "스토어(Stores)"에서 **스토어 추가(Add store)**.
   (또는 앱 선택 → **앱 설정(App settings) → 앱 스토어(App stores) → 스토어 추가**.)
2. "Duskwick"이나 App Store 주소(`apps.apple.com/…/id숫자`)로 검색해 **우리 앱인지 확인하고** 추가한다. **잘못 연결하면 나중에 바꿀 수 없다.**
3. 새 앱이 검색되기까지 24~48시간, 길면 1주일 걸린다. 그 동안은 하루 한 번 다시 찾아본다.
4. 연결하면 Google이 앱을 검토한다. 상태가 "준비 중(Getting ready)"으로 보이고, 보통 2~3일 걸린다. 승인되면 광고 제한이 풀린다.
5. 이 연결이 있어야 app-ads.txt 확인(6장)도 시작된다.

---

## 3. 광고 단위 만들기 — [오너]

코드(`apps/client/src/ads/config.ts`)가 쓰는 자리는 아래 5개다. **출시(구성 B)에 실제로 켜진 것은 2개뿐이다.** 나머지 3개는 기능 플래그가 꺼져 있어(`src/ads/policy.ts` `FLAGS`) 광고를 요청하지 않는다.

| config.ts 이름 | AdMob 형식 | 출시 때 사용 | 지금 만들까 | 광고 단위 이름 제안 | 만들 때 설정 |
| --- | --- | --- | --- | --- | --- |
| `interstitial` | 전면 광고(Interstitial) | **예**: 판 사이 하나의 자리 | **만든다** | `Duskwick_iOS_Interstitial_BetweenBoards` | 광고 유형은 기본값(디스플레이+동영상). 만든 뒤 고급 설정에서 **게재빈도 제한 사용자당 1일 10회** |
| `rewardedBreak` | 보상형(Rewarded) | **예**: "30분 광고 쉬기" | **만든다** | `Duskwick_iOS_Rewarded_Break30` | 보상 수량 `1`, 보상 항목 `break`(코드는 이 값을 읽지 않는다). 서버 측 확인(SSV)은 끈다 |
| `rewardedKeepsake` | 보상형 | 아니오 (`FLAGS.rewardKeepsake` OFF, 기능 없음) | 만들지 않는다 | (나중에) `Duskwick_iOS_Rewarded_Keepsake` | — |
| `rewardedArchive` | 보상형 | 아니오 (`FLAGS.rewardArchive` OFF, 기능 없음) | 만들지 않는다 | (나중에) `Duskwick_iOS_Rewarded_Archive` | — |
| `bannerTrack` | 배너(Banner, 앵커 적응형) | 아니오 (`FLAGS.banner` OFF, B+ 시험용) | 만들지 않는다 | (나중에) `Duskwick_iOS_Banner_Track` | — |

- 만들지 않는 형식: 앱 오픈, 보상형 전면, 네이티브. `docs/ads-plan.md`에서 기각했다.
- 꺼진 3개는 지금 테스트 ID 그대로 둬도 출시 게이트(`scripts/release-gates.mjs`)를 통과한다. 게이트는 형식만 검사한다. 기능을 만들 때 그 단위를 만든다. 쓰지 않는 단위를 미리 만들어 두면 보고서만 지저분해진다.

**만드는 법**: 앱(Apps) → Duskwick → **광고 단위(Ad units) → 광고 단위 추가(Add ad unit)** → 형식 선택 → 이름 입력 → **광고 단위 만들기(Create ad unit)**.
그러면 **광고 단위 ID**가 나온다. 모양: `ca-app-pub-0000000000000000/0000000000`(슬래시 `/`가 있다).

**게재빈도 제한(전면)**: 앱 → 광고 단위 → 전면 단위 → **고급 설정(Advanced settings) → 게재빈도 제한(Frequency capping) 연필** → 켜기 → `10`회 / `1`일 → 저장. 반영까지 최대 24시간 걸린다. 코드에도 하루 10회 상한이 있으니 이것은 이중 방어다.

**같이 할 앱 설정** (`src/ads/README.md`, `docs/ads-plan.md` §9-4):
- **고참여 광고 끄기**: 앱 → Duskwick → **앱 설정(App settings) → 고참여 광고(High-engagement ads) 연필 → 끄기 → 저장**.
  - 기본값은 켜짐이다. 켜 두면 전면 광고를 12~15초 동안 닫을 수 없다. 테스터 6/8이 "5초 안에 못 닫는 광고"를 삭제 이유로 꼽았다.
  - 이 설정은 SDK로 끌 수 없어서 콘솔에서만 끌 수 있다.
- **민감한 카테고리 차단**: **차단 관리(Blocking controls) → 민감한 카테고리(Sensitive categories)**에서 도박, 데이트, 투자 권유 같은 것을 막는다. **게임 카테고리 전체는 막지 않는다**(수익이 크게 준다).

---

## 4. 받은 ID를 넣을 곳

### 4-1. 오너가 리드에게 보낼 것 — [오너]

| 무엇 | 어디서 보나 | 예시 모양 |
| --- | --- | --- |
| 앱 ID | 앱 → Duskwick → 앱 설정 | `ca-app-pub-1234567890123456~1234567890` |
| 전면 광고 단위 ID | 앱 → 광고 단위 | `ca-app-pub-1234567890123456/1111111111` |
| 보상형 광고 단위 ID | 앱 → 광고 단위 | `ca-app-pub-1234567890123456/2222222222` |
| 퍼블리셔 ID (app-ads.txt용) | 설정(Settings) → 계정 정보(Account information) | `pub-1234567890123456`. 앱 ID 앞 16자리와 같다 |

- 이 ID들은 **비밀번호가 아니다.** 어차피 앱 안에 그대로 들어가므로 채팅으로 보내도 된다.
- 반대로 AdMob **비밀번호, 2단계 인증 코드, 은행 정보는 누구에게도 보내지 않는다.**

### 4-2. 리드가 고칠 곳 — [리드] (오너가 ID를 주면)

| 파일 | 줄 | 지금 | 바꿀 값 |
| --- | --- | --- | --- |
| `apps/client/src/ads/config.ts` | 10 | `appId: "ca-app-pub-3940256099942544~1458002511"` | 오너의 앱 ID |
| `apps/client/src/ads/config.ts` | 12 | `interstitial: "…/4411468910"` | 전면 단위 ID |
| `apps/client/src/ads/config.ts` | 14 | `rewardedBreak: "…/1712485313"` | 보상형 단위 ID |
| `apps/client/src/ads/config.ts` | 16, 18, 20 | 꺼진 3개(`rewardedKeepsake`, `rewardedArchive`, `bannerTrack`) | 그대로 둔다(게이트는 형식만 본다) |
| `apps/client/src/ads/config.ts` | 22 | `testing: true` | 심사용 아카이브에서만 `false` (아래 참고) |
| `apps/client/ios/App/App/Info.plist` | 53 (`GADApplicationIdentifier` 바로 아래 `<string>`) | 샘플 앱 ID | **config.ts 10줄과 똑같은** 앱 ID. 게이트가 둘이 같은지 검사한다 |
| `docs/app-store-connect-pack.md` | 260 | `pub-[16자리 퍼블리셔 번호]` | 오너의 퍼블리셔 번호 |
| `docs/web/app-ads.txt` (새 파일) | — | 없음 | 6장의 한 줄. 오너가 GitHub에 복사해 올리기 쉽게 준비한다 |

리드 참고:
- `testing: true`일 때 플러그인(`@capacitor-community/admob` 8.2.1, `AdMobPlugin.swift` `getAdId`)은 **넘겨준 단위 ID를 무시하고 Google 데모 단위로 바꿔서** 요청한다.
  - 그래서 실제 ID를 넣은 뒤에도 평소 개발 빌드는 `testing: true`로 두면 안전하다. 다만 동의 메시지(UMP)는 앱 ID 기준이라 오너 계정의 설정이 바로 적용된다.
  - App Store용 아카이브만 `false`로 한다. 게이트가 `false`가 아니면 막는다.
- 확인: `npm --prefix apps/client run ios:release-check` → `release gates: OK`.
- IDFA 설명 메시지를 게시하지 않기로 했으므로(5-2) 아래 두 곳을 고친다.
  - `docs/app-store-connect-pack.md` 89줄 심사 메모에서 "elsewhere only Google's short explainer if one is configured"를 지운다.
  - `docs/store/review/att-flow.mp4`를 **실제 앱 ID 빌드로 다시 녹화**한다. 지금 녹화본에는 샘플 앱 ID 때문에 Google 기본 메시지("Tap "Allow" on the next screen")가 찍혀 있다. 이 영상을 심사에 첨부하면 5.1.1(iv) 위험을 직접 보여 주는 셈이다.
- 미국 주 메시지를 게시하면(5-3) 미국 해당 주 사용자에게도 설정 시트의 "개인정보 선택" 줄이 나온다. 코드는 이미 일반적으로 처리한다(`AdMobAds.ts` `privacyOptionsRequired`). 고칠 것은 문서뿐이다.
  - `src/ads/README.md` 16줄과 `src/ads/index.ts` 22줄 주석의 "EEA/UK/CH"를 "EEA/UK/CH, US regulated states"로 바꾼다.
  - e2e 기대값이 지역에 따라 달라지지 않는지 확인한다.

---

## 5. 개인정보 및 메시지 (UMP) — [오너]

위치: AdMob 왼쪽 메뉴 **개인 정보 보호 및 메시지(Privacy & messaging)**. 메시지 종류마다 카드가 있다.

앱은 이미 Google UMP SDK를 쓴다. 흐름은 "첫 트랙 판을 끝낸 뒤 판 사이 → (필요하면) Google 동의 양식 → iOS ATT 창"이다(`src/ads/AdMobAds.ts` `gatherConsent`).
**콘솔에서 게시한 메시지만 나온다.** 샘플 앱 ID를 쓰는 지금은 Google이 샘플 앱에 걸어 둔 메시지가 나온다. 시뮬레이터에서 본 "Tap Allow" 문구도 그것이다.

| 메시지 | 결정 | 이유 |
| --- | --- | --- |
| 유럽 규정(GDPR) | **게시한다** | EEA, 영국, 스위스에서 개인 맞춤 광고를 내려면 Google 인증 CMP의 동의가 필요하다. UMP가 그 역할을 한다 |
| IDFA 설명 메시지 | **게시하지 않는다** (권장) | 앱이 ATT 창을 스스로 띄운다. 설명 화면이 하나 더 있으면 심사 위험만 생긴다 |
| 미국 주 규정 | **게시한다** | 캘리포니아 등 20개 주의 "내 정보 판매·공유 거부" 요구를 맞춘다. 시작할 때 팝업은 뜨지 않는다 |

### 5-1. 유럽 규정(GDPR) 메시지 만들기

**개인 정보 보호 및 메시지 → 유럽 규정(European regulations) 카드 → 만들기(Create)**

| 항목 | 값 |
| --- | --- |
| 앱 선택(Select apps) | Duskwick → 확인 |
| 언어 | 기본: 영어. 추가: 독일어, 프랑스어, 이탈리아어, 스페인어, 포르투갈어. 앱이 지원하는 한국어, 일본어, 중국어(간체·번체)도 목록에 있으면 넣는다 |
| 동의하지 않음(Do not consent) 버튼 | **켬** (첫 화면에 거절 버튼. 공정하고 심사에도 안전하다. 수익은 조금 줄 수 있다) |
| 닫기(Close, do not consent) | 끔 |
| 대상(Targeting) | **GDPR 적용 국가(EEA, 영국, 스위스)** ("모든 곳"이 아님) |
| 메시지 이름 | `Duskwick GDPR` (사용자에게 안 보인다) |
| 문구 편집 | Google 기본 문구를 그대로 쓴다(법적 문구라 고치지 않는다) |
| 개인정보처리방침 URL | `https://humsleep.github.io/duskwick/privacy` (`src/legal.ts`와 같은 값. **실제로 열려야 한다**) |

→ **게시(Publish)**. 사용자에게 보이기까지 최대 10분 걸린다.
설정 아이콘의 "광고 파트너" 목록은 기본값("자주 사용하는 광고 파트너")으로 둔다.

### 5-2. IDFA 설명 메시지 — 게시하지 않는다 (Tap Allow 위험)

**왜 위험한가**
- Apple 심사 지침 5.1.1(iv)는 앱이 사람을 "조종하거나 속이거나 강요해서" 동의하게 하면 안 된다고 한다.
- Apple 디자인 지침(HIG, Privacy)은 ATT 앞 안내 화면에 대해 더 구체적이다. "Allow" 같은 버튼 이름을 쓰지 말 것, 시스템 창의 Allow 버튼으로 눈길을 끄는 표시를 넣지 말 것, 보상을 내걸지 말 것을 요구한다. 버튼은 하나만, "Continue"나 "Next" 같은 이름으로 둔다.
- Google 기본 문구의 "Tap "Allow" on the next screen"은 바로 그 금지 사항에 해당한다. "앱이 계속 무료이려면…"처럼 죄책감을 건드리는 문구도 같은 위험이 있다.

**권장 (A안): 아예 만들지 않는다**
- 새 계정에는 IDFA 메시지가 없다. **만들지 않으면 끝이다.** 그러면 EEA 밖 사용자에게는 Google 화면 없이 바로 iOS ATT 창이 나온다.
- ATT 창 문구는 이미 중립이다(`Info.plist` 59줄과 11개 언어 `InfoPlist.strings`, 한국어: "이 식별자는 더 관련 있는 광고를 보여 드리는 데에만 사용됩니다. 허용하지 않아도 Duskwick은 똑같이 플레이할 수 있으며…").

**이미 만들었거나 실수로 게시했다면: 게시 중단하는 정확한 경로**
1. **개인 정보 보호 및 메시지(Privacy & messaging)**
2. **IDFA** 카드의 **관리(Manage)**
3. 메시지 목록에서 그 메시지 줄의 **게시 상태 토글**을 눌러 끈다
4. 확인 창에서 **예(Yes)** → 상태가 "임시저장(Draft)/비활성"으로 바뀐다

- Google 도움말에는 토글 이름이 상태와 반대로 적혀 있어 헷갈린다. 버튼 글자 말고 **목록의 상태 열이 "게시됨(Published)"이 아닌지**로 확인한다.
- 반영까지 최대 10분 걸린다.

**B안 (권장하지 않음, 꼭 쓰고 싶을 때만): 중립 문구로 바꾸기**
경로: **개인 정보 보호 및 메시지 → IDFA → 관리 → 메시지 선택 → 편집**. 언어마다 문구를 바꾼다.

- 제목: `About ads in Duskwick`
- 본문: `Duskwick is free and shows ads. Next, iOS will ask whether Duskwick may use your device's advertising identifier to show ads that are more relevant to you. The game works exactly the same whatever you choose, and you can change it anytime in Settings.`
- 한국어 본문: `Duskwick은 무료이며 광고가 나옵니다. 다음 화면에서 iOS가 더 관련 있는 광고를 위해 기기의 광고 식별자를 써도 되는지 묻습니다. 어느 쪽을 골라도 게임은 똑같으며, 설정에서 언제든 바꿀 수 있습니다.`
- 버튼: 하나만, **Continue / 계속**. "Allow", "허용", "탭하세요", 화살표, 시스템 창 그림은 넣지 않는다.
- 이 안을 쓰면 리드는 심사 메모 89줄을 그대로 두고, 녹화를 새 문구로 다시 한다.

### 5-3. 미국 주 규정(US state regulations) 메시지

**개인 정보 보호 및 메시지 → 미국 주 규정 카드 → 만들기(Create)**

| 항목 | 값 |
| --- | --- |
| 앱 | Duskwick |
| 언어 | 기본 영어, 추가 스페인어 (고를 수 있는 언어가 영어와 스페인어뿐이다) |
| 대상(Targeting) | **현재 및 향후 지원되는 모든 미국 주(All current and future supported US states)** 켬 |
| 메시지 이름 | `Duskwick US states` |

→ **게시**.
- 이 메시지는 앱을 열 때 팝업으로 뜨지 않는다. 해당 주 사용자가 설정의 "개인정보 선택" 줄을 누르면 "내 정보 판매·공유 거부" 양식이 열린다(4-2 리드 참고).
- 대상 주(20개): 캘리포니아, 콜로라도, 코네티컷, 델라웨어, 플로리다, 인디애나, 아이오와, 켄터키, 메릴랜드, 미네소타, 몬태나, 네브래스카, 뉴햄프셔, 뉴저지, 오리건, 로드아일랜드, 테네시, 텍사스, 유타, 버지니아.

---

## 6. app-ads.txt

**필요한가?** 엄밀히 말하면 필수는 아니다. 하지만 **강력히 권장한다.** 이 파일은 "이 앱의 광고 판매자는 이 AdMob 계정뿐"이라는 공개 선언이다. 이 파일이 없거나 틀리면 일부 광고주가 입찰하지 않아 수익이 줄고, AdMob 화면에 경고가 계속 뜬다. 비용은 0원이다.

### 6-1. 어떻게 찾나 (도메인이 맞아야 하는 이유)

1. AdMob은 App Store 페이지의 **마케팅 URL(Marketing URL)**에서 **도메인(호스트 이름)만** 떼어 낸다.
2. 그 도메인의 **맨 위(루트)**에서 `https://<도메인>/app-ads.txt`를 찾는다.
3. 우리 마케팅 URL은 `https://humsleep.github.io/duskwick/`이다(`docs/app-store-connect-pack.md` 72줄). 그러므로 AdMob이 보는 곳은 **`https://humsleep.github.io/app-ads.txt`**다. `…/duskwick/app-ads.txt`가 아니다.
4. 마케팅 URL이 **비어 있거나 다른 도메인**이면 AdMob은 파일을 찾지 못한다. App Store Connect에서 마케팅 URL은 "선택" 항목이지만 **우리는 꼭 채운다.** 지원 URL(`…/duskwick/support`)은 AdMob이 보지 않는다.
5. AdMob은 하위 도메인을 한 단계까지만 본다. `humsleep.github.io`가 그 한 단계라서 GitHub 사용자 사이트에서도 동작한다. 프로젝트 사이트(`humsleep.github.io/저장소이름/`)의 루트는 우리 것이 아니다. 그래서 `docs/web/README.md`처럼 **사용자 사이트 저장소 `humsleep/humsleep.github.io`의 루트**에 둔다.

### 6-2. 올리기 — [오너] (파일 내용은 [리드]가 준비)

1. 파일 내용은 정확히 한 줄이다(`pub-` 뒤에 4-1의 퍼블리셔 번호 16자리):
   ```
   google.com, pub-1234567890123456, DIRECT, f08c47fec0942fa0
   ```
   AdMob 화면에서 복사해도 된다: **앱 → 모든 앱 보기 → app-ads.txt → app-ads.txt 설정 방법(How to set up app-ads.txt)**.
   마지막 `f08c47fec0942fa0`은 Google 고유 값이라 모두에게 같다.
2. `docs/web/README.md` 2단계처럼 `humsleep.github.io` 저장소 **루트**에 `app-ads.txt`로 저장해 올린다(확장자 `.txt`, 이름 그대로).
3. 1~2분 뒤 확인한다: `curl -s https://humsleep.github.io/app-ads.txt` → 위 한 줄이 그대로 나오면 된다.
4. 출시하고 2-2의 스토어 연결까지 마치면 AdMob이 파일을 읽는다. 최대 24시간 걸린다. **앱 → 모든 앱 보기 → app-ads.txt** 탭에서 상태를 보고, 필요하면 **업데이트 확인(Check for updates)**을 누른다.
5. 개인정보처리방침(`/duskwick/privacy`)과 지원(`/duskwick/support`) 페이지도 같은 저장소에 같이 올린다(pack §9-3).

---

## 7. 테스트 기기와 정책 함정

### 7-1. 테스트 기기 등록 — [오너]

**설정(Settings) → 테스트 기기(Test devices) → 테스트 기기 추가(Add test device)**

| 항목 | 값 |
| --- | --- |
| 기기 이름 | 예: `Owner iPhone` |
| 플랫폼 | iOS |
| 광고 ID / IDFA | 내 iPhone의 IDFA |
| 동작(Gesture) | **흔들기(Shake)** (광고 검사기를 연다. 없음도 괜찮다) |

- 등록 기기에서는 실제 ID 빌드에서도 "Test mode" 표시가 붙은 테스트 광고가 나온다. 반영까지 15분~최대 24시간 걸린다.
- **IDFA 찾기**: iOS는 IDFA를 설정 화면에 보여 주지 않는다. App Store의 무료 "IDFA 보기" 앱으로 확인할 수 있다(오너가 직접 설치). 그 앱에서도 추적을 허용해야 값이 보인다.
- 시뮬레이터는 자동으로 테스트 기기다.
- 개발 빌드(`testing: true`)는 기기 등록과 관계없이 항상 데모 광고만 받는다(4-2 리드 참고).
- 조심해야 할 것은 **TestFlight나 App Store 빌드**(`testing: false`)를 내 폰에서 돌릴 때다.

### 7-2. 계정이 정지되는 함정 (꼭 지킬 것)

| 하지 말 것 | 왜 |
| --- | --- |
| **내 앱의 진짜 광고를 누르기** (시험 삼아서라도) | Google 정책이 "자기 광고를 눌러서 시험하는 것"을 명시적으로 금지한다. 무효 트래픽(invalid traffic)으로 잡히면 **광고 게재 중지나 계정 해지**가 된다. 해지되면 AdSense 같은 다른 Google 수익 상품도 막히고 새 계정도 못 만든다 |
| 가족, 친구, 플레이테스터에게 "광고 좀 눌러 줘", "광고 봐 줘서 응원해 줘" 부탁하기 | 클릭이나 노출을 부풀리는 것은 수동이어도 금지다 |
| 광고를 보거나 누르면 돈이나 상을 준다고 약속하기 | 금지다. 앱 안의 "30분 광고 쉬기"는 보상형 정책을 지킨 앱 내 보상이라 괜찮다 |
| 플레이테스트에 `testing: false` 빌드를 돌리기 | 테스터 폰은 테스트 기기가 아니다. 플레이테스트는 늘 `testing: true` 빌드로 한다 |
| 내 폰으로 실제 광고를 몇 번이고 새로 띄우기 | 같은 기기의 비정상 노출로 보일 수 있다. 실제 ID 빌드에서 광고가 뜨면 바로 닫는다 |
| AdMob 계정을 하나 더 만들기 | 중복 계정은 하나 또는 둘 다 닫힌다 |
| 심사 제출 빌드에 테스트 ID 넣기 | 출시 게이트가 막는다(`npm run ios:release-check`) |

- 나중에 미디에이션 네트워크(AppLovin 등)를 붙이면 네트워크마다 테스트 모드를 따로 켠다. 켜는 방법을 모르면 그 광고는 누르지 않는다.
- 문제가 생기면 AdMob **정책 센터(Policy center)**와 이메일로 알려 온다. 출시 뒤 첫 몇 주는 1주일에 한 번 정책 센터를 열어 본다.

---

## 8. 출시 전 확인 목록

**AdMob 콘솔 — [오너]**
- [ ] 계정 확인 완료, 결제 정보(개인, 영문 실명, 우편 받는 주소) 입력
- [ ] 앱 Duskwick(iOS, 미출시) 등록, 앱 ID 받음
- [ ] 광고 단위 2개: 전면 `Duskwick_iOS_Interstitial_BetweenBoards`, 보상형 `Duskwick_iOS_Rewarded_Break30`
- [ ] 전면 게재빈도 제한: 사용자당 1일 10회
- [ ] 고참여 광고 **끔** (앱 설정)
- [ ] 민감한 카테고리 차단 (게임 카테고리는 막지 않음)
- [ ] 유럽 규정 메시지 **게시됨** (거절 버튼 켬, 개인정보처리방침 URL 입력)
- [ ] IDFA 설명 메시지 **없음 또는 게시 안 됨** (목록의 상태 열로 확인)
- [ ] 미국 주 규정 메시지 **게시됨**
- [ ] 내 iPhone을 테스트 기기로 등록
- [ ] 앱 ID, 단위 ID 2개, 퍼블리셔 ID를 리드에게 전달

**코드와 빌드 — [리드]**
- [ ] `config.ts` 10, 12, 14줄 실제 ID. 22줄 `testing: false`는 심사 아카이브에서만
- [ ] `Info.plist` 53줄 = `config.ts` 10줄과 같은 앱 ID
- [ ] `npm --prefix apps/client run ios:release-check` → `release gates: OK`
- [ ] 실제 앱 ID 빌드에서 확인: EEA 밖(한국)이면 첫 판 뒤 Google 화면 없이 **바로 ATT 창**, EEA(UMP 디버그 지역이나 VPN)이면 GDPR 양식 다음 ATT
- [ ] 설정 시트의 "개인정보 선택" 줄: EEA와 미국 해당 주에서 보이고, 양식이 열리고 닫힘
- [ ] `docs/store/review/att-flow.mp4`를 실제 앱 ID 빌드로 다시 녹화("Tap Allow" 화면이 없어야 함)
- [ ] `docs/app-store-connect-pack.md` 89줄 심사 메모 문구 정리, 260줄 퍼블리셔 번호 채움
- [ ] `docs/web/app-ads.txt` 준비
- [ ] `src/ads/README.md` 16줄, `src/ads/index.ts` 22줄 주석에 "US regulated states" 추가

**웹과 App Store Connect — [오너]**
- [ ] `https://humsleep.github.io/app-ads.txt`가 한 줄 그대로 열림 (`curl -s`로 확인)
- [ ] `https://humsleep.github.io/duskwick/privacy`, `…/duskwick/support`가 열림
- [ ] ASC **마케팅 URL** = `https://humsleep.github.io/duskwick/` (비우지 않음, 같은 도메인)
- [ ] ASC App Privacy 답변이 pack §2와 같음 (추적: 예, 광고 데이터)
- [ ] 실기기(TestFlight, `testing: false`)에서 무음 스위치 ON이면 광고 소리 없음 (`src/ads/README.md` 기기 확인 1~7). **실제 광고가 떠도 누르지 않는다**

**출시 당일과 그 뒤 — [오너]**
- [ ] 앱이 스토어에 뜨면 AdMob에서 **스토어 추가**(2-2). 검색에 안 나오면 하루 뒤 다시
- [ ] "준비 중" → 승인 확인 (2~3일)
- [ ] app-ads.txt 상태가 확인됨으로 바뀜 (최대 24시간 뒤)
- [ ] 1주일에 한 번 정책 센터 확인
- [ ] 수익 $10 → 신원 확인과 PIN 우편 → 4개월 안에 입력. 지급 수단(전신 송금) 등록, 세금 정보(1-2) 제출

---

## 출처 (2026-10-18 확인)

- AdMob 가입 단계(국가는 나중에 못 바꿈, 계정 확인 시간): https://support.google.com/admob/answer/7356219
- 지급 기준액(USD $10 / $10 / $100): https://support.google.com/admob/answer/2772208
- 지급 일정(3일 확정, 21일 지급, 전신 송금 10일): https://support.google.com/admob/answer/2772140
- 첫 지급까지 단계(PIN 2~3주, 4개월 기한): https://support.google.com/admob/answer/2998384
- 세금 정보 제출 경로와 조세조약 안내: https://support.google.com/admob/answer/14135099
- (옛 안내, 계약 주체 Google Inc.) 개인 W-8BEN 대신 8233: https://support.google.com/admob/answer/4381375
- AdSense의 W-8BEN 안내(참고): https://support.google.com/adsense/answer/10735961
- 앱을 스토어에 연결(24~48시간, 최대 1주, 잘못 연결하면 못 바꿈): https://support.google.com/admob/answer/10037806
- 앱 준비 검토와 미출시 앱의 제한 게재: https://support.google.com/admob/answer/10564477 , https://support.google.com/admob/answer/9989980
- 게재빈도 제한: https://support.google.com/admob/answer/6244508
- 고참여 광고 켜기·끄기: https://support.google.com/admob/answer/15525707
- 유럽 규정(GDPR) 메시지 만들기: https://support.google.com/admob/answer/10113207
- IDFA 설명 메시지 소개와 만들기: https://support.google.com/admob/answer/10115027 , https://support.google.com/admob/answer/10115331
- 메시지 게시와 게시 중단(토글, 최대 10분): https://support.google.com/admob/answer/13651178
- 미국 주 규정 메시지(20개 주, 대상 설정): https://support.google.com/admob/answer/10860309
- app-ads.txt 설정(마케팅 URL 도메인 루트, 하위 도메인 한 단계, 24시간): https://support.google.com/admob/answer/9363762
- 테스트 기기 추가(설정 → 테스트 기기, IDFA, 동작): https://support.google.com/admob/answer/9691433
- iOS 테스트 광고와 데모 단위 ID: https://developers.google.com/admob/ios/test-ads
- 무효 트래픽(자기 광고 클릭 금지, 계정 해지): https://support.google.com/admob/answer/2753860
- App Review Guidelines 5.1.1(iv), 5.1.2(i): https://developer.apple.com/app-store/review/guidelines/
- Apple HIG Privacy(ATT 앞 안내 화면 규칙: "Allow" 버튼 금지, 버튼 하나 "Continue"): https://developer.apple.com/design/human-interface-guidelines/privacy
- 코드 근거: `apps/client/src/ads/config.ts`, `policy.ts`, `AdMobAds.ts`, `README.md`, `apps/client/scripts/release-gates.mjs`, `apps/client/node_modules/@capacitor-community/admob/ios/Sources/AdMobPlugin/AdMobPlugin.swift`(`getAdId`), `apps/client/ios/App/App/Info.plist`, `docs/app-store-connect-pack.md` §3·§4·§6·§9, `docs/app-review-preflight.md` §A, `docs/web/README.md`
