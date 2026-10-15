import { EQUIPMENT_DATA_MAP } from '../config/equipmentDataMap'
import type { EquipmentDetail } from '../types/equipment'
import { asOptionalFiniteNumber, asString, isRecord } from '../services/dataNormalization'

const DATA_ENDPOINT = '/api/equipment-data/'

type CsvSample = { time?: unknown; powerKw?: unknown; energyKwh?: unknown }

function normalizeSamples(input: unknown) {
  if (!Array.isArray(input)) return []
  return input.flatMap((value) => {
    if (!isRecord(value)) return []
    const time = asString(value.time).trim()
    const powerKw = asOptionalFiniteNumber(value.powerKw)
    if (!time || powerKw === undefined) return []
    const energyKwh = asOptionalFiniteNumber(value.energyKwh)
    return [{ time, powerKw, ...(energyKwh === undefined ? {} : { energyKwh }) }]
  })
}

export async function fetchEquipmentCsvDetail(equipmentId: string): Promise<EquipmentDetail | undefined> {
  const fileName = EQUIPMENT_DATA_MAP[equipmentId as keyof typeof EQUIPMENT_DATA_MAP]
  if (!fileName || typeof fetch === 'undefined') return undefined

  try {
    const response = await fetch(`${DATA_ENDPOINT}${encodeURIComponent(fileName)}`)
    if (!response.ok) return undefined
    const payload = await response.json() as { samples?: unknown }
    const samples = normalizeSamples(payload.samples)
    if (!samples.length) return undefined
    const latest = samples[samples.length - 1]
    const energyValues = samples.map(({ energyKwh }) => energyKwh).filter((value): value is number => value !== undefined)
    return {
      equipmentId,
      powerKw: latest.powerKw,
      energyKwh: energyValues.length ? { current: latest.energyKwh, lastMonth: undefined } : {},
      currentPowerSeries: samples,
      lastMonthPowerSeries: [],
      anomalyHistory: [],
    }
  } catch {
    return undefined
  }
}

export type { CsvSample }
