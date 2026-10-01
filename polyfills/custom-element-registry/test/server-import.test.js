import { expect, it } from "vitest";

it("leaves a non-DOM global untouched", async () => {
	const keys = ["CustomElementRegistry", "customElements", "HTMLElement", "document"];
	const snapshot = () => keys.map((key) => Object.getOwnPropertyDescriptor(globalThis, key));
	const before = snapshot();
	await import("../src/polyfill-custom-element-registry.js");
	await import("../src/apply/CustomElementRegistry.js");
	expect(snapshot()).toEqual(before);
});
