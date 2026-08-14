import type { Context } from "@serve-tools/client-context";
import type { Signal } from "@serve-tools/signal";
import {
	AtomicContextProvider,
	type ContextElement,
	type ContextUpdate,
	initializeContextState,
	setContextState,
} from "./.context.js";

/** Creates a signal-backed accessor that provides its value through context. */
export const provide =
	<Value>({ context, update = "atomic" }: ProvideOptions<Value>) =>
	<This extends ContextElement, AccessorValue extends Value>(
		target: ClassAccessorDecoratorTarget<This, AccessorValue>,
		{ name }: ClassAccessorDecoratorContext<This, AccessorValue>,
	): ClassAccessorDecoratorResult<This, AccessorValue> => {
		type ProvidedContext = {
			provider: AtomicContextProvider<Context<unknown, Value>>;
			state: Signal.State<AccessorValue>;
		};

		const contextOf = (instance: This) => target.get.call(instance) as unknown as ProvidedContext;

		return {
			init(value) {
				return {
					provider: new AtomicContextProvider(this, context, value),
					state: initializeContextState(this, name, value, update),
				} as unknown as AccessorValue;
			},
			get() {
				return contextOf(this).state.get();
			},
			set(value) {
				const provided = contextOf(this);

				setContextState(this, name, provided.state, value, update);
				provided.provider.setValue(value);
			},
		};
	};

/** Options for a signal-backed provided context accessor. */
export interface ProvideOptions<Value> {
	/** The context through which the accessor provides its value. */
	context: Context<unknown, Value>;

	/** Chooses atomic signal invalidation or Lit's named update lifecycle. @default "atomic" */
	update?: ContextUpdate;
}
