# scripts 폴더 설명

이 폴더는 학습된 **RandomForest_all_fields_v4** 모델로 13개 장비의 데이터를 검사하는 실행 코드입니다. 실시간 입력은 `stream_monitor.py`, 검증 데이터의 성능 평가는 `evaluate.py`, 파일 무결성 확인은 `verify_files.py`를 사용합니다.

아래 명령은 `scripts` 안이 아니라 상위 **이상치 탐지 폴더**에서 실행합니다. 설치 방법은 [상위 README](../README.md), 데이터 구성은 [data/README](../data/README.md)를 확인하세요.

## 1. 파일별 역할

| 파일 | 역할 | 사용 방식 |
|---|---|---|
| [stream_monitor.py](stream_monitor.py) | 장비별 한 건 검사, 이력 유지, 이상 장비·항목만 출력 | 직접 실행하거나 수신 프로그램에서 `EquipmentMonitor` 사용 |
| [full_features.py](full_features.py) | 원본 19개 항목에서 모델 입력 78개 특징 계산, 전체 시계열 추론 | 다른 스크립트에서 불러오는 모듈 |
| [rf_common.py](rf_common.py) | 파일 읽기, 프로젝트 경로, SHA-256, JSON 저장, 평가 지표 계산 | 다른 스크립트에서 불러오는 공통 모듈 |
| [evaluate.py](evaluate.py) | 오류 포함 검증 자료와 정상 참조를 검사하고 성능 보고서 저장 | 평가할 때 직접 실행 |
| [verify_files.py](verify_files.py) | `checksums.json`에 기록된 파일의 SHA-256 확인 | 전달받은 파일을 확인할 때 직접 실행 |

## 2. 실시간 검사: stream_monitor.py

입력 한 건을 받으면 장비를 식별하고, 그 장비의 최근 이력과 함께 특징을 계산한 뒤 Random Forest로 이상 여부를 판정합니다. 모델 점수가 저장된 임계값 **0.5 이상**이면 장비 이름과 의심 항목을 출력합니다.

### 데모

```bash
python scripts/stream_monitor.py --demo
```

13개 장비의 정상 참조에서 장비당 12건을 가져오고, 전류와 선간전압에 오류 한 건씩 넣습니다. 출력은 다음 두 줄입니다.

```json
{"equipment": "1(PM-3)", "fields": ["currentR"]}
{"equipment": "12(4호기)", "fields": ["voltageST"]}
```

### 파일 및 표준 입력

```bash
# 포함된 실행 예제
python scripts/stream_monitor.py --input examples/stream_input.jsonl

# 실제 수신 데이터를 저장한 파일
python scripts/stream_monitor.py --input incoming.jsonl

# 표준 입력으로 전달
python scripts/stream_monitor.py < incoming.jsonl
```

**한 줄에 한 JSON 객체**를 넣습니다. 기본 형식은 `{"equipment": 1, "data": reading}`이고, `reading`은 한 장비의 한 시점 관측값 전체입니다. 완전한 입력 예시는 [examples/stream_input.jsonl](../examples/stream_input.jsonl)에 있습니다.

`data` 없이 원본 키를 직접 담은 평면 객체도 지원합니다. 외부 `equipment` 또는 원본 `module(equipment)` 값으로 장비를 식별합니다. 외부 장비 번호가 있으면 읽은 데이터의 식별값이 잘못됐더라도 실제 수신 장비를 기준으로 검사할 수 있습니다.

### CLI 옵션

| 옵션 | 의미 | 기본 동작 |
|---|---|---|
| `--model` | 사용할 모델 파일 | `models/random_forest.joblib` |
| `--input` | JSON Lines 입력 파일 | 생략하면 표준 입력 대기 |
| `--demo` | 포함된 정상 참조로 13개 장비 데모 | 지정할 때만 실행 |

`--demo`와 `--input`은 동시에 사용할 수 없습니다. `--input`에는 Parquet나 CSV 대신 JSON Lines 파일을 지정합니다.

### Python 수신 코드에 연결

모델을 관측마다 다시 읽지 않도록 `EquipmentMonitor`는 한 번 생성합니다.

