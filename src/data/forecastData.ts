import csv from '../../전기요금 및 탄소배출량 예측/may_hourly_predictions_agg_fixed.csv?raw'
import actualsVsPredictedCsv from '../../전기요금 및 탄소배출량 예측/hourly_prediction_vs_actual.csv?raw'

const headers = ['id', 'hour', 'hourly_pow', 'may_bill', 'may_carbon', 'agg_pow', 'model'] as const

type CsvForecastRow = Record<(typeof headers)[number], unknown>

function parseCsvLine(line: string): string[] {
  const values: string[] = []
  let value = ''
  let quoted = false

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index]
    if (character === '"') {
      if (quoted && line[index + 1] === '"') {
        value += '"'
        index += 1
      } else {
        quoted = !quoted
      }
    } else if (character === ',' && !quoted) {
      values.push(value)
      value = ''
    } else {
      value += character
    }
  }
  values.push(value)
  return values
}

function parseNumber(value: string): number {
  const parsed = Number(value.trim())
  return Number.isFinite(parsed) ? parsed : Number.NaN
}

export function parseForecastCsv(source: string): CsvForecastRow[] {
  const lines = source.split(/\r?\n/).filter((line) => line.trim())
  if (lines.length < 2 || parseCsvLine(lines[0]).join(',') !== headers.join(',')) return []

  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line)
    return {
      id: values[0]?.trim() ?? '',
      hour: values[1]?.trim() ?? '',
      hourly_pow: parseNumber(values[2] ?? ''),
      may_bill: parseNumber(values[3] ?? ''),
      may_carbon: parseNumber(values[4] ?? ''),
      agg_pow: parseNumber(values[5] ?? ''),
      model: values[6]?.trim() ?? '',
    }
  })
}

export const rawForecastData: readonly CsvForecastRow[] = parseForecastCsv(csv)

const actualsVsPredictedHeaders = ['time', 'id_pred', 'hourly_pow_pred', 'hourly_pow_actual', 'hourly_pow_abs_error', 'may_bill_pred', 'may_bill_actual', 'may_bill_abs_error', 'may_carbon_pred', 'may_carbon_actual', 'may_carbon_abs_error', 'agg_pow_pred'] as const

type CsvActualsVsPredictedRow = Record<(typeof actualsVsPredictedHeaders)[number], unknown>

function parseActualsVsPredictedCsv(source: string): CsvActualsVsPredictedRow[] {
  const lines = source.split(/\r?\n/).filter((line) => line.trim())
  if (lines.length < 2 || parseCsvLine(lines[0]).join(',') !== actualsVsPredictedHeaders.join(',')) return []

  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line)
    return {
      time: values[0]?.trim() ?? '',
      id_pred: values[1]?.trim() ?? '',
      hourly_pow_pred: parseNumber(values[2] ?? ''),
      hourly_pow_actual: parseNumber(values[3] ?? ''),
      hourly_pow_abs_error: parseNumber(values[4] ?? ''),
      may_bill_pred: parseNumber(values[5] ?? ''),
      may_bill_actual: parseNumber(values[6] ?? ''),
      may_bill_abs_error: parseNumber(values[7] ?? ''),
      may_carbon_pred: parseNumber(values[8] ?? ''),
      may_carbon_actual: parseNumber(values[9] ?? ''),
      may_carbon_abs_error: parseNumber(values[10] ?? ''),
      agg_pow_pred: parseNumber(values[11] ?? ''),
    }
  })
}

export const rawForecastActualsData: readonly CsvActualsVsPredictedRow[] = parseActualsVsPredictedCsv(actualsVsPredictedCsv)
