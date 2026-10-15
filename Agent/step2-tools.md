# STEP 2. 도구(함수) 설계하기

기준: `step1-design.md`, 1차 멘토링 에이전트 제작 가이드라인 STEP 2.
상태: 설계 확정본. 아래 함수와 JSON은 구현 예정 계약 및 설명용 예시다. 실행 코드나 실제 분석 결과가 아니다.

## 구현 스택 결정 (B안 확정)

- 최종 구현은 기존 React 대시보드(`404-main`)에 에이전트를 통합한다. 별도 Streamlit 앱을 만들지 않는다.
- 도구(함수)와 실행 루프는 **TypeScript로 작성한 작은 백엔드 서버**에 둔다. 이유: OpenAI API 키를 브라우저에 노출하면 안 되므로 키를 쥐는 서버가 필요하고, 기존 `alertRules.ts`·`guideService.ts` 로직을 같은 언어로 재사용할 수 있다.
- 가이드라인의 Python/Streamlit 예시는 참고용이다. 지키는 것은 스택이 아니라 가이드라인의 6요소(LLM·규칙·도구·실행 루프·대화 기록·화면)와 안전 원칙이다.
- 도구는 서버 안에서 실행되고, 브라우저(React)는 서버의 `/api/agent` 엔드포인트만 호출한다. 도구가 LLM에 넘기는 것은 원본 CSV가 아니라 요약된 사례·평가 결과·가이드다.

## 프로젝트 맥락

- 사용자: 공장 신입·경력 작업자 모두.
- 목표: 가상 이상 사례를 확인해 이상 유형·우선순위·판단 근거·점검·보고 조건을 제공한다.
- 입력: 별도로 준비할 소규모 가상 사례. 실제 데이터의 필드와 단위를 참고하되 출처를 표시한다.
- AI: 필요한 도구를 선택하고 결과를 설명한다. 함수: 조회·계산·규칙 판단을 수행한다.
- 예측 담당자의 요금·탄소 결과는 이상 사례와 별개이며 이번 도구에 포함하지 않는다.
- 도구는 원본 CSV 전체가 아니라 필요한 사례와 요약 결과만 반환한다.

## 도구 목록: 4개

| 이름 | 입력 | 출력 | 언제 사용하는가 | 현재 데이터로 가능한가 | 기존 코드 재사용 |
| --- | --- | --- | --- | --- | --- |
| `get_anomaly_case` | `caseId` | 설비·측정 시각·측정값과 단위·비교 기준·출처·누락 항목 | 요청 대상의 데이터를 확인할 때 | 가상 사례 파일을 준비하면 가능. 원본 CSV는 필드 참고 자료이며 사례 저장소를 따로 만들어야 함 | `mockAlerts.ts`의 사례를 참고할 수 있으나 미리 정해진 유형·우선순위를 정답으로 사용하지 않음 |
| `classify_anomaly` | `caseId` | 유형별 matched/within_threshold/insufficient_data, 측정 근거, 계산값, 규칙 ID·버전 | 어떤 이상인지 확인할 때 | 조건부 가능. 전류·역률·전력 컬럼은 존재하지만 단위와 임계치, 전력 비교 기준 확인 필요 | `alertRules.ts`의 유형 키·데모 기준 참고. 기존 함수는 유형을 입력받으므로 그대로 사용 불가 |
| `evaluate_priority` | `caseId` | 확인된 유형별 우선순위·근거·판단 상태·규칙 버전 | 우선 확인 수준과 이유를 묻거나 대응 안내가 필요할 때 | 데모 정책을 명시하면 가능. 실제 우선순위 근거는 팀 합의 필요 | 기존 과전류·불균형 high, 역률 저하·소비 증가 medium 정책을 데모 후보로 활용 |
| `get_inspection_guide` | `alertType` | 가이드 키·제목·초기 대응·점검 단계·보고 조건·출처·버전 | 확인된 유형의 점검·보고 안내가 필요할 때 | 기존 목업 가이드로 시연 가능. 실제 현장 표준으로 검토된 것은 아님 | `getGuidesByAlertType`, `getGuideByKey`, 가이드 타입·목업 내용 활용 후보 |

## 공통 계약

