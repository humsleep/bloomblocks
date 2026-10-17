# Duskwick 귀여움 방향 벤치마크와 스펙 (2026-10-17)

방향과 스펙만 담았다. 프로덕션 코드는 고치지 않았다. 다른 에이전트가 지금 렌더 루프를 수정하고 있기 때문이다.
목업은 `playtest/shots/cute-mock/`에 있고, `node playtest/cute-mock/render.mjs`로 다시 만들 수 있다.

## 0. 한 줄 판정

**v10은 "잘 만든 인디 분위기 앱"이다. "대형 스튜디오의 1위 무료 앱"은 아니고, 귀엽지도 않다.**
- 귀여움 점수는 약 2/10이다. 귀여운 요소는 지붕 위 검은 고양이 실루엣과 화분 두 개뿐이다.
- 상위 앱과의 차이는 디테일 부족이 아니다. **감정을 실어 나르는 캐릭터가 하나도 없다.**
  - 상위 캐주얼 앱은 거의 모두 캐릭터 하나에 감정을 몰아 준다: 성공하면 기뻐하고, 위기에는 긴장하고, 튜토리얼에서는 가르친다.
  - Duskwick은 같은 일을 링, ✕, 알약 칩, 아이콘으로 한다.
- **제안: 등불 정령 "Wick(윅)" 하나를 세운다.** 브랜드 이름(Dusk**wick**)에 이미 들어 있는 캐릭터다.
  - 보드에 놓는 모든 등불 안에 Wick이 산다. 그래서 퍼즐 피드백(놓기, 충돌, 완성)이 곧 캐릭터의 연기가 된다.
  - 별도 연출 레이어를 얹는 방식이 아니다. 핵심 오브젝트 자체가 표정을 갖는다.
- 비용은 Canvas 2D Path2D 경로 7개와 얼굴 조합뿐이다. 비트맵이 없고, 첫 프레임 경로에도 들어가지 않는다.

---

## 1. 벤치마크

### 1.1 대상과 근거 수준

- **시장**: 미국 퍼즐 다운로드 상위는 Block Blast!가 압도적이다. 2025년 4분기 iOS 주간 다운로드는 37만 → 85만, WAU는 1,210만 → 1,450만이다. 같은 시기 상위 5위에는 Jigsolitaire, Magic Sort!, Pixel Flow!, Word Search Explorer가 있다 [S1].
  - 실시간 App Store 차트는 이번에 직접 조회하지 못했다. 위 순위는 Sensor Tower 블로그 요약(AI 작성 표기)이다.
- **타깃**: 미국과 영국에서 퍼즐 게이머의 약 75%가 여성이고, 대체로 35세 이상이다 [S2][S3]. 여성의 62%가 퍼즐을 플레이한다(남성 39%) [S4].
  - 대부분 2019–2020년 자료이거나 2차 인용이므로 방향성 근거로만 쓴다.
- **캐릭터 근거 (가장 직접적인 것)**
  - Playrix는 Gardenscapes의 집사 Austin을 처음부터 "**30세 이상 여성이 매력적으로 느낄**" 약간 귀족적인 인물로 설계했다고 밝혔다. Austin은 인스타그램 계정도 따로 운영한다 [S5].
  - 타깃과 캐릭터를 직접 연결한 1급 사례다.

### 1.2 게임별 추출

| 게임 | 캐릭터 사용 | 팔레트·조명 | UI 크롬 | 손맛·보상 | 어른용 귀여움 장치 | 근거 |
|---|---|---|---|---|---|---|
| Royal Match | King 초상화가 플레이를 **지켜보다가 질 것 같으면 긴장**한다(반응 채널 1개). 이야기 속 왕이 꾸미기 메타를 이끈다 | 고채도 원색, 조각마다 베벨·AO | 굵은 테두리, 두꺼운 립 버튼 | 자원이 **획득 위치에서 보관 위치로 날아간다**. 과제 완료를 열 때 다시 애니메이션으로 보여 준다. 연쇄 중에도 입력을 받는다. 햅틱 | 애니메이터 채용 공고에 "캐릭터 감정과 피드백이 즉시 읽혀야 한다"는 요구가 있다 | [S6][S7][S8] |
| Gardenscapes / Homescapes | 집사 Austin이 온보딩, 스토리, 마케팅, SNS를 모두 맡는다(1인 얼굴) | 따뜻한 오후 햇빛, 정원 | 둥근 패널, 리본 헤더 | 꾸미기 선택 → 공개 연출 | 30세 이상 여성용으로 설계한 "약간 귀족적인 집사" | [S5] |
| Candy Crush | Tiffi가 통과하면 기뻐하고 3별이면 매우 기뻐하며 실패하면 운다. Mr. Toffee가 튜토리얼과 레벨 소개를 맡는다 | 사탕 원색 | 젤리 버튼 | "Sugar Crush!" 음성과 글자, 남은 수를 보너스로 바꾸는 연출 | 역할을 분리한다(반응 = 주인공, 안내 = 보조) | [S9] |
| Cats & Soup | 고양이 다수(수집 대상)가 일하는 모습이 곧 화면이다 | 동화책풍, 따뜻한 일러스트 | 둥근 카드 | 5분 돌봄, 앱을 닫아도 진행된다 | 6천만 다운로드, App Store 4.9. 저압박 | [S10] |
| Neko Atsume | 고양이마다 작은 디테일 하나로 개성을 준다. 디테일이 적은 것이 오히려 귀여움을 만든다 | 낮은 채도 파스텔 | 극단적으로 단순 | 다시 와 보면 고양이가 다녀가며 남긴 선물 | "고양이 키우기 시뮬레이터"라는 정확성. 바쁜 엄마들의 짧은 탈출 | [S11][S12] |
| Two Dots | 미니멀에서 출발해 캐릭터 Amelia·Jacques와 일러스트 세계로 확장했다 | 테마별 팔레트이지만 정체성은 하나 | 점, 원 | 사각형 폭발과 색 범람 | 리뷰는 캐릭터가 단순함을 해친다고 비판한다 → **캐릭터는 보드 밖에** 두라는 교훈 | [S13] |
| Monument Valley | Totem은 "친구"라는 말 없이 행동으로 감정을 만든다. 퍼즐 기능도 맡는다 | 미드센추리 일러스트, 과자 색 | 거의 없음 | 세계 구조 변화 = 보상 | 말 없는 동반자 | [S14] |
| Duolingo (비게임 참조) | Duo 재디자인: 기하 도형 + 평면 원근 → 애니메이션과 표정 확장이 쉬워졌다. "귀여움 수치를 올렸다" | 단색 그린 | 두꺼운 립 버튼의 원조 | 표정 상태 기계(대기, 반응, 축하) | 단순한 형태여야 오래 버틴다 | [S15] |
| Tsuki's Odyssey | 토끼 한 마리가 주인공이자 화면 전부다 | 부드러운 손그림 | 최소 | "게임보다 아늑한 엽서 같다" | 시간 게이트를 처벌 없이 쓴다 | [S16] |
| Animal Crossing Pocket Camp Complete | 주민 캐릭터 수집 | 파스텔 야외 | 둥근 말풍선 UI | 꾸미기, 수집 | 유료판(약 $10)이 미국·일본 등에서 유료 1위 | [S17] |
| Good Pizza, Great Pizza | 손님 80–150명이 각자 성격을 가진다 | "일부러 어설픈" 화풍 | 단순 | 손님 반응 = 피드백 | 2024 NYX 캐릭터 디자인 금상 | [S18] |
| Unpacking | 캐릭터 없이 물건이 감정을 전한다 | 픽셀 파스텔 | 거의 없음 | **폴리 14,000개**, 물건마다 집기·놓기 소리. 2022 GDCA 오디오상 | 소리가 촉감을 만든다 | [S19] |
| Alba | 소녀 1명 + 동물 | 지중해 햇빛 | 손그림 | 사진 수집, 섬 회복 | "느긋한 수집"을 메시지보다 앞에 둔다 | [S20] |
| Block Blast / Sudoku.com / Wordscapes / Travel Town | 앞의 셋은 캐릭터가 없다. Travel Town은 캐릭터 50명 이상 | 밝은 원색 / 흰색 / 사진 배경 | 공통: 큰 라운드 버튼, 시스템적인 간격 | 블록 폭발 / 미세 체크 애니메이션 | 캐릭터 없이 1위를 하는 장르(블록, 숫자)도 있다. 다만 그 장르의 무기는 **속도와 명료성**이다. Duskwick의 무기(분위기, 마을, 데일리)는 캐릭터 쪽에 가깝다 | [S1][S21] |

