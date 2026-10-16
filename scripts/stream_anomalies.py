"""Stream source CSV files through the existing online anomaly monitor."""
import argparse
import csv
import json
from collections.abc import Mapping
from datetime import datetime, timedelta, timezone
from pathlib import Path
import re
import sys
import time

ROOT = Path(__file__).resolve().parents[1]
SOURCE_ROOT = ROOT / '장비별 Data'
MODEL_ROOT = ROOT / '이상치 탐지'
DEFAULT_OUTPUT = ROOT / 'public/anomaly-results.json'
DEFAULT_APP_OUTPUT = ROOT / 'src/data/anomaly-results.json'

# Keep this mapping aligned with src/config/equipmentDataMap.ts.
EQUIPMENT_FILES = (
    ('compressor-01', 'equipment_1(PM-3).csv', '01_PM-3.parquet', 'PM-3'),
    ('compressor-02', 'equipment_2(L-1전등).csv', '02_L-1전등.parquet', 'L-1 전등'),
    ('motor-01', 'equipment_3(분쇄기(2)).csv', '03_분쇄기(2).parquet', '분쇄기(2)'),
    ('motor-02', 'equipment_4(분쇄기(1)).csv', '04_분쇄기(1).parquet', '분쇄기(1)'),
    ('conveyor-01', 'equipment_5(좌측분전반).csv', '05_좌측분전반.parquet', '좌측분전반'),
    ('robot-01', 'equipment_11(우측분전반1).csv', '11_우측분전반1.parquet', '우측분전반1'),
    ('robot-02', 'equipment_12(4호기).csv', '12_4호기.parquet', '4호기'),
    ('robot-03', 'equipment_13(3호기).csv', '13_3호기.parquet', '3호기'),
    ('cooling-01', 'equipment_14(2호기).csv', '14_2호기.parquet', '2호기'),
    ('cooling-02', 'equipment_15(예비건조기).csv', '15_예비건조기.parquet', '예비건조기'),
    ('pump-01', 'equipment_16(호이스트).csv', '16_호이스트.parquet', '호이스트'),
    ('pump-02', 'equipment_17(6호기).csv', '17_6호기.parquet', '6호기'),
    ('transformer-01', 'equipment_18(우측분전반2).csv', '18_우측분전반2.parquet', '우측분전반2'),
)
EQUIPMENT_NAMES = {equipment_id: display_name for equipment_id, _, _, display_name in EQUIPMENT_FILES}
MODEL_EQUIPMENT_NAMES = {
    equipment_id: csv_name.removeprefix('equipment_').removesuffix('.csv')
    for equipment_id, csv_name, _, _ in EQUIPMENT_FILES
}
AUDIT_FIELDS = frozenset({'module(equipment)', 'is_anomaly', 'anomaly_type', 'fault_fields', 'event_id', 'reference_localtime'})
INVALID_TIME_FIELDS = frozenset({'timestamp', 'localtime'})
MODEL_RESULT_FIELDS = frozenset({
    'voltageR', 'voltageS', 'voltageT', 'voltageRS', 'voltageST', 'voltageTR',
    'currentR', 'currentS', 'currentT', 'activePower',
    'powerFactorR', 'powerFactorS', 'powerFactorT', 'reactivePowerLagging',
    'accumActiveEnergy', 'operation',
})


def normalize_value(value):
    """Normalize numeric strings while leaving malformed values available to the model."""
    if not isinstance(value, str):
        return value
    text = value.strip()
    if re.fullmatch(r'[+-]?\d+\.0+', text):
        return int(text.split('.', 1)[0])
    return text


def model_record(row):
    # Pass measurement and clock inputs only; source metadata is supplied by the trusted equipment argument.
    from scripts.full_features import FIELDS

    record = {field: normalize_value(row.get(field)) for field in FIELDS if field not in AUDIT_FIELDS}
    # Match full_features.epochs for valid localtime while preserving the raw localtime field.
    timestamp = localtime_timestamp(record.get('localtime'))
    if timestamp is not None:
        record['timestamp'] = timestamp
    return record


