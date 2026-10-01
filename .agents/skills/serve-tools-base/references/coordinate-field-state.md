# Coordinate field state

Register `FieldElement` from `@serve-tools/base-components/field` under an application tag name.
Supply exactly one direct usable control with `slot="control"`.
Use `label` and `description` text attributes for ordinary fields; use at most one native `<label slot="label">` and any elements with `slot="description"` or `slot="error"` for rich content.
Authored role content overrides the corresponding text fallback; removing it restores the retained fallback.
Generated native label and paragraph nodes live beside the control in light DOM, so native label activation and ID relationships remain in the same tree.
A custom control may expose the documented `FieldControl` native form facade.
Its optional `refresh(): void` hook receives effective label-association or label-ID changes and relationship release so a retained editor can update its accessible name; Select and Combobox support this route.
For controls with that hook, Field also hands off the active label ID through an owned `aria-labelledby` token, preserving authored tokens and native `label.for`.
This avoids requiring the control to discover that label solely through its native labels collection.
Field invokes the hook on the resolved control, not an adapter wrapper, and does not call it on every state refresh.
A direct retained-input wrapper such as Number Field or OTP Field may instead expose a readonly `input` that resolves to its usable native light-DOM input in the same document or shadow root.
Field never searches arbitrary descendants, follows an external reference, or reaches into a shadow root.
Zero or multiple controls make the field inert until composition becomes valid again.

```html
<app-field label="Quantity" description="Choose up to twelve.">
	<app-number-field slot="control" min="1" max="12">
		<button slot="decrement" aria-label="Decrease">−</button>
		<input type="number" name="quantity" value="2" />
		<button slot="increment" aria-label="Increase">+</button>
	</app-number-field>
</app-field>
```

Put `name`, `required`, `disabled`, values, constraints, and form associations on the actual control, not the Field host.
Field creates no hidden input, form value, or synthetic input/change event.
Its `control` getter and all owned label and ARIA relationships refer to the resolved actual control, not an adapter wrapper.
Its generated IDs and label/description/error relationships preserve authored tokens and are released on replacement or disconnection.

Use `:state(invalid)`, `:state(dirty)`, `:state(touched)`, `:state(filled)`, `:state(focused)`, `:state(disabled)`, and `:state(required)` for presentation.
Valid is nullable when the control is absent or barred from validation.
Inline errors appear only while invalid, after blur, a native `invalid` event, or the reflected `showError` boolean (`show-error`).
Use `errorVisible` or `:state(error-visible)` to read that reveal state.
With no authored error slot or nonempty `error` text, the actual control's native `validationMessage` supplies the message.
The reflected `error` string changes presentation only: setting it does not invalidate the control, and clearing it does not clear custom validity.
Field owns error ARIA references only while errors are revealed and does not cancel the native invalid event.

Use `before` and `after` slots for content around the control, such as currency prefixes and units.
Use `label-actions` for help buttons outside the native label; give accessory buttons `type="button"` inside forms.
Put noninteractive icons and formatting inside authored role content rather than inventing new slots.
Style `::part(content)` for the outer layout and `::part(label-content)`, `::part(control-content)`, `::part(description-content)`, and `::part(error-content)` for sections.
Each of the seven named slots also has a matching part; empty sections are hidden.
The shell supplies no theme.

`label` is now the reflected label text property; use `labelElement` for the readonly native label reference.

After a silent native property assignment, a custom control's late upgrade, or `control.setCustomValidity(message)`, call `field.refresh()`.
Set `field.showError = true` when a server error should appear immediately.
Use an empty custom-validity message to clear a server or custom error, then refresh again.
Do not fabricate input/change events just to update Field.
Use `resetState()` to accept the current value as pristine without changing the form.
It clears touched and interaction-based error reveal state; an explicitly set `show-error` remains an author override.
An uncanceled native form reset updates the baseline in a subsequent task after native reset completes, including forms inside shadow roots.
Do not assume it has settled immediately after `form.reset()` or a microtask checkpoint; `resetState()` remains the explicit synchronous operation.
For one FACE control exposing a readonly `values` array, Field shallowly snapshots the whole array before scalar `value`.
An empty array is unfilled, an array containing an empty string is filled, and every array position contributes to dirty comparison.

This coordinator does not supply async validators, a form registry, grouped values, or automatic server requests.
