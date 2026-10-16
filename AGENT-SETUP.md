# PlantEye 에이전트 실행 안내

현재 에이전트는 루트의 `server/`, `src/`, `scripts/`에 통합되어 있습니다. `Agent/404-agent`는 과거 전달용 자료이며 현재 실행 위치가 아닙니다.

## 설치와 실행

Node.js 24 이상과 npm을 준비한 뒤 저장소 루트에서 실행합니다.

```powershell
npm ci
Copy-Item .env.example .env.local
Copy-Item server/.env.example server/.env
npm run dev:all
```

이미 설정 파일이 있다면 덮어쓰지 마세요. 브라우저에서 http://127.0.0.1:5173/alerts 를 엽니다. Windows에서는 설치 후 `START-PLANTEYE.cmd`로도 실행할 수 있습니다.

`server/.env`의 OPENAI_API_KEY를 개인 환경에서 설정합니다. 키가 없어도 등록된 기준에 따른 조회·안내를 사용할 수 있으며, AI 추가 설명은 키 설정이 필요합니다. `.env.local`과 `server/.env`는 Git에서 제외합니다.

## 관측 데이터 연결

대용량 원본 데이터와 키는 저장소에 포함하지 않습니다. 팀에서 별도로 받은 `test_data` 폴더를 프로젝트 루트에 두세요. 다른 위치라면 `.env.local`의 TEST_DATA_DIR와 ANOMALY_OBSERVATION_DIR를 해당 폴더로 바꿉니다. 13개 설비별 관측 JSON을 사용하며 `clean_reference`는 정상 참조 재산출·검증 시에만 필요합니다. 관측 JSON을 읽을 때 정답 라벨은 판정 입력에서 제외합니다.

CSV로 실행할 경우 EQUIPMENT_DATA_DIR를 CSV 폴더로 설정하고, JSON 관측을 사용하지 않는다면 ANOMALY_OBSERVATION_DIR를 제거합니다. 파일명은 `src/config/equipmentDataMap.ts`를 따릅니다.

다음 파일은 저장소에 포함되어야 합니다.

- `public/anomaly-results.json`: 55,156개 모델 알림 결과
- `server/config/inspection-policy.json`, `normal-pattern-policy.json`: 판정 설정·13개 설비의 정상 참조 범위
- `전기요금 및 탄소배출량 예측/`: 예측·평가 CSV와 모델 정보
- `server/src/`, `server/prompt.txt`: 에이전트 서버·도구·프롬프트
- `src/shared/normalPattern.ts`, `src/components/alerts/`: 비교 로직·화면
- `analysis/normal-pattern/`: 참조 범위 산출·검증 기록

관측 파일이 없으면 초기 안내가 자료 부족으로 표시될 수 있습니다. 합성 정상 참조 범위는 현장 안전 한계나 실제 고장 확정 기준이 아닙니다.

## 검증

데이터 없이 수행할 수 있는 기능 검증:

```powershell
npm run test:decision
npm run test:agent-production
npm run lint
npm run build -- --configLoader runner
npx tsc -p server/tsconfig.json
```

전체 데이터 연결 후 `npm run test:normal-pattern`, `npm run test:test-data-power`를 수행합니다. 전체 점검은 `TEST-PLANTEYE.cmd`로 실행할 수 있습니다. 기능 검증은 외부 AI 요청을 모의 처리하며 실제 API 키를 필요로 하지 않습니다.

## 웹 배포 범위

GitHub에 코드를 등록하는 것과 공유 웹에서 서버를 실행하는 것은 별개입니다. 현재 `dev:all`은 로컬 Vite와 Node 서버를 함께 실행합니다. 정적 웹 배포만으로 `/api/agent`, `/api/inspection`, `/api/equipment-data`가 배포되지는 않습니다.
