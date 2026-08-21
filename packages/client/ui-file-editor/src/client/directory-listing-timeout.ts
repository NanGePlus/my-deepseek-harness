/** Client-side bounds for workspace directory listing fetches. */

/** Reject a directory listing that exceeds this duration. */
export const DIRECTORY_LISTING_TIMEOUT_MS = 30_000

/**
 * Race `operation` against a timeout; aborts `controller` when the timer fires.
 * @param operation - Host listing promise.
 * @param controller - per-directory abort handle.
 * @param timeoutMs - maximum wait in milliseconds.
 */
export function withDirectoryListingTimeout<T>(
  operation: Promise<T>,
  controller: AbortController,
  timeoutMs: number = DIRECTORY_LISTING_TIMEOUT_MS,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      controller.abort(new Error('directory listing timed out'))
      reject(new Error('directory listing timed out'))
    }, timeoutMs)
    operation.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (reason: unknown) => {
        clearTimeout(timer)
        reject(reason instanceof Error ? reason : new Error(String(reason)))
      },
    )
  })
}