### 1.3 공통 원리 (Duskwick에 옮길 것)

1. **캐릭터는 하나, 반응은 즉시.**
   - Royal Match의 왕, Candy Crush의 Tiffi, Gardenscapes의 Austin은 모두 "한 명이 지켜보고 반응한다"는 구조다.
   - 캐릭터 수가 아니라 **반응의 일관성**이 정을 만든다.
2. **보드는 깨끗하게, 캐릭터는 가장자리에.**
   - Two Dots 리뷰가 캐릭터를 비판한 것은 캐릭터가 단순함을 침범했을 때다.
   - Duskwick은 예외가 하나 있다. 등불이 원래 보드 위 오브젝트이므로, **눈과 볼 2요소만** 허용한다.
3. **귀여움 = 아기 도식 + 절제.**
   - 큰 머리, 낮은 위치의 큰 눈, 둥근 볼은 귀엽다는 판단과 돌봄 동기를 높인다 [S22].
   - 어른용은 Neko Atsume식 절제다: 입 없음, 디테일 최소, 말풍선 없음.
4. **보상은 "날아가서 쌓인다".**
   - 자원이 획득 지점에서 보관 지점으로 날아가고, 수집품(우표, 스티커, 이웃)이 남는다.
   - 다시 열고 싶은 물건(엽서 앨범)을 만든다.
5. **소리가 촉감이다.** Unpacking은 폴리 14,000개, Duskwick은 펜타토닉 합성이다. 캐릭터 소리 1세트만 더하면 된다.
6. **햅틱은 원인-결과 1:1.** Apple HIG는 각 햅틱이 특정 행동과 분명한 인과로 묶여야 한다고 말한다 [S23].

### 1.4 "대형 스튜디오"로 읽히는 신호 체크리스트

| 신호 | v10 | 목표 |
|---|---|---|
| 캐릭터 1명 + 표정 세트(6종 이상) + 사용 규칙 문서 | 없음 | Wick 시트(§3.2) |
| 모서리 반경 스케일 1개(예: 12/22/28/알약) | 26u 패널, 0.14cs 칸, 원형 버튼이 섞여 있음 | §3.3 |
| 아이콘 패밀리 1개(획, 끝 처리, 그리드) | 4문법이 섞임(BENCHMARK-VISUAL §1.4) | 2.6pt 둥근 획, 24pt 그리드 |
| 눌리는 버튼(립, pressed 상태) | 평면 원판 + 금색 테두리 | 립 4pt → 눌림 1pt |
| 모션 곡선 3–4종으로 통일 | easeOutBack 1종 + 제각각 | §3.5 토큰 |
| 서체 1패밀리 | SF Rounded + 시스템 산세리프 | Fredoka(라틴 숫자·캡션) + 시스템 CJK |
| 시스템 대화상자 노출 없음 | UMP 흰 기본 창 | AdMob 메시지 스타일 지정 |
| 보상 물건화(공유하고 싶은 카드) | iOS 시트 | 엽서(§3.6) |
| 스토어 1장 = 캐릭터 + 감정 + 큰 캡션 | 세트 없음 | §3.9 |

---

## 2. v10 냉정 비평 (화면별, 1–10 = "1위 무료 앱 + 귀여움" 기준)

근거: `playtest/shots/v10/*.png` (Pro Max 1320×2868, SE).

