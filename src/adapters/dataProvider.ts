import type { Alert, AlertSummary, AlertType, AlertPriority } from '../types/alert'
import type { Equipment, EquipmentDetail } from '../types/equipment'
import type { InspectionGuide } from '../types/guide'
import type { DashboardPowerPoint } from '../types/power'
import type { EquipmentStatus } from '../types/status'
import { mockDataAdapter } from './mockDataAdapter'

export type DataProvider = {
  readonly equipment: readonly Equipment[]
  readonly equipmentDetails: readonly EquipmentDetail[]
  readonly equipmentDetailById: Readonly<Record<string, EquipmentDetail>>
  readonly powerSeries: readonly DashboardPowerPoint[]
  readonly alertSummary: readonly AlertSummary[]
  readonly attentionEquipment: readonly Equipment[]
  readonly alerts: readonly Alert[]
  readonly guides: readonly InspectionGuide[]
  readonly defaultGuideKey: string
  readonly alertTypeLabels: Readonly<Record<AlertType, string>>
  readonly priorityLabels: Readonly<Record<AlertPriority, string>>
  readonly priorityOrder: Readonly<Record<AlertPriority, number>>
  readonly severityLabels: Readonly<Record<EquipmentStatus, string>>
  readonly severityOrder: Readonly<Record<EquipmentStatus, number>>
}

export const dataProvider: DataProvider = mockDataAdapter
