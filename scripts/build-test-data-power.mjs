import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const POWER_SAMPLE_LIMIT = 96
const dataRoot = resolve(process.env.TEST_DATA_DIR || 'test_data')
const outputRoot = resolve('public/equipment-data')
const equipmentFiles = [
  ['compressor-01', '01_PM-3.json'],
  ['compressor-02', '02_L-1전등.json'],
  ['motor-01', '03_분쇄기(2).json'],
  ['motor-02', '04_분쇄기(1).json'],
  ['conveyor-01', '05_좌측분전반.json'],
  ['robot-01', '11_우측분전반1.json'],
  ['robot-02', '12_4호기.json'],
  ['robot-03', '13_3호기.json'],
  ['cooling-01', '14_2호기.json'],
  ['cooling-02', '15_예비건조기.json'],
  ['pump-01', '16_호이스트.json'],
  ['pump-02', '17_6호기.json'],
  ['transformer-01', '18_우측분전반2.json'],
]

function isRecord(value) {
  return typeof value === 'object' && value !== null
}

function asFiniteNumber(value) {
  const number = typeof value === 'number' ? value : typeof value === 'string' ? Number(value.trim()) : Number.NaN
  return Number.isFinite(number) ? number : undefined
}

function normalizeTime(value) {
  const text = typeof value === 'string' || typeof value === 'number' ? String(value).trim() : ''
  const compact = /^\d+\.0+$/.test(text) ? text.replace(/\.0+$/, '') : text
  if (/^\d{14}$/.test(compact)) {
    const year = Number(compact.slice(0, 4))
    const month = Number(compact.slice(4, 6))
    const day = Number(compact.slice(6, 8))
    const hour = Number(compact.slice(8, 10))
    const minute = Number(compact.slice(10, 12))
    const second = Number(compact.slice(12, 14))
    const date = new Date(Date.UTC(year, month - 1, day, hour, minute, second))
    if (date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day && date.getUTCHours() === hour && date.getUTCMinutes() === minute && date.getUTCSeconds() === second) {
      return `${compact.slice(0, 4)}-${compact.slice(4, 6)}-${compact.slice(6, 8)} ${compact.slice(8, 10)}:${compact.slice(10, 12)}`
    }
  }
  const epoch = /^\d{13}$/.test(compact) ? Number(compact) : Number.NaN
  if (Number.isFinite(epoch)) return new Date(epoch).toISOString().slice(0, 16).replace('T', ' ')
  if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}/.test(compact)) return compact.replace('T', ' ').slice(0, 16)
  return ''
}

function rowToPowerSample(row) {
  const time = normalizeTime(row.localtime) || normalizeTime(row.timestamp)
  const powerWatts = asFiniteNumber(row.activePower)
  if (!time || powerWatts === undefined) return undefined
  const energyWattHours = asFiniteNumber(row.accumActiveEnergy)
  return {
    time,
    powerKw: powerWatts / 1000,
    ...(energyWattHours === undefined ? {} : { energyKwh: energyWattHours / 1000 }),
  }
}

function limitSamples(samples) {
  if (samples.length <= POWER_SAMPLE_LIMIT) return samples
  return Array.from({ length: POWER_SAMPLE_LIMIT }, (_, index) => {
    const sourceIndex = Math.round(index * (samples.length - 1) / (POWER_SAMPLE_LIMIT - 1))
    return samples[sourceIndex]
  })
}

await mkdir(outputRoot, { recursive: true })
for (const [equipmentId, sourceName] of equipmentFiles) {
  const source = JSON.parse(await readFile(resolve(dataRoot, sourceName), 'utf8'))
  if (!Array.isArray(source)) throw new Error(`${sourceName} must contain an array`)
  const samples = limitSamples(source.flatMap((value) => {
    if (!isRecord(value)) return []
    const sample = rowToPowerSample(value)
    return sample?.energyKwh === undefined ? [] : [sample]
  }))
  if (!samples.length) throw new Error(`${sourceName} has no valid power samples`)
  await writeFile(resolve(outputRoot, `${equipmentId}.json`), `${JSON.stringify({ samples })}\n`, 'utf8')
  console.log(`${equipmentId}: ${samples.length} samples`)
}
console.log(`Generated ${equipmentFiles.length} files in ${outputRoot}`)