| 화면 | 점수 | 잘된 점 | 기준에 못 미치는 점 |
|---|---|---|---|
| 플레이 중 (pm-01-mid) | **6.5** | 빛 모델, 돌판 재질, 액자형 등불, 집 파사드로 v8보다 확실히 좋아졌다 | 감정을 가진 존재가 없다. 숫자 돌은 여전히 "달걀 + 시스템 숫자"다. HUD 원판은 평면 + 금색 테두리(힌트만 금색)다. 상단 15%가 빈 하늘이다. 귀여움 1/10 |
| 충돌·막힘 (pm-03-over-stuck) | **5.5** | 코랄 링 + 실선으로 "이 돌이 원인"이라는 정보는 맞다 | `−🏮` 알약 칩이 암호 같다. ✕ 별표가 깨진 유리처럼 보인다. 걱정을 **표정으로** 말하면 글 없이 즉시 읽힌다 |
| 탑 (pm-02-tower-floors) | **6.0** | 층 표시기, 실루엣 | 화면의 40%가 어둡고 무거운 탑이다. 목표 층에 보상의 얼굴이 없다 |
| 결과 시트 (pm-06b) | **4.5** | 정보는 정확하다 | 남색 iOS 시트 위에 아이콘 수프(달력, 시계, ✨, 🔥, 리본 등불 2개, 점 30개 띠)가 있다. 축하하는 주체가 없다. 공유 버튼만 금색 링이다. 간직하고 싶은 물건이 아니다 |
| 7일 선물 (pm-08) | **4.0** | 마일스톤 개념 | "등불 7, 달 원판, 모래시계"가 컨테이너 없이 하늘에 떠 있어 디버그 오버레이처럼 보인다. 선물의 언박싱 순간이 없다 |
| 마을 (pm-07-town) | **6.0** | 분위기, 원근, 창 불빛 | 화면 위 50%가 빈 하늘이다. 살아 있는 것은 실루엣 고양이 2마리뿐이다. 수집하는 즐거움이 없다 |
| 거리 들르기 (pm-04) | **5.0** | 랜드마크 개념 | 분수가 와이어프레임처럼 보인다. 왼쪽 집이 잘렸다. 텅 빈 광장 |
| 설정 (pm-10) | **4.0** | 7개 언어 캡션, 큰 터치 영역 | 금색 테두리 세그먼트 격자가 개발자 패널처럼 보인다. 숫자/점 선택 미리보기가 달걀이다 |
| 확인 카드 (pm-07 soft ask, pm-12) | **5.5** | 기본 버튼 대비가 좋다 | 시스템 서체를 쓴다. 종·시계 아이콘이 세계와 무관하다. 부탁하는 주체가 없다(→ Wick이 졸린 얼굴로 묻게 한다) |
| 밤 연출 (pm-09) | **5.0** | 조용한 마무리 | 화면을 어둡게만 한다. 잠드는 존재가 없다(→ Wick sleepy) |
| 온보딩 (v8 가이드 손가락) | **5.0** | 글 없는 교수법 | 흰 장갑 손가락 클립아트 |
| 아이콘 (docs/icon) | **6.5** | 게임 속 등불과 같은 물건 | 캐릭터 얼굴이 없어 스토어 격자에서 기억에 남지 않는다. 상위 캐주얼 아이콘은 대부분 얼굴이 있다 |

**평균 약 5.3. 귀여움 축만 보면 약 2.**
- 장인정신(빛, 재질)은 7에 근접했다.
- "1위 앱"과의 남은 격차는 거의 **캐릭터, UI 크롬, 보상 물건화** 세 가지에서 나온다.

---

## 3. 방향: "Wick — 등불 속에 사는 작은 정령"

### 3.1 후보와 선택

| 후보 | 장점 | 단점 | 판정 |
|---|---|---|---|
| **A. Wick (등불 정령)** | 브랜드명과 일치한다. 등불 = 캐릭터라서 퍼즐 피드백이 곧 연기가 된다. 팔다리가 없어 Canvas로 그리기 가장 쉽다. 보드 등불 크기(약 40pt)에서도 눈 두 개로 읽힌다 | 불꽃 캐릭터는 Calcifer(지브리)를 연상시킬 위험이 있다 → §3.2 차별화 규칙으로 막는다 | **채택** |
| B. 점등원 고양이 "Mochi" | 대중 호감이 가장 높다(Neko Atsume, Cats & Soup) | 고양이 게임 포화. 퍼즐 메커닉과 무관하다. 팔다리와 포즈가 필요해 절차적 제작 비용이 3–4배다 | **조연으로 채택**: 마을 이웃 고양이 6종 |
| C. 장밋빛 단풍나방 "Lumi" | 분홍·노랑 털 파스텔이 유행이고, 등불에 끌린다는 서사가 자연스럽다 | 곤충 거부감. "불나방" 죽음 연상. 털 질감은 절차적으로 만들기 어렵다 | 기각 |
| D. 반딧불 무리 | 이미 피날레에 있다 | 표정을 담을 크기가 아니다 | 입자로 유지 |

**A를 고른 이유**
- 귀여움을 "추가 장식"이 아니라 **기존 피드백의 대체재**로 쓸 수 있는 유일한 후보다.
- 충돌 ✕ → 서로 바라보며 걱정, 완성 웨이브 → 차례로 웃는 얼굴, 힌트 → 갸웃.
- 그래서 화면 요소 수는 오히려 줄어든다.

### 3.2 마스코트 시트 (`shots/cute-mock/01-mascot-sheet.png`)

**형태 언어**
- 둥근 찹쌀떡 물방울(아래가 넓고 위가 부드럽게 뾰족함) + 머리 위 심지 불꽃 한 가닥(오른쪽으로 말림).
- 직선 없음, 각 없음, 팔다리 없음. 환호할 때만 작은 돌기 두 개가 생긴다.

**구성 (100×100 박스, 지면 접점 50,92)**
- 형태 경로는 `playtest/cute-mock/wick.js`의 `P`이고, `src/render/wick.ts`에 Path2D 상수로 그대로 옮긴다.
- 경로
  ```
  body  M50 27 C57 35 82 45 82 66 C82 83 68 92 50 92 C32 92 18 83 18 66 C18 45 43 35 50 27 Z
  wisp  M50 31 C42 25 43 13 55 6 C52 14 59 19 55 28 C53 30 51.5 31 50 31 Z
  sheen M29 62 C29 51 37 44 44 42.5 C38.5 48 35.5 54 35.5 62 Z
  armL  M24 60 C14 54 10 44 15 41 C19 39 25 47 29 55 Z   (환호와 손 흔들기 때만, armR은 좌우 대칭)
  ```
