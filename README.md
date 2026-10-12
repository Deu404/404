# PlantEye

PlantEye는 공장 설비 전력 모니터링 및 이상 탐지를 위한 React 화면입니다. 공통 레이아웃과 라우팅을 유지하면서 통합 대시보드(`/`)와 CSS 기반 공장 2D 배치도(`/layout`)를 구현했습니다.

현재 화면은 분석 담당자의 JSON/API가 연결되기 전 단계이므로 `src/mocks`의 개발용 정적 목업 데이터만 사용합니다. 실제 데이터 처리나 API 호출은 구현하지 않았습니다. 알림과 가이드는 실제 진단 결과가 아닌 검토용 시뮬레이션입니다.

## 데이터 경계

화면은 다음 경계를 통해서만 데이터를 읽습니다.

```text
향후 외부 JSON → src/adapters 어댑터 → src/services 서비스 계층 → src/pages·src/components UI
현재 개발 데이터: `src/mocks` 목업 → `mockDataAdapter` → `dataProvider` → `src/services` → `src/pages·src/components` UI
```

- `src/types`: UI가 사용하는 내부 도메인 타입(설비, 전력 시계열, 과거 비교, 알림, 가이드)을 정의합니다.
- `src/mocks`: 실제 API·분석 JSON과 분리된 개발용 목업 fixture를 보관합니다.
- `src/adapters`: `dataProvider.ts`가 화면 서비스가 사용하는 단일 `DataProvider` 경계를 정의하고, 현재 선택된 provider로 `mockDataAdapter.ts`를 연결합니다. 외부 JSON의 입력 검증과 내부 타입 매핑은 스키마가 확정된 뒤 `externalDataAdapter.ts` 또는 별도 구체 어댑터에 추가합니다.
- `src/services`: 선택된 `DataProvider`를 통해 데이터를 조회하고 기본 선택·빈 배열 fallback을 제공하는 서비스 계층입니다. 내부 도메인 타입의 측정값은 선택적이며, 누락·잘못된 값은 0이 아닌 `undefined`로 유지되어 UI에서 `데이터 없음` 또는 빈 상태로 표시됩니다. `alertRules.ts`의 사전 정의 규칙만 데모 이상 분류에 사용하며, 실제 AI 분석이나 실시간 센서 판단은 없습니다. UI가 fixture 배열을 직접 참조하지 않습니다.
- `src/data`: 기존 검증 코드와 호환하기 위한 경계이며, 새 UI 소비자는 사용하지 않습니다.

실제 JSON 연결 시에는 다음 파일을 수정합니다.

1. 분석 담당자가 제공한 스키마를 전제로 `src/adapters/externalDataAdapter.ts` 또는 새 구체 어댑터에 입력 검증과 필드 매핑을 추가합니다. 외부 필드명은 스키마를 받은 뒤에만 결정하며, `src/adapters/dataProvider.ts`의 선택된 provider만 교체합니다.
2. `src/services/equipmentService.ts`, `powerService.ts`, `alertService.ts`, `guideService.ts`는 계속 `dataProvider` 계약만 읽도록 유지합니다.
3. `src/types`의 내부 도메인 타입은 UI 계약으로 유지하고 외부 JSON 필드명과 직접 결합하지 않습니다.
4. 개발용 fallback이 필요하면 `src/mocks`와 기존 `src/data` 호환 파일을 유지하고, 필요하지 않으면 단계적으로 제거합니다.

## 요구 사항

- Node.js 18 이상
- npm

## 설치 및 실행

```powershell
npm install
npm run dev
```

개발 서버가 시작되면 브라우저에서 `http://localhost:5173`을 엽니다.

## 검사 및 빌드

FEAT-002에서 실행하는 명령은 다음과 같습니다.

```powershell
npm run typecheck
npm run build
npm run lint
npm run test:equipment-detail
```

