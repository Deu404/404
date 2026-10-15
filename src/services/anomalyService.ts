import { dataProvider } from '../adapters/dataProvider'
import { getEquipmentById } from './equipmentService'
import type { AnomalyDetection } from '../types/anomaly'
import generatedAnomalies from '../data/anomaly-results.json'

const actualAnomalies = generatedAnomalies as AnomalyDetection[]

export function listModelAnomalies(): AnomalyDetection[] {
  const anomalies = actualAnomalies.length ? actualAnomalies : dataProvider.anomalies
  return anomalies.map((anomaly) => ({
    ...anomaly,
    equipmentName: getEquipmentById(anomaly.equipmentId)?.name ?? anomaly.equipmentName,
  }))
}

export function getModelAnomaliesByEquipmentId(equipmentId: string | undefined): AnomalyDetection[] {
  return equipmentId ? listModelAnomalies().filter((anomaly) => anomaly.equipmentId === equipmentId) : []
}
