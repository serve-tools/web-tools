import { CheckboxElement } from "@serve-tools/base-components/checkbox";
import {
	afterMicrotask,
	controlId,
	controlLabel,
	controlValue,
	expectedValues,
	FIELD_NAME,
	FORM_ID,
	initialChecked,
	makeTargets,
} from "./constants.js";

const setupStartedAt = performance.now();
const tagName = "bench-base-checkbox";

class BenchCheckboxElement extends CheckboxElement {}

customElements.define(tagName, BenchCheckboxElement);

const container = document.createElement("div");
container.dataset.benchRoot = "";
document.body.append(container);

let form;
let controls = [];
let states = [];

const cheapMountInvariant = (count) => {
	const first = controls[0];
	const last = controls[count - 1];

	if (
		form !== container.firstElementChild ||
		!form?.isConnected ||
		controls.length !== count ||
		states.length !== count ||
		!first?.isConnected ||
		!last?.isConnected ||
		first.id !== controlId(0) ||
		last.id !== controlId(count - 1) ||
		first.checked !== states[0] ||
		last.checked !== states[count - 1]
	) {
		throw new Error("Base retained-reference mount invariant failed");
	}

	return { controlCount: count, firstChecked: first.checked, lastChecked: last.checked };
};

const cheapUpdateInvariant = (targets) => {
	const firstIndex = targets[0];
	const lastIndex = targets.at(-1);

	if (
		!form?.isConnected ||
		!controls[0]?.isConnected ||
		!controls.at(-1)?.isConnected ||
		controls.length !== 1000 ||
		states.length !== 1000
	) {
		throw new Error("Base retained-reference update invariant failed");
	}

	return { firstChecked: states[firstIndex], firstIndex, lastChecked: states[lastIndex], lastIndex };
};

const validate = () => {
	if (!form) {
		throw new Error("Base form is not mounted");
	}
	const failures = [];
	const labels = [...form.querySelectorAll("label")];
	const actualControls = [...form.querySelectorAll(tagName)];

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
			failures.push(`label-content-${index}`);
		}
		if (control.labels.length !== 1 || control.labels[0] !== label) {
			failures.push(`labels-${index}`);
		}
		if (control.form !== form) {
			failures.push(`form-owner-${index}`);
		}
	}

	const actualValues = new FormData(form).getAll(FIELD_NAME);
	const wantedValues = expectedValues(states);
	if (
		actualValues.length !== wantedValues.length ||
		actualValues.some((value, index) => value !== wantedValues[index])
	) {
		failures.push("form-data");
	}

	if (failures.length > 0) {
		throw new Error(`Base semantic validation failed: ${failures.slice(0, 12).join(", ")}`);
	}

	return {
		checkedCount: states.filter(Boolean).length,
		controlCount: controls.length,
		formValues: actualValues,
		labelCount: labels.length,
		lightDOMElementCount: form.getElementsByTagName("*").length,
		shadowElementCount: controls.reduce(
			(total, control) => total + (control.shadowRoot?.querySelectorAll("*").length ?? 0),
			0,
		),
		shadowRootCount: controls.filter((control) => control.shadowRoot !== null).length,
	};
};

const teardown = async () => {
	container.replaceChildren();
	form = undefined;
	controls = [];
	states = [];
	await afterMicrotask();
};

const mount = async (count) => {
	if (controls.length > 0) {
		await teardown();
	}

	const start = performance.now();
	const nextForm = document.createElement("form");
	nextForm.id = FORM_ID;
	nextForm.dataset.benchForm = "";
	const fragment = document.createDocumentFragment();
	const nextControls = [];
	const nextStates = [];

	for (let index = 0; index < count; ++index) {
		const row = document.createElement("div");
		row.dataset.benchRow = "";

		const control = document.createElement(tagName);
		control.dataset.benchControl = "";
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
		nextStates.push(control.checked);
	}

	controls = nextControls;
	states = nextStates;
	nextForm.append(fragment);
	container.append(nextForm);
	form = nextForm;
	await afterMicrotask();
	const sink = cheapMountInvariant(count);
	const durationMs = performance.now() - start;
	return { durationMs, sink };
};

const update = async (targets) => {
	if (controls.length !== 1000) {
		throw new Error("Base update fixture requires 1,000 mounted controls");
	}

	const start = performance.now();
	for (const index of targets) {
		states[index] = !states[index];
		controls[index].checked = states[index];
	}
	await afterMicrotask();
	const sink = cheapUpdateInvariant(targets);
	const durationMs = performance.now() - start;
	return { durationMs, sink };
};

const updateSeries = async (repetitions, offset = 0) => {
	if (controls.length !== 1000) {
		throw new Error("Base update fixture requires 1,000 mounted controls");
	}

	const start = performance.now();
	let lastIndex = 0;
	for (let repetition = 0; repetition < repetitions; ++repetition) {
		lastIndex = ((offset + repetition) * 37) % controls.length;
		states[lastIndex] = !states[lastIndex];
		controls[lastIndex].checked = states[lastIndex];
		await afterMicrotask();
	}
	const sink = cheapUpdateInvariant([lastIndex]);
	const durationMs = performance.now() - start;
	return { durationMs, perOperationMs: durationMs / repetitions, repetitions, sink };
};

const updateBatchSeries = async (repetitions, size, offset = 0) => {
	if (controls.length !== 1000) {
		throw new Error("Base update fixture requires 1,000 mounted controls");
	}

	const start = performance.now();
	let targets = [];
	for (let repetition = 0; repetition < repetitions; ++repetition) {
		targets = makeTargets(size, controls.length, offset + repetition);
		for (const index of targets) {
			states[index] = !states[index];
			controls[index].checked = states[index];
		}
		await afterMicrotask();
	}
	const sink = cheapUpdateInvariant(targets);
	const durationMs = performance.now() - start;
	return { durationMs, perOperationMs: durationMs / repetitions, repetitions, sink };
};

globalThis.__checkboxBench = {
	condition: "base",
	mount,
	setupMs: performance.now() - setupStartedAt,
	teardown,
	update,
	updateBatchSeries,
	updateSeries,
	validate,
};
