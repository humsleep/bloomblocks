# Duskwick — App Store Connect 입력 자료 (2026-10-16)

App Store Connect(ASC)에 그대로 옮겨 적을 값이다. 근거와 점검 결과는 `docs/app-review-preflight.md`에 있다.
`[대괄호]`는 사용자가 채울 자리다. 개발자 이름과 연락 이메일은 공개 페이지에 실리니 직접 정한다.
App Store 화면의 문구는 영어로 적었다. 다른 언어 현지화는 선택 사항이다.

---

## 1. 연령 등급 (2025년 새 설문, 4+/9+/13+/16+/18+)

위치: ASC → 앱 → App Information → Age Ratings → Set Up Age Ratings

| 구역 | 질문 | 답 | 이유 |
| --- | --- | --- | --- |
| In-App Controls | Parental Controls | No | 보호자 기능이 없다 |
| | Age Assurance | No | 나이 확인을 하지 않는다 |
| Capabilities | Unrestricted Web Access | **No** | 앱 안에 브라우저가 없다. 방침 링크는 Safari로 연다 |
| | User-Generated Content | No | 글·사진 업로드가 없다. 공유는 시스템 공유 시트로 보내는 결과 텍스트뿐이다 |
| | Social Media | No | |
| | Messaging and Chat | No | |
| | **Advertising** | **Yes** | AdMob 전면·보상형 광고. 이 항목만으로는 4+이다 |
| Mature Themes | Profanity or Crude Humor / Horror or Fear Themes / Alcohol, Tobacco, or Drug Use | None / None / None | 등불 퍼즐이고 무서운 요소가 없다 |
| Medical or Wellness | Medical or Treatment Information / Health or Wellness Topics | None / None | |
| Sexuality or Nudity | 3개 항목 모두 | None | |
| Violence | Cartoon or Fantasy / Realistic / Prolonged Graphic or Sadistic / Guns or Other Weapons | None (4개 모두) | |
| Chance-Based Activities | Gambling / Simulated Gambling / Contests / Loot Boxes | No / None / None / No | 보상형 광고는 30분 광고 없음일 뿐 무작위 보상이 아니다 |
| Additional Information | Age Categories / Suitability | **Not Applicable** | **"Made for Kids"는 고르지 않는다**(가이드라인 1.3: Kids 앱에는 서드파티 광고 금지) |
| | Override to Higher Age Rating | **9+** (아래 이유) | |

**답: "Override to Higher Age Rating" → 9+** (`maxAdContentRating: PG`는 그대로 둔다)

이유: 설문 답만으로는 4+가 나온다. 하지만 가이드라인 2.5.18은 "앱에 나오는 광고는 앱 연령 등급에 맞아야 한다"고 한다. 우리 앱은 Google 기준 PG("보호자 지도") 광고까지 받는다(`apps/client/src/ads/AdMobAds.ts`의 `maxAdContentRating: MaxAdContentRating.ParentalGuidance`). PG 광고는 Apple 9+ 정의(가벼운 만화 폭력 등이 드물게 나옴)에 맞는다. 9+로 올리면 광고 수요(eCPM)를 줄이지 않고 불일치 위험이 사라진다. 퍼즐 게임에서 9+는 노출에 거의 영향이 없다.

## 2. App Privacy (개인정보 영양 라벨)

위치: ASC → App Privacy → Get Started

- **Do you or your third-party partners collect data from this app? → Yes**
- 근거:
  - 앱 자체는 아무것도 전송하지 않는다.
  - Google Mobile Ads 13.11.0과 UMP 3.1.0이 수집한다. 빌드된 앱 안의 두 SDK `PrivacyInfo.xcprivacy`를 직접 읽어 확인했다.
  - Google의 AdMob iOS 데이터 공개 페이지(2026-10-15 갱신)와 같은 범주다.
  - iCloud 키-값 저장소는 사용자 본인 iCloud에 들어가고 개발자가 볼 수 없다. Apple 정의상 "수집"이 아니다.
  - 로컬 알림 내용은 기기에서 만들어진다.

