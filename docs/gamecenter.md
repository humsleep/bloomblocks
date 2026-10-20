# Game Center 순위표 설정 (오너, App Store Connect)

앱 코드는 들어가 있다(`apps/client/src/game/ranking.ts`, `ios/App/App/GameCenter.swift`). 아래 순위표를 App Store Connect에 만들어야 실제로 동작한다. 만들기 전에는 트로피를 눌러도 Apple 화면에 순위가 비어 있을 뿐, 앱은 문제없이 돈다.

## 1. 앱에 Game Center 켜기

1. App Store Connect → 앱 → 서비스(또는 "기능") → **Game Center**.
2. 1.0이 이미 심사 중이면, 다음 버전(1.1)의 버전 페이지에서 **Game Center** 항목을 켠다.
3. 아래 순위표 3개를 그 버전에 추가한다.

## 2. 순위표 3개 (ID가 코드와 정확히 같아야 한다)

| 참조 이름 | 순위표 ID | 종류 | 점수 형식 | 정렬 | 비고 |
| --- | --- | --- | --- | --- | --- |
| Today's fastest | `duskwick.daily.time` | **반복(Recurring)**, 기간 1일, 시작 UTC 00:00 | 경과 시간, 1/100초 단위 | 낮은 점수가 높은 순위 | 힌트 없이 푼 오늘 퍼즐만 보낸다 |
| Best streak | `duskwick.streak.best` | 클래식 | 정수 | 높은 점수가 높은 순위 | 데일리 최장 연속 기록 |
| Puzzles solved | `duskwick.puzzles.solved` | 클래식 | 정수 | 높은 점수가 높은 순위 | 거리 + 탑에서 푼 판 수 |

- **현지화**: 각 순위표에 표시 이름을 최소 영어·한국어로 넣는다(예: "오늘의 최단 기록", "최장 연속 기록", "푼 퍼즐"). 다른 언어는 없으면 영어로 보인다.
- **반복 순위표를 UTC로 하는 이유**
  - Game Center 반복 순위표는 UTC 하루 단위로 돈다.
  - 앱은 퍼즐 날짜가 UTC 날짜와 같을 때만 기록을 보낸다. 그래서 한 순위표에 있는 사람은 모두 같은 퍼즐을 푼 사람이다.
  - 대가: 한국에서 오전 9시 전에 푼 기록은 오늘 순위표에 올라가지 않는다(UTC로는 아직 어제).

## 3. 동작 정리

- **처음**: 플레이어가 데일리 결과 시트의 "🏆 순위"를 누른다 → Apple 로그인 시트(이미 로그인돼 있으면 생략) → 오늘 순위표가 열린다.
- **이후**
  - 실행할 때 조용히 다시 로그인한다(Apple의 "다시 오신 것을 환영합니다" 배너).
  - 데일리를 풀면 기록이 자동으로 올라간다.
  - 켜지 않은 사람에게는 앱 실행 때 아무 일도 일어나지 않는다.
- **퍼즐 화면에는 시계를 보여 주지 않는다**("서두르지 않는" 약속 유지). 시간은 결과 시트와 순위표에만 나온다.
- **개인정보 라벨**: Game Center 데이터는 Apple이 처리하므로 App Privacy 항목은 바뀌지 않는다(Apple 안내 기준). 심사 메모에 "Rankings are opt-in Game Center leaderboards from the daily result sheet" 한 줄을 추가한다.

## 4. 확인하지 않은 것

- 실기기에서의 Game Center 로그인·제출·화면 열기. ASC에 순위표를 만든 뒤 TestFlight로 확인한다(TestFlight는 샌드박스 Game Center를 쓴다).
