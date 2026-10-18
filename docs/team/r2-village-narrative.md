# R2 마을 내러티브 — 주민 7명의 말투, 대사, 선택 규칙, 현지화 (Narrative Designer, 2026-10-17)

> 입력: `TEAM.md`, `DECISIONS.md`(라운드 2), `r2-village-design.md`(시스템 정본), `r1-visual.md`(친구 7명), `i18n-glossary.md`, `playtest/shots/wick-v2/03-wick-friends.png`.
> 산출: 이 문서 + **`docs/team/r2-village-lines.en.json`**(구현용 영어 정본: id · resident · trigger · cond · ship · text).
> 코드는 건드리지 않았다. 대사 수치·임계값 중 `[P]`는 가설이다. 페르소나 평가는 하지 않았다(사람 데이터 0).

## 0. 결론

- **대사는 마을에서만, 1탭 = 1줄(≤60자, SE 말풍선 2줄)**. 판 화면은 지금처럼 말이 없다. 결과 시트에 넣는다면 주민 **의성어 1개**까지만 허용한다(예: "Hop!").
- 주민마다 **말투 기둥 + 의성어 말버릇 1개**. 말버릇은 단어가 아니라 소리라서 언어마다 새로 쓴다(동물의 숲 현지화 방식, §1).
- **죄책감 0**: 오래 안 와도 "반가워요"와 "그사이 좋은 일이 있었다"만 말한다. 일수를 세거나 "왜 안 왔어"라고 하지 않는다. 빌드 스크립트의 금지어 린트가 이를 검사한다.
- 주민별 줄 수: Wick 42, Momo 30, Sage 30, Luna 30, Pip 30, Kuri 30, Yuki 31. 합계 **223줄**(편지는 1통 = 1줄로 셈), 그중 1.0 출시분 **195줄**, 나머지는 1.1.
- **R4(DECISIONS 라운드 3, 마을 전체판)**: 1.0 = `chat`·`puzzle.hard`를 뺀 모든 줄 + 호스트 3줄(장터 고름, 장터 잠김, 방 엽서) = **195줄**. 주민 7명, 시간대 4개, 계절, 장터, 부탁, 편지, 엽서가 모두 들어간다. 10개 언어 모두 195줄이다(§8·§9).

---

## 1. 벤치마크 — 코지 게임은 주민 대사를 어떻게 쓰나

**근거 표기**
- [S]: 이번 세션에서 검색으로 확인했다. 다만 2차 보도 기준이다.
- [K]: 장르 지식이다. **이번 세션은 웹 검색 한도에 걸려(2회 뒤 차단) 다시 확인하지 못했다.** 출시 전 1차 자료로 확인해야 한다.

| 게임 | 성격 모델 | 줄 길이·말버릇 | 시간·계절·관계에 따른 변화 | 편지·선물 | 우리가 가져올 것 / 버릴 것 |
|---|---|---|---|---|---|
| **Animal Crossing** (New Leaf / New Horizons) | 성격 **8종** 템플릿(남 4: lazy·jock·cranky·smug / 여 4: normal·peppy·snooty·big sister). smug·big sister는 New Leaf에서 추가됐다 [S1] | 주민마다 고유 말버릇이 있고 대사 끝에 붙는다. 말풍선 1–3줄을 탭해 넘긴다 [K]. 현지화 팀은 **모든 이름을 바꾸고 말버릇을 새로 썼다** [S2]. Treehouse는 주민이 "당신이 아는 사람들처럼" 말하게 써서 현대적 표현도 허용한다고 했다 [S3] | 시간대 인사, 밤에는 잠, 날씨·계절·행사 대사, 생일, 숨은 우정 점수에 따른 대사와 선물·사진 [K] | 편지에 선물을 동봉하고, 플레이어도 편지를 쓴다 [K] | **가져올 것**: 성격 템플릿 + 개별 말버릇 구조, 말버릇을 언어별로 재창작. **버릴 것**: 오래 비우면 잡초·바퀴벌레·떠나는 주민, "어디 갔었어" 대사(구작부터 이어진 부재 처벌) [K]. 모든 대사 끝에 말버릇 붙이기(번역 부담이 크고 닌텐도 문법을 닮는다). Animalese, Nook, 벨 같은 이름 |
| **Neko Atsume** (Hit-Point) | 고양이마다 짧은 프로필과 성격 한 줄 [K] | 대사가 거의 없다. 제작자는 "보고 즐기는" 게임을 의도했다 [S4]. 영어판은 8-4가 현지화했다 [S5] | 시간보다 "닫은 사이 누가 왔나"가 변화의 축이다 | 떠난 고양이가 **멸치(재화)와 기념품**을 남긴다. 선물 자체가 대사다 [S6] | **가져올 것**: 말 없는 선물도 성격을 전한다 → 같은 날 두 번째 선물은 편지 없이 **꼬리표 한 줄**(§3.4). 짧은 방문 |
| **Cats & Soup** (Hidea) | 고양이는 말을 거의 하지 않는다. 성격은 동작·의상으로 드러난다 [K, 불확실] | 글은 UI에 몰려 있다 [K] | 자리를 비워도 진행된다(방치형) [K] | 이벤트 보상 중심 [K] | **가져올 것**: 판 화면은 말 대신 표정과 소리(이미 Wick 리그가 있다). 5천만 다운로드 [r1 V12] |
| **Tsuki's Odyssey** (HyperBeard) | 도시 생활을 그만두고 버섯 마을로 온 토끼 Tsuki와 마을 동물들 [K, 미확인] | 짧고 느린 대사, 서두르지 않는 톤 [K] | 실시간으로 생활이 흐르고, 돌아오면 그사이의 일이 기다린다. 처벌 없는 시간 게이트 [K · design §1.1] | 우편함 [design §1.1] | **가져올 것**: 부재를 "그사이 좋은 일"로 쓴다(Sage: "없는 동안 새 잎이 났어요") |
| (참고) Hello Kitty Island Adventure | 캐릭터마다 좋아하는 선물이 있고, 우정 단계마다 대사가 열린다 [K · design §1.1] | — | 우정 단계 | 좋아하는 선물 | 우정 3·5단계 한정 대사(§2 `friend.level`) |

### 1.1 벤치마크 → 작법 규칙 10개

1. **성격 = 말투 기둥 4개**(어휘, 리듬, 피하는 주제, 말버릇). 7명이 같은 상황(퍼즐 완료)에 서로 다른 말을 해야 한다. 표 아래 "같은 순간, 7개의 목소리" 참고.
2. **1탭 1줄, en ≤ 60자**. 편지만 2–3줄이다. 한 줄에 정보 1개.
3. **설명하지 않는다**: 규칙, 버튼, 수치를 주민 입으로 설명하지 않는다. 장터 안내조차 "또 와요"(희소성 부정)만 말한다.
4. **유머는 작은 결점에서 나온다**: Sage의 낮잠, Kuri의 목도리가 된 다른 물건, Momo의 연습한 인사, Pip의 과한 응원. 비꼬기, 남 깎아내리기, 아기 말투는 쓰지 않는다(r1 §1.2 "귀엽지만 유치하지 않게").
5. **부재 처벌 0**: `return` 계열은 반가움 + 세계가 친절하게 계속됐다는 사실만 말한다. 금지어: missed you, where were you, why didn't, hurry, last chance, don't forget, finally, you left(빌드 린트).
6. **연애 0**: 사랑 고백, 호칭 love·dear·honey, 질투, 단둘이 데이트를 쓰지 않는다. 최고 우정(5단계)도 "와 준 게 당신이라 다행"까지만 간다.
7. **압박 0**: 부탁은 마감이 없고, 다시 말할 때는 "천천히"를 붙인다. "오늘만", 숫자 카운트다운, 빨간 점은 쓰지 않는다.
8. **플레이어 성별·이름을 모른다고 가정한다**: 호칭은 "you"뿐이다. 각 언어에서 성별 일치가 생기는 표현은 피한다(§5.3).
9. **말버릇은 소리다**: `{cp}` 토큰으로 넣고 언어별 의성어표(§5.2)로 바꾼다. 한 대사에 많아야 2번, 주민 대사의 1/3 이하에만 쓴다.
10. **관계는 대사에서 보인다**: 이웃 이야기(`chat`)는 그 이웃이 이사 온 뒤에만 나온다(`cond.requires`).

**같은 순간, 7개의 목소리 (`puzzle.solved`)**

| Wick | Momo | Sage | Luna | Pip | Kuri | Yuki |
|---|---|---|---|---|---|---|
| Nicely lit. I watched from the stepping stone. | You did it! Um. I clapped. You didn't see. | Mm. I'd have napped halfway. You didn't. | Every lantern in place. Like a constellation! | You did it! Hop! Hop! I knew it! | Well done. That deserves a biscuit. Here. | Oh. Pretty. |

---

## 2. 주민 7명 — 말투 기둥과 대사

**공통**
- 이사: litDays 0 Wick · 1 Momo · 2 Sage · 4 Luna · 7 Pip · 10 Kuri · 14 Yuki(design §2.1).
- 좋아하는 가구 계열(`likes`)은 design §2.6의 계열 이름을 쓴다: lighting · seating · table · bed · plant · storage · rug · wall · small.
- 부탁은 그 주민 `likes`의 첫 계열부터 돌아가며 연다.
- 표의 `{cp}`는 영어 말버릇으로 바꿔 보여 준다. JSON에는 토큰 그대로 들어 있다.
- 한국어 말투: Pip만 반말이고 나머지는 해요체다(§5.1).

### 2.1 Wick 윅 — 든든한 길잡이, 마을의 주인 목소리
| 항목 | 내용 |
|---|---|
| 핵심 | 겉으로 바라는 것: 모두의 창에 불이 켜져 있는 것. 정말 필요한 것: 자기도 누군가에게 기대도 된다는 것 |
| 어휘·리듬 | 쉬운 단어, 중간 길이의 평서문. "우리", "여기"를 쓴다. 빛·길·의자 같은 사물로 말한다 |
| 피하는 주제 | 규칙 설명, 숫자, 해야 할 일, 광고, 연속 기록 |
| 말버릇 | `{cp}` = 등불 켜지는 소리 **Pom / 퐁 / ぽっ** (design §2.4의 "퐁" 목소리와 같은 소리) |
| 속뜻 | 말한 그대로다. 다정하지만 짧다 |
| 좋아하는 계열 | lighting, table |
| 절대 안 할 말 | "Don't forget to play today's puzzle!"(해야 할 일) · "You've been gone 5 days."(일수 세기) · "Watch an ad for a bonus gift!"(광고) |
| **호스트 규칙** | 소식이 있을 때만 먼저 말한다(첫 방문, 이사, 이사 전날, 우편, 계절 바뀜). 방문 한 번에 호스트 대사는 1줄, 첫 방문만 2줄. 판 화면에서는 말하지 않는다 |

