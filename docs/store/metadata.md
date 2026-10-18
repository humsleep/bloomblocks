# Duskwick 스토어 텍스트 (이름·부제·키워드·프로모션 문구·설명)

생성: `python3 playtest/store/build-metadata.py` (원문은 그 스크립트). 한도·정책 검사를 통과한 값만 나온다.

- 한도: 이름 30, 부제 30, 키워드 100, 프로모션 문구 170, 설명 4000자(글자 수).
- 정책: Akari·Nikoli·Light Up·Queens(와 다른 앱 이름)·Android/Google Play 0회. 이름·부제·키워드에 가격 표현(무료/無料/免费/free 등) 0회. "광고 없음" 주장 0회(앱에는 광고가 있다). 설명 끝에 광고가 어디에 나오는지 적었다.
- en·ko 외 8개 언어는 AI 초안이다. 원문 검토 전에 제출하지 않는다(`docs/i18n-qa-report.md` 4절의 신뢰도 표).
- 설명의 주민 이름은 앱 안 표기와 같다(`RESIDENT_NAMES`: ja ウィック…, zh 小烛/小燭…).
- ru·vi는 미국 스토어 교차 색인용 키워드 필드만 채운다(나머지 칸은 en-US 텍스트).

## en-US

- 이름 (30/30): `Duskwick: Lantern Logic Puzzle`
- 부제 (29/30): `Calm & Cozy Daily Brain Games`
- 키워드 (98/100): `puzzles,relaxing,village,decorate,cute,friends,teaser,adults,offline,wifi,no,light,grid,zen,riddle`
- 프로모션 문구 (117/170): Seven lantern friends are waiting in the village. Solve today's puzzle, collect a postcard and decorate your cottage.

설명 (1460/4000):

```
Light every tile. Keep the little village glowing.

Duskwick is a calm lantern logic puzzle. Place lanterns on a small stone board until every tile is lit. Lanterns must not see each other, and each numbered stone tells you exactly how many lanterns stand beside it. Every puzzle has one answer, so you never need to guess.

A tiny friend lives in every lantern. Each puzzle you solve lights a house in your hillside village, and as you keep playing, seven lantern friends move in: Wick, Momo, Sage, Luna, Pip, Kuri and Yuki. They write you letters, ask for small favors and send gifts. Decorate your cottage with what they bring, choose one new piece at the market stall (nothing to buy), and watch the village change with the time of day and the seasons.

• A new puzzle every day, the same for everyone. Each one ends with a postcard to keep, and your streak covers a missed day now and then
• Gentle puzzles to begin with, deeper ones when you want to think
• Step-by-step hints whenever you are stuck
• Works offline. No account, no lives, no rush
• Easy on the eyes and hands: VoiceOver, large text, numbers shown as dots, lantern faces you can switch off
• Your progress follows you between your devices through your own iCloud
• Available in English, 한국어, 日本語, Deutsch, Français, Español, Português (Brasil), Italiano, 简体中文 and 繁體中文

Duskwick contains ads. They appear only between puzzles, never during a puzzle, in the daily puzzle or in the village.
```

## en-GB

메모: default language of about 20 storefronts (IE, DK, NO, FI, PL, TR, ...); use 'cosy' spelling in the description

- 이름 (30/30): `Duskwick: Lantern Logic Puzzle`
- 부제 (29/30): `Calm & Cosy Daily Brain Games`
- 키워드 (99/100): `puzzles,cozy,village,decorate,cute,friends,relaxing,teaser,adults,offline,wifi,no,light,grid,zen,iq`
- 프로모션 문구 (117/170): Seven lantern friends are waiting in the village. Solve today's puzzle, collect a postcard and decorate your cottage.

설명 (1460/4000):

```
Light every tile. Keep the little village glowing.

Duskwick is a calm lantern logic puzzle. Place lanterns on a small stone board until every tile is lit. Lanterns must not see each other, and each numbered stone tells you exactly how many lanterns stand beside it. Every puzzle has one answer, so you never need to guess.

A tiny friend lives in every lantern. Each puzzle you solve lights a house in your hillside village, and as you keep playing, seven lantern friends move in: Wick, Momo, Sage, Luna, Pip, Kuri and Yuki. They write you letters, ask for small favors and send gifts. Decorate your cottage with what they bring, choose one new piece at the market stall (nothing to buy), and watch the village change with the time of day and the seasons.

• A new puzzle every day, the same for everyone. Each one ends with a postcard to keep, and your streak covers a missed day now and then
• Gentle puzzles to begin with, deeper ones when you want to think
• Step-by-step hints whenever you are stuck
• Works offline. No account, no lives, no rush
• Easy on the eyes and hands: VoiceOver, large text, numbers shown as dots, lantern faces you can switch off
• Your progress follows you between your devices through your own iCloud
• Available in English, 한국어, 日本語, Deutsch, Français, Español, Português (Brasil), Italiano, 简体中文 and 繁體中文

Duskwick contains ads. They appear only between puzzles, never during a puzzle, in the daily puzzle or in the village.
```