```python
import json
from scripts.stream_monitor import EquipmentMonitor

monitor = EquipmentMonitor()

def on_data(equipment_id, reading):
    notice = monitor.check(equipment_id, reading)
    if notice is not None:
        print(json.dumps(notice, ensure_ascii=False), flush=True)
```

| 메서드 | 설명 |
|---|---|
| `EquipmentMonitor(model_path=...)` | 모델 한 번 로드, 장비별 이력 준비 |
| `check(equipment, record)` | 한 관측 검사. 정상은 `None`, 이상은 `equipment`/`fields` 사전 반환 |
| `resolve_equipment(equipment)` | 장비 번호 또는 전체 이름을 등록된 장비 이름으로 변환 |
| `reset(equipment)` | 특정 장비 이력 초기화 |
| `reset()` | 전체 장비 이력 초기화 |

장비 번호는 `1`, `2`, `3`, `4`, `5`, `11`~`18`을 사용합니다. `1(PM-3)` 같은 전체 이름도 지원합니다. 장비별 최근 **121개 관측**을 따로 유지하므로 여러 장비가 번갈아 들어와도 서로의 센서 고정 시간이나 전력량 차이에 영향을 주지 않습니다.

원래 관측 간격은 **5초**입니다. 도착 순서대로 전달하고, 의도적으로 새로운 독립 시계열을 시작할 때만 이력을 초기화합니다. 프로그램을 재시작하면 메모리 이력도 새로 시작합니다. 모델은 CPU 한 작업자로 검사하며 저장된 모델 파일과 임계값은 바꾸지 않습니다.

### 출력 의미

- 정상 관측은 출력하지 않습니다.
- 이상 관측은 `equipment`, `fields` 두 항목만 가진 JSON 한 줄로 출력합니다.
- 같은 오류가 계속되면 이상으로 판단한 관측마다 출력합니다.
- 잘못된 JSON이나 미등록 장비 등 검사할 수 없는 입력은 표준 오류(`stderr`)에 기록하고 다음 줄을 계속 처리합니다.
- `fields`는 범위 이탈·누락·센서 고정·시간 오류 등의 근거로 표시한 **의심 항목**입니다.
- 전력/누적전력량 불일치처럼 원인을 한쪽으로 특정할 수 없으면 두 항목을 함께 표시합니다. 특정 근거가 없으면 `측정값 조합(항목 특정 불가)`로 표시합니다.

항목 표시에는 삽입 당시 정답인 `fault_fields`나 `is_anomaly`를 사용하지 않습니다. 실제 고장 부품을 확정하는 출력은 아닙니다.

## 3. 특징 계산: full_features.py

이 모듈은 실행 스크립트가 사용하는 전처리를 제공합니다.

| 항목 | 역할 |
|---|---|
| `FIELDS` | 입력 원본 19개 항목 이름 |
| `SIGNALS` | 전압·전류·역률·전력 등 연속 측정값 14개 |
| `features(raw, normalizer, expected_equipment)` | 이력으로 78개 숫자 특징 계산, 특징 배열과 이름 반환 |
| `predict_full(model, raw, expected_equipment=None)` | 한 장비의 전체 시계열을 검사하여 점수 배열과 이상 여부 배열 반환 |

특징에는 정규화한 값, 범위 초과 정도, 숫자 형식/누락 여부, 반복 횟수, 누적전력량 변화, 시간·장비 식별값 오류가 들어갑니다. `raw`는 컬럼 이름마다 같은 길이의 배열을 담는 형태이며, 실시간 한 건 호출에는 `EquipmentMonitor.check`를 사용하면 됩니다.

모델에 저장된 장비별 정상화 기준을 사용하며 정답 라벨은 입력 특징에서 제외합니다. 실행할 때 임의로 특징의 이름·순서·정상화 방식을 바꾸면 학습 모델과 맞지 않을 수 있습니다.

## 4. 성능 평가: evaluate.py

이 스크립트는 포함된 오류 포함 시계열과 같은 시점의 정상 참조를 검사합니다. 실시간 알림 대신 장비별 성능과 전체 통계를 표준 출력에 표시하고 평가 결과 파일을 저장합니다.

