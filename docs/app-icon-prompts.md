# 앱 아이콘: 디자인 명세와 무료 생성 도구 프롬프트 (Lanternly, 가칭)

작성 2026-10-14. 이 문서는 조사와 글쓰기만 담았다. 코드나 에셋 파일은 바꾸지 않았다.
근거로 본 화면: `playtest/shots/v6/03-stuck-one-culprit.png`, `07-tower-reveal.png`, `09-daily-start-today.png`, `town-30.png`
근거로 본 팔레트: `apps/client/src/render/palette.ts`

> **한 줄 결론.** 실제로 출시할 아이콘은 §5의 절차적 SVG(사람이 그린 벡터, 비용 0원, 팔레트 정확 일치)로 만드는 것을 권한다. AI 도구는 분위기 레퍼런스와 페인터리 대안을 뽑는 데 쓴다. AI로 뽑은 결과를 그대로 출시하려면 상업 이용이 가장 깨끗한 경로는 **FLUX.1 [schnell]을 로컬(Draw Things)에서 돌리는 것**이다. 모델 라이선스가 Apache-2.0이고 업체 약관이 끼지 않는다.

---

## 0. 게임의 시각 정체성 요약 (스크린샷에서 읽은 것)

| 요소 | 게임 안 모습 | 아이콘에 쓰는 방식 |
|---|---|---|
| 하늘 | 위는 짙은 남색(`skyNight #141A33`), 가운데는 보라(`skyDusk #2B2350`), 지평선은 먼지 낀 장미색(`skyHorizon #C97B84`, `skyGlow #E8A08A`) | 배경 세로 그라디언트 |
| 언덕 | `hillFar #5B4470` → `hillNear #231F40` 실루엣 | 하단 낮은 언덕 한 겹(선택) |
| 등불 | 둥근 종이 초롱. 주황 몸통에 흰빛 심지, 위아래 갈색 링과 짧은 고리. 세로 살이 보인다 | **주인공** |
| 빛 | 등불이 놓인 칸의 행과 열 전체가 호박색으로 켜진다(`litCore #F2C46D`, `litEdge #B9814A`) | 3×3 격자에서 **가운데 십자(+)** 5칸이 켜짐. 규칙 자체를 보여 준다 |
| 바닥 | 둥근 사각 타일 `floor #232946`, 줄눈 `grout #11142A`, 테두리 `rim #2E3354` | 어두운 네 모서리 칸과 받침판 |
| 달 | 크림색 초승달 `moon #F4EBD0` | iOS 전용 장식(선택). Android에서는 뺀다 |
| 돌·숫자 | 이끼 낀 돌, 숫자 돌 | **아이콘에는 넣지 않는다.** 숫자는 글자로 취급한다 |

팔레트는 색상보다 **명도** 차이로 구분하도록 설계돼 있다(palette.ts 주석: 바닥→켜진 칸 심지 8.7:1). 아이콘도 같은 원칙을 따른다. 흑백으로 바꿔도 등불이 가장 밝고, 십자가 다음, 모서리 칸이 가장 어두워야 한다.

---

## 1. 아이콘 디자인 브리프

### 1.1 핵심 심볼: 1안 추천, 2안 대안

**추천 A: "한 개의 등불, 빛의 십자"**
3×3 둥근 타일 격자의 가운데 칸 위에 빛나는 종이 등불 하나가 놓인다. 가운데 행과 열(5칸)은 따뜻한 호박색으로 켜지고, 네 모서리 칸은 어두운 남색으로 남는다. 배경은 해 질 녘 그라디언트다.
- 이유: (1) 게임 규칙("빛이 행과 열로 퍼진다")을 한 장면에 보여 주는 유일한 안이다. (2) 29px까지 줄여도 "밝은 주황 점 + 밝은 십자 + 어두운 네 귀퉁이"가 남는다. (3) 블록 퍼즐 아이콘들(채도 높은 다색 블록, 광택 플라스틱, 나무)과 달리 저채도 보라 위에 따뜻한 빛 하나만 있어 목록에서 튄다.
- 주의할 점: 십자(+) 모양이 의료나 약국 앱으로 읽힐 수 있다. 그래서 (a) 빨강과 초록을 쓰지 않고 호박색만 쓰며, (b) 등불이 십자 한가운데를 덮게 하고, (c) 십자 끝으로 갈수록 빛이 약해지게(radial falloff) 해서 "평평한 기호"가 아니라 "퍼지는 빛"으로 보이게 한다. 또 하나, 빨간 등불에 술과 금색 글자를 달면 설날·중국 신년 앱처럼 보인다. **주황·호박색만 쓰고 술과 글자는 넣지 않는다.**

**대안 B: "불 켜진 창과 등불"**
게임 속 집 창문처럼 십자 창살로 나뉜 2×2 창 하나가 노랗게(`windowLit #FFC864`, 심 `#FFF4D6`) 켜져 있고, 창턱 앞 오른쪽 아래에 작은 등불 하나가 놓인다. 바깥 벽은 `wall #2A2240`, 가장자리 빛은 `wallRim #D88BA6`이다.
- 장점: 따뜻하고 "집 같은" 느낌이 가장 강하다. 30대 후반~50대가 좋아하는 코지 톤이다.
- 단점: 스마트홈·부동산·명상 앱 아이콘과 겹친다. 퍼즐이라는 단서가 약하다.

**대안 C: "등대 꼭대기와 빛줄기"**
화면 왼쪽 아래에서 등대 탑 꼭대기(`town-30.png`의 탑)가 빛나고, 넓은 빛줄기 하나가 오른쪽의 작은 3×3 격자를 가로지르며 한 줄을 밝힌다.
- 장점: 게임의 메타 진행(탑 공개)과 연결된다. 서사가 있다.
- 단점: 요소가 3개(탑, 빛줄기, 격자)라서 60px 아래에서는 뭉개진다. 앱스토어 스크린샷이나 홍보 이미지에 더 어울린다.

