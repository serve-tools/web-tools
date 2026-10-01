import { expect, it } from "vitest";

it("imports without a DOM or global installation", async () => {
	const keys = ["CustomElementRegistry", "customElements", "HTMLElement", "document"];
	const snapshot = () => keys.map((key) => Object.getOwnPropertyDescriptor(globalThis, key));
	const before = snapshot();
	const { installCustomElementRegistry, supportsCustomElementRegistry } = await import(
		"../src/ponyfill-custom-element-registry.js"
	);
	expect(supportsCustomElementRegistry()).toBe(false);
	expect(snapshot()).toEqual(before);
	expect(() => installCustomElementRegistry()).toThrow(TypeError);
});
