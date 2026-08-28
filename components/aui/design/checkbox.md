# Checkbox activation decision

Status: awaiting API direction; the current Checkbox source is an unexported experiment.

The form-associated-host proof passes native form, label, validation, default/dirty state, reset, restoration, disabled-fieldset, and keyboard tests in the three browser engines.
It also demonstrates a material activation mismatch: an autonomous custom element has no native post-dispatch default-action hook.
Handling a click at the host cannot roll back a committed change when a later ancestor cancels that click.
Special-casing the JavaScript `click()` method can recover that one path, but leaves script and pointer activation with different observable ordering.
Do not ship that inconsistency as native checkbox behavior.

There are two honest contracts:

| Contract                         | Strength                                                                                                                                                  | Public consequence                                                                                                                                                                                   |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Host control with `beforechange` | Keeps the compact AUI element as the label, focus, validation, and form identity. A synchronous cancelable proposal handles controlled updates uniformly. | `beforechange` is the transactional cancellation API. Change events occur within host click handling, not after native click dispatch. Ancestor click cancellation does not undo an accepted change. |
| Native input inside the element  | The browser supplies click preactivation, cancellation rollback, event ordering, keyboard, editing, forms, and validation.                                | The input is the actual form/focus/label identity. Labels target its ID; the host coordinates or delegates. The authored markup contains a real input.                                               |

The native-input contract is the preferred route when exact platform behavior takes priority.
The host-control contract is reasonable if the user prefers the autonomous element's API and accepts its explicit event model.
Neither choice justifies maintaining two different activation algorithms for script and pointer input.

The rest of the form-control family must follow the selected identity and event contract before coverage expansion.
