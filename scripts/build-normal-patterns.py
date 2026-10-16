"""Fit per-equipment reference ranges without using the held-out normal/error rows.

Input is explicitly synthetic clean_reference data; this is not a safety-limit model.
Run from any directory: python scripts/build-normal-patterns.py
"""
import hashlib
import json
import os
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
source_override = os.environ.get('TEST_DATA_DIR')
if not source_override and (ROOT / '.env.local').exists():
    for line in (ROOT / '.env.local').read_text(encoding='utf-8').splitlines():
        if line.startswith('TEST_DATA_DIR='):
            source_override = line.split('=', 1)[1].strip().strip('\"').strip("'")
SOURCE = Path(source_override) if source_override else (ROOT / 'test_data' if (ROOT / 'test_data').exists() else ROOT.parent / 'test_data')
OUTPUT = ROOT / 'analysis' / 'normal-pattern'
TARGET_FPR = 0.005
FIELDS = ['voltageR', 'voltageS', 'voltageT', 'voltageRS', 'voltageST', 'voltageTR',
          'currentR', 'currentS', 'currentT', 'activePower', 'powerFactorR',
          'powerFactorS', 'powerFactorT', 'reactivePowerLagging']
EQUIPMENT = dict(zip([1, 2, 3, 4, 5, 11, 12, 13, 14, 15, 16, 17, 18],
                    ['compressor-01', 'compressor-02', 'motor-01', 'motor-02',
                     'conveyor-01', 'robot-01', 'robot-02', 'robot-03', 'cooling-01',
                     'cooling-02', 'pump-01', 'pump-02', 'transformer-01']))


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def matrix(rows):
    def number(value):
        try:
            return float(value)
        except (TypeError, ValueError):
            return float('nan')
    values = np.asarray([[number(row.get(field)) for field in FIELDS] for row in rows])
    currents = values[:, 6:9]
    avg = currents.mean(axis=1)
    with np.errstate(divide='ignore', invalid='ignore'):
        imbalance = np.max(np.abs(currents - avg[:, None]), axis=1) / avg * 100
    # All-zero currents have no imbalance ratio. The placeholder is excluded at runtime.
    imbalance = np.where(avg == 0, 0, imbalance)
    return np.column_stack([values, imbalance])


def flags(values, lower, upper):
    invalid = ~np.isfinite(values) | (values < 0)
    return (invalid | (values < lower) | (values > upper)).any(axis=1)


def metrics(labels, predicted):
    tp = int((labels & predicted).sum()); fp = int((~labels & predicted).sum())
    fn = int((labels & ~predicted).sum()); tn = int((~labels & ~predicted).sum())
    return dict(rows=len(labels), tp=tp, fp=fp, fn=fn, tn=tn,
                precision=tp / (tp + fp) if tp + fp else 0,
                recall=tp / (tp + fn) if tp + fn else 0,
                falsePositiveRate=fp / (fp + tn) if fp + tn else 0)