### 1.2 구도 규칙 (1024×1024 기준)

- **풀블리드 정사각형**으로 만든다. 둥근 모서리, 테두리, 그림자를 그려 넣지 않는다. iOS와 Android가 마스크를 씌운다.
- **핵심 피사체**(등불 + 켜진 십자)는 캔버스 중심 (512,512)에서 반지름 **313px** 안에 둔다. 이는 Android 안전 영역(108dp 중 66dp, 지름 626px)과 같고, 요청한 "가운데 약 66%"도 만족한다. §5 좌표로 계산하면 피사체 최대 거리는 약 301px이라 통과한다.
- 받침판 모서리와 달은 그 밖으로 나가도 된다. iOS 스퀴클 마스크 안에서는 잘리지 않는다. Android에서는 아래 규칙을 따른다.
- **Android 적응형 아이콘**: 레이어는 각각 108×108dp다. 바깥 18dp씩은 마스크와 시차 효과용으로 비워 두고, 보이는 영역은 대략 가운데 72dp, 절대 안 잘리는 영역은 66dp다.
  - background 레이어: 하늘 그라디언트 + 언덕. 달은 뺀다(원형 마스크에서 반쯤 잘리면 어색하다).
  - foreground 레이어: 받침판 + 타일 + 후광 + 등불. 중심 기준으로 **0.82배 축소**한다. 받침판 둥근 모서리의 가장 먼 점이 중심에서 약 404px인데, 0.82배 하면 331px로 보이는 원(반지름 약 341px) 안에 들어온다.
  - monochrome 레이어: §3.3의 단색 실루엣. Android 13 이상 테마 아이콘용이다.
- 시선 중심은 등불의 흰 심지 (512, 520)이다. 격자 중심은 (512, 548)로 36px 내려서 등불 고리와 달이 들어갈 위쪽 공간을 확보한다.

### 1.3 배경 그라디언트 (게임 팔레트 그대로)

| 오프셋 | 색 | 토큰 |
|---|---|---|
| 0.00 (위) | `#141A33` | skyNight |
| 0.45 | `#2B2350` | skyDusk |
| 0.78 | `#5B4470` | hillFar |
| 1.00 (아래) | `#C97B84` | skyHorizon |
| + 아래 중앙 원형 광(cx 512, cy 1024, r 560) | `#E8A08A` 35% → 0% | skyGlow |
| + 언덕 실루엣(y 약 880–920 곡선 아래) | `#231F40` | hillNear |

### 1.4 작은 크기 가독성 (60×60, 29×29)

- 29px에서 1px은 1024 캔버스의 약 35단위다. **70단위(2px) 미만인 요소는 사라진다**고 보고 설계한다. 등불 살(10), 고리(18), 받침판 테두리(10)는 사라져도 되는 장식이다. 정보는 등불 몸통(276×228), 타일(160), 십자 전체에 실려 있다.
- 명도 순서: 등불 심지(`#FFF4D6`) > 켜진 십자(`#FFC864` → `#F2C46D`) > 하늘 > 모서리 칸(`#232946`) > 줄눈(`#11142A`). 흑백 변환에서도 이 순서가 유지되는지 확인한다(§4.6).
- 60px에서는 달이 작은 초승달로 보이고, 29px에서는 점이 된다. 괜찮다. 달 없이도 아이콘이 성립해야 한다.
- 채도가 높은 색은 등불의 `#F08A5D`(koi) 가장자리 하나뿐이다. 나머지는 저채도라 홈 화면에서 "조용한데 눈에 띄는" 대비가 생긴다.

### 1.5 iOS 18+ 다크 / 틴트 변형, iOS 26 Icon Composer

Xcode 16 이상의 AppIcon(Single Size)에는 **Any(기본), Dark, Tinted** 세 슬롯이 있다. 각각 1024×1024 PNG를 넣는다.

| 변형 | 넣을 것 | 핵심 |
|---|---|---|
| 기본 (Light/Any) | §5의 전체 아이콘, 불투명 | 투명 픽셀 금지 |
| Dark | 받침판 + 타일 + 후광 + 등불만. **배경은 투명**으로 두면 시스템이 자체 어두운 배경을 깐다. 직접 깔고 싶으면 `#0F1124`(groundDeep) 단색 | 후광을 조금 키우고(r 320→360), 모서리 칸을 `#2B3254`로 한 단계 밝혀 검정에 묻히지 않게 한다 |
| Tinted | **그레이스케일** 이미지. 등불 흰색, 켜진 십자 70% 회색, 받침판·모서리 칸 20–25% 회색, 배경은 투명(또는 검정) | 시스템이 사용자 색으로 물들인다. 후광은 뿌연 회색이 되므로 빼거나 아주 약하게 둔다 |

**iOS 26 이상(Xcode 26)**: Icon Composer로 `.icon` 파일 하나를 만들면 기본, 다크, 클리어(라이트/다크), 틴트(라이트/다크)가 모두 그 파일에서 렌더링된다. 레이어는 다음처럼 나누는 것을 권한다.
`Background`(하늘 그라디언트 + 언덕) / `Group 1: 받침판 + 타일` / `Group 2: 후광 + 등불` / (선택) `Group 3: 달`
§5 SVG의 `<g>`를 그대로 레이어로 내보내면 된다. Liquid Glass 하이라이트 때문에 등불이 플라스틱처럼 보이면 그 그룹의 glass 효과를 줄인다. 레이어를 넘길 때 둥근 마스크를 넣지 말고 전체 캔버스를 쓴다.

### 1.6 피할 것

