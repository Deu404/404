// 도구 단독 검증 스크립트. AI 연결 전에 각 도구를 예시 입력으로 실행해 출력을 확인한다.
// 실행: node src/verifyTools.ts  (server 폴더에서)
import {
  classify_anomaly,
  evaluate_priority,
  get_anomaly_case,
  get_executive_report_data,
  get_forecast_summary,
  get_inspection_guide,
} from './tools.ts'

function show(title: string, result: unknown) {
  console.log('\n========== ' + title + ' ==========')
  console.log(JSON.stringify(result, null, 2))
}

// 1) 단일 과전류 사례
show('get_anomaly_case(demo-overcurrent-001)', get_anomaly_case({ caseId: 'demo-overcurrent-001' }))
show('classify_anomaly(demo-overcurrent-001)', classify_anomaly({ caseId: 'demo-overcurrent-001' }))
show('evaluate_priority(demo-overcurrent-001)', evaluate_priority({ caseId: 'demo-overcurrent-001' }))

// 2) 복합 이상(과전류+불균형)
show('classify_anomaly(demo-multi-002)', classify_anomaly({ caseId: 'demo-multi-002' }))
show('evaluate_priority(demo-multi-002)', evaluate_priority({ caseId: 'demo-multi-002' }))

// 3) 측정 누락
show('classify_anomaly(demo-missing-003)', classify_anomaly({ caseId: 'demo-missing-003' }))
show('evaluate_priority(demo-missing-003)', evaluate_priority({ caseId: 'demo-missing-003' }))

// 4) 역률 저하 단일
show('classify_anomaly(demo-lowpf-004)', classify_anomaly({ caseId: 'demo-lowpf-004' }))

// 5) 가이드 조회(정상)
show('get_inspection_guide(overcurrent)', get_inspection_guide({ alertType: 'overcurrent' }))

// 6) 분기: 존재하지 않는 사례
show('get_anomaly_case(no-such-case)', get_anomaly_case({ caseId: 'no-such-case' }))

// 7) 분기: 잘못된 입력
show('classify_anomaly(빈 입력)', classify_anomaly({}))

// 8) 분기: 가이드 없는(= 유효하지 않은) 유형
show('get_inspection_guide(unknown-type)', get_inspection_guide({ alertType: 'unknown-type' }))

// 9) [신규] 5월 전기요금 및 탄소배출량 예측 요약 조회
show('get_forecast_summary()', get_forecast_summary())

// 10) [신규] 경영자용 종합 분석 리포트 데이터 조회
show('get_executive_report_data()', get_executive_report_data())

// 11) [신규] ML 탐지 모델 연계 사례(PM-3)
show('get_anomaly_case(demo-pm3-005)', get_anomaly_case({ caseId: 'demo-pm3-005' }))
