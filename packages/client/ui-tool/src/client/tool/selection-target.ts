/** Selection target derived from one Tool call block. */

import type { ToolCallBlock } from '@deepseek-ai/dsh-client-runtime/client'
import type { SelectionTarget } from '@deepseek-ai/dsh-client-ui-conversation/client'

/**
 * Build the details-linkage target for one call row.
 * @param block - running or settled call material.
 * @param toolName - wire tool name for the row.
 * @returns selection payload written to the session chat store.
 */
export function selectionTargetForCall(block: ToolCallBlock, toolName: string): SelectionTarget {
  if ('kind' in block) {
    return { turnSeq: block.seq, callId: block.callId, toolName }
  }
  return { turnSeq: block.turn, stepSeq: block.step, callId: block.callId, toolName }
}
