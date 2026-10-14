# 이상치 탐지 — 팀원용 Random Forest 실행 패키지

현재 학습된 **RandomForest_all_fields_v4** 모델을 실행하는 데 필요한 코드·의존성과 실제 학습 및 검증 데이터를 묶었습니다. 이 폴더 전체를 복사하면 기존 `train` 작업 폴더 없이 사용할 수 있습니다.

13개 장비의 한 시점 데이터를 받아 검사합니다. 정상 데이터는 출력하지 않고, 이상일 때 **장비 이름과 의심 데이터 항목만 JSON으로 출력**합니다. 모델은 CPU에서 실행하며 GPU는 필요하지 않습니다.

## 1. 설치

Python **3.10** 환경에서 검증했습니다. 아래 명령은 이 폴더 안에서 실행합니다. 경로에 공백이 있으므로 이동할 때 따옴표를 사용합니다.

```bash
cd "이상치 탐지"
python3.10 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
```

Windows에서는 `py -3.10 -m venv .venv`로 만들고 `.venv\Scripts\activate`로 활성화합니다. 모델 호환성을 위해 `requirements.txt`의 라이브러리 버전을 유지하세요.

## 2. 즉시 실행

```bash
python scripts/stream_monitor.py --demo
```

13개 장비의 정상 관측에 오류 2건을 넣은 데모를 검사하며, 다음 두 줄만 출력합니다.

```json
{"equipment": "1(PM-3)", "fields": ["currentR"]}
{"equipment": "12(4호기)", "fields": ["voltageST"]}
```

같은 입력을 JSON Lines 파일로 실행할 수도 있습니다.

```bash
python scripts/stream_monitor.py --input examples/stream_input.jsonl
```

`examples/stream_input.jsonl`에는 13개 장비의 입력 156건이 들어 있습니다. 한 줄에 한 JSON 객체를 넣는 형식입니다.

## 3. 수신 프로그램에 연결

프로젝트 루트에서 다음처럼 불러옵니다. `EquipmentMonitor`는 프로그램 시작 때 한 번 생성하고, 데이터가 올 때마다 `check`를 호출하세요.

```python
import json
from scripts.stream_monitor import EquipmentMonitor

monitor = EquipmentMonitor()

def on_equipment_data(equipment_id, reading):
    notice = monitor.check(equipment_id, reading)
    if notice is not None:
        print(json.dumps(notice, ensure_ascii=False), flush=True)
```

- `equipment_id`: 장비 번호 또는 전체 장비 이름.
- `reading`: **한 장비의 한 시점 관측값 전체**를 담은 Python 사전.
- 정상 결과는 `None`, 이상 결과는 `{"equipment": "장비명", "fields": ["항목명"]}`입니다.
- 13개 장비가 번갈아 들어와도 장비별 최근 121개 관측을 독립적으로 유지합니다.
- 같은 오류가 지속되면 이상으로 판단된 관측마다 출력합니다.

CLI로 직접 데이터를 전달할 때의 형식은 다음과 같습니다. `reading` 자리에는 아래 표의 실제 관측값을 넣습니다. 완전한 예시는 `examples/stream_input.jsonl`을 확인하세요.

```python
message = {"equipment": 1, "data": reading}
```

```bash
python scripts/stream_monitor.py --input incoming.jsonl
python scripts/stream_monitor.py < incoming.jsonl
```

정상값·점수·처리 로그는 표준 출력에 섞이지 않습니다. 잘못된 JSON이나 미등록 장비처럼 검사할 수 없는 입력은 표준 오류로 기록하고 다음 입력을 계속 검사합니다.

## 4. 입력 데이터

| 구분 | 키 |
|---|---|
| 3상 전압 | voltageR, voltageS, voltageT |
| 선간전압 | voltageRS, voltageST, voltageTR |
| 전류 | currentR, currentS, currentT |
| 역률 | powerFactorR, powerFactorS, powerFactorT |
| 유효/무효전력 | activePower, reactivePowerLagging |
| 누적전력량 | accumActiveEnergy |
| 운전 상태 | operation |
| Unix 시간, 밀리초 | timestamp |
| 한국 시간 YYYYMMDDhhmmss | localtime |
| 장비 식별값 | module(equipment) |

`module(equipment)`를 생략하면 외부 `equipment_id`로 채웁니다. 명시한 식별값이 실제 연결 장비와 다르면 식별값 이상으로 검사합니다. 다른 필수 항목의 누락, `null`, 숫자가 아닌 값은 데이터 품질 특징으로 변환하여 검사합니다.

원래 관측 주기는 **5초**이며 데이터는 도착 순서대로 보냅니다. 중간 관측만 보내면 센서 고정 시간이나 누적전력량 변화 이력이 끊깁니다. 의도적으로 별도 시계열을 시작할 때 `monitor.reset(equipment_id)`로 이력을 초기화할 수 있습니다. 이력은 메모리에 있으므로 프로그램 재시작 시 새로 시작합니다.

등록 장비:

| 번호 | 장비 이름 |
|---:|---|
| 1 | 1(PM-3) |
| 2 | 2(L-1전등) |
| 3 | 3(분쇄기(2)) |
| 4 | 4(분쇄기(1)) |
| 5 | 5(좌측분전반) |
| 11 | 11(우측분전반1) |
| 12 | 12(4호기) |
| 13 | 13(3호기) |
| 14 | 14(2호기) |
| 15 | 15(예비건조기) |
| 16 | 16(호이스트) |
| 17 | 17(6호기) |
| 18 | 18(우측분전반2) |

