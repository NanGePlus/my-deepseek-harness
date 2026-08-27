import { describe, expect, it } from 'vitest'
import {
  gitGraphColumnHeight, gitGraphEdgePath, gitGraphNodeY, gitGraphRowGutterWidth, gitGraphRowHeight,
  gitGraphRowTops, gitGraphSvgWidth, GIT_GRAPH_ARC_PAD, GIT_GRAPH_LANE_WIDTH, GIT_GRAPH_REF_LINE_HEIGHT,
  GIT_GRAPH_ROW_HEIGHT, laneCenterX, layoutGitGraph,
} from '../src/client/git-graph-layout.ts'
import type { GitLogEntry } from '@deepseek-ai/dsh-client-runtime/client'

function entry(hash: string, parents: string[], subject = hash): GitLogEntry {
  return {
    hash,
    shortHash: hash.slice(0, 7),
    parents,
    subject,
    authorName: 'Author',
    authorDate: '2026-08-27T00:00:00.000Z',
    body: '',
    refs: [],
  }
}

describe('layoutGitGraph', () => {
  it('assigns a single lane for linear history', () => {
    const { rows, edges } = layoutGitGraph([
      entry('c3', ['c2']),
      entry('c2', ['c1']),
      entry('c1', []),
    ])
    expect(rows.map(row => row.nodeLane)).toEqual([0, 0, 0])
    expect(rows[0]?.laneCount).toBe(1)
    expect(rows.every(row => row.isMerge === false)).toBe(true)
    expect(edges.every(edge => edge.fromLane === 0 && edge.toLane === 0)).toBe(true)
  })

  it('places a merge on the trunk and the feature parent on a side lane with node-to-node arcs', () => {
    const { rows, edges } = layoutGitGraph([
      entry('merge', ['main', 'feature']),
      entry('main', ['root']),
      entry('feature', ['root']),
      entry('root', []),
    ])
    expect(rows.map(row => row.nodeLane)).toEqual([0, 0, 1, 0])
    expect(rows[0]?.isMerge).toBe(true)
    expect(edges).toEqual(expect.arrayContaining([
      { fromRow: 0, fromLane: 0, toRow: 1, toLane: 0, colorIndex: 0 },
      { fromRow: 0, fromLane: 0, toRow: 2, toLane: 1, colorIndex: 1 },
      { fromRow: 2, fromLane: 1, toRow: 3, toLane: 0, colorIndex: 1 },
    ]))
  })

  it('rotates side-lane color when a later merge reuses a freed lane', () => {
    const { rows, edges } = layoutGitGraph([
      entry('merge12', ['merge11', 'feat4']),
      entry('feat4', ['merge11']),
      entry('merge11', ['root', 'feat5']),
      entry('feat5', ['root']),
      entry('root', []),
    ])
    expect(rows.map(row => row.nodeLane)).toEqual([0, 1, 0, 1, 0])
    const sideColors = edges.filter(edge => edge.fromLane !== edge.toLane).map(edge => edge.colorIndex)
    expect(new Set(sideColors).size).toBeGreaterThan(1)
  })

  it('matches Git Graph semantics on sequential pull-request merges', () => {
    const { rows, edges } = layoutGitGraph([
      entry('tip', ['m8']),
      entry('m8', ['m7', 'f8']),
      entry('f8', ['m7']),
      entry('m7', ['m6', 'f7']),
      entry('f7', ['m6']),
      entry('m6', ['base', 'f6b']),
      entry('f6b', ['f6a']),
      entry('f6a', ['base']),
      entry('base', []),
    ])
    expect(rows.map(row => row.nodeLane)).toEqual([0, 0, 1, 0, 1, 0, 1, 1, 0])
    expect(rows.filter(row => row.isMerge).map(row => row.entry.hash)).toEqual(['m8', 'm7', 'm6'])
    expect(rows.filter(row => row.isMerge).every(row => row.nodeLane === 0 && row.colorIndex === 0)).toBe(true)
    const side = edges.filter(edge => edge.fromLane !== edge.toLane)
    expect(new Set(side.map(edge => edge.colorIndex)).size).toBe(3)
    expect(side.every(edge => edge.colorIndex !== 0)).toBe(true)
    expect(edges).toEqual(expect.arrayContaining([
      expect.objectContaining({ fromRow: 6, fromLane: 1, toRow: 7, toLane: 1 }),
    ]))
  })

  it('caps concurrent lanes at GIT_GRAPH_MAX_LANES', () => {
    const parents = Array.from({ length: 8 }, (_, index) => `p${String(index)}`)
    const { rows } = layoutGitGraph([
      entry('octopus', parents),
      ...parents.map(hash => entry(hash, [])),
    ])
    expect(Math.max(...rows.map(row => row.laneCount))).toBeLessThanOrEqual(6)
  })
})

