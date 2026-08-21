// @vitest-environment jsdom
/** selectionTargetForCall maps running and settled blocks to SelectionTarget. */
import { describe, expect, it } from 'vitest'
import type { ToolResultNode } from '@deepseek-ai/dsh-client-runtime/client'
import { selectionTargetForCall } from '../src/client/tool/selection-target.ts'

describe('selectionTargetForCall', () => {
  it('uses turn and step for a running call', () => {
    expect(selectionTargetForCall({
      callId: 'c1',
      name: 'bash',
      argsRaw: '{}',
      turn: 4,
      step: 2,
      time: 0,
      callView: null,
      subCalls: [],
    }, 'bash')).toEqual({
      turnSeq: 4,
      stepSeq: 2,
      callId: 'c1',
      toolName: 'bash',
    })
  })

  it('uses seq for a settled call', () => {
    const settled: ToolResultNode = {
      kind: 'tool-result',
      seq: 9,
      time: 0,
      callId: 'c2',
      call: { name: 'read', argsRaw: '{}' },
      callTime: 0,
      content: [],
      isError: false,
      callView: null,
      resultView: null,
      subCalls: [],
    }
    expect(selectionTargetForCall(settled, 'read')).toEqual({
      turnSeq: 9,
      callId: 'c2',
      toolName: 'read',
    })
  })
})
