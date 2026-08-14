/** Associates a context key with its value type without changing the key at runtime. */
export type Context<KeyType, ValueType> = KeyType & {
	readonly __context__: ValueType;
};

/** A context whose key and value types are not known. */
export type UnknownContext = Context<unknown, unknown>;

/** Extracts the value type associated with a context key. */
export type ContextType<Key extends UnknownContext> = Key extends Context<unknown, infer ValueType> ? ValueType : never;

/** Associates a runtime key with a context value type. */
export const createContext = <ValueType, KeyType = unknown>(key: KeyType): Context<KeyType, ValueType> =>
	key as Context<KeyType, ValueType>;

/** Receives a context value and, for subscriptions, its stable cancellation function. */
export type ContextCallback<ValueType> = (this: Element, value: ValueType, unsubscribe?: () => void) => void;

/** The structural shape of an interoperable context request. */
export interface ContextRequest<RequestedContext extends UnknownContext = UnknownContext> extends Event {
	readonly context: RequestedContext;
	readonly contextTarget?: Element;
	readonly callback: ContextCallback<ContextType<RequestedContext>>;
	readonly subscribe?: boolean;
}

/** An author-code event implementing the Context Protocol request shape. */
export class ContextRequestEvent<RequestedContext extends UnknownContext>
	extends Event
	implements ContextRequest<RequestedContext>
{
	readonly subscribe: boolean;

	constructor(
		readonly context: RequestedContext,
		readonly contextTarget: Element,
		readonly callback: ContextCallback<ContextType<RequestedContext>>,
		subscribe = false,
	) {
		super("context-request", { bubbles: true, composed: true });

		this.subscribe = subscribe;
	}
}

/** The structural shape of an interoperable provider announcement. */
export interface ContextProviderAnnouncement<ProvidedContext extends UnknownContext = UnknownContext> extends Event {
	readonly context: ProvidedContext;
	readonly contextTarget?: Element;
}

/** An author-code event implementing the Context Protocol provider-announcement shape. */
export class ContextProviderEvent<ProvidedContext extends UnknownContext>
	extends Event
	implements ContextProviderAnnouncement<ProvidedContext>
{
	constructor(
		readonly context: ProvidedContext,
		readonly contextTarget: Element,
	) {
		super("context-provider", { bubbles: true, composed: true });
	}
}
