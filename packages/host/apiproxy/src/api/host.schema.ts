/**
 * host domain zod schemas (names derived from map keys).
 */

import { z } from 'zod'
import type {
  DirectoryEntry, GitStatusEntry, GitWorkingTreeChange, GitDiffLine, GitDiffHunk, WorkspaceEntry, FileTextRead, FileBytesRead,
} from './host.ts'
import type { RequestPayload, ResponseValue } from './rpc-map.ts'
import type { Wire } from './rpc.schema.ts'
import { rpcErrorSchema } from './rpc.schema.ts'
import { workspaceIdSchema } from './sessions.schema.ts'

/** host.describe request payload (empty object literal). */
export const hostDescribeRequestSchema = z.object({}) satisfies z.ZodType<Wire<RequestPayload<'host.describe'>>>

/** host.describe response value. */
export const hostDescribeValueSchema = z.object({
  version: z.string(),
  cwd: z.string(),
  provider: z.string().optional(),
  model: z.string().optional(),
  attachedSessions: z.number().int().nonnegative(),
  canOpenPath: z.boolean(),
}) satisfies z.ZodType<Wire<ResponseValue<'host.describe'>>>

/** host.pickDirectory request payload (empty object literal). */
export const hostPickDirectoryRequestSchema = z.object({}) satisfies z.ZodType<Wire<RequestPayload<'host.pickDirectory'>>>

/** host.pickDirectory response value; null means the user cancelled. */
export const hostPickDirectoryValueSchema = z.object({
  path: z.string().nullable(),
}) satisfies z.ZodType<Wire<ResponseValue<'host.pickDirectory'>>>

/** Directory row shared by listing entries and breadcrumb crumbs. */
export const directoryEntrySchema = z.object({
  name: z.string(),
  path: z.string(),
  hidden: z.boolean(),
}) satisfies z.ZodType<Wire<DirectoryEntry>>

/** host.listDirectory request payload; an absent path lists the home directory. */
export const hostListDirectoryRequestSchema = z.object({
  path: z.string().optional(),
}) satisfies z.ZodType<Wire<RequestPayload<'host.listDirectory'>>>

/** host.listDirectory response value. */
export const hostListDirectoryValueSchema = z.object({
  path: z.string(),
  home: z.string(),
  crumbs: z.array(directoryEntrySchema),
  entries: z.array(directoryEntrySchema),
  truncated: z.boolean(),
}) satisfies z.ZodType<Wire<ResponseValue<'host.listDirectory'>>>

/** host.createDirectory request payload: name must be one plain path segment. */
export const hostCreateDirectoryRequestSchema = z.object({
  path: z.string(),
  name: z.string(),
}).refine(
  payload => payload.name.trim() !== '' && payload.name !== '.' && payload.name !== '..'
    && !/[/\\]/.test(payload.name),
  { message: 'host.createDirectory requires a single non-blank path segment name' },
) satisfies z.ZodType<Wire<RequestPayload<'host.createDirectory'>>>

/** host.createDirectory response value: the created directory's absolute path. */
export const hostCreateDirectoryValueSchema = z.object({
  path: z.string(),
}) satisfies z.ZodType<Wire<ResponseValue<'host.createDirectory'>>>

/** One row of host.listWorkspaceEntries. */
export const workspaceEntrySchema = z.object({
  name: z.string(),
  path: z.string(),
  isDirectory: z.boolean(),
  hidden: z.boolean(),
}) satisfies z.ZodType<Wire<WorkspaceEntry>>

/** host.listWorkspaceEntries request payload. */
export const hostListWorkspaceEntriesRequestSchema = z.object({
  workspaceId: workspaceIdSchema,
  path: z.string(),
}) satisfies z.ZodType<Wire<RequestPayload<'host.listWorkspaceEntries'>>>

/** host.listWorkspaceEntries response value. */
export const hostListWorkspaceEntriesValueSchema = z.object({
  path: z.string(),
  entries: z.array(workspaceEntrySchema),
  truncated: z.boolean(),
}) satisfies z.ZodType<Wire<ResponseValue<'host.listWorkspaceEntries'>>>

/** One Git badge row of host.gitStatus. */
export const gitStatusEntrySchema = z.object({
  path: z.string(),
  letter: z.string().min(1),
}) satisfies z.ZodType<Wire<GitStatusEntry>>

