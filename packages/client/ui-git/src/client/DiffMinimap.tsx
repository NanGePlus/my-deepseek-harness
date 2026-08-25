/** Right-side minimap for the Git diff preview scrollport. */

import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent, type ReactNode, type RefObject } from 'react'
import type { DiffPreviewRow } from './diff-preview-model.ts'
import { buildMinimapMarkers, type MinimapMarker } from './diff-minimap-model.ts'
import css from './GitPanel.module.css'

/** Marker attribute on each minimap-tracked preview row element. */
export const DIFF_ROW_ATTR = 'data-diff-row'

/**
 * Render change markers beside the diff preview (red/green blocks only).
 * @param rows - flattened preview rows driving marker positions.
 * @param scrollRef - scrollport that click-to-scroll targets.
 */
export function DiffMinimap({
  rows,
  scrollRef,
}: {
  rows: readonly DiffPreviewRow[]
  scrollRef: RefObject<HTMLDivElement | null>
}): ReactNode {
  const trackRef = useRef<HTMLDivElement>(null)
  const [rowWeights, setRowWeights] = useState<number[] | undefined>()

  const measureRows = useCallback(() => {
    const scrollEl = scrollRef.current
    if (scrollEl === null) return
    const rowEls = scrollEl.querySelectorAll(`[${DIFF_ROW_ATTR}]`)
    if (rowEls.length === 0) {
      setRowWeights(undefined)
      return
    }
    setRowWeights(Array.from(rowEls, el => el.getBoundingClientRect().height))
  }, [scrollRef])

  useEffect(() => {
    let outerFrame = 0
    let innerFrame = 0
    outerFrame = requestAnimationFrame(() => {
      innerFrame = requestAnimationFrame(measureRows)
    })
    const scrollEl = scrollRef.current
    if (scrollEl === null) {
      return () => {
        cancelAnimationFrame(outerFrame)
        cancelAnimationFrame(innerFrame)
      }
    }
    if (typeof ResizeObserver === 'undefined') return () => {
      cancelAnimationFrame(outerFrame)
      cancelAnimationFrame(innerFrame)
    }
    const observer = new ResizeObserver(measureRows)
    observer.observe(scrollEl)
    for (const el of scrollEl.querySelectorAll(`[${DIFF_ROW_ATTR}]`)) {
      observer.observe(el)
    }
    return () => {
      cancelAnimationFrame(outerFrame)
      cancelAnimationFrame(innerFrame)
      observer.disconnect()
    }
  }, [measureRows, rows, scrollRef])

  const markers = useMemo(
    () => buildMinimapMarkers(rows, rowWeights),
    [rows, rowWeights],
  )

  const onTrackClick = (event: MouseEvent<HTMLDivElement>): void => {
    const scrollEl = scrollRef.current
    const trackEl = trackRef.current
    if (scrollEl === null || trackEl === null || trackEl.clientHeight <= 0) return
    const ratio = event.nativeEvent.offsetY / trackEl.clientHeight
    scrollEl.scrollTop = ratio * scrollEl.scrollHeight
  }

  if (markers.length === 0) return null

  return (
    <div className={css.minimap} aria-hidden="true">
      <div className={css.minimapTrack} ref={trackRef} onClick={onTrackClick}>
        {markers.map((marker, index) => (
          <MinimapMarkerView key={index} marker={marker} />
        ))}
      </div>
    </div>
  )
}

function MinimapMarkerView({ marker }: { marker: MinimapMarker }): ReactNode {
  return (
    <div
      className={css.minimapMarkerAnchor}
      style={{ top: `${marker.topRatio * 100}%` }}
    >
      {marker.del && marker.add
        ? (
          <div className={css.minimapMarkerPair}>
            <div className={css.minimapDel} />
            <div className={css.minimapAdd} />
          </div>
        )
        : marker.del
          ? <div className={css.minimapDel} />
          : <div className={css.minimapAdd} />}
    </div>
  )
}
