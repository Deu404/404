// 데모 전용 경계. 실제 CSV/API 화면의 provider에는 가상 알림을 섞지 않는다.
import { MOCK_ALERTS } from '../mocks/mockAlerts'
import { normalizeAlerts } from './alertService'

export function listDemoAgentAlerts() { return normalizeAlerts(MOCK_ALERTS) }