/** host.gitStatus request payload. */
export const hostGitStatusRequestSchema = z.object({
  workspaceId: workspaceIdSchema,
}) satisfies z.ZodType<Wire<RequestPayload<'host.gitStatus'>>>

/** host.gitStatus response value. */
export const hostGitStatusValueSchema = z.object({
  entries: z.array(gitStatusEntrySchema),
}) satisfies z.ZodType<Wire<ResponseValue<'host.gitStatus'>>>

/** One working-tree change row of host.gitWorkingTree. */
export const gitWorkingTreeChangeSchema = z.object({
  path: z.string(),
  absolutePath: z.string(),
  kind: z.enum(['modified', 'untracked', 'deleted']),
}) satisfies z.ZodType<Wire<GitWorkingTreeChange>>

/** host.gitWorkingTree request payload. */
export const hostGitWorkingTreeRequestSchema = z.object({
  workspaceId: workspaceIdSchema,
}) satisfies z.ZodType<Wire<RequestPayload<'host.gitWorkingTree'>>>

/** host.gitWorkingTree response value. */
export const hostGitWorkingTreeValueSchema = z.discriminatedUnion('availability', [
  z.object({ availability: z.literal('git-unavailable') }),
  z.object({ availability: z.literal('not-a-repository') }),
  z.object({
    availability: z.literal('repository'),
    repoRoot: z.string(),
    branch: z.string(),
    unstaged: z.array(gitWorkingTreeChangeSchema),
    staged: z.array(gitWorkingTreeChangeSchema),
    pushAvailable: z.boolean(),
    ahead: z.number().int().nonnegative().optional(),
  }),
]) satisfies z.ZodType<Wire<ResponseValue<'host.gitWorkingTree'>>>

/** host.gitInit request payload. */
export const hostGitInitRequestSchema = z.object({
  workspaceId: workspaceIdSchema,
}) satisfies z.ZodType<Wire<RequestPayload<'host.gitInit'>>>

/** host.gitInit response value. */
export const hostGitInitValueSchema = z.object({
  repoRoot: z.string(),
}) satisfies z.ZodType<Wire<ResponseValue<'host.gitInit'>>>

/** One unified-diff line of host.gitDiffPreview. */
export const gitDiffLineSchema = z.object({
  origin: z.enum(['context', 'add', 'del']),
  text: z.string(),
}) satisfies z.ZodType<Wire<GitDiffLine>>

/** One hunk of a tracked-text gitDiffPreview. */
export const gitDiffHunkSchema = z.object({
  header: z.string(),
  lines: z.array(gitDiffLineSchema),
}) satisfies z.ZodType<Wire<GitDiffHunk>>

/** host.gitDiffPreview request payload. */
export const hostGitDiffPreviewRequestSchema = z.object({
  workspaceId: workspaceIdSchema,
  path: z.string(),
  side: z.enum(['unstaged', 'staged']),
}) satisfies z.ZodType<Wire<RequestPayload<'host.gitDiffPreview'>>>

/** host.gitDiffPreview response value. */
export const hostGitDiffPreviewValueSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('text'), hunks: z.array(gitDiffHunkSchema), fileText: z.string() }),
  z.object({ kind: z.literal('untracked-text'), text: z.string() }),
  z.object({ kind: z.literal('binary') }),
  z.object({ kind: z.literal('deleted-text'), text: z.string() }),
  z.object({ kind: z.literal('deleted-binary') }),
]) satisfies z.ZodType<Wire<ResponseValue<'host.gitDiffPreview'>>>

/** host.gitStage request payload. */
export const hostGitStageRequestSchema = z.object({
  workspaceId: workspaceIdSchema,
  path: z.string(),
  hunkHeader: z.string().min(1).optional(),
}) satisfies z.ZodType<Wire<RequestPayload<'host.gitStage'>>>

/** host.gitStage response value (refreshed working tree). */
export const hostGitStageValueSchema = hostGitWorkingTreeValueSchema satisfies z.ZodType<Wire<ResponseValue<'host.gitStage'>>>

/** host.gitUnstage request payload. */
export const hostGitUnstageRequestSchema = z.object({
  workspaceId: workspaceIdSchema,
  path: z.string(),
  hunkHeader: z.string().min(1).optional(),
}) satisfies z.ZodType<Wire<RequestPayload<'host.gitUnstage'>>>

