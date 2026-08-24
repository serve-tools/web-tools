import { Signal } from "@serve-tools/signal";
import type { PropertyDeclaration } from "lit";

export type { PropertyDeclaration } from "lit";

const alwaysChanged = () => true;

/** Wraps a Lit accessor in signal state with optional lifecycle-aware updates. */
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

/** The reactive host interface required by signal-backed property decorators. */
export type ReactiveElement = {
	/** Requests a Lit update for an optional property and its previous value. */
	requestUpdate(
		/** The name of the property requesting an update. */
		name?: PropertyKey,

		/** The property's value before the update. */
		oldValue?: unknown,

		/** Property options overriding the previously configured declaration. */
		options?: PropertyDeclaration,

		/** Whether to use the supplied new value instead of reading the property. */
		useNewValue?: boolean,

		/** The new property value when `useNewValue` is enabled. */
		newValue?: unknown,
	): void;
};

type SignalPropertyOptions = {
	update?: "atomic" | "lifecycle";
};
