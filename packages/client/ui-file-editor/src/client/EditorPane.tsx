/** Right-pane tabs, Monaco / preview / non-openable / empty / loading / error. */

import { useEffect, useMemo, useRef, useState } from 'react'
import { IconCloseOutline16, IconCodeOutline16, IconLoadingOutline16, IconPanelLeftOutline16, Menu, Tooltip, ZoomableImage } from '@deepseek-ai/dsh-client-ui-primitives'
import type { MenuEntry } from '@deepseek-ai/dsh-client-ui-primitives'
import clsx from 'clsx'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import type { HostLspDiagnostic, WorkspaceId } from '@deepseek-ai/dsh-client-runtime/client'
import type { FileContextRefRequest } from './file-context-ref.ts'
import { MonacoEditor, type MonacoSourceLineRange } from './MonacoEditor.tsx'
import { MarkdownEditorBody } from './MarkdownEditorBody.tsx'
import { isMarkdownLanguage, languageLabel } from './open-kind.ts'
import { tabIsDirty, type EditorTab, type SourceSelectionRequest } from './stores.ts'
import { lspErrorCount } from './diagnostics-ui.ts'
import { type TabCloseScope, tabCloseMenuState } from './tab-close-scope.ts'
import css from './EditorPane.module.css'
import iconCss from './IconButton.module.css'

const TOOLTIP_DELAY_MS = 500

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
   * Close a tab; dirty text tabs open the save / discard / cancel guard first.
   * @param path - tab path.
   */
  onClose: (path: string) => void
  /**
   * Bulk-close tabs relative to a context-menu anchor.
   * @param scope - close scope.
   * @param anchorPath - right-clicked tab path.
   */
  onCloseTabs: (scope: TabCloseScope, anchorPath: string) => void
  /**
   * Edit-buffer change for a text tab.
   * @param path - tab path.
   * @param value - new buffer text.
   */
  onBufferChange: (path: string, value: string) => void
  /** Retry the failed open or save. */
  onRetry: () => void
  /** True when the file tree pane is collapsed. */
  treeCollapsed?: boolean
  /** Expand the collapsed file tree pane. */
  onShowTree?: () => void
  /** Bound Workspace root for Markdown breadcrumbs. */
  workspaceRoot?: string | undefined
  /** Language-server diagnostics keyed by tab path. */
  diagnosticsByPath?: ReadonlyMap<string, readonly HostLspDiagnostic[]> | undefined
  /**
   * Language-server hover at a zero-based UTF-16 cursor position for the active text tab.
   * @param path - tab path.
   * @param line - zero-based line.
   * @param character - zero-based character.
   * @param signal - aborts a superseded hover request.
   */
  onHover?: (
    path: string,
    line: number,
    character: number,
    signal?: AbortSignal,
  ) => Promise<{ contents: string; range?: HostLspDiagnostic['range'] } | null>
  /** Bound workspace for composer file-context insertion. */
  workspaceId?: WorkspaceId | undefined
  /**
   * Insert one file line-range reference into the session composer.
   * @param request - workspace file path and one-based line range.
   */
  insertFileContextToComposer?: ((request: FileContextRefRequest) => boolean) | undefined
  /** Pending source line-range selection for the active tab, if any. */
  sourceSelection?: SourceSelectionRequest | undefined
  /**
   * Called after a pending source line-range selection is applied.
   * @param ticket - applied selection ticket.
   */
  onSourceSelectionApplied?: ((ticket: number) => void) | undefined
}

/**
 * Editor pane: file tab bar and the active tab body.
 * @param props - tabs, status, theme, and callbacks.
 */
