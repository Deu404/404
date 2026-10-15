import { decideModelAnomaly } from '../../src/shared/modelDecision.ts'
import type { ModelAnomalyInput } from '../../src/shared/modelDecision.ts'
// 판단과 조회 순서는 코드가 결정하고 AI에는 완성된 결과만 전달한다.
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { decideAlert, decideCase, decisionSummary, reportText } from '../../src/shared/decision.ts'
import type { AlertInput, Decision } from '../../src/shared/decision.ts'
import { findDemoCase } from './fixtures/demoCases.ts'
import { get_forecast_summary, get_executive_report_data } from './tools.ts'

export type AgentRequest = { message: string; alert?: AlertInput; anomaly?: ModelAnomalyInput; caseId?: string; conversationId?: string; intent?: 'anomaly' | 'forecast' | 'executive' | 'report' }
export type AgentResponse = {
  status: 'completed' | 'insufficient_data' | 'not_found'
  conversationId: string; reply: { summary: string; detail: string }
  decision?: Decision; explanationSource: 'ai' | 'rules'; explanationNotice?: string
  evidence: unknown[]; steps: unknown[]; reportConditions: string[]; initialResponses: string[]
  missingFields: string[]; dataSource: string; demoOnly: boolean; toolTrace: unknown[]
}
const promptPath = fileURLToPath(new URL('../prompt.txt', import.meta.url))

export function prepareResponse(request: AgentRequest) {
  const message = request.message?.trim()
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
      if (typeof a.id !== 'string' || typeof a.equipmentId !== 'string' || typeof a.occurredAt !== 'string' || !Array.isArray(a.fields)) throw new Error('모델 결과 정보를 확인하세요.')
      decision = decideModelAnomaly(a)
    } else if (request.caseId) {
      const c = findDemoCase(request.caseId)
      if (c) decision = decideCase(c)
    }
  }
  const data = intent === 'forecast' ? get_forecast_summary() : intent === 'executive' ? get_executive_report_data() : decision
  const fallback = decision ? intent === 'report' ? reportText(decision) : decisionSummary(decision)
    : data ? JSON.stringify(data, null, 2) : '연결된 측정 자료가 없어요. 알림을 선택하거나 담당자에게 자료를 확인하세요.'
  const response: AgentResponse = {
    status: decision ? decision.status === 'insufficient_data' || decision.status === 'no_applicable_rule' || decision.missingFields.length ? 'insufficient_data' : 'completed' : data ? 'completed' : 'not_found',
    conversationId: request.conversationId || randomUUID(), reply: { summary: fallback.split('\n').slice(0, 3).join('\n'), detail: fallback },
    decision, explanationSource: 'rules', evidence: decision?.evaluations ?? (data ? [data] : []),
    steps: decision?.steps ?? [], reportConditions: decision?.reportConditions ?? [], initialResponses: decision?.actions ?? [],
    missingFields: decision?.missingFields ?? [], dataSource: decision ? decision.demoOnly ? 'synthetic' : 'model' : data ? 'forecast_model_v1' : 'unavailable', demoOnly: decision?.demoOnly ?? false,
    toolTrace: [{ name: intent === 'forecast' ? 'get_forecast_summary' : intent === 'executive' ? 'get_executive_report_data' : 'shared_decision', status: decision?.status ?? (data ? 'ok' : 'not_found') }],
  }
  return { response, data, intent }
}

export async function runAgent(request: AgentRequest): Promise<AgentResponse> {
  const { response, data, intent } = prepareResponse(request)
  // 보고 초안은 판정 결과 그대로 작성한다. AI가 보고 여부나 수행 사실을 바꾸지 않는다.
  if (intent === 'report' || !data || response.decision?.source === '모델 API의 이상 의심 결과') return response
  if (!process.env.OPENAI_API_KEY) return { ...response, explanationNotice: 'AI 설명 연결 전이에요. 룰에 따른 안내를 표시합니다.' }
  try {
    const model = process.env.OPENAI_MODEL || 'gpt-5-mini'
    const apiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST', signal: AbortSignal.timeout(25000),
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body: JSON.stringify({ model, messages: [
        { role: 'system', content: readFileSync(promptPath, 'utf8') },
        { role: 'user', content: JSON.stringify({ question: request.message, intent, confirmedResult: data }) },
      ] }),
    })
    if (!apiResponse.ok) throw new Error('설명 서비스 연결 실패')
    const payload = await apiResponse.json() as { choices?: Array<{ message?: { content?: string } }> }
    const text = payload.choices?.[0]?.message?.content?.trim()
    if (!text) throw new Error('설명 없음')
    return { ...response, explanationSource: 'ai', reply: { summary: response.reply.summary, detail: text } }
  } catch {
    return { ...response, explanationNotice: 'AI 설명에 연결하지 못했어요. 룰에 따른 안내를 표시합니다.' }
  }
}
