/** Right-side minimap for the Git diff preview scrollport. */

import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent, type ReactNode, type RefObject } from 'react'
import type { DiffPreviewRow } from './diff-preview-model.ts'
import { buildMinimapMarkers, type MinimapMarker } from './diff-minimap-model.ts'
import {
  DIFF_ROW_ATTR,
  scrollPreviewToMinimapMarker,
  scrollPreviewToMinimapTrackClick,
} from './diff-minimap-scroll.ts'
import css from './GitPanel.module.css'

export { DIFF_ROW_ATTR } from './diff-minimap-scroll.ts'

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
    if (scrollEl === null || trackEl === null) return
    scrollPreviewToMinimapTrackClick(scrollEl, trackEl, event.clientY)
  }

  const onMarkerClick = (event: MouseEvent<HTMLDivElement>, marker: MinimapMarker): void => {
    event.stopPropagation()
    const scrollEl = scrollRef.current
    if (scrollEl === null) return
    scrollPreviewToMinimapMarker(scrollEl, marker)
  }

  if (markers.length === 0) return null

  return (
    <div className={css.minimap} aria-hidden="true">
      <div className={css.minimapTrack} ref={trackRef} onClick={onTrackClick}>
        {markers.map((marker, index) => (
          <MinimapMarkerView
            key={index}
            marker={marker}
            onClick={(event) => { onMarkerClick(event, marker) }}
          />
        ))}
      </div>
    </div>
  )
}

function MinimapMarkerView({
  marker,
  onClick,
}: {
  marker: MinimapMarker
  onClick: (event: MouseEvent<HTMLDivElement>) => void
}): ReactNode {
  return (
    <div
      className={css.minimapMarkerAnchor}
      style={{ top: `${marker.topRatio * 100}%` }}
      onClick={onClick}
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