- 몸: 방사형 그라디언트 (0.44, 0.58, r 0.62): `wickCore #FFFBEF` → 0.55 `wickBody #FFEFC9` → `wickRim #F2C27A`. 테두리 1.2u `wickRim`.
- 불꽃: 선형 그라디언트 `#FFB84D` → `#FFE7A0`.
- 후광: r 48, `#FFD98A` 55% → 0. 그림자: 타원 rx 23, ry 3.6, `#0A081E` 35%.

**얼굴 (눈 y 65, 간격 20, 볼 y 73)**

| 표정 | 눈 | 입 | 몸 변형 | 쓰임 |
|---|---|---|---|---|
| idle | 타원 rx3.4 ry4.6 `wickInk #3B2C45` + 하이라이트 r1.25 | 없음 | — | 기본. 3.5–6 s마다 90 ms 깜빡임 |
| happy | ∩ 호 (±4.6, 높이 5.6, 획 2.8) | 작은 미소 호 | — | 놓기 성공, 완성 웨이브 |
| curious | 크기가 다른 두 타원, 시선 오프셋 ≤2u | o (r1.8) | 회전 −8° | 힌트, 새 돌 등장, 처음 보는 판 |
| sleepy | ∪ 닫힌 호 | 작은 선 | sx 1.05, sy 0.94. 불꽃 0.62배, 75% | 밤 연출, 알림 제안, 휴식 카드 |
| cheer | 큰 ∩ 호 (획 3) | D자 열린 입 + 혀 `#F08F95` | 늘이기 0.94/1.08, 위로 5u, 돌기 2개, 불꽃 1.25배 | 완성, 데일리, 마일스톤 |
| worried | 작은 원 r2.9, 옆을 봄 | 물결선 | 안쪽 눈썹이 올라간 사선 2개 | 충돌, 초과(보드 등불 전용) |

- 볼: 타원 rx5.6 ry3.1 `wickBlush #F7A3A0`, 표정별 불투명도 50–95%.

**보드 등불 얼굴 (`lanternFace`)**
- 아이콘 등불 종이면 중앙에 눈(43/57, 56)과 볼만 그린다. **입은 쓰지 않는다**(걱정의 물결선만 예외).
- 눈 rx 2.5 ry 3.3 = 0.05cs. cs 36pt에서 약 1.8pt × 3배율 = 5px로 판독 가능하다.

**크기 (pt)**
- 히어로 96, 안내·HUD 72, 엽서 우표 48–64, 스트릭 슬롯 26, 보드 등불 = 기존 등불 크기.

**사용 규칙 (어른용 절제)**
1. 글로 말하지 않는다(말풍선 없음). 감정은 눈, 몸, 불꽃 크기로만 전한다.
2. 한 화면에 큰 Wick(히어로)은 하나만 둔다. 보드 등불 얼굴은 히어로로 세지 않는다.
3. 기본은 입 없음. 입은 happy, cheer, curious, worried에만 짧게 쓴다.
4. 대기 중에는 깜빡임과 ±1.5pt 숨쉬기만 한다. 혼자 뛰어다니지 않는다.
5. **Calcifer와 차별화**: 몸은 불꽃이 아니라 크림색 떡이다. 불꽃은 머리 위 작은 심지뿐이다. 이빨과 주황·빨강 몸은 금지한다.
   - 테스트 질문: "무엇이 떠오르나요?" 3–5명 중 1명이라도 Calcifer라고 답하면 몸 비율(폭/높이)을 1.05 → 1.15로 더 납작하게 한다.
6. 설정에 "등불 얼굴" 토글을 둔다(기본 켜짐). 보드 가독성이나 취향 때문에 끌 수 있게 한다. 큰 글자·대비 모드에서도 얼굴을 유지한다.

### 3.3 UI 키트

**버튼, 패널, 형태**

| 요소 | 스펙 |
|---|---|
| 기본 버튼 | 알약 h 52–60, 면 `primary #FFC864`, 아래 립 4pt `primaryLip #D9983F`, 위쪽 30% 하이라이트 띠(흰색 28%), 그림자 0 6 14 rgba(10,8,30,.25). 글자·아이콘 `ink #3B2C45` (대비 8.4:1) |
| 눌림 | 면이 +3pt 내려가고 립이 1pt가 된다. 90 ms 누름 / 180 ms 복귀(§3.5) |
| 보조 버튼 | 면 rgba(255,243,222,.08) + 2pt 테두리 rgba(255,243,222,.40), 립 없음, 글자 `cream` |
| 아이콘 원판 | 지름 52–54(탭 영역 ≥ 44 충족), 면 `sheetHi #3A3468`, 립 4pt `lip #1E1A3D`, 좌상단 호 하이라이트 22% |
| 아이콘 패밀리 | 24pt 그리드, 2.6pt 둥근 끝·둥근 이음, `cream`. 강조 점 하나만 `primary`(힌트 남음, 집 창문) |
| 시트 | 반경 28, `sheet #2C2752` → 위 `sheetHi` 그라디언트, 위쪽 1pt 안쪽 하이라이트 8%, 그림자 0 12 28 rgba(8,6,20,.45) |
| 종이 카드 (보상, 엽서, 확인 카드) | 반경 22–24, `paper #FFF3DE`, 안쪽 2pt 점선 `#E8D4B8`, 글자 `ink` (11.7:1) |
| 칩 (달력 등) | 반경 12, 종이 + 2–4pt 립 `paperLo #F3DFC2` |
| 반경 스케일 | 12 (칩·칸 14) / 22 (카드) / 28 (시트) / h/2 (버튼) |
| 그림자 단계 | e1 0 2 6 .30 · e2 0 6 14 .35 · e3 0 12 28 .45. Canvas에서는 **베이크할 때만** shadowBlur를 쓴다(프레임마다 쓰지 않음) |

**서체**
- **Fredoka 600** (OFL, `public/fonts/fredoka-latin-600-normal.woff2` 16 KB가 이미 있다. 런타임에는 아직 쓰지 않는다)을 숫자, 문패, 시간, 라틴 캡션에 쓴다.
  - 크기: 디스플레이 34/40, 제목 22/28, 본문 17/24, 캡션 13/18.
