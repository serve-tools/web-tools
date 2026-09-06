import { afterEach, describe, expect, test, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { TabsElement } from "../../src/TabsElement.js";

const fixtures: Element[] = [];
const mutation = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

afterEach(() => {
	for (const fixture of fixtures.splice(0).reverse()) {
		fixture.remove();
	}
	vi.restoreAllMocks();
});

interface TabsFixture {
	element: TabsElement;
	panels: HTMLElement[];
	tablist: HTMLElement;
	tabs: HTMLButtonElement[];
}

const create = (values = ["overview", "settings", "billing"]): TabsFixture => {
	const name = `base-tabs-test-${crypto.randomUUID()}`;
	customElements.define(name, class extends TabsElement {});
	const element = document.createElement(name) as TabsElement;
	const tablist = document.createElement("nav");
	tablist.slot = "tablist";
	tablist.setAttribute("aria-label", "Account sections");
	const tabs = values.map((value) => {
		const tab = document.createElement("button");
		tab.value = value;
		tab.textContent = value;
		return tab;
	});
	const panels = values.map((value) => {
		const panel = document.createElement("section");
		panel.slot = "panel";
		panel.textContent = `${value} panel`;
		return panel;
	});

	tablist.append(...tabs);
	element.append(tablist, ...panels);
	document.body.append(element);
	fixtures.push(element);
	return { element, panels, tablist, tabs };
};

const key = (target: Element, value: string): boolean =>
	target.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, cancelable: true, composed: true, key: value }));