- **글자, 숫자, 한자처럼 생긴 무늬** 전부. 등불에 쓰인 글씨, 숫자 돌, 서명, 워터마크 포함. 앱 이름이 확정되지 않았으니 더더욱 넣지 않는다.
- 얇은 선(1024 기준 굵기 24px 미만인 선에 정보를 싣는 것), 별 무리, 반딧불이, 꽃잎 같은 잔 장식.
- 실사 사진풍, 3D 광택 플라스틱, 나무 질감(블록 퍼즐 경쟁작과 겹친다).
- 마스코트, 얼굴, 큰 눈의 귀여운 캐릭터, 원색 무지개 팔레트(아동용으로 보인다).
- 상표가 있는 스타일이나 작가 이름 참조: "Monument Valley 풍", "지브리 풍", 특정 일러스트레이터 이름. 프롬프트에도 쓰지 않는다.
- 아이콘 안의 아이콘: 둥근 사각형 테두리, 흰 바탕 위 드롭 섀도. AI 도구가 가장 자주 내는 실패다.

---

## 2. 무료 도구 4종: 복사해서 붙여 넣는 프롬프트

공통 팁: 모든 도구에서 **1:1 비율**로 한 번에 4–8장을 뽑는다. 격자가 정확히 3×3인지, 글자가 끼어들지 않았는지 확대해서 본다. AI는 칸 수를 자주 틀린다. 틀리면 §4의 후처리로 고치거나, §5 벡터 위에 등불만 합성한다.

### 2(a) Draw Things: FLUX.1 [schnell] (권장) / SDXL (대안), 로컬 실행

Draw Things는 Mac App Store에서 무료로 받는 앱이다(Apple Silicon Mac, iPhone, iPad). 앱 안 모델 목록에서 `FLUX.1 [schnell]`을 내려받는다. 메모리가 빠듯하면 8-bit 양자화 버전을 고른다.

**FLUX.1 [schnell] 설정**

| 항목 | 값 |
|---|---|
| Model | FLUX.1 [schnell] |
| Size | 1024 × 1024 |
| Steps | 4 (1–4단계용으로 증류된 모델이다. 6을 넘겨도 좋아지지 않는다) |
| Text Guidance (CFG) | 1.0. schnell은 가이던스가 증류돼 있어 공식 예시도 guidance 0이다. Draw Things에서는 1.0이 사실상 끔이다 |
| Sampler | Draw Things가 FLUX에 기본으로 고르는 *Trailing* 계열(예: Euler A Trailing) |
| Seed | 처음엔 랜덤으로 8장 → 마음에 드는 시드를 고정하고 프롬프트만 다듬는다 |
| Negative prompt | **쓰지 않는다.** CFG 1에서는 무시된다. 피할 것은 긍정 문장으로 바꿔 쓴다(아래 프롬프트의 "plain, wordless" 부분) |

**긍정 프롬프트 (FLUX, 기본 다크 버전, 자연어)**
```
A square mobile game app icon, flat vector illustration with soft gradients, centered and symmetrical. In the middle sits a tiny courtyard: a 3 by 3 grid of rounded square stone tiles on a dark navy tray. A single round paper lantern rests on the center tile, glowing warm amber with a bright cream-white core, thin dark brown cap and base rings, a few soft vertical ribs. The lantern's light spreads in a plus shape: the whole middle row and the whole middle column of tiles glow honey amber, fading slightly toward their ends, while the four corner tiles stay dark navy blue. Soft round halo of warm light around the lantern. Background is a smooth dusk sky gradient filling the entire square edge to edge, deep indigo at the top, violet in the middle, dusty rose pink at the very bottom, with a low dark purple hill silhouette along the bottom edge. Calm, cozy, quiet, grown-up, minimal, generous empty space, matte surfaces, crisp clean shapes. The image is plain and wordless: only the lantern, the tiles and the sky.
```

**SDXL 대안 (Draw Things / ComfyUI / A1111 공통, `(단어:가중치)` 문법)**
모델: Stable Diffusion XL base 1.0. 리파이너는 끈다. 라이선스는 CreativeML Open RAIL++-M으로, 사용 제한 조항을 지키면 상업 이용이 허용된다(§2.5).

| 항목 | 값 |
|---|---|
| Size | 1024 × 1024 |
| Sampler | DPM++ 2M Karras |
| Steps | 30 |
| CFG | 6 |

긍정:
```
(app icon:1.2), flat vector illustration, centered symmetrical composition, (single glowing round paper lantern:1.3) on the center tile of a (3x3 grid of rounded square tiles:1.2), (plus-shaped light:1.2), middle row and middle column tiles glowing warm amber, four corner tiles dark navy, dark navy tray, soft warm halo, cream white lantern core, dusk gradient background, deep indigo top, violet middle, dusty rose bottom, low dark purple hill silhouette, full bleed square, matte, soft gradients, minimal, calm, cozy, elegant, clean shapes, high contrast silhouette
```
부정:
```
text, letters, words, numbers, kanji, chinese characters, calligraphy, watermark, signature, logo, typography, label, rounded corners, border, frame, drop shadow, white background, icon on background, multiple lanterns, red lantern, tassels, gold ornaments, photorealistic, photo, 3d render, glossy plastic, wood texture, tetris blocks, candy colors, rainbow, cartoon mascot, face, eyes, chibi, childish, clutter, stars, fireflies, flowers, thin lines, noise, grain, jpeg artifacts, blurry, lowres
```

### 2(b) Microsoft Designer / Bing Image Creator

강점: 자연어 묘사를 잘 따르고, 무료로 빠르게 여러 장을 뽑는다. 부정 프롬프트 칸이 없으니 피할 것을 문장 속에 쓴다. 모델을 고를 수 있으면 여러 모델로 같은 프롬프트를 돌려 비교한다. 비율은 Square.
> 상업 이용 조건이 엇갈린다(§2.5). **아이디어 탐색용으로만** 쓰고 출시물에는 쓰지 않는 것을 권한다.

