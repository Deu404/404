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
    <p className="agent-context">{decision.demoOnly ? '연습용 기준 · 과거 측정 자료 · 실제 현장 기준은 담당자 검토가 필요해요.' : decision.approvalStatus === 'configured' ? '등록된 설정과 원시 관측으로 확인한 결과예요. 보류 항목과 기준 출처를 함께 확인하세요.' : '모델의 이상 의심 결과예요. 실제 고장·심각도·대응 기준은 아직 확인되지 않았어요.'}</p>
    <details><summary>자세히 보기 · 확인된 값·미확인 항목·근거</summary>
      {decision.pattern && <>
        <p>정상 참조와 비교한 결과입니다. 허용 한계·고장 확정과 구분합니다. 운전상태 값: {decision.pattern.operation ?? '미확인'}</p>
        <div style={{ overflowX: 'auto' }}><table><caption>설비별 정상 참조 범위와 현재 관측</caption><thead><tr><th>항목</th><th>현재값</th><th>참조 하한</th><th>참조 상한</th><th>단위</th><th>결과</th></tr></thead><tbody>
          {decision.pattern.checks.map(c => <tr key={c.field}><th scope="row">{c.label}</th><td>{c.value?.toLocaleString('ko-KR', { maximumFractionDigits: 6 }) ?? '확인 필요'}</td><td>{c.lower.toLocaleString('ko-KR', { maximumFractionDigits: 6 })}</td><td>{c.upper.toLocaleString('ko-KR', { maximumFractionDigits: 6 })}</td><td>{c.unit}</td><td>{{ inside: '범위 안', outside: '범위 이탈', invalid: '자료 확인', not_applicable: '계산 대상 아님' }[c.result]}</td></tr>)}
        </tbody></table></div>
        <p>{decision.pattern.limitation}</p>
        <p>참조 기간: {decision.pattern.referencePeriod.join(' ~ ')}</p>
        {decision.pattern.referenceTiming === 'after-observation' && <p>관측 이후의 자료로 만든 참조와 대조했습니다. 과거 시점의 탐지 성능 검증과 구분합니다.</p>}
        {decision.pattern.referenceTiming === 'overlaps-observation' && <p>참조 산출 기간 안의 관측입니다. 독립 검증 사례와 구분합니다.</p>}
        {decision.pattern.unassessedModelFields.length > 0 && <p>이 범위 검사에서 평가하지 않은 모델 항목: {decision.pattern.unassessedModelFields.join(', ')}</p>}
      </>}
      {decision.evaluations.map(e => <p key={e.ruleId}>{e.reason}{e.missingFields.length > 0 ? ' · 일부 측정 정보 미확인' : ''}</p>)}
      <p>자료: {decision.source} · 룰 버전: {decision.ruleVersion}</p>
      {decision.steps.length > 0 && <ol>{decision.steps.map(step => <li key={step}>{step}</li>)}</ol>}
    </details>
  </div>
}
