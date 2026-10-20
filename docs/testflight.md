# TestFlight 빌드와 테스트

## 올리기

```sh
cd apps/client && npm run ios:testflight
```

- 실행 순서: 출시 게이트 → 빌드 번호 +1 → M1 웹 빌드 → cap sync → Release 아카이브 → App Store Connect 업로드.
- 서명: Xcode에 로그인된 Apple ID로 자동 서명한다.
- 처리 시간: 5–30분 뒤 TestFlight에 나타난다.
- 수출 규정: 처음 한 번은 ASC에서 "암호화 사용: 면제(표준 HTTPS만)"를 답해야 내부 테스터에게 열린다.

## What to Test (ASC에 붙여 넣을 문구, en)

```
Thanks for testing Duskwick!
- First launch: the lantern intro, then the first lesson. Does anything feel slow or stuck?
- Solve a few boards, try Today's puzzle, open the Village and your cottage.
- Share a postcard and open the link.
- Tell us about any crash, freeze, or text that is cut off or overlaps.
```

## 오너가 실기기로 닫을 출시 게이트

r3-critique-reality P1-3·P1-4와 review-readiness R5·R6·R8에 해당한다.

1. **콜드 스타트**
   - 앱을 완전히 종료하고 10번 연다.
   - 기준: 인트로 뒤 판이 바로 손에 잡힌다. 인트로를 탭하면 즉시 넘어간다.
2. **메모리 소크** (가능하면 iPhone XS/11/SE 2–3 같은 3 GB 기기)
   - 퍼즐 ↔ 마을 ↔ 방 ↔ 서랍 ↔ 엽서를 20번 왕복한 뒤 10분 둔다.
   - 기준: 튕김 0, 화면 하얘짐 0.
3. **ATT**
   - 첫 판을 풀고 "Next house"를 누르면 추적 허용 요청이 뜬다.
   - 이때 "Tap Allow" 같은 유도 문구가 없어야 한다.
   - 이 흐름을 다시 녹화해 `docs/store/review/att-flow.mp4`를 바꾼다.
4. **iPad** (있으면): 마을 → 방 → 서랍 → 엽서 → 설정 → 방침 링크를 확인한다.
5. **아이콘**
   - 홈 화면에 Wick(얼굴 등불) 아이콘이 보인다.
   - 판 아이콘은 PPO 대체 아이콘으로 바이너리에 남아 있다.
