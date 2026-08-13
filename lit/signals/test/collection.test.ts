import { html, LitElement } from "lit";
import { describe, expect, it } from "vitest";
import { collection } from "../src/decorators.js";
import { SignalArray, SignalWatcher } from "../src/lit-signals.js";

const values = new WeakMap<object, number[]>();
const metadata = {};

let initializeItems = function (this: CollectionTestElement, value: number[]) {
	return value;
};

class CollectionTestElement extends SignalWatcher(LitElement) {
	declare items: number[];

	constructor() {
		super();

		values.set(this, initializeItems.call(this, [1]));
	}

	protected override render() {
		return html`${this.items.join(",")}`;
	}
}

const target: ClassAccessorDecoratorTarget<CollectionTestElement, number[]> = {
	get() {
		return values.get(this)!;
	},
	set(value) {
		values.set(this, value);
	},
};
const decorated = collection(SignalArray)(target, {
	kind: "accessor",
	name: "items",
	static: false,
	private: false,
	access: {
		has(element) {
			return "items" in element;
		},
		get(element) {
			return element.items;
		},
		set(element, value) {
			element.items = value;
		},
	},
	addInitializer() {},
	metadata,
});

initializeItems = decorated.init ?? initializeItems;

Object.defineProperty(CollectionTestElement.prototype, "items", {
	configurable: true,
	get: decorated.get ?? target.get,
	set: decorated.set ?? target.set,
});

Object.defineProperty(CollectionTestElement, Symbol.metadata, { value: metadata });

customElements.define("serve-tools-collection-test", CollectionTestElement);

describe("collection", () => {
	it("normalizes initialization and replacement while tracking collection mutations", async () => {
		const element = new CollectionTestElement();

		document.body.append(element);

		try {
			await element.updateComplete;

			expect(element.items).toBeInstanceOf(SignalArray);
			expect(element.shadowRoot?.textContent).toBe("1");
			expect(CollectionTestElement.observedAttributes).not.toContain("items");

			element.items.push(2);
			await element.updateComplete;

			expect(element.shadowRoot?.textContent).toBe("1,2");

			element.items = [3];
			await element.updateComplete;

			expect(element.items).toBeInstanceOf(SignalArray);
			expect(element.shadowRoot?.textContent).toBe("3");

			const replacement = new SignalArray([4]);

			element.items = replacement;
			await element.updateComplete;

			expect(element.items).toBe(replacement);
			expect(element.shadowRoot?.textContent).toBe("4");
		} finally {
			element.remove();
		}
	});
});
