"""Check interleaved equipment readings; stdout contains anomaly notices only."""
import argparse
from collections import deque
from collections.abc import Mapping
import json
from pathlib import Path
import sys

import joblib
import numpy as np

if __package__:
    from .full_features import FIELDS, SIGNALS, ZERO_WHEN_OFF, features
    from .rf_common import ROOT, read_arrays
else:
    from full_features import FIELDS, SIGNALS, ZERO_WHEN_OFF, features
    from rf_common import ROOT, read_arrays


def suspect_fields(row, feature_names):
    """Explain observed symptoms, without using truth labels or claiming diagnosis."""
    f = dict(zip(feature_names, row))
    found = set()
    for name in SIGNALS:
        if (f['invalid_' + name] or f['range_excess_' + name] > 1e-6
                or f['unchanged_steps_' + name] >= 5):
            found.add(name)
    if f['operation_invalid']:
        found.add('operation')
    if f['operation_off'] and any(f['range_excess_' + n] > 1e-6 for n in ZERO_WHEN_OFF):
        found.add('operation')

    energy_bad = any(f[n] for n in ['energy_invalid', 'energy_negative_value',
                                    'energy_reverse', 'energy_frozen_with_power'])
    if energy_bad:
        found.add('accumActiveEnergy')
    if f['energy_power_abs_residual'] > .001:
        if energy_bad:
            pass
        elif 'activePower' in found:
            pass
        else:
            # The consistency residual alone cannot distinguish a power sensor
            # problem from an energy-counter problem. Report both candidates.
            found.update(['activePower', 'accumActiveEnergy'])
    if f['timestamp_invalid']:
        found.add('timestamp')
    if f['localtime_invalid']:
        found.add('localtime')
    if f['clocks_disagree'] or f['time_step_error'] or f['time_nonincreasing']:
        found.update(['timestamp', 'localtime'])
    if f['equipment_mismatch']:
        found.add('module(equipment)')
    return [name for name in FIELDS if name in found] or ['측정값 조합(항목 특정 불가)']


class EquipmentMonitor:
    """One loaded RF, separate bounded history for each of the 13 equipment IDs.

    check(equipment, record) returns None for normal data, or an equipment/fields
    notice for an anomaly. The equipment argument identifies the trusted source;
    it accepts the complete equipment name or the numeric equipment ID.
    """

    def __init__(self, model_path=ROOT / 'models/random_forest.joblib'):
        self.model = joblib.load(model_path)
        if self.model.get('kind') != 'random_forest_all_fields':
            raise ValueError('The all-field Random Forest model is required')
        # Small online requests run faster on one CPU worker. This changes only
        # the in-memory estimator, never the saved model or its threshold.
        self.model['classifier'].n_jobs = 1
        self.equipment_names = tuple(self.model['normalizers'])
        self.aliases = {name.split('(', 1)[0]: name for name in self.equipment_names}
        self._history = {name: deque(maxlen=121) for name in self.equipment_names}

    def resolve_equipment(self, equipment):
        name = str(equipment)
        if name in self._history:
            return name
        if name in self.aliases:
            return self.aliases[name]
        raise ValueError(f'Unknown source equipment: {equipment}')

    def _prepare_record(self, name, record):
        if not isinstance(record, Mapping):
            raise ValueError('Each reading must be an object containing measurement fields')
        current = {field: record.get(field) for field in FIELDS}
        for field in FIELDS:
            if isinstance(current[field], (Mapping, list, tuple, np.ndarray)):
                current[field] = 'INVALID_VALUE'
        if 'module(equipment)' not in record:
            current['module(equipment)'] = name
        elif not isinstance(record['module(equipment)'], (Mapping, list, tuple, np.ndarray)):
            try:
                current['module(equipment)'] = self.resolve_equipment(record['module(equipment)'])
            except ValueError:
                pass
        return current

    def _predict(self, name, readings):
        raw = {}
        for field in FIELDS:
            values = np.empty(len(readings), dtype=object)
            values[:] = [r[field] for r in readings]
            raw[field] = values
        x, names = features(raw, self.model['normalizers'][name], name)
        if names != self.model['feature_names']:
            raise ValueError('Model feature schema mismatch')
        return x, names

    def check(self, equipment, record):
        name = self.resolve_equipment(equipment)
        current = self._prepare_record(name, record)
        history = self._history[name]
        readings = [*history, current][-121:]
        x, names = self._predict(name, readings)
        score = float(self.model['classifier'].predict_proba(x[-1:])[0, 1])
        history.append(current)
        if score < self.model['threshold']:
            return None
        return {'equipment': name,
                'fields': suspect_fields(x[-1], names)}

    def check_many(self, equipment, records):
        """Check a bounded batch while preserving the one-reading history semantics."""
        name = self.resolve_equipment(equipment)
        current_records = [self._prepare_record(name, record) for record in records]
        if not current_records:
            return []
        history = self._history[name]
        history_length = len(history)
        readings = [*history, *current_records]
        x, names = self._predict(name, readings)
        scores = self.model['classifier'].predict_proba(x[history_length:])[:, 1]
        history.extend(current_records)
        notices = []
        for score, features_row in zip(scores, x[history_length:]):
            if score < self.model['threshold']:
                notices.append(None)
            else:
                notices.append({'equipment': name,
                                'fields': suspect_fields(features_row, names)})
        return notices

    def reset(self, equipment=None):
        """Clear history after intentionally starting a new independent stream."""
        names = [self.resolve_equipment(equipment)] if equipment is not None else self.equipment_names
        for name in names:
            self._history[name].clear()


