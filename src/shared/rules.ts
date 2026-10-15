// 데모 규칙과 분류 계산 로직.
// 임계치는 기존 프런트 src/services/alertRules.ts의 DEMO_ALERT_RULES와 동일하다(데모 기준, 실제 안전 기준 아님).
// 모든 수치 계산은 여기(도구 쪽)에서 수행한다. LLM은 계산하지 않는다.
import type { AlertType, DemoCase, Evaluation, Priority } from './types.ts'

export const RULE_VERSION = 'rule-v2'

export const DEMO_THRESHOLDS = {
  overcurrent: { value: 100, unit: 'A', operator: '>' as const },
  'low-power-factor': { value: 0.85, unit: 'ratio_0_1', operator: '<' as const },
  'power-consumption-increase': { value: 10, unit: '%', operator: '>' as const },
  'phase-current-imbalance': { value: 10, unit: '%', operator: '>' as const },
}

// 데모 우선순위 정책: 과전류·불균형 = high, 역률·소비증가 = medium.
export const DEMO_PRIORITY: Record<AlertType, Priority> = {
  overcurrent: 'high',
  'phase-current-imbalance': 'high',
  'low-power-factor': 'medium',
  'power-consumption-increase': 'medium',
}

export function thresholdExceeded(type: AlertType, value: number): boolean {
  const t = DEMO_THRESHOLDS[type]
  return t.operator === '<' ? value < t.value : value > t.value
}

export function ruleId(type: AlertType): string {
  return `demo-${type}-v1`
}

type Phases = Array<number | null>

function presentNumbers(values: Phases): number[] {
  return values.filter((v): v is number => typeof v === 'number' && Number.isFinite(v))
}

// --- 과전류: 상별 전류 중 하나라도 기준 초과 ---
export function evalOvercurrent(c: DemoCase): Evaluation {
  const t = DEMO_THRESHOLDS.overcurrent
  const phases = { R: c.measurements.currentR, S: c.measurements.currentS, T: c.measurements.currentT }
  const present = Object.entries(phases).filter(([, v]) => typeof v === 'number' && Number.isFinite(v) && v >= 0) as Array<[string, number]>
  const missing = Object.entries(phases).filter(([, v]) => !(typeof v === 'number' && Number.isFinite(v) && v >= 0)).map(([k]) => `current${k}`)

  if (present.length === 0) {
    return mkEval('overcurrent', 'insufficient_data', null, t.unit, t.value, t.operator,
      '상별 전류값이 없어 과전류를 판정할 수 없습니다.', ['currentR', 'currentS', 'currentT'])
  }
  const over = present.filter(([, v]) => thresholdExceeded('overcurrent', v)).sort((a, b) => b[1] - a[1])
  if (over.length > 0) {
    const [phase, value] = over[0]
    return mkEval('overcurrent', 'matched', value, t.unit, t.value, t.operator,
      `${phase}상 전류 ${value} A가 데모 기준 ${t.value} A를 초과함`, missing)
  }
  const maxV = Math.max(...present.map(([, v]) => v))
  return mkEval('overcurrent', missing.length ? 'insufficient_data' : 'within_threshold', maxV, t.unit, t.value, t.operator,
    `측정된 상별 전류 최대 ${maxV} A가 데모 기준 ${t.value} A 이하임`, missing)
}

// --- 역률 저하: 유효한 상별 역률 중 하나라도 기준 미만 ---
export function evalLowPowerFactor(c: DemoCase): Evaluation {
  const t = DEMO_THRESHOLDS['low-power-factor']
  const validRatio = (v: number | null) => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1 ? v : null
  const phases = { R: validRatio(c.measurements.powerFactorR), S: validRatio(c.measurements.powerFactorS), T: validRatio(c.measurements.powerFactorT) }
  const present = Object.entries(phases).filter(([, v]) => typeof v === 'number' && Number.isFinite(v) && v >= 0) as Array<[string, number]>
  const missing = Object.entries(phases).filter(([, v]) => !(typeof v === 'number' && Number.isFinite(v) && v >= 0)).map(([k]) => `powerFactor${k}`)

  if (present.length === 0) {
    return mkEval('low-power-factor', 'insufficient_data', null, t.unit, t.value, t.operator,
      '상별 역률값이 없어 역률 저하를 판정할 수 없습니다.', ['powerFactorR', 'powerFactorS', 'powerFactorT'])
  }
  const low = present.filter(([, v]) => thresholdExceeded('low-power-factor', v)).sort((a, b) => a[1] - b[1])
  if (low.length > 0) {
    const [phase, value] = low[0]
    return mkEval('low-power-factor', 'matched', value, t.unit, t.value, t.operator,
      `${phase}상 역률 ${value}가 데모 기준 ${t.value} 미만임`, missing)
  }
  const minV = Math.min(...present.map(([, v]) => v))
  return mkEval('low-power-factor', missing.length ? 'insufficient_data' : 'within_threshold', minV, t.unit, t.value, t.operator,
    `측정된 상별 역률 최소 ${minV}가 데모 기준 ${t.value} 이상임`, missing)
}

