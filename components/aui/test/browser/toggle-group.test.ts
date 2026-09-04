import { afterEach, describe, expect, test, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { ToggleElement } from "../../src/toggle-element.js";
import type { ToggleGroupChangeDetail } from "../../src/toggle-group-element.js";
import { ToggleGroupElement } from "../../src/toggle-group-element.js";

const fixtures: Node[] = [];
const mutation = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

afterEach(() => {
	for (const fixture of fixtures.splice(0).reverse()) {
		fixture.parentNode?.removeChild(fixture);
	}
	vi.restoreAllMocks();
});

const append = <NodeType extends Node>(node: NodeType): NodeType => {
	document.body.append(node);
	fixtures.push(node);
	return node;
};

interface Definitions {
	groupName: string;
	toggleName: string;
}

interface GroupFixture extends Definitions {
	buttons: HTMLButtonElement[];
	group: ToggleGroupElement;
	toggles: ToggleElement[];
}

const names = (): Definitions => ({
	groupName: `aui-toggle-group-${crypto.randomUUID()}`,
	toggleName: `aui-toggle-member-${crypto.randomUUID()}`,
});

const define = (definitions = names()): Definitions => {
	customElements.define(definitions.toggleName, class extends ToggleElement {});
	customElements.define(definitions.groupName, class extends ToggleGroupElement {});
	return definitions;
};

const create = (values = ["bold", "italic", "underline"]): GroupFixture => {
	const definitions = define();
	const group = document.createElement(definitions.groupName) as ToggleGroupElement;
	const toggles = values.map((value) => {
		const toggle = document.createElement(definitions.toggleName) as ToggleElement;
		toggle.value = value;
		return toggle;
	});
	const buttons = toggles.map((toggle, index) => {
		const button = document.createElement("button");
		button.textContent = values[index];
		toggle.append(button);
		return button;
	});
	group.append(...toggles);
	append(group);
	return { ...definitions, buttons, group, toggles };
};

const key = (target: Element, value: string): boolean =>
	target.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, cancelable: true, composed: true, key: value }));