| trigger | 조건 | 출시 | English (≤60) | 한국어 |
|---|---|---|---|---|
| `host` | event=firstVillageVisit | 1.0 | Welcome. This is our village. Small, for now. | 어서 와요. 여기가 우리 마을이에요. 아직은 작죠. |
| `host` | event=firstVillageVisit | 1.0 | Every light you make gives someone a home. | 불을 하나 켤 때마다 누군가의 집이 생겨요. |
| `host` | event=mailWaiting | 1.0 | Something came for you. The mailbox looks proud. | 편지가 왔어요. 우편함이 신나 보여요. |
| `host` | event=moveInEve | 1.0 | That dark window? Someone's coming tomorrow. | 저기 불 꺼진 창 보여요? 내일 누가 이사 와요. |
| `host` | event=residentMovedIn | 1.0 | Someone new moved in. Say hi whenever you like. | 새 이웃이 왔어요. 편할 때 인사해 줘요. |
| `host` | event=marketOpen | 1.0 | Pick one you like. The others will come around again. | 마음에 드는 걸 하나 골라요. 나머지는 다음에 또 나와요. |
| `host` | event=firstCabinVisit | 1.0 | This is your room. Put things wherever feels right. | 여기가 오두막 안이에요. 마음 가는 곳에 놓아 봐요. |
| `host` | event=seasonChanged | 1.0 | The season turned while we weren't looking. Pom. | 어느새 계절이 바뀌었네요. 퐁. |
| `host` | event=marketPicked | 1.0 | Good pick. It'll look nice somewhere. | 잘 골랐어요. 어디에 둬도 예쁠 거예요. |
| `host` | event=marketLocked | 1.0 | The stall opens once a lantern is lit today. No rush. | 오늘 등불을 하나 켜면 장터가 열려요. 천천히요. |
| `host` | event=postcardTaken | 1.0 | Nice room. It looks properly lived-in now. | 방 예쁘네요. 이제 정말 사는 집 같아요. |
| `move_in` |  | 1.0 | I'm Wick. I keep the lamps. And an eye on things. | 저는 윅이에요. 등불을 돌보고, 마을도 살펴요. |
| `move_in` |  | 1.0 | The cabin by the gate is yours. I'm right next door. | 입구 오두막이 이웃님 집이에요. 저는 바로 옆집이고요. |
| `greet` | time=dawn | 1.0 | Early. The lanterns are still yawning. | 일찍 왔네요. 등불들이 아직 하품 중이에요. |
| `greet` | time=day | 1.0 | Good day. The village is quiet and doing fine. | 안녕하세요. 마을은 오늘도 조용하고 평안해요. |
| `greet` | time=dusk | 1.0 | Dusk. My favorite hour. Everything's a bit gold. | 해 질 녘이네요. 다 금빛이라 제일 좋아하는 때예요. |
| `greet` | time=night | 1.0 | Late night? Me too. The lights don't mind. | 늦은 밤이네요. 저도 깨어 있어요. 등불도요. |
| `greet` | minLevel=2 | 1.0 | Ah, it's you. The path got brighter just now. | 아, 왔군요. 방금 길이 더 환해졌어요. |
| `puzzle.solved` |  | 1.0 | Nicely lit. I watched from the stepping stone. | 잘 밝혔어요. 디딤돌에서 다 지켜봤어요. |
| `puzzle.solved` |  | 1.0 | Clean and calm. That's the way. Pom. | 깔끔하고 차분했어요. 그렇게 하면 돼요. 퐁. |
| `puzzle.hard` |  | 1.1 | That one was a thinker. Sit a while. | 생각할 게 많은 판이었죠. 좀 쉬어요. |
| `puzzle.hard` |  | 1.1 | I got worried twice. You didn't. Well done. | 저는 두 번이나 걱정했는데, 끄떡없었죠. 잘했어요. |
| `return` |  | 1.0 | There you are. Everything kept glowing. | 왔군요. 다들 그대로 반짝이고 있었어요. |
| `return` |  | 1.0 | Welcome back. Your bench is still warm. Somehow. | 어서 와요. 벤치가 아직 따뜻해요. 신기하죠? |
| `season` | season=spring | 1.0 | Spring. Sage keeps waking up in new pots. | 봄이에요. 세이지가 자꾸 새 화분에서 깨요. |
| `season` | season=summer | 1.0 | Long evenings. More dusk for everyone. | 저녁이 길어졌어요. 노을도 그만큼 길어요. |
| `season` | season=autumn | 1.0 | Leaves on the path. I like how they crunch. | 길에 낙엽이 쌓였어요. 바스락 소리가 좋아요. |
| `season` | season=winter | 1.0 | Winter. Lanterns look their best in the cold. | 겨울이에요. 등불은 추울 때 제일 예뻐요. |
| `request.ask` | category=lighting | 1.0 | Your cabin corner is dark. Any lamp would do. | 오두막 구석이 좀 어둡네요. 등 하나면 될 텐데요. |
| `request.ask` | category=table | 1.0 | A little table, maybe? Somewhere to set the tea. | 작은 탁자 하나 어때요? 찻잔 둘 데가 있게요. |
| `request.again` |  | 1.0 | That lamp idea still stands. Whenever. Pom. | 그 등 얘기, 생각나면 해요. 천천히요. 퐁. |
| `request.visit` |  | 1.0 | There. Nobody sits in the dark now. | 이제 어두운 데 앉을 일이 없겠어요. |
| `letter.move_in` |  | 1.0 | Hello, / This lamp was the first one I ever lit. / It's yours now. Welcome home. — Wick | 안녕하세요, / 제가 처음으로 켠 등불이에요. / 이제 이웃님 거예요. 잘 왔어요. — 윅 |
| `letter.gift` |  | 1.0 | Hello, / The lantern jar is full again. Your doing. / Here's something for the room. — Wick | 안녕하세요, / 등불 병이 또 가득 찼어요. 덕분이에요. / 방에 두라고 하나 보내요. — 윅 |
| `letter.thanks` |  | 1.0 | Hello, / The corner's lit now. People stop there to talk. / Thank you. — Wick | 안녕하세요, / 구석에 불이 켜졌어요. 다들 거기 모여 얘기해요. / 고마워요. — 윅 |
| `letter.return` |  | 1.0 | Hello, / The village kept your place warm. / Nothing's missing. Come by anytime. — Wick | 안녕하세요, / 마을이 자리를 따뜻하게 지켜 뒀어요. / 다 그대로예요. 언제든 놀러 와요. — 윅 |
| `gift.tag` |  | 1.0 | One more, for the room. | 방에 하나 더 두세요. |
| `friend.level` | level=3 | 1.0 | You know, the village talks about you. All good things. | 있잖아요, 마을에서 다들 이웃님 칭찬을 해요. |
| `friend.level` | level=5 | 1.0 | I'm glad it was you who came. Truly. | 와 준 게 이웃님이라서 참 다행이에요. 진심이에요. |
| `chat` | requires=['pip'] | 1.1 | Pip cheered for a leaf today. The leaf seemed pleased. | 오늘 핍이 나뭇잎을 응원했어요. 잎도 좋아했어요. |
| `chat` | requires=['momo'] | 1.1 | Momo waved at me today. Then hid. Progress. | 오늘 모모가 손을 흔들었어요. 그리고 숨었죠. 발전이에요. |
| `tap.again` |  | 1.0 | Still here. I usually am. Pom. | 여기 있어요. 늘 여기 있죠. 퐁. |

### 2.2 Momo 모모 — 칭찬받으면 빨개지는 수줍음쟁이
| 항목 | 내용 |
|---|---|
| 핵심 | 바라는 것: 눈에 띄지 않기. 필요한 것: 눈에 띄어도 괜찮다는 경험 |
| 어휘·리듬 | 짧은 문장, "음…", "저기…", 말줄임표, 스스로 고쳐 말하기("앗, 너무 컸다") |
| 피하는 주제 | 자기 칭찬. 칭찬을 받으면 다른 사람에게 돌린다 |
| 말버릇 | `{cp}` = 작게 놀라는 소리 **Eep / 힛 / ひゃっ** |
| 속뜻 | 많다. "괜찮아요"는 사실 무척 기쁘다는 뜻이다 |
| 좋아하는 계열 | seating(쿠션), plant(꽃) |
| 절대 안 할 말 | "I'm the cutest one here!" · "Obviously I did great." · "Talk to me more, okay?"(요구) |
| 성장 | 1단계엔 숨고, 2단계 인사는 "이번엔 안 숨었어요", 5단계엔 먼저 선물을 만든다 |

| trigger | 조건 | 출시 | English (≤60) | 한국어 |
|---|---|---|---|---|
| `move_in` |  | 1.0 | Oh—hi. I'm Momo. I practiced saying hello. Eep. | 아, 안녕하세요. 모모예요. 인사 몰래 연습했어요. 힛. |
| `move_in` |  | 1.0 | You lit this house? For… me? Oh. Thank you. | 이 집에 불 켜 준 거예요? 저를… 위해서요? 고마워요. |
| `greet` | time=dawn | 1.0 | Morning… I meant to fix my petal first. | 좋은 아침… 꽃잎 정리하고 나오려 했는데… |
| `greet` | time=day | 1.0 | Hi! Oh, that was loud. Hi. | 안녕하세요! 앗, 너무 컸다. …안녕하세요. |
| `greet` | time=dusk | 1.0 | The sky's pink now. It's showing off. I like it. | 하늘이 분홍빛이에요. 오늘은 하늘이 멋 부렸나 봐요. |
| `greet` | time=night | 1.0 | You're up late too? Let's be quiet together. | 아직 안 자요? 그럼 같이 조용히 있어요. |
| `greet` | minLevel=2 | 1.0 | Hi! I didn't even hide this time. Progress! | 안녕하세요! 이번엔 안 숨었어요. 저 많이 늘었죠? |
| `puzzle.solved` |  | 1.0 | You did it! Um. I clapped. You didn't see. | 해냈네요! 음… 박수 쳤어요. 못 봤겠지만요. |
| `puzzle.solved` |  | 1.0 | That was lovely. Like petals opening, one by one. | 꽃잎이 한 장씩 피어나는 것 같았어요. |
| `puzzle.hard` |  | 1.1 | I watched. I forgot to breathe. You did it! | 보고 있었어요. 숨 쉬는 걸 잊었어요. 해냈네요! |
| `puzzle.hard` |  | 1.1 | That was hard, wasn't it? You looked so calm. | 어려웠죠? 그런데 정말 침착해 보였어요. |
| `return` |  | 1.0 | Oh! Hi! I saved you the good cushion. | 앗! 안녕하세요! 제일 폭신한 방석 맡아 뒀어요. |
| `return` |  | 1.0 | You're here. I was hoping. Um. Hi. | 왔네요. 오길 바랐어요. 음… 안녕하세요. |
| `season` | season=spring | 1.0 | Blossom season. I blend right in. So relaxing. | 꽃 피는 철이에요. 꽃 사이에 숨으면 아무도 몰라요. |
| `season` | season=summer | 1.0 | It's warm. My cheeks are pink for real reasons now. | 더워요. 이번엔 진짜 더워서 빨개진 거예요. |
| `season` | season=autumn | 1.0 | The leaves are turning red. I know the feeling. | 잎이 빨개지네요. 그 마음 알 것 같아요. |
| `season` | season=winter | 1.0 | Cold noses, pink cheeks. Everyone matches me! | 코도 볼도 빨개요. 다들 저랑 똑같아요! |
| `request.ask` | category=seating | 1.0 | Um… a cushion, maybe? For sitting bravely. | 저기… 방석 하나 있을까요? 앉으면 용기가 나서요. |
| `request.ask` | category=plant | 1.0 | Could there be flowers somewhere? Only if it's easy. | 오두막에 꽃이 있으면 좋겠어요. 어렵지 않으면요. |
| `request.again` |  | 1.0 | The cushion thing… no rush. Really. Eep. | 그 방석 얘기… 천천히요. 정말이에요. 힛. |
| `request.visit` |  | 1.0 | I'm sitting in your room! Is this okay? It's okay. | 오두막에 앉아 있어요! 괜찮죠? 괜찮을 거예요. |
| `letter.move_in` |  | 1.0 | Um, hello, / I hugged this cushion whenever I got scared. / Now it's yours. — Momo | 저, 안녕하세요, / 무서울 때마다 꼭 안고 있던 방석이에요. / 이제 이웃님 거예요. — 모모 |
| `letter.gift` |  | 1.0 | Um, hello, / I saw this and thought of your room. / I hope that's not strange. Eep. — Momo | 저, 안녕하세요, / 이걸 보자마자 오두막이 생각났어요. / 이상한 건 아니죠? 힛. — 모모 |
| `letter.thanks` |  | 1.0 | Um, hello, / I sat in your room. I wasn't scared at all. / Thank you. Truly. — Momo | 저, 안녕하세요, / 오두막에 앉아 봤어요. 하나도 안 무서웠어요. / 정말 고마워요. — 모모 |
| `gift.tag` |  | 1.0 | Me again. Sorry! Eep. | 또 저예요. 미안해요! 힛. |
| `friend.level` | level=3 | 1.0 | Can I tell you something? I like when you visit. | 있잖아요… 놀러 와 줄 때마다 좋아요. |
| `friend.level` | level=5 | 1.0 | I made you something. Open it after I leave. Eep! | 선물 만들었어요. 제가 가고 나면 열어 봐요. 힛! |
| `chat` | requires=['luna'] | 1.1 | Luna knows every star. I only know the pink ones. | 루나는 별을 다 알아요. 저는 분홍 별만 알아요. |
| `chat` | requires=['pip'] | 1.1 | Pip cheered for me today. I hid in a flower. | 핍이 오늘 저를 응원했어요. 꽃 뒤에 숨었어요. |
| `tap.again` |  | 1.0 | Eep! Oh—it's you. Hi again. | 힛! 아, 깜짝이야. 또 안녕하세요. |

### 2.3 Sage 세이지 — 화분에서 낮잠 자는 정원사
| 항목 | 내용 |
|---|---|
| 핵심 | 바라는 것: 방해받지 않는 낮잠. 필요한 것: 이미 그렇게 하고 있는 천천히 사는 법을 남과 나누기 |
| 어휘·리듬 | 식물 단어, 느리고 긴 호흡, 문장 중간의 "음…", 마지막에 짧게 뒤집는 농담("Mostly naps.") |
| 피하는 주제 | 시계, 서두름, 경쟁 |
| 말버릇 | `{cp}` = 하품 **Fwaah / 하암 / ふぁ〜** |
| 속뜻 | 적다. 우연히 지혜로운 말을 하고 본인은 모른다 |
| 시간대 | 새벽에 물 주기(design §2.7), 밤엔 졸림 |
| 좋아하는 계열 | plant, rug |
| 절대 안 할 말 | "Quick! The flowers need you NOW!" · "You should water daily or they'll die." (시들기는 없다) · "Let's go, go, go!" |

