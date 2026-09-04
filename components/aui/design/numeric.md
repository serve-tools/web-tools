# Numeric and code-entry controls

`NumberFieldElement`, `OTPFieldElement`, and `SliderElement` coordinate retained native inputs.
The native inputs remain the only focus, editing, validation, accessibility, and form-submission identities.
The hosts are not form-associated custom elements and do not create duplicate hidden controls.

The behavior was compared with Base UI 1.7.0's [Number Field](https://github.com/mui/base-ui/tree/v1.7.0/packages/react/src/number-field), [Input](https://github.com/mui/base-ui/tree/v1.7.0/packages/react/src/input), and [Slider](https://github.com/mui/base-ui/tree/v1.7.0/packages/react/src/slider) packages.
This implementation uses its own native-input architecture and does not claim every Base UI formatting, gesture, or visual behavior.

## Number field

```html
<aui-number-field min="0" max="12" step="1">
	<button slot="decrement" aria-label="Decrease quantity">−</button>
	<input type="number" name="quantity" aria-label="Quantity" value="2" />
	<button slot="increment" aria-label="Increase quantity">+</button>
</aui-number-field>
```

The first direct `input[type="number"]` is exposed as `input`.
The first direct native buttons assigned to `slot="decrement"` and `slot="increment"` are exposed as `decrementButton` and `incrementButton`.
The component temporarily owns `type="button"` on its step buttons to prevent accidental form submission and restores authored values when a button leaves.

The host properties `min`, `max`, `step`, `disabled`, `readOnly`, and `required` reversibly coordinate the matching native input attributes.
The native input retains its authored `name`, `form`, label relationships, default value, and validity identity.
Native fieldset disabledness therefore works without component emulation.

`value` and `valueAsNumber` read and silently set the current native value.
`stepUp()` and `stepDown()` silently delegate to the native input, including its native exceptions and Web IDL conversion.
When the host has `step="any"`, an authored step button uses a one-unit step, while direct `stepUp()` and `stepDown()` retain the native `InvalidStateError` behavior.

An authored step-button action first emits a bubbling, composed, cancelable `beforechange` event on the host.
Its frozen `detail` contains `value`, `valueAsNumber`, `direction`, and the native button `sourceEvent`.
If accepted, the actual input receives a composed `input` event and one terminal `change` event.
Holding a pointer on a step button repeats after 400 milliseconds at 75 millisecond intervals and releases all timers and document listeners on pointer end or disconnection.

Native text entry, wheel behavior, browser keyboard editing, and browser validation happen directly on the input.
The component does not emit a precommit proposal for native editing because the native edit has already happened when `input` fires.
It does not add locale formatting, scrubbing, or a custom readonly interaction model.

The host exposes `:state(disabled)`, `:state(readonly)`, and `:state(invalid)` as styling snapshots.
The native input remains the authority when exact state is required.

## One-time-code field

```html
<aui-otp-field length="6">
	<input
		name="code"
		aria-label="Verification code"
		pattern="[0-9]{6}"
	/>
	<span slot="segment"></span>
	<span slot="segment"></span>
	<span slot="segment"></span>
	<span slot="segment"></span>
	<span slot="segment"></span>
	<span slot="segment"></span>
</aui-otp-field>
```

The first direct text, password, or telephone input is exposed as `input` and is the only editor.
The component defaults missing `autocomplete` and `inputmode` attributes to `one-time-code` and `numeric` respectively.
Authored values override those defaults and are preserved when the input leaves.

A positive host `length` owns equal native `minlength` and `maxlength` constraints.
Authors place a `pattern` such as `[0-9]{6}` on the actual input when digit validation is required, because `inputmode="numeric"` is only a keyboard hint.
The host's `disabled`, `readOnly`, and `required` properties reversibly coordinate the native attributes.
`value`, `validity`, `validationMessage`, `checkValidity()`, and `reportValidity()` are silent native delegations.

Paste, selection, composition, `beforeinput` cancellation, browser password-manager behavior, and one-time-code autofill stay on the actual input.
The component does not split editing across inputs, redistribute pasted text, or synthesize an autofill event.
Programmatic `value` assignment does not imitate a user edit.

Direct elements assigned to `slot="segment"` are optional display mirrors exposed as `segments`.
They are forced to `aria-hidden="true"` and `inert`, retain authored content, and receive `data-value`, `data-filled`, and `data-active` snapshots.
The inert `segments` shadow part wraps their named slot, so its flat-tree descendants remain noninteractive even when a segment is not an HTML element.
Removing a segment restores its authored attributes.

The host exposes `:state(complete)`, `:state(disabled)`, `:state(readonly)`, and `:state(invalid)` for styling.
Exact native validity can depend on browser dirty-value rules, so consumers should read `input.validity` for submission decisions.