// --- 전력 소비 증가: (현재-비교)/비교 × 100 ---
export function evalConsumptionIncrease(c: DemoCase): Evaluation {
  const t = DEMO_THRESHOLDS['power-consumption-increase']
  const current = c.measurements.activePower
  const ref = c.comparison?.referencePower ?? null
  const missing: string[] = []
  if (current === null) missing.push('activePower')
  if (ref === null) missing.push('comparison.referencePower')

  if (current === null || ref === null || !Number.isFinite(current) || !Number.isFinite(ref) || current < 0 || ref <= 0) {
    const why = ref === 0 ? '비교 전력이 0이라 변화율을 계산할 수 없습니다.' : '현재 전력 또는 비교 전력이 없어 변화율을 계산할 수 없습니다.'
    return mkEval('power-consumption-increase', 'insufficient_data', null, t.unit, t.value, t.operator, why,
      ref === 0 ? ['comparison.referencePower(=0)'] : missing)
  }
  const rawRate = ((current - ref) / ref) * 100
  const rate = Math.round(rawRate * 10) / 10 // 소수 1자리
  if (thresholdExceeded('power-consumption-increase', rawRate)) {
    return mkEval('power-consumption-increase', 'matched', rate, t.unit, t.value, t.operator,
      `변화율 ${rate} % = (${current}-${ref})/${ref}×100가 데모 기준 ${t.value} %를 초과함`, missing)
  }
  return mkEval('power-consumption-increase', 'within_threshold', rate, t.unit, t.value, t.operator,
    `변화율 ${rate} %가 데모 기준 ${t.value} % 이하임`, missing)
}

// --- 상간 전류 불균형: 최대 상별 편차 / 평균전류 × 100 (프로젝트 제안식) ---
export function evalPhaseImbalance(c: DemoCase): Evaluation {
  const t = DEMO_THRESHOLDS['phase-current-imbalance']
  const all = [c.measurements.currentR, c.measurements.currentS, c.measurements.currentT]
  const present = presentNumbers(all)
  const missing = ['currentR', 'currentS', 'currentT'].filter((_, i) => typeof all[i] !== 'number' || !Number.isFinite(all[i]) || all[i]! < 0)

  if (present.length < 3 || missing.length > 0) {
    return mkEval('phase-current-imbalance', 'insufficient_data', null, t.unit, t.value, t.operator,
      'R/S/T 세 상 전류가 모두 있어야 불균형을 판정할 수 있습니다.', missing)
  }
  const avg = present.reduce((a, b) => a + b, 0) / present.length
  if (avg <= 0) {
    return mkEval('phase-current-imbalance', 'insufficient_data', null, t.unit, t.value, t.operator,
      '평균 전류가 0이라 불균형 비율을 계산할 수 없습니다.', missing)
  }
  const maxDev = Math.max(...present.map((v) => Math.abs(v - avg)))
  const rawRate = (maxDev / avg) * 100
  const rate = Math.round(rawRate * 10) / 10
  if (thresholdExceeded('phase-current-imbalance', rawRate)) {
    return mkEval('phase-current-imbalance', 'matched', rate, t.unit, t.value, t.operator,
      `불균형율 ${rate} % = 최대편차 ${Math.round(maxDev * 10) / 10}/평균 ${Math.round(avg * 10) / 10}×100가 데모 기준 ${t.value} %를 초과함(제안식, 공식 표준 아님)`, missing)
  }
  return mkEval('phase-current-imbalance', 'within_threshold', rate, t.unit, t.value, t.operator,
    `불균형율 ${rate} %가 데모 기준 ${t.value} % 이하임(제안식)`, missing)
}

function mkEval(
  alertType: AlertType,
  result: Evaluation['result'],
  measurement: number | null,
  unit: string,
  threshold: number | null,
  operator: Evaluation['comparisonOperator'],
  reason: string,
  missingFields: string[],
): Evaluation {
  return { alertType, result, measurement, unit, threshold, comparisonOperator: operator, ruleId: ruleId(alertType), reason, missingFields }
}

export function evaluateAll(c: DemoCase): Evaluation[] {
  return [evalOvercurrent(c), evalLowPowerFactor(c), evalConsumptionIncrease(c), evalPhaseImbalance(c)]
}