## en-AU

메모: AU, NZ

- 이름 (30/30): `Duskwick: Lantern Logic Puzzle`
- 부제 (28/30): `Cosy Village & Daily Puzzles`
- 키워드 (92/100): `brain,games,calm,relax,decorate,cute,friends,teaser,adults,offline,wifi,no,light,grid,zen,iq`
- 프로모션 문구 (117/170): Seven lantern friends are waiting in the village. Solve today's puzzle, collect a postcard and decorate your cottage.

설명 (1460/4000):

```
Light every tile. Keep the little village glowing.

Duskwick is a calm lantern logic puzzle. Place lanterns on a small stone board until every tile is lit. Lanterns must not see each other, and each numbered stone tells you exactly how many lanterns stand beside it. Every puzzle has one answer, so you never need to guess.

A tiny friend lives in every lantern. Each puzzle you solve lights a house in your hillside village, and as you keep playing, seven lantern friends move in: Wick, Momo, Sage, Luna, Pip, Kuri and Yuki. They write you letters, ask for small favors and send gifts. Decorate your cottage with what they bring, choose one new piece at the market stall (nothing to buy), and watch the village change with the time of day and the seasons.

• A new puzzle every day, the same for everyone. Each one ends with a postcard to keep, and your streak covers a missed day now and then
• Gentle puzzles to begin with, deeper ones when you want to think
• Step-by-step hints whenever you are stuck
• Works offline. No account, no lives, no rush
• Easy on the eyes and hands: VoiceOver, large text, numbers shown as dots, lantern faces you can switch off
• Your progress follows you between your devices through your own iCloud
• Available in English, 한국어, 日本語, Deutsch, Français, Español, Português (Brasil), Italiano, 简体中文 and 繁體中文

Duskwick contains ads. They appear only between puzzles, never during a puzzle, in the daily puzzle or in the village.
```

## en-CA

메모: CA (with fr-CA)

- 이름 (30/30): `Duskwick: Lantern Logic Puzzle`
- 부제 (28/30): `Cozy Village & Daily Puzzles`
- 키워드 (92/100): `brain,games,calm,relax,decorate,cute,friends,teaser,adults,offline,wifi,no,light,grid,zen,iq`
- 프로모션 문구 (117/170): Seven lantern friends are waiting in the village. Solve today's puzzle, collect a postcard and decorate your cottage.

설명 (1460/4000):

```
Light every tile. Keep the little village glowing.

Duskwick is a calm lantern logic puzzle. Place lanterns on a small stone board until every tile is lit. Lanterns must not see each other, and each numbered stone tells you exactly how many lanterns stand beside it. Every puzzle has one answer, so you never need to guess.

A tiny friend lives in every lantern. Each puzzle you solve lights a house in your hillside village, and as you keep playing, seven lantern friends move in: Wick, Momo, Sage, Luna, Pip, Kuri and Yuki. They write you letters, ask for small favors and send gifts. Decorate your cottage with what they bring, choose one new piece at the market stall (nothing to buy), and watch the village change with the time of day and the seasons.

• A new puzzle every day, the same for everyone. Each one ends with a postcard to keep, and your streak covers a missed day now and then
• Gentle puzzles to begin with, deeper ones when you want to think
• Step-by-step hints whenever you are stuck
• Works offline. No account, no lives, no rush
• Easy on the eyes and hands: VoiceOver, large text, numbers shown as dots, lantern faces you can switch off
• Your progress follows you between your devices through your own iCloud
• Available in English, 한국어, 日本語, Deutsch, Français, Español, Português (Brasil), Italiano, 简体中文 and 繁體中文

Duskwick contains ads. They appear only between puzzles, never during a puzzle, in the daily puzzle or in the village.
```

## ru

메모: keywords only: indexed in the US storefront; Russia gets no AdMob ads (see regions.md). Fill name/subtitle/description with the en-US text

- 이름 (30/30): `Duskwick: Lantern Logic Puzzle`
- 부제 (29/30): `Calm & Cozy Daily Brain Games`
- 키워드 (93/100): `peaceful,unwind,gentle,glow,lanterns,lamps,cottage,room,letters,gifts,spirit,mascot,wick,dusk`
- 프로모션 문구 (117/170): Seven lantern friends are waiting in the village. Solve today's puzzle, collect a postcard and decorate your cottage.

설명 (1460/4000):

