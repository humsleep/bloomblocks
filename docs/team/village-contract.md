# 마을 그림 계약 (Frontend ↔ UI Designer, 2026-10-17)

시스템·장면 담당(Frontend)과 그림 키트 담당(UI Designer)이 서로 막히지 않게 하는 작은 약속이다.
범위는 오너가 정한 **1.0 4주 축소판**(DECISIONS.md 마지막 절): 주민 5명, 가구 12종 × 색 2–3, 방 1개 18칸, 선물·편지.

## 1. 누가 어디를 갖나

| 경로 | 주인 | 내용 |
|---|---|---|
| `apps/client/src/render/village/**` | **디자이너** | 키트(tokens·shade·nature·house·items·ui). 이 계약의 `villageArt`를 `index.ts`에서 내보낸다 |
| `apps/client/src/village/**` | Frontend | 데이터, 규칙, 동기화, 장면 흐름, 글자 배치, VoiceOver |
| `apps/client/src/village/art.ts` | Frontend | 인터페이스 정의 + 로더. 디자이너는 **읽기만** 한다 |
| `apps/client/src/village/placeholderArt.ts` | Frontend | 디자이너 모듈이 없거나 함수가 빠졌을 때 쓰는 회색 자리 표시 그림 |

- 로더는 `import.meta.glob("../render/village/index.ts")`를 쓴다. 파일이 없으면 자리 표시 그림으로 돌고, 생기면 **코드 수정 없이** 다음 빌드부터 진짜 그림이 들어온다.
- `index.ts`가 함수 일부만 내보내도 된다. 빠진 함수만 자리 표시로 채운다.
- 키트는 **마을 청크 안에서만** import한다. `src/game/**`, `src/render/*.ts`(퍼즐 화면)에서 import하면 콜드 스타트 게이트(G5)가 깨진다.

## 2. 인터페이스 (`src/village/art.ts`가 정본)

```ts
export interface PaintBox { x: number; y: number; w: number; h: number } // 캔버스 px
// 그리는 기준: 물건·주민·집의 "바닥 가운데"가 (x + w/2, y + h)에 오고, 상자 안에 들어가게 축소한다.
// 상자를 넘는 그림(빛 번짐 포함)은 잘린다 — 굽기 캔버스가 상자 크기 + 여백 PAD(0.12 × 짧은 변)이기 때문.

export type ResidentId = "wick" | "momo" | "sage" | "luna" | "pip";   // 1.1: "kuri" | "yuki"
export type Expression = "idle" | "happy" | "shy" | "sleepy" | "talk" | "silhouette";
export type Colorway = "cream" | "sage" | "rose";
export type ItemId = "paperLantern" | "archChair" | "cushion" | "teaTable" | "smallBed" | "smallPot"
                   | "flowerVase" | "bookshelf" | "roundRug" | "wallClock" | "frame" | "teapot";

export interface HouseSpec {
  resident: ResidentId | "cottage" | null; // null = 아직 빈 집(어두움), "cottage" = 내 방 오두막
  lit: boolean;            // 불 켜짐(입주함)
  eve: boolean;            // 내일 이사 올 주민의 실루엣이 창에 보임
  seed: number;            // 집마다 고정 변주(지붕 비늘, 화분 위치)
}

export interface VillageArt {
  drawLanternHouse(g: CanvasRenderingContext2D, spec: HouseSpec, at: PaintBox): void;
  drawResident(g: CanvasRenderingContext2D, id: ResidentId, expr: Expression, at: PaintBox): void;
  drawFurniture(g: CanvasRenderingContext2D, itemId: ItemId, colorway: Colorway, at: PaintBox, opts?: { locked?: boolean }): void;
  /** 마을 전경 배경(하늘·언덕·땅·길). 1.0은 황혼 하나 */
  drawVillageBackdrop?(g: CanvasRenderingContext2D, at: PaintBox): void;
  /** 방 단면(뒷벽·옆벽·바닥·창·줄등). wallpaper / floor = 0..2 */
  drawRoom?(g: CanvasRenderingContext2D, at: PaintBox, spec: { wallpaper: number; floor: number }): void;
  /** 우편함(깃발 = 안 읽은 편지 있음) */
  drawMailbox?(g: CanvasRenderingContext2D, at: PaintBox, flag: boolean): void;
  /** G8 검사용: 키트가 실제로 그릴 수 있는 가구 id 목록 */
  readonly furnitureIds?: readonly ItemId[];
  /** (선택) 배경의 길에 맞춘 집 자리(상자의 바닥 가운데 = 문 앞 땅)와 우편함 자리 */
  villageLayout?(at: PaintBox): { houses: Record<ResidentId | "cottage", PaintBox>; mailbox: PaintBox };
  /** (선택) 방 껍데기에 맞춘 18칸 상자(0–14 바닥, 뒷줄부터; 15–17 벽)와 러그 상자 */
  roomGeometry?(at: PaintBox): { slots: PaintBox[]; rug: PaintBox };
}
export const villageArt: Partial<VillageArt>;   // render/village/index.ts가 내보내는 이름
// villageLayout / roomGeometry는 index.ts의 같은 이름 export로도 받는다(로더가 합친다).
```

