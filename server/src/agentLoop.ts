import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import type { AgentRequest, AgentResponse } from './agent.ts'
import { decisionSummary, reportText } from '../../src/shared/decision.ts'
import { getObservation, evaluateProduction, loadPolicy, GUIDE_TYPES } from './production.ts'
import { patternGuide, PATTERN_GUIDE_TYPES, patternEvidenceText } from '../../src/shared/normalPattern.ts'
import type { PatternGuideType } from '../../src/shared/normalPattern.ts'
import type { Observation } from './production.ts'
import { readForecast, readExecutiveReport, forecastText } from './forecast.ts'
import { get_inspection_guide } from './tools.ts'

type History = { role: 'user' | 'assistant'; content: string }
type Session = { target: string; context: Pick<AgentRequest, 'alert' | 'anomaly' | 'caseId'>; history: History[]; updated: number; intent?: AgentRequest['intent'] }
const sessions = new Map<string, Session>()
const active = new Set<string>()
const targetKey = (r: AgentRequest) => JSON.stringify(r.alert ?? r.anomaly ?? r.caseId ?? null)
export function resolveConversation(request: AgentRequest) {
  for (const [id, s] of sessions) if (Date.now() - s.updated > 30 * 60_000) sessions.delete(id)
  const existing = request.conversationId ? sessions.get(request.conversationId) : undefined
  const hasTarget = Boolean(request.alert || request.anomaly || request.caseId)
  const merged = existing && !hasTarget ? { ...request, ...existing.context } : request
  const key = targetKey(merged)
  const session = existing && existing.target === key ? existing : { target: key, context: { alert: merged.alert, anomaly: merged.anomaly, caseId: merged.caseId }, history: [], updated: Date.now() }
  if (!merged.intent && existing === session && !/보고|경영|요금|탄소|예측/.test(merged.message)) merged.intent = existing.intent
  const id = existing && existing === session ? request.conversationId! : randomUUID()
  return { request: { ...merged, conversationId: id }, session, id }
}
const descriptions: Record<string, string> = {
  get_anomaly_case: '현재 선택한 알림과 발생 시점에 정확히 일치하는 원시 관측·출처·미확인 정보를 조회한다. 대상 변경 불가.',
  classify_anomaly: '선택 알림에 등록된 기준을 함수로 평가한다. 기준·측정값·단위가 없으면 보류한다.',
  evaluate_priority: '함수가 확정한 확인 우선순위와 보류 사유를 조회한다.',
  get_inspection_guide: '선택 설비·유형에 등록된 안내와 보고 조건만 조회한다. 없으면 미등록을 반환한다.',
  get_forecast_summary: '전달된 CSV에서 전력·요금·탄소 합계와 피크, 평가 MAE, 기간을 조회한다.',
  get_executive_report_data: 'CSV 예측과 실제 이상 통계의 제공 여부를 구분한 경영 요약 자료를 조회한다.',
}
export const agentTools = Object.entries(descriptions).map(([name, description]) => ({ type: 'function', function: {
  name, description, strict: true,
  parameters: { type: 'object', properties: name === 'get_inspection_guide' ? { alertType: { type: 'string', enum: GUIDE_TYPES } } : {}, required: name === 'get_inspection_guide' ? ['alertType'] : [], additionalProperties: false },
} }))
type ToolCall = { id: string; type: 'function'; function: { name: string; arguments: string } }
type ChatMessage = { role: 'system' | 'user' | 'assistant' | 'tool'; content: string | null; tool_call_id?: string; tool_calls?: ToolCall[] }

