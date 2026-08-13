import type { PropertyDeclaration, ReactiveElement } from "./.internals.js";
import { signalAccessor } from "./.internals.js";

/** Creates a signal-backed Lit reactive property. */
export const property =
	<Value>(options: SignalPropertyDeclaration<Value> = {}) =>
	<This extends ReactiveElement>(
		target: ClassAccessorDecoratorTarget<This, Value>,
		context: ClassAccessorDecoratorContext<This, Value>,
	): ClassAccessorDecoratorResult<This, Value> => {
		options ??= {};

		return signalAccessor(target, context, options, identity);
	};

const identity = <Value>(value: Value): Value => value;

/** Lit property options extended with the Signal update strategy. */
export interface SignalPropertyDeclaration<Value> extends PropertyDeclaration<Value> {
	/** Chooses atomic signal invalidation or Lit's complete reactive update lifecycle. @default "atomic" */
	update?: "atomic" | "lifecycle";
}
