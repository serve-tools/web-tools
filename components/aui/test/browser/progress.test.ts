import { afterEach, describe, expect, test } from "vitest";
import { ProgressElement } from "../../src/progress-element.js";

const fixtures: Node[] = [];

afterEach(() => {
	for (const fixture of fixtures.splice(0).reverse()) {
		fixture.parentNode?.removeChild(fixture);
	}
});

const defineProgress = (): { element: ProgressElement; name: string } => {
	const name = `aui-progress-${crypto.randomUUID()}`;
	customElements.define(name, class extends ProgressElement {});
	return { element: document.createElement(name) as ProgressElement, name };
};

const append = <T extends Node>(node: T): T => {
	document.body.append(node);
	fixtures.push(node);
	return node;
};

describe("ProgressElement", () => {
	test("uses missing value for a genuinely indeterminate progressbar", () => {
		const { element } = defineProgress();
		append(element);

		expect(element.hasAttribute("value")).toBe(false);
		expect(element.value).toBe(0);
		expect(element.position).toBe(-1);
		expect(element.status).toBe("indeterminate");
		expect(element.matches(":state(indeterminate)")).toBe(true);
		expect(element.matches(":state(progressing)")).toBe(false);
	});

	test("matches native progress parsing, clamping, and completion boundaries", () => {
		const { element } = defineProgress();
		const native = document.createElement("progress");
		for (const attributes of [
			{},
			{ max: "10", value: "0" },
			{ max: "10", value: "10" },
			{ max: "10", value: "100" },
			{ max: "0", value: "-2" },
			{ max: "bad", value: "bad" },
		] as const) {
			for (const name of ProgressElement.observedAttributes) {
				element.removeAttribute(name);
				native.removeAttribute(name);
			}
			for (const [name, value] of Object.entries(attributes)) {
				element.setAttribute(name, value);
				native.setAttribute(name, value);
			}

			expect([element.max, element.value, element.position]).toEqual([native.max, native.value, native.position]);
		}

		element.max = 10;
		element.value = 10;
		expect(element.status).toBe("complete");
		expect(element.matches(":state(complete)")).toBe(true);
		element.value = 9.999;
		expect(element.status).toBe("progressing");
		expect(element.matches(":state(progressing)")).toBe(true);
	});

	test("reflects property writes through native IDL and removes value to become indeterminate", () => {
		const { element } = defineProgress();
		const native = document.createElement("progress");
		element.max = 4;
		native.max = 4;
		element.value = 7;
		native.value = 7;
		expect(element.getAttribute("max")).toBe(native.getAttribute("max"));
		expect(element.getAttribute("value")).toBe(native.getAttribute("value"));
		expect(element.value).toBe(native.value);
		for (const value of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
			expect(() => (element.value = value)).toThrow(TypeError);
			expect(() => (native.value = value)).toThrow(TypeError);
		}
		expect(() => ((element as unknown as { value: bigint }).value = 1n)).toThrow(TypeError);
		expect(() => ((native as unknown as { value: bigint }).value = 1n)).toThrow(TypeError);

		element.removeAttribute("value");
		expect(element.position).toBe(-1);
		expect(element.status).toBe("indeterminate");
	});

	test("keeps author naming on the sole host identity and hides the native visual semantically", () => {
		const { element } = defineProgress();
		const label = document.createElement("span");
		label.id = crypto.randomUUID();
		label.textContent = "Upload";
		element.setAttribute("aria-labelledby", label.id);
		element.setAttribute("aria-valuetext", "Three quarters uploaded");
		element.max = 8;
		element.value = 6;
		const fixture = append(document.createElement("div"));
		fixture.append(label, element);

		expect(element.getAttribute("aria-labelledby")).toBe(label.id);
		expect(element.getAttribute("aria-valuetext")).toBe("Three quarters uploaded");
		expect(element.progress.getAttribute("aria-hidden")).toBe("true");
		expect(element.progress.hasAttribute("aria-labelledby")).toBe(false);
		expect(element.progress.hasAttribute("aria-valuetext")).toBe(false);
		expect(element.hasAttribute("aria-valuenow")).toBe(false);
		expect(element.tabIndex).toBe(-1);
	});

	test("retains visual identity, authored content, and state across lifecycle changes", () => {
		const { element } = defineProgress();
		element.max = 10;
		element.value = 4;
		element.textContent = "4 of 10";
		append(element);
		const progress = element.progress;
		const slot = element.shadowRoot?.querySelector("slot");
		element.remove();
		element.value = 8;
		document.body.append(element);
		expect(element.progress).toBe(progress);
		expect(element.shadowRoot?.querySelector("slot")).toBe(slot);
		expect(element.value).toBe(8);
		expect(element.textContent).toBe("4 of 10");

		const frame = append(document.createElement("iframe"));
		const frameDocument = frame.contentDocument;
		if (!frameDocument) {
			throw new Error("Same-origin iframe document is unavailable");
		}
		frameDocument.body.append(frameDocument.adoptNode(element));
		expect(element.progress).toBe(progress);
		expect(element.progress.ownerDocument).toBe(frameDocument);
	});

	test("upgrades preexisting numeric properties", () => {
		const fixture = append(document.createElement("div"));
		const lateName = `aui-progress-${crypto.randomUUID()}`;
		fixture.insertAdjacentHTML("beforeend", `<${lateName} max="10"></${lateName}>`);
		const late = fixture.lastElementChild as ProgressElement;
		Object.defineProperty(late, "value", { configurable: true, value: 6 });
		customElements.define(lateName, class extends ProgressElement {});

		expect(Object.hasOwn(late, "value")).toBe(false);
		expect(late.max).toBe(10);
		expect(late.value).toBe(6);
		expect(late.status).toBe("progressing");
	});
});
