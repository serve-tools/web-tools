import { afterEach, describe, expect, test, vi } from "vitest";
import { userEvent } from "vitest/browser";
import type { CheckboxChangeDetail } from "../../src/checkbox-element.js";
import { CheckboxElement } from "../../src/checkbox-element.js";
import { CheckboxGroupElement } from "../../src/checkbox-group-element.js";

const fixtures: Node[] = [];
const microtask = () => new Promise<void>(queueMicrotask);

afterEach(() => {
	for (const fixture of fixtures.splice(0).reverse()) {
		fixture.parentNode?.removeChild(fixture);
	}
	vi.restoreAllMocks();
});

const defineCheckbox = (): { element: CheckboxElement; name: string } => {
	const name = `aui-checkbox-${crypto.randomUUID()}`;
	customElements.define(name, class extends CheckboxElement {});
	return { element: document.createElement(name) as CheckboxElement, name };
};

const append = <T extends Node>(node: T): T => {
	document.body.append(node);
	fixtures.push(node);
	return node;
};

describe("CheckboxElement", () => {
	test("uses the host as the only focus, label, and form-control owner", async () => {
		const { element } = defineCheckbox();
		element.id = crypto.randomUUID();
		element.textContent = "Control";
		const label = document.createElement("label");
		label.htmlFor = element.id;
		label.textContent = "Receive updates";
		const fixture = append(document.createElement("div"));
		fixture.append(label, element);

		expect(element.tabIndex).toBe(0);
		expect(element.labels).toHaveLength(1);
		expect(element.labels.item(0)).toBe(label);
		expect(element.shadowRoot?.querySelectorAll("button, input, [role]")).toHaveLength(0);
		expect(
			element.shadowRoot?.querySelector('slot[name="indicator"]')?.parentElement?.getAttribute("aria-hidden"),
		).toBe("true");
		expect(element.shadowRoot?.querySelector("slot:not([name])")).not.toBeNull();

		const input = vi.fn();
		const change = vi.fn();
		element.addEventListener("input", input);
		element.addEventListener("change", change);
		await userEvent.click(label);
		expect(element.checked).toBe(true);
		expect(input).toHaveBeenCalledOnce();
		expect(change).toHaveBeenCalledOnce();
	});

	test("implements checked dirtiness, default checkedness, value, and native reset behavior", () => {
		const { element } = defineCheckbox();
		const form = append(document.createElement("form"));
		form.append(element);

		element.defaultChecked = true;
		expect(element.checked).toBe(true);
		expect(element.getAttribute("checked")).toBe("");
		element.checked = false;
		element.defaultChecked = false;
		element.defaultChecked = true;
		expect(element.checked).toBe(false);
		expect(element.defaultChecked).toBe(true);

		expect(element.value).toBe("on");
		element.value = "accepted";
		expect(element.getAttribute("value")).toBe("accepted");
		expect(element.value).toBe("accepted");

		element.indeterminate = true;
		const input = vi.fn();
		const change = vi.fn();
		element.addEventListener("input", input);
		element.addEventListener("change", change);
		form.reset();
		expect(element.checked).toBe(true);
		expect(element.indeterminate).toBe(true);
		expect(input).not.toHaveBeenCalled();
		expect(change).not.toHaveBeenCalled();

		element.defaultChecked = false;
		expect(element.checked).toBe(false);
	});

	test.each(["indicator", ""])("activates once through a wrapping label and decorative slot %s", async (slot) => {
		const { element } = defineCheckbox();
		const label = append(document.createElement("label"));
		const decoration = document.createElement("span");
		decoration.slot = slot;
		decoration.textContent = "Activate";
		element.append(decoration);
		label.append(element, " Associated label");
		const proposals = vi.fn();
		const input = vi.fn();
		const change = vi.fn();
		element.addEventListener("beforechange", proposals);
		element.addEventListener("input", input);
		element.addEventListener("change", change);
		const sourceClicks: MouseEvent[] = [];
		element.addEventListener("beforechange", (event) => sourceClicks.push(event.detail.sourceEvent));

		await userEvent.click(decoration);
		expect(element.checked).toBe(true);
		expect(proposals).toHaveBeenCalledOnce();
		expect(input).toHaveBeenCalledOnce();
		expect(change).toHaveBeenCalledOnce();
		element.addEventListener("beforechange", (event) => event.preventDefault());
		await userEvent.click(decoration);
		expect(element.checked).toBe(true);
		expect(proposals).toHaveBeenCalledTimes(2);
		expect(input).toHaveBeenCalledOnce();
		expect(change).toHaveBeenCalledOnce();
		expect(sourceClicks.every((event) => event.defaultPrevented)).toBe(true);
	});

	test("submits checked and optional unchecked values without duplicates", () => {
		const { element } = defineCheckbox();
		const form = append(document.createElement("form"));
		element.name = "terms";
		form.append(element);

		expect([...new FormData(form)]).toEqual([]);
		element.uncheckedValue = "no";
		expect([...new FormData(form)]).toEqual([["terms", "no"]]);
		element.uncheckedValue = "";
		expect([...new FormData(form)]).toEqual([["terms", ""]]);
		element.checked = true;
		expect([...new FormData(form)]).toEqual([["terms", "on"]]);
		element.value = "yes";
		expect([...new FormData(form)]).toEqual([["terms", "yes"]]);
		element.name = "";
		expect([...new FormData(form)]).toEqual([]);
		element.uncheckedValue = undefined;
		expect(element.hasAttribute("unchecked-value")).toBe(false);
	});

	test("uses the current name without disturbing checked state, validation, or custom states", () => {
		const { element } = defineCheckbox();
		const form = append(document.createElement("form"));
		element.name = "before";
		element.value = "yes";
		element.checked = true;
		element.indeterminate = true;
		element.required = true;
		form.append(element);

		element.name = "after";
		expect([...new FormData(form)]).toEqual([["after", "yes"]]);
		expect(form.elements.namedItem("before")).toBeNull();
		expect(form.elements.namedItem("after")).toBe(element);
		expect(element.checked).toBe(true);
		expect(element.indeterminate).toBe(true);
		expect(element.validity.valid).toBe(true);
		expect(element.matches(":state(checked)")).toBe(true);
		expect(element.matches(":state(indeterminate)")).toBe(true);

		element.name = "";
		expect([...new FormData(form)]).toEqual([]);
		expect(element.checked).toBe(true);
		expect(element.validity.valid).toBe(true);

		element.checked = false;
		element.uncheckedValue = "no";
		element.name = "final";
		expect([...new FormData(form)]).toEqual([["final", "no"]]);
		expect(element.validity.valueMissing).toBe(true);
		expect(element.matches(":state(checked)")).toBe(false);
		expect(element.matches(":state(indeterminate)")).toBe(true);
	});

	test("accepts name and tabindex edits inside canceled and committed proposals", () => {
		const { element } = defineCheckbox();
		const form = append(document.createElement("form"));
		element.name = "before";
		element.value = "yes";
		element.uncheckedValue = "no";
		form.append(element);
		let cancel = true;
		const input = vi.fn();
		const change = vi.fn();
		element.addEventListener("input", input);
		element.addEventListener("change", change);
		element.addEventListener("beforechange", (event) => {
			element.name = cancel ? "canceled" : "accepted";
			element.tabIndex = cancel ? 4 : 6;
			if (cancel) {
				event.preventDefault();
			}
		});

		element.click();
		expect(element.checked).toBe(false);
		expect(element.tabIndex).toBe(4);
		expect([...new FormData(form)]).toEqual([["canceled", "no"]]);
		expect(input).not.toHaveBeenCalled();
		expect(change).not.toHaveBeenCalled();

		cancel = false;
		element.click();
		expect(element.checked).toBe(true);
		expect(element.tabIndex).toBe(6);
		expect([...new FormData(form)]).toEqual([["accepted", "yes"]]);
		expect(input).toHaveBeenCalledOnce();
		expect(change).toHaveBeenCalledOnce();
	});

	test("uses the same transaction ordering for programmatic, synthetic, pointer, label, and Space activation", async () => {
		const { element } = defineCheckbox();
		element.id = crypto.randomUUID();
		element.textContent = "Control";
		const label = document.createElement("label");
		label.htmlFor = element.id;
		label.textContent = "Toggle";
		const fixture = append(document.createElement("div"));
		fixture.append(label, element);
		const events: string[] = [];
		let sourceEvent: MouseEvent | undefined;
		element.addEventListener("beforechange", (event) => {
			events.push("beforechange");
			sourceEvent = event.detail.sourceEvent;
		});
		for (const type of ["click", "input", "change"] as const) {
			element.addEventListener(type, () => events.push(type));
		}
		const expected = ["beforechange", "input", "change", "click"];
		const reset = () => {
			element.checked = false;
			events.length = 0;
		};

		element.indeterminate = true;
		element.click();
		expect(element.checked).toBe(true);
		expect(element.indeterminate).toBe(true);
		expect(events).toEqual(expected);

		reset();
		element.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
		expect(element.checked).toBe(true);
		expect(events).toEqual(expected);

		reset();
		await userEvent.click(element);
		expect(element.checked).toBe(true);
		expect(events).toEqual(expected);

		reset();
		await userEvent.click(label);
		expect(element.checked).toBe(true);
		expect(events).toEqual(expected);

		reset();
		element.focus();
		await userEvent.keyboard("{Shift>} {/Shift}");
		expect(element.checked).toBe(true);
		expect(events).toEqual(expected);
		expect(sourceEvent?.shiftKey).toBe(true);

		events.length = 0;
		await userEvent.keyboard("{Enter}");
		await microtask();
		expect(element.checked).toBe(true);
		expect(events).toEqual([]);
	});

	test("copies every keyboard modifier to the single Space click and honors capture vetoes", () => {
		const accepted = defineCheckbox().element;
		const vetoed = defineCheckbox().element;
		const acceptedParent = append(document.createElement("div"));
		const vetoedParent = append(document.createElement("div"));
		acceptedParent.append(accepted);
		vetoedParent.append(vetoed);
		let sourceEvent: MouseEvent | undefined;
		const acceptedClicks = vi.fn();
		accepted.addEventListener("beforechange", (event) => (sourceEvent = event.detail.sourceEvent));
		accepted.addEventListener("click", acceptedClicks);
		vetoedParent.addEventListener("keydown", (event) => event.preventDefault(), { capture: true });
		vetoedParent.addEventListener("keyup", (event) => event.preventDefault(), { capture: true });
		const keyboardInit = {
			altKey: true,
			bubbles: true,
			cancelable: true,
			ctrlKey: true,
			key: " ",
			metaKey: true,
			shiftKey: true,
		};

		accepted.dispatchEvent(new KeyboardEvent("keydown", keyboardInit));
		accepted.dispatchEvent(new KeyboardEvent("keyup", keyboardInit));
		vetoed.dispatchEvent(new KeyboardEvent("keydown", keyboardInit));
		vetoed.dispatchEvent(new KeyboardEvent("keyup", keyboardInit));
		expect(acceptedClicks).toHaveBeenCalledOnce();
		expect(sourceEvent).toMatchObject({ altKey: true, ctrlKey: true, metaKey: true, shiftKey: true });
		expect(accepted.checked).toBe(true);
		expect(vetoed.checked).toBe(false);
	});

	test("proposes immutable state and guards real pointer activation through all transaction events", async () => {
		const { element } = defineCheckbox();
		element.textContent = "Control";
		append(element);
		const events: string[] = [];
		const clicks = vi.fn();
		let detail: CheckboxChangeDetail | undefined;
		element.addEventListener("click", clicks);
		element.addEventListener("beforechange", (event) => {
			events.push("beforechange");
			detail = event.detail;
			element.click();
		});
		element.addEventListener("input", () => {
			events.push("input");
			element.click();
		});
		element.addEventListener("change", () => {
			events.push("change");
			element.click();
		});

		await userEvent.click(element);
		expect(detail?.checked).toBe(true);
		expect(detail?.sourceEvent).toBeInstanceOf(MouseEvent);
		expect(Object.isFrozen(detail)).toBe(true);
		expect(element.checked).toBe(true);
		expect(events).toEqual(["beforechange", "input", "change"]);
		expect(clicks).toHaveBeenCalledOnce();
	});

	test("cancels beforechange across shadow boundaries and preserves input/change composition", () => {
		const { element } = defineCheckbox();
		const fixture = append(document.createElement("div"));
		const shadow = fixture.attachShadow({ mode: "open" });
		shadow.append(element);
		let cancel = true;
		const outsideBeforeChange = vi.fn((event: Event) => {
			if (cancel) {
				event.preventDefault();
			}
		});
		const outsideInput = vi.fn();
		const outsideChange = vi.fn();
		const localInput = vi.fn((event: Event) => ({ bubbles: event.bubbles, composed: event.composed }));
		const localChange = vi.fn((event: Event) => ({ bubbles: event.bubbles, composed: event.composed }));
		fixture.addEventListener("beforechange", outsideBeforeChange);
		fixture.addEventListener("input", outsideInput);
		fixture.addEventListener("change", outsideChange);
		element.addEventListener("input", localInput);
		element.addEventListener("change", localChange);

		element.click();
		expect(element.checked).toBe(false);
		expect(outsideBeforeChange).toHaveBeenCalledOnce();
		expect(localInput).not.toHaveBeenCalled();
		expect(localChange).not.toHaveBeenCalled();

		cancel = false;
		element.click();
		expect(element.checked).toBe(true);
		expect(outsideBeforeChange).toHaveBeenCalledTimes(2);
		expect(localInput).toHaveReturnedWith({ bubbles: true, composed: true });
		expect(localChange).toHaveReturnedWith({ bubbles: true, composed: false });
		expect(outsideInput).toHaveBeenCalledOnce();
		expect(outsideChange).not.toHaveBeenCalled();
	});

	test("allows explicit reentrant click dispatch to bubble without starting another transaction", () => {
		const { element } = defineCheckbox();
		append(element);
		const clicks = vi.fn();
		const proposals = vi.fn();
		const changes = vi.fn();
		element.addEventListener("click", clicks);
		element.addEventListener("beforechange", proposals);
		element.addEventListener("change", changes);
		element.addEventListener("input", () => {
			element.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
		});

		element.click();
		expect(element.checked).toBe(true);
		expect(proposals).toHaveBeenCalledOnce();
		expect(changes).toHaveBeenCalledOnce();
		expect(clicks).toHaveBeenCalledTimes(2);
	});

	test("does not activate from nested interactive content or cancel its click", () => {
		const { element } = defineCheckbox();
		const fixture = append(document.createElement("div"));
		const button = document.createElement("button");
		const link = document.createElement("a");
		button.type = "button";
		link.href = "#nested-checkbox-link";
		link.textContent = "Link";
		element.append(button, link);
		fixture.append(element);
		const proposals = vi.fn();
		const defaultPreventedAtHost: boolean[] = [];
		element.addEventListener("beforechange", proposals);
		element.addEventListener("click", (event) => defaultPreventedAtHost.push(event.defaultPrevented));
		fixture.addEventListener("click", (event) => event.preventDefault());

		button.click();
		link.click();
		expect(element.checked).toBe(false);
		expect(proposals).not.toHaveBeenCalled();
		expect(defaultPreventedAtHost).toEqual([false, false]);
	});

	test("cancellation preserves listener-authored state and accepted proposals recheck interaction state", () => {
		const canceled = defineCheckbox().element;
		const stopped = defineCheckbox().element;
		append(document.createElement("div")).append(canceled, stopped);
		const canceledInput = vi.fn();
		canceled.addEventListener("input", canceledInput);
		canceled.addEventListener("beforechange", (event) => {
			canceled.checked = true;
			event.preventDefault();
		});
		canceled.click();
		expect(canceled.checked).toBe(true);
		expect(canceledInput).not.toHaveBeenCalled();

		const stoppedInput = vi.fn();
		stopped.addEventListener("input", stoppedInput);
		stopped.addEventListener("beforechange", () => (stopped.readOnly = true));
		stopped.click();
		expect(stopped.checked).toBe(false);
		expect(stoppedInput).not.toHaveBeenCalled();
	});

	test("honors click cancellation only when it precedes the internal transaction", () => {
		const early = defineCheckbox().element;
		const late = defineCheckbox().element;
		const earlyParent = append(document.createElement("div"));
		const lateParent = append(document.createElement("div"));
		earlyParent.append(early);
		lateParent.append(late);
		const earlyProposal = vi.fn();
		early.addEventListener("beforechange", earlyProposal);
		earlyParent.addEventListener("click", (event) => event.preventDefault(), { capture: true });
		lateParent.addEventListener("click", (event) => event.preventDefault());

		early.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
		late.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
		expect(early.checked).toBe(false);
		expect(earlyProposal).not.toHaveBeenCalled();
		expect(late.checked).toBe(true);
	});

	test("suppresses click activation while directly or fieldset disabled", () => {
		const { element } = defineCheckbox();
		const fieldset = append(document.createElement("fieldset"));
		fieldset.append(element);
		const clicks = vi.fn();
		element.addEventListener("click", clicks);

		element.disabled = true;
		expect(element.tabIndex).toBe(-1);
		element.required = true;
		const native = document.createElement("input");
		native.type = "checkbox";
		native.required = true;
		native.disabled = true;
		expect(element.validity.valueMissing).toBe(native.validity.valueMissing);
		element.click();
		expect(element.checked).toBe(false);
		expect(clicks).not.toHaveBeenCalled();

		element.disabled = false;
		expect(element.tabIndex).toBe(0);
		fieldset.disabled = true;
		expect(element.willValidate).toBe(false);
		expect(element.tabIndex).toBe(-1);
		element.click();
		expect(element.checked).toBe(false);
		expect(clicks).not.toHaveBeenCalled();

		fieldset.disabled = false;
		expect(element.tabIndex).toBe(0);
		element.click();
		expect(element.checked).toBe(true);
		expect(clicks).toHaveBeenCalledOnce();
	});

	test("preserves authored tabindex edits across direct disabled transitions", () => {
		const { element } = defineCheckbox();
		append(element);
		element.tabIndex = 4;

		element.disabled = true;
		expect(element.tabIndex).toBe(-1);
		element.tabIndex = 7;
		expect(element.tabIndex).toBe(-1);
		element.disabled = false;
		expect(element.tabIndex).toBe(7);

		element.disabled = true;
		element.removeAttribute("tabindex");
		expect(element.tabIndex).toBe(-1);
		element.disabled = false;
		expect(element.tabIndex).toBe(0);
	});

	test("preserves authored tabindex through fieldset and group disabling", () => {
		const fieldsetCheckbox = defineCheckbox().element;
		const groupDefinitions = {
			checkbox: `aui-checkbox-${crypto.randomUUID()}`,
			group: `aui-checkbox-group-${crypto.randomUUID()}`,
		};
		customElements.define(groupDefinitions.checkbox, class extends CheckboxElement {});
		customElements.define(groupDefinitions.group, class extends CheckboxGroupElement {});
		const groupedCheckbox = document.createElement(groupDefinitions.checkbox) as CheckboxElement;
		const group = document.createElement(groupDefinitions.group) as CheckboxGroupElement;
		const fieldset = append(document.createElement("fieldset"));
		fieldset.append(fieldsetCheckbox);
		group.append(groupedCheckbox);
		append(group);
		fieldsetCheckbox.tabIndex = 4;
		groupedCheckbox.tabIndex = 5;

		fieldset.disabled = true;
		group.disabled = true;
		expect(fieldsetCheckbox.tabIndex).toBe(-1);
		expect(groupedCheckbox.tabIndex).toBe(-1);
		fieldsetCheckbox.tabIndex = 7;
		groupedCheckbox.tabIndex = 8;
		expect(fieldsetCheckbox.tabIndex).toBe(-1);
		expect(groupedCheckbox.tabIndex).toBe(-1);

		fieldset.disabled = false;
		group.disabled = false;
		expect(fieldsetCheckbox.tabIndex).toBe(7);
		expect(groupedCheckbox.tabIndex).toBe(8);
	});

	test("honors the first legend exception for inherited fieldset disabling", () => {
		const legendCheckbox = defineCheckbox().element;
		const disabledCheckbox = defineCheckbox().element;
		const fieldset = append(document.createElement("fieldset"));
		const legend = document.createElement("legend");
		legend.append(legendCheckbox);
		fieldset.append(legend, disabledCheckbox);
		fieldset.disabled = true;

		legendCheckbox.click();
		disabledCheckbox.click();
		expect(legendCheckbox.checked).toBe(true);
		expect(legendCheckbox.tabIndex).toBe(0);
		expect(disabledCheckbox.checked).toBe(false);
		expect(disabledCheckbox.tabIndex).toBe(-1);
	});

	test("reflects readOnly, retains indeterminate state, and records FACE validation behavior", () => {
		const { element } = defineCheckbox();
		append(element);
		element.required = true;
		element.readOnly = true;
		element.indeterminate = true;
		const native = document.createElement("input");
		native.type = "checkbox";
		native.required = true;
		native.readOnly = true;
		const proposal = vi.fn();
		element.addEventListener("beforechange", proposal);

		expect(element.getAttribute("readonly")).toBe("");
		expect(element.willValidate).toBe(false);
		expect(native.willValidate).toBe(false);
		element.click();
		expect(element.checked).toBe(false);
		expect(element.indeterminate).toBe(true);
		expect(proposal).not.toHaveBeenCalled();
		expect(element.tabIndex).toBe(0);
	});

	test("provides native constraint-validation methods and invalid events", () => {
		const { element } = defineCheckbox();
		append(element);
		element.required = true;
		const invalid = vi.fn((event: Event) => event.preventDefault());
		element.addEventListener("invalid", invalid);

		expect(element.validity.valueMissing).toBe(true);
		expect(element.checkValidity()).toBe(false);
		expect(invalid).toHaveBeenCalledOnce();
		element.checked = true;
		expect(element.checkValidity()).toBe(true);

		element.setCustomValidity("Choose explicitly");
		expect(element.validity.customError).toBe(true);
		expect(element.validationMessage).toBe("Choose explicitly");
		element.setCustomValidity("");
		expect(element.validity.valid).toBe(true);
	});

	test("restores all specified checkbox states without input or change events", () => {
		const { element } = defineCheckbox();
		append(element);
		const input = vi.fn();
		const change = vi.fn();
		element.addEventListener("input", input);
		element.addEventListener("change", change);

		for (const [state, checked, indeterminate] of [
			["checked", true, false],
			["unchecked", false, false],
			["checked/indeterminate", true, true],
			["unchecked/indeterminate", false, true],
		] as const) {
			element.formStateRestoreCallback(state, "restore");
			expect(element.checked).toBe(checked);
			expect(element.indeterminate).toBe(indeterminate);
		}

		element.formStateRestoreCallback("unknown", "restore");
		expect(element.checked).toBe(false);
		expect(element.indeterminate).toBe(true);
		expect(input).not.toHaveBeenCalled();
		expect(change).not.toHaveBeenCalled();
	});

	test("upgrades properties assigned before custom-element definition", () => {
		const name = `aui-checkbox-${crypto.randomUUID()}`;
		const element = document.createElement(name) as CheckboxElement;
		element.defaultChecked = false;
		element.value = "before";
		element.name = "choice";
		element.required = true;
		element.readOnly = true;
		element.uncheckedValue = "no";
		element.checked = true;
		element.indeterminate = true;
		append(element);

		customElements.define(name, class extends CheckboxElement {});
		expect(element.checked).toBe(true);
		expect(element.defaultChecked).toBe(false);
		expect(element.indeterminate).toBe(true);
		expect(element.value).toBe("before");
		expect(element.name).toBe("choice");
		expect(element.required).toBe(true);
		expect(element.readOnly).toBe(true);
		expect(element.uncheckedValue).toBe("no");
	});

	test("preserves authored tabindex while disabled before connection and late upgrade", () => {
		const defined = defineCheckbox().element;
		defined.disabled = true;
		defined.tabIndex = 4;
		append(defined);
		expect(defined.tabIndex).toBe(-1);
		defined.disabled = false;
		expect(defined.tabIndex).toBe(4);

		const name = `aui-checkbox-${crypto.randomUUID()}`;
		const late = document.createElement(name) as CheckboxElement;
		late.setAttribute("disabled", "");
		late.setAttribute("tabindex", "5");
		append(late);
		customElements.define(name, class extends CheckboxElement {});
		expect(late.tabIndex).toBe(-1);
		late.disabled = false;
		expect(late.tabIndex).toBe(5);
	});

	test("submits the first associated submitter on Enter after uncanceled propagation", async () => {
		const { element } = defineCheckbox();
		const fixture = append(document.createElement("div"));
		const external = document.createElement("button");
		const form = document.createElement("form");
		const later = document.createElement("button");
		form.id = crypto.randomUUID();
		external.type = "submit";
		external.setAttribute("form", form.id);
		later.type = "submit";
		element.setAttribute("form", form.id);
		form.append(later);
		fixture.append(external, form, element);
		form.addEventListener("submit", (event) => event.preventDefault());
		const externalClick = vi.fn();
		const laterClick = vi.fn();
		external.addEventListener("click", externalClick);
		later.addEventListener("click", laterClick);

		element.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, cancelable: true, key: "Enter" }));
		await microtask();
		expect(externalClick).toHaveBeenCalledOnce();
		expect(laterClick).not.toHaveBeenCalled();
		expect(element.checked).toBe(false);
	});

	test("does not fall through a disabled default submitter or submit without one", async () => {
		const disabledFirst = defineCheckbox().element;
		const noSubmitter = defineCheckbox().element;
		const fixture = append(document.createElement("div"));
		const firstForm = document.createElement("form");
		const secondForm = document.createElement("form");
		const disabled = document.createElement("button");
		const enabled = document.createElement("button");
		disabled.type = "submit";
		disabled.disabled = true;
		enabled.type = "submit";
		firstForm.append(disabledFirst, disabled, enabled);
		secondForm.append(noSubmitter);
		fixture.append(firstForm, secondForm);
		const enabledClick = vi.fn();
		enabled.addEventListener("click", enabledClick);

		disabledFirst.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, cancelable: true, key: "Enter" }));
		noSubmitter.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, cancelable: true, key: "Enter" }));
		await microtask();
		expect(enabledClick).not.toHaveBeenCalled();
	});

	test("excludes image inputs when choosing the default Enter submitter", async () => {
		const { element } = defineCheckbox();
		const form = append(document.createElement("form"));
		const image = document.createElement("input");
		const submit = document.createElement("button");
		image.type = "image";
		submit.type = "submit";
		form.append(element, image, submit);
		form.addEventListener("submit", (event) => event.preventDefault());
		const imageClick = vi.fn();
		const submitClick = vi.fn();
		image.addEventListener("click", imageClick);
		submit.addEventListener("click", submitClick);

		element.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, cancelable: true, key: "Enter" }));
		await microtask();
		expect(imageClick).not.toHaveBeenCalled();
		expect(submitClick).toHaveBeenCalledOnce();
	});

	test("cancels deferred Enter submission after ancestor prevention, reassociation, or adoption", async () => {
		const prevented = defineCheckbox().element;
		const initiallyDisabled = defineCheckbox().element;
		const reassociated = defineCheckbox().element;
		const reassociatedRoundTrip = defineCheckbox().element;
		const disabledRoundTrip = defineCheckbox().element;
		const reconnected = defineCheckbox().element;
		const adopted = defineCheckbox().element;
		const fixture = append(document.createElement("div"));
		const form = document.createElement("form");
		const otherForm = document.createElement("form");
		const submit = document.createElement("button");
		const frame = append(document.createElement("iframe"));
		form.id = crypto.randomUUID();
		otherForm.id = crypto.randomUUID();
		submit.type = "submit";
		initiallyDisabled.disabled = true;
		form.append(
			prevented,
			initiallyDisabled,
			reassociated,
			reassociatedRoundTrip,
			disabledRoundTrip,
			reconnected,
			adopted,
			submit,
		);
		fixture.append(form, otherForm);
		form.addEventListener("submit", (event) => event.preventDefault());
		const submitClick = vi.fn();
		submit.addEventListener("click", submitClick);
		form.addEventListener("keydown", (event) => {
			if (event.target === prevented) {
				event.preventDefault();
			} else if (event.target === initiallyDisabled) {
				initiallyDisabled.disabled = false;
			}
		});

		prevented.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, cancelable: true, key: "Enter" }));
		initiallyDisabled.dispatchEvent(
			new KeyboardEvent("keydown", { bubbles: true, cancelable: true, key: "Enter" }),
		);
		reassociated.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, cancelable: true, key: "Enter" }));
		reassociatedRoundTrip.dispatchEvent(
			new KeyboardEvent("keydown", { bubbles: true, cancelable: true, key: "Enter" }),
		);
		disabledRoundTrip.dispatchEvent(
			new KeyboardEvent("keydown", { bubbles: true, cancelable: true, key: "Enter" }),
		);
		reconnected.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, cancelable: true, key: "Enter" }));
		adopted.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, cancelable: true, key: "Enter" }));
		otherForm.append(reassociated);
		reassociatedRoundTrip.setAttribute("form", otherForm.id);
		reassociatedRoundTrip.setAttribute("form", form.id);
		disabledRoundTrip.disabled = true;
		disabledRoundTrip.disabled = false;
		reconnected.remove();
		form.prepend(reconnected);
		const target = frame.contentDocument!;
		target.body.append(target.adoptNode(adopted));
		fixtures.push(adopted);
		await microtask();
		expect(submitClick).not.toHaveBeenCalled();
	});
});
