import { evaluateAlertInput, LABELS } from '../shared/decision.ts'
import { DEMO_THRESHOLDS, DEMO_PRIORITY } from '../shared/rules.ts'
import type { Alert, AlertPriority, AlertRuleResult, AlertType } from '../types/alert'
import type { EquipmentStatus } from '../types/status'

export type AlertRuleDefinition = {
  label: string
  demoThreshold: number
  thresholdUnit: string
  description: string
}

export const DEMO_ALERT_RULES = Object.fromEntries(Object.entries(DEMO_THRESHOLDS).map(([key, t]) => [key, { label: LABELS[key as AlertType], demoThreshold: t.value, thresholdUnit: t.unit, description: '공통 데모 기준' }])) as Record<AlertType, AlertRuleDefinition>

export type AlertRuleInput = Pick<Alert, 'type' | 'measurement' | 'reference' | 'change'>

export type AlertClassification = {
  severity: EquipmentStatus
  priority: AlertPriority
  ruleResult: AlertRuleResult
}

export type AnomalyDetector = (input: AlertRuleInput) => AlertClassification

export function evaluateAlertRule(input: AlertRuleInput): AlertRuleResult {
  const e = evaluateAlertInput(input)!
  return { matched: e.result === 'matched', reason: e.reason, demoThreshold: e.threshold ?? undefined, thresholdUnit: e.unit, demoOnly: true }
}
export function classifyAlert(input: AlertRuleInput): AlertClassification {
  const ruleResult = evaluateAlertRule(input)
  const e = evaluateAlertInput(input)!
  const priority = e.result === 'matched' ? DEMO_PRIORITY[e.alertType] : e.result === 'insufficient_data' ? 'medium' : 'low'
  return { severity: priority === 'high' ? 'critical' : priority === 'medium' ? 'warning' : 'normal', priority, ruleResult }
}

export const DEFAULT_ANOMALY_DETECTOR: AnomalyDetector = classifyAlert

// Descriptive aliases for consumers that use the domain terminology.
export const getAlertClassification = classifyAlert
export const getAlertRuleResult = evaluateAlertRule
