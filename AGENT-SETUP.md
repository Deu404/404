# 에이전트 업데이트 실행 안내

Node.js 24 이상에서 프로젝트 루트에서 실행합니다.

```powershell
npm ci
Copy-Item .env.example .env.local
Copy-Item server/.env.example server/.env
```

`server/.env`의 `OPENAI_API_KEY=` 뒤에 본인의 API 키를 입력한 후 실행합니다.

```powershell
npm run dev:all
```

- 실제 모델 결과 화면: http://127.0.0.1:5173/alerts
- 연습용 에이전트: http://127.0.0.1:5173/agent-demo
- 포함된 `public/anomaly-results.json`은 원본 프로젝트의 저장된 모델 결과 10건입니다. 실시간 결과가 아닙니다.
- 측정값과 설비별 기준이 없는 모델 결과는 우선순위를 확정하지 않습니다.
- 키가 없으면 룰 안내를 표시하며, AI 설명에는 본인의 API 키가 필요합니다.
- `.env`, `.env.local`, `server/.env`는 GitHub에 올리지 않습니다.
- GitHub에 소스를 올리는 것만으로 API 서버가 배포되지는 않습니다. 현재 연결은 로컬 개발 서버 기준입니다.

검증 명령:

```powershell
npm run test:decision
npm run lint
npm run build -- --configLoader runner
```
