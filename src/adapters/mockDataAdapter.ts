import type { DataProvider } from './dataProvider'
import {
  MOCK_ALERT_SUMMARY,
  MOCK_ATTENTION_EQUIPMENT,
  MOCK_EQUIPMENT,
  MOCK_EQUIPMENT_DETAILS,
  MOCK_EQUIPMENT_DETAIL_BY_ID,
  MOCK_POWER_SERIES,
} from '../mocks/mockPowerData'
import {
  MOCK_ALERTS,
  alertTypeLabels,
  priorityLabels,
  priorityOrder,
  severityLabels,
  severityOrder,
} from '../mocks/mockAlerts'
import { DEFAULT_GUIDE_KEY, MOCK_GUIDES } from '../mocks/mockGuides'
import type { AnomalyDetection } from '../types/anomaly'

const MODEL_ANOMALIES: readonly AnomalyDetection[] = [
  { id: 'model-1-pm-3-currentR', equipment: '1(PM-3)', equipmentId: 'compressor-01', equipmentName: '공기압축기 01', occurredAt: '2024-12-01 00:25:00', fields: ['currentR'], source: 'model' },
  { id: 'model-12-4-current-voltageST', equipment: '12(4호기)', equipmentId: 'robot-02', equipmentName: '조립 로봇 02', occurredAt: '2024-12-01 00:35:00', fields: ['voltageST'], source: 'model' },
]

/**
 * Development-only provider for the existing fixtures.
 * The service layer depends on this contract instead of importing mock files.
 */
export const mockDataAdapter = {
  equipment: MOCK_EQUIPMENT,
  equipmentDetails: MOCK_EQUIPMENT_DETAILS,
  equipmentDetailById: MOCK_EQUIPMENT_DETAIL_BY_ID,
  powerSeries: MOCK_POWER_SERIES,
  alertSummary: MOCK_ALERT_SUMMARY,
  attentionEquipment: MOCK_ATTENTION_EQUIPMENT,
  alerts: MOCK_ALERTS,
  anomalies: MODEL_ANOMALIES,
  guides: MOCK_GUIDES,
  defaultGuideKey: DEFAULT_GUIDE_KEY,
  alertTypeLabels,
  priorityLabels,
  priorityOrder,
  severityLabels,
  severityOrder,
} as const satisfies DataProvider

export type { MockEquipment } from '../mocks/mockPowerData'
