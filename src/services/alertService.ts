import { decideAlert } from '../shared/decision.ts'
import { dataProvider } from '../adapters/dataProvider'
import { asAlertAcknowledgement, asAlertState, asAlertType, asOptionalFiniteNumber, asString, isRecord } from './dataNormalization'
import { DEFAULT_ANOMALY_DETECTOR, type AnomalyDetector } from './alertRules'
import { getEquipmentById } from './equipmentService'
import type { Alert, AlertAcknowledgement, AlertPriority, AlertType } from '../types/alert'
import type { EquipmentStatus } from '../types/status'

function withRepeatCounts(alerts: Alert[]): Alert[] {
  const counts = alerts.reduce<Map<string, number>>((result, alert) => {
    const key = `${alert.equipmentId}:${alert.type}`
    result.set(key, (result.get(key) ?? 0) + 1)
    return result
  }, new Map())
  return alerts.map((alert) => ({ ...alert, repeatCount: counts.get(`${alert.equipmentId}:${alert.type}`) ?? 1 }))
}

export function normalizeAlerts(input: unknown, anomalyDetector: AnomalyDetector = DEFAULT_ANOMALY_DETECTOR): Alert[] {
  if (!Array.isArray(input)) return []

  return input.flatMap((value) => {
    if (!isRecord(value)) return []
    const id = asString(value.id).trim()
    if (!id) return []
    const type = asAlertType(value.type)
    const sourceType = !['overcurrent', 'low-power-factor', 'power-consumption-increase', 'phase-current-imbalance'].includes(String(value.type)) ? typeof value.type === 'string' ? value.type : '미등록 유형' : undefined
    const measurement = asOptionalFiniteNumber(value.measurement)
    const reference = asOptionalFiniteNumber(value.reference)
    let change = asOptionalFiniteNumber(value.change)
    const classification = anomalyDetector({ type, measurement, reference, change })
    const decision = decideAlert({ sourceType, id, equipmentId: asString(value.equipmentId), occurredAt: asString(value.occurredAt), type, measurement, reference, change })
    if (anomalyDetector === DEFAULT_ANOMALY_DETECTOR) {
      classification.priority = decision.priority ?? 'medium'
      if (decision.status === 'no_applicable_rule') classification.ruleResult = { matched: false, reason: '이 유형에 등록된 판정 룰이 없어 담당자 확인이 필요합니다.', demoOnly: true }
      classification.severity = decision.priority === 'high' ? 'critical' : decision.priority === 'low' ? 'normal' : 'warning'
    }
    const calculatedChange = type === 'power-consumption-increase' && !sourceType ? decision.evaluations[0]?.measurement : null
    if (calculatedChange !== null && calculatedChange !== undefined) change = Math.round(calculatedChange * 10) / 10
    const state = asAlertState(value.state)
    const acknowledgementFallback: AlertAcknowledgement = state === 'resolved' ? 'acknowledged' : 'unacknowledged'
    return [{
      id,
      equipmentId: asString(value.equipmentId),
      occurredAt: asString(value.occurredAt),
      type,
      ...(sourceType ? { sourceType } : {}),
      severity: classification.severity,
      priority: classification.priority,
      ...(asOptionalFiniteNumber(value.powerChangeKw) === undefined ? {} : { powerChangeKw: asOptionalFiniteNumber(value.powerChangeKw) }),
      ...(calculatedChange !== null && calculatedChange !== undefined ? { changeRatePercent: change } : asOptionalFiniteNumber(value.changeRatePercent) === undefined ? {} : { changeRatePercent: asOptionalFiniteNumber(value.changeRatePercent) }),
      ...(measurement === undefined ? {} : { measurement }),
      ...(reference === undefined ? {} : { reference }),
      ...(change === undefined ? {} : { change }),
      summary: asString(value.summary),
      detail: asString(value.detail),
      guideKey: asString(value.guideKey),
      state,
      acknowledgement: asAlertAcknowledgement(value.acknowledgement, acknowledgementFallback),
      ruleResult: classification.ruleResult,
    }]
  })
}

export function listAlerts(anomalyDetector: AnomalyDetector = DEFAULT_ANOMALY_DETECTOR): Alert[] {
  return withRepeatCounts(normalizeAlerts(dataProvider.alerts, anomalyDetector))
}

export function getAlertById(alertId: string | null | undefined, anomalyDetector: AnomalyDetector = DEFAULT_ANOMALY_DETECTOR): Alert | undefined {
  if (!alertId) return undefined
  return listAlerts(anomalyDetector).find(({ id }) => id === alertId)
}

export function getAlertsByEquipmentId(equipmentId: string | null | undefined, anomalyDetector: AnomalyDetector = DEFAULT_ANOMALY_DETECTOR): Alert[] {
  if (!equipmentId) return []
  return listAlerts(anomalyDetector).filter(({ equipmentId: id }) => id === equipmentId)
}

export const getAlertsByEquipment = getAlertsByEquipmentId

export function getAlertsByType(alertType: AlertType | null | undefined, anomalyDetector: AnomalyDetector = DEFAULT_ANOMALY_DETECTOR): Alert[] {
  if (!alertType) return []
  return listAlerts(anomalyDetector).filter(({ type }) => type === alertType)
}

export function getAlertRepeatCount(equipmentId: string, alertType: AlertType, anomalyDetector: AnomalyDetector = DEFAULT_ANOMALY_DETECTOR): number {
  return getAlertsByEquipmentId(equipmentId, anomalyDetector).filter(({ type }) => type === alertType).length
}

export function getDefaultAlert(anomalyDetector: AnomalyDetector = DEFAULT_ANOMALY_DETECTOR): Alert | undefined {
  return listAlerts(anomalyDetector)[0]
}

// Invalid alert IDs intentionally remain empty; only guide/equipment screens retain their legacy default selection.
export function resolveAlert(alertId: string | null | undefined, anomalyDetector: AnomalyDetector = DEFAULT_ANOMALY_DETECTOR): Alert | undefined {
  return getAlertById(alertId, anomalyDetector)
}

export function getEquipmentName(equipmentId: string): string {
  return getEquipmentById(equipmentId)?.name ?? equipmentId
}

export const alertTypeLabels = dataProvider.alertTypeLabels
export const priorityLabels = dataProvider.priorityLabels
export const priorityOrder = dataProvider.priorityOrder
export const severityLabels = dataProvider.severityLabels
export const severityOrder = dataProvider.severityOrder
export type { AlertAcknowledgement, AlertPriority, AlertType, EquipmentStatus }
