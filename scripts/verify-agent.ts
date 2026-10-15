import assert from 'node:assert/strict'
import { decideAlert, decideCase, reportText } from '../src/shared/decision.ts'
import { classifyAlert } from '../src/services/alertRules.ts'
import { DEMO_CASES } from '../server/src/fixtures/demoCases.ts'
import { MOCK_ALERTS } from '../src/mocks/mockAlerts.ts'
import { prepareResponse, runAgent } from '../server/src/agent.ts'

let checks = 0
function check(name: string, test: () => void) { test(); checks++; console.log(`PASS ${name}`) }
const input = { id: 'test', equipmentId: 'robot-03', occurredAt: '2024-08-22 07:45', type: 'overcurrent', measurement: 128 }
check('목록·서버의 동일 입력·판정·설비 이름 일치', () => {
  for (const alert of MOCK_ALERTS) {
    const local = decideAlert(alert)
    assert.deepEqual(prepareResponse({ message: '설명', alert }).response.decision, local)
    assert.equal(classifyAlert(alert).priority, local.priority ?? 'medium')
  }
  assert.equal(decideAlert(MOCK_ALERTS[0]).equipmentName, '분쇄기(1)')
  assert.equal(decideAlert(MOCK_ALERTS[2]).equipmentName, 'L-1 전등')
})
check('경계값은 초과·미만으로 처리', () => {
  assert.equal(decideAlert({ ...input, measurement: 100 }).status, 'within_threshold')
  assert.equal(decideAlert({ ...input, type: 'low-power-factor', measurement: 0.85 }).status, 'within_threshold')
  assert.equal(decideAlert({ ...input, type: 'power-consumption-increase', measurement: 110, reference: 100 }).status, 'within_threshold')
  assert.equal(decideAlert({ ...input, type: 'power-consumption-increase', measurement: 110.01, reference: 100 }).status, 'matched')
})
check('자료 누락·단위 오류·NaN·무한대는 정상으로 표시하지 않음', () => {
  for (const measurement of [undefined, NaN, Infinity, -1]) assert.equal(decideAlert({ ...input, measurement }).status, 'insufficient_data')
  assert.equal(decideAlert({ ...input, type: 'low-power-factor', measurement: 87 }).status, 'insufficient_data')
  assert.equal(decideAlert({ ...input, type: 'power-consumption-increase', reference: 0 }).status, 'insufficient_data')
})
check('등록되지 않은 유형·설비·사례를 다른 사례로 대체하지 않음', () => {
  assert.equal(decideAlert({ ...input, type: 'voltage-spike' }).status, 'no_applicable_rule')
  assert.equal(decideAlert({ ...input, equipmentId: 'unknown' }).status, 'insufficient_data')
  assert.equal(prepareResponse({ message: '설명', caseId: 'unknown' }).response.status, 'not_found')
})
check('복합 이상·필수 행동·보고 조건 유지', () => {
  const d = decideCase(DEMO_CASES.find(c => c.caseId === 'demo-multi-002')!)
  assert.equal(d.anomalyTypes.length, 2)
  assert.equal(d.actions.length, 2)
  assert.equal(d.reportConditions.length, 4)
  assert.equal(d.reportStatus, 'required')
  assert.match(reportText(d), /즉시 보고/)
})
check('일부 상 누락은 보류, 확인된 이상은 유지', () => {
  const c = structuredClone(DEMO_CASES.find(c => c.caseId === 'demo-missing-003')!)
  const missing = decideCase(c)
  assert.equal(missing.status, 'insufficient_data')
  assert.equal(missing.evaluations[0].result, 'insufficient_data')
  c.measurements.currentR = 128
  const matched = decideCase(c)
  assert.equal(matched.status, 'matched')
  assert.ok(matched.missingFields.includes('currentT'))
})
check('평균 0·비교값 0은 계산 보류', () => {
  const c = structuredClone(DEMO_CASES[0])
  c.measurements.currentR = c.measurements.currentS = c.measurements.currentT = 0
  c.comparison!.referencePower = 0
  const d = decideCase(c)
  assert.equal(d.evaluations[2].result, 'insufficient_data')
  assert.equal(d.evaluations[3].result, 'insufficient_data')
})
check('조건부 보고를 보고 불필요로 바꾸지 않음', () => {
  assert.equal(decideAlert(input).reportStatus, 'needs_confirmation')
})
check('실제 모델 결과에 측정값이 없으면 데모 룰·조치를 추정하지 않음', () => {
  const anomaly = { id: 'real-model-001', equipmentId: 'robot-02', occurredAt: '2025-05-10 00:00', fields: ['currentR'] }
  const d = prepareResponse({ message: '확인', anomaly }).response.decision!
  assert.equal(d.demoOnly, false)
  assert.equal(d.priority, null)
  assert.equal(d.status, 'insufficient_data')
  assert.equal(d.evaluations.length, 0)
  assert.equal(d.reportStatus, 'needs_confirmation')
  assert.equal(d.equipmentName, '4호기')
  assert.doesNotMatch(reportText(d), /연습용 사례|즉시 보고/)
})
const originalFetch = globalThis.fetch
const savedKey = process.env.OPENAI_API_KEY
try {
  delete process.env.OPENAI_API_KEY
  const offline = await runAgent({ message: '설명', alert: input })
  assert.equal(offline.explanationSource, 'rules'); assert.ok(offline.decision?.actions.length); checks++
  process.env.OPENAI_API_KEY = 'test-placeholder'
  globalThis.fetch = async (_url, options) => {
    const body = JSON.parse(String(options?.body))
    assert.equal(body.tools, undefined)
    assert.match(body.messages[1].content, /confirmedResult/)
    return new Response(JSON.stringify({ choices: [{ message: { content: '측정 전류가 기준을 넘었어요.' } }] }), { status: 200 })
  }
  const explained = await runAgent({ message: '쉽게 설명', alert: input })
  assert.equal(explained.explanationSource, 'ai')
  assert.deepEqual(explained.decision, offline.decision); checks++
  const modelExplanation = await runAgent({ message: '우선순위 근거', anomaly: { id: 'real-model-001', equipmentId: 'robot-02', occurredAt: '2025-05-10 00:00', fields: ['currentR'] } })
  assert.equal(modelExplanation.explanationSource, 'ai')
  assert.equal(modelExplanation.decision?.priority, null)
  assert.equal(modelExplanation.status, 'insufficient_data'); checks++
  globalThis.fetch = async () => { throw new Error('offline') }
  const failed = await runAgent({ message: '설명', alert: input })
  assert.equal(failed.explanationSource, 'rules'); assert.deepEqual(failed.decision, offline.decision); checks++
  const report = await runAgent({ message: '보고 문구', alert: input })
  assert.match(report.reply.detail, /보고 초안/); checks++
} finally {
  globalThis.fetch = originalFetch
  if (savedKey === undefined) delete process.env.OPENAI_API_KEY
  else process.env.OPENAI_API_KEY = savedKey
}
console.log(`${checks} groups passed (AI 설명·실패 복구 포함)`)