- 사례 ID는 서버 저장소에 있는 사례를 식별한다. 사용자가 설비만 지정하면 화면 선택 정보 등으로 사례를 확정한다. 여러 사례가 있으면 임의로 선택하지 않고 확인한다.
- AI가 함수 입력에 임의 측정값·임계치·판단 결과를 넣지 않는다. 판단 함수는 서버 저장소의 사례와 버전이 있는 규칙을 직접 읽는다.
- 같은 요청의 도구들은 같은 `caseVersion`과 `ruleVersion`을 사용한다. 중간에 사례가 변경되면 다시 조회한다.
- 공통 반환 항목: `status`, `caseId`(사례 도구), `caseVersion`, `dataSource`, `demoOnly`, `missingFields`, `message`. 규칙 도구에는 `ruleVersion`을 추가한다.
- 시연 데이터는 `dataSource: "synthetic"`, `demoOnly: true`로 표시한다. 버전이나 출처를 실제로 확인하지 않고 생성하지 않는다.
- `status`: `ok` / `partial` / `insufficient_data` / `not_found` / `invalid_input` / `error`.
- `ok`는 도구 처리가 성공했다는 뜻이지 이상이 존재하거나 설비가 안전하다는 뜻이 아니다.
- 누락 수치는 null과 누락 항목으로 표시한다. 0으로 대체하지 않는다. 숫자 문자열·NaN·무한값·범위 밖 역률 등은 입력 검증 대상이다.

## 1. get_anomaly_case

입력: `caseId` 하나. 출력은 한 사례의 정규화된 측정값이며, 수 GB 파일이나 장기간 시계열을 반환하지 않는다.

| 출력 항목 | 내용 |
| --- | --- |
| equipmentId, equipmentName | 명시적으로 등록한 설비 식별자와 이름 |
| measuredAt | 시간대를 포함한 측정 시각 |
| measurements | R/S/T 전류, 역률, 유효전력 등 값과 검증된 단위 |
| comparison | 비교 전력, 비교 시각·기간, 기준 출처 등 제공된 정보 |
| detectorResult | 별도 탐지기가 제공한 결과가 있으면 출처와 함께 전달. 없으면 null |
| missingFields | 유형별 평가에 필요한 누락 항목 |

원본의 `currentR/S/T`, `powerFactorR/S/T`, `activePower`를 참고한다. `activePower`의 단위와 `localtime`의 시간대를 샘플만으로 확정하지 않는다. 원본 역률의 퍼센트 표현과 내부 비율 표현은 변환 근거를 기록한다. UI의 `motor-02`와 원본의 `1(PM-3)`는 별도 ID 대응표 없이 연결하지 않는다.

## 2. classify_anomaly

입력: `caseId`. 출력: `evaluations` 배열. 모든 지원 유형을 평가하되 필요한 값이 없는 유형은 판정 보류한다. 하나의 사례에서 여러 유형이 일치할 수 있다.

| 유형 | 필요한 데이터 | 제안하는 계산·평가 방식 | 미확정 항목 |
| --- | --- | --- | --- |
| 과전류 (`overcurrent`) | 상별 전류(A), 적용 전류 임계치(A) | 상별 기준 초과 여부 평가 후 초과 상과 측정값 반환 | 설비별 임계치. 100 A는 기존 데모 기준이며 실제 기준 아님 |
| 역률 저하 (`low-power-factor`) | 상별 역률(0~1), 적용 임계치 | 유효한 상별 역률의 기준 미만 여부와 해당 상 반환 | 상별 평가 정책. 0.85는 데모 후보 |
| 전력 소비 증가 (`power-consumption-increase`) | 현재 전력·비교 전력(동일 단위), 비교 근거 | `(현재-비교)/비교 × 100`을 함수에서 계산하고 증가율 임계치와 비교 | 동일 운전 조건·비교 시간 선정, 전력 단위. 비교값 0·누락이면 비율 판정 보류 |
| 상간 전류 불균형 (`phase-current-imbalance`) | R/S/T 전류(A) 모두 | 데모 제안: `최대 상별 평균편차 / 평균전류 × 100` | 계산식·임계치 합의. 평균이 0이면 비율 판정 보류. 이 식은 프로젝트 제안이며 공식 표준으로 주장하지 않음 |

전력 증가 유형명은 기존 UI와 맞추되 여기서는 유효전력 비교임을 근거에 표시한다. 누적 전력량과 혼동하지 않는다.

