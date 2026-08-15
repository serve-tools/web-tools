declare const protocolBrand: unique symbol;
declare const transferBrand: unique symbol;

/** A compile-time collection of named request and subscription signatures. */
export type Protocol = {
	readonly requests?: object;
	readonly subscriptions?: object;
};

/** An endpoint compatible with workers and message ports. */
export interface MessageEndpoint {
	/** Sends a structured-clone message and optionally transfers ownership of transferable objects. */
	postMessage(message: unknown, transfer?: readonly Transferable[]): void;

	/** Registers the protocol's message listener. */
	addEventListener(type: "message", listener: (event: MessageEventLike) => void): void;

	/** Removes the protocol's message listener. */
	removeEventListener(type: "message", listener: (event: MessageEventLike) => void): void;

	/** Starts delivery for endpoints such as a `MessagePort`; called automatically when present. */
	start?(): void;
}

/** Options for sending and cancelling a request. */
export interface RequestOptions {
	/** Cancels the operation locally and aborts its server-side context. */
	readonly signal?: AbortSignal;

	/** Objects whose ownership is transferred with the operation input. */
	readonly transfer?: readonly Transferable[];
}

/** Options for sending, cancelling, and observing the completion of a subscription. */
export interface SubscribeOptions extends RequestOptions {
	/** Called when the server completes the subscription normally. */
	readonly onComplete?: () => void;

	/** Called with a remote or transport error when the subscription fails. */
	readonly onError?: (error: Error) => void;
}

/** State supplied to a request handler. */
export interface RequestContext {
	/** Aborts when the caller cancels or either side closes the operation. */
	readonly signal: AbortSignal;
}

/** Controls event delivery and settlement from a subscription handler. */
export interface SubscriptionContext<Value> extends RequestContext {
	/** Emits one structured-clone value, optionally with a transfer list. */
	emit(value: Value | TransferResult<Value>): void;

	/** Completes the subscription successfully. */
	complete(): void;

	/** Fails the subscription and delivers a serialized error to the client. */
	error(reason: unknown): void;
}

/** A result value paired with objects whose ownership should be transferred. */
export interface TransferResult<Value> {
	/** The structured-clone value to send. */
	readonly value: Value;

	/** Objects transferred with the value. */
	readonly transfer: readonly Transferable[];
	readonly [transferBrand]: true;
}

/** A disposable handle for one active subscription. */
export interface Subscription extends Disposable {
	/** Whether the subscription can still receive values. */
	readonly active: boolean;

	/** Cancels the subscription. Calling it more than once has no effect. */
	unsubscribe(): void;
}

/** A typed, disposable connection used to request and subscribe to remote operations. */
export interface Client<P extends Protocol = Protocol> extends Disposable {
	/** Sends a named request and resolves with its remote result. */
	request<Name extends RequestName<P>>(
		name: Name,
		...arguments_: RequestArguments<RequestOperation<P, Name>>
	): Promise<RequestOutput<RequestOperation<P, Name>>>;

	/** Opens a named subscription and returns its disposable local handle. */
	subscribe<Name extends SubscriptionName<P>>(
		name: Name,
		...arguments_: SubscribeArguments<SubscriptionOperation<P, Name>>
	): Subscription;

	/** Resolves after either peer closes the protocol connection. */
	readonly closed: Promise<void>;

	/** Closes the protocol connection without closing or terminating its underlying endpoint. */
	close(reason?: unknown): void;

	readonly [protocolBrand]: P;
}

/** A disposable server attached to one message endpoint. */
export interface Server<P extends Protocol = Protocol> extends Disposable {
	readonly [protocolBrand]: P;

	/** Resolves after either peer closes the protocol connection. */
	readonly closed: Promise<void>;

	/** Aborts active handlers and closes the protocol without closing its underlying endpoint. */
	close(reason?: unknown): void;
}

/** A disposable collection of the active protocol servers owned by a worker scope. */
export interface Listener<P extends Protocol = Protocol> extends ReadonlyArray<Server<P>>, Disposable {
	readonly [protocolBrand]: P;

	/** Stops accepting connections and closes every active server. */
	close(reason?: unknown): void;
}

/** Extracts the inline protocol retained by a client, server, or listener, including promise-wrapped resources. */
export type ProtocolType<Value> =
	Awaited<Value> extends { readonly [protocolBrand]: infer P extends Protocol } ? P : never;

export type ProtocolDefinition<P> = {
	readonly [Section in keyof P]: Section extends "requests" | "subscriptions"
		? P[Section] extends object
			? OperationDefinitions<P[Section]>
			: never
		: never;
};

