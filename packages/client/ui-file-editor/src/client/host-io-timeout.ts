/** Client-side bounds for Host file I/O invoked from the file editor. */

/** Reject a directory listing that exceeds this duration. */
export const DIRECTORY_LISTING_TIMEOUT_MS = 30_000

/** Reject a file read that exceeds this duration. */
export const FILE_READ_TIMEOUT_MS = 30_000

/**
 * Race `operation` against a timeout; aborts `controller` when the timer fires.
 * @param operation - Host promise.
 * @param controller - per-request abort handle.
 * @param timeoutMs - maximum wait in milliseconds.
 * @param timeoutMessage - rejection message when the timer fires.
 */
export function withHostIoTimeout<T>(
  operation: Promise<T>,
  controller: AbortController,
  timeoutMs: number,
  timeoutMessage: string,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      controller.abort(new Error(timeoutMessage))
      reject(new Error(timeoutMessage))
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
