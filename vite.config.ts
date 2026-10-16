import { createReadStream, existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { createInterface } from 'node:readline'
import { resolve } from 'node:path'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { EQUIPMENT_DATA_MAP, EQUIPMENT_TEST_DATA_MAP, type EquipmentDataId } from './src/config/equipmentDataMap'

const POWER_SAMPLE_LIMIT = 96
const equipmentJsonByCsv = Object.entries(EQUIPMENT_DATA_MAP).reduce<Record<string, string>>((result, [equipmentId, fileName]) => {
  result[fileName] = EQUIPMENT_TEST_DATA_MAP[equipmentId as EquipmentDataId]
  return result
}, {})

type PowerSample = { time: string; powerKw: number; energyKwh?: number }
type DataRow = Record<string, unknown>

function isRecord(value: unknown): value is DataRow {
  return typeof value === 'object' && value !== null
}

function asFiniteNumber(value: unknown): number | undefined {
  const number = typeof value === 'number' ? value : typeof value === 'string' ? Number(value.trim()) : Number.NaN
  return Number.isFinite(number) ? number : undefined
}

function normalizeTime(value: unknown): string {
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

function rowToPowerSample(row: DataRow): PowerSample | undefined {
  const localtime = normalizeTime(row.localtime)
  const time = localtime || normalizeTime(row.timestamp)
  const powerWatts = asFiniteNumber(row.activePower)
  if (!time || powerWatts === undefined) return undefined
  const energyWattHours = asFiniteNumber(row.accumActiveEnergy)
  return {
    time,
    powerKw: powerWatts / 1000,
    ...(energyWattHours === undefined ? {} : { energyKwh: energyWattHours / 1000 }),
  }
}

function limitPowerSamples(samples: PowerSample[]): PowerSample[] {
  if (samples.length <= POWER_SAMPLE_LIMIT) return samples
  return Array.from({ length: POWER_SAMPLE_LIMIT }, (_, index) => {
    const sourceIndex = Math.round(index * (samples.length - 1) / (POWER_SAMPLE_LIMIT - 1))
    return samples[sourceIndex]
  })
}

async function readJsonSamples(jsonPath: string): Promise<PowerSample[]> {
  const parsed: unknown = JSON.parse(await readFile(jsonPath, 'utf8'))
  if (!Array.isArray(parsed)) throw new Error('test_data JSON must contain an array')
  const samples: PowerSample[] = []
  for (const value of parsed) {
    if (!isRecord(value)) continue
    const sample = rowToPowerSample(value)
    if (sample?.energyKwh !== undefined) samples.push(sample)
  }
  return limitPowerSamples(samples)
}

async function readCsvSamples(csvPath: string): Promise<PowerSample[]> {
  const input = createReadStream(csvPath, { encoding: 'utf8' })
  const lines = createInterface({ input, crlfDelay: Infinity })
  input.on('error', (error) => lines.emit('error', error))
  const iterator = lines[Symbol.asyncIterator]()
  const headerLine = await iterator.next()
  const headers = headerLine.done ? [] : headerLine.value.split(',')
  const powerIndex = headers.indexOf('activePower')
  const energyIndex = headers.findIndex((header: string) => header.startsWith('accumActiveEnergy'))
  const timeIndex = headers.indexOf('localtime')
  const samples: PowerSample[] = []

  for (let row = 0; row < POWER_SAMPLE_LIMIT; row += 1) {
    const line = await iterator.next()
    if (line.done) break
    const columns = line.value.split(',')
    const sample = rowToPowerSample({
      localtime: columns[timeIndex],
      activePower: columns[powerIndex],
      accumActiveEnergy: columns[energyIndex],
    })
    if (sample) samples.push(sample)
  }
  lines.close()
  input.destroy()
  return samples
}

const equipmentDataPlugin = (): Plugin => ({
  name: 'equipment-csv-data-boundary',
  configureServer(server) {
    server.middlewares.use('/api/equipment-data', async (request, response, next) => {
      const encodedName = (request as unknown as { url?: string }).url?.replace(/^\//, '')
      const fileName = encodedName ? decodeURIComponent(encodedName) : ''
      if (!Object.values(EQUIPMENT_DATA_MAP).includes(fileName as typeof EQUIPMENT_DATA_MAP[keyof typeof EQUIPMENT_DATA_MAP])) {
        next()
        return
      }

      try {
        const testDataRoot = resolve(process.env.TEST_DATA_DIR ?? resolve(process.cwd(), 'test_data'))
        const jsonName = equipmentJsonByCsv[fileName]
        const jsonPath = jsonName ? resolve(testDataRoot, jsonName) : ''
        const localPath = resolve(process.cwd(), '장비별 Data', fileName)
        const csvPath = process.env.EQUIPMENT_DATA_DIR ? resolve(process.env.EQUIPMENT_DATA_DIR, fileName) : existsSync(localPath) ? localPath : resolve(process.cwd(), '..', '장비별 Data', fileName)
        const samples = jsonPath && existsSync(jsonPath)
          ? await readJsonSamples(jsonPath)
          : existsSync(csvPath)
            ? await readCsvSamples(csvPath)
            : []
        if (!samples.length) {
          response.statusCode = 404
          response.setHeader('Content-Type', 'application/json; charset=utf-8')
          response.end(JSON.stringify({ samples: [] }))
          return
        }
        response.setHeader('Content-Type', 'application/json; charset=utf-8')
        response.end(JSON.stringify({ samples }))
      } catch {
        response.statusCode = 404
        response.setHeader('Content-Type', 'application/json; charset=utf-8')
        response.end(JSON.stringify({ samples: [] }))
      }
    })
  },
})

export default defineConfig({
  plugins: [react(), equipmentDataPlugin()],
  server: {
    proxy: {
      '/api/agent': 'http://127.0.0.1:8787',
      '/api/inspection': 'http://127.0.0.1:8787',
    },
  },
})
