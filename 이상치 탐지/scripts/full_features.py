"""Causal features for every original measurement and record-quality field."""
import numpy as np

SIGNALS = ['voltageR', 'voltageS', 'voltageT', 'voltageRS', 'voltageST', 'voltageTR',
           'currentR', 'currentS', 'currentT', 'activePower',
           'powerFactorR', 'powerFactorS', 'powerFactorT', 'reactivePowerLagging']
FIELDS = SIGNALS + ['accumActiveEnergy', 'operation', 'timestamp', 'localtime', 'module(equipment)']
ZERO_WHEN_OFF = ['currentR', 'currentS', 'currentT', 'activePower',
                 'powerFactorR', 'powerFactorS', 'powerFactorT', 'reactivePowerLagging']


def numeric(values):
    try:
        return np.asarray(values, dtype=np.float64)
    except (ValueError, TypeError):
        out = np.full(len(values), np.nan)
        for i, value in enumerate(values):
            try:
                out[i] = float(value)
            except (ValueError, TypeError):
                pass
        return out


def epochs(local):
    """Parse numeric YYYYMMDDhhmmss in Asia/Seoul; invalid values become NaN."""
    out = np.full(len(local), np.nan)
    mask = np.isfinite(local) & (local >= 20000101000000) & (local <= 20991231235959) & (local == np.floor(local))
    ix = np.flatnonzero(mask)
    strings = local[ix].astype(np.int64).astype(str)
    iso = [f'{s[:4]}-{s[4:6]}-{s[6:8]}T{s[8:10]}:{s[10:12]}:{s[12:14]}' for s in strings]
    try:
        dates = np.array(iso, dtype='datetime64[s]')
        out[ix] = dates.astype(np.int64) - 9 * 3600
    except ValueError:
        for j, s in zip(ix, iso):
            try:
                out[j] = np.datetime64(s, 's').astype(np.int64) - 9 * 3600
            except ValueError:
                pass
    return out


def run_lengths(x):
    same = np.zeros(len(x), bool)
    same[1:] = np.isfinite(x[1:]) & np.isfinite(x[:-1]) & (x[1:] == x[:-1])
    positions = np.arange(len(x))
    return (positions - np.maximum.accumulate(np.where(~same, positions, 0))).astype(float)


