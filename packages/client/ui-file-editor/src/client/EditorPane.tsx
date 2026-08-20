/** Right-pane tabs, save, Monaco / preview / non-openable / empty / loading / error. */

import { IconCloseOutline16, IconLoadingOutline16 } from '@deepseek-ai/dsh-client-ui-primitives'
import clsx from 'clsx'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import { MonacoEditor } from './MonacoEditor.tsx'
import { languageLabel } from './open-kind.ts'
import { tabIsDirty, type EditorTab } from './stores.ts'
import css from './EditorPane.module.css'

/** Transient open/save status owned by EditorSurface, not the tab store. */
export type EditorPaneStatus =
  | { kind: 'idle' }
  | { kind: 'loading'; op: 'open' | 'save' }
  | { kind: 'error'; op: 'open' | 'save'; message: string }

/** Props for the editor pane (tabs + body). */
export interface EditorPaneProps {
  /** Open tabs in display order. */
  tabs: readonly EditorTab[]
  /** Focused tab path. */
  activePath: string | undefined
  /** Open/save loading or error overlay for the body. */
  status: EditorPaneStatus
  /** True when `body[data-ds-dark-theme]` is set. */
  dark: boolean
  /** Localized copy. */
  t: TranslateNS<'fileEditor'>
  /**
   * Focus a tab.
   * @param path - tab path.
   */
  onFocus: (path: string) => void
  /**
   * Close a tab without a dirty guard (US-27 owns that dialog).
   * @param path - tab path.
   */
  onClose: (path: string) => void
  /**
   * Edit-buffer change for a text tab.
   * @param path - tab path.
   * @param value - new buffer text.
   */
  onBufferChange: (path: string, value: string) => void
  /** Explicit save of the active dirty text tab. */
  onSave: () => void
  /** Retry the failed open or save. */
  onRetry: () => void
}

/**
 * Editor pane: file tab bar, save, and the active tab body.
 * @param props - tabs, status, theme, and callbacks.
 */
export function EditorPane({
  tabs, activePath, status, dark, t, onFocus, onClose, onBufferChange, onSave, onRetry,
}: EditorPaneProps) {
  const active = tabs.find(tab => tab.path === activePath)
  const canSave = active !== undefined && tabIsDirty(active)
  const themeLabel = dark ? t('editor.theme.dark') : t('editor.theme.light')

  return (
    <div className={css.pane}>
      {tabs.length > 0 && (
        <div className={css.chrome}>
          <div className={css.tablist} role="tablist" aria-label={t('editor.tabs.label')}>
            {tabs.map((tab) => {
              const selected = tab.path === activePath
              const dirty = tabIsDirty(tab)
              return (
                <div
                  key={tab.path}
                  role="tab"
                  aria-selected={selected}
                  className={clsx(css.tab, selected && css.tabActive)}
                  onClick={() => { onFocus(tab.path) }}
                >
                  {dirty && <span className={css.dirty} aria-label={t('editor.tab.dirty')} />}
                  <span className={css.tabTitle}>{tab.name}</span>
                  <button
                    type="button"
                    className={css.tabClose}
                    aria-label={t('editor.tab.close', { name: tab.name })}
                    onClick={(event) => {
                      event.stopPropagation()
                      onClose(tab.path)
                    }}
                  >
                    <IconCloseOutline16 size={16} />
                  </button>
                </div>
              )
            })}
          </div>
          <button
            type="button"
            className={css.save}
            disabled={!canSave}
            onClick={() => { onSave() }}
          >
            {t('editor.save')}
          </button>
        </div>
      )}
      <div className={css.body}>
        {status.kind === 'loading' && (
          <div className={css.feedback} role="status" aria-live="polite">
            <span className={css.spinner} aria-hidden="true">
              <IconLoadingOutline16 size={24} />
            </span>
            <span className={css.feedbackCopy}>
              {status.op === 'save' ? t('editor.loading.save') : t('editor.loading.open')}
            </span>
          </div>
        )}
        {status.kind === 'error' && (
          <div className={css.emptyCard} role="alert">
            <div className={css.errorCopy}>{status.message}</div>
            <button type="button" className={css.retry} onClick={() => { onRetry() }}>
              {t('editor.retry')}
            </button>
          </div>
        )}
        {status.kind === 'idle' && active === undefined && (
          <div className={css.emptyCard}>
            <span className={css.emptyIcon} aria-hidden="true">
              <svg width={48} height={48} viewBox="0 0 16 16" fill="none">
                <path
                  d="M4.2 1.5h5.1L12.8 5v9.5H4.2V1.5Z"
                  stroke="currentColor"
                  strokeWidth="1.2"
                  strokeLinejoin="round"
                />
                <path d="M9.2 1.6V5h3.5" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
              </svg>
            </span>
            <div className={css.emptyTitle}>{t('editor.empty.title')}</div>
            <div className={css.emptyBody}>{t('editor.empty.body')}</div>
            <button type="button" className={css.emptyCta} disabled>{t('editor.empty.cta')}</button>
          </div>
        )}
        {status.kind === 'idle' && active?.kind === 'text' && (
          <MonacoEditor
            path={active.path}
            value={active.buffer}
            language={active.language}
            ariaLabel={t('editor.buffer.label', {
              name: active.name,
              language: languageLabel(active.language),
              theme: themeLabel,
            })}
            dark={dark}
            onChange={(value) => { onBufferChange(active.path, value) }}
          />
        )}
        {status.kind === 'idle' && active?.kind === 'preview' && (
          <div className={css.preview}>
            <img
              className={css.previewImage}
              alt={active.name}
              src={`data:${active.mediaType};base64,${active.data}`}
            />
          </div>
        )}
        {status.kind === 'idle' && active?.kind === 'non-openable' && (
          <div className={css.emptyCard}>
            <div className={css.emptyTitle}>{t('editor.nonOpenable')}</div>
          </div>
        )}
      </div>
    </div>
  )
}
