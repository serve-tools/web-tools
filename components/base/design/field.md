# Field shell and coordination

Status: implementation contract.

## Purpose and composition

`FieldElement` coordinates authored field content without becoming a form control itself.
The browser and the participating control remain the sole owners of form association, submission, reset, and native constraint validation.
The field creates no hidden input, sets no form value, and dispatches no synthetic `input` or `change` event.

The direct light-DOM participants are:

- exactly one usable native control, form-associated custom control, or bounded input adapter with `slot="control"`;
- zero or one authored native `<label slot="label">`, or the `label` text attribute;
- any number of HTML elements with `slot="description"`, or the `description` text attribute; and
- any number of HTML elements with `slot="error"`, or the `error` text attribute or native validation message.

A usable custom control must expose a native-like public form interface: `form`, `validity`, `validationMessage`, `willValidate`, `checkValidity()`, `reportValidity()`, `setCustomValidity()`, and a `value`, readonly array `values`, or boolean `checked` property.
This explicit facade lets Field coordinate native and form-associated custom controls without reading private internals or shadow roots.
A control may also expose an optional `refresh(): void` hook.
Field calls this on the resolved control after its effective label association or label ID changes and after releasing that relationship, allowing controls such as Select and Combobox to relay the native label into their retained editor's accessible name.
This is a relationship-change notification, not a callback on every Field refresh; Field does not invoke an adapter wrapper's refresh method.
A direct adapter instead exposes a readonly `input` property that identifies its usable native `<input>` descendant.
Field accepts that input only when it remains in the adapter's light DOM and the same document or shadow root; it does not search descendants, follow external references, or reach into a shadow root.
This route lets retained-native-input wrappers such as Number Field and OTP Field participate while their input remains the sole label, validation, focus, reset, and submission owner.
When zero or multiple usable controls participate, `control` is `null`, `valid` is `null`, and Field releases every relationship it owned.
It recovers when direct-child composition becomes valid again.

```html
<base-field label="Email" description="We use this address for account recovery.">
	<input slot="control" name="email" type="email" required>
</base-field>
```

## Public surface

`control` is the resolved native or form-associated control, not an adapter wrapper.
`label`, `description`, and `error` are reflected string properties with matching attributes.
`labelElement` is the nullable readonly native label reference; it replaces the earlier `label` element getter.
`error` changes presentation only and never calls `setCustomValidity()`.
`descriptions` and `errors` are frozen readonly arrays in light-DOM order.
`valid` is the native validity result, or `null` when the control is absent or barred from constraint validation.
`invalid`, `dirty`, `touched`, `filled`, `focused`, `disabled`, and `required` are boolean presentation states.
`errorVisible` reports whether inline errors are revealed and exposes the custom CSS state `error-visible`.
The same names are exposed as custom CSS states, except that `valid` is present only when its value is `true`.

`refresh()` reconciles relationships and rereads values, validity, focus, and native pseudo-class state.
Call it after a programmatic property change that does not produce an observable attribute mutation or native event.
For custom or server validation, call `control.setCustomValidity(message)` and then `field.refresh()`.
Clearing the message uses the same route with an empty string.

`resetState()` makes the current control value the pristine baseline and clears `touched` without changing the control or form.
`dirty` compares the current value or checked state with the baseline captured when the control first participates or after a successful form reset or `resetState()` call.
`touched` becomes true after focus has entered the control and then left it.
`focused` uses `:focus-within`, so focus retargeted from an open or closed custom-control shadow root is included.
`filled` means a nonempty value, a checked checkable control, a nonempty file list, or at least one selected option in a multiple select.
For a single form-associated custom control with a readonly array `values`, Field shallowly snapshots that canonical array before consulting scalar `value`.
An empty array is unfilled, while any member including an empty string is filled; dirty comparison includes every array position.

## Relationship ownership

Field owns only the relationships it adds.
It supplies stable IDs when a participant lacks an authored ID, sets the native label's `for`, appends description IDs to `aria-describedby`, appends visible error IDs to `aria-errormessage`, and supplies `aria-invalid="true"` only when the invalid control has no authored value.
For a resolved control exposing the optional `refresh()` hook, Field also appends the active label ID to `aria-labelledby`, preserving native `label.for` association.
This explicit label handoff lets the control relay the accessible name without depending solely on discovery through its native labels collection.
Controls without that hook retain the native label relationship without this additional label token.
Authored IDREF tokens remain in order ahead of Field tokens.
While connected, an author may replace or extend those attributes; Field preserves the author tokens and removes only its generated tokens on participant replacement or disconnection.
Authored IDs and attributes are restored rather than overwritten during cleanup.
The generated IDs remain stable for the same retained participant across reconnection while the ID remains available in its document or shadow root.
Field regenerates an owned ID before use when another element in the current tree already owns it.

