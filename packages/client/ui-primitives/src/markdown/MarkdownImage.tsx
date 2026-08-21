/** Markdown image with the same expand/zoom lightbox as Mermaid diagrams. */

import { ZoomableImage, type ZoomableImageLabels } from './ZoomableImage.tsx'

/** Toolbar labels for an inline markdown image and its lightbox. */
export type MarkdownImageLabels = ZoomableImageLabels

/**
 * Render one remote markdown image with an expand affordance.
 * @param props.src - Absolute HTTP(S) image URL.
 * @param props.alt - Image alt text.
 * @param props.className - Inline presentation class from the markdown sheet.
 * @param props.imageLabels - Optional localized toolbar labels.
 */
export function MarkdownImage({
  src, alt, className, imageLabels,
}: {
  src: string
  alt: string
  className: string
  imageLabels?: MarkdownImageLabels | undefined
}) {
  return (
    <ZoomableImage
      src={src}
      alt={alt}
      className={className}
      labels={imageLabels}
      imgProps={{
        loading: 'lazy',
        decoding: 'async',
        referrerPolicy: 'no-referrer',
      }}
    />
  )
}
