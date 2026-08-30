// DetailsPanel: segmented 资源管理器 | Git | 终端 | 浏览器 | 工具详情 tabs over the details
// column content seats. Reads selection and tab state from the current
// session chat store. Leaving a tab hides its panel and does not unmount it.

import { useCallback, useEffect, useRef, useState } from 'react'
import clsx from 'clsx'
import type { DetailsSlotProps } from '../contract/slots.ts'
import type { DetailsTab } from '../contract/views.ts'
import { ToolDetailsBody } from './ToolDetailsBody.tsx'
import css from './DetailsPanel.module.css'

/** Full props composed by reference from the contract (automatic shares & injected share). */
export type DetailsPanelProps = DetailsSlotProps

const SEGMENTS = [
  { id: 'editor', label: 'details.tab.editor', opens: true },
  { id: 'git', label: 'details.tab.git', opens: true },
  { id: 'terminal', label: 'details.tab.terminal', opens: true },
  { id: 'browser', label: 'details.tab.browser', opens: true },
  { id: 'tool', label: 'details.tab.tool', opens: false },
] as const

/** Renders the details column shell: segmented tabs and tab bodies. */
export function DetailsPanel({
  useSessions, renderSlot, openDetails, t,
  useChat, useConversation,
}: DetailsPanelProps) {
  const detailsTab = useChat(binding => binding.state.detailsTab)
  const chatActions = useChat(binding => binding.actions)
  const boundSessionId = useChat(binding => binding.sessionId)
  const currentSessionId = useSessions(list => list.current)
  const sessionId = boundSessionId ?? currentSessionId
  const flushBody = detailsTab === 'editor' || detailsTab === 'git' || detailsTab === 'terminal' || detailsTab === 'browser'
  const [dirtyPaths, setDirtyPathsState] = useState<readonly string[]>([])
  const [diskPathsChanged, setDiskPathsChanged] = useState<{
    epoch: number
    paths: readonly string[]
    reload: boolean
  }>({
    epoch: 0,
    paths: [],
    reload: true,
  })
  const [segmentDiskRefreshEpoch, setSegmentDiskRefreshEpoch] = useState(0)
  const prevDetailsTabRef = useRef<DetailsTab | null>(null)
  /** Keep the same array when contents match so the Git occupant does not re-render. */
  const setDirtyPaths = useCallback((paths: readonly string[]) => {
    setDirtyPathsState((current) => {
      if (current.length === paths.length && current.every((path, index) => path === paths[index])) {
        return current
      }
      return [...paths]
    })
  }, [])
  const notifyDiskPathsChanged = useCallback((paths: readonly string[], reload = true) => {
    if (paths.length === 0) return
    setDiskPathsChanged(current => ({ epoch: current.epoch + 1, paths: [...paths], reload }))
  }, [])

  useEffect(() => {
    const prev = prevDetailsTabRef.current
    prevDetailsTabRef.current = detailsTab
    if (prev === null) return
    const leavingTerminal = prev === 'terminal' && detailsTab !== 'terminal'
    const enteringEditorOrGit =
      (detailsTab === 'editor' || detailsTab === 'git') && prev !== detailsTab
    if (leavingTerminal || enteringEditorOrGit) {
      setSegmentDiskRefreshEpoch(epoch => epoch + 1)
    }
  }, [detailsTab])

  return (
    <div className={css.root}>
      <div className={css.header}>
        <div className={css.tabBar} role="tablist" aria-label={t('details.tablist')}>
          {SEGMENTS.map(segment => (
            <button
              key={segment.id}
              type="button"
              role="tab"
              aria-selected={detailsTab === segment.id}
              className={clsx(css.tab, detailsTab === segment.id && css.tabActive)}
              onClick={() => {
                chatActions.setDetailsTab(segment.id)
                if (segment.opens) openDetails()
              }}
            >
              {t(segment.label)}
            </button>
          ))}
        </div>
      </div>
      <div className={clsx(css.body, flushBody && css.bodyFlush)}>
        <div
          className={clsx(css.tabPanel, detailsTab !== 'editor' && css.tabPanelHidden)}
          role="tabpanel"
          aria-hidden={detailsTab !== 'editor'}
        >
          {renderSlot('conversation.details.editor', {
            visible: detailsTab === 'editor',
            setDirtyPaths,
            diskPathsChangedEpoch: diskPathsChanged.epoch,
            diskPathsChanged: diskPathsChanged.paths,
            diskPathsChangedReload: diskPathsChanged.reload,
            segmentDiskRefreshEpoch,
          })}
        </div>
        <div
          className={clsx(css.tabPanel, detailsTab !== 'git' && css.tabPanelHidden)}
          role="tabpanel"
          aria-hidden={detailsTab !== 'git'}
        >
          {renderSlot('conversation.details.git', {
            visible: detailsTab === 'git',
            dirtyPaths,
            notifyDiskPathsChanged,
            segmentDiskRefreshEpoch,
          })}
        </div>
        <div
          className={clsx(css.tabPanel, detailsTab !== 'terminal' && css.tabPanelHidden)}
          role="tabpanel"
          aria-hidden={detailsTab !== 'terminal'}
        >
          {renderSlot('conversation.details.terminal', {
            visible: detailsTab === 'terminal',
          })}
        </div>
        <div
          className={clsx(css.tabPanel, detailsTab !== 'browser' && css.tabPanelHidden)}
          role="tabpanel"
          aria-hidden={detailsTab !== 'browser'}
        >
          {renderSlot('conversation.details.browser', {
            visible: detailsTab === 'browser',
          })}
        </div>
        <div
          className={clsx(css.tabPanel, detailsTab !== 'tool' && css.tabPanelHidden)}
          role="tabpanel"
          aria-hidden={detailsTab !== 'tool'}
        >
          <ToolDetailsBody
            useChat={useChat}
            useSession={useConversation}
            useSessions={useSessions}
            sessionId={sessionId}
            renderSlot={renderSlot}
            t={t}
          />
        </div>
      </div>
    </div>
  )
}
