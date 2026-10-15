import type { AnomalyDetection } from '../types/anomaly'

/** Adapter fixture copied from stream_monitor.py's JSONL output. */
export const MODEL_ANOMALY_OUTPUT: readonly { equipment: string; fields: readonly string[] }[] = [
  { equipment: '1(PM-3)', fields: ['currentR'] },
  { equipment: '12(4호기)', fields: ['voltageST'] },
]

export const MODEL_ANOMALIES: readonly AnomalyDetection[] = [
  { id: 'model-1-pm-3-currentR', equipment: '1(PM-3)', equipmentId: 'compressor-01', equipmentName: '공기압축기 01', occurredAt: '2024-12-01 00:25:00', fields: ['currentR'], source: 'model' },
  { id: 'model-12-4-current-voltageST', equipment: '12(4호기)', equipmentId: 'robot-02', equipmentName: '조립 로봇 02', occurredAt: '2024-12-01 00:35:00', fields: ['voltageST'], source: 'model' },
]
