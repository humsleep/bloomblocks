# R1 — ASO·현지화 (App Store Optimizer, 2026-10-17)

범위: 키워드, 이름·부제·키워드 필드, 추가 언어, 스크린샷·프리뷰·아이콘 A/B, 평점·인앱 이벤트·피처링, 설치 추정. 코드는 고치지 않았다(읽기만 함).
출처 표기: [A*] Apple 공식, [M*] 이번에 직접 잰 값, [S*] 2차 자료. 끝에 목록이 있다.

## 0. 결론 먼저

1. **"lantern puzzle"은 검색량이 거의 없다.** App Store 자동완성에 이 검색어가 없고, 앱 이름 하나(Vesper)만 나온다 [M1]. 테스터가 이 말로 검색하겠다는 것은 *이름을 잊었을 때 다시 찾는 길*이다. 새 사용자를 데려오는 길은 아니다. 다만 상위 10개의 평점 수 중앙값이 1이라 1위는 쉽다. 그래서 이름에 넣는다.
2. 실제 검색량은 `logic puzzles`, `brain games`, `cozy games`, `relaxing games`, `no wifi games`, `daily puzzle`에 있다. 이 시장의 상위 10개는 평점이 수만에서 120만 개다 [M2]. 출시 직후 몇 달 동안은 이 검색어로 상위 10위에 들 수 없다. **긴 꼬리 검색어**(lantern, light puzzle, calm logic, 현지어 긴 꼬리)를 차지하고, 큰 검색어는 제목과 부제에 걸어 두고 기다린다.
3. **Akari·Nikoli·Light Up은 이름, 부제, 키워드 필드 어디에도 넣지 않는다.** 키워드 필드에 "akari"를 넣는 것은 기술적으로는 가능하다. 실제로 Akari라는 이름을 단 앱이 4개 이상 있다. 그러나 얻는 것이 하루 1설치도 안 된다(§1.3). 그래서 넣을 가치가 없다.
4. **교차 현지화**: 미국 스토어는 en-US 말고도 아랍어, 중국어(간체·번체), 프랑스어, 한국어, pt-BR, 러시아어, es-MX, 베트남어 메타데이터를 함께 색인한다 [A1]. **en-GB는 미국 스토어에서 색인되지 않는다.** 대신 덴마크·노르웨이·핀란드·폴란드·튀르키예·동남아·중동·인도·아일랜드 등 약 20개 스토어의 *기본* 언어이고, 독일·프랑스·한국·일본 외 대부분 스토어에서 보조 언어로 색인된다 [A1]. 그래서 en-GB가 사실상 "세계 영어" 필드다.
5. 1위 현실: 미국 퍼즐 1위는 하루 수만~십만 건대 다운로드가 필요하다. ASO만으로는 0%다. "Tier-1 1곳 1위"의 가장 현실적인 표적은 **뉴질랜드·아일랜드(영어, 작음)** 다. 그다음 **대만·홍콩**(2027-02-20 원소절, 등불이라는 이야기 각도로 피처링)이다. ASO가 맡을 일은 피처링이나 바이럴로 생긴 급증을 설치로 바꾸는 전환율과 긴 꼬리 순위다(§5).

---

## 1. 키워드 조사 (스토어별)

### 1.1 방법과 한계
- [M1] **App Store 검색 자동완성**(MZSearchHints, 스토어 헤더 지정)으로 2026-10-17에 키워드 약 190개를 조회했다. "그 검색어가 자동완성에 그대로 나오는가(★)"와 "몇 개가 완성되는가(0–10)"를 검색 인기도의 대리값으로 썼다. 인기도 점수(Apple Ads 5–100)는 계정이 있어야 볼 수 있어 쓰지 못했다(§1.6).
- [M2] **iTunes Search API**로 상위 10개 앱 평점 수의 중앙값을 구해 경쟁 강도의 대리값으로 썼다. 약 60회 호출 뒤 403으로 막혀서 ES/MX/BR/IT/TW/HK/KR은 자동완성 데이터만 있다.
- [M3] **Apple RSS 퍼즐(7012) 무료 상위 10**: 23개 스토어.
- 대리값은 검색량이 아니다. Apple Ads 계정으로 인기도를 확인하면 이 표를 고친다.

### 1.2 영어권 (US/UK/CA/AU) — 실측

| 검색어 | US 자동완성 | US 상위 10 평점 중앙값 | 관련도 | 판정 |
|---|---|---|---|---|
| lantern puzzle | 없음(앱 이름 1개만) | **1** | 10 | 이름에 넣는다. 1위는 쉽지만 양은 거의 0 |
| lantern | 10★ (VPN·조명이 차지) | 17,935 | 6 | 단독으로는 의미 없음, 조합용 |
| light puzzle | 10★ | (Lightpath, Beamloom: "Calm Light Puzzle" 등 소형) | 8 | **긴 꼬리 1순위**. 제목의 puzzle과 키워드 light를 조합 |
| light up puzzle | 4 | 5 | 9 | "light up"은 Nikoli 영어 퍼즐 이름이라 정확한 구문은 피한다(§1.3) |
| akari / akari puzzle | 10★ / 2★ | 1 / 379 | 10 | 양 작음, 쓰지 않음 |
| logic puzzles | 10★ | 25,649 | 9 | 제목(Logic Puzzle)으로 걸어 둠, 장기 |
| logic games | 10★ | 27,749 | 8 | 제목과 부제 조합으로 걸림 |
| brain games | 10★ | 130,552 | 7 | 부제로 걸어 둠, 장기 |
| daily puzzle(s) | 10 | 1,383 | 10 | **중기 목표**. 경쟁이 중간이고 우리의 핵심이다 |
| daily brain games | 10★ | — | 9 | 부제 단어만으로 완성된다 |
| cozy puzzle | 10★ | 1,603 | 9 | **중기 목표** |
| cozy games | 10★ | 38,250 | 8 | 장기 |
| relaxing games | 10★ | 21,709 | 8 | 키워드 |
| calm games | 10★ | 12,958 | 9 | 부제(Calm) |
| zen puzzle | 10★ | 51,206 | 6 | 키워드 zen |
| no wifi games / offline games | 10★ | 1,200,110 / 264,638 | 7 | 경쟁 최강. 단어만 넣어 두고, CPP(§3.6)로 전환을 맞춘다 |
| puzzle games for adults | 9★ | 375,510 | 8 | "adults" 한 단어로 여러 조합을 만든다 |
| brain teaser | 10★ | 202,183 | 7 | "teaser" |
| grid puzzle / logic grid puzzles | 10★ | — | 7 | "grid" |
| queens puzzle / queens game | 10★ | 688 / 298 | **2** | 쓰지 않음(아래) |
| star battle | 10★ | 37 | 2 | 쓰지 않음 |
| cute games | 7★ | — | 6 | "cute"(Wick) |
| lantern game(s), lantern puzzles, brain games for women | 0 | — | — | 검색 없음 |