```
Design a square app icon for a calm, grown-up logic puzzle game. Flat vector illustration with soft gradients, centered and symmetrical, filling the entire square with no rounded corners, no border and no shadow. Show a tiny 3 by 3 grid of rounded square stone tiles on a dark navy tray. One round paper lantern sits on the center tile and glows warm amber with a cream-white heart. Its light spreads in a plus shape, so the middle row and middle column of tiles glow honey amber while the four corner tiles remain dark navy. A soft warm halo surrounds the lantern. The background is a dusk sky gradient: deep indigo at the top, violet in the middle, dusty rose at the bottom, with a low dark purple hill along the bottom edge. Keep it minimal and cozy with matte surfaces. Important: the picture contains no text, no letters, no numbers, no symbols written on the lantern, no tassels, no mascot and no extra objects.
```

### 2(c) Ideogram (무료 등급)

설정: Aspect 1:1. **Magic Prompt는 Off**(켜면 "Lanternly" 같은 글자를 스스로 넣는다). Style은 Design 또는 Illustration. 컬러 팔레트 지정 기능이 있으면 Custom으로 `#141A33, #2B2350, #C97B84, #FFC864, #F2C46D, #232946`을 넣는다. Negative prompt 칸이 보이면 아래 부정 목록을 넣는다.
강점: 평면 그래픽과 구도 지시를 잘 따른다. 약점: 글자를 그리는 능력이 뛰어난 만큼 **글자가 새어 들어올 위험이 가장 크다.**
> 무료 등급에서 만든 이미지는 공개 피드에 올라간다(제3자 자료 기준, §2.5). 출시 전 아이콘 콘셉트가 공개돼도 괜찮을 때만 쓴다.

프롬프트:
```
Flat vector app icon, full-bleed square, centered symmetrical composition. A single round paper lantern glowing warm amber (#FFC864) with a cream-white core (#FFF4D6) sits on the center tile of a small 3x3 grid of rounded square tiles on a dark navy tray (#11142A). The lantern light spreads in a plus shape: the middle row and middle column tiles glow honey amber (#F2C46D), the four corner tiles stay dark navy (#232946). Soft circular glow around the lantern. Background: smooth vertical dusk gradient from deep indigo (#141A33) through violet (#2B2350) to dusty rose (#C97B84), low dark purple hill (#231F40) along the bottom. Minimal, calm, cozy, matte, soft gradients, wordless graphic.
```
Negative prompt:
```
text, letters, numbers, typography, logo, watermark, signature, characters on lantern, rounded corners, border, frame, drop shadow, white background, mockup, multiple lanterns, tassels, red, photorealistic, 3d, glossy, wood, mascot, face, clutter
```

### 2(d) Adobe Firefly (무료 일일 생성)

설정: 모델은 **Adobe Firefly Image 계열**을 고른다. Google, OpenAI 같은 파트너 모델은 상업 안전성을 사용자가 판단해야 한다. Aspect ratio는 Square (1:1), Content type은 Art. 스타일 효과는 쓰더라도 "Flat"이나 "Minimalist" 계열 하나만 고르고, Visual intensity는 낮게 둔다. "Exclude from image" 같은 제외 칸이 있으면 아래 목록을 넣는다. 없으면 프롬프트 끝 문장만으로 충분하다. 결과물의 **Beta 표시**를 확인한다.
강점: 상업 이용 정책이 가장 명시적이다. 평면 일러스트를 깔끔하게 낸다.

프롬프트:
```
Minimal flat vector app icon, full-bleed square, centered. A tiny courtyard of nine rounded square stone tiles arranged three by three on a dark navy tray. One round paper lantern on the center tile glows warm amber with a cream-white core; its light spreads in a plus shape so the middle row and middle column glow honey amber while the four corner tiles stay deep navy. Soft warm halo. Background is a smooth dusk gradient from deep indigo at the top through violet to dusty rose at the bottom, with a low dark purple hill silhouette along the bottom edge. Calm, cozy, elegant, matte, soft gradients. No text, no letters, no border, no rounded corners.
```
Exclude:
```
text, letters, numbers, watermark, border, frame, drop shadow, tassels, multiple lanterns, photorealistic, glossy plastic, wood, cartoon character
```

### 2.5 상업 이용 조건 (2026-10-14 확인 기준)

| 도구 | 출력물 상업 이용 | 확인한 근거 | 판단 |
|---|---|---|---|
| **FLUX.1 [schnell]** (로컬) | 가능. 모델 카드: Apache-2.0, "personal, scientific, and commercial purposes" 사용 가능. 금지 용도(괴롭힘, 비동의 성적 이미지, 허위정보 등)만 지키면 된다 | Hugging Face 모델 카드 | **가장 안전한 무료 경로.** 업체 약관과 클라우드가 끼지 않는다. FLUX.1 [dev]는 다른 비상업 라이선스이니 섞지 않는다 |
| SDXL base 1.0 (로컬) | 가능. CreativeML Open RAIL++-M의 사용 제한 조항 준수 조건 | 이번에 원문을 다시 확인하지는 못했다. 쓰기 전에 모델 카드를 확인할 것 | 안전한 편 |
| **Adobe Firefly** | Adobe FAQ: Beta가 아닌 기능의 출력물은 상업 이용 가능, Beta 기능도 따로 명시하지 않으면 가능. 파트너 모델 출력물은 "사용자가 적합성 판단". 무료 플랜은 "하루 제한된 생성" | Adobe Firefly FAQ, 플랜 FAQ | Firefly 자체 모델 + 비 Beta 기능일 때 안전. 2024년 커뮤니티 답변에 따르면 무료 플랜 결과물에 워터마크가 붙을 수 있고, 지우면 안 된다. 워터마크가 있으면 출시용으로 쓰지 않는다 |
| **Ideogram** | ToS 2.1: 출력물 소유권을 주장하지 않고, 권리를 사용자에게 양도하며, 상업 목적 사용을 제한하지 않는다. 다만 4.2에서 상업 사용 책임을 면책하고, 6.2(H)에서 워터마크 제거를 금지한다. 제3자 자료는 무료 등급 결과물이 공개되고 비공개 생성은 유료라고 한다. "상업 라이선스는 유료"라는 제3자 주장은 ToS 원문과 어긋난다 | ideogram.ai/legal/tos, 제3자 가격 안내 | 법적으로는 쓸 수 있으나 콘셉트가 공개되고 다른 사람이 리믹스할 수 있다. 차순위 |
| **Microsoft Designer / Bing Image Creator** | Image Creator 약관(2026년 3월 갱신)은 "합법적 사용"만 요구한다. 그러나 Copilot 개인용 약관(2026-08-18 발효)은 "own personal use"로 한정하고 콘텐츠 자격증명(출처 표시) 제거를 금지한다. Designer와 Copilot은 통합 중이라 어느 약관이 적용되는지 모호하다 | microsoft.com Copilot 약관, bing.com Image Creator 약관 | **출시물에는 쓰지 않는다.** 아이디어 탐색용 |