## Content and layout

The seven slots are `label`, `control`, `description`, `error`, `before`, `after`, and `label-actions`.
`before` and `after` surround the control for prefixes, units, or action buttons.
`label-actions` sits beside the label and outside its native activation area, so a help button does not become label content.
Use native `<button type="button">` for accessory actions inside a form.
Put noninteractive icons and rich text inside an authored label, description, or error rather than requiring a slot for every decoration.

The shadow layout exposes five stable wrapper parts: `content`, `label-content`, `control-content`, `description-content`, and `error-content`.
Each named slot also exposes a part with its own name.
Empty sections are hidden, so grid gaps do not reserve space for absent content.
The package supplies a block host, a grid content wrapper, and flex label/control rows, with empty or unrevealed sections hidden.
Applications style spacing, typography, colors, and arrangement through these parts and their authored content.
For example, style `::part(content)` for vertical rhythm and `::part(control-content)` for prefix/control/suffix spacing.

```html
<base-field label="Budget" description="Monthly spending limit.">
	<span slot="before" aria-hidden="true">$</span>
	<input slot="control" name="budget" type="number" min="0" required>
	<span slot="after">USD</span>
	<button slot="label-actions" type="button" aria-label="About the budget">?</button>
</base-field>
```

Text conveniences produce retained light-DOM native label and paragraph nodes only when needed.
This keeps native `label.control`, label activation, and ID references in the control's tree; a shadow-root label cannot label a light-DOM control through `for`.
Authored content in a role overrides its generated fallback.
Removing that authored content restores the retained fallback when it has text.
Fallback text is inserted as text, never interpreted as HTML.
These nodes participate in the same relationship ownership as authored nodes.

## Inline validation feedback

An invalid field reveals errors after the control loses focus, after a native `invalid` event, or when the reflected boolean `showError` (`show-error`) is true.
A valid field never reveals an inline error merely because `error` or `show-error` is set.
When no authored error content or nonempty `error` text overrides it, Field displays the control's native `validationMessage`.
Error IDs participate in owned `aria-errormessage` relationships only while revealed.
Field preserves authored ARIA tokens and does not cancel native invalid events or suppress the browser's validation UI.

For an immediate server error, set the actual control's custom validity, set `field.showError = true`, and call `field.refresh()`.
Clear custom validity with an empty message; clearing `field.error` alone cannot make a control valid.
`resetState()` and an accepted native reset clear interaction-based reveal state along with touched state; an explicitly set `show-error` remains an author override.
Control replacement also clears the interaction-based reveal state.
The error wrapper is a styling surface, not a live-region announcement guarantee.

## Observation and lifecycle

Field observes only its own light subtree and the `disabled` and direct-child structure of ancestor fieldsets while connected.
This keeps effective disabled state current for native fieldset changes, including the first-legend exception, without a document scan or global registry.
The observer is rebuilt after connected movement or cross-document adoption and is synchronously disconnected with the component.
Reset events are observed at the Field's current document or shadow root because native reset events do not cross a shadow boundary.
The event is accepted only from the control's live associated form, so ancestor and external form changes do not leave stale form ownership.

The connection owns all event listeners and observers.
Disconnection releases generated relationships and leaves no live Field resource behind.
Reconnection preserves the authored nodes, tracking state, and stable generated IDs, then reconciles current values and relationships.
Reset tracking settles in a subsequent task so a trusted reset button finishes its native default action before the Field captures a new baseline.
It is not guaranteed to be pristine immediately after `form.reset()` returns or after only a microtask checkpoint.
An external form reset is handled only when the control is associated with that form both at dispatch and after the reset completes.
A canceled reset, disconnection, participant replacement, form reassociation, or connection-epoch change invalidates the deferred reset work.

## Boundaries

Native controls report programmatic value, checkedness, and validity changes through `refresh()` because native property setters do not emit events and cannot be observed without patching platform prototypes.
Late-upgraded custom controls also require `refresh()` after their public form facade becomes available.
An adapter whose readonly `input` changes only through a silent property update likewise requires `refresh()`; light-DOM input replacement is observed normally.
Field does not implement validation modes, asynchronous validation, form-level field registries, composite fields, or item aggregation.
It tracks a participating control's canonical array without becoming another owner of that value.
It does not infer accessible descriptions from arbitrary descendants or reach into a control's shadow root.
The participating control remains responsible for exposing correct form association, validation, value, checkedness, and focus behavior.

## Measured cost

The [Field shell cost check](../benchmark/reduction/FIELD-SHELL-2026-09-15.md) records the added executable size and the before/after refresh measurements.
The final refresh result is inconclusive against the declared 2% practical threshold; the richer authoring surface is not a measured performance win.
