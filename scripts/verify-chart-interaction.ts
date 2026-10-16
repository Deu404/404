import assert from 'node:assert/strict'
import { formatForecastHour, nearestChartIndex } from '../src/utils/chartInteraction.ts'

assert.equal(nearestChartIndex(70, 70, 666, 505), 0)
assert.equal(nearestChartIndex(736, 70, 666, 505), 504)
assert.equal(nearestChartIndex(403, 70, 666, 505), 252)
assert.equal(nearestChartIndex(-100, 70, 666, 505), 0)
assert.equal(nearestChartIndex(1000, 70, 666, 505), 504)
assert.equal(nearestChartIndex(500, 70, 666, 1), 0)
assert.equal(nearestChartIndex(100, 70, 666, 0), undefined)
assert.equal(nearestChartIndex(Number.NaN, 70, 666, 505), undefined)
assert.equal(nearestChartIndex(100, 70, 0, 505), undefined)
assert.equal(formatForecastHour('2025051000'), '2025.05.10 00:00')
assert.equal(formatForecastHour('2025053100'), '2025.05.31 00:00')
console.log('PASS chart interaction: first/middle/last points, clamping, one/zero rows, invalid geometry, date-hour labels')
