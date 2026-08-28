# Compose native controls

The initial public component proofs are Tabs and Dialog.
Other families in the design inventory are not yet available.
Checkbox is experimental source, not a public export.

For Tabs, supply one direct child with `slot="tablist"` containing native buttons, followed by direct children with `slot="panel"`.
Buttons and panels pair in DOM order.
Name the tablist using its own accessible label.
Use `value`, `selectedIndex`, or `select()` for silent programmatic selection, and observe `input`/`change` for user changes.
Automatic activation notifies on focus-driven selection, including programmatic `focus()` or `focusTab()` calls.
Use manual activation when arrow navigation should only move focus until Enter, Space, or click.
Do not replace panel contents when changing selection.

For Dialog, supply a direct native `<dialog>` with its own accessible name and any native `method="dialog"` form inside it.
Call `showModal()`, `show()`, or `close()` on the host and read the native child through `dialog`.
The first direct dialog is current; methods throw `InvalidStateError` if none exists.
Listen for the host's nonbubbling `cancel`/`close` events; cancel prevention is forwarded to the native event.
Forwarding exists only while connected, so listen on the native child when deliberately observing detached operations.
Do not add a second focus trap, JS inert sweep, hidden form mirror, or JavaScript positioning loop.