def features(raw, normalizer, expected_equipment):
    """Use values/arrival order only; never read label/scenario/reference columns."""
    if not raw:
        raise ValueError('Empty input')
    n = len(next(iter(raw.values())))
    if not n:
        raise ValueError('Empty input')
    if any(len(v) != n for v in raw.values()):
        raise ValueError('Inconsistent column lengths')
    values = {name: numeric(raw.get(name, np.full(n, np.nan))) for name in FIELDS[:-1]}
    columns = {}; quality = []; levels = []; outside = []; runs = []
    op = values['operation']; off = op == 0
    for name in SIGNALS:
        v = values[name]; finite = np.isfinite(v)
        lo, hi = normalizer['ranges'][name]; width = max(hi-lo, 1e-6)
        z = (np.where(finite, v, (lo+hi)/2) - (lo+hi)/2) / (width/2)
        bad_range = np.maximum(np.abs(z)-1, 0)
        # Off-state behavior is an explicit synthetic assumption, not real-fault truth.
        if name in ZERO_WHEN_OFF:
            bad_range = np.where(off, np.abs(np.where(finite, v, 0)) / max(abs(hi), 1e-6), bad_range)
        elif name.startswith('voltage'):
            bad_range = np.where(off & (v == 0), 0, bad_range)
        bad_range = np.where(finite, bad_range, 0)
        run = run_lengths(v)
        # Coarse quantization at zero during a valid stop is not a stuck sensor.
        run = np.where(off, 0, run)
        columns['level_' + name] = np.clip(z, -100, 100)
        columns['range_excess_' + name] = np.minimum(bad_range, 100)
        columns['invalid_' + name] = (~finite).astype(float)
        columns['unchanged_steps_' + name] = np.minimum(run, 120)
        quality.append(~finite); levels.append(z); outside.append(bad_range); runs.append(run)
    outside = np.column_stack(outside); runs = np.column_stack(runs)
    columns['max_range_excess'] = np.minimum(outside.max(axis=1), 100)
    columns['range_violation_count'] = (outside > 1e-6).sum(axis=1)
    columns['max_unchanged_steps'] = np.minimum(runs.max(axis=1), 120)
    columns['stuck_channel_count_5'] = (runs >= 5).sum(axis=1)
    columns['all_nine_unchanged'] = (runs[:, [0, 1, 2, 6, 7, 8, 10, 11, 12]] >= 1).all(axis=1).astype(float)
    columns['operation_off'] = off.astype(float)
    columns['operation_invalid'] = (~np.isin(op, [0, 1])).astype(float)
    quality.append(~np.isin(op, [0, 1]))
    energy = values['accumActiveEnergy']; power = values['activePower']
    finite_energy = np.isfinite(energy)
    delta = np.zeros(n); valid_delta = np.zeros(n, bool)
    valid_delta[1:] = finite_energy[1:] & finite_energy[:-1]
    np.subtract(energy[1:], energy[:-1], out=delta[1:], where=valid_delta[1:])
    scale = normalizer['energy_step_scale']
    expected = power * normalizer['energy_per_power_5s']
    valid_residual = valid_delta & np.isfinite(power)
    residual = np.where(valid_residual, (delta-np.where(np.isfinite(expected), expected, 0))/scale, 0)
    columns['energy_invalid'] = (~finite_energy).astype(float)
    columns['energy_negative_value'] = (finite_energy & (energy < 0)).astype(float)
    columns['energy_delta'] = np.clip(delta/scale, -100, 100)
    columns['energy_reverse'] = (valid_delta & (delta < -.002)).astype(float)
    columns['energy_power_residual'] = np.clip(residual, -100, 100)
    columns['energy_power_abs_residual'] = np.minimum(abs(residual), 100)
    columns['energy_frozen_with_power'] = (valid_residual & (abs(delta) < .0001) & (power > .1)).astype(float)
    quality.append(~finite_energy)
    ts = values['timestamp']; local = values['localtime']; epoch = epochs(local)
    ts_valid = np.isfinite(ts) & (ts >= 946684800000) & (ts <= 4102444800000)
    local_valid = np.isfinite(epoch)
    mismatch = ts_valid & local_valid & (abs(ts/1000-epoch) > .001)
    columns['timestamp_invalid'] = (~ts_valid).astype(float)
    columns['localtime_invalid'] = (~local_valid).astype(float)
    columns['clocks_disagree'] = mismatch.astype(float)
    # Use localtime as the primary clock; timestamp is a fallback when localtime is corrupt.
    clock = np.where(local_valid, epoch, np.where(ts_valid, ts/1000, np.nan))
    valid_step = np.zeros(n, bool); valid_step[1:] = np.isfinite(clock[1:]) & np.isfinite(clock[:-1])
    step = np.zeros(n); np.subtract(clock[1:], clock[:-1], out=step[1:], where=valid_step[1:])
    columns['time_step_error'] = (valid_step & (abs(step-5) > .001)).astype(float)
    columns['time_nonincreasing'] = (valid_step & (step <= 0)).astype(float)
    columns['time_gap_steps'] = np.where(valid_step, np.clip(abs(step-5)/5, 0, 100), 0)
    quality.extend([~ts_valid, ~local_valid, mismatch, columns['time_step_error'].astype(bool)])
    names = np.asarray(raw.get('module(equipment)', np.full(n, '')), dtype=str)
    mismatch_name = names != expected_equipment
    columns['equipment_mismatch'] = mismatch_name.astype(float)
    quality.append(mismatch_name)
    columns['invalid_or_quality_count'] = np.column_stack(quality).sum(axis=1)
    names = list(columns)
    x = np.column_stack(list(columns.values())).astype(np.float32)
    if not np.isfinite(x).all():
        raise ValueError('Feature computation produced nonfinite values')
    return x, names


def predict_full(model, raw, expected_equipment=None):
    if expected_equipment is None:
        names, counts = np.unique(np.asarray(raw.get('module(equipment)', []), dtype=str), return_counts=True)
        known = [(int(count), str(name)) for name, count in zip(names, counts) if name in model['normalizers']]
        if not known:
            raise ValueError('No known equipment ID; supply --equipment for the expected source device')
        if len(known) > 1:
            raise ValueError('Multiple known equipment IDs; supply --equipment to identify the source device')
        expected_equipment = max(known)[1]
    if expected_equipment not in model['normalizers']:
        raise ValueError('Expected equipment has no trained normalizer')
    x, names = features(raw, model['normalizers'][expected_equipment], expected_equipment)
    if names != model['feature_names']:
        raise ValueError('Feature schema mismatch')
    score = model['classifier'].predict_proba(x)[:, 1]
    return score, score >= model['threshold']