- CJK는 시스템 서체로 fallback한다.
- 선택: 한국어 Jua(OFL), 일본어 Zen Maru Gothic(OFL)을 **UI 문자열에 쓰인 글자만 서브셋**해서 각 30–60 KB로 지연 로드한다(`pyftsubset --text-file`).
- 돌 숫자도 SF Rounded → Fredoka로 바꾼다. iOS, Android, 웹 데일리가 같은 글리프가 된다.

### 3.4 색 토큰 (`palette.ts`에 `UI` 객체로 추가하고, 기존 보드 휘도 설계는 유지)

| 토큰 | 값 | 용도 / 대비 |
|---|---|---|
| sheet / sheetHi / lip | #2C2752 / #3A3468 / #1E1A3D | 시트, 원판. cream 글자 12.6:1 / 10.2:1 |
| paper / paperLo | #FFF3DE / #F3DFC2 | 종이 카드, 칩 |
| ink / inkSoft | #3B2C45 / #7A6A86 | 종이 위 글자 11.7:1 / 4.5:1(캡션만) |
| primary / primaryLip | #FFC864 / #D9983F | 기본 버튼 (ink 8.4:1) |
| cream | #FFF3DE | 어두운 면 위 글자, 아이콘 |
| wickBody / Core / Rim / Blush / Ink | #FFEFC9 / #FFFBEF / #F2C27A / #F7A3A0 / #3B2C45 | 마스코트 (눈 대 몸 11.3:1) |
| pink / mint / lilac / lemon | #F6A7B8 / #A8DCC8 / #C9B6F0 / #FFE59A | 꽃잎 색종이, 줄등, 수집 변형, 커튼. **정보 색으로는 쓰지 않는다** |
| skyMauve / skyRose / skyPeach | #7A5A8E / #D9909E / #F6BFA2 | 하늘 중간~지평선을 v10(#C97B84)보다 한 단계 파스텔로 |
| hillFar / hillMid / hillNear | #8A6A9E / #5F4A7E / #3B3263 | 언덕을 연보라 쪽으로 |

**지켜야 할 것**
- 보드 바닥(L 0.024–0.029)과 밝힌 칸(L ≥ 0.27)의 밝기 차 설계, 그레이스케일 CI는 그대로 둔다.
- **함정 (목업 작업 중 발견)**: 만족한 돌의 숫자를 금색 `#D99A3F`로 칠하면 창백한 돌 위에서 **1.5:1**로 읽히지 않는다.
  - 만족 상태는 숫자를 ink(8.1:1)로 유지한다.
  - 대신 돌 테두리 2.6pt `primary` 링 + 새싹 두 잎으로 표시한다.
  - 지금 v10의 "금색 숫자 + 갈색 외곽선"도 같은 이유로 다시 점검해야 한다.

### 3.5 모션 스펙

**공통 곡선**
- `easeOutCubic`(입장), `easeInCubic`(퇴장)
- `easeOutBackSoft` (c1 = 1.2, 오버슛 약 6%): 버튼, 등불, 우표
- `easeOutBack`(기존 12%): 히어로 Wick 착지에만
- `sineInOut`: 대기 숨쉬기

**차분함 규칙**
- 오버슛 ≤ 8%(히어로만 12%). 같은 동작이면 일반 캐주얼보다 1.2–1.5배 느리게. 화면 흔들기 금지.

| 이벤트 | 연출 | 시간·곡선 |
|---|---|---|
| UI 탭 | 면 +3pt, 립 4→1, scale 0.96 | 누름 90 ms easeOutCubic, 복귀 180 ms easeOutBackSoft |
| 등불 놓기 | −0.3cs에서 떨어짐 → 착지 찌그러짐 1.12/0.88 → 복귀. 착지 +60 ms에 눈을 뜸(idle → happy 400 ms 뒤 idle) | 낙하 140 ms easeInCubic, 찌그러짐 80 ms, 복귀 220 ms easeOutBackSoft. **빛 번짐은 착지 순간 시작**(기존 spreadDelay) |
| 등불 빼기 | 먼저 눈을 감고(60 ms) 0.8배 + 페이드 | 140 ms easeInCubic |
| 충돌 | 두 등불이 서로 쪽으로 6° 기울고 시선 이동, worried. 코랄 링 유지, ✕ 별표는 삭제 | 180 ms easeOutCubic. 해소되면 240 ms 동안 idle로 |
| 초과(돌) | 이웃 등불들이 그 돌을 바라봄(worried) | 180 ms |
| 힌트 | 히어로 Wick curious, 시선이 대상 칸을 향함. 칸에 달빛 고리(기존) | 200 ms |
| 대기 | 히어로 ±1.5pt 숨쉬기 2.4 s, 깜빡임 3.5–6 s 무작위, 불꽃 0.96–1.04 at 0.8 Hz | `ambient()`로 감싼다(frameGovernor 20 fps 허용) |
| 완성 | §3.6 | 약 2.8 s, 탭하면 스킵 |
| Reduce Motion | 낙하, 기울기, 점프, 꽃잎, 회전 없음. 표정 변화는 120 ms 크로스페이드. 빛 변화는 정보이므로 유지 | — |

### 3.6 보상·축하 시퀀스 (0 = 마지막 번짐 끝)

| 시각 | 연출 | 소리 / 햅틱 |
|---|---|---|
| 0–380 ms | 기존 완성 웨이브. 각 등불이 웨이브 순서대로(35 ms 간격) happy로 바뀌며 1.0 → 1.06 → 1.0 (120 ms) | 기존 아르페지오 |
| +400 | 히어로 Wick cheer 점프: 예비 찌그러짐 120 ms → 상승 18pt 260 ms easeOutQuad(늘이기 0.92/1.10) → 하강 220 ms easeInQuad → 착지 찌그러짐 100 ms → 안착 240 ms easeOutBack | `wickCheer` / 착지에 Light |
| +700 | 기존 피날레: 창문이 하나씩 켜지고 반딧불이 날아간다 | 기존 |
| +1400 | 파스텔 꽃잎 8개(데일리·마일스톤은 16개)가 1.6 s 동안 천천히 흩날림, 4각 반짝이 3개 | — |
| +1800 (데일리) | 엽서가 아래에서 올라옴 420 ms easeOutCubic, 회전 6° → −2° | 종이 스침 |
| +2250 | **우표 찍기**: Wick 우표 scale 1.35 → 1 160 ms easeOutBackSoft, 소인 페이드 | `stamp`(종이 툭 + 차임 1음) / Medium |
| +2450 | 스트릭 슬롯의 새 칸에 작은 Wick이 팝 200 ms(앞 칸들은 sleepy, 오늘 칸은 happy) | `wickHappy` / Selection |
| +2700 | 버튼 페이드 인 200 ms | — |