def occurred_at(value):
    value = normalize_value(value)
    text = str(value or '')
    if len(text) == 14 and text.isdigit():
        try:
            datetime.strptime(text, '%Y%m%d%H%M%S')
        except ValueError:
            return ''
        return f'{text[:4]}-{text[4:6]}-{text[6:8]} {text[8:10]}:{text[10:12]}:{text[12:14]}'
    if re.fullmatch(r'\d{13}', text):
        try:
            local = datetime.fromtimestamp(int(text) / 1000, timezone.utc).astimezone(
                timezone(timedelta(hours=9)))
        except (OverflowError, OSError, ValueError):
            return ''
        return local.strftime('%Y-%m-%d %H:%M:%S')
    try:
        parsed = datetime.fromisoformat(text.replace('Z', '+00:00'))
    except ValueError:
        return ''
    return parsed.strftime('%Y-%m-%d %H:%M:%S')


def json_file_map(json_root):
    """Map the 13 expected parquet stems to root-level JSON files only."""
    if not json_root.is_dir():
        raise ValueError(f'JSON root does not exist or is not a directory: {json_root}')
    expected = {parquet_name.removesuffix('.parquet').casefold(): equipment_id
                for equipment_id, _, parquet_name, _ in EQUIPMENT_FILES}
    candidates = {}
    for path in json_root.iterdir():
        if not path.is_file() or path.suffix.lower() != '.json' or path.stem.casefold() == 'events':
            continue
        key = path.stem.casefold()
        if key in candidates:
            raise ValueError(f'Duplicate JSON input stem: {path.stem}')
        candidates[key] = path
    missing = sorted(set(expected) - set(candidates))
    if missing:
        raise ValueError(f'Missing JSON inputs: {", ".join(missing)}')
    unexpected = sorted(set(candidates) - set(expected))
    if unexpected:
        raise ValueError(f'Unexpected root JSON inputs: {", ".join(unexpected)}')
    return [(equipment_id, candidates[parquet_name.removesuffix('.parquet').casefold()])
            for equipment_id, _, parquet_name, _ in EQUIPMENT_FILES]


def localtime_timestamp(localtime):
    """Return localtime converted with the model feature code, in milliseconds."""
    from scripts.full_features import epochs, numeric

    epoch = epochs(numeric([localtime]))[0]
    return int(epoch * 1000) if epoch == epoch else None


def anomaly_result(equipment_id, notice, row, count, seen_ids=None):
    if not notice:
        return None
    fields = [field for field in notice.get('fields', []) if field in MODEL_RESULT_FIELDS]
    # A result without a measured/detected field cannot satisfy the browser contract.
    if not fields:
        return None
    occurred = occurred_at(row.get('localtime')) or occurred_at(row.get('timestamp'))
    if not occurred:
        return None
    seen_ids = seen_ids if seen_ids is not None else set()
    identity = normalize_value(row.get('timestamp')) or normalize_value(row.get('localtime')) or count
    base_id = f'model-{equipment_id}-{identity}'
    result_id = base_id
    if result_id in seen_ids:
        result_id = f'{base_id}-{count}'
        suffix = 2
        while result_id in seen_ids:
            result_id = f'{base_id}-{count}-{suffix}'
            suffix += 1
    seen_ids.add(result_id)
    return {
        'id': result_id,
        'equipment': notice['equipment'],
        'equipmentId': equipment_id,
        'equipmentName': EQUIPMENT_NAMES[equipment_id],
        'occurredAt': occurred,
        'fields': fields,
        'source': 'model',
    }


def stream_file(monitor, equipment_id, file_path, limit=None, stats=None, seen_ids=None):
    count = 0
    seen_ids = seen_ids if seen_ids is not None else set()
    with file_path.open('r', encoding='utf-8-sig', newline='') as source:
        for row in csv.DictReader(source):
            if limit is not None and count >= limit:
                break
            count += 1
            source_equipment = row.get('module(equipment)') or equipment_id
            notice = monitor.check(source_equipment, model_record(row))
            result = anomaly_result(equipment_id, notice, row, count, seen_ids)
            if result:
                yield result
    if stats is not None:
        stats['processed'] = count
    return count


