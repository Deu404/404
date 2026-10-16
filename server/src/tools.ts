// 에이전트 도구 6개. AI 연결 전에 단독 실행으로 검증 가능하도록 순수 함수로 작성한다.
// 계산·규칙 판단은 모두 여기서 수행하고, 요약된 결과만 반환한다(원본 전체를 반환하지 않음).
import { findDemoCase } from './fixtures/demoCases.ts'
import { findDemoGuide } from './fixtures/demoGuides.ts'
import { DEMO_PRIORITY, RULE_VERSION, evaluateAll, ruleId } from './rules.ts'
import type {
  AlertType,
  AnomalyCaseResult,
  ClassifyResult,
  GuideResult,
  PriorityResult,
  ToolMeta,
} from './types.ts'

const VALID_TYPES: AlertType[] = ['overcurrent', 'low-power-factor', 'power-consumption-increase', 'phase-current-imbalance']

function baseMeta(partial: Partial<ToolMeta> & Pick<ToolMeta, 'status' | 'message'>): ToolMeta {
  const meta: ToolMeta = {
    dataSource: 'synthetic',
    demoOnly: true,
    missingFields: [],
    ...partial,
  }
  // 여러 유형 평가에서 같은 항목이 중복 수집될 수 있으므로 중복 제거한다.
  meta.missingFields = [...new Set(meta.missingFields)]
  return meta
}

// 사례의 측정값 중 평가에 필요한 누락 항목을 모은다.
function collectMissing(caseId: string): string[] {
  const c = findDemoCase(caseId)
  if (!c) return []
  const m = c.measurements
  const missing: string[] = []
  for (const [k, v] of Object.entries(m)) if (v === null) missing.push(k)
  if (c.comparison === null || c.comparison.referencePower === null) missing.push('comparison.referencePower')
  return missing
}

// ---- 1) get_anomaly_case ----
export function get_anomaly_case(input?: { caseId?: unknown }): AnomalyCaseResult | ToolMeta {
  const caseId = input?.caseId
  if (typeof caseId !== 'string' || caseId.trim() === '') {
    return baseMeta({ status: 'invalid_input', message: 'caseId(문자열)가 필요합니다.' })
  }
  const c = findDemoCase(caseId)
  if (!c) {
    return baseMeta({ status: 'not_found', caseId, message: `사례 ${caseId}를 찾을 수 없습니다. 다른 사례로 대체하지 않습니다.` })
  }
  const missing = collectMissing(caseId)
  return {
    ...baseMeta({
      status: missing.length ? 'partial' : 'ok',
      caseId: c.caseId,
      caseVersion: c.caseVersion,
      missingFields: missing,
      message: missing.length ? `사례를 조회했으나 일부 측정값이 누락되었습니다.` : '사례를 조회했습니다.',
    }),
    equipmentId: c.equipmentId,
    equipmentName: c.equipmentName,
    location: c.location,
    measuredAt: c.measuredAt,
    measurements: c.measurements,
    units: { current: 'A', powerFactor: 'ratio_0_1', activePower: 'kW' },
    comparison: c.comparison,
    detectorResult: c.detectorResult ?? null,
  }
}

// ---- 2) classify_anomaly ----
export function classify_anomaly(input?: { caseId?: unknown }): ClassifyResult | ToolMeta {
  const caseId = input?.caseId
  if (typeof caseId !== 'string' || caseId.trim() === '') {
    return baseMeta({ status: 'invalid_input', message: 'caseId(문자열)가 필요합니다.' })
  }
  const c = findDemoCase(caseId)
  if (!c) {
    return baseMeta({ status: 'not_found', caseId, message: `사례 ${caseId}를 찾을 수 없습니다.` })
  }
  const evaluations = evaluateAll(c)
  const anyMatched = evaluations.some((e) => e.result === 'matched')
  const anyInsufficient = evaluations.some((e) => e.result === 'insufficient_data')
  const status = anyInsufficient ? (anyMatched ? 'partial' : 'partial') : 'ok'
  const message = anyMatched
    ? '하나 이상의 이상 조건이 확인되었습니다.'
    : anyInsufficient
      ? '일부 유형은 데이터 부족으로 판정을 보류했습니다. 미일치 유형만으로 정상을 단정하지 않습니다.'
      : '이 규칙에서 이상 조건이 확인되지 않았습니다. 실제 안전을 보증하지는 않습니다.'
  return {
    ...baseMeta({
      status,
      caseId: c.caseId,
      caseVersion: c.caseVersion,
      ruleVersion: RULE_VERSION,
      missingFields: evaluations.flatMap((e) => e.missingFields),
      message,
    }),
    evaluations,
  }
}

