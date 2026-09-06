import { afterEach, describe, expect, test } from "vitest";
import { userEvent } from "vitest/browser";
import { CalendarElement } from "../../src/CalendarElement.js";

const fixtures: Node[] = [];

afterEach(() => {
	for (const fixture of fixtures.splice(0).reverse()) {
		fixture.parentNode?.removeChild(fixture);
	}
});

const calendar = (): CalendarElement => {
	const name = `base-calendar-${crypto.randomUUID()}`;
	customElements.define(name, class extends CalendarElement {});
	const element = document.createElement(name) as CalendarElement;
	document.body.append(element);
	fixtures.push(element);
	return element;
};

describe("CalendarElement", () => {
	test("uses Gregorian plain-date contracts and a retained 42-day native-button grid", () => {
		const element = calendar();
		const label = element.shadowRoot?.querySelector<HTMLElement>("#month");
		const grid = element.shadowRoot?.querySelector<HTMLElement>('[role="grid"]');
		expect(label?.textContent).toMatch(/\d/u);
		expect(grid?.getAttribute("aria-labelledby")).toBe(label?.id);
		expect(label?.textContent?.trim()).not.toBe("");
		element.month = "0000-02";
		element.value = "0000-02-29";
		expect(element.value).toBe("0000-02-29");
		expect(element.month).toBe("0000-02");
		expect(element.shadowRoot?.querySelectorAll("button[role=gridcell]")).toHaveLength(42);
		expect(() => (element.value = "2026-02-29")).toThrow(TypeError);
		expect(() => (element.weekStartsOn = 7)).toThrow(TypeError);
	});

	test("proposes frozen user selections before native-style input and change", async () => {
		const element = calendar();
		element.month = "2026-08";
		const events: string[] = [];
		let proposal: CustomEvent | undefined;
		element.addEventListener("beforechange", (event) => {
			proposal = event;
			events.push("beforechange");
		});
		element.addEventListener("input", () => events.push("input"));
		element.addEventListener("change", () => events.push("change"));
		const button = element.shadowRoot?.querySelector<HTMLButtonElement>('button[data-value="2026-08-28"]');
		if (!button) {
			throw new Error("Expected August 28 grid button");
		}
		await userEvent.click(button);
		expect(proposal?.detail).toEqual({ value: "2026-08-28", sourceEvent: expect.any(MouseEvent) });
		expect(Object.isFrozen(proposal?.detail)).toBe(true);
		expect(element.value).toBe("2026-08-28");
		expect(events).toEqual(["beforechange", "input", "change"]);
	});

	test("keeps user selection cancellable and supports RTL keyboard movement", async () => {
		const element = calendar();
		element.month = "2026-08";
		element.value = "2026-08-15";
		element.style.direction = "rtl";
		element.addEventListener("beforechange", (event) => event.preventDefault(), { once: true });
		const selected = element.shadowRoot?.querySelector<HTMLButtonElement>('button[data-value="2026-08-15"]');
		if (!selected) {
			throw new Error("Expected selected grid button");
		}
		await userEvent.click(selected);
		expect(element.value).toBe("2026-08-15");
		selected.focus();
		await userEvent.keyboard("{ArrowLeft}");
		expect(element.focusDate).toBe("2026-08-16");
	});

	test("abandons a selection when beforechange authors a competing value", async () => {
		const element = calendar();
		element.month = "2026-08";
		const events: string[] = [];
		element.addEventListener("beforechange", () => (element.value = "2026-08-01"), { once: true });
		element.addEventListener("input", () => events.push("input"));
		const button = element.shadowRoot?.querySelector<HTMLButtonElement>('button[data-value="2026-08-28"]');
		if (!button) {
			throw new Error("Expected August 28 grid button");
		}
		await userEvent.click(button);
		expect(element.value).toBe("2026-08-01");
		expect(events).toEqual([]);
	});

	test("does not emit stale postevents after input mutation or connection replacement", async () => {
		const element = calendar();
		element.month = "2026-08";
		const events: string[] = [];
		element.addEventListener(
			"input",
			() => {
				events.push("input");
				element.value = "2026-08-03";
			},
			{ once: true },
		);
		element.addEventListener("change", () => events.push("change"));
		const button = element.shadowRoot?.querySelector<HTMLButtonElement>('button[data-value="2026-08-02"]');
		if (!button) {
			throw new Error("Expected August 2 grid button");
		}
		await userEvent.click(button);
		expect(element.value).toBe("2026-08-03");
		expect(events).toEqual(["input"]);
		element.addEventListener(
			"beforechange",
			() => {
				element.remove();
				document.body.append(element);
			},
			{ once: true },
		);
		await userEvent.click(button);
		expect(element.value).toBe("2026-08-03");
	});

	test("keeps roving focus in the visible enabled grid and clamps year boundaries", async () => {
		const element = calendar();
		element.showMonth("2026-08");
		element.focusDate = "2026-08-28";
		element.showMonth("2026-09");
		expect(element.focusDate.startsWith("2026-09")).toBe(true);
		expect(element.shadowRoot?.querySelectorAll('button[tabindex="0"]')).toHaveLength(1);
		element.focusDate = "0000-01-01";
		await userEvent.keyboard("{ArrowLeft}");
		expect(element.focusDate).toBe("0000-01-01");
		element.disabled = true;
		await userEvent.keyboard("{ArrowRight}");
		expect(element.focusDate).toBe("0000-01-01");
		expect(element.shadowRoot?.querySelectorAll('button[disabled][tabindex="0"]')).toHaveLength(0);
		expect(element.shadowRoot?.querySelectorAll('[role="grid"] > [role="row"]')).toHaveLength(7);
		expect(element.shadowRoot?.querySelector<HTMLButtonElement>("button")?.part.contains("day")).toBe(true);
	});

	test("disables retained grid cells outside the supported ISO year range and labels year zero with an era", async () => {
		const element = calendar();
		element.month = "0000-01";
		const first = element.shadowRoot?.querySelector<HTMLButtonElement>("button");
		if (!first) {
			throw new Error("Expected retained leading grid button");
		}
		expect(first.disabled).toBe(true);
		expect(first.dataset.value).toBe("");
		expect(first.getAttribute("aria-label")).toMatch(/BC|BCE|Before Christ/u);
		first.dispatchEvent(new MouseEvent("click", { bubbles: true, composed: true }));
		expect(element.value).toBe("");
		element.month = "9999-12";
		const last = element.shadowRoot?.querySelectorAll<HTMLButtonElement>("button").item(41);
		if (!last) {
			throw new Error("Expected retained trailing grid button");
		}
		expect(last.disabled).toBe(true);
		expect(last.dataset.value).toBe("");
	});

	test("recovers pre-upgrade focus and falls back safely from invalid locale markup", () => {
		const name = `base-calendar-${crypto.randomUUID()}`;
		const fixture = document.createElement("div");
		fixture.innerHTML = `<${name} month="2026-08" locale="not a locale"></${name}>`;
		const element = fixture.firstElementChild as CalendarElement;
		Object.defineProperty(element, "focusDate", { configurable: true, value: "2026-08-15" });
		customElements.define(name, class extends CalendarElement {});
		document.body.append(fixture);
		fixtures.push(fixture);
		expect(element.focusDate).toBe("2026-08-15");
		expect(element.locale).toBe("en-US");
		expect(() => (element.locale = "not a locale")).toThrow(TypeError);
	});

	test("keeps localized labels Gregorian when the locale requests another calendar", () => {
		const element = calendar();
		element.locale = "en-US-u-ca-islamic";
		element.month = "2026-08";
		const label = element.shadowRoot?.querySelector("#month")?.textContent;
		const expected = new Intl.DateTimeFormat(element.locale, {
			calendar: "gregory",
			era: "short",
			month: "long",
			timeZone: "UTC",
			year: "numeric",
		}).format(new Date(Date.UTC(2026, 7, 1)));
		expect(label).toBe(expected);
		element.month = "0000-01";
		expect(element.shadowRoot?.querySelector("#month")?.textContent).toMatch(/BC|BCE|Before Christ/u);
	});
});
