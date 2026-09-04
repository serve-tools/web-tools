import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const nativeObservableDescriptor = Object.getOwnPropertyDescriptor(globalThis, "Observable");
const nativeSubscriberDescriptor = Object.getOwnPropertyDescriptor(globalThis, "Subscriber");
const nativeEventTargetDescriptor = Object.getOwnPropertyDescriptor(globalThis, "EventTarget");
const NativeEventTarget = nativeEventTargetDescriptor?.value as typeof EventTarget;
const nativeWhenDescriptor = Object.getOwnPropertyDescriptor(NativeEventTarget.prototype, "when");

const restore = () => {
	Reflect.deleteProperty(globalThis, "Observable");
	Reflect.deleteProperty(globalThis, "Subscriber");
	Reflect.deleteProperty(NativeEventTarget.prototype, "when");

	if (nativeObservableDescriptor) {
		Object.defineProperty(globalThis, "Observable", nativeObservableDescriptor);
	}

	if (nativeSubscriberDescriptor) {
		Object.defineProperty(globalThis, "Subscriber", nativeSubscriberDescriptor);
	}

	if (nativeWhenDescriptor) {
		Object.defineProperty(NativeEventTarget.prototype, "when", nativeWhenDescriptor);
	}

	Reflect.deleteProperty(globalThis, "EventTarget");

	if (nativeEventTargetDescriptor) {
		Object.defineProperty(globalThis, "EventTarget", nativeEventTargetDescriptor);
	}
};