```
Light every tile. Keep the little village glowing.

Duskwick is a calm lantern logic puzzle. Place lanterns on a small stone board until every tile is lit. Lanterns must not see each other, and each numbered stone tells you exactly how many lanterns stand beside it. Every puzzle has one answer, so you never need to guess.

A tiny friend lives in every lantern. Each puzzle you solve lights a house in your hillside village, and as you keep playing, seven lantern friends move in: Wick, Momo, Sage, Luna, Pip, Kuri and Yuki. They write you letters, ask for small favors and send gifts. Decorate your cottage with what they bring, choose one new piece at the market stall (nothing to buy), and watch the village change with the time of day and the seasons.

• A new puzzle every day, the same for everyone. Each one ends with a postcard to keep, and your streak covers a missed day now and then
• Gentle puzzles to begin with, deeper ones when you want to think
• Step-by-step hints whenever you are stuck
• Works offline. No account, no lives, no rush
• Easy on the eyes and hands: VoiceOver, large text, numbers shown as dots, lantern faces you can switch off
• Your progress follows you between your devices through your own iCloud
• Available in English, 한국어, 日本語, Deutsch, Français, Español, Português (Brasil), Italiano, 简体中文 and 繁體中文

Duskwick contains ads. They appear only between puzzles, never during a puzzle, in the daily puzzle or in the village.
```

## vi

메모: keywords only: indexed in the US storefront. Fill the other fields with the en-US text

- 이름 (30/30): `Duskwick: Lantern Logic Puzzle`
- 부제 (29/30): `Calm & Cozy Daily Brain Games`
- 키워드 (94/100): `logical,thinking,training,challenge,solve,tiles,board,lit,lights,neighbors,town,furniture,home`
- 프로모션 문구 (117/170): Seven lantern friends are waiting in the village. Solve today's puzzle, collect a postcard and decorate your cottage.

설명 (1460/4000):

```
Light every tile. Keep the little village glowing.

Duskwick is a calm lantern logic puzzle. Place lanterns on a small stone board until every tile is lit. Lanterns must not see each other, and each numbered stone tells you exactly how many lanterns stand beside it. Every puzzle has one answer, so you never need to guess.

A tiny friend lives in every lantern. Each puzzle you solve lights a house in your hillside village, and as you keep playing, seven lantern friends move in: Wick, Momo, Sage, Luna, Pip, Kuri and Yuki. They write you letters, ask for small favors and send gifts. Decorate your cottage with what they bring, choose one new piece at the market stall (nothing to buy), and watch the village change with the time of day and the seasons.

• A new puzzle every day, the same for everyone. Each one ends with a postcard to keep, and your streak covers a missed day now and then
• Gentle puzzles to begin with, deeper ones when you want to think
• Step-by-step hints whenever you are stuck
• Works offline. No account, no lives, no rush
• Easy on the eyes and hands: VoiceOver, large text, numbers shown as dots, lantern faces you can switch off
• Your progress follows you between your devices through your own iCloud
• Available in English, 한국어, 日本語, Deutsch, Français, Español, Português (Brasil), Italiano, 简体中文 and 繁體中文

Duskwick contains ads. They appear only between puzzles, never during a puzzle, in the daily puzzle or in the village.
```

## de-DE

메모: DE, AT, CH

- 이름 (30/30): `Duskwick: Laternen-Logikrätsel`
- 부제 (29/30): `Tägliches Rätsel & Denkspiele`
- 키워드 (99/100): `gehirnjogging,logik,spiele,dorf,einrichten,niedlich,offline,ohne,internet,entspannend,knobeln,licht`
- 프로모션 문구 (115/170): Im Dorf warten sieben Laternenfreunde. Löse das Rätsel des Tages, sammle eine Postkarte und richte deine Hütte ein.

설명 (1528/4000):

```
Erhelle jedes Feld und lass das kleine Dorf leuchten.

Duskwick ist ein ruhiges Laternen-Logikrätsel. Setze Laternen auf ein kleines Steinfeld, bis jedes Feld erhellt ist. Laternen dürfen sich nicht sehen, und jeder Zahlenstein verrät genau, wie viele Laternen daneben stehen. Jedes Rätsel hat genau eine Lösung, Raten ist nie nötig.

In jeder Laterne wohnt ein kleiner Freund. Mit jedem gelösten Rätsel geht in deinem Dorf am Hang ein Licht an, und wenn du weiterspielst, ziehen nach und nach sieben Laternenfreunde ein: Wick, Momo, Sage, Luna, Pip, Kuri und Yuki. Sie schreiben dir Briefe, bitten um kleine Gefallen und schicken Geschenke. Richte damit deine Hütte ein, such dir am Marktstand ein neues Stück aus (zu kaufen gibt es nichts) und sieh zu, wie sich das Dorf mit Tageszeit und Jahreszeit verändert.

• Jeden Tag ein neues Rätsel, für alle gleich. Am Ende wartet eine Postkarte, und deine Serie überbrückt auch mal einen verpassten Tag
• Sanfte Rätsel zum Einstieg, knifflige, wenn du nachdenken magst
• Schritt-für-Schritt-Tipps, wenn du nicht weiterkommst
• Funktioniert offline. Kein Konto, keine Leben, keine Eile
• Schonend für Augen und Hände: VoiceOver, große Schrift, Zahlen als Punkte, Laternengesichter abschaltbar
• Dein Fortschritt folgt dir über dein eigenes iCloud auf deine Geräte
• In 10 Sprachen: Deutsch, English, 한국어, 日本語, Français, Español, Português, Italiano, 简体中文, 繁體中文

Duskwick enthält Werbung. Sie erscheint nur zwischen den Rätseln, nie mitten im Rätsel, im Rätsel des Tages oder im Dorf.
```

