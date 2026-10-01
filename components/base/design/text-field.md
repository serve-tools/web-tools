# Text Field

`TextFieldElement` extends `FormAssociatedElement` and owns one native editor in its shadow root.
The host owns the submitted value; the editor has no independent form entry or form name.
The shadow label's native `for` relationship and the editor's description references stay in the same shadow root.

## Authoring

```html
<app-text-field type="email" name="email" label="Email" description="For account recovery" required></app-text-field>
<app-text-field type="password" multiline readonly label="Secret key" autocomplete="off">
	<button type="button" slot="label-actions">Reveal</button>
	<button type="button" slot="label-actions">Copy</button>
</app-text-field>
```

Register `TextFieldElement` from `@serve-tools/base-components/text-field` under the application's own tag name.
Use this component directly for owned text editing; `FieldElement` remains available for coordinating authored native or custom controls.
Set current text with `field.value`; this does not reflect the value into HTML attributes.
`defaultValue` reflects the `value` attribute and supplies the reset value.
An authored `value` attribute is appropriate for public initial data; it is not needed to supply a current value programmatically.

## Editor and intent

`type` accepts `text`, `email`, `url`, `tel`, `search`, or `password`; omitted or unknown values resolve to `text`.
These are component behavior profiles, not values forwarded to the owned input's native type.
The single-line editor is always a text input.
`multiline` selects a textarea, independently of intent, including for passwords and copyable secrets.
Changing `multiline` replaces the editor and retains its value and selection where the new native editor supports them; converting to single-line text follows native newline sanitization.
Changing intent or `revealed` retains the same editor node.

Profiles choose keyboard, capitalization, and spellcheck defaults.
Explicit `inputmode`, `autocapitalize`, and `spellcheck` attributes override those defaults.
`placeholder`, `autocomplete`, `minlength`, `maxlength`, `pattern`, `rows`, `cols`, and `wrap` are forwarded as attributes; use markup or `setAttribute()` for these attributes rather than assuming every attribute has a custom reflected property.
`name`, `disabled`, `readOnly`, and `required` use the inherited form-control properties.

## Masking and selection

Password intent masks the editor using `-webkit-text-security: disc` until the `revealed` boolean property or attribute is set.
This applies to the actual text input or textarea, including multiline content.
Reveal changes CSS presentation without changing the native input type, replacing the editor, or rewriting its value.
`input` exposes the owned editor after first connection.
`focus()`, `select()`, `setSelectionRange()`, `selectionStart`, and `selectionEnd` delegate to that editor.
Copy controls can write `field.value` to the clipboard from an explicit user action without revealing the editor or modifying its selection.
Clipboard permission and fallback behavior belong to the application; the component itself does not access the clipboard.

Masking changes visual presentation, not access to the underlying value.
Native password-manager recognition and password-specific assistive-technology behavior are not established by this CSS-based implementation.
Use explicit autocomplete tokens appropriate to the application and test those integrations independently.

## Labels and styling

`label`, `description`, and `error` are reflected text properties and shadow-slot fallbacks.
Rich content in the matching slots overrides the fallback; put text or inline markup in the `label` slot, not another native label inside the owned label.
`aria-label` on the host is forwarded to the native editor.
External native label/ARIA ID references are not translated across the shadow boundary.
Use Text Field's own `label` property or slot instead of wrapping it in `FieldElement` for labeling.

The six authored slots are `label`, `description`, `error`, `before`, `after`, and `label-actions`.
The editor is owned and exposed as `::part(control)`, not an authored control slot.
Other parts are `content`, `label-content`, `label`, `control-content`, `description-content`, `description`, `error-content`, `error`, `before`, `after`, and `label-actions`.
The package supplies structural layout and masking; applications control colors, spacing, borders, typography, and alignment through CSS.
Empty label/description sections and unrevealed error sections are hidden.

## Forms, validation, and events

The editor handles native text editing, composition, selection, requiredness, length constraints, and single-line patterns.
Native textarea behavior does not apply `pattern` validation.
Email and URL profiles use a detached native validation probe for type mismatch without changing the visible editor's type or adding another form participant.
Retained line breaks in email or URL values are rejected rather than silently sanitized by the probe.
Text is otherwise retained and submitted as the editor's value.
`setCustomValidity()` updates the host and editor; `error` only overrides presentation and never changes validity.
Native editor constraints initialize on first connection; custom validity can also be set before connection.

Inline errors appear while invalid after interaction or a validation attempt, or when `showError` is true.
Without an error override, the validation message provides the fallback.
`errorVisible` and `:state(error-visible)` expose this presentation policy.
The component does not cancel native `invalid` events.
`dirty` tracks editing interaction, `touched` tracks leaving the component, and `filled` reflects a nonempty value.
`resetState()` clears interaction history without changing text or custom validity.
Form reset restores `defaultValue`; string state restoration restores the saved text.

Native composed `input` events cross the shadow boundary once.
The native non-composed `change` event is relayed once at the host with bubbling and composition enabled.
Single-line Enter activates the associated form's default submit button through native click behavior, honoring cancellation, disabled submitters, and composition.
Without a submit button, implicit submission requires a single blocking field; multiline Enter remains native textarea editing.
Programmatic value changes, reset, and reveal do not synthesize editing events.
`refresh()` synchronizes after direct changes made through the exposed editor.
Disconnection releases listeners while retaining the editor, text, and selection; reconnection binds one new listener set.

## Size snapshot — September 15, 2026

The new text-field entry is 9,312 bytes of uncompressed minified JavaScript with BaseElement, templating, and signals excluded, or 27,923 bytes with those foundations included.
Adding the entry increases the full library's component-only bundle by 8,008 bytes, from 187,524 to 195,532 bytes.
These are export-retaining bundle measurements, not a typical application's complete download.
No TextField runtime speed comparison was performed for this addition.
The existing reduction harness generated the measurements with `node components/base/benchmark/reduction/measure.mjs components/base OUTPUT_DIRECTORY`.
Artifacts and source/bundle hashes are retained in `/Users/jonathan/Documents/Codex/outputs/text-field-2026-09-15/bundles/sizes.json`.
