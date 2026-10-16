import type { AnomalyDetection } from '../types/anomaly.ts'

export type EquipmentSummary = {
  id: string
  name: string
  count: number
  latest?: AnomalyDetection
  fields: string[]
}

export function summarizeEquipment(equipment: readonly { id: string; name: string }[], anomalies: readonly AnomalyDetection[]): EquipmentSummary[] {
  const summaries = new Map(equipment.map(({ id, name }) => [id, { id, name, count: 0, fields: [] } as EquipmentSummary]))
  const fieldCounts = new Map<string, Map<string, number>>()
  for (const anomaly of anomalies) {
    const summary = summaries.get(anomaly.equipmentId)
    if (!summary) continue
    summary.count++
    if (!summary.latest || anomaly.occurredAt > summary.latest.occurredAt) summary.latest = anomaly
    const counts = fieldCounts.get(summary.id) ?? new Map<string, number>()
    for (const field of new Set(anomaly.fields)) counts.set(field, (counts.get(field) ?? 0) + 1)
    fieldCounts.set(summary.id, counts)
  }
  for (const summary of summaries.values()) {
    summary.fields = [...(fieldCounts.get(summary.id) ?? new Map<string, number>()).entries()]
      .sort(([a, ac], [b, bc]) => bc - ac || a.localeCompare(b))
      .map(([field]) => field)
  }
  return [...summaries.values()].sort((a, b) => Number(b.count > 0) - Number(a.count > 0) || (b.latest?.occurredAt ?? '').localeCompare(a.latest?.occurredAt ?? ''))
}

const FIELD_LABELS: Record<string, string> = {
  voltageR: 'R상 전압', voltageS: 'S상 전압', voltageT: 'T상 전압',
  voltageRS: 'RS 선간전압', voltageST: 'ST 선간전압', voltageTR: 'TR 선간전압',
  currentR: 'R상 전류', currentS: 'S상 전류', currentT: 'T상 전류',
  activePower: '유효전력', reactivePowerLagging: '무효전력',
  powerFactorR: 'R상 역률', powerFactorS: 'S상 역률', powerFactorT: 'T상 역률',
  accumActiveEnergy: '누적전력량', operation: '운전상태',
}

export const anomalyFieldLabel = (field: string) => FIELD_LABELS[field] ?? field
