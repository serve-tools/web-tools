import { afterEach, describe, expect, test, vi } from "vitest";
import { CheckboxElement } from "../../src/checkbox-element.js";
import type { CheckboxGroupChangeDetail } from "../../src/checkbox-group-element.js";
import { CheckboxGroupElement } from "../../src/checkbox-group-element.js";

const fixtures: Node[] = [];

afterEach(() => {
	for (const fixture of fixtures.splice(0).reverse()) {
		fixture.parentNode?.removeChild(fixture);
	}
	vi.restoreAllMocks();
});

const names = () => ({
	checkboxName: `aui-checkbox-${crypto.randomUUID()}`,
	groupName: `aui-checkbox-group-${crypto.randomUUID()}`,
});

const define = () => {
	const definitions = names();
	customElements.define(definitions.checkboxName, class extends CheckboxElement {});
	customElements.define(definitions.groupName, class extends CheckboxGroupElement {});
	return definitions;
};

const append = <T extends Node>(node: T): T => {
	document.body.append(node);
	fixtures.push(node);
	return node;
};

const create = (states: readonly boolean[] = [true, false]) => {
	const definitions = define();
	const group = document.createElement(definitions.groupName) as CheckboxGroupElement;
	const parent = document.createElement(definitions.checkboxName) as CheckboxElement;
	parent.parent = true;
	parent.textContent = "All";
	group.append(parent);
	const checkboxes = states.map((checked, index) => {
		const checkbox = document.createElement(definitions.checkboxName) as CheckboxElement;
		checkbox.setAttribute("value", String.fromCharCode(97 + index));
		checkbox.name = "choice";
		checkbox.defaultChecked = checked;
		checkbox.textContent = checkbox.value;
		group.append(checkbox);
		return checkbox;
	});
	append(group);
	return { checkboxes, definitions, group, parent };
};

