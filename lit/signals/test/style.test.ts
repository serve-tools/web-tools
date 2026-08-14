import { Signal } from "@serve-tools/signal";
import { describe, expect, it } from "vitest";

import { property, type StyleDeclarations, style } from "../src/decorators.js";
import { html, SignalElement } from "../src/lit-signals.js";

const sizes = new WeakMap<object, number>();
const hostStyles = new WeakMap<object, StyleDeclarations>();
const metadata = {};

let initializeSize = function (this: StyleTestElement, value: number) {
	return value;
};

let initializeHostStyle = function (this: StyleTestElement, value: StyleDeclarations) {
	return value;
};

class StyleTestElement extends SignalElement {
	readonly accent: Signal.State<string>;
	readonly hiddenState: Signal.State<boolean>;
	declare hostStyle: StyleDeclarations;
	readonly optional: Signal.State<string | undefined>;
	renders: number;
	declare size: number;

	constructor() {
		super();

		this.accent = new Signal.State("red");
		sizes.set(this, initializeSize.call(this, 20));
		this.hiddenState = new Signal.State(false);
		this.optional = new Signal.State<string | undefined>("present");
		this.renders = 0;
		hostStyles.set(
			this,
			initializeHostStyle.call(this, {
				"--accent": this.accent,
				"--derived-accent": () => `light-${this.accent.get()}`,
				"--optional": this.optional,
				"--size": () => `${this.size}px`,
				display: () => (this.hiddenState.get() ? "none" : "block"),
				opacity: 1,
			}),
		);
	}

	protected override render() {
		++this.renders;

		return html`<slot></slot>`;
	}
}

const sizeTarget: ClassAccessorDecoratorTarget<StyleTestElement, number> = {
	get() {
		return sizes.get(this)!;
	},
	set(value) {
		sizes.set(this, value);
	},
};
const decoratedSize = property<number>()(sizeTarget, {
	kind: "accessor",
	name: "size",
	static: false,
	private: false,
	access: {
		has(element) {
			return "size" in element;
		},
		get(element) {
			return element.size;
		},
		set(element, value) {
			element.size = value;
		},
	},
	addInitializer() {},
	metadata,
});

initializeSize = decoratedSize.init ?? initializeSize;

Object.defineProperty(StyleTestElement.prototype, "size", {
	configurable: true,
	get: decoratedSize.get ?? sizeTarget.get,
	set: decoratedSize.set ?? sizeTarget.set,
});

const hostStyleTarget: ClassAccessorDecoratorTarget<StyleTestElement, StyleDeclarations> = {
	get() {
		return hostStyles.get(this)!;
	},
	set(value) {
		hostStyles.set(this, value);
	},
};
const decoratedHostStyle = style(hostStyleTarget, {
	kind: "accessor",
	name: "hostStyle",
	static: false,
	private: false,
	access: {
		has(element) {
			return "hostStyle" in element;
		},
		get(element) {
			return element.hostStyle;
		},
		set(element, value) {
			element.hostStyle = value;
		},
	},
	addInitializer() {},
	metadata,
});

initializeHostStyle = decoratedHostStyle.init ?? initializeHostStyle;

Object.defineProperty(StyleTestElement.prototype, "hostStyle", {
	configurable: true,
	get: decoratedHostStyle.get ?? hostStyleTarget.get,
	set: decoratedHostStyle.set ?? hostStyleTarget.set,
});

Object.defineProperty(StyleTestElement, Symbol.metadata, { value: metadata });

customElements.define("serve-tools-style-test", StyleTestElement);

const sheetOf = (element: StyleTestElement): CSSStyleSheet => element.shadowRoot!.adoptedStyleSheets.at(-1)!;

const ruleOf = (element: StyleTestElement): CSSStyleRule => sheetOf(element).cssRules[0] as CSSStyleRule;

