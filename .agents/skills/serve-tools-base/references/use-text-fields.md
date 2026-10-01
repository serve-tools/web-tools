# Use text fields

Import `TextFieldElement` from `@serve-tools/base-components/text-field` and register your own tag.
Use it directly for an owned shadow editor; use FieldElement when you need to coordinate authored controls instead.
External native labels and ARIA ID references do not cross the shadow boundary to its editor.
Use Text Field's own `label` property or slot rather than wrapping it in FieldElement for labeling.

```html
<app-text-field type="email" name="email" label="Email" description="For account recovery" required></app-text-field>
<app-text-field type="password" multiline readonly label="Secret key" autocomplete="off"></app-text-field>
```

The editor is always a native text input or textarea; public `type` selects text/email/url/tel/search/password behavior.
`multiline` selects textarea independently, including multiline passwords or secrets.
`revealed` controls CSS masking without replacing the editor or changing its native type.
Set current text through `field.value`; it is not reflected into HTML attributes.
`defaultValue` reflects the authored `value` attribute and supplies the reset value.
Only the host submits a form value under `name`.

Use `label`, `description`, and `error` attributes for text, or matching slots for rich inline content.
The label slot is inside the component's native label; use text or spans rather than nesting another label.
Use `before` and `after` for editor accessories and `label-actions` for independent help/reveal/copy buttons.
The editor has a `control` part and no authored control slot.
Style `content`, `label-content`, `label`, `control-content`, `control`, `description-content`, `description`, `error-content`, `error`, `before`, `after`, and `label-actions` parts.
`aria-label` on the host is forwarded to the editor; prefer label text/slot for visible naming.

The `input` getter exposes the owned editor after connection.
`focus()`, `select()`, `setSelectionRange()`, `selectionStart`, and `selectionEnd` delegate to it.
From an explicit Copy button action, copy `field.value` directly; reveal is not necessary and line breaks are retained.
Implement clipboard permission/failure handling in the application.
CSS masking is visual presentation; password-manager and password-specific assistive-technology integration need separate application testing.

Common editor attributes include `placeholder`, `autocomplete`, `inputmode`, `autocapitalize`, `spellcheck`, `minlength`, `maxlength`, `pattern`, `rows`, `cols`, and `wrap`.
Use attributes or `setAttribute()` for attributes without documented reflected properties.
Explicit keyboard/capitalization/spellcheck attributes override profile defaults.
Native textarea does not apply `pattern`; email and URL profiles add native-probe type validation while retaining the visible text editor.
Use `setCustomValidity()` to change validity and `error` only to override displayed error text.
Errors reveal after interaction/validation, or while invalid with `showError` enabled.
Native editor constraints initialize on first connection.

`dirty` tracks editing interaction; `resetState()` clears interaction history without changing text.
Native form reset restores `defaultValue`; reveal/value assignments do not synthesize input/change events.
Single-line Enter honors the associated form's default submitter; multiline Enter remains native editing.
Use `refresh()` after directly modifying the exposed editor.
See the workspace [Text Field contract](../../../../components/base/design/text-field.md) for the full supported boundary and the [Input gallery](../../../../components/base/examples/index.html#component-input) for working email and multiline-secret examples.
