# Compose native overlays

Register the required class under application-owned names: `PopoverElement` from `@serve-tools/aui/popover`, `TooltipElement` from `@serve-tools/aui/tooltip`, `PreviewCardElement` from `@serve-tools/aui/preview-card`, or `AlertDialogElement` from `@serve-tools/aui/alert-dialog`.
Imports do not register tag names.

Popover uses its first direct HTML child carrying `popover`.
Target that child's ID with a native `popovertarget` button, or call `show(source?)`, `hide()`, and `toggle(source?)` on the wrapper.
Read native state through `open` and `popup`.
Style native top-layer content with CSS anchor positioning; do not add a second portal or positioning loop.
Host `beforetoggle` and `toggle` preserve native state, source, cancelability, and coalescing.
Only opening is cancelable; never implement a close veto by reopening after an uncancelable native close.

Tooltip uses a direct native interactive trigger, or a direct element explicitly assigned `slot="trigger"`, plus a direct popup.
It supplies manual popover mode, a default tooltip role, a stable ID, and an owned `aria-describedby` token while preserving author tokens.
Supply descriptive, nonessential text rather than interactive or required content.
Hover opens after `delay` (600 ms by default); focus opens immediately; `closeDelay` defaults to zero.
Tooltip requires native `CloseWatcher`; Escape and other native close requests use the platform's grouping rules and may close several related layers together.
`show()` and an opening `toggle(source?)` synchronously reject missing support; closing does not require a new watcher.
Canceled openings allocate no watcher, and each accepted opening releases its watcher and listeners when closed.
There is no fallback stack or manual focus trap.

Preview Card requires a direct `<a href>` trigger and direct popup.
It preserves ordinary link navigation and owns auto-popover mode while connected to that popup.
Hover delay defaults to 600 ms and close delay to 300 ms, allowing movement into the preview.
Native auto-popover Escape and outside dismissal remain in control.
Neither hover component promises geometric pointer corridors, delay groups, or multiple detached triggers.

Alert Dialog requires a direct native `<dialog>` with accessible name and alert-description attributes.
Prefer `aria-labelledby` and `aria-describedby` pointing to meaningful authored content; attribute-presence checks do not verify the resolved text.
Use `showModal()` and `close(returnValue?)`; nonmodal `show()` is intentionally absent.
Keep a safe initial action focusable, and use native `method="dialog"` form buttons for ordinary results.
Listen for native-style host `cancel` and `close`; cancel prevention is forwarded to the dialog.
Do not add a second inert sweep, focus trap, or hidden form mirror.