- UK/AU/CA도 패턴은 같고 경쟁은 US의 1/5–1/10이다. UK는 "cosy games"와 "cozy games"가 둘 다 자동완성된다.
- **Queens류 검색어**("queens", "crowns", "star battle"): 검색량이 있고 경쟁이 약하다(US 중앙값 688). 그러나 규칙이 다르다(한 행·열·영역에 하나씩). 들어온 사람이 바로 이탈해 전환율을 깎고, 2.3.7(관련 없는 키워드) 위험도 있다. **쓰지 않는다.** Queens 사용자가 겹치는 지점은 "logic puzzles / daily puzzle" 쪽에서 잡는다.
- 경쟁 신호: 2026년에 "Lanterns: Light Up Puzzle"(평점 8), "Vesper: Nightly Lantern Puzzle", "Lantern Keeper: Light Puzzle", "Lantern: Daily Puzzles", "Akari Glow"가 나왔다. 모두 평점 0–8이다 [M2]. **같은 콘셉트의 작은 앱이 늘고 있다**는 뜻이다. "lantern"만으로는 차별이 안 되므로, 아이콘과 스크린샷에서 Wick으로 구분한다.

### 1.3 상표 위험 정리

| 단어 | 이름·부제 | 키워드 필드 | 근거 |
|---|---|---|---|
| Nikoli | ✕ | ✕ | Nikoli 등록 상표(naming.md). 2.3.7은 상표·인기 앱 이름을 메타데이터에 넣지 말라고 한다 [A6] |
| Akari | ✕ | **넣지 않음(권고)** | USPTO에 제3자 AKARI 상표가 9·41류로 살아 있다(naming.md). 스토어에는 "Akari", "Akari: Light Up Your Brain", "Akari Glow", "Akari Puzzle", "Light Up Akari – PuzzleMonster"가 있어 Apple이 일괄 거절하지는 않는 것으로 보인다 [M1]. 하지만 검색량이 작고(상위 10 중앙값 1, 자동완성은 앱 이름뿐), 이름에 Akari를 단 앱이 이미 위에 있다. 기대 효과는 하루 1설치 미만이고, 위험은 2.3.7 거절이나 상표 이의다. **위험 대비 이익이 없다** |
| "Light Up" (구문) | ✕ | "light"는 넣고 "up"은 넣지 않음 | "light"는 일반어이고 게임을 정확히 설명한다. "light"를 넣어 "light puzzle"(볼륨 있음)을 얻는다. "light up puzzle"은 포기한다 |
| Meowdoku, Queens, Sudoku | ✕ | ✕ | 인기 앱 이름이거나 관련 없는 장르 |
| 美術館(일본어 Akari 이름) | ✕ | ✕ | Nikoli 명칭. 자동완성 1건뿐 |
| あかり / 灯り (일본어 "불빛") | — | 灯り ○, あかり는 효과 없음 | 일반어. 자동완성은 Panasonic 조명 앱이 차지 |

### 1.4 비영어 스토어 — 자동완성 실측 요약 [M1][M2]

| 스토어 | 볼륨 있는 일반어 (★ = 그대로 자동완성) | 등불 계열 | 경쟁 메모 |
|---|---|---|---|
| DE | logikrätsel★, logik spiele★, denkspiele★, gehirnjogging★, rätsel★, offline spiele★, tägliches rätsel(앱 이름 6개), knobelspiele★ | laterne: 1(Lotus) | logikrätsel 중앙값 2,486으로 **진입 가능**. 신생 인디 로직 앱(Glowtrace, Tintgarden, Candydoku, Doppelstern)이 이미 현지어 부제로 들어와 있다 |
| FR | jeux de logique★, jeu de logique★, casse-tête, jeux sans wifi★, jeux de réflexion, jeux relaxants★ | lanterne★(VPN·조명) | 중앙값 3.6–4.7만으로 높음. jeux relaxants는 187로 **약함** |
| JP | パズル★, パズルゲーム★, 脳トレ★, 頭の体操★, ロジックパズル★, ナンプレ★, オフライン ゲーム(무료·퍼즐 조합) | ランタン★(캠핑), ちょうちん·ランタン パズル 0 | ロジックパズル 2.1만, 脳トレ 7만. 등불 계열 검색은 없다 → **脳トレ/ロジック이 주력** |
| KR | 퍼즐 게임★, 두뇌 게임★, 두뇌 퍼즐★, 논리 퍼즐★, 로직 퍼즐, 힐링 게임★, 오프라인 게임★, 귀여운 게임★ | 등불: 0, 랜턴★(캠핑·안심귀가) | "논리 퍼즐" 상위에 Nekotel, Tintgarden, Brim 같은 현지화 인디 로직 앱이 있다. **"등불 퍼즐"은 검색이 없다** → 이름의 등불은 브랜드용이고, 검색은 논리·두뇌·힐링으로 잡는다 |
| ES / MX | juegos de lógica, rompecabezas★, acertijos★, juegos sin internet★, juegos mentales★, juegos sin wifi★(MX) | linterna★ = **손전등 앱**, farol은 무관 | "linterna"는 쓰지 않는다. 등불은 "faroles"(스페인)로 |
| BR | jogos de lógica, quebra-cabeça, jogos offline★, jogos sem internet★, jogos de raciocínio★ | lanterna★ = **손전등** | 같은 이유로 lanterna를 키워드에 넣지 않는다 |
| IT | giochi di logica★, rompicapo★, giochi senza internet★, enigmistica★, giochi rilassanti★ | lanterna★(연등) | enigmistica는 잡지 퍼즐 수요로, 관련도 중간 |
| TW / HK | 益智遊戲★, 邏輯(遊戲), 解謎★, 動腦★, 腦力★, 數獨★, 療癒★, 單機遊戲★ | **點燈★**(TW, 「點燈解謎」 자동완성), 燈籠: 0 | **點燈(불을 켜다)이 살아 있는 검색어**다. 대만·홍콩 이름에 넣는다 |

### 1.5 제안 메타데이터 (길이는 스크립트로 검사함. 이름·부제 ≤30, 키워드 ≤100, 이름·부제 단어와 중복 0)

