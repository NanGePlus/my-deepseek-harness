/** Lane layout and SVG path helpers for the Git panel commit graph. */

import type { GitLogEntry } from '@deepseek-ai/dsh-client-runtime/client'

/** Maximum lanes drawn in the graph column. */
export const GIT_GRAPH_MAX_LANES = 6

/** Horizontal space per lane, in CSS pixels. */
export const GIT_GRAPH_LANE_WIDTH = 18

/** Extra SVG width so lane strokes are not clipped. */
export const GIT_GRAPH_ARC_PAD = 8

/** Commit subject/author line height, in CSS pixels. */
export const GIT_GRAPH_ROW_HEIGHT = 24

/** Extra row height when the commit has ref pills on a second line. */
export const GIT_GRAPH_REF_LINE_HEIGHT = 16

/** Lane stroke colors aligned with VS Code Git Graph accents. */
export const GIT_GRAPH_LANE_COLORS = [
  'var(--git-graph-lane-0, #4ea1ff)',
  'var(--git-graph-lane-1, #f2c94c)',
  'var(--git-graph-lane-2, #f2994a)',
  'var(--git-graph-lane-3, #bb6bd9)',
  'var(--git-graph-lane-4, #56ccf2)',
  'var(--git-graph-lane-5, #6fcf97)',
] as const

/** One commit-to-parent stroke in graph coordinates (row centers). */
export interface GitGraphEdge {
  fromRow: number
  fromLane: number
  toRow: number
  toLane: number
  /** Index into {@link GIT_GRAPH_LANE_COLORS}. */
  colorIndex: number
}

/** One rendered row of the commit graph. */
export interface GitGraphRowLayout {
  entry: GitLogEntry
  /** 0-based lane index of the commit node. */
  nodeLane: number
  /** Color of this node's lane. */
  colorIndex: number
  /** Number of lanes rendered in this row. */
  laneCount: number
  /** True when the commit has more than one parent. */
  isMerge: boolean
}

/** Lane assignment plus node-to-node edges for a commit list. */
export interface GitGraphLayout {
  readonly rows: readonly GitGraphRowLayout[]
  readonly edges: readonly GitGraphEdge[]
}

/**
 * X coordinate of a lane's node center.
 * @param lane - 0-based lane index.
 */
export function laneCenterX(lane: number): number {
  return GIT_GRAPH_LANE_WIDTH * lane + GIT_GRAPH_LANE_WIDTH / 2
}

/**
 * SVG width for a graph column that draws `laneCount` lanes plus arc padding.
 * @param laneCount - number of lanes rendered in the column.
 */
export function gitGraphSvgWidth(laneCount: number): number {
  return Math.max(laneCount, 1) * GIT_GRAPH_LANE_WIDTH + GIT_GRAPH_ARC_PAD
}

/**
 * Gutter width so this row's subject starts just after the rightmost node or
 * stroke that actually paints on the row, not after the page-wide max lane.
 * Omits {@link GIT_GRAPH_ARC_PAD}: that pad is SVG overflow, not text inset.
 * @param rowIndex - index of the row in {@link GitGraphLayout.rows}.
 * @param nodeLane - lane of this row's commit node.
 * @param edges - node-to-node strokes for the same layout.
 * @returns CSS pixel width for that row's text gutter.
 */
export function gitGraphRowGutterWidth(
  rowIndex: number,
  nodeLane: number,
  edges: readonly GitGraphEdge[],
): number {
  let maxLane = nodeLane
  for (const edge of edges) {
    const top = Math.min(edge.fromRow, edge.toRow)
    const bottom = Math.max(edge.fromRow, edge.toRow)
    if (rowIndex < top || rowIndex > bottom) continue
    if (edge.fromLane > maxLane) maxLane = edge.fromLane
    if (edge.toLane > maxLane) maxLane = edge.toLane
  }
  return Math.max(maxLane + 1, 1) * GIT_GRAPH_LANE_WIDTH
}

/**
 * SVG path from one commit node to a parent node.
 * Same-lane edges are vertical; cross-lane edges bend right using control
 * points on the outer lane so the side-branch node sits on the arc.
 * Node Y stays on the subject line even when the row grows for ref pills.
 * @param edge - row/lane endpoints.
 * @param rowTops - CSS pixel Y of each row's top; omit for uniform 24px rows.
 * @returns SVG path `d` from child node to parent node.
 */
export function gitGraphEdgePath(edge: GitGraphEdge, rowTops?: readonly number[]): string {
  const x1 = laneCenterX(edge.fromLane)
  const x2 = laneCenterX(edge.toLane)
  const y1 = gitGraphNodeY(edge.fromRow, rowTops)
  const y2 = gitGraphNodeY(edge.toRow, rowTops)
  if (edge.fromLane === edge.toLane) return `M ${String(x1)} ${String(y1)} L ${String(x2)} ${String(y2)}`
  const outerX = Math.max(x1, x2)
  return `M ${String(x1)} ${String(y1)} C ${String(outerX)} ${String(y1)}, ${String(outerX)} ${String(y2)}, ${String(x2)} ${String(y2)}`
}

