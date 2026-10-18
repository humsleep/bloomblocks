# Duskwick i18n glossary (10 locales)

Source of truth for the words every screen, VoiceOver label, tutorial line, notification and store-facing string uses.
Strings live in `apps/client/src/a11y/strings.ts` (UI + VoiceOver), `src/ads/breakCard.ts` (ad-break card),
`src/notify/texts.ts` (reminders), `ios/App/App/<lang>.lproj/InfoPlist.strings` (ATT text). When a term changes here,
change it everywhere (VoiceOver and shown text must use the same word).

Locales: `en`, `ko`, `ja`, `de`, `fr`, `es` (neutral: Spain + Latin America), `pt-BR` (all Portuguese), `it`,
`zh-Hans` (Singapore, Malaysia, Chinese abroad; mainland China is not a distribution territory),
`zh-Hant` (Taiwan, Hong Kong, Macau — Taiwan vocabulary). Language detection: `langOf()` in `strings.ts`.

## Key terms

| term | en | ko | ja | de | fr | es | pt-BR | it | zh-Hans | zh-Hant |
|---|---|---|---|---|---|---|---|---|---|---|
| lantern | lantern | 등불 | ランタン | Laterne | lanterne | farol | lanterna | lanterna | 灯笼（盏） | 燈籠（盞） |
| stone | stone | 돌 | 石 | Stein | pierre | roca | pedra | pietra | 石头 | 石頭 |
| tile (cell) | tile | 칸 | マス | Feld | case | casilla | quadrado | casella | 格子 / 格 | 格子 / 格 |
| light up | light up | 밝히다 | 照らす | hell machen / erhellen | éclairer (le village: illuminer) | iluminar | iluminar | illuminare (tiles) · accendere (a lantern) | 照亮（格子）· 点亮（小镇、灯笼） | 照亮（格子）· 點亮（小鎮、燈籠） |
| daily | Today's puzzle | 오늘의 퍼즐 | 今日のパズル | Rätsel des Tages | Énigme du jour | Acertijo del día | Quebra-cabeça do dia | Enigma del giorno | 今日谜题 | 今日謎題 |
| puzzle (counter) | puzzle | 퍼즐 | パズル | Rätsel | énigme | acertijo | quebra-cabeça | enigma | 谜题 / 第 n 题 | 謎題 / 第 n 題 |
| streak | n-day streak | n일 연속 · 연속 기록 | n日連続 · 連続記録 | n Tage in Folge · Serie | n jours d'affilée · série | racha (Racha de n días) | n dias seguidos · sequência | n giorni di fila · serie | 连续 n 天 · 连续记录 | 連續 n 天 · 連續紀錄 |
| shield | shield | 보호막 | シールド | Schutz | protection | escudo | escudo | scudo | 护盾（个） | 護盾（個） |
| hint | Hint | 힌트 | ヒント | Tipp | Indice | Pista | Dica | Indizio | 提示 | 提示 |
| undo | Undo | 되돌리기 | 元に戻す | Rückgängig | Annuler | Deshacer | Desfazer | Annulla | 撤销 | 還原 |
| town | Town | 마을 | 村 | Dorf | village | pueblo | vila | borgo | 小镇 | 小鎮 |
| house | house | 집 | 家 | Haus | maison | casa | casa | casa | 小屋（间） | 小屋（間） |

## Supporting terms

