"""Stream source CSV files through the existing online anomaly monitor."""
import argparse
import csv
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
SOURCE_ROOT = ROOT / '장비별 Data'
MODEL_ROOT = ROOT / '이상치 탐지'
DEFAULT_OUTPUT = ROOT / 'public/anomaly-results.json'
DEFAULT_APP_OUTPUT = ROOT / 'src/data/anomaly-results.json'

# Keep this mapping aligned with src/config/equipmentDataMap.ts.
EQUIPMENT_FILES = (
    ('compressor-01', 'equipment_1(PM-3).csv'),
    ('compressor-02', 'equipment_2(L-1전등).csv'),
    ('motor-01', 'equipment_3(분쇄기(2)).csv'),
    ('motor-02', 'equipment_4(분쇄기(1)).csv'),
    ('conveyor-01', 'equipment_5(좌측분전반).csv'),
    ('robot-01', 'equipment_11(우측분전반1).csv'),
    ('robot-02', 'equipment_12(4호기).csv'),
    ('robot-03', 'equipment_13(3호기).csv'),
    ('cooling-01', 'equipment_14(2호기).csv'),
    ('cooling-02', 'equipment_15(예비건조기).csv'),
    ('pump-01', 'equipment_16(호이스트).csv'),
    ('pump-02', 'equipment_17(6호기).csv'),
    ('transformer-01', 'equipment_18(우측분전반2).csv'),
)


def occurred_at(value):
    text = str(value or '')
    if len(text) == 14 and text.isdigit():
        return f'{text[:4]}-{text[4:6]}-{text[6:8]} {text[8:10]}:{text[10:12]}:{text[12:14]}'
    return text


def model_record(row):
    # These CSVs encode timestamp as the local wall-clock value interpreted as
    # Unix milliseconds. The trained feature code expects a UTC Unix value, so
    # convert only that representation while preserving localtime unchanged.
    timestamp = row.get('timestamp')
    if timestamp and str(timestamp).strip().isdigit():
        row = dict(row)
        row['timestamp'] = str(int(timestamp) - 9 * 60 * 60 * 1000)
    return row


def stream_file(monitor, equipment_id, file_path, limit=None):
    count = 0
    with file_path.open('r', encoding='utf-8-sig', newline='') as source:
        for row in csv.DictReader(source):
            if limit is not None and count >= limit:
                break
            count += 1
            source_equipment = row.get('module(equipment)') or equipment_id
            notice = monitor.check(source_equipment, model_record(row))
            if notice:
                yield {
                    'id': f"model-{equipment_id}-{row.get('timestamp') or row.get('localtime') or count}",
                    'equipment': notice['equipment'],
                    'equipmentId': equipment_id,
                    'equipmentName': notice['equipment'],
                    'occurredAt': occurred_at(row.get('localtime') or row.get('timestamp')),
                    'fields': notice['fields'],
                    'source': 'model',
                }
    return count


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument('--app-output', type=Path, default=DEFAULT_APP_OUTPUT)
    parser.add_argument('--limit-rows', type=int, help='Limit rows per equipment for a smoke test')
    parser.add_argument('--equipment', help='Process one equipment ID for a smoke test')
    args = parser.parse_args()

    sys.path.insert(0, str(MODEL_ROOT))
    from scripts.stream_monitor import EquipmentMonitor

    selected = [(equipment_id, file_name) for equipment_id, file_name in EQUIPMENT_FILES
                if args.equipment is None or args.equipment == equipment_id]
    if not selected:
        parser.error(f'Unknown equipment ID: {args.equipment}')

    monitor = EquipmentMonitor(MODEL_ROOT / 'models/random_forest.joblib')
    outputs = (args.output, args.app_output)
    temporary = []
    for output in outputs:
        output.parent.mkdir(parents=True, exist_ok=True)
        temp = output.with_suffix(output.suffix + '.tmp')
        temporary.append(temp)

    result_count = 0
    try:
        streams = [stream_file(monitor, equipment_id, SOURCE_ROOT / file_name, args.limit_rows)
                   for equipment_id, file_name in selected]
        for output in temporary:
            output.write_text('[\n', encoding='utf-8')
        first = True
        for stream in streams:
            for result in stream:
                encoded = json.dumps(result, ensure_ascii=False, indent=2)
                prefix = '' if first else ',\n'
                for output in temporary:
                    with output.open('a', encoding='utf-8') as target:
                        target.write(prefix + encoded)
                first = False
                result_count += 1
            if args.limit_rows is None:
                print('streamed one equipment file', file=sys.stderr, flush=True)
            else:
                print(f'smoke-tested up to {args.limit_rows} rows', file=sys.stderr, flush=True)
        for output in temporary:
            with output.open('a', encoding='utf-8') as target:
                target.write('\n]\n')
        for temp, output in zip(temporary, outputs):
            temp.replace(output)
    finally:
        for temp in temporary:
            if temp.exists():
                temp.unlink()
    print(f'Anomaly results: {result_count}', file=sys.stderr)


if __name__ == '__main__':
    main()
