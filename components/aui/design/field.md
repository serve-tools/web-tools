# Field coordination decision

Status: implementation contract.

## Purpose and composition

`FieldElement` coordinates authored field content without becoming a form control itself.
The browser and the participating control remain the sole owners of form association, submission, reset, and native constraint validation.
The field creates no hidden input, sets no form value, and dispatches no synthetic `input` or `change` event.

The direct light-DOM participants are:

- exactly one usable native control, form-associated custom control, or bounded input adapter with `slot="control"`;
- zero or one native `<label slot="label">`;
- any number of HTML elements with `slot="description"`; and
- any number of HTML elements with `slot="error"`.

A usable custom control must expose a native-like public form interface: `form`, `validity`, `validationMessage`, `willValidate`, `checkValidity()`, `reportValidity()`, `setCustomValidity()`, and a `value`, readonly array `values`, or boolean `checked` property.
This explicit facade lets Field coordinate native and form-associated custom controls without reading private internals or shadow roots.
A direct adapter instead exposes a readonly `input` property that identifies its usable native `<input>` descendant.
Field accepts that input only when it remains in the adapter's light DOM and the same document or shadow root; it does not search descendants, follow external references, or reach into a shadow root.
This route lets retained-native-input wrappers such as Number Field and OTP Field participate while their input remains the sole label, validation, focus, reset, and submission owner.
When zero or multiple usable controls participate, `control` is `null`, `valid` is `null`, and Field releases every relationship it owned.
It recovers when direct-child composition becomes valid again.

```html
<aui-field>
	<label slot="label">Email</label>
	<input slot="control" name="email" type="email" required>
	<p slot="description">We use this address for account recovery.</p>
	<p slot="error">Enter a valid email address.</p>
</aui-field>
```

## Public surface

`control` is the resolved native or form-associated control, not an adapter wrapper, and `label` is the nullable readonly native label reference.
`descriptions` and `errors` are frozen readonly arrays in light-DOM order.
`valid` is the native validity result, or `null` when the control is absent or barred from constraint validation.
`invalid`, `dirty`, `touched`, `filled`, `focused`, `disabled`, and `required` are boolean presentation states.
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
It supplies stable IDs when a participant lacks an authored ID, sets the native label's `for`, appends description IDs to `aria-describedby`, appends error IDs to `aria-errormessage`, and supplies `aria-invalid="true"` only when the invalid control has no authored value.
Authored IDREF tokens remain in order ahead of Field tokens.
While connected, an author may replace or extend those attributes; Field preserves the author tokens and removes only its generated tokens on participant replacement or disconnection.
Authored IDs and attributes are restored rather than overwritten during cleanup.
The generated IDs remain stable for the same retained participant across reconnection while the ID remains available in its document or shadow root.
Field regenerates an owned ID before use when another element in the current tree already owns it.

The shadow layout contains one named slot for each role.
The slots expose `label`, `control`, `description`, and `error` parts with the same names.
Field does not decide whether an error is visible; applications can style the authored content from Field's states.

## Observation and lifecycle

Field observes only its own light subtree and the `disabled` and direct-child structure of ancestor fieldsets while connected.
This keeps effective disabled state current for native fieldset changes, including the first-legend exception, without a document scan or global registry.
The observer is rebuilt after connected movement or cross-document adoption and is synchronously disconnected with the component.
Reset events are observed at the Field's current document or shadow root because native reset events do not cross a shadow boundary.
The event is accepted only from the control's live associated form, so ancestor and external form changes do not leave stale form ownership.

The connection owns all event listeners and observers.
Disconnection releases generated relationships and leaves no live Field resource behind.
Reconnection preserves the authored nodes, tracking state, and stable generated IDs, then reconciles current values and relationships.
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
