# PlantEye 에이전트 1차 구현

판정은 `src/shared/decision.ts`와 `rules.ts`가 수행하고 AI는 확정된 결과를 설명합니다. 브라우저가 선택한 개발용 알림의 원래 측정값을 보내면 서버가 다시 같은 함수로 평가합니다. 설비별 임의 데모 사례 대체는 없습니다.

## 실행

Node.js 24 이상, 프로젝트 루트 `404-main`에서:

```powershell
npm run dev -- --configLoader runner
npm run agent
```

서버 설정은 `server/.env`를 사용합니다. API 키는 서버에서만 읽습니다. 키가 없거나 연결이 실패해도 판정 카드와 보고 초안은 사용할 수 있습니다. API 키 설정 여부를 브라우저로 보내지 않습니다.

## API

`POST http://localhost:8787/api/agent`

- `message`: 질문
- `alert`: 선택한 알림의 id, equipmentId, occurredAt, type, measurement/reference/change. 숫자 단위는 내부 계약(A, 역률 0~1, 전력 kW)을 따릅니다. 실제 외부 CSV를 자동 변환하지 않습니다.
- `intent`: anomaly / report / forecast / executive. 생략 시 키워드로 고릅니다. 의도가 애매하면 화면의 버튼을 사용하세요.
- `caseId`: 알림 대신 저장된 데모 사례를 직접 검증할 때만 사용합니다. 알림과 함께 전달되면 알림이 우선입니다.

반환값의 `decision`은 AI 호출 전에 확정됩니다. AI 응답은 `reply.detail`에만 반영하고 판정 필드를 수정하지 않습니다. 외부 API 호출은 도구 호출 없이 설명 요청 1회이며 25초 제한 후 룰 안내로 복구합니다. 현재 대화는 매 요청마다 선택한 알림을 기준으로 처리하며 지난 대화 내용을 자동 기억하지 않습니다.

`report`는 AI 없이 판정 결과에서 보고 초안을 만듭니다. 자동 보고 발송 기능은 없습니다. 예측·경영 도구는 기존 고정 집계값을 유지하며 최신 분석이나 실제 고장 통계로 보증하지 않습니다.

## 공통 소스와 전달

`server`만 복사하면 동작하지 않습니다. `src/shared`와 `src/config/equipmentDataMap.ts`를 같은 프로젝트 구조로 함께 전달해야 합니다. 전달용 폴더에도 해당 파일을 포함했습니다.

## 검증

```powershell
npm run test:decision
npm run test:equipment-detail
npx tsc -p server/tsconfig.json
npm run lint
npm run build -- --configLoader runner
```

실제 AI 서비스 연결 검증은 별도입니다. 모의 응답 검증과 실제 API 성공을 구분합니다. 임계값과 조치·보고 정책은 데모이며 현장 승인 기준이 아닙니다. 지속·반복 정책은 미확정 상태입니다.


## 최신 대시보드와 연결 (2026-10-16)

실제 CSV/API 화면은 다운로드 폴더의 최신 버전을 반영했습니다. `/alerts`의 모델 결과는 `anomaly` 입력(id, equipmentId, occurredAt, fields)으로 전달하며, 수치·단위·적용 기준이 없어 데모 임계값을 적용하지 않습니다. 공통 연결 함수 `src/shared/modelDecision.ts`가 판정 보류와 확인할 자료를 반환합니다. 이 경로는 AI를 호출해 빠진 판단을 추측하지 않습니다.

기존 데모 에이전트는 `/agent-demo`에서 유지됩니다. 실제 화면의 provider에 가상 알림을 섞지 않으며, 최신 이상탐지 화면의 '연습용 에이전트 확인'으로 이동할 수 있습니다. 최신 모델 목록에 값이 없으면 `VITE_ANOMALY_API_URL` 설정과 실제 API의 결과 제공 여부를 확인해야 합니다.

CSV 개발 서버는 프로젝트 내부 또는 상위 작업 폴더의 `장비별 Data`에서 허용된 장비 파일을 읽습니다. 이는 개발용 Vite 서버에서 제공하며 정적 배포 시 CSV API 구현이 별도로 필요합니다.

통합 검증: `npm run test:agent-integration`. 외부 모델 API와 AI는 테스트 응답으로 대체하며, 로컬 CSV 읽기와 실제 화면·데모 화면의 분리를 확인합니다.