## Slider and intervals

```html
<aui-slider min="0" max="100" step="1">
	<input type="range" name="minimum" aria-label="Minimum price" value="20" />
	<input type="range" name="maximum" aria-label="Maximum price" value="80" />
</aui-slider>
```

Every direct `input[type="range"]` is exposed in author order through `inputs`.
Each range keeps its own focus, native keyboard and pointer behavior, `name`, form value, and accessible label.
One range is a native single-value slider.
Two or more ranges form an ordered interval or ordered multi-value control rather than one synthetic accessibility identity.

The host's `min`, `max`, `step`, and `disabled` properties reversibly coordinate native attributes.
When host bounds are absent, the first range's authored native bounds define the shared outer bounds.
Each range receives the preceding value as its live native minimum and the following value as its live native maximum.
These native constraints prevent adjacent thumbs from crossing during pointer and keyboard edits and keep exposed value bounds coherent with the interval.

`values` returns a frozen numeric snapshot in input order.
Its setter requires one value per current range, silently clamps values to the outer bounds, and moves a later value up when needed to preserve order.
`value` is a silent convenience for the first range.
Programmatic setters do not dispatch `input` or `change`.
Native pointer and keyboard edits dispatch their ordinary events from the edited input; there is no cancelable precommit event after a native range has already changed.

`orientation="vertical"` applies native vertical writing mode and `aria-orientation="vertical"` to each actual range.
Horizontal ranges inherit document direction, including RTL.
The component does not claim readonly behavior or track-drag gestures because native range inputs do not provide a portable readonly contract or multi-thumb track gesture.

The `track` shadow part contains a named `thumb` slot followed by the default slot.
Ranges may use `slot="thumb"` when that explicit composition hook is useful; unnamed ranges behave identically.
The track part exposes `--aui-slider-min`, `--aui-slider-max`, and ordered percentage values `--aui-slider-value-0`, `--aui-slider-value-1`, and so on.
The percentage variables are tested in Chromium, Firefox, and WebKit and can paint an interval rail without replacing the real inputs:

```css
aui-slider::part(track) {
  background:
    linear-gradient(
      to right,
      transparent 0 var(--aui-slider-value-0),
      AccentColor var(--aui-slider-value-0) var(--aui-slider-value-1),
      transparent var(--aui-slider-value-1) 100%
    ) center / 100% 0.25rem no-repeat;
}

aui-slider:dir(rtl)::part(track) {
  background-image:
    linear-gradient(
      to left,
      transparent 0 var(--aui-slider-value-0),
      AccentColor var(--aui-slider-value-0) var(--aui-slider-value-1),
      transparent var(--aui-slider-value-1) 100%
    );
}
```

The percentage variables are logical minimum-to-maximum positions.
An RTL horizontal rail therefore reverses its gradient direction as shown above, matching the actual native thumbs without changing the variable values.
Vertical native ranges put the minimum at the bottom through their vertical writing mode and direction; vertical author paint must use the corresponding bottom-to-top axis.

The default layout renders native ranges separately so every track remains a reliable pointer target.
Authors can visually overlay native ranges and style their engine-specific native thumb pseudo-elements, but pointer hit testing for overlapping range tracks is not standardized across engines.
The component therefore does not present that technique as a portable shared multi-thumb track or paint noninteractive replacement thumbs.

The host exposes `:state(disabled)`, `:state(multiple)`, and `:state(vertical)` for styling.

## Lifecycle and ownership

All three components retain authored light-DOM inputs and controls.
Mutation observers and document-level repeat listeners exist only during a connected interval and are stopped synchronously on disconnection or adoption.
Component-owned attributes are restored when a retained node stops participating, while author changes made during ownership become the values restored later.
Late-upgrade property assignments are replayed through the public accessors, and programmatic values assigned before an input exists are applied when the matching direct input appears.
A connected host also observes native form reset capture so a later same-task reset is ordered after an earlier pending host value, even before the child-list observer runs.

Native `.value` and `.valueAsNumber` setters and `form.reset()` are intentionally silent, so host custom states, OTP segment attributes, slider ordering, and slider percentage variables are snapshots rather than continuously observed state.
The native input value is authoritative immediately.
Reading `NumberFieldElement.value`, `OTPFieldElement.value`, or `SliderElement.values`, or invoking another host operation, refreshes the corresponding snapshots without synthesizing `input` or `change` events.
Passive direct-child membership edits refresh on the next mutation-observer delivery, host operation, or reconnection rather than synchronously at the DOM mutation call.

These classes require explicit custom-element registration and do not scan the document or keep a global element registry.
