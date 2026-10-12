// Compatibility boundary for the pre-service UI and verification scripts.
// New consumers should read through src/services instead of importing fixtures.
import { MOCK_GUIDES } from '../mocks/mockGuides'

export { DEFAULT_GUIDE_KEY, MOCK_GUIDES } from '../mocks/mockGuides'
export type { MockInspectionGuide } from '../mocks/mockGuides'
export type { InspectionGuide } from '../types/guide'

export function findGuide(guideKey: string | null): import('../mocks/mockGuides').MockInspectionGuide {
  return MOCK_GUIDES.find(({ guideKey: key }) => key === guideKey) ?? MOCK_GUIDES.find(({ guideKey: key }) => key === 'power-consumption-increase') ?? MOCK_GUIDES[0]
}
