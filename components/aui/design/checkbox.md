# Checkbox activation decision

Status: approved; follow Base UI's interaction pattern with native custom-element form association.
The public implementation passes 63 browser cases across Chromium, Firefox, and WebKit.

## Reference and decision

The user selected the Base UI pattern rather than requiring exact native checkbox click preactivation and rollback.
The pinned reference is [`CheckboxRoot` in Base UI 1.7.0](https://github.com/mui/base-ui/blob/v1.7.0/packages/react/src/checkbox/root/CheckboxRoot.tsx), with its [behavior tests](https://github.com/mui/base-ui/blob/v1.7.0/packages/react/src/checkbox/root/CheckboxRoot.test.tsx).
Base UI renders an interactive role-bearing root and a separate hidden form input.
Its `onCheckedChange` callback receives a proposed value and can cancel it before component state changes.
That cancellation channel is distinct from an ancestor preventing the original click's default action.

AUI keeps one labelable, focusable, form-associated custom-element host.
Guaranteed `ElementInternals` support provides the form value, labels, validation, disabled-fieldset behavior, accessible role, and CSS states without a hidden form input.
Authors do not need to supply an input or use React-shaped callbacks.
The implementation must not claim exact native input click ordering or use a special activation algorithm for JavaScript `click()`.

## Interaction contract

Pointer, label, Space, synthetic click, and `click()` activation use the same synchronous transaction:

1. Refuse activation while disabled or read-only, or when the click was canceled before the component handles it.
2. Dispatch a bubbling, composed, cancelable `beforechange` event with immutable `detail.checked` and the original `detail.sourceEvent`.
3. If canceled, leave the component's state untouched and emit no `input` or `change`.
4. Otherwise, commit proposed checkedness and synchronize form value, validity, ARIA, and CSS states.
5. Dispatch bubbling, composed `input`, followed by bubbling, noncomposed `change`.

The proposal sees the old checked state.
Input and change listeners see committed state.
All three events occur within the component's click handling; an ancestor click listener runs afterward during bubbling.
Use `beforechange.preventDefault()` to veto a transition, including from an ancestor or outside a shadow root.
Preventing a later click listener does not roll back a committed change.
Cancellation never rolls back changes an application listener makes itself.
Reentrant activation during a transaction is ignored, and a proposal listener that disables the control or makes it read-only prevents the pending commit.

Programmatic property assignments are synchronous and silent.
`checked` is current state; the `checked` attribute and `defaultChecked` supply default state until checkedness becomes dirty.
Form reset restores default checkedness and clears dirtiness without dispatching interaction events.
Indeterminate presentation is independent of boolean checkedness, as in Base UI; activation does not clear it.
Applications managing a partial-selection state update `indeterminate` explicitly.

## Forms and keys

`value` defaults to `"on"`; an unchecked control submits nothing unless `uncheckedValue` is defined.
The optional `unchecked-value` attribute supports an empty string as a real submitted value.
Disabled controls submit neither value; read-only controls retain focusability and form participation.
All three tested browser engines exclude both a read-only native checkbox and a `readonly` form-associated custom element from constraint validation; AUI preserves this platform behavior.
Native `form` association supports an external form ID, and required validation still depends on checkedness.
State restoration retains both checked and indeterminate state.

Space activates once on key release.
Enter does not toggle.
To match Base UI, an uncanceled Enter keydown activates the associated form's first submit button after event propagation.
An ancestor can prevent that submission with `keydown.preventDefault()`.
No submitter means no implicit submission, and a disabled first submitter blocks submission rather than selecting a later one.
The default submitter is the first native button or input of type `submit` in `form.elements`, including externally associated controls.
Image inputs are excluded, matching the pinned Base UI helper.
Pending key work must not survive removal, document adoption, reassociation, or effective disabling.
An interaction generation also cancels pending Enter work when association or disabled state changes away and back before the queued work runs.

## Boundaries

The shadow layout provides a presentational `control` part and `indicator` slot; the host retains the sole control identity.
Authored checkbox content must be text or decorative content; nested interactive controls are not a supported composition.
The component does not create duplicate hidden inputs or intercept native form serialization with document listeners.
Checkbox Group and parent/select-all behavior are separate family work and are not implied by this standalone control.
The remaining accessibility gate includes manual assistive-technology evaluation; passing browser assertions is not a substitute.
No source or tests were copied from Base UI to implement this contract.
