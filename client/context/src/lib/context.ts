/** Associates a context key with its value type without changing the key at runtime. */
export type Context<KeyType, ValueType> = KeyType & {
	/** Associates the value type at compile time without adding a runtime property. */
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
	/** The context key whose value is requested. */
	readonly context: RequestedContext;

	/** The requesting element, when explicitly provided by the event implementation. */
	readonly contextTarget?: Element;

	/** Receives the resolved value and, for subscriptions, its cancellation function. */
	readonly callback: ContextCallback<ContextType<RequestedContext>>;

	/** Whether the request should subscribe to future values and retain an initial miss. */
	readonly subscribe?: boolean;
}

/** An author-code event implementing the Context Protocol request shape. */
export class ContextRequestEvent<RequestedContext extends UnknownContext>
	extends Event
	implements ContextRequest<RequestedContext>
{
	/** Whether the request subscribes to future values and retains an initial miss. */
	readonly subscribe: boolean;

	/** Creates a bubbling, composed request for a context value. */
	constructor(
		/** The context key whose value is requested. */
		readonly context: RequestedContext,

		/** The element requesting the context value. */
		readonly contextTarget: Element,

		/** Receives the resolved value and, for subscriptions, its cancellation function. */
		readonly callback: ContextCallback<ContextType<RequestedContext>>,

		subscribe = false,
	) {
		super("context-request", { bubbles: true, composed: true });

		this.subscribe = subscribe;
	}
}

/** The structural shape of an interoperable provider announcement. */
export interface ContextProviderAnnouncement<ProvidedContext extends UnknownContext = UnknownContext> extends Event {
	/** The context key supplied by the announcing provider. */
	readonly context: ProvidedContext;

	/** The announcing provider element, when explicitly provided by the event implementation. */
	readonly contextTarget?: Element;
}

/** An author-code event implementing the Context Protocol provider-announcement shape. */
export class ContextProviderEvent<ProvidedContext extends UnknownContext>
	extends Event
	implements ContextProviderAnnouncement<ProvidedContext>
{
	/** Creates a bubbling, composed announcement for an available context provider. */
	constructor(
		/** The context key supplied by the announcing provider. */
		readonly context: ProvidedContext,

		/** The element announcing itself as the context provider. */
		readonly contextTarget: Element,
	) {
		super("context-provider", { bubbles: true, composed: true });
	}
}
