// @vitest-environment jsdom

import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import { EditorSurface, type EditorSurfaceProps } from '../src/client/EditorSurface.tsx'
import { zh } from '../src/client/locales.ts'

afterEach(cleanup)

describe('EditorSurface', () => {
  it('shows the PRD empty-state copy when no file is open', () => {
    const props = { t: makeTranslate(zh) } as EditorSurfaceProps
    const view = render(<EditorSurface {...props} />)
    expect(view.getByText('未打开文件')).toBeTruthy()
    expect(view.getByText('从左侧文件树选择文件，或新建文件')).toBeTruthy()
    expect(view.container.querySelector('[data-surface="editor-surface"]')).not.toBeNull()
  })
})
