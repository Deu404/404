# PlantEye 에이전트 최신 전달용 변경 묶음

기준일: 2026-10-16. 이 폴더가 담당자에게 전달할 최신본입니다.

**단독 실행용 전체 프로젝트가 아닙니다.** 최신 대시보드 프로젝트에 에이전트 관련 파일을 합치기 위한 변경 파일 묶음입니다. `node_modules`, `dist`, 실제 `.env`, 대용량 원본 CSV는 포함하지 않습니다.

## 처음 받은 사람이 할 일 · 자동 적용

1. ZIP을 압축 해제합니다. Node.js 24 이상이 설치되어 있어야 합니다.
2. **`APPLY-AND-RUN.cmd`를 더블클릭**합니다.
3. 기존 대시보드 프로젝트의 폴더 경로를 입력하고 Enter를 누릅니다. `index.html`과 `package.json`이 있는 폴더이며 이 전달 폴더를 선택하면 안 됩니다.
4. 기존 파일 백업 → 에이전트 반영 → npm 설치 → 화면·서버 실행이 이어집니다.
5. `http://localhost:5173/agent-demo`로 접속합니다. 검은 터미널 창은 실행 중 닫지 마세요. 종료는 Ctrl+C입니다.

이 방법을 사용하면 아래 수동 병합 과정은 생략할 수 있습니다. 다만 상대방이 따로 수정한 파일이 있으면 덮어쓰지 않고 충돌 목록을 출력하며 중단합니다. 모든 과거 프로젝트에 무조건 적용하는 도구는 아니며, 제공받은 최신 대시보드와 확인된 개발 버전을 대상으로 합니다.

- 기존 `server/.env`, 대용량 CSV, 별도 데이터와 의존성 목록은 유지합니다.
- 변경 전 파일은 대상 프로젝트의 `.agent-backups`에 저장합니다.
- `package.json`은 에이전트 실행·검증 스크립트만 추가합니다. 기존 사용자 스크립트와 의존성 목록을 유지합니다.
- 적용 중 파일 쓰기가 실패하면 적용한 파일을 복구합니다. 설치 또는 실행이 실패한 경우 적용 파일은 남아 있으며 환경 문제를 해결한 뒤 재실행할 수 있습니다.
- AI 키가 없어도 판정 카드와 보고 문구를 사용할 수 있습니다. 실제 AI 설명은 서버에 별도로 키를 설정해야 합니다.

터미널에서 사전 검사만 하거나 실행 없이 적용할 수도 있습니다.

```powershell
node scripts/apply-agent.mjs --target "기존_프로젝트_경로" --check
node scripts/apply-agent.mjs --target "기존_프로젝트_경로" --apply-only
```

## 달라진 점

- 이상 유형·우선순위·행동·보고 조건은 공통 룰 함수가 결정하고 AI는 결과를 쉽게 설명합니다.
- 첫 화면에 핵심 판정·필수 주의사항·보고 조건을 표시하고 상세 근거는 접어서 확인합니다.
- 보고 문구는 같은 판정 결과에서 코드로 만듭니다. 자동 보고 전송은 하지 않습니다.
- 실제 모델 결과에 수치·단위가 없으면 '확인 필요'로 표시합니다. 다른 설비의 데모 사례로 대체하지 않습니다.
- 최신 실제 데이터 화면(`/alerts`)과 기존 에이전트 데모(`/agent-demo`)를 구분했습니다.
- AI 연결이 실패해도 판정·보고 안내는 유지됩니다.

## 적용 대상

이번에 업데이트한 **실제 CSV/API 기반 최신 대시보드 버전**을 기준으로 합니다. 과거 목업 중심 프로젝트에 무조건 덮어쓰면 안 됩니다.

1. 담당자의 기존 프로젝트를 백업합니다.
2. 이 폴더와 대상 프로젝트의 같은 경로를 비교합니다.
3. 아래 '반드시 함께 반영할 파일'을 함께 적용합니다.
4. 화면·설정 파일은 담당자가 추가로 수정한 부분을 유지하며 병합합니다.
5. 아래 검증 명령을 대상 프로젝트 루트에서 실행합니다.

## 반드시 함께 반영할 파일

| 묶음 | 경로 |
| --- | --- |
| 공통 판정·가이드 | `src/shared/*` |
| 에이전트 서버 | `server/src/*`, `server/src/fixtures/*`, `server/prompt.txt`, `server/tsconfig.json` |
| 에이전트 화면 | `src/components/alerts/AgentPanel.tsx`, `DecisionCard.tsx` |
| 모델·데모 연결 | `src/pages/AlertsPage.tsx`, `AgentDemoPage.tsx`, `src/services/demoAgentService.ts`, `src/App.tsx` |
| 목록과 판정 일치 | `src/services/alertRules.ts`, `alertService.ts`, `src/types/alert.ts`, `src/config/equipmentDataMap.ts` |
| 데모 입력 | `src/mocks/mockAlerts.ts` |
| 화면 스타일 | `src/styles/pages.css` |