/** host.gitUnstage response value (refreshed working tree). */
export const hostGitUnstageValueSchema = hostGitWorkingTreeValueSchema satisfies z.ZodType<Wire<ResponseValue<'host.gitUnstage'>>>

/** host.gitDiscard request payload. */
export const hostGitDiscardRequestSchema = z.object({
  workspaceId: workspaceIdSchema,
  path: z.string(),
  hunkHeader: z.string().min(1).optional(),
}) satisfies z.ZodType<Wire<RequestPayload<'host.gitDiscard'>>>

/** host.gitDiscard response value (refreshed working tree). */
export const hostGitDiscardValueSchema = hostGitWorkingTreeValueSchema satisfies z.ZodType<Wire<ResponseValue<'host.gitDiscard'>>>

/** host.gitCommit request payload. */
export const hostGitCommitRequestSchema = z.object({
  workspaceId: workspaceIdSchema,
  message: z.string(),
  push: z.boolean().optional(),
}) satisfies z.ZodType<Wire<RequestPayload<'host.gitCommit'>>>

/** host.gitCommit response value (refreshed working tree). */
export const hostGitCommitValueSchema = hostGitWorkingTreeValueSchema satisfies z.ZodType<Wire<ResponseValue<'host.gitCommit'>>>

/** host.gitPush request payload. */
export const hostGitPushRequestSchema = z.object({
  workspaceId: workspaceIdSchema,
}) satisfies z.ZodType<Wire<RequestPayload<'host.gitPush'>>>

/** host.gitPush response value (refreshed working tree). */
export const hostGitPushValueSchema = hostGitWorkingTreeValueSchema satisfies z.ZodType<Wire<ResponseValue<'host.gitPush'>>>

/** host.readFile request payload. */
export const hostReadFileRequestSchema = z.object({
  workspaceId: workspaceIdSchema,
  path: z.string(),
  kind: z.enum(['text', 'bytes']),
}) satisfies z.ZodType<Wire<RequestPayload<'host.readFile'>>>

/** host.readFile response value for text reads. */
export const fileTextReadSchema = z.object({
  kind: z.literal('text'),
  path: z.string(),
  text: z.string(),
}) satisfies z.ZodType<Wire<FileTextRead>>

/** host.readFile response value for byte reads. */
export const fileBytesReadSchema = z.object({
  kind: z.literal('bytes'),
  path: z.string(),
  data: z.string(),
  mediaType: z.string(),
}) satisfies z.ZodType<Wire<FileBytesRead>>

/** host.readFile response value. */
export const hostReadFileValueSchema = z.discriminatedUnion('kind', [
  fileTextReadSchema,
  fileBytesReadSchema,
]) satisfies z.ZodType<Wire<ResponseValue<'host.readFile'>>>

/** host.writeFile request payload. */
export const hostWriteFileRequestSchema = z.object({
  workspaceId: workspaceIdSchema,
  path: z.string(),
  text: z.string(),
}) satisfies z.ZodType<Wire<RequestPayload<'host.writeFile'>>>

/** host.writeFile response value. */
export const hostWriteFileValueSchema = z.object({
  path: z.string(),
}) satisfies z.ZodType<Wire<ResponseValue<'host.writeFile'>>>

/** host.deletePath request payload. */
export const hostDeletePathRequestSchema = z.object({
  workspaceId: workspaceIdSchema,
  path: z.string(),
}) satisfies z.ZodType<Wire<RequestPayload<'host.deletePath'>>>

/** host.deletePath response value. */
export const hostDeletePathValueSchema = z.object({
  path: z.string(),
}) satisfies z.ZodType<Wire<ResponseValue<'host.deletePath'>>>

/** host.renamePath request payload: newName must be one plain path segment. */
export const hostRenamePathRequestSchema = z.object({
  workspaceId: workspaceIdSchema,
  path: z.string(),
  newName: z.string(),
}).refine(
  payload => payload.newName.trim() !== '' && payload.newName !== '.' && payload.newName !== '..'
    && !/[/\\]/.test(payload.newName),
  { message: 'host.renamePath requires a single non-blank path segment newName' },
) satisfies z.ZodType<Wire<RequestPayload<'host.renamePath'>>>