각 평가에는 `alertType`, `result`, `measurement`, `unit`, `threshold`, `comparisonOperator`, `ruleId`, `reason`, `missingFields`를 담는다. 계산으로 얻은 값은 계산식과 입력 근거를 함께 반환한다.

- 결과: `matched` / `within_threshold` / `insufficient_data`.
- 경계값의 초과/미만과 반올림 정책은 규칙에 명시한다. 표시 반올림값으로 판정하지 않는다.
- 모든 유형이 판정 가능하고 미일치이면 '해당 규칙에서 이상 조건 미확인'이다.
- 일부 유형이 미일치이고 나머지가 누락이면 전체를 정상으로 판정하지 않는다.
- 기존 목업의 소비 증가 measurement/reference/change는 서로 맞지 않을 수 있으므로 참고 문구를 정답으로 복사하지 않고 원값에서 재계산한다.

## 3. evaluate_priority

입력: `caseId`. 내부에서 같은 규칙 분류 결과를 계산하거나 검증된 동일 버전 결과를 재사용한다. AI가 제공한 유형을 판정 근거로 삼지 않는다.

출력: `priorities` 배열에 확인된 유형별 `alertType`, `priority`, `ruleId`, `reason`, `evidence`를 담는다. 판정하지 못한 유형은 `unassessedTypes`로 남긴다.

| 분류 결과 | 데모 우선순위 제안 |
| --- | --- |
| 과전류·상간 전류 불균형 조건 일치 | high |
| 역률 저하·전력 소비 증가 조건 일치 | medium |
| 평가 가능 유형에서 조건 미일치 | 해당 유형의 이상 우선순위 없음 |
| 필요한 데이터·규칙 없음 | 판단 불가, priority null |

이 정책은 기존 데모와 맞추기 위한 초안이다. 실제 설비 위험도를 검증한 기준은 아니다. 조건 미일치·데이터 부족을 low로 처리하지 않는다. 여러 유형은 high → medium 순으로 표시하고 같은 우선순위에 임의 순위를 만들지 않는다. 미평가 유형이 있으면 전체 안전 수준을 확정하지 않는다.

## 4. get_inspection_guide

입력: 지원하는 `alertType` 하나. 여러 이상이면 필요한 유형마다 호출한다.
출력: `guideKey`, `alertType`, `title`, `initialResponse`, `operatorChecks`, `steps`, `reportConditions`, `source`, `guideVersion`, `demoOnly`.

- 현재 네 canonical 유형 키를 기존 UI와 공유한다.
- 정확히 일치하는 가이드를 조회한다. 없는 유형을 기본 가이드로 대체하지 않는다.
- 기존 `resolveGuide`는 기본 가이드 fallback이 있으므로 에이전트 조회에 그대로 사용하지 않는다.
- 등록된 내용만 반환한다. AI는 의미를 유지해 설명하고 없는 조치를 추가하지 않는다.
- 가이드의 생산량·정비 이력 확인 항목은 작업자에게 확인을 요청하는 내용이며, 시스템이 그 자료를 조회했다고 표현하지 않는다.

## 설명용 입출력 예시

가상 사례 `demo-overcurrent-001`이 서버에 등록돼 있고 R/S/T 전류가 128/90/92 A, 전류 기준이 100 A라고 가정한다. 다른 유형은 추가 데이터와 규칙에 따라 별도로 평가한다.

```json
{"caseId": "demo-overcurrent-001"}
```

과전류 평가 항목의 예시(전체 응답이 아님):

```json
{
  "alertType": "overcurrent",
  "result": "matched",
  "measurement": 128,
  "unit": "A",
  "threshold": 100,
  "comparisonOperator": ">",
  "ruleId": "demo-overcurrent-v1",
  "reason": "R상 전류 128 A가 데모 기준 100 A를 초과함",
  "missingFields": []
}
```

이 값을 예측 파일이나 실측에서 얻었다고 주장하지 않는다. 전체 결과에는 사례 버전·출처·다른 유형의 평가 상태도 포함한다.

## 대표 요청과 도구 사용

