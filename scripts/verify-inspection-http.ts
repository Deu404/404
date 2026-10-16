import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { createServer } from 'node:net'
import { readFileSync } from 'node:fs'
import { setTimeout as delay } from 'node:timers/promises'

const listener = createServer()
await new Promise<void>(resolve => listener.listen(0, '127.0.0.1', resolve))
const port = (listener.address() as { port: number }).port
await new Promise<void>(resolve => listener.close(() => resolve()))
const child = spawn(process.execPath, ['server/src/server.ts'], { env: { ...process.env, PORT: String(port), OPENAI_API_KEY: 'must-not-be-used-for-inspection' }, stdio: 'ignore' })
const base = `http://127.0.0.1:${port}`
try {
  let ready = false
  for (let i = 0; i < 60; i++) {
    try { ready = (await fetch(`${base}/health`)).ok } catch { /* startup */ }
    if (ready) break
    await delay(50)
  }
  assert.ok(ready)
  const runtime = JSON.parse(readFileSync('analysis/normal-pattern/runtime-validation.json', 'utf8'))
  const sample = runtime.perEquipmentEndToEnd[0]
  const anomaly = { id: 'http-range-test', equipmentId: sample.equipmentId, occurredAt: sample.occurredAt, fields: [sample.checks[0].field] }
  const reply = await fetch(`${base}/api/inspection`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ anomaly, intent: 'forecast', message: 'must not trigger AI' }) })
  assert.equal(reply.status, 200)
  const result = await reply.json()
  assert.equal(result.explanationSource, 'rules')
  assert.equal(result.explanationNotice, undefined)
  assert.equal(result.decision.status, 'matched')
  assert.ok(result.decision.pattern.checks.some((c: { result: string }) => c.result === 'outside'))
  assert.ok(result.toolTrace.every((t: { trigger: string }) => t.trigger === 'server'))
  assert.match(result.reply.detail, /보고 초안/)
  assert.ok(!Object.hasOwn(result.evidence[0].values, 'is_anomaly'))
  const invalid = await fetch(`${base}/api/inspection`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
  assert.equal(invalid.status, 400)
  console.log('PASS inspection HTTP: exact JSON -> configured pattern -> evidence/report, no external AI, invalid request 400')
} finally { child.kill() }
