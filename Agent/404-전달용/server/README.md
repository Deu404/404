# PlantEye 에이전트 서버

React 대시보드가 호출하는 TypeScript/Node 백엔드입니다. 현재는 Node 기본 `fetch`와 `http` 모듈만 사용하므로 OpenAI SDK 또는 npm 설치 없이 코드 구조를 확인할 수 있습니다.

## 실행

PowerShell 실행 정책으로 `npm`이 막혀 있어도 아래 명령은 동작합니다.

```powershell
cd "c:\Users\samsung\Desktop\데이터분석\404-main\server"
$env:OPENAI_API_KEY = "나중에_발급받은_키"
$env:OPENAI_MODEL = "gpt-4o-mini"
node src/server.ts
```

서버 주소는 `http://localhost:8787`이며 React 화면의 `AgentPanel`이 `POST /api/agent`를 호출합니다.

API 키가 없는 상태에서는 도구 단독 검증만 실행할 수 있습니다.

```powershell
node src/verifyTools.ts
```

실제 키는 코드, 브라우저, `VITE_` 변수, Git에 넣지 않습니다. 키 설정 전에는 `/api/agent` 요청이 `OPENAI_API_KEY가 설정되지 않았습니다` 오류를 반환하는 것이 정상입니다.
