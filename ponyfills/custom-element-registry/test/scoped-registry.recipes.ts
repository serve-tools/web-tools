import { installCustomElementRegistry } from "@serve-tools/ponyfill-custom-element-registry";

export function scopedRegistryRecipe(win: Window & typeof globalThis) {
	const { CustomElementRegistry } = installCustomElementRegistry(win);
	const registry = new CustomElementRegistry();
	class ScopedGreeting extends win.HTMLElement {
		connectedCallback() {
			this.textContent = "Hello from this registry";
		}
	}
	registry.define("scoped-greeting", ScopedGreeting);
	const host = win.document.createElement("section");
	const root = host.attachShadow({ mode: "open", customElementRegistry: registry });
	root.innerHTML = "<scoped-greeting></scoped-greeting>";
	return host;
}