> 원칙: 이름 = 브랜드 + 등불(재검색용) + 논리·퍼즐(볼륨). 부제 = 데일리·차분함·두뇌(전환 문구 겸 볼륨). 키워드 = 쉼표만, 공백 없음, 이름·부제에 있는 단어는 반복하지 않는다. **현지어 문구는 원어민 검토를 거쳐야 한다**(AI 초안).

| 로캘 (색인되는 스토어) | 이름 (30) | 부제 (30) | 키워드 (100) |
|---|---|---|---|
| **en-US** (US, JP 보조) | `Duskwick: Lantern Logic Puzzle` (30) | `Calm & Cozy Daily Brain Games` (29) | `puzzles,relaxing,teaser,adults,offline,wifi,no,mind,zen,light,grid,cute,lamp,iq,riddle,quiet,smart` (98) |
| **en-GB** (UK·IE 기본, 약 20개 스토어 기본, 다수 보조) | `Duskwick: Lantern Logic Puzzle` | `Calm & Cosy Daily Brain Games` (29) | `puzzles,cozy,relaxing,teaser,adults,offline,wifi,no,mind,zen,light,grid,cute,lamp,iq,riddle,think` (97) |
| **en-AU** (AU·NZ 기본, en-GB와 함께 색인) | 같음 | `Cosy Daily Puzzles, No Wi-Fi` (28) | `brain,games,calm,relax,teaser,adults,offline,mind,zen,light,grid,cute,lamp,iq,riddle,unwind,town` (96) |
| **en-CA** (CA, fr-CA와 함께) | 같음 | `Cozy Daily Puzzles, No Wi-Fi` (28) | en-AU와 같음 (96) |
| **ru → 미국용 영어 확장** | 같음 | `Calm & Cozy Daily Brain Games` | `peaceful,unwind,gentle,evening,night,glow,lanterns,lamps,candle,village,town,spirit,mascot,wick,dusk` (100) — 이름을 잘못 친 "dusk wick" 검색도 받는다 |
| **vi → 미국용 영어 확장** | 같음 | 같음 | `logical,thinking,training,challenge,solve,solver,tiles,board,squares,lit,lights,bulb,brainteaser` (96) |
| **de-DE** (DE·AT·CH) | `Duskwick: Laternen-Logikrätsel` (30) | `Tägliches Rätsel & Denkspiele` (29) | `gehirnjogging,logik,spiele,offline,ohne,internet,entspannend,knobeln,gehirn,licht,lampe,niedlich` (96) |
| **fr-FR** (FR·CH·BE·**US**) | `Duskwick: Casse-tête logique` (28) | `Lanternes & jeux de réflexion` (29) | `énigme,cerveau,quotidien,détente,relaxant,zen,sans,wifi,internet,mignon,lumière,lampe,défi,puzzle` (97) |
| **fr-CA** (CA) | 같음 | `Lanternes, énigme du jour` (25) | `jeux,réflexion,cerveau,quotidien,détente,relaxant,zen,sans,wifi,mignon,lumière,lampe,défi,puzzle` (96) |
| **ja** (JP) | `Duskwick: 脳トレ ロジックパズル` (21) | `灯りをともす毎日の癒しゲーム` (14) | `頭の体操,パズルゲーム,ランタン,提灯,推理,論理,思考,暇つぶし,オフライン,無料,かわいい,大人,デイリー,クイズ,パズル,灯り,頭脳,ひらめき,シンプル,ロジック,ナンバー` (89) |
| **ko** (KR·**US**) | `더스크윅: 등불 로직 퍼즐` (14) | `매일 하는 귀여운 두뇌 게임` (15) | `Duskwick,논리,두뇌퍼즐,로직퍼즐,논리퍼즐,퍼즐게임,힐링,오프라인,와이파이,무료,랜턴,추리,브레인,집중력,두뇌훈련,데일리,잔잔한,감성,마을,캐릭터,퀴즈,아이큐` (91) |
| **es-ES** (ES) | `Duskwick: Juegos de lógica` (26) | `Puzle diario, zen y relajante` (29) | `rompecabezas,acertijos,mentales,mente,cerebro,sin,internet,wifi,offline,faroles,luz,reto,ingenio` (96) |
| **es-MX** (MX·중남미·**US**) | 같음 | `Rompecabezas mental diario` (26) | `acertijos,mentales,cerebro,sin,internet,wifi,offline,relajante,zen,faroles,luz,lindo,reto,ingenio` (97) |
| **pt-BR** (BR·**US**) | `Duskwick: Jogos de Lógica` (25) | `Quebra-cabeça diário relaxante` (30) | `raciocínio,mente,cérebro,offline,sem,internet,wifi,luz,fofo,calmo,zen,desafio,charada,enigma,puzzle` (99) |
| **it** (IT·CH) | `Duskwick: Giochi di logica` (26) | `Rompicapo zen ogni giorno` (25) | `enigmistica,mente,cervello,senza,internet,offline,rilassanti,lanterna,luce,carino,puzzle,sfida,quiz` (99) |
| **zh-Hant** (TW·HK·MO·**US**) | `Duskwick: 點燈邏輯益智遊戲` (18) | `每天一題的療癒動腦小遊戲` (12) | `燈籠,解謎,腦力,燒腦,推理,單機,離線,免費,可愛,小鎮,休閒,紓壓,思考,訓練,數字,謎題,邏輯遊戲,益智,遊戲,動腦遊戲,點燈解謎,益智解謎,腦力訓練` (78) |
| **zh-Hans** (SG·**US**, 중국 본토 제외) | `Duskwick: 点灯逻辑益智游戏` (18) | `每天一题的治愈动脑小游戏` (12) | 번체와 같은 구성의 간체 (78) |

- 이름에 브랜드와 서술어를 함께 넣는 것은 2.3.7의 30자 제한 안이다. 한국 이름은 "더스크윅" 한글 표기로 바꿨다. 철자가 어렵다는 피드백(3/8) 때문이다. 영문 Duskwick은 키워드에 넣는다. 일본 이름도 영문을 유지하고, 다음 라운드에서 ダスクウィック 병기를 검토한다.
- **교차 현지화 정리**: US = en-US + es-MX + fr-FR + ko + pt-BR + zh-Hans + zh-Hant + **ru + vi(영어로 채움)** + ar [A1]. 앞의 여섯은 각자 본국 시장용이라 현지어로 채운다. ru와 vi만 미국 영어 확장에 쓴다. 이유는 다음과 같다.
  - 러시아는 AdMob 광고가 정지된 상태다. 2025-01 기준 Google 정책 페이지에서 확인했다 [S9]. 러시아어 사용자의 수익이 0이다.
  - 베트남은 기본이 en-GB이고 eCPM이 가장 낮다.
  - **다른 현지화 필드 사이에서도 단어 조합이 되는지는 실험마다 결과가 엇갈린다.** 그래서 두 단어 구문은 한 필드 안에서 완결되게 넣었다.
  - 위험: 러시아어 화면에 영어 문구가 보인다. 거절 사례는 확인하지 못했다(낮음).
