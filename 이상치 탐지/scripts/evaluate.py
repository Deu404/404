"""Score a frozen all-field model with row, event and field coverage reports."""
import argparse
import json
from pathlib import Path

import joblib
import numpy as np
import pyarrow as pa
import pyarrow.parquet as pq

from full_features import FIELDS, predict_full
from rf_common import ROOT, metrics, read_arrays, save_json, sha


def evaluate(model_path, data_dir, split, out):
    if out.exists():raise FileExistsError(f'Output exists: {out}')
    out.mkdir(parents=True);(out/'predictions').mkdir()
    model_hash=sha(model_path);model=joblib.load(model_path)
    manifest=json.loads((data_dir/'manifest.json').read_text())
    events=json.loads((data_dir/split/'events.json').read_text())
    equipment=[];by_type={};by_field={};event_results=[];ys=[];flags_all=[];clean_fp=0
    for info in (f for f in manifest['files'] if f['split']==split):
        mp=data_dir/split/info['file'];cp=data_dir/split/'clean_reference'/info['file']
        if sha(mp)!=info['mixed_sha256'] or sha(cp)!=info['clean_sha256']:raise ValueError('Data hash mismatch')
        raw=read_arrays(mp);clean=read_arrays(cp)
        inference={k:raw[k] for k in FIELDS}
        scores,flags=predict_full(model,inference,info['equipment'])
        cs,cf=predict_full(model,clean,info['equipment'])
        y=raw['is_anomaly'].astype(bool);types=raw['anomaly_type'];fault_fields=raw['fault_fields']
        ys.append(y);flags_all.append(flags);clean_fp+=int(cf.sum())
        equipment.append(dict(equipment=info['equipment'],**metrics(y,flags),clean_false_positives=int(cf.sum())))
        for name in np.unique(types[y]):
            mask=types==name
            entry=by_type.setdefault(str(name),dict(rows=0,detected=0,missed=0))
            entry['rows']+=int(mask.sum());entry['detected']+=int(flags[mask].sum());entry['missed']+=int((~flags[mask]).sum())
        for name in FIELDS:
            mask=np.array([name in s.split('|') for s in fault_fields]) & y
            entry=by_field.setdefault(name,dict(affected_rows=0,detected=0,missed=0))
            entry['affected_rows']+=int(mask.sum());entry['detected']+=int(flags[mask].sum());entry['missed']+=int((~flags[mask]).sum())
        for event in events[info['file']]:
            ix=np.array(event['labeled_rows'])-1;hits=ix[flags[ix]]
            event_results.append(dict(equipment=info['equipment'],event_id=event['event_id'],
                                      kind=event['kind'],fields=event['fields'],detected=bool(len(hits)),
                                      first_detection_delay_seconds=int((hits[0]-(event['start_row']-1))*5) if len(hits) else None))
        pq.write_table(pa.table(dict(data_row=np.arange(1,len(y)+1),reference_localtime=raw['reference_localtime'],
                                    is_anomaly=y.astype(np.int8),anomaly_type=types,fault_fields=fault_fields,
                                    score=scores,predicted_anomaly=flags.astype(np.int8),
                                    clean_score=cs,clean_alert=cf.astype(np.int8))),out/'predictions'/info['file'],compression='zstd')
        print(info['equipment'],equipment[-1],flush=True)
    total=metrics(np.concatenate(ys),np.concatenate(flags_all));total['clean_reference_rows']=sum(len(y) for y in ys)
    total['clean_reference_false_positives']=clean_fp
    for entry in by_type.values():entry['recall']=entry['detected']/entry['rows']
    for entry in by_field.values():entry['recall']=entry['detected']/entry['affected_rows'] if entry['affected_rows'] else None
    misses=[e for e in event_results if not e['detected']]
    delays=[e['first_detection_delay_seconds'] for e in event_results if 'stuck' in e['kind'] and e['detected']]
    report=dict(model_sha256=model_hash,split=split,seed=manifest['seeds'][split],threshold=model['threshold'],
                totals=total,equipment=equipment,by_type=by_type,by_field=by_field,
                event_metrics=dict(events=len(event_results),detected=len(event_results)-len(misses),missed=len(misses),
                                   recall=1-len(misses)/len(event_results),
                                   stuck_detection_delay_seconds=dict(median=float(np.median(delays)),max=int(max(delays))) if delays else {}),
                missed_events=misses,labels_removed_before_inference=True,model_and_threshold_unchanged=sha(model_path)==model_hash,
                interpretation='Row recall includes stuck-event onset before evidence accumulates. Field metrics overlap for simultaneous faults and do not imply field diagnosis. These are synthetic tests, not real fault ground truth.')
    save_json(out/'report.json',report);save_json(out/'events.json',event_results)
    print('TOTAL',json.dumps(total),flush=True);print('EVENTS',json.dumps(report['event_metrics']),flush=True)
    return report


def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--model',type=Path,default=ROOT/'models/random_forest.joblib')
    p.add_argument('--data-dir',type=Path,default=ROOT/'data/full_coverage_v4')
    p.add_argument('--split',choices=['train','calibration','test'],default='test')
    p.add_argument('--output-dir',type=Path,default=ROOT/'outputs/full_coverage_v4_evaluation')
    a=p.parse_args();evaluate(a.model,a.data_dir,a.split,a.output_dir)


if __name__=='__main__':main()
