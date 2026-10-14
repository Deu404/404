# data 폴더 설명

이 폴더에는 현재 **RandomForest_all_fields_v4** 모델의 실제 학습 입력, 학습 원본, 임계값 보정 자료, 최종 검증 자료, 정상화 기준 계산 자료가 들어 있습니다. 대상은 13개 장비이며 관측 주기는 5초입니다.

제공된 원본과 추가한 오류는 **합성·가공 데이터**입니다. 오류 라벨은 인위적으로 삽입한 시나리오의 정답이며 실제 설비 고장 이력은 아닙니다. 모델 실행 방법은 [상위 README](../README.md)를 확인하세요.

## 1. 폴더별 용도

| 경로 | 용도 | 파일 구성 | 전체 행 수 |
|---|---|---|---:|
| `training_rows/` | 현재 Random Forest 분류기에 실제로 입력한 학습 표본 | 장비별 Parquet 13개 + manifest | **809,965** |
| `normalization_source/` | 장비별 정상 범위와 전력량 변환 계수 산정에 사용한 정상 자료 | 장비별 Parquet 13개 + manifest | **673,920** |
| `full_coverage_v4/train/` | 오류를 포함한 학습 원본 시계열 | 장비별 Parquet 13개 | **705,120** |
| `full_coverage_v4/train/clean_reference/` | 같은 시점의 오류 삽입 전 정상 참조 | 장비별 Parquet 13개 | **705,120** |
| `full_coverage_v4/calibration/` | 학습 후 판정 임계값을 정하는 보정 데이터 | 장비별 오류 포함 Parquet 13개 | **705,120** |
| `full_coverage_v4/calibration/clean_reference/` | 보정 데이터의 정상 참조 | 장비별 Parquet 13개 | **705,120** |
| `full_coverage_v4/test/` | 모델과 임계값을 고정한 뒤 성능을 검사한 최종 검증 데이터 | 장비별 오류 포함 Parquet 13개 | **705,120** |
| `full_coverage_v4/test/clean_reference/` | 최종 검증의 정상 참조, 정상 오탐 확인용 | 장비별 Parquet 13개 | **705,120** |

`full_coverage_v4`의 오류 포함 시계열과 정상 참조는 서로 다른 입력입니다. 같은 파일명·같은 행 번호가 대응하지만 값을 그대로 합치거나 오류 포함 데이터의 정상 행 수에 정상 참조 행 수를 더해 성능을 계산하지 않습니다.

```text
 data/
 ├── README.md
 ├── training_rows/                 실제 분류기 학습 입력
 │   ├── 01_PM-3.parquet
 │   ├── ...                       장비별 총 13개
 │   └── manifest.json
 ├── normalization_source/          정상 기준 산정 자료
 │   ├── ...                       장비별 총 13개
 │   └── manifest.json
 └── full_coverage_v4/
     ├── train/                    학습 원본
     │   ├── ...                   오류 포함 파일 13개
     │   ├── clean_reference/      정상 참조 파일 13개
     │   └── events.json
     ├── calibration/              임계값 보정, train과 같은 구조
     ├── test/                     최종 검증, train과 같은 구조
     ├── manifest.json
     ├── normalizers.json
     └── verification.json
```

## 2. 실제 학습 표본과 원본 시계열의 차이

`training_rows`의 **809,965행**이 현재 분류기의 실제 학습 입력입니다.

- 정상: **765,432행**, `is_anomaly = 0`
- 오류: **44,533행**, `is_anomaly = 1`

이 파일은 원본 측정값을 전처리한 **78개 숫자 특징**과 라벨, 원본 행 번호, 원본 종류를 담습니다. 총 81개 컬럼입니다. 원본 19개 측정 항목을 담은 입력 파일과 구조가 다릅니다.

| 컬럼 | 의미 |
|---|---|
| `level_*` | 장비별 정상 범위로 정규화한 측정값 |
| `range_excess_*` | 정상 범위를 벗어난 정도 |
| `invalid_*` | 누락·문자열·무한대 등 숫자로 사용할 수 없는 값 여부 |
| `unchanged_steps_*` | 같은 센서값이 연속해서 반복된 관측 횟수 |
| 나머지 파생 특징 | 여러 항목의 범위 이탈·고정, 전력량 변화, 시간·식별값 오류 등의 요약 |
| `is_anomaly` | 정상 0, 오류 1인 학습 정답 |
| `source_row` | 해당 장비의 학습 원본 파일에서 대응하는 행 번호, **1부터 시작** |
| `source_variant` | `mixed`: 오류 포함 학습 원본, `clean_reference`: 정상 참조 |

