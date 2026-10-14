"""Minimal runtime helpers for the packaged Random Forest."""
import hashlib
import json
from pathlib import Path
import numpy as np
import pyarrow.csv as pc
import pyarrow.parquet as pq

ROOT = Path(__file__).resolve().parents[1]

def read_arrays(path):
    table = pq.read_table(path) if Path(path).suffix == '.parquet' else pc.read_csv(path)
    return {name: table[name].to_numpy() for name in table.column_names}

def sha(path):
    digest = hashlib.sha256()
    with Path(path).open('rb') as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b''):
            digest.update(chunk)
    return digest.hexdigest()

def save_json(path, value):
    Path(path).write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

def metrics(y, flags):
    y = np.asarray(y, dtype=bool)
    tp = int((flags & y).sum()); fp = int((flags & ~y).sum())
    fn = int((~flags & y).sum()); tn = int((~flags & ~y).sum())
    return dict(rows=len(y), tp=tp, fp=fp, fn=fn, tn=tn,
                precision=tp / (tp + fp) if tp + fp else 0,
                recall=tp / (tp + fn) if tp + fn else 0,
                f1=2 * tp / (2 * tp + fp + fn) if 2 * tp + fp + fn else 0,
                false_positive_rate=fp / (fp + tn) if fp + tn else 0)
