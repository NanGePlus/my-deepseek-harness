/** Right-side minimap for the Git diff preview scrollport. */

import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent, type ReactNode, type RefObject } from 'react'
import type { DiffPreviewRow } from './diff-preview-model.ts'
import { buildMinimapBuckets, type MinimapTone } from './diff-minimap-model.ts'
import css from './GitPanel.module.css'

/**
 * Render a VS Code-style minimap beside the diff preview.
 * @param rows - flattened preview rows driving line colors.
 * @param scrollRef - scrollport whose position the minimap mirrors.
 */
export function DiffMinimap({
  rows,
  scrollRef,
}: {
  rows: readonly DiffPreviewRow[]
  scrollRef: RefObject<HTMLDivElement | null>
}): ReactNode {
  const trackRef = useRef<HTMLDivElement>(null)
  const [viewport, setViewport] = useState({ topRatio: 0, heightRatio: 1 })
  const buckets = useMemo(() => buildMinimapBuckets(rows), [rows])

  const syncViewport = useCallback(() => {
    const scrollEl = scrollRef.current
    if (scrollEl === null || scrollEl.scrollHeight <= 0) {
      setViewport({ topRatio: 0, heightRatio: 1 })
      return
    }
    setViewport({
      topRatio: scrollEl.scrollTop / scrollEl.scrollHeight,
      heightRatio: Math.min(1, scrollEl.clientHeight / scrollEl.scrollHeight),
    })
  }, [scrollRef])

  useEffect(() => {
    const scrollEl = scrollRef.current
    if (scrollEl === null) return undefined
    syncViewport()
    scrollEl.addEventListener('scroll', syncViewport, { passive: true })
    if (typeof ResizeObserver === 'undefined') {
      return () => {
        scrollEl.removeEventListener('scroll', syncViewport)
      }
    }
    const observer = new ResizeObserver(syncViewport)
    observer.observe(scrollEl)
    return () => {
      scrollEl.removeEventListener('scroll', syncViewport)
      observer.disconnect()
    }
  }, [scrollRef, syncViewport, rows])

  const onTrackClick = (event: MouseEvent<HTMLDivElement>): void => {
    const scrollEl = scrollRef.current
    const trackEl = trackRef.current
    if (scrollEl === null || trackEl === null || trackEl.clientHeight <= 0) return
    const ratio = event.nativeEvent.offsetY / trackEl.clientHeight
    scrollEl.scrollTop = ratio * scrollEl.scrollHeight
  }

  if (buckets.length === 0) return null

  return (
    <div className={css.minimap} aria-hidden="true">
      <div className={css.minimapTrack} ref={trackRef} onClick={onTrackClick}>
        {buckets.map((tone, index) => (
          <div
            key={index}
            className={minimapToneClass(tone)}
          />
        ))}
        <div
          className={css.minimapViewport}
          style={{
            top: `${viewport.topRatio * 100}%`,
            height: `${viewport.heightRatio * 100}%`,
          }}
        />
      </div>
    </div>
  )
}

function minimapToneClass(tone: MinimapTone): string {
  switch (tone) {
    case 'header':
      return css.minimapHeader
    case 'add':
      return css.minimapAdd
    case 'del':
      return css.minimapDel
    case 'truncated':
      return css.minimapTruncated
    case 'context':
      return css.minimapContext
  }
}
