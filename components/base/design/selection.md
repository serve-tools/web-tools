# Selection controls

Status: implemented and verified in focused Chromium, Firefox, and WebKit browser tests.
This is a native web-component contract informed by Base UI 1.7.0 and the donor Base; it is not JavaScript API parity with either project.

## References and provenance

- Base UI 1.7.0 [`Select` source](https://github.com/mui/base-ui/tree/v1.7.0/packages/react/src/select) and [`Combobox` source](https://github.com/mui/base-ui/tree/v1.7.0/packages/react/src/combobox)
- Base UI [`Select`](https://base-ui.com/react/components/select) and [`Combobox`](https://base-ui.com/react/components/combobox) behavior and accessibility guidance
- Base UI [`v1.7.0` release](https://base-ui.com/react/overview/releases/v1-7-0)
- Donor Base commit `080ad617486945851d0775278d1c8d215bdf75f7`, especially its option, selection, combobox, and autocomplete elements

Base UI supplied the distinct Select, restricted Combobox, and free-text Autocomplete product models; highlighted-option navigation; multiple selection; label focus; and selected-value form behavior.
The donor supplied useful element vocabulary and the requirement to keep authored option content.
This implementation replaces donor shadow inputs and manual popup state with one authored native focus control, FACE for selected-value fields, native Popover, ElementInternals labels and form state, and retained light DOM.

## Markup and form identity

`AutocompleteElement` owns suggestions while its direct native text input owns focus, labels, editing, IME, autofill, validation, reset, and form submission.
The input keeps its authored `name` and is the only form identity in that family.
Its native disabled and readonly states also block popup navigation and suggestion acceptance, including changes made during `beforechange`.

`ComboboxElement` and `SelectElement` are form-associated custom elements.
Their host is the only submitted selection identity, while a direct native input or button is the only focus and accessibility identity.
They expose the native-like validity facade used by `FieldElement`, including persistent `setCustomValidity(message)` errors whose message takes precedence over the built-in required message until cleared.
Combobox temporarily removes the input's `name`, and Select forces its button to `type="button"`, while connected.
Those authored attributes, including mutations made while controlled, are restored on control replacement and disconnection.

```html
<base-autocomplete>
	<label for="airport">Airport</label>
	<input id="airport" name="airport" autocomplete="off">
	<div popover="manual">
		<base-option value="jfk">John F. Kennedy International</base-option>
	</div>
</base-autocomplete>

<label for="service">Service</label>
<base-combobox id="service" name="service" required>
	<input autocomplete="off">
	<div popover="manual">
		<base-option value="pro">Professional</base-option>
	</div>
</base-combobox>

<label for="region">Region</label>
<base-select id="region" name="region">
	<button type="submit">Choose a region</button>
	<div popover="manual">
		<base-option value="">None</base-option>
	</div>
</base-select>
```

FACE labels associated with a Combobox or Select host focus the current native control.
The component also links those labels to that control with real `aria-labelledby` ID tokens, while preserving authored tokens.
Host-local label and ARIA mutations reconcile automatically.
After an external label is added, removed, or changes `for` or `id`, call the field's silent `refresh()` method to reconcile the relationship; existing associated label text remains live through its ID reference.
An authored host `aria-label` or `aria-labelledby` is forwarded to the native control, while direct-control naming remains authoritative and is restored on release.

Imports do not register tag names.
Applications explicitly associate their chosen names with `OptionElement`, `AutocompleteElement`, `ComboboxElement`, and `SelectElement` through `customElements.define()`.

## Options and values

Every owned option needs an explicit unique string `value` attribute; an explicit empty string is valid.
The value is the option's selection identity and the submitted string for Combobox and Select.
For Autocomplete it remains an option identity only: acceptance writes the option's `label` to the native input, and that visible text is what a named input submits.

An option's `label` attribute is optional and otherwise authored text supplies its matching, acceptance, and accessible text.
An explicit label is reflected through `aria-label` without replacing the authored content that remains its visual presentation.
Missing and duplicate identities are interaction-disabled and rejected before a FACE field exposes or serializes an ambiguous selection.
Options under a nested registered selection owner are excluded from the outer owner, including when that nested owner upgrades late.

The frozen `values` array is the canonical Combobox and Select API.
`[]` means no selection and `[""]` means a selected empty value.
The scalar `value` convenience follows native empty-string ambiguity.
Programmatic `value`, `values`, and `OptionElement.selected` writes are silent, dirty the current selection, and normalize to unique DOM-order values.
Removing `multiple` immediately preserves only the first selected option in DOM order.

`defaultSelected` is the current `selected` content attribute, independent from dirty current selection.
Changing defaults after a dirty selection does not change current values.
Reflected option `value`, `disabled`, `label`, and `defaultSelected` writes synchronously invalidate the current owner and its FACE form value; authored text-node changes reconcile on the host's mutation-observer turn.
Form reset reads the current option defaults at reset time, while form-state restore accepts serialized string arrays, restores silently, and normalizes them to frozen DOM order.

## Native popup and listbox semantics

The current direct authored popup must carry a `popover` attribute.
While connected, the owner changes it to `popover="auto"` and restores the latest authored value when the popup is replaced or disconnected.
Native `showPopover({ source })`, `hidePopover()`, Escape, light dismissal, source association, `beforetoggle` cancellation, and `toggle` remain authoritative.
The component does not emit a synthetic closing proposal or treat a canceled native opening as open.

The popup receives an owned ID, `role="listbox"`, and `aria-multiselectable` in multiple mode.
The native control receives `role="combobox"`, `aria-controls`, `aria-expanded`, `aria-activedescendant`, and relevant disabled, readonly, required, and autocomplete semantics.
Options receive `role="option"`, `aria-selected`, and effective `aria-disabled`.
Component-generated label, listbox, and option IDs are checked for collisions in the current document and regenerated after adoption when needed.
DOM focus stays on the native input or button while Up and Down move the active descendant through eligible options.
Enter accepts the current active option; Select also uses Space.
Multiple keyboard acceptance toggles an already-selected option.

Autocomplete filtering runs after ordinary native input and after `compositionend`, never during active IME composition.
It initializes from the current input value, binds to a replacement input's value, and resynchronizes after the native input's associated form resets.
It matches labels without replacing content and owns both `data-filtered` and native `hidden` on nonmatching options.
Authored hidden state is preserved when the query changes, options are replaced, or the owner disconnects.

## Transactions and lifecycle

A user selection dispatches cancelable, bubbling, composed `beforechange` before mutation.
Combobox and Select detail is frozen `{ value, values, sourceEvent }`.
Autocomplete detail is frozen `{ value, values: [value], optionValue, sourceEvent }`, where `value` is the proposed native-input text and `optionValue` is the option identity.

An accepted FACE proposal commits its values and form state, closes the native popup, and dispatches host `input` then `change`.
Autocomplete writes the native input and dispatches its native `input` then `change`; ordinary query edits remain single native events.

One transaction guard spans proposal, commit, `input`, and `change`.
Nested user selection is ignored throughout that interval, while programmatic writes remain permitted and invalidate stale work.
Before commit and between post-events, the owner revalidates its connection identity, document, form, native control, popup, collection membership and cardinality, option identities and eligibility, mode, disabled and readonly state, current values, and transaction revision.
Removing or replacing a source option or control, reassociating a form, disconnecting, reconnecting, or adopting the owner therefore preserves listener-authored state and suppresses stale mutation and post-events.

Host-local control, popup, filter, label, and collection observers belong to one `BaseElement` connection interval.
They stop synchronously on disconnection, release every current owned attribute, and bind exactly once to current nodes after insertion, replacement, reconnection, connected moves, or same-origin adoption.
Late parser children and late custom-element upgrades reconcile through the same identity-based path.

## Deliberate gaps

This implementation does not claim Base UI inline completion, grid navigation, virtualized collections, generic object values, React controlled callbacks, chips, portal positioning, transition status, or automatic display rendering of a selected label into an authored Select button.
It uses simple locale-aware lowercase substring matching rather than Base UI's configurable collator filter.
These are explicit product and API gaps, not deferred lifecycle or transaction correctness.

Authors who need browser-native select UI and behavior can use an ordinary `<select>` without an Base selection owner.
