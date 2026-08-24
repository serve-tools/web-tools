import type { ReactiveElement } from "./.internals.js";
import { signalAccessor } from "./.internals.js";

/** Creates a signal-backed, non-attribute collection property. */
export const collection =
	(Collection: CollectionConstructor) =>
	<This extends ReactiveElement, Value extends object>(
		target: ClassAccessorDecoratorTarget<This, Value>,
		context: ClassAccessorDecoratorContext<This, Value>,
	): ClassAccessorDecoratorResult<This, Value> => {
		const create = Collection as unknown as new (value: Value) => Value;

		return signalAccessor(target, context, { attribute: false }, (value) => {
			return value instanceof Collection ? value : new create(value);
		});
	};

/** A native-shaped signal collection constructor accepted by {@link collection}. */
export interface CollectionConstructor {
	/** Creates a signal-backed collection instance. */
	new (): object;

	/** The prototype shared by constructed collection instances. */
	readonly prototype: object;
}