- 매 버전에서 바꿔 볼 수 있는 것은 키워드뿐이다. 이름과 부제 변경도 새 버전 심사에 묶인다. 출시 4주 뒤 순위를 보고 2차 키워드로 교체한다.

### 1.6 사용자 결정이 필요한 것
- **Apple Ads 계정**(무료 개설, 지출 없이 키워드 인기도 5–100을 볼 수 있음): 이 표를 실제 검색량으로 바꾸는 가장 싼 방법이다. 계정 생성은 사용자 몫이다.

---

## 2. 추가 언어·스토어 현지화 (10개 인앱 언어 밖)

메타데이터만 현지화하면 비용은 언어당 약 1시간이다(AI 초안 + 원어민 확인 1회, 스크린샷은 영어를 그대로 씀). 인앱 현지화는 문자열 약 120개(a11y/strings.ts V11 블록 등), 레이아웃 QA, 스크린샷 재촬영이 필요하다. RTL(ar, he)은 캔버스 UI 미러링까지 해야 해서 비용이 크다.

점수 = 상대 iOS 전면 광고 eCPM(US=100) × iPhone 사용자 수(백만, 추정) × 현지어 검색 강도(자동완성 실측: 약 0.3 / 중 0.7 / 강 1.0). eCPM은 Udonis(2021–22, US 9.58·DK 5.76·CH 5.73 iOS)와 Appodeal Q4 2024의 지역 경향, Smartyads 티어로 만든 **추정치(±50%)** 다 [S6][S7][S8]. iPhone 수는 인구 × iOS 점유율의 대략값으로, 다시 확인해야 한다.

| 순위 | 언어 (스토어) | eCPM 지수 | iPhone(백만) | 현지어 검색 [M1] | 기본 스토어 언어 | 점수 | 권고 |
|---|---|---|---|---|---|---|---|
| 1 | **ar** (SA·AE·US) | ~37 | ~17 | 강 (ألغاز★, العاب ذكاء★) | en-GB(보조 ar) | ~500 | **지금 메타만**. 인앱은 RTL이라 안드로이드 뒤 |
| 2 | **nl** (NL·BE) | ~50 | ~7.5 | 강~중 (logische puzzels★, denkspellen★) | NL은 nl | ~300 | **지금 메타만 → 인앱 1순위**(라틴 문자, Tier-1) |
| 3 | **sv** (SE) | ~50 | ~5.5 | 중 (hjärngympa★) | sv | ~190 | **지금 메타만 → 인앱 2순위** |
| 4 | **th** (TH) | ~12 | ~15 | 강 (เกมฝึกสมอง★) | en-GB | ~180 | 지금 메타만. 인앱은 폰트 확인 필요 |
| 5 | **pl** (PL) | ~20 | ~8 | 강 (gry logiczne★, łamigłówki★) | en-GB | ~160 | 지금 메타만 → 인앱 3순위 |
| 6 | **id** (ID) | ~8 | ~20 | 강 | en-GB | ~160 | 지금 메타만(볼륨용, 수익 낮음) |
| 7 | **tr** (TR) | ~10 | ~13 | 강 (zeka oyunları★) | en-GB | ~130 | 지금 메타만 |
| 8 | **he** (IL) | ~35 | ~3 | 강 | en-GB | ~95 | 나중에 메타만 |
| 9 | **pt-PT** (PT) | ~20 | ~3 | 중 | pt-PT(**pt-BR은 색인 안 됨**) | ~50 | pt-BR을 다듬어 지금 메타만 |
| 10 | no / da | ~60 | ~3.5 | **약** (hjernetrim 5, logik spil 0) | **en-GB** | 60–85 | 보류. en-GB 목록이 이미 보인다 |
| 11 | fi | ~45 | ~1.8 | 약 (0–1) | en-GB | ~15 | 하지 않음 |
| — | ru, vi | 0 / ~6 | — | — | — | — | 현지어 대신 **미국 영어 확장용**(§1.5) |

- Meowdoku는 60개 언어로 현지화했다 [M4]. 출시 5개월 만에 US 평점 33.6만 개를 받았고 퍼즐 1위 10개국을 차지했다 [M3]. 볼륨 쪽 정답은 "많이 현지화"다. 다만 그 앱은 UA(유료 획득)로 키운 앱이다. 메타데이터만 현지화하는 효과를 따로 떼어 증명하지는 못한다.
- 정직 문구: 메타데이터만 현지화한 언어의 설명 첫 줄에 "게임 안 글자는 적고 영어로 나온다"를 넣는다. 리뷰에서 "언어 사기"라는 말이 나오는 것을 막기 위해서다.

---

## 3. 스크린샷·프리뷰·아이콘

### 3.1 규격 [A2][A3]
- iPhone 6.9″: 1320×2868 (1290×2796, 1260×2736도 가능). 최대 10장이다. 이 크기를 넣으면 6.5″는 없어도 된다.
- 프리뷰: 886×1920 세로, 15–30초, 30fps 이하, 500MB 이하, 로캘마다 3개까지. **프리뷰는 항상 스크린샷보다 앞에 나온다.** 포스터 프레임은 기본 5초이고 직접 고를 수 있다.
- 검색 결과에는 세로 기준 **첫 3칸**이 나온다(프리뷰가 있으면 프리뷰가 1칸을 차지한다). 이 업계에서는 정설이지만 Apple 문서로 확인하지는 않았다.

### 3.2 경쟁작이 보여 주는 것 (확인 수준을 표시함)
- **Meowdoku**: 부제 "Brain Puzzle Games", 상품 페이지 이벤트 "Peekaboo Autumn Meows!"(Special Event), 4.8 / 33.6만 평점 [M4]. 설명의 첫 문단은 "Sudoku의 추론 + 지뢰찾기의 긴장"과 규칙 세 줄이다. *스크린샷 이미지는 직접 열어 보지 않았다*(파일 내려받기 없음). Queens류는 대체로 "규칙 한 문장 + 반쯤 푼 판"을 첫 장에 둔다(업계 관찰, 미검증).
- **Sudoku.com**: 1.86M 평점, 17개 언어. 설명은 "train your brain / relax / daily"를 앞세운다 [M4].
- 시사점: 장르 1위들은 **규칙을 첫 3장 안에서 끝낸다.** Akari는 Sudoku보다 낯선 규칙이라 규칙 장면이 더 중요하다. 그래서 BENCHMARK-CUTE §3.9의 6장 순서를 바꿔 규칙을 2번째로 올렸다.