서버가 `src/shared`를 가져오므로 `server`만 복사하면 실행되지 않습니다. 실제 CSV/API 어댑터·기타 화면·공통 타입은 기존 최신 대시보드에서 제공되어야 합니다.

## 비교 후 병합할 설정

- `package.json`: 기존 의존성과 기능을 유지하며 `agent`, `test:agent`, `test:decision`, `test:agent-integration` 스크립트를 반영합니다. 포함된 package.json·lock은 현재 작업본의 참고 스냅샷입니다. 대상 의존성이 다르면 lock을 임의로 덮지 말고 병합한 package.json으로 다시 설치합니다.
- `tsconfig.app.json`: `allowImportingTsExtensions: true`를 유지합니다.
- `src/App.tsx`: `/agent-demo` 라우트와 import를 추가합니다. 최신 나머지 라우트는 유지합니다.
- `src/pages/AlertsPage.tsx`: 실제 모델 입력을 `anomaly`로 전달하고 알림 변경 시 패널이 초기화되도록 key를 유지합니다.
- `src/styles/pages.css`: 기존 화면 스타일과 `.decision-card` 스타일을 함께 유지합니다.
- `eslint.config.js`: 중첩 전달용 스크립트에도 Node 전역 설정이 적용되도록 `**/scripts/**/*.mjs`를 사용합니다.
- `vite.config.ts`: 현재 장비 CSV 경계를 포함한 참고본입니다. 파일 미배치 시 404를 반환하는 처리와 통합 테스트용 `EQUIPMENT_DATA_DIR`를 병합합니다.

## 가장 간단한 로컬 실행

이 전달 파일을 기존 대시보드 프로젝트에 합친 뒤, **합친 프로젝트 루트**에서 실행합니다. 전달 폴더 자체에는 index.html이 없어 단독 웹사이트로 실행할 수 없습니다.

```powershell
npm install
npm run dev:all
```

화면과 API 서버를 함께 켭니다. 브라우저는 `http://localhost:5173/agent-demo`로 접속하세요. 포트가 사용 중이면 오류를 표시합니다. `localhost:8787`은 화면이 아니라 서버 상태와 화면 접속 안내를 보여주는 주소입니다.

기존 package.json에 아래 스크립트를 반드시 추가하고 `scripts/dev.mjs`도 함께 반영하세요.

```json
"dev:all": "node scripts/dev.mjs"
```

## 개별 실행

Node.js 24 이상, npm을 사용합니다. **파일을 합친 대상 프로젝트 루트**에서 실행하세요.

```powershell
npm install
Copy-Item server/.env.example server/.env
```

`server/.env`에 자신의 API 키를 입력합니다. 키가 없어도 룰 판정·보고 초안은 사용할 수 있습니다. 실제 키는 저장소에 올리지 않습니다.

서로 다른 터미널에서:

```powershell
npm run dev -- --configLoader runner
npm run agent
```

- 기존 에이전트 기능 확인: `http://localhost:5173/agent-demo`
- 실제 모델 화면: `http://localhost:5173/alerts`
- 서버 주소: `http://localhost:8787`

실제 모델 목록은 대상 프로젝트의 `VITE_ANOMALY_API_URL` 설정과 모델 API의 응답이 있어야 표시됩니다. 장비 원본 CSV는 별도 자료입니다. 화면의 CSV 추이와 모델 이상 사건의 시점이 같다고 가정하지 않습니다.

## 검증

```powershell
npm run test:decision
npx tsc -p server/tsconfig.json
npm run lint
npm run build -- --configLoader runner
npm run test:agent-integration
```

브라우저 검증에는 Chrome/Edge가 필요합니다. 통합 검증은 `tests/fixtures/equipment`의 합성 CSV와 모의 API를 사용하며 외부 AI를 호출하지 않습니다.

## 담당자에게 보낼 문구

> 기존 프로젝트에 합칠 최신 에이전트 변경 파일 묶음입니다. 전체 프로젝트는 아니므로 README의 적용 순서대로 병합해 주세요. 판단은 공통 룰 함수가 하고 AI는 설명만 합니다. 실제 모델 결과에 측정값이 없으면 확인 필요로 표시하고, 기존 데모는 /agent-demo에서 확인할 수 있습니다. API 키와 실제 장비 CSV는 별도로 준비해야 합니다.

## 현재 제한

심각도·행동·보고 기준은 데모입니다. 현장 기준 승인, 실제 모델 측정값·단위 연결, 지속·반복 정책은 후속 작업입니다. 파일 목록과 출처는 `docs/파일목록.json`, 판정 기준은 `docs/판정-룰표.md`를 확인하세요.

자동 실행 시 기본 화면 포트가 이미 사용 중이면 창의 안내에 따라 기존 실행을 종료하거나 `node scripts/apply-agent.mjs --target "기존_프로젝트_경로" --port 5174`로 실행할 수 있습니다. 서버의 8787 포트가 사용 중인 경우에는 기존 에이전트 서버 실행을 먼저 확인하세요.
