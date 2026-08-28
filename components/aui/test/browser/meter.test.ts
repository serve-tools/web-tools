import { afterEach, describe, expect, test } from "vitest";
import { MeterElement } from "../../src/meter-element.js";

const fixtures: Node[] = [];

afterEach(() => {
	for (const fixture of fixtures.splice(0).reverse()) {
		fixture.parentNode?.removeChild(fixture);
	}
});

const defineMeter = (): { element: MeterElement; name: string } => {
	const name = `aui-meter-${crypto.randomUUID()}`;
	customElements.define(name, class extends MeterElement {});
	return { element: document.createElement(name) as MeterElement, name };
};

const append = <T extends Node>(node: T): T => {
	document.body.append(node);
	fixtures.push(node);
	return node;
};

describe("MeterElement", () => {
	test("matches native meter defaults, invalid attributes, and range clamping", () => {
		const { element } = defineMeter();
		const native = document.createElement("meter");

		for (const attributes of [
			{},
			{ min: "10", max: "5", value: "100", low: "20", high: "-5", optimum: "Infinity" },
			{ min: "-10", max: "10", value: "-20", low: "-8", high: "8", optimum: "0" },
			{ min: "bad", max: "bad", value: "bad", low: "bad", high: "bad", optimum: "bad" },
		] as const) {
			for (const name of MeterElement.observedAttributes) {
				element.removeAttribute(name);
				native.removeAttribute(name);
			}
			for (const [name, value] of Object.entries(attributes)) {
				element.setAttribute(name, value);
				native.setAttribute(name, value);
			}

			expect([element.min, element.max, element.value, element.low, element.high, element.optimum]).toEqual([
				native.min,
				native.max,
				native.value,
				native.low,
				native.high,
				native.optimum,
			]);
		}
	});

	test("reflects numeric property writes through native IDL", () => {
		const { element } = defineMeter();
		const native = document.createElement("meter");
		for (const [property, value] of [
			["min", -5],
			["max", 20],
			["value", 40],
			["low", 2],
			["high", 18],
			["optimum", 10],
		] as const) {
			element[property] = value;
			native[property] = value;
			expect(element.getAttribute(property)).toBe(native.getAttribute(property));
			expect(element[property]).toBe(native[property]);
		}

		for (const value of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
			expect(() => (element.value = value)).toThrow(TypeError);
			expect(() => (native.value = value)).toThrow(TypeError);
		}
		expect(() => ((element as unknown as { value: bigint }).value = 1n)).toThrow(TypeError);
		expect(() => ((native as unknown as { value: bigint }).value = 1n)).toThrow(TypeError);
	});

	test("keeps one named host accessibility identity and a presentational native visual", () => {
		const { element } = defineMeter();
		const label = document.createElement("span");
		label.id = crypto.randomUUID();
		label.textContent = "Battery";
		element.setAttribute("aria-labelledby", label.id);
		element.setAttribute("aria-valuetext", "Half full");
		element.min = 0;
		element.max = 10;
		element.value = 5;
		const fixture = append(document.createElement("div"));
		fixture.append(label, element);

		expect(element.getAttribute("aria-labelledby")).toBe(label.id);
		expect(element.getAttribute("aria-valuetext")).toBe("Half full");
		expect(element.meter.getAttribute("aria-hidden")).toBe("true");
		expect(element.meter.hasAttribute("aria-labelledby")).toBe(false);
		expect(element.meter.hasAttribute("aria-valuetext")).toBe(false);
		expect(element.meter.getAttribute("part")).toBe("meter");
		expect(element.tabIndex).toBe(-1);
	});

	test("surfaces native optimum quality as mutually exclusive custom states", () => {
		const { element } = defineMeter();
		element.min = 0;
		element.max = 100;
		element.low = 30;
		element.high = 70;
		element.optimum = 10;

		element.value = 20;
		expect(element.matches(":state(optimum)")).toBe(true);
		element.value = 50;
		expect(element.matches(":state(suboptimal)")).toBe(true);
		element.value = 90;
		expect(element.matches(":state(even-less-good)")).toBe(true);
		expect(element.matches(":state(optimum)")).toBe(false);
	});

	test("retains native identity through disconnect and document adoption", () => {
		const { element } = defineMeter();
		element.textContent = "Visible label";
		append(element);
		const meter = element.meter;
		const slot = element.shadowRoot?.querySelector("slot");
		element.remove();
		document.body.append(element);
		expect(element.meter).toBe(meter);
		expect(element.shadowRoot?.querySelector("slot")).toBe(slot);
		expect(element.textContent).toBe("Visible label");

		const frame = append(document.createElement("iframe"));
		const frameDocument = frame.contentDocument;
		if (!frameDocument) {
			throw new Error("Same-origin iframe document is unavailable");
		}
		frameDocument.body.append(frameDocument.adoptNode(element));
		expect(element.meter).toBe(meter);
		expect(element.meter.ownerDocument).toBe(frameDocument);
	});

	test("upgrades parser attributes and pre-upgrade properties", () => {
		const fixture = append(document.createElement("div"));
		const lateName = `aui-meter-${crypto.randomUUID()}`;
		fixture.insertAdjacentHTML("beforeend", `<${lateName} min="1" max="9" value="2"></${lateName}>`);
		const late = fixture.lastElementChild as MeterElement;
		Object.defineProperty(late, "value", { configurable: true, value: 7 });
		customElements.define(lateName, class extends MeterElement {});

		expect(late).toBeInstanceOf(MeterElement);
		expect(Object.hasOwn(late, "value")).toBe(false);
		expect(late.min).toBe(1);
		expect(late.max).toBe(9);
		expect(late.value).toBe(7);
	});
});