### 3.3 스크린샷 8장 (첫 3장 = 무엇·어떻게·왜 매일)

| # | 장면 (Wick 연기) | 목적 | 캡션 EN (위 / 아래) |
|---|---|---|---|
| 1 | 마을이 반쯤 불 켜진 판 + 프레임을 뚫고 손 흔드는 Wick | 무엇(분위기, 캐릭터) | **Light up a tiny town** / One calm lantern puzzle a day |
| 2 | 3컷 규칙: 등불 놓기 → 빛줄기 → 숫자 돌 만족(금 고리). Wick이 가리킴 | 어떻게(규칙 1문장) | **Place lanterns. Light every tile.** / Numbers tell how many touch them |
| 3 | 엽서·우표·7일 연속(보호막) + 달력 "오늘" 타일 | 왜 매일 | **A new Daily, every day** / Keep your streak glowing |
| 4 | 충돌 → 걱정하는 두 Wick, 판 안 한 줄 안내(LineBand) | 막혀도 괜찮다 | **Stuck? Wick shows the way** / Gentle step-by-step hints |
| 5 | 마을 전경, 이웃 고양이, 불 켜진 집 | 진행 메타 | **Every puzzle lights a home** |
| 6 | 밤, 졸린 Wick | 차분함과 광고 약속 | **No timer. No lives. No Wi-Fi.** / Never an ad mid-puzzle |
| 7 | gentle 판과 deduce 7×7 판을 나란히 | 깊이 | **From gentle to brain-burning** |
| 8 | 큰 글자·VoiceOver·iCloud 아이콘 | 신뢰(35–54 대상) | **Big text · VoiceOver · iCloud sync** |

- 사실 확인: "Never an ad mid-puzzle"은 광고 정책 B(판 안·데일리 광고 없음)와 일치한다. "No Wi-Fi"는 게임이 오프라인으로 돌아간다는 사실과 일치한다. "No ads" 문구는 금지다.
- 캡션 단어는 키워드와 겹치게 했다(lantern, puzzle, daily, Wi-Fi). Apple이 캡션 글자를 색인한다는 주장이 2025-06에 있었다(Appfigures). 그러나 Apple은 확인하지 않았고, 독립 시험 64구문 중 설명되지 않는 순위는 1건뿐이었다 [S1]. **효과는 작다고 보고 덤으로만 취급한다.**

캡션 현지화 (위 줄, 원어민 검토 필요):

| # | ko | ja | de | fr | es (ES/MX) | pt-BR | it | zh-Hant / zh-Hans |
|---|---|---|---|---|---|---|---|---|
| 1 | 작은 마을에 불을 켜요 | 小さな町に灯りをともそう | Bring Licht ins kleine Dorf | Illuminez un petit village | Ilumina un pueblito | Ilumine uma pequena vila | Illumina un piccolo borgo | 點亮一座小鎮 / 点亮一座小镇 |
| 2 | 등불을 놓아 모든 칸을 밝혀요 | ランタンを置いて全マスを照らそう | Laternen setzen. Jedes Feld erhellen. | Posez des lanternes. Éclairez chaque case. | Coloca faroles. Ilumina cada casilla. | Coloque lanternas. Ilumine cada quadrado. | Posa le lanterne. Illumina ogni casella. | 放下燈籠，照亮每一格 / 放下灯笼，照亮每一格 |
| 3 | 매일 새로운 데일리 퍼즐 | 毎日届く、新しいデイリー | Jeden Tag ein neues Rätsel | Un nouveau défi chaque jour | Un reto nuevo cada día | Um desafio novo todo dia | Una nuova sfida ogni giorno | 每天都有新的每日一題 / 每天都有新的每日一题 |
| 4 | 막히면 윅이 길을 알려 줘요 | 迷ったらウィックが道案内 | Festgefahren? Wick zeigt den Weg | Bloqué ? Wick vous guide | ¿Atascado? Wick te guía | Travou? O Wick mostra o caminho | Bloccato? Wick ti indica la via | 卡關了？Wick 幫你指路 / 卡关了？Wick 帮你指路 |
| 5 | 한 판마다 집 한 채가 밝아져요 | 解くたびに家に灯りがともる | Jedes Rätsel erhellt ein Haus | Chaque grille allume une maison | Cada puzle (MX: reto) enciende una casa | Cada fase acende uma casa | Ogni puzzle accende una casa | 每解一題，點亮一戶人家 / 每解一题，点亮一户人家 |
| 6 | 타이머도 목숨도 없어요 · 오프라인 | タイマーなし・ライフなし・オフラインOK | Kein Timer. Keine Leben. Offline. | Sans chrono. Sans vies. Sans wifi. | Sin reloj. Sin vidas. Sin wifi. | Sem cronômetro. Sem vidas. Offline. | Niente timer. Niente vite. Offline. | 不計時・沒有體力・離線也能玩 / 不计时・没有体力・离线也能玩 |
| 7 | 쉬운 판부터 머리 쓰는 판까지 | やさしい問題から本格派まで | Von sanft bis knifflig | De tout doux à casse-tête | De suave a desafiante | Do tranquilo ao desafiador | Da rilassante a impegnativo | 從輕鬆到燒腦 / 从轻松到烧脑 |
| 8 | 큰 글자 · VoiceOver · iCloud | 大きな文字・VoiceOver・iCloud | Große Schrift · VoiceOver · iCloud | Grand texte · VoiceOver · iCloud | Letra grande · VoiceOver · iCloud | Letra grande · VoiceOver · iCloud | Testo grande · VoiceOver · iCloud | 大字體・VoiceOver・iCloud / 大字体・VoiceOver・iCloud |

- 6번 아래 줄 "광고는 판 중간에 절대 안 나와요 / 広告はパズル中に出ません / Nie Werbung mitten im Rätsel / Jamais de pub en pleine grille / Nunca anuncios a mitad del reto / Nunca anúncio no meio da fase / Mai pubblicità a metà partita / 解題中絕不跳廣告 / 解题中绝不弹广告".

### 3.4 프리뷰 영상 스토리보드 (886×1920, 24–26초, 실제 화면 녹화 + 자막)

