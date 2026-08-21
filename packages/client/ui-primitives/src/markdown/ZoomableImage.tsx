/** Image with expand/zoom lightbox affordance shared by markdown and file preview. */

import { useState } from 'react'
import type { ImgHTMLAttributes } from 'react'
import { IconFullscreenOutline16 } from '../icons/index.tsx'
import frameCss from './MediaFrame.module.css'
import { ZoomPanLightbox, type MediaLightboxLabels } from './ZoomPanLightbox.tsx'
import css from './ZoomPanLightbox.module.css'

/** Toolbar labels for an inline image and its lightbox. */
export interface ZoomableImageLabels extends MediaLightboxLabels {
  /** Expand control on the inline image. */
  expandLabel?: string | undefined
}

/**
 * Render one image with an expand affordance and zoom/pan lightbox.
 * @param props.src - Image URL.
 * @param props.alt - Image alt text.
 * @param props.className - Inline presentation class.
 * @param props.labels - Optional localized toolbar labels.
 * @param props.imgProps - Optional extra attributes for the inline image.
 */
export function ZoomableImage({
  src, alt, className, labels, imgProps,
}: {
  src: string
  alt: string
  className: string
  labels?: ZoomableImageLabels | undefined
  imgProps?: Omit<ImgHTMLAttributes<HTMLImageElement>, 'src' | 'alt' | 'className'> | undefined
}) {
  const [expanded, setExpanded] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const expandLabel = labels?.expandLabel ?? '放大'
  const dialogLabel = alt === '' ? 'Image' : alt

  return (
    <span className={frameCss.frame}>
      <img
        className={className}
        src={src}
        alt={alt}
        {...imgProps}
      />
      <button
        type="button"
        className={frameCss.expand}
        aria-label={expandLabel}
        onClick={() => { setExpanded(true) }}
      >
        <IconFullscreenOutline16 size={14} />
      </button>
      {expanded && (
        <ZoomPanLightbox
          dialogLabel={dialogLabel}
          onClose={() => { setExpanded(false) }}
          labels={labels}
          remeasureKey={`${src}:${loaded ? '1' : '0'}`}
        >
          <img
            className={css.lightboxImage}
            src={src}
            alt={alt}
            referrerPolicy={imgProps?.referrerPolicy}
            onLoad={() => { setLoaded(true) }}
          />
        </ZoomPanLightbox>
      )}
    </span>
  )
}