export async function executeAgent(request: AgentRequest, response: AgentResponse, intent: string, session: Session): Promise<AgentResponse> {
  if (active.has(response.conversationId)) throw new Error('이 대화의 이전 요청이 처리 중입니다.')
  active.add(response.conversationId)
  session.intent = intent as AgentRequest['intent']
  response.toolTrace = request.anomaly && !request.alert && (intent === 'anomaly' || intent === 'report') ? [] : response.toolTrace.map(t => ({ ...(t as object), trigger: 'server' }))
  let observation: Observation | undefined
  try {
    if (request.anomaly && !request.alert && (intent === 'anomaly' || intent === 'report')) {
      observation = await getObservation(request.anomaly)
      response.evidence.push(observation)
      try {
        const policy = loadPolicy()
        response.decision = evaluateProduction(request.anomaly, observation, policy)
      } catch {
        response.decision!.missingFields.push('판정 설정 오류: 설정 파일을 확인하세요.')
      }
      response.toolTrace.push({ name: 'get_anomaly_case', status: observation.status, trigger: 'server', source: observation.source })
    }
    const d = response.decision
    if (d) {
      response.status = d.missingFields.length || d.status === 'insufficient_data' || d.status === 'no_applicable_rule' ? 'insufficient_data' : 'completed'
      response.evidence.push(...d.evaluations)
      if (d.pattern) response.evidence.push(d.pattern)
      response.initialResponses = d.actions; response.steps = d.steps; response.reportConditions = d.reportConditions; response.missingFields = d.missingFields
      response.demoOnly = d.demoOnly
      response.reply = { summary: decisionSummary(d), detail: intent === 'report' ? reportText(d) : `${decisionSummary(d)}\n${d.pattern ? patternEvidenceText(d.pattern) + '\n' : ''}${d.missingFields.length ? '확인 필요: ' + d.missingFields.join(', ') : ''}` }
    }
    const execute = async (name: string, args: Record<string, unknown>): Promise<unknown> => {
      if (!Object.hasOwn(descriptions, name)) throw new Error('등록되지 않은 도구')
      const allowed = name === 'get_inspection_guide' ? ['alertType'] : []
      if (Object.keys(args).some(k => !allowed.includes(k))) throw new Error('허용되지 않은 도구 인자')
      if (name === 'get_anomaly_case') return { status: d ? 'ok' : 'not_found', selected: request.anomaly ?? request.alert ?? request.caseId ?? null, observation, decision: d }
      if (name === 'classify_anomaly') return { evaluations: d?.evaluations ?? [], pattern: d?.pattern, missingFields: d?.missingFields ?? ['선택한 알림 없음'] }
      if (name === 'evaluate_priority') return { priority: d?.priority ?? null, missingFields: d?.missingFields ?? ['선택한 알림 없음'] }
      if (name === 'get_inspection_guide') {
        if (typeof args.alertType !== 'string' || !GUIDE_TYPES.includes(args.alertType as typeof GUIDE_TYPES[number])) throw new Error('안내 유형을 확인하세요.')
        if (d?.pattern && PATTERN_GUIDE_TYPES.includes(args.alertType as PatternGuideType)) return patternGuide(args.alertType as PatternGuideType)
        if (d?.demoOnly) return get_inspection_guide({ alertType: args.alertType })
        const rule = request.anomaly ? loadPolicy().rules.find(r => r.equipmentId === request.anomaly!.equipmentId && r.type === args.alertType) : undefined
        return rule ? { status: 'ok', source: rule.source, actions: rule.actions, reportConditions: rule.reportConditions, applicability: '등록 조건에 맞을 때만 적용. 관측되지 않은 현장 증상을 발생 사실로 취급하지 않음' } : { status: 'not_found', message: '선택 설비·유형의 안내가 등록되지 않았습니다.' }
      }
      const output = name === 'get_forecast_summary' ? readForecast() : readExecutiveReport()
      if (!d) {
        response.status = output.missingFields.length ? 'insufficient_data' : 'completed'
        response.missingFields = output.missingFields
        response.dataSource = 'forecast_csv'
        response.reply = { summary: forecastText(output).split('\n').slice(0, 3).join('\n'), detail: forecastText(output) }
      }
      return output
    }
    if (intent === 'report') return response
    if (!process.env.OPENAI_API_KEY) { response.explanationNotice = 'AI 연결 설정이 없어 확인된 조회·판정 결과를 표시합니다.'; return response }
    const messages: ChatMessage[] = [
      { role: 'system', content: readFileSync(new URL('../prompt.txt', import.meta.url), 'utf8') },
      ...session.history.slice(-8),
      { role: 'user', content: JSON.stringify({ question: request.message, intent, selected: request.anomaly ?? request.alert ?? request.caseId ?? null, confirmedResult: { decision: d, evidence: response.evidence } }) },
    ]
    let calls = 0
    let executedCalls = 0
    const signal = AbortSignal.timeout(25000)
    for (let round = 0; round < 6; round++) {
      const api = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST', signal,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
        body: JSON.stringify({ model: process.env.OPENAI_MODEL || 'gpt-5-mini', messages, tools: agentTools, tool_choice: round === 0 ? 'required' : 'auto', parallel_tool_calls: false, max_completion_tokens: 3000 }),
      })
      if (!api.ok) throw new Error(`AI 연결 오류 (HTTP ${api.status})`)
      const payload = await api.json() as { choices?: Array<{ message?: { content?: string | null; tool_calls?: ToolCall[] } }> }
      const result = payload.choices?.[0]?.message
      if (!result) throw new Error('AI 응답 누락')
      if (result.tool_calls?.length) {
        if (calls + result.tool_calls.length > 10) throw new Error('도구 호출 한도')
        messages.push({ role: 'assistant', content: result.content ?? null, tool_calls: result.tool_calls })
        for (const call of result.tool_calls) {
          calls++
          let output: unknown
          try {
            const args: unknown = JSON.parse(call.function.arguments)
            if (!args || typeof args !== 'object' || Array.isArray(args)) throw new Error('도구 인자는 객체여야 합니다.')
            output = await execute(call.function.name, args as Record<string, unknown>)
            executedCalls++
            response.toolTrace.push({ name: call.function.name, status: 'executed', trigger: 'ai' })
            response.evidence.push(output)
          } catch {
            output = { status: 'invalid_input', message: '등록된 도구 이름과 인자 형식을 확인하세요. 대상은 현재 선택한 알림으로 고정됩니다.' }
            response.toolTrace.push({ name: Object.hasOwn(descriptions, call.function.name) ? call.function.name : 'unknown_tool', status: 'rejected', trigger: 'ai' })
          }
          messages.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify(output) })
        }
        continue
      }
      const text = result.content?.trim()
      if (!text || !executedCalls) throw new Error('도구 근거 없는 AI 응답')
      response.explanationSource = 'ai'
      response.reply.detail = `${response.reply.detail}\n\nAI 설명\n${text}`
      return response
    }
    throw new Error('도구 반복 한도')
  } catch (error) {
    const reason = error instanceof Error && /^AI 연결 오류 \(HTTP \d{3}\)$/.test(error.message) ? error.message : error instanceof Error && error.name === 'TimeoutError' ? 'AI 응답 시간 초과' : 'AI 연결 또는 도구 실행 미완료'
    response.explanationNotice = `${reason}. 확인된 조회·판정 결과와 실행 근거를 표시합니다.`
    return response
  } finally {
    active.delete(response.conversationId)
    session.history.push({ role: 'user', content: request.message }, { role: 'assistant', content: response.reply.detail.slice(0, 6000) })
    session.history = session.history.slice(-8); session.updated = Date.now()
    if (!sessions.has(response.conversationId) && sessions.size >= 100) sessions.delete(sessions.keys().next().value!)
    sessions.set(response.conversationId, session)
  }
}
