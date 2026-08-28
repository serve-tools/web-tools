import type { CheckboxElement, FieldControl, SwitchElement } from "@serve-tools/aui";
import { FieldElement } from "@serve-tools/aui";
import type { FieldElement as Field } from "@serve-tools/aui/field";

const constructor: typeof Field = FieldElement;
const field = null as unknown as FieldElement;
const element: HTMLElement = field;
const input = null as unknown as HTMLInputElement;
const select = null as unknown as HTMLSelectElement;
const textarea = null as unknown as HTMLTextAreaElement;
const checkbox = null as unknown as CheckboxElement;
const control = null as unknown as SwitchElement;
const controls: readonly FieldControl[] = [input, select, textarea, checkbox, control];
const values: readonly unknown[] | undefined = controls[0].values;
const current: FieldControl | null = field.control;
const label: HTMLLabelElement | null = field.label;
const descriptions: readonly HTMLElement[] = field.descriptions;
const errors: readonly HTMLElement[] = field.errors;
const valid: boolean | null = field.valid;
const states: boolean[] = [
	field.invalid,
	field.dirty,
	field.touched,
	field.filled,
	field.focused,
	field.disabled,
	field.required,
];
field.refresh();
field.resetState();
current?.setCustomValidity("Server validation message");
// @ts-expect-error Controls are selected from authored DOM, not assigned through Field.
field.control = input;
// @ts-expect-error Nullable validity is not always a boolean.
const alwaysValid: boolean = field.valid;
// @ts-expect-error Field is not another form owner.
field.form;
// @ts-expect-error Disabledness belongs to the actual control.
field.disabled = true;
// @ts-expect-error Relationship collections are immutable snapshots.
field.errors.push(document.createElement("p"));
void [constructor, element, controls, values, label, descriptions, errors, valid, states, alwaysValid];