| 데이터 유형 | 목적 (모두 체크) | 사용자와 연결 | 추적에 사용 |
| --- | --- | --- | --- |
| Identifiers › **Device ID** | Third-Party Advertising, Developer's Advertising or Marketing, Analytics | Yes | **Yes** |
| Location › **Coarse Location** | Third-Party Advertising, Developer's Advertising or Marketing, Analytics, App Functionality | Yes | No |
| Usage Data › **Product Interaction** | Third-Party Advertising, Developer's Advertising or Marketing, Analytics, App Functionality | Yes | No |
| Usage Data › **Advertising Data** | Third-Party Advertising, Developer's Advertising or Marketing, Analytics | Yes | No |
| Diagnostics › **Performance Data** | Third-Party Advertising, Developer's Advertising or Marketing, Analytics, App Functionality | No | No |
| Diagnostics › **Other Diagnostic Data** | Third-Party Advertising, Developer's Advertising or Marketing, Analytics | No | No |
| Diagnostics › **Crash Data** | Analytics | No | No |

- 나머지 유형(연락처, 건강, 금융, 사용자 콘텐츠, 검색·탐색 기록, 구매, 민감 정보, 연락처 목록 등)은 **수집 안 함**이다.
- "Used for tracking = Yes"가 하나라도 있으면 앱은 ATT를 요청해야 한다. 우리 앱은 요청한다(§4 심사 메모).
- Privacy Policy URL: `https://humsleep.github.io/duskwick/privacy`
- User Privacy Choices URL(선택): 비워 둔다. 또는 같은 방침 페이지의 "Your choices" 절을 가리켜도 된다.
- GMA·UMP 버전을 올리거나 미디에이션 어댑터를 더하면 Xcode Organizer → Generate Privacy Report로 다시 맞춘다. Firebase 분석을 붙일 때도 표를 다시 쓴다.

## 3. 그 밖의 ASC 항목

| 항목 | 입력 |
| --- | --- |
| 수출 규정 | Info.plist에 `ITSAppUsesNonExemptEncryption = NO`가 있어 빌드마다 묻지 않는다. 물으면 "None of the algorithms mentioned above" / exempt(OS가 제공하는 HTTPS만 사용, 자체 암호화 없음) |
| Content Rights | "Does your app contain, show, or access third-party content?" → **No**. 퍼즐, 그림, 소리는 직접 만들었다. 폰트는 OFL 라이선스. 광고는 AdMob 계약으로 내보낸다. 확신이 없으면 "Yes, I have the rights"도 문제없다 |
| 카테고리 | Primary: **Games**, 하위 **Puzzle**. Secondary 하위: **Board**(Sudoku류 격자 논리 게임이 흔히 쓴다), 대안은 Casual |
| 가격 | Free(앱 내 구매 없음) |
| Copyright | `2026 [개발자 이름]` |
| Support URL | `https://humsleep.github.io/duskwick/support` (필수. 실제 연락처가 있어야 한다) |
| Marketing URL | `https://humsleep.github.io/duskwick/` (선택. app-ads.txt를 찾을 수 있도록 같은 도메인을 권장) |
| 로그인 정보 | "Sign-in required" 체크 해제 |
| 기기 | iPhone 전용. iPad 스크린샷은 필요 없고, iPad에서는 호환 모드로 실행된다 |

## 4. 심사 메모 (App Review Information → Notes, 영어 그대로 붙여 넣기)

2026-10-18에 실제 빌드(Debug, AdMob 테스트 ID)를 새로 설치한 iPhone 17 Pro Max 시뮬레이터(iOS 26.5, 영어)에서 따라 해 보고 적었다.

