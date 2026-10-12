import type { Alert, AlertPriority, AlertRuleResult, AlertType } from '../types/alert'
import type { EquipmentStatus } from '../types/status'

export type AlertRuleDefinition = {
  label: string
  demoThreshold: number
  thresholdUnit: string
  description: string
}

export const DEMO_ALERT_RULES: Record<AlertType, AlertRuleDefinition> = {
  overcurrent: { label: '과전류', demoThreshold: 100, thresholdUnit: 'A', description: '측정 전류가 데모 기준값을 초과하면 검토 대상으로 분류합니다.' },
  'low-power-factor': { label: '역률 저하', demoThreshold: 0.85, thresholdUnit: '역률', description: '측정 역률이 데모 기준값보다 낮으면 검토 대상으로 분류합니다.' },
  'power-consumption-increase': { label: '전력 소비 증가', demoThreshold: 10, thresholdUnit: '%', description: '기준 대비 변화율이 데모 기준값을 초과하면 검토 대상으로 분류합니다.' },
  'phase-current-imbalance': { label: 'R/S/T상 전류 불균형', demoThreshold: 10, thresholdUnit: '%', description: '상간 변화율이 데모 기준값을 초과하면 검토 대상으로 분류합니다.' },
}

export type AlertRuleInput = Pick<Alert, 'type' | 'measurement' | 'reference' | 'change'>

export type AlertClassification = {
  severity: EquipmentStatus
  priority: AlertPriority
  ruleResult: AlertRuleResult
}

export type AnomalyDetector = (input: AlertRuleInput) => AlertClassification

export function evaluateAlertRule(input: AlertRuleInput): AlertRuleResult {
  const rule = DEMO_ALERT_RULES[input.type]
  const value = input.type === 'overcurrent' || input.type === 'low-power-factor' ? input.measurement : input.change
  const matched = value !== undefined && (input.type === 'low-power-factor' ? value < rule.demoThreshold : value > rule.demoThreshold)
  const valueText = value === undefined ? '측정값 없음' : `${value} ${rule.thresholdUnit}`
  const comparison = input.type === 'low-power-factor' ? '미만' : '초과'

  return {
    matched,
    reason: matched
      ? `${rule.label}: ${valueText}가 데모 기준 ${rule.demoThreshold} ${rule.thresholdUnit} ${comparison}입니다.`
      : value === undefined
        ? `${rule.label}: 판단에 필요한 측정값이 없어 데이터 없음으로 표시합니다.`
        : `${rule.label}: ${valueText}가 데모 기준 범위 안이거나 추가 확인이 필요합니다.`,
    demoThreshold: rule.demoThreshold,
    thresholdUnit: rule.thresholdUnit,
    demoOnly: true,
  }
}

export function classifyAlert(input: AlertRuleInput): AlertClassification {
  const ruleResult = evaluateAlertRule(input)
  if (!ruleResult.matched) return { severity: 'normal', priority: 'low', ruleResult }

  const urgent = input.type === 'overcurrent' || input.type === 'phase-current-imbalance'
  return {
    severity: urgent ? 'critical' : 'warning',
    priority: urgent ? 'high' : 'medium',
    ruleResult,
  }
}

export const DEFAULT_ANOMALY_DETECTOR: AnomalyDetector = classifyAlert

// Descriptive aliases for consumers that use the domain terminology.
export const getAlertClassification = classifyAlert
export const getAlertRuleResult = evaluateAlertRule
