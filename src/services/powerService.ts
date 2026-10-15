import { dataProvider } from '../adapters/dataProvider'
import { fetchEquipmentCsvDetail } from '../adapters/csvDataAdapter'
import { rawForecastActualsData, rawForecastData } from '../data/forecastData'
import type { AlertSummary } from '../types/alert'
import type { Equipment, EquipmentDetail, AnomalyHistoryItem } from '../types/equipment'
import type { EnergyComparison } from '../types/comparison'
import type { DashboardPowerPoint, HourlyPowerPoint } from '../types/power'
import type { ForecastMae, ForecastPoint } from '../types/forecast'
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

export async function getEquipmentCsvDetailById(equipmentId: string | null | undefined): Promise<EquipmentDetail | undefined> {
  if (!equipmentId) return undefined
  return fetchEquipmentCsvDetail(equipmentId)
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

export function normalizeForecastData(input: unknown): ForecastPoint[] {
  if (!Array.isArray(input)) return []

  return input.flatMap((value) => {
    if (!isRecord(value)) return []
    const id = asString(value.id).trim()
    const hour = asString(value.hour).trim() || id
    const hourlyPowKwh = asOptionalFiniteNumber(value.hourly_pow)
    const billWon = asOptionalFiniteNumber(value.may_bill)
    const carbonKg = asOptionalFiniteNumber(value.may_carbon)
    const aggregatePowerKwh = asOptionalFiniteNumber(value.agg_pow)
    if (!id || hourlyPowKwh === undefined || billWon === undefined || carbonKg === undefined || aggregatePowerKwh === undefined) return []
    const model = asString(value.model).trim()
    return [{ id, hour, hourlyPowKwh, billWon, carbonKg, aggregatePowerKwh, ...(model ? { model } : {}) }]
  })
}

export function getForecastData(): ForecastPoint[] {
  return normalizeForecastData(rawForecastData)
}

export function normalizeForecastMae(input: unknown, includeRow: (time: string) => boolean = () => true): ForecastMae {
  if (!Array.isArray(input)) return { totalValidSampleCount: 0 }

  const metrics = [
    { key: 'power', predicted: 'hourly_pow_pred', actual: 'hourly_pow_actual', unit: 'kWh' },
    { key: 'bill', predicted: 'may_bill_pred', actual: 'may_bill_actual', unit: '원' },
    { key: 'carbon', predicted: 'may_carbon_pred', actual: 'may_carbon_actual', unit: 'kgCO2' },
  ] as const
  const totals = { power: 0, bill: 0, carbon: 0 }
  const counts = { power: 0, bill: 0, carbon: 0 }
  let totalValidSampleCount = 0

  input.forEach((value) => {
    if (!isRecord(value) || !includeRow(asString(value.time).trim())) return
    let rowHasValidSample = false
    metrics.forEach(({ key, predicted, actual }) => {
      const predictedValue = asOptionalFiniteNumber(value[predicted])
      const actualValue = asOptionalFiniteNumber(value[actual])
      if (predictedValue === undefined || actualValue === undefined) return
      totals[key] += Math.abs(predictedValue - actualValue)
      counts[key] += 1
      rowHasValidSample = true
    })
    if (rowHasValidSample) totalValidSampleCount += 1
  })

  return {
    totalValidSampleCount,
    ...(counts.power ? { power: { mae: totals.power / counts.power, unit: 'kWh', sampleCount: counts.power } } : {}),
    ...(counts.bill ? { bill: { mae: totals.bill / counts.bill, unit: '원', sampleCount: counts.bill } } : {}),
    ...(counts.carbon ? { carbon: { mae: totals.carbon / counts.carbon, unit: 'kgCO2', sampleCount: counts.carbon } } : {}),
  }
}

export function getForecastMae(includeRow: (time: string) => boolean = () => true): ForecastMae {
  return normalizeForecastMae(rawForecastActualsData, includeRow)
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