**저작권 주의.** 미국 저작권청은 사람의 창작 기여가 없는 순수 AI 생성물은 저작권 보호를 받기 어렵다는 입장이다(2025년 1월 보고서 Part 2: Copyrightability). 상업 이용이 허용되더라도 남이 같은 아이콘을 베꼈을 때 막기 어렵다. 이것이 출시본을 §5 벡터처럼 사람이 직접 그린 형태로 만드는 것을 권하는 이유다. AI 결과를 쓸 경우에도 사람이 실질적으로 다시 그리고 편집할수록 유리하다. 법률 자문은 아니다.

**권장 순서**: ① §5 절차적 벡터(출시본) → ② FLUX.1 schnell 로컬(페인터리 대안, 출시 가능) → ③ Firefly 자체 모델 → ④ Ideogram(공개됨) → ⑤ Microsoft(탐색만).

---

## 3. 변형 프롬프트

FLUX용 문장을 기준으로 쓰고, 다른 도구는 "배경 문장"만 바꿔 끼운다.

### 3.1 밝은 배경 버전 (라이트, 홍보·웹용 대안)

등불 빛이 묻히지 않도록 **받침판은 어둡게 유지**하고 하늘만 밝힌다.
```
A square mobile game app icon, flat vector illustration with soft gradients, centered and symmetrical. A tiny courtyard: a 3 by 3 grid of rounded square stone tiles on a deep plum-navy tray. A single round paper lantern rests on the center tile, glowing warm amber with a bright cream-white core and thin dark brown rings. Its light spreads in a plus shape: the middle row and middle column of tiles glow honey amber, the four corner tiles stay dark navy. Background fills the entire square: a pale early-evening sky gradient from soft moon cream at the top through peach to dusty rose at the bottom, with a low muted violet hill along the bottom edge. Calm, cozy, grown-up, minimal, matte, crisp shapes. Plain and wordless.
```
색 기준: 하늘 `#F4EBD0` → `#E8A08A` → `#C97B84`, 언덕 `#5B4470`, 받침판 `#2B2350`, 모서리 칸 `#3A2D58`.
다른 도구용 배경 문장: "background: pale evening gradient from cream (#F4EBD0) to peach (#E8A08A) to dusty rose (#C97B84)".

### 3.2 어두운 버전 (iOS Dark 슬롯용)
```
A square app icon artwork, flat vector illustration, centered. A single round paper lantern glowing warm amber with a cream-white core rests on the center tile of a 3 by 3 grid of rounded square tiles on a near-black navy tray. The middle row and middle column tiles glow honey amber in a plus shape; the four corner tiles are dark slate navy, slightly lighter than the tray so they stay visible. A wide soft halo of warm light. The background is a plain, very dark midnight navy, almost black, with no gradient, no sky details, no moon and no hill. Minimal, calm, matte, crisp shapes. Plain and wordless.
```
후처리: 배경 `#0F1124`를 지워 투명하게 만들어 Dark 슬롯에 넣거나, 그대로 불투명 `#0F1124`로 넣는다. 모서리 칸은 `#2B3254`.

### 3.3 틴트(모노크롬) 버전 (iOS Tinted, Android monochrome)
```
A square monochrome app icon artwork, pure grayscale, flat vector, centered. A solid white round paper lantern silhouette with a short handle sits on the center tile of a 3 by 3 grid of rounded square tiles. The middle row and middle column tiles are light gray forming a plus shape, the four corner tiles are dark gray, the tray is very dark gray. Pure black background. No gradients, no glow, no texture, no color. Bold simple shapes. Plain and wordless.
```
- iOS Tinted: 위 결과를 그레이스케일로 저장한다. 검정 배경은 투명으로 바꾸거나 그대로 둔다.
- Android monochrome: 등불과 십자만 **흰색 한 색**으로 남기고 나머지는 투명하게 한 실루엣을 만든다. 시스템이 테마 색으로 칠한다. 66dp 안전 영역 안에 둔다.
- 사실 이 버전은 AI보다 §5 SVG에서 색만 바꾸는 편이 빠르고 정확하다(§5.4).

---

## 4. 후처리 (모두 무료 도구)

도구: **Photopea**(무료 웹 편집기), **GIMP** 또는 **Krita**(무료 데스크톱), macOS 기본 **미리보기** 앱과 `sips` 명령.

### 4.1 1024×1024로 자르기
- Photopea: Crop 도구에서 Ratio를 1:1로 놓고 등불 심지가 가운데 오도록 자른 뒤, Image › Image Size를 1024×1024(Bicubic)로 맞춘다.
- macOS 터미널:
  ```sh
  sips -c 1024 1024 in.png --out cropped.png      # 가운데 기준으로 자르기(원본이 1024보다 클 때)
  sips -z 1024 1024 cropped.png --out icon-1024.png
  ```
- 원본이 1024보다 작으면 단순 확대는 흐려진다. 같은 도구에서 1024로 다시 생성하는 편이 낫다.

