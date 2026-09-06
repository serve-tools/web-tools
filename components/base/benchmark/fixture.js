import { CheckboxElement } from "@serve-tools/base-components/checkbox";

const FIELD_NAME = "choice";
const FORM_ID = "base-mount-diagnostic";
const TAG_NAME = "benchmark-base-checkbox";
const afterMicrotask = () => new Promise(queueMicrotask);
const controlId = (index) => `control-${index}`;
const controlLabel = (index) => `Option ${index}`;
const controlValue = (index) => `option-${index}`;
const initialChecked = (index) => index % 3 === 0;

class BenchmarkCheckboxElement extends CheckboxElement {}

customElements.define(TAG_NAME, BenchmarkCheckboxElement);

const container = document.createElement("div");
container.dataset.benchmarkRoot = "";
document.body.append(container);

let controls = [];
let form;
let states = [];

const teardown = async () => {
	const start = performance.now();
	container.replaceChildren();
	controls = [];
	form = undefined;
	states = [];
	await afterMicrotask();

	return performance.now() - start;
};

const mount = async (count) => {
	const teardownMs = controls.length > 0 ? await teardown() : 0;
	const start = performance.now();
	const nextForm = document.createElement("form");
	nextForm.id = FORM_ID;
	const fragment = document.createDocumentFragment();
	const nextControls = [];
	const nextStates = [];

	for (let index = 0; index < count; ++index) {
		const row = document.createElement("div");
		const control = document.createElement(TAG_NAME);
		control.id = controlId(index);
		control.name = FIELD_NAME;
		control.value = controlValue(index);
		control.checked = initialChecked(index);

		const label = document.createElement("label");
		label.htmlFor = control.id;
		label.textContent = controlLabel(index);
		row.append(control, label);
		fragment.append(row);
		nextControls.push(control);
		nextStates.push(initialChecked(index));
	}

	controls = nextControls;
	states = nextStates;
	nextForm.append(fragment);
	container.append(nextForm);
	form = nextForm;
	await afterMicrotask();

	return { mountMs: performance.now() - start, teardownMs };
};

const validate = () => {
	if (!form) {
		throw new Error("Base form is not mounted");
	}

	const start = performance.now();
	const failures = [];
	const actualControls = [...form.querySelectorAll(TAG_NAME)];
	const labels = [...form.querySelectorAll("label")];

	if (actualControls.length !== controls.length) {
		failures.push("control-count");
	}
	if (labels.length !== controls.length) {
		failures.push("label-count");
	}

	for (let index = 0; index < controls.length; ++index) {
		const control = controls[index];
		const label = labels[index];

		if (control !== actualControls[index]) {
			failures.push(`control-identity-${index}`);
		}
		if (control.checked !== states[index]) {
			failures.push(`checked-${index}`);
		}
		if (control.name !== FIELD_NAME) {
			failures.push(`name-${index}`);
		}
		if (control.value !== controlValue(index)) {
			failures.push(`value-${index}`);
		}
		if (control.id !== controlId(index)) {
			failures.push(`id-${index}`);
		}
		if (label.htmlFor !== control.id || label.textContent !== controlLabel(index)) {
			failures.push(`label-${index}`);
		}
		if (control.labels.length !== 1 || control.labels[0] !== label) {
			failures.push(`labels-${index}`);
		}
		if (control.form !== form) {
			failures.push(`form-${index}`);
		}
	}

	const formValues = new FormData(form).getAll(FIELD_NAME);
	const expectedValues = states.flatMap((checked, index) => (checked ? [controlValue(index)] : []));
	if (
		formValues.length !== expectedValues.length ||
		formValues.some((value, index) => value !== expectedValues[index])
	) {
		failures.push("form-data");
	}

	const sink = {
		checkedCount: states.filter(Boolean).length,
		controlCount: controls.length,
		formValueCount: formValues.length,
		labelCount: labels.length,
		lightDOMElementCount: form.getElementsByTagName("*").length,
		shadowElementCount: controls.reduce(
			(total, control) => total + (control.shadowRoot?.querySelectorAll("*").length ?? 0),
			0,
		),
		shadowRootCount: controls.filter((control) => control.shadowRoot !== null).length,
	};
	if (sink.checkedCount !== 334 || sink.formValueCount !== 334) {
		failures.push("checked-count");
	}
	if (sink.lightDOMElementCount !== 3_000) {
		failures.push("light-dom-count");
	}
	if (sink.shadowElementCount !== 3_000) {
		failures.push("shadow-element-count");
	}
	if (sink.shadowRootCount !== 1_000) {
		failures.push("shadow-root-count");
	}

	if (failures.length > 0) {
		throw new Error(`Base semantic validation failed: ${failures.slice(0, 12).join(", ")}`);
	}

	return { durationMs: performance.now() - start, sink };
};

globalThis.__baseMountDiagnostic = { mount, teardown, validate };
