export type ForecastPoint = {
  id: string
  hour: string
  hourlyPowKwh: number
  billWon: number
  carbonKg: number
  aggregatePowerKwh: number
  model?: string
}

type ForecastMaeMetric = {
  mae: number
  unit: string
  sampleCount: number
}

export type ForecastMae = {
  power?: ForecastMaeMetric
  bill?: ForecastMaeMetric
  carbon?: ForecastMaeMetric
  totalValidSampleCount: number
}