/**
 * Pixel height of one commit row, including a second line when it has refs.
 * @param refCount - number of branch/tag pills on this commit.
 * @returns CSS pixel height of that row.
 */
export function gitGraphRowHeight(refCount: number): number {
  return GIT_GRAPH_ROW_HEIGHT + (refCount > 0 ? GIT_GRAPH_REF_LINE_HEIGHT : 0)
}

/**
 * Top Y of each row when some rows grow for right-aligned ref pills.
 * @param refCounts - pill count per row, in list order.
 * @returns top Y of each row in CSS pixels.
 */
export function gitGraphRowTops(refCounts: readonly number[]): number[] {
  const tops: number[] = []
  let y = 0
  for (const count of refCounts) {
    tops.push(y)
    y += gitGraphRowHeight(count)
  }
  return tops
}

/**
 * Y of a commit node: vertical center of that row's subject line.
 * @param rowIndex - index in {@link GitGraphLayout.rows}.
 * @param rowTops - CSS pixel Y of each row's top; omit for uniform 24px rows.
 * @returns CSS pixel Y of the node center.
 */
export function gitGraphNodeY(rowIndex: number, rowTops?: readonly number[]): number {
  const top = rowTops?.[rowIndex] ?? rowIndex * GIT_GRAPH_ROW_HEIGHT
  return top + GIT_GRAPH_ROW_HEIGHT / 2
}

/**
 * SVG height covering every row, including extra pill lines.
 * @param refCounts - pill count per row, in list order.
 * @returns total CSS pixel height of the column.
 */
export function gitGraphColumnHeight(refCounts: readonly number[]): number {
  return refCounts.reduce((sum, count) => sum + gitGraphRowHeight(count), 0)
}

function takeLane(occupied: (string | null)[]): number {
  const empty = occupied.indexOf(null)
  if (empty !== -1) return empty
  if (occupied.length >= GIT_GRAPH_MAX_LANES) return GIT_GRAPH_MAX_LANES - 1
  occupied.push(null)
  return occupied.length - 1
}

function paintLane(lane: number, laneColor: number[], nextColor: { value: number }): number {
  if (lane === 0) {
    laneColor[0] = 0
    return 0
  }
  const palette = GIT_GRAPH_LANE_COLORS.length - 1
  const color = 1 + (nextColor.value % palette)
  nextColor.value += 1
  laneColor[lane] = color
  return color
}

/**
 * Assign lane positions and node-to-node strokes for a newest-first commit list.
 * First parent continues on the same lane (the trunk). Extra parents open a
 * side lane; a later commit whose first parent already occupies another lane
 * curves back. A freed side lane reused by a later branch gets a new color.
 * @param commits - Host gitLog rows in reverse chronological order.
 */
export function layoutGitGraph(commits: readonly GitLogEntry[]): GitGraphLayout {
  if (commits.length === 0) return { rows: [], edges: [] }

  const occupied: (string | null)[] = []
  const laneColor: number[] = []
  const nextColor = { value: 0 }
  const rows: GitGraphRowLayout[] = []

  for (const commit of commits) {
    let nodeLane = occupied.indexOf(commit.hash)
    if (nodeLane === -1) {
      nodeLane = takeLane(occupied)
      occupied[nodeLane] = commit.hash
      if (laneColor[nodeLane] === undefined) paintLane(nodeLane, laneColor, nextColor)
    }

    occupied[nodeLane] = null
    const parents = commit.parents
    const first = parents[0]
    if (first !== undefined) {
      const existingFirst = occupied.indexOf(first)
      if (existingFirst === -1) {
        occupied[nodeLane] = first
      }
      for (const extra of parents.slice(1)) {
        let extraLane = occupied.indexOf(extra)
        if (extraLane === -1) {
          extraLane = takeLane(occupied)
          occupied[extraLane] = extra
          paintLane(extraLane, laneColor, nextColor)
        }
      }
    }

    let maxLane = nodeLane
    for (let lane = 0; lane < occupied.length; lane++) {
      if (occupied[lane] != null && lane > maxLane) maxLane = lane
    }

    rows.push({
      entry: commit,
      nodeLane,
      colorIndex: laneColor[nodeLane] ?? 0,
      laneCount: Math.min(maxLane + 1, GIT_GRAPH_MAX_LANES),
      isMerge: parents.length > 1,
    })
  }

  const rowByHash = new Map<string, number>()
  for (let index = 0; index < rows.length; index++) {
    const row = rows[index]
    if (row === undefined) continue
    rowByHash.set(row.entry.hash, index)
  }

  const edges: GitGraphEdge[] = []
  for (let index = 0; index < rows.length; index++) {
    const row = rows[index]
    if (row === undefined) continue
    for (const parent of row.entry.parents) {
      const toRow = rowByHash.get(parent)
      if (toRow === undefined) continue
      const target = rows[toRow]
      if (target === undefined) continue
      const colorIndex = row.nodeLane === target.nodeLane
        ? row.colorIndex
        : Math.max(row.colorIndex, target.colorIndex)
      edges.push({
        fromRow: index,
        fromLane: row.nodeLane,
        toRow,
        toLane: target.nodeLane,
        colorIndex,
      })
    }
  }

  return { rows, edges }
}
