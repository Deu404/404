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
  dataSource: 'synthetic' | 'forecast_model_v1'
  demoOnly: boolean
  missingFields: string[]
  message: string
}

export type DetectorResult = {
  modelDetected: boolean
  modelName: string
  suspectedFields: string[]
  occurredAt?: string
} | null

export type EquipmentLocation = {
  x: number
  y: number
  zone: string
}

// ---- 데모 사례 저장소에 들어가는 원본 형태 ----
export type DemoCase = {
  caseId: string
  caseVersion: string
  equipmentId: string
  equipmentName: string
  location?: EquipmentLocation
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
  detectorResult?: DetectorResult
  note: string // 이 사례가 어떤 시나리오인지(데모 설명)
}

// ---- 1) get_anomaly_case 출력 ----
export type AnomalyCaseResult = ToolMeta & {
  equipmentId: string
  equipmentName: string
  location?: EquipmentLocation
  measuredAt: string
  measurements: DemoCase['measurements']
  units: { current: 'A'; powerFactor: 'ratio_0_1'; activePower: 'kW' }
  comparison: DemoCase['comparison']
  detectorResult: DetectorResult
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

// ---- 5) get_forecast_summary 출력 (신규) ----
export type ForecastSummaryResult = ToolMeta & {
  period: string
  hoursCount: number
  totalPredictedPowerKWh: number
  totalEstimatedCostKRW: number
  totalEstimatedCarbonKg: number
  peakHour: {
    hour: string
    powerKWh: number
    estimatedCostKRW: number
  }
  evaluationMetrics: {
    hourlyPowMAE: number
    billMAE: number
    carbonMAE: number
  }
}

// ---- 6) get_executive_report_data 출력 (신규) ----
export type ExecutiveReportResult = ToolMeta & {
  reportPeriod: string
  forecastSummary: {
    totalPowerKWh: number
    totalCostKRW: number
    totalCarbonKg: number
    peakHour: string
  }
  anomaliesSummary: {
    totalCasesChecked: number
    criticalEquipments: string[]
    commonDefectTypes: string[]
  }
  recommendations: string[]
}
