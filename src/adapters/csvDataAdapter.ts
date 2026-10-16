import { EQUIPMENT_DATA_MAP } from '../config/equipmentDataMap'
import type { EquipmentDetail } from '../types/equipment'
import { asString, isRecord } from '../services/dataNormalization'

const DATA_ENDPOINT = import.meta.env.PROD ? '/equipment-data/' : '/api/equipment-data/'

export type EquipmentPowerSample = { time: string; powerKw: number; energyKwh?: number }

function asPowerNumber(value: unknown): number | undefined {
  const number = typeof value === 'number' ? value : typeof value === 'string' ? Number(value.trim()) : Number.NaN
  return Number.isFinite(number) ? number : undefined
}

function normalizeSampleTime(value: unknown): string {
  const text = asString(value).trim()
  const compact = /^\d{14}\.0+$/.test(text) ? text.slice(0, 14) : text
  if (/^\d{14}$/.test(compact)) {
    return `${compact.slice(0, 4)}-${compact.slice(4, 6)}-${compact.slice(6, 8)} ${compact.slice(8, 10)}:${compact.slice(10, 12)}`
  }
  return compact
}

function normalizeSamples(input: unknown): EquipmentPowerSample[] {
  if (!Array.isArray(input)) return []
  return input.flatMap((value) => {
    if (!isRecord(value)) return []
    const time = normalizeSampleTime(value.time)
    const powerKw = asPowerNumber(value.powerKw)
    if (!time || powerKw === undefined) return []
    const energyKwh = asPowerNumber(value.energyKwh)
    return [{ time, powerKw, ...(energyKwh === undefined ? {} : { energyKwh }) }]
  })
}

export async function fetchEquipmentCsvDetail(equipmentId: string): Promise<EquipmentDetail | undefined> {
  const fileName = EQUIPMENT_DATA_MAP[equipmentId as keyof typeof EQUIPMENT_DATA_MAP]
  if (!fileName || typeof fetch === 'undefined') return undefined

  try {
    const requestName = import.meta.env.PROD ? `${equipmentId}.json` : fileName
    const response = await fetch(`${DATA_ENDPOINT}${encodeURIComponent(requestName)}`)
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

export async function fetchAllEquipmentCsvDetails(): Promise<EquipmentDetail[]> {
  const details = await Promise.all(Object.keys(EQUIPMENT_DATA_MAP).map((equipmentId) => fetchEquipmentCsvDetail(equipmentId)))
  return details.flatMap((detail) => detail ? [detail] : [])
}

export type CsvSample = EquipmentPowerSample