| 요청 | 예상 도구 사용 | 결과에 따른 분기 |
| --- | --- | --- |
| 어떤 이상인지 | 사례 조회 → 분류 | 대상 없음은 확인 요청, 값 누락은 부분 판정 |
| 우선순위와 근거 | 사례 조회·우선순위 판단, 필요 시 분류 조회 | 근거 부족은 보류, 복합 이상은 유형별 근거 |
| 점검·보고 조건 | 사례 조회 → 분류·우선순위 판단 → 필요한 유형의 가이드 | 조건 미확인은 이상 가이드 강제 조회하지 않음, 가이드 누락은 미등록 안내 |

위 순서는 설명용 예상 흐름이다. AI가 요청과 이미 확인한 결과에 맞게 도구를 선택한다. 계산·규칙은 함수가 고정적으로 수행한다. 대화 상태에는 대상 사례·버전과 확인한 결과를 유지한다.

## 구현용 입출력 스키마 (구현 직전 계약)

아래는 STEP 6에서 TypeScript로 그대로 옮길 수 있도록 각 도구의 입력·출력 형태를 정리한 것이다. 타입명은 기존 `src/types/alert.ts`의 `AlertType`(`overcurrent` | `low-power-factor` | `power-consumption-increase` | `phase-current-imbalance`)을 공유한다.

### 공통 반환 필드

```ts
type ToolStatus = 'ok' | 'partial' | 'insufficient_data' | 'not_found' | 'invalid_input' | 'error'

type ToolMeta = {
  status: ToolStatus
  caseId?: string          // 사례를 다루는 도구에만
  caseVersion?: string     // 같은 요청 안에서 동일 버전 유지
  dataSource: 'synthetic'  // 데모 사례는 항상 synthetic
  demoOnly: true           // 데모 데이터임을 명시
  ruleVersion?: string     // 규칙을 적용하는 도구에만
  missingFields: string[]  // 누락 항목. 없으면 빈 배열
  message: string          // 사람이 읽는 짧은 설명
}
```

### 1) get_anomaly_case

```ts
// 입력
{ caseId: string }

// 출력
{
  ...ToolMeta,                       // status, caseId, caseVersion, dataSource, demoOnly, missingFields, message
  equipmentId: string,               // 예: "motor-02"
  equipmentName: string,             // 예: "2호 모터"
  measuredAt: string,                // 시간대 포함 ISO, 예: "2024-08-22T07:45:00+09:00"
  measurements: {
    currentR: number | null, currentS: number | null, currentT: number | null,  // 단위 A
    powerFactorR: number | null, powerFactorS: number | null, powerFactorT: number | null, // 0~1
    activePower: number | null       // 단위 kW (사례에 units로 명시)
  },
  units: { current: 'A', powerFactor: 'ratio_0_1', activePower: 'kW' },
  comparison: {                      // 전력 소비 증가 평가에 쓰는 비교 기준. 없으면 null
    referencePower: number | null,
    referenceAt: string | null,
    referenceBasis: string | null    // 비교 근거 설명
  } | null,
  detectorResult: null               // 별도 탐지기 결과가 없으면 null
}
```

### 2) classify_anomaly

```ts
// 입력
{ caseId: string }

// 출력
{
  ...ToolMeta,                       // ruleVersion 포함
  evaluations: Array<{
    alertType: AlertType,
    result: 'matched' | 'within_threshold' | 'insufficient_data',
    measurement: number | null,      // 평가에 쓴 값
    unit: string,                    // 'A' | 'ratio_0_1' | '%'
    threshold: number | null,
    comparisonOperator: '>' | '<' | '>=' | '<=' | null,
    ruleId: string,                  // 예: "demo-overcurrent-v1"
    reason: string,                  // 계산식·근거 포함
    missingFields: string[]
  }>
}
```

- 모든 지원 유형을 평가하되 필요한 값이 없는 유형은 `insufficient_data`.
- 하나의 사례에서 여러 유형이 `matched`일 수 있다.
- 전력 소비 증가: `(현재-비교)/비교 × 100`을 함수가 계산한다. 비교값이 0이거나 없으면 판정 보류.
- 상간 불균형: `최대 상별 편차 / 평균전류 × 100` (프로젝트 제안식, 공식 표준 아님). 평균 0이면 보류.

### 3) evaluate_priority

