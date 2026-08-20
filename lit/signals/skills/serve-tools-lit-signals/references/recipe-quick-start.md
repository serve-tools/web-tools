# Recipe: quick start

This public-import example is generated from the compile-checked `test/lit-signals.recipes.ts` fixture in the package source.

```ts
import { LitElement } from "lit";
import { customElement } from "lit/decorators.js";
import { operation } from "@serve-tools/lit-signals/decorators";
import { AsyncOperation, AsyncOperationSubscriber, html, Signal, SignalElement, watch } from "@serve-tools/lit-signals";

@customElement("recipe-counter")
class RecipeCounter extends LitElement {
	readonly count = new Signal.State(0);

	protected render() {
		return html`<button @click=${() => this.count.set(this.count.get() + 1)}>Count: ${watch(this.count)}</button>`;
	}
}

void RecipeCounter;

const progress = new AsyncOperationSubscriber<string, number>();

@customElement("recipe-progress")
class RecipeProgress extends SignalElement {
	@operation(progress.map((value) => `${value.length} characters`))
	accessor progress = "Waiting";

	protected render() {
		return html`<output>${this.progress}</output>`;
	}
}

const startProgress = () =>
	progress.consume(
		new AsyncOperation<string, number>(async (write) => {
			await write("loading");

			return 42;
		}),
	);

void RecipeProgress;
void startProgress;
```