describe("style", () => {
	it("creates and adopts one instance-owned host stylesheet", async () => {
		const element = new StyleTestElement();

		document.body.append(element);
		await element.updateComplete;

		try {
			const sheet = sheetOf(element);
			const rule = ruleOf(element);

			expect(sheet).toBeInstanceOf(CSSStyleSheet);
			expect(rule.selectorText).toBe(":host");
			expect(rule.style.getPropertyValue("--accent")).toBe("red");
			expect(rule.style.getPropertyValue("--derived-accent")).toBe("light-red");
			expect(rule.style.getPropertyValue("--size")).toBe("20px");
			expect(rule.style.getPropertyValue("opacity")).toBe("1");
			expect(Signal.subtle.hasSinks(element.accent)).toBe(true);
			expect(Signal.subtle.hasSinks(element.hiddenState)).toBe(true);
			expect(Signal.subtle.hasSinks(element.optional)).toBe(true);
		} finally {
			element.remove();
		}
	});

	it("tracks decorated properties and other reactive declarations", async () => {
		const element = new StyleTestElement();

		document.body.append(element);
		await element.updateComplete;

		try {
			const rule = ruleOf(element);

			element.size = 24;
			await Promise.resolve();

			expect(rule.style.getPropertyValue("--size")).toBe("24px");

			const renders = element.renders;

			element.accent.set("blue");
			element.hiddenState.set(true);
			element.optional.set(undefined);
			await Promise.resolve();

			expect(rule.style.getPropertyValue("--accent")).toBe("blue");
			expect(rule.style.getPropertyValue("--derived-accent")).toBe("light-blue");
			expect(rule.style.getPropertyValue("--optional")).toBe("");
			expect(rule.style.getPropertyValue("display")).toBe("none");
			expect(element.renders).toBe(renders);
		} finally {
			element.remove();
		}
	});

	it("suspends updates while disconnected and refreshes after reconnection", async () => {
		const element = new StyleTestElement();

		document.body.append(element);
		await element.updateComplete;

		const rule = ruleOf(element);

		element.remove();
		await Promise.resolve();

		expect(Signal.subtle.hasSinks(element.accent)).toBe(false);

		element.accent.set("green");
		element.size = 32;
		await Promise.resolve();

		expect(rule.style.getPropertyValue("--accent")).toBe("red");
		expect(rule.style.getPropertyValue("--size")).toBe("20px");

		document.body.append(element);
		await element.updateComplete;

		try {
			expect(rule.style.getPropertyValue("--accent")).toBe("green");
			expect(rule.style.getPropertyValue("--derived-accent")).toBe("light-green");
			expect(rule.style.getPropertyValue("--size")).toBe("32px");
			expect(element.shadowRoot?.adoptedStyleSheets).toContain(sheetOf(element));
		} finally {
			element.remove();
		}
	});

	it("replaces declarations while preserving the adopted sheet", async () => {
		const element = new StyleTestElement();
		const nextAccent = new Signal.State("purple");

		document.body.append(element);
		await element.updateComplete;

		try {
			const sheet = sheetOf(element);
			const replacement: StyleDeclarations = {
				"--next-accent": nextAccent,
				display: "grid",
			};

			element.hostStyle = replacement;
			await Promise.resolve();

			const rule = ruleOf(element);

			expect(element.hostStyle).toBe(replacement);
			expect(sheetOf(element)).toBe(sheet);
			expect(rule.style.getPropertyValue("--accent")).toBe("");
			expect(rule.style.getPropertyValue("--next-accent")).toBe("purple");
			expect(rule.style.getPropertyValue("display")).toBe("grid");
			expect(Signal.subtle.hasSinks(element.accent)).toBe(false);
			expect(Signal.subtle.hasSinks(nextAccent)).toBe(true);

			element.accent.set("ignored");
			nextAccent.set("orange");
			await Promise.resolve();

			expect(rule.style.getPropertyValue("--accent")).toBe("");
			expect(rule.style.getPropertyValue("--next-accent")).toBe("orange");
		} finally {
			element.remove();
		}
	});
});