```
Thank you for reviewing Duskwick.

- No account or login. Puzzles, art and the village are bundled and work offline; the only network traffic is Google AdMob (ads and consent).
- How to play: tap a tile to place a lantern; every tile must be lit, lanterns must not see each other, and a numbered stone needs exactly that many lanterns next to it. A short tutorial (5 steps, "Skip" at the top left from step 3) teaches it on first launch. The magnifier button gives step-by-step hints (free, no ads).

App Tracking Transparency (5.1.2) - how to reach the prompt:
1. Fresh install, launch: the tutorial starts by itself (finish it or tap "Skip").
2. Solve the first puzzle (house 1, a 5x5 board). When it is solved, a "Next house" button appears.
3. Tap "Next house": Google's consent message (UMP) appears first - in the EEA/UK the consent form, elsewhere only Google's short explainer if one is configured - and right after it the iOS ATT prompt.
- It never appears on first launch, during the tutorial, or after the Daily puzzle, and never blocks play; declining changes nothing in the game.
- If Settings > Privacy & Security > Tracking > "Allow Apps to Request to Track" is off on the review device, iOS suppresses the prompt.
- Attached: a screen recording from a fresh install to the ATT prompt (idle waits between taps were cut; nothing else was edited).

Ads (calm by design, so you may not see one quickly):
- No ads on launch, during a puzzle, in the Daily puzzle or in the village. Interstitials appear only between regular puzzles, at the earliest after the first 6 completed puzzles, then at most once every 2 puzzles and 4 minutes of play (max 2-3 per session).
- Optional rewarded ad: after the day's 2nd interstitial, a small moon chip offers "30 minutes without ads"; tapping it opens a confirmation card ("Watch ad" / "Not now"). Nothing else is unlocked by ads.
- Ads respect the silent switch and the game's mute setting.

Other features:
- Village (button at the left of the bottom row): lantern spirits move in as the player keeps playing; letters and furniture gifts arrive in the mailbox; the player decorates their cottage. There is no currency, no purchase and no ad in the village.
- Daily puzzle: the "Today" (calendar) button. Its result is a postcard that can be shared through the iOS share sheet.
- Rating: the system review prompt (SKStoreReviewController) may appear only after a happy moment (e.g. a Daily solved without hints), never after a hint, a dead end or an ad.
- iCloud: progress is mirrored silently to the user's own iCloud key-value storage (no login, no server of ours).
- Notifications (local only, optional): asked only after a tap on "Remind me"; also in Settings (gear, top left).
- Privacy policy: Settings (gear, top left) > last row, opens in Safari.
- Accessibility: VoiceOver labels for every control and the puzzle grid, Dynamic Type for captions, Reduce Motion, Increase Contrast, dot numbers instead of digits, lantern faces can be turned off.

The puzzle content is generated by our own deterministic generator; the art, characters, village and daily system are original. The app is iPhone-only and runs in compatibility mode on iPad.
```

첨부: `docs/store/review/att-flow.mp4` (새로 설치 → 튜토리얼 2단계 + "Skip" → 첫 판 완성 → "Next house" → Google 메시지 → ATT). 만드는 법은 `playtest/store/README.md`(녹화 절).

**녹화에서 확인한 것 (2026-10-18)**
- EEA 밖(한국 IP, 시뮬레이터 지역 US)에서는 GDPR 동의 양식이 나오지 않았다. 대신 Google의 **IDFA 설명 메시지**("Our app wants to stay free for you … Tap "Allow" on the next screen …")가 나온 뒤 ATT가 떴다.
  - 테스트 앱 ID 상태라서 Google의 기본 메시지가 나왔을 수 있다. 실제 계정에서는 AdMob → 개인정보 보호 및 메시지 → IDFA 설명 메시지에서 사용자가 정한 대로 나온다.
- **위험 (사용자 결정):** "Tap Allow"처럼 허용을 유도하는 문구는 가이드라인 5.1.1(iv)(동의 유도 금지)에 걸려 거절될 수 있다. 실제 계정에서는 IDFA 설명 메시지를 끄거나, 허용을 권하지 않는 중립 문구로 바꾸기를 권한다.
  - 메시지를 끄면 심사 메모 3번의 "elsewhere only Google's short explainer" 부분을 지운다.
- ATT 문구(InfoPlist.strings, 기기 언어): "Allow "Duskwick" to track your activity …" / "This identifier is used only to show ads that are more relevant to you. Duskwick plays exactly the same if you don't allow it, and you can change this anytime in Settings."
- 시뮬레이터의 시스템 언어가 한국어이면 ATT 창이 한국어로 나온다. 녹화 전에 시스템 언어를 영어로 바꿨다.

## 5. 이름·부제·키워드 (로캘별, 2026-10-18 마을·Wick 반영)

