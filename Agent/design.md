# PlantEye 에이전트 설계 (B안 최종본)

기준: `step1-design.md` ~ `step5-feedback.md`. 이 문서는 Spec의 Design에 해당한다.
스택: React 대시보드(`404-main`) + TypeScript 백엔드 서버. OpenAI function calling.
상태: 설계 확정. 코드는 STEP 6-2에서 작성한다.

## 구조와 역할

신입·경력 작업자를 모두 주 사용자로 둔다. 같은 판단 결과를 공통 요약과 펼칠 수 있는 상세로 제공하며, 경력에 따라 우선순위나 사실을 바꾸지 않는다.

```
React 알림 화면(/alerts) → "AI 점검 안내" 패널
     │  POST /api/agent { message, caseId, conversationId? }
     ▼
TypeScript 백엔드 서버
     │  OpenAI(LLM) ↔ 도구 실행 루프
     │  도구: get_anomaly_case / classify_anomaly / evaluate_priority / get_inspection_guide
     ▼
구조화된 응답 { status, reply, evidence, steps, reportConditions, missingFields, dataSource, demoOnly, toolTrace }
     → React 결과 영역(요약 + 상세: 확인된 값/미확인·보류 + 근거 보기)
```

- 서버: 데이터 접근, 계산, 규칙 판단, API 키 관리, 대화 기록 관리.
- LLM: 요청 해석, 도구 선택, 결과 설명. 수치 계산·우선순위 판단은 하지 않는다.
- 도구·규칙 로직은 기존 TypeScript 서비스(`alertRules.ts` 등)와 같은 언어라 공유·재사용한다.
- API 키는 서버 환경변수에만 둔다. 브라우저(React)·`VITE_` 변수·GitHub에 넣지 않는다.

## 도구 4개 (step2-tools.md 요약)

| 도구 | 입력 | 출력 요지 | 쓰는 상황 |
| --- | --- | --- | --- |
| get_anomaly_case | caseId | 설비·측정 시각·측정값·단위·비교 기준·누락 항목 | 측정값 확인(보통 먼저) |
| classify_anomaly | caseId | 유형별 matched/within_threshold/insufficient_data·근거·규칙 | 어떤 이상인지 |
| evaluate_priority | caseId | 확인 유형별 우선순위·근거, 미평가 유형 | 우선순위·대응 수준 |
| get_inspection_guide | alertType | 초기 대응·점검 순서·보고 조건·출처 | 점검·보고 안내(유형마다) |

공통 반환: `status`(ok/partial/insufficient_data/not_found/invalid_input/error), `caseVersion`, `ruleVersion`, `dataSource:'synthetic'`, `demoOnly:true`, `missingFields`, `message`. 상세 입출력 스키마는 `step2-tools.md`.

- 원본 수 GB CSV는 LLM에 전달하지 않는다. 도구는 요약된 사례·평가·가이드만 반환한다.
- 도구는 입력(caseId, alertType)을 검증한다. 판단 도구는 서버 저장소의 사례와 버전 규칙을 직접 읽고, LLM이 넘긴 측정값을 신뢰하지 않는다.
- 데모 우선순위: 과전류·상간 불균형 = high, 역률 저하·전력 소비 증가 = medium. 조건 미일치·데이터 부족은 low로 처리하지 않는다.

## 기존 코드 활용과 보완

- `src/services/alertRules.ts`: DEMO_ALERT_RULES 임계치(100 A / 0.85 / 10 % / 10 %)를 데모 규칙으로 재사용. 단 `classifyAlert`는 단일 유형·`change` 기반이라, 사례 기반 다유형 평가 함수를 새로 만들고 임계치만 공유한다.
- `src/services/guideService.ts`, `src/mocks/mockGuides.ts`: 4개 가이드 재사용. 단 `resolveGuide`의 기본 가이드 fallback은 쓰지 않는다(없는 유형을 기본값으로 대체 금지). `getGuideByKey`/`getGuidesByAlertType`만 쓴다.
- `src/types/alert.ts`, `src/types/guide.ts`: `AlertType`·유형 키·가이드 필드명을 그대로 공유. 에이전트 결과는 별도 타입으로 두고 `Alert`를 덮어쓰지 않는다.
- 설비 식별자: 실제 `1(PM-3)`와 목업 `motor-02`를 추측으로 연결하지 않는다. 데모 사례는 자체 ID를 쓴다.
- 역률 원본 %표현 ↔ 내부 0~1 표현 변환 근거를 사례에 기록한다. `activePower`(kW)·`localtime` 시간대도 사례에 명시한다.

