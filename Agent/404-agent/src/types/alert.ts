import type { EquipmentStatus } from './status'

export type AlertType = 'overcurrent' | 'low-power-factor' | 'power-consumption-increase' | 'phase-current-imbalance'
export type AlertPriority = 'high' | 'medium' | 'low'
export type AlertState = 'open' | 'resolved'
export type AlertAcknowledgement = 'acknowledged' | 'unacknowledged'
export type AlertAcknowledgementState = AlertAcknowledgement

export type AlertRuleResult = {
  matched: boolean
  reason: string
  demoThreshold?: number
  thresholdUnit?: string
  demoOnly: true
}

export type Alert = {
  id: string
  equipmentId: string
  occurredAt: string
  type: AlertType
  sourceType?: string
  severity: EquipmentStatus
  priority: AlertPriority
  // Legacy power-change fields remain optional so missing values are not shown as zero.
  powerChangeKw?: number
  changeRatePercent?: number
  measurement?: number
  reference?: number
  change?: number
  summary: string
  detail: string
  guideKey: string
  state: AlertState
  acknowledgement: AlertAcknowledgement
  ruleResult: AlertRuleResult
  repeatCount?: number
}

export type AlertSummary = {
  label: string
  value?: number
  status: EquipmentStatus
}

export type AnomalyAlert = Alert
