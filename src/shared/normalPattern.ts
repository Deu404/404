import type { Decision } from './decision.ts'

export const PATTERN_FIELDS = ['voltageR', 'voltageS', 'voltageT', 'voltageRS', 'voltageST', 'voltageTR', 'currentR', 'currentS', 'currentT', 'activePower', 'powerFactorR', 'powerFactorS', 'powerFactorT', 'reactivePowerLagging', 'phaseImbalance'] as const
export const PATTERN_LABELS: Record<string, string> = {
  voltageR: 'R상 전압', voltageS: 'S상 전압', voltageT: 'T상 전압', voltageRS: 'RS 선간전압', voltageST: 'ST 선간전압', voltageTR: 'TR 선간전압',
  currentR: 'R상 전류', currentS: 'S상 전류', currentT: 'T상 전류', activePower: '유효전력', powerFactorR: 'R상 역률', powerFactorS: 'S상 역률', powerFactorT: 'T상 역률', reactivePowerLagging: '무효전력', phaseImbalance: '상별 전류 편차율',
}
export type PatternBound = { lower: number; upper: number; median: number; scale: number; unit: string }
export type PatternProfile = {
  source: string; sha256: string; fitRows: number; calibrationRows: number; validationRows: number
  fitPeriod: string[]; calibrationPeriod: string[]; validationPeriod: string[]
  states: Record<string, { fitRows: number; calibrationRows: number; cutoff: number; bounds: Record<string, PatternBound> }>
}
export type PatternPolicy = { version: string; kind: string; scope: string; method: string; equipment: Record<string, PatternProfile> }
export type PatternCheck = { field: string; label: string; value: number | null; lower: number; upper: number; unit: string; result: 'inside' | 'outside' | 'invalid' | 'not_applicable' }
export type PatternAssessment = { version: string; referenceSource: string; referencePeriod: string[]; referenceTiming: 'before-observation' | 'overlaps-observation' | 'after-observation' | 'unknown'; operation: string | null; checks: PatternCheck[]; unassessedModelFields: string[]; limitation: string }
export const PATTERN_GUIDE_TYPES = ['normal-pattern-deviation', 'data-quality', 'model-evidence-review'] as const
export type PatternGuideType = typeof PATTERN_GUIDE_TYPES[number]
export function patternGuide(type: PatternGuideType) {
  const guides = {
    'normal-pattern-deviation': {
      actions: ['이탈 항목의 현재값·정상 참조 범위·시각을 기록하고 같은 운전상태에서 표시값을 다시 확인하세요.', '최근 부하·작업 조건 변경과 센서 연결 상태를 담당자에게 확인하세요.'],
      steps: ['현재값과 참조 상·하한 기록', '운전상태와 표시값 재확인', '조건 변화와 반복 여부를 확인해 기록 전달'],
      reportConditions: ['같은 운전상태에서 재확인해도 범위 이탈이 반복되면 기록을 담당자에게 전달하세요.', '현장 이상 징후가 관찰되면 현장 절차에 따라 담당자에게 알리세요. 징후 발생 여부는 시스템에서 확인하지 않았습니다.'],
    },
    'data-quality': {
      actions: ['누락·비수치 항목과 발생 시각을 기록하고 센서 수신·필드 연결·단위 계약을 담당자에게 확인하세요.'],
      steps: ['누락 또는 비수치 항목 기록', '원시 수신값과 화면 값 대조', '데이터 담당자에게 확인 요청'],
      reportConditions: ['측정 자료를 재확인할 수 없거나 오류가 반복되면 담당자에게 확인을 요청하세요.'],
    },
    'model-evidence-review': {
      actions: ['검사한 단일 시점 값은 참조 범위 안입니다. 모델의 의심 항목과 전후 추이를 함께 확인하세요.'],
      steps: ['모델 의심 항목 확인', '같은 값 반복·시간·전력량 정합성 등 전후 추이 확인 요청'],
      reportConditions: ['모델 알림의 근거가 해소되지 않으면 해당 알림과 시각을 담당자에게 전달하세요.'],
    },
  }
  return { status: 'ok', source: 'PlantEye 프로젝트 데이터 확인 절차 v1', guideType: type, ...guides[type], applicability: '데이터 확인 안내이며 설비 조작·안전 승인·고장 확정 절차가 아닙니다.' }
}

