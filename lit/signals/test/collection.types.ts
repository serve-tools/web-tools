import { html, LitElement } from "lit";
import { collection, computed } from "../src/decorators.js";
import { SignalArray, SignalMap, SignalObject, SignalSet, SignalWatcher } from "../src/lit-signals.js";

class CollectionTypeTestElement extends SignalWatcher(LitElement) {
	@collection(SignalArray)
	accessor items = [1, 2];

	@collection(SignalMap)
	accessor labels = new Map<string, string>();

	@collection(SignalSet)
	accessor selected = new Set<string>();

	@collection(SignalObject)
	accessor state = { status: "idle" };

	@computed
	get selectedCount() {
		return this.selected.size;
	}

	protected override render() {
		return html`
			${this.items.map((item) => this.labels.get(String(item)))}
			${this.selectedCount}
			${this.state.status}
		`;
	}
}

const element = new CollectionTypeTestElement();

element.items = new SignalArray([3]);
element.labels = new SignalMap([["3", "three"]]);
element.selected = new SignalSet(["3"]);
element.state = new SignalObject({ status: "ready" });

void CollectionTypeTestElement;
