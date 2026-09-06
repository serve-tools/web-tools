import { afterEach, describe, expect, test, vi } from "vitest";
import { AccordionElement } from "../../src/AccordionElement.js";
import { CollapsibleElement } from "../../src/CollapsibleElement.js";

const fixtures: Node[] = [];
const mutation = async () => {
	await Promise.resolve();
	await Promise.resolve();
};

afterEach(() => {
	for (const fixture of fixtures.splice(0).reverse()) {
		fixture.parentNode?.removeChild(fixture);
	}
	vi.restoreAllMocks();
});

const append = <T extends Node>(node: T): T => {
	document.body.append(node);
	fixtures.push(node);
	return node;
};

const defineElements = () => {
	const accordionName = `base-accordion-${crypto.randomUUID()}`;
	const collapsibleName = `base-collapsible-${crypto.randomUUID()}`;
	customElements.define(accordionName, class extends AccordionElement {});
	customElements.define(collapsibleName, class extends CollapsibleElement {});
	return { accordionName, collapsibleName };
};

const disclosure = (name: string, value?: string) => {
	const element = document.createElement(name) as CollapsibleElement;
	if (value !== undefined) {
		element.value = value;
	}
	const heading = document.createElement("h3");
	const button = document.createElement("button");
	button.textContent = value ?? "Invalid";
	const panel = document.createElement("section");
	panel.slot = "panel";
	panel.textContent = `${value ?? "Invalid"} panel`;
	heading.append(button);
	element.append(heading, panel);
	return { button, element, heading, panel };
};

const create = (values = ["first", "second", "third"]) => {
	const { accordionName, collapsibleName } = defineElements();
	const element = document.createElement(accordionName) as AccordionElement;
	const items = values.map((value) => disclosure(collapsibleName, value));
	element.append(...items.map((item) => item.element));
	append(element);
	return { accordionName, collapsibleName, element, items };
};

const key = (target: HTMLElement, key: string) => {
	const event = new KeyboardEvent("keydown", { bubbles: true, cancelable: true, key });
	target.dispatchEvent(event);
	return event.defaultPrevented;
};

