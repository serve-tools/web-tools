import { Signal } from "@serve-tools/signal";
import type { PropertyDeclaration } from "lit";

export type { PropertyDeclaration } from "lit";

const alwaysChanged = () => true;

export const signalAccessor = <This extends ReactiveElement, Value>(
	target: ClassAccessorDecoratorTarget<This, Value>,
	{ name, metadata }: ClassAccessorDecoratorContext<This, Value>,
	options: PropertyDeclaration<Value, unknown>,
	normalize: (value: Value) => Value,
): ClassAccessorDecoratorResult<This, Value> => {
	let properties = litPropertyMetadata.get(metadata);

	if (properties === undefined) {
		litPropertyMetadata.set(metadata, (properties = new Map()));
	}

	properties.set(name, options);

	const stateOf = (instance: This) => target.get.call(instance) as unknown as Signal.State<Value>;

	return {
		init(value) {
			const normalizedValue = normalize(value);
			const state = new Signal.State(normalizedValue);

			if (normalizedValue !== undefined && (options as SignalPropertyOptions).update === "lifecycle") {
				this.requestUpdate(name, undefined, { ...options, hasChanged: alwaysChanged }, true, normalizedValue);
			}

			return state as unknown as Value;
		},
		get() {
			return stateOf(this).get();
		},
		set(value) {
			const state = stateOf(this);
			const normalizedValue = normalize(value);

			if ((options as SignalPropertyOptions).update === "lifecycle") {
				const oldValue = Signal.subtle.untrack(() => state.get());

				state.set(normalizedValue);

				this.requestUpdate(name, oldValue, options, true, normalizedValue);
			} else {
				state.set(normalizedValue);
			}
		},
	};
};

/** Metadata for signal element properties. */
const litPropertyMetadata = ((globalThis as any).litPropertyMetadata ??= new WeakMap());

export type ReactiveElement = {
	requestUpdate(
		/** Represents the name of the requesting property. */
		name?: PropertyKey,

		/** Represents the old value of the requesting property. */
		oldValue?: unknown,

		/** Represents the property options to use instead of the previously configured options */
		options?: PropertyDeclaration,

		/** Represents whether the newValue argument is used instead of reading the property value. */
		useNewValue?: boolean,

		/** Represents the new value of the property. This is only used if `useNewValue` is true. */
		newValue?: unknown,
	): void;
};

type SignalPropertyOptions = {
	update?: "atomic" | "lifecycle";
};
