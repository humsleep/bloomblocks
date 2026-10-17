# puzzle-lab

1인 개발 모바일 퍼즐 프로토타입의 결정론적 TypeScript 코어. 게임 규칙의 정본이며 클라이언트, 서버 재생 검증(Cloudflare Workers), 봇 시뮬레이터, 웹 데일리가 같은 규칙을 공유한다.

- 순수 TypeScript, DOM·Node API 없음, 정수 연산만
- 시드: `sha256(utf8(key))` 앞 128비트 → xoshiro128**
- 저장/재생: `run.bin` (32바이트 헤더 + 수 로그 + CRC-32), 형식은 [docs/runlog-format.md](docs/runlog-format.md)
- 첫 게임: `games/lanterns` (등불 정원 규칙)
- 다른 언어 포트는 `fixtures/`의 골든 픽스처를 바이트 단위로 통과해야 한다

## 시작

```sh
npm install
npm run typecheck
npm test
npm run sim                 # 결과: sim/out/*.json
```

작업 규칙은 [CLAUDE.md](CLAUDE.md)를 본다.