export type OperationDefinitions<Operations> = {
	readonly [Name in keyof Operations]: Operations[Name] extends (...arguments_: infer Arguments) => infer Output
		? Arguments extends [] | [unknown]
			? (...arguments_: Arguments) => Output
			: never
		: never;
};

/** Handler tables implementing every request and subscription in a protocol. */
export type Handlers<P extends Protocol> = {
	readonly [Section in keyof P]-?: Section extends "requests"
		? P[Section] extends object
			? RequestHandlers<P[Section]>
			: never
		: Section extends "subscriptions"
			? P[Section] extends object
				? SubscriptionHandlers<P[Section]>
				: never
			: never;
};

type RequestHandlers<Operations> = {
	readonly [Name in keyof Operations]: (
		input: OperationInput<Extract<Operations[Name], Operation>>,
		context: RequestContext,
	) => Awaitable<
		| RequestOutput<Extract<Operations[Name], Operation>>
		| TransferResult<RequestOutput<Extract<Operations[Name], Operation>>>
	>;
};

type SubscriptionHandlers<Operations> = {
	readonly [Name in keyof Operations]: (
		input: OperationInput<Extract<Operations[Name], Operation>>,
		context: SubscriptionContext<SubscriptionEvent<Extract<Operations[Name], Operation>>>,
	) => Awaitable<SubscriptionHandlerResult>;
};

export interface MessageEventLike {
	readonly data: unknown;
}

export interface ErrorRecord {
	readonly name: string;
	readonly message: string;
	readonly stack?: string;
}

export type Requests<P> = P extends { readonly requests: infer Operations } ? Operations : Record<never, never>;
export type Subscriptions<P> = P extends { readonly subscriptions: infer Operations }
	? Operations
	: Record<never, never>;
export type RequestName<P> = Extract<keyof Requests<P>, string>;
export type SubscriptionName<P> = Extract<keyof Subscriptions<P>, string>;
export type RequestOperation<P, Name extends RequestName<P>> = Extract<Requests<P>[Name], Operation>;
export type SubscriptionOperation<P, Name extends SubscriptionName<P>> = Extract<Subscriptions<P>[Name], Operation>;
export type Operation = (...arguments_: any[]) => unknown;
type NoInput = ReturnType<() => void>;
export type OperationInput<Value extends Operation> = Parameters<Value> extends [] ? NoInput : Parameters<Value>[0];
export type RequestOutput<Value extends Operation> = Awaited<ReturnType<Value>>;
export type SubscriptionEvent<Value extends Operation> = ReturnType<Value>;
export type RequestArguments<Value extends Operation> = [OperationInput<Value>] extends [NoInput]
	? [input?: undefined, options?: RequestOptions]
	: [input: OperationInput<Value>, options?: RequestOptions];
export type SubscribeArguments<Value extends Operation> = [OperationInput<Value>] extends [NoInput]
	? [onEvent: (value: SubscriptionEvent<Value>) => void, options?: SubscribeOptions]
	: [input: OperationInput<Value>, onEvent: (value: SubscriptionEvent<Value>) => void, options?: SubscribeOptions];
export type Awaitable<Value> = Value | PromiseLike<Value>;
export type SubscriptionHandlerResult = ReturnType<() => void> | (() => void);
export type EventListener = (value: unknown) => void;
export type OperationKind = "request" | "subscription";
export type SendResult = { readonly ok: true } | { readonly ok: false; readonly error: unknown };
export type Settlement =
	| { readonly ok: true; readonly data: unknown }
	| { readonly ok: false; readonly error: ErrorRecord };

export type OpenMessage =
	| readonly [protocol: string, type: "request", id: number, name: string, data: unknown]
	| readonly [protocol: string, type: "subscription", id: number, name: string, data: unknown];

export type WireMessage =
	| OpenMessage
	| readonly [protocol: string, type: "next", id: number, data: unknown]
	| readonly [protocol: string, type: "resolve", id: number, data: unknown]
	| readonly [protocol: string, type: "reject", id: number, error: ErrorRecord]
	| readonly [protocol: string, type: "cancel", id: number]
	| readonly [protocol: string, type: "lease", name: string]
	| readonly [protocol: string, type: "close", error: ErrorRecord];

export interface ClientOperation {
	readonly kind: OperationKind;
	readonly next: EventListener;
	readonly settle: (ok: boolean, value: unknown) => void;
	readonly cancel: (reason: unknown) => void;
	readonly off: () => void;
}

export type AnyHandler = (input: unknown, context: RequestContext | SubscriptionContext<unknown>) => Awaitable<unknown>;
