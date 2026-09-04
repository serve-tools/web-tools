# Compose numeric and code-entry controls

Register only the controls the application uses.

```ts
import { NumberFieldElement } from "@serve-tools/aui/number-field";
import { OTPFieldElement } from "@serve-tools/aui/otp-field";
import { SliderElement } from "@serve-tools/aui/slider";

customElements.define("app-number-field", NumberFieldElement);
customElements.define("app-otp-field", OTPFieldElement);
customElements.define("app-slider", SliderElement);
```

## Adjust a number

```html
<app-number-field min="1" max="12" step="1">
	<button slot="decrement" aria-label="Decrease quantity">−</button>
	<input type="number" name="quantity" aria-label="Quantity" value="2" />
	<button slot="increment" aria-label="Increase quantity">+</button>
</app-number-field>
```

The native number input remains the sole editor, focus target, validation target, and form value.
Keep its `name`, `form`, default value, label, and custom validity on that input.
The host coordinates constraints and exposes `input`, `decrementButton`, `incrementButton`, `value`, `valueAsNumber`, `stepUp()`, and `stepDown()`.

Host property writes and direct step methods are silent and can stage a value until an input arrives.
An accepted authored step-button action sends cancelable `beforechange` from the host, followed by `input` and one `change` from the actual input.
Typing remains a native edit and has only the browser's ordinary events.

## Enter a one-time code

```html
<app-otp-field length="6">
	<input name="code" aria-label="Verification code" pattern="[0-9]{6}" />
	<span slot="segment"></span>
	<span slot="segment"></span>
	<span slot="segment"></span>
	<span slot="segment"></span>
	<span slot="segment"></span>
	<span slot="segment"></span>
</app-otp-field>
```

OTP Field retains one native input for typing, paste, selection, composition, autofill, focus, validation, and submission.
It supplies missing one-time-code autocomplete and numeric keyboard hints and can coordinate exact length, disabledness, read-only state, and requiredness.
Put actual digit validation on the input because a numeric input mode does not constrain values.
Segments are optional inert visual mirrors, not editors.
Host `value` assignments are silent, including values staged before the input exists.

## Select a range or interval

```html
<app-slider min="0" max="100" step="1">
	<input type="range" name="minimum" aria-label="Minimum price" value="20" />
	<input type="range" name="maximum" aria-label="Maximum price" value="80" />
</app-slider>
```

Each range input keeps a separate focus target, accessible label, native track, and form entry.
Read frozen `inputs` and `values` snapshots in author order.
Assign one numeric value per current input, or set `value` for the first input; programmatic writes are silent and may be staged until compatible inputs exist.
Native pointer and keyboard edits emit events from the edited input after the browser changes it.

The host coordinates shared bounds, step, disabledness, and horizontal or vertical orientation.
Adjacent native bounds prevent interval thumbs from crossing.
The default layout keeps tracks separate because overlapping native ranges do not have portable cross-engine pointer hit testing.
Do not present Slider as one synthetic multi-thumb accessibility identity or promise a portable shared track.

## Put retained inputs in Field

Number Field and OTP Field expose a readonly native `input`, so either wrapper can be the direct `slot="control"` participant of `FieldElement`.
Field resolves that contained light-DOM input for labels, descriptions, errors, validity, focus, dirty state, and form reset without creating another form identity.
Slider exposes several inputs and is not one Field control; label each native range and coordinate interval-level help outside a single-control Field.
