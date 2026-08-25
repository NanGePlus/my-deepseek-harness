/** Bucketed minimap tones for the Git diff preview. */

import type { DiffPreviewRow } from './diff-preview-model.ts'

export type MinimapTone = 'header' | 'add' | 'del' | 'context' | 'truncated'

/** Fixed bucket count keeps minimap height bounded for large files. */
export const MINIMAP_BUCKET_COUNT = 120

/**
 * Compress preview rows into a fixed number of minimap buckets.
 * @param rows - flattened preview rows.
 */
export function buildMinimapBuckets(
  rows: readonly DiffPreviewRow[],
  bucketCount = MINIMAP_BUCKET_COUNT,
): MinimapTone[] {
  if (rows.length === 0 || bucketCount <= 0) return []
  const buckets: MinimapTone[] = []
  for (let index = 0; index < bucketCount; index++) {
    const start = Math.floor(index * rows.length / bucketCount)
    const end = Math.floor((index + 1) * rows.length / bucketCount)
    buckets.push(dominantMinimapTone(rows.slice(start, end)))
  }
  return buckets
}

function dominantMinimapTone(rows: readonly DiffPreviewRow[]): MinimapTone {
  let hasHeader = false
  let hasDel = false
  let hasAdd = false
  for (const row of rows) {
    if (row.kind === 'truncated') return 'truncated'
    if (row.kind === 'header') hasHeader = true
    else if (row.origin === 'del') hasDel = true
    else if (row.origin === 'add') hasAdd = true
  }
  if (hasDel) return 'del'
  if (hasAdd) return 'add'
  if (hasHeader) return 'header'
  return 'context'
}