장비 이름·파일별 행 수·전체 특징 이름·SHA-256은 [training_rows/manifest.json](training_rows/manifest.json)에 있습니다. 학습 파일 이름과 `source_row`, `source_variant`를 조합하면 `full_coverage_v4/train` 안의 원본 행을 찾을 수 있습니다.

정상 학습 표본에는 오류 포함 학습 원본의 정상 행과 정상 참조에서 뽑은 표본이 들어 있습니다. 원본 오류 50,076행 중 정상 반복과 구분할 근거가 부족한 센서 고정 초기 **5,543행은 학습에서만 제외**했습니다. 평가 시에는 이 초기 구간도 오류로 포함해 미탐과 지연 시간을 계산합니다.

**`training_rows`는 연속 원본 시계열이 아닙니다.** 원본 측정값을 받는 실시간 검사기에 이 파일을 그대로 보내거나, 표본 행 순서로 고정 시간을 다시 계산하면 안 됩니다. 실시간 입력 형식 확인이나 재검증에는 `full_coverage_v4`의 원본 파일을 사용합니다.

## 3. 학습·보정·검증 기간과 오류 수

시간대는 **Asia/Seoul**입니다. 각 생성 분할은 장비당 54,240행, 전체 705,120행입니다. 기간은 오류로 변경되지 않은 기준 시간인 `reference_localtime` 기준입니다.

| 분할 | 기간 | 난수 시드 | 오류 포함 시계열의 오류 행 수 |
|---|---|---:|---:|
| `train` | 2025-06-01 00:00:00 ~ 2025-06-04 03:19:55 | 2026101411 | **50,076** |
| `calibration` | 2025-06-08 00:00:00 ~ 2025-06-11 03:19:55 | 2026101412 | **55,536** |
| `test` | 2025-06-15 00:00:00 ~ 2025-06-18 03:19:55 | 2026101413 | **60,996** |

설비마다 별도 시드를 파생했고 분할 간 시간도 겹치지 않습니다. `calibration`은 임계값 보정용이며 분류기 학습 입력에 포함하지 않았습니다. `test`는 분류기 학습과 임계값 결정에 사용하지 않았습니다. 세 분할은 같은 합성 생성 규칙을 사용하므로 서로 다른 실제 고장 분포를 검증했다는 의미는 아닙니다.

`normalization_source`는 **2025-05-10 00:00:00 ~ 2025-05-12 23:59:55**의 기존 정상 자료입니다. 장비당 51,840행입니다. 이 자료에서 정상 범위와 누적전력량 증가분/유효전력의 변환 계수를 구했습니다. 실제 분류기 학습 표본인 `training_rows`와 역할이 다릅니다.

## 4. 원본 시계열의 컬럼

`full_coverage_v4`의 오류 포함 파일은 원본 19개 항목과 정답·감사용 5개 항목을 합친 **24개 컬럼**입니다. `clean_reference`와 `normalization_source` 파일은 원본 **19개 컬럼**입니다.

| 원본 컬럼 | 설명 |
|---|---|
| `module(equipment)` | 장비 식별값 |
| `timestamp` | Unix 시간, 밀리초 |
| `localtime` | 한국 시간, `YYYYMMDDhhmmss` |
| `operation` | 합성 운전 상태, 0/1 |
| `voltageR`, `voltageS`, `voltageT` | R/S/T상 전압 |
| `voltageRS`, `voltageST`, `voltageTR` | 선간전압 |
| `currentR`, `currentS`, `currentT` | R/S/T상 전류 |
| `activePower` | 유효전력 |
| `powerFactorR`, `powerFactorS`, `powerFactorT` | R/S/T상 역률 |
| `reactivePowerLagging` | 무효전력 |
| `accumActiveEnergy` | 누적전력량 |

| 정답·감사용 컬럼 | 설명 |
|---|---|
| `is_anomaly` | 정상 0, 오류 1 |
| `anomaly_type` | 삽입한 오류 유형, 정상은 `normal` |
| `fault_fields` | 오류를 삽입한 항목명. 여러 항목이면 `\|`로 구분 |
| `event_id` | 파일 내부 오류 이벤트 번호. 정상 행은 0 |
| `reference_localtime` | 오류로 훼손하지 않은 기준 시간 |

정답·감사용 5개 항목은 모델 입력에서 제외합니다. 특히 시간 오류를 검사할 때 `reference_localtime`으로 실제 `localtime`을 미리 고쳐서 입력하면 오류가 숨겨집니다.

