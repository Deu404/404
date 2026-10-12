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
  guides: MOCK_GUIDES,
  defaultGuideKey: DEFAULT_GUIDE_KEY,
  alertTypeLabels,
  priorityLabels,
  priorityOrder,
  severityLabels,
  severityOrder,
} as const satisfies DataProvider

export type { MockEquipment } from '../mocks/mockPowerData'
