export type NavigationItem = {
  label: string
  path: string
  description: string
}

export const navigationItems: NavigationItem[] = [
  { label: '핵심 지표', path: '/', description: '실제 데이터 기반 핵심 전력 지표를 한눈에 확인합니다.' },
  { label: '이상탐지·점검', path: '/alerts', description: '모델 결과와 점검 가이드를 확인합니다.' },
]
