# PlantEye 에이전트 전달용 파일

이 폴더는 기존 `404-main` 프로젝트에 복사해 넣을 에이전트 구현 파일입니다.
현재 원본 프로젝트(`데이터분석/404-main`)는 그대로 보존되어 있습니다.

## 받는 사람이 복사할 위치

이 폴더 안의 내용을 받은 사람의 `404` 또는 `404-main` 프로젝트 폴더에 그대로 복사합니다.

- `server/` → 프로젝트 루트의 `server/`에 복사
- `src/components/alerts/AgentPanel.tsx` → `src/components/alerts/`에 복사
- `src/pages/AlertsPage.tsx` → `src/pages/`에 덮어쓰기
- `src/styles/pages.css` → `src/styles/`에 덮어쓰기

`AlertsPage.tsx`와 `pages.css`는 AI 점검 패널 연결 코드가 포함된 버전입니다.

## 실행 순서

### 1. 프런트 프로젝트에서 서버 실행

```powershell
cd server
$env:OPENAI_API_KEY = "나중에 발급받은 키"
$env:OPENAI_MODEL = "gpt-4o-mini"
node src/server.ts
```

API 키를 아직 넣지 않아도 도구 코드는 실행할 수 있습니다.

```powershell
node src/verifyTools.ts
```

### 2. React 화면 실행

React 프로젝트 루트에서 기존 방식대로 실행합니다.

```powershell
npm run dev
```

현재 PowerShell에서 npm 실행이 차단되면 `npm.cmd run dev`를 사용합니다.

## 주의사항

- API 키는 이 전달용 폴더에 넣지 않습니다.
- `.env.example`은 설정 예시일 뿐 실제 키가 없습니다.
- 현재 사례 ID와 설비 ID 대응표는 데모용입니다.
- 실제 데이터를 연결하기 전에 화면 담당자와 사례 ID·설비 ID 대응표를 확정해야 합니다.
- `server/prompt.txt`는 시스템 프롬프트입니다.
