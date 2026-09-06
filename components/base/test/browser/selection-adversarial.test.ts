import { afterEach, describe, expect, test, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { AutocompleteElement } from "../../src/AutocompleteElement.js";
import { ComboboxElement } from "../../src/ComboboxElement.js";
import { OptionElement } from "../../src/OptionElement.js";
import { SelectElement } from "../../src/SelectElement.js";

const fixtures: Node[] = [];

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

const nextName = (kind: string): string => `base-${kind}-adversarial-${crypto.randomUUID()}`;

const define = () => {
	const option = nextName("option");
	const autocomplete = nextName("autocomplete");
	const combobox = nextName("combobox");
	const select = nextName("select");
	customElements.define(option, class extends OptionElement {});
	customElements.define(autocomplete, class extends AutocompleteElement {});
	customElements.define(combobox, class extends ComboboxElement {});
	customElements.define(select, class extends SelectElement {});
	return { autocomplete, combobox, option, select };
};

const createOption = (name: string, value: string, label = value): OptionElement => {
	const element = document.createElement(name) as OptionElement;
	element.value = value;
	element.textContent = label;
	return element;
};

const createPopup = (...options: OptionElement[]): HTMLDivElement => {
	const popup = document.createElement("div");
	popup.popover = "manual";
	popup.append(...options);
	return popup;
};

const nextMicrotask = (): Promise<void> => new Promise((resolve) => queueMicrotask(resolve));

const dispatchInput = (input: HTMLInputElement): void => {
	input.dispatchEvent(new InputEvent("input", { bubbles: true, composed: true, inputType: "insertText" }));
};

describe("selection adversarial behavior", () => {
	test("keeps a Combobox popup open across repeated query input", () => {
		const names = define();
		const host = document.createElement(names.combobox) as ComboboxElement;
		const input = document.createElement("input");
		const popup = createPopup(
			createOption(names.option, "alpha", "Alpha"),
			createOption(names.option, "alpine", "Alpine"),
		);
		host.append(input, popup);
		append(host);

		input.value = "a";
		dispatchInput(input);
		expect(popup.matches(":popover-open")).toBe(true);
		input.value = "al";
		dispatchInput(input);
		expect(popup.matches(":popover-open")).toBe(true);
	});

	test("keeps the popup open while repeated ArrowDown presses advance the active option", async () => {
		const names = define();
		const host = document.createElement(names.combobox) as ComboboxElement;
		const input = document.createElement("input");
		const first = createOption(names.option, "one");
		const second = createOption(names.option, "two");
		const popup = createPopup(first, second);
		host.append(input, popup);
		append(host);
		input.focus();

		await userEvent.keyboard("{ArrowDown}");
		expect(popup.matches(":popover-open")).toBe(true);
		expect(input.getAttribute("aria-activedescendant")).toBe(first.id);
		await userEvent.keyboard("{ArrowDown}");
		expect(popup.matches(":popover-open")).toBe(true);
		expect(input.getAttribute("aria-activedescendant")).toBe(second.id);
	});

	test("accepts a Select option with ArrowDown then Enter", async () => {
		const names = define();
		const host = document.createElement(names.select) as SelectElement;
		const button = document.createElement("button");
		button.textContent = "Choose";
		const first = createOption(names.option, "one");
		const popup = createPopup(first);
		host.append(button, popup);
		append(host);
		const events: string[] = [];
		host.addEventListener("beforechange", () => events.push("beforechange"));
		host.addEventListener("input", () => events.push("input"));
		host.addEventListener("change", () => events.push("change"));
		button.focus();

		await userEvent.keyboard("{ArrowDown}{Enter}");
		expect(host.values).toEqual(["one"]);
		expect(popup.matches(":popover-open")).toBe(false);
		expect(events).toEqual(["beforechange", "input", "change"]);
	});

	test("toggles an active multiple Combobox option from the keyboard", async () => {
		const names = define();
		const host = document.createElement(names.combobox) as ComboboxElement;
		host.multiple = true;
		const input = document.createElement("input");
		const popup = createPopup(createOption(names.option, "one"));
		host.append(input, popup);
		append(host);
		input.focus();

		await userEvent.keyboard("{ArrowDown}{Enter}");
		expect(host.values).toEqual(["one"]);
		await userEvent.keyboard("{ArrowDown}{Enter}");
		expect(host.values).toEqual([]);
	});

	test("tracks external native popover state through actual ARIA ownership links", async () => {
		const names = define();
		const host = document.createElement(names.combobox) as ComboboxElement;
		const input = document.createElement("input");
		const popup = createPopup(createOption(names.option, "one"));
		host.append(input, popup);
		append(host);

		expect(popup.id).not.toBe("");
		expect(input.getAttribute("aria-controls")).toBe(popup.id);
		popup.showPopover({ source: input });
		await vi.waitFor(() => expect(input.getAttribute("aria-expanded")).toBe("true"));
		popup.hidePopover();
		await vi.waitFor(() => expect(input.getAttribute("aria-expanded")).toBe("false"));
	});

	test("links an Autocomplete input to its popup and tracks external popup state", async () => {
		const names = define();
		const host = document.createElement(names.autocomplete) as AutocompleteElement;
		const input = document.createElement("input");
		const popup = createPopup(createOption(names.option, "one"));
		host.append(input, popup);
		append(host);

		expect(popup.id).not.toBe("");
		expect(input.getAttribute("aria-controls")).toBe(popup.id);
		popup.showPopover({ source: input });
		await vi.waitFor(() => expect(input.getAttribute("aria-expanded")).toBe("true"));
		popup.hidePopover();
		await vi.waitFor(() => expect(input.getAttribute("aria-expanded")).toBe("false"));
	});

	test("links a Select button to its popup and tracks external popup state", async () => {
		const names = define();
		const host = document.createElement(names.select) as SelectElement;
		const button = document.createElement("button");
		button.textContent = "Choose";
		const popup = createPopup(createOption(names.option, "one"));
		host.append(button, popup);
		append(host);

		expect(popup.id).not.toBe("");
		expect(button.getAttribute("aria-controls")).toBe(popup.id);
		popup.showPopover({ source: button });
		await vi.waitFor(() => expect(button.getAttribute("aria-expanded")).toBe("true"));
		popup.hidePopover();
		await vi.waitFor(() => expect(button.getAttribute("aria-expanded")).toBe("false"));
	});

	test("wires a Combobox control inserted after the connected host", async () => {
		const names = define();
		const host = append(document.createElement(names.combobox) as ComboboxElement);
		const input = document.createElement("input");
		const popup = createPopup(createOption(names.option, "one"));
		host.append(input, popup);
		await nextMicrotask();
		input.focus();

		await userEvent.keyboard("{ArrowDown}");
		expect(popup.matches(":popover-open")).toBe(true);
		expect(input.hasAttribute("aria-activedescendant")).toBe(true);
	});

	test("wires a Select control inserted after the connected host", async () => {
		const names = define();
		const host = append(document.createElement(names.select) as SelectElement);
		const button = document.createElement("button");
		button.textContent = "Choose";
		const popup = createPopup(createOption(names.option, "one"));
		host.append(button, popup);
		await nextMicrotask();
		button.focus();

		await userEvent.keyboard("{ArrowDown}{Enter}");
		expect(host.values).toEqual(["one"]);
	});

	test("wires an Autocomplete input inserted after the connected host", async () => {
		const names = define();
		const host = append(document.createElement(names.autocomplete) as AutocompleteElement);
		const input = document.createElement("input");
		const matching = createOption(names.option, "paris", "Paris");
		const filtered = createOption(names.option, "rome", "Rome");
		const popup = createPopup(matching, filtered);
		host.append(input, popup);
		await nextMicrotask();

		input.value = "par";
		dispatchInput(input);
		expect(popup.matches(":popover-open")).toBe(true);
		expect(filtered.hidden).toBe(true);
	});

	test("filters a prefilled Autocomplete input before its first keyboard opening", async () => {
		const names = define();
		const host = document.createElement(names.autocomplete) as AutocompleteElement;
		const input = document.createElement("input");
		input.value = "par";
		const paris = createOption(names.option, "paris", "Paris");
		const rome = createOption(names.option, "rome", "Rome");
		const popup = createPopup(paris, rome);
		host.append(input, popup);
		append(host);
		input.focus();

		await userEvent.keyboard("{ArrowDown}");
		expect(popup.matches(":popover-open")).toBe(true);
		expect(paris.hidden).toBe(false);
		expect(rome.hidden).toBe(true);
		expect(input.getAttribute("aria-activedescendant")).toBe(paris.id);
	});

	test("refilters Autocomplete options after the native input resets", async () => {
		const names = define();
		const form = document.createElement("form");
		const host = document.createElement(names.autocomplete) as AutocompleteElement;
		const input = document.createElement("input");
		input.defaultValue = "par";
		const paris = createOption(names.option, "paris", "Paris");
		const rome = createOption(names.option, "rome", "Rome");
		host.append(input, createPopup(paris, rome));
		form.append(host);
		append(form);
		input.value = "rom";
		dispatchInput(input);
		expect(paris.hidden).toBe(true);
		expect(rome.hidden).toBe(false);

		form.reset();
		await nextMicrotask();
		expect(input.value).toBe("par");
		expect(paris.hidden).toBe(false);
		expect(rome.hidden).toBe(true);
	});

	test("forwards a Combobox host label to focus and name the native input", async () => {
		const names = define();
		const fixture = document.createElement("div");
		const label = document.createElement("label");
		label.id = crypto.randomUUID();
		label.textContent = "Service";
		const host = document.createElement(names.combobox) as ComboboxElement;
		host.id = crypto.randomUUID();
		label.htmlFor = host.id;
		const input = document.createElement("input");
		host.append(input, createPopup(createOption(names.option, "pro")));
		fixture.append(label, host);
		append(fixture);

		expect(input.getAttribute("aria-labelledby")?.split(/\s+/) ?? []).toContain(label.id);
		await userEvent.click(label);
		expect(document.activeElement).toBe(input);
	});

	test("forwards a Select host label to focus and name the native button", async () => {
		const names = define();
		const fixture = document.createElement("div");
		const label = document.createElement("label");
		label.id = crypto.randomUUID();
		label.textContent = "Region";
		const host = document.createElement(names.select) as SelectElement;
		host.id = crypto.randomUUID();
		label.htmlFor = host.id;
		const button = document.createElement("button");
		button.textContent = "Choose";
		host.append(button, createPopup(createOption(names.option, "east")));
		fixture.append(label, host);
		append(fixture);

		expect(button.getAttribute("aria-labelledby")?.split(/\s+/) ?? []).toContain(label.id);
		await userEvent.click(label);
		expect(document.activeElement).toBe(button);
	});

	test("refreshes an external FACE label added, retargeted, and removed after connection", () => {
		const names = define();
		const host = document.createElement(names.combobox) as ComboboxElement;
		host.id = crypto.randomUUID();
		const input = document.createElement("input");
		host.append(input, createPopup(createOption(names.option, "one")));
		append(host);
		const label = document.createElement("label");
		label.id = crypto.randomUUID();
		label.textContent = "Service";
		label.htmlFor = host.id;
		append(label);
		host.refresh();

		expect(input.getAttribute("aria-labelledby")?.split(/\s+/) ?? []).toContain(label.id);
		label.htmlFor = "somewhere-else";
		host.refresh();
		expect(input.getAttribute("aria-labelledby")?.split(/\s+/) ?? []).not.toContain(label.id);
		label.htmlFor = host.id;
		host.refresh();
		expect(input.getAttribute("aria-labelledby")?.split(/\s+/) ?? []).toContain(label.id);
		label.remove();
		host.refresh();
		expect(input.getAttribute("aria-labelledby")?.split(/\s+/) ?? []).not.toContain(label.id);
	});

	test("suppresses duplicate Combobox input form data and restores the authored name", async () => {
		const names = define();
		const form = document.createElement("form");
		const host = document.createElement(names.combobox) as ComboboxElement;
		host.name = "service";
		const input = document.createElement("input");
		input.name = "query";
		input.value = "visible query";
		const selected = createOption(names.option, "pro");
		selected.defaultSelected = true;
		host.append(input, createPopup(selected));
		form.append(host);
		append(form);

		expect([...new FormData(form)]).toEqual([["service", "pro"]]);
		input.name = "late-query";
		await nextMicrotask();
		expect(input.hasAttribute("name")).toBe(false);
		expect([...new FormData(form)]).toEqual([["service", "pro"]]);
		host.remove();
		expect(input.name).toBe("late-query");
	});

	test("rebinds a replacement Combobox input and restores both authored names", async () => {
		const names = define();
		const host = document.createElement(names.combobox) as ComboboxElement;
		const first = document.createElement("input");
		first.name = "first-query";
		const popup = createPopup(createOption(names.option, "one"));
		host.append(first, popup);
		append(host);
		expect(first.hasAttribute("name")).toBe(false);

		const second = document.createElement("input");
		second.name = "second-query";
		first.replaceWith(second);
		await nextMicrotask();
		expect(first.name).toBe("first-query");
		expect(second.hasAttribute("name")).toBe(false);
		second.value = "o";
		dispatchInput(second);
		expect(popup.matches(":popover-open")).toBe(true);
		host.remove();
		expect(second.name).toBe("second-query");
	});

	test("keeps a readonly Combobox query natively readonly", async () => {
		const names = define();
		const host = document.createElement(names.combobox) as ComboboxElement;
		const input = document.createElement("input");
		input.value = "fixed";
		host.append(input, createPopup(createOption(names.option, "fixed")));
		append(host);
		host.readOnly = true;

		expect(input.readOnly).toBe(true);
		await userEvent.click(input);
		await userEvent.type(input, " changed");
		expect(input.value).toBe("fixed");
		host.readOnly = false;
		expect(input.readOnly).toBe(false);
	});

	test("does not accept an Autocomplete option while its native input is disabled", () => {
		const names = define();
		const host = document.createElement(names.autocomplete) as AutocompleteElement;
		const input = document.createElement("input");
		input.value = "Par";
		input.disabled = true;
		const option = createOption(names.option, "paris", "Paris");
		host.append(input, createPopup(option));
		append(host);
		const events = vi.fn();
		host.addEventListener("beforechange", events);

		option.click();
		expect(input.value).toBe("Par");
		expect(events).not.toHaveBeenCalled();
	});

	test("does not accept an Autocomplete option while its native input is readonly", () => {
		const names = define();
		const host = document.createElement(names.autocomplete) as AutocompleteElement;
		const input = document.createElement("input");
		input.value = "Par";
		input.readOnly = true;
		const option = createOption(names.option, "paris", "Paris");
		host.append(input, createPopup(option));
		append(host);
		const events = vi.fn();
		host.addEventListener("beforechange", events);

		option.click();
		expect(input.value).toBe("Par");
		expect(events).not.toHaveBeenCalled();
	});

	test("abandons an Autocomplete proposal when beforechange makes the input readonly", () => {
		const names = define();
		const host = document.createElement(names.autocomplete) as AutocompleteElement;
		const input = document.createElement("input");
		input.value = "Par";
		const option = createOption(names.option, "paris", "Paris");
		host.append(input, createPopup(option));
		append(host);
		const events: string[] = [];
		host.addEventListener("beforechange", () => {
			events.push("beforechange");
			input.readOnly = true;
		});
		input.addEventListener("input", () => events.push("input"));
		input.addEventListener("change", () => events.push("change"));

		option.click();
		expect(input.value).toBe("Par");
		expect(events).toEqual(["beforechange"]);
	});

	test("does not expose an active descendant when Combobox popup opening is canceled", async () => {
		const names = define();
		const host = document.createElement(names.combobox) as ComboboxElement;
		const input = document.createElement("input");
		const popup = createPopup(createOption(names.option, "one"));
		host.append(input, popup);
		append(host);
		const cancelOpen = (event: ToggleEvent): void => {
			if (event.newState === "open") {
				event.preventDefault();
			}
		};
		popup.addEventListener("beforetoggle", cancelOpen);
		input.focus();

		await userEvent.keyboard("{ArrowDown}");
		expect(popup.matches(":popover-open")).toBe(false);
		expect(input.getAttribute("aria-expanded")).toBe("false");
		expect(input.hasAttribute("aria-activedescendant")).toBe(false);
		popup.removeEventListener("beforetoggle", cancelOpen);
		await userEvent.keyboard("{ArrowDown}");
		expect(popup.matches(":popover-open")).toBe(true);
		expect(input.hasAttribute("aria-activedescendant")).toBe(true);
	});

	test("does not expose an active descendant when Autocomplete popup opening is canceled", async () => {
		const names = define();
		const host = document.createElement(names.autocomplete) as AutocompleteElement;
		const input = document.createElement("input");
		const popup = createPopup(createOption(names.option, "one"));
		host.append(input, popup);
		append(host);
		const cancelOpen = (event: ToggleEvent): void => {
			if (event.newState === "open") {
				event.preventDefault();
			}
		};
		popup.addEventListener("beforetoggle", cancelOpen);
		input.focus();

		await userEvent.keyboard("{ArrowDown}");
		expect(popup.matches(":popover-open")).toBe(false);
		expect(input.getAttribute("aria-expanded")).toBe("false");
		expect(input.hasAttribute("aria-activedescendant")).toBe(false);
		popup.removeEventListener("beforetoggle", cancelOpen);
		await userEvent.keyboard("{ArrowDown}");
		expect(popup.matches(":popover-open")).toBe(true);
		expect(input.hasAttribute("aria-activedescendant")).toBe(true);
	});

	test("abandons a proposal whose option is removed during beforechange", () => {
		const names = define();
		const host = document.createElement(names.select) as SelectElement;
		const button = document.createElement("button");
		const proposed = createOption(names.option, "one");
		host.append(button, createPopup(proposed));
		append(host);
		const events: string[] = [];
		host.addEventListener("beforechange", () => {
			events.push("beforechange");
			proposed.remove();
		});
		host.addEventListener("input", () => events.push("input"));
		host.addEventListener("change", () => events.push("change"));

		proposed.click();
		expect(host.values).toEqual([]);
		expect(events).toEqual(["beforechange"]);
	});

	test("abandons a proposal when the FACE host is reassociated during beforechange", () => {
		const names = define();
		const firstForm = append(document.createElement("form"));
		const secondForm = append(document.createElement("form"));
		firstForm.id = crypto.randomUUID();
		secondForm.id = crypto.randomUUID();
		const host = document.createElement(names.select) as SelectElement;
		host.name = "region";
		host.setAttribute("form", firstForm.id);
		const proposed = createOption(names.option, "east");
		host.append(document.createElement("button"), createPopup(proposed));
		append(host);
		const events: string[] = [];
		host.addEventListener("beforechange", () => {
			events.push("beforechange");
			host.setAttribute("form", secondForm.id);
		});
		host.addEventListener("input", () => events.push("input"));
		host.addEventListener("change", () => events.push("change"));

		proposed.click();
		expect(host.values).toEqual([]);
		expect([...new FormData(firstForm)]).toEqual([]);
		expect([...new FormData(secondForm)]).toEqual([]);
		expect(events).toEqual(["beforechange"]);
	});

	test("abandons a proposal when the FACE host is adopted during beforechange", () => {
		const names = define();
		const host = document.createElement(names.select) as SelectElement;
		const proposed = createOption(names.option, "one");
		host.append(document.createElement("button"), createPopup(proposed));
		append(host);
		const frame = append(document.createElement("iframe"));
		const frameDocument = frame.contentDocument;
		if (!frameDocument) {
			throw new Error("Same-origin iframe document is unavailable");
		}
		const events: string[] = [];
		host.addEventListener("beforechange", () => {
			events.push("beforechange");
			frameDocument.body.append(frameDocument.adoptNode(host));
		});
		host.addEventListener("input", () => events.push("input"));
		host.addEventListener("change", () => events.push("change"));

		proposed.click();
		expect(host.values).toEqual([]);
		expect(events).toEqual(["beforechange"]);
	});

	test("does not emit change after an input listener disconnects an accepted field", () => {
		const names = define();
		const host = document.createElement(names.select) as SelectElement;
		const button = document.createElement("button");
		const proposed = createOption(names.option, "one");
		host.append(button, createPopup(proposed));
		append(host);
		const events: string[] = [];
		host.addEventListener("input", () => {
			events.push("input");
			host.remove();
		});
		host.addEventListener("change", () => events.push("change"));

		proposed.click();
		expect(host.values).toEqual(["one"]);
		expect(events).toEqual(["input"]);
	});

	test("prevents a post-input option click from nesting a second selection transaction", () => {
		const names = define();
		const host = document.createElement(names.select) as SelectElement;
		const button = document.createElement("button");
		const first = createOption(names.option, "one");
		const second = createOption(names.option, "two");
		host.append(button, createPopup(first, second));
		append(host);
		const events: string[] = [];
		host.addEventListener("beforechange", () => events.push("beforechange"));
		host.addEventListener(
			"input",
			() => {
				events.push("input");
				second.click();
			},
			{ once: true },
		);
		host.addEventListener("change", () => events.push("change"));

		first.click();
		expect(host.values).toEqual(["one"]);
		expect(events).toEqual(["beforechange", "input", "change"]);
	});

	test("does not mutate a stale Autocomplete input after beforechange", () => {
		const names = define();
		const host = document.createElement(names.autocomplete) as AutocompleteElement;
		const input = document.createElement("input");
		input.value = "Par";
		const proposed = createOption(names.option, "paris", "Paris");
		host.append(input, createPopup(proposed));
		append(host);
		const events: string[] = [];
		host.addEventListener("beforechange", () => {
			events.push("beforechange");
			proposed.remove();
		});
		input.addEventListener("input", () => events.push("input"));
		input.addEventListener("change", () => events.push("change"));

		proposed.click();
		expect(input.value).toBe("Par");
		expect(events).toEqual(["beforechange"]);
	});

	test("does not mutate an Autocomplete input replaced during beforechange", () => {
		const names = define();
		const host = document.createElement(names.autocomplete) as AutocompleteElement;
		const input = document.createElement("input");
		input.value = "Par";
		const replacement = document.createElement("input");
		replacement.value = "replacement";
		const proposed = createOption(names.option, "paris", "Paris");
		host.append(input, createPopup(proposed));
		append(host);
		const events: string[] = [];
		host.addEventListener("beforechange", () => {
			events.push("beforechange");
			input.replaceWith(replacement);
		});
		input.addEventListener("input", () => events.push("input"));
		input.addEventListener("change", () => events.push("change"));
		replacement.addEventListener("input", () => events.push("replacement-input"));
		replacement.addEventListener("change", () => events.push("replacement-change"));

		proposed.click();
		expect(input.value).toBe("Par");
		expect(replacement.value).toBe("replacement");
		expect(events).toEqual(["beforechange"]);
	});

	test("preserves an Autocomplete input value authored during beforechange", () => {
		const names = define();
		const host = document.createElement(names.autocomplete) as AutocompleteElement;
		const input = document.createElement("input");
		input.value = "Par";
		const proposed = createOption(names.option, "paris", "Paris");
		host.append(input, createPopup(proposed));
		append(host);
		const events: string[] = [];
		host.addEventListener("beforechange", () => {
			events.push("beforechange");
			input.value = "listener value";
		});
		input.addEventListener("input", () => events.push("input"));
		input.addEventListener("change", () => events.push("change"));

		proposed.click();
		expect(input.value).toBe("listener value");
		expect(events).toEqual(["beforechange"]);
	});

	test("uses current option defaults on reset without changing dirty selection early", async () => {
		const names = define();
		const form = document.createElement("form");
		const host = document.createElement(names.combobox) as ComboboxElement;
		const input = document.createElement("input");
		const first = createOption(names.option, "one");
		first.defaultSelected = true;
		const second = createOption(names.option, "two");
		host.append(input, createPopup(first, second));
		form.append(host);
		append(form);
		host.values = [];
		first.defaultSelected = false;
		second.defaultSelected = true;
		await nextMicrotask();

		expect(host.values).toEqual([]);
		form.reset();
		expect(host.values).toEqual(["two"]);
	});

	test("keeps dirty current option selectedness when defaults change synchronously", () => {
		const names = define();
		const host = document.createElement(names.combobox) as ComboboxElement;
		const first = createOption(names.option, "one");
		first.defaultSelected = true;
		const second = createOption(names.option, "two");
		host.append(document.createElement("input"), createPopup(first, second));
		append(host);
		host.values = ["one"];

		first.defaultSelected = false;
		second.defaultSelected = true;
		expect(first.selected).toBe(true);
		expect(second.selected).toBe(false);
		expect(host.values).toEqual(["one"]);
	});

	test("updates FACE form data synchronously when a selected option value changes", () => {
		const names = define();
		const form = document.createElement("form");
		const host = document.createElement(names.select) as SelectElement;
		host.name = "service";
		const selected = createOption(names.option, "one");
		selected.defaultSelected = true;
		host.append(document.createElement("button"), createPopup(selected));
		form.append(host);
		append(form);
		expect([...new FormData(form)]).toEqual([["service", "one"]]);

		selected.value = "renamed";
		expect([...new FormData(form)]).toEqual([["service", "renamed"]]);
		expect(host.values).toEqual(["renamed"]);
	});

	test("clamps a dirty multiple selection immediately when multiple is removed", () => {
		const names = define();
		const host = document.createElement(names.combobox) as ComboboxElement;
		host.multiple = true;
		const first = createOption(names.option, "one");
		const second = createOption(names.option, "two");
		host.append(document.createElement("input"), createPopup(first, second));
		append(host);
		host.values = ["one", "two"];

		host.multiple = false;
		expect(host.values).toEqual(["one"]);
		expect(first.selected).toBe(true);
		expect(second.selected).toBe(false);
	});

	test("restores frozen DOM-order values without emitting user events", () => {
		const names = define();
		const host = document.createElement(names.combobox) as ComboboxElement;
		host.multiple = true;
		host.append(
			document.createElement("input"),
			createPopup(createOption(names.option, "one"), createOption(names.option, "two")),
		);
		append(host);
		const events = vi.fn();
		host.addEventListener("input", events);
		host.addEventListener("change", events);

		host.formStateRestoreCallback(JSON.stringify(["two", "one"]), "restore");
		expect(host.values).toEqual(["one", "two"]);
		expect(Object.isFrozen(host.values)).toBe(true);
		expect(events).not.toHaveBeenCalled();
	});

	test("does not accept an active option after it becomes hidden", async () => {
		const names = define();
		const host = document.createElement(names.combobox) as ComboboxElement;
		const input = document.createElement("input");
		const first = createOption(names.option, "one");
		const popup = createPopup(first, createOption(names.option, "two"));
		host.append(input, popup);
		append(host);
		input.focus();
		await userEvent.keyboard("{ArrowDown}");
		first.hidden = true;
		await nextMicrotask();
		expect(input.getAttribute("aria-activedescendant")).not.toBe(first.id);

		await userEvent.keyboard("{Enter}");
		expect(host.values).not.toContain("one");
	});

	test("hides filtered Autocomplete options and preserves authored hidden state", () => {
		const names = define();
		const host = document.createElement(names.autocomplete) as AutocompleteElement;
		const input = document.createElement("input");
		const paris = createOption(names.option, "paris", "Paris");
		const rome = createOption(names.option, "rome", "Rome");
		const authoredHidden = createOption(names.option, "parma", "Parma");
		authoredHidden.hidden = true;
		host.append(input, createPopup(paris, rome, authoredHidden));
		append(host);

		input.value = "par";
		dispatchInput(input);
		expect(paris.hidden).toBe(false);
		expect(rome.hidden).toBe(true);
		expect(authoredHidden.hidden).toBe(true);
		input.value = "";
		dispatchInput(input);
		expect(rome.hidden).toBe(false);
		expect(authoredHidden.hidden).toBe(true);
	});

	test("refilters Autocomplete after a fallback label text node changes", async () => {
		const names = define();
		const host = document.createElement(names.autocomplete) as AutocompleteElement;
		const input = document.createElement("input");
		const option = createOption(names.option, "destination", "Paris");
		host.append(input, createPopup(option));
		append(host);
		input.value = "par";
		dispatchInput(input);
		expect(option.hidden).toBe(false);
		const label = option.firstChild;
		if (!(label instanceof Text)) {
			throw new Error("Expected the option fallback label to be a text node");
		}

		label.data = "Rome";
		await nextMicrotask();
		expect(option.hidden).toBe(true);
		label.data = "Paris";
		await nextMicrotask();
		expect(option.hidden).toBe(false);
	});

	test("exposes multiple and disabled listbox semantics on the owned nodes", () => {
		const names = define();
		const host = document.createElement(names.combobox) as ComboboxElement;
		host.multiple = true;
		const disabled = createOption(names.option, "disabled");
		disabled.disabled = true;
		const popup = createPopup(disabled);
		host.append(document.createElement("input"), popup);
		append(host);

		expect(popup.getAttribute("aria-multiselectable")).toBe("true");
		expect(disabled.getAttribute("aria-disabled")).toBe("true");
	});

	test("allocates generated label, listbox, and option IDs without document collisions", () => {
		const names = define();
		const firstFixture = document.createElement("div");
		const firstLabel = document.createElement("label");
		const firstHost = document.createElement(names.combobox) as ComboboxElement;
		firstHost.id = crypto.randomUUID();
		firstLabel.htmlFor = firstHost.id;
		const firstInput = document.createElement("input");
		const firstOption = createOption(names.option, "one");
		const firstPopup = createPopup(firstOption);
		firstHost.append(firstInput, firstPopup);
		firstFixture.append(firstLabel, firstHost);
		append(firstFixture);
		const nextId = (id: string): string => id.replace(/(\d+)$/, (number) => String(Number(number) + 1));
		const blockedLabelId = nextId(firstLabel.id);
		const blockedPopupId = nextId(firstPopup.id);
		const blockedOptionId = nextId(firstOption.id);
		const blockers = document.createElement("div");
		for (const id of [blockedLabelId, blockedPopupId, blockedOptionId]) {
			const blocker = document.createElement("span");
			blocker.id = id;
			blockers.append(blocker);
		}
		append(blockers);

		const secondFixture = document.createElement("div");
		const secondLabel = document.createElement("label");
		const secondHost = document.createElement(names.combobox) as ComboboxElement;
		secondHost.id = crypto.randomUUID();
		secondLabel.htmlFor = secondHost.id;
		const secondInput = document.createElement("input");
		const secondOption = createOption(names.option, "two");
		const secondPopup = createPopup(secondOption);
		secondHost.append(secondInput, secondPopup);
		secondFixture.append(secondLabel, secondHost);
		append(secondFixture);

		expect(secondLabel.id).not.toBe(blockedLabelId);
		expect(secondPopup.id).not.toBe(blockedPopupId);
		expect(secondOption.id).not.toBe(blockedOptionId);
		expect(document.getElementById(secondPopup.id)).toBe(secondPopup);
		expect(document.getElementById(secondOption.id)).toBe(secondOption);
		expect(secondInput.getAttribute("aria-controls")).toBe(secondPopup.id);
	});

	test("restores popup attributes when the owned popup is replaced and disconnected", async () => {
		const names = define();
		const host = document.createElement(names.combobox) as ComboboxElement;
		const first = createPopup(createOption(names.option, "one"));
		const second = createPopup(createOption(names.option, "two"));
		host.append(document.createElement("input"), first);
		append(host);
		await nextMicrotask();

		first.replaceWith(second);
		await nextMicrotask();
		expect(first.getAttribute("popover")).toBe("manual");
		host.remove();
		expect(second.getAttribute("popover")).toBe("manual");
	});

	test("owns and restores each Select button type across replacement", async () => {
		const names = define();
		const host = document.createElement(names.select) as SelectElement;
		const first = document.createElement("button");
		first.type = "submit";
		const popup = createPopup(createOption(names.option, "one"));
		host.append(first, popup);
		append(host);
		expect(first.type).toBe("button");

		const second = document.createElement("button");
		second.type = "submit";
		first.replaceWith(second);
		await nextMicrotask();
		expect(first.type).toBe("submit");
		expect(second.type).toBe("button");
		host.remove();
		expect(second.type).toBe("submit");
	});

	test("invalidates outer ownership when a nested selection owner upgrades late", async () => {
		const optionName = nextName("option");
		const outerName = nextName("combobox");
		const nestedName = nextName("combobox-nested");
		customElements.define(optionName, class extends OptionElement {});
		customElements.define(outerName, class extends ComboboxElement {});
		const form = document.createElement("form");
		const outer = document.createElement(outerName) as ComboboxElement;
		outer.name = "outer";
		const outerInput = document.createElement("input");
		const outerPopup = createPopup();
		const nested = document.createElement(nestedName);
		const nestedInput = document.createElement("input");
		const nestedDefault = createOption(optionName, "nested");
		nestedDefault.defaultSelected = true;
		nested.append(nestedInput, nestedDefault);
		outerPopup.append(nested);
		outer.append(outerInput, outerPopup);
		form.append(outer);
		append(form);
		await nextMicrotask();
		expect([...new FormData(form)]).toEqual([["outer", "nested"]]);

		customElements.define(nestedName, class extends ComboboxElement {});
		await nextMicrotask();
		expect([...new FormData(form)]).toEqual([]);
		expect(outer.values).toEqual([]);
	});

	test("rebinds exactly once after same-origin adoption", () => {
		const names = define();
		const host = document.createElement(names.combobox) as ComboboxElement;
		host.name = "service";
		const input = document.createElement("input");
		const selected = createOption(names.option, "one");
		const popup = createPopup(selected);
		host.append(input, popup);
		append(host);
		const frame = append(document.createElement("iframe"));
		const frameDocument = frame.contentDocument;
		const frameWindow = frame.contentWindow;
		if (!frameDocument || !frameWindow) {
			throw new Error("Same-origin iframe is unavailable");
		}
		const constructors = frameWindow as unknown as Pick<typeof globalThis, "FormData" | "KeyboardEvent">;
		const form = frameDocument.createElement("form");
		frameDocument.body.append(form);
		form.append(frameDocument.adoptNode(host));
		const events: string[] = [];
		host.addEventListener("beforechange", () => events.push("beforechange"));
		host.addEventListener("input", () => events.push("input"));
		host.addEventListener("change", () => events.push("change"));

		input.dispatchEvent(
			new constructors.KeyboardEvent("keydown", { bubbles: true, cancelable: true, key: "ArrowDown" }),
		);
		input.dispatchEvent(
			new constructors.KeyboardEvent("keydown", { bubbles: true, cancelable: true, key: "Enter" }),
		);
		expect(host.values).toEqual(["one"]);
		expect(events).toEqual(["beforechange", "input", "change"]);
		expect([...new constructors.FormData(form)]).toEqual([["service", "one"]]);
	});

	test("reallocates an option ID that collides after same-origin adoption", () => {
		const names = define();
		const host = document.createElement(names.combobox) as ComboboxElement;
		const input = document.createElement("input");
		const option = createOption(names.option, "one");
		host.append(input, createPopup(option));
		append(host);
		const originalId = option.id;
		expect(originalId).not.toBe("");

		const frame = append(document.createElement("iframe"));
		const frameDocument = frame.contentDocument;
		const frameWindow = frame.contentWindow;
		if (!frameDocument || !frameWindow) {
			throw new Error("Same-origin iframe is unavailable");
		}
		const blocker = frameDocument.createElement("span");
		blocker.id = originalId;
		frameDocument.body.append(blocker, frameDocument.adoptNode(host));
		const { KeyboardEvent: KeyboardEventConstructor } = frameWindow as unknown as Pick<
			typeof globalThis,
			"KeyboardEvent"
		>;

		input.dispatchEvent(
			new KeyboardEventConstructor("keydown", { bubbles: true, cancelable: true, key: "ArrowDown" }),
		);
		expect(option.id).not.toBe(originalId);
		expect(frameDocument.getElementById(option.id)).toBe(option);
		expect(input.getAttribute("aria-activedescendant")).toBe(option.id);
	});
});