| trigger | 조건 | 출시 | English (≤60) | 한국어 |
|---|---|---|---|---|
| `move_in` |  | 1.0 | Mm… hello. I was napping in your flowerpot. Sorry. | 음… 안녕하세요. 화분에서 깜빡 잠들었어요. 미안해요. |
| `move_in` |  | 1.0 | I'm Sage. I grow things. Slowly. Like me. | 세이지예요. 이것저것 키워요. 천천히요. 저처럼요. |
| `greet` | time=dawn | 1.0 | Dawn watering. The plants drink. I… mm… yawn. | 새벽 물 주기예요. 식물은 마시고, 저는… 하품해요. |
| `greet` | time=day | 1.0 | Sunny. Good for leaves. Good for naps. Mostly naps. | 해가 좋아요. 잎에도 좋고, 낮잠에도 좋아요. |
| `greet` | time=dusk | 1.0 | Dusk. The flowers are closing. I'll follow their lead. | 해 질 녘이에요. 꽃들이 오므리네요. 저도 따라 할래요. |
| `greet` | time=night | 1.0 | Fwaah… still up? Even the moss is asleep. | 하암… 아직 안 자요? 이끼도 자는데요. |
| `greet` | minLevel=2 | 1.0 | Oh, you. I'd wake up for you. I just did, in fact. | 아, 왔군요. 그럼 일어나야죠. 방금 깼어요. |
| `puzzle.solved` |  | 1.0 | Nicely done. Like each seed in its own spot. | 잘했어요. 씨앗을 한 알씩 제자리에 심은 것 같아요. |
| `puzzle.solved` |  | 1.0 | Mm. I'd have napped halfway. You didn't. | 음. 저였으면 중간에 잤을 거예요. 대단해요. |
| `puzzle.hard` |  | 1.1 | That took a while. Slow work grows deep roots. | 오래 걸렸죠. 오래 걸린 게 뿌리가 깊어요. |
| `puzzle.hard` |  | 1.1 | Hard one. Here, sit in my pot. Very restful. | 어려웠죠. 여기, 제 화분에 앉아요. 푹 쉬어져요. |
| `return` |  | 1.0 | Back already? I only just woke up. | 벌써 왔어요? 저 방금 일어났는데요. |
| `return` |  | 1.0 | A new leaf came out while you were away. Look. | 그사이 새 잎이 났어요. 봐요. |
| `season` | season=spring | 1.0 | Spring. Everything wants to grow. Even me, a bit. | 봄이에요. 다들 자라고 싶어 해요. 저도 조금요. |
| `season` | season=summer | 1.0 | Too sunny. I'm napping in the shade of a fern. | 너무 쨍해요. 고사리 그늘에서 잘래요. |
| `season` | season=autumn | 1.0 | Seeds everywhere. Next year is already planning. | 씨앗이 여물었어요. 내년 봄이 벌써 준비 중이에요. |
| `season` | season=winter | 1.0 | The garden is resting. So am I. It's only fair. | 정원이 쉬어요. 저도 쉬어요. 공평하죠. |
| `request.ask` | category=plant | 1.0 | A little plant for your windowsill? The light's good. | 창가에 작은 화분 하나 어때요? 볕이 좋아요. |
| `request.ask` | category=rug | 1.0 | Something soft underfoot? For… napping. Obviously. | 바닥에 폭신한 러그 하나 어때요? 낮잠용으로요. |
| `request.again` |  | 1.0 | Still thinking about that plant. Plants are patient. | 그 화분 아직 생각 중이에요. 식물은 기다려 줘요. |
| `request.visit` |  | 1.0 | Your plant and I are getting along. Mm. Nap time. | 새 화분이랑 친해졌어요. 음. 낮잠 시간이에요. |
| `letter.move_in` |  | 1.0 | Mm, hello, / An empty pot. What grows in it is up to you. / Fwaah. — Sage | 음, 안녕하세요, / 빈 화분이에요. 뭘 심을지는 이웃님 마음이에요. / 하암. — 세이지 |
| `letter.gift` |  | 1.0 | Mm, hello, / Found this while weeding. Well, while napping. / For your room. — Sage | 음, 안녕하세요, / 풀 뽑다가 찾았어요. 사실은 졸다가요. / 방에 놓아 줘요. — 세이지 |
| `letter.thanks` |  | 1.0 | Mm, hello, / I napped in your room. Best nap this season. / Thank you. Fwaah. — Sage | 음, 안녕하세요, / 오두막에서 낮잠 잤어요. 올해 최고의 낮잠이에요. / 고마워요. 하암. — 세이지 |
| `gift.tag` |  | 1.0 | Mm. Another one. Fwaah. | 음, 하나 더 있어요. 하암. |
| `friend.level` | level=3 | 1.0 | You come back like spring does. Quietly. Good. | 봄처럼 와 주네요. 조용히요. 좋아요. |
| `friend.level` | level=5 | 1.0 | I planted something for you. It'll take a while. Worth it. | 이웃님 몫으로 하나 심었어요. 오래 걸려도 기다릴 만해요. |
| `chat` | requires=['kuri'] | 1.1 | Kuri brought tea. I woke up for it. Mostly. | 쿠리가 차를 가져왔어요. 그래서 깼어요. 거의요. |
| `chat` | requires=['momo'] | 1.1 | Momo hid behind my tulips again. They didn't mind. | 모모가 또 튤립 뒤에 숨었어요. 튤립은 괜찮대요. |
| `tap.again` |  | 1.0 | Mm? Oh. I was resting my eyes. Both of them. | 음? 아. 눈 좀 감고 있었어요. 두 눈 다요. |

### 2.4 Luna 루나 — 잘 시간에도 별 보는 몽상가
| 항목 | 내용 |
|---|---|
| 핵심 | 바라는 것: 밤이 더 길기를. 필요한 것: 같이 하늘을 볼 사람 |
| 어휘·리듬 | 질문형, 하늘·별·달, 지어낸 별 이야기("등불은 남기로 한 별"). 실제 천문 지식은 쓰지 않는다(사실 오류와 설명조를 피한다) |
| 피하는 주제 | 집안일, 아침 일정 |
| 말버릇 | `{cp}` = 반짝 **Twinkle / 반짝 / きらっ** |
| 속뜻 | 중간. 엉뚱해 보이지만 상대를 잘 본다("오래 들여다봤죠") |
| 시간대 | 밤에 가장 활발하고, 새벽엔 별을 세다 놓친다 |
| 좋아하는 계열 | wall(시계·액자), lighting |
| 절대 안 할 말 | "Actually, that star is 600 light-years away." (설명조) · "Stars are boring in summer." · "Get to bed." |

| trigger | 조건 | 출시 | English (≤60) | 한국어 |
|---|---|---|---|---|
| `move_in` |  | 1.0 | Hello! Is it night yet? I'm Luna. I watch the sky. | 안녕하세요! 밤이에요? 루나예요. 하늘 보는 게 좋아요. |
| `move_in` |  | 1.0 | Your village has very good sky. I checked. | 이 마을은 하늘이 참 좋네요. 제가 확인했어요. |
| `greet` | time=dawn | 1.0 | Morning already? I was counting stars. Lost count. | 벌써 아침이에요? 별 세다가 놓쳤어요. |
| `greet` | time=day | 1.0 | Daytime. The stars are still up there. Just shy. | 낮에도 별은 그대로 있어요. 수줍어서 숨었을 뿐이에요. |
| `greet` | time=dusk | 1.0 | Dusk! The first star is always the bravest. | 해 질 녘이에요! 첫 별은 언제나 제일 용감해요. |
| `greet` | time=night | 1.0 | Twinkle! Look up. No, more up. There. | 반짝! 위를 봐요. 조금 더 위요. 거기요! |
| `greet` | time=night, minLevel=2 | 1.0 | A night owl too? Let's name a star. | 올빼미 친구네요! 같이 별 하나 이름 지어 줄래요? |
| `puzzle.solved` |  | 1.0 | Every lantern in place. Like a constellation! | 등불이 다 제자리예요. 꼭 별자리 같아요! |
| `puzzle.solved` |  | 1.0 | Did you know lanterns are stars that decided to stay? | 그거 알아요? 등불은 하늘에 안 돌아간 별이래요. |
| `puzzle.hard` |  | 1.1 | That one had more thinking than the sky has stars. | 그 판은 하늘의 별보다 생각할 게 많았어요. |
| `puzzle.hard` |  | 1.1 | You looked at it a long time. Like stargazing. Good. | 오래 들여다봤죠. 별 보는 것처럼요. 좋아요. |
| `return` |  | 1.0 | The stars moved a little. You're right on time. | 별이 조금 움직였어요. 딱 맞춰 왔네요. |
| `return` |  | 1.0 | You're back! I saved you the best patch of sky. | 왔네요! 제일 좋은 하늘 자리 맡아 뒀어요. |
| `season` | season=spring | 1.0 | Spring nights are soft. The stars look well rested. | 봄밤은 부드러워요. 별들도 푹 잔 얼굴이에요. |
| `season` | season=summer | 1.0 | Short nights. I have to stargaze very fast. | 밤이 짧아요. 별을 아주 빨리 봐야 해요. |
| `season` | season=autumn | 1.0 | The moon's so round tonight. We're related, I think. | 오늘 달이 참 둥글어요. 우리 먼 친척 같아요. |
| `season` | season=winter | 1.0 | Cold air makes the stars sharper. Worth the shivers. | 추운 날엔 별이 더 또렷해요. 떨어도 괜찮아요. |
| `request.ask` | category=wall | 1.0 | Something for your wall? A clock, so I know it's late. | 벽에 걸 게 있을까요? 시계면 밤이 오는 걸 알죠. |
| `request.ask` | category=lighting | 1.0 | A little light by your window? For the night shift. | 창가에 작은 등 하나 있을까요? 밤샘용이에요. |
| `request.again` |  | 1.0 | Still dreaming of that wall thing. Dreams can wait. | 그 벽 장식, 아직 꿈꾸고 있어요. 천천히요. |
| `request.visit` |  | 1.0 | From your window I can see three new stars. Hi, stars. | 오두막 창으로 새 별이 세 개 보여요. 안녕, 별들아. |
| `letter.move_in` |  | 1.0 | To you, under the same sky, / This is for counting the hours till night. / Twinkle. — Luna | 같은 하늘 아래 이웃님에게, / 밤이 오기까지 몇 시간 남았나 세어 봐요. / 반짝. — 루나 |
| `letter.gift` |  | 1.0 | To you, under the same sky, / This fell out of the night. I think it's yours. / — Luna | 같은 하늘 아래 이웃님에게, / 밤하늘에서 떨어졌어요. 주인을 찾아왔나 봐요. / — 루나 |
| `letter.thanks` |  | 1.0 | To you, under the same sky, / Your room is the best observatory in town. / Thank you! Twinkle. — Luna | 같은 하늘 아래 이웃님에게, / 오두막 창이 마을 최고의 천문대예요. / 고마워요! 반짝. — 루나 |
| `gift.tag` |  | 1.0 | Another little star. Twinkle. | 작은 별 하나 더 보내요. 반짝. |
| `friend.level` | level=3 | 1.0 | I named a star after you. The small one. It tries hard. | 별 하나에 이웃님 이름을 붙였어요. 작아도 열심이에요. |
| `friend.level` | level=5 | 1.0 | If you ever feel lost, find the moon. I'll be under it. | 길을 잃은 것 같으면 달을 찾아요. 그 아래 있을게요. |
| `chat` | requires=['yuki'] | 1.1 | Yuki listens to snow. I listen to stars. Same thing. | 유키는 눈 소리를 듣고, 저는 별 소리를 들어요. |
| `chat` | requires=['sage'] | 1.1 | Sage fell asleep stargazing. That still counts. | 세이지가 별 보다 잠들었어요. 그래도 본 거예요. |
| `tap.again` |  | 1.0 | Hm? Sorry, I was up on a cloud. Hello! | 네? 미안해요, 구름 위에 있었어요. 안녕하세요! |

### 2.5 Pip 핍 — 제일 작고 제일 먼저 환호
| 항목 | 내용 |
|---|---|
| 핵심 | 바라는 것: 모두가 기뻐하는 것. 필요한 것: 응원하다 지치면 앉아도 된다는 것("좀 앉아야겠어") |
| 어휘·리듬 | 가장 짧은 문장, 느낌표. 단, 대문자 강조는 줄당 1단어까지. 아기 말투(혀 짧은 소리)는 금지한다 |
| 피하는 주제 | 슬픔을 오래 붙잡기, 남과 비교 |
| 말버릇 | `{cp}` = 폴짝 **Hop / 폴짝 / ぴょん**. "pip-pip"은 쓰지 않는다(§5.4 이름 위험) |
| 속뜻 | 거의 없다. 말한 그대로다 |
| 좋아하는 계열 | rug(뛰기용), small |
| 절대 안 할 말 | "You're slower than yesterday!"(비교) · "Pwease pway wif me"(아기 말투) · "Everyone else already finished." |

