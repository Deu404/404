import { createReadStream } from 'node:fs'
import { createInterface } from 'node:readline'
import { resolve } from 'node:path'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { EQUIPMENT_DATA_MAP } from './src/config/equipmentDataMap'

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
        const input = createReadStream(resolve(process.cwd(), '장비별 Data', fileName), { encoding: 'utf8' })
        const lines = createInterface({ input, crlfDelay: Infinity })
        const iterator = lines[Symbol.asyncIterator]()
        const headerLine = await iterator.next()
        const headers = headerLine.done ? [] : headerLine.value.split(',')
        const powerIndex = headers.indexOf('activePower')
        const energyIndex = headers.findIndex((header: string) => header.startsWith('accumActiveEnergy'))
        const timeIndex = headers.indexOf('localtime')
        const samples = []

        for (let row = 0; row < 96; row += 1) {
          const line = await iterator.next()
          if (line.done) break
          const columns = line.value.split(',')
          const time = columns[timeIndex]
          const powerWatts = Number(columns[powerIndex])
          const energyWattHours = Number(columns[energyIndex])
          if (!time || !Number.isFinite(powerWatts)) continue
          samples.push({ time: `${time.slice(0, 8)} ${time.slice(8, 10)}:${time.slice(10, 12)}`, powerKw: powerWatts / 1000, ...(Number.isFinite(energyWattHours) ? { energyKwh: energyWattHours / 1000 } : {}) })
        }
        lines.close()
        input.destroy()
        response.setHeader('Content-Type', 'application/json; charset=utf-8')
        response.end(JSON.stringify({ samples }))
      } catch {
        response.statusCode = 404
        response.end(JSON.stringify({ samples: [] }))
      }
    })
  },
})

export default defineConfig({
  plugins: [react(), equipmentDataPlugin()],
})
