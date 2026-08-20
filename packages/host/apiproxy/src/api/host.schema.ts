/**
 * host domain zod schemas (names derived from map keys).
 */

import { z } from 'zod'
import type { DirectoryEntry, GitStatusEntry, WorkspaceEntry, FileTextRead, FileBytesRead } from './host.ts'
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