```bash
# 최종 검증 데이터 검사
python scripts/evaluate.py --output-dir outputs/test_evaluation

# 임계값 보정 자료 검사
python scripts/evaluate.py --split calibration --output-dir outputs/calibration_evaluation
```

| 옵션 | 의미 | 기본값 |
|---|---|---|
| `--model` | 검사할 모델 | `models/random_forest.joblib` |
| `--data-dir` | 평가 데이터 루트 | `data/full_coverage_v4` |
| `--split` | `train`, `calibration`, `test` 중 선택 | `test` |
| `--output-dir` | 결과 저장 폴더 | `outputs/full_coverage_v4_evaluation` |

기존 결과 폴더가 있으면 덮어쓰지 않습니다. 다시 실행할 때 다른 출력 경로를 지정합니다. `train` 평가에는 모델 학습에 사용한 데이터가 포함되므로 최종 성능 판단에는 `test`를 사용합니다.

출력 파일:

```text
outputs/test_evaluation/
├── report.json                 전체·장비별·오류 유형별·항목별 지표
├── events.json                 오류 이벤트 탐지 여부와 첫 탐지 지연
└── predictions/
    ├── 01_PM-3.parquet          행별 점수·예측·정답·정상 참조 판정
    └── ...                     장비별 총 13개
```

`report.json`에는 TP/FP/FN/TN, 정밀도·재현율·F1, 정상 오탐률, 이벤트 탐지율과 센서 고정 탐지 지연이 들어 있습니다. 행별 재현율과 이벤트 탐지율은 다른 지표입니다. 센서 고정 초기에 몇 행을 놓쳐도 해당 구간 안에서 알림이 발생하면 이벤트는 탐지한 것으로 셉니다.

이 스크립트는 성능만 검사하며 모델을 학습하거나 임계값을 다시 결정하지 않습니다. 항목별 지표는 삽입 정답으로 집계한 통계이고 모델의 고장 원인 진단 정확도는 아닙니다.

## 5. 파일 무결성: verify_files.py

```bash
python scripts/verify_files.py
```

프로젝트 루트의 `checksums.json`에 **등록된 파일들**이 존재하고, 저장된 SHA-256과 현재 내용이 일치하는지 검사합니다. 누락되거나 변경된 등록 파일이 있으면 실패합니다. 모델 예측 성능을 검사하는 명령은 아니며, 성능은 `evaluate.py`로 확인합니다.

## 6. 공통 함수: rf_common.py

이 모듈은 다음 기능을 제공합니다.

| 항목 | 역할 |
|---|---|
| `ROOT` | 현재 패키지 루트 경로 |
| `read_arrays(path)` | Parquet 또는 CSV/CSV.gz를 컬럼별 배열로 읽기 |
| `sha(path)` | 파일 SHA-256 계산 |
| `save_json(path, value)` | UTF-8 JSON 저장 |
| `metrics(y, flags)` | 정상/오류 정답과 판정으로 지표 계산 |

경로·파일 읽기·평가를 지원하는 모듈이며 직접 모델을 실행하는 진입점은 아닙니다.

## 7. 실행 중 확인할 사항

| 상황 | 확인할 내용 |
|---|---|
| 라이브러리를 찾을 수 없음 | 가상환경을 활성화하고 `python -m pip install -r requirements.txt` 실행 |
| 모델 파일을 찾을 수 없음 | `models/random_forest.joblib`를 유지했는지 확인. 다른 파일은 `--model`로 지정 |
| 정상 데이터만 넣었는데 출력이 없음 | 실시간 검사에서 정상일 때의 정상 동작 |
| 미등록 장비 오류 | 등록된 번호/이름을 전달하는지 확인 |
| 같은 관측이 반복될 때 이상 알림 | 장비별 이력으로 센서값 고정을 검사하는 동작 |
| 평가 출력 폴더가 이미 존재함 | `--output-dir`을 다른 경로로 지정 |
| 데모 참조 파일을 찾을 수 없음 | `data/full_coverage_v4/test/clean_reference`와 13개 파일이 있는지 확인 |

모델 파일, 특징 계산 코드와 공통 모듈을 함께 유지하세요. 입력 컬럼과 학습/검증 데이터의 의미는 [data/README](../data/README.md)에 설명되어 있습니다.