`npm run test:equipment-detail`는 서비스 정규화와 UI 경계·알림/가이드 상호작용 연결, 실제 페이지가 사용하는 목업 선택 함수, React 서버 렌더링, Vite 개발 서버의 Chromium 브라우저 DOM 렌더링을 실행합니다. 전체 13개 설비, 기본 선택, `compressor-02` 선택, 잘못된 설비·알림 ID의 명시적인 찾을 수 없음 상태, 상세 데이터가 없는 선택 설비의 메타데이터 유지 및 빈 상태, 표시 설비명·전력·전력량·차트 데이터와 이상 이력 매핑을 검증합니다. malformed 레코드와 빈 배열도 서비스에서 안전한 내부 타입으로 정규화되는지 확인합니다.

라우트 smoke 확인은 별도 터미널에서 `npm run dev`를 실행한 뒤 다음 모든 주소에 HTTP 200 응답이 오는지 확인합니다. 확인이 끝나면 개발 서버 터미널에서 `Ctrl+C`로 반드시 중지합니다.

```text
http://localhost:5173/
http://localhost:5173/layout
http://localhost:5173/equipment-power
http://localhost:5173/equipment-power?equipment=compressor-02
http://localhost:5173/equipment-power?equipment=not-real
http://localhost:5173/alerts
http://localhost:5173/inspection-guide
http://localhost:5173/inspection-guide?guide=compressor-power&alert=alert-20240821-001
```

라우트 smoke 검증에는 대시보드의 주의 설비 링크, 알림 목록의 검색·이상 유형·심각도·설비·확인 상태 필터와 설비 상세·점검 가이드 링크, 잘못된 알림 ID의 찾을 수 없음 상태, 네 가지 canonical 가이드의 체크리스트·안전 정보·보고 조건·관련 설비 링크가 렌더링되는지 확인하는 브라우저 DOM assertion도 포함됩니다. 선택한 설비에 기본 메타데이터는 있지만 상세 데이터가 없으면 관련 없는 다른 설비 데이터를 fallback으로 사용하지 않고, 선택 설비 ID를 유지한 빈 상태를 표시합니다.


```powershell
$routes = @('/', '/layout', '/equipment-power', '/equipment-power?equipment=compressor-02', '/equipment-power?equipment=not-real', '/alerts', '/alerts?alert=not-real', '/inspection-guide', '/inspection-guide?guide=overcurrent', '/inspection-guide?guide=low-power-factor', '/inspection-guide?guide=power-consumption-increase&alert=alert-20240821-001', '/inspection-guide?guide=phase-current-imbalance', '/forecast')
$routes | ForEach-Object { $response = Invoke-WebRequest -Uri "http://localhost:5173$_" -UseBasicParsing; "{0} {1}" -f $response.StatusCode, $_ }
```

## 메뉴

- 통합 대시보드: `/`
- 공장 배치도: `/layout` (13개 목업 설비 선택 및 `/equipment-power` 상세 이동)
- 설비별 전력 분석: `/equipment-power`
- 이상 알림: `/alerts`
- 점검 가이드: `/inspection-guide`
- 전력 분석 및 예측: `/forecast`

알림 화면(`/alerts`)은 알림 ID·설비명·설비 번호·발생 시각·이상 유형·심각도·우선순위·측정값·기준값·변화량·판단 근거·반복 횟수·확인 상태를 표시하며 검색, 이상 유형·심각도·설비·확인 상태 필터와 우선순위 기본 정렬을 제공합니다. 선택한 알림에서 `/equipment-power?equipment=...` 및 `/inspection-guide?guide=...&alert=...`로 이동할 수 있고, 알 수 없는 `?alert=`는 다른 알림으로 대체하지 않습니다. 점검 가이드(`/inspection-guide`)는 `overcurrent`, `low-power-factor`, `power-consumption-increase`, `phase-current-imbalance` 네 canonical 키를 지원하며, 증상·발생 이유·알림 측정값·작업자 확인·안전한 초기 대응·체크리스트·보고 조건을 제공합니다. 체크리스트는 화면 내 React 상태로 동작하고 가이드 변경 시 초기화됩니다. 설비 상세는 관련 알림과 canonical 가이드 링크를 제공하며, 알 수 없는 설비 ID는 명시적인 빈 상태로 표시합니다.
