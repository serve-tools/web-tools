import { afterEach, describe, expect, test } from "vitest";
import { SeparatorElement } from "../../src/separator-element.js";

const fixtures: Node[] = [];

afterEach(() => {
	for (const fixture of fixtures.splice(0).reverse()) {
		fixture.parentNode?.removeChild(fixture);
	}
});

const defineSeparator = (): { element: SeparatorElement; name: string } => {
	const name = `aui-separator-${crypto.randomUUID()}`;
	customElements.define(name, class extends SeparatorElement {});
	return { element: document.createElement(name) as SeparatorElement, name };
};

const append = <T extends Node>(node: T): T => {
	document.body.append(node);
	fixtures.push(node);
	return node;
};

describe("SeparatorElement", () => {
	test("defaults to a passive horizontal separator without adding focusability", () => {
		const { element } = defineSeparator();
		append(element);

		expect(element.orientation).toBe("horizontal");
		expect(element.decorative).toBe(false);
		expect(element.tabIndex).toBe(-1);
		expect(element.hasAttribute("tabindex")).toBe(false);
		expect(element.matches(":state(horizontal)")).toBe(true);
		expect(element.matches(":state(vertical)")).toBe(false);
		expect(element.separator.localName).toBe("hr");
		expect(element.separator.getAttribute("aria-hidden")).toBe("true");
	});

	test("normalizes orientation properties and invalid attributes", () => {
		const { element } = defineSeparator();
		element.orientation = "vertical";
		expect(element.getAttribute("orientation")).toBe("vertical");
		expect(element.orientation).toBe("vertical");
		expect(element.matches(":state(vertical)")).toBe(true);

		element.setAttribute("orientation", "diagonal");
		expect(element.orientation).toBe("horizontal");
		expect(element.matches(":state(horizontal)")).toBe(true);
	});

	test("supplies a decorative default without overwriting author ARIA", () => {
		const { element } = defineSeparator();
		element.setAttribute("aria-label", "Section boundary");
		element.decorative = true;
		append(element);

		expect(element.hasAttribute("decorative")).toBe(true);
		expect(element.getAttribute("aria-label")).toBe("Section boundary");
		expect(element.matches(":state(decorative)")).toBe(true);
		expect(element.separator.getAttribute("aria-hidden")).toBe("true");
		expect(element.separator.hasAttribute("role")).toBe(false);
	});

	test("retains its native rule across disconnect and adoption", () => {
		const { element } = defineSeparator();
		append(element);
		const separator = element.separator;
		element.remove();
		document.body.append(element);
		expect(element.separator).toBe(separator);

		const frame = append(document.createElement("iframe"));
		const frameDocument = frame.contentDocument;
		if (!frameDocument) {
			throw new Error("Same-origin iframe document is unavailable");
		}
		frameDocument.body.append(frameDocument.adoptNode(element));
		expect(element.separator).toBe(separator);
		expect(separator.ownerDocument).toBe(frameDocument);
	});

	test("supports defined-before-parse and late-upgraded properties", () => {
		const defined = defineSeparator();
		const fixture = append(document.createElement("div"));
		fixture.insertAdjacentHTML("beforeend", `<${defined.name} orientation="vertical"></${defined.name}>`);
		const parsed = fixture.lastElementChild as SeparatorElement;
		expect(parsed.orientation).toBe("vertical");

		const lateName = `aui-separator-${crypto.randomUUID()}`;
		fixture.insertAdjacentHTML("beforeend", `<${lateName}></${lateName}>`);
		const late = fixture.lastElementChild as SeparatorElement;
		Object.defineProperty(late, "orientation", { configurable: true, value: "vertical" });
		Object.defineProperty(late, "decorative", { configurable: true, value: true });
		customElements.define(lateName, class extends SeparatorElement {});
		expect(Object.hasOwn(late, "orientation")).toBe(false);
		expect(late.orientation).toBe("vertical");
		expect(late.decorative).toBe(true);
	});
});
