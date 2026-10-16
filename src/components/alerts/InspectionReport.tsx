import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { Decision } from '../../shared/decision'
import { reportText } from '../../shared/decision'

type Props = { decision: Decision; fields?: readonly string[]; onClose: () => void }
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!)

export function InspectionReport({ decision, fields, onClose }: Props) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [preview, setPreview] = useState(false)
  const [title, setTitle] = useState(`${decision.equipmentName} 점검 보고서`)
  const [analysis, setAnalysis] = useState(() => reportText(decision))
  const [owner, setOwner] = useState('')
  const [inspectedAt, setInspectedAt] = useState('')
  const [finding, setFinding] = useState('')
  const [action, setAction] = useState('')
  const [followUp, setFollowUp] = useState('')
  const [exportError, setExportError] = useState('')
  const [createdAt] = useState(() => new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }))

  useEffect(() => {
    const element = dialog.current
    element?.showModal()
    return () => element?.close()
  }, [])

  const sections = [
    ['설비', `${decision.equipmentName} (${decision.equipmentId})`],
    ['알림 발생 시각', decision.observedAt], ['알림 ID', decision.inputId],
    ['의심 항목', fields?.join(', ') || decision.anomalyTypes.join(', ') || '확인 필요'],
    ['자료 출처', `${decision.source} · 기준 버전 ${decision.ruleVersion}${decision.demoOnly ? ' · 연습용 자료' : ''}`],
    ['작성 시각', `${createdAt} (한국 시간)`], ['담당자', owner || '미입력'],
    ['현장 점검 일시', inspectedAt.replace('T', ' ') || '미입력'],
    ['분석 및 권장 점검 초안', analysis || '미입력'],
    ['현장 확인 결과', finding || '미확인'], ['실제 조치 내용', action || '미확인'],
    ['후속 점검 및 전달 사항', followUp || '미입력'],
  ]

  async function exportPdf() {
    setExportError('')
    const frame = document.createElement('iframe')
    frame.title = '점검 보고서 인쇄'
    frame.style.cssText = 'position:fixed;left:-10000px;top:0;width:800px;height:1000px;border:0'
    document.body.append(frame)
    const printWindow = frame.contentWindow
    if (!printWindow) { frame.remove(); setExportError('인쇄 창을 열지 못했습니다. 다시 시도해 주세요.'); return }
    const cleanup = () => frame.remove()
    printWindow.addEventListener('afterprint', cleanup, { once: true })
    try {
      printWindow.document.open()
      printWindow.document.write(`<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>${escapeHtml(title || '점검 보고서')}</title><style>@page{size:A4;margin:18mm}body{font-family:'Malgun Gothic',sans-serif;color:#172033;font-size:11pt;line-height:1.65}h1{font-size:21pt;border-bottom:2px solid #258e7d;padding-bottom:12px}section{margin:16px 0;break-inside:avoid}h2{font-size:11pt;color:#52627f;margin:0 0 5px}p{margin:0;white-space:pre-wrap;overflow-wrap:anywhere}.note{font-size:9pt;color:#64738a;margin-top:24px}</style></head><body><h1>${escapeHtml(title || '점검 보고서')}</h1>${sections.map(([label, text]) => `<section><h2>${escapeHtml(label)}</h2><p>${escapeHtml(text)}</p></section>`).join('')}<p class="note">자동 작성한 분석 초안과 사용자가 입력한 현장 기록입니다. 모델의 이상 의심 결과만으로 실제 고장을 확정하지 않습니다.</p></body></html>`)
      printWindow.document.close()
      await printWindow.document.fonts.ready
      printWindow.focus()
      printWindow.print()
    } catch {
      cleanup()
      setExportError('PDF 저장 창을 열지 못했습니다. 브라우저에서 다시 시도해 주세요.')
    }
    // Some browsers do not dispatch afterprint when the print dialog is cancelled.
    window.setTimeout(cleanup, 120_000)
  }

  return createPortal(<dialog ref={dialog} className="inspection-report-dialog" aria-labelledby="inspection-report-title" onCancel={event => { event.preventDefault(); onClose() }}>
    <header className="inspection-report-header"><div><p className="eyebrow">INSPECTION REPORT</p><h2 id="inspection-report-title">점검 보고서 작성</h2><p>{decision.equipmentName} · {decision.observedAt}</p></div><button type="button" onClick={onClose}>닫기</button></header>
    <div className="inspection-report-tools"><button type="button" aria-pressed={!preview} onClick={() => setPreview(false)}>내용 작성</button><button type="button" aria-pressed={preview} onClick={() => setPreview(true)}>미리보기</button><button type="button" className="report-export" onClick={() => void exportPdf()}>PDF 저장 / 인쇄</button></div>
    <div className="inspection-report-content">
      <p className="inspection-report-help">PDF 저장 / 인쇄를 누른 뒤 인쇄 대상에서 ‘PDF로 저장’을 선택하세요. 작성 내용은 이 창을 닫으면 사라지므로 먼저 내보내 주세요.</p>
      {exportError && <p role="alert" className="agent-error">{exportError}</p>}
      {preview ? <article className="inspection-report-preview"><h1>{title || '점검 보고서'}</h1>{sections.map(([label, text]) => <section key={label}><h3>{label}</h3><p>{text}</p></section>)}<p className="inspection-report-help">모델의 이상 의심 결과만으로 실제 고장을 확정하지 않습니다.</p></article> : <div className="inspection-report-form">
        <label className="report-wide">보고서 제목<input value={title} onChange={event => setTitle(event.target.value)} /></label>
        <label>담당자<input value={owner} onChange={event => setOwner(event.target.value)} placeholder="담당자 이름" /></label>
        <label>현장 점검 일시<input type="datetime-local" value={inspectedAt} onChange={event => setInspectedAt(event.target.value)} /></label>
        <label className="report-wide">분석 및 권장 점검 초안<textarea rows={10} value={analysis} onChange={event => setAnalysis(event.target.value)} /></label>
        <label className="report-wide">현장 확인 결과<textarea rows={3} value={finding} onChange={event => setFinding(event.target.value)} placeholder="직접 확인한 증상과 측정값을 입력하세요." /></label>
        <label className="report-wide">실제 조치 내용<textarea rows={3} value={action} onChange={event => setAction(event.target.value)} placeholder="실제로 수행한 조치만 입력하세요." /></label>
        <label className="report-wide">후속 점검 및 전달 사항<textarea rows={3} value={followUp} onChange={event => setFollowUp(event.target.value)} /></label>
      </div>}
    </div>
  </dialog>, document.body)
}
