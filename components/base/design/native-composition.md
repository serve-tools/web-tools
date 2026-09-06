# Native HTML families

Button, Input, Fieldset, Form, Radio, and Radio Group are supported through authored native HTML, not empty custom-element wrappers.
This is an intentional Base API decision rather than six additional runtime exports.
The gallery identifies these examples as Native HTML and counts examples, not classes or full Base UI behavioral parity.

## Ownership

One native control owns focus, its accessible identity, labels, editing or activation, validity, reset, and submission.
Native controls and Base form-associated controls can participate in the same form and disabled fieldset.
There is no hidden form mirror or second role-bearing focus target.
Author CSS uses native pseudo-classes such as `:checked`, `:disabled`, `:invalid`, and `:focus-visible`.
The browser, not an Base observer, keeps these states current after native property assignments.

Buttons retain their authored type, name, value, disabledness, form owner, submitter behavior, and popover commands.
Use `type="button"` for an action that must not submit a surrounding form.
Navigation remains an ordinary anchor with `href`.

Inputs retain native selection, input method composition, autofill, constraints, locale-specific editing, and input/change events.
There is no Base value signal unless an application explicitly binds one with Signal DOM.
Binding a native property does not itself impersonate a user action.
Native fieldsets preserve their first-legend exception and grouping semantics.
Native forms preserve validation, submitter identity, requestSubmit, reset, formdata, and navigation policy.
Gallery submit handlers prevent navigation only to display their local results.

The donor's Time capability likewise uses native `input[type=time]` instead of a fixed-locale segmented contenteditable editor.
Native min/max/step, editing, reset, and serialization remain authoritative.
Context and generic drag/drop are integrations with existing Serve Tools packages, not new Base classes.
Their gallery elements demonstrate owned connection lifetimes and retained layouts, while production behavior remains in those independently versioned packages.

## Radio grouping

Use native radio inputs with a shared nonempty name and a fieldset/legend for the visible group's accessible name.
The [HTML radio group algorithm](https://html.spec.whatwg.org/multipage/input.html#radio-button-group) groups inputs by name, form owner, and tree, not by fieldset containment.
Peers outside the visible fieldset still participate when they share those identities.
Put external `form` associations on the actual inputs.
Changing checkedness, name, form ownership, or tree membership follows the browser's own grouping algorithm.

Only the checked successful input contributes a form value.
A required group with no selection reports native value-missing validity; a disabled radio does not submit.
Checked attributes/defaultChecked define reset state, while checked properties define current state.
Native click cancellation restores preactivation checkedness, including the previous peer's state.
Do not add Base's FACE Checkbox beforechange transaction to native radio activation.

The [pinned Base UI Radio implementation](https://github.com/mui/base-ui/blob/v1.7.0/packages/react/src/radio/root/RadioRoot.tsx) uses a role-bearing root plus a hidden native input and React group coordination.
Base does not reproduce that structure or its controlled callback API.
Native radio values are strings; application objects remain application data.
Native radios have no read-only mode.
Arrow navigation, focus entry, and RTL behavior follow the browser and may differ from Base UI's composite navigation policy.
There is no Base orientation, loop, value-object comparison, or group form-value API for these native examples.

## Verification boundary

The browser tests exercise native/Base form composition, the disabled fieldset first-legend exception, submitter values, required validation, reset, radio form ownership, dynamic grouping, label activation, keyboard activation, and canceled native radio activation.
They verify the composition Base documents, rather than claiming to retest every browser editing implementation or assistive technology.
Manual screen-reader and platform input-method coverage remains part of the release gate.
