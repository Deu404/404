export type NavigationItem = {
  label: string
  path: string
  description: string
}

export const navigationItems: NavigationItem[] = [
  { label: '통합 대시보드', path: '/', description: '공장 전체 전력 현황을 한눈에 확인합니다.' },
  { label: '공장 배치도', path: '/layout', description: '공장 설비 배치와 구역별 현황을 확인합니다.' },
  { label: '설비별 전력 분석', path: '/equipment-power', description: '설비별 전력 사용량과 추이를 분석합니다.' },
  { label: '이상 알림', path: '/alerts', description: '감지된 전력 이상 및 알림을 관리합니다.' },
  { label: '점검 가이드', path: '/inspection-guide', description: '설비 점검 절차와 가이드를 확인합니다.' },
  { label: '전력 분석 및 예측', path: '/forecast', description: '전력 사용량 분석과 예측을 준비합니다.' },
]
