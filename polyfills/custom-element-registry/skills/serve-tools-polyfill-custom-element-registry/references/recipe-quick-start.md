# Recipe: quick start

This public-import example is generated from the compile-checked `test/scoped-registry.recipes.ts` fixture in the package source.

```ts
import "@serve-tools/polyfill-custom-element-registry";

export function scopedRegistryRecipe() {
	const registry = new CustomElementRegistry();
	class ScopedGreeting extends HTMLElement {
		connectedCallback() {
			this.textContent = "Hello from this registry";
		}
	}
	registry.define("scoped-greeting", ScopedGreeting);
	const host = document.createElement("section");
	const root = host.attachShadow({ mode: "open", customElementRegistry: registry });
	root.innerHTML = "<scoped-greeting></scoped-greeting>";
	return host;
}
```
