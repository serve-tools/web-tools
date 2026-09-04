# Compose selection controls

Register the selection elements under application tag names.

```ts
import { AutocompleteElement } from "@serve-tools/aui/autocomplete";
import { ComboboxElement } from "@serve-tools/aui/combobox";
import { OptionElement } from "@serve-tools/aui/option";
import { SelectElement } from "@serve-tools/aui/select";

customElements.define("app-option", OptionElement);
customElements.define("app-autocomplete", AutocompleteElement);
customElements.define("app-combobox", ComboboxElement);
customElements.define("app-select", SelectElement);
```

## Suggest editable text

```html
<app-autocomplete>
	<label for="airport">Airport</label>
	<input id="airport" name="airport" autocomplete="off" />
	<div popover="manual">
		<app-option value="jfk">John F. Kennedy International</app-option>
		<app-option value="lga" label="LaGuardia Airport">New York LaGuardia</app-option>
	</div>
</app-autocomplete>
```

Autocomplete retains the native input as the only editor, focus target, label target, validator, reset participant, and submitted form identity.
The option value is suggestion identity; accepting it writes the option label to the input, and that visible string is submitted.
Query input keeps its ordinary event, IME, autofill, disabled, and read-only behavior.
Accepted suggestions propose through Autocomplete `beforechange`, then dispatch `input` and `change` from the actual input.

## Select explicit values with text input

```html
<label for="services">Services</label>
<app-combobox id="services" name="service" multiple required>
	<input autocomplete="off" />
	<div popover="manual">
		<app-option value="">No service</app-option>
		<app-option value="basic">Basic</app-option>
		<app-option value="pro">Professional</app-option>
	</div>
</app-combobox>
```

Combobox is the only FACE form identity and its native input is the only focus and accessibility identity.
Put submission `name`, external `form`, requiredness, disabledness, and read-only state on the host.
The component removes an input name while it owns that input to prevent duplicate form data and restores the latest authored name on release.
Use host `setCustomValidity(message)` for an application error and clear it with `setCustomValidity("")`.
The custom error remains authoritative across selection changes and native form reset until it is cleared.

## Select explicit values with a button

```html
<label for="region">Region</label>
<app-select id="region" name="region">
	<button><span data-selected-label>Choose a region</span></button>
	<div popover="manual">
		<app-option value="" selected>None</app-option>
		<app-option value="americas">Americas</app-option>
		<app-option value="emea">Europe, Middle East, and Africa</app-option>
	</div>
</app-select>
```

Select is the only FACE form identity and its native button remains the focus and accessibility identity.
The component owns `type="button"` while connected, then restores the author's latest type.
It does not render a selected label into the button.
Listen for host `change`, find the Option whose `selected` property is true, and write the product's desired summary into authored button content.
Run the same renderer after silent programmatic `value`, `values`, or Option `selected` writes.

## Read and write values

Every owned Option needs an explicit unique string `value`; `value=""` is valid.
Use its optional `label` for matching, accepted text, and accessible text without replacing authored visual content.

Combobox and Select expose frozen `values` in DOM order.
`[]` is no selection, while `[""]` selects the empty-valued option; scalar `value` returns `""` for both and is only a single-value convenience.
Programmatic `value`, `values`, and Option `selected` writes are silent.
`selected` changes dirty current state, while `defaultSelected` reflects the `selected` attribute used as the latest form-reset default.
Changing defaults does not replace a dirty current selection until reset.
Option `value`, `disabled`, `label`, and `defaultSelected` IDL writes reconcile the owner synchronously; text-node edits reconcile on the owner observer turn.
Autocomplete also refilters after an option text-node edit on that turn.

User Combobox or Select changes first send cancelable `beforechange` with frozen `{ value, values, sourceEvent }`.
Accepted changes commit before host `input` and `change`.
Autocomplete uses `{ value, values: [value], optionValue, sourceEvent }`, where value is the accepted native-input text and optionValue is Option identity.

## Preserve native popup and labeling behavior

Author one direct popup with a `popover` attribute.
AUI temporarily uses auto-popover behavior and native opening, cancellation, Escape, light dismissal, source association, and toggle events remain authoritative.
DOM focus stays on the native input or button while active-descendant semantics move through eligible options.

External labels for Combobox and Select target the FACE host and focus the current native control.
Call `refresh()` after adding, removing, or retargeting an external label or changing its ID.
Existing associated label text remains live without refresh; host-local control, option, ARIA, and popup mutations reconcile automatically.

Do not assume inline completion, grids, virtualized options, generic object values, chips, portal positioning, transition state, configurable collator filtering, or automatic selected-label rendering.
Use native `<select>` when native picker behavior is required.