| trigger | 조건 | 출시 | English (≤60) | 한국어 |
|---|---|---|---|---|
| `move_in` |  | 1.0 | Hi hi! I'm Pip! I'm small but I cheer big! Hop! | 안녕안녕! 나 핍이야! 작아도 응원은 크게 해! 폴짝! |
| `move_in` |  | 1.0 | Is this my house? It's huge! Or I'm tiny. Both! | 여기가 내 집이야? 엄청 크다! 내가 작은 건가? 둘 다! |
| `greet` | time=dawn | 1.0 | Morning! I'm up! I've been up for ages! Hop! | 좋은 아침! 일어났어! 아까부터! 폴짝! |
| `greet` | time=day | 1.0 | Hi! I cheered for a cloud. It moved. Success! | 안녕! 구름을 응원했더니 움직였어. 성공! |
| `greet` | time=dusk | 1.0 | Sunset! Good job today, sun! You did great! | 노을이다! 해야, 오늘 수고했어! 정말 잘했어! |
| `greet` | time=night | 1.0 | Hop… I'm cheering very quietly. Yay. Yay. | 폴짝… 아주 조용히 응원 중이야. 야호. 야호. |
| `greet` | minLevel=2 | 1.0 | Guess what! Nothing! But I'm happy anyway! | 있잖아! 아무 일 없어! 그래도 좋아! |
| `puzzle.solved` |  | 1.0 | You did it! Hop! Hop! I knew it! | 해냈다! 폴짝! 폴짝! 그럴 줄 알았어! |
| `puzzle.solved` |  | 1.0 | Yay! Can I tell everyone? I'm telling everyone. | 야호! 모두한테 말해도 돼? 벌써 말하고 있어! |
| `puzzle.hard` |  | 1.1 | That was SO hard and you did it anyway! | 그거 진짜 어려웠는데 해냈잖아! |
| `puzzle.hard` |  | 1.1 | I cheered so hard I need a little sit. | 너무 세게 응원해서 좀 앉아야겠어. |
| `return` |  | 1.0 | You're here! Hop! Okay. Hi. Hop! | 왔다! 폴짝! 그러니까… 안녕! 폴짝! |
| `return` |  | 1.0 | I made up a brand-new cheer while you were out! | 너 없는 동안 새 응원 만들었어! |
| `season` | season=spring | 1.0 | Flowers! I cheered and they opened. Probably me. | 꽃이다! 응원했더니 피었어. 아마 내 덕분! |
| `season` | season=summer | 1.0 | Summer! Big sun! I'm a tiny sun! Hop! | 여름이다! 큰 해! 나는 작은 해! 폴짝! |
| `season` | season=autumn | 1.0 | Leaf pile! I jumped in. Someone please find me. | 낙엽 더미! 뛰어들었어. 누가 나 좀 찾아 줘! |
| `season` | season=winter | 1.0 | Snow is cold! I'm warm! We'll work it out! | 눈은 차갑고 나는 따뜻해! 잘 지내 볼게! |
| `request.ask` | category=rug | 1.0 | A rug for your room? Something to hop on? Please? | 오두막에 러그 하나 깔아 줄래? 폴짝 뛰게! |
| `request.ask` | category=small | 1.0 | Something little, like me? For a shelf? | 나처럼 작은 소품 하나 있어? 선반에 두게! |
| `request.again` |  | 1.0 | Rug! Rug! …That's the whole cheer. No rush! | 러그! 러그! …응원 끝. 천천히 해! |
| `request.visit` |  | 1.0 | Your rug is perfect for hopping. Hop! Hop! | 네 러그, 뛰기 딱 좋아. 폴짝! 폴짝! |
| `letter.move_in` |  | 1.0 | HI! / This rug is for hopping. I tested it. A lot. / Yay! — Pip | 안녕!! / 폴짝폴짝 뛰기 좋은 러그야. 내가 엄청 뛰어 봤어. / 야호! — 핍 |
| `letter.gift` |  | 1.0 | HI! / I found a thing! It's for you! That's the letter! / Hop! — Pip | 안녕!! / 뭐 찾았어! 너 줄 거야! 편지 끝! / 폴짝! — 핍 |
| `letter.thanks` |  | 1.0 | HI! / I hopped on your rug 100 times. Maybe 101. / You're the best! — Pip | 안녕!! / 네 러그에서 100번 뛰었어. 101번일지도. / 네가 최고야! — 핍 |
| `gift.tag` |  | 1.0 | Another one! Hop! | 하나 더! 폴짝! |
| `friend.level` | level=3 | 1.0 | You're my favorite to cheer for. Don't tell! | 너 응원하는 게 제일 좋아. 비밀이야! |
| `friend.level` | level=5 | 1.0 | I made a cheer just for you. It's very loud. Ready? | 너만 위한 응원 만들었어. 엄청 커. 준비됐어? |
| `chat` | requires=['sage'] | 1.1 | Sage was asleep in a pot again. I cheered quietly! | 세이지가 또 화분에서 자. 조용히 응원했어! |
| `chat` | requires=['kuri'] | 1.1 | Kuri is knitting me a hat. I keep hopping out of it. | 쿠리가 모자 떠 주는데 자꾸 튀어나와! |
| `tap.again` |  | 1.0 | Hop! Oh, hi! Hop! | 폴짝! 앗, 안녕! 폴짝! |

### 2.6 Kuri 쿠리 — 난롯가에서 뜨개질하는 포근함
| 항목 | 내용 |
|---|---|
| 핵심 | 바라는 것: 모두가 따뜻하고 배부른 것. 필요한 것: 완성하지 못해도 괜찮다는 것(뜨던 목도리가 늘 다른 물건이 된다) |
| 어휘·리듬 | 차·수프·과자·털실·불가. 권유형("앉아요", "받아요"). 콧노래 |
| 피하는 주제 | 불평, 소문. 나이를 드러내는 호칭은 쓰지 않는다(dear·love 금지. 연애로 읽히거나 노인 고정관념이 된다) |
| 말버릇 | `{cp}` = 콧노래 **Hm-hm♪ / 흠흠♪ / ふんふん♪**. 라틴 계열 언어는 La-la♪ |
| 속뜻 | 중간. 걱정을 음식으로 표현한다("어려운 판엔 따뜻한 차죠") |
| 계절 | 가을에 밤(栗 = kuri)을 좋아한다. 일본어권에서는 이름과 이어지는 숨은 농담이다 |
| 좋아하는 계열 | small(찻주전자·뜨개 바구니), seating(흔들의자) |
| 절대 안 할 말 | "You look tired, you should eat more, dear." (훈계 + dear) · "Back in my day…" · "I'm so disappointed." |

| trigger | 조건 | 출시 | English (≤60) | 한국어 |
|---|---|---|---|---|
| `move_in` |  | 1.0 | Hello, hello. I'm Kuri. I brought tea. And yarn. | 안녕하세요. 쿠리예요. 차 가져왔어요. 털실도요. |
| `move_in` |  | 1.0 | A fireplace! Oh, I'll be very happy here. | 벽난로가 있네요! 여기서 정말 행복하겠어요. |
| `greet` | time=dawn | 1.0 | Early bird? Kettle's on. Hm-hm♪ | 일찍 일어났네요? 주전자 올렸어요. 흠흠♪ |
| `greet` | time=day | 1.0 | Afternoon. I'm on row forty. Or fourteen. Hm. | 오후네요. 마흔 번째 단이에요. 열네 번째던가. |
| `greet` | time=dusk | 1.0 | Dusk. Time to light the fire and get comfy. | 해 질 녘이에요. 불 지피고 편히 있을 시간이죠. |
| `greet` | time=night | 1.0 | Can't sleep? Sit by the fire. I'll keep knitting. | 잠이 안 와요? 불가에 앉아요. 저는 뜨개질할게요. |
| `greet` | minLevel=2 | 1.0 | I made too much soup again. Help me out? | 수프를 또 많이 끓였어요. 좀 도와줄래요? |
| `puzzle.solved` |  | 1.0 | Well done. That deserves a biscuit. Here. | 잘했어요. 이럴 땐 과자죠. 자, 여기요. |
| `puzzle.solved` |  | 1.0 | Neat as a good stitch. Every one in its place. | 잘 뜬 코처럼 반듯해요. 하나하나 제자리예요. |
| `puzzle.hard` |  | 1.1 | Hard ones deserve a warm drink. Here, take this. | 어려운 판엔 따뜻한 차죠. 자, 받아요. |
| `puzzle.hard` |  | 1.1 | Tangled, then sorted. Just like yarn. Lovely. | 엉켰다가 풀렸네요. 털실처럼요. 좋아요. |
| `return` |  | 1.0 | Tea's still warm. Funny how that works. | 차가 아직 따뜻해요. 신기하죠. |
| `return` |  | 1.0 | There you are. I kept your seat by the fire. | 왔네요. 불가 자리 비워 뒀어요. |
| `season` | season=spring | 1.0 | Spring cleaning! I found three scarves I forgot. | 봄맞이 청소! 잊고 있던 목도리를 세 개나 찾았어요. |
| `season` | season=summer | 1.0 | Too warm for scarves. I'm knitting one anyway. | 목도리엔 너무 더워요. 그래도 뜨는 중이에요. |
| `season` | season=autumn | 1.0 | Chestnut season. My favorite. Can you tell? | 군밤 철이에요. 제일 좋아해요. 티 나죠? |
| `season` | season=winter | 1.0 | Cold out. Come in. I knitted the door a cozy. | 밖이 춥죠. 들어와요. 문에도 덮개를 떠 줬어요. |
| `request.ask` | category=small | 1.0 | A spot for my yarn in your room? A basket, a pot… | 오두막에 털실 둘 데 있을까요? 바구니든 뭐든요. |
| `request.ask` | category=seating | 1.0 | A chair by your window? I knit better sitting down. | 창가에 의자 하나 있을까요? 앉아야 잘 떠져요. |
| `request.again` |  | 1.0 | About that yarn spot. No rush at all. Truly. | 털실 자리 얘기요. 하나도 안 급해요. |
| `request.visit` |  | 1.0 | Lovely spot. I'll just knit a row or two here. | 자리 좋네요. 여기서 한두 단만 뜰게요. |
| `letter.move_in` |  | 1.0 | For you, with tea, / A basket for odds and ends. Everyone needs one. / Hm-hm♪ — Kuri | 차 한 잔과 함께, / 자잘한 것 담을 바구니예요. 누구나 하나 필요하죠. / 흠흠♪ — 쿠리 |
| `letter.gift` |  | 1.0 | For you, with tea, / I meant to knit a scarf. This happened instead. / Enjoy! — Kuri | 차 한 잔과 함께, / 목도리 뜨려다가 이게 됐어요. / 잘 써 줘요! — 쿠리 |
| `letter.thanks` |  | 1.0 | For you, with tea, / Your room is my favorite place to knit now. / Come warm up anytime. — Kuri | 차 한 잔과 함께, / 오두막이 이제 제일 좋은 뜨개 자리예요. / 언제든 몸 녹이러 와요. — 쿠리 |
| `gift.tag` |  | 1.0 | And one more. Hm-hm♪ | 하나 더요. 흠흠♪ |
| `friend.level` | level=3 | 1.0 | I've started something in your size. Hm-hm♪ | 이웃님 품에 맞게 뭘 뜨기 시작했어요. 흠흠♪ |
| `friend.level` | level=5 | 1.0 | I finished it. It's a scarf. Mostly. Try it on? | 다 떴어요. 목도리예요. 대체로요. 둘러 볼래요? |
| `chat` | requires=['pip'] | 1.1 | I'm knitting Pip a hat. Pip won't hold still. | 핍 모자를 뜨는데 가만히 있질 않아요. |
| `chat` | requires=['yuki'] | 1.1 | Yuki says my fire crackles too loud. I've turned it down. | 유키가 불이 시끄럽대요. 조금 줄였어요. |
| `tap.again` |  | 1.0 | Hm-hm♪ Oh! Dropped a stitch. Never mind. Hello! | 흠흠♪ 앗, 코 놓쳤다. 괜찮아요. 안녕하세요! |

### 2.7 Yuki 유키 — 첫눈을 좋아하는 조용한 아이
| 항목 | 내용 |
|---|---|
| 핵심 | 바라는 것: 조용함. 필요한 것: 말없이 곁에 있어도 되는 사람 |
| 어휘·리듬 | 가장 적은 단어, 명사로 끝나는 문장("밤. 찬 공기. 별. 충분해요."), 감각어(차가움·하양·소리 없음) |
| 피하는 주제 | 큰 감정을 직접 말하기, 소음, 사람 많은 곳 |
| 말버릇 | `{cp}` = 쉿 **Shh / 쉿 / しーっ** (언어마다 있는 조용히 하라는 소리) |
| 속뜻 | 가장 많다. "괜찮아요" = 아주 좋아요. 목도리가 필요 없는데도 Kuri의 목도리를 한다 |
| 계절 | 겨울에 `event.first_snow`(1년 1회). 다른 계절에는 눈을 기다리거나 기억한다 |
| 좋아하는 계열 | bed, storage(책) |
| 절대 안 할 말 | "OMG it's snowing!!! Yay!!!" · "I'm so lonely here." (죄책감 유발) · "Talk to me every day." |

