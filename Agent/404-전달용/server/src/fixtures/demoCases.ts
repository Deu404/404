// 데모(가상) 이상 사례 저장소.
// 원본 CSV와 분리된 소규모 합성 데이터다. dataSource는 모두 synthetic, demoOnly: true로 취급한다.
// 실제 설비 측정값이나 안전 기준이 아니다. 단위: 전류 A, 역률 0~1, 유효전력 kW.
import type { DemoCase } from '../types.ts'

export const DEMO_CASES: DemoCase[] = [
  // 1) 단일 이상: 과전류. R상이 데모 기준(100 A) 초과. 비교 전력 있음.
  {
    caseId: 'demo-overcurrent-001',
    caseVersion: 'case-v1',
    equipmentId: 'demo-motor-02',
    equipmentName: '데모 2호 모터',
    measuredAt: '2024-08-22T07:45:00+09:00',
    measurements: {
      currentR: 128, currentS: 90, currentT: 92,
      powerFactorR: 0.93, powerFactorS: 0.94, powerFactorT: 0.92,
      activePower: 210,
    },
    comparison: { referencePower: 194, referenceAt: '2024-08-15T07:45:00+09:00', referenceBasis: '동일 요일·시간대 데모 비교값' },
    note: '단일 과전류 시나리오. 전류 불균형은 임계 이하, 역률 정상.',
  },

  // 2) 복합 이상: 과전류 + 상간 전류 불균형 동시. 역률은 정상.
  {
    caseId: 'demo-multi-002',
    caseVersion: 'case-v1',
    equipmentId: 'demo-transformer-01',
    equipmentName: '데모 1호 변압기',
    measuredAt: '2024-08-20T15:50:00+09:00',
    measurements: {
      currentR: 150, currentS: 95, currentT: 88,
      powerFactorR: 0.9, powerFactorS: 0.91, powerFactorT: 0.9,
      activePower: 240,
    },
    comparison: { referencePower: 225, referenceAt: '2024-08-13T15:50:00+09:00', referenceBasis: '동일 요일·시간대 데모 비교값' },
    note: '복합 이상 시나리오. 과전류(R상 150 A>100 A) + 불균형(상 편차 큼).',
  },

  // 3) 측정 누락: 역률 전부 null, T상 전류 null. 일부 유형은 판정 보류.
  {
    caseId: 'demo-missing-003',
    caseVersion: 'case-v1',
    equipmentId: 'demo-pump-02',
    equipmentName: '데모 2호 펌프',
    measuredAt: '2024-08-22T08:20:00+09:00',
    measurements: {
      currentR: 70, currentS: 72, currentT: null,
      powerFactorR: null, powerFactorS: null, powerFactorT: null,
      activePower: 95,
    },
    comparison: null, // 비교값 없음 → 전력 소비 증가 판정 보류
    note: '측정 누락 시나리오. 역률·T상 전류·비교값 없음.',
  },

  // 4) 역률 저하 단일: 역률이 데모 기준(0.85) 미만. 과전류/불균형은 임계 이하.
  //    (가이드 없음 분기 테스트는 아래 note 참고: 이 유형들엔 가이드가 모두 있으므로
  //     가이드 없음은 존재하지 않는 alertType을 조회해 재현한다.)
  {
    caseId: 'demo-lowpf-004',
    caseVersion: 'case-v1',
    equipmentId: 'demo-compressor-02',
    equipmentName: '데모 2호 컴프레서',
    measuredAt: '2024-08-21T11:35:00+09:00',
    measurements: {
      currentR: 60, currentS: 61, currentT: 59,
      powerFactorR: 0.78, powerFactorS: 0.8, powerFactorT: 0.79,
      activePower: 130,
    },
    comparison: { referencePower: 125, referenceAt: '2024-08-14T11:35:00+09:00', referenceBasis: '동일 요일·시간대 데모 비교값' },
    note: '역률 저하 단일 시나리오. 전력 소비 증가율 4%로 임계(10%) 이하.',
  },
]

export function findDemoCase(caseId: string): DemoCase | undefined {
  return DEMO_CASES.find((c) => c.caseId === caseId)
}
