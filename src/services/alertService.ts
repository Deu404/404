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
    const measurement = asOptionalFiniteNumber(value.measurement)
    const reference = asOptionalFiniteNumber(value.reference)
    const change = asOptionalFiniteNumber(value.change)
    const classification = anomalyDetector({ type, measurement, reference, change })
    const state = asAlertState(value.state)
    const acknowledgementFallback: AlertAcknowledgement = state === 'resolved' ? 'acknowledged' : 'unacknowledged'
    return [{
      id,
      equipmentId: asString(value.equipmentId),
      occurredAt: asString(value.occurredAt),
      type,
      severity: classification.severity,
      priority: classification.priority,
      ...(asOptionalFiniteNumber(value.powerChangeKw) === undefined ? {} : { powerChangeKw: asOptionalFiniteNumber(value.powerChangeKw) }),
      ...(asOptionalFiniteNumber(value.changeRatePercent) === undefined ? {} : { changeRatePercent: asOptionalFiniteNumber(value.changeRatePercent) }),
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