describe("ToggleGroupElement", () => {
	test("coordinates a nullable single selection through explicit direct-child values", () => {
		const { buttons, group, toggles } = create();
		expect(group.values).toEqual([]);
		expect(Object.isFrozen(group.values)).toBe(true);
		expect(group.multiple).toBe(false);

		buttons[0].click();
		expect(group.values).toEqual(["bold"]);
		expect(toggles.map((toggle) => toggle.pressed)).toEqual([true, false, false]);
		buttons[1].click();
		expect(group.values).toEqual(["italic"]);
		expect(toggles.map((toggle) => toggle.pressed)).toEqual([false, true, false]);
		buttons[1].click();
		expect(group.values).toEqual([]);
		expect(toggles.map((toggle) => toggle.pressed)).toEqual([false, false, false]);
	});

	test("supports multiple selection and silent programmatic writes", () => {
		const { buttons, group, toggles } = create();
		group.multiple = true;
		const input = vi.fn();
		const change = vi.fn();
		group.addEventListener("input", input);
		group.addEventListener("change", change);

		group.values = ["bold", "underline"];
		expect(group.values).toEqual(["bold", "underline"]);
		expect(toggles.map((toggle) => toggle.pressed)).toEqual([true, false, true]);
		toggles[1].pressed = true;
		expect(group.values).toEqual(["bold", "italic", "underline"]);
		toggles[0].pressed = false;
		expect(group.values).toEqual(["italic", "underline"]);
		expect(input).not.toHaveBeenCalled();
		expect(change).not.toHaveBeenCalled();

		buttons[2].click();
		expect(group.values).toEqual(["italic"]);
		expect(input).toHaveBeenCalledOnce();
		expect(change).toHaveBeenCalledOnce();
	});

	test("requires explicit unique member values while accepting an explicit empty value", () => {
		const { group, toggleName, toggles } = create(["", "duplicate", "duplicate"]);
		group.values = [""];
		expect(group.values).toEqual([""]);
		expect(toggles[0].pressed).toBe(true);
		group.multiple = true;
		expect(() => (group.values = ["duplicate"])).toThrow(TypeError);
		expect(() => (group.values = ["missing"])).toThrow(TypeError);
		expect(() => (group.values = ["", ""])).toThrow(TypeError);
		expect(group.values).toEqual([""]);

		const missing = document.createElement(toggleName) as ToggleElement;
		missing.append(document.createElement("button"));
		group.append(missing);
		expect(() => (missing.pressed = true)).toThrow(TypeError);
		expect(missing.pressed).toBe(false);
		group.multiple = false;
		expect(() => (group.values = ["", "other"])).toThrow(RangeError);
	});

	test("dispatches child and full-group proposals before one bubbling child event pair", async () => {
		const { buttons, group, toggles } = create();
		const events: string[] = [];
		let groupDetail: ToggleGroupChangeDetail | undefined;
		group.addEventListener("beforechange", (event) => {
			if (event.target === group) {
				events.push("group-beforechange");
				groupDetail = event.detail as ToggleGroupChangeDetail;
				expect(group.values).toEqual([]);
			} else {
				events.push("child-beforechange");
			}
		});
		group.addEventListener("input", (event) => {
			events.push("input");
			expect(event.target).toBe(toggles[1]);
			expect(group.values).toEqual(["italic"]);
		});
		group.addEventListener("change", (event) => {
			events.push("change");
			expect(event.target).toBe(toggles[1]);
		});

		await userEvent.click(buttons[1]);
		expect(events).toEqual(["child-beforechange", "group-beforechange", "input", "change"]);
		expect(groupDetail?.values).toEqual(["italic"]);
		expect(groupDetail?.sourceToggle).toBe(toggles[1]);
		expect(groupDetail?.sourceEvent).toBeInstanceOf(MouseEvent);
		expect(Object.isFrozen(groupDetail)).toBe(true);
		expect(Object.isFrozen(groupDetail?.values)).toBe(true);
	});

	test("finishes every child and group proposal listener before committing siblings", () => {
		const { buttons, group, toggles } = create();
		group.values = ["bold"];
		const observations: string[] = [];
		const ancestor = group.parentElement as HTMLElement;
		group.addEventListener("beforechange", (event) => {
			observations.push(event.target === group ? "group" : "child");
			expect(toggles.map((toggle) => toggle.pressed)).toEqual([true, false, false]);
		});
		ancestor.addEventListener("beforechange", (event) => {
			expect(toggles.map((toggle) => toggle.pressed)).toEqual([true, false, false]);
			if (event.target === group) {
				observations.push("late-veto");
				event.preventDefault();
			}
		});

		buttons[1].click();
		expect(observations).toEqual(["child", "group", "late-veto"]);
		expect(group.values).toEqual(["bold"]);
		expect(toggles.map((toggle) => toggle.pressed)).toEqual([true, false, false]);
	});

	test("invalidates a pending interaction when listeners alter group state or membership", () => {
		const { buttons, group, toggles } = create();
		group.values = ["bold"];
		const invalidate = (event: Event) => {
			if (event.target !== group) {
				return;
			}
			group.removeEventListener("beforechange", invalidate);
			group.values = ["underline"];
			buttons[0].click();
		};
		group.addEventListener("beforechange", invalidate);

		buttons[1].click();
		expect(group.values).toEqual(["underline"]);
		expect(toggles.map((toggle) => toggle.pressed)).toEqual([false, false, true]);
	});

	test("preserves a programmatic selection committed by the child proposal", () => {
		const { buttons, group, toggles } = create();
		group.values = ["bold"];
		const groupProposal = vi.fn();
		const input = vi.fn();
		const change = vi.fn();
		group.addEventListener("beforechange", (event) => {
			if (event.target === group) {
				groupProposal();
			}
		});
		group.addEventListener("input", input);
		group.addEventListener("change", change);
		toggles[1].addEventListener(
			"beforechange",
			() => {
				group.values = ["underline"];
			},
			{ once: true },
		);

		buttons[1].click();
		expect(group.values).toEqual(["underline"]);
		expect(toggles.map((toggle) => toggle.pressed)).toEqual([false, false, true]);
		expect(groupProposal).not.toHaveBeenCalled();
		expect(input).not.toHaveBeenCalled();
		expect(change).not.toHaveBeenCalled();
	});

	test("blocks sibling user activation throughout the child proposal lease", () => {
		const { buttons, group, toggles } = create();
		group.values = ["bold"];
		const proposals = vi.fn();
		const input = vi.fn();
		const change = vi.fn();
		group.addEventListener("beforechange", proposals);
		group.addEventListener("input", input);
		group.addEventListener("change", change);
		toggles[1].addEventListener(
			"beforechange",
			() => {
				buttons[2].click();
			},
			{ once: true },
		);

		buttons[1].click();
		expect(group.values).toEqual(["italic"]);
		expect(proposals).toHaveBeenCalledTimes(2);
		expect(input).toHaveBeenCalledOnce();
		expect(change).toHaveBeenCalledOnce();
	});

	test("guards the group transaction through the source toggle's input and change events", () => {
		const { buttons, group } = create();
		const beforechange = vi.fn();
		const input = vi.fn(() => buttons[0].click());
		const change = vi.fn(() => buttons[2].click());
		group.addEventListener("beforechange", beforechange);
		group.addEventListener("input", input);
		group.addEventListener("change", change);

		buttons[1].click();
		expect(group.values).toEqual(["italic"]);
		expect(beforechange).toHaveBeenCalledTimes(2);
		expect(input).toHaveBeenCalledOnce();
		expect(change).toHaveBeenCalledOnce();
	});

	test("propagates group disabledness without changing authored toggle state", () => {
		const { buttons, group, toggles } = create();
		buttons[1].disabled = true;
		toggles[2].disabled = true;
		group.disabled = true;
		expect(buttons.map((button) => button.disabled)).toEqual([true, true, true]);
		expect(toggles.map((toggle) => toggle.disabled)).toEqual([false, false, true]);

		group.disabled = false;
		expect(buttons.map((button) => button.disabled)).toEqual([false, true, true]);
		expect(toggles.map((toggle) => toggle.disabled)).toEqual([false, false, true]);
		buttons[0].click();
		expect(group.values).toEqual(["bold"]);
		buttons[1].dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, composed: true }));
		expect(group.values).toEqual(["bold"]);
	});

	test("uses roving focus without selecting on focus", () => {
		const { buttons, group } = create();
		expect(buttons.map((button) => button.tabIndex)).toEqual([0, -1, -1]);
		buttons[0].focus();
		expect(group.values).toEqual([]);
		expect(key(buttons[0], "ArrowRight")).toBe(false);
		expect(document.activeElement).toBe(buttons[1]);
		expect(group.values).toEqual([]);
		expect(buttons.map((button) => button.tabIndex)).toEqual([-1, 0, -1]);
		key(buttons[1], "End");
		expect(document.activeElement).toBe(buttons[2]);
		key(buttons[2], "Home");
		expect(document.activeElement).toBe(buttons[0]);
	});

	test("handles disabled items, orientation, RTL, loop boundaries, and embedded controls", () => {
		const { buttons, group, toggles } = create();
		buttons[1].disabled = true;
		buttons[0].focus();
		key(buttons[0], "ArrowRight");
		expect(document.activeElement).toBe(buttons[2]);

		group.dir = "rtl";
		key(buttons[2], "ArrowRight");
		expect(document.activeElement).toBe(buttons[0]);
		group.orientation = "vertical";
		key(buttons[0], "ArrowDown");
		expect(document.activeElement).toBe(buttons[2]);
		expect(key(buttons[2], "ArrowRight")).toBe(true);

		group.loopFocus = false;
		expect(key(buttons[2], "ArrowDown")).toBe(true);
		expect(document.activeElement).toBe(buttons[2]);
		const input = document.createElement("input");
		toggles[2].append(input);
		input.focus();
		expect(key(input, "Home")).toBe(true);
		expect(document.activeElement).toBe(input);
	});

	test("isolates nested groups and their activation events", () => {
		const outer = create(["outer-a", "outer-b"]);
		const inner = create(["inner-a", "inner-b"]);
		outer.toggles[0].append(inner.group);
		inner.buttons[0].focus();

		key(inner.buttons[0], "ArrowRight");
		expect(document.activeElement).toBe(inner.buttons[1]);
		expect(outer.group.values).toEqual([]);
		inner.buttons[1].click();
		expect(inner.group.values).toEqual(["inner-b"]);
		expect(outer.group.values).toEqual([]);
	});

	test("reconciles live insertion, removal, reorder, and focused-member removal", async () => {
		const { buttons, group, toggleName, toggles } = create();
		group.values = ["italic"];
		buttons[1].focus();
		group.prepend(toggles[1]);
		await mutation();
		expect(group.values).toEqual(["italic"]);
		expect(buttons[1].tabIndex).toBe(0);

		toggles[1].remove();
		await mutation();
		expect(group.values).toEqual([]);
		expect(document.activeElement).toBe(buttons[0]);
		expect(buttons[0].tabIndex).toBe(0);
		expect(buttons[1].hasAttribute("tabindex")).toBe(false);

		const added = document.createElement(toggleName) as ToggleElement;
		added.value = "strike";
		const addedButton = document.createElement("button");
		added.append(addedButton);
		group.append(added);
		await mutation();
		group.values = ["strike"];
		expect(added.pressed).toBe(true);
	});

	test("keeps coordination detached while releasing connection-owned roving focus", async () => {
		const { buttons, group, toggles } = create();
		buttons[1].setAttribute("tabindex", "7");
		await mutation();
		expect(buttons[1].tabIndex).toBe(-1);
		group.remove();
		expect(buttons[1].tabIndex).toBe(7);

		group.disabled = true;
		group.values = ["underline"];
		expect(buttons.every((button) => button.disabled)).toBe(true);
		expect(toggles.map((toggle) => toggle.pressed)).toEqual([false, false, true]);
		group.disabled = false;
		expect(buttons.every((button) => !button.disabled)).toBe(true);

		document.body.append(group);
		expect(buttons.map((button) => button.tabIndex)).toEqual([-1, -1, 0]);
		expect(group.values).toEqual(["underline"]);
	});

	test("releases stale detached group state when a member reconnects standalone", () => {
		const { buttons, group, toggles } = create();
		buttons[0].setAttribute("tabindex", "6");
		group.disabled = true;
		expect(buttons[0].disabled).toBe(true);
		group.remove();
		toggles[0].remove();
		document.body.append(toggles[0]);

		expect(toggles[0].button).toBe(buttons[0]);
		expect(buttons[0].disabled).toBe(false);
		expect(buttons[0].tabIndex).toBe(6);
	});

	test("prevents an old group refresh from clobbering a member claimed by a new group", () => {
		const first = create(["moving"]);
		const second = create(["resident"]);
		const moving = first.toggles[0];
		const button = first.buttons[0];
		second.group.disabled = true;
		second.group.append(moving);

		void second.group.values;
		void first.group.values;
		expect(button.disabled).toBe(true);
		expect(button.tabIndex).toBe(-1);
		first.group.remove();
		expect(button.disabled).toBe(true);
		expect(button.tabIndex).toBe(-1);

		second.group.disabled = false;
		void first.group.values;
		expect(button.disabled).toBe(false);
		second.group.disabled = true;
		void second.group.values;
		void first.group.values;
		expect(button.disabled).toBe(true);
	});

	test("aborts activation when a proposal reparents its source", () => {
		const first = create(["moving"]);
		const second = create(["resident"]);
		const moving = first.toggles[0];
		moving.addEventListener(
			"beforechange",
			() => {
				second.group.append(moving);
			},
			{ once: true },
		);
		first.buttons[0].click();
		expect(first.group.values).toEqual([]);
		expect(second.group.values).toEqual([]);
		expect(moving.pressed).toBe(false);

		moving.addEventListener(
			"beforechange",
			() => {
				document.body.append(moving);
			},
			{ once: true },
		);
		first.buttons[0].click();
		expect(second.group.values).toEqual([]);
		expect(moving.pressed).toBe(false);
	});

	test("settles owned tabindex mutations without observer feedback", async () => {
		const { buttons, group } = create();
		await mutation();
		let writes = 0;
		const observer = new MutationObserver((records) => {
			writes += records.filter((record) => record.attributeName === "tabindex").length;
		});
		observer.observe(group, { attributeFilter: ["tabindex"], attributes: true, subtree: true });

		await Promise.resolve();
		await Promise.resolve();
		await mutation();
		expect(writes).toBe(0);
		expect(buttons.map((button) => button.tabIndex)).toEqual([0, -1, -1]);
		observer.disconnect();
	});

	test("finishes member cleanup and clears cached state when one restoration throws", () => {
		const definitions = names();
		customElements.define(definitions.toggleName, class extends ToggleElement {});
		class CleanupGroup extends ToggleGroupElement {
			startTestConnection(): () => void {
				const controller = new AbortController();
				let cleanup = () => {};
				super.connect({
					addCleanup(value) {
						cleanup = value;
					},
					signal: controller.signal,
				});
				return () => {
					controller.abort();
					cleanup();
				};
			}
		}
		customElements.define(definitions.groupName, CleanupGroup);
		const group = document.createElement(definitions.groupName) as CleanupGroup;
		const toggles = ["a", "b", "c"].map((value) => {
			const toggle = document.createElement(definitions.toggleName) as ToggleElement;
			toggle.value = value;
			const button = document.createElement("button");
			toggle.append(button);
			group.append(toggle);
			return toggle;
		});
		const buttons = toggles.map((toggle) => toggle.button as HTMLButtonElement);
		const cleanup = group.startTestConnection();
		expect(buttons.map((button) => button.tabIndex)).toEqual([0, -1, -1]);
		const expectedMessage = "Expected tabindex restoration failure";
		const removeAttribute = buttons[0].removeAttribute;
		buttons[0].removeAttribute = function (name: string) {
			if (name === "tabindex") {
				throw new Error(expectedMessage);
			}
			removeAttribute.call(this, name);
		};
		try {
			expect(cleanup).toThrowError(expectedMessage);
		} finally {
			buttons[0].removeAttribute = removeAttribute;
		}

		expect(buttons[1].hasAttribute("tabindex")).toBe(false);
		const reconnectCleanup = group.startTestConnection();
		expect(buttons.map((button) => button.tabIndex)).toEqual([0, -1, -1]);
		reconnectCleanup();
	});

	test("recovers pre-upgrade values and pressed properties in either definition order", () => {
		for (const order of ["group-first", "toggle-first"] as const) {
			const definitions = names();
			const fixture = append(document.createElement("div"));
			fixture.innerHTML = `<${definitions.groupName}><${definitions.toggleName}><button>A</button></${definitions.toggleName}><${definitions.toggleName}><button>B</button></${definitions.toggleName}></${definitions.groupName}>`;
			const group = fixture.firstElementChild as ToggleGroupElement;
			const toggles = [...group.children] as ToggleElement[];
			(group as unknown as { values: readonly string[] }).values = ["b"];
			(toggles[0] as unknown as { value: string }).value = "a";
			(toggles[0] as unknown as { pressed: boolean }).pressed = true;
			(toggles[1] as unknown as { value: string }).value = "b";

			if (order === "group-first") {
				customElements.define(definitions.groupName, class extends ToggleGroupElement {});
				customElements.define(definitions.toggleName, class extends ToggleElement {});
			} else {
				customElements.define(definitions.toggleName, class extends ToggleElement {});
				customElements.define(definitions.groupName, class extends ToggleGroupElement {});
			}

			expect(group.values).toEqual(["b"]);
			expect(toggles.map((toggle) => toggle.pressed)).toEqual([false, true]);
			expect(toggles.map((toggle) => toggle.value)).toEqual(["a", "b"]);
		}
	});

	test("keeps group-first property recovery coherent while detached", () => {
		const definitions = names();
		const fixture = document.createElement("div");
		fixture.innerHTML = `<${definitions.groupName}><${definitions.toggleName}><button>A</button></${definitions.toggleName}></${definitions.groupName}>`;
		const group = fixture.firstElementChild as ToggleGroupElement;
		const toggle = group.firstElementChild as ToggleElement;
		(group as unknown as { values: readonly string[] }).values = ["a"];
		(toggle as unknown as { value: string }).value = "a";
		(toggle as unknown as { pressed: boolean }).pressed = true;

		customElements.define(definitions.groupName, class extends ToggleGroupElement {});
		customElements.define(definitions.toggleName, class extends ToggleElement {});
		expect(group.values).toEqual(["a"]);
		expect(toggle.pressed).toBe(true);
		append(fixture);
		expect(group.values).toEqual(["a"]);
	});

	test("leaves child toggles standalone when invalid properties fail a group upgrade", () => {
		const definitions = names();
		customElements.define(definitions.toggleName, class extends ToggleElement {});
		const fixture = append(document.createElement("div"));
		fixture.innerHTML = `<${definitions.groupName}><${definitions.toggleName} value="a" pressed><button>A</button></${definitions.toggleName}><${definitions.toggleName} value="b" pressed><button>B</button></${definitions.toggleName}></${definitions.groupName}>`;
		const group = fixture.firstElementChild as HTMLElement & { disabled: boolean; values: readonly string[] };
		const toggles = [...group.children] as ToggleElement[];
		const buttons = toggles.map((toggle) => toggle.button as HTMLButtonElement);
		const beforePressed = toggles.map((toggle) => toggle.getAttribute("pressed"));
		const beforeAria = buttons.map((button) => button.getAttribute("aria-pressed"));
		group.disabled = true;
		group.values = ["a", "a"];
		const expectedMessage = "A single toggle group accepts at most one value";
		let upgradeError: unknown;
		// Native failed upgrades report an error; some browser runners also print it before cancellation.
		// Handle only this expected failure so unrelated errors remain visible to the runner.
		const onError = (event: ErrorEvent) => {
			if (!(event.error instanceof RangeError) || event.error.message !== expectedMessage) {
				return;
			}
			upgradeError = event.error;
			event.preventDefault();
			event.stopImmediatePropagation();
		};
		window.addEventListener("error", onError, true);
		try {
			customElements.define(definitions.groupName, class extends ToggleGroupElement {});
		} catch (error) {
			if (!(error instanceof RangeError) || error.message !== expectedMessage) {
				throw error;
			}
			upgradeError = error;
		} finally {
			window.removeEventListener("error", onError, true);
		}

		expect(upgradeError).toBeInstanceOf(RangeError);
		expect((upgradeError as RangeError).message).toBe(expectedMessage);
		expect(toggles.map((toggle) => toggle.getAttribute("pressed"))).toEqual(beforePressed);
		expect(buttons.map((button) => button.getAttribute("aria-pressed"))).toEqual(beforeAria);
		expect(toggles.map((toggle) => toggle.pressed)).toEqual([true, true]);
		expect(buttons.map((button) => button.disabled)).toEqual([false, false]);
		buttons[0].click();
		buttons[1].click();
		expect(toggles.map((toggle) => toggle.pressed)).toEqual([false, false]);
	});

	test("uses native fieldset eligibility and survives document adoption and reconnect", async () => {
		const { buttons, group } = create();
		const fieldset = append(document.createElement("fieldset"));
		fieldset.disabled = true;
		fieldset.append(group);
		buttons[0].dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, composed: true }));
		expect(group.values).toEqual([]);
		buttons[0].focus();
		expect(key(buttons[0], "ArrowRight")).toBe(true);

		fieldset.disabled = false;
		const iframe = append(document.createElement("iframe"));
		const foreignDocument = iframe.contentDocument as Document;
		const foreignWindow = iframe.contentWindow as Window & typeof globalThis;
		foreignDocument.body.append(foreignDocument.adoptNode(group));
		buttons[0].dispatchEvent(
			new foreignWindow.MouseEvent("click", { bubbles: true, cancelable: true, composed: true }),
		);
		expect(group.values).toEqual(["bold"]);

		for (let index = 0; index < 3; ++index) {
			group.remove();
			foreignDocument.body.append(group);
		}
		await mutation();
		buttons[1].click();
		expect(group.values).toEqual(["italic"]);
	});
});
