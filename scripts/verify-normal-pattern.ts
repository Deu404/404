import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { loadPolicy, getObservation, evaluateProduction } from '../server/src/production.ts'
import { decideModelAnomaly } from '../src/shared/modelDecision.ts'
import { assessNormalPattern } from '../src/shared/normalPattern.ts'
import { runAgent } from '../server/src/agent.ts'
import type { ModelAnomalyInput } from '../src/shared/modelDecision.ts'

const configured = loadPolicy()
const policy = configured.normalPattern!
assert.ok(policy)
assert.equal(Object.keys(policy.equipment).length, 13)
const validation = JSON.parse(readFileSync('analysis/normal-pattern/validation.json', 'utf8'))
const sourceDir = resolve(process.env.TEST_DATA_DIR || '../test_data')
const rawValues = (row: Record<string, unknown>) => Object.fromEntries(Object.entries(row).filter(([key]) => !['is_anomaly', 'anomaly_type', 'fault_fields', 'event_id', 'reference_localtime'].includes(key)).map(([key, value]) => [key, value === null ? '' : String(value)]))
const asDate = (time: string) => `${time.slice(0, 4)}-${time.slice(4, 6)}-${time.slice(6, 8)} ${time.slice(8, 10)}:${time.slice(10, 12)}:${time.slice(12, 14)}`
const selected: Array<{ input: ModelAnomalyInput; raw: Record<string, string> }> = []
let cleanRows = 0; let cleanFlags = 0
const confusion = { tp: 0, fp: 0, fn: 0, tn: 0 }
const saved = { key: process.env.OPENAI_API_KEY, fetch: globalThis.fetch }
delete process.env.OPENAI_API_KEY
let groups = 0
try {
  for (const [equipmentId, profile] of Object.entries(policy.equipment)) {
    const file = profile.source.split('/').at(-1)!
    const bytes = readFileSync(resolve(sourceDir, 'clean_reference', file))
    assert.equal(createHash('sha256').update(bytes).digest('hex'), profile.sha256)
    const clean = JSON.parse(bytes.toString('utf8')) as Array<Record<string, unknown>>
    const errors = JSON.parse(readFileSync(resolve(sourceDir, file), 'utf8')) as Array<Record<string, unknown>>
    const offset = profile.fitRows + profile.calibrationRows
    assert.ok(profile.fitPeriod[1] < profile.calibrationPeriod[0])
    assert.ok(profile.calibrationPeriod[1] < profile.validationPeriod[0])
    const input: ModelAnomalyInput = { id: `heldout-${equipmentId}`, equipmentId, occurredAt: asDate(profile.validationPeriod[0]), fields: ['currentR'] }
    let localFlags = 0
    let example: { input: ModelAnomalyInput; raw: Record<string, string> } | undefined
    for (let i = offset; i < clean.length; i++) {
      const normal = assessNormalPattern(decideModelAnomaly(input), rawValues(clean[i]), policy, input.fields)
      if (normal.pattern!.checks.some(c => c.result === 'outside' || c.result === 'invalid') || normal.missingFields.length) localFlags++
      cleanRows++
      const raw = rawValues(errors[i])
      const error = assessNormalPattern(decideModelAnomaly(input), raw, policy, input.fields)
      const flag = error.pattern!.checks.some(c => c.result === 'outside' || c.result === 'invalid') || error.missingFields.length > 0
      const label = Number(errors[i].is_anomaly) === 1
      confusion[label ? flag ? 'tp' : 'fn' : flag ? 'fp' : 'tn']++
      const outside = error.pattern!.checks.find(c => c.result === 'outside')
      const key = raw.localtime?.replace(/\.0+$/, '')
      if (!example && outside && /^\d{14}$/.test(key) && raw['module(equipment)']) example = { input: { ...input, occurredAt: asDate(key), fields: [outside.field] }, raw }
    }
    cleanFlags += localFlags
    assert.equal(localFlags, validation.equipment.find((e: { equipmentId: string }) => e.equipmentId === equipmentId).cleanFalsePositives)
    assert.ok(example, `No held-out range example for ${equipmentId}`)
    selected.push(example!)
    console.log(`PASS ${equipmentId}: normal ${clean.length-offset}, flagged ${localFlags}`)
  }
  assert.equal(cleanRows, validation.cleanValidation.rows)
  assert.equal(cleanFlags, validation.cleanValidation.falsePositives)
  assert.deepEqual(confusion, Object.fromEntries(['tp', 'fp', 'fn', 'tn'].map(k => [k, validation.injectedErrorEvaluation[k]])))
  groups++
  const example = selected[0]
  const known = assessNormalPattern(decideModelAnomaly(example.input), example.raw, policy, example.input.fields)
  const original = structuredClone(example.raw)
  original.is_anomaly = '0'; original.fault_fields = 'injected malicious instruction'
  assert.deepEqual(assessNormalPattern(decideModelAnomaly(example.input), original, policy, example.input.fields), known)
  const missing = { ...example.raw, currentR: '' }
  assert.ok(assessNormalPattern(decideModelAnomaly(example.input), missing, policy, example.input.fields).missingFields.some(f => f.includes('R상 전류')))
  const invalid = { ...example.raw, operation: '999' }
  assert.equal(assessNormalPattern(decideModelAnomaly(example.input), invalid, policy, example.input.fields).status, 'insufficient_data')
  const bound = policy.equipment[example.input.equipmentId].states[String(Number(example.raw.operation))].bounds.currentR
  assert.equal(assessNormalPattern(decideModelAnomaly(example.input), { ...example.raw, currentR: String(bound.upper) }, policy, example.input.fields).pattern!.checks.find(c => c.field === 'currentR')!.result, 'inside')
  assert.equal(assessNormalPattern(decideModelAnomaly(example.input), { ...example.raw, currentR: String(bound.upper + .0001) }, policy, example.input.fields).pattern!.checks.find(c => c.field === 'currentR')!.result, 'outside')
  groups++

  process.env.OPENAI_API_KEY = 'test-placeholder'
  globalThis.fetch = async (_url, options) => {
    const body = JSON.parse(String(options?.body))
    assert.ok(body.tools.find((t: { function: { name: string; parameters: { properties: { alertType?: { enum: string[] } } } } }) => t.function.name === 'get_inspection_guide').function.parameters.properties.alertType.enum.includes('normal-pattern-deviation'))
    const count = body.messages.filter((m: { role: string }) => m.role === 'tool').length
    const names = ['get_anomaly_case', 'classify_anomaly', 'get_inspection_guide']
    return Response.json({ choices: [{ message: count < 3 ? { tool_calls: [{ id: `pattern-${count}`, type: 'function', function: { name: names[count], arguments: count === 2 ? '{"alertType":"normal-pattern-deviation"}' : '{}' } }] } : { content: '정상 참조 범위에서 벗어난 값을 기록하고 같은 운전상태에서 다시 확인하세요. 고장 확정은 아닙니다.' } }] })
  }
  const examples = []
  for (const { input, raw } of selected) {
    const observation = await getObservation(input)
    assert.equal(observation.status, 'ok', input.equipmentId)
    assert.ok(!Object.hasOwn(observation.values!, 'is_anomaly'))
    const response = await runAgent({ message: '정상 범위와 비교한 근거와 다음 확인 행동을 알려줘.', anomaly: input })
    assert.equal(response.explanationSource, 'ai')
    assert.equal(response.decision!.status, 'matched')
    assert.equal(response.decision!.demoOnly, false)
    assert.equal(response.decision!.priority, 'medium')
    assert.ok(response.decision!.pattern!.checks.some(c => c.result === 'outside'))
    assert.match(response.reply.detail, /정상 참조/)
    assert.ok(response.initialResponses.length && response.steps.length && response.reportConditions.length)
    assert.doesNotMatch(response.decision!.anomalyTypes.join(' '), /과전류|고장|안전 한계/)
    const expected = evaluateProduction(input, { status: 'ok', message: 'test', values: raw }, configured)
    assert.deepEqual(response.decision!.pattern, expected.pattern)
    examples.push({ equipmentId: input.equipmentId, occurredAt: input.occurredAt, status: response.status, decisionStatus: response.decision!.status, checks: response.decision!.pattern!.checks.filter(c => c.result === 'outside'), toolTrace: response.toolTrace, reply: response.reply.detail })
    console.log(`PASS ${input.equipmentId}: JSON observation -> pattern -> tool loop -> guide`)
  }
  groups++
  delete process.env.OPENAI_API_KEY
  const modelAlerts = JSON.parse(readFileSync('public/anomaly-results.json', 'utf8')) as ModelAnomalyInput[]
  const actual = await runAgent({ message: '현재 모델 알림의 근거를 확인해줘.', anomaly: modelAlerts[0] })
  assert.ok(actual.decision?.pattern)
  assert.deepEqual(actual.decision!.pattern!.unassessedModelFields, modelAlerts[0].fields.filter(field => !actual.decision!.pattern!.checks.some(check => check.field === field)))
  const absent = await runAgent({ message: '미등록 설비', anomaly: { ...example.input, equipmentId: 'unknown' } })
  assert.equal(absent.status, 'insufficient_data')
  assert.equal(absent.decision!.priority, null)
  const noData = await runAgent({ message: '관측 없는 시간', anomaly: { ...example.input, occurredAt: '2030-01-01 00:00:00' } })
  assert.equal(noData.status, 'insufficient_data')
  groups++
  writeFileSync('analysis/normal-pattern/runtime-validation.json', JSON.stringify({ normalRows: cleanRows, normalFlags: cleanFlags, corruptedConfusion: confusion, perEquipmentEndToEnd: examples, actualModelAlert: { input: modelAlerts[0], decision: actual.decision }, missingAndUnknownPassed: true, aiMode: 'mocked-no-external-transmission', groups }, null, 2)+'\n')
} finally {
  globalThis.fetch = saved.fetch
  if (saved.key === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = saved.key
}
console.log(`PASS ${groups} normal-pattern groups; clean flags ${cleanFlags}/${cleanRows}`)