| 시간 | 화면 | 자막 (EN) | 비고 |
|---|---|---|---|
| 0.0–2.0 | 어두운 판, 탭 → 등불 속 Wick이 눈을 뜨며 빛줄기가 퍼짐 | (없음) | **소리 없이 자동 재생**되므로 첫 2초는 움직임으로 승부한다. 포스터 프레임도 이 장면 |
| 2.0–6.0 | 등불 3개를 놓을 때마다 칸이 차오르고, 숫자 돌에 금 고리 | Light every tile | 손가락이나 사람 손은 넣지 않는다 |
| 6.0–9.0 | 두 등불이 서로 보임 → Wick 걱정 표정 → 하나를 걷음 | Lanterns can't see each other | 규칙 2 |
| 9.0–13.0 | 마지막 등불 → 피날레(2.6 s) → 집에 불 | Solved! | 소리를 켠 사람에게는 펜타토닉 상승 |
| 13.0–17.0 | 엽서 우표 쾅, 연속 슬롯에 작은 Wick 팝 | A new Daily, every day | |
| 17.0–21.0 | 마을이 패닝하며 불이 하나씩 켜짐 | Light up a tiny town | |
| 21.0–25.0 | 졸린 Wick + 로고 + 앱 아이콘 | Duskwick — one calm puzzle a day | 끝 카드. 30초를 넘기지 않는다 |

- 로캘별 프리뷰는 자막만 바꾼 판본을 8개 언어(en, ko, ja, de, fr, es, pt-BR, zh-Hant)로 만든다. 나머지 로캘은 en을 쓴다.
- 영상이 없는 쪽이 오히려 나을 수 있다. 첫 칸이 정지 스크린샷 1번(Wick 히어로)이 되기 때문이다. **PPO로 "프리뷰 있음과 없음"을 비교하는 것을 2차 테스트로 둔다.**

### 3.5 아이콘 A/B — Product Page Optimization [A4]
- 규칙 [A4]:
  - 원본 + 처리군 최대 3개, 한 번에 테스트 1개, 최대 90일, 신뢰도 90% 표시, iOS 15 이상.
  - **대체 아이콘은 출시된 바이너리 안에 모두 들어 있어야 한다.** 아이콘이 들어간 테스트는 앱 버전 심사와 함께 가고, 아이콘이 없는 테스트(스크린샷만)는 따로 제출할 수 있다.
- 설계: A = 현재 C3(나무 틀 등불, 크림·금색). B = 같은 틀 + Wick 눈과 볼(입 없음, BENCHMARK-CUTE §3.2). **처리군은 1개만 두고 할당은 최대로** 한다. 트래픽이 적기 때문이다.
- 표본 계산(정직하게):
  - 전환율 3% → 3.6%(+20%)를 90% 신뢰로 가리려면 군마다 노출이 약 1.1만 회 필요하다.
  - 하루 노출이 300이면 약 70일이 걸린다.
  - 전환율이 30%인 상품 페이지 기준이라면 군마다 약 750회면 된다.
  - **출시 직후나 피처링 급증 때 시작해야 90일 안에 결론이 난다.**
- 구현 메모(다른 담당): 1.0 바이너리에 대체 아이콘 세트를 넣는다(Assets.xcassets 대체 AppIcon, `ASSETCATALOG_COMPILER_INCLUDE_ALL_APPICON_ASSETS`). 그러지 않으면 테스트를 다음 버전까지 미뤄야 한다.
- 정성 사전 점검(돈 0원): HANDOFF 할 일 6(실제 사람 3–5명)에 "격자 안에서 A와 B 중 하나 고르기"를 더한다.

### 3.6 Custom Product Pages (CPP) + 키워드 [S2]
- 2025-07부터 키워드 필드의 단어를 CPP에 배정하면, 그 검색어의 자연 검색 결과에 CPP가 나온다. 2025-10에 한도가 70개로 늘었다. 이름이나 부제에 있는 단어는 배정할 수 없다. 2차 자료(벤더 블로그)이므로 ASC에서 확인한다.
- 우선 CPP 2개:
  - ① `offline, wifi, no` → 6번 "No Wi-Fi"를 첫 장으로 둔 페이지.
  - ② `relaxing, quiet, zen` → 밤 장면과 졸린 Wick을 첫 장으로 둔 페이지.
- 색인이 늘지는 않는다. 같은 검색어에서 전환율만 올린다.

---

## 4. 평점·인앱 이벤트·피처링

### 4.1 평점 요청 (SKStoreReviewController / `AppStore.requestReview(in:)`)
- 시스템 규칙: 365일에 최대 3회 표시되고, 표시 여부는 시스템이 정한다. 가이드라인 5.6.1은 자체 리뷰 프롬프트를 금지한다. "좋아요?"를 먼저 물어 평점을 걸러 내는 방식도 쓰지 않는다 [A6].
- **요청하는 순간(행복한 순간, 하나만 충족하면 됨)**
  1. 데일리를 ✨(힌트 없음)로 끝내고 연속 기록이 3일 이상이며, 결과 엽서 우표 연출이 끝난 뒤 마을로 돌아온 쉼표 순간.
  2. 거리 들르기(5·10판)에서 집이 완성된 연출이 끝난 뒤.
  3. 7일 선물 상자를 연 뒤.
- **요청하지 않는 조건(하나라도 해당하면 금지)**
  - 이번 세션에 막힘(deadEnd)·충돌 표시가 2회 이상 나왔다.
  - 직전 판에서 힌트를 썼다.
  - 전면 광고 앞뒤 120초 안이다(beforeNextBoard 슬롯과 붙이지 않는다).
  - 같은 세션에 ATT·UMP·알림 프롬프트가 떴다.
  - 설치 후 3일 미만이거나 완료한 판이 10개 미만이다.
  - 튜토리얼 중이다.
  - 앱 버전마다 이미 1회 요청했다.
- 우리 쪽 상한: 1회차는 3일째 이후, 2회차는 90일 뒤나 새 버전에서 한다.
- 설정 시트에 "평가하기" 행을 둔다(`itms-apps://…?action=write-review`). 사용자가 눌러서 여는 것이라 허용된다.
- 구현(다른 담당): 지금 Capacitor 의존성에는 리뷰 플러그인이 없다(package.json 확인). `@capacitor-community/in-app-review` 같은 플러그인이나 Swift 몇 줄짜리 자체 플러그인이 필요하다. 시작 비용은 0이고, 호출할 때 지연 로드하면 된다.
- 운영:
  - ASC에서 리뷰에 48시간 안에 그 사람의 언어로 답한다.
  - 새 버전에서 "평점 요약 초기화"는 평균이 4.3 미만일 때만 쓴다.
  - 목표: 첫 달 US 평점 50개 이상, 평균 4.7 이상. 평점은 **스토어마다 따로** 쌓이므로 1위를 노리는 시장의 평점이 중요하다.

