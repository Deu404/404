// Compatibility boundary for the pre-service UI.
// New consumers should read through src/services instead of importing fixtures.
export {
  MOCK_ALERTS,
  alertTypeLabels,
  priorityLabels,
  priorityOrder,
  severityLabels,
  severityOrder,
} from '../mocks/mockAlerts'
export type { MockAlert, AlertAcknowledgement, AlertPriority, AlertState } from '../mocks/mockAlerts'
export type { AlertType } from '../types/alert'
export type { EquipmentStatus } from '../types/status'
export { getEquipmentName } from '../services/alertService'