- 근거: `docs/team/r1-aso.md` §1(검색어 실측), DECISIONS 라운드 1 "스토어 메타데이터".
- 반영한 기능: 마을(이웃이 이사 옴), 오두막 꾸미기, 편지·선물, Wick(등불마다 얼굴).
- 규칙
  - **Akari, Nikoli, Light Up, Queens**(그리고 Meowdoku·Sudoku 같은 다른 앱·장르 이름)는 이름, 부제, 키워드, 설명, 스크린샷 어디에도 쓰지 않는다(2.3.7, 4.1(c)). 아래 표는 스크립트로 이 단어가 0개임을 확인했다.
  - 키워드는 쉼표만 쓰고 공백을 넣지 않는다. 이름·부제에 이미 있는 단어는 키워드에 다시 넣지 않는다(검사 완료).
  - 길이 제한: 이름 30자, 부제 30자, 키워드 100자.
  - 다른 플랫폼 이름(Android, Google Play)을 쓰지 않는다(2.3.10). 스크린샷은 실제 앱 화면만 쓰고 광고는 넣지 않는다.
- 교차 색인
  - US 스토어는 en-US 외에 es-MX, fr, ko, pt-BR, zh-Hans, zh-Hant, ru, vi, ar 메타데이터도 색인한다. 그래서 ru·vi는 현지어 대신 **미국용 영어 키워드**로 채운다(러시아는 AdMob 광고 정지, 베트남은 기본 언어가 en-GB).
  - en-GB는 미국에서는 색인되지 않지만 약 20개 스토어의 기본 언어다.
- 이름 표기: 한국 이름은 "더스크윅"(철자 피드백 반영). 나머지 로캘은 영문 Duskwick을 쓴다.
- 현지어 문구는 원어민 검토가 필요하다.

