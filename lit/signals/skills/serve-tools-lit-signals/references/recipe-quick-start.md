# Recipe: quick start

This public-import example is generated from the compile-checked `test/lit-signals.recipes.ts` fixture in the package source.

```ts
import { LitElement } from "lit";
import { customElement } from "lit/decorators.js";
import { html, Signal, watch } from "@serve-tools/lit-signals";

@customElement("recipe-counter")
class RecipeCounter extends LitElement {
	readonly count = new Signal.State(0);

	protected render() {
		return html`<button @click=${() => this.count.set(this.count.get() + 1)}>Count: ${watch(this.count)}</button>`;
	}
}

void RecipeCounter;
```
