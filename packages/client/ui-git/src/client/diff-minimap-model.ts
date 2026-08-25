/** Minimap change markers for the Git diff preview. */

import type { DiffPreviewRow } from './diff-preview-model.ts'

/** One change marker positioned on the minimap track. */
export type MinimapMarker = {
  /** Vertical center of the change in scroll order, 0–1. */
  topRatio: number
  del: boolean
  add: boolean
}

type MinimapSegment = {
  del: boolean
  add: boolean
  truncated: boolean
  weight: number
}

/**
 * Build one marker per logical change segment (not per compressed bucket).
 * @param rows - flattened preview rows in render order.
 * @param rowWeights - optional measured DOM height per render row.
 */
export function buildMinimapMarkers(
  rows: readonly DiffPreviewRow[],
  rowWeights?: readonly number[],
): MinimapMarker[] {
  if (rows.length === 0) return []
  const weights = rowWeights !== undefined && rowWeights.length === rows.length
    ? rowWeights
    : rows.map(() => 1)
  const segments = collapseRenderSegments(rows, weights)
  const total = segments.reduce((sum, segment) => sum + segment.weight, 0)
  if (total <= 0) return []

  const markers: MinimapMarker[] = []
  let cumulative = 0
  for (const segment of segments) {
    const center = cumulative + segment.weight / 2
    cumulative += segment.weight
    if (!segment.del && !segment.add) continue
    markers.push({
      topRatio: center / total,
      del: segment.del,
      add: segment.add,
    })
  }
  return markers
}

function collapseRenderSegments(
  rows: readonly DiffPreviewRow[],
  weights: readonly number[],
): MinimapSegment[] {
  const segments: MinimapSegment[] = []
  for (let index = 0; index < rows.length; index++) {
    const row = rows[index]
    if (row === undefined) continue
    const weight = weights[index] ?? 1
    if (row.kind === 'truncated') {
      segments.push({ del: false, add: false, truncated: true, weight })
      continue
    }
    const next = rows[index + 1]
    if (row.origin === 'del' && next?.kind === 'line' && next.origin === 'add') {
      segments.push({
        del: true,
        add: true,
        truncated: false,
        weight: weight + (weights[index + 1] ?? 1),
      })
      index++
      continue
    }
    segments.push({
      del: row.origin === 'del',
      add: row.origin === 'add',
      truncated: false,
      weight,
    })
  }
  return segments
}
