# i18n QA (역번역) — 진행 기록

방법: 로캘마다 영어 원문을 보지 않는 서브 에이전트가 498개 문자열(UI·VoiceOver·튜토리얼·오류·광고 카드·알림·ATT·마을 UI·마을 대사 195·스토어 캡션·메타데이터)을 영어로 역번역하고 문제를 표시했다. 그다음 영어 원문·용어집과 대조해 실제 문제만 고쳤다.
추출·검증 스크립트는 scratchpad(`qa/`)에 있다: 고친 뒤 소스를 다시 추출해 의도한 값과 한 글자도 다르지 않은지 확인했다(부수 변경 0).
공통 발견(전 로캘): 광고 쉬기 라벨이 "동영상"이라고 말함(en 포함) → "광고"로 통일. 수량 표현의 단·복수("1 días") → 숫자 뒤로 보냄.

## fr — 완료
- 비분리 공백(U+00A0): UI 문자열이 일반 공백이어서 `?` `!` `:`가 줄 맨 앞으로 갈 수 있었다(마을 대사 JSON은 이미 NBSP). 소스에서 ` `로 통일 (30곳).
- 존댓말 통일: UI = vous. 마을 UI 라벨에 tu가 섞여 있었다(Ta cabane, Choisis-en un, à toi, ma cabane) → vous. 주민 대사는 tu 유지(친구).
- "Un petit ami dans chaque lanterne"(스토어 캡션) = "남자친구/여자친구"로 읽힘 → "petit compagnon".
- 서로 안 맞던 것: "Les lanternes ne s'éclairent pas entre elles"(서술) → "ne peuvent pas s'éclairer"(금지), 모서리 "coins" → "diagonales", "Temps partagé"(함께 보낸 시간) → "Temps inclus", "Rappel du jour" → "Rappel quotidien", "Lettre de bon retour" → "Lettre de Wick pour votre retour", "le mettre ici"(성 일치) → "placer ici", "pas les pierres" → "pas sur les pierres", Couronne → Couronne de fleurs.
- 대사: "Il fait son intéressant"(빈정) → "Il se fait beau", "tombé de la nuit" → "tombé du ciel cette nuit".

## ja — 완료
- 村/町 혼용 → 村로 통일(HUD 캡션, 거리, 튜토리얼 끝). 전각 문장부호: `?` `:` → `？` `：`.
- "やり直す"(redo로 읽힘, 되돌리기와 반대) → "最初から". "共有に時間"(암호 같음) → "タイムも共有". "点で表示" → "ドットで表示"(스토어와 같게). 個/こ 통일.
- ATT: "あなたにより関連性の高い広告"(번역투) → "あなたに合った広告", 라틴 글자 앞뒤 공백 제거.
- 대사: "今日からここのものです"(누구의 것인지 모호) → "あなたのもの", "お名前をもらいました"(별이 이름을 받음?) → "お名前を借りました", Momo 반말 한 곳을 です・ます로.
- 스토어 이름 "脳トレ"(상표 가능성·톤) 제거는 docs/app-store-connect-pack.md 표에서 처리.

## de — 완료
- "Haptik" ↔ "Vibration" 혼용 → Vibration. "Morgen"(내일로 읽힘) → "Guten Morgen". "Wärmer"(없는 단어) → "Strickmütze". "Das war der Brief" → "Das ist der Brief". "Ihr Licht"(Ihr = 존칭 소유격으로 읽힘) → "Das Licht". 탭 "Sitzen"(동사) → "Sitze". "Punkte statt Zahlen"(점수로 읽힘) → "Zahlen als Punkte". 복수("1 Tage") 회피 구조. "meine Hütte" → "deine Hütte".

## es — 완료
- 모호: "Dos faroles se iluminan"(둘이 켜짐) → "…entre sí", "no pasa nada"(아무 일 없음?) → "no hay problema", "quitando hierbas"(허브를 뽑음) → "malas hierbas".
- 스페인/중남미 중립: "Portarretrato" → "Marco de fotos", "Canasta" → "Cesta", "Bola de nieve"(눈덩이) → "Globo de nieve", "Silla de arco" → "Silla arqueada", "Corona" → "Corona decorativa".
- 복수 구조 회피: "Quedan 1", "1 días" → 숫자 뒤로.

