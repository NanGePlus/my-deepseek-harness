/** Client-side bounds for workspace directory listing fetches. */

import {
  DIRECTORY_LISTING_TIMEOUT_MS,
  withHostIoTimeout,
} from './host-io-timeout.ts'

export { DIRECTORY_LISTING_TIMEOUT_MS } from './host-io-timeout.ts'

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
  return withHostIoTimeout(operation, controller, timeoutMs, 'directory listing timed out')
}