| trigger | 조건 | 출시 | English (≤60) | 한국어 |
|---|---|---|---|---|
| `move_in` |  | 1.0 | …Hi. I'm Yuki. It's quiet here. Good. | …안녕하세요. 유키예요. 여기 조용하네요. 좋아요. |
| `move_in` |  | 1.0 | Does it snow here? …I'll wait. | 여기도 눈이 와요? …기다릴게요. |
| `greet` | time=dawn | 1.0 | Dawn is the quietest. Shh. Listen. | 새벽이 제일 조용해요. 쉿. 들어 봐요. |
| `greet` | time=day | 1.0 | Hi. …That's all. It's a nice hi, though. | 안녕하세요. …그게 다예요. 그래도 좋은 인사예요. |
| `greet` | time=dusk | 1.0 | The light goes blue after sunset. My color. | 해 지고 나면 빛이 파래져요. 제 색이에요. |
| `greet` | time=night | 1.0 | Night. Cold air. Stars. Enough. | 밤. 찬 공기. 별. 충분해요. |
| `greet` | minLevel=2 | 1.0 | Oh. You. …I don't mind talking to you. | 아. 왔네요. …이웃님이랑은 얘기해도 괜찮아요. |
| `puzzle.solved` |  | 1.0 | Nice. Quiet and neat. Like fresh snow. | 좋아요. 조용하고 반듯해요. 첫눈처럼요. |
| `puzzle.solved` |  | 1.0 | Oh. Pretty. | 아. 예쁘다. |
| `puzzle.hard` |  | 1.1 | That was a hard one. You stayed calm. I saw. | 어려운 판이었죠. 차분했어요. 봤어요. |
| `puzzle.hard` |  | 1.1 | Hard things go quiet at the end. Like snow. | 어려운 건 끝에 조용해져요. 눈처럼요. |
| `return` |  | 1.0 | …Oh. Hi. I'm glad. | …아. 안녕하세요. 반가워요. |
| `return` |  | 1.0 | I didn't count the days. I just looked up. You. | 날짜는 안 셌어요. 고개를 드니까 와 있네요. |
| `season` | season=spring | 1.0 | The snow's gone. I kept some in my memory. Shh. | 눈이 다 녹았어요. 조금은 기억에 담아 뒀어요. 쉿. |
| `season` | season=summer | 1.0 | Too bright. I'll sit in the shade and think cold. | 너무 밝아요. 그늘에서 시원한 생각 할래요. |
| `season` | season=autumn | 1.0 | The air is getting sharper. Soon, maybe. | 공기가 차가워졌어요. 눈이 곧 올지도 몰라요. |
| `season` | season=winter | 1.0 | Snow on every roof. The village looks asleep. | 지붕마다 눈이에요. 마을이 자는 것 같아요. |
| `event.first_snow` |  | 1.0 | It's snowing. …Shh. Don't say anything. Just look. | 눈 와요. …쉿. 아무 말 말고 봐요. |
| `request.ask` | category=bed | 1.0 | A small bed in your room? I nap where it's quiet. | 오두막에 작은 침대 하나 있을까요? 조용한 데서 자요. |
| `request.ask` | category=storage | 1.0 | A shelf? For quiet things. Books, mostly. | 선반 하나요? 조용한 것들 두게요. 책 같은 거. |
| `request.again` |  | 1.0 | The bed. …Whenever. I can wait. | 그 침대요. …언제든요. 기다릴 수 있어요. |
| `request.visit` |  | 1.0 | It's quiet in here. …Thank you. | 여기 조용하네요. …고마워요. |
| `letter.move_in` |  | 1.0 | Hi. / This is for your window. It stays cold-looking. / Shh. — Yuki | 안녕하세요. / 창가에 두세요. 늘 시원해 보여요. / 쉿. — 유키 |
| `letter.gift` |  | 1.0 | Hi. / Found this in the snow. It wasn't cold. / For you. — Yuki | 안녕하세요. / 눈 속에서 찾았어요. 차갑지 않았어요. / 드릴게요. — 유키 |
| `letter.thanks` |  | 1.0 | Hi. / I slept in your room. No noise at all. / Thank you. Shh. — Yuki | 안녕하세요. / 오두막에서 잤어요. 아무 소리도 없었어요. / 고마워요. 쉿. — 유키 |
| `gift.tag` |  | 1.0 | One more. Shh. | 하나 더요. 쉿. |
| `friend.level` | level=3 | 1.0 | I saved a snowflake for you. …It melted. Sorry. | 눈송이 하나 남겨 뒀어요. …녹았어요. 미안해요. |
| `friend.level` | level=5 | 1.0 | When it snows next, sit with me. No talking needed. | 다음에 눈 오면 옆에 앉아요. 말 안 해도 돼요. |
| `chat` | requires=['kuri'] | 1.1 | Kuri gave me a scarf. I'm not cold. I wear it. | 쿠리가 목도리를 줬어요. 안 추워요. 그래도 해요. |
| `chat` | requires=['luna'] | 1.1 | Luna talks a lot. About stars. I don't mind. | 루나는 말이 많아요. 별 얘기요. 괜찮아요. |
| `tap.again` |  | 1.0 | Shh… oh. It's you. Okay. | 쉿… 아. 왔네요. 괜찮아요. |

---

## 3. 시스템 — 줄이 고르는 법 (design §2.4·§2.5·§3.1에 맞춤)

### 3.1 한 번의 방문에서 대사가 나오는 순서

```
마을 열림
 ├ Wick 호스트 1줄 (소식이 있을 때만: 첫 방문 > 이사 > 오랜만 > 이사 전날 > 우편 > 계절 바뀜)
 ├ 카메라가 "오늘 일이 있는 주민"으로: 막 이사 옴 > 부탁을 들어줘서 내 방에 앉은 주민 > hash(날짜)의 부탁 주민
 └ 주민 탭: 1탭 = 1줄, 주민당 방문마다 최대 3탭. 그다음엔 글 없이 표정만 (60초 원칙)
```

### 3.2 줄 선택기

```
pick(resident, ctx):                       # ctx = 오늘 날짜, 시간대, 계절, 우정, 오늘 사건
  for trig in PRIORITY:                    # JSON selection.priority
    if not active(trig, resident, ctx): continue
    pool = lines[resident][trig] where cond 충족(time, season, minLevel, requires, category, level)
    if pool 비었음: continue
    fresh = pool - recent[resident]        # 최근 min(6, |pool|-1)개 제외
    line = fresh[ rng(hash(dayIndex, residentId, talkIndexToday)) ]
    한 번만 나오는 trig(move_in, friend.level, return, event.first_snow, request.visit)는 소비 표시
    return line
```

- **우선순위**: move_in → friend.level → return → event.first_snow → request.visit → puzzle.hard → puzzle.solved → request.ask → request.again → greet → season → chat. 같은 방문에서 두 번째 탭은 다음으로 활성인 trigger로 넘어간다. 첫 탭이 인사라면 두 번째 탭은 계절이나 잡담이 된다.
- **반복 금지**: 주민마다 최근 본 id를 링 버퍼(≤ 8개)에 둔다. **로컬에만 저장하고 동기화하지 않는다.** 재설치 때 잃어도 해가 없다. 시드가 결정적이라 같은 날 마을을 다시 열면 같은 줄이 나온다(다시 굴리기 없음).
- **퍼즐 반응**: 오늘 판을 1개 이상 풀었으면 그날 **처음 말을 건 주민 2명까지만** 퍼즐 이야기를 한다. 7명이 다 축하하면 과하다.
  - `puzzle.hard` = 오늘 deduce 트랙을 풀었거나, 오늘의 퍼즐을 ✨(힌트 없이)로 풀었을 때다.
- **연속 기록·판 수 슬롯은 1.0에서 쓰지 않는다**(design §2.4의 슬롯 제안 중 일부 보류).
  - 이유 1: 연속 일수를 입에 올리면 압박이 된다.
  - 이유 2: 숫자는 10개 언어 복수형(ICU plural)이 필요하다.
  - 1.1에 넣는다면 ✨만 쓰고, 숫자는 ICU MessageFormat으로 넣는다.
- **시간대**: 새벽 05–09 · 낮 09–17 · 황혼 17–21 · 밤 21–05. 기기 현지 시각이다.
- **계절**: 반구는 기기 지역으로 정하고 설정에서 바꿀 수 있다(design §2.7). JSON `seasons`에 북·남 달력이 있다.

### 3.3 우정 0–5 (design §2.4 "들어준 부탁 + 대화한 날"을 새 상태 없이 유도)

- 점수 = (이 주민이 이사 온 뒤 `v.ch`에 켜진 날 수) + 2 × (이 주민의 부탁을 들어준 날 수, `v.q`와 `hash(날짜)`로 유도) `[P]`
- 단계 임계 0 / 2 / 5 / 9 / 14 / 21점 `[P]`. 매일 들러 대화만 하면 3단계까지 약 9일, 5단계까지 약 3주다(부탁을 들어주면 더 빠르다).
- 내려가지 않는다. `v.ch`는 주민 공통 비트이므로 같은 날 이사 온 주민들은 함께 오른다. 단순함을 위해 이를 허용한다.
- 대사에 쓰는 곳은 세 가지다.
  - `greet`의 minLevel 2 변형
  - `friend.level` 3과 5. 5단계 대사는 우정 액자 가구(1.1)를 받는 순간과 맞춘다.

### 3.4 편지 리듬 — "하루 편지 1통"

- **우편함에는 하루에 편지 1통만 새로 들어온다.**
  - 우선순위: `letter.move_in` > `letter.thanks`(부탁을 들어준 다음 날) > `letter.return`(Wick, 7일 이상 만에 처음 방문) > `letter.gift`(병이 참)
- 같은 날 병이 또 차면 가구는 그대로 오고 편지 대신 **꼬리표 1줄**(`gift.tag`, ≤ 30자)이 붙는다.
  - 보상의 양은 디자인 그대로 두고, 읽을 글의 양만 줄인다.
- 병 선물을 보내는 주민은 지금까지 편지를 가장 적게 보낸 주민이다. 같으면 이사 순서로 정한다. 모두 차례로 목소리를 낸다.
- 우편함은 10통까지 보여 주고, 넘치면 앨범으로 옮긴다(design §2.5).
  - 안 읽은 수는 숫자로 보이지 않는다. 앰버 봉투 점만 쓰고 빨간 점은 금지한다.
  - 편지는 만료되지 않는다.
- 편지 형식: 인사말(주민마다 고정: Wick "Hello," · Momo "Um, hello," · Sage "Mm, hello," · Luna "To you, under the same sky," · Pip "HI!" · Kuri "For you, with tea," · Yuki "Hi.") + 본문 1–2줄 + 서명.
  - 본문은 선물 이름을 부르지 않는다("this", "something for the room"). 물건 이름 슬롯은 독일어·프랑스어·스페인어 등에서 성·격 변화가 생기기 때문이다.

### 3.5 부탁 (design §2.4: 가구 계열, 마감 없음, 내 방에 놓으면 놀러 옴)

- 그날의 부탁 주민은 `hash(날짜)`로 정한다.
  - 그 주민 `likes` 가운데 **내 방에 아직 없는 계열**을 먼저 고른다. 이미 있는 계열이면 부탁하는 순간 바로 해결돼 의미가 없다.
  - 모든 계열이 이미 있으면 첫 계열로 부탁한다. 이때는 바로 `request.visit`으로 이어진다(즉시 보상).
- 이전에 같은 부탁을 했고 아직 해결되지 않았으면 `request.again`을 쓴다. 3일 이상 지났을 때만 쓰고, 문구에 항상 "천천히"가 있다.
- 해결 → 그 주민이 내 방 해당 가구 옆에 앉는다 → 탭하면 `request.visit` → 다음 날 `letter.thanks` + 좋아하는 계열 가구.
- 거절 버튼은 없다. 무시해도 아무 일도 없다.

### 3.6 Wick, "우리 마을"의 목소리

- 주어는 "우리 마을", "당신 방"이다. 플레이어는 손님이 아니라 **등불지기**다(design §2.0).
- 안내는 손짓과 한 줄이 전부다. 첫 방문: `host`(firstVillageVisit) 2줄 → 우편함 → 장터(`marketOpen`: "나머지는 또 와요") → 방(`firstCabinVisit`).
- 이사 전날의 실루엣은 `moveInEve`가 맡는다(D1 고리, design §2.1).
- **퍼즐 화면에서 Wick은 말하지 않는다**(DECISIONS 라운드 2). 튜토리얼 문구는 기존 그대로다.

### 3.7 판 화면과 결과 시트

- 판: 글 0. 표정과 소리만 쓴다(r1 §5.7).
- 결과 시트·엽서: 대사를 넣지 않는다.
  - "오늘의 손님"(조건부 결정)을 넣는다면 그 주민의 **말버릇 의성어 1개**만 스티커로 붙인다. 예: Pip "Hop!", Yuki "Shh".
  - 의성어는 번역 부담이 거의 없고, 문장이 없으니 퍼즐 화면의 무언 원칙을 지킨다.

---

## 4. 구현 메모 (JSON)

- 파일: `docs/team/r2-village-lines.en.json`. 최상위에 `limits`, `tokens`, `timeBands`, `seasons`, `furnitureCategories`, `selection`, `friendship`, `residents`(이름·이사 litDays·likes·10개 언어 말버릇), `triggers`(설명), `lines`가 있다.
- `lines[]`: `{id, resident, trigger, cond?, ship, text}`
  - id 규칙: `<resident>.<trigger>.<nn>`. **id는 바꾸지 않는다**(다른 언어 파일의 키).
  - `ship`: `1.0` / `1.1`
- 다른 언어 파일은 `r2-village-lines.<locale>.json`에 `{id: text}`만 둔다. 없는 키는 en으로 대체하지 않는다. 그 줄을 선택 풀에서 빼서 언어가 섞이지 않게 한다.
- 빌드 검사(제안, 이 문서를 만든 스크립트와 같은 규칙):
  - 줄 길이: en ≤ 60, 그 밖의 라틴 문자 언어 ≤ 78, ko ≤ 32, ja·zh ≤ 30, `gift.tag` en ≤ 30
  - 금지어 린트(§1.1 규칙 5)
  - `{cp}`는 줄당 2개 이하
- 목소리 합성(design §2.4)은 화면에 보이는 글자 수 기준이다. `{cp}`를 바꾼 뒤 센다.
- VoiceOver: 대사 카드는 "이름, 대사" 순서로 읽는다. 의성어는 읽게 둔다("Hop").

