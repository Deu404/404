export type AnomalyDetection = {
  id: string
  equipment: string
  equipmentId: string
  equipmentName: string
  occurredAt: string
  fields: readonly string[]
  source: 'model'
}
