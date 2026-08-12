import { Signal } from "@serve-tools/signal";
import type { PropertyDeclaration, ReactiveElement } from "./.internals.js";
import { initializeDecorator } from "./.internals.js";

const alwaysChanged = () => true;

/** Creates a signal-backed Lit reactive property. */
export const property =
	<Value>(options: SignalPropertyDeclaration<Value> = {}) =>
	<This extends ReactiveElement>(
		target: ClassAccessorDecoratorTarget<This, Value>,
		{ name, metadata }: ClassAccessorDecoratorContext<This, Value>,
	): ClassAccessorDecoratorResult<This, Value> => {
		options ??= {};

		initializeDecorator(metadata, name, options);

		const stateOf = (instance: This) => target.get.call(instance) as unknown as Signal.State<Value>;

		return {
			init(value) {
				const state = new Signal.State(value);

				if (value !== undefined && options.update === "lifecycle") {
					this.requestUpdate(name, undefined, { ...options, hasChanged: alwaysChanged }, true, value);
				}

				return state as unknown as Value;
			},
			get() {
				return stateOf(this).get();
			},
			set(value) {
				const state = stateOf(this);

				if (options.update === "lifecycle") {
					const oldValue = Signal.subtle.untrack(() => state.get());

					state.set(value);

					this.requestUpdate(name, oldValue, options, true, value);
				} else {
					state.set(value);
				}
			},
		};
	};

export interface SignalPropertyDeclaration<Value> extends PropertyDeclaration<Value> {
	update?: "atomic" | "lifecycle";
}
