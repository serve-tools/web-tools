import type { Context } from "@serve-tools/client-context";
import type { Signal } from "@serve-tools/signal";
import {
	AtomicContextConsumer,
	type ContextElement,
	type ContextUpdate,
	initializeContextState,
	setContextState,
} from "./.context.js";

/** Creates a read-only signal-backed accessor for a consumed context value. */
export const consume =
	<Value>({ context, subscribe = false, update = "atomic" }: ConsumeOptions<Value>) =>
	<This extends ContextElement, AccessorValue extends Value | undefined>(
		target: ClassAccessorDecoratorTarget<This, AccessorValue>,
		{ addInitializer, name }: ClassAccessorDecoratorContext<This, AccessorValue>,
	): ClassAccessorDecoratorResult<This, AccessorValue> => {
		const stateOf = (instance: This) => target.get.call(instance) as unknown as Signal.State<AccessorValue>;

		addInitializer(function (): void {
			new AtomicContextConsumer(this, context, subscribe, (value) => {
				setContextState(this, name, stateOf(this), value as AccessorValue, update);
			});
		});

		return {
			init(value) {
				return initializeContextState(this, name, value, update) as unknown as AccessorValue;
			},
			get() {
				return stateOf(this).get();
			},
			set() {
				throw new TypeError(`Cannot assign to consumed context property ${String(name)}.`);
			},
		};
	};

/** Options for a signal-backed consumed context accessor. */
export interface ConsumeOptions<Value> {
	/** The context whose value the accessor consumes. */
	context: Context<unknown, Value>;

	/** Whether to receive later values from the active provider. @default false */
	subscribe?: boolean;

	/** Chooses atomic signal invalidation or Lit's named update lifecycle. @default "atomic" */
	update?: ContextUpdate;
}