def stream_json(monitor, equipment_id, file_path, limit=None, stats=None, seen_ids=None):
    count = 0
    malformed = 0
    seen_ids = seen_ids if seen_ids is not None else set()
    try:
        with file_path.open('r', encoding='utf-8') as source:
            rows = json.load(source)
    except (OSError, json.JSONDecodeError) as error:
        raise ValueError(f'Unable to read JSON input {file_path}: {error}') from error
    if not isinstance(rows, list):
        raise ValueError(f'JSON input must contain an array: {file_path}')
    batch = []

    def flush_batch():
        if not batch:
            return []
        records = [record for _, record in batch]
        check_many = getattr(monitor, 'check_many', None)
        notices = check_many(MODEL_EQUIPMENT_NAMES[equipment_id], records) if check_many else [
            monitor.check(MODEL_EQUIPMENT_NAMES[equipment_id], record) for record in records]
        return [(row_count, record, notice)
                for (row_count, record), notice in zip(batch, notices)]

    for raw_row in rows:
        if limit is not None and count >= limit:
            break
        count += 1
        if not isinstance(raw_row, Mapping):
            malformed += 1
            continue
        batch.append((count, model_record(raw_row)))
        if len(batch) >= 4096:
            for row_count, row, notice in flush_batch():
                result = anomaly_result(equipment_id, notice, row, row_count, seen_ids)
                if result:
                    yield result
            batch.clear()
    for row_count, row, notice in flush_batch():
        result = anomaly_result(equipment_id, notice, row, row_count, seen_ids)
        if result:
            yield result
    if stats is not None:
        stats['processed'] = count
        stats['malformed'] = malformed
    return count


def stream_parquet(monitor, equipment_id, file_path, limit=None, stats=None, seen_ids=None):
    import pyarrow.parquet as pq

    from scripts.full_features import FIELDS

    seen_ids = seen_ids if seen_ids is not None else set()
    parquet = pq.ParquetFile(file_path)
    if any(field not in parquet.schema_arrow.names for field in FIELDS):
        raise ValueError('Parquet model schema mismatch')
    count = 0
    for batch in parquet.iter_batches(batch_size=4096, columns=FIELDS):
        rows = batch.to_pylist()
        if limit is not None:
            rows = rows[:max(0, limit - count)]
        for row in rows:
            count += 1
            source_equipment = row.get('module(equipment)') or equipment_id
            notice = monitor.check(source_equipment, model_record(row))
            result = anomaly_result(equipment_id, notice, row, count, seen_ids)
            if result:
                yield result
        if limit is not None and count >= limit:
            break
    if stats is not None:
        stats['processed'] = count
    return count