describe('gitGraphEdgePath', () => {
  it('draws a vertical segment for a same-lane edge', () => {
    expect(gitGraphEdgePath({
      fromRow: 0, fromLane: 0, toRow: 1, toLane: 0, colorIndex: 0,
    })).toContain('L')
  })

  it('draws a cubic whose control x sits on the outer lane so the node stays on the arc', () => {
    const edge = { fromRow: 0, fromLane: 0, toRow: 1, toLane: 1, colorIndex: 1 }
    const d = gitGraphEdgePath(edge)
    const y1 = GIT_GRAPH_ROW_HEIGHT / 2
    const y2 = GIT_GRAPH_ROW_HEIGHT + GIT_GRAPH_ROW_HEIGHT / 2
    const outerX = laneCenterX(1)
    expect(d).toContain(`M ${String(laneCenterX(0))} ${String(y1)}`)
    expect(d).toContain(String(y2))
    expect(d).toContain(`C ${String(outerX)}`)
    expect(d).not.toContain(' L ')
    expect(d).not.toContain(String(outerX + GIT_GRAPH_LANE_WIDTH * 0.75))
  })

  it('keeps node Y on the subject line when a later row grows for pills', () => {
    const tops = gitGraphRowTops([2, 0])
    expect(tops).toEqual([0, GIT_GRAPH_ROW_HEIGHT + GIT_GRAPH_REF_LINE_HEIGHT])
    expect(gitGraphRowHeight(0)).toBe(GIT_GRAPH_ROW_HEIGHT)
    expect(gitGraphRowHeight(1)).toBe(GIT_GRAPH_ROW_HEIGHT + GIT_GRAPH_REF_LINE_HEIGHT)
    expect(gitGraphColumnHeight([2, 0])).toBe(GIT_GRAPH_ROW_HEIGHT * 2 + GIT_GRAPH_REF_LINE_HEIGHT)
    const d = gitGraphEdgePath(
      { fromRow: 0, fromLane: 0, toRow: 1, toLane: 0, colorIndex: 0 },
      tops,
    )
    expect(d).toContain(` ${String(gitGraphNodeY(0, tops))} `)
    expect(d).toContain(` ${String(gitGraphNodeY(1, tops))}`)
    expect(gitGraphNodeY(0, tops)).toBe(GIT_GRAPH_ROW_HEIGHT / 2)
    expect(gitGraphNodeY(1, tops)).toBe(GIT_GRAPH_ROW_HEIGHT + GIT_GRAPH_REF_LINE_HEIGHT + GIT_GRAPH_ROW_HEIGHT / 2)
  })

  it('pads SVG width so the outward bulge is not clipped', () => {
    expect(gitGraphSvgWidth(2)).toBe(2 * GIT_GRAPH_LANE_WIDTH + GIT_GRAPH_ARC_PAD)
  })
})

describe('gitGraphRowGutterWidth', () => {
  it('hugs a trunk-only row instead of the page-wide max lane', () => {
    const { rows, edges } = layoutGitGraph([
      entry('tip', ['merge']),
      entry('merge', ['main', 'feature']),
      entry('main', ['root']),
      entry('feature', ['root']),
      entry('root', []),
    ])
    expect(gitGraphRowGutterWidth(0, rows[0]!.nodeLane, edges)).toBe(GIT_GRAPH_LANE_WIDTH)
    expect(gitGraphRowGutterWidth(1, rows[1]!.nodeLane, edges)).toBe(2 * GIT_GRAPH_LANE_WIDTH)
    expect(gitGraphRowGutterWidth(2, rows[2]!.nodeLane, edges)).toBe(2 * GIT_GRAPH_LANE_WIDTH)
    expect(gitGraphRowGutterWidth(3, rows[3]!.nodeLane, edges)).toBe(2 * GIT_GRAPH_LANE_WIDTH)
  })
})
