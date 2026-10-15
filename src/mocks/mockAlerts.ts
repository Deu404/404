// 개발용 가상 알림 데이터입니다. 실제 API·센서·AI 분석 결과와 연결하지 않습니다.
import type { Alert, AlertType } from '../types/alert'
import type { EquipmentStatus } from '../types/status'

export type MockAlert = Alert
export type AlertPriority = Alert['priority']
export type AlertState = Alert['state']
export type AlertAcknowledgement = Alert['acknowledgement']

export const alertTypeLabels: Record<AlertType, string> = {
  overcurrent: '과전류',
  'low-power-factor': '역률 저하',
  'power-consumption-increase': '전력 소비 증가',
  'phase-current-imbalance': 'R/S/T상 전류 불균형',
}
export const severityLabels: Record<EquipmentStatus, string> = { normal: '정상', warning: '주의', critical: '이상' }
export const priorityLabels: Record<AlertPriority, string> = { high: '높음', medium: '중간', low: '낮음' }
export const severityOrder: Record<EquipmentStatus, number> = { critical: 3, warning: 2, normal: 1 }
export const priorityOrder: Record<AlertPriority, number> = { high: 3, medium: 2, low: 1 }

export const MOCK_ALERTS: Alert[] = [
  {
    id: 'alert-20240822-001', equipmentId: 'motor-02', occurredAt: '2024-08-22 07:45', type: 'overcurrent',
    severity: 'critical', priority: 'high', measurement: 128, reference: 100, change: 28,
    powerChangeKw: 16, changeRatePercent: 8.2, summary: '모터 전류가 데모 기준보다 높게 관찰됨',
    ruleResult: { matched: true, reason: '과전류: 128 A가 데모 기준 100 A 초과입니다.', demoThreshold: 100, thresholdUnit: 'A', demoOnly: true },
    detail: '전류 측정값이 데모 기준 예시를 초과한 목업 알림입니다. 실제 전기 안전 기준이나 센서 진단 결과가 아닙니다.',
    guideKey: 'overcurrent', state: 'open', acknowledgement: 'unacknowledged',
  },
  {
    id: 'alert-20240822-002', equipmentId: 'pump-02', occurredAt: '2024-08-22 08:20', type: 'low-power-factor',
    severity: 'warning', priority: 'medium', measurement: 0.78, reference: 0.85, change: -0.07,
    powerChangeKw: 5, changeRatePercent: 4.3, summary: '역률이 데모 기준보다 낮게 관찰됨',
    ruleResult: { matched: true, reason: '역률 저하: 0.78 역률이 데모 기준 0.85 역률 미만입니다.', demoThreshold: 0.85, thresholdUnit: '역률', demoOnly: true },
    detail: '역률 측정값을 바탕으로 한 개발용 분류 예시입니다. 담당자 확인 전 임의 조작을 하지 마세요.',
    guideKey: 'low-power-factor', state: 'open', acknowledgement: 'unacknowledged',
  },
  {
    id: 'alert-20240821-001', equipmentId: 'compressor-02', occurredAt: '2024-08-21 11:35', type: 'power-consumption-increase',
    severity: 'warning', priority: 'medium', measurement: 224, reference: 187, change: 19.6,
    powerChangeKw: 36, changeRatePercent: 19.6, summary: '과거 전력 소비 패턴 대비 증가',
    ruleResult: { matched: true, reason: '전력 소비 증가: 19.6 %가 데모 기준 10 % 초과입니다.', demoThreshold: 10, thresholdUnit: '%', demoOnly: true },
    detail: '동일 시간대 목업 기준 대비 소비 전력 증가를 표시한 시뮬레이션 알림입니다.',
    guideKey: 'power-consumption-increase', state: 'open', acknowledgement: 'unacknowledged',
  },
  {
    id: 'alert-20240820-001', equipmentId: 'transformer-01', occurredAt: '2024-08-20 15:50', type: 'phase-current-imbalance',
    severity: 'critical', priority: 'high', measurement: 18, reference: 10, change: 18,
    powerChangeKw: 9, changeRatePercent: 7.5, summary: 'R/S/T상 전류 불균형 참고 알림',
    ruleResult: { matched: true, reason: 'R/S/T상 전류 불균형: 18 %가 데모 기준 10 % 초과입니다.', demoThreshold: 10, thresholdUnit: '%', demoOnly: true },
    detail: '상별 전류 차이를 단순화한 개발용 목업입니다. 전기 작업은 자격 있는 담당자에게 요청하세요.',
    guideKey: 'phase-current-imbalance', state: 'open', acknowledgement: 'unacknowledged',
  },
  {
    id: 'alert-20240819-001', equipmentId: 'compressor-02', occurredAt: '2024-08-19 14:20', type: 'power-consumption-increase',
    severity: 'normal', priority: 'low', measurement: 212, reference: 196, change: 8.2,
    powerChangeKw: 14, changeRatePercent: 8.2, summary: '전력 소비 증가 반복 참고 기록',
    ruleResult: { matched: false, reason: '전력 소비 증가: 8.2 %가 데모 기준 범위 안이거나 추가 확인이 필요합니다.', demoThreshold: 10, thresholdUnit: '%', demoOnly: true },
    detail: '같은 설비와 유형의 반복 표시를 확인하기 위한 개발용 목업 기록입니다.',
    guideKey: 'power-consumption-increase', state: 'resolved', acknowledgement: 'acknowledged',
  },
]

export type { EquipmentStatus }