describe("TabsElement", () => {
	test("does not move focus when a tab list is initialized", () => {
		const input = document.createElement("input");
		fixtures.push(input);
		document.body.append(input);
		input.focus();
		const { element } = create();
		expect(element.selectedIndex).toBe(0);
		expect(document.activeElement).toBe(input);
	});

	test("links direct child buttons and stable panels while restoring released author attributes", async () => {
		const { element, panels, tablist, tabs } = create();
		const selectedPanel = panels[0];

		expect(element.hasAttribute("role")).toBe(false);
		expect(element.tablist).toBe(tablist);
		expect(tablist.role).toBe("tablist");
		expect(tablist.getAttribute("aria-label")).toBe("Account sections");
		expect(tablist.getAttribute("aria-orientation")).toBe("horizontal");
		expect(element.selectedIndex).toBe(0);
		expect(element.value).toBe("overview");
		expect(element.selectedTab).toBe(tabs[0]);
		expect(element.selectedPanel).toBe(selectedPanel);
		expect(tabs.map((tab) => tab.role)).toEqual(["tab", "tab", "tab"]);
		expect(tabs.map((tab) => tab.tabIndex)).toEqual([0, -1, -1]);
		expect(tabs[0].getAttribute("aria-controls")).toBe(panels[0].id);
		expect(panels[0].getAttribute("aria-labelledby")).toBe(tabs[0].id);
		expect(panels.map((panel) => panel.hidden)).toEqual([false, true, true]);

		element.selectedIndex = 2;
		expect(element.selectedPanel).toBe(panels[2]);
		expect(panels[0]).toBe(selectedPanel);
		expect(panels.map((panel) => panel.hidden)).toEqual([true, true, false]);

		tabs[1].setAttribute("role", "menuitem");
		tabs[1].tabIndex = 7;
		panels[1].setAttribute("role", "region");
		await mutation();
		tabs[1].remove();
		panels[1].remove();
		await mutation();

		expect(tabs[1].getAttribute("role")).toBe("menuitem");
		expect(tabs[1].tabIndex).toBe(7);
		expect(tabs[1].hasAttribute("type")).toBe(false);
		expect(tabs[1].hasAttribute("aria-controls")).toBe(false);
		expect(panels[1].getAttribute("role")).toBe("region");
		expect(panels[1].hasAttribute("hidden")).toBe(false);
		expect(panels[1].hasAttribute("aria-labelledby")).toBe(false);
	});

	test("keeps programmatic selection silent and emits once for pointer and automatic focus selection", async () => {
		const { element, tabs } = create();
		const events: string[] = [];
		element.addEventListener("input", (event) => {
			events.push(event.type);
			expect(event.bubbles).toBe(true);
			expect(event.composed).toBe(true);
		});
		element.addEventListener("change", (event) => {
			events.push(event.type);
			expect(event.bubbles).toBe(true);
			expect(event.composed).toBe(false);
		});

		expect(element.select("settings")).toBe(true);
		expect(element.value).toBe("settings");
		expect(events).toEqual([]);
		element.value = "billing";
		expect(events).toEqual([]);
		expect(element.select("missing")).toBe(false);

		await userEvent.click(tabs[0]);
		expect(element.value).toBe("overview");
		expect(events).toEqual(["input", "change"]);
		await userEvent.click(tabs[0]);
		expect(events).toEqual(["input", "change"]);

		tabs[2].focus();
		expect(element.value).toBe("billing");
		expect(events).toEqual(["input", "change", "input", "change"]);
		expect(element.focusTab(1)).toBe(true);
		expect(element.value).toBe("settings");
		expect(events).toEqual(["input", "change", "input", "change", "input", "change"]);
		events.length = 0;
		key(tabs[1], "ArrowRight");
		expect(element.value).toBe("billing");
		expect(events).toEqual(["input", "change"]);
	});

	test("supports roving keyboard focus, disabled tabs, vertical orientation, and RTL", () => {
		const { element, tabs } = create();
		tabs[1].disabled = true;
		tabs[0].focus();

		expect(key(tabs[0], "ArrowRight")).toBe(false);
		expect(document.activeElement).toBe(tabs[2]);
		expect(element.value).toBe("billing");
		expect(tabs.map((tab) => tab.tabIndex)).toEqual([-1, -1, 0]);

		expect(key(tabs[2], "Home")).toBe(false);
		expect(document.activeElement).toBe(tabs[0]);
		expect(element.value).toBe("overview");
		tabs[2].focus();
		expect(element.value).toBe("billing");
		expect(element.focusTab(0)).toBe(true);
		expect(element.value).toBe("overview");

		element.dir = "rtl";
		key(tabs[0], "ArrowRight");
		expect(document.activeElement).toBe(tabs[2]);
		expect(element.value).toBe("billing");

		element.orientation = "vertical";
		key(tabs[2], "ArrowDown");
		expect(document.activeElement).toBe(tabs[0]);
		expect(element.value).toBe("overview");
		expect(element.tablist?.getAttribute("aria-orientation")).toBe("vertical");

		tabs[2].setAttribute("aria-disabled", "true");
		tabs[2].click();
		expect(element.value).toBe("overview");
		expect(element.select(tabs[2])).toBe(false);
	});

	test("ignores canceled interaction events", () => {
		const { element, tabs } = create();
		const cancelKey = (event: Event) => event.preventDefault();
		const cancelClick = (event: Event) => event.preventDefault();
		tabs[0].addEventListener("keydown", cancelKey);
		tabs[1].addEventListener("click", cancelClick);

		tabs[0].focus();
		expect(key(tabs[0], "ArrowRight")).toBe(false);
		expect(element.value).toBe("overview");
		expect(document.activeElement).toBe(tabs[0]);
		tabs[1].click();
		expect(element.value).toBe("overview");
	});

	test("manual activation moves focus first and leaves Enter and Space to the native button", async () => {
		const { element, tabs } = create();
		element.activation = "manual";
		tabs[0].focus();

		key(tabs[0], "ArrowRight");
		expect(document.activeElement).toBe(tabs[1]);
		expect(element.value).toBe("overview");
		expect(tabs.map((tab) => tab.tabIndex)).toEqual([-1, 0, -1]);

		await userEvent.keyboard("{Enter}");
		expect(element.value).toBe("settings");
		key(tabs[1], "End");
		expect(element.value).toBe("settings");
		await userEvent.keyboard(" ");
		expect(element.value).toBe("billing");
	});

	test("isolates nested tab lists and ignores keyboard events from embedded controls", () => {
		const outer = create(["first", "second"]);
		const inner = create(["inner-first", "inner-second"]);
		outer.panels[0].append(inner.element);
		const input = document.createElement("input");
		outer.tabs[0].append(input);

		inner.tabs[0].focus();
		key(inner.tabs[0], "ArrowRight");
		expect(inner.element.value).toBe("inner-second");
		expect(outer.element.value).toBe("first");

		input.focus();
		key(input, "ArrowRight");
		expect(outer.element.value).toBe("first");
	});

	test("retains selection through reorder, restores automatic focus, and reconnects without duplicate listeners", async () => {
		const { element, panels, tablist, tabs } = create();
		let changes = 0;
		element.addEventListener("change", () => ++changes);
		element.value = "settings";
		const selectedTab = tabs[1];
		const selectedPanel = panels[1];

		element.prepend(selectedPanel);
		tablist.prepend(selectedTab);
		await mutation();
		expect(element.value).toBe("settings");
		expect(element.selectedTab).toBe(selectedTab);
		expect(element.selectedIndex).toBe(0);
		expect(element.selectedPanel).toBe(selectedPanel);

		selectedTab.focus();
		selectedTab.remove();
		selectedPanel.remove();
		await mutation();
		expect(element.selectedIndex).toBe(0);
		expect(element.value).toBe("overview");
		expect(element.selectedPanel).toBe(panels[0]);
		expect(element.panels.map((panel) => panel.hidden)).toEqual([false, true]);
		expect(document.activeElement).toBe(tabs[0]);
		expect(changes).toBe(1);

		for (let index = 0; index < 3; ++index) {
			element.remove();
			document.body.append(element);
		}

		const remainingPanel = panels[2];
		tabs[2].click();
		expect(changes).toBe(2);
		expect(element.selectedPanel).toBe(remainingPanel);
		expect(panels[2]).toBe(remainingPanel);
	});

	test("clears removed manual selection while returning keyboard focus", async () => {
		const { element, panels, tabs } = create();
		element.activation = "manual";
		element.value = "settings";
		tabs[1].focus();
		tabs[1].remove();
		panels[1].remove();
		await mutation();

		expect(element.selectedIndex).toBe(-1);
		expect(element.selectedPanel).toBeNull();
		expect(element.panels.every((panel) => panel.hidden)).toBe(true);
		expect(document.activeElement).toBe(tabs[2]);
	});

	test("selects the first enabled tab when an initially empty list is populated", async () => {
		const { element, panels, tablist, tabs } = create([]);
		expect(element.selectedIndex).toBe(-1);

		const tab = document.createElement("button");
		tab.value = "later";
		const panel = document.createElement("section");
		panel.slot = "panel";
		tablist.append(tab);
		element.append(panel);
		await mutation();

		expect(element.value).toBe("later");
		expect(element.selectedPanel).toBe(panel);
		expect(tab.getAttribute("aria-controls")).toBe(panel.id);
		expect(tabs).toEqual([]);
		expect(panels).toEqual([]);

		const intentionallyEmpty = create([]);
		intentionallyEmpty.element.selectedIndex = -1;
		const laterTab = document.createElement("button");
		const laterPanel = document.createElement("section");
		laterPanel.slot = "panel";
		intentionallyEmpty.tablist.append(laterTab);
		intentionallyEmpty.element.append(laterPanel);
		await mutation();
		expect(intentionallyEmpty.element.selectedIndex).toBe(-1);
		expect(laterPanel.hidden).toBe(true);
	});

	test("accepts author nodes from another realm and uses the adopted owner document", () => {
		const frame = document.createElement("iframe");
		document.body.append(frame);
		fixtures.push(frame);
		const foreignDocument = frame.contentDocument!;
		const name = `base-tabs-test-${crypto.randomUUID()}`;
		customElements.define(name, class extends TabsElement {});
		const element = document.createElement(name) as TabsElement;
		const tablist = foreignDocument.createElement("div");
		tablist.slot = "tablist";
		const first = foreignDocument.createElement("button");
		first.value = "first";
		const second = foreignDocument.createElement("button");
		second.value = "second";
		const firstPanel = foreignDocument.createElement("section");
		firstPanel.slot = "panel";
		const secondPanel = foreignDocument.createElement("section");
		secondPanel.slot = "panel";
		tablist.append(first, second);
		element.append(tablist, firstPanel, secondPanel);
		document.body.append(element);
		fixtures.push(element);

		expect(first instanceof HTMLButtonElement).toBe(false);
		expect(element.tabs).toEqual([first, second]);
		expect(element.value).toBe("first");
		foreignDocument.body.append(element);
		expect(element.ownerDocument).toBe(foreignDocument);
		expect(element.focusTab(second)).toBe(true);
		expect(foreignDocument.activeElement).toBe(second);
		expect(element.value).toBe("second");
	});
});
