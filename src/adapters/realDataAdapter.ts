import { EQUIPMENT_LAYOUT } from '../config/equipmentDataMap'
import type { Alert, AlertPriority, AlertSummary, AlertType } from '../types/alert'
import type { AnomalyDetection } from '../types/anomaly'
import type { Equipment, EquipmentDetail } from '../types/equipment'
import type { InspectionGuide } from '../types/guide'
import type { DashboardPowerPoint } from '../types/power'
import type { EquipmentStatus } from '../types/status'

const equipment: readonly Equipment[] = EQUIPMENT_LAYOUT.map(({ id, name, x, y }) => ({
  id,
  name,
  zone: '',
  status: 'normal',
  x,
  y,
  message: '',
}))

const anomalies: readonly AnomalyDetection[] = []

export const realDataAdapter = {
  equipment,
  equipmentDetails: [] as readonly EquipmentDetail[],
  equipmentDetailById: {} as Readonly<Record<string, EquipmentDetail>>,
  powerSeries: [] as readonly DashboardPowerPoint[],
  alertSummary: [] as readonly AlertSummary[],
  attentionEquipment: [] as readonly Equipment[],
  alerts: [] as readonly Alert[],
  anomalies,
  guides: [] as readonly InspectionGuide[],
  defaultGuideKey: '',
  alertTypeLabels: {
    overcurrent: '과전류',
    'low-power-factor': '역률 저하',
    'power-consumption-increase': '전력 소비 증가',
    'phase-current-imbalance': 'R/S/T상 전류 불균형',
  } as Record<AlertType, string>,
  priorityLabels: { high: '높음', medium: '중간', low: '낮음' } as Record<AlertPriority, string>,
  priorityOrder: { high: 3, medium: 2, low: 1 } as Record<AlertPriority, number>,
  severityLabels: { critical: '이상', warning: '주의', normal: '정상' } as Record<EquipmentStatus, string>,
  severityOrder: { critical: 3, warning: 2, normal: 1 } as Record<EquipmentStatus, number>,
}
