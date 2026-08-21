/** Markdown tab body: Preview / Markdown source switcher and rendered preview. */

import { useState } from 'react'
import clsx from 'clsx'
import { MarkdownText } from '@deepseek-ai/dsh-client-ui-primitives'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import { MonacoEditor } from './MonacoEditor.tsx'
import { breadcrumbSegments, languageLabel } from './open-kind.ts'
import type { TextEditorTab } from './stores.ts'
import css from './EditorPane.module.css'

/** Markdown tab view mode. */
export type MarkdownViewMode = 'preview' | 'source'

/** Props for one open Markdown text tab. */
export interface MarkdownEditorBodyProps {
  /** Open Markdown text tab. */
  tab: TextEditorTab
  /** Bound Workspace root for breadcrumb segments. */
  workspaceRoot: string | undefined
  /** True when `body[data-ds-dark-theme]` is set. */
  dark: boolean
  /** Localized copy. */
  t: TranslateNS<'fileEditor'>
  /**
   * Edit-buffer change.
   * @param path - tab path.
   * @param value - new buffer text.
   */
  onBufferChange: (path: string, value: string) => void
}

/**
 * Render a Markdown file with a Preview / source switcher and live preview.
 * @param props - tab, workspace root, theme, and buffer callback.
 */
export function MarkdownEditorBody({
  tab, workspaceRoot, dark, t, onBufferChange,
}: MarkdownEditorBodyProps) {
  const [viewsByPath, setViewsByPath] = useState<Partial<Record<string, MarkdownViewMode>>>({})
  const view = viewsByPath[tab.path] ?? 'preview'
  const segments = breadcrumbSegments(workspaceRoot, tab.path)
  const themeLabel = dark ? t('editor.theme.dark') : t('editor.theme.light')

  const setView = (mode: MarkdownViewMode): void => {
    setViewsByPath(current => ({ ...current, [tab.path]: mode }))
  }

  return (
    <div className={css.markdownPane}>
      <div className={css.markdownBar}>
        <nav className={css.breadcrumb} aria-label={t('editor.markdown.breadcrumb')}>
          {segments.map((segment, index) => {
            const leaf = index === segments.length - 1
            return (
              <span key={`${segment}:${index}`} className={css.breadcrumbSegment}>
                {index > 0 && <span className={css.breadcrumbSep} aria-hidden>{'>'}</span>}
                <span className={clsx(css.breadcrumbPart, leaf && css.breadcrumbLeaf)}>{segment}</span>
              </span>
            )
          })}
        </nav>
        <div
          className={css.modeSwitch}
          role="tablist"
          aria-label={t('editor.markdown.mode.label')}
        >
          <button
            type="button"
            role="tab"
            aria-selected={view === 'preview'}
            className={clsx(css.modeTab, view === 'preview' && css.modeTabActive)}
            onClick={() => { setView('preview') }}
          >
            {t('editor.markdown.mode.preview')}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={view === 'source'}
            className={clsx(css.modeTab, view === 'source' && css.modeTabActive)}
            onClick={() => { setView('source') }}
          >
            {t('editor.markdown.mode.source')}
          </button>
        </div>
      </div>
      <div className={css.markdownBody}>
        {view === 'preview' ? (
          <div className={css.markdownPreview}>
            <MarkdownText
              text={tab.buffer}
              codeLabels={{ copyLabel: t('editor.copy'), copiedLabel: t('editor.copied') }}
            />
          </div>
        ) : (
          <MonacoEditor
            path={tab.path}
            value={tab.buffer}
            language={tab.language}
            ariaLabel={t('editor.buffer.label', {
              name: tab.name,
              language: languageLabel(tab.language),
              theme: themeLabel,
            })}
            dark={dark}
            onChange={(value) => { onBufferChange(tab.path, value) }}
          />
        )}
      </div>
    </div>
  )
}
