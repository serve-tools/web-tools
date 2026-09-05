import { Checkbox } from "@base-ui/react/checkbox";
import * as React from "react";
import { createRoot } from "react-dom/client";
import {
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
const container = document.createElement("div");
container.dataset.benchReactRoot = "";
document.body.append(container);
const root = createRoot(container);

let epoch = 0;
let form;
let firstControl;
let lastControl;
let mountCompletion;
let updateCompletion;
let setters = [];
let states = [];

const retainForm = (element) => {
	form = element ?? undefined;
};
const retainFirstControl = (element) => {
	firstControl = element ?? undefined;
};
const retainLastControl = (element) => {
	lastControl = element ?? undefined;
};

const cheapMountInvariant = (count) => {
	if (
		form !== container.firstElementChild ||
		!form?.isConnected ||
		states.length !== count ||
		setters.length !== count ||
		!firstControl?.isConnected ||
		!lastControl?.isConnected ||
		firstControl.id !== controlId(0) ||
		lastControl.id !== controlId(count - 1) ||
		firstControl.getAttribute("aria-checked") !== String(states[0]) ||
		lastControl.getAttribute("aria-checked") !== String(states[count - 1])
	) {
		throw new Error("Base UI retained-reference mount invariant failed");
	}

	return { controlCount: count, firstChecked: states[0], lastChecked: states[count - 1] };
};

const finishMountOnMicrotask = (completion) => {
	queueMicrotask(() => {
		try {
			const sink = cheapMountInvariant(completion.count);
			completion.resolve({ durationMs: performance.now() - completion.startedAt, sink });
		} catch (error) {
			completion.reject(error);
		}
	});
};

const finishUpdateOnMicrotask = (completion) => {
	queueMicrotask(completion.resolve);
};

const Row = ({ count, index }) => {
	const [checked, setChecked] = React.useState(() => initialChecked(index));

	React.useLayoutEffect(() => {
		setters[index] = setChecked;
		return () => {
			setters[index] = undefined;
		};
	}, [index]);

	React.useLayoutEffect(() => {
		states[index] = checked;
		const completion = updateCompletion;
		if (!completion?.remaining.has(index)) {
			return;
		}
		completion.remaining.delete(index);
		if (completion.remaining.size === 0) {
			updateCompletion = undefined;
			finishUpdateOnMicrotask(completion);
		}
	}, [checked, index]);

	const ref = index === 0 ? retainFirstControl : index === count - 1 ? retainLastControl : undefined;

	return React.createElement(
		"div",
		{ "data-bench-row": "" },
		React.createElement(Checkbox.Root, {
			checked,
			"data-bench-control": "",
			id: controlId(index),
			name: FIELD_NAME,
			nativeButton: true,
			onCheckedChange: setChecked,
			render: React.createElement("button", { ref, type: "button" }),
			value: controlValue(index),
		}),
		React.createElement("label", { htmlFor: controlId(index) }, controlLabel(index)),
	);
};

const App = ({ count }) => {
	React.useLayoutEffect(() => {
		if (!mountCompletion) {
			return;
		}
		const completion = mountCompletion;
		mountCompletion = undefined;
		finishMountOnMicrotask(completion);
	}, []);

	return React.createElement(
		"form",
		{ "data-bench-form": "", id: FORM_ID, ref: retainForm },
		Array.from({ length: count }, (_, index) => React.createElement(Row, { count, index, key: index })),
	);
};

const CommitSentinel = ({ resolve }) => {
	React.useLayoutEffect(() => {
		queueMicrotask(resolve);
	}, [resolve]);
	return null;
};

const validate = () => {
	if (!form) {
		throw new Error("Base UI form is not mounted");
	}

	const failures = [];
	const controls = [...form.querySelectorAll("button[data-bench-control]")];
	const labels = [...form.querySelectorAll("label")];
	const inputs = [...form.querySelectorAll('input[type="checkbox"][aria-hidden="true"]')];

	if (controls.length !== states.length) {
		failures.push("control-count");
	}
	if (labels.length !== states.length) {
		failures.push("label-count");
	}
	if (inputs.length !== states.length) {
		failures.push("input-count");
	}

	for (let index = 0; index < states.length; ++index) {
		const control = controls[index];
		const label = labels[index];
		const input = inputs[index];
		if (control?.getAttribute("role") !== "checkbox") {
			failures.push(`role-${index}`);
		}
		if (control?.getAttribute("aria-checked") !== String(states[index])) {
			failures.push(`aria-checked-${index}`);
		}
		if (control?.id !== controlId(index)) {
			failures.push(`id-${index}`);
		}
		if (label?.htmlFor !== controlId(index) || label.textContent !== controlLabel(index)) {
			failures.push(`label-content-${index}`);
		}
		if (control?.labels.length !== 1 || control.labels[0] !== label) {
			failures.push(`labels-${index}`);
		}
		if (input?.checked !== states[index]) {
			failures.push(`input-checked-${index}`);
		}
		if (input?.name !== FIELD_NAME) {
			failures.push(`input-name-${index}`);
		}
		if (input?.value !== controlValue(index)) {
			failures.push(`input-value-${index}`);
		}
		if (input?.form !== form) {
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
		throw new Error(`Base UI semantic validation failed: ${failures.slice(0, 12).join(", ")}`);
	}

	return {
		checkedCount: states.filter(Boolean).length,
		controlCount: controls.length,
		formValues: actualValues,
		hiddenInputCount: inputs.length,
		labelCount: labels.length,
		lightDOMElementCount: form.getElementsByTagName("*").length,
		shadowElementCount: 0,
		shadowRootCount: 0,
	};
};

const teardown = async () => {
	if (!container.firstChild) {
		return;
	}
	await new Promise((resolve) => {
		root.render(React.createElement(CommitSentinel, { resolve }));
	});
	form = undefined;
	firstControl = undefined;
	lastControl = undefined;
	setters = [];
	states = [];
};

const mount = async (count) => {
	if (container.firstChild) {
		await teardown();
	}
	const startedAt = performance.now();
	setters = new Array(count);
	states = Array.from({ length: count }, (_, index) => initialChecked(index));

	return new Promise((resolve, reject) => {
		mountCompletion = { count, reject, resolve, startedAt };
		root.render(React.createElement(App, { count, key: ++epoch }));
	});
};

const assertUpdateReady = () => {
	if (states.length !== 1000 || setters.some((setter) => typeof setter !== "function")) {
		throw new Error("Base UI update fixture requires 1,000 mounted controls");
	}
	if (updateCompletion) {
		throw new Error("A Base UI update is already pending");
	}
};

const commitTargets = (targets) =>
	new Promise((resolve) => {
		updateCompletion = { remaining: new Set(targets), resolve };
		for (const index of targets) {
			setters[index]((checked) => !checked);
		}
	});

const cheapUpdateInvariant = (targets) => {
	const firstIndex = targets[0];
	const lastIndex = targets.at(-1);
	if (
		!form?.isConnected ||
		!firstControl?.isConnected ||
		!lastControl?.isConnected ||
		states.length !== 1000 ||
		setters.length !== 1000
	) {
		throw new Error("Base UI retained-reference update invariant failed");
	}

	return { firstChecked: states[firstIndex], firstIndex, lastChecked: states[lastIndex], lastIndex };
};

const update = async (targets) => {
	assertUpdateReady();
	const start = performance.now();
	await commitTargets(targets);
	const sink = cheapUpdateInvariant(targets);
	const durationMs = performance.now() - start;
	return { durationMs, sink };
};

const updateSeries = async (repetitions, offset = 0) => {
	assertUpdateReady();
	const start = performance.now();
	let lastIndex = 0;
	for (let repetition = 0; repetition < repetitions; ++repetition) {
		lastIndex = ((offset + repetition) * 37) % states.length;
		await commitTargets([lastIndex]);
	}
	const sink = cheapUpdateInvariant([lastIndex]);
	const durationMs = performance.now() - start;
	return { durationMs, perOperationMs: durationMs / repetitions, repetitions, sink };
};

const updateBatchSeries = async (repetitions, size, offset = 0) => {
	assertUpdateReady();
	const start = performance.now();
	let targets = [];
	for (let repetition = 0; repetition < repetitions; ++repetition) {
		targets = makeTargets(size, states.length, offset + repetition);
		await commitTargets(targets);
	}
	const sink = cheapUpdateInvariant(targets);
	const durationMs = performance.now() - start;
	return { durationMs, perOperationMs: durationMs / repetitions, repetitions, sink };
};

globalThis.__checkboxBench = {
	condition: "base-ui",
	mount,
	setupMs: performance.now() - setupStartedAt,
	teardown,
	update,
	updateBatchSeries,
	updateSeries,
	validate,
};
