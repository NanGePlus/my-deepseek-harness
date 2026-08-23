/**
 * Display projection for user message bubbles: file-context prompt blocks
 * collapse to composer-style pills; `/name` and `@name` tokens decorate as chips.
 * Logged text stays the model-visible source; this module is presentation only.
 */

import type { ReactNode } from 'react'
import { MessageText } from '@deepseek-ai/dsh-client-ui-primitives'
import css from './MessageItem.module.css'

/** Matches one serialized file-context block produced by formatFileContextPrompt. */
export const FILE_CONTEXT_PROMPT_BLOCK =
  /From `([^`]+)` \((line (\d+)|lines (\d+)-(\d+))\):\n\n```[\s\S]*?```(?:\n<!--dsh:fc:([A-Za-z0-9_-]+)-->)?/g

/** One parsed file-context block inside logged user text. */
export interface ParsedFileContextBlock {
  /** Full matched span in the logged text. */
  readonly match: string
  /** Zero-based start index of {@link match}. */
  readonly start: number
  /** Chip label (`basename (line)` / `basename (start-end)`). */
  readonly label: string
  /** Encoded file-context ref when the block carries display metadata. */
  readonly ref?: string | undefined
}

/**
 * Decode a base64url-encoded file-context ref from a logged prompt block.
 * @param encoded - metadata payload from the HTML comment suffix.
 */
export function decodeFileContextPromptMeta(encoded: string): string {
  const base64 = encoded.replace(/-/g, '+').replace(/_/g, '/')
  const padLen = (4 - (base64.length % 4)) % 4
  const padded = padLen === 0 ? base64 : `${base64}${'='.repeat(padLen)}`
  const binary = atob(padded)
  const bytes = Uint8Array.from(binary, ch => ch.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

/**
 * Scan logged user text for serialized file-context blocks.
 * @param text - joined user message text blocks.
 */
export function parseFileContextPromptBlocks(text: string): readonly ParsedFileContextBlock[] {
  const blocks: ParsedFileContextBlock[] = []
  const re = new RegExp(FILE_CONTEXT_PROMPT_BLOCK.source, 'g')
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    const name = m[1] ?? ''
    const singleLine = m[3]
    const rangeStart = m[4]
    const rangeEnd = m[5]
    const label = singleLine !== undefined
      ? `${name} (${singleLine})`
      : `${name} (${rangeStart}-${rangeEnd})`
    blocks.push({
      match: m[0],
      start: m.index,
      label,
      ...(m[6] !== undefined ? { ref: decodeFileContextPromptMeta(m[6]) } : {}),
    })
  }
  return blocks
}

function projectSlashAtTokens(text: string, keyPrefix: string): ReactNode[] {
  const re = /(^|\s)([/@][\w-]+)(?=\s|$)/g
  const parts: ReactNode[] = []
  let cursor = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    const tokenStart = m.index + (m[1]?.length ?? 0)
    const label = m[2] ?? ''
    const key = `${keyPrefix}-${tokenStart}`
    if (tokenStart > cursor) parts.push(<MessageText key={`${key}-pre`} text={text.slice(cursor, tokenStart)} />)
    parts.push(
      <span key={key} className={css.refChip} data-ref-chip={label.startsWith('@') ? 'subagent' : 'skill'}>
        {label}
      </span>,
    )
    cursor = tokenStart + label.length
  }
  if (parts.length === 0 && text !== '') return [<MessageText key={`${keyPrefix}-plain`} text={text} />]
  if (cursor < text.length) parts.push(<MessageText key={`${keyPrefix}-post`} text={text.slice(cursor)} />)
  return parts
}

/**
 * Render logged user text with file-context blocks and slash/subagent chips projected.
 * @param text - joined user message text blocks.
 * @param openReferenceChip - open one encoded reference chip when present.
 */
export function projectUserText(
  text: string,
  openReferenceChip?: ((source: string, ref: string) => void) | undefined,
): ReactNode {
  const fileBlocks = parseFileContextPromptBlocks(text)
  if (fileBlocks.length === 0) {
    const slashParts = projectSlashAtTokens(text, 'user')
    if (slashParts.length === 0) return <MessageText text={text} />
    return <>{slashParts}</>
  }

  const parts: ReactNode[] = []
  let cursor = 0
  for (const block of fileBlocks) {
    if (block.start > cursor) {
      parts.push(...projectSlashAtTokens(text.slice(cursor, block.start), `seg-${cursor}`))
    }
    if (openReferenceChip !== undefined && block.ref !== undefined) {
      const ref = block.ref
      parts.push(
        <button
          key={`fc-${block.start}`}
          type="button"
          className={css.fileContextChip}
          data-ref-chip="file-context"
          onClick={() => { openReferenceChip('file-context', ref) }}
        >
          {block.label}
        </button>,
      )
    } else {
      parts.push(
        <span key={`fc-${block.start}`} className={css.fileContextChip} data-ref-chip="file-context">
          {block.label}
        </span>,
      )
    }
    cursor = block.start + block.match.length
  }
  if (cursor < text.length) parts.push(...projectSlashAtTokens(text.slice(cursor), `tail-${cursor}`))
  if (parts.length === 0) return <MessageText text={text} />
  return <>{parts}</>
}
