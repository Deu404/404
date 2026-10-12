// 개발용 정적 목업 데이터입니다. 실제 API·분석 JSON과 연결하지 않습니다.
import type { AlertSummary } from '../types/alert'
import type { Equipment, EquipmentDetail } from '../types/equipment'
import type { DashboardPowerPoint } from '../types/power'
import type { EquipmentStatus } from '../types/status'

export type MockEquipment = Equipment
export type MockHourlyPowerPoint = EquipmentDetail['currentPowerSeries'][number]
export type MockEnergyComparison = EquipmentDetail['energyKwh']
export type MockAnomalyHistoryItem = EquipmentDetail['anomalyHistory'][number]
export type MockEquipmentDetail = EquipmentDetail

export const MOCK_EQUIPMENT: Equipment[] = [
  { id: 'compressor-01', name: '공기압축기 01', zone: 'A 생산동', status: 'normal', powerKw: 182, x: 12, y: 22, message: '정상 운전 중' },
  { id: 'compressor-02', name: '공기압축기 02', zone: 'A 생산동', status: 'warning', powerKw: 224, x: 27, y: 22, message: '평균 대비 전력 사용량 증가' },
  { id: 'motor-01', name: '프레스 모터 01', zone: 'A 생산동', status: 'normal', powerKw: 96, x: 43, y: 22, message: '정상 운전 중' },
  { id: 'motor-02', name: '프레스 모터 02', zone: 'A 생산동', status: 'critical', powerKw: 147, x: 59, y: 22, message: '진동 이상 감지' },
  { id: 'conveyor-01', name: '컨베이어 01', zone: 'A 생산동', status: 'normal', powerKw: 74, x: 78, y: 22, message: '정상 운전 중' },
  { id: 'robot-01', name: '조립 로봇 01', zone: 'B 조립동', status: 'normal', powerKw: 118, x: 14, y: 55, message: '정상 운전 중' },
  { id: 'robot-02', name: '조립 로봇 02', zone: 'B 조립동', status: 'warning', powerKw: 133, x: 31, y: 55, message: '대기 시간이 길어지고 있음' },
  { id: 'robot-03', name: '조립 로봇 03', zone: 'B 조립동', status: 'normal', powerKw: 121, x: 48, y: 55, message: '정상 운전 중' },
  { id: 'cooling-01', name: '냉각 장치 01', zone: 'B 조립동', status: 'normal', powerKw: 204, x: 68, y: 55, message: '정상 운전 중' },
  { id: 'cooling-02', name: '냉각 장치 02', zone: 'B 조립동', status: 'critical', powerKw: 251, x: 84, y: 55, message: '냉각 효율 저하' },
  { id: 'pump-01', name: '순환 펌프 01', zone: '유틸리티동', status: 'normal', powerKw: 88, x: 24, y: 84, message: '정상 운전 중' },
  { id: 'pump-02', name: '순환 펌프 02', zone: '유틸리티동', status: 'warning', powerKw: 104, x: 48, y: 84, message: '점검 예정일 임박' },
  { id: 'transformer-01', name: '수배전반 01', zone: '유틸리티동', status: 'normal', powerKw: 312, x: 75, y: 84, message: '정상 운전 중' },
]

export function resolveMockEquipment(requestedEquipmentId: string | null): Equipment {
  return MOCK_EQUIPMENT.find(({ id }) => id === requestedEquipmentId) ?? MOCK_EQUIPMENT[0]
}