- 7일째에는 마지막 칸이 선물 상자가 된다. 탭하면 리본이 풀리고 이웃 고양이 1마리가 마을에 합류한다(§3.7).
- 목업: `03-result-postcard.png`.

### 3.7 귀여운 꾸밈 목록 (마을, 골목)

| # | 요소 | 등장 조건 | 제작 |
|---|---|---|---|
| 1 | 이웃 고양이 6종 (크림, 삼색, 회색 줄무늬, 흰 양말 검정, 치즈, 턱시도). 식빵·앉기·잠자기 포즈 | 7일 스트릭 선물, 10판마다 | 경로 3포즈 × 색 6. 목업의 `cat()` 참조 |
| 2 | Wick 친구 (벚꽃, 민트, 라일락, 레몬 색 변형) | 거리 들르기(5·10판) | 같은 경로에 틴트만 |
| 3 | 창가 화분 상자, 커튼(분홍) | 불이 켜진 창마다 | 절차적 |
| 4 | 파스텔 줄등(골목 진행 표시) | 기존 줄등 대체 | 색만 바꿈 |
| 5 | 굴뚝 연기 동그라미 3개 | 상시 | 기존 연기를 둥글게 |
| 6 | 새집 + 작은 새 (깜빡임) | 마을 | 경로 |
| 7 | 바구니 단 자전거 | 마을 15판 | 경로 |
| 8 | 우편함 + 편지 (데일리를 푼 날) | 데일리 | 경로 |
| 9 | 빨랫줄의 파스텔 빨래 | 기존을 파스텔로 | 색만 바꿈 |
| 10 | 분수의 아기 오리 2마리 | 랜드마크 10 | 경로 |
| 11 | 문패 옆 작은 화분, 디딤돌 이끼 | 집마다 | 기존 |
| 12 | "이웃 앨범" 화면 (수집한 고양이, 친구, 엽서) | 마을 버튼 → 탭 | 2일. 경제 시스템 없이 순수 수집 |

### 3.8 햅틱과 사운드 큐

- 햅틱은 Capacitor 프리셋으로 매핑한다.
- 소리는 기존 WebAudio 합성과 D 메이저 펜타토닉 위에 **캐릭터 음성 5종**을 더한다. 사람 말소리는 넣지 않는다.

| 큐 | 소리 설계 | 햅틱 |
|---|---|---|
| UI 탭 | 부드러운 "뽁": 사인 660 Hz, 30 ms, −24 dB | Selection |
| 등불 놓기 | 기존 place + 종이 "포삭"(대역 잡음 2 kHz, 40 ms) | Light (기존) |
| `wickHello` (첫 등장, 안내 시작) | 상승 처프 880 → 1320 Hz, 70 ms, 사인 + 2배음 10% | — |
| `wickHappy` | 펜타토닉 2음(현재 칸 음 + 5도), 각 60 ms | — |
| `wickCheer` | 3음 상승 아르페지오 + 짧은 비브라토 | 착지 Light |
| `wickWorry` (충돌) | 하강 2음(단2도 아님, 펜타토닉 안의 장2도), −22 dB | 기존 불가 틱 2회 |
| `wickSleepy` | 낮은 하행 글리산도 + 숨소리 잡음 | — |
| `stamp` | 저역 "툭"(120 Hz 사인 + 잡음) + 차임 1음 | Medium |

- 음량은 기존 큐보다 −6 dB에 두고, 무음 스위치와 앰비언트 규칙을 그대로 따른다.

### 3.9 스토어 스크린샷 콘셉트 (1290×2796, 6장)

| # | 장면 | 캡션 (EN / KO) |
|---|---|---|
| 1 | 플레이 화면 + 손 흔드는 Wick이 프레임 밖으로 튀어나옴 (`04-store-shot-1.png`) | Light up a tiny town · one calm puzzle a day / 작은 마을에 불을 켜요 |
| 2 | 등불 놓기 순간 클로즈업 (찌그러짐 + 반짝이 + happy) | Wick wakes up in every lantern / 등불마다 윅이 깨어나요 |
| 3 | 충돌한 두 등불이 서로 걱정하며 바라봄 | Gentle hints, never stuck / 막혀도 다정하게 |
| 4 | 엽서와 우표, 7일 스트릭 | A new postcard every day / 매일 한 장, 엽서 모으기 |
| 5 | 이웃 고양이가 모인 마을 | Meet the neighbors / 이웃이 하나둘 |
| 6 | 밤, sleepy Wick + "광고 적게, 10분" | Calm 10-minute evenings / 차분한 10분 |

- 공통 구성: 상단 22% 캡션(Fredoka 600 34pt, 첫 줄 cream, 둘째 줄 primary) + 반경 40 화면 인셋 + 마스코트가 프레임을 뚫고 나옴(평면 화면 캡처와의 차별점).

---

## 4. 구현 계획 (영향 ÷ 노력 순)

- 콜드 스타트 게이트: 첫 페인트 ≤ 1.0 s, 현재 p75 0.38 s.
- 렌더 루프를 수정 중인 에이전트와 겹치는 파일(BoardView, LanternsScene)은 **⚠**로 표시했다. 그 작업이 머지된 뒤에 시작한다.

