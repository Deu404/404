import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
import type { ForecastSummaryResult } from './types.ts'

const folder = fileURLToPath(new URL('../../전기요금 및 탄소배출량 예측/', import.meta.url))
function rows(file: string): Record<string, string>[] {
  const lines = readFileSync(resolve(folder, file), 'utf8').replace(/^\uFEFF/, '').trim().split(/\r?\n/)
  const headers = lines.shift()!.split(',')
  return lines.map(line => {
    const columns = line.split(',')
    if (columns.length !== headers.length) throw new Error('예측 CSV 열 형식을 확인하세요.')
    return Object.fromEntries(headers.map((key, i) => [key, columns[i]]))
  })
}
const numeric = (row: Record<string, string>, key: string): number => {
  if (!row[key]?.trim() || !Number.isFinite(Number(row[key]))) throw new Error(`예측 CSV의 ${key} 값을 확인하세요.`)
  return Number(row[key])
}
export function readForecast(): ForecastSummaryResult & { source: string; models: string[]; evaluationSource: string } {
  const predictions = rows('may_hourly_predictions_agg_fixed.csv')
  if (!predictions.length || new Set(predictions.map(r => r.hour)).size !== predictions.length) throw new Error('예측 시각이 비어 있거나 중복되었습니다.')
  predictions.sort((a, b) => a.hour.localeCompare(b.hour))
  const sum = (key: string) => predictions.reduce((n, row) => n + numeric(row, key), 0)
  const peak = predictions.reduce((a, b) => numeric(a, 'hourly_pow') >= numeric(b, 'hourly_pow') ? a : b)
  const formatHour = (value: string) => {
    if (!/^\d{10}$/.test(value)) throw new Error('예측 시각 형식을 확인하세요.')
    return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)} ${value.slice(8)}:00`
  }
  const evaluation = rows('hourly_prediction_vs_actual.csv')
  const byHour = new Map(evaluation.map(r => [r.id_pred, r]))
  if (byHour.size !== evaluation.length || evaluation.length !== predictions.length || predictions.some(r => !byHour.has(r.hour))) throw new Error('예측과 평가 시간 집합이 일치하지 않습니다.')
  const mae = (key: string) => predictions.reduce((n, row) => {
    const actual = byHour.get(row.hour)!
    if (Math.abs(numeric(row, key) - numeric(actual, `${key}_pred`)) > 0.001) throw new Error('예측 파일과 평가 파일의 값이 다릅니다.')
    return n + Math.abs(numeric(row, key) - numeric(actual, `${key}_actual`))
  }, 0) / predictions.length
  return {
    status: 'ok', dataSource: 'forecast_csv', demoOnly: false, missingFields: [], message: '전달된 시간별 예측 CSV를 직접 집계했습니다.',
    source: 'may_hourly_predictions_agg_fixed.csv', evaluationSource: 'hourly_prediction_vs_actual.csv', models: [...new Set(predictions.map(r => r.model))],
    period: `${formatHour(predictions[0].hour)} ~ ${formatHour(predictions.at(-1)!.hour)} (양 끝 포함)`, hoursCount: predictions.length,
    totalPredictedPowerKWh: sum('hourly_pow'), totalEstimatedCostKRW: sum('may_bill'), totalEstimatedCarbonKg: sum('may_carbon'),
    peakHour: { hour: formatHour(peak.hour), powerKWh: numeric(peak, 'hourly_pow'), estimatedCostKRW: numeric(peak, 'may_bill') },
    evaluationMetrics: { hourlyPowMAE: mae('hourly_pow'), billMAE: mae('may_bill'), carbonMAE: mae('may_carbon') },
  }
}
export function readExecutiveReport() {
  const forecast = readForecast()
  return { status: 'partial', dataSource: 'forecast_csv', demoOnly: false,
    message: '전달된 예측 결과를 집계했습니다. 실제 이상 사건 통계와 생산량은 연결되지 않았습니다.',
    reportPeriod: forecast.period, forecastSummary: forecast,
    anomaliesSummary: null, missingFields: ['실제 이상 사건 통계', '생산량·운전 조건'],
    recommendations: ['예측값은 표시된 기간과 모델의 산출물입니다. 실제 사용량과 구분해 예산 검토에 사용하세요.'],
  }
}

export function forecastText(data: ReturnType<typeof readForecast> | ReturnType<typeof readExecutiveReport>): string {
  const forecast = 'forecastSummary' in data ? data.forecastSummary : data
  const n = (value: number, digits = 2) => value.toLocaleString('ko-KR', { maximumFractionDigits: digits })
  return `예측 기간: ${forecast.period} · ${forecast.hoursCount}개 시간 관측\n예상 전기요금 ${n(forecast.totalEstimatedCostKRW, 0)}원 · 탄소배출량 ${n(forecast.totalEstimatedCarbonKg)} kgCO₂\n예상 전력량 ${n(forecast.totalPredictedPowerKWh)} kWh\n\n피크 예상: ${forecast.peakHour.hour} · ${n(forecast.peakHour.powerKWh)} kWh\n시간별 예측 MAE: 전력 ${n(forecast.evaluationMetrics.hourlyPowMAE)} kWh · 요금 ${n(forecast.evaluationMetrics.billMAE)}원 · 탄소 ${n(forecast.evaluationMetrics.carbonMAE)} kgCO₂\n출처: ${forecast.source} · 모델 ${forecast.models.join(', ')}\n${data.missingFields.length ? '확인되지 않은 자료: ' + data.missingFields.join(', ') : '표시된 값은 해당 기간의 예측값입니다.'}`
}
