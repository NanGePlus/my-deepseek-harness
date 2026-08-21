// ToolDetailsBody: the Tool 详情 tab content — selected call args and output.

import { Fragment } from 'react'
import { CodeBlock } from '@deepseek-ai/dsh-client-ui-primitives'
import { shallowEqual } from '@deepseek-ai/dsh-client-runtime/client'
import type { SnapshotSelectorHook } from '@deepseek-ai/dsh-client-ui-slots'
import type { SessionChatBinding } from '../session-bound-source.ts'
import type { ConversationSnapshot, RunningToolCall, SessionId, ToolCallBlock, ToolResultNode } from '@deepseek-ai/dsh-client-runtime/client'
import type { DetailsSlotProps } from '../contract/slots.ts'
import { findToolCall } from '../chat/tool-node-reader.ts'
import css from './DetailsPanel.module.css'

type ToolDetailsBodyProps = Pick<
  DetailsSlotProps,
  'useSessions' | 'renderSlot' | 't'
> & {
  sessionId: SessionId | undefined
  useChat: SnapshotSelectorHook<SessionChatBinding>
  useSession: SnapshotSelectorHook<ConversationSnapshot>
}

interface CallMaterial {
  name: string
  argsRaw: string | null
  block: ToolCallBlock
}

function settledMaterial(node: ToolResultNode, callId: string): CallMaterial {
  return { name: node.call?.name ?? callId, argsRaw: node.call?.argsRaw ?? null, block: node }
}

function runningMaterial(call: RunningToolCall): CallMaterial {
  return { name: call.name, argsRaw: call.argsRaw, block: call }
}

function materialFor(s: ConversationSnapshot, callId: string): CallMaterial | null {
  const found = findToolCall(s, callId)
  if (found === undefined) return null
  return 'kind' in found ? settledMaterial(found, callId) : runningMaterial(found)
}

function pretty(raw: string): string {
  try {
    return JSON.stringify(JSON.parse(raw), null, 2)
  } catch {
    return raw
  }
}

function rawResultText(block: ToolCallBlock): string {
  if (!('kind' in block)) return ''
  const parts = block.content.map(item => item.type === 'text' ? item.text : JSON.stringify(item, null, 2))
  if (parts.length === 0 && block.error !== undefined) parts.push(`${block.error.name}: ${block.error.code}`)
  return parts.join('\n')
}

/** Renders Tool 详情 tab body for the shared details store selection. */
export function ToolDetailsBody({ useSession, useSessions, sessionId, useChat, renderSlot, t }: ToolDetailsBodyProps) {
  const selection = useChat(binding => binding.state.selection)
  const sessionCwd = useSessions(list => sessionId === undefined ? undefined : list.byId[sessionId]?.cwd)
  const callId = selection?.callId
  const material = useSession(
    s => (callId === undefined ? null : materialFor(s, callId)),
    (a, b) => shallowEqual(a, b))

  if (selection === null || callId === undefined) {
    return <div className={css.empty}>{t('details.empty')}</div>
  }
  if (material === null) {
    return <div className={css.empty}>{t('details.notInWindow')}</div>
  }

  return (
    <>
      <div className={css.toolTitle}>{material.name}</div>
      {material.argsRaw !== null && (
        <section className={css.section}>
          <div className={css.sectionLabel}>{t('details.input')}</div>
          <CodeBlock code={pretty(material.argsRaw)} lang="json" copyLabel={t('copy')} copiedLabel={t('copied')} />
        </section>
      )}
      <section className={css.section}>
        <div className={css.sectionLabel}>{t('details.output')}</div>
        <Fragment key={callId}>
          {renderSlot('conversation.details.tool', { block: material.block, cwd: sessionCwd }, {
            fallback: 'kind' in material.block
              ? (
                <pre className={css.code} data-error={material.block.isError || undefined}>
                  {rawResultText(material.block)}
                </pre>
              )
              : <div className={css.empty}>{t('details.running')}</div>,
          })}
        </Fragment>
      </section>
    </>
  )
}
