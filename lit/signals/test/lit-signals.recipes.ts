import { LitElement } from "lit";
import { customElement } from "lit/decorators.js";
import {
	AsyncOperation,
	AsyncOperationSubscriber,
	html,
	observeOperationView,
	Signal,
	watch,
} from "../src/lit-signals.js";

@customElement("recipe-counter")
class RecipeCounter extends LitElement {
	readonly count = new Signal.State(0);

	protected render() {
		return html`<button @click=${() => this.count.set(this.count.get() + 1)}>Count: ${watch(this.count)}</button>`;
	}
}

void RecipeCounter;

const operation = new AsyncOperation<string, number>(async ({ write }) => {
	await write("loading");

	return 42;
});
const subscriber = new AsyncOperationSubscriber<string, number>();
using latestLength = observeOperationView(
	subscriber.map((value) => value.length),
	"Waiting",
);

html`<output>${latestLength}</output>`;

void subscriber.consume(operation);