/** host.renamePath response value. */
export const hostRenamePathValueSchema = z.object({
  path: z.string(),
}) satisfies z.ZodType<Wire<ResponseValue<'host.renamePath'>>>

/** host.createWorkspaceDirectory request payload: name must be one plain path segment. */
export const hostCreateWorkspaceDirectoryRequestSchema = z.object({
  workspaceId: workspaceIdSchema,
  path: z.string(),
  name: z.string(),
}).refine(
  payload => payload.name.trim() !== '' && payload.name !== '.' && payload.name !== '..'
    && !/[/\\]/.test(payload.name),
  { message: 'host.createWorkspaceDirectory requires a single non-blank path segment name' },
) satisfies z.ZodType<Wire<RequestPayload<'host.createWorkspaceDirectory'>>>

/** host.createWorkspaceDirectory response value. */
export const hostCreateWorkspaceDirectoryValueSchema = z.object({
  path: z.string(),
}) satisfies z.ZodType<Wire<ResponseValue<'host.createWorkspaceDirectory'>>>

/** host.openPath request payload. */
export const hostOpenPathRequestSchema = z.object({
  path: z.string().min(1),
}) satisfies z.ZodType<Wire<RequestPayload<'host.openPath'>>>

/** host.openPath response value. */
export const hostOpenPathValueSchema = z.object({
  opened: z.literal(true),
}) satisfies z.ZodType<Wire<ResponseValue<'host.openPath'>>>

/** host.watchPath GET query: workspace-bound absolute path to watch. */
export const hostWatchPathQuerySchema = z.object({
  workspaceId: workspaceIdSchema,
  path: z.string(),
})

/** host.watchPath stream frame union. */
export const watchPathFrameSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('host/path-changed'), path: z.string() }),
  z.object({ type: z.literal('stream/error'), error: rpcErrorSchema }),
])

const hostLspPositionSchema = z.object({
  line: z.number().int().min(0),
  character: z.number().int().min(0),
})

const hostLspRangeSchema = z.object({
  start: hostLspPositionSchema,
  end: hostLspPositionSchema,
})

const hostLspDiagnosticSchema = z.object({
  message: z.string(),
  severity: z.enum(['error', 'warning', 'info', 'hint']),
  range: hostLspRangeSchema,
})

/** host.lspSyncDocument request payload. */
export const hostLspSyncDocumentRequestSchema = z.object({
  workspaceId: workspaceIdSchema,
  path: z.string(),
  text: z.string(),
  version: z.number().int().min(1),
}) satisfies z.ZodType<Wire<RequestPayload<'host.lspSyncDocument'>>>

/** host.lspSyncDocument response value. */
export const hostLspSyncDocumentValueSchema = z.object({
  diagnostics: z.array(hostLspDiagnosticSchema),
}) satisfies z.ZodType<Wire<ResponseValue<'host.lspSyncDocument'>>>

/** host.lspCloseDocument request payload. */
export const hostLspCloseDocumentRequestSchema = z.object({
  workspaceId: workspaceIdSchema,
  path: z.string(),
}) satisfies z.ZodType<Wire<RequestPayload<'host.lspCloseDocument'>>>

/** host.lspCloseDocument response value. */
export const hostLspCloseDocumentValueSchema = z.object({
  closed: z.literal(true),
}) satisfies z.ZodType<Wire<ResponseValue<'host.lspCloseDocument'>>>

/** host.lspHoverDocument request payload. */
export const hostLspHoverDocumentRequestSchema = z.object({
  workspaceId: workspaceIdSchema,
  path: z.string(),
  text: z.string(),
  version: z.number().int().min(1),
  line: z.number().int().min(0),
  character: z.number().int().min(0),
}) satisfies z.ZodType<Wire<RequestPayload<'host.lspHoverDocument'>>>

const hostLspHoverSchema = z.object({
  contents: z.string(),
  range: hostLspRangeSchema.optional(),
})

/** host.lspHoverDocument response value. */
export const hostLspHoverDocumentValueSchema = z.object({
  hover: hostLspHoverSchema.nullable(),
}) satisfies z.ZodType<Wire<ResponseValue<'host.lspHoverDocument'>>>
