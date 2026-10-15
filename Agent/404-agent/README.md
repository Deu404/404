# PlantEye AI 에이전트 전달 패키지 (최신 반영본)

이 폴더는 `404-main` 프로젝트에 즉시 통합 가능한 AI 점검 및 경영진 분석 에이전트 완성본입니다.

---

## 1. 반영된 핵심 기능

1. **현장 작업자용 이상 진단 & 표준 점검 가이드 (신입/숙련자)**
   - 기획서 표준 설비 식별자 완전 일치: `3호기(robot-03)`, `6호기(pump-02)`, `4호기(robot-02)`, `PM-3(compressor-01)`, `분쇄기(1)(motor-02)`
   - 4대 이상 규칙 평가 (과전류, 역률 저하, 소비 증가, 상간 전류 불균형)
   - 2D 공장 배치도 연계 도면 좌표(`location: { x, y, zone }`) 및 Random Forest ML 이상 탐지 결과(`detectorResult`) 반환
2. **공장 경영자용 5월 전력·요금·탄소 예측 & 종합 분석 리포트 (공장주)**
   - 2025.05.10 ~ 05.31 시간대별 총 예상 전력량(1,976만 kWh), 예상 전기요금(35.6억 원), 탄소배출량(8,378톤), 피크 시간대(5.10 04:00) 브리핑
   - 설비 이상 통계 + 예측 지표를 결합한 3단 구조(설비 리스크/비용 분석/경영 권고) 마크다운 종합 리포트 생성
3. **UI 추천 질문 칩 6종 및 동적 알림 매핑 (`resolveCaseId`)**
   - 어떤 알림을 클릭하더라도 에러 없이 표준 데모 사례로 자동 연결

---

## 2. 파일 복사 가이드

프로젝트 루트(`404-main` 또는 `404`)에 아래 파일들을 복사/덮어쓰기합니다.

- `server/` → 루트 폴더의 `server/`로 전체 복사
- `src/components/alerts/AgentPanel.tsx` → `src/components/alerts/`에 복사
- `src/pages/AlertsPage.tsx` → `src/pages/`에 덮어쓰기
- `src/styles/pages.css` → `src/styles/`에 덮어쓰기

> **package.json 스크립트 추가 (선택 권장):**  
> 루트 `package.json`의 `"scripts"`에 아래 2줄을 추가해 두면 편하게 실행할 수 있습니다.
> ```json
> "agent": "node --env-file-if-exists=server/.env server/src/server.ts",
> "test:agent": "node server/src/verifyTools.ts"
> ```

---

## 3. 실행 및 검증 방법

### ① 도구 단독 검증 (OpenAI API 키 불필요)
```powershell
npm run test:agent
# 또는
node server/src/verifyTools.ts
```
11개 테스트 케이스가 오류 없이 출력되면 정상입니다.

### ② 에이전트 백엔드 서버 실행
```powershell
# Windows PowerShell 기준
$env:OPENAI_API_KEY = "발급받은_API_키"
$env:OPENAI_MODEL = "gpt-5-mini"
npm run agent
# 또는
node server/src/server.ts
```
서버가 `http://localhost:8787`에서 대기합니다.

### ③ React 프런트엔드 실행
```powershell
npm run dev
# 또는
npm.cmd run dev
```
브라우저에서 `http://localhost:5173/alerts`에 접속하여 알림을 클릭한 뒤, 우측 **AI 점검 안내** 패널에서 추천 질문 버튼을 눌러 테스트합니다.

