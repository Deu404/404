import json
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MODEL_ROOT = ROOT / '이상치 탐지'
if str(MODEL_ROOT) not in sys.path:
    sys.path.insert(0, str(MODEL_ROOT))

from scripts.stream_anomalies import (  # noqa: E402
    AUDIT_FIELDS,
    anomaly_result,
    EQUIPMENT_FILES,
    MODEL_RESULT_FIELDS,
    MODEL_EQUIPMENT_NAMES,
    json_file_map,
    model_record,
    stream_json,
)


class RecordingMonitor:
    def __init__(self, fields=None):
        self.fields = fields or ['voltageR']
        self.records = []
        self.sources = []

    def check(self, source, record):
        self.sources.append(source)
        self.records.append(record)
        return {'equipment': source, 'fields': self.fields}


class StreamAnomaliesTests(unittest.TestCase):
    def test_json_mapping_uses_all_root_stems_and_ignores_events_and_nested_files(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            for _, _, parquet_name, _ in EQUIPMENT_FILES:
                (root / parquet_name.replace('.parquet', '.json')).write_text('[]', encoding='utf-8')
            (root / 'events.json').write_text('{}', encoding='utf-8')
            nested = root / 'clean_reference'
            nested.mkdir()
            (nested / '01_PM-3.json').write_text('[]', encoding='utf-8')

            mapped = json_file_map(root)

            self.assertEqual([item[0] for item in mapped], [item[0] for item in EQUIPMENT_FILES])
            self.assertTrue(all(path.parent == root for _, path in mapped))

    def test_json_mapping_reports_missing_inputs(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            for _, _, parquet_name, _ in EQUIPMENT_FILES[1:]:
                (root / parquet_name.replace('.parquet', '.json')).write_text('[]', encoding='utf-8')

            with self.assertRaisesRegex(ValueError, 'Missing JSON inputs'):
                json_file_map(root)

    def test_model_boundary_normalizes_and_excludes_audit_fields(self):
        row = {
            'module(equipment)': '1(PM-3)',
            'timestamp': '1749913200000.0',
            'localtime': '20250615000000.0',
            'operation': '1.0',
            'voltageR': '210.363',
            'voltageS': '210.427',
            'voltageT': '211.27',
            'voltageRS': '369.386',
            'voltageST': '375.156',
            'voltageTR': '380.26',
            'currentR': '23.672',
            'currentS': '26.511',
            'currentT': '12.678',
            'activePower': '3079.268',
            'powerFactorR': '98.395',
            'powerFactorS': '93.919',
            'powerFactorT': '85.931',
            'reactivePowerLagging': '850.225',
            'accumActiveEnergy': '2099500.942',
            'is_anomaly': 1,
            'anomaly_type': 'truth-only',
            'fault_fields': 'voltageR',
            'event_id': 3,
            'reference_localtime': '20250615000000',
        }

        record = model_record(row)

        self.assertEqual(set(record) & AUDIT_FIELDS, set())
        self.assertEqual(record['localtime'], 20250615000000)
        self.assertEqual(record['operation'], 1)
        self.assertEqual(set(record) - AUDIT_FIELDS, set(record))
        self.assertEqual(len(record), 18)
        self.assertNotIn('module(equipment)', record)
        self.assertIsInstance(record['timestamp'], int)

    def test_result_boundary_filters_metadata_and_unknown_fields(self):
        row = {'localtime': '20250615000000.0'}
        result = anomaly_result(
            'compressor-01',
            {'equipment': '1(PM-3)', 'fields': ['voltageR', 'module(equipment)', 'timestamp', 'unknown']},
            row,
            1,
        )

        self.assertIsNotNone(result)
        self.assertEqual(result['fields'], ['voltageR'])
        self.assertIsNone(anomaly_result(
            'compressor-01',
            {'equipment': '1(PM-3)', 'fields': ['module(equipment)', 'timestamp']},
            row,
            2,
        ))

        row = {
            'module(equipment)': '1(PM-3)',
            'timestamp': '1749913200000.0',
            'localtime': '20250615000000.0',
            'voltageR': 'bad-measurement',
        }
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / '01_PM-3.json'
            path.write_text(json.dumps([None, row, {**row, 'localtime': 'not-a-time'}]), encoding='utf-8')
            monitor = RecordingMonitor()
            stats = {}

            results = list(stream_json(monitor, 'compressor-01', path, stats=stats))

        self.assertEqual(stats, {'processed': 3, 'malformed': 1})
        self.assertEqual(len(monitor.records), 2)
        self.assertEqual(monitor.sources, [MODEL_EQUIPMENT_NAMES['compressor-01']] * 2)
        self.assertEqual(len(results), 2)
        self.assertEqual(len({result['id'] for result in results}), 2)
        self.assertTrue(all(result['occurredAt'] == '2025-06-15 00:00:00' for result in results))
        self.assertTrue(all(result['source'] == 'model' for result in results))
        self.assertTrue(all(set(result['fields']) <= MODEL_RESULT_FIELDS for result in results))

    def test_invalid_time_notice_is_not_emitted(self):
        row = {'module(equipment)': '1(PM-3)', 'localtime': '20250615000000.0'}
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / '01_PM-3.json'
            path.write_text(json.dumps([row]), encoding='utf-8')
            results = list(stream_json(RecordingMonitor(['localtime']), 'compressor-01', path))
        self.assertEqual(results, [])

    def test_limited_real_model_smoke(self):
        try:
            from scripts.stream_monitor import EquipmentMonitor
        except ImportError as error:
            self.skipTest(f'model dependencies unavailable: {error}')
        monitor = EquipmentMonitor(MODEL_ROOT / 'models/random_forest.joblib')
        stats = {}
        path = ROOT / 'test_data' / '01_PM-3.json'
        results = list(stream_json(monitor, 'compressor-01', path, limit=2, stats=stats))
        self.assertEqual(stats['processed'], 2)
        self.assertTrue(all(result['equipmentId'] == 'compressor-01' for result in results))


if __name__ == '__main__':
    unittest.main()
