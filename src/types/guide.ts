import type { AlertType } from './alert'

export type InspectionGuideStep = {
  id: string
  label: string
}

export type InspectionGuide = {
  guideKey: string
  alertType: AlertType
  // Display label retained for the existing guide selector contract.
  type: string
  title: string
  symptomSummary: string
  triggerReason: string
  operatorChecks: string[]
  reportConditions: string[]
  initialResponse: string
  steps: InspectionGuideStep[]
  relatedEquipmentIds: string[]
}