다른 장비는 학습된 정상화 범위가 없으므로 추가 검증 없이 사용할 수 없습니다.

## 5. 포함된 데이터의 용도

| 폴더 | 내용 | 행 수 |
|---|---|---:|
| data/training_rows | 현재 분류기에 실제 입력한 78개 특징·정답·원본 행 번호, 13개 Parquet | 809,965 |
| data/full_coverage_v4/train | 학습 원본 13개 오류 포함 시계열 및 clean_reference 정상 참조 13개 | 각각 705,120 |
| data/full_coverage_v4/calibration | 임계값 보정용 오류 포함 시계열 및 정상 참조 | 각각 705,120 |
| data/full_coverage_v4/test | 최종 검증용 오류 포함 시계열 및 정상 참조 | 각각 705,120 |
| data/normalization_source | 정상 범위·전력량 변환 계수 산정에 사용한 기존 정상 자료의 2025-05-10~05-12 구간 | 673,920 |

실제 분류기 학습 행은 정상 **765,432행**, 오류 **44,533행**입니다. 원본의 센서 고정 초기 오류 5,543행은 정상 반복과 구분할 근거가 부족하여 학습 표본에서 제외했지만, 최종 평가에는 모두 포함했습니다.

각 장비·분할에 오류 이벤트 1,118개를 삽입했습니다. 학습/보정/검증 난수 시드는 `2026101411`/`2026101412`/`2026101413`이며 기간도 서로 겹치지 않습니다. 원본 Parquet의 측정 열은 `SENSOR_ERROR`, `nan`, `inf` 등을 보존하기 위해 문자열로 저장되어 있습니다.

`is_anomaly`, `anomaly_type`, `fault_fields`, `event_id`, `reference_localtime`은 정답/감사용 메타데이터이고 추론 입력에 사용하지 않습니다. `training_rows`는 표본 테이블이므로 연속 원본 데이터처럼 고정 시간을 다시 계산해서는 안 됩니다.

데이터를 읽는 예:

```python
import pyarrow.parquet as pq

table = pq.read_table("data/training_rows/01_PM-3.parquet")
print(table.num_rows, table.column_names)
```

## 6. 검증 실행

```bash
python scripts/verify_files.py
python scripts/evaluate.py --output-dir outputs/test_evaluation
```

평가 코드는 최종 검증의 13개 오류 포함 데이터와 13개 정상 참조를 검사합니다. `outputs/test_evaluation`이 이미 있으면 덮어쓰지 않으므로 다른 출력 경로를 지정합니다. 임계값 보정 데이터를 검사하려면 `--split calibration`을 추가합니다.

현재 모델의 최종 합성 검증 결과:

| 지표 | 결과 |
|---|---:|
| 검사 행 | 705,120 |
| 탐지 오류 / 실제 오류 | 55,482 / 60,996 |
| 정밀도 | 99.9946% |
| 재현율 | 90.9601% |
| F1 | 95.2636% |
| 정상 오탐 | 3행 |
| 오류 이벤트 탐지 | 14,532 / 14,534 |
| 센서 고정 탐지 지연 | 중앙값·최대값 모두 20초 |
| 별도 정상 참조 705,120행의 오탐 | 0행 |

미탐 5,514행 중 5,512행은 센서값 고정 초기 구간, 2행은 작은 상한 초과입니다. 출력 `fields`는 범위 이탈·누락·고정 등 관측된 근거에 해당하는 **의심 항목**입니다. 전력과 누적전력량의 불일치만 있으면 두 항목을 함께 표시하며, 원인 부품이나 실제 설비 고장을 확정하는 출력은 아닙니다.

원본과 오류는 합성 데이터입니다. 운전 상태 0/1의 의미와 정지 시 값, 누적전력량 변환 관계는 이 데이터의 가정을 따릅니다. 실제 설비 고장이나 가능한 모든 오류 조합을 보장하지 않습니다.

## 7. 폴더 구성

```text
이상치 탐지/
├── README.md                       팀원용 설치·실행·연결·데이터 안내
├── requirements.txt                검증된 라이브러리 버전
├── models/
│   ├── random_forest.joblib         현재 학습 모델, 정상화 정보 포함
│   └── model_info.json              모델 설정·특징·성능
├── scripts/
│   ├── stream_monitor.py           13개 장비의 한 건 검사, 이상 정보만 출력
│   ├── full_features.py            동일한 78개 특징 계산
│   ├── rf_common.py                최소 실행/검증 공통 함수
│   ├── evaluate.py                 포함한 검증 데이터 평가
│   └── verify_files.py             파일 SHA-256 확인
├── examples/stream_input.jsonl      13개 장비 실행 예제
├── data/
│   ├── training_rows/              실제 분류기 학습 입력
│   ├── normalization_source/       정상 범위 계산에 사용한 정상 구간
│   └── full_coverage_v4/
│       ├── train/                  학습 원본 + 정상 참조
│       ├── calibration/            임계값 보정 원본 + 정상 참조
│       ├── test/                   최종 검증 원본 + 정상 참조
│       ├── normalizers.json        사용한 정상화 정보
│       ├── manifest.json           시나리오·행 수·가정·파일 해시
│       └── verification.json       원본 데이터의 검증 기록
├── checksums.json                  이 패키지의 파일 무결성 목록
└── verification.json               복사 후 실행·성능·원본 보존 확인
```

모델을 이미 학습한 상태로 전달하므로 실행할 때 다시 학습할 필요가 없습니다. 모델과 실행에 필요한 파일을 함께 유지하세요.
