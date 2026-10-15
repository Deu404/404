import { dataProvider } from '../adapters/dataProvider'
import { EQUIPMENT_LAYOUT } from '../config/equipmentDataMap'
import type { Equipment } from '../types/equipment'
import { asEquipmentStatus, asFiniteNumber, asOptionalFiniteNumber, asString, isRecord } from './dataNormalization'

export function normalizeEquipmentList(input: unknown): Equipment[] {
  if (!Array.isArray(input)) return []

  return input.flatMap((value) => {
    if (!isRecord(value)) return []
    const id = asString(value.id).trim()
    if (!id) return []
    return [{
      id,
      name: asString(value.name, id),
      zone: asString(value.zone),
      status: asEquipmentStatus(value.status),
      ...(asOptionalFiniteNumber(value.powerKw) === undefined ? {} : { powerKw: asOptionalFiniteNumber(value.powerKw) }),
      x: asFiniteNumber(value.x),
      y: asFiniteNumber(value.y),
      message: asString(value.message),
    }]
  })
}

function equipmentList(): Equipment[] {
  const sourceById = new Map(normalizeEquipmentList(dataProvider.equipment).map((item) => [item.id, item]))
  return EQUIPMENT_LAYOUT.map((layoutItem) => {
    const source = sourceById.get(layoutItem.id)
    return {
      id: layoutItem.id,
      name: layoutItem.name,
      zone: source?.zone ?? '',
      status: source?.status ?? 'normal',
      ...(source?.powerKw === undefined ? {} : { powerKw: source.powerKw }),
      x: layoutItem.x,
      y: layoutItem.y,
      message: source?.message ?? '상태 확인 필요',
    }
  })
}

export function listEquipment(): Equipment[] {
  return equipmentList()
}

export function getEquipmentById(equipmentId: string | null | undefined): Equipment | undefined {
  if (!equipmentId) return undefined
  return equipmentList().find(({ id }) => id === equipmentId)
}

export function getDefaultEquipment(): Equipment | undefined {
  return equipmentList()[0]
}

export function resolveEquipment(equipmentId: string | null | undefined): Equipment | undefined {
  return getEquipmentById(equipmentId) ?? getDefaultEquipment()
}

// Compatibility name for the existing equipment-detail verification boundary.
export const resolveMockEquipment = resolveEquipment
