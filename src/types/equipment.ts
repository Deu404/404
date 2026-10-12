import type { EnergyComparison } from './comparison'
import type { EquipmentStatus } from './status'
import type { HourlyPowerPoint } from './power'

export type Equipment = {
  id: string
  name: string
  zone: string
  status: EquipmentStatus
  powerKw?: number
  x: number
  y: number
  message: string
}

export type AnomalyHistoryItem = {
  detectedAt: string
  severity: EquipmentStatus
  message: string
  state: 'open' | 'resolved'
}

export type EquipmentDetail = {
  equipmentId: string
  powerKw?: number
  energyKwh: EnergyComparison
  currentPowerSeries: HourlyPowerPoint[]
  lastMonthPowerSeries: HourlyPowerPoint[]
  anomalyHistory: AnomalyHistoryItem[]
}
