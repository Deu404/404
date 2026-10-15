// 데모 이상 사례 저장소 (기획서 수정본 및 공식 설비 매핑 반영).
// 기획서 2D 배치도(3호기, 6호기, 4호기, PM-3)와 Random Forest AI 이상 감지 결과를 정식 연계한다.
import type { DemoCase } from '../types.ts'

export const DEMO_CASES: DemoCase[] = [
  // 1) 기획서 시나리오 1: 3호기 비정상 과전류 감지 상황
  {
    caseId: 'demo-overcurrent-001',
    caseVersion: 'case-v2',
    equipmentId: 'robot-03',
    equipmentName: '3호기',
    location: { x: 34, y: 77, zone: '하단 생산라인 중앙' },
    measuredAt: '2024-08-22T07:45:00+09:00',
    measurements: {
      currentR: 128, currentS: 90, currentT: 92,
      powerFactorR: 0.93, powerFactorS: 0.94, powerFactorT: 0.92,
      activePower: 210,
    },
    comparison: { referencePower: 194, referenceAt: '2024-08-15T07:45:00+09:00', referenceBasis: '동일 요일·시간대 과거 전력 비교값' },
    detectorResult: {
      modelDetected: true,
      modelName: 'Random Forest AI 이상 탐지기',
      suspectedFields: ['currentR', 'activePower'],
      occurredAt: '2024-08-22 07:45:00',
    },
    note: '기획서 시나리오 1: 3호기 단일 과전류(R상 128 A > 100 A) 및 머신러닝 모델 동시 감지 상황.',
  },

  // 2) 기획서 시나리오 2: 6호기 전력 소비 급증 및 역률 저하 상황
  {
    caseId: 'demo-lowpf-004',
    caseVersion: 'case-v2',
    equipmentId: 'pump-02',
    equipmentName: '6호기',
    location: { x: 60, y: 77, zone: '하단 펌프 및 건조 라인' },
    measuredAt: '2024-08-21T11:35:00+09:00',
    measurements: {
      currentR: 85, currentS: 84, currentT: 82,
      powerFactorR: 0.78, powerFactorS: 0.8, powerFactorT: 0.79,
      activePower: 224,
    },
    comparison: { referencePower: 187, referenceAt: '2024-08-14T11:35:00+09:00', referenceBasis: '동일 요일·시간대 과거 전력 비교값' },
    detectorResult: {
      modelDetected: true,
      modelName: 'Random Forest AI 이상 탐지기',
      suspectedFields: ['activePower', 'powerFactorR'],
      occurredAt: '2024-08-21 11:35:00',
    },
    note: '기획서 시나리오 2: 6호기 지속적인 전력 소비 증가(19.6% 증가) 및 역률 저하(0.78 < 0.85).',
  },

  // 3) 복합 이상: 4호기 과전류 + 상간 전류 불균형
  {
    caseId: 'demo-multi-002',
    caseVersion: 'case-v2',
    equipmentId: 'robot-02',
    equipmentName: '4호기',
    location: { x: 21, y: 77, zone: '하단 로봇 4호기 라인' },
    measuredAt: '2024-08-20T15:50:00+09:00',
    measurements: {
      currentR: 150, currentS: 95, currentT: 88,
      powerFactorR: 0.9, powerFactorS: 0.91, powerFactorT: 0.9,
      activePower: 240,
    },
    comparison: { referencePower: 225, referenceAt: '2024-08-13T15:50:00+09:00', referenceBasis: '동일 요일·시간대 과거 전력 비교값' },
    detectorResult: {
      modelDetected: true,
      modelName: 'Random Forest AI 이상 탐지기',
      suspectedFields: ['voltageST', 'currentR'],
      occurredAt: '2024-08-20 15:50:00',
    },
    note: '복합 이상 시나리오: 4호기 과전류(150 A)와 상간 불균형 동시 발생.',
  },

  // 4) 실제 anomaly-results.json 연동: PM-3 컴프레서 이상
  {
    caseId: 'demo-pm3-005',
    caseVersion: 'case-v2',
    equipmentId: 'compressor-01',
    equipmentName: 'PM-3',
    location: { x: 25, y: 18, zone: '상단 좌측 컴프레서실' },
    measuredAt: '2024-12-01T00:00:05+09:00',
    measurements: {
      currentR: 98, currentS: 96, currentT: 97,
      powerFactorR: 0.91, powerFactorS: 0.92, powerFactorT: 0.91,
      activePower: 310,
    },
    comparison: { referencePower: 250, referenceAt: '2024-11-24T00:00:05+09:00', referenceBasis: '과거 기준 전력' },
    detectorResult: {
      modelDetected: true,
      modelName: 'Random Forest AI 이상 탐지기 (anomaly-results.json)',
      suspectedFields: ['activePower', 'accumActiveEnergy', 'timestamp', 'localtime'],
      occurredAt: '2024-12-01 00:00:05',
    },
    note: '실제 ML 탐지 모델 산출물(anomaly-results.json)과 직접 연동된 PM-3 이상 케이스.',
  },

  // 5) 측정 누락 테스트 케이스: T상 전류 및 역률 결측
  {
    caseId: 'demo-missing-003',
    caseVersion: 'case-v2',
    equipmentId: 'motor-02',
    equipmentName: '분쇄기(1)',
    location: { x: 67, y: 15, zone: '상단 분쇄기 1라인' },
    measuredAt: '2024-08-22T08:20:00+09:00',
    measurements: {
      currentR: 70, currentS: 72, currentT: null,
      powerFactorR: null, powerFactorS: null, powerFactorT: null,
      activePower: 95,
    },
    comparison: null,
    detectorResult: null,
    note: '결측 안전 분기 테스트용: T상 전류·역률·비교값 결측으로 판정 보류 처리.',
  },
]

export function findDemoCase(caseId: string): DemoCase | undefined {
  return DEMO_CASES.find((c) => c.caseId === caseId)
}