### 4.2 글자, 잡티, "아이콘 안의 아이콘" 지우기
1. 200%로 확대해 등불 표면, 타일, 하늘에 글자나 한자 같은 무늬, 서명, 워터마크가 있는지 본다. **워터마크나 콘텐츠 자격증명이 붙은 결과물은 지우지 말고 출시용 후보에서 뺀다**(Ideogram·Microsoft·Adobe 약관 모두 제거를 금지한다).
2. 작은 잡티: Photopea Spot Healing Brush(J) 또는 GIMP Heal(H)로 지운다.
3. AI가 둥근 사각형 테두리나 흰 바탕 그림자를 그렸다면: 등불과 격자를 선택해서(Photopea Select › Subject 또는 Magic Wand) 복사한 뒤, §5 SVG로 만든 깨끗한 배경 PNG 위에 붙인다. 가장 확실한 방법이다.
4. 격자 칸 수가 틀렸다면(4×4 등) 같은 방식으로 **AI 등불만 가져와 §5 벡터 격자 위에 합성**한다.

### 4.3 투명도 없애기 (iOS 기본 아이콘은 불투명이어야 한다)
- 확인: `sips -g hasAlpha icon-1024.png` → `hasAlpha: no`여야 한다.
- 미리보기 앱: 파일 › 내보내기 › 포맷 PNG에서 **Alpha 체크 해제**.
- 색공간: sRGB로 맞춘다. `sips -m "/System/Library/ColorSync/Profiles/sRGB Profile.icc" icon-1024.png --out icon-1024.png`
- Dark/Tinted 슬롯용 파일은 투명해도 된다. 기본(Any)과 App Store 마케팅 아이콘만 불투명이다.

### 4.4 모든 크기 내보내기
- **iOS(Xcode 14+)**: `Assets.xcassets/AppIcon`을 **Single Size**로 두고 1024 PNG 한 장만 넣으면 빌드할 때 필요한 크기가 모두 생성된다. Xcode 16+에서는 같은 칸에 Any/Dark/Tinted를 넣는다. Xcode 26+에서는 Icon Composer `.icon` 파일을 프로젝트에 끌어다 넣는 방식도 된다.
- **Capacitor 공식 생성기(무료)**: 이 프로젝트는 Capacitor 8이다. `@capacitor/assets`를 쓰면 iOS와 Android 아이콘을 한 번에 만든다. 다만 개발 의존성을 추가하는 일이므로 개발자가 결정한다.
  ```
  assets/icon-only.png        1024×1024, 불투명 (iOS·레거시)
  assets/icon-foreground.png  1024×1024, 투명 배경, 0.82배 축소된 받침판+등불 (Android foreground)
  assets/icon-background.png  1024×1024, 하늘+언덕 (Android background)
  npx @capacitor/assets generate --ios --android
  ```
- **Android monochrome**: Android Studio › New › Image Asset(Launcher Icons, Adaptive and Legacy)의 Monochrome 탭에 §3.3 실루엣을 넣는다. 또는 `ic_launcher.xml`에 `<monochrome>` 레이어를 추가한다.
- **Google Play 등록용**: 512×512 32-bit PNG, 1MB 이하. 1024 원본을 `sips -z 512 512`로 줄인다.

### 4.5 작은 크기 점검
```sh
for s in 180 120 87 80 60 58 40 29; do sips -z $s $s icon-1024.png --out check-$s.png; done
```
- **100% 배율로** 본다(확대하지 않는다). 60과 29에서 "밝은 등불 + 밝은 십자 + 어두운 귀퉁이 네 개"가 읽혀야 한다.
- 흑백 테스트: 미리보기 › 도구 › 색상 조절에서 채도를 0으로. 등불이 가장 밝아야 한다.
- 흐림·찡그림 테스트: 2–3m 떨어져 보거나 눈을 가늘게 뜨고 봐도 등불 위치가 바로 보여야 한다.
- 경쟁작 비교: App Store에서 "block puzzle", "logic puzzle"을 검색해 결과 화면을 캡처하고, 그 위에 check-120.png를 놓고 본다. 우리 아이콘만 저채도 보라에 따뜻한 빛 하나여야 한다.
- 실기기·시뮬레이터: 설치한 뒤 홈 화면 길게 누르기 › 편집 › 사용자화에서 어둡게와 색조를 바꿔 가며 다크/틴트 변형을 확인한다.

### 4.6 점검표
- [ ] 글자, 숫자, 한자 같은 무늬 없음
- [ ] 1024×1024, sRGB, 기본 아이콘은 alpha 없음
- [ ] 둥근 모서리나 테두리를 그려 넣지 않음
- [ ] 등불 + 십자가 중심 반지름 313px 안
- [ ] 29px에서 등불과 십자가 읽힘, 흑백에서 명도 순서 유지
- [ ] 빨간 등불, 술, 금색 장식 없음(설날 앱처럼 보이지 않음)
- [ ] Dark, Tinted, Android monochrome 파일 준비
- [ ] 생성 도구, 날짜, 시드, 약관 스크린샷 보관(상업 이용 근거)

---

## 5. 절차적 폴백: 추천 아이콘 A의 기하 명세 (비용 0원)

1024×1024 캔버스, 원점은 왼쪽 위, 단위는 px. 아래 SVG를 그대로 저장하면 렌더된다. 이 문서 작성 중 macOS QuickLook(`qlmanage -t -s 1024 -o . icon.svg`)으로 렌더해서 1024, 60, 29px 모두 확인했다. Canvas2D나 Phaser Graphics로 옮길 때는 `createLinearGradient`/`createRadialGradient`와 `roundRect`에 같은 숫자를 넣으면 된다.

### 5.1 레이어와 좌표 요약

