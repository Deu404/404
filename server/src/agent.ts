import { decideModelAnomaly } from '../../src/shared/modelDecision.ts'
import type { ModelAnomalyInput } from '../../src/shared/modelDecision.ts'
// 판정은 공통 함수가 확정하고, LLM은 허용된 조회 도구를 선택한다.
import { randomUUID } from 'node:crypto'
import { decideAlert, decideCase, decisionSummary, reportText } from '../../src/shared/decision.ts'
import type { AlertInput, Decision } from '../../src/shared/decision.ts'
import { findDemoCase } from './fixtures/demoCases.ts'
import { get_forecast_summary, get_executive_report_data } from './tools.ts'
import { forecastText } from './forecast.ts'

export type AgentRequest = { message: string; alert?: AlertInput; anomaly?: ModelAnomalyInput; caseId?: string; conversationId?: string; intent?: 'anomaly' | 'forecast' | 'executive' | 'report' }
export type AgentResponse = {
  status: 'completed' | 'insufficient_data' | 'not_found'
  conversationId: string; reply: { summary: string; detail: string }
  decision?: Decision; explanationSource: 'ai' | 'rules'; explanationNotice?: string
  evidence: unknown[]; steps: unknown[]; reportConditions: string[]; initialResponses: string[]
  missingFields: string[]; dataSource: string; demoOnly: boolean; toolTrace: unknown[]
}
import { executeAgent, resolveConversation } from './agentLoop.ts'

export function prepareResponse(request: AgentRequest) {
  if (!request || typeof request.message !== 'string' || request.message.length > 4000) throw new Error('질문은 4,000자 이내로 입력하세요.')
  if (request.intent && !['anomaly', 'forecast', 'executive', 'report'].includes(request.intent)) throw new Error('요청 유형을 확인하세요.')
  if (request.alert && request.anomaly) throw new Error('알림 입력은 한 종류만 전달하세요.')
  const message = request.message.trim()
  if (!message) throw new Error('질문을 입력하세요.')
  const intent = request.intent ?? (/보고.*문구|문구.*보고/.test(message) ? 'report' : /경영|종합.*리포트/.test(message) ? 'executive' : /요금|탄소|예측/.test(message) ? 'forecast' : 'anomaly')
  let decision: Decision | undefined
  if (intent === 'anomaly' || intent === 'report') {
    if (request.alert) {
      const a = request.alert
      if (typeof a.id !== 'string' || typeof a.equipmentId !== 'string' || typeof a.type !== 'string' || typeof a.occurredAt !== 'string') throw new Error('선택한 알림 정보를 확인하세요.')
      decision = decideAlert(a)
    } else if (request.anomaly) {
      const a = request.anomaly
      if (typeof a.id !== 'string' || typeof a.equipmentId !== 'string' || typeof a.occurredAt !== 'string' || (!Array.isArray(a.fields) || a.fields.length > 30 || a.fields.some(f => typeof f !== 'string' || f.length > 100))) throw new Error('모델 결과 정보를 확인하세요.')
      decision = decideModelAnomaly(a)
    } else if (request.caseId) {
      const c = findDemoCase(request.caseId)
      if (c) decision = decideCase(c)
    }
  }
  const data = intent === 'forecast' ? get_forecast_summary() : intent === 'executive' ? get_executive_report_data() : decision
  const fallback = decision ? intent === 'report' ? reportText(decision) : decisionSummary(decision)
    : data && !('inputId' in data) ? forecastText(data) : '연결된 측정 자료가 없어요. 알림을 선택하거나 담당자에게 자료를 확인하세요.'
  const response: AgentResponse = {
    status: decision ? decision.status === 'insufficient_data' || decision.status === 'no_applicable_rule' || decision.missingFields.length ? 'insufficient_data' : 'completed' : data ? data.missingFields.length ? 'insufficient_data' : 'completed' : 'not_found',
    conversationId: request.conversationId || randomUUID(), reply: { summary: fallback.split('\n').slice(0, 3).join('\n'), detail: fallback },
    decision, explanationSource: 'rules', evidence: decision ? [...decision.evaluations] : (data ? [data] : []),
    steps: decision?.steps ?? [], reportConditions: decision?.reportConditions ?? [], initialResponses: decision?.actions ?? [],
    missingFields: decision?.missingFields ?? data?.missingFields ?? [], dataSource: decision ? decision.demoOnly ? 'synthetic' : 'model' : data ? 'forecast_csv' : 'unavailable', demoOnly: decision?.demoOnly ?? false,
    toolTrace: [{ name: intent === 'forecast' ? 'get_forecast_summary' : intent === 'executive' ? 'get_executive_report_data' : 'shared_decision', status: decision?.status ?? (data ? 'ok' : 'not_found') }],
  }
  return { response, data, intent }
}

export async function runAgent(request: AgentRequest): Promise<AgentResponse> {
  if (!request || typeof request.message !== 'string') throw new Error('질문을 입력하세요.')
  const conversation = resolveConversation(request)
  const { response, intent } = prepareResponse(conversation.request)
  return executeAgent(conversation.request, response, intent, conversation.session)
}
