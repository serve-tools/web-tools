# Compose fine-grained and component updates

```ts
import { choose, html, repeat, Signal, SignalArray, SignalElement, watch, when } from "@serve-tools/lit-signals";
import { collection, computed, effect, property } from "@serve-tools/lit-signals/decorators";

const count = new Signal.State(0);

class Counter extends SignalElement {
	@property()
	accessor label = "Count";

	@collection(SignalArray)
	accessor values = [1, 2];

	@computed
	get doubled() {
		return count.get() * this.values.length;
	}

	@effect()
	protected reportCount() {
		console.log(this.values.length);
	}

	render() {
		return html`
			${this.label}: ${count}
			${when(
				() => this.values.length > 0,
				() => choose(
					() => this.values.length,
					[[2, () => html`(${watch(() => this.doubled)})`]],
					() => html`Many values`,
				),
			)}
			${repeat(
				() => this.values,
				(value) => value,
				(value) => html`<span>${value}</span>`,
			)}
		`;
	}
}
```