## 실행 흐름과 분기 (step4-flow-ui.md 요약)

사용자 요청(+caseId) → LLM 도구 선택 → 서버 도구 실행 → 결과 재전달 → 추가 호출 또는 최종 응답.

- 대표 요청 ① 어떤 이상인지: get_anomaly_case → classify_anomaly.
- 대표 요청 ② 우선순위·근거: (맥락 재사용) → evaluate_priority.
- 대표 요청 ③ 점검·보고: classify 후 matched 유형마다 get_inspection_guide.
- 종합("한 번에 다 알려줘"): ①→②→③을 한 답변 요약으로. 도구 선택은 LLM이 하되, 데모 안정성을 위해 보조 순서를 쓰면 toolTrace에 투명 표기.

분기: 사례 not_found(대체 금지, 재확인) / 측정 전부 누락(판정 보류) / 모두 within_threshold(이상 미확인, 안전 보증 아님) / 일부 미평가(구분 표시) / 가이드 없음(절차 생성 금지, 미등록 안내).

호출 한도와 요청 시간 제한을 둔다. 초과 시 부분 확인 사항과 미완료 상태를 반환한다.

## 시스템 프롬프트

`step3-prompt.md`의 "시스템 프롬프트 본문"을 서버가 읽는 `prompt` 파일로 저장한다(STEP 6-2 ②). 핵심: 도구 선택·설명만, 숫자는 도구 결과만+단위+근거, 데이터 없음은 "확인할 수 없다", 고장 단정 금지, 점검은 등록 가이드 내에서만, demoOnly 유지, 3줄 요약 후 "확인된 값/미확인·보류" 분리 상세.

## 화면 계약 (화면 담당자 전달용)

API와 필드는 STEP 6-2에서 구현한다. 샘플은 목업으로 표시한다.

요청: `POST /api/agent` { message, caseId, conversationId? }. 시각은 시간대 포함 ISO.

응답 필드:

| 필드 | 의미 |
| --- | --- |
| status | ok / partial / insufficient_data / not_found / error |
| conversationId | 대화 식별자(서버가 발급·유지) |
| reply.summary / reply.detail | 3줄 요약 / 상세(확인된 값·미확인·보류 포함) |
| evidence | 도구가 확인한 값·단위·시각·규칙 근거 |
| steps / reportConditions | 조회된 가이드 기반 안내(있을 때) |
| missingFields | 미확인 데이터 |
| dataSource / demoOnly | 목업·실데이터 구분 |
| toolTrace | 호출 도구 이름·성공 여부·조회 대상 요약(키·원본 로그 제외). "근거 보기"로 사람이 읽게 노출 |

기존 `/alerts` 선택 알림 상세 패널에 "AI 점검 안내" 버튼·결과 영역을 추가한다. 추천 질문 버튼 4개(⭐종합 + ①②③), 로딩·실패·데이터 부족 상태 제공. 샘플 JSON 표시와 실제 실행을 구분한다.

## 신뢰도와 키 관리

- API 키는 서버 전용 비밀 설정에서만 읽는다.
- LLM 응답을 서버에서 검증한다. priority·evidence는 도구가 확인한 값으로 구성하고, 가이드 항목은 조회된 항목과 대조한다.
- API 실패 시 규칙·가이드 결과만 보여줄 수 있으나 AI 성공 응답처럼 표시하지 않는다.
