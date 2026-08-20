/** Editor-surface occupant of the details column file-editor tab. */

import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import css from './EditorSurface.module.css'

export type EditorSurfaceProps = PropsRuntime<'conversation.details.editor'> & PropsLocale<'fileEditor'>

/** Default editor-surface body: empty-state card until file-tree issues land. */
export function EditorSurface({ t }: EditorSurfaceProps) {
  return (
    <div className={css.editorRoot} data-surface="editor-surface">
      <div className={css.emptyCard}>
        <div className={css.emptyTitle}>{t('editor.empty.title')}</div>
        <div className={css.emptyBody}>{t('editor.empty.body')}</div>
        <button type="button" className={css.emptyCta} disabled>{t('editor.empty.cta')}</button>
      </div>
    </div>
  )
}
