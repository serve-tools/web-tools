import { afterEach, describe, expect, test, vi } from "vitest";
import { SliderElement } from "../../src/SliderElement.js";

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

const define = (): SliderElement => {
	const name = `base-slider-${crypto.randomUUID()}`;
	customElements.define(name, class extends SliderElement {});
	return document.createElement(name) as SliderElement;
};

const range = (name: string, value: number) => {
	const input = document.createElement("input");
	input.type = "range";
	input.name = name;
	input.setAttribute("aria-label", name);
	input.valueAsNumber = value;
	return input;
};

const create = () => {
	const element = define();
	element.min = "0";
	element.max = "100";
	const lower = range("minimum", 20);
	const upper = range("maximum", 80);
	element.append(lower, upper);
	append(element);
	return { element, lower, upper };
};

describe("SliderElement", () => {
	test("keeps every range as an actual focus, label, and form identity", () => {
		const { element, lower, upper } = create();
		const form = append(document.createElement("form"));
		form.append(element);

		lower.focus();
		expect(document.activeElement).toBe(lower);
		expect(element.inputs).toEqual([lower, upper]);
		expect(element.shadowRoot?.querySelector("input")).toBeNull();
		expect([...new FormData(form)]).toEqual([
			["minimum", "20"],
			["maximum", "80"],
		]);
		expect(lower.getAttribute("aria-label")).toBe("minimum");
		expect(upper.getAttribute("aria-label")).toBe("maximum");
	});

	test("turns neighboring values into coherent native noncrossing bounds", () => {
		const { element, lower, upper } = create();
		expect(lower.min).toBe("0");
		expect(lower.max).toBe("80");
		expect(upper.min).toBe("20");
		expect(upper.max).toBe("100");

		lower.valueAsNumber = 95;
		lower.dispatchEvent(new InputEvent("input", { bubbles: true, composed: true }));
		expect(lower.valueAsNumber).toBe(80);
		expect(upper.min).toBe("80");
		expect(element.values).toEqual([80, 80]);
	});

	test("provides silent ordered programmatic values without changing thumb identities", () => {
		const { element, lower, upper } = create();
		const events = vi.fn();
		element.addEventListener("input", events);
		element.addEventListener("change", events);
		element.values = [70, 30];
		expect(element.values).toEqual([70, 70]);
		expect(element.inputs).toEqual([lower, upper]);
		expect(events).not.toHaveBeenCalled();

		element.value = 40;
		expect(element.values).toEqual([40, 70]);
		expect(() => (element.values = [1])).toThrow(RangeError);
		lower.max = "100";
		lower.valueAsNumber = 90;
		expect(() => ((element as unknown as { values: bigint[] }).values = [1n, 2n])).toThrow(TypeError);
		expect(lower.valueAsNumber).toBe(90);
		expect(lower.max).toBe("100");
	});

	test("delegates invalid and reversed outer-bound parsing to a native range", () => {
		const { element, lower, upper } = create();
		element.min = "";
		element.max = "";
		expect(lower.min).toBe("0");
		expect(upper.max).toBe("100");

		element.min = "10";
		element.max = "5";
		expect(element.values).toEqual([10, 10]);
		expect(lower.min).toBe("10");
		expect(lower.max).toBe("10");
		expect(upper.min).toBe("10");
		expect(upper.max).toBe("10");
	});

	test("exposes stable ordered percentage variables on the track part", () => {
		const { element } = create();
		const track = element.shadowRoot?.querySelector<HTMLElement>("[part=track]");
		expect(track).not.toBeNull();
		expect(track?.style.getPropertyValue("--base-slider-value-0")).toBe("20%");
		expect(track?.style.getPropertyValue("--base-slider-value-1")).toBe("80%");
		expect(track?.querySelector('slot[name="thumb"]')).not.toBeNull();

		element.values = [25, 75];
		expect(track?.style.getPropertyValue("--base-slider-value-0")).toBe("25%");
		expect(track?.style.getPropertyValue("--base-slider-value-1")).toBe("75%");
	});

	test("uses native orientation and direction on the actual inputs", () => {
		const { element, lower, upper } = create();
		element.orientation = "vertical";
		expect(lower.getAttribute("aria-orientation")).toBe("vertical");
		expect(upper.getAttribute("aria-orientation")).toBe("vertical");
		expect(getComputedStyle(lower).writingMode).toBe("vertical-lr");

		element.orientation = "horizontal";
		element.dir = "rtl";
		element.values = [10, 40];
		expect(lower.hasAttribute("aria-orientation")).toBe(false);
		expect(getComputedStyle(lower).direction).toBe("rtl");
		const track = element.shadowRoot?.querySelector<HTMLElement>("[part=track]");
		expect(track?.style.getPropertyValue("--base-slider-value-0")).toBe("10%");
		expect(track?.style.getPropertyValue("--base-slider-value-1")).toBe("40%");
	});

	test("reversibly owns numeric constraints while preserving names and labels", async () => {
		const element = define();
		const input = range("price", 12);
		input.min = "10";
		input.max = "20";
		input.step = "2";
		element.min = "0";
		element.max = "50";
		element.step = "5";
		element.append(input);
		append(element);
		expect(input.min).toBe("0");
		expect(input.max).toBe("50");
		expect(input.step).toBe("5");

		input.remove();
		await mutation();
		expect(input.min).toBe("10");
		expect(input.max).toBe("20");
		expect(input.step).toBe("2");
		expect(input.name).toBe("price");
		expect(input.getAttribute("aria-label")).toBe("price");
	});

	test("defers to fieldset disabledness and host disabled coordination", () => {
		const { element, lower, upper } = create();
		const fieldset = append(document.createElement("fieldset"));
		fieldset.disabled = true;
		fieldset.append(element);
		expect(lower.matches(":disabled")).toBe(true);
		expect(upper.matches(":disabled")).toBe(true);

		fieldset.disabled = false;
		element.disabled = true;
		expect(lower.disabled).toBe(true);
		expect(upper.disabled).toBe(true);
	});

	test("replays interval values assigned before custom-element upgrade", () => {
		const name = `base-slider-${crypto.randomUUID()}`;
		const element = document.createElement(name) as SliderElement;
		(element as unknown as { values: number[] }).values = [15, 85];
		const lower = range("lower", 0);
		const upper = range("upper", 100);
		element.append(lower, upper);
		append(element);
		customElements.define(name, class extends SliderElement {});
		expect(element.values).toEqual([15, 85]);
	});

	test("refreshes membership before plural assignment replaces ranges", () => {
		const { element, lower, upper } = create();
		lower.remove();
		upper.remove();
		const replacementLower = range("replacement-lower", 10);
		const replacementUpper = range("replacement-upper", 90);
		element.append(replacementLower, replacementUpper);
		element.values = [30, 70];
		expect(element.inputs).toEqual([replacementLower, replacementUpper]);
		expect(element.values).toEqual([30, 70]);
		expect(lower.valueAsNumber).toBe(20);
		expect(upper.valueAsNumber).toBe(80);
	});

	test("retains pending interval values while inputs arrive one at a time", async () => {
		const element = define();
		element.values = [25, 75];
		append(element);
		const lower = range("lower", 0);
		element.append(lower);
		await mutation();
		expect(lower.valueAsNumber).toBe(0);
		const upper = range("upper", 100);
		element.append(upper);
		await mutation();
		expect(element.values).toEqual([25, 75]);
	});

	test("lets later scalar and plural writes supersede unresolved pending intervals", async () => {
		const scalar = define();
		scalar.values = [25, 75];
		append(scalar);
		const scalarLower = range("scalar-lower", 0);
		scalar.append(scalarLower);
		await mutation();
		scalar.value = 30;
		const scalarUpper = range("scalar-upper", 100);
		scalar.append(scalarUpper);
		await mutation();
		expect(scalar.values).toEqual([30, 75]);

		const plural = define();
		plural.values = [25, 75];
		append(plural);
		const only = range("only", 0);
		plural.append(only);
		await mutation();
		plural.values = [40];
		const later = range("later", 80);
		plural.append(later);
		await mutation();
		expect(plural.values).toEqual([40, 80]);
	});

	test("does not mutate native children when recovered interval length fails upgrade", () => {
		const name = `base-slider-${crypto.randomUUID()}`;
		const fixture = append(document.createElement("div"));
		fixture.innerHTML = `<${name}><input type="range" min="5" value="20"><input type="range" max="90" value="80"></${name}>`;
		const element = fixture.firstElementChild as HTMLElement & { value: number; values: readonly number[] };
		const inputs = [...element.children] as HTMLInputElement[];
		element.value = 40;
		element.values = [10];
		let upgradeError: unknown;
		const onError = (event: ErrorEvent) => {
			if (event.error instanceof RangeError) {
				upgradeError = event.error;
				event.preventDefault();
				event.stopImmediatePropagation();
			}
		};
		window.addEventListener("error", onError, true);
		try {
			customElements.define(name, class extends SliderElement {});
		} catch (error) {
			upgradeError = error;
		} finally {
			window.removeEventListener("error", onError, true);
		}
		expect(upgradeError).toBeInstanceOf(RangeError);
		expect(inputs.map((input) => input.valueAsNumber)).toEqual([20, 80]);
		expect(inputs[0].min).toBe("5");
		expect(inputs[1].max).toBe("90");
	});

	test("keeps empty membership states coherent", async () => {
		const { element, lower, upper } = create();
		element.orientation = "vertical";
		lower.disabled = true;
		upper.disabled = true;
		expect(element.values).toEqual([20, 80]);
		expect(element.matches(":state(disabled)")).toBe(true);
		lower.remove();
		upper.remove();
		await mutation();
		expect(element.matches(":state(disabled)")).toBe(false);
		expect(element.matches(":state(multiple)")).toBe(false);
		expect(element.matches(":state(vertical)")).toBe(true);
	});

	test("refreshes values and CSS snapshots after native setters and form reset without synthetic events", () => {
		const { element, lower, upper } = create();
		lower.defaultValue = "20";
		upper.defaultValue = "80";
		const form = append(document.createElement("form"));
		form.append(element);
		const events = vi.fn();
		element.addEventListener("input", events);
		element.addEventListener("change", events);
		lower.valueAsNumber = 35;
		expect(element.values).toEqual([35, 80]);
		const track = element.shadowRoot?.querySelector<HTMLElement>("[part=track]");
		expect(track?.style.getPropertyValue("--base-slider-value-0")).toBe("35%");
		form.reset();
		expect(lower.valueAsNumber).toBe(20);
		expect(element.values).toEqual([20, 80]);
		expect(track?.style.getPropertyValue("--base-slider-value-0")).toBe("20%");
		expect(events).not.toHaveBeenCalled();
	});

	test("lets a later same-task form reset clear unmatched pending interval values", async () => {
		const element = define();
		const form = append(document.createElement("form"));
		form.append(element);
		element.values = [25, 75];
		const lower = range("lower", 20);
		lower.defaultValue = "20";
		element.append(lower);
		form.reset();
		const upper = range("upper", 80);
		upper.defaultValue = "80";
		element.append(upper);
		await mutation();
		expect(element.values).toEqual([20, 80]);
	});

	test("releases and reacquires ownership when document capture moves a range", async () => {
		const first = create();
		const second = define();
		second.min = "50";
		second.max = "100";
		append(second);
		const move = (event: Event) => {
			if (event.target === first.lower) {
				second.append(first.lower);
			}
		};
		document.addEventListener("input", move, { capture: true, once: true });
		first.lower.dispatchEvent(new InputEvent("input", { bubbles: true, composed: true }));
		await mutation();
		expect(second.inputs).toEqual([first.lower]);
		expect(first.lower.min).toBe("50");
		expect(first.lower.max).toBe("100");
	});
});
