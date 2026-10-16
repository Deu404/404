import { AgentPanel } from './AgentPanel'
import type { AnomalyDetection } from '../../types/anomaly'
import { useEffect, useRef, useState } from 'react'
import type { CSSProperties, KeyboardEvent, PointerEvent } from 'react'

type Props = {
  anomaly?: AnomalyDetection
  expanded: boolean
  onToggle: () => void
  onExpand: () => void
}

export function AgentDock({ anomaly, expanded, onToggle, onExpand }: Props) {
  const dockRef = useRef<HTMLElement>(null)
  const drag = useRef<{ pointerId: number; y: number; height: number } | null>(null)
  const [viewportHeight, setViewportHeight] = useState(() => typeof window === 'undefined' ? 900 : window.innerHeight)
  const maxHeight = Math.max(180, viewportHeight - 48)
  const minHeight = Math.min(300, maxHeight)
  const [height, setHeight] = useState(() => Math.min(680, viewportHeight * 0.68))
  const [resizing, setResizing] = useState(false)
  const clampedHeight = Math.max(minHeight, Math.min(maxHeight, height))

  useEffect(() => {
    const onResize = () => setViewportHeight(window.innerHeight)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    const dock = dockRef.current
    const page = dock?.closest<HTMLElement>('.alerts-page')
    if (!dock || !page) return
    const observer = new ResizeObserver(() => page.style.setProperty('--agent-dock-space', `${dock.getBoundingClientRect().height + 32}px`))
    observer.observe(dock)
    return () => { observer.disconnect(); page.style.removeProperty('--agent-dock-space') }
  }, [])

  function startResize(event: PointerEvent<HTMLDivElement>) {
    if (!event.isPrimary || event.button !== 0) return
    event.preventDefault()
    event.currentTarget.focus()
    event.currentTarget.setPointerCapture(event.pointerId)
    drag.current = { pointerId: event.pointerId, y: event.clientY, height: expanded ? clampedHeight : dockRef.current?.getBoundingClientRect().height ?? minHeight }
    setResizing(true)
  }
  function resize(event: PointerEvent<HTMLDivElement>) {
    const start = drag.current
    if (!start || start.pointerId !== event.pointerId) return
    const delta = start.y - event.clientY
    if (Math.abs(delta) < 4) return
    if (!expanded && delta <= 0) return
    setHeight(Math.max(minHeight, Math.min(maxHeight, start.height + delta)))
    onExpand()
  }
  function endResize(event: PointerEvent<HTMLDivElement>) {
    if (drag.current?.pointerId !== event.pointerId) return
    drag.current = null
    setResizing(false)
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
  }
  function resizeWithKeyboard(event: KeyboardEvent<HTMLDivElement>) {
    const next = event.key === 'ArrowUp' ? clampedHeight + 40 : event.key === 'ArrowDown' ? clampedHeight - 40 : event.key === 'Home' ? minHeight : event.key === 'End' ? maxHeight : undefined
    if (next === undefined) return
    event.preventDefault()
    setHeight(Math.max(minHeight, Math.min(maxHeight, next)))
    onExpand()
  }

  return <section ref={dockRef} id="selected-inspection" className={`agent-dock ${expanded ? 'expanded' : 'collapsed'} ${resizing ? 'resizing' : ''}`} style={{ '--agent-dock-height': `${clampedHeight}px` } as CSSProperties} aria-label="고정 AI 점검 창">
    <div className="agent-dock-resize" hidden={!expanded} role="separator" tabIndex={expanded ? 0 : -1} aria-label="AI 점검 창 높이 조절" aria-orientation="horizontal" aria-controls="agent-dock-content" aria-valuemin={minHeight} aria-valuemax={maxHeight} aria-valuenow={Math.round(clampedHeight)} aria-valuetext={`펼친 창 높이 ${Math.round(clampedHeight)}픽셀`} title="위아래로 끌어 높이를 조절하세요. 키보드 위·아래 방향키로도 조절할 수 있습니다."
      onPointerDown={startResize} onPointerMove={resize} onPointerUp={endResize} onPointerCancel={endResize} onLostPointerCapture={() => { drag.current = null; setResizing(false) }} onKeyDown={resizeWithKeyboard}>
      <span aria-hidden="true" />
    </div>
    <button type="button" className="agent-dock-toggle" aria-expanded={expanded} aria-controls="agent-dock-content" aria-label={expanded ? 'AI 점검 안내 접기' : 'AI 점검 안내 펼치기'} onClick={onToggle}>
      <span className="agent-dock-toggle-label"><span aria-hidden="true">{expanded ? '⌄' : '⌃'}</span>{expanded ? '접기' : '펼치기'}</span>
    </button>
    <div id="agent-dock-content">
      <AgentPanel key={anomaly?.id ?? 'no-anomaly'} anomaly={anomaly} collapsed={!expanded} onExpand={onExpand}
        composerContext={<><strong>AI 점검 안내</strong><span title={anomaly ? `${anomaly.equipmentName} · ${anomaly.occurredAt}` : undefined}>{anomaly ? `${anomaly.equipmentName} · ${anomaly.occurredAt}` : '확인할 알림을 선택하세요'}</span></>} />
    </div>
  </section>
}
