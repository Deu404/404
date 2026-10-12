// Compatibility boundary for the pre-service UI and verification scripts.
// New consumers should read through src/services instead of importing fixtures.
import { MOCK_EQUIPMENT } from '../mocks/mockPowerData'

export {
  MOCK_ALERT_SUMMARY,
  MOCK_ATTENTION_EQUIPMENT,
  MOCK_EQUIPMENT,
  MOCK_EQUIPMENT_DETAILS,
  MOCK_EQUIPMENT_DETAIL_BY_ID,
  MOCK_POWER_SERIES,
} from '../mocks/mockPowerData'
export type {
  MockAnomalyHistoryItem,
  MockEnergyComparison,
  MockEquipment,
  MockEquipmentDetail,
  MockHourlyPowerPoint,
} from '../mocks/mockPowerData'
export type { EquipmentStatus } from '../types/status'

export function resolveMockEquipment(requestedEquipmentId: string | null): import('../mocks/mockPowerData').MockEquipment {
  return MOCK_EQUIPMENT.find(({ id }) => id === requestedEquipmentId) ?? MOCK_EQUIPMENT[0]
}