def main():
    OUTPUT.mkdir(parents=True, exist_ok=True)
    policy = dict(version='normal-pattern-v1', kind='empirical-normal-range',
                  scope='synthetic-reference-patterns-not-fault-or-safety-limits',
                  method='median/IQR scale; calibration quantile of row maximum absolute score',
                  targetCalibrationFalsePositiveRate=TARGET_FPR, splitFractions=[0.6, 0.2, 0.2], equipment={})
    report = dict(version=policy['version'], method=policy['method'],
                  validationScope='held-out final 20% of each supplied synthetic clean/error series; not RF evaluation',
                  equipment=[], limitations=[
                      'Same-family synthetic data, not real equipment faults or safety limits.',
                      'Single-observation value ranges do not cover frozen sensors, clock/energy consistency, or absent telemetry.',
                      'Calibration fixes ranges before validation; validation labels are never used for fitting.',
                      'Raw measurement units are preserved; power is not silently converted to W or kW.',
                  ])
    clean_total = clean_fp = 0
    totals = dict(rows=0, tp=0, fp=0, fn=0, tn=0)
    by_type = {}
    feature_names = FIELDS + ['phaseImbalance']
    for path in sorted((SOURCE / 'clean_reference').glob('*.json')):
        equipment_id = EQUIPMENT[int(path.name.split('_')[0])]
        reference = json.loads(path.read_text(encoding='utf-8'))
        n = len(reference); fit_end = int(n * .6); calibration_end = int(n * .8)
        if min(fit_end, calibration_end - fit_end, n - calibration_end) < 1000:
            raise ValueError(f'Not enough observations: {path.name}')
        times = [int(float(row['localtime'])) for row in reference]
        if any(a >= b for a, b in zip(times, times[1:])):
            raise ValueError(f'Reference time is not strictly increasing: {path.name}')
        values = matrix(reference)
        if not np.isfinite(values).all() or (values < 0).any():
            raise ValueError(f'Invalid clean reference values: {path.name}')
        operations = np.asarray([int(float(row['operation'])) for row in reference])
        states = {}
        for state in sorted(set(operations[:fit_end])):
            fit = values[:fit_end][operations[:fit_end] == state]
            calibration = values[fit_end:calibration_end][operations[fit_end:calibration_end] == state]
            if min(len(fit), len(calibration)) < 100:
                raise ValueError(f'Insufficient state reference: {path.name}, {state}')
            median = np.median(fit, axis=0)
            q25, q75 = np.quantile(fit, [.25, .75], axis=0)
            scale = np.maximum((q75 - q25) / 1.349, 1e-6)
            max_score = np.max(np.abs((calibration - median) / scale), axis=1)
            cutoff = float(np.quantile(max_score, 1 - TARGET_FPR, method='higher'))
            lower = np.maximum(0, median - cutoff * scale); upper = median + cutoff * scale
            bounds = {field: dict(lower=float(lower[i]), upper=float(upper[i]),
                                  median=float(median[i]), scale=float(scale[i]),
                                  unit='%' if field == 'phaseImbalance' else '원본 값')
                      for i, field in enumerate(feature_names)}
            states[str(state)] = dict(fitRows=len(fit), calibrationRows=len(calibration), cutoff=cutoff, bounds=bounds)
        profile = dict(source=f'test_data/clean_reference/{path.name}', sha256=digest(path),
                       fitRows=fit_end, calibrationRows=calibration_end-fit_end,
                       validationRows=n-calibration_end, fitPeriod=[str(times[0]), str(times[fit_end-1])],
                       calibrationPeriod=[str(times[fit_end]), str(times[calibration_end-1])],
                       validationPeriod=[str(times[calibration_end]), str(times[-1])],
                       states=states)
        policy['equipment'][equipment_id] = profile
        def predict(test_values, test_states):
            result = np.ones(len(test_values), dtype=bool)
            for state, state_profile in states.items():
                mask = test_states == int(state)
                lo = np.array([state_profile['bounds'][f]['lower'] for f in feature_names])
                hi = np.array([state_profile['bounds'][f]['upper'] for f in feature_names])
                result[mask] = flags(test_values[mask], lo, hi)
            return result
        validation_flags = predict(values[calibration_end:], operations[calibration_end:])
        normal_fp = int(validation_flags.sum()); normal_rows = len(validation_flags)
        clean_fp += normal_fp; clean_total += normal_rows
        error_path = SOURCE / path.name
        corrupted = json.loads(error_path.read_text(encoding='utf-8'))
        if len(corrupted) != n or any(int(float(row['reference_localtime'])) != time for row, time in zip(corrupted, times)):
            raise ValueError(f'Error/reference alignment mismatch: {path.name}')
        held = corrupted[calibration_end:]
        labels = np.asarray([int(row['is_anomaly']) == 1 for row in held])
        def state_number(row):
            try:
                value = float(row['operation'])
                return value if np.isfinite(value) else -1
            except (ValueError, TypeError):
                return -1
        predicted = predict(matrix(held), np.array([state_number(row) for row in held]))
        measured = metrics(labels, predicted)
        for row, flag in zip(held, predicted):
            kind = str(row['anomaly_type'])
            stats = by_type.setdefault(kind, dict(rows=0, flagged=0))
            stats['rows'] += 1; stats['flagged'] += int(flag)
        for key in totals:
            totals[key] += measured[key]
        record = dict(equipmentId=equipment_id, file=path.name, sourceSha256=profile['sha256'],
                      errorSourceSha256=digest(error_path), fitRows=fit_end,
                      calibrationRows=calibration_end-fit_end, validationRows=normal_rows,
                      cleanFalsePositives=normal_fp, cleanFalsePositiveRate=normal_fp/normal_rows,
                      injectedErrorEvaluation=measured)
        report['equipment'].append(record)
        print(json.dumps(record, ensure_ascii=True), flush=True)
    if len(policy['equipment']) != 13:
        raise ValueError('All 13 equipment references are required')
    report['cleanValidation'] = dict(rows=clean_total, falsePositives=clean_fp,
                                     falsePositiveRate=clean_fp/clean_total)
    report['injectedErrorEvaluation'] = totals
    report['anomalyTypeBreakdown'] = by_type
    report['acceptance'] = dict(rule='Each held-out clean false-positive rate <= 1%; not a required error recall claim',
                                passed=all(r['cleanFalsePositiveRate'] <= .01 for r in report['equipment']))
    (OUTPUT / 'validation.json').write_text(json.dumps(report, ensure_ascii=False, indent=2, allow_nan=False)+'\n', encoding='utf-8')
    if not report['acceptance']['passed']:
        raise ValueError('Held-out clean acceptance failed; policy was not published')
    target = ROOT / 'server/config/normal-pattern-policy.json'
    target.write_text(json.dumps(policy, ensure_ascii=False, indent=2, allow_nan=False)+'\n', encoding='utf-8')
    (OUTPUT / '설비별-정상범위.csv').write_text('\ufeffequipmentId,operation,field,lower,upper,unit\n' + '\n'.join(
        f'{equipment_id},{state},{field},{bounds["lower"]:.9g},{bounds["upper"]:.9g},{bounds["unit"]}'
        for equipment_id, p in policy['equipment'].items() for state, state_profile in p['states'].items()
        for field, bounds in state_profile['bounds'].items())+'\n', encoding='utf-8')
    print(json.dumps(dict(cleanValidation=report['cleanValidation'], acceptance=report['acceptance']), ensure_ascii=True))


if __name__ == '__main__':
    main()
