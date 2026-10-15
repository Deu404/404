import { DEMO_THRESHOLDS, DEMO_PRIORITY, RULE_VERSION, evaluateAll, ruleId, thresholdExceeded } from './rules.ts'
import { findDemoGuide } from './demoGuides.ts'
import { EQUIPMENT_LAYOUT } from '../config/equipmentDataMap.ts'
import type { AlertType, DemoCase, Evaluation } from './types.ts'

export const LABELS: Record<AlertType, string> = { overcurrent: '과전류 의심', 'low-power-factor': '역률 저하', 'power-consumption-increase': '전력 소비 증가', 'phase-current-imbalance': '상별 전류 차이 증가' }
export type AlertInput = { id: string; equipmentId: string; occurredAt: string; type: string; sourceType?: string; measurement?: number; reference?: number; change?: number }
export type Decision = {
  inputId: string; equipmentId: string; equipmentName: string; observedAt: string
  ruleVersion: string; demoOnly: boolean; approvalStatus: 'demo'; source: string
  status: 'matched' | 'within_threshold' | 'insufficient_data' | 'no_applicable_rule'
  priority: 'high' | 'medium' | 'low' | null
  evaluations: Evaluation[]; anomalyTypes: string[]; actions: string[]
  steps: string[]; reportConditions: string[]; missingFields: string[]
  reportStatus: 'required' | 'needs_confirmation'; reportReason: string
}

export function evaluateValue(type: string, value: unknown): Evaluation | undefined {
  if (!Object.hasOwn(DEMO_THRESHOLDS, type)) return undefined
  const key = type as AlertType
  const t = DEMO_THRESHOLDS[key]
  const valid = typeof value === 'number' && Number.isFinite(value) && (value >= 0 || key === 'power-consumption-increase') && (key !== 'low-power-factor' || value <= 1)
  const matched = valid && thresholdExceeded(key, value)
  return { alertType: key, result: !valid ? 'insufficient_data' : matched ? 'matched' : 'within_threshold', measurement: valid ? value : null,
    unit: t.unit, threshold: t.value, comparisonOperator: t.operator, ruleId: ruleId(key),
    reason: !valid ? '판단에 필요한 측정값이나 단위를 확인해야 합니다.' : `${LABELS[key]}: ${value} ${t.unit} / 데모 기준 ${t.operator} ${t.value} ${t.unit}`,
    missingFields: valid ? [] : [key === 'low-power-factor' ? '역률(0~1)' : '유효한 측정값'] }
}

function assemble(identity: Pick<Decision, 'inputId' | 'equipmentId' | 'equipmentName' | 'observedAt' | 'source'>, evaluations: Evaluation[]): Decision {
  const matches = evaluations.filter(e => e.result === 'matched')
  const guides = matches.map(e => findDemoGuide(e.alertType)).filter(g => g !== undefined)
  const unique = (values: string[]) => [...new Set(values)]
  // 현재 데모 가이드에 담당자 전달/보고가 첫 행동으로 명시된 두 유형만 확정한다.
  const required = matches.some(e => e.alertType === 'phase-current-imbalance' || e.alertType === 'low-power-factor')
  return { ...identity, ruleVersion: RULE_VERSION, demoOnly: true, approvalStatus: 'demo',
    status: !evaluations.length ? 'no_applicable_rule' : matches.length ? 'matched' : evaluations.some(e => e.result === 'insufficient_data') ? 'insufficient_data' : 'within_threshold',
    priority: matches.some(e => DEMO_PRIORITY[e.alertType] === 'high') ? 'high' : matches.length ? 'medium' : evaluations.length && evaluations.every(e => e.result === 'within_threshold') ? 'low' : null,
    evaluations, anomalyTypes: matches.map(e => LABELS[e.alertType]),
    actions: unique(guides.map(g => g.initialResponse)), steps: unique(guides.flatMap(g => g.steps.map(s => s.label))),
    reportConditions: unique(guides.flatMap(g => g.reportConditions)), missingFields: unique(evaluations.flatMap(e => e.missingFields)),
    reportStatus: required ? 'required' : 'needs_confirmation',
    reportReason: required ? '연습용 가이드에 따라 전기 담당자에게 전달·보고하세요. 즉시 보고 여부는 아래 유형별 행동 안내를 따르세요.' : '현재 자료만으로 보고 여부를 확정할 수 없어요. 아래 조건과 현장 보고 절차를 확인하세요.' }
}

export function evaluateAlertInput(input: Pick<AlertInput, 'type' | 'measurement' | 'reference' | 'change'>): Evaluation | undefined {
  let value: unknown = input.type === 'overcurrent' || input.type === 'low-power-factor' ? input.measurement : input.change
  // 전력 비교값이 제공되면 표시용 변화율 대신 원래 값으로 다시 계산한다.
  if (input.type === 'power-consumption-increase' && (input.measurement !== undefined || input.reference !== undefined)) {
    value = typeof input.measurement === 'number' && Number.isFinite(input.measurement) && input.measurement >= 0 && typeof input.reference === 'number' && Number.isFinite(input.reference) && input.reference > 0
      ? ((input.measurement - input.reference) / input.reference) * 100 : undefined
  }
  return evaluateValue(input.type, value)
}

export function decideAlert(input: AlertInput): Decision {
  input = { ...input, type: input.sourceType ?? input.type }
  const equipment = EQUIPMENT_LAYOUT.find(e => e.id === input.equipmentId)
  const evaluation = evaluateAlertInput(input)
  const decision = assemble({ inputId: input.id, equipmentId: input.equipmentId, equipmentName: equipment?.name ?? '이름이 확인되지 않은 설비', observedAt: input.occurredAt, source: '선택한 개발용 알림의 측정값' }, evaluation ? [evaluation] : [])
  if (!equipment) { decision.status = 'insufficient_data'; decision.priority = null; decision.missingFields.push('설비 이름·연결 정보') }
  return decision
}

export function decideCase(c: DemoCase): Decision {
  return assemble({ inputId: c.caseId, equipmentId: c.equipmentId, equipmentName: c.equipmentName, observedAt: c.measuredAt, source: '저장된 연습용 사례' }, evaluateAll(c))
}

export function formatObservedAt(value: string): string {
  const iso = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(value) ? value.replace(' ', 'T') + ':00+09:00' : value
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? '측정 시각 확인 필요' : date.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: 'numeric' })
}

export function decisionSummary(d: Decision): string {
  const priority = d.priority === 'high' ? '🔴 우선 확인' : d.priority === 'medium' ? '🟡 주의' : d.priority === 'low' ? '기준 이내' : '확인 필요'
  return `${priority} · ${d.equipmentName} · ${formatObservedAt(d.observedAt)}\n${d.anomalyTypes.join(', ') || (d.status === 'within_threshold' ? '적용한 룰의 기준 이내예요. 실제 안전을 보증하지는 않아요.' : '자료가 부족하거나 적용할 룰이 없어 확인이 필요해요.')}\n👉 ${d.actions[0] ?? '측정 자료와 등록된 기준을 담당자에게 확인하세요.'}`
}

export function reportText(d: Decision): string {
  return `[${d.demoOnly ? '연습용 사례 ' : ''}보고 초안]\n${decisionSummary(d)}\n${d.actions.slice(1).join("\n")}\n보고 안내: ${d.reportReason}\n${d.reportConditions.join('\n')}\n${d.missingFields.length ? '미확인 정보가 있어 추가 확인이 필요합니다.' : '현장 증상과 조치 수행 여부는 확인되지 않았습니다.'}`
}
