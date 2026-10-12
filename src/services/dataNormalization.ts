import type { AlertAcknowledgement, AlertPriority, AlertState, AlertType } from '../types/alert'
import type { EquipmentStatus } from '../types/status'

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback
}

export function asFiniteNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

export function asOptionalFiniteNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

export function asEquipmentStatus(value: unknown, fallback: EquipmentStatus = 'normal'): EquipmentStatus {
  return value === 'normal' || value === 'warning' || value === 'critical' ? value : fallback
}

export function asAlertType(value: unknown, fallback: AlertType = 'power-consumption-increase'): AlertType {
  return value === 'overcurrent' || value === 'low-power-factor' || value === 'power-consumption-increase' || value === 'phase-current-imbalance'
    ? value
    : fallback
}

export function asAlertPriority(value: unknown, fallback: AlertPriority = 'low'): AlertPriority {
  return value === 'high' || value === 'medium' || value === 'low' ? value : fallback
}

export function asAlertState(value: unknown, fallback: AlertState = 'resolved'): AlertState {
  return value === 'open' || value === 'resolved' ? value : fallback
}

export function asAlertAcknowledgement(value: unknown, fallback: AlertAcknowledgement = 'unacknowledged'): AlertAcknowledgement {
  return value === 'acknowledged' || value === 'unacknowledged' ? value : fallback
}
