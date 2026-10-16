export const ANOMALY_FIELDS = [
  'voltageR', 'voltageS', 'voltageT', 'voltageRS', 'voltageST', 'voltageTR',
  'currentR', 'currentS', 'currentT', 'activePower',
  'powerFactorR', 'powerFactorS', 'powerFactorT', 'reactivePowerLagging',
  'accumActiveEnergy', 'operation',
] as const

export type AnomalyField = typeof ANOMALY_FIELDS[number]

export type AnomalyDetection = {
  id: string
  equipment: string
  equipmentId: string
  equipmentName: string
  occurredAt: string
  fields: readonly string[]
  source: 'model'
}