describe("Observable polyfill", () => {
	beforeEach(() => {
		vi.resetModules();

		Reflect.deleteProperty(globalThis, "Observable");
		Reflect.deleteProperty(globalThis, "Subscriber");
		Reflect.deleteProperty(NativeEventTarget.prototype, "when");
	});

	afterEach(() => {
		vi.restoreAllMocks();
		restore();
	});

	it("installs each missing interface object and EventTarget method", async () => {
		await import("../src/polyfill-observable.js");

		const target = new EventTarget();
		const result = target.when("tick").take(1).toArray();

		target.dispatchEvent(new Event("tick"));

		expect(globalThis.Observable).toBeTypeOf("function");
		expect(globalThis.Subscriber).toBeTypeOf("function");
		expect(target.when("other")).toBeInstanceOf(globalThis.Observable);
		expect(await result).toEqual([expect.objectContaining({ type: "tick" })]);
		expect(() => Reflect.construct(globalThis.Subscriber, [])).toThrow(TypeError);
	});

	it("installs writable, configurable, non-enumerable properties", async () => {
		await import("../src/polyfill-observable.js");

		for (const [target, key] of [
			[globalThis, "Observable"],
			[globalThis, "Subscriber"],
			[EventTarget.prototype, "when"],
		] as const) {
			expect(Object.getOwnPropertyDescriptor(target, key)).toMatchObject({
				configurable: true,
				enumerable: false,
				writable: true,
			});
		}
	});

	it("preserves native values and descriptors by exact identity", async () => {
		class NativeObservable {}
		class NativeSubscriber {}
		function nativeWhen(this: EventTarget) {
			return this;
		}

		Object.defineProperty(globalThis, "Observable", { value: NativeObservable, configurable: true });
		Object.defineProperty(globalThis, "Subscriber", { value: NativeSubscriber, configurable: true });
		Object.defineProperty(EventTarget.prototype, "when", { value: nativeWhen, configurable: true });

		const descriptors = [
			Object.getOwnPropertyDescriptor(globalThis, "Observable"),
			Object.getOwnPropertyDescriptor(globalThis, "Subscriber"),
			Object.getOwnPropertyDescriptor(EventTarget.prototype, "when"),
		];

		await import("../src/polyfill-observable.js");

		expect(Reflect.get(globalThis, "Observable")).toBe(NativeObservable);
		expect(Reflect.get(globalThis, "Subscriber")).toBe(NativeSubscriber);
		expect(Reflect.get(EventTarget.prototype, "when")).toBe(nativeWhen);
		expect(Object.getOwnPropertyDescriptor(globalThis, "Observable")).toEqual(descriptors[0]);
		expect(Object.getOwnPropertyDescriptor(globalThis, "Subscriber")).toEqual(descriptors[1]);
		expect(Object.getOwnPropertyDescriptor(EventTarget.prototype, "when")).toEqual(descriptors[2]);
	});

	it("fills missing members independently in a partial native implementation", async () => {
		class NativeObservable<T> {
			constructor(callback: (subscriber: NativeSubscriberRecord<T>) => void) {
				this.#callback = callback;
			}

			subscribe(next: (value: T) => void): void {
				this.#callback({
					active: true,
					next,
					addTeardown() {},
				});
			}

			#callback: (subscriber: NativeSubscriberRecord<T>) => void;
		}

		Object.defineProperty(globalThis, "Observable", {
			value: NativeObservable,
			configurable: true,
			writable: true,
		});

		await import("../src/polyfill-observable.js");

		const target = new EventTarget();
		const values: Event[] = [];
		const observable = target.when("tick");

		observable.subscribe((event) => values.push(event));
		target.dispatchEvent(new Event("tick"));

		expect(Reflect.get(globalThis, "Observable")).toBe(NativeObservable);
		expect(globalThis.Subscriber).toBeTypeOf("function");
		expect(observable).toBeInstanceOf(NativeObservable);
		expect(values).toEqual([expect.objectContaining({ type: "tick" })]);
	});

	it("preserves a native Subscriber while installing missing neighbors", async () => {
		class NativeSubscriber {}

		Object.defineProperty(globalThis, "Subscriber", { value: NativeSubscriber, configurable: true });

		const descriptor = Object.getOwnPropertyDescriptor(globalThis, "Subscriber");

		await import("../src/polyfill-observable.js");

		expect(Reflect.get(globalThis, "Subscriber")).toBe(NativeSubscriber);
		expect(Object.getOwnPropertyDescriptor(globalThis, "Subscriber")).toEqual(descriptor);
		expect(globalThis.Observable).toBeTypeOf("function");
		expect(EventTarget.prototype.when).toBeTypeOf("function");
	});

	it("preserves a native EventTarget.when while installing missing neighbors", async () => {
		function nativeWhen() {}

		Object.defineProperty(EventTarget.prototype, "when", { value: nativeWhen, configurable: true });

		const descriptor = Object.getOwnPropertyDescriptor(EventTarget.prototype, "when");

		await import("../src/polyfill-observable.js");

		expect(Reflect.get(EventTarget.prototype, "when")).toBe(nativeWhen);
		expect(Object.getOwnPropertyDescriptor(EventTarget.prototype, "when")).toEqual(descriptor);
		expect(globalThis.Observable).toBeTypeOf("function");
		expect(globalThis.Subscriber).toBeTypeOf("function");
	});

	it("uses a native Observable when only EventTarget.when is missing", async () => {
		class NativeObservable {}
		class NativeSubscriber {}

		Object.defineProperty(globalThis, "Observable", { value: NativeObservable, configurable: true });
		Object.defineProperty(globalThis, "Subscriber", { value: NativeSubscriber, configurable: true });

		await import("../src/polyfill-observable.js");

		const result = new EventTarget().when("tick");

		expect(result).toBeInstanceOf(NativeObservable);
		expect(Reflect.get(globalThis, "Subscriber")).toBe(NativeSubscriber);
	});

	it("is idempotent across repeated module evaluation", async () => {
		await import("../src/polyfill-observable.js");

		const values = [globalThis.Observable, globalThis.Subscriber, EventTarget.prototype.when];
		const descriptors = [
			Object.getOwnPropertyDescriptor(globalThis, "Observable"),
			Object.getOwnPropertyDescriptor(globalThis, "Subscriber"),
			Object.getOwnPropertyDescriptor(EventTarget.prototype, "when"),
		];

		vi.resetModules();
		await import("../src/polyfill-observable.js");

		expect([globalThis.Observable, globalThis.Subscriber, EventTarget.prototype.when]).toEqual(values);
		expect(Object.getOwnPropertyDescriptor(globalThis, "Observable")).toEqual(descriptors[0]);
		expect(Object.getOwnPropertyDescriptor(globalThis, "Subscriber")).toEqual(descriptors[1]);
		expect(Object.getOwnPropertyDescriptor(EventTarget.prototype, "when")).toEqual(descriptors[2]);
	});

	it("keeps each selective installer independent", async () => {
		await import("../src/apply/Subscriber.js");

		expect(globalThis.Subscriber).toBeTypeOf("function");
		expect(Reflect.has(globalThis, "Observable")).toBe(false);
		expect(Reflect.has(EventTarget.prototype, "when")).toBe(false);

		await import("../src/apply/EventTarget/when.js");

		expect(EventTarget.prototype.when).toBeTypeOf("function");
		expect(Reflect.has(globalThis, "Observable")).toBe(false);

		await import("../src/apply/Observable.js");

		expect(globalThis.Observable).toBeTypeOf("function");
	});

	it("supports native-aware imports without global mutation", async () => {
		const observableModule = await import("../src/exports/Observable.js");
		const subscriberModule = await import("../src/exports/Subscriber.js");
		const whenModule = await import("../src/exports/EventTarget/when.js");
		const ponyfill = await import("@serve-tools/ponyfill-observable");

		expect(observableModule.Observable).toBe(ponyfill.Observable);
		expect(subscriberModule.Subscriber).toBe(ponyfill.Subscriber);
		expect(whenModule.when).toBeTypeOf("function");
		expect(Reflect.has(globalThis, "Observable")).toBe(false);
		expect(Reflect.has(globalThis, "Subscriber")).toBe(false);
		expect(Reflect.has(EventTarget.prototype, "when")).toBe(false);
	});

	it("exports existing native values by exact identity without mutation", async () => {
		class NativeObservable {}
		class NativeSubscriber {}
		function nativeWhen() {}

		Object.defineProperty(globalThis, "Observable", { value: NativeObservable, configurable: true });
		Object.defineProperty(globalThis, "Subscriber", { value: NativeSubscriber, configurable: true });
		Object.defineProperty(EventTarget.prototype, "when", { value: nativeWhen, configurable: true });

		const observableModule = await import("../src/exports/Observable.js");
		const subscriberModule = await import("../src/exports/Subscriber.js");
		const whenModule = await import("../src/exports/EventTarget/when.js");

		expect(observableModule.Observable).toBe(NativeObservable);
		expect(subscriberModule.Subscriber).toBe(NativeSubscriber);
		expect(whenModule.when).toBe(nativeWhen);
	});

	it("preserves a non-null EventTarget.when sentinel without attempting repair", async () => {
		const sentinel = {};

		Object.defineProperty(EventTarget.prototype, "when", {
			value: sentinel,
			configurable: true,
			writable: true,
		});

		const descriptor = Object.getOwnPropertyDescriptor(EventTarget.prototype, "when");

		await import("../src/apply/EventTarget/when.js");
		const whenModule = await import("../src/exports/EventTarget/when.js");

		expect(Reflect.get(EventTarget.prototype, "when")).toBe(sentinel);
		expect(whenModule.when).toBe(sentinel);
		expect(Object.getOwnPropertyDescriptor(EventTarget.prototype, "when")).toEqual(descriptor);
	});

	it("does not throw when EventTarget is unavailable", async () => {
		Reflect.deleteProperty(globalThis, "EventTarget");

		await expect(import("../src/polyfill-observable.js")).resolves.toBeTypeOf("object");
		expect(globalThis.Observable).toBeTypeOf("function");
		expect(globalThis.Subscriber).toBeTypeOf("function");
	});
});

interface NativeSubscriberRecord<T> {
	active: boolean;
	next(value: T): void;
	addTeardown(teardown: () => void): void;
}