describe("AccordionElement", () => {
	test("coordinates single expansion in DOM order with a silent values API", () => {
		const { element, items } = create();

		expect(element.disclosures).toEqual(items.map((item) => item.element));
		expect(Object.isFrozen(element.disclosures)).toBe(true);
		expect(element.values).toEqual([]);
		expect(Object.isFrozen(element.values)).toBe(true);

		items[0].button.click();
		expect(element.values).toEqual(["first"]);
		expect(items.map((item) => item.element.open)).toEqual([true, false, false]);

		items[1].button.click();
		expect(element.values).toEqual(["second"]);
		expect(items.map((item) => item.element.open)).toEqual([false, true, false]);

		items[1].button.click();
		expect(element.values).toEqual([]);

		const input = vi.fn();
		element.addEventListener("input", input);
		element.values = ["third"];
		expect(items.map((item) => item.element.open)).toEqual([false, false, true]);
		expect(input).not.toHaveBeenCalled();
	});

	test("supports multiple expansion and preserves the first open disclosure when returning to single mode", () => {
		const { element, items } = create();
		element.multiple = true;
		items[0].button.click();
		items[2].button.click();
		expect(element.values).toEqual(["first", "third"]);
		expect(element.matches(":state(multiple)")).toBe(true);

		element.multiple = false;
		expect(element.values).toEqual(["first"]);
		expect(items.map((item) => item.element.open)).toEqual([true, false, false]);
	});

	test("validates explicit unique values and retains pre-upgrade selection", () => {
		const { accordionName } = defineElements();
		const lateName = `base-collapsible-${crypto.randomUUID()}`;
		const element = document.createElement(accordionName) as AccordionElement;
		element.values = ["later"];
		element.innerHTML = `<${lateName} value="later"><button>Later</button><section slot="panel">Panel</section></${lateName}>`;
		append(element);
		expect(element.values).toEqual(["later"]);

		customElements.define(lateName, class extends CollapsibleElement {});
		const late = element.firstElementChild as CollapsibleElement;
		expect(late.open).toBe(true);
		expect(element.values).toEqual(["later"]);

		const invalid = disclosure(lateName);
		element.append(invalid.element);
		expect(invalid.button.disabled).toBe(true);
		invalid.button.click();
		expect(invalid.element.open).toBe(false);
		expect(() => (invalid.element.open = true)).toThrow(TypeError);

		const duplicate = disclosure(lateName, "later");
		element.append(duplicate.element);
		expect(late.button?.disabled).toBe(true);
		expect(duplicate.button.disabled).toBe(true);
		expect(late.open).toBe(false);
		expect(() => (element.values = ["later"])).toThrow(TypeError);
		expect(() => (element.values = ["missing"])).toThrow(TypeError);
		expect(() => (element.values = ["x", "x"])).toThrow(RangeError);
		expect(() => (element.values = ["later", "missing"])).toThrow(RangeError);
	});

	test("runs child and group vetoes before one committed input/change pair", () => {
		const { element, items } = create();
		const events: string[] = [];
		items[0].element.addEventListener("beforechange", (event) => {
			if ("open" in event.detail) {
				events.push(`child:${event.detail.open}`);
			}
		});
		element.addEventListener("beforechange", (event) => {
			if (event.target === element && "values" in event.detail) {
				events.push(`group:${event.detail.values.join(",")}`);
				expect(event.detail.sourceDisclosure).toBe(
					event.detail.values.includes("first") ? items[0].element : items[1].element,
				);
				expect(Object.isFrozen(event.detail.values)).toBe(true);
			}
		});
		element.addEventListener("input", (event) => events.push(`${event.type}:${element.values.join(",")}`));
		element.addEventListener("change", (event) => events.push(`${event.type}:${element.values.join(",")}`));

		items[0].button.click();
		expect(events).toEqual(["child:true", "group:first", "input:first", "change:first"]);

		events.length = 0;
		const cancelGroup = (event: CustomEvent) => {
			if (event.target === element) {
				event.preventDefault();
				element.removeEventListener("beforechange", cancelGroup);
			}
		};
		element.addEventListener("beforechange", cancelGroup);
		items[1].button.click();
		expect(element.values).toEqual(["first"]);
		expect(events).toEqual(["group:second"]);
	});

	test("abandons stale interaction transactions while preserving reentrant programmatic changes", () => {
		const { element, items } = create();
		const input = vi.fn();
		element.addEventListener("input", input);
		const changeGroup = (event: CustomEvent) => {
			if (event.target === element && "values" in event.detail) {
				element.values = ["third"];
				element.removeEventListener("beforechange", changeGroup);
			}
		};
		element.addEventListener("beforechange", changeGroup);

		items[0].button.click();
		expect(element.values).toEqual(["third"]);
		expect(input).not.toHaveBeenCalled();
	});

	test("preserves a programmatic selection made during the child proposal", () => {
		const { element, items } = create();
		element.values = ["first"];
		const input = vi.fn();
		items[1].element.addEventListener("input", input);
		items[1].element.addEventListener("beforechange", () => (element.values = ["third"]), { once: true });

		items[1].button.click();
		expect(element.values).toEqual(["third"]);
		expect(items.map((item) => item.element.open)).toEqual([false, false, true]);
		expect(input).not.toHaveBeenCalled();

		const reentrant = create();
		const siblingProposal = vi.fn();
		reentrant.items[2].element.addEventListener("beforechange", siblingProposal);
		reentrant.items[1].element.addEventListener("beforechange", () => reentrant.items[2].button.click(), {
			once: true,
		});
		reentrant.items[1].button.click();
		expect(reentrant.element.values).toEqual(["second"]);
		expect(siblingProposal).not.toHaveBeenCalled();
	});

	test("lets focus-return listeners replace an in-progress single-selection commit", () => {
		const reopen = create(["first", "second"]);
		reopen.items[0].element.open = true;
		const firstInput = document.createElement("input");
		const reopenChanges = vi.fn();
		reopen.items[0].panel.append(firstInput);
		firstInput.focus();
		reopen.items[1].element.addEventListener("change", reopenChanges);
		reopen.items[0].button.addEventListener("focus", () => (reopen.items[0].element.open = true), { once: true });
		reopen.items[1].button.click();

		expect(reopen.element.values).toEqual(["first"]);
		expect(reopen.items.map((item) => item.element.open)).toEqual([true, false]);
		expect(reopenChanges).not.toHaveBeenCalled();

		const clear = create(["first", "second"]);
		clear.items[0].element.open = true;
		const secondInput = document.createElement("input");
		const clearChanges = vi.fn();
		clear.items[0].panel.append(secondInput);
		secondInput.focus();
		clear.items[1].element.addEventListener("change", clearChanges);
		clear.items[0].button.addEventListener("focus", () => (clear.element.values = []), { once: true });
		clear.items[1].button.click();

		expect(clear.element.values).toEqual([]);
		expect(clear.items.map((item) => item.element.open)).toEqual([false, false]);
		expect(clearChanges).not.toHaveBeenCalled();

		const insertion = create(["first", "second"]);
		insertion.items[0].element.open = true;
		const inserted = disclosure(insertion.collapsibleName, "third");
		inserted.element.open = true;
		const thirdInput = document.createElement("input");
		const insertionChanges = vi.fn();
		insertion.items[0].panel.append(thirdInput);
		thirdInput.focus();
		insertion.items[1].element.addEventListener("change", insertionChanges);
		insertion.items[0].button.addEventListener("focus", () => insertion.element.append(inserted.element), {
			once: true,
		});
		insertion.items[1].button.click();

		expect(insertion.element.values).toEqual(["third"]);
		expect([...insertion.items.map((item) => item.element.open), inserted.element.open]).toEqual([
			false,
			false,
			true,
		]);
		expect(insertionChanges).not.toHaveBeenCalled();
	});

	test("blurs panel focus synchronously for a disabled group and preserves blur-listener values", () => {
		const close = create(["first", "second"]);
		close.element.values = ["first"];
		const closeInput = document.createElement("input");
		const blur = vi.fn();
		close.items[0].panel.append(closeInput);
		closeInput.addEventListener("blur", blur);
		closeInput.focus();
		close.element.disabled = true;

		close.element.values = [];

		expect(close.items[0].panel.hidden).toBe(true);
		expect(document.activeElement).not.toBe(closeInput);
		expect(blur).toHaveBeenCalledOnce();

		const replace = create(["first", "second"]);
		replace.element.values = ["first"];
		const replaceInput = document.createElement("input");
		replace.items[0].panel.append(replaceInput);
		replaceInput.focus();
		replace.element.disabled = true;
		replaceInput.addEventListener("blur", () => (replace.element.values = ["first"]), { once: true });

		replace.element.values = [];

		expect(replace.element.values).toEqual(["first"]);
		expect(replace.items.map((item) => item.element.open)).toEqual([true, false]);
		expect(replace.items[0].panel.hidden).toBe(false);
	});

	test("releases the activation lease when the owner-realm event constructor throws", () => {
		const { element, items } = create(["first", "second"]);
		const expected = new Error("expected CustomEvent construction failure");
		const descriptor = Object.getOwnPropertyDescriptor(window, "CustomEvent");
		let reported: unknown;
		const onError = (event: ErrorEvent) => {
			if (event.error !== expected) {
				return;
			}
			reported = event.error;
			event.preventDefault();
			event.stopImmediatePropagation();
		};
		window.addEventListener("error", onError, true);
		Object.defineProperty(window, "CustomEvent", {
			configurable: true,
			value: function ThrowingCustomEvent() {
				throw expected;
			},
		});
		try {
			items[0].button.click();
		} finally {
			if (descriptor) {
				Object.defineProperty(window, "CustomEvent", descriptor);
			} else {
				Reflect.deleteProperty(window, "CustomEvent");
			}
			window.removeEventListener("error", onError, true);
		}

		expect(reported).toBe(expected);
		expect(element.values).toEqual([]);
		items[1].button.click();
		expect(element.values).toEqual(["second"]);
	});

	test("moves focus with vertical and horizontal RTL keys while skipping disabled disclosures", () => {
		const { element, items } = create();
		items[1].element.disabled = true;
		items[0].button.focus();

		expect(key(items[0].button, "ArrowDown")).toBe(true);
		expect(document.activeElement).toBe(items[2].button);
		expect(element.values).toEqual([]);
		expect(key(items[2].button, "Home")).toBe(true);
		expect(document.activeElement).toBe(items[0].button);
		expect(key(items[0].button, "End")).toBe(true);
		expect(document.activeElement).toBe(items[2].button);

		element.loopFocus = false;
		expect(key(items[2].button, "ArrowDown")).toBe(false);
		expect(document.activeElement).toBe(items[2].button);

		element.orientation = "horizontal";
		element.loopFocus = true;
		element.dir = "rtl";
		items[0].button.focus();
		expect(key(items[0].button, "ArrowRight")).toBe(true);
		expect(document.activeElement).toBe(items[2].button);
		expect(element.matches(":state(horizontal)")).toBe(true);
	});

	test("isolates nested accordions and keyboard events from panel controls", () => {
		const outer = create(["outer-first", "outer-second"]);
		const inner = create(["inner-first", "inner-second"]);
		outer.items[0].panel.append(inner.element);
		outer.items[0].element.open = true;
		const input = document.createElement("input");
		outer.items[0].panel.append(input);

		inner.items[0].button.focus();
		key(inner.items[0].button, "ArrowDown");
		expect(document.activeElement).toBe(inner.items[1].button);

		input.focus();
		expect(key(input, "ArrowDown")).toBe(false);
		expect(document.activeElement).toBe(input);
	});

	test("propagates group disabledness without changing member properties and releases moved members", async () => {
		const first = create(["first", "second"]);
		const second = create(["other"]);
		first.element.disabled = true;
		expect(first.items.every((item) => item.button.disabled)).toBe(true);
		expect(first.items.every((item) => item.element.disabled === false)).toBe(true);

		second.element.append(first.items[0].element);
		await mutation();
		expect(first.element.disclosures).toEqual([first.items[1].element]);
		expect(second.element.disclosures).toEqual([second.items[0].element, first.items[0].element]);
		expect(first.items[0].button.disabled).toBe(false);

		first.items[0].button.click();
		expect(second.element.values).toEqual(["first"]);
		expect(first.element.values).toEqual([]);
	});

	test("preserves direct member and panel identity through reorder and reconnect without duplicate handlers", async () => {
		const { element, items } = create();
		items[1].button.click();
		const selectedPanel = items[1].panel;
		element.prepend(items[1].element);
		await mutation();
		expect(element.values).toEqual(["second"]);
		expect(element.disclosures[0]).toBe(items[1].element);
		expect(items[1].element.panel).toBe(selectedPanel);

		let changes = 0;
		element.addEventListener("change", () => ++changes);
		for (let index = 0; index < 3; ++index) {
			element.remove();
			document.body.append(element);
		}
		items[0].button.click();
		expect(changes).toBe(1);
		expect(element.values).toEqual(["first"]);
	});

	test("reconciles passive detached membership edits on reconnection", () => {
		const { element, items } = create();
		element.values = ["second"];
		element.remove();
		items[1].element.remove();
		document.body.append(element);

		expect(element.disclosures).toEqual([items[0].element, items[2].element]);
		expect(element.values).toEqual([]);
		expect(items[0].button.disabled).toBe(false);
		expect(items[2].button.disabled).toBe(false);
	});

	test("does not demand-refresh an unchanged direct accordion while its whole tree disconnects", () => {
		const { element } = create();
		const buttonRead = vi.spyOn(CollapsibleElement.prototype, "button", "get");

		element.remove();

		expect(buttonRead).not.toHaveBeenCalled();
	});

	test("reconciles a connected disclosure move to another accordion or standalone", () => {
		const first = create(["item"]);
		const second = create(["other"]);
		first.element.disabled = true;
		expect(first.items[0].button.disabled).toBe(true);

		second.element.append(first.items[0].element);
		expect(first.items[0].button.disabled).toBe(false);
		expect(second.element.disclosures).toEqual([second.items[0].element, first.items[0].element]);

		document.body.append(first.items[0].element);
		expect(first.items[0].button.disabled).toBe(false);
		first.items[0].button.click();
		expect(first.items[0].element.open).toBe(true);
	});

	test("recovers pre-upgrade group values and child value/open properties in either definition order", () => {
		for (const order of ["accordion-first", "collapsible-first"] as const) {
			const accordionName = `base-accordion-${crypto.randomUUID()}`;
			const collapsibleName = `base-collapsible-${crypto.randomUUID()}`;
			const fixture = append(document.createElement("div"));
			fixture.innerHTML = `<${accordionName}><${collapsibleName}><button>A</button><section slot="panel">A</section></${collapsibleName}><${collapsibleName}><button>B</button><section slot="panel">B</section></${collapsibleName}></${accordionName}>`;
			const accordion = fixture.firstElementChild as AccordionElement;
			const disclosures = [...accordion.children] as CollapsibleElement[];
			(accordion as unknown as { values: readonly string[] }).values = ["b"];
			(disclosures[0] as unknown as { value: string }).value = "a";
			(disclosures[0] as unknown as { open: boolean }).open = true;
			(disclosures[1] as unknown as { value: string }).value = "b";

			if (order === "accordion-first") {
				customElements.define(accordionName, class extends AccordionElement {});
				customElements.define(collapsibleName, class extends CollapsibleElement {});
			} else {
				customElements.define(collapsibleName, class extends CollapsibleElement {});
				customElements.define(accordionName, class extends AccordionElement {});
			}

			expect(accordion.values).toEqual(["b"]);
			expect(disclosures.map((item) => item.open)).toEqual([false, true]);
			expect(disclosures.map((item) => item.value)).toEqual(["a", "b"]);
		}
	});

	test("leaves child disclosures standalone when invalid properties fail an accordion upgrade", () => {
		const accordionName = `base-accordion-${crypto.randomUUID()}`;
		const collapsibleName = `base-collapsible-${crypto.randomUUID()}`;
		customElements.define(collapsibleName, class extends CollapsibleElement {});
		const fixture = append(document.createElement("div"));
		fixture.innerHTML = `<${accordionName}><${collapsibleName} value="a"><button>A</button><section slot="panel">A</section></${collapsibleName}><${collapsibleName} value="b"><button>B</button><section slot="panel">B</section></${collapsibleName}></${accordionName}>`;
		const accordion = fixture.firstElementChild as HTMLElement & { values: readonly string[] };
		const disclosures = [...accordion.children] as CollapsibleElement[];
		const buttons = disclosures.map((item) => item.button as HTMLButtonElement);
		const panels = disclosures.map((item) => item.panel as HTMLElement);
		for (const item of disclosures) {
			item.open = true;
		}
		expect(disclosures.map((item) => item.open)).toEqual([true, true]);
		expect(panels.map((panel) => panel.hidden)).toEqual([false, false]);
		(accordion as unknown as { orientation: string }).orientation = "horizontal";
		accordion.values = ["a", "a"];
		const expectedMessage = "A single accordion accepts at most one value";
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
			customElements.define(accordionName, class extends AccordionElement {});
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
		expect(disclosures.map((item) => item.open)).toEqual([true, true]);
		expect(buttons.map((button) => button.getAttribute("aria-expanded"))).toEqual(["true", "true"]);
		expect(panels.map((panel) => panel.hidden)).toEqual([false, false]);
		buttons[0].click();
		buttons[1].click();
		expect(disclosures.map((item) => item.open)).toEqual([false, false]);
		buttons[0].click();
		buttons[1].click();
		expect(disclosures.map((item) => item.open)).toEqual([true, true]);
	});

	test("uses the adopted document realm for keyboard and change events", () => {
		const { element, items } = create(["first", "second"]);
		const frame = append(document.createElement("iframe"));
		const foreignDocument = frame.contentDocument!;
		const FrameKeyboardEvent = foreignDocument.defaultView!.KeyboardEvent;
		const FrameEvent = foreignDocument.defaultView!.Event;
		foreignDocument.body.append(foreignDocument.adoptNode(element));

		items[0].button.focus();
		items[0].button.dispatchEvent(new FrameKeyboardEvent("keydown", { bubbles: true, key: "ArrowDown" }));
		expect(foreignDocument.activeElement).toBe(items[1].button);

		let input: Event | undefined;
		items[1].element.addEventListener("input", (event) => (input = event), { once: true });
		items[1].button.click();
		expect(input).toBeInstanceOf(FrameEvent);
	});
});
