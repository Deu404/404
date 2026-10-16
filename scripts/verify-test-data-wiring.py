import argparse
import json
from datetime import datetime
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from scripts.stream_anomalies import (  # noqa: E402
    AUDIT_FIELDS,
    EQUIPMENT_FILES,
    INVALID_TIME_FIELDS,
    MODEL_RESULT_FIELDS,
    json_file_map,
)


def main():
    parser = argparse.ArgumentParser(description='Verify mixed JSON model-result wiring.')
    parser.add_argument('--json-root', type=Path, required=True)
    parser.add_argument('--results', type=Path, required=True)
    args = parser.parse_args()

    mapped = json_file_map(args.json_root)
    if len(mapped) != len(EQUIPMENT_FILES):
        raise AssertionError(f'expected {len(EQUIPMENT_FILES)} JSON inputs, got {len(mapped)}')
    if any(path.parent != args.json_root for _, path in mapped):
        raise AssertionError('non-root JSON input selected')
    if any(path.name.casefold() == 'events.json' for _, path in mapped):
        raise AssertionError('events.json selected as model input')

    try:
        results = json.loads(args.results.read_text(encoding='utf-8'))
    except (OSError, json.JSONDecodeError) as error:
        raise AssertionError(f'cannot read results: {error}') from error
    if not isinstance(results, list):
        raise AssertionError('results must be a JSON array')

    ids = [item.get('id') for item in results if isinstance(item, dict)]
    if len(ids) != len(results) or len(set(ids)) != len(ids):
        raise AssertionError('results contain missing or duplicate IDs')
    equipment_ids = {equipment_id for equipment_id, _ in mapped}
    for item in results:
        if not isinstance(item, dict):
            raise AssertionError('result is not an object')
        if item.get('equipmentId') not in equipment_ids:
            raise AssertionError('result has an unknown equipmentId')
        if item.get('source') != 'model':
            raise AssertionError('result source is not model')
        if not isinstance(item.get('occurredAt'), str) or not item['occurredAt']:
            raise AssertionError('result has no occurredAt')
        try:
            datetime.strptime(item['occurredAt'], '%Y-%m-%d %H:%M:%S')
        except ValueError as error:
            raise AssertionError(f'invalid occurredAt: {item["occurredAt"]}') from error
        fields = item.get('fields')
        if not isinstance(fields, list) or not fields:
            raise AssertionError('result has no fields')
        if set(item) & AUDIT_FIELDS or set(fields) & AUDIT_FIELDS:
            raise AssertionError('audit field leaked into browser results')
        if set(fields) & INVALID_TIME_FIELDS:
            raise AssertionError('invalid-time notice leaked into browser results')
        if not set(fields) <= MODEL_RESULT_FIELDS:
            raise AssertionError('non-measurement field leaked into browser results')

    print(f'JSON test-data wiring passed: {len(mapped)} inputs, {len(results)} model results')


if __name__ == '__main__':
    main()
