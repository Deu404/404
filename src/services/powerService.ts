import { dataProvider } from '../adapters/dataProvider'
import type { AlertSummary } from '../types/alert'
import type { Equipment, EquipmentDetail, AnomalyHistoryItem } from '../types/equipment'
import type { EnergyComparison } from '../types/comparison'
import type { DashboardPowerPoint, HourlyPowerPoint } from '../types/power'
import { asEquipmentStatus, asOptionalFiniteNumber, asAlertState, asString, isRecord } from './dataNormalization'
import { normalizeEquipmentList } from './equipmentService'

function normalizeHourlySeries(input: unknown): HourlyPowerPoint[] {
  if (!Array.isArray(input)) return []

  return input.flatMap((value) => {
    if (!isRecord(value)) return []
    const time = asString(value.time).trim()
    if (!time) return []
    const powerKw = asOptionalFiniteNumber(value.powerKw)
    return [{ time, ...(powerKw === undefined ? {} : { powerKw }) }]
  })
}

function normalizeEnergyComparison(input: unknown): EnergyComparison {
  if (!isRecord(input)) return {}
  const current = asOptionalFiniteNumber(input.current)
  const lastMonth = asOptionalFiniteNumber(input.lastMonth)
  const difference = asOptionalFiniteNumber(input.difference)
  const changeRatePercent = asOptionalFiniteNumber(input.changeRatePercent)
  return {
    ...(current === undefined ? {} : { current }),
    ...(lastMonth === undefined ? {} : { lastMonth }),
    ...(difference === undefined ? {} : { difference }),
    ...(changeRatePercent === undefined ? {} : { changeRatePercent }),
  }
}

function normalizeAnomalyHistory(input: unknown): AnomalyHistoryItem[] {
  if (!Array.isArray(input)) return []

  return input.flatMap((value) => {
    if (!isRecord(value)) return []
    const detectedAt = asString(value.detectedAt)
    const message = asString(value.message)
    if (!detectedAt && !message) return []
    return [{
      detectedAt,
      severity: asEquipmentStatus(value.severity),
      message,
      state: asAlertState(value.state),
    }]
  })
}

export function normalizeEquipmentDetails(input: unknown): EquipmentDetail[] {
  if (!Array.isArray(input)) return []

  return input.flatMap((value) => {
    if (!isRecord(value)) return []
    const equipmentId = asString(value.equipmentId).trim()
    if (!equipmentId) return []
    return [{
      equipmentId,
      ...(asOptionalFiniteNumber(value.powerKw) === undefined ? {} : { powerKw: asOptionalFiniteNumber(value.powerKw) }),
      energyKwh: normalizeEnergyComparison(value.energyKwh),
      currentPowerSeries: normalizeHourlySeries(value.currentPowerSeries),
      lastMonthPowerSeries: normalizeHourlySeries(value.lastMonthPowerSeries),
      anomalyHistory: normalizeAnomalyHistory(value.anomalyHistory),
    }]
  })
}

export function listEquipmentDetails(): EquipmentDetail[] {
  return normalizeEquipmentDetails(dataProvider.equipmentDetails)
}

export function getEquipmentDetailById(equipmentId: string | null | undefined): EquipmentDetail | undefined {
  if (!equipmentId) return undefined
  return listEquipmentDetails().find(({ equipmentId: id }) => id === equipmentId)
}

export function getDefaultEquipmentDetail(): EquipmentDetail | undefined {
  return listEquipmentDetails()[0]
}

export function resolveEquipmentDetail(equipmentId: string | null | undefined): EquipmentDetail | undefined {
  return getEquipmentDetailById(equipmentId) ?? getDefaultEquipmentDetail()
}

export function getEquipmentDetailMap(): Record<string, EquipmentDetail> {
  return Object.fromEntries(listEquipmentDetails().map((detail) => [detail.equipmentId, detail]))
}

export function normalizeDashboardPowerSeries(input: unknown): DashboardPowerPoint[] {
  if (!Array.isArray(input)) return []

  return input.flatMap((value) => {
    if (!isRecord(value)) return []
    const time = asString(value.time).trim()
    if (!time) return []
    return [{ time, ...(asOptionalFiniteNumber(value.value) === undefined ? {} : { value: asOptionalFiniteNumber(value.value) }) }]
  })
}

export function getDashboardPowerSeries(): DashboardPowerPoint[] {
  return normalizeDashboardPowerSeries(dataProvider.powerSeries)
}

export function normalizeAlertSummary(input: unknown): AlertSummary[] {
  if (!Array.isArray(input)) return []

  return input.flatMap((value) => {
    if (!isRecord(value)) return []
    const label = asString(value.label).trim()
    if (!label) return []
    return [{ label, ...(asOptionalFiniteNumber(value.value) === undefined ? {} : { value: asOptionalFiniteNumber(value.value) }), status: asEquipmentStatus(value.status) }]
  })
}

export function getAlertSummary(): AlertSummary[] {
  return normalizeAlertSummary(dataProvider.alertSummary)
}

export function getAttentionEquipment(): Equipment[] {
  return normalizeEquipmentList(dataProvider.attentionEquipment)
}
