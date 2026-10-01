import { afterEach, beforeEach, expect, it } from "vitest";

import { supportsCustomElementRegistry } from "../../../ponyfills/custom-element-registry/src/ponyfill-custom-element-registry.js";

let frame: HTMLIFrameElement;
let win: Window & typeof globalThis;

beforeEach(() => {
	frame = document.createElement("iframe");
	document.body.append(frame);
	win = frame.contentWindow as Window & typeof globalThis;
});

afterEach(() => frame.remove());

function loadModule(path: string): Promise<void> {
	return new Promise((resolve, reject) => {
		const script = win.document.createElement("script");
		script.type = "module";
		script.src = new URL(path, import.meta.url).href;
		script.onload = () => resolve();
		script.onerror = () => reject(new Error(`Failed to load ${path}`));
		win.document.head.append(script);
	});
}

it("installs only for Firefox with incomplete native support", async () => {
	const firefox = /\bFirefox\/\d/.test(win.navigator.userAgent);
	const supported = supportsCustomElementRegistry(win);
	const registry = win.CustomElementRegistry;
	const elements = win.customElements;
	const createElement = win.Document.prototype.createElement;
	const htmlElement = win.HTMLElement;

	await loadModule("../src/polyfill-custom-element-registry.ts");

	if (!firefox || supported) {
		expect(win.CustomElementRegistry).toBe(registry);
		expect(win.customElements).toBe(elements);
		expect(win.Document.prototype.createElement).toBe(createElement);
		expect(win.HTMLElement).toBe(htmlElement);
	} else {
		expect(win.CustomElementRegistry).not.toBe(registry);
		expect(win.customElements).not.toBe(elements);
		expect(win.Document.prototype.createElement).not.toBe(createElement);
		expect(win.HTMLElement).not.toBe(htmlElement);
	}
	if (firefox) {
		expect(new win.CustomElementRegistry().initialize).toBeTypeOf("function");
	}
});

it("leaves other browsers untouched even when scoped registry support is incomplete", async () => {
	const firefox = /\bFirefox\/\d/.test(win.navigator.userAgent);
	Reflect.deleteProperty(win.CustomElementRegistry.prototype, "initialize");
	const registry = win.CustomElementRegistry;
	const elements = win.customElements;
	const createElement = win.Document.prototype.createElement;
	const attachShadow = win.Element.prototype.attachShadow;
	const htmlElement = win.HTMLElement;

	await loadModule("../src/apply/CustomElementRegistry.ts");

	if (!firefox) {
		expect(win.CustomElementRegistry).toBe(registry);
		expect(win.customElements === elements).toBe(true);
		expect(win.Document.prototype.createElement).toBe(createElement);
		expect(win.Element.prototype.attachShadow).toBe(attachShadow);
		expect(win.HTMLElement).toBe(htmlElement);
		return;
	}

	expect(win.CustomElementRegistry).not.toBe(registry);
	expect(win.Document.prototype.createElement).not.toBe(createElement);
	expect(win.Element.prototype.attachShadow).not.toBe(attachShadow);
	const scoped = new win.CustomElementRegistry();
	class Scoped extends win.HTMLElement {}
	scoped.define("x-scoped", Scoped);
	expect(win.document.createElement("x-scoped", { customElementRegistry: scoped })).toBeInstanceOf(Scoped);
});