### 규칙
1. **순수 그리기.** 함수는 `g`에만 그린다. 전역 상태, `Math.random`, 시간, DOM, Phaser를 쓰지 않는다(같은 입력 = 같은 픽셀. 아틀라스 캐시가 이를 믿는다). 변주는 `seed`로.
2. `g`의 변환 행렬은 호출자가 이미 배율(@2x 이하 굽기)을 넣어 둔 상태다. 함수 안에서 `save()/restore()`로 감싼다.
3. **잠긴 카드(G8)**: `opts.locked = true`이면 **그 물건의 실제 그림**을 회색 실루엣으로 그린다(다른 물건 실루엣 재사용 금지).
4. **색 변형**: 물건마다 쓸 수 있는 색은 `src/village/catalog.ts`의 `colorways`가 정한다. 그 밖의 색으로 불리면 첫 색으로 그린다.
5. **크기**: 카탈로그 카드(약 64 pt), 방 뒷줄(1.5×)·앞줄(1.7×) 세 크기로 굽는다. 칸 크기 약 50 pt에서 실루엣이 읽혀야 한다(Reality §1.2 문법).
6. `smallBed`는 바닥 2칸을 차지한다(가로 2칸 상자로 불린다). `roundRug`는 바닥 아래 층, `wallClock`·`frame`은 벽 칸.
7. 표정 `"silhouette"`은 이사 전날 창가 실루엣(자두색 단색 + 등불 빛 한 점).
8. 글자는 그리지 않는다. 이름표·대사·버튼 글은 Frontend가 로캘별 줄바꿈(`src/village/wrap.ts`)으로 그린다.

## 3. 가구 12종 (이름은 `catalog.ts`가 정본, 그림과 이름이 맞아야 한다 — G8)

| # | id | en | ko | 계열 | 층 | 색 | 얻는 곳 |
|---|---|---|---|---|---|---|---|
| 0 | paperLantern | Paper lantern | 종이 등불 | lighting | 바닥 | cream·sage·rose | Wick 이사 선물(cream) |
| 1 | archChair | Arched chair | 아치 의자 | seating | 바닥 | cream·sage·rose | 선물 병 |
| 2 | cushion | Floor cushion | 꽃잎 방석 | seating | 바닥 | rose·cream | Momo 이사 선물(rose) |
| 3 | teaTable | Tea table | 찻상 | table | 바닥 | cream·sage·rose | 선물 병 |
| 4 | smallBed | Little bed | 작은 침대 | bed | 바닥 2칸 | cream·sage·rose | 선물 병 |
| 5 | smallPot | Little pot | 작은 화분 | plant | 바닥 | sage·cream·rose | Sage 이사 선물(sage) |
| 6 | flowerVase | Flower vase | 꽃병 | plant | 바닥 | rose·cream | 선물 병 |
| 7 | bookshelf | Bookshelf | 책장 | storage | 바닥 | cream·sage·rose | 선물 병 |
| 8 | roundRug | Round rug | 둥근 러그 | rug | 러그 층 | sage·rose | Pip 이사 선물(sage) |
| 9 | wallClock | Wall clock | 벽시계 | wall | 벽 | cream·sage | Luna 이사 선물(cream) |
| 10 | frame | Picture frame | 액자 | wall | 벽 | cream·rose | 선물 병 |
| 11 | teapot | Teapot | 찻주전자 | small | 바닥 | rose·sage | 선물 병 |