### 4.2 인앱 이벤트 [A5]
- 규칙 [A5]:
  - 이벤트 1개는 최대 31일이고, 시작 14일 전부터 노출된다. 동시에 게시할 수 있는 이벤트는 10개, 승인된 이벤트는 15개까지다. 앱 버전과 따로 심사받는다.
  - 이름 30자, 짧은 설명 50자, 긴 설명 120자.
  - 카드 이미지 16:9(1920×1080 이상), 상세 이미지 9:16(1080×1920 이상).
  - 이벤트는 **검색 결과에 앱과 함께 카드로 나오고**, Today·Games 탭 큐레이션 후보가 된다.
- 조건: 실제 앱 안 콘텐츠가 있어야 한다. 테마 데일리 7–14판 + 마을 장식 틴트 + 한정 엽서 우표 정도면 된다. 딥링크(유니버설 링크나 URL 스킴)도 필요하다. 지금 앱에는 없으니 구현 항목이다.
- 캘린더(출시를 2026-11~12로 가정):

| 기간 | 이벤트 이름 (EN, ≤30) | 배지 | 시장 각도 | 메모 |
|---|---|---|---|---|
| 12-01 ~ 12-31 | Winter Lantern Nights | Special Event | 전 세계, JP "イルミネーション" 시즌 | 첫 이벤트. 출시 피처링과 겹치게 |
| 2027-01-01 ~ 01-07 | First Light of the Year | Challenge | JP 初日の出, KR 새해 | 7일 연속 챌린지 |
| **2027-02-13 ~ 02-21** | **Lantern Festival Week** | Special Event | TW·HK·SG·US 중화권, KR 정월대보름 | 2027 원소절 = 2-20(음력 1월 15일, 설날 2-6) [S10]. 대보름도 같은 날. **피처링 핵심 각도** |
| 2027-05 중순 | Spring Lantern Walk | Special Event | KR 연등회 시기(날짜 확인 필요) | 종교 색은 빼고 "봄 등불"로 |
| 2027-08-13 ~ 08-16 | Summer Lantern River | Special Event | JP 盆 灯籠流し | |
| 2027-09 중순 | Moon Festival Lights | Special Event | 중추절·추석(날짜 확인 필요) | |

- Meowdoku도 계절 이벤트("Peekaboo Autumn Meows!")를 걸어 두고 있다 [M4]. 이벤트 카드는 "lantern festival" 같은 검색에 우리 카드를 띄우는 *추가 검색 표면*이다.

### 4.3 피처링 지명(Featuring Nominations) [A7]
- 타이밍: Apple은 최소 2주, 템플릿은 3주 이상을 권하고, 최대 3개월 전부터 받는다. **우리 계획: 출시 지명은 출시 6–8주 전, 원소절 지명은 2026-11-20 ~ 12-15.**
- 이야기 각도 (편집팀이 좋아할 순서, 근거는 Apple 공개 기준인 품질·혁신·접근성·현지화):
  1. **VoiceOver만으로 풀 수 있는 격자 논리 퍼즐**: 드물다. 모든 컨트롤과 격자에 라벨이 있다. 기기 검증이 끝나야 쓸 수 있다.
  2. 로그인 없는 iCloud 동기화, 계정 없음, 판 중간 광고 없음: "attention-respecting" 디자인.
  3. Wick, 등불 정령: 1인 개발자의 캐릭터 IP 이야기.
  4. 10개 언어 현지화, 원소절·대보름 이벤트(APAC 편집팀용).
- 약점(정직하게): ATT 추적과 전면 광고는 편집 선택에 불리할 수 있다(미검증 추정). 지명은 Apple ID 계정이 있어야 할 수 있으므로 사용자가 직접 한다.

---

## 5. 냉정한 추정 — ASO만으로 얼마, 1위는 어디부터

### 5.1 ASO만의 설치 (전 세계 iOS, 하루, 출시 1–3개월, 유료 0·피처링 없음 가정)

| 시나리오 | 내용 | 하루 설치 (범위) |
|---|---|---|
| 기준선 | 영어 이름만, 기본 스크린샷, 현지화 없음 | 3–10 |
| **이 문서 전체 적용** | §1.5의 17개 메타데이터 로캘 + 메타만 8개 언어, Wick 스크린샷, CPP | **10–40 (기본 약 20)** |
| + 평점 4.7 이상, 50개 이상 / 스토어 | 전환율 상승 | 15–55 |

- 근거와 계산:
  - 우리가 1–5위를 노릴 수 있는 검색어는 긴 꼬리다. 검색어마다 하루 검색이 수십 회 수준이다(자동완성 존재 기준의 추정).
  - 영어권 약 15개(light puzzle, lantern logic, calm daily puzzle, cozy puzzle 긴 꼬리 등)와 현지어 약 30개를 합친다.
  - 검색에서 다운로드까지 20–30%를 곱하면 위 범위가 나온다.
  - 큰 검색어(logic puzzles, brain games)는 평점 수천 개 전에는 50위 밖이라 0으로 잡았다.
- **상대 상승폭은 기준선 대비 +100–300%로 크지만, 절대값은 작다.** v4 매출 재계산 기준으로 하루 20설치면 12개월째 월 약 6–7만 원이다. 중단선(W8 DAU 80)을 넘으려면 ASO 밖의 유입(공유 그리드, TikTok, 피처링)이 반드시 필요하다.

### 5.2 퍼즐 1위에 필요한 다운로드 (추정, ×3 불확실)
- 기준점:
  - 2025 Q4에 미국 퍼즐 1위권이던 Block Blast는 주간 56.5만–100만 건(하루 8–14만)이었다 [S3].
  - 2017 Reflection 자료에서 무료 게임 상위 10 진입선은 US 26.5K, UK 6.3K, FR 3.5K, DE 2.6K, IT 1.6K/일이었다 [S4].
- 지금 퍼즐 상위 10은 23개 스토어 거의 모두에서 Block Out!, Meowdoku!, Magic Sort!, Block Blast!, Bus Fever 같은 UA 대형작이 차지한다. **1위 Meowdoku: US·UK·CA·AU·JP·TW·HK·NL·PL·NZ** [M3].

