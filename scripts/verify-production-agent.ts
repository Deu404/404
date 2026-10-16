import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { getObservation, evaluateProduction, loadPolicy } from '../server/src/production.ts'
import type { InspectionPolicy } from '../server/src/production.ts'
import { readForecast, readExecutiveReport } from '../server/src/forecast.ts'
import { runAgent } from '../server/src/agent.ts'

mkdirSync('node_modules/.tmp', { recursive: true })
const folder = mkdtempSync(resolve('node_modules/.tmp/production-agent-'))
const file = resolve(folder, 'equipment_1(PM-3).csv')
const policyFile = resolve(folder, 'policy.json')
const header = 'localtime,currentR,currentS,currentT,powerFactorR,powerFactorS,powerFactorT,activePower'
const row = '20250510000000,128,90,92,90,92,91,1200'
writeFileSync(file, `${header}\n${row}\n`)
const saved = { dir: process.env.EQUIPMENT_DATA_DIR, policy: process.env.INSPECTION_POLICY_FILE, key: process.env.OPENAI_API_KEY, fetch: globalThis.fetch }
process.env.EQUIPMENT_DATA_DIR = folder
process.env.INSPECTION_POLICY_FILE = policyFile
delete process.env.OPENAI_API_KEY
const anomaly = { id: 'production-test', equipmentId: 'compressor-01', occurredAt: '2025-05-10 00:00:00', fields: ['currentR'] }
let checks = 0
const pass = (text: string) => { checks++; console.log(`PASS ${text}`) }
try {
  const observation = await getObservation(anomaly)
  assert.equal(observation.status, 'ok')
  assert.equal(observation.values?.currentR, '128')
  assert.equal((await getObservation({ ...anomaly, occurredAt: '2025-05-10T00:00:00+09:00' })).status, 'ok')
  assert.equal((await getObservation({ ...anomaly, occurredAt: '2025-05-10 00:00:01' })).status, 'not_found')
  assert.equal((await getObservation({ ...anomaly, occurredAt: '2025-02-31 00:00' })).status, 'invalid_input')
  assert.equal((await getObservation({ ...anomaly, equipmentId: '../../secret' })).status, 'invalid_input')
  pass('같은 시각 조회·KST·초 단위 불일치·잘못된 시각·경로 차단')
  writeFileSync(file, `${header}\n${row}\n${row}\n`)
  assert.equal((await getObservation(anomaly)).status, 'ambiguous')
  writeFileSync(file, `${header}\n${row}\n`)
  pass('중복 관측을 임의로 선택하지 않음')
  const empty: InspectionPolicy = { version: 'test-v1', units: {}, rules: [] }
  writeFileSync(policyFile, JSON.stringify(empty))
  const unconfigured = evaluateProduction(anomaly, observation, loadPolicy())
  assert.equal(unconfigured.demoOnly, false)
  assert.equal(unconfigured.priority, null)
  assert.equal(unconfigured.evaluations.length, 0)
  assert.equal(unconfigured.missingFields.length, 4)
  pass('데모 기준 없이 미등록 판정 보류')
  const policy: InspectionPolicy = {
    version: 'fixture-v1', units: { currentR: 'A', currentS: 'A', currentT: 'A', powerFactorR: '%', powerFactorS: '%', powerFactorT: '%', activePower: 'W' },
    rules: [
      { id: 'test-current', equipmentId: 'compressor-01', type: 'overcurrent', threshold: 100, source: '테스트 전용 가상 기준', priority: 'high', actions: ['표시값 기록'], reportConditions: ['테스트 조건 확인'] },
      { id: 'test-pf', equipmentId: 'compressor-01', type: 'low-power-factor', threshold: .85, source: '테스트 전용 가상 기준', priority: 'medium', actions: ['표시값 기록'], reportConditions: [] },
      { id: 'test-power', equipmentId: 'compressor-01', type: 'power-consumption-increase', threshold: 10, source: '테스트 전용 가상 기준', priority: 'medium', actions: ['표시값 기록'], reportConditions: [], reference: { value: 1, unit: 'kW', source: '가상 비교', period: '테스트 기준 구간' } },
      { id: 'test-phase', equipmentId: 'compressor-01', type: 'phase-current-imbalance', threshold: 10, source: '테스트 전용 가상 기준', priority: 'high', actions: ['표시값 기록'], reportConditions: [] },
    ],
  }
  writeFileSync(policyFile, JSON.stringify(policy))
  const d = evaluateProduction(anomaly, observation, loadPolicy())
  assert.equal(d.priority, 'high')
  assert.equal(d.status, 'matched')
  assert.equal(d.evaluations[1].measurement, .9)
  assert.ok(Math.abs(d.evaluations[2].measurement! - 20) < 1e-9)
  assert.equal(d.missingFields.length, 0)
  assert.equal(d.demoOnly, false)
  const partial = structuredClone(observation)
  partial.values!.currentT = ''
  const p = evaluateProduction(anomaly, partial, policy)
  assert.equal(p.status, 'matched')
  assert.ok(p.missingFields.some(f => f.includes('currentT')))
  assert.equal(p.evaluations[3].result, 'insufficient_data')
  const boundary = structuredClone(observation)
  boundary.values!.currentR = '100'; boundary.values!.currentS = '100'; boundary.values!.currentT = '100'
  assert.equal(evaluateProduction(anomaly, boundary, policy).evaluations[0].result, 'within_threshold')
  pass('등록 기준·단위 변환·경계값·복합 이상·일부 누락 유지')
  writeFileSync(policyFile, JSON.stringify({ ...policy, rules: [policy.rules[0], policy.rules[0]] }))
  assert.throws(loadPolicy, /중복/)
  writeFileSync(policyFile, JSON.stringify(policy))
  pass('중복 기준 거부')
  const forecast = readForecast()
  assert.equal(forecast.hoursCount, 505)
  assert.ok(Math.abs(forecast.totalEstimatedCostKRW - 3556860744.931245) < .01)
  assert.ok(Math.abs(forecast.evaluationMetrics.hourlyPowMAE - 89.64176193143737) < 1e-8)
  assert.equal(readExecutiveReport().anomaliesSummary, null)
  pass('실제 CSV 합계·MAE 및 가상 이상통계 제외')
  const offline = await runAgent({ message: '선택한 알림 확인', anomaly })
  assert.equal(offline.decision?.priority, 'high')
  assert.equal(offline.explanationSource, 'rules')
  assert.ok(offline.evidence.length)
  pass('AI 미연결 상태의 실제 관측·등록 판정')
  process.env.OPENAI_API_KEY = 'test-placeholder'
  let sawHistory = false
  // 도구 결과를 받은 뒤 추가 도구를 선택하고 최종 응답하는 흐름을 검증한다.
  globalThis.fetch = async (_url, options) => {
    const body = JSON.parse(String(options?.body))
    sawHistory ||= body.messages.some((m: { content: string }) => m.content?.includes('이전질문표식'))
    const tools = body.messages.filter((m: { role: string }) => m.role === 'tool').length
    return Response.json({ choices: [{ message: tools < 2 ? { tool_calls: [{ id: `call-${tools}`, type: 'function', function: { name: tools ? 'evaluate_priority' : 'classify_anomaly', arguments: '{}' } }] } : { content: '확인된 값과 등록 기준을 참고하세요.' } }] })
  }
  const ai = await runAgent({ message: '이전질문표식 근거 알려줘', anomaly })
  assert.equal(ai.explanationSource, 'ai')
  assert.deepEqual(ai.decision, offline.decision)
  assert.ok(ai.toolTrace.length >= 3)
  sawHistory = false
  const follow = await runAgent({ message: '그 설비는?', conversationId: ai.conversationId })
  assert.equal(follow.decision?.equipmentId, anomaly.equipmentId)
  assert.equal(sawHistory, true)
  sawHistory = false
  const changed = await runAgent({ message: '다른 알림', conversationId: ai.conversationId, anomaly: { ...anomaly, id: 'new-target', equipmentId: 'robot-02' } })
  assert.equal(changed.decision?.equipmentId, 'robot-02')
  assert.equal(sawHistory, false)
  pass('AI 추가 도구 호출·확정 판정 유지·후속 질문·대상 변경 시 이력 분리')
  let count = 0
  globalThis.fetch = async () => { count++; return Response.json({ choices: [{ message: { tool_calls: [{ id: String(count), type: 'function', function: { name: 'get_anomaly_case', arguments: '{"equipmentId":"robot-02"}' } }] } }] }) }
  const rejected = await runAgent({ message: '대상 바꾸기', anomaly })
  assert.equal(rejected.explanationSource, 'rules')
  assert.ok(rejected.toolTrace.some(t => (t as { status: string }).status === 'rejected'))
  assert.ok(count <= 6)
  pass('도구 인자 대상 변경 거부·반복 한도·부분 결과 복구')
  globalThis.fetch = async () => { throw new Error('offline') }
  const failed = await runAgent({ message: '확인', anomaly })
  assert.deepEqual(failed.decision, offline.decision)
  assert.equal(failed.explanationSource, 'rules')
  pass('AI 실패 시 실제 판정 보존')
  globalThis.fetch = async (_url, options) => {
    const body = JSON.parse(String(options?.body))
    if (body.messages.at(-1).role === 'tool') return Response.json({ choices: [{ message: { content: '도구 근거를 확인했습니다.' } }] })
    return Response.json({ choices: [{ message: { tool_calls: ['get_anomaly_case', 'classify_anomaly', 'evaluate_priority', 'get_inspection_guide', 'get_forecast_summary', 'get_executive_report_data'].map((name, i) => ({ id: `all-${i}`, type: 'function', function: { name, arguments: name === 'get_inspection_guide' ? '{"alertType":"overcurrent"}' : '{}' } })) } }] })
  }
  const all = await runAgent({ message: '전체 근거 확인', anomaly })
  assert.equal(all.explanationSource, 'ai')
  assert.equal(all.toolTrace.filter(t => (t as { trigger: string }).trigger === 'ai').length, 6)
  assert.doesNotThrow(() => JSON.stringify(all))
  pass('6개 도구의 실제 디스패치·등록 가이드·CSV 결과 직렬화')
  globalThis.fetch = async () => Response.json({ error: { message: 'private details not shown' } }, { status: 401 })
  const auth = await runAgent({ message: '예측', intent: 'forecast' })
  assert.match(auth.explanationNotice!, /HTTP 401/)
  assert.doesNotMatch(auth.explanationNotice!, /private details/)
  pass('API 오류 상태 표시·서버 오류 본문 비노출')
} finally {
  globalThis.fetch = saved.fetch
  for (const [key, value] of Object.entries({ EQUIPMENT_DATA_DIR: saved.dir, INSPECTION_POLICY_FILE: saved.policy, OPENAI_API_KEY: saved.key })) {
    if (value === undefined) delete process.env[key]; else process.env[key] = value
  }
}
console.log(`${checks} production groups passed`)