생성 원본은 `SENSOR_ERROR`, `nan`, `inf` 같은 잘못된 값을 보존하기 위해 **측정 열도 문자열로 저장**했습니다. 전처리 코드가 이를 숫자로 변환하고, 변환 불가능하거나 무한대인 값은 데이터 품질 특징으로 처리합니다. `normalization_source`는 기존 정상 CSV를 읽어 선택한 구간을 저장했으므로 숫자 항목이 숫자형으로 들어 있습니다.

정상 참조와 값이 다르다는 이유만으로 모든 행을 오류라고 판단하면 안 됩니다. 범위 안의 정상 부하 변화, 누적전력량 기준값 변화 후의 정상 증가, 오류 복귀 구간 등도 있으므로 평가 정답은 `is_anomaly`를 사용합니다.

## 5. 인위적인 오류의 종류

각 장비·분할에 **1,118개 오류 이벤트**를 넣었습니다.

- 측정값의 상한/하한 이탈, 0, 음수, 누락, 무한대, 숫자가 아닌 문자열
- 센서값이 일정하게 반복되는 고정 오류, 점진적 상승/하락
- 14개 연속 측정값의 모든 두 항목 조합 91쌍에 대한 저/저·저/고·고/저·고/고 오류
- 91쌍의 동시 센서 고정, 원본 19개 항목의 171쌍 동시 누락
- 일부 3개 이상 항목의 복합 오류와 고정 조합
- 누적전력량 감소·리셋·급증·고정·증가율 변화
- 운전 상태 이상, 시간 중복·역행·간격 오류, 장비 식별값 이상

여기서 **고정**은 센서 측정값을 같은 값으로 반복하도록 만든 오류입니다. 설비 고장을 확정하는 용어는 아닙니다. 실제 정상 운전에서도 값이 반복될 수 있어 짧은 반복은 정상 사례에도 넣었습니다. 정상 범위 안의 드리프트는 범위를 벗어나기 전까지 정상으로 라벨링했습니다.

정상 범위는 이 데이터에서 계산한 범위이며 공학적 안전 한계가 아닙니다. 운전 상태 0/1의 의미, 정지 시 값, 전력량 변환 관계는 합성 데이터의 가정을 따릅니다. 상세 가정은 [full_coverage_v4/manifest.json](full_coverage_v4/manifest.json)에 기록되어 있습니다.

## 6. 파일 이름과 메타데이터

장비별 파일은 `01_PM-3.parquet`, `02_L-1전등.parquet`, `03_분쇄기(2).parquet` 등의 이름입니다. `01`, `02`, `03`은 장비 번호이며 동일한 이름의 파일이 각 분할과 정상 참조에 있습니다.

| 메타데이터 파일 | 내용 |
|---|---|
| `training_rows/manifest.json` | 실제 학습 행 수·오류 행 수·특징 이름·장비·파일 해시 |
| `normalization_source/manifest.json` | 정상 기준 자료의 기간·행 수·원본 및 추출 파일 해시 |
| `full_coverage_v4/manifest.json` | 분할·시드·시나리오·행 수·오류 수·합성 가정·파일 해시 |
| `full_coverage_v4/normalizers.json` | 장비별 정상 범위와 전력량 변환 계수 |
| `full_coverage_v4/<분할>/events.json` | 이벤트별 유형·항목·시작 행·오류 라벨 행 번호 |
| `full_coverage_v4/verification.json` | 원본 파일 무결성·분할·라벨·조합 검사 결과 |

이 메타데이터는 실행 시 측정 데이터로 보내지 않습니다.

## 7. 읽는 방법

다음 예제는 상위 **이상치 탐지 폴더**에서 실행합니다. `requirements.txt`에 있는 `pyarrow`로 읽을 수 있으며 pandas 설치는 필요하지 않습니다.

```python
import pyarrow.parquet as pq

table = pq.read_table("data/full_coverage_v4/test/01_PM-3.parquet")
print(table.num_rows)          # 54240
print(table.column_names)      # 원본 19개 + 정답/감사용 5개
print(table.slice(0, 3).to_pylist())
```

원본의 한 관측을 검사기로 보내는 예:

```python
from scripts.full_features import FIELDS
from scripts.stream_monitor import EquipmentMonitor

monitor = EquipmentMonitor()
row = table.slice(0, 1).to_pylist()[0]
reading = {name: row[name] for name in FIELDS}
notice = monitor.check(1, reading)
if notice is not None:
    print(notice)
```

전체 최종 검증을 실행하려면 상위 폴더에서 다음 명령을 사용합니다.

```bash
python scripts/evaluate.py --output-dir outputs/test_evaluation
```

기존 출력 경로가 있으면 다른 이름을 지정합니다. 실행 및 의존성 설치는 [상위 README](../README.md)에 설명되어 있습니다.
