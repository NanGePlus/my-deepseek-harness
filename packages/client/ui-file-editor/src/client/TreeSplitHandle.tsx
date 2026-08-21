/** Draggable split between the file tree and editor pane. */

import { useCallback, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import css from './EditorSurface.module.css'

/** Props for the tree/editor split drag handle. */
export interface TreeSplitHandleProps {
  /** Accessible name for the resize control. */
  ariaLabel: string
  /** Invoked once when a drag starts. */
  onStart: () => void
  /**
   * Invoked with horizontal delta from the drag origin.
   * @param dx - pointer delta in pixels.
   */
  onDrag: (dx: number) => void
  /** Invoked when the drag ends. */
  onEnd: () => void
}

/**
 * Pointer-captured column resize handle between file tree and editor pane.
 * @param props - drag callbacks and accessible label.
 */
export function TreeSplitHandle({ ariaLabel, onStart, onDrag, onEnd }: TreeSplitHandleProps) {
  const [dragging, setDragging] = useState(false)
  const origin = useRef(0)
  const latest = useRef(0)
  const frame = useRef<number | null>(null)
  const callbacks = useRef({ onStart, onDrag, onEnd })
  callbacks.current = { onStart, onDrag, onEnd }

  const onPointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    origin.current = event.clientX
    latest.current = event.clientX
    callbacks.current.onStart()
    setDragging(true)
  }, [])

  const onPointerMove = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return
    latest.current = event.clientX
    frame.current ??= requestAnimationFrame(() => {
      frame.current = null
      callbacks.current.onDrag(latest.current - origin.current)
    })
  }, [])

  const onPointerUp = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return
    event.currentTarget.releasePointerCapture(event.pointerId)
    if (frame.current !== null) {
      cancelAnimationFrame(frame.current)
      frame.current = null
    }
    callbacks.current.onDrag(latest.current - origin.current)
    setDragging(false)
    callbacks.current.onEnd()
  }, [])

  return (
    <div
      className={css.splitHandle}
      role="separator"
      aria-orientation="vertical"
      aria-label={ariaLabel}
      data-dragging={dragging || undefined}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    />
  )
}
