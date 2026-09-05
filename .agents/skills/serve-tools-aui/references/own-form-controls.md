# Own a form control

Use `FormAssociatedElement` from `@serve-tools/aui/form-associated` when the custom-element host owns form participation.
It extends `AUIElement`, so return ordinary `html` from `layout()` and use the existing connection resource contract.
The base attaches one protected `internals` object without calling subclass hooks during construction.
Replay pre-definition own properties in the concrete registered class after its state initializes; this is not automatic.
Follow the initialization recipe in the package's `design/form-foundations.md` and preserve the dependency order of component-specific properties.

The inherited `form`, `labels`, `validity`, `validationMessage`, `willValidate`, `checkValidity()`, and `reportValidity()` delegate to that object.
The inherited `name`, `disabled`, `readOnly`, and `required` properties reflect attributes without choosing component-specific validation or interaction behavior.
Set submission and restoration data through `internals.setFormValue(value, state)`.
The subclass owns its value shape, reset and restoration callbacks, accessibility role, focus behavior, and native editor if present.
Do not introduce a second submitted value when retaining an already form-associated native input.

`setCustomValidity(message)` synchronously coerces and stores `customValidity`, then calls protected `synchronizeValidity()`.
The default hook applies only a custom error.
Override it to combine that message with component constraints using `internals.setValidity()`.
Keep validity updates synchronous; validation presentation and user-interaction timing remain separate policy.

The internal checked-control and native-field bases are implementation details, not supported imports.
Existing Checkbox, Switch, Select, Combobox, Number Field, and OTP Field contracts remain unchanged.
Use the existing `FieldElement` when coordinating labels, descriptions, and errors around authored controls.
This migration does not introduce an owned-control `FormFieldElement` shell or declarative property metadata.
