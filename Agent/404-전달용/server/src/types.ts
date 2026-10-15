// PlantEye 에이전트 서버 공통 타입
// 기준: Agent/step2-tools.md 입출력 스키마. src/types/alert.ts의 AlertType과 동일하게 유지한다.

export type AlertType =
  | 'overcurrent'
  | 'low-power-factor'
  | 'power-consumption-increase'
  | 'phase-current-imbalance'

export type ToolStatus =
  | 'ok'
  | 'partial'
  | 'insufficient_data'
  | 'not_found'
  | 'invalid_input'
  | 'error'

export type ClassificationResult = 'matched' | 'within_threshold' | 'insufficient_data'

export type Priority = 'high' | 'medium'

// 모든 도구가 공유하는 메타 필드
export type ToolMeta = {
  status: ToolStatus
  caseId?: string
  caseVersion?: string
  ruleVersion?: string
  dataSource: 'synthetic'
  demoOnly: true
  missingFields: string[]
  message: string
}

// ---- 데모 사례 저장소에 들어가는 원본 형태 ----
export type DemoCase = {
  caseId: string
  caseVersion: string
  equipmentId: string
  equipmentName: string
  measuredAt: string // 시간대 포함 ISO
  measurements: {
    currentR: number | null
    currentS: number | null
    currentT: number | null
    powerFactorR: number | null
    powerFactorS: number | null
    powerFactorT: number | null
    activePower: number | null
  }
  comparison: {
    referencePower: number | null
    referenceAt: string | null
    referenceBasis: string | null
  } | null
  note: string // 이 사례가 어떤 시나리오인지(데모 설명)
}

// ---- 1) get_anomaly_case 출력 ----
export type AnomalyCaseResult = ToolMeta & {
  equipmentId: string
  equipmentName: string
  measuredAt: string
  measurements: DemoCase['measurements']
  units: { current: 'A'; powerFactor: 'ratio_0_1'; activePower: 'kW' }
  comparison: DemoCase['comparison']
  detectorResult: null
}

// ---- 2) classify_anomaly 출력 ----
export type Evaluation = {
  alertType: AlertType
  result: ClassificationResult
  measurement: number | null
  unit: string
  threshold: number | null
  comparisonOperator: '>' | '<' | '>=' | '<=' | null
  ruleId: string
  reason: string
  missingFields: string[]
}

export type ClassifyResult = ToolMeta & {
  evaluations: Evaluation[]
}

// ---- 3) evaluate_priority 출력 ----
export type PriorityItem = {
  alertType: AlertType
  priority: Priority | null
  ruleId: string
  reason: string
  evidence: { measurement: number | null; unit: string; threshold: number | null }
}

export type PriorityResult = ToolMeta & {
  priorities: PriorityItem[]
  unassessedTypes: AlertType[]
}

// ---- 4) get_inspection_guide 출력 ----
export type GuideResult = ToolMeta & {
  guideKey: string
  alertType: AlertType
  title: string
  initialResponse: string
  operatorChecks: string[]
  steps: Array<{ id: string; label: string }>
  reportConditions: string[]
  source: string
  guideVersion: string
}