| 순위 | 항목 | 파일·모듈 | 노력 | 콜드 스타트 |
|---|---|---|---|---|
| 1 | **Wick 렌더 모듈**: Path2D 상수, `drawWick(ctx, size, expr, look)`, `drawLanternFace`, 표정 아틀라스 베이크 | 신규 `src/render/wick.ts` (wick.js를 옮김), `src/game/lazy.ts`에 지연 베이크 등록 | 1일 | 0. 첫 프레임 뒤에 베이크(표정 6 × 크기 3 + 얼굴 4, 3x 기준 추정 5–10 ms) |
| 2 | **보드 등불 얼굴 + 상태 연기** (놓기, 충돌 시선, 초과, 완성 웨이브) | ⚠ `src/game/BoardView.ts`(등불 위 얼굴 스프라이트 1개, 표정 텍스처 교체), `src/render/lantern.ts`(종이면 얼굴 앵커만) | 2일 | 0 (얼굴은 첫 프레임 뒤에 붙임. 전에는 얼굴 없는 등불) |
| 3 | **히어로 Wick** (디딤돌 위): idle, curious(힌트), cheer(완성), sleepy(밤 연출, 알림, 휴식 카드) | ⚠ `src/game/LanternsScene.ts`(stepFinale, onHint, startNight), `src/game/Scenery.ts`(배치), `frameGovernor`의 `ambient()` | 1.5일 | 0. 첫 프레임 400 ms 뒤 "불이 켜지며 나타남"으로 연출해 지연 로드를 숨긴다 |
| 4 | **결과 → 엽서** (종이 카드, 우표, 소인, 스트릭 Wick 슬롯, 7일 선물 상자). 공유 이미지도 같은 카드로 | `src/game/ResultSheet.ts`, `src/game/hudArt.ts`(drawMilestoneLantern, drawGiftChip 대체), `src/render/draw.ts` | 2일 | 0 (결과 시점에 베이크) |
| 5 | **UI 키트** (두꺼운 립 버튼, 시트·종이 카드, 아이콘 획 통일) | `src/render/palette.ts`(UI 토큰), `src/render/draw.ts`(drawPanel/drawSegment/drawHudDisc → drawSheet/drawChunky/drawPaper), `SettingsSheet.ts`(행 목록 + 등불 토글), `AskCard.ts`, `src/ads/breakCard.ts` | 2일 | HUD 원판은 첫 프레임 베이크에 포함 → 같은 수의 텍스처라 ±0 (확인 필요) |
| 6 | **Fredoka 런타임** (숫자, 문패, 시간, 캡션) | `src/main.ts`(첫 페인트 뒤 `new FontFace(...).load()`), `draw.ts` DIGIT_FONT = `"Fredoka", ui-rounded, …`, 로드 완료 시 숫자 돌 텍스처만 1회 재베이크 | 0.5일 | 첫 페인트 0(비차단). 16 KB |
| 7 | **가이드 손가락 → Wick** (Wick이 칸으로 통통 뛰어가 착지하면 탭 물결) | `src/game/Guide.ts`, `draw.ts` drawFinger 삭제 | 2일 | 0 |
| 8 | **소리, 햅틱 큐 5+2종** | `src/audio/types.ts`(CueName 추가), `cues.ts`, `synth.ts`, `src/game/feedback.ts` | 1일 | 0 (첫 제스처 뒤 로드) |
| 9 | **하늘·언덕 파스텔 리프트 + 집 꾸밈**(커튼, 창가 화분, 둥근 창, 연기) | `palette.ts`, `src/render/backdrop.ts`, `src/render/house.ts` | 1.5일 | bake 시간 변화 작음. 그레이스케일 CI 재확인 |
| 10 | **아이콘 A/B**: 등불 종이에 Wick 눈과 볼 | `docs/icon/src`, `npm --prefix apps/client run art` | 0.5일 | — |
| 11 | **마을 이웃 고양이 + 소품 + 이웃 앨범** | `src/town/`, `Scenery.ts`, `src/game/progress.ts`(수집 상태, iCloud KVS 합집합 병합 호환) | 3일 | 마을은 지연 로드라 0 |
| 12 | **스토어 6장** | `tools/sim-shots.ts` + 캡션 합성 스크립트(이 목업 렌더러 재사용) | 1.5일 | — |
| 13 | UMP 메시지 스타일 (배경 sheet, 버튼 primary, 둥근 서체) | AdMob 콘솔 — **사용자 작업** | 0.2일 | — |

- 합계는 약 18–19 에이전트일이다.
- **지금 바로 병렬로 시작할 수 있는 것**: 1, 4, 6, 8, 10 (렌더 루프와 무관).
- **렌더 루프 작업이 끝난 뒤**: 2, 3, 5, 7, 9.

**예상 효과 (판단, 측정 아님)**
- 1–6만으로 화면별 평균 5.3 → 약 7.0, 귀여움 2 → 6–7.
- 결과 화면(4.5 → 7.5)과 플레이 화면(6.5 → 8)이 가장 크게 오른다.

### 검증 게이트

1. 실기기 M1 p75 ≤ 1.0 s (`npm run measure:ios -- m1 20`). 첫 프레임 경로에 Wick·폰트 코드가 없는지 `lazy.ts` import 그래프로 확인한다.
2. `node scripts/idle-movers.mjs`: 새 대기 연출이 모두 `ambient()`로 감싸였는지 확인한다(빠지면 60 fps 유지).
3. 그레이스케일과 CVD 스크린샷: 등불 얼굴이 켜진 칸과 돌의 구분을 방해하지 않는지 본다(`cvd-*` 재촬영).
4. 사람 3–5명 5초 테스트. "무엇이 보이나요 / 누가 떠오르나요(Calcifer?) / 유치한가요" 세 질문을 HANDOFF의 사용자 할 일 6번과 같이 진행한다.
5. 큰 글자, 고대비, Reduce Motion에서 표정이 크로스페이드만 하는지 확인한다.

### 위험

