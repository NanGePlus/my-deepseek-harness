/** Collapsible commit graph section, sibling of Changes. */

import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import {
  IconChevronDownOutline14, IconChevronRightOutline14, IconLoadingOutline16,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type { GitLogEntry } from '@deepseek-ai/dsh-client-runtime/client'
import {
  GIT_GRAPH_LANE_COLORS, gitGraphEdgePath, gitGraphRowGutterWidth, gitGraphSvgWidth, laneCenterX, layoutGitGraph,
  GIT_GRAPH_ROW_HEIGHT,
} from './git-graph-layout.ts'
import {
  formatAbsoluteCommitDate, formatRelativeCommitAge, GIT_GRAPH_CARD_HIDE_MS, gitGraphCardPosition,
  type GitGraphCardBox,
} from './git-graph-card.ts'
import css from './GitPanel.module.css'

type GraphTranslate = (
  key: 'git.section.graph' | 'git.section.expand' | 'git.section.collapse' | 'git.graph.loading' | 'git.graph.empty' | 'git.graph.commit' | 'git.graph.author' | 'git.graph.loadingMore' | 'git.graph.loadMore' | 'git.graph.allLoaded' | 'git.graph.card.justNow' | 'git.graph.card.minutesAgo' | 'git.graph.card.hoursAgo' | 'git.graph.card.daysAgo' | 'git.graph.card.monthsAgo' | 'git.graph.card.yearsAgo',
  params?: { title?: string; subject?: string; author?: string; count?: string },
) => string

/** Props for {@link GitGraphSection}. */
export interface GitGraphSectionProps {
  t: GraphTranslate
  loading: boolean
  commits: readonly GitLogEntry[] | null
  selectedHash: string | null
  onSelect: (hash: string) => void
  hasMore: boolean
  loadingMore: boolean
  onLoadMore: () => void
}

interface HoverCardState extends GitGraphCardBox {
  entry: GitLogEntry
  refName: string
}

function isRemoteRef(ref: string): boolean {
  return ref.startsWith('origin/')
}

function RemoteCloudIcon(): ReactNode {
  return (
    <svg className={css.graphRefCloud} width={8} height={8} viewBox="0 0 10 10" aria-hidden="true">
      <path
        fill="currentColor"
        d="M7.6 4.15A2.35 2.35 0 0 0 3.2 4.4 1.85 1.85 0 0 0 3.15 8h4.5A1.85 1.85 0 0 0 7.6 4.15Z"
      />
    </svg>
  )
}

/** Compact pills ellipsize; the hover card shows the full name. */
function GitGraphRefChip({ refName, compact }: { refName: string; compact: boolean }): ReactNode {
  const remote = isRemoteRef(refName)
  return (
    <span
      className={`${css.graphRef} ${remote ? css.graphRefRemote : ''} ${compact ? '' : css.graphRefFull}`}
    >
      {remote && <RemoteCloudIcon />}
      <span className={css.graphRefLabel}>{refName}</span>
    </span>
  )
}

/**
 * Render the Graph section with a first-parent trunk, merge arcs, refs, and authors.
 * Infinite-scroll observes the Graph list, which scrolls independently of Changes.
 * @param props - locale, loading state, commits, paging, and selection handlers.
 */
export function GitGraphSection({
  t, loading, commits, selectedHash, onSelect, hasMore, loadingMore, onLoadMore,
}: GitGraphSectionProps): ReactNode {
  const [expanded, setExpanded] = useState(true)
  const [hover, setHover] = useState<HoverCardState | null>(null)
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const sentinelRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const title = t('git.section.graph')
  const toggleLabel = expanded ? t('git.section.collapse', { title }) : t('git.section.expand', { title })
  const toggleExpanded = useCallback(() => {
    setExpanded(open => !open)
  }, [])
  const cancelHide = useCallback(() => {
    if (hideTimer.current === null) return
    clearTimeout(hideTimer.current)
    hideTimer.current = null
  }, [])
  const scheduleHide = useCallback(() => {
    cancelHide()
    hideTimer.current = setTimeout(() => {
      hideTimer.current = null
      setHover(null)
    }, GIT_GRAPH_CARD_HIDE_MS)
  }, [cancelHide])
  const openCard = useCallback((anchor: HTMLElement, entry: GitLogEntry, refName: string) => {
    cancelHide()
    const box = gitGraphCardPosition(
      anchor.getBoundingClientRect(),
      { width: window.innerWidth, height: window.innerHeight },
    )
    setHover({ entry, refName, ...box })
  }, [cancelHide])
  const onHeadKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault()
    toggleExpanded()
  }
  useEffect(() => () => { cancelHide() }, [cancelHide])
  useEffect(() => {
    if (!expanded) {
      cancelHide()
      setHover(null)
    }
  }, [cancelHide, expanded])
  useEffect(() => {
    if (!hasMore || loadingMore) return
    if (typeof IntersectionObserver === 'undefined') return
    const target = sentinelRef.current
    const root = listRef.current
    /* v8 ignore next -- the sentinel is committed in the same expanded list this effect observes. */
    if (target === null || root === null) return
    const observer = new IntersectionObserver((entries) => {
      if (entries.some(entry => entry.isIntersecting)) onLoadMore()
    }, { root, rootMargin: '80px' })
    observer.observe(target)
    return () => { observer.disconnect() }
  }, [hasMore, loadingMore, onLoadMore, commits?.length, expanded])
  const listId = 'git-section-graph-list'
  const layout = commits === null ? { rows: [], edges: [] } : layoutGitGraph(commits)
  const { rows, edges } = layout
  const columnLanes = Math.max(1, ...rows.map(row => row.laneCount))
  const svgWidth = gitGraphSvgWidth(columnLanes)
  const svgHeight = rows.length * GIT_GRAPH_ROW_HEIGHT

  return (
    <section className={`${css.section} ${css.folder} ${css.graphFolder}`} data-git-graph="">
      <div
        className={`${css.sectionHead} ${css.folderHead}`}
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        aria-controls={listId}
        aria-label={toggleLabel}
        onClick={toggleExpanded}
        onKeyDown={onHeadKeyDown}
      >
        <span className={css.sectionChevron} aria-hidden="true">
          {expanded
            ? <IconChevronDownOutline14 size={14} />
            : <IconChevronRightOutline14 size={14} />}
        </span>
        <h2 id="git-section-graph-title" className={`${css.sectionTitle} ${css.folderTitle}`}>{title}</h2>
        <div className={css.sectionHeadActions} onClick={(event) => { event.stopPropagation() }}>
          {loading && (
            <span className={css.graphHeadSpinner} aria-hidden="true">
              <IconLoadingOutline16 size={12} />
            </span>
          )}
          {commits !== null && (
            <span className={css.sectionCount} aria-label={String(commits.length)}>
              {commits.length}
            </span>
          )}
        </div>
      </div>
      {expanded && (
        <div id={listId} ref={listRef} className={css.graphList} aria-labelledby="git-section-graph-title">
          {loading && commits === null && (
            <div className={css.graphFeedback} role="status">
              {t('git.graph.loading')}
            </div>
          )}
          {!loading && commits !== null && commits.length === 0 && (
            <div className={css.graphFeedback}>{t('git.graph.empty')}</div>
          )}
          {rows.length > 0 && (
            <svg
              className={css.graphCanvas}
              width={svgWidth}
              height={svgHeight}
              aria-hidden="true"
            >
              {edges.map((edge, index) => (
                <path
                  key={index}
                  className={css.graphStroke}
                  d={gitGraphEdgePath(edge)}
                  stroke={GIT_GRAPH_LANE_COLORS[edge.colorIndex % GIT_GRAPH_LANE_COLORS.length]}
                  data-git-graph-color={edge.colorIndex}
                />
              ))}
              {rows.map((row, index) => {
                const nodeColor = GIT_GRAPH_LANE_COLORS[row.colorIndex % GIT_GRAPH_LANE_COLORS.length]
                return (
                  <g key={row.entry.hash}>
                    <circle
                      className={row.isMerge ? css.graphNodeMerge : css.graphNodeSolid}
                      cx={laneCenterX(row.nodeLane)}
                      cy={index * GIT_GRAPH_ROW_HEIGHT + GIT_GRAPH_ROW_HEIGHT / 2}
                      r={row.isMerge ? 5 : 3.5}
                      stroke={nodeColor}
                      fill={row.isMerge ? undefined : nodeColor}
                    />
                    {row.isMerge && (
                      <circle
                        className={css.graphNodeMergeDot}
                        cx={laneCenterX(row.nodeLane)}
                        cy={index * GIT_GRAPH_ROW_HEIGHT + GIT_GRAPH_ROW_HEIGHT / 2}
                        r={1.75}
                        fill={nodeColor}
                      />
                    )}
                  </g>
                )
              })}
            </svg>
          )}
          {rows.map((row, index) => {
            const { entry, isMerge } = row
            const selected = selectedHash === entry.hash
            const gutterWidth = gitGraphRowGutterWidth(index, row.nodeLane, edges)
            return (
              <button
                key={entry.hash}
                type="button"
                className={css.graphRow}
                data-selected={selected ? true : undefined}
                data-git-graph-merge={isMerge ? true : undefined}
                data-git-graph-lane={String(row.nodeLane)}
                aria-label={t('git.graph.commit', { subject: entry.subject })}
                aria-pressed={selected}
                onClick={() => { onSelect(entry.hash) }}
              >
                <span
                  className={css.graphGutter}
                  data-git-graph-gutter=""
                  style={{ width: gutterWidth }}
                />
                <span className={css.graphBody}>
                  <span className={css.graphSubject}>{entry.subject}</span>
                  {entry.refs.map(ref => (
                    <span
                      key={ref}
                      className={css.graphRefHit}
                      data-git-graph-ref={ref}
                      onMouseEnter={(event) => { openCard(event.currentTarget, entry, ref) }}
                      onMouseLeave={scheduleHide}
                    >
                      <GitGraphRefChip refName={ref} compact />
                    </span>
                  ))}
                </span>
                <span className={css.graphAuthor} aria-label={t('git.graph.author', { author: entry.authorName })}>
                  {entry.authorName}
                </span>
              </button>
            )
          })}
          {hasMore && (
            <div ref={sentinelRef} className={css.graphSentinel} data-git-graph-sentinel="">
              {loadingMore ? (
                <div className={css.graphFeedback} role="status">{t('git.graph.loadingMore')}</div>
              ) : (
                <button
                  type="button"
                  className={css.graphLoadMore}
                  onClick={onLoadMore}
                >
                  {t('git.graph.loadMore')}
                </button>
              )}
            </div>
          )}
          {!hasMore && !loading && commits !== null && commits.length > 0 && (
            <div className={css.graphFeedback}>{t('git.graph.allLoaded')}</div>
          )}
        </div>
      )}
      {hover !== null && (
        <div
          className={css.graphCommitCard}
          data-git-graph-card=""
          role="tooltip"
          style={{ left: hover.left, top: hover.top, maxHeight: hover.maxHeight }}
          onMouseEnter={cancelHide}
          onMouseLeave={scheduleHide}
        >
          <div className={css.graphCommitCardRef}>
            <GitGraphRefChip refName={hover.refName} compact={false} />
          </div>
          <div className={css.graphCommitCardMeta}>
            <span className={css.graphCommitCardAuthor}>{hover.entry.authorName}</span>
            {hover.entry.authorDate !== '' && (
              <>
                <span>{formatRelativeCommitAge(hover.entry.authorDate, Date.now(), (key, params) => t(key, params))}</span>
                <time dateTime={hover.entry.authorDate}>
                  ({formatAbsoluteCommitDate(hover.entry.authorDate)})
                </time>
              </>
            )}
          </div>
          <div className={css.graphCommitCardSubject}>{hover.entry.subject}</div>
          {hover.entry.body.trim() !== '' && (
            <pre className={css.graphCommitCardBody}>{hover.entry.body}</pre>
          )}
          <div className={css.graphCommitCardHash}>{hover.entry.shortHash}</div>
        </div>
      )}
    </section>
  )
}
