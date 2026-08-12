import { Signal } from "@serve-tools/signal";

/** Memoizes a getter with a computed signal. */
export const computed = <This extends object, Value>(
	getter: (this: This) => Value,
	{ addInitializer }: ClassGetterDecoratorContext<This, Value>,
): ((this: This) => Value) => {
	const signalKey = Symbol();

	addInitializer(function (): void {
		const signal = new Signal.Computed(() => getter.call(this));

		Object.defineProperty(this, signalKey, { value: signal });
	});

	return function (): Value {
		return (this as This & { [signalKey]: Signal.Computed<Value> })[signalKey].get();
	};
};
