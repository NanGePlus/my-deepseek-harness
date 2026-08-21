/** Full-screen Mermaid diagram viewer with zoom and pan. */

import { useCallback, useEffect, useRef, useState } from 'react'
import type { WheelEvent as ReactWheelEvent } from 'react'
import { createPortal } from 'react-dom'
import {
  IconCloseOutline16,
  IconPlusOutline16,
  IconRefreshOutline16,
} from '../icons/index.tsx'
import css from './MermaidLightbox.module.css'

/** Localized toolbar labels for {@link MermaidLightbox}. */
export interface MermaidLightboxLabels {
  /** Zoom-in control. */
  zoomInLabel?: string | undefined
  /** Zoom-out control. */
  zoomOutLabel?: string | undefined
  /** Reset zoom and scroll position. */
  refreshLabel?: string | undefined
  /** Close the enlarged view. */
  closeLabel?: string | undefined
}

const ZOOM_STEP = 0.25
const ZOOM_MIN = 0.25
const ZOOM_MAX = 4

interface Pan {
  x: number
  y: number
}

interface PanDrag {
  startX: number
  startY: number
  panX: number
  panY: number
}

function clampScale(scale: number): number {
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, scale))
}

function IconMinusOutline16({ size = 16, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} className={className} viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M1.5 7.35H14.5V8.65H1.5V7.35Z" fill="currentColor" />
    </svg>
  )
}

/**
 * Render one enlarged Mermaid SVG with zoom controls.
 * @param props.svg - Rendered diagram markup.
 * @param props.onClose - Exit handler for the toolbar, mask, and Escape.
 * @param props.labels - Optional localized control labels.
 */
export function MermaidLightbox({
  svg,
  onClose,
  labels,
}: {
  svg: string
  onClose: () => void
  labels?: MermaidLightboxLabels | undefined
}) {
  const zoomInLabel = labels?.zoomInLabel ?? '放大'
  const zoomOutLabel = labels?.zoomOutLabel ?? '缩小'
  const refreshLabel = labels?.refreshLabel ?? '刷新'
  const closeLabel = labels?.closeLabel ?? '退出'
  const [scale, setScale] = useState(1)
  const [pan, setPan] = useState<Pan>({ x: 0, y: 0 })
  const [panning, setPanning] = useState(false)
  const viewportRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLDivElement>(null)
  const panDragRef = useRef<PanDrag | null>(null)
  const [natural, setNatural] = useState<{ w: number; h: number }>({ w: 0, h: 0 })

  const measure = useCallback(() => {
    const svgEl = canvasRef.current?.querySelector('svg')
    if (svgEl === null || svgEl === undefined) return
    const rect = svgEl.getBoundingClientRect()
    const width = rect.width > 0 ? rect.width : Number.parseFloat(svgEl.getAttribute('width') ?? '0')
    const height = rect.height > 0 ? rect.height : Number.parseFloat(svgEl.getAttribute('height') ?? '0')
    if (width > 0 && height > 0) setNatural({ w: width, h: height })
  }, [])

  useEffect(() => {
    measure()
  }, [svg, measure])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => { document.removeEventListener('keydown', onKeyDown) }
  }, [onClose])

  useEffect(() => {
    const finishPan = (): void => {
      panDragRef.current = null
      setPanning(false)
    }
    const onDocumentMove = (event: MouseEvent): void => {
      const drag = panDragRef.current
      if (drag === null) return
      setPan({
        x: drag.panX + (event.clientX - drag.startX),
        y: drag.panY + (event.clientY - drag.startY),
      })
    }
    document.addEventListener('mouseup', finishPan)
    document.addEventListener('mousemove', onDocumentMove)
    return () => {
      document.removeEventListener('mouseup', finishPan)
      document.removeEventListener('mousemove', onDocumentMove)
    }
  }, [])

  const zoomTo = useCallback((nextScale: number, anchorX?: number, anchorY?: number): void => {
    const clamped = clampScale(nextScale)
    if (clamped === scale) return
    const viewport = viewportRef.current
    if (viewport === null || anchorX === undefined || anchorY === undefined) {
      setScale(clamped)
      return
    }
    const rect = viewport.getBoundingClientRect()
    const px = anchorX - rect.left
    const py = anchorY - rect.top
    const ratio = clamped / scale
    setPan(current => ({
      x: px - (px - current.x) * ratio,
      y: py - (py - current.y) * ratio,
    }))
    setScale(clamped)
  }, [scale])

  const resetView = (): void => {
    setScale(1)
    setPan({ x: 0, y: 0 })
  }

  const zoomIn = (): void => { zoomTo(scale + ZOOM_STEP) }
  const zoomOut = (): void => { zoomTo(scale - ZOOM_STEP) }

  const onWheel = (event: ReactWheelEvent<HTMLDivElement>): void => {
    event.preventDefault()
    const delta = event.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP
    zoomTo(scale + delta, event.clientX, event.clientY)
  }

  const onMouseDown = (event: React.MouseEvent<HTMLDivElement>): void => {
    if (event.button !== 0) return
    event.preventDefault()
    panDragRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      panX: pan.x,
      panY: pan.y,
    }
    setPanning(true)
  }

  return createPortal((
    <div className={css.root} role="presentation">
      <div className={css.mask} aria-hidden="true" onClick={onClose} />
      <div className={css.panel} role="dialog" aria-modal="true" aria-label="Mermaid diagram">
        <div className={css.toolbar}>
          <button
            type="button"
            className={css.toolButton}
            aria-label={zoomInLabel}
            disabled={scale >= ZOOM_MAX}
            onClick={zoomIn}
          >
            <IconPlusOutline16 size={14} />
          </button>
          <button
            type="button"
            className={css.toolButton}
            aria-label={zoomOutLabel}
            disabled={scale <= ZOOM_MIN}
            onClick={zoomOut}
          >
            <IconMinusOutline16 size={14} />
          </button>
          <button type="button" className={css.toolButton} aria-label={refreshLabel} onClick={resetView}>
            <IconRefreshOutline16 size={14} />
          </button>
          <button type="button" className={css.toolButton} aria-label={closeLabel} onClick={onClose}>
            <IconCloseOutline16 size={14} />
          </button>
        </div>
        <div
          ref={viewportRef}
          className={panning ? css.viewportPanning : css.viewport}
          data-testid="mermaid-lightbox-viewport"
          onWheel={onWheel}
          onMouseDown={onMouseDown}
        >
          <div
            className={css.canvasHost}
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
              width: natural.w > 0 ? natural.w : undefined,
              height: natural.h > 0 ? natural.h : undefined,
            }}
          >
            <div
              ref={canvasRef}
              className={css.canvas}
              dangerouslySetInnerHTML={{ __html: svg }}
            />
          </div>
        </div>
      </div>
    </div>
  ), document.body)
}