def handle_message(monitor, message):
    if not isinstance(message, Mapping):
        raise ValueError('Input must be a JSON object')
    if 'data' in message:
        data = message['data']
        if not isinstance(data, Mapping):
            raise ValueError('data must contain a single reading object')
        source = message.get('equipment', data.get('module(equipment)'))
    else:
        data = message
        source = message.get('equipment', message.get('module(equipment)'))
    if source is None:
        raise ValueError('equipment is required to identify the source device')
    return monitor.check(source, data)


def demo_messages(monitor):
    """Interleave 12 real normal readings from each device, with two demo faults."""
    directory = ROOT / 'data/full_coverage_v4/test/clean_reference'
    loaded = []
    for name in monitor.equipment_names:
        device_id = name.split('(', 1)[0].zfill(2)
        matches = list(directory.glob(device_id + '_*.parquet'))
        if len(matches) != 1:
            raise ValueError(f'Demo reference missing for {name}')
        loaded.append((name, read_arrays(matches[0])))
    for row in range(12):
        for name, raw in loaded:
            record = {field: str(raw[field][row]) for field in FIELDS}
            if name == '1(PM-3)' and row == 5:
                record['currentR'] = 50
            if name == '12(4호기)' and row == 7:
                record['voltageST'] = 430
            yield {'equipment': name, 'data': record}


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--model', type=Path, default=ROOT / 'models/random_forest.joblib')
    p.add_argument('--input', type=Path, help='JSON Lines file; default: standard input')
    p.add_argument('--demo', action='store_true', help='Replay 13 devices with two illustrative faults')
    a = p.parse_args()
    if a.demo and a.input:
        p.error('--demo and --input cannot be used together')
    monitor = EquipmentMonitor(a.model)
    if a.demo:
        for message in demo_messages(monitor):
            notice = handle_message(monitor, message)
            if notice:
                print(json.dumps(notice, ensure_ascii=False), flush=True)
        return
    stream = a.input.open(encoding='utf-8') if a.input else sys.stdin
    try:
        for line_number, line in enumerate(stream, 1):
            if not line.strip():
                continue
            try:
                notice = handle_message(monitor, json.loads(line))
            except (ValueError, TypeError) as error:
                print(f'Input line {line_number}: {error}', file=sys.stderr, flush=True)
                continue
            if notice:
                print(json.dumps(notice, ensure_ascii=False), flush=True)
    finally:
        if a.input:
            stream.close()


if __name__ == '__main__':
    main()
