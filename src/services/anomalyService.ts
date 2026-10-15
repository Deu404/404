import { EQUIPMENT_LAYOUT } from '../config/equipmentDataMap'
import type { AnomalyDetection } from '../types/anomaly'

const apiUrl = import.meta.env.VITE_ANOMALY_API_URL?.trim()
let anomaliesPromise: Promise<AnomalyDetection[]> | undefined

function canonicalEquipment(value: unknown) {
  const text = typeof value === 'string' ? value : ''
  const normalizedText = text.replace(/^equipment_/, '')
  const layout = EQUIPMENT_LAYOUT.find(({ id, name, fileName }) => id === text || name === text || fileName === text || fileName.replace(/^equipment_/, '').replace(/\.csv$/, '') === normalizedText || fileName.replace(/\.csv$/, '') === text)
  return layout
}

function normalizeAnomaly(value: unknown, index: number): AnomalyDetection | undefined {
  if (!value || typeof value !== 'object') return undefined
  const item = value as Record<string, unknown>
  const equipmentValue = item.equipmentId ?? item.equipment ?? item.equipmentName
  const layout = canonicalEquipment(equipmentValue)
  const equipmentId = typeof item.equipmentId === 'string' && EQUIPMENT_LAYOUT.some(({ id }) => id === item.equipmentId) ? item.equipmentId : layout?.id
  if (!equipmentId) return undefined
  const canonical = EQUIPMENT_LAYOUT.find(({ id }) => id === equipmentId)
  const fields = Array.isArray(item.fields) ? item.fields.filter((field): field is string => typeof field === 'string') : []
  const occurredAt = typeof item.occurredAt === 'string' ? item.occurredAt : typeof item.timestamp === 'string' ? item.timestamp : ''
  if (!fields.length || !occurredAt) return undefined
  return {
    id: typeof item.id === 'string' ? item.id : `anomaly-${equipmentId}-${index}`,
    equipment: typeof item.equipment === 'string' ? item.equipment : canonical?.fileName.replace(/\.csv$/, '') ?? equipmentId,
    equipmentId,
    equipmentName: canonical?.name ?? equipmentId,
    occurredAt,
    fields,
    source: 'model',
  }
}

async function fetchAnomalies(): Promise<AnomalyDetection[]> {
  if (!apiUrl) return []
  try {
    const response = await fetch(apiUrl)
    if (!response.ok) return []
    const payload: unknown = await response.json()
    const values = Array.isArray(payload) ? payload : payload && typeof payload === 'object' && Array.isArray((payload as { anomalies?: unknown }).anomalies) ? (payload as { anomalies: unknown[] }).anomalies : []
    return values.map(normalizeAnomaly).filter((item): item is AnomalyDetection => Boolean(item))
  } catch {
    return []
  }
}

export function listModelAnomalies(): Promise<AnomalyDetection[]> {
  anomaliesPromise ??= fetchAnomalies()
  return anomaliesPromise
}

export async function getModelAnomaliesByEquipmentId(equipmentId: string | undefined): Promise<AnomalyDetection[]> {
  if (!equipmentId) return []
  return (await listModelAnomalies()).filter((anomaly) => anomaly.equipmentId === equipmentId)
}