export const MOCK_EQUIPMENT_DETAILS: EquipmentDetail[] = [
  {
    equipmentId: 'compressor-01', powerKw: 182,
    energyKwh: { current: 1_248, lastMonth: 1_192, difference: 56, changeRatePercent: 4.7 },
    currentPowerSeries: [{ time: '00시', powerKw: 154 }, { time: '03시', powerKw: 148 }, { time: '06시', powerKw: 172 }, { time: '09시', powerKw: 188 }, { time: '12시', powerKw: 196 }, { time: '15시', powerKw: 190 }, { time: '18시', powerKw: 182 }, { time: '21시', powerKw: 166 }],
    lastMonthPowerSeries: [{ time: '00시', powerKw: 149 }, { time: '03시', powerKw: 143 }, { time: '06시', powerKw: 166 }, { time: '09시', powerKw: 181 }, { time: '12시', powerKw: 187 }, { time: '15시', powerKw: 184 }, { time: '18시', powerKw: 176 }, { time: '21시', powerKw: 160 }],
    anomalyHistory: [{ detectedAt: '2024-08-19 14:20', severity: 'warning', message: '순간 전력 상승 감지', state: 'resolved' }],
  },
  {
    equipmentId: 'compressor-02', powerKw: 224,
    energyKwh: { current: 1_536, lastMonth: 1_284, difference: 252, changeRatePercent: 19.6 },
    currentPowerSeries: [{ time: '00시', powerKw: 192 }, { time: '03시', powerKw: 188 }, { time: '06시', powerKw: 214 }, { time: '09시', powerKw: 236 }, { time: '12시', powerKw: 248 }, { time: '15시', powerKw: 241 }, { time: '18시', powerKw: 224 }, { time: '21시', powerKw: 208 }],
    lastMonthPowerSeries: [{ time: '00시', powerKw: 178 }, { time: '03시', powerKw: 175 }, { time: '06시', powerKw: 194 }, { time: '09시', powerKw: 208 }, { time: '12시', powerKw: 218 }, { time: '15시', powerKw: 211 }, { time: '18시', powerKw: 198 }, { time: '21시', powerKw: 190 }],
    anomalyHistory: [{ detectedAt: '2024-08-21 11:35', severity: 'warning', message: '지난달 동일 시간대 대비 전력 사용량 증가', state: 'open' }, { detectedAt: '2024-08-14 16:10', severity: 'warning', message: '압축 공기 압력 변동', state: 'resolved' }],
  },
  {
    equipmentId: 'motor-01', powerKw: 96,
    energyKwh: { current: 672, lastMonth: 684, difference: -12, changeRatePercent: -1.8 },
    currentPowerSeries: [{ time: '00시', powerKw: 82 }, { time: '03시', powerKw: 78 }, { time: '06시', powerKw: 88 }, { time: '09시', powerKw: 102 }, { time: '12시', powerKw: 108 }, { time: '15시', powerKw: 104 }, { time: '18시', powerKw: 96 }, { time: '21시', powerKw: 89 }],
    lastMonthPowerSeries: [{ time: '00시', powerKw: 84 }, { time: '03시', powerKw: 80 }, { time: '06시', powerKw: 90 }, { time: '09시', powerKw: 104 }, { time: '12시', powerKw: 110 }, { time: '15시', powerKw: 106 }, { time: '18시', powerKw: 98 }, { time: '21시', powerKw: 91 }],
    anomalyHistory: [],
  },
  {
    equipmentId: 'motor-02', powerKw: 147,
    energyKwh: { current: 1_026, lastMonth: 948, difference: 78, changeRatePercent: 8.2 },
    currentPowerSeries: [{ time: '00시', powerKw: 126 }, { time: '03시', powerKw: 121 }, { time: '06시', powerKw: 138 }, { time: '09시', powerKw: 154 }, { time: '12시', powerKw: 161 }, { time: '15시', powerKw: 158 }, { time: '18시', powerKw: 147 }, { time: '21시', powerKw: 133 }],
    lastMonthPowerSeries: [{ time: '00시', powerKw: 119 }, { time: '03시', powerKw: 115 }, { time: '06시', powerKw: 130 }, { time: '09시', powerKw: 143 }, { time: '12시', powerKw: 149 }, { time: '15시', powerKw: 146 }, { time: '18시', powerKw: 138 }, { time: '21시', powerKw: 126 }],
    anomalyHistory: [{ detectedAt: '2024-08-22 09:05', severity: 'critical', message: '모터 진동 이상 감지', state: 'open' }, { detectedAt: '2024-08-16 13:40', severity: 'warning', message: '베어링 온도 상승', state: 'resolved' }],
  },
  {
    equipmentId: 'conveyor-01', powerKw: 74,
    energyKwh: { current: 518, lastMonth: 532, difference: -14, changeRatePercent: -2.6 },
    currentPowerSeries: [{ time: '00시', powerKw: 62 }, { time: '03시', powerKw: 58 }, { time: '06시', powerKw: 68 }, { time: '09시', powerKw: 76 }, { time: '12시', powerKw: 82 }, { time: '15시', powerKw: 79 }, { time: '18시', powerKw: 74 }, { time: '21시', powerKw: 68 }],
    lastMonthPowerSeries: [{ time: '00시', powerKw: 64 }, { time: '03시', powerKw: 60 }, { time: '06시', powerKw: 70 }, { time: '09시', powerKw: 78 }, { time: '12시', powerKw: 84 }, { time: '15시', powerKw: 81 }, { time: '18시', powerKw: 76 }, { time: '21시', powerKw: 70 }],
    anomalyHistory: [],
  },
  {
    equipmentId: 'robot-01', powerKw: 118,
    energyKwh: { current: 826, lastMonth: 812, difference: 14, changeRatePercent: 1.7 },
    currentPowerSeries: [{ time: '00시', powerKw: 98 }, { time: '03시', powerKw: 94 }, { time: '06시', powerKw: 108 }, { time: '09시', powerKw: 122 }, { time: '12시', powerKw: 128 }, { time: '15시', powerKw: 125 }, { time: '18시', powerKw: 118 }, { time: '21시', powerKw: 106 }],
    lastMonthPowerSeries: [{ time: '00시', powerKw: 96 }, { time: '03시', powerKw: 92 }, { time: '06시', powerKw: 106 }, { time: '09시', powerKw: 119 }, { time: '12시', powerKw: 125 }, { time: '15시', powerKw: 122 }, { time: '18시', powerKw: 116 }, { time: '21시', powerKw: 104 }],
    anomalyHistory: [{ detectedAt: '2024-08-11 10:15', severity: 'warning', message: '작업 사이클 지연 감지', state: 'resolved' }],
  },
  {
    equipmentId: 'robot-02', powerKw: 133,
    energyKwh: { current: 931, lastMonth: 866, difference: 65, changeRatePercent: 7.5 },
    currentPowerSeries: [{ time: '00시', powerKw: 112 }, { time: '03시', powerKw: 106 }, { time: '06시', powerKw: 124 }, { time: '09시', powerKw: 139 }, { time: '12시', powerKw: 146 }, { time: '15시', powerKw: 142 }, { time: '18시', powerKw: 133 }, { time: '21시', powerKw: 120 }],
    lastMonthPowerSeries: [{ time: '00시', powerKw: 105 }, { time: '03시', powerKw: 100 }, { time: '06시', powerKw: 116 }, { time: '09시', powerKw: 128 }, { time: '12시', powerKw: 135 }, { time: '15시', powerKw: 131 }, { time: '18시', powerKw: 124 }, { time: '21시', powerKw: 113 }],
    anomalyHistory: [{ detectedAt: '2024-08-20 15:50', severity: 'warning', message: '대기 시간 증가 감지', state: 'open' }],
  },
  {
    equipmentId: 'robot-03', powerKw: 121,
    energyKwh: { current: 847, lastMonth: 839, difference: 8, changeRatePercent: 1.0 },
    currentPowerSeries: [{ time: '00시', powerKw: 102 }, { time: '03시', powerKw: 98 }, { time: '06시', powerKw: 112 }, { time: '09시', powerKw: 126 }, { time: '12시', powerKw: 132 }, { time: '15시', powerKw: 128 }, { time: '18시', powerKw: 121 }, { time: '21시', powerKw: 110 }],
    lastMonthPowerSeries: [{ time: '00시', powerKw: 101 }, { time: '03시', powerKw: 97 }, { time: '06시', powerKw: 111 }, { time: '09시', powerKw: 124 }, { time: '12시', powerKw: 130 }, { time: '15시', powerKw: 126 }, { time: '18시', powerKw: 119 }, { time: '21시', powerKw: 108 }],
    anomalyHistory: [],
  },
  {
    equipmentId: 'cooling-01', powerKw: 204,
    energyKwh: { current: 1_428, lastMonth: 1_456, difference: -28, changeRatePercent: -1.9 },
    currentPowerSeries: [{ time: '00시', powerKw: 176 }, { time: '03시', powerKw: 170 }, { time: '06시', powerKw: 190 }, { time: '09시', powerKw: 212 }, { time: '12시', powerKw: 224 }, { time: '15시', powerKw: 218 }, { time: '18시', powerKw: 204 }, { time: '21시', powerKw: 188 }],
    lastMonthPowerSeries: [{ time: '00시', powerKw: 180 }, { time: '03시', powerKw: 174 }, { time: '06시', powerKw: 194 }, { time: '09시', powerKw: 216 }, { time: '12시', powerKw: 228 }, { time: '15시', powerKw: 222 }, { time: '18시', powerKw: 208 }, { time: '21시', powerKw: 192 }],
    anomalyHistory: [{ detectedAt: '2024-08-08 08:25', severity: 'warning', message: '냉각수 유량 변동', state: 'resolved' }],
  },
  {
    equipmentId: 'cooling-02', powerKw: 251,
    energyKwh: { current: 1_757, lastMonth: 1_582, difference: 175, changeRatePercent: 11.1 },
    currentPowerSeries: [{ time: '00시', powerKw: 218 }, { time: '03시', powerKw: 212 }, { time: '06시', powerKw: 238 }, { time: '09시', powerKw: 262 }, { time: '12시', powerKw: 274 }, { time: '15시', powerKw: 268 }, { time: '18시', powerKw: 251 }, { time: '21시', powerKw: 230 }],
    lastMonthPowerSeries: [{ time: '00시', powerKw: 198 }, { time: '03시', powerKw: 193 }, { time: '06시', powerKw: 216 }, { time: '09시', powerKw: 235 }, { time: '12시', powerKw: 246 }, { time: '15시', powerKw: 241 }, { time: '18시', powerKw: 226 }, { time: '21시', powerKw: 208 }],
    anomalyHistory: [{ detectedAt: '2024-08-22 07:45', severity: 'critical', message: '냉각 효율 저하 및 소비 전력 급증', state: 'open' }, { detectedAt: '2024-08-15 11:20', severity: 'warning', message: '냉각수 온도 상승', state: 'resolved' }],
  },
  {
    equipmentId: 'pump-01', powerKw: 88,
    energyKwh: { current: 616, lastMonth: 608, difference: 8, changeRatePercent: 1.3 },
    currentPowerSeries: [{ time: '00시', powerKw: 74 }, { time: '03시', powerKw: 70 }, { time: '06시', powerKw: 82 }, { time: '09시', powerKw: 91 }, { time: '12시', powerKw: 96 }, { time: '15시', powerKw: 93 }, { time: '18시', powerKw: 88 }, { time: '21시', powerKw: 80 }],
    lastMonthPowerSeries: [{ time: '00시', powerKw: 73 }, { time: '03시', powerKw: 69 }, { time: '06시', powerKw: 81 }, { time: '09시', powerKw: 90 }, { time: '12시', powerKw: 95 }, { time: '15시', powerKw: 92 }, { time: '18시', powerKw: 87 }, { time: '21시', powerKw: 79 }],
    anomalyHistory: [],
  },
  {
    equipmentId: 'pump-02', powerKw: 104,
    energyKwh: { current: 728, lastMonth: 698, difference: 30, changeRatePercent: 4.3 },
    currentPowerSeries: [{ time: '00시', powerKw: 88 }, { time: '03시', powerKw: 84 }, { time: '06시', powerKw: 96 }, { time: '09시', powerKw: 108 }, { time: '12시', powerKw: 114 }, { time: '15시', powerKw: 110 }, { time: '18시', powerKw: 104 }, { time: '21시', powerKw: 95 }],
    lastMonthPowerSeries: [{ time: '00시', powerKw: 84 }, { time: '03시', powerKw: 81 }, { time: '06시', powerKw: 92 }, { time: '09시', powerKw: 102 }, { time: '12시', powerKw: 108 }, { time: '15시', powerKw: 105 }, { time: '18시', powerKw: 99 }, { time: '21시', powerKw: 91 }],
    anomalyHistory: [{ detectedAt: '2024-08-18 09:30', severity: 'warning', message: '정기 점검 예정일 임박', state: 'open' }],
  },
  {
    equipmentId: 'transformer-01', powerKw: 312,
    energyKwh: { current: 2_184, lastMonth: 2_156, difference: 28, changeRatePercent: 1.3 },
    currentPowerSeries: [{ time: '00시', powerKw: 274 }, { time: '03시', powerKw: 268 }, { time: '06시', powerKw: 294 }, { time: '09시', powerKw: 322 }, { time: '12시', powerKw: 338 }, { time: '15시', powerKw: 331 }, { time: '18시', powerKw: 312 }, { time: '21시', powerKw: 288 }],
    lastMonthPowerSeries: [{ time: '00시', powerKw: 271 }, { time: '03시', powerKw: 265 }, { time: '06시', powerKw: 291 }, { time: '09시', powerKw: 318 }, { time: '12시', powerKw: 334 }, { time: '15시', powerKw: 327 }, { time: '18시', powerKw: 308 }, { time: '21시', powerKw: 285 }],
    anomalyHistory: [{ detectedAt: '2024-08-05 17:10', severity: 'warning', message: '부하율 일시 상승', state: 'resolved' }],
  },
]

export const MOCK_EQUIPMENT_DETAIL_BY_ID: Record<string, EquipmentDetail> = Object.fromEntries(
  MOCK_EQUIPMENT_DETAILS.map((detail) => [detail.equipmentId, detail]),
)

export const MOCK_POWER_SERIES: DashboardPowerPoint[] = [
  { time: '00시', value: 820 }, { time: '03시', value: 760 }, { time: '06시', value: 940 },
  { time: '09시', value: 1280 }, { time: '12시', value: 1420 }, { time: '15시', value: 1360 },
  { time: '18시', value: 1190 }, { time: '21시', value: 980 },
]

export const MOCK_ALERT_SUMMARY: AlertSummary[] = [
  { label: '긴급 이상', value: 2, status: 'critical' },
  { label: '주의 관찰', value: 3, status: 'warning' },
  { label: '오늘 처리됨', value: 6, status: 'normal' },
]

export const MOCK_ATTENTION_EQUIPMENT: Equipment[] = MOCK_EQUIPMENT.filter(({ status }) => status !== 'normal')

export type { EquipmentStatus }
