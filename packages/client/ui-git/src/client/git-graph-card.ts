/** Hover-card placement and relative-age labels for Graph ref pills. */

/** Card width in CSS pixels (matches `.graphCommitCard`). */
export const GIT_GRAPH_CARD_WIDTH = 360

/** Maximum card height in CSS pixels before the body scrolls. */
export const GIT_GRAPH_CARD_MAX_HEIGHT = 360

/** Viewport inset so a card never sits flush against an edge. */
const EDGE = 12

/** Delay before the hover card hides after the pointer leaves the pill or card. */
export const GIT_GRAPH_CARD_HIDE_MS = 120

/** Relative age used to pick a locale key for the hover-card header. */
export type RelativeCommitAge =
  | { kind: 'justNow' }
  | { kind: 'minutesAgo'; count: number }
  | { kind: 'hoursAgo'; count: number }
  | { kind: 'daysAgo'; count: number }
  | { kind: 'monthsAgo'; count: number }
  | { kind: 'yearsAgo'; count: number }

/**
 * Classify how long ago `iso` is relative to `nowMs`.
 * @param iso - author date from `GitLogEntry.authorDate`.
 * @param nowMs - comparison instant (`Date.now()` in the UI).
 * @returns a locale-key discriminant; invalid or future instants are `justNow`.
 */
export function relativeCommitAge(iso: string, nowMs: number): RelativeCommitAge {
  const then = Date.parse(iso)
  if (Number.isNaN(then)) return { kind: 'justNow' }
  const delta = nowMs - then
  if (delta < 45_000) return { kind: 'justNow' }
  const minutes = Math.round(delta / 60_000)
  if (minutes < 60) return { kind: 'minutesAgo', count: Math.max(1, minutes) }
  const hours = Math.round(delta / 3_600_000)
  if (hours < 24) return { kind: 'hoursAgo', count: hours }
  const days = Math.round(delta / 86_400_000)
  if (days < 30) return { kind: 'daysAgo', count: days }
  const months = Math.round(delta / (30 * 86_400_000))
  if (months < 12) return { kind: 'monthsAgo', count: Math.max(1, months) }
  return { kind: 'yearsAgo', count: Math.max(1, Math.round(delta / (365 * 86_400_000))) }
}

/**
 * Locale string for {@link relativeCommitAge}.
 * @param iso - author date from `GitLogEntry.authorDate`.
 * @param nowMs - comparison instant (`Date.now()` in the UI).
 * @param t - Graph locale function for `git.graph.card.*` keys.
 * @returns the translated relative-age phrase.
 */
export function formatRelativeCommitAge(
  iso: string,
  nowMs: number,
  t: (key: 'git.graph.card.justNow' | 'git.graph.card.minutesAgo' | 'git.graph.card.hoursAgo' | 'git.graph.card.daysAgo' | 'git.graph.card.monthsAgo' | 'git.graph.card.yearsAgo', params?: { count?: string }) => string,
): string {
  const age = relativeCommitAge(iso, nowMs)
  if (age.kind === 'justNow') return t('git.graph.card.justNow')
  return t(`git.graph.card.${age.kind}`, { count: String(age.count) })
}

/**
 * Format `iso` as a locale long date plus short time for the hover-card header.
 * @param iso - author date from `GitLogEntry.authorDate`.
 * @returns a locale string, or `iso` unchanged when it is not a valid date.
 */
export function formatAbsoluteCommitDate(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleString(undefined, { dateStyle: 'long', timeStyle: 'short' })
}

/** Fixed-position box for the Graph commit hover card. */
export interface GitGraphCardBox {
  left: number
  top: number
  maxHeight: number
}

/**
 * Place the hover card to the right of a ref pill, flipping left when the
 * viewport has no room, and clamp vertically so the card stays on screen.
 * @param anchor - pill bounding rect in viewport coordinates.
 * @param viewport - `window.innerWidth` / `innerHeight`.
 * @returns `position:fixed` left, top, and maxHeight in CSS pixels.
 */
export function gitGraphCardPosition(
  anchor: Pick<DOMRect, 'left' | 'right' | 'top'>,
  viewport: { width: number; height: number },
): GitGraphCardBox {
  const maxHeight = Math.min(GIT_GRAPH_CARD_MAX_HEIGHT, Math.max(120, viewport.height - EDGE * 2))
  const left = anchor.right + 8 + GIT_GRAPH_CARD_WIDTH <= viewport.width - EDGE
    ? anchor.right + 8
    : Math.max(EDGE, anchor.left - 8 - GIT_GRAPH_CARD_WIDTH)
  const top = Math.min(Math.max(EDGE, anchor.top), viewport.height - maxHeight - EDGE)
  return { left, top, maxHeight }
}