## fr-FR

메모: FR, BE, CH; also indexed in the US storefront

- 이름 (29/30): `Duskwick : Casse-tête logique`
- 부제 (29/30): `Lanternes & jeux de réflexion`
- 키워드 (100/100): `énigme,cerveau,quotidien,village,décorer,mignon,détente,relaxant,zen,sans,wifi,internet,lumière,défi`
- 프로모션 문구 (123/170): Sept amis lanternes vous attendent au village. Résolvez l’énigme du jour, gardez une carte postale et décorez votre cabane.

설명 (1617/4000):

```
Éclairez chaque case et gardez le petit village allumé.

Duskwick est une énigme de logique tout en douceur. Posez des lanternes sur un petit plateau de pierre jusqu’à ce que chaque case soit éclairée. Deux lanternes ne doivent pas se voir, et chaque pierre numérotée indique exactement combien de lanternes se trouvent à côté. Chaque énigme n’a qu’une seule solution : inutile de deviner.

Un petit compagnon habite dans chaque lanterne. Chaque énigme résolue allume une maison de votre village sur la colline et, en jouant, sept amis lanternes s’installent : Wick, Momo, Sage, Luna, Pip, Kuri et Yuki. Ils vous écrivent, vous demandent de petits services et vous offrent des cadeaux. Décorez votre cabane avec ce qu’ils apportent, choisissez un objet à l’étal du marché (rien à acheter) et regardez le village changer selon l’heure et la saison.

• Une nouvelle énigme chaque jour, la même pour tous. Elle se termine par une carte postale, et votre série couvre parfois un jour manqué
• Des énigmes douces pour commencer, plus profondes quand vous voulez réfléchir
• Des indices pas à pas quand vous bloquez
• Fonctionne hors ligne. Sans compte, sans vies, sans hâte
• Pensé pour les yeux et les mains : VoiceOver, grand texte, chiffres en points, visages de lanternes désactivables
• Votre progression vous suit d’un appareil à l’autre grâce à votre propre iCloud
• Disponible en 10 langues : français, English, 한국어, 日本語, Deutsch, Español, Português, Italiano, 简体中文, 繁體中文

Duskwick contient des publicités. Elles n’apparaissent qu’entre deux énigmes, jamais pendant une énigme, dans l’énigme du jour ni au village.
```

## fr-CA

메모: CA

- 이름 (29/30): `Duskwick : Casse-tête logique`
- 부제 (25/30): `Lanternes, énigme du jour`
- 키워드 (95/100): `jeux,réflexion,cerveau,quotidien,village,décorer,mignon,détente,relaxant,sans,wifi,lumière,défi`
- 프로모션 문구 (123/170): Sept amis lanternes vous attendent au village. Résolvez l’énigme du jour, gardez une carte postale et décorez votre cabane.

설명 (1617/4000):

```
Éclairez chaque case et gardez le petit village allumé.

Duskwick est une énigme de logique tout en douceur. Posez des lanternes sur un petit plateau de pierre jusqu’à ce que chaque case soit éclairée. Deux lanternes ne doivent pas se voir, et chaque pierre numérotée indique exactement combien de lanternes se trouvent à côté. Chaque énigme n’a qu’une seule solution : inutile de deviner.

Un petit compagnon habite dans chaque lanterne. Chaque énigme résolue allume une maison de votre village sur la colline et, en jouant, sept amis lanternes s’installent : Wick, Momo, Sage, Luna, Pip, Kuri et Yuki. Ils vous écrivent, vous demandent de petits services et vous offrent des cadeaux. Décorez votre cabane avec ce qu’ils apportent, choisissez un objet à l’étal du marché (rien à acheter) et regardez le village changer selon l’heure et la saison.

• Une nouvelle énigme chaque jour, la même pour tous. Elle se termine par une carte postale, et votre série couvre parfois un jour manqué
• Des énigmes douces pour commencer, plus profondes quand vous voulez réfléchir
• Des indices pas à pas quand vous bloquez
• Fonctionne hors ligne. Sans compte, sans vies, sans hâte
• Pensé pour les yeux et les mains : VoiceOver, grand texte, chiffres en points, visages de lanternes désactivables
• Votre progression vous suit d’un appareil à l’autre grâce à votre propre iCloud
• Disponible en 10 langues : français, English, 한국어, 日本語, Deutsch, Español, Português, Italiano, 简体中文, 繁體中文

Duskwick contient des publicités. Elles n’apparaissent qu’entre deux énigmes, jamais pendant une énigme, dans l’énigme du jour ni au village.
```