| 로캘 | 이름 (≤30) | 부제 (≤30) | 키워드 (≤100) |
|---|---|---|---|
| en-US | `Duskwick: Lantern Logic Puzzle` (30) | `Calm & Cozy Daily Brain Games` (29) | `puzzles,relaxing,village,decorate,cute,friends,teaser,adults,offline,wifi,no,light,grid,zen,riddle` (98) |
| en-GB | `Duskwick: Lantern Logic Puzzle` (30) | `Calm & Cosy Daily Brain Games` (29) | `puzzles,cozy,village,decorate,cute,friends,relaxing,teaser,adults,offline,wifi,no,light,grid,zen,iq` (99) |
| en-AU | `Duskwick: Lantern Logic Puzzle` (30) | `Cosy Village & Daily Puzzles` (28) | `brain,games,calm,relax,decorate,cute,friends,teaser,adults,offline,wifi,no,light,grid,zen,iq` (92) |
| en-CA | `Duskwick: Lantern Logic Puzzle` (30) | `Cozy Village & Daily Puzzles` (28) | `brain,games,calm,relax,decorate,cute,friends,teaser,adults,offline,wifi,no,light,grid,zen,iq` (92) |
| ru (US English) | `Duskwick: Lantern Logic Puzzle` (30) | `Calm & Cozy Daily Brain Games` (29) | `peaceful,unwind,gentle,glow,lanterns,lamps,cottage,room,letters,gifts,spirit,mascot,wick,dusk` (93) |
| vi (US English) | `Duskwick: Lantern Logic Puzzle` (30) | `Calm & Cozy Daily Brain Games` (29) | `logical,thinking,training,challenge,solve,tiles,board,lit,lights,neighbors,town,furniture,home` (94) |
| de-DE | `Duskwick: Laternen-Logikrätsel` (30) | `Tägliches Rätsel & Denkspiele` (29) | `gehirnjogging,logik,spiele,dorf,einrichten,niedlich,offline,ohne,internet,entspannend,knobeln,licht` (99) |
| fr-FR | `Duskwick: Casse-tête logique` (28) | `Lanternes & jeux de réflexion` (29) | `énigme,cerveau,quotidien,village,décorer,mignon,détente,relaxant,zen,sans,wifi,internet,lumière,défi` (100) |
| fr-CA | `Duskwick: Casse-tête logique` (28) | `Lanternes, énigme du jour` (25) | `jeux,réflexion,cerveau,quotidien,village,décorer,mignon,détente,relaxant,sans,wifi,lumière,défi` (95) |
| ja | `Duskwick: 脳トレ ロジックパズル` (21) | `灯りをともす毎日の癒しゲーム` (14) | `頭の体操,パズルゲーム,ランタン,村,箱庭,模様替え,かわいい,推理,論理,暇つぶし,オフライン,無料,大人,デイリー,パズル,灯り,ひらめき,ロジック` (76) |
| ko | `더스크윅: 등불 로직 퍼즐` (14) | `매일 하는 귀여운 두뇌 게임` (15) | `Duskwick,논리,두뇌퍼즐,로직퍼즐,퍼즐게임,힐링,마을,꾸미기,방꾸미기,오프라인,와이파이,무료,랜턴,추리,브레인,집중력,데일리,캐릭터,아이큐` (80) |
| es-ES | `Duskwick: Juegos de lógica` (26) | `Puzle diario, zen y relajante` (29) | `rompecabezas,acertijos,mentales,cerebro,pueblo,decorar,sin,internet,wifi,offline,faroles,luz,reto` (97) |
| es-MX | `Duskwick: Juegos de lógica` (26) | `Rompecabezas mental diario` (26) | `acertijos,mentales,cerebro,pueblo,decorar,lindo,sin,internet,wifi,offline,relajante,zen,faroles,luz` (99) |
| pt-BR | `Duskwick: Jogos de Lógica` (25) | `Quebra-cabeça diário relaxante` (30) | `raciocínio,mente,cérebro,vila,decorar,fofo,offline,sem,internet,wifi,luz,calmo,zen,desafio,enigma` (97) |
| it | `Duskwick: Giochi di logica` (26) | `Rompicapo zen ogni giorno` (25) | `enigmistica,mente,cervello,borgo,arredare,carino,senza,internet,offline,rilassanti,lanterna,luce` (96) |
| zh-Hant | `Duskwick: 點燈邏輯益智遊戲` (18) | `每天一題的療癒動腦小遊戲` (12) | `燈籠,解謎,腦力,燒腦,推理,小鎮,佈置,裝飾,可愛,單機,離線,免費,休閒,紓壓,思考,謎題,邏輯遊戲,動腦遊戲,點燈解謎,益智解謎` (67) |
| zh-Hans | `Duskwick: 点灯逻辑益智游戏` (18) | `每天一题的治愈动脑小游戏` (12) | `灯笼,解谜,脑力,烧脑,推理,小镇,布置,装饰,可爱,单机,离线,免费,休闲,解压,思考,谜题,逻辑游戏,动脑游戏,点灯解谜,益智解谜` (67) |

- **메타데이터만 현지화**(앱 안 문자열 없음): ar, nl, sv, th, pl, id, tr, pt-PT. 설명 첫 줄에 "게임 안 글자는 적고 영어로 나온다"를 적는다. 문구는 1.0 제출 직전에 만든다.
- 정식 마을(주민 7명, 장터, 부탁, 시간대·계절)이 들어가면 부제를 다시 검토한다. 후보: `Cozy Village Daily Brain Games`(30자). 키워드에는 market, seasons 계열을 추가한다(`playtest/store/README.md` "바뀔 샷" 참고).

### 5-1. 스크린샷 (6.9″ 1320×2868, 실제 빌드에서 캡처)
- 위치: `docs/store/screenshots/<locale>/01–08.png` 와 `contact.png`.
- 지금은 en-US 초안만 있다. 정식 마을 기능이 들어간 뒤 10개 로캘을 한 번에 다시 만든다:
  - 명령: `playtest/store/make-store.sh all --size 6.9`
  - 캡션 원문: `playtest/store/captions.json`
- 순서
  1. 등불마다 작은 친구(풀이 장면)
  2. 규칙 3컷
  3. 엽서·연속 기록
  4. 마을
  5. 오두막 꾸미기
  6. 편지·선물
  7. 오늘의 퍼즐
  8. 차분함·오프라인·설정(점 숫자)