- **유치함**: §3.2 규칙(말풍선 없음, 입 최소, 히어로 1명)과 종이·우표·화분 같은 "어른의 문구류" 소재로 균형을 잡는다. 꽃잎 색종이는 8–16개로 상한을 둔다.
- **보드 가독성**: 얼굴은 눈과 볼만 둔다. 끄기 토글을 둔다. 10×10 deduce에서 꼭 확인한다.
- **IP 유사성**: Calcifer(지브리), Sumikko Gurashi(산엑스)와 비교 검토한다. 이름 Wick은 docs/naming.md의 Wicklight·Lampwick 충돌과 무관한 캐릭터명이지만, 출원할 때 같이 확인한다.
- **목업 한계**: 목업은 방향 확인용이다. 밝힌 칸을 평면 그라디언트로 그렸으므로, 실제로는 v10의 빛 모델(ADD 웅덩이, 돌판 텍스처)을 **그대로 유지**하고 얼굴과 UI만 얹는다.

---

## 5. 산출물

- `playtest/shots/cute-mock/01-mascot-sheet.png`: 구성선, 표정 6종, 크기, 보드 등불 얼굴, 토큰, UI 키트
- `02-play-cute.png`: 플레이 화면(히어로 Wick curious, 등불 얼굴, 만족 돌의 새싹 + 링, 두꺼운 립 HUD, 파스텔 줄등, 지붕 고양이)
- `03-result-postcard.png`: 완성 → 엽서, 우표, 스트릭 슬롯, cheer Wick
- `04-store-shot-1.png`: 스토어 1번 콘셉트
- 생성기: `playtest/cute-mock/{wick.js, scenes.js, mock.html, render.mjs}` (Wick 경로의 정본)

## 출처

- [S1] Sensor Tower 블로그, 2025 Q4 미국 퍼즐 다운로드 상위 5(전체, iOS): https://sensortower.com/blog/2025-q4-unified-top-5-puzzle-games-units-us-64bc1644e1714cfff1e615fc · https://sensortower.com/blog/2025-q4-ios-top-5-puzzle-games-units-us-64bc1644e1714cfff1e615fc
- [S2] PocketGamer.biz, GameRefinery Facebook 장르 보고서(미·영 퍼즐 게이머 약 75% 여성, 35세 이상): https://www.pocketgamer.biz/gamerefinery-facebook-genre-report-august-2020
- [S3] Udonis, Puzzle games report: https://blog.udonis.co/mobile-marketing/mobile-games/puzzle-games-report
- [S4] ESA Global Video Games Report 2025 요약: https://gamedevreports.substack.com/p/esa-global-video-games-report-2025 · WARC/Newzoo: https://www.warc.com/content/article/warc-datapoints/women-prefer-mobile-and-puzzle-gaming/136368
- [S5] Samsung Developers, Playrix Gardenscapes 인터뷰(Austin 설계 의도): https://developer.samsung.com/sdp/blog/en/2022/03/16/playrix-gardenscapespart-1
- [S6] Funovus, Royal Match 분석(왕 초상화 반응, 자원 비행, 과제 애니메이션): https://funovus.com/blogs/royal-match-dominates-match-3-what-can-all-designers-learn
- [S7] This Week in LiveOps, 5 UX lessons from Royal Match: https://thisweekinliveops.substack.com/p/5-simple-ux-lessons-from-royal-match
- [S8] FoxData, Royal Match 실행 분석: https://foxdata.com/en/blogs/games-redefined-match3-with-flawless-execution-and-smart-ua/
- [S9] Candy Crush Saga Wiki, Characters · Sugar Crush: https://candycrush.fandom.com/wiki/Characters · https://candycrush.fandom.com/wiki/Sugar_Crush
- [S10] Cats & Soup 리뷰와 보도자료: https://metaphorsandmoonlight.com/game-review-cats-soup-by-hidea/ · https://gamespress.com/Cats-Soup-Magic-Recipe-Brings-Healing-and-Cozy-Charm-in-US-Launch
- [S11] Nippon.com, Neko Atsume: https://nippon.com/en/nipponblog/m00083
- [S12] A.V. Club(NYT 해설 요약): https://avclub.com/read-this-the-new-york-times-explains-neko-atsume-s-ap-1798244391
- [S13] Y Combinator 블로그(Dots 창업자) · PocketGamer 리뷰: https://blog.ycombinator.com/gaming-studio-founders-patrick-moberg-and-holly-liu/ · https://ee.pocketgamer.com/articles/084194/two-dots-simple-yet-satisfying-puzzle-gameplay/
- [S14] indienova, Monument Valley 2 인터뷰: https://indienova.com/en/indie-game-news/monument-valley-2-interview-eu/
- [S15] Design Week, Duolingo 올빼미 재디자인: https://www.designweek.co.uk/issues/2-6-january-2019/duolingo-owl-receives-makeover-as-app-becomes-more-gamified
- [S16] GameGrin, Tsuki's Odyssey 리뷰: https://www.gamegrin.com/reviews/tsukis-odyssey-review/
- [S17] GameLuster, Pocket Camp Complete 유료 차트 1위: https://gameluster.com/paid-animal-crossing-pocket-camp-complete-tops-mobile-app-charts/
- [S18] Wikipedia, Good Pizza, Great Pizza: https://en.wikipedia.org/wiki/Good_Pizza,_Great_Pizza
- [S19] Audiokinetic, Unpacking 폴리 · Game Developer GDC 2022: https://www.audiokinetic.com/en/blog/unpacking-the-fun-behind-the-foley · https://gamedeveloper.com/gdc2022/auditory-tales-from-the-making-of-zen-puzzler-unpacking
- [S20] Pocket Tactics, Alba 리뷰: https://www.pockettactics.com/alba-a-wildlife-adventure/review
- [S21] Travel Town(Magmatic → Moon Active) 분석: https://www.baijing.cn/article/50355
- [S22] Glocker et al. 2009, Baby schema in infant faces(PMC): https://pmc.ncbi.nlm.nih.gov/articles/PMC3260535/
- [S23] Apple HIG, Playing haptics: https://developer.apple.com/design/human-interface-guidelines/playing-haptics
- 폰트 라이선스: Fredoka OFL(`apps/client/public/fonts/OFL-Fredoka.txt`). Jua, Zen Maru Gothic도 OFL(Google Fonts).

Sudoku.com, Wordscapes, Block Blast의 UI 묘사는 스토어 페이지와 플레이 지식에 근거한 정성 비교다. 이번에 수치를 측정하지는 않았다. 미국 실시간 Top Free 차트는 직접 조회하지 못했다(Sensor Tower 분기 요약으로 대체).
