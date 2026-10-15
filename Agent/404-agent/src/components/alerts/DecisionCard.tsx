import { decisionSummary } from '../../shared/decision.ts'
import type { Decision } from '../../shared/decision.ts'

const FIELD_LABELS: Record<string, string> = { currentR: 'R상 전류', currentS: 'S상 전류', currentT: 'T상 전류', powerFactorR: 'R상 역률', powerFactorS: 'S상 역률', powerFactorT: 'T상 역률', activePower: '현재 전력', 'comparison.referencePower': '비교 전력' }
export function DecisionCard({ decision }: { decision: Decision }) {
  return <div className="decision-card" aria-label="룰에 따른 판정 결과">
    <p className="decision-summary">{decisionSummary(decision)}</p>
    {decision.actions.slice(1).map(text => <p key={text}>👉 {text}</p>)}
    <p><strong>📢 보고: </strong>{decision.reportReason}</p>
    {decision.reportConditions.length > 0 && <ul>{decision.reportConditions.map(text => <li key={text}>{text}</li>)}</ul>}
    {decision.missingFields.length > 0 && <p>⚠️ 확인 필요: {decision.missingFields.map(field => FIELD_LABELS[field] ?? field).join(', ')}. 확인되지 않은 항목을 정상으로 판단하지 않아요.</p>}
    {decision.status === 'no_applicable_rule' && <p>⚠️ 이 유형에 등록된 대응 룰이 없어요. 담당자 확인이 필요해요.</p>}
    <p className="agent-context">{decision.demoOnly ? '연습용 기준 · 과거 측정 자료 · 실제 현장 기준은 담당자 검토가 필요해요.' : '모델의 이상 의심 결과예요. 실제 고장·심각도·대응 기준은 아직 확인되지 않았어요.'}</p>
    <details><summary>자세히 보기 · 확인된 값·미확인 항목·근거</summary>
      {decision.evaluations.map(e => <p key={e.ruleId}>{e.reason}{e.missingFields.length > 0 ? ' · 일부 측정 정보 미확인' : ''}</p>)}
      <p>자료: {decision.source} · 룰 버전: {decision.ruleVersion}</p>
      {decision.steps.length > 0 && <ol>{decision.steps.map(step => <li key={step}>{step}</li>)}</ol>}
    </details>
  </div>
}
