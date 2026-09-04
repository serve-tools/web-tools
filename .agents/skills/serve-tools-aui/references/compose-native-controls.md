# Compose native controls

Use native `<button>`, `<input>`, `<fieldset>`, `<form>`, and `<input type="radio">` directly for those families; AUI intentionally exports no replacement classes for them.
Use `<a href>` for navigation.
Name radio groups with a fieldset and legend; native grouping depends on shared nonempty name, form owner, and tree, including peers outside the visible fieldset.
Put an external `form` attribute on each associated input, not on a group wrapper.
Preserve native form submission and reset; `new FormData(form, submitter)` includes the active submit button's name and value when needed.
Do not create hidden mirrors, a second role-bearing radio target, or an input wrapper that intercepts composition and selection.
Native radios accept string values and do not have a read-only mode.
Property assignments remain ordinary native assignments; do not fabricate input events to implement a controlled React-style value.

For Checkbox, register `CheckboxElement` from `@serve-tools/aui/checkbox` under an application tag name.
Use the host directly in a native label or target its ID with `label[for]`; do not add a hidden form input or an interactive shadow descendant.
The host owns form association, focus, and accessibility semantics through `ElementInternals`.
`checked` changes current state; `defaultChecked` and the `checked` attribute define initialization/reset state.
`indeterminate` is independent presentation state and remains set after activation until the application changes it.
`readOnly` prevents toggling while leaving the control focusable and successful in forms; `disabled` also removes form participation.
The browser excludes a read-only control from constraint validation, as it does a native checkbox carrying `readonly`.
`value` defaults to `"on"`, and unchecked controls submit nothing unless `uncheckedValue` or `unchecked-value` is provided.
An empty string is a valid unchecked value; assigning `undefined` removes it.

Listen for `beforechange` to accept or cancel a proposed Checkbox interaction before state changes.
The event bubbles, crosses shadow boundaries, and exposes immutable `detail.checked` and `detail.sourceEvent`.
Cancel it with `preventDefault()`; do not depend on an ancestor canceling the later click to undo a change.
The host prevents the handled click's default action so a wrapping label cannot activate decorative content twice; it does not stop click propagation.
Accepted interactions synchronously update form state before `input` and `change`.
`input` is bubbling and composed; `change` bubbles without crossing a shadow boundary.
Property assignments, reset, and restoration do not emit these interaction events.
Space toggles; Enter instead activates the associated form's default submitter unless keydown is prevented.
This Enter behavior includes submit buttons and submit inputs, not image inputs, matching Base UI 1.7.0.
Keep Checkbox children decorative or textual; put other interactive controls outside the host.
Use native form and constraint-validation methods rather than duplicating submission or fieldset handling in application code.

For Switch, import `SwitchElement` from `@serve-tools/aui/switch` and use the same checked/defaultChecked, form, optional unchecked-value, and event contract as Checkbox.
Switch has no indeterminate state; its optional decorative slot is `thumb` and its presentational part is `control`.

For Checkbox Group, register `CheckboxGroupElement` from `@serve-tools/aui/checkbox-group` and supply direct Checkbox children with explicit unique values.
Use `values` arrays and group `disabled`; each ordinary child remains its own form owner.
Mark a direct Checkbox `parent` to derive select-all checked/mixed presentation without contributing a form entry.
Parent activation preserves disabled selections and alternately selects or clears enabled children, so a disabled unchecked option can keep the parent mixed.
Filter the group's `beforechange` with `event.target === group` or `"values" in event.detail` because child proposals bubble through it.
Cancel before commit; accepted group state is visible before the source child's single input/change pair.
Do not add a group hidden input, group FormData mirror, or application click handlers to implement exclusivity.

For Toggle, supply a direct native button and use the host's `pressed`, `disabled`, and `value` properties.
The first direct button owns focus and keyboard activation; the component supplies button type and semantics, so it does not submit forms.
Detached structural edits reconcile when the button is next accessed or the host reconnects; the component does not keep a disconnected observer alive.
Do not synthesize Enter or Space clicks yourself.
For Toggle Group, use direct Toggle children with explicit, unique value attributes, and label the group.
An empty attribute value is valid; an omitted or duplicated value cannot identify a selectable member.
Read and assign `values` as an array even in single-selection mode.
Set `multiple` for independent selections, `orientation` for arrow navigation, and `loopFocus = false` to prevent wrapping.
Arrow navigation changes focus, not selection.
Group disabling preserves each member's own disabled setting.

A Toggle proposes `detail.pressed` through `beforechange` before its group proposes `detail.values`.
On the group, narrow the detail with `"values" in event.detail` because child proposals bubble too.
Cancel either proposal before commit; do not mutate other members from a capture listener in an attempt to implement exclusivity.
After an accepted transaction, the source Toggle emits one bubbling `input`/`change` pair with the entire group's state already coherent.
Read `group.values` in the group listener; the group does not emit a second pair.
Programmatic property assignments remain silent.

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
