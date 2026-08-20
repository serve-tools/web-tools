import type { ReactiveControllerHost } from "lit";
import { describe, expect, it } from "vitest";

import { operation } from "../src/decorators.js";
import { AsyncOperation, AsyncOperationSubscriber, html, SignalElement } from "../src/lit-signals.js";

const progress = new AsyncOperationSubscriber<number, string>();
const progressView = progress.filter((value) => value > 0).map((value) => `${value}%`);
const progressValues = new WeakMap<ProgressTestElement, string>();
const progressInitializers: Array<(this: ProgressTestElement) => void> = [];
const delayed = new AsyncOperationSubscriber<string>();
const delayedValues = new WeakMap<DelayedOperationTestElement, string>();
const delayedInitializers: Array<(this: DelayedOperationTestElement) => void> = [];

let disconnectDelay = 1_000;
let initializeProgress = identity<ProgressTestElement, string>;
let initializeDelayed = identity<DelayedOperationTestElement, string>;

class ProgressTestElement extends SignalElement {
	declare progress: string;

	constructor() {
		super();

		progressValues.set(this, initializeProgress.call(this, "Starting…"));

		for (const initialize of progressInitializers) {
			initialize.call(this);
		}
	}

	protected override render() {
		return html`<output>${this.progress}</output>`;
	}
}

class DelayedOperationTestElement extends SignalElement {
	declare status: string;

	constructor() {
		super();

		delayedValues.set(this, initializeDelayed.call(this, "Waiting"));

		for (const initialize of delayedInitializers) {
			initialize.call(this);
		}
	}

	protected override render() {
		return html`${this.status}`;
	}
}

initializeProgress = decorateAccessor(
	ProgressTestElement.prototype,
	"progress",
	progressValues,
	operation(progressView),
	progressInitializers,
);
initializeDelayed = decorateAccessor(
	DelayedOperationTestElement.prototype,
	"status",
	delayedValues,
	operation(delayed, { disconnectDelay: () => disconnectDelay }),
	delayedInitializers,
);

customElements.define("serve-tools-progress-test", ProgressTestElement);
customElements.define("serve-tools-delayed-operation-test", DelayedOperationTestElement);

describe("operation decorator", () => {
	it("connects multiple elements to one ambient view without owning its operation", async () => {
		const first = new ProgressTestElement();
		const second = new ProgressTestElement();
		const releaseSecond = Promise.withResolvers<void>();
		const releaseThird = Promise.withResolvers<void>();
		const operation = new AsyncOperation<number, string>(async (write) => {
			await write(25);
			await releaseSecond.promise;
			await write(50);
			await releaseThird.promise;
			await write(75);

			return "complete";
		});

		expect(first.progress).toBe("Starting…");
		expect(second.progress).toBe("Starting…");

		document.body.append(first, second);

		const consuming = progress.consume(operation);

		try {
			await waitUntil(() => first.progress === "25%" && second.progress === "25%");

			expect(() => {
				first.progress = "Assigned";
			}).toThrowError("Cannot assign to operation-backed property progress.");

			first.remove();
			releaseSecond.resolve();

			await waitUntil(() => second.progress === "50%");

			expect(first.progress).toBe("25%");
			expect(progress.active).toBe(true);
			expect(operation.signal.aborted).toBe(false);

			document.body.append(first);
			await first.updateComplete;

			expect(first.progress).toBe("25%");

			releaseThird.resolve();

			await expect(consuming).resolves.toBe("complete");
			await waitUntil(() => first.progress === "75%" && second.progress === "75%");

			expect(progress.active).toBe(false);
			expect(first.shadowRoot?.textContent).toBe("75%");
			expect(second.shadowRoot?.textContent).toBe("75%");
		} finally {
			releaseSecond.resolve();
			releaseThird.resolve();
			first.remove();
			second.remove();
			await consuming.catch(() => {});
		}
	});

	it("can retain one element subscription across a brief disconnection", async () => {
		const element = new DelayedOperationTestElement();
		const releaseSecond = Promise.withResolvers<void>();
		const operation = new AsyncOperation<string>(async (write) => {
			await write("first");
			await releaseSecond.promise;
			await write("second");
		});

		document.body.append(element);

		const consuming = delayed.consume(operation);

		try {
			await waitUntil(() => element.status === "first");

			element.remove();
			releaseSecond.resolve();

			await waitUntil(() => element.status === "second");

			expect(operation.signal.aborted).toBe(false);

			document.body.append(element);
			await element.updateComplete;
			await consuming;

			expect(element.shadowRoot?.textContent).toBe("second");
		} finally {
			disconnectDelay = 0;
			releaseSecond.resolve();
			element.remove();
			await consuming.catch(() => {});
			await new Promise((resolve) => setTimeout(resolve, 0));
		}
	});
});

function decorateAccessor<This extends ReactiveControllerHost, Value>(
	prototype: This,
	name: string,
	values: WeakMap<This, Value>,
	decorate: AccessorDecorator<This, Value>,
	initializers: Array<(this: This) => void>,
): (this: This, value: Value) => Value {
	const target: ClassAccessorDecoratorTarget<This, Value> = {
		get() {
			return values.get(this)!;
		},
		set(value) {
			values.set(this, value);
		},
	};
	const decorated = decorate(target, {
		kind: "accessor",
		name,
		static: false,
		private: false,
		access: {
			has(element) {
				return name in element;
			},
			get(element) {
				return Reflect.get(element, name) as Value;
			},
			set(element, value) {
				Reflect.set(element, name, value);
			},
		},
		addInitializer(initializer) {
			initializers.push(initializer);
		},
		metadata: {},
	});

	Object.defineProperty(prototype, name, {
		configurable: true,
		get: decorated.get ?? target.get,
		set: decorated.set ?? target.set,
	});

	return decorated.init ?? identity;
}

function identity<This, Value>(this: This, value: Value): Value {
	return value;
}

type AccessorDecorator<This extends ReactiveControllerHost, Value> = (
	target: ClassAccessorDecoratorTarget<This, Value>,
	context: ClassAccessorDecoratorContext<This, Value>,
) => ClassAccessorDecoratorResult<This, Value>;

const waitUntil = async (condition: () => boolean): Promise<void> => {
	for (let attempt = 0; attempt < 100; ++attempt) {
		if (condition()) {
			return;
		}

		await new Promise((resolve) => setTimeout(resolve, 0));
	}

	throw new Error("Timed out waiting for an operation state change");
};