const finite = (value: unknown): number | undefined => {
  if (typeof value !== 'string' || !value.trim()) return undefined
  const n = Number(value)
  return Number.isFinite(n) && n >= 0 ? n : undefined
}
export function assessNormalPattern(d: Decision, raw: Record<string, string> | undefined, policy: PatternPolicy, modelFields: readonly string[]): Decision {
  const profile = policy.equipment[d.equipmentId]
  const operationValue = finite(raw?.operation)
  const operation = operationValue === undefined ? null : String(operationValue)
  const state = operation === null ? undefined : profile?.states[operation]
  d.actions = []; d.steps = []; d.reportConditions = []; d.missingFields = []; d.anomalyTypes = []
  d.approvalStatus = 'configured'; d.demoOnly = false; d.ruleVersion = policy.version; d.priority = null
  d.source = `모델 알림 / ${profile?.source ?? '정상 참조 미등록'} / ${policy.version}`
  const checks: PatternCheck[] = []
  const values: Record<string, number | undefined> = Object.fromEntries(PATTERN_FIELDS.filter(f => f !== 'phaseImbalance').map(f => [f, finite(raw?.[f])]))
  const currents = [values.currentR, values.currentS, values.currentT]
  if (currents.every((v): v is number => v !== undefined)) {
    const average = currents.reduce((a, b) => a + b, 0) / 3
    values.phaseImbalance = average > 0 ? Math.max(...currents.map(v => Math.abs(v - average))) / average * 100 : undefined
  }
  if (!profile) d.missingFields.push('설비별 정상 참조 미등록')
  if (!raw) d.missingFields.push('발생 시점의 원시 관측 조회 미완료')
  if (!state) d.missingFields.push('운전상태가 누락되었거나 해당 상태의 정상 참조가 없습니다.')
  if (state && raw) {
    for (const field of PATTERN_FIELDS) {
      const bound = state.bounds[field]
      if (!bound) { d.missingFields.push(`${PATTERN_LABELS[field]}: 참조 범위 미등록`); continue }
      const value = values[field]
      const notApplicable = field === 'phaseImbalance' && currents.every(v => v === 0)
      const result = notApplicable ? 'not_applicable' : value === undefined ? 'invalid' : value < bound.lower || value > bound.upper ? 'outside' : 'inside'
      checks.push({ field, label: PATTERN_LABELS[field], value: value ?? null, lower: bound.lower, upper: bound.upper, unit: bound.unit, result })
      if (result === 'invalid') d.missingFields.push(`${PATTERN_LABELS[field]}: 측정값 누락·비수치 또는 음수`)
      if (result === 'outside') d.anomalyTypes.push(`${PATTERN_LABELS[field]} 정상 참조 범위 이탈`)
    }
  }
  const unassessed = modelFields.filter(f => !PATTERN_FIELDS.includes(f as typeof PATTERN_FIELDS[number]))
  let referenceTime = d.observedAt
  if (/T.*(?:Z|[+-]\d{2}:\d{2})$/.test(referenceTime)) {
    const parsed = Date.parse(referenceTime)
    referenceTime = Number.isFinite(parsed) ? new Date(parsed + 9 * 3600_000).toISOString().slice(0, 19) : ''
  }
  let observationKey = referenceTime.slice(0, 19).replace(/[^0-9]/g, '')
  if (observationKey.length === 12) observationKey += '00'
  const referenceTiming = !profile || !/^\d{14}$/.test(observationKey) ? 'unknown' : observationKey < profile.fitPeriod[0] ? 'after-observation' : observationKey <= profile.calibrationPeriod[1] ? 'overlaps-observation' : 'before-observation'
  d.pattern = { version: policy.version, referenceSource: profile?.source ?? '', referencePeriod: profile ? [...profile.fitPeriod.slice(0, 1), ...profile.calibrationPeriod.slice(-1)] : [], referenceTiming, operation, checks, unassessedModelFields: [...unassessed], limitation: '합성 정상 참조의 단일 시점 값 범위 비교입니다. 실제 고장·허용 한계, 값 고정·시계열·전력량 정합성은 별도입니다.' }
  const outside = checks.some(c => c.result === 'outside')
  const guide = patternGuide(d.missingFields.length ? 'data-quality' : outside ? 'normal-pattern-deviation' : 'model-evidence-review')
  d.actions.push(...guide.actions); d.steps.push(...guide.steps); d.reportConditions.push(...guide.reportConditions)
  if (outside && d.missingFields.length) {
    const rangeGuide = patternGuide('normal-pattern-deviation')
    d.actions.push(...rangeGuide.actions); d.steps.push(...rangeGuide.steps); d.reportConditions.push(...rangeGuide.reportConditions)
  }
  d.status = outside ? 'matched' : d.missingFields.length ? 'insufficient_data' : 'within_threshold'
  d.priority = outside || (raw && state && d.missingFields.length) ? 'medium' : null
  d.reportStatus = 'needs_confirmation'
  d.reportReason = '데이터 확인을 위한 안내입니다. 반복 여부·현장 징후와 담당자 보고 절차를 확인하세요. 고장이나 긴급성을 확정하지 않습니다.'
  return d
}

export function patternEvidenceText(pattern: PatternAssessment): string {
  const format = (value: number) => value.toLocaleString('ko-KR', { maximumFractionDigits: 6 })
  const relevant = pattern.checks.filter(c => c.result === 'outside' || c.result === 'invalid')
  const lines = relevant.map(c => `${c.label}: ${c.value === null ? '측정값 확인 필요' : format(c.value)} / 참조 ${format(c.lower)} ~ ${format(c.upper)} (${c.unit})`)
  if (!lines.length) lines.push(`단일 시점 범위 확인 ${pattern.checks.filter(c => c.result === 'inside').length}항목. 범위 안이라는 사실만으로 모델의 이상 의심을 해제하지 않습니다.`)
  if (pattern.unassessedModelFields.length) lines.push(`이 범위 검사에서 평가하지 않은 모델 항목: ${pattern.unassessedModelFields.join(', ')}`)
  lines.push(`참조 기간: ${pattern.referencePeriod.join(' ~ ')}`)
  if (pattern.referenceTiming === 'after-observation') lines.push('이 관측 이후의 자료로 만든 참조와 대조한 것입니다. 과거 시점의 탐지 성능 검증으로 해석하지 않습니다.')
  if (pattern.referenceTiming === 'overlaps-observation') lines.push('관측 시각이 참조 산출 기간에 포함됩니다. 독립 검증 사례가 아닙니다.')
  return [...lines, `정상 참조: ${pattern.referenceSource} / 운전상태 값 ${pattern.operation ?? '미확인'}`, pattern.limitation].join('\n')
}