## ja

- 이름 (22/30): `Duskwick: ランタンのロジックパズル`
- 부제 (14/30): `灯りをともす毎日の癒しゲーム`
- 키워드 (78/100): `頭の体操,パズルゲーム,ランタン,村,箱庭,模様替え,かわいい,推理,論理,暇つぶし,オフライン,大人,デイリー,パズル,灯り,ひらめき,ロジック,ゆったり`
- 프로모션 문구 (52/170): 村では7人のランタンの友だちが待っています。今日のパズルを解いて、はがきを集めて、小屋をかざりましょう。

설명 (725/4000):

```
すべてのマスを照らして、小さな村に灯りをともそう。

Duskwickは、おだやかなランタン・ロジックパズルです。石の盤にランタンを置いて、すべてのマスを照らしましょう。ランタン同士が見えてはいけません。数字の石は、となりにあるランタンの数を教えてくれます。どの問題も答えはひとつだけなので、あてずっぽうは要りません。

ランタンの中には、小さな友だちが住んでいます。問題を解くたびに丘の村の家に灯りがともり、遊び続けるとウィック、モモ、セージ、ルナ、ピピ、クリ、ユキの7人が引っ越してきます。友だちはお手紙をくれたり、ささやかなお願いをしたり、贈り物をくれたりします。もらった物で自分の小屋をかざり、市場の屋台で新しい物をひとつ選び（お金は使いません）、時間帯や季節で変わる村の景色を楽しんでください。

・毎日あたらしい「今日のパズル」。みんなが同じ問題を解きます。解くとはがきが残り、連続記録はときどき休んだ日もカバーしてくれます
・やさしい問題から、じっくり考える問題まで
・行き詰まったときは、ステップ式のヒント
・オフラインで遊べます。アカウントもライフも、急かされることもありません
・目と手にやさしく：VoiceOver、大きな文字、数字を点で表示、ランタンの顔はオフにもできます
・進行状況は、あなた自身のiCloudで端末間につながります
・10言語対応（日本語、English、한국어、Deutsch、Français、Español、Português、Italiano、简体中文、繁體中文）

Duskwickには広告があります。広告が表示されるのは問題と問題のあいだだけで、問題の途中、今日のパズル、村では表示されません。
```

## ko

메모: also indexed in the US storefront

- 이름 (14/30): `더스크윅: 등불 로직 퍼즐`
- 부제 (17/30): `하루 한 판, 귀여운 두뇌 게임`
- 키워드 (81/100): `Duskwick,논리,두뇌퍼즐,로직퍼즐,퍼즐게임,힐링,마을,꾸미기,방꾸미기,오프라인,와이파이,랜턴,추리,브레인,집중력,데일리,캐릭터,아이큐,잔잔한`
- 프로모션 문구 (53/170): 마을에서 일곱 등불 친구가 기다려요. 오늘의 퍼즐을 풀고 엽서를 모으고, 오두막을 꾸며 보세요.

설명 (764/4000):

```
모든 칸을 밝히고, 작은 마을의 불을 이어 가세요.

더스크윅은 차분한 등불 로직 퍼즐이에요. 돌판 위에 등불을 놓아 모든 칸을 밝히면 돼요. 등불끼리는 서로 마주 보면 안 되고, 숫자 돌은 바로 옆에 등불이 몇 개 있는지 알려 줘요. 퍼즐마다 정답은 딱 하나라서 찍을 필요가 없어요.

등불마다 작은 친구가 살아요. 퍼즐을 풀 때마다 언덕 마을의 집에 불이 켜지고, 계속 플레이하면 윅, 모모, 세이지, 루나, 핍, 쿠리, 유키 일곱 친구가 차례로 이사 와요. 친구들은 편지를 보내고, 작은 부탁을 하고, 선물을 줘요. 받은 선물로 나만의 오두막을 꾸미고, 장터에서 새 물건을 하나 골라 보세요(살 것은 없어요). 마을은 하루의 시간과 계절에 따라 모습이 바뀌어요.

• 매일 새로운 오늘의 퍼즐: 모두가 같은 퍼즐을 풀어요. 끝나면 엽서가 남고, 연속 기록은 가끔 빠진 날도 덮어 줘요
• 쉬운 퍼즐부터 시작해 생각이 필요한 퍼즐까지
• 막힐 때마다 단계별 힌트
• 오프라인에서도 즐길 수 있어요. 계정도, 목숨도, 서두를 일도 없어요
• 눈과 손이 편하도록: VoiceOver, 큰 글자, 숫자를 점으로 보기, 등불 얼굴 끄기
• 내 iCloud로 기기 사이에 진행 상황이 이어져요
• 한국어, English, 日本語, Deutsch, Français, Español, Português, Italiano, 简体中文, 繁體中文 지원

더스크윅에는 광고가 있어요. 광고는 퍼즐과 퍼즐 사이에만 나오고, 퍼즐을 푸는 도중, 오늘의 퍼즐, 마을에서는 나오지 않아요.
```

