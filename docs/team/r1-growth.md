# R1 성장 — 현금 0원으로 설치를 모으는 방법 (TikTok Strategist, 2026-10-17)

입력 자료: `docs/team/TEAM.md`, `HANDOFF.md`, `playtest/BENCHMARK-CUTE.md`(Wick), `playtest/shots/cute-mock/`·`shots/v11/`, `~/Downloads/Puzzle_Portfolio_결정_v4_매출재계산.md`(v4), 공유 문구 코드 `games/lanterns-pips/share.ts`.
웹 출처는 [G#]로 표시했고 목록은 맨 끝에 있다. **추측**이라고 적은 숫자는 근거에 기대 어림한 값이다. 측정값이 아니다.

---

## 0. 결론 (냉정 판정)

1. **지금 미국·영국·캐나다·호주의 퍼즐 1위는 돈으로 산 자리다.**
   - 2026-10-17에 App Store RSS를 직접 조회했다 [G11]. US·GB·CA·AU·NZ 퍼즐 무료 1위는 모두 **Meowdoku!**이고, US에서는 **게임 전체 1위**이기도 하다.
   - Meowdoku는 Queens 규칙(색 구역마다 고양이 하나, 행·열 하나, 서로 닿지 않음)에 고양이를 입힌 게임이다.
   - 2026-05-04에 출시했고, 6월 하순에 750만 다운로드와 DAU 170만을 기록했다(Sensor Tower 재인용) [G8]. 하루 다운로드는 약 40만 건이다 [G9][G10].
   - 퍼블리셔 Oakever의 UA 지출은 **하루 약 $50만으로 추정**되고, 30일 동안 새 광고 소재 약 1만 개(대부분 AI 생성)를 썼다 [G9][G10].
   - **"귀여운 캐릭터 + 논리 퍼즐 + 광고 수익"이라는 Duskwick의 자리는 이미 거대 UA가 차지했다.** 차트 1위로 가는 길에서 우리는 이들과 정면으로 경쟁한다.
2. **이 기간에 현금 없이 크게 성공한 퍼즐은 모두 "웹 + 공유"였다. "앱 + 공유" 사례는 찾지 못했다.**
   - Wordle(웹, 링크 없는 이모지 격자, 2개월 만에 90명 → 30만 명) [G1]
   - Clues by Sam(핀란드 디자이너 1인, 웹 데일리, 2025-05 시작, 2026 초 DAU 5만+) [G4]
   - Queens·Pips는 LinkedIn·NYT가 원래 가진 유통망으로 컸다 [G5][G13]. 우리에게는 없는 조건이다.
   - App Store의 Queens 복제 앱들은 유통망이 없어서 평점조차 쌓지 못했다 [G6].
3. **"Tier-1 1개국 퍼즐 1위"를 현금 0원으로 노릴 수 있는 곳은 아이슬란드·룩셈부르크 같은 초소형 스토어프런트뿐이다.**
   - 추정치는 하루 약 170~300건이고, 오차는 ×0.3~×3이다(§2-0).
   - 이것은 매출에 거의 영향이 없는 **허영 지표**다. NZ·IE(하루 약 2.4천 건 추정) 1위는 바이럴 1회가 터져야 가능하고, 확률은 몇 % 수준(추측)이다. 미·영 1위는 사실상 0%다.
4. **공유 루프의 k-factor는 1보다 확실히 작다.** 추정치는 0.1~0.35(§3)이고, 다른 채널에서 들어온 설치를 **1.1~1.5배로 키우는 증폭기**일 뿐이다. 설치 없이 바로 플레이하는 웹 데일리가 없으면 아래쪽(0.05 안팎)에 머문다.
5. **그래서 목표를 이렇게 바꿀 것을 제안한다.** 주 목표는 v4의 W8 판정선, 즉 **출시 8~30일 평균 하루 설치 ≥ 27건, 예상 정착 DAU ≥ 250**이다. 차트 1위는 원한다면 초소형국 1일 1위라는 선택형 이벤트로만 둔다(§2-5).
   - v4 기준으로 하루 1건을 1년 유지하면 12개월째 월 약 2,400원이다. 마케팅 시간은 **주 6시간 상한**으로 묶는다.
6. **가장 먼저 만들 것**(효과 대비 비용 순):
   - ① 공유 문구에 링크와 캠페인 토큰 넣기
   - ② 웹 데일리(같은 TS 코어, GitHub Pages)
   - ③ **답을 가린** 엽서 공유 이미지. 목업 `03-result-postcard.png`는 오늘 판의 정답 등불 위치를 그대로 보여 준다. 데일리 공유에 쓰면 **스포일러**다.
   - ④ 판을 자동으로 녹화하는 스크립트(콘텐츠 생산비를 줄인다)

---

## 1. 2024–2026 돌파 퍼즐은 어디서 설치를 얻었나

### 1-1. 사례표

| 게임 | 주 채널 | 증거 | 현금 0원 1인 개발자가 따라 할 수 있나 |
|---|---|---|---|
| **Wordle** (2021-10 → 2022-01) | 웹 + 공유 | 11/1 90명 → 1/2 30만 명 이상. 12월 중순 "스포일러 없는 이모지 격자" 공유 버튼을 단 뒤 급증했다. 작가는 링크를 "지저분하다"며 넣지 않았다 [G1]. 성인 중 처음 알게 된 경로가 소셜미디어라는 응답이 43% [G2]. 플레이어의 약 2/3가 여성이라는 조사도 있다(방법론 미확인) [G3] | **부분적으로.** 공유 형식은 따라 할 수 있다. 설치가 필요 없었다는 점과 2021년 말에 경쟁작이 없었다는 점은 재현할 수 없다 |
| **Clues by Sam** (2025-05 →) | 웹 데일리 + 이모지 격자·이미지 공유 + 퍼즐 커뮤니티 | 2026 초 DAU 5만+를 개발자가 직접 밝혔다. 공유는 이모지·텍스트·이미지 세 가지이고, "막힌 상태 공유" 링크도 있다 [G4] | **가장 가까운 본보기다.** 1인 규모, 논리 데일리, 무료다. 다만 앱이 아니라 웹이다 |
| **LinkedIn Queens** (2024-05) | LinkedIn 앱 안 유통 | LinkedIn이 직접 넣은 데일리 3종 가운데 가장 인기 [G5] | 불가. 플랫폼이 유통했다 |
| Queens 복제 앱 (2024–26) | 스토어 자연 유입 | 예: "Queens: Logic Puzzles"는 미국 평점 수가 표시 최소치에도 못 미친다 [G6] | **반면교사.** 규칙만 같고 유통이 없으면 아무 일도 일어나지 않는다 |
| **Meowdoku** (2026-05 →) | 유료 UA(대량 AI 소재, 두뇌 훈련형 훅, TikTok 댓글 오버레이 스타일) | 위 0-1 참조 [G8][G9][G10]. 지금 US 퍼즐·게임 전체 1위 [G11] | 불가. 현금 0원과 정반대다. 다만 **"귀여운 동물 + 논리 규칙 + 두뇌 훈련" 훅이 CPI가 낮다**는 정보는 소재 방향에 쓸 만하다 |
| **Block Blast** (2024 급성장) | TikTok 하이스코어·팁 영상 + TikTok 광고 + 대량 UA | 2024년 급성장, 10대 위주 [G12]. 학생 기사에 "TikTok에서 바이럴됐을 때 시작", "광고를 계속 봐서 받았다"는 증언이 있다(일화) [G12] | 불가. 유기 바이럴과 유료 노출이 섞여 있어 분리할 수 없다. 타깃도 10대라 다르다 |
| **NYT Pips** (2025-08-18) | NYT Games 앱 + TODAY 독점 공개 + 브루클린 바 오프라인 이벤트 [G13] | 플레이어 수는 공개되지 않았다 | 불가. 이미 수백만 명이 매일 찾는 앱 안에서 출시했다 |
| **#cozygames 크리에이터 생태계** | TikTok·YouTube·Twitch 크리에이터 | 13–39세 여성의 75%가 cozy 게임을 좋아한다 [G16]. 대형 cozy 크리에이터 계정은 팔로워 90% 이상이 여성이고 핵심은 25–34세다(제3자 추정) [G16]. r/CozyGamers 약 43만 명 [G16] | **가능하지만 장벽이 있다.** cozy 크리에이터는 PC·Switch 위주다. 모바일 게임은 "광고 없음, 오프라인"일 때만 추천하는 경향이 있다(정성 관찰). **광고 수익만 쓰는 Duskwick에는 불리하다** |

### 1-2. 우리 타깃(35–54세 여성)은 실제로 어디에 있나

미국 성인, Pew 2025 기준이다 [G14].

| 플랫폼 | 여성 | 30–49세 | 50–64세 | 판정 |
|---|---|---|---|---|
| Facebook | 78% | 80% | 74% | **주력.** 그룹과 페이지에서 공유가 퍼진다. Wordle 공유가 퍼진 주 무대 중 하나 |
| Instagram | 55% | 62% | 40% | 보조. Reels와 Stories(공유 이미지) |
| TikTok | 42% | 44% | 30% | 보조. 도달은 가장 싸지만 타깃 밀도는 낮다 |
| Pinterest | (성별 미보고, 전 세계 여성 약 70% [G15]) | — | — | **과소평가된 채널.** "printable logic puzzles for adults"류 검색 수요. 핀은 수명이 길다 |
| Reddit | 23% | 35% | **16%** | 타깃이 아니다. 얼리어답터, 기자, 크리에이터의 눈에 띄는 용도 |

**결론**: 콘텐츠는 TikTok으로 실험하고, 성과는 Facebook·Instagram·Pinterest에서 거둔다. Reddit은 출시일 한 번의 불꽃과 기자 노출용이다.

### 1-3. 공통 원리 (옮길 것 / 버릴 것)

- **옮길 것**
  1. 모두가 같은 판을 푼다(데일리)
  2. 스포일러 없는 결과물(격자·시간)이 대화를 만든다
  3. 마찰이 0에 가까운 첫 플레이(웹)
  4. 1인 개발자의 진정성 이야기
- **버릴 것**
  1. 차트를 사는 UA
  2. 플랫폼 유통에 기대는 전략
  3. 10대용 하이스코어 경쟁
- **새로 확인한 위험**: Meowdoku가 "귀여운 논리 퍼즐"의 기본값이 됐다. 35–54세 여성은 이미 그 광고를 봤다. 우리 메시지는 Meowdoku와 반대 축이어야 한다. **"매일 한 판, 밤에 끝나는 퍼즐, 하트(목숨) 없음, 실수 벌칙 없음"**이다. Meowdoku는 하트 3개 실수제이고 판마다 광고를 띄운다 [G4 기사][G8].

---

## 2. 현금 0원 출시 계획

### 2-0. 차트 1위에 필요한 설치 수 (추정)

> **정정 (교차 비판 뒤):** 아래 IE·NZ 값(약 2.4천)은 인구비 근사라서 너무 높다. 국가별 Sensor Tower 값으로 보면 평시 IE 약 260, NZ 약 890이다(r1-market §2-2). 지금 1위의 UA 유입을 감안해 **IE·NZ는 하루 300~1,500**으로 고친다. IS·LU는 데이터가 없어 수십~수백으로 둔다. 자세한 내용은 `r1-critique-growth.md` §0에 있다.

- 미국 게임 1위는 하루 약 17.4만 건이었다(Sensor Tower, 2019) [G17]. 지금 미국 퍼즐 1위가 게임 전체 1위이고, 그 앱의 전 세계 하루 다운로드는 약 40만 건이다 [G9][G11]. 그래서 **미국 퍼즐 1위 ≈ 하루 10만~20만 건**으로 본다.
- 2019년 영국 게임 10위는 8천 건으로 미국 10위 4.3만 건의 0.19배였다 [G17]. 인구비 0.20과 거의 같다. 그래서 **인구비로 나누는 근사**를 썼다. 기준값은 미국 1위 하루 15만 건이다.
- Apple은 차트 공식을 공개하지 않는다. 최근 24~72시간의 설치 속도가 지배적이라는 것이 업계 통설이지만 공식 확인은 아니다. 설치는 **사용자 Apple ID의 국가**로 집계된다. 한국 지인이 받은 설치는 아이슬란드 차트에 들어가지 않는다.

| 스토어 | 인구비 | 퍼즐 1위 하루 설치 (추측, ×0.3~×3) | 현재 1위 [G11] | 0원 도달 가능성 (추측) |
|---|---|---|---|---|
| US | 1 | 약 15만 | Meowdoku | ≈ 0% |
| UK | 0.20 | 약 3만 | Meowdoku | ≈ 0% |
| CA / AU | 0.12 / 0.08 | 약 1.8만 / 1.2만 | Meowdoku | < 0.5% |
| NZ / IE | 0.016 | 약 2.4천 | Meowdoku / Block Out! | 1~3% (해당 국가 언론이나 크리에이터 바이럴 1회가 필요) |
| LU / IS | 0.002 / 0.001 | 약 300 / 170 | Block Out! | 일부러 현지에 집중하면 5~15%. 하지 않으면 ≈ 0% |

### 2-1. 출시 전 (T−6주 → T−1일)

| 시점 | 할 일 | 메모 |
|---|---|---|
| T−8주 | **Wick을 실제 게임에 넣는다.** BENCHMARK-CUTE 단계 1~4(보드 얼굴, 히어로, 엽서) | v11 화면에는 아직 Wick이 없다. **실제 게임에 없는 캐릭터로 영상을 찍으면 기대 불일치가 생긴다.** 모든 콘텐츠의 선행 조건이다 |
| T−6주 | App Store 레코드와 **사전 주문** 켜기(최대 180일 전, 출시일에 자동 다운로드) [G18] | Apple은 사전 주문 물량이 초기 노출과 차트 배치에 기여할 수 있다고 쓴다 [G18]. 가중치는 공개되지 않았다 [G18 Sonar]. **사전 주문 = 무료 대기자 명단.** 이메일 도구가 필요 없다. 사전 주문도 심사 승인을 받아야 한다 |
| T−6주 | **피처링 지명**(App Store Connect → Nominations → New app launch) [G19] | §2-6 초안. 가능한 한 일찍 낸다 |
| T−6주 | 계정 개설: TikTok·Instagram·Facebook 페이지·Pinterest(비즈니스)·Reddit. **사용자가 직접 한다** | 계정 생성은 사용자 권한이다(HANDOFF) |
| T−6주 → | 주 3회 숏폼(§2-3). 출시 전에 약 15~18편을 올려 **포맷 실험을 끝낸다** | 출시 주에 처음 올리면 늦다 |
| T−5주 | **웹 데일리 MVP** 공개(humsleep.github.io/duskwick, 무료). 오늘의 판 + 공유 + "앱에서 더 하기"(Smart App Banner, ct 토큰) [G24] | 모든 게시물이 가리킬 "마찰 0" 목적지 |
| T−5주 | TestFlight 공개 링크(외부 테스터 최대 1만 명, 첫 빌드는 베타 심사 필요) [G21]. 목표 100~300명 | 모집처: r/CozyGamers·r/puzzles(규칙 확인 뒤), 페이스북 퍼즐 그룹(관리자 허락 뒤). **TestFlight 설치는 App Store 차트에 들어가지 않는다.** 그래서 테스터에게도 사전 주문을 부탁한다 |
| T−4주 | 매일 오늘의 판 이미지 자동 생성 → Facebook·Instagram·Pinterest에 예약 게시(주 1회 일괄) | §3 P-7 스크립트. 답은 다음 날 댓글이나 스토리로 공개한다 |
| T−3주 | 크리에이터·언론 피칭 1차(§2-5). 엠바고 T0, TestFlight 초대 동봉 | 출시 뒤에는 프로모 코드를 쓸 수 있다 |
| T−14일 | **인앱 이벤트** "First Lantern Night"(출시 주 7일) 등록. 게시는 시작 14일 전부터 가능하고, 동시 게시는 최대 10개 [G20] | 검색, 제품 페이지, 편집 노출 후보가 된다 [G20] |
| T−7일 | 페이스북 그룹 관리자 5~10곳과 "출시일 게시 허락" 확정. 크리에이터 게시일 확정(T0~T+1) | 모든 불꽃을 48시간 안에 모은다 |

**Reddit 현실 점검**
- r/iOSGaming은 2026년 9월 무렵 개발자 홍보(Developer Saturday)를 **중단**했다는 공지가 미러에서 보인다 [G23]. 출시 직전에 reddit.com 규칙을 다시 확인한다.
- r/puzzles에는 홍보 글이 아니라 **진짜 퍼즐(그림 1장, "Can you place the lanterns?")**을 올린다. 게임 이름은 규칙이 허용하는 범위에서 댓글로만 밝힌다.
- 웹 데일리는 r/WebGames에 맞는다.

### 2-2. 출시 주 (T0 = 화~목 중 하루. Apple 행사 주간과 미국 공휴일은 피한다)

- **T0 00:00 (각 스토어)**: 사전 주문분이 자동으로 설치된다. 오전(미 동부 기준)에 아래를 **같은 날** 쏟는다. 가설은 "설치 속도가 차트를 정한다"이고 공식 확인은 아니다.
  1. 숏폼 #1 "Launch day, Wick wakes up"(§4 S9)을 TikTok·Reels·Facebook에 올린다
  2. r/puzzles 퍼즐 글 1개, r/WebGames 웹 데일리 글 1개
  3. 사전 허락을 받은 페이스북 그룹에 게시(§4 T2)
  4. 크리에이터 게시(사전 확정분)
  5. TestFlight 테스터에게 "오늘 스토어판으로 갈아타 주세요" 안내
- **T+1~T+3**: 반응이 가장 좋았던 포맷으로 2편 더 올린다. 모든 댓글에 답한다(첫 시간 참여 속도). 웹 데일리 공유 문구를 점검한다.
- **T+3 무렵**: 별점 요청. 3번째 데일리를 힌트 없이 끝낸 직후 `SKStoreReviewController`를 띄운다. **보상을 걸고 별점을 요청하는 것은 금지다** [G22].
- **T+7**: "Wick 출시 1주" 회고 영상과 글(1인 개발자 이야기). 피처링 지명에 수치를 덧붙인다.
- **금지 (5.6.3 Discovery Fraud)**: 설치 교환, 유료·보상형 설치, 리뷰 품앗이, 대행 서비스. 차트, 검색, 리뷰, 추천 조작이 걸리면 개발자 계정이 퇴출될 수 있다 [G22]. 기존 앱까지 함께 잃는다.

### 2-3. 콘텐츠 시스템 (Wick = 캐릭터 IP)

**원칙**
- Wick은 **말하지 않는다**(BENCHMARK-CUTE 규칙 1). 그래서 영상은 자막과 게임 소리만으로 만든다.
  - 한국에 있는 1인 개발자가 영어 음성 없이 Tier-1 영어권에 올릴 수 있다. **언어 장벽이 거의 0**이다. 자막 영어는 원어민 검수가 필요하다.
- 음악은 게임 자체의 펜타토닉 사운드를 쓴다. 저작권 위험이 없고, 소리가 브랜드가 된다.
- 길이는 15~30초, 세로 9:16이다. 첫 1~2초 안에 **판 + Wick 표정 + 질문 자막**을 보여 준다.
- 기둥(Pillar) 비율은 페르소나 기본값 40/30/20/10을 이 게임에 맞게 바꿨다.
  - 도전(풀어 보세요) 40%
  - 만족(점등 ASMR, Wick 반응) 30%
  - 개발 이야기(1인, 한국, 손으로 그린 Wick) 20%
  - 출시·이벤트 알림 10%

**생산 파이프라인 (1인용, 편당 15~25분 목표)**
1. `playtest/novice/run.mjs`처럼 Playwright로 웹 빌드를 자동 플레이한다. 사람 같은 타이밍, Wick 반응 포함, 1080×1920으로 녹화한다(§3 P-8, 1~2일 1회 투자).
2. 무료 편집기로 자막을 얹는다. 템플릿 3종(도전, ASMR, 개발 이야기)을 만들어 두고 반복해서 쓴다.
3. 예약 게시: Meta Business Suite(FB·IG), TikTok 웹 예약, Pinterest 예약. 모두 무료다.
   - 미 동부 저녁 7~10시는 한국 시간 다음 날 오전 8~11시다. 예약하면 시차 부담이 없다.
4. 링크는 채널마다 다른 ct 토큰을 쓴다(`tiktok_bio`, `ig_bio`, `fb_groups`, `pin`, `reddit`, `web_daily`, `press_<매체>`) [G24]. App Store Connect 출처 분석에서 채널별 설치를 구분하려는 것이다.
   - TikTok 프로필 링크는 계정 유형과 팔로워 수에 따라 막힐 수 있다(미확인, 개설 시 확인). 막히면 영상에서 "search Duskwick"을 안내한다.

**공유 루프 개선**은 §3에서 다룬다(링크, 가린 엽서 이미지, 경로 띠).

### 2-4. 주간 리듬 (1인 지속 가능, 주 약 5~6시간)

| 요일 (KST) | 시간 | 일 |
|---|---|---|
| 월 | 2 h | 숏폼 3편 일괄 제작(자동 녹화 → 자막 → 예약) |
| 화·목·토 | 자동 | 예약 게시(미 동부 저녁) |
| 매일 | 자동 | 오늘의 판 이미지 FB·IG·Pinterest 예약 게시(일요일에 7일분을 한 번에 올림) |
| 수 | 40 min | 댓글 답, Reddit·FB 그룹에서 **홍보가 아닌** 기여 1건 |
| 금 | 1 h | 크리에이터·매체 피칭 5건(§4 T5), 응답 정리 |
| 일 | 45 min | 다음 주 데일리 이미지 7장 예약, 채널별 ct 설치 집계(시트 1장) |
| 월 1회 | 1 h | 인앱 이벤트 1건, 피처링 지명 갱신 |

**채널 중단선** (4주 실험 단위)
- 4주 평균 조회 300 미만**이면서** 해당 ct 설치가 0~2건이면 포맷을 바꾼다.
- 8주째에도 같으면 그 채널을 끈다.
- 전체 마케팅 시간은 v4 판정(W8)까지 **주 6시간 상한**으로 둔다.

### 2-5. 언론·크리에이터 피칭

- **대상 우선순위**
  1. 모바일을 다루는 cozy·퍼즐 크리에이터. 팔로워 1천~10만, 시청자 대부분이 여성(제3자 집계로 확인) [G16]
  2. 퍼즐 전문 큐레이션: Thinky Games 데이터베이스와 커뮤니티(Discord, Thinky Puzzle Game Jam). 등재 절차는 미확인이라 사이트에서 문의한다 [G26]
  3. "Wordle 대안" 기사를 쓰는 기자(데일리라는 각도)
  4. 모바일 게임 매체
- **각도 (사실만 쓴다)**
  - "한국의 1인 개발자, 등불 속 작은 정령 Wick, 매일 한 판, 하트·타이머 압박 없음, VoiceOver·큰 글자 지원"
  - Meowdoku류 "광고 폭탄 논리 게임"의 반대편
  - **"광고 없음"이라고 쓰면 안 된다.** 우리는 광고로 수익을 낸다. 사실대로 쓸 수 있는 문장은 "데일리 플레이 중에는 광고가 끼어들지 않는다"이다. v4에 따르면 데일리만 하는 사용자는 하루 전면 광고 약 0.13회다. 출시 구성으로 실제 확인한 뒤에만 쓴다.
- **초소형국 선택 이벤트** ("1개국 1위" 목표를 꼭 지키려 할 때만)
  - 아이슬란드 또는 룩셈부르크를 하나 고른다.
  - 현지 페이스북 그룹과 현지 커뮤니티에 진정성 있는 연결 고리가 있어야 한다. 예를 들어 현지어(아이슬란드어) 현지화와 현지 테마 인앱 이벤트다. 그 국가 Apple ID 사용자 약 150~400명을 24시간 안에 모아야 한다(추측).
  - 비용은 현지화와 현지 연락에 들이는 약 10~20시간이다. 성공해도 **얻는 것은 스크린샷 한 장과 홍보 문구 하나**이고, 매출 효과는 거의 0이다.
  - **권장: 하지 않는다.** 하더라도 W8에서 "연장" 이상이 나온 뒤에 한다.

### 2-6. App Store 피처링 지명 초안 (New app launch)

> **Duskwick — a calm lantern logic puzzle with a tiny spirit named Wick.**
> Made by one developer in Korea. One hand-checked daily puzzle (one unique answer, no guessing), a quiet town that lights up as you solve, and Wick — a little lantern spirit who lives in every lantern you place and reacts without words. No lives, no timers on screen, no penalties for mistakes; the game gently ends the evening rather than pushing "one more". Built for accessibility from day one: VoiceOver, Larger Text, high contrast, 7 languages, iCloud sync without an account. Launch event "First Lantern Night" runs during launch week.

- 근거로 붙일 것: 접근성 지원, 7개 언어, iCloud 동기화, 출시 이벤트.
- 나중에 위젯이나 Game Center를 만들면 그것도 붙인다.
- 피처링 여부는 보장되지 않는다 [G19]. 확률은 낮게 본다(추측: 10% 미만).

### 2-7. 현실적으로 기대할 수 있는 결과 (추측, v4 §4-1 분포에 맞춤)

| 시나리오 | 확률 | 출시 1주 설치 | 30일째 하루 설치 | 의미 |
|---|---|---|---|---|
| 아무것도 안 터짐 | 약 50~55% | 100~400 (지인, 사전 주문, Reddit 1회) | 1~5 | v4 "중단" |
| 게시물 하나가 터짐 (r/puzzles 상위 또는 영상 10만 뷰) | 약 30% | 1천~5천 | 5~20 | v4 "중단~연장" 경계 |
| 크리에이터나 기사가 터짐 (영상 100만 뷰 또는 큰 매체) | 약 10~12% | 5천~3만 | 20~60 | "연장~확대". NZ·IE 퍼즐 상위 10 가능 |
| 진짜 바이럴 (Clues by Sam급 웹 데일리 확산) | 약 3% | 3만+ | 60+ | "확대". 1개국 1위는 그 부산물 |

- 이 계획이 하는 일은 v4의 "하루 2건 미만 45%"를 2~20건 구간으로 **조금** 옮기는 것이다. 1위를 보장하는 계획이 아니다.

---

## 3. 바이럴을 위한 제품 변경

**k-factor 모델**

k = s × r × c × L

| 기호 | 뜻 | 기본값 |
|---|---|---|
| s | DAU-일당 공유율 | 0.05 |
| r | 공유 1건이 닿는 사람 수 | 단톡 15 / 페이스북 타임라인 30~50 |
| c | 노출 → 설치 전환 | — |
| L | 설치 1명당 활동일(v4 L365) | 9.2 |

- **현재 상태**: 링크 없는 텍스트이므로 사람들이 "Duskwick"을 직접 검색해야 한다. c ≈ 0.002로 보면 k = 0.05 × 15 × 0.002 × 9.2 ≈ **0.014**다. 사실상 0이다.
- **비교 기준(Wordle)**: 설치가 필요 없는 웹이었고 경쟁이 없었다. 그래서 c가 높았고 k > 1이었다. **앱은 설치라는 벽 때문에 c가 5~10배 낮다.**

| # | 변경 | 공수 (1인 + 에이전트) | k 증가 추정 (추측) | 판정 |
|---|---|---|---|---|
| P-1 | **공유 문구에 짧은 링크** `humsleep.github.io/d/14`(+ ct). 웹 데일리 전에는 App Store 링크. `share.ts`에 줄 하나 추가 | 0.5일 | +0.03~0.08 (c 0.002 → 0.01~0.015) | **즉시** |
| P-2 | **웹 데일리**: 같은 TS 코어, 오늘의 판만, 공유, Smart App Banner(ct), "어제 답 보기". GitHub Pages라 무료다 | 5~8일 | 앱 k에 직접 +0.01~0.05. 웹 자체 루프(웹 플레이 → 공유 → 웹 플레이)는 k_web 0.2~0.8(불확실). **모든 채널에 "마찰 0" 목적지를 준다** | **출시 전 필수.** v4도 레버 1(설치)에 넣었다 |
| P-3 | **엽서 공유 이미지**: Wick cheer, 우표, 소인 #n, 시간, 연속 기록. 판은 **풀기 전 상태(돌과 숫자만)**를 넣고 "Solved in 4:07 — your turn" 문구를 단다. 정답 등불은 넣지 않는다 | 2~3일(결과 시점 오프스크린 베이크 → 파일 공유) | +0.02~0.10. 페이스북·인스타 스토리에서는 텍스트보다 이미지가 강하다(정성) | **출시 전.** 목업 03의 정답 노출은 반드시 고친다 |
| P-4 | **스포일러 없는 경로 띠**(텍스트): 놓은 순서대로 🟨 = 맞음, 🟥 = 충돌 뒤 고침, 💡 = 힌트. 예: `🟨🟨🟥🟨🟨🟨💡🟨` | 0.5일 | 0~+0.02. Wordle 격자의 "이야기" 역할. 위치는 드러나지 않는다 | 출시 전, 값싼 실험 |
| P-5 | **"이 판 풀어 봐" 도전 링크**(트랙 판의 시드 URL → 웹 또는 유니버설 링크) | 2~3일 | +0.01~0.04 | 출시 뒤 1차 |
| P-6 | **Game Center 데일리 리더보드 + Challenges**(iOS 26 Games 앱의 친구 도전) [G25] | 2~4일(네이티브 플러그인, 콜드 스타트 영향 측정 필요) | +0.01~0.03. Apple 생태계 기능이라 피처링에도 유리하다 | 출시 뒤 1차 |
| P-7 | **오늘의 판 이미지 자동 생성 스크립트**(1080×1350 IG, 1000×1500 Pinterest, 인쇄용 PDF 주간 묶음) | 1일 | 앱 k와 무관. 소셜 게시 생산비를 0으로 만든다. Pinterest "printable logic puzzles" 수요를 겨냥 | **출시 전** |
| P-8 | **자동 풀이 녹화 스크립트**(Playwright, 9:16, Wick 반응 포함) | 1~2일 | 앱 k와 무관. 영상 1편 생산비를 약 60분에서 약 20분으로 줄인다(추측) | **출시 전** |
| P-9 | 별점 요청 타이밍(3번째 무힌트 데일리 직후) | 0.5일 | 간접 효과(스토어 전환율) | 출시 전 |
| P-10 | Wick iMessage 스티커 팩 | 1일 | ≈ 0~0.01. 브랜드 노출뿐 | 여유가 있을 때 |
| P-11 | 홈 화면 위젯(오늘의 등불, 연속 기록) | 3~4일(네이티브 Swift) | k ≈ 0. 리텐션과 피처링 근거 | W8 "연장" 이상일 때 |
| P-12 | 가족·친구 "등불 모임"(같은 데일리 기록 비교, Cloudflare Workers 무료 등급) | 6~10일 | +0.03~0.10(단톡 문화, 35–54세 가족 그룹). 리텐션에도 도움 | W8 "확대" 때만 |
| P-13 | 추천 보상(초대 → 꾸미기 보상) | 3~5일 | ≈ 0~0.02. 줄 화폐가 없고, IDFA 없이 귀속하기도 어렵다 | **기각** |
| P-14 | 풀이 영상 내보내기(사용자용) | 5일+ | ≈ 0~0.02 | **기각.** 개발자가 직접 찍는다(P-8) |

- **P-1~P-4를 합친 k 추정은 0.1~0.35**(추측, 넓은 불확실성)다. 증폭 배수 1/(1−k)는 **1.1~1.5배**다.
- k가 1을 넘으려면 웹 데일리가 Wordle이나 Clues by Sam처럼 웹 안에서 스스로 퍼져야 한다. 그때도 앱 설치는 웹 플레이어의 몇 %(추측 3~10%)뿐이다.
- **결국 공유 루프는 엔진이 아니라 확성기다.** 엔진은 숏폼, 커뮤니티, 크리에이터로 만드는 첫 설치 물량이다.
- 공수 합계: 출시 전 필수 항목(P-1, 2, 3, 4, 7, 8, 9)은 약 **11~16일**이다.

---

## 4. 영상 스크립트 10편 + 게시 템플릿 5종

공통 사항
- Wick은 말하지 않는다. 자막(영어)과 게임 소리만 쓴다.
- 판은 실제 게임 화면만 쓴다.
- 해시태그 5~8개: #cozygames #puzzlegame #logicpuzzle #dailypuzzle #brainteaser #cozygamer #iosgames #duskwick
- **가짜 통계("97%가 못 푼다")를 쓰지 않는다.** 확인할 수 없는 주장은 신뢰와 광고 정책에 모두 위험하다.

| # | 제목 / 훅 (0–2초 자막) | 구성 (15–30초) | CTA |
|---|---|---|---|
| S1 | **"One lantern left. Where does it go?"** | 0–2s: 거의 완성된 판에 Wick curious, 마지막 빈칸 둘이 깜빡인다. 2–8s: 일시정지 자막 "pause & guess". 8–14s: 정답 칸에 탭, 판 전체가 점등되고 Wick들이 차례로 happy. 14–18s: 우표 엽서가 올라온다 | "Today's puzzle → link in bio" |
| S2 | **"The most calming 20 seconds of your day"** (만족 ASMR) | 첫 탭부터 완성까지 손떨림 없이 2배속. 등불마다 얼굴이 깨어나고 마지막에 마을 창문이 하나씩 켜진다. 자막 없이 소리만 | "Turn the sound on 🔇→🔊" (첫 프레임) |
| S3 | **"Wick when you put two lanterns in the same row"** | 충돌 순간 두 등불이 서로 바라보며 worried. 하나를 치우면 둘 다 안도의 happy. 끝에 Wick이 카메라를 보며 깜빡 | "Be nice to Wick. Play gently." |
| S4 | **"POV: 9:40 pm, the house is finally quiet"** | 손이 폰을 집는다(손만, 얼굴 없음) → 오늘의 판 → 3분 풀이 압축 → Wick sleepy, 화면이 어두워지며 "Goodnight" | "One puzzle. Then sleep." |
| S5 | **"The only rule you need (10 seconds)"** | 숫자 2 돌, 이웃 4칸 중 2칸만 등불. 틀린 배치(산호색)와 맞는 배치(금색 고리) 비교 → 바로 실전 판 하나 | "Now try today's" |
| S6 | **"Beat my time: 2:41"** (스티치·듀엣 유도) | 화면 구석 타이머 + 풀이 압축 → 엽서에 2:41. 마지막 자막 "Stitch this with your time" | 댓글 "your time 👇" |
| S7 | **"Day 1 vs Day 30 of one puzzle a night"** | 엽서 앨범을 넘긴다: 1일 빈 앨범 → 30일 우표 30장, 연속 기록 Wick 슬롯이 가득 찬다 → 7일 선물 상자 열기 | "Start your streak tonight" |
| S8 | **"A puzzle game that tells you to go to bed"** | 판 완성 → "One more?"가 아니라 Wick이 하품하고 마을 불이 꺼지는 밤 연출 | "Calm games exist." |
| S9 | **"I made a tiny lantern spirit, alone, in Korea"** (개발 이야기, 출시일용) | 코드 경로 7개로 그린 Wick 와이어프레임(목업 01 시트) → 표정 6종이 하나씩 켜진다 → 실제 게임에서 반응 → "Out today" | "Say hi to Wick 🕯️" |
| S10 | **"Comment 1, 2 or 3 — which tile gets the lantern?"** (참여 유도) | 판 위 세 칸에 번호. 4초 정지 → 다음 영상(또는 고정 댓글)에서 정답 공개, 맞힌 댓글을 고정 | 댓글 |

- **반복 운영**: S1·S10은 매주 새 판으로 반복하는 시리즈다. 데일리 번호를 쓰면 "#14, #15…"처럼 연재감이 생긴다.
- **성과 판단**: 4주 뒤 완주율과 프로필 방문 기준 상위 2개 포맷에 비중을 70%까지 몰아준다.

### 게시 템플릿 (영어 원문, 사용자가 직접 게시)

**T1. Reddit r/puzzles (홍보가 아니라 퍼즐 자체)**
```
Title: Lantern logic puzzle — place lanterns so every tile is lit (7×7, one solution)
Body:
Rules: a lantern lights its row and column until a stone blocks it. Lanterns can't see each other.
A numbered stone touches exactly that many lanterns (up/down/left/right).
No guessing needed. [image of today's unsolved board]
Answer in spoiler tags tomorrow.
```
- 게임 이름은 묻는 사람이 있을 때만, 서브 규칙이 허용하는 범위에서 댓글로 밝힌다.

**T2. 페이스북 그룹 (관리자 허락을 받은 뒤)**
```
Hi all — admin said it's OK to share this once. I'm a solo developer and I made a quiet
daily puzzle called Duskwick. Everyone gets the same lantern puzzle each day, it takes
about 3–5 minutes, no lives, no timers on screen. Today's is free to play in the browser:
humsleep.github.io/duskwick  (no download needed)
If you try it, I'd love to see your result line 🌒
```

**T3. Pinterest 핀 (오늘의 판 이미지 + 인쇄용)**
```
Title: Printable Lantern Logic Puzzle #14 — calm brain game for adults
Description: One puzzle, one answer, no guessing. Light every tile with lanterns.
Print it or play it free online. New puzzle every day. #logicpuzzle #brainteaser #printablepuzzle
Link: humsleep.github.io/duskwick?ct=pin
```

**T4. Instagram·Facebook 페이지 데일리 게시**
```
Duskwick #14 🌒  Can you light the whole street tonight?
Swipe → rules in one picture.
Answer + Wick's reaction tomorrow in stories.
Play free: link in bio
```
- 캐러셀 구성: ① 풀기 전 판 ② 규칙 한 장 ③ 어제 정답 + Wick happy

**T5. 크리에이터·기자 피칭 (DM·이메일, 짧게)**
```
Subject: A tiny lantern spirit + one calm logic puzzle a day (solo dev, iOS, [date])
Hi [name] — I loved your video on [specific video]. I'm a solo developer in Korea and I made
Duskwick: a daily lantern logic puzzle where a little spirit, Wick, lives in every lantern you
place and reacts without words. No lives, no timers, VoiceOver support.
15-second clip: [link]  ·  Free web puzzle: [link]  ·  TestFlight / promo code: [code]
Embargo [date]. No obligation to cover — happy to answer anything.
```

---

## 5. 사용자 결정 / 다른 역할에 넘기는 것

- [ ] 목표를 "W8 정착 DAU ≥ 250"으로 바꾸고 "1개국 1위"는 선택형 이벤트로 낮출지 결정 (§0-5)
- [ ] 마케팅 시간 상한 주 6시간 (§2-4)
- [ ] SNS·Reddit·Pinterest 계정 개설, 사전 주문 설정, 피처링 지명 → **사용자 직접**
- [ ] 출시 전 구현 묶음 P-1, 2, 3, 4, 7, 8, 9 (약 11~16일) → Frontend / Mobile App Builder
- [ ] Wick 실제 구현이 모든 콘텐츠의 선행 조건 → UI Designer (BENCHMARK-CUTE 단계 1~4)
- [ ] 영어 자막·템플릿 원어민 검수 (AI 번역만으로는 부족)
- [ ] "데일리 중 광고 없음" 문구를 써도 되는지는 출시 광고 구성으로 확인 (ads-plan B) → Reality Checker
- 미확인: Apple 차트 공식과 사전 주문 가중치, 초소형국 1위 실제 문턱, TikTok 프로필 링크 조건, r/iOSGaming·r/CozyGamers 현행 규칙, Thinky Games 등재 절차, cozy 크리에이터의 광고 앱 수용도

---

## 출처

- [G1] Wordle, NYT 기사 재게재(Boston.com, 2022-01-04): https://www.boston.com/news/national-news/2022/01/04/he-made-wordle-for-his-partner-now-its-an-online-hit/ · 정리: https://en.wikipedia.org/wiki/Wordle
- [G2] Morning Consult, Wordle 이용자(2022-01): https://pro.morningconsult.com/instant-intel/wordle-millennials
- [G3] CivicScience, Wordle 이용자 2/3 여성: https://civicscience.com/about-10-of-u-s-adults-have-tried-playing-wordle-but-not-everyone-l-o-v-e-s-it/
- [G4] Clues by Sam: https://en.wikipedia.org/wiki/Clues_By_Sam (삭제 토론 중인 문서) · Aftermath: https://aftermath.site/clues-by-sam-wordle-daily-puzzle-game/ · Meowdoku 하트 3개(Pocketables 리뷰): https://pocketables.com/2026/06/meowdoku-beat-me-in-the-most-annoying-way.html
- [G5] LinkedIn 게임: https://techcrunch.com/2024/03/16/linkedin-wants-to-add-gaming-to-its-platform/ · https://www.mediapost.com/publications/article/395705
- [G6] Queens 복제 앱 예: https://apps.apple.com/us/app/queens-logic-puzzles/id6756427911
- [G7] Meowdoku App Store(평점 33.6만, 4.8): https://apps.apple.com/us/app/meowdoku/id6761760135
- [G8] Felix Braberg, Meowdoku(Sensor Tower 750만 DL·DAU 170만, 광고 구조): https://felixbraberg.substack.com/p/meowdoku-segments-users-ad-experience
- [G9] Gamigion, Meowdoku 하루 $20만 광고 매출·하루 40만 DL·Oakever UA 하루 $50만(추정): https://www.gamigion.com/meowdoku-makes-200k-a-day-fully-from-ads/
- [G10] Sett, Meowdoku 60일 만에 DAU 200만·소재 1만 개: https://www.sett.ai/content/meowdoku-2m-dau-pure-ad-revenue/
- [G11] App Store RSS 직접 조회(2026-10-17), 퍼즐 장르 7012·게임 6014: `https://itunes.apple.com/{us,gb,ca,au,nz,ie,is,lu}/rss/topfreeapplications/limit=100/genre=7012/json`
- [G12] Block Blast: https://maf.ad/en/blog/block-blast/ · 학생 기사(일화): https://camasonian.com/19858/uncategorized/having-a-blast-mobile-game-takes-chs-students-by-storm/ · TikTok 협업(2026): https://www.businesswire.com/news/home/20260320788327/en/Block-Blast-Brings-Its-Relaxing-Mobile-Play-Experience-to-TikTok-US-Super-Wish-Season
- [G13] NYT Pips 출시: https://www.nbcdfw.com/entertainment/the-scene/pips-newest-new-york-times-game/3905862/ · https://ny1.com/nyc/all-boroughs/the-rush-hour/2025/08/29/new-york-times-puzzle-editor-launches-new-game
- [G14] Pew Research, Social Media Fact Sheet(2025 조사): https://www.pewresearch.org/internet/fact-sheet/social-media/
- [G15] Pinterest 성별(Statista, DataReportal 인용): https://www.statista.com/statistics/248168/gender-distribution-of-pinterest-users/
- [G16] YPulse cozy: https://www.ypulse.com/newsfeed/2025/04/07/cozy-gaming-is-truly-benefitting-young-players-mental-health/ · CreatorDB(제3자 추정): https://creatordb.app/creatorstats/cozy.games · r/CozyGamers 규모: https://gummysearch.com/r/CozyGamers
- [G17] Sensor Tower, 1위에 필요한 다운로드(2019): https://sensortower.com/blog/app-downloads-to-number-one · 2022 갱신: https://techcrunch.com/2022/06/02/new-report-examines-the-number-of-downloads-it-takes-to-hit-the-top-of-the-app-store/ · Distimo(소국 문턱): https://www.adweek.com/performance-marketing/distimo-reveals-downloads-top-ranked-free-app-ios/
- [G18] Apple, 사전 주문 분석: https://developer.apple.com/help/app-store-connect-analytics/acquisition/pre-orders · Appfigures(출시일 1위와 사전 주문): https://appfigures.com/resources/insights/20230421 · Sonar(효과 미검증 견해): https://trysonar.app/blog/app-store-pre-order-ios
- [G19] 피처링 지명(2024-11): https://techcrunch.com/2024/11/13/apple-now-lets-app-developers-apply-to-be-featured-on-the-app-store
- [G20] Apple, 인앱 이벤트: https://developer.apple.com/help/app-store-connect/offer-in-app-events/offer-in-app-events
- [G21] Apple TestFlight: https://developer.apple.com/testflight/
- [G22] App Review Guidelines 5.6.3: https://developer.apple.com/app-store/review/guidelines/ · 2021 개정 해설: https://techcrunch.com/2021/06/07/apples-new-app-store-guidelines-aim-to-crack-down-on-fraud-and-scams
- [G23] r/iOSGaming 개발자 홍보 중단 공지(미러, reddit.com에서 재확인 필요): https://redlib.groet-infra.nl/r/iOSGaming
- [G24] Apple, 캠페인 링크(pt·ct·mt, Smart App Banner): https://developer.apple.com/help/app-store-connect-analytics/acquisition/campaign-links
- [G25] Apple Games 앱·Challenges(2025-06): https://www.apple.com/ca/newsroom/2025/06/introducing-the-apple-games-app-a-personalized-home-for-games
- [G26] Thinky Games: https://thinkygames.com/about/
- 내부: v4 매출 재계산(하루 설치 ↔ 월 매출, W8·W21 판정), BENCHMARK-CUTE §3(Wick 규칙, 엽서), `games/lanterns-pips/share.ts`(공유 문구에 링크 없음 확인), `playtest/ANALYSIS-r4.md`·`r5.md`(웹 데일리가 생기면 링크를 넣는다는 기존 결정)