| term | en | ko | ja | de | fr | es | pt-BR | it | zh-Hans | zh-Hant |
|---|---|---|---|---|---|---|---|---|---|---|
| tap | Tap | 누르다 | タップ | tippen | toucher | tocar | tocar | toccare | 点一下 | 點一下 |
| remove (a lantern) | remove | 빼다 | 外す | wegnehmen | retirer | quitar | tirar | togliere | 拿掉 | 拿掉 |
| diagonal (not counted) | corners | 대각선 | ななめ | Ecken | diagonales | diagonales | diagonais | diagonali | 斜对角 | 斜對角 |
| Rules (the rules sheet: its title, the HUD caption, the settings row — ONE name, R2 A1) | Rules | 규칙 | ルール | Regeln | Règles | Reglas | Regras | Regole | 规则 | 規則 |
| the rewarded ad | ad | 광고 | 広告 | Werbung | pub | anuncio / video | anúncio / vídeo | annuncio | 广告（一则），never 视频 | 廣告（一則），never 影片 / 短片 |
| tutorial | tutorial | 튜토리얼 | チュートリアル | Einführung | tutoriel | tutorial | tutorial | tutorial | 教程 | 教學 |
| skip | Skip | 건너뛰기 | スキップ | Überspringen | Passer | Saltar | Pular | Salta | 跳过 | 略過 |
| settings (in game) | Settings | 설정 | 設定 | Einstellungen | Réglages | Ajustes | Ajustes | Impostazioni | 设置 | 設定 |
| Today's puzzle (card title) | Today's puzzle | 오늘의 퍼즐 | 今日のパズル | Rätsel des Tages | Énigme du jour | Acertijo del día | Quebra-cabeça do dia | Enigma del giorno | 今日谜题 | 今日謎題 |
| play (the first-daily offer's button) | Play | 풀어 보기 | あそぶ | Spielen | Jouer | Jugar | Jogar | Gioca | 开始玩 | 開始玩 |
| postcard (result, R2) | Postcard | 엽서 | はがき | Postkarte | carte postale | postal | cartão-postal | cartolina | 明信片 | 明信片 |
| stamp (postcard) | stamp | 우표 | 切手 | Briefmarke / Marke | timbre | sello | selo | francobollo | 邮票 | 郵票 |
| market stall (village, pick one a day, R2) | stall / market | 장터 | 屋台 | Stand | étal | puesto | barraca | bancarella | 集市 | 市集 |
| streak (a row label, no number) | Streak | 연속 기록 | 連続記録 | Serie | Série | Racha | Sequência | Serie | 连续记录 | 連續紀錄 |
| no hints (✨) | No hints | 힌트 없이 | ヒントなし | Ohne Tipps | Sans indice | Sin pistas | Sem dicas | Senza indizi | 未使用提示 | 未使用提示 |
| iOS Settings app (ATT text) | Settings | 설정 | 設定 | Einstellungen | Réglages | Ajustes (es) · Configuración (es-419) | Ajustes | Impostazioni | “设置” | 「設定」 |

## Village (R2, 2026-10-17)

Lines: `apps/client/src/village/lines/<locale>.json` (from `docs/team/r2-village-lines.*.json`, `scripts/village-lines.mjs`);
UI / item / tab / resident names: `apps/client/src/village/strings.ts`. The 8 non-en/ko locales are AI drafts — native review before release.

| term | en | ko | ja | de | fr | es | pt-BR | it | zh-Hans | zh-Hant |
|---|---|---|---|---|---|---|---|---|---|---|
| village (the place; HUD caption stays "town") | Village | 마을 | 村 | Dorf | village | pueblo | vila | borgo | 小镇 | 小鎮 |
| lantern jar (fills from solved boards; never spent) | lantern jar | 등불 병 | ランタンのびん | Laternenglas | bocal à lumières | frasco de luces | pote de luzes | barattolo delle luci | 灯笼瓶 | 燈籠瓶 |
| cottage (the player's room) | cottage | 오두막 | 小屋 | Hütte | cabane | cabaña | cabana | casetta | 小屋（the room: 小屋里面） | 小屋（the room: 小屋裡面） |
| cushion (Momo's gift; item "Floor cushion") | cushion | 방석 (item: 꽃잎 방석) | クッション | Kissen (item: Sitzkissen) | coussin | cojín | almofada | cuscino | 坐垫 | 坐墊 |
| mailbox | mailbox | 우편함 | ポスト | Briefkasten | boîte aux lettres | buzón | caixa de correio | cassetta della posta | 信箱 | 信箱 |
| letter / gift | letter / gift | 편지 / 선물 | お手紙 / 贈り物 | Brief / Geschenk | lettre / cadeau | carta / regalo | carta / presente | lettera / regalo | 信 / 礼物 | 信 / 禮物 |
| the player, addressed by residents | you (never a name) | no "당신": drop the subject, or 이웃님 | あなた only in a letter's salutation | du | tu (residents) · vous (UI) | tú | você | tu | 你 | 你 |
| resident names | Wick · Momo · Sage · Luna · Pip | 윅 · 모모 · 세이지 · 루나 · 핍 | ウィック · モモ · セージ · ルナ · ピピ | as en | as en | as en | as en | as en | 小烛 · 桃桃 · 叶叶 · 月月 · 皮皮 | 小燭 · 桃桃 · 葉葉 · 月月 · 皮皮 |

- zh: "house" (puzzle screen) and "cottage" are both 小屋; in the village the empty ones are 空房子.
- Drawer item names must fit two lines of a quarter-screen card at 375 pt **without breaking a word** (G3 test).

## Style rules per locale

- **All:** calm, warm, short; shown lines ≤ ~8 English words; no urgency or loss words in reminders (`BANNED` in
  `notify/texts.ts`); no "free" in ad copy; the ad copy always says it is an ad and that the reward is 30 minutes.
- **en:** "stone" everywhere (VoiceOver said "rock" before v12).
- **ja:** です・ます調; full-width 、。; VoiceOver joins with 、 and 。.
- **de / fr / es / pt-BR / it:** informal du / vous (fr keeps vous) / tú / você / tu. Avoid gendered forms addressed to the
  player in it ("Tutto pronto!", "Ottimo!"); it uses "disattivo" (symmetric with "attivo").
- **es (neutral):** no Spain-only words (puzle, vídeo, vale, coger, móvil, ordenador, vosotros) and no LatAm-only slang;
  "acertijo" for the puzzle, "video" without accent. The ATT text has an `es-419.lproj` variant only to name the
  Settings app "Configuración".
- **zh-Hans / zh-Hant:** Apple style — a half-width space between Han and digits / Latin ("30 分钟", "第 3 题",
  "iCloud"), full-width punctuation, no space before it; 你 (not 您). Quotes: zh-Hans “”, zh-Hant 「」.
  VoiceOver row / column: zh-Hans 行 = row, 列 = column; zh-Hant (Taiwan) 列 = row, 欄 = column. Announcements use
  the 已… form (已放下灯笼 / 已放上燈籠) so they are not heard as orders. Taiwan vocabulary in zh-Hant: 設定, 影片,
  裝置, 儲存, 紀錄, 教學, 略過, 還原, 隱私權政策.
- **Fonts:** CJK text names its face before `system-ui` (`uiFont()` in `src/game/uiText.ts`): zh-Hant PingFang TC,
  zh-Hans PingFang SC, ja Hiragino Sans. Lines wrap between Han characters, never before closing punctuation
  (`wrapText`).

## QA 2026-10-18 (역번역 검수, `playtest/i18n-qa.md`, `docs/i18n-qa-report.md`)

- **Ad = "ad"**: the reward is always called an ad (en "Watch an ad for 30 minutes without ads"), never "video" (was en/ko/ja/de/fr/es/pt-BR in the VoiceOver label).
- **Counts never agree with a number in a sentence**: where `{n}` could be 0 or 1 ("1 días", "faltam 1"), put the number last ("Este mes, días iluminados: {done}") or use a number-free form.
- **fr:** UI AND village UI labels = vous (Votre cabane, Choisissez-en un); residents' speech = tu. A no-break space (U+00A0, `\u00a0` in TS) before `? ! : ;`. "diagonales", not "coins". Rules sheet stays "Règles" (short; "Règles du jeu" does not fit the caption).
- **ja:** 村 everywhere for the village (町 only in older notes); full-width `？ ：`; "最初から" (not "やり直す", which reads as redo, the opposite of 元に戻す).
- **de:** "Vibration" (not Haptik); greetings "Guten Morgen" (a bare "Morgen" reads as tomorrow).
- **es:** neutral shop words: Marco de fotos, Cesta, Globo de nieve; diagonals "diagonales".
- **pt-BR:** tile is masculine (quadrado escuro / iluminado); "diagonais", never "cantos"; "Lanternas demais!" (a bare "Demais!" is praise in pt-BR).
- **zh:** Wick is 小烛 / 小燭 everywhere (also in the postcard label and tutorial line); avoid 臭美 and 小夥伴 (mainland flavour); "未使用提示".
- **ko:** never 당신; seat request "앉을 자리".

