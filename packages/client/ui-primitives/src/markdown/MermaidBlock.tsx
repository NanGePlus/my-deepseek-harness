/** Render a settled ```mermaid fence as SVG via Mermaid. */

import { useEffect, useId, useRef, useState } from 'react'
import { IconFullscreenOutline16 } from '../icons/index.tsx'
import { CodeBlock } from './CodeBlock.tsx'
import { MermaidLightbox, type MermaidLightboxLabels } from './MermaidLightbox.tsx'
import { renderMermaidDiagram, type MermaidSecurityLevel } from './mermaid-load.ts'
import css from './MermaidBlock.module.css'

/** Toolbar labels for an inline Mermaid diagram and its lightbox. */
export interface MermaidDiagramLabels extends MermaidLightboxLabels {
  /** Expand control on the inline diagram. */
  expandLabel?: string | undefined
}

/** Props for one Mermaid diagram block. */
export interface MermaidBlockProps {
  /** Diagram source from the fence body. */
  source: string
  /** Mermaid sanitizer mode; workspace previews use loose for rich labels. */
  securityLevel?: MermaidSecurityLevel | undefined
  /** Copy-button idle label. */
  copyLabel?: string | undefined
  /** Copy-button label after a successful copy. */
  copiedLabel?: string | undefined
  /** Expand/zoom toolbar labels. */
  diagramLabels?: MermaidDiagramLabels | undefined
}

let renderSerial = 0

/** Re-render when Harness light/dark document state changes. */
function useDocumentThemeEpoch(): number {
  const [epoch, setEpoch] = useState(0)
  useEffect(() => {
    const bump = (): void => { setEpoch(current => current + 1) }
    const observer = new MutationObserver(bump)
    observer.observe(document.body, { attributes: true, attributeFilter: ['data-ds-dark-theme'] })
    return () => { observer.disconnect() }
  }, [])
  return epoch
}

/**
 * Render one Mermaid diagram, falling back to a code block when rendering fails.
 * @param props - diagram source, security level, and optional copy labels.
 */
export function MermaidBlock({
  source, securityLevel = 'strict', copyLabel, copiedLabel, diagramLabels,
}: MermaidBlockProps) {
  const reactId = useId()
  const themeEpoch = useDocumentThemeEpoch()
  const renderTokenRef = useRef(0)
  const [svg, setSvg] = useState<string | undefined>(undefined)
  const [failed, setFailed] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const expandLabel = diagramLabels?.expandLabel ?? '放大'

  useEffect(() => {
    const token = ++renderTokenRef.current
    const diagram = source.endsWith('\n') ? source.slice(0, -1) : source
    let cancelled = false
    void (async () => {
      try {
        const id = `dsh-mmd-${reactId.replace(/:/g, '')}-${++renderSerial}`
        const markup = await renderMermaidDiagram(id, diagram, securityLevel)
        if (cancelled || token !== renderTokenRef.current) return
        setFailed(false)
        setSvg(markup)
      } catch (error: unknown) {
        void error
        if (cancelled || token !== renderTokenRef.current) return
        setSvg(undefined)
        setFailed(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [source, reactId, securityLevel, themeEpoch])

  if (failed) {
    return (
      <CodeBlock
        code={source.endsWith('\n') ? source : `${source}\n`}
        lang="mermaid"
        copyLabel={copyLabel}
        copiedLabel={copiedLabel}
      />
    )
  }
  if (svg === undefined) {
    return <div className={css.pending} aria-busy="true" />
  }
  return (
    <div className={css.frame}>
      <div
        className={css.diagram}
        dangerouslySetInnerHTML={{ __html: svg }}
      />
      <button
        type="button"
        className={css.expand}
        aria-label={expandLabel}
        onClick={() => { setExpanded(true) }}
      >
        <IconFullscreenOutline16 size={14} />
      </button>
      {expanded && (
        <MermaidLightbox
          svg={svg}
          onClose={() => { setExpanded(false) }}
          labels={diagramLabels}
        />
      )}
    </div>
  )
}