---

## 5. 현지화 (10개 언어)

### 5.1 높임과 말투

| 언어 | 주민 → 플레이어 | 메모 |
|---|---|---|
| ko | **해요체**(Wick·Momo·Sage·Luna·Kuri·Yuki), **반말은 Pip만**. **"당신" 금지**(R3): 주어를 빼고, 꼭 필요할 때만 "이웃님"(주민당 1–2번). 용어는 앱 UI와 맞춘다: 등불 병, 내 오두막, 방석 | 작은 정령의 반말은 아이 같아 귀엽게 읽힌다. 다만 35–54세 대상이므로 반말은 한 명으로 제한한다. 1.1 아이디어: 우정 4단계에 "말 편하게 해도 돼요?" 이벤트(ko·ja 전용) |
| ja | 기본 **です・ます**(부드럽게: 〜ですね, 〜ますよ), Pip만 タメ口. Yuki는 명사로 끝내기(体言止め) | UI의 です・ます와 맞춘다. 문장마다 말버릇 어미를 붙이는 방식(동물의 숲 일본어판의 語尾)은 쓰지 않는다. 말버릇은 감탄사 자리에만 둔다 |
| de | **du** | 글로서리와 같다. Kuri의 "door a cozy"는 Türwärmer 같은 말장난으로 재창작한다 |
| fr | 주민은 **tu**, UI는 vous 그대로 | 주민은 친구이고 UI는 앱의 목소리라서 일부러 다르게 둔다. 리드 확인 필요 |
| es / pt-BR / it | tú / você / tu | 플레이어 성별 일치 금지(Bienvenido/a, Bem-vindo, Bentornato ✗ → ¡Qué bueno verte! / Que bom te ver / Che bello rivederti) |
| zh-Hans / zh-Hant | 你(您 ✗), 반각 공백 규칙은 글로서리를 따른다 | zh-Hant는 대만 어휘. Kuri 콧노래 哼哼은 "흥" 하고 토라지는 소리로 읽혀 啦啦♪로 바꿨다 |

### 5.2 말버릇 의성어표 (`residents[].catchphrase`)

| 주민 | en | ko | ja | de | fr | es | pt-BR | it | zh-Hans | zh-Hant |
|---|---|---|---|---|---|---|---|---|---|---|
| Wick | Pom | 퐁 | ぽっ | Plopp | Pof | Pom | Pom | Pof | 啵 | 啵 |
| Momo | Eep | 힛 | ひゃっ | Huch | Oh | Ay | Ai | Oh | 呀 | 呀 |
| Sage | Fwaah | 하암 | ふぁ〜 | Gähn | Ouaah | Aaah | Aaah | Uaah | 哈啊～ | 哈啊～ |
| Luna | Twinkle | 반짝 | きらっ | Funkel | Cling | Tilín | Plim | Dlin | 闪闪 | 閃閃 |
| Pip | Hop | 폴짝 | ぴょん | Hopp | Hop | Hop | Hop | Hop | 蹦 | 蹦 |
| Kuri | Hm-hm♪ | 흠흠♪ | ふんふん♪ | La-la♪ | La-la♪ | La-la♪ | La-la♪ | La-la♪ | 啦啦♪ | 啦啦♪ |
| Yuki | Shh | 쉿 | しーっ | Pssst | Chut | Shh | Shh | Shh | 嘘 | 噓 |

- 원어민 검토 때 "그 언어 아이들이 실제로 쓰는 소리인가"를 확인한다. 특히 fr Cling과 it Dlin은 확신이 낮다.

### 5.3 성별과 대명사

- 정령은 성별이 없다.
  - en 원문은 주민을 가리킬 때 대명사 대신 이름을 쓴다("Pip won't hold still").
  - 번역자도 이름이나 무성 표현을 쓴다.
- 자기 묘사 형용사(fr "je suis content·e", it "sono contento·a", es·pt 동일)는 감탄문으로 바꾼다("Quelle joie !").
  - 피할 수 없는 줄이 나오면 검토 표에 표시하고 리드가 정한다(§6).

### 5.4 이름 점검 (10개 언어, **모델 지식 기반이다. 사전 확인과 원어민 검토는 아직 하지 않았다**)

| 이름 | 표기 제안 | 확인된 연상 | 위험 | 조치 |
|---|---|---|---|---|
| Wick | ko 윅 · ja ウィック · zh 小烛/小燭 | **de·at·ch: P&G가 Vicks 제품을 "Wick"(Wick VapoRub, MediNait) 브랜드로 판다**. 감기약이 떠오른다. en: John Wick | 낮음 | 앱 이름에서 이미 쓰고 있다. DE ASO에서 "Wick" 단독 키워드는 쓰지 않는다 |
| Momo | 모모 · モモ · 桃桃 | ja 桃(복숭아), 미하엘 엔데 『모모』(de·it·ja에서 사랑받는 책), pt 카니발의 Rei Momo. **2018–19 "Momo Challenge" 괴담**(en·es·pt 부모들) | 낮음–중간 | 마케팅에서 "Momo" 단독 노출과 "challenge"를 함께 쓰지 않는다. 앱 안에서는 문제없다 |
| Sage | 세이지 · セージ · 叶叶/葉葉 | fr *sage* = 착한·현명한(긍정), en 허브·현자, de "sage"(나는 말한다)로 무해 | 매우 낮음 | — |
| Luna | 루나 · ルナ · 月月 | es·it·pt "달"(딱 맞다). ja 『세일러 문』의 고양이 루나(35–54세 일본 여성에게 친숙, 긍정) | 매우 낮음 | — |
| Pip | 핍 · **ピピ 권고**(ピップ도 가능) · 皮皮 | **fr·de·es·it·pt: 어린이말 *pipi/pipì/pipí* = 쉬(오줌)에서 한 글자 차이**. fr *pipe*는 비속어. **ja: ピップ = ピップエレキバン(어깨 자석 패치) 회사명**이라 이 연령대에게 바로 떠오른다. zh 皮皮 = 장난꾸러기(괜찮음) | **중간** | 말버릇을 "pip"에서 **Hop**으로 바꿨다. "Pip-pip"과 "Pipi" 애칭은 금지한다. ja 표기는 리드가 정한다 |
| Kuri | 쿠리 · クリ · 栗栗 | ja 栗(밤), ko 쿠리만주(긍정). ko 속어 "쿠리다"(=구리다)가 있지만 이름으로는 약하다 | 낮음 | 가을 밤 대사로 긍정 연상을 굳힌다 |
| Yuki | 유키 · ユキ · 雪雪 | ja 雪(눈). 흔한 일본 이름 | 매우 낮음 | — |

- zh는 겹글자 애칭(桃桃·栗栗·雪雪·月月·皮皮·叶叶)으로 통일하고 Wick만 小烛으로 둔다. 주인은 다르다는 신호다. 음역(威克 등)보다 따뜻하다. 원어민 검토 대상이다.

### 5.5 문화와 지역

- **반구**: AU·NZ·BR 등은 남반구 계절을 쓴다. "Chestnut season", "first snow"도 그 반구의 가을·겨울에 나온다.
- **눈**: SG·MY·TW·BR 대부분은 눈이 오지 않는다. 대사의 눈은 **마을의 눈**이라 어색하지 않다. 1.0은 날짜로 첫눈을 근사한다(북 12/1, 남 6/1).
- **종교 축일 이름은 쓰지 않는다**(크리스마스 ✗). "Big round moon"은 추석·中秋·十五夜와 이름 없이 겹친다.
- **음식**: biscuit(en-GB 느낌)은 en-US에서 cookie로 읽혀도 무방하다. 번역자는 그 언어의 차 과자로 바꾼다.

---

## 6. 열린 결정 · 위험 (리드)

1. **1.0 분량**: (R4) 195줄 × 10개 언어. 아래 감축안은 R2 기준이며, 범위를 다시 줄일 때만 쓴다.
   - 감축안 −24: Wick·Momo·Sage의 `season` ×4, `chat` ×2, `friend.level` ×2를 1.1로 넘긴다.
   - 더 줄여야 하면 `puzzle.solved`·`return`을 주민당 1줄로 줄인다(−6).
2. ja Pip 표기(ピピ 권고 / ピップ).
3. fr 주민 tu + UI vous 혼용.
4. 우정 임계값과 "대화한 날은 주민 공통" 단순화 `[P]`.
5. 연속 기록·판 수 슬롯 보류(§3.2). design §2.4와 다르다.
6. 자기 묘사 성별: 회피를 원칙으로 하고, 예외가 나오면 줄 단위로 정한다.
7. **위험**: 여기의 이름·의성어·벤치마크 일부는 웹 검증을 못 했다([K]). 출시 전 원어민 1회 검토(design에서 사용자 몫)에 §5.2·§5.4 확인을 넣는다.

---

## 7. R3 수정 기록 (2026-10-17, Reality "G1 실제 빌드 검수 §3" 반영)

**한국어 원칙 (이번에 바꾼 기준)**
1. **"당신"을 쓰지 않는다.** 주어를 빼는 것이 기본이고, 꼭 필요할 때만 "이웃님"을 쓴다. 1.0 세트 61줄에서 "이웃님"은 8번(주로 편지와 우정 대사)이다.
2. 영어 농담을 직역하지 않는다. "용감한 쿠션", "그게 재밌는 부분", "논리가 있는 꽃잎"은 한국어로 다시 썼다.
3. 비표준 조사를 고쳤다("쿠션요" → "방석이에요", "꽃잎요" 삭제).
4. 앱 용어와 맞췄다: "병"은 항상 "등불 병"(질병 오독 방지), "방"은 "오두막"(UI 제목 "내 오두막"), 쿠션은 "방석"(서랍 이름 "꽃잎 방석" 제안).
5. 꼬리표(`gift.tag`)는 동사로 끝낸다("방에 하나 더 두세요").
6. 길이는 그대로 ≤ 32자다. 빌드 검사와 금지어 린트를 통과했고, `apps/client/scripts/village-lines.mjs --check`도 파싱에 성공했다.

**영어 재검토**
- 61줄을 다시 읽었다. 직역 농담을 고친 한국어와 뜻이 어긋나는 4줄과, 어색한 3줄("someone gets a home by it", "The jar filled up", "Kindly.")을 고쳤다.
- 나머지는 짧고 구어적이어서 그대로 둔다.

**한국어 — 1.0 세트(앱에 들어가는 61줄) 중 53줄 변경**

