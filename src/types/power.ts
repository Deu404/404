export type HourlyPowerPoint = {
  time: string
  powerKw?: number
}

export type DashboardPowerPoint = {
  time: string
  value?: number
}

export type PowerMeasurement = {
  measuredAt?: string
  activePowerKw?: number
  currentA?: number
  powerFactor?: number
  voltageV?: number
}