| # | 레이어 | 도형 | 좌표·크기 | 채움 |
|---|---|---|---|---|
| L0a | 하늘 | rect | 0,0 – 1024×1024 | 세로 선형 그라디언트: 0 `#141A33`, .45 `#2B2350`, .78 `#5B4470`, 1 `#C97B84` |
| L0b | 지평선 광 | rect | 전체 | 원형 그라디언트 c(512,1024) r560: `#E8A08A` α.35 → α0 |
| L0c | 언덕 | path | `M0 920 C240 880,400 872,512 886 C660 902,820 876,1024 908 L1024 1024 L0 1024Z` | `#231F40` |
| L0d | 달(선택, iOS만) | circle에서 circle을 뺌 | 원 c(800,196) r64에서 원 c(776,180) r58을 마스크로 제거 | `#F4EBD0` |
| L1 | 받침판 | roundRect | x226 y262 w572 h572 r64, 선 10 | 채움 `#11142A`, 선 `#2E3354` |
| L1 | 모서리 칸 ×4 | roundRect 160×160 r28 | (258,294) (606,294) (258,642) (606,642) | `#232946` |
| L2 | 켜진 십자 ×5 | roundRect 160×160 r28 | (432,294) (258,468) (432,468) (606,468) (432,642) | 다섯 칸이 함께 쓰는 원형 그라디언트 c(512,520) r330: 0 `#FFF4D6`, .35 `#FFC864`, .75 `#F2C46D`, 1 `#B9814A` |
| L3 | 후광(glow) | circle | c(512,520) **r320** | 원형: 0 `#FFC864` α.55, .45 α.18, 1 α0 |
| L4 | 접지 그림자 | ellipse | c(512,662) rx100 ry14 | `#11142A` α.30 |
| L4 | 고리 | arc | `M476 392 A36 36 0 0 1 548 392`, 선 18, 둥근 끝 | 선 `#4A3328` |
| L4 | 위 링 | roundRect | x452 y386 w120 h30 r12 (+ 위 하이라이트 h8 `#6E4C38`) | `#4A3328` |
| L4 | 등불 몸통 | ellipse | c(512,520) rx138 ry114 | 원형 그라디언트 c(512,515) 초점(512,505) r160: 0 `#FFF4D6`, .30 `#FFC864`, .72 `#F08A5D`, 1 `#B9814A` |
| L4 | 살 | ellipse 외곽선 ×2, 몸통으로 클립 | c(512,520) rx46/ry114, rx92/ry114, 선 10 | `#B9814A` α.55 |
| L4 | 아래 링 | roundRect | x466 y622 w92 h26 r10 | `#4A3328` |
| L4 | 꼭지 | roundRect | x504 y648 w16 h32 r6 | `#4A3328` |

검산: 격자 = 받침판 안쪽 여백 32 + 칸 160×3 + 간격 14×2 = 572. 격자 중심 (512,548). 핵심 피사체(십자 + 등불)의 중심(512,512)에서 최대 거리 ≈ 301px로 313px 안이다. 받침판 모서리 최대 ≈ 404px이고, Android에서는 0.82배 하면 331px이다.

### 5.2 SVG 원본 (기본 아이콘)
```svg
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#141A33"/>
      <stop offset="0.45" stop-color="#2B2350"/>
      <stop offset="0.78" stop-color="#5B4470"/>
      <stop offset="1" stop-color="#C97B84"/>
    </linearGradient>
    <radialGradient id="horizon" cx="512" cy="1024" r="560" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#E8A08A" stop-opacity="0.35"/>
      <stop offset="1" stop-color="#E8A08A" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="lit" cx="512" cy="520" r="330" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#FFF4D6"/>
      <stop offset="0.35" stop-color="#FFC864"/>
      <stop offset="0.75" stop-color="#F2C46D"/>
      <stop offset="1" stop-color="#B9814A"/>
    </radialGradient>
    <radialGradient id="halo" cx="512" cy="520" r="320" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#FFC864" stop-opacity="0.55"/>
      <stop offset="0.45" stop-color="#FFC864" stop-opacity="0.18"/>
      <stop offset="1" stop-color="#FFC864" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="body" cx="512" cy="515" r="160" fx="512" fy="505" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#FFF4D6"/>
      <stop offset="0.30" stop-color="#FFC864"/>
      <stop offset="0.72" stop-color="#F08A5D"/>
      <stop offset="1" stop-color="#B9814A"/>
    </radialGradient>
    <mask id="moonCut"><rect width="1024" height="1024" fill="#fff"/><circle cx="776" cy="180" r="58" fill="#000"/></mask>
    <clipPath id="bodyClip"><ellipse cx="512" cy="520" rx="138" ry="114"/></clipPath>
  </defs>

  <!-- L0 background (Android: background layer, without the moon) -->
  <g id="background">
    <rect width="1024" height="1024" fill="url(#sky)"/>
    <rect width="1024" height="1024" fill="url(#horizon)"/>
    <path d="M0 920 C 240 880, 400 872, 512 886 C 660 902, 820 876, 1024 908 L1024 1024 L0 1024 Z" fill="#231F40"/>
  </g>
  <g id="moon"><!-- optional, iOS only -->
    <circle cx="800" cy="196" r="64" fill="#F4EBD0" mask="url(#moonCut)"/>
  </g>

  <!-- L1–L4 foreground (Android: scale 0.82 about 512,512) -->
  <g id="courtyard">
    <rect x="226" y="262" width="572" height="572" rx="64" fill="#11142A" stroke="#2E3354" stroke-width="10"/>
    <g fill="#232946">
      <rect x="258" y="294" width="160" height="160" rx="28"/>
      <rect x="606" y="294" width="160" height="160" rx="28"/>
      <rect x="258" y="642" width="160" height="160" rx="28"/>
      <rect x="606" y="642" width="160" height="160" rx="28"/>
    </g>
    <g fill="url(#lit)">
      <rect x="432" y="294" width="160" height="160" rx="28"/>
      <rect x="258" y="468" width="160" height="160" rx="28"/>
      <rect x="432" y="468" width="160" height="160" rx="28"/>
      <rect x="606" y="468" width="160" height="160" rx="28"/>
      <rect x="432" y="642" width="160" height="160" rx="28"/>
    </g>
  </g>
  <g id="lantern">
    <circle cx="512" cy="520" r="320" fill="url(#halo)"/>
    <ellipse cx="512" cy="662" rx="100" ry="14" fill="#11142A" opacity="0.30"/>
    <path d="M476 392 A36 36 0 0 1 548 392" fill="none" stroke="#4A3328" stroke-width="18" stroke-linecap="round"/>
    <rect x="452" y="386" width="120" height="30" rx="12" fill="#4A3328"/>
    <rect x="452" y="386" width="120" height="8" rx="4" fill="#6E4C38"/>
    <ellipse cx="512" cy="520" rx="138" ry="114" fill="url(#body)"/>
    <g clip-path="url(#bodyClip)" fill="none" stroke="#B9814A" stroke-opacity="0.55" stroke-width="10">
      <ellipse cx="512" cy="520" rx="46" ry="114"/>
      <ellipse cx="512" cy="520" rx="92" ry="114"/>
    </g>
    <rect x="466" y="622" width="92" height="26" rx="10" fill="#4A3328"/>
    <rect x="504" y="648" width="16" height="32" rx="6" fill="#4A3328"/>
  </g>
</svg>
```