## es-ES

메모: ES

- 이름 (26/30): `Duskwick: Juegos de lógica`
- 부제 (29/30): `Puzle diario, zen y relajante`
- 키워드 (97/100): `rompecabezas,acertijos,mentales,cerebro,pueblo,decorar,sin,internet,wifi,offline,faroles,luz,reto`
- 프로모션 문구 (111/170): Siete amigos farol te esperan en el pueblo. Resuelve el Acertijo del día, guarda una postal y decora tu cabaña.

설명 (1530/4000):

```
Ilumina cada casilla y mantén encendido el pequeño pueblo.

Duskwick es un acertijo de lógica tranquilo con faroles. Coloca faroles en un pequeño tablero de piedra hasta iluminar todas las casillas. Los faroles no deben verse entre sí, y cada piedra con número te dice exactamente cuántos faroles hay a su lado. Cada acertijo tiene una única solución, así que nunca hace falta adivinar.

En cada farol vive un amiguito. Cada acertijo resuelto enciende una casa de tu pueblo en la colina y, mientras juegas, se mudan siete amigos farol: Wick, Momo, Sage, Luna, Pip, Kuri y Yuki. Te escriben cartas, te piden pequeños favores y te mandan regalos. Decora tu cabaña con lo que traen, elige una pieza nueva en el puesto del mercado (nada que comprar) y mira cómo el pueblo cambia con la hora del día y las estaciones.

• Un acertijo nuevo cada día, igual para todos. Termina con una postal para guardar, y tu racha cubre de vez en cuando un día que se te pase
• Acertijos suaves para empezar y otros más profundos para pensar
• Pistas paso a paso cuando te atasques
• Funciona sin conexión. Sin cuenta, sin vidas, sin prisas
• Pensado para ojos y manos: VoiceOver, texto grande, números en puntos y caras de farol que puedes desactivar
• Tu progreso te sigue entre tus dispositivos con tu propio iCloud
• Disponible en 10 idiomas: español, English, 한국어, 日本語, Deutsch, Français, Português, Italiano, 简体中文, 繁體中文

Duskwick incluye anuncios. Solo aparecen entre acertijos, nunca durante un acertijo, en el Acertijo del día ni en el pueblo.
```

## es-MX

메모: MX and Latin America; also indexed in the US storefront

- 이름 (26/30): `Duskwick: Juegos de lógica`
- 부제 (26/30): `Rompecabezas mental diario`
- 키워드 (99/100): `acertijos,mentales,cerebro,pueblo,decorar,lindo,sin,internet,wifi,offline,relajante,zen,faroles,luz`
- 프로모션 문구 (111/170): Siete amigos farol te esperan en el pueblo. Resuelve el Acertijo del día, guarda una postal y decora tu cabaña.

설명 (1530/4000):

```
Ilumina cada casilla y mantén encendido el pequeño pueblo.

Duskwick es un acertijo de lógica tranquilo con faroles. Coloca faroles en un pequeño tablero de piedra hasta iluminar todas las casillas. Los faroles no deben verse entre sí, y cada piedra con número te dice exactamente cuántos faroles hay a su lado. Cada acertijo tiene una única solución, así que nunca hace falta adivinar.

En cada farol vive un amiguito. Cada acertijo resuelto enciende una casa de tu pueblo en la colina y, mientras juegas, se mudan siete amigos farol: Wick, Momo, Sage, Luna, Pip, Kuri y Yuki. Te escriben cartas, te piden pequeños favores y te mandan regalos. Decora tu cabaña con lo que traen, elige una pieza nueva en el puesto del mercado (nada que comprar) y mira cómo el pueblo cambia con la hora del día y las estaciones.

• Un acertijo nuevo cada día, igual para todos. Termina con una postal para guardar, y tu racha cubre de vez en cuando un día que se te pase
• Acertijos suaves para empezar y otros más profundos para pensar
• Pistas paso a paso cuando te atasques
• Funciona sin conexión. Sin cuenta, sin vidas, sin prisas
• Pensado para ojos y manos: VoiceOver, texto grande, números en puntos y caras de farol que puedes desactivar
• Tu progreso te sigue entre tus dispositivos con tu propio iCloud
• Disponible en 10 idiomas: español, English, 한국어, 日本語, Deutsch, Français, Português, Italiano, 简体中文, 繁體中文

Duskwick incluye anuncios. Solo aparecen entre acertijos, nunca durante un acertijo, en el Acertijo del día ni en el pueblo.
```

