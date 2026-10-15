import { decideAlert } from './decision.ts'
import type { Decision } from './decision.ts'

export type ModelAnomalyInput = { id: string; equipmentId: string; occurredAt: string; fields: readonly string[] }

// 현재 모델 API는 의심 항목만 전달한다. 측정값·단위·비교 기준 없이 데모 룰을 적용하지 않는다.
export function decideModelAnomaly(input: ModelAnomalyInput): Decision {
  const identity = decideAlert({ id: input.id, equipmentId: input.equipmentId, occurredAt: input.occurredAt, type: 'model-anomaly' })
  return { ...identity, demoOnly: false, source: '모델 API의 이상 의심 결과', status: 'insufficient_data', priority: null,
    actions: ['해당 알림의 측정값·단위·발생 시각과 적용할 기준을 담당자에게 확인하세요.'],
    missingFields: ['이상 발생 시점의 측정값·단위', '설비별 적용 기준', '승인된 조치·보고 절차'],
    reportReason: '모델 감지만으로 심각도와 보고 여부를 확정할 수 없어요. 담당자 확인이 필요해요.' }
}
