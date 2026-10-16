import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { summarizeEquipment } from '../src/services/equipmentOverview.ts'
import type { AnomalyDetection } from '../src/types/anomaly.ts'

const equipment = [{ id: 'a', name: '설비 A' }, { id: 'b', name: '설비 B' }, { id: 'c', name: '설비 C' }]
const alert = (id: string, equipmentId: string, occurredAt: string, fields: string[]): AnomalyDetection => ({ id, equipmentId, occurredAt, fields, equipment: equipmentId, equipmentName: equipmentId, source: 'model' })
const alerts = [alert('new', 'a', '2025-06-18 02:00:00', ['currentR', 'currentR']), alert('old', 'a', '2025-06-15 01:00:00', ['voltageS']), alert('b', 'b', '2025-06-16 01:00:00', ['activePower']), alert('unknown', 'unknown', '2025-06-19 01:00:00', [])]
const all = summarizeEquipment(equipment, alerts)
assert.equal(all.length, 3)
assert.equal(all[0].latest?.id, 'new', 'Latest alert must not depend on input ordering')
assert.equal(all.find(x => x.id === 'a')?.count, 2, 'Count observations, not suspect fields')
assert.equal(all.find(x => x.id === 'c')?.count, 0, 'Retain equipment with no matching alerts')
assert.equal(all.reduce((n, x) => n + x.count, 0), 3, 'Do not attach unknown equipment to a known machine')
assert.equal(summarizeEquipment(equipment, alerts.filter(a => a.occurredAt.startsWith('2025-06-16'))).find(x => x.id === 'a')?.latest, undefined, 'No stale latest alert outside the date range')
assert.equal(summarizeEquipment(equipment, []).filter(x => x.latest).length, 0)
const saved = JSON.parse(readFileSync('public/anomaly-results.json', 'utf8')) as AnomalyDetection[]
const ids = [...new Set(saved.map(x => x.equipmentId))].map(id => ({ id, name: id }))
const actual = summarizeEquipment(ids, saved)
assert.equal(actual.reduce((n, x) => n + x.count, 0), saved.length)
assert.equal(actual.length, 13)
for (const item of actual) assert.ok(saved.filter(a => a.equipmentId === item.id).every(a => a.occurredAt <= item.latest!.occurredAt))
console.log(`PASS equipment overview: empty/filtered/unsorted/unknown inputs and all ${saved.length} saved alerts across 13 equipment IDs`)
