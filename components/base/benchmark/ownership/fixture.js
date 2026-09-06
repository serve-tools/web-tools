import { FieldElement } from "@serve-tools/base-components/field";
import { MenuElement } from "@serve-tools/base-components/menu";
import { NumberFieldElement } from "@serve-tools/base-components/number-field";
import { ToggleElement } from "@serve-tools/base-components/toggle";
import { benchmark } from "../../../../client/benchmark.js";

const FIELD_TAG = "benchmark-base-field";
const MENU_TAG = "benchmark-base-menu";
const NUMBER_FIELD_TAG = "benchmark-base-number-field";
const TOGGLE_TAG = "benchmark-base-toggle";
const afterMutation = async () => {
	await Promise.resolve();
	await Promise.resolve();
};

customElements.define(FIELD_TAG, class extends FieldElement {});
customElements.define(MENU_TAG, class extends MenuElement {});
customElements.define(NUMBER_FIELD_TAG, class extends NumberFieldElement {});
customElements.define(TOGGLE_TAG, class extends ToggleElement {});

const root = document.createElement("div");
document.body.append(root);

const fieldLifecycle = async () => {
	const field = document.createElement(FIELD_TAG);
	const label = document.createElement("label");
	const control = document.createElement("input");
	const replacement = document.createElement("input");

	label.slot = "label";
	label.htmlFor = "initial-label-target";
	control.slot = replacement.slot = "control";
	control.id = "initial-control";
	replacement.id = "replacement-control";
	field.append(label, control);
	root.append(field);

	label.htmlFor = "updated-label-target";
	await afterMutation();
	control.replaceWith(replacement);
	await afterMutation();
	field.remove();

	if (
		label.htmlFor !== "updated-label-target" ||
		control.id !== "initial-control" ||
		replacement.id !== "replacement-control"
	) {
		throw new Error("Field ownership lifecycle changed");
	}
};

const toggleLifecycle = async () => {
	const toggle = document.createElement(TOGGLE_TAG);
	const button = document.createElement("button");
	const replacement = document.createElement("button");

	button.type = "submit";
	button.role = "menuitem";
	replacement.type = "reset";
	replacement.role = "switch";
	toggle.append(button);
	root.append(toggle);

	button.type = "reset";
	button.role = "switch";
	await afterMutation();
	button.replaceWith(replacement);
	await afterMutation();
	replacement.remove();
	await afterMutation();
	toggle.remove();

	if (
		button.type !== "reset" ||
		button.role !== "switch" ||
		replacement.type !== "reset" ||
		replacement.role !== "switch" ||
		replacement.hasAttribute("aria-pressed")
	) {
		throw new Error("Toggle ownership lifecycle changed");
	}
};

const numberFieldLifecycle = async () => {
	const numberField = document.createElement(NUMBER_FIELD_TAG);
	const input = document.createElement("input");
	const button = document.createElement("button");
	const replacementInput = document.createElement("input");
	const replacementButton = document.createElement("button");

	numberField.min = "0";
	numberField.max = "9";
	numberField.step = "3";
	input.type = replacementInput.type = "number";
	input.min = "-10";
	input.step = "0.5";
	button.slot = replacementButton.slot = "decrement";
	button.type = "submit";
	replacementInput.min = "-20";
	replacementButton.type = "reset";
	numberField.append(button, input);
	root.append(numberField);

	input.min = "-4";
	button.type = "reset";
	await afterMutation();
	input.replaceWith(replacementInput);
	button.replaceWith(replacementButton);
	await afterMutation();
	replacementInput.min = "-8";
	replacementButton.type = "submit";
	await afterMutation();
	replacementInput.remove();
	replacementButton.remove();
	await afterMutation();
	numberField.remove();

	if (
		input.min !== "-4" ||
		input.step !== "0.5" ||
		button.type !== "reset" ||
		replacementInput.min !== "-8" ||
		replacementInput.step !== "" ||
		replacementButton.type !== "submit"
	) {
		throw new Error("Number field ownership lifecycle changed");
	}
};

const menuLifecycle = async () => {
	const menu = document.createElement(MENU_TAG);
	const trigger = document.createElement("button");
	const popup = document.createElement("div");
	const item = document.createElement("button");
	const replacementTrigger = document.createElement("button");
	const replacementPopup = document.createElement("div");

	trigger.slot = replacementTrigger.slot = "trigger";
	trigger.type = "submit";
	popup.popover = "manual";
	popup.role = "navigation";
	item.role = "menuitem";
	replacementTrigger.type = "reset";
	replacementPopup.popover = "manual";
	replacementPopup.role = "listbox";
	popup.append(item);
	menu.append(trigger, popup);
	root.append(menu);

	trigger.type = "reset";
	popup.role = "listbox";
	await afterMutation();
	trigger.replaceWith(replacementTrigger);
	popup.replaceWith(replacementPopup);
	await afterMutation();
	replacementTrigger.remove();
	replacementPopup.remove();
	await afterMutation();
	menu.remove();

	if (
		trigger.type !== "reset" ||
		popup.role !== "listbox" ||
		popup.popover !== "manual" ||
		replacementTrigger.type !== "reset" ||
		replacementTrigger.hasAttribute("aria-haspopup") ||
		replacementPopup.role !== "listbox" ||
		replacementPopup.popover !== "manual"
	) {
		throw new Error("Menu ownership lifecycle changed");
	}
};

const workloads = [
	["base-ownership/field-mutate-replace-release", fieldLifecycle],
	["base-ownership/toggle-mutate-replace-release", toggleLifecycle],
	["base-ownership/number-field-mutate-replace-release", numberFieldLifecycle],
	["base-ownership/menu-mutate-replace-release", menuLifecycle],
];

globalThis.__validateBaseOwnershipFixture = async () => {
	for (const [_name, operation] of workloads) {
		await operation();
	}
};

globalThis.__runBaseOwnershipBenchmarks = async () => {
	const options = { iterations: 500, samples: 15, warmup: 5 };
	const results = [];

	for (const [name, operation] of workloads) {
		results.push(await benchmark(name, operation, options));
	}

	return results;
};