## pt-BR — 완료
- "Demais!"(칭찬으로 들림, 오류 문구) → "Lanternas demais!". "cantos"(모서리) → "diagonais". 성별 일치: 칸 "escura/iluminada" → "escuro/iluminado". "faltam 1" → "faltando {k}".
- 광고 라벨 "vídeo" → "anúncio". "minha cabana" → "sua cabana". "Chega no pote" → "Chega quando o pote de luzes enche".
- 남긴 것: 대사의 tu형 명령(Senta, Olha, Toma)은 브라질 구어에서 흔해서 그대로(저위험).

## it — 완료
- 성별 일치가 깨지는 곳: "è già tuo", "Mettilo", "spostalo"(여성 명사 아이템 앞) → "ce l'hai già", "Metti", "sposta". 편지의 "è caduto / Trovato / fresco"는 "qualcosa / questo"로 성 중립.
- "Palla di neve"(눈덩이) → "Globo di neve". "Facce delle lanterne" → "Faccine delle lanterne". 광고 카드 본문의 어색한 콜론 → 쉼표. ATT "in Impostazioni" → "nelle Impostazioni". 캡션 "L'Enigma"의 대문자 제거. "La bancarella apre dopo una lanterna accesa oggi" → "appena accendi una lanterna oggi".
- 편지에서 쉼표 뒤 소문자 규칙 유지.

## ko — 완료
- "영상" → "광고"(광고 쉬기 라벨), "당신 차례" → "해 볼 차례"(당신 금지 규칙 위반이 1곳 남아 있었다), "치움" → "뺌"(용어집: 빼다), "이 {n}"(소리 내어 읽으면 "이 이") → "{n} 숫자", "앉을 것" → "앉을 자리", "나머지도 또 와요"(이웃이 또 온다는 뜻으로 읽힘) → "나머지는 다음에 또 나와요", "잊은 목도리" → "잊고 있던 목도리". 광고 불가 문구를 "볼 수 있는 광고가 없어요"로(광고가 없다는 좋은 소식으로 읽힘).
- ATT는 합쇼체 그대로(Apple 한국어 권한 문구 관례, 보수적). e2e village.spec의 ko 라벨 기대값도 같이 고침.

## zh-Hans / zh-Hant — 완료
- Wick: 일부(튜토리얼 "点 Wick", 엽서 라벨)만 라틴 글자였다 → 小烛/小燭로 통일. "臭美"(북방 구어, 약간 부정) → "打扮自己". "没用提示/沒用提示"("쓸모없는 힌트"로 읽힘) → "未使用提示". "去玩"(명령조) → "开始玩/開始玩". "＝"(전각 등호) → "表示". "你们小镇" → "这座小镇". "放不够灯笼"(모호) → "没有足够的空位放灯笼". 랜턴 병 "{have}/{size}"(읽으면 슬래시) → "{size} 个里有 {have} 个".
- 번체: "小夥伴"(대륙 느낌) → "好朋友", "分享附時間" → "分享含時間", "歡迎回來信"(네 글자 합성) → "「歡迎回來」信", 키워드 "佈置" → "布置". 이름의 반각 콜론 → 전각 "：". 스토어 "沒有體力"(스태미나) → "沒有體力限制".
- ATT 간체: "不允许也不会影响"(두 번 부정으로 오해) → "即使你选择不允许，…玩法也完全一样".

## 확인
typecheck:all OK · client vitest 543/543 · e2e i18n + village(G3 포함) chromium 20/20, webkit 20/20(E2E_PORT 4871, 내 PID만 종료) · `playtest/i18n/fit.mjs` 1740건 중 초과 3건(전부 기존: fr "Politique de confidentialité", pt-BR "Tempo ao compartilhar") · 편지 글꼴 서브셋 재생성(ja·ko·latin·zh) · `village-lines.mjs --check` 최신 · release-gates OK.
