/**
 * Repair a JSONL session log with a duplicate seq in the committed region.
 * Backs up the original artifact before rewriting.
 *
 * Usage:
 *   pnpm exec tsx scripts/repair-session-log.ts <path-to-session.jsonl.zstd>
 */
import { copyFileSync, readFileSync, writeFileSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'
import { decodeStorageRecord } from '../packages/core/session/src/chunk-rows.ts'
import { scanZstdFrames, createZstdFrameDecoder, compressZstdFrame } from '../packages/session/session-persistence-jsonl/src/zstd.ts'
import { SessionLogScanner } from '../packages/session/session-persistence-jsonl/src/format.ts'

const target = process.argv[2]
if (target === undefined) {
  console.error('usage: pnpm exec tsx scripts/repair-session-log.ts <session.jsonl.zstd>')
  process.exit(1)
}

const buffer = readFileSync(target)
const { frames } = scanZstdFrames(buffer)
const decoder = createZstdFrameDecoder()
const gen = decoder.decode(buffer, frames)
const headerFrame = gen.next()
if (headerFrame.done) throw new Error('missing header frame')
const headerBytes = Buffer.from(headerFrame.value)

const eventLines: string[] = []
for (const plaintext of gen) {
  let start = 0
  while (start < plaintext.length) {
    const nl = plaintext.indexOf(0x0A, start)
    if (nl === -1) break
    eventLines.push(plaintext.subarray(start, nl).toString('utf8'))
    start = nl + 1
  }
}

function eventSeq(line: string): number | undefined {
  const decoded = decodeStorageRecord(JSON.parse(line))
  if (decoded.length !== 1) return undefined
  const record = decoded[0]
  if (record === undefined) return undefined
  return record.seq
}

function eventType(line: string): string | undefined {
  const decoded = decodeStorageRecord(JSON.parse(line))
  if (decoded.length !== 1) return undefined
  const record = decoded[0]
  if (record === undefined) return undefined
  return record.type
}

let removed = 0
for (let i = 0; i < eventLines.length; i++) {
  const currentLine = eventLines[i]
  if (currentLine === undefined) continue
  const currentSeq = eventSeq(currentLine)
  const prevLine = i > 0 ? eventLines[i - 1] : undefined
  const prevSeq = prevLine === undefined ? undefined : eventSeq(prevLine)
  if (currentSeq === undefined || prevSeq === undefined || currentSeq !== prevSeq) continue
  const prevType = prevLine === undefined ? undefined : eventType(prevLine)
  const currentType = eventType(currentLine)
  if (prevType === 'session/end-seed' && currentType === 'agent/inbox/spliced') {
    eventLines.splice(i, 1)
    removed += 1
    i -= 1
    continue
  }
  throw new Error(
    `unsupported duplicate seq ${currentSeq} at lines ${i} (${prevType}) and ${i + 1} (${currentType})`,
  )
}

const body = Buffer.from(`${eventLines.join('\n')}\n`, 'utf8')
const scanner = new SessionLogScanner(headerBytes)
scanner.write(body)
scanner.finish()

const backup = join(dirname(target), `${basename(target)}.bak-${Date.now()}`)
copyFileSync(target, backup)
const headerOut = await compressZstdFrame(headerBytes)
const bodyOut = await compressZstdFrame(body)
writeFileSync(target, Buffer.concat([headerOut, bodyOut]))

console.log(`repaired ${target}`)
console.log(`removed ${removed} duplicate row(s)`)
console.log(`backup ${backup}`)
