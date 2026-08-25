/**
 * Per-Session commit-message drafts. Drafts are human UI state: they never
 * enter the session log and are not a model-visible input.
 */
import type { SessionId } from '@deepseek-ai/dsh-client-runtime/client'
import { defineStore, type EngineStoreHandle } from '@deepseek-ai/dsh-client-runtime/client'

/** Root store: one commit-message draft per Session. */
export interface GitPanelState {
  /** Draft text keyed by Session id; missing keys are an empty draft. */
  drafts: Partial<Record<SessionId, string>>
}

/** Annotation twin of the actions literal; drift fails at defineStore. */
type GitPanelActions = {
  setDraft: (root: GitPanelState, sessionId: SessionId, message: string) => void
  clearDraft: (root: GitPanelState, sessionId: SessionId) => void
}

/**
 * Create the Git-panel store handle (one root instance; drafts partitioned by Session).
 * @returns the store handle for `slots.register`.
 */
export function createGitPanelStore(): EngineStoreHandle<GitPanelState, GitPanelActions> {
  return defineStore({
    init: (): GitPanelState => ({ drafts: {} }),
    actions: {
      setDraft: (root, sessionId, message) => {
        root.drafts[sessionId] = message
      },
      clearDraft: (root, sessionId) => {
        const { [sessionId]: _cleared, ...rest } = root.drafts
        root.drafts = rest
      },
    },
  })
}