| id | 이전 | 이후 |
|---|---|---|
| `wick.host.01` | 어서 와요. 우리 마을이에요. 아직은 작아요. | 어서 와요. 여기가 우리 마을이에요. 아직은 작죠. |
| `wick.host.02` | 당신이 켠 불빛마다 누군가 집이 생겨요. | 불을 하나 켤 때마다 누군가의 집이 생겨요. |
| `wick.host.03` | 당신 앞으로 뭐가 왔어요. 우편함이 뿌듯해 보여요. | 편지가 왔어요. 우편함이 신나 보여요. |
| `wick.host.04` | 저 어두운 창 보여요? 내일 누가 와요. | 저기 불 꺼진 창 보여요? 내일 누가 이사 와요. |
| `wick.host.07` | 여기가 당신 방이에요. 마음 가는 데 놓아요. | 여기가 오두막 안이에요. 마음 가는 곳에 놓아 봐요. |
| `wick.move_in.01` | 저는 윅이에요. 등불을 돌봐요. 마을도요. | 저는 윅이에요. 등불을 돌보고, 마을도 살펴요. |
| `wick.move_in.02` | 입구 오두막은 당신 거예요. 저는 바로 옆집이에요. | 입구 오두막이 이웃님 집이에요. 저는 바로 옆집이고요. |
| `wick.greet.03` | 해 질 녘이에요. 제일 좋아하는 시간이에요. | 해 질 녘이네요. 다 금빛이라 제일 좋아하는 때예요. |
| `wick.greet.05` | 아, 당신이군요. 방금 길이 더 밝아졌어요. | 아, 왔군요. 방금 길이 더 환해졌어요. |
| `wick.puzzle.solved.01` | 잘 밝혔어요. 디딤돌에서 보고 있었어요. | 잘 밝혔어요. 디딤돌에서 다 지켜봤어요. |
| `wick.puzzle.solved.02` | 깔끔하고 차분했어요. 그거면 돼요. 퐁. | 깔끔하고 차분했어요. 그렇게 하면 돼요. 퐁. |
| `wick.return.01` | 왔군요. 다들 계속 빛나고 있었어요. | 왔군요. 다들 그대로 반짝이고 있었어요. |
| `wick.return.02` | 다시 왔네요. 벤치가 아직 따뜻해요. 신기하죠. | 어서 와요. 벤치가 아직 따뜻해요. 신기하죠? |
| `wick.letter.move_in.01` | 안녕하세요, / 제가 처음 켠 등불이에요. / 이제 당신 거예요. 잘 왔어요. — 윅 | 안녕하세요, / 제가 처음으로 켠 등불이에요. / 이제 이웃님 거예요. 잘 왔어요. — 윅 |
| `wick.letter.gift.01` | 안녕하세요, / 병이 또 가득 찼어요. 당신 덕분이에요. / 방에 둘 걸 보내요. — 윅 | 안녕하세요, / 등불 병이 또 가득 찼어요. 덕분이에요. / 방에 두라고 하나 보내요. — 윅 |
| `wick.letter.return.01` | 안녕하세요, / 마을이 당신 자리를 따뜻하게 지켰어요. / 없어진 건 없어요. 언제든 와요. — 윅 | 안녕하세요, / 마을이 자리를 따뜻하게 지켜 뒀어요. / 다 그대로예요. 언제든 놀러 와요. — 윅 |
| `wick.gift.tag.01` | 방에 하나 더요. | 방에 하나 더 두세요. |
| `wick.friend.level.01` | 있잖아요, 마을에서 당신 얘기를 해요. 좋게요. | 있잖아요, 마을에서 다들 이웃님 칭찬을 해요. |
| `wick.friend.level.02` | 와 준 사람이 당신이라서 다행이에요. 정말로요. | 와 준 게 이웃님이라서 참 다행이에요. 진심이에요. |
| `wick.tap.again.01` | 여기 있어요. 늘 그래요. 퐁. | 여기 있어요. 늘 여기 있죠. 퐁. |
| `momo.move_in.01` | 아, 안녕하세요. 모모예요. 이 부분 연습했어요. 힛. | 아, 안녕하세요. 모모예요. 인사 몰래 연습했어요. 힛. |
| `momo.move_in.02` | 이 집 당신이 밝혔어요? 저를… 위해서요? 고마워요. | 이 집에 불 켜 준 거예요? 저를… 위해서요? 고마워요. |
| `momo.greet.03` | 하늘이 분홍색이에요. 뽐내는 것 같아요. 좋아요. | 하늘이 분홍빛이에요. 오늘은 하늘이 멋 부렸나 봐요. |
| `momo.greet.05` | 안녕하세요! 이번엔 안 숨었어요. 발전했죠? | 안녕하세요! 이번엔 안 숨었어요. 저 많이 늘었죠? |
| `momo.puzzle.solved.01` | 해냈네요! 음, 박수 쳤어요. 못 봤겠지만요. | 해냈네요! 음… 박수 쳤어요. 못 봤겠지만요. |
| `momo.puzzle.solved.02` | 예뻤어요. 꽃잎 같은데, 논리가 있는 꽃잎요. | 꽃잎이 한 장씩 피어나는 것 같았어요. |
| `momo.return.01` | 앗! 안녕하세요! 좋은 쿠션 맡아 뒀어요. | 앗! 안녕하세요! 제일 폭신한 방석 맡아 뒀어요. |
| `momo.letter.move_in.01` | 저, 안녕하세요, / 예전 집에서 가져온 쿠션이에요. 용감한 쿠션요. / 이제 당신 거예요. — 모모 | 저, 안녕하세요, / 무서울 때마다 꼭 안고 있던 방석이에요. / 이제 이웃님 거예요. — 모모 |
| `momo.letter.gift.01` | 저, 안녕하세요, / 이걸 보고 당신 방이 생각났어요. / 이상하진 않죠? 힛. — 모모 | 저, 안녕하세요, / 이걸 보자마자 오두막이 생각났어요. / 이상한 건 아니죠? 힛. — 모모 |
| `momo.friend.level.01` | 말해도 돼요? 당신이 놀러 오는 게 좋아요. | 있잖아요… 놀러 와 줄 때마다 좋아요. |
| `momo.friend.level.02` | 선물 만들었어요. 저 가고 나서 열어요. 힛! | 선물 만들었어요. 제가 가고 나면 열어 봐요. 힛! |
| `momo.tap.again.01` | 힛! 아, 당신이었구나. 또 안녕하세요. | 힛! 아, 깜짝이야. 또 안녕하세요. |
| `sage.move_in.01` | 음… 안녕하세요. 화분에서 자고 있었어요. 미안해요. | 음… 안녕하세요. 화분에서 깜빡 잠들었어요. 미안해요. |
| `sage.move_in.02` | 세이지예요. 뭘 키워요. 천천히요. 저처럼요. | 세이지예요. 이것저것 키워요. 천천히요. 저처럼요. |
| `sage.greet.03` | 해 질 녘이에요. 꽃이 오므려요. 저도 따라 할래요. | 해 질 녘이에요. 꽃들이 오므리네요. 저도 따라 할래요. |
| `sage.greet.05` | 아, 당신이군요. 당신이면 깨요. 방금도 깼어요. | 아, 왔군요. 그럼 일어나야죠. 방금 깼어요. |
| `sage.puzzle.solved.01` | 잘했어요. 씨앗을 제자리에 하나씩 심은 것 같아요. | 잘했어요. 씨앗을 한 알씩 제자리에 심은 것 같아요. |
| `sage.return.02` | 없는 동안 새 잎이 났어요. 봐요. | 그사이 새 잎이 났어요. 봐요. |
| `sage.letter.move_in.01` | 음, 안녕하세요, / 화분이에요. 비어 있어요. 그게 재밌는 부분이죠. / 하암. — 세이지 | 음, 안녕하세요, / 빈 화분이에요. 뭘 심을지는 이웃님 마음이에요. / 하암. — 세이지 |
| `sage.letter.gift.01` | 음, 안녕하세요, / 풀 뽑다가 찾았어요. 사실은 자다가요. / 방에 두세요. — 세이지 | 음, 안녕하세요, / 풀 뽑다가 찾았어요. 사실은 졸다가요. / 방에 놓아 줘요. — 세이지 |
| `sage.gift.tag.01` | 음. 하나 더요. 하암. | 음, 하나 더 있어요. 하암. |
| `sage.friend.level.01` | 당신은 봄처럼 와요. 조용히요. 좋아요. | 봄처럼 와 주네요. 조용히요. 좋아요. |
| `sage.friend.level.02` | 당신 몫으로 하나 심었어요. 오래 걸려요. 그래도요. | 이웃님 몫으로 하나 심었어요. 오래 걸려도 기다릴 만해요. |
| `sage.tap.again.01` | 음? 아. 눈 좀 쉬고 있었어요. 두 눈 다요. | 음? 아. 눈 좀 감고 있었어요. 두 눈 다요. |
| `luna.move_in.01` | 안녕하세요! 밤이에요? 루나예요. 하늘을 봐요. | 안녕하세요! 밤이에요? 루나예요. 하늘 보는 게 좋아요. |
| `luna.move_in.02` | 이 마을은 하늘이 참 좋아요. 확인했어요. | 이 마을은 하늘이 참 좋네요. 제가 확인했어요. |
| `luna.greet.03` | 해 질 녘! 첫 별은 늘 제일 용감해요. | 해 질 녘이에요! 첫 별은 언제나 제일 용감해요. |
| `luna.letter.move_in.01` | 같은 하늘 아래 당신에게, / 밤까지 몇 시간인지 세라고 드려요. / 반짝. — 루나 | 같은 하늘 아래 이웃님에게, / 밤이 오기까지 몇 시간 남았나 세어 봐요. / 반짝. — 루나 |
| `pip.move_in.01` | 안녕안녕! 나 핍! 작아도 응원은 크게 해! 폴짝! | 안녕안녕! 나 핍이야! 작아도 응원은 크게 해! 폴짝! |
| `pip.move_in.02` | 여기 내 집이야? 엄청 커! 아니 내가 작은가? 둘 다! | 여기가 내 집이야? 엄청 크다! 내가 작은 건가? 둘 다! |
| `pip.greet.03` | 노을이다! 해야 오늘 수고했어! 잘했어! | 노을이다! 해야, 오늘 수고했어! 정말 잘했어! |
| `pip.return.01` | 왔다! 폴짝! 응. 안녕. 폴짝! | 왔다! 폴짝! 그러니까… 안녕! 폴짝! |
| `pip.letter.move_in.01` | 안녕!! / 뛰기용 러그야. 내가 시험해 봤어. 엄청. / 야호! — 핍 | 안녕!! / 폴짝폴짝 뛰기 좋은 러그야. 내가 엄청 뛰어 봤어. / 야호! — 핍 |

**한국어 — 1.0 세트 밖(1.1 등) 28줄: "당신" 제거와 같은 원칙 적용**

| id | 이전 | 이후 |
|---|---|---|
| `wick.host.06` | 마음에 드는 걸 하나 골라요. 나머지는 또 와요. | 마음에 드는 걸 하나 골라요. 나머지는 다음에 또 나와요. |
| `wick.letter.thanks.01` | 안녕하세요, / 구석에 불이 켜졌어요. 다들 거기서 이야기해요. / 고마워요. — 윅 | 안녕하세요, / 구석에 불이 켜졌어요. 다들 거기 모여 얘기해요. / 고마워요. — 윅 |
| `wick.host.08` | 우리가 안 보는 사이 계절이 바뀌었어요. 퐁. | 어느새 계절이 바뀌었네요. 퐁. |
| `wick.request.ask.01` | 오두막 구석이 어두워요. 등 하나면 돼요. | 오두막 구석이 좀 어둡네요. 등 하나면 될 텐데요. |
| `wick.request.again.01` | 아까 그 등 얘기, 아직 유효해요. 언제든요. 퐁. | 그 등 얘기, 생각나면 해요. 천천히요. 퐁. |
| `wick.request.visit.01` | 이제 아무도 어두운 데 안 앉아요. | 이제 어두운 데 앉을 일이 없겠어요. |
| `momo.letter.thanks.01` | 저, 안녕하세요, / 당신 방에 앉아 봤어요. 하나도 안 무서웠어요. / 정말 고마워요. — 모모 | 저, 안녕하세요, / 오두막에 앉아 봤어요. 하나도 안 무서웠어요. / 정말 고마워요. — 모모 |
| `momo.request.ask.01` | 저기… 쿠션 하나 있을까요? 용감하게 앉으려고요. | 저기… 방석 하나 있을까요? 앉으면 용기가 나서요. |
| `momo.request.again.01` | 그 쿠션 얘기… 천천히요. 정말로요. 힛. | 그 방석 얘기… 천천히요. 정말이에요. 힛. |
| `momo.request.visit.01` | 당신 방에 앉아 있어요! 괜찮죠? 괜찮아요. | 오두막에 앉아 있어요! 괜찮죠? 괜찮을 거예요. |
| `sage.letter.thanks.01` | 음, 안녕하세요, / 당신 방에서 낮잠 잤어요. 이번 철 최고였어요. / 고마워요. 하암. — 세이지 | 음, 안녕하세요, / 오두막에서 낮잠 잤어요. 올해 최고의 낮잠이에요. / 고마워요. 하암. — 세이지 |
| `sage.request.visit.01` | 당신 화분이랑 친해졌어요. 음. 낮잠 시간이에요. | 새 화분이랑 친해졌어요. 음. 낮잠 시간이에요. |
| `luna.letter.gift.01` | 같은 하늘 아래 당신에게, / 밤하늘에서 떨어졌어요. 당신 거 같아요. / — 루나 | 같은 하늘 아래 이웃님에게, / 밤하늘에서 떨어졌어요. 주인을 찾아왔나 봐요. / — 루나 |
| `luna.letter.thanks.01` | 같은 하늘 아래 당신에게, / 당신 방이 마을 최고의 천문대예요. / 고마워요! 반짝. — 루나 | 같은 하늘 아래 이웃님에게, / 오두막 창이 마을 최고의 천문대예요. / 고마워요! 반짝. — 루나 |
| `luna.greet.05` | 당신도 올빼미예요? 우리 별 하나 이름 지어요. | 올빼미 친구네요? 우리 별 하나 이름 지어요. |
| `luna.request.ask.01` | 벽에 걸 거 하나요? 시계면 늦은 걸 알 수 있죠. | 벽에 걸 게 있을까요? 시계면 밤이 오는 걸 알죠. |
| `luna.request.visit.01` | 당신 창으로 새 별이 세 개 보여요. 안녕, 별들아. | 오두막 창으로 새 별이 세 개 보여요. 안녕, 별들아. |
| `luna.friend.level.01` | 별 하나에 당신 이름 붙였어요. 작은 별요. 열심이에요. | 별 하나에 이웃님 이름을 붙였어요. 작아도 열심이에요. |
| `kuri.request.ask.01` | 당신 방에 털실 둘 데 있을까요? 바구니든 뭐든요. | 오두막에 털실 둘 데 있을까요? 바구니든 뭐든요. |
| `kuri.letter.thanks.01` | 차 한 잔과 함께, / 당신 방이 이제 제일 좋은 뜨개 자리예요. / 언제든 몸 녹이러 와요. — 쿠리 | 차 한 잔과 함께, / 오두막이 이제 제일 좋은 뜨개 자리예요. / 언제든 몸 녹이러 와요. — 쿠리 |
| `kuri.friend.level.01` | 당신 크기로 뭘 뜨기 시작했어요. 흠흠♪ | 이웃님 품에 맞게 뭘 뜨기 시작했어요. 흠흠♪ |
| `yuki.request.ask.01` | 당신 방에 작은 침대 하나요? 조용한 데서 자요. | 오두막에 작은 침대 하나 있을까요? 조용한 데서 자요. |
| `yuki.letter.thanks.01` | 안녕하세요. / 당신 방에서 잤어요. 아무 소리도 없었어요. / 고마워요. 쉿. — 유키 | 안녕하세요. / 오두막에서 잤어요. 아무 소리도 없었어요. / 고마워요. 쉿. — 유키 |
| `yuki.letter.gift.01` | 안녕하세요. / 눈 속에서 찾았어요. 차갑지 않았어요. / 당신 거예요. — 유키 | 안녕하세요. / 눈 속에서 찾았어요. 차갑지 않았어요. / 드릴게요. — 유키 |
| `yuki.greet.05` | 아. 당신이네요. …당신이랑은 말해도 괜찮아요. | 아. 왔네요. …이웃님이랑은 얘기해도 괜찮아요. |
| `yuki.return.02` | 날짜는 안 셌어요. 고개 드니까 당신이네요. | 날짜는 안 셌어요. 고개를 드니까 와 있네요. |
| `yuki.tap.again.01` | 쉿… 아. 당신이네요. 괜찮아요. | 쉿… 아. 왔네요. 괜찮아요. |
| `wick.puzzle.hard.02` | 저는 두 번 걱정했는데 당신은 안 했죠. 잘했어요. | 저는 두 번이나 걱정했는데, 끄떡없었죠. 잘했어요. |

