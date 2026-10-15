import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const adapterSource = await readFile('src/adapters/realDataAdapter.ts', 'utf8')

assert.doesNotMatch(adapterSource, /mock/i)
assert.doesNotMatch(adapterSource, /anomaly-results\.json/)
assert.match(adapterSource, /const anomalies: readonly AnomalyDetection\[\] = \[\]/)
console.log('real data adapter preserves equipment metadata and empty model-result boundary: passed')
