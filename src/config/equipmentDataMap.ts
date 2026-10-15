/** Maps the stable application equipment IDs to the source CSV files. */
export const EQUIPMENT_DATA_MAP = {
  'compressor-01': 'equipment_1(PM-3).csv',
  'compressor-02': 'equipment_2(L-1전등).csv',
  'motor-01': 'equipment_3(분쇄기(2)).csv',
  'motor-02': 'equipment_4(분쇄기(1)).csv',
  'conveyor-01': 'equipment_5(좌측분전반).csv',
  'robot-01': 'equipment_11(우측분전반1).csv',
  'robot-02': 'equipment_12(4호기).csv',
  'robot-03': 'equipment_13(3호기).csv',
  'cooling-01': 'equipment_14(2호기).csv',
  'cooling-02': 'equipment_15(예비건조기).csv',
  'pump-01': 'equipment_16(호이스트).csv',
  'pump-02': 'equipment_17(6호기).csv',
  'transformer-01': 'equipment_18(우측분전반2).csv',
} as const

export type EquipmentDataId = keyof typeof EQUIPMENT_DATA_MAP

/** The canonical equipment order and display names used by the factory layout. */
export const EQUIPMENT_LAYOUT = [
  { id: 'conveyor-01', fileName: 'equipment_5(좌측분전반).csv', name: '좌측분전반', x: 12, y: 18 },
  { id: 'compressor-01', fileName: 'equipment_1(PM-3).csv', name: 'PM-3', x: 25, y: 18 },
  { id: 'compressor-02', fileName: 'equipment_2(L-1전등).csv', name: 'L-1 전등', x: 40, y: 13 },
  { id: 'motor-01', fileName: 'equipment_3(분쇄기(2)).csv', name: '분쇄기(2)', x: 54, y: 15 },
  { id: 'motor-02', fileName: 'equipment_4(분쇄기(1)).csv', name: '분쇄기(1)', x: 67, y: 15 },
  { id: 'robot-01', fileName: 'equipment_11(우측분전반1).csv', name: '우측분전반1', x: 79, y: 18 },
  { id: 'transformer-01', fileName: 'equipment_18(우측분전반2).csv', name: '우측분전반2', x: 89, y: 18 },
  { id: 'pump-01', fileName: 'equipment_16(호이스트).csv', name: '호이스트', x: 50, y: 40 },
  { id: 'robot-02', fileName: 'equipment_12(4호기).csv', name: '4호기', x: 21, y: 77 },
  { id: 'robot-03', fileName: 'equipment_13(3호기).csv', name: '3호기', x: 34, y: 77 },
  { id: 'cooling-01', fileName: 'equipment_14(2호기).csv', name: '2호기', x: 47, y: 77 },
  { id: 'pump-02', fileName: 'equipment_17(6호기).csv', name: '6호기', x: 60, y: 77 },
  { id: 'cooling-02', fileName: 'equipment_15(예비건조기).csv', name: '예비건조기', x: 74, y: 77 },
] as const