def parquet_first_row(file_path):
    import pyarrow.parquet as pq

    from scripts.full_features import epochs, numeric

    batch = next(pq.ParquetFile(file_path).iter_batches(
        batch_size=1, columns=['timestamp', 'localtime']))
    timestamp = int(batch.column('timestamp')[0].as_py())
    localtime = int(batch.column('localtime')[0].as_py())
    local_epoch = int(epochs(numeric([localtime]))[0]) * 1000
    return timestamp, localtime_timestamp(localtime), localtime, local_epoch


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path)
    parser.add_argument('--app-output', type=Path)
    parser.add_argument('--parquet', type=Path, help='Process a Parquet file as a bounded smoke test')
    parser.add_argument('--limit-rows', type=int, help='Limit rows per equipment for a smoke test')
    parser.add_argument('--equipment', help='Process one equipment ID for a smoke test')
    parser.add_argument('--json-root', type=Path, help='Process the 13 root-level mixed JSON files')
    args = parser.parse_args()

    if args.json_root and args.parquet:
        parser.error('--json-root and --parquet cannot be used together')

    sys.path.insert(0, str(MODEL_ROOT))
    from scripts.stream_monitor import EquipmentMonitor

    if args.parquet:
        equipment_id = args.equipment or 'compressor-01'
        if equipment_id not in EQUIPMENT_NAMES:
            parser.error(f'Unknown equipment ID: {equipment_id}')
        limit = args.limit_rows if args.limit_rows is not None else 10000
        if limit <= 0:
            parser.error('--limit-rows must be positive')
        started = time.perf_counter()
        timestamp, corrected_timestamp, localtime, local_epoch = parquet_first_row(args.parquet)
        monitor = EquipmentMonitor(MODEL_ROOT / 'models/random_forest.joblib')
        stats = {'processed': 0}
        default_output = 'pm3-parquet-smoke.json' if equipment_id == 'compressor-01' else f'{equipment_id}-parquet-smoke.json'
        output = args.output or (ROOT / 'processed-equipment' / default_output)
        temp = output.with_suffix(output.suffix + '.tmp')
        anomaly_count = 0
        try:
            output.parent.mkdir(parents=True, exist_ok=True)
            temp.write_text('[\n', encoding='utf-8')
            first = True
            with temp.open('a', encoding='utf-8') as target:
                for result in stream_parquet(monitor, equipment_id, args.parquet, limit, stats):
                    prefix = '' if first else ',\n'
                    target.write(prefix + json.dumps(result, ensure_ascii=False, indent=2))
                    first = False
                    anomaly_count += 1
                target.write('\n]\n')
            temp.replace(output)
        finally:
            if temp.exists():
                temp.unlink()
        elapsed = time.perf_counter() - started
        processed = stats['processed']
        print(f'Parquet first timestamp: {timestamp}', file=sys.stderr)
        print(f'Parquet corrected timestamp: {corrected_timestamp}', file=sys.stderr)
        print(f'Parquet localtime: {localtime}', file=sys.stderr)
        print(f'Parquet localtime epoch: {local_epoch}', file=sys.stderr)
        print(f'Parquet rows: {processed}', file=sys.stderr)
        print(f'Parquet elapsed seconds: {elapsed:.3f}', file=sys.stderr)
        ratio = anomaly_count / processed if processed else 0
        print(f'Anomaly results: {anomaly_count} ({ratio:.6%})', file=sys.stderr)
        return

    if args.json_root:
        if args.limit_rows is not None and args.limit_rows <= 0:
            parser.error('--limit-rows must be positive')
        selected = json_file_map(args.json_root)
        selected = [(equipment_id, path) for equipment_id, path in selected
                    if args.equipment is None or args.equipment == equipment_id]
        if args.equipment is not None and not selected:
            parser.error(f'Unknown equipment ID: {args.equipment}')
        outputs = [args.output or DEFAULT_OUTPUT]
        if args.app_output:
            outputs.append(args.app_output)
        monitor = EquipmentMonitor(MODEL_ROOT / 'models/random_forest.joblib')
        seen_ids = set()
        streams = [stream_json(monitor, equipment_id, path, args.limit_rows, seen_ids=seen_ids)
                   for equipment_id, path in selected]
    else:
        selected = [(equipment_id, file_name) for equipment_id, file_name, _, _ in EQUIPMENT_FILES
                    if args.equipment is None or args.equipment == equipment_id]
        if not selected:
            parser.error(f'Unknown equipment ID: {args.equipment}')
        monitor = EquipmentMonitor(MODEL_ROOT / 'models/random_forest.joblib')
        outputs = [args.output or DEFAULT_OUTPUT, args.app_output or DEFAULT_APP_OUTPUT]
        seen_ids = set()
        streams = [stream_file(monitor, equipment_id, SOURCE_ROOT / file_name, args.limit_rows,
                                seen_ids=seen_ids)
                   for equipment_id, file_name in selected]

    temporary = []
    for output in outputs:
        output.parent.mkdir(parents=True, exist_ok=True)
        temp = output.with_suffix(output.suffix + '.tmp')
        temporary.append(temp)

    result_count = 0
    try:
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
