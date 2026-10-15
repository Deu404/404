// 데모 점검 가이드 저장소. 기존 프런트 mockGuides.ts 내용을 서버로 옮긴 것.
// 현장 표준으로 검토된 자료가 아니라 데모용이다. 정확히 일치하는 유형만 반환하고 fallback을 쓰지 않는다.
import type { AlertType } from './types.ts'

export type DemoGuide = {
  guideKey: string
  alertType: AlertType
  title: string
  initialResponse: string
  operatorChecks: string[]
  steps: Array<{ id: string; label: string }>
  reportConditions: string[]
  source: string
  guideVersion: string
}

export const DEMO_GUIDES: DemoGuide[] = [
  {
    guideKey: 'overcurrent',
    alertType: 'overcurrent',
    title: '과전류 초기 점검',
    initialResponse: '설비에 접근하거나 차단·재가동을 임의로 수행하지 말고 안전거리를 확보한 뒤 담당자와 현장 규정을 확인하세요.',
    operatorChecks: [
      '전류 표시값과 측정 시각을 기록합니다.',
      '설비 외관의 이상 소음·냄새·발열을 안전거리에서 확인합니다.',
      '부하 변화와 최근 작업·정비 이력을 담당자와 대조합니다.',
    ],
    steps: [
      { id: 'overcurrent-1', label: '현장 접근 전 작업 허가와 안전 보호구를 확인합니다.' },
      { id: 'overcurrent-2', label: '전류 표시값, 시각, 설비 상태를 기록합니다.' },
      { id: 'overcurrent-3', label: '부하와 최근 정비 이력을 담당자에게 공유합니다.' },
    ],
    reportConditions: [
      '이상 발열·연기·타는 냄새가 있거나 안전거리를 확보할 수 없는 경우',
      '측정값이 반복되거나 설비 운전 상태가 불안정한 경우',
    ],
    source: 'demo-guide',
    guideVersion: 'guide-v1',
  },
  {
    guideKey: 'low-power-factor',
    alertType: 'low-power-factor',
    title: '역률 저하 초기 점검',
    initialResponse: '역률 보상 장치나 배전 설비를 임의로 조작하지 말고 표시값을 기록하여 전기 담당자에게 보고하세요.',
    operatorChecks: [
      '역률·전압·전류 표시값과 측정 시각을 기록합니다.',
      '관련 설비의 운전 상태와 부하 변화를 확인합니다.',
      '전기 품질 및 보상 설비 상태는 담당자에게 확인을 요청합니다.',
    ],
    steps: [
      { id: 'power-factor-1', label: '측정 시각과 역률·전압·전류 표시값을 기록합니다.' },
      { id: 'power-factor-2', label: '현재 부하와 운전 중인 설비 목록을 확인합니다.' },
      { id: 'power-factor-3', label: '전기 담당자에게 반복 여부와 기록을 전달합니다.' },
    ],
    reportConditions: [
      '전압 변동, 이상 소음, 냄새 또는 발열이 함께 나타나는 경우',
      '반복 측정에서도 역률 저하가 계속되는 경우',
    ],
    source: 'demo-guide',
    guideVersion: 'guide-v1',
  },
  {
    guideKey: 'power-consumption-increase',
    alertType: 'power-consumption-increase',
    title: '전력 소비 증가 초기 점검',
    initialResponse: '전력 증가만으로 설비를 정지하거나 설정을 변경하지 말고 운전 조건을 기록해 담당자에게 공유하세요.',
    operatorChecks: [
      '현재 전력·비교 기준·변화율과 측정 시각을 기록합니다.',
      '생산량·작업 일정·운전 모드의 변경 여부를 확인합니다.',
      '동일 시간대의 과거 추이와 최근 정비 이력을 비교합니다.',
    ],
    steps: [
      { id: 'consumption-1', label: '현재값·비교값·변화율을 같은 시각 기준으로 기록합니다.' },
      { id: 'consumption-2', label: '생산량과 운전 모드 변경 여부를 확인합니다.' },
      { id: 'consumption-3', label: '반복 여부와 관련 설비 상태를 담당자에게 보고합니다.' },
    ],
    reportConditions: [
      '생산 조건에 변화가 없는데 증가가 반복되는 경우',
      '설비에서 이상 소음·진동·발열이 함께 관찰되는 경우',
    ],
    source: 'demo-guide',
    guideVersion: 'guide-v1',
  },
  {
    guideKey: 'phase-current-imbalance',
    alertType: 'phase-current-imbalance',
    title: 'R/S/T상 전류 불균형 초기 점검',
    initialResponse: '배선·차단기·단자에 손대지 말고 접근을 제한한 뒤 자격 있는 전기 담당자에게 즉시 보고하세요.',
    operatorChecks: [
      '상별 전류 표시값과 측정 시각을 기록합니다.',
      '현장 접근 전 안전거리·작업 허가·보호구를 확인합니다.',
      '부하 편중 여부와 최근 배선·정비 이력을 담당자에게 문의합니다.',
    ],
    steps: [
      { id: 'phase-1', label: '안전거리를 확보하고 현장 접근 권한을 확인합니다.' },
      { id: 'phase-2', label: '표시된 R/S/T상 값과 발생 시각을 기록합니다.' },
      { id: 'phase-3', label: '현장 규정에 따라 전기 담당자에게 점검을 요청합니다.' },
    ],
    reportConditions: [
      '차단기 동작, 이상음, 냄새, 발열 또는 연기가 있는 경우',
      '불균형이 반복되거나 상별 측정값을 직접 확인할 권한이 없는 경우',
    ],
    source: 'demo-guide',
    guideVersion: 'guide-v1',
  },
]

export function findDemoGuide(alertType: string): DemoGuide | undefined {
  return DEMO_GUIDES.find((g) => g.alertType === alertType)
}
