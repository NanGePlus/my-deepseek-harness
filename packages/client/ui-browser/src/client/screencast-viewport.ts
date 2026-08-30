/** JPEG screencast canvas with pointer and keyboard forwarding hooks. */

/** Pointer event forwarded to Host browserSendPointer. */
export interface ScreencastPointerEvent {
  type: 'mousePressed' | 'mouseReleased' | 'mouseMoved'
  x: number
  y: number
  button?: 'left' | 'right' | 'middle'
}

/** Keyboard event forwarded to Host browserSendKeyboard. */
export interface ScreencastKeyboardEvent {
  type: 'keyDown' | 'keyUp' | 'char'
  key?: string
  text?: string
}

/** Options for one screencast viewport instance. */
export interface ScreencastViewportOptions {
  zoom: number
  onPointer: (event: ScreencastPointerEvent) => void
  onKeyboard: (event: ScreencastKeyboardEvent) => void
}

/** One decoded screencast frame. */
export interface ScreencastFramePayload {
  data: string
  width: number
  height: number
}

/** Imperative screencast viewport handle. */
export interface ScreencastViewportHandle {
  attach(host: HTMLElement): void
  dispose(): void
  setZoom(zoom: number): void
  setFrame(frame: ScreencastFramePayload | null): void
  focus(): void
  getContentSize(): { width: number; height: number } | null
}

/** Map a DOM mouse button index to the Host pointer button name. */
function pointerButton(button: number): 'left' | 'right' | 'middle' | undefined {
  if (button === 0) return 'left'
  if (button === 1) return 'middle'
  if (button === 2) return 'right'
  return undefined
}

/** Map viewport coordinates to Host page coordinates accounting for CSS zoom. */
function mapPointerCoordinates(
  event: MouseEvent,
  stage: HTMLElement,
  zoom: number,
  frame: ScreencastFramePayload | null,
): { x: number; y: number } | null {
  const rect = stage.getBoundingClientRect()
  if (rect.width <= 0 || rect.height <= 0) return null
  const localX = event.clientX - rect.left
  const localY = event.clientY - rect.top
  const contentWidth = frame?.width ?? rect.width / zoom
  const contentHeight = frame?.height ?? rect.height / zoom
  const x = Math.round((localX / rect.width) * contentWidth)
  const y = Math.round((localY / rect.height) * contentHeight)
  return { x, y }
}

/**
 * Create one screencast viewport that paints JPEG frames and forwards input.
 * @param options - zoom ratio and Host callback bridges.
 * @returns an imperative viewport handle.
 */
export function createScreencastViewport(options: ScreencastViewportOptions): ScreencastViewportHandle {
  let host: HTMLElement | null = null
  let stage: HTMLDivElement | null = null
  let image: HTMLImageElement | null = null
  let zoom = options.zoom
  let frame: ScreencastFramePayload | null = null

  const onMouseDown = (event: MouseEvent): void => {
    /* v8 ignore next -- listeners detach before stage is nulled on dispose. */
    if (stage === null) return
    const coords = mapPointerCoordinates(event, stage, zoom, frame)
    if (coords === null) return
    event.preventDefault()
    const button = pointerButton(event.button)
    options.onPointer({
      type: 'mousePressed',
      x: coords.x,
      y: coords.y,
      /* v8 ignore next -- non-standard mouse buttons omit the Host button field. */
      ...(button === undefined ? {} : { button }),
    })
  }

  const onMouseUp = (event: MouseEvent): void => {
    /* v8 ignore next -- listeners detach before stage is nulled on dispose. */
    if (stage === null) return
    const coords = mapPointerCoordinates(event, stage, zoom, frame)
    if (coords === null) return
    event.preventDefault()
    const button = pointerButton(event.button)
    options.onPointer({
      type: 'mouseReleased',
      x: coords.x,
      y: coords.y,
      /* v8 ignore next -- non-standard mouse buttons omit the Host button field. */
      ...(button === undefined ? {} : { button }),
    })
  }

  const onMouseMove = (event: MouseEvent): void => {
    /* v8 ignore next -- listeners detach before stage is nulled on dispose. */
    if (stage === null) return
    const coords = mapPointerCoordinates(event, stage, zoom, frame)
    if (coords === null) return
    options.onPointer({
      type: 'mouseMoved',
      x: coords.x,
      y: coords.y,
    })
  }

  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      options.onKeyboard({ type: 'char', text: event.key })
      event.preventDefault()
      return
    }
    options.onKeyboard({ type: 'keyDown', key: event.key })
    event.preventDefault()
  }

  const onKeyUp = (event: KeyboardEvent): void => {
    options.onKeyboard({ type: 'keyUp', key: event.key })
    event.preventDefault()
  }

  const ensureDom = (): void => {
    if (host === null || stage !== null) return
    stage = document.createElement('div')
    stage.tabIndex = 0
    stage.style.width = '100%'
    stage.style.height = '100%'
    stage.style.outline = 'none'
    stage.style.overflow = 'auto'
    stage.style.display = 'grid'
    stage.style.placeItems = 'start center'
    image = document.createElement('img')
    image.alt = ''
    image.draggable = false
    image.style.display = 'block'
    image.style.maxWidth = 'none'
    image.style.transformOrigin = 'top left'
    stage.appendChild(image)
    stage.addEventListener('mousedown', onMouseDown)
    stage.addEventListener('mouseup', onMouseUp)
    stage.addEventListener('mousemove', onMouseMove)
    stage.addEventListener('keydown', onKeyDown)
    stage.addEventListener('keyup', onKeyUp)
    host.appendChild(stage)
    applyFrame()
    applyZoom()
  }

  const applyZoom = (): void => {
    /* v8 ignore next -- applyZoom runs only after ensureDom creates the image node. */
    if (image === null) return
    image.style.transform = zoom === 1 ? '' : `scale(${zoom})`
  }

  const applyFrame = (): void => {
    /* v8 ignore next -- applyFrame runs only after ensureDom creates the image node. */
    if (image === null) return
    if (frame === null) {
      image.removeAttribute('src')
      image.style.width = ''
      image.style.height = ''
      return
    }
    image.src = `data:image/jpeg;base64,${frame.data}`
    image.style.width = `${frame.width}px`
    image.style.height = `${frame.height}px`
  }

  return {
    attach(nextHost) {
      if (host === nextHost) {
        ensureDom()
        return
      }
      this.dispose()
      host = nextHost
      ensureDom()
    },
    dispose() {
      if (stage !== null) {
        stage.removeEventListener('mousedown', onMouseDown)
        stage.removeEventListener('mouseup', onMouseUp)
        stage.removeEventListener('mousemove', onMouseMove)
        stage.removeEventListener('keydown', onKeyDown)
        stage.removeEventListener('keyup', onKeyUp)
        stage.remove()
      }
      stage = null
      image = null
      host = null
    },
    setZoom(nextZoom) {
      zoom = nextZoom
      applyZoom()
    },
    setFrame(nextFrame) {
      frame = nextFrame
      applyFrame()
    },
    focus() {
      stage?.focus()
    },
    getContentSize() {
      if (frame !== null) return { width: frame.width, height: frame.height }
      /* v8 ignore next -- getContentSize runs only while the stage is attached. */
      if (stage === null) return null
      const width = Math.floor(stage.clientWidth / zoom)
      const height = Math.floor(stage.clientHeight / zoom)
      if (width <= 0 || height <= 0) return null
      return { width, height }
    },
  }
}