## pt-BR

메모: BR is excluded from launch (regions.md D2); the locale is still indexed in the US storefront

- 이름 (25/30): `Duskwick: Jogos de Lógica`
- 부제 (30/30): `Quebra-cabeça diário relaxante`
- 키워드 (97/100): `raciocínio,mente,cérebro,vila,decorar,fofo,offline,sem,internet,wifi,luz,calmo,zen,desafio,enigma`
- 프로모션 문구 (125/170): Sete amigos lanterna esperam por você na vila. Resolva o quebra-cabeça do dia, guarde um cartão-postal e decore a sua cabana.

설명 (1575/4000):

```
Ilumine cada quadrado e mantenha a pequena vila acesa.

Duskwick é um quebra-cabeça de lógica tranquilo com lanternas. Coloque lanternas num pequeno tabuleiro de pedra até todos os quadrados ficarem iluminados. As lanternas não podem se ver, e cada pedra numerada diz exatamente quantas lanternas ficam ao lado dela. Cada quebra-cabeça tem uma única solução, então você nunca precisa chutar.

Em cada lanterna mora um amiguinho. Cada quebra-cabeça resolvido acende uma casa da sua vila na colina e, conforme você joga, sete amigos lanterna se mudam para lá: Wick, Momo, Sage, Luna, Pip, Kuri e Yuki. Eles escrevem cartas, pedem pequenos favores e mandam presentes. Decore a sua cabana com o que eles trazem, escolha uma peça nova na barraca da feira (nada para comprar) e veja a vila mudar com a hora do dia e as estações.

• Um quebra-cabeça novo por dia, igual para todos. Cada um termina com um cartão-postal, e a sua sequência cobre de vez em quando um dia perdido
• Quebra-cabeças suaves para começar e outros mais profundos para pensar
• Dicas passo a passo quando você travar
• Funciona offline. Sem conta, sem vidas, sem pressa
• Feito para os olhos e as mãos: VoiceOver, texto grande, números em pontos e rostos nas lanternas que você pode desligar
• Seu progresso acompanha você entre os aparelhos pelo seu próprio iCloud
• Disponível em 10 idiomas: português, English, 한국어, 日本語, Deutsch, Français, Español, Italiano, 简体中文, 繁體中文

O Duskwick tem anúncios. Eles aparecem só entre os quebra-cabeças, nunca durante um quebra-cabeça, no quebra-cabeça do dia nem na vila.
```

## it

메모: IT, CH

- 이름 (26/30): `Duskwick: Giochi di logica`
- 부제 (25/30): `Rompicapo zen ogni giorno`
- 키워드 (96/100): `enigmistica,mente,cervello,borgo,arredare,carino,senza,internet,offline,rilassanti,lanterna,luce`
- 프로모션 문구 (121/170): Sette amici lanterna ti aspettano nel borgo. Risolvi l’enigma del giorno, conserva una cartolina e arreda la tua casetta.

설명 (1553/4000):

```
Illumina ogni casella e tieni acceso il piccolo borgo.

Duskwick è un enigma di logica rilassante con le lanterne. Posa le lanterne su una piccola tavola di pietra finché ogni casella è illuminata. Le lanterne non devono vedersi, e ogni pietra numerata dice esattamente quante lanterne ha accanto. Ogni enigma ha una sola soluzione, quindi non serve mai tirare a indovinare.

In ogni lanterna vive un piccolo amico. Ogni enigma risolto accende una casa del tuo borgo sulla collina e, mentre giochi, sette amici lanterna vanno a vivere con te: Wick, Momo, Sage, Luna, Pip, Kuri e Yuki. Ti scrivono lettere, ti chiedono piccoli favori e ti mandano regali. Arreda la tua casetta con quello che portano, scegli un pezzo nuovo alla bancarella del mercato (niente da comprare) e guarda il borgo cambiare con l’ora del giorno e le stagioni.

• Un nuovo enigma ogni giorno, uguale per tutti. Finisce con una cartolina da conservare, e la tua serie copre ogni tanto un giorno saltato
• Enigmi dolci per cominciare, più profondi quando vuoi pensare
• Indizi passo passo quando ti blocchi
• Funziona offline. Niente account, niente vite, nessuna fretta
• Pensato per occhi e mani: VoiceOver, testo grande, numeri a puntini e facce delle lanterne che puoi spegnere
• I tuoi progressi ti seguono tra i dispositivi con il tuo iCloud
• Disponibile in 10 lingue: italiano, English, 한국어, 日本語, Deutsch, Français, Español, Português, 简体中文, 繁體中文

Duskwick contiene pubblicità. Compare solo tra un enigma e l’altro, mai durante un enigma, nell’enigma del giorno o nel borgo.
```