**영어 7줄 변경** (id·trigger는 그대로, 7줄 모두 앱 1.0 세트)

| id | 이전 | 이후 |
|---|---|---|
| `wick.host.02` | Every light you make, someone gets a home by it. | Every light you make gives someone a home. |
| `wick.letter.gift.01` | Hello, / The jar filled up again. Your doing. / Here's something for the room. — Wick | Hello, / The lantern jar is full again. Your doing. / Here's something for the room. — Wick |
| `wick.friend.level.01` | You know, the village talks about you. Kindly. | You know, the village talks about you. All good things. |
| `momo.move_in.01` | Oh—hi. I'm Momo. I practiced this part. Eep. | Oh—hi. I'm Momo. I practiced saying hello. Eep. |
| `momo.puzzle.solved.02` | That was lovely. Like petals, but with logic. | That was lovely. Like petals opening, one by one. |
| `momo.letter.move_in.01` | Um, hello, / This cushion is from my old house. It's very brave. / Now it's yours. — Momo | Um, hello, / I hugged this cushion whenever I got scared. / Now it's yours. — Momo |
| `sage.letter.move_in.01` | Mm, hello, / This pot is for you. It's empty. That's the fun part. / Fwaah. — Sage | Mm, hello, / An empty pot. What grows in it is up to you. / Fwaah. — Sage |


---

## 8. 8개 언어 초안 (ja · de · fr · es · pt-BR · it · zh-Hans · zh-Hant) — R3 61줄, R4에서 195줄로 확장(§9)

- **파일**: `docs/team/r2-village-lines.<locale>.json`
  - 형식: `{locale, status, source, names, cp, text: {id: 문장}, uncertain: {id: 사유}}`
  - `text`는 앱 `lines/ko.json`과 같은 모양이다. 말버릇은 이미 바뀐 상태이고, 편지 줄바꿈은 `\n`이다.
  - 앱에 넣을 때는 `village-l10n-todo.md`의 "넣는 방법" 1번처럼 `{locale, cp, text}`만 옮긴다.
- **범위**: 앱 1.0 세트 61줄(Wick·Momo·Sage·Luna·Pip, 황혼 인사, 호스트 5종 등 `village-lines.mjs keep()` 기준)
- **검사**(스크립트, 통과)
  - 줄 길이: ja ≤ 32, zh ≤ 28, 그 밖 ≤ 60. 편지는 줄마다 센다.
  - 말버릇이 들어가야 할 줄에 그 언어의 말버릇이 있다.
  - fr는 ! ? ; : 앞에 줄바꿈 없는 공백(U+00A0)을 넣었다. 고아 "!"를 막는다.
- **말투**
  - ja: です・ます. Pip(ピピ)만 タメ口이고, 1인칭을 이름으로 써서 성별을 피했다. "あなた"는 편지 정형구 「同じ空の下のあなたへ」에만 쓴다.
  - de: du. fr: 주민은 tu. es: tú, 중립 스페인어. pt-BR: você. it: tu.
  - zh: 你, 겹글자 애칭(桃桃·叶叶/葉葉·月月·皮皮), Wick = 小烛/小燭. zh-Hant는 대만 어휘(喔, 拍手, 這裡)를 쓴다.
- **성별 회피** (§5.3)
  - 플레이어를 향한 성별 일치를 모두 피했다. 예: es "Ya estás en casa"(Bienvenido/a 대신), it "Sei a casa", pt "Você está em casa".
  - 주민의 자기 묘사도 피했다. 예: fr "Minuscule"(epicene), es "Mido poquito", pt "Tamanho de bolso", it "mini", pt "Que gentil"(obrigado/a 대신), fr "Ouvre-le après mon départ"(partie 대신).
- **용어 제안** (글로서리에 추가 필요. 마을 UI 55키가 아직 en·ko뿐이므로 UI 번역 때 같은 말을 써야 한다)

| 용어 | ja | de | fr | es | pt-BR | it | zh-Hans | zh-Hant |
|---|---|---|---|---|---|---|---|---|
| lantern jar | ランタンのびん | Laternenglas | bocal à lumières | frasco de luces | pote de luzes | barattolo delle luci | 灯笼瓶 | 燈籠瓶 |
| my cabin | 小屋 | Hütte | cabane | cabaña | cabana | casetta | 小屋 | 小屋 |
| cushion | クッション | Kissen | coussin | cojín | almofada | cuscino | 坐垫 | 坐墊 |

- **불확실 표시**: 로캘마다 2–4줄을 각 파일의 `uncertain`에 사유와 함께 적었다. 대표적인 것:
  - fr "pas japonais"(디딤돌), it "Sei stato grande"(해에게)
  - zh "臭美"(어감)
  - ja 「今日からここのものです」(あなた 회피)
  - 각 언어의 lantern jar 용어
- **AI 초안이다.** 원어민 1회 검토(사용자 몫)와 G3 렌더 검사(375 pt, 실제 글꼴, 금칙·고아)를 통과해야 그 로캘에 마을을 낸다(`village-l10n-todo.md`).

---

## 9. R4 — 1.0 마을 전체판 (DECISIONS 라운드 3)

**1.0 세트 정의**
- 규칙: `ship == "1.0"`. 이 문서의 줄 중 `chat`(이웃 잡담)과 `puzzle.hard`만 1.1로 남긴다. 오너 범위 목록에 없고, 두 가지 모두 현지화 비용 대비 효과가 낮다.
- 합계 195줄

| 주민 | 1.0 줄 | 들어간 trigger |
|---|---|---|
| Wick | 38 | host 11(첫 방문·우편·이사 전날·이사·장터 열림·**장터 고름**·**장터 잠김**·오두막 첫 방문·계절 바뀜·**방 엽서**), move_in ×2, greet ×5(시간대 4 + 우정 2단계), puzzle.solved ×2, return ×2, season ×4, request.ask ×2 / again / visit, letter ×4, gift.tag, friend.level ×2, tap.again |
| Momo · Sage · Luna · Pip · Kuri | 각 26 | move_in ×2, greet ×5, puzzle.solved ×2, return ×2, season ×4, request.ask ×2 / again / visit, letter.move_in / gift / thanks, gift.tag, friend.level ×2, tap.again |
| Yuki | 27 | 위와 같음 + `event.first_snow` |

- 위 표의 줄 수는 `chat`·`puzzle.hard`를 빼고 센 값이다. Wick은 전체 42줄에서 `puzzle.hard`·`chat` 4줄을 빼서 38줄이다(38 + 26×5 + 27 = 195).

**새 호스트 줄 (Wick, 장터와 엽서)**
- `wick.host.09` marketPicked: "Good pick. It'll look nice somewhere." / "잘 골랐어요. 어디에 둬도 예쁠 거예요."
- `wick.host.10` marketLocked(오늘 판을 풀기 전): "The stall opens once a lantern is lit today. No rush." / "오늘 등불을 하나 켜면 장터가 열려요. 천천히요."
  - 압박을 피하려고 "No rush"를 붙였다. 장터를 열 때 한 번만 보여 준다.
- `wick.host.11` postcardTaken: "Nice room. It looks properly lived-in now." / "방 예쁘네요. 이제 정말 사는 집 같아요."
- 장터 열림(`wick.host.06`)과 계절 바뀜(`wick.host.08`)은 원래 있던 줄을 1.0에 넣었다.
- 기존 id(host.01–08)는 그대로다. 새 줄은 뒤에 붙였다.

**부탁 리듬 (변경 없음, 확인)**
- 그날의 부탁 주민 1명이 `request.ask`로 연다. 마감은 없다.
- `request.again`은 3일 이상 지났을 때만, 늘 "천천히"와 함께 나온다(드물게).
- 그 계열 가구를 오두막에 놓으면 주민이 와서 앉는다 → `request.visit` → 다음 날 `letter.thanks`.

**한국어 다듬기 (새로 1.0에 들어온 줄, R3 원칙 그대로)**
- "밤 철이에요" → "군밤 철이에요": 밤(栗)과 밤(夜)을 혼동하지 않게 했다.
- "다들한테"(비표준) → "모두한테"
- "불빛은 괜찮대요" → "등불도요"
- "다들 노을을 더 받아요" → "노을도 그만큼 길어요"
- "네 방에 러그 하나!" → "오두막에 러그 하나 깔아 줄래?"
- "이제 곧일지도요" → "눈이 곧 올지도 몰라요"
- 그 밖에 Momo·Sage·Luna·Kuri·Yuki의 7줄을 고쳤다(번역투와 명령조 제거).
- 1.0 전체에서 "당신"은 0번이다. 줄 길이는 en ≤ 60, ko ≤ 32를 지켰고 빌드 검사를 통과했다.

**8개 언어 (195줄 전부)**
- 파일 구조는 §8과 같다.
- `names`·`cp`에 Kuri·Yuki를 추가했다: ja クリ·ユキ, zh 栗栗·雪雪.
- zh-Hant의 새 134줄은 **글자 변환을 버리고 대만 화어로 새로 썼다**(R4 수정). 줄마다 zh-Hans와 어휘를 대조했다. 주요 차이는 다음과 같다.
  - 인사: 下午好 → 午安, 早 → 早安
  - 장터: 集市 → 市集
  - 날씨: 雪好冷 → 雪好冰, 雪化了 → 雪融化了, 太晒了 → 太陽好大
  - 물건: 小摆设 → 擺飾, 水壶烧上了 → 水已經在燒了, 饼干 → 餅乾
  - 뜨개: 第四十行 → 第四十段, 织一两行 → 織個一兩段
  - 말투: 编了口号 → 想了口號, 你猜怎么着 → 你猜怎樣, 大概吧 → 大概啦, 远亲 → 遠房親戚, 暖暖身子 → 取暖, 主要是书 → 大多是書
  - 문장 끝: 喔·啦·耶·呢 같은 대만 구어 어기사를 썼다.
  - Big5 검사만 남겼고, 원어민 검토는 여전히 필요하다.
- 장터 용어는 `docs/i18n-glossary.md`에 "market stall" 행으로 넣었다.
- 성별 회피: pt-BR은 obrigado/obrigada 대신 "Agradeço"를 썼다. it "Occhi aperti!"(sveglio/a 대신), fr "tiède"·"Couche-tard"(성별 무관 형용사), es "¿También te gusta la noche?"(noctámbulo/a 대신).
- 장터 용어 제안(글로서리): ja 屋台, de Stand, fr étal, es puesto, pt-BR barraca, it bancarella, zh-Hans 集市, zh-Hant 市集.
- 불확실한 줄은 로캘마다 `uncertain`에 사유와 함께 있다(로캘당 5–8줄).

---

## 출처

- [S1] 성격 8종, smug·big sister는 New Leaf에서 추가 — https://techraptor.net/gaming/guides/animal-crossing-new-horizons-personality-guide · https://www.tvtropes.org/pmwiki/pmwiki.php/Characters/AnimalCrossingVillagerTypes
- [S2] 현지화 때 이름과 말버릇을 새로 썼다(Leslie Swan, Time Extension 인터뷰의 2차 보도. 원문은 확인하지 못했다) — https://gigazine.net/gsc_news/en/20250116-animal-crossing-change-everything · https://hitmarker.net/news/former-nintendo-boss-satoru-iwata-burst-out-in-laughter-at-the-idea-of-localizing-animal-crossing-interview-reveals-1515740
- [S3] Treehouse: 주민은 "아는 사람들처럼" 말한다 — https://www.siliconera.com/?p=320029
- [S4] Neko Atsume "보고 즐기는" 의도 — https://nippon.com/en/nipponblog/m00083
- [S5] Neko Atsume 현지화(8-4) 인터뷰 — https://soranews24.com/2015/11/13/smartphone-smash-neko-atsume-heads-west-we-talk-to-the-localization-team-behind-it%E3%80%90interview%E3%80%91/amp/
- [S6] Neko Atsume 멸치·기념품 — https://en.wikipedia.org/wiki/Neko_Atsume
- [K] Animal Crossing 대사·편지·부재 처벌, Cats & Soup, Tsuki's Odyssey, Hello Kitty Island Adventure: 장르 지식이며 재확인이 필요하다. design 문서 §1.1의 URL을 1차 확인용으로 쓴다.
- 팀 문서: r1-visual.md(V6 Sumikko, V7 Chiikawa — 결점이 매력), r2-village-design.md, i18n-glossary.md.
