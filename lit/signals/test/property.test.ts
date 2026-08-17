import { html, LitElement, render } from "lit";
import { describe, expect, it } from "vitest";
import { computed, defaultAttributeConverter, property } from "../src/decorators.js";
import { SignalWatcher, watch } from "../src/lit-signals.js";

const values = new WeakMap<object, number>();
const metadata = {};

let initializeCount = function (this: PropertyTestElement, value: number) {
	return value;
};

class PropertyTestElement extends LitElement {
	declare count: number;

	constructor() {
		super();

		values.set(this, initializeCount.call(this, 1));
	}
}

const target: ClassAccessorDecoratorTarget<PropertyTestElement, number> = {
	get() {
		return values.get(this)!;
	},
	set(value) {
		values.set(this, value);
	},
};
const decorated = property<number>({
	hasChanged: (_value, oldValue) => oldValue !== undefined,
	reflect: true,
	type: Number,
	update: "lifecycle",
})(target, {
	kind: "accessor",
	name: "count",
	static: false,
	private: false,
	access: {
		has(element) {
			return "count" in element;
		},
		get(element) {
			return element.count;
		},
		set(element, value) {
			element.count = value;
		},
	},
	addInitializer() {},
	metadata,
});

initializeCount = decorated.init ?? initializeCount;

Object.defineProperty(PropertyTestElement.prototype, "count", {
	configurable: true,
	get: decorated.get ?? target.get,
	set: decorated.set ?? target.set,
});

Object.defineProperty(PropertyTestElement, Symbol.metadata, { value: metadata });

customElements.define("serve-tools-property-test", PropertyTestElement);

const atomicValues = new WeakMap<object, number>();
const atomicMetadata = {};
const computedInitializers: Array<(this: AtomicPropertyTestElement) => void> = [];

let initializeAtomicCount = function (this: AtomicPropertyTestElement, value: number) {
	return value;
};

class AtomicPropertyTestElement extends SignalWatcher(LitElement) {
	declare count: number;
	computations = 0;
	updates = 0;

	constructor() {
		super();

		atomicValues.set(this, initializeAtomicCount.call(this, 1));

		for (const initialize of computedInitializers) {
			initialize.call(this);
		}
	}

	get doubled() {
		++this.computations;

		return this.count * 2;
	}

	override requestUpdate() {
		++this.updates;

		super.requestUpdate();
	}

	protected override render() {
		return html`${this.count}:${this.doubled}`;
	}
}

const atomicTarget: ClassAccessorDecoratorTarget<AtomicPropertyTestElement, number> = {
	get() {
		return atomicValues.get(this)!;
	},
	set(value) {
		atomicValues.set(this, value);
	},
};
const atomicDecorated = property<number>()(atomicTarget, {
	kind: "accessor",
	name: "count",
	static: false,
	private: false,
	access: {
		has(element) {
			return "count" in element;
		},
		get(element) {
			return element.count;
		},
		set(element, value) {
			element.count = value;
		},
	},
	addInitializer() {},
	metadata: atomicMetadata,
});

initializeAtomicCount = atomicDecorated.init ?? initializeAtomicCount;

Object.defineProperty(AtomicPropertyTestElement.prototype, "count", {
	configurable: true,
	get: atomicDecorated.get ?? atomicTarget.get,
	set: atomicDecorated.set ?? atomicTarget.set,
});

const doubledGetter = Object.getOwnPropertyDescriptor(AtomicPropertyTestElement.prototype, "doubled")!.get!;
const decoratedDoubled = computed<AtomicPropertyTestElement, number>(doubledGetter, {
	kind: "getter",
	name: "doubled",
	static: false,
	private: false,
	access: {
		has(element) {
			return "doubled" in element;
		},
		get(element) {
			return element.doubled;
		},
	},
	addInitializer(initializer) {
		computedInitializers.push(initializer);
	},
	metadata: atomicMetadata,
});

Object.defineProperty(AtomicPropertyTestElement.prototype, "doubled", {
	configurable: true,
	get: decoratedDoubled,
});

customElements.define("serve-tools-atomic-property-test", AtomicPropertyTestElement);

describe("property", () => {
	it("matches Lit's default attribute conversions", () => {
		expect(defaultAttributeConverter.fromAttribute!("invalid", Object)).toBeNull();
		expect(defaultAttributeConverter.fromAttribute!("[1,2]", Array)).toEqual([1, 2]);
	});

	it("uses atomic signal updates by default", async () => {
		const element = new AtomicPropertyTestElement();
		const container = document.createElement("div");

		render(html`${watch(() => element.count)}:${watch(() => element.doubled)}`, container);

		expect(container.textContent).toBe("1:2");
		expect(element.doubled).toBe(2);
		expect(element.computations).toBe(1);

		element.count = 2;

		await Promise.resolve();

		expect(element.updates).toBe(0);
		expect(element.doubled).toBe(4);
		expect(element.computations).toBe(2);
		expect(container.textContent).toBe("2:4");

		const other = new AtomicPropertyTestElement();

		expect(other.doubled).toBe(2);
		expect(other.computations).toBe(1);
	});

	it("renders atomic properties through SignalWatcher", async () => {
		const element = new AtomicPropertyTestElement();

		document.body.append(element);

		try {
			await element.updateComplete;

			expect(element.shadowRoot?.textContent).toBe("1:2");

			element.count = 2;

			await element.updateComplete;

			expect(element.shadowRoot?.textContent).toBe("2:4");
		} finally {
			element.remove();
		}
	});

	it("uses signal storage with Lit property and attribute behavior", async () => {
		const element = new PropertyTestElement();

		document.body.append(element);

		try {
			expect(element.count).toBe(1);

			await element.updateComplete;

			expect(element.getAttribute("count")).toBe("1");

			element.count = 2;

			await element.updateComplete;

			expect(element.getAttribute("count")).toBe("2");

			element.setAttribute("count", "3");

			await element.updateComplete;

			expect(element.count).toBe(3);
		} finally {
			element.remove();
		}
	});
});