## zh-Hant

메모: TW, HK, MO; also indexed in the US storefront. HK reads 行/列 the other way round (QA report)

- 이름 (17/30): `Duskwick：點燈邏輯益智遊戲`
- 부제 (12/30): `每天一題的療癒動腦小遊戲`
- 키워드 (67/100): `燈籠,解謎,腦力,燒腦,推理,小鎮,布置,裝飾,可愛,單機,離線,休閒,紓壓,思考,謎題,邏輯遊戲,動腦遊戲,點燈解謎,益智解謎,放鬆`
- 프로모션 문구 (32/170): 七位燈籠朋友在小鎮等你。解開今日謎題，收集明信片，布置你的小屋。

설명 (570/4000):

```
照亮每一格，讓小鎮的燈一直亮著。

Duskwick 是一款療癒的燈籠邏輯謎題。在石板上放下燈籠，照亮每一個格子。燈籠之間不能互相看見，帶數字的石頭會告訴你旁邊剛好有幾盞燈籠。每道謎題都只有一個答案，不用靠猜。

每盞燈籠裡都住著一位好朋友。每解開一道謎題，山坡小鎮就多亮一間小屋；繼續玩下去，七位燈籠朋友會陸續搬進來：小燭、桃桃、葉葉、月月、皮皮、栗栗和雪雪。他們會寫信給你、拜託你一點小事，還會送你禮物。用他們帶來的東西布置你的小屋，在市集攤位上挑一件新東西（不需花錢），看小鎮隨著一天的時間和四季變換模樣。

• 每天一題新謎題，所有人都是同一題。解完留下一張明信片，連續紀錄還能偶爾替你補上漏掉的一天
• 從輕鬆的謎題開始，想動腦時還有更深的
• 卡關時有一步一步的提示
• 離線也能玩。不需要帳號，沒有體力限制，不用著急
• 對眼睛和雙手都很友善：VoiceOver、大字體、用圓點顯示數字、可關閉燈籠的小臉
• 透過你自己的 iCloud，進度可在多台裝置間同步
• 支援 10 種語言：繁體中文、English、한국어、日本語、Deutsch、Français、Español、Português、Italiano、简体中文

Duskwick 含有廣告。廣告只會出現在兩道謎題之間，不會出現在解題過程中、今日謎題裡或小鎮裡。
```

## zh-Hans

메모: SG, MY; also indexed in the US storefront; mainland China is not a distribution territory

- 이름 (17/30): `Duskwick：点灯逻辑益智游戏`
- 부제 (12/30): `每天一题的治愈动脑小游戏`
- 키워드 (67/100): `灯笼,解谜,脑力,烧脑,推理,小镇,布置,装饰,可爱,单机,离线,休闲,解压,思考,谜题,逻辑游戏,动脑游戏,点灯解谜,益智解谜,放松`
- 프로모션 문구 (32/170): 七位灯笼朋友在小镇等你。解开今日谜题，收集明信片，布置你的小屋。

설명 (567/4000):

```
照亮每一格，让小镇的灯一直亮着。

Duskwick 是一款治愈的灯笼逻辑谜题。在石板上放下灯笼，照亮每一个格子。灯笼之间不能互相看见，带数字的石头会告诉你旁边恰好有几盏灯笼。每道谜题都只有一个答案，不用靠猜。

每盏灯笼里都住着一个小伙伴。每解开一道谜题，山坡小镇就多亮一间小屋；继续玩下去，七位灯笼朋友会陆续搬进来：小烛、桃桃、叶叶、月月、皮皮、栗栗和雪雪。他们会给你写信、拜托你一点小事，还会送你礼物。用他们带来的东西布置你的小屋，在集市摊位上挑一件新东西（无需花钱），看小镇随着一天的时间和四季变换模样。

• 每天一道新谜题，所有人都是同一题。解完留下一张明信片，连续记录还能偶尔替你补上漏掉的一天
• 从轻松的谜题开始，想动脑时还有更深的
• 卡住时有一步一步的提示
• 离线也能玩。无需账号，没有体力限制，不用着急
• 对眼睛和双手都友好：VoiceOver、大字体、用圆点显示数字、可关闭灯笼的小脸
• 通过你自己的 iCloud，进度可在多台设备间同步
• 支持 10 种语言：简体中文、English、한국어、日本語、Deutsch、Français、Español、Português、Italiano、繁體中文

Duskwick 含有广告。广告只在两道谜题之间出现，不会出现在解题过程中、今日谜题里或小镇里。
```