```ts
// 입력
{ caseId: string }

// 출력
{
  ...ToolMeta,                       // ruleVersion 포함
  priorities: Array<{
    alertType: AlertType,
    priority: 'high' | 'medium' | null,  // 데모: 과전류·불균형 high, 역률·소비증가 medium
    ruleId: string,
    reason: string,
    evidence: { measurement: number | null, unit: string, threshold: number | null }
  }>,
  unassessedTypes: AlertType[]       // 데이터·규칙 부족으로 판정 못한 유형
}
```

- 함수가 내부에서 분류를 다시 계산하거나 같은 버전의 결과를 재사용한다. LLM이 넘긴 유형을 근거로 삼지 않는다.
- 조건 미일치·데이터 부족을 `low`로 처리하지 않는다.

### 4) get_inspection_guide

```ts
// 입력
{ alertType: AlertType }

// 출력
{
  ...ToolMeta,                       // guideVersion은 guideKey 옆에 둠
  guideKey: string,
  alertType: AlertType,
  title: string,
  initialResponse: string,
  operatorChecks: string[],
  steps: Array<{ id: string, label: string }>,
  reportConditions: string[],
  source: string,
  guideVersion: string
}
```

- 정확히 일치하는 가이드만 반환한다. 없는 유형을 기본 가이드로 대체하지 않는다(기존 `resolveGuide`의 fallback을 쓰지 않음).

### LLM에 노출할 function calling 스키마 (요약)

```ts
const toolDefs = [
  { name: 'get_anomaly_case',     description: '사례 ID로 설비·측정값·비교기준·누락항목을 조회한다. 측정값을 확인할 때 먼저 호출한다.',
    parameters: { caseId: 'string (필수)' } },
  { name: 'classify_anomaly',     description: '사례의 모든 이상 유형을 규칙으로 평가한다. 어떤 이상인지 물을 때 사용한다.',
    parameters: { caseId: 'string (필수)' } },
  { name: 'evaluate_priority',    description: '확인된 유형별 우선순위와 근거를 돌려준다. 우선순위·대응 수준을 물을 때 사용한다.',
    parameters: { caseId: 'string (필수)' } },
  { name: 'get_inspection_guide', description: '해당 이상 유형의 등록된 점검·보고 가이드를 조회한다. 점검·보고 조건을 물을 때 유형마다 호출한다.',
    parameters: { alertType: "'overcurrent'|'low-power-factor'|'power-consumption-increase'|'phase-current-imbalance' (필수)" } },
]
```

## 팀원에게 공유·확인할 사항

- 화면 담당자: 사례·설비 ID, 유형 키, 유형별 결과 배열과 부족 정보 표시, 샘플 JSON, 기존 프런트 규칙으로 결과를 덮어쓰지 않는 연결 방식.
- 데이터·팀 전체: 단위와 시간대, 실제 탐지 결과 유무, 사례 준비 주체, 설비별 임계치, 전력 비교 근거, 불균형 계산식, 데모 우선순위 정책.
- 가이드 검토 주체: 기존 목업 내용과 검토 상태, 사용할 가이드 버전.

## STEP 2 셀프체크

- 도구 수 3~5개: 4개로 설계.
- 이름·입력·출력·사용 상황: 정리함.
- 숫자 계산은 함수, AI는 선택과 설명: 구분함.
- 원본 전체 대신 필요한 요약: 한 사례·평가 결과·가이드만 반환.
- 데이터로 구현 가능 여부: 가상 사례 준비 시 가능하며 단위·기준은 조건부임을 표시.
- 기존 계산 재사용: 타입·데모 정책·가이드 활용 후보와 그대로 사용하면 안 되는 부분을 구분.
- 고장 이력·생산량·실제 조치 기록을 조회하는 도구: 현재 자료에 없어 포함하지 않음.

- 구현 스택: B안(React 대시보드 + TypeScript 백엔드 서버)으로 확정. 도구는 서버에서 실행하고 브라우저에는 결과만 전달.
- 입출력 스키마: STEP 6에서 바로 옮길 수 있도록 공통 필드·4개 도구·function calling 정의까지 구체화.

다음 단계는 STEP 3 시스템 프롬프트 규칙 작성이다. 그 전에 위 미확정 기준(단위·임계치·우선순위 정책)을 팀에 확인할 수 있으며, STEP 2 문서 작성은 함수 구현이나 API 실행 완료를 뜻하지 않는다.