describe("CheckboxGroupElement", () => {
	test("derives initial values from checked child markup and keeps ordinary children as the only form owners", () => {
		const { checkboxes, group, parent } = create([true, false]);
		const form = append(document.createElement("form"));
		form.append(group);

		expect(group.values).toEqual(["a"]);
		expect(Object.isFrozen(group.values)).toBe(true);
		expect(parent.checked).toBe(false);
		expect(parent.indeterminate).toBe(true);
		expect([...new FormData(form)]).toEqual([["choice", "a"]]);

		parent.name = "aggregate";
		parent.value = "all";
		expect([...new FormData(form)]).toEqual([["choice", "a"]]);
		checkboxes[1].checked = true;
		expect(group.values).toEqual(["a", "b"]);
		expect(parent.checked).toBe(true);
		expect(parent.indeterminate).toBe(false);
	});

	test("sets exact values silently and rejects duplicate, unknown, or ambiguous identities", () => {
		const { checkboxes, group } = create([true, false]);
		const input = vi.fn();
		const change = vi.fn();
		group.addEventListener("input", input);
		group.addEventListener("change", change);

		group.values = ["b"];
		expect(group.values).toEqual(["b"]);
		expect(checkboxes.map((checkbox) => checkbox.checked)).toEqual([false, true]);
		expect(input).not.toHaveBeenCalled();
		expect(change).not.toHaveBeenCalled();
		expect(() => (group.values = ["b", "b"])).toThrowError(TypeError);
		expect(() => (group.values = ["missing"])).toThrowError(TypeError);

		checkboxes[0].value = "b";
		expect(group.values).toEqual([]);
		expect(() => (group.values = ["b"])).toThrowError(TypeError);
	});

	test("starts the group lease before the child proposal and commits before one source post-event pair", () => {
		const { checkboxes, group } = create([false, false]);
		const events: string[] = [];
		let detail: CheckboxGroupChangeDetail | undefined;
		checkboxes[0].addEventListener("beforechange", () => events.push("child"));
		group.addEventListener("beforechange", (event) => {
			if (event.target === group) {
				events.push("group");
				detail = event.detail as CheckboxGroupChangeDetail;
			} else {
				events.push("child-at-group");
			}
		});
		checkboxes[0].addEventListener("input", () => {
			events.push(`input:${group.values.join(",")}`);
		});
		checkboxes[0].addEventListener("change", () => events.push("change"));

		checkboxes[0].click();
		expect(events).toEqual(["child", "child-at-group", "group", "input:a", "change"]);
		expect(detail?.values).toEqual(["a"]);
		expect(detail?.sourceCheckbox).toBe(checkboxes[0]);
		expect(Object.isFrozen(detail)).toBe(true);
	});

	test("honors child and group cancellation without rolling back explicit listener writes", () => {
		const childCanceled = create([false, false]);
		const childInput = vi.fn();
		childCanceled.checkboxes[0].addEventListener("input", childInput);
		childCanceled.checkboxes[0].addEventListener("beforechange", (event) => {
			childCanceled.group.values = ["b"];
			event.preventDefault();
		});
		childCanceled.checkboxes[0].click();
		expect(childCanceled.group.values).toEqual(["b"]);
		expect(childInput).not.toHaveBeenCalled();

		const groupCanceled = create([false, false]);
		const groupInput = vi.fn();
		groupCanceled.checkboxes[0].addEventListener("input", groupInput);
		groupCanceled.group.addEventListener("beforechange", (event) => {
			if (event.target === groupCanceled.group) {
				event.preventDefault();
			}
		});
		groupCanceled.checkboxes[0].click();
		expect(groupCanceled.group.values).toEqual([]);
		expect(groupInput).not.toHaveBeenCalled();
	});

	test("dirties only accepted, actually changed members and leaves failed public writes clean", () => {
		const canceled = create([false, false]);
		canceled.group.addEventListener("beforechange", (event) => {
			if (event.target === canceled.group) {
				event.preventDefault();
			}
		});
		canceled.checkboxes[0].click();
		canceled.checkboxes[0].defaultChecked = true;
		expect(canceled.checkboxes[0].checked).toBe(true);

		const accepted = create([false, false]);
		accepted.checkboxes[0].click();
		accepted.checkboxes[1].defaultChecked = true;
		expect(accepted.group.values).toEqual(["a", "b"]);

		const stale = create([false, false]);
		stale.checkboxes[0].addEventListener("beforechange", () => (stale.checkboxes[1].checked = true));
		stale.checkboxes[0].click();
		stale.checkboxes[0].defaultChecked = true;
		expect(stale.group.values).toEqual(["a", "b"]);

		const invalid = create([false, false]);
		invalid.checkboxes[1].value = "a";
		expect(() => (invalid.checkboxes[0].checked = true)).toThrowError(TypeError);
		invalid.checkboxes[0].defaultChecked = true;
		expect(invalid.checkboxes[0].checked).toBe(true);
	});

	test("cancels a group proposal across a shadow boundary and preserves source event composition", () => {
		const { checkboxes, group } = create([false, false]);
		const fixture = append(document.createElement("div"));
		const shadow = fixture.attachShadow({ mode: "open" });
		group.remove();
		shadow.append(group);
		let cancel = true;
		const proposals = vi.fn((event: Event) => {
			if (cancel && "values" in (event as CustomEvent).detail) {
				event.preventDefault();
			}
		});
		const outsideInput = vi.fn();
		const outsideChange = vi.fn();
		fixture.addEventListener("beforechange", proposals);
		fixture.addEventListener("input", outsideInput);
		fixture.addEventListener("change", outsideChange);

		checkboxes[0].click();
		expect(group.values).toEqual([]);
		expect(outsideInput).not.toHaveBeenCalled();
		cancel = false;
		checkboxes[0].click();
		expect(group.values).toEqual(["a"]);
		expect(outsideInput).toHaveBeenCalledOnce();
		expect(outsideChange).not.toHaveBeenCalled();
	});

	test("invalidates stale transactions when membership or another member changes during a proposal", () => {
		const changed = create([false, false]);
		const input = vi.fn();
		changed.checkboxes[0].addEventListener("input", input);
		changed.checkboxes[0].addEventListener("beforechange", () => {
			changed.checkboxes[1].checked = true;
		});
		changed.checkboxes[0].click();
		expect(changed.group.values).toEqual(["b"]);
		expect(input).not.toHaveBeenCalled();

		const structural = create([false, false]);
		const extra = document.createElement(structural.definitions.checkboxName) as CheckboxElement;
		extra.value = "c";
		structural.checkboxes[0].addEventListener("beforechange", () => structural.group.append(extra));
		structural.checkboxes[0].click();
		expect(structural.group.values).toEqual([]);
	});

	test("blocks reentrant activation from every member through group and source post-events", () => {
		const { checkboxes, group } = create([false, false]);
		const proposals = vi.fn();
		checkboxes[1].addEventListener("beforechange", proposals);
		checkboxes[0].addEventListener("beforechange", () => checkboxes[1].click());
		group.addEventListener("beforechange", (event) => {
			if (event.target === group) {
				checkboxes[1].click();
			}
		});
		checkboxes[0].addEventListener("input", () => checkboxes[1].click());
		checkboxes[0].addEventListener("change", () => checkboxes[1].click());

		checkboxes[0].click();
		expect(group.values).toEqual(["a"]);
		expect(proposals).not.toHaveBeenCalled();
	});

	test("implements Base UI parent cycling while preserving disabled checked and unchecked members", () => {
		const selectedDisabled = create([true, false, true]);
		selectedDisabled.checkboxes[2].disabled = true;
		expect(selectedDisabled.parent.indeterminate).toBe(true);

		selectedDisabled.parent.click();
		expect(selectedDisabled.group.values).toEqual(["a", "b", "c"]);
		expect(selectedDisabled.parent.checked).toBe(true);
		selectedDisabled.parent.click();
		expect(selectedDisabled.group.values).toEqual(["c"]);
		expect(selectedDisabled.parent.indeterminate).toBe(true);

		const unselectedDisabled = create([true, false, false]);
		unselectedDisabled.checkboxes[2].disabled = true;
		unselectedDisabled.parent.click();
		expect(unselectedDisabled.group.values).toEqual(["a", "b"]);
		expect(unselectedDisabled.parent.checked).toBe(false);
		expect(unselectedDisabled.parent.indeterminate).toBe(true);
		unselectedDisabled.parent.click();
		expect(unselectedDisabled.group.values).toEqual([]);
	});

	test("adds a reversible group restriction without changing child disabled properties or duplicating form values", () => {
		const { checkboxes, group } = create([true, false]);
		const form = append(document.createElement("form"));
		form.append(group);
		checkboxes[1].required = true;
		group.disabled = true;

		expect(checkboxes.map((checkbox) => checkbox.disabled)).toEqual([false, false]);
		expect(checkboxes.map((checkbox) => checkbox.tabIndex)).toEqual([-1, -1]);
		expect(checkboxes[1].willValidate).toBe(false);
		expect(checkboxes[1].checkValidity()).toBe(true);
		expect([...new FormData(form)]).toEqual([]);
		checkboxes[1].click();
		expect(group.values).toEqual(["a"]);

		group.disabled = false;
		expect(checkboxes.map((checkbox) => checkbox.tabIndex)).toEqual([0, 0]);
		expect(checkboxes[1].validity.valueMissing).toBe(true);
		expect([...new FormData(form)]).toEqual([["choice", "a"]]);
	});

	test("resets ordinary defaults and parent presentation without group-owned form data", () => {
		const { checkboxes, group, parent } = create([true, false]);
		const form = append(document.createElement("form"));
		form.append(group);
		checkboxes[1].click();
		expect(group.values).toEqual(["a", "b"]);

		form.reset();
		expect(group.values).toEqual(["a"]);
		expect(parent.checked).toBe(false);
		expect(parent.indeterminate).toBe(true);
	});

	test("recovers pre-upgrade values and checked markup in either definition order", () => {
		for (const order of ["group-first", "checkbox-first"] as const) {
			const definitions = names();
			const fixture = append(document.createElement("div"));
			fixture.innerHTML = `<${definitions.groupName}><${definitions.checkboxName} value="a" checked></${definitions.checkboxName}><${definitions.checkboxName} value="b"></${definitions.checkboxName}></${definitions.groupName}>`;
			const group = fixture.firstElementChild as CheckboxGroupElement;
			const checkboxes = [...group.children] as CheckboxElement[];
			(group as unknown as { values: readonly string[] }).values = ["b"];

			if (order === "group-first") {
				customElements.define(definitions.groupName, class extends CheckboxGroupElement {});
				customElements.define(definitions.checkboxName, class extends CheckboxElement {});
			} else {
				customElements.define(definitions.checkboxName, class extends CheckboxElement {});
				customElements.define(definitions.groupName, class extends CheckboxGroupElement {});
			}

			expect(group.values).toEqual(["b"]);
			expect(checkboxes.map((checkbox) => checkbox.checked)).toEqual([false, true]);

			const form = append(document.createElement("form"));
			form.append(group);
			form.reset();
			expect(group.values).toEqual(["a"]);
			checkboxes[0].formStateRestoreCallback("unchecked", "restore");
			checkboxes[1].formStateRestoreCallback("checked", "restore");
			expect(group.values).toEqual(["b"]);
		}
	});

	test("keeps an empty pre-upgrade values assignment authoritative as later checked children upgrade", () => {
		const definitions = names();
		const fixture = append(document.createElement("div"));
		fixture.innerHTML = `<${definitions.groupName}><span>Choices</span><${definitions.checkboxName} value="a"></${definitions.checkboxName}><${definitions.checkboxName} value="b" checked></${definitions.checkboxName}></${definitions.groupName}>`;
		const group = fixture.firstElementChild as CheckboxGroupElement;
		(group as unknown as { values: readonly string[] }).values = [];

		customElements.define(definitions.groupName, class extends CheckboxGroupElement {});
		customElements.define(definitions.checkboxName, class extends CheckboxElement {});
		expect(group.values).toEqual([]);
		expect(
			[...group.querySelectorAll(definitions.checkboxName)].map(
				(checkbox) => (checkbox as CheckboxElement).checked,
			),
		).toEqual([false, false]);

		const form = append(document.createElement("form"));
		form.append(group);
		form.reset();
		expect(group.values).toEqual(["b"]);
		const checkboxes = [...group.querySelectorAll(definitions.checkboxName)] as CheckboxElement[];
		checkboxes[0].formStateRestoreCallback("checked", "restore");
		checkboxes[1].formStateRestoreCallback("unchecked", "restore");
		expect(group.values).toEqual(["a"]);
	});

	test("validates unknown and ambiguous recovered values before coordinating upgraded children", () => {
		for (const scenario of [
			{ childValues: ["a", "b"], requested: ["missing"] },
			{ childValues: ["a", "a"], requested: ["a"] },
		] as const) {
			const definitions = names();
			customElements.define(definitions.checkboxName, class extends CheckboxElement {});
			const fixture = append(document.createElement("div"));
			fixture.innerHTML = `<${definitions.groupName}>${scenario.childValues.map((value) => `<${definitions.checkboxName} value="${value}" checked></${definitions.checkboxName}>`).join("")}</${definitions.groupName}>`;
			const group = fixture.firstElementChild as HTMLElement & { disabled: boolean; values: readonly string[] };
			const checkboxes = [...group.children] as CheckboxElement[];
			group.disabled = true;
			group.values = scenario.requested;
			const expectedMessage = `Checkbox group value ${JSON.stringify(scenario.requested[0])} does not identify exactly one direct checkbox`;
			let upgradeError: unknown;
			const onError = (event: ErrorEvent) => {
				if (!(event.error instanceof TypeError) || event.error.message !== expectedMessage) {
					return;
				}
				upgradeError = event.error;
				event.preventDefault();
				event.stopImmediatePropagation();
			};
			window.addEventListener("error", onError, true);
			try {
				customElements.define(definitions.groupName, class extends CheckboxGroupElement {});
			} catch (error) {
				if (!(error instanceof TypeError) || error.message !== expectedMessage) {
					throw error;
				}
				upgradeError = error;
			} finally {
				window.removeEventListener("error", onError, true);
			}

			expect(upgradeError).toBeInstanceOf(TypeError);
			expect(checkboxes.map((checkbox) => checkbox.checked)).toEqual([true, true]);
			expect(checkboxes.map((checkbox) => checkbox.disabled)).toEqual([false, false]);
			expect(checkboxes.map((checkbox) => checkbox.tabIndex)).toEqual([0, 0]);
		}
	});

	test("does not coordinate or mutate children until every own group property recovers successfully", () => {
		const definitions = names();
		customElements.define(definitions.checkboxName, class extends CheckboxElement {});
		const fixture = append(document.createElement("div"));
		fixture.innerHTML = `<${definitions.groupName}><${definitions.checkboxName} value="a" checked></${definitions.checkboxName}><${definitions.checkboxName} value="b" checked></${definitions.checkboxName}></${definitions.groupName}>`;
		const group = fixture.firstElementChild as HTMLElement & { disabled: boolean; values: readonly string[] };
		const checkboxes = [...group.children] as CheckboxElement[];
		group.disabled = true;
		group.values = ["a", "a"];
		const expectedMessage = "Checkbox group values must be unique strings";
		let upgradeError: unknown;
		const onError = (event: ErrorEvent) => {
			if (!(event.error instanceof TypeError) || event.error.message !== expectedMessage) {
				return;
			}
			upgradeError = event.error;
			event.preventDefault();
			event.stopImmediatePropagation();
		};
		window.addEventListener("error", onError, true);
		try {
			customElements.define(definitions.groupName, class extends CheckboxGroupElement {});
		} catch (error) {
			if (!(error instanceof TypeError) || error.message !== expectedMessage) {
				throw error;
			}
			upgradeError = error;
		} finally {
			window.removeEventListener("error", onError, true);
		}

		expect(upgradeError).toBeInstanceOf(TypeError);
		expect(checkboxes.map((checkbox) => checkbox.checked)).toEqual([true, true]);
		expect(checkboxes.map((checkbox) => checkbox.disabled)).toEqual([false, false]);
		expect(checkboxes.map((checkbox) => checkbox.tabIndex)).toEqual([0, 0]);
		checkboxes[0].click();
		expect(checkboxes[0].checked).toBe(false);
	});

	test("reconciles detached structural edits on demand and clears inherited state across moves and adoption", () => {
		const first = create([true, false]);
		const second = create([false]);
		second.checkboxes[0].value = "b";
		first.group.disabled = true;
		first.group.remove();
		second.group.remove();
		const moved = first.checkboxes[0];
		second.group.append(moved);

		expect(second.group.values).toEqual(["a"]);
		expect(moved.tabIndex).toBe(0);
		moved.click();
		expect(second.group.values).toEqual([]);

		const frame = append(document.createElement("iframe"));
		const foreignDocument = frame.contentDocument!;
		const ForeignCustomEvent = foreignDocument.defaultView!.CustomEvent;
		const ForeignEvent = foreignDocument.defaultView!.Event;
		foreignDocument.body.append(foreignDocument.adoptNode(second.group));
		fixtures.push(second.group);
		let childProposal: Event | undefined;
		let groupProposal: Event | undefined;
		let input: Event | undefined;
		moved.addEventListener("beforechange", (event) => (childProposal = event));
		second.group.addEventListener("beforechange", (event) => {
			if (event.target === second.group) {
				groupProposal = event;
			}
		});
		moved.addEventListener("input", (event) => (input = event));
		moved.click();
		expect(second.group.values).toEqual(["a"]);
		expect(childProposal).toBeInstanceOf(ForeignCustomEvent);
		expect(groupProposal).toBeInstanceOf(ForeignCustomEvent);
		expect(input).toBeInstanceOf(ForeignEvent);
	});
});
