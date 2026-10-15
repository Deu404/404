import { dataProvider } from '../adapters/dataProvider'
import { asAlertType, asString, isRecord } from './dataNormalization'
import type { AlertType } from '../types/alert'
import type { InspectionGuide, InspectionGuideStep } from '../types/guide'

function normalizeStringList(input: unknown): string[] {
  return Array.isArray(input)
    ? input.filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    : []
}

function normalizeGuideSteps(input: unknown): InspectionGuideStep[] {
  if (!Array.isArray(input)) return []

  return input.flatMap((value) => {
    if (!isRecord(value)) return []
    const id = asString(value.id).trim()
    if (!id) return []
    return [{ id, label: asString(value.label) }]
  })
}

export function normalizeGuides(input: unknown): InspectionGuide[] {
  if (!Array.isArray(input)) return []

  return input.flatMap((value) => {
    if (!isRecord(value)) return []
    const guideKey = asString(value.guideKey).trim()
    if (!guideKey) return []
    const alertType = asAlertType(value.alertType ?? value.type)
    return [{
      guideKey,
      alertType,
      type: asString(value.type, alertType),
      title: asString(value.title),
      symptomSummary: asString(value.symptomSummary),
      triggerReason: asString(value.triggerReason),
      operatorChecks: normalizeStringList(value.operatorChecks),
      reportConditions: normalizeStringList(value.reportConditions),
      initialResponse: asString(value.initialResponse),
      steps: normalizeGuideSteps(value.steps),
      relatedEquipmentIds: normalizeStringList(value.relatedEquipmentIds),
    }]
  })
}

export function listGuides(): InspectionGuide[] {
  return normalizeGuides(dataProvider.guides)
}

export function listConnectedGuides(): InspectionGuide[] {
  return []
}

export function getGuideByKey(guideKey: string | null | undefined): InspectionGuide | undefined {
  if (!guideKey) return undefined
  return listGuides().find(({ guideKey: key }) => key === guideKey)
}

export function getGuidesByAlertType(alertType: AlertType | null | undefined): InspectionGuide[] {
  if (!alertType) return []
  return listGuides().filter(({ alertType: type }) => type === alertType)
}

export function resolveConnectedGuide(guideKey: string | null | undefined): InspectionGuide | undefined {
  if (!guideKey) return undefined
  return listConnectedGuides().find(({ guideKey: key }) => key === guideKey)
}
export function getDefaultGuide(): InspectionGuide | undefined {
  return getGuideByKey(dataProvider.defaultGuideKey) ?? listGuides()[0]
}

export function resolveGuide(guideKey: string | null | undefined): InspectionGuide | undefined {
  return getGuideByKey(guideKey) ?? getDefaultGuide()
}

// Compatibility name for the existing guide-selection boundary.
export const findGuide = resolveGuide