### 5.3 변형을 만드는 법 (같은 SVG에서 값만 교체)

| 변형 | 바꿀 것 |
|---|---|
| **Dark (iOS)** | `#background`와 `#moon`을 지워 투명 배경으로 만든다(또는 `#0F1124` 단색 rect 하나). 모서리 칸 `#232946`→`#2B3254`, 후광 r 320→360 |
| **Light** | sky 정지점을 `#F4EBD0` / .55 `#E8A08A` / 1 `#C97B84`로, 언덕을 `#5B4470`으로, 받침판을 `#2B2350`으로, 모서리 칸을 `#3A2D58`로 바꾼다. 달은 지운다(밝은 하늘에서는 보이지 않는다) |
| **Android foreground** | `#courtyard`와 `#lantern`을 `<g transform="translate(512 512) scale(0.82) translate(-512 -512)">`로 감싸고, 배경은 투명하게 둔다 |
| **Android background** | `#background`만 남긴다 |

### 5.4 Tinted / monochrome
- **iOS Tinted(그레이스케일)**: 배경 투명. 받침판 `#1F1F1F`, 모서리 칸 `#3A3A3A`, 십자 다섯 칸 `#B3B3B3` 단색, 등불 몸통 `#FFFFFF` 단색, 링·고리·꼭지 `#808080`. 살·후광·접지 그림자는 지운다.
- **Android monochrome**: 등불 몸통 + 위아래 링 + 고리, 그리고 십자 다섯 칸만 `#FFFFFF`로 남기고 나머지는 지운다. 등불과 십자 사이에 12px 간격(투명 테두리 `stroke="#000" stroke-width="24"`를 마스크로 사용)을 두면 실루엣이 붙지 않는다. 그다음 0.82배로 축소한다.

### 5.5 PNG로 렌더 (무료)
```sh
qlmanage -t -s 1024 -o ./out icon.svg      # macOS 기본 기능. 결과: ./out/icon.svg.png
sips -g hasAlpha ./out/icon.svg.png        # alpha가 있으면 §4.3대로 미리보기에서 Alpha 해제 후 내보내기
```
또는 Chrome에서 SVG를 열어 1024 창으로 캡처하거나, 클라이언트의 Canvas2D로 같은 숫자를 그려 `toDataURL('image/png')`로 저장한다.

---

## 출처 (2026-10-14 열람)

- FLUX.1 [schnell] 모델 카드(Apache-2.0, 1–4 steps, guidance 0): https://huggingface.co/black-forest-labs/FLUX.1-schnell
- Ideogram 이용약관(2.1 소유권·상업 이용, 4.2 면책, 6.2(H) 워터마크): https://ideogram.ai/legal/tos
- Ideogram 무료 등급 공개 여부(제3자 자료, 공식 가격 페이지는 403으로 확인하지 못함): https://eesel.ai/blog/ideogram-pricing , https://costbench.com/software/ai-image-generators/ideogram
- Adobe Firefly 플랜 FAQ(무료 일일 생성, 파트너 모델 책임): https://www.adobe.com/cc-shared/fragments/products/firefly/plans/faq
- Adobe Firefly FAQ(비 Beta 기능 상업 이용): https://helpx.adobe.com/firefly/get-set-up/learn-the-basics/adobe-firefly-faq.html
- Adobe 커뮤니티(무료 플랜 워터마크, 2024): https://community.adobe.com/t5/adobe-firefly-discussions/adobe-firefly-commercial-use/m-p/14274724
- Microsoft Copilot 개인용 약관(2026-08-18 발효, "own personal use"): https://www.microsoft.com/microsoft-copilot/for-individuals/termsofuse
- Bing Image Creator 약관(2026년 3월 갱신): https://www.bing.com/new/termsofuseimagecreator
- Microsoft Q&A, 상업 이용 혼선 정리: https://learn.microsoft.com/en-us/answers/questions/2346822/commercial-use-of-images-generated-using-copilot-b
- Android 적응형 아이콘(108/72/66dp, monochrome, Android 13+): https://developer.android.com/develop/ui/views/launch/icon_design_adaptive
- Apple HIG App icons(본문을 불러오지 못해 일반 지식으로 보충함. 최신 내용은 원문 확인): https://developer.apple.com/design/human-interface-guidelines/app-icons
- Icon Composer 정리(WWDC25 "Create icons with Icon Composer"): https://wwdcnotes.com/documentation/wwdc25-361-create-icons-with-icon-composer/ , https://www.createwithswift.com/crafting-liquid-glass-app-icons-with-icon-composer/
- 미국 저작권청 AI 보고서 Part 2(2025-01): https://www.copyright.gov/ai/

확인하지 못한 항목: SDXL 라이선스 원문, Draw Things의 FLUX 기본 샘플러 이름, Ideogram과 Firefly 무료 등급의 현재 정확한 생성 한도, Apple HIG의 최신 문구. 출시 전에 각 원문을 다시 열어 날짜와 함께 캡처해 둘 것.