- 시범 6종(PASS) = 0, 1(이름을 "Arched chair"로 바꿈 — Reality v2 조건), 3, 4, 5, 7. 새로 그릴 것 = 2, 6, 8, 9, 10, 11.
- 번호(#)는 동기화 비트 번호(`#×4 + 색`)라 **바꾸지 않는다.** 물건을 빼려면 번호를 비워 둔다.
- 이름을 바꾸고 싶으면 Frontend에 말한다(카탈로그·대사 린트·VoiceOver가 같이 바뀐다).

## 4. 성능 약속
- 굽기는 마을을 열 때 한 번, ≤ 2×. 카드·방 아이콘은 Frontend가 아틀라스 캐시에 넣고, 마을을 닫으면 텍스처를 지운다.
- 움직이는 장식은 키트가 아니라 장면이 만든다(주민 숨쉬기·등불 깜박임은 `ambient()`로 감싼 이미지 변환). 키트 함수는 정지 그림만 그린다.

## 5. 장면 쪽 약속 (Frontend, 2026-10-17 구현 반영)
- 장면은 키트의 `villageLayout` / `roomGeometry`가 있으면 그 자리를 그대로 쓴다(주민은 집 상자 오른쪽 문 옆, 크기 = 집 폭 × 0.4, 40–72 pt).
- **대사 카드는 마을 화면에서 위쪽(HUD 줄 아래, 하늘 위)** 에 뜬다. 키트 배치에서 오두막·Pip 집·우편함이 화면 아래에 있어서, 아래쪽 카드가 그것들을 가렸기 때문이다. 하늘 영역(뒷줄 집 지붕 위)에 큰 그림 요소를 두지 않으면 좋다. 방 화면에서는 카드가 아래쪽이다.
- 방의 바닥 칸 상자는 키 큰 물건을 위해 위로 길고 뒷줄과 겹치므로, 탭 영역은 칸 상자의 **아래 절반**이다.
- 서랍 카드는 `fit: "card"`, 방·선물 공개는 각각 `"room"` / `"card"`로 부른다.
- 배경+집 층은 래스터된 사본을 열기 사이에 1장 보관하고, 실행 6 초 뒤 유휴 시간에 미리 굽는다(G5). 같은 입력 = 같은 픽셀 규칙(§2-1)이 이 캐시의 전제다.

## 6. Reality G1 반영 (Frontend, 2026-10-17 저녁)
- **첫날 오두막은 가구가 있다**(G1 #14). 처음 편집 전의 방 = `model.ts starterRoom()`: 뒷줄 왼쪽(칸 1) Wick의 종이 등불 cream, 뒷줄 오른쪽(칸 3) 작은 화분 cream, 가운데(칸 7) 찻상 cream, 러그 층 둥근 러그 rose. 앞줄은 첫 선물 자리로 비워 둔다. 이 네 점은 늘 가진 것으로 친다(`catalog.ts STARTER`). 병 선물 순서에서는 빠진다. Wick은 이사 편지를 보내지 않는다(등불이 이미 방에 있다).
  - 키트 요청: 이 배치가 한 장의 그림으로 읽히는지 확인한다. 등불 칸 1이 방의 광원(G1 #15)이니 `drawRoom`에서 그 위치에 빛 웅덩이를 두면 좋다.
- 빈 칸 점선은 지금도 모든 빈 칸에 그린다. "편집 중에만 보이기"(G1 #14)는 디자이너와 정할 일로 남긴다.
- 대사 카드: 왼쪽에 말하는 주민 초상(원, 주민 색 테두리), 말하는 주민 쪽 꼬리가 달린다. 위치는 주민 머리 위(HUD 아래로 자리가 없으면 발아래)다. 카드가 그 주민을 가리지 않는다.
- 서랍: 높이 ≤ 55 %, 카드 격자는 그 안에서 스크롤된다. 방은 위로 밀려 고른 칸이 서랍 위에 보인다. 가진 카드가 먼저 온다. 잠긴 카드는 색 점 대신 자물쇠 + "모모에게서 / 등불 병을 채우면"을 **그린다**(G8). 지금 그 칸에 있는 물건 카드는 앰버 테두리다. 제목은 "여기에 놓을 가구"(10개 로캘)다.

## 6. v15 추가 (디자이너, G1 폴리시)
- 키트 `villageArt`에 선택 함수 추가(`art.ts`에 선택 필드로 선언): `drawGiftStage(at, {item, cw, sender}) → {chip, item}`,
  `drawLetterStage(at, {n, fontPx, who, accent}) → {paper, lines, sign}`, `drawLetterSender(paper, who, size)`,
  `drawRoomGuests(roomBox)`, `drawCottageOutside(screen, roomBox)`. 글자는 여전히 장면이 그린다.
- `VillageScene`에서 디자이너가 바꾼 곳(좁게): `renderGift` 레이아웃·이름 칩, `renderLetter` 서명 분리·스테이지·자간,
  `roomBox`(94 %, 남는 높이는 하늘 쪽), 빈 칸 표시(배치 중에만, 옅은 빛 점), 방 밖 배경·방문 주민 호출.
- `textLayout.ts`: 한국어 편지 `letterScale` 1.03, `letterTracking` −0.04em (Gaegu Regular로 재서브셋).
- `e2e/village-shots.spec.ts`: `SHOTS_DIR` 환경 변수(기본 village-v1).

## 8. 라운드 3 키트 구현 (디자이너, 2026-10-17 밤) — `art.ts` §7 시그니처 그대로
- `setEnvironment({time, season})`: 다음 굽기부터 적용. `drawVillageBackdrop(at, {time?, season?})`, `drawRoom(at, {…, time?, season?})`,
  `drawLanternHouse(spec)`(겨울 = 뚜껑 눈)는 명시값이 없으면 이 환경을 쓴다.
- `drawTimeWash(at, time?)`: 시간대 색(새벽 장밋빛·낮 밝힘·밤 파랑)을 **집 층 위에** 한 번 더 칠한다(배경은 이미 포함).
- `drawMarketStall(at, open)` → `{slots[3], sign}`: 받침 3개 상자에 그날의 가구를 `fit:"card"`로 그린다. 간판 글은 장면.
- `drawRequestBubble(cx, by, r, cat)`: 꼬리가 (cx, by)에 닿는다 — `residentHead()` 값을 넘긴다. 아이콘 = 계열 9종(catalog `Category`).
- `drawPostcardFrame(at)` → `{picture, stamp, caption}`: 1080×1350은 `scale(3)` 후 360×450 pt로 부르면 선 굵기 규칙이 맞는다.
  `picture`에 `drawCottageOutside` + `drawRoom` + 가구 + `drawRoomGuests`를 그린다(레벨·날짜 없음 = 스포일러 없음).
- 주민 7명(`kuri` 목도리, `yuki` 눈송이 불꽃), 집 8채(`villageLayout` 뒷줄 4채: sage·kuri·luna·yuki), 가구 24종은 `catalog.ts` 순서.
- 편지 글꼴 서브셋은 대사 파일의 **보이는 글**(text·cp·lines[].x)만 쓴다(번역 메모 제외). 대사가 바뀌면 `scripts/subset-letter-fonts.py`를
  다시 돌린다 — `tests/village-art.test.ts`가 빠진 글자를 잡는다.

## 7. 전체판(라운드 3) — 키트에 필요한 그림 (Frontend, 2026-10-17 밤)
장면은 아래 함수가 없으면 자리 표시 그림(`placeholderArt.ts`)을 쓴다. 키트 함수가 예외를 던지면 그 호출만 자리 표시로 대체한다(`art.ts guarded`). 그래서 그리는 중에도 장면은 깨지지 않는다.
- **가구 12종 추가(번호 12–23, `catalog.ts`가 정본)**:

  | 번호 | id | 이름 | 놓는 곳 | 색 |
  |---|---|---|---|---|
  | 12 | floorLamp | 스탠드 등 | 바닥 | cream·sage |
  | 13 | candles | 촛대 | 바닥 | cream·rose |
  | 14 | stringLights | 줄등 | **벽** | cream·rose |
  | 15 | rockingChair | 흔들의자 | 바닥 | 3색 |
  | 16 | roundTable | 둥근 탁자 | 바닥 | cream·sage |
  | 17 | cactus | 선인장 | 바닥 | sage·rose |
  | 18 | hangingPlant | 매달린 화분 | **벽** | sage·cream |
  | 19 | dresser | 서랍장 | 바닥 | 3색 |
  | 20 | stripedRug | 줄무늬 러그 | 러그 층 | sage·rose |
  | 21 | wreath | 화환 | **벽** | sage·rose |
  | 22 | knitBasket | 뜨개 바구니 | 바닥 | rose·cream, Kuri 이사 선물 rose |
  | 23 | snowGlobe | 스노볼 | 바닥 | cream·sage, Yuki 이사 선물 cream |

  - `furnitureIds`에 넣는 순간 장면이 키트 그림을 쓴다. 넣기 전에는 자리 표시로 그린다.
- **주민 Kuri(누적 10일)·Yuki(14일)**: `drawResident`, `drawLanternHouse`(테마), `villageLayout().houses.kuri / .yuki` 자리. 자리가 없으면 장면이 임시 자리를 쓴다.
- **시간·계절** `setEnvironment({ time: "dawn"|"day"|"dusk"|"night", season: "spring"|…|"winter" })`: 장면이 굽기 직전에 부른다. 대상은 마을 배경·집·방, 그리고 엽서 그림이다. 배경 캐시 키에 시간·계절이 들어 있어서, 바뀌면 다시 굽는다. 키트는 이 값으로 하늘·창빛·지붕 눈·나무색을 바꾼다.
- **장터** `drawMarketStall(g, at, open)`: 노점 하나, open = 등불이 켜짐. 자리는 `villageLayout().market`(PaintBox)이고, 없으면 우편함 오른쪽이다.
- **부탁 말풍선** `drawRequestBubble(g, cx, by, r, cat)`: 주민 머리 오른쪽 위의 작은 종이 말풍선과 계열 아이콘 9종(lighting·seating·table·bed·plant·storage·rug·wall·small). 글자는 쓰지 않는다.
- **방 엽서 틀** `drawPostcardFrame(g, {0,0,1080,1350}) → { picture, stamp, caption }`: 장면이 picture 안에 방·가구·방문 주민을 그리고, caption 칸에 "더스크윅의 내 작은 오두막 · 날짜 · 링크"를 쓴다. 판·정답은 없다.
- **방문 주민**: 부탁을 들어준 주민(최근 2명)이 그 계열 가구 옆에 앉는다. 장면이 `drawResident(…, "happy", box)`로 그린다. v15의 `drawRoomGuests`(Wick·Momo 고정)는 더 이상 부르지 않는다. 키트가 앉은 자세를 따로 그리고 싶으면 `drawResident`에 표정 `"sit"`을 추가해 달라고 알려 주면 된다.
- 방 머리줄: 왼쪽 돌아가기, 오른쪽 러그 원판(디자이너) 그리고 그 왼쪽에 **엽서 원판 + 캡션 "엽서"**(Frontend)가 온다.