- 캡션 사실 확인
  - 화면 타이머는 없지만 결과에 시간이 표시되므로 "No timer" 대신 "No rush"라고 쓴다.
  - "Wick shows the way" 같은 기능 과장은 쓰지 않는다.

## 6. 개인정보처리방침 (영어, `https://humsleep.github.io/duskwick/privacy`에 게시)

GitHub Pages라면 `humsleep.github.io` 저장소에 `duskwick/privacy.md`(또는 `.html`)로 올린다. `[ ]`를 채운다.

```markdown
# Duskwick Privacy Policy

Last updated: [2026-10-__]

Duskwick ("the app") is a puzzle game made by [Developer name] ("we"). This policy explains what data is
used when you play and the choices you have. Contact: [contact email].

## What we collect
We do not collect personal data ourselves. Duskwick has no accounts, no sign-in, no analytics of our own,
and no servers of ours. Your puzzles, progress and settings are stored on your device.

## iCloud
If you are signed in to iCloud, the app keeps a copy of your progress and settings in your own iCloud
key-value storage so it can restore them on your other devices or after reinstalling. This data is stored
by Apple in your iCloud account; we cannot access it. You can delete it in Settings > [your name] >
iCloud > Manage Account Storage > Duskwick.

## Advertising (Google AdMob)
The app is free and shows ads from Google AdMob. To show and measure ads, the Google Mobile Ads SDK
and Google's User Messaging Platform may collect and process, under Google's own policies:
- device identifiers (the advertising identifier (IDFA) only if you allow tracking, and an identifier
  for this app or developer),
- approximate (coarse) location derived from your IP address,
- interactions with ads and the app (for example ad views, taps, app launches),
- advertising data (the ads you have seen),
- diagnostics (performance data, crash data).
Google may use this data to deliver, personalize (only where you have allowed it) and measure ads, and
to prevent fraud. Learn more: https://policies.google.com/technologies/partner-sites and
https://policies.google.com/privacy.

## Your choices
- Tracking: iOS asks once whether Duskwick may track you (App Tracking Transparency). If you choose
  "Ask App Not to Track", the advertising identifier is not shared and you see non-personalized or less
  relevant ads. The game plays exactly the same. You can change this at any time in Settings > Privacy &
  Security > Tracking.
- EEA, UK and Switzerland: Google's consent form asks for your choices before personalized ads are
  shown. You can change them later in the app: gear (top left) > "Privacy choices".
- Notifications: the optional daily reminder is a local notification created on your device. It is off
  unless you turn it on, and you can turn it off in the app's settings or in iOS Settings.

## Children
Duskwick is a general-audience game and is not directed to children under 13. We do not knowingly
collect personal information from children.

## Retention and deletion
We hold no data about you. Deleting the app removes the data on your device; iCloud data can be deleted
as described above. For data processed by Google, see Google's privacy policy and controls.

## Changes
We will post any changes on this page and update the date above.

## Contact
[Developer name] — [contact email]
```

## 6-1. 지원 페이지 (영어, `https://humsleep.github.io/duskwick/support`)

ASC 규정상 지원 URL에는 **실제 연락처**가 있어야 한다.

```markdown
# Duskwick Support

Questions, bugs or ideas? Email [contact email] — we usually reply within a few days.
Please include your iPhone model, iOS version and, if possible, a screenshot.

**Progress on a new iPhone:** sign in to the same Apple Account with iCloud on, open Duskwick and wait
a moment on the first puzzle — your progress returns from iCloud. No account is needed.

**Ads:** Duskwick never shows ads during a puzzle or in the Daily. After the day's second ad you may be
offered an optional short video for 30 minutes without ads.

**Tracking and privacy:** see the [Privacy Policy](https://humsleep.github.io/duskwick/privacy).

**Daily reminder:** turn it on or off in the game (gear, top left) or in iOS Settings > Notifications > Duskwick.
```

app-ads.txt(`https://humsleep.github.io/app-ads.txt`, 도메인 **루트**):
```
google.com, pub-[16자리 퍼블리셔 번호], DIRECT, f08c47fec0942fa0
```

## 7. 접근성 영양 라벨 (선택, 아직 의무 아님)

