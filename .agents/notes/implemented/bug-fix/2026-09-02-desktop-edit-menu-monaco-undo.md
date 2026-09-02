# Agent Note: Desktop Edit menu must not register native Undo/Redo

Status: implemented

English | [中文](2026-09-02-desktop-edit-menu-monaco-undo.zh.md)

## Problem

The desktop shell used Electron `{ role: 'editMenu' }`, which binds Cmd+Z to `webContents.undo()`. Monaco source editors and TipTap markdown preview keep their own document undo stacks. Native web undo on Monaco's surface reverts IME composition steps incorrectly (romanization such as `ni hao` appears instead of removing committed CJK text). Preview mode worked because TipTap handled undo before the native accelerator ran in some paths; Markdown source and other Monaco tabs failed consistently.

## Decision

Keep `{ role: 'editMenu' }` for platform placement but replace its submenu with clipboard and selection roles only (`cut`, `copy`, `paste`, `delete`, `selectAll`, plus macOS paste-and-match-style). Do not register `undo` or `redo` menu roles. The Renderer installs capture-phase Cmd+Z handlers on desktop delivery that call `editor.trigger('undo'|'redo')` for Monaco and TipTap while the editor surface is focused.

## Alternatives considered

**Route Edit ▸ Undo through IPC to `editor.trigger('undo')`.** Rejected for this change: clipboard roles still need native `webContents.*`; undo IPC adds preload wiring and focused-editor tracking before the simpler accelerator fix is proven insufficient.

**Remove the Edit menu entirely.** Rejected: copy/paste accelerators unbind without edit-menu roles.

## Consequences

Menu bar no longer shows Undo/Redo entries; undo/redo remain keyboard-only in editor surfaces. Web delivery unchanged.

## Testing

`apps/desktop/tests/app-menu.spec.ts` asserts the edit submenu includes copy/paste and excludes undo/redo roles.