| 스토어 | 퍼즐 1위 추정 (하루 iOS) | ASO 단독과의 차이 |
|---|---|---|
| US | 5만–14만 | 약 5,000배 — 불가 |
| UK / JP / DE / FR | 3천–3만 | 수백~수천 배 — 불가 |
| KR / TW / HK | 2천–8천 (KR은 Block Blast 1위) | 수백 배 |
| **NZ / IE** (Tier-1, 영어) | **약 400–3,000** (UK × 인구비, 매우 거침) | 수십~백 배 — 피처링 + 바이럴 급증이 1–2일 겹치면 가능권 |
| DK / NO / FI | 약 400–3,000 | 영어 기본 스토어, 같은 수준 |
| LU / IS / MT | 수십~수백 | 기술적으로는 가장 쉽지만 의미가 적다(Reality Checker가 지적할 "허영 1위") |

### 5.3 먼저 겨냥할 시장
1. **뉴질랜드 + 아일랜드**(영어, en-AU/en-GB 필드, Tier-1 eCPM). 출시 당일 NZ가 하루를 가장 먼저 시작하므로, 데일리 공유 그리드가 퍼지는 첫 시장으로 맞춘다. 1위 시도는 "출시 피처링 + TikTok 하루 집중"과 묶는다.
2. **대만·홍콩**(zh-Hant 인앱, 點燈 키워드, 2027-02-20 원소절 이벤트와 지명). 등불이라는 문화 맥락이 맞는 유일한 시장이다. 단 Tier-1 광고 시장은 아니다.
3. **한국**(개발자 모국어, 한국 에디터 대상 1인 개발 이야기, "더스크윅" 한글 이름). 1위 문턱이 높다.
4. 장기: **일본**(Nikoli의 본고장, 논리 퍼즐 문화, iOS 점유율이 높음). 脳トレ·ロジックパズル로 꾸준히 올린다. 1위 목표가 아니라 ARPDAU 시장이다.

### 5.4 다음 라운드에 측정할 것
- 출시 2주·4주에 키워드 순위 표(위 45개 검색어 × 5개 스토어)를 다시 잰다. 같은 스크립트로 잰다.
- ASC 분석: 노출 → 상품 페이지 → 다운로드 전환율(소스별 검색과 둘러보기 구분). PPO 결과.
- 메타데이터만 현지화한 언어의 설치와 리뷰에 "영어 게임"이라는 불만이 나오는지.

---

## 출처

**Apple 공식**
- [A1] App Store localizations(스토어별 기본·보조 색인 언어 표): https://developer.apple.com/help/app-store-connect/reference/app-store-localizations/
- [A2] Screenshot specifications: https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications/
- [A3] App preview specifications: https://developer.apple.com/help/app-store-connect/reference/app-information/app-preview-specifications/
- [A4] Product Page Optimization: https://developer.apple.com/app-store/product-page-optimization/
- [A5] In-App Events: https://developer.apple.com/app-store/in-app-events/
- [A6] App Review Guidelines 2.3.7(메타데이터·상표), 5.6.1(리뷰 API): https://developer.apple.com/app-store/review/guidelines/ · 2.3.7 상표 거절 사례(포럼): https://developer.apple.com/forums/thread/791158
- [A7] Getting featured / Nominations template: https://developer.apple.com/app-store/getting-featured · https://developer.apple.com/help/app-store-connect/reference/nominations/nominations-template

**직접 측정 (2026-10-17, 스크립트는 세션 scratchpad `aso/kw.py`, `meta.py`)**
- [M1] App Store 검색 자동완성(MZSearchHints, X-Apple-Store-Front 스토어 지정), 약 190개 키워드 × 26개 스토어
- [M2] iTunes Search API 상위 10 평점 중앙값: https://itunes.apple.com/search (약 60회 뒤 403으로 차단)
- [M3] Apple RSS 퍼즐(genre 7012) 무료 상위 10, 23개 스토어: `https://itunes.apple.com/{cc}/rss/topfreeapplications/limit=10/genre=7012/json`
- [M4] iTunes Lookup(Meowdoku id6761760135: 2026-05-19 출시, 평점 33.6만, 4.81, 언어 약 60개 / Sudoku.com id1193508329) · Meowdoku 상품 페이지(부제, 이벤트): https://apps.apple.com/us/app/meowdoku/id6761760135

**2차 자료**
- [S1] 스크린샷 캡션 색인 논쟁(Appfigures 2025-06 주장 인용, ConsultMyApp 64구문 시험): https://appdrift.co/blog/app-store-screenshot-text-indexing · https://splitmetrics.com/blog/apple-app-store-ranking-factors/
- [S2] CPP 자연 검색 키워드(2025-07), 70개(2025-10): https://adapty.io/blog/custom-product-pages-app-store/ · https://stora.sh/blog/2026-05-13-custom-product-pages-70-keyword-linking-aso-guide
- [S3] Sensor Tower 2025 Q4 iOS 미국 퍼즐 상위 5: https://sensortower.com/blog/2025-q4-ios-top-5-puzzle-games-units-us-64bc1644e1714cfff1e615fc
- [S4] PocketGamer.biz / Reflection, 2017 차트 진입 다운로드: https://www.pocketgamer.biz/comment-and-opinion/67142/sponsored-app-stores-top-ranking-download-requirements/
- [S6] Udonis 국가별 전면 광고 eCPM(2021–22): https://blog.udonis.co/mobile-marketing/mobile-apps/ecpms
- [S7] Appodeal Mobile eCPM Report Q4 2024: https://appodeal.com/the-mobile-ecpm-report-updated-q4-2024-view
- [S8] Smartyads 국가 티어: https://smartyads.com/blog/interstitial-ad-networks
- [S9] Google Regional Monetization Pause(러시아 AdMob 정지, 2025-01): https://support.google.com/publisherpolicies/answer/15766875
- [S10] Lantern Festival 2027 날짜: https://en.wikipedia.org/wiki/Lantern_Festival
- 내부: docs/naming.md(Akari USPTO), docs/app-store-connect-pack.md §5, playtest/BENCHMARK-CUTE.md §3.9, playtest/ANALYSIS-r6.md, docs/ads-plan.md §4, HANDOFF.md(v4 매출)

**AI 페르소나가 아닌 실측이지만 대리값이다.** 자동완성과 평점 수는 검색량이나 다운로드 수가 아니다. eCPM과 iPhone 수, 1위 문턱은 거친 추정이다(±50%~×3). 현지어 문구는 원어민 검토 전 초안이다.