// ---- 3) evaluate_priority ----
export function evaluate_priority(input?: { caseId?: unknown }): PriorityResult | ToolMeta {
  const caseId = input?.caseId
  if (typeof caseId !== 'string' || caseId.trim() === '') {
    return baseMeta({ status: 'invalid_input', message: 'caseId(문자열)가 필요합니다.' })
  }
  const c = findDemoCase(caseId)
  if (!c) {
    return baseMeta({ status: 'not_found', caseId, message: `사례 ${caseId}를 찾을 수 없습니다.` })
  }
  const evaluations = evaluateAll(c)

  const priorities = evaluations
    .filter((e) => e.result === 'matched')
    .map((e) => ({
      alertType: e.alertType,
      priority: DEMO_PRIORITY[e.alertType],
      ruleId: ruleId(e.alertType),
      reason: e.reason,
      evidence: { measurement: e.measurement, unit: e.unit, threshold: e.threshold },
    }))
    // high → medium 순 정렬. 같은 우선순위는 입력 순서 유지(임의 순위 안 만듦).
    .sort((a, b) => (a.priority === b.priority ? 0 : a.priority === 'high' ? -1 : 1))

  // 데이터 부족으로 판정 못한 유형만 미평가로. within_threshold는 '이상 없음'이지 미평가가 아니다.
  const unassessedTypes = evaluations.filter((e) => e.result === 'insufficient_data').map((e) => e.alertType)

  const status = priorities.length ? (unassessedTypes.length ? 'partial' : 'ok') : unassessedTypes.length ? 'partial' : 'ok'
  const message = priorities.length
    ? `확인된 이상 ${priorities.length}건의 우선순위를 산정했습니다.`
    : unassessedTypes.length
      ? '우선순위를 매길 이상이 확인되지 않았고 일부 유형은 데이터 부족으로 보류했습니다.'
      : '이 규칙에서 우선순위를 매길 이상이 확인되지 않았습니다.'

  return {
    ...baseMeta({
      status,
      caseId: c.caseId,
      caseVersion: c.caseVersion,
      ruleVersion: RULE_VERSION,
      missingFields: evaluations.flatMap((e) => e.missingFields),
      message,
    }),
    priorities,
    unassessedTypes,
  }
}

// ---- 4) get_inspection_guide ----
export function get_inspection_guide(input?: { alertType?: unknown }): GuideResult | ToolMeta {
  const alertType = input?.alertType
  if (typeof alertType !== 'string' || !VALID_TYPES.includes(alertType as AlertType)) {
    return baseMeta({ status: 'invalid_input', message: `alertType은 ${VALID_TYPES.join(', ')} 중 하나여야 합니다.` })
  }
  const g = findDemoGuide(alertType)
  if (!g) {
    // 정확 일치만 반환. 기본 가이드로 대체하지 않는다.
    return baseMeta({ status: 'not_found', message: `${alertType} 유형의 등록된 가이드가 없습니다. 임의 절차를 만들지 않고 담당자 확인을 안내합니다.` })
  }
  return {
    ...baseMeta({ status: 'ok', message: '등록된 가이드를 조회했습니다.' }),
    guideKey: g.guideKey,
    alertType: g.alertType,
    title: g.title,
    initialResponse: g.initialResponse,
    operatorChecks: g.operatorChecks,
    steps: g.steps,
    reportConditions: g.reportConditions,
    source: g.source,
    guideVersion: g.guideVersion,
  }
}

// 예측과 경영 조회는 전달 CSV에서 매번 집계한다.
export { readForecast as get_forecast_summary, readExecutiveReport as get_executive_report_data } from './forecast.ts'
import { readForecast as get_forecast_summary, readExecutiveReport as get_executive_report_data } from './forecast.ts'

export const TOOLS = {
  get_anomaly_case,
  classify_anomaly,
  evaluate_priority,
  get_inspection_guide,
  get_forecast_summary,
  get_executive_report_data,
}