위치: ASC → 앱 → Accessibility. 기기에서 "주요 작업을 그 기능만으로 모두 할 수 있는지" 확인한 항목만 표시한다.

| 기능 | 지금 표시 | 근거 |
| --- | --- | --- |
| Dark Interface | **표시 가능** | 앱 전체가 어두운 화면이고 밝은 번쩍임이 없다 |
| Reduced Motion | 기기 확인 뒤 표시 | iOS "동작 줄이기"를 따른다(`src/game/motion.ts`) |
| VoiceOver | 기기 확인 뒤 표시 | 모든 컨트롤과 판 격자에 라벨이 있다. VoiceOver만으로 데일리 한 판과 설정을 끝까지 해 본 뒤에 표시한다 |
| Differentiate Without Color Alone | 확인 뒤 | 등불, 빛, 숫자 돌은 모양으로 구분된다. 충돌 표시가 색에만 의존하지 않는지 확인한다 |
| Sufficient Contrast | 아직 아님 | 측정한 대비 값이 없다 |
| Larger Text | **표시하지 않음** | 캡션 배율 상한 1.35×(200% 미만) |
| Voice Control | 표시하지 않음 | 시험하지 않았다 |
| Captions / Audio Descriptions | 해당 없음 | 영상이나 대사 콘텐츠가 없다(광고는 제외 대상) |

## 8. 배포 지역과 법적 항목

- **EU 디지털서비스법(DSA) 판매자 상태**: ASC → Business(또는 앱의 App Information)에서 trader / non-trader를 신고해야 EU 스토어에 나온다.
  - 광고 수익을 내면 보통 **trader**로 본다.
  - trader는 주소, 전화, 이메일이 EU 스토어에 공개된다.
  - 공개하기 싫으면 처음에는 EU 국가를 배포에서 빼는 선택지도 있다. 사용자가 결정한다.
- **중국 본토**: 게임은 판호(ISBN)가 필요하다. Pricing and Availability에서 China mainland를 **빼야** 한다.
- 한국: Apple 연령 등급으로 충분하다(별도 조치 없음).

## 9. 사용자 할 일 (순서대로)

1. AdMob 계정에서 앱과 광고 단위(전면 1, 보상형 1)를 만들고 GDPR 메시지를 게시한다. 고참여 광고를 끄고 빈도 상한을 하루 10회로 둔다(preflight §A).
2. 실제 ID를 `src/ads/config.ts`와 `Info.plist`에 넣고 `testing: false` → `npm --prefix apps/client run ios:release-check`가 녹색인지 확인한다. 본인 iPhone을 AdMob 테스트 기기로 등록한다.
3. GitHub Pages(`humsleep.github.io` 저장소)에 `duskwick/privacy`, `duskwick/support`, 루트 `app-ads.txt`를 게시한다. `[ ]`를 채운다. 앱 설정 시트의 링크가 열리는지 확인한다.
4. 연령 등급: §1대로 입력하고 "Override to Higher → 9+"를 고른다.
5. 실기기에서 마지막 확인을 한다.
   - 10분 소크
   - 무음 스위치를 켠 상태의 광고 소리
   - iPad 시뮬레이터에서 설정, 마을, 회전
   - 새로 설치한 앱으로 ATT까지 가는 화면 녹화(§4 첨부용)
6. ASC에 앱 레코드를 만든다(번들 `com.humsleep.duskwick`, 이름 Duskwick, SKU 아무 값). App Information(카테고리, 연령 등급, Content Rights), App Privacy(§2), Pricing(무료, 중국 본토 제외), DSA 신고(§8)를 입력한다.
7. 버전 1.0 페이지를 채운다: 6.9″ iPhone 스크린샷, 부제와 키워드(§5), 설명, Support URL과 Marketing URL, 심사 메모(§4)와 녹화 첨부, 로그인 불필요.
8. `npm --prefix apps/client run ios:archive -- --marketing 1.0` → Xcode Organizer → Distribute App → App Store Connect → 빌드를 선택하고 심사에 제출한다.
9. (선택) 접근성 영양 라벨(§7)은 기기에서 확인한 항목만 표시한다.
