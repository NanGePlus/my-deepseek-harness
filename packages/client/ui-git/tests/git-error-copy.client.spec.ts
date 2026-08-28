import { describe, expect, it } from 'vitest'
import { isMissingRemoteGitError, isRejectedPushGitError } from '../src/client/git-error-copy.ts'

describe('isMissingRemoteGitError', () => {
  it('matches the Host token and Git push copy for a missing remote', () => {
    expect(isMissingRemoteGitError('no remote configured')).toBe(true)
    expect(isMissingRemoteGitError('fatal: No configured push destination.\nEither specify the URL')).toBe(true)
    expect(isMissingRemoteGitError("fatal: 'origin' does not appear to be a git repository\nfatal: Could not read from remote repository.")).toBe(false)
    expect(isMissingRemoteGitError("fatal: No such remote 'origin'")).toBe(true)
    expect(isMissingRemoteGitError('Author identity unknown')).toBe(false)
  })
})

describe('isRejectedPushGitError', () => {
  it('matches Git non-fast-forward rejection copy', () => {
    expect(isRejectedPushGitError(' ! [rejected]        HEAD -> main (fetch first)\nerror: failed to push some refs')).toBe(true)
    expect(isRejectedPushGitError('error: failed to push some refs to \'https://github.com/org/repo.git\'\nhint: non-fast-forward')).toBe(true)
    expect(isRejectedPushGitError(' ! [remote rejected] main -> main (permission denied)')).toBe(false)
    expect(isRejectedPushGitError('no remote configured')).toBe(false)
  })
})
