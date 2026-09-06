# Coordinate field state

Register `FieldElement` from `@serve-tools/base-components/field` under an application tag name.
Supply exactly one direct usable control with `slot="control"`, at most one native label with `slot="label"`, and any descriptions/errors with `slot="description"` or `slot="error"`.
A custom control may expose the documented `FieldControl` native form facade.
A direct retained-input wrapper such as Number Field or OTP Field may instead expose a readonly `input` that resolves to its usable native light-DOM input in the same document or shadow root.
Field never searches arbitrary descendants, follows an external reference, or reaches into a shadow root.
Zero or multiple controls make the field inert until composition becomes valid again.

```html
<app-field>
	<label slot="label">Quantity</label>
	<app-number-field slot="control" min="1" max="12">
		<button slot="decrement" aria-label="Decrease">−</button>
		<input type="number" name="quantity" value="2" />
		<button slot="increment" aria-label="Increase">+</button>
	</app-number-field>
	<p slot="description">Choose up to twelve.</p>
</app-field>
```

Put `name`, `required`, `disabled`, values, constraints, and form associations on the actual control, not the Field host.
Field creates no hidden input, form value, or synthetic input/change event.
Its `control` getter and all owned label and ARIA relationships refer to the resolved actual control, not an adapter wrapper.
Its generated IDs and label/description/error relationships preserve authored tokens and are released on replacement or disconnection.

Use `:state(invalid)`, `:state(dirty)`, `:state(touched)`, `:state(filled)`, `:state(focused)`, `:state(disabled)`, and `:state(required)` for presentation.
Valid is nullable when the control is absent or barred from validation.
Choose error visibility in application CSS; Field does not impose a validation mode.

After a silent native property assignment, a custom control's late upgrade, or `control.setCustomValidity(message)`, call `field.refresh()`.
Use an empty custom-validity message to clear a server or custom error, then refresh again.
Do not fabricate input/change events just to update Field.
Use `resetState()` to accept the current value as pristine without changing the form.
An uncanceled native form reset updates the baseline after reset completes, including forms inside shadow roots.
For one FACE control exposing a readonly `values` array, Field shallowly snapshots the whole array before scalar `value`.
An empty array is unfilled, an array containing an empty string is filled, and every array position contributes to dirty comparison.

This coordinator does not supply async validators, a form registry, grouped values, or automatic server requests.