export function EditorPane({
  tabs, activePath, status, dark, t, onFocus, onClose, onCloseTabs, onBufferChange, onRetry,
  treeCollapsed = false, onShowTree, workspaceRoot, diagnosticsByPath, onHover,
  workspaceId, insertFileContextToComposer, sourceSelection, onSourceSelectionApplied,
}: EditorPaneProps) {
  const active = tabs.find(tab => tab.path === activePath)
  const sourceLineRange: MonacoSourceLineRange | undefined =
    active !== undefined && sourceSelection?.path === active.path
      ? {
        startLine: sourceSelection.startLine,
        endLine: sourceSelection.endLine,
        ticket: sourceSelection.ticket,
      }
      : undefined
  const tabRefs = useRef<Map<string, HTMLDivElement>>(new Map())
  const [tabMenu, setTabMenu] = useState<{ anchorPath: string; rect: DOMRect } | null>(null)
  const themeLabel = dark ? t('editor.theme.dark') : t('editor.theme.light')
  const openPending = status.kind === 'loading' && status.op === 'open'
  const openFailed = status.kind === 'error' && status.op === 'open'
  const showOpenFeedback = (openPending || openFailed) && active === undefined

  useEffect(() => {
    if (activePath === undefined) return
    const tab = tabRefs.current.get(activePath)
    if (typeof tab?.scrollIntoView === 'function') {
      tab.scrollIntoView({ block: 'nearest', inline: 'nearest' })
    }
  }, [activePath, tabs])

  const tabCloseMenuItems = useMemo((): readonly MenuEntry[] => {
    if (tabMenu === null) return []
    const disabled = tabCloseMenuState(tabs, tabMenu.anchorPath)
    return [
      { id: 'current', label: t('editor.tab.closeCurrent') },
      { id: 'others', label: t('editor.tab.closeOthers'), disabled: disabled.closeOthersDisabled },
      { id: 'right', label: t('editor.tab.closeRight'), disabled: disabled.closeRightDisabled },
      { id: 'left', label: t('editor.tab.closeLeft'), disabled: disabled.closeLeftDisabled },
      { type: 'separator', id: 'close-sep' },
      { id: 'all', label: t('editor.tab.closeAll'), danger: true },
    ]
  }, [tabMenu, tabs, t])

  return (
    <div className={css.pane}>
      {(tabs.length > 0 || treeCollapsed) && (
        <div className={css.chrome}>
          {treeCollapsed && onShowTree !== undefined && (
            <Tooltip label={t('editor.tree.show')} side="bottom" delayMs={TOOLTIP_DELAY_MS}>
              <button
                type="button"
                className={iconCss.iconButton}
                aria-label={t('editor.tree.show')}
                onClick={onShowTree}
              >
                <IconPanelLeftOutline16 size={16} />
              </button>
            </Tooltip>
          )}
          {tabs.length > 0 && (
            <div className={css.tablist} role="tablist" aria-label={t('editor.tabs.label')}>
              {tabs.map((tab) => {
                const selected = tab.path === activePath
                const dirty = tabIsDirty(tab)
                const tabDiagnostics = diagnosticsByPath?.get(tab.path)
                const errorCount = lspErrorCount(tabDiagnostics)
                return (
                  <div
                    key={tab.path}
                    ref={(element) => {
                      if (element === null) tabRefs.current.delete(tab.path)
                      else tabRefs.current.set(tab.path, element)
                    }}
                    role="tab"
                    aria-selected={selected}
                    className={clsx(css.tab, selected && css.tabActive)}
                    onClick={() => { onFocus(tab.path) }}
                    onContextMenu={(event) => {
                      event.preventDefault()
                      event.stopPropagation()
                      setTabMenu({
                        anchorPath: tab.path,
                        rect: event.currentTarget.getBoundingClientRect(),
                      })
                    }}
                  >
                    {dirty && <span className={css.dirty} aria-label={t('editor.tab.dirty')} />}
                    <span className={clsx(css.tabTitle, errorCount > 0 && css.tabTitleError)}>
                      {tab.name}
                    </span>
                    {errorCount > 0 && (
                      <span className={css.tabErrorCount} aria-label={t('editor.tab.errors', { count: errorCount })}>
                        {errorCount}
                      </span>
                    )}
                    <Tooltip
                      label={t('editor.tab.close', { name: tab.name })}
                      side="bottom"
                      delayMs={TOOLTIP_DELAY_MS}
                    >
                      <button
                        type="button"
                        className={css.tabClose}
                        aria-label={t('editor.tab.close', { name: tab.name })}
                        onClick={(event) => {
                          event.stopPropagation()
                          onClose(tab.path)
                        }}
                      >
                        <IconCloseOutline16 size={12} />
                      </button>
                    </Tooltip>
                  </div>
                )
              })}
            </div>
          )}
          {tabMenu !== null && (
            <Menu
              open
              portal
              compact
              align="start"
              side="bottom"
              anchor={<span aria-hidden="true" />}
              items={tabCloseMenuItems}
              onSelect={(id) => {
                onCloseTabs(id as TabCloseScope, tabMenu.anchorPath)
                setTabMenu(null)
              }}
              onClose={() => { setTabMenu(null) }}
              getAnchorRect={() => tabMenu.rect}
            />
          )}
        </div>
      )}
      <div className={css.body}>
        {showOpenFeedback && openPending && (
          <div className={css.feedback} role="status" aria-live="polite">
            <span className={css.spinner} aria-hidden="true">
              <IconLoadingOutline16 size={24} />
            </span>
            <span className={css.feedbackCopy}>{t('editor.loading.open')}</span>
          </div>
        )}
        {showOpenFeedback && openFailed && (
          <div className={css.emptyCard} role="alert">
            <div className={css.errorCopy}>{status.message}</div>
            <Tooltip label={t('editor.retry')} side="bottom" delayMs={TOOLTIP_DELAY_MS}>
              <button type="button" className={iconCss.primaryButton} onClick={() => { onRetry() }}>
                {t('editor.retry')}
              </button>
            </Tooltip>
          </div>
        )}
        {active === undefined && status.kind === 'idle' && (
          <div className={css.emptyState}>
            <span className={css.emptyIcon} aria-hidden="true">
              <IconCodeOutline16 size={28} />
            </span>
            <div className={css.emptyCopy}>
              <div className={css.emptyTitle}>{t('editor.empty.title')}</div>
              <div className={css.emptyBody}>{t('editor.empty.body')}</div>
            </div>
          </div>
        )}
        {active?.kind === 'text' && isMarkdownLanguage(active.language) && (
          <MarkdownEditorBody
            tab={active}
            workspaceRoot={workspaceRoot}
            dark={dark}
            t={t}
            onBufferChange={onBufferChange}
            {...(onHover === undefined
              ? {}
              : { onHover: (path, line, character, signal) => onHover(path, line, character, signal) })}
            {...(workspaceId === undefined || insertFileContextToComposer === undefined
              ? {}
              : {
                workspaceId,
                insertFileContextToComposer: (range: { startLine: number; endLine: number }) => {
                  insertFileContextToComposer({
                    workspaceId,
                    absolutePath: active.path,
                    startLine: range.startLine,
                    endLine: range.endLine,
                  })
                },
              })}
            {...(sourceLineRange === undefined
              ? {}
              : {
                sourceLineRange,
                onSourceLineRangeApplied: onSourceSelectionApplied,
              })}
          />
        )}
        {active?.kind === 'text' && !isMarkdownLanguage(active.language) && (
          <MonacoEditor
            path={active.path}
            value={active.buffer}
            language={active.language}
            diagnostics={diagnosticsByPath?.get(active.path)}
            {...(onHover === undefined
              ? {}
              : { onHover: (line, character, signal) => onHover(active.path, line, character, signal) })}
            {...(sourceLineRange === undefined
              ? {}
              : { sourceLineRange, onSourceLineRangeApplied: onSourceSelectionApplied })}
            ariaLabel={t('editor.buffer.label', {
              name: active.name,
              language: languageLabel(active.language),
              theme: themeLabel,
            })}
            dark={dark}
            onChange={(value) => { onBufferChange(active.path, value) }}
          />
        )}
        {active?.kind === 'preview' && (
          <div className={css.preview}>
            <ZoomableImage
              className={css.previewImage ?? ''}
              alt={active.name}
              src={`data:${active.mediaType};base64,${active.data}`}
            />
          </div>
        )}
        {active?.kind === 'non-openable' && (
          <div className={css.emptyCard}>
            <div className={css.emptyTitle}>{t('editor.nonOpenable')}</div>
          </div>
        )}
        {status.kind === 'error' && status.op === 'save' && (
          <div className={css.bodyOverlay} role="alert">
            <div className={css.errorCopy}>{status.message}</div>
            <Tooltip label={t('editor.retry')} side="bottom" delayMs={TOOLTIP_DELAY_MS}>
              <button type="button" className={iconCss.primaryButton} onClick={() => { onRetry() }}>
                {t('editor.retry')}
              </button>
            </Tooltip>
          </div>
        )}
      </div>
    </div>
  )
}
